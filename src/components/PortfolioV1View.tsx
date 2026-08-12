/**
 * Portfolio_V1 — ultimate summary-first redesign.
 * Classic PortfolioView remains the full-feature workbench.
 *
 * Category tiles: India MF · India Stocks · US Stocks · CFD · Commodities · Options
 * Each tile expands for sub-totals + top holdings. Portfolio chips keep Sasi/Raj separate.
 */
import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Briefcase,
  Plus,
  X,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Link2,
  ShieldAlert,
  Landmark,
  ChartLine,
  ChartCandlestick,
  Fuel,
  Layers,
  Globe,
  Sparkles,
  Columns3,
  Settings2,
} from 'lucide-react';

type BrokerType = 'etoro' | 'ig' | 'webull' | 'zerodha' | 'groww';

type CategoryId =
  | 'india_mf'
  | 'india_stock'
  | 'us_stock'
  | 'au_stock'
  | 'cfd'
  | 'commodities'
  | 'options'
  | 'other';

interface Props {
  isReadOnly?: boolean;
  isDataLoading?: boolean;
  baseCurrency?: string;
  workspaceName?: string;
  portfolios?: any[];
  portfolioMode?: string;
  portfolioHoldings?: any[];
  /** eToro (and similar) per-position lots — one symbol can have many lots, each with its own stop. */
  portfolioHoldingLots?: any[];
  portfolioCashBalances?: any[];
  portfolioBrokerConnections?: any[];
  setPortfolioBrokerConnection?: (
    brokerType: BrokerType,
    credentials: Record<string, string>,
    portfolioId?: string,
    connectionLabel?: string
  ) => Promise<void>;
  deletePortfolioBrokerConnection?: (id: string) => Promise<void>;
  markBrokerConnectionSynced?: (id: string) => Promise<void>;
  updatePortfolioHoldingLivePrice?: (id: string, price: number, previousClose?: number | null) => Promise<void>;
  markPriceLookupFailed?: (id: string) => Promise<void>;
}

const BROKER_META: Record<
  string,
  { label: string; color: string; bg: string; ring: string; fields: { key: string; label: string; placeholder: string; secret?: boolean }[] }
> = {
  zerodha: {
    label: 'Zerodha',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    ring: 'ring-blue-500',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Kite API key' },
      { key: 'api_secret', label: 'API Secret', placeholder: 'Kite API secret', secret: true },
      { key: 'access_token', label: 'Access Token (optional)', placeholder: 'Daily token' },
    ],
  },
  groww: {
    label: 'Groww',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    ring: 'ring-emerald-500',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Groww API key' },
      { key: 'api_secret', label: 'API Secret', placeholder: 'Groww API secret', secret: true },
    ],
  },
  etoro: {
    label: 'eToro',
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    ring: 'ring-teal-500',
    fields: [
      { key: 'user_key', label: 'User Key', placeholder: 'eToro user key' },
      { key: 'password', label: 'Password', placeholder: 'eToro password', secret: true },
    ],
  },
  webull: {
    label: 'Webull',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    ring: 'ring-violet-500',
    fields: [
      { key: 'app_key', label: 'App Key', placeholder: 'Webull app key' },
      { key: 'app_secret', label: 'App Secret', placeholder: 'Webull app secret', secret: true },
    ],
  },
};

const COMMODITY_SYMBOLS = new Set([
  'GOLD', 'SILVER', 'OIL', 'NATGAS', 'COPPER', 'PLATINUM', 'PALLADIUM',
  'XAU', 'XAG', 'XAUUSD', 'XAGUSD', 'BRENT', 'WTI', 'GC=F', 'SI=F', 'CL=F',
]);

const CATEGORY_META: Record<
  CategoryId,
  { label: string; blurb: string; icon: React.ReactNode; accent: string; chip: string; ring: string }
> = {
  india_mf: {
    label: 'India · MF',
    blurb: 'Mutual funds',
    icon: <Landmark className="w-4 h-4" />,
    accent: 'from-amber-500/15 to-orange-500/5',
    chip: 'bg-amber-500 text-white',
    ring: 'ring-amber-400',
  },
  india_stock: {
    label: 'India · Stocks',
    blurb: 'NSE / BSE equity',
    icon: <ChartLine className="w-4 h-4" />,
    accent: 'from-blue-500/15 to-indigo-500/5',
    chip: 'bg-blue-600 text-white',
    ring: 'ring-blue-400',
  },
  us_stock: {
    label: 'US · Stocks',
    blurb: 'USD equities',
    icon: <Globe className="w-4 h-4" />,
    accent: 'from-violet-500/15 to-fuchsia-500/5',
    chip: 'bg-violet-600 text-white',
    ring: 'ring-violet-400',
  },
  au_stock: {
    label: 'AU · Stocks',
    blurb: 'ASX / AUD',
    icon: <Globe className="w-4 h-4" />,
    accent: 'from-sky-500/15 to-cyan-500/5',
    chip: 'bg-sky-600 text-white',
    ring: 'ring-sky-400',
  },
  cfd: {
    label: 'CFDs',
    blurb: 'Leveraged eToro',
    icon: <ChartCandlestick className="w-4 h-4" />,
    accent: 'from-teal-500/15 to-emerald-500/5',
    chip: 'bg-teal-600 text-white',
    ring: 'ring-teal-400',
  },
  commodities: {
    label: 'Commodities',
    blurb: 'Gold, oil, metals',
    icon: <Fuel className="w-4 h-4" />,
    accent: 'from-yellow-500/20 to-amber-600/5',
    chip: 'bg-yellow-600 text-white',
    ring: 'ring-yellow-400',
  },
  options: {
    label: 'Options',
    blurb: 'Contracts ×100',
    icon: <Sparkles className="w-4 h-4" />,
    accent: 'from-rose-500/15 to-pink-500/5',
    chip: 'bg-rose-600 text-white',
    ring: 'ring-rose-400',
  },
  other: {
    label: 'Other',
    blurb: 'Unclassified',
    icon: <Layers className="w-4 h-4" />,
    accent: 'from-slate-500/10 to-slate-500/5',
    chip: 'bg-slate-600 text-white',
    ring: 'ring-slate-400',
  },
};


const HOLDING_COLUMNS: { key: string; label: string; defaultOn: boolean; desktopOnly?: boolean }[] = [
  { key: 'type', label: 'Type', defaultOn: true },
  { key: 'portfolio', label: 'Portfolio', defaultOn: true, desktopOnly: true },
  { key: 'broker', label: 'Broker', defaultOn: true, desktopOnly: true },
  { key: 'qty', label: 'Qty', defaultOn: true },
  { key: 'buy', label: 'Buy', defaultOn: false, desktopOnly: true },
  { key: 'live', label: 'Live', defaultOn: true },
  { key: 'day', label: 'Day %', defaultOn: true, desktopOnly: true },
  { key: 'value', label: 'Value', defaultOn: true },
  { key: 'pnl', label: 'P&L %', defaultOn: true },
  { key: 'pnl_amt', label: 'P&L $', defaultOn: false, desktopOnly: true },
  { key: 'stop', label: 'Stop loss', defaultOn: true, desktopOnly: true },
  { key: 'lev', label: 'Lev', defaultOn: true, desktopOnly: true },
  { key: 'currency', label: 'Ccy', defaultOn: false, desktopOnly: true },
];

const DEFAULT_COLS = new Set(HOLDING_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key));

function money(n: number, currency = 'INR') {
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toFixed(0)} ${currency}`;
  }
}

function moneyPrecise(n: number, currency = 'USD') {
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function pct(n: number) {
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function livePrice(h: any): number {
  return Number(h.live_price ?? h.current_price ?? h.buy_price ?? 0);
}
function invested(h: any): number {
  return Number(h.buy_price || 0) * Number(h.quantity || 0);
}
function marketValue(h: any): number {
  return livePrice(h) * Number(h.quantity || 0);
}
function pnl(h: any): number {
  return marketValue(h) - invested(h);
}
function pnlPct(h: any): number {
  const inv = invested(h);
  return inv > 0 ? (pnl(h) / inv) * 100 : 0;
}
function dayChangePct(h: any): number | null {
  const live = Number(h.live_price);
  const prev = Number(h.previous_close);
  if (!Number.isFinite(live) || !Number.isFinite(prev) || prev <= 0) return null;
  return ((live - prev) / prev) * 100;
}
function stopLossDistancePct(h: any): number | null {
  const stop = Number(h.stop_loss_rate);
  const live = livePrice(h);
  if (!Number.isFinite(stop) || stop <= 0 || !Number.isFinite(live) || live <= 0) return null;
  return ((live - stop) / live) * 100;
}
function portfolioNameOf(h: any, portfolios: any[]): string {
  if (!h?.portfolio_id) return 'Unassigned';
  return portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned';
}
function symOf(h: any): string {
  return String(h.ticker || h.symbol || '').trim().toUpperCase();
}

/** Classify into product tiles — order of checks matters. */
function classifyHolding(h: any): CategoryId {
  const type = String(h.holding_type || '').toLowerCase();
  const broker = String(h.broker || '').toLowerCase();
  const ccy = String(h.currency || '').toUpperCase();
  const src = String(h.source || '').toLowerCase();
  const sym = symOf(h).replace(/[^A-Z0-9=]/g, '');
  const lev = Number(h.leverage || 1);

  if (type === 'options') return 'options';
  if (type === 'mutual_fund' || src.includes('mf') || h.exchange === 'MF') return 'india_mf';

  const isCommodity =
    COMMODITY_SYMBOLS.has(sym) ||
    COMMODITY_SYMBOLS.has(symOf(h)) ||
    /\b(gold|silver|oil|brent|natgas|copper)\b/i.test(String(h.symbol || h.name || ''));
  if (isCommodity) return 'commodities';

  // Leveraged / CFD-style (eToro) — after commodities so Gold CFD still lands in commodities
  if (lev > 1 || src.includes('cfd') || src.includes('leveraged') || src.includes('crypto margin')) {
    return 'cfd';
  }

  if (broker.includes('zerodha') || broker.includes('groww') || ccy === 'INR') return 'india_stock';
  if (ccy === 'AUD' || broker.includes('stake')) return 'au_stock';
  if (ccy === 'USD' || broker.includes('webull') || broker.includes('etoro') || broker.includes('moomoo') || broker.includes('tiger')) {
    return 'us_stock';
  }
  return 'other';
}

function summarizeBucket(holdings: any[]) {
  const byCcy: Record<string, { market: number; invested: number; pnl: number; count: number }> = {};
  holdings.forEach((h) => {
    const ccy = String(h.currency || 'USD').toUpperCase();
    if (!byCcy[ccy]) byCcy[ccy] = { market: 0, invested: 0, pnl: 0, count: 0 };
    const inv = invested(h);
    const mv = marketValue(h);
    byCcy[ccy].market += mv;
    byCcy[ccy].invested += inv;
    byCcy[ccy].pnl += mv - inv;
    byCcy[ccy].count += 1;
  });
  const tiles = Object.entries(byCcy)
    .map(([currency, v]) => ({
      currency,
      ...v,
      pnlPct: v.invested > 0 ? (v.pnl / v.invested) * 100 : 0,
    }))
    .sort((a, b) => b.market - a.market);
  return {
    count: holdings.length,
    byCurrency: tiles,
    primary: tiles[0] || null,
  };
}

export default function PortfolioV1View({
  isReadOnly,
  isDataLoading,
  baseCurrency = 'INR',
  workspaceName,
  portfolios = [],
  portfolioMode,
  portfolioHoldings = [],
  portfolioHoldingLots = [],
  portfolioBrokerConnections = [],
  setPortfolioBrokerConnection,
  deletePortfolioBrokerConnection,
}: Props) {
  const [portfolioFilter, setPortfolioFilter] = useState<string>('All');
  const [brokerFilter, setBrokerFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'All'>('All');
  const [expandedCategory, setExpandedCategory] = useState<CategoryId | null>(null);
  const [holdingsExpanded, setHoldingsExpanded] = useState(true);
  const [showLotsOnly, setShowLotsOnly] = useState(false);
  const [moversMode, setMoversMode] = useState<'overall' | 'day'>('overall');
  const [moversUnit, setMoversUnit] = useState<'pct' | 'dollar'>('pct');
  const [sortKey, setSortKey] = useState<string>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [colsOpen, setColsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('portfolio_v1_cols');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return new Set(arr);
      }
    } catch { /* ignore */ }
    return new Set(DEFAULT_COLS);
  });
  const toggleCol = (key: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem('portfolio_v1_cols', JSON.stringify(Array.from(next)));
      } catch { /* ignore */ }
      return next;
    });
  };
  const colOn = (key: string) => visibleCols.has(key);


  const [connectOpen, setConnectOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<'pick' | 'creds'>('pick');
  const [selectedBroker, setSelectedBroker] = useState<BrokerType | null>(null);
  const [connectPortfolioId, setConnectPortfolioId] = useState('');
  const [credFields, setCredFields] = useState<Record<string, string>>({});
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectOk, setConnectOk] = useState<string | null>(null);

  const multiPortfolio = portfolioMode === 'multiple' || (portfolios || []).length > 1;

  // Lots keyed by parent holding — Netflix with 5 eToro positions => 5 lot rows, each SL.
  const lotsByHoldingId = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const lot of portfolioHoldingLots || []) {
      const id = String(lot.holding_id || '');
      if (!id) continue;
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push(lot);
    }
    return m;
  }, [portfolioHoldingLots]);

  /** Prefer per-lot stops when present; otherwise fall back to consolidated holding stop. */
  function stopsForHolding(h: any): { stop: number; qty: number; live: number; dist: number; lotId?: string }[] {
    const lots = lotsByHoldingId.get(String(h.id)) || [];
    const lotStops = lots
      .map((lot) => {
        const stop = lot.stop_loss_rate != null ? Number(lot.stop_loss_rate) : NaN;
        if (!Number.isFinite(stop) || stop <= 0) return null;
        const live = Number(lot.current_price ?? h.live_price ?? h.current_price ?? lot.buy_price ?? h.buy_price) || 0;
        if (live <= 0) return null;
        const dist = ((live - stop) / live) * 100;
        return { stop, qty: Number(lot.quantity) || 0, live, dist, lotId: String(lot.id || lot.external_position_id || '') };
      })
      .filter(Boolean) as { stop: number; qty: number; live: number; dist: number; lotId?: string }[];
    if (lotStops.length > 0) return lotStops.sort((a, b) => a.dist - b.dist);
    const stop = h.stop_loss_rate != null ? Number(h.stop_loss_rate) : NaN;
    if (!Number.isFinite(stop) || stop <= 0) return [];
    const live = livePrice(h);
    if (live <= 0) return [];
    return [{ stop, qty: Number(h.quantity) || 0, live, dist: ((live - stop) / live) * 100 }];
  }


  // Desktop table columns — rebuilt whenever the user toggles Columns so widths reflow.
  const desktopCols = useMemo(() => {
    // Equal flexible tracks so hiding a column redistributes width (no empty gap left behind).
    const cols: { key: string; label: string; align: 'left' | 'right'; fr: string }[] = [
      { key: 'symbol', label: 'Symbol', align: 'left', fr: 'minmax(6rem, 1.4fr)' },
    ];
    if (colOn('type')) cols.push({ key: 'type', label: 'Type', align: 'left', fr: 'minmax(3rem, 0.8fr)' });
    if (colOn('portfolio') && multiPortfolio) cols.push({ key: 'portfolio', label: 'Portfolio', align: 'left', fr: 'minmax(3.5rem, 0.9fr)' });
    if (colOn('broker')) cols.push({ key: 'broker', label: 'Broker', align: 'left', fr: 'minmax(3rem, 0.8fr)' });
    if (colOn('qty')) cols.push({ key: 'qty', label: 'Qty', align: 'right', fr: 'minmax(2.5rem, 0.7fr)' });
    if (colOn('buy')) cols.push({ key: 'buy', label: 'Buy', align: 'right', fr: 'minmax(3rem, 0.8fr)' });
    if (colOn('live')) cols.push({ key: 'live', label: 'Live', align: 'right', fr: 'minmax(3rem, 0.8fr)' });
    if (colOn('day')) cols.push({ key: 'day', label: 'Day', align: 'right', fr: 'minmax(2.5rem, 0.7fr)' });
    if (colOn('value')) cols.push({ key: 'value', label: 'Value', align: 'right', fr: 'minmax(3.5rem, 1fr)' });
    if (colOn('pnl')) cols.push({ key: 'pnl', label: 'P&L%', align: 'right', fr: 'minmax(2.5rem, 0.7fr)' });
    if (colOn('pnl_amt')) cols.push({ key: 'pnl_amt', label: 'P&L$', align: 'right', fr: 'minmax(3rem, 0.8fr)' });
    if (colOn('stop')) cols.push({ key: 'stop', label: 'Stop', align: 'right', fr: 'minmax(3rem, 0.85fr)' });
    if (colOn('lev')) cols.push({ key: 'lev', label: 'Lev', align: 'right', fr: 'minmax(2rem, 0.5fr)' });
    if (colOn('currency')) cols.push({ key: 'currency', label: 'Ccy', align: 'right', fr: 'minmax(2rem, 0.5fr)' });
    return cols;
  }, [visibleCols, multiPortfolio]);

  const desktopGridStyle = useMemo(
    () => ({
      gridTemplateColumns: desktopCols.map((c) => c.fr).join(' '),
      width: '100%',
    }),
    [desktopCols]
  );

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'symbol' || key === 'type' || key === 'broker' || key === 'portfolio' ? 'asc' : 'desc');
    }
  };

  const active = useMemo(
    () => (portfolioHoldings || []).filter((h: any) => h.status === 'active' || !h.status),
    [portfolioHoldings]
  );

  // Book first — all filters below refresh from this slice only
  const bookScoped = useMemo(() => {
    if (portfolioFilter === 'All') return active;
    return active.filter((h: any) => String(h.portfolio_id || '') === portfolioFilter);
  }, [active, portfolioFilter]);

  const scoped = useMemo(() => {
    if (brokerFilter === 'All') return bookScoped;
    return bookScoped.filter((h: any) => String(h.broker) === brokerFilter);
  }, [bookScoped, brokerFilter]);

  // Type / market tiles: driven by book (and broker if selected)
  const classified = useMemo(() => {
    const map: Record<CategoryId, any[]> = {
      india_mf: [],
      india_stock: [],
      us_stock: [],
      au_stock: [],
      cfd: [],
      commodities: [],
      options: [],
      other: [],
    };
    scoped.forEach((h) => {
      map[classifyHolding(h)].push(h);
    });
    return map;
  }, [scoped]);

  const selectPortfolioBook = (id: string) => {
    setPortfolioFilter(id);
    setBrokerFilter('All');
    setCategoryFilter('All');
    setExpandedCategory(null);
    // Lots only makes sense on a single book — clear when returning to All books
    if (id === 'All' || id === '__pending__') setShowLotsOnly(false);
  };

  // Must be declared before the useEffect that depends on it — otherwise production
  // minification hits Temporal Dead Zone: "Cannot access 'ft' before initialization".
  const portfoliosPresent = useMemo(() => {
    // Hide books with no holdings and no broker connection — associate on CSV/add in classic Portfolio
    const holdingIds = new Set(active.map((h: any) => h.portfolio_id).filter(Boolean));
    const connIds = new Set(
      (portfolioBrokerConnections || []).map((c: any) => c.portfolio_id).filter(Boolean)
    );
    const seen = new Set<string>();
    return (portfolios || []).filter((p: any) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      const hasData = holdingIds.has(p.id) || connIds.has(p.id);
      return hasData;
    });
  }, [active, portfolios, portfolioBrokerConnections]);

  // If current book was emptied / hidden, return to All books
  React.useEffect(() => {
    if (portfolioFilter === 'All' || portfolioFilter === '__pending__') return;
    if (!portfoliosPresent.some((p: any) => p.id === portfolioFilter)) {
      setPortfolioFilter('All');
      setBrokerFilter('All');
      setCategoryFilter('All');
      setExpandedCategory(null);
    }
  }, [portfolioFilter, portfoliosPresent]);

  const categoryOrder: CategoryId[] = [
    'india_mf',
    'india_stock',
    'us_stock',
    'au_stock',
    'cfd',
    'commodities',
    'options',
    'other',
  ];

  const categoryCards = useMemo(() => {
    return categoryOrder
      .map((id) => {
        const holdings = classified[id];
        if (!holdings.length) return null;
        return { id, holdings, stats: summarizeBucket(holdings), meta: CATEGORY_META[id] };
      })
      .filter(Boolean) as {
      id: CategoryId;
      holdings: any[];
      stats: ReturnType<typeof summarizeBucket>;
      meta: (typeof CATEGORY_META)[CategoryId];
    }[];
  }, [classified]);

  const filtered = useMemo(() => {
    let list = scoped;
    if (categoryFilter !== 'All') list = list.filter((h) => classifyHolding(h) === categoryFilter);
    if (showLotsOnly) {
      list = list.filter((h) => stopsForHolding(h).length > 0 || (lotsByHoldingId.get(String(h.id)) || []).length > 0);
    }
    return list;
  }, [scoped, categoryFilter, showLotsOnly, lotsByHoldingId]);

  // Table rows: when Lots is on, expand one row per lot/position (repeat symbol).
  type TableRow = { h: any; lot?: any; stop?: number | null; lotQty?: number; dist?: number | null; rowKey: string };
  const tableRows = useMemo((): TableRow[] => {
    if (!showLotsOnly) {
      return filtered.map((h) => ({ h, rowKey: String(h.id) }));
    }
    const rows: TableRow[] = [];
    for (const h of filtered) {
      const lots = lotsByHoldingId.get(String(h.id)) || [];
      const lotRows = lots.filter((l) => l.stop_loss_rate != null || true);
      if (lotRows.length === 0) {
        rows.push({ h, rowKey: String(h.id) });
        continue;
      }
      for (const lot of lotRows) {
        const stop = lot.stop_loss_rate != null ? Number(lot.stop_loss_rate) : null;
        const live = Number(lot.current_price ?? h.live_price ?? h.current_price ?? lot.buy_price ?? h.buy_price) || 0;
        const dist = stop != null && live > 0 ? ((live - stop) / live) * 100 : null;
        rows.push({
          h,
          lot,
          stop,
          lotQty: Number(lot.quantity) || 0,
          dist,
          rowKey: `${h.id}-${lot.id || lot.external_position_id || Math.random()}`,
        });
      }
    }
    return rows;
  }, [filtered, showLotsOnly, lotsByHoldingId]);

  const sortedTableRows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const rows = tableRows.slice();
    const val = (r: TableRow) => {
      const h = r.h;
      const qty = r.lotQty ?? Number(h.quantity) || 0;
      const buy = r.lot ? Number(r.lot.buy_price) : Number(h.buy_price);
      const live = r.lot ? Number(r.lot.current_price ?? h.live_price ?? h.current_price ?? buy) : livePrice(h);
      switch (sortKey) {
        case 'symbol': return String(h.ticker || h.symbol || '');
        case 'type': return classifyHolding(h);
        case 'portfolio': return portfolioNameOf(h, portfolios);
        case 'broker': return String(h.broker || '');
        case 'qty': return qty;
        case 'buy': return buy;
        case 'live': return live;
        case 'day': return dayChangePct(h) ?? -999;
        case 'value': return live * qty;
        case 'pnl': {
          const inv = buy * qty;
          return inv > 0 ? ((live * qty - inv) / inv) * 100 : 0;
        }
        case 'pnl_amt': return live * qty - buy * qty;
        case 'stop': return r.stop ?? Number(h.stop_loss_rate) ?? -1;
        case 'lev': return Number(r.lot?.leverage ?? h.leverage) || 0;
        case 'currency': return String(h.currency || '');
        default: return live * qty;
      }
    };
    rows.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
    });
    return rows;
  }, [tableRows, sortKey, sortDir, portfolios]);

  // Broker chips follow the selected book only
  const brokersPresent = useMemo(() => {
    const s = new Set<string>();
    bookScoped.forEach((h: any) => h.broker && s.add(String(h.broker)));
    return Array.from(s).sort();
  }, [bookScoped]);

  // Lots chip only when a *specific* book is selected and that book has lot rows.
  // Hidden on "All books" per product rule.
  const hasLotsForSelectedBook = useMemo(() => {
    if (portfolioFilter === 'All' || portfolioFilter === '__pending__') return false;
    const ids = new Set(bookScoped.map((h: any) => String(h.id)));
    return (portfolioHoldingLots || []).some((l: any) => ids.has(String(l.holding_id)));
  }, [portfolioFilter, bookScoped, portfolioHoldingLots]);

  const ranked = useMemo(() => {
    const rows = filtered
      .map((h) => {
        if (moversMode === 'day') {
          const d = dayChangePct(h);
          if (d == null || !Number.isFinite(d)) return null;
          const mv = marketValue(h);
          return { h, p: d, dollar: (d / 100) * mv };
        }
        const p = pnlPct(h);
        if (!Number.isFinite(p)) return null;
        return { h, p, dollar: pnl(h) };
      })
      .filter(Boolean) as { h: any; p: number; dollar: number }[];
    return {
      gainers: [...rows].sort((a, b) => b.p - a.p).slice(0, 5),
      losers: [...rows].sort((a, b) => a.p - b.p).slice(0, 5),
    };
  }, [filtered, moversMode]);

  // Near-SL list is per *lot* (position), not per consolidated symbol —
  // Netflix with 5 different stops shows as 5 rows when each is within 8%.
  const tightStops = useMemo(() => {
    const rows: { h: any; dist: number; stop: number; qty: number; lotId?: string }[] = [];
    for (const h of filtered) {
      for (const s of stopsForHolding(h)) {
        if (s.dist < 8) rows.push({ h, dist: s.dist, stop: s.stop, qty: s.qty, lotId: s.lotId });
      }
    }
    return rows.sort((a, b) => a.dist - b.dist);
  }, [filtered, lotsByHoldingId]);

  const openConnect = () => {
    setConnectOpen(true);
    setConnectStep('pick');
    setSelectedBroker(null);
    setCredFields({});
    setConnectError(null);
    setConnectOk(null);
    setConnectPortfolioId(portfolios?.[0]?.id || '');
  };

  const saveConnection = async () => {
    if (!selectedBroker || !setPortfolioBrokerConnection) return;
    setConnectBusy(true);
    setConnectError(null);
    setConnectOk(null);
    try {
      const meta = BROKER_META[selectedBroker];
      const missing = meta.fields.filter((f) => f.key !== 'access_token' && !String(credFields[f.key] || '').trim());
      if (missing.length) {
        setConnectError(`Fill in: ${missing.map((m) => m.label).join(', ')}`);
        setConnectBusy(false);
        return;
      }
      const portfolioId = connectPortfolioId || undefined;
      const label =
        multiPortfolio && portfolioId
          ? `${meta.label} · ${portfolios.find((p: any) => p.id === portfolioId)?.name || ''}`.trim()
          : meta.label;

      if (selectedBroker === 'groww') {
        const resp = await fetch('/api/portfolio-groww-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'exchange',
            apiKey: credFields.api_key?.trim(),
            apiSecret: credFields.api_secret?.trim(),
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setConnectError(data.error || 'Groww validation failed');
          setConnectBusy(false);
          return;
        }
        await setPortfolioBrokerConnection(
          'groww',
          {
            api_key: credFields.api_key.trim(),
            api_secret: credFields.api_secret.trim(),
            access_token: data.accessToken || '',
          },
          portfolioId,
          label
        );
      } else {
        await setPortfolioBrokerConnection(selectedBroker, { ...credFields }, portfolioId, label);
      }
      setConnectOk(`${label} saved. Sync holdings from classic Portfolio for now.`);
      setConnectStep('pick');
      setSelectedBroker(null);
    } catch (e: any) {
      setConnectError(e?.message || 'Could not save connection');
    } finally {
      setConnectBusy(false);
    }
  };

  const toggleCategory = (id: CategoryId) => {
    if (categoryFilter === id && expandedCategory === id) {
      setCategoryFilter('All');
      setExpandedCategory(null);
    } else {
      setCategoryFilter(id);
      setExpandedCategory(id);
    }
  };

  return (
    <div className="w-full max-w-none px-3 sm:px-4 pt-2 sm:pt-3 pb-24 sm:pb-6 space-y-3 sm:space-y-4">
      {/* Hero */}
      <div className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 p-3 sm:p-4">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-indigo-400/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Briefcase className="w-5 h-5 text-indigo-500" />
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Portfolio
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                V1
              </span>
            </div>
            {workspaceName ? (
              <p className="text-[12px] text-slate-500 mt-1">{workspaceName}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={openConnect}
            disabled={isReadOnly}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect
          </button>
        </div>

        {isDataLoading && (
          <div className="relative mt-3 text-[11px] text-slate-400 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        )}

        {/* Portfolio + broker chips inside hero */}
        <div className="relative mt-4 space-y-2">
          {multiPortfolio && portfoliosPresent.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="shrink-0 text-[8px] font-black uppercase tracking-wider text-slate-400 w-14">
                Book
              </span>
              <button
                type="button"
                onClick={() => selectPortfolioBook('All')}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  portfolioFilter === 'All'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                    : 'bg-white/80 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                }`}
              >
                All books
              </button>
              {portfoliosPresent.map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPortfolioBook(p.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    portfolioFilter === p.id
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/80 dark:bg-slate-800 text-violet-600 border border-violet-200 dark:border-violet-900'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="shrink-0 text-[8px] font-black uppercase tracking-wider text-slate-400 w-14">
              Broker
            </span>
            <button
              type="button"
              onClick={() => setBrokerFilter('All')}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                brokerFilter === 'All'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                  : 'bg-white/80 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
              }`}
            >
              All
            </button>
            {brokersPresent.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setBrokerFilter(b);
                  setCategoryFilter('All');
                  setExpandedCategory(null);
                }}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  brokerFilter === b
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/80 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {b}
              </button>
            ))}
            {brokerFilter !== 'All' && (
              <button
                type="button"
                onClick={() => {
                  setBrokerFilter('All');
                  setCategoryFilter('All');
                  setExpandedCategory(null);
                }}
                className="shrink-0 px-2 py-1 text-[10px] font-bold text-indigo-600"
              >
                Clear broker
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category tiles — ultimate product map */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Markets & products</h2>
          {categoryFilter !== 'All' && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('All');
                setExpandedCategory(null);
              }}
              className="text-[10px] font-bold text-indigo-600"
            >
              Clear category
            </button>
          )}
        </div>
        <div
          className="grid gap-2.5"
          style={{
            gridTemplateColumns:
              categoryCards.length <= 1
                ? '1fr'
                : categoryCards.length === 2
                  ? 'repeat(2, minmax(0, 1fr))'
                  : categoryCards.length === 3
                    ? 'repeat(3, minmax(0, 1fr))'
                    : 'repeat(auto-fit, minmax(140px, 1fr))',
          }}
        >
          {categoryCards.map(({ id, holdings, stats, meta }) => {
            const selected = categoryFilter === id;
            const expanded = expandedCategory === id;
            const primary = stats.primary;
            return (
              <div
                key={id}
                className={`rounded-2xl border bg-gradient-to-br ${meta.accent} ${
                  selected
                    ? `border-transparent ring-2 ${meta.ring} shadow-md`
                    : 'border-slate-200/80 dark:border-slate-800'
                } bg-white dark:bg-slate-900 overflow-hidden transition-shadow`}
              >
                <button type="button" onClick={() => toggleCategory(id)} className="w-full text-left p-3 sm:p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className={`p-1.5 rounded-xl ${selected ? meta.chip : 'bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                      {meta.icon}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 tabular-nums">{stats.count}</span>
                  </div>
                  <p className="mt-2 text-[12px] font-black text-slate-900 dark:text-white leading-tight">{meta.label}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">{meta.blurb}</p>
                  {primary && (
                    <div className="mt-2 flex items-baseline justify-between gap-1">
                      <p className="text-[13px] sm:text-[15px] font-black tabular-nums text-slate-900 dark:text-white">
                        {money(primary.market, primary.currency)}
                      </p>
                      <p
                        className={`text-[10px] font-bold tabular-nums ${
                          primary.pnlPct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {pct(primary.pnlPct)}
                      </p>
                    </div>
                  )}
                  {stats.byCurrency.length > 1 && (
                    <p className="text-[9px] text-slate-400 mt-1">
                      +{stats.byCurrency.length - 1} more ccy
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-slate-400">
                    {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {expanded ? 'Hide' : 'Expand'}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-200/60 dark:border-slate-800 px-3 pb-3 pt-2 space-y-2 bg-white/50 dark:bg-slate-950/40">
                    {stats.byCurrency.map((c) => (
                      <div key={c.currency} className="flex justify-between text-[10px]">
                        <span className="font-bold text-slate-500">{c.currency}</span>
                        <span className="tabular-nums font-bold text-slate-800 dark:text-slate-100">
                          {money(c.market, c.currency)}
                          <span className={`ml-1.5 ${c.pnlPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {pct(c.pnlPct)}
                          </span>
                        </span>
                      </div>
                    ))}
                    <div className="pt-1 space-y-1 max-h-36 overflow-y-auto">
                      {holdings
                        .slice()
                        .sort((a, b) => marketValue(b) - marketValue(a))
                        .slice(0, 6)
                        .map((h) => (
                          <div key={h.id} className="flex justify-between gap-2 text-[10px]">
                            <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                              {h.ticker || h.symbol}
                            </span>
                            <span
                              className={`shrink-0 font-bold tabular-nums ${
                                pnlPct(h) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {pct(pnlPct(h))}
                            </span>
                          </div>
                        ))}
                      {holdings.length > 6 && (
                        <p className="text-[9px] text-slate-400">+{holdings.length - 6} more in list below</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {categoryCards.length === 0 && (
          <p className="text-[12px] text-slate-400 text-center py-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            No holdings for this portfolio / broker filter
          </p>
        )}
      </div>

      {/* Near SL */}
      {hasLotsForSelectedBook && tightStops.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/25 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Near stop loss · {tightStops.length}
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {tightStops.slice(0, 12).map(({ h, dist, stop, qty, lotId }) => (
              <div
                key={`${h.id}-${lotId || stop}`}
                className="shrink-0 rounded-xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/40 px-2.5 py-1.5 min-w-[8rem] max-w-[10rem]"
              >
                <p className="text-[11px] font-bold truncate">{h.ticker || h.symbol}</p>
                <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold truncate">
                  {portfolioNameOf(h, portfolios)}
                </p>
                <p className="text-[9px] text-slate-400">
                  SL {stop}
                  {qty > 0 ? ` · ${qty} qty` : ''}
                </p>
                <p className={`text-[11px] font-black ${dist < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                  {dist < 0 ? 'Past SL' : `${dist.toFixed(1)}% away`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gainers / losers */}
      <div className="space-y-2 w-full">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Movers</p>
          <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setMoversMode('overall')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                moversMode === 'overall'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Overall
            </button>
            <button
              type="button"
              onClick={() => setMoversMode('day')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                moversMode === 'day'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Day
            </button>
          </div>
          <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setMoversUnit('pct')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                moversUnit === 'pct'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => setMoversUnit('dollar')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                moversUnit === 'dollar'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              $
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {[
          { title: 'Top gainers', icon: <TrendingUp className="w-4 h-4 text-emerald-500" />, rows: ranked.gainers, good: true },
          { title: 'Top losers', icon: <TrendingDown className="w-4 h-4 text-rose-500" />, rows: ranked.losers, good: false },
        ].map((block) => (
          <div
            key={block.title}
            className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4"
          >
            <div className="flex items-center gap-1.5 mb-2">
              {block.icon}
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {block.title}
                <span className="ml-1.5 text-[9px] font-bold text-slate-400 normal-case tracking-normal">
                  {moversMode === 'day' ? 'today' : 'all time'}
                </span>
              </h3>
            </div>
            {block.rows.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-4 text-center">—</p>
            ) : (
              <ul className="space-y-1">
                {block.rows.map(({ h, p, dollar }) => (
                  <li key={h.id} className="flex justify-between gap-2 py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold truncate">{h.ticker || h.symbol}</p>
                      <p className="text-[9px] text-slate-400 truncate">
                        {CATEGORY_META[classifyHolding(h)].label}
                        {multiPortfolio ? ` · ${portfolioNameOf(h, portfolios)}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[12px] font-black tabular-nums ${block.good ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {moversUnit === 'pct' ? pct(p) : moneyPrecise(dollar, h.currency || baseCurrency)}
                      </p>
                      <p className="text-[9px] tabular-nums text-slate-400">
                        {moversUnit === 'pct' ? moneyPrecise(dollar, h.currency || baseCurrency) : pct(p)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      </div>

      {/* Holdings — type filters above table; connectors at bottom */}
      <div className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-3 sm:px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setHoldingsExpanded((v) => !v)}
              className="flex items-center gap-2 min-w-0"
            >
              <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Holdings · {showLotsOnly ? sortedTableRows.length : filtered.length}
              </h2>
              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${holdingsExpanded ? 'rotate-90' : ''}`} />
            </button>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setColsOpen((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Columns3 className="w-3.5 h-3.5" />
                Columns
              </button>
              {colsOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
                  <p className="text-[9px] font-black uppercase text-slate-400 px-2 py-1">Desktop columns</p>
                  {HOLDING_COLUMNS.map((c) => (
                    <label
                      key={c.key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-[11px] font-bold text-slate-700 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={colOn(c.key)}
                        onChange={() => toggleCol(c.key)}
                        className="rounded border-slate-300"
                      />
                      {c.label}
                      {c.desktopOnly && <span className="text-[8px] text-slate-400 font-bold">desk</span>}
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setVisibleCols(new Set(DEFAULT_COLS));
                      try {
                        localStorage.setItem('portfolio_v1_cols', JSON.stringify(Array.from(DEFAULT_COLS)));
                      } catch { /* ignore */ }
                    }}
                    className="w-full mt-1 text-[10px] font-bold text-indigo-600 py-1"
                  >
                    Reset defaults
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Filter by type — primary control above the table */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="shrink-0 text-[8px] font-black uppercase tracking-wider text-slate-400">Type</span>
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('All');
                setExpandedCategory(null);
              }}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                categoryFilter === 'All'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              All types
            </button>
            {categoryCards.map(({ id, stats, meta }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setCategoryFilter(id);
                  setExpandedCategory(id);
                }}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  categoryFilter === id ? meta.chip : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {meta.label} · {stats.count}
              </button>
            ))}
          </div>
            {hasLotsForSelectedBook && (
              <button
                type="button"
                onClick={() => setShowLotsOnly((v) => !v)}
                className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  showLotsOnly ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'
                }`}
              >
                <ShieldAlert className="w-3 h-3" /> Lots
              </button>
            )}
        </div>

        {holdingsExpanded && (
          <div className="max-h-[32rem] overflow-auto">
            {/* Desktop table — sortable; expands to per-lot rows when Lots is on */}
            <div className="hidden sm:block w-full overflow-x-auto">
              <div
                className="grid gap-x-2 px-4 py-2 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 min-w-full"
                style={desktopGridStyle}
              >
                {desktopCols.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className={`min-w-0 flex items-center gap-0.5 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer ${c.align === 'right' ? 'justify-end text-right' : 'justify-start text-left'}`}
                  >
                    {c.label}
                    {sortKey === c.key && <span className="text-indigo-500">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                ))}
              </div>
              {sortedTableRows.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-10">No rows for this filter</p>
              ) : (
                sortedTableRows.map((row) => {
                  const { h, lot, stop: lotStop, lotQty, dist: lotDist, rowKey } = row;
                  const qty = lotQty != null ? lotQty : Number(h.quantity) || 0;
                  const buy = lot ? Number(lot.buy_price) : Number(h.buy_price);
                  const live = lot
                    ? Number(lot.current_price ?? h.live_price ?? h.current_price ?? buy) || 0
                    : livePrice(h);
                  const inv = buy * qty;
                  const mv = live * qty;
                  const pAmt = mv - inv;
                  const pPct = inv > 0 ? (pAmt / inv) * 100 : 0;
                  const d = dayChangePct(h);
                  const lev = Number(lot?.leverage ?? h.leverage) || null;
                  const ccy = h.currency || baseCurrency;
                  const cat = classifyHolding(h);
                  const stopVal = lotStop != null ? lotStop : (h.stop_loss_rate != null ? Number(h.stop_loss_rate) : null);
                  const distVal = lotDist != null ? lotDist : stopLossDistancePct(h);

                  const cells: Record<string, React.ReactNode> = {
                    symbol: (
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate">{h.ticker || h.symbol}</p>
                        {lot && (
                          <p className="text-[9px] text-amber-600 font-bold truncate">
                            Lot{lot.external_position_id ? ` · ${String(lot.external_position_id).slice(-6)}` : ''}
                          </p>
                        )}
                      </div>
                    ),
                    type: (
                      <span className={`text-[8px] font-black px-1 py-0.5 rounded text-center inline-block ${CATEGORY_META[cat].chip}`}>
                        {CATEGORY_META[cat].label.split('·').pop()?.trim()}
                      </span>
                    ),
                    portfolio: (
                      <span className="text-slate-500 truncate text-[10px]">{portfolioNameOf(h, portfolios)}</span>
                    ),
                    broker: <span className="text-slate-500 truncate text-[10px]">{h.broker}</span>,
                    qty: (
                      <span className="tabular-nums text-slate-600">
                        {qty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    ),
                    buy: <span className="tabular-nums text-slate-600">{moneyPrecise(buy, ccy)}</span>,
                    live: <span className="tabular-nums font-bold text-slate-900 dark:text-white">{moneyPrecise(live, ccy)}</span>,
                    day: (
                      <span className={`tabular-nums font-bold ${d == null ? 'text-slate-300' : d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {d == null ? '—' : pct(d)}
                      </span>
                    ),
                    value: <span className="tabular-nums font-bold text-slate-900 dark:text-white">{moneyPrecise(mv, ccy)}</span>,
                    pnl: (
                      <span className={`tabular-nums font-bold ${pPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pct(pPct)}</span>
                    ),
                    pnl_amt: (
                      <span className={`tabular-nums font-bold ${pAmt >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {moneyPrecise(pAmt, ccy)}
                      </span>
                    ),
                    stop: (
                      stopVal != null ? (
                        <span className="tabular-nums text-slate-600">
                          {moneyPrecise(stopVal, ccy)}
                          {distVal != null && (
                            <span className={`block text-[9px] ${distVal < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                              {distVal < 0 ? 'past' : `${distVal.toFixed(1)}%`}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )
                    ),
                    lev: <span className="text-slate-500">{lev != null && lev > 1 ? `${lev}x` : '—'}</span>,
                    currency: <span className="text-slate-400 font-bold">{ccy}</span>,
                  };
                  return (
                    <div
                      key={rowKey}
                      className="grid gap-x-2 px-4 py-2.5 items-center border-b border-slate-50 dark:border-slate-800/80 text-[11px] min-w-full"
                      style={desktopGridStyle}
                    >
                      {desktopCols.map((c) => (
                        <div key={c.key} className={`min-w-0 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                          {cells[c.key]}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            {/* Mobile cards — fixed essential fields */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-10">No rows for this type filter</p>
              ) : (
                filtered
                  .slice()
                  .sort((a, b) => marketValue(b) - marketValue(a))
                  .map((h) => {
                    const p = pnlPct(h);
                    const d = dayChangePct(h);
                    const stop = h.stop_loss_rate != null ? Number(h.stop_loss_rate) : null;
                    const dist = stopLossDistancePct(h);
                    const ccy = h.currency || baseCurrency;
                    const cat = classifyHolding(h);
                    return (
                      <div key={h.id} className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13px] font-bold truncate">{h.ticker || h.symbol}</p>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${CATEGORY_META[cat].chip}`}>
                                {CATEGORY_META[cat].label.split('·').pop()?.trim()}
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-400 truncate">
                              {h.broker}
                              {multiPortfolio ? ` · ${portfolioNameOf(h, portfolios)}` : ''}
                              {' · '}
                              {Number(h.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} qty
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[13px] font-bold tabular-nums">{money(marketValue(h), ccy)}</p>
                            <p className={`text-[11px] font-black tabular-nums ${p >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {pct(p)}
                              {d != null ? ` · d ${pct(d)}` : ''}
                            </p>
                          </div>
                        </div>
                        {stop != null && stop > 0 && (
                          <p className="mt-1 text-[10px] font-bold text-amber-700">
                            SL {moneyPrecise(stop, ccy)}
                            {dist != null ? ` · ${dist < 0 ? 'past' : `${dist.toFixed(1)}% away`}` : ''}
                          </p>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Broker connections — below table, not as type filters */}
      {(portfolioBrokerConnections || []).length > 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-3 py-2">
          <p className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Connected brokers</p>
          <div className="flex flex-wrap gap-1.5">
            {(portfolioBrokerConnections || []).map((c: any) => {
              const pName = c.portfolio_id ? portfolios.find((p: any) => p.id === c.portfolio_id)?.name : null;
              return (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-50 dark:bg-slate-800/80 text-slate-500"
                >
                  <Link2 className="w-3 h-3" />
                  {c.connection_label || c.broker_type}
                  {pName ? ` · ${pName}` : ''}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Connect modal */}
      {connectOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-3xl">
              <h3 className="text-sm font-black">
                {connectStep === 'pick' ? 'Connect a broker' : BROKER_META[selectedBroker!]?.label}
              </h3>
              <button type="button" onClick={() => setConnectOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {connectOk && <div className="text-[11px] text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">{connectOk}</div>}
              {connectError && <div className="text-[11px] text-rose-700 bg-rose-50 rounded-xl px-3 py-2">{connectError}</div>}
              {connectStep === 'pick' && (
                <>
                  <p className="text-[11px] text-slate-500">
                    Link each connection to a portfolio — e.g. eToro → Sasi, second Webull → another book.
                  </p>
                  {multiPortfolio && (portfolios || []).length > 0 && (
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase text-slate-500">Portfolio</span>
                      <select
                        value={connectPortfolioId}
                        onChange={(e) => setConnectPortfolioId(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                      >
                        <option value="">None</option>
                        {(portfolios || []).map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(BROKER_META) as BrokerType[]).map((key) => {
                      const m = BROKER_META[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setSelectedBroker(key);
                            setCredFields({});
                            setConnectStep('creds');
                          }}
                          className={`text-left rounded-2xl border border-slate-200 dark:border-slate-700 p-3 hover:ring-2 ${m.ring} ${m.bg}`}
                        >
                          <p className={`text-[13px] font-black ${m.color}`}>{m.label}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">API keys</p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {connectStep === 'creds' && selectedBroker && (
                <>
                  <button type="button" onClick={() => { setConnectStep('pick'); setSelectedBroker(null); }} className="text-[10px] font-bold text-indigo-600">
                    ← Brokers
                  </button>
                  {BROKER_META[selectedBroker].fields.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-[10px] font-bold uppercase text-slate-500">{f.label}</span>
                      <input
                        type={f.secret ? 'password' : 'text'}
                        value={credFields[f.key] || ''}
                        onChange={(e) => setCredFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                        autoComplete="off"
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    disabled={connectBusy || isReadOnly}
                    onClick={saveConnection}
                    className="w-full py-2.5 rounded-2xl bg-indigo-600 text-white text-[12px] font-black disabled:opacity-50"
                  >
                    {connectBusy ? 'Saving…' : 'Save connection'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
