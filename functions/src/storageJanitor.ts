import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions/v2';

const TEMP_PREFIX = 'temp/';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Sweeps the temporary intake upload area every day at 02:00 Europe/London
 * and deletes any object older than 24 hours. The public assessment flow
 * uploads photos to C-* folders before the patient creates an account;
 * if they abandon, those files would otherwise accumulate indefinitely.
 *
 * Storage rules already restrict where these files can land — see
 * storage.rules — so this function only deals with the C-* temp area.
 */
export const cleanIntakeUploads = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'Europe/London',
    timeoutSeconds: 540,
  },
  async () => {
    const bucket = getStorage().bucket();
    const cutoff = Date.now() - MAX_AGE_MS;
    const [files] = await bucket.getFiles({ prefix: TEMP_PREFIX });

    let deleted = 0;
    let scanned = 0;
    for (const file of files) {
      scanned += 1;
      const created = new Date(file.metadata.timeCreated || 0).getTime();
      if (created < cutoff) {
        try {
          await file.delete();
          deleted += 1;
        } catch (err) {
          logger.warn('Failed to delete temp file', { name: file.name, err });
        }
      }
    }
    logger.info('Intake upload janitor finished', { scanned, deleted });
  },
);
