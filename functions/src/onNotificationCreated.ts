/**
 * Notification email fan-out — Cloud Function.
 *
 * TRIGGER: fires when a `notifications/{id}` document is created.
 *
 * The React app writes an in-app notification (via createNotification) for
 * every patient/clinic event. This function turns the *emailable* subset of
 * those notifications into a branded email (via emailService/MailerSend) — so delivery is
 * a pure server-side concern (no email keys shipped in the browser bundle).
 *
 * Only the types in EMAIL_POLICY generate an email (this matches the coverage
 * of the old client-side EmailJS path). Everything else stays in-app only.
 *
 * IDEMPOTENCY: onDocumentCreated fires once per create, and stamping the doc
 * with emailSentAt does not re-trigger it. Firestore triggers default to
 * RETRY_POLICY_DO_NOT_RETRY, so a send failure is captured in the `outbox`
 * collection (by sendEmail) rather than retried into a loop.
 *
 * SECRETS REQUIRED: MAILERSEND_API_KEY (see emailService.ts)
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './index.js';
import {
  sendEmail,
  buildEmailHtml,
  buildEmailText,
  MAILERSEND_API_KEY,
  FROM_NOREPLY,
  FROM_MESSAGES,
  maskEmail,
} from './emailService.js';

const DATABASE_ID = 'ai-studio-ffbd754d-87bd-4895-950f-a8738f36064a';
const PORTAL_BASE_URL = 'https://gen-lang-client-0344977334.web.app';

/** Clinic inbox for admin-bound notifications. Change here if it moves. */
const ADMIN_EMAIL = 'admin@novogenics.co.uk';

interface EmailPolicy {
  from: 'noreply' | 'messages';
  /**
   * If set, use this exact body instead of the notification's body. Used for
   * clinical types so no diagnosis/drug/plan detail lands in email — the
   * portal holds the specifics (GDPR data minimisation; matches old EmailJS).
   */
  bodyOverride?: string;
}

/**
 * Only these notification types generate an email. Everything else —
 * form_sent, appointment_reminder (already emailed server-side), daily_briefing,
 * profile_updated, reschedule_request, cancel_request — stays in-app only.
 */
const EMAIL_POLICY: Record<string, EmailPolicy> = {
  welcome: { from: 'noreply' },
  new_assessment: { from: 'noreply' },
  new_message: { from: 'messages' },
  feedback_received: { from: 'noreply' },
  appointment_confirmed: { from: 'noreply' },
  payment_received: { from: 'noreply' },
  form_signed: { from: 'noreply' },
  treatment_plan_ready: {
    from: 'noreply',
    bodyOverride: 'Your personalised treatment plan is ready in your Novogenics portal.',
  },
  prescription_added: {
    from: 'noreply',
    bodyOverride: 'Your clinician has updated your prescriptions in your Novogenics portal.',
  },
};

export const onNotificationCreated = onDocumentCreated(
  {
    document: 'notifications/{notificationId}',
    database: DATABASE_ID,
    region: 'europe-west2',
    secrets: [MAILERSEND_API_KEY],
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const notificationId = event.params.notificationId;
    const notif = event.data?.data();
    if (!notif) return;

    const policy = EMAIL_POLICY[String(notif.type)];
    if (!policy) {
      logger.info(`[onNotificationCreated][${notificationId}] type "${notif.type}" is in-app only — no email`);
      return;
    }

    const isAdmin = notif.recipientId === 'all-admins' || notif.recipientRole === 'admin';

    // ── Resolve recipient email ──────────────────────────────────────────────
    let toEmail: string;
    let toName: string | undefined;

    if (isAdmin) {
      toEmail = ADMIN_EMAIL;
      toName = 'Novogenics Team';
    } else {
      const clientSnap = await db.collection('clients').doc(notif.recipientId).get();
      toEmail = clientSnap.exists ? (clientSnap.data()!.email as string) : '';
      toName = clientSnap.exists ? (clientSnap.data()!.name as string | undefined) : undefined;
      if (!toEmail) {
        // Fall back to the users doc (auth record) if the client doc has no email.
        const userSnap = await db.collection('users').doc(notif.recipientId).get();
        toEmail = userSnap.exists ? (userSnap.data()!.email as string) : '';
        toName = toName ?? (userSnap.exists ? (userSnap.data()!.fullName as string | undefined) : undefined);
      }
      if (!toEmail) {
        logger.warn(`[onNotificationCreated][${notificationId}] no email for recipient ${notif.recipientId} — skipping`);
        return;
      }
    }

    // ── Compose ──────────────────────────────────────────────────────────────
    const heading = String(notif.title || 'Novogenics');
    const bodyText = policy.bodyOverride ?? String(notif.body || '');
    const ctaUrl = isAdmin ? `${PORTAL_BASE_URL}/#admin` : `${PORTAL_BASE_URL}/#client-dashboard`;
    const ctaLabel = isAdmin ? 'Open the admin dashboard' : 'Open your Novogenics portal';

    const html = buildEmailHtml({
      preheader: bodyText.slice(0, 120),
      heading,
      paragraphs: [bodyText],
      ctaLabel,
      ctaUrl,
    });
    const text = buildEmailText(heading, [bodyText, `${ctaLabel}: ${ctaUrl}`]);

    // ── Send ─────────────────────────────────────────────────────────────────
    try {
      await sendEmail({
        to: { email: toEmail, name: toName },
        from: policy.from === 'messages' ? FROM_MESSAGES : FROM_NOREPLY,
        subject: heading,
        html,
        text,
        metadata: { type: String(notif.type), notificationId },
      });
      await event.data!.ref.update({ emailSentAt: FieldValue.serverTimestamp() });
      logger.info(`[onNotificationCreated][${notificationId}] emailed "${notif.type}" → ${maskEmail(toEmail)}`);
    } catch (err) {
      // sendEmail already wrote the message to the `outbox` collection for
      // manual retry; swallow so DO_NOT_RETRY doesn't drop into an error loop.
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[onNotificationCreated][${notificationId}] email failed (queued to outbox): ${msg}`);
    }
  },
);
