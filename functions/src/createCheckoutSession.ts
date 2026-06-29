/**
 * Stripe Checkout session creator.
 *
 * Admin-only HTTPS callable. Builds a Checkout session for a patient payment
 * (deposit, balance, or standalone), writes a Pending Payment record to the
 * Client.payments[] array, and returns the Checkout URL.
 *
 * The admin can either:
 *   • Paste the URL into a message to the patient (existing pattern)
 *   • Send the URL as an automatic payment-link message (handled by frontend)
 *
 * When the patient completes payment, the `stripeWebhook` function flips the
 * Payment status to 'Paid' and triggers downstream automations (consent form
 * email, booking confirmation).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { FieldValue } from 'firebase-admin/firestore';
import { getStripe, STRIPE_SECRET_KEY, CLINIC_CURRENCY } from './stripeClient.js';
import { db } from './index.js';

interface CreateCheckoutInput {
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

interface CreateCheckoutOutput {
  url: string;
  sessionId: string;
  paymentId: string;
  amountPence: number;
  description: string;
}

const PORTAL_BASE_URL = 'https://gen-lang-client-0344977334.web.app';

/** Allowed origins for Stripe redirect URLs — prevents open redirect attacks. */
const ALLOWED_REDIRECT_ORIGINS = [
  'https://gen-lang-client-0344977334.web.app',
  'https://novogenics.co.uk',
  'https://www.novogenics.co.uk',
];

function validateRedirectUrl(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    if (ALLOWED_REDIRECT_ORIGINS.includes(parsed.origin)) return url;
  } catch { /* invalid URL */ }
  logger.warn(`[createCheckoutSession] Rejected redirect URL: ${url}`);
  return fallback;
}

export const createCheckoutSession = onCall<CreateCheckoutInput, Promise<CreateCheckoutOutput>>(
  {
    region: 'europe-west2',
    secrets: [STRIPE_SECRET_KEY],
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req) => {
    // ── Auth: admin only (custom claims — no Firestore fallback) ───────────
    if (!req.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    if (req.auth.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Admin only.');
    }

    // ── Input validation ─────────────────────────────────────────────────────
    const { patientId, appointmentId, treatmentId, type, amountPence: amountOverride, description: descOverride, successUrl, cancelUrl } = req.data;
    if (!patientId) throw new HttpsError('invalid-argument', 'patientId required.');
    if (!['deposit', 'balance', 'standalone'].includes(type)) {
      throw new HttpsError('invalid-argument', "type must be 'deposit', 'balance', or 'standalone'.");
    }

    // ── Look up patient + (optional) treatment ───────────────────────────────
    const patientRef = db.collection('clients').doc(patientId);
    const patientSnap = await patientRef.get();
    if (!patientSnap.exists) throw new HttpsError('not-found', 'Patient not found.');
    const patient = patientSnap.data()!;

    let treatment: Record<string, unknown> | null = null;
    if (treatmentId) {
      const tSnap = await db.collection('treatments').doc(treatmentId).get();
      if (tSnap.exists) treatment = tSnap.data() ?? null;
    }

    // ── Resolve amount + description ─────────────────────────────────────────
    let amountPence = amountOverride;
    if (amountPence === undefined && treatment) {
      const full = Number(treatment.fullPricePence ?? 0);
      const depositPct = Number(treatment.depositPct ?? 0);
      if (type === 'deposit') amountPence = Math.round((full * depositPct) / 100);
      else if (type === 'balance') amountPence = full - Math.round((full * depositPct) / 100);
      else amountPence = full;
    }
    if (!amountPence || amountPence <= 0) {
      throw new HttpsError('invalid-argument', 'Could not resolve a positive payment amount.');
    }

    const description = descOverride
      ?? (treatment
        ? `${treatment.name} — ${type === 'deposit' ? 'Deposit' : type === 'balance' ? 'Balance' : 'Payment'}`
        : 'Novogencis treatment');

    // ── Create Stripe Checkout session ───────────────────────────────────────
    const stripe = getStripe();

    // Ensure a Stripe Customer for this patient — enables saving the card for
    // future balances + a unified payment history in the Stripe Dashboard.
    let stripeCustomerId: string | undefined =
      typeof patient.stripeCustomerId === 'string' ? patient.stripeCustomerId : undefined;
    if (!stripeCustomerId) {
      try {
        const customer = await stripe.customers.create({
          email: patient.email,
          name: patient.name,
          metadata: { patientId },
        });
        stripeCustomerId = customer.id;
        await patientRef.update({ stripeCustomerId });
      } catch (err) {
        // Non-fatal — fall back to an email-only guest checkout (no saved card).
        logger.warn(`[createCheckoutSession] customer create failed for ${patientId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        // Omit payment_method_types entirely so Checkout offers every method
        // enabled in the Stripe Dashboard — including Apple Pay / Google Pay.
        currency: CLINIC_CURRENCY,
        // Attach to the Customer when we have one (so the card can be saved);
        // otherwise a guest checkout keyed to their email.
        ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: patient.email }),
        line_items: [{
          quantity: 1,
          price_data: {
            currency: CLINIC_CURRENCY,
            unit_amount: amountPence,
            product_data: {
              name: description,
              description: `Patient: ${patient.name}`,
            },
          },
        }],
        success_url: validateRedirectUrl(successUrl, `${PORTAL_BASE_URL}/#client-dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`),
        cancel_url:  validateRedirectUrl(cancelUrl,  `${PORTAL_BASE_URL}/#client-dashboard?payment=cancelled`),
        // Save the card to the Customer for future off-session balance charges.
        ...(stripeCustomerId ? { payment_intent_data: { setup_future_usage: 'off_session' as const } } : {}),
        // Metadata is preserved on the session + payment intent — the webhook
        // uses this to reconcile back to our Firestore docs.
        metadata: {
          patientId,
          appointmentId: appointmentId ?? '',
          treatmentId: treatmentId ?? '',
          type,
          createdByAdminId: req.auth.uid,
        },
        // Expire abandoned checkouts after 24h so we don't accumulate cruft.
        expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[createCheckoutSession] Stripe error for patient ${patientId}: ${message}`);
      throw new HttpsError('internal', 'Payment processing failed. Please try again or contact the clinic.');
    }

    if (!session.url || !session.id) {
      throw new HttpsError('internal', 'Stripe did not return a checkout URL.');
    }

    // ── Write Pending Payment record to patient doc ──────────────────────────
    const paymentId = db.collection('clients').doc(patientId).collection('_ids').doc().id;
    const payment = {
      id: paymentId,
      description,
      amount: amountPence / 100,            // pounds for display compatibility
      amountPence,                          // pence for precise reconciliation
      currency: CLINIC_CURRENCY.toUpperCase(),
      status: 'Pending' as const,
      dueDate: new Date().toISOString(),
      reference: session.id,
      appointmentId,
      treatmentId,
      stripeCheckoutSessionId: session.id,
      type,
      createdAt: new Date().toISOString(),
    };
    await patientRef.update({
      payments: FieldValue.arrayUnion(payment),
    });

    logger.info(`[createCheckoutSession] Created session ${session.id} for patient ${patientId} (${amountPence}p ${type})`);

    return {
      url: session.url,
      sessionId: session.id,
      paymentId,
      amountPence,
      description,
    };
  },
);
