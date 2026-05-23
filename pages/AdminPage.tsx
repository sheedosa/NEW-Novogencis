import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Client, Appointment, Message, GalleryItem, AdminType, AppNotification, TreatmentPlan, Prescription, Payment, Treatment } from '../types';
import { FORMS } from '../constants';
import { InteractiveForm } from '../components/InteractiveForm';
import Logo from '../components/Logo';
import { storage, db } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, onSnapshot, query, where, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import {
  Camera, Upload, X, PanelLeftClose, PanelLeftOpen, Menu, Search, Bell, BellOff,
  LogOut, Sun, CalendarDays, Settings, ChevronsUpDown, Eye,
  LayoutDashboard, ClipboardList, Users, Calendar as CalendarIcon,
  HeartPulse, MessageSquare, Inbox, FileText, BadgeCheck, CalendarCheck,
  StickyNote, CreditCard, Star, ChevronDown, UserCheck,
  Receipt, BarChart3, ListChecks, TrendingUp,
} from 'lucide-react';
import { Button, Modal, Input, Select, Textarea, SidebarItem as UISidebarItem, EmptyState, CommandPalette, useToast, BottomNav } from '../components/ui';
import type { CommandItem } from '../components/ui';
import { processImageForUpload, validateImageFile, ACCEPTED_IMAGE_TYPES } from '../imageUtils';
import { logClinicalAction } from '../utils/auditLogger';
import { notifyPaymentSent } from '../utils/notificationService';

import {
  AdminContext,
  AdminPageProps,
  AdminTab,
  ClientRecordTab,
  CalendarDay,
} from './admin/context';
import SettingsDrawer from './admin/SettingsDrawer';
import TodayPanel from './admin/panels/TodayPanel';
import InboxPanel from './admin/panels/InboxPanel';
import CalendarPanel from './admin/panels/CalendarPanel';
import ClientsPanel from './admin/panels/ClientsPanel';
import MoneyPanel from './admin/panels/MoneyPanel';
import InsightsPanel from './admin/panels/InsightsPanel';
import MarketingPanel from './admin/panels/MarketingPanel';
import PlatformHealthPanel from './admin/panels/PlatformHealthPanel';

const AdminPage: React.FC<AdminPageProps> = ({
  user, onLogout, onNavigate,
  clients, appointments, messages, notifications,
  onAddAppointment, onUpdateAppointment, onDeleteAppointment,
  onSendMessage, onMarkMessageRead, onUpdateMessage, onUpdateClient,
  onMarkNotificationRead,
  tasks, onAddTask, onUpdateTask, onDeleteTask,
  templates, onAddTemplate, onUpdateTemplate, onDeleteTemplate,
  viewAsTestPatient, onSetViewAsTestPatient, onSeedDummyPatient,
}) => {
  const { toast } = useToast();
  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]                   = useState<AdminTab>('overview');
  const [effectiveAdminType, setEffectiveAdminType] = useState<AdminType | 'all'>(user?.adminType || 'all');
  const [selectedClientId, setSelectedClientId]     = useState<string | null>(null);
  const [clientRecordTab, setClientRecordTab]       = useState<ClientRecordTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen]           = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [lightboxImage, setLightboxImage]           = useState<GalleryItem | null>(null);
  const [showNotifications, setShowNotifications]   = useState(false);
  const [uploadProgress, setUploadProgress]         = useState(0);
  const [showBookingModal, setShowBookingModal]     = useState(false);
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
  const [notifFilter, setNotifFilter]           = useState<'all' | 'assessment' | 'message' | 'appointment'>('all');
  const [showMorningBriefing, setShowMorningBriefing] = useState(false);
  const [showCommandPalette, setShowCommandPalette]   = useState(false);
  const [showSettings, setShowSettings]               = useState(false);
  const [isUploading, setIsUploading]               = useState(false);
  const [showGalleryUpload, setShowGalleryUpload]   = useState(false);
  const [galleryUploadFile, setGalleryUploadFile]   = useState<File | null>(null);
  const [galleryUploadLabel, setGalleryUploadLabel] = useState('');
  const [galleryUploadPreview, setGalleryUploadPreview] = useState<string | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
        id: `admin-${Date.now()}`,
        url: downloadURL,
        label: galleryUploadLabel || 'Progress Photo',
        uploadedAt: new Date().toISOString(),
        source: 'Clinical',
      };
      // Use arrayUnion to avoid race conditions when two admins upload concurrently
      await updateDoc(doc(db, 'clients', clientId), { gallery: arrayUnion(newItem) });
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
  const filteredClients = useMemo(() => {
    if (!user) return [];
    if (showOnlyAssigned && user.adminType !== 'technical') {
      return clients.filter(c => isAssignedToUser(c, user));
    }
    return clients;
  }, [clients, user, showOnlyAssigned, isAssignedToUser]);

  const filteredAppointments = useMemo(() => {
    if (!user) return [];
    if (showOnlyAssigned && user.adminType !== 'technical') {
      return appointments.filter(a => a.doctorId === user.id);
    }
    return appointments;
  }, [appointments, user, showOnlyAssigned]);

  const messageThreads = useMemo(() => {
    const threads: Record<string, Message[]> = {};
    const effectiveUser = getEffectiveUser();
    messages.forEach(msg => {
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
  }, [messages, user, clients, effectiveAdminType, showOnlyAssigned, getEffectiveUser, isAssignedToUser]);

  const unreadCount          = notifications.filter(n => !n.read).length;
  const filteredNotifications = notifFilter === 'all'
    ? notifications
    : notifications.filter(n => n.type.includes(notifFilter));

  const selectedClient = filteredClients.find(c => c.id === selectedClientId);

  // ── Sidebar badge counts (computed once per render from filtered data) ────
  const today = new Date().toISOString().split('T')[0];
  const todayBadge = filteredAppointments.filter(
    a => a.date === today && a.status !== 'Cancelled',
  ).length;
  const pendingTriageCount = filteredClients.filter(c => c.status === 'Assessment Submitted').length;
  const unreadFromClientsCount = messages.filter(m => !m.read && m.recipientId === 'admin').length;
  const unsignedFormsCount = messages.filter(m => m.type === 'form' && !m.isSigned).length;
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
    const todayIso = new Date().toISOString().split('T')[0];
    return [
      { label: 'Assessments Today', value: filteredClients.filter(c => c.status === 'Assessment Submitted').length.toString(), trend: 'New', icon: 'assignment', tab: 'assessments' as AdminTab },
      { label: 'Appointments Today', value: filteredAppointments.filter(a => a.date === todayIso).length.toString(), icon: 'event', tab: 'appointments' as AdminTab },
      { label: 'Active Clients', value: filteredClients.filter(c => c.status === 'Active' || c.status === 'Ongoing' || c.status === 'Converted').length.toString(), trend: 'Total', icon: 'groups', tab: 'clients' as AdminTab },
    ];
  }, [filteredClients, filteredAppointments, today]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleNotificationClick = (notification: AppNotification) => {
    onMarkNotificationRead(notification.id);
    if (notification.type === 'new_assessment' && notification.metadata?.clientId) {
      setSelectedClientId(notification.metadata.clientId); setActiveTab('clients'); setClientRecordTab('assessment');
    } else if (notification.type === 'new_message' && notification.metadata?.clientId) {
      setSelectedClientId(notification.metadata.clientId); setActiveTab('clients'); setClientRecordTab('communications');
    } else if (notification.type === 'form_signed' && notification.metadata?.clientId) {
      setSelectedClientId(notification.metadata.clientId); setActiveTab('clients'); setClientRecordTab('forms');
    }
    setShowNotifications(false);
  };

  const clearAll = async () => {
    await Promise.all(notifications.map(n => onMarkNotificationRead(n.id)));
    setShowNotifications(false);
  };

  const handleSidebarClick = (id: AdminTab) => {
    setActiveTab(id);
    setSelectedClientId(null);
    setIsSidebarOpen(false);
  };

  // ── Booking helpers ────────────────────────────────────────────────────────
  // Clinicians available for appointment delivery. Hardcoded for now (2-doctor
  // clinic); could be derived from /users where role=admin && adminType≠technical
  // when the clinic grows.
  const CLINICIANS = useMemo(() => [
    { id: 'aminah', name: 'Dr Aminah Amer',  adminType: 'doctor-female' as const },
    { id: 'waqas',  name: 'Dr Waqas Farid',  adminType: 'doctor-male'   as const },
  ], []);

  /**
   * Parse "10:30 AM" / "02:00 PM" into minutes since midnight.
   * Returns null if the string can't be parsed.
   */
  const parseTime12h = (t: string | undefined): number | null => {
    if (!t) return null;
    const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  };

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

  const openBookingModal = (clientId?: string, prefill?: { date?: string; time?: string }) => {
    setBookingForm(prev => {
      const next = { ...prev };
      if (clientId) {
        const client = filteredClients.find(c => c.id === clientId);
        next.clientId = clientId;
        next.clientName = client?.name;
      }
      if (prefill?.date) next.date = prefill.date;
      if (prefill?.time) next.time = prefill.time;
      return next;
    });
    setShowBookingModal(true);
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      status: (bookingForm.status as Appointment['status']) || 'Confirmed',
      notes: bookingForm.notes || '',
      createdAt: new Date().toISOString(),
      durationMin: bookingForm.durationMin,
      treatmentId: bookingForm.treatmentId,
      clinicianId: bookingForm.clinicianId,
    };
    onAddAppointment(newAppointment);
    setShowBookingModal(false);
    setBookingForm({ type: 'Initial Consultation', status: 'Confirmed', date: new Date().toISOString().split('T')[0], time: '10:00 AM' });
  };

  // ── Treatment plan / prescriptions / payments ──────────────────────────────
  const onSaveTreatmentPlan = async (clientId: string, plan: TreatmentPlan) => {
    await onUpdateClient(clientId, { treatmentPlan: plan });
    await logClinicalAction(user?.id || 'admin', 'save_treatment_plan', clientId, `Saved treatment plan: ${plan.title}`);
  };

  const onAddPrescription = async (clientId: string, rx: Prescription) => {
    const client = clients.find(c => c.id === clientId);
    const existing = client?.prescriptions || [];
    await onUpdateClient(clientId, { prescriptions: [...existing, rx] });
    await logClinicalAction(user?.id || 'admin', 'add_prescription', clientId, `Added prescription: ${rx.drugName}`);
  };

  const onUpdatePrescription = async (clientId: string, rxId: string, updates: Partial<Prescription>) => {
    const client = clients.find(c => c.id === clientId);
    const existing = client?.prescriptions || [];
    const updated = existing.map(r => r.id === rxId ? { ...r, ...updates } : r);
    await onUpdateClient(clientId, { prescriptions: updated });
  };

  const onAddPayment = async (clientId: string, payment: Payment) => {
    const client = clients.find(c => c.id === clientId);
    const existing = client?.payments || [];
    await onUpdateClient(clientId, { payments: [...existing, payment] });
    await logClinicalAction(user?.id || 'admin', 'add_payment', clientId, `Added payment: ${payment.description} £${payment.amount}`);
    if (payment.status === 'Pending') {
      try {
        const client = clients.find(c => c.id === clientId);
        await notifyPaymentSent(clientId, client?.email || '', client?.name || '', `£${payment.amount}`);
      } catch { /* non-critical */ }
    }
  };

  const onUpdatePayment = async (clientId: string, paymentId: string, updates: Partial<Payment>) => {
    const client = clients.find(c => c.id === clientId);
    const existing = client?.payments || [];
    const updated = existing.map(p => p.id === paymentId ? { ...p, ...updates } : p);
    await onUpdateClient(clientId, { payments: updated });
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

  // Morning briefing
  useEffect(() => {
    const today = new Date().toDateString();
    const lastBriefing = localStorage.getItem('novogenics_last_briefing');
    if (lastBriefing !== today) {
      const todayAppts = filteredAppointments.filter(a => a.date === new Date().toISOString().split('T')[0] && a.status !== 'Cancelled');
      if (todayAppts.length > 0) {
        setTimeout(() => setShowMorningBriefing(true), 1500);
        localStorage.setItem('novogenics_last_briefing', today);
      }
    }
  }, [filteredAppointments]);

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
      { id: 'nav-calendar',  group: 'Navigate', icon: <CalendarIcon size={13} />,     label: 'Go to Calendar',             onSelect: () => setActiveTab('calendar') },
      { id: 'nav-patients',  group: 'Navigate', icon: <Users size={13} />,            label: 'Go to Patients',             onSelect: () => setActiveTab('patients') },
      { id: 'nav-money',     group: 'Navigate', icon: <Receipt size={13} />,          label: 'Go to Money',                onSelect: () => setActiveTab('money') },
      { id: 'nav-insights',  group: 'Navigate', icon: <BarChart3 size={13} />,        label: 'Go to Insights',             onSelect: () => setActiveTab('insights') },
      { id: 'act-book',      group: 'Actions',  icon: <CalendarDays size={13} />,     label: 'Book a new appointment',     onSelect: () => setShowBookingModal(true) },
      { id: 'act-settings',  group: 'Actions',  icon: <Settings size={13} />,         label: 'Open settings',              onSelect: () => setShowSettings(true) },
      { id: 'act-notifs',    group: 'Actions',  icon: <Bell size={13} />,             label: 'Open notifications',         onSelect: () => setShowNotifications(true) },
      { id: 'act-logout',    group: 'Actions',  icon: <LogOut size={13} />,           label: 'Sign out',                   onSelect: () => onLogout() },
    ];
    // Patients (limit to first 50 to keep the list snappy)
    clients.slice(0, 50).forEach(c => {
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
  }, [clients, setActiveTab, setShowBookingModal, setShowNotifications, onLogout, setSelectedClientId]);

  // ── Context value ──────────────────────────────────────────────────────────
  // Memoised so consumer panels don't re-render when AdminPage re-renders for
  // unrelated reasons (e.g. App.tsx onSnapshot deltas to other collections).
  const ctx = React.useMemo(() => ({
    // Props
    user, onLogout, onNavigate, clients, appointments, messages, notifications,
    onAddAppointment, onUpdateAppointment, onDeleteAppointment,
    onSendMessage, onMarkMessageRead, onUpdateMessage, onUpdateClient,
    onMarkNotificationRead,
    tasks, onAddTask, onUpdateTask, onDeleteTask,
    onSaveTreatmentPlan, onAddPrescription, onUpdatePrescription,
    onAddPayment, onUpdatePayment,
    // State
    activeTab, setActiveTab,
    effectiveAdminType, setEffectiveAdminType,
    selectedClientId, setSelectedClientId,
    clientRecordTab, setClientRecordTab,
    isSidebarOpen, setIsSidebarOpen,
    isSidebarCollapsed, setIsSidebarCollapsed,
    lightboxImage, setLightboxImage,
    showNotifications, setShowNotifications,
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
    notifFilter, setNotifFilter,
    showMorningBriefing, setShowMorningBriefing,
    isUploading, setIsUploading,
    showGalleryUpload, setShowGalleryUpload,
    galleryUploadFile, setGalleryUploadFile,
    galleryUploadLabel, setGalleryUploadLabel,
    galleryUploadPreview, setGalleryUploadPreview,
    fileInputRef, cameraInputRef,
    // Computed
    selectedClient, filteredClients, filteredAppointments,
    filteredNotifications, messageThreads, unreadCount, mockStats,
    // Helpers
    formatDOB, calculateAge, getInitials, getFirstName, isAssignedToMe,
    // Handlers
    handleFileSelect, handleNotificationClick, clearAll,
    handleSidebarClick, openBookingModal, handleBookingSubmit,
    handleSendForm, changeMonth, getCalendarDays,
    // Templates
    templates, onAddTemplate, onUpdateTemplate, onDeleteTemplate,
    // Preview mode (view as test patient)
    viewAsTestPatient, onSetViewAsTestPatient, onSeedDummyPatient,
  }), [
    user, onLogout, onNavigate, clients, appointments, messages, notifications,
    onAddAppointment, onUpdateAppointment, onDeleteAppointment,
    onSendMessage, onMarkMessageRead, onUpdateMessage, onUpdateClient,
    onMarkNotificationRead, tasks, onAddTask, onUpdateTask, onDeleteTask,
    onSaveTreatmentPlan, onAddPrescription, onUpdatePrescription,
    onAddPayment, onUpdatePayment,
    activeTab, effectiveAdminType, selectedClientId, clientRecordTab,
    isSidebarOpen, isSidebarCollapsed, lightboxImage, showNotifications,
    uploadProgress, showBookingModal, appointmentView, currentCalendarDate,
    viewingForm, bookingForm, threadSearch, showQuickActions, selectedThreadId,
    showOnlyAssigned, showAccountSwitcher, triageSelectedId, notifFilter,
    showMorningBriefing, isUploading, showGalleryUpload, galleryUploadFile,
    galleryUploadLabel, galleryUploadPreview,
    selectedClient, filteredClients, filteredAppointments,
    filteredNotifications, messageThreads, unreadCount, mockStats,
    isAssignedToMe, handleFileSelect, handleNotificationClick, clearAll,
    handleSidebarClick, openBookingModal, handleBookingSubmit,
    handleSendForm, getCalendarDays,
    templates, onAddTemplate, onUpdateTemplate, onDeleteTemplate,
    viewAsTestPatient, onSetViewAsTestPatient, onSeedDummyPatient,
  ]);

  // ── Panel selector ─────────────────────────────────────────────────────────
  // Map legacy tab IDs onto the new structure so external setActiveTab() calls
  // (e.g. notifications, panels deep-linking back into the admin) keep working.
  const legacyToNewTab: Record<string, AdminTab> = {
    overview: 'today',
    assessments: 'inbox',
    messages: 'inbox',
    clients: 'patients',
    appointments: 'calendar',
  };
  const resolvedTab: AdminTab = legacyToNewTab[activeTab as string] || activeTab;

  const renderPanel = () => {
    switch (resolvedTab) {
      case 'today':           return <TodayPanel />;
      case 'inbox':           return <InboxPanel />;
      case 'calendar':        return <CalendarPanel />;
      case 'patients':        return <ClientsPanel />;
      case 'money':           return <MoneyPanel />;
      case 'insights':        return <InsightsPanel />;
      case 'marketing':       return <MarketingPanel />;
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
      <div className="portal-shell font-sans selection:bg-primary/20">
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
              badge={todayBadge}
              active={resolvedTab === 'today' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('today')}
            />
            <UISidebarItem
              icon={<Inbox size={15} />}
              label="Inbox"
              badge={inboxBadge}
              active={resolvedTab === 'inbox' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('inbox')}
            />
            <UISidebarItem
              icon={<CalendarIcon size={15} />}
              label="Calendar"
              active={resolvedTab === 'calendar' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('calendar')}
            />
            <UISidebarItem
              icon={<Users size={15} />}
              label="Patients"
              active={resolvedTab === 'patients' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('patients')}
            />
            <UISidebarItem
              icon={<Receipt size={15} />}
              label="Money"
              badge={moneyBadge}
              active={resolvedTab === 'money' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('money')}
            />
            <UISidebarItem
              icon={<BarChart3 size={15} />}
              label="Insights"
              active={resolvedTab === 'insights' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('insights')}
            />
            <UISidebarItem
              icon={<TrendingUp size={15} />}
              label="Marketing"
              active={resolvedTab === 'marketing' && !selectedClientId}
              collapsed={isSidebarCollapsed}
              onClick={() => handleSidebarClick('marketing')}
            />
            {user?.adminType === 'technical' && (
              <>
                {!isSidebarCollapsed && <p className="nav-section-label">System</p>}
                <UISidebarItem
                  icon={<HeartPulse size={15} />}
                  label="Platform health"
                  active={resolvedTab === 'platform-health' && !selectedClientId}
                  collapsed={isSidebarCollapsed}
                  onClick={() => handleSidebarClick('platform-health')}
                />
              </>
            )}
          </nav>

          {/* Settings sits between nav and the user profile block */}
          <div className="mt-2">
            <UISidebarItem
              icon={<Settings size={15} />}
              label="Settings"
              active={false}
              collapsed={isSidebarCollapsed}
              onClick={() => setShowSettings(true)}
            />
          </div>

          <div className="mt-auto pt-3 border-t border-sand relative">
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
                {/* All admins can preview the patient portal via the dummy account */}
                <p className="text-xs font-medium text-muted px-2 py-1 flex items-center gap-1.5">
                  <UserCheck size={13} /> Test the patient portal
                </p>
                <button
                  onClick={() => { onSetViewAsTestPatient?.(true); setShowAccountSwitcher(false); }}
                  className="w-full text-left px-2 py-1.5 rounded-sm text-sm transition-colors text-obsidian hover:bg-cream flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  View as test patient
                </button>
                <p className="text-xs text-hint px-2 py-1 leading-relaxed">
                  Opens the patient dashboard using the clinic's demo account. You stay signed in as yourself.
                </p>
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
          {/* Morning briefing toast */}
          {showMorningBriefing && (() => {
            const todayAppts = filteredAppointments.filter(a => a.date === new Date().toISOString().split('T')[0] && a.status !== 'Cancelled');
            return (
              <div className="fixed bottom-5 right-3 sm:right-5 z-[100] w-[calc(100vw-1.5rem)] sm:w-[340px] bg-obsidian text-white rounded-lg shadow-modal overflow-hidden animate-fade-up">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Sun size={15} className="text-primary" />
                    <p className="text-sm font-medium">Good morning</p>
                  </div>
                  <button onClick={() => setShowMorningBriefing(false)} className="text-white/60 hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <div className="p-4 space-y-2">
                  <p className="text-xs text-white/60">{todayAppts.length} appointment{todayAppts.length !== 1 ? 's' : ''} today</p>
                  {todayAppts.slice(0, 4).map(apt => (
                    <div key={apt.id} className="flex items-center gap-2.5 bg-white/5 rounded-md p-2">
                      <CalendarDays size={13} className="text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{apt.clientName}</p>
                        <p className="text-xs text-white/50">{apt.type} · {apt.time}</p>
                      </div>
                    </div>
                  ))}
                  {todayAppts.length > 4 && <p className="text-xs text-primary text-center">+{todayAppts.length - 4} more</p>}
                </div>
                <button onClick={() => { setShowMorningBriefing(false); setActiveTab('appointments'); }} className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors">
                  View full schedule
                </button>
              </div>
            );
          })()}

          {/* Top bar */}
          <header className="portal-topbar">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-10 h-10 inline-flex items-center justify-center text-muted hover:text-obsidian rounded-md -ml-2">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted hidden sm:inline">Admin</span>
              <span className="text-hint hidden sm:inline">/</span>
              <span className="text-obsidian font-medium capitalize">
                {resolvedTab.replace('-', ' ')}
              </span>
            </div>
            {/* Cmd+K trigger button (hidden on smallest screens) */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="hidden md:inline-flex items-center gap-2 px-2.5 py-1 ml-4 rounded-md border border-sand bg-white hover:bg-cream text-muted hover:text-obsidian transition-colors"
              aria-label="Open command palette"
            >
              <Search size={13} />
              <span className="text-xs">Quick find…</span>
              <span className="text-xs text-hint border border-sand rounded px-1 ml-2">⌘K</span>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`btn-icon relative ${showNotifications ? 'bg-cream text-obsidian' : ''}`}
                  aria-label="Notifications"
                >
                  <Bell size={15} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-danger rounded-full text-[10px] font-medium text-white flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 mt-2 w-auto sm:w-[340px] md:w-[400px] bg-white rounded-lg shadow-modal border border-sand z-50 overflow-hidden animate-fade-up origin-top-right">
                      <div className="px-4 py-3 border-b border-sand">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="text-sm font-medium text-obsidian">Notifications</h3>
                          <button onClick={clearAll} className="text-xs text-muted hover:text-obsidian transition-colors">Mark all read</button>
                        </div>
                        <div className="flex gap-1">
                          {(['all', 'assessment', 'message', 'appointment'] as const).map(f => (
                            <button key={f} onClick={() => setNotifFilter(f)} className={`px-2.5 py-1 rounded-sm text-xs transition-colors ${notifFilter === f ? 'bg-obsidian text-white' : 'text-muted hover:bg-cream'}`}>
                              {f === 'all' ? 'All' : f === 'assessment' ? 'Assessments' : f === 'message' ? 'Messages' : 'Appointments'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="max-h-[420px] overflow-y-auto">
                        {filteredNotifications.length > 0 ? filteredNotifications.map((n) => {
                          const iconFor = (t: string) => {
                            if (t.includes('assessment')) return <ClipboardList size={14} />;
                            if (t.includes('message')) return <MessageSquare size={14} />;
                            if (t.includes('form_signed')) return <BadgeCheck size={14} />;
                            if (t.includes('form_sent')) return <FileText size={14} />;
                            if (t.includes('appointment')) return <CalendarCheck size={14} />;
                            if (t.includes('payment')) return <CreditCard size={14} />;
                            if (t.includes('feedback')) return <Star size={14} />;
                            if (t.includes('welcome')) return <BadgeCheck size={14} />;
                            if (t.includes('briefing')) return <Sun size={14} />;
                            return <Bell size={14} />;
                          };
                          const diff = n.createdAt ? Date.now() - new Date(n.createdAt).getTime() : -1;
                          const timeAgo = diff < 0 ? 'Recently' : diff < 60000 ? 'Just now' : diff < 3600000 ? `${Math.floor(diff / 60000)}m ago` : diff < 86400000 ? `${Math.floor(diff / 3600000)}h ago` : `${Math.floor(diff / 86400000)}d ago`;
                          return (
                            <div key={n.id} onClick={() => handleNotificationClick(n)} className={`px-4 py-3 border-b border-cream flex gap-3 hover:bg-cream/50 transition-colors cursor-pointer relative ${!n.read ? 'bg-primary/5' : ''}`}>
                              {!n.read && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />}
                              <div className="w-7 h-7 rounded-md bg-cream flex items-center justify-center shrink-0 text-muted">
                                {iconFor(n.type)}
                              </div>
                              <div className="min-w-0 flex-grow">
                                <p className="text-sm font-medium text-obsidian">{n.title}</p>
                                <p className="text-xs text-muted leading-relaxed mt-0.5 line-clamp-2">{n.body}</p>
                                <p className="text-xs text-hint mt-1">{timeAgo}</p>
                              </div>
                            </div>
                          );
                        }) : (
                          <EmptyState icon={<BellOff size={16} />} title="All caught up" compact />
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button onClick={onLogout} className="btn-icon" aria-label="Sign out">
                <LogOut size={15} />
              </button>
            </div>
          </header>

          <div className="portal-content mx-auto pb-20 lg:pb-4" data-scroll key={`${resolvedTab}-${selectedClientId || 'list'}`}>
            {/* Each panel applies its own `animate-fade-up` for a soft enter.
                AnimatePresence-wrapped transitions caused stuck opacity:0 states
                when rapid tab clicks interrupted mid-flight animations. */}
            {renderPanel()}
          </div>

          {/* Mobile-only bottom nav — 4 most-used surfaces in thumb zone. */}
          <BottomNav
            active={resolvedTab}
            onChange={(id) => handleSidebarClick(id as AdminTab)}
            items={[
              { id: 'today',        label: 'Today',     icon: <Sun size={18} />,          badge: todayBadge },
              { id: 'inbox',        label: 'Inbox',     icon: <Inbox size={18} />,        badge: inboxBadge },
              { id: 'calendar',     label: 'Calendar',  icon: <CalendarIcon size={18} /> },
              { id: 'patients',     label: 'Patients',  icon: <Users size={18} /> },
            ]}
          />

          {/* Booking Modal — treatment-first flow with live conflict warning. */}
          <Modal
            open={showBookingModal}
            onClose={() => setShowBookingModal(false)}
            title="Book appointment"
            subtitle="Schedule a clinical session"
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
                <form id="booking-form" onSubmit={handleBookingSubmit} className="flex flex-col gap-4">
                  {/* Treatment first — drives duration + price + deposit */}
                  <Select
                    label="Treatment"
                    required
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

                  {/* Treatment summary — small confirmation strip */}
                  {selectedTreatment && (
                    <div className="rounded-md bg-cream/60 px-3 py-2.5 text-xs text-muted">
                      Duration <span className="text-obsidian font-medium">{selectedTreatment.durationMin} min</span>
                    </div>
                  )}

                  <Select
                    label="Client"
                    required
                    value={bookingForm.clientId || ''}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, clientId: e.target.value }))}
                  >
                    <option value="" disabled>Choose a client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Date"
                      type="date"
                      required
                      value={bookingForm.date || ''}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, date: e.target.value }))}
                    />
                    <Select
                      label="Time"
                      required
                      value={bookingForm.time || ''}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, time: e.target.value }))}
                    >
                      {['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM','05:00 PM','05:30 PM','06:00 PM','06:30 PM','07:00 PM','07:30 PM','08:00 PM','08:30 PM','09:00 PM','09:30 PM','10:00 PM'].map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </div>

                  {/* Live conflict warning — appears when clinician+date+time picked overlaps an existing booking */}
                  {liveConflict && (
                    <div className="rounded-md bg-danger-bg border border-danger/20 px-3 py-2.5 text-xs text-danger-text">
                      <div className="font-medium mb-0.5">Booking conflict</div>
                      {CLINICIANS.find(c => c.id === bookingForm.clinicianId)?.name ?? 'This clinician'} already has{' '}
                      <span className="font-medium">{liveConflict.type}</span> with{' '}
                      <span className="font-medium">{liveConflict.clientName}</span> at {liveConflict.time}.
                      Pick a different time or clinician.
                    </div>
                  )}

                  <Textarea
                    label="Clinical notes (optional)"
                    rows={3}
                    value={bookingForm.notes || ''}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any specific instructions or prep notes…"
                  />

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setShowBookingModal(false)}>Cancel</Button>
                    <Button type="submit" variant="primary" disabled={!!liveConflict}>
                      Confirm appointment
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
                    <button onClick={() => { setGalleryUploadFile(null); setGalleryUploadPreview(null); }} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-obsidian/70 text-white flex items-center justify-center hover:bg-obsidian transition-colors">
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
                <div className="flex items-center gap-3">
                  <div className="progress-track flex-1"><div className="progress-fill gold" style={{ width: `${uploadProgress}%` }} /></div>
                  <span className="text-xs font-medium text-muted">{uploadProgress}%</span>
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
            <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 w-9 h-9 bg-white/10 rounded-md flex items-center justify-center text-white hover:bg-white/20 transition-all">
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
