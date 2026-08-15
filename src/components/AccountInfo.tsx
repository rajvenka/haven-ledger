import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
  Edit2,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  MessageSquare,
  Send,
  Trash2,
  ShieldCheck,
  X,
  ChevronDown,
  ChevronUp,
  Home,
  Briefcase
} from 'lucide-react';
import { RecurringPayment, Currency, UserProfile, CountryConfig, FamilyInvitation } from '../types';

interface AccountInfoProps {
  payments: RecurringPayment[];
  onAddBulkPayments?: (payments: Omit<RecurringPayment, 'id'>[]) => Promise<void>;
  onStartWhatsAppVerification?: (phone: string) => Promise<string>;
  onUpdateDisplayName?: (name: string) => Promise<void>;
  portfolios?: any[];
  onSwitchToMultiPortfolio?: (baseCurrency: string) => Promise<void>;
  onCreatePortfolio?: (name: string, currency: string) => Promise<void>;
  onUpdatePortfolio?: (id: string, updates: { name?: string; currency?: string; is_default?: boolean; display_order?: number }) => Promise<void>;
  onReorderPortfolio?: (portfolioId: string, direction: 'up' | 'down') => Promise<void>;
  onDeletePortfolio?: (id: string) => Promise<void>;
  workspaceCurrencyRates?: any[];
  onUpsertCurrencyRate?: (currency: string, rateToBase: number) => Promise<void>;
  currentLandingTab?: string | null;
  onUpdateLandingTab?: (tab: string | null) => Promise<void>;
  hasFeature?: (feature: string) => boolean;
  onDisconnectWhatsApp?: () => Promise<void>;
  onUpdateDigestPrefs?: (prefs: { digestEmail?: boolean; digestWhatsapp?: boolean }) => Promise<void>;
  accessPlans?: { id: string; name: string; description?: string; features: string[]; isSystem: boolean }[];
  myUpgradeRequest?: { id: string; planName: string; status: string } | null;
  onRequestUpgrade?: (planId: string) => Promise<void>;
  workspaceBackups?: { id: string; created_at: string; snapshot: any }[];
  onRestoreFromBackup?: (backupId: string) => Promise<void>;
  userProfile: UserProfile | null;
  familyMembers: UserProfile[];
  familyRole?: 'host' | 'modify' | 'view' | null;
  isReadOnly?: boolean;
  onAddFamilyMember: (email: string, role?: 'view' | 'modify', accessLevel?: 'full' | 'limited', features?: string[]) => Promise<void>;
  onCreateFamily?: () => Promise<void>;
  activeWorkspace?: { id: string; name: string; type: 'family' | 'business'; role: string; isOwner: boolean; portfolioMode?: 'single' | 'multiple'; baseCurrency?: string } | null;
  onRenameWorkspace?: (id: string, name: string) => Promise<void>;
  onUpdateWorkspaceBaseCurrency?: (id: string, currency: string) => Promise<void>;
  onDeleteWorkspace?: (id: string) => Promise<void>;
  onJoinFamilyGroup: (code: string) => Promise<void>;
  onLeaveFamilyGroup?: () => Promise<void>;
  incomingInvitations?: FamilyInvitation[];
  onApproveInvitation?: (invitationId: string, role: 'view' | 'modify') => Promise<void>;
  onDeclineInvitation?: (invitationId: string) => Promise<void>;
  onUpdateMemberRole?: (memberUid: string, role: 'view' | 'modify') => Promise<void>;
  onUpdateMemberPortfolioContributor?: (memberUid: string, isContributor: boolean) => Promise<void>;
  onRemoveFamilyMember?: (memberUid: string) => Promise<void>;
  outgoingInvitations?: { id: string; toEmail: string; proposedRole: string; createdAt: string }[];
  onCancelInvitation?: (invitationId: string) => Promise<void>;
  inviteCode?: string;
  onRegenerateInviteCode?: () => Promise<void>;
  onLogOut: () => Promise<void>;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  countries: CountryConfig[];
  onAddCountry?: (country: Omit<CountryConfig, 'id'>) => Promise<void>;
  onDeleteCountry?: (id: string) => Promise<void>;
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
  pulseMode?: boolean;
}

export default function AccountInfo({
  payments,
  onAddBulkPayments,
  onStartWhatsAppVerification,
  onUpdateDisplayName,
  portfolios = [],
  onSwitchToMultiPortfolio,
  onCreatePortfolio,
  onUpdatePortfolio,
  onReorderPortfolio,
  onDeletePortfolio,
  workspaceCurrencyRates = [],
  onUpsertCurrencyRate,
  currentLandingTab,
  onUpdateLandingTab,
  hasFeature,
  onDisconnectWhatsApp,
    onUpdateDigestPrefs,
  accessPlans = [],
  myUpgradeRequest,
  onRequestUpgrade,
  workspaceBackups = [],
  onRestoreFromBackup,
  userProfile,
  familyMembers,
  familyRole = null,
  isReadOnly = false,
  onAddFamilyMember,
  onCreateFamily,
  activeWorkspace,
  onRenameWorkspace,
  onUpdateWorkspaceBaseCurrency,
  onDeleteWorkspace,
  onJoinFamilyGroup,
  onLeaveFamilyGroup,
  incomingInvitations = [],
  onApproveInvitation,
  onDeclineInvitation,
  onUpdateMemberRole,
  onUpdateMemberPortfolioContributor,
  onRemoveFamilyMember,
  outgoingInvitations = [],
  onCancelInvitation,
  inviteCode = '',
  onRegenerateInviteCode,
  onLogOut,
  theme,
  onThemeChange,
  countries = [],
  onAddCountry,
  onDeleteCountry,
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
  pulseMode = false,
}: AccountInfoProps) {
  const [localActiveSubTab, setLocalActiveSubTab] = useState<'preferences' | 'security' | 'members' | 'groups' | 'chat' | 'invite'>('preferences');
  const [digestPreview, setDigestPreview] = useState<{ loading: boolean; text: string | null; error: string | null }>({ loading: false, text: null, error: null });
  const currentSubTab = activeSubTab !== undefined ? activeSubTab : localActiveSubTab;
  const setSubTab = onActiveSubTabChange || setLocalActiveSubTab;
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Rate editor state
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState('');
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [newCurrencyRate, setNewCurrencyRate] = useState('');
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [currencyBusy, setCurrencyBusy] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waCode, setWaCode] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const [waBusy, setWaBusy] = useState(false);

  const handleStartWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaError(null);
    setWaBusy(true);
    try {
      const code = await onStartWhatsAppVerification?.(waPhone);
      setWaCode(code || null);
    } catch (err: any) {
      setWaError(err.message || 'Could not start verification.');
    } finally {
      setWaBusy(false);
    }
  };

  const handleAddCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrencyError(null);
    const code = newCurrencyCode.trim().toUpperCase();
    const symbol = newCurrencySymbol.trim();
    const name = newCurrencyName.trim() || code;
    const rateVal = parseFloat(newCurrencyRate);
    if (!code || code.length < 2) { setCurrencyError('Enter a currency code, e.g. USD.'); return; }
    if (!symbol) { setCurrencyError('Enter a symbol, e.g. $'); return; }
    if (!rateVal || rateVal <= 0) { setCurrencyError('Enter a valid exchange rate to AUD.'); return; }
    setCurrencyBusy(true);
    try {
      await onAddCountry?.({ name, currency: code, symbol, flag: '💱', rateToAUD: rateVal });
      setNewCurrencyCode(''); setNewCurrencySymbol(''); setNewCurrencyName(''); setNewCurrencyRate('');
      setShowAddCurrency(false);
    } catch (err: any) {
      setCurrencyError(err.message || 'Could not add currency.');
    } finally {
      setCurrencyBusy(false);
    }
  };

  const handleDeleteCurrency = async (id: string) => {
    setCurrencyError(null);
    try {
      await onDeleteCountry?.(id);
    } catch (err: any) {
      setCurrencyError(err.message || 'Could not delete currency.');
    }
  };

  
  // Family forms state
  const [familyEmail, setFamilyEmail] = useState('');
  const [familyEmailRole, setFamilyEmailRole] = useState<'view' | 'modify'>('modify');
  const [inviteStep, setInviteStep] = useState<1 | 2 | 3>(1);
  const [confirmingMultiPortfolio, setConfirmingMultiPortfolio] = useState(false);
  const [chosenBaseCurrency, setChosenBaseCurrency] = useState('INR');
  const [switchingPortfolioMode, setSwitchingPortfolioMode] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [renamingPortfolioId, setRenamingPortfolioId] = useState<string | null>(null);
  const [renamePortfolioInput, setRenamePortfolioInput] = useState('');
  const [editCurrencyInput, setEditCurrencyInput] = useState('');
  const [newPortfolioCurrency, setNewPortfolioCurrency] = useState('INR');
  const [addingPortfolio, setAddingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [editingRateCurrency, setEditingRateCurrency] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [accessChoice, setAccessChoice] = useState<'same' | 'custom' | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState(userProfile?.displayName || '');
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [displayNameSaved, setDisplayNameSaved] = useState(false);
  const [landingTabSaving, setLandingTabSaving] = useState(false);
  const [landingTabSaved, setLandingTabSaved] = useState(false);
  const [respondingInvId, setRespondingInvId] = useState<string | null>(null);
  const [isRenamingWorkspace, setIsRenamingWorkspace] = useState(false);
  const [workspaceRenameValue, setWorkspaceRenameValue] = useState('');
  const [isEditingBaseCurrency, setIsEditingBaseCurrency] = useState(false);
  const [baseCurrencyInput, setBaseCurrencyInput] = useState('');
  const [workspaceActionBusy, setWorkspaceActionBusy] = useState(false);
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null);
  const ALL_FEATURES = ['income', 'rewards', 'ai', 'team', 'chat', 'agent', 'whatsapp', 'portfolio'];
  const myAvailableFeatures = userProfile?.isSuperAdmin ? ALL_FEATURES : (userProfile?.licensePlanFeatures ?? ALL_FEATURES);
  const hasWhatsApp = userProfile?.isSuperAdmin || (userProfile?.licensePlanFeatures ?? []).includes('whatsapp');
  const [familyFeatures, setFamilyFeatures] = useState<string[]>([]);

  useEffect(() => {
    // Nothing pre-selected by default - the inviter explicitly picks what to grant rather
    // than starting from a copy of their own plan, which could otherwise be granted by
    // accident without a deliberate choice.
    setFamilyFeatures([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.licensePlanFeatures?.join(',')]);
  const toggleFeature = (f: string) => setFamilyFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  const FEATURE_META: Record<string, string> = { income: 'Income', rewards: 'Membership', ai: 'AI Insights', team: 'Workspace Config', chat: 'Family Chat', agent: 'AI Agent', whatsapp: 'WhatsApp', portfolio: 'Finance' };
  const [joinGroupId, setJoinGroupId] = useState('');
  const [copied, setCopied] = useState(false);
  const [familyError, setFamilyError] = useState<string | null>(null);
  const [familySuccess, setFamilySuccess] = useState<string | null>(null);
  const [familyLoading, setFamilyLoading] = useState(false);

  // Toggle state for instructions
  const [showInstructions, setShowInstructions] = useState(() => {
    const val = localStorage.getItem('pm_show_instructions');
    return val === null ? false : val === 'true';
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
      const accessLevel = familyFeatures.length >= ALL_FEATURES.length ? 'full' : 'limited';
      await onAddFamilyMember(familyEmail, familyEmailRole, accessLevel, familyFeatures);
      setFamilySuccess(`Successfully sent workspace invitation to "${familyEmail}"!`);
      setFamilyEmail('');
      setInviteStep(1);
      setAccessChoice(null);
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
  const handleImportData = async () => {
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
        typeof item.currency === 'string' &&
        typeof item.dayOfMonth === 'number'
      );

      if (!isValid) {
        throw new Error('Invalid payment objects detected in backup.');
      }

      const processed = parsed.map((p) => ({
        name: p.name,
        amount: p.amount,
        currency: p.currency,
        category: p.category || 'Other',
        dayOfMonth: p.dayOfMonth,
        active: typeof p.active === 'boolean' ? p.active : true,
        reminderDaysBefore: typeof p.reminderDaysBefore === 'number' ? p.reminderDaysBefore : 3,
        billingCycle: p.billingCycle || 'monthly',
        paymentMethod: p.paymentMethod || 'manual',
        paymentType: p.paymentType || 'fixed',
        notes: p.notes,
        taggedFor: p.taggedFor,
        autoRenew: p.autoRenew,
      }));

      if (!onAddBulkPayments) throw new Error('Import is unavailable right now.');
      await onAddBulkPayments(processed);
      setImportStatus({ type: 'success', message: `Imported ${processed.length} payment(s) successfully!` });
      setImportText('');
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

  const settingsPageTitle =
    currentSubTab === 'security'
      ? 'Account Security'
      : currentSubTab === 'members' || currentSubTab === 'groups' || currentSubTab === 'chat'
        ? 'Workspace & team'
        : currentSubTab === 'invite'
          ? 'Invitations'
          : 'Preferences';
  const settingsPageBlurb =
    currentSubTab === 'security'
      ? 'Password · data scope · backups'
      : currentSubTab === 'members' || currentSubTab === 'groups' || currentSubTab === 'chat'
        ? 'Members · roles · invite code'
        : 'Theme · digests · workspace defaults';
  /** Pulse: hide long instruction copy; Classic keeps Tips toggle */
  const tipsOn = !pulseMode && showInstructions;
  const sectionCardClass = pulseMode
    ? 'bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-sm'
    : 'bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm';

  return (
    <div
      className={
        pulseMode
          ? 'flex-1 flex flex-col overflow-y-auto px-4 sm:px-5 pt-3 pb-24 md:pb-4 space-y-4 text-left bg-slate-50 dark:bg-slate-950'
          : 'flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-4 text-left bg-slate-50 dark:bg-slate-900'
      }
    >
      {pulseMode ? (
        <div className="flex items-start justify-between gap-3 shrink-0 mb-1">
          <div className="min-w-0">
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white truncate">{settingsPageTitle}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{settingsPageBlurb}</p>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center px-1 shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="w-4.5 h-4.5 text-indigo-600" />
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Haven Vault Config</h3>
          </div>
          <button onClick={() => handleToggleInstructions(!showInstructions)} className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-indigo-600 dark:text-slate-400 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm cursor-pointer">
            {showInstructions ? (<><EyeOff className="w-3.5 h-3.5 text-slate-400" /><span>Hide Instructions</span></>) : (<><Eye className="w-3.5 h-3.5 text-indigo-500" /><span>Show Instructions</span></>)}
          </button>
        </div>
      )}

      {/* Scope Data View shown inside Security */}
      {currentSubTab === 'security' && (
        <>
          {/* Data scope */}
          <div className={`${sectionCardClass} space-y-3.5 text-left animate-in fade-in-50 duration-200`}>
            <h4 className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-500" /> Data scope
            </h4>

            {setViewMode && (
              <div className="space-y-3">
                {tipsOn && (
                  <span className="text-[10px] text-slate-450 dark:text-slate-550 font-bold block leading-relaxed">
                    What appears on your dashboard.
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
                          Personal only
                        </span>
                        {viewMode === 'personal' && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
                            <Check className="w-1.5 h-1.5 text-white" />
                          </span>
                        )}
                      </div>
                      {tipsOn && (
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
                          Workspace Combined Scope
                        </span>
                        {viewMode === 'family-combined' && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
                            <Check className="w-1.5 h-1.5 text-white" />
                          </span>
                        )}
                      </div>
                      {tipsOn && (
                        <p className="text-[9.5px] text-slate-455 dark:text-slate-550 font-semibold leading-relaxed">
                          Consolidates all workspace-member and personal payments in a single unified ledger.
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
                          Workspace Members Only
                        </span>
                        {viewMode === 'family-only' && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
                            <Check className="w-1.5 h-1.5 text-white" />
                          </span>
                        )}
                      </div>
                      {tipsOn && (
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
                        {personalPercentReal.toFixed(0)}% Personal / {familyPercentReal.toFixed(0)}% Workspace
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
                {familyRole === 'host' ? 'You are the host of this workspace.' : familyRole === 'modify' ? 'You can view and edit this workspace\'s data.' : 'You have view-only access to this workspace.'}
              </span>
            </div>
          )}

          {activeWorkspace && (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center gap-2">
              {activeWorkspace.type === 'business' ? <Briefcase className="w-4 h-4 text-slate-500 shrink-0" /> : <Home className="w-4 h-4 text-slate-500 shrink-0" />}
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Type: {activeWorkspace.type === 'business' ? 'Business' : 'Family'}
              </span>
            </div>
          )}

          {activeWorkspace && (
            <div className={`${sectionCardClass} space-y-3`}>
              <h4 className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-500" /> Portfolio Mode
              </h4>

              {activeWorkspace.portfolioMode !== 'multiple' ? (
                <>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Single Portfolio - the way it works today, one combined set of holdings for this workspace. No change unless you switch below.
                  </p>
                  {familyRole === 'host' && (!hasFeature || hasFeature('multi_portfolio')) && (
                    confirmingMultiPortfolio ? (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3 space-y-2">
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                          This creates a "Default Portfolio" containing everything you have today, then unlocks separate portfolios (e.g. one per currency) alongside it. This can't be undone once switched.
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Default currency (used for combined "All" totals):</span>
                          <select
                            value={chosenBaseCurrency}
                            onChange={(e) => setChosenBaseCurrency(e.target.value)}
                            className="px-2 py-1 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 rounded-md text-[10px] font-bold"
                          >
                            {['INR', 'USD', 'AUD', 'EUR', 'GBP', 'SGD', 'AED', 'CAD'].map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              setSwitchingPortfolioMode(true);
                              try {
                                await onSwitchToMultiPortfolio?.(chosenBaseCurrency);
                                setConfirmingMultiPortfolio(false);
                              } catch (err: any) {
                                setPortfolioError(err.message || 'Failed to switch.');
                              } finally {
                                setSwitchingPortfolioMode(false);
                              }
                            }}
                            disabled={switchingPortfolioMode}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer"
                          >
                            {switchingPortfolioMode ? 'Switching…' : 'Yes, Switch to Multiple'}
                          </button>
                          <button onClick={() => setConfirmingMultiPortfolio(false)} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 text-[10px] font-black uppercase rounded-lg cursor-pointer">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingMultiPortfolio(true)}
                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer"
                      >
                        Switch to Multiple Portfolio →
                      </button>
                    )
                  )}
                  {familyRole === 'host' && hasFeature && !hasFeature('multi_portfolio') && (
                    <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 rounded-lg p-2.5 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-semibold">Multiple portfolios need Pro Max.</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Multiple Portfolio - manage separate portfolios below (e.g. one per currency). Tap the edit icon to change a portfolio's name or currency together - changing currency only relabels the portfolio, it doesn't convert or recalculate any existing holdings.</p>
                  <div className="space-y-1.5">
                    {portfolios.map((p, pIndex) => (
                      <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs">
                        {renamingPortfolioId === p.id ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={renamePortfolioInput}
                              onChange={(e) => setRenamePortfolioInput(e.target.value)}
                              autoFocus
                              className="flex-1 min-w-0 px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
                            />
                            <select
                              value={editCurrencyInput}
                              onChange={(e) => setEditCurrencyInput(e.target.value)}
                              className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold shrink-0"
                            >
                              {['INR', 'USD', 'AUD', 'EUR', 'GBP', 'SGD', 'AED', 'CAD'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button
                              onClick={async () => {
                                if (!renamePortfolioInput.trim()) return;
                                try {
                                  await onUpdatePortfolio?.(p.id, { name: renamePortfolioInput.trim(), currency: editCurrencyInput });
                                  setRenamingPortfolioId(null);
                                } catch (err: any) {
                                  setPortfolioError(err.message);
                                }
                              }}
                              className="p-1 bg-indigo-600 text-white rounded-md cursor-pointer shrink-0"
                            ><Check className="w-3 h-3" /></button>
                            <button onClick={() => setRenamingPortfolioId(null)} className="p-1 text-slate-400 cursor-pointer shrink-0"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {familyRole === 'host' && (
                              <div className="flex flex-col shrink-0">
                                <button
                                  onClick={() => onReorderPortfolio?.(p.id, 'up')}
                                  disabled={pIndex === 0}
                                  className="text-slate-300 hover:text-indigo-500 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer leading-none"
                                  title="Move up"
                                ><ChevronUp className="w-3 h-3" /></button>
                                <button
                                  onClick={() => onReorderPortfolio?.(p.id, 'down')}
                                  disabled={pIndex === portfolios.length - 1}
                                  className="text-slate-300 hover:text-indigo-500 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer leading-none"
                                  title="Move down"
                                ><ChevronDown className="w-3 h-3" /></button>
                              </div>
                            )}
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              {p.name}{' '}
                              <span className="text-[9px] text-slate-400 font-bold">{p.currency}</span>
                              {p.is_default && <span className="text-[8px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full font-black uppercase">Default</span>}
                            </span>
                            {familyRole === 'host' && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => { setRenamingPortfolioId(p.id); setRenamePortfolioInput(p.name); setEditCurrencyInput(p.currency); }}
                                  className="text-slate-300 hover:text-indigo-500 cursor-pointer"
                                  title="Edit name and currency"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {!p.is_default && (
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm(`Delete "${p.name}" and all of its holdings/data? This can't be undone.`)) return;
                                      try { await onDeletePortfolio?.(p.id); } catch (err: any) { setPortfolioError(err.message); }
                                    }}
                                    className="text-slate-300 hover:text-rose-500 cursor-pointer"
                                    title="Delete portfolio"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {familyRole === 'host' && (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newPortfolioName}
                        onChange={(e) => setNewPortfolioName(e.target.value)}
                        placeholder="e.g. US Portfolio"
                        className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px]"
                      />
                      <select
                        value={newPortfolioCurrency}
                        onChange={(e) => setNewPortfolioCurrency(e.target.value)}
                        className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-semibold"
                      >
                        {['INR', 'USD', 'AUD', 'EUR', 'GBP', 'SGD', 'AED', 'CAD'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button
                        onClick={async () => {
                          if (!newPortfolioName.trim()) return;
                          setAddingPortfolio(true);
                          setPortfolioError(null);
                          try {
                            await onCreatePortfolio?.(newPortfolioName.trim(), newPortfolioCurrency);
                            setNewPortfolioName('');
                          } catch (err: any) {
                            setPortfolioError(err.message || 'Failed to add portfolio.');
                          } finally {
                            setAddingPortfolio(false);
                          }
                        }}
                        disabled={addingPortfolio || !newPortfolioName.trim()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  )}

                  {/* Exchange rates only matter once more than one currency is actually in
                      play - stays hidden otherwise so single-currency multi-portfolio setups
                      never see this at all. */}
                  {new Set(portfolios.map(p => p.currency)).size > 1 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-900 space-y-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Rates vs {activeWorkspace.baseCurrency}</span>
                      {Array.from(new Set(portfolios.map(p => p.currency))).filter(c => c !== activeWorkspace.baseCurrency).map(currency => {
                        const existing = workspaceCurrencyRates.find(r => r.currency === currency);
                        return (
                          <div key={currency} className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">1 {currency} =</span>
                            {editingRateCurrency === currency ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={rateInput}
                                  onChange={(e) => setRateInput(e.target.value)}
                                  placeholder="e.g. 83"
                                  className="w-20 px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[10px]"
                                />
                                <span className="text-slate-400 text-[10px]">{activeWorkspace.baseCurrency}</span>
                                <button
                                  onClick={async () => {
                                    const val = parseFloat(rateInput);
                                    if (!val || val <= 0) return;
                                    try {
                                      await onUpsertCurrencyRate?.(currency, val);
                                      setEditingRateCurrency(null);
                                    } catch (err: any) {
                                      setPortfolioError(err.message);
                                    }
                                  }}
                                  className="p-1 bg-indigo-600 text-white rounded-md cursor-pointer"
                                ><Check className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingRateCurrency(currency); setRateInput(existing ? String(existing.rate_to_base) : ''); }}
                                className="font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
                              >
                                {existing ? `${existing.rate_to_base} ${activeWorkspace.baseCurrency}` : `Set rate →`}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              {portfolioError && <p className="text-[10px] text-red-500 font-semibold">{portfolioError}</p>}
            </div>
          )}

          {activeWorkspace?.isOwner && (
            <div className="bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">This workspace</span>
              {isRenamingWorkspace ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!workspaceRenameValue.trim() || !activeWorkspace) return;
                    setWorkspaceActionError(null);
                    setWorkspaceActionBusy(true);
                    try {
                      await onRenameWorkspace?.(activeWorkspace.id, workspaceRenameValue.trim());
                      setIsRenamingWorkspace(false);
                    } catch (err: any) {
                      setWorkspaceActionError(err.message || 'Could not rename workspace.');
                    } finally {
                      setWorkspaceActionBusy(false);
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    type="text"
                    value={workspaceRenameValue}
                    onChange={(e) => setWorkspaceRenameValue(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                  <button type="submit" disabled={workspaceActionBusy} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer">Save</button>
                  <button type="button" onClick={() => setIsRenamingWorkspace(false)} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer">Cancel</button>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{activeWorkspace.name}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { setWorkspaceRenameValue(activeWorkspace.name); setIsRenamingWorkspace(true); }}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
                    >
                      Rename
                    </button>
                    <button
                      onClick={async () => {
                        if (!activeWorkspace) return;
                        if (!window.confirm(`Delete "${activeWorkspace.name}" and all of its data? This can't be undone.`)) return;
                        setWorkspaceActionError(null);
                        setWorkspaceActionBusy(true);
                        try {
                          await onDeleteWorkspace?.(activeWorkspace.id);
                        } catch (err: any) {
                          setWorkspaceActionError(err.message || 'Could not delete workspace.');
                        } finally {
                          setWorkspaceActionBusy(false);
                        }
                      }}
                      disabled={workspaceActionBusy}
                      className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-900">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Base Currency</span>
                  <span className="text-[9px] text-slate-400">Drives every cross-currency total on Portfolio. Existing exchange rates stay tied to whatever currency you set.</span>
                </div>
                {isEditingBaseCurrency ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={baseCurrencyInput}
                      onChange={(e) => setBaseCurrencyInput(e.target.value)}
                      autoFocus
                      className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                    >
                      {['INR', 'USD', 'AUD', 'EUR', 'GBP', 'SGD', 'AED', 'CAD'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      onClick={async () => {
                        if (!activeWorkspace) return;
                        setWorkspaceActionError(null);
                        setWorkspaceActionBusy(true);
                        try {
                          await onUpdateWorkspaceBaseCurrency?.(activeWorkspace.id, baseCurrencyInput);
                          setIsEditingBaseCurrency(false);
                        } catch (err: any) {
                          setWorkspaceActionError(err.message || 'Could not update base currency.');
                        } finally {
                          setWorkspaceActionBusy(false);
                        }
                      }}
                      disabled={workspaceActionBusy}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg cursor-pointer"
                    ><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setIsEditingBaseCurrency(false)} className="p-1.5 text-slate-400 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setBaseCurrencyInput(activeWorkspace.baseCurrency || 'INR'); setIsEditingBaseCurrency(true); }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer shrink-0"
                  >
                    {activeWorkspace.baseCurrency || 'INR'}
                  </button>
                )}
              </div>
              {workspaceActionError && <p className="text-[10px] text-red-500 font-semibold">{workspaceActionError}</p>}
              <p className="text-[9px] text-slate-400">You can also switch, rename, or delete workspaces from the switcher next to your workspace name at the top.</p>
            </div>
          )}
          {/* Invite code / share panel — hosts see it, and solo users can create a family to get one */}
          {(familyRole === 'host' || !familyRole) && (
            <div className={`${sectionCardClass} space-y-3`}>
              <h4 className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" /> Your Workspace Invite Code
              </h4>

              {!inviteCode ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">You don't have a family yet. Create one to get a code you can share.</p>
                  <button
                    onClick={async () => { setFamilyError(null); try { await onCreateFamily?.(); } catch (e: any) { setFamilyError(e.message); } }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                  >
                    Create My Workspace
                  </button>
                </div>
              ) : (
                <>
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

              {/* Invite by email (logs a pending invitation they'll see when signed in) -
                  three clear steps: who, then what access, then a final review before sending. */}
              <form onSubmit={handleInviteMember} className="space-y-2 pt-1">
                <div className="flex items-center gap-1 mb-1">
                  {(['Who', 'Access', 'Send'] as const).map((label, i) => {
                    const step = (i + 1) as 1 | 2 | 3;
                    return (
                      <React.Fragment key={label}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${inviteStep === step ? 'bg-indigo-600 text-white' : inviteStep > step ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                            {inviteStep > step ? <Check className="w-3 h-3" /> : step}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-wide ${inviteStep === step ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>{label}</span>
                        </div>
                        {i < 2 && <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />}
                      </React.Fragment>
                    );
                  })}
                </div>

                {inviteStep === 1 && (
                  <>
                    <p className="text-[10px] text-slate-400">Step 1 of 3 - who are you inviting?</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={familyEmail}
                        onChange={(e) => setFamilyEmail(e.target.value)}
                        placeholder="email@example.com"
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
                    </div>
                    <button
                      type="button"
                      onClick={() => { if (familyEmail.trim()) setInviteStep(2); }}
                      disabled={!familyEmail.trim()}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                    >
                      Next
                    </button>
                  </>
                )}

                {inviteStep === 2 && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-400">Step 2 of 3 - what can {familyEmail} see?</p>
                      <button type="button" onClick={() => setInviteStep(1)} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer shrink-0">← Back</button>
                    </div>

                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Same access as yours?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setAccessChoice('same'); setFamilyFeatures(myAvailableFeatures); }}
                        className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wide cursor-pointer transition-all ${accessChoice === 'same' ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAccessChoice('custom'); setFamilyFeatures([]); }}
                        className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wide cursor-pointer transition-all ${accessChoice === 'custom' ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}
                      >
                        Choose Own
                      </button>
                    </div>

                    {accessChoice === 'custom' && (
                      <>
                        <p className="text-[9px] text-slate-400">Pick exactly what {familyEmail} can see. You can only share features included in your own plan ({userProfile?.licensePlanName || 'Light'}).</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {ALL_FEATURES.map(f => {
                            const locked = !myAvailableFeatures.includes(f);
                            return (
                            <button
                              key={f}
                              type="button"
                              disabled={locked}
                              onClick={() => toggleFeature(f)}
                              title={locked ? "Not included in your own plan" : undefined}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all text-left ${locked ? 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-700 border border-slate-100 dark:border-slate-800 cursor-not-allowed opacity-60' : familyFeatures.includes(f) ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 cursor-pointer' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-slate-800 cursor-pointer'}`}
                            >
                              {familyFeatures.includes(f) && !locked ? <Check className="w-3 h-3 shrink-0" /> : <span className="w-3 h-3 shrink-0" />}
                              {FEATURE_META[f]}
                            </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                    <p className="text-[9px] text-slate-400">Dashboard, Expenses, Manage Bills, and Payment History are always included{accessChoice === 'custom' ? ' - pick which extras this person can see above' : ''}.</p>
                    <button
                      type="button"
                      onClick={() => setInviteStep(3)}
                      disabled={!accessChoice}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                    >
                      Next
                    </button>
                  </>
                )}

                {inviteStep === 3 && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-400">Step 3 of 3 - review and send</p>
                      <button type="button" onClick={() => setInviteStep(2)} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer shrink-0">← Back</button>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] font-bold uppercase">Invite</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate ml-2">{familyEmail}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] font-bold uppercase">Role</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{familyEmailRole === 'modify' ? 'Can Edit' : 'View Only'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-slate-400 text-[10px] font-bold uppercase shrink-0">Access</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-right">
                          {familyFeatures.length === 0 ? 'Dashboard & Bills only' : familyFeatures.map(f => FEATURE_META[f]).join(', ')}
                        </span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={familyLoading}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" /> {familyLoading ? 'Sending…' : 'Send Invite'}
                    </button>
                  </>
                )}
              </form>
              </>
              )}
              {familyError && <p className="text-[10px] text-red-500 font-semibold">{familyError}</p>}
              {familySuccess && <p className="text-[10px] text-emerald-500 font-semibold">{familySuccess}</p>}

              {outgoingInvitations.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-900 space-y-1.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Invites Sent, Awaiting Response</span>
                  {outgoingInvitations.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">{inv.toEmail} <span className="text-[9px] text-slate-400">· {inv.proposedRole === 'view' ? 'View Only' : 'Editor'}</span></span>
                      <button
                        onClick={async () => {
                          setInvitationError(null);
                          try {
                            await onCancelInvitation?.(inv.id);
                          } catch (err: any) {
                            setInvitationError(err?.message || 'Could not cancel that invitation.');
                          }
                        }}
                        className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Join a family by code — shown to anyone not already the host of one */}
          {familyRole !== 'host' && (
            <div className={`${sectionCardClass} space-y-3`}>
              <h4 className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-indigo-500" /> Join a Workspace
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
              {invitationError && <p className="text-[10px] text-rose-500 font-semibold bg-rose-50 dark:bg-rose-950/20 px-2.5 py-1.5 rounded-lg">{invitationError}</p>}
              {incomingInvitations.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{inv.fromName}</p>
                    <p className="text-[10px] text-slate-500">Invited you as {inv.proposedRole === 'view' ? 'View Only' : 'Editor'}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={async () => {
                        setInvitationError(null);
                        setRespondingInvId(inv.id);
                        try {
                          await onApproveInvitation?.(inv.id, inv.proposedRole);
                        } catch (err: any) {
                          setInvitationError(err?.message || 'Could not accept that invitation. Please try again.');
                        } finally {
                          setRespondingInvId(null);
                        }
                      }}
                      disabled={respondingInvId === inv.id}
                      className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] font-black rounded-md cursor-pointer"
                    >
                      {respondingInvId === inv.id ? '...' : 'Accept'}
                    </button>
                    <button
                      onClick={async () => {
                        setInvitationError(null);
                        setRespondingInvId(inv.id);
                        try {
                          await onDeclineInvitation?.(inv.id);
                        } catch (err: any) {
                          setInvitationError(err?.message || 'Could not decline that invitation.');
                        } finally {
                          setRespondingInvId(null);
                        }
                      }}
                      disabled={respondingInvId === inv.id}
                      className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 text-[10px] font-black rounded-md cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current members */}
          {familyMembers.length > 0 && (
            <div className="bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
              <h4 className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" /> Workspace Members ({familyMembers.length})
              </h4>
              {familyMembers.map(m => (
                <div key={m.uid} className="flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{m.displayName || m.email}</p>
                    <p className="text-[10px] text-slate-500">{m.isFamilyHost ? 'Host' : m.role === 'view' ? 'View Only' : 'Can Edit'}{m.isPortfolioContributor === false ? ' · Silent viewer (portfolio)' : ''}</p>
                  </div>
                  {familyRole === 'host' && !m.isFamilyHost && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="flex items-center gap-1 text-[9px] font-bold text-slate-500 cursor-pointer" title="Include in Investment Plan (Split, Contribution Log, Recurring Plan, Per-Person Share)">
                        <input
                          type="checkbox"
                          checked={m.isPortfolioContributor !== false}
                          onChange={(e) => onUpdateMemberPortfolioContributor?.(m.uid, e.target.checked)}
                          className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                        />
                        Contributor
                      </label>
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
              Leave Workspace
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
              if (!acc.some(item => String(item.currency || '').toUpperCase() === String(c.currency || '').toUpperCase())) {
                acc.push(c);
              }
              return acc;
            }, []).map((c) => (
              <div key={c.id} className="relative group shrink-0">
                <button
                  onClick={() => onSaveSummaryCurrency(c.currency)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded flex items-center gap-1 transition-all cursor-pointer ${
                    String(summaryCurrency || '').toUpperCase() === String(c.currency || '').toUpperCase()
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{c.flag}</span>
                  <span>{c.currency} ({c.symbol})</span>
                </button>
                {onDeleteCountry && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCurrency(c.id); }}
                    title="Remove currency"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setShowAddCurrency(!showAddCurrency)}
              title="Add a currency"
              className="px-2.5 py-1.5 text-[11px] font-bold rounded text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0"
            >
              + Add
            </button>
          </div>

          {currencyError && <p className="text-[10px] text-red-500 font-semibold mt-1.5">{currencyError}</p>}

          {showAddCurrency && (
            <form onSubmit={handleAddCurrency} className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <input type="text" value={newCurrencyCode} onChange={(e) => setNewCurrencyCode(e.target.value)} placeholder="Code, e.g. USD" maxLength={6} className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-[11px]" />
                <input type="text" value={newCurrencySymbol} onChange={(e) => setNewCurrencySymbol(e.target.value)} placeholder="Symbol, e.g. $" maxLength={3} className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-[11px]" />
                <input type="text" value={newCurrencyName} onChange={(e) => setNewCurrencyName(e.target.value)} placeholder="Name (optional)" className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-[11px]" />
                <input type="number" step="0.01" value={newCurrencyRate} onChange={(e) => setNewCurrencyRate(e.target.value)} placeholder="Rate per 1 AUD" className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-[11px]" />
              </div>
              <button type="submit" disabled={currencyBusy} className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded disabled:opacity-50 cursor-pointer">
                {currencyBusy ? 'Adding…' : 'Add Currency'}
              </button>
            </form>
          )}
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
        
        {tipsOn && (
          <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold leading-normal text-left">
            Toggle where and how you receive payment reminders before and on due dates.
          </p>
        )}

        <div className="space-y-3.5">
          {/* Toggle Option 1: App-Level Notifications */}
          <div className="flex items-center justify-between py-1">
            <div className="text-left pr-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">App-Level Notification Banners</span>
              {tipsOn && (
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
              {tipsOn && (
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
          {/* Preferred Name */}
          <div className="bg-white dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5 shrink-0">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Preferred Name</span>
            <p className="text-[10px] text-slate-400">Shown to others in Workspace Config, Portfolio, and anywhere your name appears.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setDisplayNameError(null);
                setDisplayNameSaved(false);
                setSavingDisplayName(true);
                try {
                  await onUpdateDisplayName?.(displayNameInput);
                  setDisplayNameSaved(true);
                  setTimeout(() => setDisplayNameSaved(false), 2500);
                } catch (err: any) {
                  setDisplayNameError(err?.message || 'Could not update your name.');
                } finally {
                  setSavingDisplayName(false);
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                placeholder="Your name"
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
              />
              <button
                type="submit"
                disabled={savingDisplayName || !displayNameInput.trim()}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
              >
                {savingDisplayName ? '...' : 'Save'}
              </button>
            </form>
            {displayNameError && <p className="text-[10px] text-rose-500 font-semibold">{displayNameError}</p>}
            {displayNameSaved && <p className="text-[10px] text-emerald-500 font-semibold">Saved.</p>}
          </div>

          {/* Workspace Landing Page */}
          <div className="bg-white dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5 shrink-0">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Landing Page for This Workspace</span>
            <p className="text-[10px] text-slate-400">Which page opens first when you switch into {activeWorkspace?.name || 'this workspace'}. Only affects you, not other members.</p>
            <div className="flex gap-2">
              <select
                value={currentLandingTab ?? ''}
                onChange={async (e) => {
                  const value = e.target.value || null;
                  setLandingTabSaving(true);
                  setLandingTabSaved(false);
                  try {
                    await onUpdateLandingTab?.(value);
                    setLandingTabSaved(true);
                    setTimeout(() => setLandingTabSaved(false), 2500);
                  } finally {
                    setLandingTabSaving(false);
                  }
                }}
                disabled={landingTabSaving}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
              >
                <option value="">{(!hasFeature || hasFeature('core')) ? 'Dashboard (default)' : 'Portfolio (default)'}</option>
                {(!hasFeature || hasFeature('core')) && <option value="expenses">Expenses</option>}
                {(!hasFeature || hasFeature('income')) && <option value="income">Income</option>}
                {(!hasFeature || hasFeature('core')) && <option value="configure">Manage Bills</option>}
                {(!hasFeature || hasFeature('core')) && <option value="history">Payment History</option>}
                {(!hasFeature || hasFeature('rewards')) && <option value="rewards">Membership Hub</option>}
                {(!hasFeature || hasFeature('ai')) && <option value="ai">AI Insights</option>}
                {(!hasFeature || hasFeature('portfolio')) && <option value="portfolio">Portfolio</option>}
                {(!hasFeature || hasFeature('portfolio')) && <option value="investment_plan">Investment Plan</option>}
                {(!hasFeature || hasFeature('portfolio')) && <option value="reports">Reports</option>}
              </select>
            </div>
            {landingTabSaved && <p className="text-[10px] text-emerald-500 font-semibold">Saved.</p>}
          </div>

          {/* My Plan */}
          <details className="group bg-white dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Plans that grow with you
              </span>
              <div className="flex items-center gap-2">
                {myUpgradeRequest && (
                  <span className="px-2 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wide rounded-full">
                    {myUpgradeRequest.planName} pending
                  </span>
                )}
                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
              </div>
            </summary>

            <div className="space-y-2.5 mt-3.5">
              {accessPlans.map(plan => {
                const isCurrent = plan.name === userProfile?.licensePlanName;
                const isRequested = myUpgradeRequest?.planName === plan.name;
                return (
                  <div
                    key={plan.id}
                    className={`rounded-xl border p-3.5 space-y-2.5 ${isCurrent ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20' : 'border-slate-150 dark:border-slate-850'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-slate-900 dark:text-white">{plan.name}</span>
                          {isCurrent && <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-wide rounded-full">Current Plan</span>}
                        </div>
                        {plan.description && <p className="text-[10px] text-slate-400 mt-0.5">{plan.description}</p>}
                      </div>
                      {!isCurrent && (
                        <button
                          onClick={() => onRequestUpgrade?.(plan.id)}
                          disabled={isRequested}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer shrink-0"
                        >
                          {isRequested ? 'Requested' : 'Request'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <Check className="w-3 h-3 text-emerald-500 shrink-0" /> Dashboard, Expenses, Bills, History
                      </div>
                      {['income', 'rewards', 'ai', 'team', 'chat', 'agent', 'whatsapp', 'portfolio'].map(f => {
                        const included = plan.features.includes(f);
                        const labels: Record<string, string> = { income: 'Income', rewards: 'Membership', ai: 'AI Insights', team: 'Workspace Config', chat: 'Family Chat', agent: 'AI Agent', whatsapp: 'WhatsApp' };
                        return (
                          <div key={f} className={`flex items-center gap-1.5 text-[10px] ${included ? 'text-slate-600 dark:text-slate-300' : 'text-slate-300 dark:text-slate-700 line-through'}`}>
                            {included ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <X className="w-3 h-3 text-slate-300 dark:text-slate-700 shrink-0" />}
                            {labels[f]}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>

          {/* Display (Premium Bento card styling) */}
          <details className="group bg-white dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
        <summary className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-900 pb-2.5 cursor-pointer list-none">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" />
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Display</h4>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3.5 space-y-4">
        
        {tipsOn && (
          <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold leading-normal text-left">
            Customize what information is shown across your active bill cards.
          </p>
        )}

        <div className="space-y-3.5">
          <div className="flex items-center justify-between py-1">
            <div className="text-left pr-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">Historical Billing Patterns</span>
              {tipsOn && (
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
      </details>

      {/* BENEFICIARY / PERSON TAGS CONFIG (Moved from ConfigurePayments page for visual simplification) */}
      <details className="group bg-white dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
        <summary className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-900 pb-2.5 cursor-pointer list-none">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-500" />
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Beneficiary / Person Tags Manager</h4>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3.5 space-y-3">
        {tipsOn && (
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
      </details>

      {/* Visual Theme Selection (Premium High Density Cards) */}
      <details className="group bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm">
        <summary className="flex items-center justify-between cursor-pointer list-none">
          <h4 className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-indigo-500" /> App Visual Theme
          </h4>
          <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-3">
        {tipsOn && (
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
      </details>
        </>
      )}

      {currentSubTab === 'security' && (
        <>
          
          {/* Daily alerts — Email + WhatsApp */}
          <div className={`${sectionCardClass} space-y-3 shrink-0`}>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Daily alerts
            </h4>
            <p className="text-[10px] text-slate-500">
              Morning brief: bills due/overdue + simple portfolio mark. Email is free-tier friendly; WhatsApp needs Meta Cloud API (and may need a template for cold pushes).
            </p>
            <label className="flex items-center justify-between gap-3 text-[12px] font-bold text-slate-800 dark:text-slate-100">
              <span>Email digest</span>
              <input
                type="checkbox"
                checked={!!userProfile?.digestEmail}
                onChange={async (e) => {
                  try {
                    await onUpdateDigestPrefs?.({ digestEmail: e.target.checked });
                  } catch (err: any) {
                    alert(err?.message || 'Could not save — run SQL to add digest_email column (see NOTIFICATIONS.md)');
                  }
                }}
                className="rounded border-slate-300"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-[12px] font-bold text-slate-800 dark:text-slate-100">
              <span>WhatsApp digest</span>
              <input
                type="checkbox"
                checked={!!userProfile?.digestWhatsapp}
                disabled={!userProfile?.whatsappPhone}
                onChange={async (e) => {
                  try {
                    await onUpdateDigestPrefs?.({ digestWhatsapp: e.target.checked });
                  } catch (err: any) {
                    alert(err?.message || 'Could not save — link WhatsApp first / add digest_whatsapp column');
                  }
                }}
                className="rounded border-slate-300"
              />
            </label>
            {!userProfile?.whatsappPhone && (
              <p className="text-[9px] text-slate-400">Link WhatsApp first.</p>
            )}
            <button
              type="button"
              onClick={async () => {
                setDigestPreview({ loading: true, text: null, error: null });
                try {
                  const { data: sessionData } = await supabase.auth.getSession();
                  const token = sessionData?.session?.access_token;
                  if (!token) throw new Error('Not signed in');
                  const resp = await fetch('/api/daily-digest?action=preview', {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const json = await resp.json().catch(() => ({}));
                  if (!resp.ok) throw new Error(json?.error || 'Preview failed');
                  setDigestPreview({ loading: false, text: json.text, error: null });
                } catch (err: any) {
                  setDigestPreview({ loading: false, text: null, error: err?.message || 'Preview failed' });
                }
              }}
              disabled={digestPreview.loading}
              className="w-full text-center text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-wider py-1.5 cursor-pointer disabled:opacity-50"
            >
              {digestPreview.loading ? 'Loading preview…' : 'Preview today\u2019s digest'}
            </button>
            {digestPreview.error && (
              <p className="text-[9px] text-rose-500">{digestPreview.error}</p>
            )}
            {digestPreview.text && (
              <pre className="text-[10px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-100 dark:border-slate-800 leading-relaxed">
                {digestPreview.text}
              </pre>
            )}
          </div>

{/* WhatsApp */}
          <div className={`${sectionCardClass} space-y-3 shrink-0`}>
            <h4 className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-500" /> WhatsApp
            </h4>
            {!hasWhatsApp ? (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">WhatsApp is on Pro Max.</p>
                <button
                  onClick={() => {
                    const proMax = accessPlans.find(p => p.name === 'Pro Max');
                    if (proMax) onRequestUpgrade?.(proMax.id);
                  }}
                  disabled={myUpgradeRequest?.planName === 'Pro Max'}
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 disabled:opacity-50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
                >
                  {myUpgradeRequest?.planName === 'Pro Max' ? 'Requested' : 'Request Pro Max'}
                </button>
              </div>
            ) : (
            <>
            {userProfile?.whatsappPhone ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">+{userProfile.whatsappPhone}</p>
                  <p className="text-[10px] text-emerald-500 font-semibold">Connected</p>
                </div>
                <button
                  onClick={() => onDisconnectWhatsApp?.()}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            ) : waCode ? (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Text this code to the Haven WhatsApp number to finish linking:
                </p>
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg font-mono text-lg font-bold tracking-widest text-center text-emerald-600 dark:text-emerald-400">
                  {waCode}
                </div>
                <button onClick={() => setWaCode(null)} className="text-[10px] text-slate-400 underline cursor-pointer">Use a different number</button>
              </div>
            ) : (
              <form onSubmit={handleStartWhatsApp} className="flex gap-2">
                <input
                  type="tel"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="Phone with country code, e.g. 14155552671"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  disabled={waBusy || !waPhone.trim()}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
                >
                  {waBusy ? '...' : 'Link'}
                </button>
              </form>
            )}
            {waError && <p className="text-[10px] text-red-500 font-semibold">{waError}</p>}
            <p className="text-[9px] text-slate-400">Then text due or help anytime.</p>
            </>
            )}
          </div>

          {/* Backup and Restore Utilities Accordion (High Density Styled Cards) */}
          <div className={`${sectionCardClass} space-y-3 shrink-0`}>
        <h4 className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-indigo-500" /> Backup & danger zone
        </h4>

        {workspaceBackups.length > 0 && (
          <div className="py-2 border-b border-slate-100 dark:border-slate-900/60 space-y-1.5">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">Automatic Snapshots</span>
            <span className="text-[9px] text-slate-450 dark:text-slate-500 block font-bold mb-1.5">A snapshot is taken automatically once a day — restore any of the last {workspaceBackups.length}.</span>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {workspaceBackups.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-2 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{new Date(b.created_at).toLocaleString()}</span>
                  <button
                    onClick={() => onRestoreFromBackup?.(b.id)}
                    className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Option 1: Export Data */}
        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-900/60">
          <div className="text-left pr-3">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">Download Data Backup</span>
            {tipsOn && (
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
            {tipsOn && (
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
