import React, { useState, useMemo } from 'react';
import { Trash2, Users, Wallet, Edit2, CheckCircle2, X, ClipboardList, Banknote, AlertTriangle } from 'lucide-react';
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
  addPortfolioContribution: (memberUserId: string, amount: number, date: string, notes?: string, contributionType?: 'one_off' | 'recurring' | 'initial', portfolioId?: string) => Promise<void>;
  updatePortfolioContribution: (id: string, updates: { amount?: number; contributionDate?: string; notes?: string }) => Promise<void>;
  deletePortfolioContribution: (id: string) => Promise<void>;
  portfolioWithdrawals: any[];
  addPortfolioWithdrawal: (memberUserId: string, amount: number, date: string, notes?: string) => Promise<void>;
  deletePortfolioWithdrawal: (id: string) => Promise<void>;
  portfolioCashBalances: any[];
  setPortfolioCashBalance: (location: 'Zerodha' | 'Groww' | 'Bank' | 'Other', amount: number, asOfDate?: string, notes?: string) => Promise<void>;
  deletePortfolioCashBalance: (id: string) => Promise<void>;
  portfolioRecurringPlans: any[];
  addPortfolioRecurringPlan: (memberUserId: string, amount: number, frequency: 'monthly' | 'quarterly' | 'yearly', startDate: string, dayOfMonth?: number, notes?: string) => Promise<void>;
  updatePortfolioRecurringPlan: (id: string, updates: { active?: boolean; expectedAmount?: number }) => Promise<void>;
  deletePortfolioRecurringPlan: (id: string) => Promise<void>;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const memberName = (m: WorkspaceMemberLite) => m.displayName || m.email.split('@')[0];
const contribTypeLabel = (c: any) => c.contribution_type === 'recurring' ? 'Plan' : c.contribution_type === 'initial' ? 'Initial' : 'One-off';

type PlanTab = 'overview' | 'contributions' | 'settings';

export default function InvestmentPlanView(props: InvestmentPlanViewProps) {
  const {
    workspaceName, workspaceMembers, isReadOnly, currentUserId, dismissedReminderKey, onDismissContributionReminder,
    portfolios: allPortfolios = [], portfolioMode = 'single', workspaceCurrencyRates = [], baseCurrency = 'INR',
    portfolioSplits, addPortfolioSplit, deletePortfolioSplit,
    portfolioContributions: allPortfolioContributions, addPortfolioContribution, updatePortfolioContribution, deletePortfolioContribution,
    portfolioWithdrawals: allPortfolioWithdrawals, addPortfolioWithdrawal, deletePortfolioWithdrawal,
    portfolioCashBalances: allPortfolioCashBalances, setPortfolioCashBalance, deletePortfolioCashBalance,
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
  const [cType, setCType] = useState<'one_off' | 'initial'>('one_off');
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
    await runAction(async () => {
      await addPortfolioContribution(cMemberId, parseFloat(cAmount), cDate, cNotes.trim() || undefined, cType, portfolioMode === 'multiple' ? (cPortfolioId || defaultPlanPortfolioId || undefined) : undefined);
      setCAmount(''); setCNotes(''); setCType('one_off'); setIsAddingContribution(false);
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

      const transferredThisPeriod = portfolioContributions
        .filter(c => c.member_user_id === currentUserId && c.contribution_type === 'recurring')
        .filter(c => { const d = new Date(c.contribution_date); return d >= period.start && d <= period.end; })
        .reduce((s, c) => s + Number(c.amount), 0);
      const remaining = Math.max(0, Number(plan.expected_amount) - transferredThisPeriod);
      if (remaining === 0) continue;

      const reminderKey = `${plan.id}-${period.label}`;
      if (dismissedReminderKey === reminderKey) continue;

      return { plan, remaining, daysUntilDue, dueDate, reminderKey };
    }
    return null;
  }, [currentUserId, portfolioRecurringPlans, portfolioContributions, dismissedReminderKey]);

  const markTransferred = async (memberUserId: string, amount: number) => {
    await runAction(async () => {
      await addPortfolioContribution(memberUserId, amount, todayStr(), 'Recurring plan transfer', 'recurring');
    });
  };

  const TABS: { key: PlanTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'contributions', label: 'Contributions' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-5 text-left bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{workspaceName ? `${workspaceName} Investment Plan` : 'Investment Plan'}</h2>
      </div>

      {portfolioMode === 'multiple' && planPortfolioNames.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedPlanPortfolios(new Set())}
            className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${selectedPlanPortfolios.size === 0 ? 'bg-violet-600 text-white' : 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400'}`}
          >
            All
          </button>
          {planPortfolioNames.map(p => (
            <button
              key={p}
              onClick={() => setSelectedPlanPortfolios(prev => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next; })}
              className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${selectedPlanPortfolios.has(p) ? 'bg-violet-600 text-white' : 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400'}`}
            >
              {p}
            </button>
          ))}
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
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{fmt(myContributionReminder.remaining)} remaining for this {myContributionReminder.plan.frequency} period</p>
          </div>
          {!isReadOnly && (
            <button
              onClick={() => runAction(() => markTransferred(currentUserId!, myContributionReminder.remaining))}
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

      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setPlanTab(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${planTab === t.key ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
          >
            {t.label}
          </button>
        ))}
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
            <div className="apple-card p-4 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Contribution Growth</span>
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
            <div className="apple-card p-4 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Contribution by Person</span>
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
          <div className="apple-card p-4 space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fund Transfer Status</span>
            <p className="text-[9px] text-slate-400">Who's transferred their share for the current period, and who hasn't yet.</p>
            <div className="space-y-2">
              {portfolioRecurringPlans.filter(p => p.active).map(plan => {
                const m = workspaceMembers.find(x => x.uid === plan.member_user_id);
                const period = getPeriodBounds(plan.frequency);
                const transferredThisPeriod = portfolioContributions
                  .filter(c => c.member_user_id === plan.member_user_id && c.contribution_type === 'recurring')
                  .filter(c => { const d = new Date(c.contribution_date); return d >= period.start && d <= period.end; })
                  .reduce((s, c) => s + Number(c.amount), 0);
                const remaining = Math.max(0, Number(plan.expected_amount) - transferredThisPeriod);
                const fulfilled = remaining === 0;
                return (
                  <div key={plan.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{m ? memberName(m) : 'Former member'}</p>
                      <p className="text-[10px] text-slate-400">{period.label} · expected {fmt(Number(plan.expected_amount))}{transferredThisPeriod > 0 && !fulfilled ? ` · transferred ${fmt(transferredThisPeriod)} so far` : ''}</p>
                    </div>
                    {fulfilled ? (
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase rounded-full shrink-0">Transferred</span>
                    ) : !isReadOnly ? (
                      <button
                        onClick={() => markTransferred(plan.member_user_id, remaining)}
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

        <div className="apple-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Recurring Contribution Plan</span>
            {!isReadOnly && <button onClick={() => setIsAddingPlan(!isAddingPlan)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Add Plan</button>}
          </div>
          <p className="text-[10px] text-slate-400">What each person is expected to contribute on a schedule — separate from your Bills.</p>

          {isAddingPlan && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!planMemberId || !planAmount) return;
                await runAction(async () => {
                  await addPortfolioRecurringPlan(planMemberId, parseFloat(planAmount), planFrequency, planStartDate, planFrequency === 'monthly' ? parseInt(planDayOfMonth) : undefined, planNotes.trim() || undefined);
                  setPlanAmount(''); setPlanNotes(''); setIsAddingPlan(false);
                });
              }}
              className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-900"
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

        <div className="apple-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Contribution Log</span>
            <div className="flex items-center gap-3">
              {!isReadOnly && <button onClick={() => setIsAddingContribution(!isAddingContribution)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Log Contribution</button>}
              {!isReadOnly && <button onClick={() => setIsAddingWithdrawal(!isAddingWithdrawal)} className="text-[10px] font-bold text-rose-500 cursor-pointer">+ Log Withdrawal</button>}
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
              </select>
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

        <div className="apple-card p-4 space-y-3">
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

      {planTab === 'settings' && (
        <>
        <div className="apple-card p-4 space-y-3">
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
              className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-900"
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
            <div className="pt-2 border-t border-slate-100 dark:border-slate-900 space-y-1">
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

        <div className="apple-card p-4 space-y-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Cash Balance</span>
          <p className="text-[9px] text-slate-400">Uninvested cash sitting in each location - contributed but not yet deployed into holdings.</p>
          <div className="grid grid-cols-2 gap-2">
            {CASH_LOCATIONS.map(loc => {
              const existing = portfolioCashBalances.find((c: any) => c.location === loc);
              const isEditing = editingCashLocation === loc;
              return (
                <div key={loc} className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">{loc}</span>
                  {isEditing ? (
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        value={cashAmountInput}
                        onChange={(e) => setCashAmountInput(e.target.value)}
                        autoFocus
                        className="w-full px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
                      />
                      <button
                        onClick={() => runAction(async () => {
                          await setPortfolioCashBalance(loc, parseFloat(cashAmountInput) || 0);
                          setEditingCashLocation(null);
                        })}
                        className="p-1.5 bg-indigo-600 text-white rounded-md cursor-pointer shrink-0"
                      ><CheckCircle2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingCashLocation(null)} className="p-1.5 text-slate-400 cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900 dark:text-white">{fmt(Number(existing?.amount ?? 0))}</span>
                      {!isReadOnly && (
                        <button
                          onClick={() => { setEditingCashLocation(loc); setCashAmountInput(String(existing?.amount ?? '')); }}
                          className="text-slate-300 hover:text-indigo-500 cursor-pointer"
                        ><Edit2 className="w-3 h-3" /></button>
                      )}
                    </div>
                  )}
                  {existing?.as_of_date && <span className="text-[8px] text-slate-400 block mt-1">as of {existing.as_of_date}</span>}
                </div>
              );
            })}
          </div>
          <div className="pt-1 flex justify-between text-xs">
            <span className="font-bold text-slate-500">Total Cash</span>
            <span className="font-black text-slate-900 dark:text-white">{fmt(portfolioCashBalances.reduce((s: number, c: any) => s + Number(c.amount), 0))}</span>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
