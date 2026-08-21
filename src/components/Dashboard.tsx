import React, { useState } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Globe, 
  AlertCircle, 
  TrendingDown, 
  Bell,
  HelpCircle,
  Sparkles,
  User,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Wallet,
  ArrowDown,
  ArrowUp
} from 'lucide-react';
import { RecurringPayment, PaymentHistory, Currency, CountryConfig, CATEGORY_COLORS, getCategoryColor, ScheduledInstance, IncomeSource, GiftCard, RewardPerk, giftCardStatus } from '../types';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  getPaymentsDueNextWeek, 
  getPaymentsDueCurrentMonth, 
  getPaymentsDueNextMonth, 
  getDaysUntilPayment, 
  getNextPaymentDate,
  formatDaysRemaining, 
  formatDatePretty,
  convertCurrency,
  formatCurrencyValue,
  getScheduledInstancesForRange
} from '../utils/paymentUtils';

interface DashboardProps {
  payments: RecurringPayment[];
  history: PaymentHistory[];
  countries: CountryConfig[];
  summaryCurrency: Currency;
  onRecordPayment: (payment: RecurringPayment, dueDate?: string) => void;
  onNavigateToBills?: () => void;
  onNavigateToTab?: (tab: string) => void;
  isReadOnly?: boolean;
  currentUserUid?: string;
  monthlyIncomeEstimate?: number;
  incomeSources?: IncomeSource[];
  portfolioHoldings?: any[];
  portfolios?: any[];
  workspaceCurrencyRates?: any;
  baseCurrency?: string;
  giftCards?: GiftCard[];
  rewardsPerks?: RewardPerk[];
}

// Simple initials extraction helper
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function Dashboard({
  payments,
  history,
  countries = [],
  summaryCurrency,
  onRecordPayment,
  onNavigateToBills,
  onNavigateToTab,
  isReadOnly = false,
  currentUserUid,
  monthlyIncomeEstimate = 0,
  incomeSources = [],
  portfolioHoldings = [],
  portfolios = [],
  workspaceCurrencyRates,
  baseCurrency,
  giftCards = [],
  rewardsPerks = []
}: DashboardProps) {
  const isPaymentReadOnly = (payment?: RecurringPayment) => {
    if (!payment) return true;
    if (!isReadOnly) return false;
    if (currentUserUid && payment.userId === currentUserUid) return false;
    return true;
  };

  const activePayments = payments.filter(p => p.active);

  // Generate scheduled instances for the current month and next month
  const now = new Date();
  
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  // Get all instances for current and next month (and overdue from past month)
  const startOfOverdue = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const allUpcomingInstances = getScheduledInstancesForRange(payments, history, startOfOverdue, endOfNextMonth);
  
  const currentMonthInstances = getScheduledInstancesForRange(payments, history, startOfCurrentMonth, endOfCurrentMonth);
  const nextMonthInstances = getScheduledInstancesForRange(payments, history, startOfNextMonth, endOfNextMonth);

  // Redefine dueNextWeek using scheduled instances in the next 7 days
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nextWeekDate = new Date();
  nextWeekDate.setDate(now.getDate() + 7);
  const nextWeekStr = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;

  const dueNextWeek = allUpcomingInstances.filter(ins => {
    return ins.status !== 'paid' && ins.dueDate >= todayStr && ins.dueDate <= nextWeekStr;
  });

  const totalDueNextWeekConverted = dueNextWeek.reduce((sum, ins) => {
    const converted = convertCurrency(ins.amount, ins.currency, summaryCurrency, countries);
    return sum + converted;
  }, 0);

  // Redefine dueCurrentMonth as outstanding instances this month
  const dueCurrentMonth = currentMonthInstances.filter(ins => ins.status !== 'paid');

  // What actually makes up "this month's bills" total, biggest first
  const billsBreakdown = [...dueCurrentMonth]
    .sort((a, b) => convertCurrency(b.amount, b.currency, summaryCurrency, countries) - convertCurrency(a.amount, a.currency, summaryCurrency, countries));

  const totalDueCurrentMonthConverted = dueCurrentMonth.reduce((sum, ins) => {
    const converted = convertCurrency(ins.amount, ins.currency, summaryCurrency, countries);
    return sum + converted;
  }, 0);

  // Paid so far in current month
  const paidThisMonthConverted = currentMonthInstances
    .filter(ins => ins.status === 'paid')
    .reduce((sum, ins) => {
      const converted = convertCurrency(ins.amount, ins.currency, summaryCurrency, countries);
      return sum + converted;
    }, 0);

  // Total Forecasted Amount for next month
  const totalForecastedNextMonthConverted = nextMonthInstances.reduce((sum, ins) => {
    const converted = convertCurrency(ins.amount, ins.currency, summaryCurrency, countries);
    return sum + converted;
  }, 0);

  // Portfolio overview card - same convertAmount logic as PortfolioV1View.tsx (a separate
  // file, not exported/shared - duplicated here rather than a bigger shared-utility refactor
  // for one small function), and the same tiny-price safeguard (a price below $0.01 is
  // almost never real - a broken/sanctioned-stock feed, not a genuine market move).
  const convertToSummaryCcy = (amount: number, fromCcy: string): number => {
    if (!Number.isFinite(amount)) return 0;
    const from = String(fromCcy || baseCurrency || 'USD').toUpperCase();
    const to = String(summaryCurrency || baseCurrency || 'USD').toUpperCase();
    const base = String(baseCurrency || 'INR').toUpperCase();
    if (from === to) return amount;
    const rateOf = (ccy: string) => {
      if (ccy === base) return 1;
      const r = (workspaceCurrencyRates || []).find((x: any) => String(x.currency || '').toUpperCase() === ccy);
      const v = Number(r?.rate_to_base);
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    const fromRate = rateOf(from);
    const toRate = rateOf(to);
    if (fromRate == null || toRate == null) return amount;
    return (amount * fromRate) / toRate;
  };
  const portfolioNameById = new Map((portfolios || []).map((p: any) => [p.id, p.name]));
  const activeHoldings = (portfolioHoldings || []).filter((h: any) => (h.status || 'active') === 'active');
  const PRICE_FLOOR = 0.01;
  let portfolioTotalValue = 0;
  let portfolioTotalPnl = 0;
  let portfolioTotalDayChange = 0;
  const portfolioByBroker = new Map<string, { value: number; pnl: number }>();
  const portfolioByName = new Map<string, { value: number; pnl: number; dayChange: number }>();
  for (const h of activeHoldings) {
    const buy = Number(h.buy_price) || 0;
    const live = Number(h.live_price ?? h.current_price ?? h.buy_price) || 0;
    const leverage = Number(h.leverage) || 1;
    const looksUnreliable = buy < PRICE_FLOOR || live < PRICE_FLOOR;
    let value: number;
    let pnl: number;
    if (leverage > 1 && h.etoro_net_value_amount != null) {
      // Leveraged/CFD holding - real cash committed, not full exposure (same distinction
      // established throughout this session's portfolio work).
      value = Number(h.etoro_net_value_amount) || 0;
      pnl = looksUnreliable ? 0 : value - (Number(h.buy_price) * Number(h.quantity)) / leverage;
    } else {
      const qty = Number(h.quantity) || 0;
      value = live * qty;
      pnl = looksUnreliable ? 0 : (live - buy) * qty;
    }
    // Today's change - same previous_close approach as the Agent's daily digest
    // (buildLocalDailyDigest, AgentAssistant.tsx), reusing the same data rather than a
    // separate pipeline. Same tiny-price safeguard applied here too.
    const prevClose = Number(h.previous_close);
    const qtyForDay = Number(h.quantity) || 0;
    const dayChange = !looksUnreliable && Number.isFinite(prevClose) && prevClose >= PRICE_FLOOR
      ? (live - prevClose) * qtyForDay
      : 0;

    const ccy = h.currency || baseCurrency || 'USD';
    const convValue = convertToSummaryCcy(value, ccy);
    const convPnl = convertToSummaryCcy(pnl, ccy);
    const convDayChange = convertToSummaryCcy(dayChange, ccy);
    portfolioTotalValue += convValue;
    portfolioTotalPnl += convPnl;
    portfolioTotalDayChange += convDayChange;

    const broker = h.broker || portfolioNameById.get(h.portfolio_id) || 'Other';
    if (!portfolioByBroker.has(broker)) portfolioByBroker.set(broker, { value: 0, pnl: 0 });
    const b = portfolioByBroker.get(broker)!;
    b.value += convValue;
    b.pnl += convPnl;

    const portfolioName = portfolioNameById.get(h.portfolio_id) || 'Default';
    if (!portfolioByName.has(portfolioName)) portfolioByName.set(portfolioName, { value: 0, pnl: 0, dayChange: 0 });
    const p = portfolioByName.get(portfolioName)!;
    p.value += convValue;
    p.pnl += convPnl;
    p.dayChange += convDayChange;
  }
  const portfolioBrokerBreakdown = Array.from(portfolioByBroker.entries())
    .map(([broker, v]) => ({ broker, ...v }))
    .sort((a, b) => b.value - a.value);
  const portfolioNameBreakdown = Array.from(portfolioByName.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.value - a.value);

  // Rewards/gift cards overview card
  const activeGiftCards = (giftCards || []).filter((c) => giftCardStatus(c) === 'active');
  const giftCardsTotalRemaining = activeGiftCards.reduce((sum, c) => sum + convertToSummaryCcy(c.remainingBalance, c.currency), 0);
  const activeRewardsCount = (rewardsPerks || []).length;

  // States
  const [currentMonthFilter, setCurrentMonthFilter] = useState<'overdue' | 'outstanding' | 'all'>('outstanding');
  const [showMonthTagFilters, setShowMonthTagFilters] = useState(false);
  const [monthTagFilters, setMonthTagFilters] = useState<Set<string>>(new Set());
  const [weekTagFilters, setWeekTagFilters] = useState<Set<string>>(new Set());
  const [showWeekTagFilters, setShowWeekTagFilters] = useState(false);
  const toggleWeekTagFilter = (tag: string) => setWeekTagFilters(prev => { const next = new Set(prev); if (next.has(tag)) next.delete(tag); else next.add(tag); return next; });
  const toggleMonthTagFilter = (tag: string) => setMonthTagFilters(prev => { const next = new Set(prev); if (next.has(tag)) next.delete(tag); else next.add(tag); return next; });
  const [isHeroBreakdownOpen, setIsHeroBreakdownOpen] = useState(false);
  const [showPortfolioByBroker, setShowPortfolioByBroker] = useState(false);
  const [showPortfolioDetail, setShowPortfolioDetail] = useState(false);
  const [showBillsDetail, setShowBillsDetail] = useState(true);
  const [isTrendExpanded, setIsTrendExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('pm_is_trend_expanded');
    return saved !== 'false'; // default true
  });
  const [isNextMonthExpanded, setIsNextMonthExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('pm_is_next_month_expanded');
    return saved === 'true'; // default false
  });
  const [isDueNextWeekExpanded, setIsDueNextWeekExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('pm_is_due_next_week_expanded');
    return saved !== 'false'; // default true
  });
  const [isThisMonthExpanded, setIsThisMonthExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('pm_is_this_month_expanded');
    return saved !== 'false'; // default true
  });

  // Helper to calculate days left for a due date string
  const getDaysUntilDueDateStr = (dueDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Generate historical spending trend data for the last 6 months
  const getTrendData = () => {
    const data = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`; // YYYY-MM
      const label = d.toLocaleString('default', { month: 'short' }); // e.g. "Jan"
      
      // Sum actual logs from history
      const actualSum = history
        .filter(h => h.paidDate.startsWith(monthKey))
        .reduce((sum, h) => {
          return sum + convertCurrency(h.amount, h.currency, summaryCurrency, countries);
        }, 0);
        
      // Sum expected active bill/payment expenses as the base expected budget
      const expectedSum = payments
        .filter(p => p.active)
        .reduce((sum, p) => {
          return sum + convertCurrency(p.amount, p.currency, summaryCurrency, countries);
        }, 0);
        
      data.push({
        month: label,
        Actual: parseFloat(actualSum.toFixed(2)),
        Budget: parseFloat(expectedSum.toFixed(2))
      });
    }
    return data;
  };

  const trendData = getTrendData();

  // Real counts for honest context (replacing any fabricated percentages)
  const paidCountThisMonth = currentMonthInstances.filter(ins => ins.status === 'paid').length;
  const totalCountThisMonth = currentMonthInstances.length;
  const hasNoPaymentsConfigured = activePayments.length === 0;
  const netSurplus = monthlyIncomeEstimate - totalDueCurrentMonthConverted;

  // Custom styling for Tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg shadow-md text-xs text-left">
          <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">{label}</p>
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center gap-3 justify-between py-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-slate-500 dark:text-slate-400 font-medium">{p.name}:</span>
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatCurrencyValue(p.value, summaryCurrency, countries)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-4 text-left bg-slate-50 dark:bg-slate-900">
      
      {isReadOnly && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300 shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
          <div className="flex-1 text-left">
            <span className="font-bold">View-Only Mode:</span> You have view-only access to this family group. Recording payments and modification features are disabled.
          </div>
        </div>
      )}

      {!hasNoPaymentsConfigured && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          {/* Bills overview card - condensed version of the detailed breakdown below, which
              is now collapsed by default. This card is the new at-a-glance entry point;
              clicking "See detail" re-expands the full bills breakdown further down. */}
          <div className="apple-card p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Bills
              </span>
              {dueCurrentMonth.some(ins => ins.status === 'overdue') && (
                <span className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-600 dark:text-rose-400">
                  <Bell className="w-3 h-3" /> Overdue
                </span>
              )}
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {formatCurrencyValue(totalDueCurrentMonthConverted, summaryCurrency, countries)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">due this month{dueNextWeek.length > 0 ? ` · ${formatCurrencyValue(totalDueNextWeekConverted, summaryCurrency, countries)} next 7 days` : ''}</p>
            <button
              onClick={() => setShowBillsDetail(true)}
              className="text-[10px] font-bold text-[#007aff] dark:text-[#0a84ff] mt-2 cursor-pointer"
            >
              See detail
            </button>
          </div>

          {/* Portfolio overview card - total value/P&L across every holding, with a toggle
              to break it down by broker instead of one combined figure. */}
          {activeHoldings.length > 0 && (
            <div className="apple-card p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Portfolio
                </span>
                <button
                  onClick={() => onNavigateToTab?.('portfolio')}
                  className="text-[9px] font-bold text-[#007aff] dark:text-[#0a84ff] cursor-pointer"
                >
                  Open
                </button>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">
                {formatCurrencyValue(portfolioTotalValue, summaryCurrency, countries)}
              </p>
              <p className={`text-[11px] font-bold mt-0.5 ${portfolioTotalPnl >= 0 ? 'text-[#34c759] dark:text-[#30d158]' : 'text-rose-500'}`}>
                {portfolioTotalPnl >= 0 ? '+' : ''}{formatCurrencyValue(portfolioTotalPnl, summaryCurrency, countries)}
              </p>
              {portfolioBrokerBreakdown.length > 1 && (
                <>
                  <button
                    onClick={() => setShowPortfolioByBroker(v => !v)}
                    className="text-[10px] font-bold text-[#007aff] dark:text-[#0a84ff] mt-2 cursor-pointer"
                  >
                    {showPortfolioByBroker ? 'Hide by broker' : 'See by broker'}
                  </button>
                  {showPortfolioByBroker && (
                    <div className="mt-2 space-y-1 border-t border-slate-100 dark:border-slate-800 pt-2">
                      {portfolioBrokerBreakdown.map(b => (
                        <div key={b.broker} className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500 dark:text-slate-400 truncate">{b.broker}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0 ml-2">
                            {formatCurrencyValue(b.value, summaryCurrency, countries)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {portfolioNameBreakdown.length > 0 && (
                <button
                  onClick={() => setShowPortfolioDetail(v => !v)}
                  className="text-[10px] font-bold text-[#007aff] dark:text-[#0a84ff] mt-2 cursor-pointer block"
                >
                  {showPortfolioDetail ? 'Hide summary' : 'See summary'}
                </button>
              )}
            </div>
          )}

          {/* Rewards/gift cards overview card */}
          {(activeGiftCards.length > 0 || activeRewardsCount > 0) && (
            <div className="apple-card p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Rewards
                </span>
                <button
                  onClick={() => onNavigateToTab?.('rewards')}
                  className="text-[9px] font-bold text-[#007aff] dark:text-[#0a84ff] cursor-pointer"
                >
                  Open
                </button>
              </div>
              {activeGiftCards.length > 0 && (
                <>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {formatCurrencyValue(giftCardsTotalRemaining, summaryCurrency, countries)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    remaining across {activeGiftCards.length} gift card{activeGiftCards.length === 1 ? '' : 's'}
                  </p>
                </>
              )}
              {activeRewardsCount > 0 && (
                <p className={activeGiftCards.length > 0 ? 'text-[10px] text-slate-400 mt-1' : 'text-xl font-black text-slate-900 dark:text-white'}>
                  {activeRewardsCount} tracked reward{activeRewardsCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {showPortfolioDetail && portfolioNameBreakdown.length > 0 && (
        <div className="apple-card p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Portfolio Summary
            </span>
            <button
              onClick={() => setShowPortfolioDetail(false)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer flex items-center gap-1"
            >
              <ChevronUp className="w-3 h-3" /> Hide
            </button>
          </div>
          {/* Chart - one bar per portfolio, colored by whether it's up or down today */}
          <div style={{ height: Math.max(100, portfolioNameBreakdown.length * 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={portfolioNameBreakdown.map(p => ({ name: p.name, value: p.value }))}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 9 }} hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip
                  formatter={(v: number) => [formatCurrencyValue(v, summaryCurrency, countries), 'Value']}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {portfolioNameBreakdown.map((p, i) => (
                    <Cell key={i} fill={p.dayChange >= 0 ? '#34c759' : '#ff3b30'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Table - name, total value, total P&L, today's change - same data source as the
              Agent's daily digest (previous_close for day change), not a separate pipeline */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-900 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="text-left py-1.5">Portfolio</th>
                  <th className="text-right py-1.5">Value</th>
                  <th className="text-right py-1.5">P&L</th>
                  <th className="text-right py-1.5">Today</th>
                </tr>
              </thead>
              <tbody>
                {portfolioNameBreakdown.map(p => (
                  <tr key={p.name} className="border-b border-slate-50 dark:border-slate-900/50 last:border-0">
                    <td className="py-1.5 font-semibold text-slate-900 dark:text-white truncate max-w-[100px]">{p.name}</td>
                    <td className="py-1.5 text-right font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrencyValue(p.value, summaryCurrency, countries)}
                    </td>
                    <td className={`py-1.5 text-right font-bold ${p.pnl >= 0 ? 'text-[#34c759] dark:text-[#30d158]' : 'text-rose-500'}`}>
                      {p.pnl >= 0 ? '+' : ''}{formatCurrencyValue(p.pnl, summaryCurrency, countries)}
                    </td>
                    <td className={`py-1.5 text-right font-bold ${p.dayChange >= 0 ? 'text-[#34c759] dark:text-[#30d158]' : 'text-rose-500'}`}>
                      {p.dayChange >= 0 ? '+' : ''}{formatCurrencyValue(p.dayChange, summaryCurrency, countries)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasNoPaymentsConfigured ? (
        /* Empty state — first thing a brand-new user sees, so make it an invitation, not a wall of zeros */
        <div className="apple-card p-8 flex flex-col items-center text-center gap-3 shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-[#007aff]/10 dark:bg-[#0a84ff]/15 flex items-center justify-center">
            <Wallet className="w-7 h-7 text-[#007aff] dark:text-[#0a84ff]" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Nothing tracked yet</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
              Add your first bill or subscription and this becomes your at-a-glance view of what's due, what's paid, and where your money's going.
            </p>
          </div>
          <button
            onClick={() => onNavigateToBills?.()}
            className="flex items-center gap-1.5 text-[11px] font-bold text-[#007aff] dark:text-[#0a84ff] cursor-pointer hover:underline"
          >
            <PlusCircle className="w-4 h-4" /> Add a bill from Manage Bills
          </button>
        </div>
      ) : showBillsDetail ? (
        <>
          <button
            onClick={() => setShowBillsDetail(false)}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer flex items-center gap-1"
          >
            <ChevronUp className="w-3 h-3" /> Hide bill details
          </button>
          {/* Hero — the single most useful number: your real remaining surplus, or what's due if income isn't set yet */}
          <div className="apple-card p-5 shrink-0">
            {monthlyIncomeEstimate > 0 ? (
              <>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Remaining This Month
                </p>
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <p className={`text-3xl font-black tracking-tight ${netSurplus >= 0 ? 'text-[#34c759] dark:text-[#30d158]' : 'text-rose-500'}`}>
                    {formatCurrencyValue(netSurplus, summaryCurrency, countries)}
                  </p>
                  <p className="text-[11px] text-slate-400 text-right leading-relaxed">
                    {formatCurrencyValue(monthlyIncomeEstimate, summaryCurrency, countries)} income
                    <br />− {formatCurrencyValue(totalDueCurrentMonthConverted, summaryCurrency, countries)} in bills
                  </p>
                </div>
                {netSurplus < 0 && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-2 flex items-center gap-1">
                    <ArrowDown className="w-3 h-3" /> Bills exceed income this month
                  </p>
                )}
                <button
                  onClick={() => setIsHeroBreakdownOpen(!isHeroBreakdownOpen)}
                  className="text-[10px] font-bold text-[#007aff] dark:text-[#0a84ff] mt-2.5 cursor-pointer"
                >
                  {isHeroBreakdownOpen ? 'Hide breakdown' : "See what's included"}
                </button>
              </>
            ) : (
              <>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Due This Month
                </p>
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {formatCurrencyValue(totalDueCurrentMonthConverted, summaryCurrency, countries)}
                </p>
                <p className="text-[10px] text-slate-400 mt-2">
                  {paidCountThisMonth} of {totalCountThisMonth} bills paid so far · Set your income on the Income page for a fuller picture
                </p>
                {billsBreakdown.length > 0 && (
                  <button
                    onClick={() => setIsHeroBreakdownOpen(!isHeroBreakdownOpen)}
                    className="text-[10px] font-bold text-[#007aff] dark:text-[#0a84ff] mt-2 cursor-pointer"
                  >
                    {isHeroBreakdownOpen ? 'Hide breakdown' : "See what's included"}
                  </button>
                )}
              </>
            )}

            {isHeroBreakdownOpen && (
              <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-900 space-y-3">
                {monthlyIncomeEstimate > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5">Income</p>
                    {incomeSources.length > 0 ? (
                      <div className="space-y-1">
                        {incomeSources.map(src => (
                          <div key={src.id} className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-600 dark:text-slate-300 truncate">{src.name}</span>
                            <span className="font-bold text-slate-900 dark:text-white shrink-0">{formatCurrencyValue(src.amount, summaryCurrency, countries)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400">{formatCurrencyValue(monthlyIncomeEstimate, summaryCurrency, countries)}/month, set on the Income page</p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-wider mb-1.5">Bills ({billsBreakdown.length})</p>
                  {billsBreakdown.length === 0 ? (
                    <p className="text-[10px] text-slate-400">Nothing outstanding this month.</p>
                  ) : (
                    <div className="space-y-1">
                      {billsBreakdown.map(ins => (
                        <div key={ins.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-600 dark:text-slate-300 truncate">{ins.paymentName}</span>
                          <span className="font-bold text-slate-900 dark:text-white shrink-0">{formatCurrencyValue(ins.amount, ins.currency, countries)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Supporting stats */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="apple-card p-4">
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Paid So Far</p>
              <p className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {formatCurrencyValue(paidThisMonthConverted, summaryCurrency, countries)}
              </p>
              <p className="text-[9px] text-slate-400 mt-1.5">{paidCountThisMonth} of {totalCountThisMonth} bills</p>
            </div>
            <div className="apple-card p-4">
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Due Next Week</p>
              <p className="text-base font-bold text-[#007aff] dark:text-[#0a84ff] tracking-tight truncate">
                {formatCurrencyValue(totalDueNextWeekConverted, summaryCurrency, countries)}
              </p>
              <p className="text-[9px] text-slate-400 mt-1.5">{dueNextWeek.length} bill{dueNextWeek.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </>
      ) : null}

      {/* Alternative High Density Desktop Grid Layout (Responsive split: One column setting) */}
      {!hasNoPaymentsConfigured && showBillsDetail && (
      <div className="grid grid-cols-1 gap-4 items-start pb-6">
        
        {/* Analytics, Charts & Insights */}
        <div className="space-y-4">
          
          {/* 6-Month Spending Trend Line Chart */}
          <div className="apple-card flex flex-col overflow-hidden">
            <button
              onClick={() => {
                const nextVal = !isTrendExpanded;
                setIsTrendExpanded(nextVal);
                localStorage.setItem('pm_is_trend_expanded', String(nextVal));
              }}
              className={`w-full px-4.5 py-4 flex justify-between items-center bg-[#f5f5f7]/30 dark:bg-[#1c1c1e]/30 hover:bg-[#f5f5f7]/60 dark:hover:bg-[#2c2c2e]/40 transition-all text-left cursor-pointer outline-none select-none ${
                isTrendExpanded ? 'border-b border-[#e5e5ea] dark:border-[#2c2c2e]' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#007aff] dark:text-[#0a84ff]" />
                <div className="text-left">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                    Spending Trend
                  </h3>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5 tracking-wider">
                    Actual logged vs expected recurring budget (6-months)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isTrendExpanded && (
                  <div className="hidden sm:flex items-center gap-2.5 text-[9px] font-black uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-[#007aff] dark:text-[#0a84ff]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#007aff] dark:bg-[#0a84ff]" /> Actual
                    </span>
                    <span className="flex items-center gap-1 text-slate-450 dark:text-slate-500">
                      <span className="w-1.5 h-0.5 bg-[#e5e5ea] dark:bg-[#2c2c2e]" /> Budget
                    </span>
                  </div>
                )}
                {isTrendExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>
 
            {isTrendExpanded && (
              <div className="p-4 flex flex-col">
                <div className="flex sm:hidden justify-end gap-2.5 text-[9px] font-black uppercase tracking-wider mb-2">
                  <span className="flex items-center gap-1 text-[#007aff] dark:text-[#0a84ff]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#007aff] dark:bg-[#0a84ff]" /> Actual
                  </span>
                  <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                    <span className="w-1.5 h-0.5 bg-[#e5e5ea] dark:bg-[#2c2c2e]" /> Budget
                  </span>
                </div>
                <div className="h-44 w-full text-[10px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-[#e5e5ea] dark:text-[#2c2c2e]" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#8e8e93', fontSize: 9, fontWeight: 700 }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#8e8e93', fontSize: 9, fontWeight: 700 }}
                        tickFormatter={(val) => {
                          const symbol = countries.find(c => c.currency === summaryCurrency)?.symbol || '$';
                          return `${symbol}${val}`;
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0, 122, 255, 0.1)', strokeWidth: 1 }} />
                      <Line 
                        type="monotone" 
                        dataKey="Actual" 
                        name="Actual Spent"
                        stroke="#007aff" 
                        strokeWidth={2.5} 
                        dot={{ r: 3, strokeWidth: 1, fill: '#007aff' }} 
                        activeDot={{ r: 5 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Budget" 
                        name="Expected Budget"
                        stroke="#8e8e93" 
                        strokeWidth={1.5} 
                        strokeDasharray="4 4"
                        dot={false} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* "For Whom" (Beneficiary Tag) Spend Distribution Report */}
          <div className="apple-card p-4 flex flex-col">
            <div className="text-left mb-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <User className="w-4 h-4 text-[#007aff] dark:text-[#0a84ff]" /> Spend by Beneficiary
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 font-bold uppercase tracking-wider">Breakdown of recorded payments logged by beneficiary</p>
            </div>

            {history.filter(h => h.taggedFor).length === 0 ? (
              <div className="text-center py-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 font-bold">No tagged transactions recorded yet.</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Use the "For Whom" field when recording paid bills to populate this report.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(
                  history.reduce((acc, h) => {
                    const tag = h.taggedFor?.trim() || 'General';
                    const amt = convertCurrency(h.amount, h.currency, summaryCurrency, countries);
                    acc[tag] = (acc[tag] || 0) + amt;
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([tag, amount], idx, arr) => {
                    const maxAmount = Math.max(...arr.map(x => x[1]));
                    const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                    
                    const borderColors = [
                      'bg-[#007aff]',
                      'bg-emerald-500',
                      'bg-amber-500',
                      'bg-rose-500',
                      'bg-teal-500',
                      'bg-purple-500'
                    ];
                    const colorClass = borderColors[idx % borderColors.length];

                    return (
                      <div key={tag} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
                            {tag}
                          </span>
                          <span className="font-black text-slate-900 dark:text-white">
                            {formatCurrencyValue(amount, summaryCurrency, countries)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${colorClass} transition-all duration-500`}
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

        </div>

        {/* Schedulers, Pending & Upcoming Bills */}
        <div className="space-y-4">
          
          {/* Section 1: Upcoming next week in unified card */}
          <div className="apple-card flex flex-col overflow-hidden">
            <div 
              onClick={() => {
                const nextVal = !isDueNextWeekExpanded;
                setIsDueNextWeekExpanded(nextVal);
                localStorage.setItem('pm_is_due_next_week_expanded', String(nextVal));
              }}
              className="px-4.5 py-3.5 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center bg-slate-50/20 dark:bg-slate-950/20 cursor-pointer select-none"
            >
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#007aff] dark:text-[#0a84ff]" /> Due Next Week
              </h3>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-[10px] font-bold">
                  {dueNextWeek.length} pending
                </span>
                {isDueNextWeekExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {isDueNextWeekExpanded && (
              dueNextWeek.length === 0 ? (
                <div className="p-6 text-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto opacity-75" />
                  <p className="text-xs text-slate-400 font-medium mt-2">Awesome! No payments due in the next 7 days.</p>
                </div>
              ) : (() => {
                const weekCategorySet = new Set<string>();
                dueNextWeek.forEach(ins => { if (ins.category) weekCategorySet.add(ins.category); });
                const weekCategories = Array.from(weekCategorySet).sort();
                const displayedWeek = weekTagFilters.size === 0 ? dueNextWeek : dueNextWeek.filter(ins => weekTagFilters.has(ins.category));

                return (
                  <>
                  {weekCategories.length > 1 && (
                    <div className="filter-container px-4 py-2 border-b border-slate-100 dark:border-slate-900">
                      <button
                        onClick={() => setShowWeekTagFilters(v => !v)}
                        className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-indigo-500 cursor-pointer"
                      >
                        Filters{weekTagFilters.size > 0 ? ` (${weekTagFilters.size})` : ''} {showWeekTagFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {showWeekTagFilters && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {weekTagFilters.size > 0 && (
                            <button onClick={() => setWeekTagFilters(new Set())} className="px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer bg-slate-900 dark:bg-white text-white dark:text-slate-950">All</button>
                          )}
                          {weekCategories.map(opt => (
                            <button
                              key={opt}
                              onClick={() => toggleWeekTagFilter(opt)}
                              className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${weekTagFilters.has(opt) ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                <div className="divide-y divide-slate-100 dark:divide-slate-900 max-h-[350px] overflow-y-auto no-scrollbar">
                  {displayedWeek.map((ins) => {
                    const daysLeft = getDaysUntilDueDateStr(ins.dueDate);
                    const colorConfig = getCategoryColor(ins.category);
                    const parentPayment = payments.find(p => p.id === ins.paymentId);

                    return (
                      <div 
                        key={ins.id}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/30 dark:hover:bg-slate-900/20 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${colorConfig.bg}`}>
                            {getInitials(ins.paymentName)}
                          </div>

                          <div className="min-w-0 text-left">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate leading-snug">{ins.paymentName}</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                              Due <span className="font-bold text-rose-500">{formatDaysRemaining(daysLeft)}</span> • {formatDatePretty(new Date(ins.dueDate))}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">
                              {formatCurrencyValue(ins.amount, ins.currency, countries)}
                            </span>
                            {ins.currency !== summaryCurrency && (
                              <span className="text-[9px] font-medium text-slate-400 block mt-0.5">
                                ~ {formatCurrencyValue(convertCurrency(ins.amount, ins.currency, summaryCurrency, countries), summaryCurrency, countries)}
                              </span>
                            )}
                          </div>

                          {parentPayment && (
                            <button
                              disabled={isPaymentReadOnly(parentPayment)}
                              onClick={() => onRecordPayment(parentPayment, ins.dueDate)}
                              className={`px-2.5 py-1 text-[10px] font-bold rounded-md shadow-sm transition-all shrink-0 ${
                                isPaymentReadOnly(parentPayment)
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700/50'
                                  : 'bg-[#007aff] hover:bg-[#007aff]/90 dark:bg-[#0a84ff] dark:hover:bg-[#0a84ff]/90 text-white cursor-pointer'
                              }`}
                            >
                              {isPaymentReadOnly(parentPayment) ? 'View Only' : 'To Be Paid'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                  </>
                );
              })()
            )}
          </div>

          {/* Section 2: This Month's Scheduler */}
          <div className="apple-card flex flex-col overflow-hidden">
            <div 
              onClick={(e) => {
                // If clicked inside the filter-container, don't toggle expand/collapse
                if ((e.target as HTMLElement).closest('.filter-container')) return;
                const nextVal = !isThisMonthExpanded;
                setIsThisMonthExpanded(nextVal);
                localStorage.setItem('pm_is_this_month_expanded', String(nextVal));
              }}
              className="px-4.5 py-3.5 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center bg-slate-50/20 dark:bg-slate-950/20 cursor-pointer select-none"
            >
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#007aff] dark:text-[#0a84ff]" /> This Month's Scheduler
              </h3>
              <div className="flex items-center gap-3">
                <div className="filter-container apple-segmented-control shrink-0">
                  <button
                    onClick={() => setCurrentMonthFilter('overdue')}
                    className={currentMonthFilter === 'overdue' ? 'apple-segmented-btn-active' : 'apple-segmented-btn'}
                  >
                    Overdue
                  </button>
                  <button
                    onClick={() => setCurrentMonthFilter('outstanding')}
                    className={currentMonthFilter === 'outstanding' ? 'apple-segmented-btn-active' : 'apple-segmented-btn'}
                  >
                    Outstanding
                  </button>
                  <button
                    onClick={() => setCurrentMonthFilter('all')}
                    className={currentMonthFilter === 'all' ? 'apple-segmented-btn-active' : 'apple-segmented-btn'}
                  >
                    All Bills
                  </button>
                </div>
                {isThisMonthExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </div>
            </div>

            {isThisMonthExpanded && (
              (() => {
                const statusFiltered = currentMonthFilter === 'overdue'
                  ? currentMonthInstances.filter(ins => ins.status === 'overdue')
                  : currentMonthFilter === 'outstanding' 
                  ? currentMonthInstances.filter(ins => ins.status !== 'paid')
                  : currentMonthInstances;

                // Category only, kept simple - filtering by payment method and tagged-for
                // turned out to be more filter options than useful for a bill list.
                const categorySet = new Set<string>();
                statusFiltered.forEach(ins => {
                  if (ins.category) categorySet.add(ins.category);
                });
                const tagGroups: { label: string; options: string[] }[] = [
                  { label: 'Category', options: Array.from(categorySet).sort() },
                ].filter(g => g.options.length > 1);

                const displayedInstances = monthTagFilters.size === 0 ? statusFiltered : statusFiltered.filter(ins => {
                  const selectedCategories = Array.from(categorySet).filter(c => monthTagFilters.has(c));
                  return selectedCategories.length === 0 || selectedCategories.includes(ins.category);
                });

                if (displayedInstances.length === 0) {
                  return (
                    <div className="p-6 text-center">
                      <p className="text-xs text-slate-400 font-medium">No matching scheduled payments for this month.</p>
                    </div>
                  );
                }

                return (
                  <>
                  {tagGroups.length > 0 && (
                    <div className="filter-container px-4 py-2 border-b border-slate-100 dark:border-slate-900">
                      <button
                        onClick={() => setShowMonthTagFilters(v => !v)}
                        className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-indigo-500 cursor-pointer"
                      >
                        Filters{monthTagFilters.size > 0 ? ` (${monthTagFilters.size})` : ''} {showMonthTagFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {showMonthTagFilters && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {monthTagFilters.size > 0 && (
                            <button onClick={() => setMonthTagFilters(new Set())} className="px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer bg-slate-900 dark:bg-white text-white dark:text-slate-950">All</button>
                          )}
                          {tagGroups.map(group => group.options.map(opt => (
                            <button
                              key={`${group.label}-${opt}`}
                              onClick={() => toggleMonthTagFilter(opt)}
                              className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer ${monthTagFilters.has(opt) ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                            >
                              {opt}
                            </button>
                          )))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-900 max-h-[400px] overflow-y-auto no-scrollbar">
                    {displayedInstances.map((ins) => {
                      const daysLeft = getDaysUntilDueDateStr(ins.dueDate);
                      const colorConfig = getCategoryColor(ins.category);
                      const parentPayment = payments.find(p => p.id === ins.paymentId);

                      return (
                        <div key={ins.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/30 dark:hover:bg-slate-900/20 transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${colorConfig.bg}`}>
                              {getInitials(ins.paymentName)}
                            </div>
                            <div className="min-w-0 text-left">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate leading-snug">{ins.paymentName}</h4>
                                <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded-full shrink-0 ${
                                  ins.status === 'paid' 
                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                    : ins.status === 'overdue'
                                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 animate-pulse font-extrabold'
                                      : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                                }`}>
                                  {ins.status === 'paid' ? 'paid' : ins.status === 'overdue' ? 'overdue' : 'to be paid'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                Due {formatDatePretty(new Date(ins.dueDate))} • <span className={`${
                                  daysLeft < 0 && ins.status !== 'paid' ? 'text-rose-500 font-extrabold' : 'text-slate-500'
                                }`}>{ins.status === 'paid' ? 'Paid' : formatDaysRemaining(daysLeft)}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="text-right">
                              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                                {formatCurrencyValue(ins.amount, ins.currency, countries)}
                              </span>
                              {ins.currency !== summaryCurrency && (
                                <span className="text-[9px] font-medium text-slate-400 block mt-0.5">
                                  ~ {formatCurrencyValue(convertCurrency(ins.amount, ins.currency, summaryCurrency, countries), summaryCurrency, countries)}
                                </span>
                              )}
                            </div>

                            {ins.status !== 'paid' && parentPayment ? (
                              <button
                                disabled={isPaymentReadOnly(parentPayment)}
                                onClick={() => onRecordPayment(parentPayment, ins.dueDate)}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-md shadow-sm transition-all shrink-0 ${
                                  isPaymentReadOnly(parentPayment)
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700/50'
                                    : 'bg-[#007aff] hover:bg-[#007aff]/90 dark:bg-[#0a84ff] dark:hover:bg-[#0a84ff]/90 text-white cursor-pointer'
                                }`}
                              >
                                {isPaymentReadOnly(parentPayment) ? 'View Only' : 'To Be Paid'}
                              </button>
                            ) : ins.status === 'paid' ? (
                              <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>
                );
              })()
            )}
          </div>

          {/* Next Month Forecast & Planner Collapsible Section */}
          <div className="apple-card flex flex-col overflow-hidden">
            <div
              onClick={() => {
                const nextVal = !isNextMonthExpanded;
                setIsNextMonthExpanded(nextVal);
                localStorage.setItem('pm_is_next_month_expanded', String(nextVal));
              }}
              className="w-full px-4.5 py-3.5 flex justify-between items-center bg-slate-50/20 dark:bg-slate-950/20 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-all text-left cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-purple-500" />
                <div className="text-left">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Next Month Forecast
                  </h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                    Pre-scheduled 1 month in advance for forecasting
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-0.5 rounded-full">
                  {formatCurrencyValue(totalForecastedNextMonthConverted, summaryCurrency, countries)}
                </span>
                {isNextMonthExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </div>
            </div>

            {isNextMonthExpanded && (
              <div className="divide-y divide-slate-100 dark:divide-slate-900 bg-white dark:bg-slate-950 max-h-[350px] overflow-y-auto no-scrollbar">
                {nextMonthInstances.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-xs text-slate-400">No scheduled bills found for next month.</p>
                  </div>
                ) : (
                  nextMonthInstances.map((ins) => {
                    const colorConfig = getCategoryColor(ins.category);
                    const parentPayment = payments.find(p => p.id === ins.paymentId);
                    return (
                      <div key={ins.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/30 dark:hover:bg-slate-900/20 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${colorConfig.bg}`}>
                            {getInitials(ins.paymentName)}
                          </div>
                          <div className="min-w-0 text-left">
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate leading-snug">{ins.paymentName}</h5>
                            <p className="text-[9px] text-slate-400 mt-0.5 font-semibold">
                              Prescheduled on {formatDatePretty(new Date(ins.dueDate))} • {ins.billingCycle}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-950 dark:text-white">
                              {formatCurrencyValue(ins.amount, ins.currency, countries)}
                            </span>
                            {ins.currency !== summaryCurrency && (
                              <span className="text-[9px] font-medium text-slate-400 block mt-0.5">
                                ~ {formatCurrencyValue(convertCurrency(ins.amount, ins.currency, summaryCurrency, countries), summaryCurrency, countries)}
                              </span>
                            )}
                          </div>

                          {ins.status !== 'paid' && parentPayment ? (
                            <button
                              disabled={isPaymentReadOnly(parentPayment)}
                              onClick={() => onRecordPayment(parentPayment, ins.dueDate)}
                              className={`px-2 py-0.5 text-[9px] font-bold rounded shadow-sm transition-all shrink-0 ${
                                isPaymentReadOnly(parentPayment)
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700/50'
                                  : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                              }`}
                            >
                              {isPaymentReadOnly(parentPayment) ? 'View' : 'Pay Early'}
                            </button>
                          ) : ins.status === 'paid' ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

        </div>

      </div>
      )}

    </div>
  );
}

