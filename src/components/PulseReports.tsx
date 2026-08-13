/**
 * Pulse Reports — Pulse 1 first-pass redesign.
 * Overview tiles + dividends / fees / snapshots activity.
 * Deep charts remain available in Classic until Pulse 2.
 */
import React, { useMemo, useState } from 'react';
import { Gift, Receipt, FileBarChart, Trash2, Plus, X, Check } from 'lucide-react';

export default function PulseReports(props: any) {
  const {
    isReadOnly,
    workspaceName,
    baseCurrency = 'INR',
    portfolioHoldings = [],
    portfolioDividends = [],
    portfolioFees = [],
    portfolioSnapshots = [],
    addPortfolioDividend,
    deletePortfolioDividend,
    addPortfolioFee,
    deletePortfolioFee,
    takePortfolioSnapshot,
    deletePortfolioSnapshotBatch,
  } = props;

  const [tab, setTab] = useState<'overview' | 'dividends' | 'fees' | 'snapshots'>('overview');
  const [addDiv, setAddDiv] = useState(false);
  const [addFee, setAddFee] = useState(false);
  const [sym, setSym] = useState('');
  const [amt, setAmt] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [broker, setBroker] = useState('');
  const [feeType, setFeeType] = useState('brokerage');
  const [busy, setBusy] = useState(false);

  const active = useMemo(
    () => (portfolioHoldings || []).filter((h: any) => !h.sold_at && Number(h.quantity) > 0),
    [portfolioHoldings]
  );

  const byCcy = useMemo(() => {
    const map: Record<string, { market: number; cost: number; count: number }> = {};
    active.forEach((h: any) => {
      const ccy = String(h.currency || baseCurrency).toUpperCase();
      if (!map[ccy]) map[ccy] = { market: 0, cost: 0, count: 0 };
      const qty = Number(h.quantity) || 0;
      const live = Number(h.live_price ?? h.current_price ?? h.buy_price) || 0;
      const buy = Number(h.buy_price) || 0;
      map[ccy].market += qty * live;
      map[ccy].cost += qty * buy;
      map[ccy].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].market - a[1].market);
  }, [active, baseCurrency]);

  const divTotal = useMemo(
    () => (portfolioDividends || []).reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0),
    [portfolioDividends]
  );
  const feeTotal = useMemo(
    () => (portfolioFees || []).reduce((s: number, f: any) => s + (Number(f.amount) || 0), 0),
    [portfolioFees]
  );

  const money = (n: number, ccy = baseCurrency) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${n.toFixed(0)} ${ccy}`;
    }
  };

  const saveDiv = async () => {
    if (!addPortfolioDividend || !sym.trim() || !amt) return;
    setBusy(true);
    try {
      await addPortfolioDividend(sym.trim().toUpperCase(), Number(amt), date);
      setAddDiv(false);
      setSym('');
      setAmt('');
    } finally {
      setBusy(false);
    }
  };

  const saveFee = async () => {
    if (!addPortfolioFee || !amt) return;
    setBusy(true);
    try {
      await addPortfolioFee(broker || 'General', feeType, Number(amt), date);
      setAddFee(false);
      setAmt('');
      setBroker('');
    } finally {
      setBusy(false);
    }
  };

  const snapToday = async () => {
    if (!takePortfolioSnapshot) return;
    setBusy(true);
    try {
      const groups = byCcy.map(([ccy, v]) => ({
        label: ccy,
        invested: v.cost,
        current: v.market,
      }));
      await takePortfolioSnapshot(new Date().toISOString().slice(0, 10), groups);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full">
      <div className="shrink-0 px-3 sm:px-4 pt-2 pb-2 space-y-2.5">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-violet-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/20 p-3 sm:p-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <FileBarChart className="w-5 h-5 text-violet-500 shrink-0" />
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {workspaceName ? `${workspaceName} Reports` : 'Reports'}
            </h1>
            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-600/90 text-white">
              Pulse
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
            {active.length} active holdings
            {portfolioDividends?.length ? ` · ${portfolioDividends.length} dividends` : ''}
            {portfolioFees?.length ? ` · ${portfolioFees.length} fees` : ''}
            {portfolioSnapshots?.length ? ` · ${portfolioSnapshots.length} snapshots` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-violet-500/80 dark:text-violet-400/80 w-10">
            View
          </span>
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-violet-100/80 dark:bg-violet-950/50 border border-violet-200/60 dark:border-violet-900/60">
            {(
              [
                ['overview', 'Overview'],
                ['dividends', 'Dividends'],
                ['fees', 'Fees'],
                ['snapshots', 'Snapshots'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                  tab === id
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                    : 'text-violet-700/70 dark:text-violet-300/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 pb-28 space-y-3 pt-2">
        {tab === 'overview' && (
          <>
            {byCcy.map(([ccy, v]) => {
              const pnl = v.market - v.cost;
              return (
                <div
                  key={ccy}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black text-slate-500">{ccy} · {v.count} holdings</p>
                    <p className={`text-[11px] font-black ${pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {pnl >= 0 ? '+' : ''}
                      {money(pnl, ccy)}
                    </p>
                  </div>
                  <p className="text-[18px] font-black tabular-nums mt-1">{money(v.market, ccy)}</p>
                  <p className="text-[10px] text-slate-400 font-bold">Cost {money(v.cost, ccy)}</p>
                </div>
              );
            })}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/15 p-3">
                <Gift className="w-4 h-4 text-emerald-600 mb-1" />
                <p className="text-[9px] font-black uppercase text-slate-400">Dividends</p>
                <p className="text-[14px] font-black">{money(divTotal)}</p>
              </div>
              <div className="rounded-2xl border border-rose-200/70 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/15 p-3">
                <Receipt className="w-4 h-4 text-rose-600 mb-1" />
                <p className="text-[9px] font-black uppercase text-slate-400">Fees</p>
                <p className="text-[14px] font-black">{money(feeTotal)}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 px-1">
              Full charts & movement reports stay in Classic for now — Pulse 2 will redesign them.
            </p>
          </>
        )}

        {tab === 'dividends' && (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dividends</h2>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setAddDiv(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-600 text-white"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
            <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {(portfolioDividends || [])
                .slice()
                .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
                .map((d: any) => (
                  <li key={d.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold truncate">{d.symbol}</p>
                      <p className="text-[10px] text-slate-400">{d.date}</p>
                    </div>
                    <p className="text-[13px] font-black tabular-nums">{money(Number(d.amount) || 0)}</p>
                    {!isReadOnly && deletePortfolioDividend && (
                      <button type="button" onClick={() => deletePortfolioDividend(d.id)} className="text-rose-500 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              {!(portfolioDividends || []).length && (
                <li className="px-3 py-8 text-center text-[12px] text-slate-400">No dividends logged</li>
              )}
            </ul>
          </>
        )}

        {tab === 'fees' && (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fees</h2>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setAddFee(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-600 text-white"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
            <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {(portfolioFees || [])
                .slice()
                .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
                .map((f: any) => (
                  <li key={f.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold truncate">{f.broker || 'Fee'}</p>
                      <p className="text-[10px] text-slate-400">
                        {f.fee_type || f.feeType} · {f.date}
                      </p>
                    </div>
                    <p className="text-[13px] font-black tabular-nums">{money(Number(f.amount) || 0)}</p>
                    {!isReadOnly && deletePortfolioFee && (
                      <button type="button" onClick={() => deletePortfolioFee(f.id)} className="text-rose-500 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              {!(portfolioFees || []).length && (
                <li className="px-3 py-8 text-center text-[12px] text-slate-400">No fees logged</li>
              )}
            </ul>
          </>
        )}

        {tab === 'snapshots' && (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Snapshots</h2>
              {!isReadOnly && takePortfolioSnapshot && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={snapToday}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-600 text-white disabled:opacity-50"
                >
                  <FileBarChart className="w-3 h-3" /> Snapshot today
                </button>
              )}
            </div>
            <ul className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {Array.from(
                new Set((portfolioSnapshots || []).map((s: any) => s.snapshot_date || s.date))
              )
                .filter(Boolean)
                .sort()
                .reverse()
                .map((d: any) => (
                  <li key={String(d)} className="flex items-center justify-between px-3 py-2.5">
                    <p className="text-[13px] font-bold">{String(d)}</p>
                    {!isReadOnly && deletePortfolioSnapshotBatch && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete snapshot ${d}?`)) deletePortfolioSnapshotBatch(String(d));
                        }}
                        className="text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              {!(portfolioSnapshots || []).length && (
                <li className="px-3 py-8 text-center text-[12px] text-slate-400">No snapshots yet</li>
              )}
            </ul>
          </>
        )}
      </div>

      {addDiv && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 p-4 space-y-2 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between">
              <h3 className="text-sm font-black">Add dividend</h3>
              <button type="button" onClick={() => setAddDiv(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <input
              value={sym}
              onChange={(e) => setSym(e.target.value)}
              placeholder="Symbol"
              className="w-full px-3 py-2 rounded-xl border text-[13px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
            <input
              type="number"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              placeholder="Amount"
              className="w-full px-3 py-2 rounded-xl border text-[13px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-[13px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
            <button
              type="button"
              disabled={busy}
              onClick={saveDiv}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-[12px] font-bold"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {addFee && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 p-4 space-y-2 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between">
              <h3 className="text-sm font-black">Add fee</h3>
              <button type="button" onClick={() => setAddFee(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <input
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              placeholder="Broker"
              className="w-full px-3 py-2 rounded-xl border text-[13px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
            <input
              value={feeType}
              onChange={(e) => setFeeType(e.target.value)}
              placeholder="Fee type"
              className="w-full px-3 py-2 rounded-xl border text-[13px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
            <input
              type="number"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              placeholder="Amount"
              className="w-full px-3 py-2 rounded-xl border text-[13px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-[13px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
            <button
              type="button"
              disabled={busy}
              onClick={saveFee}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-[12px] font-bold"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
