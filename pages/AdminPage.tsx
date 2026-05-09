import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Client, Appointment, Message, GalleryItem, AdminType, AppNotification, TreatmentPlan, Prescription, Payment } from '../types';
import { FORMS } from '../constants';
import { InteractiveForm } from '../components/InteractiveForm';
import Logo from '../components/Logo';
import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  Camera, Upload, X,
  LayoutDashboard, Users, ClipboardList, CalendarDays, MessageCircle,
  BarChart2, Sparkles, Bell, Search, Menu, ChevronRight, LogOut,
} from 'lucide-react';
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
import { SidebarItem } from './admin/AdminComponents';
import OverviewPanel from './admin/panels/OverviewPanel';
import AssessmentsPanel from './admin/panels/AssessmentsPanel';
import MessagesPanel from './admin/panels/MessagesPanel';
import AppointmentsPanel from './admin/panels/AppointmentsPanel';
import ClientsPanel from './admin/panels/ClientsPanel';
import PlatformHealthPanel from './admin/panels/PlatformHealthPanel';

const AdminPage: React.FC<AdminPageProps> = ({
  user, onLogout, onNavigate,
  clients, appointments, messages, notifications,
  onAddAppointment, onUpdateAppointment, onDeleteAppointment,
  onSendMessage, onMarkMessageRead, onUpdateMessage, onUpdateClient,
  onBootstrapAdmins, onMarkNotificationRead,
}) => {
  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]                   = useState<AdminTab>('overview');
  const [effectiveAdminType, setEffectiveAdminType] = useState<AdminType | 'all'>(user?.adminType || 'all');
  const [isBootstrapping, setIsBootstrapping]       = useState(false);
  const [bootstrapStatus, setBootstrapStatus]       = useState<string | null>(null);
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
  const [threadSearch, setThreadSearch]         = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [triageSelectedId, setTriageSelectedId] = useState<string | null>(null);
  const [notifFilter, setNotifFilter]           = useState<'all' | 'assessment' | 'message' | 'appointment'>('all');
  const [showMorningBriefing, setShowMorningBriefing] = useState(false);
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
    return appointments.some(a => a.clientId === client.id && a.doctorId === targetUser.id);
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
    if (error) { alert(error); e.target.value = ''; return; }
    setGalleryUploadFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setGalleryUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleGalleryUpload = async (clientId: string, currentGallery: GalleryItem[] = []) => {
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
      await onUpdateClient(clientId, { gallery: [...currentGallery, newItem] });
      setShowGalleryUpload(false);
      setGalleryUploadFile(null);
      setGalleryUploadLabel('');
      setGalleryUploadPreview(null);
      setUploadProgress(0);
      alert('Photo uploaded successfully.');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to upload.';
      console.error('Gallery upload error:', error);
      alert(msg);
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

  const mockStats = useMemo(() => [
    { label: 'Assessments Today', value: filteredClients.filter(c => c.status === 'Assessment Submitted').length.toString(), trend: 'New', icon: 'assignment', tab: 'assessments' as AdminTab },
    { label: 'Appointments Today', value: filteredAppointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length.toString(), icon: 'event', tab: 'appointments' as AdminTab },
    { label: 'Active Clients', value: filteredClients.filter(c => c.status === 'Active' || c.status === 'Ongoing' || c.status === 'Converted').length.toString(), trend: 'Total', icon: 'groups', tab: 'clients' as AdminTab },
  ], [filteredClients, filteredAppointments]);

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

  const openBookingModal = (clientId?: string) => {
    if (clientId) {
      const client = filteredClients.find(c => c.id === clientId);
      setBookingForm(prev => ({ ...prev, clientId, clientName: client?.name }));
    }
    setShowBookingModal(true);
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingForm.clientId && bookingForm.date && bookingForm.time && bookingForm.type) {
      const client = filteredClients.find(c => c.id === bookingForm.clientId);
      const newAppointment: Appointment = {
        id: '',
        clientId: bookingForm.clientId,
        clientName: client?.name || 'Unknown',
        doctorId: user?.id,
        doctorName: user?.fullName,
        type: bookingForm.type as Appointment['type'],
        date: bookingForm.date,
        time: bookingForm.time,
        status: (bookingForm.status as Appointment['status']) || 'Confirmed',
        notes: bookingForm.notes || '',
        createdAt: new Date().toISOString(),
      };
      onAddAppointment(newAppointment);
      setShowBookingModal(false);
      setBookingForm({ type: 'Initial Consultation', status: 'Confirmed', date: new Date().toISOString().split('T')[0], time: '10:00 AM' });
    }
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

  // ── Context value ──────────────────────────────────────────────────────────
  const ctx = {
    // Props
    user, onLogout, onNavigate, clients, appointments, messages, notifications,
    onAddAppointment, onUpdateAppointment, onDeleteAppointment,
    onSendMessage, onMarkMessageRead, onUpdateMessage, onUpdateClient,
    onBootstrapAdmins, onMarkNotificationRead,
    onSaveTreatmentPlan, onAddPrescription, onUpdatePrescription,
    onAddPayment, onUpdatePayment,
    // State
    activeTab, setActiveTab,
    effectiveAdminType, setEffectiveAdminType,
    isBootstrapping, setIsBootstrapping,
    bootstrapStatus, setBootstrapStatus,
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
  };

  // ── Panel selector ─────────────────────────────────────────────────────────
  const renderPanel = () => {
    switch (activeTab) {
      case 'overview':        return <OverviewPanel />;
      case 'assessments':     return <AssessmentsPanel />;
      case 'messages':        return <MessagesPanel />;
      case 'appointments':    return <AppointmentsPanel />;
      case 'clients':         return <ClientsPanel />;
      case 'platform-health': return <PlatformHealthPanel />;
      default: return (
        <div className="py-20 md:py-32 text-center">
          <span className="material-symbols-outlined text-5xl text-primary/20 mb-4">settings</span>
          <p className="text-[11px] font-black text-text-muted uppercase tracking-widest">Module under development</p>
        </div>
      );
    }
  };

  const sidebarWidth = isSidebarCollapsed ? 64 : 240;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AdminContext.Provider value={ctx}>
      <div className="portal-shell">

        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div className="sidebar-overlay lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={`portal-sidebar ${isSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}
          style={{ width: sidebarWidth, transition: 'width 0.3s cubic-bezier(0.16,1,0.3,1)' }}
        >
          {/* Logo row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px 16px', borderBottom: '0.5px solid var(--color-sand)', marginBottom: 12 }}>
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, background: 'var(--color-obsidian)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/>
                    <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/><path d="m17 6-2.5-2.5"/>
                    <path d="m14 8-1-1"/><path d="m7 18 2.5 2.5"/><path d="m10 16 1 1"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-obsidian)', lineHeight: 1.2 }}>Novogenics</div>
                  <div style={{ fontSize: 10, color: 'var(--color-hint)' }}>Clinical portal</div>
                </div>
              </div>
            )}
            {isSidebarCollapsed && (
              <div style={{ width: 28, height: 28, background: 'var(--color-obsidian)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/>
                </svg>
              </div>
            )}
            <button onClick={() => setIsSidebarCollapsed(v => !v)} className="btn-icon hidden lg:flex" style={{ width: 28, height: 28, padding: 0, marginLeft: isSidebarCollapsed ? 'auto' : 0 }} aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <Menu size={14} />
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="btn-icon lg:hidden" style={{ width: 28, height: 28, padding: 0 }} aria-label="Close menu">
              <X size={14} />
            </button>
          </div>

          {/* Nav sections */}
          <nav style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
            {!isSidebarCollapsed && <div className="nav-section-label">Workspace</div>}
            <SidebarItem id="overview"      label="Overview"      icon={<LayoutDashboard size={16} />} activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} />
            <SidebarItem id="clients"       label="Clients"       icon={<Users size={16} />}           activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} badge={clients.length > 0 ? { value: clients.length, variant: 'blue' } : undefined} />
            <SidebarItem id="assessments"   label="Assessments"   icon={<ClipboardList size={16} />}   activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} badge={clients.filter(c => c.status === 'Assessment Submitted').length > 0 ? { value: clients.filter(c => c.status === 'Assessment Submitted').length, variant: 'gold' } : undefined} />
            <SidebarItem id="appointments"  label="Appointments"  icon={<CalendarDays size={16} />}    activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} />
            <SidebarItem id="messages"      label="Messages"      icon={<MessageCircle size={16} />}   activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} badge={unreadCount > 0 ? { value: unreadCount, variant: 'gold' } : undefined} />
            {user?.adminType === 'technical' && (
              <>
                {!isSidebarCollapsed && <div className="nav-section-label">Clinical</div>}
                <SidebarItem id="platform-health" label="Platform health" icon={<Sparkles size={16} />} activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} />
              </>
            )}
          </nav>

          {/* Doctor chip */}
          <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '0.5px solid var(--color-sand)' }}>
            {user?.adminType === 'technical' && showAccountSwitcher && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, margin: '0 12px 8px', background: '#fff', border: '0.5px solid var(--color-sand)', borderRadius: 'var(--radius-lg)', padding: 12, boxShadow: 'var(--shadow-panel)', zIndex: 60 }}
              >
                <p className="text-2xs font-medium text-hint uppercase tracking-wide mb-2">Switch view mode</p>
                {[
                  { id: 'all', label: 'All access' },
                  { id: 'doctor-female', label: 'Dr. Aminah (F)' },
                  { id: 'doctor-male', label: 'Dr. Waqas (M)' },
                ].map((mode) => (
                  <button key={mode.id} onClick={() => { setEffectiveAdminType(mode.id as AdminType | 'all'); setShowAccountSwitcher(false); }}
                    className={`nav-item ${effectiveAdminType === mode.id ? 'active' : ''}`}
                    style={{ marginBottom: 2 }}>
                    {mode.label}
                  </button>
                ))}
              </motion.div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px' }}>
              <div
                className="avatar avatar-sm"
                style={{ flexShrink: 0, cursor: user?.adminType === 'technical' ? 'pointer' : 'default' }}
                onClick={() => user?.adminType === 'technical' && setShowAccountSwitcher(!showAccountSwitcher)}
                title={user?.adminType === 'technical' ? 'Switch view' : undefined}
              >
                {getInitials(user?.fullName)}
              </div>
              {!isSidebarCollapsed && (
                <>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-obsidian)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.fullName ?? 'Doctor'}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-hint)' }}>
                      {user?.adminType === 'technical' ? 'Technical admin' : user?.adminType === 'doctor-female' ? 'GP · Female' : 'GP · Male'}
                    </div>
                  </div>
                  <button onClick={onLogout} className="btn-icon" style={{ width: 26, height: 26, padding: 0, flexShrink: 0 }} title="Sign out" aria-label="Sign out">
                    <LogOut size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div
          className="portal-main"
          style={{ marginLeft: sidebarWidth, transition: 'margin-left 0.3s cubic-bezier(0.16,1,0.3,1)' }}
        >
          {/* Morning briefing toast */}
          {showMorningBriefing && (() => {
            const todayAppts = filteredAppointments.filter(a => a.date === new Date().toISOString().split('T')[0] && a.status !== 'Cancelled');
            return (
              <div className="fixed bottom-6 right-6 z-[100] w-[360px] bg-clinical-dark text-white rounded-[1.5rem] shadow-2xl shadow-clinical-dark/40 overflow-hidden animate-fade-up">
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-lg">wb_sunny</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest">Good Morning</p>
                      <p className="text-[10px] text-gray-400">Today's Clinical Briefing</p>
                    </div>
                  </div>
                  <button onClick={() => setShowMorningBriefing(false)} className="text-gray-400 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{todayAppts.length} appointment{todayAppts.length !== 1 ? 's' : ''} today</p>
                  {todayAppts.slice(0, 4).map(apt => (
                    <div key={apt.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-sm">event</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black truncate">{apt.clientName}</p>
                        <p className="text-[10px] text-gray-400">{apt.type} · {apt.time}</p>
                      </div>
                    </div>
                  ))}
                  {todayAppts.length > 4 && <p className="text-[10px] text-primary font-black text-center">+{todayAppts.length - 4} more</p>}
                </div>
                <button onClick={() => { setShowMorningBriefing(false); setActiveTab('appointments'); }} className="w-full p-4 bg-primary text-clinical-dark text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity">
                  View Full Schedule
                </button>
              </div>
            );
          })()}

          {/* Topbar */}
          <header className="portal-topbar">
            <button onClick={() => setIsSidebarOpen(true)} className="btn-icon lg:hidden" style={{ width: 34, height: 34, padding: 0 }} aria-label="Open menu">
              <Menu size={18} />
            </button>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-hint)' }}>
              <span>Admin</span>
              <ChevronRight size={12} />
              <span style={{ color: 'var(--color-obsidian)', fontWeight: 500, textTransform: 'capitalize' }}>
                {activeTab.replace(/-/g, ' ')}
              </span>
              {selectedClientId && (
                <>
                  <ChevronRight size={12} />
                  <span style={{ color: 'var(--color-obsidian)', fontWeight: 500 }}>Client record</span>
                </>
              )}
            </div>

            {/* Search — desktop only */}
            <div className="search-wrap hidden lg:block" style={{ flex: 1, maxWidth: 360 }}>
              <Search className="search-icon" size={14} aria-hidden />
              <input type="text" className="search-input" placeholder="Search clients, appointments…" />
            </div>

            {/* Actions */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="btn-icon"
                  style={{ width: 34, height: 34, padding: 0, position: 'relative' }}
                  aria-label="Notifications"
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: '50%', background: 'var(--color-gold)', border: '1.5px solid var(--color-ivory)' }} />
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <div className="absolute right-0 mt-4 w-[340px] md:w-[420px] bg-white rounded-3xl shadow-2xl border border-black/5 z-50 overflow-hidden animate-fade-up origin-top-right">
                      <div className="p-5 border-b border-gray-50">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xs font-black uppercase tracking-widest text-text-main">Notifications</h3>
                          <button onClick={clearAll} className="text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-primary transition-colors">Mark All Read</button>
                        </div>
                        <div className="flex gap-1 bg-bg-soft p-1 rounded-full">
                          {(['all', 'assessment', 'message', 'appointment'] as const).map(f => (
                            <button key={f} onClick={() => setNotifFilter(f)} className={`flex-1 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${notifFilter === f ? 'bg-white text-primary shadow-sm' : 'text-text-muted'}`}>
                              {f === 'all' ? 'All' : f === 'assessment' ? 'Assess.' : f === 'message' ? 'Msgs' : 'Appts'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="max-h-[420px] overflow-y-auto no-scrollbar">
                        {filteredNotifications.length > 0 ? filteredNotifications.map((n) => {
                          const iconMap: Record<string, string> = { new_assessment: 'assignment', new_message: 'forum', form_signed: 'draw', appointment_confirmed: 'event', feedback_received: 'rate_review', form_sent: 'description', payment_received: 'payments', welcome: 'waving_hand', daily_briefing: 'wb_sunny' };
                          const colorMap: Record<string, string> = { new_assessment: 'bg-blue-100 text-blue-600', new_message: 'bg-purple-100 text-purple-600', form_signed: 'bg-green-100 text-green-600', appointment_confirmed: 'bg-emerald-100 text-emerald-600', feedback_received: 'bg-amber-100 text-amber-600' };
                          const diff = n.createdAt ? Date.now() - new Date(n.createdAt).getTime() : -1;
                          const timeAgo = diff < 0 ? 'Recently' : diff < 60000 ? 'Just now' : diff < 3600000 ? `${Math.floor(diff / 60000)}m ago` : diff < 86400000 ? `${Math.floor(diff / 3600000)}h ago` : `${Math.floor(diff / 86400000)}d ago`;
                          return (
                            <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-5 border-b border-gray-50 flex gap-4 hover:bg-bg-soft transition-colors cursor-pointer relative ${!n.read ? 'bg-primary/5' : ''}`}>
                              {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />}
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorMap[n.type] || 'bg-gray-100 text-gray-600'}`}>
                                <span className="material-symbols-outlined text-xl">{iconMap[n.type] || 'notifications'}</span>
                              </div>
                              <div className="min-w-0 flex-grow">
                                <p className="text-[11px] font-black text-text-main mb-0.5">{n.title}</p>
                                <p className="text-[10px] text-text-muted leading-relaxed mb-2 line-clamp-2">{n.body}</p>
                                <p className="text-[8px] font-bold text-text-muted uppercase tracking-widest">{timeAgo}</p>
                              </div>
                              {!n.read && <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1" />}
                            </div>
                          );
                        }) : (
                          <div className="p-12 text-center">
                            <span className="material-symbols-outlined text-4xl text-primary/20 mb-3 block">notifications_none</span>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">All caught up</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <div style={{ padding: 'var(--panel-gap)', flex: 1 }}>
            {renderPanel()}
          </div>

          {/* Booking Modal */}
          {showBookingModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
              <div className="absolute inset-0 bg-clinical-dark/60 backdrop-blur-sm" onClick={() => setShowBookingModal(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 md:p-8 border-b border-gray-50 flex justify-between items-center bg-bg-soft shrink-0">
                  <h3 className="text-base md:text-lg font-black text-text-main uppercase tracking-widest">Book Appointment</h3>
                  <button onClick={() => setShowBookingModal(false)} className="text-text-muted hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <form onSubmit={handleBookingSubmit} className="p-6 md:p-8 space-y-4 md:space-y-6 overflow-y-auto">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Select Client</label>
                    <select required value={bookingForm.clientId || ''} onChange={(e) => setBookingForm(prev => ({ ...prev, clientId: e.target.value }))} className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all">
                      <option value="" disabled>Choose a client...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Date</label>
                      <input type="date" required value={bookingForm.date || ''} onChange={(e) => setBookingForm(prev => ({ ...prev, date: e.target.value }))} className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Time</label>
                      <select required value={bookingForm.time || ''} onChange={(e) => setBookingForm(prev => ({ ...prev, time: e.target.value }))} className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all">
                        {['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Treatment Type</label>
                    <select required value={bookingForm.type || ''} onChange={(e) => setBookingForm(prev => ({ ...prev, type: e.target.value as Appointment['type'] }))} className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all">
                      <option value="Initial Consultation">Initial Consultation</option>
                      <option value="Follow-up Consultation">Follow-up Consultation</option>
                      <option value="PRP Session">PRP Session</option>
                      <option value="EV-Enriched Plasma Session">EV-Enriched Plasma Session</option>
                      <option value="Hair Assessment">Hair Assessment</option>
                      <option value="Microneedling Session">Microneedling Session</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Clinical Notes (Optional)</label>
                    <textarea value={bookingForm.notes || ''} onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all h-24 resize-none" placeholder="Add any specific instructions or prep notes..." />
                  </div>
                  <button type="submit" className="w-full bg-primary text-clinical-dark py-4 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95">
                    Confirm Appointment
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </div>

        {/* Form viewer */}
        {viewingForm && (
          <InteractiveForm message={viewingForm} isReadOnly={true} onClose={() => setViewingForm(null)} />
        )}

        {/* Gallery upload modal */}
        <AnimatePresence>
          {showGalleryUpload && selectedClient && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isUploading && setShowGalleryUpload(false)} className="absolute inset-0 bg-clinical-dark/80 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden">
                <div className="p-6 md:p-8">
                  <div className="flex justify-between items-center mb-6 md:mb-8">
                    <div>
                      <h3 className="text-xl md:text-2xl font-black text-text-main">Add Progress Photo</h3>
                      <p className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-widest mt-1">Upload for {selectedClient.name}</p>
                    </div>
                    <button onClick={() => setShowGalleryUpload(false)} disabled={isUploading} className="w-10 h-10 rounded-full bg-bg-soft flex items-center justify-center text-text-muted hover:text-text-main transition-colors disabled:opacity-50">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-6">
                    <div className="aspect-video bg-bg-soft rounded-2xl border-2 border-dashed border-black/5 overflow-hidden relative flex flex-col items-center justify-center group">
                      {galleryUploadPreview ? (
                        <>
                          <img src={galleryUploadPreview} alt="Preview" className="w-full h-full object-cover" />
                          <button onClick={() => { setGalleryUploadFile(null); setGalleryUploadPreview(null); }} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-4 p-8">
                          <div className="flex gap-4">
                            <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-black/5 flex flex-col items-center justify-center gap-1 text-text-muted hover:text-primary hover:border-primary/20 transition-all">
                              <Upload className="w-6 h-6" />
                              <span className="text-[8px] font-black uppercase tracking-widest">Gallery</span>
                            </button>
                            <button onClick={() => cameraInputRef.current?.click()} className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-black/5 flex flex-col items-center justify-center gap-1 text-text-muted hover:text-primary hover:border-primary/20 transition-all">
                              <Camera className="w-6 h-6" />
                              <span className="text-[8px] font-black uppercase tracking-widest">Camera</span>
                            </button>
                          </div>
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Select or take a photo</p>
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleFileSelect} />
                      <input ref={cameraInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} capture="environment" className="hidden" onChange={handleFileSelect} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Photo Label</label>
                      <input type="text" value={galleryUploadLabel} onChange={(e) => setGalleryUploadLabel(e.target.value)} placeholder="e.g., Post-Session 1 - Vertex" className="w-full px-6 py-4 bg-bg-soft rounded-2xl border border-black/5 font-bold text-text-main placeholder:text-text-muted/40 focus:outline-none focus:border-primary/30 transition-all" />
                    </div>
                    <button
                      onClick={() => handleGalleryUpload(selectedClient.id, selectedClient.gallery)}
                      disabled={isUploading || !galleryUploadFile}
                      className="w-full bg-primary text-clinical-dark py-5 rounded-2xl font-black uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                    >
                      {isUploading ? (
                        <div className="flex items-center gap-3 w-full">
                          <div className="flex-grow h-2 bg-white/30 rounded-full overflow-hidden">
                            <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                          </div>
                          <span className="text-xs font-black">{uploadProgress}%</span>
                        </div>
                      ) : (
                        <><Upload className="w-5 h-5" />Save to Gallery</>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Lightbox */}
        {lightboxImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-up" onClick={() => setLightboxImage(null)}>
            <img src={lightboxImage.url} alt={lightboxImage.label} className="max-w-full max-h-[90dvh] object-contain rounded-xl" />
            <button onClick={() => setLightboxImage(null)} className="absolute top-6 right-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all">
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest text-center">
              {lightboxImage.label} • {new Date(lightboxImage.uploadedAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    </AdminContext.Provider>
  );
};

export default AdminPage;
