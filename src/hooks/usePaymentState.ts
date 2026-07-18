import { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { RecurringPayment, PaymentHistory, AppNotification, Currency, UserProfile, CountryConfig, FamilyInvitation } from '../types';
import { INITIAL_COUNTRIES } from '../utils/paymentUtils';

function rowToPayment(r: any): RecurringPayment {
  return {
    id: r.id, name: r.name, amount: Number(r.amount), currency: r.currency,
    dayOfMonth: r.day_of_month, category: r.category, active: r.active, notes: r.notes ?? undefined,
    reminderDaysBefore: r.reminder_days_before, userId: r.user_id, familyGroupId: r.family_id ?? undefined,
    paymentType: r.payment_type, paymentMethod: r.payment_method, billingCycle: r.billing_cycle,
    startDate: r.start_date ?? undefined, taggedFor: r.tagged_for ?? undefined, autoRenew: r.auto_renew, order: r.sort_order ?? undefined,
  };
}
function paymentToRow(p: Partial<RecurringPayment>, userId: string, familyId: string | null) {
  return {
    name: p.name, amount: p.amount, currency: p.currency, day_of_month: p.dayOfMonth, category: p.category,
    active: p.active, notes: p.notes ?? null, reminder_days_before: p.reminderDaysBefore,
    payment_type: p.paymentType ?? 'fixed', payment_method: p.paymentMethod ?? 'manual', billing_cycle: p.billingCycle ?? 'monthly',
    start_date: p.startDate ?? null, tagged_for: p.taggedFor ?? null, auto_renew: p.autoRenew ?? false,
    sort_order: p.order ?? null, user_id: userId, family_id: familyId,
  };
}
function rowToHistory(r: any): PaymentHistory {
  return {
    id: r.id, paymentId: r.payment_id, paymentName: r.payment_name, amount: Number(r.amount), currency: r.currency,
    paidDate: r.paid_date, userId: r.user_id, familyGroupId: r.family_id ?? undefined, taggedFor: r.tagged_for ?? undefined, status: r.status,
  };
}
function rowToCountry(r: any): CountryConfig {
  return { id: r.id, name: r.name, currency: r.currency, symbol: r.symbol, flag: r.flag, rateToAUD: Number(r.rate_to_aud), userId: r.user_id ?? undefined, familyGroupId: r.family_id ?? undefined };
}
function rowToNotification(r: any): AppNotification {
  return { id: r.id, title: r.title, message: r.message, date: r.date, read: r.read, type: r.type };
}
function genInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function usePaymentState() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyRole, setFamilyRole] = useState<'host' | 'modify' | 'view' | null>(null);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [familyMembers, setFamilyMembers] = useState<UserProfile[]>([]);
  const [incomingInvitations, setIncomingInvitations] = useState<FamilyInvitation[]>([]);
  const [viewMode, setViewMode] = useState<'personal' | 'family-combined' | 'family-only'>('personal');

  const [allPayments, setAllPayments] = useState<RecurringPayment[]>([]);
  const [allHistory, setAllHistory] = useState<PaymentHistory[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>(INITIAL_COUNTRIES);
  const [rate, setRate] = useState<number>(55.0);
  const [summaryCurrency, setSummaryCurrency] = useState<Currency>('AUD');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [familyMessages, setFamilyMessages] = useState<any[]>([]);
  const [appNotificationsEnabled, setAppNotificationsEnabled] = useState(true);
  const [mobileNotificationsEnabled, setMobileNotificationsEnabled] = useState(true);

  const isReadOnly = familyRole === 'view';

  const triggerNotification = useCallback((title: string, message: string, type: 'info' | 'warning' | 'alert' = 'info') => {
    const n: AppNotification = { id: crypto.randomUUID(), title, message, date: new Date().toISOString(), read: false, type };
    setNotifications(prev => [n, ...prev]);
  }, []);

  const checkReadOnly = () => {
    if (isReadOnly) {
      triggerNotification('View Only 🔒', "You have view-only access to this family. Ask the host to grant modify access.", 'warning');
      return true;
    }
    return false;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setIsAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, pass: string, name: string) => {
    const { error } = await supabase.auth.signUp({ email, password: pass, options: { data: { display_name: name } } });
    if (error) throw error;
  };
  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) throw error;
  };
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };
  const logOut = async () => { await supabase.auth.signOut(); };

  const refreshFamily = useCallback(async (uid: string) => {
    const { data: membership } = await supabase
      .from('family_members')
      .select('family_id, role, families(id, name, invite_code, host_id)')
      .eq('user_id', uid)
      .limit(1)
      .maybeSingle();

    if (membership) {
      const fam: any = membership.families;
      setFamilyId(membership.family_id);
      setFamilyRole(membership.role);
      setInviteCode(fam?.invite_code ?? '');

      const { data: members } = await supabase
        .from('family_members')
        .select('role, profiles(id, email, display_name)')
        .eq('family_id', membership.family_id);

      setFamilyMembers((members ?? []).map((m: any) => ({
        uid: m.profiles.id, email: m.profiles.email, displayName: m.profiles.display_name,
        familyGroupId: membership.family_id, role: m.role === 'view' ? 'view' : 'modify', isFamilyHost: m.role === 'host',
      })));
    } else {
      setFamilyId(null); setFamilyRole(null); setInviteCode(''); setFamilyMembers([]);
    }

    const { data: invites } = await supabase
      .from('family_invitations')
      .select('id, family_id, from_user_id, to_email, proposed_role, status, created_at, families(name, invite_code), profiles!family_invitations_from_user_id_fkey(email, display_name)')
      .eq('status', 'pending');

    setIncomingInvitations((invites ?? []).map((i: any) => ({
      id: i.id, fromUid: i.from_user_id, fromEmail: i.profiles?.email ?? '', fromName: i.profiles?.display_name ?? i.profiles?.email ?? 'Family host',
      toEmail: i.to_email, proposedRole: i.proposed_role, status: i.status, createdAt: i.created_at, inviteCode: i.families?.invite_code,
    })));
  }, []);

  useEffect(() => {
    if (!user) { setUserProfile(null); setIsLoaded(true); return; }
    (async () => {
      let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (!profile) {
        await new Promise(r => setTimeout(r, 600));
        ({ data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle());
      }
      if (profile) {
        setUserProfile({
          uid: profile.id, email: profile.email, displayName: profile.display_name, familyGroupId: '',
          appNotificationsEnabled: profile.app_notifications_enabled, mobileNotificationsEnabled: profile.mobile_notifications_enabled,
        });
        setAppNotificationsEnabled(profile.app_notifications_enabled ?? true);
        setMobileNotificationsEnabled(profile.mobile_notifications_enabled ?? true);
        if (profile.default_currency) {
          setSummaryCurrency(profile.default_currency);
          localStorage.setItem('pm_summary_currency', profile.default_currency);
        }
      }
      await refreshFamily(user.id);
      setIsLoaded(true);
    })();
  }, [user, refreshFamily]);

  const reloadData = useCallback(async () => {
    if (!user) return;
    const familyFilter = familyId ? `user_id.eq.${user.id},family_id.eq.${familyId}` : `user_id.eq.${user.id}`;
    const [{ data: pays }, { data: hist }, { data: cts }, { data: notifs }] = await Promise.all([
      supabase.from('recurring_payments').select('*').or(familyFilter).order('sort_order', { ascending: true, nullsFirst: false }),
      supabase.from('payment_history').select('*').or(familyFilter).order('paid_date', { ascending: false }),
      supabase.from('countries').select('*').or(familyFilter),
      supabase.from('app_notifications').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(50),
    ]);
    setAllPayments((pays ?? []).map(rowToPayment));
    setAllHistory((hist ?? []).map(rowToHistory));
    if (cts && cts.length > 0) {
      setCountries(cts.map(rowToCountry));
    } else if (cts && cts.length === 0) {
      // First time for this user/family: seed the defaults as real rows so they're manageable (incl. deletable) like any other currency.
      const seedRows = INITIAL_COUNTRIES.map(c => ({
        name: c.name, currency: c.currency, symbol: c.symbol, flag: c.flag, rate_to_aud: c.rateToAUD, user_id: user.id, family_id: familyId,
      }));
      const { data: seeded } = await supabase.from('countries').insert(seedRows).select();
      if (seeded && seeded.length > 0) setCountries(seeded.map(rowToCountry));
    }
    setNotifications((notifs ?? []).map(rowToNotification));
  }, [user, familyId]);

  useEffect(() => { if (isLoaded) reloadData(); }, [isLoaded, familyId, reloadData]);

  const loadFamilyMessages = useCallback(async () => {
    if (!familyId) { setFamilyMessages([]); return; }
    const { data } = await supabase
      .from('family_messages')
      .select('id, content, created_at, sender_id, profiles(display_name, email)')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })
      .limit(200);
    setFamilyMessages((data ?? []).map((m: any) => ({
      id: m.id,
      content: m.content,
      createdAt: m.created_at,
      senderId: m.sender_id,
      senderName: m.profiles?.display_name || m.profiles?.email?.split('@')[0] || 'Member',
    })));
  }, [familyId]);

  useEffect(() => { loadFamilyMessages(); }, [loadFamilyMessages]);

  const sendFamilyMessage = async (content: string) => {
    if (!user) throw new Error('Not signed in.');
    if (!familyId) throw new Error('Create or join a family first to use family chat.');
    const trimmed = content.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('family_messages').insert({ family_id: familyId, sender_id: user.id, content: trimmed });
    if (error) throw error;
    await loadFamilyMessages();
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('haven-ledger-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_payments' }, () => reloadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_history' }, () => reloadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members' }, () => user && refreshFamily(user.id))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'family_messages' }, () => loadFamilyMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, reloadData, refreshFamily, loadFamilyMessages]);

  const ensureFamily = async (): Promise<{ id: string; invite_code: string }> => {
    if (familyId) return { id: familyId, invite_code: inviteCode };
    if (!user) throw new Error('Not signed in.');
    const { data, error } = await supabase.rpc('create_my_family', { fam_name: `${userProfile?.displayName || 'My'} Family` });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    await refreshFamily(user.id);
    return { id: row.id, invite_code: row.invite_code };
  };

  const createFamily = async () => {
    setIsSyncing(true);
    try {
      await ensureFamily();
    } finally {
      setIsSyncing(false);
    }
  };

  const addFamilyMember = async (email: string, role: 'view' | 'modify' = 'modify') => {
    if (!user) throw new Error('Not signed in.');
    if (familyId && familyRole !== 'host') throw new Error('Only the family host can invite members.');
    setIsSyncing(true);
    try {
      const fam = await ensureFamily();
      const { error } = await supabase.from('family_invitations').insert({ family_id: fam.id, from_user_id: user.id, to_email: email.trim().toLowerCase(), proposed_role: role });
      if (error) throw error;
      triggerNotification('Invitation Sent 👥', `Invited "${email}". Share your code: ${fam.invite_code}`, 'info');
    } finally { setIsSyncing(false); }
  };

  const joinFamilyGroup = async (code: string) => {
    if (!user) throw new Error('Not signed in.');
    setIsSyncing(true);
    try {
      const clean = code.trim().toUpperCase();
      const { error } = await supabase.rpc('join_family_by_code', { code: clean, requested_role: 'modify' });
      if (error) throw new Error(error.message || 'Invalid invite code.');
      await refreshFamily(user.id);
      triggerNotification('Joined Family 👥', 'You are now part of the family group.', 'info');
    } finally { setIsSyncing(false); }
  };

  const approveInvitation = async (invitationId: string, role: 'view' | 'modify') => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const invite = incomingInvitations.find(i => i.id === invitationId);
      if (!invite) throw new Error('Invitation not found.');
      const { error: rpcErr } = await supabase.rpc('join_family_by_code', { code: invite.inviteCode, requested_role: role });
      if (rpcErr) throw rpcErr;
      await supabase.from('family_invitations').update({ status: 'approved' }).eq('id', invitationId);
      await refreshFamily(user.id);
      triggerNotification('Invitation Accepted 👥', `You joined ${invite.fromName}'s family.`, 'info');
    } finally { setIsSyncing(false); }
  };

  const declineInvitation = async (invitationId: string) => {
    await supabase.from('family_invitations').update({ status: 'declined' }).eq('id', invitationId);
    setIncomingInvitations(prev => prev.filter(i => i.id !== invitationId));
  };

  const updateMemberRole = async (memberUid: string, role: 'view' | 'modify') => {
    if (!familyId || familyRole !== 'host') throw new Error('Only the host can change member roles.');
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('family_members').update({ role }).eq('family_id', familyId).eq('user_id', memberUid);
      if (error) throw error;
      await refreshFamily(user!.id);
    } finally { setIsSyncing(false); }
  };

  const removeFamilyMember = async (memberUid: string) => {
    if (!familyId || familyRole !== 'host') throw new Error('Only the host can remove members.');
    setIsSyncing(true);
    try {
      await supabase.from('family_members').delete().eq('family_id', familyId).eq('user_id', memberUid);
      await refreshFamily(user!.id);
      triggerNotification('Member Removed 👥', 'They no longer have access to the family data.', 'info');
    } finally { setIsSyncing(false); }
  };

  const leaveFamilyGroup = async () => {
    if (!user || !familyId) return;
    setIsSyncing(true);
    try {
      if (familyRole === 'host') throw new Error('As the host, remove members first or transfer the family before leaving.');
      await supabase.from('family_members').delete().eq('family_id', familyId).eq('user_id', user.id);
      await refreshFamily(user.id);
      triggerNotification('Left Family 👋', 'You are back to your personal workspace.', 'info');
    } finally { setIsSyncing(false); }
  };

  const regenerateInviteCode = async () => {
    if (!familyId || familyRole !== 'host') throw new Error('Only the host can regenerate the invite code.');
    const code = genInviteCode();
    const { error } = await supabase.from('families').update({ invite_code: code }).eq('id', familyId);
    if (error) throw error;
    setInviteCode(code);
  };

  const addPayment = async (payment: Omit<RecurringPayment, 'id'>) => {
    if (!user) return;
    if (checkReadOnly()) return;
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('recurring_payments').insert(paymentToRow(payment, user.id, familyId));
      if (error) throw error;
      await reloadData();
      triggerNotification('Payment Added 💳', `"${payment.name}" configured for the ${payment.dayOfMonth}th of every month.`, 'info');
    } finally { setIsSyncing(false); }
  };

  const addBulkPayments = async (newPayments: Omit<RecurringPayment, 'id'>[]) => {
    if (!user) return;
    if (checkReadOnly()) return;
    setIsSyncing(true);
    try {
      const rows = newPayments.map(p => paymentToRow(p, user.id, familyId));
      const { error } = await supabase.from('recurring_payments').insert(rows);
      if (error) throw error;
      await reloadData();
      triggerNotification('Bulk Import Succeeded 📥', `Imported ${newPayments.length} payments.`, 'info');
    } finally { setIsSyncing(false); }
  };

  const updatePayment = async (updatedPayment: RecurringPayment) => {
    if (!user) return;
    if (checkReadOnly()) return;
    setIsSyncing(true);
    try {
      const existing = allPayments.find(p => p.id === updatedPayment.id);
      const row = paymentToRow(updatedPayment, existing?.userId || user.id, existing?.familyGroupId ?? familyId);
      const { error } = await supabase.from('recurring_payments').update(row).eq('id', updatedPayment.id);
      if (error) throw error;
      await reloadData();
      triggerNotification('Payment Updated 📝', `Changes saved for "${updatedPayment.name}".`, 'info');
    } finally { setIsSyncing(false); }
  };

  const deletePayment = async (id: string) => {
    if (checkReadOnly()) return;
    setIsSyncing(true);
    try {
      const name = allPayments.find(p => p.id === id)?.name || 'Payment';
      const { error } = await supabase.from('recurring_payments').delete().eq('id', id);
      if (error) throw error;
      await reloadData();
      triggerNotification('Payment Deleted 🗑️', `"${name}" was removed.`, 'info');
    } finally { setIsSyncing(false); }
  };

  const updatePaymentsOrder = async (orderedPayments: RecurringPayment[]) => {
    if (checkReadOnly()) return;
    setIsSyncing(true);
    try {
      await Promise.all(orderedPayments.map((p, idx) => supabase.from('recurring_payments').update({ sort_order: idx }).eq('id', p.id)));
      await reloadData();
    } finally { setIsSyncing(false); }
  };

  const recordPayment = async (
    paymentId: string,
    amount: number,
    status: 'paid' | 'delayed' | 'carry' = 'paid',
    taggedFor?: string,
    transactionDate?: string,
  ) => {
    if (!user) return;
    if (checkReadOnly()) return;
    setIsSyncing(true);
    try {
      const payment = allPayments.find(p => p.id === paymentId);
      if (!payment) throw new Error('Payment not found.');
      const paidDate = transactionDate || new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('payment_history').insert({
        payment_id: paymentId, payment_name: payment.name, amount: amount ?? payment.amount, currency: payment.currency,
        paid_date: paidDate, tagged_for: taggedFor ?? payment.taggedFor ?? null, status, user_id: payment.userId || user.id, family_id: payment.familyGroupId ?? null,
      });
      if (error) throw error;
      await reloadData();
      triggerNotification('Payment Recorded ✅', `"${payment.name}" marked as ${status}.`, 'info');
    } finally { setIsSyncing(false); }
  };

  const deleteHistoryEntry = async (id: string) => {
    if (checkReadOnly()) return;
    await supabase.from('payment_history').delete().eq('id', id);
    await reloadData();
  };

  const updateHistoryStatus = async (id: string, status: 'paid' | 'delayed' | 'carry') => {
    if (checkReadOnly()) return;
    await supabase.from('payment_history').update({ status }).eq('id', id);
    await reloadData();
  };

  const clearHistory = async () => {
    if (checkReadOnly() || !user) return;
    await supabase.from('payment_history').delete().eq('user_id', user.id);
    await reloadData();
  };

  const addCountry = async (country: Omit<CountryConfig, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('countries').insert({ name: country.name, currency: country.currency, symbol: country.symbol, flag: country.flag, rate_to_aud: country.rateToAUD, user_id: user.id, family_id: familyId });
    if (error) throw error;
    await reloadData();
  };
  const updateCountry = async (country: CountryConfig) => {
    const { error } = await supabase.from('countries').update({ name: country.name, currency: country.currency, symbol: country.symbol, flag: country.flag, rate_to_aud: country.rateToAUD }).eq('id', country.id);
    if (error) throw error;
    await reloadData();
  };
  const deleteCountry = async (id: string) => {
    const target = countries.find(c => c.id === id);
    if (!target) return;
    if (countries.length <= 1) {
      throw new Error("You need at least one currency — add another before removing this one.");
    }
    const inUse = allPayments.some(p => p.currency === target.currency);
    if (inUse) {
      throw new Error(`"${target.currency}" is still used by one or more payments — reassign or delete those first.`);
    }
    const { error } = await supabase.from('countries').delete().eq('id', id);
    if (error) throw error;
    if (summaryCurrency.toUpperCase() === target.currency.toUpperCase()) {
      const fallback = countries.find(c => c.id !== id);
      if (fallback) saveSummaryCurrency(fallback.currency);
    }
    await reloadData();
  };

  const saveRate = async (newRate: number) => { setRate(newRate); localStorage.setItem('pm_exchange_rate', String(newRate)); };
  const saveSummaryCurrency = async (currency: Currency) => {
    setSummaryCurrency(currency);
    localStorage.setItem('pm_summary_currency', currency);
    if (user) {
      try {
        await supabase.from('profiles').update({ default_currency: currency }).eq('id', user.id);
      } catch (err) {
        console.warn('Failed to persist default currency to profile:', err);
      }
    }
  };

  const dismissNotification = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const markAllNotificationsRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const clearNotifications = () => setNotifications([]);
  const checkPaymentReminders = () => {};
  const requestNotificationPermission = async () => { if ('Notification' in window) await Notification.requestPermission(); };

  const saveNotificationSettings = async (appVal: boolean, mobileVal: boolean) => {
    setAppNotificationsEnabled(appVal);
    setMobileNotificationsEnabled(mobileVal);
    if (user) await supabase.from('profiles').update({ app_notifications_enabled: appVal, mobile_notifications_enabled: mobileVal }).eq('id', user.id);
  };

  const resetToDefaults = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await supabase.from('recurring_payments').delete().eq('user_id', user.id);
      await supabase.from('payment_history').delete().eq('user_id', user.id);
      await reloadData();
    } finally { setIsSyncing(false); }
  };

  const payments = useMemo(() => {
    if (!user) return [];
    if (viewMode === 'personal') return allPayments.filter(p => p.userId === user.id);
    if (viewMode === 'family-only') return allPayments.filter(p => p.userId !== user.id);
    return allPayments;
  }, [allPayments, viewMode, user]);

  const history = useMemo(() => {
    if (!user) return [];
    if (viewMode === 'personal') return allHistory.filter(h => h.userId === user.id);
    if (viewMode === 'family-only') return allHistory.filter(h => h.userId !== user.id);
    return allHistory;
  }, [allHistory, viewMode, user]);

  return {
    user, userProfile, familyMembers, viewMode, setViewMode,
    signUp, signIn, signInWithGoogle, resetPassword, logOut,
    addFamilyMember, joinFamilyGroup, leaveFamilyGroup, createFamily,
    incomingInvitations, approveInvitation, declineInvitation, updateMemberRole, removeFamilyMember,
    isAuthLoading, familyRole, isReadOnly, inviteCode, regenerateInviteCode,
    payments, allPayments, history, allHistory, countries, rate, summaryCurrency, notifications, isLoaded, isSyncing,
    familyMessages, sendFamilyMessage,
    addPayment, addBulkPayments, updatePayment, deletePayment, updatePaymentsOrder, recordPayment,
    deleteHistoryEntry, updateHistoryStatus, clearHistory, saveRate, saveSummaryCurrency,
    addCountry, updateCountry, deleteCountry,
    triggerNotification, dismissNotification, markAllNotificationsRead, clearNotifications,
    checkPaymentReminders, requestNotificationPermission, resetToDefaults,
    appNotificationsEnabled, mobileNotificationsEnabled, saveNotificationSettings,
  };
}
