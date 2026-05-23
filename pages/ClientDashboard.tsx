import React, { useState, useMemo, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Stethoscope, FileText, CheckCircle, CreditCard, MessageCircle, Send,
  CalendarDays, FlaskConical, Navigation, History, ClipboardList, Info,
  UserIcon, X, LogOut, Menu, Bell, BellOff, ArrowRight, Pill, Camera,
  Upload, RefreshCw, BarChart2,
  LayoutDashboard, Calendar as CalendarIcon, MessageSquare,
  BadgeCheck, CalendarCheck, Star,
} from 'lucide-react';
import {
  Button, Input, Modal, PageHeader, EmptyState, StatusBadge as UIStatusBadge,
  Stat, Card as UICard, CardHeader, SidebarItem as UISidebarItem,
  BottomNav, useToast,
} from '../components/ui';
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

const iconMap: Record<string, React.ReactNode> = {
  overview: <LayoutDashboard size={15} />,
  treatments: <FlaskConical size={15} />,
  appointments: <CalendarIcon size={15} />,
  assessments: <ClipboardList size={15} />,
  messages: <MessageSquare size={15} />,
  profile: <UserIcon size={15} />,
};

const SidebarItem: React.FC<SidebarItemProps> = ({ id, label, activeTab, onClick, badge }) => (
  <UISidebarItem
    icon={iconMap[id]}
    label={label}
    active={activeTab === id}
    badge={badge}
    onClick={() => onClick(id)}
  />
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
    <div className="animate-fade-up h-[calc(100dvh-16rem)] sm:h-[calc(100dvh-12rem)] flex flex-col">
      <div className="bg-white rounded-lg border border-black/5 shadow-sm flex flex-col overflow-hidden flex-grow">
        <div className="p-4 md:p-6 border-b border-black/5 flex justify-between items-center bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Stethoscope size={20} />
            </div>
            <div>
              <h3 className="text-xs font-medium text-obsidian">Novogenics Clinical Support</h3>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <p className="text-2xs font-medium text-muted">Direct Portal Access</p>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <span className="text-xs text-muted">Response time: &lt; 24h</span>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4 no-scrollbar bg-cream/30">
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
                        <span className="text-xs text-muted">Clinical Form</span>
                      </div>
                      <p className="text-xs font-medium">{FORMS.find(f => f.id === msg.formId)?.title || msg.subject}</p>
                      <button
                        onClick={() => onOpenForm(msg)}
                        className="block w-full bg-primary text-obsidian text-center py-2 rounded-xl text-xs text-muted transition-transform"
                      >
                        {msg.isSigned ? 'View Completed Form' : 'Open Interactive Form'}
                      </button>
                      {msg.isSigned && (
                        <div className="flex items-center gap-1 text-green-500 text-2xs font-medium">
                          <CheckCircle size={10} />
                          Signed
                        </div>
                      )}
                    </div>
                  ) : msg.type === 'payment' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <CreditCard size={16} />
                        <span className="text-xs text-muted">Payment Request</span>
                      </div>
                      <p className="text-xs font-medium">{msg.body.split(': ')[0]}</p>
                      <a
                        href={msg.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full bg-primary text-obsidian text-center py-2 rounded-xl text-xs text-muted transition-transform"
                      >
                        Complete Payment
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed mb-2">{msg.body}</p>
                  )}
                  <div className={`text-2xs font-medium ${
                    msg.senderId === user?.id ? 'text-white/40 text-right' : 'text-muted'
                  }`}>
                    {new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 md:p-12">
              <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center text-primary/20 mb-4 shadow-sm">
                <MessageCircle size={40} className="text-primary/20" />
              </div>
              <p className="text-xs font-medium text-muted">No messages yet. Start a conversation with our clinical team.</p>
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
              className="flex-grow bg-cream border-transparent rounded-xl px-6 py-4 text-xs font-medium focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || isSending}
              className="w-12 h-12 bg-primary text-obsidian rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-obsidian/20 border-t-clinical-dark rounded-full animate-spin" />
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
  const { toast } = useToast();
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
        toast.error(error);
        e.target.value = '';
        return;
      }
      setGalleryUploadFile(file);
      // Use object URL (lightweight pointer) instead of base64 (full file in memory).
      // Previous object URL is revoked when state changes — see effect below.
      setGalleryUploadPreview(URL.createObjectURL(file));
    }
  };

  // Revoke object URLs when preview changes or component unmounts so the
  // browser releases the underlying blob (prevents memory accumulation).
  React.useEffect(() => {
    return () => {
      if (galleryUploadPreview && galleryUploadPreview.startsWith('blob:')) {
        URL.revokeObjectURL(galleryUploadPreview);
      }
    };
  }, [galleryUploadPreview]);

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
      toast.success('Photo uploaded');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to upload photo. Please try again.';
      console.error('Error uploading gallery photo:', error);
      toast.error('Upload failed', { description: msg });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
      toast.error('Save failed', { description: 'Please try again.' });
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
          <div className="animate-fade-up flex flex-col gap-6">
            <PageHeader
              title={`Welcome back, ${firstName}`}
              subtitle={`Account status: ${currentClient?.status || 'Active'}`}
              actions={
                <UIStatusBadge status={currentClient?.packageStatus || 'Active'} />
              }
            />

            {/* Banner: assessment awaiting review — only renders if relevant */}
            {currentClient?.status === 'Assessment Submitted' && !currentClient?.assessmentData?.clinicalFeedback && (
              <button
                onClick={() => setActiveTab('assessments')}
                className="w-full text-left bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-2xl p-5 md:p-6 flex items-center justify-between gap-4 transition-colors group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <ClipboardList size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xs uppercase tracking-wider text-primary font-medium mb-0.5">Awaiting clinical review</p>
                    <h4 className="text-base md:text-lg font-medium text-obsidian leading-snug">
                      Your assessment is with the clinical team
                    </h4>
                    <p className="text-xs md:text-sm text-muted mt-0.5">Typically reviewed within 48 hours · Tap to view what you submitted</p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-primary shrink-0 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            {/* Banner: feedback ready — promotes the assessment tab */}
            {currentClient?.assessmentData?.clinicalFeedback && currentClient?.status === 'Reviewed' && (
              <button
                onClick={() => setActiveTab('assessments')}
                className="w-full text-left bg-success-light hover:bg-success-light/80 border border-success/30 rounded-2xl p-5 md:p-6 flex items-center justify-between gap-4 transition-colors group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-success/20 flex items-center justify-center text-success-text shrink-0">
                    <CheckCircle size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xs uppercase tracking-wider text-success-text font-medium mb-0.5">Feedback ready</p>
                    <h4 className="text-base md:text-lg font-medium text-obsidian leading-snug">
                      Your clinical team has reviewed your assessment
                    </h4>
                    <p className="text-xs md:text-sm text-muted mt-0.5">Tap to read your personalised feedback</p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-success-text shrink-0 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <UICard>
                <CardHeader
                  title="Next appointment"
                  leadingIcon={<CalendarDays size={14} />}
                />
                {nextAppointment ? (
                  <div className="flex items-baseline justify-between">
                    <p className="text-lg font-medium text-obsidian">
                      {new Date(nextAppointment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-sm text-muted">{nextAppointment.time}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted">No upcoming sessions</p>
                )}
              </UICard>

              <UICard>
                <CardHeader
                  title="Treatment plan"
                  leadingIcon={<FlaskConical size={14} />}
                />
                <p className="text-base font-medium text-obsidian truncate">{currentClient?.package || 'Assessment only'}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="progress-track flex-grow"><div className="progress-fill gold" style={{ width: `${progress}%` }} /></div>
                  <span className="text-xs text-muted">{progress}%</span>
                </div>
              </UICard>

              <UICard tone="dark">
                <CardHeader
                  title={<span className="text-white">Your clinician</span>}
                  leadingIcon={<Stethoscope size={14} className="text-primary" />}
                />
                {(() => {
                  const assigned = userAppointments
                    .filter(a => a.doctorName)
                    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())[0];
                  if (assigned?.doctorName) {
                    return (
                      <>
                        <p className="text-base font-medium text-white">{assigned.doctorName}</p>
                        <p className="text-xs text-white/60 mt-0.5">Via {assigned.type}</p>
                      </>
                    );
                  }
                  return (
                    <>
                      <p className="text-base font-medium text-white">Pending assignment</p>
                      <p className="text-xs text-white/60 mt-0.5">A clinician is assigned at booking</p>
                    </>
                  );
                })()}
              </UICard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <UICard>
                <CardHeader title="Quick actions" />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" fullWidth leadingIcon={<CalendarDays size={14} />} onClick={() => setActiveTab('messages')} className="!justify-start">
                    Request visit
                  </Button>
                  <Button variant="ghost" fullWidth leadingIcon={<BarChart2 size={14} />} onClick={() => setActiveTab('treatments')} className="!justify-start">
                    View progress
                  </Button>
                  <Button variant="ghost" fullWidth leadingIcon={<MessageCircle size={14} />} onClick={() => setActiveTab('messages')} className="!justify-start">
                    Message clinic
                  </Button>
                  <Button variant="ghost" fullWidth leadingIcon={<ClipboardList size={14} />} onClick={() => setActiveTab('assessments')} className="!justify-start">
                    My assessment
                  </Button>
                </div>
              </UICard>

              <UICard tone="dark">
                <CardHeader
                  title={<span className="text-white">Clinical update</span>}
                  subtitle={
                    currentClient?.assessmentData?.reviewDate ? (
                      <span className="text-white/60">
                        Reviewed {new Date(currentClient.assessmentData.reviewDate).toLocaleDateString()}
                      </span>
                    ) : undefined
                  }
                  leadingIcon={<ClipboardList size={14} className="text-primary" />}
                />
                {currentClient?.assessmentData?.clinicalFeedback ? (
                  <button
                    onClick={() => setActiveTab('assessments')}
                    className="w-full text-left bg-white/5 rounded-md border border-white/10 hover:bg-white/10 transition-colors p-3"
                  >
                    <p className="text-sm leading-relaxed text-white/85 line-clamp-3">
                      "{currentClient.assessmentData.clinicalFeedback}"
                    </p>
                    <p className="text-xs text-primary mt-2 flex items-center gap-1">
                      Read full review <ArrowRight size={12} />
                    </p>
                  </button>
                ) : currentClient?.status === 'Assessment Submitted' ? (
                  <div className="bg-white/5 rounded-md border border-white/10 p-3">
                    <p className="text-xs text-primary mb-1">Under review</p>
                    <p className="text-sm leading-relaxed text-white/75">
                      Your clinical team is reviewing your assessment. You'll be notified when feedback is ready.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-white/60">No clinical updates yet.</p>
                )}
              </UICard>
            </div>
          </div>
        );
      case 'treatments': {
          const plan = currentClient?.treatmentPlan;
          const rxList = currentClient?.prescriptions || [];
          const activeRx = rxList.filter(r => r.status === 'Active');
          return (
          <div className="animate-fade-up flex flex-col gap-6">
            <PageHeader title="Treatment plan" subtitle="Your personalised clinical roadmap and progress" />

            {/* Treatment phases */}
            {plan?.phases?.length ? (
              <div className="bg-white rounded-lg p-6 md:p-10 border border-black/5 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <Navigation size={20} className="text-primary" />
                    <h3 className="text-xs font-medium text-obsidian">{plan.title || 'Treatment Plan'}</h3>
                  </div>
                  <div className="px-4 py-1.5 bg-cream rounded-full text-2xs text-muted">
                    {plan.phases.filter(p => p.status === 'Completed').length}/{plan.phases.length} Phases Complete
                  </div>
                </div>
                <div className="space-y-4">
                  {plan.phases.map((phase, i) => {
                    const pct = phase.sessionsPlanned > 0 ? Math.round((phase.sessionsCompleted / phase.sessionsPlanned) * 100) : 0;
                    const statusColor: Record<string, string> = { Active: 'bg-primary text-obsidian', Completed: 'bg-green-100 text-green-700', Planned: 'bg-cream text-muted border border-black/5', 'On Hold': 'bg-yellow-100 text-yellow-700' };
                    return (
                      <div key={phase.id} className={`p-5 md:p-6 rounded-2xl border transition-all ${phase.status === 'Active' ? 'border-primary/30 bg-primary/5' : phase.status === 'Completed' ? 'border-black/5 bg-cream/30' : 'border-black/5 bg-white'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-2xs font-medium shrink-0 ${phase.status === 'Completed' ? 'bg-green-500 text-white' : phase.status === 'Active' ? 'bg-primary text-obsidian' : 'bg-cream text-muted border border-black/10'}`}>
                              {phase.status === 'Completed' ? '✓' : i + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-obsidian">{phase.name}</p>
                              {phase.description && <p className="text-2xs text-muted font-medium">{phase.description}</p>}
                            </div>
                          </div>
                          <span className={`text-xs text-muted px-2 py-1 rounded-full shrink-0 ${statusColor[phase.status]}`}>{phase.status}</span>
                        </div>
                        {phase.status !== 'Planned' && (
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex-grow h-1 bg-black/5 rounded-full overflow-hidden">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-2xs font-medium text-primary shrink-0">{phase.sessionsCompleted}/{phase.sessionsPlanned} sessions</span>
                          </div>
                        )}
                        {phase.notes && <p className="text-2xs text-muted/80 font-medium mt-2">"{phase.notes}"</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg p-6 md:p-10 border border-black/5 shadow-sm text-center">
                <Stethoscope size={40} className="text-primary/20 mb-3 mx-auto" />
                <p className="text-2xs text-muted">No treatment plan assigned yet</p>
                <p className="text-xs text-muted/60 mt-1 font-medium">Your clinician will create your personalised plan after your first session</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
               {/* Left: Session Timeline */}
               <div className="lg:col-span-8 space-y-6">
                  <div className="bg-white rounded-lg p-6 md:p-10 border border-black/5 shadow-sm">
                     <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-3">
                           <History size={20} className="text-primary" />
                           <h3 className="text-xs font-medium text-obsidian">Session Timeline</h3>
                        </div>
                        <div className="px-4 py-1.5 bg-cream rounded-full text-2xs text-muted">
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
                                   <p className="text-2xs text-muted">Session {userAppointments.length - i}</p>
                                   <h4 className="text-base font-medium text-obsidian mt-0.5">{session.type}</h4>
                                </div>
                                <span className={`text-2xs font-medium px-3 py-1 rounded-full ${session.status === 'Completed' ? 'bg-obsidian text-white' : 'bg-primary/10 text-primary'}`}>{session.status}</span>
                             </div>
                             <p className="text-2xs text-muted mb-2 flex items-center gap-2">
                                <CalendarDays size={16} />
                                {new Date(session.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {session.time && <span>· {session.time}</span>}
                             </p>
                             {session.notes && (
                                <p className="text-xs leading-relaxed text-muted font-medium pt-3 border-t border-black/5">
                                   "{session.notes}"
                                </p>
                             )}
                          </div>
                        ))}
                        {userAppointments.length === 0 && (
                           <div className="py-20 text-center">
                              <ClipboardList size={40} className="text-primary/10 mb-3 mx-auto" />
                              <p className="text-2xs text-muted">No session history yet</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               {/* Right: Progress Summary, Prescriptions & Gallery */}
               <div className="lg:col-span-4 space-y-6">
                  <Card className="p-5 md:p-8 bg-obsidian text-white border-none shadow-xl shadow-obsidian/20">
                     <h3 className="text-xs text-muted text-gray-400 mb-6">Program Overview</h3>
                     <div className="space-y-6">
                        <div>
                           <p className="text-2xs text-muted mb-1">Current Protocol</p>
                           <p className="text-sm font-medium">{currentClient?.package || 'Assessment Underway'}</p>
                        </div>
                        <div>
                           <p className="text-2xs font-medium text-gray-400 uppercase mb-3">Session Progress</p>
                           <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${progress}%` }} />
                           </div>
                           <p className="text-2xs font-medium text-right mt-1 text-primary">{progress}%</p>
                        </div>
                        <button onClick={() => setActiveTab('messages')} className="w-full bg-white text-obsidian py-3 rounded-xl text-xs text-muted shadow-lg shadow-white/5 transition-all">Request Next Session</button>
                     </div>
                  </Card>

                  {/* Prescriptions */}
                  {activeRx.length > 0 && (
                    <Card className="p-6 md:p-8 border border-black/5 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <Pill size={20} className="text-primary" />
                        <h3 className="text-xs text-muted">Active Prescriptions</h3>
                      </div>
                      <div className="space-y-3">
                        {activeRx.map(rx => (
                          <div key={rx.id} className="p-4 bg-cream rounded-md">
                            <p className="text-sm font-medium text-obsidian">{rx.drugName}</p>
                            <p className="text-2xs font-medium text-muted mt-0.5">{rx.dosage}</p>
                            <p className="text-2xs font-medium text-muted/70 mt-1 leading-relaxed">{rx.instructions}</p>
                            {rx.prescribedBy && <p className="text-2xs text-muted mt-2">Prescribed by {rx.prescribedBy}</p>}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  <Card className="p-6 md:p-8 border border-black/5 shadow-sm">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs text-muted">Progress Photos</h3>
                        <button onClick={() => setShowGalleryUpload(true)} className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                           <Camera size={16} />
                        </button>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        {currentClient?.gallery?.slice(0, 4).map((item, i) => (
                           <div key={i} className="aspect-square bg-cream rounded-md overflow-hidden relative cursor-pointer" onClick={() => setLightboxImage(item)}>
                              <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                           </div>
                        ))}
                        {(!currentClient?.gallery || currentClient.gallery.length === 0) && (
                           <div className="col-span-2 aspect-video bg-cream border-2 border-dashed border-black/5 rounded-xl flex flex-col items-center justify-center text-center p-4">
                              <Camera size={24} className="text-muted/30 mb-1" />
                              <p className="text-2xs font-medium text-muted/60 uppercase">No photos yet</p>
                           </div>
                        )}
                     </div>
                     {currentClient?.gallery && currentClient.gallery.length > 4 && (
                        <button
                          onClick={() => setShowGalleryUpload(true)}
                          className="w-full text-center py-3 text-2xs text-muted hover:underline mt-2"
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
          <div className="animate-fade-up flex flex-col gap-6">
            <PageHeader
              title="Appointments"
              subtitle="Upcoming and past sessions"
              actions={
                <Button variant="primary" size="sm" leadingIcon={<CalendarDays size={13} />} onClick={() => setActiveTab('messages')}>
                  Request visit
                </Button>
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-10">
               <div className="lg:col-span-8 space-y-4">
                  {userAppointments.length > 0 ? (
                    userAppointments
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((apt) => {
                        // Compare full date+time, not just calendar day, so an
                        // appointment at 09:00 isn't marked "upcoming" at 14:00 the same day.
                        const aptDateTime = new Date(`${apt.date}T${apt.time || '00:00'}`);
                        const isUpcoming = (apt.status === 'Confirmed' || apt.status === 'Pending') && aptDateTime.getTime() >= Date.now();
                        const isRequestingThis = requestingAptId === apt.id;
                        return (
                          <div key={apt.id} className="bg-white rounded-lg border border-black/5 shadow-sm overflow-hidden">
                            <div className="p-6 md:p-8 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 md:gap-6 min-w-0">
                                <div className="w-14 h-14 md:w-16 md:h-16 bg-cream rounded-lg flex flex-col items-center justify-center text-center shrink-0">
                                  <span className="text-2xs text-muted">
                                    {new Date(apt.date).toLocaleString('default', { month: 'short' })}
                                  </span>
                                  <span className="text-xl font-medium text-obsidian leading-none">
                                    {new Date(apt.date).getDate()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-base md:text-lg font-medium text-obsidian truncate">{apt.type}</h4>
                                  <p className="text-xs md:text-sm font-medium text-muted">{apt.time}</p>
                                  {apt.doctorName && <p className="text-2xs text-muted mt-1">{apt.doctorName}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-3 py-1.5 rounded-full text-xs text-muted ${
                                  apt.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                                  apt.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                                  apt.status === 'Cancelled' ? 'bg-red-100 text-red-600' :
                                  'bg-gray-100 text-muted'
                                }`}>{apt.status}</span>
                                {isUpcoming && (
                                  <button
                                    onClick={() => { setRequestingAptId(isRequestingThis ? null : apt.id); setAptAction(null); setReschedulePreference(''); }}
                                    className="w-10 h-10 rounded-full bg-cream border border-black/10 flex items-center justify-center text-muted hover:text-primary transition-colors"
                                  >
                                    {isRequestingThis ? <X size={13} /> : <ArrowRight size={13} />}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Inline action panel */}
                            {isRequestingThis && (
                              <div className="px-6 md:px-8 pb-6 border-t border-black/5 pt-4">
                                {!aptAction ? (
                                  <div className="flex flex-col sm:flex-row gap-3">
                                    <button onClick={() => setAptAction('reschedule')} className="flex-1 flex items-center justify-center gap-2 bg-cream hover:bg-primary/10 text-obsidian py-3 rounded-xl text-xs transition-colors">
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
                                    }} disabled={aptRequestSending} className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl text-xs transition-colors disabled:opacity-50">
                                      <X size={16} /> Request Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="text-xs text-muted">Preferred new date/time</p>
                                    <textarea
                                      value={reschedulePreference}
                                      onChange={e => setReschedulePreference(e.target.value)}
                                      placeholder="e.g. Any morning next week, preferably Tuesday or Thursday..."
                                      rows={2}
                                      className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-primary/20 resize-none"
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={() => setAptAction(null)} className="px-4 py-2 text-xs text-muted hover:text-obsidian">Back</button>
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
                                      }} disabled={aptRequestSending} className="flex-1 bg-primary text-obsidian py-2 rounded-xl text-xs text-muted disabled:opacity-50">
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
                    <div className="bg-white p-6 md:p-12 rounded-lg border border-black/5 text-center">
                      <p className="text-muted font-medium">You have no appointment history.</p>
                    </div>
                  )}
               </div>
               <div className="lg:col-span-4 space-y-6">
                  <div className="bg-primary/5 rounded-xl p-5 md:p-8 lg:p-10 border border-primary/10">
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
                  <div className="bg-obsidian text-white rounded-xl p-5 md:p-8 lg:p-10">
                    <p className="text-xs text-muted text-gray-400 mb-2">Need to make a change?</p>
                    <p className="text-sm font-medium text-gray-300 leading-relaxed mb-5">Use the menu on each upcoming appointment to request a reschedule or cancellation. Our team will confirm via message.</p>
                    <p className="text-2xs text-muted">48 hours notice required</p>
                  </div>
               </div>
            </div>
          </div>
        );
      case 'assessments':
        return (
          <div className="animate-fade-up flex flex-col gap-6">
            <PageHeader title="Assessments" subtitle="Your clinical reviews and feedback" />
            
            {currentClient?.assessmentData?.clinicalFeedback ? (
              <div className="bg-obsidian text-white p-6 md:p-8 rounded-2xl shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/20 transition-colors" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                      <ClipboardList size={20} />
                    </div>
                    <h4 className="text-lg font-medium">Clinical Feedback</h4>
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm md:text-base leading-relaxed text-gray-200 font-medium">
                      "{currentClient.assessmentData.clinicalFeedback}"
                    </p>
                    <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <p className="text-2xs text-muted mb-1">Reviewed By</p>
                        <p className="text-xs font-medium">Novogenics Clinical Team</p>
                      </div>
                      {currentClient.assessmentData.reviewDate && (
                        <div className="text-right">
                          <p className="text-2xs text-muted mb-1">Review Date</p>
                          <p className="text-xs font-medium">{new Date(currentClient.assessmentData.reviewDate).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-primary/20 rounded-2xl overflow-hidden shadow-card">
                <div className="bg-primary/5 px-6 md:px-8 py-6 flex items-start gap-4 md:gap-6">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary shrink-0">
                    <ClipboardList size={20} />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-2xs uppercase tracking-wider text-primary font-medium mb-1">Assessment received</p>
                    <h4 className="text-lg font-medium text-obsidian mb-2">
                      Thanks {firstName}, your clinical team has it.
                    </h4>
                    <p className="text-sm text-muted leading-relaxed">
                      A doctor will personally review your responses and photos.
                      You'll receive a notification here and by email when your feedback is ready —{' '}
                      <span className="text-obsidian font-medium">usually within 48 hours.</span>
                    </p>
                  </div>
                </div>

                {/* Visual progress timeline so patients can see exactly where they are */}
                <div className="px-6 md:px-8 py-6 border-t border-sand">
                  <div className="flex items-center gap-3 md:gap-4">
                    <TimelineStep label="Submitted" state="complete" />
                    <TimelineConnector state="complete" />
                    <TimelineStep label="Under review" state="active" />
                    <TimelineConnector state="pending" />
                    <TimelineStep label="Feedback ready" state="pending" />
                    <TimelineConnector state="pending" />
                    <TimelineStep label="Book consultation" state="pending" />
                  </div>
                  <p className="text-2xs text-hint mt-4 text-center">
                    Submitted {currentClient?.createdAt
                      ? new Date(currentClient.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : 'just now'}
                  </p>
                </div>
              </div>
            )}

            {currentClient?.assessmentData && (
              <div className="bg-white border border-sand rounded-lg shadow-card p-5 md:p-8 lg:p-10">
                <h3 className="text-xl font-medium text-obsidian uppercase mb-8">Submitted Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10">
                  <div className="space-y-6">
                    <div>
                      <span className="text-2xs text-muted block mb-2">Screening Conditions</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.screening?.conditions?.join(', ') || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-2xs text-muted block mb-2">Triggers</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.consultation?.triggers || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-2xs text-muted block mb-2">Lifestyle</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.consultation?.lifestyle || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <span className="text-2xs text-muted block mb-2">Medical History</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.consultation?.medicalHistory || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-2xs text-muted block mb-2">Medications</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.consultation?.medications || 'None reported'}
                      </p>
                    </div>
                    <div>
                      <span className="text-2xs text-muted block mb-2">Lifestyle & Hair Care</span>
                      <p className="text-sm font-medium text-obsidian">
                        {currentClient.assessmentData.consultation?.lifestyle || 'N/A'} • {currentClient.assessmentData.consultation?.hairCare || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {currentClient.assessmentData.answers && (() => {
                  // Pull out photo URLs (from f26 female / m22 male photo questions)
                  // and render them as a gallery above the text responses so
                  // patients see what they submitted.
                  const photoAnswers = ['f26', 'm22']
                    .map(k => currentClient.assessmentData!.answers?.[k])
                    .filter(Boolean);
                  const photoUrls: string[] = photoAnswers.flatMap(a =>
                    Array.isArray(a!.value) ? (a!.value as string[]) : []
                  );

                  return (
                    <div className="mt-12 pt-12 border-t border-black/5">
                      {photoUrls.length > 0 && (
                        <div className="mb-10">
                          <h3 className="text-xl font-medium text-obsidian uppercase mb-2">Photos You Uploaded</h3>
                          <p className="text-sm text-muted mb-4">Your clinical team uses these to assess your hair and scalp.</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {photoUrls.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block aspect-square rounded-lg overflow-hidden bg-cream border border-sand hover:border-primary/40 transition-colors group"
                              >
                                <img
                                  src={url}
                                  alt={`Assessment photo ${i + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <h3 className="text-xl font-medium text-obsidian uppercase mb-8">Detailed Responses</h3>
                      <div className="space-y-6">
                        {Object.entries(currentClient.assessmentData.answers).map(([key, answer]) => {
                          if (key === 'f26' || key === 'm22') return null; // Photos rendered above
                          const displayValue = Array.isArray(answer.value) ? answer.value.join(', ') : answer.value;
                          return (
                            <div key={key} className="border-b border-black/5 pb-4 last:border-0">
                              <p className="text-2xs text-muted mb-2">{answer.text}</p>
                              <p className="text-sm font-medium text-obsidian">{displayValue}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
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
          <div className="animate-fade-up flex flex-col gap-6">
            <PageHeader title="Profile" subtitle="Your account and contact details" />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-10">
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-5 md:p-8 rounded-lg border border-black/5 shadow-sm text-center">
                  <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
                    <UserIcon size={40} />
                  </div>
                  <h3 className="text-xl font-medium text-obsidian mb-1">{user?.fullName}</h3>
                  <p className="text-xs text-muted mb-6">Client ID: {currentClient?.id || 'N/A'}</p>
                  <div className="flex justify-center gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs text-muted">
                      {currentClient?.status || 'Active'}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 md:p-8 rounded-lg border border-black/5 shadow-sm">
                  <h4 className="text-xs text-muted mb-6">Account Status</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted">Policies Accepted</span>
                      {currentClient?.policiesAccepted
                        ? <CheckCircle size={14} className="text-success" />
                        : <X size={14} className="text-danger" />}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white p-5 md:p-8 lg:p-12 rounded-xl border border-black/5 shadow-sm">
                  <h3 className="text-xl font-medium text-obsidian uppercase mb-8">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    {isEditingProfile ? (
                      <form onSubmit={handleSaveProfile} className="md:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-2xs text-muted block">Phone Number</label>
                            <input 
                              type="tel" 
                              value={profileForm.phone}
                              onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                              className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-2xs text-muted block">Date of Birth</label>
                            <input 
                              type="date" 
                              value={profileForm.dob}
                              onChange={e => setProfileForm(p => ({ ...p, dob: e.target.value }))}
                              className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-2xs text-muted block">Gender</label>
                            <select 
                              value={profileForm.gender}
                              onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value as 'male' | 'female' }))}
                              className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="female">Female</option>
                              <option value="male">Male</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-2xs text-muted block">Address</label>
                            <input 
                              type="text" 
                              value={profileForm.address}
                              onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))}
                              className="w-full bg-cream border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20"
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
                            className="bg-primary text-obsidian px-8 py-3 rounded-full text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            {isSavingProfile ? (
                              <>
                                <div className="w-4 h-4 border-2 border-obsidian/20 border-t-clinical-dark rounded-full animate-spin" />
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
                            <span className="text-2xs text-muted block mb-2">Full Name</span>
                            <p className="text-sm font-medium text-obsidian">{user?.fullName}</p>
                          </div>
                          <div>
                            <span className="text-2xs text-muted block mb-2">Email Address</span>
                            <p className="text-sm font-medium text-obsidian">{user?.email}</p>
                          </div>
                          <div>
                            <span className="text-2xs text-muted block mb-2">Phone Number</span>
                            <p className="text-sm font-medium text-obsidian">{currentClient?.phone || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="space-y-6">
                          <div>
                            <span className="text-2xs text-muted block mb-2">Date of Birth</span>
                            <p className="text-sm font-medium text-obsidian">{formatDOB(currentClient?.dob)}{calculateAge(currentClient?.dob)}</p>
                          </div>
                          <div>
                            <span className="text-2xs text-muted block mb-2">Gender</span>
                            <p className="text-sm font-medium text-obsidian capitalize">{currentClient?.gender || 'Not provided'}</p>
                          </div>
                          <div>
                            <span className="text-2xs text-muted block mb-2">Address</span>
                            <p className="text-sm font-medium text-obsidian">{currentClient?.address || 'Not provided'}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {!isEditingProfile && (
                    <div className="mt-12 pt-12 border-t border-black/5">
                      <button 
                        onClick={handleEditProfileClick}
                        className="bg-obsidian text-white px-8 py-3 rounded-full text-xs font-medium shadow-xl shadow-black/10 transition-all"
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
        return <div className="p-20 text-center font-medium text-muted/40">Section Under Development</div>;
    }
  };

  const handleAcceptPolicies = () => {
    onAcceptPolicies();
    setShowPolicyModal(false);
  };

  return (
    <div className="portal-shell font-sans selection:bg-primary/20">
      <PolicyConfirmationModal
        isOpen={showPolicyModal}
        onConfirm={handleAcceptPolicies}
        onNavigate={onNavigate}
      />
      {/* Sidebar */}
      <aside className={`portal-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="cursor-pointer" onClick={() => onNavigate(Page.Home)}>
            <Logo size="sm" className="!justify-start scale-75 -ml-3" />
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden w-10 h-10 inline-flex items-center justify-center text-muted hover:text-obsidian rounded-md">
            <X size={18} />
          </button>
        </div>

        <p className="nav-section-label">My care</p>
        <nav className="flex flex-col gap-0.5">
          <SidebarItem id="overview"     label="Overview"     icon="overview"     activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="treatments"   label="Treatments"   icon="treatments"   activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="appointments" label="Appointments" icon="appointments" activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="assessments"  label="Assessments"  icon="assessments"  activeTab={activeTab} onClick={handleSidebarClick} />
          <SidebarItem id="messages"     label="Messages"     icon="messages"     activeTab={activeTab} onClick={handleSidebarClick} badge={unreadMessagesCount} />
          <SidebarItem id="profile"      label="Profile"      icon="profile"      activeTab={activeTab} onClick={handleSidebarClick} />
        </nav>

        <div className="mt-auto pt-3 border-t border-sand">
          <div className="flex items-center gap-2.5 p-2 rounded-md">
            <div className="avatar avatar-sm">{firstName[0]}</div>
            <div className="flex flex-col min-w-0 flex-grow">
              <span className="text-sm font-medium text-obsidian truncate">{user?.fullName}</span>
              <span className="text-xs text-muted truncate">Client portal</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="portal-main">
        <header className="portal-topbar">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-10 h-10 inline-flex items-center justify-center text-muted hover:text-obsidian rounded-md -ml-2">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted hidden sm:inline">Portal</span>
            <span className="text-hint hidden sm:inline">/</span>
            <span className="text-obsidian font-medium capitalize">{activeTab}</span>
          </div>

          <div className="hidden md:flex items-center gap-3 ml-6 max-w-xs">
            <span className="text-xs text-muted whitespace-nowrap">Treatment journey</span>
            <div className="progress-track w-32"><div className="progress-fill gold" style={{ width: `${progress}%` }} /></div>
            <span className="text-xs text-muted">{progress}%</span>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`btn-icon relative ${showNotifications ? 'bg-cream text-obsidian' : ''}`}
                aria-label="Notifications"
              >
                <Bell size={15} />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-danger rounded-full text-2xs font-medium text-white flex items-center justify-center">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 mt-2 w-auto sm:w-[320px] md:w-[380px] max-w-[calc(100vw-1.5rem)] bg-white rounded-lg shadow-modal border border-sand z-50 overflow-hidden animate-fade-up sm:origin-top-right">
                    <div className="px-4 py-3 border-b border-sand">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium text-obsidian">Notifications</h3>
                        <button
                          onClick={async () => {
                            try {
                              await Promise.all(
                                notifications
                                  .filter(n => !n.read)
                                  .map(n => onMarkNotificationRead(n.id))
                              );
                            } catch (err) {
                              console.error('Failed to mark notifications read:', err);
                            }
                          }}
                          className="text-xs text-muted hover:text-obsidian transition-colors"
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(['all', 'message', 'appointment', 'feedback'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setNotifFilter(f)}
                            className={`px-2.5 py-1.5 rounded-sm text-xs transition-colors ${notifFilter === f ? 'bg-obsidian text-white' : 'text-muted hover:bg-cream'}`}
                          >
                            {f === 'all' ? 'All' : f === 'message' ? 'Messages' : f === 'appointment' ? 'Appointments' : 'Feedback'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="max-h-[380px] overflow-y-auto">
                      {filteredNotifications.length > 0 ? (
                        filteredNotifications.map((n) => {
                          const iconFor = (t: string) => {
                            if (t.includes('message')) return <MessageSquare size={14} />;
                            if (t.includes('appointment')) return <CalendarCheck size={14} />;
                            if (t.includes('feedback')) return <Star size={14} />;
                            if (t.includes('form_sent')) return <FileText size={14} />;
                            if (t.includes('payment')) return <CreditCard size={14} />;
                            if (t.includes('welcome')) return <BadgeCheck size={14} />;
                            return <Bell size={14} />;
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
                              className={`px-4 py-3 border-b border-cream flex gap-3 hover:bg-cream/50 transition-colors cursor-pointer relative ${!n.read ? 'bg-primary/5' : ''}`}
                            >
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
                        })
                      ) : (
                        <EmptyState icon={<BellOff size={16} />} title="No notifications" compact />
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
        <div className="portal-content mx-auto pb-20 lg:pb-4" data-scroll key={activeTab}>
          {/* Per-section CSS fade-in is more reliable than AnimatePresence here
              (which can leave opacity stuck at 0 on rapid tab changes). */}
          {renderSection()}
        </div>
      </main>

      {/* Mobile bottom tab bar — replaces hamburger nav on small screens */}
      <BottomNav
        active={activeTab}
        onChange={(id) => handleSidebarClick(id as Tab)}
        items={[
          { id: 'overview',     label: 'Home',         icon: <LayoutDashboard size={18} /> },
          { id: 'appointments', label: 'Appointments', icon: <CalendarIcon size={18} /> },
          { id: 'messages',     label: 'Messages',     icon: <MessageSquare size={18} />, badge: unreadMessagesCount },
          { id: 'profile',      label: 'Profile',      icon: <UserIcon size={18} /> },
        ]}
      />
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

      <Modal
        open={currentClient?.status === 'Assessment Submitted' && !hasSeenAssessmentAlert}
        onClose={() => setHasSeenAssessmentAlert(true)}
        title="Assessment received"
        size="sm"
      >
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="w-10 h-10 rounded-md bg-cream flex items-center justify-center text-primary">
            <Info size={18} />
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Your assessment will be reviewed within 24 hours. Our clinical team will be in touch by phone.
          </p>
          <Button variant="primary" fullWidth onClick={() => setHasSeenAssessmentAlert(true)}>
            Got it
          </Button>
        </div>
      </Modal>

      {currentClient && (
        <Modal
          open={showGalleryUpload}
          onClose={() => !isUploading && setShowGalleryUpload(false)}
          title="Add progress photo"
          subtitle="Upload to your gallery"
          size="md"
          closeOnBackdrop={!isUploading}
        >
          <div className="flex flex-col gap-4">
            <div className="aspect-video bg-cream rounded-md border border-dashed border-sand overflow-hidden relative flex items-center justify-center">
              {galleryUploadPreview ? (
                <>
                  <img src={galleryUploadPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => { setGalleryUploadFile(null); setGalleryUploadPreview(null); }}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-obsidian/70 text-white flex items-center justify-center hover:bg-obsidian transition-colors"
                  >
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
              placeholder="e.g. Month 3 progress"
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
                onClick={() => handleGalleryUpload(currentClient.id, currentClient.gallery)}
                disabled={isUploading || !galleryUploadFile}
                leadingIcon={<Upload size={14} />}
              >
                Save to gallery
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {lightboxImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-obsidian/95 animate-fade-in" onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage.url} alt={lightboxImage.label} className="max-w-full max-h-[90dvh] object-contain rounded-md" />
          <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 w-11 h-11 bg-white/10 rounded-md flex items-center justify-center text-white hover:bg-white/20 transition-all">
            <X size={18} />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 max-w-[calc(100vw-3rem)] bg-white/10 text-white px-3 py-1.5 rounded-md text-xs text-center">
            {lightboxImage.label} · {new Date(lightboxImage.uploadedAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ClientDashboard);

// ─── Timeline sub-components ──────────────────────────────────────────────────
// Used in the assessment "pending review" card to show patient progress.

type TimelineState = 'complete' | 'active' | 'pending';

const TimelineStep: React.FC<{ label: string; state: TimelineState }> = ({ label, state }) => {
  const dotClass =
    state === 'complete' ? 'bg-primary text-white border-primary' :
    state === 'active'   ? 'bg-white text-primary border-primary animate-pulse' :
                           'bg-cream text-hint border-sand';
  const labelClass =
    state === 'pending' ? 'text-hint' :
    state === 'active'  ? 'text-obsidian font-medium' :
                          'text-muted';
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-medium shrink-0 ${dotClass}`}>
        {state === 'complete' ? '✓' : state === 'active' ? '●' : '○'}
      </div>
      <span className={`text-[10px] uppercase tracking-wider text-center ${labelClass}`}>{label}</span>
    </div>
  );
};

const TimelineConnector: React.FC<{ state: TimelineState }> = ({ state }) => (
  <div className={`flex-grow h-[2px] rounded-full ${
    state === 'complete' ? 'bg-primary' : 'bg-sand'
  }`} />
);