import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, Home, Briefcase, RefreshCw, UserPlus, Check, Package, Plus, Trash2, X } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  isSuperAdmin: boolean;
  licensePlanId?: string;
  licensePlanName?: string;
  workspaces: { id: string; name: string; type: 'family' | 'business'; role: string }[];
}

interface UpgradeRequest {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  requestedPlanId: string;
  requestedPlanName: string;
  createdAt: string;
}

interface AccessPlan {
  id: string;
  name: string;
  description?: string;
  features: string[];
  isSystem: boolean;
  canCreateBusiness?: boolean;
}

interface AdminUsersViewProps {
  fetchAllUsersForAdmin: () => Promise<AdminUser[]>;
  inviteNewUser: (email: string) => Promise<any>;
  onOnboardUserWithPlan?: (email: string, planId: string) => Promise<any>;
  accessPlans?: AccessPlan[];
  onCreatePlan?: (name: string, features: string[], description?: string, canCreateBusiness?: boolean) => Promise<void>;
  onUpdatePlan?: (id: string, updates: { name?: string; description?: string; features?: string[]; canCreateBusiness?: boolean }) => Promise<void>;
  onDeletePlan?: (id: string) => Promise<void>;
  fetchPendingUpgradeRequests?: () => Promise<UpgradeRequest[]>;
  onResolveUpgradeRequest?: (requestId: string, userId: string, planId: string, approve: boolean) => Promise<void>;
  onSetUserPlan?: (userId: string, planId: string) => Promise<void>;
  onSetSuperAdmin?: (userId: string, isAdmin: boolean) => Promise<void>;
  currentUserId?: string;
}

const ALL_PLAN_FEATURES = ['income', 'rewards', 'ai', 'team', 'chat', 'agent', 'whatsapp', 'portfolio', 'multi_portfolio'];
const PLAN_FEATURE_LABELS: Record<string, string> = { income: 'Income', rewards: 'Membership Hub', ai: 'AI Insights', team: 'Team', chat: 'Chat', agent: 'AI Agent', whatsapp: 'WhatsApp', portfolio: 'Investment / Portfolio', multi_portfolio: 'Multiple Portfolio' };

export default function AdminUsersView({ fetchAllUsersForAdmin, inviteNewUser, onOnboardUserWithPlan, accessPlans = [], onCreatePlan, onUpdatePlan, onDeletePlan, fetchPendingUpgradeRequests, onResolveUpgradeRequest, onSetUserPlan, onSetSuperAdmin, currentUserId }: AdminUsersViewProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardStep, setOnboardStep] = useState<1 | 2 | 3>(1);
  const [inviteEmail, setInviteEmail] = useState('');
  const [onboardPlanId, setOnboardPlanId] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanFeatures, setNewPlanFeatures] = useState<string[]>([]);
  const [newPlanCanCreateBusiness, setNewPlanCanCreateBusiness] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const togglePlanFeature = (f: string) => setNewPlanFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanError(null);
    if (!newPlanName.trim()) return;
    setPlanBusy(true);
    try {
      await onCreatePlan?.(newPlanName.trim(), newPlanFeatures, undefined, newPlanCanCreateBusiness);
      setNewPlanName('');
      setNewPlanFeatures([]);
      setNewPlanCanCreateBusiness(false);
      setIsCreatingPlan(false);
    } catch (err: any) {
      setPlanError(err.message || 'Could not create plan.');
    } finally {
      setPlanBusy(false);
    }
  };

  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editFeatures, setEditFeatures] = useState<string[]>([]);
  const [editCanCreateBusiness, setEditCanCreateBusiness] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  const startEditingPlan = (plan: AccessPlan) => {
    setEditingPlanId(plan.id);
    setEditFeatures(plan.features);
    setEditCanCreateBusiness(plan.canCreateBusiness ?? false);
  };

  const toggleEditFeature = (f: string) => setEditFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const saveEditedPlan = async () => {
    if (!editingPlanId) return;
    setEditBusy(true);
    try {
      await onUpdatePlan?.(editingPlanId, { features: editFeatures, canCreateBusiness: editCanCreateBusiness });
      setEditingPlanId(null);
    } finally {
      setEditBusy(false);
    }
  };

  const [pendingRequests, setPendingRequests] = useState<UpgradeRequest[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [changingPlanFor, setChangingPlanFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [userData, requestData] = await Promise.all([
        fetchAllUsersForAdmin(),
        fetchPendingUpgradeRequests ? fetchPendingUpgradeRequests() : Promise.resolve([]),
      ]);
      setUsers(userData);
      setPendingRequests(requestData);
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (req: UpgradeRequest, approve: boolean) => {
    setResolvingId(req.id);
    try {
      await onResolveUpgradeRequest?.(req.id, req.userId, req.requestedPlanId, approve);
      await load();
    } finally {
      setResolvingId(null);
    }
  };

  const handleSetPlan = async (userId: string, planId: string) => {
    setChangingPlanFor(userId);
    try {
      await onSetUserPlan?.(userId, planId);
      await load();
    } finally {
      setChangingPlanFor(null);
    }
  };

  const [togglingAdminFor, setTogglingAdminFor] = useState<string | null>(null);
  const handleToggleSuperAdmin = async (u: AdminUser) => {
    const makingAdmin = !u.isSuperAdmin;
    const confirmed = window.confirm(
      makingAdmin
        ? `Make ${u.displayName || u.email} a super admin? They'll be able to see every user and change anyone's plan.`
        : `Remove super admin from ${u.displayName || u.email}?`
    );
    if (!confirmed) return;
    setTogglingAdminFor(u.id);
    try {
      await onSetSuperAdmin?.(u.id, makingAdmin);
      await load();
    } finally {
      setTogglingAdminFor(null);
    }
  };

  useEffect(() => { load(); }, []);

  const handleConfirmOnboard = async () => {
    setInviteError(null);
    setInviteSuccess(null);
    if (!inviteEmail.trim() || !onboardPlanId) return;
    setInviteBusy(true);
    try {
      await onOnboardUserWithPlan?.(inviteEmail.trim().toLowerCase(), onboardPlanId);
      const planName = accessPlans.find(p => p.id === onboardPlanId)?.name || 'their plan';
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()} — they'll get an email to set their password, and land with ${planName} already assigned.`);
      setInviteEmail('');
      setOnboardPlanId('');
      setOnboardStep(1);
      await load();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invite.');
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-5 pt-4 pb-24 md:pb-4 space-y-5 text-left bg-slate-50 dark:bg-slate-900 animate-in fade-in-50 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" /> App & License Management
          </h2>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
            {users.length} registered user{users.length !== 1 ? 's' : ''} across the platform · Super Admin only
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="apple-card p-4 space-y-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${onboardStep === 1 ? 'bg-indigo-600 text-white' : 'bg-emerald-500 text-white'}`}>{onboardStep === 1 ? '1' : <Check className="w-3 h-3" />}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wide ${onboardStep === 1 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>Email</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${onboardStep === 2 ? 'bg-indigo-600 text-white' : onboardStep > 2 ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>{onboardStep > 2 ? <Check className="w-3 h-3" /> : '2'}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wide ${onboardStep === 2 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>Plan</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${onboardStep === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>3</span>
          <span className={`text-[9px] font-bold uppercase tracking-wide ${onboardStep === 3 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>Confirm</span>
        </div>

        {onboardStep === 1 && (
          <>
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Onboard New User
            </span>
            <p className="text-[10px] text-slate-400">Step 1 of 3 - who are you onboarding?</p>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@email.com"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
            />
            <button
              type="button"
              onClick={() => { if (inviteEmail.trim()) setOnboardStep(2); }}
              disabled={!inviteEmail.trim()}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
            >
              Next: Choose Plan
            </button>
          </>
        )}

        {onboardStep === 2 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-400">Step 2 of 3 - which plan should {inviteEmail} land with?</p>
              <button type="button" onClick={() => setOnboardStep(1)} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer shrink-0">← Back</button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {accessPlans.map(plan => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setOnboardPlanId(plan.id)}
                  className={`px-2.5 py-2 rounded-lg text-[10px] font-bold text-left cursor-pointer transition-all ${onboardPlanId === plan.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}
                >
                  {plan.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { if (onboardPlanId) setOnboardStep(3); }}
              disabled={!onboardPlanId}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
            >
              Next: Confirm
            </button>
          </>
        )}

        {onboardStep === 3 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-400">Step 3 of 3 - review and send</p>
              <button type="button" onClick={() => setOnboardStep(2)} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer shrink-0">← Back</button>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase">Email</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate ml-2">{inviteEmail}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase">Plan</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{accessPlans.find(p => p.id === onboardPlanId)?.name}</span>
              </div>
            </div>
            {inviteError && <p className="text-[10px] text-red-500 font-semibold">{inviteError}</p>}
            <button
              type="button"
              onClick={handleConfirmOnboard}
              disabled={inviteBusy}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
            >
              {inviteBusy ? 'Sending…' : 'Send Invite'}
            </button>
            <p className="text-[9px] text-slate-400">Creates the account, sends them a real email to set their own password, and assigns the plan above the moment they sign up - no separate follow-up step needed.</p>
          </>
        )}

        {inviteSuccess && (
          <p className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
            <Check className="w-3 h-3" /> {inviteSuccess}
          </p>
        )}
      </div>

      {error && (
        <div className="apple-card p-4 text-rose-500 text-xs font-semibold">{error}</div>
      )}

      {pendingRequests.length > 0 && (
        <div className="apple-card p-4 space-y-2.5">
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pending Upgrade Requests ({pendingRequests.length})</span>
          {pendingRequests.map(req => (
            <div key={req.id} className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{req.userName || req.userEmail}</p>
                <p className="text-[10px] text-slate-500">Requesting <span className="font-bold">{req.requestedPlanName}</span></p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => handleResolve(req, true)}
                  disabled={resolvingId === req.id}
                  className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] font-black rounded-lg cursor-pointer"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleResolve(req, false)}
                  disabled={resolvingId === req.id}
                  className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 disabled:opacity-50 text-[10px] font-black rounded-lg cursor-pointer"
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="apple-card p-10 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          {/* Header row */}
          <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_100px_minmax(0,1.4fr)_130px] gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-900 text-[9px] font-black text-slate-400 uppercase tracking-wider">
            <span>User</span>
            <span>Email</span>
            <span>Joined</span>
            <span>Workspace(s)</span>
            <span>Plan</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-900">
            {users.map(u => (
              <div key={u.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_100px_minmax(0,1.4fr)_130px] gap-1.5 md:gap-3 items-center px-4 py-2.5 text-left">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-[10px] uppercase shrink-0">
                    {(u.displayName || u.email).charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.displayName || u.email.split('@')[0]}</span>
                  {u.isSuperAdmin && (
                    <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-wider rounded-full shrink-0">Admin</span>
                  )}
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => handleToggleSuperAdmin(u)}
                      disabled={togglingAdminFor === u.id}
                      title={u.isSuperAdmin ? 'Remove super admin' : 'Make super admin'}
                      className={`p-1 rounded-md shrink-0 cursor-pointer disabled:opacity-40 ${u.isSuperAdmin ? 'text-indigo-500 hover:text-slate-400' : 'text-slate-300 hover:text-indigo-500'}`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 truncate">{u.email}</span>
                <span className="text-[10px] text-slate-400 md:text-center">{new Date(u.createdAt).toLocaleDateString()}</span>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 min-w-0">
                  {u.workspaces.length === 0 ? (
                    <span className="text-[10px] text-slate-350 dark:text-slate-600">—</span>
                  ) : (
                    u.workspaces.map(ws => (
                      <span key={ws.id} className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                        {ws.type === 'business' ? <Briefcase className="w-2.5 h-2.5 shrink-0" /> : <Home className="w-2.5 h-2.5 shrink-0" />}
                        {ws.name} · {ws.role}
                      </span>
                    ))
                  )}
                </div>
                <select
                  value={u.licensePlanId || ''}
                  onChange={(e) => handleSetPlan(u.id, e.target.value)}
                  disabled={changingPlanFor === u.id}
                  className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer disabled:opacity-50 w-full md:w-auto"
                >
                  {accessPlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manage Access Plans */}
      <div className="apple-card p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Access Plans
          </span>
          {!isCreatingPlan && (
            <button onClick={() => setIsCreatingPlan(true)} className="p-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
              <Plus className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}
        </div>

        <div className="space-y-2">
          {accessPlans.map(plan => (
            <div key={plan.id} className="bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {plan.name}
                    {plan.isSystem && <span className="text-[8px] font-black uppercase text-slate-400">Default</span>}
                  </p>
                  <p className="text-[9px] text-slate-400">
                    {plan.features.length === 0 ? 'Bills & Expenses only' : plan.features.map(f => PLAN_FEATURE_LABELS[f] || f).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => (editingPlanId === plan.id ? setEditingPlanId(null) : startEditingPlan(plan))} className="p-1.5 text-slate-400 hover:text-indigo-500 cursor-pointer">
                    {editingPlanId === plan.id ? <X className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                  </button>
                  {!plan.isSystem && (
                    <button onClick={() => onDeletePlan?.(plan.id)} className="p-1.5 text-slate-300 hover:text-red-500 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {editingPlanId === plan.id && (
                <div className="p-2.5 pt-0 space-y-2">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold text-left bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 cursor-default">
                    <Check className="w-3 h-3 shrink-0" />
                    Bills & Expenses (always included)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_PLAN_FEATURES.map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggleEditFeature(f)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer text-left ${editFeatures.includes(f) ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900' : 'bg-white dark:bg-slate-950 text-slate-400 border border-slate-200 dark:border-slate-800'}`}
                      >
                        {editFeatures.includes(f) ? <Check className="w-3 h-3 shrink-0" /> : <span className="w-3 h-3 shrink-0" />}
                        {PLAN_FEATURE_LABELS[f]}
                      </button>
                    ))}
                  </div>
                  {!['Light', 'Pro', 'Pro Max'].includes(plan.name) && (
                  <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={editCanCreateBusiness} onChange={(e) => setEditCanCreateBusiness(e.target.checked)} className="cursor-pointer" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Can create Business workspaces</span>
                  </label>
                  )}
                  <button onClick={saveEditedPlan} disabled={editBusy} className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer">
                    {editBusy ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isCreatingPlan && (
          <form onSubmit={handleCreatePlan} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <input
                autoFocus
                type="text"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="Plan name, e.g. Family Basic"
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
              />
              <button type="button" onClick={() => { setIsCreatingPlan(false); setNewPlanName(''); setNewPlanFeatures([]); }} className="p-2 text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold text-left bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 cursor-default">
              <Check className="w-3 h-3 shrink-0" />
              Bills & Expenses (always included)
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_PLAN_FEATURES.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => togglePlanFeature(f)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer text-left ${newPlanFeatures.includes(f) ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900' : 'bg-white dark:bg-slate-950 text-slate-400 border border-slate-200 dark:border-slate-800'}`}
                >
                  {newPlanFeatures.includes(f) ? <Check className="w-3 h-3 shrink-0" /> : <span className="w-3 h-3 shrink-0" />}
                  {PLAN_FEATURE_LABELS[f]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer">
              <input type="checkbox" checked={newPlanCanCreateBusiness} onChange={(e) => setNewPlanCanCreateBusiness(e.target.checked)} className="cursor-pointer" />
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Can create Business workspaces</span>
            </label>
            {planError && <p className="text-[10px] text-red-500 font-semibold">{planError}</p>}
            <button type="submit" disabled={planBusy || !newPlanName.trim()} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer">
              {planBusy ? 'Creating…' : 'Create Plan'}
            </button>
          </form>
        )}
      </div>

    </div>
  );
}
