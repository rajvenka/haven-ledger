import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Settings, 
  History, 
  Bell, 
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
import ConfigurePayments from './components/ConfigurePayments';
import AccountInfo from './components/AccountInfo';
import PaymentHistoryView from './components/PaymentHistoryView';
import ExpensesView from './components/ExpensesView';
import AuthView from './components/AuthView';
import AiInsights from './components/AiInsights';
import { RecurringPayment } from './types';
import AgentAssistant from './components/AgentAssistant';
import FamilyChatAssistant from './components/FamilyChatAssistant';
import ProfileScopeModal from './components/ProfileScopeModal';

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
    logOut,
    addFamilyMember,
    createFamily,
    joinFamilyGroup,
    leaveFamilyGroup,
    incomingInvitations,
    approveInvitation,
    declineInvitation,
    updateMemberRole,
    removeFamilyMember,
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
    appNotificationsEnabled,
    mobileNotificationsEnabled,
    saveNotificationSettings,
  } = usePaymentState();

  const [activeTab, setActiveTab] = useState<'summary' | 'expenses' | 'configure' | 'account' | 'history' | 'ai'>('summary');
  const [settingsSubTab, setSettingsSubTab] = useState<'preferences' | 'team'>('preferences');
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [isFamilyChatOpen, setIsFamilyChatOpen] = useState(false);

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
        />
      </IPhoneFrame>
    );
  }

  // 3. Authenticated user main app
  return (
    <IPhoneFrame>
      {/* Main Container */}
      <div className="flex-1 flex flex-row h-full bg-slate-50 dark:bg-slate-900 relative overflow-hidden text-left">
        
        {/* Persistent Desktop Sidebar Navigation (Hidden on Mobile) */}
        <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-950 border-r border-slate-150/80 dark:border-slate-900 shrink-0 z-20 overflow-y-auto select-none p-6 justify-between">
          <div className="space-y-6">
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
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Family Payment Ledger</span>
                </div>
              </div>
            </div>

            {/* Menu Sections */}
            <div className="space-y-5">
              {/* SECTION: ANALYTICS & OVERVIEW */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                  Overview & Stats
                </span>
                <nav className="flex flex-col gap-1 text-left">
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'summary'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <LayoutDashboard className="w-4 h-4 shrink-0 opacity-80" />
                      <span>Dashboard</span>
                    </div>
                    {activeTab === 'summary' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('expenses')}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'expenses'
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-900/20 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe className="w-4 h-4 shrink-0 opacity-80" />
                      <span>Expenses</span>
                    </div>
                    {activeTab === 'expenses' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>

                  <button
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
                </nav>
              </div>

              {/* SECTION: BILL MANAGEMENT */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                  Payments & Bills
                </span>
                <nav className="flex flex-col gap-1 text-left">
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
                      <span>Manage Bills</span>
                    </div>
                    {activeTab === 'configure' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>

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
                      <span>Payment History</span>
                    </div>
                    {activeTab === 'history' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>
                </nav>
              </div>

              {/* SECTION: NETWORK & TEAMS */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                  Network & Teams
                </span>
                <nav className="flex flex-col gap-1 text-left">
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
                      <span>Family Sharing</span>
                    </div>
                    {activeTab === 'account' && settingsSubTab === 'members' && (
                      <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                    )}
                  </button>
                </nav>
              </div>

              {/* SECTION: SETTINGS & PREFERENCES */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                  Settings
                </span>
                <nav className="flex flex-col gap-1 text-left">
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
                </nav>
              </div>
            </div>
          </div>

          {/* User Profile Card inside Sidebar */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-900/80 flex flex-col gap-3">
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
              className="md:hidden absolute inset-0 bg-white dark:bg-slate-950 z-50 flex flex-col select-none p-6 justify-between overflow-y-auto"
            >
              {/* Inside Menu Drawer */}
              <div className="space-y-6">
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
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Family Payment Ledger</span>
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

                {/* Menu Sections */}
                <div className="space-y-6">
                  {/* SECTION: ANALYTICS & OVERVIEW */}
                  <div className="space-y-1">
                    <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                      Overview & Stats
                    </span>
                    <nav className="flex flex-col gap-1 text-left">
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
                          <span>Dashboard</span>
                        </div>
                        {activeTab === 'summary' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>

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
                          <span>Expenses</span>
                        </div>
                        {activeTab === 'expenses' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>

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
                    </nav>
                  </div>

                  {/* SECTION: BILL MANAGEMENT */}
                  <div className="space-y-1">
                    <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                      Payments & Bills
                    </span>
                    <nav className="flex flex-col gap-1 text-left">
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
                          <span>Manage Bills</span>
                        </div>
                        {activeTab === 'configure' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>

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
                          <span>Payment History</span>
                        </div>
                        {activeTab === 'history' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>
                    </nav>
                  </div>

                  {/* SECTION: NETWORK & TEAMS */}
                  <div className="space-y-1">
                    <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                      Network & Teams
                    </span>
                    <nav className="flex flex-col gap-1 text-left">
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
                          <span>Family Sharing</span>
                        </div>
                        {activeTab === 'account' && settingsSubTab === 'members' && (
                          <span className="w-1 h-3.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                        )}
                      </button>
                    </nav>
                  </div>

                  {/* SECTION: SETTINGS */}
                  <div className="space-y-1">
                    <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider uppercase block text-left">
                      Settings
                    </span>
                    <nav className="flex flex-col gap-1 text-left">
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
                    </nav>
                  </div>
                </div>
              </div>

              {/* User Profile Card and Actions inside Sidebar */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-900/80 flex flex-col gap-3">
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
          
          {/* App Header Bar (Hidden on Desktop Sidebar view) */}
          <header className="md:hidden px-4 py-3 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center shrink-0 z-10">
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
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 text-left">Sleek Family Payment Ledger</p>
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

          {/* Dynamic page content body */}
          <main className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'summary' ? (
              <Dashboard 
                payments={payments}
                history={history}
                countries={countries}
                summaryCurrency={summaryCurrency}
                onRecordPayment={handleRecordPayment}
                isReadOnly={userProfile?.role === 'view'}
              />
            ) : activeTab === 'expenses' ? (
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
            ) : activeTab === 'configure' ? (
              <ConfigurePayments 
                payments={payments}
                history={history}
                showFrequencyPatterns={showFrequencyPatterns}
                onAddClick={handleOpenAddModal}
                onEditClick={handleOpenEditModal}
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
                onCreateFamily={createFamily}
                onJoinFamilyGroup={joinFamilyGroup}
                onLeaveFamilyGroup={leaveFamilyGroup}
                incomingInvitations={incomingInvitations}
                onApproveInvitation={approveInvitation}
                onDeclineInvitation={declineInvitation}
                onUpdateMemberRole={updateMemberRole}
                onRemoveFamilyMember={removeFamilyMember}
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
            ) : (
              <PaymentHistoryView 
                history={history}
                onDeleteHistoryEntry={deleteHistoryEntry}
                onUpdateHistoryStatus={updateHistoryStatus}
                onClearHistory={clearHistory}
                rate={rate}
                summaryCurrency={summaryCurrency}
                countries={countries}
              />
            )}
          </main>

          {/* Mobile Glassmorphism Floating Bottom Navigation */}
          <div className="md:hidden absolute bottom-4 left-0 right-0 px-4 z-20 pointer-events-none select-none">
            <nav className="pointer-events-auto bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/40 py-2 px-3 flex justify-between items-center gap-1 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] max-w-sm mx-auto">
              {/* Summary Tab button */}
              <button
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

              {/* Expenses Tab button */}
              <button
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

              {/* Configure Tab button */}
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

              {/* AI Insights Tab button */}
              <button
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

              {/* Account Tab button */}
              <button
                onClick={() => setActiveTab('account')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1 flex-1 rounded-xl transition-all ${
                  activeTab === 'account' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 font-black scale-105 shadow-sm border border-indigo-100/30' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
                }`}
              >
                <Sliders className="w-4.5 h-4.5" />
                <span className="text-[8px] uppercase tracking-wider font-extrabold">Config</span>
              </button>

              {/* History Tab button */}
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
                className="absolute inset-0 bg-black z-30"
              />

              {/* Drawer Sheet */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                className="absolute top-0 bottom-0 right-0 w-[82%] bg-slate-900 text-white z-40 shadow-2xl flex flex-col overflow-hidden text-left"
              >
                {/* Header */}
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
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
                className="absolute inset-0 bg-black z-40"
              />

              {/* Bottom Sheet Modal */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="absolute bottom-0 left-0 right-0 max-h-[85%] bg-white dark:bg-slate-950 rounded-t-[30px] shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-50 flex flex-col overflow-hidden text-left"
              >
                {/* Drag Notch handle */}
                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-800 rounded-full mx-auto mt-3 shrink-0" />
                
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-900 shrink-0">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Log Transaction Bill
                  </h3>
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
                      Log current billing transaction for <strong>"{recordingTransactionPayment.name}"</strong> ({recordingTransactionPayment.billingCycle || 'monthly'}).
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
                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSyncing}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
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

        {user && (
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

        {user && (
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

        {/* Consolidated Agent + Family Chat floating capsule */}
        {user && (
          <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-40 flex items-center gap-1.5 p-1 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-900/80 rounded-full shadow-lg">
            <button
              onClick={toggleAgent}
              className={`p-2.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center relative ${
                isAgentOpen
                  ? 'bg-gradient-to-tr from-[#5856d6] via-[#007aff] to-[#34c759] text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Haven AI Agent"
            >
              <Sparkles className="w-4 h-4" />
              {!isAgentOpen && !isFamilyChatOpen && (
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[#007aff] animate-pulse" />
              )}
            </button>

            <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />

            <button
              onClick={toggleFamilyChat}
              className={`p-2.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center relative ${
                isFamilyChatOpen
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Family Chat"
            >
              <MessageSquare className="w-4 h-4" />
              {familyMembers.length > 1 && (
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
          </div>
        )}

        {user && (
          <ProfileScopeModal
            isOpen={isProfileScopeModalOpen}
            onClose={() => setIsProfileScopeModalOpen(false)}
            user={user}
            userProfile={userProfile}
            familyMembers={familyMembers}
            allPayments={allPayments}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onLogOut={logOut}
            summaryCurrency={summaryCurrency}
          />
        )}

      </div>
    </IPhoneFrame>
  );
}
