/** USD-per-quote-unit factor for eToro-style CFD holdings whose prices are stored converted to USD
 *  (e.g. JPN225: stored 415 USD per unit, quoted 65,614 index points). Used only to DISPLAY quote values. */
export function quoteFactors(holdings: any[], lots: any[], keyOf: (h: any) => string): Map<string, number> {
  const byHolding = new Map<string, any[]>();
  (lots || []).forEach((l: any) => { const k = String(l.holding_id); byHolding.set(k, [...(byHolding.get(k) || []), l]); });
  const out = new Map<string, number>(); const ts = new Map<string, number>();
  holdings.forEach((h) => {
    if ((h.status || 'active') !== 'active') return;
    const live = Number(h.live_price ?? 0), hl = byHolding.get(String(h.id));
    if (!(live > 0) || !hl || !hl.length) return;
    const cur = Number(hl.find((l: any) => Number(l.current_price) > 0)?.current_price || 0);
    if (!(cur > 0)) return;
    const f = live / cur; if (!(f > 0) || Math.abs(f - 1) < 0.02) return; // same units: nothing to convert
    const k = keyOf(h), t = Date.parse(h.live_price_updated_at || '') || 0;
    if (!ts.has(k) || t >= ts.get(k)!) { out.set(k, f); ts.set(k, t); }
  });
  return out;
}
