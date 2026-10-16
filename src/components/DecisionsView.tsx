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
    scoped.filter((h) => !isActive(h) && soldDate(h) > date).forEach((h) => { const k = keyOf(h); if (!activeKeys.has(k) && !m.has(k)) m.set(k, h); });
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
    const nowPrice = (h: any): { p: number; est: boolean } => {
      if (isActive(h)) return { p: Number(h.live_price ?? h.current_price ?? h.buy_price ?? 0), est: false };
      const k = keyOf(h);
      if (activeByKey.has(k)) return { p: activeByKey.get(k)!, est: false };
      if (fetched[k] > 0) return { p: fetched[k], est: false };
      const stale = Number(h.live_price ?? 0);
      return { p: stale > 0 ? stale : Number(h.sold_price || h.buy_price || 0), est: true };
    };
    const c = (h: any, n: number) => fx(n, String(h.currency || baseCurrency).toUpperCase(), ccy);

    let keptNow = 0, estimated = 0, actualNow = 0;
    const sells: any[] = [], buys: any[] = [];
    scoped.forEach((h) => {
      const qty = Number(h.quantity || 0);
      const heldAtD = buyDate(h) <= date && (isActive(h) || soldDate(h) > date);
      const np = nowPrice(h);
      if (heldAtD) { keptNow += c(h, valueAt(h, np.p)); if (np.est) estimated++; }
      if (isActive(h)) actualNow += c(h, valueAt(h, np.p));
      if (!isActive(h) && soldDate(h) > date) {
        const proceeds = c(h, Number(h.sold_price || 0) * qty), ifKept = c(h, np.p * qty);
        // Only count as a decision when it was held before D or bought after D and sold after D alike: proceeds vs. keeping.
        sells.push({ id: h.id, symbol: String(h.ticker || h.symbol), qty, soldDate: soldDate(h), soldPrice: Number(h.sold_price || 0), nowPrice: np.p, est: np.est, impact: proceeds - ifKept, pct: ifKept > 0 ? ((proceeds - ifKept) / ifKept) * 100 : 0, native: String(h.currency || baseCurrency).toUpperCase() });
      }
      if (buyDate(h) > date) {
        const cost = c(h, Number(h.buy_price || 0) * qty);
        const value = isActive(h) ? c(h, valueAt(h, np.p)) : c(h, Number(h.sold_price || 0) * qty);
        buys.push({ id: h.id, symbol: String(h.ticker || h.symbol), qty, buyDate: buyDate(h), buyPrice: Number(h.buy_price || 0), nowPrice: isActive(h) ? np.p : Number(h.sold_price || 0), sold: !isActive(h), impact: value - cost, pct: cost > 0 ? ((value - cost) / cost) * 100 : 0, native: String(h.currency || baseCurrency).toUpperCase() });
      }
    });
    const cc = (x: any) => fx(Number(x.amount || 0), String(x.currency || baseCurrency).toUpperCase(), ccy);
    const inBook = (x: any) => book === 'All' || !book || x.portfolio_id === book;
    const newMoney = contributions.filter((x) => inBook(x) && String(x.contribution_date || '').slice(0, 10) > date).reduce((a, x) => a + cc(x), 0)
      - withdrawals.filter((x) => inBook(x) && String(x.withdrawal_date || '').slice(0, 10) > date).reduce((a, x) => a + cc(x), 0);
    sells.sort((a, b) => b.impact - a.impact); buys.sort((a, b) => b.impact - a.impact);
    const youNow = actualNow + cashTotal;
    const diff = youNow - keptNow - newMoney;
    return { keptNow, actualNow, youNow, newMoney, diff, diffPct: keptNow > 0 ? (diff / keptNow) * 100 : 0, sells, buys, estimated };
  }, [scoped, date, fetched, fx, ccy, baseCurrency, contributions, withdrawals, cashTotal, book]);

  const presets: [string, string][] = [['1M', ago(30)], ['3M', ago(90)], ['6M', ago(182)], ['1Y', ago(365)], ['YTD', `${new Date().getFullYear()}-01-01`]];
  const sellTotal = calc.sells.reduce((a, r) => a + r.impact, 0), buyTotal = calc.buys.reduce((a, r) => a + r.impact, 0);
  const Row = ({ sym, sub, impact, p, good }: { key?: React.Key; sym: string; sub: string; impact: number; p: number; good: boolean }) => (
    <div className="flex items-center gap-3 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800">
      <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${good ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'}`}>{good ? 'Good' : 'Bad'}</span>
      <div className="flex-1 min-w-0"><div className="text-sm font-black truncate">{sym}</div><div className="text-[11px] text-slate-400 truncate">{sub}</div></div>
      <div className="text-right shrink-0"><div className={`text-sm font-black tabular-nums ${tone(impact)}`}>{impact > 0 ? '+' : ''}{money(impact, ccy)}</div><div className={`text-[11px] font-bold ${tone(impact)}`}>{pct(p)}</div></div>
    </div>
  );
  const verdict = calc.diff >= 0 ? 'Your changes since then are ahead of just holding.' : 'Just holding what you had would have been better.';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div>
          <div className="text-sm font-black">Good and bad decisions</div>
          <div className="text-xs text-slate-500">Pick a date. We compare what you hold now with what you would have if you had kept the portfolio exactly as it was that day.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setD(e.target.value)} className="text-sm px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none" />
          {presets.map(([l, d]) => <button key={l} onClick={() => setD(d)} className={`text-[11px] font-black px-3 py-2 rounded-full ${date === d ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{l}</button>)}
        </div>
        {(loading || fetchErr) && <div className={`text-[11px] font-bold ${fetchErr ? 'text-amber-600' : 'text-slate-400'}`}>{fetchErr ? `${fetchErr}. Some sold stocks use their last known price.` : 'Fetching current prices for stocks you sold…'}</div>}
        {!loading && calc.estimated > 0 && <div className="text-[11px] text-amber-600 font-bold">{calc.estimated} sold position(s) use an older price because no current quote was found.</div>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          ['If you kept it', money(calc.keptNow, ccy), 'portfolio as of the date, at today\'s prices', undefined],
          ['What you have now', money(calc.youNow, ccy), 'holdings + cash', undefined],
          ['New money since', money(calc.newMoney, ccy), 'contributions − withdrawals', undefined],
          ['Your changes', `${calc.diff > 0 ? '+' : ''}${money(calc.diff, ccy)}`, pct(calc.diffPct) + ' vs keeping', calc.diff],
        ].map(([l, v, s, t]: any) => (
          <div key={l} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{l}</div>
            <div className={`text-base sm:text-xl font-black tabular-nums mt-0.5 break-words ${t != null ? tone(t) : ''}`}>{v}</div>
            <div className={`text-[10px] font-bold ${t != null ? tone(t) : 'text-slate-400'}`}>{s}</div>
          </div>
        ))}
      </div>
      <div className={`rounded-xl px-4 py-3 text-sm font-bold ${calc.diff >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'}`}>{verdict}</div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-3 py-3 flex items-center justify-between"><div><div className="text-sm font-black">Stocks you sold</div><div className="text-[11px] text-slate-400">Sale proceeds vs what those shares are worth today</div></div><div className={`text-sm font-black tabular-nums ${tone(sellTotal)}`}>{sellTotal > 0 ? '+' : ''}{money(sellTotal, ccy)}</div></div>
          {calc.sells.length === 0 ? <div className="px-3 py-6 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">No sales after this date.</div>
            : calc.sells.map((r) => <Row key={r.id} sym={r.symbol} sub={`${r.qty} sold ${r.soldDate} @ ${r.soldPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} · now ${r.nowPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}${r.est ? ' (old price)' : ''}`} impact={r.impact} p={r.pct} good={r.impact >= 0} />)}
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-3 py-3 flex items-center justify-between"><div><div className="text-sm font-black">Stocks you bought</div><div className="text-[11px] text-slate-400">New positions since the date: value now vs cost</div></div><div className={`text-sm font-black tabular-nums ${tone(buyTotal)}`}>{buyTotal > 0 ? '+' : ''}{money(buyTotal, ccy)}</div></div>
          {calc.buys.length === 0 ? <div className="px-3 py-6 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">No purchases after this date.</div>
            : calc.buys.map((r) => <Row key={r.id} sym={r.symbol} sub={`${r.qty} bought ${r.buyDate} @ ${r.buyPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} · ${r.sold ? 'sold at' : 'now'} ${r.nowPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} impact={r.impact} p={r.pct} good={r.impact >= 0} />)}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">Good = the sale or purchase made more than holding would have. Dividends and brokerage fees are not included. Positions are rebuilt from buy and sell dates. Cash is today's balance.</p>
    </div>
  );
}
