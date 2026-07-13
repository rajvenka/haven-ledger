import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  User, 
  Users, 
  Layers, 
  Copy, 
  Check, 
  LogOut, 
  Sparkles, 
  ShieldAlert, 
  Eye, 
  EyeOff 
} from 'lucide-react';
import { RecurringPayment, UserProfile } from '../types';

interface ProfileScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  userProfile: UserProfile | null;
  familyMembers?: any[];
  allPayments?: RecurringPayment[];
  viewMode?: 'personal' | 'family-combined' | 'family-only';
  setViewMode?: (mode: 'personal' | 'family-combined' | 'family-only') => void;
  onLogOut: () => void;
  summaryCurrency?: string;
}

export default function ProfileScopeModal({
  isOpen,
  onClose,
  user,
  userProfile,
  onLogOut,
}: ProfileScopeModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyGroupId = () => {
    if (!userProfile?.familyGroupId) return;
    navigator.clipboard.writeText(userProfile.familyGroupId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 select-none animate-in fade-in duration-200">
          {/* Blur Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/45 dark:bg-slate-950/65 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.15 }}
            className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-3xl border border-slate-200/80 dark:border-slate-850/80 shadow-2xl relative overflow-hidden z-10 flex flex-col max-h-[90vh] md:max-h-[85vh]"
          >
            {/* Header ambient glow */}
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-indigo-500/10 dark:from-indigo-500/5 to-transparent pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-900 shrink-0 z-10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Scope & Profile Manager</h3>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Profile card block */}
              <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-150/60 dark:border-slate-850/60 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 text-center md:text-left relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />
                
                {/* Large initial avatar */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-650 to-violet-600 text-white flex items-center justify-center text-xl font-black uppercase shrink-0 shadow-md shadow-indigo-500/10 relative">
                  <span className="relative z-10">
                    {userProfile?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </span>
                  <div className="absolute inset-0 rounded-2xl border border-white/20" />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-col md:flex-row md:items-center gap-1.5">
                    <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                      {userProfile?.displayName || user?.email?.split('@')[0] || 'User Profile'}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider self-center">
                      Active Session
                    </span>
                  </div>
                  <p className="text-xs text-slate-450 dark:text-slate-500 font-semibold truncate">
                    {user?.email}
                  </p>

                  {userProfile?.familyGroupId && (
                    <div className="flex items-center justify-center md:justify-start gap-1.5 pt-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Family ID:</span>
                      <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {userProfile.familyGroupId}
                      </span>
                      <button
                        onClick={handleCopyGroupId}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors cursor-pointer"
                        title="Copy Family ID"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>



            </div>

            {/* Modal Footer / Logout Option */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/10 flex gap-3 shrink-0">
              <button
                onClick={onLogOut}
                className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out of Ledger</span>
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all text-center cursor-pointer shadow-md shadow-indigo-500/10"
              >
                Done
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
