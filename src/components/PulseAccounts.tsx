/**
 * Pulse v2 "Accounts" - Salesforce-style record pages for the people / properties money is
 * spent on. Left: account list. Right: record (header, KPIs, Overview / Bills / History).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, ChevronLeft, Check, Edit2, Home, User, Landmark, AlertTriangle, Clock, X,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RecurringPayment, PaymentHistory, CountryConfig, Currency, getCategoryColor } from '../types';
import { formatCurrencyValue } from '../utils/paymentUtils';
import {
  Account, AccountType, ACCOUNT_TYPES, avatarClass, billState, buildAccounts, initials,
  loadTypeOverrides, monthlyEquivalent, saveTypeOverride, toCcy,
} from '../utils/accounts';

interface Props {
  payments: RecurringPayment[];
  history: PaymentHistory[];
  countries: CountryConfig[];
  summaryCurrency: Currency;
  onRecordPayment: (payment: RecurringPayment, dueDate?: string) => void;
  onAddBill: (accountName: string) => void;
  onEditBill: (payment: RecurringPayment) => void;
  isReadOnly?: boolean;
  selectedAccount: string | null;
  onSelectAccount: (name: string | null) => void;
  onRenameAccount?: (from: string, to: string) => Promise<void>;
}

type Tab = 'overview' | 'bills' | 'history';
type TypeFilter = 'all' | AccountType;

const TypeIcon = ({ type, className }: { type: AccountType; className?: string }) =>
  type === 'property' ? <Home className={className} /> : type === 'other' ? <Landmark className={className} /> : <User className={className} />;

function useIsDesktop() {
  const [d, setD] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 900 : true));
  useEffect(() => {
    const f = () => setD(window.innerWidth >= 900);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return d;
}

export default function PulseAccounts({
  payments, history, countries, summaryCurrency, onRecordPayment, onAddBill, onEditBill,
  isReadOnly = false, selectedAccount, onSelectAccount, onRenameAccount,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [renameTo, setRenameTo] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const isDesktop = useIsDesktop();
  const [overrides, setOverrides] = useState(loadTypeOverrides);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [tab, setTab] = useState<Tab>('overview');

  const now = useMemo(() => new Date(), []);
  const money = (n: number, ccy: string = summaryCurrency) => formatCurrencyValue(n, ccy, countries);
  const conv = (n: number, from: string) => toCcy(n, from, summaryCurrency, countries);

  const accounts = useMemo(() => buildAccounts(payments, history, overrides), [payments, history, overrides]);

  const statsOf = (a: Account) => {
    let monthly = 0, dueOpen = 0, overdue = 0, dueCount = 0;
    a.bills.forEach((b) => {
      if (!b.active) return;
      monthly += conv(monthlyEquivalent(b), b.currency);
      const s = billState(b, history, now);
      if (s.dueThisMonth) { dueOpen += conv(b.amount, b.currency); dueCount++; }
      if (s.overdueDays > 0) overdue++;
    });
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const paidMonth = a.history.filter((h) => String(h.paidDate).startsWith(monthStr)).reduce((s, h) => s + conv(h.amount, h.currency), 0);
    const paidYtd = a.history.filter((h) => String(h.paidDate).startsWith(String(now.getFullYear()))).reduce((s, h) => s + conv(h.amount, h.currency), 0);
    return { monthly, dueOpen, overdue, dueCount, paidMonth, paidYtd, activeBills: a.bills.filter((b) => b.active).length };
  };

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts
      .filter((a) => (typeFilter === 'all' || a.type === typeFilter) && (!q || a.name.toLowerCase().includes(q)))
      .map((a) => ({ a, s: statsOf(a) }))
      .sort((x, y) => y.s.monthly - x.s.monthly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, search, typeFilter, history]);

  const selectedKey = selectedAccount ? selectedAccount.toLowerCase() : null;
  const current = accounts.find((a) => a.name.toLowerCase() === selectedKey) || (isDesktop ? list[0]?.a : undefined) || null;
  const showDetail = !!current && (isDesktop || !!selectedAccount);

  const typeCounts = useMemo(() => ({
    all: accounts.length,
    person: accounts.filter((a) => a.type === 'person').length,
    property: accounts.filter((a) => a.type === 'property').length,
    other: accounts.filter((a) => a.type === 'other').length,
  }), [accounts]);

  /* ------------------------------ left rail ------------------------------ */
  const rail = (
    <div className={`${isDesktop ? 'w-[300px] shrink-0 border-r border-slate-200 dark:border-slate-800' : 'w-full'} flex flex-col min-h-0 bg-white/60 dark:bg-slate-950`}>
      <div className="p-3 space-y-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Accounts</h1>
            <p className="text-[10px] text-slate-400 font-bold">{accounts.length} people &amp; properties · monthly cost in {summaryCurrency}</p>
          </div>
          {!isReadOnly && (
            <button type="button" onClick={() => onAddBill('')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
              <Plus className="w-3.5 h-3.5" />Bill
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts…"
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px]" />
          {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
        </div>
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {([['all', 'All'], ['person', 'People'], ['property', 'Properties'], ['other', 'Other']] as [TypeFilter, string][])
            .filter(([id]) => id === 'all' || typeCounts[id as AccountType] > 0)
            .map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTypeFilter(id)}
                className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold ${typeFilter === id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}>
                {label} <span className="opacity-60">{typeCounts[id]}</span>
              </button>
            ))}
        </div>
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 pb-24 md:pb-4">
        {list.length === 0 && <li className="p-6 text-center text-[12px] text-slate-400">No accounts match</li>}
        {list.map(({ a, s }) => {
          const active = current?.name === a.name && (isDesktop || selectedAccount === a.name);
          return (
            <li key={a.name}>
              <button type="button" onClick={() => { onSelectAccount(a.name); setTab('overview'); }}
                className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${active ? 'bg-violet-50 dark:bg-violet-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'}`}>
                <div className={`w-10 h-10 rounded-xl ${avatarClass(a.name)} text-white flex items-center justify-center text-[12px] font-black shrink-0`}>{initials(a.name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{a.name}</p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <TypeIcon type={a.type} className="w-3 h-3" />{ACCOUNT_TYPES.find((t) => t.id === a.type)?.label} · {s.activeBills} bill{s.activeBills === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-black tabular-nums text-slate-900 dark:text-white">{money(s.monthly)}</p>
                  {s.overdue > 0
                    ? <p className="text-[9px] font-black text-rose-600">{s.overdue} overdue</p>
                    : <p className="text-[9px] text-slate-400">/month</p>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  /* ----------------------------- detail pane ----------------------------- */
  const detail = current ? (() => {
    const a = current;
    const s = statsOf(a);
    const bills = a.bills.map((b) => ({ b, st: billState(b, history, now) }));
    const attention = bills.filter(({ b, st }) => b.active && !st.paid && !st.future && (st.overdueDays > 0 || st.days <= 7))
      .sort((x, y) => x.st.days - y.st.days);

    // Category split (monthly equivalent, active bills)
    const cat = new Map<string, number>();
    a.bills.filter((b) => b.active).forEach((b) => cat.set(b.category || 'Other', (cat.get(b.category || 'Other') || 0) + conv(monthlyEquivalent(b), b.currency)));
    const catRows = Array.from(cat.entries()).sort((x, y) => y[1] - x[1]);
    const catMax = Math.max(1, ...catRows.map((r) => r[1]));

    // Last 6 months paid
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString(undefined, { month: 'short' }), total: 0 });
    }
    a.history.forEach((h) => {
      const m = months.find((x) => String(h.paidDate).startsWith(x.key));
      if (m) m.total += conv(h.amount, h.currency);
    });

    const statusPill = (b: RecurringPayment, st: ReturnType<typeof billState>) => {
      if (!b.active) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Paused</span>;
      if (st.paid) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Paid</span>;
      if (st.overdueDays > 0) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600">Overdue {st.overdueDays}d</span>;
      if (st.days === 0) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600">Today</span>;
      if (st.days <= 7) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">in {st.days}d</span>;
      return <span className="text-[9px] font-bold text-slate-400">{st.future ? st.next.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : `in ${st.days}d`}</span>;
    };

    const BillRow: React.FC<{ b: RecurringPayment; st: ReturnType<typeof billState> }> = ({ b, st }) => {
      const col = getCategoryColor(b.category || 'Other');
      return (
        <li className={`flex items-center gap-3 px-3 py-2.5 ${!b.active ? 'opacity-60' : ''}`}>
          <div className="shrink-0 w-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center py-1">
            <p className="text-[8px] font-black uppercase text-slate-400 leading-none">{st.next.toLocaleDateString(undefined, { month: 'short' })}</p>
            <p className="text-[14px] font-black text-slate-900 dark:text-white leading-tight tabular-nums">{st.next.getDate()}</p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.iconBg}`} />
              <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{b.name}</p>
              {b.paymentMethod === 'direct_debit' && <span className="shrink-0 text-[8px] font-black px-1 py-0.5 rounded bg-sky-500/10 text-sky-600">DD</span>}
            </div>
            <p className="text-[10px] text-slate-500 truncate">{[b.category, b.billingCycle && b.billingCycle !== 'monthly' ? b.billingCycle : 'monthly'].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            <p className="text-[12px] font-black tabular-nums text-slate-900 dark:text-white">{money(b.amount, b.currency)}</p>
            {statusPill(b, st)}
          </div>
          {!isReadOnly && (
            <div className="shrink-0 flex flex-col gap-1">
              {b.active && !st.paid && (
                <button type="button" onClick={() => onRecordPayment(b)} className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 text-white"><Check className="w-3 h-3" />Pay</button>
              )}
              <button type="button" onClick={() => onEditBill(b)} className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-800 text-slate-500"><Edit2 className="w-3 h-3" /></button>
            </div>
          )}
        </li>
      );
    };

    const KPI = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) => (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2.5 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`text-[15px] font-black tabular-nums truncate ${tone || 'text-slate-900 dark:text-white'}`}>{value}</p>
        {sub && <p className="text-[9px] text-slate-400 truncate">{sub}</p>}
      </div>
    );

    return (
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* Record header */}
        <div className="shrink-0 px-4 pt-3 pb-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          {!isDesktop && (
            <button type="button" onClick={() => onSelectAccount(null)} className="inline-flex items-center gap-0.5 text-[11px] font-bold text-violet-600 mb-2"><ChevronLeft className="w-4 h-4" />Accounts</button>
          )}
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-2xl ${avatarClass(a.name)} text-white flex items-center justify-center text-[15px] font-black shrink-0`}>{initials(a.name)}</div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-slate-900 dark:text-white truncate">{a.name}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                  <TypeIcon type={a.type} className="w-3 h-3" />
                  <select value={a.type} disabled={isReadOnly}
                    onChange={(e) => { saveTypeOverride(a.name, e.target.value as AccountType); setOverrides(loadTypeOverrides()); }}
                    className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer">
                    {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
                <span className="text-[10px] text-slate-400">{s.activeBills} active · {a.bills.length - s.activeBills} paused · {a.history.length} payments logged</span>
              </div>
            </div>
            {!isReadOnly && onRenameAccount && (
              <button type="button" onClick={() => { setRenameTo(a.name); setRenaming(true); }} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"><Edit2 className="w-3 h-3" />Rename / merge</button>
            )}
            {!isReadOnly && (
              <button type="button" onClick={() => onAddBill(a.name)} className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white"><Plus className="w-3.5 h-3.5" />Add bill</button>
            )}
          </div>
          <div className="flex gap-1 mt-3">
            {([['overview', 'Overview'], ['bills', `Bills · ${a.bills.length}`], ['history', `History · ${a.history.length}`]] as [Tab, string][]).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)}
                className={`px-3.5 py-2 text-[12px] font-bold border-b-2 transition-colors ${tab === id ? 'border-violet-600 text-violet-700 dark:text-violet-300' : 'border-transparent text-slate-500'}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 pb-28 md:pb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <KPI label="Monthly cost" value={money(s.monthly)} sub="avg across schedules" />
            <KPI label="Still to pay this month" value={money(s.dueOpen)} sub={`${s.dueCount} bill${s.dueCount === 1 ? '' : 's'}`} tone={s.overdue ? 'text-rose-600' : undefined} />
            <KPI label="Paid this month" value={money(s.paidMonth)} tone="text-emerald-600" />
            <KPI label={`Paid ${now.getFullYear()}`} value={money(s.paidYtd)} sub="year to date" />
          </div>

          {tab === 'overview' && (
            <>
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                  {attention.some((x) => x.st.overdueDays > 0) ? <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> : <Clock className="w-3.5 h-3.5 text-amber-500" />}
                  <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-200">Needs attention</h3>
                  <span className="text-[10px] text-slate-400 font-bold">overdue &amp; next 7 days</span>
                </div>
                {attention.length === 0
                  ? <p className="px-3 py-5 text-[12px] text-slate-400 text-center">Nothing due soon - all clear.</p>
                  : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{attention.map(({ b, st }) => <BillRow key={b.id} b={b} st={st} />)}</ul>}
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                  <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-200 mb-2">Where the money goes <span className="text-slate-400 font-bold">/ month</span></h3>
                  {catRows.length === 0 ? <p className="text-[12px] text-slate-400 py-4 text-center">No active bills</p> : (
                    <ul className="space-y-2">
                      {catRows.map(([c, v]) => (
                        <li key={c}>
                          <div className="flex justify-between text-[11px]"><span className="font-bold text-slate-700 dark:text-slate-200">{c}</span><span className="tabular-nums text-slate-500">{money(v)}</span></div>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1"><div className={`h-1.5 rounded-full ${getCategoryColor(c).iconBg}`} style={{ width: `${Math.max(4, (v / catMax) * 100)}%` }} /></div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                  <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-200 mb-2">Paid, last 6 months</h3>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={months} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: any) => money(Number(v))} />
                        <Bar dataKey="total" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            </>
          )}

          {tab === 'bills' && <BillsTab bills={bills} Row={BillRow} />}
          {tab === 'history' && <HistoryTab account={a} money={money} conv={conv} />}
        </div>
      </div>
    );
  })() : null;

  const otherNames = accounts.filter((x) => x.name !== current?.name).map((x) => x.name);
  const mergeTarget = otherNames.find((n) => n.toLowerCase() === renameTo.trim().toLowerCase());
  const renameDialog = renaming && current ? (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/60" onClick={() => !renameBusy && setRenaming(false)}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-black text-slate-900 dark:text-white">Rename or merge “{current.name}”</h3>
        <p className="text-[11px] text-slate-500">Type a new name, or pick an existing account to merge into. All {current.bills.length} bill(s) and {current.history.length} payment(s) move over.</p>
        <input list="hv-account-names" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} autoFocus
          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-[13px] font-bold" />
        <datalist id="hv-account-names">{otherNames.map((n) => <option key={n} value={n} />)}</datalist>
        {renameTo.trim() && renameTo.trim() !== current.name && (
          <p className={`text-[11px] font-bold ${mergeTarget ? 'text-amber-600' : 'text-slate-500'}`}>
            {mergeTarget ? `Merges into the existing account “${mergeTarget}”.` : `Renames to “${renameTo.trim()}”.`}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={renameBusy} onClick={() => setRenaming(false)} className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-slate-500">Cancel</button>
          <button type="button" disabled={renameBusy || !renameTo.trim() || renameTo.trim() === current.name}
            onClick={async () => {
              if (!onRenameAccount) return;
              setRenameBusy(true);
              try {
                const target = mergeTarget || renameTo.trim();
                await onRenameAccount(current.name, target);
                onSelectAccount(target);
                setRenaming(false);
              } finally { setRenameBusy(false); }
            }}
            className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-indigo-600 text-white disabled:opacity-50">{renameBusy ? 'Saving…' : mergeTarget ? 'Merge' : 'Rename'}</button>
        </div>
      </div>
    </div>
  ) : null;

  if (!isDesktop) {
    return <div className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-slate-950 text-left">{showDetail ? detail : rail}{renameDialog}</div>;
  }
  return (
    <div className="flex-1 min-h-0 flex bg-slate-50 dark:bg-slate-950 text-left">
      {rail}
      {detail || <div className="flex-1 flex items-center justify-center text-[13px] text-slate-400">No accounts yet - add a bill to get started.</div>}
      {renameDialog}
    </div>
  );
}

/* --------------------------------- Bills tab --------------------------------- */
type BillView = 'all' | 'unpaid' | 'paid' | 'paused';
function BillsTab({ bills, Row }: { bills: { b: RecurringPayment; st: ReturnType<typeof billState> }[]; Row: React.FC<{ b: RecurringPayment; st: ReturnType<typeof billState> }> }) {
  const [view, setView] = useState<BillView>('all');
  const [q, setQ] = useState('');
  const counts = {
    all: bills.length,
    unpaid: bills.filter(({ b, st }) => b.active && !st.paid && !st.future).length,
    paid: bills.filter(({ b, st }) => b.active && st.paidThisMonth).length,
    paused: bills.filter(({ b }) => !b.active).length,
  };
  const shown = bills.filter(({ b, st }) => {
    if (view === 'unpaid' && !(b.active && !st.paid && !st.future)) return false;
    if (view === 'paid' && !(b.active && st.paidThisMonth)) return false;
    if (view === 'paused' && b.active) return false;
    if (q && !`${b.name} ${b.category}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((x, y) => (x.b.active === y.b.active ? x.st.days - y.st.days : x.b.active ? -1 : 1));
  const groups = [
    { id: 'now', label: 'This month', items: shown.filter(({ b, st }) => b.active && !st.future) },
    { id: 'future', label: 'Future (yearly / multi-month / one-off)', items: shown.filter(({ b, st }) => b.active && st.future) },
    { id: 'paused', label: 'Paused', items: shown.filter(({ b }) => !b.active) },
  ].filter((g) => g.items.length);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bills…" className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px]" />
        </div>
        <div className="flex gap-1.5">
          {([['all', 'All'], ['unpaid', 'To pay'], ['paid', 'Paid this month'], ['paused', 'Paused']] as [BillView, string][]).map(([id, l]) => (
            <button key={id} type="button" onClick={() => setView(id)} className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold ${view === id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}>{l} <span className="opacity-60">{counts[id]}</span></button>
          ))}
        </div>
      </div>
      {groups.length === 0 && <p className="text-center text-[12px] text-slate-400 py-10">No bills match</p>}
      {groups.map((g) => (
        <section key={g.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800"><h3 className="text-[11px] font-black text-slate-700 dark:text-slate-200">{g.label} <span className="text-slate-400 font-bold">· {g.items.length}</span></h3></div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">{g.items.map(({ b, st }) => <Row key={b.id} b={b} st={st} />)}</ul>
        </section>
      ))}
    </div>
  );
}

/* -------------------------------- History tab -------------------------------- */
function HistoryTab({ account, money, conv }: { account: Account; money: (n: number, c?: string) => string; conv: (n: number, f: string) => number }) {
  const years = Array.from(new Set(account.history.map((h) => String(h.paidDate).slice(0, 4)))).sort().reverse();
  const [year, setYear] = useState<string>('all');
  const [q, setQ] = useState('');
  const rows = account.history
    .filter((h) => (year === 'all' || String(h.paidDate).startsWith(year)) && (!q || String(h.paymentName).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => String(b.paidDate).localeCompare(String(a.paidDate)));
  const byMonth = new Map<string, typeof rows>();
  rows.forEach((h) => { const k = String(h.paidDate).slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k)!.push(h); });
  const total = rows.reduce((s, h) => s + conv(h.amount, h.currency), 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search payments…" className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px]" />
        </div>
        <select value={year} onChange={(e) => setYear(e.target.value)} className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px] font-bold">
          <option value="all">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 tabular-nums">{rows.length} payments · {money(total)}</span>
      </div>
      {rows.length === 0 && <p className="text-center text-[12px] text-slate-400 py-10">No payment history</p>}
      {Array.from(byMonth.entries()).map(([k, items]) => (
        <section key={k} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between">
            <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-200">{new Date(k + '-01T12:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
            <span className="text-[11px] font-black tabular-nums text-slate-500">{money(items.reduce((s, h) => s + conv(h.amount, h.currency), 0))}</span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="text-[10px] font-bold text-slate-400 w-12 shrink-0 tabular-nums">{String(h.paidDate).slice(8, 10)} {new Date(String(h.paidDate).slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' })}</span>
                <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate flex-1">{h.paymentName}</p>
                {h.status && h.status !== 'paid' && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 capitalize">{h.status}</span>}
                <span className="text-[12px] font-black tabular-nums text-slate-900 dark:text-white">{money(h.amount, h.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
