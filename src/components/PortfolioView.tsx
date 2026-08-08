import { parseBrokerFile, parseBrokerFileWithDate, BrokerTemplate, ParsedHolding, downloadUniversalTemplate } from '../utils/brokerImport';
import * as XLSX from 'xlsx';
import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Plus, Trash2, RefreshCw, Users, Wallet, Banknote,
  CheckCircle2, X, Briefcase, Gift, Receipt, Upload, Edit2, ChevronDown, ArrowUpDown, Settings, ChevronUp, Download, Search, PieChart
} from 'lucide-react';

interface WorkspaceMemberLite {
  uid: string;
  displayName?: string;
  email: string;
}

interface PortfolioViewProps {
  workspaceName?: string;
  workspaceMembers: WorkspaceMemberLite[];
  isReadOnly?: boolean;
  isDataLoading?: boolean;
  columnPrefs?: { key: string; visible: boolean }[] | null;
  onUpdateColumnPrefs?: (prefs: { key: string; visible: boolean }[] | null) => Promise<void>;
  portfolioSplits: any[];
  portfolioCashBalances: any[];
  portfolioBookedPlBaselines?: any[];
  portfolioProjectedBankBalances?: any[];
  setPortfolioCashBalance?: (location: 'Zerodha' | 'Groww' | 'Bank' | 'Other', amount: number, asOfDate?: string, notes?: string, portfolioId?: string) => Promise<void>;
  deletePortfolioCashBalance?: (id: string) => Promise<void>;
  setBookedPlBaseline?: (amount: number, date: string, portfolioId?: string) => Promise<void>;
  setProjectedBankBalance?: (amount: number, portfolioId?: string) => Promise<void>;
  recalculateProjectedBankBalance?: (portfolioId?: string) => Promise<void>;
  portfolioBrokerConnections?: any[];
  setPortfolioBrokerConnection?: (brokerType: 'etoro' | 'ig' | 'webull', credentials: Record<string, string>, portfolioId?: string) => Promise<void>;
  deletePortfolioBrokerConnection?: (id: string) => Promise<void>;
  markBrokerConnectionSynced?: (id: string) => Promise<void>;
  addPortfolioSplit: (memberUserId: string, percent: number, from: string, to?: string) => Promise<void>;
  deletePortfolioSplit: (id: string) => Promise<void>;
  portfolioHoldings: any[];
  portfolioPriceHistory: any[];
  addPortfolioHolding: (h: {
    holdingType?: 'stock' | 'mutual_fund'; broker: string; symbol: string; isin?: string; exchange: string; quantity: number; buyPrice: number; buyDate: string; currentPrice?: number; notes?: string;
    source?: string; currency?: 'INR' | 'USD' | 'AUD'; portfolioId?: string;
    targetType?: 'price' | 'percent'; targetPrice?: number; targetPercent?: number;
    holdType?: 'days' | 'date'; holdDays?: number; holdUntilDate?: string;
  }) => Promise<void>;
  bulkAddPortfolioHoldings: (holdings: {
    holdingType: 'stock' | 'mutual_fund'; broker: string; symbol: string; isin?: string; exchange: string; quantity: number; buyPrice: number; buyDate: string; currentPrice?: number; source?: string; currency?: string;
  }[], portfolioId?: string) => Promise<void>;
  portfolios?: any[];
  portfolioMode?: 'single' | 'multiple';
  workspaceCurrencyRates?: any[];
  mfHoldingsCache?: any[];
  loadMfHoldingsCache?: () => Promise<void>;
  fetchAndCacheMfHoldings?: (isin: string | null, name: string) => Promise<any>;
  saveManualMfHoldings?: (holdingId: string, schemeName: string, rows: { stockName: string; weightPct: number }[]) => Promise<void>;
  baseCurrency?: string;
  reconcilePortfolioHoldingQuantity: (id: string, newQuantity: number, changeFlag: 'qty_increased' | 'qty_reduced', newBuyPrice?: number, currentPriceForSoldPortion?: number, soldItemBuyPrice?: number) => Promise<void>;
  markPortfolioHoldingSoldFromImport?: (id: string, currentPrice?: number) => Promise<void>;
  bulkHistoricalImport: (snapshots: { date: string; holdings: any[] }[], portfolioId?: string) => Promise<{ newCount: number; updatedCount: number; soldCount: number; skippedStaleCount: number; priceHistoryCount: number; stockCount: number }>;
  updatePortfolioHolding: (id: string, updates: any) => Promise<void>;
  sellPortfolioHolding: (id: string, params: { quantity: number; soldPrice: number; soldDate: string }) => Promise<void>;
  updatePortfolioHoldingLivePrice: (id: string, price: number, previousClose?: number | null) => Promise<void>;
  markPriceLookupFailed: (id: string) => Promise<void>;
  deletePortfolioHolding: (id: string) => Promise<void>;
  bulkTagPortfolioHoldings: (holdingIds: string[], source: string) => Promise<void>;
  bulkDeletePortfolioHoldings: (holdingIds: string[]) => Promise<void>;
  deleteAllPortfolioData: () => Promise<void>;
  portfolioSnapshots: any[];
  takePortfolioSnapshot: (date: string, groups: { label: string; invested: number; current: number }[]) => Promise<void>;
  deletePortfolioSnapshotBatch: (date: string) => Promise<void>;
  portfolioContributions: any[];
  addPortfolioContribution: (memberUserId: string, amount: number, date: string, notes?: string, contributionType?: 'one_off' | 'recurring' | 'initial') => Promise<void>;
  updatePortfolioContribution: (id: string, updates: { amount?: number; contributionDate?: string }) => Promise<void>;
  deletePortfolioContribution: (id: string) => Promise<void>;
  portfolioWithdrawals: any[];
  addPortfolioWithdrawal: (memberUserId: string, amount: number, date: string, notes?: string) => Promise<void>;
  deletePortfolioWithdrawal: (id: string) => Promise<void>;
  portfolioDividends: any[];
  addPortfolioDividend: (symbol: string, amount: number, date: string, holdingId?: string, notes?: string) => Promise<void>;
  deletePortfolioDividend: (id: string) => Promise<void>;
  portfolioFees: any[];
  addPortfolioFee: (broker: string, feeType: string, amount: number, date: string, notes?: string) => Promise<void>;
  deletePortfolioFee: (id: string) => Promise<void>;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Currency-aware formatter for multi-portfolio mode - single-portfolio workspaces never
// call this, fmt() above stays exactly as it always has for them.
const CURRENCY_META: Record<string, { symbol: string; locale: string }> = {
  INR: { symbol: '₹', locale: 'en-IN' },
  USD: { symbol: '$', locale: 'en-US' },
  AUD: { symbol: 'A$', locale: 'en-AU' },
  EUR: { symbol: '€', locale: 'en-IE' },
  GBP: { symbol: '£', locale: 'en-GB' },
  SGD: { symbol: 'S$', locale: 'en-SG' },
  AED: { symbol: 'AED ', locale: 'en-AE' },
  CAD: { symbol: 'C$', locale: 'en-CA' },
};
const fmtCur = (n: number, currency: string = 'INR') => {
  const meta = CURRENCY_META[currency] || { symbol: `${currency} `, locale: 'en-US' };
  return `${meta.symbol}${n.toLocaleString(meta.locale, { maximumFractionDigits: 2 })}`;
};
// Converts an amount from its own currency into the workspace's base currency using
// workspace_currency_rates. rate_to_base means "1 unit of this currency = rate_to_base
// units of the base currency" (e.g. for USD with an INR base, 1 USD = 83 INR, so
// rate_to_base = 83) - the more intuitive everyday direction to think in and enter,
// rather than the reverse (how many dollars is one rupee). Falls back to the raw amount
// unconverted if no rate has been set yet, rather than silently hiding data - better to
// show something clearly than nothing at all.
const convertToBase = (amount: number, fromCurrency: string, baseCurrency: string, rates: any[]): number => {
  if (fromCurrency === baseCurrency) return amount;
  const rate = rates.find((r: any) => r.currency === fromCurrency)?.rate_to_base;
  if (!rate) return amount;
  return amount * rate;
};
const fmtQty = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);

// Generic CSV export - takes column headers and row objects keyed by header, handles
// quoting/escaping for values containing commas, quotes, or newlines. Used by both the
// Active and Sold tabs, each building their own rows from whatever's currently filtered/sorted.
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escapeCell).join(','), ...rows.map(r => r.map(escapeCell).join(','))];
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Instrument is always shown, pinned first - everything else is configurable (show/hide + reorder).
const DEFAULT_COLUMNS: { key: string; label: string; align: 'text-left' | 'text-right' }[] = [
  { key: 'quantity', label: 'Qty', align: 'text-right' },
  { key: 'buy_price', label: 'Buy Price', align: 'text-right' },
  { key: 'current_price', label: 'LTP', align: 'text-right' },
  { key: 'live_price', label: 'Live Price', align: 'text-right' },
  { key: 'daily_change', label: 'Daily Change', align: 'text-right' },
  { key: 'since_previous_load', label: 'Since Previous Load', align: 'text-right' },
  { key: 'invested', label: 'Invested', align: 'text-right' },
  { key: 'current_value', label: 'Cur. Value', align: 'text-right' },
  { key: 'gain', label: 'Net Gain', align: 'text-right' },
  { key: 'gain_pct', label: '% Chg', align: 'text-right' },
  { key: 'since_reference', label: 'Since Reference (%)', align: 'text-right' },
  { key: 'since_reference_amount', label: 'Since Reference ($)', align: 'text-right' },
];
const todayStr = () => new Date().toISOString().slice(0, 10);
const memberName = (m: WorkspaceMemberLite) => m.displayName || m.email.split('@')[0];

export default function PortfolioView(props: PortfolioViewProps) {
  const {
    workspaceName, workspaceMembers, isReadOnly, isDataLoading, columnPrefs, onUpdateColumnPrefs,
    portfolioSplits, addPortfolioSplit, deletePortfolioSplit, portfolioCashBalances, portfolioBookedPlBaselines = [], portfolioProjectedBankBalances = [],
    setPortfolioCashBalance, deletePortfolioCashBalance, setBookedPlBaseline, setProjectedBankBalance, recalculateProjectedBankBalance,
    portfolioBrokerConnections = [], setPortfolioBrokerConnection, deletePortfolioBrokerConnection, markBrokerConnectionSynced,
    portfolioHoldings, portfolioPriceHistory, addPortfolioHolding, bulkAddPortfolioHoldings, reconcilePortfolioHoldingQuantity, markPortfolioHoldingSoldFromImport, bulkHistoricalImport, updatePortfolioHolding, sellPortfolioHolding, updatePortfolioHoldingLivePrice, markPriceLookupFailed, deletePortfolioHolding, bulkTagPortfolioHoldings, bulkDeletePortfolioHoldings, deleteAllPortfolioData, portfolios = [], portfolioMode = 'single', workspaceCurrencyRates = [], baseCurrency = 'INR',
    mfHoldingsCache = [], loadMfHoldingsCache, fetchAndCacheMfHoldings, saveManualMfHoldings,
    portfolioSnapshots, takePortfolioSnapshot, deletePortfolioSnapshotBatch,
    portfolioContributions, addPortfolioContribution, updatePortfolioContribution, deletePortfolioContribution,
    portfolioWithdrawals, addPortfolioWithdrawal, deletePortfolioWithdrawal,
    portfolioDividends, addPortfolioDividend, deletePortfolioDividend,
    portfolioFees, addPortfolioFee, deletePortfolioFee,
  } = props;

  const [formError, setFormError] = useState<string | null>(null);

  const runAction = async (fn: () => Promise<any>) => {
    setFormError(null);
    try {
      await fn();
    } catch (err: any) {
      console.error('Portfolio action failed:', err);
      setFormError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  // ---- Holdings ----
  const [isAddingHolding, setIsAddingHolding] = useState(false);
  const [hHoldingType, setHHoldingType] = useState<'stock' | 'mutual_fund'>('stock');
  const [hBroker, setHBroker] = useState<'Zerodha' | 'Groww' | 'Other'>('Zerodha');
  const [hSymbol, setHSymbol] = useState('');
  const [hExchange, setHExchange] = useState<'NSE' | 'BSE'>('NSE');
  const [hQty, setHQty] = useState('');
  const [hPrice, setHPrice] = useState('');
  const [hDate, setHDate] = useState(todayStr());
  const [hSource, setHSource] = useState('');
  const [hPortfolioId, setHPortfolioId] = useState('');
  const [importPortfolioId, setImportPortfolioId] = useState('');
  const [importPortfolioConfirmed, setImportPortfolioConfirmed] = useState(false);
  const [historicalPortfolioId, setHistoricalPortfolioId] = useState('');
  const [historicalPortfolioConfirmed, setHistoricalPortfolioConfirmed] = useState(false);
  const defaultPortfolioId = portfolios.find((p: any) => p.is_default)?.id || portfolios[0]?.id || '';
  const [hCurrency, setHCurrency] = useState<'INR' | 'USD' | 'AUD'>('INR');
  const [showTargetPlan, setShowTargetPlan] = useState(false);
  const [hTargetType, setHTargetType] = useState<'price' | 'percent'>('percent');
  const [hTargetValue, setHTargetValue] = useState('');
  const [hHoldType, setHHoldType] = useState<'days' | 'date'>('days');
  const [hHoldDays, setHHoldDays] = useState('');
  const [hHoldUntilDate, setHHoldUntilDate] = useState('');
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [expandedHoldingId, setExpandedHoldingId] = useState<string | null>(null);
  const [expandedQtyId, setExpandedQtyId] = useState<string | null>(null);
  const [expandedNameId, setExpandedNameId] = useState<string | null>(null);
  const [editingSoldTickerId, setEditingSoldTickerId] = useState<string | null>(null);
  const [soldTickerInput, setSoldTickerInput] = useState('');
  const [isConfirmingWipe, setIsConfirmingWipe] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isCustomizingColumns, setIsCustomizingColumns] = useState(false);
  const [draftColumns, setDraftColumns] = useState<{ key: string; visible: boolean }[]>([]);

  // Merge saved prefs with the default set - handles a saved list that's missing a
  // newly-added column (appends it visible) so nothing silently disappears after an update.
  const resolvedColumns = useMemo(() => {
    if (!columnPrefs || columnPrefs.length === 0) return DEFAULT_COLUMNS.map(c => ({ ...c, visible: true }));
    const byKey = new Map(columnPrefs.map(p => [p.key, p.visible]));
    const ordered = columnPrefs
      .map(p => DEFAULT_COLUMNS.find(c => c.key === p.key))
      .filter((c): c is typeof DEFAULT_COLUMNS[0] => !!c)
      .map(c => ({ ...c, visible: byKey.get(c.key) ?? true }));
    const missing = DEFAULT_COLUMNS.filter(c => !byKey.has(c.key)).map(c => ({ ...c, visible: true }));
    return [...ordered, ...missing];
  }, [columnPrefs]);

  const visibleColumns = resolvedColumns.filter(c => c.visible);

  // Exports exactly what's currently visible: respects the Column customizer's show/hide
  // and order, and whatever filter/sort is currently applied to the table.
  const exportActiveHoldingsCsv = () => {
    const headers = ['Instrument', ...(portfolioMode === 'multiple' ? ['Portfolio'] : []), ...visibleColumns.map(c => c.label)];
    const getValue = (col: typeof visibleColumns[0], h: any): string | number => {
      switch (col.key) {
        case 'quantity': return h.quantity;
        case 'buy_price': return Number(h.buy_price).toFixed(2);
        case 'current_price': return Number(h.current_price ?? h.buy_price).toFixed(2);
        case 'live_price': return h.live_price != null ? Number(h.live_price).toFixed(2) : '';
        case 'daily_change': return h.live_price != null && h.previous_close != null ? ((Number(h.live_price) - Number(h.previous_close)) * Number(h.quantity)).toFixed(2) : '';
        case 'since_previous_load': return h.live_price != null ? ((Number(h.live_price) - Number(h.current_price ?? h.buy_price)) * Number(h.quantity)).toFixed(2) : '';
        case 'invested': return (Number(h.buy_price) * Number(h.quantity)).toFixed(2);
        case 'current_value': return (Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity)).toFixed(2);
        case 'gain': return ((Number(h.live_price ?? h.current_price ?? h.buy_price) - Number(h.buy_price)) * Number(h.quantity)).toFixed(2);
        case 'gain_pct': return Number(h.buy_price) > 0 ? (((Number(h.live_price ?? h.current_price ?? h.buy_price) - Number(h.buy_price)) / Number(h.buy_price)) * 100).toFixed(2) : '';
        case 'since_reference': { const pct = getSinceReferencePct(h); return pct !== null ? pct.toFixed(2) : ''; }
        case 'since_reference_amount': { const amt = getSinceReferenceAmount(h); return amt !== null ? amt.toFixed(2) : ''; }
        default: return '';
      }
    };
    const portfolioNameOf = (h: any) => portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned';
    const rows = filteredActiveHoldings.map(h => [h.symbol, ...(portfolioMode === 'multiple' ? [portfolioNameOf(h)] : []), ...visibleColumns.map(col => getValue(col, h))]);
    downloadCsv(`haven-vault-holdings-active-${todayStr()}.csv`, headers, rows);
  };

  // One sheet per portfolio - unlike CSV, XLSX genuinely supports this. Only useful (and
  // only shown) when more than one portfolio is actually present in the current filtered
  // set - a single-portfolio export doesn't need separate sheets.
  const exportActiveHoldingsXlsx = () => {
    const headers = ['Instrument', ...visibleColumns.map(c => c.label)];
    const getValue = (col: typeof visibleColumns[0], h: any): string | number => {
      switch (col.key) {
        case 'quantity': return h.quantity;
        case 'buy_price': return Number(h.buy_price).toFixed(2);
        case 'current_price': return Number(h.current_price ?? h.buy_price).toFixed(2);
        case 'live_price': return h.live_price != null ? Number(h.live_price).toFixed(2) : '';
        case 'daily_change': return h.live_price != null && h.previous_close != null ? ((Number(h.live_price) - Number(h.previous_close)) * Number(h.quantity)).toFixed(2) : '';
        case 'since_previous_load': return h.live_price != null ? ((Number(h.live_price) - Number(h.current_price ?? h.buy_price)) * Number(h.quantity)).toFixed(2) : '';
        case 'invested': return (Number(h.buy_price) * Number(h.quantity)).toFixed(2);
        case 'current_value': return (Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity)).toFixed(2);
        case 'gain': return ((Number(h.live_price ?? h.current_price ?? h.buy_price) - Number(h.buy_price)) * Number(h.quantity)).toFixed(2);
        case 'gain_pct': return Number(h.buy_price) > 0 ? (((Number(h.live_price ?? h.current_price ?? h.buy_price) - Number(h.buy_price)) / Number(h.buy_price)) * 100).toFixed(2) : '';
        case 'since_reference': { const pct = getSinceReferencePct(h); return pct !== null ? pct.toFixed(2) : ''; }
        case 'since_reference_amount': { const amt = getSinceReferenceAmount(h); return amt !== null ? amt.toFixed(2) : ''; }
        default: return '';
      }
    };
    const byPortfolio = new Map<string, any[]>();
    filteredActiveHoldings.forEach(h => {
      const name = portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned';
      if (!byPortfolio.has(name)) byPortfolio.set(name, []);
      byPortfolio.get(name)!.push(h);
    });
    const wb = XLSX.utils.book_new();
    byPortfolio.forEach((holdings, name) => {
      const rows = [headers, ...holdings.map(h => [h.symbol, ...visibleColumns.map(col => getValue(col, h))])];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // Excel sheet names cap at 31 chars
    });
    XLSX.writeFile(wb, `haven-vault-holdings-active-${todayStr()}.xlsx`);
  };

  const exportSoldHoldingsCsv = () => {
    const headers = ['Instrument', ...(portfolioMode === 'multiple' ? ['Portfolio'] : []), 'Qty', 'Buy Price', 'Sold Price', 'Invested', 'Sold Value', 'Net Gain', '% Chg', 'Sold Date', 'Since Sold'];
    const portfolioNameOf = (h: any) => portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned';
    const rows = filteredSoldHoldings.map(h => {
      const invested = Number(h.buy_price) * Number(h.quantity);
      const soldValue = Number(h.sold_price) * Number(h.quantity);
      const gain = soldValue - invested;
      const gainPct = invested > 0 ? (gain / invested) * 100 : null;
      const sinceSoldPct = h.live_price != null && Number(h.sold_price) !== 0 ? ((Number(h.live_price) - Number(h.sold_price)) / Number(h.sold_price)) * 100 : null;
      return [
        h.symbol, ...(portfolioMode === 'multiple' ? [portfolioNameOf(h)] : []), h.quantity, Number(h.buy_price).toFixed(2), Number(h.sold_price).toFixed(2),
        invested.toFixed(2), soldValue.toFixed(2), gain.toFixed(2), gainPct !== null ? gainPct.toFixed(2) : '',
        h.sold_date ?? '', sinceSoldPct !== null ? sinceSoldPct.toFixed(2) : '',
      ];
    });
    downloadCsv(`haven-vault-holdings-sold-${todayStr()}.csv`, headers, rows);
  };

  const exportSoldHoldingsXlsx = () => {
    const headers = ['Instrument', 'Qty', 'Buy Price', 'Sold Price', 'Invested', 'Sold Value', 'Net Gain', '% Chg', 'Sold Date', 'Since Sold'];
    const byPortfolio = new Map<string, any[]>();
    filteredSoldHoldings.forEach(h => {
      const name = portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned';
      if (!byPortfolio.has(name)) byPortfolio.set(name, []);
      byPortfolio.get(name)!.push(h);
    });
    const wb = XLSX.utils.book_new();
    byPortfolio.forEach((holdings, name) => {
      const dataRows = holdings.map(h => {
        const invested = Number(h.buy_price) * Number(h.quantity);
        const soldValue = Number(h.sold_price) * Number(h.quantity);
        const gain = soldValue - invested;
        const gainPct = invested > 0 ? (gain / invested) * 100 : null;
        const sinceSoldPct = h.live_price != null && Number(h.sold_price) !== 0 ? ((Number(h.live_price) - Number(h.sold_price)) / Number(h.sold_price)) * 100 : null;
        return [
          h.symbol, h.quantity, Number(h.buy_price).toFixed(2), Number(h.sold_price).toFixed(2),
          invested.toFixed(2), soldValue.toFixed(2), gain.toFixed(2), gainPct !== null ? gainPct.toFixed(2) : '',
          h.sold_date ?? '', sinceSoldPct !== null ? sinceSoldPct.toFixed(2) : '',
        ];
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    });
    XLSX.writeFile(wb, `haven-vault-holdings-sold-${todayStr()}.xlsx`);
  };


  const openColumnCustomizer = () => {
    setDraftColumns(resolvedColumns.map(c => ({ key: c.key, visible: c.visible })));
    setIsCustomizingColumns(true);
  };
  const moveDraftColumn = (index: number, direction: -1 | 1) => {
    setDraftColumns(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const toggleDraftColumnVisible = (key: string) => {
    setDraftColumns(prev => prev.map(c => (c.key === key ? { ...c, visible: !c.visible } : c)));
  };
  const saveColumnCustomization = async () => {
    await runAction(() => onUpdateColumnPrefs?.(draftColumns) ?? Promise.resolve());
    setIsCustomizingColumns(false);
  };
  const resetColumnCustomization = async () => {
    await runAction(() => onUpdateColumnPrefs?.(null) ?? Promise.resolve());
    setIsCustomizingColumns(false);
  };

  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [holdingsTab, setHoldingsTab] = useState<'active' | 'sold' | 'search' | 'mf-holdings' | 'settings'>('active');
  const [mfHoldingsSelectedId, setMfHoldingsSelectedId] = useState<string>('all');
  const [mfHoldingsFetchingId, setMfHoldingsFetchingId] = useState<string | null>(null);
  const [mfHoldingsError, setMfHoldingsError] = useState<string | null>(null);
  const [mfFetchingAll, setMfFetchingAll] = useState(false);
  const [mfFetchProgress, setMfFetchProgress] = useState<{ current: number; total: number; currentName: string } | null>(null);
  const [expandedFundId, setExpandedFundId] = useState<string | null>(null);

  // ---- Settings tab (moved here from Investment Plan for easier navigation) ----
  const CASH_LOCATIONS: ('Zerodha' | 'Groww' | 'Bank' | 'Other')[] = ['Zerodha', 'Groww', 'Bank', 'Other'];
  const [editingCashLocation, setEditingCashLocation] = useState<string | null>(null);
  const [cashAmountInput, setCashAmountInput] = useState('');
  const [cashBalancePortfolioId, setCashBalancePortfolioId] = useState<string>('');
  const [editingBookedPlBaseline, setEditingBookedPlBaseline] = useState(false);
  const [bookedPlBaselineAmountInput, setBookedPlBaselineAmountInput] = useState('');
  const [bookedPlBaselineDateInput, setBookedPlBaselineDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [bookedPlPortfolioId, setBookedPlPortfolioId] = useState<string>('');
  const [editingProjectedBankBalance, setEditingProjectedBankBalance] = useState(false);
  const [projectedBankBalanceAmountInput, setProjectedBankBalanceAmountInput] = useState('');
  const [projectedBalancePortfolioId, setProjectedBalancePortfolioId] = useState<string>('');
  const [brokerConnectPortfolioId, setBrokerConnectPortfolioId] = useState<string>('');
  const [brokerEditingType, setBrokerEditingType] = useState<'etoro' | 'ig' | 'webull' | null>(null);
  const [etoroApiKeyInput, setEtoroApiKeyInput] = useState('');
  const [etoroUserKeyInput, setEtoroUserKeyInput] = useState('');
  const [etoroSyncing, setEtoroSyncing] = useState(false);
  const [etoroSyncError, setEtoroSyncError] = useState<string | null>(null);
  const [etoroSyncDebug, setEtoroSyncDebug] = useState<any>(null);
  const [manualEntryHoldingId, setManualEntryHoldingId] = useState<string | null>(null);
  const [manualRows, setManualRows] = useState<{ stockName: string; weightPct: string }[]>([{ stockName: '', weightPct: '' }]);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [quoteSearchQuery, setQuoteSearchQuery] = useState('');
  const [quoteSearchMode, setQuoteSearchMode] = useState<'stock' | 'mf'>('stock');
  const [quoteSearchResults, setQuoteSearchResults] = useState<any[]>([]);
  const [quoteSearching, setQuoteSearching] = useState(false);
  const [quoteSearchError, setQuoteSearchError] = useState<string | null>(null);
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);
  const copySymbol = (symbol: string) => {
    navigator.clipboard?.writeText(symbol);
    setCopiedSymbol(symbol);
    setTimeout(() => setCopiedSymbol(prev => (prev === symbol ? null : prev)), 2000);
  };
  const runQuoteSearch = async () => {
    if (!quoteSearchQuery.trim()) return;
    setQuoteSearching(true);
    setQuoteSearchError(null);
    try {
      if (quoteSearchMode === 'mf') {
        // AMFI's own scheme list - a genuinely different data source from stock search,
        // since Yahoo doesn't meaningfully index Indian MF schemes. Matched the same way
        // portfolio-mf-nav.ts matches for the live NAV refresh, so a name found here is
        // guaranteed to also resolve correctly during refresh.
        const resp = await fetch(`/api/portfolio-mf-search?q=${encodeURIComponent(quoteSearchQuery.trim())}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Search failed.');
        setQuoteSearchResults(data.results || []);
        setQuoteSearching(false);
        return;
      }
      const resp = await fetch(`/api/portfolio-quote-search?q=${encodeURIComponent(quoteSearchQuery.trim())}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Search failed.');
      const results = data.results || [];
      setQuoteSearchResults(results);
      // Follow-up price fetch so the person can visually confirm this is the right stock -
      // Yahoo's search endpoint returns symbol/name but not a reliable live price. The
      // symbol here already carries its own .NS/.BO suffix from Yahoo's own search result,
      // so the exchange passed through doesn't matter - the price API's own suffix check
      // already skips re-appending one to an already-suffixed symbol.
      if (results.length > 0) {
        const priceResp = await fetch('/api/portfolio-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: results.map((r: any) => ({ symbol: r.symbol, exchange: r.exchange || '' })) }),
        });
        if (priceResp.ok) {
          const { results: priceResults } = await priceResp.json();
          setQuoteSearchResults(results.map((r: any, i: number) => ({
            ...r,
            price: priceResults[i]?.price ?? null,
            previousClose: priceResults[i]?.previousClose ?? null,
          })));
        }
      }
    } catch (err: any) {
      setQuoteSearchError(err.message || 'Search failed.');
      setQuoteSearchResults([]);
    } finally {
      setQuoteSearching(false);
    }
  };
  const [editTargetType, setEditTargetType] = useState<'price' | 'percent'>('percent');
  const [editTargetValue, setEditTargetValue] = useState('');
  const [editHoldType, setEditHoldType] = useState<'days' | 'date'>('date');
  const [editHoldDays, setEditHoldDays] = useState('');
  const [editHoldUntilDate, setEditHoldUntilDate] = useState('');
  const [editTicker, setEditTicker] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState(todayStr());

  // ---- Bulk tagging existing holdings ----
  const [isSelectingForTag, setIsSelectingForTag] = useState(false);
  const [bulkActionMode, setBulkActionMode] = useState<'tag' | 'delete'>('tag');
  const [selectedHoldingIds, setSelectedHoldingIds] = useState<Set<string>>(new Set());
  const [bulkTagValue, setBulkTagValue] = useState('');
  const [bulkTagSaving, setBulkTagSaving] = useState(false);

  const toggleHoldingSelected = (id: string) => {
    setSelectedHoldingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setIsSelectingForTag(false);
    setSelectedHoldingIds(new Set());
    setBulkTagValue('');
  };

  const applyBulkTag = async () => {
    if (selectedHoldingIds.size === 0 || !bulkTagValue.trim()) return;
    setBulkTagSaving(true);
    await runAction(async () => {
      await bulkTagPortfolioHoldings(Array.from(selectedHoldingIds), bulkTagValue.trim());
      exitSelectMode();
    });
    setBulkTagSaving(false);
  };

  const [bulkDeleting, setBulkDeleting] = useState(false);
  const applyBulkDelete = async () => {
    if (selectedHoldingIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedHoldingIds.size} selected holding${selectedHoldingIds.size !== 1 ? 's' : ''}? This can't be undone.`)) return;
    setBulkDeleting(true);
    await runAction(async () => {
      await bulkDeletePortfolioHoldings(Array.from(selectedHoldingIds));
      exitSelectMode();
    });
    setBulkDeleting(false);
  };

  // ---- Column sorting ----
  type SortField = 'symbol' | 'quantity' | 'buy_price' | 'current_price' | 'live_price' | 'daily_change' | 'since_previous_load' | 'invested' | 'current_value' | 'gain' | 'gain_pct' | 'since_reference' | 'since_reference_amount';
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };


  const activeHoldings = portfolioHoldings.filter(h => h.status === 'active');
  const soldHoldings = portfolioHoldings.filter(h => h.status === 'sold');

  // Dynamic filter options built from whatever's actually in the data - broker+type combos and source tags
  const [holdingFilters, setHoldingFilters] = useState<Set<string>>(new Set());
  const CHANGE_FLAG_LABELS: Record<string, string> = { added: 'Added', qty_increased: 'Qty Added', qty_reduced: 'Qty Reduced' };

  // Brand-appropriate colors for broker filter pills - Zerodha's blue, Groww's green -
  // so they're recognizable by brand at a glance, not just generic black/white.
  const brokerPillClass = (combo: string, selected: boolean) => {
    if (combo.startsWith('Zerodha')) {
      return selected ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400';
    }
    if (combo.startsWith('Groww')) {
      return selected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400';
    }
    return selected ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500';
  };

  // Reference Load Date - lets you pick any date you've ever captured a price for, and see
  // performance from that date to today for every holding. Distinct from the Monthly Movement
  // Report snapshot comparison - this is a per-holding, live filter on the Holdings page itself.
  const [selectedReferenceDate, setSelectedReferenceDate] = useState<'latest' | string>('latest');
  const availableReferenceDates = useMemo(() => {
    return Array.from(new Set(portfolioPriceHistory.map(p => p.recorded_date))).sort().reverse();
  }, [portfolioPriceHistory]);

  // For a given holding, finds the closest price on or before the selected date - if Zerodha's
  // snapshot was the 12th and Groww's was the 10th, selecting "12th" uses the 10th for Groww
  // holdings (the closest available), exactly as agreed.
  const getPriceAtOrBefore = (holdingId: string, date: string): number | null => {
    const candidates = portfolioPriceHistory
      .filter(p => p.holding_id === holdingId && p.recorded_date <= date)
      .sort((a, b) => (a.recorded_date < b.recorded_date ? 1 : -1));
    return candidates.length > 0 ? Number(candidates[0].price) : null;
  };

  const getSinceUploadLabel = (h: any): string | null => {
    if (h.live_price == null) return null;
    const ltp = Number(h.current_price ?? h.buy_price);
    if (ltp === 0) return null;
    return Number(h.live_price) >= ltp ? 'Price Up (Live)' : 'Price Down (Live)';
  };

  const UNCLASSIFIED_LABEL = 'Unclassified';
  const SYMBOL_NOT_FOUND_FILTER = 'Symbol Not Found';

  const filterOptions = useMemo(() => {
    const combos = new Set<string>();
    const sources = new Set<string>();
    const changes = new Set<string>();
    const priceMoves = new Set<string>();
    const portfolioNames = new Set<string>();
    let hasUnclassified = false;
    activeHoldings.forEach(h => {
      combos.add(`${h.broker} ${h.holding_type === 'mutual_fund' ? 'MF' : 'Stock'}`);
      if (h.source) sources.add(h.source); else hasUnclassified = true;
      if (h.change_flag && CHANGE_FLAG_LABELS[h.change_flag]) changes.add(CHANGE_FLAG_LABELS[h.change_flag]);
      const moveLabel = getSinceUploadLabel(h);
      if (moveLabel) priceMoves.add(moveLabel);
      if (portfolioMode === 'multiple') portfolioNames.add(portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned');
    });
    const sortedSources = Array.from(sources).sort();
    if (hasUnclassified) sortedSources.push(UNCLASSIFIED_LABEL);
    return { combos: Array.from(combos).sort(), sources: sortedSources, changes: Array.from(changes).sort(), priceMoves: Array.from(priceMoves).sort(), portfolioNames: Array.from(portfolioNames).sort() };
  }, [activeHoldings, portfolioMode, portfolios]);

  const toggleHoldingFilter = (value: string) => {
    setHoldingFilters(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  const filteredActiveHoldings = useMemo(() => {
    let list = activeHoldings;
    if (holdingFilters.size > 0) {
      const selectedCombos = filterOptions.combos.filter(c => holdingFilters.has(c));
      const selectedSources = filterOptions.sources.filter(s => holdingFilters.has(s));
      const selectedChanges = filterOptions.changes.filter(c => holdingFilters.has(c));
      const selectedPriceMoves = filterOptions.priceMoves.filter(p => holdingFilters.has(p));
      const selectedPortfolios = filterOptions.portfolioNames.filter(p => holdingFilters.has(p));
      list = activeHoldings.filter(h => {
        const combo = `${h.broker} ${h.holding_type === 'mutual_fund' ? 'MF' : 'Stock'}`;
        const comboOk = selectedCombos.length === 0 || selectedCombos.includes(combo);
        const sourceOk = selectedSources.length === 0 || (h.source ? selectedSources.includes(h.source) : selectedSources.includes(UNCLASSIFIED_LABEL));
        const changeLabel = h.change_flag ? CHANGE_FLAG_LABELS[h.change_flag] : null;
        const changeOk = selectedChanges.length === 0 || (changeLabel && selectedChanges.includes(changeLabel));
        const moveLabel = getSinceUploadLabel(h);
        const priceMoveOk = selectedPriceMoves.length === 0 || (moveLabel && selectedPriceMoves.includes(moveLabel));
        const portfolioName = portfolioMode === 'multiple' ? (portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned') : null;
        const portfolioOk = selectedPortfolios.length === 0 || (portfolioName && selectedPortfolios.includes(portfolioName));
        const symbolNotFoundOk = !holdingFilters.has(SYMBOL_NOT_FOUND_FILTER) || h.price_lookup_failed;
        return comboOk && sourceOk && changeOk && priceMoveOk && portfolioOk && symbolNotFoundOk;
      });
    }
    if (!sortField) return list;

    const valueFor = (h: any): number | string => {
      const current = Number(h.live_price ?? h.current_price ?? h.buy_price);
      switch (sortField) {
        case 'symbol': return h.symbol;
        case 'quantity': return Number(h.quantity);
        case 'buy_price': return Number(h.buy_price);
        case 'current_price': return Number(h.current_price ?? h.buy_price);
        case 'live_price': return Number(h.live_price ?? h.current_price ?? h.buy_price);
        case 'daily_change': return h.live_price != null && h.previous_close != null ? (Number(h.live_price) - Number(h.previous_close)) * Number(h.quantity) : -Infinity;
        case 'since_previous_load': return h.live_price != null ? (Number(h.live_price) - Number(h.current_price ?? h.buy_price)) * Number(h.quantity) : -Infinity;
        case 'invested': return Number(h.buy_price) * Number(h.quantity);
        case 'current_value': return current * Number(h.quantity);
        case 'gain': return (current - Number(h.buy_price)) * Number(h.quantity);
        case 'gain_pct': return ((current - Number(h.buy_price)) / Number(h.buy_price)) * 100;
        case 'since_reference': {
          if (selectedReferenceDate !== 'latest') {
            const basePrice = getPriceAtOrBefore(h.id, selectedReferenceDate);
            return basePrice != null && basePrice !== 0 ? ((current - basePrice) / basePrice) * 100 : -Infinity;
          }
          return h.reference_price != null && Number(h.reference_price) !== 0 ? ((current - Number(h.reference_price)) / Number(h.reference_price)) * 100 : -Infinity;
        }
        case 'since_reference_amount': {
          const qty = Number(h.quantity);
          if (selectedReferenceDate !== 'latest') {
            const basePrice = getPriceAtOrBefore(h.id, selectedReferenceDate);
            return basePrice != null ? (current - basePrice) * qty : -Infinity;
          }
          return h.reference_price != null ? (current - Number(h.reference_price)) * qty : -Infinity;
        }
        default: return 0;
      }
    };

    return [...list].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : (av as number) - (bv as number);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [activeHoldings, holdingFilters, filterOptions, sortField, sortDirection, selectedReferenceDate]);

  // ---- Sold tab - same filter/sort pattern as Active ----
  const [soldHoldingFilters, setSoldHoldingFilters] = useState<Set<string>>(new Set());
  const [soldSortField, setSoldSortField] = useState<string | null>(null);
  const [soldSortDirection, setSoldSortDirection] = useState<'asc' | 'desc'>('desc');

  const soldFilterOptions = useMemo(() => {
    const combos = new Set<string>();
    const sources = new Set<string>();
    const portfolioNames = new Set<string>();
    let hasUnclassified = false;
    soldHoldings.forEach(h => {
      combos.add(`${h.broker} ${h.holding_type === 'mutual_fund' ? 'MF' : 'Stock'}`);
      if (h.source) sources.add(h.source); else hasUnclassified = true;
      if (portfolioMode === 'multiple') portfolioNames.add(portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned');
    });
    const sortedSources = Array.from(sources).sort();
    if (hasUnclassified) sortedSources.push(UNCLASSIFIED_LABEL);
    return { combos: Array.from(combos).sort(), sources: sortedSources, portfolioNames: Array.from(portfolioNames).sort() };
  }, [soldHoldings, portfolioMode, portfolios]);

  const toggleSoldHoldingFilter = (value: string) => {
    setSoldHoldingFilters(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  const toggleSoldSort = (field: string) => {
    if (soldSortField === field) setSoldSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
    else { setSoldSortField(field); setSoldSortDirection('desc'); }
  };

  const filteredSoldHoldings = useMemo(() => {
    let list = soldHoldings;
    if (soldHoldingFilters.size > 0) {
      const selectedCombos = soldFilterOptions.combos.filter(c => soldHoldingFilters.has(c));
      const selectedSources = soldFilterOptions.sources.filter(s => soldHoldingFilters.has(s));
      const selectedPortfolios = soldFilterOptions.portfolioNames.filter(p => soldHoldingFilters.has(p));
      list = soldHoldings.filter(h => {
        const combo = `${h.broker} ${h.holding_type === 'mutual_fund' ? 'MF' : 'Stock'}`;
        const comboOk = selectedCombos.length === 0 || selectedCombos.includes(combo);
        const sourceOk = selectedSources.length === 0 || (h.source ? selectedSources.includes(h.source) : selectedSources.includes(UNCLASSIFIED_LABEL));
        const portfolioName = portfolioMode === 'multiple' ? (portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned') : null;
        const portfolioOk = selectedPortfolios.length === 0 || (portfolioName && selectedPortfolios.includes(portfolioName));
        return comboOk && sourceOk && portfolioOk;
      });
    }
    if (!soldSortField) return list;
    const valueFor = (h: any): number | string => {
      switch (soldSortField) {
        case 'symbol': return h.symbol;
        case 'quantity': return Number(h.quantity);
        case 'buy_price': return Number(h.buy_price);
        case 'sold_price': return Number(h.sold_price);
        case 'invested': return Number(h.buy_price) * Number(h.quantity);
        case 'sold_value': return Number(h.sold_price) * Number(h.quantity);
        case 'gain': return (Number(h.sold_price) - Number(h.buy_price)) * Number(h.quantity);
        case 'gain_pct': return ((Number(h.sold_price) - Number(h.buy_price)) / Number(h.buy_price)) * 100;
        case 'sold_date': return h.sold_date || '';
        case 'since_sold': return h.live_price != null && Number(h.sold_price) !== 0 ? ((Number(h.live_price) - Number(h.sold_price)) / Number(h.sold_price)) * 100 : -Infinity;
        default: return 0;
      }
    };
    return [...list].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : (av as number) - (bv as number);
      return soldSortDirection === 'asc' ? cmp : -cmp;
    });
  }, [soldHoldings, soldHoldingFilters, soldFilterOptions, soldSortField, soldSortDirection]);


  // Change since the last time prices were refreshed (the two most recent snapshots for a holding)
  // Progress against the explicit reference checkpoint (set on first load, or manually
  // overridden) - not just "the last time a price happened to update," which is noisy.
  const getSinceReferencePct = (h: any): number | null => {
    const current = Number(h.live_price ?? h.current_price ?? h.buy_price);
    if (selectedReferenceDate !== 'latest') {
      const basePrice = getPriceAtOrBefore(h.id, selectedReferenceDate);
      if (basePrice == null || basePrice === 0) return null;
      return ((current - basePrice) / basePrice) * 100;
    }
    if (h.reference_price == null) return null;
    const ref = Number(h.reference_price);
    if (ref === 0) return null;
    return ((current - ref) / ref) * 100;
  };

  // Same reference baseline as the percentage version (respects the Reference Load Date
  // dropdown), just expressed as a rupee amount for this holding instead of a percentage.
  const getSinceReferenceAmount = (h: any): number | null => {
    const current = Number(h.live_price ?? h.current_price ?? h.buy_price);
    const qty = Number(h.quantity);
    if (selectedReferenceDate !== 'latest') {
      const basePrice = getPriceAtOrBefore(h.id, selectedReferenceDate);
      if (basePrice == null) return null;
      return (current - basePrice) * qty;
    }
    if (h.reference_price == null) return null;
    return (current - Number(h.reference_price)) * qty;
  };


  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [priceRefreshSummary, setPriceRefreshSummary] = useState<string | null>(null);

  // ---- Broker file import ----
  const [isImporting, setIsImporting] = useState(false);
  const [importTemplate, setImportTemplate] = useState<BrokerTemplate>('zerodha');
  const [importParsing, setImportParsing] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    fresh: ParsedHolding[];
    qtyChanged: { parsed: ParsedHolding; existing: any; direction: 'increased' | 'reduced' }[];
    priceChanged: { parsed: ParsedHolding; existing: any }[];
    unchanged: number;
    missing: any[];
  } | null>(null);
  const [importMissingSelected, setImportMissingSelected] = useState<Set<string>>(new Set());
  const [importMissingSellPrice, setImportMissingSellPrice] = useState<Record<string, string>>({});
  const [importReducedOverrides, setImportReducedOverrides] = useState<Record<string, { sellPrice: string; soldItemBuyPrice: string }>>({});
  const [importSourceTag, setImportSourceTag] = useState('');
  const [importBuyDate, setImportBuyDate] = useState(todayStr());
  const [importSaving, setImportSaving] = useState(false);

  type ImportClassification = { status: 'new' } | { status: 'unchanged'; existing: any } | { status: 'qty_changed'; existing: any; direction: 'increased' | 'reduced' } | { status: 'price_changed'; existing: any };

  const classifyImportRow = (parsed: ParsedHolding, targetPortfolioId?: string): ImportClassification => {
    const existing = portfolioHoldings.find(h => {
      if (h.status !== 'active') return false;
      if (h.broker !== parsed.broker) return false; // same stock via a different broker is a separate, legitimate holding
      // Same stock already held in a different portfolio should still count as new for
      // this import target - "already imported" is scoped per-portfolio, otherwise a
      // stock present in Portfolio 1 would never be importable into Portfolio 2.
      if (portfolioMode === 'multiple' && (h.portfolio_id ?? null) !== (targetPortfolioId ?? null)) return false;
      if (parsed.isin && h.isin) return h.isin === parsed.isin;
      // Groww MF: the same fund name can appear more than once under different folios
      // (e.g. one External, one bought via the app) - folio number is what's actually unique.
      if (parsed.folioNumber && h.folio_number) return h.folio_number === parsed.folioNumber && h.symbol === parsed.symbol.toUpperCase();
      return h.symbol === parsed.symbol.toUpperCase() && h.holding_type === parsed.holdingType && !h.folio_number && !parsed.folioNumber;
    });
    if (!existing) return { status: 'new' };
    if (Number(existing.quantity) === parsed.quantity) {
      // Same quantity doesn't necessarily mean nothing changed - the average cost basis can
      // shift without a quantity change (a corporate action, or simply a stale import from
      // before a later correction) and this was previously being silently missed entirely,
      // since "unchanged" rows are skipped outright. A flat 1-paisa tolerance only exists to
      // absorb genuine floating-point rounding noise, not to hide real differences - a 0.5%
      // relative tolerance was tried first but confirmed too loose in practice (missed a
      // ~0.16% and a ~0.26% real difference while barely catching a ~0.53% one).
      const priceDiff = Math.abs(Number(existing.buy_price) - parsed.buyPrice);
      const tolerance = 0.01;
      if (priceDiff > tolerance) return { status: 'price_changed', existing };
      return { status: 'unchanged', existing };
    }
    return { status: 'qty_changed', existing, direction: parsed.quantity > Number(existing.quantity) ? 'increased' : 'reduced' };
  };

  const [importRawParsed, setImportRawParsed] = useState<ParsedHolding[] | null>(null);

  // ---- Historical backfill (multiple dated files at once) ----
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [historicalTemplate, setHistoricalTemplate] = useState<BrokerTemplate>('zerodha');
  const [historicalParsing, setHistoricalParsing] = useState(false);
  const [historicalSnapshots, setHistoricalSnapshots] = useState<{ date: string; holdings: ParsedHolding[]; fileName: string }[]>([]);
  const [historicalSaving, setHistoricalSaving] = useState(false);
  const [historicalResult, setHistoricalResult] = useState<{ newCount: number; updatedCount: number; soldCount: number; skippedStaleCount: number; priceHistoryCount: number; stockCount: number } | null>(null);

  const handleHistoricalFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setHistoricalParsing(true);
    setFormError(null);
    try {
      const parsed = await Promise.all(files.map(async f => {
        const { holdings, fileDate } = await parseBrokerFileWithDate(f, historicalTemplate);
        return { date: fileDate, holdings, fileName: f.name };
      }));
      const missingDate = parsed.find(p => !p.date);
      if (missingDate) throw new Error(`Couldn't find a date in "${missingDate.fileName}" - check it's the right file type.`);
      // Dedupe by date - if two files claim the same date, keep whichever has more rows
      const byDate = new Map<string, { date: string; holdings: ParsedHolding[]; fileName: string }>();
      parsed.forEach(p => {
        const existing = byDate.get(p.date!);
        if (!existing || p.holdings.length > existing.holdings.length) byDate.set(p.date!, { date: p.date!, holdings: p.holdings, fileName: p.fileName });
      });
      setHistoricalSnapshots(Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)));
      setHistoricalResult(null);
    } catch (err: any) {
      setFormError(err?.message || 'Could not read one of those files.');
    } finally {
      setHistoricalParsing(false);
      e.target.value = '';
    }
  };

  const confirmHistoricalImport = async () => {
    if (historicalSnapshots.length < 1) return;
    setHistoricalSaving(true);
    await runAction(async () => {
      const result = await bulkHistoricalImport(historicalSnapshots.map(s => ({
        date: s.date,
        holdings: s.holdings.map(h => ({ broker: h.broker, holdingType: h.holdingType, symbol: h.symbol, isin: h.isin, folioNumber: h.folioNumber, exchange: h.exchange, quantity: h.quantity, buyPrice: h.buyPrice, currentPrice: h.currentPrice, source: h.source })),
      })), portfolioMode === 'multiple' ? (historicalPortfolioId || defaultPortfolioId || undefined) : undefined);
      setHistoricalResult(result);
      setHistoricalSnapshots([]);
    });
    setHistoricalSaving(false);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportParsing(true);
    setFormError(null);
    setImportPreview(null);
    try {
      const parsed = await parseBrokerFile(file, importTemplate);
      setImportRawParsed(parsed);
    } catch (err: any) {
      setFormError(err?.message || 'Could not read that file.');
    } finally {
      setImportParsing(false);
      e.target.value = '';
    }
  };

  const handleEtoroSync = async (connection: any) => {
    if (!connection) return;
    setEtoroSyncing(true);
    setEtoroSyncError(null);
    setEtoroSyncDebug(null);
    setImportPreview(null);
    try {
      const resp = await fetch('/api/portfolio-etoro-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: connection.credentials?.api_key, userKey: connection.credentials?.user_key }),
      });
      const data = await resp.json();
      if (data?.instrumentDebug || data?.settlementBreakdown) setEtoroSyncDebug(data);
      if (!resp.ok) throw new Error(data?.error || `eToro sync failed (${resp.status})`);
      setImportTemplate('universal');
      setImportPortfolioId(connection.portfolio_id ?? '');
      setImportRawParsed(data.holdings);
      setIsImporting(true);
      await markBrokerConnectionSynced?.(connection.id);
    } catch (err: any) {
      setEtoroSyncError(err?.message || 'Could not sync from eToro.');
    } finally {
      setEtoroSyncing(false);
    }
  };

  // Recompute the preview whenever the raw parse changes, or the target portfolio changes -
  // switching portfolios should re-check what's already there for that specific one.
  useEffect(() => {
    if (!importRawParsed) { setImportPreview(null); setImportMissingSelected(new Set()); return; }
    const targetPortfolioId = portfolioMode === 'multiple' ? (importPortfolioId || defaultPortfolioId || undefined) : undefined;
    const fresh: ParsedHolding[] = [];
    const qtyChanged: { parsed: ParsedHolding; existing: any; direction: 'increased' | 'reduced' }[] = [];
    const priceChanged: { parsed: ParsedHolding; existing: any }[] = [];
    let unchanged = 0;
    importRawParsed.forEach(h => {
      const c = classifyImportRow(h, targetPortfolioId);
      if (c.status === 'new') fresh.push(h);
      else if (c.status === 'qty_changed') qtyChanged.push({ parsed: h, existing: c.existing, direction: c.direction });
      else if (c.status === 'price_changed') priceChanged.push({ parsed: h, existing: c.existing });
      else unchanged++;
    });
    // Holdings that are active, match a broker+holding-type combination actually present in
    // this file (and the target portfolio), but aren't matched by any row in it - the file
    // is a full account snapshot for that combination, so absence almost always means it was
    // sold outside the app. Scoped to broker+type together, not broker alone - a Groww
    // stocks file only covers stocks, so it must never flag Groww mutual funds as missing
    // just because they share the same broker name; a Zerodha file follows the identical
    // rule (stocks file -> only compares against Zerodha stocks, MF file -> only Zerodha MF).
    const brokerTypesInFile = new Set(importRawParsed.map(h => `${h.broker}|${h.holdingType}`));
    const missing = portfolioHoldings.filter(h => {
      if (h.status !== 'active') return false;
      if (!brokerTypesInFile.has(`${h.broker}|${h.holding_type}`)) return false;
      if (portfolioMode === 'multiple' && (h.portfolio_id ?? null) !== (targetPortfolioId ?? null)) return false;
      return !importRawParsed.some(p => {
        if (p.isin && h.isin) return h.isin === p.isin;
        if (p.folioNumber && h.folio_number) return h.folio_number === p.folioNumber && h.symbol === p.symbol.toUpperCase();
        return h.symbol === p.symbol.toUpperCase() && h.holding_type === p.holdingType && !h.folio_number && !p.folioNumber;
      });
    });
    setImportPreview({ fresh, qtyChanged, priceChanged, unchanged, missing });
    setImportMissingSelected(new Set());
    setImportMissingSellPrice(Object.fromEntries(missing.map(h => [h.id, String(Number(h.live_price ?? h.current_price ?? h.buy_price))])));
    setImportReducedOverrides(Object.fromEntries(qtyChanged.filter(qc => qc.direction === 'reduced').map(qc => [
      qc.existing.id,
      { sellPrice: String(qc.parsed.currentPrice ?? qc.existing.live_price ?? qc.existing.current_price ?? qc.existing.buy_price), soldItemBuyPrice: String(qc.existing.buy_price) },
    ])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importRawParsed, importPortfolioId, portfolioMode]);

  const confirmImport = async () => {
    if (!importPreview || (importPreview.fresh.length === 0 && importPreview.qtyChanged.length === 0 && importPreview.priceChanged.length === 0 && importMissingSelected.size === 0)) return;
    setImportSaving(true);
    await runAction(async () => {
      if (importPreview.fresh.length > 0) {
        await bulkAddPortfolioHoldings(
          importPreview.fresh.map(h => ({
            holdingType: h.holdingType, broker: h.broker, symbol: h.symbol, isin: h.isin, folioNumber: h.folioNumber, exchange: h.exchange,
            quantity: h.quantity, buyPrice: h.buyPrice, buyDate: importBuyDate, currentPrice: h.currentPrice,
            source: h.source || importSourceTag.trim() || undefined, currency: h.currency,
          })),
          portfolioMode === 'multiple' ? (importPortfolioId || defaultPortfolioId || undefined) : undefined
        );
      }
      for (const { parsed, existing, direction } of importPreview.qtyChanged) {
        const override = importReducedOverrides[existing.id];
        // New avg price for the remaining active shares always comes straight from the
        // file - Groww/Zerodha already computes this correctly, no need for a manual
        // override. Only the sold portion's cost basis (soldItemBuyPrice) is editable,
        // since that's the one thing the broker export genuinely can't tell us (which
        // specific lot got sold in a FIFO sale).
        const sellPriceForReduced = direction === 'reduced' && override ? parseFloat(override.sellPrice) : parsed.currentPrice;
        const soldItemBuyPrice = direction === 'reduced' && override ? parseFloat(override.soldItemBuyPrice) : undefined;
        await reconcilePortfolioHoldingQuantity(
          existing.id, parsed.quantity, direction === 'increased' ? 'qty_increased' : 'qty_reduced',
          parsed.buyPrice !== Number(existing.buy_price) ? parsed.buyPrice : undefined,
          sellPriceForReduced,
          soldItemBuyPrice
        );
      }
      // Same quantity, but the file's average cost differs from what's stored - previously
      // silently missed entirely, since these were classified "unchanged" and skipped. A
      // straight cost-basis correction, no shares actually changed hands, so just update
      // buy_price directly rather than going through the sold-clone reconciliation path.
      for (const { parsed, existing } of importPreview.priceChanged) {
        await updatePortfolioHolding(existing.id, { buyPrice: parsed.buyPrice });
      }
      for (const h of importPreview.missing) {
        if (!importMissingSelected.has(h.id)) continue;
        const overridePrice = importMissingSellPrice[h.id];
        const sellPrice = overridePrice !== undefined && overridePrice !== '' ? parseFloat(overridePrice) : Number(h.live_price ?? h.current_price ?? h.buy_price);
        await markPortfolioHoldingSoldFromImport?.(h.id, sellPrice);
      }
      // Auto-recalculate Projected Bank Balance now that this import's holdings are saved -
      // establishes a fresh baseline at import time. A manual edit made afterward still
      // always wins (both just set updated_at, and the header uses whichever is more
      // recent) - this doesn't lock the value in, just keeps it current by default.
      await recalculateProjectedBankBalance?.(portfolioMode === 'multiple' ? (importPortfolioId || defaultPortfolioId || undefined) : undefined);
      setImportPreview(null);
      setImportRawParsed(null);
      setImportMissingSelected(new Set());
      setImportMissingSellPrice({});
      setImportReducedOverrides({});
      setImportSourceTag('');
      setImportBuyDate(todayStr());
      setIsImporting(false);
    });
    setImportSaving(false);
  };

  const refreshAllPrices = async (scope: 'active' | 'sold' = 'active') => {
    setRefreshingPrices(true);
    setPriceRefreshSummary(null);
    await runAction(async () => {
      // Only holdings with a real ticker set can be looked up - Zerodha's symbol is
      // always a valid ticker, Groww's file only gives a company name so it needs one
      // entered manually (via the expand panel) before it can be refreshed.
      // Scoped by tab rather than one combined call - keeps each request naturally small
      // instead of relying on a single cap being "big enough" as holdings grow, and matches
      // what a person actually means when they tap Refresh Prices from a specific tab.
      let scopedHoldings: any[];
      if (scope === 'sold') {
        const oneYearAgo = Date.now() - 365 * 86400000;
        scopedHoldings = soldHoldings.filter(h => h.sold_date && new Date(h.sold_date).getTime() >= oneYearAgo);
      } else {
        scopedHoldings = activeHoldings;
      }
      const refreshable = scopedHoldings.filter(h => h.holding_type !== 'mutual_fund' && h.ticker);
      const skippedNoTicker = scopedHoldings.filter(h => h.holding_type !== 'mutual_fund' && !h.ticker).length;
      const mutualFunds = scopedHoldings.filter(h => h.holding_type === 'mutual_fund');

      let succeeded = 0;
      let failed = 0;
      const updatePromises: Promise<void>[] = [];

      if (refreshable.length > 0) {
        const symbols = refreshable.map(h => ({ symbol: h.ticker, exchange: h.exchange }));
        const resp = await fetch('/api/portfolio-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols }),
        });
        if (!resp.ok) throw new Error('Price service did not respond. Try again shortly.');
        const { results } = await resp.json();
        // Match results back to holdings by position, not by re-searching for the ticker -
        // Promise.all preserves the order of the input array, and matching by ticker alone
        // breaks when the same stock exists both actively held and sold (10 tickers in this
        // workspace do), since .find() would always return the first match and the other
        // copy's live_price would never get updated.
        results.forEach((r: any, i: number) => {
          const holding = refreshable[i];
          if (!holding) return;
          if (r.price != null) {
            updatePromises.push(updatePortfolioHoldingLivePrice(holding.id, r.price, r.previousClose ?? null));
            succeeded++;
          } else {
            updatePromises.push(markPriceLookupFailed(holding.id));
            failed++;
          }
        });
      }

      let mfSucceeded = 0;
      let mfFailed = 0;
      if (mutualFunds.length > 0) {
        const funds = mutualFunds.map(h => ({ id: h.id, isin: h.isin, name: h.symbol }));
        const mfResp = await fetch('/api/portfolio-mf-nav', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ funds }),
        });
        if (mfResp.ok) {
          const { results: mfResults } = await mfResp.json();
          mfResults.forEach((r: any) => {
            const holding = mutualFunds.find(h => h.id === r.id);
            if (!holding) return;
            if (r.nav != null) {
              updatePromises.push(updatePortfolioHoldingLivePrice(holding.id, r.nav, null));
              mfSucceeded++;
            } else {
              updatePromises.push(markPriceLookupFailed(holding.id));
              mfFailed++;
            }
          });
        } else {
          mfFailed += mutualFunds.length;
        }
      }

      await Promise.all(updatePromises);

      if (refreshable.length === 0 && mutualFunds.length === 0) {
        setPriceRefreshSummary(skippedNoTicker > 0 ? `${skippedNoTicker} stock${skippedNoTicker !== 1 ? 's' : ''} need a ticker set before they can be refreshed.` : 'No holdings to refresh.');
        return;
      }
      const skipNote = skippedNoTicker > 0 ? ` · ${skippedNoTicker} skipped (no ticker set)` : '';
      const mfNote = mutualFunds.length > 0 ? ` · MF NAV: ${mfSucceeded} updated${mfFailed > 0 ? `, ${mfFailed} not matched` : ''}` : '';
      setPriceRefreshSummary(
        failed === 0
          ? `Live price updated for ${succeeded}${skipNote}${mfNote} · delayed a few minutes, not real-time`
          : `Live price updated for ${succeeded}, couldn't find ${failed}${skipNote}${mfNote} · delayed a few minutes, not real-time`
      );
    });
    setRefreshingPrices(false);
  };

  // Auto-refresh once when the page loads, if prices look stale - saves a manual click most of
  // the time, since holdings composition rarely changes day to day. Throttled so it doesn't
  // fire on every re-render or hammer the free price API.
  const autoRefreshTriggeredRef = React.useRef(false);
  useEffect(() => {
    if (autoRefreshTriggeredRef.current) return;
    if (isReadOnly) return;
    const refreshableStocks = activeHoldings.filter(h => h.holding_type !== 'mutual_fund');
    if (refreshableStocks.length === 0) return;
    const staleThresholdMs = 6 * 60 * 60 * 1000; // 6 hours
    const isStale = refreshableStocks.some(h => !h.current_price_updated_at || (Date.now() - new Date(h.current_price_updated_at).getTime()) > staleThresholdMs);
    if (isStale) {
      autoRefreshTriggeredRef.current = true;
      refreshAllPrices('active');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHoldings.length]);

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hSymbol.trim() || !hQty || !hPrice) return;
    await runAction(async () => {
      await addPortfolioHolding({
        holdingType: hHoldingType, broker: hBroker, symbol: hSymbol, exchange: hExchange, quantity: parseFloat(hQty), buyPrice: parseFloat(hPrice), buyDate: hDate,
        source: hSource.trim() || undefined,
        currency: hCurrency,
        portfolioId: portfolioMode === 'multiple' ? (hPortfolioId || defaultPortfolioId || undefined) : undefined,
        targetType: showTargetPlan && hTargetValue ? hTargetType : undefined,
        targetPrice: showTargetPlan && hTargetType === 'price' && hTargetValue ? parseFloat(hTargetValue) : undefined,
        targetPercent: showTargetPlan && hTargetType === 'percent' && hTargetValue ? parseFloat(hTargetValue) : undefined,
        holdType: showTargetPlan && ((hHoldType === 'days' && hHoldDays) || (hHoldType === 'date' && hHoldUntilDate)) ? hHoldType : undefined,
        holdDays: showTargetPlan && hHoldType === 'days' && hHoldDays ? parseInt(hHoldDays) : undefined,
        holdUntilDate: showTargetPlan && hHoldType === 'date' && hHoldUntilDate ? hHoldUntilDate : undefined,
      });
      setHSymbol(''); setHQty(''); setHPrice(''); setHSource(''); setHTargetValue(''); setHHoldDays(''); setHHoldUntilDate('');
      setShowTargetPlan(false); setIsAddingHolding(false);
    });
  };

  const saveCurrentPrice = async (id: string) => {
    const val = parseFloat(priceEdits[id]);
    if (!val) return;
    await runAction(async () => {
      await updatePortfolioHolding(id, { currentPrice: val });
      setPriceEdits(prev => { const next = { ...prev }; delete next[id]; return next; });
    });
  };

  const toggleExpandHolding = (h: any) => {
    if (expandedHoldingId === h.id) { setExpandedHoldingId(null); return; }
    setExpandedHoldingId(h.id);
    setEditTargetType(h.target_type || 'percent');
    setEditTargetValue(h.target_type === 'price' ? String(h.target_price ?? '') : String(h.target_percent ?? ''));
    setEditHoldType(h.hold_type || 'date');
    setEditHoldDays(String(h.hold_days ?? ''));
    setEditHoldUntilDate(h.hold_until_date || '');
    setEditTicker(h.ticker || (h.broker === 'Zerodha' ? h.symbol : ''));
  };

  const [sellQuantity, setSellQuantity] = useState('');

  const confirmSell = async (fullQuantity: number) => {
    if (!sellingId || !sellPrice) return;
    const qty = sellQuantity.trim() === '' ? fullQuantity : parseFloat(sellQuantity);
    await runAction(async () => {
      await sellPortfolioHolding(sellingId, { quantity: qty, soldPrice: parseFloat(sellPrice), soldDate: sellDate });
      setSellingId(null); setSellPrice(''); setSellQuantity('');
    });
  };

  const openEditHolding = (h: any) => {
    setEditingHoldingId(h.id);
    setEditError(null);
    setEditForm({
      symbol: h.symbol, broker: h.broker, exchange: h.exchange, isin: h.isin ?? '',
      quantity: String(h.quantity), buyPrice: String(h.buy_price), buyDate: h.buy_date,
      currentPrice: h.current_price != null ? String(h.current_price) : '', currency: h.currency ?? 'INR',
      holdingType: h.holding_type, source: h.source ?? '', portfolioId: h.portfolio_id ?? '',
      ticker: h.ticker ?? (h.broker === 'Zerodha' ? h.symbol : ''),
      originalSymbol: h.symbol, originalTicker: h.ticker ?? null,
    });
  };

  const saveEditHolding = async () => {
    if (!editingHoldingId) return;
    if (!editForm.symbol?.trim()) { setEditError('Symbol is required.'); return; }
    if (!editForm.broker?.trim()) { setEditError('Broker is required.'); return; }
    if (!editForm.quantity || Number(editForm.quantity) <= 0) { setEditError('Quantity must be greater than 0.'); return; }
    if (!editForm.buyPrice || Number(editForm.buyPrice) < 0) { setEditError('Buy price is required.'); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      const trimmedSymbol = editForm.symbol.trim();
      await updatePortfolioHolding(editingHoldingId, {
        symbol: trimmedSymbol, broker: editForm.broker.trim(), exchange: editForm.exchange?.trim() || 'Other',
        isin: editForm.isin?.trim() || null, quantity: Number(editForm.quantity), buyPrice: Number(editForm.buyPrice),
        buyDate: editForm.buyDate, currency: editForm.currency, holdingType: editForm.holdingType,
        source: editForm.source?.trim() || undefined,
        portfolioId: portfolioMode === 'multiple' ? (editForm.portfolioId || null) : undefined,
        ticker: editForm.ticker?.trim() ? editForm.ticker.trim().toUpperCase() : null,
        ...(editForm.currentPrice !== '' ? { currentPrice: Number(editForm.currentPrice) } : {}),
      });
      setEditingHoldingId(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  const openManualMfEntry = (h: any) => {
    setManualEntryHoldingId(h.id);
    setManualError(null);
    const existing = mfHoldingsCache.filter((c: any) => {
      const a = (c.scheme_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const b = (h.symbol || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return a === b;
    });
    setManualRows(existing.length > 0
      ? existing.map((c: any) => ({ stockName: c.stock_name, weightPct: String(c.weight_pct) }))
      : [{ stockName: '', weightPct: '' }]);
  };

  const addManualRow = () => setManualRows(prev => [...prev, { stockName: '', weightPct: '' }]);
  const removeManualRow = (index: number) => setManualRows(prev => prev.filter((_, i) => i !== index));
  const updateManualRow = (index: number, field: 'stockName' | 'weightPct', value: string) =>
    setManualRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));

  const saveManualMfEntry = async (h: any) => {
    const cleaned = manualRows
      .map(r => ({ stockName: r.stockName.trim(), weightPct: parseFloat(r.weightPct) }))
      .filter(r => r.stockName && !isNaN(r.weightPct));
    if (cleaned.length === 0) { setManualError('Add at least one stock with a valid weight %.'); return; }
    // De-dupe stock names within this batch - the underlying table has a uniqueness
    // constraint per fund, so an accidental double-entry would otherwise fail the save.
    const seen = new Set<string>();
    const deduped = cleaned.filter(r => {
      const key = r.stockName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setManualSaving(true);
    setManualError(null);
    try {
      await saveManualMfHoldings?.(h.id, h.symbol, deduped);
      setManualEntryHoldingId(null);
    } catch (err: any) {
      setManualError(err.message || 'Failed to save holdings.');
    } finally {
      setManualSaving(false);
    }
  };

  // ---- Contributions & Split ----
  const [isAddingContribution, setIsAddingContribution] = useState(false);
  const [cMemberId, setCMemberId] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [cDate, setCDate] = useState(todayStr());
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [editContributionAmount, setEditContributionAmount] = useState('');
  const [editContributionDate, setEditContributionDate] = useState('');
  const [isAddingWithdrawal, setIsAddingWithdrawal] = useState(false);
  const [wMemberId, setWMemberId] = useState('');
  const [wAmount, setWAmount] = useState('');
  const [wDate, setWDate] = useState(todayStr());

  const handleAddWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wMemberId || !wAmount) return;
    await runAction(async () => {
      await addPortfolioWithdrawal(wMemberId, parseFloat(wAmount), wDate);
      setWAmount(''); setIsAddingWithdrawal(false);
    });
  };
  const [isAddingSplit, setIsAddingSplit] = useState(false);
  const [splitMemberId, setSplitMemberId] = useState('');
  const [splitPercent, setSplitPercent] = useState('');
  const [splitFrom, setSplitFrom] = useState(todayStr());
  const [splitTo, setSplitTo] = useState('');

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cMemberId || !cAmount) return;
    await runAction(async () => {
      await addPortfolioContribution(cMemberId, parseFloat(cAmount), cDate);
      setCAmount(''); setIsAddingContribution(false);
    });
  };

  const currentSplits = useMemo(() => {
    const today = todayStr();
    return workspaceMembers.map(m => {
      const active = portfolioSplits.find(s => s.member_user_id === m.uid && s.effective_from <= today && (!s.effective_to || s.effective_to >= today));
      return { member: m, percent: active?.split_percent ?? 0 };
    });
  }, [workspaceMembers, portfolioSplits]);

  // ---- Statement calculations ----
  // Portfolio-aware: when a specific portfolio (or several) is selected via the All/Port1/
  // Port2 row, these headline cards now filter down to match - previously only the "filtered
  // subtotal" cards further down reacted to that selection, leaving the header showing
  // unfiltered totals regardless of what was picked, which looked like the selector wasn't
  // doing anything at the top level.
  const selectedHeaderPortfolioNames = portfolioMode === 'multiple' ? filterOptions.portfolioNames.filter(p => holdingFilters.has(p)) : [];
  const selectedHeaderPortfolioIds = selectedHeaderPortfolioNames.length > 0
    ? portfolios.filter((p: any) => selectedHeaderPortfolioNames.includes(p.name)).map((p: any) => p.id)
    : null;
  const headerContributions = selectedHeaderPortfolioIds ? portfolioContributions.filter((c: any) => selectedHeaderPortfolioIds.includes(c.portfolio_id)) : portfolioContributions;
  const headerWithdrawals = selectedHeaderPortfolioIds ? portfolioWithdrawals.filter((w: any) => selectedHeaderPortfolioIds.includes(w.portfolio_id)) : portfolioWithdrawals;
  const headerCashBalances = selectedHeaderPortfolioIds ? portfolioCashBalances.filter((c: any) => selectedHeaderPortfolioIds.includes(c.portfolio_id)) : portfolioCashBalances;
  const singleHeaderPortfolio = selectedHeaderPortfolioNames.length === 1 ? portfolios.find((p: any) => p.name === selectedHeaderPortfolioNames[0]) : null;
  const headerDisplayCurrency = singleHeaderPortfolio ? singleHeaderPortfolio.currency : baseCurrency;
  const headerHoldingCurrency = (h: any) => portfolios.find((p: any) => p.id === h.portfolio_id)?.currency || h.currency || 'INR';
  const convHeader = (h: any, val: number) => (portfolioMode === 'multiple' && !singleHeaderPortfolio) ? convertToBase(val, headerHoldingCurrency(h), headerDisplayCurrency, workspaceCurrencyRates) : val;
  const fmtHeader = (n: number) => portfolioMode === 'multiple' ? fmtCur(n, headerDisplayCurrency) : fmt(n);

  const totalContributed = headerContributions.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalWithdrawn = headerWithdrawals.reduce((s: number, w: any) => s + Number(w.amount), 0);
  const netContributed = totalContributed - totalWithdrawn;
  const totalInvestedActive = filteredActiveHoldings.reduce((s, h) => s + convHeader(h, Number(h.buy_price) * Number(h.quantity)), 0);
  const totalStockInvestment = totalInvestedActive; // current cost basis of active stock + MF holdings

  // Booked P/L computed directly from actual realized sales, not indirectly from cash
  // balance/contributions (which silently misattributed any unrecorded cash movement -
  // contributions not yet invested, sale proceeds not yet reinvested - as booked gain/loss).
  // A portfolio's baseline (0 if never set) plus the sum of (sold_price - buy_price) x
  // quantity for everything sold after the baseline was actually confirmed - history up to
  // that point stays frozen at whatever's confirmed correct, nothing retroactively
  // recalculated. Uses the baseline's real save timestamp (updated_at), not the
  // user-entered "as of" date field - the feature's intent is "set today's correct value",
  // and if the entered date lags behind the actual save moment, sales in that gap were
  // already reflected in the number the person typed in, so counting them again on top
  // double-counts them.
  const getPortfolioBookedPL = (pid: string | null) => {
    const baseline = portfolioBookedPlBaselines.find((b: any) => (b.portfolio_id ?? null) === (pid ?? null));
    const baselineAmount = baseline ? Number(baseline.baseline_amount) : 0;
    const baselineCutoffDate = baseline ? String(baseline.updated_at).slice(0, 10) : '1900-01-01';
    const realizedSinceBaseline = portfolioHoldings
      .filter((h: any) => h.status === 'sold' && (h.portfolio_id ?? null) === (pid ?? null) && h.sold_date > baselineCutoffDate)
      .reduce((s: number, h: any) => s + convHeader(h, (Number(h.sold_price) - Number(h.buy_price)) * Number(h.quantity)), 0);
    return baselineAmount + realizedSinceBaseline;
  };
  const headerPortfolioIdsForBaseline = selectedHeaderPortfolioIds ?? (portfolioMode === 'multiple' ? portfolios.map((p: any) => p.id) : [null]);
  const bookedProfitLoss = headerPortfolioIdsForBaseline.reduce((total: number, pid: string | null) => total + getPortfolioBookedPL(pid), 0);

  // Per portfolio in scope, uses whichever of three sources was most recently confirmed:
  // (1) sum of actual Cash Balance entries, (2) manually-set Projected Bank Balance, or
  // (3) an always-available auto-calculated figure (net contributed - active cost basis +
  // booked P/L - the same reconciliation identity, now trustworthy since booked P/L no
  // longer circularly depends on cash balance). Manual entries still win when more recent,
  // since a person might know something the formula can't - e.g. cash withdrawn to a
  // personal account that was never logged as a withdrawal.
  const headerPortfolioIdsForCash = selectedHeaderPortfolioIds ?? (portfolioMode === 'multiple' ? portfolios.map((p: any) => p.id) : [null]);
  const balanceCash = headerPortfolioIdsForCash.reduce((total: number, pid: string | null) => {
    const cashRows = portfolioCashBalances.filter((c: any) => (c.portfolio_id ?? null) === (pid ?? null));
    const cashSum = cashRows.reduce((s: number, c: any) => s + Number(c.amount), 0);
    const cashLatest = cashRows.reduce((latest: string | null, c: any) => (!latest || c.updated_at > latest) ? c.updated_at : latest, null as string | null);
    const projectedRow = portfolioProjectedBankBalances.find((p: any) => (p.portfolio_id ?? null) === (pid ?? null));
    if (projectedRow && (!cashLatest || projectedRow.updated_at > cashLatest)) {
      return total + Number(projectedRow.projected_amount);
    }
    if (cashLatest && cashSum !== 0) {
      return total + cashSum;
    }
    // Neither manual source has a meaningful value for this portfolio (never set, or every
    // entry sums to exactly zero - which almost never reflects an actually-maintained zero
    // balance, more likely a leftover placeholder) - fall back to the auto-calculated figure
    // rather than showing a misleading zero.
    const pNetContributed = portfolioContributions.filter((c: any) => (c.portfolio_id ?? null) === (pid ?? null)).reduce((s: number, c: any) => s + Number(c.amount), 0)
      - portfolioWithdrawals.filter((w: any) => (w.portfolio_id ?? null) === (pid ?? null)).reduce((s: number, w: any) => s + Number(w.amount), 0);
    const pActiveCostBasis = filteredActiveHoldings.filter((h: any) => (h.portfolio_id ?? null) === (pid ?? null)).reduce((s, h) => s + convHeader(h, Number(h.buy_price) * Number(h.quantity)), 0);
    return total + (pNetContributed - pActiveCostBasis + getPortfolioBookedPL(pid));
  }, 0);
  const currentValueActive = filteredActiveHoldings.reduce((s, h) => s + convHeader(h, Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity)), 0);
  const unrealizedGain = currentValueActive - totalInvestedActive;
  const realizedGain = soldHoldings.reduce((s, h) => s + (Number(h.sold_price) - Number(h.buy_price)) * Number(h.quantity), 0);
  const totalDividends = portfolioDividends.reduce((s, d) => s + Number(d.amount), 0);
  const totalFees = portfolioFees.reduce((s, f) => s + Number(f.amount), 0);
  const totalInvestedAllTime = totalInvestedActive + soldHoldings.reduce((s, h) => s + Number(h.buy_price) * Number(h.quantity), 0);
  const netGain = (balanceCash + currentValueActive) - netContributed;

  // Daily Change compares Live Price against Yahoo's own previous-close reference - only
  // counts holdings that actually have both values (i.e. have been live-refreshed at least
  // once). Since Previous Load compares Live Price against the file-sourced LTP instead,
  // showing movement since your last broker upload rather than since yesterday's market close.
  const holdingsWithDailyChange = activeHoldings.filter(h => h.live_price != null && h.previous_close != null);
  const dailyChange = holdingsWithDailyChange.reduce((s, h) => s + (Number(h.live_price) - Number(h.previous_close)) * Number(h.quantity), 0);
  const holdingsWithLoadChange = activeHoldings.filter(h => h.live_price != null);
  const sincePreviousLoadChange = holdingsWithLoadChange.reduce((s, h) => s + (Number(h.live_price) - Number(h.current_price ?? h.buy_price)) * Number(h.quantity), 0);
  const returnPct = netContributed > 0 ? (netGain / netContributed) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-5 text-left bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{workspaceName ? `${workspaceName} Portfolio` : 'Portfolio'}</h2>
      </div>

      {isDataLoading ? (
        <div className="flex-1 w-full flex flex-col items-center justify-center gap-3 py-24 bg-slate-50 dark:bg-slate-900">
          <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
          <p className="text-xs text-slate-400">Loading your portfolio…</p>
        </div>
      ) : (
      <>
      {formError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center justify-between gap-2">
          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{formError}</span>
          <button onClick={() => setFormError(null)} className="text-rose-400 hover:text-rose-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="flex gap-1.5">
        <button onClick={() => setHoldingsTab('active')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${holdingsTab === 'active' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Active ({activeHoldings.length})</button>
        <button onClick={() => setHoldingsTab('sold')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${holdingsTab === 'sold' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Sold ({soldHoldings.length})</button>
        <button onClick={() => setHoldingsTab('search')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 ${holdingsTab === 'search' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}><Search className="w-3 h-3" /> Quote Search</button>
        <button onClick={() => setHoldingsTab('settings')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 ${holdingsTab === 'settings' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}><Settings className="w-3 h-3" /> Settings</button>
        {activeHoldings.some(h => h.holding_type === 'mutual_fund') && (
          <button
            onClick={() => { setHoldingsTab('mf-holdings'); loadMfHoldingsCache?.(); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 ${holdingsTab === 'mf-holdings' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
          >
            <PieChart className="w-3 h-3" /> MF Holdings
          </button>
        )}
      </div>

      {holdingsTab === 'search' && (
        <div className="apple-card p-4 space-y-3">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Quote Search</span>
            <p className="text-[9px] text-slate-400">
              {quoteSearchMode === 'stock'
                ? "Not sure what symbol a broker's name actually resolves to? Search here to find the real ticker before entering it via Edit."
                : "Search AMFI's own scheme list to confirm the exact fund name it recognizes, so NAV refresh can match it correctly."}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => { setQuoteSearchMode('stock'); setQuoteSearchResults([]); setQuoteSearchError(null); }} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${quoteSearchMode === 'stock' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Stocks / ETFs</button>
            <button type="button" onClick={() => { setQuoteSearchMode('mf'); setQuoteSearchResults([]); setQuoteSearchError(null); }} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${quoteSearchMode === 'mf' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Mutual Funds</button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={quoteSearchQuery}
              onChange={(e) => setQuoteSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runQuoteSearch(); }}
              placeholder={quoteSearchMode === 'stock' ? 'e.g. Gold BeES, Jyoti Life Sciences, Apple' : 'e.g. Parag Parikh Flexi Cap, Nippon Gold'}
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
            />
            <button
              onClick={runQuoteSearch}
              disabled={quoteSearching || !quoteSearchQuery.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase rounded-lg cursor-pointer shrink-0"
            >
              {quoteSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {quoteSearchError && <p className="text-[10px] text-rose-500 font-semibold">{quoteSearchError}</p>}
          {quoteSearchMode === 'mf' && quoteSearchResults.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-900">
              {quoteSearchResults.map((r: any, i: number) => (
                <div key={i} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{r.schemeName}</p>
                    <p className="text-[10px] text-slate-400">NAV {r.nav.toLocaleString(undefined, { maximumFractionDigits: 4 })}{r.isin ? ` · ${r.isin}` : ''}</p>
                  </div>
                  <button
                    onClick={() => copySymbol(r.schemeName)}
                    title="Copy scheme name"
                    className={`px-2.5 py-1.5 text-xs font-black rounded-lg cursor-pointer shrink-0 transition-colors ${copiedSymbol === r.schemeName ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                  >
                    {copiedSymbol === r.schemeName ? 'Copied ✓' : 'Copy Name'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {quoteSearchMode === 'stock' && quoteSearchResults.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-900">
              {quoteSearchResults.map((r, i) => {
                const changePct = r.price != null && r.previousClose ? ((r.price - r.previousClose) / r.previousClose) * 100 : null;
                return (
                <div key={i} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{r.name}</p>
                    <p className="text-[10px] text-slate-400">{r.exchangeDisplay || r.exchange || 'Unknown exchange'}{r.type ? ` · ${r.type}` : ''}</p>
                    {r.price != null ? (
                      <p className="text-[10px] mt-0.5">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{r.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        {changePct != null && (
                          <span className={`ml-1.5 font-bold ${changePct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%</span>
                        )}
                        <span className="text-slate-400"> · compare against your holding to confirm it's the right match</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-300 dark:text-slate-700 mt-0.5">No live price found for this result</p>
                    )}
                  </div>
                  <button
                    onClick={() => copySymbol(r.symbol)}
                    title="Copy symbol"
                    className={`px-2.5 py-1.5 text-xs font-black rounded-lg cursor-pointer shrink-0 transition-colors ${copiedSymbol === r.symbol ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                  >
                    {copiedSymbol === r.symbol ? 'Copied ✓' : r.symbol}
                  </button>
                </div>
                );
              })}
            </div>
          )}
          {!quoteSearching && quoteSearchResults.length === 0 && !quoteSearchError && quoteSearchQuery && (
            <p className="text-[10px] text-slate-400 text-center py-3">No results yet - try searching above.</p>
          )}
        </div>
      )}

      {holdingsTab === 'mf-holdings' && (() => {
        const mfHoldings = activeHoldings.filter(h => h.holding_type === 'mutual_fund');
        // Cache is keyed by the official AMFI scheme name (e.g. "HDFC Small Cap Fund -
        // Growth Option - Direct Plan"), but h.symbol is the broker's own, differently
        // worded name (e.g. "HDFC SMALL CAP FUND - DIRECT PLAN") - exact string matching
        // after normalization failed for almost every fund except the few where the
        // broker's name happened to exactly equal AMFI's, even though the backend had
        // already correctly fetched and cached real data for all of them. Requires every
        // significant word from the broker's symbol to appear in the cached scheme name,
        // same fuzzy approach the backend already uses to resolve the fund in the first place.
        const cacheFor = (h: any) => {
          const bySchemeCode = mfHoldingsCache.filter((c: any) => c.scheme_code === `MANUAL-${h.id}`);
          if (bySchemeCode.length > 0) return bySchemeCode;
          // "plan"/"option" excluded - broker names and the cached scheme name don't always
          // agree on including these generic structural words (e.g. broker says "- Direct
          // Plan", cached name says just "- Direct - Growth" with no "Plan" anywhere), and
          // neither word actually helps identify which fund this is.
          const targetWords = (h.symbol || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w: string) => w.length > 1 && w !== 'plan' && w !== 'option' && w !== 'options');
          if (targetWords.length === 0) return [];
          const grouped = new Map<string, any[]>();
          mfHoldingsCache.forEach((c: any) => {
            const list = grouped.get(c.scheme_code) || [];
            list.push(c);
            grouped.set(c.scheme_code, list);
          });
          for (const [, rows] of grouped) {
            const nameLower = (rows[0]?.scheme_name || '').toLowerCase();
            if (targetWords.every((w: string) => nameLower.includes(w))) return rows;
          }
          return [];
        };
        const missingCache = mfHoldings.filter(h => cacheFor(h).length === 0);

        const doFetch = async (h: any) => {
          setMfHoldingsFetchingId(h.id);
          setMfHoldingsError(null);
          try {
            const result = await fetchAndCacheMfHoldings?.(h.isin ?? null, h.symbol);
            if (result?.error && (!result.holdings || result.holdings.length === 0)) {
              setMfHoldingsError(`${h.symbol}: ${result.error}`);
            }
          } catch (err: any) {
            setMfHoldingsError(err.message || 'Failed to fetch fund holdings.');
          } finally {
            setMfHoldingsFetchingId(null);
          }
        };

        // One button, fetches every fund that's missing data in sequence (not parallel -
        // gentler on the third-party API, and lets progress be shown per-fund rather than
        // just a single spinner with no idea how far along it is).
        const fetchAllMissing = async () => {
          setMfFetchingAll(true);
          setMfHoldingsError(null);
          const failures: string[] = [];
          for (let i = 0; i < missingCache.length; i++) {
            const h = missingCache[i];
            setMfFetchProgress({ current: i + 1, total: missingCache.length, currentName: h.symbol });
            try {
              const result = await fetchAndCacheMfHoldings?.(h.isin ?? null, h.symbol);
              if (result?.error && (!result.holdings || result.holdings.length === 0)) failures.push(h.symbol);
            } catch {
              failures.push(h.symbol);
            }
          }
          setMfFetchProgress(null);
          setMfFetchingAll(false);
          if (failures.length > 0) setMfHoldingsError(`Couldn't resolve: ${failures.join(', ')} - try Manual entry for these.`);
        };

        const aggregated = (() => {
          const totals = new Map<string, number>();
          let totalMfValue = 0;
          mfHoldings.forEach(h => {
            const value = Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity);
            totalMfValue += value;
            cacheFor(h).forEach((c: any) => {
              const exposure = value * (Number(c.weight_pct) / 100);
              totals.set(c.stock_name, (totals.get(c.stock_name) || 0) + exposure);
            });
          });
          return Array.from(totals.entries())
            .map(([stockName, exposure]) => ({ stockName, exposure, pctOfMf: totalMfValue > 0 ? (exposure / totalMfValue) * 100 : 0 }))
            .sort((a, b) => b.exposure - a.exposure);
        })();
        const maxExposure = aggregated[0]?.exposure || 1;

        const renderManualForm = (h: any) => (
          <div className="bg-white dark:bg-slate-950 rounded-lg p-2.5 space-y-2 mt-2">
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {manualRows.map((row, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={row.stockName}
                    onChange={(e) => updateManualRow(i, 'stockName', e.target.value)}
                    placeholder="Stock name e.g. HDFC Bank"
                    className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px]"
                  />
                  <input
                    type="number"
                    value={row.weightPct}
                    onChange={(e) => updateManualRow(i, 'weightPct', e.target.value)}
                    placeholder="Weight %"
                    className="w-20 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px]"
                  />
                  <button onClick={() => removeManualRow(i)} className="p-1 text-slate-300 hover:text-rose-500 cursor-pointer shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <button onClick={addManualRow} className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Add Row</button>
            {manualError && <p className="text-[10px] text-rose-500 font-semibold">{manualError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => saveManualMfEntry(h)}
                disabled={manualSaving}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer"
              >
                {manualSaving ? 'Saving…' : 'Save Holdings'}
              </button>
              <button onClick={() => setManualEntryHoldingId(null)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase rounded-lg cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        );

        return (
          <div className="space-y-3">
            <div className="apple-card p-4 space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">MF Underlying Holdings</span>
              <p className="text-[9px] text-slate-400">What stocks your mutual funds actually hold, and your combined exposure to each one across every fund.</p>
            </div>

            {/* Combined exposure - always visible, no dropdown needed for the single most useful view */}
            <div className="apple-card p-4 space-y-2.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Combined Top Holdings</span>
              {aggregated.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-4">No holdings data yet - fetch or enter it for your funds below to see your real combined stock exposure here.</p>
              ) : (
                <div className="space-y-2">
                  {aggregated.slice(0, 10).map((row, i) => (
                    <div key={i} className="relative">
                      <div className="absolute inset-0 bg-indigo-50 dark:bg-indigo-950/30 rounded-md" style={{ width: `${Math.max(4, (row.exposure / maxExposure) * 100)}%` }} />
                      <div className="relative flex items-center justify-between px-2.5 py-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{i + 1}. {row.stockName}</span>
                        <span className="text-xs text-right shrink-0 ml-2">
                          <span className="font-black text-slate-700 dark:text-slate-300">{fmtHeader(row.exposure)}</span>
                          <span className="text-slate-400 ml-1.5">{row.pctOfMf.toFixed(1)}%</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Single bulk-fetch button with live per-fund progress */}
            {missingCache.length > 0 && (
              <div className="apple-card p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{missingCache.length} fund{missingCache.length !== 1 ? 's' : ''} not yet allocated</p>
                  <button
                    onClick={fetchAllMissing}
                    disabled={mfFetchingAll}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <RefreshCw className={`w-3 h-3 ${mfFetchingAll ? 'animate-spin' : ''}`} />
                    {mfFetchingAll ? 'Fetching…' : 'Fetch All Holdings'}
                  </button>
                </div>
                {mfFetchProgress && (
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Currently fetching {mfFetchProgress.currentName} ({mfFetchProgress.current} of {mfFetchProgress.total})…</p>
                )}
                {mfHoldingsError && <p className="text-[10px] text-rose-500 font-semibold">{mfHoldingsError}</p>}
              </div>
            )}

            {/* Per-fund accordion - status badge shows allocated/not at a glance, expand for detail */}
            <div className="apple-card divide-y divide-slate-100 dark:divide-slate-900">
              {mfHoldings.map(h => {
                const rows = cacheFor(h).sort((a: any, b: any) => Number(b.weight_pct) - Number(a.weight_pct));
                const isAllocated = rows.length > 0;
                const isExpanded = expandedFundId === h.id;
                const isFetchingThis = mfHoldingsFetchingId === h.id || (mfFetchingAll && mfFetchProgress?.currentName === h.symbol);
                return (
                  <div key={h.id} className="p-3">
                    <button onClick={() => setExpandedFundId(isExpanded ? null : h.id)} className="w-full flex items-center justify-between gap-2 cursor-pointer">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate text-left">{h.symbol}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {isFetchingThis ? (
                          <span className="text-[9px] font-black uppercase text-indigo-500 flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> Fetching</span>
                        ) : isAllocated ? (
                          <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Allocated</span>
                        ) : (
                          <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400">Not Fetched</span>
                        )}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="mt-2.5 pl-1">
                        {isAllocated ? (
                          <div className="divide-y divide-slate-100 dark:divide-slate-900">
                            {rows.map((c: any) => (
                              <div key={c.id} className="flex items-center justify-between py-1.5">
                                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{c.stock_name}</span>
                                <span className="text-[11px] font-black text-slate-500">{Number(c.weight_pct).toFixed(2)}%</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 pb-1">No holdings data yet for this fund.</p>
                        )}
                        <div className="flex gap-1.5 mt-2">
                          {!isAllocated && (
                            <button
                              onClick={() => doFetch(h)}
                              disabled={isFetchingThis}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[9px] font-black uppercase rounded-lg cursor-pointer"
                            >
                              Fetch Holdings %
                            </button>
                          )}
                          <button
                            onClick={() => manualEntryHoldingId === h.id ? setManualEntryHoldingId(null) : openManualMfEntry(h)}
                            className="px-2.5 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase rounded-lg cursor-pointer flex items-center gap-1"
                          >
                            {isAllocated ? 'Edit Manually' : 'Enter Manually'} {manualEntryHoldingId === h.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>
                        {manualEntryHoldingId === h.id && renderManualForm(h)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {holdingsTab === 'settings' && (
        <div className="space-y-3">
        {(() => {
          // Only USD portfolios are eligible - eToro/IG/Webull are US/AU brokers, this
          // keeps the feature scoped and avoids confusing INR-broker (Zerodha/Groww) users
          // with connection options that don't apply to their portfolios.
          const usdPortfolios = portfolioMode === 'multiple' ? portfolios.filter((p: any) => p.currency === 'USD') : [];
          if (portfolioMode !== 'multiple' || usdPortfolios.length === 0) return null;
          const connectionsByPortfolio = new Map<string, any[]>();
          for (const c of portfolioBrokerConnections) {
            if (!c.portfolio_id) continue;
            connectionsByPortfolio.set(c.portfolio_id, [...(connectionsByPortfolio.get(c.portfolio_id) ?? []), c]);
          }
          const targetPortfolioId = brokerConnectPortfolioId || usdPortfolios[0]?.id;
          const existingForTarget = connectionsByPortfolio.get(targetPortfolioId) ?? [];
          const brokerLabels: Record<string, string> = { etoro: 'eToro', ig: 'IG', webull: 'Webull' };
          return (
            <div className="apple-card p-4 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Connect Broker (US/AU)</span>
              <p className="text-[9px] text-slate-400">
                Sync real account holdings directly from a broker's API instead of a manual file upload. Only USD portfolios are eligible. Each account maps to one specific portfolio - connect two eToro accounts by picking a different portfolio for each. All positions are brought in - CFDs, commodities, and leveraged positions included, tagged by type so they stay distinguishable from genuine stock ownership.
              </p>
              <select
                value={targetPortfolioId}
                onChange={(e) => { setBrokerConnectPortfolioId(e.target.value); setBrokerEditingType(null); }}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
              >
                {usdPortfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              {existingForTarget.length > 0 && (
                <div className="space-y-1.5">
                  {existingForTarget.map((conn: any) => (
                    <div key={conn.id} className="flex items-center justify-between px-2.5 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{brokerLabels[conn.broker_type]}</span>
                        <span className="text-[9px] text-slate-400 block">{conn.last_synced_at ? `synced ${new Date(conn.last_synced_at).toLocaleString()}` : 'never synced'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {conn.broker_type === 'etoro' && (
                          <button
                            onClick={() => handleEtoroSync(conn)}
                            disabled={etoroSyncing}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[9px] font-black uppercase rounded-lg cursor-pointer"
                          >
                            {etoroSyncing ? 'Syncing…' : 'Sync'}
                          </button>
                        )}
                        {conn.broker_type !== 'etoro' && (
                          <span className="text-[9px] text-amber-500 font-bold">Coming soon</span>
                        )}
                        <button onClick={() => runAction(() => deletePortfolioBrokerConnection?.(conn.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {brokerEditingType ? (
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-900">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">{brokerLabels[brokerEditingType]} credentials</span>
                  <input
                    type="text"
                    value={etoroApiKeyInput}
                    onChange={(e) => setEtoroApiKeyInput(e.target.value)}
                    placeholder="x-api-key"
                    autoFocus
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-mono"
                  />
                  <input
                    type="password"
                    value={etoroUserKeyInput}
                    onChange={(e) => setEtoroUserKeyInput(e.target.value)}
                    placeholder="x-user-key"
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-mono"
                  />
                  <p className="text-[9px] text-slate-400">Generate these at api-portal.etoro.com → Settings → Trading → API Key Management. Your account must be verified first.</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => runAction(async () => {
                        await setPortfolioBrokerConnection?.(brokerEditingType, { api_key: etoroApiKeyInput.trim(), user_key: etoroUserKeyInput.trim() }, targetPortfolioId);
                        setBrokerEditingType(null);
                        setEtoroApiKeyInput('');
                        setEtoroUserKeyInput('');
                      })}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer"
                    >
                      Save
                    </button>
                    <button onClick={() => { setBrokerEditingType(null); setEtoroApiKeyInput(''); setEtoroUserKeyInput(''); }} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase rounded-lg cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  {(['etoro', 'ig', 'webull'] as const).filter(bt => !existingForTarget.some((c: any) => c.broker_type === bt)).map(bt => (
                    <button
                      key={bt}
                      onClick={() => bt === 'etoro' ? setBrokerEditingType(bt) : null}
                      disabled={bt !== 'etoro'}
                      className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 disabled:opacity-40 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer"
                    >
                      + {brokerLabels[bt]}
                    </button>
                  ))}
                </div>
              )}
              {etoroSyncError && <p className="text-[10px] text-rose-500">{etoroSyncError}</p>}
              {etoroSyncDebug && (
                <div className="text-[9px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 rounded p-2 space-y-0.5 font-mono">
                  <p className="font-bold text-slate-700 dark:text-slate-200">Sync breakdown</p>
                  <p>Total positions from eToro: {etoroSyncDebug.totalPositions}</p>
                  <p>Included positions (all types): {etoroSyncDebug.includedPositions}</p>
                  <p>Consolidated into holdings: {etoroSyncDebug.consolidatedHoldingsCount}</p>
                  {etoroSyncDebug.settlementBreakdown && <p>By type: {JSON.stringify(etoroSyncDebug.settlementBreakdown)}</p>}
                  {etoroSyncDebug.instrumentDebug && etoroSyncDebug.instrumentDebug.resolvedCount < etoroSyncDebug.instrumentDebug.requestedCount && (
                    <>
                      <p className="text-amber-600 dark:text-amber-400 pt-1">Symbol resolution: {etoroSyncDebug.instrumentDebug.resolvedCount}/{etoroSyncDebug.instrumentDebug.requestedCount} resolved</p>
                      <p>Instruments endpoint: status {etoroSyncDebug.instrumentDebug.status}, ok={String(etoroSyncDebug.instrumentDebug.ok)}</p>
                      {etoroSyncDebug.instrumentDebug.rawKeys && <p>Response keys: {JSON.stringify(etoroSyncDebug.instrumentDebug.rawKeys)}</p>}
                      {etoroSyncDebug.instrumentDebug.firstItemKeys && <p>First item keys: {JSON.stringify(etoroSyncDebug.instrumentDebug.firstItemKeys)}</p>}
                      {etoroSyncDebug.instrumentDebug.sample && <p className="break-all">Sample: {etoroSyncDebug.instrumentDebug.sample}</p>}
                      {etoroSyncDebug.instrumentDebug.errorBody && <p className="break-all">Error body: {etoroSyncDebug.instrumentDebug.errorBody}</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}
        <div className="apple-card p-4 space-y-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Cash Balance</span>
          <p className="text-[9px] text-slate-400">
            Uninvested cash sitting in each location - contributed but not yet deployed into holdings.
          </p>
          {portfolioMode === 'multiple' && (
            <select
              value={cashBalancePortfolioId || portfolios[0]?.id || ''}
              onChange={(e) => { setCashBalancePortfolioId(e.target.value); setEditingCashLocation(null); }}
              className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
            >
              {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            {CASH_LOCATIONS.map(loc => {
              // Editing cash requires picking which portfolio it's for in multi-portfolio
              // mode (the dropdown above) - editing without one selected would be ambiguous
              // about which portfolio's cash to actually update.
              const activeCashPortfolioId = portfolioMode === 'multiple' ? (cashBalancePortfolioId || portfolios[0]?.id) : undefined;
              const canEditCash = portfolioMode !== 'multiple' || !!activeCashPortfolioId;
              const existing = portfolioCashBalances.find((c: any) => c.location === loc && (portfolioMode !== 'multiple' || c.portfolio_id === activeCashPortfolioId));
              const isEditing = editingCashLocation === loc;
              return (
                <div key={loc} className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">{loc}</span>
                  {isEditing ? (
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        value={cashAmountInput}
                        onChange={(e) => setCashAmountInput(e.target.value)}
                        autoFocus
                        className="w-full px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
                      />
                      <button
                        onClick={() => runAction(async () => {
                          await setPortfolioCashBalance(loc, parseFloat(cashAmountInput) || 0, undefined, undefined, activeCashPortfolioId);
                          setEditingCashLocation(null);
                        })}
                        className="p-1.5 bg-indigo-600 text-white rounded-md cursor-pointer shrink-0"
                      ><CheckCircle2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingCashLocation(null)} className="p-1.5 text-slate-400 cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900 dark:text-white">{fmt(Number(existing?.amount ?? 0))}</span>
                      {!isReadOnly && canEditCash && (
                        <button
                          onClick={() => { setEditingCashLocation(loc); setCashAmountInput(String(existing?.amount ?? '')); }}
                          className="text-slate-300 hover:text-indigo-500 cursor-pointer"
                        ><Edit2 className="w-3 h-3" /></button>
                      )}
                    </div>
                  )}
                  {existing?.as_of_date && <span className="text-[8px] text-slate-400 block mt-1">as of {existing.as_of_date}</span>}
                </div>
              );
            })}
          </div>
          <div className="pt-1 flex justify-between text-xs">
            <span className="font-bold text-slate-500">Total Cash</span>
            <span className="font-black text-slate-900 dark:text-white">{fmt(portfolioCashBalances.reduce((s: number, c: any) => s + Number(c.amount), 0))}</span>
          </div>
        </div>

        {(() => {
          const baselinePortfolioId = portfolioMode === 'multiple' ? (bookedPlPortfolioId || portfolios[0]?.id) : undefined;
          const canEditBaseline = portfolioMode !== 'multiple' || !!baselinePortfolioId;
          const existingBaseline = portfolioBookedPlBaselines.find((b: any) => (b.portfolio_id ?? null) === (baselinePortfolioId ?? null));
          return (
            <div className="apple-card p-4 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Booked Profit/Loss</span>
              <p className="text-[9px] text-slate-400">
                Set today's actual correct Booked P/L once - from that date forward, it's computed automatically from real sales only (not affected by contributions sitting as cash, or sale proceeds not yet reinvested).
              </p>
              {portfolioMode === 'multiple' && (
                <select
                  value={baselinePortfolioId ?? ''}
                  onChange={(e) => { setBookedPlPortfolioId(e.target.value); setEditingBookedPlBaseline(false); }}
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
                >
                  {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {editingBookedPlBaseline ? (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      value={bookedPlBaselineAmountInput}
                      onChange={(e) => setBookedPlBaselineAmountInput(e.target.value)}
                      placeholder="Amount"
                      autoFocus
                      className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
                    />
                    <input
                      type="date"
                      value={bookedPlBaselineDateInput}
                      onChange={(e) => setBookedPlBaselineDateInput(e.target.value)}
                      className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => runAction(async () => {
                        await setBookedPlBaseline?.(parseFloat(bookedPlBaselineAmountInput) || 0, bookedPlBaselineDateInput, baselinePortfolioId);
                        setEditingBookedPlBaseline(false);
                      })}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer"
                    >
                      Save
                    </button>
                    <button onClick={() => setEditingBookedPlBaseline(false)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase rounded-lg cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{fmt(Number(existingBaseline?.baseline_amount ?? 0))}</span>
                    <span className="text-[9px] text-slate-400 block">{existingBaseline ? `as of ${existingBaseline.baseline_date}` : 'not set - starting from 0'}</span>
                  </div>
                  {!isReadOnly && canEditBaseline && (
                    <button
                      onClick={() => {
                        setEditingBookedPlBaseline(true);
                        setBookedPlBaselineAmountInput(String(existingBaseline?.baseline_amount ?? ''));
                        setBookedPlBaselineDateInput(existingBaseline?.baseline_date ?? todayStr());
                      }}
                      className="text-slate-300 hover:text-indigo-500 cursor-pointer"
                    ><Edit2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {(() => {
          const projPortfolioId = portfolioMode === 'multiple' ? (projectedBalancePortfolioId || portfolios[0]?.id) : undefined;
          const canEditProj = portfolioMode !== 'multiple' || !!projPortfolioId;
          const existingProjected = portfolioProjectedBankBalances.find((p: any) => (p.portfolio_id ?? null) === (projPortfolioId ?? null));
          const cashRowsForScope = portfolioCashBalances.filter((c: any) => (c.portfolio_id ?? null) === (projPortfolioId ?? null));
          const cashLatest = cashRowsForScope.reduce((latest: string | null, c: any) => (!latest || c.updated_at > latest) ? c.updated_at : latest, null as string | null);
          const projectedIsCurrentlyUsed = existingProjected && (!cashLatest || existingProjected.updated_at > cashLatest);
          return (
            <div className="apple-card p-4 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Projected Bank Balance</span>
              <p className="text-[9px] text-slate-400">
                A fallback figure for when Cash Balance above hasn't been kept current. Whichever was updated more recently - Cash Balance's total, or this - wins; if neither has ever been set, an auto-calculated figure (contributions minus active holdings plus Booked P/L) is used instead of an un-set zero.
              </p>
              {portfolioMode === 'multiple' && (
                <select
                  value={projPortfolioId ?? ''}
                  onChange={(e) => { setProjectedBalancePortfolioId(e.target.value); setEditingProjectedBankBalance(false); }}
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
                >
                  {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {editingProjectedBankBalance ? (
                <div className="space-y-2">
                  <input
                    type="number"
                    value={projectedBankBalanceAmountInput}
                    onChange={(e) => setProjectedBankBalanceAmountInput(e.target.value)}
                    placeholder="Amount"
                    autoFocus
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => runAction(async () => {
                        await setProjectedBankBalance?.(parseFloat(projectedBankBalanceAmountInput) || 0, projPortfolioId);
                        setEditingProjectedBankBalance(false);
                      })}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer"
                    >
                      Save
                    </button>
                    <button onClick={() => setEditingProjectedBankBalance(false)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase rounded-lg cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{fmt(Number(existingProjected?.projected_amount ?? 0))}</span>
                    <span className="text-[9px] text-slate-400 block">
                      {existingProjected ? `updated ${new Date(existingProjected.updated_at).toLocaleDateString()}` : 'not set'}
                      {projectedIsCurrentlyUsed && <span className="text-indigo-500 font-bold"> · currently in use (more recent than Cash Balance)</span>}
                    </span>
                  </div>
                  {!isReadOnly && canEditProj && (
                    <button
                      onClick={() => {
                        setEditingProjectedBankBalance(true);
                        setProjectedBankBalanceAmountInput(String(existingProjected?.projected_amount ?? ''));
                      }}
                      className="text-slate-300 hover:text-indigo-500 cursor-pointer"
                    ><Edit2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              )}
            </div>
          );
        })()}
        </div>
      )}

      {holdingsTab === 'active' && (
        <>
      {portfolioMode === 'multiple' && filterOptions.portfolioNames.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setHoldingFilters(prev => { const next = new Set(prev); filterOptions.portfolioNames.forEach(p => next.delete(p)); return next; })}
            className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${filterOptions.portfolioNames.every(p => !holdingFilters.has(p)) ? 'bg-violet-600 text-white' : 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400'}`}
          >
            All
          </button>
          {filterOptions.portfolioNames.map(p => (
            <button key={p} onClick={() => toggleHoldingFilter(p)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${holdingFilters.has(p) ? 'bg-violet-600 text-white' : 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400'}`}>{p}</button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {availableReferenceDates.length > 0 && (
          <>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Reference Load Date</label>
            <select
              value={selectedReferenceDate}
              onChange={(e) => setSelectedReferenceDate(e.target.value)}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
            >
              <option value="latest">Latest</option>
              {availableReferenceDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {selectedReferenceDate !== 'latest' && (
              <span className="text-[9px] text-slate-400">vs today · closest available price used per holding if dates don't align exactly</span>
            )}
          </>
        )}
        {!isReadOnly && activeHoldings.length > 0 && (
          <button
            onClick={() => refreshAllPrices('active')}
            disabled={refreshingPrices}
            className="ml-auto px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingPrices ? 'animate-spin' : ''}`} /> {refreshingPrices ? 'Refreshing…' : 'Refresh Prices'}
          </button>
        )}
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Investment</span>
          <span className="text-base font-black text-slate-900 dark:text-white">{fmtHeader(netContributed)}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">actual contributions, net of withdrawals</span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Balance Cash</span>
          <span className="text-base font-black text-slate-900 dark:text-white">{fmtHeader(balanceCash)}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">from Investment Plan</span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Booked Profit/Loss</span>
          <span className={`text-base font-black flex items-center gap-1 ${bookedProfitLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            {bookedProfitLoss >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {fmtHeader(Math.abs(bookedProfitLoss))}
          </span>
          <span className="text-[9px] text-slate-400 block mt-0.5">from real sales since baseline</span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Stock Investment</span>
          <span className="text-base font-black text-slate-900 dark:text-white">{fmtHeader(totalStockInvestment)}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">stock & MF purchase value</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Current Holdings Value</span>
          <span className="text-base font-black text-slate-900 dark:text-white">{fmtHeader(currentValueActive)}</span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Return %</span>
          <span className={`text-base font-black flex items-center gap-1 ${returnPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            {returnPct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
          </span>
          <span className="text-[9px] text-slate-400 block mt-0.5">vs. total investment</span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Unrealized Gain</span>
          <span className={`text-base font-black flex items-center gap-1 ${unrealizedGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            {unrealizedGain >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {fmtHeader(Math.abs(unrealizedGain))}
          </span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Net Gain (P&L, all-in)</span>
          <span className={`text-base font-black ${netGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{fmtHeader(netGain)}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">cash + stock value vs. contributed</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Daily Change</span>
          {holdingsWithDailyChange.length > 0 ? (
            <>
              <span className={`text-base font-black flex items-center gap-1 ${dailyChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                {dailyChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {fmt(Math.abs(dailyChange))}
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5">vs. previous close ({holdingsWithDailyChange.length} of {activeHoldings.length})</span>
            </>
          ) : (
            <span className="text-sm text-slate-300 dark:text-slate-700">— refresh prices to see this</span>
          )}
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Change Since Previous Load</span>
          {holdingsWithLoadChange.length > 0 ? (
            <>
              <span className={`text-base font-black flex items-center gap-1 ${sincePreviousLoadChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                {sincePreviousLoadChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {fmt(Math.abs(sincePreviousLoadChange))}
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5">live price vs. LTP ({holdingsWithLoadChange.length} of {activeHoldings.length})</span>
            </>
          ) : (
            <span className="text-sm text-slate-300 dark:text-slate-700">— refresh prices to see this</span>
          )}
        </div>
      </div>

      <div className="space-y-4">
          {!isReadOnly && (
          <div className="flex justify-end items-center gap-2 flex-wrap">
            {showMoreActions && activeHoldings.length > 0 && (
              <>
              <button
                onClick={() => {
                  if (isSelectingForTag && bulkActionMode === 'tag') exitSelectMode();
                  else { setBulkActionMode('tag'); setIsSelectingForTag(true); }
                }}
                className={`px-4 py-2 border rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${isSelectingForTag && bulkActionMode === 'tag' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> {isSelectingForTag && bulkActionMode === 'tag' ? 'Cancel Selection' : 'Bulk Tag'}
              </button>
              <button
                onClick={() => {
                  if (isSelectingForTag && bulkActionMode === 'delete') exitSelectMode();
                  else { setBulkActionMode('delete'); setIsSelectingForTag(true); }
                }}
                className={`px-4 py-2 border rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${isSelectingForTag && bulkActionMode === 'delete' ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}
              >
                <Trash2 className="w-3.5 h-3.5" /> {isSelectingForTag && bulkActionMode === 'delete' ? 'Cancel Selection' : 'Bulk Delete'}
              </button>
              </>
            )}
            {showMoreActions && activeHoldings.length > 0 && (
              <button
                onClick={exportActiveHoldingsCsv}
                className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
            {showMoreActions && portfolioMode === 'multiple' && new Set(filteredActiveHoldings.map(h => h.portfolio_id)).size > 1 && (
              <button
                onClick={exportActiveHoldingsXlsx}
                className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="One sheet per portfolio"
              >
                <Download className="w-3.5 h-3.5" /> Export XLSX (by Portfolio)
              </button>
            )}
            {showMoreActions && (
              <button
                onClick={() => { setIsImporting(!isImporting); setImportPreview(null); setImportRawParsed(null); setImportPortfolioConfirmed(false); }}
                className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Import from Broker
              </button>
            )}
            {showMoreActions && (
              <button
                onClick={() => { setIsHistoricalMode(!isHistoricalMode); setHistoricalSnapshots([]); setHistoricalResult(null); setHistoricalPortfolioConfirmed(false); }}
                className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Backfill History
              </button>
            )}
            <button
              onClick={() => setShowMoreActions(!showMoreActions)}
              className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              {showMoreActions ? 'Hide' : 'More'} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMoreActions ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={() => setIsAddingHolding(!isAddingHolding)} className="apple-btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Holding
              </button>
          </div>
          )}

          {isSelectingForTag && (
            <div className="apple-card p-3.5 flex flex-col sm:flex-row sm:items-center gap-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">{selectedHoldingIds.size} selected</span>
              {bulkActionMode === 'tag' ? (
                <>
                  <input
                    type="text"
                    list="source-suggestions"
                    value={bulkTagValue}
                    onChange={(e) => setBulkTagValue(e.target.value)}
                    placeholder="Tag as e.g. Rajavel Stock SME"
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                  <button
                    onClick={applyBulkTag}
                    disabled={bulkTagSaving || selectedHoldingIds.size === 0 || !bulkTagValue.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black uppercase rounded-lg cursor-pointer shrink-0"
                  >
                    {bulkTagSaving ? 'Applying…' : 'Apply Tag'}
                  </button>
                </>
              ) : (
                <button
                  onClick={applyBulkDelete}
                  disabled={bulkDeleting || selectedHoldingIds.size === 0}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-[11px] font-black uppercase rounded-lg cursor-pointer shrink-0 ml-auto"
                >
                  {bulkDeleting ? 'Deleting…' : 'Delete Selected'}
                </button>
              )}
            </div>
          )}
          {priceRefreshSummary && (
            <p className="text-[10px] text-slate-400 -mt-2">{priceRefreshSummary}</p>
          )}

          {isImporting && (
            <div className="apple-card p-4 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Import Holdings File</span>

              {portfolioMode === 'multiple' && !importPortfolioConfirmed ? (
                <>
                  <p className="text-[10px] text-slate-400">Step 1 of 2 - which portfolio should this file go into?</p>
                  <select
                    value={importPortfolioId || defaultPortfolioId}
                    onChange={(e) => setImportPortfolioId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  >
                    {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.currency})</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setImportPortfolioConfirmed(true)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
                  >
                    Next: Choose File
                  </button>
                </>
              ) : (
              <>
              {portfolioMode === 'multiple' && (
                <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-lg px-3 py-2">
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400">Step 2 of 2 - importing into: {portfolios.find((p: any) => p.id === (importPortfolioId || defaultPortfolioId))?.name}</span>
                  <button type="button" onClick={() => setImportPortfolioConfirmed(false)} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer shrink-0">Change</button>
                </div>
              )}
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => { setImportTemplate('zerodha'); setImportPreview(null); setImportRawParsed(null); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${importTemplate === 'zerodha' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Zerodha (Stocks + MF)</button>
                <button type="button" onClick={() => { setImportTemplate('groww_stocks'); setImportPreview(null); setImportRawParsed(null); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${importTemplate === 'groww_stocks' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Groww Stocks</button>
                <button type="button" onClick={() => { setImportTemplate('groww_mf'); setImportPreview(null); setImportRawParsed(null); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${importTemplate === 'groww_mf' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Groww Mutual Funds</button>
                <button type="button" onClick={() => { setImportTemplate('universal'); setImportPreview(null); setImportRawParsed(null); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${importTemplate === 'universal' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Universal Template</button>
              </div>
              <p className="text-[9px] text-slate-400">
                {importTemplate === 'zerodha' && "Console → Holdings → Download as XLSX (stocks and mutual funds are both detected automatically)"}
                {importTemplate === 'groww_stocks' && "Groww app → Reports → Stocks Holdings Statement (XLSX)"}
                {importTemplate === 'groww_mf' && "Groww app → Reports → Mutual Funds Holdings Statement (XLSX)"}
                {importTemplate === 'universal' && "For any broker without a dedicated import yet - fill in the template with your holdings, any currency."}
                {' '}· Prices/quantities come from the file at export time. Already-imported holdings are automatically skipped.
              </p>
              {importTemplate === 'universal' && (
                <button
                  type="button"
                  onClick={() => downloadUniversalTemplate()}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download blank template
                </button>
              )}

              <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50">
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{importParsing ? 'Reading file…' : 'Click to choose your .xlsx file'}</span>
                <span className="text-[10px] text-slate-400">or drag it here</span>
                <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} disabled={importParsing} className="hidden" />
              </label>

              {importPreview && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-900">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {importPreview.fresh.length} new holding{importPreview.fresh.length !== 1 ? 's' : ''} found
                    {importPreview.qtyChanged.length > 0 && ` · ${importPreview.qtyChanged.length} with a changed quantity`}
                    {importPreview.priceChanged.length > 0 && ` · ${importPreview.priceChanged.length} with only a changed avg price`}
                    {importPreview.unchanged > 0 && ` · ${importPreview.unchanged} unchanged (skipped)`}
                    {importPreview.missing.length > 0 && ` · ${importPreview.missing.length} not found in this file`}
                    {' '}· external funds always excluded
                  </p>
                  {importPreview.qtyChanged.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Quantity Changed</span>
                      <div className="max-h-56 overflow-y-auto space-y-1.5">
                        {importPreview.qtyChanged.map((qc, i) => (
                          <div key={i} className="px-2 py-1.5 bg-amber-50 dark:bg-amber-950/20 rounded space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-600 dark:text-slate-300">{qc.parsed.symbol}</span>
                              <span className={`font-bold ${qc.direction === 'increased' ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {qc.existing.quantity} → {qc.parsed.quantity} ({qc.direction === 'increased' ? '+' : ''}{qc.parsed.quantity - Number(qc.existing.quantity)})
                              </span>
                            </div>
                            {qc.direction === 'reduced' && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] text-slate-400 shrink-0">Current avg: <span className="font-bold text-slate-600 dark:text-slate-300">{Number(qc.existing.buy_price).toFixed(2)}</span></span>
                                <span className="text-[9px] text-slate-400 shrink-0">New avg (from file): <span className="font-bold text-slate-600 dark:text-slate-300">{Number(qc.parsed.buyPrice).toFixed(2)}</span></span>
                              </div>
                            )}
                            {qc.direction === 'reduced' && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <label className="text-[9px] text-slate-500 dark:text-slate-400 shrink-0">Sold item's buy price</label>
                                <input
                                  type="number"
                                  value={importReducedOverrides[qc.existing.id]?.soldItemBuyPrice ?? ''}
                                  onChange={(e) => setImportReducedOverrides(prev => ({ ...prev, [qc.existing.id]: { ...prev[qc.existing.id], soldItemBuyPrice: e.target.value, sellPrice: prev[qc.existing.id]?.sellPrice ?? String(qc.parsed.currentPrice) } }))}
                                  className="w-20 px-1.5 py-0.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-[10px]"
                                />
                                <label className="text-[9px] text-slate-500 dark:text-slate-400 shrink-0">Sell price</label>
                                <input
                                  type="number"
                                  value={importReducedOverrides[qc.existing.id]?.sellPrice ?? ''}
                                  onChange={(e) => setImportReducedOverrides(prev => ({ ...prev, [qc.existing.id]: { ...prev[qc.existing.id], sellPrice: e.target.value, soldItemBuyPrice: prev[qc.existing.id]?.soldItemBuyPrice ?? String(qc.existing.buy_price) } }))}
                                  className="w-20 px-1.5 py-0.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-[10px]"
                                />
                              </div>
                            )}
                            {qc.direction === 'reduced' && (
                              <p className="text-[8px] text-slate-400">"Sold item's buy price" defaults to the current average, but if you know the actual lot that got sold (FIFO), correct it here - the broker file only ever gives a blended average, not per-lot cost.</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] text-slate-400">A reduced quantity is recorded as an actual sale for the difference - sell price and new average cost default from the file, both editable above.</p>
                    </div>
                  )}
                  {importPreview.priceChanged.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Average Price Updated (same quantity)</span>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {importPreview.priceChanged.map((pc, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] px-2 py-1 bg-indigo-50 dark:bg-indigo-950/20 rounded">
                            <span className="text-slate-600 dark:text-slate-300">{pc.parsed.symbol}</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {Number(pc.existing.buy_price).toFixed(2)} → {pc.parsed.buyPrice.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] text-slate-400">Same quantity, but the file's average cost differs from what's stored - corrected directly, no shares treated as sold.</p>
                    </div>
                  )}
                  {importPreview.missing.length > 0 && (
                    <div className="space-y-1 bg-rose-50 dark:bg-rose-950/20 rounded-lg p-2">
                      <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase">Not found in this file - likely sold outside the app</span>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400">Check any you know were actually sold - they'll be marked sold using today's date and their last known price as a proxy. Leave unchecked to keep as-is (e.g. if this file only covers part of your holdings).</p>
                      <div className="max-h-52 overflow-y-auto space-y-1">
                        {importPreview.missing.map((h) => {
                          const checked = importMissingSelected.has(h.id);
                          return (
                          <div key={h.id} className="bg-white dark:bg-slate-950 rounded px-2 py-1 space-y-1">
                            <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setImportMissingSelected(prev => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(h.id); else next.delete(h.id);
                                  return next;
                                })}
                                className="cursor-pointer"
                              />
                              <span className="text-slate-600 dark:text-slate-300 flex-1">{h.symbol}</span>
                              <span className="text-slate-400">{h.quantity} held</span>
                            </label>
                            {checked && (
                              <div className="flex items-center gap-2 pl-5">
                                <label className="text-[9px] text-slate-500 dark:text-slate-400 shrink-0">Sell price</label>
                                <input
                                  type="number"
                                  value={importMissingSellPrice[h.id] ?? ''}
                                  onChange={(e) => setImportMissingSellPrice(prev => ({ ...prev, [h.id]: e.target.value }))}
                                  className="w-24 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px]"
                                />
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                      {importPreview.missing.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setImportMissingSelected(new Set(importPreview.missing.map(h => h.id)))}
                          className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
                        >
                          Select all {importPreview.missing.length}
                        </button>
                      )}
                    </div>
                  )}
                  {importPreview.fresh.length > 0 && (
                    <>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">New</span>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {importPreview.fresh.map((h, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] px-2 py-1 bg-slate-50 dark:bg-slate-900 rounded">
                            <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                              {h.symbol}
                              {h.holdingType === 'mutual_fund' && <span className="text-[8px] font-bold px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-full">MF</span>}
                              {h.source && <span className="text-[8px] font-bold px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full">{h.source}</span>}
                            </span>
                            <span className="text-slate-400">{h.quantity} @ {fmtCur(h.buyPrice, h.currency || 'INR')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Purchase date for all</label>
                        <input
                          type="date"
                          value={importBuyDate}
                          onChange={(e) => setImportBuyDate(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                        />
                      </div>
                      <input
                        type="text"
                        list="source-suggestions"
                        value={importSourceTag}
                        onChange={(e) => setImportSourceTag(e.target.value)}
                        placeholder="Tag any without a detected source as e.g. Rajavel Stock SME (optional)"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </>
                  )}
                  {(importPreview.fresh.length > 0 || importPreview.qtyChanged.length > 0 || importPreview.priceChanged.length > 0 || importMissingSelected.size > 0) && (
                    <button
                      onClick={confirmImport}
                      disabled={importSaving}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black uppercase rounded-lg cursor-pointer"
                    >
                      {importSaving ? 'Importing…' : `Import ${importPreview.fresh.length} New${importPreview.qtyChanged.length > 0 ? ` + Update ${importPreview.qtyChanged.length}` : ''}${importPreview.priceChanged.length > 0 ? ` + Fix ${importPreview.priceChanged.length} Price${importPreview.priceChanged.length !== 1 ? 's' : ''}` : ''}${importMissingSelected.size > 0 ? ` + Mark ${importMissingSelected.size} Sold` : ''}`}
                    </button>
                  )}
                </div>
              )}
              </>
              )}
            </div>
          )}

          {isHistoricalMode && (
            <div className="apple-card p-4 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Backfill Historical Prices</span>

              {portfolioMode === 'multiple' && !historicalPortfolioConfirmed ? (
                <>
                  <p className="text-[10px] text-slate-400">Step 1 of 2 - which portfolio do these files belong to?</p>
                  <select
                    value={historicalPortfolioId || defaultPortfolioId}
                    onChange={(e) => setHistoricalPortfolioId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  >
                    {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.currency})</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setHistoricalPortfolioConfirmed(true)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
                  >
                    Next: Choose Files
                  </button>
                </>
              ) : (
              <>
              {portfolioMode === 'multiple' && (
                <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-lg px-3 py-2">
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400">Step 2 of 2 - importing into: {portfolios.find((p: any) => p.id === (historicalPortfolioId || defaultPortfolioId))?.name}</span>
                  <button type="button" onClick={() => setHistoricalPortfolioConfirmed(false)} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer shrink-0">Change</button>
                </div>
              )}
              <p className="text-[9px] text-slate-400">Select several dated exports from the same broker at once (e.g. one file per month). Each file's date is detected automatically, and the whole timeline is processed together - the earliest file sets when a stock was first known, every date becomes a price point for the trend charts, the latest file becomes the current price, and any stock present in an earlier file but missing from the latest one is automatically marked Sold (it's no longer in your portfolio).</p>              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => { setHistoricalTemplate('zerodha'); setHistoricalSnapshots([]); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${historicalTemplate === 'zerodha' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Zerodha (Stocks + MF)</button>
                <button type="button" onClick={() => { setHistoricalTemplate('groww_stocks'); setHistoricalSnapshots([]); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${historicalTemplate === 'groww_stocks' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Groww Stocks</button>
                <button type="button" onClick={() => { setHistoricalTemplate('groww_mf'); setHistoricalSnapshots([]); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${historicalTemplate === 'groww_mf' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Groww Mutual Funds</button>
              </div>

              <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50">
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{historicalParsing ? 'Reading files…' : 'Click to choose multiple .xlsx files'}</span>
                <span className="text-[10px] text-slate-400">select all your dated exports at once</span>
                <input type="file" accept=".xlsx,.xls" multiple onChange={handleHistoricalFiles} disabled={historicalParsing} className="hidden" />
              </label>

              {historicalSnapshots.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {historicalSnapshots.length} dated snapshot{historicalSnapshots.length !== 1 ? 's' : ''} found, {historicalSnapshots[0].date} → {historicalSnapshots[historicalSnapshots.length - 1].date}
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {historicalSnapshots.map(s => (
                      <div key={s.date} className="flex items-center justify-between text-[10px] px-2 py-1 bg-slate-50 dark:bg-slate-900 rounded">
                        <span className="text-slate-600 dark:text-slate-300">{s.date}</span>
                        <span className="text-slate-400">{s.holdings.length} holdings · {s.fileName}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={confirmHistoricalImport}
                    disabled={historicalSaving}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black uppercase rounded-lg cursor-pointer"
                  >
                    {historicalSaving ? 'Processing timeline…' : `Process ${historicalSnapshots.length} Snapshots`}
                  </button>
                </div>
              )}

              {historicalResult && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Done: {historicalResult.stockCount} stocks processed, {historicalResult.newCount} newly added, {historicalResult.updatedCount} quantity updated, {historicalResult.soldCount} marked sold (missing from latest known date), {historicalResult.skippedStaleCount > 0 && `${historicalResult.skippedStaleCount} skipped (older than data already on file), `}{historicalResult.priceHistoryCount} price points recorded.
                </p>
              )}
              </>
              )}
            </div>
          )}

          {isAddingHolding && (
            <form onSubmit={handleAddHolding} className="apple-card p-4 space-y-2.5">
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setHHoldingType('stock')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${hHoldingType === 'stock' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Stock</button>
                <button type="button" onClick={() => setHHoldingType('mutual_fund')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${hHoldingType === 'mutual_fund' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Mutual Fund</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                <input type="text" list="broker-suggestions" value={hBroker} onChange={(e) => setHBroker(e.target.value as any)} placeholder="Broker" className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <datalist id="broker-suggestions">
                  <option>Zerodha</option><option>Groww</option>
                  {Array.from(new Set(portfolioHoldings.map(h => h.broker).filter(b => b && b !== 'Zerodha' && b !== 'Groww'))).map(b => <option key={b} value={b} />)}
                </datalist>
                {hHoldingType === 'stock' ? (
                  <>
                    <input type="text" list="exchange-suggestions" value={hExchange} onChange={(e) => setHExchange(e.target.value as any)} placeholder="Exchange e.g. NSE, NASDAQ" className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                    <datalist id="exchange-suggestions">
                      <option>NSE</option><option>BSE</option><option>NASDAQ</option><option>NYSE</option><option>ASX</option><option>LSE</option><option>TSX</option>
                      {Array.from(new Set(portfolioHoldings.map(h => h.exchange).filter(e => e && !['NSE', 'BSE', 'NASDAQ', 'NYSE', 'ASX', 'LSE', 'TSX'].includes(e)))).map(e => <option key={e} value={e} />)}
                    </datalist>
                  </>
                ) : <div />}
                <input type="text" value={hSymbol} onChange={(e) => setHSymbol(e.target.value)} placeholder={hHoldingType === 'stock' ? 'Symbol e.g. TCS' : 'Fund name'} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <input type="number" value={hQty} onChange={(e) => setHQty(e.target.value)} placeholder={hHoldingType === 'stock' ? 'Quantity' : 'Units'} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <input type="number" value={hPrice} onChange={(e) => setHPrice(e.target.value)} placeholder={hHoldingType === 'stock' ? 'Buy price/share' : 'Buy NAV'} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <select value={hCurrency} onChange={(e) => setHCurrency(e.target.value as any)} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" title="Currency this holding is tracked in">
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                  <option value="AUD">A$ AUD</option>
                </select>
                {portfolioMode === 'multiple' && (
                  <select
                    value={hPortfolioId || defaultPortfolioId}
                    onChange={(e) => setHPortfolioId(e.target.value)}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    title="Which portfolio this holding belongs to"
                  >
                    {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.currency})</option>)}
                  </select>
                )}
                <input
                  type="text"
                  list="source-suggestions"
                  value={hSource}
                  onChange={(e) => setHSource(e.target.value)}
                  placeholder="Source e.g. Own Research, Rajavel, TV"
                  className="col-span-2 md:col-span-3 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                />
                <datalist id="source-suggestions">
                  {Array.from(new Set(portfolioHoldings.map(h => h.source).filter(Boolean))).map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              {hHoldingType === 'stock' && (
                <>
                  <button type="button" onClick={() => setShowTargetPlan(!showTargetPlan)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                    {showTargetPlan ? '− Hide target & hold plan' : '+ Set target & hold plan (optional)'}
                  </button>
                  {showTargetPlan && (
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <div className="flex gap-1.5 col-span-2">
                        <button type="button" onClick={() => setHTargetType('percent')} className={`flex-1 py-1 rounded-md text-[10px] font-bold cursor-pointer ${hTargetType === 'percent' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Target % Gain</button>
                        <button type="button" onClick={() => setHTargetType('price')} className={`flex-1 py-1 rounded-md text-[10px] font-bold cursor-pointer ${hTargetType === 'price' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Target Price ₹</button>
                      </div>
                      <input type="number" value={hTargetValue} onChange={(e) => setHTargetValue(e.target.value)} placeholder={hTargetType === 'percent' ? 'e.g. 25 (%)' : 'e.g. 1500 (₹)'} className="col-span-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs" />
                      <div className="flex gap-1.5 col-span-2 pt-1">
                        <button type="button" onClick={() => setHHoldType('days')} className={`flex-1 py-1 rounded-md text-[10px] font-bold cursor-pointer ${hHoldType === 'days' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Hold N Days</button>
                        <button type="button" onClick={() => setHHoldType('date')} className={`flex-1 py-1 rounded-md text-[10px] font-bold cursor-pointer ${hHoldType === 'date' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Hold Until Date</button>
                      </div>
                      {hHoldType === 'days' ? (
                        <input type="number" value={hHoldDays} onChange={(e) => setHHoldDays(e.target.value)} placeholder="e.g. 90 days" className="col-span-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs" />
                      ) : (
                        <input type="date" value={hHoldUntilDate} onChange={(e) => setHHoldUntilDate(e.target.value)} className="col-span-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs" />
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => setIsAddingHolding(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-black uppercase rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase rounded-lg cursor-pointer">Add</button>
              </div>
            </form>
          )}

          {(filterOptions.combos.length > 1 || filterOptions.sources.length > 0 || filterOptions.priceMoves.length > 0 || activeHoldings.some(h => h.price_lookup_failed)) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setHoldingFilters(new Set())} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${holdingFilters.size === 0 ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>All</button>
              {activeHoldings.some(h => h.price_lookup_failed) && (
                <button onClick={() => toggleHoldingFilter(SYMBOL_NOT_FOUND_FILTER)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${holdingFilters.has(SYMBOL_NOT_FOUND_FILTER) ? 'bg-rose-600 text-white' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'}`}>
                  Symbol Not Found ({activeHoldings.filter(h => h.price_lookup_failed).length})
                </button>
              )}
              {filterOptions.combos.map(c => (
                <button key={c} onClick={() => toggleHoldingFilter(c)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${brokerPillClass(c, holdingFilters.has(c))}`}>{c}</button>
              ))}
              {showFilters && filterOptions.sources.map(s => (
                <button key={s} onClick={() => toggleHoldingFilter(s)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${holdingFilters.has(s) ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}>{s}</button>
              ))}
              {showFilters && filterOptions.changes.map(c => (
                <button key={c} onClick={() => toggleHoldingFilter(c)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${holdingFilters.has(c) ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'}`}>{c}</button>
              ))}
              {showFilters && filterOptions.priceMoves.map(p => (
                <button key={p} onClick={() => toggleHoldingFilter(p)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${holdingFilters.has(p) ? (p === 'Price Up (Live)' ? 'bg-emerald-600 text-white' : 'bg-rose-500 text-white') : (p === 'Price Up (Live)' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400')}`}>{p}</button>
              ))}
              {(filterOptions.sources.length > 0 || filterOptions.changes.length > 0 || filterOptions.priceMoves.length > 0) && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center gap-0.5"
                >
                  {showFilters ? 'Hide' : 'More'} <ChevronDown className={`w-2.5 h-2.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          )}

          {holdingFilters.size > 0 && (() => {
            const filterLabel = Array.from(holdingFilters).join(' + ');
            // Currency-aware: if exactly one portfolio is selected, show its own currency
            // with no conversion needed (all its holdings share that currency). Otherwise
            // (All, or several portfolios spanning currencies), convert everything into the
            // workspace's base currency before summing, using the saved exchange rates.
            const selectedPortfolioNames = filterOptions.portfolioNames.filter(p => holdingFilters.has(p));
            const singlePortfolioSelected = portfolioMode === 'multiple' && selectedPortfolioNames.length === 1
              ? portfolios.find((p: any) => p.name === selectedPortfolioNames[0])
              : null;
            const subtotalCurrency = singlePortfolioSelected ? singlePortfolioSelected.currency : baseCurrency;
            const holdingCurrency = (h: any) => portfolios.find((p: any) => p.id === h.portfolio_id)?.currency || h.currency || 'INR';
            const conv = (h: any, val: number) => (portfolioMode === 'multiple' && !singlePortfolioSelected) ? convertToBase(val, holdingCurrency(h), subtotalCurrency, workspaceCurrencyRates) : val;
            const fmtSub = (n: number) => portfolioMode === 'multiple' ? fmtCur(n, subtotalCurrency) : fmt(n);
            const subInvested = filteredActiveHoldings.reduce((s, h) => s + conv(h, Number(h.buy_price) * Number(h.quantity)), 0);
            const subCurrent = filteredActiveHoldings.reduce((s, h) => s + conv(h, Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity)), 0);
            const subGain = subCurrent - subInvested;
            const subGainPct = subInvested > 0 ? (subGain / subInvested) * 100 : 0;
            const subDailyEligible = filteredActiveHoldings.filter(h => h.live_price != null && h.previous_close != null);
            const subDailyChange = subDailyEligible.reduce((s, h) => s + conv(h, (Number(h.live_price) - Number(h.previous_close)) * Number(h.quantity)), 0);
            const subLoadEligible = filteredActiveHoldings.filter(h => h.live_price != null);
            const subLoadChange = subLoadEligible.reduce((s, h) => s + conv(h, (Number(h.live_price) - Number(h.current_price ?? h.buy_price)) * Number(h.quantity)), 0);
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" Invested</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{fmtSub(subInvested)}</span>
                </div>
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" Current Value</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{fmtSub(subCurrent)}</span>
                </div>
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" Net Gain</span>
                  <span className={`text-sm font-black ${subGain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{subGain >= 0 ? '+' : ''}{fmtSub(subGain)}</span>
                </div>
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" % Chg</span>
                  <span className={`text-sm font-black ${subGainPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{subGainPct >= 0 ? '+' : ''}{subGainPct.toFixed(2)}%</span>
                </div>
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" Daily Change</span>
                  {subDailyEligible.length > 0 ? (
                    <span className={`text-sm font-black ${subDailyChange >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{subDailyChange >= 0 ? '+' : ''}{fmtSub(subDailyChange)}</span>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-700">—</span>
                  )}
                </div>
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" Since Previous Load</span>
                  {subLoadEligible.length > 0 ? (
                    <span className={`text-sm font-black ${subLoadChange >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{subLoadChange >= 0 ? '+' : ''}{fmtSub(subLoadChange)}</span>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-700">—</span>
                  )}
                </div>
              </div>
            );
          })()}

          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active ({filteredActiveHoldings.length}{holdingFilters.size > 0 ? ` of ${activeHoldings.length}` : ''})</span>
              <button onClick={openColumnCustomizer} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-indigo-500 cursor-pointer">
                <Settings className="w-3 h-3" /> Columns
              </button>
            </div>
            <div className="apple-card mt-1.5 overflow-x-auto">
              {filteredActiveHoldings.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">No active holdings match this filter.</p>
              ) : (
                <table className="w-full text-xs min-w-[720px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-900 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      {isSelectingForTag && (
                        <th className="p-2.5 text-left w-8">
                          <input
                            type="checkbox"
                            checked={filteredActiveHoldings.length > 0 && filteredActiveHoldings.every(h => selectedHoldingIds.has(h.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedHoldingIds(prev => new Set([...prev, ...filteredActiveHoldings.map(h => h.id)]));
                              } else {
                                setSelectedHoldingIds(prev => { const next = new Set(prev); filteredActiveHoldings.forEach(h => next.delete(h.id)); return next; });
                              }
                            }}
                            className="w-4 h-4 cursor-pointer accent-indigo-600"
                            title="Select all"
                          />
                        </th>
                      )}
                      {([
                        { key: 'symbol', label: 'Instrument', align: 'text-left' as const },
                        ...visibleColumns.map(c => {
                          let label = c.label;
                          if (c.key === 'since_reference') label = selectedReferenceDate === 'latest' ? 'Since Reference (%)' : `Since ${selectedReferenceDate} (%)`;
                          if (c.key === 'since_reference_amount') label = selectedReferenceDate === 'latest' ? 'Since Reference ($)' : `Since ${selectedReferenceDate} ($)`;
                          return { key: c.key, label, align: c.align };
                        }),
                      ]).map(({ key: field, label, align }) => (
                        <th
                          key={field}
                          onClick={() => toggleSort(field as SortField)}
                          className={`p-2.5 ${align} cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300`}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            {label}
                            {sortField === field ? <span className="text-indigo-500">{sortDirection === 'asc' ? '↑' : '↓'}</span> : <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600" />}
                          </span>
                        </th>
                      ))}
                      <th className="p-2.5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                    {filteredActiveHoldings.map(h => {
                      const currentPriceNum = Number(h.live_price ?? h.current_price ?? h.buy_price);
                      const gain = (currentPriceNum - Number(h.buy_price)) * Number(h.quantity);
                      const gainPct = ((currentPriceNum - Number(h.buy_price)) / Number(h.buy_price)) * 100;
                      const invested = Number(h.buy_price) * Number(h.quantity);
                      const curValue = currentPriceNum * Number(h.quantity);
                      const sinceReferencePct = getSinceReferencePct(h);

                      const targetPrice = h.target_type === 'price' ? Number(h.target_price)
                        : h.target_type === 'percent' ? Number(h.buy_price) * (1 + Number(h.target_percent) / 100)
                        : null;
                      const targetProgressPct = targetPrice
                        ? Math.max(0, Math.min(100, ((currentPriceNum - Number(h.buy_price)) / (targetPrice - Number(h.buy_price))) * 100))
                        : null;

                      const holdUntil = h.hold_type === 'date' ? new Date(h.hold_until_date)
                        : h.hold_type === 'days' ? new Date(new Date(h.buy_date).getTime() + Number(h.hold_days) * 86400000)
                        : null;

                      return (
                        <React.Fragment key={h.id}>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          {isSelectingForTag && (
                            <td className="p-2.5">
                              <input type="checkbox" checked={selectedHoldingIds.has(h.id)} onChange={() => toggleHoldingSelected(h.id)} className="w-4 h-4 cursor-pointer accent-indigo-600" />
                            </td>
                          )}
                          <td className="p-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="relative max-w-[140px]">
                                <span onClick={() => setExpandedNameId(prev => (prev === h.id ? null : h.id))} onMouseEnter={() => setExpandedNameId(h.id)} onMouseLeave={() => setExpandedNameId(prev => (prev === h.id ? null : prev))} className="font-bold text-slate-900 dark:text-white truncate block cursor-pointer">{h.symbol}</span>
                                {expandedNameId === h.id && (
                                  <div className="absolute left-0 bottom-full mb-0.5 z-20 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-semibold rounded-md shadow-lg whitespace-normal max-w-[220px]">
                                    {h.symbol}
                                  </div>
                                )}
                              </span>
                              {h.broker === 'Groww' && h.holding_type === 'stock' && !h.ticker && (
                                <span title="No ticker set - Refresh Prices will skip this stock until you add one" className="text-rose-500 font-black cursor-help">*</span>
                              )}
                              <button
                                onClick={() => toggleExpandHolding(h)}
                                title="Set target price & date"
                                className="text-slate-300 hover:text-indigo-500 cursor-pointer"
                              >
                                <ChevronDown className={`w-3 h-3 transition-transform ${expandedHoldingId === h.id ? 'rotate-180' : ''}`} />
                              </button>
                              <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">{h.broker}</span>
                              {portfolioMode === 'multiple' && (
                                <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 dark:text-indigo-400 rounded-full">
                                  {portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned'}
                                </span>
                              )}
                              {!isReadOnly ? (
                                <button
                                  onClick={() => runAction(() => updatePortfolioHolding(h.id, { holdingType: h.holding_type === 'mutual_fund' ? 'stock' : 'mutual_fund' }))}
                                  title="Click to switch between Stock and Mutual Fund"
                                  className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full cursor-pointer ${h.holding_type === 'mutual_fund' ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800'}`}
                                >
                                  {h.holding_type === 'mutual_fund' ? 'MF' : 'Stock'}
                                </button>
                              ) : (
                                h.holding_type === 'mutual_fund' && <span className="text-[8px] font-bold px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-full">MF</span>
                              )}
                              {h.source && <span className="text-[8px] font-bold px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full">{h.source}</span>}
                              {h.price_lookup_failed && <span className="text-[8px] font-black px-1.5 py-0.2 bg-rose-500 text-white rounded-full" title="Last refresh couldn't find this symbol - check Symbol/Exchange via Edit">Symbol Not Found</span>}
                              {h.change_flag && CHANGE_FLAG_LABELS[h.change_flag] && <span className="text-[8px] font-black px-1.5 py-0.2 bg-amber-500 text-white rounded-full">{CHANGE_FLAG_LABELS[h.change_flag]}</span>}
                              {h.currency && h.currency !== 'INR' && <span className="text-[8px] font-black px-1.5 py-0.2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-full">{h.currency}</span>}
                            </div>
                            {(targetPrice || holdUntil) && (
                              <div className="flex items-center gap-2 mt-1">
                                {targetPrice && <span className="text-[8px] text-slate-400">Target ₹{targetPrice.toFixed(2)} · {targetProgressPct!.toFixed(0)}%</span>}
                                {holdUntil && <span className="text-[8px] text-slate-400">Hold until {holdUntil.toISOString().slice(0, 10)}</span>}
                              </div>
                            )}
                          </td>
                          {visibleColumns.map(col => {
                            switch (col.key) {
                              case 'quantity':
                                return (
                                  <td
                                    key="quantity"
                                    className="p-2.5 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap relative"
                                    onMouseEnter={() => setExpandedQtyId(h.id)}
                                    onMouseLeave={() => setExpandedQtyId(prev => (prev === h.id ? null : prev))}
                                  >
                                    <span onClick={() => setExpandedQtyId(prev => (prev === h.id ? null : h.id))} className="cursor-pointer">
                                      {fmtQty(Number(h.quantity))}
                                    </span>
                                    {expandedQtyId === h.id && (
                                      <div className="absolute right-0 bottom-full mb-0.5 z-20 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-semibold rounded-md shadow-lg whitespace-nowrap">
                                        {h.quantity}
                                      </div>
                                    )}
                                  </td>
                                );
                              case 'buy_price':
                                return <td key="buy_price" className="p-2.5 text-right text-slate-600 dark:text-slate-300">₹{Number(h.buy_price).toFixed(2)}</td>;
                              case 'current_price':
                                return (
                                  <td key="current_price" className="p-2.5 text-right">
                                    {priceEdits[h.id] !== undefined ? (
                                      <div className="flex items-center justify-end gap-1">
                                        <input
                                          autoFocus
                                          type="number"
                                          value={priceEdits[h.id]}
                                          onChange={(e) => setPriceEdits(prev => ({ ...prev, [h.id]: e.target.value }))}
                                          className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[11px]"
                                        />
                                        <button onClick={() => saveCurrentPrice(h.id)} className="p-1 bg-indigo-600 text-white rounded-md cursor-pointer"><CheckCircle2 className="w-3 h-3" /></button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setPriceEdits(prev => ({ ...prev, [h.id]: String(Number(h.current_price ?? h.buy_price)) }))} className="font-bold text-slate-900 dark:text-white flex items-center gap-1 ml-auto cursor-pointer" title="Update LTP (last file-sourced price)">
                                        ₹{Number(h.current_price ?? h.buy_price).toFixed(2)} <RefreshCw className="w-2.5 h-2.5 text-slate-400" />
                                      </button>
                                    )}
                                  </td>
                                );
                              case 'live_price':
                                return (
                                  <td key="live_price" className="p-2.5 text-right text-slate-600 dark:text-slate-300">
                                    {h.live_price != null ? `₹${Number(h.live_price).toFixed(2)}` : <span className="text-slate-300 dark:text-slate-700">—</span>}
                                  </td>
                                );
                              case 'daily_change': {
                                if (h.live_price == null || h.previous_close == null) {
                                  return <td key="daily_change" className="p-2.5 text-right"><span className="text-slate-300 dark:text-slate-700">—</span></td>;
                                }
                                const dc = (Number(h.live_price) - Number(h.previous_close)) * Number(h.quantity);
                                return <td key="daily_change" className={`p-2.5 text-right font-bold ${dc >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{dc >= 0 ? '+' : ''}{fmt(dc)}</td>;
                              }
                              case 'since_previous_load': {
                                if (h.live_price == null) {
                                  return <td key="since_previous_load" className="p-2.5 text-right"><span className="text-slate-300 dark:text-slate-700">—</span></td>;
                                }
                                const sl = (Number(h.live_price) - Number(h.current_price ?? h.buy_price)) * Number(h.quantity);
                                return <td key="since_previous_load" className={`p-2.5 text-right font-bold ${sl >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{sl >= 0 ? '+' : ''}{fmt(sl)}</td>;
                              }
                              case 'invested':
                                return <td key="invested" className="p-2.5 text-right text-slate-600 dark:text-slate-300">{fmt(invested)}</td>;
                              case 'current_value':
                                return <td key="current_value" className="p-2.5 text-right text-slate-600 dark:text-slate-300">{fmt(curValue)}</td>;
                              case 'gain':
                                return <td key="gain" className={`p-2.5 text-right font-bold ${gain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{gain >= 0 ? '+' : ''}{fmt(gain)}</td>;
                              case 'gain_pct':
                                return <td key="gain_pct" className={`p-2.5 text-right font-bold ${gainPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%</td>;
                              case 'since_reference':
                                return (
                                  <td key="since_reference" className="p-2.5 text-right">
                                    {sinceReferencePct !== null ? (
                                      <span className={`font-bold ${sinceReferencePct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`} title={selectedReferenceDate !== 'latest' ? `Price on/before ${selectedReferenceDate} used as baseline` : `Reference: ₹${Number(h.reference_price).toFixed(2)} on ${h.reference_date}`}>
                                        {sinceReferencePct >= 0 ? '+' : ''}{sinceReferencePct.toFixed(2)}%
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700">—</span>
                                    )}
                                  </td>
                                );
                              case 'since_reference_amount': {
                                const sinceRefAmount = getSinceReferenceAmount(h);
                                return (
                                  <td key="since_reference_amount" className="p-2.5 text-right">
                                    {sinceRefAmount !== null ? (
                                      <span className={`font-bold ${sinceRefAmount >= 0 ? 'text-emerald-600' : 'text-rose-500'}`} title={selectedReferenceDate !== 'latest' ? `Price on/before ${selectedReferenceDate} used as baseline` : `Reference: ₹${Number(h.reference_price).toFixed(2)} on ${h.reference_date}`}>
                                        {sinceRefAmount >= 0 ? '+' : ''}{fmt(sinceRefAmount)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700">—</span>
                                    )}
                                  </td>
                                );
                              }
                              default:
                                return null;
                            }
                          })}
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!isReadOnly && (sellingId === h.id ? (
                                <div className="flex items-center gap-1">
                                  <input type="number" value={sellQuantity} onChange={(e) => setSellQuantity(e.target.value)} placeholder={String(h.quantity)} title="Quantity to sell (defaults to full holding)" className="w-14 px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[10px]" />
                                  <input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="Sell price" className="w-16 px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[10px]" />
                                  <button onClick={() => confirmSell(Number(h.quantity))} className="p-1 bg-rose-500 text-white rounded-md cursor-pointer"><CheckCircle2 className="w-3 h-3" /></button>
                                  <button onClick={() => { setSellingId(null); setSellQuantity(''); }} className="p-1 text-slate-400 cursor-pointer"><X className="w-3 h-3" /></button>
                                </div>
                              ) : (
                                <button onClick={() => { setSellingId(h.id); setSellPrice(String(currentPriceNum)); setSellQuantity(''); }} className="px-2 py-1 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase rounded-md cursor-pointer">Sell</button>
                              ))}
                              {!isReadOnly && (
                                <button onClick={() => openEditHolding(h)} className="p-1 text-slate-300 hover:text-indigo-500 cursor-pointer" title="Edit holding"><Edit2 className="w-3.5 h-3.5" /></button>
                              )}
                              {!isReadOnly && (
                                <button onClick={() => runAction(() => deletePortfolioHolding(h.id))} className="p-1 text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                              )}
                              <button
                                onClick={() => toggleExpandHolding(h)}
                                title="Set target price & date"
                                className="p-1 text-slate-300 hover:text-indigo-500 cursor-pointer"
                              >
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedHoldingId === h.id ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedHoldingId === h.id && (
                          <tr>
                            <td colSpan={(isSelectingForTag ? 1 : 0) + 2 + visibleColumns.length} className="p-3 bg-slate-50 dark:bg-slate-900">
                              <div className="grid grid-cols-2 gap-2 max-w-lg">
                                <div className="col-span-2">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Ticker (for live price refresh)</label>
                                  <input
                                    type="text"
                                    value={editTicker}
                                    onChange={(e) => setEditTicker(e.target.value.toUpperCase())}
                                    disabled={h.broker === 'Zerodha' && !h.price_lookup_failed}
                                    placeholder={h.broker === 'Groww' ? 'e.g. RELIANCE' : ''}
                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                  />
                                  {h.broker === 'Zerodha' && h.price_lookup_failed && <p className="text-[8px] text-rose-500 mt-0.5">Zerodha's symbol didn't resolve on the last refresh - correct it here (use Quote Search to find the real one).</p>}
                                  {h.broker === 'Zerodha' && !h.price_lookup_failed && <p className="text-[8px] text-slate-400 mt-0.5">Zerodha's symbol is already a real ticker - no change needed.</p>}
                                  {h.broker === 'Groww' && !h.ticker && <p className="text-[8px] text-rose-500 mt-0.5">Not set - Refresh Prices will skip this stock until you add one.</p>}
                                </div>
                                <div className="flex gap-1.5 col-span-2">
                                  <button type="button" onClick={() => setEditTargetType('percent')} className={`flex-1 py-1 rounded-md text-[10px] font-bold cursor-pointer ${editTargetType === 'percent' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Target % Gain</button>
                                  <button type="button" onClick={() => setEditTargetType('price')} className={`flex-1 py-1 rounded-md text-[10px] font-bold cursor-pointer ${editTargetType === 'price' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Target Price ₹</button>
                                </div>
                                <input type="number" value={editTargetValue} onChange={(e) => setEditTargetValue(e.target.value)} placeholder={editTargetType === 'percent' ? 'e.g. 25 (%)' : 'e.g. 1500 (₹)'} className="col-span-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs" />
                                <div className="flex gap-1.5 col-span-2">
                                  <button type="button" onClick={() => setEditHoldType('days')} className={`flex-1 py-1 rounded-md text-[10px] font-bold cursor-pointer ${editHoldType === 'days' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Hold N Days</button>
                                  <button type="button" onClick={() => setEditHoldType('date')} className={`flex-1 py-1 rounded-md text-[10px] font-bold cursor-pointer ${editHoldType === 'date' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>Hold Until Date</button>
                                </div>
                                {editHoldType === 'days' ? (
                                  <input type="number" value={editHoldDays} onChange={(e) => setEditHoldDays(e.target.value)} placeholder="e.g. 90 days" className="col-span-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs" />
                                ) : (
                                  <input type="date" value={editHoldUntilDate} onChange={(e) => setEditHoldUntilDate(e.target.value)} className="col-span-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs" />
                                )}
                                {!isReadOnly && (
                                  <button
                                    onClick={() => runAction(async () => {
                                      await updatePortfolioHolding(h.id, {
                                        targetType: editTargetValue ? editTargetType : null,
                                        targetPrice: editTargetValue && editTargetType === 'price' ? parseFloat(editTargetValue) : null,
                                        targetPercent: editTargetValue && editTargetType === 'percent' ? parseFloat(editTargetValue) : null,
                                        holdType: (editHoldType === 'days' ? editHoldDays : editHoldUntilDate) ? editHoldType : null,
                                        holdDays: editHoldType === 'days' && editHoldDays ? parseInt(editHoldDays) : null,
                                        holdUntilDate: editHoldType === 'date' && editHoldUntilDate ? editHoldUntilDate : null,
                                        ticker: editTicker.trim() || null,
                                      });
                                      setExpandedHoldingId(null);
                                    })}
                                    className="col-span-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-md cursor-pointer"
                                  >
                                    Save Ticker, Target & Hold Plan
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
      </div>

        </>
      )}

      {holdingsTab === 'sold' && (
        <>
          {portfolioMode === 'multiple' && soldFilterOptions.portfolioNames.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSoldHoldingFilters(prev => { const next = new Set(prev); soldFilterOptions.portfolioNames.forEach(p => next.delete(p)); return next; })}
                className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${soldFilterOptions.portfolioNames.every(p => !soldHoldingFilters.has(p)) ? 'bg-violet-600 text-white' : 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400'}`}
              >
                All
              </button>
              {soldFilterOptions.portfolioNames.map(p => (
                <button key={p} onClick={() => toggleSoldHoldingFilter(p)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${soldHoldingFilters.has(p) ? 'bg-violet-600 text-white' : 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400'}`}>{p}</button>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            {soldHoldings.length > 0 && (
              <button
                onClick={exportSoldHoldingsCsv}
                className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
            {portfolioMode === 'multiple' && new Set(filteredSoldHoldings.map(h => h.portfolio_id)).size > 1 && (
              <button
                onClick={exportSoldHoldingsXlsx}
                className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="One sheet per portfolio"
              >
                <Download className="w-3.5 h-3.5" /> Export XLSX (by Portfolio)
              </button>
            )}
            {!isReadOnly && (
            <button
              onClick={() => refreshAllPrices('sold')}
              disabled={refreshingPrices}
              className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingPrices ? 'animate-spin' : ''}`} /> {refreshingPrices ? 'Refreshing…' : 'Refresh Prices'}
            </button>
            )}
          </div>
          {priceRefreshSummary && (
            <p className="text-[10px] text-slate-400 -mt-2">{priceRefreshSummary}</p>
          )}

          {(soldFilterOptions.combos.length > 1 || soldFilterOptions.sources.length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setSoldHoldingFilters(new Set())} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${soldHoldingFilters.size === 0 ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>All</button>
              {soldFilterOptions.combos.map(c => (
                <button key={c} onClick={() => toggleSoldHoldingFilter(c)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${brokerPillClass(c, soldHoldingFilters.has(c))}`}>{c}</button>
              ))}
              {showFilters && soldFilterOptions.sources.map(s => (
                <button key={s} onClick={() => toggleSoldHoldingFilter(s)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${soldHoldingFilters.has(s) ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}>{s}</button>
              ))}
              {soldFilterOptions.sources.length > 0 && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center gap-0.5"
                >
                  {showFilters ? 'Hide' : 'More'} <ChevronDown className={`w-2.5 h-2.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          )}

          {(() => {
            const selectedSoldPortfolios = soldFilterOptions.portfolioNames.filter(p => soldHoldingFilters.has(p));
            const singleSoldPortfolio = portfolioMode === 'multiple' && selectedSoldPortfolios.length === 1
              ? portfolios.find((p: any) => p.name === selectedSoldPortfolios[0])
              : null;
            const soldDisplayCurrency = singleSoldPortfolio ? singleSoldPortfolio.currency : baseCurrency;
            const soldHoldingCurrency = (h: any) => portfolios.find((p: any) => p.id === h.portfolio_id)?.currency || h.currency || 'INR';
            const convSold = (h: any, val: number) => (portfolioMode === 'multiple' && !singleSoldPortfolio) ? convertToBase(val, soldHoldingCurrency(h), soldDisplayCurrency, workspaceCurrencyRates) : val;
            const fmtSold = (n: number) => portfolioMode === 'multiple' ? fmtCur(n, soldDisplayCurrency) : fmt(n);
            const buyValue = filteredSoldHoldings.reduce((s, h) => s + convSold(h, Number(h.buy_price) * Number(h.quantity)), 0);
            const soldValue = filteredSoldHoldings.reduce((s, h) => s + convSold(h, Number(h.sold_price) * Number(h.quantity)), 0);
            const pl = soldValue - buyValue;
            const sinceSoldEligible = filteredSoldHoldings.filter(h => h.live_price != null);
            const sinceSoldTotal = sinceSoldEligible.reduce((s, h) => s + convSold(h, (Number(h.live_price) - Number(h.sold_price)) * Number(h.quantity)), 0);
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="apple-card p-3">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Buy Value</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{fmtSold(buyValue)}</span>
                </div>
                <div className="apple-card p-3">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Sold Value</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{fmtSold(soldValue)}</span>
                </div>
                <div className="apple-card p-3">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Profit/Loss</span>
                  <span className={`text-sm font-black ${pl >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{pl >= 0 ? '+' : ''}{fmtSold(pl)}</span>
                </div>
                <div className="apple-card p-3">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Since Sold</span>
                  {sinceSoldEligible.length > 0 ? (
                    <span className={`text-sm font-black ${sinceSoldTotal >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{sinceSoldTotal >= 0 ? '+' : ''}{fmtSold(sinceSoldTotal)}</span>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-700">— refresh prices</span>
                  )}
                </div>
              </div>
            );
          })()}

          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sold ({filteredSoldHoldings.length}{soldHoldingFilters.size > 0 ? ` of ${soldHoldings.length}` : ''})</span>
            <div className="apple-card mt-1.5 overflow-x-auto">
              {filteredSoldHoldings.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No sold holdings{soldHoldingFilters.size > 0 ? ' match this filter' : ' yet'}.</p>
              ) : (
                <table className="w-full text-xs min-w-[720px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-900 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      {([
                        ['symbol', 'Instrument', 'text-left'],
                        ['quantity', 'Qty', 'text-right'],
                        ['buy_price', 'Buy Price', 'text-right'],
                        ['sold_price', 'Sold Price', 'text-right'],
                        ['invested', 'Invested', 'text-right'],
                        ['sold_value', 'Sold Value', 'text-right'],
                        ['gain', 'Net Gain', 'text-right'],
                        ['gain_pct', '% Chg', 'text-right'],
                        ['sold_date', 'Sold Date', 'text-right'],
                        ['since_sold', 'Since Sold', 'text-right'],
                      ] as [string, string, string][]).map(([field, label, align]) => (
                        <th
                          key={field}
                          onClick={() => toggleSoldSort(field)}
                          className={`p-2.5 ${align} cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300`}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            {label}
                            {soldSortField === field ? <span className="text-indigo-500">{soldSortDirection === 'asc' ? '↑' : '↓'}</span> : <ArrowUpDown className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600" />}
                          </span>
                        </th>
                      ))}
                      <th className="p-2.5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                    {filteredSoldHoldings.map(h => {
                      const invested = Number(h.buy_price) * Number(h.quantity);
                      const soldValue = Number(h.sold_price) * Number(h.quantity);
                      const gain = soldValue - invested;
                      const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
                      return (
                        <React.Fragment key={h.id}>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="p-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="relative max-w-[140px]">
                                <span onClick={() => setExpandedNameId(prev => (prev === h.id ? null : h.id))} onMouseEnter={() => setExpandedNameId(h.id)} onMouseLeave={() => setExpandedNameId(prev => (prev === h.id ? null : prev))} className="font-bold text-slate-900 dark:text-white truncate block cursor-pointer">{h.symbol}</span>
                                {expandedNameId === h.id && (
                                  <div className="absolute left-0 bottom-full mb-0.5 z-20 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-semibold rounded-md shadow-lg whitespace-normal max-w-[220px]">
                                    {h.symbol}
                                  </div>
                                )}
                              </span>
                              <button
                                onClick={() => setEditingSoldTickerId(prev => (prev === h.id ? null : h.id))}
                                title="Set ticker for live price refresh"
                                className="text-slate-300 hover:text-indigo-500 cursor-pointer"
                              >
                                <ChevronDown className={`w-3 h-3 transition-transform ${editingSoldTickerId === h.id ? 'rotate-180' : ''}`} />
                              </button>
                              <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">{h.broker}</span>
                              {portfolioMode === 'multiple' && (
                                <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 dark:text-indigo-400 rounded-full">
                                  {portfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned'}
                                </span>
                              )}
                              {h.holding_type === 'mutual_fund' && <span className="text-[8px] font-bold px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-full">MF</span>}
                              {h.source && <span className="text-[8px] font-bold px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full">{h.source}</span>}
                              {h.price_lookup_failed && <span className="text-[8px] font-black px-1.5 py-0.2 bg-rose-500 text-white rounded-full" title="Last refresh couldn't find this symbol - check Symbol/Exchange via Edit">Symbol Not Found</span>}
                            </div>
                          </td>
                          <td
                            className="p-2.5 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap relative"
                            onMouseEnter={() => setExpandedQtyId(h.id)}
                            onMouseLeave={() => setExpandedQtyId(prev => (prev === h.id ? null : prev))}
                          >
                            <span onClick={() => setExpandedQtyId(prev => (prev === h.id ? null : h.id))} className="cursor-pointer">
                              {fmtQty(Number(h.quantity))}
                            </span>
                            {expandedQtyId === h.id && (
                              <div className="absolute right-0 bottom-full mb-0.5 z-20 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-semibold rounded-md shadow-lg whitespace-nowrap">
                                {h.quantity}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-right text-slate-600 dark:text-slate-300">₹{Number(h.buy_price).toFixed(2)}</td>
                          <td className="p-2.5 text-right text-slate-600 dark:text-slate-300">₹{Number(h.sold_price).toFixed(2)}</td>
                          <td className="p-2.5 text-right text-slate-500">{fmt(invested)}</td>
                          <td className="p-2.5 text-right text-slate-900 dark:text-white font-semibold">{fmt(soldValue)}</td>
                          <td className={`p-2.5 text-right font-bold ${gain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{gain >= 0 ? '+' : ''}{fmt(gain)}</td>
                          <td className={`p-2.5 text-right font-bold ${gainPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%</td>
                          <td className="p-2.5 text-right text-slate-400">{h.sold_date}</td>
                          <td className="p-2.5 text-right">
                            {h.live_price != null ? (() => {
                              const sinceSoldPct = Number(h.sold_price) !== 0 ? ((Number(h.live_price) - Number(h.sold_price)) / Number(h.sold_price)) * 100 : null;
                              return sinceSoldPct !== null ? (
                                <span className={`font-bold ${sinceSoldPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{sinceSoldPct >= 0 ? '+' : ''}{sinceSoldPct.toFixed(2)}%</span>
                              ) : <span className="text-slate-300 dark:text-slate-700">—</span>;
                            })() : h.broker === 'Groww' && !h.ticker ? (
                              <span className="text-[9px] text-rose-400" title="No ticker set - tap the arrow next to the name to add one">no ticker</span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioHolding(h.id))} className="p-1 text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                          </td>
                        </tr>
                        {editingSoldTickerId === h.id && (
                          <tr>
                            <td colSpan={11} className="p-3 bg-slate-50 dark:bg-slate-900">
                              <div className="max-w-xs">
                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Ticker (for live price refresh)</label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    autoFocus
                                    type="text"
                                    value={soldTickerInput}
                                    onChange={(e) => setSoldTickerInput(e.target.value.toUpperCase())}
                                    placeholder={h.ticker || 'e.g. RELIANCE'}
                                    className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs"
                                  />
                                  <button
                                    onClick={() => runAction(async () => {
                                      await updatePortfolioHolding(h.id, { ticker: soldTickerInput.trim() || null });
                                      setEditingSoldTickerId(null);
                                    })}
                                    className="p-1.5 bg-indigo-600 text-white rounded-md cursor-pointer"
                                  ><CheckCircle2 className="w-3.5 h-3.5" /></button>
                                </div>
                                {h.ticker && <p className="text-[9px] text-slate-400 mt-1">Currently: {h.ticker}</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

          {!isReadOnly && (
            <div className="apple-card p-4 space-y-2 border-rose-200 dark:border-rose-900/50">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider">Danger Zone</span>
              <p className="text-[9px] text-slate-400">Permanently deletes everything in this workspace's Portfolio - all holdings, price history, contributions, splits, withdrawals, dividends, fees, recurring plans, and snapshots. This cannot be undone.</p>
              {!isConfirmingWipe ? (
                <button onClick={() => setIsConfirmingWipe(true)} className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase rounded-lg cursor-pointer">
                  Delete All Portfolio Data
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">Type DELETE to confirm - this removes everything permanently.</p>
                  <div className="flex gap-2">
                    <input type="text" value={wipeConfirmText} onChange={(e) => setWipeConfirmText(e.target.value)} placeholder="DELETE" className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-rose-200 dark:border-rose-900 rounded-lg text-xs" />
                    <button
                      onClick={() => runAction(async () => {
                        await deleteAllPortfolioData();
                        setIsConfirmingWipe(false);
                        setWipeConfirmText('');
                      })}
                      disabled={wipeConfirmText !== 'DELETE'}
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer"
                    >
                      Confirm Delete
                    </button>
                    <button onClick={() => { setIsConfirmingWipe(false); setWipeConfirmText(''); }} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase rounded-lg cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
      </>
      )}

      {isCustomizingColumns && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setIsCustomizingColumns(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customize Columns</h3>
              <button onClick={() => setIsCustomizingColumns(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <p className="px-4 pt-3 text-[10px] text-slate-400">Instrument always shows first. Toggle others on/off and reorder with the arrows - saved just for you on this workspace.</p>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg opacity-60">
                <span className="text-xs font-semibold text-slate-500">Instrument</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Always shown</span>
              </div>
              {draftColumns.map((col, i) => {
                const meta = DEFAULT_COLUMNS.find(c => c.key === col.key);
                return (
                  <div key={col.key} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                      <input type="checkbox" checked={col.visible} onChange={() => toggleDraftColumnVisible(col.key)} className="w-4 h-4 cursor-pointer accent-indigo-600" />
                      <span className={`text-xs font-semibold ${col.visible ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{meta?.label ?? col.key}</span>
                    </label>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => moveDraftColumn(i, -1)} disabled={i === 0} className="p-1 text-slate-400 hover:text-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronUp className="w-4 h-4" /></button>
                      <button onClick={() => moveDraftColumn(i, 1)} disabled={i === draftColumns.length - 1} className="p-1 text-slate-400 hover:text-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
              <button onClick={resetColumnCustomization} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase cursor-pointer">
                Reset
              </button>
              <button onClick={saveColumnCustomization} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase cursor-pointer">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {editingHoldingId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setEditingHoldingId(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Holding</h3>
              <button onClick={() => setEditingHoldingId(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Symbol</label>
                  <input
                    type="text"
                    value={editForm.symbol ?? ''}
                    onChange={(e) => {
                      const newSymbol = e.target.value;
                      // Ticker follows symbol live as you type, as long as it was already
                      // matching the old symbol (i.e. no deliberate override in place) -
                      // this is what actually gets refreshed for live price, so keeping
                      // them in sync here is what prevents the "fixed the symbol but the
                      // price lookup is still broken" confusion from happening again.
                      const tickerWasFollowing = !editForm.ticker || editForm.ticker.toUpperCase() === (editForm.symbol || '').toUpperCase();
                      setEditForm({ ...editForm, symbol: newSymbol, ticker: tickerWasFollowing ? newSymbol.toUpperCase() : editForm.ticker });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Ticker (live price lookup)</label>
                  <input
                    type="text"
                    value={editForm.ticker ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, ticker: e.target.value.toUpperCase() })}
                    placeholder="e.g. RELIANCE"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  />
                  <p className="text-[8px] text-slate-400 mt-0.5">What price refresh actually uses - follows Symbol unless you set it differently here.</p>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Broker</label>
                  <input type="text" list="edit-broker-suggestions" value={editForm.broker ?? ''} onChange={(e) => setEditForm({ ...editForm, broker: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                  <datalist id="edit-broker-suggestions">
                    <option>Zerodha</option><option>Groww</option>
                    {Array.from(new Set(portfolioHoldings.map(h => h.broker).filter(b => b && b !== 'Zerodha' && b !== 'Groww'))).map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Holding Type</label>
                  <select value={editForm.holdingType ?? 'stock'} onChange={(e) => setEditForm({ ...editForm, holdingType: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                    <option value="stock">Stock</option>
                    <option value="mutual_fund">Mutual Fund</option>
                  </select>
                </div>
                {editForm.holdingType === 'stock' && (
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Exchange</label>
                    <input type="text" list="edit-exchange-suggestions" value={editForm.exchange ?? ''} onChange={(e) => setEditForm({ ...editForm, exchange: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                    <datalist id="edit-exchange-suggestions">
                      <option>NSE</option><option>BSE</option><option>NASDAQ</option><option>NYSE</option><option>ASX</option><option>LSE</option><option>TSX</option>
                    </datalist>
                  </div>
                )}
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">ISIN (optional)</label>
                  <input type="text" value={editForm.isin ?? ''} onChange={(e) => setEditForm({ ...editForm, isin: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Currency</label>
                  <select value={editForm.currency ?? 'INR'} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                    {['INR', 'USD', 'AUD', 'EUR', 'GBP', 'SGD', 'AED', 'CAD'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Quantity</label>
                  <input type="number" value={editForm.quantity ?? ''} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Buy Price</label>
                  <input type="number" value={editForm.buyPrice ?? ''} onChange={(e) => setEditForm({ ...editForm, buyPrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Buy Date</label>
                  <input type="date" value={editForm.buyDate ?? ''} onChange={(e) => setEditForm({ ...editForm, buyDate: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Current Price (optional)</label>
                  <input type="number" value={editForm.currentPrice ?? ''} onChange={(e) => setEditForm({ ...editForm, currentPrice: e.target.value })} placeholder="Leave blank to keep as-is" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                </div>
                {portfolioMode === 'multiple' && (
                  <div className="col-span-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Portfolio</label>
                    <select value={editForm.portfolioId ?? ''} onChange={(e) => setEditForm({ ...editForm, portfolioId: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                      {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.currency})</option>)}
                    </select>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Source (optional)</label>
                  <input type="text" list="source-suggestions" value={editForm.source ?? ''} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                </div>
              </div>
              {editError && <p className="text-[10px] text-rose-500 font-semibold">{editError}</p>}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
              <button onClick={() => setEditingHoldingId(null)} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase cursor-pointer">
                Cancel
              </button>
              <button onClick={saveEditHolding} disabled={editSaving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase cursor-pointer">
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
