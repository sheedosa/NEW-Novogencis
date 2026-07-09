/**
 * Pluggable email service.
 *
 * All Cloud Functions that send email call `sendEmail()` from this module.
 * The transport is Resend (transactional email API). If the key is missing
 * or the API call fails, the message is written to the Firestore `outbox/`
 * collection so nothing is silently lost — an admin can review and retry.
 *
 * Swapping providers later means touching only `sendViaResend` below.
 *
 * Secrets required (set via `firebase functions:secrets:set RESEND_API_KEY`):
 *   RESEND_API_KEY   — Resend Dashboard → API Keys (Full access)
 *
 * Transactional email is sent via Resend (https://resend.com). The sender
 * domain `novogenics.co.uk` must be verified in Resend → Domains (add the DNS
 * records it lists) before transactional email will deliver to arbitrary
 * recipients — until then Resend only sends to the account owner's address.
 */

import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './index.js';

// ── Secret ───────────────────────────────────────────────────────────────────

export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// ── PII masking (GDPR data minimisation — no raw emails in logs) ────────────

/** Masks an email for logging: `rasheed@example.com` → `ra***@ex***` */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain.slice(0, 2)}***`;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailAttachment {
  /** Filename shown to recipient, e.g. "consent-form.pdf" */
  filename: string;
  /** Raw binary content — we base64-encode before sending */
  content: Uint8Array;
  /** MIME type, e.g. "application/pdf" */
  contentType: string;
}

export interface EmailMessage {
  to: {
    email: string;
    name?: string;
  };
  subject: string;
  /** HTML body — main content */
  html: string;
  /** Plain-text fallback (required by spam filters) */
  text: string;
  /** Optional PDF / image attachments */
  attachments?: EmailAttachment[];
  /**
   * Override the sender address. Defaults to FROM_NOREPLY.
   * Use FROM_MESSAGES for doctor-to-patient inbox messages.
   * Use FROM_HELLO for general clinic comms.
   */
  from?: string;
  /**
   * Free-form key/value pairs stored in the outbox record for traceability.
   * E.g. { patientId: '...', appointmentId: '...', type: 'consent' }
   */
  metadata?: Record<string, string>;
}

// ── Clinic sender identities ──────────────────────────────────────────────────
// All addresses share the verified novogenics.co.uk domain.
// Once Resend verifies the domain, all @novogenics.co.uk addresses work.

/** Automated system emails — consent forms, reminders, aftercare */
export const FROM_NOREPLY = 'noreply@novogenics.co.uk';
/** Doctor-to-patient messages sent from the platform inbox */
export const FROM_MESSAGES = 'messages@novogenics.co.uk';
/** General clinic contact address */
export const FROM_HELLO = 'hello@novogenics.co.uk';

/**
 * Where clinic-/admin-bound emails go — the doctors' personal inboxes. Each is
 * emailed individually with a personalised "Hi …," greeting. Update here to
 * change who receives new-assessment alerts + website enquiries.
 */
export const CLINIC_RECIPIENTS: { email: string; name: string; greeting: string }[] = [
  { email: 'aminah_amer@hotmail.com', name: 'Dr Aminah Amer', greeting: 'Dr Aminah' },
  { email: 'wfarid812@gmail.com',     name: 'Dr Waqas Farid',  greeting: 'Dr Waqas' },
];

const FROM_NAME = 'Novogenics';

// ── Resend transport ──────────────────────────────────────────────────────────

/**
 * Sends via the Resend transactional Email API.
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 *
 * Requires a verified sender domain (novogenics.co.uk) — add the DNS records
 * Resend lists under Domains. Until the domain verifies, Resend only delivers
 * to the account owner's own address.
 */
async function sendViaResend(message: EmailMessage): Promise<void> {
  const apiKey = RESEND_API_KEY.value();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY secret is not configured.');
  }

  // Resend takes `from` and `to` as "Name <email>" strings.
  const fromAddress = message.from ?? FROM_NOREPLY;
  const toAddress = message.to.name
    ? `${message.to.name} <${message.to.email}>`
    : message.to.email;

  const body: Record<string, unknown> = {
    from: `${FROM_NAME} <${fromAddress}>`,
    to: [toAddress],
    subject: message.subject,
    text: message.text,
    html: message.html,
  };

  // Attach PDFs as base64 (Resend attachment shape).
  if (message.attachments && message.attachments.length > 0) {
    body.attachments = message.attachments.map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.content).toString('base64'),
    }));
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(no body)');
    throw new Error(`Resend ${response.status}: ${errorText}`);
  }
}

// ── Outbox fallback ───────────────────────────────────────────────────────────

/**
 * Writes a failed or queued email to `outbox/` so the admin can review it.
 * Attachments are NOT stored (too large) — only filenames are recorded.
 */
async function writeToOutbox(
  message: EmailMessage,
  status: 'queued' | 'failed',
  error?: string,
): Promise<void> {
  try {
    await db.collection('outbox').add({
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachmentNames: message.attachments?.map((a) => a.filename) ?? [],
      metadata: message.metadata ?? null,
      status,
      error: error ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (writeErr) {
    // Log but don't re-throw — we're already in an error path.
    logger.error('[emailService] failed to write to outbox', writeErr);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send an email. On success logs the delivery. On failure writes to
 * `outbox/` collection and re-throws so the calling function can decide
 * whether to propagate or swallow the error.
 *
 * Usage:
 *   import { sendEmail, RESEND_API_KEY } from './emailService.js';
 *   // declare RESEND_API_KEY in your function's secrets: [...] config
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    await sendViaResend(message);
    logger.info(
      `[emailService] ✓ sent "${message.subject}" → ${maskEmail(message.to.email)}`,
      { metadata: message.metadata },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(
      `[emailService] ✗ failed to send "${message.subject}" → ${maskEmail(message.to.email)}: ${errMsg}`,
    );
    await writeToOutbox(message, 'failed', errMsg);
    throw err;
  }
}

// ── HTML email templates ──────────────────────────────────────────────────────

/**
 * Wraps body content in a minimal branded HTML shell.
 * Keeps the inline CSS simple enough to render in Gmail + Outlook.
 */
export function buildEmailHtml(opts: {
  preheader: string;
  heading: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const { preheader, heading, paragraphs, ctaLabel, ctaUrl, footerNote } = opts;

  const ctaBlock = ctaLabel && ctaUrl
    ? `<tr><td align="center" style="padding:24px 0 8px;">
         <a href="${ctaUrl}"
            style="background:#5c4a1e;color:#ffffff;font-family:Helvetica,Arial,sans-serif;
                   font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;
                   border-radius:6px;display:inline-block;">
           ${ctaLabel}
         </a>
       </td></tr>`
    : '';

  const paraBlocks = paragraphs
    .map(
      (p) =>
        `<tr><td style="padding:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:15px;
                         line-height:1.6;color:#1a1f28;">${p}</td></tr>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f0;">
  <!-- preheader (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
         style="background:#f5f4f0;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600"
             style="background:#ffffff;border-radius:8px;overflow:hidden;
                    border:1px solid #e8e4db;max-width:600px;width:100%;">
        <!-- Header band -->
        <tr>
          <td style="background:#1a1f28;padding:20px 32px;">
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:20px;
                      font-weight:700;color:#c9a84c;letter-spacing:0.5px;">Novogenics</p>
            <p style="margin:4px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;
                      color:#7a7f8a;letter-spacing:1px;text-transform:uppercase;">
              Regenerative Hair Restoration
            </p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="padding:0 0 20px;font-family:Helvetica,Arial,sans-serif;
                           font-size:20px;font-weight:700;color:#1a1f28;">${heading}</td>
              </tr>
              ${paraBlocks}
              ${ctaBlock}
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #f0ece4;">
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;
                      color:#9a9fa8;line-height:1.5;">
              ${footerNote ?? ''}
              Novogenics · Cheadle, Manchester · hello@novogenics.co.uk<br/>
              You are receiving this because you are a registered patient at Novogenics.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Plain-text fallback — strip HTML tags from paragraphs.
 */
export function buildEmailText(heading: string, paragraphs: string[]): string {
  const body = paragraphs.map((p) => p.replace(/<[^>]+>/g, '')).join('\n\n');
  return `${heading}\n${'─'.repeat(heading.length)}\n\n${body}\n\n— Novogenics, hello@novogenics.co.uk`;
}
