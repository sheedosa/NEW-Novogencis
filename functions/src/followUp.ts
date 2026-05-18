/**
 * Auto follow-up suggestion generator.
 *
 * Runs daily at 09:00 Europe/London. Finds clients who have sat in "Reviewed"
 * status for more than 48 hours with no upcoming appointment — these are the
 * leaks the Today panel's "Clinic radar" has been flagging without doing
 * anything about.
 *
 * For each, generates a personalised follow-up message draft using Claude
 * Sonnet (patient-facing content quality matters more than cost here) and
 * writes it to `followup_suggestions/{clientId}` for the doctor to approve
 * + send (NOT auto-send — we never message a patient without human review).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import Anthropic from '@anthropic-ai/sdk';
import { db } from './index.js';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const MODEL = 'claude-sonnet-4-6';

const STALE_HOURS = 48;          // how long in Reviewed before we suggest
const MAX_PER_RUN = 20;          // cap per day so a backlog doesn't blow cost

interface FollowUpSuggestion {
  clientId: string;
  clientName: string;
  clientFirstName: string;
  reviewedAt: string;
  hoursStale: number;
  draftSubject: string;
  draftBody: string;
  status: 'pending-approval' | 'sent' | 'dismissed';
  generatedAt: string;
  model: string;
  usage: { input: number; output: number };
}

export const generateFollowUpSuggestions = onSchedule(
  {
    schedule: '0 9 * * *',
    timeZone: 'Europe/London',
    region: 'europe-west2',
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    logger.info('[followUp] starting');

    // ── Find candidates ──────────────────────────────────────────────────────
    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

    const reviewedSnap = await db.collection('clients')
      .where('status', '==', 'Reviewed')
      .get();

    const candidates = reviewedSnap.docs
      .map(d => ({ id: d.id, data: d.data() }))
      .filter(({ data }) => {
        const reviewDate = data.assessmentData?.reviewDate;
        return reviewDate && reviewDate <= cutoff;
      });

    logger.info(`[followUp] ${candidates.length} candidate(s) for outreach`);

    if (candidates.length === 0) return;

    // ── Skip clients with an upcoming appointment (already in motion) ────────
    const filtered: typeof candidates = [];
    for (const c of candidates) {
      const aptSnap = await db.collection('appointments')
        .where('clientId', '==', c.id)
        .where('status', 'in', ['Confirmed', 'Pending'])
        .limit(1)
        .get();
      if (aptSnap.empty) filtered.push(c);
    }

    // ── Skip clients that already have a non-dismissed suggestion ────────────
    const fresh: typeof candidates = [];
    for (const c of filtered) {
      const existing = await db.collection('followup_suggestions').doc(c.id).get();
      if (!existing.exists || existing.data()?.status === 'dismissed' || existing.data()?.status === 'sent') {
        // Only regenerate if the existing one is sent/dismissed — pending should be left alone
        if (!existing.exists || existing.data()?.status !== 'pending-approval') {
          fresh.push(c);
        }
      }
    }

    const toProcess = fresh.slice(0, MAX_PER_RUN);
    logger.info(`[followUp] processing ${toProcess.length} (after appointment + dedupe filters)`);

    if (toProcess.length === 0) return;

    // ── Generate drafts ──────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    for (const { id, data } of toProcess) {
      try {
        const firstName = (data.name as string)?.split(' ')[0] ?? 'there';
        const reviewedAt = data.assessmentData?.reviewDate as string;
        const hoursStale = Math.round((Date.now() - new Date(reviewedAt).getTime()) / (60 * 60 * 1000));

        const clinicalFeedback = (data.assessmentData?.clinicalFeedback as string ?? '').slice(0, 500);
        const recommendedTreatments = (data.aiTriage?.recommendedTreatments as string[] ?? []).join(', ');

        const message = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 500,
          temperature: 0.4,
          system: buildSystemPrompt(),
          messages: [
            {
              role: 'user',
              content: `Patient: ${firstName}
Hours since their feedback was sent: ${hoursStale}
Recommended treatments: ${recommendedTreatments || 'not yet specified'}
Feedback we already sent them:
"${clinicalFeedback || '(no feedback content available)'}"

Generate a warm, low-pressure follow-up. Return JSON: { "subject": "...", "body": "..." }`,
            },
          ],
        });

        const textBlock = message.content.find(b => b.type === 'text');
        const raw = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
        const jsonStr = raw.startsWith('```') ? raw.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim() : raw;

        let parsed: { subject: string; body: string };
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          logger.warn(`[followUp] ${id} non-JSON response, using full text as body`);
          parsed = { subject: 'Following up on your assessment', body: raw };
        }

        const suggestion: FollowUpSuggestion = {
          clientId: id,
          clientName: data.name ?? 'Unknown',
          clientFirstName: firstName,
          reviewedAt,
          hoursStale,
          draftSubject: parsed.subject?.trim() || 'Following up on your assessment',
          draftBody: parsed.body?.trim() || '',
          status: 'pending-approval',
          generatedAt: new Date().toISOString(),
          model: MODEL,
          usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
        };

        await db.collection('followup_suggestions').doc(id).set(suggestion);
        logger.info(`[followUp] ${id} draft written (${message.usage.input_tokens}→${message.usage.output_tokens} tokens)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[followUp] ${id} failed`, { error: msg });
      }
    }
  },
);

function buildSystemPrompt(): string {
  return `You draft warm, low-pressure follow-up messages for the Novogencis hair restoration clinic. The patient completed an assessment, the doctor has already sent them clinical feedback, but they haven't booked a consultation yet.

Your job: nudge them gently to take the next step without sounding pushy or salesy.

Voice rules:
- Address by first name
- 80–140 words
- Acknowledge that hair loss is personal and they may need time
- Reference what was in their feedback (without quoting it verbatim — paraphrase)
- Soft CTA: invite them to reply with any questions, or book a consultation
- Never quote prices
- Never make outcome guarantees
- Sign off: "the Novogencis team"

Return ONLY a JSON object: { "subject": "Short subject line < 60 chars", "body": "The full message body." }

No markdown fences. No preamble.`;
}
