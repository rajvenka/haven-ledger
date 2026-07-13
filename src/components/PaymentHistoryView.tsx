import React, { useState } from 'react';
import { 
  History, 
  Trash2, 
  CreditCard, 
  TrendingUp, 
  Search, 
  Calendar,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { PaymentHistory, Currency, CountryConfig } from '../types';
import { formatCurrencyValue, convertCurrency } from '../utils/paymentUtils';

interface PaymentHistoryViewProps {
  history: PaymentHistory[];
  onDeleteHistoryEntry: (id: string) => void;
  onUpdateHistoryStatus?: (id: string, status: 'paid' | 'delayed' | 'carry') => void;
  onClearHistory: () => void;
  rate: number;
  summaryCurrency: Currency;
  countries?: CountryConfig[];
}

export default function PaymentHistoryView({
  history,
  onDeleteHistoryEntry,
  onUpdateHistoryStatus,
  onClearHistory,
  rate,
  summaryCurrency,
  countries = []
}: PaymentHistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate cumulative historic total spend
  const totalSpendConverted = history.reduce((sum, item) => {
    const converted = convertCurrency(item.amount, item.currency, summaryCurrency, countries);
    return sum + converted;
  }, 0);

  // Group items by Month-Year for elegant visual partitioning (e.g., "June 2026")
  const groupedHistoryByMonth: Record<string, PaymentHistory[]> = {};

  // Filter based on search input
  const filteredHistory = history.filter(item => 
    item.paymentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.currency.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.paidDate.includes(searchTerm)
  );

  filteredHistory.forEach(item => {
    try {
      const dateObj = new Date(item.paidDate + 'T00:00:00'); // enforce local interpretation
      const monthYearStr = dateObj.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
      
      if (!groupedHistoryByMonth[monthYearStr]) {
        groupedHistoryByMonth[monthYearStr] = [];
      }
      groupedHistoryByMonth[monthYearStr].push(item);
    } catch (e) {
      // Fallback
      const fallback = 'Recent Transactions';
      if (!groupedHistoryByMonth[fallback]) {
        groupedHistoryByMonth[fallback] = [];
      }
      groupedHistoryByMonth[fallback].push(item);
    }
  });

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-4 text-left select-none bg-slate-50 dark:bg-slate-900">
      
      {/* Title Bar with clear action */}
      <div className="flex justify-between items-center px-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <History className="w-4.5 h-4.5 text-indigo-600" />
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Payment History</h3>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Are you sure you want to permanently delete all archived transaction history?')) {
                onClearHistory();
              }
            }}
            className="text-[10px] px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/25 dark:text-rose-400 font-bold rounded flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Clear Logs
          </button>
        )}
      </div>

      {/* Aggregate Spend Card (High Density Card styling) */}
      <div className="bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between shrink-0">
        <div className="space-y-0.5 text-left">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Total Paid So Far
          </span>
          <span className="text-[9px] text-slate-400 block font-medium">Converted to preferred currency</span>
        </div>
        <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400">
          {formatCurrencyValue(totalSpendConverted, summaryCurrency)}
        </h3>
      </div>

      {/* Interactive Search Field */}
      <div className="relative shrink-0">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search paid services or dates..."
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
        />
      </div>

      {/* Grouped Logs lists */}
      {Object.keys(groupedHistoryByMonth).length === 0 ? (
        <div className="bg-white dark:bg-slate-950 rounded-xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-sm flex-1 flex flex-col items-center justify-center">
          <CreditCard className="w-8 h-8 text-slate-300" />
          <p className="text-xs text-slate-400 font-bold mt-2.5">No payments recorded yet.</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-[180px] text-center">
            Mark an upcoming next-week bill as Paid on the Dashboard to start archiving receipts.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-6">
          {Object.entries(groupedHistoryByMonth).map(([monthYear, items]) => (
            <div key={monthYear} className="space-y-2">
              {/* Header Label */}
              <h4 className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider pl-1 flex items-center gap-1.5 uppercase">
                <Calendar className="w-3.5 h-3.5" /> {monthYear}
              </h4>

              {/* Items Card list */}
              <div className="bg-white dark:bg-slate-950 rounded-xl divide-y divide-slate-100 dark:divide-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                {items.map((log) => {
                  const statusColors = {
                    paid: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50',
                    delayed: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50',
                    carry: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50'
                  };
                  const statusLabels = {
                    paid: 'Paid',
                    delayed: 'Delayed',
                    carry: 'Carried Over'
                  };
                  const currentStatus = log.status || 'paid';

                  return (
                    <div key={log.id} className="p-3 flex items-center justify-between gap-3 group hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition-colors first:rounded-t-xl last:rounded-b-xl">
                      <div className="min-w-0 text-left flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">{log.paymentName}</h5>
                          <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded border tracking-wider ${statusColors[currentStatus]}`}>
                            {statusLabels[currentStatus]}
                          </span>
                          {currentStatus !== 'paid' && onUpdateHistoryStatus && (
                            <button
                              onClick={() => onUpdateHistoryStatus(log.id, 'paid')}
                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50 rounded text-[7px] font-black uppercase tracking-wider transition-all cursor-pointer hover:scale-105 flex items-center gap-0.5"
                              title="Change status to paid"
                            >
                              ✓ Mark Paid
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[9px] text-slate-400 font-medium">
                            {new Date(log.paidDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                          </span>
                          {log.taggedFor && (
                            <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-full text-[8px] font-bold border border-slate-200 dark:border-slate-800">
                              For: {log.taggedFor}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-slate-950 dark:text-white block">
                            {formatCurrencyValue(log.amount, log.currency)}
                          </span>
                          {log.currency !== summaryCurrency && (
                            <span className="text-[9px] text-slate-400 block mt-0.5">
                              ~ {formatCurrencyValue(convertCurrency(log.amount, log.currency, summaryCurrency, countries), summaryCurrency)}
                            </span>
                          )}
                        </div>

                        {/* Delete log button */}
                        <button
                          onClick={() => onDeleteHistoryEntry(log.id)}
                          className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 hover:text-rose-500 rounded transition-colors"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

