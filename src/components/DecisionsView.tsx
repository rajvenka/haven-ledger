import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';

type Props = {
  holdings: any[];
  book: string;
  ccy: string;
  baseCurrency: string;
  fx: (amt: number, from: string, to: string) => number;
  contributions: any[];
  withdrawals: any[];
  cashTotal: number;
  money: (n: number, c: string) => string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const pct = (n: number) => (Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—');
const tone = (n: number) => (n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500');
const keyOf = (h: any) => `${String(h.ticker ?? h.symbol).toUpperCase()}|${String(h.exchange || '').toUpperCase()}|${String(h.currency || '').toUpperCase()}`;

/** Value of a position at a given price. Leveraged (CFD) positions: cash committed + price move. */
function valueAt(h: any, price: number) {
  const qty = Number(h.quantity || 0), buy = Number(h.buy_price || 0);
  const lev = Number(h.leverage || 0);
  if (lev > 1) {
    const short = String(h.source || '').toLowerCase().includes('short');
    return (buy * qty) / lev + (price - buy) * qty * (short ? -1 : 1);
  }
  return price * qty;
}

export default function DecisionsView({ holdings, book, ccy, baseCurrency, fx, contributions, withdrawals, cashTotal, money }: Props) {
  const today = iso(new Date());
  const ago = (days: number) => iso(new Date(Date.now() - days * 86400000));
  const [date, setDate] = React.useState<string>(() => { try { return localStorage.getItem('hv_decisions_date') || ago(90); } catch { return ago(90); } });
  const setD = (d: string) => { setDate(d); try { localStorage.setItem('hv_decisions_date', d); } catch { /* */ } };
  const [fetched, setFetched] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(false);
  const [fetchErr, setFetchErr] = React.useState<string | null>(null);

  const scoped = React.useMemo(() => holdings.filter((h) => book === 'All' || !book || h.portfolio_id === book), [holdings, book]);
  const isActive = (h: any) => (h.status || 'active') === 'active';
  const buyDate = (h: any) => String(h.buy_date || '').slice(0, 10);
  const soldDate = (h: any) => String(h.sold_date || '').slice(0, 10);

  // Sold-after-D holdings whose stock is not currently held (or has no fresh price) need a current quote.
  const needQuote = React.useMemo(() => {
    const activeKeys = new Set(scoped.filter(isActive).map(keyOf));
    const m = new Map<string, any>();
    scoped.filter((h) => !isActive(h) && soldDate(h) >= date).forEach((h) => { const k = keyOf(h); if (!activeKeys.has(k) && !m.has(k)) m.set(k, h); });
    return Array.from(m.entries());
  }, [scoped, date]);

  const needSig = needQuote.map(([k]) => k).filter((k) => fetched[k] == null).join(',');
  React.useEffect(() => {
    const todo = needQuote.filter(([k]) => fetched[k] == null);
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
          results.forEach((r: any, j: number) => { const p = Number(r?.price); if (Number.isFinite(p) && p > 0) out[chunk[j][0]] = p; });
        }
        if (alive) setFetched((f) => ({ ...f, ...out }));
      } catch (e: any) { if (alive) setFetchErr(e?.message || 'Could not fetch current prices'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needSig]);

  const calc = React.useMemo(() => {
    const activeByKey = new Map<string, number>();
    scoped.filter(isActive).forEach((h) => { const p = Number(h.live_price ?? h.current_price ?? h.buy_price); if (p > 0) activeByKey.set(keyOf(h), p); });
    const rows: any[] = [];
    scoped.filter((h) => !isActive(h) && soldDate(h) >= date).forEach((h) => {
      const k = keyOf(h), qty = Number(h.quantity || 0), soldPrice = Number(h.sold_price || 0);
      let p = 0, est = false;
      if (activeByKey.has(k)) p = activeByKey.get(k)!;
      else if (fetched[k] > 0) p = fetched[k];
      else { const stale = Number(h.live_price ?? 0); p = stale > 0 ? stale : soldPrice; est = true; }
      const native = String(h.currency || baseCurrency).toUpperCase();
      // Profit/loss if you still held it today = (current - sold) x qty
      rows.push({ id: h.id, symbol: String(h.ticker || h.symbol), qty, soldDate: soldDate(h), soldPrice, nowPrice: p, est, native, proceeds: fx(soldPrice * qty, native, ccy), heldValue: fx(p * qty, native, ccy), diff: fx((p - soldPrice) * qty, native, ccy), pct: soldPrice > 0 ? ((p - soldPrice) / soldPrice) * 100 : 0 });
    });
    rows.sort((a, b) => b.soldDate.localeCompare(a.soldDate) || a.symbol.localeCompare(b.symbol));
    return { rows, estimated: rows.filter((r) => r.est).length };
  }, [scoped, date, fetched, fx, ccy, baseCurrency]);

  const [q, setQ] = React.useState('');
  const [verdict, setVerdict] = React.useState<'all' | 'good' | 'bad'>('all');
  const [sort, setSort] = React.useState<'date' | 'diff' | 'pct' | 'name'>('date');
  const rows = React.useMemo(() => {
    let l = calc.rows.filter((r) => (!q.trim() || r.symbol.toLowerCase().includes(q.trim().toLowerCase())) && (verdict === 'all' || (verdict === 'good' ? r.diff <= 0 : r.diff > 0)));
    if (sort === 'diff') l = [...l].sort((a, b) => a.diff - b.diff);
    else if (sort === 'pct') l = [...l].sort((a, b) => a.pct - b.pct);
    else if (sort === 'name') l = [...l].sort((a, b) => a.symbol.localeCompare(b.symbol));
    return l;
  }, [calc.rows, q, verdict, sort]);
  const sum = React.useMemo(() => {
    const soldValue = rows.reduce((a, r) => a + r.proceeds, 0), heldValue = rows.reduce((a, r) => a + r.heldValue, 0);
    const goodN = rows.filter((r) => r.diff <= 0).length, badN = rows.length - goodN;
    const saved = rows.filter((r) => r.diff < 0).reduce((a, r) => a + r.diff, 0), missed = rows.filter((r) => r.diff > 0).reduce((a, r) => a + r.diff, 0);
    const byDiff = [...rows].sort((a, b) => a.diff - b.diff);
    return { soldValue, heldValue, total: heldValue - soldValue, goodN, badN, saved, missed, bestSells: byDiff.filter((r) => r.diff < 0).slice(0, 3), worstSells: byDiff.filter((r) => r.diff > 0).reverse().slice(0, 3) };
  }, [rows]);

  const presets: [string, string][] = [['Yesterday', ago(1)], ['1W', ago(7)], ['1M', ago(30)], ['3M', ago(90)], ['6M', ago(182)], ['1Y', ago(365)], ['YTD', `${new Date().getFullYear()}-01-01`]];
  const n = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div>
          <div className="text-sm font-black">Sold stocks: what if you had held?</div>
          <div className="text-xs text-slate-500">Stocks sold since the date you pick, with the profit or loss you would have today if you had not sold.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400">Sold since</span>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setD(e.target.value)} className="text-sm px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none" />
          {presets.map(([l, d]) => <button key={l} onClick={() => setD(d)} className={`text-[11px] font-black px-3 py-2 rounded-full ${date === d ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{l}</button>)}
        </div>
        {(loading || fetchErr) && <div className={`text-[11px] font-bold ${fetchErr ? 'text-amber-600' : 'text-slate-400'}`}>{fetchErr ? `${fetchErr}. Some stocks use their last known price.` : 'Fetching current prices…'}</div>}
        {!loading && calc.estimated > 0 && <div className="text-[11px] text-amber-600 font-bold">{calc.estimated} stock(s) use an older price because no current quote was found.</div>}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-4 items-start">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 min-w-[10rem]"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stock" className="w-full pl-8 pr-2 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none" /></div>
          {([['all', 'All'], ['good', 'Good sale'], ['bad', 'Bad sale']] as const).map(([k, l]) => <button key={k} onClick={() => setVerdict(k)} className={`text-[11px] font-black px-3 py-2 rounded-full ${verdict === k ? (k === 'good' ? 'bg-emerald-600 text-white' : k === 'bad' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white') : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{l}</button>)}
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="text-[11px] font-bold px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none">
            <option value="date">Latest sold</option><option value="diff">Best sale first</option><option value="pct">Best sale % first</option><option value="name">Name</option>
          </select>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-400">
              <tr>{['Stock', 'Qty', 'Sold on', 'Sold price', 'Current price', 'Decision', 'If held today'].map((h, i) => <th key={h} className={`p-2.5 font-black ${i === 0 || i === 2 ? 'text-left' : i === 5 ? 'text-center' : 'text-right'}`}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-2.5 font-black"><div className="w-[15ch] overflow-x-auto whitespace-nowrap pb-0.5" style={{ scrollbarWidth: 'thin' }} title={r.symbol}>{r.symbol}</div></td>
                  <td className="p-2.5 text-right tabular-nums">{n(r.qty)}</td>
                  <td className="p-2.5 whitespace-nowrap text-slate-500">{r.soldDate}</td>
                  <td className="p-2.5 text-right tabular-nums">{n(r.soldPrice)}</td>
                  <td className="p-2.5 text-right tabular-nums">
                    <span className="inline-flex items-center justify-end gap-1">
                      {r.nowPrice > r.soldPrice ? <ArrowUp className="w-3 h-3 text-rose-500" /> : r.nowPrice < r.soldPrice ? <ArrowDown className="w-3 h-3 text-emerald-500" /> : null}
                      {n(r.nowPrice)}{r.est ? <span className="text-amber-600" title="Older price"> *</span> : null}
                    </span>
                  </td>
                  <td className="p-2.5 text-center whitespace-nowrap">
                    {r.diff > 0 ? <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" title="Price went up after you sold">Bad <ArrowUp className="w-3 h-3" /></span>
                      : r.diff < 0 ? <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" title="Price fell after you sold">Good <ArrowDown className="w-3 h-3" /></span>
                      : <span className="text-[10px] font-black text-slate-400">Same</span>}
                  </td>
                  <td className={`p-2.5 text-right tabular-nums font-black ${tone(r.diff)}`}>{r.diff > 0 ? '+' : ''}{money(r.diff, ccy)}<div className="text-[10px] font-bold">{pct(r.pct)}</div></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">No stocks sold since this date.</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"><td colSpan={6} className="p-2.5 font-black">Total ({rows.length} sold)</td><td className={`p-2.5 text-right font-black tabular-nums ${tone(sum.total)}`}>{sum.total > 0 ? '+' : ''}{money(sum.total, ccy)}</td></tr></tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="text-sm font-black mb-3">Sold summary</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Stocks sold', String(rows.length), undefined],
              ['Total sold value', money(sum.soldValue, ccy), undefined],
              ['Value if held', money(sum.heldValue, ccy), undefined],
              ['If held: P/L', `${sum.total > 0 ? '+' : ''}${money(sum.total, ccy)}`, sum.total],
            ].map(([l, v, t]: any) => (
              <div key={l} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">{l}</div>
                <div className={`text-sm font-black tabular-nums mt-0.5 break-words ${t != null ? tone(t) : ''}`}>{v}</div>
              </div>
            ))}
          </div>
          <div className={`mt-3 text-xs font-bold ${sum.total <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{rows.length === 0 ? '' : sum.total <= 0 ? 'Overall, selling beat holding.' : 'Overall, holding would have been better.'}</div>
        </div>

        {rows.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
            <div className="text-sm font-black">Good vs bad sales</div>
            <div className="h-36 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'Good', value: sum.goodN }, { name: 'Bad', value: sum.badN }]} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none">
                    <Cell fill="#10b981" /><Cell fill="#f43f5e" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-lg font-black">{Math.round((sum.goodN / rows.length) * 100)}%</span></div>
            </div>
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-emerald-600">{sum.goodN} good · saved {money(Math.abs(sum.saved), ccy)}</span>
              <span className="text-rose-600">{sum.badN} bad · missed {money(sum.missed, ccy)}</span>
            </div>
          </div>
        )}

        {(sum.bestSells.length > 0 || sum.worstSells.length > 0) && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            {[['Best sales', sum.bestSells, 'bg-emerald-500'], ['Worst sales', sum.worstSells, 'bg-rose-500']].map(([title, list, bar]: any) => list.length > 0 && (
              <div key={title}>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{title}</div>
                {list.map((r: any) => {
                  const mx = Math.max(...list.map((x: any) => Math.abs(x.diff))) || 1;
                  return (
                    <div key={r.id} className="mb-1.5">
                      <div className="flex justify-between text-xs font-bold"><span className="truncate pr-2">{r.symbol}</span><span className={`tabular-nums ${tone(r.diff)}`}>{r.diff > 0 ? '+' : ''}{money(r.diff, ccy)}</span></div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-0.5"><div className={`h-full rounded-full ${bar}`} style={{ width: `${(Math.abs(r.diff) / mx) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      <p className="text-[11px] text-slate-400">"If held today" = (current price − sold price) × quantity. Price up after you sold = bad decision (red ▲); price down after you sold = good decision (green ▼). Dividends and fees are not included.</p>
    </div>
  );
}
