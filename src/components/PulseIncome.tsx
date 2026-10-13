/**
 * Pulse Income — new design.
 * Monthly income vs bills (this month), savings rate, source cards, bottom-sheet add form. Mobile-first.
 */
import React, { useMemo, useState } from 'react';
import { Briefcase, CreditCard, ArrowDownLeft, TrendingUp, RefreshCw, Coins, Plus, Trash2, Wallet, Pencil, X } from 'lucide-react';
import { IncomeSource, Currency, CountryConfig, RecurringPayment, PaymentHistory } from '../types';
import { convertCurrency } from '../utils/paymentUtils';

interface Props {
  pulseMode?: boolean;
  incomeSources: IncomeSource[];
  incomeMode?: 'simple' | 'detailed';
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

const CAT: Record<IncomeSource['category'], { label: string; Icon: any; tint: string }> = {
  salary: { label: 'Salary', Icon: Briefcase, tint: 'text-indigo-600 bg-indigo-500/10' },
  cashback: { label: 'Cashback', Icon: CreditCard, tint: 'text-emerald-600 bg-emerald-500/10' },
  borrowing: { label: 'Borrowing', Icon: ArrowDownLeft, tint: 'text-amber-600 bg-amber-500/10' },
  investment: { label: 'Investment', Icon: TrendingUp, tint: 'text-violet-600 bg-violet-500/10' },
  refund: { label: 'Refund', Icon: RefreshCw, tint: 'text-sky-600 bg-sky-500/10' },
  other: { label: 'Other', Icon: Coins, tint: 'text-slate-600 bg-slate-500/10' },
};
const FREQ: Record<IncomeSource['frequency'], string> = {
  weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', adhoc: 'Ad hoc', 'one-time': 'One-time',
};
const toMonthly = (s: IncomeSource) =>
  s.frequency === 'weekly' ? s.amount * 4.33 : s.frequency === 'fortnightly' ? s.amount * 2.17 : s.frequency === 'monthly' ? s.amount : 0;

export default function PulseIncome({
  incomeSources, monthlyIncome, summaryCurrency, countries, history,
  addIncomeSource, deleteIncomeSource, updateIncomeMode, updateMonthlyIncome, isReadOnly = false,
}: Props) {
  const symbol = countries.find((c) => c.currency === summaryCurrency)?.symbol || (summaryCurrency === 'AUD' ? 'A$' : summaryCurrency === 'INR' ? '₹' : '$');
  const money = (n: number) => `${symbol}${Math.round(n).toLocaleString()}`;

  const [sheet, setSheet] = useState(false);
  const [editTotal, setEditTotal] = useState(false);
  const [tempTotal, setTempTotal] = useState(monthlyIncome);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<IncomeSource['frequency']>('monthly');
  const [category, setCategory] = useState<IncomeSource['category']>('salary');
  const [payDate, setPayDate] = useState('');
  const [busy, setBusy] = useState(false);

  const sourcesTotal = useMemo(() => incomeSources.reduce((s, x) => s + toMonthly(x), 0), [incomeSources]);
  const total = incomeSources.length ? sourcesTotal : parseFloat(monthlyIncome) || 0;

  const spent = useMemo(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return history.reduce((sum, h) => {
      if (!h.paidDate?.startsWith(key)) return sum;
      const v = convertCurrency(Number(h.amount) || 0, h.currency, summaryCurrency, countries);
      return sum + (Number.isFinite(v) ? v : Number(h.amount) || 0);
    }, 0);
  }, [history, summaryCurrency, countries]);

  const left = total - spent;
  const usedPct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  const savePct = total > 0 ? (left / total) * 100 : 0;

  const byCat = useMemo(() => {
    const m = new Map<IncomeSource['category'], number>();
    incomeSources.forEach((s) => { const v = toMonthly(s); if (v) m.set(s.category, (m.get(s.category) || 0) + v); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [incomeSources]);

  const sync = async (list: IncomeSource[]) => {
    const sum = list.reduce((a, s) => a + toMonthly(s), 0);
    await updateMonthlyIncome(String(Math.round(sum * 100) / 100));
    try { await updateIncomeMode(list.length ? 'detailed' : 'simple'); } catch { /* optional */ }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isReadOnly || !name.trim() || !Number.isFinite(amt) || amt <= 0) return;
    setBusy(true);
    try {
      const src = {
        name: name.trim(), amount: amt, currency: summaryCurrency, frequency, category,
        isRecurring: frequency !== 'one-time' && frequency !== 'adhoc', payDate: payDate || undefined,
      } as any;
      await addIncomeSource(src);
      await sync([...incomeSources, { ...src, id: 'tmp' } as IncomeSource]);
      setName(''); setAmount(''); setPayDate(''); setFrequency('monthly'); setCategory('salary'); setSheet(false);
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (isReadOnly || !confirm('Remove this income source?')) return;
    await deleteIncomeSource(id);
    await sync(incomeSources.filter((s) => s.id !== id));
  };

  const saveTotal = async () => {
    const n = parseFloat(tempTotal);
    if (!Number.isFinite(n) || n < 0) return;
    await updateMonthlyIncome(String(n));
    try { await updateIncomeMode('simple'); } catch { /* ignore */ }
    setEditTotal(false);
  };

  const field = 'w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-medium';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full">
      <div className="px-3 sm:px-4 pt-2 pb-32 md:pb-8 space-y-3 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-500" /> Income
            </h1>
            <p className="text-[11px] text-slate-500 font-semibold">Monthly estimate · {summaryCurrency}</p>
          </div>
          {!isReadOnly && (
            <button type="button" onClick={() => setSheet(true)} className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-black bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
              <Plus className="w-4 h-4" /> Add source
            </button>
          )}
        </div>

        {/* Hero */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-white to-emerald-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly income</p>
          {editTotal && !incomeSources.length ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-black text-slate-400">{symbol}</span>
              <input autoFocus type="number" inputMode="decimal" value={tempTotal} onChange={(e) => setTempTotal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveTotal()}
                className="flex-1 min-w-0 text-3xl font-black bg-transparent border-b-2 border-indigo-500 outline-none tabular-nums" />
              <button type="button" onClick={saveTotal} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-[12px] font-black">Save</button>
            </div>
          ) : (
            <div className="mt-1 flex items-end gap-3 flex-wrap">
              <p className="text-4xl font-black tracking-tight tabular-nums text-slate-900 dark:text-white">{money(total)}</p>
              {!isReadOnly && !incomeSources.length && (
                <button type="button" onClick={() => { setTempTotal(monthlyIncome || String(total)); setEditTotal(true); }} className="mb-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
          )}
          <p className="text-[11px] text-slate-500 mt-1">
            {incomeSources.length ? `From ${incomeSources.length} source${incomeSources.length > 1 ? 's' : ''} · feeds Dashboard cashflow` : 'Set one figure, or add sources for a breakdown.'}
          </p>
        </div>

        {/* This month */}
        {total > 0 && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">This month</p>
              <p className="text-[11px] font-bold text-slate-500">{usedPct.toFixed(0)}% of income spent</p>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-2 overflow-hidden">
              <div className={`h-full rounded-full ${usedPct > 90 ? 'bg-rose-500' : usedPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${usedPct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Income</p><p className="text-[15px] font-black tabular-nums">{money(total)}</p></div>
              <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Paid out</p><p className="text-[15px] font-black tabular-nums">{money(spent)}</p></div>
              <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Left</p>
                <p className={`text-[15px] font-black tabular-nums ${left < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{left < 0 ? '-' : ''}{money(Math.abs(left))}</p>
                <p className="text-[9px] text-slate-400 font-semibold">{savePct.toFixed(0)}% saved</p></div>
            </div>
          </div>
        )}

        {/* Mix */}
        {byCat.length > 1 && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Where it comes from</p>
            {byCat.map(([k, v]) => {
              const { label, Icon, tint } = CAT[k];
              const pct = sourcesTotal > 0 ? (v / sourcesTotal) * 100 : 0;
              return (
                <div key={k} className="flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tint}`}><Icon className="w-3.5 h-3.5" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[12px] font-bold"><span>{label}</span><span className="tabular-nums">{money(v)} · {pct.toFixed(0)}%</span></div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sources */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-0.5">Sources</p>
          {incomeSources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
              <p className="text-[13px] font-bold text-slate-500">No income sources yet</p>
              {!isReadOnly && <button type="button" onClick={() => setSheet(true)} className="mt-2 text-[12px] font-black text-indigo-600">+ Add your first source</button>}
            </div>
          ) : (
            <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {incomeSources.map((s) => {
                const { Icon, tint, label } = CAT[s.category] || CAT.other;
                return (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tint}`}><Icon className="w-4 h-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold truncate">{s.name}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{label} · {FREQ[s.frequency]}{s.payDate ? ` · ${s.payDate}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-black tabular-nums">{money(s.amount)}</p>
                      {(s.frequency === 'weekly' || s.frequency === 'fortnightly') && <p className="text-[9px] text-slate-400">≈ {money(toMonthly(s))}/mo</p>}
                    </div>
                    {!isReadOnly && (<button type="button" onClick={() => remove(s.id)} aria-label="Remove" className="p-2 text-rose-500"><Trash2 className="w-4 h-4" /></button>)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Mobile FAB */}
      {!isReadOnly && (
        <button type="button" onClick={() => setSheet(true)} aria-label="Add income source"
          className="sm:hidden fixed right-4 z-20 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/40 flex items-center justify-center"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}>
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Add sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setSheet(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-4 space-y-3 max-h-[90vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black">Add income source</h2>
              <button type="button" onClick={() => setSheet(false)} className="p-2"><X className="w-4 h-4" /></button>
            </div>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Salary – Acme)" className={field} />
            <div className="flex gap-2">
              <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Amount (${symbol})`} className={field} />
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={field} aria-label="Pay date (optional)" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">How often</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(FREQ) as IncomeSource['frequency'][]).map((f) => (
                  <button key={f} type="button" onClick={() => setFrequency(f)} className={`px-3 py-2 rounded-full text-[12px] font-bold border ${frequency === f ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent' : 'border-slate-200 dark:border-slate-700'}`}>{FREQ[f]}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Type</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(CAT) as IncomeSource['category'][]).map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(c)} className={`px-3 py-2 rounded-full text-[12px] font-bold border ${category === c ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent' : 'border-slate-200 dark:border-slate-700'}`}>{CAT[c].label}</button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={busy || !name.trim() || !(parseFloat(amount) > 0)} className="w-full py-3.5 rounded-xl bg-indigo-600 text-white text-[14px] font-black disabled:opacity-40">
              {busy ? 'Saving…' : 'Add source'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
