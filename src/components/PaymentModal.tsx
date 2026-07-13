import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, DollarSign, Tag, Info, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { RecurringPayment, Currency, CountryConfig, BillingCycle, UserProfile, PaymentHistory } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payment: Omit<RecurringPayment, 'id'> & { id?: string }) => Promise<void>;
  editingPayment: RecurringPayment | null;
  countries: CountryConfig[];
  preselectedCurrency?: string;
  familyMembers?: UserProfile[];
  payments?: RecurringPayment[];
  history?: PaymentHistory[];
  customizedTags?: string[];
}

const CATEGORIES = [
  'Entertainment',
  'Utilities',
  'Rent',
  'Insurance',
  'Software',
  'Lifestyle',
  'EMI',
  'Education',
  'Investment',
  'Health',
  'Groceries',
  'Other'
];

const BILLING_CYCLES: { value: BillingCycle; label: string; desc: string }[] = [
  { value: 'once', label: 'Once', desc: 'One-off payment' },
  { value: 'weekly', label: 'Weekly', desc: 'Every week' },
  { value: 'monthly', label: 'Monthly', desc: 'Every month' },
  { value: '2-months', label: '2 Mos', desc: 'Every 2 months' },
  { value: '3-months', label: 'Quarterly', desc: 'Every 3 months' },
  { value: '4-months', label: '4 Mos', desc: 'Every 4 months' },
  { value: '6-months', label: 'Semi-Ann', desc: 'Every 6 months' },
  { value: 'yearly', label: 'Yearly', desc: 'Every year' }
];

export default function PaymentModal({ 
  isOpen, 
  onClose, 
  onSave, 
  editingPayment,
  countries = [],
  preselectedCurrency = 'AUD',
  familyMembers = [],
  payments = [],
  history = [],
  customizedTags = ['Bank', 'Home', 'Father', 'Mother', 'Self']
}: PaymentModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>('AUD');
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [category, setCategory] = useState<string>('Software');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [paymentType, setPaymentType] = useState<'fixed' | 'flexi'>('fixed');
  const [paymentMethod, setPaymentMethod] = useState<'manual' | 'direct_debit'>('manual');
  const [startDate, setStartDate] = useState<string>('');
  const [taggedFor, setTaggedFor] = useState('');
  const [autoRenew, setAutoRenew] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Helper to format today's date as YYYY-MM-DD
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val) {
      const parsedDate = new Date(val);
      const day = parsedDate.getDate();
      if (!isNaN(day)) {
        setDayOfMonth(day);
      }
    }
  };

  // Custom Categories state initialized from LocalStorage
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pm_custom_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Merge default categories with custom categories
  const allCategories = React.useMemo(() => {
    const combined = [...CATEGORIES];
    customCategories.forEach(c => {
      if (!combined.some(item => item.toLowerCase() === c.toLowerCase())) {
        combined.push(c);
      }
    });
    return combined;
  }, [customCategories]);

  // Custom Beneficiary Tags state initialized from LocalStorage
  const [customTags, setCustomTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pm_custom_tags');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Dynamically load suggestions from defaults, family, payments, and history
  const allUniqueTags = React.useMemo(() => {
    const familyNames = familyMembers.map(m => m.displayName).filter(Boolean) as string[];
    const paymentTags = payments.map(p => p.taggedFor).filter(Boolean) as string[];
    const historyTags = history.map(h => h.taggedFor).filter(Boolean) as string[];
    
    const combined = [
      ...customizedTags,
      ...familyNames,
      ...paymentTags,
      ...historyTags,
      ...customTags
    ];
    
    const seen = new Set<string>();
    const result: string[] = [];
    combined.forEach(t => {
      const clean = t.trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        result.push(clean);
      }
    });
    return result;
  }, [familyMembers, payments, history, customTags, customizedTags]);

  // Load editing state when modal opens
  useEffect(() => {
    if (editingPayment) {
      setName(editingPayment.name);
      setAmount(String(editingPayment.amount));
      setCurrency(editingPayment.currency);
      setDayOfMonth(editingPayment.dayOfMonth);
      setCategory(editingPayment.category);
      setBillingCycle(editingPayment.billingCycle || 'monthly');
      setReminderDaysBefore(editingPayment.reminderDaysBefore);
      setNotes(editingPayment.notes || '');
      setPaymentType(editingPayment.paymentType || 'fixed');
      setPaymentMethod(editingPayment.paymentMethod || 'manual');
      setStartDate(editingPayment.startDate || getTodayDateString());
      setTaggedFor(editingPayment.taggedFor || '');
      setAutoRenew(editingPayment.autoRenew || false);
    } else {
      // Defaults for new payment
      setName('');
      setAmount('');
      setCurrency(preselectedCurrency || 'AUD');
      setDayOfMonth(1);
      setCategory('Software');
      setBillingCycle('monthly');
      setReminderDaysBefore(3);
      setNotes('');
      setPaymentType('fixed');
      setPaymentMethod('manual');
      setStartDate(getTodayDateString());
      setTaggedFor('');
      setAutoRenew(false);
    }
    setError('');
    setShowAddCategory(false);
    setNewCategoryName('');
  }, [editingPayment, isOpen, preselectedCurrency]);

  const handleAddCategory = () => {
    const cleaned = newCategoryName.trim();
    if (!cleaned) return;
    
    if (allCategories.some(c => c.toLowerCase() === cleaned.toLowerCase())) {
      setError('Category already exists!');
      return;
    }

    const updated = [...customCategories, cleaned];
    setCustomCategories(updated);
    localStorage.setItem('pm_custom_categories', JSON.stringify(updated));
    setCategory(cleaned);
    setNewCategoryName('');
    setShowAddCategory(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a billing name.');
      return;
    }
    
    let finalAmount = amount === '' ? 0 : Number(amount);
    if (paymentType === 'fixed') {
      if (amount === '' || isNaN(Number(amount)) || Number(amount) <= 0) {
        setError('Please enter a valid billing amount.');
        return;
      }
    } else {
      if (amount !== '' && (isNaN(Number(amount)) || Number(amount) < 0)) {
        setError('Please enter a valid billing amount (0 or positive).');
        return;
      }
    }

    if (dayOfMonth < 1 || dayOfMonth > 31) {
      setError('Please enter a billing day between 1 and 31.');
      return;
    }

    const cleanTag = taggedFor.trim();
    if (cleanTag) {
      const defaultAndExistingTags = ['Bank', 'Home', 'Father', 'Mother', 'Self'];
      const familyNames = familyMembers.map(m => m.displayName).filter(Boolean) as string[];
      const paymentTags = payments.map(p => p.taggedFor).filter(Boolean) as string[];
      const historyTags = history.map(h => h.taggedFor).filter(Boolean) as string[];
      const baseTags = [...defaultAndExistingTags, ...familyNames, ...paymentTags, ...historyTags];
      
      if (!baseTags.some(t => t.toLowerCase() === cleanTag.toLowerCase()) && !customTags.some(t => t.toLowerCase() === cleanTag.toLowerCase())) {
        const updatedCustom = [...customTags, cleanTag];
        setCustomTags(updatedCustom);
        localStorage.setItem('pm_custom_tags', JSON.stringify(updatedCustom));
      }
    }

    setIsSaving(true);
    try {
      await onSave({
        id: editingPayment?.id,
        name: name.trim(),
        amount: finalAmount,
        currency,
        dayOfMonth,
        category,
        active: editingPayment ? editingPayment.active : true,
        reminderDaysBefore,
        notes: notes.trim() || undefined,
        paymentType,
        paymentMethod,
        billingCycle,
        startDate: billingCycle !== 'monthly' ? (startDate || getTodayDateString()) : undefined,
        taggedFor: cleanTag || undefined,
        autoRenew: autoRenew
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save payment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            id="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed md:absolute inset-0 bg-black/60 backdrop-blur-sm z-40 cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            id="modal-container"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed md:absolute bottom-0 left-0 right-0 max-h-[85%] bg-white dark:bg-slate-950 rounded-t-[30px] shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-50 flex flex-col overflow-hidden"
          >
            {/* Header notch handle */}
            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-800 rounded-full mx-auto mt-3 shrink-0" />

            {/* Title Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-900 shrink-0">
              <h3 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                {editingPayment ? 'Edit Payment' : 'New Payment'}
              </h3>
              <button
                id="modal-close-btn"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-left">
              {error && (
                <div id="modal-error" className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 p-3 rounded-xl flex items-center gap-2 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label htmlFor="input-name" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Billing / Service Name
                </label>
                <input
                  id="input-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Netflix, AWS, Rent, Gym"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  maxLength={50}
                  required
                />
              </div>

              {/* Amount & Currency Split */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="input-amount" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Amount {paymentType === 'flexi' && '(Optional)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">
                      {countries.find(c => c.currency.toUpperCase() === currency.toUpperCase())?.symbol || '$'}
                    </span>
                    <input
                      id="input-amount"
                      type="number"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={paymentType === 'flexi' ? 'Optional (e.g. 0.00)' : '0.00'}
                      className="w-full pl-6 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      required={paymentType === 'fixed'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Currency
                  </label>
                  <div className="bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 flex gap-0.5 overflow-x-auto no-scrollbar">
                    {countries.map((c) => (
                      <button
                        id={`btn-currency-${c.currency}`}
                        key={c.id}
                        type="button"
                        onClick={() => setCurrency(c.currency)}
                        className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded flex items-center justify-center gap-1 transition-all shrink-0 cursor-pointer ${
                          currency.toUpperCase() === c.currency.toUpperCase()
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="text-[11px]">{c.flag}</span>
                        <span>{c.currency}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Payment Type Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Payment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="btn-paytype-fixed"
                    type="button"
                    onClick={() => setPaymentType('fixed')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      paymentType === 'fixed'
                        ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold block">Fixed / EMI</span>
                    <span className="text-[8px] opacity-85 mt-1 block leading-tight">Constant amount billed per cycle.</span>
                  </button>
                  <button
                    id="btn-paytype-flexi"
                    type="button"
                    onClick={() => setPaymentType('flexi')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      paymentType === 'flexi'
                        ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold block">Flexi Amount</span>
                    <span className="text-[8px] opacity-85 mt-1 block leading-tight">Variable bill. Ask actual amount when logging.</span>
                  </button>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="btn-paymethod-manual"
                    type="button"
                    onClick={() => setPaymentMethod('manual')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      paymentMethod === 'manual'
                        ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold block">Manual Pay</span>
                    <span className="text-[8px] opacity-85 mt-1 block leading-tight">Paid manually by yourself. Shows up as outstanding bill.</span>
                  </button>
                  <button
                    id="btn-paymethod-dd"
                    type="button"
                    onClick={() => setPaymentMethod('direct_debit')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      paymentMethod === 'direct_debit'
                        ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold block">Direct Debit (Auto)</span>
                    <span className="text-[8px] opacity-85 mt-1 block leading-tight">Auto debited on due date. Marked as paid automatically.</span>
                  </button>
                </div>
              </div>

              {/* Billing Cycle Section */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Billing Cycle
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {BILLING_CYCLES.map((cycle) => (
                    <button
                      id={`btn-cycle-${cycle.value}`}
                      key={cycle.value}
                      type="button"
                      onClick={() => setBillingCycle(cycle.value)}
                      title={cycle.desc}
                      className={`py-2 px-0.5 text-[10px] font-semibold rounded-md text-center border transition-all cursor-pointer ${
                        billingCycle === cycle.value
                           ? 'border-indigo-600 bg-indigo-50 text-indigo-600 dark:border-indigo-500 dark:bg-indigo-950/20 dark:text-indigo-400 font-bold'
                           : 'border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-700'
                      }`}
                    >
                      {cycle.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-Renew Checkbox */}
              <div className="flex items-center gap-2.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <input
                  id="input-auto-renew"
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-slate-150 border-slate-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-slate-950 focus:ring-2 dark:bg-slate-900 dark:border-slate-800 cursor-pointer"
                />
                <div className="text-left">
                  <label htmlFor="input-auto-renew" className="block text-xs font-bold text-slate-900 dark:text-white cursor-pointer select-none">
                    Auto-Renew Recurring Payment
                  </label>
                  <p className="text-[9px] text-slate-400 leading-tight mt-0.5 select-none">
                    If checked, marking a monthly payment as paid automatically schedules and records the next month's entry in advance for more accurate forecasting.
                  </p>
                </div>
              </div>

              {/* Day of Month Slider OR Start Date Selector */}
              {billingCycle === 'monthly' ? (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="input-day" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Billing Date (Cycle Day)
                    </label>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Day {dayOfMonth === 1 ? '1 (First)' : dayOfMonth === 31 ? '31 (End)' : dayOfMonth}
                    </span>
                  </div>
                  <input
                    id="input-day"
                    type="range"
                    min="1"
                    max="31"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                    className="w-full accent-indigo-600 dark:accent-indigo-500 my-1 cursor-pointer h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="input-start-date" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Payment Date (Starting From)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <input
                      id="input-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all cursor-pointer"
                      required
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 leading-normal text-left">
                    Pick the precise start/first payment date. Payments will recur from this date.
                  </p>
                </div>
              )}

              {/* Category selector */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Category
                  </label>
                  <button
                    id="btn-toggle-add-cat"
                    type="button"
                    onClick={() => setShowAddCategory(!showAddCategory)}
                    className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    + Add Custom
                  </button>
                </div>

                {/* Inline Add Category form */}
                {showAddCategory && (
                  <div className="mb-2.5 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800 flex gap-1.5 items-center">
                    <input
                      id="input-custom-cat"
                      type="text"
                      placeholder="e.g. Pet Care, Bills"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs text-slate-900 dark:text-white outline-none"
                      maxLength={30}
                    />
                    <button
                      id="btn-save-custom-cat"
                      type="button"
                      onClick={handleAddCategory}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded shadow-sm cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      id="btn-cancel-custom-cat"
                      type="button"
                      onClick={() => {
                        setShowAddCategory(false);
                        setNewCategoryName('');
                      }}
                      className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto pr-1 no-scrollbar">
                  {allCategories.map((cat) => (
                    <button
                      id={`btn-cat-${cat.replace(/\s+/g, '-')}`}
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`py-1.5 px-0.5 text-[10px] font-semibold rounded-md text-center truncate border transition-all cursor-pointer ${
                        category === cat
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-600 dark:border-indigo-500 dark:bg-indigo-950/20 dark:text-indigo-400 font-bold'
                          : 'border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reminder Days Trigger */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="input-reminder-days" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Days Prior to Reminder
                  </label>
                  <span className="text-xs font-bold text-amber-500">
                    {reminderDaysBefore} {reminderDaysBefore === 1 ? 'day' : 'days'}
                  </span>
                </div>
                <input
                  id="input-reminder-days"
                  type="range"
                  min="1"
                  max="7"
                  value={reminderDaysBefore}
                  onChange={(e) => setReminderDaysBefore(parseInt(e.target.value))}
                  className="w-full accent-amber-500 my-1 cursor-pointer h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                />
              </div>

              {/* For Whom Tag */}
              <div>
                <label htmlFor="input-tagged-for" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  For Whom (Beneficiary / Tag)
                </label>
                <input
                  id="input-tagged-for"
                  type="text"
                  value={taggedFor}
                  onChange={(e) => setTaggedFor(e.target.value)}
                  placeholder="e.g. Bank, Father, Mother, Home, Self"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  maxLength={40}
                />
                {/* Suggestions */}
                <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto no-scrollbar">
                  {allUniqueTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTaggedFor(tag)}
                      className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full border transition-all cursor-pointer ${
                        taggedFor.toLowerCase() === tag.toLowerCase()
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400 font-extrabold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="input-notes" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Private Notes (Optional)
                </label>
                <textarea
                  id="input-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Card ending 4452, promo codes..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-14 resize-none"
                  maxLength={150}
                />
              </div>

              {/* Error near Save Button */}
              {error && (
                <div id="modal-submit-error" className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100/60 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 p-2.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold mt-2 shrink-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <div className="flex-1 text-left leading-snug">
                    <span className="font-extrabold uppercase tracking-wider block text-[9px] text-rose-500 mb-0.5">Save Error</span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex gap-2 pb-6 shrink-0">
                <button
                  id="btn-modal-cancel"
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-modal-submit"
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 bg-indigo-600 disabled:bg-indigo-400 text-white font-bold text-xs rounded-lg shadow hover:bg-indigo-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingPayment ? 'Save Changes' : 'Save Payment'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
