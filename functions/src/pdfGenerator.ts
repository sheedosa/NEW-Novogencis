/**
 * Clinical PDF generators.
 *
 * Three documents — built with pdf-lib so we can deploy to Cloud Functions
 * (no headless Chrome required). Each generator returns a `Uint8Array` ready
 * to attach to an email or upload to Cloud Storage.
 *
 *   buildConsentPdf       → Appendix A — Informed consent + signature line
 *   buildPreTreatmentPdf  → Appendix B — Pre-treatment do/don't checklist
 *   buildAftercarePdf     → Appendix C — Post-treatment care instructions
 *
 * Typography:
 *   Helvetica family throughout. Times reserved for the eventual letterhead
 *   variant if we ever brand-stylise these. Keep generators dependency-free
 *   of any runtime config — pass everything you need in via arguments so
 *   they're trivially unit-testable.
 *
 * Layout primitives below (`drawHeader`, `drawWrappedText`, `nextLine`) keep
 * each appendix readable as a near-1:1 translation of the source MD file.
 */

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PdfPatient {
  name: string;
  dob?: string;
  email?: string;
}

export interface PdfAppointment {
  type: string;
  date: string;   // ISO yyyy-mm-dd
  time: string;   // "10:30 AM"
  doctorName?: string;
}

export interface PdfClinic {
  name: string;          // "Novogenics"
  addressLines: string[];
  email: string;
  whatsapp: string;
  website: string;
}

export const DEFAULT_CLINIC: PdfClinic = {
  name: 'Novogenics',
  addressLines: ['Cheadle, Manchester', 'United Kingdom'],
  email: 'hello@novogenics.co.uk',
  whatsapp: '+44 7000 000000',
  website: 'novogenics.co.uk',
};

// ── Page geometry ───────────────────────────────────────────────────────────

const PAGE_W = 595.28;   // A4 in points
const PAGE_H = 841.89;
const MARGIN_X = 56;     // ~2 cm
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;
const LINE_HEIGHT = 14;
const PARAGRAPH_GAP = 6;

const COLOR_TEXT = rgb(0.1, 0.12, 0.16);
const COLOR_MUTED = rgb(0.42, 0.45, 0.5);
const COLOR_ACCENT = rgb(0.34, 0.28, 0.16); // muted gold-brown brand tone
const COLOR_RULE = rgb(0.82, 0.82, 0.85);

// ── Layout helpers ──────────────────────────────────────────────────────────

interface Cursor {
  page: PDFPage;
  y: number;
}

interface Fonts {
  body: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

/** Adds a new page and returns a fresh cursor positioned at top-left content. */
function addPage(doc: PDFDocument): Cursor {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  return { page, y: PAGE_H - MARGIN_TOP };
}

/** Ensures we have enough vertical room — paginates if not. */
function ensureSpace(cur: Cursor, doc: PDFDocument, needed: number): Cursor {
  if (cur.y - needed < MARGIN_BOTTOM) {
    return addPage(doc);
  }
  return cur;
}

/** Greedy word-wrap that respects the printable width. */
function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  // Honour explicit newlines first.
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      out.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const w = font.widthOfTextAtSize(candidate, size);
      if (w > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

interface DrawTextOpts {
  size?: number;
  font?: PDFFont;
  color?: ReturnType<typeof rgb>;
  indent?: number;
}

function drawWrappedText(
  cur: Cursor,
  doc: PDFDocument,
  fonts: Fonts,
  text: string,
  opts: DrawTextOpts = {},
): Cursor {
  const size = opts.size ?? 10.5;
  const font = opts.font ?? fonts.body;
  const color = opts.color ?? COLOR_TEXT;
  const indent = opts.indent ?? 0;
  const maxW = PAGE_W - MARGIN_X * 2 - indent;
  const lines = wrapLines(text, font, size, maxW);

  for (const line of lines) {
    cur = ensureSpace(cur, doc, LINE_HEIGHT);
    if (line) {
      cur.page.drawText(line, {
        x: MARGIN_X + indent,
        y: cur.y - size,
        size,
        font,
        color,
      });
    }
    cur.y -= LINE_HEIGHT;
  }
  return cur;
}

function drawHeading(
  cur: Cursor,
  doc: PDFDocument,
  fonts: Fonts,
  text: string,
  size = 13,
): Cursor {
  cur = ensureSpace(cur, doc, LINE_HEIGHT + PARAGRAPH_GAP);
  cur.y -= 4;
  cur = drawWrappedText(cur, doc, fonts, text, {
    size,
    font: fonts.bold,
    color: COLOR_ACCENT,
  });
  // hairline under heading
  cur.page.drawLine({
    start: { x: MARGIN_X, y: cur.y + 4 },
    end: { x: PAGE_W - MARGIN_X, y: cur.y + 4 },
    thickness: 0.4,
    color: COLOR_RULE,
  });
  cur.y -= PARAGRAPH_GAP;
  return cur;
}

function paragraphBreak(cur: Cursor): Cursor {
  cur.y -= PARAGRAPH_GAP;
  return cur;
}

function drawBullets(
  cur: Cursor,
  doc: PDFDocument,
  fonts: Fonts,
  items: string[],
): Cursor {
  for (const item of items) {
    cur = ensureSpace(cur, doc, LINE_HEIGHT);
    cur.page.drawText('•', {
      x: MARGIN_X,
      y: cur.y - 10.5,
      size: 10.5,
      font: fonts.bold,
      color: COLOR_ACCENT,
    });
    cur = drawWrappedText(cur, doc, fonts, item, { indent: 14 });
  }
  return cur;
}

function drawDocHeader(
  cur: Cursor,
  doc: PDFDocument,
  fonts: Fonts,
  clinic: PdfClinic,
  title: string,
): Cursor {
  // Clinic block (top-left)
  cur.page.drawText(clinic.name, {
    x: MARGIN_X,
    y: cur.y - 14,
    size: 14,
    font: fonts.bold,
    color: COLOR_ACCENT,
  });
  cur.y -= 18;

  for (const line of clinic.addressLines) {
    cur.page.drawText(line, {
      x: MARGIN_X,
      y: cur.y - 9,
      size: 9,
      font: fonts.body,
      color: COLOR_MUTED,
    });
    cur.y -= 11;
  }
  cur.page.drawText(`${clinic.email}  ·  ${clinic.whatsapp}  ·  ${clinic.website}`, {
    x: MARGIN_X,
    y: cur.y - 9,
    size: 9,
    font: fonts.body,
    color: COLOR_MUTED,
  });
  cur.y -= 22;

  // Document title
  cur.page.drawText(title, {
    x: MARGIN_X,
    y: cur.y - 18,
    size: 18,
    font: fonts.bold,
    color: COLOR_TEXT,
  });
  cur.y -= 24;

  cur.page.drawLine({
    start: { x: MARGIN_X, y: cur.y },
    end: { x: PAGE_W - MARGIN_X, y: cur.y },
    thickness: 0.6,
    color: COLOR_ACCENT,
  });
  cur.y -= 16;
  return cur;
}

function drawPatientBlock(
  cur: Cursor,
  doc: PDFDocument,
  fonts: Fonts,
  patient: PdfPatient,
  appt: PdfAppointment,
): Cursor {
  const rows: Array<[string, string]> = [
    ['Patient', patient.name],
    ['Date of birth', patient.dob ?? '—'],
    ['Treatment', appt.type],
    ['Appointment', `${appt.date} · ${appt.time}`],
    ['Clinician', appt.doctorName ?? 'To be assigned'],
  ];
  for (const [label, value] of rows) {
    cur = ensureSpace(cur, doc, LINE_HEIGHT);
    cur.page.drawText(label, {
      x: MARGIN_X,
      y: cur.y - 10,
      size: 9.5,
      font: fonts.bold,
      color: COLOR_MUTED,
    });
    cur.page.drawText(value, {
      x: MARGIN_X + 100,
      y: cur.y - 10,
      size: 10.5,
      font: fonts.body,
      color: COLOR_TEXT,
    });
    cur.y -= LINE_HEIGHT;
  }
  cur.y -= PARAGRAPH_GAP;
  return cur;
}

function drawFooter(page: PDFPage, fonts: Fonts, clinic: PdfClinic, label: string): void {
  page.drawText(
    `${clinic.name} · ${clinic.website} · Generated ${new Date().toISOString().split('T')[0]} · ${label}`,
    {
      x: MARGIN_X,
      y: 28,
      size: 8,
      font: fonts.body,
      color: COLOR_MUTED,
    },
  );
}

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  const [body, bold, italic] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
  ]);
  return { body, bold, italic };
}

// ── Document 1: Consent ─────────────────────────────────────────────────────

export async function buildConsentPdf(
  patient: PdfPatient,
  appointment: PdfAppointment,
  clinic: PdfClinic = DEFAULT_CLINIC,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Informed Consent — ${patient.name}`);
  doc.setAuthor(clinic.name);
  doc.setSubject('Informed Consent for Regenerative Hair Restoration Treatment');

  const fonts = await loadFonts(doc);
  let cur = addPage(doc);
  cur = drawDocHeader(cur, doc, fonts, clinic, 'Informed Consent');
  cur = drawPatientBlock(cur, doc, fonts, patient, appointment);

  cur = drawHeading(cur, doc, fonts, 'About this document');
  cur = drawWrappedText(
    cur, doc, fonts,
    `This consent form sets out the nature of the treatment proposed by ${clinic.name}, the ` +
    `expected benefits, the risks and limitations, and the alternatives. Please read it carefully ` +
    `and ask your clinician about anything you do not understand before signing.`,
  );
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'Nature of the treatment');
  cur = drawWrappedText(
    cur, doc, fonts,
    `${appointment.type} is a regenerative procedure intended to support hair restoration. ` +
    `It involves the preparation and application of autologous biological material derived from ` +
    `a small blood sample drawn at the clinic. Treatment is delivered by a registered clinician ` +
    `and typically takes between 45 and 90 minutes.`,
  );
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'Possible benefits');
  cur = drawBullets(cur, doc, fonts, [
    'Reduction in shedding within 8–12 weeks of the first session.',
    'Visible improvement in hair density and calibre over a 3–6 month course.',
    'Improvement of overall scalp condition.',
  ]);
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'Risks, side effects and limitations');
  cur = drawBullets(cur, doc, fonts, [
    'Mild bruising, tenderness or swelling at injection sites lasting 24–72 hours.',
    'Transient pinpoint bleeding and scalp redness on the day of treatment.',
    'Short-lived headache or scalp tightness; rare allergic reaction to anaesthetic.',
    'Results vary between patients; treatment may not produce the desired outcome.',
    'A course of multiple sessions is typically required; maintenance is recommended.',
    'Infection is rare when aseptic technique is followed but remains a recognised risk.',
  ]);
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'Alternatives');
  cur = drawWrappedText(
    cur, doc, fonts,
    `Alternative options have been discussed with you, including topical and oral medical ` +
    `therapies, surgical hair restoration, and the option of no treatment. You have had the ` +
    `opportunity to ask questions about each.`,
  );
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'Photography');
  cur = drawWrappedText(
    cur, doc, fonts,
    `Clinical photographs may be taken at baseline and at follow-up to assess progress. ` +
    `Photographs are stored in your encrypted clinical record and will not be used externally ` +
    `without your separate written permission.`,
  );
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'Data and confidentiality');
  cur = drawWrappedText(
    cur, doc, fonts,
    `Your personal and clinical data are processed in accordance with UK GDPR and the Data ` +
    `Protection Act 2018. The clinic acts as data controller. You may withdraw consent for ` +
    `processing beyond the legal minimum at any time by contacting ${clinic.email}.`,
  );
  cur = paragraphBreak(cur);

  // Acknowledgement block (force onto same page as signature where possible)
  cur = ensureSpace(cur, doc, LINE_HEIGHT * 8 + 80);
  cur = drawHeading(cur, doc, fonts, 'Patient declaration');
  cur = drawWrappedText(
    cur, doc, fonts,
    `I confirm that I have read and understood the information above, that I have had the ` +
    `opportunity to ask questions, and that all my questions have been answered to my ` +
    `satisfaction. I consent to the treatment described.`,
  );
  cur = paragraphBreak(cur);

  // Signature lines
  cur = ensureSpace(cur, doc, 70);
  const sigY = cur.y - 28;
  const colW = (PAGE_W - MARGIN_X * 2 - 24) / 2;

  // Patient signature
  cur.page.drawLine({
    start: { x: MARGIN_X, y: sigY },
    end: { x: MARGIN_X + colW, y: sigY },
    thickness: 0.6,
    color: COLOR_TEXT,
  });
  cur.page.drawText('Patient signature', {
    x: MARGIN_X, y: sigY - 12, size: 9, font: fonts.body, color: COLOR_MUTED,
  });
  cur.page.drawText('Date', {
    x: MARGIN_X, y: sigY - 26, size: 9, font: fonts.body, color: COLOR_MUTED,
  });

  // Clinician signature
  const cx = MARGIN_X + colW + 24;
  cur.page.drawLine({
    start: { x: cx, y: sigY },
    end: { x: cx + colW, y: sigY },
    thickness: 0.6,
    color: COLOR_TEXT,
  });
  cur.page.drawText('Clinician signature', {
    x: cx, y: sigY - 12, size: 9, font: fonts.body, color: COLOR_MUTED,
  });
  cur.page.drawText(appointment.doctorName ?? 'To be assigned', {
    x: cx, y: sigY - 26, size: 9, font: fonts.body, color: COLOR_TEXT,
  });

  // Footer on every page
  for (const page of doc.getPages()) {
    drawFooter(page, fonts, clinic, 'Informed Consent');
  }
  return doc.save();
}

// ── Document 2: Pre-treatment instructions ──────────────────────────────────

export async function buildPreTreatmentPdf(
  patient: PdfPatient,
  appointment: PdfAppointment,
  clinic: PdfClinic = DEFAULT_CLINIC,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Pre-Treatment Instructions — ${patient.name}`);
  doc.setAuthor(clinic.name);

  const fonts = await loadFonts(doc);
  let cur = addPage(doc);
  cur = drawDocHeader(cur, doc, fonts, clinic, 'Pre-Treatment Instructions');
  cur = drawPatientBlock(cur, doc, fonts, patient, appointment);

  cur = drawHeading(cur, doc, fonts, 'Your appointment is in 48 hours');
  cur = drawWrappedText(
    cur, doc, fonts,
    `To get the best possible result from your session, please follow the guidance below in the ` +
    `48 hours before your visit. If you have any questions, message us on WhatsApp at ` +
    `${clinic.whatsapp} or email ${clinic.email}.`,
  );
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, '48 hours before');
  cur = drawBullets(cur, doc, fonts, [
    'Stop alcohol, anti-inflammatory medication (ibuprofen, aspirin) and fish-oil supplements.',
    'Avoid strenuous exercise and saunas — anything that significantly raises body temperature.',
    'Drink plenty of water; aim for 2 litres per day.',
    'If you take any prescribed blood thinners, contact us before stopping anything.',
  ]);
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, '24 hours before');
  cur = drawBullets(cur, doc, fonts, [
    'Eat well — a balanced meal with protein and complex carbohydrates the night before.',
    'Get a full night of sleep; rested patients tolerate the procedure more comfortably.',
    'Avoid caffeine in excess on the morning of treatment.',
    'Wash your hair the morning of your appointment with a mild, fragrance-free shampoo.',
  ]);
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'On the day');
  cur = drawBullets(cur, doc, fonts, [
    'Arrive with clean, dry hair — no styling products, oils, or dry shampoo.',
    'Wear comfortable clothing; a button-up or loose neckline is ideal.',
    'Have a light meal 1–2 hours before to reduce light-headedness.',
    `Allow up to 90 minutes for the full visit including consultation and aftercare briefing.`,
  ]);
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'Cannot make it?');
  cur = drawWrappedText(
    cur, doc, fonts,
    `Please contact us as soon as possible. Our cancellation policy is published on our website. ` +
    `Cancellations more than 48 hours in advance qualify for a full refund of the deposit; ` +
    `inside 48 hours the deposit becomes non-refundable as we will have prepared materials for ` +
    `your session.`,
  );

  for (const page of doc.getPages()) {
    drawFooter(page, fonts, clinic, 'Pre-Treatment Instructions');
  }
  return doc.save();
}

// ── Document 3: Aftercare ───────────────────────────────────────────────────

export async function buildAftercarePdf(
  patient: PdfPatient,
  appointment: PdfAppointment,
  clinic: PdfClinic = DEFAULT_CLINIC,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Aftercare — ${patient.name}`);
  doc.setAuthor(clinic.name);

  const fonts = await loadFonts(doc);
  let cur = addPage(doc);
  cur = drawDocHeader(cur, doc, fonts, clinic, 'Aftercare Instructions');
  cur = drawPatientBlock(cur, doc, fonts, patient, appointment);

  cur = drawHeading(cur, doc, fonts, 'Thank you for visiting us today');
  cur = drawWrappedText(
    cur, doc, fonts,
    `Your scalp may feel tender, mildly swollen or warm for the next 24–48 hours — this is ` +
    `normal and a sign that the treated tissue is responding. Please follow the steps below ` +
    `to support healing and protect your result.`,
  );
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'First 24 hours');
  cur = drawBullets(cur, doc, fonts, [
    'Do not wash your hair or wet the treated area.',
    'Do not apply any product, styling spray, oil or dry shampoo to the scalp.',
    'Avoid touching, scratching or massaging the treated area.',
    'Sleep on your back if comfortable, with a clean pillowcase.',
    'Avoid alcohol and anti-inflammatory medication (ibuprofen, aspirin).',
  ]);
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, '24–72 hours');
  cur = drawBullets(cur, doc, fonts, [
    'You may gently wash with lukewarm water and a mild, sulphate-free shampoo.',
    'Pat dry — do not rub vigorously. Avoid hot tools (hairdryers on high, straighteners).',
    'Avoid strenuous exercise, saunas, steam rooms and swimming pools.',
    'Direct sun exposure to the scalp should be avoided; wear a loose hat outdoors.',
  ]);
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'First 2 weeks');
  cur = drawBullets(cur, doc, fonts, [
    'Resume normal hair-care, but continue to avoid harsh chemical treatments (colour, perms).',
    'Stay well hydrated and maintain a protein-rich diet to support follicular response.',
    'Photograph the treated area weekly so we can review progress at follow-up.',
  ]);
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'When to contact us');
  cur = drawBullets(cur, doc, fonts, [
    'Increasing pain or swelling beyond 72 hours.',
    'Any sign of infection — pus, fever, spreading redness or warmth.',
    'Persistent bleeding from any injection site.',
    `Any concern at all — message us on WhatsApp at ${clinic.whatsapp}.`,
  ]);
  cur = paragraphBreak(cur);

  cur = drawHeading(cur, doc, fonts, 'What to expect');
  cur = drawWrappedText(
    cur, doc, fonts,
    `Early results — usually a reduction in shedding — are typically noticeable within 4–8 weeks. ` +
    `Visible changes in density and calibre develop progressively over 3–6 months. A course of ` +
    `multiple sessions delivers the most reliable outcome; we will discuss your next appointment ` +
    `at your follow-up review.`,
  );

  for (const page of doc.getPages()) {
    drawFooter(page, fonts, clinic, 'Aftercare Instructions');
  }
  return doc.save();
}
