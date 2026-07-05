import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import firebaseConfig from './firebase-applet-config.json';

// Reuse the existing app on HMR reloads — Firebase throws if initializeApp is
// called twice with the same options, and the named-DB Firestore won't re-init.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialise Firestore with persistent multi-tab cache on first load; on HMR
// the second call would throw, so fall back to getFirestore() which returns
// the already-initialised instance.
function initDb(): Firestore {
  try {
    return initializeFirestore(
      app,
      { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
      firebaseConfig.firestoreDatabaseId,
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = initDb();
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'europe-west2');

// ── Cloud Functions: Stripe Checkout ───────────────────────────────────────
// Mirrors the interfaces in functions/src/createCheckoutSession.ts so the
// frontend can call the deployed callable with full typing.
export interface CreateCheckoutInput {
  patientId: string;
  appointmentId?: string;
  treatmentId?: string;
  /** 'deposit' | 'balance' | 'standalone' — drives description + Payment.type */
  type: 'deposit' | 'balance' | 'standalone';
  /** Amount in pence. If omitted, derived from treatment + type. */
  amountPence?: number;
  /** Free-text label shown on Stripe Checkout (overrides treatment name) */
  description?: string;
  /** Optional success/cancel URLs (defaults to portal) */
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreateCheckoutOutput {
  url: string;
  sessionId: string;
  paymentId: string;
  amountPence: number;
  description: string;
}

/** Calls the deployed `createCheckoutSession` callable (admin-only, europe-west2). */
export async function requestCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutOutput> {
  const fn = httpsCallable<CreateCheckoutInput, CreateCheckoutOutput>(functions, 'createCheckoutSession');
  const res = await fn(input);
  return res.data;
}

// ── Cloud Functions: website contact form ──────────────────────────────────
export interface ContactFormInput {
  name: string;
  email: string;
  method?: string;
  message: string;
  /** Honeypot — must be empty. */
  company?: string;
}

/**
 * Calls the public `submitContactForm` callable (no auth). Emails the enquiry
 * to the clinic via the server-side MailerLite pipeline. Throws on failure so
 * the contact page can show its phone/email fallback.
 */
export async function submitContactForm(input: ContactFormInput): Promise<{ ok: boolean }> {
  const fn = httpsCallable<ContactFormInput, { ok: boolean }>(functions, 'submitContactForm');
  const res = await fn(input);
  return res.data;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Log only what's needed for debugging — never PII, never auth tokens, never email addresses.
  // Sanitised info is safe to send to monitoring services (Sentry, etc).
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code;
  console.error(`[Firestore] ${operationType.toUpperCase()} ${path ?? '<unknown>'} — ${code ?? 'error'}: ${message}`);
  // Re-throw a clean error so callers can decide how to surface it to the user.
  // The original error message is preserved without the PII payload.
  const cleanError = new Error(message);
  (cleanError as Error & { code?: string; operationType: OperationType; path: string | null }).code = code;
  (cleanError as Error & { code?: string; operationType: OperationType; path: string | null }).operationType = operationType;
  (cleanError as Error & { code?: string; operationType: OperationType; path: string | null }).path = path;
  throw cleanError;
}

/**
 * Strips undefined values from an object recursively.
 * Firestore does not allow undefined values.
 */
export function cleanData<T>(data: T): T {
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(cleanData) as unknown as T;
  
  const cleaned: Record<string, unknown> = {};
  const obj = data as Record<string, unknown>;
  
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      cleaned[key] = cleanData(obj[key]);
    }
  });
  return cleaned as T;
}

