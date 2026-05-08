import React, { useState, useMemo, memo, useCallback } from 'react';
import { Page, User, Appointment, Client, Message, GalleryItem } from '../types';
import { FORMS } from '../constants';
import { Card } from '../components/Card';
import { InteractiveForm } from '../components/InteractiveForm';
import Logo from '../components/Logo';
import PolicyConfirmationModal from '../components/PolicyConfirmationModal';
import { processImageForUpload, validateImageFile, ACCEPTED_IMAGE_TYPES } from '../imageUtils';

interface ClientDashboardProps {
  user: User | null;
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  appointments: Appointment[];
  clients: Client[];
  messages: Message[];
  onSendMessage: (message: Omit<Message, 'id'>) => Promise<void>;
  onMarkMessageRead: (id: string) => Promise<void>;
  onUpdateMessage: (id: string, updates: Partial<Message>) => Promise<void>;
  onUpdateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  onAcceptPolicies: () => void;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => Promise<void>;
}

type Tab = 'overview' | 'treatments' | 'appointments' | 'assessments' | 'messages' | 'profile';

interface SidebarItemProps {
  id: Tab;
  label: string;
  icon: string;
  activeTab: string;
  onClick: (id: Tab) => void;
  badge?: number;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ id, label, icon, activeTab, onClick, badge }) => (
  <button 
    onClick={() => onClick(id)}
    className={`w-full flex items-center justify-between px-5 py-3.5 rounded-xl transition-all group sidebar-item-clinical ${activeTab === id ? 'bg-clinical-dark text-white shadow-lg shadow-clinical-dark/10' : 'text-text-muted hover:bg-bg-soft'}`}
  >
    <div className="flex items-center gap-3">
      <span className={`material-symbols-outlined text-[20px] transition-transform group-hover:scale-110 ${activeTab === id ? 'text-primary' : 'text-text-muted'}`}>{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
    {badge !== undefined && badge > 0 && (
      <span className="bg-primary text-clinical-dark text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md shadow-primary/20">
        {badge}
      </span>
    )}
  </button>
);

import { AppNotification } from '../types';

interface MessagesTabProps {
  userMessages: Message[];
  user: User | null;
  onSendMessage: (message: Omit<Message, 'id'>) => Promise<void>;
  onOpenForm: (msg: Message) => void;
}

const MessagesTab = memo(function MessagesTab({ userMessages, user, onSendMessage, onOpenForm }: MessagesTabProps) {
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  return (
    <div className="animate-fade-up h-[calc(100dvh-12rem)] flex flex-col">
      <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm flex flex-col overflow-hidden flex-grow">
        <div className="p-6 border-b border-black/5 flex justify-between items-center bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">medical_services</span>
            </div>
            <div>
              <h3 className="text-xs font-black text-text-main">Novogenics Clinical Support</h3>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Direct Portal Access</p>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Response time: &lt; 24h</span>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-4 no-scrollbar bg-bg-soft/30">
          {userMessages.length > 0 ? (
            userMessages.map((msg) => (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.senderId === user?.id ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.senderId !== user?.id && (
                  <div className="w-8 h-8 rounded-lg bg-white border border-black/5 flex items-center justify-center text-primary shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-xs">medical_services</span>
                  </div>
                )}
                <div className={`max-w-[85%] md:max-w-[70%] p-4 md:p-5 shadow-sm ${
                  msg.senderId === user?.id
                    ? 'bg-clinical-dark text-white rounded-t-2xl rounded-bl-2xl rounded-br-sm'
                    : 'bg-white border border-black/5 text-text-main rounded-t-2xl rounded-br-2xl rounded-bl-sm'
                }`}>
                  {msg.type === 'form' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <span className="material-symbols-outlined text-sm">description</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">Clinical Form</span>
                      </div>
                      <p className="text-[11px] font-bold">{FORMS.find(f => f.id === msg.formId)?.title || msg.subject}</p>
                      <button
                        onClick={() => onOpenForm(msg)}
                        className="block w-full bg-primary text-clinical-dark text-center py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform"
                      >
                        {msg.isSigned ? 'View Completed Form' : 'Open Interactive Form'}
                      </button>
                      {msg.isSigned && (
                        <div className="flex items-center gap-1 text-green-500 text-[8px] font-black uppercase tracking-widest">
                          <span className="material-symbols-outlined text-[10px]">check_circle</span>
                          Signed
                        </div>
                      )}
                    </div>
                  ) : msg.type === 'payment' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <span className="material-symbols-outlined text-sm">payments</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">Payment Request</span>
                      </div>
                      <p className="text-[11px] font-bold">{msg.body.split(': ')[0]}</p>
                      <a
                        href={msg.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full bg-primary text-clinical-dark text-center py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform"
                      >
                        Complete Payment
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] leading-relaxed mb-2">{msg.body}</p>
                  )}
                  <div className={`text-[8px] font-bold uppercase tracking-widest ${
                    msg.senderId === user?.id ? 'text-white/40 text-right' : 'text-text-muted'
                  }`}>
                    {new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-primary/20 mb-4 shadow-sm">
                <span className="material-symbols-outlined text-4xl">forum</span>
              </div>
              <p className="text-xs font-bold text-text-muted">No messages yet. Start a conversation with our clinical team.</p>
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 bg-white/80 backdrop-blur-md border-t border-black/5 sticky bottom-0 z-20">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!messageInput.trim() || !user) return;
              setIsSending(true);
              try {
                await onSendMessage({
                  senderId: user.id,
                  recipientId: 'admin',
                  subject: 'Portal Message',
                  body: messageInput,
                  read: false,
                  createdAt: new Date().toISOString()
                });
                setMessageInput('');
              } finally {
                setIsSending(false);
              }
            }}
            className="flex items-center gap-3"
          >
            <input
              type="text"
              placeholder="Type your message to the clinic..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="flex-grow bg-bg-soft border-transparent rounded-xl px-6 py-4 text-xs font-bold focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || isSending}
              className="w-12 h-12 bg-primary text-clinical-dark rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-clinical-dark/20 border-t-clinical-dark rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined">send</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
});

const ClientDashboard: React.FC<ClientDashboardProps> = ({ user, onLogout, onNavigate, appointments, clients, messages, notifications, onMarkNotificationRead, onSendMessage, onMarkMessageRead, onUpdateMessage, onUpdateClient, onAcceptPolicies }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFormSaving, setIsFormSaving] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(!user?.policiesAccepted);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'message' | 'appointment' | 'feedback'>('all');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [activeFormMessage, setActiveFormMessage] = useState<Message | null>(null);

  const [hasSeenAssessmentAlert, setHasSeenAssessmentAlert] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<GalleryItem | null>(null);

  // Appointment action state
  const [requestingAptId, setRequestingAptId] = useState<string | null>(null);
  const [aptAction, setAptAction] = useState<'reschedule' | 'cancel' | null>(null);
  const [reschedulePreference, setReschedulePreference] = useState('');
  const [aptRequestSending, setAptRequestSending] = useState(false);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    phone: '',
    dob: '',
    gender: 'female' as 'male' | 'female',
    address: ''
  });

  // Gallery Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showGalleryUpload, setShowGalleryUpload] = useState(false);
  const [galleryUploadFile, setGalleryUploadFile] = useState<File | null>(null);
  const [galleryUploadLabel, setGalleryUploadLabel] = useState('');
  const [galleryUploadPreview, setGalleryUploadPreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateImageFile(file);
      if (error) {
        alert(error);
        e.target.value = '';
        return;
      }
      setGalleryUploadFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setGalleryUploadPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryUpload = async (clientId: string, currentGallery: GalleryItem[] = []) => {
    if (!galleryUploadFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const { blob, fileName } = await processImageForUpload(galleryUploadFile);
      const { storage } = await import('../firebase');
      const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
      const storagePath = `gallery/${clientId}/${fileName}`;
      const storageRef = ref(storage, storagePath);
      
      const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress(pct);
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      const downloadURL = await getDownloadURL(storageRef);

      const newItem = {
        id: `client-${Date.now()}`,
        url: downloadURL,
        label: galleryUploadLabel || 'Progress Photo',
        uploadedAt: new Date().toISOString(),
        source: 'Clinical' as const
      };

      await onUpdateClient(clientId, { gallery: [...currentGallery, newItem] });

      setShowGalleryUpload(false);
      setGalleryUploadFile(null);
      setGalleryUploadLabel('');
      setGalleryUploadPreview(null);
      setUploadProgress(0);
      alert('Photo uploaded successfully.');
    } catch (error: any) {
      console.error('Error uploading gallery photo:', error);
      alert(error?.message || 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const firstName = (user?.fullName || 'Client').split(' ')[0];

  // Filter messages for this user
  const userMessages = useMemo(() => {
    return messages
      .filter(m => m.senderId === user?.id || m.recipientId === user?.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, user?.id]);

  // Mark messages as read when entering messages tab
  React.useEffect(() => {
    if (activeTab === 'messages' && user) {
      userMessages.forEach(msg => {
        if (!msg.read && msg.recipientId === user.id) {
          onMarkMessageRead(msg.id);
        }
      });
    }
  }, [activeTab, userMessages, user, onMarkMessageRead]);

  const unreadMessagesCount = useMemo(() => {
    if (!user) return 0;
    return messages.filter(m => !m.read && m.recipientId === user.id).length;
  }, [messages, user]);

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifFilter === 'all'
    ? notifications
    : notifications.filter(n => {
        if (notifFilter === 'message') return n.type === 'new_message';
        if (notifFilter === 'appointment') return n.type === 'appointment_confirmed' || n.type === 'appointment_reminder';
        if (notifFilter === 'feedback') return n.type === 'feedback_received';
        return true;
      });

  const handleNotificationClick = (n: AppNotification) => {
    onMarkNotificationRead(n.id);
    setShowNotifications(false);
    
    if (n.type === 'new_message') setActiveTab('messages');
    if (n.type === 'appointment_confirmed' || n.type === 'appointment_reminder') setActiveTab('appointments');
    if (n.type === 'feedback_received') setActiveTab('assessments');
    if (n.type === 'form_sent') setActiveTab('messages');
    if (n.type === 'payment_received') setActiveTab('messages');
  };


  // Find current client profile
  const currentClient = clients.find(c => c.id === user?.id || c.email === user?.email);

  const handleEditProfileClick = () => {
    if (currentClient) {
      setProfileForm({
        phone: currentClient.phone || '',
        dob: currentClient.dob || '',
        gender: currentClient.gender || 'female',
        address: currentClient.address || ''
      });
    }
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClient || !user) return;
    setIsSavingProfile(true);
    try {
      await onUpdateClient(currentClient.id, {
        phone: profileForm.phone,
        dob: profileForm.dob,
        gender: profileForm.gender,
        address: profileForm.address
      });
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile updates. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Filter appointments for this user
  const userAppointments = appointments.filter(a => a.clientId === user?.id);
  const nextAppointment = userAppointments
    .filter(a => a.status === 'Confirmed' || a.status === 'Pending')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  // Progress = % of completed sessions out of all booked sessions
  const calculateProgress = () => {
    if (!userAppointments || userAppointments.length === 0) return 0;
    const completed = userAppointments.filter(a => a.status === 'Completed').length;
    return Math.round((completed / userAppointments.length) * 100);
  };
  const progress = calculateProgress();

  const handleSidebarClick = (id: Tab) => {
    setActiveTab(id);
    setIsSidebarOpen(false);
  };

  const handleOpenForm = useCallback((msg: Message) => {
    setActiveFormMessage(msg);
    setIsFormModalOpen(true);
  }, []);

  const formatDOB = (dob: string | undefined) => {
    if (!dob) return 'Not provided';
    const parts = dob.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dob;
  };

  const calculateAge = (dob: string | undefined) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return ` (${age} years old)`;
  };

  const renderSection = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="animate-fade-up space-y-10">
            <header className="mb-8 md:mb-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                 <div>
                    <h2 className="text-3xl md:text-5xl font-black text-text-main tracking-tight leading-tight">Welcome back, <br className="md:hidden" /><span className="text-primary italic font-serif">{firstName}.</span></h2>
                    <p className="text-text-muted font-black uppercase tracking-[0.2em] mt-2 text-[10px]">Registry Status: {currentClient?.status || 'Active'}</p>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
                       <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-0.5">Clinical Protocol</p>
                       <p className="text-[11px] font-black text-clinical-dark uppercase">{currentClient?.packageStatus || 'Not Enrolled'}</p>
                    </div>
                 </div>
              </div>
            </header>

            {/* Bento Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-black/5 shadow-sm hover:translate-y-[-2px] transition-all">
                <div className="flex items-center gap-3 mb-4">
                   <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                   </div>
                   <span className="text-text-muted font-black uppercase tracking-widest text-[9px]">Schedule</span>
                </div>
                {nextAppointment ? (
                  <div className="space-y-1">
                    <p className="text-lg md:text-xl font-black text-text-main">
                      {new Date(nextAppointment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-xs font-black text-primary uppercase tracking-widest">{nextAppointment.time}</p>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-text-muted italic">No upcoming sessions</p>
                )}
              </div>

              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-black/5 shadow-sm hover:translate-y-[-2px] transition-all">
                <div className="flex items-center gap-3 mb-4">
                   <div className="w-8 h-8 bg-clinical-dark/10 rounded-lg flex items-center justify-center text-clinical-dark">
                      <span className="material-symbols-outlined text-[18px]">biotech</span>
                   </div>
                   <span className="text-text-muted font-black uppercase tracking-widest text-[9px]">Enrolled Program</span>
                </div>
                <p className="text-lg md:text-xl font-black text-text-main truncate">{currentClient?.package || 'Assessment Only'}</p>
                <div className="mt-3 flex items-center gap-2">
                   <div className="flex-grow h-1 bg-bg-soft rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${progress}%` }} />
                   </div>
                   <span className="text-[9px] font-black text-primary">{progress}%</span>
                </div>
              </div>

              <div className="bg-clinical-dark text-white p-6 md:p-8 rounded-[2rem] shadow-xl shadow-clinical-dark/20 hover:translate-y-[-2px] transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -mr-12 -mt-12 blur-2xl" />
                <div className="flex items-center gap-3 mb-4 relative z-10">
                   <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[18px]">medical_services</span>
                   </div>
                   <span className="text-gray-400 font-black uppercase tracking-widest text-[9px]">Your Clinician</span>
                </div>
                {(() => {
                  const assigned = userAppointments
                    .filter(a => a.doctorName)
                    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())[0];
                  if (assigned?.doctorName) {
                    return (
                      <>
                        <p className="text-lg md:text-xl font-black relative z-10">{assigned.doctorName}</p>
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest relative z-10">Assigned via {assigned.type}</p>
                      </>
                    );
                  }
                  return (
                    <>
                      <p className="text-lg md:text-xl font-black relative z-10">Pending Assignment</p>
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest relative z-10">A clinician will be assigned at booking</p>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-black/5">
                <h3 className="text-xl font-black text-text-main uppercase tracking-widest mb-8 flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">bolt</span> Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setActiveTab('messages')}
                    className="p-6 bg-bg-soft rounded-3xl text-center group hover:bg-primary transition-all"
                  >
                    <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white mb-2">event</span>
                    <p className="text-[10px] font-black uppercase tracking-widest group-hover:text-white">Request Visit</p>
                  </button>
                  <button onClick={() => setActiveTab('treatments')} className="p-6 bg-bg-soft rounded-3xl text-center group hover:bg-primary transition-all">
                    <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white mb-2">analytics</span>
                    <p className="text-[10px] font-black uppercase tracking-widest group-hover:text-white">View Progress</p>
                  </button>
                  <button onClick={() => setActiveTab('messages')} className="p-6 bg-bg-soft rounded-3xl text-center group hover:bg-primary transition-all">
                    <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white mb-2">forum</span>
                    <p className="text-[10px] font-black uppercase tracking-widest group-hover:text-white">Message Clinic</p>
                  </button>
                  <button onClick={() => setActiveTab('assessments')} className="p-6 bg-bg-soft rounded-3xl text-center group hover:bg-primary transition-all">
                    <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white mb-2">assignment</span>
                    <p className="text-[10px] font-black uppercase tracking-widest group-hover:text-white">My Assessment</p>
                  </button>
                </div>
              </div>

              <div className="bg-clinical-dark text-white p-8 md:p-12 rounded-[3rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
                <h3 className="text-xl font-black uppercase tracking-widest mb-8 relative z-10">Clinical Update</h3>
                <div className="space-y-6 relative z-10">
                  {currentClient?.assessmentData?.clinicalFeedback ? (
                    <button
                      onClick={() => setActiveTab('assessments')}
                      className="w-full text-left p-6 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-primary text-base">clinical_notes</span>
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">Feedback Available</p>
                        {currentClient.assessmentData.reviewDate && (
                          <span className="text-[9px] text-gray-400 font-bold ml-auto">
                            {new Date(currentClient.assessmentData.reviewDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-gray-200 line-clamp-3 italic font-serif">
                        "{currentClient.assessmentData.clinicalFeedback}"
                      </p>
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-3 group-hover:underline flex items-center gap-1">
                        Read full review
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </p>
                    </button>
                  ) : currentClient?.status === 'Assessment Submitted' ? (
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Under Review</p>
                      <p className="text-sm leading-relaxed text-gray-300 font-serif">
                        Your clinical team is reviewing your assessment. You'll be notified when feedback is ready.
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10 text-center">
                      <p className="text-sm italic leading-relaxed text-gray-300 font-serif">No clinical updates yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case 'treatments': {
          const plan = currentClient?.treatmentPlan;
          const rxList = currentClient?.prescriptions || [];
          const activeRx = rxList.filter(r => r.status === 'Active');
          return (
          <div className="animate-fade-up space-y-10">
            <header>
               <h2 className="text-3xl font-black text-text-main">My Treatment Plan</h2>
               <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">Your personalised clinical roadmap and progress</p>
            </header>

            {/* Treatment phases */}
            {plan?.phases?.length ? (
              <div className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-black/5 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">route</span>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-text-main">{plan.title || 'Treatment Plan'}</h3>
                  </div>
                  <div className="px-4 py-1.5 bg-bg-soft rounded-full text-[9px] font-black text-text-muted uppercase">
                    {plan.phases.filter(p => p.status === 'Completed').length}/{plan.phases.length} Phases Complete
                  </div>
                </div>
                <div className="space-y-4">
                  {plan.phases.map((phase, i) => {
                    const pct = phase.sessionsPlanned > 0 ? Math.round((phase.sessionsCompleted / phase.sessionsPlanned) * 100) : 0;
                    const statusColor: Record<string, string> = { Active: 'bg-primary text-clinical-dark', Completed: 'bg-green-100 text-green-700', Planned: 'bg-bg-soft text-text-muted border border-black/5', 'On Hold': 'bg-yellow-100 text-yellow-700' };
                    return (
                      <div key={phase.id} className={`p-5 md:p-6 rounded-2xl border transition-all ${phase.status === 'Active' ? 'border-primary/30 bg-primary/5' : phase.status === 'Completed' ? 'border-black/5 bg-bg-soft/30' : 'border-black/5 bg-white'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${phase.status === 'Completed' ? 'bg-green-500 text-white' : phase.status === 'Active' ? 'bg-primary text-clinical-dark' : 'bg-bg-soft text-text-muted border border-black/10'}`}>
                              {phase.status === 'Completed' ? '✓' : i + 1}
                            </div>
                            <div>
                              <p className="text-sm font-black text-text-main">{phase.name}</p>
                              {phase.description && <p className="text-[10px] text-text-muted font-medium">{phase.description}</p>}
                            </div>
                          </div>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shrink-0 ${statusColor[phase.status]}`}>{phase.status}</span>
                        </div>
                        {phase.status !== 'Planned' && (
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex-grow h-1 bg-black/5 rounded-full overflow-hidden">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[9px] font-black text-primary shrink-0">{phase.sessionsCompleted}/{phase.sessionsPlanned} sessions</span>
                          </div>
                        )}
                        {phase.notes && <p className="text-[10px] text-text-muted/80 font-medium mt-2 italic">"{phase.notes}"</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] p-10 border border-black/5 shadow-sm text-center">
                <span className="material-symbols-outlined text-4xl text-primary/20 mb-3">medical_services</span>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No treatment plan assigned yet</p>
                <p className="text-xs text-text-muted/60 mt-1 font-medium">Your clinician will create your personalised plan after your first session</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
               {/* Left: Session Timeline */}
               <div className="lg:col-span-8 space-y-6">
                  <div className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-black/5 shadow-sm">
                     <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-3">
                           <span className="material-symbols-outlined text-primary">history</span>
                           <h3 className="text-[11px] font-black uppercase tracking-widest text-text-main">Session Timeline</h3>
                        </div>
                        <div className="px-4 py-1.5 bg-bg-soft rounded-full text-[9px] font-black text-text-muted uppercase">
                           {userAppointments.filter(a => a.status === 'Completed').length} Completed
                        </div>
                     </div>

                     <div className="space-y-4">
                        {userAppointments
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((session, i) => (
                          <div key={session.id} className={`p-5 md:p-6 rounded-2xl border transition-all ${session.status === 'Completed' ? 'bg-bg-soft/50 border-black/5' : 'bg-white border-dashed border-primary/20'}`}>
                             <div className="flex justify-between items-start mb-3">
                                <div>
                                   <p className="text-[9px] font-black text-primary uppercase tracking-widest">Session {userAppointments.length - i}</p>
                                   <h4 className="text-base font-black text-text-main mt-0.5">{session.type}</h4>
                                </div>
                                <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${session.status === 'Completed' ? 'bg-clinical-dark text-white' : 'bg-primary/10 text-primary'}`}>{session.status}</span>
                             </div>
                             <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">event</span>
                                {new Date(session.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {session.time && <span>· {session.time}</span>}
                             </p>
                             {session.notes && (
                                <p className="text-xs leading-relaxed text-text-muted font-medium pt-3 border-t border-black/5 italic">
                                   "{session.notes}"
                                </p>
                             )}
                          </div>
                        ))}
                        {userAppointments.length === 0 && (
                           <div className="py-20 text-center">
                              <span className="material-symbols-outlined text-4xl text-primary/10 mb-3">clinical_notes</span>
                              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No session history yet</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               {/* Right: Progress Summary, Prescriptions & Gallery */}
               <div className="lg:col-span-4 space-y-6">
                  <Card className="p-8 bg-clinical-dark text-white border-none shadow-xl shadow-clinical-dark/20">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Program Overview</h3>
                     <div className="space-y-6">
                        <div>
                           <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">Current Protocol</p>
                           <p className="text-sm font-black">{currentClient?.package || 'Assessment Underway'}</p>
                        </div>
                        <div>
                           <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-3">Session Progress</p>
                           <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${progress}%` }} />
                           </div>
                           <p className="text-[9px] font-bold text-right mt-1 text-primary">{progress}%</p>
                        </div>
                        <button onClick={() => setActiveTab('messages')} className="w-full bg-white text-clinical-dark py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-white/5 hover:scale-105 transition-all">Request Next Session</button>
                     </div>
                  </Card>

                  {/* Prescriptions */}
                  {activeRx.length > 0 && (
                    <Card className="p-6 md:p-8 border border-black/5 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="material-symbols-outlined text-primary text-xl">medication</span>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Active Prescriptions</h3>
                      </div>
                      <div className="space-y-3">
                        {activeRx.map(rx => (
                          <div key={rx.id} className="p-4 bg-bg-soft rounded-xl">
                            <p className="text-sm font-black text-text-main">{rx.drugName}</p>
                            <p className="text-[10px] font-bold text-text-muted mt-0.5">{rx.dosage}</p>
                            <p className="text-[10px] font-medium text-text-muted/70 mt-1 leading-relaxed">{rx.instructions}</p>
                            {rx.prescribedBy && <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-2">Prescribed by {rx.prescribedBy}</p>}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  <Card className="p-6 md:p-8 border border-black/5 shadow-sm">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Progress Photos</h3>
                        <button onClick={() => setShowGalleryUpload(true)} className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                           <span className="material-symbols-outlined text-sm">add_a_photo</span>
                        </button>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        {currentClient?.gallery?.slice(0, 4).map((item, i) => (
                           <div key={i} className="aspect-square bg-bg-soft rounded-xl overflow-hidden relative cursor-pointer" onClick={() => setLightboxImage(item)}>
                              <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                           </div>
                        ))}
                        {(!currentClient?.gallery || currentClient.gallery.length === 0) && (
                           <div className="col-span-2 aspect-video bg-bg-soft border-2 border-dashed border-black/5 rounded-xl flex flex-col items-center justify-center text-center p-4">
                              <span className="material-symbols-outlined text-2xl text-text-muted/30 mb-1">add_a_photo</span>
                              <p className="text-[8px] font-black text-text-muted/60 uppercase tracking-widest">No photos yet</p>
                           </div>
                        )}
                     </div>
                     {currentClient?.gallery && currentClient.gallery.length > 4 && (
                        <button
                          onClick={() => setShowGalleryUpload(true)}
                          className="w-full text-center py-3 text-[9px] font-black text-primary uppercase tracking-widest hover:underline mt-2"
                        >
                          View All ({currentClient.gallery.length} photos)
                        </button>
                     )}
                  </Card>
               </div>
            </div>
          </div>
          );
        }
      case 'appointments':
        return (
          <div className="animate-fade-up space-y-10">
            <div className="flex justify-between items-end">
              <h2 className="text-3xl font-black text-text-main">My Appointments</h2>
              <button
                onClick={() => setActiveTab('messages')}
                className="bg-primary text-clinical-dark px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/10 hover:scale-105 transition-all active:scale-95"
              >
                Request New Visit
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
               <div className="lg:col-span-8 space-y-4">
                  {userAppointments.length > 0 ? (
                    userAppointments
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((apt) => {
                        const isUpcoming = (apt.status === 'Confirmed' || apt.status === 'Pending') && new Date(apt.date) >= new Date(new Date().toDateString());
                        const isRequestingThis = requestingAptId === apt.id;
                        return (
                          <div key={apt.id} className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm overflow-hidden">
                            <div className="p-6 md:p-8 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 md:gap-6 min-w-0">
                                <div className="w-14 h-14 md:w-16 md:h-16 bg-bg-soft rounded-3xl flex flex-col items-center justify-center text-center shrink-0">
                                  <span className="text-[9px] font-black text-primary uppercase">
                                    {new Date(apt.date).toLocaleString('default', { month: 'short' })}
                                  </span>
                                  <span className="text-xl font-black text-text-main leading-none">
                                    {new Date(apt.date).getDate()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-base md:text-lg font-black text-text-main truncate">{apt.type}</h4>
                                  <p className="text-xs md:text-sm font-medium text-text-muted">{apt.time}</p>
                                  {apt.doctorName && <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-1">{apt.doctorName}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                  apt.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                                  apt.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                                  apt.status === 'Cancelled' ? 'bg-red-100 text-red-600' :
                                  'bg-gray-100 text-text-muted'
                                }`}>{apt.status}</span>
                                {isUpcoming && (
                                  <button
                                    onClick={() => { setRequestingAptId(isRequestingThis ? null : apt.id); setAptAction(null); setReschedulePreference(''); }}
                                    className="w-8 h-8 rounded-full bg-bg-soft border border-black/10 flex items-center justify-center text-text-muted hover:text-primary transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">{isRequestingThis ? 'close' : 'more_horiz'}</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Inline action panel */}
                            {isRequestingThis && (
                              <div className="px-6 md:px-8 pb-6 border-t border-black/5 pt-4">
                                {!aptAction ? (
                                  <div className="flex gap-3">
                                    <button onClick={() => setAptAction('reschedule')} className="flex-1 flex items-center justify-center gap-2 bg-bg-soft hover:bg-primary/10 text-text-main py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
                                      <span className="material-symbols-outlined text-sm text-primary">event_repeat</span> Request Reschedule
                                    </button>
                                    <button onClick={async () => {
                                      if (!user) return;
                                      setAptRequestSending(true);
                                      await onSendMessage({
                                        senderId: user.id,
                                        recipientId: 'admin',
                                        subject: 'Cancel Request',
                                        body: `I would like to cancel my appointment: ${apt.type} on ${new Date(apt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} at ${apt.time}. Please confirm cancellation.`,
                                        read: false,
                                        createdAt: new Date().toISOString(),
                                      });
                                      setAptRequestSending(false);
                                      setRequestingAptId(null);
                                    }} disabled={aptRequestSending} className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50">
                                      <span className="material-symbols-outlined text-sm">cancel</span> Request Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Preferred new date/time</p>
                                    <textarea
                                      value={reschedulePreference}
                                      onChange={e => setReschedulePreference(e.target.value)}
                                      placeholder="e.g. Any morning next week, preferably Tuesday or Thursday..."
                                      rows={2}
                                      className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20 resize-none"
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={() => setAptAction(null)} className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-text-main">Back</button>
                                      <button onClick={async () => {
                                        if (!user) return;
                                        setAptRequestSending(true);
                                        await onSendMessage({
                                          senderId: user.id,
                                          recipientId: 'admin',
                                          subject: 'Reschedule Request',
                                          body: `I would like to reschedule my appointment: ${apt.type} on ${new Date(apt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} at ${apt.time}.\n\nPreferred new time: ${reschedulePreference || 'Please contact me to arrange.'}`,
                                          read: false,
                                          createdAt: new Date().toISOString(),
                                        });
                                        setAptRequestSending(false);
                                        setRequestingAptId(null);
                                        setAptAction(null);
                                      }} disabled={aptRequestSending} className="flex-1 bg-primary text-clinical-dark py-2 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                                        {aptRequestSending ? 'Sending…' : 'Send Reschedule Request'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                  ) : (
                    <div className="bg-white p-12 rounded-[2.5rem] border border-black/5 text-center">
                      <p className="text-text-muted font-bold">You have no appointment history.</p>
                    </div>
                  )}
               </div>
               <div className="lg:col-span-4 space-y-6">
                  <div className="bg-primary/5 rounded-[3rem] p-8 md:p-10 border border-primary/10">
                    <h4 className="text-lg font-black text-text-main uppercase tracking-widest mb-6">Booking Policy</h4>
                    <ul className="space-y-4">
                      {[
                        "Please provide 48 hours' notice for cancellations.",
                        "Arrive 5 minutes before your scheduled session.",
                        "Avoid caffeinated drinks 2 hours prior to PRP."
                      ].map((item, i) => (
                        <li key={i} className="text-xs font-medium text-text-muted leading-relaxed flex gap-3">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-clinical-dark text-white rounded-[3rem] p-8 md:p-10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Need to make a change?</p>
                    <p className="text-sm font-bold text-gray-300 leading-relaxed mb-5">Use the menu on each upcoming appointment to request a reschedule or cancellation. Our team will confirm via message.</p>
                    <p className="text-[9px] font-black text-primary uppercase tracking-widest">48 hours notice required</p>
                  </div>
               </div>
            </div>
          </div>
        );
      case 'assessments':
        return (
          <div className="animate-fade-up space-y-10">
            <h2 className="text-3xl font-black text-text-main">My Assessments</h2>
            
            {currentClient?.assessmentData?.clinicalFeedback ? (
              <div className="bg-clinical-dark text-white p-6 md:p-8 rounded-2xl shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/20 transition-colors" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">clinical_notes</span>
                    </div>
                    <h4 className="text-lg font-black uppercase tracking-widest">Clinical Feedback</h4>
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm md:text-base leading-relaxed text-gray-200 font-medium italic font-serif">
                      "{currentClient.assessmentData.clinicalFeedback}"
                    </p>
                    <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Reviewed By</p>
                        <p className="text-xs font-bold">Novogenics Clinical Team</p>
                      </div>
                      {currentClient.assessmentData.reviewDate && (
                        <div className="text-right">
                          <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Review Date</p>
                          <p className="text-xs font-bold">{new Date(currentClient.assessmentData.reviewDate).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-primary/5 border border-primary/20 p-6 rounded-2xl flex items-start gap-6">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined">info</span>
                </div>
                <div>
                  <h4 className="text-lg font-black text-text-main mb-2">Assessment Status: Pending Review</h4>
                  <p className="text-text-muted font-medium leading-relaxed">
                    Thank you for submitting your comprehensive assessment. Our clinical team is currently reviewing your information. 
                    <span className="text-primary font-bold"> You will receive a response regarding your assessment here in this tab within 48 hours.</span>
                  </p>
                </div>
              </div>
            )}

            {currentClient?.assessmentData && (
              <div className="card-clinical p-8 md:p-10">
                <h3 className="text-xl font-black text-text-main uppercase tracking-widest mb-8">Submitted Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">Screening Conditions</span>
                      <p className="text-sm font-medium text-text-main">
                        {currentClient.assessmentData.screening?.conditions?.join(', ') || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">Triggers</span>
                      <p className="text-sm font-medium text-text-main">
                        {currentClient.assessmentData.consultation?.triggers || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">Lifestyle</span>
                      <p className="text-sm font-medium text-text-main">
                        {currentClient.assessmentData.consultation?.lifestyle || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">Medical History</span>
                      <p className="text-sm font-medium text-text-main">
                        {currentClient.assessmentData.consultation?.medicalHistory || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">Medications</span>
                      <p className="text-sm font-medium text-text-main">
                        {currentClient.assessmentData.consultation?.medications || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">Lifestyle & Hair Care</span>
                      <p className="text-sm font-medium text-text-main">
                        {currentClient.assessmentData.consultation?.lifestyle || 'N/A'} • {currentClient.assessmentData.consultation?.hairCare || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {currentClient.assessmentData.answers && (
                  <div className="mt-12 pt-12 border-t border-black/5">
                    <h3 className="text-xl font-black text-text-main uppercase tracking-widest mb-8">Detailed Responses</h3>
                    <div className="space-y-6">
                      {Object.entries(currentClient.assessmentData.answers).map(([key, answer]) => {
                        const displayValue = Array.isArray(answer.value) ? answer.value.join(', ') : answer.value;
                        if (key === 'f26' || key === 'm22') return null; // Skip photo upload for now
                        
                        return (
                          <div key={key} className="border-b border-black/5 pb-4 last:border-0">
                            <p className="text-[10px] font-black text-text-muted uppercase mb-2">{answer.text}</p>
                            <p className="text-sm font-bold text-text-main">{displayValue}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case 'messages':
        return (
          <MessagesTab
            userMessages={userMessages}
            user={user}
            onSendMessage={onSendMessage}
            onOpenForm={handleOpenForm}
          />
        );
      case 'profile':
        return (
          <div className="animate-fade-up space-y-10">
            <h2 className="text-3xl font-black text-text-main">My Profile</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm text-center">
                  <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
                    <span className="material-symbols-outlined text-4xl">person</span>
                  </div>
                  <h3 className="text-xl font-black text-text-main mb-1">{user?.fullName}</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-6">Client ID: {currentClient?.id || 'N/A'}</p>
                  <div className="flex justify-center gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[9px] font-black uppercase tracking-widest">
                      {currentClient?.status || 'Active'}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-6">Account Status</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-muted">Policies Accepted</span>
                      <span className={`material-symbols-outlined text-sm ${currentClient?.policiesAccepted ? 'text-green-500' : 'text-red-500'}`}>
                        {currentClient?.policiesAccepted ? 'check_circle' : 'cancel'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-black/5 shadow-sm">
                  <h3 className="text-xl font-black text-text-main uppercase tracking-widest mb-8">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {isEditingProfile ? (
                      <form onSubmit={handleSaveProfile} className="md:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block">Phone Number</label>
                            <input 
                              type="tel" 
                              value={profileForm.phone}
                              onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                              className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block">Date of Birth</label>
                            <input 
                              type="date" 
                              value={profileForm.dob}
                              onChange={e => setProfileForm(p => ({ ...p, dob: e.target.value }))}
                              className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block">Gender</label>
                            <select 
                              value={profileForm.gender}
                              onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value as 'male' | 'female' }))}
                              className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="female">Female</option>
                              <option value="male">Male</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block">Address</label>
                            <input 
                              type="text" 
                              value={profileForm.address}
                              onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))}
                              className="w-full bg-bg-soft border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
                          <button 
                            type="button"
                            onClick={() => setIsEditingProfile(false)}
                            className="px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-widest text-text-muted hover:bg-bg-soft transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit"
                            disabled={isSavingProfile}
                            className="bg-primary text-clinical-dark px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                          >
                            {isSavingProfile ? (
                              <>
                                <div className="w-4 h-4 border-2 border-clinical-dark/20 border-t-clinical-dark rounded-full animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save Changes'
                            )}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="space-y-6">
                          <div>
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-2">Full Name</span>
                            <p className="text-sm font-bold text-text-main">{user?.fullName}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-2">Email Address</span>
                            <p className="text-sm font-bold text-text-main">{user?.email}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-2">Phone Number</span>
                            <p className="text-sm font-bold text-text-main">{currentClient?.phone || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="space-y-6">
                          <div>
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-2">Date of Birth</span>
                            <p className="text-sm font-bold text-text-main">{formatDOB(currentClient?.dob)}{calculateAge(currentClient?.dob)}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-2">Gender</span>
                            <p className="text-sm font-bold text-text-main capitalize">{currentClient?.gender || 'Not provided'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-2">Address</span>
                            <p className="text-sm font-bold text-text-main">{currentClient?.address || 'Not provided'}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {!isEditingProfile && (
                    <div className="mt-12 pt-12 border-t border-black/5">
                      <button 
                        onClick={handleEditProfileClick}
                        className="bg-clinical-dark text-white px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:scale-105 transition-all"
                      >
                        Edit Profile
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <div className="p-20 text-center font-black uppercase tracking-widest text-text-muted/40">Section Under Development</div>;
    }
  };

  const handleAcceptPolicies = () => {
    onAcceptPolicies();
    setShowPolicyModal(false);
  };

  return (
    <div className="min-h-screen bg-bg-soft flex font-sans selection:bg-primary/20">
      <PolicyConfirmationModal 
        isOpen={showPolicyModal} 
        onConfirm={handleAcceptPolicies}
        onNavigate={onNavigate}
      />
      {/* Sidebar */}
      <aside className={`w-[260px] h-screen fixed left-0 top-0 bg-white border-r border-black/[0.03] flex flex-col p-6 z-50 transition-transform duration-500 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-8">
          <div className="cursor-pointer" onClick={() => onNavigate(Page.Home)}>
            <Logo size="sm" className="!justify-start scale-90 origin-left" />
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-text-muted hover:text-primary">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-grow space-y-1">
          <SidebarItem id="overview" label="Overview" icon="grid_view" activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="treatments" label="My Treatments" icon="analytics" activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="appointments" label="My Appointments" icon="calendar_month" activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="assessments" label="My Assessments" icon="assignment" activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="messages" label="Messages" icon="forum" activeTab={activeTab} onClick={handleSidebarClick} badge={unreadMessagesCount} />
          <SidebarItem id="profile" label="My Profile" icon="person" activeTab={activeTab} onClick={handleSidebarClick} />
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-100 space-y-3">
           <div className="flex items-center gap-3 px-4 py-3 bg-bg-soft rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-black text-[10px]">{firstName[0]}</div>
              <div className="flex flex-col min-w-0">
                 <span className="text-[9px] font-black text-text-main truncate uppercase tracking-widest">{user?.fullName}</span>
                 <span className="text-[8px] font-bold text-text-muted uppercase">Client Portal</span>
              </div>
           </div>
           <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-5 py-3 rounded-xl text-text-muted hover:text-red-500 hover:bg-red-50 transition-all group"
           >
              <span className="material-symbols-outlined text-[20px] group-hover:rotate-180 transition-transform">logout</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Sign Out</span>
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow lg:pl-[260px] min-h-screen">
        <header className="h-16 bg-white/90 backdrop-blur-lg border-b border-black/[0.03] px-6 md:px-10 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-text-muted hover:text-primary">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted hidden sm:inline">CLIENT PORTAL</span>
              <span className="text-text-muted/30 hidden sm:inline">/</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{activeTab}</span>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-center flex-grow mx-8 max-w-xs xl:max-w-md">
             <div className="flex w-full justify-between text-[8px] font-black uppercase tracking-widest text-text-muted mb-1.5">
               <span>Journey Tracking</span><span>{progress}% Completed</span>
             </div>
             <div className="w-full h-1.5 bg-bg-soft rounded-full overflow-hidden">
               <div className="h-full bg-primary transition-all duration-1000" style={{width: `${progress}%`}} />
             </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 transition-colors rounded-full hover:bg-bg-soft ${showNotifications ? 'text-primary bg-bg-soft' : 'text-text-muted'}`}
              >
                <span className="material-symbols-outlined">notifications</span>
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[8px] font-black text-white flex items-center justify-center">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 mt-4 w-[320px] md:w-[380px] bg-white rounded-3xl shadow-2xl border border-black/5 z-50 overflow-hidden animate-fade-up origin-top-right">
                    <div className="p-5 border-b border-gray-50">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-text-main">Notifications</h3>
                        <button 
                          onClick={() => notifications.forEach(n => !n.read && onMarkNotificationRead(n.id))}
                          className="text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-primary transition-colors"
                        >
                          Mark All Read
                        </button>
                      </div>
                      <div className="flex gap-1 bg-bg-soft p-1 rounded-full">
                        {(['all', 'message', 'appointment', 'feedback'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setNotifFilter(f)}
                            className={`flex-1 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${notifFilter === f ? 'bg-white text-primary shadow-sm' : 'text-text-muted'}`}
                          >
                            {f === 'all' ? 'All' : f === 'message' ? 'Msgs' : f === 'appointment' ? 'Appts' : 'Feedbk'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="max-h-[380px] overflow-y-auto no-scrollbar">
                      {filteredNotifications.length > 0 ? (
                        filteredNotifications.map((n) => {
                          const iconMap: Record<string, string> = {
                            new_message: 'forum', appointment_confirmed: 'event',
                            appointment_reminder: 'notifications_active', feedback_received: 'rate_review',
                            form_sent: 'description', payment_received: 'payments',
                            welcome: 'waving_hand'
                          };
                          const colorMap: Record<string, string> = {
                            new_message: 'bg-purple-100 text-purple-600',
                            appointment_confirmed: 'bg-emerald-100 text-emerald-600',
                            feedback_received: 'bg-amber-100 text-amber-600',
                          };
                          const timeAgo = n.createdAt ? (() => {
                            const diff = Date.now() - new Date(n.createdAt).getTime();
                            if (diff < 60000) return 'Just now';
                            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                            return `${Math.floor(diff / 86400000)}d ago`;
                          })() : 'Recently';

                          return (
                            <div 
                              key={n.id} 
                              onClick={() => handleNotificationClick(n)}
                              className={`p-5 border-b border-gray-50 flex gap-4 hover:bg-bg-soft transition-colors cursor-pointer relative ${!n.read ? 'bg-primary/5' : ''}`}
                            >
                              {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />}
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorMap[n.type] || 'bg-gray-100 text-gray-600'}`}>
                                <span className="material-symbols-outlined text-xl">{iconMap[n.type] || 'notifications'}</span>
                              </div>
                              <div className="min-w-0 flex-grow">
                                <p className="text-[11px] font-black text-text-main mb-0.5">{n.title}</p>
                                <p className="text-[10px] text-text-muted leading-relaxed mb-2 line-clamp-2">{n.body}</p>
                                <p className="text-[8px] font-bold text-text-muted uppercase tracking-widest">{timeAgo}</p>
                              </div>
                              {!n.read && (
                                <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1" />
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-12 text-center">
                          <span className="material-symbols-outlined text-4xl text-primary/20 mb-4 block">notifications_off</span>
                          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">No notifications</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="h-8 w-[1px] bg-gray-100 hidden sm:block" />

            <button 
              onClick={onLogout}
              className="flex items-center gap-2 text-text-muted hover:text-red-500 transition-colors group"
            >
              <span className="material-symbols-outlined text-xl group-hover:rotate-180 transition-transform">logout</span>
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Sign Out</span>
            </button>
            <div className="h-8 w-[1px] bg-gray-100 hidden sm:block" />
            <Logo size="sm" className="scale-75 hidden sm:flex" />
          </div>

        </header>
        <div className="max-w-[1200px] mx-auto p-6 md:p-12 lg:p-20">
           {renderSection()}
        </div>
      </main>
      {isFormModalOpen && activeFormMessage && (
        <InteractiveForm 
          message={activeFormMessage}
          client={currentClient}
          isSaving={isFormSaving}
          onSave={async (formData, signature) => {
            setIsFormSaving(true);
            try {
              // 1. Update the message itself
              await onUpdateMessage(activeFormMessage.id, {
                isSigned: true,
                signedAt: new Date().toISOString(),
                formData,
                signature
              });

              // 2. Save to client account (completedForms array)
              if (currentClient) {
                const formTitle = FORMS.find(f => f.id === activeFormMessage.formId)?.title || activeFormMessage.subject;
                const newCompletedForm = {
                  formId: activeFormMessage.formId || 'unknown',
                  title: formTitle,
                  signedAt: new Date().toISOString(),
                  formData,
                  signature
                };
                
                const updatedForms = [...(currentClient.completedForms || []), newCompletedForm];
                
                const clientUpdates: Partial<Client> = {
                  completedForms: updatedForms
                };

                // Sync form data to client profile
                if (formData.phone) clientUpdates.phone = formData.phone as string;
                if (formData.address) clientUpdates.address = formData.address as string;
                if (formData.dob) clientUpdates.dob = formData.dob as string;
                if (formData.name && formData.name !== currentClient.name) clientUpdates.name = formData.name as string;

                await onUpdateClient(currentClient.id, clientUpdates);
              }

              // 3. Notify both client and admin (send a new message)
              await onSendMessage({
                senderId: 'system',
                recipientId: 'admin',
                subject: 'Form Completed',
                body: `Clinical Form "${FORMS.find(f => f.id === activeFormMessage.formId)?.title || activeFormMessage.subject}" has been completed and signed by ${user?.fullName}.`,
                read: false,
                createdAt: new Date().toISOString()
              });

              await onSendMessage({
                senderId: 'system',
                recipientId: user?.id || '',
                subject: 'Form Submitted',
                body: `Thank you. Your form "${FORMS.find(f => f.id === activeFormMessage.formId)?.title || activeFormMessage.subject}" has been successfully submitted and saved to your clinical record.`,
                read: false,
                createdAt: new Date().toISOString()
              });

              setIsFormModalOpen(false);
              setActiveFormMessage(null);
            } catch (error) {
              console.error('Failed to submit form:', error);
            } finally {
              setIsFormSaving(false);
            }
          } }
          onClose={() => {
            setIsFormModalOpen(false);
            setActiveFormMessage(null);
          } }
        />
      )}

      {currentClient?.status === 'Assessment Submitted' && !hasSeenAssessmentAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-clinical-dark/60 backdrop-blur-sm" onClick={() => setHasSeenAssessmentAlert(true)} />
          <div className="bg-white p-8 rounded-3xl shadow-2xl relative z-10 max-w-md w-full text-center animate-fade-up">
            <span className="material-symbols-outlined text-5xl text-primary mb-4">info</span>
            <h3 className="text-xl font-black text-text-main mb-2">Assessment Received</h3>
            <p className="text-text-muted mb-6 font-medium">Your assessment will be reviewed within 24 hours – our clinical team will be in touch via phone call.</p>
            <button onClick={() => setHasSeenAssessmentAlert(true)} className="bg-primary text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-xs w-full hover:scale-105 transition-all shadow-lg shadow-primary/20">Understood</button>
          </div>
        </div>
      )}

      {showGalleryUpload && currentClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-clinical-dark/80 backdrop-blur-sm" onClick={() => !isUploading && setShowGalleryUpload(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden z-10 animate-fade-up">
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-text-main">Add Progress Photo</h3>
                  <p className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-widest mt-1">Upload to your gallery</p>
                </div>
                <button 
                  onClick={() => setShowGalleryUpload(false)}
                  disabled={isUploading}
                  className="w-10 h-10 rounded-full bg-bg-soft flex items-center justify-center text-text-muted hover:text-text-main transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-6">
                <div className="aspect-video bg-bg-soft rounded-2xl border-2 border-dashed border-black/5 overflow-hidden relative flex flex-col items-center justify-center group">
                  {galleryUploadPreview ? (
                    <>
                      <img src={galleryUploadPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => {
                          setGalleryUploadFile(null);
                          setGalleryUploadPreview(null);
                        }}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-4 p-8">
                      <div className="flex gap-4">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-black/5 flex flex-col items-center justify-center gap-1 text-text-muted hover:text-primary hover:border-primary/20 transition-all"
                        >
                          <span className="material-symbols-outlined">upload</span>
                          <span className="text-[8px] font-black uppercase tracking-widest">Gallery</span>
                        </button>
                        <button 
                          onClick={() => cameraInputRef.current?.click()}
                          className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-black/5 flex flex-col items-center justify-center gap-1 text-text-muted hover:text-primary hover:border-primary/20 transition-all"
                        >
                          <span className="material-symbols-outlined">photo_camera</span>
                          <span className="text-[8px] font-black uppercase tracking-widest">Camera</span>
                        </button>
                      </div>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Select or take a photo</p>
                    </div>
                  )}
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept={ACCEPTED_IMAGE_TYPES} 
                    className="hidden" 
                    onChange={handleFileSelect}
                  />
                  <input 
                    ref={cameraInputRef}
                    type="file" 
                    accept={ACCEPTED_IMAGE_TYPES} 
                    capture="environment"
                    className="hidden" 
                    onChange={handleFileSelect}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Photo Label</label>
                  <input 
                    type="text"
                    value={galleryUploadLabel}
                    onChange={(e) => setGalleryUploadLabel(e.target.value)}
                    placeholder="e.g., Month 3 Progress"
                    className="w-full px-6 py-4 bg-bg-soft rounded-2xl border border-black/5 font-bold text-text-main placeholder:text-text-muted/40 focus:outline-none focus:border-primary/30 transition-all"
                  />
                </div>

                <button 
                  onClick={() => handleGalleryUpload(currentClient.id, currentClient.gallery)}
                  disabled={isUploading || !galleryUploadFile}
                  className="w-full bg-primary text-clinical-dark py-5 rounded-2xl font-black uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                >
                  {isUploading ? (
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex-grow h-2 bg-white/30 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all duration-300" style={{width: `${uploadProgress}%`}} />
                      </div>
                      <span className="text-xs font-black">{uploadProgress}%</span>
                    </div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">upload</span>
                      Save to Gallery
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
  );
};

export default memo(ClientDashboard);