/**
 * Novogencis Cloud Functions — entry point
 *
 * Functions deployed from this module:
 *   - onAssessmentSubmitted    Firestore trigger, AI triage (Sonnet 4.6)
 *   - draftReply               HTTPS callable, AI reply drafts (Haiku 4.5)
 *   - dailyBriefing            Scheduled, AI morning briefing (Haiku 4.5)
 *   - generateFollowUpSuggestions  Scheduled, AI follow-ups (Sonnet 4.6)
 *   - createCheckoutSession    HTTPS callable, Stripe Checkout session
 *   - stripeWebhook            HTTPS endpoint, Stripe event reconciliation
 *   - createRefund             HTTPS callable, admin-initiated refunds
 *
 * Secrets used (set via `firebase functions:secrets:set NAME`):
 *   - ANTHROPIC_API_KEY       (AI functions)
 *   - STRIPE_SECRET_KEY       (Stripe checkout + refunds)
 *   - STRIPE_WEBHOOK_SECRET   (signature verification on webhook)
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

// Use the named Firestore database (matches the rest of the platform).
const DATABASE_ID = 'ai-studio-ffbd754d-87bd-4895-950f-a8738f36064a';
export const db = getFirestore(DATABASE_ID);

// AI features
export { onAssessmentSubmitted } from './triage.js';
export { draftReply } from './replyDraft.js';
export { dailyBriefing } from './dailyBriefing.js';
export { generateFollowUpSuggestions } from './followUp.js';

// Stripe — only deploy after secrets are set (will fail otherwise)
export { createCheckoutSession } from './createCheckoutSession.js';
export { stripeWebhook } from './stripeWebhook.js';
export { createRefund } from './createRefund.js';
