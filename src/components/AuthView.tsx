import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Sparkles, Smartphone, ShieldCheck, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

interface AuthViewProps {
  onSignIn: (email: string, pass: string) => Promise<void>;
  onSignUp: (email: string, pass: string, name: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onSignInWithGoogle: () => Promise<void>;
}

export default function AuthView({ onSignIn, onSignUp, onResetPassword, onSignInWithGoogle }: AuthViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      await onSignInWithGoogle();
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || 'An error occurred during Google authentication.';
      if (errMsg.includes('auth/popup-closed-by-user')) {
        errMsg = 'The sign-in popup was closed before completion. Please try again.';
      } else if (errMsg.includes('auth/cancelled-popup-request')) {
        errMsg = 'The sign-in request was cancelled. Please try again.';
      } else if (errMsg.includes('auth/unauthorized-domain') || errMsg.toLowerCase().includes('unauthorized-domain') || errMsg.toLowerCase().includes('unauthorized domain')) {
        errMsg = 'Google SSO is disabled for this domain. To enable it, go to your Firebase Console -> Authentication -> Settings -> Authorized Domains and add these domains: \n• ais-dev-htqgvj7x27s7mnumakq4le-14671985973.asia-southeast1.run.app\n• ais-pre-htqgvj7x27s7mnumakq4le-14671985973.asia-southeast1.run.app';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (isResetMode) {
        if (!email.trim()) throw new Error('Please enter your email address.');
        await onResetPassword(email.trim());
        setSuccessMessage('Password reset link sent! Check your inbox (including spam folder).');
      } else if (isSignUp) {
        if (!name.trim()) throw new Error('Please enter your name.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        await onSignUp(email, password, name);
      } else {
        await onSignIn(email, password);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || 'An error occurred during authentication.';
      if (errMsg.includes('email-already-in-use') || errMsg.toLowerCase().includes('already-in-use') || errMsg.toLowerCase().includes('already exists') || errMsg.includes('already-registered')) {
        errMsg = 'This email address is already registered. Please sign in instead, or use the "Forgot Password" link below to reset your password.';
      } else if (errMsg.includes('invalid-credential') || errMsg.toLowerCase().includes('wrong-password') || errMsg.toLowerCase().includes('invalid email') || errMsg.includes('user-not-found')) {
        errMsg = 'Invalid email or password. Please try again.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-10 bg-slate-50 dark:bg-slate-900 select-none overflow-y-auto">
      
      {/* App Branding Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-8"
      >
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3.5">
          <Smartphone className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-1.5">
          PayMonitor
          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
        </h2>
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
          Family Payment Auditor
        </p>
      </motion.div>

      {/* Main Form Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-slate-950 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-6"
      >
        <div className="space-y-1.5">
          <h3 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">
            Sign In to Your Ledger
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
            Securely access, track, and audit your family payments with real-time push alerts, offline-first persistence, and seamless currency conversions.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400 text-[10px] font-semibold flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-black text-xs rounded-xl border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98]"
        >
          {loading ? (
            <span className="w-4.5 h-4.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google SSO</span>
            </>
          )}
        </button>
      </motion.div>

      {/* Trust & Policy Badge */}
      <div className="mt-6 flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure Firebase Cloud Sandbox
      </div>
    </div>
  );
}
