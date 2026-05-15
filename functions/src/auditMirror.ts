import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const TRACKED_COLLECTIONS = ['clients', 'appointments', 'messages'] as const;

/**
 * Server-side audit mirror.
 *
 * The client-side `logClinicalAction` calls can be skipped by a
 * compromised admin client. This trigger guarantees that every write
 * to the tracked collections is recorded in `system_logs` as a
 * server-attributed event, even when the original log call was missed.
 *
 * Firestore v2 triggers do not surface the originating auth uid, so
 * mirrored entries are attributed to "system"; pair them with the
 * client-side logs (which DO carry adminId) for full attribution.
 */
function makeHandler(collection: string) {
  return onDocumentWritten(`${collection}/{docId}`, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    let actionType: string;
    if (!before && after) actionType = `${collection}.create`;
    else if (before && !after) actionType = `${collection}.delete`;
    else actionType = `${collection}.update`;

    try {
      await getFirestore().collection('system_logs').add({
        adminId: 'system',
        actionType,
        targetId: event.params.docId,
        details: `Server-mirrored ${actionType}`,
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('Failed to mirror audit entry', { collection, docId: event.params.docId, err });
    }
  });
}

// Re-export as a single grouped function so Firebase deploys all three.
export const mirrorAuditLog = TRACKED_COLLECTIONS.reduce((acc, col) => {
  acc[col] = makeHandler(col);
  return acc;
}, {} as Record<string, ReturnType<typeof makeHandler>>);
