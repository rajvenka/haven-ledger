/**
 * Pulse Payment History — new design.
 * KPIs (this vs last month), 6-month chart, chip filters (status / account / month),
 * month-grouped cards with subtotals, quick status change, delete, CSV export. Mobile-first.
 */
import React, { useMemo, useState } from 'react';
import { Search, X, Trash2, History, Download, TrendingUp, TrendingDown, Check, Clock, ArrowRightCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';
import { PaymentHistory, Currency, CountryConfig } from '../types';
import { formatCurrencyValue, convertCurrency } from '../utils/paymentUtils';

interface Props {
  history: PaymentHistory[];
  onDeleteHistoryEntry: (id: string) => void;
  onUpdateHistoryStatus?: (id: string, status: 'paid' | 'delayed' | 'carry') => void;
  onClearHistory?: () => void;
  rate?: number;
  summaryCurrency: Currency;
  countries: CountryConfig[];
  isReadOnly?: boolean;
}

type St = 'paid' | 'delayed' | 'carry';
const ST_META: Record<St, { label: string; cls: string; Icon: any }> = {
  paid: { label: 'Paid', cls: 'text-emerald-600 bg-emerald-500/10', Icon: Check },
  delayed: { label: 'Delayed', cls: 'text-amber-600 bg-amber-500/10', Icon: Clock },
  carry: { label: 'Carry', cls: 'text-sky-600 bg-sky-500/10', Icon: ArrowRightCircle },
};
const monthLabel = (k: string) =>
  new Date(`${k}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const shortMonth = (k: string) => new Date(`${k}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' });

const Chip: React.FC<{ on: boolean; onClick: () => void; children?: React.ReactNode }> = ({ on, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
      on
        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent shadow-sm'
        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
    }`}
  >
    {children}
  </button>
);

export default function PulseHistory({
  history,
  onDeleteHistoryEntry,
  onUpdateHistoryStatus,
  onClearHistory,
  summaryCurrency,
  countries,
  isReadOnly = false,
}: Props) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | St>('all');
  const [account, setAccount] = useState('all');
  const [month, setMonth] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const conv = (h: PaymentHistory) => {
    const v = convertCurrency(Number(h.amount) || 0, h.currency, summaryCurrency, countries);
    return Number.isFinite(v) ? v : Number(h.amount) || 0;
  };
  const fmt = (n: number) => formatCurrencyValue(n, summaryCurrency);

  const accounts = useMemo(() => {
    const s = new Set<string>();
    history.forEach((h) => h.taggedFor && s.add(h.taggedFor));
    return Array.from(s).sort();
  }, [history]);

  const months = useMemo(() => {
    const s = new Set<string>();
    history.forEach((h) => h.paidDate && s.add(h.paidDate.slice(0, 7)));
    return Array.from(s).sort().reverse();
  }, [history]);

  const kpi = useMemo(() => {
    const now = new Date();
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const cur = key(now);
    const prev = key(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    let c = 0, p = 0, cn = 0;
    const byMonth = new Map<string, number>();
    history.forEach((h) => {
      const k = h.paidDate?.slice(0, 7);
      if (!k) return;
      const v = conv(h);
      byMonth.set(k, (byMonth.get(k) || 0) + v);
      if (k === cur) { c += v; cn++; }
      if (k === prev) p += v;
    });
    const series = Array.from({ length: 6 }, (_, i) => {
      const k = key(new Date(now.getFullYear(), now.getMonth() - (5 - i), 1));
      return { k, name: shortMonth(k), value: Math.round(byMonth.get(k) || 0), cur: k === cur };
    });
    const pct = p > 0 ? ((c - p) / p) * 100 : null;
    return { c, p, cn, pct, series };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, summaryCurrency, countries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history
      .filter((h) => {
        const st = h.status || 'paid';
        if (status !== 'all' && st !== status) return false;
        if (account !== 'all' && (h.taggedFor || '') !== account) return false;
        if (month !== 'all' && h.paidDate?.slice(0, 7) !== month) return false;
        if (q && !`${h.paymentName} ${h.currency} ${h.paidDate} ${h.taggedFor || ''}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.paidDate.localeCompare(a.paidDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, search, status, account, month]);

  const grouped = useMemo(() => {
    const map = new Map<string, PaymentHistory[]>();
    filtered.forEach((h) => {
      const k = h.paidDate.slice(0, 7);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(h);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const total = filtered.reduce((s, h) => s + conv(h), 0);
  const hasFilter = search || status !== 'all' || account !== 'all' || month !== 'all';
  const reset = () => { setSearch(''); setStatus('all'); setAccount('all'); setMonth('all'); };

  const exportCsv = () => {
    const rows = [['Date', 'Payment', 'Account', 'Status', 'Amount', 'Currency', `Amount (${summaryCurrency})`]];
    filtered.forEach((h) =>
      rows.push([h.paidDate, h.paymentName, h.taggedFor || '', h.status || 'paid', String(h.amount), h.currency, conv(h).toFixed(2)])
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `payment-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="flex-1 min-h-0 h-full overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full">
      <div className="px-3 sm:px-4 pt-2 pb-28 md:pb-8 space-y-3 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-sky-500" /> Payment history
            </h1>
            <p className="text-[11px] text-slate-500 font-semibold">{history.length} payments logged · {summaryCurrency}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={exportCsv} disabled={!filtered.length}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-[11px] font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            {!isReadOnly && onClearHistory && history.length > 0 && (
              <button type="button" onClick={() => { if (confirm('Clear ALL payment history? This cannot be undone.')) onClearHistory(); }}
                className="px-3 py-2 rounded-full text-[11px] font-bold text-rose-500 border border-rose-200/70 dark:border-rose-900/40">
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* KPIs + chart */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">This month</p>
            <p className="text-lg font-black tabular-nums mt-0.5">{fmt(kpi.c)}</p>
            <p className="text-[10px] text-slate-400 font-semibold">{kpi.cn} payments</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Last month</p>
            <p className="text-lg font-black tabular-nums mt-0.5">{fmt(kpi.p)}</p>
            {kpi.pct != null ? (
              <p className={`text-[10px] font-bold inline-flex items-center gap-0.5 ${kpi.pct > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                {kpi.pct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(kpi.pct).toFixed(0)}% {kpi.pct > 0 ? 'higher' : 'lower'} now
              </p>
            ) : <p className="text-[10px] text-slate-400 font-semibold">no comparison</p>}
          </div>
          <div className="col-span-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Last 6 months</p>
            <div className="h-20 mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpi.series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} cursor={{ fill: 'rgba(100,116,139,0.1)' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} onClick={(d: any) => d?.k && setMonth(month === d.k ? 'all' : d.k)}>
                    {kpi.series.map((s) => (<Cell key={s.k} fill={s.cur ? '#6366f1' : '#94a3b8'} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="sticky top-0 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 space-y-2 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200/70 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payment, account, date…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[13px] font-medium" />
            {search && (<button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5"><X className="w-4 h-4 text-slate-400" /></button>)}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {(['all', 'paid', 'delayed', 'carry'] as const).map((s) => (
              <Chip key={s} on={status === s} onClick={() => setStatus(s)}>{s === 'all' ? 'All status' : ST_META[s].label}</Chip>
            ))}
          </div>
          {accounts.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              <Chip on={account === 'all'} onClick={() => setAccount('all')}>All accounts</Chip>
              {accounts.map((a) => (<Chip key={a} on={account === a} onClick={() => setAccount(account === a ? 'all' : a)}>{a}</Chip>))}
            </div>
          )}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            <Chip on={month === 'all'} onClick={() => setMonth('all')}>All time</Chip>
            {months.slice(0, 18).map((m) => (<Chip key={m} on={month === m} onClick={() => setMonth(month === m ? 'all' : m)}>{shortMonth(m)} {m.slice(2, 4)}</Chip>))}
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>{filtered.length} shown · <span className="text-slate-900 dark:text-white">{fmt(total)}</span></span>
            {hasFilter && (<button type="button" onClick={reset} className="text-indigo-600 font-black">Reset filters</button>)}
          </div>
        </div>

        {/* List */}
        {grouped.length === 0 ? (
          <div className="text-center py-14">
            <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-[13px] font-bold text-slate-500">{history.length ? 'No payments match these filters' : 'No payments logged yet'}</p>
            {hasFilter && <button type="button" onClick={reset} className="mt-2 text-[12px] font-black text-indigo-600">Reset filters</button>}
          </div>
        ) : grouped.map(([m, items]) => (
          <section key={m} className="space-y-1.5">
            <div className="flex items-baseline justify-between px-0.5">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">{monthLabel(m)}</h2>
              <span className="text-[11px] font-black tabular-nums text-slate-700 dark:text-slate-200">{fmt(items.reduce((s, h) => s + conv(h), 0))}</span>
            </div>
            <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {items.map((log) => {
                const st = (log.status || 'paid') as St;
                const M = ST_META[st];
                const open = openId === log.id;
                return (
                  <li key={log.id}>
                    <button type="button" onClick={() => setOpenId(open ? null : log.id)} className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800/50">
                      <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${M.cls}`}><M.Icon className="w-4 h-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold text-slate-900 dark:text-white truncate">{log.paymentName}</span>
                        <span className="block text-[10px] text-slate-400 font-semibold truncate">
                          {new Date(`${log.paidDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          {log.taggedFor ? ` · ${log.taggedFor}` : ''}
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-[13px] font-black tabular-nums">{formatCurrencyValue(log.amount, log.currency)}</span>
                        {log.currency !== summaryCurrency && (<span className="block text-[9px] text-slate-400">≈ {fmt(conv(log))}</span>)}
                      </span>
                    </button>
                    {open && (
                      <div className="px-3 pb-3 flex items-center gap-2 flex-wrap bg-slate-50/60 dark:bg-slate-950/40">
                        {onUpdateHistoryStatus && !isReadOnly && (
                          <div className="inline-flex p-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                            {(['paid', 'delayed', 'carry'] as St[]).map((s) => (
                              <button key={s} type="button" onClick={() => onUpdateHistoryStatus(log.id, s)}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${st === s ? 'bg-white dark:bg-slate-950 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                                {ST_META[s].label}
                              </button>
                            ))}
                          </div>
                        )}
                        {!isReadOnly && (
                          <button type="button" onClick={() => { if (confirm('Delete this log?')) onDeleteHistoryEntry(log.id); }}
                            className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold text-rose-500 border border-rose-200/70 dark:border-rose-900/40">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
