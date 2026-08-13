/**
 * Pulse Membership — Pulse 1 redesign (full features, new UI).
 * Memberships + gift cards + add/edit/clone/close + filters.
 */
import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  X,
  Award,
  Gift,
  Edit2,
  Trash2,
  Copy,
  Calendar,
  Flame,
  Clock,
  Check,
} from 'lucide-react';
import { RewardPerk, GiftCard, giftCardStatus } from '../types';

interface Props {
  rewardsPerks: RewardPerk[];
  onAddReward: (perk: Omit<RewardPerk, 'id' | 'userId' | 'familyGroupId' | 'workspaceMode'>) => Promise<void>;
  onUpdateReward: (id: string, updates: Partial<Omit<RewardPerk, 'id' | 'userId'>>) => Promise<void>;
  onDeleteReward: (id: string) => Promise<void>;
  giftCards: GiftCard[];
  onAddGiftCard: (card: Omit<GiftCard, 'id' | 'userId' | 'workspaceId'>) => Promise<void>;
  onUpdateGiftCard: (id: string, updates: Partial<Omit<GiftCard, 'id' | 'userId' | 'workspaceId'>>) => Promise<void>;
  onRedeemGiftCard: (id: string, amountUsed: number) => Promise<void>;
  onDeleteGiftCard: (id: string) => Promise<void>;
  isReadOnly?: boolean;
}

type Tab = 'memberships' | 'giftcards';
type StatusFilter = 'all' | 'active' | 'closing_soon' | 'closed';

const CATEGORIES: RewardPerk['category'][] = [
  'Credit Card',
  'Refinance',
  'Electricity',
  'Gas',
  'Health',
  'Other',
];
const PROGRAMS: NonNullable<RewardPerk['pointsProgram']>[] = [
  'None',
  'Qantas',
  'Velocity',
  'Flybuys',
  'Other',
];

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function perkStatus(p: RewardPerk): 'active' | 'closing_soon' | 'closed' {
  const d = daysUntil(p.closingDate);
  if (d == null) return 'active';
  if (d < 0) return 'closed';
  if (d <= 30) return 'closing_soon';
  return 'active';
}

const emptyPerkForm = () => ({
  providerName: '',
  category: 'Credit Card' as RewardPerk['category'],
  applicationDate: new Date().toISOString().slice(0, 10),
  closingDate: '',
  exclusionPeriodMonths: 12,
  bonusValue: '',
  notes: '',
  applicantName: '',
  annualFee: 0,
  pointsEarned: 0,
  pointsProgram: 'None' as NonNullable<RewardPerk['pointsProgram']>,
  cashValue: 0,
});

export default function PulseMembership({
  rewardsPerks,
  onAddReward,
  onUpdateReward,
  onDeleteReward,
  giftCards,
  onAddGiftCard,
  onUpdateGiftCard,
  onRedeemGiftCard,
  onDeleteGiftCard,
  isReadOnly = false,
}: Props) {
  const [tab, setTab] = useState<Tab>('memberships');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Perk modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPerkForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Gift modal
  const [gcOpen, setGcOpen] = useState(false);
  const [gcBrand, setGcBrand] = useState('');
  const [gcValue, setGcValue] = useState('');
  const [gcCurrency, setGcCurrency] = useState('AUD');
  const [gcExpiry, setGcExpiry] = useState('');
  const [gcNotes, setGcNotes] = useState('');
  const [gcError, setGcError] = useState('');
  const [gcSaving, setGcSaving] = useState(false);

  // Redeem
  const [redeemId, setRedeemId] = useState<string | null>(null);
  const [redeemAmt, setRedeemAmt] = useState('');

  const categoriesPresent = useMemo(() => {
    const s = new Set(rewardsPerks.map((p) => p.category));
    return ['All', ...Array.from(s).sort()];
  }, [rewardsPerks]);

  const filteredPerks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rewardsPerks
      .filter((p) => {
        const st = perkStatus(p);
        if (statusFilter !== 'all' && st !== statusFilter) return false;
        if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
        if (q) {
          const hay = `${p.providerName} ${p.category} ${p.applicantName || ''} ${p.bonusValue || ''} ${p.notes || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = daysUntil(a.closingDate);
        const db = daysUntil(b.closingDate);
        if (da == null && db == null) return a.providerName.localeCompare(b.providerName);
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
  }, [rewardsPerks, search, statusFilter, categoryFilter]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return giftCards.filter((c) => {
      if (!q) return true;
      return `${c.brand} ${c.notes || ''} ${c.cardLast4 || ''}`.toLowerCase().includes(q);
    });
  }, [giftCards, search]);

  const stats = useMemo(() => {
    let active = 0, soon = 0, closed = 0, value = 0;
    rewardsPerks.forEach((p) => {
      const st = perkStatus(p);
      if (st === 'active') active++;
      else if (st === 'closing_soon') soon++;
      else closed++;
      value += Number(p.cashValue) || 0;
    });
    const gcBal = giftCards.reduce((s, c) => s + (Number(c.remainingBalance) || 0), 0);
    return { active, soon, closed, value, gcBal };
  }, [rewardsPerks, giftCards]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyPerkForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (p: RewardPerk) => {
    setEditingId(p.id);
    setForm({
      providerName: p.providerName,
      category: p.category,
      applicationDate: p.applicationDate || new Date().toISOString().slice(0, 10),
      closingDate: p.closingDate || '',
      exclusionPeriodMonths: p.exclusionPeriodMonths ?? 12,
      bonusValue: p.bonusValue || '',
      notes: p.notes || '',
      applicantName: p.applicantName || '',
      annualFee: p.annualFee || 0,
      pointsEarned: p.pointsEarned || 0,
      pointsProgram: p.pointsProgram || 'None',
      cashValue: p.cashValue || 0,
    });
    setFormError('');
    setModalOpen(true);
  };

  const openCloneGiftCard = (c: GiftCard) => {
    setGcBrand(c.brand || '');
    setGcValue(String(c.initialValue ?? c.remainingBalance ?? ''));
    setGcCurrency(c.currency || 'AUD');
    setGcExpiry(c.expiryDate || '');
    setGcNotes(c.notes || '');
    setGcError('');
    setGcOpen(true);
  };

  const openClone = (p: RewardPerk) => {
    setEditingId(null);
    setForm({
      providerName: `${p.providerName} (Copy)`,
      category: p.category,
      applicationDate: new Date().toISOString().slice(0, 10),
      closingDate: '',
      exclusionPeriodMonths: p.exclusionPeriodMonths ?? 12,
      bonusValue: p.bonusValue || '',
      notes: p.notes || '',
      applicantName: p.applicantName || '',
      annualFee: p.annualFee || 0,
      pointsEarned: p.pointsEarned || 0,
      pointsProgram: p.pointsProgram || 'None',
      cashValue: p.cashValue || 0,
    });
    setFormError('');
    setModalOpen(true);
  };

  const savePerk = async () => {
    if (!form.providerName.trim()) {
      setFormError('Provider name is required.');
      return;
    }
    if (!form.applicationDate) {
      setFormError('Application date is required.');
      return;
    }
    if (!form.applicantName.trim()) {
      setFormError('Applicant / owner is required.');
      return;
    }
    if (!form.bonusValue.trim()) {
      setFormError('Bonus description is required.');
      return;
    }
    setSaving(true);
    setFormError('');
    const payload = {
      providerName: form.providerName.trim(),
      category: form.category,
      applicationDate: form.applicationDate,
      closingDate: form.closingDate || undefined,
      exclusionPeriodMonths: Number(form.exclusionPeriodMonths) || 0,
      bonusValue: form.bonusValue.trim(),
      notes: form.notes.trim() || undefined,
      applicantName: form.applicantName.trim(),
      annualFee: Number(form.annualFee) || 0,
      pointsEarned: Number(form.pointsEarned) || 0,
      pointsProgram: form.pointsProgram,
      cashValue: Number(form.cashValue) || 0,
    };
    try {
      if (editingId) await onUpdateReward(editingId, payload);
      else await onAddReward(payload as any);
      setModalOpen(false);
    } catch (e: any) {
      setFormError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveGiftCard = async () => {
    if (!gcBrand.trim()) {
      setGcError('Brand is required.');
      return;
    }
    const val = Number(gcValue);
    if (!Number.isFinite(val) || val <= 0) {
      setGcError('Enter a valid value.');
      return;
    }
    setGcSaving(true);
    setGcError('');
    try {
      await onAddGiftCard({
        brand: gcBrand.trim(),
        initialValue: val,
        remainingBalance: val,
        currency: gcCurrency || 'AUD',
        expiryDate: gcExpiry || undefined,
        notes: gcNotes.trim() || undefined,
      } as any);
      setGcOpen(false);
      setGcBrand('');
      setGcValue('');
      setGcExpiry('');
      setGcNotes('');
    } catch (e: any) {
      setGcError(e?.message || 'Failed to add card');
    } finally {
      setGcSaving(false);
    }
  };

  const doRedeem = async () => {
    if (!redeemId) return;
    const amt = Number(redeemAmt);
    if (!Number.isFinite(amt) || amt <= 0) return;
    try {
      await onRedeemGiftCard(redeemId, amt);
      setRedeemId(null);
      setRedeemAmt('');
    } catch (e: any) {
      alert(e?.message || 'Redeem failed');
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full">
      {/* Header — Portfolio-level quiet chrome */}
      <div className="shrink-0 px-3 sm:px-4 pt-2 pb-2 space-y-2.5">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-violet-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/20 p-3 sm:p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Award className="w-5 h-5 text-violet-500 shrink-0" />
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Membership
                </h1>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-600/90 text-white">
                  Pulse
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                {stats.active} active
                {stats.soon ? ` · ${stats.soon} closing soon` : ''}
                {stats.closed ? ` · ${stats.closed} closed` : ''}
                {stats.value > 0 ? ` · ~$${stats.value.toLocaleString()} value` : ''}
                {tab === 'giftcards' && stats.gcBal > 0 ? ` · cards ~$${stats.gcBal.toLocaleString()}` : ''}
              </p>
            </div>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => (tab === 'memberships' ? openAdd() : setGcOpen(true))}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                {tab === 'memberships' ? 'Add' : 'Add card'}
              </button>
            )}
          </div>
        </div>

        {/* Main section tabs — like Portfolio View chips */}
        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-violet-500/80 dark:text-violet-400/80 w-10">
            View
          </span>
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-violet-100/80 dark:bg-violet-950/50 border border-violet-200/60 dark:border-violet-900/60">
            <button
              type="button"
              onClick={() => setTab('memberships')}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                tab === 'memberships'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                  : 'text-violet-700/70 dark:text-violet-300/70'
              }`}
            >
              <Award className="w-3 h-3" />
              Memberships
            </button>
            <button
              type="button"
              onClick={() => setTab('giftcards')}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                tab === 'giftcards'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                  : 'text-violet-700/70 dark:text-violet-300/70'
              }`}
            >
              <Gift className="w-3 h-3" />
              Gift cards
            </button>
          </div>
        </div>
      </div>

      {/* Sticky filters */}
      <div className="shrink-0 px-3 sm:px-4 pb-2 space-y-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'memberships' ? 'Search providers, owners, bonus…' : 'Search gift cards…'}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px] font-medium"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
        {tab === 'memberships' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-500/80 w-10">
                Status
              </span>
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100/90 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800">
                {(
                  [
                    ['all', 'All'],
                    ['active', 'Active'],
                    ['closing_soon', 'Closing soon'],
                    ['closed', 'Closed'],
                  ] as [StatusFilter, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStatusFilter(id)}
                    className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                      statusFilter === id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-md'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {categoriesPresent.length > 2 && (
              <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400/80 w-10">
                  Type
                </span>
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/50">
                  {categoriesPresent.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoryFilter(c)}
                      className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                        categoryFilter === c
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                          : 'text-emerald-800/70 dark:text-emerald-300/70'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 pb-28 space-y-2 pt-3">
        {tab === 'memberships' &&
          (filteredPerks.length === 0 ? (
            <div className="text-center py-14 space-y-2">
              <Award className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-[13px] font-bold text-slate-500">No memberships match</p>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={openAdd}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white"
                >
                  <Plus className="w-3.5 h-3.5" /> Add membership
                </button>
              )}
            </div>
          ) : (
            filteredPerks.map((p) => {
              const st = perkStatus(p);
              const days = daysUntil(p.closingDate);
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-3 ${
                    st === 'closed'
                      ? 'border-slate-200 dark:border-slate-800 opacity-60 bg-white dark:bg-slate-900'
                      : st === 'closing_soon'
                        ? 'border-amber-300/60 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-slate-900 dark:text-white truncate">
                        {p.providerName}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {p.category}
                        {p.applicantName ? ` · ${p.applicantName}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {p.cashValue > 0 && (
                        <p className="text-[12px] font-black text-emerald-600">
                          ${Number(p.cashValue).toLocaleString()}
                        </p>
                      )}
                      {st === 'closing_soon' && days != null && (
                        <p className="text-[9px] font-bold text-amber-600 flex items-center justify-end gap-0.5 mt-0.5">
                          <Flame className="w-3 h-3" /> {days}d left
                        </p>
                      )}
                      {st === 'closed' && <p className="text-[9px] font-bold text-slate-400">Closed</p>}
                      {st === 'active' && !p.closingDate && (
                        <p className="text-[9px] font-bold text-indigo-500">Active</p>
                      )}
                    </div>
                  </div>
                  {p.bonusValue && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-2">{p.bonusValue}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-semibold flex-wrap">
                    {p.applicationDate && (
                      <span className="inline-flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" /> {p.applicationDate}
                      </span>
                    )}
                    {p.closingDate && (
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> Closes {p.closingDate}
                      </span>
                    )}
                    {p.annualFee > 0 && <span>Fee ${p.annualFee}</span>}
                    {p.pointsEarned ? <span>{p.pointsEarned.toLocaleString()} pts</span> : null}
                  </div>
                  {!isReadOnly && (
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openClone(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      >
                        <Copy className="w-3 h-3" /> Clone
                      </button>
                      {st !== 'closed' && (
                        <button
                          type="button"
                          onClick={async () => {
                            const d = prompt('Close date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10));
                            if (!d) return;
                            try {
                              await onUpdateReward(p.id, { closingDate: d });
                            } catch (e: any) {
                              alert(e?.message || 'Failed');
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                        >
                          Close
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete ${p.providerName}?`)) onDeleteReward(p.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-600 ml-auto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ))}

        {tab === 'giftcards' &&
          (filteredCards.length === 0 ? (
            <div className="text-center py-14 space-y-2">
              <Gift className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-[13px] font-bold text-slate-500">No gift cards</p>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setGcOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white"
                >
                  <Plus className="w-3.5 h-3.5" /> Add card
                </button>
              )}
            </div>
          ) : (
            filteredCards.map((c) => {
              const st = giftCardStatus(c);
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-slate-900 dark:text-white truncate">{c.brand}</p>
                      <p className="text-[10px] font-bold text-slate-400 capitalize">
                        {st}
                        {c.expiryDate ? ` · exp ${c.expiryDate}` : ''}
                        {c.cardLast4 ? ` · ••${c.cardLast4}` : ''}
                      </p>
                    </div>
                    <p className="text-[13px] font-black tabular-nums shrink-0">
                      {c.currency || 'AUD'} {Number(c.remainingBalance || 0).toLocaleString()}
                    </p>
                  </div>
                  {!isReadOnly && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {st === 'active' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRedeemId(c.id);
                            setRedeemAmt('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40"
                        >
                          Redeem
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openCloneGiftCard(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 ml-auto"
                        title="Clone — buy the same card again"
                      >
                        <Copy className="w-3 h-3" /> Clone
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete gift card?')) onDeleteGiftCard(c.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {redeemId === c.id && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        value={redeemAmt}
                        onChange={(e) => setRedeemAmt(e.target.value)}
                        placeholder="Amount"
                        className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[12px]"
                      />
                      <button
                        type="button"
                        onClick={doRedeem}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-600 text-white"
                      >
                        OK
                      </button>
                      <button type="button" onClick={() => setRedeemId(null)} className="text-[10px] font-bold text-slate-400">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ))}
      </div>

      {/* Perk modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                {editingId ? 'Edit membership' : 'Add membership'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-[10px] font-bold text-slate-500">
              Provider
              <input
                value={form.providerName}
                onChange={(e) => setForm((f) => ({ ...f, providerName: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px] font-medium"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500">
                Category
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as any }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] font-bold text-slate-500">
                Applicant
                <input
                  value={form.applicantName}
                  onChange={(e) => setForm((f) => ({ ...f, applicantName: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500">
                Applied
                <input
                  type="date"
                  value={form.applicationDate}
                  onChange={(e) => setForm((f) => ({ ...f, applicationDate: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500">
                Closing
                <input
                  type="date"
                  value={form.closingDate}
                  onChange={(e) => setForm((f) => ({ ...f, closingDate: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                />
              </label>
            </div>
            <label className="block text-[10px] font-bold text-slate-500">
              Bonus description
              <input
                value={form.bonusValue}
                onChange={(e) => setForm((f) => ({ ...f, bonusValue: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                placeholder="e.g. 100k Qantas points"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-[10px] font-bold text-slate-500">
                Cash value
                <input
                  type="number"
                  value={form.cashValue}
                  onChange={(e) => setForm((f) => ({ ...f, cashValue: Number(e.target.value) }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500">
                Annual fee
                <input
                  type="number"
                  value={form.annualFee}
                  onChange={(e) => setForm((f) => ({ ...f, annualFee: Number(e.target.value) }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500">
                Exclusion mo
                <input
                  type="number"
                  value={form.exclusionPeriodMonths}
                  onChange={(e) => setForm((f) => ({ ...f, exclusionPeriodMonths: Number(e.target.value) }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500">
                Points program
                <select
                  value={form.pointsProgram}
                  onChange={(e) => setForm((f) => ({ ...f, pointsProgram: e.target.value as any }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                >
                  {PROGRAMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] font-bold text-slate-500">
                Points earned
                <input
                  type="number"
                  value={form.pointsEarned}
                  onChange={(e) => setForm((f) => ({ ...f, pointsEarned: Number(e.target.value) }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                />
              </label>
            </div>
            <label className="block text-[10px] font-bold text-slate-500">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
              />
            </label>
            {formError && <p className="text-[11px] font-bold text-rose-600">{formError}</p>}
            <button
              type="button"
              disabled={saving}
              onClick={savePerk}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-[12px] font-bold disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add membership'}
            </button>
          </div>
        </div>
      )}

      {/* Gift card modal */}
      {gcOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Add gift card</h2>
              <button type="button" onClick={() => setGcOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-[10px] font-bold text-slate-500">
              Brand
              <input
                value={gcBrand}
                onChange={(e) => setGcBrand(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500">
                Value
                <input
                  type="number"
                  value={gcValue}
                  onChange={(e) => setGcValue(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500">
                Currency
                <input
                  value={gcCurrency}
                  onChange={(e) => setGcCurrency(e.target.value.toUpperCase())}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
                />
              </label>
            </div>
            <label className="block text-[10px] font-bold text-slate-500">
              Expiry
              <input
                type="date"
                value={gcExpiry}
                onChange={(e) => setGcExpiry(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
              />
            </label>
            <label className="block text-[10px] font-bold text-slate-500">
              Notes
              <input
                value={gcNotes}
                onChange={(e) => setGcNotes(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px]"
              />
            </label>
            {gcError && <p className="text-[11px] font-bold text-rose-600">{gcError}</p>}
            <button
              type="button"
              disabled={gcSaving}
              onClick={saveGiftCard}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-[12px] font-bold disabled:opacity-50"
            >
              {gcSaving ? 'Saving…' : 'Add gift card'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
