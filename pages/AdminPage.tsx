import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Client, Appointment, Message, GalleryItem, AdminType, TreatmentPlan, TreatmentPhase, Prescription, Payment, Treatment, AppNotification, NotificationType } from '../types';
import { FORMS, PACKAGES, getPackage, formatPackagePrice } from '../constants';
import { InteractiveForm } from '../components/InteractiveForm';
import Logo from '../components/Logo';
import { storage, db, cleanData } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, onSnapshot, query, where, doc, updateDoc, arrayUnion, runTransaction } from 'firebase/firestore';
import {
  Camera, Upload, X, PanelLeftClose, PanelLeftOpen, Menu, Search, Bell,
  LogOut, Sun, CalendarDays, Settings, ChevronsUpDown, Eye,
  Users, Calendar as CalendarIcon, HeartPulse, Inbox,
  Receipt, BarChart3, ListChecks, TrendingUp,
} from 'lucide-react';
import { Button, Modal, Input, Select, Textarea, SidebarItem as UISidebarItem, CommandPalette, useToast, BottomNav } from '../components/ui';
import type { CommandItem } from '../components/ui';
import { processImageForUpload, validateImageFile, ACCEPTED_IMAGE_TYPES } from '../imageUtils';
import { logClinicalAction } from '../utils/auditLogger';
import { notifyPaymentSent, notifyTreatmentPlanReady, notifyPrescriptionAdded } from '../utils/notificationService';
import { parseTime12h, formatMinutes12h, localTodayISO } from '../utils/time';
import { DUMMY_PATIENT } from '../utils/dummyPatient';

import {
  AdminContext,
  AdminPageProps,
  AdminTab,
  ClientRecordTab,
  PracticeTab,
  CalendarDay,
} from './admin/context';
import SettingsDrawer from './admin/SettingsDrawer';
import TodayPanel from './admin/panels/TodayPanel';
import InboxPanel from './admin/panels/InboxPanel';
import CalendarPanel from './admin/panels/CalendarPanel';
import ClientsPanel from './admin/panels/ClientsPanel';
import PracticePanel from './admin/panels/PracticePanel';
import PlatformHealthPanel from './admin/panels/PlatformHealthPanel';
import AdminNotificationsMenu from '../components/AdminNotificationsMenu';

/** Which patient-record tab each notification type deep-links to. */
const NOTIF_TAB: Partial<Record<NotificationType, ClientRecordTab>> = {
  new_assessment: 'overview',      // Snapshot holds the intake questionnaire
  feedback_received: 'overview',
  new_message: 'communications',
  form_signed: 'forms',
  payment_received: 'financials',
  treatment_plan_ready: 'treatment',
  prescription_added: 'treatment',
};

const AdminPage: React.FC<AdminPageProps> = ({
  user, onLogout, onNavigate,
  clients, appointments, messages, notifications,
  onAddAppointment, onUpdateAppointment, onDeleteAppointment,
  onSendMessage, onMarkMessageRead, onUpdateMessage, onUpdateClient,
  onMarkNotificationRead, onMarkAdminNotificationRead,
  tasks, onAddTask, onUpdateTask, onDeleteTask,
  templates, onAddTemplate, onUpdateTemplate, onDeleteTemplate,
  viewAsTestPatient, onSetViewAsTestPatient, onSeedDummyPatient,
}) => {
  const { toast } = useToast();
  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]                   = useState<AdminTab>('today');
  const [practiceTab, setPracticeTab]               = useState<PracticeTab>('overview');
  const [effectiveAdminType, setEffectiveAdminType] = useState<AdminType | 'all'>(user?.adminType || 'all');
  const [selectedClientId, setSelectedClientId]     = useState<string | null>(null);
  const [clientRecordTab, setClientRecordTab]       = useState<ClientRecordTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen]           = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [lightboxImage, setLightboxImage]           = useState<GalleryItem | null>(null);
  const [uploadProgress, setUploadProgress]         = useState(0);
  const [showBookingModal, setShowBookingModal]     = useState(false);
  const [showNotifications, setShowNotifications]   = useState(false);
  const [isSubmitting, setIsSubmitting]             = useState(false);
  const [appointmentView, setAppointmentView]       = useState<'list' | 'calendar'>('list');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [viewingForm, setViewingForm]               = useState<Message | null>(null);
  const [bookingForm, setBookingForm]               = useState<Partial<Appointment>>({
    type: 'Initial Consultation',
    status: 'Confirmed',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
  });
  // Treatments catalogue — drives BookingModal price/duration/deposit
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  useEffect(() => {
    const q = query(collection(db, 'treatments'), where('isActive', '==', true));
    return onSnapshot(q, snap => {
      setTreatments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Treatment))
        .sort((a, b) => (a.fullPricePence || 0) - (b.fullPricePence || 0)));
    });
  }, []);
  const [threadSearch, setThreadSearch]         = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [triageSelectedId, setTriageSelectedId] = useState<string | null>(null);
  // Track network status so we can warn the doctor when they go offline.
  // Firestore handles offline persistence transparently; this is purely a UI hint.
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  const [showCommandPalette, setShowCommandPalette]   = useState(false);
  const [showSettings, setShowSettings]               = useState(false);
  const [isUploading, setIsUploading]               = useState(false);
  const [showGalleryUpload, setShowGalleryUpload]   = useState(false);
  const [galleryUploadFile, setGalleryUploadFile]   = useState<File | null>(null);
  const [galleryUploadLabel, setGalleryUploadLabel] = useState('');
  const [galleryUploadPreview, setGalleryUploadPreview] = useState<string | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // "Book & add another" flag — set by the secondary submit button just before
  // the form submits; the submit handler reads + resets it to decide whether
  // to keep the booking modal open for the next patient.
  const bookAnotherRef = useRef(false);

  // ── Start-a-package flow ─────────────────────────────────────────────────
  const [showStartPackageModal, setShowStartPackageModal] = useState(false);
  const [startPackageForm, setStartPackageForm] = useState<{
    clientId?: string;
    packageId?: string;
    date: string;
    time: string;
    clinicianId?: string;
    notes?: string;
    collectNow: boolean;
  }>({
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    collectNow: true,
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatDOB = (dob: string | undefined) => {
    if (!dob) return 'N/A';
    const parts = dob.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dob;
  };

  const calculateAge = (dob: string | undefined) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return ` (${age} yrs)`;
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('');
  };

  const getFirstName = (name: string | undefined) => {
    if (!name) return '';
    return name.split(' ')[0];
  };

  // ── Assignment logic ───────────────────────────────────────────────────────
  const getEffectiveUser = useCallback(() => {
    if (!user) return null;
    if (user.adminType !== 'technical' || effectiveAdminType === 'all') return user;
    return { ...user, adminType: effectiveAdminType } as User;
  }, [user, effectiveAdminType]);

  // A client is "assigned" to an admin if they have at least one appointment
  // with that admin as the doctor. Technical admins are never assigned (they
  // don't see patients). Switching effectiveAdminType is a UI filter only —
  // assignment is always based on the actual user.id.
  const isAssignedToUser = useCallback((client: Client, targetUser: User | null) => {
    if (!targetUser) return false;
    if (targetUser.adminType === 'technical') return false;
    return appointments.some(a =>
      a.clientId === client.id &&
      (a.doctorId === targetUser.id || a.doctorName === targetUser.fullName),
    );
  }, [appointments]);

  const isAssignedToMe = useCallback((client: Client | undefined) => {
    if (!client) return false;
    return isAssignedToUser(client, user);
  }, [user, isAssignedToUser]);

  // ── Gallery upload ─────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { toast.error(error); e.target.value = ''; return; }
    setGalleryUploadFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setGalleryUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleGalleryUpload = async (clientId: string) => {
    if (!galleryUploadFile) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const { blob, fileName } = await processImageForUpload(galleryUploadFile);
      const storageRef = ref(storage, `gallery/${clientId}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });
      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
          reject,
          resolve,
        );
      });
      const downloadURL = await getDownloadURL(storageRef);
      const newItem: GalleryItem = {
        id: `admin-${crypto.randomUUID()}`,
        url: downloadURL,
        label: galleryUploadLabel || 'Progress Photo',
        uploadedAt: new Date().toISOString(),
        source: 'Clinical',
      };
      // Use arrayUnion to avoid race conditions when two admins upload concurrently
      try {
        await updateDoc(doc(db, 'clients', clientId), { gallery: arrayUnion(newItem) });
      } catch (writeError) {
        // The upload succeeded but the Firestore write failed — clean up the
        // orphaned Storage object so we don't leave a dangling file.
        try {
          await deleteObject(storageRef);
        } catch {
          // Ignore cleanup failures — surface the original write error below.
        }
        throw writeError;
      }
      setShowGalleryUpload(false);
      setGalleryUploadFile(null);
      setGalleryUploadLabel('');
      setGalleryUploadPreview(null);
      setUploadProgress(0);
      toast.success('Photo uploaded');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to upload.';
      console.error('Gallery upload error:', error);
      toast.error('Upload failed', { description: msg });
    } finally {
      setIsUploading(false);
    }
  };

  // ── Computed / derived ────────────────────────────────────────────────────
  // Real (non-technical) admins never see the seeded demo patient — it must not
  // pollute the registry, Money totals, Inbox, or any count. Technical admins
  // (who seed/preview it) still see it.
  const showDemoPatient = user?.adminType === 'technical';

  const filteredClients = useMemo(() => {
    if (!user) return [];
    const base = showDemoPatient ? clients : clients.filter(c => c.id !== DUMMY_PATIENT.id);
    if (showOnlyAssigned && user.adminType !== 'technical') {
      return base.filter(c => isAssignedToUser(c, user));
    }
    return base;
  }, [clients, user, showOnlyAssigned, isAssignedToUser, showDemoPatient]);

  const filteredAppointments = useMemo(() => {
    if (!user) return [];
    const base = showDemoPatient ? appointments : appointments.filter(a => a.clientId !== DUMMY_PATIENT.id);
    if (showOnlyAssigned && user.adminType !== 'technical') {
      return base.filter(a => a.doctorId === user.id);
    }
    return base;
  }, [appointments, user, showOnlyAssigned, showDemoPatient]);

  const visibleMessages = useMemo(
    () => showDemoPatient
      ? messages
      : messages.filter(m => m.senderId !== DUMMY_PATIENT.id && m.recipientId !== DUMMY_PATIENT.id),
    [messages, showDemoPatient],
  );

  const messageThreads = useMemo(() => {
    const threads: Record<string, Message[]> = {};
    const effectiveUser = getEffectiveUser();
    visibleMessages.forEach(msg => {
      const isSenderClient = clients.some(c => c.id === msg.senderId);
      const clientId = isSenderClient ? msg.senderId : msg.recipientId;
      const client = clients.find(c => c.id === clientId);
      if (!client) return;
      if (user?.adminType === 'technical' && effectiveAdminType !== 'all') {
        if (!isAssignedToUser(client, effectiveUser)) return;
      } else if (showOnlyAssigned && !isAssignedToUser(client, effectiveUser)) return;
      if (!threads[clientId]) threads[clientId] = [];
      threads[clientId].push(msg);
    });
    return threads;
  }, [visibleMessages, user, clients, effectiveAdminType, showOnlyAssigned, getEffectiveUser, isAssignedToUser]);

  // Per-doctor unread: a shared 'all-admins' notification is unread for this
  // admin until their id is in readBy (see markAdminNotificationRead).
  const unreadCount = notifications.filter(n => !(n.readBy ?? []).includes(user?.id ?? '')).length;

  const selectedClient = filteredClients.find(c => c.id === selectedClientId);

  // ── Sidebar badge counts (computed once per render from filtered data) ────
  const today = localTodayISO();
  const todayBadge = filteredAppointments.filter(
    a => a.date === today && a.status !== 'Cancelled',
  ).length;
  const pendingTriageCount = filteredClients.filter(c => c.status === 'Assessment Submitted').length;
  const unreadFromClientsCount = visibleMessages.filter(m => !m.read && m.recipientId === 'admin').length;
  const unsignedFormsCount = visibleMessages.filter(m => m.type === 'form' && !m.isSigned).length;
  const pendingPaymentsCount = filteredClients.reduce(
    (acc, c) => acc + (c.payments || []).filter(p => p.status === 'Pending' || p.status === 'Overdue').length,
    0,
  );
  const openTaskCount = tasks.filter(
    t => t.status === 'open' && (!t.assigneeId || t.assigneeId === user?.id) &&
         (!t.snoozedUntil || t.snoozedUntil <= today),
  ).length;
  const inboxBadge = pendingTriageCount + unreadFromClientsCount + unsignedFormsCount + pendingPaymentsCount + openTaskCount;
  const moneyBadge = pendingPaymentsCount;

  const mockStats = useMemo(() => {
    // `today` captured at memo time so the count is always today's date
    // (avoids stale memoization across day boundaries during long sessions).
    const todayIso = localTodayISO();
    return [
      { label: 'Assessments Today', value: filteredClients.filter(c => c.status === 'Assessment Submitted').length.toString(), trend: 'New', icon: 'assignment', tab: 'inbox' as AdminTab },
      { label: 'Appointments Today', value: filteredAppointments.filter(a => a.date === todayIso).length.toString(), icon: 'event', tab: 'schedule' as AdminTab },
      { label: 'Active Clients', value: filteredClients.filter(c => c.status === 'Active' || c.status === 'Ongoing' || c.status === 'Converted').length.toString(), trend: 'Total', icon: 'groups', tab: 'patients' as AdminTab },
    ];
  }, [filteredClients, filteredAppointments, today]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSidebarClick = (id: AdminTab) => {
    setActiveTab(id);
    setSelectedClientId(null);
    setIsSidebarOpen(false);
  };

  /**
   * Deep-link straight to a patient record. Unlike handleSidebarClick (which
   * nulls the selection for sidebar nav), this SELECTS the patient and lands on
   * the Patients section — optionally on a specific record sub-tab. This is the
   * correct opener for every attention → record jump (Inbox, Today, Money…).
   */
  const openPatient = useCallback((clientId: string, tab?: ClientRecordTab) => {
    setActiveTab('patients');
    setSelectedClientId(clientId);
    if (tab) setClientRecordTab(tab);
    setIsSidebarOpen(false);
  }, []);

  /** Open a notification: mark it read for THIS doctor + deep-link to its record. */
  const handleNotificationOpen = (n: AppNotification) => {
    if (user?.id) onMarkAdminNotificationRead(n.id, user.id);
    setShowNotifications(false);
    const clientId = n.metadata?.clientId;
    if (clientId) openPatient(clientId, NOTIF_TAB[n.type]);
    else setActiveTab('inbox');
  };
  const handleMarkAllNotificationsRead = () => {
    if (!user?.id) return;
    notifications
      .filter(n => !(n.readBy ?? []).includes(user.id))
      .forEach(n => onMarkAdminNotificationRead(n.id, user.id));
  };

  // ── Booking helpers ────────────────────────────────────────────────────────
  // Clinicians available for appointment delivery. Hardcoded for now (2-doctor
  // clinic); could be derived from /users where role=admin && adminType≠technical
  // when the clinic grows.
  const CLINICIANS = useMemo(() => [
    { id: 'aminah', name: 'Dr Aminah Amer',  adminType: 'doctor-female' as const },
    { id: 'waqas',  name: 'Dr Waqas Farid',  adminType: 'doctor-male'   as const },
  ], []);

  // parseTime12h + formatMinutes12h are imported from utils/time (shared).

  /**
   * Returns the conflicting appointment (if any) for a proposed booking.
   * Two appointments conflict when they share clinician + date and their
   * [start, end) windows overlap. We exclude cancelled/no-show appointments
   * and the appointment being rescheduled (excludeId).
   */
  const findConflict = useCallback((proposed: {
    clinicianId?: string;
    date?: string;
    time?: string;
    durationMin?: number;
  }, excludeId?: string): Appointment | null => {
    if (!proposed.clinicianId || !proposed.date || !proposed.time) return null;
    const start = parseTime12h(proposed.time);
    if (start === null) return null;
    const end = start + (proposed.durationMin ?? 30);
    for (const apt of appointments) {
      if (apt.id === excludeId) continue;
      if (apt.clinicianId !== proposed.clinicianId) continue;
      if (apt.date !== proposed.date) continue;
      if (apt.status === 'Cancelled' || apt.status === 'No-Show') continue;
      const aStart = parseTime12h(apt.time);
      if (aStart === null) continue;
      const aEnd = aStart + (apt.durationMin ?? 30);
      if (start < aEnd && end > aStart) return apt;
    }
    return null;
  }, [appointments]);

  const openBookingModal = (
    clientId?: string,
    prefill?: { date?: string; time?: string; phaseId?: string; isPlanSession?: boolean },
  ) => {
    setBookingForm(prev => {
      const next: Partial<Appointment> = { ...prev };
      if (clientId) {
        const client = filteredClients.find(c => c.id === clientId);
        next.clientId = clientId;
        next.clientName = client?.name;
      }
      if (prefill?.isPlanSession && clientId) {
        // Plan follow-up: continue from the client's last session. Copy the
        // clinician/slot, suggest the next date, and mark it a price-free plan
        // session (no deposit, straight to Confirmed).
        next.isPlanSession = true;
        next.phaseId = prefill.phaseId;
        next.status = 'Confirmed';
        next.treatmentId = undefined; // no price/deposit attached to plan sessions

        // Resolve the phase + its package (when it's a purchased package phase).
        const planClient = clients.find(c => c.id === clientId);
        const phase = planClient?.treatmentPlan?.phases.find(p => p.id === prefill.phaseId);
        const pkg = getPackage(phase?.packageId);

        const prior = appointments
          .filter(a => a.clientId === clientId && a.status !== 'Cancelled' && a.status !== 'No-Show')
          .sort((a, b) => a.date !== b.date
            ? b.date.localeCompare(a.date)
            : (parseTime12h(b.time) ?? 0) - (parseTime12h(a.time) ?? 0));
        const last = prior.find(a => a.phaseId === prefill.phaseId) ?? prior[0];
        // Copy clinician + slot time from the last session as sensible defaults.
        if (last) {
          next.clinicianId = last.clinicianId;
          next.time = last.time;
        }

        if (pkg && phase) {
          // Package phase: choose the session type by position (the exosome
          // visit lands at its slot for Elite tiers) and suggest the package's
          // own cadence rather than a flat +4 weeks.
          const upcoming = appointments.filter(a =>
            a.clientId === clientId && a.phaseId === phase.id &&
            (a.status === 'Confirmed' || a.status === 'Pending') &&
            a.date >= localTodayISO()).length;
          const nextNum = Math.min(phase.sessionsCompleted + upcoming + 1, phase.sessionsPlanned);
          if (pkg.exosome && nextNum === pkg.exosome.position) {
            next.type = pkg.exosome.type;
            next.durationMin = pkg.exosome.durationMin;
          } else {
            next.type = pkg.session.type;
            next.durationMin = pkg.session.durationMin;
          }
          const base = last?.date ?? localTodayISO();
          const d = new Date(`${base}T00:00:00`);
          d.setDate(d.getDate() + pkg.cadenceWeeks[0] * 7); // package cadence (min weeks)
          next.date = d.toLocaleDateString('en-CA'); // local date — avoids BST UTC roll-back
        } else if (last) {
          // Legacy ad-hoc phase: copy the last session type, suggest +4 weeks.
          next.type = last.type;
          next.durationMin = last.durationMin;
          const d = new Date(`${last.date}T00:00:00`);
          d.setDate(d.getDate() + 28);
          next.date = d.toLocaleDateString('en-CA'); // local date — avoids BST UTC roll-back
        }
      } else {
        next.isPlanSession = undefined;
        next.phaseId = undefined;
        if (prefill?.date) next.date = prefill.date;
        if (prefill?.time) next.time = prefill.time;
      }
      return next;
    });
    setShowBookingModal(true);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!(bookingForm.clientId && bookingForm.date && bookingForm.time && bookingForm.type)) return;

    // Conflict check — refuse silently overlapping bookings.
    const conflict = findConflict({
      clinicianId: bookingForm.clinicianId,
      date: bookingForm.date,
      time: bookingForm.time,
      durationMin: bookingForm.durationMin,
    });
    if (conflict) {
      const clinicianName = CLINICIANS.find(c => c.id === bookingForm.clinicianId)?.name ?? 'this clinician';
      toast.error('Booking conflict', {
        description: `${clinicianName} already has "${conflict.type}" with ${conflict.clientName} at ${conflict.time} on ${conflict.date}. Pick a different time or clinician.`,
        duration: 8000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Plan follow-up sessions are price-free — no deposit, straight to
      // Confirmed, linked to the plan phase. Everything else keeps the deposit
      // follow-through (park in 'Awaiting deposit' until the deposit is taken).
      const isPlanSession = !!bookingForm.isPlanSession;
      const bookedTreatment = treatments.find(t => t.id === bookingForm.treatmentId);
      const bookedClientId = bookingForm.clientId;
      const depositPence = !isPlanSession && bookedTreatment && bookedTreatment.depositPct > 0
        ? Math.round((bookedTreatment.fullPricePence * bookedTreatment.depositPct) / 100)
        : 0;

      const client = filteredClients.find(c => c.id === bookingForm.clientId);
      const clinician = CLINICIANS.find(c => c.id === bookingForm.clinicianId);
      const newAppointment: Appointment = {
        id: '',
        clientId: bookingForm.clientId,
        clientName: client?.name || 'Unknown',
        doctorId: clinician ? bookingForm.clinicianId : user?.id,
        doctorName: clinician?.name ?? user?.fullName,
        type: bookingForm.type as Appointment['type'],
        date: bookingForm.date,
        time: bookingForm.time,
        // A deposit-bearing treatment can't be Confirmed until the deposit is
        // taken — park it in 'Awaiting deposit' and remember how much is due.
        status: depositPence > 0
          ? 'Awaiting deposit'
          : (bookingForm.status as Appointment['status']) || 'Confirmed',
        notes: bookingForm.notes || '',
        createdAt: new Date().toISOString(),
        durationMin: bookingForm.durationMin,
        treatmentId: isPlanSession ? undefined : bookingForm.treatmentId,
        clinicianId: bookingForm.clinicianId,
        ...(depositPence > 0 ? { depositPence } : {}),
        ...(bookingForm.phaseId ? { phaseId: bookingForm.phaseId } : {}),
        ...(isPlanSession ? { isPlanSession: true } : {}),
      };
      await onAddAppointment(newAppointment);

      const depositAction = depositPence > 0 && bookedClientId
        ? {
            description: `${client?.name || 'Patient'} — ${bookingForm.date} at ${bookingForm.time}. Deposit due: £${(depositPence / 100).toFixed(2)}.`,
            action: {
              label: 'Open Money tab',
              onClick: () => {
                setShowBookingModal(false);
                setSelectedClientId(bookedClientId);
                setClientRecordTab('financials');
                setActiveTab('patients');
              },
            },
            duration: 8000,
          }
        : null;

      if (bookAnotherRef.current) {
        // Keep the modal open for back-to-back booking: same treatment +
        // clinician, fresh patient/date/time.
        bookAnotherRef.current = false;
        setBookingForm(prev => ({
          type: prev.type,
          treatmentId: prev.treatmentId,
          durationMin: prev.durationMin,
          clinicianId: prev.clinicianId,
          status: 'Confirmed',
          date: new Date().toISOString().split('T')[0],
          time: '10:00 AM',
          notes: '',
        }));
        toast.success('Appointment booked', depositAction ?? { description: `${client?.name || 'Patient'} booked — pick the next patient.` });
      } else {
        setShowBookingModal(false);
        setBookingForm({ type: 'Initial Consultation', status: 'Confirmed', date: new Date().toISOString().split('T')[0], time: '10:00 AM' });
        toast.success('Appointment booked', depositAction ?? { description: `${client?.name || 'Patient'} — ${bookingForm.date} at ${bookingForm.time}.` });
      }
    } catch {
      toast.error('Could not book the appointment', {
        description: 'Something went wrong while saving. Please try again.',
        duration: 8000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openStartPackageModal = (clientId?: string) => {
    setStartPackageForm({
      clientId,
      packageId: undefined,
      date: localTodayISO(),
      time: '10:00 AM',
      clinicianId: undefined,
      notes: '',
      collectNow: true,
    });
    setShowStartPackageModal(true);
  };

  /**
   * Starts a treatment package in one action: creates the course as a plan
   * phase, books Session 1 as a price-free plan session, and records the
   * FULL package price up front. Every later session is added price-free via
   * "Book next session" and linked to this phase.
   */
  const handleStartPackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const { clientId, packageId, date, time, clinicianId, notes, collectNow } = startPackageForm;
    if (!clientId || !packageId || !date || !time || !clinicianId) return;
    const pkg = getPackage(packageId);
    if (!pkg) return;

    // Conflict-check Session 1 before writing anything.
    const conflict = findConflict({ clinicianId, date, time, durationMin: pkg.session.durationMin });
    if (conflict) {
      const clinicianName = CLINICIANS.find(c => c.id === clinicianId)?.name ?? 'this clinician';
      toast.error('Booking conflict', {
        description: `${clinicianName} already has "${conflict.type}" with ${conflict.clientName} at ${conflict.time} on ${conflict.date}. Pick a different time or clinician.`,
        duration: 8000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const client = clients.find(c => c.id === clientId);
      const clinician = CLINICIANS.find(c => c.id === clinicianId);
      const now = new Date().toISOString();
      const phaseId = `phase-${crypto.randomUUID()}`;

      // 1. Create/append the package as an Active plan phase.
      const newPhase: TreatmentPhase = {
        id: phaseId,
        name: pkg.name,
        description: pkg.marketing.subtitle,
        status: 'Active',
        sessionsPlanned: pkg.sessionsPlanned,
        sessionsCompleted: 0,
        packageId: pkg.id,
        pricePence: pkg.pricePence,
        startDate: localTodayISO(),
        notes: '',
      };
      const existingPlan = client?.treatmentPlan;
      const updatedPlan: TreatmentPlan = existingPlan
        ? { ...existingPlan, phases: [...existingPlan.phases, newPhase], updatedAt: now }
        : { id: `plan-${crypto.randomUUID()}`, clientId, title: 'Treatment Plan', phases: [newPhase], createdAt: now };
      await onSaveTreatmentPlan(clientId, updatedPlan);

      // 2. Book Session 1 as a price-free plan session (base modality — the
      //    exosome is Session 2, never Session 1).
      const session1: Appointment = {
        id: '',
        clientId,
        clientName: client?.name || 'Unknown',
        doctorId: clinicianId,
        doctorName: clinician?.name,
        type: pkg.session.type,
        date,
        time,
        status: 'Confirmed',
        notes: notes || '',
        createdAt: now,
        durationMin: pkg.session.durationMin,
        clinicianId,
        phaseId,
        isPlanSession: true,
      };
      await onAddAppointment(session1);

      // 3. Record the FULL-price up-front package payment, linked to the phase.
      const payment: Payment = {
        id: `pay-${crypto.randomUUID()}`,
        description: `${pkg.name} package (${pkg.sessionsPlanned} sessions)`,
        amount: pkg.pricePence / 100,
        amountPence: pkg.pricePence,
        currency: 'GBP',
        status: collectNow ? 'Paid' : 'Pending',
        type: 'standalone',
        phaseId,
        packageId: pkg.id,
        ...(collectNow ? { paidDate: localTodayISO() } : {}),
        createdAt: now,
      };
      await onAddPayment(clientId, payment);

      setShowStartPackageModal(false);
      toast.success('Package started', {
        description: `${pkg.name} for ${client?.name || 'the patient'} — Session 1 booked and ${formatPackagePrice(pkg.pricePence)} recorded as ${collectNow ? 'paid' : 'pending'}. Book the remaining sessions from the treatment plan.`,
        duration: 8000,
      });
    } catch {
      toast.error('Could not start the package', {
        description: 'Something went wrong while saving. Please review the treatment plan and try again.',
        duration: 8000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Treatment plan / prescriptions / payments ──────────────────────────────
  const onSaveTreatmentPlan = async (clientId: string, plan: TreatmentPlan) => {
    // Capture BEFORE the write: notify only on the plan's first phases,
    // not on every subsequent edit.
    const existingClient = clients.find(c => c.id === clientId);
    const isFirstPlan = !existingClient?.treatmentPlan?.phases?.length;
    await onUpdateClient(clientId, { treatmentPlan: plan });
    await logClinicalAction(user?.id || 'admin', 'save_treatment_plan', clientId, `Saved treatment plan: ${plan.title}`);
    if (isFirstPlan && plan.phases?.length && existingClient) {
      try {
        await notifyTreatmentPlanReady(clientId, existingClient.email, existingClient.name, plan.title);
      } catch (err) {
        console.error('Plan notification failed (non-blocking):', err);
      }
    }
  };

  const onAddPrescription = async (clientId: string, rx: Prescription) => {
    const client = clients.find(c => c.id === clientId);
    const existing = client?.prescriptions || [];
    await onUpdateClient(clientId, { prescriptions: [...existing, rx] });
    await logClinicalAction(user?.id || 'admin', 'add_prescription', clientId, `Added prescription: ${rx.drugName}`);
    if (client) {
      try {
        await notifyPrescriptionAdded(clientId, client.email, client.name, rx.drugName);
      } catch (err) {
        console.error('Prescription notification failed (non-blocking):', err);
      }
    }
  };

  // Payments + prescriptions are single nested ARRAY fields on the client doc, so
  // a read-modify-write from a stale render snapshot would clobber a concurrent
  // change (e.g. the Stripe webhook flipping a deposit to Paid, or two admins).
  // Run these in a transaction that re-reads the live array. (Also closes the
  // audit-trail gap on prescription/payment edits.)
  const onUpdatePrescription = async (clientId: string, rxId: string, updates: Partial<Prescription>) => {
    const ref = doc(db, 'clients', clientId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const existing = (snap.data()?.prescriptions as Prescription[] | undefined) || [];
        tx.update(ref, cleanData({ prescriptions: existing.map(r => r.id === rxId ? { ...r, ...updates } : r) }));
      });
      await logClinicalAction(user?.id || 'admin', 'update_prescription', clientId, `Updated prescription ${rxId}`);
    } catch {
      toast.error('Could not update the prescription', { description: 'Please try again.' });
    }
  };

  const onAddPayment = async (clientId: string, payment: Payment) => {
    const ref = doc(db, 'clients', clientId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const existing = (snap.data()?.payments as Payment[] | undefined) || [];
        tx.update(ref, cleanData({ payments: [...existing, payment] }));
      });
    } catch {
      toast.error('Could not save the payment', { description: 'Please try again.' });
      return;
    }
    await logClinicalAction(user?.id || 'admin', 'add_payment', clientId, `Added payment: ${payment.description} £${payment.amount}`);
    if (payment.status === 'Pending') {
      try {
        const client = clients.find(c => c.id === clientId);
        await notifyPaymentSent(clientId, client?.email || '', client?.name || '', `£${payment.amount}`);
      } catch { /* non-critical */ }
    }
  };

  const onUpdatePayment = async (clientId: string, paymentId: string, updates: Partial<Payment>) => {
    const ref = doc(db, 'clients', clientId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const existing = (snap.data()?.payments as Payment[] | undefined) || [];
        tx.update(ref, cleanData({ payments: existing.map(p => p.id === paymentId ? { ...p, ...updates } : p) }));
      });
      await logClinicalAction(user?.id || 'admin', 'update_payment', clientId, `Updated payment ${paymentId}${updates.status ? ` → ${updates.status}` : ''}`);
    } catch {
      toast.error('Could not update the payment', { description: 'Please try again.' });
    }
  };

  const handleSendForm = async (formId: string) => {
    if (!selectedClientId) return;
    const form = FORMS.find(f => f.id === formId);
    if (!form) return;
    try {
      await onSendMessage({
        senderId: user?.id || 'admin',
        recipientId: selectedClientId,
        subject: `Form: ${form.title}`,
        body: `Please review and sign the following form: ${form.title}`,
        type: 'form',
        formId: form.id,
        isSigned: false,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to send form:', error);
      toast.error('Failed to send form', { description: 'Please try again.' });
    }
  };

  const changeMonth = (offset: number) => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const getCalendarDays = (): CalendarDay[] => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const days: CalendarDay[] = [];
    for (let i = firstDay - 1; i >= 0; i--) days.push({ day: daysInPrev - i, month: month - 1, year, currentMonth: false });
    for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, month, year, currentMonth: true });
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) days.push({ day: i, month: month + 1, year, currentMonth: false });
    return days;
  };

  // Cmd+K / Ctrl+K opens the command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowCommandPalette(s => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Build the command palette items: navigation + actions + every patient
  const commandItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      { id: 'nav-today',     group: 'Navigate', icon: <Sun size={13} />,              label: 'Go to Today',                onSelect: () => setActiveTab('today') },
      { id: 'nav-inbox',     group: 'Navigate', icon: <Inbox size={13} />,            label: 'Go to Inbox',                onSelect: () => setActiveTab('inbox') },
      { id: 'nav-schedule',  group: 'Navigate', icon: <CalendarIcon size={13} />,     label: 'Go to Schedule',             onSelect: () => setActiveTab('schedule') },
      { id: 'nav-patients',  group: 'Navigate', icon: <Users size={13} />,            label: 'Go to Patients',             onSelect: () => setActiveTab('patients') },
      { id: 'nav-practice',  group: 'Navigate', icon: <BarChart3 size={13} />,        label: 'Go to Practice',             onSelect: () => setActiveTab('practice') },
      { id: 'nav-money',     group: 'Navigate', icon: <Receipt size={13} />,          label: 'Go to Money',                onSelect: () => { setActiveTab('practice'); setPracticeTab('money'); } },
      { id: 'nav-insights',  group: 'Navigate', icon: <BarChart3 size={13} />,        label: 'Go to Insights',             onSelect: () => { setActiveTab('practice'); setPracticeTab('insights'); } },
      { id: 'nav-marketing', group: 'Navigate', icon: <TrendingUp size={13} />,       label: 'Go to Marketing',            onSelect: () => { setActiveTab('practice'); setPracticeTab('marketing'); } },
      { id: 'act-book',      group: 'Actions',  icon: <CalendarDays size={13} />,     label: 'Book a new appointment',     onSelect: () => setShowBookingModal(true) },
      { id: 'act-settings',  group: 'Actions',  icon: <Settings size={13} />,         label: 'Open settings',              onSelect: () => setShowSettings(true) },
      { id: 'act-logout',    group: 'Actions',  icon: <LogOut size={13} />,           label: 'Sign out',                   onSelect: () => onLogout() },
    ];
    // Patients (limit to first 50 to keep the list snappy)
    filteredClients.slice(0, 50).forEach(c => {
      items.push({
        id: `client-${c.id}`,
        group: 'Patients',
        icon: <Users size={13} />,
        label: c.name || 'Unnamed patient',
        keywords: [c.email, c.phone, c.id, c.status].filter(Boolean) as string[],
        hint: c.status,
        onSelect: () => {
          setActiveTab('patients');
          setSelectedClientId(c.id);
        },
      });
    });
    return items;
  }, [filteredClients, setActiveTab, setShowBookingModal, onLogout, setSelectedClientId]);

  // ── Context value ──────────────────────────────────────────────────────────
  // Memoised so consumer panels don't re-render when AdminPage re-renders for
  // unrelated reasons (e.g. App.tsx onSnapshot deltas to other collections).
  const ctx = React.useMemo(() => ({
    // Props
    user, onLogout, onNavigate, clients, appointments, messages: visibleMessages, notifications,
    onAddAppointment, onUpdateAppointment, onDeleteAppointment,
    onSendMessage, onMarkMessageRead, onUpdateMessage, onUpdateClient,
    onMarkNotificationRead, onMarkAdminNotificationRead,
    tasks, onAddTask, onUpdateTask, onDeleteTask,
    onSaveTreatmentPlan, onAddPrescription, onUpdatePrescription,
    onAddPayment, onUpdatePayment,
    clinicians: CLINICIANS,
    // State
    activeTab, setActiveTab,
    practiceTab, setPracticeTab,
    effectiveAdminType, setEffectiveAdminType,
    selectedClientId, setSelectedClientId,
    clientRecordTab, setClientRecordTab,
    isSidebarOpen, setIsSidebarOpen,
    isSidebarCollapsed, setIsSidebarCollapsed,
    lightboxImage, setLightboxImage,
    uploadProgress, setUploadProgress,
    showBookingModal, setShowBookingModal,
    appointmentView, setAppointmentView,
    currentCalendarDate, setCurrentCalendarDate,
    viewingForm, setViewingForm,
    bookingForm, setBookingForm,
    threadSearch, setThreadSearch,
    showQuickActions, setShowQuickActions,
    selectedThreadId, setSelectedThreadId,
    showOnlyAssigned, setShowOnlyAssigned,
    showAccountSwitcher, setShowAccountSwitcher,
    triageSelectedId, setTriageSelectedId,
    isUploading, setIsUploading,
    showGalleryUpload, setShowGalleryUpload,
    galleryUploadFile, setGalleryUploadFile,
    galleryUploadLabel, setGalleryUploadLabel,
    galleryUploadPreview, setGalleryUploadPreview,
    fileInputRef, cameraInputRef,
    // Computed
    selectedClient, filteredClients, filteredAppointments,
    messageThreads, unreadCount, mockStats,
    // Helpers
    formatDOB, calculateAge, getInitials, getFirstName, isAssignedToMe,
    // Handlers
    handleFileSelect,
    handleSidebarClick, openPatient, openBookingModal, openStartPackageModal, handleBookingSubmit,
    handleSendForm, changeMonth, getCalendarDays,
    // Templates
    templates, onAddTemplate, onUpdateTemplate, onDeleteTemplate,
    // Preview mode (view as test patient)
    viewAsTestPatient, onSetViewAsTestPatient, onSeedDummyPatient,
  }), [
    user, onLogout, onNavigate, clients, appointments, visibleMessages, notifications,
    onAddAppointment, onUpdateAppointment, onDeleteAppointment,
    onSendMessage, onMarkMessageRead, onUpdateMessage, onUpdateClient,
    onMarkNotificationRead, onMarkAdminNotificationRead, openPatient,
    tasks, onAddTask, onUpdateTask, onDeleteTask,
    onSaveTreatmentPlan, onAddPrescription, onUpdatePrescription,
    onAddPayment, onUpdatePayment, CLINICIANS,
    activeTab, practiceTab, effectiveAdminType, selectedClientId, clientRecordTab,
    isSidebarOpen, isSidebarCollapsed, lightboxImage,
    uploadProgress, showBookingModal, appointmentView, currentCalendarDate,
    viewingForm, bookingForm, threadSearch, showQuickActions, selectedThreadId,
    showOnlyAssigned, showAccountSwitcher, triageSelectedId,
    isUploading, showGalleryUpload, galleryUploadFile,
    galleryUploadLabel, galleryUploadPreview,
    selectedClient, filteredClients, filteredAppointments,
    messageThreads, unreadCount, mockStats,
    isAssignedToMe, handleFileSelect,
    handleSidebarClick, openBookingModal, openStartPackageModal, handleBookingSubmit,
    handleSendForm, getCalendarDays,
    templates, onAddTemplate, onUpdateTemplate, onDeleteTemplate,
    viewAsTestPatient, onSetViewAsTestPatient, onSeedDummyPatient,
  ]);

  // ── Panel selector ─────────────────────────────────────────────────────────
  const renderPanel = () => {
    switch (activeTab) {
      case 'today':           return <TodayPanel />;
      case 'inbox':           return <InboxPanel />;
      case 'schedule':        return <CalendarPanel />;
      case 'patients':        return <ClientsPanel />;
      case 'practice':        return <PracticePanel />;
      case 'platform-health': return <PlatformHealthPanel />;
      default: return (
        <div className="py-20 md:py-32 text-center">
          <Settings size={48} className="text-primary/20 mb-4 mx-auto" />
          <p className="text-[11px] font-medium text-muted uppercase">Module under development</p>
        </div>
      );
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AdminContext.Provider value={ctx}>
      <div className="portal-shell admin-elevated font-sans selection:bg-primary/20">
        {/* Sidebar */}
        <aside className={`portal-sidebar ${isSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="flex items-center justify-between mb-4 px-2">
            {!isSidebarCollapsed ? (
              <Logo size="sm" className="!justify-start scale-75 -ml-3" />
            ) : (
              <div className="w-8 h-8 rounded-md bg-obsidian text-primary flex items-center justify-center text-xs font-medium font-serif">N</div>
            )}
            <div className="flex items-center">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden lg:inline-flex w-7 h-7 rounded-md text-muted hover:text-obsidian hover:bg-cream items-center justify-center transition-colors"
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              </button>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden w-10 h-10 inline-flex items-center justify-center text-muted hover:text-obsidian rounded-md">
                <X size={18} />
              </button>
            </div>
          </div>

          {!isSidebarCollapsed && (
            <p className="nav-section-label">Clinic</p>
          )}
          <nav className="flex flex-col gap-0.5">
            <UISidebarItem
              icon={<Sun size={15} />}
              label="Today"
              hint="Your daily landing — today's schedule at a glance"
              badge={todayBadge}
              active={activeTab === 'today' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('today')}
            />
            <UISidebarItem
              icon={<Inbox size={15} />}
              label="Inbox"
              hint="Everything that needs your attention — new assessments, messages, unsigned forms, overdue payments"
              badge={inboxBadge}
              active={activeTab === 'inbox' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('inbox')}
            />
            <UISidebarItem
              icon={<CalendarIcon size={15} />}
              label="Schedule"
              hint="Your appointments — day, week, and list views with status controls"
              active={activeTab === 'schedule' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('schedule')}
            />
            <UISidebarItem
              icon={<Users size={15} />}
              label="Patients"
              hint="Patient registry — search, smart filters, and full clinical records"
              active={activeTab === 'patients' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('patients')}
            />
          </nav>

          {!isSidebarCollapsed && <p className="nav-section-label mt-3">Practice</p>}
          <nav className="flex flex-col gap-0.5">
            <UISidebarItem
              icon={<BarChart3 size={15} />}
              label="Practice"
              hint="Business view — revenue, insights, marketing attribution, and clinic operations"
              badge={moneyBadge}
              active={activeTab === 'practice' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('practice')}
            />
            {user?.adminType === 'technical' && (
              <UISidebarItem
                icon={<HeartPulse size={15} />}
                label="Platform health"
                hint="Technical admin view — system status and developer tools"
                active={activeTab === 'platform-health' && !selectedClientId}
                collapsed={isSidebarCollapsed}
                onClick={() => handleSidebarClick('platform-health')}
              />
            )}
          </nav>

          {/* Settings sits between nav and the user profile block */}
          <div className="mt-2">
            <UISidebarItem
              icon={<Settings size={15} />}
              label="Settings"
              hint="Account preferences, message templates, staff list"
              active={false}
              collapsed={isSidebarCollapsed}
              onClick={() => setShowSettings(true)}
            />
          </div>

          <div className="mt-auto pt-4 border-t border-sand relative">
            {showAccountSwitcher && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-white rounded-lg border border-sand shadow-panel z-[60]"
              >
                {/* Tech admin can switch which doctor's workspace they're viewing */}
                {user?.adminType === 'technical' && (
                  <>
                    <p className="text-xs font-medium text-muted px-2 py-1 flex items-center gap-1.5">
                      <Eye size={13} /> View workspace as
                    </p>
                    <div className="flex flex-col gap-0.5 mt-1 mb-2">
                      {[
                        { id: 'all', label: 'All accounts' },
                        { id: 'doctor-female', label: 'Dr Aminah' },
                        { id: 'doctor-male', label: 'Dr Waqas' },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => { setEffectiveAdminType(mode.id as AdminType | 'all'); setShowAccountSwitcher(false); }}
                          className={`text-left px-2 py-1.5 rounded-sm text-sm transition-colors ${effectiveAdminType === mode.id ? 'bg-obsidian text-white' : 'text-obsidian hover:bg-cream'}`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                    <div className="h-px bg-sand my-1.5" />
                  </>
                )}
                {/* "View as test patient" moved to Settings → Preferences (Developer tools).
                    It used to live here, but doctors mis-clicked it and ended up in the patient
                    portal wondering what happened. */}
              </motion.div>
            )}
            <button
              onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
              className="w-full flex items-center gap-2.5 p-2 rounded-md text-left transition-colors hover:bg-cream cursor-pointer"
            >
              <div className="avatar avatar-sm">{getInitials(user?.fullName)}</div>
              {!isSidebarCollapsed && (
                <>
                  <div className="flex flex-col min-w-0 flex-grow">
                    <span className="text-sm font-medium text-obsidian truncate">{user?.fullName}</span>
                    <span className="text-xs text-muted truncate">
                      {user?.adminType === 'technical'
                        ? (effectiveAdminType === 'all' ? 'Technical admin' : effectiveAdminType === 'doctor-female' ? 'Viewing as Aminah' : 'Viewing as Waqas')
                        : user?.adminType === 'doctor-female' ? 'Clinical director' : user?.adminType === 'doctor-male' ? 'Clinical director' : 'System admin'}
                    </span>
                  </div>
                  <ChevronsUpDown size={13} className="text-hint shrink-0" />
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className={`portal-main ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {/* Offline banner — clarifies that anything saved while offline will
              sync once the connection returns. Firestore handles the actual
              queuing transparently; this is purely a visual reassurance. */}
          {!isOnline && (
            <div
              role="status"
              className="sticky top-0 z-40 px-4 py-2 bg-warning-bg text-warning-text border-b border-warning/20 text-xs font-medium flex items-center justify-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-warning-text animate-pulse" />
              You're offline. Changes will sync automatically when you're back online.
            </div>
          )}
          {/* Top bar */}
          <header className="portal-topbar">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-10 h-10 inline-flex items-center justify-center text-muted hover:text-obsidian rounded-md -ml-2">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted hidden sm:inline">Admin</span>
              <span className="text-hint hidden sm:inline">/</span>
              <span className="text-obsidian font-medium capitalize">
                {activeTab.replace('-', ' ')}
              </span>
            </div>
            {/* Always-visible patient search — primary entry point.
                On mobile this is icon-only to save space; on desktop it shows
                the full search input + ⌘K hint. */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 ml-4 rounded-md border border-sand bg-white hover:bg-cream text-muted hover:text-obsidian transition-colors min-w-[200px] md:min-w-[240px]"
              aria-label="Search patients & navigate"
            >
              <Search size={14} />
              <span className="text-sm text-hint flex-grow text-left">Search patients…</span>
              <span className="text-xs text-hint border border-sand rounded px-1 ml-auto">⌘K</span>
            </button>
            <button
              onClick={() => setShowCommandPalette(true)}
              className="sm:hidden btn-icon ml-2"
              aria-label="Search"
            >
              <Search size={15} />
            </button>
            <div className="ml-auto flex items-center gap-1">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(v => !v)}
                  className={`btn-icon relative ${showNotifications ? 'bg-cream text-obsidian' : ''}`}
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <Bell size={15} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-danger rounded-full text-[10px] font-medium text-white flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <AdminNotificationsMenu
                    notifications={notifications}
                    userId={user?.id ?? ''}
                    onOpenItem={handleNotificationOpen}
                    onMarkAllRead={handleMarkAllNotificationsRead}
                    onOpenInbox={() => { setShowNotifications(false); setActiveTab('inbox'); }}
                    onClose={() => setShowNotifications(false)}
                  />
                )}
              </div>
              <button onClick={onLogout} className="btn-icon" aria-label="Sign out">
                <LogOut size={15} />
              </button>
            </div>
          </header>

          <div className="portal-content mx-auto pb-20 lg:pb-4" data-scroll key={`${activeTab}-${selectedClientId || 'list'}`}>
            {/* Each panel applies its own `animate-fade-up` for a soft enter.
                AnimatePresence-wrapped transitions caused stuck opacity:0 states
                when rapid tab clicks interrupted mid-flight animations. */}
            {renderPanel()}
          </div>

          {/* Mobile-only bottom nav — 4 most-used surfaces in thumb zone. */}
          <BottomNav
            active={activeTab}
            onChange={(id) => handleSidebarClick(id as AdminTab)}
            items={[
              { id: 'today',        label: 'Today',     icon: <Sun size={18} />,          badge: todayBadge },
              { id: 'inbox',        label: 'Inbox',     icon: <Inbox size={18} />,        badge: inboxBadge },
              { id: 'schedule',     label: 'Schedule',  icon: <CalendarIcon size={18} /> },
              { id: 'patients',     label: 'Patients',  icon: <Users size={18} /> },
            ]}
          />

          {/* Booking Modal — treatment-first flow with live conflict warning. */}
          <Modal
            open={showBookingModal}
            onClose={() => setShowBookingModal(false)}
            title={bookingForm.isPlanSession ? 'Book next session' : 'Book appointment'}
            subtitle={bookingForm.isPlanSession ? 'Continuing the treatment plan — no charge' : 'Schedule a clinical session'}
            size="md"
          >
            {(() => {
              // Live derivations used by the form body
              const selectedTreatment = treatments.find(t => t.id === bookingForm.treatmentId);
              const liveConflict = findConflict({
                clinicianId: bookingForm.clinicianId,
                date: bookingForm.date,
                time: bookingForm.time,
                durationMin: bookingForm.durationMin,
              });
              const depositPence = selectedTreatment
                ? Math.round((selectedTreatment.fullPricePence * selectedTreatment.depositPct) / 100)
                : 0;
              return (
                <form id="booking-form" onSubmit={handleBookingSubmit} className="flex flex-col gap-5">
                  {/* What — treatment drives duration + price + deposit */}
                  <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">What</p>
                  <Select
                    label="Treatment"
                    required={!bookingForm.isPlanSession}
                    value={bookingForm.treatmentId || ''}
                    onChange={(e) => {
                      const t = treatments.find(tr => tr.id === e.target.value);
                      setBookingForm(prev => ({
                        ...prev,
                        treatmentId: e.target.value,
                        type: (t?.name as Appointment['type']) ?? prev.type,
                        durationMin: t?.durationMin ?? prev.durationMin,
                      }));
                    }}
                  >
                    <option value="" disabled>Choose a treatment…</option>
                    {treatments.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.durationMin} min
                      </option>
                    ))}
                  </Select>

                  {bookingForm.isPlanSession && (
                    <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2.5 text-xs text-obsidian">
                      Plan follow-up session — continuing from the last session. No charge or deposit is attached.
                    </div>
                  )}
                  {/* Treatment summary — duration, price, deposit shown so doctors
                      don't have to leave the modal to check pricing. */}
                  {selectedTreatment && !bookingForm.isPlanSession && (
                    <div className="rounded-md bg-cream/60 border border-sand px-3 py-2.5 text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-muted">Duration</p>
                          <p className="text-obsidian font-medium mt-0.5">{selectedTreatment.durationMin} min</p>
                        </div>
                        <div>
                          <p className="text-muted">Price</p>
                          <p className="text-obsidian font-medium mt-0.5">
                            £{(selectedTreatment.fullPricePence / 100).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted">Deposit</p>
                          <p className="text-obsidian font-medium mt-0.5">
                            {selectedTreatment.depositPct > 0
                              ? `£${(depositPence / 100).toFixed(2)}`
                              : 'None'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>

                  {/* Who */}
                  <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Who</p>
                  <Select
                    label="Client"
                    required
                    value={bookingForm.clientId || ''}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, clientId: e.target.value }))}
                  >
                    <option value="" disabled>Choose a client…</option>
                    {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>

                  <Select
                    label="Clinician"
                    required
                    value={bookingForm.clinicianId || ''}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, clinicianId: e.target.value }))}
                  >
                    <option value="" disabled>Choose a clinician…</option>
                    {CLINICIANS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  </div>

                  {/* When */}
                  <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">When</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Date"
                      type="date"
                      required
                      value={bookingForm.date || ''}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, date: e.target.value }))}
                    />
                    <div>
                      <Select
                        label="Time"
                        required
                        value={bookingForm.time || ''}
                        onChange={(e) => setBookingForm(prev => ({ ...prev, time: e.target.value }))}
                      >
                        {['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM','05:00 PM','05:30 PM','06:00 PM','06:30 PM','07:00 PM','07:30 PM','08:00 PM','08:30 PM','09:00 PM','09:30 PM','10:00 PM'].map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                      {/* End-time hint — treatments run 30-180 min, so the true
                          blocked window isn't obvious from the start slot alone. */}
                      {(() => {
                        const startMin = bookingForm.time ? parseTime12h(bookingForm.time) : null;
                        const dur = bookingForm.durationMin ?? selectedTreatment?.durationMin;
                        if (startMin === null || !dur) return null;
                        return <p className="text-xs text-muted mt-1">Ends {formatMinutes12h(startMin + dur)}</p>;
                      })()}
                    </div>
                  </div>

                  {/* Live conflict warning — caution tone (it blocks submit, but the
                      fix is just picking a different slot, not an error state) */}
                  {liveConflict && (
                    <div className="rounded-md bg-warning-bg border border-warning/30 px-3 py-2.5 text-xs text-warning-text">
                      <div className="font-medium mb-0.5">Booking conflict</div>
                      {CLINICIANS.find(c => c.id === bookingForm.clinicianId)?.name ?? 'This clinician'} already has{' '}
                      <span className="font-medium">{liveConflict.type}</span> with{' '}
                      <span className="font-medium">{liveConflict.clientName}</span> at {liveConflict.time}.
                      Pick a different time or clinician.
                    </div>
                  )}
                  </div>

                  {/* Notes */}
                  <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Notes</p>
                  <Textarea
                    label="Clinical notes (optional)"
                    rows={3}
                    value={bookingForm.notes || ''}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any specific instructions or prep notes…"
                  />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setShowBookingModal(false)}>Cancel</Button>
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={!!liveConflict || isSubmitting}
                      onClick={() => { bookAnotherRef.current = true; }}
                    >
                      Book & add another
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!!liveConflict || isSubmitting}
                      onClick={() => { bookAnotherRef.current = false; }}
                    >
                      Confirm appointment
                    </Button>
                  </div>
                </form>
              );
            })()}
          </Modal>

          {/* Start-a-package Modal — creates the course, books Session 1, records the up-front payment. */}
          <Modal
            open={showStartPackageModal}
            onClose={() => setShowStartPackageModal(false)}
            title="Start a package"
            subtitle="Set up the course, book Session 1, and record payment"
            size="md"
          >
            {(() => {
              const pkg = getPackage(startPackageForm.packageId);
              const pkgConflict = pkg ? findConflict({
                clinicianId: startPackageForm.clinicianId,
                date: startPackageForm.date,
                time: startPackageForm.time,
                durationMin: pkg.session.durationMin,
              }) : null;
              return (
                <form id="start-package-form" onSubmit={handleStartPackageSubmit} className="flex flex-col gap-5">
                  {/* Patient */}
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Patient</p>
                    <Select
                      label="Client"
                      required
                      value={startPackageForm.clientId || ''}
                      onChange={(e) => setStartPackageForm(prev => ({ ...prev, clientId: e.target.value }))}
                    >
                      <option value="" disabled>Choose a client…</option>
                      {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </div>

                  {/* Package */}
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Package</p>
                    <Select
                      label="Treatment package"
                      required
                      value={startPackageForm.packageId || ''}
                      onChange={(e) => setStartPackageForm(prev => ({ ...prev, packageId: e.target.value }))}
                    >
                      <option value="" disabled>Choose a package…</option>
                      <optgroup label="PRP">
                        {PACKAGES.filter(p => p.modality === 'prp').map(p => (
                          <option key={p.id} value={p.id}>{p.name} · {p.sessionsPlanned} sessions · {formatPackagePrice(p.pricePence)}</option>
                        ))}
                      </optgroup>
                      <optgroup label="PRF">
                        {PACKAGES.filter(p => p.modality === 'prf').map(p => (
                          <option key={p.id} value={p.id}>{p.name} · {p.sessionsPlanned} sessions · {formatPackagePrice(p.pricePence)}</option>
                        ))}
                      </optgroup>
                    </Select>

                    {pkg && (
                      <div className="rounded-md bg-cream/60 border border-sand px-3 py-2.5 text-xs text-obsidian">
                        <p className="font-medium">{formatPackagePrice(pkg.pricePence)} · {pkg.sessionsPlanned} sessions · every {pkg.cadenceWeeks[0]}–{pkg.cadenceWeeks[1]} weeks</p>
                        <p className="text-muted mt-1">
                          Books Session 1 now; the remaining {pkg.sessionsPlanned - 1} are added later, price-free, from the treatment plan.
                          {pkg.exosome ? ` Session ${pkg.exosome.position} is the exosome visit.` : ''}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Session 1 */}
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Session 1</p>
                    <Select
                      label="Clinician"
                      required
                      value={startPackageForm.clinicianId || ''}
                      onChange={(e) => setStartPackageForm(prev => ({ ...prev, clinicianId: e.target.value }))}
                    >
                      <option value="" disabled>Choose a clinician…</option>
                      {CLINICIANS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Date"
                        type="date"
                        required
                        value={startPackageForm.date || ''}
                        onChange={(e) => setStartPackageForm(prev => ({ ...prev, date: e.target.value }))}
                      />
                      <Select
                        label="Time"
                        required
                        value={startPackageForm.time || ''}
                        onChange={(e) => setStartPackageForm(prev => ({ ...prev, time: e.target.value }))}
                      >
                        {['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM','05:00 PM','05:30 PM','06:00 PM','06:30 PM','07:00 PM','07:30 PM','08:00 PM','08:30 PM','09:00 PM','09:30 PM','10:00 PM'].map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </div>
                    {pkgConflict && (
                      <div className="rounded-md bg-warning-bg border border-warning/30 px-3 py-2.5 text-xs text-warning-text">
                        <div className="font-medium mb-0.5">Booking conflict</div>
                        {CLINICIANS.find(c => c.id === startPackageForm.clinicianId)?.name ?? 'This clinician'} already has{' '}
                        <span className="font-medium">{pkgConflict.type}</span> with{' '}
                        <span className="font-medium">{pkgConflict.clientName}</span> at {pkgConflict.time}. Pick a different time or clinician.
                      </div>
                    )}
                  </div>

                  {/* Payment */}
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Payment</p>
                    <Select
                      label="Package payment (taken once, up front)"
                      value={startPackageForm.collectNow ? 'now' : 'later'}
                      onChange={(e) => setStartPackageForm(prev => ({ ...prev, collectNow: e.target.value === 'now' }))}
                    >
                      <option value="now">Collected now — mark as paid{pkg ? ` (${formatPackagePrice(pkg.pricePence)})` : ''}</option>
                      <option value="later">Send later — record as pending</option>
                    </Select>
                    <p className="text-xs text-muted">The remaining sessions are always price-free — the patient is never shown a price again.</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setShowStartPackageModal(false)}>Cancel</Button>
                    <Button type="submit" variant="primary" disabled={!!pkgConflict || isSubmitting}>
                      Start package &amp; book Session 1
                    </Button>
                  </div>
                </form>
              );
            })()}
          </Modal>
        </main>

        {/* Form viewer */}
        {viewingForm && (
          <InteractiveForm message={viewingForm} isReadOnly={true} onClose={() => setViewingForm(null)} />
        )}

        {/* Gallery upload modal */}
        {selectedClient && (
          <Modal
            open={showGalleryUpload}
            onClose={() => !isUploading && setShowGalleryUpload(false)}
            title="Add progress photo"
            subtitle={`Upload for ${selectedClient.name}`}
            size="md"
            closeOnBackdrop={!isUploading}
          >
            <div className="flex flex-col gap-4">
              <div className="aspect-video bg-cream rounded-md border border-dashed border-sand overflow-hidden relative flex flex-col items-center justify-center">
                {galleryUploadPreview ? (
                  <>
                    <img src={galleryUploadPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button onClick={() => { setGalleryUploadFile(null); setGalleryUploadPreview(null); }} aria-label="Remove selected photo" className="absolute top-3 right-3 w-9 h-9 rounded-full bg-obsidian/70 text-white flex items-center justify-center hover:bg-obsidian transition-colors">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 p-6">
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => fileInputRef.current?.click()} leadingIcon={<Upload size={14} />}>From device</Button>
                      <Button variant="ghost" onClick={() => cameraInputRef.current?.click()} leadingIcon={<Camera size={14} />}>Camera</Button>
                    </div>
                    <p className="text-xs text-muted">Select or take a photo</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleFileSelect} />
                <input ref={cameraInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} capture="environment" className="hidden" onChange={handleFileSelect} />
              </div>
              <Input
                label="Photo label"
                type="text"
                value={galleryUploadLabel}
                onChange={(e) => setGalleryUploadLabel(e.target.value)}
                placeholder="e.g. Post-session 1 — vertex"
              />
              {isUploading && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="progress-track flex-1"><div className="progress-fill gold" style={{ width: `${uploadProgress}%` }} /></div>
                    <span className="text-xs font-medium text-muted">{uploadProgress}%</span>
                  </div>
                  {galleryUploadFile && (
                    <p className="text-xs text-muted truncate">
                      Uploading {galleryUploadFile.name} ({(galleryUploadFile.size / (1024 * 1024)).toFixed(1)} MB)
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setShowGalleryUpload(false)} disabled={isUploading}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={() => handleGalleryUpload(selectedClient.id)}
                  disabled={isUploading || !galleryUploadFile}
                  leadingIcon={<Upload size={14} />}
                >
                  Save to gallery
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Lightbox */}
        {lightboxImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-obsidian/95 animate-fade-in" onClick={() => setLightboxImage(null)}>
            <img src={lightboxImage.url} alt={lightboxImage.label} className="max-w-full max-h-[90dvh] object-contain rounded-md" />
            <button onClick={() => setLightboxImage(null)} aria-label="Close photo viewer" className="absolute top-4 right-4 w-9 h-9 bg-white/10 rounded-md flex items-center justify-center text-white hover:bg-white/20 transition-all">
              <X size={15} />
            </button>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/10 text-white px-3 py-1.5 rounded-md text-xs text-center">
              {lightboxImage.label} · {new Date(lightboxImage.uploadedAt).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Command palette (Cmd+K / Ctrl+K) */}
        <CommandPalette
          open={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          items={commandItems}
          placeholder="Jump to a section, action or patient…"
        />

        {/* Settings drawer */}
        <SettingsDrawer open={showSettings} onClose={() => setShowSettings(false)} />
      </div>
    </AdminContext.Provider>
  );
};

export default AdminPage;
