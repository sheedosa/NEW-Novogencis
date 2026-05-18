/**
 * Novogencis Cloud Functions — entry point
 *
 * Functions deployed from this module:
 *   - onAssessmentSubmitted: Firestore trigger that runs AI triage on new
 *     assessments using Claude Sonnet 4.6.
 *
 * Secrets used (set via `firebase functions:secrets:set NAME`):
 *   - ANTHROPIC_API_KEY
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

// Use the named Firestore database (matches the rest of the platform).
const DATABASE_ID = 'ai-studio-ffbd754d-87bd-4895-950f-a8738f36064a';
export const db = getFirestore(DATABASE_ID);

export { onAssessmentSubmitted } from './triage.js';
export { draftReply } from './replyDraft.js';
export { dailyBriefing } from './dailyBriefing.js';
export { generateFollowUpSuggestions } from './followUp.js';
