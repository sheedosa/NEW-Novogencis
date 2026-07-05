/**
 * Website contact form → clinic inbox — Cloud Function.
 *
 * Public HTTPS callable (NO auth — anonymous website visitors submit it).
 * Validates input, drops honeypot-tripped bot submissions, and emails the
 * enquiry to the clinic via the shared MailerLite pipeline. Replaces the old
 * browser-side EmailJS path so the form has no dependency on bundled email
 * keys and shares one verified sending domain.
 *
 * SECRETS REQUIRED: MAILERLITE_API_KEY (see emailService.ts)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import {
  sendEmail,
  buildEmailHtml,
  buildEmailText,
  MAILERLITE_API_KEY,
  FROM_HELLO,
} from './emailService.js';

/** Clinic inbox that receives website enquiries. */
const ADMIN_EMAIL = 'admin@novogenics.co.uk';

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
    secrets: [MAILERLITE_API_KEY],
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
    const paragraphs = [
      `<strong>From:</strong> ${cleanName}`,
      `<strong>Reply to:</strong> ${cleanEmail}`,
      `<strong>Preferred contact:</strong> ${cleanMethod}`,
      `<strong>Message:</strong><br/>${cleanMessage.replace(/\n/g, '<br/>')}`,
    ];

    await sendEmail({
      to: { email: ADMIN_EMAIL, name: 'Novogenics Team' },
      from: FROM_HELLO,
      subject: `Website enquiry from ${cleanName}`,
      html: buildEmailHtml({ preheader: `Enquiry from ${cleanName}`, heading, paragraphs }),
      text: buildEmailText(heading, [
        `From: ${cleanName}`,
        `Reply to: ${cleanEmail}`,
        `Preferred contact: ${cleanMethod}`,
        `Message:\n${cleanMessage}`,
      ]),
      metadata: { type: 'contact_form', fromEmail: cleanEmail },
    });

    return { ok: true };
  },
);
