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
  if (!resp.ok) return { price: null, previousClose: null, error: `Yahoo returned ${resp.status}` };
  const data = await resp.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  const previousClose = data?.chart?.result?.[0]?.meta?.chartPreviousClose ?? data?.chart?.result?.[0]?.meta?.previousClose;
  if (typeof price !== "number") return { price: null, previousClose: null, error: "No price found for this symbol" };
  return { price, previousClose: typeof previousClose === "number" ? previousClose : null, error: null };
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
      symbols.slice(0, 250).map(async ({ symbol, exchange }: { symbol: string; exchange: string }) => {
        // Only NSE/BSE (India) need a Yahoo suffix appended - US exchanges (NASDAQ, NYSE)
        // and others use the plain symbol as-is. Previously this defaulted to ".NS" for
        // anything that wasn't literally "BSE", which silently broke every non-Indian
        // exchange (e.g. AAPL on NASDAQ became the invalid "AAPL.NS").
        const isIndianExchange = exchange === "NSE" || exchange === "BSE";
        const alreadySuffixed = /\.(NS|BO)$/i.test(symbol);
        const primarySuffix = exchange === "BSE" ? ".BO" : isIndianExchange ? ".NS" : "";
        const primarySymbol = alreadySuffixed || !primarySuffix ? symbol : `${symbol}${primarySuffix}`;

        try {
          let result = await fetchYahooPrice(primarySymbol);
          // A stock can genuinely be listed on only one of NSE/BSE, or the workspace's
          // tagged exchange for it can simply be wrong - rather than fail outright, try
          // the other Indian exchange before giving up. Only applies to plain (non-suffixed)
          // Indian symbols, since a symbol that already carries its own .NS/.BO has no
          // second exchange to fall back to.
          if (result.price == null && isIndianExchange && !alreadySuffixed) {
            const fallbackSuffix = primarySuffix === ".NS" ? ".BO" : ".NS";
            const fallbackResult = await fetchYahooPrice(`${symbol}${fallbackSuffix}`);
            if (fallbackResult.price != null) result = fallbackResult;
          }
          if (result.price == null) {
            return { symbol, exchange, price: null, previousClose: null, error: result.error };
          }
          return { symbol, exchange, price: result.price, previousClose: result.previousClose, error: null };
        } catch (err: any) {
          return { symbol, exchange, price: null, previousClose: null, error: err?.message || "Fetch failed" };
        }
      })
    );

    res.status(200).json({ results });
  } catch (error: any) {
    console.error("Portfolio prices error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error fetching prices." });
  }
}
