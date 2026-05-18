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

// AI triage produced by the assessment Cloud Function. Doctor reviews, edits,
// and approves draftFeedback before sending to the patient.
export interface AITriage {
  generatedAt: string;
  model: string;
  promptVersion: string;
  impression: string;
  redFlags: string[];
  suitability: 'strong-candidate' | 'suitable-with-caveats' | 'not-suitable';
  suitabilityReason: string;
  recommendedTreatments: string[];
  draftFeedback: string;
  status: 'pending-review' | 'doctor-approved' | 'sent';
  usage?: { input: number; output: number };
  error?: string;
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
  internalNotes?: string;
  treatmentPlan?: TreatmentPlan;
  prescriptions?: Prescription[];
  payments?: Payment[];
  aiTriage?: AITriage;
  leadSource?: LeadSource;
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
  type: 'Initial Consultation' | 'Follow-up Consultation' | 'PRP Session' | 'EV-Enriched Plasma Session' | 'Hair Assessment' | 'Microneedling Session';
  date: string;
  time: string;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled' | 'No-Show';
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
  currency: string;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Refunded';
  dueDate?: string;
  paidDate?: string;
  reference?: string;
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
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface Treatment {
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
  | 'cancel_request';

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