import React, { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Plus, Trash2, RefreshCw, Users, Wallet,
  CheckCircle2, X, ChevronDown, Briefcase, Gift, Receipt
} from 'lucide-react';

interface PortfolioViewProps {
  portfolios: any[];
  activePortfolioId: string | null;
  switchPortfolio: (id: string) => void;
  createPortfolio: (name: string) => Promise<any>;
  portfolioContributors: any[];
  addPortfolioContributor: (name: string, linkedUserId?: string) => Promise<void>;
  deletePortfolioContributor: (id: string) => Promise<void>;
  findUserByEmail: (email: string) => Promise<{ id: string; email: string; display_name: string } | null>;
  portfolioSplits: any[];
  addPortfolioSplit: (contributorId: string, percent: number, from: string, to?: string) => Promise<void>;
  deletePortfolioSplit: (id: string) => Promise<void>;
  portfolioHoldings: any[];
  addPortfolioHolding: (h: {
    broker: string; symbol: string; exchange: string; quantity: number; buyPrice: number; buyDate: string; notes?: string;
    source?: string;
    targetType?: 'price' | 'percent'; targetPrice?: number; targetPercent?: number;
    holdType?: 'days' | 'date'; holdDays?: number; holdUntilDate?: string;
  }) => Promise<void>;
  updatePortfolioHolding: (id: string, updates: any) => Promise<void>;
  deletePortfolioHolding: (id: string) => Promise<void>;
  portfolioContributions: any[];
  addPortfolioContribution: (contributorId: string, amount: number, date: string, notes?: string) => Promise<void>;
  deletePortfolioContribution: (id: string) => Promise<void>;
  portfolioDividends: any[];
  addPortfolioDividend: (symbol: string, amount: number, date: string, holdingId?: string, notes?: string) => Promise<void>;
  deletePortfolioDividend: (id: string) => Promise<void>;
  portfolioFees: any[];
  addPortfolioFee: (broker: string, feeType: string, amount: number, date: string, notes?: string) => Promise<void>;
  deletePortfolioFee: (id: string) => Promise<void>;
  portfolioRecurringPlans: any[];
  addPortfolioRecurringPlan: (contributorId: string, amount: number, frequency: 'monthly' | 'quarterly' | 'yearly', startDate: string, dayOfMonth?: number) => Promise<void>;
  updatePortfolioRecurringPlan: (id: string, updates: { active?: boolean; expectedAmount?: number }) => Promise<void>;
  deletePortfolioRecurringPlan: (id: string) => Promise<void>;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function PortfolioView(props: PortfolioViewProps) {
  const {
    portfolios, activePortfolioId, switchPortfolio, createPortfolio,
    portfolioContributors, addPortfolioContributor, deletePortfolioContributor, findUserByEmail,
    portfolioSplits, addPortfolioSplit, deletePortfolioSplit,
    portfolioHoldings, addPortfolioHolding, updatePortfolioHolding, deletePortfolioHolding,
    portfolioContributions, addPortfolioContribution, deletePortfolioContribution,
    portfolioDividends, addPortfolioDividend, deletePortfolioDividend,
    portfolioFees, addPortfolioFee, deletePortfolioFee,
    portfolioRecurringPlans, addPortfolioRecurringPlan, updatePortfolioRecurringPlan, deletePortfolioRecurringPlan,
  } = props;

  const [tab, setTab] = useState<'holdings' | 'contributions' | 'plan' | 'statement'>('holdings');
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(portfolios.length === 0);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Wrap any async action so failures always surface instead of failing silently.
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
      const symbols = activeHoldings.map(h => ({ symbol: h.symbol, exchange: h.exchange }));
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
        broker: hBroker, symbol: hSymbol, exchange: hExchange, quantity: parseFloat(hQty), buyPrice: parseFloat(hPrice), buyDate: hDate,
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
  const [cContributorId, setCContributorId] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [cDate, setCDate] = useState(todayStr());
  const [isAddingContributor, setIsAddingContributor] = useState(false);
  const [contributorMode, setContributorMode] = useState<'name' | 'existing'>('name');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<{ id: string; email: string; display_name: string } | 'not_found' | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [newContributorName, setNewContributorName] = useState('');
  const [isAddingSplit, setIsAddingSplit] = useState(false);
  const [splitContributorId, setSplitContributorId] = useState('');
  const [splitPercent, setSplitPercent] = useState('');
  const [splitFrom, setSplitFrom] = useState(todayStr());
  const [splitTo, setSplitTo] = useState('');

  // ---- Investment Plan (recurring expectation, separate from actual contribution log) ----
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [planContributorId, setPlanContributorId] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planFrequency, setPlanFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [planStartDate, setPlanStartDate] = useState(todayStr());
  const [planDayOfMonth, setPlanDayOfMonth] = useState('1');

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cContributorId || !cAmount) return;
    await runAction(async () => {
      await addPortfolioContribution(cContributorId, parseFloat(cAmount), cDate);
      setCAmount(''); setIsAddingContribution(false);
    });
  };

  const currentSplits = useMemo(() => {
    const today = todayStr();
    return portfolioContributors.map(c => {
      const active = portfolioSplits.find(s => s.contributor_id === c.id && s.effective_from <= today && (!s.effective_to || s.effective_to >= today));
      return { contributor: c, percent: active?.split_percent ?? 0 };
    });
  }, [portfolioContributors, portfolioSplits]);

  // ---- Statement calculations ----
  const totalContributed = portfolioContributions.reduce((s, c) => s + Number(c.amount), 0);
  const totalInvestedActive = activeHoldings.reduce((s, h) => s + Number(h.buy_price) * Number(h.quantity), 0);
  const currentValueActive = activeHoldings.reduce((s, h) => s + Number(h.current_price ?? h.buy_price) * Number(h.quantity), 0);
  const unrealizedGain = currentValueActive - totalInvestedActive;
  const realizedGain = soldHoldings.reduce((s, h) => s + (Number(h.sold_price) - Number(h.buy_price)) * Number(h.quantity), 0);
  const totalDividends = portfolioDividends.reduce((s, d) => s + Number(d.amount), 0);
  const totalFees = portfolioFees.reduce((s, f) => s + Number(f.amount), 0);
  const netGain = unrealizedGain + realizedGain + totalDividends - totalFees;

  if (portfolios.length === 0 || isCreatingPortfolio) {
    return (
      <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-5 text-left select-none bg-slate-50 dark:bg-slate-900">
        <div className="apple-card p-8 flex flex-col items-center text-center gap-3 max-w-sm mx-auto mt-10">
          <Briefcase className="w-10 h-10 text-indigo-500" />
          <h2 className="text-sm font-black text-slate-900 dark:text-white">Create Your Portfolio</h2>
          <p className="text-xs text-slate-400">Track stocks, contributions, and gains — split however you and your co-investor agree, and it can change over time.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newPortfolioName.trim()) return;
              setCreatingBusy(true);
              setFormError(null);
              try {
                await createPortfolio(newPortfolioName.trim());
                setNewPortfolioName('');
                setIsCreatingPortfolio(false);
              } catch (err: any) {
                console.error('Create portfolio failed:', err);
                setFormError(err?.message || 'Could not create the portfolio. Please try again.');
              } finally {
                setCreatingBusy(false);
              }
            }}
            className="w-full space-y-2 mt-2"
          >
            <input
              autoFocus
              type="text"
              value={newPortfolioName}
              onChange={(e) => setNewPortfolioName(e.target.value)}
              placeholder="Portfolio name, e.g. Me & Arjun"
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
            />
            {formError && (
              <p className="text-[11px] text-rose-500 font-semibold bg-rose-50 dark:bg-rose-950/20 px-3 py-2 rounded-lg">{formError}</p>
            )}
            <button type="submit" disabled={creatingBusy} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer">
              {creatingBusy ? 'Creating…' : 'Create Portfolio'}
            </button>
            {portfolios.length > 0 && (
              <button type="button" onClick={() => { setIsCreatingPortfolio(false); setFormError(null); }} className="w-full text-[10px] text-slate-400 underline cursor-pointer">Cancel</button>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-5 text-left select-none bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <div className="relative">
            <select
              value={activePortfolioId || ''}
              onChange={(e) => switchPortfolio(e.target.value)}
              className="appearance-none bg-transparent text-lg font-bold text-slate-900 dark:text-white pr-6 cursor-pointer outline-none"
            >
              {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <button onClick={() => setIsCreatingPortfolio(true)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer flex items-center gap-1">
          <Plus className="w-3 h-3" /> New Portfolio
        </button>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center justify-between gap-2">
          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{formError}</span>
          <button onClick={() => setFormError(null)} className="text-rose-400 hover:text-rose-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Headline stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Contributed</span>
          <span className="text-base font-black text-slate-900 dark:text-white">{fmt(totalContributed)}</span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Current Holdings Value</span>
          <span className="text-base font-black text-slate-900 dark:text-white">{fmt(currentValueActive)}</span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Unrealized Gain</span>
          <span className={`text-base font-black flex items-center gap-1 ${unrealizedGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            {unrealizedGain >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {fmt(Math.abs(unrealizedGain))}
          </span>
        </div>
        <div className="apple-card p-4">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Net Gain (all-in)</span>
          <span className={`text-base font-black ${netGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{fmt(netGain)}</span>
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
              <Plus className="w-3.5 h-3.5" /> Add Stock
            </button>
          </div>
          {priceRefreshSummary && (
            <p className="text-[10px] text-slate-400 -mt-2">{priceRefreshSummary}</p>
          )}

          {isAddingHolding && (
            <form onSubmit={handleAddHolding} className="apple-card p-4 space-y-2.5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                <select value={hBroker} onChange={(e) => setHBroker(e.target.value as any)} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                  <option>Zerodha</option><option>Groww</option><option>Other</option>
                </select>
                <select value={hExchange} onChange={(e) => setHExchange(e.target.value as any)} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                  <option>NSE</option><option>BSE</option>
                </select>
                <input type="text" value={hSymbol} onChange={(e) => setHSymbol(e.target.value)} placeholder="Symbol e.g. TCS" className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <input type="number" value={hQty} onChange={(e) => setHQty(e.target.value)} placeholder="Quantity" className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <input type="number" value={hPrice} onChange={(e) => setHPrice(e.target.value)} placeholder="Buy price/share" className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
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
                        <span className="text-[8px] text-slate-400">{h.exchange}</span>
                        {h.source && <span className="text-[8px] font-bold px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full">{h.source}</span>}
                      </div>
                      <p className="text-[9px] text-slate-400 mt-0.5">{h.quantity} shares @ ₹{h.buy_price} · bought {h.buy_date}</p>
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
                      {sellingId === h.id ? (
                        <div className="flex items-center gap-1">
                          <input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="Sell price" className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[11px]" />
                          <button onClick={confirmSell} className="p-1 bg-rose-500 text-white rounded-md cursor-pointer"><CheckCircle2 className="w-3 h-3" /></button>
                          <button onClick={() => setSellingId(null)} className="p-1 text-slate-400 cursor-pointer"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setSellingId(h.id); setSellPrice(String(h.current_price ?? h.buy_price)); }} className="px-2 py-1 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase rounded-md cursor-pointer">Sell</button>
                      )}
                      <button onClick={() => runAction(() => deletePortfolioHolding(h.id))} className="p-1 text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
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
                        <button onClick={() => runAction(() => deletePortfolioHolding(h.id))} className="p-1 text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
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
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Contributors & Current Split</span>
              <button onClick={() => setIsAddingContributor(!isAddingContributor)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Add Person</button>
            </div>
            {isAddingContributor && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => { setContributorMode('name'); setLookupResult(null); }} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${contributorMode === 'name' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Name Only</button>
                  <button type="button" onClick={() => setContributorMode('existing')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${contributorMode === 'existing' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Existing App User</button>
                </div>

                {contributorMode === 'name' ? (
                  <form onSubmit={async (e) => { e.preventDefault(); if (!newContributorName.trim()) return; await runAction(async () => { await addPortfolioContributor(newContributorName.trim()); setNewContributorName(''); setIsAddingContributor(false); }); }} className="flex gap-2">
                    <input autoFocus type="text" value={newContributorName} onChange={(e) => setNewContributorName(e.target.value)} placeholder="Name (doesn't need an account)" className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                    <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Add</button>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type="email"
                        value={lookupEmail}
                        onChange={(e) => { setLookupEmail(e.target.value); setLookupResult(null); }}
                        placeholder="Their Haven Vault email"
                        className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        disabled={lookupBusy || !lookupEmail.trim()}
                        onClick={async () => {
                          setLookupBusy(true);
                          await runAction(async () => {
                            const found = await findUserByEmail(lookupEmail.trim());
                            setLookupResult(found || 'not_found');
                          });
                          setLookupBusy(false);
                        }}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        {lookupBusy ? '...' : 'Find'}
                      </button>
                    </div>
                    {lookupResult === 'not_found' && (
                      <p className="text-[10px] text-amber-600">No Haven Vault account with that email. Use "Name Only" instead, or ask them to sign up first.</p>
                    )}
                    {lookupResult && lookupResult !== 'not_found' && (
                      <div className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{lookupResult.display_name || lookupResult.email}</span>
                        <button
                          onClick={async () => { await runAction(async () => { await addPortfolioContributor(lookupResult.display_name || lookupResult.email, lookupResult.id); setLookupEmail(''); setLookupResult(null); setIsAddingContributor(false); }); }}
                          className="px-2.5 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-md cursor-pointer"
                        >
                          Add as Contributor
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              {currentSplits.map(({ contributor, percent }) => (
                <div key={contributor.id} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{contributor.display_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white">{percent}%</span>
                    <button onClick={() => runAction(() => deletePortfolioContributor(contributor.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setIsAddingSplit(!isAddingSplit)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Set Split for a Period</button>
            {isAddingSplit && (
              <form
                onSubmit={async (e) => { e.preventDefault(); if (!splitContributorId || !splitPercent) return; await runAction(async () => { await addPortfolioSplit(splitContributorId, parseFloat(splitPercent), splitFrom, splitTo || undefined); setSplitPercent(''); setIsAddingSplit(false); }); }}
                className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-900"
              >
                <select value={splitContributorId} onChange={(e) => setSplitContributorId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                  <option value="">Select person</option>
                  {portfolioContributors.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                </select>
                <input type="number" value={splitPercent} onChange={(e) => setSplitPercent(e.target.value)} placeholder="% e.g. 50" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <input type="date" value={splitFrom} onChange={(e) => setSplitFrom(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <input type="date" value={splitTo} onChange={(e) => setSplitTo(e.target.value)} placeholder="End (optional)" className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" />
                <button type="submit" className="col-span-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer">Save Split</button>
              </form>
            )}
            {portfolioSplits.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-900 space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Split History</span>
                {portfolioSplits.map(s => {
                  const c = portfolioContributors.find(x => x.id === s.contributor_id);
                  return (
                    <div key={s.id} className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{c?.display_name} — {s.split_percent}% ({s.effective_from} → {s.effective_to || 'ongoing'})</span>
                      <button onClick={() => runAction(() => deletePortfolioSplit(s.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="apple-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Contribution Log</span>
              <button onClick={() => setIsAddingContribution(!isAddingContribution)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Log Contribution</button>
            </div>
            {isAddingContribution && (
              <form onSubmit={handleAddContribution} className="grid grid-cols-3 gap-2">
                <select value={cContributorId} onChange={(e) => setCContributorId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                  <option value="">Who</option>
                  {portfolioContributors.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
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
                const person = portfolioContributors.find(x => x.id === c.contributor_id);
                return (
                  <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">{person?.display_name} · {c.contribution_date}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{fmt(Number(c.amount))}</span>
                      <button onClick={() => runAction(() => deletePortfolioContribution(c.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
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
              <button onClick={() => setIsAddingPlan(!isAddingPlan)} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">+ Add Plan</button>
            </div>
            <p className="text-[10px] text-slate-400">What each person is expected to contribute on a schedule — separate from your Bills, and separate from the actual amounts logged in Contributions.</p>

            {isAddingPlan && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!planContributorId || !planAmount) return;
                  await runAction(async () => {
                    await addPortfolioRecurringPlan(planContributorId, parseFloat(planAmount), planFrequency, planStartDate, planFrequency === 'monthly' ? parseInt(planDayOfMonth) : undefined);
                    setPlanAmount(''); setIsAddingPlan(false);
                  });
                }}
                className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-900"
              >
                <select value={planContributorId} onChange={(e) => setPlanContributorId(e.target.value)} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                  <option value="">Who</option>
                  {portfolioContributors.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
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
                const person = portfolioContributors.find(c => c.id === plan.contributor_id);
                return (
                  <div key={plan.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{person?.display_name}</p>
                      <p className="text-[10px] text-slate-400">{fmt(Number(plan.expected_amount))} · {plan.frequency}{plan.day_of_month ? ` on day ${plan.day_of_month}` : ''} · from {plan.start_date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => runAction(() => updatePortfolioRecurringPlan(plan.id, { active: !plan.active }))}
                        className={`px-2 py-1 text-[9px] font-black uppercase rounded-full cursor-pointer ${plan.active ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                      >
                        {plan.active ? 'Active' : 'Paused'}
                      </button>
                      <button onClick={() => runAction(() => deletePortfolioRecurringPlan(plan.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
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
            <div className="flex justify-between"><span className="text-slate-500">Total Contributed</span><span className="font-bold text-slate-900 dark:text-white">{fmt(totalContributed)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Deployed in Active Holdings</span><span className="font-bold text-slate-900 dark:text-white">{fmt(totalInvestedActive)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Current Value of Active Holdings</span><span className="font-bold text-slate-900 dark:text-white">{fmt(currentValueActive)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Unrealized Gain/Loss</span><span className={`font-bold ${unrealizedGain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{fmt(unrealizedGain)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Realized Gain/Loss (sold)</span><span className={`font-bold ${realizedGain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{fmt(realizedGain)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Dividends Received</span><span className="font-bold text-emerald-600">+{fmt(totalDividends)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Fees Paid (AMC etc)</span><span className="font-bold text-rose-500">-{fmt(totalFees)}</span></div>
            <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-900 text-sm">
              <span className="font-black text-slate-900 dark:text-white">Net Gain (all-in)</span>
              <span className={`font-black ${netGain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{fmt(netGain)}</span>
            </div>
          </div>

          <div className="apple-card p-4 space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Per-Person Share (based on today's split)</span>
            {currentSplits.map(({ contributor, percent }) => {
              const contributed = portfolioContributions.filter(c => c.contributor_id === contributor.id).reduce((s, c) => s + Number(c.amount), 0);
              const shareOfGain = netGain * (percent / 100);
              return (
                <div key={contributor.id} className="flex items-center justify-between text-xs py-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{contributor.display_name} ({percent}%)</span>
                  <span className="text-slate-500">Contributed {fmt(contributed)} · Share of gain <span className={shareOfGain >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{fmt(shareOfGain)}</span></span>
                </div>
              );
            })}
            <p className="text-[9px] text-slate-400 pt-1">Gain split uses today's active percentage — historical contributions are tracked exactly per person above, in the Contributions tab.</p>
          </div>

          <div className="apple-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" /> Dividends</span>
              <QuickAddDividend onAdd={addPortfolioDividend} />
            </div>
            {portfolioDividends.length === 0 ? <p className="text-[11px] text-slate-400">None recorded.</p> : portfolioDividends.map(d => (
              <div key={d.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">{d.symbol} · {d.dividend_date}</span>
                <div className="flex items-center gap-2"><span className="font-bold text-emerald-600">+{fmt(Number(d.amount))}</span><button onClick={() => runAction(() => deletePortfolioDividend(d.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button></div>
              </div>
            ))}
          </div>

          <div className="apple-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> AMC & Fees</span>
              <QuickAddFee onAdd={addPortfolioFee} />
            </div>
            {portfolioFees.length === 0 ? <p className="text-[11px] text-slate-400">None recorded.</p> : portfolioFees.map(f => (
              <div key={f.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">{f.broker} · {f.fee_type} · {f.fee_date}</span>
                <div className="flex items-center gap-2"><span className="font-bold text-rose-500">-{fmt(Number(f.amount))}</span><button onClick={() => runAction(() => deletePortfolioFee(f.id))} className="text-slate-300 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button></div>
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
