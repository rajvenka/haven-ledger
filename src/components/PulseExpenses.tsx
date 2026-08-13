/**
 * Pulse Spend — next-gen Expenses (currency tiles + clean bill list).
 * Classic ExpensesView remains available.
 */
import React, { useMemo, useState } from 'react';
import {
  Plus,
  Globe,
  CreditCard,
  Check,
  ChevronRight,
  Wallet,
} from 'lucide-react';
import { RecurringPayment, CountryConfig, PaymentHistory, getCategoryColor } from '../types';
import {
  formatCurrencyValue,
  getDaysUntilPayment,
  isPaymentPaidForCurrentPeriod,
} from '../utils/paymentUtils';

interface Props {
  payments: RecurringPayment[];
  history: PaymentHistory[];
  countries: CountryConfig[];
  defaultCurrency?: string;
  onAddCountry: (country: Omit<CountryConfig, 'id'>) => Promise<void>;
  onDeleteCountry: (id: string) => Promise<void>;
  onUpdateCountry: (country: CountryConfig) => Promise<void>;
  onAddExpenseClick: (preselectedCurrency: string) => void;
  onRecordPayment: (payment: RecurringPayment) => Promise<void>;
  isReadOnly?: boolean;
  currentUserUid?: string;
}

export default function PulseExpenses({
  payments,
  history,
  countries,
  defaultCurrency = 'AUD',
  onAddExpenseClick,
  onRecordPayment,
  isReadOnly = false,
  currentUserUid,
}: Props) {
  const isPaymentReadOnly = (payment: RecurringPayment) => {
    if (!isReadOnly) return false;
    if (currentUserUid && payment.userId === currentUserUid) return false;
    return true;
  };

  const [activeTabCountryId, setActiveTabCountryId] = useState<string>('ALL');
  const isAll = activeTabCountryId === 'ALL';
  const activeCountry = countries.find((c) => c.id === activeTabCountryId) || countries[0];
  const activeCurrency = isAll ? defaultCurrency : activeCountry?.currency || defaultCurrency;

  const convertCurrency = (amount: number, fromCurr: string, toCurr: string) => {
    if (fromCurr.toUpperCase() === toCurr.toUpperCase()) return amount;
    const fromCountry = countries.find((c) => c.currency.toUpperCase() === fromCurr.toUpperCase());
    const toCountry = countries.find((c) => c.currency.toUpperCase() === toCurr.toUpperCase());
    if (!fromCountry || !toCountry) return amount;
    const audAmount = amount / fromCountry.rateToAUD;
    return audAmount * toCountry.rateToAUD;
  };

  const filteredPayments = useMemo(() => {
    const active = payments.filter((p) => p.active);
    if (isAll) return active;
    return active.filter((p) => p.currency.toUpperCase() === String(activeCurrency).toUpperCase());
  }, [payments, isAll, activeCurrency]);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const paidSoFar = history
    .filter((h) => h.paidDate.startsWith(currentMonthStr))
    .reduce((sum, h) => {
      if (isAll) return sum + convertCurrency(h.amount, h.currency, defaultCurrency);
      return h.currency.toUpperCase() === String(activeCurrency).toUpperCase() ? sum + h.amount : sum;
    }, 0);

  const dueOpen = filteredPayments.filter((p) => !isPaymentPaidForCurrentPeriod(p, history));
  const dueTotal = dueOpen.reduce((sum, p) => {
    if (isAll) return sum + convertCurrency(p.amount, p.currency, defaultCurrency);
    return sum + p.amount;
  }, 0);

  const displayCcy = isAll ? defaultCurrency : activeCurrency;

  const sorted = [...filteredPayments].sort((a, b) => getDaysUntilPayment(a) - getDaysUntilPayment(b));

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 sm:px-5 pt-4 pb-24 md:pb-6 space-y-4 text-left bg-slate-50 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">Spend</h1>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-600 text-white">
              Pulse
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Recurring costs · by currency</p>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => onAddExpenseClick(String(activeCurrency || defaultCurrency))}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      {/* Currency chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400 w-10">Ccy</span>
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/50">
          <button
            type="button"
            onClick={() => setActiveTabCountryId('ALL')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
              isAll ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25' : 'text-emerald-800/70 dark:text-emerald-300/70'
            }`}
          >
            All
          </button>
          {countries.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveTabCountryId(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                activeTabCountryId === c.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-emerald-800/70 dark:text-emerald-300/70'
              }`}
            >
              {c.flag ? `${c.flag} ` : ''}
              {c.currency}
            </button>
          ))}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Still due</p>
          <p className="mt-1 text-xl font-black tabular-nums text-slate-900 dark:text-white">
            {formatCurrencyValue(dueTotal, displayCcy as any, countries)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{dueOpen.length} open</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Paid this month</p>
          <p className="mt-1 text-xl font-black tabular-nums text-slate-900 dark:text-white">
            {formatCurrencyValue(paidSoFar, displayCcy as any, countries)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{displayCcy}</p>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">Bills</p>
          <span className="text-[10px] font-bold text-slate-400">{sorted.length}</span>
        </div>
        {sorted.length === 0 ? (
          <p className="px-3.5 py-10 text-center text-[12px] text-slate-400">No active expenses in this currency</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {sorted.map((p) => {
              const paid = isPaymentPaidForCurrentPeriod(p, history);
              const days = getDaysUntilPayment(p);
              const color = getCategoryColor(p.category);
              const status = paid
                ? 'paid'
                : days < 0
                  ? 'overdue'
                  : days === 0
                    ? 'today'
                    : days <= 3
                      ? 'soon'
                      : 'upcoming';
              const statusStyle =
                status === 'paid'
                  ? { label: 'Paid', badge: 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25', row: 'border-l-[3px] border-l-emerald-500', dot: 'bg-emerald-500' }
                  : status === 'overdue'
                    ? { label: 'Overdue', badge: 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/25', row: 'border-l-[3px] border-l-rose-500 bg-rose-500/[0.03]', dot: 'bg-rose-500' }
                    : status === 'today'
                      ? { label: 'Due today', badge: 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/25', row: 'border-l-[3px] border-l-amber-500', dot: 'bg-amber-500' }
                      : status === 'soon'
                        ? { label: 'Due soon', badge: 'bg-orange-500/15 text-orange-700 ring-1 ring-orange-500/25', row: 'border-l-[3px] border-l-orange-400', dot: 'bg-orange-500' }
                        : { label: 'Upcoming', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-500', row: 'border-l-[3px] border-l-slate-300 dark:border-l-slate-600', dot: 'bg-slate-400' };
              return (
                <li key={p.id} className={`px-3.5 py-2.5 flex items-center gap-3 ${statusStyle.row}`}>
                  <div className="relative shrink-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[10px] font-black"
                      style={{ backgroundColor: color || '#6366f1' }}
                    >
                      {(p.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${statusStyle.dot}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md ${statusStyle.badge}`}>
                        {statusStyle.label}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {p.category || 'General'} · {p.currency}
                        {!paid && days !== 0 && status !== 'overdue' ? ` · in ${days}d` : ''}
                        {status === 'overdue' ? ` · ${Math.abs(days)}d late` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-black tabular-nums text-slate-900 dark:text-white">
                      {formatCurrencyValue(p.amount, p.currency as any, countries)}
                    </p>
                    {!paid && !isPaymentReadOnly(p) && (
                      <button
                        type="button"
                        onClick={() => onRecordPayment(p)}
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 mt-0.5"
                      >
                        <Check className="w-3 h-3" /> Pay
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
