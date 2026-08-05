// Fetches current NAV for Indian mutual funds. AMFI's raw NAV file is kept only as the
// ISIN-to-scheme-code lookup (there's no ISIN search anywhere else), but the actual NAV
// value and name-based matching now go through mfapi.in (https://www.mfapi.in) instead of
// this route's own text parsing - a dedicated, well-maintained free API with a proper
// /mf/search endpoint, status page, and daily update guarantees, rather than re-parsing
// a giant government text dump by hand for every request.

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

interface IsinRow {
  schemeCode: string;
  isinGrowth: string;
  isinReinvest: string;
}

function parseIsinRows(text: string): IsinRow[] {
  const rows: IsinRow[] = [];
  for (const line of text.split("\n")) {
    const parts = line.split(";");
    if (parts.length < 6) continue;
    const [schemeCode, isinGrowth, isinReinvest] = parts;
    if (!schemeCode.trim() || schemeCode.trim() === "Scheme Code") continue;
    rows.push({ schemeCode: schemeCode.trim(), isinGrowth: isinGrowth.trim(), isinReinvest: isinReinvest.trim() });
  }
  return rows;
}

interface MfapiSearchResult {
  schemeCode: number;
  schemeName: string;
}

// Picks the best candidate from mfapi.in's own search results - it already does the heavy
// lifting of finding name-similar schemes, this just disambiguates between variants
// (Direct/Regular, Growth/IDCW) by requiring every significant word from the broker's name
// to appear in the candidate, then preferring the closest overall length match.
function pickBestMatch(candidates: MfapiSearchResult[], targetName: string): MfapiSearchResult | undefined {
  const targetWords = targetName.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 1);
  if (targetWords.length === 0) return candidates[0];
  const filtered = candidates.filter(c => {
    const nameLower = c.schemeName.toLowerCase();
    return targetWords.every(w => nameLower.includes(w));
  });
  const pool = filtered.length > 0 ? filtered : candidates;
  return pool.sort((a, b) => Math.abs(a.schemeName.length - targetName.length) - Math.abs(b.schemeName.length - targetName.length))[0];
}

async function fetchLatestNav(schemeCode: string | number): Promise<{ nav: number; schemeName: string } | null> {
  const resp = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
  if (!resp.ok) return null;
  const data = await resp.json();
  const nav = parseFloat(data?.data?.[0]?.nav);
  if (isNaN(nav)) return null;
  return { nav, schemeName: data?.meta?.scheme_name || String(schemeCode) };
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
    const isinRows = parseIsinRows(navText);
    const byIsin = new Map<string, IsinRow>();
    for (const row of isinRows) {
      if (row.isinGrowth) byIsin.set(row.isinGrowth, row);
      if (row.isinReinvest) byIsin.set(row.isinReinvest, row);
    }

    const results = await Promise.all(funds.map(async ({ id, isin, name }: { id: string; isin?: string; name: string }) => {
      try {
        if (isin) {
          const isinMatch = byIsin.get(isin.trim());
          if (isinMatch) {
            const navResult = await fetchLatestNav(isinMatch.schemeCode);
            if (navResult) return { id, nav: navResult.nav, matchedSchemeName: navResult.schemeName, error: null };
          }
        }
        if (name) {
          const searchQuery = name.trim().split(/\s+/).slice(0, 4).join(" ");
          const searchResp = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(searchQuery)}`);
          if (searchResp.ok) {
            const candidates: MfapiSearchResult[] = await searchResp.json();
            if (Array.isArray(candidates) && candidates.length > 0) {
              const best = pickBestMatch(candidates, name);
              if (best) {
                const navResult = await fetchLatestNav(best.schemeCode);
                if (navResult) return { id, nav: navResult.nav, matchedSchemeName: navResult.schemeName, error: null };
              }
            }
          }
        }
        return { id, nav: null, error: "No matching scheme found." };
      } catch (err: any) {
        return { id, nav: null, error: err?.message || "Lookup failed for this fund." };
      }
    }));

    res.status(200).json({ results });
  } catch (error: any) {
    console.error("Portfolio MF NAV error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error fetching NAVs." });
  }
}
