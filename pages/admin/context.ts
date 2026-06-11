import { createContext, useContext, RefObject } from 'react';
import {
  Page, User, Client, Appointment, Message, GalleryItem,
  AdminType, AppNotification, TreatmentPlan, Prescription, Payment, Task, Template,
} from '../../types';

export type AdminTab =
  | 'today'
  | 'inbox'
  | 'schedule'      // was: 'calendar' — renamed for clarity (industry terminology)
  | 'patients'
  | 'practice'      // new — absorbs former 'money' / 'insights' / 'marketing'
  | 'platform-health';

/** Sub-tabs inside the Practice section. */
export type PracticeTab = 'overview' | 'money' | 'insights' | 'marketing' | 'operations';
export type ClientRecordTab = 'overview' | 'communications' | 'forms' | 'gallery' | 'assessment' | 'treatment' | 'financials';
export type AppointmentView = 'list' | 'calendar';

export type CalendarDay = { day: number; month: number; year: number; currentMonth: boolean };

// ── External props forwarded from App ──────────────────────────────────────
export interface AdminPageProps {
  user: User | null;
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  clients: Client[];
  appointments: Appointment[];
  messages: Message[];
  onAddAppointment: (appointment: Appointment) => void;
  onUpdateAppointment: (id: string, updates: Partial<Appointment>) => void;
  onDeleteAppointment: (id: string) => void;
  onSendMessage: (message: Omit<Message, 'id'>) => Promise<void>;
  onMarkMessageRead: (id: string) => Promise<void>;
  onUpdateMessage: (id: string, updates: Partial<Message>) => Promise<void>;
  onUpdateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => Promise<void>;
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  templates: Template[];
  onAddTemplate: (tpl: Omit<Template, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
  onUpdateTemplate: (id: string, updates: Partial<Template>) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;

  /** Preview mode controls — admin can toggle into the dummy patient view. */
  viewAsTestPatient?: boolean;
  onSetViewAsTestPatient?: (next: boolean) => void;
  /** Tech admin only — seeds/resets the dummy patient's Firestore data. */
  onSeedDummyPatient?: () => Promise<void>;
}

// ── Full context value ─────────────────────────────────────────────────────
export interface AdminContextValue extends AdminPageProps {
  // UI state
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  practiceTab: PracticeTab;
  setPracticeTab: (tab: PracticeTab) => void;
  effectiveAdminType: AdminType | 'all';
  setEffectiveAdminType: (t: AdminType | 'all') => void;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  clientRecordTab: ClientRecordTab;
  setClientRecordTab: (tab: ClientRecordTab) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  lightboxImage: GalleryItem | null;
  setLightboxImage: (item: GalleryItem | null) => void;
  uploadProgress: number;
  setUploadProgress: (n: number) => void;
  showBookingModal: boolean;
  setShowBookingModal: (show: boolean) => void;
  appointmentView: AppointmentView;
  setAppointmentView: (view: AppointmentView) => void;
  currentCalendarDate: Date;
  setCurrentCalendarDate: (d: Date) => void;
  viewingForm: Message | null;
  setViewingForm: (msg: Message | null) => void;
  bookingForm: Partial<Appointment>;
  setBookingForm: React.Dispatch<React.SetStateAction<Partial<Appointment>>>;
  threadSearch: string;
  setThreadSearch: (s: string) => void;
  showQuickActions: boolean;
  setShowQuickActions: (show: boolean) => void;
  selectedThreadId: string | null;
  setSelectedThreadId: (id: string | null) => void;
  showOnlyAssigned: boolean;
  setShowOnlyAssigned: (show: boolean) => void;
  showAccountSwitcher: boolean;
  setShowAccountSwitcher: (show: boolean) => void;
  triageSelectedId: string | null;
  setTriageSelectedId: (id: string | null) => void;
  isUploading: boolean;
  setIsUploading: (v: boolean) => void;
  showGalleryUpload: boolean;
  setShowGalleryUpload: (show: boolean) => void;
  galleryUploadFile: File | null;
  setGalleryUploadFile: (f: File | null) => void;
  galleryUploadLabel: string;
  setGalleryUploadLabel: (s: string) => void;
  galleryUploadPreview: string | null;
  setGalleryUploadPreview: (s: string | null) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  cameraInputRef: RefObject<HTMLInputElement | null>;

  // Derived / computed
  selectedClient: Client | undefined;
  filteredClients: Client[];
  filteredAppointments: Appointment[];
  messageThreads: Record<string, Message[]>;
  unreadCount: number;
  mockStats: Array<{ icon: string; value: string | number; label: string; tab: AdminTab }>;

  // Helpers
  formatDOB: (dob: string | undefined) => string;
  calculateAge: (dob: string | undefined) => string;
  getInitials: (name: string | undefined) => string;
  getFirstName: (name: string | undefined) => string;
  isAssignedToMe: (client: Client | undefined) => boolean;

  // Handlers
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSidebarClick: (id: AdminTab) => void;
  openBookingModal: (clientId?: string, prefill?: { date?: string; time?: string }) => void;
  handleBookingSubmit: (e: React.FormEvent) => void;
  handleSendForm: (formId: string) => Promise<void>;
  changeMonth: (offset: number) => void;
  getCalendarDays: () => CalendarDay[];

  // Clinical data handlers
  onSaveTreatmentPlan: (clientId: string, plan: TreatmentPlan) => Promise<void>;
  onAddPrescription: (clientId: string, rx: Prescription) => Promise<void>;
  onUpdatePrescription: (clientId: string, rxId: string, updates: Partial<Prescription>) => Promise<void>;
  onAddPayment: (clientId: string, payment: Payment) => Promise<void>;
  onUpdatePayment: (clientId: string, paymentId: string, updates: Partial<Payment>) => Promise<void>;
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdminContext(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdminContext must be used inside AdminPage');
  return ctx;
}
