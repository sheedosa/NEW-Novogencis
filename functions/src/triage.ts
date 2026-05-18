/**
 * Assessment triage Cloud Function.
 *
 * Triggers when a client document is created or updated in Firestore. If the
 * client has a fresh `assessmentData.answers` payload AND no prior `aiTriage`,
 * we call Claude Sonnet 4.6 to produce a structured triage object and write
 * it back to the same document.
 *
 * The function is idempotent: re-running on the same document won't re-trigger
 * the AI unless `aiTriage` is missing or explicitly cleared.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import Anthropic from '@anthropic-ai/sdk';
import { db } from './index.js';
import { buildTriagePrompt } from './prompt.js';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// ── Output shape that gets written back to Firestore ─────────────────────────

export interface AITriage {
  generatedAt: string;
  model: string;
  promptVersion: string;
  impression: string;
  redFlags: string[];
  suitability: 'strong-candidate' | 'suitable-with-caveats' | 'not-suitable';
  suitabilityReason: string;
  recommendedTreatments: string[];
  draftFeedback: string;
  status: 'pending-review' | 'doctor-approved' | 'sent';
  /** Token usage for cost tracking */
  usage: { input: number; output: number };
}

const PROMPT_VERSION = '2026-05-17-v1';
const MODEL = 'claude-sonnet-4-6';

// ── Trigger ──────────────────────────────────────────────────────────────────

export const onAssessmentSubmitted = onDocumentWritten(
  {
    document: 'clients/{clientId}',
    database: 'ai-studio-ffbd754d-87bd-4895-950f-a8738f36064a',
    region: 'europe-west2',
    secrets: [ANTHROPIC_API_KEY],
    // Cap concurrent invocations so a sudden burst can't run away with costs.
    maxInstances: 5,
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const clientId = event.params.clientId;

    if (!after) {
      logger.info(`[${clientId}] document deleted — skipping`);
      return;
    }

    // Skip unless this update is the first time assessment answers appear,
    // or the answers changed materially. Compare answer-blob hashes.
    const newAnswers = after?.assessmentData?.answers;
    const oldAnswers = before?.assessmentData?.answers;

    if (!newAnswers || Object.keys(newAnswers).length === 0) {
      logger.info(`[${clientId}] no assessment answers — skipping`);
      return;
    }

    // Idempotency: if we already have an aiTriage for the same answer set, skip.
    const existingTriage = after.aiTriage as AITriage | undefined;
    const answersUnchanged = JSON.stringify(newAnswers) === JSON.stringify(oldAnswers);
    if (existingTriage && answersUnchanged) {
      logger.info(`[${clientId}] aiTriage already exists for unchanged answers — skipping`);
      return;
    }

    logger.info(`[${clientId}] running AI triage`);

    // ── Call Claude ──────────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    const promptPayload = {
      name: after.name ?? 'Unknown',
      gender: after.gender ?? 'unknown',
      dob: after.dob ?? null,
      phone: after.phone ?? null,
      doctorPreference: after.doctorPreference ?? null,
      answers: newAnswers,
      consultation: after.assessmentData?.consultation ?? {},
      screening: after.assessmentData?.screening ?? {},
    };

    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        temperature: 0.3,
        system: buildTriagePrompt(),
        messages: [
          {
            role: 'user',
            content: `Triage this new patient assessment and return ONLY the JSON object specified in the system prompt. No prose before or after.\n\nPATIENT DATA:\n${JSON.stringify(promptPayload, null, 2)}`,
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from Claude');
      }

      // Claude may wrap the JSON in markdown — strip if present.
      const raw = textBlock.text.trim();
      const jsonStr = raw.startsWith('```')
        ? raw.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim()
        : raw;

      let parsed: Omit<AITriage, 'generatedAt' | 'model' | 'promptVersion' | 'status' | 'usage'>;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr) {
        logger.error(`[${clientId}] failed to parse Claude response as JSON`, { raw });
        throw parseErr;
      }

      // Defensive validation — fall back to safe defaults if a field is missing.
      const triage: AITriage = {
        generatedAt: new Date().toISOString(),
        model: MODEL,
        promptVersion: PROMPT_VERSION,
        impression: String(parsed.impression ?? '').trim(),
        redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.map(String) : [],
        suitability: ['strong-candidate', 'suitable-with-caveats', 'not-suitable'].includes(parsed.suitability)
          ? parsed.suitability
          : 'suitable-with-caveats',
        suitabilityReason: String(parsed.suitabilityReason ?? '').trim(),
        recommendedTreatments: Array.isArray(parsed.recommendedTreatments)
          ? parsed.recommendedTreatments.map(String)
          : [],
        draftFeedback: String(parsed.draftFeedback ?? '').trim(),
        status: 'pending-review',
        usage: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
        },
      };

      await db.collection('clients').doc(clientId).set({ aiTriage: triage }, { merge: true });

      logger.info(`[${clientId}] AI triage complete`, {
        suitability: triage.suitability,
        redFlagCount: triage.redFlags.length,
        inputTokens: triage.usage.input,
        outputTokens: triage.usage.output,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[${clientId}] AI triage failed`, { error: message });

      // Write a failure marker so the admin UI can show a "retry" button instead
      // of leaving the doctor wondering why nothing appeared.
      await db.collection('clients').doc(clientId).set(
        {
          aiTriage: {
            generatedAt: new Date().toISOString(),
            model: MODEL,
            promptVersion: PROMPT_VERSION,
            impression: '',
            redFlags: [],
            suitability: 'suitable-with-caveats',
            suitabilityReason: 'AI triage failed — please review manually.',
            recommendedTreatments: [],
            draftFeedback: '',
            status: 'pending-review',
            usage: { input: 0, output: 0 },
            error: message,
          },
        },
        { merge: true },
      );
    }
  },
);
