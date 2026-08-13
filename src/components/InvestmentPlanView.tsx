import React, { useState, useMemo } from 'react';
import { Trash2, Users, Wallet, Edit2, CheckCircle2, X, ClipboardList, Banknote, AlertTriangle, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface WorkspaceMemberLite {
  uid: string;
  displayName?: string;
  email: string;
}

interface InvestmentPlanViewProps {
  workspaceName?: string;
  workspaceMembers: WorkspaceMemberLite[];
  isReadOnly?: boolean;
  currentUserId?: string;
  portfolios?: any[];
  portfolioMode?: 'single' | 'multiple';
  workspaceCurrencyRates?: any[];
  baseCurrency?: string;
  dismissedReminderKey?: string | null;
  onDismissContributionReminder?: (key: string) => Promise<void>;
  portfolioSplits: any[];
  addPortfolioSplit: (memberUserId: string, percent: number, from: string, to?: string) => Promise<void>;
  deletePortfolioSplit: (id: string) => Promise<void>;
  portfolioContributions: any[];
  addPortfolioContribution: (memberUserId: string, amount: number, date: string, notes?: string, contributionType?: 'one_off' | 'recurring' | 'initial', portfolioId?: string, appliesToPeriodStart?: string) => Promise<void>;
  updatePortfolioContribution: (id: string, updates: { amount?: number; contributionDate?: string; notes?: string; contributionType?: 'one_off' | 'recurring' | 'initial' }) => Promise<void>;
  deletePortfolioContribution: (id: string) => Promise<void>;
  portfolioWithdrawals: any[];
  addPortfolioWithdrawal: (memberUserId: string, amount: number, date: string, notes?: string) => Promise<void>;
  deletePortfolioWithdrawal: (id: string) => Promise<void>;
  portfolioCashBalances: any[];
  setPortfolioCashBalance: (location: 'Zerodha' | 'Groww' | 'Bank' | 'Other', amount: number, asOfDate?: string, notes?: string, portfolioId?: string) => Promise<void>;
  deletePortfolioCashBalance: (id: string) => Promise<void>;
  portfolioBookedPlBaselines?: any[];
  setBookedPlBaseline?: (amount: number, date: string, portfolioId?: string) => Promise<void>;
  portfolioProjectedBankBalances?: any[];
  setProjectedBankBalance?: (amount: number, portfolioId?: string) => Promise<void>;
  portfolioRecurringPlans: any[];
  addPortfolioRecurringPlan: (memberUserId: string, amount: number, frequency: 'monthly' | 'quarterly' | 'yearly', startDate: string, dayOfMonth?: number, notes?: string, portfolioId?: string) => Promise<void>;
  updatePortfolioRecurringPlan: (id: string, updates: { active?: boolean; expectedAmount?: number }) => Promise<void>;
  deletePortfolioRecurringPlan: (id: string) => Promise<void>;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const memberName = (m: WorkspaceMemberLite) => m.displayName || m.email.split('@')[0];
const contribTypeLabel = (c: any) => c.contribution_type === 'recurring' ? 'Plan' : c.contribution_type === 'initial' ? 'Initial' : 'One-off';

type PlanTab = 'overview' | 'contributions';

export default function InvestmentPlanView(props: InvestmentPlanViewProps) {
  const {
    workspaceName, workspaceMembers, isReadOnly, currentUserId, dismissedReminderKey, onDismissContributionReminder,
    portfolios: allPortfolios = [], portfolioMode = 'single', workspaceCurrencyRates = [], baseCurrency = 'INR',
    portfolioSplits, addPortfolioSplit, deletePortfolioSplit,
    portfolioContributions: allPortfolioContributions, addPortfolioContribution, updatePortfolioContribution, deletePortfolioContribution,
    portfolioWithdrawals: allPortfolioWithdrawals, addPortfolioWithdrawal, deletePortfolioWithdrawal,
    portfolioCashBalances: allPortfolioCashBalances, setPortfolioCashBalance, deletePortfolioCashBalance,
    portfolioBookedPlBaselines = [], setBookedPlBaseline,
    portfolioProjectedBankBalances = [], setProjectedBankBalance,
    portfolioRecurringPlans: allPortfolioRecurringPlans, addPortfolioRecurringPlan, updatePortfolioRecurringPlan, deletePortfolioRecurringPlan,
  } = props;

  const [selectedPlanPortfolios, setSelectedPlanPortfolios] = useState<Set<string>>(new Set());
  const planPortfolioNames = useMemo(() => {
    if (portfolioMode !== 'multiple') return [];
    const names = new Set<string>();
    allPortfolioContributions.forEach((c: any) => names.add(allPortfolios.find((p: any) => p.id === c.portfolio_id)?.name || 'Unassigned'));
    allPortfolioRecurringPlans.forEach((p: any) => names.add(allPortfolios.find((pp: any) => pp.id === p.portfolio_id)?.name || 'Unassigned'));
    return Array.from(names).sort();
  }, [allPortfolioContributions, allPortfolioRecurringPlans, allPortfolios, portfolioMode]);
  const selectedPlanPortfolioIds = useMemo(() => {
    if (selectedPlanPortfolios.size === 0) return null;
    return allPortfolios.filter((p: any) => selectedPlanPortfolios.has(p.name)).map((p: any) => p.id);
  }, [selectedPlanPortfolios, allPortfolios]);
  // Same pattern as Reports: filtered once here, so every metric downstream automatically
  // respects the portfolio selection without needing to be touched individually.
  const portfolioContributions = selectedPlanPortfolioIds ? allPortfolioContributions.filter((c: any) => selectedPlanPortfolioIds.includes(c.portfolio_id)) : allPortfolioContributions;
  const portfolioWithdrawals = selectedPlanPortfolioIds ? allPortfolioWithdrawals.filter((w: any) => selectedPlanPortfolioIds.includes(w.portfolio_id)) : allPortfolioWithdrawals;
  const portfolioCashBalances = selectedPlanPortfolioIds ? allPortfolioCashBalances.filter((c: any) => selectedPlanPortfolioIds.includes(c.portfolio_id)) : allPortfolioCashBalances;
  const portfolioRecurringPlans = selectedPlanPortfolioIds ? allPortfolioRecurringPlans.filter((p: any) => selectedPlanPortfolioIds.includes(p.portfolio_id)) : allPortfolioRecurringPlans;

  const [planTab, setPlanTab] = useState<PlanTab>('overview');
  const [formError, setFormError] = useState<string | null>(null);
  const runAction = async (fn: () => Promise<any>) => {
    setFormError(null);
    try {
      await fn();
    } catch (err: any) {
      console.error('Investment plan action failed:', err);
      setFormError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  const currentSplits = workspaceMembers.map(m => {
    const today = todayStr();
    const active = portfolioSplits.find(s => s.member_user_id === m.uid && s.effective_from <= today && (!s.effective_to || s.effective_to >= today));
    return { member: m, percent: active?.split_percent ?? 0 };
  });

  const [isAddingSplit, setIsAddingSplit] = useState(false);
  const [splitMemberId, setSplitMemberId] = useState('');
  const [splitPercent, setSplitPercent] = useState('');
  const [splitFrom, setSplitFrom] = useState(todayStr());
  const [splitTo, setSplitTo] = useState('');

  const [isAddingContribution, setIsAddingContribution] = useState(false);
  const [cMemberId, setCMemberId] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [cDate, setCDate] = useState(todayStr());
  const [cNotes, setCNotes] = useState('');
  const [cType, setCType] = useState<'one_off' | 'initial' | 'recurring'>('one_off');
  const [cApplyToPeriod, setCApplyToPeriod] = useState<'current' | 'next'>('current');
  const [transferModalPlanId, setTransferModalPlanId] = useState<string | null>(null);
  const [transferModalStep, setTransferModalStep] = useState<'breakdown' | 'ask' | 'link'>('breakdown');
  const [linkingContributionId, setLinkingContributionId] = useState<string | null>(null);
  const [cPortfolioId, setCPortfolioId] = useState('');
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [editContributionAmount, setEditContributionAmount] = useState('');
  const [editContributionDate, setEditContributionDate] = useState('');
  const [editContributionNotes, setEditContributionNotes] = useState('');
  const [contribFilters, setContribFilters] = useState<Set<string>>(new Set());
  const [contribSortField, setContribSortField] = useState<'name' | 'type' | 'date' | 'notes' | 'amount'>('date');
  const [contribSortDirection, setContribSortDirection] = useState<'asc' | 'desc'>('desc');
  const [contribGroupBy, setContribGroupBy] = useState<'none' | 'type'>('none');

  const defaultPlanPortfolioId = allPortfolios.find((p: any) => p.is_default)?.id || allPortfolios[0]?.id || '';

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cMemberId || !cAmount) return;
    // "Next period" is computed relative to today's month - this correctly matches whatever
    // frequency the person's actual plan turns out to be (monthly/quarterly/yearly), since
    // the reminder logic checks whether this date falls inside that plan's own period bounds,
    // not the other way around.
    const appliesToPeriodStart = cType === 'recurring' && cApplyToPeriod === 'next'
      ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 10)
      : undefined;
    await runAction(async () => {
      await addPortfolioContribution(cMemberId, parseFloat(cAmount), cDate, cNotes.trim() || undefined, cType, portfolioMode === 'multiple' ? (cPortfolioId || defaultPlanPortfolioId || undefined) : undefined, appliesToPeriodStart);
      setCAmount(''); setCNotes(''); setCType('one_off'); setCApplyToPeriod('current'); setIsAddingContribution(false);
    });
  };

  // Filter pills work like Holdings: type tags (Plan/One-off) + member name tags, both
  // toggleable together. Sort is a simple date/amount toggle since this is a flat list,
  // not a big table. Group by type shows Plan and One-off as separate sub-lists.
  const contribFilterOptions = useMemo(() => {
    const members = new Set<string>();
    portfolioContributions.forEach(c => {
      const m = workspaceMembers.find(x => x.uid === c.member_user_id);
      if (m) members.add(memberName(m));
    });
    return { types: ['Plan', 'One-off', 'Initial'], members: Array.from(members).sort() };
  }, [portfolioContributions, workspaceMembers]);

  const toggleContribFilter = (value: string) => {
    setContribFilters(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  const toggleContribSort = (field: 'name' | 'type' | 'date' | 'notes' | 'amount') => {
    if (contribSortField === field) setContribSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setContribSortField(field); setContribSortDirection('asc'); }
  };

  const filteredSortedContributions = useMemo(() => {
    const selectedTypes = contribFilterOptions.types.filter(t => contribFilters.has(t));
    const selectedMembers = contribFilterOptions.members.filter(m => contribFilters.has(m));
    let list = portfolioContributions.filter(c => {
      const typeLabel = contribTypeLabel(c);
      const typeOk = selectedTypes.length === 0 || selectedTypes.includes(typeLabel);
      const m = workspaceMembers.find(x => x.uid === c.member_user_id);
      const memberOk = selectedMembers.length === 0 || (m && selectedMembers.includes(memberName(m)));
      return typeOk && memberOk;
    });
    const valueFor = (c: any): string | number => {
      switch (contribSortField) {
        case 'name': { const m = workspaceMembers.find(x => x.uid === c.member_user_id); return m ? memberName(m) : ''; }
        case 'type': return contribTypeLabel(c);
        case 'date': return c.contribution_date;
        case 'notes': return c.notes || '';
        case 'amount': return Number(c.amount);
        default: return '';
      }
    };
    list = [...list].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : (av as number) - (bv as number);
      return contribSortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [portfolioContributions, contribFilters, contribFilterOptions, contribSortField, contribSortDirection, workspaceMembers]);

  const [isAddingWithdrawal, setIsAddingWithdrawal] = useState(false);
  const [wMemberId, setWMemberId] = useState('');
  const [wAmount, setWAmount] = useState('');
  const [wDate, setWDate] = useState(todayStr());

  // ---- Cash Balance ----
  const CASH_LOCATIONS: ('Zerodha' | 'Groww' | 'Bank' | 'Other')[] = ['Zerodha', 'Groww', 'Bank', 'Other'];
  const [editingCashLocation, setEditingCashLocation] = useState<string | null>(null);
  const [cashAmountInput, setCashAmountInput] = useState('');
  const [cashBalancePortfolioId, setCashBalancePortfolioId] = useState<string>('');
  const [editingBookedPlBaseline, setEditingBookedPlBaseline] = useState(false);
  const [bookedPlBaselineAmountInput, setBookedPlBaselineAmountInput] = useState('');
  const [bookedPlBaselineDateInput, setBookedPlBaselineDateInput] = useState(todayStr());
  const [bookedPlPortfolioId, setBookedPlPortfolioId] = useState<string>('');
  const [editingProjectedBankBalance, setEditingProjectedBankBalance] = useState(false);
  const [projectedBankBalanceAmountInput, setProjectedBankBalanceAmountInput] = useState('');
  const [projectedBalancePortfolioId, setProjectedBalancePortfolioId] = useState<string>('');

  const handleAddWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wMemberId || !wAmount) return;
    await runAction(async () => {
      await addPortfolioWithdrawal(wMemberId, parseFloat(wAmount), wDate);
      setWAmount(''); setIsAddingWithdrawal(false);
    });
  };

  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [planMemberId, setPlanMemberId] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planFrequency, setPlanFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [planStartDate, setPlanStartDate] = useState(todayStr());
  const [planDayOfMonth, setPlanDayOfMonth] = useState('1');
  const [planNotes, setPlanNotes] = useState('');
  const [planPortfolioId, setPlanPortfolioId] = useState('');

  const getPeriodBounds = (frequency: 'monthly' | 'quarterly' | 'yearly', ref = new Date()) => {
    if (frequency === 'monthly') {
      return {
        start: new Date(ref.getFullYear(), ref.getMonth(), 1),
        end: new Date(ref.getFullYear(), ref.getMonth() + 1, 0),
        label: ref.toLocaleString('default', { month: 'long', year: 'numeric' }),
      };
    }
    if (frequency === 'quarterly') {
      const q = Math.floor(ref.getMonth() / 3);
      return {
        start: new Date(ref.getFullYear(), q * 3, 1),
        end: new Date(ref.getFullYear(), q * 3 + 3, 0),
        label: `Q${q + 1} ${ref.getFullYear()}`,
      };
    }
    return {
      start: new Date(ref.getFullYear(), 0, 1),
      end: new Date(ref.getFullYear(), 11, 31),
      label: String(ref.getFullYear()),
    };
  };

  // Counts how many full periods have elapsed from the plan's start date up to and
  // including the reference date's period - used to compute a running cumulative expected
  // amount, which is what makes over/under-payment naturally carry forward without an
  // explicit per-period balance ledger. E.g. paying $1500 against a $1000/month plan when
  // cumulative expected is $1000 leaves $500 credit that reduces next month's number
  // automatically, since next month's cumulative expected grows but paid doesn't.
  const periodsElapsedSince = (startDate: Date, frequency: 'monthly' | 'quarterly' | 'yearly', ref = new Date()) => {
    if (frequency === 'monthly') {
      return Math.max(1, (ref.getFullYear() - startDate.getFullYear()) * 12 + (ref.getMonth() - startDate.getMonth()) + 1);
    }
    if (frequency === 'quarterly') {
      const startQ = Math.floor(startDate.getMonth() / 3);
      const refQ = Math.floor(ref.getMonth() / 3);
      return Math.max(1, (ref.getFullYear() - startDate.getFullYear()) * 4 + (refQ - startQ) + 1);
    }
    return Math.max(1, ref.getFullYear() - startDate.getFullYear() + 1);
  };

  // My own contribution reminder - due within 3 days (or already overdue) and not yet
  // transferred for the current period. Computed live whenever the page loads, no backend
  // job involved - only shows for the logged-in person's own plan(s). Dismissing only hides
  // it for this specific period (keyed by plan id + period label) - a new period's reminder
  // still shows normally once it comes around.
  const myContributionReminder = useMemo(() => {
    if (!currentUserId) return null;
    const myPlans = portfolioRecurringPlans.filter(p => p.active && p.member_user_id === currentUserId);
    for (const plan of myPlans) {
      const period = getPeriodBounds(plan.frequency);
      const dueDate = plan.frequency === 'monthly' && plan.day_of_month
        ? new Date(period.start.getFullYear(), period.start.getMonth(), Number(plan.day_of_month))
        : period.end;
      const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
      if (daysUntilDue > 3) continue;

      // Cumulative model: total expected across every period since the plan started, up to
      // and including this one, versus every recurring contribution ever made against it -
      // this is what makes over/under-payment carry forward naturally. Paying $1500 against
      // a $1000/month plan leaves $500 credit, which reduces what's shown as due next month
      // automatically, since cumulative expected keeps growing but the extra $500 was
      // already paid. Underpaying compounds the same way in the other direction.
      const periodsElapsed = periodsElapsedSince(new Date(plan.start_date), plan.frequency);
      const cumulativeExpected = Number(plan.expected_amount) * periodsElapsed;
      const cumulativePaid = portfolioContributions
        .filter(c => c.member_user_id === currentUserId && c.contribution_type === 'recurring')
        .reduce((s, c) => s + Number(c.amount), 0);
      const remaining = Math.max(0, cumulativeExpected - cumulativePaid);
      if (remaining === 0) continue;

      const reminderKey = `${plan.id}-${period.label}`;
      if (dismissedReminderKey === reminderKey) continue;

      // Breakdown for display: how much of "remaining" is this period's own expected amount
      // vs. a shortfall/credit carried in from before, so the person can see why the number
      // isn't simply their usual monthly amount.
      const periodExpected = Number(plan.expected_amount);
      const carryForward = remaining - periodExpected; // positive = shortfall carried in, negative = credit carried in

      return { plan, remaining, daysUntilDue, dueDate, reminderKey, periodExpected, carryForward, cumulativeExpected, cumulativePaid };
    }
    return null;
  }, [currentUserId, portfolioRecurringPlans, portfolioContributions, dismissedReminderKey]);

  const markTransferred = async (memberUserId: string, amount: number, portfolioId?: string) => {
    await runAction(async () => {
      await addPortfolioContribution(memberUserId, amount, todayStr(), 'Recurring plan transfer', 'recurring', portfolioId);
    });
  };

  // Shared by the modal and both trigger points (personal reminder + Fund Transfer Status),
  // so there's exactly one place computing this instead of two copies that can drift apart.
  const computeTransferInfo = (plan: any) => {
    const period = getPeriodBounds(plan.frequency);
    const periodsElapsed = periodsElapsedSince(new Date(plan.start_date), plan.frequency);
    const cumulativeExpected = Number(plan.expected_amount) * periodsElapsed;
    const cumulativePaid = portfolioContributions
      .filter(c => c.member_user_id === plan.member_user_id && c.contribution_type === 'recurring')
      .reduce((s, c) => s + Number(c.amount), 0);
    const remaining = Math.max(0, cumulativeExpected - cumulativePaid);
    const periodExpected = Number(plan.expected_amount);
    const carryForward = remaining - periodExpected;
    const advanceContributions = portfolioContributions.filter(c =>
      c.member_user_id === plan.member_user_id && c.contribution_type === 'recurring' && new Date(c.contribution_date) < period.start
    );
    return { period, remaining, periodExpected, carryForward, advanceContributions };
  };

  const openTransferModal = (plan: any) => {
    const info = computeTransferInfo(plan);
    setTransferModalPlanId(plan.id);
    setLinkingContributionId(null);
    // If the system already found a shortfall/credit from prior activity, go straight to
    // the breakdown - no need to ask "have you already paid" when we can already see why
    // the number differs. Only ask when nothing on record explains it, since that's exactly
    // the case where a real payment could exist but isn't linked yet, risking a duplicate.
    setTransferModalStep(info.carryForward !== 0 ? 'breakdown' : 'ask');
  };

  const linkableContributionsFor = (memberUserId: string) => portfolioContributions.filter(c =>
    c.member_user_id === memberUserId && c.contribution_type !== 'recurring'
  );

  const TABS: { key: PlanTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'contributions', label: 'Contributions' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-3 sm:px-5 pt-3 sm:pt-4 pb-24 md:pb-4 space-y-4 text-left bg-slate-50 dark:bg-slate-950">
      <div className="rounded-2xl bg-indigo-600 text-white p-4 shadow-lg shadow-indigo-600/25">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100">Plan</p>
            <h2 className="text-xl font-black tracking-tight truncate">
              {workspaceName ? `${workspaceName} Investment Plan` : 'Investment Plan'}
            </h2>
            <p className="text-[11px] font-semibold text-indigo-100/90">Contributions · Withdrawals · Splits · Recurring</p>
          </div>
        </div>
      </div>

      {portfolioMode === 'multiple' && planPortfolioNames.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-violet-500/80 dark:text-violet-400/80 w-10">
            Book
          </span>
          <div className="inline-flex items-center gap-0.5 p-1 rounded-2xl bg-violet-200 dark:bg-violet-950/70 border-2 border-violet-400 dark:border-violet-700">
            <button
              type="button"
              onClick={() => setSelectedPlanPortfolios(new Set())}
              className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                selectedPlanPortfolios.size === 0
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-violet-700/70 dark:text-violet-300/70'
              }`}
            >
              All
            </button>
            {planPortfolioNames.map(p => (
              <button
                type="button"
                key={p}
                onClick={() => setSelectedPlanPortfolios(prev => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next; })}
                className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  selectedPlanPortfolios.has(p)
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                    : 'text-violet-700/70 dark:text-violet-300/70'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {formError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{formError}</div>
      )}

      {myContributionReminder && (
        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${myContributionReminder.daysUntilDue < 0 ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'}`}>
          <AlertTriangle className={`w-5 h-5 shrink-0 ${myContributionReminder.daysUntilDue < 0 ? 'text-rose-500' : 'text-amber-500'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${myContributionReminder.daysUntilDue < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {myContributionReminder.daysUntilDue < 0
                ? `Your contribution is overdue by ${Math.abs(myContributionReminder.daysUntilDue)} day${Math.abs(myContributionReminder.daysUntilDue) !== 1 ? 's' : ''}`
                : myContributionReminder.daysUntilDue === 0
                ? 'Your contribution is due today'
                : `Your contribution is due in ${myContributionReminder.daysUntilDue} day${myContributionReminder.daysUntilDue !== 1 ? 's' : ''}`}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {fmt(myContributionReminder.remaining)} remaining for this {myContributionReminder.plan.frequency} period
              {myContributionReminder.carryForward !== 0 && (
                myContributionReminder.carryForward > 0
                  ? ` (includes ${fmt(myContributionReminder.carryForward)} carried forward from a shortfall)`
                  : ` (usual ${fmt(myContributionReminder.periodExpected)}, reduced by ${fmt(Math.abs(myContributionReminder.carryForward))} credit from an earlier overpayment)`
              )}
            </p>
          </div>
          {!isReadOnly && (
            <button
              onClick={() => openTransferModal(myContributionReminder.plan)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer shrink-0"
            >
              Mark Transferred
            </button>
          )}
          <button
            onClick={() => runAction(() => onDismissContributionReminder?.(myContributionReminder.reminderKey) ?? Promise.resolve())}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer shrink-0"
            title="Dismiss for this period"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 py-2 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur border-b border-indigo-200/60 dark:border-indigo-900/40">
        <div className="flex gap-2 p-1 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 border-2 border-indigo-300 dark:border-indigo-700">
          {TABS.map(tab => (
            <button
              type="button"
              key={tab.key}
              onClick={() => setPlanTab(tab.key)}
              className={`flex-1 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                planTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40'
                  : 'text-indigo-800 dark:text-indigo-200 hover:bg-white/60 dark:hover:bg-indigo-900/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {planTab === 'overview' && (
        <>
        {portfolioContributions.length > 0 && (() => {
          const events = [
            ...portfolioContributions.map((c: any) => ({ date: c.contribution_date, delta: Number(c.amount) })),
            ...portfolioWithdrawals.map((w: any) => ({ date: w.withdrawal_date, delta: -Number(w.amount) })),
          ].sort((a, b) => a.date.localeCompare(b.date));
          let running = 0;
          const chartData = events.map(e => { running += e.delta; return { date: e.date, total: running }; });
          return (
            <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-l-[6px] border-l-indigo-500 bg-white dark:bg-slate-900 p-4 space-y-2 shadow-md">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Contribution Growth</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                    <Tooltip formatter={(v: number) => [fmt(v), 'Total Contributed']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}

        {workspaceMembers.length > 0 && (() => {
          const chartData = workspaceMembers.map(m => {
            const contributed = portfolioContributions.filter((c: any) => c.member_user_id === m.uid).reduce((s: number, c: any) => s + Number(c.amount), 0);
            const withdrawn = portfolioWithdrawals.filter((w: any) => w.member_user_id === m.uid).reduce((s: number, w: any) => s + Number(w.amount), 0);
            return { name: memberName(m), amount: contributed - withdrawn };
          });
          const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
          return (
            <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-l-[6px] border-l-indigo-500 bg-white dark:bg-slate-900 p-4 space-y-2 shadow-md">
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5"><span className="w-1.5 h-3.5 rounded-full bg-emerald-500 shrink-0" />Total Contribution by Person</span>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                    <Tooltip formatter={(v: number) => [fmt(v), 'Net Contributed']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}
        </>
      )}

      {planTab === 'contributions' && (
        <>
        {portfolioRecurringPlans.some(p => p.active) && (
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-l-[6px] border-l-indigo-500 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-md">
            <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5"><span className="w-1.5 h-3.5 rounded-full bg-indigo-500 shrink-0" />Fund Transfer Status</span>
            <p className="text-[9px] text-slate-400">Who's transferred their share for the current period, and who hasn't yet.</p>
            <div className="space-y-2">
              {portfolioRecurringPlans.filter(p => p.active).map(plan => {
                const m = workspaceMembers.find(x => x.uid === plan.member_user_id);
                const { period, remaining, transferredThisPeriod, fulfilled } = (() => {
                  const info = computeTransferInfo(plan);
                  return { period: info.period, remaining: info.remaining, transferredThisPeriod: Math.max(0, info.periodExpected - info.remaining), fulfilled: info.remaining === 0 };
                })();
                return (
                  <div key={plan.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{m ? memberName(m) : 'Former member'}</p>
                      <p className="text-[10px] text-slate-400">{period.label} · expected {fmt(Number(plan.expected_amount))}{transferredThisPeriod > 0 && !fulfilled ? ` · ${fmt(transferredThisPeriod)} already covered by an advance` : ''}</p>
                    </div>
                    {fulfilled ? (
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase rounded-full shrink-0">Transferred</span>
                    ) : !isReadOnly ? (
                      <button
                        onClick={() => openTransferModal(plan)}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase rounded-lg cursor-pointer shrink-0"
                      >
                        Mark {fmt(remaining)} Transferred
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase rounded-full shrink-0">Pending</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-l-[6px] border-l-indigo-500 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5"><span className="w-1.5 h-3.5 rounded-full bg-emerald-500 shrink-0" />Recurring Contribution Plan</span>
            {!isReadOnly && <button onClick={() => setIsAddingPlan(!isAddingPlan)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Add Plan</button>}
          </div>
          <p className="text-[10px] text-slate-400">What each person is expected to contribute on a schedule — separate from your Bills.</p>

          {isAddingPlan && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!planMemberId || !planAmount) return;
                await runAction(async () => {
                  await addPortfolioRecurringPlan(planMemberId, parseFloat(planAmount), planFrequency, planStartDate, planFrequency === 'monthly' ? parseInt(planDayOfMonth) : undefined, planNotes.trim() || undefined, portfolioMode === 'multiple' ? (planPortfolioId || defaultPlanPortfolioId || undefined) : undefined);
                  setPlanAmount(''); setPlanNotes(''); setIsAddingPlan(false);
                });
              }}
              className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80"
            >
              <select value={planMemberId} onChange={(e) => setPlanMemberId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                <option value="">Who</option>
                {workspaceMembers.map(m => <option key={m.uid} value={m.uid}>{memberName(m)}</option>)}
              </select>
              <input type="number" value={planAmount} onChange={(e) => setPlanAmount(e.target.value)} placeholder="Amount" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
              <select value={planFrequency} onChange={(e) => setPlanFrequency(e.target.value as any)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
              {planFrequency === 'monthly' && (
                <input type="number" min="1" max="31" value={planDayOfMonth} onChange={(e) => setPlanDayOfMonth(e.target.value)} placeholder="Day of month" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
              )}
              <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs col-span-2" />
              {portfolioMode === 'multiple' && (
                <select
                  value={planPortfolioId || defaultPlanPortfolioId}
                  onChange={(e) => setPlanPortfolioId(e.target.value)}
                  className="col-span-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  title="Which portfolio this recurring plan is for"
                >
                  {allPortfolios.map((p: any) => <option key={p.id} value={p.id}>For: {p.name} ({p.currency})</option>)}
                </select>
              )}
              <textarea value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="col-span-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs resize-none" />
              <button type="submit" className="col-span-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Save Plan</button>
            </form>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-900">
            {portfolioRecurringPlans.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-4">No recurring plan set up yet.</p>
            ) : portfolioRecurringPlans.map(plan => {
              const m = workspaceMembers.find(x => x.uid === plan.member_user_id);
              return (
                <div key={plan.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{m ? memberName(m) : 'Former member'}</p>
                    <p className="text-[10px] text-slate-400">{fmt(Number(plan.expected_amount))} · {plan.frequency}{plan.day_of_month ? ` on day ${plan.day_of_month}` : ''} · from {plan.start_date}</p>
                    {plan.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">{plan.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isReadOnly && (
                      <button
                        onClick={() => runAction(() => updatePortfolioRecurringPlan(plan.id, { active: !plan.active }))}
                        className={`px-2 py-1 text-[9px] font-black uppercase rounded-full cursor-pointer ${plan.active ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                      >
                        {plan.active ? 'Active' : 'Paused'}
                      </button>
                    )}
                    {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioRecurringPlan(plan.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-l-[6px] border-l-indigo-500 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-md">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Split Among Workspace Members</span>
          <p className="text-[9px] text-slate-400">Everyone here is a member of this workspace. To add someone new, invite them via Family Sharing first.</p>
          <div className="space-y-1.5">
            {currentSplits.map(({ member, percent }) => (
              <div key={member.uid} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{memberName(member)}</span>
                <span className="font-black text-slate-900 dark:text-white">{percent}%</span>
              </div>
            ))}
          </div>

          {!isReadOnly && (
          <>
          <button onClick={() => setIsAddingSplit(!isAddingSplit)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Set Split for a Period</button>
          {isAddingSplit && (
            <form
              onSubmit={async (e) => { e.preventDefault(); if (!splitMemberId || !splitPercent) return; await runAction(async () => { await addPortfolioSplit(splitMemberId, parseFloat(splitPercent), splitFrom, splitTo || undefined); setSplitPercent(''); setIsAddingSplit(false); }); }}
              className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80"
            >
              <select value={splitMemberId} onChange={(e) => setSplitMemberId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                <option value="">Select person</option>
                {workspaceMembers.map(m => <option key={m.uid} value={m.uid}>{memberName(m)}</option>)}
              </select>
              <input type="number" value={splitPercent} onChange={(e) => setSplitPercent(e.target.value)} placeholder="% e.g. 50" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
              <input type="date" value={splitFrom} onChange={(e) => setSplitFrom(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
              <input type="date" value={splitTo} onChange={(e) => setSplitTo(e.target.value)} placeholder="End (optional)" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
              <button type="submit" className="col-span-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Save Split</button>
            </form>
          )}
          </>
          )}
          {portfolioSplits.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Split History</span>
              {portfolioSplits.map(s => {
                const m = workspaceMembers.find(x => x.uid === s.member_user_id);
                return (
                  <div key={s.id} className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{m ? memberName(m) : 'Former member'} — {s.split_percent}% ({s.effective_from} → {s.effective_to || 'ongoing'})</span>
                    {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioSplit(s.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 border-l-[6px] border-l-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/25 p-4 space-y-3 shadow-md shadow-indigo-500/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-4 rounded-full bg-indigo-500" />
              <Wallet className="w-3.5 h-3.5" /> Contribution Log
            </span>
            <div className="flex items-center gap-3">
              {!isReadOnly && <button onClick={() => setIsAddingContribution(!isAddingContribution)} className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-sm shadow-indigo-600/25 cursor-pointer hover:bg-indigo-500">+ Log Contribution</button>}
              {!isReadOnly && <button onClick={() => setIsAddingWithdrawal(!isAddingWithdrawal)} className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-sm shadow-rose-500/25 cursor-pointer hover:bg-rose-400">+ Log Withdrawal</button>}
            </div>
          </div>
          {isAddingContribution && (
            <form onSubmit={handleAddContribution} className="grid grid-cols-3 gap-2">
              <select value={cMemberId} onChange={(e) => setCMemberId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                <option value="">Who</option>
                {workspaceMembers.map(m => <option key={m.uid} value={m.uid}>{memberName(m)}</option>)}
              </select>
              <input type="number" value={cAmount} onChange={(e) => setCAmount(e.target.value)} placeholder={portfolioMode === 'multiple' ? `Amount (${allPortfolios.find((p: any) => p.id === (cPortfolioId || defaultPlanPortfolioId))?.currency || baseCurrency})` : 'Amount'} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
              <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
              {portfolioMode === 'multiple' && (
                <select
                  value={cPortfolioId || defaultPlanPortfolioId}
                  onChange={(e) => setCPortfolioId(e.target.value)}
                  className="col-span-3 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  title="Which portfolio this contribution is for"
                >
                  {allPortfolios.map((p: any) => <option key={p.id} value={p.id}>For: {p.name} ({p.currency})</option>)}
                </select>
              )}
              <select value={cType} onChange={(e) => setCType(e.target.value as any)} className="col-span-3 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                <option value="one_off">One-off Payment</option>
                <option value="initial">Initial Investment</option>
                <option value="recurring">Recurring Plan Payment</option>
              </select>
              {cType === 'recurring' && (
                <div className="col-span-3 flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">Counts toward:</span>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setCApplyToPeriod('current')} className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${cApplyToPeriod === 'current' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>This period</button>
                    <button type="button" onClick={() => setCApplyToPeriod('next')} className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${cApplyToPeriod === 'next' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Next period (paying early)</button>
                  </div>
                </div>
              )}
              <textarea value={cNotes} onChange={(e) => setCNotes(e.target.value)} placeholder="Notes (optional) - e.g. bonus deposit, salary top-up" rows={2} className="col-span-3 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs resize-none" />
              <button type="submit" className="col-span-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Add</button>
            </form>
          )}

          {isAddingWithdrawal && (
            <form onSubmit={handleAddWithdrawal} className="grid grid-cols-3 gap-2">
              <select value={wMemberId} onChange={(e) => setWMemberId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                <option value="">Who</option>
                {workspaceMembers.map(m => <option key={m.uid} value={m.uid}>{memberName(m)}</option>)}
              </select>
              <input type="number" value={wAmount} onChange={(e) => setWAmount(e.target.value)} placeholder="Amount" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
              <input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
              <button type="submit" className="col-span-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Withdraw</button>
            </form>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setContribFilters(new Set())} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${contribFilters.size === 0 ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>All</button>
            {contribFilterOptions.types.map(t => {
              const colorClass = t === 'Plan'
                ? (contribFilters.has(t) ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400')
                : t === 'Initial'
                ? (contribFilters.has(t) ? 'bg-purple-500 text-white' : 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400')
                : (contribFilters.has(t) ? 'bg-slate-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500');
              return (
                <button key={t} onClick={() => toggleContribFilter(t)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${colorClass}`}>{t}</button>
              );
            })}
            {contribFilterOptions.members.map(m => (
              <button key={m} onClick={() => toggleContribFilter(m)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${contribFilters.has(m) ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}>{m}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setContribGroupBy(prev => (prev === 'type' ? 'none' : 'type'))}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer ${contribGroupBy === 'type' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
            >
              Type
            </button>
          </div>

          {(() => {
            const editRow = (c: any) => (
              <tr key={c.id}>
                <td colSpan={5} className="py-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <input type="date" value={editContributionDate} onChange={(e) => setEditContributionDate(e.target.value)} className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[11px]" />
                      <input type="number" value={editContributionAmount} onChange={(e) => setEditContributionAmount(e.target.value)} className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[11px]" />
                      <button
                        onClick={() => runAction(async () => {
                          await updatePortfolioContribution(c.id, { amount: parseFloat(editContributionAmount), contributionDate: editContributionDate, notes: editContributionNotes.trim() });
                          setEditingContributionId(null);
                        })}
                        className="p-1 bg-indigo-600 text-white rounded-md cursor-pointer shrink-0"
                      ><CheckCircle2 className="w-3 h-3" /></button>
                      <button onClick={() => setEditingContributionId(null)} className="p-1 text-slate-400 cursor-pointer shrink-0"><X className="w-3 h-3" /></button>
                    </div>
                    <textarea value={editContributionNotes} onChange={(e) => setEditContributionNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] resize-none" />
                  </div>
                </td>
              </tr>
            );
            const dataRow = (c: any) => {
              const m = workspaceMembers.find(x => x.uid === c.member_user_id);
              return (
                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                  <td className="p-2 text-slate-700 dark:text-slate-300 font-semibold">{m ? memberName(m) : 'Former member'}</td>
                  <td className="p-2">
                    {c.contribution_type === 'recurring' ? (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-full">Plan</span>
                    ) : c.contribution_type === 'initial' ? (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-full">Initial</span>
                    ) : (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">One-off</span>
                    )}
                  </td>
                  <td className="p-2 text-slate-500">{c.contribution_date}</td>
                  <td className="p-2 text-slate-400 italic truncate max-w-[120px]">{c.notes || '—'}</td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white">{fmt(Number(c.amount))}</span>
                      {!isReadOnly && (
                        <button
                          onClick={() => { setEditingContributionId(c.id); setEditContributionAmount(String(c.amount)); setEditContributionDate(c.contribution_date); setEditContributionNotes(c.notes || ''); }}
                          className="text-slate-300 hover:text-indigo-500 cursor-pointer"
                        ><Edit2 className="w-3 h-3" /></button>
                      )}
                      {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioContribution(c.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                  </td>
                </tr>
              );
            };
            const renderRow = (c: any) => (editingContributionId === c.id ? editRow(c) : dataRow(c));

            if (filteredSortedContributions.length === 0) {
              return <p className="text-center text-xs text-slate-400 py-4">No contributions match{contribFilters.size > 0 ? ' this filter' : ' yet'}.</p>;
            }

            const headerRow = (
              <tr className="border-b border-slate-100 dark:border-slate-900 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                {([
                  ['name', 'Name', 'text-left'],
                  ['type', 'Type', 'text-left'],
                  ['date', 'Date', 'text-left'],
                  ['notes', 'Notes', 'text-left'],
                  ['amount', 'Amount', 'text-right'],
                ] as [typeof contribSortField, string, string][]).map(([field, label, align]) => (
                  <th key={field} onClick={() => toggleContribSort(field)} className={`p-2 ${align} cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300`}>
                    <span className="inline-flex items-center gap-0.5">
                      {label}
                      {contribSortField === field ? <span className="text-indigo-500">{contribSortDirection === 'asc' ? '↑' : '↓'}</span> : <span className="text-slate-300 dark:text-slate-600">↕</span>}
                    </span>
                  </th>
                ))}
              </tr>
            );

            if (contribGroupBy === 'type') {
              const plans = filteredSortedContributions.filter(c => c.contribution_type === 'recurring');
              const initials = filteredSortedContributions.filter(c => c.contribution_type === 'initial');
              const oneOffs = filteredSortedContributions.filter(c => c.contribution_type !== 'recurring' && c.contribution_type !== 'initial');
              return (
                <div className="overflow-x-auto space-y-4">
                  {plans.length > 0 && (
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Plan ({plans.length})</span>
                      <table className="w-full text-xs min-w-[480px] mt-1">
                        <thead>{headerRow}</thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-900">{plans.map(renderRow)}</tbody>
                      </table>
                    </div>
                  )}
                  {initials.length > 0 && (
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Initial ({initials.length})</span>
                      <table className="w-full text-xs min-w-[480px] mt-1">
                        <thead>{headerRow}</thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-900">{initials.map(renderRow)}</tbody>
                      </table>
                    </div>
                  )}
                  {oneOffs.length > 0 && (
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">One-off ({oneOffs.length})</span>
                      <table className="w-full text-xs min-w-[480px] mt-1">
                        <thead>{headerRow}</thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-900">{oneOffs.map(renderRow)}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[480px]">
                  <thead>{headerRow}</thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900">{filteredSortedContributions.map(renderRow)}</tbody>
                </table>
              </div>
            );
          })()}
        </div>

        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-l-[6px] border-l-indigo-500 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-md">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Withdrawals</span>
          <p className="text-[9px] text-slate-400">Money taken out of the pool back to a person - separate from selling a stock, which stays in the pool as cash.</p>
          <div className="divide-y divide-slate-100 dark:divide-slate-900">
            {portfolioWithdrawals.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-4">No withdrawals logged.</p>
            ) : portfolioWithdrawals.map(w => {
              const m = workspaceMembers.find(x => x.uid === w.member_user_id);
              return (
                <div key={w.id} className="py-2 flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300">{m ? memberName(m) : 'Former member'} · {w.withdrawal_date}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-rose-500">-{fmt(Number(w.amount))}</span>
                    {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioWithdrawal(w.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}

      {transferModalPlanId && (() => {
        const plan = portfolioRecurringPlans.find((p: any) => p.id === transferModalPlanId);
        if (!plan) return null;
        const m = workspaceMembers.find(x => x.uid === plan.member_user_id);
        const info = computeTransferInfo(plan);
        const linkable = linkableContributionsFor(plan.member_user_id);
        const closeModal = () => { setTransferModalPlanId(null); setLinkingContributionId(null); };

        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={closeModal}>
            <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{m ? memberName(m) : 'Member'} · {info.period.label}</h3>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 space-y-3">
                {transferModalStep === 'ask' && (
                  <>
                    <p className="text-xs text-slate-600 dark:text-slate-400">We don't see an earlier contribution covering this period yet. Has {m ? memberName(m) : 'this person'} already transferred the {fmt(info.periodExpected)} for {info.period.label}?</p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setTransferModalStep('link')}
                        className="w-full py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black uppercase rounded-xl cursor-pointer"
                      >
                        Yes - link an existing contribution
                      </button>
                      <button
                        onClick={() => runAction(async () => {
                          await markTransferred(plan.member_user_id, info.remaining, plan.portfolio_id);
                          closeModal();
                        })}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl cursor-pointer"
                      >
                        No - record a new {fmt(info.remaining)} transfer
                      </button>
                    </div>
                  </>
                )}

                {transferModalStep === 'link' && (
                  <>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Which contribution is this? Selecting one marks it as covering this plan, instead of recording a new, possibly duplicate transfer.</p>
                    {linkable.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-2">No other logged contributions found for {m ? memberName(m) : 'this person'} to link.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5">
                        {linkable.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setLinkingContributionId(c.id)}
                            className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-xs cursor-pointer border ${linkingContributionId === c.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'}`}
                          >
                            <span className="text-slate-600 dark:text-slate-400">{c.contribution_date}{c.notes ? ` · ${c.notes}` : ''}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0 ml-2">{fmt(Number(c.amount))}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => runAction(async () => {
                          if (!linkingContributionId) return;
                          await updatePortfolioContribution(linkingContributionId, { contributionType: 'recurring' });
                          closeModal();
                        })}
                        disabled={!linkingContributionId}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[11px] font-black uppercase rounded-lg cursor-pointer"
                      >
                        Link Selected
                      </button>
                      <button onClick={() => setTransferModalStep('ask')} className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 text-[11px] font-black uppercase rounded-lg cursor-pointer">
                        Back
                      </button>
                    </div>
                  </>
                )}

                {transferModalStep === 'breakdown' && (
                  <>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                      <div className="flex justify-between"><span>Usual {plan.frequency} amount</span><span className="font-semibold">{fmt(info.periodExpected)}</span></div>
                      {info.carryForward > 0 && (
                        <div className="flex justify-between text-rose-600 dark:text-rose-400"><span>+ Shortfall carried from before</span><span className="font-semibold">{fmt(info.carryForward)}</span></div>
                      )}
                      {info.carryForward < 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>− Credit from an earlier overpayment</span><span className="font-semibold">{fmt(Math.abs(info.carryForward))}</span></div>
                      )}
                      {info.advanceContributions.length > 0 && (
                        <div className="pt-1.5 space-y-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">From:</span>
                          {info.advanceContributions.map(c => (
                            <div key={c.id} className="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-slate-950 rounded text-[10px]">
                              <span className="text-slate-500">{c.contribution_date}{c.notes ? ` · ${c.notes}` : ''}</span>
                              <span className="font-semibold">{fmt(Number(c.amount))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between font-black text-slate-800 dark:text-slate-200 pt-1 border-t border-slate-200 dark:border-slate-800"><span>Total to transfer now</span><span>{fmt(info.remaining)}</span></div>
                    </div>
                    <button
                      onClick={() => runAction(async () => {
                        await markTransferred(plan.member_user_id, info.remaining, plan.portfolio_id);
                        closeModal();
                      })}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl cursor-pointer"
                    >
                      Confirm {fmt(info.remaining)} Transferred
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
