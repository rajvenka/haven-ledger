import * as XLSX from 'xlsx';

export interface ParsedHolding {
  broker: 'Zerodha' | 'Groww';
  holdingType: 'stock' | 'mutual_fund';
  symbol: string;
  isin?: string;
  exchange: 'NSE' | 'BSE';
  quantity: number;
  buyPrice: number;
  currentPrice: number;
}

export type BrokerTemplate = 'zerodha_stocks' | 'groww_stocks' | 'groww_mf';

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

export async function parseBrokerFile(file: File, template: BrokerTemplate): Promise<ParsedHolding[]> {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (template === 'zerodha_stocks') {
    const headerIdx = findHeaderRowIndex(rows, 'Symbol');
    if (headerIdx === -1) throw new Error("Couldn't find the 'Symbol' column - is this a Zerodha holdings export?");
    const records = rowsToObjects(rows, headerIdx);
    return records
      .filter(r => r['Symbol'])
      .map(r => ({
        broker: 'Zerodha' as const,
        holdingType: 'stock' as const,
        symbol: String(r['Symbol']).trim(),
        isin: r['ISIN'] ? String(r['ISIN']).trim() : undefined,
        exchange: 'NSE' as const,
        quantity: (Number(r['Quantity Available']) || 0) + (Number(r['Quantity Pledged (Margin)']) || 0),
        buyPrice: Number(r['Average Price']) || 0,
        currentPrice: Number(r['Previous Closing Price']) || 0,
      }))
      .filter(h => h.quantity > 0);
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
    .map(r => {
      const units = Number(r['Units']) || 0;
      const invested = Number(r['Invested Value']) || 0;
      const current = Number(r['Current Value']) || 0;
      return {
        broker: 'Groww' as const,
        holdingType: 'mutual_fund' as const,
        symbol: String(r['Scheme Name']).trim(),
        isin: undefined, // Groww's MF export doesn't include ISIN, folio number isn't a reliable dedup key alone
        exchange: 'NSE' as const,
        quantity: units,
        buyPrice: units > 0 ? invested / units : 0,
        currentPrice: units > 0 ? current / units : 0,
      };
    });
}
