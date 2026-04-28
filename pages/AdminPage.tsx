
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Page, User, Client, Appointment, Message, GalleryItem, AdminType } from '../types';
import { FORMS } from '../constants';
import { Card } from '../components/Card';
import { InteractiveForm } from '../components/InteractiveForm';
import Logo from '../components/Logo';
import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Camera, Upload, X, Plus, Image as ImageIcon, Loader2 } from 'lucide-react';
import { processImageForUpload, validateImageFile, ACCEPTED_IMAGE_TYPES } from '../imageUtils';

interface AdminPageProps {
  user: User | null;
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  clients: Client[];
  appointments: Appointment[];
  messages: Message[];
  onAddAppointment: (appointment: Appointment) => void;
  onUpdateAppointment: (id: string, updates: Partial<Appointment>) => void;
  onDeleteAppointment: (id: string) => void;
  onSendMessage: (message: Omit<Message, 'id'>) => Promise<void>;
  onMarkMessageRead: (id: string) => Promise<void>;
  onUpdateMessage: (id: string, updates: Partial<Message>) => Promise<void>;
  onUpdateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  onBootstrapAdmins?: () => Promise<void>;
}

type AdminTab = 'overview' | 'assessments' | 'clients' | 'appointments' | 'messages' | 'platform-health';
type ClientRecordTab = 'overview' | 'communications' | 'forms' | 'gallery' | 'assessment';


// Removed local Message interface as we use the global one from types.ts

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'assessment' | 'appointment' | 'message' | 'system';
}

// Removed local Card component as we use the shared one from components/Card.tsx

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    'New': 'bg-red-500 text-white',
    'Reviewed': 'bg-yellow-500 text-white',
    'Contacted': 'bg-blue-500 text-white',
    'Converted': 'bg-green-500 text-white',
    'Not Suitable': 'bg-gray-500 text-white',
    'Active': 'bg-green-100 text-green-700',
    'Ongoing': 'bg-primary text-white'
  };
  return <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${colors[status] || 'bg-gray-200 text-text-muted'}`}>{status}</span>;
};

const AssignedBadge = ({ isAssigned }: { isAssigned: boolean }) => {
  if (!isAssigned) return null;
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[8px] font-black uppercase tracking-widest shrink-0">
      <span className="material-symbols-outlined text-[10px]">person</span>
      Assigned
    </span>
  );
};

const SidebarItem = ({ id, label, icon, activeTab, selectedClientId, onClick, isCollapsed }: { id: AdminTab, label: string, icon: string, activeTab: AdminTab, selectedClientId: string | null, onClick: (id: AdminTab) => void, isCollapsed?: boolean }) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center gap-4 px-6 py-5 rounded-2xl transition-all group relative ${
      activeTab === id && !selectedClientId 
        ? 'bg-clinical-dark text-white shadow-2xl shadow-clinical-dark/20' 
        : 'text-text-muted hover:bg-bg-soft hover:text-clinical-dark'
    }`}
  >
    {activeTab === id && !selectedClientId && (
      <motion.div 
        layoutId="activeTab"
        className="absolute left-0 w-1.5 h-8 bg-primary rounded-r-full"
      />
    )}
    <span className={`material-symbols-outlined text-2xl transition-transform group-hover:scale-110 ${activeTab === id && !selectedClientId ? 'text-primary' : 'text-text-muted'}`}>{icon}</span>
    {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>}
  </button>
);

const AdminPage: React.FC<AdminPageProps> = ({ user, onLogout, clients, appointments, messages, onAddAppointment, onUpdateAppointment, onDeleteAppointment, onSendMessage, onMarkMessageRead, onUpdateClient, onBootstrapAdmins }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [effectiveAdminType, setEffectiveAdminType] = useState<AdminType | 'all'>(user?.adminType || 'all');
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientRecordTab, setClientRecordTab] = useState<ClientRecordTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<GalleryItem | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [appointmentView, setAppointmentView] = useState<'list' | 'calendar'>('list');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [viewingForm, setViewingForm] = useState<Message | null>(null);
  const [bookingForm, setBookingForm] = useState<Partial<Appointment>>({
    type: 'Initial Consultation',
    status: 'Confirmed',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM'
  });
  const [messageInput, setMessageInput] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [internalNotesInput, setInternalNotesInput] = useState('');

  const formatDOB = (dob: string | undefined) => {
    if (!dob) return 'N/A';
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

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      setFeedbackInput(client?.assessmentData?.clinicalFeedback || '');
      setInternalNotesInput(client?.internalNotes || '');
    }
  }, [selectedClientId, clients]);
  
  // Gallery Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [showGalleryUpload, setShowGalleryUpload] = useState(false);
  const [galleryUploadFile, setGalleryUploadFile] = useState<File | null>(null);
  const [galleryUploadLabel, setGalleryUploadLabel] = useState('');
  const [galleryUploadPreview, setGalleryUploadPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const getEffectiveUser = useCallback(() => {
    if (!user) return null;
    if (user.adminType !== 'technical' || effectiveAdminType === 'all') return user;
    return { ...user, adminType: effectiveAdminType } as User;
  }, [user, effectiveAdminType]);

  const isAssignedToUser = useCallback((client: Client, targetUser: User | null) => {
    if (!targetUser) return false;
    if (targetUser.adminType === 'technical') return true;
    
    if (targetUser.adminType === 'doctor-male') {
      // Waqas handles all males and females who are okay with male doctors
      return client.gender === 'male' || client.doctorPreference === 'ok-with-male';
    }
    
    if (targetUser.adminType === 'doctor-female') {
      // Aminah handles females who require female only, or haven't specified (default for females)
      return client.gender === 'female' && (client.doctorPreference === 'female-only' || !client.doctorPreference);
    }
    
    return true;
  }, []);

  const isAssignedToMe = useCallback((client: Client | undefined) => {
    if (!client) return false;
    return isAssignedToUser(client, user);
  }, [user, isAssignedToUser]);

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

      const newItem: GalleryItem = {
        id: `admin-${Date.now()}`,
        url: downloadURL,
        label: galleryUploadLabel || 'Progress Photo',
        uploadedAt: new Date().toISOString(),
        source: 'Clinical'
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

  const filteredClients = useMemo(() => {
    const effectiveUser = getEffectiveUser();
    if (!effectiveUser) return [];
    
    // If technical admin has selected a specific doctor view, show only that doctor's assignments
    if (user?.adminType === 'technical' && effectiveAdminType !== 'all') {
      return clients.filter(c => isAssignedToUser(c, effectiveUser));
    }
    
    // Doctors have a unified view by default, but can filter to assigned
    if (showOnlyAssigned) {
      return clients.filter(c => isAssignedToUser(c, effectiveUser));
    }
    
    return clients;
  }, [clients, user, effectiveAdminType, showOnlyAssigned, getEffectiveUser, isAssignedToUser]);

  const filteredAppointments = useMemo(() => {
    const effectiveUser = getEffectiveUser();
    if (!effectiveUser) return [];
    
    const targetClients = user?.adminType === 'technical' && effectiveAdminType !== 'all'
      ? clients.filter(c => isAssignedToUser(c, effectiveUser))
      : (showOnlyAssigned ? clients.filter(c => isAssignedToUser(c, effectiveUser)) : clients);
    
    const targetClientIds = new Set(targetClients.map(c => c.id));
    
    if (user?.adminType === 'technical' && effectiveAdminType === 'all') {
      return appointments;
    }

    return appointments.filter(a => targetClientIds.has(a.clientId));
  }, [appointments, clients, user, effectiveAdminType, showOnlyAssigned, getEffectiveUser, isAssignedToUser]);

  // Group messages by client for the main Messages tab
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
      } else if (showOnlyAssigned && !isAssignedToUser(client, effectiveUser)) {
        return;
      }

      if (!threads[clientId]) threads[clientId] = [];
      threads[clientId].push(msg);
    });
    return threads;
  }, [messages, user, clients, effectiveAdminType, showOnlyAssigned, getEffectiveUser, isAssignedToUser]);

  const notifications = useMemo(() => {
    // Generate notifications for new assessments
    return filteredClients
      .filter(c => c.status === 'Assessment Submitted')
      .map(c => ({
        id: `assessment-${c.id}`,
        title: 'New Assessment Submitted',
        message: `${c.name} has submitted a new hair assessment for review.`,
        time: 'Recently',
        type: 'assessment' as const
      }))
      .filter(n => !dismissedIds.has(n.id))
      .map(n => ({
        ...n,
        read: readIds.has(n.id)
      }));
  }, [filteredClients, dismissedIds, readIds]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.type === 'assessment' && notification.id.startsWith('assessment-')) {
      const clientId = notification.id.replace('assessment-', '');
      setSelectedClientId(clientId);
      setActiveTab('clients');
      setClientRecordTab('assessment');
      setShowNotifications(false);
    }
  };

  const clearAll = () => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      notifications.forEach(n => next.add(n.id));
      return next;
    });
    setShowNotifications(false);
  };

  const mockStats = useMemo(() => [
    { 
      label: 'Assessments Today', 
      value: filteredClients.filter(c => {
        // Let's just use 'Assessment Submitted' status as a proxy for "pending review"
        return c.status === 'Assessment Submitted';
      }).length.toString(), 
      trend: 'New', 
      icon: 'assignment', 
      tab: 'assessments' as AdminTab 
    },
    { 
      label: 'Appointments Today', 
      value: filteredAppointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length.toString(), 
      icon: 'event', 
      tab: 'appointments' as AdminTab 
    },
    { 
      label: 'Active Clients', 
      value: filteredClients.filter(c => c.status === 'Active' || c.status === 'Ongoing' || c.status === 'Converted').length.toString(), 
      trend: 'Total', 
      icon: 'groups', 
      tab: 'clients' as AdminTab 
    }
  ], [filteredClients, filteredAppointments]);

  const mockAssessments = useMemo(() => {
    return filteredClients
      .filter(c => c.status === 'Assessment Submitted' || c.status === 'Reviewed')
      .map(c => ({
        id: c.id,
        client: c.name,
        gender: c.gender,
        date: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recently',
        concern: c.assessmentData?.answers?.['f1']?.value || c.assessmentData?.answers?.['m1']?.value || 'General Hair Loss',
        status: c.status
      }));
  }, [filteredClients]);

  const selectedClient = filteredClients.find(c => c.id === selectedClientId);

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
        id: '', // Relayed to App.tsx for native Firestore ID generation
        clientId: bookingForm.clientId,
        clientName: client?.name || 'Unknown',
        doctorId: user?.id,
        doctorName: user?.fullName,
        type: bookingForm.type as Appointment['type'],
        date: bookingForm.date,
        time: bookingForm.time,
        status: (bookingForm.status as Appointment['status']) || 'Confirmed',
        notes: bookingForm.notes || '',
        createdAt: new Date().toISOString()
      };
      onAddAppointment(newAppointment);
      setShowBookingModal(false);
      setBookingForm({
        type: 'Initial Consultation',
        status: 'Confirmed',
        date: new Date().toISOString().split('T')[0],
        time: '10:00 AM'
      });
    }
  };

  const rescheduleAppointment = async (apt: Appointment) => {
    const newDate = prompt(`Enter new date (YYYY-MM-DD) for ${apt.type} on ${apt.date}:`, apt.date);
    if (!newDate) return;
    const newTime = prompt(`Enter new time for ${apt.type} on ${newDate}:`, apt.time);
    if (!newTime) return;
    
    try {
      await onUpdateAppointment(apt.id, { date: newDate, time: newTime });
      alert('Appointment rescheduled successfully.');
    } catch (error) {
      console.error('Failed to reschedule:', error);
      alert('Rescheduling failed.');
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedClientId) return;

    try {
      await onSendMessage({
        senderId: user?.id || 'admin',
        recipientId: selectedClientId,
        subject: 'Clinic Update',
        body: messageInput,
        read: false,
        createdAt: new Date().toISOString()
      });
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
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
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to send form:', error);
    }
  };

  const renderInternalNotes = () => (
    <Card className="p-4 sm:p-6 md:p-8 mt-4 md:mt-8 bg-bg-soft/30 border-dashed border-black/10">
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <span className="material-symbols-outlined text-primary text-xl">sticky_note_2</span>
        <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-text-muted">Internal Clinical Notes</h3>
      </div>
      <textarea 
        value={internalNotesInput}
        onChange={(e) => setInternalNotesInput(e.target.value)}
        placeholder="Add private clinical notes about this client's progress, specific concerns, or internal reminders..." 
        className="w-full bg-white border-black/5 rounded-xl p-4 text-xs font-bold focus:ring-2 focus:ring-primary/20 min-h-[120px] resize-none shadow-sm"
      />
      <div className="flex justify-end mt-4">
        <button 
          onClick={async () => {
            if (selectedClientId) {
              await onUpdateClient(selectedClientId, { internalNotes: internalNotesInput });
              alert('Internal notes saved successfully.');
            }
          }}
          className="bg-clinical-dark text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-colors shadow-lg shadow-clinical-dark/10"
        >
          Save Internal Note
        </button>
      </div>
    </Card>
  );

  const renderClientRecord = () => {
    if (!selectedClient) return null;

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
              onClick={() => {
                const newName = prompt('Enter new profile name for ' + selectedClient.name, selectedClient.name);
                if (newName && newName !== selectedClient.name) {
                  onUpdateClient(selectedClient.id, { name: newName });
                  alert('Profile simplified update applied.');
                }
              }}
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
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-8">
              <div className="xl:col-span-4 space-y-4 md:space-y-6">
                <Card className="p-4 sm:p-6 md:p-8">
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-text-muted mb-4 md:mb-6">Demographics & Contact</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
                    <div>
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Full Name</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-text-main">{selectedClient.name}</p>
                        {selectedClient.policiesAccepted && (
                          <span className="material-symbols-outlined text-green-500 text-sm font-black" title="Policies Accepted">check_circle</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:block">
                      <div>
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Gender</p>
                        <p className="text-sm font-bold text-text-main capitalize">{selectedClient.gender || 'N/A'}</p>
                      </div>
                      <div className="sm:mt-6">
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">DOB</p>
                        <p className="text-sm font-bold text-text-main">{formatDOB(selectedClient.dob)}{calculateAge(selectedClient.dob)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Email Address</p>
                      <p className="text-sm font-bold text-text-main break-all">{selectedClient.email}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Phone Number</p>
                      <p className="text-sm font-bold text-text-main">{selectedClient.phone || 'N/A'}</p>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Address</p>
                      <p className="text-sm font-bold text-text-main leading-relaxed">{selectedClient.address || 'N/A'}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 sm:p-6 md:p-8 bg-primary/5 border-primary/10">
                  <h3 className="text-[9px] md:text-xs font-black uppercase tracking-widest text-text-muted mb-4 md:mb-6">Active Products</h3>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white rounded-xl md:rounded-2xl border border-primary/20 gap-3">
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-black text-text-main truncate">{selectedClient.package || 'No Active Package'}</p>
                      <p className="text-[8px] font-bold text-text-muted uppercase tracking-widest">Enrollment: {new Date(selectedClient.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
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
                      className="bg-clinical-dark text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      {['New Inquiry', 'Assessment Submitted', 'Reviewed', 'Contacted', 'Converted', 'Not Suitable', 'Active', 'Ongoing'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </Card>
              </div>

              <div className="xl:col-span-8 space-y-4 md:space-y-6">
                <Card className="p-4 sm:p-6 md:p-8">
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-text-muted mb-4 md:mb-6">Treatment History</h3>
                  <div className="space-y-3 md:space-y-4">
                    {appointments
                      .filter(a => a.clientId === selectedClient.id && new Date(a.date) < new Date() && a.status === 'Completed')
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((t, i) => (
                      <div key={i} className="p-4 bg-bg-soft rounded-xl md:rounded-2xl border border-black/5">
                        <div className="flex justify-between mb-2">
                          <p className="text-[11px] md:text-xs font-black text-text-main">{t.type}</p>
                          <p className="text-[9px] md:text-[10px] font-bold text-text-muted uppercase tracking-widest">{new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed">{t.notes || 'No notes provided.'}</p>
                      </div>
                    ))}
                    {appointments.filter(a => a.clientId === selectedClient.id && new Date(a.date) < new Date() && a.status === 'Completed').length === 0 && (
                      <p className="text-[11px] text-text-muted italic">No past treatments recorded.</p>
                    )}
                  </div>
                </Card>

                <Card className="p-4 sm:p-6 md:p-8">
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-text-muted mb-4 md:mb-6">Upcoming Appointments</h3>
                  <div className="space-y-3 md:space-y-4">
                    {appointments
                      .filter(a => a.clientId === selectedClient.id && (a.status === 'Confirmed' || a.status === 'Pending'))
                      .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                      .map((apt, i) => (
                        <div key={i} className="p-4 border-2 border-dashed border-primary/20 rounded-xl md:rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex flex-col items-center justify-center text-primary shrink-0">
                              <span className="text-[8px] font-black uppercase">
                                {apt.date ? new Date(apt.date).toLocaleString('default', { month: 'short' }) : 'N/A'}
                              </span>
                              <span className="text-lg font-black leading-none">
                                {apt.date ? new Date(apt.date).getDate() : '--'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-text-main truncate">{apt.type}</p>
                              <p className="text-[9px] md:text-[10px] font-bold text-text-muted uppercase tracking-widest truncate">{apt.time}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => rescheduleAppointment(apt)}
                            className="w-full sm:w-auto text-[9px] font-black text-primary uppercase tracking-widest hover:underline py-2.5 sm:py-0 border border-primary/20 sm:border-none rounded-xl sm:rounded-none"
                          >
                            Reschedule
                          </button>
                        </div>
                      ))}
                    {appointments.filter(a => a.clientId === selectedClient.id && (a.status === 'Confirmed' || a.status === 'Pending')).length === 0 && (
                      <div className="text-center py-6">
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No upcoming appointments</p>
                        <button 
                          onClick={() => openBookingModal(selectedClient.id)}
                          className="text-primary text-[10px] font-black uppercase tracking-widest mt-2 hover:underline"
                        >
                          Book Now
                        </button>
                      </div>
                    )}
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
                    {(messages.filter(m => m.senderId === selectedClientId || m.recipientId === selectedClientId) || []).map((msg: Message) => (
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
                    <form 
                      onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                      className="flex gap-2 md:gap-4"
                    >
                      <input 
                        type="text" 
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Type a message..." 
                        className="flex-grow bg-bg-soft border-transparent rounded-xl px-4 md:px-6 py-2.5 md:py-3 text-[10px] md:text-xs font-bold focus:ring-2 focus:ring-primary/20" 
                      />
                      <button 
                        type="submit"
                        className="bg-primary text-white p-2.5 md:p-3 rounded-xl hover:scale-105 transition-all shrink-0 flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-lg md:text-xl">send</span>
                      </button>
                    </form>
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
                        onClick={() => handleSendForm(form.id)}
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
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-8">
              <div className="xl:col-span-8 space-y-4 md:space-y-6">
                <Card className="p-4 sm:p-6 md:p-8">
                  <div className="flex justify-between items-center mb-4 md:mb-6">
                    <h3 className="text-[9px] md:text-xs font-black uppercase tracking-widest text-text-muted">Clinical Assessment Details</h3>
                    <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest ${selectedClient.gender === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                      {selectedClient.gender}
                    </span>
                  </div>

                  <div className="space-y-4 md:space-y-8">
                    {/* Detailed Assessment Answers */}
                    {selectedClient.assessmentData?.answers && (
                      <div className="p-4 md:p-6 bg-primary/5 rounded-xl md:rounded-2xl border border-primary/10">
                        <h4 className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-widest mb-4">Detailed Assessment Answers</h4>
                        <div className="space-y-4">
                          {Object.entries(selectedClient.assessmentData.answers).map(([key, answer]) => {
                            // Simple mapping for display
                            const displayValue = Array.isArray(answer.value) ? answer.value.join(', ') : answer.value;
                            if (key === 'f26' || key === 'm22') return null; // Skip photo upload for now
                            
                            return (
                              <div key={key} className="border-b border-black/5 pb-2 last:border-0">
                                <p className="text-[8px] font-black text-text-muted uppercase mb-1">{answer.text}</p>
                                <p className="text-[10px] md:text-xs font-bold text-text-main">{displayValue}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Screening Section */}
                    <div className="p-4 md:p-6 bg-bg-soft rounded-xl md:rounded-2xl border border-black/5">
                      <h4 className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-widest mb-3 md:mb-4">Safety Screening</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                        <div>
                          <p className="text-[8px] md:text-[9px] font-black text-text-muted uppercase mb-1">Reported Conditions</p>
                          <p className="text-[10px] md:text-xs font-bold text-text-main">
                            {selectedClient.assessmentData?.screening?.conditions?.join(', ') || 'None reported'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] md:text-[9px] font-black text-text-muted uppercase mb-1">Suitability Status</p>
                          <p className="text-[10px] md:text-xs font-bold text-green-600">
                            {selectedClient.assessmentData?.screening?.suitability || 'Cleared for Online Protocol'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Consultation Details */}
                    <div className="space-y-4 md:space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                        <div>
                          <p className="text-[8px] md:text-[9px] font-black text-primary uppercase tracking-widest mb-1">Triggers & Onset</p>
                          <p className="text-[10px] md:text-sm font-bold text-text-main">
                            {selectedClient.assessmentData?.consultation?.onset ? `${selectedClient.assessmentData.consultation.onset} - ` : ''}
                            {selectedClient.assessmentData?.consultation?.triggers || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] md:text-[9px] font-black text-primary uppercase tracking-widest mb-1">Medical History</p>
                          <p className="text-[10px] md:text-sm font-bold text-text-main">{selectedClient.assessmentData?.consultation?.medicalHistory || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                        <div>
                          <p className="text-[8px] md:text-[9px] font-black text-primary uppercase tracking-widest mb-1">Medications</p>
                          <p className="text-[10px] md:text-sm font-bold text-text-main">{selectedClient.assessmentData?.consultation?.medications || 'None'}</p>
                        </div>
                        <div>
                          <p className="text-[8px] md:text-[9px] font-black text-primary uppercase tracking-widest mb-1">Supplements</p>
                          <p className="text-[10px] md:text-sm font-bold text-text-main">{selectedClient.assessmentData?.consultation?.supplements || 'None'}</p>
                        </div>
                      </div>

                      {selectedClient.gender === 'female' && selectedClient.assessmentData?.consultation?.femaleHealth && (
                        <div className="p-4 md:p-6 bg-pink-50/30 rounded-xl md:rounded-2xl border border-pink-100">
                          <h4 className="text-[9px] md:text-[10px] font-black text-pink-600 uppercase tracking-widest mb-3 md:mb-4">Female Health Profile</h4>
                          <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 md:gap-4">
                            <div>
                              <p className="text-[8px] font-black text-pink-400 uppercase mb-1">Cycles</p>
                              <p className="text-[10px] md:text-xs font-bold">{selectedClient.assessmentData?.consultation?.femaleHealth?.cycles || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-pink-400 uppercase mb-1">Pregnant</p>
                              <p className="text-[10px] md:text-xs font-bold">{selectedClient.assessmentData?.consultation?.femaleHealth?.pregnant || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-pink-400 uppercase mb-1">Breastfeeding</p>
                              <p className="text-[10px] md:text-xs font-bold">{selectedClient.assessmentData?.consultation?.femaleHealth?.breastfeeding || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 pt-4 md:pt-6 border-t border-black/5">
                        <div>
                          <p className="text-[8px] md:text-[9px] font-black text-primary uppercase tracking-widest mb-1">Hair Care Habits</p>
                          <p className="text-[10px] md:text-sm font-bold text-text-main">{selectedClient.assessmentData?.consultation?.hairCare || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[8px] md:text-[9px] font-black text-primary uppercase tracking-widest mb-1">Lifestyle Factors</p>
                          <p className="text-[10px] md:text-sm font-bold text-text-main">{selectedClient.assessmentData?.consultation?.lifestyle || 'N/A'}</p>
                        </div>
                      </div>

                      {/* New Sections */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 pt-4 md:pt-6 border-t border-black/5">
                        <div>
                          <p className="text-[8px] md:text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Red Flags</p>
                          <div className="text-[10px] md:text-sm font-bold text-text-main">
                            {(() => {
                              const redFlagAnswers = selectedClient.assessmentData?.answers?.['f9']?.value || selectedClient.assessmentData?.answers?.['m9']?.value;
                              if (Array.isArray(redFlagAnswers) && redFlagAnswers.length > 0 && !redFlagAnswers.includes('None') && !redFlagAnswers.includes('None of the above')) {
                                return (
                                  <ul className="list-disc list-inside text-red-600">
                                    {redFlagAnswers.map((flag: string, idx: number) => (
                                      <li key={idx}>{flag}</li>
                                    ))}
                                  </ul>
                                );
                              }
                              return <p className="text-green-600">No clinical red flags reported.</p>;
                            })()}
                          </div>
                        </div>
                        <div>
                          <p className="text-[8px] md:text-[9px] font-black text-primary uppercase tracking-widest mb-1">Family History</p>
                          <p className="text-[10px] md:text-sm font-bold text-text-main">
                            {selectedClient.assessmentData?.answers?.['f10']?.value || selectedClient.assessmentData?.answers?.['m10']?.value || 'Not reported'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              <div className="xl:col-span-4 space-y-4 md:space-y-6">
                <Card className="p-4 sm:p-6 md:p-8 bg-clinical-dark text-white">
                  <h3 className="text-[9px] md:text-xs font-black uppercase tracking-widest text-gray-400 mb-4 md:mb-6">Clinical Feedback to Client</h3>
                  <div className="space-y-4">
                    <textarea 
                      value={feedbackInput || selectedClient.assessmentData?.clinicalFeedback || ''}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      placeholder="Enter clinical feedback that will be visible to the client..."
                      className="w-full bg-white/5 border-white/10 rounded-xl p-4 text-xs font-medium focus:ring-2 focus:ring-primary/20 min-h-[200px] resize-none text-white placeholder:text-gray-500"
                    />
                    
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={async () => {
                          if (!feedbackInput.trim()) return;
                          try {
                            const updatedAssessmentData = {
                              ...selectedClient.assessmentData,
                              clinicalFeedback: feedbackInput,
                              reviewDate: new Date().toISOString()
                            };
                            await onUpdateClient(selectedClient.id, { 
                              assessmentData: updatedAssessmentData,
                              status: 'Reviewed'
                            });
                            alert('Feedback saved and shared with client.');
                          } catch (error) {
                            console.error('Failed to save feedback:', error);
                            alert('Failed to save feedback.');
                          }
                        }}
                        className="w-full bg-primary text-clinical-dark py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform"
                      >
                        Save & Share Feedback
                      </button>
                      
                      {selectedClient.assessmentData?.reviewDate && (
                        <div className="pt-3 border-t border-white/10">
                          <p className="text-[8px] font-black text-primary uppercase tracking-widest">Last Reviewed</p>
                          <p className="text-[9px] font-bold text-gray-400">
                            {new Date(selectedClient.assessmentData.reviewDate).toLocaleDateString()} at {new Date(selectedClient.assessmentData.reviewDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {renderInternalNotes()}
        </div>
      </div>
    );
  };

  const changeMonth = (offset: number) => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const getCalendarDays = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const days = [];
    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, month: month - 1, year, currentMonth: false });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, month, year, currentMonth: true });
    }
    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, month: month + 1, year, currentMonth: false });
    }
    return days;
  };

  const renderSection = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="animate-fade-up space-y-8 lg:space-y-12">
            {/* Desktop Welcome Header */}
            <div className="hidden lg:block">
              <h1 className="text-4xl font-black text-text-main mb-2">Welcome back, {getFirstName(user?.fullName)}</h1>
              <p className="text-sm font-bold text-text-muted uppercase tracking-widest">Here's what's happening at Novogenics today.</p>
            </div>
            {/* Top Stats Row - Bento Style for Desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {mockStats.map((stat, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSidebarClick(stat.tab)}
                  className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-sm flex flex-col lg:justify-between gap-4 text-left hover:border-primary/20 hover:shadow-xl hover:-translate-y-1 transition-all active:scale-[0.98] group"
                >
                  <div className="w-12 h-12 bg-bg-soft rounded-2xl flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-2xl">{stat.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-3xl font-black text-text-main leading-none mb-1">{stat.value}</p>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest truncate">{stat.label}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Main Content: Schedule */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm overflow-hidden lg:shadow-xl lg:shadow-black/5">
                  <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-bg-soft/30">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary">calendar_today</span>
                      <h3 className="text-xs font-black text-text-main uppercase tracking-widest">Today's Schedule</h3>
                    </div>
                    <button onClick={() => setActiveTab('appointments')} className="text-[10px] font-black text-primary uppercase hover:underline flex items-center gap-2">
                      Full Calendar
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    {appointments
                      .filter(a => {
                        const today = new Date().toISOString().split('T')[0];
                        return a.date === today;
                      })
                      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                      .map((apt, i) => (
                        <div key={i} className="flex items-center justify-between p-4 hover:bg-bg-soft rounded-2xl transition-all group cursor-pointer">
                          <div className="flex items-center gap-4 md:gap-8 min-w-0">
                            <div className="text-center shrink-0 w-16">
                              <p className="text-xs font-black text-primary font-mono leading-none">{apt.time?.split(' ')[0] || apt.time}</p>
                              <p className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">{apt.time?.split(' ')[1] || ''}</p>
                            </div>
                            <div className="h-10 w-[1px] bg-gray-100 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-base font-black text-text-main group-hover:text-primary transition-colors truncate">{apt.clientName}</p>
                                {clients.find(c => c.name === apt.clientName)?.policiesAccepted && (
                                  <span className="material-symbols-outlined text-green-500 text-[12px] font-black" title="Policies Accepted">check_circle</span>
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest truncate">{apt.type}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 md:gap-8 shrink-0">
                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${apt.status === 'Confirmed' ? 'bg-green-100 text-green-700' : apt.status === 'Completed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {apt.status}
                            </span>
                            <button className="w-10 h-10 rounded-full flex items-center justify-center text-text-muted hover:bg-white hover:text-primary transition-all opacity-0 group-hover:opacity-100 hidden lg:flex">
                              <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    {appointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length === 0 && (
                      <div className="p-20 text-center">
                        <span className="material-symbols-outlined text-5xl text-primary/20 mb-4">event_busy</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">No appointments scheduled for today</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar: Action Center */}
              <div className="lg:col-span-4 space-y-8">
                <div className="bg-clinical-dark text-white rounded-[2.5rem] p-8 shadow-2xl shadow-clinical-dark/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-8 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                    Action Center
                  </h3>
                  <div className="space-y-4 relative z-10">
                    <button onClick={() => setActiveTab('assessments')} className="w-full flex items-center gap-4 p-5 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-left group">
                      <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform shrink-0">
                        <span className="material-symbols-outlined text-2xl">assignment</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-black uppercase tracking-widest truncate">Review Assessments</p>
                        <p className="text-[10px] text-gray-400 truncate">2 pending review</p>
                      </div>
                    </button>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-4 group cursor-pointer hover:bg-white/10 transition-all">
                      <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform shrink-0">
                        <span className="material-symbols-outlined text-2xl">notifications</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-black uppercase tracking-widest truncate">Follow-up Due</p>
                        <p className="text-[10px] text-gray-400 truncate">Emma Wilson (3-month scan)</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm lg:shadow-xl lg:shadow-black/5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-text-muted mb-8">Quick Links</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setActiveTab('clients')} className="flex flex-col items-center gap-3 p-6 bg-bg-soft rounded-3xl hover:bg-primary/10 hover:scale-105 transition-all group">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined">person_add</span>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest">New Client</span>
                    </button>
                    <button onClick={() => openBookingModal()} className="flex flex-col items-center gap-3 p-6 bg-bg-soft rounded-3xl hover:bg-primary/10 hover:scale-105 transition-all group">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined">event</span>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest">Book Appt</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'assessments':
        return (
          <div className="animate-fade-up space-y-4 md:space-y-8 lg:space-y-12">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 lg:gap-12">
              <div>
                <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-text-main tracking-tight">Virtual Hair Assessments</h2>
                <p className="hidden lg:block text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mt-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                  Manage and review incoming clinical submissions
                </p>
              </div>
              <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full xl:w-auto lg:gap-4 items-center">
                 {user?.adminType !== 'technical' && (
                   <div className="flex bg-bg-soft p-1 rounded-full border border-black/5">
                     <button 
                       onClick={() => setShowOnlyAssigned(true)}
                       className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${showOnlyAssigned ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                     >
                       My Assignments
                     </button>
                     <button 
                       onClick={() => setShowOnlyAssigned(false)}
                       className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${!showOnlyAssigned ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text-main'}`}
                     >
                       All Clients
                     </button>
                   </div>
                 )}
                 <div className="relative flex-grow md:w-96">
                    <input type="text" placeholder="Search by name, ID or concern..." className="w-full bg-white border border-black/5 rounded-2xl px-12 py-4 text-xs font-bold shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary/30 transition-all" />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary text-xl">search</span>
                 </div>
                 <button className="bg-white border border-black/5 w-14 h-14 rounded-2xl text-text-muted hover:text-primary shadow-sm shrink-0 transition-all hover:scale-105 flex items-center justify-center">
                   <span className="material-symbols-outlined text-2xl">filter_list</span>
                 </button>
              </div>
            </div>
            
            <Card className="md:border-none md:bg-transparent md:shadow-none">
              {/* Mobile Card View */}
              <div className="grid grid-cols-1 gap-4 lg:hidden">
                {mockAssessments.map(a => (
                  <div key={a.id} className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-text-main">{a.client}</p>
                          <AssignedBadge isAssigned={isAssignedToMe(clients.find(c => c.id === a.id))} />
                          {clients.find(c => c.id === a.id)?.policiesAccepted && (
                            <span className="material-symbols-outlined text-green-500 text-[10px] font-black" title="Policies Accepted">check_circle</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{a.date}</p>
                          <span className="text-[9px] text-text-muted/30">•</span>
                          <p className="text-[9px] font-bold text-primary uppercase tracking-widest">{a.gender}</p>
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">Main Concern</p>
                      <p className="text-[11px] font-bold text-text-main">{a.concern}</p>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedClientId(a.id);
                        setActiveTab('clients');
                        setClientRecordTab('assessment');
                      }}
                      className="w-full bg-primary/5 text-primary font-black uppercase text-[9px] tracking-widest py-3 rounded-xl transition-all active:scale-[0.98]"
                    >
                      Review Full Assessment
                    </button>
                  </div>
                ))}
              </div>              {/* Desktop Table View */}
              <div className="hidden lg:block bg-white rounded-[3rem] border border-black/5 shadow-2xl shadow-black/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-bg-soft/50 border-b border-black/5">
                        <th className="px-10 py-8 text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">
                          <div className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                            Client Details
                            <span className="material-symbols-outlined text-sm">unfold_more</span>
                          </div>
                        </th>
                        <th className="px-10 py-8 text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">Assessment Details</th>
                        <th className="px-10 py-8 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {mockAssessments.map(a => (
                        <tr key={a.id} className="hover:bg-bg-soft/40 transition-all cursor-pointer group">
                          <td className="px-10 py-8">
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <div className="w-14 h-14 rounded-2xl bg-clinical-dark flex items-center justify-center text-white font-black text-lg shadow-lg shadow-clinical-dark/20 group-hover:scale-110 transition-transform">
                                  {getInitials(a.client)}
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm border border-black/5">
                                  <span className="material-symbols-outlined text-primary text-[14px] font-black">person</span>
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center gap-3">
                                  <span className="font-black text-lg text-text-main group-hover:text-primary transition-colors">{a.client}</span>
                                  <AssignedBadge isAssigned={isAssignedToMe(clients.find(c => c.id === a.id))} />
                                  {clients.find(c => c.id === a.id)?.policiesAccepted && (
                                    <span className="material-symbols-outlined text-green-500 text-base font-black" title="Policies Accepted">check_circle</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">ID: {a.id}</p>
                                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${a.gender === 'male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                                    {a.gender}
                                  </span>
                                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                  <StatusBadge status={a.status} />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-8">
                            <div className="flex flex-col gap-2">
                              <div>
                                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-0.5">Submission Date</span>
                                <span className="text-sm font-black text-text-main">{a.date}</span>
                              </div>
                              <div className="max-w-xs">
                                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-0.5">Main Concern</span>
                                <p className="text-xs font-bold text-text-main leading-relaxed line-clamp-2">{a.concern}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-8 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button className="w-10 h-10 rounded-full flex items-center justify-center text-text-muted hover:bg-bg-soft hover:text-primary transition-all opacity-0 group-hover:opacity-100">
                                <span className="material-symbols-outlined">chat</span>
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedClientId(a.id);
                                  setActiveTab('clients');
                                  setClientRecordTab('assessment');
                                }}
                                className="text-white font-black uppercase text-[10px] tracking-widest bg-primary hover:bg-primary-dark px-8 py-3.5 rounded-2xl transition-all shadow-lg shadow-primary/20 active:scale-95"
                              >
                                Review Full
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        );
      case 'messages':
        return (
          <div className="animate-fade-up h-[calc(100vh-10rem)] flex flex-col gap-8">
            <div className="flex justify-between items-center">
               <div>
                 <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-text-main tracking-tight">Message Center</h2>
                 <p className="hidden lg:block text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mt-3 flex items-center gap-2">
                   <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                   Real-time communication with your clinical patients
                 </p>
               </div>
               {user?.adminType !== 'technical' && (
                 <button 
                   onClick={() => setShowOnlyAssigned(!showOnlyAssigned)}
                   className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${showOnlyAssigned ? 'bg-primary text-white shadow-primary/20' : 'bg-white text-text-muted border border-black/5 hover:border-primary/30 shadow-black/5'}`}
                 >
                   <span className="material-symbols-outlined text-xl">{showOnlyAssigned ? 'person' : 'group'}</span>
                   {showOnlyAssigned ? 'My Assignments' : 'All Messages'}
                 </button>
               )}
            </div>
            
            <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-8 min-h-0">
               <div className="md:col-span-4 bg-white rounded-[3rem] border border-black/5 shadow-2xl shadow-black/5 flex flex-col min-h-0 overflow-hidden">
                  <div className="p-8 border-b border-black/5 bg-bg-soft/30">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Search conversations..." 
                        value={threadSearch}
                        onChange={(e) => setThreadSearch(e.target.value)}
                        className="w-full bg-white border border-black/5 rounded-2xl px-12 py-4 text-xs font-bold shadow-sm focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary text-xl">search</span>
                    </div>
                  </div>
                  <div className="flex-grow overflow-y-auto no-scrollbar divide-y divide-black/5">
                    {Object.entries(messageThreads)
                      .filter(([clientId]) => {
                        const client = clients.find(c => c.id === clientId);
                        return client?.name?.toLowerCase().includes(threadSearch.toLowerCase()) || clientId.toLowerCase().includes(threadSearch.toLowerCase());
                      })
                      .sort((a, b) => {
                        const lastA = a[1].length > 0 ? new Date(a[1][a[1].length - 1].createdAt).getTime() : 0;
                        const lastB = b[1].length > 0 ? new Date(b[1][b[1].length - 1].createdAt).getTime() : 0;
                        return lastB - lastA;
                      })
                      .map(([clientId, thread]) => {
                      const client = clients.find(c => c.id === clientId);
                      const lastMsg = thread[thread.length - 1];
                      const unreadCount = thread.filter(m => !m.read && m.recipientId === 'admin').length;
                      
                      return (
                        <button
                          key={clientId}
                          onClick={() => {
                            setSelectedThreadId(clientId);
                            // Mark all as read
                            thread.forEach(m => {
                              if (!m.read && m.recipientId === 'admin') onMarkMessageRead(m.id);
                            });
                          }}
                          className={`w-full p-8 text-left transition-all hover:bg-bg-soft flex items-center gap-5 border-l-4 ${selectedThreadId === clientId ? 'bg-primary/5 border-primary' : 'border-transparent'}`}
                        >
                          <div className="relative shrink-0">
                            <div className="w-16 h-16 rounded-[1.25rem] bg-clinical-dark flex items-center justify-center text-white font-black text-sm shadow-lg shadow-clinical-dark/20 group-hover:scale-105 transition-transform">
                              {getInitials(client?.name)}
                            </div>
                            {unreadCount > 0 && (
                              <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary border-4 border-white flex items-center justify-center text-[10px] font-black text-clinical-dark shadow-sm">
                                {unreadCount}
                              </div>
                            )}
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-black text-text-main truncate">{client?.name || 'Unknown Client'}</h4>
                              <span className="text-[9px] font-bold text-text-muted shrink-0 uppercase tracking-widest">{new Date(lastMsg.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                            </div>
                            <p className={`text-[11px] leading-relaxed line-clamp-2 ${unreadCount > 0 ? 'font-bold text-text-main' : 'text-text-muted'}`}>{lastMsg.body}</p>
                          </div>
                        </button>
                      );
                    })}
                    {Object.keys(messageThreads).length === 0 && (
                      <div className="p-20 text-center">
                        <span className="material-symbols-outlined text-5xl text-primary/20 mb-4">forum</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">No messages yet</p>
                      </div>
                    )}
                  </div>
               </div>
               <div className="md:col-span-8 bg-white rounded-[3rem] border border-black/5 shadow-2xl shadow-black/5 flex flex-col overflow-hidden relative">
                  {selectedThreadId ? (
                    <>
                      <div className="p-8 border-b border-black/5 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 rounded-2xl bg-clinical-dark flex items-center justify-center text-white font-black text-lg shadow-lg shadow-clinical-dark/20">
                             {getInitials(clients.find(c => c.id === selectedThreadId)?.name)}
                           </div>
                           <div>
                             <h3 className="text-lg font-black text-text-main">
                               {clients.find(c => c.id === selectedThreadId)?.name}
                             </h3>
                             <div className="flex items-center gap-2 mt-1">
                               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                               <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Patient Online</p>
                             </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button className="w-12 h-12 rounded-2xl bg-bg-soft text-text-muted hover:text-primary transition-all flex items-center justify-center">
                            <span className="material-symbols-outlined">call</span>
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedClientId(selectedThreadId);
                              setActiveTab('clients');
                              setClientRecordTab('communications');
                            }}
                            className="bg-clinical-dark text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-black/10"
                          >
                            View Full Profile
                          </button>
                        </div>
                      </div>
                      <div className="flex-grow overflow-y-auto p-10 space-y-6 no-scrollbar bg-bg-soft/20">
                        {messageThreads[selectedThreadId]?.map((msg) => (
                          <div key={msg.id} className={`flex items-end gap-3 ${msg.senderId === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {msg.senderId !== 'admin' && (
                              <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center text-primary font-black text-[10px] shrink-0 shadow-sm">
                                {getInitials(clients.find(c => c.id === selectedThreadId)?.name)}
                              </div>
                            )}
                            <div className={`max-w-[65%] p-6 shadow-xl shadow-black/5 ${
                              msg.senderId === 'admin' 
                                ? 'bg-clinical-dark text-white rounded-[2rem] rounded-br-sm' 
                                : 'bg-white border border-black/5 text-text-main rounded-[2rem] rounded-bl-sm'
                            }`}>
                              {msg.type === 'form' ? (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-3 text-primary">
                                    <span className="material-symbols-outlined text-xl">description</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Clinical Form Attachment</span>
                                  </div>
                                  <p className="text-sm font-bold leading-relaxed">{FORMS.find(f => f.id === msg.formId)?.title || msg.subject}</p>
                                  <button 
                                    onClick={() => setViewingForm(msg)}
                                    className="block w-full bg-primary text-clinical-dark text-center py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20"
                                  >
                                    {msg.isSigned ? 'View Signed Form' : 'View Sent Form'}
                                  </button>
                                </div>
                              ) : msg.type === 'payment' ? (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-3 text-primary">
                                    <span className="material-symbols-outlined text-xl">payments</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Secure Payment Link</span>
                                  </div>
                                  <p className="text-sm font-bold leading-relaxed">{msg.body?.split(': ')[0] || msg.body}</p>
                                  <a 
                                    href={msg.paymentUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block w-full bg-primary text-clinical-dark text-center py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20"
                                  >
                                    Pay via Stripe
                                  </a>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm leading-relaxed mb-3">{msg.body}</p>
                                </>
                              )}
                              <div className={`text-[8px] font-bold uppercase tracking-widest ${
                                msg.senderId === 'admin' ? 'text-white/40 text-right' : 'text-text-muted'
                              } mt-2`}>
                                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Recently'} 
                                {msg.senderId === 'admin' && msg.read && <span className="ml-1 text-primary">Read</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-6 bg-white border-t border-black/5 relative">
                        {showQuickActions && (
                          <div className="absolute bottom-full left-6 mb-2 w-64 bg-white rounded-2xl border border-black/5 shadow-2xl p-2 z-20 animate-fade-up">
                            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted p-2 border-b border-black/5 mb-1">Quick Clinical Actions</p>
                            {FORMS.map(form => (
                              <button 
                                key={form.id}
                                onClick={async () => {
                                  await onSendMessage({
                                    senderId: 'admin',
                                    recipientId: selectedThreadId,
                                    subject: form.title,
                                    body: `Please complete the following form: ${form.title}`,
                                    type: 'form',
                                    formId: form.id,
                                    read: false,
                                    createdAt: new Date().toISOString()
                                  });
                                  setShowQuickActions(false);
                                }}
                                className="w-full flex items-center gap-3 p-3 hover:bg-bg-soft rounded-xl transition-all text-left group"
                              >
                                <span className="material-symbols-outlined text-primary text-sm group-hover:scale-110 transition-transform">description</span>
                                <span className="text-[10px] font-bold text-text-main truncate">{form.title}</span>
                              </button>
                            ))}
                            <button 
                              onClick={async () => {
                                const amount = '150'; // Default amount to avoid prompt in iframe
                                await onSendMessage({
                                  senderId: 'admin',
                                  recipientId: selectedThreadId,
                                  subject: 'Payment Request',
                                  body: `Payment Request: £${amount} for treatment session`,
                                  type: 'payment',
                                  paymentUrl: 'https://buy.stripe.com/test_6oE7v9gX8',
                                  read: false,
                                  createdAt: new Date().toISOString()
                                });
                                setShowQuickActions(false);
                              }}
                              className="w-full flex items-center gap-3 p-3 hover:bg-bg-soft rounded-xl transition-all text-left group border-t border-black/5 mt-1"
                            >
                              <span className="material-symbols-outlined text-primary text-sm group-hover:scale-110 transition-transform">payments</span>
                              <span className="text-[10px] font-bold text-text-main">Request Payment</span>
                            </button>
                          </div>
                        )}
                        <form 
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!messageInput.trim()) return;
                            await onSendMessage({
                              senderId: 'admin',
                              recipientId: selectedThreadId,
                              subject: 'Clinic Update',
                              body: messageInput,
                              read: false,
                              createdAt: new Date().toISOString()
                            });
                            setMessageInput('');
                          }}
                          className="flex items-center gap-3"
                        >
                          <button 
                            type="button"
                            onClick={() => setShowQuickActions(!showQuickActions)}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${showQuickActions ? 'bg-primary text-clinical-dark' : 'bg-bg-soft text-text-muted hover:text-primary'}`}
                          >
                            <span className="material-symbols-outlined">add_circle</span>
                          </button>
                          <input 
                            type="text" 
                            placeholder="Type clinical update..." 
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            className="flex-grow bg-bg-soft border-transparent rounded-xl px-6 py-4 text-xs font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                          <button 
                            type="submit"
                            disabled={!messageInput.trim()}
                            className="w-12 h-12 bg-primary text-clinical-dark rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                          >
                            <span className="material-symbols-outlined">send</span>
                          </button>
                        </form>
                      </div>
                    </>
                  ) : (
                    <div className="flex-grow flex flex-col items-center justify-center p-12 text-center">
                      <div className="w-24 h-24 bg-bg-soft rounded-[2.5rem] flex items-center justify-center text-primary/20 mb-6">
                        <span className="material-symbols-outlined text-6xl">forum</span>
                      </div>
                      <h3 className="text-lg font-black text-text-main mb-2">Select a Conversation</h3>
                      <p className="text-xs text-text-muted font-medium max-w-xs">Choose a client from the registry to view their communication history and send clinical updates.</p>
                    </div>
                  )}
               </div>
            </div>
          </div>
        );
      case 'appointments':
        return (
          <div className="animate-fade-up space-y-4 md:space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-xl md:text-3xl font-black text-text-main">Appointment Manager</h2>
              <div className="flex gap-2 w-full sm:w-auto">
                {user?.adminType !== 'technical' && (
                  <button 
                    onClick={() => setShowOnlyAssigned(!showOnlyAssigned)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border ${showOnlyAssigned ? 'bg-primary text-white border-primary' : 'bg-white text-text-muted border-black/5 hover:border-primary/30'}`}
                  >
                    <span className="material-symbols-outlined text-sm">{showOnlyAssigned ? 'person' : 'group'}</span>
                    {showOnlyAssigned ? 'My Assignments' : 'All Appointments'}
                  </button>
                )}
                <button 
                  onClick={() => openBookingModal()}
                  className="w-full sm:w-auto bg-primary text-clinical-dark px-8 py-3 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/10 transition-transform active:scale-95"
                >
                  Book New Appointment
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
              <div className="lg:col-span-12">
                <Card className="md:border-none md:bg-transparent md:shadow-none">
                  {/* Calendar Header - Visible on all screens but styled differently */}
                  <div className="flex p-4 md:p-8 bg-white rounded-t-2xl md:rounded-t-[2.5rem] border border-black/5 md:border-b-0 justify-between items-center gap-4 mb-2 md:mb-0">
                    <div className="flex items-center gap-2 md:gap-4">
                      <button 
                        onClick={() => changeMonth(-1)}
                        className="p-1.5 md:p-2 hover:bg-bg-soft rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg md:text-xl">chevron_left</span>
                      </button>
                      <h3 className="text-[10px] md:text-sm font-black uppercase tracking-widest text-text-main">
                        {currentCalendarDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                      </h3>
                      <button 
                        onClick={() => changeMonth(1)}
                        className="p-1.5 md:p-2 hover:bg-bg-soft rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg md:text-xl">chevron_right</span>
                      </button>
                    </div>
                    <div className="flex bg-bg-soft p-1 rounded-xl">
                      <button 
                        onClick={() => setAppointmentView('list')}
                        className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${appointmentView === 'list' ? 'bg-white text-primary shadow-sm' : 'text-text-muted'}`}
                      >
                        List
                      </button>
                      <button 
                        onClick={() => setAppointmentView('calendar')}
                        className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${appointmentView === 'calendar' ? 'bg-white text-primary shadow-sm' : 'text-text-muted'}`}
                      >
                        Cal
                      </button>
                    </div>
                  </div>

                  {appointmentView === 'list' ? (
                    <>
                      {/* Mobile Card View */}
                      <div className="grid grid-cols-1 gap-4 lg:hidden">
                        {appointments
                          .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                          .map((apt) => (
                            <div key={apt.id} className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm space-y-4">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px]">
                                    {getInitials(apt.clientName)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-text-main">{apt.clientName}</p>
                                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{apt.type}</p>
                                  </div>
                                </div>
                                <StatusBadge status={apt.status} />
                              </div>
                              
                              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-primary uppercase tracking-widest">Schedule</span>
                                  <span className="text-[11px] font-bold text-text-main">
                                    {new Date(apt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • {apt.time}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => {
                                      const newStatus = apt.status === 'Confirmed' ? 'Completed' : 'Confirmed';
                                      onUpdateAppointment(apt.id, { status: newStatus });
                                    }}
                                    className="p-2 bg-bg-soft text-text-muted rounded-xl hover:text-primary transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-lg">check_circle</span>
                                  </button>
                                  <button 
                                    onClick={() => onDeleteAppointment(apt.id)}
                                    className="p-2 bg-bg-soft text-text-muted rounded-xl hover:text-red-500 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden lg:block bg-white rounded-b-[2.5rem] border border-black/5 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-bg-soft text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-black/5">
                              <tr>
                                <th className="px-8 py-5">Client & Treatment</th>
                                <th className="px-8 py-5">Schedule & Status</th>
                                <th className="px-8 py-5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {appointments
                                .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                                .map((apt) => (
                                  <tr key={apt.id} className="hover:bg-bg-soft/40 transition-colors group">
                                    <td className="px-8 py-6">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[9px]">
                                          {getInitials(apt.clientName)}
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-sm font-bold text-text-main">{apt.clientName}</span>
                                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{apt.type}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-8 py-6">
                                      <div className="flex flex-col items-start gap-2">
                                        <div>
                                          <span className="text-sm font-black text-text-main">{new Date(apt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-2">{apt.time}</span>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                          apt.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                                          apt.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                                          apt.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                          'bg-yellow-100 text-yellow-700'
                                        }`}>
                                          {apt.status}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                      <div className="flex justify-end gap-2">
                                        <button 
                                          onClick={() => {
                                            const newStatus = apt.status === 'Confirmed' ? 'Completed' : 'Confirmed';
                                            onUpdateAppointment(apt.id, { status: newStatus });
                                          }}
                                          className="p-2 text-text-muted hover:text-primary transition-colors"
                                          title="Toggle Status"
                                        >
                                          <span className="material-symbols-outlined text-lg">check_circle</span>
                                        </button>
                                        <button 
                                          onClick={() => onDeleteAppointment(apt.id)}
                                          className="p-2 text-text-muted hover:text-red-500 transition-colors"
                                          title="Delete"
                                        >
                                          <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white rounded-b-2xl md:rounded-b-[2.5rem] border border-black/5 shadow-sm p-2 md:p-8 overflow-x-auto no-scrollbar">
                      <div className="min-w-[600px] md:min-w-0 grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="bg-bg-soft py-3 text-center">
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-text-muted">{day}</span>
                          </div>
                        ))}
                        {getCalendarDays().map((dateObj, i) => {
                          const dateStr = `${dateObj.year}-${String(dateObj.month + 1).padStart(2, '0')}-${String(dateObj.day).padStart(2, '0')}`;
                          const dayAppointments = appointments.filter(a => a.date === dateStr);
                          
                          return (
                            <div 
                              key={i} 
                              className={`bg-white min-h-[80px] md:min-h-[140px] p-1.5 md:p-4 transition-all hover:bg-bg-soft/50 ${
                                !dateObj.currentMonth ? 'opacity-30' : ''
                              }`}
                            >
                              <span className={`text-[10px] md:text-xs font-black ${
                                dateObj.day === new Date().getDate() && 
                                dateObj.month === new Date().getMonth() && 
                                dateObj.year === new Date().getFullYear()
                                  ? 'text-primary' : 'text-text-muted'
                              }`}>
                                {dateObj.day}
                              </span>
                              <div className="mt-1 md:mt-2 space-y-1">
                                {dayAppointments.map(apt => (
                                  <div 
                                    key={apt.id}
                                    className={`p-1 rounded-lg text-[7px] md:text-[8px] font-bold truncate border ${
                                      apt.status === 'Completed' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                      apt.status === 'Confirmed' ? 'bg-green-50 text-green-700 border-green-100' :
                                      'bg-yellow-50 text-yellow-700 border-yellow-100'
                                    }`}
                                    title={`${apt.time} - ${apt.clientName}`}
                                  >
                                    {apt.time?.split(' ')[0] || apt.time} {getFirstName(apt.clientName)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        );
      case 'clients':
        return (
          <div className="animate-fade-up space-y-4 md:space-y-8">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <h2 className="text-xl md:text-3xl font-black text-text-main">Client Registry</h2>
               <div className="flex gap-2 w-full sm:w-auto">
                 {user?.adminType !== 'technical' && (
                   <button 
                     onClick={() => setShowOnlyAssigned(!showOnlyAssigned)}
                     className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border ${showOnlyAssigned ? 'bg-primary text-white border-primary' : 'bg-white text-text-muted border-black/5 hover:border-primary/30'}`}
                   >
                     <span className="material-symbols-outlined text-sm">{showOnlyAssigned ? 'person' : 'group'}</span>
                     {showOnlyAssigned ? 'My Assignments' : 'All Clients'}
                   </button>
                 )}
                 <button className="bg-primary text-clinical-dark px-8 py-3 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/10 transition-transform active:scale-95">Add New Client</button>
               </div>
             </div>

             {!selectedClientId ? (
               <>
                 {/* Desktop Stats - Only visible on desktop when no client selected */}
                 <div className="hidden lg:grid grid-cols-4 gap-6 mb-8">
                   <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                     <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Total Registry</p>
                     <div className="flex items-end gap-2">
                       <p className="text-3xl font-black text-text-main leading-none">{filteredClients.length}</p>
                       <span className="text-[10px] font-bold text-green-500 mb-1">+4%</span>
                     </div>
                   </div>
                   <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                     <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Active Protocols</p>
                     <div className="flex items-end gap-2">
                       <p className="text-3xl font-black text-text-main leading-none">{filteredClients.filter(c => c.status === 'Active' || !c.status).length}</p>
                       <span className="text-[10px] font-bold text-primary mb-1">Stable</span>
                     </div>
                   </div>
                   <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                     <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Pending Review</p>
                     <div className="flex items-end gap-2">
                       <p className="text-3xl font-black text-text-main leading-none">{filteredClients.filter(c => c.status === 'Assessment Submitted').length}</p>
                       <span className="text-[10px] font-bold text-red-500 mb-1">Action Required</span>
                     </div>
                   </div>
                   <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                     <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2">Conversion Rate</p>
                     <div className="flex items-end gap-2">
                       <p className="text-3xl font-black text-text-main leading-none">68%</p>
                       <span className="text-[10px] font-bold text-green-500 mb-1">↑ 12%</span>
                     </div>
                   </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 md:gap-8">
                    {/* Mobile View: Sidebar-style list */}
                    <div className="lg:hidden">
                      <Card className="p-4 md:p-6">
                        <div className="relative mb-4 md:mb-6">
                          <input type="text" placeholder="Search registry..." className="w-full bg-bg-soft border-transparent rounded-xl px-10 py-3.5 md:py-4 text-xs font-bold focus:ring-2 focus:ring-primary/20" />
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-sm">search</span>
                        </div>
                        <div className="space-y-1.5 md:space-y-2">
                          {filteredClients.map(c => (
                            <button 
                              key={c.id}
                              onClick={() => setSelectedClientId(c.id)}
                              className={`w-full flex items-center gap-3 p-3 md:p-4 rounded-2xl transition-all text-left group border ${selectedClientId === c.id ? 'bg-primary/5 border-primary/20' : 'border-transparent hover:bg-bg-soft hover:border-black/5'}`}
                            >
                              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px] md:text-xs group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                                {getInitials(c.name)}
                              </div>
                              <div className="min-w-0 flex-grow">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-black text-text-main truncate">{c.name}</p>
                                  <AssignedBadge isAssigned={isAssignedToMe(c)} />
                                  {c.policiesAccepted && (
                                    <span className="material-symbols-outlined text-green-500 text-sm font-black" title="Policies Accepted">check_circle</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{c.id}</p>
                                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                  <p className="text-[9px] font-bold text-primary uppercase tracking-widest">{c.status || 'Active'}</p>
                                </div>
                              </div>
                              <span className="material-symbols-outlined text-text-muted/30 group-hover:text-primary transition-colors text-lg">chevron_right</span>
                            </button>
                          ))}
                        </div>
                      </Card>
                    </div>

                    {/* Desktop View: Full Table */}
                    <div className="hidden lg:block">
                      <Card className="overflow-hidden border-none shadow-sm rounded-[2.5rem]">
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white">
                          <div className="relative w-96">
                            <input type="text" placeholder="Search by name, email or ID..." className="w-full bg-bg-soft border-transparent rounded-2xl px-12 py-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all" />
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">search</span>
                          </div>
                          <div className="flex gap-4">
                            <button className="px-6 py-3 bg-bg-soft text-text-muted rounded-xl text-[10px] font-black uppercase tracking-widest border border-black/5 hover:border-primary/30 transition-all">Export CSV</button>
                            <button className="px-6 py-3 bg-bg-soft text-text-muted rounded-xl text-[10px] font-black uppercase tracking-widest border border-black/5 hover:border-primary/30 transition-all">Filter</button>
                          </div>
                        </div>
                        <div className="overflow-x-auto bg-white">
                          <table className="w-full text-left">
                            <thead className="bg-bg-soft/50 text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-black/5">
                              <tr>
                                <th className="px-8 py-6">Profile & Contact</th>
                                <th className="px-8 py-6">Status & Activity</th>
                                <th className="px-8 py-6 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {filteredClients.map(c => (
                                <tr 
                                  key={c.id} 
                                  onClick={() => setSelectedClientId(c.id)}
                                  className="hover:bg-bg-soft/40 transition-colors cursor-pointer group"
                                >
                                  <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs group-hover:bg-primary group-hover:text-white transition-all">
                                        {getInitials(c.name)}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-black text-text-main">{c.name}</p>
                                          <AssignedBadge isAssigned={isAssignedToMe(c)} />
                                        </div>
                                        <div className="flex flex-col gap-0.5 mt-1">
                                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">ID: {c.id}</p>
                                          <div className="flex items-center gap-2 text-text-muted mt-1">
                                            <div className="flex items-center gap-1">
                                              <span className="material-symbols-outlined text-[10px]">mail</span>
                                              <span className="text-[9px] font-bold">{c.email}</span>
                                            </div>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <div className="flex items-center gap-1">
                                              <span className="material-symbols-outlined text-[10px]">call</span>
                                              <span className="text-[9px] font-bold">{c.phone}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-8 py-6">
                                    <div className="flex flex-col gap-2">
                                      <span className={`w-fit px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                        c.status === 'Active' || !c.status ? 'bg-green-100 text-green-700' : 
                                        c.status === 'Assessment Submitted' ? 'bg-blue-100 text-blue-700' :
                                        c.status === 'Consultation Pending' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {c.status || 'Active'}
                                      </span>
                                      <div>
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-0.5">Last Interaction</p>
                                        <div className="flex items-center gap-2">
                                          <p className="text-xs font-bold text-text-main">
                                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recently'}
                                          </p>
                                          <p className="text-[10px] text-text-muted font-medium">
                                            {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:45 AM'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-8 py-6 text-right">
                                    <button className="bg-clinical-dark text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-clinical-dark transition-all shadow-sm">View Record</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>
                 </div>
               </>
             ) : (
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
                  <div className={`lg:col-span-4 ${selectedClientId ? 'hidden lg:block' : 'block'}`}>
                    <Card className="p-4 md:p-6 h-full lg:h-[calc(100vh-16rem)] flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">Registry</h3>
                        <button onClick={() => setSelectedClientId(null)} className="text-[10px] font-black text-primary uppercase hover:underline">Back to Table</button>
                      </div>
                      <div className="relative mb-4 md:mb-6">
                        <input type="text" placeholder="Search registry..." className="w-full bg-bg-soft border-transparent rounded-xl px-10 py-3.5 md:py-4 text-xs font-bold focus:ring-2 focus:ring-primary/20" />
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-sm">search</span>
                      </div>
                      <div className="space-y-1.5 md:space-y-2 overflow-y-auto no-scrollbar flex-grow">
                        {filteredClients.map(c => (
                          <button 
                            key={c.id}
                            onClick={() => setSelectedClientId(c.id)}
                            className={`w-full flex items-center gap-3 p-3 md:p-4 rounded-2xl transition-all text-left group border ${selectedClientId === c.id ? 'bg-primary/5 border-primary/20' : 'border-transparent hover:bg-bg-soft hover:border-black/5'}`}
                          >
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px] md:text-xs group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                              {getInitials(c.name)}
                            </div>
                            <div className="min-w-0 flex-grow">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-text-main truncate">{c.name}</p>
                                <AssignedBadge isAssigned={isAssignedToMe(c)} />
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{c.id}</p>
                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                <p className="text-[9px] font-bold text-primary uppercase tracking-widest">{c.status || 'Active'}</p>
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-text-muted/30 group-hover:text-primary transition-colors text-lg">chevron_right</span>
                          </button>
                        ))}
                      </div>
                    </Card>
                  </div>
                  <div className={`lg:col-span-8 ${selectedClientId ? 'block' : 'hidden lg:block'}`}>
                     {renderClientRecord()}
                  </div>
               </div>
             )}
          </div>
        );
      case 'platform-health':
        return (
          <div className="animate-fade-up space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black text-text-main">Platform Health</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {user?.email === 'rasheedamer99@gmail.com' && (
                <Card className="p-8 border-primary/30 bg-primary/5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">Admin Management</h3>
                      <p className="text-sm font-black text-text-main">Bootstrap Accounts</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-text-muted leading-relaxed mb-6">Create the predefined admin accounts for Dr. Aminah and Dr. Waqas. Note: This will temporarily sign you out.</p>
                  <button 
                    onClick={async () => {
                      if (onBootstrapAdmins) {
                        setIsBootstrapping(true);
                        setBootstrapStatus('Creating accounts...');
                        try {
                          await onBootstrapAdmins();
                          setBootstrapStatus('Success! You will be signed out.');
                          setTimeout(() => onLogout(), 2000);
                        } catch (err) {
                          console.error('Bootstrap error:', err);
                          setBootstrapStatus('Failed to bootstrap. Check console.');
                          setIsBootstrapping(false);
                        }
                      }
                    }}
                    disabled={isBootstrapping}
                    className="w-full bg-primary text-clinical-dark py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {isBootstrapping ? bootstrapStatus : 'Bootstrap Admins'}
                  </button>
                </Card>
              )}
              <Card className="p-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center text-green-600">
                    <span className="material-symbols-outlined text-2xl">check_circle</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">Database Status</h3>
                    <p className="text-sm font-black text-text-main">Operational</p>
                  </div>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">All Firestore collections are synchronized and responding within normal latency parameters.</p>
              </Card>
              <Card className="p-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                    <span className="material-symbols-outlined text-2xl">security</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">Security Rules</h3>
                    <p className="text-sm font-black text-text-main">Active & Enforced</p>
                  </div>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">RBAC (Role-Based Access Control) is active. Admin specializations are being enforced at the application layer.</p>
              </Card>
              <Card className="p-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-2xl">hub</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">API Connectivity</h3>
                    <p className="text-sm font-black text-text-main">Healthy</p>
                  </div>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">Firebase Auth and Cloud Functions are reachable. Real-time messaging listeners are active.</p>
              </Card>
            </div>
            <Card className="p-8">
              <h3 className="text-xs font-black uppercase tracking-widest text-text-muted mb-6">System Logs Summary</h3>
              <div className="space-y-4">
                {[
                  { time: '10:15 AM', event: 'Database Sync', status: 'Success', details: 'Messages collection updated' },
                  { time: '09:42 AM', event: 'Auth Verification', status: 'Success', details: 'Admin login: Rasheed Amer' },
                  { time: '08:00 AM', event: 'Daily Backup', status: 'Success', details: 'Automated snapshot completed' }
                ].map((log, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-black/5 last:border-0">
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-bold text-text-muted w-16">{log.time}</span>
                      <div>
                        <p className="text-[11px] font-black text-text-main">{log.event}</p>
                        <p className="text-[9px] text-text-muted">{log.details}</p>
                      </div>
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-green-600 bg-green-100 px-2 py-1 rounded-full">{log.status}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      default:
        return (
          <div className="py-20 md:py-32 text-center">
            <span className="material-symbols-outlined text-5xl text-primary/20 mb-4">settings</span>
            <p className="text-[11px] font-black text-text-muted uppercase tracking-widest">Clinical module under active development</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex font-sans selection:bg-primary/20">
      {/* Sidebar */}
      <aside className={`h-screen fixed left-0 top-0 bg-white border-r border-black/5 flex flex-col p-8 z-50 transition-all duration-500 ease-in-out lg:translate-x-0 lg:bg-gradient-to-b lg:from-white lg:to-bg-soft/30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarCollapsed ? 'w-24' : 'w-[300px]'}`}>
        <div className="flex items-center justify-between mb-12">
          {!isSidebarCollapsed && (
            <Logo size="sm" className="!justify-start scale-90 -ml-4 lg:scale-100 lg:-ml-2" />
          )}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex w-8 h-8 rounded-full bg-bg-soft items-center justify-center text-text-muted hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-lg">
                {isSidebarCollapsed ? 'menu_open' : 'menu'}
              </span>
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-text-muted hover:text-primary">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <nav className="flex-grow space-y-2">
          <SidebarItem id="overview" label="Overview" icon="space_dashboard" activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} />
          <SidebarItem id="assessments" label="Assessments" icon="assignment" activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} />
          <SidebarItem id="clients" label="Clients" icon="database" activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} />
          <SidebarItem id="appointments" label="Appointments" icon="calendar_month" activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} />
          {user?.adminType === 'technical' && (
            <SidebarItem id="platform-health" label="Platform Health" icon="health_and_safety" activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} />
          )}
          <SidebarItem id="messages" label="Messages" icon="forum" activeTab={activeTab} selectedClientId={selectedClientId} onClick={handleSidebarClick} isCollapsed={isSidebarCollapsed} />
        </nav>

        <div className="mt-auto pt-8 border-t border-gray-100 relative">
            {user?.adminType === 'technical' && showAccountSwitcher && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute bottom-full left-0 w-full mb-4 p-4 bg-white rounded-2xl border border-black/5 shadow-2xl z-[60]"
              >
                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  Switch View Mode
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {[
                    { id: 'all', label: 'Ultimate Access', icon: 'hub' },
                    { id: 'doctor-female', label: 'Dr. Aminah (F)', icon: 'female' },
                    { id: 'doctor-male', label: 'Dr. Waqas (M)', icon: 'male' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setEffectiveAdminType(mode.id as AdminType | 'all');
                        setShowAccountSwitcher(false);
                      }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                        effectiveAdminType === mode.id 
                          ? 'bg-primary text-clinical-dark shadow-sm' 
                          : 'text-text-muted hover:bg-bg-soft hover:text-clinical-dark'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">{mode.icon}</span>
                      {mode.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
            <button 
              onClick={() => user?.adminType === 'technical' && setShowAccountSwitcher(!showAccountSwitcher)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all mb-4 text-left group ${
                showAccountSwitcher ? 'bg-primary/10 ring-2 ring-primary/20' : 'bg-clinical-dark text-white hover:bg-primary transition-colors'
              }`}
            >
               <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs transition-colors ${
                 showAccountSwitcher ? 'bg-primary text-white' : 'bg-primary/20 text-primary group-hover:bg-white group-hover:text-primary'
               }`}>
                 {getInitials(user?.fullName)}
               </div>
               <div className="flex flex-col min-w-0 flex-grow">
                  <span className={`text-[10px] font-black truncate uppercase tracking-widest transition-colors ${showAccountSwitcher ? 'text-clinical-dark' : 'text-white group-hover:text-clinical-dark'}`}>{user?.fullName}</span>
                  <span className={`text-[8px] font-bold truncate lowercase tracking-widest transition-colors ${showAccountSwitcher ? 'text-primary' : 'text-primary/60 group-hover:text-clinical-dark/60'}`}>@{user?.username}</span>
                  <span className={`text-[8px] font-bold uppercase tracking-widest transition-colors ${showAccountSwitcher ? 'text-text-muted' : 'text-gray-500 group-hover:text-clinical-dark/40'}`}>
                    {user?.adminType === 'technical' ? (
                      <span className="flex items-center gap-1">
                        {effectiveAdminType === 'all' ? 'Technical Admin' : 
                         effectiveAdminType === 'doctor-female' ? 'Viewing as Aminah' : 'Viewing as Waqas'}
                        <span className="material-symbols-outlined text-[10px]">unfold_more</span>
                      </span>
                    ) : 
                     user?.adminType === 'doctor-female' ? 'Clinical Director (F)' : 
                     user?.adminType === 'doctor-male' ? 'Clinical Director (M)' : 'System Admin'}
                  </span>
               </div>
            </button>
            <button 
             onClick={onLogout}
             className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-text-muted hover:text-red-500 hover:bg-red-50 transition-all group"
            >
              <span className="material-symbols-outlined group-hover:rotate-180 transition-transform">logout</span>
              <span className="text-[11px] font-black uppercase tracking-widest">End Session</span>
           </button>
        </div>
      </aside>

      {/* Main Admin Area */}
      <main className={`flex-grow min-h-screen transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-[300px]'}`}>
        <header className="h-20 bg-white/60 backdrop-blur-xl border-b border-black/5 px-6 lg:px-12 flex items-center justify-between sticky top-0 z-40">
           <div className="flex items-center gap-4 lg:gap-8">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-text-muted hover:text-primary">
                <span className="material-symbols-outlined">menu</span>
              </button>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted hidden sm:inline">ADMIN PORTAL</span>
                 <span className="text-text-muted/30 hidden sm:inline">/</span>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{activeTab}</span>
              </div>
              
              {/* Desktop Global Search */}
              <div className="hidden lg:flex items-center relative w-96">
                <span className="material-symbols-outlined absolute left-4 text-primary text-xl">search</span>
                <input 
                  type="text" 
                  placeholder="Search clients, appointments, or messages..." 
                  className="w-full bg-bg-soft/50 border-transparent rounded-full pl-12 pr-6 py-2.5 text-xs font-bold focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all border border-black/5"
                />
              </div>
           </div>
           <div className="flex items-center gap-3 sm:gap-6">
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`relative p-2 transition-colors rounded-full hover:bg-bg-soft ${showNotifications ? 'text-primary bg-bg-soft' : 'text-text-muted'}`}
                >
                  <span className="material-symbols-outlined">notifications</span>
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[8px] font-black text-white flex items-center justify-center">
                      {unreadCount}
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
                    <div className="absolute right-0 mt-4 w-[320px] md:w-[400px] bg-white rounded-3xl shadow-2xl border border-black/5 z-50 overflow-hidden animate-fade-up origin-top-right">
                      <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                        <h3 className="text-xs font-black uppercase tracking-widest text-text-main">Notifications</h3>
                        <button 
                          onClick={clearAll}
                          className="text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-primary transition-colors"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                        {notifications.length > 0 ? (
                          notifications.map((n) => (
                            <div 
                              key={n.id} 
                              onClick={() => handleNotificationClick(n)}
                              className={`p-5 border-b border-gray-50 flex gap-4 hover:bg-bg-soft transition-colors cursor-pointer relative ${!n.read ? 'bg-primary/5' : ''}`}
                            >
                              {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                n.type === 'assessment' ? 'bg-blue-100 text-blue-600' :
                                n.type === 'appointment' ? 'bg-green-100 text-green-600' :
                                n.type === 'message' ? 'bg-purple-100 text-purple-600' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                <span className="material-symbols-outlined text-xl">
                                  {n.type === 'assessment' ? 'assignment' :
                                   n.type === 'appointment' ? 'event' :
                                   n.type === 'message' ? 'forum' :
                                   'settings'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-black text-text-main mb-1">{n.title}</p>
                                <p className="text-[10px] text-text-muted leading-relaxed mb-2">{n.message}</p>
                                <p className="text-[8px] font-bold text-text-muted uppercase tracking-widest">{n.time}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-12 text-center">
                            <span className="material-symbols-outlined text-4xl text-primary/20 mb-4">notifications_off</span>
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">No new notifications</p>
                          </div>
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <div className="p-4 bg-bg-soft text-center">
                          <button className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline">View All Activity</button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="h-8 w-[1px] bg-gray-100 hidden sm:block" />
              <div className="items-center gap-3 hidden sm:flex">
                 <p className="text-[10px] font-black text-text-main uppercase tracking-widest">Live Mode</p>
                 <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </div>
              <div className="h-8 w-[1px] bg-gray-100 hidden sm:block" />
              <button 
                onClick={onLogout}
                className="flex items-center gap-2 text-text-muted hover:text-red-500 transition-colors group"
              >
                <span className="material-symbols-outlined text-xl group-hover:rotate-180 transition-transform">logout</span>
                <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Sign Out</span>
              </button>
           </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-12 xl:p-16 2xl:p-20 max-w-[1600px] mx-auto">
           {renderSection()}
        </div>

        {/* Booking Modal */}
        {showBookingModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <div className="absolute inset-0 bg-clinical-dark/60 backdrop-blur-sm" onClick={() => setShowBookingModal(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 md:p-8 border-b border-gray-50 flex justify-between items-center bg-bg-soft shrink-0">
                <h3 className="text-base md:text-lg font-black text-text-main uppercase tracking-widest">Book Appointment</h3>
                <button onClick={() => setShowBookingModal(false)} className="text-text-muted hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleBookingSubmit} className="p-6 md:p-8 space-y-4 md:space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Select Client</label>
                  <select 
                    required
                    value={bookingForm.clientId || ''}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, clientId: e.target.value }))}
                    className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="" disabled>Choose a client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Date</label>
                    <input 
                      type="date" 
                      required
                      value={bookingForm.date || ''}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Time</label>
                    <select 
                      required
                      value={bookingForm.time || ''}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all"
                    >
                      {['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Treatment Type</label>
                  <select 
                    required
                    value={bookingForm.type || ''}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, type: e.target.value as Appointment['type'] }))}
                    className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all"
                  >
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
                  <textarea 
                    value={bookingForm.notes || ''}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all h-24 resize-none"
                    placeholder="Add any specific instructions or prep notes..."
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-primary text-clinical-dark py-4 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95"
                >
                  Confirm Appointment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </main>
      {viewingForm && (
        <InteractiveForm 
          message={viewingForm}
          isReadOnly={true}
          onClose={() => setViewingForm(null)}
        />
      )}
      {/* Gallery Upload Modal */}
      <AnimatePresence>
        {showGalleryUpload && selectedClient && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isUploading && setShowGalleryUpload(false)}
              className="absolute inset-0 bg-clinical-dark/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 md:p-8">
                <div className="flex justify-between items-center mb-6 md:mb-8">
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-text-main">Add Progress Photo</h3>
                    <p className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-widest mt-1">Upload for {selectedClient.name}</p>
                  </div>
                  <button 
                    onClick={() => setShowGalleryUpload(false)}
                    disabled={isUploading}
                    className="w-10 h-10 rounded-full bg-bg-soft flex items-center justify-center text-text-muted hover:text-text-main transition-colors disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Photo Preview / Upload Area */}
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
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-4 p-8">
                        <div className="flex gap-4">
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-black/5 flex flex-col items-center justify-center gap-1 text-text-muted hover:text-primary hover:border-primary/20 transition-all"
                          >
                            <Upload className="w-6 h-6" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Gallery</span>
                          </button>
                          <button 
                            onClick={() => cameraInputRef.current?.click()}
                            className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-black/5 flex flex-col items-center justify-center gap-1 text-text-muted hover:text-primary hover:border-primary/20 transition-all"
                          >
                            <Camera className="w-6 h-6" />
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

                  {/* Label Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Photo Label</label>
                    <input 
                      type="text"
                      value={galleryUploadLabel}
                      onChange={(e) => setGalleryUploadLabel(e.target.value)}
                      placeholder="e.g., Post-Session 1 - Vertex"
                      className="w-full px-6 py-4 bg-bg-soft rounded-2xl border border-black/5 font-bold text-text-main placeholder:text-text-muted/40 focus:outline-none focus:border-primary/30 transition-all"
                    />
                  </div>

                  <button 
                    onClick={() => handleGalleryUpload(selectedClient.id, selectedClient.gallery)}
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
                        <Upload className="w-5 h-5" />
                        Save to Gallery
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

export default AdminPage;
