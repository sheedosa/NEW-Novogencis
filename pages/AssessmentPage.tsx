import React, { useState, useMemo, useRef } from 'react';
import { Page } from '../types';
import { ShieldCheck, X, User, FileUp, Camera, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import { storage, auth } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { processImageForUpload, validateImageFile, ACCEPTED_IMAGE_TYPES } from '../imageUtils';

interface Question {
  id: string;
  text: string;
  type: 'radio' | 'checkbox' | 'text' | 'textarea' | 'date' | 'file';
  options?: string[];
  category?: string;
  gender?: 'male' | 'female' | 'both';
}

interface AssessmentPageProps {
  onNavigate?: (page: Page) => void;
  onIntakeComplete: () => string | Promise<string>;
  onCreateAccount: (
    password: string, 
    email: string, 
    fullName: string,
    username?: string,
    intakeData?: { fullName: string; email: string; phone: string; dateOfBirth: string; gender?: 'male' | 'female' },
    answers?: Record<string, { text: string; value: string | string[] }>
  ) => Promise<void>;
}

type Phase = 'gender' | 'assessment' | 'intake';

const AssessmentPage: React.FC<AssessmentPageProps> = ({ onNavigate, onIntakeComplete, onCreateAccount }) => {
  const [phase, setPhase] = useState<Phase>('gender');
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [genderSelected, setGenderSelected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  
  const [accountForm, setAccountForm] = useState({
    password: ''
  });
  
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '--',
    email: '',
    phone: '',
    city: '',
    agreedToPrivacy: false
  });

  const [answers, setAnswers] = useState<Record<string, { text: string; value: string | string[] }>>({});
  const [uploading, setUploading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0')), []);
  const months = useMemo(() => [
    { value: '01', label: 'Jan' },
    { value: '02', label: 'Feb' },
    { value: '03', label: 'Mar' },
    { value: '04', label: 'Apr' },
    { value: '05', label: 'May' },
    { value: '06', label: 'Jun' },
    { value: '07', label: 'Jul' },
    { value: '08', label: 'Aug' },
    { value: '09', label: 'Sep' },
    { value: '10', label: 'Oct' },
    { value: '11', label: 'Nov' },
    { value: '12', label: 'Dec' },
  ], []);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 100 }, (_, i) => (currentYear - i).toString());
  }, []);

  const femaleQuestions: Question[] = [
    { id: 'f1', category: 'Hair Loss Details', text: 'Where is your main area of hair thinning or hair loss?', type: 'checkbox', options: ['Hairline', 'Frontal scalp', 'Parting', 'Crown / Vertex', 'Diffuse thinning across the scalp', 'Unsure'] },
    { id: 'f2', category: 'Hair Loss Details', text: 'How long have you been experiencing hair thinning or hair loss?', type: 'radio', options: ['Less than 3 months', '3–6 months', '6–12 months', '1–3 years', 'More than 3 years'] },
    { id: 'f3', category: 'Hair Loss Details', text: 'How did the hair loss begin?', type: 'radio', options: ['Suddenly (within weeks)', 'Gradually (over several months)', 'After an illness', 'After pregnancy', 'Unsure'] },
    { id: 'f4', category: 'Possible Triggers', text: 'Did your hair loss begin around any of the following events?', type: 'checkbox', options: ['Major illness or infection', 'Covid-19 infection', 'Childbirth / postpartum', 'High stress period', 'Surgery', 'Rapid weight loss or crash dieting', 'Iron deficiency', 'Starting a new medication', 'Hormonal changes', 'None that I can identify', 'Other'] },
    { id: 'f5', category: 'Hair Loss Pattern', text: 'How would you describe your current hair loss pattern?', type: 'radio', options: ['Stable', 'Gradually worsening', 'Progressive thinning over time', 'Fluctuating (periods of improvement and worsening)', 'Sudden excessive shedding', 'Patchy hair loss'] },
    { id: 'f6', category: 'Previous Treatments', text: 'Have you previously tried any treatments for hair loss?', type: 'checkbox', options: ['Topical treatments (Minoxidil / Finasteride / other)', 'Oral Minoxidil', 'Oral DHT-blocking medication (Finasteride / Dutasteride / Spironolactone)', 'PRP or Exosome treatments', 'Hair transplant', 'Steroid scalp injections', 'Supplements', 'Microneedling', 'No previous treatment'] },
    { id: 'f7', category: 'Previous Treatments', text: 'How did your hair respond to previous treatments?', type: 'radio', options: ['Significant improvement', 'Mild improvement', 'No improvement', 'Unsure', 'Stopped treatment early', 'Not applicable'] },
    { id: 'f8', category: 'Medical History', text: 'Have you been diagnosed with any of the following medical conditions?', type: 'checkbox', options: ['Polycystic Ovarian Syndrome (PCOS)', 'Diabetes (Type 1 or Type 2)', 'Underactive thyroid (Hypothyroidism)', 'Overactive thyroid (Hyperthyroidism)', 'Anaemia', 'Vitamin D deficiency', 'Autoimmune condition', 'Previous deep vein thrombosis (DVT) or pulmonary embolism (PE)', 'Previous cancer diagnosis', 'Mental health condition', 'Other medical condition', 'None'] },
    { id: 'f9', category: 'Scalp Symptoms', text: 'Have you noticed any of the following scalp or hair symptoms?', type: 'checkbox', options: ['Sudden bald patches', 'Sudden rapid shedding', 'Painful or tender scalp', 'Itching or burning sensation', 'Redness of the scalp', 'Flaking or scaling', 'Pus, discharge, or unpleasant odour', 'Bleeding spots on the scalp', 'Scarring or shiny bald areas', 'None of the above'] },
    { id: 'f10', category: 'Family History', text: 'Does anyone in your family have hair thinning or hair loss?', type: 'radio', options: ['Yes — female relatives', 'Yes — male relatives', 'No', 'Unsure'] },
    { id: 'f11', category: 'Medications', text: 'Are you currently taking any medications?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'f12', category: 'Supplements', text: 'Do you take any of the following supplements?', type: 'checkbox', options: ['Iron', 'Vitamin D', 'Zinc', 'Biotin', 'Collagen', 'Other supplements', 'None'] },
    { id: 'f13', category: 'Allergies', text: 'Do you have any known allergies?', type: 'checkbox', options: ['Medications', 'Latex', 'Local anaesthetic', 'Nickel', 'Other', 'None'] },
    { id: 'f14', category: 'Female Health', text: 'Do you have regular menstrual cycles?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'f15', category: 'Female Health', text: 'Do you experience heavy menstrual bleeding?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'f16', category: 'Female Health', text: 'Are you currently breastfeeding?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'f17', category: 'Female Health', text: 'Are you currently trying to conceive?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'f18', category: 'Blood Test History', text: 'Have you had any of the following blood tests recently?', type: 'checkbox', options: ['Full Blood Count', 'Ferritin', 'Vitamin D', 'Thyroid profile', 'B12 and Folate', 'Hormone panel', 'HbA1c', 'Other blood tests', 'None'] },
    { id: 'f19', category: 'Hair Care Routine', text: 'Do any of the following apply to your hair care routine?', type: 'checkbox', options: ['I wear a hijab', 'I regularly wear tight hairstyles', 'I use chemical hair treatments (dye, bleach, keratin)', 'I frequently use heat styling tools', 'I use medicated shampoos', 'None of the above'] },
    { id: 'f20', category: 'Lifestyle', text: 'Do you smoke?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'f21', category: 'Lifestyle', text: 'How often do you consume alcohol?', type: 'radio', options: ['None', 'Occasionally', 'Moderately', 'Frequently'] },
    { id: 'f22', category: 'Lifestyle', text: 'How would you rate your stress levels?', type: 'radio', options: ['Low', 'Moderate', 'High'] },
    { id: 'f23', category: 'Lifestyle', text: 'How often do you exercise?', type: 'radio', options: ['Regularly', 'Occasionally', 'Rarely'] },
    { id: 'f24', category: 'Lifestyle', text: 'How would you rate your sleep quality?', type: 'radio', options: ['Good', 'Average', 'Poor'] },
    { id: 'f25', category: 'Lifestyle', text: 'Have you experienced a major life stressor recently?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'f26', category: 'Photo Upload', text: 'Please upload clear photos of your hair and scalp if possible.', type: 'file' },
    { id: 'f27', category: 'Treatment Goals', text: 'What are your main goals for treatment?', type: 'checkbox', options: ['Reduce hair shedding', 'Improve hair density', 'Thicken existing hair', 'Improve hairline appearance', 'Improve the appearance of the hair parting', 'Slow genetic hair loss', 'Long-term hair maintenance', 'Unsure'] },
    { id: 'f28', category: 'Treatment Goals', text: 'What results are you hoping to see from treatment?', type: 'radio', options: ['Slight improvement', 'Moderate improvement', 'Significant regrowth', 'I am unsure'] },
    { id: 'f29', category: 'Treatment Goals', text: 'Are you hoping to see improvement within a specific timeframe?', type: 'radio', options: ['No specific timeline', 'Within 3 months', 'Within 6 months', 'Before a specific event'] },
    { id: 'f30', category: 'Doctor Preference', text: 'Do you require a female Dr only or are you okay with being seen by a male Dr?', type: 'radio', options: ['I require a female doctor only', 'I am okay with being seen by a male doctor'] },
  ];

  const maleQuestions: Question[] = [
    { id: 'm1', category: 'Hair Loss Details', text: 'Where is your main area of hair thinning or hair loss?', type: 'checkbox', options: ['Hairline', 'Frontal scalp', 'Crown / Vertex', 'Diffuse thinning', 'Unsure'] },
    { id: 'm2', category: 'Hair Loss Details', text: 'How long have you been experiencing hair thinning or hair loss?', type: 'radio', options: ['Less than 3 months', '3–6 months', '6–12 months', '1–3 years', 'More than 3 years'] },
    { id: 'm3', category: 'Hair Loss Details', text: 'How did the hair loss begin?', type: 'radio', options: ['Suddenly', 'Gradually', 'After illness', 'Unsure'] },
    { id: 'm4', category: 'Possible Triggers', text: 'Did your hair loss begin around any of the following?', type: 'checkbox', options: ['Major illness or infection', 'Covid-19 infection', 'High stress period', 'Surgery', 'Rapid weight loss or dieting', 'Iron deficiency', 'Starting a new medication', 'None that I can identify', 'Other'] },
    { id: 'm5', category: 'Hair Loss Pattern', text: 'How would you describe your current hair loss pattern?', type: 'radio', options: ['Stable', 'Gradually worsening', 'Progressive thinning', 'Fluctuating', 'Sudden shedding', 'Patchy hair loss'] },
    { id: 'm6', category: 'Previous Treatments', text: 'Have you previously tried any hair loss treatments?', type: 'checkbox', options: ['Topical treatments (Minoxidil / Finasteride / other)', 'Oral Minoxidil', 'Oral Finasteride or Dutasteride', 'PRP or Exosome treatments', 'Hair transplant', 'Steroid injections', 'Supplements', 'Microneedling', 'No previous treatment'] },
    { id: 'm7', category: 'Previous Treatments', text: 'How did your hair respond to previous treatments?', type: 'radio', options: ['Significant improvement', 'Mild improvement', 'No improvement', 'Unsure', 'Stopped treatment early', 'Not applicable'] },
    { id: 'm8', category: 'Medical History', text: 'Have you been diagnosed with any of the following?', type: 'checkbox', options: ['Diabetes', 'Underactive thyroid', 'Overactive thyroid', 'Anaemia', 'Vitamin D deficiency', 'Autoimmune condition', 'Previous DVT or pulmonary embolism', 'Previous cancer diagnosis', 'Mental health condition', 'Other medical condition', 'None'] },
    { id: 'm9', category: 'Scalp Symptoms', text: 'Have you noticed any of the following scalp symptoms?', type: 'checkbox', options: ['Sudden bald patches', 'Rapid shedding', 'Painful scalp', 'Itching or burning', 'Redness', 'Flaking or scaling', 'Discharge or odour', 'Bleeding spots', 'Scarring or shiny scalp', 'None'] },
    { id: 'm10', category: 'Family History', text: 'Does anyone in your family have hair thinning or hair loss?', type: 'radio', options: ['Yes — male relatives', 'Yes — female relatives', 'No', 'Unsure'] },
    { id: 'm11', category: 'Medications', text: 'Are you currently taking any medications?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'm12', category: 'Supplements', text: 'Do you take any of the following supplements?', type: 'checkbox', options: ['Iron', 'Vitamin D', 'Zinc', 'Biotin', 'Collagen', 'Other', 'None'] },
    { id: 'm13', category: 'Allergies', text: 'Do you have any known allergies?', type: 'checkbox', options: ['Medications', 'Latex', 'Local anaesthetic', 'Nickel', 'Other', 'None'] },
    { id: 'm14', category: 'Blood Test History', text: 'Have you had any of the following blood tests recently?', type: 'checkbox', options: ['Full Blood Count', 'Ferritin', 'Vitamin D', 'Thyroid profile', 'B12 and Folate', 'Hormone panel', 'HbA1c', 'Other blood tests', 'None'] },
    { id: 'm15', category: 'Hair Care Routine', text: 'Do any of the following apply to your hair care routine?', type: 'checkbox', options: ['Tight hairstyles', 'Chemical treatments', 'Heat styling tools', 'Medicated shampoos', 'None of the above'] },
    { id: 'm16', category: 'Lifestyle', text: 'Do you smoke?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'm17', category: 'Lifestyle', text: 'How often do you consume alcohol?', type: 'radio', options: ['None', 'Occasionally', 'Moderately', 'Frequently'] },
    { id: 'm18', category: 'Lifestyle', text: 'How would you rate your stress levels?', type: 'radio', options: ['Low', 'Moderate', 'High'] },
    { id: 'm19', category: 'Lifestyle', text: 'How often do you exercise?', type: 'radio', options: ['Regularly', 'Occasionally', 'Rarely'] },
    { id: 'm20', category: 'Lifestyle', text: 'How would you rate your sleep quality?', type: 'radio', options: ['Good', 'Average', 'Poor'] },
    { id: 'm21', category: 'Lifestyle', text: 'Have you experienced a major life stressor recently?', type: 'radio', options: ['Yes', 'No'] },
    { id: 'm22', category: 'Photo Upload', text: 'Please upload clear photos of your hair if possible.', type: 'file' },
    { id: 'm23', category: 'Treatment Goals', text: 'What are your main goals for treatment?', type: 'checkbox', options: ['Reduce shedding', 'Improve hair density', 'Thicken existing hair', 'Improve hairline appearance', 'Slow genetic hair loss', 'Long-term maintenance', 'Unsure'] },
    { id: 'm24', category: 'Treatment Goals', text: 'What results are you hoping to see?', type: 'radio', options: ['Slight improvement', 'Moderate improvement', 'Significant regrowth', 'Unsure'] },
    { id: 'm25', category: 'Treatment Goals', text: 'Are you hoping to see improvement within a specific timeframe?', type: 'radio', options: ['No specific timeline', 'Within 3 months', 'Within 6 months', 'Before a specific event'] },
  ];

  const currentQuestions = gender === 'female' ? femaleQuestions : maleQuestions;
  const currentQuestion = currentQuestions[step];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleDOBChange = (part: 'day' | 'month' | 'year', value: string) => {
    setFormData(prev => {
      const parts = prev.dateOfBirth.split('-');
      let y = parts[0] || '';
      let m = parts[1] || '';
      let d = parts[2] || '';

      if (part === 'year') y = value;
      if (part === 'month') m = value;
      if (part === 'day') d = value;

      return { ...prev, dateOfBirth: `${y}-${m}-${d}` };
    });
  };

  const handleGenderSelect = (g: 'male' | 'female') => {
    setGender(g);
    setGenderSelected(true);
  };

  const handleSelectOption = (questionId: string, option: string) => {
    setAnswers(prev => ({ 
      ...prev, 
      [questionId]: { 
        text: currentQuestions.find(q => q.id === questionId)?.text || '', 
        value: option 
      } 
    }));
  };

  const handleToggleCheckbox = (questionId: string, option: string) => {
    setAnswers(prev => {
      const current = (prev[questionId]?.value as string[]) || [];
      const newValue = current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option];
      
      return { 
        ...prev, 
        [questionId]: { 
          text: currentQuestions.find(q => q.id === questionId)?.text || '', 
          value: newValue 
        } 
      };
    });
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    setUploading(true);
    setError('');
    try {
      // Ensure the user is signed in (anonymously if not already) so the
      // storage rule's `isAuthenticated()` + `isOwner(uid)` check passes.
      // If anonymous auth is disabled on the project we surface a clear
      // message rather than the cryptic Firebase security popup.
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (authErr) {
          const code = (authErr as { code?: string })?.code;
          if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
            throw new Error(
              "We couldn't start a secure upload session. " +
              'Please complete the rest of the assessment, create your account, ' +
              'and upload your photos from your patient portal.',
            );
          }
          throw authErr;
        }
      }

      const uid = auth.currentUser?.uid;
      if (!uid) {
        throw new Error('Sign-in did not complete. Please try again.');
      }

      const { blob, fileName } = await processImageForUpload(file);
      // Path uses the actual authenticated UID so the storage rule's
      // isOwner(clientId) branch matches deterministically — no regex needed.
      const storagePath = `assessments/${uid}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed',
          () => {},
          (error) => reject(error),
          () => resolve()
        );
      });

      const url = await getDownloadURL(storageRef);

      setAnswers(prev => {
        const currentQuestionId = currentQuestions[step].id;
        const currentUrls = (prev[currentQuestionId]?.value as string[]) || [];
        return {
          ...prev,
          [currentQuestionId]: {
            text: currentQuestions[step].text,
            value: [...currentUrls, url]
          }
        };
      });
      alert('Photo uploaded successfully.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message :
        (err as { message?: string })?.message ||
        'Failed to upload image. Please try again.';
      console.error('Upload error:', err);
      alert(message);
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please ensure you have granted permission.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            await handleFileUpload(file);
            stopCamera();
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const handleNext = async () => {
    if (phase === 'gender') {
      const id = await onIntakeComplete();
      setClientId(id);
      setPhase('assessment');
      setStep(0);
    } else if (phase === 'assessment') {
      if (step < currentQuestions.length - 1) {
        setStep(prev => prev + 1);
        // Scroll internal container to top
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        setPhase('intake');
      }
    }
  };

  const handleBack = () => {
    if (phase === 'assessment') {
      if (step > 0) {
        setStep(prev => prev - 1);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        setPhase('gender');
      }
    } else if (phase === 'intake') {
      setPhase('assessment');
    }
  };

  const isDOBComplete = useMemo(() => {
    const parts = formData.dateOfBirth.split('-');
    return parts.length === 3 && parts.every(p => p.length > 0);
  }, [formData.dateOfBirth]);

  const isValidEmail = useMemo(() => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(formData.email);
  }, [formData.email]);

  const isValidUKPhone = useMemo(() => {
    // Matches standard UK mobile and landline formats
    const phoneRegex = /^(?:(?:\+44\s?|0)(?:1\d{8,9}|2\d{8,9}|3\d{8,9}|7\d{9}))$/;
    // Remove spaces for testing
    return phoneRegex.test(formData.phone.replace(/\s/g, ''));
  }, [formData.phone]);

  const isIntakeValid = useMemo(() => {
    return !!(
      formData.fullName && 
      isDOBComplete && 
      isValidEmail && 
      isValidUKPhone && 
      formData.city && 
      formData.agreedToPrivacy && 
      genderSelected
    );
  }, [formData, genderSelected, isDOBComplete, isValidEmail, isValidUKPhone]);

  const isStepValid = (() => {
    if (phase === 'gender') return genderSelected;
    if (phase === 'intake') return isIntakeValid && accountForm.password.length >= 6;
    if (!currentQuestion) return true;
    const answer = answers[currentQuestion.id];
    if (currentQuestion.type === 'checkbox') return (answer?.value as string[])?.length > 0;
    if (currentQuestion.type === 'file') return (answer?.value as string[])?.length > 0;
    return !!answer?.value;
  })();

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onCreateAccount(
        accountForm.password, 
        formData.email, 
        formData.fullName,
        undefined, // username is now optional and derived from email if not provided
        { ...formData, gender },
        answers
      );
      setAccountCreated(true);
    } catch (err: unknown) {
      const authError = err as { code?: string };
      if (authError.code === 'auth/email-already-in-use') {
        localStorage.setItem('pendingAssessment', JSON.stringify({ answers, formData, gender }));
        setError('email_exists'); // Use a specific error state
      } else if (authError.code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else {
        setError('A clinical configuration error occurred. Please contact the clinic for assistance.');
      }
      setLoading(false);
    }
  };

  if (accountCreated) {
    return (
      <div className="animate-fade-in bg-cream h-screen w-screen fixed inset-0 flex flex-col items-center justify-center p-4 overflow-hidden">
        <div className="max-w-2xl w-full bg-white rounded-[2rem] md:rounded-[2.5rem] p-8 md:p-20 shadow-2xl border border-black/5 text-center space-y-6">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
            <ShieldCheck size={36} />
          </div>
          <h2 className="text-2xl md:text-5xl font-medium tracking-tight leading-tight uppercase">Account Created</h2>
          <p className="text-muted text-base md:text-xl leading-relaxed">
            Your clinical portal is now active. You can access your dashboard immediately to view your assessment status.
          </p>
          <div className="pt-6">
            <button 
              onClick={() => onNavigate ? onNavigate(Page.ClientDashboard) : window.location.hash = 'client-dashboard'}
              className="w-full sm:w-auto bg-primary text-white px-12 py-5 rounded-full font-medium text-xs md:text-sm uppercase shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
            >
              Go to My Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="animate-fade-in bg-cream h-screen w-screen fixed inset-0 flex flex-col items-center justify-center p-0 md:p-6 overflow-hidden">
      {/* Exit Button */}
      <button 
        onClick={() => window.location.hash = 'home'}
        className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 bg-white/80 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-muted hover:text-primary transition-all z-50 border border-black/5"
        title="Exit Assessment"
      >
        <X size={20} />
      </button>

      <div className="w-full max-w-[1200px] mx-auto flex flex-col h-full md:h-auto max-h-screen">
        <div className="text-center mb-4 md:mb-10 px-4 pt-8 md:pt-0 flex-shrink-0">
          <span className="text-primary font-medium text-[10px] md:text-xs uppercase tracking-[0.4em] block mb-1 md:mb-2">
            {phase === 'gender' ? 'Free Instant Hair Assessment' : phase === 'intake' ? 'Almost Done' : `Step ${step + 1} of ${currentQuestions.length}`}
          </span>
          <h1 className="text-xl md:text-5xl font-medium text-obsidian tracking-tight leading-tight mb-1">
            {phase === 'gender' ? 'Start Your ' : ''}
            <span className="text-primary italic font-serif">
              {phase === 'gender' ? 'Assessment' : phase === 'intake' ? 'Get Your Results' : currentQuestion?.category || 'Clinical Assessment'}
            </span>
          </h1>
          {phase === 'gender' && (
            <p className="text-muted text-[10px] md:text-lg max-w-2xl mx-auto font-medium hidden sm:block">
              A quick screening to determine your suitability for regenerative hair restoration treatments.
            </p>
          )}
          {phase === 'intake' && (
            <p className="text-muted text-[10px] md:text-lg max-w-2xl mx-auto font-medium hidden sm:block">
              Create your secure clinical portal to view your assessment results and recommendations.
            </p>
          )}
        </div>

        <div id="assessment-card" className="w-full max-w-[700px] mx-auto bg-white md:rounded-[2.5rem] shadow-2xl border-t md:border border-black/5 overflow-hidden flex flex-col flex-grow md:flex-grow-0 h-full md:max-h-[80vh]">
          {phase === 'assessment' && (
            <div className="w-full h-1 md:h-2 bg-cream flex-shrink-0">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ width: `${((step + 1) / currentQuestions.length) * 100}%` }}
              />
            </div>
          )}
          
          <div ref={scrollContainerRef} className="p-5 md:p-12 overflow-y-auto flex-grow custom-scrollbar">
            {phase === 'assessment' && currentQuestion && (
              <div className="mb-5 md:mb-8">
                <h2 className="text-lg md:text-2xl font-bold text-obsidian leading-tight">
                  {currentQuestion.text}
                </h2>
              </div>
            )}

            {phase === 'gender' ? (
              <div className="space-y-6 flex flex-col items-center justify-center h-full min-h-[40vh]">
                <h2 className="text-xl md:text-2xl font-bold text-obsidian mb-4">Are you completing this assessment for a male or female?</h2>
                <div className="flex w-full gap-4 max-w-md">
                  {(['male', 'female'] as const).map(g => (
                    <button 
                      key={g} onClick={() => handleGenderSelect(g)}
                      className={`flex-1 py-8 md:py-10 rounded-2xl font-medium uppercase text-sm md:text-base border-2 transition-all flex flex-col items-center justify-center ${gender === g && genderSelected ? 'border-primary bg-primary/5 text-primary scale-105' : 'border-gray-100 text-muted hover:border-primary/30 hover:bg-gray-50'}`}
                    >
                      <User size={30} className="mb-2" />
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            ) : phase === 'intake' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-obsidian uppercase ml-1">Full Name*</label>
                    <input 
                      type="text" name="fullName" value={formData.fullName} onChange={handleInputChange}
                      className="w-full bg-cream border-none rounded-xl md:rounded-2xl px-5 md:px-6 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-bold" 
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium text-obsidian uppercase ml-1">Date of Birth*</label>
                      <div className="grid grid-cols-3 gap-2">
                        <select 
                          value={formData.dateOfBirth.split('-')[2] || ''} 
                          onChange={(e) => handleDOBChange('day', e.target.value)}
                          className="w-full bg-cream border-none rounded-xl md:rounded-2xl px-3 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-bold cursor-pointer"
                        >
                          <option value="" disabled>Day</option>
                          {days.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select 
                          value={formData.dateOfBirth.split('-')[1] || ''} 
                          onChange={(e) => handleDOBChange('month', e.target.value)}
                          className="w-full bg-cream border-none rounded-xl md:rounded-2xl px-3 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-bold cursor-pointer"
                        >
                          <option value="" disabled>Month</option>
                          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <select 
                          value={formData.dateOfBirth.split('-')[0] || ''} 
                          onChange={(e) => handleDOBChange('year', e.target.value)}
                          className="w-full bg-cream border-none rounded-xl md:rounded-2xl px-3 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-bold cursor-pointer"
                        >
                          <option value="" disabled>Year</option>
                          {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium text-obsidian uppercase ml-1">City (UK)*</label>
                      <input 
                        type="text" name="city" value={formData.city} onChange={handleInputChange}
                        className="w-full bg-cream border-none rounded-xl md:rounded-2xl px-4 md:px-5 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-bold" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-obsidian uppercase ml-1">Email Address*</label>
                    <input 
                      type="email" name="email" value={formData.email} onChange={handleInputChange}
                      className={`w-full bg-cream border-2 rounded-xl md:rounded-2xl px-5 md:px-6 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-bold transition-all ${formData.email && !isValidEmail ? 'border-red-500/50 bg-red-50/30' : 'border-transparent'}`} 
                      placeholder="e.g. name@example.com"
                    />
                    {formData.email && !isValidEmail && (
                      <span className="text-[10px] font-medium text-red-500 uppercase ml-1">Please enter a valid clinical email</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-obsidian uppercase ml-1">Phone Number*</label>
                    <input 
                      type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                      className={`w-full bg-cream border-2 rounded-xl md:rounded-2xl px-5 md:px-6 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-bold transition-all ${formData.phone && !isValidUKPhone ? 'border-red-500/50 bg-red-50/30' : 'border-transparent'}`} 
                      placeholder="e.g. 07123 456789"
                    />
                    {formData.phone && !isValidUKPhone && (
                      <span className="text-[10px] font-medium text-red-500 uppercase ml-1">Please enter a valid UK phone number</span>
                    )}
                  </div>
                  
                  {/* Password Field Integration */}
                  <div className="space-y-2 border-t border-gray-100 pt-4 mt-2">
                    <label className="text-[10px] font-medium text-obsidian uppercase ml-1">Create Password to Access Results*</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required
                        value={accountForm.password}
                        onChange={(e) => setAccountForm(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full bg-cream border-transparent rounded-xl md:rounded-2xl px-5 md:px-6 py-3.5 md:py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all pr-12"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {accountForm.password && accountForm.password.length < 6 && (
                      <span className="text-[10px] font-medium text-red-500 uppercase ml-1">Password must be at least 6 characters</span>
                    )}
                  </div>
                </div>

                {error && error === 'email_exists' ? (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-[10px] font-bold uppercase p-5 rounded-2xl text-center space-y-4">
                    <p>An account with this email already exists.</p>
                    <button 
                      type="button"
                      onClick={() => onNavigate ? onNavigate(Page.SignIn) : window.location.hash = 'signin'}
                      className="w-full bg-yellow-400 text-yellow-900 py-3 rounded-xl shadow-sm hover:scale-105 transition-transform"
                    >
                      Sign In to Save Assessment
                    </button>
                  </div>
                ) : error ? (
                  <div className="bg-red-50 text-red-500 text-2xs font-medium text-hint p-4 rounded-xl text-center">
                    {error}
                  </div>
                ) : null}

                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" name="agreedToPrivacy" checked={formData.agreedToPrivacy} onChange={handleInputChange}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-[10px] font-bold text-muted leading-relaxed uppercase tracking-tight">I agree to the Privacy Policy and clinical data processing.</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4 md:space-y-8">
                <div className="grid grid-cols-1 gap-3 md:gap-4">
                  {currentQuestion?.type === 'radio' && currentQuestion.options?.map(opt => (
                    <button 
                      key={opt} onClick={() => handleSelectOption(currentQuestion.id, opt)}
                      className={`p-4 md:p-6 rounded-xl md:rounded-2xl border-2 text-left transition-all flex items-center justify-between group ${answers[currentQuestion.id]?.value === opt ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-primary/30'}`}
                    >
                      <span className={`text-sm md:text-lg font-bold ${answers[currentQuestion.id]?.value === opt ? 'text-primary' : 'text-obsidian'}`}>{opt}</span>
                      <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4 ${answers[currentQuestion.id]?.value === opt ? 'bg-primary border-primary text-white' : 'border-gray-200'}`}>
                        {answers[currentQuestion.id]?.value === opt && <Check size={14} />}
                      </div>
                    </button>
                  ))}

                  {currentQuestion?.type === 'checkbox' && currentQuestion.options?.map(opt => (
                    <button 
                      key={opt} onClick={() => handleToggleCheckbox(currentQuestion.id, opt)}
                      className={`p-4 md:p-6 rounded-xl md:rounded-2xl border-2 text-left transition-all flex items-center justify-between group ${(answers[currentQuestion.id]?.value as string[])?.includes(opt) ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-primary/30'}`}
                    >
                      <span className={`text-sm md:text-lg font-bold ${(answers[currentQuestion.id]?.value as string[])?.includes(opt) ? 'text-primary' : 'text-obsidian'}`}>{opt}</span>
                      <div className={`w-5 h-5 md:w-6 md:h-6 rounded-lg md:rounded-xl border-2 flex items-center justify-center flex-shrink-0 ml-4 ${(answers[currentQuestion.id]?.value as string[])?.includes(opt) ? 'bg-primary border-primary text-white' : 'border-gray-200'}`}>
                        {(answers[currentQuestion.id]?.value as string[])?.includes(opt) && <Check size={14} />}
                      </div>
                    </button>
                  ))}

                  {currentQuestion?.type === 'file' && (
                    <div className="space-y-6">
                      {cameraActive ? (
                        <div className="relative bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                            <button 
                              onClick={takePhoto}
                              className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-clinical-dark shadow-lg"
                            >
                              <Camera size={18} />
                            </button>
                            <button
                              onClick={stopCamera}
                              className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer group flex flex-col items-center justify-center"
                          >
                            <FileUp size={30} className="text-gray-300 group-hover:text-primary transition-colors mb-2" />
                            <p className="text-sm font-bold text-obsidian">Upload from device</p>
                            <input 
                              type="file" 
                              ref={fileInputRef}
                              className="hidden" 
                              accept={ACCEPTED_IMAGE_TYPES}
                              multiple
                              onChange={(e) => {
                                if (e.target.files) {
                                  Array.from(e.target.files).forEach(handleFileUpload);
                                }
                              }}
                            />
                          </div>
                          <div 
                            onClick={startCamera}
                            className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer group flex flex-col items-center justify-center"
                          >
                            <Camera size={30} className="text-gray-300 group-hover:text-primary transition-colors mb-2" />
                            <p className="text-sm font-bold text-obsidian">Take a photo</p>
                          </div>
                        </div>
                      )}

                      <canvas ref={canvasRef} className="hidden" />

                      {uploading && (
                        <div className="flex items-center justify-center gap-3 py-4">
                          <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-medium uppercase text-primary">Uploading clinical images...</span>
                        </div>
                      )}

                      {((answers[currentQuestion.id]?.value as string[]) || []).length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
                          {((answers[currentQuestion.id]?.value as string[]) || []).map((url, idx) => (
                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-black/5 group">
                              <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <button 
                                onClick={() => {
                                  setAnswers(prev => ({
                                    ...prev,
                                    [currentQuestion.id]: {
                                      text: currentQuestion.text,
                                      value: (prev[currentQuestion.id].value as string[]).filter((_, i) => i !== idx)
                                    }
                                  }));
                                }}
                                className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-5 md:p-8 border-t border-gray-100 flex justify-between items-center bg-white flex-shrink-0">
            {(phase === 'assessment' || phase === 'intake') && (
              <button 
                onClick={handleBack}
                className="flex items-center gap-2 text-[10px] md:text-xs font-medium uppercase text-muted hover:text-primary transition-colors"
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
            {phase === 'intake' ? (
              <button 
                onClick={handleAccountSubmit}
                disabled={!isStepValid || loading || error === 'email_exists'}
                className={`ml-auto px-8 md:px-12 py-4 md:py-5 rounded-full font-medium text-[10px] md:text-xs uppercase transition-all ${(!isStepValid || loading || error === 'email_exists') ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-primary text-clinical-dark shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 flex items-center gap-2'}`}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-clinical-dark border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Finish & Get Results'
                )}
              </button>
            ) : (
              <button 
                onClick={handleNext}
                disabled={!isStepValid}
                className={`ml-auto px-8 md:px-12 py-4 md:py-5 rounded-full font-medium text-[10px] md:text-xs uppercase transition-all ${!isStepValid ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 active:scale-95'}`}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentPage;
