/**
 * Portfolio_V1 — parallel redesign (classic PortfolioView untouched).
 *
 * Confirmed product direction:
 * - Almost all classic features over time
 * - Connect-broker modal (single flow) is good
 * - eToro Sasi / Raj = separate portfolios
 * - Webull / Moomoo / Tiger = multi-portfolio each
 * - Stop loss mainly for eToro CFDs
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
  Link2,
  Wallet,
  ShieldAlert,
  Layers,
} from 'lucide-react';

type BrokerType = 'etoro' | 'ig' | 'webull' | 'zerodha' | 'groww';

interface Props {
  isReadOnly?: boolean;
  isDataLoading?: boolean;
  baseCurrency?: string;
  portfolios?: any[];
  portfolioMode?: string;
  portfolioHoldings?: any[];
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
      { key: 'access_token', label: 'Access Token (optional)', placeholder: 'Paste daily token if you have one' },
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
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
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
  if (inv <= 0) return 0;
  return (pnl(h) / inv) * 100;
}

function dayChangePct(h: any): number | null {
  const live = Number(h.live_price);
  const prev = Number(h.previous_close);
  if (!Number.isFinite(live) || !Number.isFinite(prev) || prev <= 0) return null;
  return ((live - prev) / prev) * 100;
}

/** Distance from live price to stop loss (%). Negative = already through stop. Long only heuristic. */
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

export default function PortfolioV1View({
  isReadOnly,
  isDataLoading,
  baseCurrency = 'INR',
  portfolios = [],
  portfolioMode,
  portfolioHoldings = [],
  portfolioCashBalances = [],
  portfolioBrokerConnections = [],
  setPortfolioBrokerConnection,
}: Props) {
  const [brokerFilter, setBrokerFilter] = useState<string>('All');
  const [portfolioFilter, setPortfolioFilter] = useState<string>('All'); // portfolio id or 'All'
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<'pick' | 'creds'>('pick');
  const [selectedBroker, setSelectedBroker] = useState<BrokerType | null>(null);
  const [connectPortfolioId, setConnectPortfolioId] = useState<string>('');
  const [credFields, setCredFields] = useState<Record<string, string>>({});
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectOk, setConnectOk] = useState<string | null>(null);
  const [holdingsExpanded, setHoldingsExpanded] = useState(true);
  const [showSlOnly, setShowSlOnly] = useState(false);

  const multiPortfolio = portfolioMode === 'multiple' || (portfolios || []).length > 1;

  const active = useMemo(
    () => (portfolioHoldings || []).filter((h: any) => h.status === 'active' || !h.status),
    [portfolioHoldings]
  );

  const brokersPresent = useMemo(() => {
    const s = new Set<string>();
    active.forEach((h: any) => {
      if (h.broker) s.add(String(h.broker));
    });
    return Array.from(s).sort();
  }, [active]);

  const portfoliosPresent = useMemo(() => {
    // Only portfolios that actually have active holdings (or all defined portfolios in multi mode)
    const ids = new Set<string>();
    active.forEach((h: any) => {
      if (h.portfolio_id) ids.add(h.portfolio_id);
    });
    const list = (portfolios || []).filter((p: any) => ids.has(p.id) || multiPortfolio);
    // Dedupe by id
    const seen = new Set<string>();
    return list.filter((p: any) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [active, portfolios, multiPortfolio]);

  const filtered = useMemo(() => {
    return active.filter((h: any) => {
      if (brokerFilter !== 'All' && String(h.broker) !== brokerFilter) return false;
      if (portfolioFilter !== 'All' && String(h.portfolio_id || '') !== portfolioFilter) return false;
      if (showSlOnly && (h.stop_loss_rate == null || Number(h.stop_loss_rate) <= 0)) return false;
      return true;
    });
  }, [active, brokerFilter, portfolioFilter, showSlOnly]);

  const summary = useMemo(() => {
    const byCurrency: Record<
      string,
      { invested: number; market: number; pnl: number; dayPnl: number; dayBasis: number; count: number }
    > = {};
    let inv = 0;
    let mv = 0;
    let day = 0;
    let dayBasis = 0;

    filtered.forEach((h: any) => {
      const ccy = String(h.currency || baseCurrency || 'INR').toUpperCase();
      if (!byCurrency[ccy]) {
        byCurrency[ccy] = { invested: 0, market: 0, pnl: 0, dayPnl: 0, dayBasis: 0, count: 0 };
      }
      const invH = invested(h);
      const mvH = marketValue(h);
      inv += invH;
      mv += mvH;
      byCurrency[ccy].invested += invH;
      byCurrency[ccy].market += mvH;
      byCurrency[ccy].pnl += mvH - invH;
      byCurrency[ccy].count += 1;
      const d = dayChangePct(h);
      if (d != null) {
        day += (d / 100) * mvH;
        dayBasis += mvH;
        byCurrency[ccy].dayPnl += (d / 100) * mvH;
        byCurrency[ccy].dayBasis += mvH;
      }
    });

    const currencyTiles = Object.entries(byCurrency)
      .map(([currency, v]) => ({
        currency,
        invested: v.invested,
        market: v.market,
        total: v.market,
        pnl: v.pnl,
        pnlPct: v.invested > 0 ? (v.pnl / v.invested) * 100 : 0,
        dayPnl: v.dayPnl,
        dayPct: v.dayBasis > 0 ? (v.dayPnl / v.dayBasis) * 100 : 0,
        count: v.count,
      }))
      .sort((a, b) => b.market - a.market);

    return {
      invested: inv,
      market: mv,
      total: mv,
      pnl: mv - inv,
      pnlPct: inv > 0 ? ((mv - inv) / inv) * 100 : 0,
      dayPnl: day,
      dayPct: dayBasis > 0 ? (day / dayBasis) * 100 : 0,
      count: filtered.length,
      currencyTiles,
      multiCurrency: currencyTiles.length > 1,
    };
  }, [filtered, baseCurrency]);

  const ranked = useMemo(() => {
    const withPnl = filtered
      .map((h: any) => ({ h, p: pnlPct(h), dollar: pnl(h) }))
      .filter((x) => Number.isFinite(x.p));
    return {
      gainers: [...withPnl].sort((a, b) => b.p - a.p).slice(0, 5),
      losers: [...withPnl].sort((a, b) => a.p - b.p).slice(0, 5),
    };
  }, [filtered]);

  const allocation = useMemo(() => {
    // Prefer portfolio breakdown when multi-portfolio; else broker
    const by: Record<string, number> = {};
    filtered.forEach((h: any) => {
      const key = multiPortfolio ? portfolioNameOf(h, portfolios) : String(h.broker || 'Other');
      by[key] = (by[key] || 0) + marketValue(h);
    });
    const total = Object.values(by).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(by)
      .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, multiPortfolio, portfolios]);

  const stopLossAlerts = useMemo(() => {
    return filtered
      .map((h: any) => {
        const dist = stopLossDistancePct(h);
        if (dist == null) return null;
        return { h, dist, stop: Number(h.stop_loss_rate) };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.dist - b.dist) as { h: any; dist: number; stop: number }[];
  }, [filtered]);

  const tightStops = stopLossAlerts.filter((x) => x.dist < 8);

  const openConnect = () => {
    setConnectOpen(true);
    setConnectStep('pick');
    setSelectedBroker(null);
    setCredFields({});
    setConnectError(null);
    setConnectOk(null);
    setConnectPortfolioId(portfolios?.[0]?.id || '');
  };

  const pickBroker = (b: BrokerType) => {
    setSelectedBroker(b);
    setCredFields({});
    setConnectError(null);
    setConnectStep('creds');
  };

  const saveConnection = async () => {
    if (!selectedBroker || !setPortfolioBrokerConnection) return;
    setConnectBusy(true);
    setConnectError(null);
    setConnectOk(null);
    try {
      const meta = BROKER_META[selectedBroker];
      const missing = meta.fields.filter(
        (f) => f.key !== 'access_token' && !String(credFields[f.key] || '').trim()
      );
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
        setConnectOk(`Groww connected${portfolioId ? ' to selected portfolio' : ''}. Sync from classic Portfolio for now.`);
      } else {
        await setPortfolioBrokerConnection(selectedBroker, { ...credFields }, portfolioId, label);
        setConnectOk(`${label} connection saved. Sync from classic Portfolio for now.`);
      }
      setConnectStep('pick');
      setSelectedBroker(null);
    } catch (e: any) {
      setConnectError(e?.message || 'Could not save connection');
    } finally {
      setConnectBusy(false);
    }
  };

  const barColor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('groww')) return 'bg-emerald-500';
    if (n.includes('zerodha')) return 'bg-blue-500';
    if (n.includes('etoro')) return 'bg-teal-500';
    if (n.includes('webull')) return 'bg-violet-500';
    if (n.includes('sasi')) return 'bg-teal-500';
    if (n.includes('raj')) return 'bg-cyan-500';
    return 'bg-slate-400';
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 pb-28 sm:pb-10 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pt-2">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-500" />
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Portfolio
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
                V1 preview
              </span>
            </h1>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Multi-portfolio · currency-aware · stop-loss for eToro · classic Portfolio untouched
          </p>
        </div>
        <button
          type="button"
          onClick={openConnect}
          disabled={isReadOnly}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-sm disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Connect broker</span>
          <span className="sm:hidden">Connect</span>
        </button>
      </div>

      {isDataLoading && (
        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading holdings…
        </div>
      )}

      {/* Row 1 — Portfolios (Sasi / Raj / Webull AU / …) */}
      {multiPortfolio && portfoliosPresent.length > 0 && (
        <div className="-mx-3 sm:mx-0 px-3 sm:px-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <span className="shrink-0 text-[8px] font-black uppercase tracking-wider text-slate-400 mr-0.5">
              Portfolio
            </span>
            <button
              type="button"
              onClick={() => setPortfolioFilter('All')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold ${
                portfolioFilter === 'All'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              All portfolios
            </button>
            {portfoliosPresent.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPortfolioFilter(p.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold ${
                  portfolioFilter === p.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Row 2 — Brokers */}
      <div className="-mx-3 sm:mx-0 px-3 sm:px-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <span className="shrink-0 text-[8px] font-black uppercase tracking-wider text-slate-400 mr-0.5">
            Broker
          </span>
          <button
            type="button"
            onClick={() => setBrokerFilter('All')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold ${
              brokerFilter === 'All'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            All brokers
          </button>
          {brokersPresent.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrokerFilter(b)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold ${
                brokerFilter === b
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {b}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowSlOnly((v) => !v)}
            className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold ${
              showSlOnly
                ? 'bg-amber-500 text-white'
                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            Stop loss
          </button>
        </div>
      </div>

      {/* Tight stop-loss strip (eToro CFDs) */}
      {tightStops.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Near stop loss ({tightStops.length})
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {tightStops.slice(0, 8).map(({ h, dist, stop }) => (
              <div
                key={h.id}
                className="shrink-0 rounded-xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/40 px-2.5 py-1.5 min-w-[7.5rem]"
              >
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">
                  {h.ticker || h.symbol}
                </p>
                <p className="text-[9px] text-slate-400 truncate">
                  {portfolioNameOf(h, portfolios)} · SL {stop}
                </p>
                <p
                  className={`text-[11px] font-black tabular-nums ${
                    dist < 0 ? 'text-rose-600' : dist < 3 ? 'text-amber-600' : 'text-slate-600'
                  }`}
                >
                  {dist < 0 ? 'Past SL' : `${dist.toFixed(1)}% away`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary — multi-currency tiles when needed */}
      {summary.multiCurrency ? (
        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            Values by currency · not converted to {baseCurrency}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {summary.currencyTiles.map((tile) => (
              <div
                key={tile.currency}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {tile.currency}
                  </span>
                  <span className="text-[10px] text-slate-400">{tile.count} holdings</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total value</p>
                    <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {money(tile.total, tile.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Invested</p>
                    <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {money(tile.invested, tile.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unrealised P&amp;L</p>
                    <p
                      className={`text-base sm:text-lg font-black mt-0.5 tabular-nums ${
                        tile.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {money(tile.pnl, tile.currency)}
                    </p>
                    <p className={`text-[10px] font-bold ${tile.pnlPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {pct(tile.pnlPct)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Day move</p>
                    <p
                      className={`text-base sm:text-lg font-black mt-0.5 tabular-nums ${
                        tile.dayPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {money(tile.dayPnl, tile.currency)}
                    </p>
                    <p className={`text-[10px] font-bold ${tile.dayPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {pct(tile.dayPct)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {(() => {
            const ccy = summary.currencyTiles[0]?.currency || baseCurrency;
            return (
              <>
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 col-span-2 sm:col-span-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total value</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                    {money(summary.total, ccy)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">{summary.count} holdings</p>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Invested</p>
                  <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                    {money(summary.invested, ccy)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unrealised P&amp;L</p>
                  <p
                    className={`text-lg sm:text-xl font-black mt-1 tabular-nums ${
                      summary.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {money(summary.pnl, ccy)}
                  </p>
                  <p className={`text-[10px] font-bold ${summary.pnlPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {pct(summary.pnlPct)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Day move</p>
                  <p
                    className={`text-lg sm:text-xl font-black mt-1 tabular-nums ${
                      summary.dayPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {money(summary.dayPnl, ccy)}
                  </p>
                  <p className={`text-[10px] font-bold ${summary.dayPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {pct(summary.dayPct)}
                  </p>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Gainers / Losers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Top gainers
            </h2>
          </div>
          {ranked.gainers.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-4 text-center">No holdings yet</p>
          ) : (
            <ul className="space-y-1.5">
              {ranked.gainers.map(({ h, p, dollar }) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100 truncate">
                      {h.ticker || h.symbol}
                    </p>
                    <p className="text-[9px] text-slate-400 truncate">
                      {multiPortfolio ? portfolioNameOf(h, portfolios) : h.broker}
                      {h.holding_type === 'mutual_fund' ? ' · MF' : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-black text-emerald-600 tabular-nums">{pct(p)}</p>
                    <p className="text-[9px] text-emerald-600/80 tabular-nums">
                      {moneyPrecise(dollar, h.currency || baseCurrency)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="w-4 h-4 text-rose-500" />
            <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Top losers
            </h2>
          </div>
          {ranked.losers.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-4 text-center">No holdings yet</p>
          ) : (
            <ul className="space-y-1.5">
              {ranked.losers.map(({ h, p, dollar }) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100 truncate">
                      {h.ticker || h.symbol}
                    </p>
                    <p className="text-[9px] text-slate-400 truncate">
                      {multiPortfolio ? portfolioNameOf(h, portfolios) : h.broker}
                      {h.holding_type === 'mutual_fund' ? ' · MF' : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-black text-rose-600 tabular-nums">{pct(p)}</p>
                    <p className="text-[9px] text-rose-600/80 tabular-nums">
                      {moneyPrecise(dollar, h.currency || baseCurrency)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Allocation by portfolio (or broker) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Layers className="w-4 h-4 text-indigo-500" />
          <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {multiPortfolio ? 'By portfolio' : 'By broker'}
          </h2>
        </div>
        {allocation.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-3">Nothing to allocate yet</p>
        ) : (
          <div className="space-y-2">
            {allocation.map((a) => (
              <div key={a.name}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{a.name}</span>
                  <span className="tabular-nums text-slate-500">{a.pct.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor(a.name)}`}
                    style={{ width: `${Math.max(a.pct, 1)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connections */}
      {(portfolioBrokerConnections || []).length > 0 && (
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Connected</p>
          <div className="flex flex-wrap gap-1.5">
            {(portfolioBrokerConnections || []).map((c: any) => {
              const pName = c.portfolio_id
                ? portfolios.find((p: any) => p.id === c.portfolio_id)?.name
                : null;
              return (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
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

      {/* Holdings table with stop loss */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <button
          type="button"
          onClick={() => setHoldingsExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-3 sm:px-4 py-3 text-left"
        >
          <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Holdings ({filtered.length})
          </h2>
          <ChevronRight
            className={`w-4 h-4 text-slate-400 transition-transform ${holdingsExpanded ? 'rotate-90' : ''}`}
          />
        </button>
        {holdingsExpanded && (
          <div className="border-t border-slate-100 dark:border-slate-800 max-h-[32rem] overflow-auto">
            {/* Desktop header */}
            <div className="hidden sm:grid grid-cols-[minmax(7rem,1.4fr)_repeat(6,minmax(0,1fr))] gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
              <span>Symbol</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Live</span>
              <span className="text-right">Value</span>
              <span className="text-right">P&amp;L</span>
              <span className="text-right">Stop loss</span>
              <span className="text-right">Lev</span>
            </div>
            {filtered.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-8">No holdings for this filter</p>
            ) : (
              filtered
                .slice()
                .sort((a: any, b: any) => marketValue(b) - marketValue(a))
                .map((h: any) => {
                  const p = pnlPct(h);
                  const d = dayChangePct(h);
                  const stop = h.stop_loss_rate != null ? Number(h.stop_loss_rate) : null;
                  const dist = stopLossDistancePct(h);
                  const lev = h.leverage != null ? Number(h.leverage) : null;
                  const ccy = h.currency || baseCurrency;
                  return (
                    <div
                      key={h.id}
                      className="px-3 sm:px-4 py-2.5 border-b border-slate-50 dark:border-slate-800/80 sm:grid sm:grid-cols-[minmax(7rem,1.4fr)_repeat(6,minmax(0,1fr))] sm:gap-2 sm:items-center"
                    >
                      <div className="min-w-0 flex items-start justify-between gap-2 sm:block">
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-slate-900 dark:text-white truncate">
                            {h.ticker || h.symbol}
                          </p>
                          <p className="text-[9px] text-slate-400 truncate">
                            {multiPortfolio ? portfolioNameOf(h, portfolios) : h.broker}
                            {h.broker && multiPortfolio ? ` · ${h.broker}` : ''}
                            {h.holding_type === 'mutual_fund'
                              ? ' · MF'
                              : h.holding_type === 'options'
                                ? ' · Options'
                                : ''}
                          </p>
                        </div>
                        {/* Mobile-only P&L */}
                        <div className="sm:hidden text-right shrink-0">
                          <p className="text-[12px] font-bold text-slate-900 dark:text-white tabular-nums">
                            {money(marketValue(h), ccy)}
                          </p>
                          <p className={`text-[10px] font-bold tabular-nums ${p >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {pct(p)}
                          </p>
                        </div>
                      </div>
                      <p className="hidden sm:block text-right text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                        {Number(h.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </p>
                      <p className="hidden sm:block text-right text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                        {moneyPrecise(livePrice(h), ccy)}
                        {d != null && (
                          <span className={`block text-[9px] font-bold ${d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {pct(d)}
                          </span>
                        )}
                      </p>
                      <p className="hidden sm:block text-right text-[11px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
                        {money(marketValue(h), ccy)}
                      </p>
                      <p
                        className={`hidden sm:block text-right text-[11px] font-bold tabular-nums ${
                          p >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {pct(p)}
                      </p>
                      <div className="hidden sm:block text-right">
                        {stop != null && stop > 0 ? (
                          <>
                            <p className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200">
                              {moneyPrecise(stop, ccy)}
                            </p>
                            {dist != null && (
                              <p
                                className={`text-[9px] font-bold tabular-nums ${
                                  dist < 0 ? 'text-rose-600' : dist < 5 ? 'text-amber-600' : 'text-slate-400'
                                }`}
                              >
                                {dist < 0 ? 'Past SL' : `${dist.toFixed(1)}% away`}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </div>
                      <p className="hidden sm:block text-right text-[11px] tabular-nums text-slate-500">
                        {lev != null && lev > 1 ? `${lev}x` : '—'}
                      </p>
                      {/* Mobile stop loss line */}
                      {stop != null && stop > 0 && (
                        <p className="sm:hidden mt-1 text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                          SL {moneyPrecise(stop, ccy)}
                          {dist != null ? ` · ${dist < 0 ? 'past stop' : `${dist.toFixed(1)}% away`}` : ''}
                          {lev != null && lev > 1 ? ` · ${lev}x` : ''}
                        </p>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>

      {/* Connect broker modal */}
      {connectOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {connectStep === 'pick' ? 'Connect a broker' : `Connect ${BROKER_META[selectedBroker!]?.label}`}
              </h3>
              <button
                type="button"
                onClick={() => setConnectOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {connectOk && (
                <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl px-3 py-2">
                  {connectOk}
                </div>
              )}
              {connectError && (
                <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2">
                  {connectError}
                </div>
              )}

              {connectStep === 'pick' && (
                <>
                  <p className="text-[11px] text-slate-500">
                    Pick a broker, choose which portfolio it belongs to (e.g. eToro Sasi vs Raj, or another
                    Webull account), then enter keys.
                  </p>
                  {multiPortfolio && (portfolios || []).length > 0 && (
                    <label className="block">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Link to portfolio
                      </span>
                      <select
                        value={connectPortfolioId}
                        onChange={(e) => setConnectPortfolioId(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                      >
                        <option value="">No specific portfolio</option>
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
                          onClick={() => pickBroker(key)}
                          className={`text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:ring-2 ${m.ring} ${m.bg}`}
                        >
                          <p className={`text-[13px] font-black ${m.color}`}>{m.label}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">API key connection</p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {connectStep === 'creds' && selectedBroker && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setConnectStep('pick');
                      setSelectedBroker(null);
                    }}
                    className="text-[10px] font-bold text-indigo-600"
                  >
                    ← Change broker
                  </button>
                  {BROKER_META[selectedBroker].fields.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{f.label}</span>
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
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-black disabled:opacity-50"
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
