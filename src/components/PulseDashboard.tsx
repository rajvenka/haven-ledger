/**
 * Pulse — next-gen Dashboard (summary-first, Canva-clean).
 * Classic Dashboard remains available; toggle Classic ↔ Pulse.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  Wallet,
  ArrowUpRight,
  Sparkles,
  Bell,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import {
  RecurringPayment,
  PaymentHistory,
  Currency,
  CountryConfig,
  IncomeSource,
} from '../types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  convertCurrency,
  formatCurrencyValue,
  getScheduledInstancesForRange,
  formatDatePretty,
} from '../utils/paymentUtils';

interface Props {
  payments: RecurringPayment[];
  history: PaymentHistory[];
  countries: CountryConfig[];
  summaryCurrency: Currency;
  onRecordPayment: (payment: RecurringPayment, dueDate?: string) => void;
  onNavigateToBills?: () => void;
  isReadOnly?: boolean;
  currentUserUid?: string;
  monthlyIncomeEstimate?: number;
  incomeSources?: IncomeSource[];
}

function money(n: number, ccy: string, countries: CountryConfig[]) {
  return formatCurrencyValue(n, ccy as Currency, countries);
}

type DueStatus = 'overdue' | 'today' | 'soon' | 'upcoming';

function dueStatus(dueDate: string, todayStr: string): DueStatus {
  if (dueDate < todayStr) return 'overdue';
  if (dueDate === todayStr) return 'today';
  const due = new Date(dueDate + 'T12:00:00');
  const today = new Date(todayStr + 'T12:00:00');
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days <= 3) return 'soon';
  return 'upcoming';
}

const STATUS_UI: Record<DueStatus, { label: string; dot: string; badge: string; row: string; avatar: string }> = {
  overdue: {
    label: 'Overdue',
    dot: 'bg-rose-500',
    badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/25',
    row: 'border-l-[3px] border-l-rose-500 bg-rose-500/[0.04]',
    avatar: 'bg-rose-500 text-white',
  },
  today: {
    label: 'Due today',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/25',
    row: 'border-l-[3px] border-l-amber-500 bg-amber-500/[0.04]',
    avatar: 'bg-amber-500 text-white',
  },
  soon: {
    label: 'Due soon',
    dot: 'bg-orange-500',
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 ring-1 ring-orange-500/25',
    row: 'border-l-[3px] border-l-orange-400 bg-orange-500/[0.03]',
    avatar: 'bg-orange-500/90 text-white',
  },
  upcoming: {
    label: 'Upcoming',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/20',
    row: 'border-l-[3px] border-l-indigo-400/80',
    avatar: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
  },
};


export default function PulseDashboard({
  payments,
  history,
  countries = [],
  summaryCurrency,
  onRecordPayment,
  onNavigateToBills,
  isReadOnly = false,
  currentUserUid,
  monthlyIncomeEstimate = 0,
}: Props) {
  const [paidFilter, setPaidFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [taggedForFilter, setTaggedForFilter] = useState<string>('all');
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<DueStatus | 'all'>('all');
  const isPaymentReadOnly = (payment?: RecurringPayment) => {
    if (!payment) return true;
    if (!isReadOnly) return false;
    if (currentUserUid && payment.userId === currentUserUid) return false;
    return true;
  };

  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const startOfOverdue = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const allUpcoming = useMemo(
    () => getScheduledInstancesForRange(payments, history, startOfOverdue, endOfNextMonth),
    [payments, history]
  );
  const currentMonthInstances = useMemo(
    () => getScheduledInstancesForRange(payments, history, startOfCurrentMonth, endOfCurrentMonth),
    [payments, history]
  );

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nextWeekDate = new Date(now);
  nextWeekDate.setDate(now.getDate() + 7);
  const nextWeekStr = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;

  const dueNextWeek = allUpcoming.filter(
    (ins) => ins.status !== 'paid' && ins.dueDate >= todayStr && ins.dueDate <= nextWeekStr
  );
  const dueCurrentMonth = currentMonthInstances.filter((ins) => ins.status !== 'paid');
  const overdue = allUpcoming.filter((ins) => ins.status !== 'paid' && ins.dueDate < todayStr);

  const sumConverted = (list: typeof allUpcoming) =>
    list.reduce((s, ins) => s + convertCurrency(ins.amount, ins.currency, summaryCurrency, countries), 0);

  const totalDueWeek = sumConverted(dueNextWeek);
  const totalDueMonth = sumConverted(dueCurrentMonth);
  const totalOverdue = sumConverted(overdue);
  const paidThisMonth = currentMonthInstances
    .filter((ins) => ins.status === 'paid')
    .reduce((s, ins) => s + convertCurrency(ins.amount, ins.currency, summaryCurrency, countries), 0);

  const paidCount = currentMonthInstances.filter((ins) => ins.status === 'paid').length;
  const totalCount = currentMonthInstances.length;
  const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
  const net = monthlyIncomeEstimate - totalDueMonth;

  // 6-month spend trend from history
  const trendData = useMemo(() => {
    const data: { label: string; Spent: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString(undefined, { month: 'short' });
      const spent = history
        .filter((h) => h.paidDate.startsWith(key))
        .reduce((s, h) => s + convertCurrency(h.amount, h.currency, summaryCurrency, countries), 0);
      data.push({ label, Spent: Math.round(spent * 100) / 100 });
    }
    return data;
  }, [history, countries, summaryCurrency]);

  const monthLabel = now.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const upcomingList = [...dueNextWeek, ...overdue]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const isMonthlyCycle = (cycle?: string) => {
    const c = String(cycle || 'monthly').toLowerCase();
    return c === 'monthly' || c === 'weekly';
  };

  const groupOf = (ins: any): 'dd' | 'manual_monthly' | 'non_monthly' => {
    const method = String(ins.paymentMethod || payments.find((p) => p.id === ins.paymentId)?.paymentMethod || 'manual').toLowerCase();
    if (method === 'direct_debit' || method === 'dd') return 'dd';
    const cycle = ins.billingCycle || payments.find((p) => p.id === ins.paymentId)?.billingCycle || 'monthly';
    if (!isMonthlyCycle(cycle)) return 'non_monthly';
    return 'manual_monthly';
  };

  // Paid this month instances for "Paid" filter
  const paidThisMonthInstances = currentMonthInstances.filter((ins) => ins.status === 'paid');

  const listBase =
    paidFilter === 'paid'
      ? paidThisMonthInstances
      : paidFilter === 'unpaid'
        ? upcomingList
        : [...upcomingList, ...paidThisMonthInstances].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const q = searchQ.trim().toLowerCase();
  const passesStatusSearch = (ins: (typeof listBase)[number]) => {
    if (statusFilter !== 'all' && paidFilter !== 'paid') {
      const st = dueStatus(ins.dueDate, todayStr);
      if (st !== statusFilter) return false;
    }
    if (!q) return true;
    const payment = payments.find((p) => p.id === ins.paymentId);
    const hay = [
      ins.paymentName,
      payment?.name,
      payment?.category,
      payment?.taggedFor,
      ins.currency,
      ins.paymentMethod,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  };
  const taggedForOptions = useMemo(() => {
    const set = new Set<string>();
    listBase.filter(passesStatusSearch).forEach((ins) => {
      const payment = payments.find((p) => p.id === ins.paymentId);
      set.add((payment?.taggedFor || 'Self').trim() || 'Self');
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listBase, statusFilter, paidFilter, q, payments]);
  useEffect(() => {
    if (taggedForFilter !== 'all' && !taggedForOptions.includes(taggedForFilter)) {
      setTaggedForFilter('all');
    }
  }, [taggedForFilter, taggedForOptions]);
  const listForFilter = listBase.filter((ins) => {
    if (!passesStatusSearch(ins)) return false;
    const payment = payments.find((p) => p.id === ins.paymentId);
    if (taggedForFilter !== 'all' && (payment?.taggedFor || 'Self').trim() !== taggedForFilter) return false;
    return true;
  });

  const statusCounts = {
    overdue: listBase.filter((ins) => ins.status !== 'paid' && dueStatus(ins.dueDate, todayStr) === 'overdue').length,
    today: listBase.filter((ins) => ins.status !== 'paid' && dueStatus(ins.dueDate, todayStr) === 'today').length,
    soon: listBase.filter((ins) => ins.status !== 'paid' && dueStatus(ins.dueDate, todayStr) === 'soon').length,
    upcoming: listBase.filter((ins) => ins.status !== 'paid' && dueStatus(ins.dueDate, todayStr) === 'upcoming').length,
  };

  const groupedUpcoming = {
    dd: listForFilter.filter((ins) => groupOf(ins) === 'dd'),
    manual_monthly: listForFilter.filter((ins) => groupOf(ins) === 'manual_monthly'),
    non_monthly: listForFilter.filter((ins) => groupOf(ins) === 'non_monthly'),
  };

  const markDdDone = async (list: typeof upcomingList) => {
    for (const ins of list) {
      const payment = payments.find((p) => p.id === ins.paymentId);
      if (payment && !isPaymentReadOnly(payment)) {
        await onRecordPayment(payment, ins.dueDate);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 sm:px-5 pt-4 pb-24 md:pb-6 space-y-4 text-left bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">Pulse</h1>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-600 text-white">
              New
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{monthLabel} · {summaryCurrency}</p>
        </div>
        {onNavigateToBills && (
          <button
            type="button"
            onClick={onNavigateToBills}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400"
          >
            All bills <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Hero metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 col-span-2 lg:col-span-1 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-slate-900">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <p className="text-[9px] font-black uppercase tracking-wider text-indigo-500">Due this month</p>
          </div>
          <p className="mt-1 text-xl font-black tabular-nums text-slate-900 dark:text-white">
            {money(totalDueMonth, summaryCurrency, countries)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{dueCurrentMonth.length} open bills</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <p className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Next 7 days</p>
          </div>
          <p className="mt-1 text-lg font-black tabular-nums text-slate-900 dark:text-white">
            {money(totalDueWeek, summaryCurrency, countries)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{dueNextWeek.length} due</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Paid this month</p>
          </div>
          <p className="mt-1 text-lg font-black tabular-nums text-slate-900 dark:text-white">
            {money(paidThisMonth, summaryCurrency, countries)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {paidCount}/{totalCount} bills
          </p>
        </div>
        <div className={`rounded-2xl border p-3.5 ${
          net >= 0
            ? 'border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20'
            : 'border-rose-200/80 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20'
        }`}>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <p className={`text-[9px] font-black uppercase tracking-wider ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              After bills
            </p>
          </div>
          <p className={`mt-1 text-lg font-black tabular-nums ${net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
            {money(net, summaryCurrency, countries)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">vs income estimate</p>
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">Month progress</p>
          <span className="text-[11px] font-bold tabular-nums text-slate-500">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        {totalOverdue > 0 && (
          <p className="mt-2 text-[10px] font-bold text-rose-500 flex items-center gap-1">
            <Bell className="w-3 h-3" />
            {money(totalOverdue, summaryCurrency, countries)} overdue ({overdue.length})
          </p>
        )}
      </div>

      {/* Trend */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-500" />
          <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">Spend pulse · 6 months</p>
        </div>
        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pulseSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" width={40} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  fontSize: 11,
                }}
                formatter={(v: number) => money(v, summaryCurrency, countries)}
              />
              <Area type="monotone" dataKey="Spent" stroke="#8b5cf6" fill="url(#pulseSpend)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="search"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search bills, category, tag…"
          className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
        {searchQ && (
          <button
            type="button"
            onClick={() => setSearchQ('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Status summary badges (click to filter) */}
      {paidFilter !== 'paid' && (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'All open', listBase.filter((i) => i.status !== 'paid').length, 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'],
              ['overdue', 'Overdue', statusCounts.overdue, 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/20'],
              ['today', 'Today', statusCounts.today, 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20'],
              ['soon', 'Soon', statusCounts.soon, 'bg-orange-500/15 text-orange-700 dark:text-orange-400 ring-1 ring-orange-500/20'],
              ['upcoming', 'Later', statusCounts.upcoming, 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/20'],
            ] as const
          ).map(([id, lab, count, cls]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id as DueStatus | 'all')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${cls} ${
                statusFilter === id ? 'ring-2 ring-offset-1 ring-offset-slate-50 dark:ring-offset-slate-950 ring-violet-500' : ''
              }`}
            >
              {lab}
              <span className="tabular-nums opacity-80">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* For Whom — clickable, only shown when there's more than one tag to filter by */}
      {taggedForOptions.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 self-center mr-0.5">For</span>
          <button
            type="button"
            onClick={() => setTaggedForFilter('all')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
              taggedForFilter === 'all'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            All
          </button>
          {taggedForOptions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTaggedForFilter((prev) => (prev === tag ? 'all' : tag))}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                taggedForFilter === tag
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                  : 'bg-violet-500/15 text-violet-700 dark:text-violet-400'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Paid filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">Show</span>
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {([
            ['all', 'All'],
            ['unpaid', 'To be paid'],
            ['paid', 'Paid'],
          ] as const).map(([id, lab]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPaidFilter(id)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                paidFilter === id
                  ? id === 'unpaid'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                    : id === 'paid'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                      : 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-md'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {lab}
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming — grouped */}
      <div className="space-y-3">
        {(
          [
            {
              key: 'dd' as const,
              title: 'Direct debit',
              hint: 'Usually auto-paid — confirm when the bank has taken it',
              items: groupedUpcoming.dd,
              accent: 'border-sky-200 dark:border-sky-900/50',
              header: 'text-sky-700 dark:text-sky-300',
            },
            {
              key: 'manual_monthly' as const,
              title: 'Manual monthly',
              hint: 'You pay these each month',
              items: groupedUpcoming.manual_monthly,
              accent: 'border-violet-200 dark:border-violet-900/50',
              header: 'text-violet-700 dark:text-violet-300',
            },
            {
              key: 'non_monthly' as const,
              title: 'Non-monthly',
              hint: 'Weekly, quarterly, yearly, one-off…',
              items: groupedUpcoming.non_monthly,
              accent: 'border-slate-200 dark:border-slate-800',
              header: 'text-slate-700 dark:text-slate-300',
            },
          ] as const
        ).map((group) => {
          if (group.items.length === 0) return null;
          const show = group.items.slice(0, group.key === 'dd' ? 12 : 8);
          return (
            <div
              key={group.key}
              className={`rounded-2xl border ${group.accent} bg-white dark:bg-slate-900 overflow-hidden`}
            >
              <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-[11px] font-black ${group.header}`}>{group.title}</p>
                    <p className="text-[9px] text-slate-500">{group.hint}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400">{group.items.length}</span>
                    {group.key === 'dd' && (
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => markDdDone(group.items)}
                        className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                        title="Mark all visible direct debits as done for their due date"
                      >
                        All DD done
                      </button>
                    )}
                  </div>
                </div>
                {group.key === 'dd' && (
                  <p className="text-[9px] text-sky-600/80 dark:text-sky-400/80">
                    Tip: set payment method to Direct Debit on each bill so it lands here. One tap confirms the bank already paid it.
                  </p>
                )}
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {show.map((ins) => {
                  const status = dueStatus(ins.dueDate, todayStr);
                  const ui = STATUS_UI[status];
                  const payment = payments.find((p) => p.id === ins.paymentId);
                  const label = String(ins.paymentName || payment?.name || 'Bill').trim();
                  const initials = label
                    .split(' ')
                    .filter(Boolean)
                    .map((w: string) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  const due = new Date(ins.dueDate + 'T12:00:00');
                  const today = new Date(todayStr + 'T12:00:00');
                  const dayDiff = Math.round((due.getTime() - today.getTime()) / 86400000);
                  const dayLabel =
                    status === 'overdue'
                      ? `${Math.abs(dayDiff)}d late`
                      : status === 'today'
                        ? 'Today'
                        : dayDiff === 1
                          ? 'Tomorrow'
                          : `in ${dayDiff}d`;
                  return (
                    <li
                      key={`${ins.paymentId}-${ins.dueDate}`}
                      className={`px-3.5 py-3 flex items-center gap-3 ${ui.row}`}
                    >
                      <div className="relative shrink-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black ${ui.avatar}`}
                          title={label}
                        >
                          {initials || '·'}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${ui.dot}`}
                          title={ui.label}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate leading-snug">
                          {label}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md ${ui.badge}`}>
                            {ui.label}
                          </span>
                          {group.key === 'dd' && (
                            <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/25">
                              DD
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-slate-500">{dayLabel}</span>
                          <span className="text-[10px] text-slate-400">·</span>
                          <span className="text-[10px] text-slate-500">
                            {formatDatePretty(new Date(ins.dueDate))}
                          </span>
                          {ins.currency && (
                            <>
                              <span className="text-[10px] text-slate-400">·</span>
                              <span className="text-[10px] font-bold text-slate-400">{ins.currency}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-black tabular-nums text-slate-900 dark:text-white">
                          {money(ins.amount, ins.currency, countries)}
                        </p>
                        {ins.status === 'paid' ? (
                          <span className="text-[10px] font-bold text-emerald-600 mt-0.5">Paid</span>
                        ) : payment && !isPaymentReadOnly(payment) ? (
                          <button
                            type="button"
                            onClick={() => onRecordPayment(payment, ins.dueDate)}
                            className={`text-[10px] font-bold mt-0.5 hover:underline ${
                              group.key === 'dd'
                                ? 'text-sky-600 dark:text-sky-400'
                                : 'text-indigo-600 dark:text-indigo-400'
                            }`}
                          >
                            {group.key === 'dd' ? 'DD done?' : 'Mark paid'}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {group.items.length > show.length && (
                <p className="px-3.5 py-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                  +{group.items.length - show.length} more
                </p>
              )}
            </div>
          );
        })}
        {listForFilter.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 px-3.5 py-8 text-center text-[12px] text-slate-400">
            {paidFilter === 'paid'
              ? 'No paid bills logged this month yet'
              : paidFilter === 'unpaid'
                ? 'Nothing left to pay — nice 🎉'
                : 'No bills in this view'}
          </div>
        )}
      </div>

    </div>
  );
}
