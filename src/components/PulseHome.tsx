/**
 * Pulse v2 Home - CRM-style overview: KPIs, needs-attention queue, account cards, trend,
 * recent activity. Clicking an account opens its record in the Accounts page.
 */
import React, { useMemo } from 'react';
import { AlertTriangle, Clock, Check, ChevronRight, Home, User, Landmark } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RecurringPayment, PaymentHistory, CountryConfig, Currency } from '../types';
import { formatCurrencyValue } from '../utils/paymentUtils';
import {
  AccountType, accountNameOf, avatarClass, billState, buildAccounts, initials, loadTypeOverrides, monthlyEquivalent, toCcy,
} from '../utils/accounts';

interface Props {
  payments: RecurringPayment[];
  history: PaymentHistory[];
  countries: CountryConfig[];
  summaryCurrency: Currency;
  onRecordPayment: (payment: RecurringPayment, dueDate?: string) => void;
  onOpenAccount: (name: string) => void;
  onNavigateToBills?: () => void;
  isReadOnly?: boolean;
  monthlyIncomeEstimate?: number;
}

const TypeIcon = ({ type, className }: { type: AccountType; className?: string }) =>
  type === 'property' ? <Home className={className} /> : type === 'other' ? <Landmark className={className} /> : <User className={className} />;

export default function PulseHome({
  payments, history, countries, summaryCurrency, onRecordPayment, onOpenAccount, onNavigateToBills,
  isReadOnly = false, monthlyIncomeEstimate = 0,
}: Props) {
  const now = useMemo(() => new Date(), []);
  const money = (n: number, ccy: string = summaryCurrency) => formatCurrencyValue(n, ccy, countries);
  const conv = (n: number, from: string) => toCcy(n, from, summaryCurrency, countries);
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const data = useMemo(() => {
    const accounts = buildAccounts(payments, history, loadTypeOverrides());
    const rows = payments.filter((p) => p.active).map((p) => ({ p, st: billState(p, history, now) }));
    const attention = rows.filter(({ st }) => !st.paid && !st.future && (st.overdueDays > 0 || st.days <= 7)).sort((a, b) => a.st.days - b.st.days);
    const monthly = rows.reduce((s, { p }) => s + conv(monthlyEquivalent(p), p.currency), 0);
    const dueOpen = rows.filter(({ st }) => st.dueThisMonth).reduce((s, { p }) => s + conv(p.amount, p.currency), 0);
    const dueCount = rows.filter(({ st }) => st.dueThisMonth).length;
    const overdueCount = rows.filter(({ st }) => st.overdueDays > 0).length;
    const next7 = attention.filter(({ st }) => st.overdueDays === 0).reduce((s, { p }) => s + conv(p.amount, p.currency), 0);
    const paidMonth = history.filter((h) => String(h.paidDate).startsWith(monthStr)).reduce((s, h) => s + conv(h.amount, h.currency), 0);
    const cards = accounts.map((a) => {
      const act = a.bills.filter((b) => b.active);
      const st = act.map((b) => ({ b, s: billState(b, history, now) }));
      return {
        a,
        monthly: act.reduce((s, b) => s + conv(monthlyEquivalent(b), b.currency), 0),
        due: st.filter((x) => x.s.dueThisMonth).reduce((s, x) => s + conv(x.b.amount, x.b.currency), 0),
        overdue: st.filter((x) => x.s.overdueDays > 0).length,
        bills: act.length,
      };
    }).filter((c) => c.bills > 0 || c.a.history.length > 0).sort((x, y) => y.monthly - x.monthly);
    const trend: { label: string; key: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trend.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString(undefined, { month: 'short' }), total: 0 });
    }
    history.forEach((h) => { const t = trend.find((x) => String(h.paidDate).startsWith(x.key)); if (t) t.total += conv(h.amount, h.currency); });
    const recent = [...history].sort((a, b) => String(b.paidDate).localeCompare(String(a.paidDate))).slice(0, 8);
    return { attention, monthly, dueOpen, dueCount, overdueCount, next7, paidMonth, cards, trend, recent };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, history, countries, summaryCurrency]);

  const maxMonthly = Math.max(1, ...data.cards.map((c) => c.monthly));
  const hour = now.getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const KPI = ({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick} disabled={!onClick}
      className="text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2.5 min-w-0 disabled:cursor-default">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-[17px] font-black tabular-nums truncate ${tone || 'text-slate-900 dark:text-white'}`}>{value}</p>
      {sub && <p className="text-[9px] text-slate-400 truncate">{sub}</p>}
    </button>
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-left">
      <div className="max-w-6xl mx-auto p-3 sm:p-4 space-y-3 pb-28 md:pb-8">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{greet}</h1>
            <p className="text-[11px] text-slate-400 font-bold">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · amounts in {summaryCurrency}</p>
          </div>
          {onNavigateToBills && <button type="button" onClick={onNavigateToBills} className="text-[11px] font-bold text-violet-600">Manage bills →</button>}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <KPI label="Monthly cost" value={money(data.monthly)} sub="all active bills" />
          <KPI label="Still to pay" value={money(data.dueOpen)} sub={`${data.dueCount} bills this month`} tone={data.overdueCount ? 'text-rose-600' : undefined} />
          <KPI label="Next 7 days" value={money(data.next7)} sub="excluding overdue" />
          <KPI label="Paid this month" value={money(data.paidMonth)} tone="text-emerald-600" />
          {monthlyIncomeEstimate > 0
            ? <KPI label="Left after bills" value={money(monthlyIncomeEstimate - data.monthly)} sub={`of ${money(monthlyIncomeEstimate)} income`} tone={monthlyIncomeEstimate - data.monthly < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'} />
            : <KPI label="Overdue" value={String(data.overdueCount)} sub="bills" tone={data.overdueCount ? 'text-rose-600' : undefined} />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <section className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
              {data.overdueCount ? <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> : <Clock className="w-3.5 h-3.5 text-amber-500" />}
              <h2 className="text-[11px] font-black text-slate-700 dark:text-slate-200">Needs attention</h2>
              <span className="text-[10px] text-slate-400 font-bold">{data.attention.length} · overdue &amp; next 7 days</span>
            </div>
            {data.attention.length === 0
              ? <p className="px-3 py-8 text-center text-[12px] text-slate-400">Nothing due in the next 7 days. 🎉</p>
              : <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
                {data.attention.map(({ p, st }) => {
                  const acct = accountNameOf(p.taggedFor);
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className={`shrink-0 w-10 rounded-xl border text-center py-1 ${st.overdueDays > 0 ? 'border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/50' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'}`}>
                        <p className="text-[8px] font-black uppercase text-slate-400 leading-none">{st.next.toLocaleDateString(undefined, { month: 'short' })}</p>
                        <p className="text-[14px] font-black text-slate-900 dark:text-white leading-tight tabular-nums">{st.next.getDate()}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                        <button type="button" onClick={() => onOpenAccount(acct)} className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:underline">
                          <span className={`w-3.5 h-3.5 rounded ${avatarClass(acct)} text-white text-[7px] flex items-center justify-center`}>{initials(acct).slice(0, 1)}</span>{acct}
                        </button>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-black tabular-nums text-slate-900 dark:text-white">{money(p.amount, p.currency)}</p>
                        <p className={`text-[9px] font-black ${st.overdueDays > 0 ? 'text-rose-600' : st.days === 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {st.overdueDays > 0 ? `${st.overdueDays}d overdue` : st.days === 0 ? 'Today' : `in ${st.days}d`}
                        </p>
                      </div>
                      {!isReadOnly && <button type="button" onClick={() => onRecordPayment(p)} className="shrink-0 inline-flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-600 text-white"><Check className="w-3 h-3" />Pay</button>}
                    </li>
                  );
                })}
              </ul>}
          </section>

          <section className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <h2 className="text-[11px] font-black text-slate-700 dark:text-slate-200 mb-2">Paid, last 6 months</h2>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs><linearGradient id="hvTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} /><stop offset="100%" stopColor="#7c3aed" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => money(Number(v))} />
                  <Area type="monotone" dataKey="total" stroke="#7c3aed" strokeWidth={2} fill="url(#hvTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <section>
          <div className="flex items-center justify-between mb-2 px-0.5">
            <h2 className="text-[11px] font-black text-slate-700 dark:text-slate-200">Accounts <span className="text-slate-400 font-bold">· tap to open</span></h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {data.cards.map(({ a, monthly, due, overdue, bills }) => (
              <button key={a.name} type="button" onClick={() => onOpenAccount(a.name)}
                className="text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl ${avatarClass(a.name)} text-white flex items-center justify-center text-[12px] font-black shrink-0`}>{initials(a.name)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-slate-900 dark:text-white truncate">{a.name}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1"><TypeIcon type={a.type} className="w-3 h-3" />{a.type === 'property' ? 'Property' : a.type === 'other' ? 'Other' : 'Person'} · {bills} bill{bills === 1 ? '' : 's'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </div>
                <div className="mt-2.5 flex items-end justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Monthly</p>
                    <p className="text-[15px] font-black tabular-nums text-slate-900 dark:text-white">{money(monthly)}</p>
                  </div>
                  <div className="text-right">
                    {overdue > 0 ? <p className="text-[10px] font-black text-rose-600">{overdue} overdue</p> : <p className="text-[10px] text-slate-400">{due > 0 ? `${money(due)} to pay` : 'All paid'}</p>}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-2"><div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${Math.max(4, (monthly / maxMonthly) * 100)}%` }} /></div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800"><h2 className="text-[11px] font-black text-slate-700 dark:text-slate-200">Recent activity</h2></div>
          {data.recent.length === 0 ? <p className="px-3 py-6 text-center text-[12px] text-slate-400">No payments logged yet</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recent.map((h) => {
                const acct = accountNameOf(h.taggedFor);
                return (
                  <li key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="text-[10px] font-bold text-slate-400 w-14 shrink-0 tabular-nums">{new Date(String(h.paidDate).slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                    <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate flex-1">{h.paymentName}</p>
                    <button type="button" onClick={() => onOpenAccount(acct)} className="text-[10px] font-bold text-violet-600 hover:underline shrink-0">{acct}</button>
                    <span className="text-[12px] font-black tabular-nums text-slate-900 dark:text-white shrink-0">{money(h.amount, h.currency)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
