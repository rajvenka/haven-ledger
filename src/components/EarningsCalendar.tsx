import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';

type Props = { rows: any[]; ccy: string; money: (n: number, c: string) => string };
const CACHE_KEY = 'hv_earn_cache_v1';
const SKIP = new Set(['JPN225', 'NSDQ100', 'SPX500', 'GOLD', 'SILVER']);

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function EarningsCalendar({ rows, ccy, money }: Props) {
  const [dates, setDates] = useState<Record<string, string>>(() => { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); return c.d || {}; } catch { return {}; } });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [pick, setPick] = useState<string | null>(null);

  const stocks = useMemo(() => {
    const m = new Map<string, any>();
    rows.filter((r) => r.h?.holding_type === 'stock' && !SKIP.has(String(r.h.symbol).toUpperCase())).forEach((r) => {
      const k = String(r.h.ticker || r.h.symbol).toUpperCase();
      const cur = m.get(k);
      if (cur) { cur.value += r.value; cur.pnl += r.pnl; cur.lev = cur.lev || r.leverage; } else m.set(k, { key: k, symbol: r.symbol, h: r.h, value: r.value, pnl: r.pnl, lev: r.leverage });
    });
    return Array.from(m.values());
  }, [rows]);
  const keySig = stocks.map((s) => s.key).sort().join(',');

  const load = async (force = false) => {
    if (!stocks.length) return;
    try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); if (!force && c.sig === keySig && Date.now() - c.t < 12 * 3600e3) { setDates(c.d || {}); return; } } catch { /* */ }
    setLoading(true); setFailed(false);
    try {
      const resp = await fetch('/api/earnings-calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbols: stocks.map((s) => ({ symbol: s.h.ticker ?? s.h.symbol, exchange: s.h.exchange, currency: s.h.currency })) }) });
      if (!resp.ok) throw new Error('bad');
      const { results } = await resp.json();
      const d: Record<string, string> = {};
      (results || []).forEach((r: any) => { if (r.earningsDate) d[String(r.symbol || '').toUpperCase()] = r.earningsDate; });
      setDates(d);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ sig: keySig, t: Date.now(), d })); } catch { /* */ }
    } catch { setFailed(true); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [keySig]);

  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    stocks.forEach((s) => { const d = dates[s.key] || dates[String(s.h.symbol).toUpperCase()]; if (d) m.set(d, [...(m.get(d) || []), s]); });
    return m;
  }, [stocks, dates]);

  const today = ymd(new Date());
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const pad = first.getDay();
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(pad).fill(null), ...Array.from({ length: dim }, (_, i) => ymd(new Date(month.getFullYear(), month.getMonth(), i + 1)))];

  const upcoming = Array.from(byDay.entries()).filter(([d]) => d >= today).sort(([a], [b]) => a.localeCompare(b));
  const shown = pick ? [[pick, byDay.get(pick) || []] as [string, any[]]] : upcoming.slice(0, 12);
  const found = Array.from(byDay.values()).reduce((t: number, a: any[]) => t + a.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-sm font-black w-36 text-center">{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          {loading ? <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Fetching dates…</span> : <span>{found} of {stocks.length} stocks have a date</span>}
          <button onClick={() => load(true)} disabled={loading} className="inline-flex items-center gap-1 font-black text-indigo-600 disabled:opacity-40"><RefreshCw className="w-3 h-3" /> Refresh</button>
        </div>
      </div>
      {failed && <div className="text-xs text-rose-600">Couldn't fetch earnings dates right now (Yahoo may be rate-limiting). Try Refresh in a minute.</div>}
      <div className="grid grid-cols-7 gap-1 text-[10px] font-black text-slate-400 text-center">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const list = byDay.get(d) || [];
          const isToday = d === today;
          return (
            <button key={d} onClick={() => setPick(pick === d ? null : d)} className={`min-h-[64px] sm:min-h-[80px] rounded-lg border p-1 text-left align-top ${pick === d ? 'border-indigo-500 ring-1 ring-indigo-400' : isToday ? 'border-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-800'} ${list.length ? 'bg-amber-50/60 dark:bg-amber-950/10' : ''}`}>
              <div className={`text-[10px] font-black ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{Number(d.slice(8))}</div>
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {list.slice(0, 3).map((s) => <span key={s.key} className={`text-[9px] font-black px-1 rounded ${s.pnl >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{s.symbol}</span>)}
                {list.length > 3 && <span className="text-[9px] font-black text-slate-500">+{list.length - 3}</span>}
              </div>
            </button>
          );
        })}
      </div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black text-slate-500 flex justify-between">
          <span>{pick ? `Reporting ${pick}` : 'Upcoming earnings on your holdings'}</span>
          {pick && <button onClick={() => setPick(null)} className="text-indigo-600">Show upcoming</button>}
        </div>
        {shown.length === 0 || shown.every(([, l]) => !l.length) ? <div className="p-4 text-xs text-slate-500">{loading ? 'Loading…' : 'Nothing scheduled.'}</div> : shown.map(([d, list]) => (
          <div key={d} className="border-t first:border-t-0 border-slate-100 dark:border-slate-800">
            <div className="px-3 pt-2 text-[11px] font-black text-slate-500">{new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}{d === today ? ' · today' : ''}</div>
            {list.map((s: any) => (
              <div key={s.key} className="flex items-center justify-between px-3 py-1.5 text-xs">
                <div><b>{s.symbol}</b>{s.lev ? <span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{s.lev}x CFD</span> : null}<span className="ml-2 text-slate-400">{s.h.broker}</span></div>
                <div className="tabular-nums text-right"><span className="font-bold">{money(s.value, ccy)}</span> <span className={`font-bold ${s.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{s.pnl >= 0 ? '+' : '-'}{money(Math.abs(s.pnl), ccy)}</span></div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="text-[10px] text-slate-400">Dates come from Yahoo Finance and can shift; confirm on the company's investor-relations page. Green/red chips show whether you're currently in profit or loss on that stock.</div>
    </div>
  );
}
