/**
 * Pulse Membership / Rewards — cleaner list + status filters.
 * Classic RewardsTracker remains available via Classic toggle.
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
  /** Open classic-style add form via parent if needed — we provide simple inline add later */
  onOpenClassicAdd?: () => void;
}

type Tab = 'memberships' | 'giftcards';
type PerkFilter = 'all' | 'open' | 'closing_soon' | 'closed';

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export default function PulseMembership({
  rewardsPerks,
  onDeleteReward,
  giftCards,
  onDeleteGiftCard,
  isReadOnly = false,
}: Props) {
  const [tab, setTab] = useState<Tab>('memberships');
  const [search, setSearch] = useState('');
  const [perkFilter, setPerkFilter] = useState<PerkFilter>('all');

  const filteredPerks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rewardsPerks
      .filter((p) => {
        const days = daysUntil(p.closingDate);
        const closed = p.closingDate ? (days != null && days < 0) : false;
        const soon = days != null && days >= 0 && days <= 30;
        if (perkFilter === 'closed' && !closed) return false;
        if (perkFilter === 'open' && closed) return false;
        if (perkFilter === 'closing_soon' && !soon) return false;
        if (q) {
          const hay = `${p.providerName} ${p.category} ${p.applicantName || ''} ${p.notes || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = daysUntil(a.closingDate);
        const db = daysUntil(b.closingDate);
        // soonest closing first among open
        if (da == null && db == null) return a.providerName.localeCompare(b.providerName);
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
  }, [rewardsPerks, search, perkFilter]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return giftCards.filter((c) => {
      if (!q) return true;
      return `${c.brand || ''} ${c.notes || ''}`.toLowerCase().includes(q);
    });
  }, [giftCards, search]);

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full">
      <div className="shrink-0 px-3 sm:px-4 pt-2 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Membership
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-600 text-white">
                Pulse
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold">
              {rewardsPerks.length} memberships · {giftCards.length} gift cards
            </p>
          </div>
          <div className="inline-flex p-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTab('memberships')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                tab === 'memberships' ? 'bg-violet-600 text-white' : 'text-slate-500'
              }`}
            >
              <Award className="w-3 h-3 inline mr-1" />
              Perks
            </button>
            <button
              type="button"
              onClick={() => setTab('giftcards')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                tab === 'giftcards' ? 'bg-violet-600 text-white' : 'text-slate-500'
              }`}
            >
              <Gift className="w-3 h-3 inline mr-1" />
              Gift cards
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'memberships' ? 'Search memberships…' : 'Search gift cards…'}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px] font-medium"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {tab === 'memberships' && (
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {(
              [
                ['all', 'All'],
                ['open', 'Open'],
                ['closing_soon', 'Closing soon'],
                ['closed', 'Closed'],
              ] as [PerkFilter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPerkFilter(id)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  perkFilter === id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950'
                    : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <p className="text-[10px] text-slate-400">
          Full add/edit forms are on Classic for now — switch with the Pulse icon. Pulse focuses on browsing and status.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 pb-28 space-y-2">
        {tab === 'memberships' &&
          (filteredPerks.length === 0 ? (
            <p className="text-center text-[12px] text-slate-400 py-12">No memberships match</p>
          ) : (
            filteredPerks.map((p) => {
              const days = daysUntil(p.closingDate);
              const closed = days != null && days < 0;
              const soon = days != null && days >= 0 && days <= 30;
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-3 ${
                    closed
                      ? 'border-slate-200 dark:border-slate-800 opacity-60'
                      : soon
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
                      {p.bonusValue != null && p.bonusValue > 0 && (
                        <p className="text-[12px] font-black text-emerald-600">${Number(p.bonusValue).toLocaleString()}</p>
                      )}
                      {soon && !closed && (
                        <p className="text-[9px] font-bold text-amber-600 flex items-center justify-end gap-0.5 mt-0.5">
                          <Flame className="w-3 h-3" /> {days}d left
                        </p>
                      )}
                      {closed && <p className="text-[9px] font-bold text-slate-400">Closed</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-semibold">
                    {p.applicationDate && (
                      <span className="inline-flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" /> Applied {p.applicationDate}
                      </span>
                    )}
                    {p.closingDate && (
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> Closes {p.closingDate}
                      </span>
                    )}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete ${p.providerName}?`)) onDeleteReward(p.id);
                        }}
                        className="ml-auto text-rose-500 font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ))}

        {tab === 'giftcards' &&
          (filteredCards.length === 0 ? (
            <p className="text-center text-[12px] text-slate-400 py-12">No gift cards match</p>
          ) : (
            filteredCards.map((c) => {
              const st = typeof giftCardStatus === 'function' ? giftCardStatus(c) : 'active';
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-slate-900 dark:text-white truncate">
                      {(c as any).brand || (c as any).name || 'Gift card'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 capitalize">{String(st)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-black tabular-nums">
                      ${Number((c as any).balance ?? (c as any).remainingValue ?? (c as any).amount ?? 0).toLocaleString()}
                    </p>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete gift card?')) onDeleteGiftCard(c.id);
                        }}
                        className="text-rose-500 mt-1"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ))}
      </div>
    </div>
  );
}
