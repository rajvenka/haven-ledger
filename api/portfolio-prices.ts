// Fetches current stock prices for NSE/BSE symbols using Yahoo Finance's public
// chart data endpoint. This is unofficial (no official free NSE/BSE API exists),
// so it's built defensively: each symbol is fetched independently and a failure
// on one never blocks the others - the response always tells the caller exactly
// which symbols succeeded and which didn't, rather than failing the whole batch.
//
// Concurrency is capped — unbounded Promise.all of 100+ India tickers routinely
// trips Yahoo rate limits, which previously marked most of a workspace as
// "Symbol Not Found" even though the tickers were valid.

async function fetchYahooPrice(yahooSymbol: string) {
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

/** Turn broker display symbols into Yahoo-friendly tickers. */
function normalizeYahooSymbol(raw: string): string {
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

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
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

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { symbols } = req.body || {};
    if (!Array.isArray(symbols) || symbols.length === 0) {
      res.status(400).json({ error: "Provide a non-empty 'symbols' array of { symbol, exchange }." });
      return;
    }

    const list = symbols.slice(0, 250);
    // Cap parallel Yahoo hits — 6 keeps India portfolios (~100 names) reliable.
    const results = await mapPool(list, 6, async ({ symbol, exchange, currency }: { symbol: string; exchange: string; currency?: string }) => {
      try {
        const rawSymbol = normalizeYahooSymbol(String(symbol || "").trim());
        const originalSymbol = String(symbol || "").trim();
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

        const primarySymbol = alreadySuffixed || !primarySuffix ? rawSymbol : `${rawSymbol}${primarySuffix}`;
        const tried: string[] = [primarySymbol];
        let result = await fetchYahooPrice(primarySymbol);

        if (result.rateLimited) {
          // Brief pause + one retry on primary only
          await new Promise((r) => setTimeout(r, 400));
          result = await fetchYahooPrice(primarySymbol);
        }

        if (result.price == null && !result.rateLimited && !alreadySuffixed) {
          const candidates: string[] = [];
          if (primarySuffix === ".NS") candidates.push(`${rawSymbol}.BO`);
          else if (primarySuffix === ".BO") candidates.push(`${rawSymbol}.NS`);
          else if (!isUsExchange && !isAsxListed) {
            candidates.push(`${rawSymbol}.NS`, `${rawSymbol}.BO`);
            if (rawCurrency === "AUD") candidates.push(`${rawSymbol}.AX`);
          }

          for (const candidate of candidates) {
            if (tried.includes(candidate)) continue;
            tried.push(candidate);
            const fallbackResult = await fetchYahooPrice(candidate);
            if (fallbackResult.rateLimited) {
              return {
                symbol: originalSymbol || rawSymbol,
                exchange: rawExchange || exchange,
                price: null,
                previousClose: null,
                error: "rate_limited",
                rateLimited: true,
              };
            }
            if (fallbackResult.price != null) {
              result = fallbackResult;
              break;
            }
          }
        }

        if (result.price == null) {
          return {
            symbol: originalSymbol || rawSymbol,
            exchange: rawExchange || exchange,
            price: null,
            previousClose: null,
            error: result.error || `No price found (tried ${tried.join(", ")})`,
            rateLimited: !!result.rateLimited,
          };
        }

        if (rawCurrency && result.currency && result.currency.toUpperCase() !== rawCurrency) {
          // INR holdings sometimes get USD collision on bare tickers — reject wrong market
          if (!(rawCurrency === "INR" && result.currency.toUpperCase() === "INR")) {
            return {
              symbol: rawSymbol,
              exchange: rawExchange || exchange,
              price: null,
              previousClose: null,
              error: `Currency mismatch: expected ${rawCurrency}, Yahoo returned ${result.currency} for "${primarySymbol}"`,
            };
          }
        }

        return {
          symbol: originalSymbol || rawSymbol,
          exchange: rawExchange || exchange,
          price: result.price,
          previousClose: result.previousClose,
          error: null,
        };
      } catch (err: any) {
        return {
          symbol: String(symbol || ""),
          exchange: String(exchange || ""),
          price: null,
          previousClose: null,
          error: err?.message || "Fetch failed",
        };
      }
    });

    res.status(200).json({ results });
  } catch (error: any) {
    console.error("Portfolio prices error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error fetching prices." });
  }
}
