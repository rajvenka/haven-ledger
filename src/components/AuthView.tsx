import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Smartphone, ShieldCheck, AlertCircle, CheckCircle, Receipt, TrendingUp, Users, FileBarChart } from 'lucide-react';
import PrivacyPolicyModal from './PrivacyPolicyModal';

interface AuthViewProps {
  onSignIn: (email: string, pass: string) => Promise<void>;
  onSignUp: (email: string, pass: string, name: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onSignInWithGoogle?: () => Promise<void>;
  onAcceptPrivacy?: () => Promise<void>;
}

export default function AuthView({ onSignIn, onSignUp, onResetPassword, onAcceptPrivacy }: AuthViewProps) {
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

  const features = [
    { icon: Receipt, title: 'Bills & Subscriptions', desc: 'Track recurring payments, get reminders, never miss a due date.' },
    { icon: TrendingUp, title: 'Investment Portfolio', desc: 'Live prices, gains, classification performance, and drill-down reports.' },
    { icon: Users, title: 'Family Sharing', desc: 'Collaborate with role-based access across your household.' },
    { icon: FileBarChart, title: 'Deep Reports & Insights', desc: 'Understand exactly where your money goes and grows.' },
  ];

  return (
    <div className="flex-1 flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-900 select-none overflow-y-auto">

      {/* Landing-style summary panel - full feature summary on desktop only, keeps the
          sign-in page itself lightweight rather than cramming this onto small screens. */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 py-10 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
        <div className="max-w-md">
          <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center mb-5">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Haven Vault</h1>
          <p className="text-indigo-100 text-sm font-semibold mb-10">Your family's complete financial command center - bills, investments, and everything in between, in one place.</p>
          <div className="space-y-6">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5">
                <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                  <f.icon className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold">{f.title}</p>
                  <p className="text-[11px] text-indigo-100 leading-relaxed mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 lg:w-1/2 flex flex-col justify-center px-6 py-10 max-w-lg mx-auto w-full">

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-6 lg:hidden"
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
        {/* Condensed feature chips - a taste of the full summary without bloating mobile */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap mt-3">
          {['Bills', 'Investments', 'Family', 'Reports'].map(f => (
            <span key={f} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold rounded-full">{f}</span>
          ))}
        </div>
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

      </motion.div>

      <div className="mt-6 flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secured by Supabase
      </div>
      </div>
    </div>
  );
}
