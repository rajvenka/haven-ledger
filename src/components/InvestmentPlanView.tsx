import React, { useState } from 'react';
import { Trash2, ClipboardList } from 'lucide-react';

interface WorkspaceMemberLite {
  uid: string;
  displayName?: string;
  email: string;
}

interface InvestmentPlanViewProps {
  workspaceName?: string;
  workspaceMembers: WorkspaceMemberLite[];
  isReadOnly?: boolean;
  portfolioContributions: any[];
  addPortfolioContribution: (memberUserId: string, amount: number, date: string, notes?: string, contributionType?: 'one_off' | 'recurring') => Promise<void>;
  portfolioRecurringPlans: any[];
  addPortfolioRecurringPlan: (memberUserId: string, amount: number, frequency: 'monthly' | 'quarterly' | 'yearly', startDate: string, dayOfMonth?: number) => Promise<void>;
  updatePortfolioRecurringPlan: (id: string, updates: { active?: boolean; expectedAmount?: number }) => Promise<void>;
  deletePortfolioRecurringPlan: (id: string) => Promise<void>;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const memberName = (m: WorkspaceMemberLite) => m.displayName || m.email.split('@')[0];

export default function InvestmentPlanView(props: InvestmentPlanViewProps) {
  const {
    workspaceName, workspaceMembers, isReadOnly,
    portfolioContributions, addPortfolioContribution,
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

  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [planMemberId, setPlanMemberId] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planFrequency, setPlanFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [planStartDate, setPlanStartDate] = useState(todayStr());
  const [planDayOfMonth, setPlanDayOfMonth] = useState('1');

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

  const markTransferred = async (memberUserId: string, amount: number) => {
    await runAction(async () => {
      await addPortfolioContribution(memberUserId, amount, todayStr(), 'Recurring plan transfer', 'recurring');
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-5 text-left select-none bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{workspaceName ? `${workspaceName} Investment Plan` : 'Investment Plan'}</h2>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{formError}</div>
      )}

      {portfolioRecurringPlans.some(p => p.active) && (
        <div className="apple-card p-4 space-y-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fund Transfer Status</span>
          <p className="text-[9px] text-slate-400">Who's transferred their share for the current period, and who hasn't yet.</p>
          <div className="space-y-2">
            {portfolioRecurringPlans.filter(p => p.active).map(plan => {
              const m = workspaceMembers.find(x => x.uid === plan.member_user_id);
              const period = getPeriodBounds(plan.frequency);
              const transferredThisPeriod = portfolioContributions
                .filter(c => c.member_user_id === plan.member_user_id)
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
        <p className="text-[10px] text-slate-400">What each person is expected to contribute on a schedule — separate from your Bills, and separate from the actual amounts logged in Contributions.</p>

        {isAddingPlan && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!planMemberId || !planAmount) return;
              await runAction(async () => {
                await addPortfolioRecurringPlan(planMemberId, parseFloat(planAmount), planFrequency, planStartDate, planFrequency === 'monthly' ? parseInt(planDayOfMonth) : undefined);
                setPlanAmount(''); setIsAddingPlan(false);
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
