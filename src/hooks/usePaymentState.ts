import { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { RecurringPayment, PaymentHistory, AppNotification, Currency, UserProfile, CountryConfig, FamilyInvitation, RewardPerk, Workspace, IncomeSource } from '../types';
import { INITIAL_COUNTRIES } from '../utils/paymentUtils';

function rowToPayment(r: any): RecurringPayment {
  return {
    id: r.id, name: r.name, amount: Number(r.amount), currency: r.currency,
    dayOfMonth: r.day_of_month, category: r.category, active: r.active, notes: r.notes ?? undefined,
    reminderDaysBefore: r.reminder_days_before, userId: r.user_id, familyGroupId: r.workspace_id ?? undefined,
    paymentType: r.payment_type, paymentMethod: r.payment_method, billingCycle: r.billing_cycle,
    startDate: r.start_date ?? undefined, taggedFor: r.tagged_for ?? undefined, autoRenew: r.auto_renew, order: r.sort_order ?? undefined,
  };
}
function paymentToRow(p: Partial<RecurringPayment>, userId: string, workspaceId: string | null) {
  return {
    name: p.name, amount: p.amount, currency: p.currency, day_of_month: p.dayOfMonth, category: p.category,
    active: p.active, notes: p.notes ?? null, reminder_days_before: p.reminderDaysBefore,
    payment_type: p.paymentType ?? 'fixed', payment_method: p.paymentMethod ?? 'manual', billing_cycle: p.billingCycle ?? 'monthly',
    start_date: p.startDate ?? null, tagged_for: p.taggedFor ?? null, auto_renew: p.autoRenew ?? false,
    sort_order: p.order ?? null, user_id: userId, workspace_id: workspaceId,
  };
}
function rowToHistory(r: any): PaymentHistory {
  return {
    id: r.id, paymentId: r.payment_id, paymentName: r.payment_name, amount: Number(r.amount), currency: r.currency,
    paidDate: r.paid_date, userId: r.user_id, familyGroupId: r.workspace_id ?? undefined, taggedFor: r.tagged_for ?? undefined, status: r.status,
  };
}
function rowToCountry(r: any): CountryConfig {
  return { id: r.id, name: r.name, currency: r.currency, symbol: r.symbol, flag: r.flag, rateToAUD: Number(r.rate_to_aud), userId: r.user_id ?? undefined, familyGroupId: r.workspace_id ?? undefined };
}
function rowToNotification(r: any): AppNotification {
  return { id: r.id, title: r.title, message: r.message, date: r.date, read: r.read, type: r.type };
}
function rowToReward(r: any): RewardPerk {
  return {
    id: r.id, providerName: r.provider_name, category: r.category, applicationDate: r.application_date,
    closingDate: r.closing_date ?? undefined, exclusionPeriodMonths: r.exclusion_period_months, bonusValue: r.bonus_value ?? undefined,
    notes: r.notes ?? undefined, applicantName: r.applicant_name ?? undefined, annualFee: Number(r.annual_fee ?? 0),
    pointsEarned: r.points_earned != null ? Number(r.points_earned) : undefined, pointsProgram: r.points_program ?? undefined,
    cashValue: Number(r.cash_value ?? 0), userId: r.user_id, familyGroupId: r.workspace_id ?? undefined,
  };
}

export function usePaymentState() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // ---------- Multi-workspace state ----------
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const activeWorkspace = useMemo(() => workspaces.find(w => w.id === activeWorkspaceId) || null, [workspaces, activeWorkspaceId]);
  const familyRole = activeWorkspace?.role ?? null; // kept name for backward compat across components
  const inviteCode = activeWorkspace?.inviteCode ?? '';
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
  const [rewardsPerks, setRewardsPerks] = useState<RewardPerk[]>([]);
  const [appNotificationsEnabled, setAppNotificationsEnabled] = useState(true);
  const [mobileNotificationsEnabled, setMobileNotificationsEnabled] = useState(true);

  const isReadOnly = familyRole === 'view';

  const triggerNotification = useCallback((title: string, message: string, type: 'info' | 'warning' | 'alert' = 'info') => {
    const n: AppNotification = { id: crypto.randomUUID(), title, message, date: new Date().toISOString(), read: false, type };
    setNotifications(prev => [n, ...prev]);
  }, []);

  const checkReadOnly = () => {
    if (isReadOnly) {
      triggerNotification('View Only 🔒', "You have view-only access to this workspace. Ask the owner to grant edit access.", 'warning');
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
  const updateDisplayName = async (name: string) => {
    if (!user) throw new Error('Not signed in.');
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Please enter a name.');
    const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', user.id);
    if (error) throw error;
    setUserProfile(prev => prev ? { ...prev, displayName: trimmed } : prev);
    await refreshWorkspaces(user.id, activeWorkspaceId);
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };
  const acceptPrivacyPolicy = async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (!uid) return;
    await supabase.from('profiles').update({ privacy_accepted_at: new Date().toISOString() }).eq('id', uid);
  };
  const logOut = async () => { await supabase.auth.signOut(); };

  // Load every workspace this user belongs to (not just one)
  const refreshWorkspaces = useCallback(async (uid: string, preferredActiveId?: string | null) => {
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, access_level, enabled_features, landing_tab, portfolio_column_prefs, workspaces(id, name, type, invite_code, owner_id, income_mode, monthly_income)')
      .eq('user_id', uid);

    const list: Workspace[] = (memberships ?? []).map((m: any) => ({
      id: m.workspace_id,
      name: m.workspaces?.name ?? 'Workspace',
      type: (m.workspaces?.type ?? 'family') as 'family' | 'business',
      inviteCode: m.workspaces?.invite_code ?? '',
      role: m.role,
      isOwner: m.workspaces?.owner_id === uid,
      incomeMode: (m.workspaces?.income_mode ?? 'simple') as 'simple' | 'detailed',
      monthlyIncome: m.workspaces?.monthly_income ?? '',
      accessLevel: (m.access_level ?? 'full') as 'full' | 'limited',
      enabledFeatures: m.enabled_features ?? ['income', 'rewards', 'ai', 'team', 'chat', 'agent', 'whatsapp', 'portfolio'],
      landingTab: m.landing_tab ?? null,
      columnPrefs: m.portfolio_column_prefs ?? null,
    }));
    setWorkspaces(list);

    const nextActive = list.find(w => w.id === preferredActiveId) || list[0] || null;
    setActiveWorkspaceId(nextActive?.id ?? null);

    if (nextActive) {
      const { data: members } = await supabase
        .from('workspace_members')
        .select('role, profiles(id, email, display_name)')
        .eq('workspace_id', nextActive.id);
      setFamilyMembers((members ?? []).map((m: any) => ({
        uid: m.profiles.id, email: m.profiles.email, displayName: m.profiles.display_name,
        familyGroupId: nextActive.id, role: m.role === 'view' ? 'view' : 'modify', isFamilyHost: m.role === 'host',
      })));
    } else {
      setFamilyMembers([]);
    }

    const { data: invites, error: invitesError } = await supabase
      .from('workspace_invitations')
      .select('id, workspace_id, from_user_id, to_email, proposed_role, proposed_access_level, proposed_features, status, created_at, workspaces(name, invite_code), profiles!family_invitations_from_user_id_fkey(email, display_name)')
      .eq('status', 'pending')
      .neq('from_user_id', uid); // "incoming" means addressed to me, not sent by me - RLS alone permits both directions
    if (invitesError) console.error('Failed to load pending invitations:', invitesError);

    setIncomingInvitations((invites ?? []).map((i: any) => ({
      id: i.id, fromUid: i.from_user_id, fromEmail: i.profiles?.email ?? '', fromName: i.profiles?.display_name ?? i.profiles?.email ?? 'Workspace owner',
      toEmail: i.to_email, proposedRole: i.proposed_role, proposedAccessLevel: i.proposed_access_level ?? 'full', proposedFeatures: i.proposed_features ?? [], status: i.status, createdAt: i.created_at, inviteCode: i.workspaces?.invite_code,
    })));

    return nextActive;
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
          isSuperAdmin: profile.is_super_admin ?? false,
          whatsappPhone: profile.whatsapp_phone ?? undefined,
          licensePlanId: profile.license_plan_id ?? undefined,
          appNotificationsEnabled: profile.app_notifications_enabled, mobileNotificationsEnabled: profile.mobile_notifications_enabled,
        });
        setAppNotificationsEnabled(profile.app_notifications_enabled ?? true);
        setMobileNotificationsEnabled(profile.mobile_notifications_enabled ?? true);
        if (profile.default_currency) {
          setSummaryCurrency(profile.default_currency);
          localStorage.setItem('pm_summary_currency', profile.default_currency);
        }
        // Plan name/features are a nice-to-have display detail - fetched separately so any
        // issue here can never block core profile fields like isSuperAdmin from loading.
        if (profile.license_plan_id) {
          (async () => {
            try {
              const { data: plan } = await supabase.from('access_plans').select('name, features, can_create_business').eq('id', profile.license_plan_id).maybeSingle();
              if (plan) setUserProfile(prev => prev ? { ...prev, licensePlanName: plan.name, licensePlanFeatures: plan.features ?? [], canCreateBusiness: plan.can_create_business ?? false } : prev);
            } catch (err) {
              console.warn('Failed to load license plan details:', err);
            }
          })();
        }
      }
      await refreshWorkspaces(user.id, profile?.active_workspace_id ?? null);
      setIsLoaded(true);
    })();
  }, [user, refreshWorkspaces]);

  const reloadData = useCallback(async () => {
    if (!user) return;
    const wsFilter = activeWorkspaceId ? `workspace_id.eq.${activeWorkspaceId}` : `user_id.eq.${user.id},workspace_id.is.null`;
    const [{ data: pays }, { data: hist }, { data: cts }, { data: notifs }, { data: rewards }] = await Promise.all([
      supabase.from('recurring_payments').select('*').or(wsFilter).order('sort_order', { ascending: true, nullsFirst: false }),
      supabase.from('payment_history').select('*').or(wsFilter).order('paid_date', { ascending: false }),
      supabase.from('countries').select('*').or(wsFilter),
      supabase.from('app_notifications').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(50),
      supabase.from('reward_perks').select('*').or(wsFilter).order('application_date', { ascending: false }),
    ]);
    setAllPayments((pays ?? []).map(rowToPayment));
    setAllHistory((hist ?? []).map(rowToHistory));
    if (cts && cts.length > 0) {
      setCountries(cts.map(rowToCountry));
    } else if (cts && cts.length === 0) {
      // First time for this user/workspace: seed the defaults as real rows so they're manageable (incl. deletable) like any other currency.
      const seedRows = INITIAL_COUNTRIES.map(c => ({
        name: c.name, currency: c.currency, symbol: c.symbol, flag: c.flag, rate_to_aud: c.rateToAUD, user_id: user.id, workspace_id: activeWorkspaceId,
      }));
      const { data: seeded } = await supabase.from('countries').insert(seedRows).select();
      if (seeded && seeded.length > 0) setCountries(seeded.map(rowToCountry));
    }
    setNotifications((notifs ?? []).map(rowToNotification));
    setRewardsPerks((rewards ?? []).map(rowToReward));
  }, [user, activeWorkspaceId]);

  useEffect(() => { if (isLoaded) reloadData(); }, [isLoaded, activeWorkspaceId, reloadData]);

  const loadFamilyMessages = useCallback(async () => {
    if (!activeWorkspaceId) { setFamilyMessages([]); return; }
    const { data } = await supabase
      .from('workspace_messages')
      .select('id, content, created_at, sender_id, profiles(display_name, email)')
      .eq('workspace_id', activeWorkspaceId)
      .order('created_at', { ascending: true })
      .limit(200);
    setFamilyMessages((data ?? []).map((m: any) => ({
      id: m.id,
      content: m.content,
      createdAt: m.created_at,
      senderId: m.sender_id,
      senderName: m.profiles?.display_name || m.profiles?.email?.split('@')[0] || 'Member',
    })));
  }, [activeWorkspaceId]);

  useEffect(() => { loadFamilyMessages(); }, [loadFamilyMessages]);

  const sendFamilyMessage = async (content: string) => {
    if (!user) throw new Error('Not signed in.');
    if (!activeWorkspaceId) throw new Error('Create or join a workspace first to use chat.');
    const trimmed = content.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('workspace_messages').insert({ workspace_id: activeWorkspaceId, sender_id: user.id, content: trimmed });
    if (error) throw error;
    await loadFamilyMessages();
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('haven-ledger-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_payments' }, () => reloadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_history' }, () => reloadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_perks' }, () => reloadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members' }, () => user && refreshWorkspaces(user.id, activeWorkspaceId))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workspace_messages' }, () => loadFamilyMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, reloadData, refreshWorkspaces, loadFamilyMessages, activeWorkspaceId]);

  // ---------- Workspace management ----------

  // Which page shows first when this workspace becomes active - a personal preference per
  // workspace membership, not a workspace-wide setting.
  const updateWorkspaceLandingTab = async (tab: string | null) => {
    if (!user || !activeWorkspaceId) return;
    const { error } = await supabase.rpc('update_my_landing_tab', { p_workspace_id: activeWorkspaceId, p_tab: tab });
    if (error) throw error;
    await refreshWorkspaces(user.id, activeWorkspaceId);
  };

  // Which Holdings table columns are visible and in what order - personal per (workspace,
  // member), same scoping as landing_tab. Will migrate to a per-portfolio scope alongside
  // landing_tab whenever multi-portfolio support is actually built.
  const updateWorkspaceColumnPrefs = async (prefs: { key: string; visible: boolean }[] | null) => {
    if (!user || !activeWorkspaceId) return;
    const { error } = await supabase.rpc('update_my_column_prefs', { p_workspace_id: activeWorkspaceId, p_prefs: prefs });
    if (error) throw error;
    await refreshWorkspaces(user.id, activeWorkspaceId);
  };

  const switchWorkspace = async (workspaceId: string) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      setActiveWorkspaceId(workspaceId);
      await supabase.from('profiles').update({ active_workspace_id: workspaceId }).eq('id', user.id);
      await refreshWorkspaces(user.id, workspaceId);
    } finally {
      setIsSyncing(false);
    }
  };

  const createWorkspace = async (name: string, type: 'family' | 'business' = 'family') => {
    if (!user) throw new Error('Not signed in.');
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.rpc('create_my_workspace', { ws_name: name, ws_type: type });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      await refreshWorkspaces(user.id, row.id);
      return { id: row.id, invite_code: row.invite_code };
    } finally {
      setIsSyncing(false);
    }
  };

  // Onboarding entry point: create the user's first workspace of the chosen type
  const setWorkspaceMode = async (mode: 'family' | 'business') => {
    if (!user) throw new Error('Not signed in.');
    const namePrefix = userProfile?.displayName?.trim() || 'My';
    await createWorkspace(mode === 'business' ? `${namePrefix} Business` : `${namePrefix} Family`, mode);
  };

  const addFamilyMember = async (email: string, role: 'view' | 'modify' = 'modify', accessLevel: 'full' | 'limited' = 'full', features: string[] = ['income', 'rewards', 'ai', 'team', 'chat', 'agent', 'portfolio']) => {
    if (!user) throw new Error('Not signed in.');
    if (!activeWorkspace) throw new Error('Create a workspace first.');
    if (activeWorkspace.role !== 'host') throw new Error('Only the workspace owner can invite members.');
    setIsSyncing(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      // Can't grant an invitee more than you have yourself.
      const myFeatures = userProfile?.licensePlanFeatures ?? [];
      const clampedFeatures = features.filter(f => myFeatures.includes(f));
      const clampedAccessLevel = clampedFeatures.length >= myFeatures.length && myFeatures.length > 0 ? accessLevel : (clampedFeatures.length === 0 ? 'limited' : accessLevel);
      const { error } = await supabase.from('workspace_invitations').insert({ workspace_id: activeWorkspace.id, from_user_id: user.id, to_email: cleanEmail, proposed_role: role, proposed_access_level: clampedAccessLevel, proposed_features: clampedFeatures });
      if (error) throw error;

      const { data: emailResult, error: emailError } = await supabase.functions.invoke('invite-workspace-member', {
        body: { email: cleanEmail, workspaceId: activeWorkspace.id, redirectTo: `${window.location.origin}/` },
      });

      if (emailError || emailResult?.error) {
        // The invitation record still exists, so they're not locked out — just flag that the email itself didn't go out.
        triggerNotification('Invitation Saved, Email Failed ⚠️', `"${cleanEmail}" was added to pending invites, but the notification email couldn't be sent. Share your code manually: ${activeWorkspace.inviteCode}`, 'warning');
      } else if (emailResult?.alreadyHadAccount) {
        triggerNotification('Invitation Sent 👥', `"${cleanEmail}" already has an account — they'll see this invitation next time they log in.`, 'info');
      } else {
        triggerNotification('Invitation Emailed 📧', `"${cleanEmail}" was emailed a link to create their account and join.`, 'info');
      }
    } finally { setIsSyncing(false); }
  };

  const joinFamilyGroup = async (code: string) => {
    if (!user) throw new Error('Not signed in.');
    setIsSyncing(true);
    try {
      const clean = code.trim().toUpperCase();
      const { data: newWsId, error } = await supabase.rpc('join_workspace_by_code', { code: clean, requested_role: 'modify' });
      if (error) throw new Error(error.message || 'Invalid invite code.');
      await refreshWorkspaces(user.id, newWsId);
      triggerNotification('Joined Workspace 👥', 'You are now part of the workspace.', 'info');
    } finally { setIsSyncing(false); }
  };

  const approveInvitation = async (invitationId: string, role: 'view' | 'modify') => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const invite = incomingInvitations.find(i => i.id === invitationId);
      if (!invite) throw new Error('Invitation not found.');
      const rpcParams = { code: invite.inviteCode, requested_role: role, requested_access_level: invite.proposedAccessLevel || 'full', requested_features: invite.proposedFeatures || ['income', 'rewards', 'ai', 'team', 'chat', 'agent', 'portfolio'] };
      const { data: joinedWorkspaceId, error: rpcErr } = await supabase.rpc('join_workspace_by_code', rpcParams);
      if (rpcErr) throw rpcErr;
      if (!joinedWorkspaceId) throw new Error('Could not join the workspace - the invite code may be invalid.');
      // Defensive check: confirm membership genuinely exists before marking this approved,
      // since a silent RPC failure here previously left an invite marked 'approved' with
      // no actual membership row created.
      const { data: membershipCheck } = await supabase.from('workspace_members').select('workspace_id').eq('workspace_id', joinedWorkspaceId).eq('user_id', user.id).maybeSingle();
      if (!membershipCheck) throw new Error('Something went wrong joining the workspace. Please try again.');
      await supabase.from('workspace_invitations').update({ status: 'approved' }).eq('id', invitationId);
      await refreshWorkspaces(user.id, activeWorkspaceId);
      triggerNotification('Invitation Accepted 👥', `You joined ${invite.fromName}'s workspace.`, 'info');
    } finally { setIsSyncing(false); }
  };

  const declineInvitation = async (invitationId: string) => {
    await supabase.from('workspace_invitations').update({ status: 'declined' }).eq('id', invitationId);
    setIncomingInvitations(prev => prev.filter(i => i.id !== invitationId));
  };

  // Invites the current user (as host) has SENT for the active workspace, still pending -
  // lets them see what's outstanding and cancel one if it's no longer needed.
  const [outgoingInvitations, setOutgoingInvitations] = useState<{ id: string; toEmail: string; proposedRole: string; createdAt: string }[]>([]);

  const loadOutgoingInvitations = useCallback(async () => {
    if (!user || !activeWorkspaceId) { setOutgoingInvitations([]); return; }
    const { data } = await supabase
      .from('workspace_invitations')
      .select('id, to_email, proposed_role, created_at')
      .eq('workspace_id', activeWorkspaceId)
      .eq('from_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setOutgoingInvitations((data ?? []).map((i: any) => ({ id: i.id, toEmail: i.to_email, proposedRole: i.proposed_role, createdAt: i.created_at })));
  }, [user, activeWorkspaceId]);

  useEffect(() => { if (isLoaded) loadOutgoingInvitations(); }, [isLoaded, loadOutgoingInvitations]);

  const cancelInvitation = async (invitationId: string) => {
    const { error } = await supabase.from('workspace_invitations').delete().eq('id', invitationId);
    if (error) throw error;
    await loadOutgoingInvitations();
    triggerNotification('Invitation Cancelled', 'They can no longer accept that invite.', 'info');
  };

  const updateMemberRole = async (memberUid: string, role: 'view' | 'modify') => {
    if (!activeWorkspace || activeWorkspace.role !== 'host') throw new Error('Only the owner can change member roles.');
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('workspace_members').update({ role }).eq('workspace_id', activeWorkspace.id).eq('user_id', memberUid);
      if (error) throw error;
      await refreshWorkspaces(user!.id, activeWorkspaceId);
    } finally { setIsSyncing(false); }
  };

  const removeFamilyMember = async (memberUid: string) => {
    if (!activeWorkspace || activeWorkspace.role !== 'host') throw new Error('Only the owner can remove members.');
    setIsSyncing(true);
    try {
      await supabase.from('workspace_members').delete().eq('workspace_id', activeWorkspace.id).eq('user_id', memberUid);
      await refreshWorkspaces(user!.id, activeWorkspaceId);
      triggerNotification('Member Removed 👥', 'They no longer have access to this workspace.', 'info');
    } finally { setIsSyncing(false); }
  };

  const leaveFamilyGroup = async () => {
    if (!user || !activeWorkspace) return;
    setIsSyncing(true);
    try {
      if (activeWorkspace.role === 'host') throw new Error('As the owner, remove members first or transfer the workspace before leaving.');
      await supabase.from('workspace_members').delete().eq('workspace_id', activeWorkspace.id).eq('user_id', user.id);
      await refreshWorkspaces(user.id, null);
      triggerNotification('Left Workspace 👋', 'You are back to your other workspace(s).', 'info');
    } finally { setIsSyncing(false); }
  };

  const regenerateInviteCode = async () => {
    if (!activeWorkspace || activeWorkspace.role !== 'host') throw new Error('Only the owner can regenerate the invite code.');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('workspaces').update({ invite_code: code }).eq('id', activeWorkspace.id);
    if (error) throw error;
    await refreshWorkspaces(user!.id, activeWorkspaceId);
  };

  const renameWorkspace = async (workspaceId: string, name: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws || ws.role !== 'host') throw new Error('Only the owner can rename this workspace.');
    if (!name.trim()) throw new Error('Name cannot be empty.');
    const { error } = await supabase.from('workspaces').update({ name: name.trim() }).eq('id', workspaceId);
    if (error) throw error;
    await refreshWorkspaces(user!.id, activeWorkspaceId);
  };

  const deleteWorkspace = async (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws || ws.role !== 'host') throw new Error('Only the owner can delete this workspace.');
    if (workspaces.length <= 1) throw new Error('You need at least one workspace — create another before deleting this one.');
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
      if (error) throw error;
      const fallback = workspaces.find(w => w.id !== workspaceId);
      await refreshWorkspaces(user!.id, fallback?.id ?? null);
      triggerNotification('Workspace Deleted 🗑️', `"${ws.name}" and all of its data have been removed.`, 'info');
    } finally {
      setIsSyncing(false);
    }
  };

  // ---------- Income ----------
  // Single source of truth: income_sources. "Simple" mode is just a simplified view/edit
  // of that same list (a single flagged entry), never a separate stored number — so the
  // two views can never disagree.
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [incomeMode, setIncomeModeState] = useState<'simple' | 'detailed'>('simple');

  const monthlyIncome = useMemo(() => {
    if (incomeSources.length === 1 && (incomeSources[0] as any).isSimpleTotal) {
      return String(incomeSources[0].amount);
    }
    const total = incomeSources.reduce((sum, s) => {
      if (s.frequency === 'weekly') return sum + s.amount * 4.33;
      if (s.frequency === 'fortnightly') return sum + s.amount * 2.17;
      if (s.frequency === 'monthly') return sum + s.amount;
      return sum;
    }, 0);
    return total ? String(Math.round(total)) : '';
  }, [incomeSources]);

  const loadIncome = useCallback(async () => {
    if (!user) return;
    const wsFilter = activeWorkspaceId ? `workspace_id.eq.${activeWorkspaceId}` : `user_id.eq.${user.id},workspace_id.is.null`;
    const { data } = await supabase.from('income_sources').select('*').or(wsFilter).order('created_at', { ascending: false });
    setIncomeSources((data ?? []).map((r: any) => ({
      id: r.id, name: r.name, amount: Number(r.amount), frequency: r.frequency, category: r.category, isRecurring: r.is_recurring, isSimpleTotal: r.is_simple_total, payDate: r.pay_date ?? undefined,
    })));
    if (activeWorkspace) {
      setIncomeModeState(activeWorkspace.incomeMode || 'simple');
    }
  }, [user, activeWorkspaceId, activeWorkspace]);

  useEffect(() => { loadIncome(); }, [loadIncome]);

  const addIncomeSource = async (src: Omit<IncomeSource, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('income_sources').insert({
      name: src.name, amount: src.amount, frequency: src.frequency, category: src.category, is_recurring: src.isRecurring, pay_date: src.payDate ?? null,
      user_id: user.id, workspace_id: activeWorkspaceId,
    });
    if (error) throw error;
    await loadIncome();
  };

  const deleteIncomeSource = async (id: string) => {
    const { error } = await supabase.from('income_sources').delete().eq('id', id);
    if (error) throw error;
    await loadIncome();
  };

  const updateIncomeMode = async (mode: 'simple' | 'detailed') => {
    setIncomeModeState(mode);
    if (activeWorkspaceId) await supabase.from('workspaces').update({ income_mode: mode }).eq('id', activeWorkspaceId);
  };

  // Editing the "Simple" number just upserts the single flagged income source —
  // switching to Detailed will show this exact same entry, editable/splittable there.
  const updateMonthlyIncome = async (val: string) => {
    if (!user) return;
    const amt = parseFloat(val) || 0;
    const existingSimple = incomeSources.find(s => (s as any).isSimpleTotal);

    if (incomeSources.length > 1 || (incomeSources.length === 1 && !existingSimple)) {
      // There's already a real breakdown — don't clobber it with a single number.
      throw new Error('You have multiple income sources — edit them in Detailed mode instead.');
    }

    if (existingSimple) {
      const { error } = await supabase.from('income_sources').update({ amount: amt }).eq('id', existingSimple.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('income_sources').insert({
        name: 'Total Income', amount: amt, frequency: 'monthly', category: 'other', is_recurring: true, is_simple_total: true,
        user_id: user.id, workspace_id: activeWorkspaceId,
      });
      if (error) throw error;
    }
    await loadIncome();
  };

  // ---------- Backups (on-demand snapshot + auto once-per-day-on-load) ----------
  const [workspaceBackups, setWorkspaceBackups] = useState<any[]>([]);

  const loadBackups = useCallback(async () => {
    if (!user) return;
    const wsFilter = activeWorkspaceId ? `workspace_id.eq.${activeWorkspaceId}` : `user_id.eq.${user.id},workspace_id.is.null`;
    const { data } = await supabase.from('workspace_backups').select('id, created_at, snapshot').or(wsFilter).order('created_at', { ascending: false }).limit(14);
    setWorkspaceBackups(data ?? []);
  }, [user, activeWorkspaceId]);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const createBackupNow = useCallback(async () => {
    if (!user) return;
    const snapshot = { payments: allPayments, history: allHistory, income: incomeSources, countries };
    const { error } = await supabase.from('workspace_backups').insert({ workspace_id: activeWorkspaceId, user_id: user.id, snapshot });
    if (error) throw error;
    await loadBackups();
  }, [user, activeWorkspaceId, allPayments, allHistory, incomeSources, countries, loadBackups]);

  // Auto-snapshot once per calendar day when the app loads, best-effort
  useEffect(() => {
    if (!isLoaded || !user || !activeWorkspaceId) return;
    const key = `haven_last_backup_${activeWorkspaceId}`;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(key) !== today) {
      createBackupNow().then(() => localStorage.setItem(key, today)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user, activeWorkspaceId]);

  const restoreFromBackup = async (backupId: string) => {
    const backup = workspaceBackups.find(b => b.id === backupId);
    if (!backup) throw new Error('Backup not found.');
    setIsSyncing(true);
    try {
      const snap = backup.snapshot;
      if (snap.payments?.length) {
        await addBulkPayments(snap.payments.map((p: RecurringPayment) => {
          const { id, ...rest } = p;
          return rest;
        }));
      }
      triggerNotification('Backup Restored ♻️', `Restored ${snap.payments?.length || 0} payments from ${new Date(backup.created_at).toLocaleDateString()}.`, 'info');
    } finally {
      setIsSyncing(false);
    }
  };

  // ---------- Payments ----------
  const addPayment = async (payment: Omit<RecurringPayment, 'id'>) => {
    if (!user) return;
    if (checkReadOnly()) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.from('recurring_payments').insert(paymentToRow(payment, user.id, activeWorkspaceId)).select().single();
      if (error) throw error;
      await reloadData();
      triggerNotification('Payment Added 💳', `"${payment.name}" configured for the ${payment.dayOfMonth}th of every month.`, 'info');
      return rowToPayment(data);
    } finally { setIsSyncing(false); }
  };

  const addBulkPayments = async (newPayments: Omit<RecurringPayment, 'id'>[]) => {
    if (!user) return;
    if (checkReadOnly()) return;
    setIsSyncing(true);
    try {
      const rows = newPayments.map(p => paymentToRow(p, user.id, activeWorkspaceId));
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
      const row = paymentToRow(updatedPayment, existing?.userId || user.id, existing?.familyGroupId ?? activeWorkspaceId);
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
        paid_date: paidDate, tagged_for: taggedFor ?? payment.taggedFor ?? null, status, user_id: payment.userId || user.id, workspace_id: payment.familyGroupId ?? null,
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

  // ---------- Countries ----------
  const addCountry = async (country: Omit<CountryConfig, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('countries').insert({ name: country.name, currency: country.currency, symbol: country.symbol, flag: country.flag, rate_to_aud: country.rateToAUD, user_id: user.id, workspace_id: activeWorkspaceId });
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

  // ---------- Rewards & Perks (personal/family only — gated in UI for business workspaces) ----------
  const addReward = async (perk: Omit<RewardPerk, 'id' | 'userId' | 'familyGroupId' | 'workspaceMode'>) => {
    if (!user) return;
    const { error } = await supabase.from('reward_perks').insert({
      provider_name: perk.providerName, category: perk.category, application_date: perk.applicationDate,
      closing_date: perk.closingDate ?? null, exclusion_period_months: perk.exclusionPeriodMonths, bonus_value: perk.bonusValue ?? null,
      notes: perk.notes ?? null, applicant_name: perk.applicantName ?? null, annual_fee: perk.annualFee ?? 0,
      points_earned: perk.pointsEarned ?? null, points_program: perk.pointsProgram ?? null, cash_value: perk.cashValue ?? 0,
      user_id: user.id, workspace_id: activeWorkspaceId,
    });
    if (error) throw error;
    await reloadData();
  };

  const updateReward = async (id: string, updates: Partial<Omit<RewardPerk, 'id' | 'userId'>>) => {
    const row: any = {};
    if (updates.providerName !== undefined) row.provider_name = updates.providerName;
    if (updates.category !== undefined) row.category = updates.category;
    if (updates.applicationDate !== undefined) row.application_date = updates.applicationDate;
    if (updates.closingDate !== undefined) row.closing_date = updates.closingDate;
    if (updates.exclusionPeriodMonths !== undefined) row.exclusion_period_months = updates.exclusionPeriodMonths;
    if (updates.bonusValue !== undefined) row.bonus_value = updates.bonusValue;
    if (updates.notes !== undefined) row.notes = updates.notes;
    if (updates.applicantName !== undefined) row.applicant_name = updates.applicantName;
    if (updates.annualFee !== undefined) row.annual_fee = updates.annualFee;
    if (updates.pointsEarned !== undefined) row.points_earned = updates.pointsEarned;
    if (updates.pointsProgram !== undefined) row.points_program = updates.pointsProgram;
    if (updates.cashValue !== undefined) row.cash_value = updates.cashValue;
    const { error } = await supabase.from('reward_perks').update(row).eq('id', id);
    if (error) throw error;
    await reloadData();
  };

  const deleteReward = async (id: string) => {
    const { error } = await supabase.from('reward_perks').delete().eq('id', id);
    if (error) throw error;
    await reloadData();
  };

  // ---------- Notifications ----------
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

  // ---------- Access Plans (reusable named feature bundles) ----------
  const [accessPlans, setAccessPlans] = useState<{ id: string; name: string; description?: string; features: string[]; isSystem: boolean; canCreateBusiness?: boolean }[]>([]);

  const loadAccessPlans = useCallback(async () => {
    const { data } = await supabase.from('access_plans').select('*').order('created_at', { ascending: true });
    setAccessPlans((data ?? []).map((p: any) => ({ id: p.id, name: p.name, description: p.description, features: p.features ?? [], isSystem: p.is_system, canCreateBusiness: p.can_create_business ?? false })));
  }, []);

  useEffect(() => { if (isLoaded) loadAccessPlans(); }, [isLoaded, loadAccessPlans]);

  const createAccessPlan = async (name: string, features: string[], description?: string, canCreateBusiness?: boolean) => {
    if (!user) throw new Error('Not signed in.');
    const { error } = await supabase.from('access_plans').insert({ name, description: description ?? null, features, can_create_business: canCreateBusiness ?? false, created_by: user.id });
    if (error) throw error;
    await loadAccessPlans();
  };

  const updateAccessPlan = async (id: string, updates: { name?: string; description?: string; features?: string[]; canCreateBusiness?: boolean }) => {
    const row: any = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.features !== undefined) row.features = updates.features;
    if (updates.canCreateBusiness !== undefined) row.can_create_business = updates.canCreateBusiness;
    const { error } = await supabase.from('access_plans').update(row).eq('id', id);
    if (error) throw error;
    await loadAccessPlans();
  };

  const deleteAccessPlan = async (id: string) => {
    const { error } = await supabase.from('access_plans').delete().eq('id', id);
    if (error) throw error;
    await loadAccessPlans();
  };

  // ---------- Self-service upgrade requests ----------
  const [myUpgradeRequest, setMyUpgradeRequest] = useState<{ id: string; planName: string; status: string } | null>(null);

  const loadMyUpgradeRequest = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('upgrade_requests')
      .select('id, status, access_plans(name)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setMyUpgradeRequest(data ? { id: data.id, planName: (data as any).access_plans?.name ?? 'a new plan', status: data.status } : null);
  }, [user]);

  useEffect(() => { loadMyUpgradeRequest(); }, [loadMyUpgradeRequest]);

  const requestUpgrade = async (planId: string) => {
    if (!user) throw new Error('Not signed in.');
    const { error } = await supabase.from('upgrade_requests').insert({ user_id: user.id, requested_plan_id: planId });
    if (error) throw error;
    await loadMyUpgradeRequest();
    triggerNotification('Upgrade Requested 🚀', "We'll let you know once it's reviewed.", 'info');
  };

  // ---------- Super-admin: license management ----------
  const fetchPendingUpgradeRequests = async () => {
    const { data, error } = await supabase
      .from('upgrade_requests')
      .select('id, user_id, status, created_at, access_plans(id, name), profiles!upgrade_requests_user_id_fkey(email, display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id, userId: r.user_id, userEmail: r.profiles?.email, userName: r.profiles?.display_name,
      requestedPlanId: r.access_plans?.id, requestedPlanName: r.access_plans?.name, createdAt: r.created_at,
    }));
  };

  // Cascades a plan change to a user's global license AND every workspace they're currently in.
  const adminSetUserPlan = async (userId: string, planId: string) => {
    const plan = accessPlans.find(p => p.id === planId);
    if (!plan) throw new Error('Plan not found.');

    const { error: profileErr } = await supabase.from('profiles').update({ license_plan_id: planId }).eq('id', userId);
    if (profileErr) throw profileErr;

    const { error: membersErr } = await supabase.from('workspace_members').update({ enabled_features: plan.features }).eq('user_id', userId);
    if (membersErr) throw membersErr;

    if (userId === user?.id) await refreshWorkspaces(user!.id, activeWorkspaceId);
  };

  const setSuperAdminStatus = async (userId: string, isAdmin: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_super_admin: isAdmin }).eq('id', userId);
    if (error) throw error;
  };

  // ---------- Portfolio module (workspace-scoped, same pattern as Bills) ----------
  const [portfolioHoldings, setPortfolioHoldings] = useState<any[]>([]);
  const [portfolioPriceHistory, setPortfolioPriceHistory] = useState<any[]>([]);
  const [portfolioSplits, setPortfolioSplits] = useState<any[]>([]);
  const [portfolioContributions, setPortfolioContributions] = useState<any[]>([]);
  const [portfolioWithdrawals, setPortfolioWithdrawals] = useState<any[]>([]);
  const [portfolioCashBalances, setPortfolioCashBalances] = useState<any[]>([]);
  const [portfolioDividends, setPortfolioDividends] = useState<any[]>([]);
  const [portfolioFees, setPortfolioFees] = useState<any[]>([]);
  const [portfolioRecurringPlans, setPortfolioRecurringPlans] = useState<any[]>([]);
  const [portfolioDataLoading, setPortfolioDataLoading] = useState(true);

  const loadPortfolioDetails = useCallback(async () => {
    if (!activeWorkspaceId) {
      setPortfolioHoldings([]); setPortfolioPriceHistory([]); setPortfolioSplits([]); setPortfolioContributions([]); setPortfolioWithdrawals([]);
      setPortfolioDividends([]); setPortfolioFees([]); setPortfolioRecurringPlans([]); setPortfolioCashBalances([]);
      setPortfolioDataLoading(false);
      return;
    }
    setPortfolioDataLoading(true);
    const [{ data: holdings }, { data: priceHistory }, { data: splits }, { data: contributions }, { data: withdrawals }, { data: dividends }, { data: fees }, { data: plans }, { data: cashBalances }] = await Promise.all([
      supabase.from('portfolio_holdings').select('*').eq('workspace_id', activeWorkspaceId).order('buy_date', { ascending: false }),
      supabase.from('portfolio_price_history').select('*').eq('workspace_id', activeWorkspaceId).order('recorded_date', { ascending: false }),
      supabase.from('portfolio_splits').select('*').eq('workspace_id', activeWorkspaceId).order('effective_from'),
      supabase.from('portfolio_contributions').select('*').eq('workspace_id', activeWorkspaceId).order('contribution_date', { ascending: false }),
      supabase.from('portfolio_withdrawals').select('*').eq('workspace_id', activeWorkspaceId).order('withdrawal_date', { ascending: false }),
      supabase.from('portfolio_dividends').select('*').eq('workspace_id', activeWorkspaceId).order('dividend_date', { ascending: false }),
      supabase.from('portfolio_fees').select('*').eq('workspace_id', activeWorkspaceId).order('fee_date', { ascending: false }),
      supabase.from('portfolio_recurring_plans').select('*').eq('workspace_id', activeWorkspaceId).order('created_at'),
      supabase.from('portfolio_cash_balances').select('*').eq('workspace_id', activeWorkspaceId).order('location'),
    ]);
    setPortfolioHoldings(holdings ?? []);
    setPortfolioPriceHistory(priceHistory ?? []);
    setPortfolioSplits(splits ?? []);
    setPortfolioContributions(contributions ?? []);
    setPortfolioWithdrawals(withdrawals ?? []);
    setPortfolioDividends(dividends ?? []);
    setPortfolioFees(fees ?? []);
    setPortfolioRecurringPlans(plans ?? []);
    setPortfolioCashBalances(cashBalances ?? []);
    setPortfolioDataLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => { if (isLoaded) loadPortfolioDetails(); }, [isLoaded, loadPortfolioDetails]);

  const addPortfolioHolding = async (holding: {
    holdingType?: 'stock' | 'mutual_fund'; broker: string; symbol: string; isin?: string; exchange: string; quantity: number; buyPrice: number; buyDate: string; currentPrice?: number; notes?: string;
    source?: string; currency?: 'INR' | 'USD' | 'AUD';
    targetType?: 'price' | 'percent'; targetPrice?: number; targetPercent?: number;
    holdType?: 'days' | 'date'; holdDays?: number; holdUntilDate?: string;
  }) => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    const { data: inserted, error } = await supabase.from('portfolio_holdings').insert({
      workspace_id: activeWorkspaceId, created_by: user?.id ?? null,
      holding_type: holding.holdingType ?? 'stock', broker: holding.broker, symbol: holding.symbol.toUpperCase(), isin: holding.isin ?? null, exchange: holding.exchange,
      ticker: holding.broker === 'Zerodha' ? holding.symbol.toUpperCase() : null,
      quantity: holding.quantity, buy_price: holding.buyPrice, buy_date: holding.buyDate, currency: holding.currency ?? 'INR',
      current_price: holding.currentPrice ?? null, current_price_updated_at: holding.currentPrice != null ? new Date().toISOString() : null,
      reference_price: holding.currentPrice ?? holding.buyPrice, reference_date: new Date().toISOString().slice(0, 10),
      notes: holding.notes ?? null,
      source: holding.source ?? null, change_flag: 'added',
      target_type: holding.targetType ?? null, target_price: holding.targetPrice ?? null, target_percent: holding.targetPercent ?? null,
      hold_type: holding.holdType ?? null, hold_days: holding.holdDays ?? null, hold_until_date: holding.holdUntilDate ?? null,
    }).select('id').single();
    if (error) throw error;
    if (holding.currentPrice != null && inserted) {
      await supabase.from('portfolio_price_history').insert({ workspace_id: activeWorkspaceId, holding_id: inserted.id, price: holding.currentPrice });
    }
    await loadPortfolioDetails();
  };

  // Bulk import from a broker file - inserts many holdings in one request, then refreshes once.
  const bulkAddPortfolioHoldings = async (holdings: {
    holdingType: 'stock' | 'mutual_fund'; broker: string; symbol: string; isin?: string; folioNumber?: string; exchange: string; quantity: number; buyPrice: number; buyDate: string; currentPrice?: number; source?: string;
  }[]) => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    if (holdings.length === 0) return;
    const rows = holdings.map(h => ({
      workspace_id: activeWorkspaceId, created_by: user?.id ?? null,
      holding_type: h.holdingType, broker: h.broker, symbol: h.symbol.toUpperCase(), isin: h.isin ?? null, folio_number: h.folioNumber ?? null, exchange: h.exchange,
      ticker: h.broker === 'Zerodha' ? h.symbol.toUpperCase() : null,
      quantity: h.quantity, buy_price: h.buyPrice, buy_date: h.buyDate,
      current_price: h.currentPrice ?? null, current_price_updated_at: h.currentPrice != null ? new Date().toISOString() : null,
      reference_price: h.currentPrice ?? h.buyPrice, reference_date: new Date().toISOString().slice(0, 10),
      source: h.source ?? null, change_flag: 'added',
    }));
    const { data: inserted, error } = await supabase.from('portfolio_holdings').insert(rows).select('id, current_price');
    if (error) throw error;
    const snapshotRows = (inserted ?? []).filter(r => r.current_price != null).map(r => ({ workspace_id: activeWorkspaceId, holding_id: r.id, price: r.current_price }));
    if (snapshotRows.length > 0) await supabase.from('portfolio_price_history').insert(snapshotRows);
    await loadPortfolioDetails();
  };

  // Reconciles an existing holding's quantity against a fresh import, tagging whether
  // it grew or shrank so it can be filtered like any other tag.
  const reconcilePortfolioHoldingQuantity = async (id: string, newQuantity: number, changeFlag: 'qty_increased' | 'qty_reduced') => {
    const { error } = await supabase.from('portfolio_holdings').update({ quantity: newQuantity, change_flag: changeFlag }).eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  // Processes multiple dated broker exports as a historical timeline in one pass: for each
  // stock, the earliest known date becomes its buy_date/buy_price if it's genuinely new, every
  // date in between becomes a price_history point (building a real trend line), and the latest
  // date becomes the current state (price, quantity, reference) - all via the same "latest date
  // wins" reference logic as a normal update.
  const bulkHistoricalImport = async (
    snapshots: { date: string; holdings: { broker: string; holdingType: 'stock' | 'mutual_fund'; symbol: string; isin?: string; folioNumber?: string; exchange: string; quantity: number; buyPrice: number; currentPrice?: number; source?: string }[] }[]
  ) => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    const allDates = sorted.map(s => s.date);
    const batchLatestDate = allDates[allDates.length - 1];

    // Group every (date, row) occurrence by a stable stock key
    const byKey = new Map<string, { date: string; row: any }[]>();
    sorted.forEach(snap => {
      snap.holdings.forEach(row => {
        // Folio number, not fund name, is the real unique identifier for Groww MF - the same
        // scheme name can appear under multiple folios (e.g. one External, one direct).
        const key = `${row.broker}::${row.isin || (row.folioNumber ? `${row.folioNumber}::${row.symbol.toUpperCase()}` : row.symbol.toUpperCase())}::${row.holdingType}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push({ date: snap.date, row });
      });
    });

    // This upload might be an incremental addition to data we already have (e.g. an older
    // file added after a more recent one was already processed) - so "latest known date"
    // must consider what's already in the database too, not just this batch's own dates.
    // Otherwise an older file uploaded on its own would look like "the latest we know",
    // wrongly resurrecting stocks that are already correctly marked sold.
    const brokersInBatch = new Set(sorted.flatMap(s => s.holdings.map(h => h.broker)));
    let existingMaxKnownDate: string | null = null;
    for (const broker of brokersInBatch) {
      const dates = portfolioHoldings
        .filter(h => h.broker === broker)
        .map(h => h.status === 'active' ? h.reference_date : h.sold_date)
        .filter(Boolean);
      const maxForBroker = dates.length > 0 ? dates.sort().reverse()[0] : null;
      if (maxForBroker && (!existingMaxKnownDate || maxForBroker > existingMaxKnownDate)) existingMaxKnownDate = maxForBroker;
    }
    const trueLatestDate = existingMaxKnownDate && existingMaxKnownDate > batchLatestDate ? existingMaxKnownDate : batchLatestDate;

    let newCount = 0;
    let updatedCount = 0;
    let soldCount = 0;
    let skippedStaleCount = 0;
    let priceHistoryCount = 0;

    for (const [, occurrences] of byKey) {
      occurrences.sort((a, b) => a.date.localeCompare(b.date));
      const first = occurrences[0];
      const last = occurrences[occurrences.length - 1];

      // Match against a holding of ANY status - matching only active holdings meant a stock
      // already correctly marked sold would get a brand new duplicate row instead of being
      // recognized, if an older file mentioning it was uploaded afterward.
      let holdingId: string;
      const existing = portfolioHoldings.find(h => {
        if (h.broker !== first.row.broker) return false;
        if (first.row.isin && h.isin) return h.isin === first.row.isin;
        if (first.row.folioNumber && h.folio_number) return h.folio_number === first.row.folioNumber && h.symbol === first.row.symbol.toUpperCase();
        return h.symbol === first.row.symbol.toUpperCase() && h.holding_type === first.row.holdingType && !h.folio_number && !first.row.folioNumber;
      });

      // If we already have more current information about this specific stock than what
      // this batch provides, this upload is stale for it - record the price history for
      // completeness, but don't touch its current status, price, or quantity at all.
      const existingKnownDate = existing ? (existing.status === 'active' ? existing.reference_date : existing.sold_date) : null;
      const thisUploadIsStale = !!(existingKnownDate && existingKnownDate > last.date);

      if (thisUploadIsStale && existing) {
        const historyRows = occurrences.map(o => ({ workspace_id: activeWorkspaceId, holding_id: existing.id, price: o.row.currentPrice ?? o.row.buyPrice, recorded_date: o.date }));
        const { error: histErr } = await supabase.from('portfolio_price_history').insert(historyRows);
        if (histErr) throw histErr;
        priceHistoryCount += historyRows.length;
        skippedStaleCount++;
        continue;
      }

      const wasSoldInBetween = last.date !== trueLatestDate;
      const soldDateIdx = allDates.indexOf(last.date) + 1;
      const inferredSoldDate = wasSoldInBetween ? (allDates[soldDateIdx] || last.date) : null;

      if (existing) {
        holdingId = existing.id;
      } else {
        const { data: inserted, error } = await supabase.from('portfolio_holdings').insert({
          workspace_id: activeWorkspaceId, created_by: user?.id ?? null,
          holding_type: first.row.holdingType, broker: first.row.broker, symbol: first.row.symbol.toUpperCase(),
          isin: first.row.isin ?? null, folio_number: first.row.folioNumber ?? null, exchange: first.row.exchange,
          ticker: first.row.broker === 'Zerodha' ? first.row.symbol.toUpperCase() : null,
          quantity: first.row.quantity, buy_price: first.row.buyPrice, buy_date: first.date,
          current_price: first.row.currentPrice ?? first.row.buyPrice, current_price_updated_at: new Date().toISOString(),
          source: first.row.source ?? null, change_flag: 'added',
          status: wasSoldInBetween ? 'sold' : 'active',
          sold_price: wasSoldInBetween ? (last.row.currentPrice ?? last.row.buyPrice) : null,
          sold_date: inferredSoldDate,
        }).select('id').single();
        if (error) throw error;
        holdingId = inserted.id;
        newCount++;
        if (wasSoldInBetween) soldCount++;
      }

      // Every date in this stock's history becomes a price point - using the actual market/closing
      // price where the export provides one, not the average cost, so trend charts show real
      // price movement rather than a flat line at cost basis.
      const historyRows = occurrences.map(o => ({ workspace_id: activeWorkspaceId, holding_id: holdingId, price: o.row.currentPrice ?? o.row.buyPrice, recorded_date: o.date }));
      const { error: histErr } = await supabase.from('portfolio_price_history').insert(historyRows);
      if (histErr) throw histErr;
      priceHistoryCount += historyRows.length;

      if (existing && wasSoldInBetween) {
        // Was active in our records but is missing from the latest file - mark it sold now
        await supabase.from('portfolio_holdings').update({
          status: 'sold', sold_price: last.row.currentPrice ?? last.row.buyPrice, sold_date: inferredSoldDate,
        }).eq('id', holdingId);
        soldCount++;
        continue;
      }

      if (!wasSoldInBetween) {
        // Latest date wins for current state - same rule as a normal update.
        // buy_price gets refreshed to the latest snapshot's average price (the broker's own
        // recalculated blended cost basis as of that date), while current_price uses the
        // actual market/closing price - these were incorrectly conflated before, making
        // Total Investment inaccurate whenever more of a stock was bought over time.
        const { data: currentRef } = await supabase.from('portfolio_holdings').select('reference_date, quantity').eq('id', holdingId).maybeSingle();
        const marketPrice = last.row.currentPrice ?? last.row.buyPrice;
        const row: any = { current_price: marketPrice, current_price_updated_at: new Date().toISOString(), buy_price: last.row.buyPrice };
        if (last.row.broker === 'Zerodha') row.ticker = last.row.symbol.toUpperCase();
        if (!currentRef?.reference_date || last.date >= currentRef.reference_date) {
          row.reference_price = marketPrice;
          row.reference_date = last.date;
        }
        if (existing && currentRef && Number(currentRef.quantity) !== last.row.quantity) {
          row.quantity = last.row.quantity;
          row.change_flag = last.row.quantity > Number(currentRef.quantity) ? 'qty_increased' : 'qty_reduced';
          updatedCount++;
        }
        const { error: updErr } = await supabase.from('portfolio_holdings').update(row).eq('id', holdingId);
        if (updErr) throw updErr;
      }
    }

    await loadPortfolioDetails();
    return { newCount, updatedCount, soldCount, skippedStaleCount, priceHistoryCount, stockCount: byKey.size };
  };

  const updatePortfolioHolding = async (id: string, updates: {
    currentPrice?: number; priceDate?: string; status?: 'active' | 'sold'; soldPrice?: number; soldDate?: string; quantity?: number; notes?: string;
    holdingType?: 'stock' | 'mutual_fund'; source?: string; ticker?: string | null;
    targetType?: 'price' | 'percent' | null; targetPrice?: number | null; targetPercent?: number | null;
    holdType?: 'days' | 'date' | null; holdDays?: number | null; holdUntilDate?: string | null;
  }) => {
    const row: any = {};
    if (updates.currentPrice !== undefined) { row.current_price = updates.currentPrice; row.current_price_updated_at = new Date().toISOString(); }
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.soldPrice !== undefined) row.sold_price = updates.soldPrice;
    if (updates.soldDate !== undefined) row.sold_date = updates.soldDate;
    if (updates.quantity !== undefined) row.quantity = updates.quantity;
    if (updates.notes !== undefined) row.notes = updates.notes;
    if (updates.holdingType !== undefined) row.holding_type = updates.holdingType;
    if (updates.source !== undefined) row.source = updates.source;
    if (updates.ticker !== undefined) row.ticker = updates.ticker;
    if (updates.targetType !== undefined) row.target_type = updates.targetType;
    if (updates.targetPrice !== undefined) row.target_price = updates.targetPrice;
    if (updates.targetPercent !== undefined) row.target_percent = updates.targetPercent;
    if (updates.holdType !== undefined) row.hold_type = updates.holdType;
    if (updates.holdDays !== undefined) row.hold_days = updates.holdDays;
    if (updates.holdUntilDate !== undefined) row.hold_until_date = updates.holdUntilDate;

    // Reference price always tracks whichever capture is chronologically latest - a
    // backdated update (e.g. re-importing an older file) can never move it backwards.
    // No manual "set as reference" step needed; this just happens automatically.
    if (updates.currentPrice !== undefined) {
      const priceDate = updates.priceDate ?? new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase.from('portfolio_holdings').select('reference_date').eq('id', id).maybeSingle();
      if (!existing?.reference_date || priceDate >= existing.reference_date) {
        row.reference_price = updates.currentPrice;
        row.reference_date = priceDate;
      }
    }

    const { error } = await supabase.from('portfolio_holdings').update(row).eq('id', id);
    if (error) throw error;
    if (updates.currentPrice !== undefined && activeWorkspaceId) {
      await supabase.from('portfolio_price_history').insert({ workspace_id: activeWorkspaceId, holding_id: id, price: updates.currentPrice, recorded_date: updates.priceDate ?? new Date().toISOString().slice(0, 10) });
    }
    await loadPortfolioDetails();
  };

  // Live-refreshed price, kept entirely separate from current_price (the file-sourced LTP) -
  // this was the source of a real corruption bug where the two would overwrite each other.
  const updatePortfolioHoldingLivePrice = async (id: string, price: number) => {
    const { error } = await supabase.from('portfolio_holdings').update({ live_price: price, live_price_updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const deletePortfolioHolding = async (id: string) => {
    const { error } = await supabase.from('portfolio_holdings').delete().eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  // Bulk-tag existing holdings with a group/source name in one call, instead of editing each one.
  const bulkTagPortfolioHoldings = async (holdingIds: string[], source: string) => {
    if (holdingIds.length === 0) return;
    const { error } = await supabase.from('portfolio_holdings').update({ source }).in('id', holdingIds);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const bulkDeletePortfolioHoldings = async (holdingIds: string[]) => {
    if (holdingIds.length === 0) return;
    const { error } = await supabase.from('portfolio_holdings').delete().in('id', holdingIds);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  // Full reset for this workspace's portfolio - holdings (cascades to price history),
  // contributions, withdrawals, splits, dividends, fees, recurring plans, and snapshots.
  // Deliberately destructive and manual - not something that should ever happen by accident.
  const deleteAllPortfolioData = async () => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    await supabase.from('portfolio_holdings').delete().eq('workspace_id', activeWorkspaceId);
    await supabase.from('portfolio_contributions').delete().eq('workspace_id', activeWorkspaceId);
    await supabase.from('portfolio_withdrawals').delete().eq('workspace_id', activeWorkspaceId);
    await supabase.from('portfolio_splits').delete().eq('workspace_id', activeWorkspaceId);
    await supabase.from('portfolio_dividends').delete().eq('workspace_id', activeWorkspaceId);
    await supabase.from('portfolio_fees').delete().eq('workspace_id', activeWorkspaceId);
    await supabase.from('portfolio_recurring_plans').delete().eq('workspace_id', activeWorkspaceId);
    await supabase.from('portfolio_snapshots').delete().eq('workspace_id', activeWorkspaceId);
    await loadPortfolioDetails();
  };

  // ---------- Portfolio snapshots (for Monthly Movement Report) ----------
  const [portfolioSnapshots, setPortfolioSnapshots] = useState<any[]>([]);

  const loadPortfolioSnapshots = useCallback(async () => {
    if (!activeWorkspaceId) { setPortfolioSnapshots([]); return; }
    const { data } = await supabase.from('portfolio_snapshots').select('*').eq('workspace_id', activeWorkspaceId).order('snapshot_date', { ascending: false });
    setPortfolioSnapshots(data ?? []);
  }, [activeWorkspaceId]);

  useEffect(() => { if (isLoaded) loadPortfolioSnapshots(); }, [isLoaded, loadPortfolioSnapshots]);

  // Takes a snapshot of today's portfolio value, grouped by source tag (plus an overall
  // TOTAL row), so it can be compared against a later snapshot in the Monthly Movement Report.
  const takePortfolioSnapshot = async (date: string, groups: { label: string; invested: number; current: number }[]) => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    const rows = groups.map(g => ({
      workspace_id: activeWorkspaceId, snapshot_date: date, label: g.label,
      invested_value: g.invested, current_value: g.current, created_by: user?.id ?? null,
    }));
    const { error } = await supabase.from('portfolio_snapshots').insert(rows);
    if (error) throw error;
    await loadPortfolioSnapshots();
  };

  const deletePortfolioSnapshotBatch = async (date: string) => {
    if (!activeWorkspaceId) return;
    const { error } = await supabase.from('portfolio_snapshots').delete().eq('workspace_id', activeWorkspaceId).eq('snapshot_date', date);
    if (error) throw error;
    await loadPortfolioSnapshots();
  };

  const addPortfolioSplit = async (memberUserId: string, splitPercent: number, effectiveFrom: string, effectiveTo?: string) => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    const { error } = await supabase.from('portfolio_splits').insert({
      workspace_id: activeWorkspaceId, member_user_id: memberUserId, split_percent: splitPercent,
      effective_from: effectiveFrom, effective_to: effectiveTo || null,
    });
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const deletePortfolioSplit = async (id: string) => {
    const { error } = await supabase.from('portfolio_splits').delete().eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const addPortfolioContribution = async (memberUserId: string, amount: number, contributionDate: string, notes?: string, contributionType: 'one_off' | 'recurring' = 'one_off') => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    const { error } = await supabase.from('portfolio_contributions').insert({
      workspace_id: activeWorkspaceId, member_user_id: memberUserId, amount, contribution_date: contributionDate, notes: notes ?? null, contribution_type: contributionType,
    });
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const updatePortfolioContribution = async (id: string, updates: { amount?: number; contributionDate?: string }) => {
    const row: any = {};
    if (updates.amount !== undefined) row.amount = updates.amount;
    if (updates.contributionDate !== undefined) row.contribution_date = updates.contributionDate;
    const { error } = await supabase.from('portfolio_contributions').update(row).eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const deletePortfolioContribution = async (id: string) => {
    const { error } = await supabase.from('portfolio_contributions').delete().eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const addPortfolioWithdrawal = async (memberUserId: string, amount: number, withdrawalDate: string, notes?: string) => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    const { error } = await supabase.from('portfolio_withdrawals').insert({
      workspace_id: activeWorkspaceId, member_user_id: memberUserId, amount, withdrawal_date: withdrawalDate, notes: notes ?? null,
    });
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const deletePortfolioWithdrawal = async (id: string) => {
    const { error } = await supabase.from('portfolio_withdrawals').delete().eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  // One row per location - upserts on (workspace_id, location), so setting it again just
  // updates the current balance rather than creating a growing log.
  const setPortfolioCashBalance = async (location: 'Zerodha' | 'Groww' | 'Bank' | 'Other', amount: number, asOfDate?: string, notes?: string) => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    const { error } = await supabase.from('portfolio_cash_balances').upsert({
      workspace_id: activeWorkspaceId, location, amount, as_of_date: asOfDate ?? new Date().toISOString().slice(0, 10), notes: notes ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,location' });
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const deletePortfolioCashBalance = async (id: string) => {
    const { error } = await supabase.from('portfolio_cash_balances').delete().eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const addPortfolioDividend = async (symbol: string, amount: number, dividendDate: string, holdingId?: string, notes?: string) => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    const { error } = await supabase.from('portfolio_dividends').insert({
      workspace_id: activeWorkspaceId, holding_id: holdingId ?? null, symbol: symbol.toUpperCase(), amount, dividend_date: dividendDate, notes: notes ?? null,
    });
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const deletePortfolioDividend = async (id: string) => {
    const { error } = await supabase.from('portfolio_dividends').delete().eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const addPortfolioFee = async (broker: string, feeType: string, amount: number, feeDate: string, notes?: string) => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    const { error } = await supabase.from('portfolio_fees').insert({
      workspace_id: activeWorkspaceId, broker, fee_type: feeType, amount, fee_date: feeDate, notes: notes ?? null,
    });
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const deletePortfolioFee = async (id: string) => {
    const { error } = await supabase.from('portfolio_fees').delete().eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const addPortfolioRecurringPlan = async (memberUserId: string, expectedAmount: number, frequency: 'monthly' | 'quarterly' | 'yearly', startDate: string, dayOfMonth?: number) => {
    if (!activeWorkspaceId) throw new Error('Select a workspace first.');
    const { error } = await supabase.from('portfolio_recurring_plans').insert({
      workspace_id: activeWorkspaceId, member_user_id: memberUserId, expected_amount: expectedAmount,
      frequency, start_date: startDate, day_of_month: dayOfMonth ?? null,
    });
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const updatePortfolioRecurringPlan = async (id: string, updates: { active?: boolean; expectedAmount?: number }) => {
    const row: any = {};
    if (updates.active !== undefined) row.active = updates.active;
    if (updates.expectedAmount !== undefined) row.expected_amount = updates.expectedAmount;
    const { error } = await supabase.from('portfolio_recurring_plans').update(row).eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const deletePortfolioRecurringPlan = async (id: string) => {
    const { error } = await supabase.from('portfolio_recurring_plans').delete().eq('id', id);
    if (error) throw error;
    await loadPortfolioDetails();
  };

  const resolveUpgradeRequest = async (requestId: string, userId: string, planId: string, approve: boolean) => {
    if (approve) {
      await adminSetUserPlan(userId, planId);
    }
    const { error } = await supabase.from('upgrade_requests').update({ status: approve ? 'approved' : 'denied', resolved_at: new Date().toISOString() }).eq('id', requestId);
    if (error) throw error;
  };

  // Super-admin only: fetch every registered user + a per-user workspace summary.
  // Relies entirely on the DB-side is_super_admin() check via RLS — returns empty for anyone else.
  const fetchAllUsersForAdmin = async () => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, created_at, is_super_admin, license_plan_id, access_plans!profiles_license_plan_id_fkey(id, name)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('user_id, role, workspaces(id, name, type)');

    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      email: p.email,
      displayName: p.display_name,
      createdAt: p.created_at,
      isSuperAdmin: p.is_super_admin,
      licensePlanId: p.access_plans?.id,
      licensePlanName: p.access_plans?.name ?? 'Light',
      workspaces: (memberships ?? [])
        .filter((m: any) => m.user_id === p.id)
        .map((m: any) => ({ id: m.workspaces?.id, name: m.workspaces?.name, type: m.workspaces?.type, role: m.role })),
    }));
  };

  // Super-admin only: create a new user account and email them an invite to set their password.
  const inviteNewUser = async (email: string) => {
    const { data, error } = await supabase.functions.invoke('admin-invite-user', {
      body: { email, redirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  // ---------- WhatsApp linking ----------
  const startWhatsAppVerification = async (phone: string) => {
    if (!user) throw new Error('Not signed in.');
    if (!userProfile?.isSuperAdmin && !(userProfile?.licensePlanFeatures ?? []).includes('whatsapp')) {
      throw new Error('WhatsApp integration is a Pro Max feature. Request an upgrade in Preferences.');
    }
    const cleanPhone = phone.replace(/[^\d]/g, '');
    if (cleanPhone.length < 8) throw new Error('Enter a valid phone number with country code, e.g. 14155552671.');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const { error } = await supabase.from('whatsapp_verifications').insert({ user_id: user.id, phone: cleanPhone, code });
    if (error) throw error;
    return code;
  };

  const disconnectWhatsApp = async () => {
    if (!user) return;
    await supabase.from('profiles').update({ whatsapp_phone: null }).eq('id', user.id);
    setUserProfile(prev => prev ? { ...prev, whatsappPhone: undefined } : prev);
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

  // Smart reward reminders: exclusion period ending (can reapply) / annual fee renewal approaching
  useEffect(() => {
    if (!rewardsPerks.length) return;
    const now = new Date();
    const seenKey = 'rewards_reminders_seen';
    const seen: string[] = JSON.parse(localStorage.getItem(seenKey) || '[]');
    const freshlySeen: string[] = [...seen];

    rewardsPerks.forEach(perk => {
      const appDate = new Date(perk.applicationDate);
      const exclusionEnd = new Date(appDate);
      exclusionEnd.setMonth(exclusionEnd.getMonth() + (perk.exclusionPeriodMonths || 12));
      const daysToExclusionEnd = Math.ceil((exclusionEnd.getTime() - now.getTime()) / 86400000);

      const exclusionKey = `excl_${perk.id}`;
      if (daysToExclusionEnd > 0 && daysToExclusionEnd <= 30 && !seen.includes(exclusionKey)) {
        triggerNotification('Bonus Eligible Soon 🎁', `${perk.providerName}'s exclusion period ends in ${daysToExclusionEnd} days — you can reapply for a new sign-up bonus.`, 'info');
        freshlySeen.push(exclusionKey);
      }

      if (perk.annualFee > 0) {
        const renewalDate = new Date(appDate);
        renewalDate.setFullYear(now.getFullYear() >= appDate.getFullYear() ? now.getFullYear() : appDate.getFullYear());
        if (renewalDate < now) renewalDate.setFullYear(renewalDate.getFullYear() + 1);
        const daysToRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / 86400000);
        const renewalKey = `renew_${perk.id}_${renewalDate.getFullYear()}`;
        if (daysToRenewal > 0 && daysToRenewal <= 21 && !seen.includes(renewalKey)) {
          triggerNotification('Annual Fee Renewing 💳', `${perk.providerName}'s annual fee (${perk.annualFee}) renews in ${daysToRenewal} days — decide whether to keep or cancel.`, 'warning');
          freshlySeen.push(renewalKey);
        }
      }
    });

    if (freshlySeen.length !== seen.length) {
      localStorage.setItem(seenKey, JSON.stringify(freshlySeen));
    }
  }, [rewardsPerks, triggerNotification]);

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
    signUp, signIn, signInWithGoogle, resetPassword, updatePassword, updateDisplayName, acceptPrivacyPolicy, logOut,
    // Workspace model
    workspaces, activeWorkspaceId, activeWorkspace, switchWorkspace, createWorkspace, setWorkspaceMode, updateWorkspaceLandingTab, updateWorkspaceColumnPrefs,
    renameWorkspace, deleteWorkspace,
    incomeSources, addIncomeSource, deleteIncomeSource, incomeMode, updateIncomeMode, monthlyIncome, updateMonthlyIncome,
    workspaceBackups, createBackupNow, restoreFromBackup,
    addFamilyMember, joinFamilyGroup, leaveFamilyGroup,
    incomingInvitations, approveInvitation, declineInvitation, updateMemberRole, removeFamilyMember,
    outgoingInvitations, cancelInvitation,
    isAuthLoading, familyRole, isReadOnly, inviteCode, regenerateInviteCode,
    payments, allPayments, history, allHistory, countries, rate, summaryCurrency, notifications, isLoaded, isSyncing,
    familyMessages, sendFamilyMessage,
    rewardsPerks, addReward, updateReward, deleteReward,
    addPayment, addBulkPayments, updatePayment, deletePayment, updatePaymentsOrder, recordPayment,
    deleteHistoryEntry, updateHistoryStatus, clearHistory, saveRate, saveSummaryCurrency,
    addCountry, updateCountry, deleteCountry,
    triggerNotification, dismissNotification, markAllNotificationsRead, clearNotifications,
    checkPaymentReminders, requestNotificationPermission, resetToDefaults, fetchAllUsersForAdmin, inviteNewUser,
    startWhatsAppVerification, disconnectWhatsApp,
    accessPlans, createAccessPlan, updateAccessPlan, deleteAccessPlan,
    myUpgradeRequest, requestUpgrade, fetchPendingUpgradeRequests, resolveUpgradeRequest, adminSetUserPlan, setSuperAdminStatus,
    portfolioSplits, addPortfolioSplit, deletePortfolioSplit,
    portfolioHoldings, portfolioDataLoading, addPortfolioHolding, bulkAddPortfolioHoldings, reconcilePortfolioHoldingQuantity, bulkHistoricalImport, updatePortfolioHolding, updatePortfolioHoldingLivePrice, deletePortfolioHolding, bulkTagPortfolioHoldings, bulkDeletePortfolioHoldings, deleteAllPortfolioData,
    portfolioSnapshots, takePortfolioSnapshot, deletePortfolioSnapshotBatch,
    portfolioPriceHistory,
    portfolioContributions, addPortfolioContribution, updatePortfolioContribution, deletePortfolioContribution,
    portfolioWithdrawals, addPortfolioWithdrawal, deletePortfolioWithdrawal,
    portfolioCashBalances, setPortfolioCashBalance, deletePortfolioCashBalance,
    portfolioDividends, addPortfolioDividend, deletePortfolioDividend,
    portfolioFees, addPortfolioFee, deletePortfolioFee,
    portfolioRecurringPlans, addPortfolioRecurringPlan, updatePortfolioRecurringPlan, deletePortfolioRecurringPlan,
    appNotificationsEnabled, mobileNotificationsEnabled, saveNotificationSettings,
  };
}
