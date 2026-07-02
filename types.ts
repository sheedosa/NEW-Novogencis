export enum Page {
  Home = 'home',
  About = 'about',
  Treatments = 'treatments',
  Pricing = 'pricing',
  FAQ = 'faq',
  Blog = 'blog',
  Contact = 'contact',
  Assessment = 'assessment',
  PrivacyPolicy = 'privacy-policy',
  CancellationPolicy = 'cancellation-policy',
  Admin = 'admin',
  SignIn = 'signin',
  Register = 'register',
  ClientDashboard = 'client-dashboard'
}

export type UserRole = 'admin' | 'client';
export type AdminType = 'doctor-female' | 'doctor-male' | 'technical';

export interface User {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: UserRole;
  adminType?: AdminType;
  policiesAccepted?: boolean;
  createdAt: string;
}

export interface ClientProfile {
  userId: string;
  dob: string;
  phone: string;
  medicalSummary: string;
  status: 'Active' | 'Inactive' | 'Consultation Pending' | 'New Inquiry';
}

export interface VirtualAssessment {
  id: string;
  userId: string;
  answers: Record<string, string | number | boolean | string[]>;
  status: 'New' | 'Reviewed' | 'Contacted' | 'Converted' | 'Not Suitable';
  adminNotes: string;
  clinicResponse: string;
  submittedAt: string;
}

export interface GalleryItem {
  id: string;
  url: string;
  label: string;
  uploadedAt: string;
  source: 'Assessment' | 'Clinical';
}

// Lead source captured on first visit (UTM params + referrer) and attached to
// the Client doc on account creation. Powers the Marketing tab's funnel
// attribution and campaign performance reports.
export interface LeadSource {
  utm_source?: string;    // google | facebook | instagram | direct | referral
  utm_medium?: string;    // cpc | organic | social | email | referral
  utm_campaign?: string;  // free-text campaign id (e.g. 'spring_2026_prp')
  utm_term?: string;
  utm_content?: string;
  referrer?: string;      // document.referrer host on first visit
  landingPage?: string;   // first page they landed on (path)
  capturedAt: string;     // ISO timestamp
}

/**
 * A single entry in a patient's internal-notes log.
 * Notes are append-only — never overwrite an existing entry. Each entry
 * captures the author + time so the log functions as a clinical audit trail.
 */
export interface InternalNoteEntry {
  id: string;
  body: string;
  /** ISO timestamp when this note was written. */
  createdAt: string;
  /** Firebase UID of the clinician who wrote the note. */
  authorId: string;
  /** Display name (snapshotted at write time so changing display names later doesn't rewrite history). */
  authorName?: string;
}

export interface Client {
  id: string;
  name: string;
  gender: 'male' | 'female';
  email: string;
  phone: string;
  dob: string;
  address?: string;
  package?: string;
  packageStatus?: string;
  allergies?: string;
  medicalHistory?: string;
  status: string;
  policiesAccepted?: boolean;
  doctorPreference?: 'female-only' | 'ok-with-male';
  gallery?: GalleryItem[];
  completedForms?: {
    formId: string;
    title: string;
    signedAt: string;
    formData: Record<string, unknown>;
    signature: string;
  }[];
  /** Legacy single-string note (kept for migration; new writes go to `internalNoteEntries`). */
  internalNotes?: string;
  /** Append-only log of timestamped clinical notes. Doctors add entries; nothing is ever overwritten. */
  internalNoteEntries?: InternalNoteEntry[];
  treatmentPlan?: TreatmentPlan;
  prescriptions?: Prescription[];
  payments?: Payment[];
  /** Stripe Customer linkage — set on first checkout; enables saved cards + unified history. */
  stripeCustomerId?: string;
  /** Saved card's payment method id — set by the webhook when a card is stored (setup_future_usage). */
  stripeDefaultPaymentMethodId?: string;
  /** True once a reusable card is on file (drives the "card on file" UI + charge-saved-card). */
  hasSavedCard?: boolean;
  leadSource?: LeadSource;
  /** Sprint 2: lifetime consent-form-sent flag. Once true, never re-send. */
  consentSent?: boolean;
  consentSentAt?: string;
  createdAt: string;
  assessmentData?: {
    answers?: Record<string, { text: string; value: string | string[] }>;
    screening?: {
      conditions?: string[];
      suitability?: string;
    };
    consultation?: {
      onset?: string;
      triggers?: string;
      medicalHistory?: string;
      medications?: string;
      supplements?: string;
      femaleHealth?: {
        cycles?: string;
        pregnant?: string;
        breastfeeding?: string;
      };
      hairCare?: string;
      lifestyle?: string;
    };
    clinicalFeedback?: string;
    reviewDate?: string;
  };
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  doctorId?: string;
  doctorName?: string;
  type: 'PRP + Microneedling' | 'EV Enriched Plasma / Autologous Exosomes + Microneedling' | 'Face to Face Consultation' | 'Initial Consultation' | 'Follow-up Consultation' | 'PRP Session' | 'EV-Enriched Plasma Session' | 'Hair Assessment' | 'Microneedling Session' | 'PRF Starter' | 'PRF Intensive' | 'PRF Elite' | 'PRF + Microneedling';
  date: string;
  time: string;
  status: 'Confirmed' | 'Pending' | 'Awaiting deposit' | 'Completed' | 'Cancelled' | 'No-Show';
  /** Slot length in minutes — drives calendar layout + conflict checks */
  durationMin?: number;
  /** Reference to a Treatment doc — drives default duration, price, deposit */
  treatmentId?: string;
  /** Deposit owed on this booking, in pence (avoids floating point) */
  depositPence?: number;
  /** Which clinician is assigned to deliver this appointment */
  clinicianId?: string;
  /** Reminder email queued/sent at this ISO timestamp — used to dedup the
   *  day-before reminder Cloud Function so the same appointment never gets
   *  two reminders even if the cron runs twice. */
  reminderSentAt?: string;
  /** Aftercare email queued/sent at this ISO timestamp — set by the
   *  sendAftercareEmail Cloud Function when appointment marked Completed. */
  aftercareSentAt?: string;
  /** Marks which appointment triggered the once-per-lifetime consent send. */
  consentTriggered?: boolean;
  notes: string;
  createdAt: string;
}

export interface TreatmentNote {
  id: string;
  clientId: string;
  appointmentId: string;
  notes: string;
  treatmentType: string;
  createdAt: string;
}

export interface TreatmentPhase {
  id: string;
  name: string;
  description: string;
  status: 'Planned' | 'Active' | 'Completed' | 'On Hold';
  sessionsPlanned: number;
  sessionsCompleted: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface TreatmentPlan {
  id: string;
  clientId: string;
  title: string;
  phases: TreatmentPhase[];
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Prescription {
  id: string;
  drugName: string;
  dosage: string;
  instructions: string;
  startDate: string;
  endDate?: string;
  prescribedBy?: string;
  status: 'Active' | 'Completed' | 'Discontinued';
  createdAt: string;
}

export interface Payment {
  id: string;
  description: string;
  amount: number;
  /** Precise pence amount on Stripe-backed payments (avoids float drift). */
  amountPence?: number;
  currency: string;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Refunded' | 'Partially refunded';
  dueDate?: string;
  paidDate?: string;
  reference?: string;
  /** Stripe linkage — present on Stripe-collected payments, absent on manual entries. */
  type?: 'deposit' | 'balance' | 'standalone';
  appointmentId?: string;
  treatmentId?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  refundAmount?: number;
  refundedAt?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
  type?: 'message' | 'form' | 'payment';
  formId?: string;
  isSigned?: boolean;
  signedAt?: string;
  formData?: Record<string, unknown>;
  signature?: string;
  paymentUrl?: string;
  /** Structured reschedule request — set when a patient asks to move an
      appointment from the portal. The human-readable body is still sent, so
      older clients render these as plain messages. */
  rescheduleRequest?: {
    appointmentId: string;
    preferredDate: string;   // YYYY-MM-DD
    preferredTime: string;   // 'Morning' | 'Afternoon' | 'Any time'
  };
}

export interface FAQItem {
  question: string;
  answer: string;
}

/** Public-facing treatment info shown on the website Treatments page. */
export interface PublicTreatment {
  id: string;
  name: string;
  whatIsIt: string;
  howItWorks: string;
  benefits: string[];
  idealFor: string[];
}

export type NotificationType =
  | 'new_assessment'
  | 'new_message'
  | 'form_signed'
  | 'form_sent'
  | 'feedback_received'
  | 'appointment_confirmed'
  | 'appointment_reminder'
  | 'payment_received'
  | 'welcome'
  | 'daily_briefing'
  | 'profile_updated'
  | 'reschedule_request'
  | 'cancel_request'
  | 'treatment_plan_ready'
  | 'prescription_added';

export interface AppNotification {
  id: string;
  recipientId: string;          // userId or 'all-admins'
  recipientRole: 'admin' | 'client';
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, string>;
}

// ── Templates ───────────────────────────────────────────────────────────────
// Reusable text snippets the clinic can insert into notes/messages/emails.
export type TemplateCategory = 'note' | 'message' | 'email';

export interface Template {
  id: string;
  title: string;
  body: string;
  category: TemplateCategory;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

// ── Tasks ───────────────────────────────────────────────────────────────────
// Lightweight admin to-do items. Can be tied to a patient or standalone.
export type TaskStatus = 'open' | 'done' | 'snoozed';
export type TaskPriority = 'normal' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;             // ISO date (yyyy-mm-dd)
  assigneeId?: string;          // userId of the admin/doctor responsible
  assigneeName?: string;
  clientId?: string;            // optional patient link
  clientName?: string;
  createdBy: string;            // userId of admin who created it
  createdAt: string;
  completedAt?: string;
  snoozedUntil?: string;
}

// ── Treatment catalogue ─────────────────────────────────────────────────────
// Drives the booking flow: picking a treatment auto-fills duration, price,
// and deposit. Stored in Firestore `treatments/` so admins can edit without
// a deploy. Refund policy maps to the clinic's cancellation policy doc:
//   - 'prp'     → 48h+: full refund, <48h: non-refundable, reschedule x2
//   - 'exosome' → 48h+: 65% refund (35% non-refundable cost), <48h: non-refundable
//   - 'consult' → 48h+: full refund of deposit
export interface Treatment {
  id: string;
  name: string;
  description?: string;
  /** Slot length in minutes */
  durationMin: number;
  /** Full price in pence (avoids floating point — £580 → 58000) */
  fullPricePence: number;
  /** Percentage of fullPricePence collected as deposit at booking (0–100) */
  depositPct: number;
  refundPolicy: 'prp' | 'exosome' | 'consult';
  /** Optional default clinician — admin can override per booking */
  defaultClinicianId?: string;
  /** Treatment-mix category for analytics + AI recommendations */
  category?: 'consultation' | 'prp' | 'prf' | 'exosome' | 'microneedling' | 'combo';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ── Working hours config ────────────────────────────────────────────────────
// Stored at `settings/working_hours`. Drives the "outside hours" warning in
// the booking modal and the calendar's available-slot rendering.
export interface WorkingHoursConfig {
  // Days are 0 (Sun) – 6 (Sat). null/missing means closed that day.
  hours: Partial<Record<0|1|2|3|4|5|6, { open: string; close: string } | null>>;
  /** Default slot duration in minutes (for free slots in the calendar) */
  defaultSlotMin: number;
  /** Buffer between back-to-back appointments in minutes */
  bufferMin: number;
}