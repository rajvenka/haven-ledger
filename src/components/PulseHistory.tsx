/**
 * Pulse Payment History — Pulse 1 redesign.
 */
import React, { useMemo, useState } from 'react';
import { Search, X, Trash2, History } from 'lucide-react';
import { PaymentHistory, Currency, CountryConfig } from '../types';
import { formatCurrencyValue, convertCurrency } from '../utils/paymentUtils';

interface Props {
  history: PaymentHistory[];
  onDeleteHistoryEntry: (id: string) => void;
  onUpdateHistoryStatus?: (id: string, status: 'paid' | 'delayed' | 'carry') => void;
  onClearHistory?: () => void;
  rate: number;
  summaryCurrency: Currency;
  countries: CountryConfig[];
}

export default function PulseHistory({
  history,
  onDeleteHistoryEntry,
  onUpdateHistoryStatus,
  onClearHistory,
  summaryCurrency,
  countries,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'delayed' | 'carry'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history
      .filter((h) => {
        const st = h.status || 'paid';
        if (statusFilter !== 'all' && st !== statusFilter) return false;
        if (q) {
          const hay = `${h.paymentName} ${h.currency} ${h.paidDate} ${h.taggedFor || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.paidDate.localeCompare(a.paidDate));
  }, [history, search, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, PaymentHistory[]>();
    filtered.forEach((h) => {
      const key = h.paidDate.slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const totalConverted = useMemo(() => {
    return filtered.reduce((sum, h) => {
      const v = convertCurrency(h.amount, h.currency, summaryCurrency, countries);
      return sum + (Number.isFinite(v) ? v : h.amount);
    }, 0);
  }, [filtered, summaryCurrency, countries]);

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full">
      <div className="shrink-0 px-3 sm:px-4 pt-2 pb-2 space-y-2.5">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/20 p-3 sm:p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <History className="w-5 h-5 text-sky-500 shrink-0" />
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Payment history
                </h1>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-sky-600/90 text-white">
                  Pulse
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                {filtered.length} of {history.length}
                {filtered.length > 0 ? ` · ${formatCurrencyValue(totalConverted, summaryCurrency)}` : ''}
              </p>
            </div>
            {onClearHistory && history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Clear all payment history?')) onClearHistory();
                }}
                className="shrink-0 text-[10px] font-bold text-rose-500 px-2 py-1 rounded-lg border border-rose-200/60 dark:border-rose-900/40"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-3 sm:px-4 pb-2 space-y-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, date, currency…"
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px] font-medium"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-500/80 w-10">
            Status
          </span>
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100/90 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800">
            {(['all', 'paid', 'delayed', 'carry'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold capitalize transition-all ${
                  statusFilter === s
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-md'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 pb-28 space-y-4 pt-3">
        {grouped.length === 0 ? (
          <div className="text-center py-14">
            <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-[13px] font-bold text-slate-500">No history match</p>
          </div>
        ) : (
          grouped.map(([month, items]) => (
            <section key={month} className="space-y-1.5">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-0.5">
                {month}
              </h2>
              <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {items.map((log) => {
                  const st = log.status || 'paid';
                  const statusCls =
                    st === 'delayed'
                      ? 'text-amber-600'
                      : st === 'carry'
                        ? 'text-sky-600'
                        : 'text-emerald-600';
                  return (
                    <li key={log.id} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">
                          {log.paymentName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {log.paidDate}
                          {log.taggedFor ? ` · ${log.taggedFor}` : ''}
                          <span className={`ml-1.5 font-bold capitalize ${statusCls}`}>{st}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-black tabular-nums">
                          {formatCurrencyValue(log.amount, log.currency)}
                        </p>
                        {log.currency !== summaryCurrency && (
                          <p className="text-[9px] text-slate-400">
                            ~
                            {formatCurrencyValue(
                              convertCurrency(log.amount, log.currency, summaryCurrency, countries),
                              summaryCurrency
                            )}
                          </p>
                        )}
                      </div>
                      {onUpdateHistoryStatus && (
                        <select
                          value={st}
                          onChange={(e) =>
                            onUpdateHistoryStatus(log.id, e.target.value as 'paid' | 'delayed' | 'carry')
                          }
                          className="text-[9px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-1 py-1 max-w-[4.5rem]"
                        >
                          <option value="paid">Paid</option>
                          <option value="delayed">Delayed</option>
                          <option value="carry">Carry</option>
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete this log?')) onDeleteHistoryEntry(log.id);
                        }}
                        className="p-1.5 text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
