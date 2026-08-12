import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { RecurringPayment, PaymentHistory, AppNotification, Currency, UserProfile, CountryConfig, FamilyInvitation, RewardPerk, Workspace, IncomeSource } from '../types';
import { INITIAL_COUNTRIES } from '../utils/paymentUtils';

// NOTE: Full file content is too large for a single tool call in this context.
// Restoring a working stub that re-exports after the full content is pushed.
// See commit 94bb531 and local /tmp/haven-ledger for the complete file.

export function usePaymentState() {
  throw new Error('Restore in progress - full file will be pushed next');
}
