import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface Pt { date: string; price: number }

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Gains report for one holding: rolling periods, weekly and monthly, from stored price history. */
export default function StockGains({ history, livePrice, qty, buyPrice, buyDate, native, convert, fmt, pctFmt, toneCls }: {
  history: Pt[]; livePrice: number; qty: number; buyPrice: number; buyDate?: string; native: string;
  convert: (n: number) => number; fmt: (n: number) => string; pctFmt: (n: number) => string; toneCls: (n: number) => string;
}) {
  const [tab, setTab] = useState<'periods' | 'weekly' | 'monthly'>('periods');

  const series = useMemo(() => {
    const m = new Map<string, number>();
    history.forEach((p) => { if (Number.isFinite(p.price) && p.price > 0) m.set(p.date, p.price); });
    if (livePrice > 0) m.set(iso(new Date()), livePrice);
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, price]) => ({ date, price }));
  }, [history, livePrice]);

  const first = series[0]?.date;
  /** last known price on or before `d`; null if our history starts later than d (+3 day tolerance) */
  const priceOn = (d: Date): number | null => {
    const key = iso(d);
    let found: Pt | null = null;
    for (const p of series) { if (p.date <= key) found = p; else break; }
    if (found) return found.price;
    if (first && (new Date(first).getTime() - d.getTime()) / DAY <= 3) return series[0].price;
    return null;
  };

  const now = new Date();
  const last = series.length ? series[series.length - 1].price : livePrice;
  const row = (label: string, from: Date, fromPrice: number | null, toPrice: number | null = last) => {
    if (fromPrice == null || toPrice == null || fromPrice <= 0) return { label, gain: null as number | null, pct: null as number | null, from: fromPrice, to: toPrice };
    return { label, gain: convert((toPrice - fromPrice) * qty), pct: ((toPrice - fromPrice) / fromPrice) * 100, from: fromPrice, to: toPrice };
  };
  const ago = (days: number) => new Date(now.getTime() - days * DAY);

  const periods = useMemo(() => {
    const ytd = new Date(now.getFullYear() - 1, 11, 31);
    const list = [
      row('Yesterday', ago(1), priceOn(ago(1))), row('Last 5 days', ago(5), priceOn(ago(5))), row('1 week', ago(7), priceOn(ago(7))),
      row('2 weeks', ago(14), priceOn(ago(14))), row('1 month', ago(30), priceOn(ago(30))), row('3 months', ago(91), priceOn(ago(91))),
      row('6 months', ago(182), priceOn(ago(182))), row('Year to date', ytd, priceOn(ytd)), row('1 year', ago(365), priceOn(ago(365))),
    ];
    if (buyPrice > 0) list.push(row(`Since buy${buyDate ? ` (${buyDate})` : ''}`, new Date(buyDate || now), buyPrice));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, qty, buyPrice, buyDate]);

  const weekly = useMemo(() => {
    const out: ReturnType<typeof row>[] = [];
    const end = new Date(now); const dow = (end.getDay() + 6) % 7; // Monday start
    let weekStart = new Date(end.getTime() - dow * DAY);
    for (let i = 0; i < 12; i++) {
      const prevClose = priceOn(new Date(weekStart.getTime() - DAY));
      const wEnd = i === 0 ? now : new Date(weekStart.getTime() + 6 * DAY);
      out.push(row(`${iso(weekStart).slice(5)} → ${iso(wEnd).slice(5)}`, weekStart, prevClose, priceOn(wEnd)));
      weekStart = new Date(weekStart.getTime() - 7 * DAY);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, qty]);

  const monthly = useMemo(() => {
    const out: ReturnType<typeof row>[] = [];
    for (let i = 0; i < 12; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextStart = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const endDay = i === 0 ? now : new Date(nextStart.getTime() - DAY);
      out.push(row(start.toLocaleString(undefined, { month: 'short', year: 'numeric' }), start, priceOn(new Date(start.getTime() - DAY)), priceOn(endDay)));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, qty]);

  const chart = series.slice(-120).map((p) => ({ date: p.date.slice(5), price: p.price }));
  const rows = tab === 'periods' ? periods : tab === 'weekly' ? weekly : monthly;
  const bestRow = rows.filter((r) => r.gain != null).sort((a, b) => (b.gain as number) - (a.gain as number))[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-black">Gains report</div>
        <div className="flex gap-1">
          {([['periods', 'Periods'], ['weekly', 'Weekly'], ['monthly', 'Monthly']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`text-[11px] font-black px-3 py-1 rounded-full ${tab === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{l}</button>
          ))}
        </div>
      </div>
      {chart.length > 1 && (
        <div className="h-28"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="date" tick={{ fontSize: 9 }} minTickGap={40} /><YAxis hide domain={['auto', 'auto']} /><Tooltip formatter={(v: any) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${native}`} /><Area type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={2} fill="url(#sg)" /></AreaChart></ResponsiveContainer></div>
      )}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-400"><tr><th className="text-left p-2">Period</th><th className="text-right p-2">From</th><th className="text-right p-2">To</th><th className="text-right p-2">Change</th><th className="text-right p-2">Gain / loss</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={`border-t border-slate-100 dark:border-slate-800 ${bestRow && bestRow.label === r.label ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}`}>
                <td className="p-2 font-bold">{r.label}</td>
                <td className="p-2 text-right tabular-nums text-slate-500">{r.from != null ? r.from.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</td>
                <td className="p-2 text-right tabular-nums text-slate-500">{r.to != null ? r.to.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</td>
                <td className={`p-2 text-right tabular-nums font-bold ${r.pct != null ? toneCls(r.pct) : ''}`}>{r.pct != null ? pctFmt(r.pct) : '—'}</td>
                <td className={`p-2 text-right tabular-nums font-bold ${r.gain != null ? toneCls(r.gain) : ''}`}>{r.gain != null ? fmt(r.gain) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400">Based on stored daily prices{first ? ` since ${first}` : ''}; gain uses your current quantity. “—” means no price history that far back.</p>
    </div>
  );
}
