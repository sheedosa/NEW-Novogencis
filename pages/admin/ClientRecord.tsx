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
import { Appointment } from '../../types';

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
  } = useAdminContext();

  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '' });
  const [rescheduleStatus, setRescheduleStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [quickEditForm, setQuickEditForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [quickEditStatus, setQuickEditStatus] = useState<'idle' | 'saving' | 'error'>('idle');

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
          { id: 'assessment', label: 'Assessments', icon: 'assignment' }
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

        {clientRecordTab === 'gallery' && (
          <div className="space-y-6 md:space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg md:text-xl font-black text-text-main">Progress Gallery</h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <button className="flex-1 sm:flex-none bg-bg-soft text-text-muted px-4 md:px-6 py-2.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-black/5">Filter</button>
                <button
                  onClick={() => setShowGalleryUpload(true)}
                  className="flex-1 sm:flex-none bg-primary text-clinical-dark px-6 md:px-8 py-3 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/10 hover:scale-105 transition-all"
                >
                  <Plus className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden xs:inline">Add Photo</span>
                  <span className="xs:hidden">Add</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
              {(selectedClient.gallery || []).map((img) => (
                <div key={img.id} className="space-y-2 group cursor-pointer" onClick={() => setLightboxImage(img)}>
                  <div className="aspect-square bg-bg-soft rounded-2xl overflow-hidden border border-black/5 relative">
                    <img
                      src={img.url}
                      alt={img.label}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute top-2 right-2">
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
              ))}

              {(!selectedClient.gallery || selectedClient.gallery.length === 0) && (
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
        )}

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
