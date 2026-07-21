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
  Plus
} from 'lucide-react';
import { RecurringPayment, UserProfile, Workspace } from '../types';
import { BUILD_TIME } from '../buildTime';

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
  connections?: any[];
  referencedUserProfiles?: UserProfile[];
  workspaces?: Workspace[];
  activeWorkspace?: Workspace | null;
  onSwitchWorkspace?: (id: string) => Promise<void>;
  onCreateWorkspace?: (name: string, type: 'family' | 'business') => Promise<any>;
}

export default function ProfileScopeModal({
  isOpen,
  onClose,
  user,
  userProfile,
  familyMembers = [],
  viewMode,
  setViewMode,
  onLogOut,
  connections = [],
  referencedUserProfiles = [],
  workspaces = [],
  activeWorkspace = null,
  onSwitchWorkspace,
  onCreateWorkspace
}: ProfileScopeModalProps) {
  const [copied, setCopied] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceType, setNewWorkspaceType] = useState<'family' | 'business'>('business');
  const [isCreatingBusy, setIsCreatingBusy] = useState(false);

  // Safely find the host group's customized names/references
  const hostUids = connections
    ? connections
        .filter(c => c.Invitee_User_UUID === userProfile?.uid)
        .map(c => c.Host_User_UUID)
    : [];

  const hostProfiles = (referencedUserProfiles || []).filter(p => hostUids.includes(p.uid));

  const handleCopyGroupId = (val: string) => {
    navigator.clipboard.writeText(val);
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
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Profile & Scope Manager</h3>
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
                  <p className="text-[9px] text-indigo-500 dark:text-indigo-400/95 font-black uppercase tracking-wider mt-1 block">
                    Last App Update: {new Date(BUILD_TIME).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>

              {/* Switch Account (workspace switcher) */}
              {workspaces.length > 0 && (
                <div className="space-y-2 text-left">
                  <span className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest block pl-1">
                    Switch Account
                  </span>
                  <div className="space-y-1.5">
                    {workspaces.map(ws => (
                      <button
                        key={ws.id}
                        onClick={async () => {
                          if (ws.id === activeWorkspace?.id) return;
                          setSwitchingId(ws.id);
                          try { await onSwitchWorkspace?.(ws.id); } finally { setSwitchingId(null); }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                          ws.id === activeWorkspace?.id
                            ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20'
                            : 'border-slate-150 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white font-black text-[10px] uppercase ${ws.type === 'business' ? 'bg-[#34c759]' : 'bg-[#007aff]'}`}>
                          {ws.type === 'business' ? 'B' : 'F'}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{ws.name}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">{ws.type} · {ws.isOwner ? 'Owner' : ws.role}</p>
                        </div>
                        {switchingId === ws.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                        ) : ws.id === activeWorkspace?.id ? (
                          <Check className="w-4 h-4 text-indigo-500 shrink-0" />
                        ) : null}
                      </button>
                    ))}

                    {!isCreatingWorkspace ? (
                      <button
                        onClick={() => setIsCreatingWorkspace(true)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 text-slate-400 hover:text-indigo-500 text-xs font-bold transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {workspaces.some(w => w.type === 'business') ? 'New Workspace' : 'Add a Business Workspace'}
                      </button>
                    ) : (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!newWorkspaceName.trim()) return;
                          setIsCreatingBusy(true);
                          try {
                            await onCreateWorkspace?.(newWorkspaceName.trim(), newWorkspaceType);
                            setIsCreatingWorkspace(false);
                            setNewWorkspaceName('');
                          } finally {
                            setIsCreatingBusy(false);
                          }
                        }}
                        className="p-3 border border-slate-150 dark:border-slate-850 rounded-xl space-y-2"
                      >
                        <input
                          autoFocus
                          type="text"
                          value={newWorkspaceName}
                          onChange={(e) => setNewWorkspaceName(e.target.value)}
                          placeholder="Workspace name, e.g. Acme Pty Ltd"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => setNewWorkspaceType('family')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${newWorkspaceType === 'family' ? 'bg-[#007aff] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Family</button>
                          <button type="button" onClick={() => setNewWorkspaceType('business')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${newWorkspaceType === 'business' ? 'bg-[#34c759] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Business</button>
                        </div>
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => setIsCreatingWorkspace(false)} className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer">Cancel</button>
                          <button type="submit" disabled={isCreatingBusy || !newWorkspaceName.trim()} className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer">
                            {isCreatingBusy ? 'Creating…' : 'Create'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* Display Scope Selector */}
              {viewMode && setViewMode && (
                <div className="space-y-2 text-left">
                  <span className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest block pl-1">
                    Display Scope Settings
                  </span>
                  
                  <div className="grid grid-cols-3 gap-1 bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-2xl border border-slate-150 dark:border-slate-850">
                    {/* My Data button */}
                    <button
                      onClick={() => setViewMode('personal')}
                      className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition-all cursor-pointer ${
                        viewMode === 'personal'
                          ? 'bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/20 dark:border-slate-800/20 font-black'
                          : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-300 font-bold'
                      }`}
                    >
                      <User className={`w-4 h-4 ${viewMode === 'personal' ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-70'}`} />
                      <span className="text-[9px] uppercase tracking-wider">My Data</span>
                    </button>

                    {/* MyFamily Data button */}
                    <button
                      onClick={() => setViewMode('family-only')}
                      className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition-all cursor-pointer ${
                        viewMode === 'family-only'
                          ? 'bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/20 dark:border-slate-800/20 font-black'
                          : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-300 font-bold'
                      }`}
                    >
                      <Users className={`w-4 h-4 ${viewMode === 'family-only' ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-70'}`} />
                      <span className="text-[9px] uppercase tracking-wider">MyFamily Data</span>
                    </button>

                    {/* All Data button */}
                    <button
                      onClick={() => setViewMode('family-combined')}
                      className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition-all cursor-pointer ${
                        viewMode === 'family-combined'
                          ? 'bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/20 dark:border-slate-800/20 font-black'
                          : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-300 font-bold'
                      }`}
                    >
                      <Layers className={`w-4 h-4 ${viewMode === 'family-combined' ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-70'}`} />
                      <span className="text-[9px] uppercase tracking-wider">All Data</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Family ID / Join Codes section */}
              <div className="space-y-3 w-full">
                {/* User's Own Family Group (for sharing) */}
                <div className="flex flex-col gap-1 text-left bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-150 dark:border-slate-850 shadow-sm">
                  <span className="text-[8.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest block">Your Invitation / Family ID</span>
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded border border-slate-100 dark:border-slate-850 truncate max-w-[200px]">
                      {userProfile?.inviteCode || userProfile?.familyGroupId || 'N/A'}
                    </span>
                    <button
                      onClick={() => {
                        const val = userProfile?.inviteCode || userProfile?.familyGroupId;
                        if (val) handleCopyGroupId(val);
                      }}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Joined Groups (Dynamic lookup) */}
                {hostProfiles.length > 0 && (
                  <div className="flex flex-col gap-1 text-left bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-150 dark:border-slate-850 shadow-sm">
                    <span className="text-[8.5px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest block">Active Connected Vaults (Joined)</span>
                    <div className="space-y-2 mt-2">
                      {hostProfiles.map(hostProf => {
                        const referenceCode = hostProf.familyGroupId || hostProf.inviteCode;
                        return (
                          <div key={hostProf.uid} className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span className="truncate max-w-[140px]">{hostProf.displayName}'s Group</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-extrabold">
                                {referenceCode}
                              </span>
                              <button
                                onClick={() => handleCopyGroupId(referenceCode)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded text-slate-400 hover:text-slate-700"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer / Logout Option */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/10 flex gap-3 shrink-0">
              <button
                onClick={onLogOut}
                className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
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
