/**
 * Pulse Manage Bills — Pulse 1 redesign of ConfigurePayments.
 * Feature parity target: list, filters, method/category groups, active toggle,
 * expand history, edit/clone/delete, rich bulk (CSV/JSON), reorder.
 */
import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  Copy,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  History,
  ClipboardList,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Layers,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { RecurringPayment, PaymentHistory, getCategoryColor, BillingCycle } from '../types';
import { formatCurrencyValue } from '../utils/paymentUtils';

interface Props {
  payments: RecurringPayment[];
  history?: PaymentHistory[];
  showFrequencyPatterns?: boolean;
  onAddClick: () => void;
  onEditClick: (payment: RecurringPayment) => void;
  onCloneClick?: (payment: RecurringPayment) => void;
  onDeleteClick: (id: string) => void;
  onUpdatePayment: (payment: RecurringPayment) => void;
  onAddBulkPayments?: (payments: Omit<RecurringPayment, 'id'>[]) => Promise<any>;
  onUpdatePaymentsOrder?: (orderedPayments: RecurringPayment[]) => void;
  isReadOnly?: boolean;
  currentUserUid?: string;
  customizedTags?: string[];
}

type StatusFilter = 'all' | 'active' | 'paused';
type MethodFilter = 'all' | 'manual' | 'direct_debit' | 'non_monthly';
type Mode = 'list' | 'bulk';
type GroupMode = 'method' | 'category' | 'none';

const BILLING_CYCLES: BillingCycle[] = [
  'weekly', 'monthly', '2-months', '3-months', '4-months', '6-months', 'yearly', 'once',
];

function billMethodGroup(p: RecurringPayment): 'manual' | 'direct_debit' | 'non_monthly' {
  const cycle = String(p.billingCycle || 'monthly').toLowerCase();
  if (['once', 'yearly', '2-months', '3-months', '4-months', '6-months'].includes(cycle)) {
    return 'non_monthly';
  }
  if (p.paymentMethod === 'direct_debit') return 'direct_debit';
  return 'manual';
}

function methodLabel(g: string) {
  if (g === 'direct_debit') return 'Direct debit';
  if (g === 'non_monthly') return 'Non-monthly';
  return 'Manual monthly';
}

export default function PulseBills({
  payments,
  history = [],
  showFrequencyPatterns = true,
  onAddClick,
  onEditClick,
  onCloneClick,
  onDeleteClick,
  onUpdatePayment,
  onAddBulkPayments,
  onUpdatePaymentsOrder,
  isReadOnly = false,
  currentUserUid,
  customizedTags = ['Bank', 'Home', 'Father', 'Mother', 'Self'],
}: Props) {
  const [mode, setMode] = useState<Mode>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [groupMode, setGroupMode] = useState<GroupMode>('method');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isPaymentReadOnly = (payment: RecurringPayment) => {
    if (!isReadOnly) return false;
    if (currentUserUid && payment.userId === currentUserUid) return false;
    return true;
  };

  const categories = useMemo(() => {
    const set = new Set(payments.map((p) => p.category).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter === 'active' && !p.active) return false;
      if (statusFilter === 'paused' && p.active) return false;
      if (methodFilter !== 'all' && billMethodGroup(p) !== methodFilter) return false;
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.category} ${p.taggedFor || ''} ${p.notes || ''} ${p.billingCycle || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payments, search, statusFilter, methodFilter, categoryFilter]);

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ao = a.order ?? 9999;
      const bo = b.order ?? 9999;
      if (ao !== bo) return ao - bo;
      if (a.active !== b.active) return a.active ? -1 : 1;
      return (a.dayOfMonth || 1) - (b.dayOfMonth || 1) || a.name.localeCompare(b.name);
    });
  }, [filtered]);

  const grouped = useMemo(() => {
    if (groupMode === 'none') {
      return [{ id: 'all', label: 'All bills', items: sortedFiltered }];
    }
    if (groupMode === 'category') {
      const map = new Map<string, RecurringPayment[]>();
      sortedFiltered.forEach((p) => {
        const c = p.category || 'Other';
        if (!map.has(c)) map.set(c, []);
        map.get(c)!.push(p);
      });
      return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([id, items]) => ({ id, label: id, items }));
    }
    // method
    const order: Array<'direct_debit' | 'manual' | 'non_monthly'> = ['direct_debit', 'manual', 'non_monthly'];
    const map: Record<string, RecurringPayment[]> = { manual: [], direct_debit: [], non_monthly: [] };
    sortedFiltered.forEach((p) => map[billMethodGroup(p)].push(p));
    return order
      .map((id) => ({ id, label: methodLabel(id), items: map[id] }))
      .filter((g) => g.items.length > 0);
  }, [sortedFiltered, groupMode]);

  const stats = useMemo(() => {
    const active = payments.filter((p) => p.active).length;
    const paused = payments.length - active;
    const byCcy: Record<string, number> = {};
    payments.forEach((p) => {
      if (!p.active) return;
      const cycle = String(p.billingCycle || 'monthly').toLowerCase();
      let monthly = Number(p.amount) || 0;
      if (cycle === 'weekly') monthly *= 4.33;
      else if (cycle === 'yearly') monthly /= 12;
      else if (cycle === '2-months') monthly /= 2;
      else if (cycle === '3-months') monthly /= 3;
      else if (cycle === '4-months') monthly /= 4;
      else if (cycle === '6-months') monthly /= 6;
      else if (cycle === 'once') monthly = 0;
      const ccy = String(p.currency || 'AUD');
      byCcy[ccy] = (byCcy[ccy] || 0) + monthly;
    });
    return { active, paused, byCcy };
  }, [payments]);

  const getHistoryStats = (paymentId: string) => {
    const paymentHistory = history.filter((h) => h.paymentId === paymentId);
    const sorted = [...paymentHistory].sort(
      (a, b) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime()
    );
    const lastPaid = sorted[0] || null;
    const last6: { monthName: string; paid: boolean }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(now.getMonth() - i);
      const yearMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      last6.push({
        monthName: monthNames[d.getMonth()],
        paid: paymentHistory.some((h) => h.paidDate.startsWith(yearMonthStr)),
      });
    }
    return { total: paymentHistory.length, lastPaid, last6 };
  };

  const toggleActive = (payment: RecurringPayment) => {
    if (isPaymentReadOnly(payment)) return;
    onUpdatePayment({ ...payment, active: !payment.active });
  };

  const movePayment = (payment: RecurringPayment, dir: -1 | 1) => {
    if (!onUpdatePaymentsOrder || isReadOnly) return;
    const ordered = [...payments].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    const idx = ordered.findIndex((p) => p.id === payment.id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= ordered.length) return;
    const next = [...ordered];
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;
    onUpdatePaymentsOrder(next.map((p, i) => ({ ...p, order: i })));
  };

  // ---- Bulk ----
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkErr, setBulkErr] = useState<string | null>(null);

  const parseBulkRows = (text: string): Omit<RecurringPayment, 'id'>[] => {
    const rows: Omit<RecurringPayment, 'id'>[] = [];
    const trimmed = text.trim();
    if (!trimmed) return rows;

    // JSON array or object-with-array
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        let arr: any[] = [];
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) arr = parsed;
        else arr = (Object.values(parsed).find((v) => Array.isArray(v)) as any[]) || [];
        for (const item of arr) {
          const name = item.name || item.billName || item.paymentName || '';
          const amount = Number(item.amount);
          if (!name || !Number.isFinite(amount)) continue;
          const rawCurrency = String(item.currency || 'AUD').toUpperCase();
          const dayOfMonth = Math.min(31, Math.max(1, Number(item.dayOfMonth) || 1));
          const category = item.category || 'Other';
          const rawCycle = item.billingCycle || item.frequency || 'monthly';
          const billingCycle = (BILLING_CYCLES.includes(rawCycle) ? rawCycle : 'monthly') as BillingCycle;
          const rawTag = item.taggedFor || 'Self';
          const taggedFor = customizedTags.find((t) => t.toLowerCase() === String(rawTag).toLowerCase()) || rawTag;
          rows.push({
            name,
            amount,
            currency: rawCurrency as any,
            dayOfMonth,
            category,
            active: item.active !== false,
            reminderDaysBefore: Number(item.reminderDaysBefore) || 2,
            paymentType: item.paymentType === 'flexi' ? 'flexi' : 'fixed',
            paymentMethod: item.paymentMethod === 'direct_debit' ? 'direct_debit' : 'manual',
            billingCycle,
            taggedFor,
            notes: item.notes || '',
          });
        }
        return rows;
      } catch {
        /* fall through to CSV */
      }
    }

    // CSV / TSV: Name, Amount, Currency, Day, Category [, Cycle, Method, Tag, Type]
    for (const line of trimmed.split('\n').map((l) => l.trim()).filter(Boolean)) {
      if (/^name\s*[,;\t]/i.test(line)) continue; // header
      const parts = line.split(/[,;\t]/).map((p) => p.trim());
      if (parts.length < 2) continue;
      const name = parts[0];
      const amount = Number(String(parts[1]).replace(/[^0-9.]/g, ''));
      if (!name || !Number.isFinite(amount)) continue;
      const currency = (parts[2] || 'AUD').toUpperCase();
      const dayOfMonth = Math.min(31, Math.max(1, parseInt(parts[3] || '1', 10) || 1));
      const category = parts[4] || 'Other';
      const rawCycle = (parts[5] || 'monthly').toLowerCase();
      const billingCycle = (BILLING_CYCLES.includes(rawCycle as any) ? rawCycle : 'monthly') as BillingCycle;
      const paymentMethod = String(parts[6] || '').toLowerCase().includes('debit')
        ? 'direct_debit'
        : 'manual';
      const taggedFor = parts[7] || 'Self';
      const paymentType = String(parts[8] || '').toLowerCase() === 'flexi' ? 'flexi' : 'fixed';
      rows.push({
        name,
        amount,
        currency: currency as any,
        dayOfMonth,
        category,
        active: true,
        reminderDaysBefore: 2,
        paymentType,
        paymentMethod,
        billingCycle,
        taggedFor,
      });
    }
    return rows;
  };

  const runBulk = async () => {
    if (!onAddBulkPayments || isReadOnly) return;
    setBulkBusy(true);
    setBulkMsg(null);
    setBulkErr(null);
    try {
      const rows = parseBulkRows(bulkText);
      if (!rows.length) {
        setBulkErr(
          'No valid rows. CSV: Name, Amount, Currency, Day, Category, Cycle, Method, Tag, Type — or paste a JSON array.'
        );
        return;
      }
      await onAddBulkPayments(rows);
      setBulkMsg(`Added ${rows.length} bill(s).`);
      setBulkText('');
      setMode('list');
    } catch (e: any) {
      setBulkErr(e?.message || String(e));
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full">
      <div className="shrink-0 px-3 sm:px-4 pt-2 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Manage bills
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-600 text-white">
                Pulse
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold">
              {stats.active} active · {stats.paused} paused · {payments.length} total
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="inline-flex p-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMode('list')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  mode === 'list' ? 'bg-violet-600 text-white' : 'text-slate-500'
                }`}
              >
                <ClipboardList className="w-3 h-3 inline mr-1" />
                List
              </button>
              <button
                type="button"
                onClick={() => setMode('bulk')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  mode === 'bulk' ? 'bg-violet-600 text-white' : 'text-slate-500'
                }`}
              >
                <FileSpreadsheet className="w-3 h-3 inline mr-1" />
                Bulk
              </button>
            </div>
            {!isReadOnly && mode === 'list' && (
              <button
                type="button"
                onClick={onAddClick}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            )}
          </div>
        </div>

        {Object.keys(stats.byCcy).length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain" style={{ scrollbarWidth: 'none' }}>
            {Object.entries(stats.byCcy)
              .sort((a, b) => b[1] - a[1])
              .map(([ccy, amt]) => (
                <div
                  key={ccy}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                >
                  ~{formatCurrencyValue(amt, ccy as any)}
                  <span className="opacity-60 ml-1">/mo {ccy}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {mode === 'bulk' ? (
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-24 space-y-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2 text-[11px] text-slate-500">
            <p className="font-bold text-slate-700 dark:text-slate-200">Bulk import</p>
            <p>
              <span className="font-bold">CSV / TSV</span> (one per line):
              <br />
              Name, Amount, Currency, Day, Category, Cycle, Method, Tag, Type
            </p>
            <p>
              <span className="font-bold">JSON</span>: array of objects with name, amount, currency,
              dayOfMonth, category, billingCycle, paymentMethod, taggedFor, paymentType, notes
            </p>
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={12}
            placeholder={
              'Netflix, 17.99, AUD, 15, Entertainment, monthly, manual, Self, fixed\nRent, 2200, AUD, 1, Rent, monthly, direct_debit, Home, fixed'
            }
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-[12px] font-mono"
          />
          {bulkMsg && (
            <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> {bulkMsg}
            </p>
          )}
          {bulkErr && (
            <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {bulkErr}
            </p>
          )}
          <button
            type="button"
            disabled={bulkBusy || isReadOnly}
            onClick={runBulk}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-[12px] font-bold disabled:opacity-50"
          >
            {bulkBusy ? 'Importing…' : 'Import bills'}
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Sticky filters — stay visible while scrolling bills */}
          <div className="sticky top-0 z-30 px-3 sm:px-4 py-2 space-y-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bills, tags, notes…"
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px] font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain" style={{ scrollbarWidth: 'none' }}>
              {(['all', 'active', 'paused'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${
                    statusFilter === s
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                      : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {s}
                </button>
              ))}
              <span className="w-px bg-slate-200 dark:bg-slate-800 shrink-0 self-stretch" />
              {(
                [
                  ['all', 'All methods'],
                  ['manual', 'Manual'],
                  ['direct_debit', 'Direct debit'],
                  ['non_monthly', 'Non-monthly'],
                ] as [MethodFilter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMethodFilter(id)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    methodFilter === id
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain" style={{ scrollbarWidth: 'none' }}>
              <span className="shrink-0 self-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                Group
              </span>
              {(
                [
                  ['method', 'Method'],
                  ['category', 'Category'],
                  ['none', 'Flat'],
                ] as [GroupMode, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setGroupMode(id)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    groupMode === id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
              {categories.length > 2 && (
                <>
                  <span className="w-px bg-slate-200 dark:bg-slate-800 shrink-0 self-stretch" />
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoryFilter(c)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        categoryFilter === c
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="px-3 sm:px-4 pb-28 space-y-4 pt-3">
            {sortedFiltered.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-[13px] font-bold text-slate-500">No bills match</p>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={onAddClick}
                    className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add bill
                  </button>
                )}
              </div>
            ) : (
              grouped.map(({ id, label, items }) => (
                <section
                  key={id}
                  className={`rounded-2xl border overflow-hidden bg-white dark:bg-slate-900 ${
                    id === 'direct_debit'
                      ? 'border-sky-200 dark:border-sky-900/50'
                      : id === 'manual'
                        ? 'border-violet-200 dark:border-violet-900/50'
                        : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <h2 className={`text-[11px] font-black ${
                        id === 'direct_debit' ? 'text-sky-700 dark:text-sky-300'
                        : id === 'manual' ? 'text-violet-700 dark:text-violet-300'
                        : 'text-slate-700 dark:text-slate-200'
                      }`}>{label}</h2>
                      <p className="text-[9px] text-slate-500">
                        {id === 'direct_debit' ? 'Bank takes these automatically'
                          : id === 'manual' ? 'You pay these each month'
                          : id === 'non_monthly' ? 'Other schedules'
                          : 'Category group'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{items.length}</span>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {items.map((p) => {
                      const expanded = expandedId === p.id;
                      const hist = showFrequencyPatterns ? getHistoryStats(p.id) : null;
                      const ro = isPaymentReadOnly(p);
                      const catMeta = typeof getCategoryColor === 'function' ? getCategoryColor(p.category) : null;
                      const catColor =
                        (typeof catMeta === 'string' ? catMeta : (catMeta as any)?.iconBg || (catMeta as any)?.bg) ||
                        '#6366f1';
                      return (
                        <li key={p.id} className={`${!p.active ? 'opacity-55' : ''}`}>
                          <div className="flex items-center gap-1.5 px-2.5 py-2.5">
                            <button
                              type="button"
                              onClick={() => setExpandedId(expanded ? null : p.id)}
                              className="shrink-0 p-0.5 text-slate-400"
                            >
                              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0 flex-1" onClick={() => !ro && onEditClick(p)}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                                <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                              </div>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                Day {p.dayOfMonth}
                                {p.billingCycle && p.billingCycle !== 'monthly' ? ` · ${p.billingCycle}` : ''}
                                {p.paymentMethod === 'direct_debit' ? ' · DD' : ''}
                                {p.taggedFor ? ` · ${p.taggedFor}` : ''}
                                {p.category ? ` · ${p.category}` : ''}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[13px] font-black tabular-nums text-slate-900 dark:text-white">
                                {formatCurrencyValue(p.amount, p.currency)}
                              </p>
                              {p.paymentType === 'flexi' && (
                                <p className="text-[9px] font-bold text-amber-500">flexi</p>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={ro}
                              onClick={() => toggleActive(p)}
                              className="shrink-0 p-1 disabled:opacity-40"
                              title={p.active ? 'Pause' : 'Activate'}
                            >
                              {p.active ? (
                                <ToggleRight className="w-6 h-6 text-indigo-500" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-slate-400" />
                              )}
                            </button>
                          </div>
                          {expanded && (
                            <div className="px-3 pb-3 pt-0 space-y-2 bg-slate-50/80 dark:bg-slate-950/40">
                              {p.notes && (
                                <p className="text-[10px] text-slate-500 italic line-clamp-3">&ldquo;{p.notes}&rdquo;</p>
                              )}
                              {hist && (
                                <div className="flex items-start gap-2">
                                  <History className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                      {hist.total === 0
                                        ? 'No payment history yet'
                                        : `${hist.total} log${hist.total === 1 ? '' : 's'}`}
                                      {hist.lastPaid && (
                                        <span className="text-slate-400 font-semibold"> · last {hist.lastPaid.paidDate}</span>
                                      )}
                                    </p>
                                    <div className="flex gap-1 mt-1.5">
                                      {hist.last6.map((m) => (
                                        <div key={m.monthName} className="flex-1 text-center">
                                          <div
                                            className={`h-1.5 rounded-full ${
                                              m.paid ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                                            }`}
                                          />
                                          <p className="text-[8px] font-bold text-slate-400 mt-0.5">{m.monthName}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                                {onUpdatePaymentsOrder && !ro && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => movePayment(p, -1)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                                      title="Move up"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => movePayment(p, 1)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                                      title="Move down"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  disabled={ro}
                                  onClick={() => onEditClick(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40"
                                >
                                  <Edit2 className="w-3 h-3" /> Edit
                                </button>
                                {onCloneClick && (
                                  <button
                                    type="button"
                                    disabled={ro}
                                    onClick={() => onCloneClick(p)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40"
                                  >
                                    <Copy className="w-3 h-3" /> Clone
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={ro}
                                  onClick={() => {
                                    if (confirm(`Delete "${p.name}"?`)) onDeleteClick(p.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 disabled:opacity-40 ml-auto"
                                >
                                  <Trash2 className="w-3 h-3" /> Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
