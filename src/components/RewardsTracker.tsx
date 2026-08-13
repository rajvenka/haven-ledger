import React, { useState, useMemo } from 'react';
import { 
  Award, 
  LayoutList,
  LayoutGrid,
  Calendar, 
  Plus, 
  Trash2, 
  Edit2, 
  Copy,
  Search, 
  Filter, 
  Sparkles, 
  Clock, 
  Gift, 
  Building, 
  Check, 
  Flame, 
  Heart, 
  AlertCircle, 
  ChevronRight, 
  X,
  TrendingUp,
  HelpCircle,
  User,
  DollarSign,
  PieChart,
  Coins,
  ShieldCheck
} from 'lucide-react';
import { RewardPerk, GiftCard, giftCardStatus } from '../types';

interface RewardsTrackerProps {
  rewardsPerks: RewardPerk[];
  onAddReward: (perk: Omit<RewardPerk, 'id' | 'userId' | 'familyGroupId' | 'workspaceMode'>) => Promise<void>;
  onUpdateReward: (id: string, updates: Partial<Omit<RewardPerk, 'id' | 'userId'>>) => Promise<void>;
  onDeleteReward: (id: string) => Promise<void>;
  giftCards: GiftCard[];
  onAddGiftCard: (card: Omit<GiftCard, 'id' | 'userId' | 'workspaceId'>) => Promise<void>;
  onUpdateGiftCard: (id: string, updates: Partial<Omit<GiftCard, 'id' | 'userId' | 'workspaceId'>>) => Promise<void>;
  onRedeemGiftCard: (id: string, amountUsed: number) => Promise<void>;
  onDeleteGiftCard: (id: string) => Promise<void>;
  isReadOnly?: boolean;
}

// Standard fallback point value per point in cents if state is empty
const DEFAULT_POINTS_CONVERSION_RATES: Record<string, number> = {
  Qantas: 1.2, // 1.2 cents per point
  Velocity: 1.1, // 1.1 cents per point
  Flybuys: 0.5, // 0.5 cents per point
  Other: 1.0,
  None: 0
};

export default function RewardsTracker({
  rewardsPerks,
  onAddReward,
  onUpdateReward,
  onDeleteReward,
  giftCards,
  onAddGiftCard,
  onUpdateGiftCard,
  onRedeemGiftCard,
  onDeleteGiftCard,
  isReadOnly = false
}: RewardsTrackerProps) {
  // Main Navigation Tabs inside Tracker
  const [trackerTab, setTrackerTab] = useState<'trackers' | 'analytics' | 'calculator' | 'gift_cards'>('trackers');

  // ---- Gift Card Tracker state ----
  const [showAddGiftCard, setShowAddGiftCard] = useState(false);
  const [editingGiftCardId, setEditingGiftCardId] = useState<string | null>(null);
  const [giftCardFilter, setGiftCardFilter] = useState<'active' | 'used' | 'expired' | 'all'>('active');
  const [giftCardForm, setGiftCardForm] = useState({
    brand: '', initialValue: '', currency: 'AUD', purchaseDate: '', expiryDate: '', cardLast4: '', notes: '',
  });
  // Tracks which card has its inline "use $__" input open, and what's typed into it - keyed
  // by card id so multiple tiles can't interfere with each other.
  const [redeemInputFor, setRedeemInputFor] = useState<string | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const GIFT_CARD_PALETTE = [
    'from-violet-500 to-purple-600', 'from-blue-500 to-indigo-600', 'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-cyan-500 to-blue-600',
    'from-fuchsia-500 to-purple-600', 'from-lime-500 to-emerald-600',
  ];
  function giftCardGradient(brand: string) {
    let hash = 0;
    for (let i = 0; i < brand.length; i++) hash = brand.charCodeAt(i) + ((hash << 5) - hash);
    return GIFT_CARD_PALETTE[Math.abs(hash) % GIFT_CARD_PALETTE.length];
  }

  const [viewStyle, setViewStyle] = useState<'card' | 'compact'>(() => {
    return (localStorage.getItem('rewards_view_style') as 'card' | 'compact') || 'card';
  });
  const setViewStyleAndSave = (style: 'card' | 'compact') => {
    setViewStyle(style);
    localStorage.setItem('rewards_view_style', style);
  };
  const [aiInsights, setAiInsights] = useState<{ summary: string; tips: string[]; watchouts: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchAiAdvisor = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch('/api/rewards-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardsPerks }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to reach advisor.');
      }
      const data = await response.json();
      setAiInsights(data);
    } catch (err: any) {
      setAiError(err.message || 'Something went wrong.');
    } finally {
      setAiLoading(false);
    }
  };

  // Customizable point program conversion rates in cents per point (CPP)
  const [pointRates, setPointRates] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('rewards_point_rates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { ...DEFAULT_POINTS_CONVERSION_RATES };
  });

  // Toggle state to show or hide instruction boxes
  const [showInstructions, setShowInstructions] = useState<boolean>(() => {
    const saved = localStorage.getItem('rewards_show_instructions');
    return saved === 'true';
  });

  const toggleInstructions = () => {
    const newVal = !showInstructions;
    setShowInstructions(newVal);
    localStorage.setItem('rewards_show_instructions', String(newVal));
  };

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [ownerFilter, setOwnerFilter] = useState<string>('All');

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerk, setEditingPerk] = useState<RewardPerk | null>(null);

  // Form Fields
  const [providerName, setProviderName] = useState('');
  const [category, setCategory] = useState<RewardPerk['category']>('Credit Card');
  const [applicationDate, setApplicationDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [exclusionPeriodMonths, setExclusionPeriodMonths] = useState<number>(12);
  const [bonusValue, setBonusValue] = useState('');
  const [notes, setNotes] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [annualFee, setAnnualFee] = useState<number>(0);
  const [pointsEarned, setPointsEarned] = useState<number>(0);
  const [pointsProgram, setPointsProgram] = useState<RewardPerk['pointsProgram']>('None');
  const [cashValue, setCashValue] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Sandbox Quick conversion helper states
  const [calcProgram, setCalcProgram] = useState<'Qantas' | 'Velocity' | 'Flybuys' | 'Other'>('Qantas');
  const [calcPoints, setCalcPoints] = useState<number>(100000);
  const [calcCustomRate, setCalcCustomRate] = useState<number>(1.0); // cents per point

  // Quick Close Modal
  const [closingPerkId, setClosingPerkId] = useState<string | null>(null);
  const [quickCloseDate, setQuickCloseDate] = useState(new Date().toISOString().split('T')[0]);

  // Reset form
  const resetForm = () => {
    setProviderName('');
    setCategory('Credit Card');
    setApplicationDate(new Date().toISOString().split('T')[0]);
    setClosingDate('');
    setExclusionPeriodMonths(12);
    setBonusValue('');
    setNotes('');
    setApplicantName('');
    setAnnualFee(0);
    setPointsEarned(0);
    setPointsProgram('None');
    setCashValue(0);
    setEditingPerk(null);
    setErrorMsg('');
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (perk: RewardPerk) => {
    setEditingPerk(perk);
    setProviderName(perk.providerName);
    setCategory(perk.category);
    setApplicationDate(perk.applicationDate);
    setClosingDate(perk.closingDate || '');
    setExclusionPeriodMonths(perk.exclusionPeriodMonths);
    setBonusValue(perk.bonusValue);
    setNotes(perk.notes || '');
    setApplicantName(perk.applicantName || '');
    setAnnualFee(perk.annualFee || 0);
    setPointsEarned(perk.pointsEarned || 0);
    setPointsProgram(perk.pointsProgram || 'None');
    setCashValue(perk.cashValue || 0);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleCloneGiftCard = (card: GiftCard) => {
    setEditingGiftCardId(null);
    setShowAddGiftCard(true);
    setGiftCardError(null);
    setGiftCardForm({
      brand: card.brand || '',
      initialValue: String(card.initialValue ?? card.remainingBalance ?? ''),
      currency: card.currency || 'AUD',
      purchaseDate: new Date().toISOString().slice(0, 10),
      expiryDate: card.expiryDate || '',
      cardLast4: '',
      notes: card.notes || '',
    });
  };

  // Clone: same form, pre-filled, but treated as a brand new entry (no editingPerk set)
  const handleClone = (perk: RewardPerk) => {
    setEditingPerk(null);
    setProviderName(`${perk.providerName} (Copy)`);
    setCategory(perk.category);
    setApplicationDate(new Date().toISOString().slice(0, 10));
    setClosingDate('');
    setExclusionPeriodMonths(perk.exclusionPeriodMonths);
    setBonusValue(perk.bonusValue);
    setNotes(perk.notes || '');
    setApplicantName(perk.applicantName || '');
    setAnnualFee(perk.annualFee || 0);
    setPointsEarned(perk.pointsEarned || 0);
    setPointsProgram(perk.pointsProgram || 'None');
    setCashValue(perk.cashValue || 0);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  // Handle Point input changes inside form to dynamically compute cash estimate and description
  const handlePointsChange = (points: number, program: RewardPerk['pointsProgram']) => {
    setPointsEarned(points);
    setPointsProgram(program);
    
    if (program && program !== 'None') {
      const cpp = pointRates[program] || 1.0;
      const estimatedCash = Math.round(points * (cpp / 100));
      setCashValue(estimatedCash);
      
      const formattedPoints = points.toLocaleString();
      setBonusValue(`${formattedPoints} ${program} Points (~$${estimatedCash})`);
    } else {
      setCashValue(0);
    }
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerName.trim()) {
      setErrorMsg('Provider name is required.');
      return;
    }
    if (!applicationDate) {
      setErrorMsg('Application date is required.');
      return;
    }
    if (!applicantName.trim()) {
      setErrorMsg('Applicant name / owner is required.');
      return;
    }
    if (!bonusValue.trim()) {
      setErrorMsg('Bonus description is required.');
      return;
    }

    const payload = {
      providerName: providerName.trim(),
      category,
      applicationDate,
      closingDate: closingDate || undefined,
      exclusionPeriodMonths,
      bonusValue: bonusValue.trim(),
      notes: notes.trim() || undefined,
      applicantName: applicantName.trim(),
      annualFee: Number(annualFee) || 0,
      pointsEarned: Number(pointsEarned) || 0,
      pointsProgram,
      cashValue: Number(cashValue) || 0
    };

    try {
      if (editingPerk) {
        await onUpdateReward(editingPerk.id, payload);
      } else {
        await onAddReward(payload);
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving.');
    }
  };

  // Quick Close Submit
  const handleQuickCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingPerkId) return;
    try {
      await onUpdateReward(closingPerkId, {
        closingDate: quickCloseDate
      });
      setClosingPerkId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to close perk.');
    }
  };

  // Helper to calculate status & details
  const getPerkStatusDetails = (perk: RewardPerk) => {
    const today = new Date();
    today.setHours(0,0,0,0);

    if (!perk.closingDate) {
      return {
        status: 'active' as const,
        label: 'Active Account',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/50',
        remainingText: 'Currently active',
        progress: 100,
        eligibilityDateStr: null,
        daysLeft: 0,
        isEligibleNow: false
      };
    }

    const closingDateObj = new Date(perk.closingDate);
    closingDateObj.setHours(0,0,0,0);

    const eligibilityDateObj = new Date(closingDateObj);
    eligibilityDateObj.setMonth(eligibilityDateObj.getMonth() + perk.exclusionPeriodMonths);

    const totalDurationMs = eligibilityDateObj.getTime() - closingDateObj.getTime();
    const elapsedDurationMs = today.getTime() - closingDateObj.getTime();

    const isCooling = eligibilityDateObj.getTime() > today.getTime();
    const eligibilityDateStr = eligibilityDateObj.toISOString().split('T')[0];

    if (!isCooling) {
      return {
        status: 'eligible' as const,
        label: 'Eligible to Reapply',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
        remainingText: `Cooling ended on ${eligibilityDateStr}`,
        progress: 100,
        eligibilityDateStr,
        daysLeft: 0,
        isEligibleNow: true
      };
    }

    // Still in cooling period
    const msLeft = eligibilityDateObj.getTime() - today.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    
    // Calculate months and remaining days more elegantly
    const monthsLeft = Math.floor(daysLeft / 30);
    const oddDaysLeft = daysLeft % 30;

    let countdownText = '';
    if (monthsLeft > 0) {
      countdownText = `${monthsLeft}m ${oddDaysLeft}d remaining`;
    } else {
      countdownText = `${daysLeft} days remaining`;
    }

    // Compute progress percentage
    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedDurationMs / totalDurationMs) * 100)));

    return {
      status: 'cooling' as const,
      label: 'Exclusion Countdown',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50',
      remainingText: countdownText,
      progress: progressPercent,
      eligibilityDateStr,
      daysLeft,
      isEligibleNow: false
    };
  };

  // Get unique list of applicants/owners for filtering
  const uniqueOwners = useMemo(() => {
    const list = new Set<string>();
    rewardsPerks.forEach(p => {
      if (p.applicantName) list.add(p.applicantName.trim());
    });
    return Array.from(list);
  }, [rewardsPerks]);

  // Compute stats & analytical summaries
  const analysis = useMemo(() => {
    let activeCount = 0;
    let coolingCount = 0;
    let eligibleCount = 0;
    let totalRewardsEarned = rewardsPerks.length;

    let totalFeesPaid = 0;
    let totalGrossValue = 0;

    const programPoints: Record<string, number> = {
      Qantas: 0,
      Velocity: 0,
      Flybuys: 0,
      Other: 0
    };

    const applicantStats: Record<string, { count: number; value: number; fees: number }> = {};
    const categoryStats: Record<string, { count: number; value: number; fees: number }> = {};

    rewardsPerks.forEach(p => {
      const details = getPerkStatusDetails(p);
      if (details.status === 'active') activeCount++;
      else if (details.status === 'cooling') coolingCount++;
      else if (details.status === 'eligible') eligibleCount++;

      const pValue = Number(p.cashValue) || 0;
      const pFee = Number(p.annualFee) || 0;

      totalFeesPaid += pFee;
      totalGrossValue += pValue;

      // Program accumulation
      if (p.pointsProgram && p.pointsProgram !== 'None') {
        programPoints[p.pointsProgram] = (programPoints[p.pointsProgram] || 0) + (p.pointsEarned || 0);
      }

      // Applicant metrics
      const owner = p.applicantName ? p.applicantName.trim() : 'Unknown';
      if (!applicantStats[owner]) {
        applicantStats[owner] = { count: 0, value: 0, fees: 0 };
      }
      applicantStats[owner].count += 1;
      applicantStats[owner].value += pValue;
      applicantStats[owner].fees += pFee;

      // Category metrics
      const cat = p.category || 'Other';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { count: 0, value: 0, fees: 0 };
      }
      categoryStats[cat].count += 1;
      categoryStats[cat].value += pValue;
      categoryStats[cat].fees += pFee;
    });

    const netProfit = totalGrossValue - totalFeesPaid;

    return {
      activeCount,
      coolingCount,
      eligibleCount,
      totalRewardsEarned,
      totalFeesPaid,
      totalGrossValue,
      netProfit,
      programPoints,
      applicantStats,
      categoryStats
    };
  }, [rewardsPerks]);

  // Filter & Search list
  const filteredPerks = useMemo(() => {
    return rewardsPerks.filter(p => {
      const details = getPerkStatusDetails(p);
      
      const matchesSearch = p.providerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.bonusValue.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
      const matchesOwner = ownerFilter === 'All' || p.applicantName?.trim() === ownerFilter;
      
      let matchesStatus = true;
      if (statusFilter !== 'All') {
        matchesStatus = details.status === statusFilter.toLowerCase();
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesOwner;
    });
  }, [rewardsPerks, searchTerm, categoryFilter, statusFilter, ownerFilter]);

  // Category Icon helper
  const getCategoryIcon = (cat: RewardPerk['category']) => {
    switch (cat) {
      case 'Credit Card':
        return <Award className="w-4.5 h-4.5 text-indigo-500" />;
      case 'Refinance':
        return <Building className="w-4.5 h-4.5 text-emerald-500" />;
      case 'Electricity':
        return <Flame className="w-4.5 h-4.5 text-amber-500" />;
      case 'Gas':
        return <Flame className="w-4.5 h-4.5 text-orange-500" />;
      case 'Health':
        return <Heart className="w-4.5 h-4.5 text-rose-500" />;
      default:
        return <Sparkles className="w-4.5 h-4.5 text-purple-500" />;
    }
  };

  // Quick sandbox points value calculation
  const computedSandboxValue = useMemo(() => {
    const cpp = calcProgram === 'Other' 
      ? calcCustomRate 
      : pointRates[calcProgram] || 1.0;
    return Math.round(calcPoints * (cpp / 100));
  }, [calcProgram, calcPoints, calcCustomRate, pointRates]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-6 text-left bg-slate-50 dark:bg-slate-900">
      {/* Title Header with action button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Gift className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Membership Hub
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track custom rewards, applicant names, annual fees, and point-to-cash conversions dynamically. Use the calendar for card churning cooling periods!
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!isReadOnly && (
            <button
              onClick={handleOpenAdd}
              className="apple-btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs"
            >
              <Plus className="w-4 h-4" /> Log New Reward
            </button>
          )}
          <button
            onClick={toggleInstructions}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-650 dark:text-slate-400 cursor-pointer"
          >
            <HelpCircle className={`w-4 h-4 ${showInstructions ? 'text-indigo-500' : 'text-slate-400'}`} />
            <span>{showInstructions ? 'Hide Instructions' : 'Show Instructions'}</span>
          </button>
        </div>
      </div>

      {/* Tracker Menu Tabs */}
      <div className="flex border-b border-slate-150 dark:border-slate-800 gap-1 pb-px">
        <button
          onClick={() => setTrackerTab('trackers')}
          className={`px-4.5 py-3 text-xs font-bold transition-all relative ${
            trackerTab === 'trackers'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          Trackers & Exclusion Dates
        </button>
        <button
          onClick={() => setTrackerTab('analytics')}
          className={`px-4.5 py-3 text-xs font-bold transition-all relative ${
            trackerTab === 'analytics'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          Analysis & Net Value model
        </button>
        <button
          onClick={() => setTrackerTab('calculator')}
          className={`px-4.5 py-3 text-xs font-bold transition-all relative ${
            trackerTab === 'calculator'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          Points to Cash Calculator
        </button>
        <button
          onClick={() => setTrackerTab('gift_cards')}
          className={`px-4.5 py-3 text-xs font-bold transition-all relative ${
            trackerTab === 'gift_cards'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          Gift Cards
        </button>
      </div>

      {/* TAB 1: TRACKERS & EXCLUSION DATES */}
      {trackerTab === 'trackers' && (
        <div className="space-y-6">
          {/* Info Notice about Churning */}
          {showInstructions && (
            <div className="bg-indigo-50/40 dark:bg-slate-900/40 border border-indigo-100/50 dark:border-slate-800/50 rounded-2xl p-4.5 flex gap-3 text-left animate-fadeIn">
              <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Exclusion & Cooling-off Multi-Owner Tracker</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Add applicant names (e.g. self, spouse, business team) to isolate application milestones. Most sign-up rewards restrict previous cardholders for <strong>12 or 24 months from their closing date</strong>. Track closed status below to trigger the cooling countdown!
                </p>
              </div>
            </div>
          )}

          {/* Stats Board */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="apple-card p-4 flex flex-col justify-between text-left">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Gross Benefits</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 block">${analysis.totalGrossValue.toLocaleString()}</span>
              <span className="text-[9px] text-slate-400 mt-1 block">Accumulated reward values</span>
            </div>

            <div className="apple-card p-4 flex flex-col justify-between text-left">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Annual/Switch Fees</span>
              <span className="text-2xl font-black text-rose-500 mt-2 block">${analysis.totalFeesPaid.toLocaleString()}</span>
              <span className="text-[9px] text-slate-400 mt-1 block">Opex & subscription costs</span>
            </div>

            <div className="apple-card p-4 flex flex-col justify-between text-left">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Net Value Earned</span>
              <span className={`text-2xl font-black mt-2 block ${analysis.netProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
                ${analysis.netProfit.toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-400 mt-1 block">Total benefit profit model</span>
            </div>

            <div className="apple-card p-4 flex flex-col justify-between text-left border-emerald-100/50 dark:border-emerald-950/20 bg-emerald-50/5 dark:bg-emerald-950/5">
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Exclusions Ended</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 block">{analysis.eligibleCount}</span>
              <span className="text-[9px] text-slate-450 mt-1 block">Eligible to re-apply now!</span>
            </div>
          </div>

          {/* Search and Filters Block */}
          <div className="apple-card p-4.5 space-y-3.5">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by provider, points, applicant name, notes..."
                  className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-medium text-slate-800 dark:text-white placeholder:text-slate-450 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>

              {/* Applicant Name Filter */}
              {uniqueOwners.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider">Applicant:</span>
                  <select
                    value={ownerFilter}
                    onChange={(e) => setOwnerFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 outline-none"
                  >
                    <option value="All">All Applicants</option>
                    {uniqueOwners.map(owner => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-t border-slate-100 dark:border-slate-850 pt-3">
              {/* Category Filter */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Category:</span>
                {['All', 'Credit Card', 'Refinance', 'Electricity', 'Gas', 'Health', 'Other'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                      categoryFilter === cat 
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-950 text-slate-550 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 sm:ml-auto">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status:</span>
                {['All', 'Active', 'Cooling', 'Eligible'].map(stat => (
                  <button
                    key={stat}
                    onClick={() => setStatusFilter(stat)}
                    className={`px-2.5 py-1 rounded-full text-[9px] font-bold border transition-all ${
                      statusFilter === stat 
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-transparent'
                        : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    {stat === 'Cooling' ? 'Exclusion Countdown' : stat}
                  </button>
                ))}
                <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg ml-1.5">
                  <button
                    onClick={() => setViewStyleAndSave('card')}
                    title="Card view"
                    className={`p-1.5 rounded-md transition-all cursor-pointer ${viewStyle === 'card' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewStyleAndSave('compact')}
                    title="Compact list view"
                    className={`p-1.5 rounded-md transition-all cursor-pointer ${viewStyle === 'compact' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Grid of Trackers */}
          {filteredPerks.length === 0 ? (
            <div className="apple-card p-12 text-center text-slate-400 dark:text-slate-500 font-medium">
              <Award className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-xs font-bold">No active reward signups match your filter</p>
              <p className="text-[11px] mt-1">Try resetting the filters or register a card reward event above.</p>
            </div>
          ) : viewStyle === 'compact' ? (
            <div className="apple-card divide-y divide-slate-100 dark:divide-slate-900 overflow-hidden">
              {filteredPerks.map(perk => {
                const details = getPerkStatusDetails(perk);
                return (
                  <div key={perk.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="shrink-0 text-slate-400">{getCategoryIcon(perk.category)}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{perk.providerName}</h4>
                          <span className={`px-1.5 py-0.2 border text-[8px] font-black uppercase tracking-wider rounded-full shrink-0 ${details.badgeClass}`}>
                            {details.label}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 truncate">
                          {perk.applicantName || 'Unassigned'} · {perk.bonusValue}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-900">
                      <div className="text-right">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 block">
                          +${Number(perk.cashValue || 0).toLocaleString()}
                        </span>
                        {Number(perk.annualFee || 0) > 0 && (
                          <span className="text-[9px] font-bold text-rose-500 block">-${Number(perk.annualFee).toLocaleString()} fee</span>
                        )}
                      </div>

                      {perk.closingDate && details.remainingText && (
                        <span className={`text-[9px] font-bold whitespace-nowrap ${details.status === 'eligible' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {details.remainingText}
                        </span>
                      )}

                      {!isReadOnly && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => handleOpenEdit(perk)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 rounded-md transition-all" title="Edit">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleClone(perk)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 rounded-md transition-all" title="Clone">
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { if (confirm('Are you sure you want to delete this tracked reward?')) onDeleteReward(perk.id); }}
                            className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 rounded-md transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPerks.map(perk => {
                const details = getPerkStatusDetails(perk);
                return (
                  <div 
                    key={perk.id} 
                    className="apple-card p-5 flex flex-col justify-between border-slate-150/80 dark:border-slate-850/60 relative group"
                  >
                    {/* Top applicant & category info */}
                    <div className="space-y-3 text-left">
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300">
                          {getCategoryIcon(perk.category)}
                          {perk.category}
                        </span>
                        <span className={`px-2.5 py-0.5 border text-[9px] font-bold uppercase tracking-wider rounded-full ${details.badgeClass}`}>
                          {details.label}
                        </span>
                      </div>

                      {/* Header block */}
                      <div>
                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                          <User className="w-2.5 h-2.5" /> APPLICANT: {perk.applicantName || 'Unassigned'}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-snug mt-0.5">
                          {perk.providerName}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 mt-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          {perk.bonusValue}
                        </div>
                      </div>

                      {/* Financial info block */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50/50 dark:bg-slate-900/30 p-2 rounded-xl border border-slate-100/60 dark:border-slate-850/40 text-[10px]">
                        <div>
                          <span className="text-slate-450 dark:text-slate-500 block text-[8px] font-bold uppercase">Estimated Benefit</span>
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">${Number(perk.cashValue || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-450 dark:text-slate-500 block text-[8px] font-bold uppercase">Fees Paid</span>
                          <span className="font-extrabold text-rose-500">${Number(perk.annualFee || 0).toLocaleString()}</span>
                        </div>
                      </div>

                      {perk.notes && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-medium bg-slate-50/30 dark:bg-slate-950/20 p-2 rounded-lg border border-slate-100/40 dark:border-slate-900">
                          {perk.notes}
                        </p>
                      )}
                    </div>

                    {/* Timeline & countdown progress bar */}
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-850 space-y-3.5 text-left">
                      <div className="grid grid-cols-2 gap-3 text-[10px]">
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block uppercase font-bold text-[8px] tracking-wider">Applied Date</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-400" /> {perk.applicationDate}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block uppercase font-bold text-[8px] tracking-wider">Closed Date</span>
                          {perk.closingDate ? (
                            <span className="font-semibold text-slate-850 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                              <Check className="w-3 h-3 text-emerald-500" /> {perk.closingDate}
                            </span>
                          ) : (
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/30 px-1.5 py-0.2 rounded text-[9px] inline-block mt-0.5">
                              Still Open
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cooldown Period visual */}
                      {perk.closingDate && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[9px] font-bold">
                            <span className="text-slate-400 uppercase tracking-wider">Cooldown ({perk.exclusionPeriodMonths}m)</span>
                            <span className={details.status === 'eligible' ? 'text-emerald-600 font-black' : 'text-amber-600 font-bold'}>
                              {details.remainingText}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                details.status === 'eligible' ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${details.progress}%` }}
                            />
                          </div>
                          {details.eligibilityDateStr && (
                            <div className="text-[8px] text-slate-450 font-bold uppercase tracking-wider flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" /> Re-apply Target: <span className="text-slate-700 dark:text-slate-300 ml-0.5">{details.eligibilityDateStr}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      {!isReadOnly && (
                        <div className="flex items-center justify-between pt-1 gap-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleOpenEdit(perk)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleClone(perk)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 rounded-lg transition-all"
                              title="Clone"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this tracked reward?')) {
                                  onDeleteReward(perk.id);
                                }
                              }}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 rounded-lg transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {!perk.closingDate && (
                            <button
                              onClick={() => {
                                setClosingPerkId(perk.id);
                                setQuickCloseDate(new Date().toISOString().split('T')[0]);
                              }}
                              className="text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-rose-100/30"
                            >
                              Mark Account Closed
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ANALYTICS & NET VALUE MODEL */}
      {trackerTab === 'analytics' && (
        <div className="space-y-6">
          {showInstructions && (
            <div className="bg-indigo-50/40 dark:bg-slate-900/40 border border-indigo-100/50 dark:border-slate-800/50 rounded-2xl p-4.5 flex gap-3 text-left animate-fadeIn">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Analyzing Your Net Financial Yields</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Evaluate the net profit margin of your credit cards and rewards. The <strong>Net Perk Profit</strong> subtracts annual fees from total estimated cash values. Use the loyalty program chart to see exactly how your accumulated point balances translate to cash.
                </p>
              </div>
            </div>
          )}

          {/* AI Perk Advisor */}
          <div className="apple-card p-6 text-left">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500" /> AI Perk Advisor
              </h3>
              <button
                onClick={fetchAiAdvisor}
                disabled={aiLoading}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                {aiLoading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" /> {aiInsights ? 'Re-analyze' : 'Analyze My Perks'}
                  </>
                )}
              </button>
            </div>

            {aiError && <p className="text-[11px] text-red-500 font-semibold mt-3">{aiError}</p>}

            {!aiInsights && !aiLoading && !aiError && (
              <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                Get a personalized read on your card portfolio — what's earning its keep, what to cancel before the annual fee hits, and when you're eligible to reapply for a bonus.
              </p>
            )}

            {aiInsights && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{aiInsights.summary}</p>

                {aiInsights.tips.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Tips</span>
                    {aiInsights.tips.map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                )}

                {aiInsights.watchouts.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Watch Out</span>
                    {aiInsights.watchouts.map((w, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main Net Profit Breakdown model */}
          <div className="apple-card p-6 text-left">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-500" /> Net Reward Value Model
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="space-y-1 md:border-r border-slate-100 dark:border-slate-850 md:pr-6">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Gross Converted Benefits</span>
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  ${analysis.totalGrossValue.toLocaleString()}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Sum of cashbacks & conversion of loyalty reward points to dollar values.
                </p>
              </div>

              <div className="space-y-1 md:border-r border-slate-100 dark:border-slate-850 md:pr-6">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Account/Switch Fees</span>
                <div className="text-3xl font-black text-rose-500 mt-1">
                  -${analysis.totalFeesPaid.toLocaleString()}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  All annual card membership fees, setup commissions or utility termination charges.
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-extrabold">Net Perk Profit</span>
                <div className={`text-3xl font-black mt-1 ${analysis.netProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
                  ${analysis.netProfit.toLocaleString()}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${analysis.netProfit >= 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="text-[10px] text-slate-500 font-medium">
                    {analysis.netProfit >= 0 ? 'Model active with positive yields' : 'Action required to lower annual fees'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
            {/* Applicant Breakdown */}
            <div className="apple-card p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-500" /> Applicant Net Performance
              </h3>
              
              {Object.keys(analysis.applicantStats).length === 0 ? (
                <p className="text-xs text-slate-450 py-6 text-center">No applicants logged yet. Add names on new entries.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(analysis.applicantStats).map(([owner, statVal]) => {
                    const stat = statVal as { count: number; value: number; fees: number };
                    const applicantNet = stat.value - stat.fees;
                    return (
                      <div key={owner} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-150/50 dark:border-slate-850/60 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200">{owner}</span>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-wider">{stat.count} Signup Event(s)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px] pt-1 border-t border-slate-150/30 dark:border-slate-850/30">
                          <div>
                            <span className="text-slate-450 block text-[9px] font-bold uppercase">Value</span>
                            <span className="font-extrabold text-emerald-600">${stat.value.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-450 block text-[9px] font-bold uppercase">Fees</span>
                            <span className="font-extrabold text-rose-500">${stat.fees.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-450 block text-[9px] font-bold uppercase">Net Profit</span>
                            <span className={`font-black ${applicantNet >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
                              ${applicantNet.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Category Performance */}
            <div className="apple-card p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-indigo-500" /> Category Breakdown
              </h3>

              {Object.keys(analysis.categoryStats).length === 0 ? (
                <p className="text-xs text-slate-450 py-6 text-center">No category rewards tracked yet.</p>
              ) : (
                <div className="space-y-3.5">
                  {Object.entries(analysis.categoryStats).map(([cat, statVal]) => {
                    const stat = statVal as { count: number; value: number; fees: number };
                    const catNet = stat.value - stat.fees;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            {getCategoryIcon(cat as RewardPerk['category'])} {cat}
                          </span>
                          <span className={`font-black ${catNet >= 0 ? 'text-indigo-600' : 'text-rose-500'}`}>
                            Net Profit: ${catNet.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-850 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-full rounded-full"
                            style={{ 
                              width: `${Math.max(10, Math.min(100, analysis.totalGrossValue > 0 ? (stat.value / analysis.totalGrossValue) * 100 : 0))}%` 
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[8px] text-slate-450 uppercase font-black">
                          <span>{stat.count} Entries</span>
                          <span>Gross: ${stat.value.toLocaleString()} | Fees: ${stat.fees.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Points Accrual Dashboard */}
          <div className="apple-card p-5 text-left space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Coins className="w-4.5 h-4.5 text-indigo-500" /> Loyalty Program Accumulation Model
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(analysis.programPoints).map(([program, totalPointsVal]) => {
                const totalPoints = totalPointsVal as number;
                const cpp = pointRates[program] || 1.0;
                const estValue = Math.round(totalPoints * (cpp / 100));
                return (
                  <div key={program} className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-150/40 dark:border-slate-850/40 rounded-xl space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{program} Program</span>
                    <div className="text-xl font-black text-slate-850 dark:text-white">
                      {totalPoints.toLocaleString()} <span className="text-[10px] font-medium text-slate-400">pts</span>
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold">
                      Est. Cash Value: ${estValue.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chronological cooling timeline */}
          <div className="apple-card p-5 text-left space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Clock className="w-4.5 h-4.5 text-indigo-500" /> Re-apply Exclusion Chronological Timeline
            </h3>

            {rewardsPerks.filter(p => p.closingDate).length === 0 ? (
              <p className="text-xs text-slate-450 text-center py-6">No closed accounts currently triggering exclusion timelines.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-850 text-slate-400 uppercase tracking-wider text-[9px] font-black">
                      <th className="py-2.5">Provider</th>
                      <th className="py-2.5">Applicant Name</th>
                      <th className="py-2.5">Closed Date</th>
                      <th className="py-2.5">Exclusion Ends</th>
                      <th className="py-2.5">Cooling Countdown</th>
                      <th className="py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50 dark:divide-slate-850/40">
                    {rewardsPerks
                      .filter(p => p.closingDate)
                      .map(p => {
                        const details = getPerkStatusDetails(p);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/55 dark:hover:bg-slate-900/30">
                            <td className="py-3 font-bold text-slate-800 dark:text-slate-200">{p.providerName}</td>
                            <td className="py-3 text-slate-650 dark:text-slate-400 font-medium">{p.applicantName}</td>
                            <td className="py-3 text-slate-500 font-mono text-[11px]">{p.closingDate}</td>
                            <td className="py-3 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              {details.eligibilityDateStr}
                            </td>
                            <td className="py-3 text-[11px] font-bold">
                              {details.status === 'eligible' ? (
                                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Ready to re-apply!
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400">{details.remainingText}</span>
                              )}
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 border text-[8px] font-black uppercase tracking-wider rounded-full ${details.badgeClass}`}>
                                {details.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: POINTS TO CASH CALCULATOR */}
      {trackerTab === 'calculator' && (
        <div className="space-y-6">
          {showInstructions && (
            <div className="bg-indigo-50/40 dark:bg-slate-900/40 border border-indigo-100/50 dark:border-slate-800/50 rounded-2xl p-4.5 flex gap-3 text-left animate-fadeIn">
              <Coins className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Interactive Sign-up Point Converter</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Determine the real-world value of a promotion before signing up! Different reward programs have vastly different valuations (typically measured in cents per point, or CPP). Use this slider to run hypothetical point conversions.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start text-left">
            <div className="flex flex-col gap-6">
              {/* Calculator controls */}
              <div className="apple-card p-6 space-y-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Calculator Settings</h3>
                
                {/* Program Selector */}
                <div>
                  <label className="block text-[10px] font-black text-slate-450 dark:text-slate-550 uppercase tracking-widest mb-1.5">
                    Points Program
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Qantas', 'Velocity', 'Flybuys', 'Other'] as const).map(prog => (
                      <button
                        key={prog}
                        onClick={() => setCalcProgram(prog)}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          calcProgram === prog
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-450 hover:bg-slate-50'
                        }`}
                      >
                        {prog}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slider for point values */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-500">Points Count:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">{calcPoints.toLocaleString()} pts</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="300000"
                    step="5000"
                    value={calcPoints}
                    onChange={(e) => setCalcPoints(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                    <span>5,000 pts</span>
                    <span>150,000 pts</span>
                    <span>300,000 pts</span>
                  </div>
                </div>

                {/* Custom rate input if Other selected */}
                {calcProgram === 'Other' && (
                  <div className="space-y-1 animate-fadeIn">
                    <label className="block text-[10px] font-black text-slate-450 uppercase tracking-widest">
                      Custom Cents Per Point (CPP) Value
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="5"
                        value={calcCustomRate}
                        onChange={(e) => setCalcCustomRate(Number(e.target.value) || 1.0)}
                        className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none"
                      />
                      <span className="text-xs font-semibold text-slate-500">cents per point (e.g. 1.2c)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Point Valuation Settings Card */}
              <div className="apple-card p-5 space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-indigo-500" /> Point Valuation Settings (CPP)
                  </h3>
                  <span className="text-[9px] font-black uppercase bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                    Editable Rates
                  </span>
                </div>
                <p className="text-[10px] text-slate-550 dark:text-slate-450 leading-normal">
                  Customize the default cents per point (CPP) value for each program. All active charts, calculations, and logging inputs will update instantly to match your standard valuations.
                </p>

                <div className="space-y-3 pt-1.5">
                  {(['Qantas', 'Velocity', 'Flybuys', 'Other'] as const).map(prog => (
                    <div key={prog} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-850/60 rounded-xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{prog} Points</span>
                        <p className="text-[9px] text-slate-450 uppercase font-black">
                          Current: ${((pointRates[prog] || 1.0) / 100).toFixed(4)} / pt
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.05"
                          min="0.01"
                          max="5.0"
                          value={pointRates[prog] || 0}
                          onChange={(e) => {
                            const val = Math.max(0.01, Number(e.target.value) || 0);
                            const newRates = { ...pointRates, [prog]: val };
                            setPointRates(newRates);
                            localStorage.setItem('rewards_point_rates', JSON.stringify(newRates));
                          }}
                          className="w-16 px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black text-center outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                        />
                        <span className="text-[10px] font-extrabold text-slate-500">c / pt</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculations and value breakdown card */}
            <div className="apple-card p-6 space-y-6 bg-slate-900 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-400 pointer-events-none">
                <Coins className="w-48 h-48" />
              </div>

              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Estimated Real Value</span>
                <span className="text-4xl font-black text-indigo-400 mt-2 block">${computedSandboxValue.toLocaleString()}</span>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                  Based on a standardized model valuation for <strong className="text-white">{calcProgram} Points</strong>.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between font-bold text-slate-400">
                  <span>Standard Program CPP:</span>
                  <span className="text-white">
                    {calcProgram === 'Other' ? `${calcCustomRate}c` : `${(pointRates[calcProgram] || 1.0).toFixed(2)}c`}
                  </span>
                </div>

                <div className="flex justify-between font-bold text-slate-400">
                  <span>Value Comparison Index:</span>
                  <span className="text-indigo-300">
                    {calcProgram === 'Qantas' ? 'Premium (Good for business travel)' :
                     calcProgram === 'Velocity' ? 'High value (Great for domestic flights)' :
                     calcProgram === 'Flybuys' ? 'Cash equivalence (Supermarkets/fuel)' : 'Custom scale'}
                  </span>
                </div>
              </div>

              {/* Form trigger helper button */}
              {!isReadOnly && (
                <button
                  onClick={() => {
                    handleOpenAdd();
                    setPointsProgram(calcProgram);
                    setPointsEarned(calcPoints);
                    setCashValue(computedSandboxValue);
                    const formattedPoints = calcPoints.toLocaleString();
                    setBonusValue(`${formattedPoints} ${calcProgram} Points (~$${computedSandboxValue})`);
                  }}
                  className="w-full bg-white text-slate-950 hover:bg-slate-100 transition-all py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 mt-4"
                >
                  <Plus className="w-4 h-4 text-indigo-600" /> Apply This Value & Log New Entry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GIFT CARDS */}
      {trackerTab === 'gift_cards' && (() => {
        const filtered = giftCards.filter(c => giftCardFilter === 'all' ? true : giftCardStatus(c) === giftCardFilter);
        const activeCards = giftCards.filter(c => giftCardStatus(c) === 'active');
        const totalsByCurrency: Record<string, number> = {};
        activeCards.forEach(c => { totalsByCurrency[c.currency] = (totalsByCurrency[c.currency] || 0) + c.remainingBalance; });
        const expiringSoon = activeCards.filter(c => {
          if (!c.expiryDate) return false;
          const days = (new Date(c.expiryDate).getTime() - Date.now()) / 86400000;
          return days >= 0 && days <= 30;
        });
        const counts = {
          active: giftCards.filter(c => giftCardStatus(c) === 'active').length,
          used: giftCards.filter(c => giftCardStatus(c) === 'used').length,
          expired: giftCards.filter(c => giftCardStatus(c) === 'expired').length,
          all: giftCards.length,
        };
        const editing = editingGiftCardId ? giftCards.find(c => c.id === editingGiftCardId) : null;

        const resetForm = () => setGiftCardForm({ brand: '', initialValue: '', currency: 'AUD', purchaseDate: '', expiryDate: '', cardLast4: '', notes: '' });

        return (
          <div className="space-y-5">
            {/* Summary strip - the "how much free money is still sitting unused" number, up front */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">Unused Balance</p>
                <p className="text-lg font-black mt-1">
                  {Object.keys(totalsByCurrency).length === 0
                    ? '—'
                    : Object.entries(totalsByCurrency).map(([ccy, amt]) => `${ccy} ${amt.toLocaleString(undefined, { maximumFractionDigits: 0 })}`).join(' · ')}
                </p>
                <p className="text-[10px] opacity-80 mt-0.5">{activeCards.length} card{activeCards.length !== 1 ? 's' : ''} unused</p>
              </div>
              <div className={`p-3.5 rounded-2xl ${expiringSoon.length > 0 ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">Expiring Soon</p>
                <p className="text-lg font-black mt-1">{expiringSoon.length}</p>
                <p className="text-[10px] opacity-80 mt-0.5">within 30 days</p>
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => { setShowAddGiftCard(true); setEditingGiftCardId(null); resetForm(); }}
                  className="p-3.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:text-indigo-500 hover:border-indigo-400 transition-all flex flex-col items-center justify-center gap-1"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-[10px] font-bold">Add Gift Card</span>
                </button>
              )}
            </div>

            {/* Filter chips */}
            <div className="flex gap-1.5">
              {(['active', 'used', 'expired', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setGiftCardFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold capitalize transition-all ${
                    giftCardFilter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {f} ({counts[f]})
                </button>
              ))}
            </div>

            {giftCardError && <p className="text-xs text-rose-500 font-semibold">{giftCardError}</p>}

            {/* Card grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Gift className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-semibold">No {giftCardFilter !== 'all' ? giftCardFilter : ''} gift cards yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(card => {
                  const status = giftCardStatus(card);
                  const pct = card.initialValue > 0 ? Math.max(0, Math.min(100, (card.remainingBalance / card.initialValue) * 100)) : 0;
                  const daysToExpiry = card.expiryDate ? Math.ceil((new Date(card.expiryDate).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <div key={card.id} className={`rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 ${status !== 'active' ? 'opacity-60' : ''}`}>
                      <div className={`bg-gradient-to-br ${giftCardGradient(card.brand)} p-3.5 text-white relative`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-black">{card.brand}</p>
                            {card.cardLast4 && <p className="text-[9px] opacity-70 mt-0.5">•••• {card.cardLast4}</p>}
                          </div>
                          {!isReadOnly && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingGiftCardId(card.id);
                                  setShowAddGiftCard(true);
                                  setGiftCardForm({
                                    brand: card.brand, initialValue: String(card.initialValue), currency: card.currency,
                                    purchaseDate: card.purchaseDate || '', expiryDate: card.expiryDate || '', cardLast4: card.cardLast4 || '', notes: card.notes || '',
                                  });
                                }}
                                className="text-white/70 hover:text-white cursor-pointer"
                                title="Edit"
                              ><Edit2 className="w-3.5 h-3.5" /></button>
                              <button
                                onClick={() => handleCloneGiftCard(card)}
                                className="text-white/70 hover:text-white cursor-pointer"
                                title="Clone — same card again"
                              ><Copy className="w-3.5 h-3.5" /></button>
                              <button
                                onClick={async () => { if (confirm(`Delete ${card.brand} gift card?`)) { try { await onDeleteGiftCard(card.id); } catch (err: any) { setGiftCardError(err.message); } } }}
                                className="text-white/70 hover:text-white cursor-pointer"
                                title="Delete"
                              ><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </div>
                        <p className="text-xl font-black mt-3 tabular-nums">
                          {card.currency} {card.remainingBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[9px] opacity-70">of {card.currency} {card.initialValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        <div className="mt-2 h-1.5 bg-white/25 rounded-full overflow-hidden">
                          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="p-2.5 bg-white dark:bg-slate-900 space-y-1.5">
                        {status === 'used' && <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Check className="w-3 h-3" /> Fully used</p>}
                        {status === 'expired' && <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Expired {card.expiryDate}</p>}
                        {status === 'active' && daysToExpiry != null && (
                          <p className={`text-[10px] font-bold flex items-center gap-1 ${daysToExpiry <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                            <Clock className="w-3 h-3" /> Expires in {daysToExpiry}d
                          </p>
                        )}
                        {card.notes && <p className="text-[10px] text-slate-400 truncate">{card.notes}</p>}

                        {status === 'active' && !isReadOnly && (
                          redeemInputFor === card.id ? (
                            <div className="flex items-center gap-1 pt-1">
                              <input
                                type="number"
                                autoFocus
                                placeholder="Amount used"
                                value={redeemAmount}
                                onChange={(e) => setRedeemAmount(e.target.value)}
                                className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] w-0"
                              />
                              <button
                                onClick={async () => {
                                  const amt = parseFloat(redeemAmount);
                                  if (!amt || amt <= 0) return;
                                  try {
                                    await onRedeemGiftCard(card.id, amt);
                                    setRedeemInputFor(null);
                                    setRedeemAmount('');
                                  } catch (err: any) { setGiftCardError(err.message); }
                                }}
                                className="p-1.5 bg-indigo-600 text-white rounded-md cursor-pointer shrink-0"
                              ><Check className="w-3 h-3" /></button>
                              <button onClick={() => { setRedeemInputFor(null); setRedeemAmount(''); }} className="p-1.5 text-slate-400 cursor-pointer shrink-0"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <div className="flex gap-1.5 pt-1">
                              <button
                                onClick={async () => { try { await onRedeemGiftCard(card.id, card.remainingBalance); } catch (err: any) { setGiftCardError(err.message); } }}
                                className="flex-1 px-2 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                Mark Used
                              </button>
                              <button
                                onClick={() => { setRedeemInputFor(card.id); setRedeemAmount(''); }}
                                className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-bold cursor-pointer"
                              >
                                Use partial
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add / Edit Gift Card modal */}
            {showAddGiftCard && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddGiftCard(false)}>
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{editing ? 'Edit Gift Card' : 'Add Gift Card'}</p>
                  <input
                    type="text" placeholder="Brand (e.g. Amazon, Myer)" value={giftCardForm.brand}
                    onChange={(e) => setGiftCardForm(f => ({ ...f, brand: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number" placeholder="Value" value={giftCardForm.initialValue}
                      onChange={(e) => setGiftCardForm(f => ({ ...f, initialValue: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs w-0"
                    />
                    <select
                      value={giftCardForm.currency}
                      onChange={(e) => setGiftCardForm(f => ({ ...f, currency: e.target.value }))}
                      className="px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
                    >
                      {['AUD', 'USD', 'INR', 'EUR', 'GBP', 'SGD'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Purchased</label>
                      <input
                        type="date" value={giftCardForm.purchaseDate}
                        onChange={(e) => setGiftCardForm(f => ({ ...f, purchaseDate: e.target.value }))}
                        className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Expires</label>
                      <input
                        type="date" value={giftCardForm.expiryDate}
                        onChange={(e) => setGiftCardForm(f => ({ ...f, expiryDate: e.target.value }))}
                        className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                  <input
                    type="text" placeholder="Last 4 digits (optional)" maxLength={4} value={giftCardForm.cardLast4}
                    onChange={(e) => setGiftCardForm(f => ({ ...f, cardLast4: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <input
                    type="text" placeholder="Notes (optional)" value={giftCardForm.notes}
                    onChange={(e) => setGiftCardForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShowAddGiftCard(false); setEditingGiftCardId(null); }} className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-xs font-bold cursor-pointer">
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const value = parseFloat(giftCardForm.initialValue);
                        if (!giftCardForm.brand.trim() || !value || value <= 0) { setGiftCardError('Enter a brand and a value greater than 0.'); return; }
                        setGiftCardError(null);
                        try {
                          if (editing) {
                            await onUpdateGiftCard(editing.id, {
                              brand: giftCardForm.brand.trim(), initialValue: value, currency: giftCardForm.currency,
                              purchaseDate: giftCardForm.purchaseDate || undefined, expiryDate: giftCardForm.expiryDate || undefined,
                              cardLast4: giftCardForm.cardLast4 || undefined, notes: giftCardForm.notes || undefined,
                            });
                          } else {
                            await onAddGiftCard({
                              brand: giftCardForm.brand.trim(), initialValue: value, remainingBalance: value, currency: giftCardForm.currency,
                              purchaseDate: giftCardForm.purchaseDate || undefined, expiryDate: giftCardForm.expiryDate || undefined,
                              cardLast4: giftCardForm.cardLast4 || undefined, notes: giftCardForm.notes || undefined,
                            });
                          }
                          setShowAddGiftCard(false);
                          setEditingGiftCardId(null);
                          resetForm();
                        } catch (err: any) {
                          setGiftCardError(err.message || 'Failed to save gift card.');
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      {editing ? 'Save' : 'Add Card'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Form Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative overflow-y-auto max-h-[90vh] text-left">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-black text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-1.5">
              <Gift className="w-5 h-5 text-indigo-500" />
              {editingPerk ? 'Edit Reward & Net Value' : 'Add New Reward / Perk Entry'}
            </h3>

            {errorMsg && (
              <div className="mb-4 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 p-3 rounded-xl text-xs font-bold flex gap-2 items-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Applicant / Card Owner */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                    Applicant / Card Owner *
                  </label>
                  <input
                    type="text"
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="e.g. Raj, Jane, Company Name"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-850 dark:text-white placeholder:text-slate-450 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                    Provider / Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    placeholder="e.g. Amex Explorer, ANZ Refinance, Telstra Energy"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-850 dark:text-white placeholder:text-slate-450 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Category & Annual Fees */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as RewardPerk['category'])}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-850 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    {['Credit Card', 'Refinance', 'Electricity', 'Gas', 'Health', 'Other'].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                    Annual Fee / Switch Costs ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={annualFee}
                    onChange={(e) => setAnnualFee(Number(e.target.value) || 0)}
                    placeholder="Annual membership fees or switch opex"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-850 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* POINTS PROGRAM CONVERSION ENGINE */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-850 space-y-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Sign-up Points Estimator</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-slate-450 uppercase mb-1">Points Program</label>
                    <select
                      value={pointsProgram}
                      onChange={(e) => handlePointsChange(pointsEarned, e.target.value as RewardPerk['pointsProgram'])}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-850 dark:text-white outline-none"
                    >
                      <option value="None">Direct Cashback / None</option>
                      <option value="Qantas">Qantas Points</option>
                      <option value="Velocity">Velocity Points</option>
                      <option value="Flybuys">Flybuys Points</option>
                      <option value="Other">Other Points</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[8px] font-black text-slate-450 uppercase mb-1">Points Earned</label>
                    <input
                      type="number"
                      min="0"
                      disabled={pointsProgram === 'None'}
                      value={pointsEarned}
                      onChange={(e) => handlePointsChange(Number(e.target.value) || 0, pointsProgram)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 disabled:bg-slate-100 dark:disabled:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-850 dark:text-white outline-none"
                      placeholder="e.g. 100,000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10px] font-semibold text-slate-500 pt-1">
                  <div>
                    <label className="block text-[8px] font-black text-slate-450 uppercase mb-1">Estimated Cash Value ($) *</label>
                    <input
                      type="number"
                      required
                      value={cashValue}
                      onChange={(e) => {
                        setCashValue(Number(e.target.value) || 0);
                        if (pointsProgram === 'None') {
                          setBonusValue(`$${e.target.value} Cashback`);
                        }
                      }}
                      placeholder="Estimated cash yield"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black text-emerald-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[8px] font-black text-slate-450 uppercase mb-1">Perk / Bonus Description *</label>
                    <input
                      type="text"
                      required
                      value={bonusValue}
                      onChange={(e) => setBonusValue(e.target.value)}
                      placeholder="e.g. 100,000 Qantas Points"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-800 dark:text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                    Applied Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={applicationDate}
                    onChange={(e) => setApplicationDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-850 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    Closed Date <span className="text-[9px] font-medium lowercase text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-850 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Cooldown Period preset */}
              <div>
                <label className="block text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Exclusion / Cooldown Period (Months)
                </label>
                <div className="space-y-2">
                  <input
                    type="number"
                    min="0"
                    value={exclusionPeriodMonths}
                    onChange={(e) => setExclusionPeriodMonths(parseInt(e.target.value) || 0)}
                    placeholder="Months"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white outline-none"
                  />
                  <div className="flex gap-2">
                    {[12, 24].map(months => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => setExclusionPeriodMonths(months)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                          exclusionPeriodMonths === months
                            ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 border-transparent'
                            : 'bg-white dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {months} Months Preset
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Notes, T&C, or Milestones
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Spend $3,000 in first 3 months to trigger bonus points. Keep open for 6 months."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-850 dark:text-white placeholder:text-slate-450 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="apple-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold"
                >
                  {editingPerk ? 'Save Changes' : 'Create Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Close Account Modal */}
      {closingPerkId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative text-left">
            <button
              onClick={() => setClosingPerkId(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4.5 h-4.5 text-rose-500" />
              Close This Account
            </h3>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mb-4 font-medium">
              Specify the date this account was officially cancelled/closed. This starts the exclusion countdown period so you know exactly when you'll become eligible to apply for this provider again.
            </p>

            <form onSubmit={handleQuickCloseSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest mb-1">
                  Official Closed Date
                </label>
                <input
                  type="date"
                  required
                  value={quickCloseDate}
                  onChange={(e) => setQuickCloseDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-850 dark:text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={() => setClosingPerkId(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all"
                >
                  Confirm Account Closed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
