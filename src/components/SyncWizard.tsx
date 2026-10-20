import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, Upload, Plug, ChevronRight, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { parseBrokerFile, BrokerTemplate, ParsedHolding, downloadUniversalTemplate } from '../utils/brokerImport';
import { startZerodhaLogin } from '../utils/zerodhaAuth';

/** Step-by-step wizard: pick source -> fetch/parse -> review changes -> apply. Same reconcile rules as the classic Sync. */

export interface SyncWizardProps {
  open: boolean;
  onClose: () => void;
  initial?: { mode?: 'file' | 'connection'; connectionId?: string } | null;
  connections: any[];
  portfolios: any[];
  holdings: any[];
  portfolioMode?: string;
  isReadOnly?: boolean;
  onConnectNew?: () => void;
  bulkAddPortfolioHoldings?: (rows: any[], portfolioId?: string) => Promise<any>;
  reconcilePortfolioHoldingQuantity?: (...a: any[]) => Promise<any>;
  updatePortfolioHolding?: (id: string, u: any) => Promise<any>;
  markPortfolioHoldingSoldFromImport?: (id: string, price: number) => Promise<any>;
  syncEtoroHoldingLots?: (...a: any[]) => Promise<any>;
  syncEtoroLivePrices?: (...a: any[]) => Promise<any>;
  markBrokerConnectionSynced?: (id: string) => Promise<any>;
  setPortfolioBrokerConnection?: (...a: any[]) => Promise<any>;
  loadPortfolioDetails?: () => Promise<any>;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function normalizeSourceTag(raw: string | null | undefined, h?: any): string | null {
  if (h && String(h.holding_type || '').toLowerCase().startsWith('option')) return 'Options';
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim(); const l = s.toLowerCase();
  if (l.includes('option')) return 'Options';
  if (l.includes('cfd') || l.includes('leveraged')) return 'CFD';
  if (l.includes('real asset') || l.includes('real ass')) return 'Real Asset';
  if (l.includes('crypto')) return 'Crypto';
  if (l.includes('future')) return 'Futures';
  if (l.includes('zerodha')) return 'Zerodha';
  if (l.includes('groww')) return 'Groww';
  if (l.includes('stake')) return 'Stake';
  if (l.startsWith('webull')) return 'Webull';
  if (l.startsWith('etoro')) return l.includes('cfd') ? 'CFD' : l.includes('real') ? 'Real Asset' : 'eToro';
  const cleaned = s.replace(/\s*·\s*[A-Z0-9]{4,}$/i, '').trim();
  return /option/i.test(cleaned) ? 'Options' : cleaned;
}

const LIVE = ['etoro', 'webull', 'zerodha', 'groww'];
const TEMPLATES: [BrokerTemplate, string][] = [['universal', 'Universal CSV'], ['zerodha', 'Zerodha'], ['groww_stocks', 'Groww stocks'], ['groww_mf', 'Groww MF'], ['stake', 'Stake'], ['moomoo', 'Moomoo'], ['tiger', 'Tiger']];
const TEMPLATE_BROKER: Record<string, string> = { moomoo: 'Moomoo', tiger: 'Tiger', stake: 'Stake' };
const isTokenToday = (c: any) => { if (!c?.updated_at) return false; const d = new Date(c.updated_at), n = new Date(); return d.toDateString() === n.toDateString(); };

export default function SyncWizard(p: SyncWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [conn, setConn] = useState<any | null>(null);
  const [template, setTemplate] = useState<BrokerTemplate>('universal');
  const [bookId, setBookId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reauth, setReauth] = useState<any | null>(null);
  const [parsed, setParsed] = useState<ParsedHolding[] | null>(null);
  const [rawLots, setRawLots] = useState<any[]>([]);
  const [inc, setInc] = useState({ fresh: true, qty: true, price: true, live: true });
  const [missingSel, setMissingSel] = useState<Set<string>>(new Set());
  const [missingPx, setMissingPx] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<{ ok: boolean; counts: Record<string, number>; errors: string[] } | null>(null);

  const multi = p.portfolioMode === 'multiple';

  const reset = () => { setStep(1); setConn(null); setErr(null); setReauth(null); setParsed(null); setRawLots([]); setMissingSel(new Set()); setResult(null); setLog([]); setBusy(false); };
  useEffect(() => { if (p.open) { reset(); setBookId(p.portfolios[0]?.id || ''); if (p.initial?.mode === 'file') setStep(2); if (p.initial?.mode === 'connection' && p.initial.connectionId) { const c = p.connections.find((x) => x.id === p.initial!.connectionId); if (c) pickConnection(c); } } /* eslint-disable-next-line */ }, [p.open]);

  const targetPid = (): string | undefined => (multi ? (conn?.portfolio_id || bookId || undefined) : undefined);

  // ---- fetching ----
  const fetchFromBroker = async (c: any): Promise<{ holdings: ParsedHolding[]; rawLots?: any[] }> => {
    const type = String(c.broker_type || '').toLowerCase();
    const cred = c.credentials || {};
    const post = async (body: any) => {
      const resp = await fetch('/api/portfolio-broker-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await resp.json().catch(() => ({}));
      return { resp, data };
    };
    if (type === 'etoro') {
      const w = p.connections.find((x) => x.broker_type === 'webull');
      const { resp, data } = await post({ broker: 'etoro', apiKey: cred.api_key, userKey: cred.user_key, webullAppKey: w?.credentials?.app_key, webullAppSecret: w?.credentials?.app_secret, webullToken: w?.credentials?.token, webullRegion: w?.credentials?.region });
      if (!resp.ok) throw new Error(data?.error || `eToro sync failed (${resp.status})`);
      return { holdings: data.holdings ?? [], rawLots: data.rawLots ?? [] };
    }
    if (type === 'webull') {
      if (!cred.token) throw new Error('Webull token missing - reconnect and approve on your phone first.');
      const { resp, data } = await post({ broker: 'webull', action: 'sync', appKey: cred.app_key, appSecret: cred.app_secret, region: cred.region ?? 'us', token: cred.token });
      if (!resp.ok) throw new Error(data?.error || `Webull sync failed (${resp.status})`);
      return { holdings: data.holdings ?? [] };
    }
    if (type === 'zerodha') {
      if (!isTokenToday(c)) { setReauth(c); throw new Error('Zerodha login expired (tokens last one trading day).'); }
      const { resp, data } = await post({ broker: 'zerodha', action: 'sync', apiKey: cred.api_key, accessToken: cred.access_token, includeMf: true });
      if (!resp.ok) { if (resp.status === 401 || resp.status === 403 || /TokenException|access_token/i.test(data?.error || '')) setReauth(c); throw new Error(data?.error || `Zerodha sync failed (${resp.status})`); }
      return { holdings: (data.holdings || []).map((h: any) => ({ ...h, buyDate: todayStr() })) };
    }
    if (type === 'groww') {
      const { resp, data } = await post({ broker: 'groww', action: 'sync', apiKey: cred.api_key, apiSecret: cred.api_secret, accessToken: cred.access_token });
      if (!resp.ok) throw new Error(data?.error || `Groww sync failed (${resp.status})`);
      if (data.accessToken && data.accessToken !== cred.access_token) { try { await p.setPortfolioBrokerConnection?.('groww', { ...cred, access_token: data.accessToken }, c.portfolio_id || undefined, c.connection_label || undefined); } catch { /* non-fatal */ } }
      return { holdings: (data.holdings || []).map((h: any) => ({ ...h, buyDate: todayStr() })) };
    }
    throw new Error(`Live sync isn't available for ${type}. Use "Upload a file" instead.`);
  };

  const pickConnection = async (c: any) => {
    setConn(c); setStep(2); setBusy(true); setErr(null); setReauth(null);
    try {
      const { holdings, rawLots: lots } = await fetchFromBroker(c);
      if (!holdings.length) throw new Error('The broker returned no positions.');
      setRawLots(lots ?? []); setParsed(holdings); setStep(3);
    } catch (e: any) { setErr(e?.message || 'Could not reach the broker.'); }
    finally { setBusy(false); }
  };

  const onFile = async (f: File) => {
    setBusy(true); setErr(null);
    try {
      const rows = await parseBrokerFile(f, template);
      if (!rows.length) throw new Error('No holdings found in that file. Check the template choice.');
      const tag = TEMPLATE_BROKER[template];
      setParsed(rows.map((r) => ({ ...r, broker: r.broker || tag || 'Import', buyDate: r.buyDate || todayStr() })));
      setStep(3);
    } catch (e: any) { setErr(e?.message || 'Could not read the file.'); }
    finally { setBusy(false); }
  };

  // ---- classify (same rules as classic) ----
  const classify = (row: ParsedHolding, pid?: string) => {
    const existing = p.holdings.find((h) => {
      if (h.status !== 'active') return false;
      if (h.broker !== row.broker) return false;
      if (multi && (h.portfolio_id ?? null) !== (pid ?? null)) return false;
      if (row.isin && h.isin) return h.isin === row.isin;
      if (row.folioNumber && h.folio_number) return h.folio_number === row.folioNumber && h.symbol === row.symbol.toUpperCase();
      if (row.source && h.source) {
        const same = h.source === row.source || normalizeSourceTag(h.source, h) === normalizeSourceTag(row.source, { holding_type: row.holdingType, source: row.source });
        return h.symbol === row.symbol.toUpperCase() && h.holding_type === row.holdingType && same && !h.folio_number && !row.folioNumber;
      }
      return h.symbol === row.symbol.toUpperCase() && h.holding_type === row.holdingType && !h.folio_number && !row.folioNumber;
    });
    if (!existing) return { status: 'new' as const };
    if (Number(existing.quantity) === row.quantity) return Math.abs(Number(existing.buy_price) - row.buyPrice) > 0.01 ? { status: 'price' as const, existing } : { status: 'same' as const, existing };
    return { status: 'qty' as const, existing, dir: row.quantity > Number(existing.quantity) ? 'increased' : 'reduced' };
  };

  const plan = useMemo(() => {
    if (!parsed) return null;
    const pid = targetPid();
    const fresh: ParsedHolding[] = []; const qty: any[] = []; const price: any[] = []; const live: any[] = []; let same = 0;
    parsed.forEach((r) => {
      const c: any = classify(r, pid);
      if (c.status === 'new') fresh.push(r);
      else if (c.status === 'qty') qty.push({ row: r, existing: c.existing, dir: c.dir });
      else if (c.status === 'price') price.push({ row: r, existing: c.existing });
      else { same++; if (r.leverage != null || r.stopLossRate != null || r.etoroNetValueAmount != null) live.push({ row: r, existing: c.existing }); }
    });
    const types = new Set(parsed.map((r) => `${r.broker}|${r.holdingType}`));
    const missing = p.holdings.filter((h) => {
      if (h.status !== 'active') return false;
      if (!types.has(`${h.broker}|${h.holding_type}`)) return false;
      if (multi && (h.portfolio_id ?? null) !== (pid ?? null)) return false;
      return !parsed.some((r) => {
        if (r.isin && h.isin) return h.isin === r.isin;
        if (r.folioNumber && h.folio_number) return h.folio_number === r.folioNumber && h.symbol === r.symbol.toUpperCase();
        if (!(h.symbol === r.symbol.toUpperCase() && h.holding_type === r.holdingType && !h.folio_number && !r.folioNumber)) return false;
        // CFD and Real Asset are separate holdings: a same-symbol row of the other type doesn't keep this one alive.
        if (r.source && h.source) return h.source === r.source || normalizeSourceTag(h.source, h) === normalizeSourceTag(r.source, { holding_type: r.holdingType, source: r.source });
        return true;
      });
    });
    return { fresh, qty, price, live, same, missing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, p.holdings, conn, bookId]);

  const changeCount = plan ? (inc.fresh ? plan.fresh.length : 0) + (inc.qty ? plan.qty.length : 0) + (inc.price ? plan.price.length : 0) + (inc.live ? plan.live.length : 0) + missingSel.size : 0;

  const [copied, setCopied] = useState(false);
  const buildLog = () => {
    if (!parsed || !plan) return '';
    const pid = targetPid();
    const f = (n: any, d = 4) => (n == null || n === '' || isNaN(Number(n)) ? '-' : String(Math.round(Number(n) * 10 ** d) / 10 ** d));
    const out: string[] = [`SYNC COMPARISON ${new Date().toISOString()} | ${conn?.connection_label || conn?.broker_type || 'file'} | positions from broker: ${parsed.length} | raw lots: ${rawLots.length}`, ''];
    out.push('== POSITIONS (broker vs app) ==');
    [...parsed].sort((a, b) => a.symbol.localeCompare(b.symbol)).forEach((r) => {
      const c: any = classify(r, pid);
      const ex = c.existing;
      const lots = rawLots.filter((l) => l.matchKey && l.matchKey === (r as any).matchKey);
      const lq = lots.reduce((t, l) => t + Number(l.quantity || 0), 0);
      const la = lq ? lots.reduce((t, l) => t + Number(l.quantity || 0) * Number(l.buyPrice || 0), 0) / lq : 0;
      out.push(`${r.symbol} [${r.source || '-'}] broker: qty ${f(r.quantity)} @ ${f(r.buyPrice)} | app: ${ex ? `qty ${f(ex.quantity)} @ ${f(ex.buy_price)} [${ex.source || '-'}]` : 'NOT FOUND'} | ${String(c.status).toUpperCase()}${c.dir ? ' ' + c.dir : ''} | lots: ${lots.length} (qty ${f(lq)}, avg ${f(la)})${lots.length && Math.abs(lq - Number(r.quantity)) > 1e-6 ? ' !LOT QTY MISMATCH' : ''}`);
      lots.forEach((l) => out.push(`    lot ${l.externalPositionId} ${l.source || ''} qty ${f(l.quantity)} @ ${f(l.buyPrice)} lev ${f(l.leverage, 1)} opened ${l.openDate || '-'}`));
    });
    out.push('', '== IN APP BUT NOT IN BROKER DATA ==');
    if (!plan.missing.length) out.push('(none)');
    plan.missing.forEach((h: any) => out.push(`${h.symbol} [${h.source || '-'}] qty ${f(h.quantity)} @ ${f(h.buy_price)}`));
    return out.join('\n');
  };
  const copyLog = async () => {
    const t = buildLog();
    try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // ---- apply ----
  const apply = async () => {
    if (!plan || !parsed) return;
    setStep(4); setBusy(true); setLog([]);
    const errors: string[] = []; const counts: Record<string, number> = { added: 0, quantity: 0, cost: 0, refreshed: 0, sold: 0 };
    const say = (m: string) => setLog((l) => [...l, m]);
    const pid = targetPid();
    const buyDate = todayStr();
    try {
      if (inc.fresh && plan.fresh.length) {
        say(`Adding ${plan.fresh.length} new holdings…`);
        try {
          await p.bulkAddPortfolioHoldings?.(plan.fresh.map((h) => ({ holdingType: h.holdingType, broker: h.broker, symbol: h.symbol, isin: h.isin, folioNumber: h.folioNumber, exchange: h.exchange, ticker: (h as any).ticker, quantity: h.quantity, buyPrice: h.buyPrice, buyDate, currentPrice: h.currentPrice, source: h.source || conn?.broker_type || undefined, currency: h.currency, leverage: h.leverage, stopLossRate: h.stopLossRate, takeProfitRate: h.takeProfitRate, etoroNetValueAmount: h.etoroNetValueAmount })), pid);
          counts.added = plan.fresh.length;
        } catch (e: any) { errors.push(`New holdings: ${e?.message || 'failed'}`); }
      }
      if (inc.qty && plan.qty.length) {
        say(`Updating ${plan.qty.length} changed quantities…`);
        for (const { row, existing, dir } of plan.qty) {
          try {
            await p.reconcilePortfolioHoldingQuantity?.(existing.id, row.quantity, dir === 'increased' ? 'qty_increased' : 'qty_reduced', row.buyPrice !== Number(existing.buy_price) ? row.buyPrice : undefined, dir === 'reduced' ? (row.currentPrice ?? existing.live_price ?? existing.current_price ?? existing.buy_price) : row.currentPrice, dir === 'reduced' ? Number(existing.buy_price) : undefined);
            if (row.leverage != null || row.stopLossRate != null || row.etoroNetValueAmount != null || (row.currency && row.currency !== existing.currency)) await p.updatePortfolioHolding?.(existing.id, { currentPrice: row.currentPrice, leverage: row.leverage, stopLossRate: row.stopLossRate, takeProfitRate: row.takeProfitRate, etoroNetValueAmount: row.etoroNetValueAmount, currency: row.currency });
            counts.quantity++;
          } catch (e: any) { errors.push(`${row.symbol} (quantity): ${e?.message || 'failed'}`); }
        }
      }
      if (inc.price && plan.price.length) {
        say(`Correcting ${plan.price.length} average costs…`);
        for (const { row, existing } of plan.price) {
          try { await p.updatePortfolioHolding?.(existing.id, { buyPrice: row.buyPrice, currentPrice: row.currentPrice, leverage: row.leverage, stopLossRate: row.stopLossRate, takeProfitRate: row.takeProfitRate, etoroNetValueAmount: row.etoroNetValueAmount, currency: row.currency }); counts.cost++; }
          catch (e: any) { errors.push(`${row.symbol} (cost): ${e?.message || 'failed'}`); }
        }
      }
      if (inc.live && plan.live.length) {
        say(`Refreshing live fields on ${plan.live.length} holdings…`);
        for (const { row, existing } of plan.live) {
          try { await p.updatePortfolioHolding?.(existing.id, { currentPrice: row.currentPrice, leverage: row.leverage, stopLossRate: row.stopLossRate, takeProfitRate: row.takeProfitRate, etoroNetValueAmount: row.etoroNetValueAmount, currency: row.currency }); counts.refreshed++; }
          catch (e: any) { errors.push(`${row.symbol} (refresh): ${e?.message || 'failed'}`); }
        }
      }
      if (missingSel.size) {
        say(`Marking ${missingSel.size} as sold…`);
        for (const h of plan.missing) {
          if (!missingSel.has(h.id)) continue;
          try { const v = missingPx[h.id]; await p.markPortfolioHoldingSoldFromImport?.(h.id, v !== undefined && v !== '' ? parseFloat(v) : Number(h.live_price ?? h.current_price ?? h.buy_price)); counts.sold++; }
          catch (e: any) { errors.push(`${h.symbol} (sold): ${e?.message || 'failed'}`); }
        }
      }
      if (rawLots.length) {
        say('Saving individual lots…');
        try {
          const keyToSym = new Map<string, string>(parsed.filter((h) => h.matchKey).map((h) => [h.matchKey as string, h.symbol]));
          const bySym = new Map<string, any[]>();
          for (const lot of rawLots) { const s = keyToSym.get(lot.matchKey); if (s) bySym.set(s, [...(bySym.get(s) ?? []), lot]); }
          await p.syncEtoroHoldingLots?.(Array.from(bySym.keys()), bySym, pid);
        } catch (e: any) { errors.push(`Lots: ${e?.message || 'failed'}`); }
      }
      const px = new Map<string, number>(parsed.filter((h) => h.matchKey && h.currentPrice != null).map((h) => [h.symbol, h.currentPrice as number]));
      if (px.size) { say('Updating live prices…'); try { await p.syncEtoroLivePrices?.(px, pid); } catch (e: any) { errors.push(`Live prices: ${e?.message || 'failed'}`); } }
      if (conn) { try { await p.markBrokerConnectionSynced?.(conn.id); } catch { /* ignore */ } }
      await p.loadPortfolioDetails?.();
    } catch (e: any) { errors.push(e?.message || 'Unexpected error'); }
    setResult({ ok: errors.length === 0, counts, errors });
    setBusy(false);
  };

  if (!p.open) return null;
  const steps = ['Source', 'Fetch', 'Review', 'Apply'];
  const bookName = (id?: string) => p.portfolios.find((x) => x.id === id)?.name || '';

  const Row = ({ k, label, n, tone, children, check }: { k: string; label: string; n: number; tone: string; children?: React.ReactNode; check?: React.ReactNode }) => (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        {check}
        <button onClick={() => setOpen(open === k ? null : k)} className="flex-1 flex items-center gap-2 text-left"><span className={`text-xs font-black px-2 py-0.5 rounded-full ${tone}`}>{n}</span><span className="text-sm font-black">{label}</span><ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open === k ? 'rotate-90' : ''}`} /></button>
      </div>
      {open === k && n > 0 && <div className="border-t border-slate-100 dark:border-slate-800 max-h-48 overflow-auto text-xs">{children}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => !busy && p.onClose()}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between"><h3 className="text-base font-black">Sync &amp; import</h3><button disabled={busy} onClick={p.onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button></div>
          <div className="flex items-center gap-2 mt-3">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5"><span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}</span><span className={`text-[11px] font-black ${step === i + 1 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{s}</span></div>
                {i < 3 && <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {step === 1 && (
            <>
              <p className="text-sm text-slate-500">Where do you want to bring positions in from?</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {p.connections.map((c) => {
                  const type = String(c.broker_type || '').toLowerCase(); const live = LIVE.includes(type); const stale = type === 'zerodha' && !isTokenToday(c);
                  return (
                    <button key={c.id} disabled={!live || p.isReadOnly} onClick={() => pickConnection(c)} className="text-left rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 p-4 disabled:opacity-50">
                      <div className="flex items-center gap-2"><Plug className="w-4 h-4 text-indigo-500" /><span className="text-sm font-black truncate">{c.connection_label || c.broker_type}</span></div>
                      <div className="text-[11px] text-slate-500 mt-1">{bookName(c.portfolio_id) || 'Workspace'} · last sync {c.last_synced_at ? new Date(c.last_synced_at).toLocaleDateString() : 'never'}</div>
                      {stale && <div className="text-[11px] font-bold text-amber-600 mt-1">Login needed first</div>}
                    </button>
                  );
                })}
                <button disabled={p.isReadOnly} onClick={() => setStep(2)} className="text-left rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 p-4">
                  <div className="flex items-center gap-2"><Upload className="w-4 h-4 text-indigo-500" /><span className="text-sm font-black">Upload a file</span></div>
                  <div className="text-[11px] text-slate-500 mt-1">CSV / XLSX from Moomoo, Tiger, Stake, Zerodha, Groww…</div>
                </button>
                {p.onConnectNew && <button onClick={() => { p.onClose(); p.onConnectNew!(); }} className="text-left rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:border-indigo-400"><div className="text-sm font-black">+ Connect a new broker</div><div className="text-[11px] text-slate-500 mt-1">Add API keys once, then sync in one click</div></button>}
              </div>
            </>
          )}

          {step === 2 && !conn && (
            <>
              <div><div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">1. What kind of file?</div>
                <div className="flex flex-wrap gap-1.5">{TEMPLATES.map(([id, l]) => <button key={id} onClick={() => setTemplate(id)} className={`px-3 py-1.5 rounded-full text-xs font-black ${template === id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{l}</button>)}</div>
                {template === 'universal' && <button onClick={() => downloadUniversalTemplate()} className="text-[11px] font-bold text-indigo-600 mt-1.5">Download the universal template</button>}</div>
              {multi && p.portfolios.length > 0 && <div><div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">2. Which portfolio?</div>
                <div className="flex flex-wrap gap-1.5">{p.portfolios.map((b: any) => <button key={b.id} onClick={() => setBookId(b.id)} className={`px-3 py-1.5 rounded-full text-xs font-black ${bookId === b.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{b.name}</button>)}</div></div>}
              <div><div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{multi ? '3.' : '2.'} Choose the file</div>
                <label className={`block py-8 rounded-2xl border-2 border-dashed text-center text-sm font-black cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : 'border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20'}`}>
                  {busy ? 'Reading file…' : 'Click to choose a file'}
                  <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.tsv,text/csv" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
                </label></div>
            </>
          )}

          {step === 2 && conn && (
            <div className="py-6 text-center space-y-3">
              {busy && <><Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-500" /><div className="text-sm font-black">Fetching positions from {conn.connection_label || conn.broker_type}…</div><div className="text-xs text-slate-500">This can take up to a minute for large accounts.</div></>}
              {!busy && err && (
                <>
                  <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
                  <div className="text-sm font-black">{err}</div>
                  {reauth && String(reauth.broker_type).toLowerCase() === 'zerodha' && reauth.credentials?.api_key && reauth.credentials?.api_secret && (
                    <button onClick={() => startZerodhaLogin({ apiKey: reauth.credentials.api_key, apiSecret: reauth.credentials.api_secret, portfolioId: reauth.portfolio_id || undefined, label: reauth.connection_label || 'Zerodha' })} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-black">Log in to Zerodha now</button>
                  )}
                  {reauth && String(reauth.broker_type).toLowerCase() === 'groww' && p.onConnectNew && <button onClick={() => { p.onClose(); p.onConnectNew!(); }} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-black">Re-authorize Groww</button>}
                  {String(conn.broker_type).toLowerCase() === 'groww' && (<div className="space-y-1"><div className="text-xs text-slate-500">Check or regenerate your API key and secret on Groww, then update the connection.</div><a href="https://groww.in/trade-api/api-keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black">Open Groww API keys ↗</a></div>)}
                  <div><button onClick={() => pickConnection(conn)} className="inline-flex items-center gap-1 text-xs font-black text-indigo-600"><RefreshCw className="w-3 h-3" /> Try again</button></div>
                </>
              )}
            </div>
          )}

          {step === 2 && !conn && err && <div className="text-sm font-bold text-rose-600">{err}</div>}

          {step === 3 && plan && (
            <>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">Found <b>{parsed?.length}</b> positions{conn ? ` from ${conn.connection_label || conn.broker_type}` : ' in your file'}{multi && targetPid() ? ` → ${bookName(targetPid())}` : ''}. Tick what you want to apply. <button onClick={copyLog} className="ml-2 font-black text-indigo-600 underline">{copied ? 'Copied ✓' : 'Copy comparison log'}</button></div>
              <div className="space-y-2">
                <Row k="fresh" label="New holdings" n={plan.fresh.length} tone="bg-emerald-100 text-emerald-700" check={<input type="checkbox" checked={inc.fresh} onChange={(e) => setInc({ ...inc, fresh: e.target.checked })} />}>{plan.fresh.map((h, i) => <div key={i} className="flex justify-between px-3 py-1.5 border-t first:border-t-0 border-slate-100 dark:border-slate-800"><b>{h.symbol}</b><span>{h.quantity} @ {h.buyPrice} {h.currency}</span></div>)}</Row>
                <Row k="qty" label="Quantity changed" n={plan.qty.length} tone="bg-indigo-100 text-indigo-700" check={<input type="checkbox" checked={inc.qty} onChange={(e) => setInc({ ...inc, qty: e.target.checked })} />}>{plan.qty.map((x, i) => <div key={i} className="flex justify-between px-3 py-1.5 border-t first:border-t-0 border-slate-100 dark:border-slate-800"><b>{x.row.symbol}</b><span>{Number(x.existing.quantity)} → {x.row.quantity} <i className={x.dir === 'reduced' ? 'text-rose-500' : 'text-emerald-600'}>({x.dir})</i></span></div>)}</Row>
                <Row k="price" label="Average cost corrected" n={plan.price.length} tone="bg-amber-100 text-amber-700" check={<input type="checkbox" checked={inc.price} onChange={(e) => setInc({ ...inc, price: e.target.checked })} />}>{plan.price.map((x, i) => <div key={i} className="flex justify-between px-3 py-1.5 border-t first:border-t-0 border-slate-100 dark:border-slate-800"><b>{x.row.symbol}</b><span>{Number(x.existing.buy_price).toFixed(2)} → {x.row.buyPrice.toFixed(2)}</span></div>)}</Row>
                <Row k="live" label="Live fields refreshed (stop, leverage…)" n={plan.live.length} tone="bg-sky-100 text-sky-700" check={<input type="checkbox" checked={inc.live} onChange={(e) => setInc({ ...inc, live: e.target.checked })} />}>{plan.live.map((x, i) => <div key={i} className="px-3 py-1.5 border-t first:border-t-0 border-slate-100 dark:border-slate-800"><b>{x.row.symbol}</b></div>)}</Row>
                <Row k="missing" label="Not in the new data — mark as sold?" n={plan.missing.length} tone="bg-rose-100 text-rose-700">
                  {plan.missing.map((h) => (
                    <div key={h.id} className="flex items-center gap-2 px-3 py-1.5 border-t first:border-t-0 border-slate-100 dark:border-slate-800">
                      <input type="checkbox" checked={missingSel.has(h.id)} onChange={(e) => { const n = new Set(missingSel); e.target.checked ? n.add(h.id) : n.delete(h.id); setMissingSel(n); }} />
                      <b className="flex-1">{h.symbol}</b><span className="text-slate-400">sold at</span>
                      <input value={missingPx[h.id] ?? String(Number(h.live_price ?? h.current_price ?? h.buy_price))} onChange={(e) => setMissingPx({ ...missingPx, [h.id]: e.target.value })} className="w-20 text-right px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
                    </div>
                  ))}
                </Row>
                <div className="text-[11px] text-slate-400 px-1">{plan.same} positions are already up to date.</div>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="py-4 space-y-3">
              {busy && <div className="text-center space-y-2"><Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-500" /><div className="text-sm font-black">Applying changes…</div></div>}
              <div className="text-xs text-slate-500 space-y-0.5">{log.map((l, i) => <div key={i}>✓ {l}</div>)}</div>
              {result && (
                <div className={`rounded-2xl p-4 ${result.ok ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-amber-50 dark:bg-amber-950/20'}`}>
                  <div className="text-sm font-black">{result.ok ? 'All done' : 'Done, with a few issues'}</div>
                  <div className="text-xs mt-1">{result.counts.added} added · {result.counts.quantity} quantities · {result.counts.cost} costs · {result.counts.refreshed} refreshed · {result.counts.sold} sold</div>
                  {result.errors.slice(0, 6).map((e, i) => <div key={i} className="text-[11px] text-rose-600 mt-1">{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-5 py-3 flex items-center justify-between">
          <button disabled={busy || step === 1 || (step === 4 && !result)} onClick={() => (step === 4 ? (reset()) : (setStep((step - 1) as any), setErr(null), setConn(null), step === 3 && setParsed(null)))} className="text-xs font-black text-slate-500 disabled:opacity-30">{step === 4 ? 'Start over' : 'Back'}</button>
          {step === 3 && <button disabled={changeCount === 0} onClick={apply} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40">Apply {changeCount} change{changeCount === 1 ? '' : 's'}</button>}
          {step === 4 && result && <button onClick={p.onClose} className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-black">Close</button>}
        </div>
      </div>
    </div>
  );
}
