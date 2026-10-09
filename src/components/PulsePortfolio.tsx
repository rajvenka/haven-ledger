import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Search, TrendingUp, TrendingDown, X, SlidersHorizontal, Settings2 } from 'lucide-react';

type GroupBy = 'category' | 'broker' | 'currency' | 'portfolio';
type SortKey = 'value' | 'pnl' | 'pnlPct' | 'day' | 'name';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f97316', '#64748b', '#84cc16'];

const COMMODITY = /\b(gold|silver|oil|brent|natgas|copper|platinum)\b/i;

function categoryOf(h: any): string {
  const type = String(h.holding_type || '').toLowerCase();
  const ccy = String(h.currency || '').toUpperCase();
  const broker = String(h.broker || '').toLowerCase();
  if (type === 'options') return 'Options';
  if (type === 'mutual_fund' || h.exchange === 'MF') return 'India MF';
  if (COMMODITY.test(String(h.symbol || h.ticker || ''))) return 'Commodities';
  if (Number(h.leverage || 1) > 1) return 'CFDs';
  if (broker.includes('zerodha') || broker.includes('groww') || ccy === 'INR') return 'India stocks';
  if (ccy === 'AUD' || broker.includes('stake')) return 'AU stocks';
  if (ccy) return 'US / Intl stocks';
  return 'Other';
}

function fxFactory(rates: any[], base: string) {
  const b = String(base || 'INR').toUpperCase();
  const rateOf = (c: string) => {
    if (c === b) return 1;
    const r = rates.find((x: any) => String(x.currency || '').toUpperCase() === c);
    const v = Number(r?.rate_to_base);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  return (amt: number, from: string, to: string) => {
    const f = String(from || b).toUpperCase();
    const t = String(to || b).toUpperCase();
    if (f === t) return amt;
    const fr = rateOf(f), tr = rateOf(t);
    if (fr == null || tr == null) return amt;
    return (amt * fr) / tr;
  };
}

const money = (n: number, ccy: string, compact = false) => {
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: compact ? 1 : 0, notation: compact && Math.abs(n) >= 1e5 ? 'compact' : 'standard' }).format(n);
  } catch { return `${Math.round(n)} ${ccy}`; }
};
const px = (n: number) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—');
const pct = (n: number) => (Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—');
const tone = (n: number) => (n > 0 ? 'text-emerald-600 dark:text-emerald-400' : n < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500');

interface Props {
  holdings: any[];
  lots?: any[];
  portfolios?: any[];
  rates?: any[];
  baseCurrency?: string;
  connections?: any[];
  isLoading?: boolean;
  onManage: () => void;
}

export default function PulsePortfolio({ holdings, lots = [], portfolios = [], rates = [], baseCurrency = 'INR', connections = [], isLoading, onManage }: Props) {
  const currencies = useMemo(() => {
    const s = new Set<string>([baseCurrency.toUpperCase()]);
    holdings.forEach((h) => h.currency && s.add(String(h.currency).toUpperCase()));
    return Array.from(s);
  }, [holdings, baseCurrency]);
  const [ccy, setCcy] = useState(baseCurrency.toUpperCase());
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('value');
  const [filter, setFilter] = useState<string>('All');
  const [view, setView] = useState<'all' | 'gainers' | 'losers'>('all');
  const [selected, setSelected] = useState<string | null>(null);

  const fx = useMemo(() => fxFactory(rates, baseCurrency), [rates, baseCurrency]);

  const rows = useMemo(() => {
    return holdings
      .filter((h) => (h.status || 'active') === 'active')
      .map((h) => {
        const native = String(h.currency || baseCurrency).toUpperCase();
        const qty = Number(h.quantity || 0);
        const price = Number(h.live_price ?? h.current_price ?? h.buy_price ?? 0);
        const cost = Number(h.buy_price || 0) * qty;
        const mvN = price * qty;
        const prev = Number(h.previous_close);
        const live = Number(h.live_price);
        let dayN = 0;
        if (prev > 0 && live > 0 && live / prev < 20 && live / prev > 0.05) dayN = (live - prev) * qty;
        const portfolio = h.portfolio_id ? portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned' : 'Unassigned';
        return {
          h, id: String(h.id), symbol: String(h.ticker || h.symbol || '—'), name: String(h.name || h.symbol || ''),
          native, qty, price, buy: Number(h.buy_price || 0),
          value: fx(mvN, native, ccy), cost: fx(cost, native, ccy), pnl: fx(mvN - cost, native, ccy), day: fx(dayN, native, ccy),
          category: categoryOf(h), broker: String(h.broker || 'Manual'), currency: native, portfolio,
        };
      });
  }, [holdings, portfolios, fx, ccy, baseCurrency]);

  const totals = useMemo(() => {
    const value = rows.reduce((a, r) => a + r.value, 0);
    const cost = rows.reduce((a, r) => a + r.cost, 0);
    const day = rows.reduce((a, r) => a + r.day, 0);
    return { value, cost, pnl: value - cost, pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : 0, day, dayPct: value - day > 0 ? (day / (value - day)) * 100 : 0 };
  }, [rows]);

  const groups = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r[groupBy], (m.get(r[groupBy]) || 0) + r.value));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).filter((g) => g.value > 0).sort((a, b) => b.value - a.value);
  }, [rows, groupBy]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let l = rows.filter((r) => (filter === 'All' || r[groupBy] === filter) &&
      (!needle || r.symbol.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle) || r.broker.toLowerCase().includes(needle)));
    if (view === 'gainers') l = l.filter((r) => r.pnl > 0);
    if (view === 'losers') l = l.filter((r) => r.pnl < 0);
    const key: Record<SortKey, (r: any) => number | string> = {
      value: (r) => -r.value, pnl: (r) => -r.pnl, pnlPct: (r) => -(r.cost > 0 ? r.pnl / r.cost : 0), day: (r) => -r.day, name: (r) => r.symbol,
    };
    return [...l].sort((a, b) => { const x = key[sort](a), y = key[sort](b); return x < y ? -1 : x > y ? 1 : 0; });
  }, [rows, q, filter, groupBy, view, sort]);

  const best = useMemo(() => [...rows].sort((a, b) => b.pnl - a.pnl)[0], [rows]);
  const worst = useMemo(() => [...rows].sort((a, b) => a.pnl - b.pnl)[0], [rows]);
  const sel = selected ? rows.find((r) => r.id === selected) : null;
  const selLots = sel ? lots.filter((l: any) => String(l.holding_id) === sel.id) : [];

  if (isLoading && rows.length === 0) return <div className="p-8 text-sm text-slate-500">Loading portfolio…</div>;

  const Kpi = ({ label, value, sub, subTone }: { label: string; value: string; sub?: string; subTone?: string }) => (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{value}</div>
      {sub && <div className={`text-xs font-bold mt-0.5 ${subTone || 'text-slate-500'}`}>{sub}</div>}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Portfolio</h1>
          <p className="text-xs text-slate-500">{rows.length} positions · {connections.length} broker connection{connections.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={ccy} onChange={(e) => setCcy(e.target.value)} className="text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5">
            {currencies.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button onClick={onManage} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900">
            <Settings2 className="w-3.5 h-3.5" /> Import / connect / edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total value" value={money(totals.value, ccy, true)} sub={`Invested ${money(totals.cost, ccy, true)}`} />
        <Kpi label="Total P&L" value={money(totals.pnl, ccy, true)} sub={pct(totals.pnlPct)} subTone={tone(totals.pnl)} />
        <Kpi label="Today" value={money(totals.day, ccy, true)} sub={pct(totals.dayPct)} subTone={tone(totals.day)} />
        <Kpi label="Best / worst" value={best ? best.symbol : '—'} sub={worst ? `Worst: ${worst.symbol} ${money(worst.pnl, ccy, true)}` : ''} subTone="text-slate-500" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-black text-slate-800 dark:text-slate-100">Allocation</div>
            <div className="flex gap-1">
              {(['category', 'broker', 'currency', 'portfolio'] as GroupBy[]).map((g) => (
                <button key={g} onClick={() => { setGroupBy(g); setFilter('All'); }} className={`text-[10px] font-black px-2 py-1 rounded-full capitalize ${groupBy === g ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{g}</button>
              ))}
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={groups} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} onClick={(d: any) => setFilter(filter === d.name ? 'All' : d.name)}>
                  {groups.map((g, i) => <Cell key={g.name} fill={PALETTE[i % PALETTE.length]} opacity={filter === 'All' || filter === g.name ? 1 : 0.3} />)}
                </Pie>
                <Tooltip formatter={(v: any) => money(Number(v), ccy)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2">
            {groups.map((g, i) => (
              <button key={g.name} onClick={() => setFilter(filter === g.name ? 'All' : g.name)} className={`w-full flex items-center gap-2 text-xs px-2 py-1 rounded-lg ${filter === g.name ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="font-bold text-slate-700 dark:text-slate-200 truncate flex-1 text-left">{g.name}</span>
                <span className="tabular-nums text-slate-500">{totals.value > 0 ? ((g.value / totals.value) * 100).toFixed(1) : 0}%</span>
                <span className="tabular-nums font-bold text-slate-800 dark:text-slate-100 w-20 text-right">{money(g.value, ccy, true)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol, name, broker" className="w-full pl-8 pr-2 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-indigo-400 outline-none" />
            </div>
            {(['all', 'gainers', 'losers'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`text-[11px] font-black px-2.5 py-1.5 rounded-full capitalize ${view === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{v}</button>
            ))}
            <label className="inline-flex items-center gap-1 text-[11px] text-slate-500"><SlidersHorizontal className="w-3 h-3" />
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="bg-transparent font-bold">
                <option value="value">Value</option><option value="pnl">P&L</option><option value="pnlPct">P&L %</option><option value="day">Today</option><option value="name">Name</option>
              </select>
            </label>
            {filter !== 'All' && <button onClick={() => setFilter('All')} className="text-[11px] font-black text-indigo-600 inline-flex items-center gap-0.5">{filter} <X className="w-3 h-3" /></button>}
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-400">
                <tr><th className="text-left p-2.5">Holding</th><th className="text-right p-2.5 hidden sm:table-cell">Qty</th><th className="text-right p-2.5">Value</th><th className="text-right p-2.5">P&L</th><th className="text-right p-2.5 hidden sm:table-cell">Today</th></tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r.id)} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                    <td className="p-2.5">
                      <div className="font-black text-slate-900 dark:text-white">{r.symbol}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{r.broker} · {r.category}</div>
                    </td>
                    <td className="p-2.5 text-right tabular-nums hidden sm:table-cell">{px(r.qty)}</td>
                    <td className="p-2.5 text-right tabular-nums font-bold">{money(r.value, ccy, true)}</td>
                    <td className={`p-2.5 text-right tabular-nums font-bold ${tone(r.pnl)}`}>
                      {money(r.pnl, ccy, true)}<div className="text-[10px]">{pct(r.cost > 0 ? (r.pnl / r.cost) * 100 : 0)}</div>
                    </td>
                    <td className={`p-2.5 text-right tabular-nums hidden sm:table-cell ${tone(r.day)}`}>{r.day ? money(r.day, ccy, true) : '—'}</td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No holdings match.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {sel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md h-full overflow-auto bg-white dark:bg-slate-900 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xl font-black text-slate-900 dark:text-white">{sel.symbol}</div>
                <div className="text-xs text-slate-500">{sel.name} · {sel.broker} · {sel.portfolio}</div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
            </div>
            <div className={`flex items-center gap-2 text-2xl font-black ${tone(sel.pnl)}`}>
              {sel.pnl >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {money(sel.pnl, ccy)} <span className="text-sm">{pct(sel.cost > 0 ? (sel.pnl / sel.cost) * 100 : 0)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Value', money(sel.value, ccy)], ['Cost', money(sel.cost, ccy)],
                ['Quantity', px(sel.qty)], ['Avg buy', `${px(sel.buy)} ${sel.native}`],
                ['Last price', `${px(sel.price)} ${sel.native}`], ['Today', sel.day ? money(sel.day, ccy) : '—'],
                ['Category', sel.category], ['Bought', sel.h.buy_date || '—'],
                ...(sel.h.leverage > 1 ? [['Leverage', `${sel.h.leverage}x`]] : []),
                ...(sel.h.stop_loss_rate ? [['Stop loss', px(Number(sel.h.stop_loss_rate))]] : []),
                ...(sel.h.take_profit_rate ? [['Take profit', px(Number(sel.h.take_profit_rate))]] : []),
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2.5">
                  <div className="text-[10px] uppercase font-black text-slate-400">{k}</div>
                  <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            {selLots.length > 0 && (
              <div>
                <div className="text-xs font-black text-slate-700 dark:text-slate-200 mb-1">Lots ({selLots.length})</div>
                <div className="space-y-1">
                  {selLots.map((l: any, i: number) => (
                    <div key={l.id || i} className="flex justify-between text-xs rounded-lg bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5">
                      <span>{px(Number(l.quantity ?? l.units ?? 0))} @ {px(Number(l.open_rate ?? l.buy_price ?? 0))}</span>
                      <span className="text-slate-400">{l.open_date || l.buy_date || ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sel.h.notes && <p className="text-xs text-slate-500">{sel.h.notes}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
