import { parseBrokerFile, parseBrokerFileWithDate, BrokerTemplate, ParsedHolding } from '../utils/brokerImport';
import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Plus, Trash2, RefreshCw, Users, Wallet,
  CheckCircle2, X, Briefcase, Gift, Receipt, Upload, Edit2, ChevronDown, ArrowUpDown, Settings, ChevronUp
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
  addPortfolioSplit: (memberUserId: string, percent: number, from: string, to?: string) => Promise<void>;
  deletePortfolioSplit: (id: string) => Promise<void>;
  portfolioHoldings: any[];
  portfolioPriceHistory: any[];
  addPortfolioHolding: (h: {
    holdingType?: 'stock' | 'mutual_fund'; broker: string; symbol: string; isin?: string; exchange: string; quantity: number; buyPrice: number; buyDate: string; currentPrice?: number; notes?: string;
    source?: string; currency?: 'INR' | 'USD' | 'AUD';
    targetType?: 'price' | 'percent'; targetPrice?: number; targetPercent?: number;
    holdType?: 'days' | 'date'; holdDays?: number; holdUntilDate?: string;
  }) => Promise<void>;
  bulkAddPortfolioHoldings: (holdings: {
    holdingType: 'stock' | 'mutual_fund'; broker: string; symbol: string; isin?: string; exchange: string; quantity: number; buyPrice: number; buyDate: string; currentPrice?: number; source?: string;
  }[]) => Promise<void>;
  reconcilePortfolioHoldingQuantity: (id: string, newQuantity: number, changeFlag: 'qty_increased' | 'qty_reduced') => Promise<void>;
  bulkHistoricalImport: (snapshots: { date: string; holdings: any[] }[]) => Promise<{ newCount: number; updatedCount: number; soldCount: number; skippedStaleCount: number; priceHistoryCount: number; stockCount: number }>;
  updatePortfolioHolding: (id: string, updates: any) => Promise<void>;
  updatePortfolioHoldingLivePrice: (id: string, price: number, previousClose?: number | null) => Promise<void>;
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
const fmtQty = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);

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
    portfolioSplits, addPortfolioSplit, deletePortfolioSplit, portfolioCashBalances,
    portfolioHoldings, portfolioPriceHistory, addPortfolioHolding, bulkAddPortfolioHoldings, reconcilePortfolioHoldingQuantity, bulkHistoricalImport, updatePortfolioHolding, updatePortfolioHoldingLivePrice, deletePortfolioHolding, bulkTagPortfolioHoldings, bulkDeletePortfolioHoldings, deleteAllPortfolioData,
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
  const [hCurrency, setHCurrency] = useState<'INR' | 'USD' | 'AUD'>('INR');
  const [showTargetPlan, setShowTargetPlan] = useState(false);
  const [hTargetType, setHTargetType] = useState<'price' | 'percent'>('percent');
  const [hTargetValue, setHTargetValue] = useState('');
  const [hHoldType, setHHoldType] = useState<'days' | 'date'>('days');
  const [hHoldDays, setHHoldDays] = useState('');
  const [hHoldUntilDate, setHHoldUntilDate] = useState('');
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [sellingId, setSellingId] = useState<string | null>(null);
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
  const [holdingsTab, setHoldingsTab] = useState<'active' | 'sold'>('active');
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

  const filterOptions = useMemo(() => {
    const combos = new Set<string>();
    const sources = new Set<string>();
    const changes = new Set<string>();
    const priceMoves = new Set<string>();
    let hasUnclassified = false;
    activeHoldings.forEach(h => {
      combos.add(`${h.broker} ${h.holding_type === 'mutual_fund' ? 'MF' : 'Stock'}`);
      if (h.source) sources.add(h.source); else hasUnclassified = true;
      if (h.change_flag && CHANGE_FLAG_LABELS[h.change_flag]) changes.add(CHANGE_FLAG_LABELS[h.change_flag]);
      const moveLabel = getSinceUploadLabel(h);
      if (moveLabel) priceMoves.add(moveLabel);
    });
    const sortedSources = Array.from(sources).sort();
    if (hasUnclassified) sortedSources.push(UNCLASSIFIED_LABEL);
    return { combos: Array.from(combos).sort(), sources: sortedSources, changes: Array.from(changes).sort(), priceMoves: Array.from(priceMoves).sort() };
  }, [activeHoldings]);

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
      list = activeHoldings.filter(h => {
        const combo = `${h.broker} ${h.holding_type === 'mutual_fund' ? 'MF' : 'Stock'}`;
        const comboOk = selectedCombos.length === 0 || selectedCombos.includes(combo);
        const sourceOk = selectedSources.length === 0 || (h.source ? selectedSources.includes(h.source) : selectedSources.includes(UNCLASSIFIED_LABEL));
        const changeLabel = h.change_flag ? CHANGE_FLAG_LABELS[h.change_flag] : null;
        const changeOk = selectedChanges.length === 0 || (changeLabel && selectedChanges.includes(changeLabel));
        const moveLabel = getSinceUploadLabel(h);
        const priceMoveOk = selectedPriceMoves.length === 0 || (moveLabel && selectedPriceMoves.includes(moveLabel));
        return comboOk && sourceOk && changeOk && priceMoveOk;
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
    let hasUnclassified = false;
    soldHoldings.forEach(h => {
      combos.add(`${h.broker} ${h.holding_type === 'mutual_fund' ? 'MF' : 'Stock'}`);
      if (h.source) sources.add(h.source); else hasUnclassified = true;
    });
    const sortedSources = Array.from(sources).sort();
    if (hasUnclassified) sortedSources.push(UNCLASSIFIED_LABEL);
    return { combos: Array.from(combos).sort(), sources: sortedSources };
  }, [soldHoldings]);

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
      list = soldHoldings.filter(h => {
        const combo = `${h.broker} ${h.holding_type === 'mutual_fund' ? 'MF' : 'Stock'}`;
        const comboOk = selectedCombos.length === 0 || selectedCombos.includes(combo);
        const sourceOk = selectedSources.length === 0 || (h.source ? selectedSources.includes(h.source) : selectedSources.includes(UNCLASSIFIED_LABEL));
        return comboOk && sourceOk;
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
    unchanged: number;
  } | null>(null);
  const [importSourceTag, setImportSourceTag] = useState('');
  const [importBuyDate, setImportBuyDate] = useState(todayStr());
  const [importSaving, setImportSaving] = useState(false);

  type ImportClassification = { status: 'new' } | { status: 'unchanged'; existing: any } | { status: 'qty_changed'; existing: any; direction: 'increased' | 'reduced' };

  const classifyImportRow = (parsed: ParsedHolding): ImportClassification => {
    const existing = portfolioHoldings.find(h => {
      if (h.status !== 'active') return false;
      if (h.broker !== parsed.broker) return false; // same stock via a different broker is a separate, legitimate holding
      if (parsed.isin && h.isin) return h.isin === parsed.isin;
      // Groww MF: the same fund name can appear more than once under different folios
      // (e.g. one External, one bought via the app) - folio number is what's actually unique.
      if (parsed.folioNumber && h.folio_number) return h.folio_number === parsed.folioNumber && h.symbol === parsed.symbol.toUpperCase();
      return h.symbol === parsed.symbol.toUpperCase() && h.holding_type === parsed.holdingType && !h.folio_number && !parsed.folioNumber;
    });
    if (!existing) return { status: 'new' };
    if (Number(existing.quantity) === parsed.quantity) return { status: 'unchanged', existing };
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
      })));
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

  // Recompute the preview whenever the raw parse changes
  useEffect(() => {
    if (!importRawParsed) { setImportPreview(null); return; }
    const fresh: ParsedHolding[] = [];
    const qtyChanged: { parsed: ParsedHolding; existing: any; direction: 'increased' | 'reduced' }[] = [];
    let unchanged = 0;
    importRawParsed.forEach(h => {
      const c = classifyImportRow(h);
      if (c.status === 'new') fresh.push(h);
      else if (c.status === 'qty_changed') qtyChanged.push({ parsed: h, existing: c.existing, direction: c.direction });
      else unchanged++;
    });
    setImportPreview({ fresh, qtyChanged, unchanged });
  }, [importRawParsed]);

  const confirmImport = async () => {
    if (!importPreview || (importPreview.fresh.length === 0 && importPreview.qtyChanged.length === 0)) return;
    setImportSaving(true);
    await runAction(async () => {
      if (importPreview.fresh.length > 0) {
        await bulkAddPortfolioHoldings(
          importPreview.fresh.map(h => ({
            holdingType: h.holdingType, broker: h.broker, symbol: h.symbol, isin: h.isin, folioNumber: h.folioNumber, exchange: h.exchange,
            quantity: h.quantity, buyPrice: h.buyPrice, buyDate: importBuyDate, currentPrice: h.currentPrice,
            source: h.source || importSourceTag.trim() || undefined,
          }))
        );
      }
      for (const { parsed, existing, direction } of importPreview.qtyChanged) {
        await reconcilePortfolioHoldingQuantity(existing.id, parsed.quantity, direction === 'increased' ? 'qty_increased' : 'qty_reduced');
      }
      setImportPreview(null);
      setImportRawParsed(null);
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
      if (refreshable.length === 0) {
        setPriceRefreshSummary(skippedNoTicker > 0 ? `${skippedNoTicker} stock${skippedNoTicker !== 1 ? 's' : ''} need a ticker set before they can be refreshed.` : 'No stock holdings to refresh (mutual funds need manual NAV updates).');
        return;
      }
      const symbols = refreshable.map(h => ({ symbol: h.ticker, exchange: h.exchange }));
      const resp = await fetch('/api/portfolio-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      });
      if (!resp.ok) throw new Error('Price service did not respond. Try again shortly.');
      const { results } = await resp.json();

      let succeeded = 0;
      let failed = 0;
      const updatePromises: Promise<void>[] = [];
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
          failed++;
        }
      });
      await Promise.all(updatePromises);
      const skipNote = skippedNoTicker > 0 ? ` · ${skippedNoTicker} skipped (no ticker set)` : '';
      setPriceRefreshSummary(
        failed === 0
          ? `Live price updated for ${succeeded}${skipNote} · delayed a few minutes, not real-time`
          : `Live price updated for ${succeeded}, couldn't find ${failed}${skipNote} · delayed a few minutes, not real-time`
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

  const confirmSell = async () => {
    if (!sellingId || !sellPrice) return;
    await runAction(async () => {
      await updatePortfolioHolding(sellingId, { status: 'sold', soldPrice: parseFloat(sellPrice), soldDate: sellDate });
      setSellingId(null); setSellPrice('');
    });
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
  const totalContributed = portfolioContributions.reduce((s, c) => s + Number(c.amount), 0);
  const totalWithdrawn = portfolioWithdrawals.reduce((s, w) => s + Number(w.amount), 0);
  const netContributed = totalContributed - totalWithdrawn;
  const totalInvestedActive = activeHoldings.reduce((s, h) => s + Number(h.buy_price) * Number(h.quantity), 0);
  const balanceCash = portfolioCashBalances.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalStockInvestment = totalInvestedActive; // current cost basis of active stock + MF holdings
  const bookedProfitLoss = (balanceCash + totalStockInvestment) - netContributed;
  const currentValueActive = activeHoldings.reduce((s, h) => s + Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity), 0);
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
      </div>

      {holdingsTab === 'active' && (
        <>
      {availableReferenceDates.length > 0 && (
        <div className="flex items-center gap-2">
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
        </div>
      )}

      {/* Headline stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Investment</span>
          <span className="text-base font-black text-slate-900 dark:text-white">{fmt(netContributed)}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">actual contributions, net of withdrawals</span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Balance Cash</span>
          <span className="text-base font-black text-slate-900 dark:text-white">{fmt(balanceCash)}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">from Investment Plan</span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Booked Profit/Loss</span>
          <span className={`text-base font-black flex items-center gap-1 ${bookedProfitLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            {bookedProfitLoss >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {fmt(Math.abs(bookedProfitLoss))}
          </span>
          <span className="text-[9px] text-slate-400 block mt-0.5">cash + stock value vs. contributed</span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Stock Investment</span>
          <span className="text-base font-black text-slate-900 dark:text-white">{fmt(totalStockInvestment)}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">stock & MF purchase value</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Current Holdings Value</span>
          <span className="text-base font-black text-slate-900 dark:text-white">{fmt(currentValueActive)}</span>
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
            {fmt(Math.abs(unrealizedGain))}
          </span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Net Gain (P&L, all-in)</span>
          <span className={`text-base font-black ${netGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{fmt(netGain)}</span>
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
              <button
                onClick={() => refreshAllPrices('active')}
                disabled={refreshingPrices}
                className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingPrices ? 'animate-spin' : ''}`} /> {refreshingPrices ? 'Refreshing…' : 'Refresh Prices'}
              </button>
            )}
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
            {showMoreActions && (
              <button
                onClick={() => { setIsImporting(!isImporting); setImportPreview(null); setImportRawParsed(null); }}
                className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Import from Broker
              </button>
            )}
            {showMoreActions && (
              <button
                onClick={() => { setIsHistoricalMode(!isHistoricalMode); setHistoricalSnapshots([]); setHistoricalResult(null); }}
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
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => { setImportTemplate('zerodha'); setImportPreview(null); setImportRawParsed(null); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${importTemplate === 'zerodha' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Zerodha (Stocks + MF)</button>
                <button type="button" onClick={() => { setImportTemplate('groww_stocks'); setImportPreview(null); setImportRawParsed(null); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${importTemplate === 'groww_stocks' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Groww Stocks</button>
                <button type="button" onClick={() => { setImportTemplate('groww_mf'); setImportPreview(null); setImportRawParsed(null); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${importTemplate === 'groww_mf' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Groww Mutual Funds</button>
              </div>
              <p className="text-[9px] text-slate-400">
                {importTemplate === 'zerodha' && "Console → Holdings → Download as XLSX (stocks and mutual funds are both detected automatically)"}
                {importTemplate === 'groww_stocks' && "Groww app → Reports → Stocks Holdings Statement (XLSX)"}
                {importTemplate === 'groww_mf' && "Groww app → Reports → Mutual Funds Holdings Statement (XLSX)"}
                {' '}· Prices/quantities come from the file at export time. Already-imported holdings are automatically skipped.
              </p>

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
                    {importPreview.unchanged > 0 && ` · ${importPreview.unchanged} unchanged (skipped)`}
                    {' '}· external funds always excluded
                  </p>
                  {importPreview.qtyChanged.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Quantity Changed</span>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {importPreview.qtyChanged.map((qc, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] px-2 py-1 bg-amber-50 dark:bg-amber-950/20 rounded">
                            <span className="text-slate-600 dark:text-slate-300">{qc.parsed.symbol}</span>
                            <span className={`font-bold ${qc.direction === 'increased' ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {qc.existing.quantity} → {qc.parsed.quantity} ({qc.direction === 'increased' ? '+' : ''}{qc.parsed.quantity - Number(qc.existing.quantity)})
                            </span>
                          </div>
                        ))}
                      </div>
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
                            <span className="text-slate-400">{h.quantity} @ ₹{h.buyPrice.toFixed(2)}</span>
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
                  {(importPreview.fresh.length > 0 || importPreview.qtyChanged.length > 0) && (
                    <button
                      onClick={confirmImport}
                      disabled={importSaving}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black uppercase rounded-lg cursor-pointer"
                    >
                      {importSaving ? 'Importing…' : `Import ${importPreview.fresh.length} New${importPreview.qtyChanged.length > 0 ? ` + Update ${importPreview.qtyChanged.length}` : ''}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {isHistoricalMode && (
            <div className="apple-card p-4 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Backfill Historical Prices</span>
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
            </div>
          )}

          {isAddingHolding && (
            <form onSubmit={handleAddHolding} className="apple-card p-4 space-y-2.5">
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setHHoldingType('stock')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${hHoldingType === 'stock' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Stock</button>
                <button type="button" onClick={() => setHHoldingType('mutual_fund')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${hHoldingType === 'mutual_fund' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Mutual Fund</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                <select value={hBroker} onChange={(e) => setHBroker(e.target.value as any)} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                  <option>Zerodha</option><option>Groww</option><option>Other</option>
                </select>
                {hHoldingType === 'stock' ? (
                  <select value={hExchange} onChange={(e) => setHExchange(e.target.value as any)} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                    <option>NSE</option><option>BSE</option>
                  </select>
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

          {(filterOptions.combos.length > 1 || filterOptions.sources.length > 0 || filterOptions.priceMoves.length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setHoldingFilters(new Set())} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${holdingFilters.size === 0 ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>All</button>
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
            const subInvested = filteredActiveHoldings.reduce((s, h) => s + Number(h.buy_price) * Number(h.quantity), 0);
            const subCurrent = filteredActiveHoldings.reduce((s, h) => s + Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity), 0);
            const subGain = subCurrent - subInvested;
            const subGainPct = subInvested > 0 ? (subGain / subInvested) * 100 : 0;
            const subDailyEligible = filteredActiveHoldings.filter(h => h.live_price != null && h.previous_close != null);
            const subDailyChange = subDailyEligible.reduce((s, h) => s + (Number(h.live_price) - Number(h.previous_close)) * Number(h.quantity), 0);
            const subLoadEligible = filteredActiveHoldings.filter(h => h.live_price != null);
            const subLoadChange = subLoadEligible.reduce((s, h) => s + (Number(h.live_price) - Number(h.current_price ?? h.buy_price)) * Number(h.quantity), 0);
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" Invested</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{fmt(subInvested)}</span>
                </div>
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" Current Value</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{fmt(subCurrent)}</span>
                </div>
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" Net Gain</span>
                  <span className={`text-sm font-black ${subGain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{subGain >= 0 ? '+' : ''}{fmt(subGain)}</span>
                </div>
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" % Chg</span>
                  <span className={`text-sm font-black ${subGainPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{subGainPct >= 0 ? '+' : ''}{subGainPct.toFixed(2)}%</span>
                </div>
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" Daily Change</span>
                  {subDailyEligible.length > 0 ? (
                    <span className={`text-sm font-black ${subDailyChange >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{subDailyChange >= 0 ? '+' : ''}{fmt(subDailyChange)}</span>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-700">—</span>
                  )}
                </div>
                <div className="apple-card p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">"{filterLabel}" Since Previous Load</span>
                  {subLoadEligible.length > 0 ? (
                    <span className={`text-sm font-black ${subLoadChange >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{subLoadChange >= 0 ? '+' : ''}{fmt(subLoadChange)}</span>
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
                                  <input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="Sell price" className="w-16 px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[10px]" />
                                  <button onClick={confirmSell} className="p-1 bg-rose-500 text-white rounded-md cursor-pointer"><CheckCircle2 className="w-3 h-3" /></button>
                                  <button onClick={() => setSellingId(null)} className="p-1 text-slate-400 cursor-pointer"><X className="w-3 h-3" /></button>
                                </div>
                              ) : (
                                <button onClick={() => { setSellingId(h.id); setSellPrice(String(currentPriceNum)); }} className="px-2 py-1 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase rounded-md cursor-pointer">Sell</button>
                              ))}
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
                                    disabled={h.broker === 'Zerodha'}
                                    placeholder={h.broker === 'Groww' ? 'e.g. RELIANCE' : ''}
                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                  />
                                  {h.broker === 'Zerodha' && <p className="text-[8px] text-slate-400 mt-0.5">Zerodha's symbol is already a real ticker - no change needed.</p>}
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
          {!isReadOnly && (
          <div className="flex justify-end">
            <button
              onClick={() => refreshAllPrices('sold')}
              disabled={refreshingPrices}
              className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingPrices ? 'animate-spin' : ''}`} /> {refreshingPrices ? 'Refreshing…' : 'Refresh Prices'}
            </button>
          </div>
          )}
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
            const buyValue = filteredSoldHoldings.reduce((s, h) => s + Number(h.buy_price) * Number(h.quantity), 0);
            const soldValue = filteredSoldHoldings.reduce((s, h) => s + Number(h.sold_price) * Number(h.quantity), 0);
            const pl = soldValue - buyValue;
            const sinceSoldEligible = filteredSoldHoldings.filter(h => h.live_price != null);
            const sinceSoldTotal = sinceSoldEligible.reduce((s, h) => s + (Number(h.live_price) - Number(h.sold_price)) * Number(h.quantity), 0);
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="apple-card p-3">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Buy Value</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{fmt(buyValue)}</span>
                </div>
                <div className="apple-card p-3">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Sold Value</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{fmt(soldValue)}</span>
                </div>
                <div className="apple-card p-3">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Profit/Loss</span>
                  <span className={`text-sm font-black ${pl >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{pl >= 0 ? '+' : ''}{fmt(pl)}</span>
                </div>
                <div className="apple-card p-3">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Since Sold</span>
                  {sinceSoldEligible.length > 0 ? (
                    <span className={`text-sm font-black ${sinceSoldTotal >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{sinceSoldTotal >= 0 ? '+' : ''}{fmt(sinceSoldTotal)}</span>
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
                              {h.holding_type === 'mutual_fund' && <span className="text-[8px] font-bold px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-full">MF</span>}
                              {h.source && <span className="text-[8px] font-bold px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full">{h.source}</span>}
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
    </div>
  );
}
