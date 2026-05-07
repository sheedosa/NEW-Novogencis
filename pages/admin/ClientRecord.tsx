import React, { useState } from 'react';
import { useAdminContext } from './context';
import { ClientRecordTab } from './context';
import { Card } from '../../components/Card';
import { InteractiveForm } from '../../components/InteractiveForm';
import { InternalNotesEditor, FeedbackEditor, MessageInputForm } from './AdminComponents';
import { FORMS } from '../../constants';
import { Camera, Upload, X, Plus, Image as ImageIcon, Loader2 } from 'lucide-react';
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
    <div className="animate-fade-up space-y-4 md:space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4 md:mb-8">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setSelectedClientId(null)}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-bg-soft flex items-center justify-center text-text-muted hover:text-primary transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-xl md:text-2xl">arrow_back</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-3xl font-black text-text-main truncate">{selectedClient.name}</h2>
              {selectedClient.policiesAccepted && (
                <span className="material-symbols-outlined text-green-500 text-xl md:text-2xl font-black" title="Policies Accepted">check_circle</span>
              )}
            </div>
            <p className="text-[9px] md:text-[10px] font-black text-text-muted uppercase tracking-widest truncate">Registry ID: {selectedClient.id}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex gap-2 w-full md:w-auto md:ml-auto">
          <button
            onClick={() => openBookingModal(selectedClient.id)}
            className="bg-primary text-clinical-dark px-4 md:px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/10 transition-transform active:scale-95"
          >
            Book Appt
          </button>
          <button
            onClick={openQuickEdit}
            className="bg-clinical-dark text-white px-4 md:px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-105 active:scale-95"
          >
            Quick Edit
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-black/5 pb-4 overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6 md:mx-0 md:px-0 sticky top-20 bg-white/90 backdrop-blur-md z-30 pt-4 md:pt-0 md:static md:bg-transparent">
        {[
          { id: 'overview', label: 'Overview', icon: 'person' },
          { id: 'communications', label: 'Communication', icon: 'forum' },
          { id: 'forms', label: 'Forms', icon: 'description' },
          { id: 'gallery', label: 'Gallery', icon: 'photo_library' },
          { id: 'assessment', label: 'Assessments', icon: 'assignment' },
          { id: 'treatment', label: 'Treatment Plan', icon: 'medical_services' },
          { id: 'financials', label: 'Financials', icon: 'payments' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setClientRecordTab(tab.id as ClientRecordTab)}
            className={`flex items-center gap-2 px-3 md:px-6 py-2 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
              clientRecordTab === tab.id
                ? 'bg-clinical-dark text-white border-clinical-dark shadow-lg shadow-clinical-dark/10'
                : 'text-text-muted bg-white border-black/5 hover:bg-bg-soft hover:border-black/10'
            }`}
          >
            <span className="material-symbols-outlined text-sm md:text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 md:mt-8">
        {clientRecordTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 items-start">
            {/* Left Column: Demographics - Now slightly more compact and sticky-ready on very large screens */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="p-6 md:p-8 bg-white shadow-sm border border-black/5">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Primary Profile</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${selectedClient.gender === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                     {selectedClient.gender}
                  </span>
                </div>

                <div className="space-y-5">
                  <div>
                    <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">Assigned Name</p>
                    <p className="text-sm font-black text-text-main">{selectedClient.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">Age</p>
                        <p className="text-sm font-bold text-text-main">{String(calculateAge(selectedClient.dob)).replace('(', '').replace(')', '') || 'N/A'}</p>
                     </div>
                     <div>
                        <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">DOB</p>
                        <p className="text-sm font-bold text-text-main">{formatDOB(selectedClient.dob)}</p>
                     </div>
                  </div>

                  <div className="pt-4 border-t border-black/5 space-y-4">
                     <div>
                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Contact Email</p>
                        <p className="text-[11px] font-bold text-text-main break-all">{selectedClient.email}</p>
                     </div>
                     <div>
                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Mobile Line</p>
                        <p className="text-[11px] font-bold text-text-main">{selectedClient.phone || 'N/A'}</p>
                     </div>
                     <div>
                        <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Home Address</p>
                        <p className="text-[11px] font-bold text-text-main leading-relaxed">{selectedClient.address || 'N/A'}</p>
                     </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 md:p-8 bg-clinical-dark text-white border-none shadow-xl shadow-clinical-dark/20">
                <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-6">Clinic Status</h3>
                <div className="space-y-4">
                   <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-2">Current Lifecycle</p>
                      <select
                        value={selectedClient.status}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          try {
                            await onUpdateClient(selectedClient.id, { status: newStatus });
                          } catch (error) {
                            console.error('Failed to update client status:', error);
                          }
                        }}
                        className="w-full bg-transparent text-white text-xs font-black uppercase tracking-widest border-none p-0 focus:ring-0 cursor-pointer"
                      >
                        {['New Inquiry', 'Assessment Submitted', 'Reviewed', 'Contacted', 'Converted', 'Not Suitable', 'Active', 'Ongoing'].map(s => (
                          <option key={s} value={s} className="bg-clinical-dark">{s}</option>
                        ))}
                      </select>
                   </div>
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] font-bold text-gray-400">Sessions Logged</span>
                      <span className="text-[10px] font-black text-primary">{appointments.filter(a => a.clientId === selectedClient.id && a.status === 'Completed').length}</span>
                   </div>
                </div>
              </Card>
            </div>

            {/* Right Column: Treatment Journey - High Density Grid */}
            <div className="lg:col-span-8 space-y-6">
               {/* Quick View Stats within Record */}
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-bg-soft rounded-2xl p-5 border border-black/5">
                     <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Total Sessions</p>
                     <p className="text-xl font-black text-text-main">{appointments.filter(a => a.clientId === selectedClient.id && a.status === 'Completed').length}</p>
                  </div>
                  <div className="bg-bg-soft rounded-2xl p-5 border border-black/5">
                     <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Active Package</p>
                     <p className="text-xs font-black text-primary truncate">{selectedClient.package || 'None'}</p>
                  </div>
                  <div className="bg-bg-soft rounded-2xl p-5 border border-black/5">
                     <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Last Visit</p>
                     <p className="text-xs font-black text-text-main">
                        {appointments.filter(a => a.clientId === selectedClient.id && a.status === 'Completed').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date || 'None'}
                     </p>
                  </div>
               </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Past Treatments Card */}
                <Card className="p-6 md:p-8 bg-white border border-black/5">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Clinical History</h3>
                     <span className="material-symbols-outlined text-primary text-lg">history</span>
                  </div>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                    {appointments
                      .filter(a => a.clientId === selectedClient.id && new Date(a.date) < new Date() && a.status === 'Completed')
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((t, i) => (
                      <div key={i} className="p-4 bg-bg-soft/40 rounded-xl border border-black/[0.03]">
                        <div className="flex justify-between mb-1">
                          <p className="text-[11px] font-black text-text-main">{t.type}</p>
                          <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                        </div>
                        <p className="text-[10px] text-text-muted leading-relaxed line-clamp-2">{t.notes || 'Routine follow-up session.'}</p>
                      </div>
                    ))}
                    {appointments.filter(a => a.clientId === selectedClient.id && new Date(a.date) < new Date() && a.status === 'Completed').length === 0 && (
                      <p className="text-[10px] text-text-muted italic py-4">No historical data available.</p>
                    )}
                  </div>
                </Card>

                {/* Upcoming Appointments Card */}
                <Card className="p-6 md:p-8 bg-white border border-black/5">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Next Sessions</h3>
                     <span className="material-symbols-outlined text-primary text-lg">upcoming</span>
                  </div>
                  <div className="space-y-4">
                    {appointments
                      .filter(a => a.clientId === selectedClient.id && (a.status === 'Confirmed' || a.status === 'Pending'))
                      .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                      .map((apt, i) => (
                        <div key={i} className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-center justify-between gap-4">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/20 rounded-lg flex flex-col items-center justify-center text-primary shrink-0">
                                 <span className="text-[7px] font-black uppercase leading-none">{apt.date ? new Date(apt.date).toLocaleString('default', { month: 'short' }) : '—'}</span>
                                 <span className="text-sm font-black leading-tight">{apt.date ? new Date(apt.date).getDate() : '--'}</span>
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[11px] font-black text-text-main truncate">{apt.type}</p>
                                 <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{apt.time}</p>
                              </div>
                           </div>
                           <button onClick={() => openReschedule(apt)} className="text-[8px] font-black text-primary uppercase border border-primary/20 px-2 py-1 rounded-md hover:bg-primary hover:text-clinical-dark transition-all">Reschedule</button>
                        </div>
                      ))}
                    {appointments.filter(a => a.clientId === selectedClient.id && (a.status === 'Confirmed' || a.status === 'Pending')).length === 0 && (
                      <div className="text-center py-10 border-2 border-dashed border-black/[0.03] rounded-2xl">
                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-3">No active bookings</p>
                        <button onClick={() => openBookingModal(selectedClient.id)} className="bg-primary text-clinical-dark px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/10 transition-transform active:scale-95">Schedule Now</button>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Patient Notes / Internal Alert */}
              <Card className="p-6 md:p-8 border-l-4 border-l-primary bg-white shadow-sm">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-4">Internal Clinical Memo</h3>
                 <div className="bg-bg-soft rounded-xl p-4">
                    <p className="text-[11px] text-text-main font-medium leading-relaxed italic">
                       "Patient shows high sensitivity to microneedling on crown area. Proceed with lower intensity during next session. Recommend EV-Enriched Exosomes for month 4."
                    </p>
                 </div>
                 <div className="flex justify-end mt-4">
                    <button className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline">Edit Clinical Memo</button>
                 </div>
              </Card>
            </div>
          </div>
        )}

        {clientRecordTab === 'communications' && (
          <div className="grid grid-cols-1 gap-4 md:gap-8">
            <div className="space-y-4 md:space-y-6">
              <Card className="p-4 md:p-8 h-[450px] md:h-[600px] flex flex-col">
                <h3 className="text-[9px] md:text-xs font-black uppercase tracking-widest text-text-muted mb-4 md:mb-6">Communication Log</h3>
                <div className="flex-grow overflow-y-auto space-y-4 md:space-y-6 pr-2 no-scrollbar">
                  {(messages.filter(m => m.senderId === selectedClientId || m.recipientId === selectedClientId) || []).map((msg) => (
                    <div key={msg.id} className={`flex ${msg.senderId === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] md:max-w-[80%] p-3 md:p-4 rounded-2xl ${
                        msg.senderId === 'admin' ? 'bg-clinical-dark text-white' : 'bg-bg-soft text-text-main'
                      }`}>
                        {msg.type === 'form' ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-primary">
                              <span className="material-symbols-outlined text-sm">description</span>
                              <span className="text-[9px] font-black uppercase tracking-widest">Form Attachment</span>
                            </div>
                            <p className="text-[10px] md:text-[11px] leading-relaxed font-bold">{FORMS.find(f => f.id === msg.formId)?.title || msg.subject}</p>
                            <button
                              onClick={() => setViewingForm(msg)}
                              className="block w-full bg-primary text-clinical-dark text-center py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform"
                            >
                              {msg.isSigned ? 'View Signed Form' : 'View Sent Form'}
                            </button>
                          </div>
                        ) : msg.type === 'payment' ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-primary">
                              <span className="material-symbols-outlined text-sm">payments</span>
                              <span className="text-[9px] font-black uppercase tracking-widest">Payment Link Sent</span>
                            </div>
                            <p className="text-[10px] md:text-[11px] leading-relaxed font-bold">{msg.body?.split(': ')[0] || msg.body}</p>
                            <a
                              href={msg.paymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full bg-primary text-clinical-dark text-center py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform"
                            >
                              View Stripe Link
                            </a>
                          </div>
                        ) : (
                          <p className="text-[10px] md:text-[11px] leading-relaxed mb-2">{msg.body}</p>
                        )}
                        <div className="flex justify-between items-center gap-4 mt-2">
                          <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest opacity-50">{msg.senderId === 'admin' ? 'Clinic' : 'Client'}</span>
                          <span className="text-[7px] md:text-[8px] font-bold opacity-50">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-black/5">
                  <MessageInputForm onSend={(msg) => handleSendMessage(msg, selectedClientId || '')} />
                </div>
              </Card>
            </div>
          </div>
        )}

        {clientRecordTab === 'forms' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xl font-black text-text-main">Sent & Signed Forms</h3>
              <div className="relative group w-full sm:w-auto">
                <button className="w-full bg-primary text-clinical-dark px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  Send New Form
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </button>
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-black/5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2 space-y-1">
                  {FORMS.map(form => (
                    <button
                      key={form.id}
                      onClick={() => handleSendForm(form.id, selectedClient.id, selectedClient.email)}
                      className="w-full text-left px-4 py-3 hover:bg-bg-soft rounded-xl text-[10px] font-bold text-text-main flex items-center justify-between group/item"
                    >
                      {form.title}
                      <span className="material-symbols-outlined text-primary opacity-0 group-hover/item:opacity-100 text-sm">send</span>
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
                        <p className="text-xs font-black text-text-main pr-4">{form?.title || msg.subject}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shrink-0 ${msg.isSigned ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {msg.isSigned ? 'Signed' : 'Pending'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Sent</p>
                          <p className="text-[10px] font-bold">{new Date(msg.createdAt).toLocaleDateString('en-GB')}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Signed</p>
                          <p className="text-[10px] font-bold">{msg.isSigned ? new Date(msg.signedAt!).toLocaleDateString('en-GB') : '-'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setViewingForm(msg)}
                        className="w-full text-primary font-black uppercase text-[9px] tracking-widest py-2.5 border border-primary/20 rounded-xl"
                      >
                        View Details
                      </button>
                    </div>
                  );
                })}
              {messages.filter(m => (m.senderId === selectedClientId || m.recipientId === selectedClientId) && m.type === 'form').length === 0 && (
                <div className="bg-white p-12 rounded-2xl border border-black/5 text-center">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No forms sent yet</p>
                </div>
              )}
            </div>

            <Card className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-bg-soft text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-black/5">
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
                          <tr key={msg.id} className="hover:bg-bg-soft/40 transition-colors">
                            <td className="px-8 py-6">
                              <div className="flex flex-col items-start gap-2">
                                <span className="font-black text-sm text-text-main">{form?.title || msg.subject}</span>
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${msg.isSigned ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {msg.isSigned ? 'Signed' : 'Pending'}
                                </span>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest w-12">Sent</span>
                                  <span className="text-xs text-text-main font-bold">{msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('en-GB') : '-'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest w-12">Signed</span>
                                  <span className="text-xs text-text-main font-bold">{msg.isSigned && msg.signedAt ? new Date(msg.signedAt).toLocaleDateString('en-GB') : '-'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button
                                onClick={() => setViewingForm(msg)}
                                className="text-primary font-black uppercase text-[10px] tracking-widest hover:underline"
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

        {clientRecordTab === 'gallery' && (() => {
          const gallery = selectedClient.gallery || [];
          return (
            <div className="space-y-6 md:space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-lg md:text-xl font-black text-text-main">Progress Gallery</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => { setCompareMode(!compareMode); setCompareA(null); setCompareB(null); }}
                    className={`flex-1 sm:flex-none px-4 md:px-6 py-2.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all ${compareMode ? 'bg-clinical-dark text-white border-clinical-dark' : 'bg-bg-soft text-text-muted border-black/5 hover:border-black/10'}`}
                  >
                    <span className="material-symbols-outlined text-sm align-middle mr-1">compare</span>
                    {compareMode ? 'Exit Compare' : 'Compare'}
                  </button>
                  <button
                    onClick={() => setShowGalleryUpload(true)}
                    className="flex-1 sm:flex-none bg-primary text-clinical-dark px-6 md:px-8 py-3 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/10 hover:scale-105 transition-all"
                  >
                    <Plus className="w-3 h-3 md:w-4 md:h-4" />
                    Add Photo
                  </button>
                </div>
              </div>

              {/* Before/After Comparison view */}
              {compareMode && (
                <div className="bg-clinical-dark rounded-3xl p-6 md:p-8 text-white space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-primary text-xl">compare</span>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-300">Before / After Comparison</h4>
                    <span className="text-[9px] text-gray-500 font-bold ml-auto">Select two photos below</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {['Before', 'After'].map((label, idx) => {
                      const selectedId = idx === 0 ? compareA : compareB;
                      const selectedImg = gallery.find(g => g.id === selectedId);
                      return (
                        <div key={label} className="space-y-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-primary">{label}</p>
                          <div className="aspect-square rounded-2xl overflow-hidden border-2 border-dashed border-white/10 bg-white/5 flex items-center justify-center relative">
                            {selectedImg ? (
                              <>
                                <img src={selectedImg.url} alt={selectedImg.label} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" />
                                <button onClick={() => idx === 0 ? setCompareA(null) : setCompareB(null)} className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/80">
                                  <X className="w-3 h-3" />
                                </button>
                                <p className="absolute bottom-2 left-0 right-0 text-center text-[8px] font-black text-white px-2 truncate">{selectedImg.label}</p>
                              </>
                            ) : (
                              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Click photo below</p>
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
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Timeline gap between selected photos</p>
                        <p className="text-2xl font-black text-primary mt-1">{daysDiff} days</p>
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
                      <div className="aspect-square bg-bg-soft rounded-2xl overflow-hidden border border-black/5 relative">
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
                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${isSelectedA ? 'bg-primary text-clinical-dark' : 'bg-clinical-dark text-white'}`}>
                              {isSelectedA ? 'Before' : 'After'}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${img.source === 'Clinical' ? 'bg-clinical-dark text-white' : 'bg-primary text-white'}`}>
                            {img.source}
                          </span>
                        </div>
                      </div>
                      <div className="px-1">
                        <p className="text-[9px] md:text-[10px] font-black text-text-main truncate">{img.label}</p>
                        <p className="text-[7px] md:text-[8px] font-bold text-text-muted uppercase tracking-widest">
                          {img.uploadedAt ? new Date(img.uploadedAt).toLocaleDateString('en-GB') : 'Recently'}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {gallery.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-bg-soft rounded-2xl border border-dashed border-black/5">
                    <ImageIcon className="w-8 h-8 text-text-muted/20 mx-auto mb-2" />
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No photos in gallery yet</p>
                  </div>
                )}

                <button
                  onClick={() => setShowGalleryUpload(true)}
                  className="aspect-square bg-bg-soft border-2 border-dashed border-primary/20 rounded-2xl flex flex-col items-center justify-center text-center p-3 md:p-6 hover:bg-primary/5 transition-all group"
                >
                  <Camera className="w-6 h-6 md:w-8 md:h-8 text-primary/40 mb-1 md:mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-[8px] md:text-[9px] font-black text-text-muted/60 uppercase tracking-widest">Add New</p>
                </button>
              </div>
            </div>
          );
        })()}

        {clientRecordTab === 'assessment' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 items-start">
            {/* Left Column: Categorized Assessment Data */}
            <div className="lg:col-span-8 space-y-6">
              <Card className="p-0 overflow-hidden border border-black/5 shadow-sm">
                <div className="p-6 md:p-8 bg-bg-soft/30 border-b border-black/5 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <span className="material-symbols-outlined text-primary">clinical_notes</span>
                     <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-text-main">Intake Questionnaire</h3>
                  </div>
                  <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Submitted: {selectedClient.createdAt ? new Date(selectedClient.createdAt).toLocaleDateString('en-GB') : '—'}</span>
                </div>

                <div className="p-6 md:p-10 space-y-12">
                  {/* Category 1: Concerns & Goals */}
                  <section>
                     <h4 className="text-[11px] font-black text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                        Hair Concerns & Goals
                     </h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                        {Object.entries(selectedClient.assessmentData?.answers || {})
                          .filter(([key]) => ['f1','f2','f3','f4','f5','m1','m2','m3','m4','m5'].includes(key))
                          .map(([key, val]: [string, any]) => (
                             <div key={key} className="space-y-1">
                                <p className="text-[9px] font-black text-text-muted uppercase tracking-tighter leading-tight">{val.text}</p>
                                <p className="text-xs font-bold text-text-main leading-relaxed">
                                   {Array.isArray(val.value) ? val.value.join(', ') : val.value || '—'}
                                </p>
                             </div>
                          ))}
                     </div>
                  </section>

                  {/* Category 2: Medical & Safety */}
                  <section className="pt-10 border-t border-black/5">
                     <h4 className="text-[11px] font-black text-red-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                        Medical & Safety Screening
                     </h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                        {Object.entries(selectedClient.assessmentData?.answers || {})
                          .filter(([key]) => !['f1','f2','f3','f4','f5','m1','m2','m3','m4','m5','f26','m22'].includes(key))
                          .map(([key, val]: [string, any]) => {
                             const isSignificant = val.value && val.value !== 'No' && val.value !== 'None' && !val.value.includes('None');
                             return (
                               <div key={key} className={`space-y-1 p-2 -m-2 rounded-lg transition-colors ${isSignificant ? 'bg-red-50/50' : ''}`}>
                                  <p className="text-[9px] font-black text-text-muted uppercase tracking-tighter leading-tight">{val.text}</p>
                                  <p className={`text-xs font-bold leading-relaxed ${isSignificant ? 'text-red-700' : 'text-text-main'}`}>
                                     {Array.isArray(val.value) ? val.value.join(', ') : val.value || '—'}
                                  </p>
                               </div>
                             );
                          })}
                     </div>
                  </section>
                </div>
              </Card>
            </div>

            {/* Right Column: Clinical Insights & Decision */}
            <div className="lg:col-span-4 space-y-6 sticky top-24">
              <Card className="p-6 md:p-8 bg-clinical-dark text-white border-none shadow-xl shadow-clinical-dark/20">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Decision Support</h3>

                 <div className="space-y-6">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                       <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">Safety Clearance</p>
                       <p className="text-sm font-black text-white">{selectedClient.assessmentData?.screening?.suitability || 'Cleared for Protocol'}</p>
                    </div>

                    <div className="space-y-4">
                       <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">Reported Conditions</p>
                       <div className="flex flex-wrap gap-2">
                          {(selectedClient.assessmentData?.screening?.conditions || []).length > 0 ? (
                             selectedClient.assessmentData?.screening?.conditions?.map((c: string, i: number) => (
                                <span key={i} className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-[9px] font-black border border-red-500/30">{c}</span>
                             ))
                          ) : (
                             <span className="text-[10px] text-gray-500 font-bold italic px-1">No contraindications reported</span>
                          )}
                       </div>
                    </div>

                    <div className="pt-6 border-t border-white/10">
                       <FeedbackEditor
                         initialFeedback={selectedClient.assessmentData?.clinicalFeedback || ''}
                         onSave={async (feedback) => {
                           const isFirstFeedback = !selectedClient.assessmentData?.clinicalFeedback;
                           try {
                             await onUpdateClient(selectedClient.id, {
                               assessmentData: { ...selectedClient.assessmentData, clinicalFeedback: feedback, reviewDate: new Date().toISOString() },
                               status: 'Reviewed'
                             });
                             await logClinicalAction(user?.id || 'admin', 'submit_feedback', selectedClient.id, isFirstFeedback ? 'Submitted clinical feedback' : 'Updated clinical feedback');
                             if (isFirstFeedback) {
                               await notifyFeedbackReceived(selectedClient.id, selectedClient.email, selectedClient.name);
                             }
                           } catch (e) {
                             console.error('Failed to save feedback:', e);
                             throw e;
                           }
                         }}
                       />
                    </div>
                 </div>
              </Card>

              <Card className="p-6 md:p-8 bg-bg-soft border-black/5">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-4">Patient Readiness</h3>
                 <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className={`w-2 h-2 rounded-full ${selectedClient.policiesAccepted ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                       <span className="text-[10px] font-black uppercase tracking-widest text-text-main">Policies Accepted</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className={`w-2 h-2 rounded-full ${selectedClient.assessmentData?.answers ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                       <span className="text-[10px] font-black uppercase tracking-widest text-text-main">Assessment Complete</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className={`w-2 h-2 rounded-full ${selectedClient.gallery?.length ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                       <span className="text-[10px] font-black uppercase tracking-widest text-text-main">Photos Provided</span>
                    </div>
                 </div>
              </Card>
            </div>
          </div>
        )}
        {/* ── Treatment Plan tab ────────────────────────────────────────── */}
        {clientRecordTab === 'treatment' && (() => {
          const plan = selectedClient.treatmentPlan;
          const rxList = selectedClient.prescriptions || [];
          const totalPhases = plan?.phases.length || 0;
          const completedPhases = plan?.phases.filter(p => p.status === 'Completed').length || 0;
          const totalSessions = plan?.phases.reduce((s, p) => s + p.sessionsPlanned, 0) || 0;
          const completedSessions = plan?.phases.reduce((s, p) => s + p.sessionsCompleted, 0) || 0;
          return (
            <div className="animate-fade-up space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Plan phases */}
                <div className="lg:col-span-8 space-y-6">
                  <Card className="p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Treatment Plan</h3>
                        {plan?.title && <p className="text-lg font-black text-text-main mt-1">{plan.title}</p>}
                      </div>
                      <button onClick={() => { setPlanTitle(plan?.title || ''); setShowAddPhase(true); }} className="flex items-center gap-2 bg-primary text-clinical-dark px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-sm">add</span> Add Phase
                      </button>
                    </div>

                    {!plan?.phases?.length ? (
                      <div className="py-16 text-center border-2 border-dashed border-black/5 rounded-2xl">
                        <span className="material-symbols-outlined text-4xl text-primary/20 mb-3">medical_services</span>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No treatment plan yet</p>
                        <p className="text-xs text-text-muted/60 mt-1 font-medium">Click "Add Phase" to create the first phase</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {plan.phases.map((phase, i) => {
                          const pct = phase.sessionsPlanned > 0 ? Math.round((phase.sessionsCompleted / phase.sessionsPlanned) * 100) : 0;
                          const statusColor: Record<string, string> = { Active: 'bg-primary text-clinical-dark', Completed: 'bg-green-100 text-green-700', Planned: 'bg-bg-soft text-text-muted', 'On Hold': 'bg-yellow-100 text-yellow-700' };
                          return (
                            <div key={phase.id} className="p-6 rounded-2xl border border-black/5 bg-bg-soft/30">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-clinical-dark text-white flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</div>
                                  <div>
                                    <p className="text-sm font-black text-text-main">{phase.name}</p>
                                    {phase.description && <p className="text-[10px] text-text-muted font-medium mt-0.5">{phase.description}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${statusColor[phase.status]}`}>{phase.status}</span>
                                  <button onClick={() => { setEditingPhaseId(phase.id); setEditPhaseForm({ status: phase.status, sessionsCompleted: phase.sessionsCompleted, notes: phase.notes }); }} className="w-7 h-7 rounded-full bg-white border border-black/10 flex items-center justify-center text-text-muted hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-4">
                                <div className="flex-grow h-1.5 bg-black/5 rounded-full overflow-hidden">
                                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[9px] font-black text-primary shrink-0">{phase.sessionsCompleted}/{phase.sessionsPlanned} sessions</span>
                              </div>
                              {phase.notes && <p className="text-[10px] text-text-muted font-medium mt-3 italic">"{phase.notes}"</p>}
                              {phase.startDate && <p className="text-[9px] text-text-muted font-bold mt-2 uppercase tracking-widest">Started: {new Date(phase.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                              {/* Inline edit panel */}
                              {editingPhaseId === phase.id && (
                                <div className="mt-4 pt-4 border-t border-black/5 space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Status</label>
                                      <select value={editPhaseForm.status || phase.status} onChange={e => setEditPhaseForm(p => ({ ...p, status: e.target.value as TreatmentPhase['status'] }))} className="w-full bg-white border-black/10 rounded-lg px-3 py-2 text-xs font-bold">
                                        <option>Planned</option><option>Active</option><option>Completed</option><option>On Hold</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Sessions Done</label>
                                      <input type="number" min={0} max={phase.sessionsPlanned} value={editPhaseForm.sessionsCompleted ?? phase.sessionsCompleted} onChange={e => setEditPhaseForm(p => ({ ...p, sessionsCompleted: Number(e.target.value) }))} className="w-full bg-white border-black/10 rounded-lg px-3 py-2 text-xs font-bold" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Notes</label>
                                    <textarea value={editPhaseForm.notes ?? phase.notes ?? ''} onChange={e => setEditPhaseForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full bg-white border-black/10 rounded-lg px-3 py-2 text-xs font-bold resize-none" />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button onClick={() => setEditingPhaseId(null)} className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-text-main">Cancel</button>
                                    <button onClick={async () => {
                                      if (!plan) return;
                                      setTreatmentPlanSaving(true);
                                      const updatedPhases = plan.phases.map(ph => ph.id === phase.id ? { ...ph, ...editPhaseForm } : ph);
                                      await onSaveTreatmentPlan(selectedClient.id, { ...plan, phases: updatedPhases, updatedAt: new Date().toISOString() });
                                      setEditingPhaseId(null);
                                      setTreatmentPlanSaving(false);
                                    }} disabled={treatmentPlanSaving} className="bg-clinical-dark text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest disabled:opacity-50">
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
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Prescriptions</h3>
                      <button onClick={() => setShowAddRx(true)} className="flex items-center gap-2 bg-bg-soft text-text-muted px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-clinical-dark transition-all">
                        <span className="material-symbols-outlined text-sm">add</span> Add Rx
                      </button>
                    </div>
                    {!rxList.length ? (
                      <div className="py-10 text-center border-2 border-dashed border-black/5 rounded-2xl">
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No prescriptions recorded</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {rxList.map(rx => {
                          const statusColors: Record<string, string> = { Active: 'bg-green-100 text-green-700', Completed: 'bg-blue-100 text-blue-700', Discontinued: 'bg-gray-100 text-gray-500' };
                          return (
                            <div key={rx.id} className="flex items-center justify-between p-4 rounded-xl border border-black/5 bg-white">
                              <div>
                                <p className="text-sm font-black text-text-main">{rx.drugName}</p>
                                <p className="text-[10px] font-bold text-text-muted">{rx.dosage} — {rx.instructions}</p>
                                <p className="text-[9px] font-bold text-text-muted/60 mt-1 uppercase tracking-widest">
                                  From {new Date(rx.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  {rx.endDate ? ` → ${new Date(rx.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${statusColors[rx.status]}`}>{rx.status}</span>
                                {rx.status === 'Active' && (
                                  <button onClick={async () => { await onUpdatePrescription(selectedClient.id, rx.id, { status: 'Discontinued' }); }} className="w-7 h-7 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors" title="Discontinue">
                                    <span className="material-symbols-outlined text-[14px]">block</span>
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
                  <Card className="p-6 md:p-8 bg-clinical-dark text-white border-none shadow-xl shadow-clinical-dark/20">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-6">Plan Overview</h3>
                    <div className="space-y-5">
                      <div>
                        <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">Total Phases</p>
                        <p className="text-2xl font-black">{totalPhases}</p>
                        <p className="text-[9px] text-gray-400 font-bold">{completedPhases} completed</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">Sessions Progress</p>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="bg-primary h-full rounded-full" style={{ width: totalSessions > 0 ? `${Math.round((completedSessions / totalSessions) * 100)}%` : '0%' }} />
                        </div>
                        <p className="text-[9px] text-right mt-1 font-bold text-primary">{completedSessions}/{totalSessions}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">Active Prescriptions</p>
                        <p className="text-2xl font-black">{rxList.filter(r => r.status === 'Active').length}</p>
                      </div>
                      {plan?.adminNotes && (
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Plan Notes</p>
                          <p className="text-xs leading-relaxed text-gray-300 italic">"{plan.adminNotes}"</p>
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
                  }} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="p-6 border-b border-black/5">
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-main">Add Treatment Phase</h3>
                    </div>
                    <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Plan Title {!plan && <span className="text-primary">(first phase)</span>}</label>
                        <input type="text" value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="e.g. 12-Month PRP Protocol" className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Phase Name <span className="text-red-400">*</span></label>
                        <input required type="text" value={phaseForm.name} onChange={e => setPhaseForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Initial Intensive" className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Description</label>
                        <input type="text" value={phaseForm.description} onChange={e => setPhaseForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of goals" className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Sessions Planned</label>
                        <input type="number" min={1} value={phaseForm.sessionsPlanned} onChange={e => setPhaseForm(p => ({ ...p, sessionsPlanned: Number(e.target.value) }))} className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Notes</label>
                        <textarea value={phaseForm.notes} onChange={e => setPhaseForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Clinical notes for this phase" className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 resize-none" />
                      </div>
                    </div>
                    <div className="p-6 border-t border-black/5 flex gap-3 justify-end bg-bg-soft/30">
                      <button type="button" onClick={() => setShowAddPhase(false)} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main">Cancel</button>
                      <button type="submit" disabled={treatmentPlanSaving} className="bg-primary text-clinical-dark px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
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
                  }} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="p-6 border-b border-black/5">
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-main">Add Prescription</h3>
                    </div>
                    <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                      {[
                        { label: 'Drug / Product Name *', field: 'drugName', required: true, placeholder: 'e.g. Minoxidil 5%' },
                        { label: 'Dosage *', field: 'dosage', required: true, placeholder: 'e.g. 1ml twice daily' },
                        { label: 'Instructions', field: 'instructions', required: false, placeholder: 'e.g. Apply to affected area in the morning' },
                        { label: 'Prescribed By', field: 'prescribedBy', required: false, placeholder: user?.fullName || '' },
                      ].map(({ label, field, required, placeholder }) => (
                        <div key={field}>
                          <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">{label}</label>
                          <input required={required} type="text" value={(rxForm as Record<string, string>)[field]} onChange={e => setRxForm(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder} className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Start Date *</label>
                          <input required type="date" value={rxForm.startDate} onChange={e => setRxForm(p => ({ ...p, startDate: e.target.value }))} className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">End Date</label>
                          <input type="date" value={rxForm.endDate} onChange={e => setRxForm(p => ({ ...p, endDate: e.target.value }))} className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                        </div>
                      </div>
                    </div>
                    <div className="p-6 border-t border-black/5 flex gap-3 justify-end bg-bg-soft/30">
                      <button type="button" onClick={() => setShowAddRx(false)} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main">Cancel</button>
                      <button type="submit" disabled={rxSaving} className="bg-primary text-clinical-dark px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
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
        {clientRecordTab === 'financials' && (() => {
          const payList = selectedClient.payments || [];
          const totalPaid = payList.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
          const totalPending = payList.filter(p => p.status === 'Pending' || p.status === 'Overdue').reduce((s, p) => s + p.amount, 0);
          const formatAmount = (amount: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
          const statusColor: Record<string, string> = { Paid: 'bg-green-100 text-green-700', Pending: 'bg-yellow-100 text-yellow-700', Overdue: 'bg-red-100 text-red-700', Refunded: 'bg-gray-100 text-gray-500' };
          return (
            <div className="animate-fade-up space-y-8">
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Received', value: formatAmount(totalPaid), icon: 'check_circle', color: 'text-green-600 bg-green-100' },
                  { label: 'Pending / Overdue', value: formatAmount(totalPending), icon: 'schedule', color: 'text-yellow-600 bg-yellow-100' },
                  { label: 'Total Invoiced', value: formatAmount(payList.reduce((s, p) => s + p.amount, 0)), icon: 'receipt_long', color: 'text-primary bg-primary/10' },
                ].map(({ label, value, icon, color }) => (
                  <Card key={label} className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                        <span className="material-symbols-outlined text-xl">{icon}</span>
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">{label}</p>
                    </div>
                    <p className="text-2xl font-black text-text-main">{value}</p>
                  </Card>
                ))}
              </div>

              {/* Payment list */}
              <Card className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Payment History</h3>
                  <button onClick={() => setShowAddPayment(true)} className="flex items-center gap-2 bg-primary text-clinical-dark px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-sm">add</span> Add Entry
                  </button>
                </div>
                {!payList.length ? (
                  <div className="py-16 text-center border-2 border-dashed border-black/5 rounded-2xl">
                    <span className="material-symbols-outlined text-4xl text-primary/20 mb-3">payments</span>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No payment records yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(pay => (
                      <div key={pay.id} className="flex items-center justify-between p-4 md:p-5 rounded-2xl border border-black/5 bg-white hover:bg-bg-soft/40 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-text-main truncate">{pay.description}</p>
                          <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mt-0.5">
                            {pay.reference && <span className="font-mono mr-2">Ref: {pay.reference}</span>}
                            {pay.paidDate ? `Paid ${new Date(pay.paidDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : pay.dueDate ? `Due ${new Date(pay.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : new Date(pay.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <p className="text-base font-black text-text-main">{formatAmount(pay.amount, pay.currency)}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${statusColor[pay.status]}`}>{pay.status}</span>
                            {pay.status === 'Pending' && (
                              <button onClick={async () => { await onUpdatePayment(selectedClient.id, pay.id, { status: 'Paid', paidDate: new Date().toISOString().split('T')[0] }); }} className="text-[9px] font-black text-green-600 hover:underline uppercase tracking-widest" title="Mark as paid">Mark Paid</button>
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
                  }} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="p-6 border-b border-black/5">
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-main">Add Payment Entry</h3>
                    </div>
                    <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Description *</label>
                        <input required type="text" value={paymentForm.description} onChange={e => setPaymentForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Initial PRP Session — Session 1" className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Amount (£) *</label>
                          <input required type="number" min="0" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Status</label>
                          <select value={paymentForm.status} onChange={e => setPaymentForm(p => ({ ...p, status: e.target.value as Payment['status'] }))} className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20">
                            <option>Pending</option><option>Paid</option><option>Overdue</option><option>Refunded</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Due Date</label>
                          <input type="date" value={paymentForm.dueDate} onChange={e => setPaymentForm(p => ({ ...p, dueDate: e.target.value }))} className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-1">Reference</label>
                          <input type="text" value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} placeholder="INV-001" className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                        </div>
                      </div>
                    </div>
                    <div className="p-6 border-t border-black/5 flex gap-3 justify-end bg-bg-soft/30">
                      <button type="button" onClick={() => setShowAddPayment(false)} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main">Cancel</button>
                      <button type="submit" disabled={paymentSaving} className="bg-primary text-clinical-dark px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                        {paymentSaving ? 'Saving…' : 'Add Entry'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          );
        })()}

        <InternalNotesEditor
          initialNotes={selectedClient.internalNotes || ''}
          onSave={async (notes) => {
            await onUpdateClient(selectedClient.id, { internalNotes: notes });
            await logClinicalAction(user?.id || 'admin', 'update_internal_notes', selectedClient.id, 'Updated internal clinical notes');
          }}
        />
      </div>

      {/* Reschedule Modal */}
      {rescheduleApt && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRescheduleApt(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitReschedule} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <h3 className="text-sm font-black uppercase tracking-widest text-text-main">Reschedule Appointment</h3>
              <p className="text-[10px] text-text-muted font-bold mt-1">{rescheduleApt.type} — currently {rescheduleApt.date} {rescheduleApt.time}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-2">New Date</label>
                <input
                  type="date"
                  required
                  value={rescheduleForm.date}
                  onChange={(e) => setRescheduleForm(p => ({ ...p, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-2">New Time</label>
                <select
                  required
                  value={rescheduleForm.time}
                  onChange={(e) => setRescheduleForm(p => ({ ...p, time: e.target.value }))}
                  className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select time...</option>
                  {['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM','05:00 PM'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {rescheduleStatus === 'error' && (
                <p className="text-[10px] font-bold text-red-500">Failed to reschedule. Please try again.</p>
              )}
            </div>
            <div className="p-6 border-t border-black/5 flex gap-3 justify-end bg-bg-soft/30">
              <button type="button" onClick={() => setRescheduleApt(null)} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors">Cancel</button>
              <button type="submit" disabled={rescheduleStatus === 'saving' || !rescheduleForm.date || !rescheduleForm.time} className="bg-primary text-clinical-dark px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                {rescheduleStatus === 'saving' ? 'Saving…' : 'Confirm Reschedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Edit Modal */}
      {showQuickEdit && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowQuickEdit(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitQuickEdit} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <h3 className="text-sm font-black uppercase tracking-widest text-text-main">Quick Edit Profile</h3>
              <p className="text-[10px] text-text-muted font-bold mt-1">Registry ID: {selectedClient.id}</p>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-2">Full Name</label>
                <input type="text" required value={quickEditForm.name} onChange={(e) => setQuickEditForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-2">Email</label>
                <input type="email" required value={quickEditForm.email} onChange={(e) => setQuickEditForm(p => ({ ...p, email: e.target.value }))} className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-2">Phone</label>
                <input type="tel" value={quickEditForm.phone} onChange={(e) => setQuickEditForm(p => ({ ...p, phone: e.target.value }))} className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-text-muted block mb-2">Address</label>
                <textarea value={quickEditForm.address} onChange={(e) => setQuickEditForm(p => ({ ...p, address: e.target.value }))} rows={2} className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>
              {quickEditStatus === 'error' && (
                <p className="text-[10px] font-bold text-red-500">Failed to save. Please try again.</p>
              )}
            </div>
            <div className="p-6 border-t border-black/5 flex gap-3 justify-end bg-bg-soft/30">
              <button type="button" onClick={() => setShowQuickEdit(false)} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors">Cancel</button>
              <button type="submit" disabled={quickEditStatus === 'saving' || !quickEditForm.name.trim() || !quickEditForm.email.trim()} className="bg-clinical-dark text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                {quickEditStatus === 'saving' ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ClientRecord;
