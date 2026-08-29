// Fetches upcoming earnings dates from Yahoo Finance's quoteSummary calendarEvents module -
// the same unofficial API already relied on for prices (portfolio-prices.ts), just a
// different module parameter. Reuses that endpoint's exact symbol resolution logic
// (api/_lib/yahoo-symbols.ts) so ticker handling stays consistent between the two, rather
// than risking a different resolution path finding a different (or no) match for the same
// holding.

import { resolveYahooSymbolCandidates, mapPool } from "./_lib/yahoo-symbols.js";

async function fetchYahooEarningsDate(yahooSymbol: string) {
  const resp = await fetch(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}?modules=calendarEvents`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (resp.status === 429) {
    return { earningsDate: null, error: "rate_limited", rateLimited: true };
  }
  if (!resp.ok) return { earningsDate: null, error: `Yahoo returned ${resp.status}` };
  const data = await resp.json();
  // Yahoo sometimes returns a date range (start/end of the reporting window) rather than a
  // single confirmed date - the first entry is the earliest/most likely date.
  const raw = data?.quoteSummary?.result?.[0]?.calendarEvents?.earnings?.earningsDate?.[0]?.raw;
  if (typeof raw !== "number") return { earningsDate: null, error: "No earnings date found for this symbol" };
  return { earningsDate: new Date(raw * 1000).toISOString().slice(0, 10), error: null };
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
    // Same concurrency cap as portfolio-prices.ts - unbounded parallel Yahoo hits trip rate
    // limits at scale.
    const results = await mapPool(list, 6, async ({ symbol, exchange, currency }: { symbol: string; exchange: string; currency?: string }) => {
      try {
        const originalSymbol = String(symbol || "").trim();
        const { primary, fallbacks } = resolveYahooSymbolCandidates(symbol, exchange, currency);

        const tried: string[] = [primary];
        let result = await fetchYahooEarningsDate(primary);

        if (result.rateLimited) {
          await new Promise((r) => setTimeout(r, 400));
          result = await fetchYahooEarningsDate(primary);
        }

        if (result.earningsDate == null && !result.rateLimited) {
          for (const candidate of fallbacks) {
            if (tried.includes(candidate)) continue;
            tried.push(candidate);
            const fallbackResult = await fetchYahooEarningsDate(candidate);
            if (fallbackResult.rateLimited) {
              return { symbol: originalSymbol, earningsDate: null, error: "rate_limited", rateLimited: true };
            }
            if (fallbackResult.earningsDate != null) {
              result = fallbackResult;
              break;
            }
          }
        }

        if (result.earningsDate == null) {
          return {
            symbol: originalSymbol,
            earningsDate: null,
            error: result.error || `No earnings date found (tried ${tried.join(", ")})`,
          };
        }

        return { symbol: originalSymbol, earningsDate: result.earningsDate, error: null };
      } catch (err: any) {
        return { symbol: String(symbol || ""), earningsDate: null, error: err?.message || "Fetch failed" };
      }
    });

    res.status(200).json({ results });
  } catch (error: any) {
    console.error("Earnings calendar error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error fetching earnings dates." });
  }
}
