import React, { useState, useRef, memo } from 'react';
import { useAdminContext } from './context';
import { ClientRecordTab } from './context';
import { Card } from '../../components/Card';
import { InteractiveForm } from '../../components/InteractiveForm';
import { InternalNotesEditor, FeedbackEditor, MessageInputForm } from './AdminComponents';
import { FORMS } from '../../constants';
import {
  Camera, Upload, X, Plus, Image as ImageIcon, Loader2, ArrowLeft, CheckCircle,
  CalendarClock, FileText, CreditCard, ChevronDown, Send, GitCompare,
  Stethoscope, Pencil, Check,
  User as UserIcon, MessageSquare, Activity, Receipt, Ban,
  Phone, Mail, MapPin, Siren, Calendar as CalendarIcon,
} from 'lucide-react';
import { Card as UICard, CardHeader, Button as UIButton, Badge as UIBadge, StatusBadge as UIStatusBadge, EmptyState as UIEmptyState, useToast, Modal as UIModal, useConfirm } from '../../components/ui';

type ViewTab = 'snapshot' | 'plan' | 'files' | 'activity' | 'money';
import { storage, requestCheckout, CreateCheckoutInput } from '../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { processImageForUpload, validateImageFile, ACCEPTED_IMAGE_TYPES } from '../../imageUtils';
import { logClinicalAction } from '../../utils/auditLogger';
import { relativeTime, absoluteDateTime } from '../../utils/relativeTime';
import { notifyFeedbackReceived, notifyFormSent, notifyPaymentSent } from '../../utils/notificationService';
import { Appointment, TreatmentPlan, TreatmentPhase, Prescription, Payment } from '../../types';

const ClientRecord: React.FC = () => {
  const { toast } = useToast();
  const { confirm, ConfirmHost } = useConfirm();
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
    getFirstName,
    templates,
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
  const [rescheduleConflict, setRescheduleConflict] = useState(false);
  // "Save & add another" flag for the Add Phase / Prescription / Payment modals.
  // Set by the secondary submit button just before the form submits; the
  // submit handler reads + resets it to decide whether to keep the modal open.
  const addAnotherRef = useRef(false);
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

  // Payment link (Stripe Checkout) state
  const [showPaymentLink, setShowPaymentLink] = useState(false);
  const [paymentLinkForm, setPaymentLinkForm] = useState({ type: 'standalone' as CreateCheckoutInput['type'], amount: '', description: '' });
  const [paymentLinkSaving, setPaymentLinkSaving] = useState(false);

  // Gallery comparison
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  /** Sub-tab inside the Files tab — photos default (doctors check results
      far more often than paperwork); forms one tap away. */
  const [filesSubTab, setFilesSubTab] = useState<'forms' | 'photos'>('photos');
  /** Click-toggle "Send new form" dropdown (was hover-only, broken on touch). */
  const [showSendFormMenu, setShowSendFormMenu] = useState(false);
  /** Separate state for the Activity tab's quick-action form menu. */
  const [showActivityFormMenu, setShowActivityFormMenu] = useState(false);

  if (!selectedClient) return null;

  // Normalize the canonical ClientRecordTab state (kept for back-compat with external setters)
  // into a 5-tab view used by this component.
  const incomingToView: Record<ClientRecordTab, ViewTab> = {
    overview: 'snapshot',
    assessment: 'snapshot', // intake now lives inside Snapshot — alias kept so deep links still land
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
  const completedSessions = clientAppointments.filter(a => a.status === 'Completed').length;
  const clientMessages = messages.filter(m => m.senderId === selectedClient.id || m.recipientId === selectedClient.id);
  const redFlags: string[] = (() => {
    const flags = selectedClient.assessmentData?.answers?.['f9']?.value || selectedClient.assessmentData?.answers?.['m9']?.value;
    if (Array.isArray(flags) && flags.length > 0 && !flags.includes('None') && !flags.includes('None of the above')) return flags as string[];
    return [];
  })();

  // At-a-glance tab badges — surface what needs action so doctors don't have to
  // open every tab to discover unsigned forms, unpaid invoices, or new messages.
  const unsignedFormsCount = clientMessages.filter(m => m.type === 'form' && !m.isSigned).length;
  const overduePaymentCount = (selectedClient.payments || []).filter(p => p.status === 'Overdue').length;
  const openPaymentCount = overduePaymentCount + (selectedClient.payments || []).filter(p => p.status === 'Pending').length;
  const unreadFromPatientCount = clientMessages.filter(m => !m.read && m.senderId === selectedClient.id).length;

  /** Parse "10:30 AM" into minutes since midnight for conflict checks. */
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

  const openReschedule = (apt: Appointment) => {
    setRescheduleApt(apt);
    setRescheduleForm({ date: apt.date, time: apt.time });
    setRescheduleStatus('idle');
    setRescheduleConflict(false);
  };

  const submitReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleApt || !rescheduleForm.date || !rescheduleForm.time) return;

    // Conflict check — same logic as BookingModal, excluding the appointment being rescheduled
    const clinicianId = rescheduleApt.clinicianId;
    if (clinicianId && rescheduleForm.date && rescheduleForm.time) {
      const start = parseTime12h(rescheduleForm.time);
      if (start !== null) {
        const end = start + (rescheduleApt.durationMin ?? 30);
        const conflict = appointments.find(a => {
          if (a.id === rescheduleApt.id) return false;
          if (a.clinicianId !== clinicianId) return false;
          if (a.date !== rescheduleForm.date) return false;
          if (a.status === 'Cancelled' || a.status === 'No-Show') return false;
          const aStart = parseTime12h(a.time);
          if (aStart === null) return false;
          const aEnd = aStart + (a.durationMin ?? 30);
          return start < aEnd && end > aStart;
        });
        if (conflict) {
          // Clear the clashing time and flag the field so the doctor
          // immediately sees where to act instead of re-submitting the same slot.
          setRescheduleConflict(true);
          setRescheduleForm(p => ({ ...p, time: '' }));
          toast.error('Scheduling conflict', {
            description: `${conflict.doctorName ?? 'This clinician'} already has "${conflict.type}" with ${conflict.clientName} at ${conflict.time} on ${conflict.date}. Pick a different time.`,
            duration: 8000,
          });
          return;
        }
      }
    }

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
      {ConfirmHost}
      {/* ── Sticky patient bar (always visible) ───────────────────────────── */}
      <div className="sticky top-[52px] z-30 -mx-4 sm:-mx-6 lg:-mx-4 px-4 sm:px-6 lg:px-4 py-2 lg:py-3 bg-ivory/95 backdrop-blur border-b border-sand">
        <div className="flex items-center gap-3">
          <UIButton variant="ghost" size="sm" onClick={() => setSelectedClientId(null)} aria-label="Back to list">
            <ArrowLeft size={14} />
          </UIButton>
          <div className="avatar avatar-md max-sm:!w-7 max-sm:!h-7 max-sm:!text-[10px] shrink-0">{getInitials(selectedClient.name)}</div>
          <div className="min-w-0 flex-grow">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-obsidian truncate">{selectedClient.name}</h2>
              {selectedClient.policiesAccepted && (
                <CheckCircle size={13} className="text-success shrink-0" />
              )}
              <div className="hidden md:block shrink-0">
                <UIStatusBadge status={selectedClient.status || 'Active'} />
              </div>
            </div>
            <p className="text-xs text-muted truncate mt-0.5">
              <span className="font-mono">{selectedClient.id}</span>
              <span className="hidden xs:inline"> · {String(calculateAge(selectedClient.dob)).replace('(', '').replace(')', '').trim() || 'No DOB'}</span>
              <span className="hidden sm:inline capitalize"> · {selectedClient.gender}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <UIButton variant="ghost" size="sm" onClick={openQuickEdit} aria-label="Quick edit">
              <Pencil size={13} />
            </UIButton>
            <UIButton variant="primary" size="sm" className="max-sm:min-h-[44px]" leadingIcon={<CalendarClock size={13} />} onClick={() => openBookingModal(selectedClient.id)}>
              <span className="hidden md:inline">Book appointment</span>
              <span className="md:hidden">Book</span>
            </UIButton>
          </div>
        </div>
      </div>

      {/* ── Tab bar (sticky just below patient bar) ─────────────────────────
          Assessment tab only appears when the patient has assessment data —
          walk-in patients don't see an empty assessment tab. */}
      <div className="sticky top-[108px] z-20 -mx-4 sm:-mx-6 lg:-mx-4 px-4 sm:px-6 lg:px-4 py-2 bg-ivory/95 backdrop-blur border-b border-sand">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {([
            { id: 'snapshot', label: 'Snapshot', icon: <UserIcon size={13} />,        badge: 0,                     danger: false },
            { id: 'plan',     label: 'Plan',     icon: <Activity size={13} />,        badge: 0,                     danger: false },
            { id: 'files',    label: 'Files',    icon: <FileText size={13} />,        badge: unsignedFormsCount,    danger: false },
            { id: 'activity', label: 'Activity', icon: <MessageSquare size={13} />,   badge: unreadFromPatientCount, danger: false },
            { id: 'money',    label: 'Money',    icon: <Receipt size={13} />,         badge: openPaymentCount,      danger: overduePaymentCount > 0 },
          ] as { id: ViewTab; label: string; icon: React.ReactNode; badge: number; danger: boolean }[]).map(tab => (
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
              {tab.badge > 0 && (
                <span className={`ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold inline-flex items-center justify-center ${
                  viewTab === tab.id ? 'bg-white/25 text-white'
                    : tab.danger ? 'bg-danger text-white'
                    : 'bg-primary/15 text-primary'
                }`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2-column layout: Identity rail (left, desktop only) + main content (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start mt-4">
        {/* Identity rail */}
        <aside className="hidden lg:flex flex-col gap-4 lg:sticky lg:top-[160px]">
          {/* Single combined "Patient details" card — replaces two separate
              Contact + Lifecycle cards. Less stacking, more breathing room. */}
          <UICard>
            <div className="flex flex-col gap-4">
              {/* Patient stage (was "Lifecycle" — renamed to clinical-friendly term) */}
              <div>
                <label
                  className="text-xs text-muted block mb-1.5"
                  title="Track where this patient is in their journey — from new inquiry through to active treatment."
                >
                  Patient stage
                </label>
                <select
                  value={selectedClient.status}
                  onChange={async (e) => {
                    const nextStatus = e.target.value;
                    const isDischarge = nextStatus === 'Not Suitable';
                    // Confirm before discharging a patient — this changes
                    // how they're filtered in segments and affects reporting.
                    if (isDischarge) {
                      const ok = await confirm({
                        title: `Mark ${selectedClient.name} as Not Suitable?`,
                        description: 'This effectively discharges the patient. They will be removed from active segments and active reports. You can change this back at any time.',
                        confirmLabel: 'Mark as Not Suitable',
                        tone: 'danger',
                      });
                      if (!ok) {
                        // Revert the visual select state by re-rendering
                        e.target.value = selectedClient.status || '';
                        return;
                      }
                    }
                    try {
                      await onUpdateClient(selectedClient.id, { status: nextStatus });
                    } catch (error) {
                      console.error('Failed to update client status:', error);
                    }
                  }}
                  className="w-full bg-cream border border-sand text-obsidian text-base sm:text-sm rounded-md px-3 py-2 focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  title="Track where this patient is in their journey — from new inquiry through to active treatment."
                >
                  {['New Inquiry', 'Assessment Submitted', 'Reviewed', 'Contacted', 'Converted', 'Not Suitable', 'Active', 'Ongoing'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Sessions + upcoming compact strap */}
              <div className="grid grid-cols-2 gap-3 py-3 border-y border-sand">
                <div>
                  <p className="text-xs text-muted">Sessions</p>
                  <p className="text-base font-medium text-obsidian mt-0.5">{completedSessions}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Upcoming</p>
                  <p className="text-base font-medium text-obsidian mt-0.5">{upcomingAppointments.length}</p>
                </div>
              </div>

              {/* Contact details */}
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
            </div>
          </UICard>

          {/* Compact upcoming bookings — moved out of Snapshot main column to
              keep Snapshot focused on Clinical Feedback. */}
          <UICard>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarClock size={14} className="text-muted" />
                <h3 className="text-sm font-medium text-obsidian">Upcoming</h3>
              </div>
              <UIButton variant="ghost" size="sm" onClick={() => openBookingModal(selectedClient.id)} aria-label="Book appointment">
                <Plus size={13} />
              </UIButton>
            </div>
            {upcomingAppointments.length === 0 ? (
              <button
                onClick={() => openBookingModal(selectedClient.id)}
                className="w-full text-xs text-muted hover:text-obsidian text-left py-1 transition-colors"
              >
                No bookings — tap + to schedule
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingAppointments.slice(0, 3).map(apt => (
                  <button
                    key={apt.id}
                    onClick={() => openReschedule(apt)}
                    className="text-left p-2 -mx-2 rounded-md hover:bg-cream/60 transition-colors"
                  >
                    <p className="text-sm font-medium text-obsidian truncate">{apt.type}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(apt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · {apt.time}
                    </p>
                  </button>
                ))}
                {upcomingAppointments.length > 3 && (
                  <p className="text-xs text-hint mt-1">+ {upcomingAppointments.length - 3} more</p>
                )}
              </div>
            )}
          </UICard>

          <InternalNotesEditor
            entries={selectedClient.internalNoteEntries || []}
            legacyNote={selectedClient.internalNotes}
            authorId={user?.id || 'admin'}
            authorName={user?.fullName}
            onAddEntry={async (entry) => {
              const next = [...(selectedClient.internalNoteEntries || []), entry];
              await onUpdateClient(selectedClient.id, { internalNoteEntries: next });
              await logClinicalAction(user?.id || 'admin', 'add_internal_note', selectedClient.id, `Added internal note: "${entry.body.slice(0, 80)}${entry.body.length > 80 ? '…' : ''}"`);
            }}
          />
        </aside>

        {/* Main content column */}
        <div className="min-w-0">
        {viewTab === 'snapshot' && (
          <div className="flex flex-col gap-5">
            {/* Next appointment + prep — opens the record answering "why is this
                patient here, and what's still outstanding" in one glance. */}
            {(() => {
              const nextApt = upcomingAppointments[0];
              const prep: { label: string; danger: boolean }[] = [];
              if (unsignedFormsCount > 0) prep.push({ label: `${unsignedFormsCount} form${unsignedFormsCount > 1 ? 's' : ''} unsigned`, danger: false });
              if (openPaymentCount > 0) prep.push({ label: overduePaymentCount > 0 ? 'Payment overdue' : 'Payment pending', danger: overduePaymentCount > 0 });
              if (!selectedClient.policiesAccepted) prep.push({ label: 'Policies pending', danger: true });
              if (!nextApt && prep.length === 0) return null; // nothing to surface — avoid clutter
              return (
                <UICard className="order-0 max-sm:!px-3 max-sm:!py-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-grow">
                      <CalendarClock size={16} className="text-primary shrink-0" />
                      {nextApt ? (
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-obsidian truncate">
                            {nextApt.type} · {new Date(nextApt.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {nextApt.time}
                          </p>
                          <p className="text-xs text-muted truncate">{nextApt.doctorName || 'Unassigned'}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted">No upcoming session booked</p>
                      )}
                    </div>
                    {prep.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {prep.map((p, i) => (
                          <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs ${p.danger ? 'bg-danger-bg text-danger-text' : 'bg-cream text-obsidian'}`}>{p.label}</span>
                        ))}
                      </div>
                    )}
                    <UIButton variant={nextApt ? 'secondary' : 'primary'} size="sm" onClick={() => openBookingModal(selectedClient.id)}>
                      {nextApt ? 'Book follow-up' : 'Book'}
                    </UIButton>
                  </div>
                </UICard>
              );
            })()}

            {/* Mobile: contact + status compressed into a single line shown only when rail is hidden */}
            <div className="lg:hidden flex items-center gap-2 px-1 order-1">
              <UIStatusBadge status={selectedClient.status || 'Active'} />
              <span className="text-xs text-muted truncate">{selectedClient.email}</span>
            </div>

            {/* 3-stat row removed — Sessions completed is in the left rail;
                Next session is inside Upcoming bookings card below; Pending
                forms is in the Files tab. The duplication was crowding the
                snapshot. */}

            {/* Red flags (only if any) — appear right after status so doctors see them immediately */}
            {redFlags.length > 0 && (
              <UICard
                className="!bg-danger-bg !border-danger/20 order-2 max-sm:!px-3 max-sm:!py-2.5"
                title="Safety concerns surfaced from the patient's intake form. Review these before planning any treatment."
              >
                <div className="flex items-start gap-3">
                  <Siren size={16} className="text-danger mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-danger-text mb-1.5">Clinical red flags</p>
                    {/* Explainer hidden on phones — the chips carry the content;
                        keeps the safety card compact so feedback is visible sooner. */}
                    <p className="hidden sm:block text-xs text-danger-text/80 mb-3">Items flagged in the intake form that may affect treatment suitability.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {redFlags.map((flag, i) => <UIBadge key={i} variant="danger">{flag}</UIBadge>)}
                    </div>
                  </div>
                </div>
              </UICard>
            )}

            {/* Decision support — clinical feedback editor.
                Promoted to the top of Snapshot (after status + red flags) because
                this is the doctor's primary deliverable for each patient. */}
            <UICard accent="gold" className="order-3">
              <CardHeader
                title="Clinical feedback"
                subtitle={
                  selectedClient.assessmentData?.clinicalFeedback ? (
                    `Last updated ${selectedClient.assessmentData.reviewDate ? new Date(selectedClient.assessmentData.reviewDate).toLocaleDateString('en-GB') : 'recently'}`
                  ) : (
                    'Not yet submitted — client is waiting'
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

            {/* Intake assessment — full Q&A + photos, collapsed by default.
                Merged from the former Assessment tab so the record is 5 tabs
                and the intake is one tap away from the feedback editor. */}
            {selectedClient.assessmentData?.answers && (
              <details className="order-4">
                <summary className="cursor-pointer text-sm font-medium text-obsidian px-4 py-3 bg-white border border-sand rounded-md flex items-center justify-between">
                  <span>
                    Intake assessment
                    <span className="text-xs text-muted font-normal ml-2">
                      Submitted {selectedClient.createdAt
                        ? new Date(selectedClient.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : 'recently'}
                    </span>
                  </span>
                  <ChevronDown size={14} />
                </summary>
                <div className="mt-2 flex flex-col gap-3">
                  {(() => {
                    const answers = selectedClient.assessmentData?.answers || {};
                    const photoUrls: string[] = ['f26', 'm22']
                      .map(k => answers[k])
                      .filter(Boolean)
                      .flatMap(a => (Array.isArray(a!.value) ? (a!.value as string[]) : []));
                    return photoUrls.length > 0 ? (
                      <UICard>
                        <CardHeader title="Submitted photos" subtitle="Tap to enlarge" />
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {photoUrls.map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setLightboxImage({
                                id: `assessment-${i}`,
                                url,
                                label: `Assessment photo ${i + 1}`,
                                uploadedAt: selectedClient.createdAt ?? new Date().toISOString(),
                                source: 'Assessment',
                              })}
                              className="block aspect-square rounded-md overflow-hidden bg-cream border border-sand hover:border-primary/40 transition-colors"
                            >
                              <img src={url} alt={`Assessment photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      </UICard>
                    ) : null;
                  })()}

                  <UICard>
                    <CardHeader title="Hair concerns & goals" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      {Object.entries(selectedClient.assessmentData?.answers || {})
                        .filter(([key]) => ['f1','f2','f3','f4','f5','m1','m2','m3','m4','m5'].includes(key))
                        .map(([key, val]: [string, any]) => (
                          <div key={key}>
                            <p className="text-xs text-muted leading-tight">{val.text}</p>
                            <p className="text-sm text-obsidian leading-relaxed mt-1">
                              {Array.isArray(val.value) ? val.value.join(', ') : val.value || '—'}
                            </p>
                          </div>
                        ))}
                    </div>
                  </UICard>

                  <UICard>
                    <CardHeader
                      title="Medical & safety screening"
                      subtitle="Significant answers are highlighted"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                      {Object.entries(selectedClient.assessmentData?.answers || {})
                        .filter(([key]) => !['f1','f2','f3','f4','f5','m1','m2','m3','m4','m5','f26','m22'].includes(key))
                        .map(([key, val]: [string, any]) => {
                          const isSignificant = val.value && val.value !== 'No' && val.value !== 'None' && !String(val.value).includes('None');
                          return (
                            <div key={key} className={`p-2 -m-2 rounded-sm ${isSignificant ? 'bg-danger-bg' : ''}`}>
                              <p className="text-xs text-muted leading-tight">{val.text}</p>
                              <p className={`text-sm leading-relaxed mt-1 ${isSignificant ? 'text-danger-text font-medium' : 'text-obsidian'}`}>
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

            {/* Mobile-only: contact + notes accordion (since identity rail is hidden).
                Open by default so contact details are glanceable; still collapsible. */}
            <details open className="lg:hidden">
              <summary className="cursor-pointer text-sm font-medium text-obsidian px-4 py-3 bg-white border border-sand rounded-md flex items-center justify-between">
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
                  entries={selectedClient.internalNoteEntries || []}
                  legacyNote={selectedClient.internalNotes}
                  authorId={user?.id || 'admin'}
                  authorName={user?.fullName}
                  onAddEntry={async (entry) => {
                    const next = [...(selectedClient.internalNoteEntries || []), entry];
                    await onUpdateClient(selectedClient.id, { internalNoteEntries: next });
                    await logClinicalAction(user?.id || 'admin', 'add_internal_note', selectedClient.id, `Added internal note: "${entry.body.slice(0, 80)}${entry.body.length > 80 ? '…' : ''}"`);
                  }}
                />
              </div>
            </details>
          </div>
        )}

        {viewTab === 'activity' && (
          <div className="grid grid-cols-1 gap-4 md:gap-8">
            <div className="space-y-4 md:space-y-6">
              <Card className="p-4 md:p-8 max-h-[60vh] min-h-[320px] flex flex-col">
                <h3 className="text-2xs md:text-xs font-medium text-muted mb-4 md:mb-6">Communication Log</h3>
                {/* min-h-0 is required: flex children default to min-height auto,
                    which would defeat the max-h cap and stop inner scrolling. */}
                <div className="flex-grow min-h-0 overflow-y-auto space-y-4 md:space-y-6 pr-2 no-scrollbar">
                  {(messages.filter(m => m.senderId === selectedClientId || m.recipientId === selectedClientId) || []).map((msg) => (
                    <div key={msg.id} className={`flex ${msg.senderId === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] md:max-w-[80%] px-3 py-2 md:px-4 md:py-3 rounded-lg ${
                        msg.senderId === 'admin'
                          ? 'bg-primary/10 text-obsidian border border-primary/20'
                          : 'bg-cream text-obsidian border border-sand'
                      } ${
                        msg.type === 'form' ? 'border-l-[3px] border-l-warning' :
                        msg.type === 'payment' ? 'border-l-[3px] border-l-success' : ''
                      }`}>
                        {msg.type === 'form' ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-primary">
                              <FileText size={16} />
                              <span className="text-xs text-muted">Form Attachment</span>
                            </div>
                            <p className="text-2xs md:text-xs leading-relaxed font-medium truncate">{FORMS.find(f => f.id === msg.formId)?.title || msg.subject}</p>
                            <button
                              onClick={() => setViewingForm(msg)}
                              className="block w-full bg-primary text-obsidian text-center py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-all"
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
                            <p className="text-2xs md:text-xs leading-relaxed font-medium truncate">{msg.body?.split(': ')[0] || msg.body}</p>
                            <a
                              href={msg.paymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full bg-primary text-obsidian text-center py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-all"
                            >
                              View Stripe Link
                            </a>
                          </div>
                        ) : (
                          <p className="text-2xs md:text-xs leading-relaxed mb-2">{msg.body}</p>
                        )}
                        <div className="flex justify-between items-center gap-4 mt-2">
                          <span className="text-xs font-medium text-muted">{msg.senderId === 'admin' ? 'You' : getFirstName(selectedClient.name)}</span>
                          <span className="text-xs text-hint" title={msg.createdAt ? absoluteDateTime(msg.createdAt) : undefined}>
                            {msg.createdAt ? relativeTime(msg.createdAt) : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-black/5">
                  {/* Quick actions — keep form-sending and payment requests inside
                      the conversation instead of a tab-switch away. */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <div className="relative">
                      <UIButton
                        variant="ghost"
                        size="sm"
                        leadingIcon={<FileText size={13} />}
                        trailingIcon={<ChevronDown size={12} className={showActivityFormMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />}
                        onClick={() => setShowActivityFormMenu(s => !s)}
                      >
                        Send form
                      </UIButton>
                      {showActivityFormMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowActivityFormMenu(false)} />
                          <div className="absolute left-0 bottom-full mb-2 w-64 bg-white rounded-lg shadow-panel border border-sand z-50 p-2 space-y-1">
                            {FORMS.map(form => (
                              <button
                                key={form.id}
                                onClick={() => { handleSendForm(form.id); setShowActivityFormMenu(false); }}
                                className="w-full text-left px-4 py-3 hover:bg-cream rounded-md text-sm font-medium text-obsidian flex items-center justify-between"
                              >
                                {form.title}
                                <Send size={14} className="text-primary" />
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <UIButton
                      variant="ghost"
                      size="sm"
                      leadingIcon={<CreditCard size={13} />}
                      onClick={() => setViewTab('money')}
                    >
                      Request payment
                    </UIButton>
                  </div>
                  <MessageInputForm
                    onSend={(msg) => handleSendMessage(msg, selectedClientId || '')}
                    templates={templates.filter(t => t.category === 'message')}
                  />
                </div>
              </Card>
            </div>
          </div>
        )}

        {viewTab === 'files' && (
          <div className="space-y-3">
            {/* Sub-tab bar: Forms vs Photos — split because they're unrelated. */}
            <div className="flex gap-1 bg-cream p-0.5 rounded-md w-fit">
              <button
                onClick={() => setFilesSubTab('photos')}
                className={`px-3 py-1.5 rounded-sm text-sm transition-colors inline-flex items-center gap-1.5 ${
                  filesSubTab === 'photos' ? 'bg-white text-obsidian shadow-sm font-medium' : 'text-muted hover:text-obsidian'
                }`}
              >
                <Camera size={13} />
                Photos
              </button>
              <button
                onClick={() => setFilesSubTab('forms')}
                className={`px-3 py-1.5 rounded-sm text-sm transition-colors inline-flex items-center gap-1.5 ${
                  filesSubTab === 'forms' ? 'bg-white text-obsidian shadow-sm font-medium' : 'text-muted hover:text-obsidian'
                }`}
              >
                <FileText size={13} />
                Forms
              </button>
            </div>
          </div>
        )}

        {viewTab === 'files' && filesSubTab === 'forms' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xl font-medium text-obsidian">Sent & Signed Forms</h3>
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowSendFormMenu(!showSendFormMenu)}
                  className="w-full bg-primary text-obsidian px-6 py-2 rounded-full text-xs font-medium flex items-center justify-center gap-2"
                >
                  Send New Form
                  <ChevronDown size={16} className={showSendFormMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {showSendFormMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSendFormMenu(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-panel border border-black/5 z-50 p-2 space-y-1">
                      {FORMS.map(form => (
                        <button
                          key={form.id}
                          onClick={() => { handleSendForm(form.id); setShowSendFormMenu(false); }}
                          className="w-full text-left px-4 py-3 hover:bg-cream rounded-md text-sm font-medium text-obsidian flex items-center justify-between"
                        >
                          {form.title}
                          <Send size={14} className="text-primary" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
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
                        <UIBadge variant={msg.isSigned ? 'active' : 'pending'}>
                          {msg.isSigned ? 'Signed' : 'Pending'}
                        </UIBadge>
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
                      <th className="px-6 py-4">Form Name & Status</th>
                      <th className="px-6 py-4">Timeline</th>
                      <th className="px-6 py-4 text-right">Actions</th>
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
                            <td className="px-6 py-4">
                              <div className="flex flex-col items-start gap-2">
                                <span className="font-medium text-sm text-obsidian">{form?.title || msg.subject}</span>
                                <UIBadge variant={msg.isSigned ? 'active' : 'pending'}>
                                  {msg.isSigned ? 'Signed' : 'Pending'}
                                </UIBadge>
                              </div>
                            </td>
                            <td className="px-6 py-4">
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
                            <td className="px-6 py-4 text-right">
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

        {viewTab === 'files' && filesSubTab === 'photos' && (() => {
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
                <UICard accent="gold">
                  <div className="flex items-center gap-3 mb-4">
                    <GitCompare size={18} className="text-primary" />
                    <h4 className="text-sm font-medium text-obsidian">Before / After Comparison</h4>
                    <span className="text-xs text-muted ml-auto">Select two photos below</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {['Before', 'After'].map((label, idx) => {
                      const selectedId = idx === 0 ? compareA : compareB;
                      const selectedImg = gallery.find(g => g.id === selectedId);
                      return (
                        <div key={label} className="space-y-2">
                          <p className="text-xs font-medium text-muted uppercase tracking-wider">{label}</p>
                          <div className="aspect-square rounded-lg overflow-hidden border-2 border-dashed border-sand bg-cream flex items-center justify-center relative">
                            {selectedImg ? (
                              <>
                                <img src={selectedImg.url} alt={selectedImg.label} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" />
                                <button onClick={() => idx === 0 ? setCompareA(null) : setCompareB(null)} className="absolute top-2 right-2 w-9 h-9 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/80">
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
                      <div className="p-4 bg-cream rounded-md border border-sand text-center">
                        <p className="text-xs font-medium text-muted uppercase tracking-wider">Timeline gap between selected photos</p>
                        <p className="text-xl font-medium text-obsidian mt-1">{daysDiff} days</p>
                      </div>
                    );
                  })()}
                </UICard>
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
                            <UIBadge variant={isSelectedA ? 'active' : 'new'}>
                              {isSelectedA ? 'Before' : 'After'}
                            </UIBadge>
                          )}
                          <UIBadge variant={img.source === 'Clinical' ? 'review' : 'inactive'}>
                            {img.source}
                          </UIBadge>
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

        {/* ── Assessment tab — full intake questionnaire view ──────────────
            Tab is only shown when selectedClient.assessmentData?.answers exists
            (controlled by the `show: !!selectedClient.assessmentData?.answers`
            filter in the tab bar above), so the section below is unconditional
            on data presence — it's already gated. */}
        {/* ── Treatment Plan tab ────────────────────────────────────────── */}
        {viewTab === 'plan' && (() => {
          const plan = selectedClient.treatmentPlan;
          const rxList = selectedClient.prescriptions || [];
          const totalPhases = plan?.phases.length || 0;
          const completedPhases = plan?.phases.filter(p => p.status === 'Completed').length || 0;
          const totalSessions = plan?.phases.reduce((s, p) => s + p.sessionsPlanned, 0) || 0;
          const completedSessions = plan?.phases.reduce((s, p) => s + p.sessionsCompleted, 0) || 0;
          return (
            <div className="animate-fade-up space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left: Plan phases */}
                <div className="lg:col-span-8 space-y-4">
                  <UICard>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-sm font-medium text-obsidian">Treatment plan</h3>
                        {plan?.title && <p className="text-base font-medium text-obsidian mt-1">{plan.title}</p>}
                      </div>
                      <UIButton variant="primary" size="sm" leadingIcon={<Plus size={13} />} onClick={() => { setPlanTitle(plan?.title || ''); setShowAddPhase(true); }}>
                        Add phase
                      </UIButton>
                    </div>

                    {!plan?.phases?.length ? (
                      <UIEmptyState
                        icon={<Stethoscope size={16} />}
                        title="No treatment plan yet"
                        description="Treatment plans are made up of phases (e.g. '3-month intensive PRP'). Add the first phase whenever you're ready — you can do this at any time."
                        action={
                          <UIButton variant="primary" size="sm" leadingIcon={<Plus size={13} />} onClick={() => { setPlanTitle(plan?.title || ''); setShowAddPhase(true); }}>
                            Add first phase
                          </UIButton>
                        }
                      />
                    ) : (
                      <div className="space-y-4">
                        {plan.phases.map((phase, i) => {
                          const pct = phase.sessionsPlanned > 0 ? Math.round((phase.sessionsCompleted / phase.sessionsPlanned) * 100) : 0;
                          const phaseStatusVariant: Record<string, 'active' | 'pending' | 'new' | 'inactive'> = {
                            Active: 'active', Completed: 'new', Planned: 'inactive', 'On Hold': 'pending',
                          };
                          return (
                            <div key={phase.id} className="p-4 md:p-5 rounded-md border border-sand bg-white">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-md bg-gold-soft text-gold-dim flex items-center justify-center text-xs font-medium shrink-0">{i + 1}</div>
                                  <div>
                                    <p className="text-sm font-medium text-obsidian">{phase.name}</p>
                                    {phase.description && <p className="text-xs text-muted mt-0.5">{phase.description}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <UIBadge variant={phaseStatusVariant[phase.status] || 'inactive'}>{phase.status}</UIBadge>
                                  <button onClick={() => { setEditingPhaseId(phase.id); setEditPhaseForm({ status: phase.status, sessionsCompleted: phase.sessionsCompleted, notes: phase.notes }); }} className="btn-icon" aria-label="Edit phase">
                                    <Pencil size={13} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-4">
                                <div className="flex-grow h-1.5 bg-sand rounded-full overflow-hidden">
                                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-medium text-obsidian shrink-0">{phase.sessionsCompleted}/{phase.sessionsPlanned} sessions</span>
                              </div>
                              {phase.notes && <p className="text-xs text-muted mt-3 leading-relaxed">"{phase.notes}"</p>}
                              {phase.startDate && <p className="text-xs text-hint mt-2">Started {new Date(phase.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                              {/* Inline edit panel */}
                              {editingPhaseId === phase.id && (
                                <div className="mt-4 pt-4 border-t border-black/5 space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-2xs text-muted block mb-1">Status</label>
                                      <select value={editPhaseForm.status || phase.status} onChange={e => setEditPhaseForm(p => ({ ...p, status: e.target.value as TreatmentPhase['status'] }))} className="w-full bg-white border-black/10 rounded-lg px-3 py-2 text-base sm:text-xs font-medium">
                                        <option>Planned</option><option>Active</option><option>Completed</option><option>On Hold</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-2xs text-muted block mb-1">Sessions Done</label>
                                      <input type="number" min={0} max={phase.sessionsPlanned} value={editPhaseForm.sessionsCompleted ?? phase.sessionsCompleted} onChange={e => setEditPhaseForm(p => ({ ...p, sessionsCompleted: Number(e.target.value) }))} className="w-full bg-white border-black/10 rounded-lg px-3 py-2 text-base sm:text-xs font-medium" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-2xs text-muted block mb-1">Notes</label>
                                    <textarea value={editPhaseForm.notes ?? phase.notes ?? ''} onChange={e => setEditPhaseForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full bg-white border-black/10 rounded-lg px-3 py-2 text-base sm:text-xs font-medium resize-none" />
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
                                    }} disabled={treatmentPlanSaving} className="bg-obsidian text-white px-4 py-1.5 rounded-md text-xs font-medium disabled:opacity-50">
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
                  </UICard>

                  {/* Prescriptions */}
                  <UICard>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-obsidian">Prescriptions</h3>
                      <UIButton variant="primary" size="sm" leadingIcon={<Plus size={13} />} onClick={() => setShowAddRx(true)}>
                        Add prescription
                      </UIButton>
                    </div>
                    {!rxList.length ? (
                      <UIEmptyState
                        icon={<FileText size={16} />}
                        title="No prescriptions yet"
                        description="Add a prescription to track patient medications."
                        compact
                      />
                    ) : (
                      <div className="space-y-2">
                        {rxList.map(rx => {
                          const rxStatusVariant: Record<string, 'active' | 'new' | 'inactive'> = {
                            Active: 'active', Completed: 'new', Discontinued: 'inactive',
                          };
                          return (
                            <div key={rx.id} className={`flex items-center justify-between p-4 rounded-md border border-sand bg-white hover:bg-cream/40 transition-colors ${rx.status !== 'Active' ? 'opacity-60' : ''}`}>
                              <div>
                                <p className="text-sm font-medium text-obsidian">{rx.drugName}</p>
                                <p className="text-xs text-muted mt-0.5">{rx.dosage} — {rx.instructions}</p>
                                <p className="text-xs text-hint mt-1">
                                  From {new Date(rx.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  {rx.endDate ? ` → ${new Date(rx.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <UIBadge variant={rxStatusVariant[rx.status] || 'inactive'}>{rx.status}</UIBadge>
                                {rx.status === 'Active' && (
                                  <button onClick={async () => {
                                    const ok = await confirm({
                                      title: `Discontinue ${rx.drugName}?`,
                                      description: 'This marks the prescription as discontinued. You can add a new prescription later if needed.',
                                      confirmLabel: 'Discontinue',
                                      tone: 'danger',
                                    });
                                    if (!ok) return;
                                    await onUpdatePrescription(selectedClient.id, rx.id, { status: 'Discontinued' });
                                  }} className="btn-icon hover:!text-danger" title="Discontinue">
                                    <Ban size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </UICard>
                </div>

                {/* Right: Summary card */}
                <div className="lg:col-span-4 space-y-4">
                  <UICard accent="gold">
                    <CardHeader title="Plan overview" />
                    <div className="space-y-5">
                      <div>
                        <p className="text-xs text-muted mb-1">Total phases</p>
                        <p className="text-xl font-medium text-obsidian">{totalPhases}</p>
                        <p className="text-xs text-muted mt-0.5">{completedPhases} completed</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Sessions progress</p>
                        <div className="h-1.5 bg-sand rounded-full overflow-hidden">
                          <div className="bg-primary h-full rounded-full" style={{ width: totalSessions > 0 ? `${Math.round((completedSessions / totalSessions) * 100)}%` : '0%' }} />
                        </div>
                        <p className="text-xs text-right mt-1 font-medium text-obsidian">{completedSessions}/{totalSessions}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted mb-1">Active prescriptions</p>
                        <p className="text-xl font-medium text-obsidian">{rxList.filter(r => r.status === 'Active').length}</p>
                      </div>
                      {plan?.adminNotes && (
                        <div className="p-4 bg-cream rounded-md border border-sand">
                          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Plan notes</p>
                          <p className="text-sm leading-relaxed text-obsidian">"{plan.adminNotes}"</p>
                        </div>
                      )}
                    </div>
                  </UICard>
                </div>
              </div>

              {/* Add Phase Modal */}
              <UIModal
                open={showAddPhase}
                onClose={() => setShowAddPhase(false)}
                title="Add Treatment Phase"
                size="md"
                footer={
                  <div className="flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowAddPhase(false)} className="px-4 py-2 text-sm text-muted hover:text-obsidian">Cancel</button>
                    <button
                      type="submit"
                      form="add-phase-form"
                      disabled={treatmentPlanSaving}
                      onClick={() => { addAnotherRef.current = true; }}
                      className="px-4 py-2 rounded-md text-sm font-medium text-obsidian bg-cream hover:bg-sand disabled:opacity-50 transition-colors"
                    >
                      Save & add another
                    </button>
                    <button
                      type="submit"
                      form="add-phase-form"
                      disabled={treatmentPlanSaving}
                      className="bg-primary text-obsidian px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                    >
                      {treatmentPlanSaving ? 'Saving…' : 'Add Phase'}
                    </button>
                  </div>
                }
              >
                <form
                  id="add-phase-form"
                  onSubmit={async (e) => {
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
                    if (addAnotherRef.current) {
                      addAnotherRef.current = false;
                      toast.success('Phase added', { description: 'Form cleared — add the next phase or close.' });
                    } else {
                      setShowAddPhase(false);
                    }
                    setTreatmentPlanSaving(false);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs text-muted block mb-1">Plan Title {!plan && <span className="text-primary">(first phase)</span>}</label>
                    <input type="text" value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="e.g. 12-Month PRP Protocol" className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                    <p className="text-xs text-hint mt-1">Set once — this names the whole plan. Each phase you add lives inside it.</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Phase Name <span className="text-red-400">*</span></label>
                    <input required type="text" value={phaseForm.name} onChange={e => setPhaseForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Initial Intensive" className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Description</label>
                    <input type="text" value={phaseForm.description} onChange={e => setPhaseForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of goals" className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Sessions Planned</label>
                    <input type="number" min={1} value={phaseForm.sessionsPlanned} onChange={e => setPhaseForm(p => ({ ...p, sessionsPlanned: Number(e.target.value) }))} className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Notes</label>
                    <textarea value={phaseForm.notes} onChange={e => setPhaseForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Clinical notes for this phase" className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 resize-none" />
                  </div>
                </form>
              </UIModal>

              {/* Add Prescription Modal */}
              <UIModal
                open={showAddRx}
                onClose={() => setShowAddRx(false)}
                title="Add Prescription"
                size="md"
                footer={
                  <div className="flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowAddRx(false)} className="px-4 py-2 text-sm text-muted hover:text-obsidian">Cancel</button>
                    <button
                      type="submit"
                      form="add-rx-form"
                      disabled={rxSaving}
                      onClick={() => { addAnotherRef.current = true; }}
                      className="px-4 py-2 rounded-md text-sm font-medium text-obsidian bg-cream hover:bg-sand disabled:opacity-50 transition-colors"
                    >
                      Save & add another
                    </button>
                    <button
                      type="submit"
                      form="add-rx-form"
                      disabled={rxSaving}
                      className="bg-primary text-obsidian px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                    >
                      {rxSaving ? 'Saving…' : 'Add Prescription'}
                    </button>
                  </div>
                }
              >
                <form
                  id="add-rx-form"
                  onSubmit={async (e) => {
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
                    if (addAnotherRef.current) {
                      addAnotherRef.current = false;
                      toast.success('Prescription added', { description: 'Form cleared — add the next one or close.' });
                    } else {
                      setShowAddRx(false);
                    }
                    setRxSaving(false);
                  }}
                  className="space-y-4"
                >
                  {[
                    { label: 'Drug / Product Name *', field: 'drugName', required: true, placeholder: 'e.g. Minoxidil 5%' },
                    { label: 'Dosage *', field: 'dosage', required: true, placeholder: 'e.g. 1ml twice daily' },
                    { label: 'Instructions', field: 'instructions', required: false, placeholder: 'e.g. Apply to affected area in the morning' },
                    { label: 'Prescribed By', field: 'prescribedBy', required: false, placeholder: user?.fullName || '' },
                  ].map(({ label, field, required, placeholder }) => (
                    <div key={field}>
                      <label className="text-xs text-muted block mb-1">{label}</label>
                      <input required={required} type="text" value={(rxForm as Record<string, string>)[field]} onChange={e => setRxForm(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder} className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                    </div>
                  ))}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Start Date *</label>
                      <input required type="date" value={rxForm.startDate} onChange={e => setRxForm(p => ({ ...p, startDate: e.target.value }))} className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">End Date</label>
                      <input type="date" value={rxForm.endDate} onChange={e => setRxForm(p => ({ ...p, endDate: e.target.value }))} className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                    </div>
                  </div>
                </form>
              </UIModal>
            </div>
          );
        })()}

        {/* ── Financials tab ─────────────────────────────────────────────────── */}
        {viewTab === 'money' && (() => {
          const payList = selectedClient.payments || [];
          const totalPaid = payList.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
          const totalPending = payList.filter(p => p.status === 'Pending' || p.status === 'Overdue').reduce((s, p) => s + p.amount, 0);
          const formatAmount = (amount: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
          const payStatusVariant: Record<string, 'active' | 'pending' | 'danger' | 'inactive'> = {
            Paid: 'active', Pending: 'pending', Overdue: 'danger', Refunded: 'inactive',
          };
          return (
            <div className="animate-fade-up space-y-4">
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
              <UICard>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-obsidian">Payment history</h3>
                  <div className="flex items-center gap-2">
                    <UIButton variant="primary" size="sm" leadingIcon={<Send size={13} />} onClick={() => setShowPaymentLink(true)}>
                      Send payment link
                    </UIButton>
                    <UIButton variant="ghost" size="sm" leadingIcon={<Plus size={13} />} onClick={() => setShowAddPayment(true)}>
                      Add entry
                    </UIButton>
                  </div>
                </div>
                {!payList.length ? (
                  <UIEmptyState
                    icon={<CreditCard size={16} />}
                    title="No payments yet"
                    description="Deposits, session fees, and other charges appear here once recorded. Tap 'Add entry' to log the first payment."
                    compact
                  />
                ) : (
                  <div className="flex flex-col">
                    {payList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((pay, idx) => (
                      <div key={pay.id} className={`flex items-center justify-between gap-3 py-3 hover:bg-cream/30 transition-colors ${idx > 0 ? 'border-t border-sand' : ''}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-obsidian truncate">{pay.description}</p>
                          <p className="text-xs text-muted mt-0.5">
                            {pay.reference && <span className="font-mono mr-2">Ref: {pay.reference}</span>}
                            {pay.paidDate ? `Paid ${new Date(pay.paidDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : pay.dueDate ? `Due ${new Date(pay.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : new Date(pay.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <p className="text-sm font-medium text-obsidian">{formatAmount(pay.amount, pay.currency)}</p>
                          <UIBadge variant={payStatusVariant[pay.status] || 'inactive'}>{pay.status}</UIBadge>
                          {pay.status === 'Pending' && (
                            <UIButton
                              variant="ghost"
                              size="sm"
                              leadingIcon={<Check size={13} />}
                              onClick={async () => { await onUpdatePayment(selectedClient.id, pay.id, { status: 'Paid', paidDate: new Date().toISOString().split('T')[0] }); }}
                            >
                              Mark paid
                            </UIButton>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </UICard>

              {/* Add Payment Modal */}
              <UIModal
                open={showAddPayment}
                onClose={() => setShowAddPayment(false)}
                title="Add Payment Entry"
                size="md"
                footer={
                  <div className="flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowAddPayment(false)} className="px-4 py-2 text-sm text-muted hover:text-obsidian">Cancel</button>
                    <button
                      type="submit"
                      form="add-payment-form"
                      disabled={paymentSaving}
                      onClick={() => { addAnotherRef.current = true; }}
                      className="px-4 py-2 rounded-md text-sm font-medium text-obsidian bg-cream hover:bg-sand disabled:opacity-50 transition-colors"
                    >
                      Save & add another
                    </button>
                    <button
                      type="submit"
                      form="add-payment-form"
                      disabled={paymentSaving}
                      className="bg-primary text-obsidian px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                    >
                      {paymentSaving ? 'Saving…' : 'Add Entry'}
                    </button>
                  </div>
                }
              >
                <form
                  id="add-payment-form"
                  onSubmit={async (e) => {
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
                    if (addAnotherRef.current) {
                      addAnotherRef.current = false;
                      toast.success('Payment entry added', { description: 'Form cleared — add the next one or close.' });
                    } else {
                      setShowAddPayment(false);
                    }
                    setPaymentSaving(false);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs text-muted block mb-1">Description *</label>
                    <input required type="text" value={paymentForm.description} onChange={e => setPaymentForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Initial PRP Session — Session 1" className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Amount (£) *</label>
                      <input required type="number" min="0" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Status</label>
                      <select value={paymentForm.status} onChange={e => setPaymentForm(p => ({ ...p, status: e.target.value as Payment['status'] }))} className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20">
                        <option>Pending</option><option>Paid</option><option>Overdue</option><option>Refunded</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Due Date</label>
                      <input type="date" value={paymentForm.dueDate} onChange={e => setPaymentForm(p => ({ ...p, dueDate: e.target.value }))} className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Reference</label>
                      <input type="text" value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} placeholder="INV-001" className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                    </div>
                  </div>
                </form>
              </UIModal>

              {/* Send Payment Link Modal — calls the deployed createCheckoutSession
                  callable, which creates the Pending Payment server-side, then
                  delivers the returned Stripe Checkout URL to the patient as a
                  'payment' message. */}
              <UIModal
                open={showPaymentLink}
                onClose={() => setShowPaymentLink(false)}
                title="Send Payment Link"
                subtitle="Generates a Stripe Checkout link and sends it to the patient."
                size="md"
                footer={
                  <div className="flex gap-3 justify-end">
                    <button type="button" onClick={() => setShowPaymentLink(false)} className="px-4 py-2 text-sm text-muted hover:text-obsidian">Cancel</button>
                    <button
                      type="submit"
                      form="payment-link-form"
                      disabled={paymentLinkSaving}
                      className="bg-primary text-obsidian px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                    >
                      {paymentLinkSaving ? 'Sending…' : 'Send payment link'}
                    </button>
                  </div>
                }
              >
                <form
                  id="payment-link-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPaymentLinkSaving(true);
                    // Track whether the Checkout link was created server-side, so a
                    // delivery failure doesn't tempt a resend (which would create a
                    // duplicate pending payment + Stripe session).
                    let createdUrl: string | null = null;
                    try {
                      const amountPence = Math.round(parseFloat(paymentLinkForm.amount) * 100);
                      const { url } = await requestCheckout({
                        patientId: selectedClient.id,
                        type: paymentLinkForm.type,
                        amountPence,
                        description: paymentLinkForm.description || undefined,
                      });
                      createdUrl = url;
                      // Deliver the Checkout URL to the patient as a payment message.
                      await onSendMessage({
                        senderId: user?.id || 'admin',
                        recipientId: selectedClient.id,
                        subject: 'Payment Link',
                        body: `${paymentLinkForm.description || 'Payment request'}: ${formatAmount(amountPence / 100)}`,
                        type: 'payment',
                        paymentUrl: url,
                        read: false,
                        createdAt: new Date().toISOString(),
                      });
                      await logClinicalAction(user?.id || 'admin', 'sent_payment_link', selectedClient.id, `Sent ${paymentLinkForm.type} payment link for ${formatAmount(amountPence / 100)}`);
                      setPaymentLinkForm({ type: 'standalone', amount: '', description: '' });
                      setShowPaymentLink(false);
                      toast.success('Payment link sent');
                    } catch (error) {
                      console.error('Failed to send payment link:', error);
                      if (createdUrl) {
                        // Link exists but the message didn't send — surface the URL so
                        // the admin delivers it manually instead of regenerating.
                        toast.error('Link created but not delivered', { description: `Don't resend — copy this link to the patient: ${createdUrl}` });
                      } else {
                        toast.error('Failed to send payment link', { description: 'Please try again.' });
                      }
                    } finally {
                      setPaymentLinkSaving(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs text-muted block mb-1">Type</label>
                    <select value={paymentLinkForm.type} onChange={e => setPaymentLinkForm(p => ({ ...p, type: e.target.value as CreateCheckoutInput['type'] }))} className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20">
                      <option value="deposit">Deposit</option>
                      <option value="balance">Balance</option>
                      <option value="standalone">Standalone</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Amount (£) *</label>
                    <input required type="number" min="0" step="0.01" value={paymentLinkForm.amount} onChange={e => setPaymentLinkForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Description</label>
                    <input type="text" value={paymentLinkForm.description} onChange={e => setPaymentLinkForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Deposit for PRP Session" className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                  </div>
                </form>
              </UIModal>
            </div>
          );
        })()}
        </div>
        {/* /main column */}
      </div>
      {/* /2-column grid */}

      {/* Reschedule Modal */}
      <UIModal
        open={!!rescheduleApt}
        onClose={() => setRescheduleApt(null)}
        title="Reschedule Appointment"
        subtitle={rescheduleApt ? `${rescheduleApt.type} — currently ${rescheduleApt.date} ${rescheduleApt.time}` : undefined}
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setRescheduleApt(null)} className="px-4 py-2 text-sm text-muted hover:text-obsidian transition-colors">Cancel</button>
            <button
              type="submit"
              form="reschedule-form"
              disabled={rescheduleStatus === 'saving' || !rescheduleForm.date || !rescheduleForm.time}
              className="bg-primary text-obsidian px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {rescheduleStatus === 'saving' ? 'Saving…' : 'Confirm Reschedule'}
            </button>
          </div>
        }
      >
        {rescheduleApt && (
          <form id="reschedule-form" onSubmit={submitReschedule} className="space-y-4">
            <div>
              <label className="text-xs text-muted block mb-2">New Date</label>
              <input
                type="date"
                required
                value={rescheduleForm.date}
                onChange={(e) => setRescheduleForm(p => ({ ...p, date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-2">New Time</label>
              <select
                required
                value={rescheduleForm.time}
                onChange={(e) => { setRescheduleForm(p => ({ ...p, time: e.target.value })); setRescheduleConflict(false); }}
                className={`w-full bg-cream rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 ${
                  rescheduleConflict
                    ? 'border border-danger ring-2 ring-danger/20 focus:ring-danger/30'
                    : 'border-transparent focus:ring-primary/20'
                }`}
              >
                <option value="">Select time...</option>
                {['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM','05:00 PM','05:30 PM','06:00 PM','06:30 PM','07:00 PM','07:30 PM','08:00 PM','08:30 PM','09:00 PM','09:30 PM','10:00 PM'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {rescheduleConflict && (
                <p className="text-xs font-medium text-danger mt-1.5">Pick a different time — that slot is taken.</p>
              )}
            </div>
            {rescheduleStatus === 'error' && (
              <p className="text-xs font-medium text-red-500">Failed to reschedule. Please try again.</p>
            )}
          </form>
        )}
      </UIModal>

      {/* Quick Edit Modal */}
      <UIModal
        open={showQuickEdit}
        onClose={() => setShowQuickEdit(false)}
        title="Quick Edit Profile"
        subtitle={`Registry ID: ${selectedClient.id}`}
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowQuickEdit(false)} className="px-4 py-2 text-sm text-muted hover:text-obsidian transition-colors">Cancel</button>
            <button
              type="submit"
              form="quick-edit-form"
              disabled={quickEditStatus === 'saving' || !quickEditForm.name.trim() || !quickEditForm.email.trim()}
              className="bg-obsidian text-white px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {quickEditStatus === 'saving' ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        }
      >
        <form id="quick-edit-form" onSubmit={submitQuickEdit} className="space-y-4">
          <div>
            <label className="text-xs text-muted block mb-2">Full Name</label>
            <input type="text" required value={quickEditForm.name} onChange={(e) => setQuickEditForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-2">Email</label>
            <input type="email" required value={quickEditForm.email} onChange={(e) => setQuickEditForm(p => ({ ...p, email: e.target.value }))} className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-2">Phone</label>
            <input type="tel" value={quickEditForm.phone} onChange={(e) => setQuickEditForm(p => ({ ...p, phone: e.target.value }))} className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-2">Address</label>
            <textarea value={quickEditForm.address} onChange={(e) => setQuickEditForm(p => ({ ...p, address: e.target.value }))} rows={2} className="w-full bg-cream border-transparent rounded-md px-4 py-3 text-base sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>
          {quickEditStatus === 'error' && (
            <p className="text-xs font-medium text-red-500">Failed to save. Please try again.</p>
          )}
        </form>
      </UIModal>
    </div>
  );
};

export default memo(ClientRecord);
