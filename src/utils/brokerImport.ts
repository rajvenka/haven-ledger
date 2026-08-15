import * as XLSX from 'xlsx';

export interface ParsedHolding {
  broker: string;
  holdingType: 'stock' | 'mutual_fund';
  symbol: string;
  isin?: string;
  folioNumber?: string;
  exchange: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  source?: string;
  currency?: 'INR' | 'USD' | 'AUD' | 'EUR' | 'GBP' | 'SGD' | 'AED' | 'CAD';
  buyDate?: string;
  /** Yahoo-style ticker when different from display symbol (e.g. AMD.AX). */
  ticker?: string;
  leverage?: number;
  stopLossRate?: number;
  takeProfitRate?: number;
  etoroNetValueAmount?: number;
  matchKey?: string;
}

export type BrokerTemplate = 'zerodha' | 'groww_stocks' | 'groww_mf' | 'stake' | 'universal' | 'moomoo' | 'tiger' | 'tiger_statement';
export const UNIVERSAL_TEMPLATE_HEADERS = ['Broker', 'Holding Type', 'Symbol', 'ISIN', 'Exchange', 'Quantity', 'Buy Price', 'Current Price', 'Currency', 'Source', 'Folio Number'];
export const UNIVERSAL_TEMPLATE_EXAMPLE_ROW = ['eToro', 'Stock', 'AAPL', '', 'NASDAQ', 10, 150.25, 175.50, 'USD', '', ''];

// These files all have a few preamble rows (client name, summary figures) before
// the actual data table starts, so we scan for the header row instead of assuming row 0.
function findHeaderRowIndex(rows: any[][], mustContainHeader: string): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row?.some(cell => typeof cell === 'string' && cell.trim() === mustContainHeader)) {
      return i;
    }
  }
  return -1;
}

// Proper quoted-CSV line splitter, shared by any CSV-based template below. A naive
// split(',') breaks on real broker exports the moment a numeric field is quoted with an
// embedded thousands-separator comma (e.g. "1,152.75"), silently shifting every column
// after it - confirmed against a real Moomoo Positions export where this caused Currency
// to read "96.85%" instead of "USD" on rows with a 4-digit market value.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function rowsToObjects(rows: any[][], headerIdx: number): Record<string, any>[] {
  const headers = rows[headerIdx].map((h: any) => String(h ?? '').trim());
  const out: Record<string, any>[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === undefined || c === null || c === '')) continue;
    const obj: Record<string, any> = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    out.push(obj);
  }
  return out;
}

function parseZerodhaSheet(rows: any[][], holdingType: 'stock' | 'mutual_fund'): ParsedHolding[] {
  const headerIdx = findHeaderRowIndex(rows, 'Symbol');
  if (headerIdx === -1) return [];
  const records = rowsToObjects(rows, headerIdx);
  return records
    .filter(r => r['Symbol'])
    .map(r => ({
      broker: 'Zerodha' as const,
      holdingType,
      symbol: String(r['Symbol']).trim(),
      isin: r['ISIN'] ? String(r['ISIN']).trim() : undefined,
      exchange: 'NSE' as const,
      quantity: (Number(r['Quantity Available']) || 0) + (Number(r['Quantity Pledged (Margin)']) || 0),
      buyPrice: Number(r['Average Price']) || 0,
      currentPrice: Number(r['Previous Closing Price']) || 0,
    }))
    .filter(h => h.quantity > 0);
}


/** Stake (AU) Portfolio Valuation export (as downloaded from Stake).
 *
 * Real Stake XLSX has separate tabs:
 *   - "Aus Equities"     → Symbol | Name | Weighting | Units | Mkt. Price | Mkt. Value          (AUD / ASX)
 *   - "Wall St Equities" → Symbol | Name | Weighting | Units | Mkt. Price | Mkt. Value (US$)…  (USD / US)
 *   - Summary / Disclaimers ignored
 *
 * Older single-sheet exports with in-sheet section headers are still supported.
 * No average cost in file — buyPrice starts at market price (edit cost later).
 */
function stakeHeaderIndexes(headers: string[]) {
  const idxSymbol = headers.findIndex(h => /^symbol$/i.test(h));
  const idxUnits = headers.findIndex(h => /^units$/i.test(h) || /^qty$/i.test(h) || /^quantity$/i.test(h));
  const idxMktPrice = headers.findIndex(h => /^mkt\.?\s*price$/i.test(h) || /^market\s*price$/i.test(h) || /^price$/i.test(h));
  const idxName = headers.findIndex(h => /^name$/i.test(h) || /^company$/i.test(h));
  return { idxSymbol, idxUnits, idxMktPrice, idxName };
}

function parseStakeDataRows(
  rows: any[][],
  headerIdx: number,
  section: 'aus' | 'wall',
  statementDate?: string,
): ParsedHolding[] {
  const results: ParsedHolding[] = [];
  const headers = (rows[headerIdx] || []).map((h: any) => String(h ?? '').trim());
  const { idxSymbol, idxUnits, idxMktPrice, idxName } = stakeHeaderIndexes(headers);
  if (idxSymbol < 0 || idxUnits < 0) return results;

  const buyDate = statementDate || new Date().toISOString().slice(0, 10);

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const data = rows[r] || [];
    const dataJoined = data.map((c: any) => String(c ?? '').trim()).join(' ').toLowerCase();
    if (
      dataJoined.includes('aus equities') ||
      dataJoined.includes('wall st') ||
      dataJoined.includes('disclaimer') ||
      dataJoined.includes('glossary') ||
      dataJoined.includes('report type')
    ) {
      break;
    }
    const sym = String(data[idxSymbol] ?? '').trim();
    if (!sym || /^(symbol|equities|disclaimer|glossary|summary|name|total)$/i.test(sym)) continue;

    const units = Number(String(data[idxUnits] ?? '').replace(/,/g, ''));
    if (!Number.isFinite(units) || units === 0) continue;

    let price = idxMktPrice >= 0 ? Number(String(data[idxMktPrice] ?? '').replace(/[$,]/g, '')) : NaN;
    if (!Number.isFinite(price) || price < 0) price = 0;

    const name = idxName >= 0 && data[idxName] != null ? String(data[idxName]).trim() : undefined;

    const code = sym.toUpperCase();
    if (section === 'aus') {
      // ASX codes can collide with US tickers (e.g. AMD = Arrow Minerals on ASX,
      // Advanced Micro Devices on NASDAQ). Tag + .AX ticker keep them distinct.
      results.push({
        holdingType: 'stock',
        broker: 'Stake',
        symbol: code,
        ticker: code.endsWith('.AX') ? code : `${code}.AX`,
        exchange: 'ASX',
        quantity: units,
        buyPrice: price,
        currentPrice: price,
        buyDate,
        currency: 'AUD',
        source: 'Stake AU',
      });
    } else {
      results.push({
        holdingType: 'stock',
        broker: 'Stake',
        symbol: code,
        ticker: code,
        exchange: 'US',
        quantity: units,
        buyPrice: price,
        currentPrice: price,
        buyDate,
        currency: 'USD',
        source: 'Stake US',
      });
    }
  }
  return results;
}

/** Parse one sheet: either a dedicated Aus/Wall St tab, or legacy in-sheet sections. */
function parseStakeRows(rows: any[][], sheetName?: string, statementDate?: string): ParsedHolding[] {
  const results: ParsedHolding[] = [];
  const nameLower = String(sheetName || '').toLowerCase().trim();

  // --- Preferred path: Stake's multi-tab export ---
  // Sheet is already "Aus Equities" or "Wall St Equities" with header on row 1.
  // IMPORTANT: do NOT use /us\s*equit/ — it matches inside "Aus Equities" ("us equit").
  const sheetIsAus = /\baus\b.*equit/i.test(nameLower) || /^aus\s*equit/i.test(nameLower);
  const sheetIsWall =
    /wall\s*st/i.test(nameLower) ||
    /wall\s*street/i.test(nameLower) ||
    /^us\s*equit/i.test(nameLower) ||
    /\bus\s+equit/i.test(nameLower);
  if (sheetIsAus || sheetIsWall) {
    let headerIdx = -1;
    for (let j = 0; j < Math.min(rows.length, 15); j++) {
      const r = rows[j] || [];
      if (r.some((c: any) => /^symbol$/i.test(String(c ?? '').trim()))) {
        headerIdx = j;
        break;
      }
    }
    if (headerIdx >= 0) {
      // Prefer Aus when both somehow match (Aus name is unambiguous).
      const section: 'aus' | 'wall' = sheetIsAus ? 'aus' : 'wall';
      results.push(...parseStakeDataRows(rows, headerIdx, section, statementDate));
    }
    return results;
  }

  // --- Legacy / alternate: section headers inside one sheet ---
  let i = 0;
  while (i < rows.length) {
    const row = rows[i] || [];
    const cells = row.map((c: any) => String(c ?? '').trim());
    const joined = cells.join(' ').toLowerCase();
    const isAus = cells.some((c: string) => /^aus equities$/i.test(c)) || joined.includes('aus equities');
    const isWall =
      cells.some((c: string) => /wall\s*st equities/i.test(c)) ||
      joined.includes('wall st equities') ||
      joined.includes('wall street equities');
    if (!isAus && !isWall) {
      i++;
      continue;
    }
    const section: 'aus' | 'wall' = isWall ? 'wall' : 'aus';
    let headerIdx = -1;
    for (let j = i; j < Math.min(i + 10, rows.length); j++) {
      const r = rows[j] || [];
      if (r.some((c: any) => /^symbol$/i.test(String(c ?? '').trim()))) {
        headerIdx = j;
        break;
      }
    }
    if (headerIdx === -1) {
      i++;
      continue;
    }
    const chunk = parseStakeDataRows(rows, headerIdx, section, statementDate);
    results.push(...chunk);
    // Advance past this section's data rows
    i = headerIdx + 1 + chunk.length;
    // Also skip until next section-looking row or end
    while (i < rows.length) {
      const joined2 = (rows[i] || []).map((c: any) => String(c ?? '').trim()).join(' ').toLowerCase();
      if (joined2.includes('aus equities') || joined2.includes('wall st')) break;
      if (joined2.includes('disclaimer') || joined2.includes('glossary')) break;
      i++;
    }
  }

  // --- Fallback: sheet has Symbol/Units/Mkt.Price header but no section title ---
  // Treat as AUD ASX if sheet name suggests AU, else try to detect from columns.
  if (results.length === 0) {
    let headerIdx = -1;
    for (let j = 0; j < Math.min(rows.length, 20); j++) {
      const headers = (rows[j] || []).map((h: any) => String(h ?? '').trim());
      const hasSymbol = headers.some(h => /^symbol$/i.test(h));
      const hasUnits = headers.some(h => /^units$/i.test(h));
      const hasPrice = headers.some(h => /mkt\.?\s*price|market\s*price|^price$/i.test(h));
      if (hasSymbol && hasUnits && hasPrice) {
        headerIdx = j;
        break;
      }
    }
    if (headerIdx >= 0) {
      const headers = (rows[headerIdx] || []).map((h: any) => String(h ?? '').trim()).join(' ').toLowerCase();
      const looksAus = /\baus\b|asx|a\$/.test(headers) || /\baus\b|asx/.test(nameLower);
      const looksUsd = /us\$|\busd\b|wall\s*st/.test(headers) || /wall\s*st|wall\s*street/.test(nameLower);
      const section: 'aus' | 'wall' = looksAus ? 'aus' : looksUsd ? 'wall' : 'aus';
      results.push(...parseStakeDataRows(rows, headerIdx, section, statementDate));
    }
  }

  return results;
}

function extractStakeStatementDate(workbook: XLSX.WorkBook): string | undefined {
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null }) as any[][];
    for (const row of rows.slice(0, 30)) {
      for (const cell of row || []) {
        const s = String(cell ?? '');
        // "Statement Date: 2026-08-10" or "Report Type: Portfolio Valuation as at 2026-08-10"
        const m =
          s.match(/Statement\s*Date\s*:\s*(\d{4}-\d{2}-\d{2})/i) ||
          s.match(/as\s+at\s+(\d{4}-\d{2}-\d{2})/i) ||
          s.match(/Statement\s*Date\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (m) {
          const raw = m[1];
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
          const parts = raw.split('/');
          if (parts.length === 3) {
            // Stake AU often DD/MM/YYYY
            const [d, mo, y] = parts;
            return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
        }
      }
    }
  }
  return undefined;
}

export async function parseBrokerFile(file: File, template: BrokerTemplate): Promise<ParsedHolding[]> {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: 'array' });

  if (template === 'zerodha') {
    // Zerodha's own export contains multiple sheets in one file - Equity (stocks) and
    // Mutual Funds - so both get parsed automatically instead of needing separate uploads
    // or manual re-tagging after the fact.
    const results: ParsedHolding[] = [];
    const equitySheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'equity') || workbook.SheetNames[0];
    if (equitySheetName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[equitySheetName], { header: 1, defval: null }) as any[][];
      results.push(...parseZerodhaSheet(rows, 'stock'));
    }
    const mfSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('mutual fund'));
    if (mfSheetName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[mfSheetName], { header: 1, defval: null }) as any[][];
      results.push(...parseZerodhaSheet(rows, 'mutual_fund'));
    }
    if (results.length === 0) throw new Error("Couldn't find any holdings - is this a Zerodha holdings export?");
    return results;
  }

  if (template === 'stake') {
    const statementDate = extractStakeStatementDate(workbook);
    const results: ParsedHolding[] = [];
    // Prefer named tabs from Stake's own download: "Aus Equities", "Wall St Equities"
    const equitySheets = workbook.SheetNames.filter((n) => {
      const s = String(n || '').toLowerCase();
      const isAus = /\baus\b.*equit/i.test(s) || /^aus\s*equit/i.test(s);
      const isWall = /wall\s*st/i.test(s) || /wall\s*street/i.test(s) || /^us\s*equit/i.test(s);
      return isAus || isWall;
    });
    const sheetsToScan = equitySheets.length > 0 ? equitySheets : workbook.SheetNames;
    for (const sheetName of sheetsToScan) {
      if (/disclaimer|glossary/i.test(sheetName)) continue;
      const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null }) as any[][];
      results.push(...parseStakeRows(sheetRows, sheetName, statementDate));
    }
    // Last resort: scan every remaining sheet
    if (results.length === 0) {
      for (const sheetName of workbook.SheetNames) {
        if (/disclaimer/i.test(sheetName)) continue;
        const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null }) as any[][];
        results.push(...parseStakeRows(sheetRows, sheetName, statementDate));
      }
    }
    if (results.length === 0) {
      throw new Error(
        "Couldn't find Stake holdings. Upload Stake's Portfolio Valuation XLSX as downloaded (tabs: Aus Equities / Wall St Equities with Symbol, Units, Mkt. Price)."
      );
    }
    return results;
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (template === 'universal') {
    const headerIdx = findHeaderRowIndex(rows, 'Symbol');
    if (headerIdx === -1) throw new Error("Couldn't find the 'Symbol' column - did you use the downloaded Universal Template?");
    const records = rowsToObjects(rows, headerIdx);
    const validCurrencies = ['INR', 'USD', 'AUD', 'EUR', 'GBP', 'SGD', 'AED', 'CAD'];
    return records
      .filter(r => r['Symbol'] && Number(r['Quantity']) > 0)
      .map(r => {
        const holdingTypeRaw = String(r['Holding Type'] ?? 'Stock').trim().toLowerCase();
        const currencyRaw = String(r['Currency'] ?? 'INR').trim().toUpperCase();
        return {
          broker: String(r['Broker'] ?? 'Other').trim() || 'Other',
          holdingType: holdingTypeRaw.startsWith('mutual') || holdingTypeRaw === 'mf' ? 'mutual_fund' as const : 'stock' as const,
          symbol: String(r['Symbol']).trim(),
          isin: r['ISIN'] ? String(r['ISIN']).trim() : undefined,
          folioNumber: r['Folio Number'] ? String(r['Folio Number']).trim() : undefined,
          exchange: String(r['Exchange'] ?? '').trim() || 'Other',
          quantity: Number(r['Quantity']) || 0,
          buyPrice: Number(r['Buy Price']) || 0,
          currentPrice: r['Current Price'] != null && r['Current Price'] !== '' ? Number(r['Current Price']) : (Number(r['Buy Price']) || 0),
          source: r['Source'] ? String(r['Source']).trim() : undefined,
          currency: (validCurrencies.includes(currencyRaw) ? currencyRaw : 'INR') as ParsedHolding['currency'],
        };
      });
  }

  if (template === 'moomoo' || template === 'tiger') {
    const brokerName = template === 'moomoo' ? 'Moomoo' : 'Tiger';
    // Flexible CSV: Symbol, Quantity, Buy Price / Avg Cost, Current / Market Price, Currency.
    // Uses the quoted-CSV-aware splitCsvLine (not a naive comma-split) since real exports
    // quote numeric fields with thousands-separator commas (e.g. "1,152.75"), which a plain
    // split(',') mis-parses and silently shifts every later column.
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error(`Empty ${brokerName} file`);
    const split = (line: string) => splitCsvLine(line).map((s) => s.replace(/^"|"$/g, ''));
    const headers = split(lines[0]).map((h) => h.toLowerCase());
    const find = (...keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
    const iSym = find('symbol', 'ticker', 'code', 'stock');
    const iQty = find('qty', 'quantity', 'shares', 'units', 'position');
    const iBuy = find('avg', 'cost', 'buy', 'entry');
    const iMkt = find('market', 'last', 'current', 'price', 'mkt');
    const iCcy = find('currency', 'ccy');
    if (iSym < 0 || iQty < 0) {
      throw new Error(`${brokerName}: need Symbol and Quantity columns (CSV export from app)`);
    }
    const out: ParsedHolding[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = split(lines[i]);
      if (!cols[iSym]) continue;
      const qty = Number(String(cols[iQty] || '').replace(/,/g, ''));
      if (!Number.isFinite(qty) || qty === 0) continue;
      const buy = Number(String(cols[iBuy >= 0 ? iBuy : -1] || '').replace(/,/g, '')) || 0;
      const mkt = Number(String(cols[iMkt >= 0 ? iMkt : -1] || '').replace(/,/g, '')) || buy;
      const ccy = (iCcy >= 0 ? cols[iCcy] : 'USD') || 'USD';
      out.push({
        broker: brokerName,
        holdingType: 'stock',
        symbol: cols[iSym].toUpperCase(),
        exchange: ccy.toUpperCase() === 'AUD' ? 'ASX' : 'US',
        quantity: Math.abs(qty),
        buyPrice: buy,
        currentPrice: mkt,
        currency: ccy.toUpperCase(),
        source: brokerName,
      });
    }
    if (!out.length) throw new Error(`No holdings found in ${brokerName} CSV`);
    return out;
  }

  if (template === 'tiger_statement') {
    // Real Tiger Brokers (AU) "Activity Statement" export - a multi-section report dumped
    // as one CSV, not a plain single-table file. Every section shares the same shape:
    // col0 = section name ("Holdings", "Cash Report", ...), col1 = sub-type ("Stock", ...),
    // col2 = mostly unused, col3 = row kind (blank on the header row itself, "DATA" for a
    // real row, "TOTAL"/"HEADER_DATA" for summary rows to skip), col4+ = the actual fields,
    // matching whatever the section's own header row lists at col4+ (e.g. Symbol, Quantity,
    // Cost Price, Close Price, Currency for Holdings). Field lookups below are by header
    // name, not fixed position, since that's the part Tiger could plausibly reorder.
    const text = (await file.text()).replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/);
    let headerCols: string[] | null = null;
    const dataRows: string[][] = [];
    for (const raw of lines) {
      if (!raw.trim()) continue;
      const cols = splitCsvLine(raw);
      if (cols[0] !== 'Holdings') continue;
      if (!headerCols && cols.includes('Symbol') && cols.includes('Quantity')) {
        headerCols = cols;
        continue;
      }
      if (headerCols && cols[3] === 'DATA') dataRows.push(cols);
    }
    if (!headerCols) {
      throw new Error("Couldn't find a Holdings section - is this a Tiger Brokers (AU) Activity Statement CSV export?");
    }
    const idx = (name: string) => headerCols!.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    const iType = 1;
    const iSymbol = idx('Symbol');
    const iQty = idx('Quantity');
    const iCost = idx('Cost Price');
    const iClose = idx('Close Price');
    const iCcy = idx('Currency');
    if (iSymbol < 0 || iQty < 0) {
      throw new Error('Tiger statement: could not find Symbol/Quantity columns in the Holdings section.');
    }
    const exchangeForCcy = (ccy: string): string => {
      switch (ccy.toUpperCase()) {
        case 'AUD': return 'ASX';
        case 'HKD': return 'HKEX';
        case 'SGD': return 'SGX';
        default: return 'US';
      }
    };
    const out: ParsedHolding[] = [];
    for (const cols of dataRows) {
      // "Symbol" here is actually "Full Name (TICKER)" (e.g. "Micron Technology (MU)") -
      // the clean ticker lives in the trailing parentheses; falls back to the raw text
      // (unlikely, but avoids silently dropping a row) if that pattern isn't there.
      const rawSymbol = String(cols[iSymbol] || '').trim();
      if (!rawSymbol) continue;
      const qty = Number(String(cols[iQty] || '').replace(/,/g, ''));
      if (!Number.isFinite(qty) || qty === 0) continue;
      const m = rawSymbol.match(/\(([^()]+)\)\s*$/);
      const ticker = (m ? m[1] : rawSymbol).trim().toUpperCase();
      const buy = iCost >= 0 ? Number(String(cols[iCost] || '').replace(/,/g, '')) || 0 : 0;
      const cur = iClose >= 0 ? (Number(String(cols[iClose] || '').replace(/,/g, '')) || buy) : buy;
      const ccy = ((iCcy >= 0 ? cols[iCcy] : '') || 'USD').toUpperCase();
      const holdingType = String(cols[iType] || '').toLowerCase().includes('fund') ? 'mutual_fund' as const : 'stock' as const;
      out.push({
        broker: 'Tiger',
        holdingType,
        symbol: ticker,
        exchange: exchangeForCcy(ccy),
        quantity: Math.abs(qty),
        buyPrice: buy,
        currentPrice: cur,
        currency: ccy as ParsedHolding['currency'],
        source: 'Tiger',
      });
    }
    if (!out.length) throw new Error("No DATA rows found in the Holdings section - check this is a Tiger Brokers Activity Statement.");
    return out;
  }

  if (template === 'groww_stocks') {
    const headerIdx = findHeaderRowIndex(rows, 'Stock Name');
    if (headerIdx === -1) throw new Error("Couldn't find the 'Stock Name' column - is this a Groww stocks holdings export?");
    const records = rowsToObjects(rows, headerIdx);
    return records
      .filter(r => r['Stock Name'])
      .map(r => ({
        broker: 'Groww' as const,
        holdingType: 'stock' as const,
        symbol: String(r['Stock Name']).trim(),
        isin: r['ISIN'] ? String(r['ISIN']).trim() : undefined,
        exchange: 'NSE' as const,
        quantity: Number(r['Quantity']) || 0,
        buyPrice: Number(r['Average buy price']) || 0,
        currentPrice: Number(r['Closing price']) || 0,
      }))
      .filter(h => h.quantity > 0);
  }

  // groww_mf
  const headerIdx = findHeaderRowIndex(rows, 'Scheme Name');
  if (headerIdx === -1) throw new Error("Couldn't find the 'Scheme Name' column - is this a Groww mutual funds export?");
  const records = rowsToObjects(rows, headerIdx);
  return records
    .filter(r => r['Scheme Name'] && Number(r['Units']) > 0)
    .filter(r => String(r['Source'] ?? '').trim() !== 'External') // external funds are always excluded - they add confusion, not value, to this tracker
    .map(r => {
      const units = Number(r['Units']) || 0;
      const invested = Number(r['Invested Value']) || 0;
      const current = Number(r['Current Value']) || 0;
      return {
        broker: 'Groww' as const,
        holdingType: 'mutual_fund' as const,
        symbol: String(r['Scheme Name']).trim(),
        isin: undefined, // Groww's MF export doesn't include ISIN
        folioNumber: r['Folio No.'] ? String(r['Folio No.']).trim() : undefined, // the same fund name can appear more than once under different folios - folio number, not name, is what's actually unique
        exchange: 'NSE' as const,
        quantity: units,
        buyPrice: units > 0 ? invested / units : 0,
        currentPrice: units > 0 ? current / units : 0,
        source: r['Source'] && String(r['Source']).trim() === 'External' ? 'External' : undefined,
      };
    });
}

// Extracts the date this snapshot represents, so multiple dated exports can be
// processed as a historical timeline. Zerodha embeds it in the sheet ("...as on
// YYYY-MM-DD"); Groww embeds it in the filename (DD-MM-YYYY).
export function extractFileDate(fileName: string, workbook: XLSX.WorkBook, template: BrokerTemplate): string | null {
  if (template === 'tiger_statement') {
    // Statement_<account>_<startYYYYMMDD>_<endYYYYMMDD>.csv - anchored to end-of-filename
    // (not just "8 digits, underscore, 8 digits" anywhere) because the account number
    // itself is often 8 digits too and would otherwise false-match as a date range.
    const m = fileName.match(/(\d{4})(\d{2})(\d{2})_(\d{4})(\d{2})(\d{2})\.csv$/i);
    if (m) return `${m[4]}-${m[5]}-${m[6]}`; // period end date
    return null;
  }
  if (template === 'stake') {
    // PORTFOLIO_VALUATION_YYYY-MM-DD-....xlsx or "as at YYYY-MM-DD" / Statement Date in sheet
    const fromName = fileName.match(/(20\d{2}-\d{2}-\d{2})/);
    if (fromName) return fromName[1];
    for (const sheetName of workbook.SheetNames) {
      const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null }) as any[][];
      for (const row of sheetRows) {
        for (let c = 0; c < (row?.length || 0); c++) {
          const cell = row[c];
          if (typeof cell !== 'string') continue;
          const lower = cell.toLowerCase();
          const mAt = cell.match(/as at\s+(20\d{2}-\d{2}-\d{2})/i);
          if (mAt) return mAt[1];
          if (/statement date/i.test(cell)) {
            const next = row[c + 1];
            if (next != null) {
              const s = String(next).trim();
              const iso = s.match(/(20\d{2}-\d{2}-\d{2})/);
              if (iso) return iso[1];
              const dmy = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/);
              if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
            }
          }
          if (lower.includes('valuation') || lower.includes('statement')) {
            const iso = cell.match(/(20\d{2}-\d{2}-\d{2})/);
            if (iso) return iso[1];
          }
        }
      }
    }
    return null;
  }
  if (template === 'zerodha') {
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null }) as any[][];
      for (const row of rows) {
        for (const cell of row) {
          if (typeof cell === 'string') {
            const m = cell.match(/as on (\d{4}-\d{2}-\d{2})/);
            if (m) return m[1];
          }
        }
      }
    }
    return null;
  }
  // Groww: filename contains DD-MM-YYYY
  const m = fileName.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

export async function parseBrokerFileWithDate(file: File, template: BrokerTemplate): Promise<{ holdings: ParsedHolding[]; fileDate: string | null }> {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: 'array' });
  const fileDate = extractFileDate(file.name, workbook, template);
  const holdings = await parseBrokerFile(file, template);
  return { holdings, fileDate };
}

// Generates and downloads a blank starter file with the right columns, so people don't
// have to guess the Universal Template's format - one example row shows the expected
// shape, everything else is left empty for them to fill in.
export function downloadUniversalTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([UNIVERSAL_TEMPLATE_HEADERS, UNIVERSAL_TEMPLATE_EXAMPLE_ROW]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Holdings');
  XLSX.writeFile(wb, 'haven-vault-universal-template.xlsx');
}
