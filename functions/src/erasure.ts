import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

/**
 * When a user document gains an `erasedAt` field, hard-delete the
 * matching Firebase Auth user so they cannot sign in again. This is
 * the second half of the GDPR Art. 17 flow — the client-side erase
 * action pseudonymises the Firestore documents, and this function
 * completes the deletion at the auth layer.
 *
 * We also append an immutable system_logs entry so the action is
 * attributable even though it was completed by a trigger.
 */
export const onPatientErased = onDocumentUpdated('users/{userId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.erasedAt || !after.erasedAt) return;

  const userId = event.params.userId;
  try {
    await getAuth().deleteUser(userId);
    logger.info('Auth user deleted under GDPR Art. 17', { userId });
  } catch (err) {
    // If the auth user is already gone we still record the log entry below.
    logger.warn('deleteUser failed (may already be deleted)', { userId, err });
  }

  await getFirestore().collection('system_logs').add({
    adminId: 'system',
    actionType: 'auth_user_deleted',
    targetId: userId,
    details: 'Firebase Auth user removed following Firestore erasedAt write',
    timestamp: FieldValue.serverTimestamp(),
  });
});
