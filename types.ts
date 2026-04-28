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
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled' | 'No-Show' | 'No Show';
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