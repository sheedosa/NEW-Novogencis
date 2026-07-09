/**
 * Notification email fan-out — Cloud Function.
 *
 * TRIGGER: fires when a `notifications/{id}` document is created.
 *
 * The React app writes an in-app notification (via createNotification) for
 * every patient/clinic event. This function turns the *emailable* subset of
 * those notifications into a branded email (via emailService/Resend) — so delivery is
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
 * SECRETS REQUIRED: RESEND_API_KEY (see emailService.ts)
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './index.js';
import {
  sendEmail,
  buildEmailHtml,
  buildEmailText,
  RESEND_API_KEY,
  FROM_NOREPLY,
  FROM_MESSAGES,
  CLINIC_RECIPIENTS,
  maskEmail,
} from './emailService.js';

const DATABASE_ID = 'ai-studio-ffbd754d-87bd-4895-950f-a8738f36064a';
const PORTAL_BASE_URL = 'https://gen-lang-client-0344977334.web.app';

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
 * Only these notification types generate an email. Everything else stays
 * in-app only — deliberately including `new_message` (a back-and-forth chat
 * would flood inboxes) and `form_signed` (the clinic already sees it in-app),
 * plus form_sent, appointment_reminder (its own server-side email),
 * daily_briefing, profile_updated, reschedule_request, cancel_request.
 */
const EMAIL_POLICY: Record<string, EmailPolicy> = {
  welcome: { from: 'noreply' },
  new_assessment: { from: 'noreply' },
  feedback_received: { from: 'noreply' },
  appointment_confirmed: { from: 'noreply' },
  payment_received: { from: 'noreply' },
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
    secrets: [RESEND_API_KEY],
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

    // ── Resolve recipients ────────────────────────────────────────────────────
    // Clinic/admin notifications go to each doctor's personal inbox; patient
    // notifications go to the patient. Each recipient gets a personalised copy.
    let recipients: { email: string; name: string; greeting: string }[];
    if (isAdmin) {
      recipients = CLINIC_RECIPIENTS;
    } else {
      const clientSnap = await db.collection('clients').doc(notif.recipientId).get();
      let email = clientSnap.exists ? (clientSnap.data()!.email as string) : '';
      let name = clientSnap.exists ? (clientSnap.data()!.name as string | undefined) : undefined;
      if (!email) {
        // Fall back to the users doc (auth record) if the client doc has no email.
        const userSnap = await db.collection('users').doc(notif.recipientId).get();
        email = userSnap.exists ? (userSnap.data()!.email as string) : '';
        name = name ?? (userSnap.exists ? (userSnap.data()!.fullName as string | undefined) : undefined);
      }
      if (!email) {
        logger.warn(`[onNotificationCreated][${notificationId}] no email for recipient ${notif.recipientId} — skipping`);
        return;
      }
      recipients = [{ email, name: name || '', greeting: name ? name.split(' ')[0] : '' }];
    }

    // ── Compose (shared) ──────────────────────────────────────────────────────
    const heading = String(notif.title || 'Novogenics');
    const bodyText = policy.bodyOverride ?? String(notif.body || '');
    const ctaUrl = isAdmin ? `${PORTAL_BASE_URL}/#admin` : `${PORTAL_BASE_URL}/#client-dashboard`;
    const ctaLabel = isAdmin ? 'Open the admin dashboard' : 'Open your Novogenics portal';
    const fromAddr = policy.from === 'messages' ? FROM_MESSAGES : FROM_NOREPLY;

    // ── Send a personalised copy to each recipient ────────────────────────────
    let anySent = false;
    for (const r of recipients) {
      const paragraphs = r.greeting ? [`Hi ${r.greeting},`, bodyText] : [bodyText];
      try {
        await sendEmail({
          to: { email: r.email, name: r.name },
          from: fromAddr,
          subject: heading,
          html: buildEmailHtml({ preheader: bodyText.slice(0, 120), heading, paragraphs, ctaLabel, ctaUrl }),
          text: buildEmailText(heading, [...paragraphs, `${ctaLabel}: ${ctaUrl}`]),
          metadata: { type: String(notif.type), notificationId },
        });
        anySent = true;
        logger.info(`[onNotificationCreated][${notificationId}] emailed "${notif.type}" → ${maskEmail(r.email)}`);
      } catch (err) {
        // sendEmail already wrote to the outbox; swallow so DO_NOT_RETRY doesn't loop.
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[onNotificationCreated][${notificationId}] email to ${maskEmail(r.email)} failed (queued to outbox): ${msg}`);
      }
    }
    if (anySent) {
      await event.data!.ref.update({ emailSentAt: FieldValue.serverTimestamp() });
    }
  },
);
