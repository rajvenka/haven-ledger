/**
 * Pulse Income — Pulse 1 redesign (simple + detailed modes, sources, period coverage).
 */
import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Briefcase, CreditCard, ArrowDownLeft, TrendingUp, RefreshCw, Coins, Check, X } from 'lucide-react';
import { IncomeSource, Currency, CountryConfig, RecurringPayment, PaymentHistory } from '../types';
import { convertCurrency } from '../utils/paymentUtils';

interface Props {
  incomeSources: IncomeSource[];
  incomeMode: 'simple' | 'detailed';
  monthlyIncome: string;
  summaryCurrency: Currency;
  countries: CountryConfig[];
  payments: RecurringPayment[];
  history: PaymentHistory[];
  addIncomeSource: (src: Omit<IncomeSource, 'id'>) => void | Promise<void>;
  deleteIncomeSource: (id: string) => void | Promise<void>;
  updateIncomeMode: (mode: 'simple' | 'detailed') => void | Promise<void>;
  updateMonthlyIncome: (val: string) => void | Promise<void>;
  isReadOnly?: boolean;
}

const CATEGORY_META: Record<IncomeSource['category'], { label: string; icon: any }> = {
  salary: { label: 'Salary & Wages', icon: Briefcase },
  cashback: { label: 'Cashback & Rewards', icon: CreditCard },
  borrowing: { label: 'Borrowing', icon: ArrowDownLeft },
  investment: { label: 'Investment Yield', icon: TrendingUp },
  refund: { label: 'Refunds', icon: RefreshCw },
  other: { label: 'Other', icon: Coins },
};

function toMonthly(source: IncomeSource): number {
  switch (source.frequency) {
    case 'weekly': return source.amount * 4.33;
    case 'fortnightly': return source.amount * 2.17;
    case 'monthly': return source.amount;
    default: return 0;
  }
}

export default function PulseIncome({
  incomeSources,
  incomeMode,
  monthlyIncome,
  summaryCurrency,
  countries,
  payments,
  addIncomeSource,
  deleteIncomeSource,
  updateIncomeMode,
  updateMonthlyIncome,
  isReadOnly = false,
}: Props) {
  const [simpleEdit, setSimpleEdit] = useState(false);
  const [tempMonthly, setTempMonthly] = useState(monthlyIncome);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<IncomeSource['frequency']>('monthly');
  const [category, setCategory] = useState<IncomeSource['category']>('salary');
  const [payDate, setPayDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const symbol = countries.find((c) => c.currency === summaryCurrency)?.symbol || '$';
  const totalMonthly = useMemo(
    () => incomeSources.reduce((sum, s) => sum + toMonthly(s), 0),
    [incomeSources]
  );

  const monthlyBills = useMemo(() => {
    return payments
      .filter((p) => p.active)
      .reduce((sum, p) => {
        const cycle = String(p.billingCycle || 'monthly').toLowerCase();
        let m = Number(p.amount) || 0;
        if (cycle === 'weekly') m *= 4.33;
        else if (cycle === 'yearly') m /= 12;
        else if (cycle === '2-months') m /= 2;
        else if (cycle === '3-months') m /= 3;
        else if (cycle === '6-months') m /= 6;
        else if (cycle === 'once') m = 0;
        const converted = convertCurrency(m, p.currency, summaryCurrency, countries);
        return sum + (Number.isFinite(converted) ? converted : m);
      }, 0);
  }, [payments, summaryCurrency, countries]);

  const coverage = totalMonthly > 0 ? (monthlyBills / totalMonthly) * 100 : 0;

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    incomeSources.forEach((s) => {
      map[s.category] = (map[s.category] || 0) + toMonthly(s);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [incomeSources]);

  const saveSimple = async () => {
    setBusy(true);
    setError('');
    try {
      await updateMonthlyIncome(tempMonthly);
      setSimpleEdit(false);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const addSource = async () => {
    if (!name.trim() || !amount) {
      setError('Name and amount required');
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Invalid amount');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await addIncomeSource({
        name: name.trim(),
        amount: n,
        frequency,
        category,
        isRecurring: frequency !== 'adhoc' && frequency !== 'one-time',
        payDate: payDate || undefined,
      } as any);
      setName('');
      setAmount('');
      setPayDate('');
      setAdding(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to add');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full">
      <div className="shrink-0 px-3 sm:px-4 pt-2 pb-2 space-y-2.5">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 p-3 sm:p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Briefcase className="w-5 h-5 text-emerald-500 shrink-0" />
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Income
                </h1>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-white">
                  Pulse
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                {incomeSources.length} source{incomeSources.length === 1 ? '' : 's'} · {summaryCurrency}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400/80 w-10">
            Mode
          </span>
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-900/60">
            <button
              type="button"
              onClick={() => !isReadOnly && updateIncomeMode('simple')}
              className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                incomeMode === 'simple'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-emerald-800/70 dark:text-emerald-300/70'
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => !isReadOnly && updateIncomeMode('detailed')}
              className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                incomeMode === 'detailed'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-emerald-800/70 dark:text-emerald-300/70'
              }`}
            >
              Detailed
            </button>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Monthly income</p>
            <p className="text-[18px] font-black tabular-nums text-slate-900 dark:text-white mt-0.5">
              {symbol}
              {(incomeMode === 'simple' ? Number(monthlyIncome) || 0 : totalMonthly).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Bills coverage</p>
            <p
              className={`text-[18px] font-black tabular-nums mt-0.5 ${
                coverage > 100 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {coverage.toFixed(0)}%
            </p>
            <p className="text-[9px] text-slate-400 font-bold">
              ~{symbol}
              {monthlyBills.toLocaleString(undefined, { maximumFractionDigits: 0 })} bills/mo
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 pb-28 space-y-3 pt-1">
        {incomeMode === 'simple' ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <p className="text-[11px] text-slate-500 font-medium">
              Single monthly figure used for cashflow. Switch to Detailed to track multiple sources.
            </p>
            {simpleEdit ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={tempMonthly}
                  onChange={(e) => setTempMonthly(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[14px] font-bold"
                />
                <button
                  type="button"
                  disabled={busy || isReadOnly}
                  onClick={saveSimple}
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-[11px] font-bold"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setSimpleEdit(false)} className="p-2 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => {
                  setTempMonthly(monthlyIncome);
                  setSimpleEdit(true);
                }}
                className="text-[22px] font-black tabular-nums text-slate-900 dark:text-white"
              >
                {symbol}
                {(Number(monthlyIncome) || 0).toLocaleString()}
                <span className="text-[11px] font-bold text-slate-400 ml-2">tap to edit</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {byCategory.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {byCategory.map(([cat, amt]) => {
                  const meta = CATEGORY_META[cat as IncomeSource['category']] || CATEGORY_META.other;
                  const Icon = meta.icon;
                  return (
                    <div
                      key={cat}
                      className="shrink-0 px-2.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold flex items-center gap-1"
                    >
                      <Icon className="w-3 h-3 text-indigo-500" />
                      {meta.label}
                      <span className="text-slate-400">
                        {symbol}
                        {amt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sources</h2>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-600 text-white"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>

            {incomeSources.length === 0 ? (
              <p className="text-center text-[12px] text-slate-400 py-10">No income sources yet</p>
            ) : (
              <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {incomeSources.map((s) => {
                  const meta = CATEGORY_META[s.category] || CATEGORY_META.other;
                  const Icon = meta.icon;
                  return (
                    <li key={s.id} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{s.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {meta.label} · {s.frequency}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-black tabular-nums">
                          {symbol}
                          {Number(s.amount).toLocaleString()}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold">
                          ~{symbol}
                          {toMonthly(s).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                        </p>
                      </div>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete ${s.name}?`)) deleteIncomeSource(s.id);
                          }}
                          className="p-1.5 text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
        {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Add income source</h2>
              <button type="button" onClick={() => setAdding(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
              />
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="adhoc">Ad hoc</option>
                <option value="one-time">One-time</option>
              </select>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
            >
              {Object.entries(CATEGORY_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
            />
            <button
              type="button"
              disabled={busy}
              onClick={addSource}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-[12px] font-bold disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Add source'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
