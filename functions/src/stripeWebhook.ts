/**
 * Stripe webhook endpoint.
 *
 * Stripe POSTs payment events here. We verify the signature with the webhook
 * secret, then act on the events we care about:
 *
 *   checkout.session.completed     → mark Payment Paid, advance appointment
 *   checkout.session.expired       → mark Payment Cancelled
 *   charge.refunded                → mark Payment Refunded
 *
 * Set up:
 *   1. After first deploy, get the function URL from `firebase functions:list`
 *   2. In Stripe Dashboard → Developers → Webhooks → Add endpoint
 *   3. Paste the URL, select the 3 events above
 *   4. Copy the signing secret → `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`
 *   5. Redeploy this function
 */

import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { FieldValue } from 'firebase-admin/firestore';
import type Stripe from 'stripe';
import { getStripe, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from './stripeClient.js';
import { db } from './index.js';

export const stripeWebhook = onRequest(
  {
    region: 'europe-west2',
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
    maxInstances: 5,
    timeoutSeconds: 30,
    memory: '256MiB',
    // Stripe needs the raw request body to verify the signature, so we let
    // onRequest hand us the rawBody (which it does by default for HTTP fns).
    invoker: 'public', // Stripe posts unauthenticated — signature is the auth
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const signature = req.header('stripe-signature');
    if (!signature) {
      logger.warn('[stripeWebhook] missing stripe-signature header');
      res.status(400).send('Missing signature');
      return;
    }

    const webhookSecret = STRIPE_WEBHOOK_SECRET.value();
    if (!webhookSecret) {
      logger.error('[stripeWebhook] STRIPE_WEBHOOK_SECRET not configured');
      res.status(500).send('Webhook secret not configured');
      return;
    }

    // ── Verify signature ─────────────────────────────────────────────────────
    let event: Stripe.Event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[stripeWebhook] signature verification failed: ${message}`);
      res.status(400).send(`Signature verification failed: ${message}`);
      return;
    }

    // ── Route event ──────────────────────────────────────────────────────────
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        }
        case 'checkout.session.expired': {
          await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
          break;
        }
        case 'charge.refunded': {
          await handleChargeRefunded(event.data.object as Stripe.Charge);
          break;
        }
        default:
          // No-op — we don't subscribe to other events but Stripe may still
          // send some; return 200 so it doesn't retry.
          logger.debug(`[stripeWebhook] ignoring event type: ${event.type}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[stripeWebhook] error handling ${event.type}: ${message}`);
      res.status(500).send(`Handler error: ${message}`);
      return;
    }

    res.status(200).send({ received: true });
  },
);

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const patientId = session.metadata?.patientId;
  if (!patientId) {
    logger.warn(`[stripeWebhook] checkout.session.completed has no patientId metadata: ${session.id}`);
    return;
  }

  const patientRef = db.collection('clients').doc(patientId);
  const snap = await patientRef.get();
  if (!snap.exists) {
    logger.warn(`[stripeWebhook] patient ${patientId} not found for session ${session.id}`);
    return;
  }

  // Find the Pending payment matching this session
  const data = snap.data()!;
  type PaymentLike = {
    id?: string;
    status: string;
    stripeCheckoutSessionId?: string;
    [key: string]: unknown;
  };
  const payments: PaymentLike[] = Array.isArray(data.payments) ? data.payments : [];
  const idx = payments.findIndex(p => p.stripeCheckoutSessionId === session.id);

  if (idx === -1) {
    logger.warn(`[stripeWebhook] no Payment record for session ${session.id} on patient ${patientId}`);
    return;
  }

  // Already settled? Idempotent — don't double-process.
  if (payments[idx].status === 'Paid') {
    logger.info(`[stripeWebhook] session ${session.id} already marked Paid — skipping`);
    return;
  }

  // Mark this payment Paid + update PaymentIntent for refunds later
  payments[idx] = {
    ...payments[idx],
    status: 'Paid',
    paidDate: new Date().toISOString(),
    stripePaymentIntentId:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
  };

  // If this was a deposit and the appointment was 'Awaiting deposit',
  // advance it to 'Confirmed' so the doctor sees it as locked in.
  const appointmentId = session.metadata?.appointmentId;
  const updates: Record<string, unknown> = { payments };
  if (appointmentId) {
    const aptRef = db.collection('appointments').doc(appointmentId);
    const aptSnap = await aptRef.get();
    if (aptSnap.exists && aptSnap.data()?.status === 'Awaiting deposit') {
      await aptRef.update({ status: 'Confirmed' });
      logger.info(`[stripeWebhook] advanced appointment ${appointmentId} to Confirmed`);
    }
  }

  await patientRef.update(updates);
  logger.info(`[stripeWebhook] marked payment Paid for session ${session.id} on patient ${patientId}`);

  // System log for the audit trail
  await db.collection('system_logs').add({
    type: 'payment_received',
    patientId,
    appointmentId: appointmentId ?? null,
    stripeSessionId: session.id,
    amount: session.amount_total ? session.amount_total / 100 : null,
    timestamp: FieldValue.serverTimestamp(),
    source: 'stripe_webhook',
  });
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  const patientId = session.metadata?.patientId;
  if (!patientId) return;
  const patientRef = db.collection('clients').doc(patientId);
  const snap = await patientRef.get();
  if (!snap.exists) return;
  type PaymentLike = { id?: string; status: string; stripeCheckoutSessionId?: string; [key: string]: unknown };
  const payments: PaymentLike[] = Array.isArray(snap.data()!.payments) ? snap.data()!.payments : [];
  const idx = payments.findIndex(p => p.stripeCheckoutSessionId === session.id);
  if (idx === -1 || payments[idx].status === 'Paid') return; // already paid? leave it
  payments[idx] = { ...payments[idx], status: 'Cancelled' };
  await patientRef.update({ payments });
  logger.info(`[stripeWebhook] expired session ${session.id} marked Cancelled`);
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  // We track payments by PaymentIntent. Find the patient + payment via the PI.
  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;

  // Query every client doc looking for a payment with this PaymentIntent.
  // Small clinic — acceptable. At scale we'd index this differently.
  const clientsSnap = await db.collection('clients').get();
  for (const clientDoc of clientsSnap.docs) {
    type PaymentLike = { id?: string; status: string; stripePaymentIntentId?: string; refundAmount?: number; [key: string]: unknown };
    const payments: PaymentLike[] = Array.isArray(clientDoc.data().payments) ? clientDoc.data().payments : [];
    const idx = payments.findIndex(p => p.stripePaymentIntentId === piId);
    if (idx === -1) continue;
    const refundedAmount = charge.amount_refunded / 100;
    payments[idx] = {
      ...payments[idx],
      status: 'Refunded',
      refundAmount: refundedAmount,
      refundedAt: new Date().toISOString(),
    };
    await clientDoc.ref.update({ payments });
    await db.collection('system_logs').add({
      type: 'payment_refunded',
      patientId: clientDoc.id,
      stripePaymentIntentId: piId,
      amount: refundedAmount,
      timestamp: FieldValue.serverTimestamp(),
      source: 'stripe_webhook',
    });
    logger.info(`[stripeWebhook] refund recorded for PI ${piId} on patient ${clientDoc.id}`);
    return;
  }
  logger.warn(`[stripeWebhook] no payment record for refunded PI ${piId}`);
}
