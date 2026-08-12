/**
 * Portfolio_V1 — parallel redesign for UI testing.
 * Does NOT replace PortfolioView. Same data props; new layout only.
 *
 * Sections:
 *  1. Summary strip — total value, invested, P&L, day move
 *  2. Broker chips — filter everything below
 *  3. Top gainers / losers
 *  4. Allocation by broker
 *  5. Holdings list (compact, mobile-friendly)
 *  6. Connect broker — single modal flow (pick → credentials → save)
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
  deletePortfolioBrokerConnection,
}: Props) {
  const [brokerFilter, setBrokerFilter] = useState<string>('All');
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<'pick' | 'creds'>('pick');
  const [selectedBroker, setSelectedBroker] = useState<BrokerType | null>(null);
  const [credFields, setCredFields] = useState<Record<string, string>>({});
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectOk, setConnectOk] = useState<string | null>(null);
  const [holdingsExpanded, setHoldingsExpanded] = useState(true);

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

  const filtered = useMemo(() => {
    if (brokerFilter === 'All') return active;
    return active.filter((h: any) => String(h.broker) === brokerFilter);
  }, [active, brokerFilter]);

  const summary = useMemo(() => {
    let inv = 0;
    let mv = 0;
    let day = 0;
    let dayBasis = 0;
    filtered.forEach((h: any) => {
      inv += invested(h);
      mv += marketValue(h);
      const d = dayChangePct(h);
      if (d != null) {
        const v = marketValue(h);
        day += (d / 100) * v;
        dayBasis += v;
      }
    });
    const cash = (portfolioCashBalances || [])
      .filter((c: any) => brokerFilter === 'All' || String(c.location || c.broker || '') === brokerFilter)
      .reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
    return {
      invested: inv,
      market: mv,
      cash,
      total: mv + cash,
      pnl: mv - inv,
      pnlPct: inv > 0 ? ((mv - inv) / inv) * 100 : 0,
      dayPnl: day,
      dayPct: dayBasis > 0 ? (day / dayBasis) * 100 : 0,
      count: filtered.length,
    };
  }, [filtered, portfolioCashBalances, brokerFilter]);

  const ranked = useMemo(() => {
    const withPnl = filtered
      .map((h: any) => ({ h, p: pnlPct(h), dollar: pnl(h) }))
      .filter((x) => Number.isFinite(x.p));
    const gainers = [...withPnl].sort((a, b) => b.p - a.p).slice(0, 5);
    const losers = [...withPnl].sort((a, b) => a.p - b.p).slice(0, 5);
    return { gainers, losers };
  }, [filtered]);

  const allocation = useMemo(() => {
    const by: Record<string, number> = {};
    filtered.forEach((h: any) => {
      const b = String(h.broker || 'Other');
      by[b] = (by[b] || 0) + marketValue(h);
    });
    const total = Object.values(by).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(by)
      .map(([broker, value]) => ({ broker, value, pct: (value / total) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const openConnect = () => {
    setConnectOpen(true);
    setConnectStep('pick');
    setSelectedBroker(null);
    setCredFields({});
    setConnectError(null);
    setConnectOk(null);
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
      const missing = meta.fields.filter((f) => !f.key.includes('optional') && !String(credFields[f.key] || '').trim() && f.key !== 'access_token');
      if (missing.length) {
        setConnectError(`Fill in: ${missing.map((m) => m.label).join(', ')}`);
        setConnectBusy(false);
        return;
      }

      // Validate via broker API where we have a clear exchange action
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
          undefined,
          'Groww'
        );
        setConnectOk('Groww connected. Use the classic Portfolio tab to Sync holdings for now.');
      } else if (selectedBroker === 'zerodha') {
        await setPortfolioBrokerConnection(
          'zerodha',
          {
            api_key: credFields.api_key?.trim() || '',
            api_secret: credFields.api_secret?.trim() || '',
            access_token: credFields.access_token?.trim() || '',
          },
          undefined,
          'Zerodha'
        );
        setConnectOk('Zerodha credentials saved. Complete daily token on classic Portfolio if needed, then Sync.');
      } else {
        await setPortfolioBrokerConnection(selectedBroker, { ...credFields }, undefined, meta.label);
        setConnectOk(`${meta.label} connection saved.`);
      }
      setConnectStep('pick');
      setSelectedBroker(null);
    } catch (e: any) {
      setConnectError(e?.message || 'Could not save connection');
    } finally {
      setConnectBusy(false);
    }
  };

  const brokerColor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('groww')) return 'bg-emerald-500';
    if (n.includes('zerodha')) return 'bg-blue-500';
    if (n.includes('etoro')) return 'bg-teal-500';
    if (n.includes('webull')) return 'bg-violet-500';
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
            Summary-first redesign · classic Portfolio stays untouched
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

      {/* Broker filter — horizontal scroll on mobile */}
      <div className="-mx-3 sm:mx-0 px-3 sm:px-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
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
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 col-span-2 sm:col-span-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total value</p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
            {money(summary.total, baseCurrency)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {summary.count} holdings
            {summary.cash > 0 ? ` · cash ${money(summary.cash, baseCurrency)}` : ''}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Invested</p>
          <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
            {money(summary.invested, baseCurrency)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unrealised P&amp;L</p>
          <p
            className={`text-lg sm:text-xl font-black mt-1 tabular-nums ${
              summary.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {money(summary.pnl, baseCurrency)}
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
            {money(summary.dayPnl, baseCurrency)}
          </p>
          <p className={`text-[10px] font-bold ${summary.dayPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {pct(summary.dayPct)}
          </p>
        </div>
      </div>

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
                      {h.broker}
                      {h.holding_type === 'mutual_fund' ? ' · MF' : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-black text-emerald-600 tabular-nums">{pct(p)}</p>
                    <p className="text-[9px] text-emerald-600/80 tabular-nums">{money(dollar, h.currency || baseCurrency)}</p>
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
                      {h.broker}
                      {h.holding_type === 'mutual_fund' ? ' · MF' : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-black text-rose-600 tabular-nums">{pct(p)}</p>
                    <p className="text-[9px] text-rose-600/80 tabular-nums">{money(dollar, h.currency || baseCurrency)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Allocation */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Wallet className="w-4 h-4 text-indigo-500" />
          <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            By broker
          </h2>
        </div>
        {allocation.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-3">Nothing to allocate yet</p>
        ) : (
          <div className="space-y-2">
            {allocation.map((a) => (
              <div key={a.broker}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{a.broker}</span>
                  <span className="tabular-nums text-slate-500">
                    {money(a.value, baseCurrency)} · {a.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${brokerColor(a.broker)}`}
                    style={{ width: `${Math.max(a.pct, 1)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connections strip */}
      {(portfolioBrokerConnections || []).length > 0 && (
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Connected</p>
          <div className="flex flex-wrap gap-1.5">
            {(portfolioBrokerConnections || []).map((c: any) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                <Link2 className="w-3 h-3" />
                {c.connection_label || c.broker_type}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Holdings */}
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
          <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 max-h-[28rem] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-8">No holdings for this filter</p>
            ) : (
              filtered
                .slice()
                .sort((a: any, b: any) => marketValue(b) - marketValue(a))
                .map((h: any) => {
                  const p = pnlPct(h);
                  const d = dayChangePct(h);
                  return (
                    <div key={h.id} className="px-3 sm:px-4 py-2.5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-slate-900 dark:text-white truncate">
                          {h.ticker || h.symbol}
                        </p>
                        <p className="text-[9px] text-slate-400 truncate">
                          {h.broker}
                          {h.holding_type === 'mutual_fund' ? ' · MF' : h.holding_type === 'options' ? ' · Options' : ''}
                          {' · '}
                          {Number(h.quantity).toLocaleString()} @ {Number(h.buy_price).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-bold text-slate-900 dark:text-white tabular-nums">
                          {money(marketValue(h), h.currency || baseCurrency)}
                        </p>
                        <p
                          className={`text-[10px] font-bold tabular-nums ${
                            p >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {pct(p)}
                          {d != null ? ` · d ${pct(d)}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>

      {/* Connect broker modal — single flow */}
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
                    One place for every broker — pick one, enter keys, done. Sync still runs from classic Portfolio
                    until V1 gains full sync actions.
                  </p>
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
