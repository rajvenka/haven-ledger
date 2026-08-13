import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  CreditCard,
  ArrowDownLeft,
  TrendingUp,
  RefreshCw,
  Coins,
  Plus,
  Trash2,
  Check,
  Calendar,
  Wallet,
  Pencil,
} from 'lucide-react';
import { IncomeSource, Currency, CountryConfig, RecurringPayment, PaymentHistory } from '../types';
import { convertCurrency } from '../utils/paymentUtils';

interface IncomeViewProps {
  pulseMode?: boolean;
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

const CATEGORY_META: Record<
  IncomeSource['category'],
  { label: string; icon: any; tint: string }
> = {
  salary: { label: 'Salary & wages', icon: Briefcase, tint: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10' },
  cashback: { label: 'Cashback & rewards', icon: CreditCard, tint: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  borrowing: { label: 'Borrowing', icon: ArrowDownLeft, tint: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  investment: { label: 'Investment yield', icon: TrendingUp, tint: 'text-violet-600 dark:text-violet-400 bg-violet-500/10' },
  refund: { label: 'Refunds', icon: RefreshCw, tint: 'text-sky-600 dark:text-sky-400 bg-sky-500/10' },
  other: { label: 'Other', icon: Coins, tint: 'text-slate-600 dark:text-slate-300 bg-slate-500/10' },
};

const FREQUENCY_LABEL: Record<IncomeSource['frequency'], string> = {
  weekly: '/week',
  fortnightly: '/fortnight',
  monthly: '/month',
  adhoc: 'ad hoc',
  'one-time': 'one-time',
};

function toMonthly(source: IncomeSource): number {
  switch (source.frequency) {
    case 'weekly':
      return source.amount * 4.33;
    case 'fortnightly':
      return source.amount * 2.17;
    case 'monthly':
      return source.amount;
    default:
      return 0;
  }
}

type Period = 'month' | 'quarter' | 'year' | 'custom';

function getPeriodRange(
  period: Period,
  customStart: string,
  customEnd: string
): { start: Date; end: Date; label: string } {
  const now = new Date();
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end, label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  }
  if (period === 'quarter') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end, label: 'Last 3 months' };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start, end, label: String(now.getFullYear()) };
  }
  const start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = customEnd ? new Date(customEnd) : now;
  return { start, end, label: 'Custom' };
}

export default function IncomeView({
  pulseMode = false,
  incomeSources,
  monthlyIncome,
  summaryCurrency,
  countries,
  payments,
  history,
  addIncomeSource,
  deleteIncomeSource,
  updateIncomeMode,
  updateMonthlyIncome,
  isReadOnly = false,
}: IncomeViewProps) {
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [tempMonthly, setTempMonthly] = useState(monthlyIncome);
  const [totalError, setTotalError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(summaryCurrency);
  const [frequency, setFrequency] = useState<IncomeSource['frequency']>('monthly');
  const [category, setCategory] = useState<IncomeSource['category']>('salary');
  const [payDate, setPayDate] = useState('');
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const symbol =
    countries.find((c) => c.currency === summaryCurrency)?.symbol ||
    (summaryCurrency === 'AUD' ? 'A$' : summaryCurrency === 'INR' ? '₹' : '$');

  const sourcesInDisplayCcy = useMemo(() => {
    // IncomeSource has no currency field in the database - there's no per-source currency
    // concept yet, income is always implicitly in the workspace's display currency. This
    // used to branch on s.currency, which was always undefined, so it silently always took
    // the "different currency" path and called convertCurrency with an undefined fromCurr -
    // harmless after the earlier defensive fix (falls through to the raw value unchanged),
    // but dishonest about what was actually happening. Simplified to match reality.
    return incomeSources.map((s) => ({ ...s, monthlyDisplay: toMonthly(s) }));
  }, [incomeSources]);

  const sourcesMonthlyTotal = useMemo(
    () => sourcesInDisplayCcy.reduce((sum, s) => sum + (s.monthlyDisplay || 0), 0),
    [sourcesInDisplayCcy]
  );

  /** Prefer sum of sources when present; otherwise the single monthly figure. */
  const displayTotal =
    incomeSources.length > 0 ? sourcesMonthlyTotal : parseFloat(monthlyIncome) || 0;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    sourcesInDisplayCcy.forEach((s) => {
      if (!s.monthlyDisplay) return;
      map.set(s.category, (map.get(s.category) || 0) + s.monthlyDisplay);
    });
    return Array.from(map.entries())
      .map(([key, value]) => ({ key, value, ...CATEGORY_META[key as IncomeSource['category']] }))
      .sort((a, b) => b.value - a.value);
  }, [sourcesInDisplayCcy]);

  const periodRange = getPeriodRange(period, customStart, customEnd);

  const expenseInPeriod = useMemo(() => {
    let total = 0;
    history.forEach((h) => {
      const d = new Date(h.paidDate);
      if (d < periodRange.start || d > periodRange.end) return;
      const pay = payments.find((p) => p.id === h.paymentId);
      const ccy = (pay?.currency || summaryCurrency) as Currency;
      const amt =
        ccy === summaryCurrency
          ? Number(h.amount) || 0
          : convertCurrency(Number(h.amount) || 0, ccy, summaryCurrency, countries);
      total += amt;
    });
    return total;
  }, [history, payments, periodRange, summaryCurrency, countries]);

  const monthsInPeriod = useMemo(() => {
    const ms = periodRange.end.getTime() - periodRange.start.getTime();
    return Math.max(1, Math.round(ms / (30.44 * 24 * 3600 * 1000)));
  }, [periodRange]);

  const incomeInPeriod = displayTotal * monthsInPeriod;
  const coveragePct = incomeInPeriod > 0 ? Math.min(999, (expenseInPeriod / incomeInPeriod) * 100) : 0;

  const syncMonthlyFromSources = async (list: IncomeSource[]) => {
    // Same simplification as sourcesInDisplayCcy above - no per-source currency field exists.
    const sum = list.reduce((acc, s) => acc + toMonthly(s), 0);
    await updateMonthlyIncome(String(Math.round(sum * 100) / 100));
    try {
      await updateIncomeMode(list.length > 0 ? 'detailed' : 'simple');
    } catch {
      /* mode is optional persistence */
    }
  };

  const handleSaveTotal = async () => {
    const n = parseFloat(tempMonthly);
    if (!Number.isFinite(n) || n < 0) {
      setTotalError('Enter a valid amount');
      return;
    }
    setTotalError(null);
    await updateMonthlyIncome(String(n));
    try {
      await updateIncomeMode('simple');
    } catch {
      /* ignore */
    }
    setIsEditingTotal(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const amt = parseFloat(amount);
    if (!name.trim() || !Number.isFinite(amt) || amt <= 0) return;
    const src: Omit<IncomeSource, 'id'> = {
      name: name.trim(),
      amount: amt,
      currency,
      frequency,
      category,
      isRecurring: frequency !== 'one-time' && frequency !== 'adhoc',
      payDate: payDate || undefined,
    } as any;
    await addIncomeSource(src);
    await syncMonthlyFromSources([...incomeSources, { ...src, id: 'tmp' } as IncomeSource]);
    setName('');
    setAmount('');
    setPayDate('');
    setFrequency('monthly');
    setCategory('salary');
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (isReadOnly) return;
    if (!confirm('Remove this income source?')) return;
    await deleteIncomeSource(id);
    const next = incomeSources.filter((s) => s.id !== id);
    await syncMonthlyFromSources(next);
  };

  const card =
    pulseMode
      ? 'rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900'
      : 'apple-card';

  const showPayDateField = frequency === 'monthly' || frequency === 'adhoc' || frequency === 'one-time';

  return (
    <div
      className={`w-full max-w-full min-w-0 space-y-4 px-3 sm:px-4 pt-2 sm:pt-3 pb-24 sm:pb-6 ${
        pulseMode ? 'bg-slate-50 dark:bg-slate-950 min-h-full' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Wallet className={`w-5 h-5 ${pulseMode ? 'text-emerald-500' : 'text-indigo-500'}`} />
            Income
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Monthly estimate for cashflow · {summaryCurrency}
          </p>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" /> Add source
          </button>
        )}
      </div>

      {/* Hero total */}
      <div className={`${card} p-4 sm:p-5`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly income</p>
        {isEditingTotal && incomeSources.length === 0 ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl font-black text-slate-400">{symbol}</span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              value={tempMonthly}
              onChange={(e) => setTempMonthly(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTotal()}
              className="flex-1 text-3xl font-black bg-transparent border-b-2 border-indigo-500 outline-none text-slate-900 dark:text-white tabular-nums"
            />
            <button
              type="button"
              onClick={handleSaveTotal}
              className="p-2 rounded-lg bg-indigo-600 text-white"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="mt-1 flex items-end gap-2 flex-wrap">
            <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
              {symbol}
              {displayTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            {!isReadOnly && incomeSources.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  setTempMonthly(monthlyIncome || String(displayTotal));
                  setIsEditingTotal(true);
                }}
                className="mb-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-500"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
        )}
        {totalError && <p className="text-[10px] text-rose-500 font-semibold mt-1">{totalError}</p>}
        <p className="text-[11px] text-slate-500 mt-2">
          {incomeSources.length === 0
            ? 'Set a single monthly figure, or add sources below for a breakdown.'
            : `From ${incomeSources.length} source${incomeSources.length === 1 ? '' : 's'} · totals feed Dashboard cashflow`}
        </p>
      </div>

      {/* Category split */}
      {byCategory.length > 0 && (
        <div className={`${card} p-4 space-y-3`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">By category</p>
          <div className="flex flex-wrap gap-2">
            {byCategory.map((c) => {
              const Icon = c.icon || Coins;
              return (
                <div
                  key={c.key}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold ${c.tint}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {c.label}
                  <span className="opacity-80 tabular-nums">
                    {symbol}
                    {c.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spend coverage */}
      <div className={`${card} p-4 space-y-3`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Spend vs income
          </p>
          <div className="inline-flex p-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            {(['month', 'quarter', 'year', 'custom'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${
                  period === p
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                    : 'text-slate-500'
                }`}
              >
                {p === 'quarter' ? '3 mo' : p}
              </button>
            ))}
          </div>
        </div>
        {period === 'custom' && (
          <div className="flex gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Income · {periodRange.label}</p>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {symbol}
              {incomeInPeriod.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Logged spend</p>
            <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
              {symbol}
              {expenseInPeriod.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              coveragePct > 100 ? 'bg-rose-500' : coveragePct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, coveragePct)}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500">
          {coveragePct === 0 && expenseInPeriod === 0
            ? 'No spend logged in this period yet.'
            : coveragePct > 100
              ? `Spend is ${Math.round(coveragePct - 100)}% over estimated income.`
              : `${Math.round(coveragePct)}% of estimated income spent.`}
        </p>
      </div>

      {/* Sources */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-black text-slate-900 dark:text-white">Sources</p>
            <p className="text-[10px] text-slate-500">Salary, cashback, yields — optional breakdown</p>
          </div>
          <span className="text-[10px] font-bold text-slate-400">{incomeSources.length}</span>
        </div>

        {incomeSources.length === 0 && !isAdding && (
          <div className="px-4 py-8 text-center space-y-2">
            <p className="text-[13px] font-bold text-slate-500">No sources yet</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              A single monthly total is enough for Dashboard. Add sources if you want a split by salary, cashback, etc.
            </p>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-400"
              >
                <Plus className="w-3.5 h-3.5" /> Add first source
              </button>
            )}
          </div>
        )}

        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sourcesInDisplayCcy.map((s) => {
            const meta = CATEGORY_META[s.category] || CATEGORY_META.other;
            const Icon = meta.icon;
            return (
              <li key={s.id} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.tint}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {meta.label} · {s.amount.toLocaleString()} {s.currency}
                    {FREQUENCY_LABEL[s.frequency] || ''}
                    {s.payDate ? ` · ${s.payDate}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-black tabular-nums text-slate-900 dark:text-white">
                    {symbol}
                    {(s.monthlyDisplay || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold">/mo</p>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {isAdding && !isReadOnly && (
          <form onSubmit={handleAdd} className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5 bg-slate-50/50 dark:bg-slate-950/40">
            <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">New source</p>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. Primary salary)"
              className="w-full px-3 py-2 rounded-xl text-[12px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="px-3 py-2 rounded-xl text-[12px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="px-3 py-2 rounded-xl text-[12px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                {Array.from(new Set(countries.map((c) => c.currency))).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as IncomeSource['frequency'])}
                className="px-3 py-2 rounded-xl text-[12px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="adhoc">Ad hoc</option>
                <option value="one-time">One-time</option>
              </select>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as IncomeSource['category'])}
                className="px-3 py-2 rounded-xl text-[12px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
            {showPayDateField && (
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-[12px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600"
              >
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-indigo-600 text-white">
                Save source
              </button>
            </div>
          </form>
        )}

        {!isAdding && incomeSources.length > 0 && !isReadOnly && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 hover:text-indigo-500 hover:border-indigo-300 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add source
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
