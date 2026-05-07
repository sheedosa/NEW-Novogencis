import React, { useState, useEffect, Suspense, lazy, Component, ErrorInfo, ReactNode } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, setDoc, query, orderBy, limit, deleteDoc, updateDoc, where, or } from 'firebase/firestore';
import { Page, User, Client, Appointment, Message, UserRole, AdminType, GalleryItem, AppNotification } from './types';
import { auth, db, handleFirestoreError, OperationType, cleanData } from './firebase';
import {
  notifyNewAssessment,
  notifyClientNewMessage,
  notifyAdminNewMessage,
  notifyAppointmentConfirmed,
  notifyWelcome,
  notifyFormSent,
  notifyPaymentSent,
  markNotificationRead,
} from './utils/notificationService';
import Header from './components/Header';
import Footer from './components/Footer';
import WhatsAppWidget from './components/WhatsAppWidget';
import CookieBanner from './components/CookieBanner';
import Logo from './components/Logo';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg-soft p-6 text-center">
          <h1 className="text-2xl font-black text-text-main mb-4">Something went wrong</h1>
          <p className="text-text-muted mb-6 max-w-md">The application encountered an error. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-primary text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest"
          >
            Refresh Page
          </button>
          <pre className="mt-8 p-4 bg-red-50 text-red-600 rounded-lg text-left overflow-auto max-w-full text-xs">
            {this.state.error?.toString()}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// Direct imports for troubleshooting
import AuthPages from './pages/AuthPages';
import AssessmentPage from './pages/AssessmentPage';

// Lazy load pages for better performance
const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const TreatmentsPage = lazy(() => import('./pages/TreatmentsPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const CancellationPolicyPage = lazy(() => import('./pages/CancellationPolicyPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));

// Simple loading fallback
const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Firebase Auth Listener
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous user listener if it exists
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }
      
      if (firebaseUser) {
        unsubscribeUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            const userWithId = { ...userData, id: userData.id || firebaseUser.uid };
            console.log('Auth Listener: User document found:', userWithId.email, userWithId.role);
            setCurrentUser(userWithId);
          } else {
            console.warn('Auth Listener: User document not found for UID:', firebaseUser.uid);
            setCurrentUser(prev => prev ? prev : null);
          }
          setIsAuthReady(true);
        }, (error) => {
          console.error('Error listening to user document:', error);
          setCurrentUser(prev => prev || null);
          setIsAuthReady(true);
        });
      } else {
        setCurrentUser(null);
        setClients([]);
        setAppointments([]);
        setMessages([]);
        setIsAuthReady(true);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  // Firestore Sync: Clients
  useEffect(() => {
    if (!isAuthReady || !currentUser) {
      return;
    }

    const path = 'clients';
    let q;
    if (currentUser.role === 'admin') {
      q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(100));
    } else {
      // Clients can only read their own document
      q = query(collection(db, path), where('email', '==', currentUser.email));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      
      // Sort in memory for non-admin to avoid index requirements
      if (currentUser.role !== 'admin') {
        clientsData = clientsData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      }
      
      setClients(clientsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [isAuthReady, currentUser]);

  // Firestore Sync: Appointments
  useEffect(() => {
    if (!isAuthReady || !currentUser) {
      return;
    }

    const path = 'appointments';
    let q;
    if (currentUser.role === 'admin') {
      q = query(collection(db, path), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, path), where('clientId', '==', currentUser.id));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let appointmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      
      // Sort in memory for non-admin to avoid index requirements
      if (currentUser.role !== 'admin') {
        appointmentsData = appointmentsData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      }
      
      setAppointments(appointmentsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [isAuthReady, currentUser]);

  // Firestore Sync: Messages
  useEffect(() => {
    if (!isAuthReady || !currentUser) {
      return;
    }

    const path = 'messages';
    let q;
    if (currentUser.role === 'admin') {
      q = query(collection(db, path), orderBy('createdAt', 'asc'), limit(150));
    } else {
      // Use a simpler query and sort in memory to avoid index requirements for OR + OrderBy
      q = query(
        collection(db, path), 
        or(
          where('senderId', '==', currentUser.id), 
          where('recipientId', '==', currentUser.id)
        )
      );
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(messagesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [isAuthReady, currentUser]);

  // Firestore Sync: Notifications
  useEffect(() => {
    if (!isAuthReady || !currentUser) return;

    let q;
    if (currentUser.role === 'admin') {
      // Admins see notifications addressed to them or 'all-admins'
      q = query(
        collection(db, 'notifications'),
        where('recipientRole', '==', 'admin'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    } else {
      // Clients only see their own notifications
      q = query(
        collection(db, 'notifications'),
        where('recipientId', '==', currentUser.id),
        orderBy('createdAt', 'desc'),
        limit(30)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString()
      } as AppNotification));
      setNotifications(notifData);
    }, (error) => {
      console.error('[Notifications] Subscription error:', error);
    });

    return () => unsubscribe();
  }, [isAuthReady, currentUser]);

  const handleAddAppointment = async (appointment: Appointment) => {
    const docId = appointment.id || doc(collection(db, 'appointments')).id;
    const path = `appointments/${docId}`;
    try {
      await setDoc(doc(db, 'appointments', docId), cleanData({ ...appointment, id: docId }));

      // Notify client of confirmed appointment
      const client = clients.find(c => c.id === appointment.clientId);
      if (client) {
        notifyAppointmentConfirmed(
          client.id,
          client.email,
          client.name,
          appointment.type,
          appointment.date,
          appointment.time
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleUpdateAppointment = async (id: string, updates: Partial<Appointment>) => {
    const path = `appointments/${id}`;
    try {
      await setDoc(doc(db, 'appointments', id), cleanData(updates), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    const path = `appointments/${id}`;
    try {
      await deleteDoc(doc(db, 'appointments', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleSendMessage = async (message: Omit<Message, 'id'>) => {
    const id = doc(collection(db, 'messages')).id;
    const path = `messages/${id}`;
    try {
      await setDoc(doc(db, 'messages', id), cleanData({ ...message, id }));

      // Fire notifications after message is saved
      const isFromAdmin = message.senderId === 'admin' || clients.some(c => c.id !== message.senderId);
      const recipientClient = clients.find(c => c.id === message.recipientId);
      const senderClient = clients.find(c => c.id === message.senderId);

      if (isFromAdmin && recipientClient) {
        // Admin → Client notification
        if (message.type === 'form') {
          notifyFormSent(recipientClient.id, recipientClient.email, recipientClient.name, message.subject);
        } else if (message.type === 'payment') {
          notifyPaymentSent(recipientClient.id, recipientClient.email, recipientClient.name, message.subject);
        } else {
          notifyClientNewMessage(
            recipientClient.id,
            recipientClient.email,
            recipientClient.name,
            message.body
          );
        }
      } else if (senderClient) {
        // Client → Admin notification
        notifyAdminNewMessage(senderClient.name, senderClient.id, message.body);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleMarkMessageRead = async (id: string) => {
    const path = `messages/${id}`;
    try {
      await setDoc(doc(db, 'messages', id), cleanData({ read: true }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleUpdateMessage = async (id: string, updates: Partial<Message>) => {
    const path = `messages/${id}`;
    try {
      await setDoc(doc(db, 'messages', id), cleanData(updates), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleUpdateClient = async (id: string, updates: Partial<Client>) => {
    const path = `clients/${id}`;
    try {
      await setDoc(doc(db, 'clients', id), cleanData(updates), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const navigateTo = React.useCallback((page: Page) => {
    window.scrollTo(0, 0);
    const hash = `#${page}`;
    if (window.location.hash !== hash) {
      window.location.hash = page;
    }
    // Only update state if it's different to avoid redundant renders
    setCurrentPage(prev => {
      if (prev === page) return prev;
      console.log(`Navigating to: ${page}`);
      return page;
    });
  }, []);

  // Helper for generating Gallery arrays from assessment results
  const getGalleryFromAnswers = React.useCallback((answers: Record<string, { text: string; value: string | string[] }>): GalleryItem[] => {
    const gallery: GalleryItem[] = [];
    const photoKeys = ['f26', 'm22'];
    
    photoKeys.forEach(key => {
      if (answers[key] && Array.isArray(answers[key].value)) {
        (answers[key].value as string[]).forEach((url, index) => {
          gallery.push({
            id: `${key}-${index}-${Date.now()}`,
            url,
            label: answers[key].text,
            uploadedAt: new Date().toISOString(),
            source: 'Assessment'
          });
        });
      }
    });
    
    return gallery;
  }, []);

  // Maps raw assessment answers to structured consultation fields
  const mapAnswersToConsultation = React.useCallback((answers: Record<string, { text: string; value: string | string[] }>, gender: string) => {
    const g = (id: string) => {
      const val = answers[id]?.value;
      if (Array.isArray(val)) return val.join(', ');
      return (val as string) || '';
    };

    const isFemale = gender === 'female';
    const consultation: Record<string, any> = {
      onset: g(isFemale ? 'f3' : 'm3'),
      triggers: g(isFemale ? 'f4' : 'm4'),
      medicalHistory: g(isFemale ? 'f8' : 'm8'),
      medications: g(isFemale ? 'f11' : 'm11'),
      supplements: g(isFemale ? 'f12' : 'm12'),
      hairCare: g(isFemale ? 'f19' : 'm15'),
      lifestyle: [g(isFemale ? 'f20' : 'm16'), g(isFemale ? 'f22' : 'm18'), g(isFemale ? 'f23' : 'm19'), g(isFemale ? 'f24' : 'm20')].filter(Boolean).join(' | '),
    };

    if (isFemale) {
      consultation.femaleHealth = {
        cycles: g('f14'),
        pregnant: g('f17'),
        breastfeeding: g('f16'),
      };
    }

    // Build screening conditions from red-flag answers
    const redFlags = answers[isFemale ? 'f9' : 'm9']?.value;
    const conditions = Array.isArray(redFlags) ? redFlags.filter(f => f !== 'None' && f !== 'None of the above') : [];

    return { consultation, conditions };
  }, []);

  const handleLogin = React.useCallback(async (user: User) => {
    setCurrentUser(user);
    
    if (user.role === 'client') {
      // Check for pending assessment
      const pendingAssessmentMatch = localStorage.getItem('pendingAssessment');
      if (pendingAssessmentMatch) {
        try {
          const pendingData = JSON.parse(pendingAssessmentMatch);
          const { answers, formData, gender } = pendingData;
          
          let doctorPreference: 'female-only' | 'ok-with-male' | undefined = undefined;
          if (gender === 'male') {
            doctorPreference = 'ok-with-male';
          } else if (answers && answers['f30']) {
            doctorPreference = answers['f30'].value === 'I am okay with being seen by a male doctor' ? 'ok-with-male' : 'female-only';
          }

          const { consultation, conditions } = mapAnswersToConsultation(answers || {}, gender);

          const clientUpdates: Partial<Client> = {
            status: 'Assessment Submitted',
            gallery: getGalleryFromAnswers(answers || {}),
            assessmentData: {
              screening: { conditions, suitability: 'Pending Review' },
              consultation,
              answers: answers || {}
            }
          };

          if (doctorPreference) {
            clientUpdates.doctorPreference = doctorPreference;
          }

          if (formData) {
            if (formData.phone) clientUpdates.phone = formData.phone;
            if (formData.dateOfBirth) clientUpdates.dob = formData.dateOfBirth;
            if (formData.fullName) clientUpdates.name = formData.fullName;
          }

          await setDoc(doc(db, 'clients', user.id), cleanData(clientUpdates), { merge: true });
          console.log("Successfully linked pending assessment.");
          localStorage.removeItem('pendingAssessment');
        } catch (error) {
          console.error("Error linking pending assessment:", error);
        }
      }
    }

    if (user.role === 'admin') {
      navigateTo(Page.Admin);
    } else {
      navigateTo(Page.ClientDashboard);
    }
  }, [navigateTo, getGalleryFromAnswers]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      navigateTo(Page.Home);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleIntakeComplete = React.useCallback(async () => {
    const clientId = `C-${doc(collection(db, 'clients')).id.substring(0, 6).toUpperCase()}`;
    return clientId;
  }, []);

  // Dynamic SEO implementation
  useEffect(() => {
    const updateSEO = () => {
      let title = "Novogenics | Regenerative Care";
      let description = "Specialised regenerative hair restoration. Private doctor-led clinic in Cheadle.";

      switch (currentPage) {
        case Page.Home:
          title = "Novogenics | Home - Regenerative Hair Restoration";
          break;
        case Page.About:
          title = "About Us | Novogenics - Dr Aminah Amer";
          description = "Meet our clinical team and learn about our mission to provide evidence-based regenerative medicine.";
          break;
        case Page.Treatments:
          title = "Treatments | PRP & Exosomes Hair Restoration";
          description = "Discover our advanced regenerative treatments including EV-Enriched Plasma (Exosomes), PRP, and Hair Microneedling.";
          break;
        case Page.Pricing:
          title = "Pricing & Packages | Novogenics Hair Restoration";
          description = "View our clinical pricing for PRP, Exosome therapy, and comprehensive hair restoration packages.";
          break;
        case Page.FAQ:
          title = "Clinical FAQ | Novogenics Hair Loss Support";
          description = "Frequently asked questions about PRP, Exosome therapy, safety, and our clinical protocols.";
          break;
        case Page.Blog:
          title = "Medical Insights | Novogenics Blog";
          description = "Expert articles on hair restoration and clinical breakthroughs by our clinical team.";
          break;
        case Page.Contact:
          title = "Contact Us | Book Consultation at Novogenics Cheadle";
          description = "Get in touch with our Cheadle clinic for a private hair restoration consultation.";
          break;
        case Page.Assessment:
          title = "Free Hair Assessment | Novogenics Virtual Review";
          description = "Start your journey with a comprehensive clinical review of your hair loss profile.";
          break;
        case Page.Admin:
          title = "Clinic Management | Novogenics Admin";
          description = "Secure clinical administration portal.";
          break;
        case Page.ClientDashboard:
          title = "My Care Portal | Novogenics";
          description = "Your personal hair restoration journey.";
          break;
        case Page.SignIn:
          title = "Sign In | Novogenics Portal";
          break;
        case Page.Register:
          title = "Create Account | Novogenics";
          break;
        case Page.PrivacyPolicy:
          title = "Privacy Policy | Novogenics";
          break;
        case Page.CancellationPolicy:
          title = "Booking Policy | Novogenics";
          break;
      }

      document.title = title;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', description);
      }
    };

    updateSEO();
  }, [currentPage]);

  // Sync state with hash (Initial and Back/Forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as Page;
      const validPage = Object.values(Page).includes(hash) ? hash : Page.Home;
      setCurrentPage(prev => {
        if (prev === validPage) return prev;
        console.log(`Hash changed to: ${validPage}`);
        return validPage;
      });
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial check

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Route Protection & Redirection Logic
  useEffect(() => {
    if (!isAuthReady) return;

    const isAuthPage = currentPage === Page.SignIn || currentPage === Page.Register || currentPage === Page.Assessment;

    // Protection: Admin only
    if (currentPage === Page.Admin && (!currentUser || currentUser.role !== 'admin')) {
      setTimeout(() => navigateTo(Page.SignIn), 0);
      return;
    }

    // Protection: Client only
    if (currentPage === Page.ClientDashboard && (!currentUser || currentUser.role !== 'client')) {
      setTimeout(() => navigateTo(Page.SignIn), 0);
      return;
    }

    // Redirect logged in users away from Auth and Assessment pages
    if (isAuthPage && currentUser) {
      setTimeout(() => {
        if (currentUser.role === 'admin') {
          navigateTo(Page.Admin);
        } else {
          navigateTo(Page.ClientDashboard);
        }
      }, 0);
      return;
    }
  }, [currentUser, currentPage, isAuthReady, navigateTo]);



  const handleCreateAccount = React.useCallback(async (
    password: string, 
    email: string, 
    fullName: string,
    username?: string,
    intakeData?: { fullName: string; email: string; phone: string; dateOfBirth: string; gender?: 'male' | 'female' },
    answers?: Record<string, { text: string; value: string | string[] }>
  ) => {
    const authEmail = email.toLowerCase().trim();
    const normalizedFullName = fullName.trim();
    const displayUsername = username?.trim() || authEmail.split('@')[0];

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
      const uid = userCredential.user.uid;
      
      // Admin Bootstrapping Logic based on Email
      let role: UserRole = 'client';
      let adminType: AdminType | undefined = undefined;

      const adminEmails = [
        'rasheedamer99@gmail.com', 
        'aminah_amer@hotmail.com', 
        'wfarid812@gmail.com',
        'aminah_doctor@novogenics.internal',
        'waqass_doctor@novogenics.internal'
      ];
      
      if (adminEmails.includes(authEmail)) {
        role = 'admin';
        if (authEmail === 'rasheedamer99@gmail.com') {
          adminType = 'technical';
        } else if (authEmail === 'aminah_amer@hotmail.com' || authEmail === 'aminah_doctor@novogenics.internal') {
          adminType = 'doctor-female';
        } else if (authEmail === 'wfarid812@gmail.com' || authEmail === 'waqass_doctor@novogenics.internal') {
          adminType = 'doctor-male';
        }
      }

      const newUser: User = {
        id: uid,
        fullName: normalizedFullName,
        email: authEmail,
        username: displayUsername,
        role: role,
        policiesAccepted: true,
        createdAt: new Date().toISOString()
      };

      if (adminType) {
        newUser.adminType = adminType;
      }
      
      // Save to Firestore
      try {
        await setDoc(doc(db, 'users', uid), cleanData(newUser));
        // Small delay to ensure Firestore is ready before navigation
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
      }

      // If it's a client and we have assessment data, create the client record now
      if (role === 'client' && intakeData && answers) {
        let doctorPreference: 'female-only' | 'ok-with-male' | undefined = undefined;
        if (intakeData.gender === 'male') {
          doctorPreference = 'ok-with-male';
        } else if (answers['f30']) {
          doctorPreference = answers['f30'].value === 'I am okay with being seen by a male doctor' ? 'ok-with-male' : 'female-only';
        }

        const { consultation, conditions } = mapAnswersToConsultation(answers, intakeData.gender || 'female');

        const newClient: Client = {
          id: uid, 
          name: normalizedFullName,
          gender: intakeData.gender || 'female',
          email: authEmail,
          phone: intakeData.phone.trim(),
          dob: intakeData.dateOfBirth,
          status: 'Assessment Submitted',
          policiesAccepted: true,
          createdAt: new Date().toISOString(),
          gallery: getGalleryFromAnswers(answers),
          assessmentData: {
            screening: {
              conditions,
              suitability: 'Pending Review'
            },
            consultation,
            answers: answers
          }
        };

        if (doctorPreference) {
          newClient.doctorPreference = doctorPreference;
        }

        try {
          await setDoc(doc(db, 'clients', uid), cleanData(newClient));
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `clients/${uid}`);
        }

        // Fire welcome notifications for new client
        notifyWelcome(uid, authEmail, normalizedFullName);
        notifyNewAssessment(normalizedFullName, uid, authEmail);
      }
      
      // Manually set current user to avoid race condition with Auth listener
      setCurrentUser(newUser);
      
      // Explicitly navigate to dashboard immediately after setting user
      if (role === 'admin') {
        navigateTo(Page.Admin);
      } else {
        navigateTo(Page.ClientDashboard);
      }
    } catch (error: unknown) {
      console.error('Account creation error:', error);
      throw error;
    }
  }, [navigateTo]);

  const bootstrapAdmins = async () => {
    const admins = [
      {
        username: 'aminah_amer',
        email: 'aminah_amer@hotmail.com',
        fullName: 'Dr Aminah Amer',
        password: 'Novo.2025'
      },
      {
        username: 'waqas_farid',
        email: 'wfarid812@gmail.com',
        fullName: 'Dr Waqas Farid',
        password: 'Novo.2025'
      }
    ];

    for (const admin of admins) {
      try {
        await handleCreateAccount(admin.password, admin.email, admin.fullName, admin.username);
        console.log(`Successfully bootstrapped ${admin.username}`);
      } catch (error) {
        console.error(`Failed to bootstrap ${admin.username}:`, error);
      }
    }
  };

  const handleAcceptPolicies = async () => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, { policiesAccepted: true });
      
      // Also update the client record if it exists
      const clientRef = doc(db, 'clients', currentUser.id);
      const clientDoc = await getDoc(clientRef);
      if (clientDoc.exists()) {
        await updateDoc(clientRef, { policiesAccepted: true });
      }

      // Update local state
      setCurrentUser(prev => prev ? { ...prev, policiesAccepted: true } : null);
    } catch (error) {
      console.error('Failed to accept policies:', error);
    }
  };

  const renderPage = () => {
    console.log("Rendering page:", currentPage);
    switch (currentPage) {
      case Page.Home:
        return <HomePage onNavigate={navigateTo} />;
      case Page.About:
        return <AboutPage onNavigate={navigateTo} />;
      case Page.Treatments:
        return <TreatmentsPage onNavigate={navigateTo} />;
      case Page.Pricing:
        return <PricingPage onNavigate={navigateTo} />;
      case Page.FAQ:
        return <FAQPage />;
      case Page.Blog:
        return <BlogPage onNavigate={navigateTo} />;
      case Page.Contact:
        return <ContactPage />;
      case Page.Assessment:
        return (
          <AssessmentPage 
            onNavigate={navigateTo}
            onIntakeComplete={handleIntakeComplete} 
            onCreateAccount={handleCreateAccount}
          />
        );
      case Page.Admin:
        return (
          <AdminPage 
            user={currentUser} 
            onLogout={handleLogout} 
            onNavigate={navigateTo} 
            clients={clients}
            appointments={appointments}
            messages={messages}
            notifications={notifications}
            onMarkNotificationRead={markNotificationRead}
            onAddAppointment={handleAddAppointment}
            onUpdateAppointment={handleUpdateAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            onSendMessage={handleSendMessage}
            onMarkMessageRead={handleMarkMessageRead}
            onUpdateMessage={handleUpdateMessage}
            onUpdateClient={handleUpdateClient}
            onBootstrapAdmins={bootstrapAdmins}
          />
        );
      case Page.SignIn:
        return <AuthPages onLogin={handleLogin} onNavigate={navigateTo} />;
      case Page.Register:
        return (
          <AssessmentPage 
            onNavigate={navigateTo}
            onIntakeComplete={handleIntakeComplete} 
            onCreateAccount={handleCreateAccount}
          />
        );
      case Page.ClientDashboard:
        return (
          <ClientDashboard 
            user={currentUser} 
            onLogout={handleLogout} 
            onNavigate={navigateTo} 
            appointments={appointments}
            clients={clients}
            messages={messages}
            notifications={notifications}
            onMarkNotificationRead={markNotificationRead}
            onSendMessage={handleSendMessage}
            onMarkMessageRead={handleMarkMessageRead}
            onUpdateMessage={handleUpdateMessage}
            onUpdateClient={handleUpdateClient}
            onAcceptPolicies={handleAcceptPolicies}
          />
        );
      case Page.PrivacyPolicy:
        return <PrivacyPolicyPage />;
      case Page.CancellationPolicy:
        return <CancellationPolicyPage />;
      default:
        return <HomePage onNavigate={navigateTo} />;
    }
  };

  const isDashboard = currentPage === Page.Admin || currentPage === Page.ClientDashboard;
  const isAuthPage = currentPage === Page.SignIn || currentPage === Page.Register;
  const isAssessmentPage = currentPage === Page.Assessment;
  const hideWhatsApp = isDashboard || isAuthPage || isAssessmentPage;

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-soft">
        <div className="flex flex-col items-center gap-6">
          <Logo size="md" className="animate-pulse" />
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted animate-pulse">Initializing Clinical Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen">
        {!isDashboard && !isAuthPage && !isAssessmentPage && <Header currentPage={currentPage} onNavigate={navigateTo} />}
        <main className="flex-grow">
          <Suspense fallback={<PageLoader />}>
            {renderPage()}
          </Suspense>
        </main>
        {!isDashboard && !isAuthPage && !isAssessmentPage && <Footer onNavigate={navigateTo} />}
        {!hideWhatsApp && <WhatsAppWidget />}
        <CookieBanner />
      </div>
    </ErrorBoundary>
  );
};

export default App;