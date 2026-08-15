// Parses an Amundi ESR "Account Statement" (employee savings statement for Capgemini's
// ESOP/FCPE plans) uploaded as a PDF, and returns it in the same shape the eToro sync
// already produces: one consolidated ParsedHolding for the underlying stock (Capgemini,
// symbol CAP) plus a rawLots array (one row per vintage-year ESOP tranche). The frontend
// feeds this through the exact same import/reconciliation pipeline already proven for
// eToro's multi-lot positions - no new save logic needed for the share side.
//
// The SAR (Stock Appreciation Right) table on the same statement is NOT equity - it's a
// separate cash-settled bonus instrument that happens to track the same share counts. It's
// returned separately as `sarGrants` and the frontend writes those into their own table
// (portfolio_employee_grants), never into portfolio_holdings, so it can't get double-counted
// against the real Capgemini shares or picked up by portfolio valuation logic.
//
// IMPORTANT CAVEAT (surfaced to the user, not silently assumed): the statement's "Price (€)"
// column is explicitly described in its own footer as the *current redemption/valuation*
// price as of the statement date, not the original subscription/purchase price - Amundi
// statements don't include historical cost basis. Buy price and current price are both set
// to this same figure per lot, which means computed gain/loss will show ~0 until the real
// subscription price (if known) is edited in per lot.

import { extractText, getDocumentProxy } from "unpdf";

interface ParsedRow {
  name: string;
  availabilityDate: string; // as printed, MM/DD/YYYY
  quantity: number;
  price: number;
  amount: number;
}

function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Row shape is anchored on the one unambiguous token every row has: a MM/DD/YYYY
// availability date. Everything between the previous row's end and this date is the row's
// name (which may itself have wrapped across a PDF line break - already collapsed away by
// flatten() above). Quantity/price never carry a thousands separator in this statement
// (all well under 1,000); amount can ("1 225.24"), so it gets its own pattern.
const ROW_RE = /(\d{2}\/\d{2}\/\d{4})\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d{1,3}(?:\s\d{3})*\.\d{2})/g;

function extractRows(blockText: string): ParsedRow[] {
  const flat = flatten(blockText);
  const rows: ParsedRow[] = [];
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  ROW_RE.lastIndex = 0;
  while ((m = ROW_RE.exec(flat))) {
    let name = flat.slice(lastEnd, m.index).trim();
    // The very first row in each section still carries that section's table header text
    // ("...Vehicle instrument Availability date Quantity Price (€) Amount (€)") ahead of
    // the real row name - strip anything up through the last "Amount (€)" if present.
    name = name.replace(/^.*Amount\s*\(\s*€\s*\)\s*/i, "").trim();
    rows.push({
      name,
      availabilityDate: m[1],
      quantity: Number(m[2]),
      price: Number(m[3]),
      amount: Number(m[4].replace(/\s/g, "")),
    });
    lastEnd = m.index + m[0].length;
  }
  return rows;
}

function toIsoDate(mmddyyyy: string): string {
  const [mm, dd, yyyy] = mmddyyyy.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

// Prefer an explicit trailing year printed in the row's own name (e.g. "ESOP CLASSIC
// 2025" -> 2025, common to every ESOP CLASSIC and SAR row). Amundi's other row type
// ("CAPGEMINI CLASSIC (C)") never prints one - the statement genuinely doesn't distinguish
// those three rows by name, only by availability date - so fall back to that date's year
// rather than inventing a number that isn't in the source document.
function vintageYearOf(row: ParsedRow): { year: number; cleanName: string } {
  const m = row.name.match(/^(.*?)\s+(\d{4})$/);
  if (m && Number(m[2]) >= 1990 && Number(m[2]) <= 2100) {
    return { year: Number(m[2]), cleanName: m[1].trim() };
  }
  return { year: Number(row.availabilityDate.slice(-4)), cleanName: row.name };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function amundiCapgeminiHandler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = req.body || {};
    const fileBase64: string | undefined = body.fileBase64 || body.pdfBase64;
    if (!fileBase64) {
      res.status(400).json({ error: "Missing fileBase64 (base64-encoded PDF)." });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBase64.replace(/^data:application\/pdf;base64,/, ""), "base64");
    } catch {
      res.status(400).json({ error: "Could not decode the uploaded file - is it a valid PDF?" });
      return;
    }

    // unpdf ships its own serverless-optimized PDF.js build with no canvas/DOMMatrix
    // dependency - pdf-parse's Node build pulls in pdfjs-dist's "legacy" bundle, which
    // unconditionally tries to polyfill DOMMatrix/ImageData/Path2D via the optional
    // @napi-rs/canvas package for rendering support this handler never uses, and crashes
    // the whole function at module load time on Vercel when that optional dep isn't
    // present. unpdf avoids that class of problem entirely.
    let fullText: string;
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(pdf, { mergePages: true });
      fullText = result.text;
    } catch (err: any) {
      res.status(422).json({ error: `Could not read this PDF: ${err?.message || "unknown error"}` });
      return;
    }

    const esopStart = fullText.search(/Employee Share Ownership Plan \(ESOP\)/i);
    const sarStart = fullText.search(/Employee Share Ownership Plan SAR/i);
    const footerStart = fullText.search(/Your assets by availability date corresponds/i);
    if (esopStart === -1) {
      res.status(422).json({
        error: "Couldn't find the ESOP table in this PDF - is this an Amundi ESR account statement?",
      });
      return;
    }
    const esopEnd = sarStart !== -1 ? sarStart : (footerStart !== -1 ? footerStart : fullText.length);
    const esopBlock = fullText.slice(esopStart, esopEnd);
    const sarBlock = sarStart !== -1 ? fullText.slice(sarStart, footerStart !== -1 ? footerStart : fullText.length) : "";

    const valuationDateMatch = fullText.match(/as of (\d{2}\/\d{2}\/\d{4})/i);
    const valuationDate = valuationDateMatch ? toIsoDate(valuationDateMatch[1]) : undefined;

    const esopRows = extractRows(esopBlock);
    const sarRows = sarBlock ? extractRows(sarBlock) : [];

    if (esopRows.length === 0) {
      res.status(422).json({
        error: "Found the ESOP section but couldn't parse any rows from it - the statement layout may have changed from what this parser expects.",
      });
      return;
    }

    // One consolidated master holding for the whole Capgemini position (symbol CAP), plus
    // a raw lot per vintage row - mirrors eToro's "master + rawLots" shape exactly, so this
    // flows through the app's existing multi-lot import/reconciliation pipeline unchanged.
    const totalQty = esopRows.reduce((s, r) => s + r.quantity, 0);
    const totalCost = esopRows.reduce((s, r) => s + r.quantity * r.price, 0);
    const weightedAvgPrice = totalQty > 0 ? totalCost / totalQty : 0;
    const matchKey = "amundi-cap";

    const holdings = [
      {
        broker: "Amundi ESR",
        holdingType: "stock",
        symbol: "CAP",
        ticker: "CAP.PA",
        isin: "FR0000125338",
        exchange: "EPA",
        quantity: totalQty,
        buyPrice: Number(weightedAvgPrice.toFixed(4)),
        currentPrice: Number(weightedAvgPrice.toFixed(4)),
        currency: "EUR",
        source: "Amundi ESR ESOP",
        matchKey,
      },
    ];

    const rawLots = esopRows.map((r) => {
      const { year, cleanName } = vintageYearOf(r);
      return {
        matchKey,
        externalPositionId: `amundi-esop-${slugify(cleanName)}-${year}`,
        broker: "Amundi ESR",
        quantity: r.quantity,
        buyPrice: r.price,
        currentPrice: r.price,
        openDate: `${year}-01-01`,
        source: `${cleanName} ${year} · vests ${toIsoDate(r.availabilityDate)}`,
      };
    });

    const sarGrants = sarRows.map((r) => {
      const { year, cleanName } = vintageYearOf(r);
      return {
        externalGrantId: `amundi-sar-${slugify(cleanName)}-${year}`,
        broker: "Amundi ESR",
        grantType: "SAR",
        underlyingSymbol: "CAP",
        planLabel: cleanName,
        vintageYear: year,
        availabilityDate: toIsoDate(r.availabilityDate),
        quantity: r.quantity,
        valuePerUnit: r.price,
        valueAmount: r.amount,
        currency: "EUR",
        source: `Amundi ESR SAR${valuationDate ? ` · valued ${valuationDate}` : ""}`,
      };
    });

    res.status(200).json({
      holdings,
      rawLots,
      sarGrants,
      valuationDate,
      esopTotal: Number(totalCost.toFixed(2)),
      sarTotal: Number(sarRows.reduce((s, r) => s + r.amount, 0).toFixed(2)),
      caveat: "Price (€) in this statement is the current redemption/valuation price, not original purchase price - Amundi doesn't include cost basis. Buy price and current price were both set to this figure; edit buy price per lot if you know the real subscription price.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to parse Amundi statement." });
  }
}
