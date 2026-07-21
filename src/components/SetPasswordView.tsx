import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';

interface SetPasswordViewProps {
  onSetPassword: (password: string) => Promise<void>;
}

export default function SetPasswordView({ onSetPassword }: SetPasswordViewProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      await onSetPassword(password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Could not set your password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-10 bg-slate-50 dark:bg-slate-900 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-slate-950 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5"
      >
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-2">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">Set Your Password</h3>
          <p className="text-[10px] text-slate-400 font-semibold leading-relaxed max-w-[240px] mx-auto">
            You're signed in via your invite link. Set a password now so you can log back in next time.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400 text-[10px] font-semibold flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-2 text-left">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Password set! Loading your account...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-left">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min. 6 characters)"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer active:scale-[0.98]"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto block" />
              ) : 'Set Password & Continue'}
            </button>
          </form>
        )}

        <div className="flex items-center justify-center gap-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secured by Supabase
        </div>
      </motion.div>
    </div>
  );
}
