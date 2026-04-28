import React, { useState, useMemo } from 'react';
import { Page, User, Appointment, Client, Message, GalleryItem } from '../types';
import { FORMS } from '../constants';
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
    className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all group ${activeTab === id ? 'bg-clinical-dark text-white shadow-xl shadow-clinical-dark/10' : 'text-text-muted hover:bg-bg-soft'}`}
  >
    <div className="flex items-center gap-4">
      <span className={`material-symbols-outlined transition-transform group-hover:scale-110 ${activeTab === id ? 'text-primary' : 'text-text-muted'}`}>{icon}</span>
      <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
    </div>
    {badge !== undefined && badge > 0 && (
      <span className="bg-primary text-clinical-dark text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-primary/20">
        {badge}
      </span>
    )}
  </button>
);

const ClientDashboard: React.FC<ClientDashboardProps> = ({ user, onLogout, onNavigate, appointments, clients, messages, onSendMessage, onMarkMessageRead, onUpdateMessage, onUpdateClient, onAcceptPolicies }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [showPolicyModal, setShowPolicyModal] = useState(!user?.policiesAccepted);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [activeFormMessage, setActiveFormMessage] = useState<Message | null>(null);

  const [hasSeenAssessmentAlert, setHasSeenAssessmentAlert] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<GalleryItem | null>(null);

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

  // Find current client profile
  const currentClient = clients.find(c => c.id === user?.id || c.email === user?.email);

  // Filter appointments for this user
  const userAppointments = appointments.filter(a => a.clientId === user?.id);
  const nextAppointment = userAppointments
    .filter(a => a.status === 'Confirmed' || a.status === 'Pending')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  // Mock data for Client
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
            <header className="mb-8 md:mb-12">
              <h2 className="text-3xl md:text-5xl font-black text-text-main tracking-tight leading-tight">Welcome back, <br className="md:hidden" /><span className="text-primary italic font-serif">{firstName}.</span></h2>
              <p className="text-text-muted font-medium mt-2 text-sm md:text-base">Here is an overview of your restoration journey.</p>
            </header>

            <div className="flex flex-nowrap overflow-x-auto snap-x snap-mandatory md:grid md:grid-cols-3 gap-4 md:gap-6 pb-4 md:pb-0 -mx-6 px-6 md:mx-0 md:px-0 no-scrollbar">
              <div className="snap-center shrink-0 w-[85vw] md:w-auto bg-white p-6 md:p-8 rounded-[2rem] border border-black/5 shadow-sm">
                <span className="text-primary font-black uppercase tracking-widest text-[9px] block mb-3 md:mb-4">Next Appointment</span>
                {nextAppointment ? (
                  <>
                    <p className="text-lg md:text-xl font-black text-text-main">
                      {new Date(nextAppointment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs md:text-sm font-medium text-text-muted">{nextAppointment.time} • {nextAppointment.type}</p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-text-muted italic">No upcoming visits</p>
                )}
              </div>
              <div className="snap-center shrink-0 w-[85vw] md:w-auto bg-white p-6 md:p-8 rounded-[2rem] border border-black/5 shadow-sm">
                <span className="text-primary font-black uppercase tracking-widest text-[9px] block mb-3 md:mb-4">Current Package</span>
                <p className="text-lg md:text-xl font-black text-text-main">{currentClient?.package || 'No active package'}</p>
                <div className="mt-4 h-1.5 bg-bg-soft rounded-full overflow-hidden mb-2">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[9px] md:text-[10px] font-black text-primary uppercase">{currentClient?.packageStatus || 'N/A'}</p>
                  {(!currentClient?.packageStatus || currentClient.packageStatus.toLowerCase() !== 'active') && (
                    <button 
                      onClick={() => alert(`Initializing secure Stripe Checkout session for ${currentClient?.id}...`)}
                      className="text-[9px] md:text-[10px] bg-[#635BFF] text-white font-bold py-1 px-3 rounded-full hover:bg-opacity-90 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[12px]">payments</span> Checkout
                    </button>
                  )}
                </div>
              </div>
              <div className="snap-center shrink-0 w-[85vw] md:w-auto bg-white p-6 md:p-8 rounded-[2rem] border border-black/5 shadow-sm">
                <span className="text-primary font-black uppercase tracking-widest text-[9px] block mb-3 md:mb-4">Support</span>
                <p className="text-lg md:text-xl font-black text-text-main">Dr. Aminah Amer</p>
                <p className="text-xs md:text-sm font-medium text-text-muted">Directly reachable via portal</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-black/5">
                <h3 className="text-xl font-black text-text-main uppercase tracking-widest mb-8 flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">bolt</span> Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setActiveTab('appointments')} className="p-6 bg-bg-soft rounded-3xl text-center group hover:bg-primary transition-all">
                    <span className="material-symbols-outlined text-3xl text-primary group-hover:text-white mb-2">event</span>
                    <p className="text-[10px] font-black uppercase tracking-widest group-hover:text-white">Book Appt</p>
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
                  <div className="p-6 bg-white/5 rounded-2xl border border-white/10 text-center">
                    <p className="text-sm italic leading-relaxed text-gray-300 font-serif">No clinical updates yet.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'treatments':
        return (
          <div className="animate-fade-up space-y-8">
            <h2 className="text-3xl font-black text-text-main">My Treatments</h2>
            <div className="bg-white rounded-[3rem] p-10 border border-black/5 shadow-xl">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                  <div>
                    <h4 className="text-2xl font-black text-text-main">{currentClient?.package || 'No active package'}</h4>
                    <p className="text-text-muted font-medium">{currentClient?.packageStatus || 'N/A'}</p>
                  </div>
                  <div className="w-full md:w-64">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                       <span>Overall Progress</span>
                       <span className="text-primary">{progress}%</span>
                    </div>
                    <div className="h-2 bg-bg-soft rounded-full overflow-hidden">
                       <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {userAppointments.map((session, i) => (
                    <div key={session.id} className={`p-8 rounded-[2rem] border transition-all ${session.status === 'Completed' ? 'bg-primary/5 border-primary/20' : 'bg-white border-black/5'}`}>
                       <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${session.status === 'Completed' ? 'bg-primary text-white' : 'bg-bg-soft text-text-muted'}`}>{session.status}</span>
                       <h5 className="text-lg font-black mt-6">Session {i + 1}</h5>
                       <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-4">{new Date(session.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                       <p className="text-sm leading-relaxed text-text-muted font-medium pt-4 border-t border-black/5">{session.notes}</p>
                    </div>
                  ))}
               </div>
            </div>
            <div className="bg-white rounded-[3rem] p-10 border border-black/5 shadow-xl">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-text-main flex items-center gap-3">
                     <span className="material-symbols-outlined text-primary">photo_library</span> Progress Gallery
                  </h3>
                  <button 
                    onClick={() => setShowGalleryUpload(true)}
                    className="bg-primary text-white px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-primary/20"
                  >
                    <span className="material-symbols-outlined text-sm">add_a_photo</span>
                    Upload Photo
                  </button>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {currentClient?.gallery && currentClient.gallery.length > 0 ? (
                    currentClient.gallery.map((item, i) => (
                      <div key={i} className="aspect-square bg-bg-soft rounded-2xl overflow-hidden relative group cursor-pointer" onClick={() => setLightboxImage(item)}>
                        <img src={item.url} alt={item.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                          <p className="text-white text-xs font-bold">{item.label}</p>
                          <p className="text-white/80 text-[10px]">{new Date(item.uploadedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="aspect-square bg-bg-soft border-2 border-dashed border-primary/20 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                       <span className="material-symbols-outlined text-primary/40 text-3xl mb-2">lock</span>
                       <p className="text-[10px] font-black text-text-muted/60 uppercase tracking-widest leading-relaxed">No photos uploaded yet</p>
                    </div>
                  )}
               </div>
            </div>
          </div>
        );
      case 'appointments':
        return (
          <div className="animate-fade-up space-y-10">
            <div className="flex justify-between items-end">
              <h2 className="text-3xl font-black text-text-main">My Appointments</h2>
              <button 
                onClick={() => {
                  setActiveTab('messages');
                  setMessageInput('Hello, I would like to request a new appointment for...');
                }}
                className="bg-primary text-clinical-dark px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/10 hover:scale-105 transition-all active:scale-95"
              >
                Request New Visit
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
               <div className="lg:col-span-8 space-y-6">
                  {userAppointments.length > 0 ? (
                    userAppointments
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((apt, i) => (
                        <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-black/5 flex items-center justify-between shadow-sm">
                           <div className="flex items-center gap-6">
                              <div className="w-16 h-16 bg-bg-soft rounded-3xl flex flex-col items-center justify-center text-center">
                                 <span className="text-[10px] font-black text-primary uppercase">
                                   {new Date(apt.date).toLocaleString('default', { month: 'short' })}
                                 </span>
                                 <span className="text-xl font-black text-text-main leading-none">
                                   {new Date(apt.date).getDate()}
                                 </span>
                              </div>
                              <div>
                                 <h4 className="text-lg font-black text-text-main">{apt.type}</h4>
                                 <p className="text-sm font-medium text-text-muted">{apt.time}</p>
                              </div>
                           </div>
                           <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                             apt.status === 'Confirmed' ? 'bg-green-100 text-green-700' : 
                             apt.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                             'bg-gray-100 text-text-muted'
                           }`}>{apt.status}</span>
                        </div>
                      ))
                  ) : (
                    <div className="bg-white p-12 rounded-[2.5rem] border border-black/5 text-center">
                      <p className="text-text-muted font-bold">You have no appointment history.</p>
                    </div>
                  )}
               </div>
               <div className="lg:col-span-4 bg-primary/5 rounded-[3rem] p-10 border border-primary/10">
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
            </div>
          </div>
        );
      case 'assessments':
        return (
          <div className="animate-fade-up space-y-10">
            <h2 className="text-3xl font-black text-text-main">My Assessments</h2>
            
            {currentClient?.assessmentData?.clinicalFeedback ? (
              <div className="bg-clinical-dark text-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
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
              <div className="bg-primary/5 border border-primary/20 p-8 rounded-[2.5rem] flex items-start gap-6">
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
              <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-black/5 shadow-sm">
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
          <div className="animate-fade-up h-[calc(100dvh-12rem)] flex flex-col">
            <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm flex flex-col overflow-hidden flex-grow">
              {/* Chat Header */}
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

              {/* Chat Messages */}
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
                              onClick={() => {
                                setActiveFormMessage(msg);
                                setIsFormModalOpen(true);
                              }}
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

              {/* Chat Input */}
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
                    </div>
                  </div>
                  
                  <div className="mt-12 pt-12 border-t border-black/5">
                    <button 
                      onClick={() => alert('Self-service profile editing is coming in Version 2.0. If you need to update your demographics urgently, please message the clinic.')}
                      className="bg-clinical-dark text-white px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:scale-105 transition-all opacity-80"
                    >
                      Edit Profile (Coming Soon)
                    </button>
                  </div>
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
      <aside className={`w-[300px] h-screen fixed left-0 top-0 bg-white border-r border-black/5 flex flex-col p-8 z-50 transition-transform duration-500 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-12">
          <div className="cursor-pointer" onClick={() => onNavigate(Page.Home)}>
            <Logo size="sm" className="!justify-start" />
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

        <div className="mt-auto pt-8 border-t border-gray-100 space-y-4">
           <div className="flex items-center gap-4 px-4 py-3 bg-bg-soft rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">{firstName[0]}</div>
              <div className="flex flex-col min-w-0">
                 <span className="text-[10px] font-black text-text-main truncate uppercase tracking-widest">{user?.fullName}</span>
                 <span className="text-[8px] font-bold text-primary/60 truncate lowercase tracking-widest">@{user?.username}</span>
                 <span className="text-[8px] font-bold text-text-muted uppercase">Client Portal</span>
              </div>
           </div>
           <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-text-muted hover:text-red-500 hover:bg-red-50 transition-all group"
           >
              <span className="material-symbols-outlined group-hover:rotate-180 transition-transform">logout</span>
              <span className="text-[11px] font-black uppercase tracking-widest">Sign Out</span>
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow lg:pl-[300px] min-h-screen">
        <header className="h-20 bg-white/90 backdrop-blur-lg border-b border-black/5 px-6 md:px-12 flex items-center justify-between sticky top-0 z-40">
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
          isSaving={isSending}
          onSave={async (formData, signature) => {
            setIsSending(true);
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
              setIsSending(false);
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

export default ClientDashboard;