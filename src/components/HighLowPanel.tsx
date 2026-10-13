import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';

interface Row { id: string; symbol: string; price: number; native?: string }
interface Props { rows: Row[]; priceHistory: any[]; onSelect?: (id: string) => void }

const NEAR = 0.01; // within 1% counts as "at" the high/low
const d = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const px = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 });

/** All-time high / low (from recorded price history) per holding, with dates. */
export default function HighLowPanel({ rows, priceHistory, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState<'high' | 'low' | 'all'>('all');

  const data = useMemo(() => {
    const by = new Map<string, { hi: number; hiD: string; lo: number; loD: string; n: number }>();
    priceHistory.forEach((h: any) => {
      const id = String(h.holding_id); const p = Number(h.price); const date = String(h.recorded_date).slice(0, 10);
      if (!(p > 0)) return;
      const e = by.get(id);
      if (!e) by.set(id, { hi: p, hiD: date, lo: p, loD: date, n: 1 });
      else {
        e.n++;
        if (p > e.hi) { e.hi = p; e.hiD = date; }
        if (p < e.lo) { e.lo = p; e.loD = date; }
      }
    });
    const seen = new Set<string>();
    return rows.map((r) => {
      const e = by.get(r.id);
      if (!e || e.n < 2 || !(r.price > 0)) return null;
      const hi = Math.max(e.hi, r.price), lo = Math.min(e.lo, r.price);
      const hiD = r.price >= e.hi ? new Date().toISOString().slice(0, 10) : e.hiD;
      const loD = r.price <= e.lo ? new Date().toISOString().slice(0, 10) : e.loD;
      return { id: r.id, symbol: r.symbol, price: r.price, native: r.native, hi, hiD, lo, loD, fromHi: (r.price / hi - 1) * 100, fromLo: (r.price / lo - 1) * 100, atHigh: r.price >= hi * (1 - NEAR), atLow: r.price <= lo * (1 + NEAR) };
    }).filter((x): x is NonNullable<typeof x> => !!x && !seen.has(x.symbol) && (seen.add(x.symbol), true));
  }, [rows, priceHistory]);

  if (data.length === 0) return null;
  const highs = data.filter((x) => x.atHigh), lows = data.filter((x) => x.atLow);
  const list = (show === 'high' ? highs : show === 'low' ? lows : data).slice().sort((a, b) => b.fromHi - a.fromHi);

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">All-time high / low · from your price history</div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-sm font-black text-emerald-600"><TrendingUp className="w-4 h-4" /> {highs.length} at all-time high</span>
            <span className="inline-flex items-center gap-1 text-sm font-black text-rose-500"><TrendingDown className="w-4 h-4" /> {lows.length} at all-time low</span>
            <span className="text-xs text-slate-400 font-semibold">of {data.length} tracked</span>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-1.5">
            {([['all', 'All'], ['high', `At high (${highs.length})`], ['low', `At low (${lows.length})`]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setShow(k)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${show === k ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>{l}</button>
            ))}
          </div>
          {list.length === 0 ? <p className="text-xs text-slate-400 py-3">None right now.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead><tr className="text-[10px] uppercase tracking-wider text-slate-400 text-left">
                  <th className="py-1.5 pr-2">Stock</th><th className="pr-2 text-right">Now</th>
                  <th className="pr-2 text-right">All-time high</th><th className="pr-2">High date</th>
                  <th className="pr-2 text-right">All-time low</th><th className="pr-2">Low date</th><th className="text-right">From high</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.map((x) => (
                    <tr key={x.id} onClick={() => onSelect?.(x.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 pr-2 font-black">{x.symbol}{x.atHigh && <span className="ml-1 text-[9px] text-emerald-600">HIGH</span>}{x.atLow && <span className="ml-1 text-[9px] text-rose-500">LOW</span>}</td>
                      <td className="pr-2 text-right tabular-nums">{px(x.price)}</td>
                      <td className="pr-2 text-right tabular-nums text-emerald-600 font-bold">{px(x.hi)}</td>
                      <td className="pr-2 whitespace-nowrap text-slate-500">{d(x.hiD)}</td>
                      <td className="pr-2 text-right tabular-nums text-rose-500 font-bold">{px(x.lo)}</td>
                      <td className="pr-2 whitespace-nowrap text-slate-500">{d(x.loD)}</td>
                      <td className={`text-right tabular-nums font-bold ${x.fromHi >= -0.5 ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>{x.fromHi.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-slate-400">Based on prices recorded in this app (not full market history). "At" = within 1% of the high or low.</p>
        </div>
      )}
    </div>
  );
}
