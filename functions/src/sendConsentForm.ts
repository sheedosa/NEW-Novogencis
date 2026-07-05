/**
 * Consent form automation — Cloud Function.
 *
 * TRIGGER: Fires whenever an Appointment document is created or updated.
 *
 * LOGIC:
 *   1. Check that status just changed to 'Confirmed' (or is newly Confirmed).
 *   2. Load the patient's Client document.
 *   3. If the patient has EVER received a consent form (client.consentSent),
 *      skip — consent is a once-per-lifetime send.
 *   4. Generate the informed-consent PDF via pdfGenerator.
 *   5. Send it to the patient's email with the branded HTML template.
 *   6. Stamp client.consentSent = true + consentSentAt timestamp.
 *   7. Stamp appointment.consentTriggered = true for audit trail.
 *
 * IDEMPOTENCY GUARDS:
 *   • client.consentSent  — persistent flag; never re-sends to existing patients.
 *   • appointment.consentTriggered — prevents a second send if this specific
 *     appointment doc is updated again after we stamp it.
 *
 * SECRETS REQUIRED:
 *   MAILERSEND_API_KEY (see emailService.ts)
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './index.js';
import {
  sendEmail,
  buildEmailHtml,
  buildEmailText,
  MAILERSEND_API_KEY,
  FROM_NOREPLY,
  maskEmail,
} from './emailService.js';
import { buildConsentPdf, DEFAULT_CLINIC } from './pdfGenerator.js';

// ── Trigger ──────────────────────────────────────────────────────────────────

export const sendConsentForm = onDocumentWritten(
  {
    document: 'appointments/{appointmentId}',
    database: 'ai-studio-ffbd754d-87bd-4895-950f-a8738f36064a',
    region: 'europe-west2',
    secrets: [MAILERSEND_API_KEY],
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    const appointmentId = event.params.appointmentId;

    // ── Guard: document must exist ───────────────────────────────────────────
    if (!after) {
      logger.info(`[sendConsentForm][${appointmentId}] deleted — skipping`);
      return;
    }

    const newStatus = after.status as string | undefined;
    const oldStatus = before?.status as string | undefined;

    // ── Guard: only act when status becomes 'Confirmed' ──────────────────────
    // Allow both newly created Confirmed docs and updates that set to Confirmed.
    const justConfirmed =
      newStatus === 'Confirmed' && oldStatus !== 'Confirmed';
    const newlyCreatedConfirmed =
      newStatus === 'Confirmed' && !before;

    if (!justConfirmed && !newlyCreatedConfirmed) {
      logger.info(
        `[sendConsentForm][${appointmentId}] status is "${newStatus}" — no action needed`,
      );
      return;
    }

    // ── Guard: prevent double-send if this appointment already triggered ─────
    if (after.consentTriggered === true) {
      logger.info(
        `[sendConsentForm][${appointmentId}] consentTriggered already set — skipping`,
      );
      return;
    }

    const clientId = after.clientId as string | undefined;
    if (!clientId) {
      logger.error(`[sendConsentForm][${appointmentId}] missing clientId`);
      return;
    }

    // ── Load patient ─────────────────────────────────────────────────────────
    const clientRef = db.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) {
      logger.error(
        `[sendConsentForm][${appointmentId}] client ${clientId} not found`,
      );
      return;
    }

    const client = clientSnap.data()!;

    // ── Guard: once-per-lifetime consent send ────────────────────────────────
    if (client.consentSent === true) {
      logger.info(
        `[sendConsentForm][${appointmentId}] client ${clientId} already has consent sent — skipping`,
      );
      // Still stamp consentTriggered on the appointment so we don't recheck.
      await db.collection('appointments').doc(appointmentId).update({
        consentTriggered: true,
      });
      return;
    }

    const patientEmail = client.email as string | undefined;
    if (!patientEmail) {
      logger.error(
        `[sendConsentForm][${appointmentId}] client ${clientId} has no email`,
      );
      return;
    }

    logger.info(
      `[sendConsentForm][${appointmentId}] sending consent form to ${maskEmail(patientEmail)}`,
    );

    // ── Build PDF ────────────────────────────────────────────────────────────
    const pdfBytes = await buildConsentPdf(
      {
        name: client.name ?? 'Patient',
        dob: client.dob,
        email: patientEmail,
      },
      {
        type: after.type ?? 'Treatment',
        date: after.date ?? '',
        time: after.time ?? '',
        doctorName: after.doctorName,
      },
      DEFAULT_CLINIC,
    );

    // ── Build email ──────────────────────────────────────────────────────────
    const firstName = (client.name as string ?? 'there').split(' ')[0];
    const apptDate = after.date ?? 'your upcoming appointment';

    const html = buildEmailHtml({
      preheader: 'Your informed consent form is attached — please review before your visit.',
      heading: 'Your informed consent form',
      paragraphs: [
        `Hi ${firstName},`,
        `Thank you for booking with Novogenics. Before your visit on <strong>${apptDate}</strong>, ` +
        `we need you to review and sign your informed consent form.`,
        `Your form is attached to this email as a PDF. Please read it carefully — it covers ` +
        `the nature of your treatment, the expected benefits, risks, and alternatives.`,
        `You will be asked to sign the form when you arrive at the clinic. If you have any ` +
        `questions beforehand, please message us on WhatsApp or reply to this email.`,
        `We look forward to seeing you soon.`,
      ],
      footerNote: 'This email contains your clinical consent form. Please keep it for your records. ',
    });

    const text = buildEmailText('Your informed consent form', [
      `Hi ${firstName},`,
      `Thank you for booking with Novogenics. Before your visit on ${apptDate}, please review your informed consent form attached to this email.`,
      `It covers the nature of your treatment, the expected benefits, risks, and alternatives. You will be asked to sign it when you arrive.`,
      `If you have any questions, please message us on WhatsApp or reply to this email.`,
    ]);

    // ── Send email ───────────────────────────────────────────────────────────
    try {
      await sendEmail({
        to: { email: patientEmail, name: client.name },
        from: FROM_NOREPLY,
        subject: `Your consent form — Novogenics appointment ${apptDate}`,
        html,
        text,
        attachments: [
          {
            filename: `novogenics-consent-${apptDate}.pdf`,
            content: pdfBytes,
            contentType: 'application/pdf',
          },
        ],
        metadata: {
          type: 'consent',
          patientId: clientId,
          appointmentId,
        },
      });
    } catch {
      // sendEmail already wrote to outbox — log and bail without marking flags
      // so a manual retry can attempt again.
      logger.error(
        `[sendConsentForm][${appointmentId}] email failed — left in outbox for review`,
      );
      return;
    }

    // ── Stamp flags — only after successful send ─────────────────────────────
    await Promise.all([
      // Client-level: prevents any future appointment from re-sending consent.
      clientRef.update({
        consentSent: true,
        consentSentAt: FieldValue.serverTimestamp(),
      }),
      // Appointment-level: audit trail + prevents re-trigger on this doc.
      db.collection('appointments').doc(appointmentId).update({
        consentTriggered: true,
      }),
    ]);

    logger.info(
      `[sendConsentForm][${appointmentId}] ✓ consent form sent to ${patientEmail} ` +
      `and flags stamped on client ${clientId}`,
    );
  },
);
