/**
 * P&L Calendar — daily snapshots from portfolio_daily_positions.
 * Day P&L computed on read (lag market_value by holding), never summed across currencies.
 */
import React, { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';

export type DailyPositionRow = {
  id?: string;
  workspace_id?: string;
  portfolio_id?: string | null;
  holding_id?: string | null;
  snapshot_date: string;
  symbol: string;
  broker?: string | null;
  holding_type?: string | null;
  quantity: number;
  mark_price: number;
  market_value: number;
  cost_basis?: number | null;
  currency: string;
};

type DayAgg = {
  date: string;
  currency: string;
  /** null = baseline day (first snapshot, no prior close to compare) */
  dayPnl: number | null;
  marketValue: number;
  symbolCount: number;
  symbols: { symbol: string; dayPnl: number | null; marketValue: number; broker?: string | null }[];
};

function money(n: number, ccy: string) {
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: ccy || 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toFixed(0)} ${ccy}`;
  }
}

function moneyFine(n: number, ccy: string) {
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: ccy || 'USD',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${ccy}`;
  }
}

/** Build per-day, per-currency aggregates. First snapshot day has dayPnl=null (baseline). */
export function buildDayAggregates(rows: DailyPositionRow[]): DayAgg[] {
  const byHolding = new Map<string, DailyPositionRow[]>();
  for (const r of rows) {
    const key = String(r.holding_id || `${r.symbol}|${r.currency}|${r.portfolio_id || ''}`);
    if (!byHolding.has(key)) byHolding.set(key, []);
    byHolding.get(key)!.push(r);
  }

  const map = new Map<string, DayAgg>();

  const ensure = (date: string, currency: string) => {
    const k = `${date}|${currency}`;
    if (!map.has(k)) {
      map.set(k, {
        date,
        currency,
        dayPnl: 0,
        marketValue: 0,
        symbolCount: 0,
        symbols: [],
      });
    }
    return map.get(k)!;
  };

  // Track whether any lag-based pnl was applied for a day
  const hasLagPnl = new Set<string>();

  for (const list of byHolding.values()) {
    list.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      const ccy = String(cur.currency || 'USD').toUpperCase();
      const agg = ensure(cur.snapshot_date, ccy);
      const mv = Number(cur.market_value);
      if (Number.isFinite(mv)) agg.marketValue += mv;
      agg.symbolCount += 1;

      const prev = i > 0 ? list[i - 1] : null;
      if (!prev) {
        agg.symbols.push({
          symbol: cur.symbol,
          dayPnl: null,
          marketValue: mv,
          broker: cur.broker,
        });
        continue;
      }
      const dayPnl = Number(cur.market_value) - Number(prev.market_value);
      if (!Number.isFinite(dayPnl)) continue;
      const k = `${cur.snapshot_date}|${ccy}`;
      hasLagPnl.add(k);
      if (agg.dayPnl == null) agg.dayPnl = 0;
      agg.dayPnl = (agg.dayPnl || 0) + dayPnl;
      agg.symbols.push({
        symbol: cur.symbol,
        dayPnl,
        marketValue: mv,
        broker: cur.broker,
      });
    }
  }

  // Mark pure baseline days (no lag contribution) as dayPnl = null
  for (const [k, agg] of map.entries()) {
    if (!hasLagPnl.has(k)) {
      agg.dayPnl = null;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

interface Props {
  rows: DailyPositionRow[];
  loading?: boolean;
  currencies: string[];
  selectedCurrency: string;
  onCurrencyChange: (ccy: string) => void;
  /** Books to filter by (eToro Raj, Zerodha, ...). Optional. */
  portfolios?: { id: string; name: string; currency?: string }[];
  selectedPortfolioId?: string; // 'all' or portfolio uuid
  onPortfolioChange?: (id: string) => void;
  portfolioLabel?: string;
  onRefreshSnapshot?: () => Promise<void>;
  onReload?: () => Promise<void>;
  canSnapshot?: boolean;
}

export default function PortfolioPnLCalendar({
  rows,
  loading,
  currencies,
  selectedCurrency,
  onCurrencyChange,
  portfolios = [],
  selectedPortfolioId = 'all',
  onPortfolioChange,
  portfolioLabel,
  onRefreshSnapshot,
  onReload,
  canSnapshot = true,
}: Props) {
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [snapBusy, setSnapBusy] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedPortfolioId && selectedPortfolioId !== 'all') {
        if (String(r.portfolio_id || '') !== String(selectedPortfolioId)) return false;
      }
      return String(r.currency || '').toUpperCase() === selectedCurrency.toUpperCase();
    });
  }, [rows, selectedCurrency, selectedPortfolioId]);

  // Currencies available for the selected book (or all books)
  const currenciesForBook = useMemo(() => {
    const scoped =
      selectedPortfolioId && selectedPortfolioId !== 'all'
        ? rows.filter((r) => String(r.portfolio_id || '') === String(selectedPortfolioId))
        : rows;
    const set = new Set(
      scoped.map((r) => String(r.currency || '').toUpperCase()).filter(Boolean)
    );
    // fall back to parent list if no rows yet
    if (set.size === 0) currencies.forEach((c) => set.add(c));
    return Array.from(set).sort();
  }, [rows, selectedPortfolioId, currencies]);

  const aggs = useMemo(() => buildDayAggregates(filteredRows), [filteredRows]);

  const byDate = useMemo(() => {
    const m = new Map<string, DayAgg>();
    aggs.forEach((a) => m.set(a.date, a));
    return m;
  }, [aggs]);

  const distinctDates = useMemo(
    () => Array.from(new Set(filteredRows.map((r) => r.snapshot_date))).sort(),
    [filteredRows]
  );

  const monthLabel = useMemo(() => {
    const d = new Date(cursor.y, cursor.m, 1);
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }, [cursor]);

  const monthCells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: { date: string | null; day: number | null }[] = [];
    for (let i = 0; i < startPad; i++) cells.push({ date: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date, day: d });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
    return cells;
  }, [cursor]);

  const yearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const prefix = `${cursor.y}-${String(m + 1).padStart(2, '0')}`;
      let sum = 0;
      let count = 0;
      let hasPnl = false;
      byDate.forEach((agg, date) => {
        if (date.startsWith(prefix)) {
          count += 1;
          if (agg.dayPnl != null) {
            sum += agg.dayPnl;
            hasPnl = true;
          }
        }
      });
      return { m, label: new Date(cursor.y, m, 1).toLocaleString(undefined, { month: 'short' }), sum, count, hasPnl };
    });
  }, [cursor.y, byDate]);

  const monthTotal = useMemo(() => {
    const prefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`;
    let sum = 0;
    let has = false;
    byDate.forEach((agg, date) => {
      if (date.startsWith(prefix) && agg.dayPnl != null) {
        sum += agg.dayPnl;
        has = true;
      }
    });
    return has ? sum : null;
  }, [cursor, byDate]);

  const drill = selectedDay ? byDate.get(selectedDay) : null;

  const shift = (dir: number) => {
    if (mode === 'month') {
      const d = new Date(cursor.y, cursor.m + dir, 1);
      setCursor({ y: d.getFullYear(), m: d.getMonth() });
      setSelectedDay(null);
    } else {
      setCursor((c) => ({ ...c, y: c.y + dir }));
      setSelectedDay(null);
    }
  };

  const runSnap = async () => {
    if (!onRefreshSnapshot) return;
    setSnapBusy(true);
    setSnapError(null);
    try {
      await onRefreshSnapshot();
      await onReload?.();
    } catch (e: any) {
      setSnapError(e?.message || String(e));
    } finally {
      setSnapBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-black text-slate-900 dark:text-white">P&L Calendar</h3>
          {portfolioLabel && (
            <span className="text-[10px] font-bold text-slate-400">{portfolioLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {portfolios.length > 0 && onPortfolioChange && (
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-violet-100/80 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-900/50 max-w-full overflow-x-auto no-scrollbar">
              <span className="px-1.5 text-[8px] font-black uppercase tracking-wider text-violet-600/80 dark:text-violet-400/80 shrink-0">
                Book
              </span>
              <button
                type="button"
                onClick={() => onPortfolioChange('all')}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  selectedPortfolioId === 'all'
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-violet-800/70 dark:text-violet-300/70'
                }`}
              >
                All
              </button>
              {portfolios.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPortfolioChange(p.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold max-w-[9rem] truncate ${
                    selectedPortfolioId === p.id
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-violet-800/70 dark:text-violet-300/70'
                  }`}
                  title={p.name}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {currenciesForBook.length > 0 && (
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/50">
              <span className="px-1.5 text-[8px] font-black uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80 shrink-0">
                Ccy
              </span>
              {currenciesForBook.map((ccy) => (
                <button
                  key={ccy}
                  type="button"
                  onClick={() => onCurrencyChange(ccy)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    selectedCurrency === ccy
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-emerald-800/70 dark:text-emerald-300/70'
                  }`}
                >
                  {ccy}
                </button>
              ))}
            </div>
          )}
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMode('month')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                mode === 'month' ? 'bg-violet-600 text-white' : 'text-slate-500'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setMode('year')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                mode === 'year' ? 'bg-violet-600 text-white' : 'text-slate-500'
              }`}
            >
              Year
            </button>
          </div>
          {canSnapshot && onRefreshSnapshot && (
            <button
              type="button"
              disabled={snapBusy}
              onClick={runSnap}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-600 text-white disabled:opacity-50"
              title="Capture today's positions into the daily snapshot table"
            >
              <RefreshCw className={`w-3 h-3 ${snapBusy ? 'animate-spin' : ''}`} />
              Snapshot now
            </button>
          )}
        </div>
      </div>

      {/* Book filter — own row, horizontal scroll (many portfolios) */}
      {portfolios.length > 0 && onPortfolioChange && (
        <div className="min-w-0 w-full">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-violet-500/80 w-10">
              Book
            </span>
            <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar overscroll-x-contain touch-pan-x">
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-violet-100/80 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-900/50 w-max max-w-none">
                <button
                  type="button"
                  onClick={() => onPortfolioChange('all')}
                  className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold ${
                    selectedPortfolioId === 'all'
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                      : 'text-violet-800/70 dark:text-violet-300/70'
                  }`}
                >
                  All
                </button>
                {portfolios.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPortfolioChange(p.id)}
                    className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold max-w-[8.5rem] truncate ${
                      selectedPortfolioId === p.id
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                        : 'text-violet-800/70 dark:text-violet-300/70'
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

      {/* Currency filter — scroll if many */}
      {currenciesForBook.length > 0 && (
        <div className="min-w-0 w-full">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-500/80 w-10">
              Ccy
            </span>
            <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/50 w-max">
                {currenciesForBook.map((ccy) => (
                  <button
                    key={ccy}
                    type="button"
                    onClick={() => onCurrencyChange(ccy)}
                    className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold ${
                      selectedCurrency === ccy
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                        : 'text-emerald-800/70 dark:text-emerald-300/70'
                    }`}
                  >
                    {ccy}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data status banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-[10px] text-slate-500 space-y-0.5">
        <p>
          <span className="font-bold text-slate-700 dark:text-slate-200">{filteredRows.length}</span> snapshot rows ·{' '}
          <span className="font-bold text-slate-700 dark:text-slate-200">{distinctDates.length}</span> day(s)
          {selectedPortfolioId && selectedPortfolioId !== 'all' && (
            <> · <span className="font-bold text-violet-600 dark:text-violet-300">
              {portfolios.find((p) => p.id === selectedPortfolioId)?.name || 'book'}
            </span></>
          )}
          {' '}· <span className="font-bold">{selectedCurrency}</span>
          {distinctDates.length > 0 && (
            <> · latest <span className="font-bold">{distinctDates[distinctDates.length - 1]}</span></>
          )}
        </p>
        {distinctDates.length === 0 && (
          <p>
            No rows in <code className="text-[9px]">portfolio_daily_positions</code> yet. Tap <span className="font-bold">Snapshot now</span> after prices are fresh, or wait for market-close cron.
          </p>
        )}
        {distinctDates.length === 1 && (
          <p>
            Only <span className="font-bold">1 trading day</span> captured. Day P&L needs a <span className="font-bold">second day</span> to compare. Today's cells show portfolio value (baseline); green/red P&L appears from day 2 onward.
          </p>
        )}
        {snapError && <p className="text-rose-600 font-bold">Snapshot failed: {snapError}</p>}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {mode === 'month' ? monthLabel : String(cursor.y)}
          </p>
          {mode === 'month' && (
            <p
              className={`text-[11px] font-bold tabular-nums ${
                monthTotal == null ? 'text-slate-400' : monthTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {monthTotal == null ? 'No day P&L yet this month' : `${money(monthTotal, selectedCurrency)} month net`}
            </p>
          )}
        </div>
        <button type="button" onClick={() => shift(1)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <p className="text-[12px] text-slate-400 flex items-center gap-2 py-8 justify-center">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading snapshots...
        </p>
      ) : mode === 'month' ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="px-1 py-1.5 text-center text-[9px] font-black uppercase text-slate-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((c, i) => {
              if (!c.date) {
                return <div key={`e-${i}`} className="min-h-[64px] border-t border-r border-slate-50 dark:border-slate-800/50 bg-slate-50/40 dark:bg-slate-950/30" />;
              }
              const agg = byDate.get(c.date);
              const selected = selectedDay === c.date;
              const pnl = agg?.dayPnl;
              return (
                <button
                  key={c.date}
                  type="button"
                  onClick={() => agg && setSelectedDay(c.date)}
                  className={`min-h-[64px] border-t border-r border-slate-50 dark:border-slate-800/50 p-1.5 text-left transition-colors ${
                    selected ? 'bg-violet-50 dark:bg-violet-950/40 ring-2 ring-inset ring-violet-500' : agg ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40' : ''
                  }`}
                >
                  <p className="text-[10px] font-bold text-slate-500">{c.day}</p>
                  {agg && pnl != null ? (
                    <p
                      className={`text-[10px] sm:text-[11px] font-black tabular-nums mt-0.5 leading-tight ${
                        pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {pnl >= 0 ? '+' : ''}
                      {Math.abs(pnl) >= 1000 ? money(pnl, selectedCurrency) : moneyFine(pnl, selectedCurrency)}
                    </p>
                  ) : agg ? (
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                      {money(agg.marketValue, selectedCurrency)}
                      <span className="block text-[8px] opacity-70">baseline</span>
                    </p>
                  ) : (
                    <p className="text-[9px] text-slate-300 dark:text-slate-600 mt-1">—</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {yearMonths.map((ym) => (
            <button
              key={ym.m}
              type="button"
              onClick={() => {
                setCursor({ y: cursor.y, m: ym.m });
                setMode('month');
              }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-left hover:ring-2 hover:ring-violet-400/40"
            >
              <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">{ym.label}</p>
              <p
                className={`text-[13px] font-black tabular-nums mt-1 ${
                  ym.count === 0 ? 'text-slate-300' : !ym.hasPnl ? 'text-slate-500' : ym.sum >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {ym.count === 0 ? '—' : ym.hasPnl ? money(ym.sum, selectedCurrency) : `${ym.count}d snap`}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">{ym.count} days</p>
            </button>
          ))}
        </div>
      )}

      {drill && (
        <div className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/40 dark:bg-violet-950/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black text-slate-900 dark:text-white">{drill.date}</p>
              {drill.dayPnl != null ? (
                <p
                  className={`text-sm font-black tabular-nums ${
                    drill.dayPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {drill.dayPnl >= 0 ? <TrendingUp className="inline w-3.5 h-3.5 mr-1" /> : <TrendingDown className="inline w-3.5 h-3.5 mr-1" />}
                  {moneyFine(drill.dayPnl, drill.currency)}
                </p>
              ) : (
                <p className="text-sm font-black tabular-nums text-slate-600 dark:text-slate-300">
                  {moneyFine(drill.marketValue, drill.currency)}{' '}
                  <span className="text-[10px] font-bold text-slate-400">value (baseline day)</span>
                </p>
              )}
            </div>
            <button type="button" onClick={() => setSelectedDay(null)} className="text-[10px] font-bold text-slate-400">
              Close
            </button>
          </div>
          <ul className="divide-y divide-slate-200/60 dark:divide-slate-800 max-h-56 overflow-y-auto">
            {[...drill.symbols]
              .sort((a, b) => Math.abs(b.dayPnl ?? 0) - Math.abs(a.dayPnl ?? 0))
              .map((s, i) => (
                <li key={`${s.symbol}-${i}`} className="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{s.symbol}</p>
                    {s.broker && <p className="text-[9px] text-slate-400">{s.broker}</p>}
                  </div>
                  <p
                    className={`font-black tabular-nums shrink-0 ${
                      s.dayPnl == null ? 'text-slate-500' : s.dayPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {s.dayPnl == null ? moneyFine(s.marketValue, drill.currency) : moneyFine(s.dayPnl, drill.currency)}
                  </p>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
