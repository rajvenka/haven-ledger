import React, { useState, useMemo } from 'react';
import { Trash2, Users, Wallet, Edit2, CheckCircle2, X, ClipboardList, Banknote, AlertTriangle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface WorkspaceMemberLite {
  uid: string;
  displayName?: string;
  email: string;
}

interface InvestmentPlanViewProps {
  workspaceName?: string;
  workspaceMembers: WorkspaceMemberLite[];
  isReadOnly?: boolean;
  currentUserId?: string;
  portfolioSplits: any[];
  addPortfolioSplit: (memberUserId: string, percent: number, from: string, to?: string) => Promise<void>;
  deletePortfolioSplit: (id: string) => Promise<void>;
  portfolioContributions: any[];
  addPortfolioContribution: (memberUserId: string, amount: number, date: string, notes?: string, contributionType?: 'one_off' | 'recurring') => Promise<void>;
  updatePortfolioContribution: (id: string, updates: { amount?: number; contributionDate?: string }) => Promise<void>;
  deletePortfolioContribution: (id: string) => Promise<void>;
  portfolioWithdrawals: any[];
  addPortfolioWithdrawal: (memberUserId: string, amount: number, date: string, notes?: string) => Promise<void>;
  deletePortfolioWithdrawal: (id: string) => Promise<void>;
  portfolioCashBalances: any[];
  setPortfolioCashBalance: (location: 'Zerodha' | 'Groww' | 'Bank' | 'Other', amount: number, asOfDate?: string, notes?: string) => Promise<void>;
  deletePortfolioCashBalance: (id: string) => Promise<void>;
  portfolioRecurringPlans: any[];
  addPortfolioRecurringPlan: (memberUserId: string, amount: number, frequency: 'monthly' | 'quarterly' | 'yearly', startDate: string, dayOfMonth?: number, notes?: string) => Promise<void>;
  updatePortfolioRecurringPlan: (id: string, updates: { active?: boolean; expectedAmount?: number }) => Promise<void>;
  deletePortfolioRecurringPlan: (id: string) => Promise<void>;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const memberName = (m: WorkspaceMemberLite) => m.displayName || m.email.split('@')[0];

export default function InvestmentPlanView(props: InvestmentPlanViewProps) {
  const {
    workspaceName, workspaceMembers, isReadOnly, currentUserId,
    portfolioSplits, addPortfolioSplit, deletePortfolioSplit,
    portfolioContributions, addPortfolioContribution, updatePortfolioContribution, deletePortfolioContribution,
    portfolioWithdrawals, addPortfolioWithdrawal, deletePortfolioWithdrawal,
    portfolioCashBalances, setPortfolioCashBalance, deletePortfolioCashBalance,
    portfolioRecurringPlans, addPortfolioRecurringPlan, updatePortfolioRecurringPlan, deletePortfolioRecurringPlan,
  } = props;

  const [formError, setFormError] = useState<string | null>(null);
  const runAction = async (fn: () => Promise<any>) => {
    setFormError(null);
    try {
      await fn();
    } catch (err: any) {
      console.error('Investment plan action failed:', err);
      setFormError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  const currentSplits = workspaceMembers.map(m => {
    const today = todayStr();
    const active = portfolioSplits.find(s => s.member_user_id === m.uid && s.effective_from <= today && (!s.effective_to || s.effective_to >= today));
    return { member: m, percent: active?.split_percent ?? 0 };
  });

  const [isAddingSplit, setIsAddingSplit] = useState(false);
  const [splitMemberId, setSplitMemberId] = useState('');
  const [splitPercent, setSplitPercent] = useState('');
  const [splitFrom, setSplitFrom] = useState(todayStr());
  const [splitTo, setSplitTo] = useState('');

  const [isAddingContribution, setIsAddingContribution] = useState(false);
  const [cMemberId, setCMemberId] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [cDate, setCDate] = useState(todayStr());
  const [cNotes, setCNotes] = useState('');
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [editContributionAmount, setEditContributionAmount] = useState('');
  const [editContributionDate, setEditContributionDate] = useState('');

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cMemberId || !cAmount) return;
    await runAction(async () => {
      await addPortfolioContribution(cMemberId, parseFloat(cAmount), cDate, cNotes.trim() || undefined);
      setCAmount(''); setCNotes(''); setIsAddingContribution(false);
    });
  };

  const [isAddingWithdrawal, setIsAddingWithdrawal] = useState(false);
  const [wMemberId, setWMemberId] = useState('');
  const [wAmount, setWAmount] = useState('');
  const [wDate, setWDate] = useState(todayStr());

  // ---- Cash Balance ----
  const CASH_LOCATIONS: ('Zerodha' | 'Groww' | 'Bank' | 'Other')[] = ['Zerodha', 'Groww', 'Bank', 'Other'];
  const [editingCashLocation, setEditingCashLocation] = useState<string | null>(null);
  const [cashAmountInput, setCashAmountInput] = useState('');

  const handleAddWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wMemberId || !wAmount) return;
    await runAction(async () => {
      await addPortfolioWithdrawal(wMemberId, parseFloat(wAmount), wDate);
      setWAmount(''); setIsAddingWithdrawal(false);
    });
  };

  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [planMemberId, setPlanMemberId] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planFrequency, setPlanFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [planStartDate, setPlanStartDate] = useState(todayStr());
  const [planDayOfMonth, setPlanDayOfMonth] = useState('1');
  const [planNotes, setPlanNotes] = useState('');

  const getPeriodBounds = (frequency: 'monthly' | 'quarterly' | 'yearly', ref = new Date()) => {
    if (frequency === 'monthly') {
      return {
        start: new Date(ref.getFullYear(), ref.getMonth(), 1),
        end: new Date(ref.getFullYear(), ref.getMonth() + 1, 0),
        label: ref.toLocaleString('default', { month: 'long', year: 'numeric' }),
      };
    }
    if (frequency === 'quarterly') {
      const q = Math.floor(ref.getMonth() / 3);
      return {
        start: new Date(ref.getFullYear(), q * 3, 1),
        end: new Date(ref.getFullYear(), q * 3 + 3, 0),
        label: `Q${q + 1} ${ref.getFullYear()}`,
      };
    }
    return {
      start: new Date(ref.getFullYear(), 0, 1),
      end: new Date(ref.getFullYear(), 11, 31),
      label: String(ref.getFullYear()),
    };
  };

  // My own contribution reminder - due within 3 days (or already overdue) and not yet
  // transferred for the current period. Computed live whenever the page loads, no backend
  // job involved - only shows for the logged-in person's own plan(s).
  const myContributionReminder = useMemo(() => {
    if (!currentUserId) return null;
    const myPlans = portfolioRecurringPlans.filter(p => p.active && p.member_user_id === currentUserId);
    for (const plan of myPlans) {
      const period = getPeriodBounds(plan.frequency);
      const dueDate = plan.frequency === 'monthly' && plan.day_of_month
        ? new Date(period.start.getFullYear(), period.start.getMonth(), Number(plan.day_of_month))
        : period.end;
      const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
      if (daysUntilDue > 3) continue;

      const transferredThisPeriod = portfolioContributions
        .filter(c => c.member_user_id === currentUserId && c.contribution_type === 'recurring')
        .filter(c => { const d = new Date(c.contribution_date); return d >= period.start && d <= period.end; })
        .reduce((s, c) => s + Number(c.amount), 0);
      const remaining = Math.max(0, Number(plan.expected_amount) - transferredThisPeriod);
      if (remaining === 0) continue;

      return { plan, remaining, daysUntilDue, dueDate };
    }
    return null;
  }, [currentUserId, portfolioRecurringPlans, portfolioContributions]);

  const markTransferred = async (memberUserId: string, amount: number) => {
    await runAction(async () => {
      await addPortfolioContribution(memberUserId, amount, todayStr(), 'Recurring plan transfer', 'recurring');
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-5 text-left bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{workspaceName ? `${workspaceName} Investment Plan` : 'Investment Plan'}</h2>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{formError}</div>
      )}

      {myContributionReminder && (
        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${myContributionReminder.daysUntilDue < 0 ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'}`}>
          <AlertTriangle className={`w-5 h-5 shrink-0 ${myContributionReminder.daysUntilDue < 0 ? 'text-rose-500' : 'text-amber-500'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${myContributionReminder.daysUntilDue < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {myContributionReminder.daysUntilDue < 0
                ? `Your contribution is overdue by ${Math.abs(myContributionReminder.daysUntilDue)} day${Math.abs(myContributionReminder.daysUntilDue) !== 1 ? 's' : ''}`
                : myContributionReminder.daysUntilDue === 0
                ? 'Your contribution is due today'
                : `Your contribution is due in ${myContributionReminder.daysUntilDue} day${myContributionReminder.daysUntilDue !== 1 ? 's' : ''}`}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{fmt(myContributionReminder.remaining)} remaining for this {myContributionReminder.plan.frequency} period</p>
          </div>
          {!isReadOnly && (
            <button
              onClick={() => runAction(() => markTransferred(currentUserId!, myContributionReminder.remaining))}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer shrink-0"
            >
              Mark Transferred
            </button>
          )}
        </div>
      )}

      {portfolioContributions.length > 0 && (() => {
        const events = [
          ...portfolioContributions.map((c: any) => ({ date: c.contribution_date, delta: Number(c.amount) })),
          ...portfolioWithdrawals.map((w: any) => ({ date: w.withdrawal_date, delta: -Number(w.amount) })),
        ].sort((a, b) => a.date.localeCompare(b.date));
        let running = 0;
        const chartData = events.map(e => { running += e.delta; return { date: e.date, total: running }; });
        return (
          <div className="apple-card p-4 space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Contribution Growth</span>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                  <Tooltip formatter={(v: number) => [fmt(v), 'Total Contributed']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {workspaceMembers.length > 0 && (() => {
        const chartData = workspaceMembers.map(m => {
          const contributed = portfolioContributions.filter((c: any) => c.member_user_id === m.uid).reduce((s: number, c: any) => s + Number(c.amount), 0);
          const withdrawn = portfolioWithdrawals.filter((w: any) => w.member_user_id === m.uid).reduce((s: number, w: any) => s + Number(w.amount), 0);
          return { name: memberName(m), amount: contributed - withdrawn };
        });
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
        return (
          <div className="apple-card p-4 space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Contribution by Person</span>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                  <Tooltip formatter={(v: number) => [fmt(v), 'Net Contributed']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      <div className="apple-card p-4 space-y-3">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Split Among Workspace Members</span>
        <p className="text-[9px] text-slate-400">Everyone here is a member of this workspace. To add someone new, invite them via Family Sharing first.</p>
        <div className="space-y-1.5">
          {currentSplits.map(({ member, percent }) => (
            <div key={member.uid} className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{memberName(member)}</span>
              <span className="font-black text-slate-900 dark:text-white">{percent}%</span>
            </div>
          ))}
        </div>

        {!isReadOnly && (
        <>
        <button onClick={() => setIsAddingSplit(!isAddingSplit)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Set Split for a Period</button>
        {isAddingSplit && (
          <form
            onSubmit={async (e) => { e.preventDefault(); if (!splitMemberId || !splitPercent) return; await runAction(async () => { await addPortfolioSplit(splitMemberId, parseFloat(splitPercent), splitFrom, splitTo || undefined); setSplitPercent(''); setIsAddingSplit(false); }); }}
            className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-900"
          >
            <select value={splitMemberId} onChange={(e) => setSplitMemberId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
              <option value="">Select person</option>
              {workspaceMembers.map(m => <option key={m.uid} value={m.uid}>{memberName(m)}</option>)}
            </select>
            <input type="number" value={splitPercent} onChange={(e) => setSplitPercent(e.target.value)} placeholder="% e.g. 50" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
            <input type="date" value={splitFrom} onChange={(e) => setSplitFrom(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
            <input type="date" value={splitTo} onChange={(e) => setSplitTo(e.target.value)} placeholder="End (optional)" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
            <button type="submit" className="col-span-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Save Split</button>
          </form>
        )}
        </>
        )}
        {portfolioSplits.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-900 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Split History</span>
            {portfolioSplits.map(s => {
              const m = workspaceMembers.find(x => x.uid === s.member_user_id);
              return (
                <div key={s.id} className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{m ? memberName(m) : 'Former member'} — {s.split_percent}% ({s.effective_from} → {s.effective_to || 'ongoing'})</span>
                  {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioSplit(s.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="apple-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Contribution Log</span>
          {!isReadOnly && <button onClick={() => setIsAddingContribution(!isAddingContribution)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Log One-Off Payment</button>}
        </div>
        {isAddingContribution && (
          <form onSubmit={handleAddContribution} className="grid grid-cols-3 gap-2">
            <select value={cMemberId} onChange={(e) => setCMemberId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
              <option value="">Who</option>
              {workspaceMembers.map(m => <option key={m.uid} value={m.uid}>{memberName(m)}</option>)}
            </select>
            <input type="number" value={cAmount} onChange={(e) => setCAmount(e.target.value)} placeholder="Amount" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
            <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
            <textarea value={cNotes} onChange={(e) => setCNotes(e.target.value)} placeholder="Notes (optional) - e.g. bonus deposit, salary top-up" rows={2} className="col-span-3 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs resize-none" />
            <button type="submit" className="col-span-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Add</button>
          </form>
        )}
        <div className="divide-y divide-slate-100 dark:divide-slate-900">
          {portfolioContributions.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-4">No contributions logged yet.</p>
          ) : portfolioContributions.map(c => {
            const m = workspaceMembers.find(x => x.uid === c.member_user_id);
            const isEditing = editingContributionId === c.id;
            return (
              <div key={c.id} className="py-2 flex items-center justify-between text-xs gap-2">
                {isEditing ? (
                  <>
                    <input type="date" value={editContributionDate} onChange={(e) => setEditContributionDate(e.target.value)} className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[11px]" />
                    <input type="number" value={editContributionAmount} onChange={(e) => setEditContributionAmount(e.target.value)} className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[11px]" />
                    <button
                      onClick={() => runAction(async () => {
                        await updatePortfolioContribution(c.id, { amount: parseFloat(editContributionAmount), contributionDate: editContributionDate });
                        setEditingContributionId(null);
                      })}
                      className="p-1 bg-indigo-600 text-white rounded-md cursor-pointer"
                    ><CheckCircle2 className="w-3 h-3" /></button>
                    <button onClick={() => setEditingContributionId(null)} className="p-1 text-slate-400 cursor-pointer"><X className="w-3 h-3" /></button>
                  </>
                ) : (
                  <>
                    <span className="text-slate-600 dark:text-slate-300 min-w-0">
                      <span className="flex items-center gap-1.5">
                        {m ? memberName(m) : 'Former member'} · {c.contribution_date}
                        {c.contribution_type === 'recurring' && (
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full">Plan</span>
                        )}
                      </span>
                      {c.notes && <span className="text-[10px] text-slate-400 italic block">{c.notes}</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{fmt(Number(c.amount))}</span>
                      {!isReadOnly && (
                        <button
                          onClick={() => { setEditingContributionId(c.id); setEditContributionAmount(String(c.amount)); setEditContributionDate(c.contribution_date); }}
                          className="text-slate-300 hover:text-indigo-500 cursor-pointer"
                        ><Edit2 className="w-3 h-3" /></button>
                      )}
                      {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioContribution(c.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="apple-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Withdrawals</span>
          {!isReadOnly && <button onClick={() => setIsAddingWithdrawal(!isAddingWithdrawal)} className="text-[10px] font-bold text-rose-500 cursor-pointer">+ Log Withdrawal</button>}
        </div>
        <p className="text-[9px] text-slate-400">Money taken out of the pool back to a person - separate from selling a stock, which stays in the pool as cash.</p>
        {isAddingWithdrawal && (
          <form onSubmit={handleAddWithdrawal} className="grid grid-cols-3 gap-2">
            <select value={wMemberId} onChange={(e) => setWMemberId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
              <option value="">Who</option>
              {workspaceMembers.map(m => <option key={m.uid} value={m.uid}>{memberName(m)}</option>)}
            </select>
            <input type="number" value={wAmount} onChange={(e) => setWAmount(e.target.value)} placeholder="Amount" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
            <input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
            <button type="submit" className="col-span-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Withdraw</button>
          </form>
        )}
        <div className="divide-y divide-slate-100 dark:divide-slate-900">
          {portfolioWithdrawals.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-4">No withdrawals logged.</p>
          ) : portfolioWithdrawals.map(w => {
            const m = workspaceMembers.find(x => x.uid === w.member_user_id);
            return (
              <div key={w.id} className="py-2 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">{m ? memberName(m) : 'Former member'} · {w.withdrawal_date}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-rose-500">-{fmt(Number(w.amount))}</span>
                  {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioWithdrawal(w.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="apple-card p-4 space-y-3">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Cash Balance</span>
        <p className="text-[9px] text-slate-400">Uninvested cash sitting in each location - contributed but not yet deployed into holdings.</p>
        <div className="grid grid-cols-2 gap-2">
          {CASH_LOCATIONS.map(loc => {
            const existing = portfolioCashBalances.find((c: any) => c.location === loc);
            const isEditing = editingCashLocation === loc;
            return (
              <div key={loc} className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">{loc}</span>
                {isEditing ? (
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      value={cashAmountInput}
                      onChange={(e) => setCashAmountInput(e.target.value)}
                      autoFocus
                      className="w-full px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
                    />
                    <button
                      onClick={() => runAction(async () => {
                        await setPortfolioCashBalance(loc, parseFloat(cashAmountInput) || 0);
                        setEditingCashLocation(null);
                      })}
                      className="p-1.5 bg-indigo-600 text-white rounded-md cursor-pointer shrink-0"
                    ><CheckCircle2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingCashLocation(null)} className="p-1.5 text-slate-400 cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900 dark:text-white">{fmt(Number(existing?.amount ?? 0))}</span>
                    {!isReadOnly && (
                      <button
                        onClick={() => { setEditingCashLocation(loc); setCashAmountInput(String(existing?.amount ?? '')); }}
                        className="text-slate-300 hover:text-indigo-500 cursor-pointer"
                      ><Edit2 className="w-3 h-3" /></button>
                    )}
                  </div>
                )}
                {existing?.as_of_date && <span className="text-[8px] text-slate-400 block mt-1">as of {existing.as_of_date}</span>}
              </div>
            );
          })}
        </div>
        <div className="pt-1 flex justify-between text-xs">
          <span className="font-bold text-slate-500">Total Cash</span>
          <span className="font-black text-slate-900 dark:text-white">{fmt(portfolioCashBalances.reduce((s: number, c: any) => s + Number(c.amount), 0))}</span>
        </div>
      </div>

      {portfolioRecurringPlans.some(p => p.active) && (
        <div className="apple-card p-4 space-y-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fund Transfer Status</span>
          <p className="text-[9px] text-slate-400">Who's transferred their share for the current period, and who hasn't yet.</p>
          <div className="space-y-2">
            {portfolioRecurringPlans.filter(p => p.active).map(plan => {
              const m = workspaceMembers.find(x => x.uid === plan.member_user_id);
              const period = getPeriodBounds(plan.frequency);
              const transferredThisPeriod = portfolioContributions
                .filter(c => c.member_user_id === plan.member_user_id && c.contribution_type === 'recurring')
                .filter(c => { const d = new Date(c.contribution_date); return d >= period.start && d <= period.end; })
                .reduce((s, c) => s + Number(c.amount), 0);
              const remaining = Math.max(0, Number(plan.expected_amount) - transferredThisPeriod);
              const fulfilled = remaining === 0;
              return (
                <div key={plan.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{m ? memberName(m) : 'Former member'}</p>
                    <p className="text-[10px] text-slate-400">{period.label} · expected {fmt(Number(plan.expected_amount))}{transferredThisPeriod > 0 && !fulfilled ? ` · transferred ${fmt(transferredThisPeriod)} so far` : ''}</p>
                  </div>
                  {fulfilled ? (
                    <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase rounded-full shrink-0">Transferred</span>
                  ) : !isReadOnly ? (
                    <button
                      onClick={() => markTransferred(plan.member_user_id, remaining)}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase rounded-lg cursor-pointer shrink-0"
                    >
                      Mark {fmt(remaining)} Transferred
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase rounded-full shrink-0">Pending</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="apple-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Recurring Contribution Plan</span>
          {!isReadOnly && <button onClick={() => setIsAddingPlan(!isAddingPlan)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Add Plan</button>}
        </div>
        <p className="text-[10px] text-slate-400">What each person is expected to contribute on a schedule — separate from your Bills.</p>

        {isAddingPlan && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!planMemberId || !planAmount) return;
              await runAction(async () => {
                await addPortfolioRecurringPlan(planMemberId, parseFloat(planAmount), planFrequency, planStartDate, planFrequency === 'monthly' ? parseInt(planDayOfMonth) : undefined, planNotes.trim() || undefined);
                setPlanAmount(''); setPlanNotes(''); setIsAddingPlan(false);
              });
            }}
            className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-900"
          >
            <select value={planMemberId} onChange={(e) => setPlanMemberId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
              <option value="">Who</option>
              {workspaceMembers.map(m => <option key={m.uid} value={m.uid}>{memberName(m)}</option>)}
            </select>
            <input type="number" value={planAmount} onChange={(e) => setPlanAmount(e.target.value)} placeholder="Amount" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
            <select value={planFrequency} onChange={(e) => setPlanFrequency(e.target.value as any)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
            {planFrequency === 'monthly' && (
              <input type="number" min="1" max="31" value={planDayOfMonth} onChange={(e) => setPlanDayOfMonth(e.target.value)} placeholder="Day of month" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
            )}
            <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs col-span-2" />
            <textarea value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="col-span-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs resize-none" />
            <button type="submit" className="col-span-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Save Plan</button>
          </form>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-900">
          {portfolioRecurringPlans.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-4">No recurring plan set up yet.</p>
          ) : portfolioRecurringPlans.map(plan => {
            const m = workspaceMembers.find(x => x.uid === plan.member_user_id);
            return (
              <div key={plan.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{m ? memberName(m) : 'Former member'}</p>
                  <p className="text-[10px] text-slate-400">{fmt(Number(plan.expected_amount))} · {plan.frequency}{plan.day_of_month ? ` on day ${plan.day_of_month}` : ''} · from {plan.start_date}</p>
                  {plan.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">{plan.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isReadOnly && (
                    <button
                      onClick={() => runAction(() => updatePortfolioRecurringPlan(plan.id, { active: !plan.active }))}
                      className={`px-2 py-1 text-[9px] font-black uppercase rounded-full cursor-pointer ${plan.active ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                    >
                      {plan.active ? 'Active' : 'Paused'}
                    </button>
                  )}
                  {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioRecurringPlan(plan.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
