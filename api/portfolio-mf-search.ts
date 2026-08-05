// Searches Indian mutual fund schemes by partial name match, returning matches with their
// current NAV. Uses mfapi.in's own /mf/search endpoint (dedicated, well-maintained, no
// need to parse AMFI's raw text file by hand here) - a genuinely different data source
// from the stock quote search, since Yahoo doesn't meaningfully index Indian MF schemes.

interface MfapiSearchResult {
  schemeCode: number;
  schemeName: string;
}

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

    const searchResp = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
    if (!searchResp.ok) {
      res.status(200).json({ results: [], error: `mfapi.in returned ${searchResp.status} for this search.` });
      return;
    }
    const candidates: MfapiSearchResult[] = await searchResp.json();
    if (!Array.isArray(candidates) || candidates.length === 0) {
      res.status(200).json({ results: [] });
      return;
    }

    // Fetch NAV (and ISIN, from the same response) for the top matches only, to keep this
    // fast - a broad query can return dozens of scheme variants.
    const top = candidates.slice(0, 15);
    const results = await Promise.all(top.map(async (c) => {
      try {
        const navResp = await fetch(`https://api.mfapi.in/mf/${c.schemeCode}/latest`);
        if (!navResp.ok) return null;
        const navData = await navResp.json();
        const nav = parseFloat(navData?.data?.[0]?.nav);
        if (isNaN(nav)) return null;
        return {
          schemeCode: c.schemeCode,
          schemeName: c.schemeName,
          isin: navData?.meta?.isin_growth || navData?.meta?.isin_div_reinvestment || null,
          nav,
        };
      } catch {
        return null;
      }
    }));

    res.status(200).json({ results: results.filter(Boolean) });
  } catch (error: any) {
    console.error("Portfolio MF search error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error searching for schemes." });
  }
}
