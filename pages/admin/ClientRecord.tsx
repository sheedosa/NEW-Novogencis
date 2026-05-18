import React, { useState, memo } from 'react';
import { useAdminContext } from './context';
import { ClientRecordTab } from './context';
import { Card } from '../../components/Card';
import { InteractiveForm } from '../../components/InteractiveForm';
import { InternalNotesEditor, FeedbackEditor, MessageInputForm } from './AdminComponents';
import { FORMS } from '../../constants';
import {
  Camera, Upload, X, Plus, Image as ImageIcon, Loader2, ArrowLeft, CheckCircle,
  History, CalendarClock, FileText, CreditCard, ChevronDown, Send, GitCompare,
  ClipboardList, Stethoscope, Pencil,
  User as UserIcon, MessageSquare, Images, Activity, Receipt, Ban, Bell,
  Phone, Mail, MapPin, StickyNote, ArrowRight, Siren, Calendar as CalendarIcon,
} from 'lucide-react';
import { Card as UICard, CardHeader, Button as UIButton, Badge as UIBadge, StatusBadge as UIStatusBadge, EmptyState as UIEmptyState } from '../../components/ui';

type ViewTab = 'snapshot' | 'plan' | 'files' | 'activity' | 'money';
import { storage } from '../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { processImageForUpload, validateImageFile, ACCEPTED_IMAGE_TYPES } from '../../imageUtils';
import { logClinicalAction } from '../../utils/auditLogger';
import { notifyFeedbackReceived, notifyFormSent, notifyPaymentSent } from '../../utils/notificationService';
import { Appointment, TreatmentPlan, TreatmentPhase, Prescription, Payment } from '../../types';

const ClientRecord: React.FC = () => {
  const {
    selectedClient,
    clientRecordTab,
    setClientRecordTab,
    setSelectedClientId,
    setLightboxImage,
    lightboxImage,
    isUploading,
    setIsUploading,
    showGalleryUpload,
    setShowGalleryUpload,
    galleryUploadFile,
    setGalleryUploadFile,
    galleryUploadLabel,
    setGalleryUploadLabel,
    galleryUploadPreview,
    setGalleryUploadPreview,
    viewingForm,
    setViewingForm,
    fileInputRef,
    cameraInputRef,
    openBookingModal,
    uploadProgress,
    setUploadProgress,
    onUpdateClient,
    onSendMessage,
    onMarkMessageRead,
    onUpdateMessage,
    handleSendForm,
    messages,
    appointments,
    clients,
    user,
    formatDOB,
    calculateAge,
    getInitials,
    selectedClientId,
    onUpdateAppointment,
    onSaveTreatmentPlan,
    onAddPrescription,
    onUpdatePrescription,
    onAddPayment,
    onUpdatePayment,
  } = useAdminContext();

  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '' });
  const [rescheduleStatus, setRescheduleStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [quickEditForm, setQuickEditForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [quickEditStatus, setQuickEditStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  // Treatment plan state
  const [treatmentPlanSaving, setTreatmentPlanSaving] = useState(false);
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [phaseForm, setPhaseForm] = useState({ name: '', description: '', sessionsPlanned: 1, notes: '' });
  const [planTitle, setPlanTitle] = useState('');
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [editPhaseForm, setEditPhaseForm] = useState<Partial<TreatmentPhase>>({});

  // Prescription state
  const [showAddRx, setShowAddRx] = useState(false);
  const [rxForm, setRxForm] = useState({ drugName: '', dosage: '', instructions: '', startDate: '', endDate: '', prescribedBy: '' });
  const [rxSaving, setRxSaving] = useState(false);

  // Payment state
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ description: '', amount: '', currency: 'GBP', status: 'Pending' as Payment['status'], dueDate: '', reference: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);

  // Gallery comparison
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  if (!selectedClient) return null;

  // Normalize the canonical ClientRecordTab state (kept for back-compat with external setters)
  // into a 5-tab view used by this component.
  const incomingToView: Record<ClientRecordTab, ViewTab> = {
    overview: 'snapshot',
    assessment: 'snapshot',
    treatment: 'plan',
    forms: 'files',
    gallery: 'files',
    communications: 'activity',
    financials: 'money',
  };
  const viewToCanonical: Record<ViewTab, ClientRecordTab> = {
    snapshot: 'overview',
    plan: 'treatment',
    files: 'forms',
    activity: 'communications',
    money: 'financials',
  };
  const viewTab: ViewTab = incomingToView[clientRecordTab] ?? 'snapshot';
  const setViewTab = (tab: ViewTab) => setClientRecordTab(viewToCanonical[tab]);

  // Derived data used across the redesigned record
  const clientAppointments = appointments.filter(a => a.clientId === selectedClient.id);
  const upcomingAppointments = clientAppointments
    .filter(a => (a.status === 'Confirmed' || a.status === 'Pending') && new Date(a.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextAppointment = upcomingAppointments[0];
  const completedSessions = clientAppointments.filter(a => a.status === 'Completed').length;
  const clientMessages = messages.filter(m => m.senderId === selectedClient.id || m.recipientId === selectedClient.id);
  const redFlags: string[] = (() => {
    const flags = selectedClient.assessmentData?.answers?.['f9']?.value || selectedClient.assessmentData?.answers?.['m9']?.value;
    if (Array.isArray(flags) && flags.length > 0 && !flags.includes('None') && !flags.includes('None of the above')) return flags as string[];
    return [];
  })();

  const openReschedule = (apt: Appointment) => {
    setRescheduleApt(apt);
    setRescheduleForm({ date: apt.date, time: apt.time });
    setRescheduleStatus('idle');
  };

  const submitReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleApt || !rescheduleForm.date || !rescheduleForm.time) return;
    setRescheduleStatus('saving');
    try {
      await onUpdateAppointment(rescheduleApt.id, { date: rescheduleForm.date, time: rescheduleForm.time });
      await logClinicalAction(user?.id || 'admin', 'reschedule_appointment', selectedClient.id, `Rescheduled ${rescheduleApt.type} from ${rescheduleApt.date} ${rescheduleApt.time} to ${rescheduleForm.date} ${rescheduleForm.time}`);
      setRescheduleApt(null);
    } catch (error) {
      console.error('Failed to reschedule:', error);
      setRescheduleStatus('error');
    }
  };

  const openQuickEdit = () => {
    setQuickEditForm({
      name: selectedClient.name || '',
      email: selectedClient.email || '',
      phone: selectedClient.phone || '',
      address: selectedClient.address || '',
    });
    setQuickEditStatus('idle');
    setShowQuickEdit(true);
  };

  const submitQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickEditStatus('saving');
    try {
      await onUpdateClient(selectedClient.id, {
        name: quickEditForm.name.trim(),
        email: quickEditForm.email.trim().toLowerCase(),
        phone: quickEditForm.phone.trim(),
        address: quickEditForm.address.trim(),
      });
      await logClinicalAction(user?.id || 'admin', 'update_client_profile', selectedClient.id, 'Updated client contact details');
      setShowQuickEdit(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
      setQuickEditStatus('error');
    }
  };

  const handleSendMessage = async (msgText: string, threadId: string = selectedClientId || '') => {
    if (!msgText.trim() || !threadId) return;

    try {
      await onSendMessage({
        senderId: user?.id || 'admin',
        recipientId: threadId,
        subject: 'Clinic Update',
        body: msgText,
        read: false,
        createdAt: new Date().toISOString()
      });
      await logClinicalAction(user?.id || 'admin', 'sent_message', threadId, 'Sent clinical update message');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="animate-fade-up flex flex-col">
      {/* ── Sticky patient bar (always visible) ───────────────────────────── */}
      <div className="sticky top-[52px] z-30 -mx-4 sm:-mx-6 lg:-mx-4 px-4 sm:px-6 lg:px-4 py-2.5 bg-ivory/95 backdrop-blur border-b border-sand">
        <div className="flex items-center gap-2 md:gap-3">
          <UIButton variant="ghost" size="sm" onClick={() => setSelectedClientId(null)} aria-label="Back to list">
            <ArrowLeft size={14} />
          </UIButton>
          <div className="avatar avatar-md shrink-0">{getInitials(selectedClient.name)}</div>
          <div className="min-w-0 flex-grow">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-medium text-obsidian truncate">{selectedClient.name}</h2>
              {selectedClient.policiesAccepted && (
                <CheckCircle size={13} className="text-success shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted truncate">
              <span className="font-mono">{selectedClient.id}</span>
              <span className="hidden xs:inline"> · {String(calculateAge(selectedClient.dob)).replace('(', '').replace(')', '').trim() || 'No DOB'}</span>
              <span className="hidden sm:inline capitalize"> · {selectedClient.gender}</span>
            </p>
          </div>
          <div className="hidden md:block shrink-0">
            <UIStatusBadge status={selectedClient.status || 'Active'} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <UIButton variant="ghost" size="sm" leadingIcon={<Pencil size={13} />} onClick={openQuickEdit}>
              <span className="hidden md:inline">Quick edit</span>
            </UIButton>
            <UIButton variant="primary" size="sm" leadingIcon={<CalendarClock size={13} />} onClick={() => openBookingModal(selectedClient.id)}>
              <span className="hidden md:inline">Book appointment</span>
              <span className="md:hidden">Book</span>
            </UIButton>
          </div>
        </div>
      </div>

      {/* ── Tab bar (5 tabs, sticky just below patient bar) ───────────────── */}
      <div className="sticky top-[108px] z-20 -mx-4 sm:-mx-6 lg:-mx-4 px-4 sm:px-6 lg:px-4 py-2 bg-ivory/95 backdrop-blur border-b border-sand">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {([
            { id: 'snapshot', label: 'Snapshot', icon: <UserIcon size={13} /> },
            { id: 'plan',     label: 'Plan',     icon: <Activity size={13} /> },
            { id: 'files',    label: 'Files',    icon: <FileText size={13} /> },
            { id: 'activity', label: 'Activity', icon: <MessageSquare size={13} /> },
            { id: 'money',    label: 'Money',    icon: <Receipt size={13} /> },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
                viewTab === tab.id
                  ? 'bg-obsidian text-white font-medium'
                  : 'text-muted hover:bg-cream hover:text-obsidian'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 2-column layout: Identity rail (left, desktop only) + main content (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3 items-start mt-3">
        {/* Identity rail */}
        <aside className="hidden lg:flex flex-col gap-3 lg:sticky lg:top-[160px]">
          <UICard>
            <CardHeader title="Contact" />
            <dl className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2">
                <Mail size={12} className="text-hint mt-1 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Email</dt>
                  <dd className="text-sm text-obsidian break-all">{selectedClient.email || '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone size={12} className="text-hint mt-1 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Phone</dt>
                  <dd className="text-sm text-obsidian">{selectedClient.phone || '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarIcon size={12} className="text-hint mt-1 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Date of birth</dt>
                  <dd className="text-sm text-obsidian">{formatDOB(selectedClient.dob)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={12} className="text-hint mt-1 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Address</dt>
                  <dd className="text-sm text-obsidian leading-relaxed">{selectedClient.address || '—'}</dd>
                </div>
              </div>
            </dl>
          </UICard>

          <UICard tone="dark">
            <CardHeader title={<span className="text-white">Lifecycle</span>} />
            <select
              value={selectedClient.status}
              onChange={async (e) => {
                try {
                  await onUpdateClient(selectedClient.id, { status: e.target.value });
                } catch (error) {
                  console.error('Failed to update client status:', error);
                }
              }}
              className="w-full bg-white/5 border-white/10 text-white text-sm rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary/30 cursor-pointer [&>option]:bg-obsidian"
            >
              {['New Inquiry', 'Assessment Submitted', 'Reviewed', 'Contacted', 'Converted', 'Not Suitable', 'Active', 'Ongoing'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
              <span className="text-xs text-white/60">Sessions completed</span>
              <span className="text-sm font-medium text-primary">{completedSessions}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-white/60">Upcoming</span>
              <span className="text-sm font-medium text-primary">{upcomingAppointments.length}</span>
            </div>
          </UICard>

          <InternalNotesEditor
            initialNotes={selectedClient.internalNotes || ''}
            onSave={async (notes) => {
              await onUpdateClient(selectedClient.id, { internalNotes: notes });
              await logClinicalAction(user?.id || 'admin', 'update_internal_notes', selectedClient.id, 'Updated internal clinical notes');
            }}
          />
        </aside>

        {/* Main content column */}
        <div className="min-w-0">
        {viewTab === 'snapshot' && (
          <div className="flex flex-col gap-3">
            {/* Mobile: contact + status compressed into a single line shown only when rail is hidden */}
            <div className="lg:hidden flex items-center gap-2 px-1">
              <UIStatusBadge status={selectedClient.status || 'Active'} />
              <span className="text-xs text-muted truncate">{selectedClient.email}</span>
            </div>

            {/* Top stat row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <UICard>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">Next session</p>
                    {nextAppointment ? (
                      <>
                        <p className="text-base font-medium text-obsidian mt-1">
                          {new Date(nextAppointment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </p>
                        <p className="text-xs text-muted truncate">{nextAppointment.time} · {nextAppointment.type}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-base font-medium text-obsidian mt-1">—</p>
                        <button onClick={() => openBookingModal(selectedClient.id)} className="text-xs text-obsidian hover:underline">
                          Book now
                        </button>
                      </>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-md bg-cream flex items-center justify-center text-muted shrink-0">
                    <CalendarClock size={14} />
                  </div>
                </div>
              </UICard>

              <UICard>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">Sessions completed</p>
                    <p className="text-base font-medium text-obsidian mt-1">{completedSessions}</p>
                    <p className="text-xs text-muted truncate">{selectedClient.package || 'No package set'}</p>
                  </div>
                  <div className="w-8 h-8 rounded-md bg-cream flex items-center justify-center text-muted shrink-0">
                    <Activity size={14} />
                  </div>
                </div>
              </UICard>

              <UICard className="col-span-2 md:col-span-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">Pending forms</p>
                    <p className="text-base font-medium text-obsidian mt-1">
                      {clientMessages.filter(m => m.type === 'form' && !m.isSigned).length}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {clientMessages.filter(m => m.type === 'form' && m.isSigned).length} signed
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-md bg-cream flex items-center justify-center text-muted shrink-0">
                    <FileText size={14} />
                  </div>
                </div>
              </UICard>
            </div>

            {/* Red flags (only if any) */}
            {redFlags.length > 0 && (
              <UICard className="!bg-danger-bg !border-danger/20">
                <div className="flex items-start gap-3">
                  <Siren size={16} className="text-danger mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-danger-text mb-2">Clinical red flags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {redFlags.map((flag, i) => <UIBadge key={i} variant="danger">{flag}</UIBadge>)}
                    </div>
                  </div>
                </div>
              </UICard>
            )}

            {/* Decision support — clinical feedback editor */}
            <UICard tone="dark">
              <CardHeader
                title={<span className="text-white">Clinical feedback</span>}
                subtitle={
                  selectedClient.assessmentData?.clinicalFeedback ? (
                    <span className="text-white/60">
                      Last updated {selectedClient.assessmentData.reviewDate ? new Date(selectedClient.assessmentData.reviewDate).toLocaleDateString('en-GB') : 'recently'}
                    </span>
                  ) : (
                    <span className="text-white/60">Not yet submitted — client is waiting</span>
                  )
                }
              />
              <FeedbackEditor
                initialFeedback={selectedClient.assessmentData?.clinicalFeedback || ''}
                onSave={async (feedback) => {
                  const isFirst = !selectedClient.assessmentData?.clinicalFeedback;
                  try {
                    await onUpdateClient(selectedClient.id, {
                      assessmentData: { ...selectedClient.assessmentData, clinicalFeedback: feedback, reviewDate: new Date().toISOString() },
                      status: 'Reviewed',
                    });
                    await logClinicalAction(user?.id || 'admin', 'submit_feedback', selectedClient.id, isFirst ? 'Submitted clinical feedback' : 'Updated clinical feedback');
                    if (isFirst) await notifyFeedbackReceived(selectedClient.id, selectedClient.email, selectedClient.name);
                  } catch (e) {
                    console.error('Failed to save feedback:', e);
                    throw e;
                  }
                }}
              />
            </UICard>

            {/* Two-up: Upcoming bookings + Recent activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UICard>
                <CardHeader
                  title="Upcoming bookings"
                  leadingIcon={<CalendarClock size={14} />}
                  trailing={
                    <UIButton variant="ghost" size="sm" onClick={() => openBookingModal(selectedClient.id)}>
                      <Plus size={13} />
                    </UIButton>
                  }
                />
                {upcomingAppointments.length === 0 ? (
                  <UIEmptyState
                    icon={<CalendarClock size={16} />}
                    title="No bookings"
                    description="Schedule the next session."
                    compact
                    action={<UIButton variant="primary" size="sm" onClick={() => openBookingModal(selectedClient.id)}>Book</UIButton>}
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {upcomingAppointments.slice(0, 4).map(apt => (
                      <div key={apt.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md hover:bg-cream/60 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="text-center shrink-0 w-10">
                            <p className="text-xs text-hint leading-none">{new Date(apt.date).toLocaleString('default', { month: 'short' })}</p>
                            <p className="text-base font-medium text-obsidian leading-tight">{new Date(apt.date).getDate()}</p>
                          </div>
                          <div className="divider-v h-7" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-obsidian truncate">{apt.type}</p>
                            <p className="text-xs text-muted">{apt.time}</p>
                          </div>
                        </div>
                        <UIButton variant="ghost" size="sm" onClick={() => openReschedule(apt)}>Move</UIButton>
                      </div>
                    ))}
                  </div>
                )}
              </UICard>

              <UICard>
                <CardHeader
                  title="Recent activity"
                  leadingIcon={<History size={14} />}
                  trailing={
                    <UIButton variant="ghost" size="sm" trailingIcon={<ArrowRight size={13} />} onClick={() => setViewTab('activity')}>
                      View all
                    </UIButton>
                  }
                />
                {(() => {
                  const events: { id: string; when: string; label: string; sub: string }[] = [
                    ...clientAppointments.map(a => ({
                      id: `apt-${a.id}`,
                      when: a.date,
                      label: `${a.status}: ${a.type}`,
                      sub: `${a.date} · ${a.time}`,
                    })),
                    ...clientMessages.map(m => ({
                      id: `msg-${m.id}`,
                      when: m.createdAt,
                      label: m.senderId === 'admin' || m.senderId === 'system' ? `Message to client` : `Message from client`,
                      sub: m.body?.slice(0, 60) || m.subject || '',
                    })),
                  ]
                    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
                    .slice(0, 5);
                  if (events.length === 0) {
                    return <UIEmptyState icon={<History size={16} />} title="No activity yet" compact />;
                  }
                  return (
                    <div className="flex flex-col gap-2">
                      {events.map(e => (
                        <div key={e.id} className="flex flex-col gap-0.5 p-2 rounded-md hover:bg-cream/60 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-obsidian truncate">{e.label}</p>
                            <span className="text-xs text-hint shrink-0">{new Date(e.when).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                          </div>
                          <p className="text-xs text-muted truncate">{e.sub}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </UICard>
            </div>

            {/* Mobile-only: contact + notes accordion (since identity rail is hidden) */}
            <details className="lg:hidden">
              <summary className="cursor-pointer text-sm font-medium text-obsidian py-2 px-3 bg-cream rounded-md flex items-center justify-between">
                <span>Contact & internal notes</span>
                <ChevronDown size={14} />
              </summary>
              <div className="mt-2 flex flex-col gap-3">
                <UICard>
                  <CardHeader title="Contact" />
                  <dl className="flex flex-col gap-2.5">
                    <div><dt className="text-xs text-muted">Email</dt><dd className="text-sm text-obsidian break-all">{selectedClient.email || '—'}</dd></div>
                    <div><dt className="text-xs text-muted">Phone</dt><dd className="text-sm text-obsidian">{selectedClient.phone || '—'}</dd></div>
                    <div><dt className="text-xs text-muted">DOB</dt><dd className="text-sm text-obsidian">{formatDOB(selectedClient.dob)}</dd></div>
                    <div><dt className="text-xs text-muted">Address</dt><dd className="text-sm text-obsidian leading-relaxed">{selectedClient.address || '—'}</dd></div>
                  </dl>
                </UICard>
                <InternalNotesEditor
                  initialNotes={selectedClient.internalNotes || ''}
                  onSave={async (notes) => {
                    await onUpdateClient(selectedClient.id, { internalNotes: notes });
                    await logClinicalAction(user?.id || 'admin', 'update_internal_notes', selectedClient.id, 'Updated internal clinical notes');
                  }}
                />
              </div>
            </details>
          </div>
        )}

        {viewTab === 'activity' && (
          <div className="grid grid-cols-1 gap-4 md:gap-8">
            <div className="space-y-4 md:space-y-6">
              <Card className="p-4 md:p-8 h-[450px] md:h-[600px] flex flex-col">
                <h3 className="text-2xs md:text-xs font-medium text-muted mb-4 md:mb-6">Communication Log</h3>
                <div className="flex-grow overflow-y-auto space-y-4 md:space-y-6 pr-2 no-scrollbar">
                  {(messages.filter(m => m.senderId === selectedClientId || m.recipientId === selectedClientId) || []).map((msg) => (
                    <div key={msg.id} className={`flex ${msg.senderId === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] md:max-w-[80%] p-3 md:p-4 rounded-2xl ${
                        msg.senderId === 'admin' ? 'bg-obsidian text-white' : 'bg-cream text-obsidian'
                      }`}>
                        {msg.type === 'form' ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-primary">
                              <FileText size={16} />
                              <span className="text-xs text-muted">Form Attachment</span>
                            </div>
                            <p className="text-2xs md:text-xs leading-relaxed font-medium">{FORMS.find(f => f.id === msg.formId)?.title || msg.subject}</p>
                            <button
                              onClick={() => setViewingForm(msg)}
                              className="block w-full bg-primary text-obsidian text-center py-2 rounded-lg text-xs text-muted transition-transform"
                            >
                              {msg.isSigned ? 'View Signed Form' : 'View Sent Form'}
                            </button>
                          </div>
                        ) : msg.type === 'payment' ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-primary">
                              <CreditCard size={16} />
                              <span className="text-xs text-muted">Payment Link Sent</span>
                            </div>
                            <p className="text-2xs md:text-xs leading-relaxed font-medium">{msg.body?.split(': ')[0] || msg.body}</p>
                            <a
                              href={msg.paymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full bg-primary text-obsidian text-center py-2 rounded-lg text-xs text-muted transition-transform"
                            >
                              View Stripe Link
                            </a>
                          </div>
                        ) : (
                          <p className="text-2xs md:text-xs leading-relaxed mb-2">{msg.body}</p>
                        )}
                        <div className="flex justify-between items-center gap-4 mt-2">
                          <span className="text-2xs font-medium opacity-50">{msg.senderId === 'admin' ? 'Clinic' : 'Client'}</span>
                          <span className="text-2xs font-medium opacity-50">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-black/5">
                  <MessageInputForm
                    onSend={(msg) => handleSendMessage(msg, selectedClientId || '')}
                    aiDraftContext={selectedClientId ? {
                      clientId: selectedClientId,
                      threadMessages: clientMessages.map(m => ({
                        senderId: m.senderId,
                        body: m.body,
                        createdAt: m.createdAt,
                      })),
                    } : undefined}
                  />
                </div>
              </Card>
            </div>
          </div>
        )}

        {viewTab === 'files' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xl font-medium text-obsidian">Sent & Signed Forms</h3>
              <div className="relative group w-full sm:w-auto">
                <button className="w-full bg-primary text-obsidian px-6 py-2 rounded-full text-xs text-muted flex items-center justify-center gap-2">
                  Send New Form
                  <ChevronDown size={16} />
                </button>
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-panel border border-black/5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2 space-y-1">
                  {FORMS.map(form => (
                    <button
                      key={form.id}
                      onClick={() => handleSendForm(form.id)}
                      className="w-full text-left px-4 py-3 hover:bg-cream rounded-md text-2xs font-medium text-obsidian flex items-center justify-between group/item"
                    >
                      {form.title}
                      <Send size={14} className="text-primary opacity-0 group-hover/item:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:hidden">
              {messages
                .filter(m => (m.senderId === selectedClientId || m.recipientId === selectedClientId) && m.type === 'form')
                .slice()
                .reverse()
                .map((msg) => {
                  const form = FORMS.find(f => f.id === msg.formId);
                  return (
                    <div key={msg.id} className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-medium text-obsidian pr-4">{form?.title || msg.subject}</p>
                        <span className={`px-2 py-0.5 rounded-full text-2xs font-medium shrink-0 ${msg.isSigned ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {msg.isSigned ? 'Signed' : 'Pending'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-2xs text-muted mb-1">Sent</p>
                          <p className="text-2xs font-medium">{new Date(msg.createdAt).toLocaleDateString('en-GB')}</p>
                        </div>
                        <div>
                          <p className="text-2xs text-muted mb-1">Signed</p>
                          <p className="text-2xs font-medium">{msg.isSigned ? new Date(msg.signedAt!).toLocaleDateString('en-GB') : '-'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setViewingForm(msg)}
                        className="w-full text-primary font-medium text-2xs py-2.5 border border-primary/20 rounded-xl"
                      >
                        View Details
                      </button>
                    </div>
                  );
                })}
              {messages.filter(m => (m.senderId === selectedClientId || m.recipientId === selectedClientId) && m.type === 'form').length === 0 && (
                <div className="bg-white p-12 rounded-2xl border border-black/5 text-center">
                  <p className="text-2xs text-muted">No forms sent yet</p>
                </div>
              )}
            </div>

            <Card className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-cream text-2xs text-muted border-b border-black/5">
                    <tr>
                      <th className="px-8 py-5">Form Name & Status</th>
                      <th className="px-8 py-5">Timeline</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {messages
                      .filter(m => (m.senderId === selectedClientId || m.recipientId === selectedClientId) && m.type === 'form')
                      .slice()
                      .reverse()
                      .map((msg) => {
                        const form = FORMS.find(f => f.id === msg.formId);
                        return (
                          <tr key={msg.id} className="hover:bg-cream/40 transition-colors">
                            <td className="px-8 py-6">
                              <div className="flex flex-col items-start gap-2">
                                <span className="font-medium text-sm text-obsidian">{form?.title || msg.subject}</span>
                                <span className={`px-3 py-1 rounded-full text-xs text-muted ${msg.isSigned ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {msg.isSigned ? 'Signed' : 'Pending'}
                                </span>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xs text-muted w-12">Sent</span>
                                  <span className="text-xs text-obsidian font-medium">{msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('en-GB') : '-'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-2xs text-muted w-12">Signed</span>
                                  <span className="text-xs text-obsidian font-medium">{msg.isSigned && msg.signedAt ? new Date(msg.signedAt).toLocaleDateString('en-GB') : '-'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button
                                onClick={() => setViewingForm(msg)}
                                className="text-primary font-medium text-2xs hover:underline"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {viewTab === 'files' && (() => {
          const gallery = selectedClient.gallery || [];
          return (
            <div className="space-y-6 md:space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-lg md:text-xl font-medium text-obsidian">Progress Gallery</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => { setCompareMode(!compareMode); setCompareA(null); setCompareB(null); }}
                    className={`flex-1 sm:flex-none px-4 md:px-6 py-2.5 rounded-full text-2xs md:text-xs text-muted border transition-all ${compareMode ? 'bg-obsidian text-white border-obsidian' : 'bg-cream text-muted border-black/5 hover:border-black/10'}`}
                  >
                    <GitCompare size={16} className="inline align-middle mr-1" />
                    {compareMode ? 'Exit Compare' : 'Compare'}
                  </button>
                  <button
                    onClick={() => setShowGalleryUpload(true)}
                    className="flex-1 sm:flex-none bg-primary text-obsidian px-6 md:px-8 py-3 rounded-full text-xs font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus className="w-3 h-3 md:w-4 md:h-4" />
                    Add Photo
                  </button>
                </div>
              </div>

              {/* Before/After Comparison view */}
              {compareMode && (
                <div className="bg-obsidian rounded-lg p-6 md:p-8 text-white space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <GitCompare size={20} className="text-primary" />
                    <h4 className="text-xs text-muted text-gray-300">Before / After Comparison</h4>
                    <span className="text-2xs text-gray-500 font-medium ml-auto">Select two photos below</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {['Before', 'After'].map((label, idx) => {
                      const selectedId = idx === 0 ? compareA : compareB;
                      const selectedImg = gallery.find(g => g.id === selectedId);
                      return (
                        <div key={label} className="space-y-2">
                          <p className="text-xs text-muted text-primary">{label}</p>
                          <div className="aspect-square rounded-2xl overflow-hidden border-2 border-dashed border-white/10 bg-white/5 flex items-center justify-center relative">
                            {selectedImg ? (
                              <>
                                <img src={selectedImg.url} alt={selectedImg.label} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" />
                                <button onClick={() => idx === 0 ? setCompareA(null) : setCompareB(null)} className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/80">
                                  <X className="w-3 h-3" />
                                </button>
                                <p className="absolute bottom-2 left-0 right-0 text-center text-2xs font-medium text-white px-2 truncate">{selectedImg.label}</p>
                              </>
                            ) : (
                              <p className="text-2xs font-medium text-gray-500 uppercase">Click photo below</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {compareA && compareB && (() => {
                    const imgA = gallery.find(g => g.id === compareA)!;
                    const imgB = gallery.find(g => g.id === compareB)!;
                    const daysDiff = imgA && imgB ? Math.round(Math.abs(new Date(imgB.uploadedAt).getTime() - new Date(imgA.uploadedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    return (
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
                        <p className="text-2xs font-medium text-gray-400 uppercase">Timeline gap between selected photos</p>
                        <p className="text-2xl font-medium text-primary mt-1">{daysDiff} days</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
                {gallery.map((img) => {
                  const isSelectedA = compareA === img.id;
                  const isSelectedB = compareB === img.id;
                  return (
                    <div
                      key={img.id}
                      className={`space-y-2 group cursor-pointer ${compareMode ? 'ring-2 rounded-2xl transition-all ' + (isSelectedA ? 'ring-primary' : isSelectedB ? 'ring-clinical-dark' : 'ring-transparent hover:ring-black/10') : ''}`}
                      onClick={() => {
                        if (compareMode) {
                          if (!compareA || isSelectedA) setCompareA(isSelectedA ? null : img.id);
                          else if (!compareB || isSelectedB) setCompareB(isSelectedB ? null : img.id);
                          else setCompareB(img.id);
                        } else {
                          setLightboxImage(img);
                        }
                      }}
                    >
                      <div className="aspect-square bg-cream rounded-md overflow-hidden border border-black/5 relative">
                        <img
                          src={img.url}
                          alt={img.label}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="absolute top-2 right-2 flex gap-1">
                          {compareMode && (isSelectedA || isSelectedB) && (
                            <span className={`px-1.5 py-0.5 rounded-full text-2xs font-medium ${isSelectedA ? 'bg-primary text-obsidian' : 'bg-obsidian text-white'}`}>
                              {isSelectedA ? 'Before' : 'After'}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-2xs font-medium ${img.source === 'Clinical' ? 'bg-obsidian text-white' : 'bg-primary text-white'}`}>
                            {img.source}
                          </span>
                        </div>
                      </div>
                      <div className="px-1">
                        <p className="text-2xs font-medium text-obsidian truncate">{img.label}</p>
                        <p className="text-2xs text-muted">
                          {img.uploadedAt ? new Date(img.uploadedAt).toLocaleDateString('en-GB') : 'Recently'}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {gallery.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-cream rounded-md border border-dashed border-black/5">
                    <ImageIcon className="w-8 h-8 text-muted/20 mx-auto mb-2" />
                    <p className="text-2xs text-muted">No photos in gallery yet</p>
                  </div>
                )}

                <button
                  onClick={() => setShowGalleryUpload(true)}
                  className="aspect-square bg-cream border-2 border-dashed border-primary/20 rounded-2xl flex flex-col items-center justify-center text-center p-3 md:p-6 hover:bg-primary/5 transition-all group"
                >
                  <Camera className="w-6 h-6 md:w-8 md:h-8 text-primary/40 mb-1 md:mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-2xs md:text-2xs font-medium text-muted/60 uppercase">Add New</p>
                </button>
              </div>
            </div>
          );
        })()}

        {viewTab === 'activity' && selectedClient.assessmentData?.answers && (
          <details className="group">
            <summary className="cursor-pointer list-none">
              <UICard>
                <CardHeader
                  title="Intake questionnaire"
                  subtitle={`Submitted ${selectedClient.createdAt ? new Date(selectedClient.createdAt).toLocaleDateString('en-GB') : 'recently'}`}
                  leadingIcon={<ClipboardList size={14} />}
                  trailing={<ChevronDown size={14} className="text-muted group-open:rotate-180 transition-transform" />}
                />
              </UICard>
            </summary>
            <div className="mt-2 flex flex-col gap-3">
              <UICard>
                <CardHeader title="Hair concerns & goals" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  {Object.entries(selectedClient.assessmentData?.answers || {})
                    .filter(([key]) => ['f1','f2','f3','f4','f5','m1','m2','m3','m4','m5'].includes(key))
                    .map(([key, val]: [string, any]) => (
                      <div key={key}>
                        <p className="text-xs text-muted leading-tight">{val.text}</p>
                        <p className="text-sm text-obsidian leading-relaxed mt-0.5">
                          {Array.isArray(val.value) ? val.value.join(', ') : val.value || '—'}
                        </p>
                      </div>
                    ))}
                </div>
              </UICard>
              <UICard>
                <CardHeader title="Medical & safety screening" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  {Object.entries(selectedClient.assessmentData?.answers || {})
                    .filter(([key]) => !['f1','f2','f3','f4','f5','m1','m2','m3','m4','m5','f26','m22'].includes(key))
                    .map(([key, val]: [string, any]) => {
                      const isSignificant = val.value && val.value !== 'No' && val.value !== 'None' && !String(val.value).includes('None');
                      return (
                        <div key={key} className={`p-1.5 -m-1.5 rounded-sm ${isSignificant ? 'bg-danger-bg' : ''}`}>
                          <p className="text-xs text-muted leading-tight">{val.text}</p>
                          <p className={`text-sm leading-relaxed mt-0.5 ${isSignificant ? 'text-danger-text font-medium' : 'text-obsidian'}`}>
                            {Array.isArray(val.value) ? val.value.join(', ') : val.value || '—'}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </UICard>
            </div>
          </details>
        )}
        {/* ── Treatment Plan tab ────────────────────────────────────────── */}
        {viewTab === 'plan' && (() => {
          const plan = selectedClient.treatmentPlan;
          const rxList = selectedClient.prescriptions || [];
          const totalPhases = plan?.phases.length || 0;
          const completedPhases = plan?.phases.filter(p => p.status === 'Completed').length || 0;
          const totalSessions = plan?.phases.reduce((s, p) => s + p.sessionsPlanned, 0) || 0;
          const completedSessions = plan?.phases.reduce((s, p) => s + p.sessionsCompleted, 0) || 0;
          return (
            <div className="animate-fade-up space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
                {/* Left: Plan phases */}
                <div className="lg:col-span-8 space-y-6">
                  <Card className="p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xs text-muted">Treatment Plan</h3>
                        {plan?.title && <p className="text-lg font-medium text-obsidian mt-1">{plan.title}</p>}
                      </div>
                      <button onClick={() => { setPlanTitle(plan?.title || ''); setShowAddPhase(true); }} className="flex items-center gap-2 bg-primary text-obsidian px-4 py-2 rounded-full text-xs text-muted transition-transform">
                        <Plus size={16} /> Add Phase
                      </button>
                    </div>

                    {!plan?.phases?.length ? (
                      <div className="py-16 text-center border-2 border-dashed border-black/5 rounded-2xl">
                        <Stethoscope size={40} className="text-primary/20 mb-3 mx-auto" />
                        <p className="text-2xs text-muted">No treatment plan yet</p>
                        <p className="text-xs text-muted/60 mt-1 font-medium">Click "Add Phase" to create the first phase</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {plan.phases.map((phase, i) => {
                          const pct = phase.sessionsPlanned > 0 ? Math.round((phase.sessionsCompleted / phase.sessionsPlanned) * 100) : 0;
                          const statusColor: Record<string, string> = { Active: 'bg-primary text-obsidian', Completed: 'bg-green-100 text-green-700', Planned: 'bg-cream text-muted', 'On Hold': 'bg-yellow-100 text-yellow-700' };
                          return (
                            <div key={phase.id} className="p-6 rounded-2xl border border-black/5 bg-cream/30">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-obsidian text-white flex items-center justify-center text-2xs font-medium shrink-0">{i + 1}</div>
                                  <div>
                                    <p className="text-sm font-medium text-obsidian">{phase.name}</p>
                                    {phase.description && <p className="text-2xs text-muted font-medium mt-0.5">{phase.description}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-xs text-muted px-2 py-1 rounded-full ${statusColor[phase.status]}`}>{phase.status}</span>
                                  <button onClick={() => { setEditingPhaseId(phase.id); setEditPhaseForm({ status: phase.status, sessionsCompleted: phase.sessionsCompleted, notes: phase.notes }); }} className="w-7 h-7 rounded-full bg-white border border-black/10 flex items-center justify-center text-muted hover:text-primary transition-colors">
                                    <Pencil size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-4">
                                <div className="flex-grow h-1.5 bg-black/5 rounded-full overflow-hidden">
                                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-2xs font-medium text-primary shrink-0">{phase.sessionsCompleted}/{phase.sessionsPlanned} sessions</span>
                              </div>
                              {phase.notes && <p className="text-2xs text-muted font-medium mt-3">"{phase.notes}"</p>}
                              {phase.startDate && <p className="text-2xs text-muted font-medium mt-2 uppercase">Started: {new Date(phase.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                              {/* Inline edit panel */}
                              {editingPhaseId === phase.id && (
                                <div className="mt-4 pt-4 border-t border-black/5 space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-2xs text-muted block mb-1">Status</label>
                                      <select value={editPhaseForm.status || phase.status} onChange={e => setEditPhaseForm(p => ({ ...p, status: e.target.value as TreatmentPhase['status'] }))} className="w-full bg-white border-black/10 rounded-lg px-3 py-2 text-xs font-medium">
                                        <option>Planned</option><option>Active</option><option>Completed</option><option>On Hold</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-2xs text-muted block mb-1">Sessions Done</label>
                                      <input type="number" min={0} max={phase.sessionsPlanned} value={editPhaseForm.sessionsCompleted ?? phase.sessionsCompleted} onChange={e => setEditPhaseForm(p => ({ ...p, sessionsCompleted: Number(e.target.value) }))} className="w-full bg-white border-black/10 rounded-lg px-3 py-2 text-xs font-medium" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-2xs text-muted block mb-1">Notes</label>
                                    <textarea value={editPhaseForm.notes ?? phase.notes ?? ''} onChange={e => setEditPhaseForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full bg-white border-black/10 rounded-lg px-3 py-2 text-xs font-medium resize-none" />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button onClick={() => setEditingPhaseId(null)} className="px-4 py-1.5 text-xs text-muted hover:text-obsidian">Cancel</button>
                                    <button onClick={async () => {
                                      if (!plan) return;
                                      setTreatmentPlanSaving(true);
                                      const updatedPhases = plan.phases.map(ph => ph.id === phase.id ? { ...ph, ...editPhaseForm } : ph);
                                      await onSaveTreatmentPlan(selectedClient.id, { ...plan, phases: updatedPhases, updatedAt: new Date().toISOString() });
                                      setEditingPhaseId(null);
                                      setTreatmentPlanSaving(false);
                                    }} disabled={treatmentPlanSaving} className="bg-obsidian text-white px-4 py-1.5 rounded-lg text-xs text-muted disabled:opacity-50">
                                      {treatmentPlanSaving ? 'Saving…' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>

                  {/* Prescriptions */}
                  <Card className="p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xs text-muted">Prescriptions</h3>
                      <button onClick={() => setShowAddRx(true)} className="flex items-center gap-2 bg-cream text-muted px-4 py-2 rounded-full text-xs text-muted hover:bg-primary hover:text-obsidian transition-all">
                        <Plus size={16} /> Add Rx
                      </button>
                    </div>
                    {!rxList.length ? (
                      <div className="py-10 text-center border-2 border-dashed border-black/5 rounded-2xl">
                        <p className="text-2xs text-muted">No prescriptions recorded</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {rxList.map(rx => {
                          const statusColors: Record<string, string> = { Active: 'bg-green-100 text-green-700', Completed: 'bg-blue-100 text-blue-700', Discontinued: 'bg-gray-100 text-gray-500' };
                          return (
                            <div key={rx.id} className="flex items-center justify-between p-4 rounded-xl border border-black/5 bg-white">
                              <div>
                                <p className="text-sm font-medium text-obsidian">{rx.drugName}</p>
                                <p className="text-2xs font-medium text-muted">{rx.dosage} — {rx.instructions}</p>
                                <p className="text-2xs font-medium text-muted/60 mt-1 uppercase">
                                  From {new Date(rx.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  {rx.endDate ? ` → ${new Date(rx.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs text-muted px-2 py-1 rounded-full ${statusColors[rx.status]}`}>{rx.status}</span>
                                {rx.status === 'Active' && (
                                  <button onClick={async () => { await onUpdatePrescription(selectedClient.id, rx.id, { status: 'Discontinued' }); }} className="w-7 h-7 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors" title="Discontinue">
                                    <Ban size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>

                {/* Right: Summary card */}
                <div className="lg:col-span-4 space-y-6">
                  <Card className="p-6 md:p-8 bg-obsidian text-white border-none shadow-xl shadow-obsidian/20">
                    <h3 className="text-xs text-muted text-gray-400 mb-6">Plan Overview</h3>
                    <div className="space-y-5">
                      <div>
                        <p className="text-2xs text-muted mb-1">Total Phases</p>
                        <p className="text-2xl font-medium">{totalPhases}</p>
                        <p className="text-2xs text-gray-400 font-medium">{completedPhases} completed</p>
                      </div>
                      <div>
                        <p className="text-2xs font-medium text-gray-400 uppercase mb-2">Sessions Progress</p>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="bg-primary h-full rounded-full" style={{ width: totalSessions > 0 ? `${Math.round((completedSessions / totalSessions) * 100)}%` : '0%' }} />
                        </div>
                        <p className="text-2xs text-right mt-1 font-medium text-primary">{completedSessions}/{totalSessions}</p>
                      </div>
                      <div>
                        <p className="text-2xs text-muted mb-1">Active Prescriptions</p>
                        <p className="text-2xl font-medium">{rxList.filter(r => r.status === 'Active').length}</p>
                      </div>
                      {plan?.adminNotes && (
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                          <p className="text-2xs font-medium text-gray-400 uppercase mb-1">Plan Notes</p>
                          <p className="text-xs leading-relaxed text-gray-300">"{plan.adminNotes}"</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>

              {/* Add Phase Modal */}
              {showAddPhase && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddPhase(false)}>
                  <form onClick={e => e.stopPropagation()} onSubmit={async (e) => {
                    e.preventDefault();
                    setTreatmentPlanSaving(true);
                    const newPhase: TreatmentPhase = {
                      id: `phase-${Date.now()}`,
                      name: phaseForm.name,
                      description: phaseForm.description,
                      status: 'Planned',
                      sessionsPlanned: phaseForm.sessionsPlanned,
                      sessionsCompleted: 0,
                      notes: phaseForm.notes,
                      startDate: new Date().toISOString().split('T')[0],
                    };
                    const existingPlan = selectedClient.treatmentPlan;
                    const updatedPlan: TreatmentPlan = existingPlan
                      ? { ...existingPlan, phases: [...existingPlan.phases, newPhase], title: planTitle || existingPlan.title, updatedAt: new Date().toISOString() }
                      : { id: `plan-${Date.now()}`, clientId: selectedClient.id, title: planTitle || 'Treatment Plan', phases: [newPhase], createdAt: new Date().toISOString() };
                    await onSaveTreatmentPlan(selectedClient.id, updatedPlan);
                    setPhaseForm({ name: '', description: '', sessionsPlanned: 1, notes: '' });
                    setShowAddPhase(false);
                    setTreatmentPlanSaving(false);
                  }} className="bg-white rounded-lg shadow-modal w-full max-w-md overflow-hidden">
                    <div className="p-6 border-b border-black/5">
                      <h3 className="text-sm font-medium text-obsidian">Add Treatment Phase</h3>
                    </div>
                    <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                      <div>
                        <label className="text-xs text-muted block mb-1">Plan Title {!plan && <span className="text-primary">(first phase)</span>}</label>
                        <input type="text" value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="e.g. 12-Month PRP Protocol" className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Phase Name <span className="text-red-400">*</span></label>
                        <input required type="text" value={phaseForm.name} onChange={e => setPhaseForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Initial Intensive" className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Description</label>
                        <input type="text" value={phaseForm.description} onChange={e => setPhaseForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of goals" className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Sessions Planned</label>
                        <input type="number" min={1} value={phaseForm.sessionsPlanned} onChange={e => setPhaseForm(p => ({ ...p, sessionsPlanned: Number(e.target.value) }))} className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Notes</label>
                        <textarea value={phaseForm.notes} onChange={e => setPhaseForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Clinical notes for this phase" className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 resize-none" />
                      </div>
                    </div>
                    <div className="p-6 border-t border-black/5 flex gap-3 justify-end bg-cream/30">
                      <button type="button" onClick={() => setShowAddPhase(false)} className="px-5 py-2.5 text-xs text-muted hover:text-obsidian">Cancel</button>
                      <button type="submit" disabled={treatmentPlanSaving} className="bg-primary text-obsidian px-6 py-2.5 rounded-xl text-xs text-muted disabled:opacity-50">
                        {treatmentPlanSaving ? 'Saving…' : 'Add Phase'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Add Prescription Modal */}
              {showAddRx && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddRx(false)}>
                  <form onClick={e => e.stopPropagation()} onSubmit={async (e) => {
                    e.preventDefault();
                    setRxSaving(true);
                    const newRx: Prescription = {
                      id: `rx-${Date.now()}`,
                      drugName: rxForm.drugName,
                      dosage: rxForm.dosage,
                      instructions: rxForm.instructions,
                      startDate: rxForm.startDate,
                      endDate: rxForm.endDate || undefined,
                      prescribedBy: rxForm.prescribedBy || user?.fullName,
                      status: 'Active',
                      createdAt: new Date().toISOString(),
                    };
                    await onAddPrescription(selectedClient.id, newRx);
                    setRxForm({ drugName: '', dosage: '', instructions: '', startDate: '', endDate: '', prescribedBy: '' });
                    setShowAddRx(false);
                    setRxSaving(false);
                  }} className="bg-white rounded-lg shadow-modal w-full max-w-md overflow-hidden">
                    <div className="p-6 border-b border-black/5">
                      <h3 className="text-sm font-medium text-obsidian">Add Prescription</h3>
                    </div>
                    <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                      {[
                        { label: 'Drug / Product Name *', field: 'drugName', required: true, placeholder: 'e.g. Minoxidil 5%' },
                        { label: 'Dosage *', field: 'dosage', required: true, placeholder: 'e.g. 1ml twice daily' },
                        { label: 'Instructions', field: 'instructions', required: false, placeholder: 'e.g. Apply to affected area in the morning' },
                        { label: 'Prescribed By', field: 'prescribedBy', required: false, placeholder: user?.fullName || '' },
                      ].map(({ label, field, required, placeholder }) => (
                        <div key={field}>
                          <label className="text-xs text-muted block mb-1">{label}</label>
                          <input required={required} type="text" value={(rxForm as Record<string, string>)[field]} onChange={e => setRxForm(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder} className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted block mb-1">Start Date *</label>
                          <input required type="date" value={rxForm.startDate} onChange={e => setRxForm(p => ({ ...p, startDate: e.target.value }))} className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="text-xs text-muted block mb-1">End Date</label>
                          <input type="date" value={rxForm.endDate} onChange={e => setRxForm(p => ({ ...p, endDate: e.target.value }))} className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                        </div>
                      </div>
                    </div>
                    <div className="p-6 border-t border-black/5 flex gap-3 justify-end bg-cream/30">
                      <button type="button" onClick={() => setShowAddRx(false)} className="px-5 py-2.5 text-xs text-muted hover:text-obsidian">Cancel</button>
                      <button type="submit" disabled={rxSaving} className="bg-primary text-obsidian px-6 py-2.5 rounded-xl text-xs text-muted disabled:opacity-50">
                        {rxSaving ? 'Saving…' : 'Add Prescription'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Financials tab ─────────────────────────────────────────────────── */}
        {viewTab === 'money' && (() => {
          const payList = selectedClient.payments || [];
          const totalPaid = payList.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
          const totalPending = payList.filter(p => p.status === 'Pending' || p.status === 'Overdue').reduce((s, p) => s + p.amount, 0);
          const formatAmount = (amount: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
          const statusColor: Record<string, string> = { Paid: 'bg-green-100 text-green-700', Pending: 'bg-yellow-100 text-yellow-700', Overdue: 'bg-red-100 text-red-700', Refunded: 'bg-gray-100 text-gray-500' };
          return (
            <div className="animate-fade-up space-y-8">
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { label: 'Total received',  value: formatAmount(totalPaid),                                    icon: <CheckCircle size={14} /> },
                  { label: 'Pending / overdue', value: formatAmount(totalPending),                                icon: <CalendarClock size={14} /> },
                  { label: 'Total invoiced',  value: formatAmount(payList.reduce((s, p) => s + p.amount, 0)),     icon: <Receipt size={14} /> },
                ] as const).map(({ label, value, icon }) => (
                  <UICard key={label}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">{label}</p>
                        <p className="text-xl font-medium text-obsidian mt-1">{value}</p>
                      </div>
                      <div className="w-8 h-8 rounded-md bg-cream flex items-center justify-center text-muted shrink-0">
                        {icon}
                      </div>
                    </div>
                  </UICard>
                ))}
              </div>

              {/* Payment list */}
              <Card className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs text-muted">Payment History</h3>
                  <button onClick={() => setShowAddPayment(true)} className="flex items-center gap-2 bg-primary text-obsidian px-4 py-2 rounded-full text-xs text-muted transition-transform">
                    <Plus size={16} /> Add Entry
                  </button>
                </div>
                {!payList.length ? (
                  <div className="py-16 text-center border-2 border-dashed border-black/5 rounded-2xl">
                    <CreditCard size={40} className="text-primary/20 mb-3 mx-auto" />
                    <p className="text-2xs text-muted">No payment records yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(pay => (
                      <div key={pay.id} className="flex items-center justify-between p-4 md:p-5 rounded-2xl border border-black/5 bg-white hover:bg-cream/40 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-obsidian truncate">{pay.description}</p>
                          <p className="text-2xs text-muted mt-0.5">
                            {pay.reference && <span className="font-mono mr-2">Ref: {pay.reference}</span>}
                            {pay.paidDate ? `Paid ${new Date(pay.paidDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : pay.dueDate ? `Due ${new Date(pay.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : new Date(pay.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <p className="text-base font-medium text-obsidian">{formatAmount(pay.amount, pay.currency)}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs text-muted px-2 py-1 rounded-full ${statusColor[pay.status]}`}>{pay.status}</span>
                            {pay.status === 'Pending' && (
                              <button onClick={async () => { await onUpdatePayment(selectedClient.id, pay.id, { status: 'Paid', paidDate: new Date().toISOString().split('T')[0] }); }} className="text-2xs font-medium text-green-600 hover:underline uppercase" title="Mark as paid">Mark Paid</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Add Payment Modal */}
              {showAddPayment && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddPayment(false)}>
                  <form onClick={e => e.stopPropagation()} onSubmit={async (e) => {
                    e.preventDefault();
                    setPaymentSaving(true);
                    const newPay: Payment = {
                      id: `pay-${Date.now()}`,
                      description: paymentForm.description,
                      amount: parseFloat(paymentForm.amount),
                      currency: paymentForm.currency,
                      status: paymentForm.status,
                      dueDate: paymentForm.dueDate || undefined,
                      reference: paymentForm.reference || undefined,
                      createdAt: new Date().toISOString(),
                    };
                    await onAddPayment(selectedClient.id, newPay);
                    setPaymentForm({ description: '', amount: '', currency: 'GBP', status: 'Pending', dueDate: '', reference: '' });
                    setShowAddPayment(false);
                    setPaymentSaving(false);
                  }} className="bg-white rounded-lg shadow-modal w-full max-w-md overflow-hidden">
                    <div className="p-6 border-b border-black/5">
                      <h3 className="text-sm font-medium text-obsidian">Add Payment Entry</h3>
                    </div>
                    <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                      <div>
                        <label className="text-xs text-muted block mb-1">Description *</label>
                        <input required type="text" value={paymentForm.description} onChange={e => setPaymentForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Initial PRP Session — Session 1" className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted block mb-1">Amount (£) *</label>
                          <input required type="number" min="0" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="text-xs text-muted block mb-1">Status</label>
                          <select value={paymentForm.status} onChange={e => setPaymentForm(p => ({ ...p, status: e.target.value as Payment['status'] }))} className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20">
                            <option>Pending</option><option>Paid</option><option>Overdue</option><option>Refunded</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted block mb-1">Due Date</label>
                          <input type="date" value={paymentForm.dueDate} onChange={e => setPaymentForm(p => ({ ...p, dueDate: e.target.value }))} className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="text-xs text-muted block mb-1">Reference</label>
                          <input type="text" value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} placeholder="INV-001" className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                        </div>
                      </div>
                    </div>
                    <div className="p-6 border-t border-black/5 flex gap-3 justify-end bg-cream/30">
                      <button type="button" onClick={() => setShowAddPayment(false)} className="px-5 py-2.5 text-xs text-muted hover:text-obsidian">Cancel</button>
                      <button type="submit" disabled={paymentSaving} className="bg-primary text-obsidian px-6 py-2.5 rounded-xl text-xs text-muted disabled:opacity-50">
                        {paymentSaving ? 'Saving…' : 'Add Entry'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          );
        })()}
        </div>
        {/* /main column */}
      </div>
      {/* /2-column grid */}

      {/* Reschedule Modal */}
      {rescheduleApt && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRescheduleApt(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitReschedule} className="bg-white rounded-lg shadow-modal w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <h3 className="text-sm font-medium text-obsidian">Reschedule Appointment</h3>
              <p className="text-2xs text-muted font-medium mt-1">{rescheduleApt.type} — currently {rescheduleApt.date} {rescheduleApt.time}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-muted block mb-2">New Date</label>
                <input
                  type="date"
                  required
                  value={rescheduleForm.date}
                  onChange={(e) => setRescheduleForm(p => ({ ...p, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-2">New Time</label>
                <select
                  required
                  value={rescheduleForm.time}
                  onChange={(e) => setRescheduleForm(p => ({ ...p, time: e.target.value }))}
                  className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select time...</option>
                  {['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM','05:00 PM'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {rescheduleStatus === 'error' && (
                <p className="text-2xs font-medium text-red-500">Failed to reschedule. Please try again.</p>
              )}
            </div>
            <div className="p-6 border-t border-black/5 flex gap-3 justify-end bg-cream/30">
              <button type="button" onClick={() => setRescheduleApt(null)} className="px-5 py-2.5 text-xs text-muted hover:text-obsidian transition-colors">Cancel</button>
              <button type="submit" disabled={rescheduleStatus === 'saving' || !rescheduleForm.date || !rescheduleForm.time} className="bg-primary text-obsidian px-6 py-2.5 rounded-xl text-xs text-muted disabled:opacity-50">
                {rescheduleStatus === 'saving' ? 'Saving…' : 'Confirm Reschedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Edit Modal */}
      {showQuickEdit && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowQuickEdit(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitQuickEdit} className="bg-white rounded-lg shadow-modal w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <h3 className="text-sm font-medium text-obsidian">Quick Edit Profile</h3>
              <p className="text-2xs text-muted font-medium mt-1">Registry ID: {selectedClient.id}</p>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-xs text-muted block mb-2">Full Name</label>
                <input type="text" required value={quickEditForm.name} onChange={(e) => setQuickEditForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-2">Email</label>
                <input type="email" required value={quickEditForm.email} onChange={(e) => setQuickEditForm(p => ({ ...p, email: e.target.value }))} className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-2">Phone</label>
                <input type="tel" value={quickEditForm.phone} onChange={(e) => setQuickEditForm(p => ({ ...p, phone: e.target.value }))} className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-2">Address</label>
                <textarea value={quickEditForm.address} onChange={(e) => setQuickEditForm(p => ({ ...p, address: e.target.value }))} rows={2} className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>
              {quickEditStatus === 'error' && (
                <p className="text-2xs font-medium text-red-500">Failed to save. Please try again.</p>
              )}
            </div>
            <div className="p-6 border-t border-black/5 flex gap-3 justify-end bg-cream/30">
              <button type="button" onClick={() => setShowQuickEdit(false)} className="px-5 py-2.5 text-xs text-muted hover:text-obsidian transition-colors">Cancel</button>
              <button type="submit" disabled={quickEditStatus === 'saving' || !quickEditForm.name.trim() || !quickEditForm.email.trim()} className="bg-obsidian text-white px-6 py-2.5 rounded-xl text-xs text-muted disabled:opacity-50">
                {quickEditStatus === 'saving' ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default memo(ClientRecord);
