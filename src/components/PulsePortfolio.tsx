import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Search, TrendingUp, TrendingDown, X, SlidersHorizontal, Settings2 } from 'lucide-react';

type GroupBy = 'category' | 'broker' | 'currency' | 'portfolio';
type SortKey = 'symbol' | 'broker' | 'category' | 'portfolio' | 'qty' | 'buy' | 'price' | 'dayPct' | 'day' | 'cost' | 'value' | 'pnl' | 'pnlPct' | 'weight' | 'buyDate' | 'heldDays' | 'leverage' | 'stop' | 'target' | 'updated';

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

interface Col { k: string; label: string; left?: boolean; tone?: (r: any) => number; cell: (r: any, total: number, ccy: string) => React.ReactNode; csv?: (r: any, total: number) => any }
const COLS: Col[] = [
  { k: 'symbol', label: 'Holding', left: true, cell: (r) => (<div><div className="font-black text-slate-900 dark:text-white">{r.symbol}</div><div className="text-[10px] text-slate-400 truncate max-w-[160px]">{r.name !== r.symbol ? r.name : r.category}</div></div>), csv: (r) => r.symbol },
  { k: 'broker', label: 'Broker', cell: (r) => <span className="text-slate-600 dark:text-slate-300">{r.broker}</span>, csv: (r) => r.broker },
  { k: 'portfolio', label: 'Portfolio', cell: (r) => <span className="text-slate-600 dark:text-slate-300">{r.portfolio}</span>, csv: (r) => r.portfolio },
  { k: 'category', label: 'Category', cell: (r) => <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">{r.category}</span>, csv: (r) => r.category },
  { k: 'qty', label: 'Qty', cell: (r) => px(r.qty), csv: (r) => r.qty },
  { k: 'buy', label: 'Avg cost', cell: (r) => <>{px(r.buy)} <span className="text-[10px] text-slate-400">{r.native}</span></>, csv: (r) => r.buy },
  { k: 'price', label: 'Last price', cell: (r) => <>{px(r.price)} <span className="text-[10px] text-slate-400">{r.native}</span></>, csv: (r) => r.price },
  { k: 'dayPct', label: 'Day %', tone: (r) => r.dayPct ?? 0, cell: (r) => (r.dayPct == null ? '—' : pct(r.dayPct)), csv: (r) => r.dayPct },
  { k: 'day', label: 'Day P&L', tone: (r) => r.day, cell: (r, _t, c) => (r.day ? money(r.day, c, true) : '—'), csv: (r) => r.day },
  { k: 'cost', label: 'Invested', cell: (r, _t, c) => money(r.cost, c, true), csv: (r) => r.cost },
  { k: 'value', label: 'Value', cell: (r, _t, c) => <span className="font-bold">{money(r.value, c, true)}</span>, csv: (r) => r.value },
  { k: 'pnl', label: 'P&L', tone: (r) => r.pnl, cell: (r, _t, c) => <span className="font-bold">{money(r.pnl, c, true)}</span>, csv: (r) => r.pnl },
  { k: 'pnlPct', label: 'P&L %', tone: (r) => r.pnl, cell: (r) => pct(r.pnlPct), csv: (r) => r.pnlPct },
  { k: 'weight', label: 'Weight', cell: (r, t) => (<div className="flex items-center justify-end gap-1.5"><div className="w-10 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, t > 0 ? (r.value / t) * 100 : 0)}%` }} /></div>{t > 0 ? ((r.value / t) * 100).toFixed(1) : 0}%</div>), csv: (r, t) => (t > 0 ? (r.value / t) * 100 : 0) },
  { k: 'buyDate', label: 'Bought', cell: (r) => r.buyDate || '—', csv: (r) => r.buyDate },
  { k: 'heldDays', label: 'Held (d)', cell: (r) => (r.heldDays == null ? '—' : r.heldDays), csv: (r) => r.heldDays },
  { k: 'leverage', label: 'Lev.', cell: (r) => (r.leverage ? `${r.leverage}x` : '—'), csv: (r) => r.leverage },
  { k: 'stop', label: 'Stop loss', cell: (r) => (r.stop ? px(r.stop) : '—'), csv: (r) => r.stop },
  { k: 'target', label: 'Target', cell: (r) => (r.target ? px(r.target) : '—'), csv: (r) => r.target },
  { k: 'updated', label: 'Price updated', cell: (r) => (r.updated ? new Date(r.updated).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'), csv: (r) => r.updated },
  { k: 'isin', label: 'ISIN', cell: (r) => r.isin || '—', csv: (r) => r.isin },
  { k: 'exchange', label: 'Exchange', cell: (r) => r.exchange || '—', csv: (r) => r.exchange },
];

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
  const [dir, setDir] = useState<1 | -1>(-1);
  const [group, setGroup] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('hv_pp_hidden') || 'null') || ['isin', 'exchange', 'updated', 'leverage', 'stop', 'target']; } catch { return []; } });
  const toggleCol = (k: string) => setHidden((h) => { const n = h.includes(k) ? h.filter((x) => x !== k) : [...h, k]; try { localStorage.setItem('hv_pp_hidden', JSON.stringify(n)); } catch { /* */ } return n; });
  const clickSort = (k: SortKey) => { if (sort === k) setDir((d) => (d === 1 ? -1 : 1)); else { setSort(k); setDir(['symbol', 'broker', 'category', 'portfolio'].includes(k) ? 1 : -1); } };
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
          dayPct: prev > 0 && live > 0 && live / prev < 20 && live / prev > 0.05 ? ((live - prev) / prev) * 100 : null as number | null,
          pnlPct: cost > 0 ? ((mvN - cost) / cost) * 100 : 0,
          invNative: cost, valNative: mvN,
          buyDate: h.buy_date ? String(h.buy_date) : '',
          heldDays: h.buy_date ? Math.max(0, Math.floor((Date.now() - new Date(h.buy_date).getTime()) / 86400000)) : null as number | null,
          leverage: Number(h.leverage || 0) > 1 ? Number(h.leverage) : null as number | null,
          stop: Number(h.stop_loss_rate) > 0 ? Number(h.stop_loss_rate) : null as number | null,
          target: Number(h.take_profit_rate) > 0 ? Number(h.take_profit_rate) : Number(h.target_price) > 0 ? Number(h.target_price) : null as number | null,
          updated: h.live_price_updated_at || h.current_price_updated_at || '',
          isin: String(h.isin || ''), exchange: String(h.exchange || ''),
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
    const get = (r: any): number | string => {
      switch (sort) {
        case 'weight': return r.value;
        case 'buyDate': return r.buyDate || '';
        case 'updated': return String(r.updated || '');
        case 'symbol': case 'broker': case 'category': case 'portfolio': return String(r[sort]).toLowerCase();
        default: return r[sort] ?? -Infinity;
      }
    };
    return [...l].sort((a, b) => { const x = get(a), y = get(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  }, [rows, q, filter, groupBy, view, sort, dir]);

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    visible.forEach((r) => { const k = r[groupBy]; m.set(k, [...(m.get(k) || []), r]); });
    return Array.from(m.entries()).map(([name, items]) => ({ name, items }));
  }, [visible, groupBy]);
  const exportCsv = () => {
    const cols = COLS.filter((c) => !hidden.includes(c.k));
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.map((c) => esc(c.label)).join(',')].concat(visible.map((r) => cols.map((c) => esc(c.csv ? c.csv(r, totals.value) : '')).join(',')));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'portfolio.csv'; a.click(); URL.revokeObjectURL(url);
  };
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
    <div className="max-w-[1600px] mx-auto p-3 sm:p-6 space-y-4">
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

      <div className="grid gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-black text-slate-800 dark:text-slate-100">Allocation</div>
            <div className="flex gap-1">
              {(['category', 'broker', 'currency', 'portfolio'] as GroupBy[]).map((g) => (
                <button key={g} onClick={() => { setGroupBy(g); setFilter('All'); }} className={`text-[10px] font-black px-2 py-1 rounded-full capitalize ${groupBy === g ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{g}</button>
              ))}
            </div>
          </div>
          <div className="md:grid md:grid-cols-[260px_1fr] md:gap-6 md:items-center">
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
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-0.5 mt-2 md:mt-0">
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
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol, name, broker" className="w-full pl-8 pr-2 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-indigo-400 outline-none" />
            </div>
            {(['all', 'gainers', 'losers'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`text-[11px] font-black px-2.5 py-1.5 rounded-full capitalize ${view === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{v}</button>
            ))}
            <button onClick={() => setGroup((g) => !g)} className={`text-[11px] font-black px-2.5 py-1.5 rounded-full ${group ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Group by {groupBy}</button>
            <div className="relative">
              <button onClick={() => setColsOpen((o) => !o)} className="text-[11px] font-black px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center gap-1"><SlidersHorizontal className="w-3 h-3" /> Columns</button>
              {colsOpen && (
                <div className="absolute right-0 mt-1 z-20 w-48 max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
                  {COLS.filter((c) => !c.left).map((c) => (
                    <label key={c.k} className="flex items-center gap-2 text-xs py-1 px-1 cursor-pointer">
                      <input type="checkbox" checked={!hidden.includes(c.k)} onChange={() => toggleCol(c.k)} /> {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={exportCsv} className="text-[11px] font-black px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">CSV</button>
            {filter !== 'All' && <button onClick={() => setFilter('All')} className="text-[11px] font-black text-indigo-600 inline-flex items-center gap-0.5">{filter} <X className="w-3 h-3" /></button>}
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-400">
                <tr>
                  {COLS.filter((c) => !hidden.includes(c.k)).map((c) => (
                    <th key={c.k} onClick={() => clickSort(c.k as SortKey)} className={`p-2.5 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 ${c.left ? 'text-left sticky left-0 bg-slate-50 dark:bg-slate-800' : 'text-right'}`}>
                      {c.label}{sort === c.k ? (dir === 1 ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(group ? grouped : [{ name: '', items: visible }]).map((g) => (
                  <React.Fragment key={g.name || 'all'}>
                    {group && (
                      <tr className="bg-slate-100/70 dark:bg-slate-800/60">
                        <td colSpan={99} className="p-2 text-[11px] font-black text-slate-700 dark:text-slate-200">
                          {g.name} <span className="text-slate-400 font-bold">· {g.items.length} · {money(g.items.reduce((a: number, r: any) => a + r.value, 0), ccy, true)} · <span className={tone(g.items.reduce((a: number, r: any) => a + r.pnl, 0))}>{money(g.items.reduce((a: number, r: any) => a + r.pnl, 0), ccy, true)}</span></span>
                        </td>
                      </tr>
                    )}
                    {g.items.map((r: any) => (
                      <tr key={r.id} onClick={() => setSelected(r.id)} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                        {COLS.filter((c) => !hidden.includes(c.k)).map((c) => (
                          <td key={c.k} className={`p-2.5 ${c.left ? 'text-left sticky left-0 bg-white dark:bg-slate-900' : 'text-right tabular-nums'} ${c.tone ? tone(c.tone(r)) : ''}`}>{c.cell(r, totals.value, ccy)}</td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {visible.length === 0 && <tr><td colSpan={99} className="p-8 text-center text-slate-400">No holdings match.</td></tr>}
              </tbody>
              {visible.length > 0 && (
                <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-slate-800 font-black">
                  <tr>
                    {COLS.filter((c) => !hidden.includes(c.k)).map((c, i) => {
                      const sum = (f: string) => visible.reduce((a, r: any) => a + (r[f] || 0), 0);
                      let t: React.ReactNode = '';
                      if (i === 0) t = `Total · ${visible.length}`;
                      else if (c.k === 'cost') t = money(sum('cost'), ccy, true);
                      else if (c.k === 'value') t = money(sum('value'), ccy, true);
                      else if (c.k === 'pnl') t = <span className={tone(sum('pnl'))}>{money(sum('pnl'), ccy, true)}</span>;
                      else if (c.k === 'pnlPct') { const co = sum('cost'); t = <span className={tone(sum('pnl'))}>{co > 0 ? pct((sum('pnl') / co) * 100) : '—'}</span>; }
                      else if (c.k === 'day') t = <span className={tone(sum('day'))}>{money(sum('day'), ccy, true)}</span>;
                      else if (c.k === 'weight') t = totals.value > 0 ? `${((sum('value') / totals.value) * 100).toFixed(1)}%` : '';
                      return <td key={c.k} className={`p-2.5 ${c.left ? 'text-left sticky left-0 bg-slate-50 dark:bg-slate-800' : 'text-right tabular-nums'}`}>{t}</td>;
                    })}
                  </tr>
                </tfoot>
              )}
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
