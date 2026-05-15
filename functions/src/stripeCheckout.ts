import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

interface CreateSessionRequest {
  clientId: string;
  amountPennies: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Creates a Stripe Checkout Session server-side. Only callable by
 * authenticated admins. The amount is signed by Stripe so a malicious
 * client cannot tamper with it after the link is sent.
 *
 * Replaces the static buy.stripe.com link we used to embed in payment
 * messages. The portal calls this function, receives a one-time
 * session URL, and embeds that URL in the patient-facing message.
 */
export const createStripeCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET_KEY], cors: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign-in required.');
    }

    const userDoc = await getFirestore().doc(`users/${request.auth.uid}`).get();
    if (userDoc.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin role required.');
    }

    const { clientId, amountPennies, description, successUrl, cancelUrl } =
      request.data as CreateSessionRequest;

    if (!clientId || !Number.isInteger(amountPennies) || amountPennies <= 0) {
      throw new HttpsError('invalid-argument', 'clientId and a positive integer amountPennies are required.');
    }
    if (amountPennies > 1_000_000) {
      // Hard cap at £10,000 to limit damage from a compromised admin session.
      throw new HttpsError('invalid-argument', 'Amount exceeds maximum permitted.');
    }

    const clientSnap = await getFirestore().doc(`clients/${clientId}`).get();
    if (!clientSnap.exists) {
      throw new HttpsError('not-found', 'Patient record not found.');
    }
    const patientEmail = clientSnap.get('email') as string | undefined;

    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'gbp',
      customer_email: patientEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: amountPennies,
            product_data: { name: description || 'Clinic treatment' },
          },
        },
      ],
      metadata: {
        clientId,
        createdBy: request.auth.uid,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return { url: session.url, sessionId: session.id };
  },
);
