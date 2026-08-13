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
  pulseMode?: boolean;
  history: PaymentHistory[];
  onDeleteHistoryEntry: (id: string) => void;
  onUpdateHistoryStatus?: (id: string, status: 'paid' | 'delayed' | 'carry') => void;
  onClearHistory: () => void;
  rate: number;
  summaryCurrency: Currency;
  countries?: CountryConfig[];
}

export default function PaymentHistoryView({
  pulseMode = false,
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

  // Filter based on search input - defensive against any field being undefined on a given
  // record, since this runs across every history item on every keystroke and would crash
  // the whole screen otherwise.
  const filteredHistory = history.filter(item => 
    String(item.paymentName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    String(item.currency || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(item.paidDate || '').includes(searchTerm)
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
    <div className={`flex-1 flex flex-col overflow-y-auto px-3 sm:px-5 pt-3 sm:pt-4 pb-24 md:pb-4 space-y-4 text-left ${pulseMode ? 'bg-slate-50 dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900'}`}>
      
      {pulseMode ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/20 p-3 sm:p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <History className="w-5 h-5 text-sky-500 shrink-0" />
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">Payment History</h3>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-sky-600/90 text-white">Pulse</span>
              </div>
            </div>
            {history.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to permanently delete all archived transaction history?')) {
                    onClearHistory();
                  }
                }}
                className="shrink-0 text-[10px] font-bold text-rose-500 px-2 py-1 rounded-lg border border-rose-200/60 dark:border-rose-900/40 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>
      ) : (
      <div className="flex justify-between items-center px-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <History className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Payment History</h3>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Are you sure you want to permanently delete all archived transaction history?')) {
                onClearHistory();
              }
            }}
            className="apple-btn-danger py-1 px-3 text-[10px] rounded-full flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> Clear Logs
          </button>
        )}
      </div>
      )}

      {/* Aggregate Spend Card (High Density Card styling) */}
      <div className="apple-card p-4 flex items-center justify-between shrink-0">
        <div className="space-y-0.5 text-left">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Total Paid So Far
          </span>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 block font-bold">Converted to preferred currency</span>
        </div>
        <h3 className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCurrencyValue(totalSpendConverted, summaryCurrency)}
        </h3>
      </div>

      {/* Interactive Search Field */}
      <div className="relative shrink-0">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search paid services or dates..."
          className="apple-input pl-9"
        />
      </div>

      {/* Grouped Logs lists */}
      {Object.keys(groupedHistoryByMonth).length === 0 ? (
        <div className="apple-card p-8 text-center flex-1 flex flex-col items-center justify-center">
          <CreditCard className="w-7 h-7 text-slate-300 dark:text-slate-700" />
          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-2.5">No payments recorded yet.</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[180px] text-center font-semibold">
            Mark an upcoming next-week bill as Paid on the Dashboard to start archiving receipts.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-6">
          {Object.entries(groupedHistoryByMonth).map(([monthYear, items]) => (
            <div key={monthYear} className="space-y-2">
              {/* Header Label */}
              <h4 className="apple-section-label flex items-center gap-1.5 mt-2">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" /> {monthYear}
              </h4>

              {/* Items Card list */}
              <div className="apple-card p-0 divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden">
                {items.map((log) => {
                  const statusColors = {
                    paid: 'apple-badge-emerald',
                    delayed: 'apple-badge-amber',
                    carry: 'apple-badge-indigo'
                  };
                  const statusLabels = {
                    paid: 'Paid',
                    delayed: 'Delayed',
                    carry: 'Carried Over'
                  };
                  const currentStatus = log.status || 'paid';

                  return (
                    <div key={log.id} className="p-3.5 flex items-center justify-between gap-3 group hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors">
                      <div className="min-w-0 text-left flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h5 className="text-xs font-semibold text-slate-900 dark:text-white truncate">{log.paymentName}</h5>
                          <span className={`${statusColors[currentStatus]}`}>
                            {statusLabels[currentStatus]}
                          </span>
                          {currentStatus !== 'paid' && onUpdateHistoryStatus && (
                            <button
                              onClick={() => onUpdateHistoryStatus(log.id, 'paid')}
                              className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-900/40 rounded-full text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer hover:scale-105 flex items-center gap-0.5"
                              title="Change status to paid"
                            >
                              ✓ Mark Paid
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">
                            {new Date(log.paidDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                          </span>
                          {log.taggedFor && (
                            <span className="apple-badge-slate px-1.5 py-0.2 rounded-md">
                              For: {log.taggedFor}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right shrink-0">
                          <span className="text-xs font-semibold text-slate-950 dark:text-white block">
                            {formatCurrencyValue(log.amount, log.currency)}
                          </span>
                          {log.currency !== summaryCurrency && (
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 block font-bold mt-0.5">
                              ~ {formatCurrencyValue(convertCurrency(log.amount, log.currency, summaryCurrency, countries), summaryCurrency)}
                            </span>
                          )}
                        </div>

                        {/* Delete log button */}
                        <button
                          onClick={() => onDeleteHistoryEntry(log.id)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
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

