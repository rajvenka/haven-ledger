// Major index snapshot for the Portfolio > Markets section.
// One Yahoo chart call per index (5 daily bars) gives yesterday's close and today's open/high/low/last.
import { createClient } from "@supabase/supabase-js";

export const MARKETS = [
  { id: "IN", name: "India", indices: [["^NSEI", "NIFTY 50"], ["^BSESN", "SENSEX"], ["^NSEBANK", "BANK NIFTY"]] },
  { id: "US", name: "United States", indices: [["^GSPC", "S&P 500"], ["^IXIC", "NASDAQ"], ["^DJI", "DOW JONES"]] },
  { id: "EU", name: "Europe", indices: [["^GDAXI", "DAX"], ["^FTSE", "FTSE 100"], ["^STOXX50E", "EURO STOXX 50"]] },
  { id: "AU", name: "Australia", indices: [["^AXJO", "ASX 200"]] },
  { id: "JP", name: "Japan", indices: [["^N225", "NIKKEI 225"]] },
  { id: "HK", name: "Hong Kong", indices: [["^HSI", "HANG SENG"]] },
] as const;

export type IndexQuote = {
  symbol: string; name: string; market: string; currency: string | null; tz: string | null;
  last: number | null; prevClose: number | null; change: number | null; changePct: number | null;
  open: number | null; high: number | null; low: number | null; tradeDate: string | null; lastTime: number | null;
  hasToday: boolean; bars: { d: string; c: number }[]; error?: string;
};

const num = (v: any) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const dateIn = (ts: number, tz: string) => {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts * 1000)); }
  catch { return new Date(ts * 1000).toISOString().slice(0, 10); }
};

/** Pure parser (unit-testable): Yahoo chart JSON -> quote. */
export function parseChart(json: any, symbol: string, name: string, market: string): IndexQuote {
  const base: IndexQuote = { symbol, name, market, currency: null, tz: null, last: null, prevClose: null, change: null, changePct: null, open: null, high: null, low: null, tradeDate: null, lastTime: null, hasToday: false, bars: [] };
  const r = json?.chart?.result?.[0];
  if (!r) return { ...base, error: json?.chart?.error?.description || "No data" };
  const meta = r.meta || {};
  const tz = meta.exchangeTimezoneName || "UTC";
  const ts: number[] = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const bars = ts.map((t, i) => ({ t, d: dateIn(t, tz), o: num(q.open?.[i]), h: num(q.high?.[i]), l: num(q.low?.[i]), c: num(q.close?.[i]) })).filter((b) => b.c != null);
  const last = num(meta.regularMarketPrice) ?? bars[bars.length - 1]?.c ?? null;
  const lastTime = num(meta.regularMarketTime);
  const lastDay = lastTime ? dateIn(lastTime, tz) : bars[bars.length - 1]?.d || null;
  // The final bar is "today" when it carries the same trading date as the latest quote.
  const todayBar = bars.length && lastDay && bars[bars.length - 1].d === lastDay ? bars[bars.length - 1] : null;
  const prevBar = todayBar ? bars[bars.length - 2] : bars[bars.length - 1];
  const prevClose = prevBar?.c ?? num(meta.chartPreviousClose) ?? num(meta.previousClose);
  const change = last != null && prevClose != null ? last - prevClose : null;
  return {
    ...base, currency: meta.currency ?? null, tz, last, prevClose, change,
    changePct: change != null && prevClose ? (change / prevClose) * 100 : null,
    open: todayBar?.o ?? null, high: num(meta.regularMarketDayHigh) ?? todayBar?.h ?? null, low: num(meta.regularMarketDayLow) ?? todayBar?.l ?? null,
    tradeDate: lastDay, lastTime, hasToday: !!todayBar,
    bars: bars.slice(-6).map((b) => ({ d: b.d, c: b.c as number })),
  };
}

async function fetchOne(symbol: string, name: string, market: string): Promise<IndexQuote> {
  try {
    const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) return { ...parseChart({}, symbol, name, market), error: resp.status === 429 ? "rate_limited" : `Yahoo ${resp.status}` };
    return parseChart(await resp.json(), symbol, name, market);
  } catch (e: any) {
    return { ...parseChart({}, symbol, name, market), error: e?.message || "fetch failed" };
  }
}

let cache: { at: number; data: IndexQuote[] } | null = null;
let lastPersist = 0;

export async function fetchMarkets(): Promise<{ at: number; quotes: IndexQuote[] }> {
  if (cache && Date.now() - cache.at < 45_000) return { at: cache.at, quotes: cache.data };
  const jobs = MARKETS.flatMap((m) => m.indices.map(([s, n]) => fetchOne(s, n, m.id)));
  const quotes = await Promise.all(jobs);
  // Keep the previous good quote when Yahoo hiccups for one symbol.
  const merged = quotes.map((q) => (q.last == null && cache ? cache.data.find((p) => p.symbol === q.symbol && p.last != null) || q : q));
  cache = { at: Date.now(), data: merged };
  return { at: cache.at, quotes: merged };
}

/** Best-effort history: one row per index per trading day (upserted). Needs SUPABASE_SERVICE_ROLE_KEY. */
export async function persistMarkets(quotes: IndexQuote[], force = false) {
  if (!force && Date.now() - lastPersist < 5 * 60_000) return;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return;
  const rows = quotes.filter((q) => q.last != null && q.tradeDate).map((q) => ({
    symbol: q.symbol, name: q.name, market: q.market, trade_date: q.tradeDate, open: q.open, high: q.high, low: q.low,
    close: q.last, prev_close: q.prevClose, change: q.change, change_pct: q.changePct, currency: q.currency, updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  try { await createClient(url, key).from("market_snapshots").upsert(rows, { onConflict: "symbol,trade_date" }); lastPersist = Date.now(); } catch { /* history is optional */ }
}
