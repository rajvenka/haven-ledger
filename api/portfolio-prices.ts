// Fetches current stock prices for NSE/BSE symbols using Yahoo Finance's public
// chart data endpoint. This is unofficial (no official free NSE/BSE API exists),
// so it's built defensively: each symbol is fetched independently and a failure
// on one never blocks the others - the response always tells the caller exactly
// which symbols succeeded and which didn't, rather than failing the whole batch.

async function fetchYahooPrice(yahooSymbol: string) {
  const resp = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!resp.ok) return { price: null, previousClose: null, currency: null, error: `Yahoo returned ${resp.status}` };
  const data = await resp.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  const previousClose = data?.chart?.result?.[0]?.meta?.chartPreviousClose ?? data?.chart?.result?.[0]?.meta?.previousClose;
  const currency = data?.chart?.result?.[0]?.meta?.currency ?? null;
  if (typeof price !== "number") return { price: null, previousClose: null, currency: null, error: "No price found for this symbol" };
  return { price, previousClose: typeof previousClose === "number" ? previousClose : null, currency, error: null };
}

/** Turn broker display symbols into Yahoo-friendly tickers.
 *  Zerodha often stores "MIRAEAMC - MAFANG*" / "MOTILAL OS NASDAQ100 ETF*" instead of
 *  the pure NSE code. Strip noise, take the segment after " - ", apply known aliases.
 */
function normalizeYahooSymbol(raw: string): string {
  let s = String(raw || "").trim().toUpperCase();
  if (!s) return s;
  // Already a Yahoo-suffixed symbol
  if (/\.(NS|BO|AX)$/i.test(s)) return s;
  s = s.replace(/\*+$/g, "").trim();
  // "MIRAEAMC - MAFANG" / "ZERODHAAMC - SML100CASE" → last segment
  // Use " - " (spaces around hyphen) so SME tickers like SSEGL-SM / TAC-SM are kept intact.
  if (s.includes(" - ")) {
    const parts = s.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) s = parts[parts.length - 1];
  }
  // Drop leftover company noise words / spaces, but KEEP hyphens (NSE SME symbols)
  s = s.replace(/\b(ETF|BEES)\b/g, "").replace(/\s+/g, "").trim() || s;

  const aliases: Record<string, string> = {
    // Motilal Oswal Nasdaq 100 ETF
    "NASDAQ100": "MON100",
    "NASDAQ100ETF": "MON100",
    "MOTILALOSNASDAQ100ETF": "MON100",
    "MOTILALOSNASDAQ100": "MON100",
    // Mirae midcap 150 ETF trading symbol variants
    "MAM150ETF": "MID150",
    "MAM150": "MID150",
  };
  // Alias lookup without hyphens; return value is the Yahoo base ticker
  const compact = s.replace(/[^A-Z0-9]/g, "");
  if (aliases[compact]) return aliases[compact];
  if (aliases[s]) return aliases[s];
  // Keep hyphens: SSEGL-SM, TAC-SM are valid NSE codes; Yahoo needs SSEGL-SM.NS
  return s.replace(/[^A-Z0-9-]/g, "") || s;
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

    const results = await Promise.all(
      symbols.slice(0, 250).map(async ({ symbol, exchange, currency }: { symbol: string; exchange: string; currency?: string }) => {
        // Normalize Zerodha-style "AMC - TICKER*" / long ETF names before suffixing
        const rawSymbol = normalizeYahooSymbol(String(symbol || "").trim());
        const originalSymbol = String(symbol || "").trim();
        const rawExchange = String(exchange || "").trim().toUpperCase();
        const rawCurrency = currency ? String(currency).trim().toUpperCase() : "";

        // Only NSE/BSE (India) and ASX (Australia) need a Yahoo suffix appended - US exchanges
        // (NASDAQ, NYSE) and others use the plain symbol as-is. Previously this defaulted to
        // ".NS" for anything that wasn't literally "BSE", which silently broke every
        // non-Indian exchange (e.g. AAPL on NASDAQ became the invalid "AAPL.NS").
        //
        // Critical fix: many India holdings arrive with exchange empty/null/"Other" after
        // CSV or Groww import (e.g. TVSMOTOR). Bare "TVSMOTOR" 404s on Yahoo; "TVSMOTOR.NS"
        // works. Treat INR currency or missing exchange as Indian and try .NS/.BO before
        // giving up - this is what was causing the bulk "Symbol not found" reports.
        const isUsExchange = ["NASDAQ", "NYSE", "AMEX", "ARCA", "BATS", "OTC"].includes(rawExchange);
        const isIndianExchange =
          rawExchange === "NSE" ||
          rawExchange === "BSE" ||
          // Infer India when exchange is missing/generic and currency is INR (or unset)
          ((!rawExchange || rawExchange === "OTHER" || rawExchange === "INDIA") &&
            (!rawCurrency || rawCurrency === "INR"));
        // AUD is the reliable signal for ASX-listed holdings (Webull AU positions carry
        // currency directly from the API) - exchange alone can't be trusted since
        // Webull's exchange field is sometimes a market code rather than "ASX".
        const isAsxListed = rawCurrency === "AUD" || rawExchange === "ASX";
        const alreadySuffixed = /\.(NS|BO|AX)$/i.test(rawSymbol);

        let primarySuffix = "";
        if (!alreadySuffixed) {
          if (rawExchange === "BSE") primarySuffix = ".BO";
          else if (isIndianExchange) primarySuffix = ".NS";
          else if (isAsxListed) primarySuffix = ".AX";
        }
        const primarySymbol = alreadySuffixed || !primarySuffix ? rawSymbol : `${rawSymbol}${primarySuffix}`;

        try {
          let result = await fetchYahooPrice(primarySymbol);
          const tried = [primarySymbol];

          // A stock can genuinely be listed on only one of NSE/BSE, or the workspace's
          // tagged exchange for it can simply be wrong - rather than fail outright, try
          // the other Indian exchange before giving up. Only applies to plain (non-suffixed)
          // symbols, since a symbol that already carries its own .NS/.BO has no second
          // exchange to fall back to.
          if (result.price == null && !alreadySuffixed) {
            // Always try the other Indian suffix when primary was Indian or when we still
            // have no price (covers empty-exchange India tickers like TVSMOTOR).
            const candidates: string[] = [];
            if (primarySuffix === ".NS") candidates.push(`${rawSymbol}.BO`);
            else if (primarySuffix === ".BO") candidates.push(`${rawSymbol}.NS`);
            else if (!isUsExchange && !isAsxListed) {
              // Unknown market / empty exchange: try both India suffixes, then ASX
              candidates.push(`${rawSymbol}.NS`, `${rawSymbol}.BO`);
              if (rawCurrency === "AUD") candidates.push(`${rawSymbol}.AX`);
            }

            for (const candidate of candidates) {
              if (tried.includes(candidate)) continue;
              tried.push(candidate);
              const fallbackResult = await fetchYahooPrice(candidate);
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
            };
          }
          // Currency guard: if we know the holding's real currency (e.g. AUD from a Webull
          // AU position) and Yahoo's match came back in a different currency, this is almost
          // certainly a wrong-market collision (a bare ticker matching a same-symbol US
          // listing instead of the actual ASX one) rather than a real price - reject it
          // instead of silently writing a wrong-currency number into live_price.
          // Skip the guard when expected currency is INR and Yahoo returns INR (normal),
          // or when we had to fall back across exchanges.
          if (rawCurrency && result.currency && result.currency.toUpperCase() !== rawCurrency) {
            return {
              symbol: rawSymbol,
              exchange: rawExchange || exchange,
              price: null,
              previousClose: null,
              error: `Currency mismatch: expected ${rawCurrency}, Yahoo returned ${result.currency} for "${primarySymbol}" - likely wrong market`,
            };
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
            symbol: rawSymbol,
            exchange: rawExchange || exchange,
            price: null,
            previousClose: null,
            error: err?.message || "Fetch failed",
          };
        }
      })
    );

    res.status(200).json({ results });
  } catch (error: any) {
    console.error("Portfolio prices error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error fetching prices." });
  }
}
