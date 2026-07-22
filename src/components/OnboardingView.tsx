import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Home, Briefcase, Sparkles, Shield, ChevronRight, Check } from 'lucide-react';

interface OnboardingViewProps {
  onSelectMode: (mode: 'family' | 'business') => Promise<void>;
  isSyncing: boolean;
  canCreateBusiness?: boolean;
}

export default function OnboardingView({ onSelectMode, isSyncing, canCreateBusiness = true }: OnboardingViewProps) {
  const [selectedMode, setSelectedMode] = useState<'family' | 'business'>('family');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      await onSelectMode(selectedMode);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to initialize workspace. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-[#f5f5f7] dark:bg-black select-none overflow-y-auto min-h-full">
      <div className="w-full max-w-[420px] flex flex-col items-center space-y-7 text-left">
        
        {/* App Branding Logo */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center flex flex-col items-center"
        >
          <div className="w-14 h-14 bg-gradient-to-tr from-[#5856d6] to-[#007aff] rounded-[24%] flex items-center justify-center shadow-[0_8px_20px_rgba(88,86,214,0.15)] mb-4 border border-[#5856d6]/20">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-1.5">
            Initialize Your Vault
          </h2>
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1.5 text-center">
            Configure your active ledger engine
          </p>
        </motion.div>

        {/* Main Selection Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 border border-[#e5e5ea] dark:border-[#2c2c2e]/90 shadow-[0_8px_32px_rgba(0,0,0,0.02)] space-y-5"
        >
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-center">
            Choose how you would like to structure this workspace. You can toggle or set up alternate workspaces anytime from your account settings.
          </p>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/50 flex items-start gap-2.5">
              <span className="text-rose-500 dark:text-rose-400 shrink-0 text-sm">⚠️</span>
              <p className="text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {/* Selection Cards */}
          <div className="space-y-3.5">
            {/* Family Option */}
            <button
              type="button"
              onClick={() => setSelectedMode('family')}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                selectedMode === 'family'
                  ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10 ring-1 ring-indigo-500/30'
                  : 'border-[#e5e5ea] dark:border-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-lg shrink-0 ${
                  selectedMode === 'family' ? 'bg-indigo-500 text-white' : 'bg-slate-150 dark:bg-slate-800 text-slate-500'
                }`}>
                  <Home className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Family / Shared Budget</h3>
                    {selectedMode === 'family' && (
                      <span className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                    Designed for couples, households, and friends. Share subscription costs, split rent, coordinate household bills, and coordinate through family chat channels.
                  </p>
                </div>
              </div>
            </button>

            {/* Business Option */}
            <button
              type="button"
              onClick={() => canCreateBusiness && setSelectedMode('business')}
              disabled={!canCreateBusiness}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedMode === 'business'
                  ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10 ring-1 ring-indigo-500/30'
                  : 'border-[#e5e5ea] dark:border-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-lg shrink-0 ${
                  selectedMode === 'business' ? 'bg-indigo-500 text-white' : 'bg-slate-150 dark:bg-slate-800 text-slate-500'
                }`}>
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Business / SME OPEX</h3>
                    {selectedMode === 'business' && (
                      <span className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                    {canCreateBusiness
                      ? 'Designed for freelancers, founders, and small teams. Track operating expenses (OPEX), project tools, manage cost centers, calculate business runway, and project capital reserves.'
                      : "Not included in your current plan - you'll be able to request access once you're set up."}
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || isSyncing}
            className="w-full h-11 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10 hover:from-indigo-500 hover:to-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || isSyncing ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Enter Workspace</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.div>

        {/* Footnote */}
        <div className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <Shield className="w-3.5 h-3.5" />
          <span>Both configurations are completely private and sovereign.</span>
        </div>
      </div>
    </div>
  );
}
