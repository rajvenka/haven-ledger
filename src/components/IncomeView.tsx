import React, { useState, useMemo } from 'react';
import {
  Briefcase, CreditCard, ArrowDownLeft, TrendingUp, RefreshCw, Coins,
  Plus, Trash2, Check, ChevronDown
} from 'lucide-react';
import { IncomeSource, Currency, CountryConfig, RecurringPayment } from '../types';
import { formatCurrencyValue, convertCurrency } from '../utils/paymentUtils';

interface IncomeViewProps {
  incomeSources: IncomeSource[];
  incomeMode: 'simple' | 'detailed';
  monthlyIncome: string;
  summaryCurrency: Currency;
  countries: CountryConfig[];
  payments: RecurringPayment[];
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

const FREQUENCY_LABEL: Record<IncomeSource['frequency'], string> = {
  weekly: '/week', fortnightly: '/fortnight', monthly: '/month', adhoc: 'ad hoc', 'one-time': 'one-time',
};

function toMonthly(source: IncomeSource): number {
  switch (source.frequency) {
    case 'weekly': return source.amount * 4.33;
    case 'fortnightly': return source.amount * 2.17;
    case 'monthly': return source.amount;
    default: return 0; // adhoc/one-time don't count toward a steady monthly figure
  }
}

function paymentToMonthly(p: RecurringPayment): number {
  switch (p.billingCycle) {
    case 'weekly': return p.amount * 4.33;
    case 'monthly': return p.amount;
    case '2-months': return p.amount / 2;
    case '3-months': return p.amount / 3;
    case '4-months': return p.amount / 4;
    case '6-months': return p.amount / 6;
    case 'yearly': return p.amount / 12;
    case 'once': return 0;
    default: return p.amount;
  }
}

const CATEGORY_COLORS = ['#007aff', '#34c759', '#ff9500', '#af52de', '#ff2d55', '#5ac8fa', '#ffcc00', '#8e8e93'];

export default function IncomeView({
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
}: IncomeViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [tempMonthly, setTempMonthly] = useState(monthlyIncome);
  const [isEditingSimple, setIsEditingSimple] = useState(false);
  const [simpleError, setSimpleError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<IncomeSource['frequency']>('monthly');
  const [category, setCategory] = useState<IncomeSource['category']>('salary');

  const symbol = countries.find(c => c.currency === summaryCurrency)?.symbol || '$';

  const totalMonthly = useMemo(() => incomeSources.reduce((sum, s) => sum + toMonthly(s), 0), [incomeSources]);
  const canEditAsSingleFigure = incomeSources.length === 0 || (incomeSources.length === 1 && incomeSources[0].isSimpleTotal);
  const incomeValue = parseFloat(monthlyIncome) || 0;

  const categoryBreakdown = useMemo(() => {
    const byCategory: Record<string, number> = {};
    payments.filter(p => p.active).forEach(p => {
      const monthlyAmt = convertCurrency(paymentToMonthly(p), p.currency, summaryCurrency, countries);
      byCategory[p.category] = (byCategory[p.category] || 0) + monthlyAmt;
    });
    return Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount, pct: incomeValue > 0 ? (amount / incomeValue) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments, summaryCurrency, countries, incomeValue]);

  const totalAllocated = categoryBreakdown.reduce((sum, c) => sum + c.amount, 0);
  const unallocated = incomeValue - totalAllocated;

  const handleSaveSimple = async () => {
    setSimpleError(null);
    try {
      await updateMonthlyIncome(tempMonthly);
      setIsEditingSimple(false);
    } catch (err: any) {
      setSimpleError(err.message || 'Could not save.');
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name.trim() || !amt || amt <= 0) return;
    addIncomeSource({ name: name.trim(), amount: amt, frequency, category, isRecurring: frequency !== 'adhoc' && frequency !== 'one-time' });
    setName(''); setAmount(''); setFrequency('monthly'); setCategory('salary');
    setIsAdding(false);
  };

  return (
    <div className="space-y-5 text-left animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Income</h2>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">What's coming in, alongside what's going out</p>
        </div>
        {!isReadOnly && (
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg text-[11px] font-bold gap-0.5">
            <button
              onClick={() => updateIncomeMode('simple')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${incomeMode === 'simple' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}
            >
              Simple
            </button>
            <button
              onClick={() => updateIncomeMode('detailed')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${incomeMode === 'detailed' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}
            >
              Detailed
            </button>
          </div>
        )}
      </div>

      {/* Headline number — one big honest figure, always the same total in both modes */}
      <div className="apple-card p-6">
        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Monthly Income</span>
        {incomeMode === 'simple' && canEditAsSingleFigure ? (
          isEditingSimple ? (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl font-black text-slate-400">{symbol}</span>
              <input
                autoFocus
                type="number"
                value={tempMonthly}
                onChange={(e) => setTempMonthly(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveSimple()}
                className="text-3xl font-black text-slate-900 dark:text-white bg-transparent border-b-2 border-indigo-500 outline-none w-40"
              />
              <button onClick={handleSaveSimple} className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { if (!isReadOnly) { setTempMonthly(monthlyIncome); setIsEditingSimple(true); } }}
              className="flex items-baseline gap-1 mt-2 cursor-pointer text-left"
              disabled={isReadOnly}
            >
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {symbol}{(parseFloat(monthlyIncome) || 0).toLocaleString()}
              </span>
              {!isReadOnly && <span className="text-[10px] text-indigo-500 font-bold ml-2 self-end mb-1.5">tap to edit</span>}
            </button>
          )
        ) : (
          <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mt-2">
            {symbol}{totalMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        )}
        {simpleError && <p className="text-[10px] text-red-500 font-semibold mt-2">{simpleError}</p>}
        <p className="text-[10px] text-slate-400 mt-2">
          {incomeMode === 'simple'
            ? (canEditAsSingleFigure
                ? 'One number, kept simple — switch to Detailed to break it down by source.'
                : `Made up of ${incomeSources.length} sources — switch to Detailed to edit them individually.`)
            : `Same total as Simple mode — ${incomeSources.filter(s => s.isRecurring).length} recurring source(s).`}
        </p>
      </div>

      {/* Where the income goes — allocation by expense category */}
      {incomeValue > 0 && categoryBreakdown.length > 0 && (
        <div className="apple-card p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Where It Goes</span>
            <span className="text-[10px] font-bold text-slate-400">
              {symbol}{totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })} allocated
            </span>
          </div>

          {/* Stacked bar */}
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            {categoryBreakdown.map((c, idx) => (
              <div
                key={c.category}
                style={{ width: `${Math.min(c.pct, 100)}%`, backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                title={`${c.category}: ${c.pct.toFixed(1)}%`}
              />
            ))}
          </div>

          <div className="space-y-2">
            {categoryBreakdown.map((c, idx) => (
              <div key={c.category} className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} />
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex-1 truncate">{c.category}</span>
                <span className="text-[11px] font-bold text-slate-900 dark:text-white">{symbol}{c.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-[9px] font-bold text-slate-400 w-10 text-right">{c.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>

          <div className={`flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] font-black ${unallocated >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            <span>{unallocated >= 0 ? 'Unallocated' : 'Over budget'}</span>
            <span>{symbol}{Math.abs(unallocated).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      )}

      {/* Detailed: list of sources */}
      {incomeMode === 'detailed' && (
        <div className="space-y-3">
          {incomeSources.length === 0 && !isAdding && (
            <div className="apple-card p-8 flex flex-col items-center text-center gap-2">
              <Coins className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No income sources yet</p>
              <p className="text-[10px] text-slate-400 max-w-[220px]">Add your salary, side income, or anything else that comes in regularly.</p>
            </div>
          )}

          {incomeSources.map(source => {
            const Icon = CATEGORY_META[source.category].icon;
            return (
              <div key={source.id} className="apple-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{source.name}</p>
                  <p className="text-[10px] text-slate-400 font-semibold">{CATEGORY_META[source.category].label}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{symbol}{source.amount.toLocaleString()}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{FREQUENCY_LABEL[source.frequency]}</p>
                </div>
                {!isReadOnly && (
                  <button onClick={() => deleteIncomeSource(source.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {!isReadOnly && (
            isAdding ? (
              <form onSubmit={handleAdd} className="apple-card p-4 space-y-3">
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Source name, e.g. Salary"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount"
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as IncomeSource['frequency'])}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly</option>
                    <option value="adhoc">Ad hoc</option>
                    <option value="one-time">One-time</option>
                  </select>
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IncomeSource['category'])}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                >
                  {Object.entries(CATEGORY_META).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit" className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer">Add</button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-500 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Income Source
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
