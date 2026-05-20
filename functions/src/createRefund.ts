/**
 * Admin-initiated Stripe refund.
 *
 * Calls Stripe's refunds API. The actual Firestore Payment status flip happens
 * in the `charge.refunded` webhook handler — Stripe is the source of truth.
 *
 * Cancellation policy (mirrored in your patient-facing reminder email):
 *   PRP     — 48h+: full refund | <48h: non-refundable, reschedule x2
 *   Exosome — 48h+: 65% refund  | <48h: non-refundable, reschedule x2
 *   Consult — 48h+: full refund of deposit
 *
 * This function does NOT enforce that policy automatically — the admin
 * chooses the amount. We log the reason for the audit trail.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { FieldValue } from 'firebase-admin/firestore';
import { getStripe, STRIPE_SECRET_KEY } from './stripeClient.js';
import { db } from './index.js';

interface CreateRefundInput {
  patientId: string;
  /** The Payment.id inside Client.payments[] */
  paymentId: string;
  /** Pence to refund. If omitted, full refund. */
  amountPence?: number;
  /** Free-text reason — stored in audit log + Stripe metadata */
  reason?: string;
}

interface CreateRefundOutput {
  refundId: string;
  amountPence: number;
  status: string;
}

export const createRefund = onCall<CreateRefundInput, Promise<CreateRefundOutput>>(
  {
    region: 'europe-west2',
    secrets: [STRIPE_SECRET_KEY],
    maxInstances: 5,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req) => {
    // ── Auth: admin only ─────────────────────────────────────────────────────
    if (!req.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const userDoc = await db.collection('users').doc(req.auth.uid).get();
    const isAdmin = req.auth.token.admin === true || userDoc.data()?.role === 'admin';
    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Admin only.');
    }

    const { patientId, paymentId, amountPence, reason } = req.data;
    if (!patientId || !paymentId) {
      throw new HttpsError('invalid-argument', 'patientId and paymentId required.');
    }

    // ── Locate the payment ──────────────────────────────────────────────────
    const patientRef = db.collection('clients').doc(patientId);
    const patientSnap = await patientRef.get();
    if (!patientSnap.exists) throw new HttpsError('not-found', 'Patient not found.');

    type PaymentLike = {
      id?: string;
      status: string;
      amount?: number;
      amountPence?: number;
      stripePaymentIntentId?: string;
      [key: string]: unknown;
    };
    const payments: PaymentLike[] = Array.isArray(patientSnap.data()!.payments)
      ? patientSnap.data()!.payments
      : [];
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) throw new HttpsError('not-found', 'Payment not found on patient.');
    if (payment.status !== 'Paid') {
      throw new HttpsError('failed-precondition', `Cannot refund payment with status: ${payment.status}.`);
    }
    if (!payment.stripePaymentIntentId) {
      throw new HttpsError('failed-precondition', 'Payment has no Stripe PaymentIntent — was it taken outside Stripe?');
    }

    // Resolve refund amount — default to full
    const fullAmountPence = payment.amountPence ?? Math.round((payment.amount ?? 0) * 100);
    const refundPence = amountPence ?? fullAmountPence;
    if (refundPence <= 0 || refundPence > fullAmountPence) {
      throw new HttpsError('invalid-argument', `Refund amount must be between 1 and ${fullAmountPence} pence.`);
    }

    // ── Create refund via Stripe ────────────────────────────────────────────
    const stripe = getStripe();
    let refund;
    try {
      refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: refundPence,
        metadata: {
          patientId,
          paymentId,
          reason: reason ?? 'admin_initiated',
          adminId: req.auth.uid,
        },
        reason: 'requested_by_customer',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[createRefund] Stripe error for payment ${paymentId}: ${message}`);
      throw new HttpsError('internal', `Stripe refund failed: ${message}`);
    }

    logger.info(
      `[createRefund] refund ${refund.id} created for payment ${paymentId} ` +
      `(${refundPence}p) — webhook will update Firestore`,
    );

    // Audit log immediately — the webhook will also log when Stripe confirms,
    // but recording the request gives us a complete trail if the webhook is
    // slow or fails.
    await db.collection('system_logs').add({
      type: 'refund_requested',
      patientId,
      paymentId,
      adminId: req.auth.uid,
      amount: refundPence / 100,
      reason: reason ?? null,
      stripeRefundId: refund.id,
      timestamp: FieldValue.serverTimestamp(),
    });

    return {
      refundId: refund.id,
      amountPence: refundPence,
      status: refund.status ?? 'pending',
    };
  },
);
