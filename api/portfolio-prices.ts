// Fetches current stock prices for NSE/BSE symbols using Yahoo Finance's public
// chart data endpoint. This is unofficial (no official free NSE/BSE API exists),
// so it's built defensively: each symbol is fetched independently and a failure
// on one never blocks the others - the response always tells the caller exactly
// which symbols succeeded and which didn't, rather than failing the whole batch.

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
        const suffix = exchange === "BSE" ? ".BO" : ".NS";
        const yahooSymbol = `${symbol}${suffix}`;
        try {
          const resp = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`,
            { headers: { "User-Agent": "Mozilla/5.0" } }
          );
          if (!resp.ok) {
            return { symbol, exchange, price: null, previousClose: null, error: `Yahoo returned ${resp.status}` };
          }
          const data = await resp.json();
          const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
          const previousClose = data?.chart?.result?.[0]?.meta?.chartPreviousClose ?? data?.chart?.result?.[0]?.meta?.previousClose;
          if (typeof price !== "number") {
            return { symbol, exchange, price: null, previousClose: null, error: "No price found for this symbol" };
          }
          return { symbol, exchange, price, previousClose: typeof previousClose === "number" ? previousClose : null, error: null };
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
