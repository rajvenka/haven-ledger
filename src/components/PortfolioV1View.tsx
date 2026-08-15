import PortfolioPnLCalendar from './PortfolioPnLCalendar';
import { parseBrokerFile, BrokerTemplate, downloadUniversalTemplate } from '../utils/brokerImport';
/**
 * Portfolio_V1 — ultimate summary-first redesign.
 * Classic PortfolioView remains the full-feature workbench.
 *
 * Category tiles: India MF · India Stocks · US Stocks · CFD · Commodities · Options
 * Each tile expands for sub-totals + top holdings. Portfolio chips keep Sasi/Raj separate.
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Briefcase,
  Plus,
  X,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
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
  Trash2,
  Upload,
  ExternalLink,
} from 'lucide-react';

type BrokerType = 'etoro' | 'ig' | 'webull' | 'zerodha' | 'groww' | 'moomoo' | 'tiger' | 'stake';

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
  workspaceCurrencyRates?: any[];
  setPortfolioBrokerConnection?: (
    brokerType: BrokerType,
    credentials: Record<string, string>,
    portfolioId?: string,
    connectionLabel?: string
  ) => Promise<void>;
  deletePortfolioBrokerConnection?: (id: string) => Promise<void>;
  markBrokerConnectionSynced?: (id: string) => Promise<void>;
  updatePortfolioHoldingLivePrice?: (id: string, price: number, previousClose?: number | null, priceSource?: string | null) => Promise<void>;
  snapshotPortfolioDailyPositions?: (currencies?: string[], timezone?: string) => Promise<void>;
  bulkAddPortfolioHoldings?: (holdings: any[], portfolioId?: string) => Promise<any>;
  loadPortfolioDailyPositions?: (fromDate: string, toDate: string, portfolioId?: string | null) => Promise<any[]>;
  markPriceLookupFailed?: (id: string) => Promise<void>;
  loadPortfolioDetails?: () => Promise<void>;
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
      { key: 'region', label: 'Region', placeholder: 'au / us / hk (default au)' },
      { key: 'connection_label', label: 'Connection name', placeholder: 'e.g. Webull-Sasi' },
    ],
  },
  moomoo: {
    label: 'Moomoo',
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    ring: 'ring-orange-500',
    fields: [
      { key: 'account_id', label: 'Account ID (optional)', placeholder: 'Moomoo account id' },
      { key: 'api_key', label: 'API Key (optional)', placeholder: 'For future live sync' },
      { key: 'connection_label', label: 'Connection name', placeholder: 'e.g. Moomoo-AU' },
    ],
  },
  tiger: {
    label: 'Tiger',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    ring: 'ring-amber-500',
    fields: [
      { key: 'account_id', label: 'Account ID (optional)', placeholder: 'Tiger account id' },
      { key: 'api_key', label: 'API Key (optional)', placeholder: 'For future live sync' },
      { key: 'connection_label', label: 'Connection name', placeholder: 'e.g. Tiger-AU' },
    ],
  },
  stake: {
    label: 'Stake',
    color: 'text-pink-600 dark:text-pink-400',
    bg: 'bg-pink-50 dark:bg-pink-950/40',
    ring: 'ring-pink-500',
    fields: [
      { key: 'connection_label', label: 'Connection name', placeholder: 'e.g. Stake-AU' },
    ],
  },
};

const COMMODITY_SYMBOLS = new Set([
  'GOLD', 'SILVER', 'OIL', 'NATGAS', 'COPPER', 'PLATINUM', 'PALLADIUM',
  'XAU', 'XAG', 'XAUUSD', 'XAGUSD', 'BRENT', 'WTI', 'GC=F', 'SI=F', 'CL=F',
]);

const CATEGORY_META: Record<
  CategoryId,
  { label: string; blurb: string; flag: string; shortLabel: string; icon: React.ReactNode; accent: string; chip: string; ring: string }
> = {
  india_mf: {
    label: 'India · MF',
    blurb: 'Mutual funds',
    flag: '🇮🇳',
    shortLabel: 'MF',
    icon: <Landmark className="w-4 h-4" />,
    accent: 'from-amber-500/15 to-orange-500/5',
    chip: 'bg-amber-500 text-white',
    ring: 'ring-amber-400',
  },
  india_stock: {
    label: 'India · Stocks',
    blurb: 'NSE / BSE equity',
    flag: '🇮🇳',
    shortLabel: 'Stocks',
    icon: <ChartLine className="w-4 h-4" />,
    accent: 'from-blue-500/15 to-indigo-500/5',
    chip: 'bg-blue-600 text-white',
    ring: 'ring-blue-400',
  },
  us_stock: {
    label: 'US · Stocks',
    blurb: 'USD equities',
    flag: '🇺🇸',
    shortLabel: 'Stocks',
    icon: <Globe className="w-4 h-4" />,
    accent: 'from-violet-500/15 to-fuchsia-500/5',
    chip: 'bg-violet-600 text-white',
    ring: 'ring-violet-400',
  },
  au_stock: {
    label: 'AU · Stocks',
    blurb: 'ASX / AUD',
    flag: '🇦🇺',
    shortLabel: 'Stocks',
    icon: <Globe className="w-4 h-4" />,
    accent: 'from-sky-500/15 to-cyan-500/5',
    chip: 'bg-sky-600 text-white',
    ring: 'ring-sky-400',
  },
  cfd: {
    label: 'CFDs',
    blurb: 'Leveraged eToro',
    flag: '',
    shortLabel: 'CFDs',
    icon: <ChartCandlestick className="w-4 h-4" />,
    accent: 'from-teal-500/15 to-emerald-500/5',
    chip: 'bg-teal-600 text-white',
    ring: 'ring-teal-400',
  },
  commodities: {
    label: 'Commodities',
    blurb: 'Gold, oil, metals',
    flag: '',
    shortLabel: 'Commodities',
    icon: <Fuel className="w-4 h-4" />,
    accent: 'from-yellow-500/20 to-amber-600/5',
    chip: 'bg-yellow-600 text-white',
    ring: 'ring-yellow-400',
  },
  options: {
    label: 'Options',
    blurb: 'Contracts ×100',
    flag: '',
    shortLabel: 'Options',
    icon: <Sparkles className="w-4 h-4" />,
    accent: 'from-rose-500/15 to-pink-500/5',
    chip: 'bg-rose-600 text-white',
    ring: 'ring-rose-400',
  },
  other: {
    label: 'Other',
    blurb: 'Unclassified',
    flag: '',
    shortLabel: 'Other',
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
  { key: 'day_amt', label: 'Day $', defaultOn: true },
  { key: 'value', label: 'Value', defaultOn: true },
  { key: 'pnl', label: 'P&L %', defaultOn: true },
  { key: 'pnl_amt', label: 'P&L $', defaultOn: true },
  { key: 'stop', label: 'Stop loss', defaultOn: true, desktopOnly: true },
  { key: 'lev', label: 'Lev', defaultOn: true, desktopOnly: true },
  { key: 'currency', label: 'Ccy', defaultOn: false, desktopOnly: true },
];

const DEFAULT_COLS = new Set(HOLDING_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key));
const DEFAULT_COL_ORDER = HOLDING_COLUMNS.map((c) => c.key);
const COL_LAYOUT: Record<string, { label: string; align: 'left' | 'right'; fr: string }> = {
  type: { label: 'Type', align: 'left', fr: 'minmax(3rem, 0.8fr)' },
  portfolio: { label: 'Portfolio', align: 'left', fr: 'minmax(3.5rem, 0.9fr)' },
  broker: { label: 'Broker', align: 'left', fr: 'minmax(3rem, 0.8fr)' },
  qty: { label: 'Qty', align: 'right', fr: 'minmax(2.5rem, 0.7fr)' },
  buy: { label: 'Buy', align: 'right', fr: 'minmax(3rem, 0.8fr)' },
  live: { label: 'Live', align: 'right', fr: 'minmax(3rem, 0.8fr)' },
  day: { label: 'Day', align: 'right', fr: 'minmax(2.5rem, 0.7fr)' },
  day_amt: { label: 'Day $', align: 'right', fr: 'minmax(3rem, 0.8fr)' },
  value: { label: 'Value', align: 'right', fr: 'minmax(3.5rem, 1fr)' },
  pnl: { label: 'P&L%', align: 'right', fr: 'minmax(2.5rem, 0.7fr)' },
  pnl_amt: { label: 'P&L$', align: 'right', fr: 'minmax(3rem, 0.8fr)' },
  stop: { label: 'Stop', align: 'right', fr: 'minmax(3rem, 0.85fr)' },
  lev: { label: 'Lev', align: 'right', fr: 'minmax(2rem, 0.5fr)' },
  currency: { label: 'Ccy', align: 'right', fr: 'minmax(2rem, 0.5fr)' },
};

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

/** Convert amount from `fromCcy` into workspace base, then into `toCcy`. rate_to_base = 1 unit of that ccy in base. */
function convertAmount(
  amount: number,
  fromCcy: string,
  toCcy: string,
  rates: any[],
  base: string
): number {
  if (!Number.isFinite(amount)) return 0;
  const from = String(fromCcy || base || 'USD').toUpperCase();
  const to = String(toCcy || base || 'USD').toUpperCase();
  const baseCcy = String(base || 'INR').toUpperCase();
  if (from === to) return amount;
  const rateOf = (ccy: string) => {
    if (ccy === baseCcy) return 1;
    const r = rates.find((x: any) => String(x.currency || '').toUpperCase() === ccy);
    const v = Number(r?.rate_to_base);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const fromRate = rateOf(from);
  const toRate = rateOf(to);
  if (fromRate == null || toRate == null) return amount; // no rate → leave native
  const inBase = amount * fromRate;
  return inBase / toRate;
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
  if (!Number.isFinite(live) || !Number.isFinite(prev) || prev <= 0 || live <= 0) return null;
  // Yahoo maps GOLD/SILVER to ~$40 equities; eToro spot is thousands. That scale mismatch
  // produces absurd Day % (e.g. +10,000%). Only trust previous_close when same order of magnitude.
  const ratio = live / prev;
  if (ratio > 20 || ratio < 1 / 20) return null;
  return ((live - prev) / prev) * 100;
}
function dayChangeDollar(h: any): number | null {
  const live = Number(h.live_price);
  const prev = Number(h.previous_close);
  const qty = Number(h.quantity || 0);
  if (!Number.isFinite(live) || !Number.isFinite(prev) || !Number.isFinite(qty) || prev <= 0 || live <= 0) return null;
  const ratio = live / prev;
  if (ratio > 20 || ratio < 1 / 20) return null;
  return (live - prev) * qty;
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
  const byCcy: Record<
    string,
    {
      market: number;
      invested: number;
      pnl: number;
      gainPnl: number;
      lossPnl: number;
      gainCount: number;
      lossCount: number;
      dayGainPnl: number;
      dayLossPnl: number;
      dayGainCount: number;
      dayLossCount: number;
      dayPnl: number;
      dayBase: number;
      count: number;
      dayCount: number;
    }
  > = {};
  holdings.forEach((h) => {
    const ccy = String(h.currency || 'USD').toUpperCase();
    if (!byCcy[ccy]) {
      byCcy[ccy] = {
        market: 0,
        invested: 0,
        pnl: 0,
        gainPnl: 0,
        lossPnl: 0,
        gainCount: 0,
        lossCount: 0,
        dayGainPnl: 0,
        dayLossPnl: 0,
        dayGainCount: 0,
        dayLossCount: 0,
        dayPnl: 0,
        dayBase: 0,
        count: 0,
        dayCount: 0,
      };
    }
    const inv = invested(h);
    const mv = marketValue(h);
    const posPnl = mv - inv;
    byCcy[ccy].market += mv;
    byCcy[ccy].invested += inv;
    byCcy[ccy].pnl += posPnl;
    byCcy[ccy].count += 1;
    if (posPnl > 0) {
      byCcy[ccy].gainPnl += posPnl;
      byCcy[ccy].gainCount += 1;
    } else if (posPnl < 0) {
      byCcy[ccy].lossPnl += posPnl;
      byCcy[ccy].lossCount += 1;
    }
    const dd = dayChangeDollar(h);
    if (dd != null) {
      byCcy[ccy].dayPnl += dd;
      if (dd > 0) {
        byCcy[ccy].dayGainPnl += dd;
        byCcy[ccy].dayGainCount += 1;
      } else if (dd < 0) {
        byCcy[ccy].dayLossPnl += dd;
        byCcy[ccy].dayLossCount += 1;
      }
      const prev = Number(h.previous_close);
      const qty = Number(h.quantity || 0);
      if (Number.isFinite(prev) && Number.isFinite(qty)) byCcy[ccy].dayBase += prev * qty;
      byCcy[ccy].dayCount += 1;
    }
  });
  const tiles = Object.entries(byCcy)
    .map(([currency, v]) => ({
      currency,
      ...v,
      pnlPct: v.invested > 0 ? (v.pnl / v.invested) * 100 : 0,
      dayPct: v.dayBase > 0 ? (v.dayPnl / v.dayBase) * 100 : null,
    }))
    .sort((a, b) => b.market - a.market);
  return {
    count: holdings.length,
    byCurrency: tiles,
    primary: tiles[0] || null,
    gainPnl: tiles.reduce((s, x) => s + x.gainPnl, 0),
    lossPnl: tiles.reduce((s, x) => s + x.lossPnl, 0),
    gainCount: tiles.reduce((s, x) => s + x.gainCount, 0),
    lossCount: tiles.reduce((s, x) => s + x.lossCount, 0),
  };
}


/** Desktop-friendly metric carousel: click dots or arrows; swipe still works. */
function TileMetricScroller({
  slides,
}: {
  slides: { key: string; node: React.ReactNode }[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const go = (i: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, i));
    const el = scrollerRef.current;
    if (el) {
      const w = el.clientWidth || 1;
      el.scrollTo({ left: next * w, behavior: 'smooth' });
    }
    setIdx(next);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth || 1;
      setIdx(Math.round(el.scrollLeft / w));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="relative">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(idx - 1);
          }}
          disabled={idx <= 0}
          className="hidden sm:inline-flex shrink-0 p-1 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Previous metric"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
        </button>
        <div
          ref={scrollerRef}
          className="flex-1 min-w-0 flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        >
          {slides.map((s) => (
            <div key={s.key} className="min-w-full snap-center shrink-0">
              {s.node}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(idx + 1);
          }}
          disabled={idx >= slides.length - 1}
          className="hidden sm:inline-flex shrink-0 p-1 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Next metric"
        >
          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
      <div className="flex justify-center gap-1.5 mt-1.5">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(i);
            }}
            aria-label={s.key}
            aria-current={i === idx ? 'true' : undefined}
            className={`h-1.5 rounded-full transition-all ${
              i === idx
                ? 'w-3 bg-slate-500 dark:bg-slate-300'
                : 'w-1.5 bg-slate-300/80 dark:bg-slate-600 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
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
  workspaceCurrencyRates = [],
  setPortfolioBrokerConnection,
  deletePortfolioBrokerConnection,
  markBrokerConnectionSynced,
  updatePortfolioHoldingLivePrice,
  markPriceLookupFailed,
  loadPortfolioDetails,
  snapshotPortfolioDailyPositions,
  loadPortfolioDailyPositions,
  bulkAddPortfolioHoldings,
}: Props) {
  const [portfolioFilter, setPortfolioFilter] = useState<string>('__pending__');
  const [brokerFilter, setBrokerFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'All'>('All');
  // Desktop-only "balanced rows" for the Markets & Products tile grid - plain CSS
  // auto-fit packs greedily left-to-right (e.g. 9 tiles -> 8 in row 1, 1 orphaned alone in
  // row 2), which looks broken. Tracking viewport width lets the grid switch to an explicit
  // column count on wide screens, computed to keep rows as even as possible (9 tiles -> 5+4)
  // instead of relying on however many happen to fit at 140px each. Mobile/narrow screens
  // keep the original auto-fit behavior untouched.
  const [isWideDesktop, setIsWideDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  useEffect(() => {
    const onResize = () => setIsWideDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [expandedCategory, setExpandedCategory] = useState<CategoryId | null>(null);
  const [holdingsExpanded, setHoldingsExpanded] = useState(true);
  const [showLotsOnly, setShowLotsOnly] = useState(false);
  const [moversMode, setMoversMode] = useState<'overall' | 'day'>('day');
  const [moversUnit, setMoversUnit] = useState<'pct' | 'dollar'>('dollar');
  const [showPnlCalendar, setShowPnlCalendar] = useState(false);
  const [pnlCalendarRows, setPnlCalendarRows] = useState<any[]>([]);
  const [pnlCalendarLoading, setPnlCalendarLoading] = useState(false);
  const [pnlCalendarCcy, setPnlCalendarCcy] = useState<string>(String(baseCurrency || 'INR').toUpperCase());
  const [pnlCalendarPortfolioId, setPnlCalendarPortfolioId] = useState<string>('all');

  const viewCurrencyStorageKey = `portfolio_v1_view_ccy:${workspaceName || 'default'}`;
  const [viewCurrency, setViewCurrency] = useState<string>(() => {
    try {
      const last = localStorage.getItem(viewCurrencyStorageKey);
      if (last) return last.toUpperCase();
    } catch { /* ignore */ }
    return String(baseCurrency || 'INR').toUpperCase();
  });
  const [sortKey, setSortKey] = useState<string>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [colsOpen, setColsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('portfolio_v1_cols');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) {
          const s = new Set(arr as string[]);
          // Ensure $ P&L is available next to % (was off by default historically)
          if (s.has('pnl') && !s.has('pnl_amt')) s.add('pnl_amt');
          return s;
        }
      }
    } catch { /* ignore */ }
    return new Set(DEFAULT_COLS);
  });
  const [colOrder, setColOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('portfolio_v1_col_order');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) {
          const known = new Set(DEFAULT_COL_ORDER);
          const cleaned = (arr as string[]).filter((k) => known.has(k));
          for (const k of DEFAULT_COL_ORDER) {
            if (!cleaned.includes(k)) cleaned.push(k);
          }
          return cleaned;
        }
      }
    } catch { /* ignore */ }
    return [...DEFAULT_COL_ORDER];
  });
  const persistColOrder = (order: string[]) => {
    try {
      localStorage.setItem('portfolio_v1_col_order', JSON.stringify(order));
    } catch { /* ignore */ }
  };
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
  const moveCol = (key: string, dir: -1 | 1) => {
    setColOrder((prev) => {
      const i = prev.indexOf(key);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      persistColOrder(next);
      return next;
    });
  };
  const resetColLayout = () => {
    setVisibleCols(new Set(DEFAULT_COLS));
    setColOrder([...DEFAULT_COL_ORDER]);
    try {
      localStorage.setItem('portfolio_v1_cols', JSON.stringify(Array.from(DEFAULT_COLS)));
      localStorage.setItem('portfolio_v1_col_order', JSON.stringify(DEFAULT_COL_ORDER));
    } catch { /* ignore */ }
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
  const [syncingId, setSyncingId] = useState<string | null>(null);
  // Zerodha (Kite Connect) and Groww both use daily-expiring access tokens by design - not a
  // bug, this is how their APIs work. Rather than let Sync attempt a call known to fail with
  // yesterday's token, check the connection's own updated_at (set fresh every time Connect
  // saves credentials) against today's date. Used both to gate syncConnection itself and to
  // visually mark the Sync button as needing re-authorization before the click even happens.
  const needsReauth = (c: any) => {
    const type = String(c?.broker_type || '').toLowerCase();
    if (type !== 'zerodha' && type !== 'groww') return false;
    if (!c?.updated_at) return true;
    const d = new Date(c.updated_at);
    const now = new Date();
    return !(d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate());
  };
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [priceRefreshSummary, setPriceRefreshSummary] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [importTemplate, setImportTemplate] = useState<BrokerTemplate>('universal');
  const [importPortfolioId, setImportPortfolioId] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);


  const multiPortfolio = portfolioMode === 'multiple' || (portfolios || []).length > 1;

  const pickViewCurrency = (ccy: string) => {
    const next = String(ccy || baseCurrency || 'INR').toUpperCase();
    setViewCurrency(next);
    try {
      localStorage.setItem(viewCurrencyStorageKey, next);
    } catch { /* ignore */ }
  };

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


  // Desktop table columns — visibility + user order (persisted).
  const desktopCols = useMemo(() => {
    const cols: { key: string; label: string; align: 'left' | 'right'; fr: string }[] = [
      { key: 'symbol', label: 'Symbol', align: 'left', fr: 'minmax(6rem, 1.4fr)' },
    ];
    for (const key of colOrder) {
      if (!colOn(key)) continue;
      if (key === 'portfolio' && !multiPortfolio) continue;
      const layout = COL_LAYOUT[key];
      if (!layout) continue;
      cols.push({ key, ...layout });
    }
    return cols;
  }, [visibleCols, colOrder, multiPortfolio]);

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

  /** Connections linked to the currently selected book (empty on All books). */
  const bookConnections = useMemo(() => {
    if (portfolioFilter === 'All' || portfolioFilter === '__pending__') return [];
    const book = (portfolios || []).find((p: any) => String(p.id) === String(portfolioFilter));
    const bookName = String(book?.name || '').trim().toLowerCase();
    return (portfolioBrokerConnections || []).filter((c: any) => {
      if (String(c.portfolio_id || '') === String(portfolioFilter)) return true;
      // Fallback: label matches book name (legacy rows with null portfolio_id)
      const label = String(c.connection_label || '').trim().toLowerCase();
      if (bookName && label && (label === bookName || label.replace(/\s+/g, '') === bookName.replace(/\s+/g, ''))) return true;
      return false;
    });
  }, [portfolioBrokerConnections, portfolioFilter, portfolios]);

  // Prefer workspace default portfolio over "All" on first load / when pending.
  useEffect(() => {
    if (portfolioFilter !== '__pending__' && portfolioFilter !== 'All') return;
    // Only auto-pick default when we are still on the initial pending state, or
    // when user has not chosen a book yet and a default exists.
    if (portfolioFilter === 'All' && portfoliosPresent.length === 0) return;
    const defaultId =
      (portfolios || []).find((p: any) => p.is_default)?.id ||
      portfoliosPresent[0]?.id ||
      (portfolios || [])[0]?.id ||
      null;
    if (portfolioFilter === '__pending__') {
      if (defaultId) setPortfolioFilter(String(defaultId));
      else setPortfolioFilter('All');
      return;
    }
  }, [portfolioFilter, portfolios, portfoliosPresent]);

  // If current book was emptied / hidden, fall back to default (else All).
  useEffect(() => {
    if (portfolioFilter === 'All' || portfolioFilter === '__pending__') return;
    if (!portfoliosPresent.some((p: any) => p.id === portfolioFilter)) {
      const defaultId =
        (portfolios || []).find((p: any) => p.is_default)?.id ||
        portfoliosPresent[0]?.id ||
        null;
      setPortfolioFilter(defaultId ? String(defaultId) : 'All');
      setBrokerFilter('All');
      setCategoryFilter('All');
      setExpandedCategory(null);
    }
  }, [portfolioFilter, portfoliosPresent, portfolios]);


  // When a specific book is selected, align View currency with that book's currency
  // so Movers $ amounts match the INR/AUD/USD book (not a leftover USD view chip).
  useEffect(() => {
    if (portfolioFilter === 'All' || portfolioFilter === '__pending__') return;
    const book = (portfolios || []).find((p: any) => String(p.id) === String(portfolioFilter));
    const ccy = String(book?.currency || '').toUpperCase();
    if (ccy && ccy !== viewCurrency) {
      setViewCurrency(ccy);
      try { localStorage.setItem(viewCurrencyStorageKey, ccy); } catch { /* ignore */ }
    }
  }, [portfolioFilter, portfolios]);

  // Re-sync View currency when the workspace itself changes - the effect above only fires
  // on portfolioFilter changes, so switching workspaces while staying on the "All" filter
  // (e.g. from a USD-heavy workspace to an INR-only one like KUMAR-RAJ) would otherwise
  // leave viewCurrency stuck on whatever was last selected, showing USD in a purely-INR
  // workspace with no actual USD holdings anywhere in it.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(viewCurrencyStorageKey);
      setViewCurrency(stored ? stored.toUpperCase() : String(baseCurrency || 'INR').toUpperCase());
    } catch {
      setViewCurrency(String(baseCurrency || 'INR').toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceName]);

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

  /** Total portfolio value in default book currency (or View currency when All books). */
  const totalPortfolioTile = useMemo(() => {
    const book =
      portfolioFilter !== 'All' && portfolioFilter !== '__pending__'
        ? (portfolios || []).find((p: any) => String(p.id) === String(portfolioFilter))
        : (portfolios || []).find((p: any) => p.is_default) || (portfolios || [])[0];
    const displayCcy = String(
      (portfolioFilter !== 'All' && portfolioFilter !== '__pending__'
        ? book?.currency
        : viewCurrency || book?.currency || baseCurrency) ||
        baseCurrency ||
        'USD'
    ).toUpperCase();

    let market = 0;
    let inv = 0;
    let dayPnl = 0;
    let dayBase = 0;
    let dayCount = 0;
    let gainPnl = 0;
    let lossPnl = 0;
    let gainCount = 0;
    let lossCount = 0;
    let dayGainPnl = 0;
    let dayLossPnl = 0;
    let dayGainCount = 0;
    let dayLossCount = 0;
    for (const h of scoped) {
      const nativeCcy = String(h.currency || displayCcy).toUpperCase();
      const mvN = marketValue(h);
      const invN = invested(h);
      const posPnlN = mvN - invN;
      market += convertAmount(mvN, nativeCcy, displayCcy, workspaceCurrencyRates, baseCurrency);
      inv += convertAmount(invN, nativeCcy, displayCcy, workspaceCurrencyRates, baseCurrency);
      const posFx = convertAmount(posPnlN, nativeCcy, displayCcy, workspaceCurrencyRates, baseCurrency);
      if (posPnlN > 0) {
        gainPnl += posFx;
        gainCount += 1;
      } else if (posPnlN < 0) {
        lossPnl += posFx;
        lossCount += 1;
      }
      const dd = dayChangeDollar(h);
      if (dd != null) {
        const ddFx = convertAmount(dd, nativeCcy, displayCcy, workspaceCurrencyRates, baseCurrency);
        dayPnl += ddFx;
        if (dd > 0) {
          dayGainPnl += ddFx;
          dayGainCount += 1;
        } else if (dd < 0) {
          dayLossPnl += ddFx;
          dayLossCount += 1;
        }
        const prev = Number(h.previous_close);
        const qty = Number(h.quantity || 0);
        if (Number.isFinite(prev) && Number.isFinite(qty)) {
          dayBase += convertAmount(prev * qty, nativeCcy, displayCcy, workspaceCurrencyRates, baseCurrency);
        }
        dayCount += 1;
      }
    }
    const pnlAmt = market - inv;
    const pnlPctVal = inv > 0 ? (pnlAmt / inv) * 100 : 0;
    const dayPctVal = dayBase > 0 ? (dayPnl / dayBase) * 100 : null;
    return {
      displayCcy,
      market,
      invested: inv,
      pnlAmt,
      pnlPct: pnlPctVal,
      dayPnl,
      dayPct: dayPctVal,
      dayBase,
      dayCount,
      count: scoped.length,
      gainPnl,
      lossPnl,
      gainCount,
      lossCount,
      dayGainPnl,
      dayLossPnl,
      dayGainCount,
      dayLossCount,
    };
  }, [scoped, portfolioFilter, portfolios, viewCurrency, workspaceCurrencyRates, baseCurrency]);

  /** Card / total performance line respects global Day|$ filters. */
  const perfLabel = moversMode === 'day' ? 'today' : 'all time';
  const formatBucketPerf = (primary: { pnl: number; pnlPct: number; dayPnl: number; dayPct: number | null; currency: string } | null) => {
    if (!primary) return { text: '—', positive: true };
    if (moversMode === 'day') {
      if (primary.dayPct == null && !(primary.dayPnl || primary.dayCount)) {
        return { text: '—', positive: true };
      }
      if (moversUnit === 'dollar') {
        const v = primary.dayPnl || 0;
        return { text: moneyPrecise(v, primary.currency), positive: v >= 0 };
      }
      const v = primary.dayPct;
      if (v == null) return { text: '—', positive: true };
      return { text: pct(v), positive: v >= 0 };
    }
    if (moversUnit === 'dollar') {
      return { text: moneyPrecise(primary.pnl, primary.currency), positive: primary.pnl >= 0 };
    }
    return { text: pct(primary.pnlPct), positive: primary.pnlPct >= 0 };
  };
  const formatTotalPerf = () => {
    if (moversMode === 'day') {
      if (totalPortfolioTile.dayCount === 0) return { text: '—', positive: true };
      if (moversUnit === 'dollar') {
        const v = totalPortfolioTile.dayPnl;
        return { text: moneyPrecise(v, totalPortfolioTile.displayCcy), positive: v >= 0 };
      }
      const v = totalPortfolioTile.dayPct;
      if (v == null) return { text: '—', positive: true };
      return { text: pct(v), positive: v >= 0 };
    }
    if (moversUnit === 'dollar') {
      const v = totalPortfolioTile.pnlAmt;
      return { text: moneyPrecise(v, totalPortfolioTile.displayCcy), positive: v >= 0 };
    }
    return { text: pct(totalPortfolioTile.pnlPct), positive: totalPortfolioTile.pnlPct >= 0 };
  };
  /** Profit / Loss tile slides follow Day|Overall and $|% filters. */
  const formatTileSide = (
    gainAmt: number,
    lossAmt: number,
    gainCount: number,
    lossCount: number,
    investedBase: number,
    dayBase: number,
    currency: string,
  ) => {
    const useDay = moversMode === 'day';
    const base = useDay ? dayBase : investedBase;
    const g = Number(gainAmt) || 0;
    const l = Number(lossAmt) || 0;
    const gainPct = base > 0 ? (g / base) * 100 : null;
    const lossPct = base > 0 ? (l / base) * 100 : null;
    const suffix = useDay ? ' · today' : '';
    if (moversUnit === 'pct') {
      return {
        gainText: gainPct == null ? '—' : pct(gainPct),
        lossText: lossPct == null ? '—' : pct(Math.abs(lossPct)),
        gainLabel: `Profit · ${gainCount || 0} up${suffix}`,
        lossLabel: `Loss · ${lossCount || 0} down${suffix}`,
      };
    }
    return {
      gainText: money(g, currency),
      lossText: money(Math.abs(l), currency),
      gainLabel: `Profit · ${gainCount || 0} up${suffix}`,
      lossLabel: `Loss · ${lossCount || 0} down${suffix}`,
    };
  };

  const formatHoldingPerf = (h: any) => {
    if (moversMode === 'day') {
      if (moversUnit === 'dollar') {
        const v = dayChangeDollar(h);
        if (v == null) return { text: '—', positive: true };
        return { text: moneyPrecise(v, String(h.currency || 'USD').toUpperCase()), positive: v >= 0 };
      }
      const v = dayChangePct(h);
      if (v == null) return { text: '—', positive: true };
      return { text: pct(v), positive: v >= 0 };
    }
    if (moversUnit === 'dollar') {
      const v = pnl(h);
      return { text: moneyPrecise(v, String(h.currency || 'USD').toUpperCase()), positive: v >= 0 };
    }
    return { text: pct(pnlPct(h)), positive: pnlPct(h) >= 0 };
  };



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
      if (lots.length > 0) {
        // One table row per position/lot (e.g. Netflix ×5)
        lots.forEach((lot: any, idx: number) => {
          const stop = lot.stop_loss_rate != null ? Number(lot.stop_loss_rate) : null;
          const live = Number(lot.current_price ?? h.live_price ?? h.current_price ?? lot.buy_price ?? h.buy_price) || 0;
          const dist = stop != null && live > 0 ? ((live - stop) / live) * 100 : null;
          rows.push({
            h,
            lot,
            stop,
            lotQty: Number(lot.quantity) || 0,
            dist,
            rowKey: `${h.id}-lot-${lot.id || lot.external_position_id || idx}`,
          });
        });
      } else {
        // No lot rows in DB — still surface master stop if present
        const stops = stopsForHolding(h);
        if (stops.length > 1) {
          stops.forEach((s, idx) => {
            rows.push({
              h,
              stop: s.stop,
              lotQty: s.qty,
              dist: s.dist,
              rowKey: `${h.id}-stop-${idx}`,
            });
          });
        } else {
          rows.push({ h, rowKey: String(h.id) });
        }
      }
    }
    return rows;
  }, [filtered, showLotsOnly, lotsByHoldingId]);

  const sortedTableRows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const rows = tableRows.slice();
    const val = (r: TableRow) => {
      const h = r.h;
      const qty = (r.lotQty ?? Number(h.quantity)) || 0;
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
        case 'day_amt': {
          const prevClose = Number(h.previous_close);
          return Number.isFinite(prevClose) && prevClose > 0 ? (live - prevClose) * qty : -999999;
        }
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

  // Lots chip only when a *specific* book is selected (hidden on All books).
  // Show if that book has lot rows, eToro positions, or any stop-loss — so the control
  // is visible even before lots finish loading / after a partial sync.
  const hasLotsForSelectedBook = useMemo(() => {
    if (portfolioFilter === 'All' || portfolioFilter === '__pending__') return false;
    if (bookScoped.length === 0) return false;
    const ids = new Set(bookScoped.map((h: any) => String(h.id)));
    const hasLotRows = (portfolioHoldingLots || []).some((l: any) => ids.has(String(l.holding_id)));
    if (hasLotRows) return true;
    return bookScoped.some((h: any) => {
      const broker = String(h.broker || '').toLowerCase();
      return broker === 'etoro' || (h.stop_loss_rate != null && Number(h.stop_loss_rate) > 0);
    });
  }, [portfolioFilter, bookScoped, portfolioHoldingLots]);

  const currenciesPresent = useMemo(() => {
    const s = new Set<string>();
    active.forEach((h: any) => {
      const c = String(h.currency || '').toUpperCase();
      if (c) s.add(c);
    });
    const base = String(baseCurrency || 'INR').toUpperCase();
    if (base) s.add(base);
    return Array.from(s).sort();
  }, [active, baseCurrency]);

  const ranked = useMemo(() => {
    const rows = filtered
      .map((h) => {
        const nativeCcy = String(h.currency || baseCurrency || 'USD').toUpperCase();
        // Prefer selected book currency (e.g. INR portfolio → INR $ moves),
        // not a stale View chip like USD. Matches Total portfolio tile.
        const moversCcy = totalPortfolioTile.displayCcy || viewCurrency || nativeCcy;
        if (moversMode === 'day') {
          const d = dayChangePct(h);
          if (d == null || !Number.isFinite(d)) return null;
          const mv = marketValue(h);
          const nativeDollar = (d / 100) * mv;
          const dollar = convertAmount(nativeDollar, nativeCcy, moversCcy, workspaceCurrencyRates, baseCurrency);
          return { h, p: d, dollar, displayCcy: moversCcy };
        }
        const p = pnlPct(h);
        if (!Number.isFinite(p)) return null;
        const nativeDollar = pnl(h);
        const dollar = convertAmount(nativeDollar, nativeCcy, moversCcy, workspaceCurrencyRates, baseCurrency);
        return { h, p, dollar, displayCcy: moversCcy };
      })
      .filter(Boolean) as { h: any; p: number; dollar: number; displayCcy: string }[];
    // $ mode ranks by absolute P&L; % mode ranks by percentage
    const byDollar = moversUnit === 'dollar';
    const gainers = [...rows]
      .sort((a, b) => (byDollar ? b.dollar - a.dollar : b.p - a.p))
      .slice(0, 5);
    const losers = [...rows]
      .sort((a, b) => (byDollar ? a.dollar - b.dollar : a.p - b.p))
      .slice(0, 5);
    return { gainers, losers };
  }, [filtered, moversMode, moversUnit, viewCurrency, workspaceCurrencyRates, baseCurrency, totalPortfolioTile.displayCcy]);

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

  /** Live prices via Yahoo (+ MF NAV) for currently visible active holdings — same idea as Classic Refresh. */
  const refreshAllPrices = async () => {
    if (!updatePortfolioHoldingLivePrice) {
      setPriceRefreshSummary('Price update not available.');
      return;
    }
    setRefreshingPrices(true);
    setPriceRefreshSummary(null);
    try {
      const scoped = (filtered || []).filter((h: any) => String(h.status || 'active') === 'active');
      const refreshable = scoped.filter(
        (h: any) => h.holding_type !== 'mutual_fund' && (h.ticker || h.symbol)
      );
      const mutualFunds = scoped.filter((h: any) => h.holding_type === 'mutual_fund');
      let succeeded = 0;
      let failed = 0;
      const updatePromises: Promise<void>[] = [];

      if (refreshable.length > 0) {
        const symbols = refreshable.map((h: any) => ({
          symbol: h.ticker ?? h.symbol,
          exchange: h.exchange,
          currency: h.currency,
        }));
        const resp = await fetch('/api/portfolio-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols }),
        });
        if (!resp.ok) throw new Error('Price service did not respond. Try again shortly.');
        const { results } = await resp.json();
        (results || []).forEach((r: any, i: number) => {
          const holding = refreshable[i];
          if (!holding) return;
          if (r.price != null) {
            updatePromises.push(
              updatePortfolioHoldingLivePrice(holding.id, r.price, r.previousClose ?? null, 'Yahoo')
            );
            succeeded++;
          } else if (r.rateLimited || r.error === 'rate_limited') {
            /* soft skip */
          } else {
            if (markPriceLookupFailed) updatePromises.push(markPriceLookupFailed(holding.id));
            failed++;
          }
        });
      }

      let mfSucceeded = 0;
      let mfFailed = 0;
      if (mutualFunds.length > 0) {
        const funds = mutualFunds.map((h: any) => ({ id: h.id, isin: h.isin, name: h.symbol }));
        const mfResp = await fetch('/api/portfolio-mf?action=nav', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ funds }),
        });
        if (mfResp.ok) {
          const { results: mfResults } = await mfResp.json();
          (mfResults || []).forEach((r: any) => {
            const holding = mutualFunds.find((h: any) => h.id === r.id);
            if (!holding) return;
            if (r.nav != null) {
              updatePromises.push(updatePortfolioHoldingLivePrice(holding.id, r.nav, null, 'MF'));
              mfSucceeded++;
            } else {
              if (markPriceLookupFailed) updatePromises.push(markPriceLookupFailed(holding.id));
              mfFailed++;
            }
          });
        } else {
          mfFailed += mutualFunds.length;
        }
      }

      await Promise.all(updatePromises);
      // Single reload for the whole batch - see the comment in usePaymentState.ts on
      // updatePortfolioHoldingLivePrice for why this moved here from being called per-holding.
      await loadPortfolioDetails?.();
      if (refreshable.length === 0 && mutualFunds.length === 0) {
        setPriceRefreshSummary('No holdings to refresh in this view.');
        return;
      }
      const mfNote =
        mutualFunds.length > 0
          ? ` · MF: ${mfSucceeded} updated${mfFailed ? `, ${mfFailed} missed` : ''}`
          : '';
      setPriceRefreshSummary(
        failed === 0
          ? `Updated ${succeeded}${mfNote}`
          : `Updated ${succeeded}, missed ${failed}${mfNote}`
      );
    } catch (e: any) {
      setPriceRefreshSummary(e?.message || 'Refresh failed');
    } finally {
      setRefreshingPrices(false);
    }
  };

  const openImport = () => {
    setImportOpen(true);
    setImportMsg(null);
    setImportErr(null);
    setImportPortfolioId(
      portfolioFilter !== 'All' && portfolioFilter !== '__pending__'
        ? portfolioFilter
        : portfolios?.[0]?.id || ''
    );
  };

  const runPulseImport = async (file: File) => {
    if (!bulkAddPortfolioHoldings || isReadOnly) return;
    setImportBusy(true);
    setImportErr(null);
    setImportMsg(null);
    try {
      const parsed = await parseBrokerFile(file, importTemplate);
      if (!parsed.length) throw new Error('No holdings found in file');
      const buyDate = new Date().toISOString().slice(0, 10);
      const rows = parsed.map((p) => ({
        holdingType: (p.holdingType === 'mutual_fund' ? 'mutual_fund' : p.holdingType === 'options' ? 'options' : 'stock') as any,
        broker: p.broker || (importTemplate === 'moomoo' ? 'Moomoo' : importTemplate === 'tiger' ? 'Tiger' : importTemplate === 'stake' ? 'Stake' : 'Import'),
        symbol: p.symbol,
        isin: p.isin,
        folioNumber: p.folioNumber,
        exchange: p.exchange || '',
        quantity: p.quantity,
        buyPrice: p.buyPrice || 0,
        buyDate,
        currentPrice: p.currentPrice,
        source: p.source || p.broker,
        currency: p.currency || 'USD',
        ticker: p.symbol,
      }));
      await bulkAddPortfolioHoldings(rows, importPortfolioId || undefined);
      setImportMsg(`Imported ${rows.length} holding${rows.length === 1 ? '' : 's'}.`);
    } catch (e: any) {
      setImportErr(e?.message || 'Import failed');
    } finally {
      setImportBusy(false);
    }
  };

  const openSync = () => {
    setSyncOpen(true);
    setConnectError(null);
    setConnectOk(null);
  };

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
      const missing = meta.fields.filter((f) => f.key !== 'access_token' && f.key !== 'region' && f.key !== 'connection_label' && !String(credFields[f.key] || '').trim());
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

      // Prefer explicit connection_label field (Webull) over auto book-based label
      const explicitLabel = String(credFields.connection_label || '').trim();
      const finalLabel = explicitLabel || label;
      if (finalLabel) {
        const taken = (portfolioBrokerConnections || []).some(
          (c: any) => String(c.connection_label || '').trim().toLowerCase() === finalLabel.toLowerCase()
        );
        if (taken) {
          setConnectError(`Connection name "${finalLabel}" is already used — pick a unique label`);
          setConnectBusy(false);
          return;
        }
      }

      if (selectedBroker === 'groww') {
        const resp = await fetch('/api/portfolio-broker-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broker: 'groww',
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
          finalLabel
        );
      } else if (selectedBroker === 'webull') {
        // Full Webull OpenAPI connect: create token → poll until verified → store token
        const region = (credFields.region || 'au').trim().toLowerCase() || 'au';
        const appKey = credFields.app_key.trim();
        const appSecret = credFields.app_secret.trim();
        setConnectOk('Webull: starting verification — approve on your phone if prompted…');
        const connectResp = await fetch('/api/portfolio-broker-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broker: 'webull', action: 'connect', appKey, appSecret, region }),
        });
        const connectData = await connectResp.json().catch(() => ({}));
        if (!(connectData.status === 'pending_verification' && connectData.tokenId)) {
          setConnectError(connectData.error || connectData.debug?.message || 'Webull connect failed — check app key/secret/region');
          setConnectBusy(false);
          return;
        }
        let token: string | null = null;
        let expiresAt: string | null = null;
        for (let attempt = 0; attempt < 60; attempt++) {
          await new Promise((r) => setTimeout(r, 5000));
          const checkResp = await fetch('/api/portfolio-broker-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ broker: 'webull', action: 'check', appKey, appSecret, region, tokenId: connectData.tokenId }),
          });
          const checkData = await checkResp.json().catch(() => ({}));
          if (checkData.verified && checkData.token) {
            token = checkData.token;
            expiresAt = checkData.expiresAt ?? null;
            break;
          }
          setConnectOk(`Webull: waiting for approval… (${attempt + 1}/60)`);
        }
        if (!token) {
          setConnectError('Webull verification timed out. Open the Webull app and approve, then try again.');
          setConnectBusy(false);
          return;
        }
        await setPortfolioBrokerConnection(
          'webull',
          { app_key: appKey, app_secret: appSecret, region, token, token_expires_at: expiresAt },
          portfolioId,
          finalLabel
        );
      } else {
        const { connection_label: _cl, ...creds } = credFields as any;
        await setPortfolioBrokerConnection(selectedBroker, { ...creds }, portfolioId, finalLabel);
      }
      setConnectOk(`${finalLabel} saved. Use Sync on this connection to pull holdings / live prices.`);
      setConnectStep('pick');
      setSelectedBroker(null);
      setCredFields({});
    } catch (e: any) {
      setConnectError(e?.message || 'Could not save connection');
    } finally {
      setConnectBusy(false);
    }
  };

  /** Pull live prices from broker API and stamp matching holdings. Full position add/remove still via classic import. */
  const syncConnection = async (connection: any) => {
    if (!connection || isReadOnly) return;
    setSyncingId(connection.id);
    setConnectError(null);
    setConnectOk(null);
    try {
      if (needsReauth(connection)) {
        throw new Error(`${connection.broker_type === 'zerodha' ? 'Zerodha' : 'Groww'} token expires daily - please reconnect and authorize again before syncing.`);
      }
      const type = String(connection.broker_type || connection.brokerType || '').toLowerCase().trim();
      // credentials may arrive as object or JSON string depending on load path
      let cred: any = connection.credentials ?? connection.creds ?? {};
      if (typeof cred === 'string') {
        try { cred = JSON.parse(cred); } catch { cred = {}; }
      }
      let priceBySymbol = new Map<string, number>();

      if (type === 'etoro') {
        const webullConn = (portfolioBrokerConnections || []).find((c: any) => c.broker_type === 'webull');
        const resp = await fetch('/api/portfolio-broker-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broker: 'etoro',
            apiKey: cred.api_key,
            userKey: cred.user_key,
            webullAppKey: webullConn?.credentials?.app_key,
            webullAppSecret: webullConn?.credentials?.app_secret,
            webullToken: webullConn?.credentials?.token,
            webullRegion: webullConn?.credentials?.region,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.error || `eToro sync failed (${resp.status})`);
        for (const h of data.holdings || []) {
          const sym = String(h.symbol || '').toUpperCase();
          const px = Number(h.currentPrice);
          if (sym && Number.isFinite(px) && px > 0) priceBySymbol.set(sym, px);
        }
      } else if (type === 'groww') {
        const holdings = (portfolioHoldings || []).filter(
          (h: any) => String(h.broker || '').toLowerCase() === 'groww' && (!connection.portfolio_id || h.portfolio_id === connection.portfolio_id)
        );
        const instruments = holdings.map((h: any) => {
          const sym = String(h.ticker || h.symbol || '').toUpperCase().replace(/^(NSE|BSE)[_:]/, '');
          const ex = String(h.exchange || 'NSE').toUpperCase() === 'BSE' ? 'BSE' : 'NSE';
          return `${ex}_${sym}`;
        });
        if (instruments.length === 0) throw new Error('No Groww holdings to price in this book.');
        const resp = await fetch('/api/portfolio-broker-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broker: 'groww',
            action: 'ltp',
            apiKey: cred.api_key,
            apiSecret: cred.api_secret,
            accessToken: cred.access_token,
            instruments,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.error || 'Groww LTP failed');
        const ltpMap: Record<string, any> = data.prices || data.ltp || data.payload || {};
        holdings.forEach((h: any, idx: number) => {
          const key = instruments[idx];
          const bare = String(h.ticker || h.symbol || '').toUpperCase();
          const raw = ltpMap[key] ?? ltpMap[`NSE_${bare}`] ?? ltpMap[`BSE_${bare}`] ?? ltpMap[bare];
          const price = typeof raw === 'number' ? raw : Number(raw?.ltp ?? raw?.last_price ?? raw?.lastPrice);
          if (Number.isFinite(price) && price > 0) priceBySymbol.set(bare, price);
        });
      } else if (type === 'zerodha') {
        const holdings = (portfolioHoldings || []).filter(
          (h: any) => String(h.broker || '').toLowerCase() === 'zerodha' && (!connection.portfolio_id || h.portfolio_id === connection.portfolio_id)
        );
        const instruments = holdings.map((h: any) => `${h.exchange || 'NSE'}:${h.ticker || h.symbol}`);
        if (instruments.length === 0) throw new Error('No Zerodha holdings to price in this book.');
        const resp = await fetch('/api/portfolio-broker-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broker: 'zerodha',
            action: 'quote',
            apiKey: cred.api_key,
            accessToken: cred.access_token,
            instruments,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.error || 'Zerodha quote failed');
        holdings.forEach((h: any) => {
          const key = `${h.exchange || 'NSE'}:${h.ticker || h.symbol}`;
          const q = data.quotes?.[key];
          if (q?.lastPrice != null) priceBySymbol.set(String(h.ticker || h.symbol).toUpperCase(), Number(q.lastPrice));
        });
      } else if (type === 'webull' || type.includes('webull')) {
        if (!cred.app_key || !cred.app_secret) {
          throw new Error('Webull connection is missing app_key / app_secret. Re-connect from Connect / Sync.');
        }
        if (!cred.token) {
          throw new Error('Webull token missing — re-connect and approve on your phone, then Sync again.');
        }
        const resp = await fetch('/api/portfolio-broker-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broker: 'webull',
            action: 'sync',
            appKey: cred.app_key,
            appSecret: cred.app_secret,
            region: cred.region || 'au',
            token: cred.token,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.error || `Webull sync failed (${resp.status})`);
        for (const h of data.holdings || []) {
          const sym = String(h.symbol || '').toUpperCase().trim();
          const px = Number(h.currentPrice);
          if (sym && Number.isFinite(px) && px > 0) {
            priceBySymbol.set(sym, px);
            // Also index by first token (underlying) so "AAPL OPT xxx" matches holding "AAPL OPT …"
            const under = sym.split(/\s+/)[0];
            if (under && under !== sym) priceBySymbol.set(under, px);
          }
        }
        if (priceBySymbol.size === 0) {
          throw new Error('Webull sync returned no prices. Try classic Portfolio → Sync for full import.');
        }
      } else {
        throw new Error(`Live sync for "${type || '(empty)'}" is not wired in V1 yet — use classic Portfolio.`);
      }

      let updated = 0;
      const targetPid = connection.portfolio_id || null;
      for (const h of portfolioHoldings || []) {
        if (h.status && h.status !== 'active') continue;
        if (targetPid && h.portfolio_id !== targetPid) continue;
        // Webull options: only match Webull holdings (or same book) to avoid stomping stocks
        if ((type === 'webull' || type.includes('webull')) && String(h.broker || '').toLowerCase() !== 'webull') continue;
        const sym = String(h.ticker || h.symbol || '').toUpperCase().trim();
        let px = priceBySymbol.get(sym);
        if (px == null) {
          // Fuzzy: holding "AAPL OPT 1C000000" ↔ map key "AAPL OPT 1C000000" or underlying "AAPL"
          for (const [k, v] of priceBySymbol) {
            if (sym === k || sym.startsWith(k + ' ') || k.startsWith(sym + ' ') || sym.split(/\s+/)[0] === k.split(/\s+/)[0] && (sym.includes('OPT') || k.includes('OPT'))) {
              px = v;
              break;
            }
          }
        }
        if (px != null && updatePortfolioHoldingLivePrice) {
          await updatePortfolioHoldingLivePrice(h.id, px, null, type === 'webull' || type.includes('webull') ? 'Webull' : type === 'etoro' ? 'eToro' : type === 'zerodha' ? 'Zerodha' : type === 'groww' ? 'Groww' : type);
          updated++;
        }
      }
      await loadPortfolioDetails?.();
      await markBrokerConnectionSynced?.(connection.id);
      setConnectOk(
        updated > 0
          ? `Synced ${updated} live price${updated === 1 ? '' : 's'} from ${connection.connection_label || type}.`
          : `Sync OK — no matching symbols to update. Full position import still uses classic Portfolio.`
      );
    } catch (e: any) {
      setConnectError(e?.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const removeConnection = async (id: string) => {
    if (!deletePortfolioBrokerConnection || isReadOnly) return;
    if (!window.confirm('Remove this broker connection?')) return;
    try {
      await deletePortfolioBrokerConnection(id);
      setConnectOk('Connection removed.');
    } catch (e: any) {
      setConnectError(e?.message || 'Could not remove connection');
    }
  };


  const reloadPnlCalendar = async () => {
    if (!loadPortfolioDailyPositions) return;
    setPnlCalendarLoading(true);
    try {
      const to = new Date();
      const from = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());
      const pid = portfolioFilter !== 'All' && portfolioFilter !== '__pending__' ? portfolioFilter : null;
      const data = await loadPortfolioDailyPositions(
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10),
        pid
      );
      setPnlCalendarRows(data || []);
      const ccySet = Array.from(new Set((data || []).map((r: any) => String(r.currency || '').toUpperCase()).filter(Boolean)));
      if (ccySet.length && !ccySet.includes(pnlCalendarCcy)) setPnlCalendarCcy(ccySet[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setPnlCalendarLoading(false);
    }
  };

  useEffect(() => {
    if (showPnlCalendar) reloadPnlCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPnlCalendar, portfolioFilter]);

  // Keep calendar book chip in sync with main Book filter when a specific book is selected
  useEffect(() => {
    if (portfolioFilter && portfolioFilter !== 'All' && portfolioFilter !== '__pending__') {
      setPnlCalendarPortfolioId(String(portfolioFilter));
      const book = (portfolios || []).find((p: any) => String(p.id) === String(portfolioFilter));
      const ccy = String(book?.currency || '').toUpperCase();
      if (ccy) setPnlCalendarCcy(ccy);
    }
  }, [portfolioFilter, portfolios]);

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
    <div className="w-full max-w-full min-w-0 overflow-x-hidden px-3 sm:px-4 pt-2 sm:pt-3 pb-24 sm:pb-6 space-y-3 sm:space-y-4 box-border">
      {/* Hero */}
      <div className="relative w-full min-w-0 max-w-full overflow-x-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 p-3 sm:p-4">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-indigo-400/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Briefcase className="w-5 h-5 text-indigo-500" />
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {workspaceName ? `${workspaceName} Portfolio` : 'Portfolio'}
              </h1>
            </div>
          </div>
        </div>

        {isDataLoading && (
          <div className="relative mt-3 text-[11px] text-slate-400 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        )}

        {/* Portfolio + broker chips — segmented, Canva-clean */}
        <div className="relative mt-4 space-y-2.5 w-full min-w-0 max-w-full">
          {multiPortfolio && portfoliosPresent.length > 0 && (
            <div className="w-full min-w-0 max-w-full space-y-2">
              {/* Book row — own horizontal scroller */}
              <div className="flex items-center gap-2 min-w-0 w-full">
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-violet-500/80 dark:text-violet-400/80 w-10">
                  Book
                </span>
                <div
                  className="w-0 flex-1 min-w-0 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x"
                  style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
                >
                  <div className="flex items-center gap-1 w-max pr-2">
                    <button
                      type="button"
                      onClick={() => selectPortfolioBook('All')}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                        portfolioFilter === 'All'
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                          : 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                      }`}
                    >
                      All
                    </button>
                    {portfoliosPresent.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPortfolioBook(p.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all max-w-[7.5rem] truncate ${
                          portfolioFilter === p.id
                            ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                            : 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                        }`}
                        title={p.name}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Broker (left) + View currency (right) — same row on desktop; each side keeps
              its own independent horizontal scroller, so neither steals the other's space
              when both are long lists. */}
          <div className="flex items-center gap-2 min-w-0 w-full max-w-full flex-wrap lg:flex-nowrap">
            <div className="flex items-center gap-2 min-w-0 flex-1 basis-full lg:basis-auto">
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-indigo-500/80 dark:text-indigo-400/80 w-10">
                Broker
              </span>
              <div className="w-0 flex-1 min-w-0 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                <div className="flex items-center gap-1 w-max pr-2">
                  <button
                    type="button"
                    onClick={() => setBrokerFilter('All')}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                      brokerFilter === 'All'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
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
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                        brokerFilter === b
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {multiPortfolio && portfoliosPresent.length > 0 && currenciesPresent.length > 1 && (
              <div className="flex items-center gap-2 min-w-0 shrink-0 basis-full lg:basis-auto lg:max-w-[45%]">
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-500/80 dark:text-emerald-400/80 w-10">
                  View
                </span>
                <div
                  className="w-0 flex-1 min-w-0 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x lg:flex-initial"
                  style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
                >
                  <div className="flex items-center gap-1 w-max pr-2">
                    {currenciesPresent.map((ccy) => (
                      <button
                        key={ccy}
                        type="button"
                        onClick={() => pickViewCurrency(ccy)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                          viewCurrency === ccy
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                            : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        {ccy}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* P&L filters (left) + Import/Sync/Connect/Refresh actions (right) — same row on
              desktop, stacked on narrow screens so the action buttons don't crowd out the
              P&L toggles. */}
          <div className="flex items-center justify-between gap-2 flex-wrap w-full min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400 w-10">
                P&amp;L
              </span>
              <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
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
              </div>
              <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
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
              </div>
              <button
                type="button"
                onClick={() => setShowPnlCalendar((v) => !v)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                  showPnlCalendar
                    ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-600/30'
                    : 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
                }`}
                title="Show or hide P&L calendar"
              >
                P&amp;L Calendar
              </button>
            </div>

            <div className="flex items-center justify-end gap-1.5 flex-wrap min-w-0">
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-teal-100/90 dark:bg-teal-950/50 border border-teal-200/70 dark:border-teal-800/60">
                <button
                  type="button"
                  onClick={openImport}
                  disabled={isReadOnly}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold text-teal-900 dark:text-teal-100 hover:bg-teal-200/70 dark:hover:bg-teal-900/50 disabled:opacity-50 transition-all"
                  title="Import CSV / broker export"
                >
                  <Upload className="w-3 h-3" />
                  Import
                </button>
                <button
                  type="button"
                  onClick={openSync}
                  disabled={isReadOnly}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-teal-600 text-white shadow-md shadow-teal-600/30 hover:bg-teal-700 disabled:opacity-50 transition-all"
                  title="Sync existing broker connections"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingId ? 'animate-spin' : ''}`} />
                  Sync
                </button>
              </div>
              <button
                type="button"
                onClick={openConnect}
                disabled={isReadOnly}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                title="Add a new broker connection"
              >
                <Plus className="w-3 h-3" />
                Connect
              </button>
              <button
                type="button"
                onClick={() => refreshAllPrices()}
                disabled={refreshingPrices || isReadOnly}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md hover:opacity-90 disabled:opacity-50 transition-all"
                title="Refresh live prices (Yahoo / MF NAV)"
              >
                <RefreshCw className={`w-3 h-3 ${refreshingPrices ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {(connectOk || connectError || priceRefreshSummary) && !connectOpen && (
            <p
              className={`text-[10px] font-bold text-right ${
                connectError
                  ? 'text-rose-500'
                  : connectOk || (priceRefreshSummary && !priceRefreshSummary.toLowerCase().includes('fail'))
                    ? 'text-emerald-600'
                    : 'text-slate-500'
              }`}
            >
              {connectOk || connectError || priceRefreshSummary}
            </p>
          )}

        {showPnlCalendar && (
          <div className="mt-3 rounded-2xl border border-violet-200/80 dark:border-violet-900/50 bg-white dark:bg-slate-900 p-3 sm:p-4">
            <PortfolioPnLCalendar
              rows={pnlCalendarRows}
              loading={pnlCalendarLoading}
              currencies={Array.from(new Set([
                ...pnlCalendarRows.map((r: any) => String(r.currency || '').toUpperCase()).filter(Boolean),
                String(baseCurrency || viewCurrency || 'INR').toUpperCase(),
              ]))}
              selectedCurrency={pnlCalendarCcy}
              onCurrencyChange={setPnlCalendarCcy}
              portfolios={(portfolios || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                currency: p.currency,
              }))}
              selectedPortfolioId={pnlCalendarPortfolioId}
              onPortfolioChange={(id) => {
                setPnlCalendarPortfolioId(id);
                if (id !== 'all') {
                  const book = (portfolios || []).find((p: any) => p.id === id);
                  const ccy = String(book?.currency || '').toUpperCase();
                  if (ccy) setPnlCalendarCcy(ccy);
                }
              }}
              portfolioLabel={
                pnlCalendarPortfolioId !== 'all'
                  ? (portfolios || []).find((p: any) => p.id === pnlCalendarPortfolioId)?.name
                  : undefined
              }
              canSnapshot={!isReadOnly}
              onRefreshSnapshot={snapshotPortfolioDailyPositions}
              onReload={reloadPnlCalendar}
            />
          </div>
        )}
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
            gridTemplateColumns: (() => {
              const total = categoryCards.length + 1;
              if (total <= 1) return '1fr';
              if (total === 2) return 'repeat(2, minmax(0, 1fr))';
              if (total === 3) return 'repeat(3, minmax(0, 1fr))';
              if (!isWideDesktop) return 'repeat(auto-fit, minmax(140px, 1fr))';
              // Balanced rows: cap at 5 tiles per row, then spread the total evenly across
              // however many rows that needs (9 -> 2 rows -> ceil(9/2)=5 cols -> 5+4, not
              // "as many as fit at 140px" which produced an orphaned 8-then-1 split).
              const maxPerRow = 5;
              const rows = Math.ceil(total / maxPerRow);
              const cols = Math.ceil(total / rows);
              return `repeat(${cols}, minmax(0, 1fr))`;
            })(),
          }}
        >
          {/* Total portfolio — first tile, in default/book currency */}
          <div
            className={`rounded-2xl border bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 ${
              categoryFilter === 'All'
                ? 'border-transparent ring-2 ring-slate-400/60 shadow-md'
                : 'border-slate-200/80 dark:border-slate-800'
            } overflow-hidden transition-shadow`}
          >
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('All');
                setExpandedCategory(null);
              }}
              className="w-full text-left p-3 sm:p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="shrink-0 p-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-[12px] font-black text-slate-900 dark:text-white leading-tight truncate">Total portfolio</p>
                </div>
                <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">{totalPortfolioTile.count}</span>
              </div>
            </button>
            <div
              className="px-3 sm:px-3.5 pb-3"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <TileMetricScroller
                slides={[
                  {
                    key: 'value',
                    node: (
                      <>
                        <p className="text-[13px] sm:text-[15px] font-black tabular-nums text-slate-900 dark:text-white">
                          {money(totalPortfolioTile.market, totalPortfolioTile.displayCcy)}
                        </p>
                        <p
                          className={`text-[11px] sm:text-[12px] font-black tabular-nums leading-tight mt-0.5 ${
                            formatTotalPerf().positive ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {formatTotalPerf().text}
                          <span className="ml-1 text-[9px] font-bold text-slate-400 normal-case">{perfLabel}</span>
                        </p>
                      </>
                    ),
                  },
                  {
                    key: 'profit',
                    node: (() => {
                      const side = formatTileSide(
                        moversMode === 'day' ? totalPortfolioTile.dayGainPnl : totalPortfolioTile.gainPnl,
                        moversMode === 'day' ? totalPortfolioTile.dayLossPnl : totalPortfolioTile.lossPnl,
                        moversMode === 'day' ? totalPortfolioTile.dayGainCount : totalPortfolioTile.gainCount,
                        moversMode === 'day' ? totalPortfolioTile.dayLossCount : totalPortfolioTile.lossCount,
                        totalPortfolioTile.invested,
                        totalPortfolioTile.dayBase || 0,
                        totalPortfolioTile.displayCcy,
                      );
                      return (
                        <>
                          <p className="text-[13px] sm:text-[15px] font-black tabular-nums text-emerald-600">
                            {side.gainText}
                          </p>
                          <p className="text-[9px] font-bold text-emerald-600/80 mt-0.5">{side.gainLabel}</p>
                        </>
                      );
                    })(),
                  },
                  {
                    key: 'loss',
                    node: (() => {
                      const side = formatTileSide(
                        moversMode === 'day' ? totalPortfolioTile.dayGainPnl : totalPortfolioTile.gainPnl,
                        moversMode === 'day' ? totalPortfolioTile.dayLossPnl : totalPortfolioTile.lossPnl,
                        moversMode === 'day' ? totalPortfolioTile.dayGainCount : totalPortfolioTile.gainCount,
                        moversMode === 'day' ? totalPortfolioTile.dayLossCount : totalPortfolioTile.lossCount,
                        totalPortfolioTile.invested,
                        totalPortfolioTile.dayBase || 0,
                        totalPortfolioTile.displayCcy,
                      );
                      return (
                        <>
                          <p className="text-[13px] sm:text-[15px] font-black tabular-nums text-rose-600">
                            {side.lossText}
                          </p>
                          <p className="text-[9px] font-bold text-rose-600/80 mt-0.5">{side.lossLabel}</p>
                        </>
                      );
                    })(),
                  },
                ]}
              />
            </div>

          </div>

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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`shrink-0 p-1.5 rounded-xl ${selected ? meta.chip : 'bg-white/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                        {meta.icon}
                      </div>
                      <p className="text-[12px] font-black text-slate-900 dark:text-white leading-tight truncate">
                        {meta.flag && <span className="mr-1">{meta.flag}</span>}{meta.shortLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums">{stats.count}</span>
                      {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </div>
                  {stats.byCurrency.length > 1 && (
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      +{stats.byCurrency.length - 1} more ccy
                    </p>
                  )}
                </button>
                {primary && (
                  <div
                    className="px-3 sm:px-3.5 pb-3"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <TileMetricScroller
                      slides={[
                        {
                          key: 'value',
                          node: (
                            <>
                              <p className="text-[13px] sm:text-[15px] font-black tabular-nums text-slate-900 dark:text-white">
                                {money(primary.market, primary.currency)}
                              </p>
                              <p
                                className={`text-[11px] sm:text-[12px] font-black tabular-nums leading-tight mt-0.5 ${
                                  formatBucketPerf(primary).positive ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {formatBucketPerf(primary).text}
                                <span className="ml-1 text-[9px] font-bold text-slate-400">{perfLabel}</span>
                              </p>
                            </>
                          ),
                        },
                        {
                          key: 'profit',
                          node: (() => {
                            const side = formatTileSide(
                              moversMode === 'day' ? primary.dayGainPnl : primary.gainPnl,
                              moversMode === 'day' ? primary.dayLossPnl : primary.lossPnl,
                              moversMode === 'day' ? primary.dayGainCount : primary.gainCount,
                              moversMode === 'day' ? primary.dayLossCount : primary.lossCount,
                              primary.invested,
                              primary.dayBase || 0,
                              primary.currency,
                            );
                            return (
                              <>
                                <p className="text-[13px] sm:text-[15px] font-black tabular-nums text-emerald-600">
                                  {side.gainText}
                                </p>
                                <p className="text-[9px] font-bold text-emerald-600/80 mt-0.5">{side.gainLabel}</p>
                              </>
                            );
                          })(),
                        },
                        {
                          key: 'loss',
                          node: (() => {
                            const side = formatTileSide(
                              moversMode === 'day' ? primary.dayGainPnl : primary.gainPnl,
                              moversMode === 'day' ? primary.dayLossPnl : primary.lossPnl,
                              moversMode === 'day' ? primary.dayGainCount : primary.gainCount,
                              moversMode === 'day' ? primary.dayLossCount : primary.lossCount,
                              primary.invested,
                              primary.dayBase || 0,
                              primary.currency,
                            );
                            return (
                              <>
                                <p className="text-[13px] sm:text-[15px] font-black tabular-nums text-rose-600">
                                  {side.lossText}
                                </p>
                                <p className="text-[9px] font-bold text-rose-600/80 mt-0.5">{side.lossLabel}</p>
                              </>
                            );
                          })(),
                        },
                      ]}
                    />
                  </div>
                )}


                {expanded && (
                  <div className="border-t border-slate-200/60 dark:border-slate-800 px-3 pb-3 pt-2 space-y-2 bg-white/50 dark:bg-slate-950/40">
                    {stats.byCurrency.map((c) => (
                      <div key={c.currency} className="flex justify-between text-[10px]">
                        <span className="font-bold text-slate-500">{c.currency}</span>
                        <span className="tabular-nums font-bold text-slate-800 dark:text-slate-100">
                          {money(c.market, c.currency)}
                          <span
                            className={`ml-1.5 ${
                              formatBucketPerf(c as any).positive ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {formatBucketPerf(c as any).text}
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
                                formatHoldingPerf(h).positive ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {formatHoldingPerf(h).text}
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
        {categoryCards.length === 0 && totalPortfolioTile.count === 0 && (
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
        <div className="flex items-center justify-between gap-2 px-0.5 flex-wrap">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            Movers
            <span className="ml-1.5 text-[9px] font-bold text-slate-400 normal-case tracking-normal">
              {perfLabel} · {moversUnit === 'dollar' ? '$' : '%'}
            </span>
          </p>
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
                {block.rows.map(({ h, p, dollar, displayCcy }) => (
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
                        {moversUnit === 'pct' ? pct(p) : moneyPrecise(dollar, displayCcy || viewCurrency)}
                      </p>
                      <p className="text-[9px] tabular-nums text-slate-400">
                        {moversUnit === 'pct' ? moneyPrecise(dollar, displayCcy || viewCurrency) : pct(p)}
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
                <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
                  <p className="text-[9px] font-black uppercase text-slate-400 px-2 py-1">Show &amp; order columns</p>
                  <p className="text-[9px] text-slate-400 px-2 pb-1">↑↓ moves left/right in the table</p>
                  {colOrder.map((key, idx) => {
                    const c = HOLDING_COLUMNS.find((x) => x.key === key);
                    if (!c) return null;
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={colOn(key)}
                          onChange={() => toggleCol(key)}
                          className="rounded border-slate-300 shrink-0"
                        />
                        <span className="flex-1 min-w-0 truncate">{c.label}</span>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveCol(key, -1)}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25"
                          title="Move left"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === colOrder.length - 1}
                          onClick={() => moveCol(key, 1)}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25"
                          title="Move right"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={resetColLayout}
                    className="w-full mt-1 text-[10px] font-bold text-indigo-600 py-1"
                  >
                    Reset defaults
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Filter by type — segmented track */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400 w-10">
              Type
            </span>
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('All');
                  setExpandedCategory(null);
                }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                  categoryFilter === 'All'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-md'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All
              </button>
              {categoryCards.map(({ id, stats, meta }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(id);
                    setExpandedCategory(id);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                    categoryFilter === id
                      ? `${meta.chip} shadow-md`
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {meta.label.split('·').pop()?.trim()} · {stats.count}
                </button>
              ))}
            </div>
            {hasLotsForSelectedBook && (
              <button
                type="button"
                onClick={() => setShowLotsOnly((v) => !v)}
                className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                  showLotsOnly
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                    : 'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300'
                }`}
              >
                <ShieldAlert className="w-3 h-3" /> Lots
              </button>
            )}
          </div>
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
                  const qty = lotQty != null ? lotQty : (Number(h.quantity) || 0);
                  const buy = lot ? Number(lot.buy_price) : Number(h.buy_price);
                  const live = lot
                    ? Number(lot.current_price ?? h.live_price ?? h.current_price ?? buy) || 0
                    : livePrice(h);
                  const inv = buy * qty;
                  const mv = live * qty;
                  const pAmt = mv - inv;
                  const pPct = inv > 0 ? (pAmt / inv) * 100 : 0;
                  const d = dayChangePct(h);
                  const prevClose = Number(h.previous_close);
                  const dAmt = d != null && Number.isFinite(prevClose) && prevClose > 0 ? (live - prevClose) * qty : null;
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
                    day_amt: (
                      <span className={`tabular-nums font-bold ${dAmt == null ? 'text-slate-300' : dAmt >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {dAmt == null ? '—' : moneyPrecise(dAmt, ccy)}
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
                    const liveP = Number(h.live_price ?? h.buy_price) || 0;
                    const prevCloseP = Number(h.previous_close);
                    const qtyP = Number(h.quantity) || 0;
                    const dAmt = d != null && Number.isFinite(prevCloseP) && prevCloseP > 0 ? (liveP - prevCloseP) * qtyP : null;
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
                            <p className="text-[14px] font-black tabular-nums text-slate-900 dark:text-white">{money(marketValue(h), ccy)}</p>
                            <p className={`text-[12px] font-black tabular-nums ${p >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {pct(p)}
                            </p>
                            {d != null && (
                              <p className={`text-[12px] font-bold tabular-nums ${d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                Day {pct(d)}{dAmt != null ? ` (${dAmt >= 0 ? '+' : ''}${moneyPrecise(dAmt, ccy)})` : ''}
                              </p>
                            )}
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

      {/* Connect modal */}
      
      
      {syncOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3" onClick={() => setSyncOpen(false)}>
          <div className="w-full sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[14px] font-black text-slate-900 dark:text-white">Sync connections</h3>
                <p className="text-[10px] text-slate-500">Existing brokers only — pull live prices / holdings</p>
              </div>
              <button type="button" onClick={() => setSyncOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            {(portfolioBrokerConnections || []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center space-y-2">
                <p className="text-[12px] text-slate-500">No connections yet.</p>
                <button
                  type="button"
                  onClick={() => { setSyncOpen(false); openConnect(); }}
                  className="text-[11px] font-bold text-indigo-600"
                >
                  + Connect a broker
                </button>
              </div>
            ) : (
              <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
                {(portfolioBrokerConnections || []).map((c: any) => {
                  const busy = syncingId === c.id;
                  const label = c.connection_label || c.broker_type || 'Broker';
                  const book = (portfolios || []).find((p: any) => p.id === c.portfolio_id)?.name;
                  const last = c.last_synced_at ? new Date(c.last_synced_at).toLocaleString() : 'Never';
                  return (
                    <li key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-black truncate text-slate-900 dark:text-white">{label}</p>
                        <p className="text-[9px] text-slate-400 truncate">
                          {String(c.broker_type || '').toUpperCase()}
                          {book ? ` · ${book}` : ''}
                          {' · '}Last: {last}
                        </p>
                        {needsReauth(c) && (
                          <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 truncate">Token expired today - re-authorize to sync</p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={isReadOnly || busy}
                        onClick={() => needsReauth(c) ? openConnect() : syncConnection(c)}
                        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold text-white disabled:opacity-50 ${needsReauth(c) ? 'bg-amber-600' : 'bg-teal-600'}`}
                      >
                        <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
                        {busy ? '…' : needsReauth(c) ? 'Re-auth' : 'Sync'}
                      </button>
                      {deletePortfolioBrokerConnection && (
                        <button
                          type="button"
                          disabled={isReadOnly || busy}
                          onClick={() => {
                            if (confirm(`Remove connection "${label}"?`)) removeConnection(c.id);
                          }}
                          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                          title="Remove connection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {(connectOk || connectError) && (
              <p className={`text-[11px] font-bold ${connectError ? 'text-rose-600' : 'text-emerald-600'}`}>
                {connectError || connectOk}
              </p>
            )}
            <p className="text-[10px] text-slate-400">
              Need a new broker? Use <button type="button" className="font-bold text-indigo-600" onClick={() => { setSyncOpen(false); openConnect(); }}>+ Connect</button>
              {' · '}CSV file? <button type="button" className="font-bold text-teal-600" onClick={() => { setSyncOpen(false); openImport(); }}>Import</button>
            </p>
          </div>
        </div>
      )}

{importOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3" onClick={() => !importBusy && setImportOpen(false)}>
          <div className="w-full sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-black text-slate-900 dark:text-white">Import holdings</h3>
              <button type="button" onClick={() => setImportOpen(false)} className="text-slate-400 text-[12px] font-bold">Close</button>
            </div>
            <p className="text-[11px] text-slate-500">
              Upload a broker export or universal CSV. Moomoo &amp; Tiger: use Symbol, Quantity, Avg Cost, Market Price, Currency columns.
            </p>
            {(portfolios || []).length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Portfolio book</p>
                <select
                  value={importPortfolioId}
                  onChange={(e) => setImportPortfolioId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-[12px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  {(portfolios || []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 mb-1.5">Template</p>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['universal', 'Universal'],
                  ['stake', 'Stake'],
                  ['zerodha', 'Zerodha'],
                  ['groww_stocks', 'Groww'],
                  ['groww_mf', 'Groww MF'],
                  ['moomoo', 'Moomoo'],
                  ['tiger', 'Tiger'],
                ] as [BrokerTemplate, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setImportTemplate(id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      importTemplate === id
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {importTemplate === 'universal' && (
              <button type="button" onClick={() => downloadUniversalTemplate()} className="text-[11px] font-bold text-teal-600">
                Download universal CSV template
              </button>
            )}
            <label className={`block w-full py-3 rounded-xl border-2 border-dashed text-center text-[12px] font-bold cursor-pointer ${
              importBusy ? 'opacity-50 pointer-events-none' : 'border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50/50 dark:hover:bg-teal-950/20'
            }`}>
              {importBusy ? 'Importing…' : 'Choose file (CSV / XLSX)'}
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.tsv,text/csv"
                className="hidden"
                disabled={importBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) runPulseImport(f);
                }}
              />
            </label>
            {importMsg && <p className="text-[11px] font-bold text-emerald-600">{importMsg}</p>}
            {importErr && <p className="text-[11px] font-bold text-rose-600">{importErr}</p>}
            <p className="text-[10px] text-slate-400">
              Live Sync (Connect → Refresh) updates prices for linked brokers. Full position import uses this Import flow — including Moomoo &amp; Tiger CSV.
            </p>
          </div>
        </div>
      )}

{connectOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-3xl">
              <h3 className="text-sm font-black">
                {connectStep === 'pick' ? 'New connection' : BROKER_META[selectedBroker!]?.label}
              </h3>
              <button type="button" onClick={() => setConnectOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {connectOk && <div className="text-[11px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-3 py-2">{connectOk}</div>}
              {connectError && <div className="text-[11px] text-rose-700 bg-rose-50 dark:bg-rose-950/30 rounded-xl px-3 py-2">{connectError}</div>}
              {connectStep === 'pick' && (
                <>
                  {(portfolioBrokerConnections || []).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Already connected</p>
                      {(portfolioBrokerConnections || []).map((c: any) => {
                        const pName = c.portfolio_id ? portfolios.find((p: any) => p.id === c.portfolio_id)?.name : null;
                        const busy = syncingId === c.id;
                        return (
                          <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[12px] font-black truncate">{c.connection_label || c.broker_type}</p>
                                <p className="text-[9px] text-slate-400">{pName || 'Workspace'}</p>
                                {needsReauth(c) && (
                                  <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400">Token expired today - re-authorize to sync</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={isReadOnly || busy}
                                onClick={() => needsReauth(c) ? openConnect() : syncConnection(c)}
                                className={`flex-1 min-h-[42px] rounded-xl text-white text-[11px] font-bold disabled:opacity-50 ${needsReauth(c) ? 'bg-amber-600' : 'bg-indigo-600'}`}
                              >
                                {busy ? 'Syncing…' : needsReauth(c) ? 'Re-authorize' : 'Sync now'}
                              </button>
                              <button
                                type="button"
                                disabled={isReadOnly || busy}
                                onClick={() => removeConnection(c.id)}
                                className="flex-1 min-h-[42px] rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-[11px] font-bold border border-rose-200 dark:border-rose-900 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Add a new broker link — assign it to a book when you have multiple portfolios.
                  </p>
                  {multiPortfolio && (portfolios || []).length > 0 && (
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase text-slate-500">Portfolio</span>
                      <select
                        value={connectPortfolioId}
                        onChange={(e) => setConnectPortfolioId(e.target.value)}
                        className="mt-1 w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-800 dark:text-slate-100 appearance-none shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
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
                        className="mt-1 w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-semibold text-slate-800 dark:text-slate-100 appearance-none shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                        autoComplete="off"
                      />
                    </label>
                  ))}
                  {selectedBroker === 'zerodha' && (
                    <button
                      type="button"
                      onClick={() => {
                        const key = String(credFields.api_key || '').trim();
                        if (!key) {
                          setConnectError('Enter API Key first, then open login');
                          return;
                        }
                        window.open(
                          `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(key)}`,
                          '_blank',
                          'noopener,noreferrer'
                        );
                      }}
                      className="w-full py-2 rounded-2xl border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Zerodha login (get request token)
                    </button>
                  )}
                  {selectedBroker === 'webull' && (
                    <p className="text-[10px] text-slate-500">
                      After Save, approve the login request in the Webull app if prompted (same as classic).
                    </p>
                  )}
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
