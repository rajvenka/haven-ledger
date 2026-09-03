// Shared Yahoo Finance symbol resolution logic - extracted from portfolio-prices.ts so
// earnings-calendar.ts (and any future Yahoo-backed endpoint) can reuse the exact same,
// well-tested ticker normalization and exchange-suffix handling rather than duplicating it.

/** Turn broker display symbols into Yahoo-friendly tickers. */
export function normalizeYahooSymbol(raw: string): string {
  let s = String(raw || "").trim().toUpperCase();
  if (!s) return s;
  if (/\.(NS|BO|AX)$/i.test(s)) return s;
  s = s.replace(/\*+$/g, "").trim();
  if (s.includes(" - ")) {
    const parts = s.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) s = parts[parts.length - 1];
  }
  s = s.replace(/\b(ETF|BEES)\b/g, "").replace(/\s+/g, "").trim() || s;

  const aliases: Record<string, string> = {
    NASDAQ100: "MON100",
    NASDAQ100ETF: "MON100",
    MOTILALOSNASDAQ100ETF: "MON100",
    MOTILALOSNASDAQ100: "MON100",
    MAFANG: "MAFANG",
    MONQ50: "MONQ50",
    SML100CASE: "SML100CASE",
  };
  const noHyphen = s.replace(/-/g, "");
  if (aliases[s]) return aliases[s];
  if (aliases[noHyphen]) return aliases[noHyphen];
  return s;
}

/** Resolves the primary Yahoo symbol (with exchange suffix) and fallback candidates to try. */
export function resolveYahooSymbolCandidates(
  symbol: string,
  exchange: string,
  currency?: string
): { primary: string; fallbacks: string[] } {
  const rawSymbol = normalizeYahooSymbol(String(symbol || "").trim());
  const rawExchange = String(exchange || "").trim().toUpperCase();
  const rawCurrency = currency ? String(currency).trim().toUpperCase() : "";

  const isUsExchange = ["NASDAQ", "NYSE", "AMEX", "NYSEARCA", "BATS", "OTC"].includes(rawExchange);
  const isAsxListed = rawExchange === "ASX" || rawCurrency === "AUD";
  const isIndianExchange =
    rawExchange === "NSE" ||
    rawExchange === "BSE" ||
    rawExchange === "INDIA" ||
    rawCurrency === "INR" ||
    (!rawExchange && !isUsExchange && !isAsxListed);

  const alreadySuffixed = /\.(NS|BO|AX)$/i.test(rawSymbol) || rawSymbol.includes("=");
  let primarySuffix = "";
  if (!alreadySuffixed) {
    if (rawExchange === "BSE") primarySuffix = ".BO";
    else if (isIndianExchange) primarySuffix = ".NS";
    else if (isAsxListed) primarySuffix = ".AX";
  }

  const primary = alreadySuffixed || !primarySuffix ? rawSymbol : `${rawSymbol}${primarySuffix}`;
  const fallbacks: string[] = [];
  if (!alreadySuffixed) {
    if (primarySuffix === ".NS") fallbacks.push(`${rawSymbol}.BO`);
    else if (primarySuffix === ".BO") fallbacks.push(`${rawSymbol}.NS`);
    else if (!isUsExchange && !isAsxListed) {
      fallbacks.push(`${rawSymbol}.NS`, `${rawSymbol}.BO`);
      if (rawCurrency === "AUD") fallbacks.push(`${rawSymbol}.AX`);
    }
  }
  return { primary, fallbacks };
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Fetches current price + previous close for a single Yahoo-resolved symbol. */
export async function fetchYahooPrice(yahooSymbol: string) {
  const resp = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (resp.status === 429) {
    return { price: null, previousClose: null, currency: null, error: "rate_limited", rateLimited: true };
  }
  if (!resp.ok) return { price: null, previousClose: null, currency: null, error: `Yahoo returned ${resp.status}` };
  const data = await resp.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  const previousClose = data?.chart?.result?.[0]?.meta?.chartPreviousClose ?? data?.chart?.result?.[0]?.meta?.previousClose;
  const currency = data?.chart?.result?.[0]?.meta?.currency ?? null;
  if (typeof price !== "number") return { price: null, previousClose: null, currency: null, error: "No price found for this symbol" };
  return { price, previousClose: typeof previousClose === "number" ? previousClose : null, currency, error: null };
}
