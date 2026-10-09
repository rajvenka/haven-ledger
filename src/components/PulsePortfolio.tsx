import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, Treemap } from 'recharts';
import PortfolioPnLCalendar from './PortfolioPnLCalendar';
import PortfolioV1View from './PortfolioV1View';
import { Search, TrendingUp, TrendingDown, X, SlidersHorizontal, Plus, Pencil, Trash2, LayoutDashboard, List, CheckCircle2, CalendarDays, Wallet, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Star, Target } from 'lucide-react';

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
  if (compact && String(ccy).toUpperCase() === 'INR' && Math.abs(n) >= 1e5) {
    const a = Math.abs(n); const sign = n < 0 ? '-' : '';
    return a >= 1e7 ? `${sign}₹${(a / 1e7).toFixed(2)} Cr` : `${sign}₹${(a / 1e5).toFixed(2)} L`;
  }
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
  isReadOnly?: boolean;
  importProps?: any;
  cashBalances?: any[];
  loadDailyPositions?: (from: string, to: string, portfolioId?: string | null) => Promise<any[]>;
  snapshotDaily?: (currencies?: string[], timezone?: string) => Promise<void>;
  addHolding?: (h: any) => Promise<any>;
  updateHolding?: (id: string, u: any) => Promise<any>;
  sellHolding?: (id: string, p: { quantity: number; soldPrice: number; soldDate: string }) => Promise<any>;
  deleteHolding?: (id: string) => Promise<any>;
  bulkDelete?: (ids: string[]) => Promise<any>;
  setCash?: (location: any, amount: number, asOf?: string, notes?: string, portfolioId?: string) => Promise<any>;
  deleteCash?: (id: string) => Promise<any>;
}

type Section = 'overview' | 'holdings' | 'sold' | 'calendar' | 'cash' | 'sync';
const NAV: { k: Section; label: string; icon: React.ReactNode }[] = [
  { k: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { k: 'holdings', label: 'Holdings', icon: <List className="w-4 h-4" /> },
  { k: 'sold', label: 'Sold', icon: <CheckCircle2 className="w-4 h-4" /> },
  { k: 'calendar', label: 'Calendar', icon: <CalendarDays className="w-4 h-4" /> },
  { k: 'cash', label: 'Cash', icon: <Wallet className="w-4 h-4" /> },
  { k: 'sync', label: 'Import & Sync', icon: <RefreshCw className="w-4 h-4" /> },
];

export default function PulsePortfolio({ holdings, lots = [], portfolios = [], rates = [], baseCurrency = 'INR', connections = [], isLoading, onManage, isReadOnly, importProps, cashBalances = [], loadDailyPositions, snapshotDaily, addHolding, updateHolding, sellHolding, deleteHolding, bulkDelete, setCash, deleteCash }: Props) {
  const [section, setSectionState] = useState<Section>(() => { try { return (localStorage.getItem('hv_pp_section') as Section) || 'overview'; } catch { return 'overview'; } });
  const setSection = (k: Section) => { setSectionState(k); try { localStorage.setItem('hv_pp_section', k); } catch { /* */ } };
  const [design, setDesignState] = useState<number>(() => { try { return Number(localStorage.getItem('hv_pp_design')) || 1; } catch { return 1; } });
  const setDesign = (n: number) => { setDesignState(n); try { localStorage.setItem('hv_pp_design', String(n)); } catch { /* */ } };
  const [heatBy, setHeatBy] = useState<'pnlPct' | 'dayPct'>('pnlPct');
  const [openBrokers, setOpenBrokers] = useState<string[]>([]);
  const [defaultBook, setDefaultBook] = useState<string>(() => { try { return localStorage.getItem('hv_pp_default_book') || ''; } catch { return ''; } });
  const [book, setBook] = useState<string>('');
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => { try { return localStorage.getItem('hv_pp_nav_collapsed') === '1'; } catch { return false; } });
  const [closed, setClosed] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('hv_pp_closed') || '[]'); } catch { return []; } });
  const toggleNav = () => setNavCollapsed((v) => { try { localStorage.setItem('hv_pp_nav_collapsed', v ? '0' : '1'); } catch { /* */ } return !v; });
  const toggleBlock = (k: string) => setClosed((c) => { const n = c.includes(k) ? c.filter((x) => x !== k) : [...c, k]; try { localStorage.setItem('hv_pp_closed', JSON.stringify(n)); } catch { /* */ } return n; });
  const isOpen = (k: string) => !closed.includes(k);
  const chev = (k: string) => (isOpen(k) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />);
  const [checked, setChecked] = useState<string[]>([]);
  const [form, setForm] = useState<any | null>(null);   // add / edit holding
  const [sellFor, setSellFor] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [trendRows, setTrendRows] = useState<any[]>([]);
  const [trendDays, setTrendDays] = useState(90);
  const [calRows, setCalRows] = useState<any[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calCcy, setCalCcy] = useState(baseCurrency.toUpperCase());
  const [calBook, setCalBook] = useState('all');
  const [cashForm, setCashForm] = useState<{ location: string; amount: string; portfolioId: string }>({ location: 'Bank', amount: '', portfolioId: '' });
  const bridge = React.useRef<any>(null);
  const [, bump] = useState(0);
  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const currencies = useMemo(() => {
    const s = new Set<string>([baseCurrency.toUpperCase()]);
    holdings.forEach((h) => h.currency && s.add(String(h.currency).toUpperCase()));
    return Array.from(s);
  }, [holdings, baseCurrency]);
  const [ccy, setCcy] = useState(baseCurrency.toUpperCase());
  const chooseBook = (id: string) => {
    setBook(id); setFilter('All'); setChecked([]);
    const pc = id !== 'All' ? String(portfolios.find((p: any) => p.id === id)?.currency || '').toUpperCase() : '';
    if (pc) setCcy(pc);
  };
  // Pick the default book once portfolios have loaded: saved default, else the first book (never "All" by default).
  React.useEffect(() => {
    if (book) return;
    if (portfolios.length === 0) { if (!isLoading) setBook('All'); return; }
    const pick = portfolios.find((p: any) => p.id === defaultBook) || portfolios[0];
    chooseBook(pick.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolios, book]);
  const makeDefault = (id: string) => { setDefaultBook(id); try { localStorage.setItem('hv_pp_default_book', id); } catch { /* */ } };
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
      .filter((h) => (h.status || 'active') === 'active' && (book === 'All' || !book || h.portfolio_id === book))
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
          target: Number(h.take_profit_rate) > 0 ? Number(h.take_profit_rate) : Number(h.target_price) > 0 ? Number(h.target_price) : (h.target_type === 'percent' && Number(h.target_percent) > 0 ? Number(h.buy_price) * (1 + Number(h.target_percent) / 100) : null) as number | null,
          updated: h.live_price_updated_at || h.current_price_updated_at || '',
          isin: String(h.isin || ''), exchange: String(h.exchange || ''),
        };
      });
  }, [holdings, portfolios, fx, ccy, baseCurrency, book]);

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

  const soldRows = useMemo(() => holdings
    .filter((h) => h.status === 'sold' && (book === 'All' || !book || h.portfolio_id === book))
    .map((h) => {
      const native = String(h.currency || baseCurrency).toUpperCase();
      const qty = Number(h.quantity || 0);
      const cost = Number(h.buy_price || 0) * qty;
      const proceeds = Number(h.sold_price || 0) * qty;
      return { id: String(h.id), symbol: String(h.ticker || h.symbol || '—'), broker: String(h.broker || ''), qty, native,
        buy: Number(h.buy_price || 0), sell: Number(h.sold_price || 0), buyDate: h.buy_date || '', soldDate: h.sold_date || '',
        cost: fx(cost, native, ccy), proceeds: fx(proceeds, native, ccy), pnl: fx(proceeds - cost, native, ccy), pnlPct: cost > 0 ? ((proceeds - cost) / cost) * 100 : 0 };
    })
    .sort((a, b) => String(b.soldDate).localeCompare(String(a.soldDate))), [holdings, book, fx, ccy, baseCurrency]);
  const soldTotals = useMemo(() => ({ pnl: soldRows.reduce((a, r) => a + r.pnl, 0), proceeds: soldRows.reduce((a, r) => a + r.proceeds, 0),
    wins: soldRows.filter((r) => r.pnl > 0).length }), [soldRows]);
  const soldByYear = useMemo(() => { const m: Record<string, number> = {}; soldRows.forEach((r) => { const y = String(r.soldDate).slice(0, 4) || '—'; m[y] = (m[y] || 0) + r.pnl; }); return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0])); }, [soldRows]);

  const cashRows = useMemo(() => cashBalances.filter((c) => book === 'All' || !book || !c.portfolio_id || c.portfolio_id === book).map((c) => ({ ...c, conv: fx(Number(c.amount || 0), String(c.currency || baseCurrency).toUpperCase(), ccy) })), [cashBalances, book, fx, ccy, baseCurrency]);
  const cashTotal = cashRows.reduce((a, c) => a + c.conv, 0);

  // Value-over-time (from daily snapshots)
  React.useEffect(() => {
    if (section !== 'overview' || !loadDailyPositions) return;
    let alive = true;
    const to = new Date(); const from = new Date(Date.now() - trendDays * 86400000);
    loadDailyPositions(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10), book === 'All' || !book ? null : book).then((d) => { if (alive) setTrendRows(d || []); }).catch(() => {});
    return () => { alive = false; };
  }, [section, trendDays, book, loadDailyPositions]);
  const trend = useMemo(() => {
    const m: Record<string, number> = {}; const n: Record<string, number> = {};
    trendRows.forEach((r: any) => { const c = String(r.currency || '').toUpperCase(); m[r.snapshot_date] = (m[r.snapshot_date] || 0) + fx(Number(r.market_value || 0), c, ccy); n[r.snapshot_date] = (n[r.snapshot_date] || 0) + 1; });
    const maxN = Math.max(0, ...Object.values(n));
    Object.keys(m).forEach((d) => { if (n[d] < maxN * 0.7) delete m[d]; }); // skip days with partial snapshots
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date: date.slice(5), value: Math.round(value) }));
  }, [trendRows, fx, ccy]);

  const reloadCal = async () => {
    if (!loadDailyPositions) return;
    setCalLoading(true);
    try {
      const to = new Date(); const from = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());
      const d = await loadDailyPositions(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10), calBook === 'all' ? null : calBook);
      setCalRows(d || []);
    } finally { setCalLoading(false); }
  };
  React.useEffect(() => { if (section === 'calendar') reloadCal(); /* eslint-disable-next-line */ }, [section, calBook]);

  const run = async (fn: () => Promise<any>, done?: () => void) => {
    setBusy(true); setErr(null);
    try { await fn(); done?.(); } catch (e: any) { setErr(e?.message || 'Something went wrong'); } finally { setBusy(false); }
  };
  const emptyForm = { id: '', symbol: '', broker: '', exchange: '', quantity: '', buyPrice: '', buyDate: new Date().toISOString().slice(0, 10), currency: baseCurrency.toUpperCase(), portfolioId: book !== 'All' ? book : '', currentPrice: '', targetPrice: '', stopLoss: '', notes: '' };
  const openEdit = (h: any) => setForm({ id: String(h.id), symbol: h.symbol || '', broker: h.broker || '', exchange: h.exchange || '', quantity: String(h.quantity ?? ''), buyPrice: String(h.buy_price ?? ''), buyDate: h.buy_date || '', currency: String(h.currency || baseCurrency).toUpperCase(), portfolioId: h.portfolio_id || '', currentPrice: String(h.live_price ?? h.current_price ?? ''), targetPrice: h.target_price ? String(h.target_price) : '', stopLoss: h.stop_loss_rate ? String(h.stop_loss_rate) : '', notes: h.notes || '' });
  const saveForm = () => {
    const f = form; if (!f) return;
    const qty = Number(f.quantity), bp = Number(f.buyPrice);
    if (!f.symbol.trim() || !f.broker.trim() || !(qty > 0) || !(bp >= 0)) { setErr('Symbol, broker, quantity and buy price are required.'); return; }
    run(async () => {
      if (f.id) {
        await updateHolding?.(f.id, { symbol: f.symbol.trim().toUpperCase(), broker: f.broker.trim(), exchange: f.exchange.trim(), quantity: qty, buyPrice: bp, buyDate: f.buyDate, currency: f.currency, portfolioId: f.portfolioId || null,
          ...(f.currentPrice !== '' ? { currentPrice: Number(f.currentPrice) } : {}), targetType: f.targetPrice ? 'price' : null, targetPrice: f.targetPrice ? Number(f.targetPrice) : null, ...(f.stopLoss ? { stopLossRate: Number(f.stopLoss) } : {}), notes: f.notes });
      } else {
        await addHolding?.({ broker: f.broker.trim(), symbol: f.symbol.trim(), exchange: f.exchange.trim(), quantity: qty, buyPrice: bp, buyDate: f.buyDate, currency: f.currency, portfolioId: f.portfolioId || undefined,
          currentPrice: f.currentPrice !== '' ? Number(f.currentPrice) : undefined, targetType: f.targetPrice ? 'price' : undefined, targetPrice: f.targetPrice ? Number(f.targetPrice) : undefined, notes: f.notes || undefined });
      }
    }, () => { setForm(null); setSelected(null); });
  };

  const best = useMemo(() => [...rows].sort((a, b) => b.pnl - a.pnl)[0], [rows]);
  const worst = useMemo(() => [...rows].sort((a, b) => a.pnl - b.pnl)[0], [rows]);
  const sel = selected ? rows.find((r) => r.id === selected) : null;
  const selLots = sel ? lots.filter((l: any) => String(l.holding_id) === sel.id) : [];


  const b = bridge.current;
  const ago = (iso?: string) => {
    if (!iso) return 'Never';
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    return m < 1 ? 'Just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
  };
  const connStatus = (c: any) => {
    if (b?.needsReauth?.(c)) return { label: 'Re-authorize', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' };
    if (!c.last_synced_at) return { label: 'Never synced', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
    const h = (Date.now() - new Date(c.last_synced_at).getTime()) / 3600000;
    return h < 24 ? { label: 'Up to date', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' } : { label: 'Stale', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' };
  };
  const syncAll = async () => {
    if (!b) return;
    setSyncAllBusy(true);
    try { for (const c of connections) { if (!b.needsReauth?.(c)) await bridge.current.syncConnection(c); } } finally { setSyncAllBusy(false); }
  };
  const failedPrices = holdings.filter((h) => (h.status || 'active') === 'active' && (h.price_lookup_failed || h.price_stale)).length;
  const lastPrice = holdings.reduce((m: number, h) => Math.max(m, h.live_price_updated_at ? new Date(h.live_price_updated_at).getTime() : 0), 0);

  const syncHub = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { t: 'Sync all brokers', d: `${connections.length} linked`, onClick: syncAll, busy: syncAllBusy, primary: true, off: connections.length === 0 },
          { t: 'Refresh prices', d: lastPrice ? `Last ${ago(new Date(lastPrice).toISOString())}` : 'No prices yet', onClick: () => b?.refreshAllPrices?.(), busy: b?.refreshingPrices },
          { t: 'Import file', d: 'CSV / XLSX from any broker', onClick: () => b?.openImport?.() },
          { t: 'Connect broker', d: 'Zerodha, Groww, eToro, IG…', onClick: () => b?.openConnect?.() },
        ].map((a) => (
          <button key={a.t} disabled={isReadOnly || a.off || a.busy} onClick={a.onClick} className={`text-left rounded-2xl p-4 border transition-all disabled:opacity-50 ${a.primary ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400'}`}>
            <div className="text-sm font-black">{a.busy ? 'Working…' : a.t}</div>
            <div className={`text-[11px] mt-0.5 ${a.primary ? 'text-indigo-100' : 'text-slate-500'}`}>{a.d}</div>
          </button>
        ))}
      </div>
      {b?.priceRefreshSummary && <p className="text-xs font-bold text-emerald-600">{b.priceRefreshSummary}</p>}
      {(b?.connectOk || b?.connectError) && <p className={`text-xs font-bold ${b.connectError ? 'text-rose-600' : 'text-emerald-600'}`}>{b.connectError || b.connectOk}</p>}
      {failedPrices > 0 && <p className="text-xs font-bold text-amber-600">{failedPrices} holding{failedPrices === 1 ? '' : 's'} have no fresh price - run "Refresh prices".</p>}

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 text-sm font-black border-b border-slate-100 dark:border-slate-800">Broker connections</div>
        {connections.length === 0 && <div className="p-6 text-sm text-slate-500">No brokers connected yet. Use "Connect broker" for live sync, or "Import file" for a one-off upload.</div>}
        {connections.map((c: any) => {
          const st = connStatus(c);
          const pName = c.portfolio_id ? portfolios.find((p: any) => p.id === c.portfolio_id)?.name : null;
          const busy = b?.syncingId === c.id;
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 first:border-t-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-black uppercase">{String(c.broker_type || '?').slice(0, 2)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-slate-900 dark:text-white truncate">{c.connection_label || c.broker_type}</div>
                <div className="text-[11px] text-slate-500">{pName || 'Workspace'} · last sync {ago(c.last_synced_at)}</div>
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span>
              <button disabled={isReadOnly || busy} onClick={() => (b?.needsReauth?.(c) ? b.openConnect() : b?.syncConnection?.(c))} className={`text-xs font-black px-3 py-2 rounded-xl text-white disabled:opacity-50 ${b?.needsReauth?.(c) ? 'bg-amber-600' : 'bg-indigo-600'}`}>{busy ? 'Syncing…' : b?.needsReauth?.(c) ? 'Re-authorize' : 'Sync now'}</button>
              <button disabled={isReadOnly || busy} onClick={() => { if (window.confirm('Delete this connection? Holdings stay.')) b?.removeConnection?.(c.id); }} className="text-xs font-black px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 disabled:opacity-50">Delete</button>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
        <div className="text-sm font-black mb-2">Import from a file</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {['Universal CSV', 'Zerodha', 'Groww stocks', 'Groww MF', 'Stake', 'Moomoo', 'Tiger'].map((t) => <span key={t} className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{t}</span>)}
        </div>
        <button disabled={isReadOnly} onClick={() => b?.openImport?.()} className="w-full py-8 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-sm font-black hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 disabled:opacity-50">Choose broker, pick portfolio book, upload file</button>
        <p className="text-[11px] text-slate-500 mt-2">Live sync keeps prices and positions current for linked brokers. File import is for brokers without an API (Moomoo, Tiger, Stake…).</p>
      </div>
    </div>
  );

  if (isLoading && rows.length === 0) return <div className="p-8 text-sm text-slate-500">Loading portfolio…</div>;

  const Kpi = ({ label, value, sub, subTone }: { label: string; value: string; sub?: string; subTone?: string }) => (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{value}</div>
      {sub && <div className={`text-xs font-bold mt-0.5 ${subTone || 'text-slate-500'}`}>{sub}</div>}
    </div>
  );

  const nearStop = rows.map((r) => ({ ...r, stopDist: r.stop && r.price > 0 ? ((r.price - r.stop) / r.price) * 100 : null as number | null })).filter((r) => r.stopDist != null && r.stopDist >= 0 && r.stopDist < 8).sort((a, b) => (a.stopDist as number) - (b.stopDist as number)).slice(0, 5) as any[];

  const nearTarget = rows.map((r) => ({ ...r, tgtDist: r.target && r.price > 0 ? ((r.target - r.price) / r.price) * 100 : null as number | null })).filter((r) => r.tgtDist != null && r.tgtDist < 8).sort((a, b) => (a.tgtDist as number) - (b.tgtDist as number)).slice(0, 5) as any[];

  const inputCls = 'w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-400';
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (<label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span><div className="mt-1">{children}</div></label>);
  const setF = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const soldView = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Realized P&L" value={money(soldTotals.pnl, ccy, true)} subTone={tone(soldTotals.pnl)} sub={`${soldRows.length} sales`} />
        <Kpi label="Proceeds" value={money(soldTotals.proceeds, ccy, true)} />
        <Kpi label="Win rate" value={soldRows.length ? `${Math.round((soldTotals.wins / soldRows.length) * 100)}%` : '—'} sub={`${soldTotals.wins} winners`} />
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">By year</div>{soldByYear.length === 0 ? <div className="text-xs text-slate-400">—</div> : soldByYear.slice(0, 4).map(([y, v]) => <div key={y} className="flex justify-between text-xs"><span className="font-bold">{y}</span><span className={`tabular-nums font-bold ${tone(v)}`}>{money(v, ccy, true)}</span></div>)}</div>
      </div>
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-auto max-h-[70vh]">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-400"><tr>{['Holding', 'Broker', 'Qty', 'Buy', 'Sell', 'Bought', 'Sold', 'Proceeds', 'P&L', 'P&L %'].map((h, i) => <th key={h} className={`p-2.5 ${i < 2 ? 'text-left' : 'text-right'}`}>{h}</th>)}<th /></tr></thead>
          <tbody>
            {soldRows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="p-2.5 font-black">{r.symbol}</td><td className="p-2.5 text-slate-500">{r.broker}</td>
                <td className="p-2.5 text-right tabular-nums">{px(r.qty)}</td><td className="p-2.5 text-right tabular-nums">{px(r.buy)}</td><td className="p-2.5 text-right tabular-nums">{px(r.sell)}</td>
                <td className="p-2.5 text-right">{r.buyDate || '—'}</td><td className="p-2.5 text-right">{r.soldDate || '—'}</td>
                <td className="p-2.5 text-right tabular-nums">{money(r.proceeds, ccy, true)}</td>
                <td className={`p-2.5 text-right tabular-nums font-bold ${tone(r.pnl)}`}>{money(r.pnl, ccy, true)}</td><td className={`p-2.5 text-right tabular-nums ${tone(r.pnl)}`}>{pct(r.pnlPct)}</td>
                <td className="p-2.5 text-right">{!isReadOnly && <button onClick={() => { if (window.confirm('Delete this sale record?')) run(() => deleteHolding!(r.id)); }} className="text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
              </tr>
            ))}
            {soldRows.length === 0 && <tr><td colSpan={11} className="p-8 text-center text-slate-400">No sold positions yet. Use Sell on any holding.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const calendarView = (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
      <PortfolioPnLCalendar
        rows={calRows}
        loading={calLoading}
        currencies={Array.from(new Set([...calRows.map((r: any) => String(r.currency || '').toUpperCase()).filter(Boolean), baseCurrency.toUpperCase()]))}
        selectedCurrency={calCcy}
        onCurrencyChange={setCalCcy}
        portfolios={portfolios.map((p: any) => ({ id: p.id, name: p.name, currency: p.currency }))}
        selectedPortfolioId={calBook}
        onPortfolioChange={setCalBook}
        portfolioLabel={calBook !== 'all' ? portfolios.find((p: any) => p.id === calBook)?.name : undefined}
        canSnapshot={!isReadOnly}
        onRefreshSnapshot={snapshotDaily}
        onReload={reloadCal}
      />
    </div>
  );

  const cashView = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total cash" value={money(cashTotal, ccy, true)} sub={`${cashRows.length} account${cashRows.length === 1 ? '' : 's'}`} />
        <Kpi label="Invested" value={money(totals.value, ccy, true)} />
        <Kpi label="Net worth" value={money(totals.value + cashTotal, ccy, true)} />
        <Kpi label="Cash share" value={totals.value + cashTotal > 0 ? `${((cashTotal / (totals.value + cashTotal)) * 100).toFixed(1)}%` : '—'} />
      </div>
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {cashRows.length === 0 && <div className="p-6 text-sm text-slate-500">No cash balances yet. Add one below.</div>}
        {cashRows.map((c: any) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-t first:border-t-0 border-slate-100 dark:border-slate-800">
            <div className="flex-1"><div className="text-sm font-black">{c.location}</div><div className="text-[11px] text-slate-500">{c.portfolio_id ? portfolios.find((p: any) => p.id === c.portfolio_id)?.name : 'All books'} · as of {c.as_of_date}</div></div>
            <div className="text-sm font-black tabular-nums">{money(c.conv, ccy)}</div>
            {!isReadOnly && <button onClick={() => { if (window.confirm('Delete this cash balance?')) run(() => deleteCash!(c.id)); }} className="text-rose-500 p-1"><Trash2 className="w-4 h-4" /></button>}
          </div>
        ))}
      </div>
      {!isReadOnly && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 grid sm:grid-cols-4 gap-3 items-end">
          <Field label="Where"><select className={inputCls} value={cashForm.location} onChange={(e) => setCashForm({ ...cashForm, location: e.target.value })}>{['Bank', 'Zerodha', 'Groww', 'Other'].map((l) => <option key={l}>{l}</option>)}</select></Field>
          <Field label="Amount"><input className={inputCls} type="number" value={cashForm.amount} onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })} placeholder="0" /></Field>
          <Field label="Book"><select className={inputCls} value={cashForm.portfolioId} onChange={(e) => setCashForm({ ...cashForm, portfolioId: e.target.value })}><option value="">All books</option>{portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <button disabled={busy || cashForm.amount === ''} onClick={() => run(() => setCash!(cashForm.location, Number(cashForm.amount), undefined, undefined, cashForm.portfolioId || undefined), () => setCashForm({ ...cashForm, amount: '' }))} className="py-2 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-50">Save balance</button>
        </div>
      )}
    </div>
  );

  const holdingsView = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!isReadOnly && <button onClick={() => { setErr(null); setForm({ ...emptyForm }); }} className="inline-flex items-center gap-1 text-xs font-black px-3 py-2 rounded-xl bg-indigo-600 text-white"><Plus className="w-3.5 h-3.5" /> Add holding</button>}
        {!isReadOnly && checked.length > 0 && <button disabled={busy} onClick={() => { if (window.confirm(`Delete ${checked.length} holding(s)? This cannot be undone.`)) run(() => bulkDelete!(checked), () => setChecked([])); }} className="inline-flex items-center gap-1 text-xs font-black px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600"><Trash2 className="w-3.5 h-3.5" /> Delete {checked.length}</button>}
        {err && !form && <span className="text-xs font-bold text-rose-600">{err}</span>}
      </div>
      <div className="grid gap-4">
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
                  <th className="p-2.5 w-8 sticky left-0 bg-slate-50 dark:bg-slate-800"><input type="checkbox" checked={visible.length > 0 && checked.length === visible.length} onChange={(e) => setChecked(e.target.checked ? visible.map((r) => r.id) : [])} /></th>
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
                        <td className="p-2.5 w-8" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={checked.includes(r.id)} onChange={(e) => setChecked((cs) => (e.target.checked ? [...cs, r.id] : cs.filter((x) => x !== r.id)))} /></td>
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
                    <td />
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
    </div>
  );

  const NAV_BADGE: Record<string, number | undefined> = { holdings: rows.length, sold: soldRows.length || undefined, sync: connections.length || undefined };

  const kpiRow = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Kpi label="Total value" value={money(totals.value, ccy, true)} sub={`Invested ${money(totals.cost, ccy, true)}`} />
      <Kpi label="Total P&L" value={money(totals.pnl, ccy, true)} sub={pct(totals.pnlPct)} subTone={tone(totals.pnl)} />
      <Kpi label="Today" value={money(totals.day, ccy, true)} sub={pct(totals.dayPct)} subTone={tone(totals.day)} />
      <Kpi label="Best / worst" value={best ? `${best.symbol} ${money(best.pnl, ccy, true)}` : '—'} sub={worst ? `Worst: ${worst.symbol} ${money(worst.pnl, ccy, true)}` : ''} subTone="text-slate-500" />
    </div>
  );
  const alertsBlock = (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
      <div className="text-sm font-black">Movers &amp; alerts</div>
      {[['Top gainers', [...rows].sort((a, b) => b.pnl - a.pnl).filter((r) => r.pnl > 0).slice(0, 4)], ['Top losers', [...rows].sort((a, b) => a.pnl - b.pnl).filter((r) => r.pnl < 0).slice(0, 4)]].map(([t, list]: any) => (
        <div key={t}>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{t}</div>
          {list.map((r: any) => <button key={r.id} onClick={() => setSelected(r.id)} className="w-full flex justify-between text-xs py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1"><span className="font-bold">{r.symbol}</span><span className={`tabular-nums font-bold ${tone(r.pnl)}`}>{pct(r.pnlPct)}</span></button>)}
        </div>
      ))}
      {nearStop.length > 0 && <div><div className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-1">Near stop-loss</div>{nearStop.map((r: any) => <button key={r.id} onClick={() => setSelected(r.id)} className="w-full flex justify-between text-xs py-1 px-1"><span className="font-bold">{r.symbol}</span><span className="text-amber-600 font-bold">{r.stopDist.toFixed(1)}% away</span></button>)}</div>}
      {nearTarget.length > 0 && <div><div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1">Near profit target</div>{nearTarget.map((r: any) => <button key={r.id} onClick={() => setSelected(r.id)} className="w-full flex justify-between text-xs py-1 px-1"><span className="font-bold">{r.symbol}</span><span className="text-emerald-600 font-bold">{r.tgtDist <= 0 ? 'reached' : `${r.tgtDist.toFixed(1)}% to go`}</span></button>)}</div>}
    </div>
  );
  const topRows = [...rows].sort((a, b) => b.value - a.value);
  const brokerGroups = (() => {
    const m = new Map<string, any[]>();
    rows.forEach((r) => m.set(r.broker, [...(m.get(r.broker) || []), r]));
    return Array.from(m.entries()).map(([name, items]) => ({ name, items: items.sort((a, b) => b.value - a.value), value: items.reduce((a, r) => a + r.value, 0), cost: items.reduce((a, r) => a + r.cost, 0), pnl: items.reduce((a, r) => a + r.pnl, 0), day: items.reduce((a, r) => a + r.day, 0) })).sort((a, b) => b.value - a.value);
  })();
  const heatColor = (v: number | null) => { if (v == null) return '#334155'; const t = Math.min(1, Math.abs(v) / (heatBy === 'dayPct' ? 4 : 30)); return v >= 0 ? `rgba(16,185,129,${0.25 + t * 0.7})` : `rgba(244,63,94,${0.25 + t * 0.7})`; };
  const HeatTile = (props: any) => {
    const { x, y, width, height, name, pv, id } = props;
    if (width < 4 || height < 4 || !name) return <g />;
    return (
      <g onClick={() => id && setSelected(id)} style={{ cursor: 'pointer' }}>
        <rect x={x} y={y} width={width} height={height} rx={4} fill={heatColor(pv)} stroke="#0f172a" strokeWidth={2} />
        {width > 46 && height > 30 && <text x={x + 6} y={y + 16} fill="#fff" fontSize={11} fontWeight={800}>{String(name).slice(0, Math.floor(width / 7))}</text>}
        {width > 46 && height > 46 && pv != null && <text x={x + 6} y={y + 31} fill="#fff" fontSize={10} opacity={0.9}>{pct(pv)}</text>}
      </g>
    );
  };
  const Avatar = ({ t, i }: { t: string; i: number }) => <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ background: PALETTE[i % PALETTE.length] }}>{String(t).slice(0, 2).toUpperCase()}</div>;
  const Pill = ({ v }: { v: number }) => <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${v >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'}`}>{pct(v)}</span>;
  const heroSpark = trend.length > 1 && (
    <div className="h-20 -mx-2"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><defs><linearGradient id="hs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity={0.4} /><stop offset="100%" stopColor="#fff" stopOpacity={0} /></linearGradient></defs><YAxis hide domain={['auto', 'auto']} /><Area type="monotone" dataKey="value" stroke="#fff" strokeWidth={2} fill="url(#hs)" /></AreaChart></ResponsiveContainer></div>
  );

  const designOverview = (() => {
    if (design === 2) return (
      <div className="space-y-5">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white p-6 shadow-xl shadow-indigo-600/20">
          <div className="text-xs font-bold opacity-80">Total portfolio value</div>
          <div className="text-4xl sm:text-5xl font-black tabular-nums mt-1">{money(totals.value, ccy, true)}</div>
          <div className="flex flex-wrap gap-2 mt-3 text-xs font-black">
            <span className="px-2.5 py-1 rounded-full bg-white/20">{money(totals.pnl, ccy, true)} · {pct(totals.pnlPct)} all-time</span>
            <span className="px-2.5 py-1 rounded-full bg-white/20">{money(totals.day, ccy, true)} · {pct(totals.dayPct)} today</span>
            <span className="px-2.5 py-1 rounded-full bg-white/20">Invested {money(totals.cost, ccy, true)}</span>
          </div>
          {heroSpark}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-4 py-3"><div className="text-sm font-black">Your holdings</div><button onClick={() => setSection('holdings')} className="text-xs font-black text-indigo-600">See all {rows.length}</button></div>
            {topRows.slice(0, 12).map((r, i) => (
              <button key={r.id} onClick={() => setSelected(r.id)} className="w-full flex items-center gap-3 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left">
                <Avatar t={r.symbol} i={i} />
                <div className="flex-1 min-w-0"><div className="text-sm font-black truncate">{r.symbol}</div><div className="text-[11px] text-slate-400 truncate">{r.broker} · {px(r.qty)} units</div></div>
                <div className="text-right"><div className="text-sm font-black tabular-nums">{money(r.value, ccy, true)}</div><Pill v={r.pnlPct} /></div>
              </button>
            ))}
          </div>
          <div className="space-y-4">{alertsBlock}</div>
        </div>
      </div>
    );
    if (design === 3) return (
      <div className="space-y-4">
        {kpiRow}
        <div className="rounded-2xl bg-slate-900 p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-sm font-black text-white">Heatmap <span className="text-slate-400 font-bold text-xs">size = value · colour = {heatBy === 'pnlPct' ? 'total return' : 'today'}</span></div>
            <div className="flex gap-1">{([['pnlPct', 'Return'], ['dayPct', 'Today']] as const).map(([k, l]) => <button key={k} onClick={() => setHeatBy(k)} className={`text-[10px] font-black px-2.5 py-1 rounded-full ${heatBy === k ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400'}`}>{l}</button>)}</div>
          </div>
          <div className="h-[420px]"><ResponsiveContainer width="100%" height="100%"><Treemap data={topRows.slice(0, 80).filter((r) => r.value > 0).map((r) => ({ name: r.symbol, size: r.value, pv: r[heatBy], id: r.id }))} dataKey="size" content={<HeatTile />} isAnimationActive={false} /></ResponsiveContainer></div>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
            <div className="text-sm font-black mb-3">P&amp;L by {groupBy}</div>
            {(() => { const m = new Map<string, number>(); rows.forEach((r) => m.set(r[groupBy], (m.get(r[groupBy]) || 0) + r.pnl)); const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1]); const mx = Math.max(1, ...arr.map((a) => Math.abs(a[1]))); return arr.map(([k, v]) => (<div key={k} className="flex items-center gap-2 text-xs py-1"><span className="w-28 truncate font-bold">{k}</span><div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={`h-full ${v >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${(Math.abs(v) / mx) * 100}%` }} /></div><span className={`w-20 text-right tabular-nums font-bold ${tone(v)}`}>{money(v, ccy, true)}</span></div>)); })()}
          </div>
          {alertsBlock}
        </div>
      </div>
    );
    if (design === 4) return (
      <div className="space-y-3">
        <div className="rounded-xl bg-slate-900 text-slate-100 font-mono text-xs px-4 py-3 flex flex-wrap gap-x-8 gap-y-1">
          <span>VALUE <b className="text-white">{money(totals.value, ccy, true)}</b></span>
          <span>COST <b className="text-white">{money(totals.cost, ccy, true)}</b></span>
          <span>P&amp;L <b className={totals.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{money(totals.pnl, ccy, true)} ({pct(totals.pnlPct)})</b></span>
          <span>DAY <b className={totals.day >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{money(totals.day, ccy, true)} ({pct(totals.dayPct)})</b></span>
          <span>POS <b className="text-white">{rows.length}</b></span>
          <span>CASH <b className="text-white">{money(cashTotal, ccy, true)}</b></span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden">{groups.map((g, i) => <button key={g.name} title={`${g.name} ${money(g.value, ccy, true)}`} onClick={() => setFilter(filter === g.name ? 'All' : g.name)} style={{ width: `${(g.value / Math.max(1, totals.value)) * 100}%`, background: PALETTE[i % PALETTE.length], opacity: filter === 'All' || filter === g.name ? 1 : 0.3 }} />)}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">{groups.map((g, i) => <span key={g.name} className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{g.name} {((g.value / Math.max(1, totals.value)) * 100).toFixed(0)}%</span>)}</div>
        {holdingsView}
      </div>
    );
    if (design === 5) return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Kpi label="Net worth" value={money(totals.value + cashTotal, ccy, true)} sub={`Cash ${money(cashTotal, ccy, true)}`} />
          <Kpi label="Invested value" value={money(totals.value, ccy, true)} sub={`${pct(totals.pnlPct)} all-time`} subTone={tone(totals.pnl)} />
          <Kpi label="Today" value={money(totals.day, ccy, true)} sub={pct(totals.dayPct)} subTone={tone(totals.day)} />
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {brokerGroups.map((g, i) => {
            const open = openBrokers.includes(g.name);
            return (
              <div key={g.name} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button onClick={() => setOpenBrokers((o) => (open ? o.filter((x) => x !== g.name) : [...o, g.name]))} className="w-full text-left p-4">
                  <div className="flex items-center gap-3"><Avatar t={g.name} i={i} /><div className="flex-1 min-w-0"><div className="text-sm font-black truncate">{g.name}</div><div className="text-[11px] text-slate-400">{g.items.length} holdings</div></div>{open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}</div>
                  <div className="flex items-end justify-between mt-3"><div className="text-2xl font-black tabular-nums">{money(g.value, ccy, true)}</div><div className="text-right"><div className={`text-xs font-black ${tone(g.pnl)}`}>{money(g.pnl, ccy, true)}</div><div className={`text-[11px] font-bold ${tone(g.pnl)}`}>{pct(g.cost > 0 ? (g.pnl / g.cost) * 100 : 0)}</div></div></div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${(g.value / Math.max(1, totals.value)) * 100}%` }} /></div>
                </button>
                {open && <div className="border-t border-slate-100 dark:border-slate-800">{g.items.slice(0, 10).map((r) => <button key={r.id} onClick={() => setSelected(r.id)} className="w-full flex items-center justify-between px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50"><span className="font-black">{r.symbol}</span><span className="tabular-nums">{money(r.value, ccy, true)} <span className={`font-bold ${tone(r.pnl)}`}>{pct(r.pnlPct)}</span></span></button>)}{g.items.length > 10 && <button onClick={() => { setFilter(g.name); setGroupBy('broker'); setSection('holdings'); }} className="w-full py-2 text-[11px] font-black text-indigo-600">See all {g.items.length}</button>}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
    // design 6: mobile-first cards
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="rounded-3xl bg-slate-900 text-white p-6 text-center">
          <div className="text-xs font-bold text-slate-400">Portfolio value</div>
          <div className="text-4xl font-black tabular-nums mt-1">{money(totals.value, ccy, true)}</div>
          <div className={`text-sm font-black mt-1 ${totals.day >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{totals.day >= 0 ? '▲' : '▼'} {money(Math.abs(totals.day), ccy, true)} today ({pct(totals.dayPct)})</div>
          <div className="grid grid-cols-3 gap-2 mt-5 text-center">
            {[['Invested', money(totals.cost, ccy, true), ''], ['P&L', money(totals.pnl, ccy, true), totals.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'], ['Return', pct(totals.pnlPct), totals.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400']].map(([l, v, c]) => <div key={l} className="rounded-2xl bg-white/5 py-2"><div className="text-[10px] text-slate-400 font-bold">{l}</div><div className={`text-sm font-black ${c}`}>{v}</div></div>)}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['All', ...groups.map((g) => g.name)].map((n) => <button key={n} onClick={() => setFilter(n)} className={`shrink-0 text-xs font-black px-3.5 py-1.5 rounded-full ${filter === n ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{n}</button>)}
        </div>
        <div className="space-y-2">
          {topRows.filter((r) => filter === 'All' || r[groupBy] === filter).slice(0, 40).map((r, i) => (
            <button key={r.id} onClick={() => setSelected(r.id)} className="w-full text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-3"><Avatar t={r.symbol} i={i} /><div className="flex-1 min-w-0"><div className="font-black truncate">{r.symbol}</div><div className="text-[11px] text-slate-400 truncate">{r.broker} · {r.category}</div></div><Pill v={r.pnlPct} /></div>
              <div className="flex justify-between mt-3 text-xs"><span className="text-slate-400">Value</span><b className="tabular-nums">{money(r.value, ccy)}</b></div>
              <div className="flex justify-between mt-1 text-xs"><span className="text-slate-400">P&amp;L</span><b className={`tabular-nums ${tone(r.pnl)}`}>{money(r.pnl, ccy)}</b></div>
              <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (r.value / Math.max(1, totals.value)) * 100 * 4)}%` }} /></div>
            </button>
          ))}
        </div>
        <button onClick={() => setSection('holdings')} className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-black">Open full table</button>
      </div>
    );
  })();

  const DESIGN_NAMES = ['Command', 'Brokerage', 'Heatmap', 'Terminal', 'Accounts', 'Cards'];
  const tabStyle = (active: boolean) => design === 3 ? `px-4 py-1.5 rounded-full text-xs font-black ${active ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}` : design === 4 ? `px-3 py-1 text-[11px] font-mono font-bold uppercase ${active ? 'bg-slate-900 text-emerald-400' : 'text-slate-500 hover:text-slate-800'}` : `px-4 py-2 text-sm font-black -mb-px border-b-2 ${active ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`;
  const topTabs = (
    <div className={`flex gap-1 overflow-x-auto mb-4 ${design === 3 ? '' : design === 4 ? 'bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 w-fit' : 'border-b border-slate-200 dark:border-slate-800'}`}>
      {NAV.map((n) => <button key={n.k} onClick={() => setSection(n.k)} className={`shrink-0 ${tabStyle(section === n.k)}`}>{n.label}{NAV_BADGE[n.k] ? <span className="ml-1.5 text-[10px] opacity-60">{NAV_BADGE[n.k]}</span> : null}</button>)}
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto p-3 sm:p-6 pb-24 md:pb-6">
      <div className="flex items-center gap-1.5 flex-wrap mb-4 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/70 w-fit max-w-full overflow-x-auto">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2">Design</span>
        {DESIGN_NAMES.map((nm, i) => (
          <button key={nm} onClick={() => setDesign(i + 1)} className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${design === i + 1 ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Option {i + 1}<span className="hidden sm:inline font-bold opacity-60"> · {nm}</span></button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Portfolio</h1>
          <p className="text-xs text-slate-500">{rows.length} positions · {connections.length} broker connection{connections.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 w-16 shrink-0">Portfolio</span>
          {[...portfolios, { id: 'All', name: 'All' }].map((p: any) => (
            <span key={p.id} className="inline-flex items-center">
              <button onClick={() => chooseBook(p.id)} className={`text-xs font-black px-3.5 py-1.5 rounded-full transition-all ${book === p.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{p.name}{p.currency ? <span className="ml-1 opacity-60 font-bold">{String(p.currency).toUpperCase()}</span> : null}</button>
              {p.id !== 'All' && book === p.id && (
                <button title={defaultBook === p.id ? 'Default portfolio' : 'Make this my default portfolio'} onClick={() => makeDefault(p.id)} className={`ml-1 p-1 rounded-full ${defaultBook === p.id ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}><Star className={`w-3.5 h-3.5 ${defaultBook === p.id ? 'fill-current' : ''}`} /></button>
              )}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 w-16 shrink-0">Currency</span>
          {currencies.map((c) => (
            <button key={c} onClick={() => setCcy(c)} className={`text-xs font-black px-3.5 py-1.5 rounded-full transition-all ${ccy === c ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="md:flex md:gap-6">
        {design === 1 && (
        <nav className={`hidden md:block shrink-0 transition-all ${navCollapsed ? 'w-14' : 'w-48'}`}>
          <div className="sticky top-2 space-y-1">
            {NAV.map((n) => (
              <button key={n.k} title={n.label} onClick={() => setSection(n.k)} className={`w-full flex items-center ${navCollapsed ? 'justify-center' : ''} gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold text-left ${section === n.k ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                {n.icon}{!navCollapsed && <span className="flex-1">{n.label}</span>}{!navCollapsed && NAV_BADGE[n.k] ? <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${section === n.k ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>{NAV_BADGE[n.k]}</span> : null}
              </button>
            ))}
            <button onClick={toggleNav} title={navCollapsed ? 'Expand menu' : 'Collapse menu'} className={`w-full flex items-center ${navCollapsed ? 'justify-center' : ''} gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800`}>{navCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <><PanelLeftClose className="w-4 h-4" /> Collapse</>}</button>
            {!navCollapsed && <button onClick={onManage} className="w-full text-[11px] font-bold text-slate-400 hover:text-slate-600 px-3 pt-1 text-left">Back to current design</button>}
          </div>
        </nav>
        )}
        <div className="flex-1 min-w-0">
          {design > 1 && design !== 6 && topTabs}
          {section === 'overview' && design !== 1 && designOverview}
          {section === 'overview' && design === 1 && (
          <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total value" value={money(totals.value, ccy, true)} sub={`Invested ${money(totals.cost, ccy, true)}`} />
        <Kpi label="Total P&L" value={money(totals.pnl, ccy, true)} sub={pct(totals.pnlPct)} subTone={tone(totals.pnl)} />
        <Kpi label="Today" value={money(totals.day, ccy, true)} sub={pct(totals.dayPct)} subTone={tone(totals.day)} />
        <Kpi label="Best / worst" value={best ? `${best.symbol} ${money(best.pnl, ccy, true)}` : '—'} sub={worst ? `Worst: ${worst.symbol} ${money(worst.pnl, ccy, true)}` : ''} subTone="text-slate-500" />
      </div>


            <div className="grid lg:grid-cols-3 gap-4">
              <div className={`lg:col-span-2 self-start rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => toggleBlock('chart')} className="flex items-center gap-1 text-sm font-black">{chev('chart')} Portfolio value</button>
                  {isOpen('chart') && <div className="flex gap-1">{[30, 90, 180, 365].map((d) => <button key={d} onClick={() => setTrendDays(d)} className={`text-[10px] font-black px-2 py-1 rounded-full ${trendDays === d ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{d === 365 ? '1Y' : d === 180 ? '6M' : d === 90 ? '3M' : '1M'}</button>)}</div>}
                </div>
                {isOpen('chart') && (trend.length > 1 ? (
                  <div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><defs><linearGradient id="pv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={30} /><YAxis hide domain={['auto', 'auto']} /><Tooltip formatter={(v: any) => money(Number(v), ccy)} /><Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#pv)" /></AreaChart></ResponsiveContainer></div>
                ) : <div className="h-48 flex items-center justify-center text-xs text-slate-400 text-center px-6">No daily history for this range yet. Open the Calendar tab and press snapshot, or wait for the nightly snapshot.</div>)}
              </div>
              <div className="self-start rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <button onClick={() => toggleBlock('movers')} className="flex items-center gap-1 text-sm font-black">{chev('movers')} Movers &amp; alerts</button>
                {isOpen('movers') && <>
                {[['Top gainers', [...rows].sort((a, b) => b.pnl - a.pnl).filter((r) => r.pnl > 0).slice(0, 5)], ['Top losers', [...rows].sort((a, b) => a.pnl - b.pnl).filter((r) => r.pnl < 0).slice(0, 5)]].map(([t, list]: any) => (
                  <div key={t}>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{t}</div>
                    {list.length === 0 && <div className="text-xs text-slate-400">None</div>}
                    {list.map((r: any) => <button key={r.id} onClick={() => setSelected(r.id)} className="w-full flex justify-between text-xs py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1"><span className="font-bold">{r.symbol}</span><span className={`tabular-nums font-bold ${tone(r.pnl)}`}>{money(r.pnl, ccy, true)} · {pct(r.pnlPct)}</span></button>)}
                  </div>
                ))}
                {nearStop.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Near stop-loss</div>
                    {nearStop.map((r: any) => <button key={r.id} onClick={() => setSelected(r.id)} className="w-full flex justify-between text-xs py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1"><span className="font-bold">{r.symbol}</span><span className="text-amber-600 font-bold">{r.stopDist.toFixed(1)}% away</span></button>)}
                  </div>
                )}
                {nearTarget.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1 flex items-center gap-1"><Target className="w-3 h-3" /> Near profit target</div>
                    {nearTarget.map((r: any) => <button key={r.id} onClick={() => setSelected(r.id)} className="w-full flex justify-between text-xs py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1"><span className="font-bold">{r.symbol}</span><span className="text-emerald-600 font-bold">{r.tgtDist <= 0 ? 'target reached' : `${r.tgtDist.toFixed(1)}% to go`}</span></button>)}
                  </div>
                )}
                </>}
              </div>
            </div>
            <div className="grid gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => toggleBlock('alloc')} className="flex items-center gap-1 text-sm font-black text-slate-800 dark:text-slate-100">{chev('alloc')} Allocation</button>
            {isOpen('alloc') && <div className="flex gap-1">
              {(['category', 'broker', 'currency', 'portfolio'] as GroupBy[]).map((g) => (
                <button key={g} onClick={() => { setGroupBy(g); setFilter('All'); }} className={`text-[10px] font-black px-2 py-1 rounded-full capitalize ${groupBy === g ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{g}</button>
              ))}
            </div>}
          </div>
          {isOpen('alloc') && <div className="md:grid md:grid-cols-[260px_1fr] md:gap-6 md:items-center">
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
          </div>}
        </div>

            </div>
          </div>
)}
          {section === 'holdings' && holdingsView}
          {section === 'sold' && soldView}
          {section === 'calendar' && calendarView}
          {section === 'cash' && cashView}
          {section === 'sync' && syncHub}
          {importProps && <PortfolioV1View {...importProps} headless bridgeRef={bridge} onBridge={() => bump((n) => n + 1)} />}
        </div>
      </div>

      <nav className={`${design === 6 ? '' : 'md:hidden '}fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 grid grid-cols-6`}>
        {NAV.map((n) => (
          <button key={n.k} onClick={() => setSection(n.k)} className={`flex flex-col items-center gap-0.5 py-2 text-[9px] font-black ${section === n.k ? 'text-indigo-600' : 'text-slate-400'}`}>{n.icon}{n.label.replace('Import & Sync', 'Sync')}</button>
        ))}
      </nav>

      {form && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-3" onClick={() => !busy && setForm(null)}>
          <div className="w-full sm:max-w-lg max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-base font-black">{form.id ? 'Edit holding' : 'Add holding'}</h3><button onClick={() => setForm(null)}><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Symbol"><input className={inputCls} value={form.symbol} onChange={(e) => setF('symbol', e.target.value)} /></Field>
              <Field label="Broker"><input className={inputCls} value={form.broker} onChange={(e) => setF('broker', e.target.value)} placeholder="Zerodha, eToro…" /></Field>
              <Field label="Quantity"><input className={inputCls} type="number" value={form.quantity} onChange={(e) => setF('quantity', e.target.value)} /></Field>
              <Field label="Buy price"><input className={inputCls} type="number" value={form.buyPrice} onChange={(e) => setF('buyPrice', e.target.value)} /></Field>
              <Field label="Buy date"><input className={inputCls} type="date" value={form.buyDate} onChange={(e) => setF('buyDate', e.target.value)} /></Field>
              <Field label="Currency"><select className={inputCls} value={form.currency} onChange={(e) => setF('currency', e.target.value)}>{Array.from(new Set(['INR', 'USD', 'AUD', 'EUR', 'GBP', ...currencies])).map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Current price"><input className={inputCls} type="number" value={form.currentPrice} onChange={(e) => setF('currentPrice', e.target.value)} placeholder="optional" /></Field>
              <Field label="Exchange"><input className={inputCls} value={form.exchange} onChange={(e) => setF('exchange', e.target.value)} placeholder="NSE, NASDAQ…" /></Field>
              <Field label="Target price"><input className={inputCls} type="number" value={form.targetPrice} onChange={(e) => setF('targetPrice', e.target.value)} placeholder="optional" /></Field>
              <Field label="Stop loss"><input className={inputCls} type="number" value={form.stopLoss} onChange={(e) => setF('stopLoss', e.target.value)} placeholder="optional" /></Field>
              {portfolios.length > 0 && <Field label="Book"><select className={inputCls} value={form.portfolioId} onChange={(e) => setF('portfolioId', e.target.value)}><option value="">None</option>{portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
              <div className="col-span-2"><Field label="Notes"><input className={inputCls} value={form.notes} onChange={(e) => setF('notes', e.target.value)} /></Field></div>
            </div>
            {err && <p className="text-xs font-bold text-rose-600">{err}</p>}
            <div className="flex gap-2 pt-1"><button disabled={busy} onClick={saveForm} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button><button onClick={() => setForm(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold">Cancel</button></div>
          </div>
        </div>
      )}

      {sellFor && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-3" onClick={() => !busy && setSellFor(null)}>
          <div className="w-full sm:max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-black">Sell {sellFor.symbol}</h3>
            <Field label={`Quantity (max ${px(sellFor.max)})`}><input className={inputCls} type="number" value={sellFor.qty} onChange={(e) => setSellFor({ ...sellFor, qty: e.target.value })} /></Field>
            <Field label="Sold price"><input className={inputCls} type="number" value={sellFor.price} onChange={(e) => setSellFor({ ...sellFor, price: e.target.value })} /></Field>
            <Field label="Date"><input className={inputCls} type="date" value={sellFor.date} onChange={(e) => setSellFor({ ...sellFor, date: e.target.value })} /></Field>
            {err && <p className="text-xs font-bold text-rose-600">{err}</p>}
            <div className="flex gap-2"><button disabled={busy} onClick={() => run(() => sellHolding!(sellFor.id, { quantity: Number(sellFor.qty), soldPrice: Number(sellFor.price), soldDate: sellFor.date }), () => { setSellFor(null); setSelected(null); })} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-black disabled:opacity-50">{busy ? 'Saving…' : 'Confirm sale'}</button><button onClick={() => setSellFor(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold">Cancel</button></div>
          </div>
        </div>
      )}

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
            {!isReadOnly && (
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setErr(null); openEdit(sel.h); }} className="flex-1 inline-flex items-center justify-center gap-1 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-black"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={() => { setErr(null); setSellFor({ id: sel.id, symbol: sel.symbol, max: sel.qty, qty: String(sel.qty), price: String(sel.price), date: new Date().toISOString().slice(0, 10) }); }} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-black">Sell</button>
                <button onClick={() => { if (window.confirm(`Delete ${sel.symbol}?`)) run(() => deleteHolding!(sel.id), () => setSelected(null)); }} className="px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
