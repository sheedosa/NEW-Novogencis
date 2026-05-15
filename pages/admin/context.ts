import { createContext, useContext, RefObject } from 'react';
import {
  Page, User, Client, Appointment, Message, GalleryItem,
  AdminType, AppNotification, TreatmentPlan, Prescription, Payment,
} from '../../types';

export type AdminTab = 'overview' | 'assessments' | 'clients' | 'appointments' | 'messages' | 'platform-health';
export type ClientRecordTab = 'overview' | 'communications' | 'forms' | 'gallery' | 'assessment' | 'treatment' | 'financials';
export type NotifFilter = 'all' | 'assessment' | 'message' | 'appointment';
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
}

// ── Full context value ─────────────────────────────────────────────────────
export interface AdminContextValue extends AdminPageProps {
  // UI state
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
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
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
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
  notifFilter: NotifFilter;
  setNotifFilter: (f: NotifFilter) => void;
  showMorningBriefing: boolean;
  setShowMorningBriefing: (show: boolean) => void;
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
  filteredNotifications: AppNotification[];
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
  handleNotificationClick: (n: AppNotification) => void;
  clearAll: () => void;
  handleSidebarClick: (id: AdminTab) => void;
  openBookingModal: (clientId?: string) => void;
  handleBookingSubmit: (e: React.FormEvent) => void;
  handleSendForm: (formId: string, clientId: string, clientEmail: string) => Promise<void>;
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
