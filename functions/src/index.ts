/**
 * Novogenics Cloud Functions entry point.
 *
 * Functions are split into focused modules and re-exported here so that
 * Firebase can pick them up. Region is pinned to europe-west2 (London)
 * because patient data is stored in the UK/EEA region.
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';

initializeApp();
setGlobalOptions({ region: 'europe-west2', maxInstances: 10 });

export { onPatientErased } from './erasure';
export { cleanIntakeUploads } from './storageJanitor';
export { mirrorAuditLog } from './auditMirror';
export { createStripeCheckoutSession } from './stripeCheckout';
