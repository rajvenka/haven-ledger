import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Settings, 
  History, 
  Award,
  Wallet,
  Briefcase,
  ClipboardList,
  FileBarChart,
  ShieldCheck,
  Bell, 
  Compass,
  X, 
  Check, 
  CheckCircle2,
  Info, 
  Sparkles,
  Smartphone,
  ChevronRight,
  ShieldAlert,
  Globe,
  Sun,
  Moon,
  User,
  RefreshCw,
  AlertTriangle,
  Sliders,
  Menu,
  BrainCircuit,
  Users,
  Shield,
  Layers,
  MessageSquare,
  UserPlus
} from 'lucide-react';
import { usePaymentState } from './hooks/usePaymentState';
import IPhoneFrame from './components/IPhoneFrame';

import PaymentModal from './components/PaymentModal';
import Dashboard from './components/Dashboard';
import PulseDashboard from './components/PulseDashboard';
import PulseExpenses from './components/PulseExpenses';
import ConfigurePayments from './components/ConfigurePayments';
import AccountInfo from './components/AccountInfo';
import PaymentHistoryView from './components/PaymentHistoryView';
import ExpensesView from './components/ExpensesView';
import AuthView from './components/AuthView';
import SetPasswordView from './components/SetPasswordView';
import AiInsights from './components/AiInsights';
import { RecurringPayment } from './types';
import AgentAssistant from './components/AgentAssistant';
import FamilyChatAssistant from './components/FamilyChatAssistant';
import ProfileScopeModal from './components/ProfileScopeModal';
import WorkspaceSwitcher from './components/WorkspaceSwitcher';
import RewardsTracker from './components/RewardsTracker';
import PortfolioView from './components/PortfolioView';
import PortfolioV1View from './components/PortfolioV1View';
import InvestmentPlanView from './components/InvestmentPlanView';
import ReportsView from './components/ReportsView';
import IncomeView from './components/IncomeView';
import AdminUsersView from './components/AdminUsersView';
import AppTour from './components/AppTour';
import OnboardingView from './components/OnboardingView';

export default function App() {
  const {
    user,
    userProfile,
    familyMembers,
    viewMode,
    setViewMode,
    signUp,
    signIn,
    signInWithGoogle,
    resetPassword,
    updatePassword,
    updateDisplayName,
    acceptPrivacyPolicy,
    logOut,
    markTourCompleted,
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    switchWorkspace,
    updateWorkspaceLandingTab,
    updateWorkspaceColumnPrefs,
    dismissContributionReminder,
    portfolios, workspaceCurrencyRates, switchToMultiPortfolio, createPortfolio, updatePortfolio, deletePortfolio, upsertCurrencyRate,
    mfHoldingsCache, loadMfHoldingsCache, fetchAndCacheMfHoldings, saveManualMfHoldings,
    createWorkspace,
    setWorkspaceMode,
    addFamilyMember,
    joinFamilyGroup,
    leaveFamilyGroup,
    incomingInvitations,
    approveInvitation,
    declineInvitation,
    updateMemberRole,
    updateMemberPortfolioContributor,
    removeFamilyMember,
    outgoingInvitations,
    cancelInvitation,
    isAuthLoading,
    familyRole,
    isReadOnly,

    inviteCode,
    regenerateInviteCode,

    payments,
    allPayments,
    history,
    countries,
    rate,
    summaryCurrency,
    notifications,
    familyMessages,
    sendFamilyMessage,
    rewardsPerks,
    addReward,
    updateReward,
    deleteReward,
    giftCards,
    addGiftCard,
    updateGiftCard,
    redeemGiftCard,
    deleteGiftCard,
    incomeSources,
    addIncomeSource,
    deleteIncomeSource,
    incomeMode,
    updateIncomeMode,
    monthlyIncome,
    updateMonthlyIncome,
    renameWorkspace,
    deleteWorkspace,
    workspaceBackups,
    createBackupNow,
    restoreFromBackup,
    isLoaded,
    isSyncing,
    addPayment,
    addBulkPayments,
    updatePayment,
    deletePayment,
    updatePaymentsOrder,
    recordPayment,
    deleteHistoryEntry,
    updateHistoryStatus,
    clearHistory,
    saveRate,
    saveSummaryCurrency,
    addCountry,
    updateCountry,
    deleteCountry,
    triggerNotification,
    dismissNotification,
    markAllNotificationsRead,
    clearNotifications,
    checkPaymentReminders,
    requestNotificationPermission,
    resetToDefaults,
    fetchAllUsersForAdmin,
    inviteNewUser,
    onboardUserWithPlan,
    startWhatsAppVerification,
    disconnectWhatsApp,
    accessPlans,
    createAccessPlan,
    updateAccessPlan,
    deleteAccessPlan,
    myUpgradeRequest,
    requestUpgrade,
    fetchPendingUpgradeRequests,
    resolveUpgradeRequest,
    adminSetUserPlan,
    setSuperAdminStatus,
    portfolioSplits,
    addPortfolioSplit,
    deletePortfolioSplit,
    portfolioHoldings,
    portfolioDataLoading,
    portfolioPriceHistory,
    addPortfolioHolding,
    bulkAddPortfolioHoldings,
    reconcilePortfolioHoldingQuantity,
    markPortfolioHoldingSoldFromImport,
    bulkHistoricalImport,
    updatePortfolioHolding,
    sellPortfolioHolding,
    updatePortfolioHoldingLivePrice,
    markPriceLookupFailed,
    deletePortfolioHolding,
    bulkTagPortfolioHoldings,
    bulkDeletePortfolioHoldings,
    deleteAllPortfolioData,
    portfolioSnapshots,
    takePortfolioSnapshot,
    deletePortfolioSnapshotBatch,
    portfolioContributions,
    addPortfolioContribution,
    updatePortfolioContribution,
    deletePortfolioContribution,
    portfolioWithdrawals,
    addPortfolioWithdrawal,
    deletePortfolioWithdrawal,
    portfolioCashBalances,
    setPortfolioCashBalance,
    deletePortfolioCashBalance,
    portfolioBookedPlBaselines,
    setBookedPlBaseline,
    portfolioProjectedBankBalances,
    setProjectedBankBalance,
    recalculateProjectedBankBalance,
    portfolioBrokerConnections,
    setPortfolioBrokerConnection,
    deletePortfolioBrokerConnection,
    markBrokerConnectionSynced,
    syncEtoroHoldingLots,
    syncEtoroLivePrices,
    loadPortfolioHoldingLots,
    portfolioHoldingLots,
    portfolioDividends,
    addPortfolioDividend,
    deletePortfolioDividend,
    portfolioFees,
    addPortfolioFee,
    deletePortfolioFee,
    portfolioRecurringPlans,
    addPortfolioRecurringPlan,
    updatePortfolioRecurringPlan,
    deletePortfolioRecurringPlan,
    appNotificationsEnabled,
    mobileNotificationsEnabled,
    saveNotificationSettings,
  } = usePaymentState();

  // Detect an invite or password-recovery magic link (Supabase logs the user in immediately
  // via the link, but never asks for a password — we have to catch that moment ourselves).
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(() => {
    const hash = window.location.hash;
    return hash.includes('type=invite') || hash.includes('type=recovery');
  });

  const [activeTab, setActiveTab] = useState<'summary' | 'expenses' | 'configure' | 'account' | 'history' | 'ai' | 'income' | 'rewards' | 'portfolio' | 'portfolio_v1' | 'investment_plan' | 'reports' | 'admin_users'>('summary');
  const [uiPulse, setUiPulse] = useState<boolean>(() => {
    try { return localStorage.getItem('haven_ui_pulse') === '1'; } catch { return false; }
  });
  const togglePulse = () => {
    setUiPulse((v) => {
      const next = !v;
      try { localStorage.setItem('haven_ui_pulse', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };
  const lastLandingWorkspaceId = React.useRef<string | null>(null);
  const [settingsSubTab, setSettingsSubTab] = useState<'preferences' | 'team'>('preferences');
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [isFamilyChatOpen, setIsFamilyChatOpen] = useState(false);

  // Limited-access members only see the essentials; hasFeature checks each optional tab individually.
  const isLimitedAccess = activeWorkspace?.accessLevel === 'limited';
  // A feature is available only if BOTH the workspace grants it AND the user's own
  // license plan includes it - the plan is always the hard ceiling, regardless of role.
  // Silent viewers (isPortfolioContributor === false) are excluded from Investment Plan
  // and Reports' contribution-related sections (Split, Contribution Log, Recurring Plan,
  // Per-Person Share) - they can still view the portfolio itself, just not appear there.
  const contributorMembers = familyMembers.filter(m => m.isPortfolioContributor !== false);

  const hasFeature = (feature: string) => {
    if (userProfile?.isSuperAdmin) return true;
    const workspaceGrants = !activeWorkspace?.enabledFeatures || activeWorkspace.enabledFeatures.includes(feature);
    const planIncludes = userProfile?.licensePlanFeatures === undefined ? true : userProfile.licensePlanFeatures.includes(feature);
    return workspaceGrants && planIncludes;
  };

  // Auto-starts the guided tour once for first-time users. Uses localStorage as an
  // immediate guard so a skipped/finished tour never reappears even if the profile
  // write is slow or fails — previously it could pop up on every reload.
  const [showTour, setShowTour] = useState(false);
  const hasAutoStartedTour = React.useRef(false);
  useEffect(() => {
    if (!isLoaded || !userProfile) return;
    if (hasAutoStartedTour.current) return;
    hasAutoStartedTour.current = true;
    const localDone = localStorage.getItem('haven_tour_done') === '1';
    if (localDone || userProfile.hasCompletedTour === true) return;
    // Only auto-show when the profile explicitly says the tour is incomplete.
    if (userProfile.hasCompletedTour === false) setShowTour(true);
  }, [isLoaded, userProfile]);


  // Applies the saved landing-page preference when switching into a workspace - guards
  // against a stale preference pointing at a page the plan no longer grants (e.g. if
  // downgraded since the preference was set), falling back to Dashboard in that case.
  // If no preference is set at all and the plan doesn't include 'core' (Dashboard/Expenses,
  // e.g. Lite-Finance), lands on Portfolio instead of the default Dashboard, since that
  // default would otherwise be an inaccessible page for that plan.
  useEffect(() => {
    if (!activeWorkspaceId) return;
    if (lastLandingWorkspaceId.current === activeWorkspaceId) return;
    lastLandingWorkspaceId.current = activeWorkspaceId;
    const preferred = activeWorkspace?.landingTab;
    if (!preferred) {
      if (!hasFeature('core') && hasFeature('portfolio')) setActiveTab('portfolio');
      return;
    }
    const requiredFeature: Record<string, string> = { income: 'income', rewards: 'rewards', ai: 'ai', portfolio: 'portfolio', investment_plan: 'portfolio', reports: 'portfolio' };
    const gate = requiredFeature[preferred];
    if (gate && !hasFeature(gate)) return;
    setActiveTab(preferred as any);
  }, [activeWorkspaceId, activeWorkspace?.landingTab]);

  // Hard enforcement: even if activeTab somehow points at a gated tab (stale state, direct
  // manipulation), bounce back to the dashboard rather than just hiding the nav link.
  React.useEffect(() => {
    if (!hasFeature('income') && activeTab === 'income') setActiveTab('summary');
    if (!hasFeature('rewards') && activeTab === 'rewards') setActiveTab('summary');
    if (!hasFeature('ai') && activeTab === 'ai') setActiveTab('summary');
    if (isLimitedAccess && activeTab === 'admin_users') setActiveTab('summary');
    if (!hasFeature('team') && incomingInvitations.length === 0 && activeTab === 'account' && settingsSubTab === 'members') setSettingsSubTab('preferences');
  }, [activeWorkspace, activeTab, settingsSubTab]);

  const toggleAgent = () => {
    setIsAgentOpen(prev => !prev);
    setIsFamilyChatOpen(false);
  };

  const toggleFamilyChat = () => {
    setIsFamilyChatOpen(prev => !prev);
    setIsAgentOpen(false);
  };
  const [isProfileScopeModalOpen, setIsProfileScopeModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('pm_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  React.useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(null);
  const [preselectedCurrency, setPreselectedCurrency] = useState<string>('AUD');
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [recordingTransactionPayment, setRecordingTransactionPayment] = useState<RecurringPayment | null>(null);
  const [transactionAmount, setTransactionAmount] = useState<string>('');
  const [transactionStatus, setTransactionStatus] = useState<'paid' | 'delayed' | 'carry'>('paid');
  const [transactionTaggedFor, setTransactionTaggedFor] = useState<string>('');
  const [transactionSuccessMessage, setTransactionSuccessMessage] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionDate, setTransactionDate] = useState<string>('');
  const [customTags, setCustomTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pm_custom_tags');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [customizedTags, setCustomizedTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pm_customized_tags');
      return saved ? JSON.parse(saved) : ['Bank', 'Home', 'Father', 'Mother', 'Self'];
    } catch {
      return ['Bank', 'Home', 'Father', 'Mother', 'Self'];
    }
  });

  const [showFrequencyPatterns, setShowFrequencyPatterns] = useState<boolean>(() => {
    const saved = localStorage.getItem('pm_show_frequency_patterns');
    return saved !== 'false';
  });

  const handleToggleFrequencyPatterns = (enabled: boolean) => {
    setShowFrequencyPatterns(enabled);
    localStorage.setItem('pm_show_frequency_patterns', String(enabled));
    triggerNotification(
      enabled ? 'Patterns Enabled 📊' : 'Patterns Disabled 📊',
      enabled ? 'Historical billing pattern previews are now visible.' : 'Historical billing pattern previews are now hidden.',
      'info'
    );
  };

  const saveCustomizedTags = (tags: string[]) => {
    setCustomizedTags(tags);
    localStorage.setItem('pm_customized_tags', JSON.stringify(tags));
    triggerNotification('Tags Updated 🏷️', 'Beneficiary / Person tags list updated successfully.', 'info');
  };

  const allUniqueTags = React.useMemo(() => {
    const familyNames = familyMembers.map(m => m.displayName).filter(Boolean) as string[];
    const paymentTags = payments.map(p => p.taggedFor).filter(Boolean) as string[];
    const historyTags = history.map(h => h.taggedFor).filter(Boolean) as string[];
    
    const combined = [
      ...customizedTags,
      ...familyNames,
      ...paymentTags,
      ...historyTags,
      ...customTags
    ];
    
    const seen = new Set<string>();
    const result: string[] = [];
    combined.forEach(t => {
      const clean = t.trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        result.push(clean);
      }
    });
    return result;
  }, [familyMembers, payments, history, customTags, customizedTags]);

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  const handleOpenAddModal = () => {
    setPreselectedCurrency('AUD');
    setEditingPayment(null);
    setIsModalOpen(true);
  };

  const handleOpenAddModalForCurrency = (currencyCode: string) => {
    setPreselectedCurrency(currencyCode);
    setEditingPayment(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (payment: RecurringPayment) => {
    setEditingPayment(payment);
    setIsModalOpen(true);
  };

  const handleCloneClick = (payment: RecurringPayment) => {
    setPreselectedCurrency(payment.currency);
    setEditingPayment({ ...payment, id: '', name: `${payment.name} (Copy)` });
    setIsModalOpen(true);
  };

  const handleSavePayment = async (paymentData: Omit<RecurringPayment, 'id'> & { id?: string }) => {
    if (paymentData.id) {
      updatePayment(paymentData as RecurringPayment);
    } else {
      addPayment(paymentData);
    }
  };

  const getTodayDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleRecordPayment = async (payment: RecurringPayment, instanceDueDate?: string) => {
    setRecordingTransactionPayment(payment);
    setTransactionAmount(String(payment.amount));
    setTransactionStatus('paid');
    setTransactionTaggedFor(payment.taggedFor || '');
    setTransactionDate(instanceDueDate || getTodayDateString());
    setTransactionError(null);
  };

  const handleTriggerTestReminder = () => {
    // Pick a random active payment to simulate alert
    const activeOnes = payments.filter(p => p.active);
    if (activeOnes.length > 0) {
      const randomPayment = activeOnes[Math.floor(Math.random() * activeOnes.length)];
      triggerNotification(
        'Due Reminder (Simulated) 🔔',
        `Pre-billing alert: "${randomPayment.name}" (${randomPayment.currency} ${randomPayment.amount}) is due in ${randomPayment.reminderDaysBefore} days!`,
        'alert'
      );
    } else {
      triggerNotification(
        'Alert Test 🔔',
        'No active payments configured. Add one first to simulate billing reminders!',
        'warning'
      );
    }
  };

  const handleDismissNotification = (id: string) => {
    // Dismiss/Mark single notification as read
    dismissNotification(id);
  };

  // 1. Auth & Data Loading state
  if (!isLoaded || isAuthLoading) {
    return (
      <IPhoneFrame>
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 h-full">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </IPhoneFrame>
    );
  }

  // 2. Unauthenticated user view
  if (!user) {
    return (
      <IPhoneFrame>
        <AuthView 
          onSignIn={signIn} 
          onSignUp={signUp} 
          onResetPassword={resetPassword} 
          onSignInWithGoogle={signInWithGoogle} 
          onAcceptPrivacy={acceptPrivacyPolicy}
        />
      </IPhoneFrame>
    );
  }

  // 2.2 Invite/recovery link just logged them in, but they never set a real password yet
  if (user && needsPasswordSetup) {
    return (
      <IPhoneFrame>
        <SetPasswordView
          onSetPassword={async (password) => {
            await updatePassword(password);
            setNeedsPasswordSetup(false);
            window.history.replaceState(null, '', window.location.pathname);
          }}
        />
      </IPhoneFrame>
    );
  }

  // 2.5 Show "Initialize Your Vault" ONLY when user is not in any workspace.
  // If workspaces.length > 0 the main app renders — popup stays hidden.
  if (user && isLoaded && workspaces.length === 0) {
    if (incomingInvitations.length > 0) {
      return (
        <IPhoneFrame>
          <div className="flex-1 flex flex-col justify-center px-6 py-10 bg-slate-50 dark:bg-slate-900 gap-4">
            <div className="text-center space-y-1.5 mb-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white">You've Been Invited</h2>
              <p className="text-[11px] text-slate-400 font-semibold">Accept to join, or create your own workspace instead.</p>
            </div>
            {incomingInvitations.map(inv => (
              <div key={inv.id} className="bg-white dark:bg-slate-950 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{inv.fromName}</p>
                  <p className="text-[10px] text-slate-400">Invited you as {inv.proposedRole === 'view' ? 'View Only' : 'Editor'}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => approveInvitation(inv.id, inv.proposedRole)} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black rounded-lg cursor-pointer">Accept</button>
                  <button onClick={() => declineInvitation(inv.id)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black rounded-lg cursor-pointer">Decline</button>
                </div>
              </div>
            ))}
            <details className="text-center">
              <summary className="text-[10px] text-indigo-500 font-bold cursor-pointer list-none">Prefer to create your own workspace instead?</summary>
              <div className="mt-3">
                <OnboardingView onSelectMode={setWorkspaceMode} isSyncing={isSyncing} canCreateBusiness={userProfile?.isSuperAdmin || userProfile?.canCreateBusiness} />
              </div>
            </details>
          </div>
        </IPhoneFrame>
      );
    }
    return (
      <IPhoneFrame>
        <OnboardingView onSelectMode={setWorkspaceMode} isSyncing={isSyncing} canCreateBusiness={userProfile?.isSuperAdmin || userProfile?.canCreateBusiness} />
      </IPhoneFrame>
    );
  }

  // 3. Authenticated user main app
  return (
    <IPhoneFrame>
      {/* Main Container */}
      <div className="flex-1 flex flex-row h-full bg-slate-50 dark:bg-slate-900 relative overflow-hidden text-left">
        
        {/* Persistent Desktop Sidebar Navigation (Hidden on Mobile) */}
        <aside className="hidden md:flex flex-col w-56 h-dvh bg-white dark:bg-slate-950 border-r border-slate-150/80 dark:border-slate-900 shrink-0 z-20 select-none p-4">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {/* Elegant Header with Logo & Status */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20 dark:shadow-indigo-950/40 relative">
                <span className="text-base tracking-tighter">H</span>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full" />
              </div>
              <div className="text-left">
                <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  Haven Vault
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-pulse" />
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{activeWorkspace?.type === 'business' ? 'Business Ledger' : 'Family Payment Ledger'}</span>
                </div>
              </div>
            </div>

            <WorkspaceSwitcher
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onSwitch={switchWorkspace}
              onCreateNew={createWorkspace}
              onRename={renameWorkspace}
              onDelete={deleteWorkspace}
              canCreateBusiness={userProfile?.isSuperAdmin || userProfile?.canCreateBusiness}
            />

            {/* Theme toggle, guided tour, and notifications - desktop equivalent of the
                mobile header's action row, which lives in a md:hidden block and so was
                never reachable at all from the desktop sidebar layout. */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const nextTheme = theme === 'light' ? 'dark' : 'light';
                  setTheme(nextTheme);
                  localStorage.setItem('pm_theme', nextTheme);
                }}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowTour(true)}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                title="Take the guided tour"
              >
                <Compass className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsNotifDrawerOpen(true);
                  markAllNotificationsRead();
                }}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 relative transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-rose-500 border-2 border-white dark:border-slate-950 rounded-full flex items-center justify-center text-[7px] font-black text-white">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
            </div>

            {/* Menu Sections */}
            <div className="space-y-5">
              {/* SECTION: ANALYTICS & OVERVIEW */}
              {(hasFeature('core') || hasFeature('ai')) && (
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                  Overview & Stats
                </span>
                <nav className="flex flex-col gap-1 text-left">
                  {hasFeature('core') && (
                  <button
                    id="tour-tab-summary-desktop"
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'summary'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <LayoutDashboard className="w-4 h-4 shrink-0 opacity-80" />
                      <span>{activeWorkspace?.type === 'business' ? 'Overview' : 'Dashboard'}</span>
                    </div>
                    {activeTab === 'summary' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>
                  )}

                  {hasFeature('core') && (
                  <button
                    id="tour-tab-expenses-desktop"
                    onClick={() => setActiveTab('expenses')}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'expenses'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe className="w-4 h-4 shrink-0 opacity-80" />
                      <span>{activeWorkspace?.type === 'business' ? 'Operating Costs' : 'Expenses'}</span>
                    </div>
                    {activeTab === 'expenses' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>
                  )}

                  {hasFeature('ai') && (
                  <button
                    id="tour-tab-ai-desktop"
                    onClick={() => setActiveTab('ai')}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'ai'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <BrainCircuit className="w-4 h-4 shrink-0 opacity-80" />
                      <span>AI Insights</span>
                    </div>
                    {activeTab === 'ai' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>
                  )}
                </nav>
              </div>
              )}

              {/* SECTION: BILL MANAGEMENT */}
              {(hasFeature('core') || hasFeature('income') || hasFeature('rewards')) && (
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                  Payments & Bills
                </span>
                <nav className="flex flex-col gap-1 text-left">
                  {hasFeature('core') && (
                  <button
                    onClick={() => setActiveTab('configure')}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'configure'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings className="w-4 h-4 shrink-0 opacity-80" />
                      <span>{activeWorkspace?.type === 'business' ? 'Bills & Subscriptions' : 'Manage Bills'}</span>
                    </div>
                    {activeTab === 'configure' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>
                  )}

                  {hasFeature('core') && (
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'history'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <History className="w-4 h-4 shrink-0 opacity-80" />
                      <span>{activeWorkspace?.type === 'business' ? 'Transactions' : 'Payment History'}</span>
                    </div>
                    {activeTab === 'history' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>
                  )}

                  {hasFeature('income') && (
                  <button
                    id="tour-tab-income-desktop"
                    onClick={() => setActiveTab('income')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'income'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Wallet className="w-4 h-4 shrink-0 opacity-80" />
                      <span>Income</span>
                    </div>
                    {activeTab === 'income' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>
                  )}

                  {activeWorkspace?.type !== 'business' && hasFeature('rewards') && (
                    <button
                      onClick={() => setActiveTab('rewards')}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                        activeTab === 'rewards'
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Award className="w-4 h-4 shrink-0 opacity-80" />
                        <span>Membership Hub</span>
                      </div>
                      {activeTab === 'rewards' && (
                        <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                      )}
                    </button>
                  )}
                </nav>
              </div>
              )}

              {/* SECTION: INVESTMENT */}
              {hasFeature('portfolio') && (
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                  Investment
                </span>
                <nav className="flex flex-col gap-1 text-left">
                  <button
                    id="tour-tab-portfolio-desktop"
                    onClick={() => setActiveTab('portfolio')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'portfolio'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Briefcase className="w-4 h-4 shrink-0 opacity-80" />
                      <span>Portfolio</span>
                    </div>
                    {activeTab === 'portfolio' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>

                  <button
                    id="tour-tab-portfolio_v1-desktop"
                    onClick={() => setActiveTab('portfolio_v1')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'portfolio_v1'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Briefcase className="w-4 h-4 shrink-0 opacity-80" />
                      <span>Portfolio_V1</span>
                    </div>
                    {activeTab === 'portfolio_v1' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>

                  <button
                    id="tour-tab-investment_plan-desktop"
                    onClick={() => setActiveTab('investment_plan')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'investment_plan'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ClipboardList className="w-4 h-4 shrink-0 opacity-80" />
                      <span>Investment Plan</span>
                    </div>
                    {activeTab === 'investment_plan' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>

                  <button
                    id="tour-tab-reports-desktop"
                    onClick={() => setActiveTab('reports')}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'reports'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileBarChart className="w-4 h-4 shrink-0 opacity-80" />
                      <span>Reports</span>
                    </div>
                    {activeTab === 'reports' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>
                </nav>
              </div>
              )}

              {/* SECTION: SETTINGS & PREFERENCES */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                  Settings
                </span>
                <nav className="flex flex-col gap-1 text-left">
                  {(hasFeature('team') || incomingInvitations.length > 0) && (
                  <button
                    onClick={() => {
                      setActiveTab('account');
                      setSettingsSubTab('members');
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'account' && settingsSubTab === 'members'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 shrink-0 opacity-80" />
                      <span>Workspace</span>
                    </div>
                    {activeTab === 'account' && settingsSubTab === 'members' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>
                  )}

                  <button
                    onClick={() => {
                      setActiveTab('account');
                      setSettingsSubTab('preferences');
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'account' && settingsSubTab === 'preferences'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 shrink-0 opacity-80" />
                      <span>Preferences</span>
                    </div>
                    {activeTab === 'account' && settingsSubTab === 'preferences' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('account');
                      setSettingsSubTab('security');
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'account' && settingsSubTab === 'security'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 shrink-0 opacity-80" />
                      <span>Account Security</span>
                    </div>
                    {activeTab === 'account' && settingsSubTab === 'security' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>

                  {userProfile?.isSuperAdmin && (
                    <button
                      onClick={() => setActiveTab('admin_users')}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                        activeTab === 'admin_users'
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 shrink-0 opacity-80" />
                        <span>App & License</span>
                      </div>
                      {activeTab === 'admin_users' && (
                        <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                      )}
                    </button>
                  )}
                </nav>
              </div>
            </div>
          </div>

          {/* User Profile Card inside Sidebar */}
          <div className="shrink-0 pt-4 border-t border-slate-100 dark:border-slate-900/80 flex flex-col gap-3">
            <div 
              onClick={() => setIsProfileScopeModalOpen(true)}
              className="flex items-center gap-3 bg-slate-50/80 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors group"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-black uppercase shrink-0 border border-indigo-200/20 dark:border-indigo-800/20 group-hover:scale-105 transition-transform">
                {userProfile?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 text-left flex-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-none group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {userProfile?.displayName || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                  {user?.email}
                </p>
              </div>
              
              {/* Pulse syncing status */}
              {isSyncing ? (
                <div className="w-4 h-4 flex items-center justify-center rounded-full shrink-0">
                  <RefreshCw className="w-2.5 h-2.5 text-indigo-500 animate-spin" />
                </div>
              ) : (
                <div className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  Scope
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const nextTheme = theme === 'light' ? 'dark' : 'light';
                  setTheme(nextTheme);
                  localStorage.setItem('pm_theme', nextTheme);
                }}
                className="flex-1 py-2 flex items-center justify-center bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800/60 rounded-xl text-slate-500 dark:text-slate-400 cursor-pointer transition-all duration-200"
                title="Toggle Theme"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
              <button
                onClick={logOut}
                className="flex-1 py-2 flex items-center justify-center bg-slate-50 dark:bg-slate-900 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 dark:hover:text-rose-400 border border-slate-100 dark:border-slate-800/60 rounded-xl text-slate-500 dark:text-slate-400 cursor-pointer transition-all duration-200 text-[10px] font-black uppercase tracking-wider"
              >
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Full-space Mobile Side Menu Drawer (AnimatePresence) */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden fixed inset-0 h-dvh bg-white dark:bg-slate-950 z-50 flex flex-col select-none p-6"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
            >
              {/* Inside Menu Drawer - scrolls independently, footer below stays fixed */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
                {/* Header with Title and Close Button */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20 dark:shadow-indigo-950/40 relative animate-none">
                      <span className="text-base tracking-tighter">H</span>
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full" />
                    </div>
                    <div className="text-left">
                      <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                        Haven Vault
                      </h1>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-block w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-pulse" />
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{activeWorkspace?.type === 'business' ? 'Business Ledger' : 'Family Payment Ledger'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full text-slate-500 dark:text-slate-400 cursor-pointer transition-colors"
                  >
                    <X className="w-5.5 h-5.5" />
                  </button>
                </div>

                <WorkspaceSwitcher
                  workspaces={workspaces}
                  activeWorkspace={activeWorkspace}
                  onSwitch={switchWorkspace}
                  onCreateNew={createWorkspace}
              onRename={renameWorkspace}
              onDelete={deleteWorkspace}
              canCreateBusiness={userProfile?.isSuperAdmin || userProfile?.canCreateBusiness}
                />

                {/* Menu Sections */}
                <div className="space-y-6">
                  {/* SECTION: ANALYTICS & OVERVIEW */}
                  {(hasFeature('core') || hasFeature('ai')) && (
                  <div className="space-y-1">
                    <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                      Overview & Stats
                    </span>
                    <nav className="flex flex-col gap-1 text-left">
                      {hasFeature('core') && (
                      <button
                        onClick={() => {
                          setActiveTab('summary');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'summary'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <LayoutDashboard className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>{activeWorkspace?.type === 'business' ? 'Overview' : 'Dashboard'}</span>
                        </div>
                        {activeTab === 'summary' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>
                      )}

                      {hasFeature('core') && (
                      <button
                        onClick={() => {
                          setActiveTab('expenses');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'expenses'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Globe className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>{activeWorkspace?.type === 'business' ? 'Operating Costs' : 'Expenses'}</span>
                        </div>
                        {activeTab === 'expenses' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>
                      )}

                      {hasFeature('ai') && (
                      <button
                        onClick={() => {
                          setActiveTab('ai');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'ai'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <BrainCircuit className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>AI Insights</span>
                        </div>
                        {activeTab === 'ai' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>
                      )}
                    </nav>
                  </div>
                  )}

                  {/* SECTION: BILL MANAGEMENT */}
                  {(hasFeature('core') || hasFeature('income') || hasFeature('rewards')) && (
                  <div className="space-y-1">
                    <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                      Payments & Bills
                    </span>
                    <nav className="flex flex-col gap-1 text-left">
                      {hasFeature('core') && (
                      <button
                        onClick={() => {
                          setActiveTab('configure');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'configure'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Settings className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>{activeWorkspace?.type === 'business' ? 'Bills & Subscriptions' : 'Manage Bills'}</span>
                        </div>
                        {activeTab === 'configure' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>
                      )}

                      {hasFeature('core') && (
                      <button
                        onClick={() => {
                          setActiveTab('history');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'history'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <History className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>{activeWorkspace?.type === 'business' ? 'Transactions' : 'Payment History'}</span>
                        </div>
                        {activeTab === 'history' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>
                      )}

                      {hasFeature('income') && (
                      <button
                        id="tour-tab-income-mobile"
                        onClick={() => { setActiveTab('income'); setIsMobileMenuOpen(false); }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'income'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Wallet className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>Income</span>
                        </div>
                        {activeTab === 'income' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>
                      )}

                      {activeWorkspace?.type !== 'business' && hasFeature('rewards') && (
                        <button
                          onClick={() => { setActiveTab('rewards'); setIsMobileMenuOpen(false); }}
                          className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                            activeTab === 'rewards'
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Award className="w-4.5 h-4.5 shrink-0 opacity-80" />
                            <span>Membership Hub</span>
                          </div>
                          {activeTab === 'rewards' && (
                            <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                          )}
                        </button>
                      )}
                    </nav>
                  </div>
                  )}

                  {/* SECTION: INVESTMENT */}
                  {hasFeature('portfolio') && (
                  <div className="space-y-1">
                    <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                      Investment
                    </span>
                    <nav className="flex flex-col gap-1 text-left">
                      <button
                        id="tour-tab-portfolio-mobile"
                        onClick={() => { setActiveTab('portfolio'); setIsMobileMenuOpen(false); }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'portfolio'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Briefcase className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>Portfolio</span>
                        </div>
                        {activeTab === 'portfolio' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>

                      <button
                        id="tour-tab-portfolio_v1-mobile"
                        onClick={() => { setActiveTab('portfolio_v1'); setIsMobileMenuOpen(false); }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'portfolio_v1'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Briefcase className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>Portfolio_V1</span>
                        </div>
                        {activeTab === 'portfolio_v1' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>

                      <button
                        id="tour-tab-investment_plan-mobile"
                        onClick={() => { setActiveTab('investment_plan'); setIsMobileMenuOpen(false); }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'investment_plan'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <ClipboardList className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>Investment Plan</span>
                        </div>
                        {activeTab === 'investment_plan' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>

                      <button
                        id="tour-tab-reports-mobile"
                        onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'reports'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <FileBarChart className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>Reports</span>
                        </div>
                        {activeTab === 'reports' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>
                    </nav>
                  </div>
                  )}

                  {/* SECTION: SETTINGS */}
                  <div className="space-y-1">
                    <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                      Settings
                    </span>
                    <nav className="flex flex-col gap-1 text-left">
                      {(hasFeature('team') || incomingInvitations.length > 0) && (
                      <button
                        onClick={() => {
                          setActiveTab('account');
                          setSettingsSubTab('members');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'account' && settingsSubTab === 'members'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Users className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>Workspace</span>
                        </div>
                        {activeTab === 'account' && settingsSubTab === 'members' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>
                      )}
                      <button
                        onClick={() => {
                          setActiveTab('account');
                          setSettingsSubTab('preferences');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'account' && settingsSubTab === 'preferences'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Sliders className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>Preferences</span>
                        </div>
                        {activeTab === 'account' && settingsSubTab === 'preferences' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('account');
                          setSettingsSubTab('security');
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                          activeTab === 'account' && settingsSubTab === 'security'
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Shield className="w-4.5 h-4.5 shrink-0 opacity-80" />
                          <span>Account Security</span>
                        </div>
                        {activeTab === 'account' && settingsSubTab === 'security' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>

                      {userProfile?.isSuperAdmin && (
                        <button
                          onClick={() => { setActiveTab('admin_users'); setIsMobileMenuOpen(false); }}
                          className={`flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                            activeTab === 'admin_users'
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <ShieldCheck className="w-4.5 h-4.5 shrink-0 opacity-80" />
                            <span>App & License</span>
                          </div>
                          {activeTab === 'admin_users' && (
                            <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                          )}
                        </button>
                      )}
                    </nav>
                  </div>
                </div>
              </div>

              {/* User Profile Card and Actions inside Sidebar */}
              <div className="shrink-0 pt-4 border-t border-slate-100 dark:border-slate-900/80 flex flex-col gap-3">
                <div className="flex items-center gap-3 bg-slate-50/80 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-black uppercase shrink-0 border border-indigo-200/20 dark:border-indigo-800/20">
                    {userProfile?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0 text-left flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-none">
                      {userProfile?.displayName || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                      {user?.email}
                    </p>
                  </div>
                  
                  {isSyncing && (
                    <div className="w-4 h-4 flex items-center justify-center rounded-full shrink-0">
                      <RefreshCw className="w-2.5 h-2.5 text-indigo-500 animate-spin" />
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const nextTheme = theme === 'light' ? 'dark' : 'light';
                      setTheme(nextTheme);
                      localStorage.setItem('pm_theme', nextTheme);
                    }}
                    className="flex-1 py-2.5 flex items-center justify-center bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800/60 rounded-xl text-slate-500 dark:text-slate-400 cursor-pointer transition-all duration-200"
                    title="Toggle Theme"
                  >
                    {theme === 'light' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
                  </button>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      logOut();
                    }}
                    className="flex-1 py-2.5 flex items-center justify-center bg-slate-50 dark:bg-slate-900 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 dark:hover:text-rose-400 border border-slate-100 dark:border-slate-800/60 rounded-xl text-slate-500 dark:text-slate-400 cursor-pointer transition-all duration-200 text-[10px] font-black uppercase tracking-wider"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Workspace Column (Header, Content & Mobile Bottom Nav) */}
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
          
          {/* App Header Bar (Hidden on Desktop Sidebar view) - fixed rather than sticky so
              it's guaranteed to stay pinned to the top of the screen regardless of scroll
              or mobile browser chrome quirks, like a real installed app. The spacer div
              right after it holds an identical (invisible) copy so page content doesn't
              render underneath the now out-of-flow header. */}
          <header
            className="md:hidden fixed top-0 left-0 right-0 px-4 py-3 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center z-30"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-1.5 -ml-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                title="Open Navigation Drawer"
              >
                <Menu className="w-5.5 h-5.5" />
              </button>
              <div>
                <h1 className="text-base font-black tracking-tight text-slate-950 dark:text-white flex items-center gap-1.5 text-left animate-none">
                  <span>Haven Vault</span>
                  <span className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-500 rounded-full animate-ping" />
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Quick Access Theme Toggle Button */}
              <button
                onClick={() => {
                  const nextTheme = theme === 'light' ? 'dark' : 'light';
                  setTheme(nextTheme);
                  localStorage.setItem('pm_theme', nextTheme);
                }}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                {theme === 'light' ? (
                  <Moon className="w-4.5 h-4.5" />
                ) : (
                  <Sun className="w-4.5 h-4.5" />
                )}
              </button>

              {/* Header Action: Guided tour trigger */}
              <button
                onClick={() => setShowTour(true)}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                title="Take the guided tour"
              >
                <Compass className="w-4.5 h-4.5" />
              </button>

              {/* Header Action: Notification Center bell toggler */}
              <button 
                onClick={() => {
                  setIsNotifDrawerOpen(true);
                  markAllNotificationsRead();
                }}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 relative transition-colors cursor-pointer"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 border-2 border-white dark:border-slate-950 rounded-full flex items-center justify-center text-[8px] font-black text-white animate-bounce">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Header Action: Agent/Chat - same toggles as the floating capsule, kept here
                  too since that capsule can end up covered by or covering page content when
                  scrolled down on longer pages, making it unreliable as the only entry point. */}
              {user && hasFeature('agent') && (
                <button
                  onClick={toggleAgent}
                  className={`p-2 rounded-full transition-colors cursor-pointer ${isAgentOpen ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
                  title="Haven AI Agent"
                >
                  <Sparkles className="w-4.5 h-4.5" />
                </button>
              )}
              {user && hasFeature('chat') && (
                <button
                  onClick={toggleFamilyChat}
                  className={`p-2 rounded-full transition-colors cursor-pointer ${isFamilyChatOpen ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
                  title="Family Chat"
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                </button>
              )}

              {/* User Profile avatar + Loading indicator */}
              <button 
                onClick={() => setIsProfileScopeModalOpen(true)}
                className="relative flex items-center gap-1.5 ml-1 pl-1 pr-2.5 py-0.5 bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-900 dark:hover:bg-slate-850 rounded-full border border-slate-150 dark:border-slate-855 transition-colors cursor-pointer group"
              >
                <div className="w-5.5 h-5.5 rounded-full bg-indigo-150 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 flex items-center justify-center text-[9px] font-black uppercase shrink-0 group-hover:scale-105 transition-transform">
                  {userProfile?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 max-w-[45px] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {userProfile?.displayName || user?.email?.split('@')[0] || 'User'}
                </span>
                
                {/* Spinning/pulsing syncing loading icon next to the profile */}
                {isSyncing && (
                  <div className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 shrink-0">
                    <RefreshCw className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  </div>
                )}
              </button>
            </div>
          </header>

          {/* Reserves the same space the fixed header above now occupies (it's out of
              normal document flow), so page content starts below it instead of underneath. */}
          <div className="md:hidden shrink-0" style={{ height: 'calc(env(safe-area-inset-top) + 3.75rem)' }} />

          {/* Dynamic page content body */}
          <main className={`flex-1 overflow-x-hidden flex flex-col min-h-0 ${
            uiPulse && (activeTab === 'expenses' || activeTab === 'summary')
              ? 'overflow-hidden'
              : 'overflow-y-auto'
          }`}>
            {(activeTab === 'summary' || activeTab === 'expenses') && hasFeature('core') && (
              <div className="shrink-0 px-4 sm:px-5 pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={togglePulse}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50"
                  title={uiPulse ? 'Switch to Classic layout' : 'Switch to Pulse layout'}
                >
                  <Sparkles className="w-3 h-3" />
                  {uiPulse ? 'Pulse' : 'Classic'}
                  <span className="opacity-60">·</span>
                  {uiPulse ? 'Classic' : 'Try Pulse'}
                </button>
              </div>
            )}
            {activeTab === 'summary' && hasFeature('core') ? (
              uiPulse ? (
                <PulseDashboard
                  payments={payments}
                  history={history}
                  countries={countries}
                  summaryCurrency={summaryCurrency}
                  onRecordPayment={handleRecordPayment}
                  onNavigateToBills={() => setActiveTab('configure')}
                  isReadOnly={userProfile?.role === 'view'}
                  currentUserUid={user?.uid}
                  monthlyIncomeEstimate={parseFloat(monthlyIncome) || 0}
                  incomeSources={incomeSources}
                />
              ) : (
                <Dashboard
                  payments={payments}
                  history={history}
                  countries={countries}
                  summaryCurrency={summaryCurrency}
                  onRecordPayment={handleRecordPayment}
                  onNavigateToBills={() => setActiveTab('configure')}
                  isReadOnly={userProfile?.role === 'view'}
                  monthlyIncomeEstimate={parseFloat(monthlyIncome) || 0}
                  incomeSources={incomeSources}
                />
              )
            ) : activeTab === 'expenses' && hasFeature('core') ? (
              uiPulse ? (
                <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
                <PulseExpenses
                  payments={payments}
                  history={history}
                  countries={countries}
                  defaultCurrency={summaryCurrency}
                  onAddCountry={addCountry}
                  onDeleteCountry={deleteCountry}
                  onUpdateCountry={updateCountry}
                  onAddExpenseClick={handleOpenAddModalForCurrency}
                  onRecordPayment={handleRecordPayment}
                  isReadOnly={userProfile?.role === 'view'}
                  currentUserUid={user?.uid}
                />
                </div>
              ) : (
                <ExpensesView
                  payments={payments}
                  history={history}
                  countries={countries}
                  defaultCurrency={summaryCurrency}
                  onAddCountry={addCountry}
                  onDeleteCountry={deleteCountry}
                  onUpdateCountry={updateCountry}
                  onAddExpenseClick={handleOpenAddModalForCurrency}
                  onRecordPayment={handleRecordPayment}
                  isReadOnly={userProfile?.role === 'view'}
                  currentUserUid={user?.uid}
                />
              )
            ) : activeTab === 'configure' && hasFeature('core') ? (
              <ConfigurePayments 
                payments={payments}
                history={history}
                showFrequencyPatterns={showFrequencyPatterns}
                onAddClick={handleOpenAddModal}
                onEditClick={handleOpenEditModal}
                onCloneClick={handleCloneClick}
                onDeleteClick={deletePayment}
                onUpdatePayment={updatePayment}
                onAddBulkPayments={addBulkPayments}
                onUpdatePaymentsOrder={updatePaymentsOrder}
                isReadOnly={userProfile?.role === 'view'}
                currentUserUid={user?.uid}
              />
            ) : activeTab === 'account' ? (
              <AccountInfo 
                payments={payments}
                userProfile={userProfile}
                familyMembers={familyMembers}
                familyRole={familyRole}
                isReadOnly={isReadOnly}
                onAddFamilyMember={addFamilyMember}
                onAddBulkPayments={addBulkPayments}
                portfolios={portfolios}
                onSwitchToMultiPortfolio={switchToMultiPortfolio}
                onCreatePortfolio={createPortfolio}
                onUpdatePortfolio={updatePortfolio}
                onDeletePortfolio={deletePortfolio}
                workspaceCurrencyRates={workspaceCurrencyRates}
                onUpsertCurrencyRate={upsertCurrencyRate}
                workspaceBackups={workspaceBackups}
                onRestoreFromBackup={restoreFromBackup}
                onStartWhatsAppVerification={startWhatsAppVerification}
                onUpdateDisplayName={updateDisplayName}
                currentLandingTab={activeWorkspace?.landingTab}
                onUpdateLandingTab={updateWorkspaceLandingTab}
                hasFeature={hasFeature}
                accessPlans={accessPlans}
                myUpgradeRequest={myUpgradeRequest}
                onRequestUpgrade={requestUpgrade}
                onDisconnectWhatsApp={disconnectWhatsApp}
                onCreateFamily={async () => { await createWorkspace(activeWorkspace?.type === 'business' ? 'My Business' : 'My Family', activeWorkspace?.type || 'family'); }}
                activeWorkspace={activeWorkspace}
                onRenameWorkspace={renameWorkspace}
                onDeleteWorkspace={deleteWorkspace}
                onJoinFamilyGroup={joinFamilyGroup}
                onLeaveFamilyGroup={leaveFamilyGroup}
                incomingInvitations={incomingInvitations}
                onApproveInvitation={approveInvitation}
                onDeclineInvitation={declineInvitation}
                onUpdateMemberRole={updateMemberRole}
                onUpdateMemberPortfolioContributor={updateMemberPortfolioContributor}
                onRemoveFamilyMember={removeFamilyMember}
                outgoingInvitations={outgoingInvitations}
                onCancelInvitation={cancelInvitation}
                inviteCode={inviteCode}
                onRegenerateInviteCode={regenerateInviteCode}
                onLogOut={logOut}
                theme={theme}
                onThemeChange={setTheme}
                countries={countries}
                rate={rate}
                onSaveRate={saveRate}
                summaryCurrency={summaryCurrency}
                onSaveSummaryCurrency={saveSummaryCurrency}
                onRequestNotifications={requestNotificationPermission}
                onTriggerTestNotif={handleTriggerTestReminder}
                customizedTags={customizedTags}
                onSaveCustomizedTags={saveCustomizedTags}
                appNotificationsEnabled={appNotificationsEnabled}
                mobileNotificationsEnabled={mobileNotificationsEnabled}
                onSaveNotificationSettings={saveNotificationSettings}
                showFrequencyPatterns={showFrequencyPatterns}
                onToggleFrequencyPatterns={handleToggleFrequencyPatterns}
                viewMode={viewMode}
                setViewMode={setViewMode}
                activeSubTab={settingsSubTab}
                onActiveSubTabChange={setSettingsSubTab}
              />
            ) : activeTab === 'ai' ? (
              <AiInsights 
                payments={payments}
                history={history}
                userProfile={userProfile}
                onOpenAgent={setIsAgentOpen}
                summaryCurrency={summaryCurrency}
              />
            ) : activeTab === 'rewards' ? (
              <RewardsTracker
                rewardsPerks={rewardsPerks}
                onAddReward={addReward}
                onUpdateReward={updateReward}
                onDeleteReward={deleteReward}
                giftCards={giftCards}
                onAddGiftCard={addGiftCard}
                onUpdateGiftCard={updateGiftCard}
                onRedeemGiftCard={redeemGiftCard}
                onDeleteGiftCard={deleteGiftCard}
                isReadOnly={isReadOnly}
              />
            ) : activeTab === 'portfolio' ? (
              <PortfolioView
                workspaceName={activeWorkspace?.name}
                workspaceMembers={familyMembers}
                isReadOnly={isReadOnly}
                isDataLoading={portfolioDataLoading}
                columnPrefs={activeWorkspace?.columnPrefs}
                onUpdateColumnPrefs={updateWorkspaceColumnPrefs}
                portfolios={portfolios}
                portfolioMode={activeWorkspace?.portfolioMode}
                workspaceCurrencyRates={workspaceCurrencyRates}
                baseCurrency={activeWorkspace?.baseCurrency}
                mfHoldingsCache={mfHoldingsCache}
                loadMfHoldingsCache={loadMfHoldingsCache}
                fetchAndCacheMfHoldings={fetchAndCacheMfHoldings}
                saveManualMfHoldings={saveManualMfHoldings}
                portfolioSplits={portfolioSplits}
                addPortfolioSplit={addPortfolioSplit}
                deletePortfolioSplit={deletePortfolioSplit}
                portfolioHoldings={portfolioHoldings}
                portfolioPriceHistory={portfolioPriceHistory}
                addPortfolioHolding={addPortfolioHolding}
                bulkAddPortfolioHoldings={bulkAddPortfolioHoldings}
                reconcilePortfolioHoldingQuantity={reconcilePortfolioHoldingQuantity}
                markPortfolioHoldingSoldFromImport={markPortfolioHoldingSoldFromImport}
                bulkHistoricalImport={bulkHistoricalImport}
                updatePortfolioHolding={updatePortfolioHolding}
                sellPortfolioHolding={sellPortfolioHolding}
                updatePortfolioHoldingLivePrice={updatePortfolioHoldingLivePrice}
                markPriceLookupFailed={markPriceLookupFailed}
                deletePortfolioHolding={deletePortfolioHolding}
                bulkTagPortfolioHoldings={bulkTagPortfolioHoldings}
                bulkDeletePortfolioHoldings={bulkDeletePortfolioHoldings}
                deleteAllPortfolioData={deleteAllPortfolioData}
                portfolioCashBalances={portfolioCashBalances}
                setPortfolioCashBalance={setPortfolioCashBalance}
                deletePortfolioCashBalance={deletePortfolioCashBalance}
                portfolioBookedPlBaselines={portfolioBookedPlBaselines}
                setBookedPlBaseline={setBookedPlBaseline}
                portfolioProjectedBankBalances={portfolioProjectedBankBalances}
                setProjectedBankBalance={setProjectedBankBalance}
                recalculateProjectedBankBalance={recalculateProjectedBankBalance}
                portfolioBrokerConnections={portfolioBrokerConnections}
                setPortfolioBrokerConnection={setPortfolioBrokerConnection}
                deletePortfolioBrokerConnection={deletePortfolioBrokerConnection}
                markBrokerConnectionSynced={markBrokerConnectionSynced}
                syncEtoroHoldingLots={syncEtoroHoldingLots}
                syncEtoroLivePrices={syncEtoroLivePrices}
                loadPortfolioHoldingLots={loadPortfolioHoldingLots}
                portfolioHoldingLots={portfolioHoldingLots}
                portfolioSnapshots={portfolioSnapshots}
                takePortfolioSnapshot={takePortfolioSnapshot}
                deletePortfolioSnapshotBatch={deletePortfolioSnapshotBatch}
                portfolioContributions={portfolioContributions}
                addPortfolioContribution={addPortfolioContribution}
                updatePortfolioContribution={updatePortfolioContribution}
                deletePortfolioContribution={deletePortfolioContribution}
                portfolioWithdrawals={portfolioWithdrawals}
                addPortfolioWithdrawal={addPortfolioWithdrawal}
                deletePortfolioWithdrawal={deletePortfolioWithdrawal}
                portfolioDividends={portfolioDividends}
                addPortfolioDividend={addPortfolioDividend}
                deletePortfolioDividend={deletePortfolioDividend}
                portfolioFees={portfolioFees}
                addPortfolioFee={addPortfolioFee}
                deletePortfolioFee={deletePortfolioFee}
              />
                        ) : activeTab === 'portfolio_v1' ? (
              <PortfolioV1View
                isReadOnly={isReadOnly}
                isDataLoading={portfolioDataLoading}
                baseCurrency={activeWorkspace?.baseCurrency}
                workspaceName={activeWorkspace?.name}
                portfolios={portfolios}
                portfolioMode={activeWorkspace?.portfolioMode}
                portfolioHoldings={portfolioHoldings}
                portfolioHoldingLots={portfolioHoldingLots}
                portfolioCashBalances={portfolioCashBalances}
                portfolioBrokerConnections={portfolioBrokerConnections}
                workspaceCurrencyRates={workspaceCurrencyRates}
                setPortfolioBrokerConnection={setPortfolioBrokerConnection}
                deletePortfolioBrokerConnection={deletePortfolioBrokerConnection}
                markBrokerConnectionSynced={markBrokerConnectionSynced}
                updatePortfolioHoldingLivePrice={updatePortfolioHoldingLivePrice}
                markPriceLookupFailed={markPriceLookupFailed}
              />
            ) : activeTab === 'investment_plan' ? (
              <InvestmentPlanView
                workspaceName={activeWorkspace?.name}
                workspaceMembers={contributorMembers}
                isReadOnly={isReadOnly}
                currentUserId={user?.id}
                portfolios={portfolios}
                portfolioMode={activeWorkspace?.portfolioMode}
                workspaceCurrencyRates={workspaceCurrencyRates}
                baseCurrency={activeWorkspace?.baseCurrency}
                dismissedReminderKey={activeWorkspace?.dismissedReminderKey}
                onDismissContributionReminder={dismissContributionReminder}
                portfolioSplits={portfolioSplits}
                addPortfolioSplit={addPortfolioSplit}
                deletePortfolioSplit={deletePortfolioSplit}
                portfolioContributions={portfolioContributions}
                addPortfolioContribution={addPortfolioContribution}
                updatePortfolioContribution={updatePortfolioContribution}
                deletePortfolioContribution={deletePortfolioContribution}
                portfolioWithdrawals={portfolioWithdrawals}
                addPortfolioWithdrawal={addPortfolioWithdrawal}
                deletePortfolioWithdrawal={deletePortfolioWithdrawal}
                portfolioCashBalances={portfolioCashBalances}
                setPortfolioCashBalance={setPortfolioCashBalance}
                deletePortfolioCashBalance={deletePortfolioCashBalance}
                portfolioBookedPlBaselines={portfolioBookedPlBaselines}
                setBookedPlBaseline={setBookedPlBaseline}
                portfolioProjectedBankBalances={portfolioProjectedBankBalances}
                setProjectedBankBalance={setProjectedBankBalance}
                portfolioRecurringPlans={portfolioRecurringPlans}
                addPortfolioRecurringPlan={addPortfolioRecurringPlan}
                updatePortfolioRecurringPlan={updatePortfolioRecurringPlan}
                deletePortfolioRecurringPlan={deletePortfolioRecurringPlan}
              />
            ) : activeTab === 'reports' ? (
              <ReportsView
                workspaceName={activeWorkspace?.name}
                workspaceMembers={contributorMembers}
                isReadOnly={isReadOnly}
                portfolios={portfolios}
                portfolioMode={activeWorkspace?.portfolioMode}
                workspaceCurrencyRates={workspaceCurrencyRates}
                baseCurrency={activeWorkspace?.baseCurrency}
                portfolioHoldings={portfolioHoldings}
                portfolioPriceHistory={portfolioPriceHistory}
                portfolioContributions={portfolioContributions}
                portfolioWithdrawals={portfolioWithdrawals}
                portfolioDividends={portfolioDividends}
                addPortfolioDividend={addPortfolioDividend}
                deletePortfolioDividend={deletePortfolioDividend}
                portfolioFees={portfolioFees}
                addPortfolioFee={addPortfolioFee}
                deletePortfolioFee={deletePortfolioFee}
                portfolioSplits={portfolioSplits}
                portfolioCashBalances={portfolioCashBalances}
                portfolioSnapshots={portfolioSnapshots}
                takePortfolioSnapshot={takePortfolioSnapshot}
                deletePortfolioSnapshotBatch={deletePortfolioSnapshotBatch}
                mfHoldingsCache={mfHoldingsCache}
                loadMfHoldingsCache={loadMfHoldingsCache}
              />
            ) : activeTab === 'income' ? (
              <IncomeView
                incomeSources={incomeSources}
                incomeMode={incomeMode}
                monthlyIncome={monthlyIncome}
                summaryCurrency={summaryCurrency}
                countries={countries}
                payments={payments}
                history={history}
                addIncomeSource={addIncomeSource}
                deleteIncomeSource={deleteIncomeSource}
                updateIncomeMode={updateIncomeMode}
                updateMonthlyIncome={updateMonthlyIncome}
                isReadOnly={isReadOnly}
              />
            ) : activeTab === 'admin_users' && userProfile?.isSuperAdmin ? (
              <AdminUsersView
                fetchAllUsersForAdmin={fetchAllUsersForAdmin}
                inviteNewUser={inviteNewUser}
                onOnboardUserWithPlan={onboardUserWithPlan}
                accessPlans={accessPlans}
                onCreatePlan={createAccessPlan}
                onUpdatePlan={updateAccessPlan}
                onDeletePlan={deleteAccessPlan}
                fetchPendingUpgradeRequests={fetchPendingUpgradeRequests}
                onResolveUpgradeRequest={resolveUpgradeRequest}
                onSetUserPlan={adminSetUserPlan}
                onSetSuperAdmin={setSuperAdminStatus}
                currentUserId={user?.id}
              />
            ) : activeTab === 'history' && hasFeature('core') ? (
              <PaymentHistoryView 
                history={history}
                onDeleteHistoryEntry={deleteHistoryEntry}
                onUpdateHistoryStatus={updateHistoryStatus}
                onClearHistory={clearHistory}
                rate={rate}
                summaryCurrency={summaryCurrency}
                countries={countries}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <p className="text-sm text-slate-400">This page isn't available on your current plan.</p>
              </div>
            )}
          </main>

          {/* Mobile Glassmorphism Floating Bottom Navigation */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 px-4 z-20 pointer-events-none select-none"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
          >
            <nav className="pointer-events-auto bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/40 py-2 px-3 flex justify-between items-center gap-1 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] max-w-sm mx-auto">
              {/* Summary Tab button */}
              {hasFeature('core') && (
              <button
                id="tour-tab-summary-mobile"
                onClick={() => setActiveTab('summary')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1 flex-1 rounded-xl transition-all ${
                  activeTab === 'summary' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 font-black scale-105 shadow-sm border border-indigo-100/30' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
                }`}
              >
                <LayoutDashboard className="w-4.5 h-4.5" />
                <span className="text-[8px] uppercase tracking-wider font-extrabold">Summary</span>
              </button>
              )}

              {/* Expenses Tab button */}
              {hasFeature('core') && (
              <button
                id="tour-tab-expenses-mobile"
                onClick={() => setActiveTab('expenses')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1 flex-1 rounded-xl transition-all ${
                  activeTab === 'expenses' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 font-black scale-105 shadow-sm border border-indigo-100/30' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
                }`}
              >
                <Globe className="w-4.5 h-4.5" />
                <span className="text-[8px] uppercase tracking-wider font-extrabold">Expenses</span>
              </button>
              )}

              {/* Configure Tab button */}
              {hasFeature('core') && (
              <button
                onClick={() => setActiveTab('configure')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1 flex-1 rounded-xl transition-all ${
                  activeTab === 'configure' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 font-black scale-105 shadow-sm border border-indigo-100/30' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
                }`}
              >
                <Settings className="w-4.5 h-4.5" />
                <span className="text-[8px] uppercase tracking-wider font-extrabold">Subs</span>
              </button>
              )}

              {/* AI Insights Tab button */}
              {hasFeature('ai') && (
              <button
                id="tour-tab-ai-mobile"
                onClick={() => setActiveTab('ai')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1 flex-1 rounded-xl transition-all ${
                  activeTab === 'ai' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 font-black scale-105 shadow-sm border border-indigo-100/30' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
                }`}
              >
                <BrainCircuit className="w-4.5 h-4.5" />
                <span className="text-[8px] uppercase tracking-wider font-extrabold">AI</span>
              </button>
              )}

              {/* Portfolio Tab button */}
              {hasFeature('portfolio') && (
              <button
                onClick={() => setActiveTab('portfolio')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1 flex-1 rounded-xl transition-all ${
                  activeTab === 'portfolio' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 font-black scale-105 shadow-sm border border-indigo-100/30' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
                }`}
              >
                <Briefcase className="w-4.5 h-4.5" />
                <span className="text-[8px] uppercase tracking-wider font-extrabold">Portfolio</span>
              </button>
              )}

              {/* Investment Plan and Reports fill the footer when Portfolio would otherwise be
                  the only item there (e.g. Lite-Finance, which has no 'core' access) - keeps
                  the bar from looking sparse with a single icon. Full plans still use the
                  drawer for these, since the footer is already fairly full there. */}
              {hasFeature('portfolio') && !hasFeature('core') && (
              <>
              <button
                onClick={() => setActiveTab('investment_plan')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1 flex-1 rounded-xl transition-all ${
                  activeTab === 'investment_plan' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 font-black scale-105 shadow-sm border border-indigo-100/30' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
                }`}
              >
                <ClipboardList className="w-4.5 h-4.5" />
                <span className="text-[8px] uppercase tracking-wider font-extrabold">Plan</span>
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1 flex-1 rounded-xl transition-all ${
                  activeTab === 'reports' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 font-black scale-105 shadow-sm border border-indigo-100/30' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
                }`}
              >
                <FileBarChart className="w-4.5 h-4.5" />
                <span className="text-[8px] uppercase tracking-wider font-extrabold">Reports</span>
              </button>
              </>
              )}

              {/* History Tab button */}
              {hasFeature('core') && (
              <button
                onClick={() => setActiveTab('history')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1 flex-1 rounded-xl transition-all ${
                  activeTab === 'history' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 font-black scale-105 shadow-sm border border-indigo-100/30' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
                }`}
              >
                <History className="w-4.5 h-4.5" />
                <span className="text-[8px] uppercase tracking-wider font-extrabold">History</span>
              </button>
              )}
            </nav>
          </div>

        </div>

        {/* iOS Notification Center Sliding Drawer */}
        <AnimatePresence>
          {isNotifDrawerOpen && (
            <>
              {/* Drawer overlay */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsNotifDrawerOpen(false)}
                className="fixed inset-0 bg-black z-30"
              />

              {/* Drawer Sheet */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                className="fixed top-0 bottom-0 right-0 w-[82%] bg-slate-900 text-white z-40 shadow-2xl flex flex-col overflow-hidden text-left"
              >
                {/* Header */}
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-indigo-400" /> Notifications
                  </h4>
                  <button 
                    onClick={() => setIsNotifDrawerOpen(false)}
                    className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Notifications list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">History Log</span>
                    {notifications.length > 0 && (
                      <button 
                        onClick={clearNotifications}
                        className="text-[9px] text-rose-400 hover:text-rose-300 font-bold underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="py-20 text-center">
                      <Bell className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
                      <p className="text-xs text-slate-500 font-medium mt-2">All caught up! No notifications yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {notifications.map((n) => (
                        <div 
                          key={n.id}
                          className={`p-3 rounded-xl border border-slate-800 bg-slate-950/60 relative overflow-hidden ${
                            n.type === 'alert' ? 'border-l-rose-500 border-l-3' : n.type === 'warning' ? 'border-l-amber-500 border-l-3' : 'border-l-indigo-500 border-l-3'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2 text-left">
                            <span className="text-[9px] font-black text-indigo-400 tracking-wider uppercase">{n.type}</span>
                            <span className="text-[8px] text-slate-500 font-medium">{n.date}</span>
                          </div>
                          <h5 className="text-xs font-bold text-white mt-1 leading-tight">{n.title}</h5>
                          <p className="text-[10px] text-slate-400 mt-1 leading-normal font-normal">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Recurring payment Add/Edit Slider Modal sheet */}
        <PaymentModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSavePayment}
          editingPayment={editingPayment}
          countries={countries}
          preselectedCurrency={preselectedCurrency}
          familyMembers={familyMembers}
          payments={payments}
          history={history}
          customizedTags={customizedTags}
        />

        {/* Unified Record Transaction / Log Bill Modal */}
        <AnimatePresence>
          {recordingTransactionPayment && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setRecordingTransactionPayment(null);
                  setTransactionSuccessMessage(null);
                }}
                className="fixed inset-0 bg-black z-40"
              />

              {/* Bottom Sheet Modal */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed bottom-0 left-0 right-0 max-h-[85%] bg-white dark:bg-slate-950 rounded-t-[30px] shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-50 flex flex-col overflow-hidden text-left"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                {/* Drag Notch handle */}
                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-800 rounded-full mx-auto mt-3 shrink-0" />
                
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-900 shrink-0">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                      Log payment
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[16rem]">
                      {recordingTransactionPayment?.name}
                      {recordingTransactionPayment?.billingCycle ? ` · ${recordingTransactionPayment.billingCycle}` : ''}
                      {recordingTransactionPayment?.paymentMethod === 'direct_debit' ? ' · DD' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setRecordingTransactionPayment(null);
                      setTransactionSuccessMessage(null);
                      setTransactionError(null);
                    }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full text-slate-500 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {transactionSuccessMessage ? (
                  <div className="p-10 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-10 h-10 animate-bounce" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Transaction Saved
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm leading-normal">
                      {transactionSuccessMessage}
                    </p>
                    <div className="pt-2 text-[10px] text-slate-400 dark:text-slate-500 animate-pulse font-medium">
                      Closing window...
                    </div>
                  </div>
                ) : (
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setTransactionError(null);
                      
                      const parsed = parseFloat(transactionAmount);
                      if (isNaN(parsed) || parsed < 0) {
                        setTransactionError('Please enter a valid positive transaction amount.');
                        return;
                      }
                      if (transactionStatus === 'paid' && parsed <= 0) {
                        setTransactionError('Transaction amount must be greater than zero when marking as paid.');
                        return;
                      }

                      const cleanTag = (transactionTaggedFor || '').trim();
                      
                      // Auto-save new custom tag to LocalStorage
                      if (cleanTag) {
                        const defaultAndExistingTags = ['Bank', 'Home', 'Father', 'Mother', 'Self'];
                        const familyNames = (familyMembers || []).map(m => m.displayName).filter(Boolean) as string[];
                        const paymentTags = (payments || []).map(p => p.taggedFor).filter(Boolean) as string[];
                        const historyTags = (history || []).map(h => h.taggedFor).filter(Boolean) as string[];
                        const baseTags = [...defaultAndExistingTags, ...familyNames, ...paymentTags, ...historyTags];
                        
                        if (!baseTags.some(t => t.toLowerCase() === cleanTag.toLowerCase()) && !customTags.some(t => t.toLowerCase() === cleanTag.toLowerCase())) {
                          const updatedCustom = [...customTags, cleanTag];
                          setCustomTags(updatedCustom);
                          localStorage.setItem('pm_custom_tags', JSON.stringify(updatedCustom));
                        }
                      }

                      const targetPaymentId = recordingTransactionPayment?.id;

                      // Close modal immediately for optimal responsiveness and instant UX feedback
                      setRecordingTransactionPayment(null);
                      setTransactionSuccessMessage(null);
                      setTransactionError(null);

                      if (targetPaymentId) {
                        // Dispatch the record payment in the background
                        recordPayment(
                          targetPaymentId, 
                          parsed, 
                          transactionStatus, 
                          cleanTag || undefined,
                          transactionDate || undefined
                        ).catch((err: any) => {
                          console.error(err);
                          triggerNotification(
                            'Failed to Log 🚫',
                            err.message || 'Failed to log transaction.',
                            'warning'
                          );
                        });
                      }
                    }}
                    className="p-6 space-y-4 overflow-y-auto"
                  >
                    {transactionError && (
                      <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 p-3 rounded-xl flex items-center gap-2 text-xs font-semibold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{transactionError}</span>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                      Confirm status, amount, and date. For direct debit, “Paid” means the bank has already taken it.
                    </p>

                    {/* Status Picker - Segmented Card Style */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Transaction Status
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setTransactionStatus('paid')}
                          className={`p-2.5 rounded-xl border text-center flex flex-col justify-center items-center gap-1 transition-all cursor-pointer ${
                            transactionStatus === 'paid'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-950/20 dark:text-emerald-400 font-bold'
                              : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-[11px] uppercase tracking-wider">Paid</span>
                          <span className="text-[8px] opacity-75">Billed & Paid</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTransactionStatus('delayed')}
                          className={`p-2.5 rounded-xl border text-center flex flex-col justify-center items-center gap-1 transition-all cursor-pointer ${
                            transactionStatus === 'delayed'
                              ? 'border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-500/50 dark:bg-amber-950/20 dark:text-amber-400 font-bold'
                              : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-[11px] uppercase tracking-wider">Delayed</span>
                          <span className="text-[8px] opacity-75">Late payment</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTransactionStatus('carry')}
                          className={`p-2.5 rounded-xl border text-center flex flex-col justify-center items-center gap-1 transition-all cursor-pointer ${
                            transactionStatus === 'carry'
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-800 dark:border-indigo-500/50 dark:bg-indigo-950/20 dark:text-indigo-400 font-bold'
                              : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-[11px] uppercase tracking-wider">Carry Over</span>
                          <span className="text-[8px] opacity-75">Move next mo.</span>
                        </button>
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Transaction Amount ({recordingTransactionPayment.currency})
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">
                          {countries.find(c => c.currency.toUpperCase() === recordingTransactionPayment.currency.toUpperCase())?.symbol || '$'}
                        </span>
                        <input
                          type="number"
                          step="any"
                          value={transactionAmount}
                          onChange={(e) => setTransactionAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-6 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                          required
                        />
                      </div>
                    </div>

                    {/* Payment Date */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Payment Date / Due Date
                      </label>
                      <input
                        type="date"
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        required
                      />
                    </div>

                    {/* For Whom Tag */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        For Whom (Beneficiary / Tag)
                      </label>
                      <input
                        type="text"
                        value={transactionTaggedFor}
                        onChange={(e) => setTransactionTaggedFor(e.target.value)}
                        placeholder="e.g. Bank, Father, Mother, Home, Self"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        maxLength={40}
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto no-scrollbar">
                        {allUniqueTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setTransactionTaggedFor(tag)}
                            className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full border transition-all cursor-pointer ${
                              transactionTaggedFor.toLowerCase() === tag.toLowerCase()
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400 font-extrabold'
                                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 pb-4">
                      <button
                        type="button"
                        onClick={() => {
                          setRecordingTransactionPayment(null);
                          setTransactionSuccessMessage(null);
                          setTransactionError(null);
                        }}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSyncing}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isSyncing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          'Log Transaction'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {user && hasFeature('agent') && (
          <AgentAssistant 
            payments={payments}
            history={history}
            userProfile={userProfile}
            summaryCurrency={summaryCurrency}
            onAddPayment={addPayment}
            onUpdatePayment={updatePayment}
            onRecordPayment={async (paymentId, amount, status, taggedFor) => {
              await recordPayment(paymentId, amount, status, taggedFor);
            }}
            isOpen={isAgentOpen}
            onOpenChange={setIsAgentOpen}
            hideFab
          />
        )}

        {user && hasFeature('chat') && (
          <FamilyChatAssistant
            currentUserUid={user.id}
            userProfile={userProfile}
            familyMembers={familyMembers}
            messages={familyMessages}
            onSendMessage={sendFamilyMessage}
            isOpen={isFamilyChatOpen}
            onClose={() => setIsFamilyChatOpen(false)}
          />
        )}

        {/* Floating Agent+Chat capsule removed - it could end up obscured by or covering page
            content when scrolled on longer pages, which is exactly why the header icons next
            to the notification bell were added as the reliable, always-visible entry point. */}

        {user && (
          <ProfileScopeModal
            isOpen={isProfileScopeModalOpen}
            onClose={() => setIsProfileScopeModalOpen(false)}
            user={user}
            userProfile={userProfile ? { ...userProfile, inviteCode, familyGroupId: activeWorkspaceId || '' } : userProfile}
            familyMembers={familyMembers}
            allPayments={allPayments}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onLogOut={logOut}
            summaryCurrency={summaryCurrency}
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            onSwitchWorkspace={switchWorkspace}
            onCreateWorkspace={createWorkspace}
            canCreateBusiness={userProfile?.isSuperAdmin || userProfile?.canCreateBusiness}
          />
        )}

        {showTour && (
          <AppTour
            onNavigate={(tab) => setActiveTab(tab as any)}
            onOpenMobileMenu={setIsMobileMenuOpen}
            onFinish={() => { setShowTour(false); try { localStorage.setItem('haven_tour_done', '1'); } catch {} markTourCompleted(); }}
            hasFeature={hasFeature}
          />
        )}

      </div>
    </IPhoneFrame>
  );
}
