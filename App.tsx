import React, { useState, useEffect, Suspense, lazy, Component, ErrorInfo, ReactNode } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, getDocs, setDoc, query, orderBy, limit, deleteDoc, updateDoc, where, or } from 'firebase/firestore';
import { Page, User, Client, Appointment, Message, GalleryItem, AppNotification, Task, Template } from './types';
import { DUMMY_PATIENT, dummyPatientUser, buildDummyPatientSeed } from './utils/dummyPatient';
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
import {
  captureLeadSourceOnFirstVisit,
  getCapturedLeadSource,
  clearCapturedLeadSource,
} from './utils/marketingService';
import Header from './components/Header';
import Footer from './components/Footer';
import WhatsAppWidget from './components/WhatsAppWidget';
import CookieBanner from './components/CookieBanner';
import Logo from './components/Logo';
import { ToastProvider, notify } from './components/ui';

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
        <div className="min-h-screen flex flex-col items-center justify-center bg-cream p-6 text-center">
          <h1 className="text-2xl font-medium text-obsidian mb-4">Something went wrong</h1>
          <p className="text-muted mb-6 max-w-md">The application encountered an error. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-primary text-white px-8 py-3 rounded-full font-bold uppercase"
          >
            Refresh Page
          </button>
          {import.meta.env.DEV && (
            <pre className="mt-8 p-4 bg-red-50 text-red-600 rounded-lg text-left overflow-auto max-w-full text-xs">
              {this.state.error?.toString()}
              {"\n\n"}
              {this.state.error?.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Lazy load pages for better performance
const AuthPages = lazy(() => import('./pages/AuthPages'));
const AssessmentPage = lazy(() => import('./pages/AssessmentPage'));
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
  const [tasks, setTasks] = useState<Task[]>([]);

  /**
   * Preview mode: admins (Rasheed, Aminah, Waqas) can toggle into the patient
   * portal using the dummy clinic test account, without logging out. Persisted
   * to localStorage so it survives reloads.
   */
  const [viewAsTestPatient, setViewAsTestPatient] = useState<boolean>(() => {
    try { return localStorage.getItem('novogenics_view_as_test_patient') === '1'; }
    catch { return false; }
  });

  // Persist the preview-mode toggle
  useEffect(() => {
    try {
      if (viewAsTestPatient) localStorage.setItem('novogenics_view_as_test_patient', '1');
      else localStorage.removeItem('novogenics_view_as_test_patient');
    } catch { /* localStorage may be unavailable in some browsers */ }
  }, [viewAsTestPatient]);

  /**
   * Tech admin only — seeds (or resets) the dummy patient's Firestore data
   * so every preview session starts from a clean, realistic state.
   * Wipes existing dummy-patient-owned appointments and messages first.
   */
  const handleSeedDummyPatient = async () => {
    if (!currentUser || currentUser.adminType !== 'technical') {
      throw new Error('Only the technical admin can reset the dummy patient.');
    }
    const { client, appointments: apts, messages: msgs } = buildDummyPatientSeed();

    // 1. Upsert client record
    await setDoc(doc(db, 'clients', DUMMY_PATIENT.id), cleanData(client));

    // 2. Wipe existing dummy appointments + reseed with stable IDs
    const existingApts = await getDocs(query(collection(db, 'appointments'), where('clientId', '==', DUMMY_PATIENT.id)));
    await Promise.all(existingApts.docs.map(d => deleteDoc(doc(db, 'appointments', d.id))));
    await Promise.all(apts.map(a => setDoc(doc(db, 'appointments', a.id), cleanData(a))));

    // 3. Wipe existing dummy messages + reseed
    const existingMsgs = await getDocs(query(
      collection(db, 'messages'),
      or(where('senderId', '==', DUMMY_PATIENT.id), where('recipientId', '==', DUMMY_PATIENT.id)),
    ));
    await Promise.all(existingMsgs.docs.map(d => deleteDoc(doc(db, 'messages', d.id))));
    await Promise.all(msgs.map(m => {
      const id = doc(collection(db, 'messages')).id;
      return setDoc(doc(db, 'messages', id), cleanData({ ...m, id }));
    }));
  };
  const [templates, setTemplates] = useState<Template[]>([]);

  // Capture UTM / lead source on first visit so it survives the assessment
  // flow and can be attached to the Client doc on account creation.
  useEffect(() => {
    captureLeadSourceOnFirstVisit();
  }, []);

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
      // Surface to the user (listener terminates on error, so this fires once)
      notify.error('Connection problem', { description: 'Some information may be out of date. Please reload the page.' });
      try { handleFirestoreError(error, OperationType.LIST, path); } catch { /* logged above */ }
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
      // Limit to recent appointments (date >= 90 days ago) to keep reads bounded as clinic grows.
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      q = query(
        collection(db, path),
        where('date', '>=', ninetyDaysAgo),
        orderBy('date', 'desc'),
        limit(500),
      );
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
      notify.error('Connection problem', { description: 'Appointments may be out of date. Please reload the page.' });
      try { handleFirestoreError(error, OperationType.LIST, path); } catch { /* logged above */ }
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
      q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(150));
    } else {
      // OR queries can't combine with orderBy without a composite index;
      // we cap the page and sort in memory. Clients rarely exceed this volume.
      q = query(
        collection(db, path),
        or(
          where('senderId', '==', currentUser.id),
          where('recipientId', '==', currentUser.id)
        ),
        limit(100)
      );
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(messagesData);
    }, (error) => {
      notify.error('Connection problem', { description: 'Messages may be out of date. Please reload the page.' });
      try { handleFirestoreError(error, OperationType.LIST, path); } catch { /* logged above */ }
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

  // Firestore Sync: Tasks (admin-only collection)
  useEffect(() => {
    if (!isAuthReady || !currentUser || currentUser.role !== 'admin') {
      setTasks([]);
      return;
    }
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(data);
    }, (error) => {
      console.error('[Tasks] Subscription error:', error);
    });
    return () => unsubscribe();
  }, [isAuthReady, currentUser]);

  const handleAddTask = async (task: Omit<Task, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!currentUser) return;
    const id = doc(collection(db, 'tasks')).id;
    const newTask: Task = {
      ...task,
      id,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
    };
    try {
      await setDoc(doc(db, 'tasks', id), cleanData(newTask));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `tasks/${id}`);
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    try {
      await setDoc(doc(db, 'tasks', id), cleanData(updates), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  // Firestore Sync: Templates (admin-only)
  useEffect(() => {
    if (!isAuthReady || !currentUser || currentUser.role !== 'admin') {
      setTemplates([]);
      return;
    }
    const q = query(collection(db, 'templates'), orderBy('createdAt', 'desc'), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Template)));
    }, (error) => {
      console.error('[Templates] Subscription error:', error);
    });
    return () => unsubscribe();
  }, [isAuthReady, currentUser]);

  const handleAddTemplate = async (tpl: Omit<Template, 'id' | 'createdAt' | 'createdBy'>) => {
    if (!currentUser) return;
    const id = doc(collection(db, 'templates')).id;
    try {
      await setDoc(doc(db, 'templates', id), cleanData({
        ...tpl,
        id,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `templates/${id}`);
    }
  };

  const handleUpdateTemplate = async (id: string, updates: Partial<Template>) => {
    try {
      await setDoc(doc(db, 'templates', id), cleanData({ ...updates, updatedAt: new Date().toISOString() }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `templates/${id}`);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'templates', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `templates/${id}`);
    }
  };

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

      // Reschedules: when the date or time changes, tell the patient the new
      // slot (fire-and-forget, mirrors the create path). Status-only updates
      // (Completed/Cancelled) never carry date/time, so they don't trigger this.
      if (updates.date || updates.time) {
        const appt = appointments.find(a => a.id === id);
        const client = appt ? clients.find(c => c.id === appt.clientId) : undefined;
        if (appt && client) {
          notifyAppointmentConfirmed(
            client.id,
            client.email,
            client.name,
            appt.type,
            updates.date ?? appt.date,
            updates.time ?? appt.time,
          );
        }
      }

      // Auto-sync: when an appointment is marked Completed, increment the
      // active treatment-plan phase's sessionsCompleted counter for the patient.
      // Closes the silent-drift bug where doctors had to remember to bump
      // the phase counter manually.
      if (updates.status === 'Completed') {
        const appt = appointments.find(a => a.id === id);
        if (appt) {
          const wasNotCompleted = appt.status !== 'Completed';
          if (wasNotCompleted) {
            const client = clients.find(c => c.id === appt.clientId);
            const plan = client?.treatmentPlan;
            if (plan && plan.phases?.length) {
              // Active phase = first 'Active' phase, else first non-'Completed' phase
              const activeIdx = plan.phases.findIndex(p => p.status === 'Active');
              const phaseIdx = activeIdx >= 0
                ? activeIdx
                : plan.phases.findIndex(p => p.status !== 'Completed');
              if (phaseIdx >= 0) {
                const phase = plan.phases[phaseIdx];
                const newCompleted = (phase.sessionsCompleted || 0) + 1;
                const updatedPhases = [...plan.phases];
                updatedPhases[phaseIdx] = {
                  ...phase,
                  sessionsCompleted: newCompleted,
                  // Auto-mark phase Completed if all planned sessions are done
                  status: newCompleted >= phase.sessionsPlanned ? 'Completed' : phase.status,
                };
                const updatedPlan = { ...plan, phases: updatedPhases, updatedAt: new Date().toISOString() };
                await setDoc(
                  doc(db, 'clients', appt.clientId),
                  cleanData({ treatmentPlan: updatedPlan }),
                  { merge: true },
                );
              }
            }
          }
        }
      }
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
      const pendingAssessmentMatch = sessionStorage.getItem('pendingAssessment') || localStorage.getItem('pendingAssessment');
      if (pendingAssessmentMatch) {
        try {
          const pendingData = JSON.parse(pendingAssessmentMatch);
          // Expire health data after 30 minutes (GDPR data minimisation)
          const THIRTY_MINUTES = 30 * 60 * 1000;
          if (pendingData._storedAt && Date.now() - pendingData._storedAt > THIRTY_MINUTES) {
            sessionStorage.removeItem('pendingAssessment');
            localStorage.removeItem('pendingAssessment');
            throw new Error('Pending assessment expired');
          }
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
          sessionStorage.removeItem('pendingAssessment');
          localStorage.removeItem('pendingAssessment'); // clean up legacy storage
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
        return validPage;
      });
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial check

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Route Protection & Redirection Logic
  // Navigation calls are deferred via queueMicrotask so they always run after
  // the current React commit, avoiding setState-during-render warnings while
  // staying off the macrotask queue (no UI flash like setTimeout(0) caused).
  useEffect(() => {
    if (!isAuthReady) return;

    const isAuthPage = currentPage === Page.SignIn || currentPage === Page.Register || currentPage === Page.Assessment;
    const defer = (fn: () => void) => queueMicrotask(fn);

    if (currentPage === Page.Admin && (!currentUser || currentUser.role !== 'admin')) {
      defer(() => navigateTo(Page.SignIn));
      return;
    }

    if (currentPage === Page.ClientDashboard && (!currentUser || currentUser.role !== 'client')) {
      defer(() => navigateTo(Page.SignIn));
      return;
    }

    if (isAuthPage && currentUser) {
      defer(() => navigateTo(currentUser.role === 'admin' ? Page.Admin : Page.ClientDashboard));
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

      const newUser: User = {
        id: uid,
        fullName: normalizedFullName,
        email: authEmail,
        username: displayUsername,
        role: 'client',
        policiesAccepted: true,
        createdAt: new Date().toISOString()
      };
      
      // Save to Firestore
      try {
        await setDoc(doc(db, 'users', uid), cleanData(newUser));
        // Small delay to ensure Firestore is ready before navigation
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
      }

      // Create client record if assessment data is present
      if (intakeData && answers) {
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

        // Attach first-touch attribution (UTM + referrer) captured when the
        // visitor first landed. Drives the Marketing tab's funnel reporting.
        const leadSource = getCapturedLeadSource();
        if (leadSource) {
          newClient.leadSource = leadSource;
        }

        try {
          await setDoc(doc(db, 'clients', uid), cleanData(newClient));
          // Clear so a future visit by the same browser starts a fresh capture.
          clearCapturedLeadSource();
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `clients/${uid}`);
        }

        // Fire welcome notifications for new client
        notifyWelcome(uid, authEmail, normalizedFullName);
        notifyNewAssessment(normalizedFullName, uid, authEmail);
      }
      
      // Manually set current user to avoid race condition with Auth listener
      setCurrentUser(newUser);
      navigateTo(Page.ClientDashboard);
    } catch (error: unknown) {
      console.error('Account creation error:', error);
      throw error;
    }
  }, [navigateTo, mapAnswersToConsultation, getGalleryFromAnswers]);

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
        // Preview mode: render ClientDashboard with the dummy patient,
        // overlaid with a sticky "Exit preview" banner. Admin auth is
        // unchanged — we just swap the rendered surface.
        if (viewAsTestPatient && currentUser?.role === 'admin') {
          return (
            <div className="relative">
              <div className="fixed top-0 left-0 right-0 z-[200] bg-obsidian text-white px-4 py-2 flex items-center justify-between text-sm shadow-panel">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-primary/15 text-primary text-xs">
                    Preview
                  </span>
                  <span className="text-white/80 truncate">
                    Viewing as <span className="text-white font-medium">{DUMMY_PATIENT.fullName}</span> · signed in as {currentUser.fullName}
                  </span>
                </div>
                <button
                  onClick={() => setViewAsTestPatient(false)}
                  className="text-xs text-white/80 hover:text-white border border-white/20 hover:border-white/40 rounded-sm px-2.5 py-1 transition-colors shrink-0"
                >
                  Exit preview
                </button>
              </div>
              <div className="pt-10">
                <ClientDashboard
                  user={dummyPatientUser}
                  onLogout={() => setViewAsTestPatient(false)}
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
              </div>
            </div>
          );
        }
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
            tasks={tasks}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            templates={templates}
            onAddTemplate={handleAddTemplate}
            onUpdateTemplate={handleUpdateTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            viewAsTestPatient={viewAsTestPatient}
            onSetViewAsTestPatient={setViewAsTestPatient}
            onSeedDummyPatient={handleSeedDummyPatient}
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
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-6">
          <Logo size="md" className="animate-pulse" />
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted animate-pulse">Initializing Clinical Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
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
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;