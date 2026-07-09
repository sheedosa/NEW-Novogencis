/**
 * Website contact form → clinic inbox — Cloud Function.
 *
 * Public HTTPS callable (NO auth — anonymous website visitors submit it).
 * Validates input, drops honeypot-tripped bot submissions, and emails the
 * enquiry to the clinic via the shared server-side email pipeline. Replaces the old
 * browser-side EmailJS path so the form has no dependency on bundled email
 * keys and shares one verified sending domain.
 *
 * SECRETS REQUIRED: RESEND_API_KEY (see emailService.ts)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import {
  sendEmail,
  buildEmailHtml,
  buildEmailText,
  RESEND_API_KEY,
  FROM_HELLO,
  CLINIC_RECIPIENTS,
} from './emailService.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactInput {
  name: string;
  email: string;
  method?: string;
  message: string;
  /** Honeypot — must be empty for a real human. */
  company?: string;
}

interface ContactOutput {
  ok: boolean;
}

export const submitContactForm = onCall<ContactInput, Promise<ContactOutput>>(
  {
    region: 'europe-west2',
    secrets: [RESEND_API_KEY],
    maxInstances: 5,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req) => {
    const { name, email, method, message, company } = req.data || ({} as ContactInput);

    // Honeypot: silently accept (pretend success) without sending anything.
    if (company && company.trim() !== '') {
      logger.info('[submitContactForm] honeypot tripped — ignoring');
      return { ok: true };
    }

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim();
    const cleanMessage = (message || '').trim().slice(0, 5000);
    const cleanMethod = (method || 'Email').trim();

    if (!cleanName || !cleanMessage) {
      throw new HttpsError('invalid-argument', 'Name and message are required.');
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      throw new HttpsError('invalid-argument', 'A valid email address is required.');
    }

    const heading = 'New website enquiry';
    const details = [
      `<strong>From:</strong> ${cleanName}`,
      `<strong>Reply to:</strong> ${cleanEmail}`,
      `<strong>Preferred contact:</strong> ${cleanMethod}`,
      `<strong>Message:</strong><br/>${cleanMessage.replace(/\n/g, '<br/>')}`,
    ];
    const textDetails = [
      `From: ${cleanName}`,
      `Reply to: ${cleanEmail}`,
      `Preferred contact: ${cleanMethod}`,
      `Message:\n${cleanMessage}`,
    ];

    // Email each doctor personally. Resilient — one failure doesn't block the other.
    let anySent = false;
    for (const r of CLINIC_RECIPIENTS) {
      try {
        await sendEmail({
          to: { email: r.email, name: r.name },
          from: FROM_HELLO,
          subject: `Website enquiry from ${cleanName}`,
          html: buildEmailHtml({
            preheader: `Enquiry from ${cleanName}`,
            heading,
            paragraphs: [`Hi ${r.greeting},`, ...details],
          }),
          text: buildEmailText(heading, [`Hi ${r.greeting},`, ...textDetails]),
          metadata: { type: 'contact_form', fromEmail: cleanEmail },
        });
        anySent = true;
      } catch (err) {
        logger.error(`[submitContactForm] failed to email ${r.email}`, err);
      }
    }

    if (!anySent) {
      throw new HttpsError('internal', 'Could not send your enquiry right now. Please email us directly.');
    }

    return { ok: true };
  },
);
