// Fetches current NAV for Indian mutual funds using AMFI's free, public, no-auth daily
// NAV file (https://www.amfiindia.com/spages/NAVAll.txt). This is the same official
// source every other free Indian MF NAV tool ultimately reads from - there's no per-scheme
// API, just one large semicolon-delimited text dump refreshed once a day, grouped by AMC
// with blank-line-separated sections and occasional header rows to skip.
//
// Matching strategy: ISIN first (exact, reliable, when the holding has one on file),
// falling back to a normalized scheme-name match (whitespace/case/punctuation-insensitive)
// since Zerodha/Groww exports don't always carry a clean ISIN for older MF holdings.

let cachedNavText: string | null = null;
let cachedAt = 0;
const CACHE_MS = 20 * 60 * 1000; // AMFI only refreshes NAVs once a day - no need to refetch every request

async function getNavText(): Promise<string> {
  if (cachedNavText && Date.now() - cachedAt < CACHE_MS) return cachedNavText;
  const resp = await fetch("https://www.amfiindia.com/spages/NAVAll.txt", { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!resp.ok) throw new Error(`AMFI returned ${resp.status}`);
  const text = await resp.text();
  cachedNavText = text;
  cachedAt = Date.now();
  return text;
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface NavRow {
  schemeCode: string;
  isinGrowth: string;
  isinReinvest: string;
  schemeName: string;
  nav: number;
}

function parseNavText(text: string): NavRow[] {
  const rows: NavRow[] = [];
  for (const line of text.split("\n")) {
    const parts = line.split(";");
    if (parts.length < 6) continue; // skips AMC header lines and blank separators
    const [schemeCode, isinGrowth, isinReinvest, schemeName, navStr] = parts;
    const nav = parseFloat(navStr);
    if (!schemeCode.trim() || schemeCode.trim() === "Scheme Code" || isNaN(nav)) continue;
    rows.push({ schemeCode: schemeCode.trim(), isinGrowth: isinGrowth.trim(), isinReinvest: isinReinvest.trim(), schemeName: schemeName.trim(), nav });
  }
  return rows;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { funds } = req.body || {};
    if (!Array.isArray(funds) || funds.length === 0) {
      res.status(400).json({ error: "Provide a non-empty 'funds' array of { id, isin?, name }." });
      return;
    }

    const navText = await getNavText();
    const navRows = parseNavText(navText);
    const byIsin = new Map<string, NavRow>();
    const byName = new Map<string, NavRow>();
    for (const row of navRows) {
      if (row.isinGrowth) byIsin.set(row.isinGrowth, row);
      if (row.isinReinvest) byIsin.set(row.isinReinvest, row);
      byName.set(normalizeName(row.schemeName), row);
    }

    const results = funds.map(({ id, isin, name }: { id: string; isin?: string; name: string }) => {
      let match: NavRow | undefined;
      if (isin) match = byIsin.get(isin.trim());
      if (!match && name) match = byName.get(normalizeName(name));
      if (!match) return { id, nav: null, error: "No matching scheme found in AMFI's NAV list" };
      return { id, nav: match.nav, matchedSchemeName: match.schemeName, error: null };
    });

    res.status(200).json({ results });
  } catch (error: any) {
    console.error("Portfolio MF NAV error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error fetching NAVs." });
  }
}
