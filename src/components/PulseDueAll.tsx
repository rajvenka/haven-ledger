import React, { useMemo, useState } from 'react';
import { Search, X, Check, Edit2, ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, Clock, CalendarDays, CheckCircle2 } from 'lucide-react';
import { RecurringPayment, PaymentHistory, CountryConfig, Currency, getCategoryColor } from '../types';
import { Account, avatarClass, billState, initials, toCcy } from '../utils/accounts';
import { formatCurrencyValue } from '../utils/paymentUtils';

type Props = {
  accounts: Account[]; history: PaymentHistory[]; countries: CountryConfig[]; summaryCurrency: Currency;
  isReadOnly?: boolean; onRecordPayment: (p: RecurringPayment, dueDate?: string) => void; onEditBill: (p: RecurringPayment) => void;
  onOpenAccount: (name: string) => void;
  onBack?: () => void;
};
type Row = { b: RecurringPayment; account: string; st: ReturnType<typeof billState>; amt: number; group: 'overdue' | 'week' | 'later' | 'paid' };
type Chip = 'all' | 'open' | 'overdue' | 'week' | 'later' | 'paid';

export default function PulseDueAll({ accounts, history, countries, summaryCurrency, isReadOnly, onRecordPayment, onEditBill, onOpenAccount, onBack }: Props) {
  const now = useMemo(() => new Date(), []);
  const money = (n: number, ccy: string = summaryCurrency) => formatCurrencyValue(n, ccy, countries);
  const [chip, setChip] = useState<Chip>('all');
  const [q, setQ] = useState('');
  const [byAccount, setByAccount] = useState(false);
  const [acct, setAcct] = useState('all');
  const [closed, setClosed] = useState<Record<string, boolean>>({ paid: true });

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    accounts.forEach((a) => a.bills.forEach((b) => {
      if (!b.active) return;
      const st = billState(b, history, now);
      const amt = toCcy(b.amount, b.currency, summaryCurrency, countries);
      if (st.dueThisMonth) {
        const group: Row['group'] = st.overdueDays > 0 ? 'overdue' : st.days <= 7 ? 'week' : 'later';
        out.push({ b, account: a.name, st, amt, group });
      } else if (st.paidThisMonth || st.paid) out.push({ b, account: a.name, st, amt, group: 'paid' });
    }));
    return out;
  }, [accounts, history, now, summaryCurrency, countries]);

  const sum = (g: Row['group'] | 'open', list = rows) => list.filter((r) => (g === 'open' ? r.group !== 'paid' : r.group === g)).reduce((s, r) => s + r.amt, 0);
  const cnt = (g: Row['group']) => rows.filter((r) => r.group === g).length;
  const open = sum('open'), paid = sum('paid'), total = open + paid;
  const pctPaid = total > 0 ? Math.round((paid / total) * 100) : 0;

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (chip === 'all' ? true : chip === 'open' ? r.group !== 'paid' : r.group === chip) && (acct === 'all' || r.account === acct)
      && (!t || r.b.name.toLowerCase().includes(t) || r.account.toLowerCase().includes(t) || String(r.b.category || '').toLowerCase().includes(t)))
      .sort((x, y) => x.st.next.getTime() - y.st.next.getTime());
  }, [rows, chip, q, acct]);

  const GROUPS: { id: Row['group']; label: string; hint: string; icon: React.ReactNode; cls: string }[] = [
    { id: 'overdue', label: 'Overdue', hint: 'past due date', icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: 'text-rose-600' },
    { id: 'week', label: 'Due this week', hint: 'next 7 days', icon: <Clock className="w-3.5 h-3.5" />, cls: 'text-amber-600' },
    { id: 'later', label: 'Later this month', hint: 'rest of the month', icon: <CalendarDays className="w-3.5 h-3.5" />, cls: 'text-indigo-600' },
    { id: 'paid', label: 'Paid this month', hint: 'already settled', icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: 'text-emerald-600' },
  ];

  const pill = (r: Row) => {
    if (r.group === 'paid') return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Paid</span>;
    if (r.st.overdueDays > 0) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600">Overdue {r.st.overdueDays}d</span>;
    if (r.st.days === 0) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600">Today</span>;
    return <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${r.st.days <= 7 ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>in {r.st.days}d</span>;
  };

  const Line = ({ r }: { r: Row; key?: React.Key }) => {
    const col = getCategoryColor(r.b.category || 'Other');
    return (
      <li className="flex items-center gap-3 px-3 py-2.5">
        <div className="shrink-0 w-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center py-1">
          <p className="text-[8px] font-black uppercase text-slate-400 leading-none">{r.st.next.toLocaleDateString(undefined, { month: 'short' })}</p>
          <p className="text-[14px] font-black text-slate-900 dark:text-white leading-tight tabular-nums">{r.st.next.getDate()}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.iconBg}`} />
            <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{r.b.name}</p>
          </div>
          <button type="button" onClick={() => onOpenAccount(r.account)} className="mt-0.5 inline-flex items-center gap-1 max-w-full text-[10px] text-slate-500 hover:text-violet-600">
            <span className={`w-3.5 h-3.5 rounded-md ${avatarClass(r.account)} text-white text-[7px] font-black flex items-center justify-center shrink-0`}>{initials(r.account)}</span>
            <span className="truncate">{r.account}{r.b.category ? ` · ${r.b.category}` : ''}</span>
          </button>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          <p className="text-[12px] font-black tabular-nums text-slate-900 dark:text-white">{money(r.b.amount, r.b.currency)}</p>
          {pill(r)}
        </div>
        {!isReadOnly && (
          <div className="shrink-0 flex flex-col gap-1">
            {r.group !== 'paid' && <button type="button" onClick={() => onRecordPayment(r.b)} className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 text-white"><Check className="w-3 h-3" />Pay</button>}
            <button type="button" onClick={() => onEditBill(r.b)} className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-800 text-slate-500"><Edit2 className="w-3 h-3" /></button>
          </div>
        )}
      </li>
    );
  };

  const Section = ({ id, label, hint, icon, cls, list, subtitle }: { key?: React.Key; id: string; label: string; hint?: string; icon?: React.ReactNode; cls?: string; list: Row[]; subtitle?: string }) => {
    if (list.length === 0) return null;
    const shut = !!closed[id];
    const t = list.reduce((s, r) => s + r.amt, 0);
    return (
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <button type="button" onClick={() => setClosed((c) => ({ ...c, [id]: !c[id] }))} className="w-full px-3 py-2.5 flex items-center gap-2 text-left border-b border-slate-100 dark:border-slate-800">
          {shut ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          <span className={cls}>{icon}</span>
          <h3 className="text-[12px] font-black text-slate-800 dark:text-slate-100">{label}</h3>
          <span className="text-[10px] text-slate-400 font-bold">{subtitle || hint} · {list.length}</span>
          <span className={`ml-auto text-[12px] font-black tabular-nums ${cls || ''}`}>{money(t)}</span>
        </button>
        {!shut && <ul className="divide-y divide-slate-100 dark:divide-slate-800">{list.map((r) => <Line key={r.b.id} r={r} />)}</ul>}
      </section>
    );
  };

  const pick = (c: Chip) => { const next = chip === c ? 'all' : c; setChip(next); if (next === 'paid') setClosed((x) => ({ ...x, paid: false })); };
  const accountNames = useMemo(() => (Array.from(new Set(rows.map((r) => r.account))) as string[]).sort(), [rows]);
  const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const chips: [Chip, string, number][] = [['all', 'All', rows.length], ['open', 'To pay', rows.length - cnt('paid')], ['overdue', 'Overdue', cnt('overdue')], ['week', 'This week', cnt('week')], ['later', 'Later', cnt('later')], ['paid', 'Paid', cnt('paid')]];

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col">
      <div className="shrink-0 px-4 pt-3 pb-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {onBack && <button type="button" onClick={onBack} className="inline-flex items-center gap-0.5 text-[11px] font-bold text-violet-600 mb-2"><ChevronLeft className="w-4 h-4" />Accounts</button>}
        <h2 className="text-lg font-black text-slate-900 dark:text-white">All dues · {monthLabel}</h2>
        <p className="text-[11px] text-slate-500">Everything across every person and property, in one place</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 pb-28 md:pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            ['open', 'Still to pay', money(open), `${rows.length - cnt('paid')} bills`, undefined],
            ['overdue', 'Overdue', money(sum('overdue')), `${cnt('overdue')} bill${cnt('overdue') === 1 ? '' : 's'}`, cnt('overdue') ? 'text-rose-600' : undefined],
            ['week', 'Due in 7 days', money(sum('week')), `${cnt('week')} bill${cnt('week') === 1 ? '' : 's'}`, cnt('week') ? 'text-amber-600' : undefined],
            ['paid', 'Paid so far', money(paid), `${cnt('paid')} bill${cnt('paid') === 1 ? '' : 's'}`, 'text-emerald-600'],
          ].map(([id, l, v, s, t]: any) => (
            <button key={l} type="button" onClick={() => pick(id as Chip)} aria-pressed={chip === id}
              className={`text-left rounded-2xl bg-white dark:bg-slate-900 border px-3 py-2.5 min-w-0 transition-all hover:shadow-sm ${chip === id ? 'border-violet-500 ring-2 ring-violet-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{l}</p>
              <p className={`text-[15px] font-black tabular-nums truncate ${t || 'text-slate-900 dark:text-white'}`}>{v}</p>
              <p className="text-[9px] text-slate-400 truncate">{s}</p>
            </button>
          ))}
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2.5">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1"><span>{pctPaid}% of this month's bills paid</span><span>{money(paid)} of {money(total)}</span></div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pctPaid}%` }} /></div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[10rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bill, person, category…" className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px]" />
              {q && <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
            </div>
            <select value={acct} onChange={(e) => setAcct(e.target.value)} className="text-[11px] font-bold px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <option value="all">All accounts</option>
              {accountNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
              {([[false, 'By status'], [true, 'By account']] as [boolean, string][]).map(([v, l]) => <button key={l} type="button" onClick={() => setByAccount(v)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black ${byAccount === v ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-sm' : 'text-slate-500'}`}>{l}</button>)}
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {chips.map(([id, label, n]) => (
              <button key={id} type="button" onClick={() => { setChip(id); if (id === 'paid') setClosed((x) => ({ ...x, paid: false })); }} className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold ${chip === id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}>{label} <span className="opacity-60">{n}</span></button>
            ))}
          </div>
        </div>

        {visible.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-[12px] text-slate-400">Nothing matches. {rows.length === 0 ? 'No active bills for this month.' : 'Try another filter.'}</div>}
        {!byAccount
          ? GROUPS.map((g) => <Section key={g.id} id={g.id} label={g.label} hint={g.hint} icon={g.icon} cls={g.cls} list={visible.filter((r) => r.group === g.id)} />)
          : (Array.from(new Set(visible.map((r) => r.account))) as string[]).sort().map((name) => {
              const list = visible.filter((r) => r.account === name);
              const o = list.filter((r) => r.group !== 'paid').reduce((s, r) => s + r.amt, 0);
              return <Section key={name} id={`a:${name}`} label={name} subtitle={`${money(o)} to pay`} cls="text-slate-800 dark:text-slate-100" list={list} />;
            })}
      </div>
    </div>
  );
}
