import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Smartphone, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';
import PrivacyPolicyModal from './PrivacyPolicyModal';

interface AuthViewProps {
  onSignIn: (email: string, pass: string) => Promise<void>;
  onSignUp: (email: string, pass: string, name: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onSignInWithGoogle: () => Promise<void>;
  onAcceptPrivacy?: () => Promise<void>;
}

export default function AuthView({ onSignIn, onSignUp, onResetPassword, onSignInWithGoogle, onAcceptPrivacy }: AuthViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      await onSignInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google sign-in is not enabled yet — use email & password below instead.');
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
        if (!agreedToPrivacy) throw new Error('Please agree to the Privacy Policy to create an account.');
        await onSignUp(email.trim(), password, name.trim());
        try { await onAcceptPrivacy?.(); } catch { /* best-effort, don't block signup on this */ }
        setSuccessMessage("Account created! Check your inbox for a confirmation email, then come back and sign in.");
        setIsSignUp(false);
      } else {
        await onSignIn(email.trim(), password);
      }
    } catch (err: any) {
      let errMsg = err.message || 'An error occurred during authentication.';
      if (errMsg.toLowerCase().includes('already registered') || errMsg.toLowerCase().includes('already-in-use')) {
        errMsg = 'This email is already registered. Try signing in instead, or reset your password below.';
      } else if (errMsg.toLowerCase().includes('invalid login credentials')) {
        errMsg = 'Invalid email or password. Please try again.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-10 bg-slate-50 dark:bg-slate-900 select-none overflow-y-auto">

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
          Haven Vault
          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
        </h2>
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
          Family Payment Auditor
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-slate-950 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5"
      >
        <div className="space-y-1.5 text-center">
          <h3 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">
            {isResetMode ? 'Reset Password' : isSignUp ? 'Create Your Account' : 'Sign In to Your Ledger'}
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
            {isResetMode
              ? "Enter your email and we'll send a reset link."
              : 'Securely track and audit family payments together.'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400 text-[10px] font-semibold flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold flex items-start gap-2 text-left">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          {isSignUp && !isResetMode && (
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {!isResetMode && (
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min. 6 characters)"
                required
                minLength={6}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {isSignUp && !isResetMode && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                className="mt-0.5 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                I agree to the{' '}
                <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-indigo-600 dark:text-indigo-400 font-semibold underline cursor-pointer">
                  Privacy Policy
                </button>
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading || (isSignUp && !isResetMode && !agreedToPrivacy)}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer active:scale-[0.98]"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto block" />
            ) : isResetMode ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />

        <div className="flex items-center justify-between text-[10px] font-bold">
          {!isResetMode ? (
            <>
              <button onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccessMessage(null); }} className="text-indigo-600 dark:text-indigo-400 cursor-pointer">
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
              {!isSignUp && (
                <button onClick={() => { setIsResetMode(true); setError(null); setSuccessMessage(null); }} className="text-slate-400 cursor-pointer">
                  Forgot Password?
                </button>
              )}
            </>
          ) : (
            <button onClick={() => { setIsResetMode(false); setError(null); setSuccessMessage(null); }} className="text-indigo-600 dark:text-indigo-400 cursor-pointer">
              Back to Sign In
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          <span className="text-[9px] font-bold text-slate-400 uppercase">Or</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-black text-xs rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98]"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          <span>Continue with Google</span>
        </button>
      </motion.div>

      <div className="mt-6 flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secured by Supabase
      </div>
    </div>
  );
}
