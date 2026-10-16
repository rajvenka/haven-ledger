import React from 'react';

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
      rows.push({ id: h.id, symbol: String(h.ticker || h.symbol), qty, soldDate: soldDate(h), soldPrice, nowPrice: p, est, native, diff: fx((p - soldPrice) * qty, native, ccy), pct: soldPrice > 0 ? ((p - soldPrice) / soldPrice) * 100 : 0 });
    });
    rows.sort((a, b) => b.soldDate.localeCompare(a.soldDate) || a.symbol.localeCompare(b.symbol));
    return { rows, total: rows.reduce((a, r) => a + r.diff, 0), estimated: rows.filter((r) => r.est).length };
  }, [scoped, date, fetched, fx, ccy, baseCurrency]);

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

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-400">
              <tr>{['Stock', 'Qty', 'Sold on', 'Sold price', 'Current price', 'If held today'].map((h, i) => <th key={h} className={`p-2.5 font-black ${i === 0 || i === 2 ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {calc.rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-2.5 font-black whitespace-nowrap">{r.symbol}</td>
                  <td className="p-2.5 text-right tabular-nums">{n(r.qty)}</td>
                  <td className="p-2.5 whitespace-nowrap text-slate-500">{r.soldDate}</td>
                  <td className="p-2.5 text-right tabular-nums">{n(r.soldPrice)}</td>
                  <td className="p-2.5 text-right tabular-nums">{n(r.nowPrice)}{r.est ? <span className="text-amber-600" title="Older price"> *</span> : null}</td>
                  <td className={`p-2.5 text-right tabular-nums font-black ${tone(r.diff)}`}>{r.diff > 0 ? '+' : ''}{money(r.diff, ccy)}<div className="text-[10px] font-bold">{pct(r.pct)}</div></td>
                </tr>
              ))}
              {calc.rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No stocks sold since this date.</td></tr>}
            </tbody>
            {calc.rows.length > 0 && (
              <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"><td colSpan={5} className="p-2.5 font-black">Total ({calc.rows.length} sold)</td><td className={`p-2.5 text-right font-black tabular-nums ${tone(calc.total)}`}>{calc.total > 0 ? '+' : ''}{money(calc.total, ccy)}</td></tr></tfoot>
            )}
          </table>
        </div>
      </div>
      <p className="text-[11px] text-slate-400">"If held today" = (current price − sold price) × quantity. Green means you would be in profit by holding; red means selling was the better call. Dividends and fees are not included.</p>
    </div>
  );
}
