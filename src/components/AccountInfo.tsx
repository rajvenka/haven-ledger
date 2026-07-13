import React, { useState } from 'react';
import { 
  Download, 
  Upload, 
  RefreshCw, 
  Sliders, 
  Settings, 
  ShieldAlert, 
  Users, 
  UserPlus, 
  Copy, 
  Check, 
  LogOut, 
  Sun, 
  Moon,
  User,
  Info,
  Globe,
  Bell,
  History,
  Edit,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  MessageSquare,
  Send,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { RecurringPayment, Currency, UserProfile, CountryConfig, FamilyInvitation } from '../types';

interface AccountInfoProps {
  payments: RecurringPayment[];
  userProfile: UserProfile | null;
  familyMembers: UserProfile[];
  familyRole?: 'host' | 'modify' | 'view' | null;
  isReadOnly?: boolean;
  onAddFamilyMember: (email: string, role?: 'view' | 'modify') => Promise<void>;
  onJoinFamilyGroup: (code: string) => Promise<void>;
  onLeaveFamilyGroup?: () => Promise<void>;
  incomingInvitations?: FamilyInvitation[];
  onApproveInvitation?: (invitationId: string, role: 'view' | 'modify') => Promise<void>;
  onDeclineInvitation?: (invitationId: string) => Promise<void>;
  onUpdateMemberRole?: (memberUid: string, role: 'view' | 'modify') => Promise<void>;
  onRemoveFamilyMember?: (memberUid: string) => Promise<void>;
  inviteCode?: string;
  onRegenerateInviteCode?: () => Promise<void>;
  onLogOut: () => Promise<void>;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  countries: CountryConfig[];
  rate: number;
  onSaveRate: (rate: number) => void;
  summaryCurrency: string;
  onSaveSummaryCurrency: (curr: string) => void;
  onRequestNotifications: () => void;
  onTriggerTestNotif: () => void;
  customizedTags: string[];
  onSaveCustomizedTags: (tags: string[]) => void;
  appNotificationsEnabled?: boolean;
  mobileNotificationsEnabled?: boolean;
  onSaveNotificationSettings?: (appVal: boolean, mobileVal: boolean) => Promise<void>;
  showFrequencyPatterns?: boolean;
  onToggleFrequencyPatterns?: (enabled: boolean) => void;
  viewMode?: 'personal' | 'family-combined' | 'family-only';
  setViewMode?: (mode: 'personal' | 'family-combined' | 'family-only') => void;
  activeSubTab?: 'preferences' | 'security' | 'members' | 'groups' | 'chat' | 'invite';
  onActiveSubTabChange?: (tab: 'preferences' | 'security' | 'members' | 'groups' | 'chat' | 'invite') => void;
}

export default function AccountInfo({
  payments,
  userProfile,
  familyMembers,
  familyRole = null,
  isReadOnly = false,
  onAddFamilyMember,
  onJoinFamilyGroup,
  onLeaveFamilyGroup,
  incomingInvitations = [],
  onApproveInvitation,
  onDeclineInvitation,
  onUpdateMemberRole,
  onRemoveFamilyMember,
  inviteCode = '',
  onRegenerateInviteCode,
  onLogOut,
  theme,
  onThemeChange,
  countries = [],
  rate,
  onSaveRate,
  summaryCurrency,
  onSaveSummaryCurrency,
  onRequestNotifications,
  onTriggerTestNotif,
  customizedTags = [],
  onSaveCustomizedTags,
  appNotificationsEnabled = true,
  mobileNotificationsEnabled = true,
  onSaveNotificationSettings,
  showFrequencyPatterns = true,
  onToggleFrequencyPatterns,
  viewMode = 'personal',
  setViewMode,
  activeSubTab,
  onActiveSubTabChange,
}: AccountInfoProps) {
  const [localActiveSubTab, setLocalActiveSubTab] = useState<'preferences' | 'security' | 'members' | 'groups' | 'chat' | 'invite'>('preferences');
  const currentSubTab = activeSubTab !== undefined ? activeSubTab : localActiveSubTab;
  const setSubTab = onActiveSubTabChange || setLocalActiveSubTab;
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Rate editor state
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState('');
  
  // Family forms state
  const [familyEmail, setFamilyEmail] = useState('');
  const [familyEmailRole, setFamilyEmailRole] = useState<'view' | 'modify'>('modify');
  const [joinGroupId, setJoinGroupId] = useState('');
  const [copied, setCopied] = useState(false);
  const [familyError, setFamilyError] = useState<string | null>(null);
  const [familySuccess, setFamilySuccess] = useState<string | null>(null);
  const [familyLoading, setFamilyLoading] = useState(false);

  // Toggle state for instructions
  const [showInstructions, setShowInstructions] = useState(() => {
    const val = localStorage.getItem('pm_show_instructions');
    return val === null ? true : val === 'true';
  });

  const handleToggleInstructions = (val: boolean) => {
    setShowInstructions(val);
    localStorage.setItem('pm_show_instructions', String(val));
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyEmail.trim()) return;
    setFamilyError(null);
    setFamilySuccess(null);
    setFamilyLoading(true);
    try {
      await onAddFamilyMember(familyEmail, familyEmailRole);
      setFamilySuccess(`Successfully sent family invitation to "${familyEmail}"!`);
      setFamilyEmail('');
    } catch (err: any) {
      setFamilyError(err.message || 'Failed to send invitation.');
    } finally {
      setFamilyLoading(false);
    }
  };

  // Export recurring payments to clipboard/file
  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify(payments, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = 'recurring_payments_backup.json';
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (err) {
      console.error('Failed to export', err);
    }
  };

  // Import recurring payments from text input
  const handleImportData = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) {
        throw new Error('Backup data must be an array of payments.');
      }
      
      // Verify basic fields
      const isValid = parsed.every(item => 
        item &&
        typeof item.name === 'string' &&
        typeof item.amount === 'number' &&
        ['AUD', 'INR'].includes(item.currency) &&
        typeof item.dayOfMonth === 'number'
      );

      if (!isValid) {
        throw new Error('Invalid payment objects detected in backup.');
      }

      // Add fresh IDs to prevent collisions
      const processed = parsed.map((p, idx) => ({
        ...p,
        id: p.id || 'p_imported_' + Date.now() + '_' + idx,
        active: typeof p.active === 'boolean' ? p.active : true,
        reminderDaysBefore: typeof p.reminderDaysBefore === 'number' ? p.reminderDaysBefore : 3,
        category: p.category || 'Other'
      }));

      // Overwrite localStorage
      localStorage.setItem('pm_recurring_payments', JSON.stringify(processed));
      setImportStatus({ type: 'success', message: 'Import successful! Please refresh the page.' });
      setImportText('');
      
      // Reload page to reinitialize state after a slight delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err: any) {
      setImportStatus({ type: 'error', message: err?.message || 'Failed to parse JSON. Please check formatting.' });
    }
  };

  const handleRateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(tempRate);
    if (!isNaN(parsed) && parsed > 0) {
      onSaveRate(parsed);
      setIsEditingRate(false);
    }
  };

  const isGroupHost = userProfile?.isFamilyHost !== false && !userProfile?.Connected_To_Host_UUID;

  // Calculate live statistics for different scopes
  const activePayments = payments.filter(p => p.active);
  const personalPayments = activePayments.filter(p => userProfile && p.userId === userProfile.uid);
  const personalTotal = personalPayments.reduce((acc, p) => acc + p.amount, 0);

  const familyOnlyPayments = activePayments.filter(p => userProfile && p.userId !== userProfile.uid);
  const familyOnlyTotal = familyOnlyPayments.reduce((acc, p) => acc + p.amount, 0);

  const combinedTotal = personalTotal + familyOnlyTotal;

  const totalSum = personalTotal + familyOnlyTotal;
  const personalPercentReal = totalSum > 0 ? (personalTotal / totalSum) * 100 : 100;
  const familyPercentReal = totalSum > 0 ? (familyOnlyTotal / totalSum) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-4 text-left select-none bg-slate-50 dark:bg-slate-900">
      
      {/* Title Bar with Instructions Toggle */}
      <div className="flex justify-between items-center px-1 shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="w-4.5 h-4.5 text-indigo-600" />
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Haven Vault Config</h3>
        </div>
        
        {/* Toggle Button: Show/Hide Instructions */}
        <button
          onClick={() => handleToggleInstructions(!showInstructions)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm transition-all cursor-pointer hover:shadow"
        >
          {showInstructions ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              <span>Hide Instructions</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-indigo-500" />
              <span>Show Instructions</span>
            </>
          )}
        </button>
      </div>

      {/* Scope Data View shown inside Security */}
      {currentSubTab === 'security' && (
        <>
          {/* Section 1: Scope Data View */}
          <div className="bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 text-left animate-in fade-in-50 duration-200">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-500" /> Section 1: Scope Data View
            </h4>

            {setViewMode && (
              <div className="space-y-3">
                {showInstructions && (
                  <span className="text-[10px] text-slate-450 dark:text-slate-550 font-bold block leading-relaxed">
                    Select which payment records represent your active dashboard state.
                  </span>
                )}

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Option 1: Personal Scope */}
                  <button
                    onClick={() => setViewMode('personal')}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col md:flex-row md:items-center gap-3.5 cursor-pointer group ${
                      viewMode === 'personal'
                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10 shadow-sm'
                        : 'border-slate-150 dark:border-slate-850 bg-white hover:bg-slate-50/50 dark:bg-slate-950 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                      viewMode === 'personal'
                        ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-455 group-hover:text-slate-700'
                    }`}>
                      <User className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          My Personal Scope
                        </span>
                        {viewMode === 'personal' && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
                            <Check className="w-1.5 h-1.5 text-white" />
                          </span>
                        )}
                      </div>
                      {showInstructions && (
                        <p className="text-[9.5px] text-slate-455 dark:text-slate-550 font-semibold leading-relaxed">
                          Filters the dashboard to show only payments created by your account.
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[9px] font-black">
                          {personalPayments.length} Active Records
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">•</span>
                        <span className="text-[9px] font-extrabold text-slate-600 dark:text-slate-350">
                          {summaryCurrency} {personalTotal.toFixed(2)}/mo
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Family Combined */}
                  <button
                    onClick={() => setViewMode('family-combined')}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col md:flex-row md:items-center gap-3.5 cursor-pointer group ${
                      viewMode === 'family-combined'
                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10 shadow-sm'
                        : 'border-slate-150 dark:border-slate-850 bg-white hover:bg-slate-50/50 dark:bg-slate-950 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                      viewMode === 'family-combined'
                        ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-455 group-hover:text-slate-700'
                    }`}>
                      <Users className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Family Combined Scope
                        </span>
                        {viewMode === 'family-combined' && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
                            <Check className="w-1.5 h-1.5 text-white" />
                          </span>
                        )}
                      </div>
                      {showInstructions && (
                        <p className="text-[9.5px] text-slate-455 dark:text-slate-550 font-semibold leading-relaxed">
                          Consolidates all family-member and personal payments in a single unified ledger.
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[9px] font-black">
                          {activePayments.length} Active Records
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">•</span>
                        <span className="text-[9px] font-extrabold text-slate-600 dark:text-slate-350">
                          {summaryCurrency} {combinedTotal.toFixed(2)}/mo
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Option 3: Family Only */}
                  <button
                    onClick={() => setViewMode('family-only')}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col md:flex-row md:items-center gap-3.5 cursor-pointer group ${
                      viewMode === 'family-only'
                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10 shadow-sm'
                        : 'border-slate-150 dark:border-slate-850 bg-white hover:bg-slate-55 bg-white hover:bg-slate-50/50 dark:bg-slate-950 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                      viewMode === 'family-only'
                        ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-455 group-hover:text-slate-700'
                    }`}>
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Family Members Only
                        </span>
                        {viewMode === 'family-only' && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
                            <Check className="w-1.5 h-1.5 text-white" />
                          </span>
                        )}
                      </div>
                      {showInstructions && (
                        <p className="text-[9.5px] text-slate-455 dark:text-slate-550 font-semibold leading-relaxed">
                          Excludes your own payments to audit items belonging exclusively to other family members.
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[9px] font-black">
                          {familyOnlyPayments.length} Active Records
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">•</span>
                        <span className="text-[9px] font-extrabold text-slate-600 dark:text-slate-350">
                          {summaryCurrency} {familyOnlyTotal.toFixed(2)}/mo
                        </span>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Cost Allocation Breakdown Bar */}
                {totalSum > 0 && (
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 rounded-xl p-3 text-left space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider">
                      <span className="text-slate-400 dark:text-slate-550">Cost Allocation Breakdown</span>
                      <span className="text-indigo-600 dark:text-indigo-400">
                        {personalPercentReal.toFixed(0)}% Personal / {familyPercentReal.toFixed(0)}% Family
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden flex">
                      <div 
                        className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-500" 
                        style={{ width: `${personalPercentReal}%` }} 
                      />
                      <div 
                        className="bg-purple-500 dark:bg-purple-600 h-full transition-all duration-500" 
                        style={{ width: `${familyPercentReal}%` }} 
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {['members', 'groups', 'chat'].includes(currentSubTab) && userProfile && (
        <div className="space-y-3.5 text-left animate-in fade-in-50 duration-250">
          {/* Section 2: Family Sharing (single, clean model) */}

          {familyRole && (
            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 rounded-xl p-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                {familyRole === 'host' ? 'You are the host of this family.' : familyRole === 'modify' ? 'You can view and edit this family\'s data.' : 'You have view-only access to this family.'}
              </span>
            </div>
          )}

          {/* Invite code / share panel — only the host sees the code and can invite */}
          {familyRole === 'host' && (
            <div className="bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" /> Your Family Invite Code
              </h4>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg font-mono text-sm font-bold tracking-widest text-center text-indigo-600 dark:text-indigo-400">
                  {inviteCode || '—'}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="p-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
                </button>
                <button
                  onClick={async () => { try { await onRegenerateInviteCode?.(); } catch (e: any) { setFamilyError(e.message); } }}
                  className="p-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                  title="Generate a new code"
                >
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Share this code with family members so they can join with either view-only or full edit access.</p>

              {/* Invite by email (logs a pending invitation they'll see when signed in) */}
              <form onSubmit={handleInviteMember} className="flex gap-2 pt-1">
                <input
                  type="email"
                  value={familyEmail}
                  onChange={(e) => setFamilyEmail(e.target.value)}
                  placeholder="family@email.com"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                />
                <select
                  value={familyEmailRole}
                  onChange={(e) => setFamilyEmailRole(e.target.value as 'view' | 'modify')}
                  className="px-2 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-semibold"
                >
                  <option value="modify">Can Edit</option>
                  <option value="view">View Only</option>
                </select>
                <button
                  type="submit"
                  disabled={familyLoading}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </form>
              {familyError && <p className="text-[10px] text-red-500 font-semibold">{familyError}</p>}
              {familySuccess && <p className="text-[10px] text-emerald-500 font-semibold">{familySuccess}</p>}
            </div>
          )}

          {/* Join a family by code — shown to anyone not already the host of one */}
          {familyRole !== 'host' && (
            <div className="bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-indigo-500" /> Join a Family
              </h4>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFamilyError(null); setFamilySuccess(null); setFamilyLoading(true);
                  try {
                    await onJoinFamilyGroup(joinGroupId);
                    setFamilySuccess('Joined family successfully!');
                    setJoinGroupId('');
                  } catch (err: any) {
                    setFamilyError(err.message || 'Failed to join family.');
                  } finally {
                    setFamilyLoading(false);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={joinGroupId}
                  onChange={(e) => setJoinGroupId(e.target.value.toUpperCase())}
                  placeholder="Enter invite code"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono tracking-widest"
                />
                <button
                  type="submit"
                  disabled={familyLoading || !joinGroupId.trim()}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  Join
                </button>
              </form>
            </div>
          )}

          {/* Pending invitations addressed to you */}
          {incomingInvitations.length > 0 && (
            <div className="bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Pending Invitations</h4>
              {incomingInvitations.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{inv.fromName}</p>
                    <p className="text-[10px] text-slate-500">Invited you as {inv.proposedRole === 'view' ? 'View Only' : 'Editor'}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => onApproveInvitation?.(inv.id, inv.proposedRole)} className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black rounded-md cursor-pointer">Accept</button>
                    <button onClick={() => onDeclineInvitation?.(inv.id)} className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black rounded-md cursor-pointer">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current members */}
          {familyMembers.length > 0 && (
            <div className="bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" /> Family Members ({familyMembers.length})
              </h4>
              {familyMembers.map(m => (
                <div key={m.uid} className="flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{m.displayName || m.email}</p>
                    <p className="text-[10px] text-slate-500">{m.isFamilyHost ? 'Host' : m.role === 'view' ? 'View Only' : 'Can Edit'}</p>
                  </div>
                  {familyRole === 'host' && !m.isFamilyHost && (
                    <div className="flex gap-1.5 shrink-0">
                      <select
                        value={m.role}
                        onChange={(e) => onUpdateMemberRole?.(m.uid, e.target.value as 'view' | 'modify')}
                        className="px-1.5 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-semibold"
                      >
                        <option value="modify">Can Edit</option>
                        <option value="view">View Only</option>
                      </select>
                      <button onClick={() => onRemoveFamilyMember?.(m.uid)} className="p-1.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-500 rounded-md cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {familyRole && familyRole !== 'host' && (
            <button
              onClick={() => onLeaveFamilyGroup?.()}
              className="w-full py-2.5 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
            >
              Leave Family
            </button>
          )}

          {isReadOnly && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">You have view-only access — the host can grant you edit access from their member list.</span>
            </div>
          )}
        </div>
      )}

  {currentSubTab === 'preferences' && (
    <>

      {/* CURRENCY & EXCHANGE RATE CONFIG (Premium Bento card styling) */}
      <div className="bg-white dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 shrink-0">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-900 pb-2.5">
          <Globe className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Currency & Exchange Rates</h4>
        </div>
        
        {/* Currency Switcher */}
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Default Currency</span>
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-md text-xs font-semibold gap-1 overflow-x-auto no-scrollbar">
            {countries.reduce((acc: CountryConfig[], c) => {
              if (!acc.some(item => item.currency.toUpperCase() === c.currency.toUpperCase())) {
                acc.push(c);
              }
              return acc;
            }, []).map((c) => (
              <button
                key={c.id}
                onClick={() => onSaveSummaryCurrency(c.currency)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                  summaryCurrency.toUpperCase() === c.currency.toUpperCase()
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{c.flag}</span>
                <span>{c.currency} ({c.symbol})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Exchange Rate Controller */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-900 pt-2.5">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
            Exchange Rate Relative to AUD
          </span>
          <div className="text-right">
            {isEditingRate ? (
              <form onSubmit={handleRateSubmit} className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  value={tempRate}
                  onChange={(e) => setTempRate(e.target.value)}
                  className="w-16 px-1.5 py-0.5 text-right text-xs bg-slate-150 dark:bg-slate-900 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-900 dark:text-white"
                  autoFocus
                />
                <button type="submit" className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded font-bold cursor-pointer">Set</button>
              </form>
            ) : (
              <button 
                onClick={() => {
                  setTempRate(rate.toString());
                  setIsEditingRate(true);
                }}
                className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                1 AUD = <span className="underline decoration-dotted font-semibold">{rate} INR</span>
                {summaryCurrency !== 'AUD' && summaryCurrency !== 'INR' && (
                  <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                    (1 AUD = {countries.find(c => c.currency === summaryCurrency)?.rateToAUD || 1} {summaryCurrency})
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {currentSubTab === 'security' && (
        <>
          {/* BILLING ALERTS & NOTIFICATIONS CONFIG (Premium Bento card styling) */}
          <div className="bg-white dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 shrink-0">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-900 pb-2.5">
          <Bell className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Billing Alerts & Reminders</h4>
        </div>
        
        {showInstructions && (
          <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold leading-normal text-left">
            Toggle where and how you receive payment reminders before and on due dates.
          </p>
        )}

        <div className="space-y-3.5">
          {/* Toggle Option 1: App-Level Notifications */}
          <div className="flex items-center justify-between py-1">
            <div className="text-left pr-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">App-Level Notification Banners</span>
              {showInstructions && (
                <span className="text-[9px] text-slate-450 dark:text-slate-500 block mt-0.5 font-bold">Show sliding banners and sound alerts inside the web application UI</span>
              )}
            </div>
            <button
              onClick={() => onSaveNotificationSettings?.(!appNotificationsEnabled, mobileNotificationsEnabled)}
              className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
                appNotificationsEnabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            >
              <div
                className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transform duration-200 ease-in-out ${
                  appNotificationsEnabled ? 'translate-x-4.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Toggle Option 2: Mobile/Push Level Notifications */}
          <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-900/60 pt-3">
            <div className="text-left pr-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">Mobile / Push Level Notifications</span>
              {showInstructions && (
                <span className="text-[9px] text-slate-450 dark:text-slate-500 block mt-0.5 font-bold">Trigger native browser-level push banners simulating mobile OS notifications</span>
              )}
            </div>
            <button
              onClick={() => onSaveNotificationSettings?.(appNotificationsEnabled, !mobileNotificationsEnabled)}
              className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
                mobileNotificationsEnabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            >
              <div
                className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transform duration-200 ease-in-out ${
                  mobileNotificationsEnabled ? 'translate-x-4.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Action buttons (Authorize, Test Alert) */}
        <div className="flex gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-900">
          <button 
            onClick={onTriggerTestNotif}
            className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
          >
            Test Alert
          </button>
          <button 
            onClick={onRequestNotifications}
            className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
          >
            Authorize Native
          </button>
        </div>
      </div>
    </>
  )}

      {currentSubTab === 'preferences' && (
        <>
          {/* APP DISPLAY SETTINGS (Premium Bento card styling) */}
          <div className="bg-white dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 shrink-0">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-900 pb-2.5">
          <History className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Display Preferences</h4>
        </div>
        
        {showInstructions && (
          <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold leading-normal text-left">
            Customize what information is shown across your active bill cards.
          </p>
        )}

        <div className="space-y-3.5">
          <div className="flex items-center justify-between py-1">
            <div className="text-left pr-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">Historical Billing Patterns</span>
              {showInstructions && (
                <span className="text-[9px] text-slate-450 dark:text-slate-500 block mt-0.5 font-bold">Show frequency indicators, 6-month visual payment tracks, and last-logged stats on bill cards</span>
              )}
            </div>
            <button
              onClick={() => onToggleFrequencyPatterns?.(!showFrequencyPatterns)}
              className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
                showFrequencyPatterns ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            >
              <div
                className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transform duration-200 ease-in-out ${
                  showFrequencyPatterns ? 'translate-x-4.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* BENEFICIARY / PERSON TAGS CONFIG (Moved from ConfigurePayments page for visual simplification) */}
      <div className="bg-white dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 shrink-0">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-900 pb-2.5">
          <Settings className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Beneficiary / Person Tags Manager</h4>
        </div>
        {showInstructions && (
          <p className="text-[10px] text-slate-450 dark:text-slate-450 font-bold leading-normal">
            Customize default tagging labels (e.g. Father, Mother, Self) so each person's transactions are tracked with their customized identity tags.
          </p>
        )}

        {/* Input to add tag */}
        <div className="flex gap-2">
          <input
            type="text"
            id="new-tag-input-config"
            placeholder="Add customized tag (e.g. Dad, Mom)..."
            className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const val = (e.target as HTMLInputElement).value.trim();
                if (val && customizedTags && onSaveCustomizedTags) {
                  if (customizedTags.some(t => t.toLowerCase() === val.toLowerCase())) {
                    alert('Tag already exists!');
                    return;
                  }
                  onSaveCustomizedTags([...customizedTags, val]);
                  (e.target as HTMLInputElement).value = '';
                }
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.getElementById('new-tag-input-config') as HTMLInputElement;
              const val = input?.value.trim();
              if (val && customizedTags && onSaveCustomizedTags) {
                if (customizedTags.some(t => t.toLowerCase() === val.toLowerCase())) {
                  alert('Tag already exists!');
                  return;
                }
                onSaveCustomizedTags([...customizedTags, val]);
                input.value = '';
              }
            }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
          >
            Add
          </button>
        </div>

        {/* List of tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {customizedTags.map((tag) => (
            <div 
              key={tag}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-sm"
            >
              <span>{tag}</span>
              <button
                onClick={() => {
                  if (customizedTags && onSaveCustomizedTags) {
                    if (confirm(`Are you sure you want to delete the tag "${tag}"?`)) {
                      onSaveCustomizedTags(customizedTags.filter(t => t !== tag));
                    }
                  }
                }}
                className="text-slate-400 hover:text-rose-500 font-extrabold focus:outline-none cursor-pointer"
                title="Remove tag"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Visual Theme Selection (Premium High Density Cards) */}
      <div className="bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-indigo-500" /> App Visual Theme
        </h4>
        {showInstructions && (
          <p className="text-[10px] text-slate-450 block mb-1 leading-tight text-left font-bold">
            Select your preferred viewing mode for the PayMonitor interface:
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onThemeChange('light')}
            className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
              theme === 'light'
                ? 'border-indigo-600 bg-indigo-50/45 dark:bg-indigo-950/25 text-indigo-600 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] font-bold block leading-tight">Light Canvas</span>
                <span className="text-[8px] text-slate-450 block leading-none mt-0.5">High-contrast white</span>
              </div>
            </div>
            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
              theme === 'light' ? 'border-indigo-600' : 'border-slate-300 dark:border-slate-700'
            }`}>
              {theme === 'light' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
            </div>
          </button>

          <button
            onClick={() => onThemeChange('dark')}
            className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-indigo-500 bg-indigo-950/35 text-indigo-400'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] font-bold block leading-tight">Dark Slate</span>
                <span className="text-[8px] text-slate-450 block leading-none mt-0.5">Eye-safe obsidian</span>
              </div>
            </div>
            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
              theme === 'dark' ? 'border-indigo-500' : 'border-slate-300 dark:border-slate-700'
            }`}>
              {theme === 'dark' && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
            </div>
          </button>
        </div>
      </div>
        </>
      )}

      {currentSubTab === 'security' && (
        <>
          {/* Backup and Restore Utilities Accordion (High Density Styled Cards) */}
          <div className="bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 shrink-0">
        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-indigo-500" /> Backup, Sync & Danger Zone
        </h4>

        {/* Option 1: Export Data */}
        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-900/60">
          <div className="text-left pr-3">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">Download Data Backup</span>
            {showInstructions && (
              <span className="text-[9px] text-slate-450 dark:text-slate-500 block mt-0.5 font-bold">Save your complete configured billing tracks and schedules locally as a JSON backup.</span>
            )}
          </div>
          <button 
            onClick={handleExportData}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 text-[10.5px] font-black uppercase tracking-wider rounded-lg border border-slate-200 dark:border-slate-850/60 shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>

        {/* Option 2: Import / Restore Data */}
        <div className="py-2.5 space-y-2">
          <div className="text-left">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">Restore From Backup File</span>
            {showInstructions && (
              <span className="text-[9px] text-slate-450 dark:text-slate-500 block mt-0.5 font-bold">Paste a previously downloaded billing configuration file below to replace your workspace data.</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste backup JSON contents here..."
              rows={2}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-mono outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
            <div className="flex justify-end gap-1.5">
              <button
                onClick={handleImportData}
                disabled={!importText.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10.5px] font-black uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload & Apply</span>
              </button>
            </div>
          </div>
          {importStatus && (
            <div className={`p-2 rounded text-[10px] font-bold ${
              importStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20'
            }`}>
              {importStatus.message}
            </div>
          )}
        </div>
      </div>
    </>
  )}

      {/* Account Owner & Sign Out (Extremely simplified footer) */}
      <div className="bg-white dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold shrink-0">
            {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate leading-tight">
              {userProfile?.displayName || 'User Profile'}
            </span>
            <span className="text-[9px] text-slate-400 block truncate leading-none mt-0.5">
              {userProfile?.email}
            </span>
          </div>
        </div>
        <button
          onClick={onLogOut}
          className="px-2.5 py-1.5 text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 text-[10px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

    </div>
  );
}
