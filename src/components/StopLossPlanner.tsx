import React, { useMemo, useState } from 'react';

type Props = { rows: any[]; ccy: string; fx: (n: number, from: string, to: string) => number; money: (n: number, c: string) => string };

const PRESETS: { k: string; label: string; pct: number | null }[] = [
  { k: 'cur', label: 'Current stops', pct: null },
  { k: '1', label: '1% below price', pct: 1 },
  { k: '3', label: '3% below price', pct: 3 },
  { k: '5', label: '5% below price', pct: 5 },
  { k: '10', label: '10% below price', pct: 10 },
];

export default function StopLossPlanner({ rows, ccy, fx, money }: Props) {
  const [mine, setMine] = useState<Record<string, string>>({});
  const [preset, setPreset] = useState('cur');

  const data = useMemo(() => {
    return rows
      .filter((r) => Number(r.h?.leverage) > 1 && Number(r.h?.etoro_net_value_amount) > 0 && r.price > 0)
      .map((r) => {
        const perUnit = fx(1, r.native || 'USD', 'USD'); // USD per native price unit
        const netUsd = Number(r.h.etoro_net_value_amount);
        const valueAt = (s: number | null) => (s != null && s > 0 && s < r.price * 1.0001 ? Math.max(0, netUsd + r.qty * perUnit * (s - r.price)) : null);
        // A stop far outside the live price (e.g. index quoted in another currency) can't be trusted.
        const stopOk = r.stop != null && r.stop > r.price * 0.05 && r.stop < r.price;
        return { r, netUsd, valueAt, stop: stopOk ? (r.stop as number) : null };
      })
      .sort((a, b) => b.netUsd - a.netUsd);
  }, [rows, fx]);

  const conv = (usd: number) => fx(usd, 'USD', ccy);
  const newStopOf = (d: any): number | null => {
    const typed = mine[d.r.id];
    if (typed !== undefined && typed !== '') { const n = parseFloat(typed); return Number.isFinite(n) ? n : null; }
    const p = PRESETS.find((x) => x.k === preset);
    if (p && p.pct != null) return Math.round(d.r.price * (1 - p.pct / 100) * 100) / 100;
    return d.stop;
  };

  const tot = data.reduce((t, d) => {
    const cur = d.valueAt(d.stop); const ns = d.valueAt(newStopOf(d));
    t.now += d.netUsd; t.cur += cur ?? d.netUsd; t.next += ns ?? cur ?? d.netUsd; return t;
  }, { now: 0, cur: 0, next: 0 });

  if (!data.length) return <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500">No leveraged eToro positions with a net value found in this portfolio. Run an eToro sync first.</div>;

  const th = 'p-2.5 text-right whitespace-nowrap';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <div className="text-sm font-black">Stop-loss planner</div>
          <div className="text-[11px] text-slate-500">Money you'd get back if the stop is hit (eToro net value now ± price move × units). Excludes fees. Change stops on eToro itself.</div>
        </div>
        <div className="flex items-center gap-2">
          <select value={preset} onChange={(e) => { setPreset(e.target.value); setMine({}); }} className="text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5">
            {PRESETS.map((p) => <option key={p.k} value={p.k}>{p.label}</option>)}
          </select>
          {Object.keys(mine).length > 0 && <button onClick={() => setMine({})} className="text-[11px] font-black text-indigo-600">Reset typed</button>}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase tracking-wider text-slate-400">
            <tr><th className="text-left p-2.5">Stock</th><th className={th}>Units</th><th className={th}>Price</th><th className={th}>Current stop</th><th className={th}>Net value now</th><th className={th}>At current stop</th><th className={th}>New stop</th><th className={th}>At new stop</th><th className={th}>Gain vs current stop</th></tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const ns = newStopOf(d); const cur = d.valueAt(d.stop); const nv = d.valueAt(ns);
              const bad = ns != null && ns >= d.r.price;
              const gain = nv != null && cur != null ? nv - cur : null;
              return (
                <tr key={d.r.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-2.5 font-black whitespace-nowrap">{d.r.symbol} <span className="text-[10px] font-bold text-slate-400">{d.r.portfolio}</span></td>
                  <td className="p-2.5 text-right">{Math.round(d.r.qty * 100) / 100}</td>
                  <td className="p-2.5 text-right">{d.r.price.toFixed(2)}</td>
                  <td className="p-2.5 text-right">{d.stop != null ? d.stop.toFixed(2) : '—'}</td>
                  <td className="p-2.5 text-right font-bold">{money(conv(d.netUsd), ccy)}</td>
                  <td className="p-2.5 text-right">{cur != null ? money(conv(cur), ccy) : '—'}</td>
                  <td className="p-2.5 text-right">
                    <input value={mine[d.r.id] ?? (ns != null && preset !== 'cur' ? String(ns) : '')} placeholder={d.stop != null ? d.stop.toFixed(2) : 'stop'} onChange={(e) => setMine({ ...mine, [d.r.id]: e.target.value })} inputMode="decimal" className={`w-20 text-right rounded-md border px-1.5 py-1 bg-white dark:bg-slate-900 ${bad ? 'border-rose-400 text-rose-600' : 'border-slate-200 dark:border-slate-700'}`} />
                  </td>
                  <td className="p-2.5 text-right font-bold">{bad ? <span className="text-rose-500 font-black">≥ price</span> : nv != null ? money(conv(nv), ccy) : '—'}</td>
                  <td className={`p-2.5 text-right font-bold ${gain == null ? '' : gain > 0 ? 'text-emerald-600' : gain < 0 ? 'text-rose-600' : ''}`}>{gain != null ? `${gain >= 0 ? '+' : '-'}${money(Math.abs(conv(gain)), ccy)}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 font-black">
              <td className="p-2.5">Total ({data.length})</td><td /><td /><td />
              <td className="p-2.5 text-right">{money(conv(tot.now), ccy)}</td>
              <td className="p-2.5 text-right">{money(conv(tot.cur), ccy)}</td>
              <td />
              <td className="p-2.5 text-right">{money(conv(tot.next), ccy)}</td>
              <td className={`p-2.5 text-right ${tot.next - tot.cur >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{tot.next - tot.cur >= 0 ? '+' : '-'}{money(Math.abs(conv(tot.next - tot.cur)), ccy)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
