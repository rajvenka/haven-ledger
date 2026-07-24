import React, { useState } from 'react';
import { Trash2, Gift, Receipt, FileBarChart, ChevronLeft } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface WorkspaceMemberLite {
  uid: string;
  displayName?: string;
  email: string;
}

interface ReportsViewProps {
  workspaceName?: string;
  workspaceMembers: WorkspaceMemberLite[];
  isReadOnly?: boolean;
  portfolioHoldings: any[];
  portfolioContributions: any[];
  portfolioWithdrawals: any[];
  portfolioDividends: any[];
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
const todayStr = () => new Date().toISOString().slice(0, 10);
const memberName = (m: WorkspaceMemberLite) => m.displayName || m.email.split('@')[0];

type ReportTab = 'overview' | 'insights' | 'activity' | 'movement' | 'summary';

// Defined outside ReportsView so it keeps a stable identity across renders - when it was
// defined inside the render body, every state update (e.g. toggling one card's details)
// redefined this as a new function, which made React unmount and remount every card
// instead of just re-rendering the one that changed, causing all charts to visibly reload.
function InsightCard({ title, items, pctKey, subFn, isOpen, onToggle, fmt }: {
  title: string; items: any[]; pctKey: '_gainPct' | '_sinceSoldPct'; subFn?: (h: any) => string;
  isOpen: boolean; onToggle: () => void; fmt: (n: number) => string;
}) {
  const chartData = items.map(h => ({ name: h.symbol.length > 10 ? h.symbol.slice(0, 10) + '…' : h.symbol, pct: h[pctKey] }));
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
                <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip formatter={(v: number) => [`${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, 'Change']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.pct >= 0 ? '#10b981' : '#f43f5e'} />)}
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
                  <span className={`font-bold shrink-0 ml-2 ${h[pctKey] >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{h[pctKey] >= 0 ? '+' : ''}{h[pctKey].toFixed(2)}%</span>
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
    workspaceName, workspaceMembers, isReadOnly,
    portfolioHoldings, portfolioContributions, portfolioWithdrawals,
    portfolioDividends, addPortfolioDividend, deletePortfolioDividend,
    portfolioFees, addPortfolioFee, deletePortfolioFee,
    portfolioSplits, portfolioCashBalances, portfolioSnapshots, takePortfolioSnapshot, deletePortfolioSnapshotBatch,
  } = props;

  const [reportTab, setReportTab] = useState<ReportTab>('overview');
  const [drillPath, setDrillPath] = useState<string[]>([]);
  const [insightsAssetFilter, setInsightsAssetFilter] = useState<'all' | 'stock' | 'mutual_fund'>('all');
  const [expandedInsightCards, setExpandedInsightCards] = useState<Set<string>>(new Set());
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
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
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-5 text-left bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <FileBarChart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{workspaceName ? `${workspaceName} Reports` : 'Reports'}</h2>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{formError}</div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setReportTab(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${reportTab === t.key ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reportTab === 'overview' && (
        <>
        {activeHoldings.length > 0 && (() => {
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
        const filtered = insightsAssetFilter === 'all' ? activeHoldings : activeHoldings.filter(h => (h.holding_type === 'mutual_fund' ? 'mutual_fund' : 'stock') === insightsAssetFilter);
        const soldFiltered = insightsAssetFilter === 'all' ? soldHoldings : soldHoldings.filter(h => (h.holding_type === 'mutual_fund' ? 'mutual_fund' : 'stock') === insightsAssetFilter);

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


        return (
          <>
          <div className="flex gap-1.5">
            {(['all', 'stock', 'mutual_fund'] as const).map(f => (
              <button
                key={f}
                onClick={() => setInsightsAssetFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${insightsAssetFilter === f ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
              >
                {f === 'all' ? 'All' : f === 'stock' ? 'Stocks' : 'Mutual Funds'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InsightCard title="Top 5 Holdings (by value)" items={topHoldings} pctKey="_gainPct" subFn={(h) => fmt(h._value)} isOpen={expandedInsightCards.has("top-holdings")} onToggle={() => toggleCard("top-holdings")} fmt={fmt} />
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
            const orderedLabels = [...labels.filter(l => l !== 'Total Asset Value'), ...(labels.includes('Total Asset Value') ? ['Total Asset Value'] : [])];
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
                      <th className="p-2 text-left">List</th>
                      <th className="p-2 text-right">{olderDate} Value</th>
                      <th className="p-2 text-right">{newerDate} Value</th>
                      <th className="p-2 text-right">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                    {orderedLabels.map(label => {
                      const older = olderRows.find(r => r.label === label);
                      const newer = newerRows.find(r => r.label === label);
                      const olderVal = Number(older?.current_value ?? 0);
                      const newerVal = Number(newer?.current_value ?? 0);
                      const diff = newerVal - olderVal;
                      const isTotal = label === 'Total Asset Value';
                      return (
                        <tr key={label} className={isTotal ? 'font-black' : ''}>
                          <td className="p-2 text-slate-700 dark:text-slate-300">{label}</td>
                          <td className="p-2 text-right text-slate-500">{older ? fmt(olderVal) : '—'}</td>
                          <td className="p-2 text-right text-slate-900 dark:text-white">{newer ? fmt(newerVal) : '—'}</td>
                          <td className={`p-2 text-right font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{diff >= 0 ? '+' : ''}{fmt(diff)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!isReadOnly && (
                  <button onClick={() => runAction(() => deletePortfolioSnapshotBatch(newerDate))} className="mt-2 text-[9px] font-bold text-rose-400 hover:text-rose-500 cursor-pointer">Delete {newerDate} snapshot</button>
                )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {reportTab === 'summary' && (
        <>
        <div className="apple-card p-4 space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-slate-500">Total Contributed (cash in)</span><span className="font-bold text-slate-900 dark:text-white">{fmt(totalContributed)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Total Withdrawn (cash out)</span><span className="font-bold text-rose-500">-{fmt(totalWithdrawn)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Net Contributed (Total Investment)</span><span className="font-bold text-slate-900 dark:text-white">{fmt(netContributed)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Capital Deployed (cost basis, incl. reinvested)</span><span className="font-bold text-slate-900 dark:text-white">{fmt(totalInvestedAllTime)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Current Value of Active Holdings</span><span className="font-bold text-slate-900 dark:text-white">{fmt(currentValueActive)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Unrealized Gain/Loss</span><span className={`font-bold ${unrealizedGain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{fmt(unrealizedGain)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Realized Gain/Loss (sold)</span><span className={`font-bold ${realizedGain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{fmt(realizedGain)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Dividends Received</span><span className="font-bold text-emerald-600">+{fmt(totalDividends)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Fees Paid (AMC etc)</span><span className="font-bold text-rose-500">-{fmt(totalFees)}</span></div>
          <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-900 text-sm">
            <span className="font-black text-slate-900 dark:text-white">Net Gain (P&L, all-in)</span>
            <span className={`font-black ${netGain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{fmt(netGain)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-black text-slate-900 dark:text-white">Return % (vs. total investment)</span>
            <span className={`font-black ${returnPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%</span>
          </div>
        </div>

        <div className="apple-card p-4 space-y-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Per-Person Share (based on today's split)</span>
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
      )}
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
