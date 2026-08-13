/**
 * Pulse — next-gen Dashboard (summary-first, Canva-clean).
 * Classic Dashboard remains available; toggle Classic ↔ Pulse.
 */
import React, { useMemo, useState } from 'react';
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
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);

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
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 col-span-2 lg:col-span-1 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-slate-900">
          <p className="text-[9px] font-black uppercase tracking-wider text-indigo-500">Due this month</p>
          <p className="mt-1 text-xl font-black tabular-nums text-slate-900 dark:text-white">
            {money(totalDueMonth, summaryCurrency, countries)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{dueCurrentMonth.length} open bills</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <p className="text-[9px] font-black uppercase tracking-wider text-amber-500">Next 7 days</p>
          <p className="mt-1 text-lg font-black tabular-nums text-slate-900 dark:text-white">
            {money(totalDueWeek, summaryCurrency, countries)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{dueNextWeek.length} due</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Paid this month</p>
          <p className="mt-1 text-lg font-black tabular-nums text-slate-900 dark:text-white">
            {money(paidThisMonth, summaryCurrency, countries)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {paidCount}/{totalCount} bills
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">After bills</p>
          <p
            className={`mt-1 text-lg font-black tabular-nums ${
              net >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
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

      {/* Upcoming */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">Coming up</p>
          <span className="text-[10px] font-bold text-slate-400">{upcomingList.length}</span>
        </div>
        {upcomingList.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[12px] text-slate-400">Nothing due in the next week 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {upcomingList.map((ins) => {
              const isOd = ins.dueDate < todayStr;
              const payment = payments.find((p) => p.id === ins.paymentId);
              return (
                <li key={`${ins.paymentId}-${ins.dueDate}`} className="px-3.5 py-2.5 flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isOd ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                    }`}
                  >
                    {isOd ? <Bell className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-slate-900 dark:text-white truncate">{ins.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {isOd ? 'Overdue · ' : ''}
                      {formatDatePretty(new Date(ins.dueDate))}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-black tabular-nums text-slate-900 dark:text-white">
                      {money(ins.amount, ins.currency, countries)}
                    </p>
                    {payment && !isPaymentReadOnly(payment) && (
                      <button
                        type="button"
                        onClick={() => onRecordPayment(payment, ins.dueDate)}
                        className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5"
                      >
                        Mark paid
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
