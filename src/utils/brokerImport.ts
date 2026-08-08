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
  leverage?: number;
  stopLossRate?: number;
  takeProfitRate?: number;
  etoroNetValueAmount?: number;
}

export type BrokerTemplate = 'zerodha' | 'groww_stocks' | 'groww_mf' | 'universal';
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
