/**
 * Shared Stripe SDK initialiser.
 *
 * Functions that need Stripe import `getStripe()` rather than instantiating
 * directly so we only need one place to bump the API version + secret name.
 *
 * Secrets used:
 *   STRIPE_SECRET_KEY      — sk_live_… or sk_test_…
 *   STRIPE_WEBHOOK_SECRET  — whsec_…  (only used by stripeWebhook function)
 *
 * The secrets must exist in Google Secret Manager before any function that
 * declares them in its `secrets: [...]` config can deploy. Set them with:
 *   firebase functions:secrets:set STRIPE_SECRET_KEY
 *   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 */

import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';

export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

let cachedStripe: Stripe | null = null;
let cachedKey: string | null = null;

/**
 * Returns a Stripe client using the secret loaded at invocation time.
 * Cached per-instance so we don't re-init on every call within the same
 * function execution.
 */
export function getStripe(): Stripe {
  const key = STRIPE_SECRET_KEY.value();
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  if (cachedStripe && cachedKey === key) return cachedStripe;
  cachedStripe = new Stripe(key, {
    // Pinned API version — bump intentionally when migrating, never auto.
    apiVersion: '2025-02-24.acacia',
    typescript: true,
    // Brand the API requests so they're identifiable in Stripe Dashboard.
    appInfo: {
      name: 'Novogencis Clinical Platform',
      version: '1.0.0',
      url: 'https://novogenics.co.uk',
    },
  });
  cachedKey = key;
  return cachedStripe;
}

/**
 * Currency the clinic operates in. Stripe wants lowercase ISO 4217.
 */
export const CLINIC_CURRENCY = 'gbp';
