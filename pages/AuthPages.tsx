import React, { useState } from 'react';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Page, User, AdminType } from '../types';
import { auth, db, cleanData } from '../firebase';
import Logo from '../components/Logo';

interface AuthPagesProps {
  onLogin: (user: User) => void;
  onNavigate: (page: Page) => void;
}

const AuthPages: React.FC<AuthPagesProps> = ({ onLogin, onNavigate }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const input = username.trim().toLowerCase();
    let loginEmail = input;
    
    const adminMapping: Record<string, string> = {
      'rasheed_admin': 'rasheedamer99@gmail.com',
      'rasheed': 'rasheedamer99@gmail.com',
      'aminah_amer': 'aminah_amer@hotmail.com',
      'waqas_farid': 'wfarid812@gmail.com',
      'aminah_doctor': 'aminah_doctor@novogenics.internal',
      'waqass_doctor': 'waqass_doctor@novogenics.internal'
    };

    // Smart mapping: if it's not an email, try to map it
    if (!input.includes('@')) {
      if (adminMapping[input]) {
        loginEmail = adminMapping[input];
      } else {
        // For non-admin usernames, we don't have a deterministic mapping anymore
        // because clients use their real emails. We'll try the legacy internal 
        // fallback just in case, but we should probably warn them.
        loginEmail = `${input}@novogenics.internal`;
      }
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      
      let userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      // Retry logic for profile fetch (Firestore propagation can be slow)
      if (!userDoc.exists()) {
        console.log('SignIn: User document not found, retrying in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      }

      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        // Ensure ID is present even if not in document data
        const userWithId = { ...userData, id: userData.id || userCredential.user.uid };
        console.log('SignIn: User document found:', userWithId.email);
        
        onLogin(userWithId);
      } else {
        // If Auth succeeded but profile is missing, it's a "zombie" account
        // or a mismatch in login method.
        if (!input.includes('@')) {
          setError('User profile not found. Please try signing in with your email address instead of your username.');
        } else {
          setError('User profile not found. Please contact the clinic to verify your account status.');
        }
        await signOut(auth);
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      
      // Auto-bootstrap admin accounts if they don't exist
      const adminEmails = [
        'rasheedamer99@gmail.com', 
        'aminah_amer@hotmail.com', 
        'wfarid812@gmail.com',
        'aminah_doctor@novogenics.internal',
        'waqass_doctor@novogenics.internal'
      ];

      if ((error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') && adminEmails.includes(loginEmail)) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
          const uid = userCredential.user.uid;
          
          let adminType: AdminType | undefined = undefined;
          if (loginEmail === 'rasheedamer99@gmail.com') {
            adminType = 'technical';
          } else if (loginEmail === 'aminah_amer@hotmail.com' || loginEmail === 'aminah_doctor@novogenics.internal') {
            adminType = 'doctor-female';
          } else if (loginEmail === 'wfarid812@gmail.com' || loginEmail === 'waqass_doctor@novogenics.internal') {
            adminType = 'doctor-male';
          }

          const newUser: User = {
            id: uid,
            fullName: loginEmail.split('@')[0],
            email: loginEmail,
            username: loginEmail.split('@')[0],
            role: 'admin',
            adminType,
            policiesAccepted: true,
            createdAt: new Date().toISOString()
          };

          await setDoc(doc(db, 'users', uid), cleanData(newUser));
          onLogin(newUser);
          setLoading(false);
          return;
        } catch (createErr: unknown) {
          const createError = createErr as { code?: string };
          if (createError.code === 'auth/email-already-in-use') {
             setError('Invalid clinical credentials.');
          } else {
             console.error('Admin bootstrap error:', createErr);
             setError('Failed to initialize admin account.');
          }
          setLoading(false);
          return;
        }
      }

      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError('Invalid clinical credentials.');
      } else {
        console.error('Auth error:', err);
        setError('A clinical authentication error occurred. Please contact the clinic if this persists.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-primary/5 p-8 md:p-12 text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-4xl text-primary">mail</span>
          </div>
          <h2 className="text-2xl font-black text-text-main uppercase tracking-tight">Verify Your Email</h2>
          <p className="text-text-muted text-sm font-medium leading-relaxed">
            We've sent a verification link to your email address. Please click the link to enable your clinical account.
          </p>
          <div className="pt-4">
            <button 
              onClick={() => {
                setVerificationSent(false);
                onNavigate(Page.SignIn);
              }}
              className="w-full bg-primary text-white rounded-full py-4 text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-soft flex items-start md:items-center justify-center p-6 pt-12 md:pt-44">
      <div className="absolute top-0 left-0 w-full h-1/2 bg-white skew-y-3 -translate-y-1/2 pointer-events-none opacity-50" />
      
      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10">
          <div className="cursor-pointer inline-block mb-8" onClick={() => onNavigate(Page.Home)}>
            <Logo size="md" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-text-main tracking-tight">
            Welcome Back
          </h1>
          <p className="text-text-muted mt-2 font-medium">
            Access your hair restoration portal
          </p>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-primary/5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-widest text-text-muted ml-1">Email Address</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all"
                placeholder="Clinical email address"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">Password</label>
                <button type="button" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Forgot?</button>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-bg-soft border-transparent rounded-2xl px-5 py-4 text-sm font-bold focus:ring-primary focus:border-primary transition-all pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest p-4 rounded-xl text-center">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary text-clinical-dark py-4 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-clinical-dark border-t-transparent rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-100 text-center">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest">
              Don't have an account?
              <button 
                onClick={() => onNavigate(Page.Assessment)}
                className="text-primary ml-2 hover:underline"
              >
                Register Now
              </button>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
           <button 
            onClick={() => onNavigate(Page.Home)}
            className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-primary transition-colors flex items-center gap-2 mx-auto"
           >
             <span className="material-symbols-outlined text-sm">west</span> Back to Website
           </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPages;