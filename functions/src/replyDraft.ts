/**
 * AI reply-draft callable function.
 *
 * Called from the admin reply composer. Returns a contextual draft based on
 * the message thread + patient summary. Uses Claude Haiku for speed/cost —
 * admins can edit before sending, so this isn't producing patient-final
 * content directly.
 *
 * Auth: admin only (checked via custom claim or Firestore role).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import Anthropic from '@anthropic-ai/sdk';
import { db } from './index.js';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const MODEL = 'claude-haiku-4-5';

interface ThreadMessage {
  senderId: string;
  body: string;
  createdAt: string;
}

interface DraftReplyData {
  clientId: string;
  threadMessages: ThreadMessage[];
}

export const draftReply = onCall(
  {
    region: 'europe-west2',
    secrets: [ANTHROPIC_API_KEY],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req) => {
    // ── Auth check ───────────────────────────────────────────────────────────
    if (!req.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const userDoc = await db.collection('users').doc(req.auth.uid).get();
    const isAdmin = req.auth.token.admin === true || userDoc.data()?.role === 'admin';
    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Admin only.');
    }

    // ── Input ────────────────────────────────────────────────────────────────
    const { clientId, threadMessages } = req.data as DraftReplyData;
    if (!clientId || !Array.isArray(threadMessages) || threadMessages.length === 0) {
      throw new HttpsError('invalid-argument', 'clientId and threadMessages required.');
    }

    // Cap thread length to avoid runaway prompts; latest 20 messages is plenty.
    const recentThread = threadMessages.slice(-20);

    // ── Patient context ──────────────────────────────────────────────────────
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      throw new HttpsError('not-found', 'Client not found.');
    }
    const client = clientDoc.data() ?? {};

    const patientSummary = {
      firstName: (client.name as string)?.split(' ')[0] ?? 'Patient',
      gender: client.gender,
      doctorPreference: client.doctorPreference,
      status: client.status,
      treatmentPlanSummary: client.treatmentPlan?.title,
      currentSuitability: client.assessmentData?.screening?.suitability,
      consultationConcerns: client.assessmentData?.consultation?.onset,
    };

    // ── Prompt ───────────────────────────────────────────────────────────────
    const systemPrompt = `You are drafting a reply from the Novogencis hair restoration clinic (Dr Aminah Amer's team) to a patient. The doctor will review and edit your draft before sending — so be helpful but not perfect.

Voice rules:
- Warm, professional, clear; no jargon overload
- Use the patient's first name
- Reply only to what they actually asked — don't introduce new topics
- Never make definitive promises ("you will see results")
- Never quote prices
- Never schedule appointments yourself — suggest they reply with a preferred time
- If clinical advice is needed, say "Dr Aminah will review this and respond personally"
- Keep replies to 2–4 sentences unless the question is complex
- End naturally — no formal sign-off, just a comma and "the Novogencis team"

Return ONLY the reply text — no preamble, no quotation marks, no markdown.`;

    const userPrompt = `Patient context:
${JSON.stringify(patientSummary, null, 2)}

Recent thread (oldest first):
${recentThread.map(m => `${m.senderId === 'admin' || m.senderId === clientId ? (m.senderId === 'admin' ? 'CLINIC' : 'PATIENT') : m.senderId}: ${m.body}`).join('\n')}

Draft a reply.`;

    // ── Call Claude ──────────────────────────────────────────────────────────
    try {
      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 400,
        temperature: 0.5,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = message.content.find((b) => b.type === 'text');
      const draft = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

      if (!draft) {
        throw new Error('Empty response from model');
      }

      logger.info(`[draftReply] ${clientId} → ${message.usage.input_tokens}→${message.usage.output_tokens} tokens`);

      return {
        draft,
        model: MODEL,
        usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[draftReply] ${clientId} failed`, { error: message });
      throw new HttpsError('internal', `AI draft failed: ${message}`);
    }
  },
);
