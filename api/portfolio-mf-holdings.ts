// Fetches a mutual fund's underlying stock holdings from finapi.upvaly.com, a free,
// no-auth API keyed directly by ISIN - confirmed working with real, current data
// (verified directly: GET /api/mf/isin/{isin} returns a holdings array with name/weightage
// for every underlying position). AMFI's file is used only to resolve a fund name to its
// ISIN when the holding doesn't already have one stored - fuzzy-matched the same way as
// portfolio-mf-nav.ts, since broker-exported names rarely match AMFI's official naming
// exactly.

let cachedNavText: string | null = null;
let cachedAt = 0;
const CACHE_MS = 20 * 60 * 1000;

async function getNavText(): Promise<string> {
  if (cachedNavText && Date.now() - cachedAt < CACHE_MS) return cachedNavText;
  const resp = await fetch("https://www.amfiindia.com/spages/NAVAll.txt", { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!resp.ok) throw new Error(`AMFI returned ${resp.status}`);
  const text = await resp.text();
  cachedNavText = text;
  cachedAt = Date.now();
  return text;
}

interface NavRow {
  schemeCode: string;
  isinGrowth: string;
  isinReinvest: string;
  schemeName: string;
}

function parseNavText(text: string): NavRow[] {
  const rows: NavRow[] = [];
  for (const line of text.split("\n")) {
    const parts = line.split(";");
    if (parts.length < 6) continue;
    const [schemeCode, isinGrowth, isinReinvest, schemeName, navStr] = parts;
    if (!schemeCode.trim() || schemeCode.trim() === "Scheme Code" || isNaN(parseFloat(navStr))) continue;
    rows.push({ schemeCode: schemeCode.trim(), isinGrowth: isinGrowth.trim(), isinReinvest: isinReinvest.trim(), schemeName: schemeName.trim() });
  }
  return rows;
}

// Same disambiguation as portfolio-mf-nav.ts: every significant word from the broker's
// name must appear in the AMFI candidate, closest-length variant wins among matches.
function fuzzyMatchScheme(rows: NavRow[], targetName: string): NavRow | undefined {
  const targetWords = targetName.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 1);
  if (targetWords.length === 0) return undefined;
  const candidates = rows.filter(row => {
    const nameLower = row.schemeName.toLowerCase();
    return targetWords.every(w => nameLower.includes(w));
  });
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  candidates.sort((a, b) => Math.abs(a.schemeName.length - targetName.length) - Math.abs(b.schemeName.length - targetName.length));
  return candidates[0];
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { isin, name } = req.body || {};
    console.log("[mf-holdings] request:", { isin, name });
    if (!isin && !name) {
      res.status(400).json({ error: "Provide an 'isin' or 'name' to match against." });
      return;
    }

    let resolvedIsin: string | null = isin ? isin.trim() : null;
    let matchedSchemeName: string | null = null;

    if (!resolvedIsin && name) {
      const navText = await getNavText();
      const navRows = parseNavText(navText);
      const match = fuzzyMatchScheme(navRows, name);
      console.log("[mf-holdings] AMFI name match:", match ? { schemeCode: match.schemeCode, schemeName: match.schemeName } : "NO MATCH");
      if (match) {
        resolvedIsin = match.isinGrowth || match.isinReinvest || null;
        matchedSchemeName = match.schemeName;
      }
    }

    if (!resolvedIsin) {
      res.status(200).json({ holdings: [], schemeName: matchedSchemeName, error: "Could not resolve this fund to an ISIN." });
      return;
    }

    const holdingsUrl = `https://finapi.upvaly.com/api/mf/isin/${resolvedIsin}`;
    console.log("[mf-holdings] fetching:", holdingsUrl);
    const resp = await fetch(holdingsUrl);
    const bodyText = await resp.text();
    console.log("[mf-holdings] response status:", resp.status, "body preview:", bodyText.slice(0, 300));
    if (!resp.ok) {
      res.status(200).json({ holdings: [], schemeName: matchedSchemeName, error: resp.status >= 500 ? `finapi.upvaly.com is temporarily unavailable (${resp.status}) - try again shortly.` : `finapi.upvaly.com returned ${resp.status} for this ISIN.` });
      return;
    }
    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      res.status(200).json({ holdings: [], schemeName: matchedSchemeName, error: "finapi.upvaly.com returned an unexpected (non-JSON) response." });
      return;
    }

    const rawHoldings = data?.data?.holdings || [];
    // Exclude derivatives (futures show up as separate short-position rows with negative
    // market value) and pure cash/debt line items - this feature is about stock exposure,
    // and mixing in "Cash Offset For Derivatives" or a future contract would misrepresent it.
    const holdings = rawHoldings
      .filter((h: any) => h.name && !/future/i.test(h.name) && parseFloat(h.marketValue?.replace(/,/g, "") || "0") > 0)
      .map((h: any) => ({ stockName: h.name, weightPct: parseFloat(h.weightage) }))
      .filter((h: any) => h.stockName && !isNaN(h.weightPct));

    console.log("[mf-holdings] parsed holdings count:", holdings.length, "of raw:", rawHoldings.length);

    res.status(200).json({
      holdings,
      schemeCode: data?.data?.schemeCode || null,
      schemeName: data?.data?.schemeName || matchedSchemeName,
      error: holdings.length === 0 ? "No equity holdings returned for this fund." : null,
    });
  } catch (error: any) {
    console.error("[mf-holdings] EXCEPTION:", error?.message, error?.stack);
    res.status(500).json({ error: error?.message || "Unexpected error fetching fund holdings." });
  }
}
