// Searches AMFI's own scheme list by partial name match, returning matching schemes with
// their current NAV. This is a genuinely different data source from the stock quote search
// (Yahoo doesn't meaningfully index Indian MF schemes) - built specifically so a scheme
// name mismatch (e.g. a broker export giving a shortened or differently-formatted name)
// can be resolved against what AMFI actually calls it, the same source portfolio-mf-nav.ts
// matches against for the live NAV refresh.

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
  nav: number;
}

function parseNavText(text: string): NavRow[] {
  const rows: NavRow[] = [];
  for (const line of text.split("\n")) {
    const parts = line.split(";");
    if (parts.length < 6) continue;
    const [schemeCode, isinGrowth, isinReinvest, schemeName, navStr] = parts;
    const nav = parseFloat(navStr);
    if (!schemeCode.trim() || schemeCode.trim() === "Scheme Code" || isNaN(nav)) continue;
    rows.push({ schemeCode: schemeCode.trim(), isinGrowth: isinGrowth.trim(), isinReinvest: isinReinvest.trim(), schemeName: schemeName.trim(), nav });
  }
  return rows;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const query = (req.query?.q || "").toString().trim().toLowerCase();
    if (!query) {
      res.status(400).json({ error: "Provide a 'q' query parameter to search for." });
      return;
    }

    const navText = await getNavText();
    const navRows = parseNavText(navText);
    const words = query.split(/\s+/).filter(Boolean);
    const matches = navRows
      .filter(row => {
        const nameLower = row.schemeName.toLowerCase();
        return words.every(w => nameLower.includes(w));
      })
      .slice(0, 20)
      .map(row => ({
        schemeCode: row.schemeCode,
        schemeName: row.schemeName,
        isin: row.isinGrowth || row.isinReinvest || null,
        nav: row.nav,
      }));

    res.status(200).json({ results: matches });
  } catch (error: any) {
    console.error("Portfolio MF search error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error searching for schemes." });
  }
}
