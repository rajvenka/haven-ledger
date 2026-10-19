import React from 'react';
import { RefreshCw, ArrowUp, ArrowDown } from 'lucide-react';

type Q = {
  symbol: string; name: string; market: string; currency: string | null;
  last: number | null; prevClose: number | null; change: number | null; changePct: number | null;
  open: number | null; high: number | null; low: number | null; tradeDate: string | null; lastTime: number | null;
  hasToday: boolean; bars: { d: string; c: number }[]; error?: string;
};

// Regular-session hours (exchange local time). Used for status + countdowns.
const MKT: Record<string, { name: string; tz: string; open: [number, number]; close: [number, number]; lunch?: [[number, number], [number, number]]; zone: string }> = {
  IN: { name: 'India', tz: 'Asia/Kolkata', open: [9, 15], close: [15, 30], zone: 'IST' },
  US: { name: 'United States', tz: 'America/New_York', open: [9, 30], close: [16, 0], zone: 'ET' },
  AU: { name: 'Australia', tz: 'Australia/Sydney', open: [10, 0], close: [16, 0], zone: 'AEST' },
  EU: { name: 'Europe', tz: 'Europe/Berlin', open: [9, 0], close: [17, 30], zone: 'CET' },
  JP: { name: 'Japan', tz: 'Asia/Tokyo', open: [9, 0], close: [15, 30], lunch: [[11, 30], [12, 30]], zone: 'JST' },
};
const ORDER = ['IN', 'US', 'AU', 'EU', 'JP'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(now: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = f.formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value || '';
  const hh = Number(g('hour')) % 24;
  return { wd: DAYS.indexOf(g('weekday')), mins: hh * 60 + Number(g('minute')) };
}
const fmtDur = (m: number) => { const h = Math.floor(m / 60), mm = Math.round(m % 60); return h > 0 ? `${h}h ${mm}m` : `${mm}m`; };
const hhmm = (a: [number, number]) => `${String(a[0]).padStart(2, '0')}:${String(a[1]).padStart(2, '0')}`;

type Status = { state: 'open' | 'closed' | 'pre' | 'lunch'; label: string; detail: string };
function statusOf(id: string, now: Date, lastTime: number | null): Status {
  const m = MKT[id]; const { wd, mins } = parts(now, m.tz);
  const o = m.open[0] * 60 + m.open[1], c = m.close[0] * 60 + m.close[1];
  const nextOpen = (fromToday: boolean) => {
    let add = 0, d = wd; if (!fromToday) { add = 1; d = (wd + 1) % 7; }
    while (d === 0 || d === 6) { add++; d = (d + 1) % 7; }
    return add === 0 ? `opens in ${fmtDur(o - mins)}` : `opens ${add === 1 ? 'tomorrow' : DAYS[d]} ${hhmm(m.open)}`;
  };
  if (wd === 0 || wd === 6) return { state: 'closed', label: 'Closed', detail: `Weekend · ${nextOpen(false)}` };
  if (mins < o) return { state: 'pre', label: 'Pre-open', detail: nextOpen(true) };
  if (mins >= c) return { state: 'closed', label: 'Closed', detail: nextOpen(false) };
  if (m.lunch) { const ls = m.lunch[0][0] * 60 + m.lunch[0][1], le = m.lunch[1][0] * 60 + m.lunch[1][1]; if (mins >= ls && mins < le) return { state: 'lunch', label: 'Lunch break', detail: `resumes in ${fmtDur(le - mins)}` }; }
  // Scheduled open, but the last quote is stale: probably an exchange holiday.
  if (lastTime && now.getTime() / 1000 - lastTime > 50 * 60 && mins > o + 60) return { state: 'closed', label: 'Closed', detail: 'Holiday? No recent trades' };
  return { state: 'open', label: 'Open', detail: `closes in ${fmtDur(c - mins)}` };
}

const n2 = (v: number | null, d = 2) => (v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const tone = (v: number | null) => (v == null || v === 0 ? 'text-slate-500' : v > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');
const sgn = (v: number | null, d = 2) => (v == null ? '—' : `${v > 0 ? '+' : ''}${n2(v, d)}`);

function Spark({ bars, up }: { bars: { c: number }[]; up: boolean }) {
  if (bars.length < 2) return null;
  const v = bars.map((b) => b.c), mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 100},${28 - ((x - mn) / rg) * 24 - 2}`).join(' ');
  return <svg viewBox="0 0 100 28" className="w-24 h-7" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={up ? '#10b981' : '#f43f5e'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>;
}

export default function MarketActivity() {
  const [quotes, setQuotes] = React.useState<Q[]>([]);
  const [at, setAt] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => new Date());

  const load = React.useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const r = await fetch('/api/portfolio-prices?action=markets');
      if (!r.ok) throw new Error('Market service did not respond');
      const j = await r.json();
      setQuotes(j.quotes || []); setAt(j.at || Date.now()); setErr(null);
    } catch (e: any) { setErr(e?.message || 'Could not load markets'); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, 60_000);
    const c = setInterval(() => setNow(new Date()), 30_000);
    return () => { clearInterval(t); clearInterval(c); };
  }, [load]);

  const byMarket = React.useMemo(() => {
    const m = new Map<string, Q[]>(); quotes.forEach((q) => m.set(q.market, [...(m.get(q.market) || []), q])); return m;
  }, [quotes]);
  const statuses = ORDER.map((id) => ({ id, st: statusOf(id, now, byMarket.get(id)?.[0]?.lastTime ?? null) }));
  const openN = statuses.filter((s) => s.st.state === 'open').length;
  const mv = quotes.map((q) => ({ q, p: q.hasToday ? q.changePct : (q.bars.length > 1 ? ((q.bars[q.bars.length - 1].c - q.bars[q.bars.length - 2].c) / q.bars[q.bars.length - 2].c) * 100 : null) })).filter((x) => x.p != null) as { q: Q; p: number }[];
  const best = mv.length ? [...mv].sort((a, b) => b.p - a.p)[0] : null, worst = mv.length ? [...mv].sort((a, b) => a.p - b.p)[0] : null;
  const pill = (s: Status) => s.state === 'open' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : s.state === 'lunch' || s.state === 'pre' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-0"><div className="text-sm font-black">Market activity</div><div className="text-xs text-slate-500">{openN} of {ORDER.length} markets open · {at ? `updated ${new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'loading…'}</div></div>
        {best && <div className="text-xs"><span className="text-slate-400 font-bold">Best </span><span className="font-black">{best.q.name}</span> <span className={`font-black ${tone(best.p)}`}>{sgn(best.p)}%</span></div>}
        {worst && worst.q.symbol !== best?.q.symbol && <div className="text-xs"><span className="text-slate-400 font-bold">Weakest </span><span className="font-black">{worst.q.name}</span> <span className={`font-black ${tone(worst.p)}`}>{sgn(worst.p)}%</span></div>}
        <button onClick={() => load()} disabled={loading} className="ml-auto p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-60" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      {err && <div className="text-xs font-bold text-amber-600">{err}. {quotes.length ? 'Showing the last data received.' : ''}</div>}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {ORDER.map((id) => {
          const m = MKT[id], st = statuses.find((s) => s.id === id)!.st, list = byMarket.get(id) || [];
          const localTime = new Intl.DateTimeFormat([], { timeZone: m.tz, hour: '2-digit', minute: '2-digit', weekday: 'short' }).format(now);
          const hasLunch = m.lunch ? ` (lunch ${hhmm(m.lunch[0])}–${hhmm(m.lunch[1])})` : '';
          return (
            <div key={id} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
                <div className="min-w-0">
                  <div className="text-base font-black">{m.name}</div>
                  <div className="text-[11px] text-slate-500">{localTime} {m.zone} · {hhmm(m.open)}–{hhmm(m.close)}{hasLunch}</div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full ${pill(st)}`}>{st.state === 'open' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}{st.label}</span>
                  <div className="text-[10px] text-slate-400 mt-1">{st.detail}</div>
                </div>
              </div>
              {list.length === 0 && <div className="p-6 text-center text-xs text-slate-400">{loading ? 'Loading…' : 'No data'}</div>}
              {list.map((q) => {
                const prior = q.bars.length > 1 ? q.bars[q.bars.length - 2].c : null;
                const lastClose = q.bars.length ? q.bars[q.bars.length - 1].c : null;
                const ch = q.hasToday ? q.change : (lastClose != null && prior != null ? lastClose - prior : null);
                const chp = q.hasToday ? q.changePct : (ch != null && prior ? (ch / prior) * 100 : null);
                const yClose = q.hasToday ? q.prevClose : lastClose;
                const lvl = q.hasToday ? q.last : lastClose;
                const pos = q.high != null && q.low != null && q.last != null && q.high > q.low ? Math.min(100, Math.max(0, ((q.last - q.low) / (q.high - q.low)) * 100)) : null;
                return (
                  <div key={q.symbol} className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 first:border-t-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-500">{q.name}</div>
                        <div className="text-xl font-black tabular-nums">{n2(lvl)}</div>
                        <div className={`inline-flex items-center gap-1 text-xs font-black tabular-nums ${tone(ch)}`}>{ch != null && ch !== 0 && (ch > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}{sgn(ch)} pts ({sgn(chp)}%){!q.hasToday && <span className="text-slate-400 font-bold"> · last session</span>}</div>
                      </div>
                      <Spark bars={q.bars} up={(ch ?? 0) >= 0} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2.5 text-[10px]">
                      {[[st.state === 'open' ? 'Prev close' : 'Prev close', n2(yClose)], ['Open', n2(q.hasToday ? q.open : null)], ['High', n2(q.hasToday ? q.high : null)], ['Low', n2(q.hasToday ? q.low : null)]].map(([l, v]) => (
                        <div key={l}><div className="font-black uppercase tracking-wider text-slate-400">{l}</div><div className="text-xs font-bold tabular-nums">{v}</div></div>
                      ))}
                    </div>
                    {pos != null && (
                      <div className="mt-2"><div className="relative h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900" style={{ left: `calc(${pos}% - 5px)` }} /></div><div className="flex justify-between text-[9px] text-slate-400 mt-0.5"><span>Day low</span><span>{st.state === 'open' ? 'Now' : 'Close'} {n2(q.last)}</span><span>Day high</span></div></div>
                    )}
                    {q.error && !q.last && <div className="text-[10px] text-amber-600 mt-1">{q.error}</div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400">Index levels are in points. Quotes can be delayed up to 15 minutes. Open/closed status follows regular trading hours; exchange holidays are detected when no recent trades appear. Daily open, high, low and close are also saved so history builds over time.</p>
    </div>
  );
}
