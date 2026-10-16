import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, ReferenceLine } from 'recharts';
import { Search, ArrowUp, ArrowDown, X } from 'lucide-react';
import { quoteFactors } from './decisionsUtil';

type Props = {
  holdings: any[]; lots: any[]; book: string; ccy: string; baseCurrency: string;
  fx: (amt: number, from: string, to: string) => number;
  money: (n: number, c: string) => string;
  date: string; setD: (d: string) => void; presets: [string, string][]; today: string;
};

const pct = (n: number) => (Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—');
const tone = (n: number) => (n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500');
const keyOf = (h: any) => `${String(h.ticker ?? h.symbol).toUpperCase()}|${String(h.exchange || '').toUpperCase()}|${String(h.currency || '').toUpperCase()}`;
const n2 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
const quoteCache: Record<string, number> = ((globalThis as any).__hvQuoteCache ||= {});

export default function BuyOverview({ holdings, lots, book, ccy, baseCurrency, fx, money, date, setD, presets, today }: Props) {
  const [fetched, setFetched] = React.useState<Record<string, number>>({ ...quoteCache });
  const [loading, setLoading] = React.useState(false);
  const [fetchErr, setFetchErr] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');
  const [verdict, setVerdict] = React.useState<'all' | 'good' | 'bad'>('all');
  type SK = 'symbol' | 'orders' | 'qty' | 'avg' | 'nowPrice' | 'decision' | 'diff';
  const [sort, setSort] = React.useState<SK>('diff');
  const [dir, setDir] = React.useState<1 | -1>(1);
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const clickSort = (k: SK) => { if (sort === k) setDir((d) => (d === 1 ? -1 : 1)); else { setSort(k); setDir(k === 'symbol' ? 1 : -1); } };

  const scoped = React.useMemo(() => holdings.filter((h) => book === 'All' || !book || h.portfolio_id === book), [holdings, book]);
  const qf = React.useMemo(() => quoteFactors(holdings, lots, keyOf), [holdings, lots]);
  const isActive = (h: any) => (h.status || 'active') === 'active';
  const bd = (h: any) => String(h.buy_date || '').slice(0, 10);

  // Orders bought since the date: each lot when a holding has lots (eToro etc.), otherwise the holding itself.
  const base = React.useMemo(() => {
    const activeByKey = new Map<string, number>(); const activeTs = new Map<string, number>();
    scoped.filter(isActive).forEach((h) => { const k = keyOf(h), p = Number(h.live_price ?? h.current_price ?? h.buy_price), t = Date.parse(h.live_price_updated_at || '') || 0; if (p > 0 && (!activeTs.has(k) || t >= activeTs.get(k)!)) { activeByKey.set(k, p); activeTs.set(k, t); } });
    const lotsBy = new Map<string, any[]>();
    (lots || []).forEach((l: any) => { const k = String(l.holding_id); lotsBy.set(k, [...(lotsBy.get(k) || []), l]); });
    const orders: any[] = [];
    scoped.forEach((h) => {
      const k = keyOf(h), native = String(h.currency || baseCurrency).toUpperCase();
      const short = String(h.source || '').toLowerCase().includes('short') ? -1 : 1;
      let now = 0, est = false;
      if (activeByKey.has(k)) now = activeByKey.get(k)!;
      else if (isActive(h)) now = Number(h.live_price ?? h.current_price ?? h.buy_price ?? 0);
      else if (fetched[k] > 0) now = fetched[k];
      else { const st = Number(h.live_price ?? 0); now = st > 0 ? st : Number(h.sold_price || h.buy_price || 0); est = true; }
      const hl = lotsBy.get(String(h.id)) || [];
      const lev = Number(h.leverage || 0) > 1 ? Number(h.leverage) : 1;
      const push = (dt: string, qty: number, price: number, nowP: number, src: string) => orders.push({ key: k, symbol: String(h.ticker || h.symbol), date: dt, qty, price, now: nowP, native, short, lev, sold: !isActive(h), est, src, hid: h.id });
      if (hl.length) {
        const live = Number(h.live_price ?? 0);
        hl.forEach((l: any) => {
          const dt = String(l.open_date || '').slice(0, 10); if (!dt || dt < date) return;
          const cur = Number(l.current_price || 0), kf = live > 0 && cur > 0 ? live / cur : 1;
          push(dt, Number(l.quantity ?? l.units ?? 0), Number(l.open_rate ?? l.buy_price ?? 0) * kf, now > 0 ? now : (live > 0 ? live : cur * kf), 'lot');
        });
      } else if (bd(h) >= date) push(bd(h), Number(h.quantity || 0), Number(h.buy_price || 0), now, 'holding');
    });
    return orders;
  }, [scoped, lots, date, fetched, baseCurrency]);

  // Current quotes for bought stocks that are no longer held.
  const needQuote = React.useMemo(() => {
    const activeKeys = new Set(scoped.filter(isActive).map(keyOf));
    const m = new Map<string, any>();
    scoped.filter((h) => !isActive(h) && bd(h) >= date).forEach((h) => { const k = keyOf(h); if (!activeKeys.has(k) && !m.has(k)) m.set(k, h); });
    return Array.from(m.entries());
  }, [scoped, date]);
  const needSig = needQuote.map(([k]) => k).filter((k) => !(fetched[k] > 0)).join(',');
  React.useEffect(() => {
    const todo = needQuote.filter(([k]) => !(fetched[k] > 0));
    if (todo.length === 0) return;
    let alive = true;
    (async () => {
      setLoading(true); setFetchErr(null);
      try {
        const out: Record<string, number> = {};
        for (let i = 0; i < todo.length; i += 100) {
          const chunk = todo.slice(i, i + 100);
          const resp = await fetch('/api/portfolio-prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbols: chunk.map(([, h]) => ({ symbol: h.ticker ?? h.symbol, exchange: h.exchange, currency: h.currency })) }) });
          if (!resp.ok) throw new Error('Price service did not respond');
          const { results } = await resp.json();
          results.forEach((r: any, j: number) => { const p = Number(r?.price); if (Number.isFinite(p) && p > 0) { out[chunk[j][0]] = p; quoteCache[chunk[j][0]] = p; } });
        }
        if (alive) setFetched((f) => ({ ...f, ...out }));
      } catch (e: any) { if (alive) setFetchErr(e?.message || 'Could not fetch current prices'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needSig]);

  const stocks = React.useMemo(() => {
    const m = new Map<string, any>();
    base.forEach((o) => {
      // Leveraged (CFD) orders: cash committed = notional / leverage, plus the price move on the full notional.
      const cost = fx((o.price * o.qty) / o.lev, o.native, ccy), value = fx((o.price * o.qty) / o.lev + (o.now - o.price) * o.qty * o.short, o.native, ccy);
      const g = m.get(o.key) || { f: qf.get(o.key) || 1, key: o.key, symbol: o.symbol, native: o.native, orders: [] as any[], qty: 0, cost: 0, value: 0, nativeCost: 0, est: false, nowPrice: o.now, sold: false };
      const diff = value - cost;
      g.orders.push({ ...o, cost, value, diff, pct: cost > 0 ? (diff / cost) * 100 : 0 });
      g.qty += o.qty; g.cost += cost; g.value += value; g.nativeCost += o.price * o.qty; g.est = g.est || o.est; g.sold = g.sold || o.sold;
      m.set(o.key, g);
    });
    return Array.from(m.values()).map((g) => {
      const diff = g.value - g.cost, prices = g.orders.map((o: any) => o.price);
      return { ...g, diff, pct: g.cost > 0 ? (diff / g.cost) * 100 : 0, avg: g.qty > 0 ? g.nativeCost / g.qty : 0, low: Math.min(...prices), high: Math.max(...prices), orders: [...g.orders].sort((a: any, b: any) => b.date.localeCompare(a.date)) };
    });
  }, [base, fx, ccy, qf]);

  const rows = React.useMemo(() => {
    const l = stocks.filter((r) => (!q.trim() || r.symbol.toLowerCase().includes(q.trim().toLowerCase())) && (verdict === 'all' || (verdict === 'good' ? r.diff >= 0 : r.diff < 0)));
    const val = (r: any) => (sort === 'decision' ? r.pct : sort === 'orders' ? r.orders.length : r[sort]);
    return [...l].sort((x, y) => { const a = val(x), b = val(y); return (typeof a === 'string' ? a.localeCompare(b) : a - b) * dir; });
  }, [stocks, q, verdict, sort, dir]);

  const sum = React.useMemo(() => {
    const cost = rows.reduce((a, r) => a + r.cost, 0), value = rows.reduce((a, r) => a + r.value, 0);
    const goodN = rows.filter((r) => r.diff >= 0).length, badN = rows.length - goodN;
    const saving = rows.filter((r) => r.diff < 0).reduce((a, r) => a - r.diff, 0), profit = rows.filter((r) => r.diff >= 0).reduce((a, r) => a + r.diff, 0);
    const byDiff = [...rows].sort((a, b) => b.diff - a.diff);
    return { cost, value, diff: value - cost, goodN, badN, saving, profit, orders: rows.reduce((a, r) => a + r.orders.length, 0), best: byDiff.filter((r) => r.diff > 0).slice(0, 3), worst: [...byDiff].reverse().filter((r) => r.diff < 0).slice(0, 3) };
  }, [rows]);
  const est = rows.filter((r) => r.est).length;
  const open = openKey ? stocks.find((s) => s.key === openKey) : null;

  const th = ([['Stock', 'symbol'], ['Orders', 'orders'], ['Qty', 'qty'], ['Avg buy', 'avg'], ['Current price', 'nowPrice'], ['Decision', 'decision'], ['If bought now', 'diff']] as [string, SK][]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div>
          <div className="text-sm font-black">Bought stocks: what if you had bought today?</div>
          <div className="text-xs text-slate-500">Orders placed since the date you pick, compared with today's price. Price higher now = good buy (profit). Price lower now = bad timing (you would save by buying today).</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400">Bought since</span>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setD(e.target.value)} className="text-sm px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none" />
          {presets.map(([l, d]) => <button key={l} onClick={() => setD(d)} className={`text-[11px] font-black px-3 py-2 rounded-full ${date === d ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{l}</button>)}
        </div>
        {(loading || fetchErr) && <div className={`text-[11px] font-bold ${fetchErr ? 'text-amber-600' : 'text-slate-400'}`}>{fetchErr ? `${fetchErr}. Some stocks use their last known price.` : 'Fetching current prices…'}</div>}
        {!loading && est > 0 && <div className="text-[11px] text-amber-600 font-bold">{est} stock(s) use an older price because no current quote was found.</div>}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-4 items-start">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative flex-1 min-w-[10rem]"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stock" className="w-full pl-8 pr-2 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none" /></div>
            {([['all', 'All'], ['good', 'Good buy'], ['bad', 'Bad buy']] as const).map(([k, l]) => <button key={k} onClick={() => setVerdict(k)} className={`text-[11px] font-black px-3 py-2 rounded-full ${verdict === k ? (k === 'good' ? 'bg-emerald-600 text-white' : k === 'bad' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white') : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{l}</button>)}
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs min-w-[680px]">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-400">
                <tr>{th.map(([h, k], i) => <th key={h} onClick={() => clickSort(k)} className={`p-2.5 font-black cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap ${i === 0 ? 'text-left' : i === 5 ? 'text-center' : 'text-right'}`}>{h}{sort === k ? (dir === 1 ? ' ▲' : ' ▼') : ''}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} onClick={() => setOpenKey(r.key)} className="border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-2.5 font-black"><div className="w-[15ch] overflow-x-auto whitespace-nowrap pb-0.5" style={{ scrollbarWidth: 'thin' }} title={r.symbol}>{r.symbol}</div></td>
                    <td className="p-2.5 text-right tabular-nums">{r.orders.length}</td>
                    <td className="p-2.5 text-right tabular-nums">{n2(r.qty)}</td>
                    <td className="p-2.5 text-right tabular-nums">{n2(r.avg / r.f)}{r.orders.length > 1 && <div className="text-[10px] text-slate-400">{n2(r.low / r.f)} – {n2(r.high / r.f)}</div>}</td>
                    <td className="p-2.5 text-right tabular-nums"><span className="inline-flex items-center gap-1">{r.nowPrice > r.avg ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : r.nowPrice < r.avg ? <ArrowDown className="w-3 h-3 text-rose-500" /> : null}{n2(r.nowPrice / r.f)}{r.est ? <span className="text-amber-600" title="Older price"> *</span> : null}</span></td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      {r.diff >= 0 ? <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Good <ArrowUp className="w-3 h-3" /></span>
                        : <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Bad <ArrowDown className="w-3 h-3" /></span>}
                    </td>
                    <td className={`p-2.5 text-right tabular-nums font-black ${tone(r.diff)}`}>{money(Math.abs(r.diff), ccy)}<div className="text-[10px] font-bold">{r.diff >= 0 ? 'profit' : 'saving'} · {pct(r.pct)}</div></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">No purchases since this date.</td></tr>}
              </tbody>
              {rows.length > 0 && (
                <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"><td colSpan={6} className="p-2.5 font-black">Total ({rows.length} stocks, {sum.orders} orders)</td><td className={`p-2.5 text-right font-black tabular-nums ${tone(sum.diff)}`}>{money(Math.abs(sum.diff), ccy)}<div className="text-[10px] font-bold">{sum.diff >= 0 ? 'profit' : 'saving'}</div></td></tr></tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
            <div className="text-sm font-black mb-3">Buy summary</div>
            <div className="grid grid-cols-2 gap-2">
              {[['Stocks bought', `${rows.length} (${sum.orders} orders)`, undefined], ['Total bought', money(sum.cost, ccy), undefined], ['Value at today\'s price', money(sum.value, ccy), undefined], [sum.diff >= 0 ? 'Total profit' : 'Total saving if bought now', money(Math.abs(sum.diff), ccy), sum.diff]].map(([l, v, t]: any) => (
                <div key={l} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">{l}</div>
                  <div className={`text-sm font-black tabular-nums mt-0.5 break-words ${t != null ? tone(t) : ''}`}>{v}</div>
                </div>
              ))}
            </div>
            {rows.length > 0 && <div className="mt-3 text-[11px] font-bold text-slate-500">Profit on good buys <span className="text-emerald-600">{money(sum.profit, ccy)}</span> · Could have saved on bad buys <span className="text-rose-600">{money(sum.saving, ccy)}</span></div>}
          </div>
          {rows.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-sm font-black">Good vs bad buys</div>
              <div className="h-36 relative">
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Good', value: sum.goodN }, { name: 'Bad', value: sum.badN }]} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none"><Cell fill="#10b981" /><Cell fill="#f43f5e" /></Pie><Tooltip /></PieChart></ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-lg font-black">{Math.round((sum.goodN / rows.length) * 100)}%</span></div>
              </div>
              <div className="flex justify-between text-[11px] font-bold"><span className="text-emerald-600">{sum.goodN} good</span><span className="text-rose-600">{sum.badN} bad</span></div>
            </div>
          )}
          {(sum.best.length > 0 || sum.worst.length > 0) && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              {[['Best buys', sum.best, 'bg-emerald-500'], ['Worst buys', sum.worst, 'bg-rose-500']].map(([title, list, bar]: any) => list.length > 0 && (
                <div key={title}>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{title}</div>
                  {list.map((r: any) => { const mx = Math.max(...list.map((x: any) => Math.abs(x.diff))) || 1; return (
                    <div key={r.key} className="mb-1.5 cursor-pointer" onClick={() => setOpenKey(r.key)}>
                      <div className="flex justify-between text-xs font-bold"><span className="truncate pr-2">{r.symbol}</span><span className={`tabular-nums ${tone(r.diff)}`}>{r.diff > 0 ? '+' : '-'}{money(Math.abs(r.diff), ccy)}</span></div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-0.5"><div className={`h-full rounded-full ${bar}`} style={{ width: `${(Math.abs(r.diff) / mx) * 100}%` }} /></div>
                    </div>); })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">Click a stock for its order-by-order report. Profit/saving = (today's price − your buy price) × quantity, summed over every order since the date. Dividends and fees are not included.</p>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setOpenKey(null)}>
          <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="text-lg font-black break-words">{open.symbol}</div><div className="text-[11px] text-slate-500">{open.orders.length} order{open.orders.length === 1 ? '' : 's'} since {date}{open.sold ? ' · includes sold' : ''}</div></div>
              <button onClick={() => setOpenKey(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[['You paid', money(open.cost, ccy), undefined], ['Worth at today\'s price', money(open.value, ccy), undefined], [open.diff >= 0 ? 'Profit' : 'Saving if bought now', money(Math.abs(open.diff), ccy), open.diff], ['Avg buy / now', `${n2(open.avg / open.f)} / ${n2(open.nowPrice / open.f)}`, undefined]].map(([l, v, t]: any) => (
                  <div key={l} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2"><div className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">{l}</div><div className={`text-sm font-black tabular-nums mt-0.5 break-words ${t != null ? tone(t) : ''}`}>{v}</div></div>
                ))}
              </div>
              <div className={`rounded-xl px-4 py-3 text-xs font-bold ${open.diff >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'}`}>
                {open.diff >= 0
                  ? `Buying all ${n2(open.qty)} shares today would cost ${money(open.diff, ccy)} more than you paid. Your orders beat today's price.`
                  : `Buying all ${n2(open.qty)} shares today would cost ${money(Math.abs(open.diff), ccy)} less than you paid.`}
                {open.orders.length > 1 && <span className="block mt-1 font-semibold opacity-90">Cheapest order {n2(open.low / open.f)}, highest {n2(open.high / open.f)} (avg {n2(open.avg / open.f)}).</span>}
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...open.orders].reverse().map((o: any) => ({ d: `${o.date.slice(5)}`, price: Number((o.price / open.f).toFixed(2)), good: o.diff >= 0 }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="d" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} width={44} domain={[0, 'auto']} /><Tooltip />
                    <ReferenceLine y={open.nowPrice / open.f} stroke="#6366f1" strokeDasharray="4 3" label={{ value: `now ${n2(open.nowPrice / open.f)}`, fontSize: 10, fill: '#6366f1', position: 'insideTopRight' }} />
                    <Bar dataKey="price" radius={[4, 4, 0, 0]}>{[...open.orders].reverse().map((o: any, i: number) => <Cell key={i} fill={o.diff >= 0 ? '#10b981' : '#f43f5e'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-xs min-w-[460px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-400"><tr>{['Date', 'Qty', 'Buy price', 'Now', 'Decision', 'Profit / saving'].map((h, i) => <th key={h} className={`p-2 font-black ${i === 0 ? 'text-left' : i === 4 ? 'text-center' : 'text-right'}`}>{h}</th>)}</tr></thead>
                  <tbody>
                    {open.orders.map((o: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-2 whitespace-nowrap text-slate-500">{o.date}{o.sold ? <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-black">sold</span> : null}</td>
                        <td className="p-2 text-right tabular-nums">{n2(o.qty)}</td>
                        <td className="p-2 text-right tabular-nums">{n2(o.price / open.f)}</td>
                        <td className="p-2 text-right tabular-nums">{n2(o.now / open.f)}</td>
                        <td className="p-2 text-center">{o.diff >= 0 ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Good</span> : <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Bad</span>}</td>
                        <td className={`p-2 text-right tabular-nums font-black ${tone(o.diff)}`}>{money(Math.abs(o.diff), ccy)}<div className="text-[10px] font-bold">{o.diff >= 0 ? 'profit' : 'saving'} · {pct(o.pct)}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
