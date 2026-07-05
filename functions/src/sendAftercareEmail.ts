/**
 * Aftercare email automation — Cloud Function.
 *
 * TRIGGER: Fires whenever an Appointment document is created or updated.
 *
 * LOGIC:
 *   1. Check that status just changed to 'Completed'.
 *   2. Guard against double-send using `appointment.aftercareSentAt`.
 *   3. Load the patient's Client document.
 *   4. Generate the aftercare instructions PDF.
 *   5. Send the branded aftercare email with PDF attached.
 *   6. Stamp `aftercareSentAt` on the appointment (ISO timestamp + server ts).
 *
 * IDEMPOTENCY:
 *   `aftercareSentAt` on the Appointment document is the sole dedup gate.
 *   If the function fires twice (Cloud Functions at-least-once guarantee),
 *   the second invocation exits immediately at the guard check.
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
import { buildAftercarePdf, DEFAULT_CLINIC } from './pdfGenerator.js';

// ── Trigger ──────────────────────────────────────────────────────────────────

export const sendAftercareEmail = onDocumentWritten(
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
      logger.info(`[sendAftercareEmail][${appointmentId}] deleted — skipping`);
      return;
    }

    const newStatus = after.status as string | undefined;
    const oldStatus = before?.status as string | undefined;

    // ── Guard: only act when status becomes 'Completed' ──────────────────────
    const justCompleted =
      newStatus === 'Completed' && oldStatus !== 'Completed';

    if (!justCompleted) {
      logger.info(
        `[sendAftercareEmail][${appointmentId}] status is "${newStatus}" (was "${oldStatus}") — no action needed`,
      );
      return;
    }

    // ── Guard: prevent double-send ────────────────────────────────────────────
    if (after.aftercareSentAt) {
      logger.info(
        `[sendAftercareEmail][${appointmentId}] aftercareSentAt already set — skipping`,
      );
      return;
    }

    const clientId = after.clientId as string | undefined;
    if (!clientId) {
      logger.error(`[sendAftercareEmail][${appointmentId}] missing clientId`);
      return;
    }

    // ── Load patient ─────────────────────────────────────────────────────────
    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) {
      logger.error(
        `[sendAftercareEmail][${appointmentId}] client ${clientId} not found`,
      );
      return;
    }

    const client = clientSnap.data()!;
    const patientEmail = client.email as string | undefined;

    if (!patientEmail) {
      logger.error(
        `[sendAftercareEmail][${appointmentId}] client ${clientId} has no email`,
      );
      return;
    }

    logger.info(
      `[sendAftercareEmail][${appointmentId}] sending aftercare to ${maskEmail(patientEmail)}`,
    );

    // ── Build aftercare PDF ──────────────────────────────────────────────────
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await buildAftercarePdf(
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
    } catch (pdfErr) {
      const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
      logger.error(`[sendAftercareEmail][${appointmentId}] PDF generation failed: ${msg}`);
      return;
    }

    // ── Build email ───────────────────────────────────────────────────────────
    const firstName = (client.name as string ?? 'there').split(' ')[0];
    const apptType = after.type ?? 'your treatment';
    const apptDate = after.date ?? 'today';
    const doctorName = after.doctorName ? ` with ${after.doctorName}` : '';

    const html = buildEmailHtml({
      preheader: `Thank you for your visit — your aftercare instructions are inside.`,
      heading: `Your aftercare instructions`,
      paragraphs: [
        `Hi ${firstName},`,
        `Thank you for visiting us today for your <strong>${apptType}</strong>${doctorName}. ` +
        `We hope your session went well.`,
        `Your aftercare instructions are attached to this email. Please follow them carefully ` +
        `— they protect your result and support your recovery.`,
        `<strong>The most important rules for the next 24 hours:</strong><br/>` +
        `• Do not wash or wet the treated area<br/>` +
        `• No products, oils, or dry shampoo on the scalp<br/>` +
        `• Avoid touching, scratching or massaging the area<br/>` +
        `• No alcohol or anti-inflammatory medication`,
        `If you notice any unusual swelling, pain after 72 hours, or any sign of infection, ` +
        `please contact us immediately on WhatsApp.`,
        `Early results — a reduction in shedding — are typically visible within 4–8 weeks. ` +
        `We will check in with you at your follow-up review. Looking forward to seeing your progress!`,
      ],
      footerNote: 'This email contains your clinical aftercare instructions. Please keep it for your records. ',
    });

    const text = buildEmailText('Your aftercare instructions', [
      `Hi ${firstName},`,
      `Thank you for visiting us today for your ${apptType}${doctorName}.`,
      `Your aftercare instructions are attached. The most important rules for the next 24 hours: do not wash or wet the treated area, no products on the scalp, avoid touching the area, no alcohol or anti-inflammatory medication.`,
      `If you notice any unusual swelling, pain after 72 hours, or any sign of infection, contact us immediately on WhatsApp.`,
      `Early results are typically visible within 4-8 weeks. We look forward to seeing your progress!`,
    ]);

    // ── Send email ────────────────────────────────────────────────────────────
    try {
      await sendEmail({
        to: { email: patientEmail, name: client.name },
        from: FROM_NOREPLY,
        subject: `Your aftercare instructions — Novogenics ${apptDate}`,
        html,
        text,
        attachments: [
          {
            filename: `novogenics-aftercare-${apptDate}.pdf`,
            content: pdfBytes,
            contentType: 'application/pdf',
          },
        ],
        metadata: {
          type: 'aftercare',
          patientId: clientId,
          appointmentId,
          appointmentDate: apptDate,
        },
      });
    } catch {
      // sendEmail already wrote to outbox.
      logger.error(
        `[sendAftercareEmail][${appointmentId}] email failed — left in outbox for review`,
      );
      return;
    }

    // ── Stamp aftercareSentAt — only after successful send ────────────────────
    await db.collection('appointments').doc(appointmentId).update({
      aftercareSentAt: FieldValue.serverTimestamp(),
    });

    logger.info(
      `[sendAftercareEmail][${appointmentId}] ✓ aftercare sent to ${patientEmail}`,
    );
  },
);
