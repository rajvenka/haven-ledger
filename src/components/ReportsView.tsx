import React, { useState, useMemo } from 'react';
import { Trash2, Gift, Receipt, FileBarChart, ChevronLeft, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line } from 'recharts';

interface WorkspaceMemberLite {
  uid: string;
  displayName?: string;
  email: string;
}

interface ReportsViewProps {
  /** When true, Portfolio-level Pulse chrome; features identical to classic */
  pulseMode?: boolean;
  workspaceName?: string;
  workspaceMembers: WorkspaceMemberLite[];
  isReadOnly?: boolean;
  portfolios?: any[];
  portfolioMode?: 'single' | 'multiple';
  workspaceCurrencyRates?: any[];
  baseCurrency?: string;
  portfolioHoldings: any[];
  portfolioPriceHistory: any[];
  portfolioContributions: any[];
  portfolioWithdrawals: any[];
  portfolioDividends: any[];
  mfHoldingsCache?: any[];
  loadMfHoldingsCache?: () => Promise<void>;
  addPortfolioDividend: (symbol: string, amount: number, date: string, holdingId?: string, notes?: string) => Promise<void>;
  deletePortfolioDividend: (id: string) => Promise<void>;
  portfolioFees: any[];
  addPortfolioFee: (broker: string, feeType: string, amount: number, date: string, notes?: string) => Promise<void>;
  deletePortfolioFee: (id: string) => Promise<void>;
  portfolioSplits: any[];
  portfolioCashBalances: any[];
  portfolioSnapshots: any[];
  takePortfolioSnapshot: (date: string, groups: { label: string; invested: number; current: number }[]) => Promise<void>;
  deletePortfolioSnapshotBatch: (date: string) => Promise<void>;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const CURRENCY_META: Record<string, { symbol: string; locale: string }> = {
  INR: { symbol: '₹', locale: 'en-IN' }, USD: { symbol: '$', locale: 'en-US' }, AUD: { symbol: 'A$', locale: 'en-AU' },
  EUR: { symbol: '€', locale: 'en-IE' }, GBP: { symbol: '£', locale: 'en-GB' }, SGD: { symbol: 'S$', locale: 'en-SG' },
  AED: { symbol: 'AED ', locale: 'en-AE' }, CAD: { symbol: 'C$', locale: 'en-CA' },
};
const fmtCur = (n: number, currency: string = 'INR') => {
  const meta = CURRENCY_META[currency] || { symbol: `${currency} `, locale: 'en-US' };
  return `${meta.symbol}${n.toLocaleString(meta.locale, { maximumFractionDigits: 2 })}`;
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const memberName = (m: WorkspaceMemberLite) => m.displayName || m.email.split('@')[0];

type ReportTab = 'overview' | 'insights' | 'activity' | 'movement' | 'summary';

// Defined outside ReportsView so it keeps a stable identity across renders - when it was
// defined inside the render body, every state update (e.g. toggling one card's details)
// redefined this as a new function, which made React unmount and remount every card
// instead of just re-rendering the one that changed, causing all charts to visibly reload.
function InsightCard({ title, items, pctKey, subFn, isOpen, onToggle, fmt, valueKey }: {
  title: string; items: any[]; pctKey: '_gainPct' | '_sinceSoldPct'; subFn?: (h: any) => string;
  isOpen: boolean; onToggle: () => void; fmt: (n: number) => string; valueKey?: string;
}) {
  // valueKey switches the card from percentage display to an absolute currency amount -
  // used for Top 5 Holdings (by value), where the point is the holding's actual size, not
  // its gain/loss. Everything else about the card (chart, details list) stays the same shape.
  const dataKey = valueKey ?? pctKey;
  const chartData = items.map(h => ({ name: h.symbol.length > 10 ? h.symbol.slice(0, 10) + '…' : h.symbol, pct: h[dataKey] }));
  return (
    <div className="apple-card p-4 space-y-2">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{title} <span className="text-slate-300 dark:text-slate-600 normal-case font-bold">({items.length})</span></span>
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-300 dark:text-slate-700 py-2">None right now.</p>
      ) : (
        <>
          <div style={{ height: Math.max(60, items.length * 24) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => valueKey ? fmt(v) : `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip formatter={(v: number) => [valueKey ? fmt(v) : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, valueKey ? 'Value' : 'Change']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={valueKey ? '#6366f1' : (d.pct >= 0 ? '#10b981' : '#f43f5e')} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <button onClick={onToggle} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
            {isOpen ? 'Hide details' : 'View details'} <ChevronLeft className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : '-rotate-90'}`} />
          </button>
          {isOpen && (
            <div className="divide-y divide-slate-100 dark:divide-slate-900">
              {items.map(h => (
                <div key={h.id} className="flex items-center justify-between text-[11px] py-1">
                  <span className="min-w-0">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold truncate block">{h.symbol}</span>
                    {subFn && <span className="text-[9px] text-slate-400">{subFn(h)}</span>}
                  </span>
                  {valueKey ? (
                    <span className="font-bold shrink-0 ml-2 text-slate-900 dark:text-white">{fmt(h[dataKey])}</span>
                  ) : (
                    <span className={`font-bold shrink-0 ml-2 ${h[pctKey] >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{h[pctKey] >= 0 ? '+' : ''}{h[pctKey].toFixed(2)}%</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Same reasoning as InsightCard: kept as a stable top-level component so toggling one
// bucket's details doesn't redefine and remount every other bucket on the page.
function DetailBucket({ label, count, totalLabel, isOpen, onToggle, children }: {
  key?: React.Key; label: string; count: number; totalLabel: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="space-y-1">
      <button onClick={onToggle} className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-wider cursor-pointer">
        {label} ({count}) · {totalLabel}
        <ChevronLeft className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-90' : '-rotate-90'}`} />
      </button>
      {isOpen && children}
    </div>
  );
}

export default function ReportsView(props: ReportsViewProps) {
  const {
    pulseMode = false,
    workspaceName, workspaceMembers, isReadOnly,
    portfolios: allPortfolios = [], portfolioMode = 'single', workspaceCurrencyRates = [], baseCurrency = 'INR',
    portfolioHoldings: allPortfolioHoldings, portfolioPriceHistory, portfolioContributions: allPortfolioContributions, portfolioWithdrawals: allPortfolioWithdrawals,
    portfolioDividends, addPortfolioDividend, deletePortfolioDividend,
    portfolioFees, addPortfolioFee, deletePortfolioFee,
    portfolioSplits, portfolioCashBalances, portfolioSnapshots, takePortfolioSnapshot, deletePortfolioSnapshotBatch,
    mfHoldingsCache = [], loadMfHoldingsCache,
  } = props;

  const [reportTab, setReportTab] = useState<ReportTab>('overview');
  const [insightsSubTab, setInsightsSubTab] = useState<'all' | 'stock' | 'mutual_fund' | 'mf-holdings' | 'mf-stock'>('all');
  const [mfReportDrillStock, setMfReportDrillStock] = useState<string | null>(null);
  const [mfFundsDetailOpen, setMfFundsDetailOpen] = useState(false);
  const [mfStocksDetailOpen, setMfStocksDetailOpen] = useState(false);
  const [mfStockRangeStart, setMfStockRangeStart] = useState(0);
  const [drillPath, setDrillPath] = useState<string[]>([]);
  const [classificationMetric, setClassificationMetric] = useState<'inception' | 'd30' | 'ref'>('inception');
  const [classificationView, setClassificationView] = useState<'active' | 'sold'>('active');
  const [classificationSoldMetric, setClassificationSoldMetric] = useState<'realized' | 'sinceSold'>('realized');

  // Finds the most recent recorded price at or before a given date, for the 30-day
  // classification comparison - falls back to null if no price history exists that far
  // back (e.g. never re-uploaded/refreshed since before that date).
  const getPriceAtOrBefore = (holdingId: string, date: string): number | null => {
    const rows = portfolioPriceHistory.filter((p: any) => p.holding_id === holdingId && p.recorded_date <= date);
    if (rows.length === 0) return null;
    const latest = rows.reduce((a: any, b: any) => (a.recorded_date > b.recorded_date ? a : b));
    return Number(latest.price);
  };
  const [expandedInsightCards, setExpandedInsightCards] = useState<Set<string>>(new Set());
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [movementDrillLabel, setMovementDrillLabel] = useState<string | null>(null);
  const [movementSortKey, setMovementSortKey] = useState<'label' | 'older' | 'newer' | 'diff'>('diff');
  const [movementSortDir, setMovementSortDir] = useState<'asc' | 'desc'>('desc');
  const [movementDrillExpanded, setMovementDrillExpanded] = useState(false);
  const [expandedActivityBuckets, setExpandedActivityBuckets] = useState<Set<string>>(new Set());
  const toggleActivityBucket = (key: string) => setExpandedActivityBuckets(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const [formError, setFormError] = useState<string | null>(null);
  const runAction = async (fn: () => Promise<any>) => {
    setFormError(null);
    try {
      await fn();
    } catch (err: any) {
      console.error('Reports action failed:', err);
      setFormError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  const [selectedReportPortfolios, setSelectedReportPortfolios] = useState<Set<string>>(new Set());
  const reportPortfolioNames = useMemo(() => {
    if (portfolioMode !== 'multiple') return [];
    const names = new Set<string>();
    allPortfolioHoldings.forEach((h: any) => names.add(allPortfolios.find((p: any) => p.id === h.portfolio_id)?.name || 'Unassigned'));
    return Array.from(names).sort();
  }, [allPortfolioHoldings, allPortfolios, portfolioMode]);
  const selectedPortfolioIds = useMemo(() => {
    if (selectedReportPortfolios.size === 0) return null;
    return allPortfolios.filter((p: any) => selectedReportPortfolios.has(p.name)).map((p: any) => p.id);
  }, [selectedReportPortfolios, allPortfolios]);
  // Filtering happens once, right here, rather than in every individual metric below - every
  // report calculation downstream automatically respects the portfolio selection this way.
  const portfolioHoldings = selectedPortfolioIds ? allPortfolioHoldings.filter((h: any) => selectedPortfolioIds.includes(h.portfolio_id)) : allPortfolioHoldings;
  const portfolioContributions = selectedPortfolioIds ? allPortfolioContributions.filter((c: any) => selectedPortfolioIds.includes(c.portfolio_id)) : allPortfolioContributions;
  const portfolioWithdrawals = selectedPortfolioIds ? allPortfolioWithdrawals.filter((w: any) => selectedPortfolioIds.includes(w.portfolio_id)) : allPortfolioWithdrawals;
  const reportDisplayCurrency = (() => {
    if (portfolioMode !== 'multiple') return baseCurrency;
    const selectedPortfolioObjs = allPortfolios.filter((p: any) => selectedReportPortfolios.has(p.name));
    return selectedPortfolioObjs.length === 1 ? selectedPortfolioObjs[0].currency : baseCurrency;
  })();

  const activeHoldings = portfolioHoldings.filter(h => h.status === 'active');
  const soldHoldings = portfolioHoldings.filter(h => h.status === 'sold');

  const totalContributed = portfolioContributions.reduce((s, c) => s + Number(c.amount), 0);
  const totalWithdrawn = portfolioWithdrawals.reduce((s, w) => s + Number(w.amount), 0);
  const netContributed = totalContributed - totalWithdrawn;
  const balanceCash = portfolioCashBalances.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalInvestedActive = activeHoldings.reduce((s, h) => s + Number(h.buy_price) * Number(h.quantity), 0);
  const currentValueActive = activeHoldings.reduce((s, h) => s + Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity), 0);
  const unrealizedGain = currentValueActive - totalInvestedActive;
  const realizedGain = soldHoldings.reduce((s, h) => s + (Number(h.sold_price) - Number(h.buy_price)) * Number(h.quantity), 0);
  const totalDividends = portfolioDividends.reduce((s, d) => s + Number(d.amount), 0);
  const totalFees = portfolioFees.reduce((s, f) => s + Number(f.amount), 0);
  const totalInvestedAllTime = totalInvestedActive + soldHoldings.reduce((s, h) => s + Number(h.buy_price) * Number(h.quantity), 0);
  const netGain = (balanceCash + currentValueActive) - netContributed;
  const returnPct = netContributed > 0 ? (netGain / netContributed) * 100 : 0;

  const currentSplits = workspaceMembers.map(m => {
    const today = todayStr();
    const active = portfolioSplits.find(s => s.member_user_id === m.uid && s.effective_from <= today && (!s.effective_to || s.effective_to >= today));
    return { member: m, percent: active?.split_percent ?? 0 };
  });

  const TABS: { key: ReportTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'insights', label: 'Insights' },
    { key: 'activity', label: 'Activity' },
    { key: 'movement', label: 'Movement' },
    { key: 'summary', label: 'Summary' },
  ];

  return (
    <div className={`flex-1 flex flex-col overflow-y-auto px-3 sm:px-5 pt-3 sm:pt-4 pb-24 md:pb-4 space-y-4 text-left ${pulseMode ? 'bg-slate-50 dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900'}`}>
      {pulseMode ? (
        <div className="relative overflow-hidden rounded-2xl border border-violet-200/60 dark:border-violet-900/40 bg-gradient-to-br from-violet-50/80 via-white to-slate-50 dark:from-violet-950/30 dark:via-slate-950 dark:to-slate-950 p-3.5 sm:p-4">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-violet-400/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/60 border border-violet-200/70 dark:border-violet-800 flex items-center justify-center shrink-0">
              <FileBarChart className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight truncate text-slate-900 dark:text-white">
                {workspaceName ? `${workspaceName} Reports` : 'Reports'}
              </h2>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Overview · dividends · fees · snapshots</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{workspaceName ? `${workspaceName} Reports` : 'Reports'}</h2>
        </div>
      )}

      {formError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{formError}</div>
      )}

      {portfolioMode === 'multiple' && reportPortfolioNames.length > 1 && (
        pulseMode ? (
          <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-violet-500/80 dark:text-violet-400/80 w-10">Book</span>
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-violet-100/80 dark:bg-violet-950/50 border border-violet-200/60 dark:border-violet-900/60">
              <button type="button" onClick={() => setSelectedReportPortfolios(new Set())} className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${selectedReportPortfolios.size === 0 ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-violet-700/70 dark:text-violet-300/70'}`}>All</button>
              {reportPortfolioNames.map(p => (
                <button type="button" key={p} onClick={() => setSelectedReportPortfolios(prev => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next; })} className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${selectedReportPortfolios.has(p) ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25' : 'text-violet-700/70 dark:text-violet-300/70'}`}>{p}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setSelectedReportPortfolios(new Set())} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${selectedReportPortfolios.size === 0 ? 'bg-violet-600 text-white' : 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400'}`}>All</button>
            {reportPortfolioNames.map(p => (
              <button key={p} onClick={() => setSelectedReportPortfolios(prev => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next; })} className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${selectedReportPortfolios.has(p) ? 'bg-violet-600 text-white' : 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400'}`}>{p}</button>
            ))}
          </div>
        )
      )}

      {pulseMode ? (
        <div className="flex gap-1 p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              type="button"
              key={tab.key}
              onClick={() => setReportTab(tab.key)}
              className={`shrink-0 flex-1 px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                reportTab === tab.key
                  ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-300 shadow-sm border border-violet-200/60 dark:border-violet-800'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setReportTab(t.key)} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${reportTab === t.key ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{t.label}</button>
          ))}
        </div>
      )}

      {reportTab === 'overview' && (
        <>
        {activeHoldings.length > 0 && (() => {
          const fmt = (n: number) => fmtCur(n, reportDisplayCurrency);
          const bySource = new Map<string, number>();
          activeHoldings.forEach(h => {
            const key = h.source || 'Untagged';
            const value = Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity);
            bySource.set(key, (bySource.get(key) || 0) + value);
          });
          const data = Array.from(bySource.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
          const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
          return (
            <div className="apple-card p-4 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Portfolio Allocation (by Source)</span>
              <div className="flex items-center gap-4">
                <div className="w-32 h-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="100%" paddingAngle={2}>
                        {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1 max-h-32 overflow-y-auto">
                  {data.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                        <span className="text-slate-600 dark:text-slate-300 truncate">{d.name}</span>
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white shrink-0 ml-2">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {(activeHoldings.length > 0 || portfolioCashBalances.length > 0) && (() => {
          const fmt = (n: number) => fmtCur(n, reportDisplayCurrency);
          // Drill-down: Level 0 splits total investment into Stock/Mutual Fund/Cash, Level 1
          // splits the selected category by broker (or by location for Cash, which has no
          // broker concept), Level 2 splits the selected broker by source tag. Clicking a
          // slice or bar drills in; the breadcrumb trail lets you step back out.
          type DrillDatum = { name: string; value: number };
          let drillData: DrillDatum[] = [];
          let levelLabel = '';

          if (drillPath.length === 0) {
            const byCategory = new Map<string, number>();
            activeHoldings.forEach(h => {
              const key = h.holding_type === 'mutual_fund' ? 'Mutual Fund' : 'Stock';
              const value = Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity);
              byCategory.set(key, (byCategory.get(key) || 0) + value);
            });
            const cashTotal = portfolioCashBalances.reduce((s: number, c: any) => s + Number(c.amount), 0);
            if (cashTotal > 0) byCategory.set('Cash', cashTotal);
            drillData = Array.from(byCategory.entries()).map(([name, value]) => ({ name, value }));
            levelLabel = 'Investment';
          } else if (drillPath.length === 1) {
            const category = drillPath[0];
            levelLabel = category;
            if (category === 'Cash') {
              const byLocation = new Map<string, number>();
              portfolioCashBalances.forEach((c: any) => byLocation.set(c.location, (byLocation.get(c.location) || 0) + Number(c.amount)));
              drillData = Array.from(byLocation.entries()).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
            } else {
              const holdingType = category === 'Mutual Fund' ? 'mutual_fund' : 'stock';
              const byBroker = new Map<string, number>();
              activeHoldings.filter(h => (h.holding_type === 'mutual_fund' ? 'mutual_fund' : 'stock') === holdingType).forEach(h => {
                const value = Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity);
                byBroker.set(h.broker, (byBroker.get(h.broker) || 0) + value);
              });
              drillData = Array.from(byBroker.entries()).map(([name, value]) => ({ name, value }));
            }
          } else if (drillPath.length === 2) {
            const [category, broker] = drillPath;
            levelLabel = `${category} · ${broker}`;
            const holdingType = category === 'Mutual Fund' ? 'mutual_fund' : 'stock';
            const bySource = new Map<string, number>();
            activeHoldings
              .filter(h => (h.holding_type === 'mutual_fund' ? 'mutual_fund' : 'stock') === holdingType && h.broker === broker)
              .forEach(h => {
                const key = h.source || 'Untagged';
                const value = Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity);
                bySource.set(key, (bySource.get(key) || 0) + value);
              });
            drillData = Array.from(bySource.entries()).map(([name, value]) => ({ name, value }));
          }

          drillData.sort((a, b) => b.value - a.value);
          const canDrillFurther = drillPath.length < 2;
          const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

          return (
            <div className="apple-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Investment Breakdown · {levelLabel}</span>
                {drillPath.length > 0 && (
                  <button onClick={() => setDrillPath(prev => prev.slice(0, -1))} className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                    <ChevronLeft className="w-3 h-3" /> Back
                  </button>
                )}
              </div>
              {drillData.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">Nothing to show at this level.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={drillData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="55%"
                          outerRadius="100%"
                          paddingAngle={2}
                          onClick={(d: any) => canDrillFurther && setDrillPath(prev => [...prev, d.name])}
                          cursor={canDrillFurther ? 'pointer' : 'default'}
                        >
                          {drillData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1 max-h-32 overflow-y-auto">
                    {drillData.map((d, i) => (
                      <button
                        key={d.name}
                        onClick={() => canDrillFurther && setDrillPath(prev => [...prev, d.name])}
                        disabled={!canDrillFurther}
                        className={`flex items-center justify-between text-[11px] w-full text-left ${canDrillFurther ? 'cursor-pointer hover:opacity-70' : ''}`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                          <span className="text-slate-600 dark:text-slate-300 truncate">{d.name}</span>
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white shrink-0 ml-2">{fmt(d.value)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {canDrillFurther && drillData.length > 0 && (
                <p className="text-[9px] text-slate-400">Tap a slice or row to drill in{drillPath.length === 0 ? ' by broker' : ' by source tag'}.</p>
              )}
            </div>
          );
        })()}

        {(activeHoldings.length > 0 || soldHoldings.length > 0) && (() => {
        // Classification Performance - compares whatever source tags exist on holdings
        // (Own Stock, Rajavel Stock, etc - fully dynamic, nothing hardcoded, new tags show
        // up automatically) side by side, plus Mutual Fund as its own classification (only
        // appears if any mutual fund holdings actually exist). Active and Sold get their own
        // metric sets since "last 30 days" or "since reference load" don't mean anything
        // coherent for something already sold - Sold instead gets Realized Gain (how the
        // classification actually performed when cashed out) and Since Sold (whether selling
        // turned out to be a good call, using the same Since Sold tracking built earlier).
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const classificationMap = new Map<string, { invested: number; current: number; refValue: number; refBase: number; d30Value: number; d30Base: number }>();
        activeHoldings.forEach(h => {
          const classification = h.holding_type === 'mutual_fund' ? 'Mutual Fund' : (h.source || 'Unclassified');
          const qty = Number(h.quantity);
          const current = Number(h.live_price ?? h.current_price ?? h.buy_price);
          const invested = Number(h.buy_price) * qty;
          const currentValue = current * qty;
          const prev = classificationMap.get(classification) || { invested: 0, current: 0, refValue: 0, refBase: 0, d30Value: 0, d30Base: 0 };
          prev.invested += invested;
          prev.current += currentValue;
          if (h.reference_price != null) {
            prev.refValue += currentValue;
            prev.refBase += Number(h.reference_price) * qty;
          }
          const d30Price = getPriceAtOrBefore(h.id, thirtyDaysAgo);
          if (d30Price != null) {
            prev.d30Value += currentValue;
            prev.d30Base += d30Price * qty;
          }
          classificationMap.set(classification, prev);
        });
        const classificationRows = Array.from(classificationMap.entries())
          .map(([name, v]) => ({
            name,
            inceptionPct: v.invested > 0 ? ((v.current - v.invested) / v.invested) * 100 : null,
            refPct: v.refBase > 0 ? ((v.refValue - v.refBase) / v.refBase) * 100 : null,
            d30Pct: v.d30Base > 0 ? ((v.d30Value - v.d30Base) / v.d30Base) * 100 : null,
          }))
          .sort((a, b) => (b.inceptionPct ?? -999) - (a.inceptionPct ?? -999));

        const soldClassificationMap = new Map<string, { invested: number; soldValue: number; sinceSoldValue: number; sinceSoldBase: number }>();
        soldHoldings.forEach(h => {
          const classification = h.holding_type === 'mutual_fund' ? 'Mutual Fund' : (h.source || 'Unclassified');
          const qty = Number(h.quantity);
          const invested = Number(h.buy_price) * qty;
          const soldValue = Number(h.sold_price) * qty;
          const prev = soldClassificationMap.get(classification) || { invested: 0, soldValue: 0, sinceSoldValue: 0, sinceSoldBase: 0 };
          prev.invested += invested;
          prev.soldValue += soldValue;
          if (h.live_price != null) {
            prev.sinceSoldValue += Number(h.live_price) * qty;
            prev.sinceSoldBase += soldValue;
          }
          soldClassificationMap.set(classification, prev);
        });
        const soldClassificationRows = Array.from(soldClassificationMap.entries())
          .map(([name, v]) => ({
            name,
            realizedPct: v.invested > 0 ? ((v.soldValue - v.invested) / v.invested) * 100 : null,
            sinceSoldPct: v.sinceSoldBase > 0 ? ((v.sinceSoldValue - v.sinceSoldBase) / v.sinceSoldBase) * 100 : null,
          }))
          .sort((a, b) => (b.realizedPct ?? -999) - (a.realizedPct ?? -999));

        const metricLabels: Record<'inception' | 'd30' | 'ref', string> = { inception: 'Since Inception', d30: 'Last 30 Days', ref: 'Since Ref. Load' };
        const metricKey: Record<'inception' | 'd30' | 'ref', 'inceptionPct' | 'd30Pct' | 'refPct'> = { inception: 'inceptionPct', d30: 'd30Pct', ref: 'refPct' };
        const soldMetricLabels: Record<'realized' | 'sinceSold', string> = { realized: 'Realized Gain', sinceSold: 'Since Sold' };
        const soldMetricKey: Record<'realized' | 'sinceSold', 'realizedPct' | 'sinceSoldPct'> = { realized: 'realizedPct', sinceSold: 'sinceSoldPct' };

        const isActiveView = classificationView === 'active';
        const activeMetricKey = metricKey[classificationMetric];
        const activeSoldMetricKey = soldMetricKey[classificationSoldMetric];
        const classificationChartData = isActiveView
          ? classificationRows.filter(r => r[activeMetricKey] !== null).map(r => ({ name: r.name, pct: r[activeMetricKey] as number }))
          : soldClassificationRows.filter(r => r[activeSoldMetricKey] !== null).map(r => ({ name: r.name, pct: r[activeSoldMetricKey] as number }));
        const currentMetricLabel = isActiveView ? metricLabels[classificationMetric] : soldMetricLabels[classificationSoldMetric];

          return (
          <div className="apple-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Classification Performance</span>
              <div className="flex gap-1.5">
                {(['active', 'sold'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setClassificationView(v)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer capitalize ${classificationView === v ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[9px] text-slate-400">Compared side by side, based on whatever classifications your holdings are tagged with - anything untagged shows as Unclassified.</p>
            <div className="flex gap-1.5">
              {isActiveView ? (
                (['inception', 'd30', 'ref'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setClassificationMetric(m)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${classificationMetric === m ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                  >
                    {metricLabels[m]}
                  </button>
                ))
              ) : (
                (['realized', 'sinceSold'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setClassificationSoldMetric(m)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${classificationSoldMetric === m ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                  >
                    {soldMetricLabels[m]}
                  </button>
                ))
              )}
            </div>
            {classificationChartData.length === 0 ? (
              <p className="text-[11px] text-slate-300 dark:text-slate-700 py-2">No classification has data for {currentMetricLabel} yet{!isActiveView && classificationSoldMetric === 'sinceSold' ? ' - refresh prices on the Sold tab' : ''}.</p>
            ) : (
              <div style={{ height: Math.max(60, classificationChartData.length * 28) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classificationChartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip formatter={(v: number) => [`${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, currentMetricLabel]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                      {classificationChartData.map((d, i) => <Cell key={i} fill={d.pct >= 0 ? '#10b981' : '#f43f5e'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[420px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-900 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="p-2 text-left">Classification</th>
                    {isActiveView ? (
                      <>
                        <th className="p-2 text-right">Since Inception</th>
                        <th className="p-2 text-right">Last 30 Days</th>
                        <th className="p-2 text-right">Since Ref. Load</th>
                      </>
                    ) : (
                      <>
                        <th className="p-2 text-right">Realized Gain</th>
                        <th className="p-2 text-right">Since Sold</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                  {(isActiveView ? classificationRows : soldClassificationRows).map((row: any) => (
                    <tr key={row.name}>
                      <td className="p-2 font-semibold text-slate-700 dark:text-slate-300">{row.name}</td>
                      {(isActiveView ? [row.inceptionPct, row.d30Pct, row.refPct] : [row.realizedPct, row.sinceSoldPct]).map((pct: number | null, i: number) => (
                        <td key={i} className="p-2 text-right">
                          {pct !== null ? (
                            <span className={`font-bold ${pct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
          </div>


          );
        })()}

        {activeHoldings.length > 0 && (() => {
          const data = activeHoldings
            .filter(h => h.reference_price != null && Number(h.reference_price) !== 0)
            .map(h => {
              const current = Number(h.live_price ?? h.current_price ?? h.buy_price);
              const ref = Number(h.reference_price);
              return { symbol: h.symbol, changePct: ((current - ref) / ref) * 100 };
            })
            .sort((a, b) => a.changePct - b.changePct);
          if (data.length === 0) return null;
          return (
            <div className="apple-card p-4 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Price Change by Stock (Since Reference)</span>
              <div className="h-64 overflow-x-auto">
                <div style={{ minWidth: `${data.length * 55}px`, height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} vertical={false} />
                      <XAxis dataKey="symbol" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip formatter={(v: number) => [`${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, 'Since Reference']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="changePct" radius={[3, 3, 3, 3]}>
                        {data.map((d, i) => <Cell key={i} fill={d.changePct >= 0 ? '#10b981' : '#ef4444'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })()}

        {(() => {
          const targeted = activeHoldings.filter(h => h.target_type).map(h => {
            const buyPrice = Number(h.buy_price);
            const currentPrice = Number(h.live_price ?? h.current_price ?? h.buy_price);
            const targetPrice = h.target_type === 'price' ? Number(h.target_price) : buyPrice * (1 + Number(h.target_percent) / 100);
            const priceProgressPct = targetPrice !== buyPrice ? ((currentPrice - buyPrice) / (targetPrice - buyPrice)) * 100 : 0;
            const remainingPct = targetPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : null;

            let targetDate: Date | null = null;
            if (h.hold_type === 'date' && h.hold_until_date) targetDate = new Date(h.hold_until_date);
            else if (h.hold_type === 'days' && h.hold_days) targetDate = new Date(new Date(h.buy_date).getTime() + Number(h.hold_days) * 86400000);

            let timeElapsedPct: number | null = null;
            if (targetDate) {
              const start = new Date(h.buy_date).getTime();
              const end = targetDate.getTime();
              const now = Date.now();
              timeElapsedPct = end !== start ? Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100)) : 100;
            }

            const exceeded = currentPrice >= targetPrice;
            const onPace = timeElapsedPct === null ? null : priceProgressPct >= timeElapsedPct;
            const bucket = exceeded ? 'exceeds' : (onPace === false ? 'off' : 'on');

            return { h, targetPrice, priceProgressPct, remainingPct, timeElapsedPct, exceeded, onPace, bucket };
          });

          if (targeted.length === 0) return null;

          const groups: { key: string; label: string; colorClass: string; items: typeof targeted }[] = [
            { key: 'exceeds', label: 'Exceeds Target', colorClass: 'text-emerald-600 dark:text-emerald-400', items: targeted.filter(t => t.bucket === 'exceeds') },
            { key: 'on', label: 'On Target', colorClass: 'text-indigo-600 dark:text-indigo-400', items: targeted.filter(t => t.bucket === 'on') },
            { key: 'off', label: 'Off Target', colorClass: 'text-rose-600 dark:text-rose-400', items: targeted.filter(t => t.bucket === 'off') },
          ];

          return (
            <div className="apple-card p-4 space-y-4">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Target Progress</span>
                <p className="text-[9px] text-slate-400 mt-0.5">"On/Off Target" compares price progress made vs. time elapsed toward your target date (pacing). Holdings with no target date are shown as On Target with price-only progress.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={groups.filter(g => g.items.length > 0).map(g => ({ name: g.label, value: g.items.length }))}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="60%"
                        outerRadius="100%"
                        paddingAngle={3}
                      >
                        {groups.filter(g => g.items.length > 0).map(g => (
                          <Cell key={g.key} fill={g.key === 'exceeds' ? '#10b981' : g.key === 'on' ? '#6366f1' : '#f43f5e'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v} holding${v !== 1 ? 's' : ''}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {groups.map(g => g.items.length > 0 && (
                    <div key={g.key} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.key === 'exceeds' ? '#10b981' : g.key === 'on' ? '#6366f1' : '#f43f5e' }} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{g.label}</span>
                      </span>
                      <span className="font-black text-slate-900 dark:text-white">{g.items.length}</span>
                    </div>
                  ))}
                </div>
              </div>
              {groups.map(g => g.items.length > 0 && (
                <div key={g.key} className="space-y-2">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${g.colorClass}`}>{g.label} ({g.items.length})</span>
                  {g.items.map(({ h, targetPrice, priceProgressPct, remainingPct, timeElapsedPct }) => (
                    <div key={h.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{h.symbol} {h.source && <span className="text-[9px] text-slate-400">· {h.source}</span>}</span>
                        <span className="text-slate-500">
                          ₹{Number(h.live_price ?? h.current_price ?? h.buy_price).toFixed(2)} → ₹{targetPrice.toFixed(2)}
                          {remainingPct !== null && remainingPct > 0 && ` · ${remainingPct.toFixed(0)}% left to go`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                        <div className={`h-full ${priceProgressPct >= 100 ? 'bg-emerald-500' : priceProgressPct < 0 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.max(0, Math.min(100, priceProgressPct))}%` }} />
                        {timeElapsedPct !== null && (
                          <div className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500" style={{ left: `${timeElapsedPct}%` }} title={`${timeElapsedPct.toFixed(0)}% of time to target elapsed`} />
                        )}
                      </div>
                      <p className="text-[9px] text-slate-400">
                        Price progress {priceProgressPct.toFixed(0)}%{timeElapsedPct !== null ? ` · Time elapsed ${timeElapsedPct.toFixed(0)}% (grey marker)` : ' · no target date set'}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}
        </>
      )}

      {reportTab === 'insights' && (() => {
        const filtered = insightsSubTab === 'all' ? activeHoldings : activeHoldings.filter(h => (h.holding_type === 'mutual_fund' ? 'mutual_fund' : 'stock') === insightsSubTab);
        const soldFiltered = insightsSubTab === 'all' ? soldHoldings : soldHoldings.filter(h => (h.holding_type === 'mutual_fund' ? 'mutual_fund' : 'stock') === insightsSubTab);

        const withGain = filtered.map(h => {
          const current = Number(h.live_price ?? h.current_price ?? h.buy_price);
          const value = current * Number(h.quantity);
          const gainPct = Number(h.buy_price) > 0 ? ((current - Number(h.buy_price)) / Number(h.buy_price)) * 100 : 0;
          return { ...h, _current: current, _value: value, _gainPct: gainPct };
        });
        const topHoldings = [...withGain].sort((a, b) => b._value - a._value).slice(0, 5);
        const topWinners = [...withGain].sort((a, b) => b._gainPct - a._gainPct).slice(0, 5);
        const topLosers = [...withGain].sort((a, b) => a._gainPct - b._gainPct).slice(0, 5);
        const moversUp = withGain.filter(h => h._gainPct >= 10).sort((a, b) => b._gainPct - a._gainPct);
        const moversDown = withGain.filter(h => h._gainPct <= -10).sort((a, b) => a._gainPct - b._gainPct);

        const RECENT_DAYS = 30;
        const recentCutoff = Date.now() - RECENT_DAYS * 86400000;
        const recentBuys = withGain.filter(h => h.buy_date && new Date(h.buy_date).getTime() >= recentCutoff);
        const goodRecentBuys = recentBuys.filter(h => h._gainPct > 0).sort((a, b) => b._gainPct - a._gainPct);
        const badRecentBuys = recentBuys.filter(h => h._gainPct < 0).sort((a, b) => a._gainPct - b._gainPct);

        const soldWithSinceSold = soldFiltered
          .filter(h => h.live_price != null && Number(h.sold_price) !== 0)
          .map(h => ({ ...h, _sinceSoldPct: ((Number(h.live_price) - Number(h.sold_price)) / Number(h.sold_price)) * 100 }));
        const goodSells = soldWithSinceSold.filter(h => h._sinceSoldPct < 0).sort((a, b) => a._sinceSoldPct - b._sinceSoldPct);
        const badSells = soldWithSinceSold.filter(h => h._sinceSoldPct > 0).sort((a, b) => b._sinceSoldPct - a._sinceSoldPct);

        const toggleCard = (key: string) => setExpandedInsightCards(prev => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key); else next.add(key);
          return next;
        });

        // Shared by the MF Holdings and MF + Stock sub-tabs below - computed once here
        // rather than duplicated in each, since both need the same fund-level cache lookup
        // and aggregated stock exposure.
        const fmtCurrency = (n: number) => fmtCur(n, reportDisplayCurrency);
        const mfHoldings = activeHoldings.filter(h => h.holding_type === 'mutual_fund');
        const stockHoldings = activeHoldings.filter(h => h.holding_type !== 'mutual_fund');
        const cacheFor = (h: any) => {
          const bySchemeCode = mfHoldingsCache.filter((c: any) => c.scheme_code === `MANUAL-${h.id}`);
          if (bySchemeCode.length > 0) return bySchemeCode;
          // "plan"/"option" excluded - generic structural words broker names and cached
          // scheme names don't consistently agree on including.
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
        const mfByValue = mfHoldings
          .map(h => ({ holding: h, value: Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity) }))
          .sort((a, b) => b.value - a.value);
        const totalMfValue = mfByValue.reduce((s, r) => s + r.value, 0);
        const stockContributions = new Map<string, { holding: any; weightPct: number; exposure: number }[]>();
        mfHoldings.forEach(h => {
          const value = Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity);
          cacheFor(h).forEach((c: any) => {
            const exposure = value * (Number(c.weight_pct) / 100);
            const list = stockContributions.get(c.stock_name) || [];
            list.push({ holding: h, weightPct: Number(c.weight_pct), exposure });
            stockContributions.set(c.stock_name, list);
          });
        });
        const aggregatedStocks = Array.from(stockContributions.entries())
          .map(([stockName, contributions]) => ({
            stockName,
            totalExposure: contributions.reduce((s, c) => s + c.exposure, 0),
            fundCount: contributions.length,
            contributions: contributions.sort((a, b) => b.exposure - a.exposure),
          }))
          .sort((a, b) => b.totalExposure - a.totalExposure);
        const fundsWithoutData = mfHoldings.length - new Set(Array.from(stockContributions.values()).flat().map(c => c.holding.id)).size;

        // MF + Stock combined: matches a direct stock holding's symbol against MF-derived
        // stock names by checking whether the (cleaned) symbol appears as a substring of the
        // normalized company name - works for most Indian tickers since they're usually
        // drawn directly from the name (RELIANCE -> "Reliance Industries Ltd", HDFCBANK ->
        // "HDFC Bank Ltd"), but is a best-effort heuristic, not a guaranteed match - acronym
        // style tickers (e.g. TCS for Tata Consultancy Services) won't be caught by this and
        // will show up as direct-only. Flagged in the UI rather than silently missed.
        const normalizeForMatch = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const combinedStockMap = new Map<string, {
          label: string; directValue: number; mfValue: number; mfFundCount: number;
          directContributions: { holding: any; value: number }[];
          mfContributions: { holding: any; weightPct: number; exposure: number; mfStockName: string }[];
        }>();
        stockHoldings.forEach(h => {
          const value = Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity);
          const key = normalizeForMatch(h.symbol);
          const existing = combinedStockMap.get(key);
          if (existing) { existing.directValue += value; existing.directContributions.push({ holding: h, value }); }
          else { combinedStockMap.set(key, { label: h.symbol, directValue: value, mfValue: 0, mfFundCount: 0, directContributions: [{ holding: h, value }], mfContributions: [] }); }
        });
        aggregatedStocks.forEach(row => {
          const normalizedMfName = normalizeForMatch(row.stockName);
          let matched = false;
          combinedStockMap.forEach((entry, key) => {
            if (key.length >= 3 && normalizedMfName.includes(key)) {
              entry.mfValue += row.totalExposure;
              entry.mfFundCount += row.fundCount;
              row.contributions.forEach(c => entry.mfContributions.push({ holding: c.holding, weightPct: c.weightPct, exposure: c.exposure, mfStockName: row.stockName }));
              matched = true;
            }
          });
          if (!matched) {
            combinedStockMap.set(normalizedMfName, {
              label: row.stockName, directValue: 0, mfValue: row.totalExposure, mfFundCount: row.fundCount,
              directContributions: [], mfContributions: row.contributions.map(c => ({ holding: c.holding, weightPct: c.weightPct, exposure: c.exposure, mfStockName: row.stockName })),
            });
          }
        });
        // Only the actual overlap - a stock genuinely held both directly AND through at
        // least one fund - not every stock across both sources. That's the actual point of
        // this view: "which companies am I doubling up on without realizing it."
        const combinedStocks = Array.from(combinedStockMap.values())
          .filter(r => r.directValue > 0 && r.mfValue > 0)
          .map(r => ({ ...r, totalValue: r.directValue + r.mfValue }))
          .sort((a, b) => b.totalValue - a.totalValue);


        return (
          <>
          <div className="flex gap-1.5">
            {(['all', 'stock', 'mutual_fund', 'mf-holdings', 'mf-stock'] as const)
              .filter(t => (t !== 'mf-holdings' && t !== 'mf-stock') || activeHoldings.some(h => h.holding_type === 'mutual_fund'))
              .map(t => (
              <button
                key={t}
                onClick={() => { setInsightsSubTab(t); if (t === 'mf-holdings' || t === 'mf-stock') loadMfHoldingsCache?.(); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${insightsSubTab === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
              >
                {t === 'all' ? 'All' : t === 'stock' ? 'Stock' : t === 'mutual_fund' ? 'Mutual Funds' : t === 'mf-holdings' ? 'MF Holdings' : 'MF + Stock'}
              </button>
            ))}
          </div>

          {(insightsSubTab === 'all' || insightsSubTab === 'stock' || insightsSubTab === 'mutual_fund') && (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InsightCard title="Top 5 Holdings (by value)" items={topHoldings} pctKey="_gainPct" valueKey="_value" subFn={(h) => `${h._gainPct >= 0 ? '+' : ''}${h._gainPct.toFixed(2)}% gain`} isOpen={expandedInsightCards.has("top-holdings")} onToggle={() => toggleCard("top-holdings")} fmt={fmt} />
            <InsightCard title="Top 5 Winners" items={topWinners} pctKey="_gainPct" isOpen={expandedInsightCards.has("top-winners")} onToggle={() => toggleCard("top-winners")} fmt={fmt} />
            <InsightCard title="Top 5 Losers" items={topLosers} pctKey="_gainPct" isOpen={expandedInsightCards.has("top-losers")} onToggle={() => toggleCard("top-losers")} fmt={fmt} />
            <InsightCard title="Big Movers Up (10%+)" items={moversUp} pctKey="_gainPct" isOpen={expandedInsightCards.has("movers-up")} onToggle={() => toggleCard("movers-up")} fmt={fmt} />
            <InsightCard title="Big Movers Down (10%+)" items={moversDown} pctKey="_gainPct" isOpen={expandedInsightCards.has("movers-down")} onToggle={() => toggleCard("movers-down")} fmt={fmt} />
          </div>

          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Recent Buys (last {RECENT_DAYS} days)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
              <InsightCard title="Good Decision - price up since buying" items={goodRecentBuys} pctKey="_gainPct" subFn={(h) => `bought ${h.buy_date}`} isOpen={expandedInsightCards.has("good-buys")} onToggle={() => toggleCard("good-buys")} fmt={fmt} />
              <InsightCard title="Bad Decision - price down since buying" items={badRecentBuys} pctKey="_gainPct" subFn={(h) => `bought ${h.buy_date}`} isOpen={expandedInsightCards.has("bad-buys")} onToggle={() => toggleCard("bad-buys")} fmt={fmt} />
            </div>
          </div>

          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sold Decisions</span>
            <p className="text-[9px] text-slate-400 mb-1.5">Based on price movement since you sold - needs Refresh Prices on the Sold tab to populate.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InsightCard title="Good Decision - price fell after selling" items={goodSells} pctKey="_sinceSoldPct" subFn={(h) => `sold ${h.sold_date}`} isOpen={expandedInsightCards.has("good-sells")} onToggle={() => toggleCard("good-sells")} fmt={fmt} />
              <InsightCard title="Bad Decision - price rose after selling" items={badSells} pctKey="_sinceSoldPct" subFn={(h) => `sold ${h.sold_date}`} isOpen={expandedInsightCards.has("bad-sells")} onToggle={() => toggleCard("bad-sells")} fmt={fmt} />
            </div>
          </div>
          </>
          )}
          {insightsSubTab === 'mf-holdings' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">MF Holdings Insights</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                What you actually hold, drawn from each fund's underlying stocks - fetched or entered manually on the Portfolio page's MF Holdings tab.
                {fundsWithoutData > 0 && ` ${fundsWithoutData} fund${fundsWithoutData !== 1 ? 's' : ''} have no holdings data yet, so they're excluded from the combined view below.`}
              </p>
            </div>

            <div className="apple-card p-4 space-y-2.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Top 10 Mutual Funds by Value</span>
              {mfByValue.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-3">No mutual fund holdings in this portfolio.</p>
              ) : (
                <>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={(() => {
                          let running = 0;
                          return mfByValue.slice(0, 10).map(r => {
                            running += r.value;
                            return { name: r.holding.symbol.length > 12 ? r.holding.symbol.slice(0, 12) + '…' : r.holding.symbol, value: r.value, cumulativePct: totalMfValue > 0 ? (running / totalMfValue) * 100 : 0 };
                          });
                        })()}
                        margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                      >
                        <XAxis dataKey="name" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} interval={0} />
                        <YAxis yAxisId="value" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCurrency(v)} />
                        <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                        <Tooltip formatter={(v: number, key: string) => key === 'cumulativePct' ? [`${v.toFixed(1)}%`, 'Cumulative Share'] : [fmtCurrency(v), 'Value']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Bar yAxisId="value" dataKey="value" radius={[4, 4, 0, 0]} fill="#6366f1" barSize={28} />
                        <Line yAxisId="pct" type="monotone" dataKey="cumulativePct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[9px] text-slate-400">Bars = value per fund · Line = cumulative share of total MF value</p>
                  <button onClick={() => setMfFundsDetailOpen(v => !v)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                    {mfFundsDetailOpen ? 'Hide' : 'View'} all {mfByValue.length} funds <ChevronLeft className={`w-3 h-3 transition-transform ${mfFundsDetailOpen ? 'rotate-90' : '-rotate-90'}`} />
                  </button>
                  {mfFundsDetailOpen && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-900">
                      {mfByValue.map((row, i) => (
                        <div key={row.holding.id} className="flex items-center justify-between py-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{i + 1}. {row.holding.symbol}</span>
                          <span className="text-xs text-right shrink-0 ml-2">
                            <span className="font-black text-slate-700 dark:text-slate-300">{fmtCurrency(row.value)}</span>
                            <span className="text-slate-400 ml-1.5">{totalMfValue > 0 ? ((row.value / totalMfValue) * 100).toFixed(1) : '0'}%</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="apple-card p-4 space-y-2.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Top 10 Holdings Across All Funds, by Stock</span>
              {aggregatedStocks.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-3">No underlying holdings data yet - fetch it from the Portfolio page's MF Holdings tab first.</p>
              ) : (
                <>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={(() => {
                          const totalStockExposure = aggregatedStocks.reduce((s, r) => s + r.totalExposure, 0);
                          let running = 0;
                          return aggregatedStocks.slice(0, 10).map(r => {
                            running += r.totalExposure;
                            return { name: r.stockName.length > 12 ? r.stockName.slice(0, 12) + '…' : r.stockName, value: r.totalExposure, cumulativePct: totalStockExposure > 0 ? (running / totalStockExposure) * 100 : 0 };
                          });
                        })()}
                        margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                      >
                        <XAxis dataKey="name" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} interval={0} />
                        <YAxis yAxisId="value" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCurrency(v)} />
                        <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                        <Tooltip formatter={(v: number, key: string) => key === 'cumulativePct' ? [`${v.toFixed(1)}%`, 'Cumulative Share'] : [fmtCurrency(v), 'Combined Value']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Bar yAxisId="value" dataKey="value" radius={[4, 4, 0, 0]} fill="#10b981" barSize={28} />
                        <Line yAxisId="pct" type="monotone" dataKey="cumulativePct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[9px] text-slate-400">Bars = combined value per stock · Line = cumulative share of total holdings value</p>
                  <button onClick={() => setMfStocksDetailOpen(v => !v)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                    {mfStocksDetailOpen ? 'Hide' : 'View'} all {aggregatedStocks.length} holdings <ChevronLeft className={`w-3 h-3 transition-transform ${mfStocksDetailOpen ? 'rotate-90' : '-rotate-90'}`} />
                  </button>
                  {mfStocksDetailOpen && (
                    <>
                      {/* Range pills for easy paging on mobile - 10-at-a-time, only shown once the
                          list is actually longer than one page */}
                      {aggregatedStocks.length > 10 && (
                        <div className="flex gap-1.5 flex-wrap pb-1">
                          {Array.from({ length: Math.ceil(aggregatedStocks.length / 10) }, (_, i) => i * 10).map(start => (
                            <button
                              key={start}
                              onClick={() => setMfStockRangeStart(start)}
                              className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${mfStockRangeStart === start ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                            >
                              {start + 1}-{Math.min(start + 10, aggregatedStocks.length)}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="divide-y divide-slate-100 dark:divide-slate-900">
                        {aggregatedStocks.slice(mfStockRangeStart, mfStockRangeStart + 10).map((row, i) => {
                          const isOpen = mfReportDrillStock === row.stockName;
                          return (
                            <div key={row.stockName} className="py-1">
                              <button onClick={() => setMfReportDrillStock(isOpen ? null : row.stockName)} className="w-full flex items-center justify-between py-1.5 cursor-pointer">
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate text-left flex items-center gap-1.5">
                                  {mfStockRangeStart + i + 1}. {row.stockName}
                                  {row.fundCount > 1 && <span className="text-[8px] font-black px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full">{row.fundCount} funds</span>}
                                </span>
                                <span className="flex items-center gap-1.5 shrink-0 ml-2">
                                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">{fmtCurrency(row.totalExposure)}</span>
                                  {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                                </span>
                              </button>
                              {isOpen && (
                                <div className="pl-3 pb-2 space-y-1">
                                  {row.contributions.map((c, ci) => (
                                    <div key={ci} className="flex items-center justify-between text-[11px]">
                                      <span className="text-slate-500 dark:text-slate-400 truncate">{c.holding.symbol} <span className="text-slate-350">({c.weightPct.toFixed(2)}% of fund)</span></span>
                                      <span className="font-bold text-slate-600 dark:text-slate-300 shrink-0 ml-2">{fmtCurrency(c.exposure)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          )}

          {insightsSubTab === 'mf-stock' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">Common Stocks: MF + Direct</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Companies you hold both directly and through at least one mutual fund - your real combined exposure to each, and how much of it is "hidden" inside a fund.
                Matched by name, best-effort: acronym-style tickers (e.g. TCS for Tata Consultancy Services) won't be caught by this and won't appear here even if genuinely held both ways.
              </p>
            </div>

            <div className="apple-card p-4 space-y-2.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Top 10 Common Holdings by Combined Value</span>
              {combinedStocks.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-3">No overlap found yet - either no stock is held both directly and through a fund, or MF holdings data hasn't been fetched yet (Portfolio page's MF Holdings tab).</p>
              ) : (
                <>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={(() => {
                          const totalCombined = combinedStocks.reduce((s, r) => s + r.totalValue, 0);
                          let running = 0;
                          return combinedStocks.slice(0, 10).map(r => {
                            running += r.totalValue;
                            return { name: r.label.length > 12 ? r.label.slice(0, 12) + '…' : r.label, value: r.totalValue, cumulativePct: totalCombined > 0 ? (running / totalCombined) * 100 : 0 };
                          });
                        })()}
                        margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                      >
                        <XAxis dataKey="name" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} interval={0} />
                        <YAxis yAxisId="value" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCurrency(v)} />
                        <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                        <Tooltip formatter={(v: number, key: string) => key === 'cumulativePct' ? [`${v.toFixed(1)}%`, 'Cumulative Share'] : [fmtCurrency(v), 'Combined Value']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Bar yAxisId="value" dataKey="value" radius={[4, 4, 0, 0]} fill="#8b5cf6" barSize={28} />
                        <Line yAxisId="pct" type="monotone" dataKey="cumulativePct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[9px] text-slate-400">Bars = direct + MF-derived value combined · Line = cumulative share of total</p>
                  <button onClick={() => setMfStocksDetailOpen(v => !v)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                    {mfStocksDetailOpen ? 'Hide' : 'View'} all {combinedStocks.length} holdings <ChevronLeft className={`w-3 h-3 transition-transform ${mfStocksDetailOpen ? 'rotate-90' : '-rotate-90'}`} />
                  </button>
                  {mfStocksDetailOpen && (
                    <>
                      {combinedStocks.length > 10 && (
                        <div className="flex gap-1.5 flex-wrap pb-1">
                          {Array.from({ length: Math.ceil(combinedStocks.length / 10) }, (_, i) => i * 10).map(start => (
                            <button
                              key={start}
                              onClick={() => setMfStockRangeStart(start)}
                              className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${mfStockRangeStart === start ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                            >
                              {start + 1}-{Math.min(start + 10, combinedStocks.length)}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="divide-y divide-slate-100 dark:divide-slate-900">
                        {combinedStocks.slice(mfStockRangeStart, mfStockRangeStart + 10).map((row, i) => {
                          const isOpen = mfReportDrillStock === row.label;
                          return (
                          <div key={row.label} className="py-1">
                            <button onClick={() => setMfReportDrillStock(isOpen ? null : row.label)} className="w-full text-left cursor-pointer py-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                                  {mfStockRangeStart + i + 1}. {row.label}
                                  {isOpen ? <ChevronUp className="w-3 h-3 text-slate-400 shrink-0" /> : <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />}
                                </span>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300 shrink-0 ml-2">{fmtCurrency(row.totalValue)}</span>
                              </div>
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                {row.directValue > 0 && <span>Direct: {fmtCurrency(row.directValue)}</span>}
                                {row.directValue > 0 && row.mfValue > 0 && <span> · </span>}
                                {row.mfValue > 0 && <span>Via {row.mfFundCount} fund{row.mfFundCount !== 1 ? 's' : ''}: {fmtCurrency(row.mfValue)}</span>}
                              </div>
                            </button>
                            {isOpen && (
                              <div className="pl-3 pb-2 space-y-2">
                                {row.directContributions.length > 0 && (
                                  <div className="space-y-0.5">
                                    <span className="text-[8px] font-black text-slate-400 uppercase">Direct holding{row.directContributions.length !== 1 ? 's' : ''}</span>
                                    {row.directContributions.map((c, ci) => (
                                      <div key={ci} className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-500 dark:text-slate-400 truncate">{c.holding.symbol} · {c.holding.quantity} @ {fmtCurrency(Number(c.holding.live_price ?? c.holding.current_price ?? c.holding.buy_price))}</span>
                                        <span className="font-bold text-slate-600 dark:text-slate-300 shrink-0 ml-2">{fmtCurrency(c.value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {row.mfContributions.length > 0 && (
                                  <div className="space-y-0.5">
                                    <span className="text-[8px] font-black text-slate-400 uppercase">Via mutual funds</span>
                                    {row.mfContributions.map((c, ci) => (
                                      <div key={ci} className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-500 dark:text-slate-400 truncate">{c.holding.symbol} <span className="text-slate-350">({c.weightPct.toFixed(2)}% of fund{c.mfStockName !== row.label ? ` · as "${c.mfStockName}"` : ''})</span></span>
                                        <span className="font-bold text-slate-600 dark:text-slate-300 shrink-0 ml-2">{fmtCurrency(c.exposure)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          )}

          </>
        );
      })()}

      {reportTab === 'activity' && (
        <>
        {(() => {
          const now = Date.now();
          const days = (n: number) => now - n * 86400000;
          const last30 = activeHoldings.filter(h => new Date(h.buy_date).getTime() >= days(30));
          const last90 = activeHoldings.filter(h => new Date(h.buy_date).getTime() >= days(90) && new Date(h.buy_date).getTime() < days(30));
          const last365 = activeHoldings.filter(h => new Date(h.buy_date).getTime() >= days(365) && new Date(h.buy_date).getTime() < days(90));
          if (last30.length === 0 && last90.length === 0 && last365.length === 0) return null;

          const investedOf = (items: any[]) => items.reduce((s, h) => s + Number(h.buy_price) * Number(h.quantity), 0);
          const totalInvestedAllBuckets = investedOf(last30) + investedOf(last90) + investedOf(last365);
          const totalCountAllBuckets = last30.length + last90.length + last365.length;
          const chartData = [
            { label: '30d', invested: investedOf(last30), count: last30.length },
            { label: '3mo', invested: investedOf(last90), count: last90.length },
            { label: '1yr', invested: investedOf(last365), count: last365.length },
          ];

          const bucket = (label: string, items: any[]) => (
            <DetailBucket key={label} label={label} count={items.length} totalLabel={fmt(investedOf(items))} isOpen={expandedActivityBuckets.has(`new-${label}`)} onToggle={() => toggleActivityBucket(`new-${label}`)}>
              {items.map(h => (
                <div key={h.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-600 dark:text-slate-300">{h.symbol} {h.source && <span className="text-[9px] text-slate-400">· {h.source}</span>}</span>
                  <span className="text-slate-400 text-[10px]">bought {h.buy_date}</span>
                </div>
              ))}
            </DetailBucket>
          );
          return (
            <div className="apple-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">New Stocks Added</span>
                <span className="text-xs font-black text-slate-900 dark:text-white">{totalCountAllBuckets} stock{totalCountAllBuckets !== 1 ? 's' : ''} · {fmt(totalInvestedAllBuckets)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">By Count</span>
                  <div className="h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                        <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip formatter={(v: number) => [`${v} stock${v !== 1 ? 's' : ''}`, 'Count']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">By Amount</span>
                  <div className="h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                        <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip formatter={(v: number) => [fmt(v), 'Invested']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Bar dataKey="invested" radius={[0, 4, 4, 0]} fill="#6366f1" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              {bucket('Last 30 Days', last30)}
              {bucket('Last 3 Months', last90)}
              {bucket('Last Year', last365)}
            </div>
          );
        })()}

        {(() => {
          const now = Date.now();
          const days = (n: number) => now - n * 86400000;
          const soldWithDate = soldHoldings.filter(h => h.sold_date);
          const last30 = soldWithDate.filter(h => new Date(h.sold_date).getTime() >= days(30));
          const last90 = soldWithDate.filter(h => new Date(h.sold_date).getTime() >= days(90) && new Date(h.sold_date).getTime() < days(30));
          const last365 = soldWithDate.filter(h => new Date(h.sold_date).getTime() >= days(365) && new Date(h.sold_date).getTime() < days(90));
          if (last30.length === 0 && last90.length === 0 && last365.length === 0) return null;

          const soldValueOf = (items: any[]) => items.reduce((s, h) => s + Number(h.sold_price) * Number(h.quantity), 0);
          const gainOf = (items: any[]) => items.reduce((s, h) => s + (Number(h.sold_price) - Number(h.buy_price)) * Number(h.quantity), 0);
          const totalSoldAllBuckets = soldValueOf(last30) + soldValueOf(last90) + soldValueOf(last365);
          const totalCountAllBuckets = last30.length + last90.length + last365.length;
          const chartData = [
            { label: '30d', count: last30.length, gain: gainOf(last30) },
            { label: '3mo', count: last90.length, gain: gainOf(last90) },
            { label: '1yr', count: last365.length, gain: gainOf(last365) },
          ];

          const bucket = (label: string, items: any[]) => (
            <DetailBucket key={label} label={label} count={items.length} totalLabel={fmt(soldValueOf(items))} isOpen={expandedActivityBuckets.has(`sold-${label}`)} onToggle={() => toggleActivityBucket(`sold-${label}`)}>
              {items.map(h => {
                const gain = (Number(h.sold_price) - Number(h.buy_price)) * Number(h.quantity);
                return (
                  <div key={h.id} className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-600 dark:text-slate-300">{h.symbol} {h.source && <span className="text-[9px] text-slate-400">· {h.source}</span>}</span>
                    <span className="text-[10px] flex items-center gap-1.5">
                      <span className={`font-bold ${gain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{gain >= 0 ? '+' : ''}{fmt(gain)}</span>
                      <span className="text-slate-400">sold {h.sold_date}</span>
                    </span>
                  </div>
                );
              })}
            </DetailBucket>
          );
          return (
            <div className="apple-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Recently Sold</span>
                <span className="text-xs font-black text-slate-900 dark:text-white">{totalCountAllBuckets} stock{totalCountAllBuckets !== 1 ? 's' : ''} · {fmt(totalSoldAllBuckets)}</span>
              </div>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip formatter={(v: number, name: string, p: any) => [`${v} stock${v !== 1 ? 's' : ''} · ${fmt(p.payload.gain)} gain`, 'Count']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.gain >= 0 ? '#10b981' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {bucket('Last 30 Days', last30)}
              {bucket('Last 3 Months', last90)}
              {bucket('Last Year', last365)}
            </div>
          );
        })()}

        <div className="apple-card p-4 space-y-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Month-wise Profit & Loss</span>
          {(() => {
            const monthMap = new Map<string, { realized: number; dividends: number; fees: number }>();
            const monthKey = (d: string) => d.slice(0, 7);
            soldHoldings.forEach(h => {
              const key = monthKey(h.sold_date);
              const gain = (Number(h.sold_price) - Number(h.buy_price)) * Number(h.quantity);
              const prev = monthMap.get(key) || { realized: 0, dividends: 0, fees: 0 };
              monthMap.set(key, { ...prev, realized: prev.realized + gain });
            });
            portfolioDividends.forEach(d => {
              const key = monthKey(d.dividend_date);
              const prev = monthMap.get(key) || { realized: 0, dividends: 0, fees: 0 };
              monthMap.set(key, { ...prev, dividends: prev.dividends + Number(d.amount) });
            });
            portfolioFees.forEach(f => {
              const key = monthKey(f.fee_date);
              const prev = monthMap.get(key) || { realized: 0, dividends: 0, fees: 0 };
              monthMap.set(key, { ...prev, fees: prev.fees + Number(f.amount) });
            });
            const months = Array.from(monthMap.keys()).sort().reverse();
            if (months.length === 0) return <p className="text-[11px] text-slate-400">No sold holdings, dividends, or fees recorded yet.</p>;
            const chartData = [...months].reverse().map(m => {
              const { realized, dividends, fees } = monthMap.get(m)!;
              return { month: new Date(`${m}-01`).toLocaleString('default', { month: 'short', year: '2-digit' }), net: realized + dividends - fees };
            });
            return (
              <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => [fmt(v), 'Net P&L']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.net >= 0 ? '#10b981' : '#f43f5e'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-900">
                {months.map(m => {
                  const { realized, dividends, fees } = monthMap.get(m)!;
                  const net = realized + dividends - fees;
                  const label = new Date(`${m}-01`).toLocaleString('default', { month: 'long', year: 'numeric' });
                  return (
                    <div key={m} className="py-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                      <span className="text-slate-500">
                        Realized {fmt(realized)} · Div +{fmt(dividends)} · Fees -{fmt(fees)} ·{' '}
                        <span className={`font-bold ${net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>Net {net >= 0 ? '+' : ''}{fmt(net)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              </>
            );
          })()}
        </div>
        </>
      )}

      {reportTab === 'movement' && (
        <div className="apple-card p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Monthly Movement Report</span>
            {!isReadOnly && (
              <button
                onClick={() => runAction(async () => {
                  const bySource = new Map<string, { invested: number; current: number }>();
                  activeHoldings.forEach(h => {
                    const key = h.source || 'Untagged';
                    const invested = Number(h.buy_price) * Number(h.quantity);
                    const current = Number(h.live_price ?? h.current_price ?? h.buy_price) * Number(h.quantity);
                    const prev = bySource.get(key) || { invested: 0, current: 0 };
                    bySource.set(key, { invested: prev.invested + invested, current: prev.current + current });
                  });
                  const groups = Array.from(bySource.entries()).map(([label, v]) => ({ label, ...v }));
                  const totalInvested = groups.reduce((s, g) => s + g.invested, 0);
                  const totalCurrent = groups.reduce((s, g) => s + g.current, 0);
                  groups.push({ label: 'Total Asset Value', invested: totalInvested, current: totalCurrent });
                  await takePortfolioSnapshot(todayStr(), groups);
                  setSnapshotMessage(`Snapshot saved for ${todayStr()}.`);
                  setTimeout(() => setSnapshotMessage(null), 5000);
                })}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer"
              >
                Take Snapshot Today
              </button>
            )}
          </div>
          {snapshotMessage && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{snapshotMessage}</p>
          )}
          {(() => {
            const dates = Array.from(new Set(portfolioSnapshots.map(s => s.snapshot_date))).sort().reverse();
            if (dates.length < 2) {
              return <p className="text-[11px] text-slate-400">Take at least 2 snapshots (e.g. one this month, one next month) to see movement between them. {dates.length === 1 ? `1 snapshot recorded so far (${dates[0]}).` : ''}</p>;
            }
            const newerDate = dates[0];
            const olderDate = dates[1];
            const newerRows = portfolioSnapshots.filter(s => s.snapshot_date === newerDate);
            const olderRows = portfolioSnapshots.filter(s => s.snapshot_date === olderDate);
            const labels = Array.from(new Set([...olderRows.map(r => r.label), ...newerRows.map(r => r.label)]));
            const sortableLabels = labels.filter(l => l !== 'Total Asset Value');
            const rowFor = (label: string) => {
              const older = olderRows.find(r => r.label === label);
              const newer = newerRows.find(r => r.label === label);
              const olderVal = Number(older?.current_value ?? 0);
              const newerVal = Number(newer?.current_value ?? 0);
              return { label, older, newer, olderVal, newerVal, diff: newerVal - olderVal };
            };
            const sortValueFor = (label: string) => {
              const r = rowFor(label);
              return movementSortKey === 'label' ? label : movementSortKey === 'older' ? r.olderVal : movementSortKey === 'newer' ? r.newerVal : r.diff;
            };
            sortableLabels.sort((a, b) => {
              const av = sortValueFor(a), bv = sortValueFor(b);
              const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
              return movementSortDir === 'asc' ? cmp : -cmp;
            });
            // Total Asset Value always stays last - it's a summary row, not a regular
            // sortable entry, so it shouldn't jump around based on the current sort.
            const orderedLabels = [...sortableLabels, ...(labels.includes('Total Asset Value') ? ['Total Asset Value'] : [])];
            const toggleSort = (key: typeof movementSortKey) => {
              if (movementSortKey === key) setMovementSortDir(d => d === 'asc' ? 'desc' : 'asc');
              else { setMovementSortKey(key); setMovementSortDir('desc'); }
            };
            const sortArrow = (key: typeof movementSortKey) => movementSortKey === key ? (movementSortDir === 'asc' ? ' ↑' : ' ↓') : '';
            return (
              <div className="space-y-3">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={orderedLabels.map(label => ({
                        label: label === 'Total Asset Value' ? 'Total' : label,
                        [olderDate]: Number(olderRows.find(r => r.label === label)?.current_value ?? 0),
                        [newerDate]: Number(newerRows.find(r => r.label === label)?.current_value ?? 0),
                      }))}
                      margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey={olderDate} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={newerDate} fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-900 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="p-2 text-left cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => toggleSort('label')}>List{sortArrow('label')}</th>
                      <th className="p-2 text-right cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => toggleSort('older')}>{olderDate} Value{sortArrow('older')}</th>
                      <th className="p-2 text-right cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => toggleSort('newer')}>{newerDate} Value{sortArrow('newer')}</th>
                      <th className="p-2 text-right cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-300" onClick={() => toggleSort('diff')}>Difference{sortArrow('diff')}</th>
                      <th className="p-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                    {orderedLabels.map(label => {
                      const { older, newer, olderVal, newerVal, diff } = rowFor(label);
                      const isTotal = label === 'Total Asset Value';
                      const isDrillOpen = movementDrillLabel === label;
                      return (
                        <tr key={label} className={`${isTotal ? 'font-black' : ''} cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900`} onClick={() => { setMovementDrillLabel(isDrillOpen ? null : label); setMovementDrillExpanded(false); }}>
                          <td className="p-2 text-slate-700 dark:text-slate-300">{label}</td>
                          <td className="p-2 text-right text-slate-500">{older ? fmt(olderVal) : '—'}</td>
                          <td className="p-2 text-right text-slate-900 dark:text-white">{newer ? fmt(newerVal) : '—'}</td>
                          <td className={`p-2 text-right font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{diff >= 0 ? '+' : ''}{fmt(diff)}</td>
                          <td className="p-2 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${isDrillOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                              {isDrillOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {movementDrillLabel && (() => {
                  const isTotal = movementDrillLabel === 'Total Asset Value';
                  const relevantHoldings = activeHoldings.filter(h => isTotal || (h.source || 'Untagged') === movementDrillLabel);
                  const movers = relevantHoldings.map(h => {
                    const qty = Number(h.quantity);
                    const olderPrice = getPriceAtOrBefore(h.id, olderDate);
                    const newerPrice = getPriceAtOrBefore(h.id, newerDate) ?? Number(h.live_price ?? h.current_price ?? h.buy_price);
                    if (olderPrice == null) return null; // no price history that far back for this stock - can't attribute its movement
                    return { symbol: h.symbol, diff: (newerPrice - olderPrice) * qty };
                  }).filter((m): m is { symbol: string; diff: number } => m !== null)
                    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
                  const missingHistoryCount = relevantHoldings.length - movers.length;

                  return (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-900 space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Which stocks moved "{movementDrillLabel === 'Total Asset Value' ? 'Total' : movementDrillLabel}"</span>
                      {movers.length === 0 ? (
                        <p className="text-[11px] text-slate-400">No price history far back enough ({olderDate}) to attribute this movement to individual stocks - needs a price refresh recorded around that date.</p>
                      ) : (
                        <>
                          <div style={{ height: 180 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={movers.slice(0, 5).map(m => ({ name: m.symbol.length > 12 ? m.symbol.slice(0, 12) + '…' : m.symbol, value: m.diff }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
                                <Tooltip formatter={(v: number) => [`${v >= 0 ? '+' : ''}${fmt(v)}`, 'Contribution']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                  {movers.slice(0, 5).map((m, i) => <Cell key={i} fill={m.diff >= 0 ? '#10b981' : '#f43f5e'} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          {movers.length > 5 && (
                            <button onClick={() => setMovementDrillExpanded(v => !v)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                              {movementDrillExpanded ? 'Show less' : `Show all ${movers.length}`}
                            </button>
                          )}
                          {movementDrillExpanded && (
                            <div className="divide-y divide-slate-100 dark:divide-slate-900">
                              {movers.map((m, i) => (
                                <div key={i} className="flex items-center justify-between py-1.5 text-[11px]">
                                  <span className="text-slate-600 dark:text-slate-300">{i + 1}. {m.symbol}</span>
                                  <span className={`font-bold ${m.diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{m.diff >= 0 ? '+' : ''}{fmt(m.diff)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {missingHistoryCount > 0 && (
                            <p className="text-[9px] text-slate-400">{missingHistoryCount} holding{missingHistoryCount !== 1 ? 's' : ''} excluded - no recorded price as far back as {olderDate}.</p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
                {!isReadOnly && (
                  <button onClick={() => runAction(() => deletePortfolioSnapshotBatch(newerDate))} className="mt-2 text-[9px] font-bold text-rose-400 hover:text-rose-500 cursor-pointer">Delete {newerDate} snapshot</button>
                )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {reportTab === 'summary' && (() => {
        // Shadows the module-level fmt within this tab only, so every number already
        // written as fmt(...) below automatically becomes currency-aware for whichever
        // portfolio (or combined base currency) is currently selected, without needing to
        // touch each individual call site.
        const fmt = (n: number) => fmtCur(n, reportDisplayCurrency);
        const plComponents = [
          { name: 'Unrealized', value: unrealizedGain },
          { name: 'Realized', value: realizedGain },
          { name: 'Dividends', value: totalDividends },
          { name: 'Fees', value: -totalFees },
        ].filter(c => c.value !== 0);
        const deployedPct = netContributed > 0 ? Math.min(100, (totalInvestedAllTime / netContributed) * 100) : 0;
        const valuePct = totalInvestedAllTime > 0 ? Math.min(100, (currentValueActive / totalInvestedAllTime) * 100) : 0;

        return (
        <>
        {/* Hero: the one number that matters, up front and unmissable */}
        <div className={`apple-card p-5 text-center space-y-1 ${netGain >= 0 ? 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-950' : 'bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-slate-950'}`}>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Gain (P&L, all-in)</span>
          <div className={`flex items-center justify-center gap-2 text-3xl font-black ${netGain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {netGain >= 0 ? <TrendingUp className="w-7 h-7" /> : <TrendingDown className="w-7 h-7" />}
            {fmt(Math.abs(netGain))}
          </div>
          <span className={`text-sm font-bold ${returnPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}% vs. total investment</span>
        </div>

        {/* Money flow: contributed -> deployed -> current value, as a visual progression */}
        <div className="apple-card p-4 space-y-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Money Flow</span>
          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-500 font-semibold">Net Contributed</span><span className="font-bold text-slate-900 dark:text-white">{fmt(netContributed)}</span></div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-slate-400 dark:bg-slate-500 rounded-full" style={{ width: '100%' }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-500 font-semibold">Capital Deployed</span><span className="font-bold text-slate-900 dark:text-white">{fmt(totalInvestedAllTime)}</span></div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${deployedPct}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-500 font-semibold">Current Value of Active Holdings</span><span className="font-bold text-slate-900 dark:text-white">{fmt(currentValueActive)}</span></div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={`h-full rounded-full transition-all ${valuePct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, valuePct)}%` }} /></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
            <div className="flex justify-between"><span className="text-slate-400">Cash in</span><span className="font-bold text-slate-700 dark:text-slate-300">{fmt(totalContributed)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Cash out</span><span className="font-bold text-rose-500">-{fmt(totalWithdrawn)}</span></div>
          </div>
        </div>

        {/* What's driving the gain - a chart makes it obvious at a glance which pieces help vs hurt */}
        {plComponents.length > 0 && (
          <div className="apple-card p-4 space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">What's Driving It</span>
            <div style={{ height: Math.max(80, plComponents.length * 32) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={plComponents} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(1)}L`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip formatter={(v: number) => [fmt(v), '']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {plComponents.map((d, i) => <Cell key={i} fill={d.value >= 0 ? '#10b981' : '#f43f5e'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Full numbers, always available for anyone who wants the precise breakdown */}
        <details className="apple-card p-4 space-y-2 group">
          <summary className="text-[10px] font-black text-slate-400 uppercase tracking-wider cursor-pointer list-none flex items-center justify-between">
            Full Breakdown
            <ChevronLeft className="w-3.5 h-3.5 -rotate-90 group-open:rotate-90 transition-transform" />
          </summary>
          <div className="space-y-2 text-xs pt-2">
            <div className="flex justify-between"><span className="text-slate-500">Total Contributed (cash in)</span><span className="font-bold text-slate-900 dark:text-white">{fmt(totalContributed)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total Withdrawn (cash out)</span><span className="font-bold text-rose-500">-{fmt(totalWithdrawn)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Net Contributed (Total Investment)</span><span className="font-bold text-slate-900 dark:text-white">{fmt(netContributed)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Capital Deployed (cost basis, incl. reinvested)</span><span className="font-bold text-slate-900 dark:text-white">{fmt(totalInvestedAllTime)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Current Value of Active Holdings</span><span className="font-bold text-slate-900 dark:text-white">{fmt(currentValueActive)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Unrealized Gain/Loss</span><span className={`font-bold ${unrealizedGain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{fmt(unrealizedGain)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Realized Gain/Loss (sold)</span><span className={`font-bold ${realizedGain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{fmt(realizedGain)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Dividends Received</span><span className="font-bold text-emerald-600">+{fmt(totalDividends)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Fees Paid (AMC etc)</span><span className="font-bold text-rose-500">-{fmt(totalFees)}</span></div>
          </div>
        </details>

        <div className="apple-card p-4 space-y-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Per-Person Share (based on today's split)</span>
          {currentSplits.filter(s => s.percent > 0).length > 0 && (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={currentSplits.filter(s => s.percent > 0).map(s => ({ name: memberName(s.member), value: s.percent }))} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="100%" paddingAngle={2}>
                    {currentSplits.filter(s => s.percent > 0).map((_, i) => <Cell key={i} fill={['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'][i % 5]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Split']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {currentSplits.map(({ member, percent }) => {
            const contributed = portfolioContributions.filter(c => c.member_user_id === member.uid).reduce((s, c) => s + Number(c.amount), 0);
            const withdrawn = portfolioWithdrawals.filter(w => w.member_user_id === member.uid).reduce((s, w) => s + Number(w.amount), 0);
            const shareOfGain = netGain * (percent / 100);
            return (
              <div key={member.uid} className="flex items-center justify-between text-xs py-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{memberName(member)} ({percent}%)</span>
                <span className="text-slate-500">
                  Net {fmt(contributed - withdrawn)}{withdrawn > 0 ? ` (${fmt(contributed)} in, ${fmt(withdrawn)} out)` : ''} · Share of gain <span className={shareOfGain >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{fmt(shareOfGain)}</span>
                </span>
              </div>
            );
          })}
          <p className="text-[9px] text-slate-400 pt-1">Gain split uses today's active percentage — historical contributions are tracked exactly per person in the Portfolio page.</p>
        </div>

        <div className="apple-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" /> Dividends</span>
            {!isReadOnly && <QuickAddDividend onAdd={addPortfolioDividend} />}
          </div>
          {portfolioDividends.length === 0 ? <p className="text-[11px] text-slate-400">None recorded.</p> : (() => {
            const monthMap = new Map<string, number>();
            portfolioDividends.forEach(d => {
              const key = d.dividend_date.slice(0, 7);
              monthMap.set(key, (monthMap.get(key) || 0) + Number(d.amount));
            });
            const chartData = Array.from(monthMap.keys()).sort().map(m => ({ month: new Date(`${m}-01`).toLocaleString('default', { month: 'short', year: '2-digit' }), amount: monthMap.get(m)! }));
            return (
              <>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => [fmt(v), 'Dividends']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]} fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <button onClick={() => toggleActivityBucket('dividends')} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                  {expandedActivityBuckets.has('dividends') ? 'Hide details' : 'View details'} <ChevronLeft className={`w-3 h-3 transition-transform ${expandedActivityBuckets.has('dividends') ? 'rotate-90' : '-rotate-90'}`} />
                </button>
                {expandedActivityBuckets.has('dividends') && portfolioDividends.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">{d.symbol} · {d.dividend_date}</span>
                    <div className="flex items-center gap-2"><span className="font-bold text-emerald-600">+{fmt(Number(d.amount))}</span>{!isReadOnly && <button onClick={() => runAction(() => deletePortfolioDividend(d.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}</div>
                  </div>
                ))}
              </>
            );
          })()}
        </div>

        <div className="apple-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> AMC & Fees</span>
            {!isReadOnly && <QuickAddFee onAdd={addPortfolioFee} />}
          </div>
          {portfolioFees.length === 0 ? <p className="text-[11px] text-slate-400">None recorded.</p> : (() => {
            const monthMap = new Map<string, number>();
            portfolioFees.forEach(f => {
              const key = f.fee_date.slice(0, 7);
              monthMap.set(key, (monthMap.get(key) || 0) + Number(f.amount));
            });
            const chartData = Array.from(monthMap.keys()).sort().map(m => ({ month: new Date(`${m}-01`).toLocaleString('default', { month: 'short', year: '2-digit' }), amount: monthMap.get(m)! }));
            return (
              <>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => [fmt(v), 'Fees']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]} fill="#f43f5e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <button onClick={() => toggleActivityBucket('fees')} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                  {expandedActivityBuckets.has('fees') ? 'Hide details' : 'View details'} <ChevronLeft className={`w-3 h-3 transition-transform ${expandedActivityBuckets.has('fees') ? 'rotate-90' : '-rotate-90'}`} />
                </button>
                {expandedActivityBuckets.has('fees') && portfolioFees.map(f => (
                  <div key={f.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">{f.broker} · {f.fee_type} · {f.fee_date}</span>
                    <div className="flex items-center gap-2"><span className="font-bold text-rose-500">-{fmt(Number(f.amount))}</span>{!isReadOnly && <button onClick={() => runAction(() => deletePortfolioFee(f.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}</div>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
        </>
        );
      })()}
    </div>
  );
}

function QuickAddDividend({ onAdd }: { onAdd: (symbol: string, amount: number, date: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <button onClick={() => setOpen(true)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Add</button>;
  return (
    <div>
      <form onSubmit={async (e) => { e.preventDefault(); if (!symbol.trim() || !amount) return; try { setErr(null); await onAdd(symbol.trim(), parseFloat(amount), date); setSymbol(''); setAmount(''); setOpen(false); } catch (error: any) { setErr(error?.message || 'Failed to save.'); } }} className="flex gap-1.5">
        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="Symbol" className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px]" />
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amt" className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px]" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px]" />
        <button type="submit" className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold cursor-pointer">Save</button>
      </form>
      {err && <p className="text-[9px] text-rose-500 mt-1">{err}</p>}
    </div>
  );
}

function QuickAddFee({ onAdd }: { onAdd: (broker: string, feeType: string, amount: number, date: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [broker, setBroker] = useState('Zerodha');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <button onClick={() => setOpen(true)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Add</button>;
  return (
    <div>
      <form onSubmit={async (e) => { e.preventDefault(); if (!amount) return; try { setErr(null); await onAdd(broker, 'AMC', parseFloat(amount), date); setAmount(''); setOpen(false); } catch (error: any) { setErr(error?.message || 'Failed to save.'); } }} className="flex gap-1.5">
        <select value={broker} onChange={(e) => setBroker(e.target.value)} className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px]">
          <option>Zerodha</option><option>Groww</option><option>Other</option>
        </select>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amt" className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px]" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[10px]" />
        <button type="submit" className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold cursor-pointer">Save</button>
      </form>
      {err && <p className="text-[9px] text-rose-500 mt-1">{err}</p>}
    </div>
  );
}
