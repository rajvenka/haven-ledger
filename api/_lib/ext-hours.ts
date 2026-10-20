// Pre-market / post-market move for US symbols (Yahoo chart with extended-hours bars).
import { resolveYahooSymbolCandidates } from "./yahoo-symbols.js";

export type ExtQuote = { symbol: string; session: "pre" | "post" | null; extPrice: number | null; extChange: number | null; extPct: number | null; regular: number | null; at: number | null; error?: string };

const num = (v: any) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Pure parser: Yahoo 1m chart (includePrePost) -> extended-hours move. */
export function parseExt(json: any, symbol: string): ExtQuote {
  const out: ExtQuote = { symbol, session: null, extPrice: null, extChange: null, extPct: null, regular: null, at: null };
  const r = json?.chart?.result?.[0];
  if (!r) return { ...out, error: json?.chart?.error?.description || "No data" };
  const meta = r.meta || {};
  const ts: number[] = r.timestamp || [];
  const close: any[] = r.indicators?.quote?.[0]?.close || [];
  let i = close.length - 1;
  while (i >= 0 && num(close[i]) == null) i--;
  if (i < 0) return out;
  const lastT = ts[i], lastP = close[i] as number;
  const tp = meta.currentTradingPeriod || {};
  const reg = num(meta.regularMarketPrice);
  const prev = num(meta.chartPreviousClose) ?? num(meta.previousClose);
  const post = tp.post, pre = tp.pre, regular = tp.regular;
  let session: "pre" | "post" | null = null, ref: number | null = null;
  if (post && lastT >= post.start) { session = "post"; ref = reg; }
  else if (pre && lastT >= pre.start && regular && lastT < regular.start) { session = "pre"; ref = prev; }
  if (!session || ref == null || !(ref > 0)) return { ...out, regular: reg };
  const change = lastP - ref;
  return { symbol, session, extPrice: lastP, extChange: change, extPct: (change / ref) * 100, regular: reg, at: lastT };
}

export async function fetchExt(symbol: string, exchange?: string, currency?: string): Promise<ExtQuote> {
  try {
    const { primary } = resolveYahooSymbolCandidates(symbol, exchange as any, currency as any);
    const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(primary)}?range=1d&interval=1m&includePrePost=true`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) return { symbol, session: null, extPrice: null, extChange: null, extPct: null, regular: null, at: null, error: resp.status === 429 ? "rate_limited" : `Yahoo ${resp.status}` };
    return parseExt(await resp.json(), symbol);
  } catch (e: any) {
    return { symbol, session: null, extPrice: null, extChange: null, extPct: null, regular: null, at: null, error: e?.message || "fetch failed" };
  }
}
