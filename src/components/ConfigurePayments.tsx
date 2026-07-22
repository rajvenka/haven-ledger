import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  ToggleLeft, 
  ToggleRight, 
  Info,
  Settings,
  ClipboardList,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  History,
  LayoutList,
  LayoutGrid,
  Sliders,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { RecurringPayment, getCategoryColor, BillingCycle, PaymentCategory, PaymentHistory } from '../types';
import { formatCurrencyValue } from '../utils/paymentUtils';

interface ConfigurePaymentsProps {
  payments: RecurringPayment[];
  history?: PaymentHistory[];
  showFrequencyPatterns?: boolean;
  onAddClick: () => void;
  onEditClick: (payment: RecurringPayment) => void;
  onCloneClick?: (payment: RecurringPayment) => void;
  onDeleteClick: (id: string) => void;
  onUpdatePayment: (payment: RecurringPayment) => void;
  customizedTags?: string[];
  onSaveCustomizedTags?: (tags: string[]) => void;
  onAddBulkPayments?: (payments: Omit<RecurringPayment, 'id'>[]) => Promise<any>;
  onUpdatePaymentsOrder?: (orderedPayments: RecurringPayment[]) => void;
  isReadOnly?: boolean;
  currentUserUid?: string;
}

interface BulkRow {
  key: string;
  name: string;
  amount: string;
  currency: string;
  category: string;
  dayOfMonth: string;
  reminderDaysBefore: string;
  paymentType: 'fixed' | 'flexi';
  billingCycle: BillingCycle;
  taggedFor: string;
  notes: string;
}

const CATEGORIES: PaymentCategory[] = [
  'Entertainment', 'Utilities', 'Rent', 'Insurance', 'Software', 
  'Lifestyle', 'EMI', 'Education', 'Investment', 'Health', 
  'Groceries', 'Other'
];

const CURRENCIES = ['AUD', 'INR', 'USD', 'GBP', 'EUR', 'SGD', 'NZD', 'CAD'];
const BILLING_CYCLES: BillingCycle[] = [
  'weekly', 'monthly', '2-months', '3-months', '4-months', '6-months', 'yearly', 'once'
];

export default function ConfigurePayments({
  payments,
  history = [],
  showFrequencyPatterns = true,
  onAddClick,
  onEditClick,
  onCloneClick,
  onDeleteClick,
  onUpdatePayment,
  customizedTags = ['Bank', 'Home', 'Father', 'Mother', 'Self'],
  onSaveCustomizedTags,
  onAddBulkPayments,
  onUpdatePaymentsOrder,
  isReadOnly = false,
  currentUserUid
}: ConfigurePaymentsProps) {
  const [showInstructions, setShowInstructions] = useState(() => {
    const saved = localStorage.getItem('bills_show_instructions');
    return saved === 'true';
  });
  const toggleInstructions = () => {
    const next = !showInstructions;
    setShowInstructions(next);
    localStorage.setItem('bills_show_instructions', String(next));
  };
  const isPaymentReadOnly = (payment: RecurringPayment) => {
    if (!isReadOnly) return false;
    if (currentUserUid && payment.userId === currentUserUid) return false;
    return true;
  };

  const getPaymentHistoryStats = (paymentId: string) => {
    const paymentHistory = history.filter(h => h.paymentId === paymentId);
    
    const sortedHistory = [...paymentHistory].sort((a, b) => {
      return new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime();
    });
    
    const totalPaidCount = paymentHistory.length;
    
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    
    const lastYearHistory = paymentHistory.filter(h => {
      const d = new Date(h.paidDate);
      return d >= oneYearAgo && d <= now;
    });
    const lastYearCount = lastYearHistory.length;
    
    const totalAmount = paymentHistory.reduce((sum, h) => sum + h.amount, 0);
    const avgAmount = totalPaidCount > 0 ? totalAmount / totalPaidCount : 0;
    
    const lastPaid = sortedHistory.length > 0 ? sortedHistory[0] : null;
    
    const last6Months: { monthName: string; yearMonth: string; paid: boolean; amount?: number }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(now.getMonth() - i);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const monthName = monthNames[mIdx];
      const yearMonthStr = `${yr}-${String(mIdx + 1).padStart(2, '0')}`;
      
      const match = paymentHistory.find(h => h.paidDate.startsWith(yearMonthStr));
      last6Months.push({
        monthName,
        yearMonth: yearMonthStr,
        paid: !!match,
        amount: match?.amount
      });
    }
    
    return {
      totalPaidCount,
      lastYearCount,
      avgAmount,
      lastPaid,
      last6Months
    };
  };
  const [activeTab, setActiveTab] = useState<'list' | 'bulk'>('list');
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Reordering & Category Grouping states
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [cardStyle, setCardStyle] = useState<'modern' | 'compact'>(() => {
    const saved = localStorage.getItem('pm_card_style');
    return saved === 'compact' ? 'compact' : 'modern'; // bento removed - any stale value falls back to modern
  });

  const handleCardStyleChange = (style: 'modern' | 'compact') => {
    setCardStyle(style);
    localStorage.setItem('pm_card_style', style);
  };
  
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const movePayment = (currentIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= payments.length) return;
    
    const updated = [...payments];
    const temp = updated[currentIdx];
    updated[currentIdx] = updated[targetIdx];
    updated[targetIdx] = temp;
    
    if (onUpdatePaymentsOrder) {
      onUpdatePaymentsOrder(updated);
    }
  };
  
  // Bulk state
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);

  // Initialize empty bulk template rows
  const handleOpenBulkTab = () => {
    setActiveTab('bulk');
    setErrorMessage(null);
    setSuccessMessage(null);
    if (bulkRows.length === 0) {
      setBulkRows([
        createEmptyRow('Netflix', '18.99', 'Entertainment', '15'),
        createEmptyRow('Rent', '2400', 'Rent', '1'),
        createEmptyRow('Electricity', '150', 'Utilities', '20')
      ]);
    }
  };

  const createEmptyRow = (name = '', amount = '', category = 'Entertainment', dayOfMonth = '1'): BulkRow => ({
    key: Math.random().toString(36).substring(2, 9),
    name,
    amount,
    currency: 'AUD',
    category,
    dayOfMonth,
    reminderDaysBefore: '2',
    paymentType: 'fixed',
    billingCycle: 'monthly',
    taggedFor: 'Self',
    notes: ''
  });

  const handleAddRow = () => {
    setBulkRows(prev => [...prev, createEmptyRow()]);
  };

  const handleDeleteRow = (key: string) => {
    setBulkRows(prev => prev.filter(r => r.key !== key));
  };

  const handleUpdateRowValue = (key: string, field: keyof BulkRow, value: string) => {
    setBulkRows(prev => prev.map(row => {
      if (row.key === key) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  const handleClearAllRows = () => {
    setBulkRows([]);
  };

  // CSV/TSV/JSON copy-paste parser
  const handleParsePaste = () => {
    const trimmedText = pasteText.trim();
    if (!trimmedText) return;
    
    let parsedRows: BulkRow[] = [];
    let isJson = false;

    // Try parsing as JSON first
    if (trimmedText.startsWith('[') || trimmedText.startsWith('{')) {
      try {
        const jsonObj = JSON.parse(trimmedText);
        let items: any[] = [];
        if (Array.isArray(jsonObj)) {
          items = jsonObj;
        } else if (jsonObj && typeof jsonObj === 'object') {
          const possibleArray = Object.values(jsonObj).find(val => Array.isArray(val));
          if (possibleArray) {
            items = possibleArray as any[];
          } else {
            items = [jsonObj];
          }
        }

        if (items.length > 0) {
          isJson = true;
          items.forEach(item => {
            if (item && typeof item === 'object') {
              const name = item.name || item.billName || item.paymentName || item.taggedFor || '';
              if (!name) return;

              const amount = item.amount !== undefined ? String(item.amount) : '';
              const rawCurrency = (item.currency || 'AUD').toUpperCase();
              const currency = CURRENCIES.includes(rawCurrency) ? rawCurrency : 'AUD';
              
              const rawCat = item.category || 'Other';
              const matchedCat = CATEGORIES.find(c => c.toLowerCase() === rawCat.toLowerCase()) || 'Other';
              
              const dayOfMonth = item.dayOfMonth !== undefined ? String(item.dayOfMonth) : '1';
              const reminderDaysBefore = item.reminderDaysBefore !== undefined ? String(item.reminderDaysBefore) : '2';
              const paymentType = item.paymentType === 'flexi' ? 'flexi' : 'fixed';
              
              const rawCycle = item.billingCycle || item.frequency || 'monthly';
              const billingCycle = (BILLING_CYCLES.includes(rawCycle as any) ? rawCycle : 'monthly') as BillingCycle;
              
              const rawTag = item.taggedFor || 'Self';
              const taggedFor = customizedTags.find(t => t.toLowerCase() === rawTag.toLowerCase()) || rawTag;

              const notes = item.notes || '';

              parsedRows.push({
                key: Math.random().toString(36).substring(2, 9),
                name,
                amount,
                currency,
                category: matchedCat,
                dayOfMonth: Math.min(31, Math.max(1, parseInt(dayOfMonth) || 1)).toString(),
                reminderDaysBefore: Math.max(0, parseInt(reminderDaysBefore) || 0).toString(),
                paymentType,
                billingCycle,
                taggedFor,
                notes
              });
            }
          });
        }
      } catch (e) {
        console.warn('Attempted JSON parse but fell back to CSV:', e);
      }
    }

    if (!isJson) {
      // Split by lines
      const lines = trimmedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      lines.forEach(line => {
        // Split by tab (Excel/Google sheets default paste) or comma
        let parts = line.split('\t');
        if (parts.length <= 1) {
          parts = line.split(',');
        }
        
        parts = parts.map(p => p.trim().replace(/^["']|["']$/g, ''));
        
        if (parts.length > 0 && parts[0]) {
          const name = parts[0] || '';
          const amount = parts[1] ? parts[1].replace(/[^0-9.]/g, '') : '';
          const rawCurrency = parts[2] ? parts[2].toUpperCase() : 'AUD';
          const currency = CURRENCIES.includes(rawCurrency) ? rawCurrency : 'AUD';
          
          const rawCat = parts[3] || 'Entertainment';
          const matchedCat = CATEGORIES.find(c => c.toLowerCase() === rawCat.toLowerCase()) || 'Other';
          
          const dayOfMonth = parts[4] ? parts[4].replace(/[^0-9]/g, '') : '1';
          const reminderDaysBefore = parts[5] ? parts[5].replace(/[^0-9]/g, '') : '2';
          
          const paymentType = parts[6]?.toLowerCase() === 'flexi' ? 'flexi' : 'fixed';
          
          const rawCycle = parts[7] || 'monthly';
          const billingCycle = (BILLING_CYCLES.includes(rawCycle as any) ? rawCycle : 'monthly') as BillingCycle;
          
          const rawTag = parts[8] || 'Self';
          const taggedFor = customizedTags.find(t => t.toLowerCase() === rawTag.toLowerCase()) || 'Self';
          
          const notes = parts[9] || '';

          parsedRows.push({
            key: Math.random().toString(36).substring(2, 9),
            name,
            amount,
            currency,
            category: matchedCat,
            dayOfMonth: Math.min(31, Math.max(1, parseInt(dayOfMonth) || 1)).toString(),
            reminderDaysBefore: Math.max(0, parseInt(reminderDaysBefore) || 0).toString(),
            paymentType,
            billingCycle,
            taggedFor,
            notes
          });
        }
      });
    }

    if (parsedRows.length > 0) {
      setBulkRows(prev => {
        const hasEdited = prev.some(r => r.name || r.amount);
        return hasEdited ? [...prev, ...parsedRows] : parsedRows;
      });
      setPasteText('');
      setShowPasteBox(false);
      setSuccessMessage(`Parsed ${parsedRows.length} bill/payment lines successfully from ${isJson ? 'JSON' : 'CSV/TSV'}! Review and save them in the grid below.`);
      setErrorMessage(null);
    } else {
      setErrorMessage('Could not parse any rows. Ensure your pasted content contains a name and valid format.');
    }
  };

  // Batch Save to DB
  const handleSaveBulk = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Filter out completely blank rows
    const filledRows = bulkRows.filter(r => r.name.trim().length > 0);

    if (filledRows.length === 0) {
      setErrorMessage('Please add at least one bill/payment with a valid name.');
      return;
    }

    // Validation
    const validatedPayments: Omit<RecurringPayment, 'id'>[] = [];
    
    for (let i = 0; i < filledRows.length; i++) {
      const row = filledRows[i];
      const amountVal = parseFloat(row.amount);
      const dayVal = parseInt(row.dayOfMonth);
      const alertVal = parseInt(row.reminderDaysBefore);

      if (!row.name.trim()) {
        setErrorMessage(`Row ${i + 1} has an empty name.`);
        return;
      }
      if (isNaN(amountVal) || amountVal <= 0) {
        setErrorMessage(`Row ${i + 1} (${row.name}) has an invalid amount. Must be a positive number.`);
        return;
      }
      if (isNaN(dayVal) || dayVal < 1 || dayVal > 31) {
        setErrorMessage(`Row ${i + 1} (${row.name}) has an invalid billing day. Must be between 1 and 31.`);
        return;
      }
      if (isNaN(alertVal) || alertVal < 0) {
        setErrorMessage(`Row ${i + 1} (${row.name}) has an invalid reminder days count.`);
        return;
      }

      validatedPayments.push({
        name: row.name.trim(),
        amount: amountVal,
        currency: row.currency,
        category: row.category,
        dayOfMonth: dayVal,
        reminderDaysBefore: alertVal,
        active: true,
        paymentType: row.paymentType,
        billingCycle: row.billingCycle,
        taggedFor: row.taggedFor,
        notes: row.notes.trim() || undefined
      });
    }

    setIsSavingBulk(true);
    try {
      if (onAddBulkPayments) {
        await onAddBulkPayments(validatedPayments);
        setSuccessMessage(`Successfully imported all ${validatedPayments.length} payments/bills!`);
        setBulkRows([]);
        // Short delay, then go back to the list
        setTimeout(() => {
          setActiveTab('list');
        }, 1500);
      } else {
        setErrorMessage('Bulk save action is not available.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to save bulk bills/payments. Please try again.');
    } finally {
      setIsSavingBulk(false);
    }
  };

  // Toggle billing status (Active vs Paused) for single bill/payment
  const handleToggleActive = (payment: RecurringPayment) => {
    if (isPaymentReadOnly(payment)) return;
    onUpdatePayment({
      ...payment,
      active: !payment.active
    });
  };

  // Render a payment item according to current selected layout style (Modern, Compact, or Bento)
  const renderPaymentCard = (payment: RecurringPayment, idx: number) => {
    const colorConfig = getCategoryColor(payment.category);
    const stats = getPaymentHistoryStats(payment.id);

    if (cardStyle === 'compact') {
      return (
        <div 
          key={payment.id}
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/80 rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all ${
            payment.active 
              ? 'border-slate-200/80 dark:border-slate-800/80' 
              : 'bg-slate-50/55 dark:bg-slate-950/20 border-slate-100 dark:border-slate-900/60 opacity-70'
          }`}
        >
          {/* Left Block: Dot, Name, Cycle, Tag */}
          <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorConfig.iconBg || 'bg-indigo-500'}`} title={payment.category} />
            <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {payment.name}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5 sm:mt-0 flex-wrap">
                <span className="text-[9px] text-slate-400 font-medium">
                  {payment.billingCycle === 'monthly' ? `D${payment.dayOfMonth}` : payment.startDate ? `Starts ${payment.startDate}` : `D${payment.dayOfMonth}`}
                </span>
                <span className="text-slate-300 dark:text-slate-800 text-[9px]">•</span>
                <span className="px-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[8px] font-black rounded uppercase">
                  {payment.billingCycle || 'monthly'}
                </span>
                {payment.taggedFor && (
                  <>
                    <span className="text-slate-300 dark:text-slate-800 text-[9px]">•</span>
                    <span className="px-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[8px] font-bold rounded">
                      {payment.taggedFor}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Block: Amount, Toggle, Reordering, and Action tools */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-900">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {formatCurrencyValue(payment.amount, payment.currency)}
              </span>
                         {/* Active Toggle */}
              <button
                disabled={isPaymentReadOnly(payment)}
                onClick={() => handleToggleActive(payment)}
                className={`focus:outline-none shrink-0 ${isPaymentReadOnly(payment) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                title={isPaymentReadOnly(payment) ? 'Disabled in View-Only' : (payment.active ? 'Pause monitoring' : 'Resume monitoring')}
              >
                {payment.active ? (
                  <ToggleRight className="w-5 h-5 text-indigo-600 dark:text-indigo-500" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-0.5">
              {/* Position controls */}
              <button
                onClick={() => movePayment(idx, 'up')}
                disabled={idx === 0 || isPaymentReadOnly(payment)}
                className={`p-1 rounded transition-colors ${
                  idx === 0 || isPaymentReadOnly(payment)
                    ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed opacity-50'
                    : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer'
                }`}
                title="Move position Up"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => movePayment(idx, 'down')}
                disabled={idx === payments.length - 1 || isPaymentReadOnly(payment)}
                className={`p-1 rounded transition-colors ${
                  idx === payments.length - 1 || isPaymentReadOnly(payment)
                    ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed opacity-50'
                    : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer'
                }`}
                title="Move position Down"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {/* Edit */}
              <button
                disabled={isPaymentReadOnly(payment)}
                onClick={() => onEditClick(payment)}
                className={`p-1 rounded transition-colors ${
                  isPaymentReadOnly(payment)
                    ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed opacity-50'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer'
                }`}
                title="Edit Details"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              {/* Clone */}
              {onCloneClick && (
                <button
                  onClick={() => onCloneClick(payment)}
                  className="p-1 rounded transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                  title="Clone"
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
              {/* Trash */}
              <button
                disabled={isPaymentReadOnly(payment)}
                onClick={() => onDeleteClick(payment.id)}
                className={`p-1 rounded transition-colors ${
                  isPaymentReadOnly(payment)
                    ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed opacity-50'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 hover:text-rose-500 cursor-pointer'
                }`}
                title="Delete Bill"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Default 'modern' design (the original design card matching all colors/paddings exactly)
    return (
      <div 
        key={payment.id}
        className={`apple-card p-4 transition-all ${
          payment.active 
            ? '' 
            : 'bg-slate-50/55 dark:bg-slate-950/20 opacity-70'
        }`}
      >
        {/* Upper line: Category Badge, Name, and Status Switch */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 text-left">
            {/* Category Label (only shown if not grouped by category) */}
            {!groupByCategory && (
              <div className={`px-2 py-0.5 rounded text-[8px] font-extrabold shrink-0 ${colorConfig.bg}`}>
                {payment.category}
              </div>
            )}
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug truncate">
                {payment.name}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-medium flex-wrap">
                <span>{payment.billingCycle === 'monthly' ? `Day ${payment.dayOfMonth}` : payment.startDate ? `Starts ${payment.startDate}` : `Day ${payment.dayOfMonth}`}</span>
                <span>•</span>
                <span>Alert {payment.reminderDaysBefore}d before</span>
                <span>•</span>
                <span className={`px-1 rounded text-[8px] font-bold ${payment.paymentType === 'flexi' ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/40' : 'bg-slate-100 dark:bg-slate-900 text-slate-650 dark:text-slate-350'}`}>
                  {payment.paymentType === 'flexi' ? 'Flexi' : 'Fixed'}
                </span>
                <span>•</span>
                <span className="px-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[8px] font-extrabold rounded uppercase">
                  {payment.billingCycle || 'monthly'}
                </span>
                {payment.taggedFor && (
                  <>
                    <span>•</span>
                    <span className="px-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[8px] font-bold rounded">
                      Tag: {payment.taggedFor}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Status Toggle Switch */}
          <button
            disabled={isPaymentReadOnly(payment)}
            onClick={() => handleToggleActive(payment)}
            className={`focus:outline-none shrink-0 ${isPaymentReadOnly(payment) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            title={isPaymentReadOnly(payment) ? 'Disabled in View-Only' : (payment.active ? 'Pause monitoring' : 'Resume monitoring')}
          >
            {payment.active ? (
              <ToggleRight className="w-7 h-7 text-indigo-600 dark:text-indigo-500" />
            ) : (
              <ToggleLeft className="w-7 h-7 text-slate-400" />
            )}
          </button>
        </div>

        {/* Optional private notes */}
        {payment.notes && (
          <div className="mt-2 text-[10px] text-slate-450 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-900/40 p-2 rounded border border-slate-100 dark:border-slate-900 line-clamp-2 leading-relaxed">
            "{payment.notes}"
          </div>
        )}

        {/* Historical Frequency & Patterns Mini Card */}
        {showFrequencyPatterns && (
          <div className="mt-3 p-2.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-lg border border-slate-150 dark:border-slate-850/80 text-left">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-450">
                <History className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-wider">Billing Frequency & Patterns</span>
              </div>
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500">
                {stats.totalPaidCount === 0 ? 'No history' : `${stats.totalPaidCount} log${stats.totalPaidCount === 1 ? '' : 's'}`}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  {stats.lastYearCount > 0 ? (
                    <>Paid <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{stats.lastYearCount} time{stats.lastYearCount === 1 ? '' : 's'}</span> in the last 12 months</>
                  ) : (
                    <span className="text-slate-400">No payment logs in the last 12 months</span>
                  )}
                </div>
                {stats.lastPaid && (
                  <div className="text-[9px] text-slate-400 font-semibold">
                    Last Payment: <span className="text-slate-600 dark:text-slate-400 font-bold">{stats.lastPaid.paidDate}</span> ({formatCurrencyValue(stats.lastPaid.amount, stats.lastPaid.currency)})
                  </div>
                )}
              </div>

              {/* 6-Month Visual Track */}
              <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                {stats.last6Months.map((m, mIdx) => (
                  <div 
                    key={mIdx}
                    className="flex flex-col items-center gap-0.5 group relative"
                    title={`${m.monthName}: ${m.paid ? `Paid ${formatCurrencyValue(m.amount || 0, payment.currency)}` : 'No payment logged'}`}
                  >
                    <div 
                      className={`w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-extrabold select-none transition-all duration-200 ${
                        m.paid 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-405 border border-emerald-500/20 shadow-sm shadow-emerald-500/5 hover:scale-110 hover:bg-emerald-500/20' 
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 border-dashed hover:scale-110'
                      }`}
                    >
                      {m.paid ? '✓' : '•'}
                    </div>
                    <span className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                      {m.monthName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Row: Billing values, edit/delete actions */}
        <div className="mt-3 pt-2.5 border-t border-slate-150 dark:border-slate-900/60 flex items-center justify-between">
          <span className="text-xs font-black text-slate-900 dark:text-white">
            {formatCurrencyValue(payment.amount, payment.currency)}
          </span>

          <div className="flex items-center gap-1">
            {/* Position reordering arrows */}
            <button
              onClick={() => movePayment(idx, 'up')}
              disabled={idx === 0 || isPaymentReadOnly(payment)}
              className={`p-1.5 rounded transition-colors ${
                idx === 0 || isPaymentReadOnly(payment)
                  ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed opacity-50'
                  : 'text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer'
              }`}
              title="Move position Up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => movePayment(idx, 'down')}
              disabled={idx === payments.length - 1 || isPaymentReadOnly(payment)}
              className={`p-1.5 rounded transition-colors ${
                idx === payments.length - 1 || isPaymentReadOnly(payment)
                  ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed opacity-50'
                  : 'text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer'
              }`}
              title="Move position Down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {/* Edit button */}
            <button
              disabled={isPaymentReadOnly(payment)}
              onClick={() => onEditClick(payment)}
              className={`p-1.5 rounded transition-colors ${
                isPaymentReadOnly(payment)
                  ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed opacity-50'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer'
              }`}
              title="Edit details"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {/* Clone button */}
            {onCloneClick && (
              <button
                onClick={() => onCloneClick(payment)}
                className="p-1.5 rounded transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                title="Clone"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Delete button */}
            <button
              disabled={isPaymentReadOnly(payment)}
              onClick={() => onDeleteClick(payment.id)}
              className={`p-1.5 rounded transition-colors ${
                isPaymentReadOnly(payment)
                  ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed opacity-50'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 hover:text-rose-500 cursor-pointer'
              }`}
              title="Delete bill"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-4 text-left select-none bg-slate-50 dark:bg-slate-900">
      
      {isReadOnly && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300 shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
          <div className="flex-1 text-left">
            <span className="font-bold">View-Only Mode:</span> You have view-only access to this family group. Adding bills, edits, deletions, and active status toggles are disabled.
          </div>
        </div>
      )}
      {/* Title & Custom Tab Segmented Controller */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <Settings className="w-4.5 h-4.5 text-indigo-600" />
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Bill & Payment Control</h3>
          </div>
          <button
            onClick={toggleInstructions}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm transition-all cursor-pointer hover:shadow"
          >
            {showInstructions ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Hide Instructions</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>Show Instructions</span>
              </>
            )}
          </button>
        </div>

          {/* Segmented Switcher Tabs */}
          <div className="apple-segmented-control">
            <button
              onClick={() => setActiveTab('list')}
              className={activeTab === 'list' ? 'apple-segmented-btn-active' : 'apple-segmented-btn'}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Active Bills ({payments.length})</span>
            </button>
            
            <button
              onClick={handleOpenBulkTab}
              className={`relative ${activeTab === 'bulk' ? 'apple-segmented-btn-active' : 'apple-segmented-btn'}`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Bulk Data Config</span>
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
              </span>
            </button>
          </div>
      </div>

      {/* Success & Error alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-2.5">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-100 dark:border-rose-900/40 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* RENDER TAB 1: LIST VIEW */}
      {activeTab === 'list' && (
        <div className="space-y-2.5 pb-8">
          {/* List Toolbar */}
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Manage items individually
            </span>
            <button
              onClick={onAddClick}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Bill/Payment
            </button>
          </div>

          {/* View Toggles & Layout Switcher */}
          {payments.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 px-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/50 dark:border-slate-800/80">
              {/* Left Side: Category Group Toggle */}
              <div className="flex items-center justify-between sm:justify-start gap-2.5">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wide">Group Categories:</span>
                <div className="apple-segmented-control">
                  <button
                    onClick={() => setGroupByCategory(true)}
                    className={groupByCategory ? 'apple-segmented-btn-active px-2.5 py-1' : 'apple-segmented-btn px-2.5 py-1'}
                  >
                    ON
                  </button>
                  <button
                    onClick={() => setGroupByCategory(false)}
                    className={!groupByCategory ? 'apple-segmented-btn-active px-2.5 py-1' : 'apple-segmented-btn px-2.5 py-1'}
                  >
                    OFF
                  </button>
                </div>
              </div>

              {/* Right Side: Layout Style Selector */}
              <div className="flex items-center justify-between sm:justify-start gap-2.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/50 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wide">Design Style:</span>
                <div className="apple-segmented-control">
                  <button
                    onClick={() => handleCardStyleChange('modern')}
                    className={cardStyle === 'modern' ? 'apple-segmented-btn-active px-2.5 py-1 flex items-center gap-1' : 'apple-segmented-btn px-2.5 py-1 flex items-center gap-1'}
                    title="Modern detailed card view"
                  >
                    <LayoutList className="w-3 h-3" />
                    <span>Modern</span>
                  </button>
                  <button
                    onClick={() => handleCardStyleChange('compact')}
                    className={cardStyle === 'compact' ? 'apple-segmented-btn-active px-2.5 py-1 flex items-center gap-1' : 'apple-segmented-btn px-2.5 py-1 flex items-center gap-1'}
                    title="Compact space-saving row view"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Compact</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {payments.length === 0 ? (
            <div className="bg-white dark:bg-slate-950 rounded-xl p-8 text-center border border-slate-250/10 dark:border-slate-800 shadow-sm">
              <Info className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-400 font-bold mt-2.5">No bills or payments configured yet.</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto">Click "Add Bill/Payment" at the top or switch to Bulk Import to add records.</p>
              
              {showInstructions && (
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-900 text-left max-w-md mx-auto">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1.5">💡 Realtime Sync Tip</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    If you loaded bills/payments via an external script, make sure your <strong>Family Group ID</strong> matches the one used by your script (e.g., <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-900 rounded text-indigo-600 dark:text-indigo-400 font-mono text-[9.5px]">vwn3tRJutgW8soudCnaguAJ8Va02</code>). Enter this code under the <strong>Preferences</strong> tab in Config settings to instantly synchronize and view all records.
                  </p>
                </div>
              )}
            </div>
          ) : groupByCategory ? (
            (() => {
              const categoriesList = Array.from(new Set(payments.map(p => p.category)));
              return (
                <div className="space-y-3">
                  {categoriesList.map((cat) => {
                    const catPayments = payments.filter(p => p.category === cat);
                    const isCollapsed = !!collapsedCategories[cat];
                    return (
                      <div key={cat} className="space-y-2">
                        {/* Category Group Header */}
                        <div 
                          onClick={() => toggleCategoryCollapse(cat)}
                          className="px-4 py-2.5 bg-slate-100/80 dark:bg-slate-905 rounded-xl flex justify-between items-center cursor-pointer select-none border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-left"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${getCategoryColor(cat).iconBg || 'bg-indigo-500'}`} />
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{cat}</span>
                            <span className="text-[10px] text-slate-450 font-bold">({catPayments.length})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Category Group Bills */}
                        {!isCollapsed && (
                          <div className="space-y-2.5 pl-2 border-l-2 border-slate-150 dark:border-slate-800/80">
                            {catPayments.map((payment) => {
                              const colorConfig = getCategoryColor(payment.category);
                              // find absolute index of payment in payments array
                              const idx = payments.findIndex(p => p.id === payment.id);
                              return renderPaymentCard(payment, idx);
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            payments.map((payment, idx) => {
              const colorConfig = getCategoryColor(payment.category);
              return renderPaymentCard(payment, idx);
            })
          )}
        </div>
      )}

      {/* RENDER TAB 2: BULK DATA CONFIG */}
      {activeTab === 'bulk' && (
        <div className="space-y-4 pb-20 text-left">
          
          {/* Informational Hero Card & Quick-Paste Options */}
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 dark:from-indigo-950/20 dark:to-indigo-950/5 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex flex-col gap-3">
            {showInstructions && (
              <div className="flex gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-wider">Supercharged Bulk Import</h4>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium mt-1">
                    Configure all recurring bills, credit limits, or platform fees in a single go. Add multiple line items below, or **paste rows** directly from Excel, Google Sheets, or plain comma-separated lists!
                  </p>
                </div>
              </div>
            )}

            {/* Paste Expand trigger */}
            <div className={`flex items-center justify-between ${showInstructions ? 'pt-1.5 border-t border-indigo-200/40 dark:border-indigo-900/25' : ''}`}>
              <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" />
                Have spreadsheet data?
              </span>
              <button
                onClick={() => setShowPasteBox(!showPasteBox)}
                className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-600 dark:bg-slate-900 dark:hover:bg-slate-800 text-[10px] font-bold rounded-lg border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"
              >
                {showPasteBox ? 'Close Parser' : 'Open Paste Importer'}
              </button>
            </div>

            {/* Paste Box Container */}
            {showPasteBox && (
              <div className="mt-2 p-3 bg-white dark:bg-slate-950 rounded-xl border border-indigo-150 dark:border-indigo-950 space-y-2.5">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  Paste rows from excel or sheets below:
                </label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Format: Name, Amount, Currency, Category, DayOfMonth, RemindDays, Fixed/Flexi, BillingCycle, Tag, Notes&#10;e.g. YouTube Premium, 17.99, AUD, Entertainment, 10, 2, fixed, monthly, Self, shared with friend&#10;e.g. Home Gym Fee, 80, USD, Lifestyle, 5, 4, fixed, monthly, Home, family gym card"
                  className="w-full h-28 p-2 text-[11px] font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-400 font-medium">
                    *Tries to match Categories & Tags automatically.
                  </span>
                  <button
                    onClick={handleParsePaste}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> Parse & Fill Rows
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* DYNAMIC LINE ITEMS TABLE VIEW */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Line Items Under Configuration ({bulkRows.length})
              </span>
              
              <div className="flex gap-1.5">
                <button
                  onClick={handleClearAllRows}
                  className="px-2.5 py-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[10px] font-extrabold rounded-lg border border-transparent hover:border-rose-250 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Spreadsheet Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-slate-900/60 border-b border-slate-150 dark:border-slate-800 text-slate-500 font-extrabold tracking-wider text-[9px] uppercase">
                    <th className="py-2.5 px-3 text-left w-40">Bill/Payment Name *</th>
                    <th className="py-2.5 px-2 text-left w-24">Amount *</th>
                    <th className="py-2.5 px-2 text-left w-20">Currency</th>
                    <th className="py-2.5 px-2 text-left w-32">Category</th>
                    <th className="py-2.5 px-2 text-left w-16">Day (1-31)</th>
                    <th className="py-2.5 px-2 text-left w-16">Remind</th>
                    <th className="py-2.5 px-2 text-left w-24">Type</th>
                    <th className="py-2.5 px-2 text-left w-28">Billing</th>
                    <th className="py-2.5 px-2 text-left w-24">Tag</th>
                    <th className="py-2.5 px-2 text-left">Private Notes</th>
                    <th className="py-2.5 px-2 text-center w-12">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {bulkRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-bold bg-slate-50/20 dark:bg-slate-900/10">
                        <Info className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                        No line items added yet. Click "Add Row" below or copy-paste spreadsheet content!
                      </td>
                    </tr>
                  ) : (
                    bulkRows.map((row, index) => (
                      <tr 
                        key={row.key} 
                        className="hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors"
                      >
                        {/* Name Input */}
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleUpdateRowValue(row.key, 'name', e.target.value)}
                            placeholder="e.g. Disney+"
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                          />
                        </td>

                        {/* Amount Input */}
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={row.amount}
                            onChange={(e) => handleUpdateRowValue(row.key, 'amount', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white font-black text-right focus:outline-none focus:border-indigo-500"
                          />
                        </td>

                        {/* Currency Select */}
                        <td className="py-1.5 px-2">
                          <select
                            value={row.currency}
                            onChange={(e) => handleUpdateRowValue(row.key, 'currency', e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                          >
                            {CURRENCIES.map(curr => (
                              <option key={curr} value={curr}>{curr}</option>
                            ))}
                          </select>
                        </td>

                        {/* Category Select */}
                        <td className="py-1.5 px-2">
                          <select
                            value={row.category}
                            onChange={(e) => handleUpdateRowValue(row.key, 'category', e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white font-medium focus:outline-none focus:border-indigo-500"
                          >
                            {CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>

                        {/* Day Of Month Input */}
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={row.dayOfMonth}
                            onChange={(e) => handleUpdateRowValue(row.key, 'dayOfMonth', e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white font-bold text-center focus:outline-none focus:border-indigo-500"
                          />
                        </td>

                        {/* Reminder Days Input */}
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            min="0"
                            value={row.reminderDaysBefore}
                            onChange={(e) => handleUpdateRowValue(row.key, 'reminderDaysBefore', e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white font-bold text-center focus:outline-none focus:border-indigo-500"
                          />
                        </td>

                        {/* Payment Type */}
                        <td className="py-1.5 px-2">
                          <select
                            value={row.paymentType}
                            onChange={(e) => handleUpdateRowValue(row.key, 'paymentType', e.target.value as any)}
                            className="w-full px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white font-medium focus:outline-none focus:border-indigo-500"
                          >
                            <option value="fixed">Fixed</option>
                            <option value="flexi">Flexi</option>
                          </select>
                        </td>

                        {/* Billing Cycle */}
                        <td className="py-1.5 px-2">
                          <select
                            value={row.billingCycle}
                            onChange={(e) => handleUpdateRowValue(row.key, 'billingCycle', e.target.value as any)}
                            className="w-full px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white font-medium focus:outline-none focus:border-indigo-500 text-xs"
                          >
                            {BILLING_CYCLES.map(cycle => (
                              <option key={cycle} value={cycle}>{cycle}</option>
                            ))}
                          </select>
                        </td>

                        {/* Tag For Whom */}
                        <td className="py-1.5 px-2">
                          <select
                            value={row.taggedFor}
                            onChange={(e) => handleUpdateRowValue(row.key, 'taggedFor', e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                          >
                            {customizedTags.map(tag => (
                              <option key={tag} value={tag}>{tag}</option>
                            ))}
                          </select>
                        </td>

                        {/* Notes Input */}
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => handleUpdateRowValue(row.key, 'notes', e.target.value)}
                            placeholder="e.g. Split with roomies"
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white font-medium focus:outline-none focus:border-indigo-500"
                          />
                        </td>

                        {/* Delete Row button */}
                        <td className="py-1.5 px-2 text-center">
                          <button
                            onClick={() => handleDeleteRow(row.key)}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-900 rounded transition-colors cursor-pointer"
                            title="Delete Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Error & Success Alerts inside Bulk Import Panel */}
            {(errorMessage || successMessage) && (
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
                {errorMessage && (
                  <div id="bulk-error-message" className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-100 dark:border-rose-900/40 flex items-center gap-2.5">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-600 dark:text-rose-400" />
                    <div className="flex-1 text-left">
                      <span className="font-extrabold uppercase tracking-wider block text-[10px] text-rose-500 mb-0.5">Bulk Import Error</span>
                      <span>{errorMessage}</span>
                    </div>
                  </div>
                )}
                {successMessage && (
                  <div id="bulk-success-message" className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-2.5">
                    <CheckCircle className="w-4.5 h-4.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex-1 text-left">
                      <span className="font-extrabold uppercase tracking-wider block text-[10px] text-emerald-500 mb-0.5">Bulk Import Success</span>
                      <span>{successMessage}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions of spreadsheet card */}
            <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
              <button
                onClick={handleAddRow}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 text-[11px] font-extrabold rounded-lg flex items-center gap-1 border border-slate-250/20 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Row
              </button>

              <div className="flex flex-col items-end gap-1.5">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('list')}
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900 dark:text-slate-300 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBulk}
                    disabled={isSavingBulk}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[11px] font-extrabold rounded-lg shadow-md hover:shadow-indigo-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {isSavingBulk ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Save All Imports ({bulkRows.filter(r => r.name.trim().length > 0).length})
                      </>
                    )}
                  </button>
                </div>
                {errorMessage && (
                  <div id="bulk-button-error-message" className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100/60 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 p-2 rounded-lg flex items-center gap-2 text-[10px] font-bold max-w-[320px] text-left leading-snug">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
