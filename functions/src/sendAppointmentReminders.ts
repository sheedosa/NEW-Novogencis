/**
 * Appointment reminder automation — scheduled Cloud Function.
 *
 * SCHEDULE: Daily at 10:00 Europe/London.
 *
 * LOGIC:
 *   1. Compute tomorrow's date in London time.
 *   2. Query all appointments with date === tomorrow and status === 'Confirmed'.
 *   3. Skip any appointment that already has `reminderSentAt` set.
 *   4. For each remaining appointment, load the patient and send:
 *      - A branded reminder email
 *      - Pre-treatment instructions PDF
 *   5. Stamp `reminderSentAt` on the appointment immediately after a
 *      successful send so re-runs (or a cron double-fire) don't resend.
 *
 * IDEMPOTENCY:
 *   `reminderSentAt` on the Appointment document is the sole dedup gate.
 *   The cron may run twice in rare edge cases (Cloud Scheduler guarantee is
 *   at-least-once); the field check makes it safe.
 *
 * SECRETS REQUIRED:
 *   MAILERLITE_API_KEY (see emailService.ts)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './index.js';
import {
  sendEmail,
  buildEmailHtml,
  buildEmailText,
  MAILERLITE_API_KEY,
  FROM_NOREPLY,
} from './emailService.js';
import { buildPreTreatmentPdf, DEFAULT_CLINIC } from './pdfGenerator.js';

// ── Helper: tomorrow's date in London time ────────────────────────────────────

function getTomorrowLondon(): string {
  const now = new Date();
  // Create a date in Europe/London timezone.
  const londonFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const londonParts = londonFormatter.formatToParts(now);
  const y = londonParts.find((p) => p.type === 'year')!.value;
  const m = londonParts.find((p) => p.type === 'month')!.value;
  const d = londonParts.find((p) => p.type === 'day')!.value;

  // Add 1 day
  const todayLondon = new Date(`${y}-${m}-${d}T00:00:00Z`);
  todayLondon.setUTCDate(todayLondon.getUTCDate() + 1);

  return todayLondon.toISOString().split('T')[0]; // yyyy-mm-dd
}

// ── Trigger ───────────────────────────────────────────────────────────────────

export const sendAppointmentReminders = onSchedule(
  {
    schedule: '0 10 * * *',           // 10:00 every day
    timeZone: 'Europe/London',
    region: 'europe-west2',
    secrets: [MAILERLITE_API_KEY],
    maxInstances: 1,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => {
    const tomorrow = getTomorrowLondon();
    logger.info(`[sendAppointmentReminders] checking appointments for ${tomorrow}`);

    // ── Query tomorrow's confirmed appointments ──────────────────────────────
    const snapshot = await db
      .collection('appointments')
      .where('date', '==', tomorrow)
      .where('status', '==', 'Confirmed')
      .get();

    if (snapshot.empty) {
      logger.info(`[sendAppointmentReminders] no confirmed appointments for ${tomorrow}`);
      return;
    }

    logger.info(
      `[sendAppointmentReminders] found ${snapshot.size} confirmed appointment(s) for ${tomorrow}`,
    );

    // ── Process each appointment ─────────────────────────────────────────────
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const doc of snapshot.docs) {
      const appt = doc.data();
      const apptId = doc.id;

      // ── Guard: skip if already reminded ─────────────────────────────────
      if (appt.reminderSentAt) {
        logger.info(`[sendAppointmentReminders][${apptId}] already reminded — skipping`);
        skipped++;
        continue;
      }

      const clientId = appt.clientId as string | undefined;
      if (!clientId) {
        logger.warn(`[sendAppointmentReminders][${apptId}] missing clientId — skipping`);
        errors.push(`${apptId}: missing clientId`);
        continue;
      }

      // ── Load patient ──────────────────────────────────────────────────────
      const clientSnap = await db.collection('clients').doc(clientId).get();
      if (!clientSnap.exists) {
        logger.warn(`[sendAppointmentReminders][${apptId}] client ${clientId} not found`);
        errors.push(`${apptId}: client not found`);
        continue;
      }

      const client = clientSnap.data()!;
      const patientEmail = client.email as string | undefined;

      if (!patientEmail) {
        logger.warn(`[sendAppointmentReminders][${apptId}] client ${clientId} has no email`);
        errors.push(`${apptId}: client has no email`);
        continue;
      }

      logger.info(
        `[sendAppointmentReminders][${apptId}] sending reminder to ${patientEmail}`,
      );

      // ── Build pre-treatment PDF ──────────────────────────────────────────
      let pdfBytes: Uint8Array;
      try {
        pdfBytes = await buildPreTreatmentPdf(
          {
            name: client.name ?? 'Patient',
            dob: client.dob,
            email: patientEmail,
          },
          {
            type: appt.type ?? 'Treatment',
            date: appt.date ?? tomorrow,
            time: appt.time ?? '',
            doctorName: appt.doctorName,
          },
          DEFAULT_CLINIC,
        );
      } catch (pdfErr) {
        const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        logger.error(`[sendAppointmentReminders][${apptId}] PDF generation failed: ${msg}`);
        errors.push(`${apptId}: PDF error`);
        continue;
      }

      // ── Build email ──────────────────────────────────────────────────────
      const firstName = (client.name as string ?? 'there').split(' ')[0];
      const apptDate = appt.date ?? tomorrow;
      const apptTime = appt.time ?? '';
      const apptType = appt.type ?? 'your appointment';
      const doctorName = appt.doctorName ? ` with ${appt.doctorName}` : '';

      const html = buildEmailHtml({
        preheader: `Your ${apptType} is tomorrow — here's what you need to know beforehand.`,
        heading: `Your appointment is tomorrow`,
        paragraphs: [
          `Hi ${firstName},`,
          `This is a reminder that your <strong>${apptType}</strong>${doctorName} is scheduled for ` +
          `<strong>tomorrow, ${apptDate}</strong> at <strong>${apptTime}</strong>.`,
          `Your pre-treatment instructions are attached. Please read them carefully — they'll help ` +
          `you get the best result from your session.`,
          `<strong>Key things to do today:</strong><br/>` +
          `• Stop ibuprofen, aspirin and alcohol<br/>` +
          `• Stay hydrated — aim for 2 litres of water<br/>` +
          `• Wash your hair in the morning with a mild shampoo<br/>` +
          `• Arrive with clean, dry hair and no styling products`,
          `If you need to reschedule or have any questions, please message us on WhatsApp or ` +
          `reply to this email as soon as possible.`,
          `We look forward to seeing you tomorrow!`,
        ],
        footerNote: 'This is an automated reminder from Novogenics. ',
      });

      const text = buildEmailText('Your appointment is tomorrow', [
        `Hi ${firstName},`,
        `Your ${apptType}${doctorName} is tomorrow, ${apptDate} at ${apptTime}.`,
        `Your pre-treatment instructions are attached. Key things to do today: stop ibuprofen/aspirin/alcohol, stay hydrated, wash your hair in the morning with a mild shampoo.`,
        `If you need to reschedule, please contact us as soon as possible.`,
      ]);

      // ── Send email ────────────────────────────────────────────────────────
      try {
        await sendEmail({
          to: { email: patientEmail, name: client.name },
          from: FROM_NOREPLY,
          subject: `Reminder: your ${apptType} is tomorrow — ${apptDate}`,
          html,
          text,
          attachments: [
            {
              filename: `novogenics-pre-treatment-${apptDate}.pdf`,
              content: pdfBytes,
              contentType: 'application/pdf',
            },
          ],
          metadata: {
            type: 'pre_treatment_reminder',
            patientId: clientId,
            appointmentId: apptId,
            appointmentDate: apptDate,
          },
        });
      } catch {
        // sendEmail already wrote to outbox — mark error but continue with others.
        logger.error(
          `[sendAppointmentReminders][${apptId}] email failed — left in outbox`,
        );
        errors.push(`${apptId}: email send failed`);
        continue;
      }

      // ── Stamp reminderSentAt ──────────────────────────────────────────────
      await doc.ref.update({
        reminderSentAt: FieldValue.serverTimestamp(),
      });

      sent++;
    }

    logger.info(
      `[sendAppointmentReminders] complete — sent: ${sent}, skipped: ${skipped}, errors: ${errors.length}`,
      { errors },
    );
  },
);
