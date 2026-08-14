/**
 * Pulse Spend — next-gen Expenses (currency tiles + clean bill list).
 * Classic ExpensesView remains available.
 */
import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  Plus,
  Globe,
  CreditCard,
  Check,
  ChevronRight,
  Wallet,
  Search,
  X,
} from 'lucide-react';
import { RecurringPayment, CountryConfig, PaymentHistory, getCategoryColor } from '../types';
import {
  formatCurrencyValue,
  getDaysUntilPayment,
  getNextPaymentDate,
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
  const [paidFilter, setPaidFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [tileFilter, setTileFilter] = useState<{
    group: 'dd' | 'manual_monthly' | 'non_monthly';
    bucket: 'paid' | 'to_pay' | 'next';
  } | null>(null);
  /** Mobile: shared metric slide (0=paid, 1=to_pay, 2=next) — all 3 method tiles move together */
  const [metricIdx, setMetricIdx] = useState(0);
  const [justPaidIds, setJustPaidIds] = useState<Record<string, true>>({});
  const flashPaid = useCallback((id: string) => {
    setJustPaidIds((prev) => ({ ...prev, [id]: true }));
    window.setTimeout(() => {
      setJustPaidIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 600);
  }, []);
  const recordPaymentUi = useCallback(
    async (payment: RecurringPayment) => {
      await onRecordPayment(payment);
      flashPaid(payment.id);
    },
    [onRecordPayment, flashPaid]
  );

  const metricTouchX = useRef<number | null>(null);
  const METRIC_SLIDES = [
    { bucket: 'paid' as const, label: 'This month paid', tone: 'text-emerald-600 dark:text-emerald-400' },
    { bucket: 'to_pay' as const, label: 'This month to pay', tone: 'text-rose-600 dark:text-rose-400' },
    { bucket: 'next' as const, label: 'Next month', tone: 'text-amber-600 dark:text-amber-400' },
  ] as const;

  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'today' | 'soon' | 'unpaid' | 'paid'>('all');
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
    const from = String(fromCurr || '').toUpperCase();
    const to = String(toCurr || '').toUpperCase();
    if (from === to) return amount;
    const fromCountry = countries.find((c) => String(c.currency || '').toUpperCase() === from);
    const toCountry = countries.find((c) => String(c.currency || '').toUpperCase() === to);
    if (!fromCountry || !toCountry) return amount;
    const audAmount = amount / fromCountry.rateToAUD;
    return audAmount * toCountry.rateToAUD;
  };

  const filteredPayments = useMemo(() => {
    const active = payments.filter((p) => p.active);
    if (isAll) return active;
    return active.filter((p) => String(p.currency || '').toUpperCase() === String(activeCurrency).toUpperCase());
  }, [payments, isAll, activeCurrency]);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextM = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  const nextY = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();

  const paidSoFar = history
    .filter((h) => h.paidDate.startsWith(currentMonthStr))
    .reduce((sum, h) => {
      if (isAll) return sum + convertCurrency(h.amount, h.currency, defaultCurrency);
      return String(h.currency || '').toUpperCase() === String(activeCurrency).toUpperCase() ? sum + h.amount : sum;
    }, 0);

  const dueOpen = filteredPayments.filter((p) => !isPaymentPaidForCurrentPeriod(p, history));
  const dueTotal = dueOpen.reduce((sum, p) => {
    if (isAll) return sum + convertCurrency(p.amount, p.currency, defaultCurrency);
    return sum + p.amount;
  }, 0);

  const displayCcy = isAll ? defaultCurrency : activeCurrency;

  const isMonthlyCycle = (cycle?: string) => {
    const c = String(cycle || 'monthly').toLowerCase();
    return c === 'monthly' || c === 'weekly';
  };
  const groupOf = (p: RecurringPayment): 'dd' | 'manual_monthly' | 'non_monthly' => {
    const method = String(p.paymentMethod || 'manual').toLowerCase();
    if (method === 'direct_debit' || method === 'dd') return 'dd';
    if (!isMonthlyCycle(p.billingCycle)) return 'non_monthly';
    return 'manual_monthly';
  };
  const sortedAll = [...filteredPayments].sort((a, b) => getDaysUntilPayment(a) - getDaysUntilPayment(b));
  const q = searchQ.trim().toLowerCase();
  const sorted = sortedAll.filter((p) => {
    const paid = isPaymentPaidForCurrentPeriod(p, history);
    const days = getDaysUntilPayment(p);
    if (tileFilter) {
      if (groupOf(p) !== tileFilter.group) return false;
      if (tileFilter.bucket === 'paid' && !paid) return false;
      if (tileFilter.bucket === 'to_pay' && paid) return false;
      if (tileFilter.bucket === 'next') {
        try {
          const d = getNextPaymentDate(p, now, history);
          if (!(d.getFullYear() === nextY && d.getMonth() === nextM)) return false;
        } catch {
          return false;
        }
      }
    } else {
      if (paidFilter === 'unpaid' && paid) return false;
      if (paidFilter === 'paid' && !paid) return false;
    }
    // Status badge filters
    if (statusFilter === 'overdue' && (paid || days >= 0)) return false;
    if (statusFilter === 'today' && (paid || days !== 0)) return false;
    if (statusFilter === 'soon' && (paid || days <= 0 || days > 3)) return false;
    if (statusFilter === 'unpaid' && paid) return false;
    if (statusFilter === 'paid' && !paid) return false;
    if (!q) return true;
    const hay = [p.name, p.category, p.taggedFor, p.currency, p.paymentMethod, p.notes]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  const openCounts = {
    overdue: sortedAll.filter((p) => !isPaymentPaidForCurrentPeriod(p, history) && getDaysUntilPayment(p) < 0).length,
    today: sortedAll.filter((p) => !isPaymentPaidForCurrentPeriod(p, history) && getDaysUntilPayment(p) === 0).length,
    soon: sortedAll.filter((p) => {
      if (isPaymentPaidForCurrentPeriod(p, history)) return false;
      const d = getDaysUntilPayment(p);
      return d > 0 && d <= 3;
    }).length,
    unpaid: sortedAll.filter((p) => !isPaymentPaidForCurrentPeriod(p, history)).length,
    paid: sortedAll.filter((p) => isPaymentPaidForCurrentPeriod(p, history)).length,
  };

  const groups = {
    dd: sorted.filter((p) => groupOf(p) === 'dd'),
    manual_monthly: sorted.filter((p) => groupOf(p) === 'manual_monthly'),
    non_monthly: sorted.filter((p) => groupOf(p) === 'non_monthly'),
  };

  const amt = (payment: RecurringPayment) =>
    isAll ? convertCurrency(payment.amount, payment.currency, defaultCurrency) : Number(payment.amount) || 0;
  const isNextMonthDue = (payment: RecurringPayment) => {
    try {
      const d = getNextPaymentDate(payment, now, history);
      return d.getFullYear() === nextY && d.getMonth() === nextM;
    } catch {
      return false;
    }
  };
  const baseGroup = {
    dd: filteredPayments.filter((payment) => groupOf(payment) === 'dd'),
    manual_monthly: filteredPayments.filter((payment) => groupOf(payment) === 'manual_monthly'),
    non_monthly: filteredPayments.filter((payment) => groupOf(payment) === 'non_monthly'),
  };
  const tileFor = (items: RecurringPayment[]) => {
    const paidItems = items.filter((payment) => isPaymentPaidForCurrentPeriod(payment, history));
    const toPayItems = items.filter((payment) => !isPaymentPaidForCurrentPeriod(payment, history));
    const nextItems = items.filter((payment) => isNextMonthDue(payment));
    return {
      paidSum: paidItems.reduce((s, payment) => s + amt(payment), 0),
      paidCount: paidItems.length,
      toPaySum: toPayItems.reduce((s, payment) => s + amt(payment), 0),
      toPayCount: toPayItems.length,
      nextSum: nextItems.reduce((s, payment) => s + amt(payment), 0),
      nextCount: nextItems.length,
    };
  };
  const tilesDd = tileFor(baseGroup.dd);
  const tilesManual = tileFor(baseGroup.manual_monthly);
  const tilesOneOff = tileFor(baseGroup.non_monthly);

  const markAllDdDone = async () => {
    for (const p of groups.dd) {
      if (isPaymentPaidForCurrentPeriod(p, history)) continue;
      if (isPaymentReadOnly(p)) continue;
      await recordPaymentUi(p);
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-left">
      {/* Single scroll surface: sticky filters live INSIDE it */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 pt-3 pb-24 md:pb-6">
        {/* Title */}
        <div className="flex items-start justify-between gap-3 mb-2">
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

        {/* Currency filter — top */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-3">
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400/80">Ccy</span>
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-900/50">
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

        {/* Overall still due / paid */}
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Still due</p>
            <p className="mt-0.5 text-lg font-black tabular-nums text-slate-900 dark:text-white">
              {formatCurrencyValue(dueTotal, displayCcy as any, countries)}
            </p>
            <p className="text-[10px] text-slate-500">{dueOpen.length} open · {displayCcy}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Paid this month</p>
            <p className="mt-0.5 text-lg font-black tabular-nums text-slate-900 dark:text-white">
              {formatCurrencyValue(paidSoFar, displayCcy as any, countries)}
            </p>
            <p className="text-[10px] text-slate-500">{displayCcy}</p>
          </div>
        </div>

        {/* Method tiles
            Mobile: 1 row × 3 method tiles; swipe changes metric (paid / to-pay / next) on ALL three together
            Desktop (lg): 3 columns, each with all 3 metrics stacked
        */}
        {(() => {
          const rows = (
            [
              { key: 'dd' as const, title: 'Direct debit', short: 'DD', t: tilesDd, accent: 'sky' },
              { key: 'manual' as const, title: 'Manual monthly', short: 'Manual', t: tilesManual, accent: 'violet' },
              { key: 'oneoff' as const, title: 'One-off / non-monthly', short: 'One-off', t: tilesOneOff, accent: 'slate' },
            ] as const
          ).filter((row) => row.t.paidCount + row.t.toPayCount + row.t.nextCount > 0);
          if (!rows.length) return null;

          const chipOf = (accent: string) =>
            accent === 'sky'
              ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200/70 dark:border-sky-900/50'
              : accent === 'violet'
                ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-200/70 dark:border-violet-900/50'
                : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800';
          const headOf = (accent: string) =>
            accent === 'sky'
              ? 'text-sky-700 dark:text-sky-300'
              : accent === 'violet'
                ? 'text-violet-700 dark:text-violet-300'
                : 'text-slate-600 dark:text-slate-300';
          const groupOfKey = (key: string) =>
            key === 'dd' ? 'dd' : key === 'manual' ? 'manual_monthly' : 'non_monthly';
          const sumFor = (row: (typeof rows)[number], bucket: 'paid' | 'to_pay' | 'next') => {
            if (bucket === 'paid') return { sum: row.t.paidSum, count: row.t.paidCount };
            if (bucket === 'to_pay') return { sum: row.t.toPaySum, count: row.t.toPayCount };
            return { sum: row.t.nextSum, count: row.t.nextCount };
          };

          const slide = METRIC_SLIDES[metricIdx] || METRIC_SLIDES[0];
          const goMetric = (dir: number) => {
            setMetricIdx((i) => (i + dir + METRIC_SLIDES.length) % METRIC_SLIDES.length);
          };

          return (
            <div className="mb-3 space-y-2">
              {/* Mobile: one row, shared metric */}
              <div
                className="lg:hidden"
                onTouchStart={(e) => {
                  metricTouchX.current = e.changedTouches[0]?.clientX ?? null;
                }}
                onTouchEnd={(e) => {
                  const startX = metricTouchX.current;
                  metricTouchX.current = null;
                  if (startX == null) return;
                  const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
                  if (Math.abs(dx) < 40) return;
                  goMetric(dx < 0 ? 1 : -1);
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
                  <p className={`text-[10px] font-black uppercase tracking-wider ${slide.tone}`}>{slide.label}</p>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => goMetric(-1)} className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400">‹</button>
                    {METRIC_SLIDES.map((s, i) => (
                      <button
                        key={s.bucket}
                        type="button"
                        onClick={() => setMetricIdx(i)}
                        className={`h-1.5 rounded-full transition-all ${i === metricIdx ? 'w-4 bg-indigo-500' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`}
                        aria-label={s.label}
                      />
                    ))}
                    <button type="button" onClick={() => goMetric(1)} className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400">›</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {rows.map((row) => {
                    const g = groupOfKey(row.key) as 'dd' | 'manual_monthly' | 'non_monthly';
                    const { sum, count } = sumFor(row, slide.bucket);
                    const active = tileFilter?.group === g && tileFilter?.bucket === slide.bucket;
                    return (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setTileFilter(null);
                            return;
                          }
                          setTileFilter({ group: g, bucket: slide.bucket });
                          setPaidFilter('all');
                          setStatusFilter('all');
                        }}
                        className={`hv-press hv-chip-on rounded-2xl border p-2.5 text-left ${chipOf(row.accent)} ${
                          active ? 'ring-2 ring-indigo-500 shadow-md' : ''
                        }`}
                      >
                        <p className={`text-[9px] font-black uppercase tracking-wider ${headOf(row.accent)}`}>{row.short}</p>
                        <p className="mt-1 text-[13px] font-black tabular-nums text-slate-900 dark:text-white leading-tight">
                          {formatCurrencyValue(sum, displayCcy as any, countries)}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-0.5">{count} bills</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] text-slate-400 text-center mt-1.5">Swipe · all three methods stay on the same metric</p>
              </div>

              {/* Desktop: 3 columns × all metrics */}
              <div className="hidden lg:grid lg:grid-cols-3 lg:gap-3">
                {rows.map((row) => (
                  <div key={row.key} className="min-w-0">
                    <p className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${headOf(row.accent)}`}>{row.title}</p>
                    <div className="flex flex-col gap-2">
                      {METRIC_SLIDES.map((tile) => {
                        const g = groupOfKey(row.key) as 'dd' | 'manual_monthly' | 'non_monthly';
                        const { sum, count } = sumFor(row, tile.bucket);
                        const active = tileFilter?.group === g && tileFilter?.bucket === tile.bucket;
                        return (
                          <button
                            key={tile.bucket}
                            type="button"
                            onClick={() => {
                              if (active) {
                                setTileFilter(null);
                                return;
                              }
                              setTileFilter({ group: g, bucket: tile.bucket });
                              setPaidFilter('all');
                              setStatusFilter('all');
                            }}
                            className={`hv-press hv-chip-on w-full rounded-2xl border p-3 text-left ${chipOf(row.accent)} ${
                              active ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:shadow-sm'
                            }`}
                          >
                            <p className={`text-[9px] font-black uppercase tracking-wider ${tile.tone}`}>{tile.label}</p>
                            <p className="mt-1 text-[15px] font-black tabular-nums text-slate-900 dark:text-white">
                              {formatCurrencyValue(sum, displayCcy as any, countries)}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{count} bills</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* FLOATING / STICKY filter bar — first sticky child of the scroller */}
        <div
          className="sticky top-0 z-30 -mx-4 sm:-mx-5 px-4 sm:px-5 py-2.5 space-y-2 mb-3
            bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl
            border-b border-slate-200 dark:border-slate-800
            shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)]"
        >
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search bills, category, tag…"
              className="w-full pl-9 pr-9 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 shadow-sm"
            />
            {searchQ && (
              <button type="button" onClick={() => setSearchQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status badges — clickable */}
          <div className="flex flex-wrap gap-1.5">
            {([
              ['overdue', 'Overdue', openCounts.overdue, 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/20'],
              ['today', 'Today', openCounts.today, 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20'],
              ['soon', 'Soon', openCounts.soon, 'bg-orange-500/15 text-orange-700 dark:text-orange-400 ring-1 ring-orange-500/20'],
              ['unpaid', 'Open', openCounts.unpaid, 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'],
              ['paid', 'Paid', openCounts.paid, 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/20'],
            ] as const).map(([id, lab, count, cls]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setStatusFilter((prev) => (prev === id ? 'all' : id));
                  if (id === 'paid') setPaidFilter('paid');
                  else setPaidFilter('unpaid');
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${cls} ${
                  statusFilter === id ? 'ring-2 ring-offset-1 ring-offset-slate-50 dark:ring-offset-slate-950 ring-violet-500' : ''
                }`}
              >
                {lab} <span className="tabular-nums">{count}</span>
              </button>
            ))}
          </div>

          {/* Show: All / To be paid / Paid */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">Show</span>
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              {([
                ['all', 'All'],
                ['unpaid', 'To be paid'],
                ['paid', 'Paid'],
              ] as const).map(([id, lab]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setPaidFilter(id);
                    setTileFilter(null);
                    if (id === 'all') setStatusFilter('all');
                  }}
                  className={`hv-press px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
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
        </div>

        {tileFilter && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/80 dark:bg-indigo-950/30 px-3 py-2">
            <p className="text-[11px] font-bold text-indigo-800 dark:text-indigo-200">Filtered by tile</p>
            <button type="button" onClick={() => setTileFilter(null)} className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Clear</button>
          </div>
        )}

        {/* Grouped lists */}
        {(
          [
            { key: 'dd' as const, title: 'Direct debit', items: groups.dd, accent: 'border-sky-200 dark:border-sky-900/50', head: 'text-sky-700 dark:text-sky-300' },
            { key: 'manual_monthly' as const, title: 'Manual monthly', items: groups.manual_monthly, accent: 'border-violet-200 dark:border-violet-900/50', head: 'text-violet-700 dark:text-violet-300' },
            { key: 'non_monthly' as const, title: 'Non-monthly', items: groups.non_monthly, accent: 'border-slate-200 dark:border-slate-800', head: 'text-slate-700 dark:text-slate-300' },
          ] as const
        ).map((group) => {
          if (group.items.length === 0) return null;
          return (
            <div key={group.key} className={`rounded-2xl border ${group.accent} bg-white dark:bg-slate-900 overflow-hidden mb-3`}>
              <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <p className={`text-[11px] font-black ${group.head}`}>{group.title}</p>
                  <p className="text-[9px] text-slate-500">
                    {group.key === 'dd'
                      ? 'Bank takes these automatically — tap DD done when settled'
                      : group.key === 'manual_monthly'
                        ? 'You pay these each month'
                        : 'Other schedules'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400">{group.items.length}</span>
                  {group.key === 'dd' && !isReadOnly && (
                    <button
                      type="button"
                      onClick={() => markAllDdDone()}
                      className="hv-press px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide bg-sky-600 text-white hover:bg-sky-700"
                    >
                      All DD done
                    </button>
                  )}
                </div>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {group.items.map((p) => {
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
                    <li key={p.id} className={`hv-row px-3.5 py-2.5 flex items-center gap-3 ${statusStyle.row} ${justPaidIds[p.id] ? 'hv-success-flash' : ''}`}>
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
                          {group.key === 'dd' && (
                            <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/25">
                              DD
                            </span>
                          )}
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
                            onClick={() => recordPaymentUi(p)}
                            className={`hv-press inline-flex items-center gap-0.5 text-[9px] font-bold mt-0.5 ${
                              group.key === 'dd' ? 'text-sky-600' : 'text-emerald-600'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            {group.key === 'dd' ? 'DD done?' : 'Pay'}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="px-3.5 py-10 text-center text-[12px] text-slate-400 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            No active expenses in this currency
          </p>
        )}
      </div>
    </div>
  );
}
