// Lets someone search by company name (or a guessed symbol) and see what Yahoo Finance
// actually resolves it to - built specifically to solve the "broker's symbol doesn't match
// Yahoo's real ticker" problem (SME-segment suffixes, Groww giving a company name instead
// of a ticker, etc). Uses Yahoo's public autocomplete/search endpoint, same unofficial
// approach as the price-lookup endpoint.

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const query = (req.query?.q || "").toString().trim();
    if (!query) {
      res.status(400).json({ error: "Provide a 'q' query parameter to search for." });
      return;
    }

    const resp = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!resp.ok) {
      res.status(200).json({ results: [], error: `Search service returned ${resp.status}` });
      return;
    }
    const data = await resp.json();
    const quotes = Array.isArray(data?.quotes) ? data.quotes : [];
    const results = quotes
      .filter((q: any) => q.symbol)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange || null,
        exchangeDisplay: q.exchDisp || q.exchange || null,
        type: q.quoteType || null,
      }));

    res.status(200).json({ results });
  } catch (error: any) {
    console.error("Portfolio quote search error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error searching for symbols." });
  }
}
