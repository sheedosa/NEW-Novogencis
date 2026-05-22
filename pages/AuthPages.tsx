import React, { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Page, User } from '../types';
import { auth, db } from '../firebase';
import Logo from '../components/Logo';
import { Mail, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Button, Input } from '../components/ui';

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

    // Require email-based login — no username mapping (security: prevents
    // PII exposure in the client bundle).
    if (!input.includes('@')) {
      setError('Please sign in with your email address.');
      setLoading(false);
      return;
    }
    const loginEmail = input;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      
      let userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      // Retry once if profile doc isn't visible yet (Firestore propagation can lag).
      if (!userDoc.exists()) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      }

      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        const userWithId = { ...userData, id: userData.id || userCredential.user.uid };
        onLogin(userWithId);
      } else {
        setError('User profile not found. Please contact the clinic to verify your account status.');
        await signOut(auth);
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
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
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-xl shadow-panel p-8 text-center flex flex-col gap-4">
          <div className="w-12 h-12 rounded-md bg-cream flex items-center justify-center mx-auto text-primary">
            <Mail size={20} />
          </div>
          <h2 className="text-xl font-medium text-obsidian">Check your email</h2>
          <p className="text-sm text-muted leading-relaxed">
            We've sent a verification link to your inbox. Click it to activate your account.
          </p>
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              setVerificationSent(false);
              onNavigate(Page.SignIn);
            }}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="flex justify-center mb-6 cursor-pointer" onClick={() => onNavigate(Page.Home)}>
          <Logo size="sm" />
        </div>

        <div className="bg-white rounded-xl shadow-panel border border-sand p-7">
          <div className="mb-5">
            <h1 className="text-xl font-medium text-obsidian">Sign in</h1>
            <p className="text-sm text-muted mt-1">Access your clinical portal</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-muted">Password</label>
                <button type="button" className="text-xs text-muted hover:text-obsidian transition-colors">Forgot?</button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-obsidian transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-danger-bg text-danger-text text-xs px-3 py-2 rounded-md border border-danger/15">
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Sign in
            </Button>
          </form>

          <div className="mt-5 pt-5 border-t border-sand flex items-center justify-center gap-1 text-sm">
            <span className="text-muted">New here?</span>
            <button
              onClick={() => onNavigate(Page.Assessment)}
              className="text-obsidian font-medium hover:underline"
            >
              Create account
            </button>
          </div>
        </div>

        <div className="mt-5 text-center">
          <button
            onClick={() => onNavigate(Page.Home)}
            className="text-xs text-muted hover:text-obsidian transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={13} /> Back to website
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPages;