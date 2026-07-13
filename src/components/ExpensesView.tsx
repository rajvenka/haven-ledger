import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Globe, 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  Check, 
  Edit, 
  X,
  CreditCard,
  ChevronRight,
  Info
} from 'lucide-react';
import { RecurringPayment, CountryConfig, PaymentHistory, CATEGORY_COLORS, getCategoryColor } from '../types';
import { formatCurrencyValue, getDaysUntilPayment, getPaymentsDueCurrentMonth, isPaymentPaidForCurrentPeriod } from '../utils/paymentUtils';

interface ExpensesViewProps {
  payments: RecurringPayment[];
  history: PaymentHistory[];
  countries: CountryConfig[];
  defaultCurrency?: string;
  onAddCountry: (country: Omit<CountryConfig, 'id'>) => Promise<void>;
  onDeleteCountry: (id: string) => Promise<void>;
  onUpdateCountry: (country: CountryConfig) => Promise<void>;
  onAddExpenseClick: (preselectedCurrency: string) => void;
  onRecordPayment: (payment: RecurringPayment) => Promise<void>;
  isReadOnly?: boolean;
  currentUserUid?: string;
}

export default function ExpensesView({
  payments,
  history,
  countries,
  defaultCurrency,
  onAddCountry,
  onDeleteCountry,
  onUpdateCountry,
  onAddExpenseClick,
  onRecordPayment,
  isReadOnly = false,
  currentUserUid
}: ExpensesViewProps) {
  const isPaymentReadOnly = (payment: RecurringPayment) => {
    if (!isReadOnly) return false;
    if (currentUserUid && payment.userId === currentUserUid) return false;
    return true;
  };
  // Local active country tab selection
  const [activeTabCountryId, setActiveTabCountryId] = useState<string>('');
  
  React.useEffect(() => {
    if (defaultCurrency && !activeTabCountryId) {
      const match = countries.find(c => c.currency.toUpperCase() === defaultCurrency.toUpperCase());
      if (match) {
        setActiveTabCountryId(match.id);
      } else if (countries.length > 0) {
        setActiveTabCountryId(countries[0].id);
      }
    }
  }, [defaultCurrency, countries, activeTabCountryId]);

  const [isManagingCountries, setIsManagingCountries] = useState(false);
  
  // New Country form state
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryCurrency, setNewCountryCurrency] = useState('');
  const [newCountrySymbol, setNewCountrySymbol] = useState('');
  const [newCountryFlag, setNewCountryFlag] = useState('');
  const [newCountryRate, setNewCountryRate] = useState<number>(1.0);
  
  // Edit Rate form state
  const [editingCountryId, setEditingCountryId] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<string>('');

  // Auto-select the first country in the list if activeTabCountryId is empty or invalid
  const resolvedActiveCountry = countries.find(c => c.id === activeTabCountryId) || countries[0];
  const activeCountry = resolvedActiveCountry;
  
  const isAllSelected = activeTabCountryId === 'ALL';
  const activeCurrency = activeCountry ? activeCountry.currency : 'AUD';
  
  // Filter payments specifically for the active selection
  const filteredPayments = isAllSelected
    ? payments
    : payments.filter(p => p.currency.toUpperCase() === activeCurrency.toUpperCase());
  
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Helper function to convert any currency to another using our country configurations
  const convertCurrency = (amount: number, fromCurr: string, toCurr: string) => {
    if (fromCurr.toUpperCase() === toCurr.toUpperCase()) return amount;
    const fromCountry = countries.find(c => c.currency.toUpperCase() === fromCurr.toUpperCase());
    const toCountry = countries.find(c => c.currency.toUpperCase() === toCurr.toUpperCase());
    if (!fromCountry || !toCountry) return amount;
    const audAmount = amount / fromCountry.rateToAUD;
    return audAmount * toCountry.rateToAUD;
  };
  
  // 1. Paid So Far this month (converted to default currency if "ALL")
  const paidSoFar = history
    .filter(h => h.paidDate.startsWith(currentMonthStr))
    .reduce((sum, h) => {
      if (isAllSelected) {
        return sum + convertCurrency(h.amount, h.currency, defaultCurrency || 'AUD');
      }
      return h.currency.toUpperCase() === activeCurrency.toUpperCase() ? sum + h.amount : sum;
    }, 0);

  // 2. Due Next Week (converted to default currency if "ALL")
  const dueNextWeek = filteredPayments
    .filter(p => p.active)
    .filter(p => {
      const days = getDaysUntilPayment(p, new Date(), history);
      return days >= 0 && days <= 7;
    })
    .reduce((sum, p) => {
      if (isAllSelected) {
        return sum + convertCurrency(p.amount, p.currency, defaultCurrency || 'AUD');
      }
      return sum + p.amount;
    }, 0);

  // 3. Due remaining this month (converted to default currency if "ALL")
  const dueRemainingMonth = getPaymentsDueCurrentMonth(filteredPayments, new Date(), history)
    .reduce((sum, p) => {
      if (isAllSelected) {
        return sum + convertCurrency(p.amount, p.currency, defaultCurrency || 'AUD');
      }
      return sum + p.amount;
    }, 0);

  const metricsCurrency = isAllSelected ? (defaultCurrency || 'AUD') : activeCurrency;
  const shouldRenderContent = activeCountry || isAllSelected;

  const handleCreateCountrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCountryName.trim() || !newCountryCurrency.trim() || !newCountrySymbol.trim()) return;

    try {
      await onAddCountry({
        name: newCountryName.trim(),
        currency: newCountryCurrency.trim().toUpperCase(),
        symbol: newCountrySymbol.trim(),
        flag: newCountryFlag.trim() || '🌐',
        rateToAUD: Number(newCountryRate) || 1.0
      });
      // Reset form
      setNewCountryName('');
      setNewCountryCurrency('');
      setNewCountrySymbol('');
      setNewCountryFlag('');
      setNewCountryRate(1.0);
      setIsManagingCountries(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateRate = async (country: CountryConfig) => {
    const rateVal = parseFloat(editingRate);
    if (!isNaN(rateVal) && rateVal > 0) {
      await onUpdateCountry({
        ...country,
        rateToAUD: rateVal
      });
      setEditingCountryId(null);
      setEditingRate('');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-4 text-left select-none bg-slate-50 dark:bg-slate-900">
      
      {isReadOnly && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300 shrink-0">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
          <div className="flex-1 text-left">
            <span className="font-bold">View-Only Mode:</span> You have view-only access to this family group. All country, bill, and payment modifications are disabled.
          </div>
        </div>
      )}
      
      {/* Dynamic Tabs list for countries */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-indigo-600" />
          </div>
          <button 
            onClick={() => setIsManagingCountries(!isManagingCountries)}
            className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 rounded"
          >
            {isManagingCountries ? 'Close Setup' : 'Manage Countries'}
          </button>
        </div>

        {/* Dynamic Horizontal Scrolling Tab Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
          {/* ALL tab option */}
          <button
            onClick={() => {
              setActiveTabCountryId('ALL');
              setIsManagingCountries(false);
            }}
            className={`px-3.5 py-2.5 rounded-xl border flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              isAllSelected
                ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white shadow-sm font-bold' 
                : 'bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950'
            }`}
          >
            <span className="text-base leading-none">🌍</span>
            <div className="text-left">
              <p className="text-[10px] leading-tight font-black tracking-tight uppercase">
                ALL
              </p>
              <p className={`text-[8px] leading-tight opacity-80 ${isAllSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                All Expenses
              </p>
            </div>
          </button>

          {countries.map((c) => {
            const isSelected = !isAllSelected && activeCountry && activeCountry.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveTabCountryId(c.id);
                  setIsManagingCountries(false);
                }}
                className={`px-3.5 py-2.5 rounded-xl border flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white shadow-sm font-bold' 
                    : 'bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <div className="text-left">
                  <p className="text-[10px] leading-tight font-black tracking-tight uppercase">
                    {c.currency}
                  </p>
                  <p className={`text-[8px] leading-tight opacity-80 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {c.name}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slide down form for Managing/Adding Countries */}
      {isManagingCountries && (
        <div className="apple-card space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-900">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Configure Countries</h4>
            <button onClick={() => setIsManagingCountries(false)}>
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
            </button>
          </div>

          {/* Current Countries Rate Manager list */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exchange Rates (Relative to 1 AUD)</p>
            {countries.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850/50">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm">{c.flag}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.name} ({c.currency})</p>
                    <p className="text-[9px] text-slate-400">Symbol: {c.symbol} • Rate: {c.rateToAUD}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {editingCountryId === c.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={editingRate}
                        onChange={(e) => setEditingRate(e.target.value)}
                        placeholder="Rate"
                        className="w-16 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs text-right text-slate-900 dark:text-white"
                        required
                      />
                      <button 
                        onClick={() => handleUpdateRate(c)}
                        className="p-1 bg-indigo-650 dark:bg-indigo-500 text-white rounded hover:bg-indigo-700"
                        title="Save rate"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setEditingCountryId(null)}
                        className="p-1 bg-slate-200 dark:bg-slate-800 text-slate-600 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {!isReadOnly ? (
                        <>
                          <button
                            onClick={() => {
                              setEditingCountryId(c.id);
                              setEditingRate(String(c.rateToAUD));
                            }}
                            className="p-1 text-slate-500 hover:text-indigo-605 rounded"
                            title="Edit exchange rate"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {/* Delete button only allowed for user added countries (not AUD or INR essential ones) */}
                          {c.currency !== 'AUD' && c.currency !== 'INR' && (
                            <button
                              onClick={() => onDeleteCountry(c.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Remove country"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">Locked</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add custom Country Form */}
          {!isReadOnly && (
            <form onSubmit={handleCreateCountrySubmit} className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-850/80">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Add Custom Country</span>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Country Name</label>
                  <input
                    type="text"
                    placeholder="Singapore"
                    value={newCountryName}
                    onChange={(e) => setNewCountryName(e.target.value)}
                    className="apple-input"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Currency Code (3 Chars)</label>
                  <input
                    type="text"
                    placeholder="SGD"
                    maxLength={3}
                    value={newCountryCurrency}
                    onChange={(e) => setNewCountryCurrency(e.target.value)}
                    className="apple-input"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Symbol</label>
                  <input
                    type="text"
                    placeholder="S$"
                    value={newCountrySymbol}
                    onChange={(e) => setNewCountrySymbol(e.target.value)}
                    className="apple-input"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Emoji Flag</label>
                  <input
                    type="text"
                    placeholder="🇸🇬"
                    value={newCountryFlag}
                    onChange={(e) => setNewCountryFlag(e.target.value)}
                    className="apple-input"
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Rate from 1 AUD (e.g. 1 AUD = SGD?)</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="0.91"
                  value={newCountryRate}
                  onChange={(e) => setNewCountryRate(parseFloat(e.target.value))}
                  className="apple-input"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Country Tab
              </button>
            </form>
          )}
        </div>
      )}

      {shouldRenderContent && (
        <>
          {/* HIGH DENSITY HERO METRIC CARD GRID */}
          <div className="grid grid-cols-3 gap-3">
            
            {/* Metric 1: Paid So Far */}
            <div className="apple-card p-3 flex flex-col justify-between text-left">
              <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Paid (Month)
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-white mt-1.5 tracking-tight truncate">
                {formatCurrencyValue(paidSoFar, metricsCurrency, countries)}
              </p>
            </div>

            {/* Metric 2: Upcoming next week */}
            <div className="apple-card p-3 flex flex-col justify-between text-left">
              <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Next Week
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-white mt-1.5 tracking-tight truncate">
                {formatCurrencyValue(dueNextWeek, metricsCurrency, countries)}
              </p>
            </div>

            {/* Metric 3: Remaining this month */}
            <div className="apple-card p-3 flex flex-col justify-between text-left">
              <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Remaining
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-white mt-1.5 tracking-tight truncate">
                {formatCurrencyValue(dueRemainingMonth, metricsCurrency, countries)}
              </p>
            </div>

          </div>

          {/* ACTIVE EXPENSE TRACKER LIST FOR SELECTED COUNTRY */}
          <div className="apple-card flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-850/60">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {isAllSelected ? (
                    <>🌍 All Countries Payments ({filteredPayments.length})</>
                  ) : (
                    <>{activeCountry.flag} {activeCountry.name} Payments ({filteredPayments.length})</>
                  )}
                </h4>
              </div>
              
              {!isReadOnly && (
                <button
                  onClick={() => onAddExpenseClick(isAllSelected ? (defaultCurrency || 'AUD') : activeCurrency)}
                  className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100/60 border border-indigo-100/10 text-indigo-650 dark:text-indigo-400 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add {isAllSelected ? (defaultCurrency || 'AUD') : activeCurrency} Expense
                </button>
              )}
            </div>

            {filteredPayments.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <Info className="w-7 h-7 text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-bold text-slate-400 mt-2">
                  {isAllSelected ? 'No expenses added yet.' : `No expenses added for ${activeCountry.name} yet.`}
                </p>
                <p className="text-[10px] text-slate-450 mt-1 max-w-[200px]">
                  Click the add button above to configure a recurring payment in {isAllSelected ? (defaultCurrency || 'AUD') : activeCurrency}.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-900/60 overflow-y-auto flex-1 mt-1 pr-1">
                 {filteredPayments.map((p) => {
                  const days = getDaysUntilPayment(p, new Date(), history);
                  const isDueSoon = days >= 0 && days <= 7;
                  const colorConfig = getCategoryColor(p.category);
                  const isPaidThisPeriod = isPaymentPaidForCurrentPeriod(p, history, new Date());
                  const isDirectDebit = p.paymentMethod === 'direct_debit';
                  
                  return (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-left">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isAllSelected && (
                            <span className="text-[10px] leading-none shrink-0" title={countries.find(c => c.currency.toUpperCase() === p.currency.toUpperCase())?.name}>
                              {countries.find(c => c.currency.toUpperCase() === p.currency.toUpperCase())?.flag || '🌐'}
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {p.name}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[7px] font-extrabold ${colorConfig.bg}`}>
                            {p.category}
                          </span>
                          {isDirectDebit && (
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                              Auto-DD ⚡
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 font-medium">
                          <span>Billing on day {p.dayOfMonth}</span>
                          <span>•</span>
                          <span className={isDueSoon ? 'text-amber-500 font-extrabold' : 'text-slate-400'}>
                            {days === 0 ? 'Due today 🚨' : days === 1 ? 'Due tomorrow' : `In ${days} days`}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {formatCurrencyValue(p.amount, p.currency, countries)}
                        </span>
                        
                        {/* Record Payment Button / Paid Badge */}
                        {isPaidThisPeriod ? (
                          <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-[10px] font-black rounded-md flex items-center gap-1 border border-slate-200 dark:border-slate-850">
                            <span className="w-1 h-1 rounded-full bg-slate-400" /> Paid ✓
                          </span>
                        ) : (
                          <button
                            disabled={isPaymentReadOnly(p)}
                            onClick={() => onRecordPayment(p)}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${
                              isPaymentReadOnly(p)
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700/50'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 cursor-pointer'
                            }`}
                            title={isPaymentReadOnly(p) ? 'Disabled in View-Only' : 'Record payment into history'}
                          >
                            {isPaymentReadOnly(p) ? 'View Only' : 'To Be Paid'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}
