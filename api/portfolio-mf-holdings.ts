// Fetches a mutual fund's underlying stock holdings (what it actually invests in, with
// % weight) from mfdata.in, a free no-auth API for Indian mutual funds. Matching to an
// AMFI scheme code first (same ISIN-then-name logic as portfolio-mf-nav.ts, so a fund
// that resolves for NAV also resolves here), then using that code to find the fund
// "family" mfdata.in stores holdings under (direct/regular/IDCW variants of the same
// fund share one underlying portfolio).

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

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
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

    // Step 1: resolve to an AMFI scheme code, same matching priority as the NAV endpoint.
    const navText = await getNavText();
    const navRows = parseNavText(navText);
    console.log("[mf-holdings] AMFI rows parsed:", navRows.length);
    let match: NavRow | undefined;
    if (isin) match = navRows.find(r => r.isinGrowth === isin.trim() || r.isinReinvest === isin.trim());
    if (!match && name) {
      const target = normalizeName(name);
      match = navRows.find(r => normalizeName(r.schemeName) === target);
    }
    console.log("[mf-holdings] AMFI match:", match ? { schemeCode: match.schemeCode, schemeName: match.schemeName } : "NO MATCH");
    if (!match) {
      res.status(200).json({ holdings: [], schemeName: null, error: "No matching AMFI scheme found for this fund." });
      return;
    }

    // Step 2: get the scheme's family ID from mfdata.in.
    const schemeUrl = `https://mfdata.in/api/v1/schemes/${match.schemeCode}`;
    console.log("[mf-holdings] fetching scheme:", schemeUrl);
    const schemeResp = await fetch(schemeUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const schemeBodyText = await schemeResp.text();
    console.log("[mf-holdings] scheme response status:", schemeResp.status, "body:", schemeBodyText.slice(0, 800));
    if (!schemeResp.ok) {
      res.status(200).json({ holdings: [], schemeName: match.schemeName, error: `mfdata.in returned ${schemeResp.status} for this scheme.` });
      return;
    }
    let schemeData: any;
    try {
      schemeData = JSON.parse(schemeBodyText);
    } catch {
      console.log("[mf-holdings] scheme response was not valid JSON");
      res.status(200).json({ holdings: [], schemeName: match.schemeName, error: "mfdata.in returned an unexpected (non-JSON) response for this scheme." });
      return;
    }
    const familyId = schemeData?.data?.family_id ?? schemeData?.data?.family?.id;
    console.log("[mf-holdings] extracted family_id:", familyId);
    if (!familyId) {
      res.status(200).json({ holdings: [], schemeName: match.schemeName, error: "No holdings data available for this fund yet (no family_id in scheme response - see server logs for the raw shape)." });
      return;
    }

    // Step 3: fetch the actual stock-level holdings for that family.
    const holdingsUrl = `https://mfdata.in/api/v1/families/${familyId}/holdings`;
    console.log("[mf-holdings] fetching holdings:", holdingsUrl);
    const holdingsResp = await fetch(holdingsUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const holdingsBodyText = await holdingsResp.text();
    console.log("[mf-holdings] holdings response status:", holdingsResp.status, "body:", holdingsBodyText.slice(0, 800));
    if (!holdingsResp.ok) {
      res.status(200).json({ holdings: [], schemeName: match.schemeName, error: `mfdata.in returned ${holdingsResp.status} for holdings.` });
      return;
    }
    let holdingsData: any;
    try {
      holdingsData = JSON.parse(holdingsBodyText);
    } catch {
      console.log("[mf-holdings] holdings response was not valid JSON");
      res.status(200).json({ holdings: [], schemeName: match.schemeName, error: "mfdata.in returned an unexpected (non-JSON) response for holdings." });
      return;
    }
    const equityHoldings = holdingsData?.data?.equity_holdings || [];
    console.log("[mf-holdings] equity_holdings count:", equityHoldings.length, "sample:", JSON.stringify(equityHoldings[0] || null));
    const holdings = equityHoldings.map((h: any) => ({
      stockName: h.name || h.stock_name || h.security_name,
      weightPct: h.weight_pct ?? h.weight ?? h.percentage ?? null,
    })).filter((h: any) => h.stockName && h.weightPct != null);
    console.log("[mf-holdings] final parsed holdings count:", holdings.length);

    res.status(200).json({ holdings, schemeCode: match.schemeCode, schemeName: match.schemeName, error: holdings.length === 0 ? "No equity holdings returned for this fund (see server logs for the raw response shape)." : null });
  } catch (error: any) {
    console.error("[mf-holdings] EXCEPTION:", error?.message, error?.stack);
    res.status(500).json({ error: error?.message || "Unexpected error fetching fund holdings." });
  }
}
