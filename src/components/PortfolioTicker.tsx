import React from 'react';
import { Pause, Play } from 'lucide-react';

type Card = { id: string; name: string; ccy: string; value: number; pnl: number; pnlPct: number; day: number; dayPct: number; kind?: 'portfolio' | 'mf' | 'tag'; bookId?: string };

function rateOf(rates: any[], base: string, c: string): number | null {
  if (c === base) return 1;
  const r = rates.find((x: any) => String(x.currency || '').toUpperCase() === c);
  const v = Number(r?.rate_to_base);
  return Number.isFinite(v) && v > 0 ? v : null;
}
function convert(rates: any[], base: string, amt: number, from: string, to: string) {
  if (from === to) return amt;
  const fr = rateOf(rates, base, from), tr = rateOf(rates, base, to);
  return fr == null || tr == null ? amt : (amt * fr) / tr;
}
const money = (n: number, c: string) => {
  try { return new Intl.NumberFormat(c === 'INR' ? 'en-IN' : undefined, { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n); } catch { return `${Math.round(n).toLocaleString()} ${c}`; }
};
const signed = (n: number, c: string) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${money(Math.abs(n), c)}`;
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const tone = (n: number) => (n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500');

export function buildCards(holdings: any[], portfolios: any[], rates: any[], baseCurrency: string, multiple: boolean): Card[] {
  const base = String(baseCurrency || 'INR').toUpperCase();
  const active = holdings.filter((h) => (h.status || 'active') === 'active');
  const calc = (list: any[], to: string) => {
    let value = 0, cost = 0, day = 0;
    list.forEach((h) => {
      const native = String(h.currency || base).toUpperCase();
      const qty = Number(h.quantity || 0);
      const price = Number(h.live_price ?? h.current_price ?? h.buy_price ?? 0);
      const expCost = Number(h.buy_price || 0) * qty, expMv = price * qty;
      let realMv = expMv;
      if (Number(h.leverage || 0) > 1 && h.etoro_net_value_amount != null) realMv = Number(h.etoro_net_value_amount);
      const ok = realMv >= 0 && realMv - (expMv - expCost) > 0;
      const mv = ok ? realMv : expMv, c = ok ? realMv - (expMv - expCost) : expCost;
      const prev = Number(h.previous_close), live = Number(h.live_price);
      let d = 0;
      if (prev > 0 && live > 0 && live / prev < 20 && live / prev > 0.05) d = (live - prev) * qty;
      value += convert(rates, base, mv, native, to); cost += convert(rates, base, c, native, to); day += convert(rates, base, d, native, to);
    });
    const pnl = value - cost;
    return { value, pnl, pnlPct: cost > 0 ? (pnl / cost) * 100 : 0, day, dayPct: value - day > 0 ? (day / (value - day)) * 100 : 0 };
  };
  const few = !multiple || portfolios.length <= 3;
  let cards: Card[] = [];
  if (!multiple || portfolios.length === 0) {
    if (active.length) cards.push({ id: 'all', name: 'Portfolio', ccy: base, kind: 'portfolio', ...calc(active, base) });
  } else {
    cards = portfolios.map((p: any) => {
      const ccy = String(p.currency || base).toUpperCase();
      return { id: String(p.id), name: String(p.name), ccy, kind: 'portfolio' as const, ...calc(active.filter((h) => h.portfolio_id === p.id), ccy) };
    }).filter((c) => c.value !== 0 || c.pnl !== 0);
    if (cards.length > 1) cards.unshift({ id: 'all', name: 'All portfolios', ccy: base, kind: 'portfolio', ...calc(active, base) });
  }
  if (few && active.length) {
    // Breakdown cards: mutual funds per portfolio, then one card per tag (own stock, SME, ...).
    const isMf = (h: any) => String(h.holding_type || '').toLowerCase().startsWith('mutual');
    const brokerNames = new Set<string>(['', '—', 'groww', 'zerodha', 'cfd', 'webull', 'etoro', 'stake']);
    portfolios.forEach((p: any) => brokerNames.add(String(p.name).toLowerCase()));
    const extra: Card[] = [];
    const pfs = multiple && portfolios.length ? portfolios : [null];
    pfs.forEach((p: any) => {
      const list = active.filter((h) => isMf(h) && (!p || h.portfolio_id === p.id));
      if (list.length) { const ccy = String(p?.currency || base).toUpperCase(); extra.push({ id: `mf:${p?.id || 'all'}`, name: p ? `${p.name} MF` : 'Mutual funds', ccy, kind: 'mf', bookId: p?.id || 'all', ...calc(list, ccy) }); }
    });
    const byTag = new Map<string, any[]>();
    active.filter((h) => !isMf(h)).forEach((h) => {
      const t = String(h.source || '').replace(/\s*·\s*[A-Z0-9]{4,}$/i, '').trim();
      const tl = t.toLowerCase();
      if (!t || brokerNames.has(tl) || Array.from(brokerNames).some((b) => b.length > 2 && tl.includes(b))) return;
      byTag.set(t, [...(byTag.get(t) || []), h]);
    });
    const tagCards: Card[] = Array.from(byTag.entries()).map(([t, list]) => ({ id: `tag:${t}`, name: t, ccy: base, kind: 'tag' as const, bookId: 'all', ...calc(list, base) })).sort((a, b) => b.value - a.value).slice(0, 10);
    cards = [...cards, ...extra, ...tagCards];
  }
  return cards;
}

/** Auto-scrolling strip of portfolio summaries. Click/tap pauses it so it can be dragged or swiped; click again to resume. */
export default function PortfolioTicker({ holdings, portfolios = [], rates = [], baseCurrency = 'INR', multiple, onSelect }: { holdings: any[]; portfolios?: any[]; rates?: any[]; baseCurrency?: string; multiple: boolean; onSelect?: (id: string) => void }) {
  const cards = React.useMemo(() => buildCards(holdings, portfolios, rates, baseCurrency, multiple), [holdings, portfolios, rates, baseCurrency, multiple]);
  const ref = React.useRef<HTMLDivElement>(null);
  const [paused, setPaused] = React.useState(false);
  const [overflow, setOverflow] = React.useState(false);
  const pausedRef = React.useRef(false);
  pausedRef.current = paused;

  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => setOverflow((el.scrollWidth / (overflow ? 2 : 1)) > el.clientWidth + 4);
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  React.useEffect(() => {
    const el = ref.current; if (!el || !overflow) return;
    let raf = 0, last = performance.now(), pos = el.scrollLeft;
    const tick = (t: number) => {
      const dt = t - last; last = t;
      if (!pausedRef.current) {
        pos = el.scrollLeft + dt * 0.03; // ~30px/s
        const half = el.scrollWidth / 2;
        if (pos >= half) pos -= half;
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [overflow, cards.length]);

  if (cards.length === 0) return null;
  const list = overflow ? [...cards, ...cards] : cards;
  return (
    <div className="shrink-0 relative border-b border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-950/60">
      <div
        ref={ref}
        onClick={() => overflow && setPaused((p) => !p)}
        onTouchMove={() => setPaused(true)}
        onWheel={() => setPaused(true)}
        className="flex gap-2 overflow-x-auto no-scrollbar px-3 py-2 cursor-pointer select-none"
        style={{ scrollbarWidth: 'none' }}
        title={overflow ? (paused ? 'Click empty space to resume scrolling' : 'Click a card to open that portfolio (scrolling stops)') : undefined}
      >
        {list.map((c, i) => (
          <div key={`${c.id}-${i}`} onClick={(e) => { if (onSelect) { e.stopPropagation(); setPaused(true); onSelect(c.bookId || c.id); } }} className="shrink-0 min-w-[210px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black text-slate-500 truncate">{c.kind === 'tag' && <span className="mr-1 text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">TAG</span>}{c.kind === 'mf' && <span className="mr-1 text-[9px] px-1 py-0.5 rounded bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300">MF</span>}{c.name}</span>
              <span className="text-sm font-black tabular-nums">{money(c.value, c.ccy)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 mt-1 text-[11px] font-bold tabular-nums">
              <span className={tone(c.pnl)}>P/L {signed(c.pnl, c.ccy)} <span className="opacity-80">({pct(c.pnlPct)})</span></span>
            </div>
            <div className={`text-[11px] font-bold tabular-nums ${tone(c.day)}`}>Today {signed(c.day, c.ccy)} <span className="opacity-80">({pct(c.dayPct)})</span></div>
          </div>
        ))}
      </div>
      {overflow && <span className="absolute right-1 top-1 pointer-events-none text-slate-300 dark:text-slate-600">{paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}</span>}
    </div>
  );
}
