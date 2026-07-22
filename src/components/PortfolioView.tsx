import React, { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Plus, Trash2, RefreshCw, Users, Wallet,
  CheckCircle2, X, Briefcase, Gift, Receipt
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
  portfolioSplits: any[];
  addPortfolioSplit: (memberUserId: string, percent: number, from: string, to?: string) => Promise<void>;
  deletePortfolioSplit: (id: string) => Promise<void>;
  portfolioHoldings: any[];
  addPortfolioHolding: (h: {
    holdingType?: 'stock' | 'mutual_fund'; broker: string; symbol: string; exchange: string; quantity: number; buyPrice: number; buyDate: string; notes?: string;
    source?: string;
    targetType?: 'price' | 'percent'; targetPrice?: number; targetPercent?: number;
    holdType?: 'days' | 'date'; holdDays?: number; holdUntilDate?: string;
  }) => Promise<void>;
  updatePortfolioHolding: (id: string, updates: any) => Promise<void>;
  deletePortfolioHolding: (id: string) => Promise<void>;
  portfolioContributions: any[];
  addPortfolioContribution: (memberUserId: string, amount: number, date: string, notes?: string) => Promise<void>;
  deletePortfolioContribution: (id: string) => Promise<void>;
  portfolioDividends: any[];
  addPortfolioDividend: (symbol: string, amount: number, date: string, holdingId?: string, notes?: string) => Promise<void>;
  deletePortfolioDividend: (id: string) => Promise<void>;
  portfolioFees: any[];
  addPortfolioFee: (broker: string, feeType: string, amount: number, date: string, notes?: string) => Promise<void>;
  deletePortfolioFee: (id: string) => Promise<void>;
  portfolioRecurringPlans: any[];
  addPortfolioRecurringPlan: (memberUserId: string, amount: number, frequency: 'monthly' | 'quarterly' | 'yearly', startDate: string, dayOfMonth?: number) => Promise<void>;
  updatePortfolioRecurringPlan: (id: string, updates: { active?: boolean; expectedAmount?: number }) => Promise<void>;
  deletePortfolioRecurringPlan: (id: string) => Promise<void>;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const memberName = (m: WorkspaceMemberLite) => m.displayName || m.email.split('@')[0];

export default function PortfolioView(props: PortfolioViewProps) {
  const {
    workspaceName, workspaceMembers, isReadOnly,
    portfolioSplits, addPortfolioSplit, deletePortfolioSplit,
    portfolioHoldings, addPortfolioHolding, updatePortfolioHolding, deletePortfolioHolding,
    portfolioContributions, addPortfolioContribution, deletePortfolioContribution,
    portfolioDividends, addPortfolioDividend, deletePortfolioDividend,
    portfolioFees, addPortfolioFee, deletePortfolioFee,
    portfolioRecurringPlans, addPortfolioRecurringPlan, updatePortfolioRecurringPlan, deletePortfolioRecurringPlan,
  } = props;

  const [tab, setTab] = useState<'holdings' | 'contributions' | 'plan' | 'statement'>('holdings');
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
  const [showTargetPlan, setShowTargetPlan] = useState(false);
  const [hTargetType, setHTargetType] = useState<'price' | 'percent'>('percent');
  const [hTargetValue, setHTargetValue] = useState('');
  const [hHoldType, setHHoldType] = useState<'days' | 'date'>('days');
  const [hHoldDays, setHHoldDays] = useState('');
  const [hHoldUntilDate, setHHoldUntilDate] = useState('');
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState(todayStr());

  const activeHoldings = portfolioHoldings.filter(h => h.status === 'active');
  const soldHoldings = portfolioHoldings.filter(h => h.status === 'sold');

  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [priceRefreshSummary, setPriceRefreshSummary] = useState<string | null>(null);

  const refreshAllPrices = async () => {
    setRefreshingPrices(true);
    setPriceRefreshSummary(null);
    await runAction(async () => {
      const symbols = activeHoldings.filter(h => h.holding_type !== 'mutual_fund').map(h => ({ symbol: h.symbol, exchange: h.exchange }));
      if (symbols.length === 0) { setPriceRefreshSummary('No stock holdings to refresh (mutual funds need manual NAV updates).'); return; }
      const resp = await fetch('/api/portfolio-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      });
      if (!resp.ok) throw new Error('Price service did not respond. Try again shortly.');
      const { results } = await resp.json();

      let succeeded = 0;
      let failed = 0;
      for (const r of results) {
        const holding = activeHoldings.find(h => h.symbol === r.symbol && h.exchange === r.exchange);
        if (!holding) continue;
        if (r.price != null) {
          await updatePortfolioHolding(holding.id, { currentPrice: r.price });
          succeeded++;
        } else {
          failed++;
        }
      }
      setPriceRefreshSummary(
        failed === 0
          ? `Updated ${succeeded} price${succeeded !== 1 ? 's' : ''} · delayed a few minutes, not real-time`
          : `Updated ${succeeded}, couldn't find ${failed} (check the symbol matches Yahoo Finance's ticker) · delayed a few minutes, not real-time`
      );
    });
    setRefreshingPrices(false);
  };

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hSymbol.trim() || !hQty || !hPrice) return;
    await runAction(async () => {
      await addPortfolioHolding({
        holdingType: hHoldingType, broker: hBroker, symbol: hSymbol, exchange: hExchange, quantity: parseFloat(hQty), buyPrice: parseFloat(hPrice), buyDate: hDate,
        source: hSource.trim() || undefined,
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

  // ---- Investment Plan ----
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [planMemberId, setPlanMemberId] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planFrequency, setPlanFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [planStartDate, setPlanStartDate] = useState(todayStr());
  const [planDayOfMonth, setPlanDayOfMonth] = useState('1');

  // ---- Statement calculations ----
  const totalContributed = portfolioContributions.reduce((s, c) => s + Number(c.amount), 0);
  const totalInvestedActive = activeHoldings.reduce((s, h) => s + Number(h.buy_price) * Number(h.quantity), 0);
  const currentValueActive = activeHoldings.reduce((s, h) => s + Number(h.current_price ?? h.buy_price) * Number(h.quantity), 0);
  const unrealizedGain = currentValueActive - totalInvestedActive;
  const realizedGain = soldHoldings.reduce((s, h) => s + (Number(h.sold_price) - Number(h.buy_price)) * Number(h.quantity), 0);
  const totalDividends = portfolioDividends.reduce((s, d) => s + Number(d.amount), 0);
  const totalFees = portfolioFees.reduce((s, f) => s + Number(f.amount), 0);
  const totalInvestedAllTime = totalInvestedActive + soldHoldings.reduce((s, h) => s + Number(h.buy_price) * Number(h.quantity), 0);
  const netGain = unrealizedGain + realizedGain + totalDividends - totalFees;
  const returnPct = totalInvestedAllTime > 0 ? (netGain / totalInvestedAllTime) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-5 text-left select-none bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{workspaceName ? `${workspaceName} Portfolio` : 'Portfolio'}</h2>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center justify-between gap-2">
          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{formError}</span>
          <button onClick={() => setFormError(null)} className="text-rose-400 hover:text-rose-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Headline stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Investment</span>
          <span className="text-base font-black text-slate-900 dark:text-white">{fmt(totalInvestedAllTime)}</span>
          <span className="text-[9px] text-slate-400 block mt-0.5">active + sold, cost basis</span>
        </div>
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
          <span className="text-[9px] text-slate-400 block mt-0.5">incl. dividends & fees</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-150 dark:border-slate-800 gap-1">
        {(['holdings', 'contributions', 'plan', 'statement'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-2 text-xs font-bold capitalize cursor-pointer transition-all whitespace-nowrap ${tab === t ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
          >
            {t === 'contributions' ? 'Contributions & Split' : t === 'plan' ? 'Investment Plan' : t}
          </button>
        ))}
      </div>

      {/* HOLDINGS TAB */}
      {tab === 'holdings' && (
        <div className="space-y-4">
          {!isReadOnly && (
          <div className="flex justify-end gap-2">
            {activeHoldings.length > 0 && (
              <button
                onClick={refreshAllPrices}
                disabled={refreshingPrices}
                className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingPrices ? 'animate-spin' : ''}`} /> {refreshingPrices ? 'Refreshing…' : 'Refresh Prices'}
              </button>
            )}
            <button onClick={() => setIsAddingHolding(!isAddingHolding)} className="apple-btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Holding
            </button>
          </div>
          )}
          {priceRefreshSummary && (
            <p className="text-[10px] text-slate-400 -mt-2">{priceRefreshSummary}</p>
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

          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active ({activeHoldings.length})</span>
            <div className="apple-card divide-y divide-slate-100 dark:divide-slate-900 mt-1.5 overflow-hidden">
              {activeHoldings.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">No active holdings yet.</p>
              ) : activeHoldings.map(h => {
                const gain = (Number(h.current_price ?? h.buy_price) - Number(h.buy_price)) * Number(h.quantity);
                const gainPct = ((Number(h.current_price ?? h.buy_price) - Number(h.buy_price)) / Number(h.buy_price)) * 100;

                const targetPrice = h.target_type === 'price' ? Number(h.target_price)
                  : h.target_type === 'percent' ? Number(h.buy_price) * (1 + Number(h.target_percent) / 100)
                  : null;
                const targetProgressPct = targetPrice
                  ? Math.max(0, Math.min(100, ((Number(h.current_price ?? h.buy_price) - Number(h.buy_price)) / (targetPrice - Number(h.buy_price))) * 100))
                  : null;

                const holdUntil = h.hold_type === 'date' ? new Date(h.hold_until_date)
                  : h.hold_type === 'days' ? new Date(new Date(h.buy_date).getTime() + Number(h.hold_days) * 86400000)
                  : null;
                const holdProgressPct = holdUntil
                  ? Math.max(0, Math.min(100, ((Date.now() - new Date(h.buy_date).getTime()) / (holdUntil.getTime() - new Date(h.buy_date).getTime())) * 100))
                  : null;

                return (
                  <div key={h.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{h.symbol}</h4>
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">{h.broker}</span>
                        {h.holding_type === 'mutual_fund' ? (
                          <span className="text-[8px] font-bold px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-full">MF</span>
                        ) : (
                          <span className="text-[8px] text-slate-400">{h.exchange}</span>
                        )}
                        {h.source && <span className="text-[8px] font-bold px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full">{h.source}</span>}
                      </div>
                      <p className="text-[9px] text-slate-400 mt-0.5">{h.quantity} {h.holding_type === 'mutual_fund' ? 'units' : 'shares'} @ ₹{h.buy_price} · bought {h.buy_date}</p>
                      {targetPrice && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500" style={{ width: `${targetProgressPct}%` }} />
                          </div>
                          <span className="text-[8px] text-slate-400">Target ₹{targetPrice.toFixed(2)} · {targetProgressPct!.toFixed(0)}% there</span>
                        </div>
                      )}
                      {holdUntil && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${holdProgressPct}%` }} />
                          </div>
                          <span className="text-[8px] text-slate-400">Hold until {holdUntil.toISOString().slice(0, 10)} · {holdProgressPct!.toFixed(0)}% through</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {priceEdits[h.id] !== undefined ? (
                        <div className="flex items-center gap-1">
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
                        <button
                          onClick={() => setPriceEdits(prev => ({ ...prev, [h.id]: String(h.current_price ?? h.buy_price) }))}
                          className="text-right cursor-pointer"
                          title="Update current price"
                        >
                          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">₹{Number(h.current_price ?? h.buy_price).toLocaleString()} <RefreshCw className="w-2.5 h-2.5 text-slate-400" /></span>
                          <span className={`text-[9px] font-bold ${gain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{gain >= 0 ? '+' : ''}{fmt(gain)} ({gainPct.toFixed(1)}%)</span>
                        </button>
                      )}
                      {!isReadOnly && (sellingId === h.id ? (
                        <div className="flex items-center gap-1">
                          <input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="Sell price" className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[11px]" />
                          <button onClick={confirmSell} className="p-1 bg-rose-500 text-white rounded-md cursor-pointer"><CheckCircle2 className="w-3 h-3" /></button>
                          <button onClick={() => setSellingId(null)} className="p-1 text-slate-400 cursor-pointer"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setSellingId(h.id); setSellPrice(String(h.current_price ?? h.buy_price)); }} className="px-2 py-1 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase rounded-md cursor-pointer">Sell</button>
                      ))}
                      {!isReadOnly && (
                        <button onClick={() => runAction(() => deletePortfolioHolding(h.id))} className="p-1 text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {soldHoldings.length > 0 && (
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sold ({soldHoldings.length})</span>
              <div className="apple-card divide-y divide-slate-100 dark:divide-slate-900 mt-1.5 overflow-hidden opacity-75">
                {soldHoldings.map(h => {
                  const gain = (Number(h.sold_price) - Number(h.buy_price)) * Number(h.quantity);
                  return (
                    <div key={h.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">{h.symbol} <span className="text-[8px] text-slate-400 uppercase">{h.broker}</span></h4>
                        <p className="text-[9px] text-slate-400">{h.quantity} @ ₹{h.buy_price} → ₹{h.sold_price} on {h.sold_date}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-bold ${gain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{gain >= 0 ? '+' : ''}{fmt(gain)}</span>
                        {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioHolding(h.id))} className="p-1 text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTRIBUTIONS & SPLIT TAB */}
      {tab === 'contributions' && (
        <div className="space-y-4">
          <div className="apple-card p-4 space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Split Among Workspace Members</span>
            <p className="text-[9px] text-slate-400">Everyone here is a member of this workspace. To add someone new, invite them via Family Sharing first.</p>
            <div className="space-y-1.5">
              {currentSplits.map(({ member, percent }) => (
                <div key={member.uid} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{memberName(member)}</span>
                  <span className="font-black text-slate-900 dark:text-white">{percent}%</span>
                </div>
              ))}
            </div>

            {!isReadOnly && (
            <>
            <button onClick={() => setIsAddingSplit(!isAddingSplit)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Set Split for a Period</button>
            {isAddingSplit && (
              <form
                onSubmit={async (e) => { e.preventDefault(); if (!splitMemberId || !splitPercent) return; await runAction(async () => { await addPortfolioSplit(splitMemberId, parseFloat(splitPercent), splitFrom, splitTo || undefined); setSplitPercent(''); setIsAddingSplit(false); }); }}
                className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-900"
              >
                <select value={splitMemberId} onChange={(e) => setSplitMemberId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                  <option value="">Select person</option>
                  {workspaceMembers.map(m => <option key={m.uid} value={m.uid}>{memberName(m)}</option>)}
                </select>
                <input type="number" value={splitPercent} onChange={(e) => setSplitPercent(e.target.value)} placeholder="% e.g. 50" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <input type="date" value={splitFrom} onChange={(e) => setSplitFrom(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <input type="date" value={splitTo} onChange={(e) => setSplitTo(e.target.value)} placeholder="End (optional)" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <button type="submit" className="col-span-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Save Split</button>
              </form>
            )}
            </>
            )}
            {portfolioSplits.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-900 space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Split History</span>
                {portfolioSplits.map(s => {
                  const m = workspaceMembers.find(x => x.uid === s.member_user_id);
                  return (
                    <div key={s.id} className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{m ? memberName(m) : 'Former member'} — {s.split_percent}% ({s.effective_from} → {s.effective_to || 'ongoing'})</span>
                      {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioSplit(s.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="apple-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Contribution Log</span>
              {!isReadOnly && <button onClick={() => setIsAddingContribution(!isAddingContribution)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Log Contribution</button>}
            </div>
            {isAddingContribution && (
              <form onSubmit={handleAddContribution} className="grid grid-cols-3 gap-2">
                <select value={cMemberId} onChange={(e) => setCMemberId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                  <option value="">Who</option>
                  {workspaceMembers.map(m => <option key={m.uid} value={m.uid}>{memberName(m)}</option>)}
                </select>
                <input type="number" value={cAmount} onChange={(e) => setCAmount(e.target.value)} placeholder="Amount" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <button type="submit" className="col-span-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Add</button>
              </form>
            )}
            <div className="divide-y divide-slate-100 dark:divide-slate-900">
              {portfolioContributions.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">No contributions logged yet.</p>
              ) : portfolioContributions.map(c => {
                const m = workspaceMembers.find(x => x.uid === c.member_user_id);
                return (
                  <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">{m ? memberName(m) : 'Former member'} · {c.contribution_date}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{fmt(Number(c.amount))}</span>
                      {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioContribution(c.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* INVESTMENT PLAN TAB */}
      {tab === 'plan' && (
        <div className="space-y-4">
          <div className="apple-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Recurring Contribution Plan</span>
              {!isReadOnly && <button onClick={() => setIsAddingPlan(!isAddingPlan)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Add Plan</button>}
            </div>
            <p className="text-[10px] text-slate-400">What each person is expected to contribute on a schedule — separate from your Bills, and separate from the actual amounts logged in Contributions.</p>

            {isAddingPlan && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!planMemberId || !planAmount) return;
                  await runAction(async () => {
                    await addPortfolioRecurringPlan(planMemberId, parseFloat(planAmount), planFrequency, planStartDate, planFrequency === 'monthly' ? parseInt(planDayOfMonth) : undefined);
                    setPlanAmount(''); setIsAddingPlan(false);
                  });
                }}
                className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-900"
              >
                <select value={planMemberId} onChange={(e) => setPlanMemberId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                  <option value="">Who</option>
                  {workspaceMembers.map(m => <option key={m.uid} value={m.uid}>{memberName(m)}</option>)}
                </select>
                <input type="number" value={planAmount} onChange={(e) => setPlanAmount(e.target.value)} placeholder="Amount" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <select value={planFrequency} onChange={(e) => setPlanFrequency(e.target.value as any)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
                {planFrequency === 'monthly' && (
                  <input type="number" min="1" max="31" value={planDayOfMonth} onChange={(e) => setPlanDayOfMonth(e.target.value)} placeholder="Day of month" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                )}
                <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs col-span-2" />
                <button type="submit" className="col-span-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Save Plan</button>
              </form>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-900">
              {portfolioRecurringPlans.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">No recurring plan set up yet.</p>
              ) : portfolioRecurringPlans.map(plan => {
                const m = workspaceMembers.find(x => x.uid === plan.member_user_id);
                return (
                  <div key={plan.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{m ? memberName(m) : 'Former member'}</p>
                      <p className="text-[10px] text-slate-400">{fmt(Number(plan.expected_amount))} · {plan.frequency}{plan.day_of_month ? ` on day ${plan.day_of_month}` : ''} · from {plan.start_date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isReadOnly && (
                        <button
                          onClick={() => runAction(() => updatePortfolioRecurringPlan(plan.id, { active: !plan.active }))}
                          className={`px-2 py-1 text-[9px] font-black uppercase rounded-full cursor-pointer ${plan.active ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                        >
                          {plan.active ? 'Active' : 'Paused'}
                        </button>
                      )}
                      {!isReadOnly && <button onClick={() => runAction(() => deletePortfolioRecurringPlan(plan.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STATEMENT TAB */}
      {tab === 'statement' && (
        <div className="space-y-4">
          {activeHoldings.some(h => h.target_type) && (
            <div className="apple-card p-4 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Target Progress</span>
              {activeHoldings.filter(h => h.target_type).map(h => {
                const targetPrice = h.target_type === 'price' ? Number(h.target_price) : Number(h.buy_price) * (1 + Number(h.target_percent) / 100);
                const progress = Math.max(0, Math.min(100, ((Number(h.current_price ?? h.buy_price) - Number(h.buy_price)) / (targetPrice - Number(h.buy_price))) * 100));
                return (
                  <div key={h.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{h.symbol} {h.source && <span className="text-[9px] text-slate-400">· {h.source}</span>}</span>
                      <span className="text-slate-500">₹{Number(h.current_price ?? h.buy_price).toFixed(2)} → ₹{targetPrice.toFixed(2)} target</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="apple-card p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Total Contributed (cash in)</span><span className="font-bold text-slate-900 dark:text-white">{fmt(totalContributed)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total Investment (cost basis, active + sold)</span><span className="font-bold text-slate-900 dark:text-white">{fmt(totalInvestedAllTime)}</span></div>
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
              const shareOfGain = netGain * (percent / 100);
              return (
                <div key={member.uid} className="flex items-center justify-between text-xs py-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{memberName(member)} ({percent}%)</span>
                  <span className="text-slate-500">Contributed {fmt(contributed)} · Share of gain <span className={shareOfGain >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{fmt(shareOfGain)}</span></span>
                </div>
              );
            })}
            <p className="text-[9px] text-slate-400 pt-1">Gain split uses today's active percentage — historical contributions are tracked exactly per person above, in the Contributions tab.</p>
          </div>

          <div className="apple-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" /> Dividends</span>
              {!isReadOnly && <QuickAddDividend onAdd={addPortfolioDividend} />}
            </div>
            {portfolioDividends.length === 0 ? <p className="text-[11px] text-slate-400">None recorded.</p> : portfolioDividends.map(d => (
              <div key={d.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">{d.symbol} · {d.dividend_date}</span>
                <div className="flex items-center gap-2"><span className="font-bold text-emerald-600">+{fmt(Number(d.amount))}</span>{!isReadOnly && <button onClick={() => runAction(() => deletePortfolioDividend(d.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}</div>
              </div>
            ))}
          </div>

          <div className="apple-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> AMC & Fees</span>
              {!isReadOnly && <QuickAddFee onAdd={addPortfolioFee} />}
            </div>
            {portfolioFees.length === 0 ? <p className="text-[11px] text-slate-400">None recorded.</p> : portfolioFees.map(f => (
              <div key={f.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">{f.broker} · {f.fee_type} · {f.fee_date}</span>
                <div className="flex items-center gap-2"><span className="font-bold text-rose-500">-{fmt(Number(f.amount))}</span>{!isReadOnly && <button onClick={() => runAction(() => deletePortfolioFee(f.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>}</div>
              </div>
            ))}
          </div>
        </div>
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
