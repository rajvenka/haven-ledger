/**
 * Pulse Manage Bills - redesigned: due-date aware summary tiles, one-row smart views,
 * a collapsible multi-select filter panel, active-filter chips, and groups by "when due".
 */
import React, { useMemo, useState } from 'react';
import {
  Plus, Search, X, Edit2, Trash2, Copy, ChevronDown, ChevronRight, ClipboardList,
  FileSpreadsheet, CheckCircle, AlertCircle, Layers, ArrowUp, ArrowDown,
  SlidersHorizontal, Pause, Play, AlertTriangle,
} from 'lucide-react';
import { RecurringPayment, PaymentHistory, getCategoryColor, BillingCycle } from '../types';
import {
  formatCurrencyValue, getDaysUntilPayment, getNextPaymentDate, isPaymentPaidForCurrentPeriod,
} from '../utils/paymentUtils';

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

type ViewFilter = 'all' | 'due' | 'unpaid' | 'paid' | 'dd' | 'manual' | 'paused';
type CycleFilter = 'all' | 'monthly' | 'other';
type SortMode = 'due' | 'amount' | 'name' | 'manual';
type GroupMode = 'when' | 'category' | 'method' | 'none';
type Mode = 'list' | 'bulk';

const BILLING_CYCLES: BillingCycle[] = [
  'weekly', 'monthly', '2-months', '3-months', '4-months', '6-months', 'yearly', 'once',
];


const TONE: Record<string, { border: string; text: string }> = {
  rose: { border: 'border-rose-200 dark:border-rose-900/50', text: 'text-rose-700 dark:text-rose-300' },
  amber: { border: 'border-amber-200 dark:border-amber-900/50', text: 'text-amber-700 dark:text-amber-300' },
  emerald: { border: 'border-emerald-200 dark:border-emerald-900/50', text: 'text-emerald-700 dark:text-emerald-300' },
  sky: { border: 'border-sky-200 dark:border-sky-900/50', text: 'text-sky-700 dark:text-sky-300' },
  violet: { border: 'border-violet-200 dark:border-violet-900/50', text: 'text-violet-700 dark:text-violet-300' },
  slate: { border: 'border-slate-200/80 dark:border-slate-800', text: 'text-slate-700 dark:text-slate-200' },
};

const VIEW_CHIPS: [ViewFilter, string][] = [
  ['all', 'All'], ['due', 'Due soon'], ['unpaid', 'Unpaid'], ['paid', 'Paid'],
  ['dd', 'Direct debit'], ['manual', 'Manual'], ['paused', 'Paused'],
];

const pill = (on: boolean) =>
  `shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${
    on
      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
  }`;

const isOtherCycle = (p: RecurringPayment) =>
  ['once', 'yearly', '2-months', '3-months', '4-months', '6-months'].includes(String(p.billingCycle || 'monthly').toLowerCase());

function methodGroup(p: RecurringPayment): 'manual' | 'direct_debit' {
  return p.paymentMethod === 'direct_debit' ? 'direct_debit' : 'manual';
}

function sumByCcy(items: RecurringPayment[]): Record<string, number> {
  const out: Record<string, number> = {};
  items.forEach((p) => {
    const c = String(p.currency || 'AUD');
    out[c] = (out[c] || 0) + (Number(p.amount) || 0);
  });
  return out;
}

function fmtSums(sums: Record<string, number>): string {
  const e = Object.entries(sums).sort((a, b) => b[1] - a[1]);
  if (!e.length) return '-';
  return e.map(([c, v]) => formatCurrencyValue(v, c as any)).join(' + ');
}

interface Row {
  p: RecurringPayment;
  days: number;       // days until next due (>=0)
  overdueDays: number; // >0 when a monthly bill's day has passed unpaid this month
  paid: boolean;
  next: Date;
}

export default function PulseBills({
  payments,
  history = [],
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
  const [view, setView] = useState<ViewFilter>('all');
  const [cats, setCats] = useState<string[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [cycleFilter, setCycleFilter] = useState<CycleFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('due');
  const [groupMode, setGroupMode] = useState<GroupMode>('when');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkErr, setBulkErr] = useState<string | null>(null);

  const isPaymentReadOnly = (payment: RecurringPayment) => {
    if (!isReadOnly) return false;
    if (currentUserUid && payment.userId === currentUserUid) return false;
    return true;
  };

  const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const categories = useMemo(
    () => Array.from(new Set(payments.map((p) => p.category).filter(Boolean))).sort(),
    [payments]
  );
  const peopleOptions = useMemo(
    () => Array.from(new Set(payments.map((p) => (p.taggedFor || 'Self').trim() || 'Self'))).sort((a, b) => a.localeCompare(b)),
    [payments]
  );

  // Enrich every bill with due-date / paid state once.
  const rows: Row[] = useMemo(() => {
    const now = new Date();
    const today = now.getDate();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return payments.map((p) => {
      let days = 0;
      let next = now;
      try {
        days = getDaysUntilPayment(p, now, history);
        next = getNextPaymentDate(p, now, history);
      } catch { /* fall back to today */ }
      const paid = isPaymentPaidForCurrentPeriod(p, history, now);
      const cycle = String(p.billingCycle || 'monthly').toLowerCase();
      const target = Math.min(p.dayOfMonth || 1, lastDay);
      const overdueDays = p.active && !paid && cycle === 'monthly' && target < today ? today - target : 0;
      return { p, days, overdueDays, paid, next };
    });
  }, [payments, history]);

  // Everything except the "view" chip - so chip counts reflect search + filter panel.
  const baseRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(({ p }) => {
      if (cats.length && !cats.includes(p.category)) return false;
      if (people.length && !people.includes((p.taggedFor || 'Self').trim() || 'Self')) return false;
      if (cycleFilter === 'monthly' && isOtherCycle(p)) return false;
      if (cycleFilter === 'other' && !isOtherCycle(p)) return false;
      if (q) {
        const hay = `${p.name} ${p.category} ${p.taggedFor || ''} ${p.notes || ''} ${p.billingCycle || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, cats, people, cycleFilter]);

  const matchesView = (r: Row, v: ViewFilter) => {
    switch (v) {
      case 'due': return r.p.active && !r.paid && (r.overdueDays > 0 || r.days <= 7);
      case 'unpaid': return r.p.active && !r.paid;
      case 'paid': return r.p.active && r.paid;
      case 'dd': return methodGroup(r.p) === 'direct_debit';
      case 'manual': return methodGroup(r.p) === 'manual';
      case 'paused': return !r.p.active;
      default: return true;
    }
  };

  const viewCounts = useMemo(() => {
    const out: Record<ViewFilter, number> = { all: 0, due: 0, unpaid: 0, paid: 0, dd: 0, manual: 0, paused: 0 };
    (Object.keys(out) as ViewFilter[]).forEach((v) => { out[v] = baseRows.filter((r) => matchesView(r, v)).length; });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseRows]);

  const visible = useMemo(() => {
    const list = baseRows.filter((r) => matchesView(r, view));
    const dueKey = (r: Row) => (r.overdueDays > 0 ? -r.overdueDays : r.days);
    return [...list].sort((a, b) => {
      if (sortMode === 'amount') return (Number(b.p.amount) || 0) - (Number(a.p.amount) || 0);
      if (sortMode === 'name') return a.p.name.localeCompare(b.p.name);
      if (sortMode === 'manual') return (a.p.order ?? 9999) - (b.p.order ?? 9999);
      if (a.p.active !== b.p.active) return a.p.active ? -1 : 1;
      return dueKey(a) - dueKey(b) || a.p.name.localeCompare(b.p.name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseRows, view, sortMode]);

  const groups = useMemo(() => {
    if (groupMode === 'none') return [{ id: 'all', label: 'All bills', hint: '', tone: 'slate', items: visible }];
    if (groupMode === 'category') {
      const map = new Map<string, Row[]>();
      visible.forEach((r) => { const c = r.p.category || 'Other'; if (!map.has(c)) map.set(c, []); map.get(c)!.push(r); });
      return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
        .map(([id, items]) => ({ id, label: id, hint: '', tone: 'slate', items }));
    }
    if (groupMode === 'method') {
      const dd = visible.filter((r) => methodGroup(r.p) === 'direct_debit');
      const mn = visible.filter((r) => methodGroup(r.p) === 'manual');
      return [
        { id: 'dd', label: 'Direct debit', hint: 'Bank takes these automatically', tone: 'sky', items: dd },
        { id: 'manual', label: 'Manual', hint: 'You pay these yourself', tone: 'violet', items: mn },
      ].filter((g) => g.items.length);
    }
    const g = {
      overdue: [] as Row[], week: [] as Row[], later: [] as Row[], paid: [] as Row[], paused: [] as Row[],
    };
    visible.forEach((r) => {
      if (!r.p.active) g.paused.push(r);
      else if (r.paid) g.paid.push(r);
      else if (r.overdueDays > 0) g.overdue.push(r);
      else if (r.days <= 7) g.week.push(r);
      else g.later.push(r);
    });
    return [
      { id: 'overdue', label: 'Overdue', hint: 'Day has passed, not marked paid', tone: 'rose', items: g.overdue },
      { id: 'week', label: 'Due in the next 7 days', hint: '', tone: 'amber', items: g.week },
      { id: 'later', label: 'Coming up', hint: '', tone: 'slate', items: g.later },
      { id: 'paid', label: 'Paid this cycle', hint: '', tone: 'emerald', items: g.paid },
      { id: 'paused', label: 'Paused', hint: '', tone: 'slate', items: g.paused },
    ].filter((x) => x.items.length);
  }, [visible, groupMode]);

  // Summary tiles (always across ALL bills, not the filtered set).
  const summary = useMemo(() => {
    const activeRows = rows.filter((r) => r.p.active);
    const monthly: Record<string, number> = {};
    activeRows.forEach(({ p }) => {
      const cycle = String(p.billingCycle || 'monthly').toLowerCase();
      let m = Number(p.amount) || 0;
      if (cycle === 'weekly') m *= 4.33;
      else if (cycle === 'yearly') m /= 12;
      else if (cycle === '2-months') m /= 2;
      else if (cycle === '3-months') m /= 3;
      else if (cycle === '4-months') m /= 4;
      else if (cycle === '6-months') m /= 6;
      else if (cycle === 'once') m = 0;
      const c = String(p.currency || 'AUD');
      monthly[c] = (monthly[c] || 0) + m;
    });
    const due = activeRows.filter((r) => matchesView(r, 'due')).map((r) => r.p);
    const unpaid = activeRows.filter((r) => !r.paid).map((r) => r.p);
    return {
      active: activeRows.length,
      paused: rows.length - activeRows.length,
      monthly,
      dueCount: due.length,
      dueSums: sumByCcy(due),
      unpaidCount: unpaid.length,
      unpaidSums: sumByCcy(unpaid),
      overdueCount: activeRows.filter((r) => r.overdueDays > 0).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filterCount = cats.length + people.length + (cycleFilter !== 'all' ? 1 : 0);
  const anyActive = filterCount > 0 || view !== 'all' || !!search.trim();
  const clearAll = () => { setCats([]); setPeople([]); setCycleFilter('all'); setView('all'); setSearch(''); };

  const getHistoryStats = (paymentId: string) => {
    const sorted = history
      .filter((h) => h.paymentId === paymentId)
      .sort((a, b) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime());
    return { total: sorted.length, lastPaid: sorted[0] || null };
  };

  const toggleActive = (p: RecurringPayment) => {
    if (isPaymentReadOnly(p)) return;
    onUpdatePayment({ ...p, active: !p.active });
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

  const parseBulkRows = (text: string): Omit<RecurringPayment, 'id'>[] => {
    const rows: Omit<RecurringPayment, 'id'>[] = [];
    const trimmed = text.trim();
    if (!trimmed) return rows;

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
          } as any);
        }
      } catch {
        /* fall through to CSV */
      }
      if (rows.length) return rows;
    }

    for (const line of trimmed.split('\n')) {
      const parts = line.split(/[,\t]/).map((s) => s.trim());
      if (parts.length < 2) continue;
      const name = parts[0];
      const amount = Number(parts[1]);
      if (!name || !Number.isFinite(amount)) continue;
      const currency = (parts[2] || 'AUD').toUpperCase();
      const dayOfMonth = Math.min(31, Math.max(1, Number(parts[3]) || 1));
      const category = parts[4] || 'Other';
      const rawCycle = parts[5] || 'monthly';
      const billingCycle = (BILLING_CYCLES.includes(rawCycle as any) ? rawCycle : 'monthly') as BillingCycle;
      const methodRaw = (parts[6] || 'manual').toLowerCase();
      const paymentMethod = methodRaw.includes('direct') || methodRaw === 'dd' ? 'direct_debit' : 'manual';
      const taggedFor = parts[7] || 'Self';
      const paymentType = (parts[8] || 'fixed').toLowerCase() === 'flexi' ? 'flexi' : 'fixed';
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
        notes: '',
      } as any);
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


  const SegBtn: React.FC<{ on: boolean; onClick: () => void; children?: React.ReactNode }> = ({ on, onClick, children }) => (
    <button type="button" onClick={onClick} className={pill(on)}>{children}</button>
  );

  const statusPill = (r: Row) => {
    if (!r.p.active) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Paused</span>;
    if (r.paid) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Paid</span>;
    if (r.overdueDays > 0) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">Overdue {r.overdueDays}d</span>;
    if (r.days === 0) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">Today</span>;
    if (r.days <= 7) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">in {r.days}d</span>;
    return <span className="text-[9px] font-bold text-slate-400">in {r.days}d</span>;
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full">
      <div className="shrink-0 px-3 sm:px-4 pt-2 pb-2 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">Bills</h1>
            <p className="text-[10px] text-slate-400 font-bold">
              {summary.active} active · {summary.paused} paused · {payments.length} total
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="inline-flex p-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button type="button" onClick={() => setMode('list')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${mode === 'list' ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>
                <ClipboardList className="w-3 h-3 inline mr-1" />List
              </button>
              <button type="button" onClick={() => setMode('bulk')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${mode === 'bulk' ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>
                <FileSpreadsheet className="w-3 h-3 inline mr-1" />Bulk
              </button>
            </div>
            {!isReadOnly && mode === 'list' && (
              <button type="button" onClick={onAddClick}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
                <Plus className="w-3.5 h-3.5" />Add
              </button>
            )}
          </div>
        </div>

        {mode === 'list' && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-2 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Monthly cost</p>
              <p className="text-[12px] font-black text-slate-900 dark:text-white truncate tabular-nums">{fmtSums(summary.monthly)}</p>
              <p className="text-[9px] text-slate-400">avg across schedules</p>
            </div>
            <button type="button" onClick={() => setView(view === 'due' ? 'all' : 'due')}
              className={`text-left rounded-2xl border px-2.5 py-2 min-w-0 transition-all ${view === 'due' ? 'ring-2 ring-amber-400 ' : ''}${summary.overdueCount ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                {summary.overdueCount > 0 && <AlertTriangle className="w-3 h-3 text-rose-500" />}Due soon
              </p>
              <p className="text-[12px] font-black text-slate-900 dark:text-white truncate tabular-nums">{fmtSums(summary.dueSums)}</p>
              <p className="text-[9px] text-slate-400">{summary.dueCount} bill{summary.dueCount === 1 ? '' : 's'}{summary.overdueCount ? ` · ${summary.overdueCount} overdue` : ' · next 7 days'}</p>
            </button>
            <button type="button" onClick={() => setView(view === 'unpaid' ? 'all' : 'unpaid')}
              className={`text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-2 min-w-0 transition-all ${view === 'unpaid' ? 'ring-2 ring-violet-400' : ''}`}>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Left to pay</p>
              <p className="text-[12px] font-black text-slate-900 dark:text-white truncate tabular-nums">{fmtSums(summary.unpaidSums)}</p>
              <p className="text-[9px] text-slate-400">{summary.unpaidCount} unpaid this cycle</p>
            </button>
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
          <div className="sticky top-0 z-30 px-3 sm:px-4 py-2 space-y-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bills, tags, notes…"
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px] font-medium" />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setShowFilters((v) => !v)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                  showFilters || filterCount > 0 ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}>
                <SlidersHorizontal className="w-3.5 h-3.5" />Filters
                {filterCount > 0 && <span className="px-1.5 rounded-full bg-white/25 text-[10px]">{filterCount}</span>}
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {VIEW_CHIPS.map(([id, label]) => (
                <button key={id} type="button" onClick={() => setView(id)}
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                    view === id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}>
                  {label}
                  <span className={`text-[9px] ${view === id ? 'opacity-70' : 'text-slate-400'}`}>{viewCounts[id]}</span>
                </button>
              ))}
            </div>

            {showFilters && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => <SegBtn key={c} on={cats.includes(c)} onClick={() => setCats(toggleIn(cats, c))}>{c}</SegBtn>)}
                  </div>
                </div>
                {peopleOptions.length > 1 && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Paid for</p>
                    <div className="flex flex-wrap gap-1.5">
                      {peopleOptions.map((t) => <SegBtn key={t} on={people.includes(t)} onClick={() => setPeople(toggleIn(people, t))}>{t}</SegBtn>)}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Schedule</p>
                    <div className="flex flex-wrap gap-1.5">
                      {([['all', 'All'], ['monthly', 'Monthly'], ['other', 'Yearly / other']] as [CycleFilter, string][]).map(([id, l]) =>
                        <SegBtn key={id} on={cycleFilter === id} onClick={() => setCycleFilter(id)}>{l}</SegBtn>)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Sort by</p>
                    <div className="flex flex-wrap gap-1.5">
                      {([['due', 'Due date'], ['amount', 'Amount'], ['name', 'Name'], ['manual', 'My order']] as [SortMode, string][]).map(([id, l]) =>
                        <SegBtn key={id} on={sortMode === id} onClick={() => setSortMode(id)}>{l}</SegBtn>)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Group by</p>
                    <div className="flex flex-wrap gap-1.5">
                      {([['when', 'When due'], ['category', 'Category'], ['method', 'Method'], ['none', 'None']] as [GroupMode, string][]).map(([id, l]) =>
                        <SegBtn key={id} on={groupMode === id} onClick={() => setGroupMode(id)}>{l}</SegBtn>)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(filterCount > 0 || view !== 'all') && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {cats.map((c) => (
                  <button key={`c-${c}`} type="button" onClick={() => setCats(toggleIn(cats, c))}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300">{c}<X className="w-3 h-3" /></button>
                ))}
                {people.map((t) => (
                  <button key={`p-${t}`} type="button" onClick={() => setPeople(toggleIn(people, t))}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">For {t}<X className="w-3 h-3" /></button>
                ))}
                {cycleFilter !== 'all' && (
                  <button type="button" onClick={() => setCycleFilter('all')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
                    {cycleFilter === 'monthly' ? 'Monthly' : 'Yearly / other'}<X className="w-3 h-3" /></button>
                )}
                <button type="button" onClick={clearAll} className="text-[10px] font-bold text-slate-500 underline ml-1">Clear all</button>
              </div>
            )}
          </div>

          <div className="px-3 sm:px-4 pb-28 space-y-4 pt-3">
            {visible.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-[13px] font-bold text-slate-500">{payments.length === 0 ? 'No bills yet' : 'No bills match these filters'}</p>
                {anyActive && payments.length > 0 && (
                  <button type="button" onClick={clearAll} className="text-[11px] font-bold text-violet-600 underline">Clear filters</button>
                )}
                {!isReadOnly && payments.length === 0 && (
                  <button type="button" onClick={onAddClick}
                    className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white">
                    <Plus className="w-3.5 h-3.5" /> Add bill
                  </button>
                )}
              </div>
            ) : (
              groups.map(({ id, label, hint, tone, items }) => (
                <section key={id} className={`rounded-2xl border overflow-hidden bg-white dark:bg-slate-900 ${TONE[tone].border}`}>
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className={`text-[11px] font-black ${TONE[tone].text}`}>{label} <span className="text-slate-400 font-bold">· {items.length}</span></h2>
                      {hint && <p className="text-[9px] text-slate-500">{hint}</p>}
                    </div>
                    <span className="text-[10px] font-black tabular-nums text-slate-500 shrink-0">{fmtSums(sumByCcy(items.map((r) => r.p)))}</span>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {items.map((r) => {
                      const p = r.p;
                      const ro = isPaymentReadOnly(p);
                      const expanded = expandedId === p.id;
                      const hist = getHistoryStats(p.id);
                      const catMeta = typeof getCategoryColor === 'function' ? getCategoryColor(p.category) : null;
                      const catColor = (typeof catMeta === 'string' ? catMeta : (catMeta as any)?.iconBg || (catMeta as any)?.bg) || '#6366f1';
                      const mon = r.next.toLocaleDateString(undefined, { month: 'short' });
                      return (
                        <li key={p.id} className={!p.active ? 'opacity-60' : undefined}>
                          <button type="button" onClick={() => setExpandedId(expanded ? null : p.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
                            <div className={`shrink-0 w-10 rounded-xl border text-center py-1 ${r.overdueDays > 0 && p.active ? 'border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/50' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'}`}>
                              <p className="text-[8px] font-black uppercase text-slate-400 leading-none">{mon}</p>
                              <p className="text-[14px] font-black text-slate-900 dark:text-white leading-tight tabular-nums">{r.next.getDate()}</p>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                                <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                                {p.paymentMethod === 'direct_debit' && (
                                  <span className="shrink-0 text-[8px] font-black px-1 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-300">DD</span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                {[p.billingCycle && p.billingCycle !== 'monthly' ? p.billingCycle : 'monthly', p.taggedFor, p.category].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                            <div className="text-right shrink-0 space-y-0.5">
                              <p className="text-[12px] font-black tabular-nums text-slate-900 dark:text-white">{formatCurrencyValue(p.amount, p.currency)}</p>
                              {statusPill(r)}
                            </div>
                            {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
                          </button>
                          {expanded && (
                            <div className="px-3 pb-3 space-y-2">
                              {p.notes && <p className="text-[10px] text-slate-500 italic line-clamp-3">&ldquo;{p.notes}&rdquo;</p>}
                              <p className="text-[10px] text-slate-400">
                                {hist.total === 0 ? 'No payment history' : `${hist.total} payment${hist.total === 1 ? '' : 's'} logged`}
                                {hist.lastPaid && <span className="font-semibold"> · last {hist.lastPaid.paidDate}</span>}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {sortMode === 'manual' && onUpdatePaymentsOrder && !ro && (
                                  <>
                                    <button type="button" onClick={() => movePayment(p, -1)} className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><ArrowUp className="w-3 h-3" /></button>
                                    <button type="button" onClick={() => movePayment(p, 1)} className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><ArrowDown className="w-3 h-3" /></button>
                                  </>
                                )}
                                <button type="button" disabled={ro} onClick={() => onEditClick(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40"><Edit2 className="w-3 h-3" /> Edit</button>
                                {onCloneClick && (
                                  <button type="button" disabled={ro} onClick={() => onCloneClick(p)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40"><Copy className="w-3 h-3" /> Clone</button>
                                )}
                                <button type="button" disabled={ro} onClick={() => toggleActive(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40">
                                  {p.active ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Resume</>}
                                </button>
                                <button type="button" disabled={ro}
                                  onClick={() => { if (confirm(`Delete "${p.name}"?`)) onDeleteClick(p.id); }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 disabled:opacity-40 ml-auto"><Trash2 className="w-3 h-3" /> Delete</button>
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
