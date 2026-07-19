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
  ChevronUp
} from 'lucide-react';
import { RecurringPayment, PaymentHistory, Currency, CountryConfig, CATEGORY_COLORS, getCategoryColor, ScheduledInstance } from '../types';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
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
  isReadOnly?: boolean;
  currentUserUid?: string;
  monthlyIncomeEstimate?: number;
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
  isReadOnly = false,
  currentUserUid,
  monthlyIncomeEstimate = 0
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

  // States
  const [currentMonthFilter, setCurrentMonthFilter] = useState<'outstanding' | 'all'>('outstanding');
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
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-4 select-none text-left bg-slate-50 dark:bg-slate-900">
      
      {isReadOnly && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300 shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
          <div className="flex-1 text-left">
            <span className="font-bold">View-Only Mode:</span> You have view-only access to this family group. Recording payments and modification features are disabled.
          </div>
        </div>
      )}
      
      {/* Main Stats Bento Row - Grid of 3 (High Density Theme Layout) */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {/* Paid So Far Card */}
        <div className="apple-card p-4 flex flex-col justify-between">
          <div>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Paid so far</p>
            <p className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {formatCurrencyValue(paidThisMonthConverted, summaryCurrency, countries)}
            </p>
          </div>
          <div className="mt-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8.5px] font-bold bg-[#e8f5e9] dark:bg-[#1b5e20]/15 text-[#34c759] dark:text-[#30d158] border border-[#c8e6c9]/15">
              ↑ 12%
            </span>
          </div>
        </div>

        {/* Upcoming Next Week Card */}
        <div className="apple-card p-4 flex flex-col justify-between">
          <div>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Next Week</p>
            <p className="text-base font-bold text-[#007aff] dark:text-[#0a84ff] tracking-tight truncate">
              {formatCurrencyValue(totalDueNextWeekConverted, summaryCurrency, countries)}
            </p>
          </div>
          <div className="mt-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8.5px] font-bold bg-[#f2f2f7] dark:bg-[#1c1c1e] text-slate-500 dark:text-slate-400 border border-[#e5e5ea]/20">
              {dueNextWeek.length} bills
            </span>
          </div>
        </div>

        {/* Remaining Bills Card */}
        <div className="apple-card p-4 flex flex-col justify-between">
          <div>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">This Month</p>
            <p className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {formatCurrencyValue(totalDueCurrentMonthConverted, summaryCurrency, countries)}
            </p>
          </div>
          <div className="mt-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8.5px] font-bold bg-[#fff3e0] dark:bg-[#e65100]/15 text-[#ff9500] dark:text-[#ff9f0a] border border-[#ffe0b2]/15">
              74% budget
            </span>
          </div>
        </div>
      </div>

      {/* Net Surplus — income vs this month's bills, one honest number */}
      {monthlyIncomeEstimate > 0 && (
        <div className="apple-card p-4 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Remaining Surplus</p>
            <p className={`text-lg font-black tracking-tight ${(monthlyIncomeEstimate - totalDueCurrentMonthConverted) >= 0 ? 'text-[#34c759] dark:text-[#30d158]' : 'text-rose-500'}`}>
              {formatCurrencyValue(monthlyIncomeEstimate - totalDueCurrentMonthConverted, summaryCurrency, countries)}
            </p>
          </div>
          <p className="text-[10px] text-slate-400 text-right max-w-[140px]">
            {formatCurrencyValue(monthlyIncomeEstimate, summaryCurrency, countries)} income − {formatCurrencyValue(totalDueCurrentMonthConverted, summaryCurrency, countries)} this month
          </p>
        </div>
      )}

      {/* Alternative High Density Desktop Grid Layout (Responsive split: One column setting) */}
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
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-900 max-h-[350px] overflow-y-auto no-scrollbar">
                  {dueNextWeek.map((ins) => {
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
              )
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
                const displayedInstances = currentMonthFilter === 'outstanding' 
                  ? currentMonthInstances.filter(ins => ins.status !== 'paid')
                  : currentMonthInstances;

                if (displayedInstances.length === 0) {
                  return (
                    <div className="p-6 text-center">
                      <p className="text-xs text-slate-400 font-medium">No matching scheduled payments for this month.</p>
                    </div>
                  );
                }

                return (
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

    </div>
  );
}

