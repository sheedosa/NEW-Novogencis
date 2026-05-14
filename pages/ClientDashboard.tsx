import React, { useState, useMemo, memo, useCallback } from 'react';
import { Stethoscope, FileText, CheckCircle, CreditCard, MessageCircle, Send, CalendarDays, FlaskConical, Navigation, History, ClipboardList, Info, UserIcon, X, LogOut, Menu, Bell, BellOff, ArrowRight, Pill, Camera, Upload, RefreshCw, BarChart2, LayoutGrid, ChevronRight } from 'lucide-react';

const CLIENT_NAV_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  grid_view:        LayoutGrid,
  analytics:        BarChart2,
  calendar_month:   CalendarDays,
  assignment:       ClipboardList,
  forum:            MessageCircle,
  person:           UserIcon,
};
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

const SidebarItem: React.FC<SidebarItemProps> = ({ id, label, icon, activeTab, onClick, badge }) => {
  const isActive = activeTab === id;
  const Icon = CLIENT_NAV_ICONS[icon] || LayoutGrid;
  return (
    <button
      onClick={() => onClick(id)}
      className={`nav-item ${isActive ? 'active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={16} className={`nav-icon ${isActive ? 'text-clinical' : 'text-muted'}`} />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && <span className="nav-badge nav-badge-blue">{badge}</span>}
    </button>
  );
};

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
              <Stethoscope size={20} />
            </div>
            <div>
              <h3 className="text-xs font-medium text-obsidian">Novogenics Clinical Support</h3>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <p className="text-[8px] font-medium uppercase text-muted">Direct Portal Access</p>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <span className="text-2xs font-medium text-hint text-muted">Response time: &lt; 24h</span>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-4 no-scrollbar bg-cream/30">
          {userMessages.length > 0 ? (
            userMessages.map((msg) => (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.senderId === user?.id ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.senderId !== user?.id && (
                  <div className="w-8 h-8 rounded-lg bg-white border border-black/5 flex items-center justify-center text-primary shrink-0 shadow-sm">
                    <Stethoscope size={12} />
                  </div>
                )}
                <div className={`max-w-[85%] md:max-w-[70%] p-4 md:p-5 shadow-sm ${
                  msg.senderId === user?.id
                    ? 'bg-obsidian text-white rounded-t-2xl rounded-bl-2xl rounded-br-sm'
                    : 'bg-white border border-black/5 text-obsidian rounded-t-2xl rounded-br-2xl rounded-bl-sm'
                }`}>
                  {msg.type === 'form' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <FileText size={16} />
                        <span className="text-2xs font-medium text-hint">Clinical Form</span>
                      </div>
                      <p className="text-[11px] font-bold">{FORMS.find(f => f.id === msg.formId)?.title || msg.subject}</p>
                      <button
                        onClick={() => onOpenForm(msg)}
                        className="block w-full bg-primary text-clinical-dark text-center py-2 rounded-xl text-2xs font-medium text-hint hover:scale-[1.02] transition-transform"
                      >
                        {msg.isSigned ? 'View Completed Form' : 'Open Interactive Form'}
                      </button>
                      {msg.isSigned && (
                        <div className="flex items-center gap-1 text-green-500 text-[8px] font-medium uppercase">
                          <CheckCircle size={10} />
                          Signed
                        </div>
                      )}
                    </div>
                  ) : msg.type === 'payment' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <CreditCard size={16} />
                        <span className="text-2xs font-medium text-hint">Payment Request</span>
                      </div>
                      <p className="text-[11px] font-bold">{msg.body.split(': ')[0]}</p>
                      <a
                        href={msg.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full bg-primary text-clinical-dark text-center py-2 rounded-xl text-2xs font-medium text-hint hover:scale-[1.02] transition-transform"
                      >
                        Complete Payment
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] leading-relaxed mb-2">{msg.body}</p>
                  )}
                  <div className={`text-[8px] font-bold uppercase ${
                    msg.senderId === user?.id ? 'text-white/40 text-right' : 'text-muted'
                  }`}>
                    {new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-primary/20 mb-4 shadow-sm">
                <MessageCircle size={40} className="text-primary/20" />
              </div>
              <p className="text-xs font-bold text-muted">No messages yet. Start a conversation with our clinical team.</p>
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
              className="flex-grow bg-cream border-transparent rounded-xl px-6 py-4 text-xs font-bold focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || isSending}
              className="w-12 h-12 bg-primary text-clinical-dark rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-clinical-dark/20 border-t-clinical-dark rounded-full animate-spin" />
              ) : (
                <Send size={18} />
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
          <div className="animate-fade-up space-y-5">
            {/* Status row — small status pill, plan chip on the right */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="status-pill clinical">
                <span className="status-dot" />
                Status · {currentClient?.status || 'Active'}
              </span>
              <span className="status-pill">
                <span className="cohort-dot clinical" />
                Plan · {currentClient?.packageStatus || 'Not enrolled'}
              </span>
            </div>

            {/* KPI tiles — next appointment, program, clinician */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="kpi-tile">
                <span className="kpi-label flex items-center gap-1.5"><CalendarDays size={11} /> Next session</span>
                {nextAppointment ? (
                  <>
                    <span className="kpi-value">
                      {new Date(nextAppointment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className="kpi-delta clinical" style={{ background: 'var(--color-clinical-bg)', color: 'var(--color-clinical)' }}>{nextAppointment.time}</span>
                    <span className="kpi-sub">{nextAppointment.type}</span>
                  </>
                ) : (
                  <>
                    <span className="kpi-value text-hint" style={{ fontSize: 17 }}>None scheduled</span>
                    <span className="kpi-sub">Reach out via Messages to book your next visit</span>
                  </>
                )}
              </div>

              <div className="kpi-tile">
                <span className="kpi-label flex items-center gap-1.5"><FlaskConical size={11} /> Program</span>
                <span className="kpi-value" style={{ fontSize: 17, letterSpacing: 0 }}>{currentClient?.package || 'Assessment only'}</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="progress-track flex-grow">
                    <div className="progress-fill success" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-2xs text-hint">{progress}%</span>
                </div>
                <span className="kpi-sub">Journey progress</span>
              </div>

              {(() => {
                const assigned = userAppointments
                  .filter(a => a.doctorName)
                  .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())[0];
                return (
                  <div className="feature-card" style={{ minHeight: 122 }}>
                    <span className="feature-label flex items-center gap-1.5"><Stethoscope size={11} /> Your clinician</span>
                    <span className="feature-value" style={{ fontSize: 17 }}>{assigned?.doctorName || 'Pending assignment'}</span>
                    <span className="feature-meta">{assigned?.doctorName ? `Assigned via ${assigned.type}` : 'A clinician will be assigned at booking'}</span>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="surface surface-pad">
                <div className="section-header">
                  <p className="section-title">Quick actions</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setActiveTab('appointments')} className="p-4 rounded-md bg-cream text-left transition-colors hover:bg-clinical-bg group">
                    <CalendarDays size={16} className="text-clinical mb-2" />
                    <p className="text-xs font-medium text-obsidian">Request visit</p>
                  </button>
                  <button onClick={() => setActiveTab('treatments')} className="p-4 rounded-md bg-cream text-left transition-colors hover:bg-clinical-bg group">
                    <BarChart2 size={16} className="text-clinical mb-2" />
                    <p className="text-xs font-medium text-obsidian">View progress</p>
                  </button>
                  <button onClick={() => setActiveTab('messages')} className="p-4 rounded-md bg-cream text-left transition-colors hover:bg-clinical-bg group">
                    <MessageCircle size={16} className="text-clinical mb-2" />
                    <p className="text-xs font-medium text-obsidian">Message clinic</p>
                  </button>
                  <button onClick={() => setActiveTab('assessments')} className="p-4 rounded-md bg-cream text-left transition-colors hover:bg-clinical-bg group">
                    <ClipboardList size={16} className="text-clinical mb-2" />
                    <p className="text-xs font-medium text-obsidian">My assessment</p>
                  </button>
                </div>
              </div>

              <div className="feature-card">
                <span className="feature-label">Clinical update</span>
                {currentClient?.assessmentData?.clinicalFeedback ? (
                  <button
                    onClick={() => setActiveTab('assessments')}
                    className="w-full text-left mt-1 group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardList size={13} style={{ color: 'rgba(255,255,255,0.85)' }} />
                      <span className="text-2xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.7)' }}>Feedback available</span>
                      {currentClient.assessmentData.reviewDate && (
                        <span className="text-2xs ml-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {new Date(currentClient.assessmentData.reviewDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'rgba(255,255,255,0.92)' }}>
                      &ldquo;{currentClient.assessmentData.clinicalFeedback}&rdquo;
                    </p>
                    <p className="text-xs mt-3 group-hover:underline flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      Read full review <ArrowRight size={12} />
                    </p>
                  </button>
                ) : currentClient?.status === 'Assessment Submitted' ? (
                  <div className="mt-1">
                    <span className="text-2xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.7)' }}>Under review</span>
                    <p className="text-sm leading-relaxed mt-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
                      Your clinical team is reviewing your assessment. You'll be notified when feedback is ready.
                    </p>
                  </div>
                ) : (
                  <div className="mt-1">
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      No clinical updates yet.
                    </p>
                  </div>
                )}
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
               <h2 className="text-3xl font-medium text-obsidian">My Treatment Plan</h2>
               <p className="text-[10px] font-medium text-muted uppercase mt-1">Your personalised clinical roadmap and progress</p>
            </header>

            {/* Treatment phases */}
            {plan?.phases?.length ? (
              <div className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-black/5 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <Navigation size={20} className="text-primary" />
                    <h3 className="text-xs font-medium text-obsidian">{plan.title || 'Treatment Plan'}</h3>
                  </div>
                  <div className="px-4 py-1.5 bg-cream rounded-full text-[9px] font-medium text-muted uppercase">
                    {plan.phases.filter(p => p.status === 'Completed').length}/{plan.phases.length} Phases Complete
                  </div>
                </div>
                <div className="space-y-4">
                  {plan.phases.map((phase, i) => {
                    const pct = phase.sessionsPlanned > 0 ? Math.round((phase.sessionsCompleted / phase.sessionsPlanned) * 100) : 0;
                    const statusColor: Record<string, string> = { Active: 'bg-primary text-clinical-dark', Completed: 'bg-green-100 text-green-700', Planned: 'bg-cream text-muted border border-black/5', 'On Hold': 'bg-yellow-100 text-yellow-700' };
                    return (
                      <div key={phase.id} className={`p-5 md:p-6 rounded-2xl border transition-all ${phase.status === 'Active' ? 'border-primary/30 bg-primary/5' : phase.status === 'Completed' ? 'border-black/5 bg-cream/30' : 'border-black/5 bg-white'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${phase.status === 'Completed' ? 'bg-green-500 text-white' : phase.status === 'Active' ? 'bg-primary text-clinical-dark' : 'bg-cream text-muted border border-black/10'}`}>
                              {phase.status === 'Completed' ? '✓' : i + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-obsidian">{phase.name}</p>
                              {phase.description && <p className="text-[10px] text-muted font-medium">{phase.description}</p>}
                            </div>
                          </div>
                          <span className={`text-2xs font-medium text-hint px-2 py-1 rounded-full shrink-0 ${statusColor[phase.status]}`}>{phase.status}</span>
                        </div>
                        {phase.status !== 'Planned' && (
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex-grow h-1 bg-black/5 rounded-full overflow-hidden">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[9px] font-medium text-primary shrink-0">{phase.sessionsCompleted}/{phase.sessionsPlanned} sessions</span>
                          </div>
                        )}
                        {phase.notes && <p className="text-[10px] text-muted/80 font-medium mt-2 italic">"{phase.notes}"</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] p-10 border border-black/5 shadow-sm text-center">
                <Stethoscope size={40} className="text-primary/20 mb-3 mx-auto" />
                <p className="text-[10px] font-medium text-muted uppercase">No treatment plan assigned yet</p>
                <p className="text-xs text-muted/60 mt-1 font-medium">Your clinician will create your personalised plan after your first session</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
               {/* Left: Session Timeline */}
               <div className="lg:col-span-8 space-y-6">
                  <div className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-black/5 shadow-sm">
                     <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-3">
                           <History size={20} className="text-primary" />
                           <h3 className="text-xs font-medium text-obsidian">Session Timeline</h3>
                        </div>
                        <div className="px-4 py-1.5 bg-cream rounded-full text-[9px] font-medium text-muted uppercase">
                           {userAppointments.filter(a => a.status === 'Completed').length} Completed
                        </div>
                     </div>

                     <div className="space-y-4">
                        {userAppointments
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((session, i) => (
                          <div key={session.id} className={`p-5 md:p-6 rounded-2xl border transition-all ${session.status === 'Completed' ? 'bg-cream/50 border-black/5' : 'bg-white border-dashed border-primary/20'}`}>
                             <div className="flex justify-between items-start mb-3">
                                <div>
                                   <p className="text-[9px] font-medium text-primary uppercase">Session {userAppointments.length - i}</p>
                                   <h4 className="text-base font-medium text-obsidian mt-0.5">{session.type}</h4>
                                </div>
                                <span className={`text-[8px] font-medium uppercase px-3 py-1 rounded-full ${session.status === 'Completed' ? 'bg-obsidian text-white' : 'bg-primary/10 text-primary'}`}>{session.status}</span>
                             </div>
                             <p className="text-[10px] font-bold text-muted uppercase mb-2 flex items-center gap-2">
                                <CalendarDays size={16} />
                                {new Date(session.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {session.time && <span>· {session.time}</span>}
                             </p>
                             {session.notes && (
                                <p className="text-xs leading-relaxed text-muted font-medium pt-3 border-t border-black/5 italic">
                                   "{session.notes}"
                                </p>
                             )}
                          </div>
                        ))}
                        {userAppointments.length === 0 && (
                           <div className="py-20 text-center">
                              <ClipboardList size={40} className="text-primary/10 mb-3 mx-auto" />
                              <p className="text-[10px] font-medium text-muted uppercase">No session history yet</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               {/* Right: Progress Summary, Prescriptions & Gallery */}
               <div className="lg:col-span-4 space-y-6">
                  <Card className="p-8 bg-obsidian text-white border-none shadow-xl shadow-clinical-dark/20">
                     <h3 className="text-2xs font-medium text-hint text-gray-400 mb-6">Program Overview</h3>
                     <div className="space-y-6">
                        <div>
                           <p className="text-[8px] font-medium text-primary uppercase mb-1">Current Protocol</p>
                           <p className="text-sm font-medium">{currentClient?.package || 'Assessment Underway'}</p>
                        </div>
                        <div>
                           <p className="text-[8px] font-medium text-gray-400 uppercase mb-3">Session Progress</p>
                           <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${progress}%` }} />
                           </div>
                           <p className="text-[9px] font-bold text-right mt-1 text-primary">{progress}%</p>
                        </div>
                        <button onClick={() => setActiveTab('messages')} className="w-full bg-white text-clinical-dark py-3 rounded-xl text-2xs font-medium text-hint shadow-lg shadow-white/5 hover:scale-105 transition-all">Request Next Session</button>
                     </div>
                  </Card>

                  {/* Prescriptions */}
                  {activeRx.length > 0 && (
                    <Card className="p-6 md:p-8 border border-black/5 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <Pill size={20} className="text-primary" />
                        <h3 className="text-2xs font-medium text-hint text-muted">Active Prescriptions</h3>
                      </div>
                      <div className="space-y-3">
                        {activeRx.map(rx => (
                          <div key={rx.id} className="p-4 bg-cream rounded-xl">
                            <p className="text-sm font-medium text-obsidian">{rx.drugName}</p>
                            <p className="text-[10px] font-bold text-muted mt-0.5">{rx.dosage}</p>
                            <p className="text-[10px] font-medium text-muted/70 mt-1 leading-relaxed">{rx.instructions}</p>
                            {rx.prescribedBy && <p className="text-[9px] font-medium text-primary uppercase mt-2">Prescribed by {rx.prescribedBy}</p>}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  <Card className="p-6 md:p-8 border border-black/5 shadow-sm">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xs font-medium text-hint text-muted">Progress Photos</h3>
                        <button onClick={() => setShowGalleryUpload(true)} className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                           <Camera size={16} />
                        </button>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        {currentClient?.gallery?.slice(0, 4).map((item, i) => (
                           <div key={i} className="aspect-square bg-cream rounded-xl overflow-hidden relative cursor-pointer" onClick={() => setLightboxImage(item)}>
                              <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                           </div>
                        ))}
                        {(!currentClient?.gallery || currentClient.gallery.length === 0) && (
                           <div className="col-span-2 aspect-video bg-cream border-2 border-dashed border-black/5 rounded-xl flex flex-col items-center justify-center text-center p-4">
                              <Camera size={24} className="text-muted/30 mb-1" />
                              <p className="text-[8px] font-medium text-muted/60 uppercase">No photos yet</p>
                           </div>
                        )}
                     </div>
                     {currentClient?.gallery && currentClient.gallery.length > 4 && (
                        <button
                          onClick={() => setShowGalleryUpload(true)}
                          className="w-full text-center py-3 text-[9px] font-medium text-primary uppercase hover:underline mt-2"
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
              <h2 className="text-3xl font-medium text-obsidian">My Appointments</h2>
              <button
                onClick={() => setActiveTab('messages')}
                className="bg-primary text-clinical-dark px-8 py-3 rounded-full text-xs font-medium shadow-xl shadow-primary/10 hover:scale-105 transition-all active:scale-95"
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
                                <div className="w-14 h-14 md:w-16 md:h-16 bg-cream rounded-3xl flex flex-col items-center justify-center text-center shrink-0">
                                  <span className="text-[9px] font-medium text-primary uppercase">
                                    {new Date(apt.date).toLocaleString('default', { month: 'short' })}
                                  </span>
                                  <span className="text-xl font-medium text-obsidian leading-none">
                                    {new Date(apt.date).getDate()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-base md:text-lg font-medium text-obsidian truncate">{apt.type}</h4>
                                  <p className="text-xs md:text-sm font-medium text-muted">{apt.time}</p>
                                  {apt.doctorName && <p className="text-[9px] font-medium text-primary uppercase mt-1">{apt.doctorName}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-3 py-1.5 rounded-full text-2xs font-medium text-hint ${
                                  apt.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                                  apt.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                                  apt.status === 'Cancelled' ? 'bg-red-100 text-red-600' :
                                  'bg-gray-100 text-muted'
                                }`}>{apt.status}</span>
                                {isUpcoming && (
                                  <button
                                    onClick={() => { setRequestingAptId(isRequestingThis ? null : apt.id); setAptAction(null); setReschedulePreference(''); }}
                                    className="w-8 h-8 rounded-full bg-cream border border-black/10 flex items-center justify-center text-muted hover:text-primary transition-colors"
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
                                    <button onClick={() => setAptAction('reschedule')} className="flex-1 flex items-center justify-center gap-2 bg-cream hover:bg-primary/10 text-obsidian py-2.5 rounded-xl text-2xs font-medium text-hint transition-colors">
                                      <RefreshCw size={16} className="text-primary" /> Request Reschedule
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
                                    }} disabled={aptRequestSending} className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-xl text-2xs font-medium text-hint transition-colors disabled:opacity-50">
                                      <X size={16} /> Request Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="text-2xs font-medium text-hint text-muted">Preferred new date/time</p>
                                    <textarea
                                      value={reschedulePreference}
                                      onChange={e => setReschedulePreference(e.target.value)}
                                      placeholder="e.g. Any morning next week, preferably Tuesday or Thursday..."
                                      rows={2}
                                      className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-primary/20 resize-none"
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={() => setAptAction(null)} className="px-4 py-2 text-2xs font-medium text-hint text-muted hover:text-obsidian">Back</button>
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
                                      }} disabled={aptRequestSending} className="flex-1 bg-primary text-clinical-dark py-2 rounded-xl text-2xs font-medium text-hint disabled:opacity-50">
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
                      <p className="text-muted font-bold">You have no appointment history.</p>
                    </div>
                  )}
               </div>
               <div className="lg:col-span-4 space-y-6">
                  <div className="bg-primary/5 rounded-[3rem] p-8 md:p-10 border border-primary/10">
                    <h4 className="text-lg font-medium text-obsidian uppercase mb-6">Booking Policy</h4>
                    <ul className="space-y-4">
                      {[
                        "Please provide 48 hours' notice for cancellations.",
                        "Arrive 5 minutes before your scheduled session.",
                        "Avoid caffeinated drinks 2 hours prior to PRP."
                      ].map((item, i) => (
                        <li key={i} className="text-xs font-medium text-muted leading-relaxed flex gap-3">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-obsidian text-white rounded-[3rem] p-8 md:p-10">
                    <p className="text-2xs font-medium text-hint text-gray-400 mb-2">Need to make a change?</p>
                    <p className="text-sm font-bold text-gray-300 leading-relaxed mb-5">Use the menu on each upcoming appointment to request a reschedule or cancellation. Our team will confirm via message.</p>
                    <p className="text-[9px] font-medium text-primary uppercase">48 hours notice required</p>
                  </div>
               </div>
            </div>
          </div>
        );
      case 'assessments':
        return (
          <div className="animate-fade-up space-y-10">
            <h2 className="text-3xl font-medium text-obsidian">My Assessments</h2>
            
            {currentClient?.assessmentData?.clinicalFeedback ? (
              <div className="bg-obsidian text-white p-6 md:p-8 rounded-2xl shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/20 transition-colors" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                      <ClipboardList size={20} />
                    </div>
                    <h4 className="text-lg font-medium uppercase">Clinical Feedback</h4>
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm md:text-base leading-relaxed text-gray-200 font-medium italic font-serif">
                      "{currentClient.assessmentData.clinicalFeedback}"
                    </p>
                    <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-medium text-primary uppercase mb-1">Reviewed By</p>
                        <p className="text-xs font-bold">Novogenics Clinical Team</p>
                      </div>
                      {currentClient.assessmentData.reviewDate && (
                        <div className="text-right">
                          <p className="text-[9px] font-medium text-primary uppercase mb-1">Review Date</p>
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
                  <Info size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-medium text-obsidian mb-2">Assessment Status: Pending Review</h4>
                  <p className="text-muted font-medium leading-relaxed">
                    Thank you for submitting your comprehensive assessment. Our clinical team is currently reviewing your information. 
                    <span className="text-primary font-bold"> You will receive a response regarding your assessment here in this tab within 48 hours.</span>
                  </p>
                </div>
              </div>
            )}

            {currentClient?.assessmentData && (
              <div className="card-clinical p-8 md:p-10">
                <h3 className="text-xl font-medium text-obsidian uppercase mb-8">Submitted Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-medium text-primary uppercase block mb-2">Screening Conditions</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.screening?.conditions?.join(', ') || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-primary uppercase block mb-2">Triggers</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.consultation?.triggers || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-primary uppercase block mb-2">Lifestyle</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.consultation?.lifestyle || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-medium text-primary uppercase block mb-2">Medical History</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.consultation?.medicalHistory || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-primary uppercase block mb-2">Medications</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.consultation?.medications || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-primary uppercase block mb-2">Lifestyle & Hair Care</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.consultation?.lifestyle || 'N/A'} • {currentClient.assessmentData.consultation?.hairCare || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {currentClient.assessmentData.answers && (
                  <div className="mt-12 pt-12 border-t border-black/5">
                    <h3 className="text-xl font-medium text-obsidian uppercase mb-8">Detailed Responses</h3>
                    <div className="space-y-6">
                      {Object.entries(currentClient.assessmentData.answers).map(([key, answer]) => {
                        const displayValue = Array.isArray(answer.value) ? answer.value.join(', ') : answer.value;
                        if (key === 'f26' || key === 'm22') return null; // Skip photo upload for now
                        
                        return (
                          <div key={key} className="border-b border-black/5 pb-4 last:border-0">
                            <p className="text-[10px] font-medium text-muted uppercase mb-2">{answer.text}</p>
                            <p className="text-sm font-bold text-obsidian">{displayValue}</p>
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
            <h2 className="text-3xl font-medium text-obsidian">My Profile</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm text-center">
                  <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
                    <UserIcon size={40} />
                  </div>
                  <h3 className="text-xl font-medium text-obsidian mb-1">{user?.fullName}</h3>
                  <p className="text-2xs font-medium text-hint text-muted mb-6">Client ID: {currentClient?.id || 'N/A'}</p>
                  <div className="flex justify-center gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-2xs font-medium text-hint">
                      {currentClient?.status || 'Active'}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                  <h4 className="text-2xs font-medium text-hint text-muted mb-6">Account Status</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted">Policies Accepted</span>
                      <span className={`material-symbols-outlined text-sm ${currentClient?.policiesAccepted ? 'text-green-500' : 'text-red-500'}`}>
                        {currentClient?.policiesAccepted ? 'check_circle' : 'cancel'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-black/5 shadow-sm">
                  <h3 className="text-xl font-medium text-obsidian uppercase mb-8">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {isEditingProfile ? (
                      <form onSubmit={handleSaveProfile} className="md:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-muted uppercase block">Phone Number</label>
                            <input 
                              type="tel" 
                              value={profileForm.phone}
                              onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                              className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-muted uppercase block">Date of Birth</label>
                            <input 
                              type="date" 
                              value={profileForm.dob}
                              onChange={e => setProfileForm(p => ({ ...p, dob: e.target.value }))}
                              className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-muted uppercase block">Gender</label>
                            <select 
                              value={profileForm.gender}
                              onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value as 'male' | 'female' }))}
                              className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="female">Female</option>
                              <option value="male">Male</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-medium text-muted uppercase block">Address</label>
                            <input 
                              type="text" 
                              value={profileForm.address}
                              onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))}
                              className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
                          <button 
                            type="button"
                            onClick={() => setIsEditingProfile(false)}
                            className="px-6 py-3 rounded-full text-xs font-medium text-muted hover:bg-cream transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit"
                            disabled={isSavingProfile}
                            className="bg-primary text-clinical-dark px-8 py-3 rounded-full text-xs font-medium shadow-xl shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
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
                            <span className="text-[10px] font-medium text-muted uppercase block mb-2">Full Name</span>
                            <p className="text-sm font-bold text-obsidian">{user?.fullName}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-medium text-muted uppercase block mb-2">Email Address</span>
                            <p className="text-sm font-bold text-obsidian">{user?.email}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-medium text-muted uppercase block mb-2">Phone Number</span>
                            <p className="text-sm font-bold text-obsidian">{currentClient?.phone || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="space-y-6">
                          <div>
                            <span className="text-[10px] font-medium text-muted uppercase block mb-2">Date of Birth</span>
                            <p className="text-sm font-bold text-obsidian">{formatDOB(currentClient?.dob)}{calculateAge(currentClient?.dob)}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-medium text-muted uppercase block mb-2">Gender</span>
                            <p className="text-sm font-bold text-obsidian capitalize">{currentClient?.gender || 'Not provided'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-medium text-muted uppercase block mb-2">Address</span>
                            <p className="text-sm font-bold text-obsidian">{currentClient?.address || 'Not provided'}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {!isEditingProfile && (
                    <div className="mt-12 pt-12 border-t border-black/5">
                      <button 
                        onClick={handleEditProfileClick}
                        className="bg-obsidian text-white px-8 py-3 rounded-full text-xs font-medium shadow-xl shadow-black/10 hover:scale-105 transition-all"
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
        return <div className="p-20 text-center font-medium uppercase text-muted/40">Section Under Development</div>;
    }
  };

  const handleAcceptPolicies = () => {
    onAcceptPolicies();
    setShowPolicyModal(false);
  };

  return (
    <div className="portal-shell font-sans selection:bg-clinical/20">
      <PolicyConfirmationModal
        isOpen={showPolicyModal}
        onConfirm={handleAcceptPolicies}
        onNavigate={onNavigate}
      />
      {isSidebarOpen && <div className="sidebar-overlay lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      {/* Sidebar */}
      <aside className={`portal-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="cursor-pointer" onClick={() => onNavigate(Page.Home)}>
            <Logo size="sm" className="!justify-start scale-75 origin-left -ml-1" />
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden w-7 h-7 rounded-md flex items-center justify-center text-muted hover:bg-sand hover:text-obsidian">
            <X size={15} />
          </button>
        </div>

        <p className="nav-section-label">Portal</p>
        <nav className="space-y-0.5">
          <SidebarItem id="overview" label="Overview" icon="grid_view" activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="treatments" label="Treatments" icon="analytics" activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="appointments" label="Appointments" icon="calendar_month" activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="assessments" label="Assessments" icon="assignment" activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="messages" label="Messages" icon="forum" activeTab={activeTab} onClick={handleSidebarClick} badge={unreadMessagesCount} />
          <SidebarItem id="profile" label="Profile" icon="person" activeTab={activeTab} onClick={handleSidebarClick} />
        </nav>

        <div className="mt-3 px-2">
          <p className="nav-section-label" style={{ marginTop: 0 }}>Journey</p>
          <div className="px-2 py-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-2xs text-hint">{progress}% complete</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill success" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-auto pt-3 border-t border-sand">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-sand transition-colors">
            <div className="avatar avatar-sm bg-clinical-bg text-clinical">{firstName[0]}</div>
            <div className="flex flex-col min-w-0 flex-grow">
              <span className="text-xs font-medium text-obsidian truncate">{user?.fullName}</span>
              <span className="text-2xs text-hint truncate">Patient · {user?.id}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full mt-1 flex items-center gap-2.5 px-2 py-1.5 rounded-md text-muted hover:bg-danger-light hover:text-danger transition-colors"
          >
            <LogOut size={13} />
            <span className="text-xs">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="portal-main">
        <header className="portal-topbar">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-8 h-8 rounded-md flex items-center justify-center text-muted hover:bg-sand hover:text-obsidian">
            <Menu size={16} />
          </button>
          <div className="flex flex-col leading-none flex-grow min-w-0">
            <span className="page-eyebrow truncate">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span className="page-title truncate mt-0.5" style={{ fontSize: 15, lineHeight: '20px' }}>
              {activeTab === 'overview' ? `Welcome back, ${firstName}` :
                activeTab === 'treatments' ? 'My treatments' :
                activeTab === 'appointments' ? 'My appointments' :
                activeTab === 'assessments' ? 'My assessments' :
                activeTab === 'messages' ? 'Messages' :
                activeTab === 'profile' ? 'My profile' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`btn-icon relative ${showNotifications ? 'bg-cream text-obsidian' : ''}`}
                aria-label="Notifications"
              >
                <Bell size={15} />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 bg-danger rounded-full border border-white text-[9px] font-medium text-white flex items-center justify-center">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 w-[320px] md:w-[380px] bg-white rounded-lg shadow-modal border border-sand z-50 overflow-hidden animate-fade-up origin-top-right">
                    <div className="p-3 border-b border-sand">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-medium text-obsidian">Notifications</h3>
                        <button
                          onClick={() => notifications.forEach(n => !n.read && onMarkNotificationRead(n.id))}
                          className="text-xs text-clinical hover:underline"
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="flex gap-1 bg-cream p-0.5 rounded-md">
                        {(['all', 'message', 'appointment', 'feedback'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setNotifFilter(f)}
                            className={`flex-1 py-1 rounded text-2xs font-medium transition-colors ${notifFilter === f ? 'bg-white text-obsidian shadow-card' : 'text-muted hover:text-obsidian'}`}
                          >
                            {f === 'all' ? 'All' : f === 'message' ? 'Msgs' : f === 'appointment' ? 'Appts' : 'Feedbk'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="max-h-[380px] overflow-y-auto">
                      {filteredNotifications.length > 0 ? (
                        filteredNotifications.map((n) => {
                          const timeAgo = n.createdAt ? (() => {
                            const diff = Date.now() - new Date(n.createdAt).getTime();
                            if (diff < 60000) return 'just now';
                            if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
                            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
                            return `${Math.floor(diff / 86400000)}d`;
                          })() : 'recently';

                          return (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`px-3 py-3 border-b border-sand flex gap-3 hover:bg-subtle transition-colors cursor-pointer relative ${!n.read ? 'bg-clinical-bg/30' : ''}`}
                            >
                              {!n.read && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-clinical" />}
                              <div className="min-w-0 flex-grow">
                                <p className="text-xs font-medium text-obsidian mb-0.5 truncate">{n.title}</p>
                                <p className="text-xs text-muted leading-snug line-clamp-2">{n.body}</p>
                                <p className="text-2xs text-hint uppercase tracking-wider mt-1">{timeAgo}</p>
                              </div>
                              {!n.read && <div className="w-1.5 h-1.5 bg-clinical rounded-full shrink-0 mt-1.5" />}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-10 text-center">
                          <BellOff size={28} className="text-hint mb-2 mx-auto block" />
                          <p className="text-xs text-muted">No notifications</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

        </header>
        <div className="portal-content px-4 sm:px-6 lg:px-8 py-5">
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
          <div className="absolute inset-0 bg-obsidian/60 backdrop-blur-sm" onClick={() => setHasSeenAssessmentAlert(true)} />
          <div className="bg-white p-8 rounded-3xl shadow-2xl relative z-10 max-w-md w-full text-center animate-fade-up">
            <Info size={48} className="text-primary mb-4 mx-auto" />
            <h3 className="text-xl font-medium text-obsidian mb-2">Assessment Received</h3>
            <p className="text-muted mb-6 font-medium">Your assessment will be reviewed within 24 hours – our clinical team will be in touch via phone call.</p>
            <button onClick={() => setHasSeenAssessmentAlert(true)} className="bg-primary text-white px-8 py-3 rounded-full font-medium uppercase text-xs w-full hover:scale-105 transition-all shadow-lg shadow-primary/20">Understood</button>
          </div>
        </div>
      )}

      {showGalleryUpload && currentClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm" onClick={() => !isUploading && setShowGalleryUpload(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden z-10 animate-fade-up">
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div>
                  <h3 className="text-xl md:text-2xl font-medium text-obsidian">Add Progress Photo</h3>
                  <p className="text-[10px] md:text-xs font-bold text-muted uppercase mt-1">Upload to your gallery</p>
                </div>
                <button 
                  onClick={() => setShowGalleryUpload(false)}
                  disabled={isUploading}
                  className="w-10 h-10 rounded-full bg-cream flex items-center justify-center text-muted hover:text-obsidian transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="aspect-video bg-cream rounded-2xl border-2 border-dashed border-black/5 overflow-hidden relative flex flex-col items-center justify-center group">
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
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-4 p-8">
                      <div className="flex gap-4">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-black/5 flex flex-col items-center justify-center gap-1 text-muted hover:text-primary hover:border-primary/20 transition-all"
                        >
                          <Upload size={20} />
                          <span className="text-[8px] font-medium uppercase">Gallery</span>
                        </button>
                        <button 
                          onClick={() => cameraInputRef.current?.click()}
                          className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-black/5 flex flex-col items-center justify-center gap-1 text-muted hover:text-primary hover:border-primary/20 transition-all"
                        >
                          <Camera size={20} />
                          <span className="text-[8px] font-medium uppercase">Camera</span>
                        </button>
                      </div>
                      <p className="text-[10px] font-bold text-muted uppercase">Select or take a photo</p>
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
                  <label className="text-[10px] font-medium text-muted uppercase ml-1">Photo Label</label>
                  <input 
                    type="text"
                    value={galleryUploadLabel}
                    onChange={(e) => setGalleryUploadLabel(e.target.value)}
                    placeholder="e.g., Month 3 Progress"
                    className="w-full px-6 py-4 bg-cream rounded-2xl border border-black/5 font-bold text-obsidian placeholder:text-muted/40 focus:outline-none focus:border-primary/30 transition-all"
                  />
                </div>

                <button 
                  onClick={() => handleGalleryUpload(currentClient.id, currentClient.gallery)}
                  disabled={isUploading || !galleryUploadFile}
                  className="w-full bg-primary text-clinical-dark py-5 rounded-2xl font-medium uppercase text-xs md:text-sm flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                >
                  {isUploading ? (
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex-grow h-2 bg-white/30 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all duration-300" style={{width: `${uploadProgress}%`}} />
                      </div>
                      <span className="text-xs font-medium">{uploadProgress}%</span>
                    </div>
                  ) : (
                    <>
                      <Upload size={20} />
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
            <X size={20} />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white px-6 py-3 rounded-full text-xs font-medium uppercase text-center">
            {lightboxImage.label} • {new Date(lightboxImage.uploadedAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ClientDashboard);