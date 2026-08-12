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

/**
 * mfapi /mf/search returns 0 hits for long full scheme names like
 * "ICICI PRUDENTIAL PHARMA HEALTHCARE & DIAGNOSTICS (P.H.D) FUND - DIRECT PLAN".
 * Progressive shorter queries still find the family; pickBestMatch then enforces
 * Direct / Growth / plan words against the full target name.
 */
function buildSearchQueries(name: string): string[] {
  const cleaned = name
    .replace(/\([^)]*\)/g, " ") // drop (P.H.D) style abbreviations that confuse search
    .replace(/\s+/g, " ")
    .trim();
  const withoutPlan = cleaned
    .replace(/\s*[-–]?\s*(direct|regular)\s+plan\b/gi, " ")
    .replace(/\s*[-–]?\s*(growth|idcw|dividend|cumulative)\b.*$/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = withoutPlan.split(/\s+/).filter(Boolean);
  const queries: string[] = [];
  const push = (q: string) => {
    const t = q.trim();
    if (t && !queries.includes(t)) queries.push(t);
  };
  push(cleaned);
  push(withoutPlan);
  // 5-word and 4-word prefixes work well for AMC + fund family (e.g. "ICICI Prudential Pharma Healthcare")
  if (words.length > 5) push(words.slice(0, 5).join(" "));
  if (words.length > 4) push(words.slice(0, 4).join(" "));
  if (words.length > 3) push(words.slice(0, 3).join(" "));
  return queries;
}

function pickBestMatch(candidates: MfapiSearchResult[], targetName: string): MfapiSearchResult | undefined {
  const raw = targetName.toLowerCase();
  const wantsDirect = /\bdirect\b/.test(raw);
  const wantsRegular = /\bregular\b/.test(raw);
  const wantsIdcw = /\b(idcw|dividend)\b/.test(raw);
  // Words that must appear, excluding pure noise. Keep "direct" when present in target.
  // Drop standalone "plan" - mfapi often says "Direct - Growth" without the word "plan".
  const targetWords = raw
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && w !== "plan" && w !== "option" && w !== "options");
  if (targetWords.length === 0) return undefined;

  let filtered = candidates.filter((c) => {
    const nameLower = c.schemeName.toLowerCase();
    return targetWords.every((w) => nameLower.includes(w));
  });

  // Soften: if strict every-word failed, require AMC + core fund words (drop plan-type words)
  if (filtered.length === 0) {
    const core = targetWords.filter((w) => !["direct", "regular", "growth", "idcw", "dividend", "cumulative"].includes(w));
    if (core.length >= 3) {
      filtered = candidates.filter((c) => {
        const nameLower = c.schemeName.toLowerCase();
        return core.every((w) => nameLower.includes(w));
      });
    }
  }
  if (filtered.length === 0) return undefined;

  // Prefer Direct vs Regular when target says so
  if (wantsDirect) {
    const d = filtered.filter((c) => /\bdirect\b/i.test(c.schemeName));
    if (d.length) filtered = d;
  } else if (wantsRegular) {
    const r = filtered.filter((c) => /\bregular\b/i.test(c.schemeName));
    if (r.length) filtered = r;
  }

  // Prefer Growth/Cumulative over IDCW unless user explicitly holds IDCW
  if (!wantsIdcw) {
    const growth = filtered.filter((c) => !/\b(idcw|dividend)\b/i.test(c.schemeName));
    if (growth.length) filtered = growth;
  } else {
    const idcw = filtered.filter((c) => /\b(idcw|dividend)\b/i.test(c.schemeName));
    if (idcw.length) filtered = idcw;
  }

  return filtered.sort(
    (a, b) => Math.abs(a.schemeName.length - targetName.length) - Math.abs(b.schemeName.length - targetName.length)
  )[0];
}

async function fetchLatestNav(schemeCode: string | number): Promise<{ nav: number; schemeName: string; httpStatus: number } | null> {
  const resp = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
  if (!resp.ok) {
    console.log(`[mf-nav] fetchLatestNav(${schemeCode}) HTTP ${resp.status}`);
    return null;
  }
  const data = await resp.json();
  const nav = parseFloat(data?.data?.[0]?.nav);
  if (isNaN(nav)) {
    console.log(`[mf-nav] fetchLatestNav(${schemeCode}) got NaN nav, raw data[0]:`, JSON.stringify(data?.data?.[0] || null));
    return null;
  }
  return { nav, schemeName: data?.meta?.scheme_name || String(schemeCode), httpStatus: resp.status };
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
    console.log(`[mf-nav] request for ${funds.length} funds`);

    const navText = await getNavText();
    const isinRows = parseIsinRows(navText);
    const byIsin = new Map<string, IsinRow>();
    for (const row of isinRows) {
      if (row.isinGrowth) byIsin.set(row.isinGrowth, row);
      if (row.isinReinvest) byIsin.set(row.isinReinvest, row);
    }

    const results = await Promise.all(
      funds.map(async ({ id, isin, name }: { id: string; isin?: string; name: string }) => {
        try {
          if (isin) {
            const isinMatch = byIsin.get(isin.trim());
            if (isinMatch) {
              const navResult = await fetchLatestNav(isinMatch.schemeCode);
              if (navResult) {
                console.log(`[mf-nav] OK (isin path) id=${id} name="${name}" schemeCode=${isinMatch.schemeCode} nav=${navResult.nav}`);
                return { id, nav: navResult.nav, matchedSchemeName: navResult.schemeName, error: null };
              }
              console.log(`[mf-nav] ISIN matched scheme ${isinMatch.schemeCode} but fetchLatestNav failed, id=${id} name="${name}"`);
            } else {
              console.log(`[mf-nav] no AMFI ISIN match for isin=${isin} id=${id} name="${name}"`);
            }
          }
          if (name) {
            // Try progressively shorter search queries - full scheme names return 0 hits on mfapi.
            const queries = buildSearchQueries(name);
            let candidates: MfapiSearchResult[] = [];
            let usedQuery = "";
            for (const searchQuery of queries) {
              const searchResp = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(searchQuery)}`);
              if (!searchResp.ok) {
                console.log(`[mf-nav] mfapi search HTTP ${searchResp.status} for query="${searchQuery}" id=${id}`);
                continue;
              }
              const batch: MfapiSearchResult[] = await searchResp.json();
              if (Array.isArray(batch) && batch.length > 0) {
                candidates = batch;
                usedQuery = searchQuery;
                break;
              }
            }
            if (candidates.length > 0) {
              const best = pickBestMatch(candidates, name);
              if (best) {
                const navResult = await fetchLatestNav(best.schemeCode);
                if (navResult) {
                  console.log(
                    `[mf-nav] OK (name path) id=${id} name="${name}" query="${usedQuery}" schemeCode=${best.schemeCode} nav=${navResult.nav}`
                  );
                  return { id, nav: navResult.nav, matchedSchemeName: navResult.schemeName, error: null };
                }
                console.log(`[mf-nav] name-matched scheme ${best.schemeCode} but fetchLatestNav failed, id=${id} name="${name}"`);
              } else {
                console.log(`[mf-nav] candidates found via "${usedQuery}" but pickBestMatch failed for name="${name}" id=${id}`);
              }
            } else {
              console.log(`[mf-nav] mfapi search returned no candidates for queries=${JSON.stringify(queries)} id=${id}`);
            }
          }
          console.log(`[mf-nav] FAILED entirely: id=${id} name="${name}" isin=${isin}`);
          return { id, nav: null, error: "No matching scheme found." };
        } catch (err: any) {
          console.log(`[mf-nav] EXCEPTION for id=${id} name="${name}":`, err?.message);
          return { id, nav: null, error: err?.message || "Lookup failed for this fund." };
        }
      })
    );

    const okCount = results.filter((r: any) => r.nav != null).length;
    console.log(`[mf-nav] done: ${okCount}/${results.length} succeeded`);

    res.status(200).json({ results });
  } catch (error: any) {
    console.error("[mf-nav] TOP-LEVEL EXCEPTION:", error?.message, error?.stack);
    res.status(500).json({ error: error?.message || "Unexpected error fetching NAVs." });
  }
}
