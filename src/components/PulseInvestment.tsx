/**
 * Pulse Investment plan — Pulse 1 first-pass redesign.
 * Contributions, withdrawals, recurring plans.
 */
import React, { useMemo, useState } from 'react';
import { Plus, Trash2, X, TrendingUp, TrendingDown, Repeat } from 'lucide-react';

export default function PulseInvestment(props: any) {
  const {
    isReadOnly,
    currentUserId,
    baseCurrency = 'INR',
    portfolioContributions = [],
    portfolioWithdrawals = [],
    portfolioRecurringPlans = [],
    addPortfolioContribution,
    deletePortfolioContribution,
    addPortfolioWithdrawal,
    deletePortfolioWithdrawal,
    addPortfolioRecurringPlan,
    deletePortfolioRecurringPlan,
    portfolios = [],
  } = props;

  const [tab, setTab] = useState<'contributions' | 'withdrawals' | 'recurring'>('contributions');
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [portfolioId, setPortfolioId] = useState('');
  const [busy, setBusy] = useState(false);

  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: baseCurrency,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${n.toFixed(0)} ${baseCurrency}`;
    }
  };

  const contribTotal = useMemo(
    () => (portfolioContributions || []).reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0),
    [portfolioContributions]
  );
  const withTotal = useMemo(
    () => (portfolioWithdrawals || []).reduce((s: number, w: any) => s + (Number(w.amount) || 0), 0),
    [portfolioWithdrawals]
  );

  const save = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    if (!currentUserId && (tab === 'contributions' || tab === 'withdrawals')) {
      alert('User not loaded');
      return;
    }
    setBusy(true);
    try {
      if (tab === 'contributions' && addPortfolioContribution) {
        await addPortfolioContribution(
          currentUserId,
          n,
          date,
          notes || undefined,
          'one_off',
          portfolioId || undefined
        );
      } else if (tab === 'withdrawals' && addPortfolioWithdrawal) {
        await addPortfolioWithdrawal(currentUserId, n, date, notes || undefined);
      } else if (tab === 'recurring' && addPortfolioRecurringPlan) {
        await addPortfolioRecurringPlan({
          amount: n,
          frequency: 'monthly',
          notes: notes || undefined,
          portfolio_id: portfolioId || undefined,
          active: true,
        });
      }
      setOpen(false);
      setAmount('');
      setNotes('');
    } catch (e: any) {
      alert(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const list =
    tab === 'contributions'
      ? portfolioContributions
      : tab === 'withdrawals'
        ? portfolioWithdrawals
        : portfolioRecurringPlans;

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full">
      <div className="shrink-0 px-3 sm:px-4 pt-2 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Investment plan
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-600 text-white">
                Pulse
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold">
              In {money(contribTotal)} · Out {money(withTotal)} · Net {money(contribTotal - withTotal)}
            </p>
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {(
            [
              ['contributions', 'Contributions', TrendingUp],
              ['withdrawals', 'Withdrawals', TrendingDown],
              ['recurring', 'Recurring', Repeat],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                tab === id ? 'bg-violet-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 pb-28 pt-2">
        <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {(list || [])
            .slice()
            .sort((a: any, b: any) => String(b.contribution_date || b.withdrawal_date || b.date || b.created_at || '').localeCompare(String(a.contribution_date || a.withdrawal_date || a.date || a.created_at || '')))
            .map((row: any) => (
              <li key={row.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold tabular-nums">{money(Number(row.amount) || 0)}</p>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    {row.contribution_date || row.withdrawal_date || row.date || row.frequency || '—'}
                    {row.notes ? ` · ${row.notes}` : ''}
                  </p>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm('Delete?')) return;
                      if (tab === 'contributions') deletePortfolioContribution?.(row.id);
                      else if (tab === 'withdrawals') deletePortfolioWithdrawal?.(row.id);
                      else deletePortfolioRecurringPlan?.(row.id);
                    }}
                    className="text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          {!(list || []).length && (
            <li className="px-3 py-10 text-center text-[12px] text-slate-400">No entries yet</li>
          )}
        </ul>
        <p className="text-[10px] text-slate-400 mt-3 px-1">
          Cash targets & advanced plan tools remain in Classic until Pulse 2 deepens this screen.
        </p>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 p-4 space-y-2 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between">
              <h3 className="text-sm font-black">
                Add {tab === 'contributions' ? 'contribution' : tab === 'withdrawals' ? 'withdrawal' : 'recurring'}
              </h3>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="w-full px-3 py-2 rounded-xl border text-[13px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
            {tab !== 'recurring' && (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-[13px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />
            )}
            {(portfolios || []).length > 0 && (
              <select
                value={portfolioId}
                onChange={(e) => setPortfolioId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-[13px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              >
                <option value="">Default portfolio</option>
                {(portfolios || []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              className="w-full px-3 py-2 rounded-xl border text-[13px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-[12px] font-bold disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
