/**
 * Pulse Membership — full RewardsTracker feature set inside Pulse chrome.
 * Add/edit/clone, gift cards, points, filters all available.
 */
import React from 'react';
import PulsePageShell from './PulsePageShell';
import RewardsTracker from './RewardsTracker';
import { RewardPerk, GiftCard } from '../types';

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

export default function PulseMembership(props: Props) {
  return (
    <PulsePageShell
      title="Membership"
      subtitle={`${props.rewardsPerks?.length || 0} perks · ${props.giftCards?.length || 0} gift cards`}
    >
      <div className="px-1 sm:px-2">
        <RewardsTracker {...props} />
      </div>
    </PulsePageShell>
  );
}
