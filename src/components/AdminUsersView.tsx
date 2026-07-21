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
}

interface AdminUsersViewProps {
  fetchAllUsersForAdmin: () => Promise<AdminUser[]>;
  inviteNewUser: (email: string) => Promise<any>;
  accessPlans?: AccessPlan[];
  onCreatePlan?: (name: string, features: string[], description?: string) => Promise<void>;
  onUpdatePlan?: (id: string, updates: { name?: string; description?: string; features?: string[] }) => Promise<void>;
  onDeletePlan?: (id: string) => Promise<void>;
  fetchPendingUpgradeRequests?: () => Promise<UpgradeRequest[]>;
  onResolveUpgradeRequest?: (requestId: string, userId: string, planId: string, approve: boolean) => Promise<void>;
  onSetUserPlan?: (userId: string, planId: string) => Promise<void>;
}

const ALL_PLAN_FEATURES = ['income', 'rewards', 'ai', 'team', 'chat', 'agent'];
const PLAN_FEATURE_LABELS: Record<string, string> = { income: 'Income', rewards: 'Rewards', ai: 'AI Insights', team: 'Team', chat: 'Chat', agent: 'AI Agent' };

export default function AdminUsersView({ fetchAllUsersForAdmin, inviteNewUser, accessPlans = [], onCreatePlan, onUpdatePlan, onDeletePlan, fetchPendingUpgradeRequests, onResolveUpgradeRequest, onSetUserPlan }: AdminUsersViewProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanFeatures, setNewPlanFeatures] = useState<string[]>([]);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const togglePlanFeature = (f: string) => setNewPlanFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanError(null);
    if (!newPlanName.trim()) return;
    setPlanBusy(true);
    try {
      await onCreatePlan?.(newPlanName.trim(), newPlanFeatures);
      setNewPlanName('');
      setNewPlanFeatures([]);
      setIsCreatingPlan(false);
    } catch (err: any) {
      setPlanError(err.message || 'Could not create plan.');
    } finally {
      setPlanBusy(false);
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

  useEffect(() => { load(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    try {
      await inviteNewUser(inviteEmail.trim().toLowerCase());
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()} — they'll get an email to set their password.`);
      setInviteEmail('');
      await load();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invite.');
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div className="space-y-5 text-left animate-in fade-in-50 duration-300">
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
        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5" /> Invite New User
        </span>
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@email.com"
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
          />
          <button
            type="submit"
            disabled={inviteBusy || !inviteEmail.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
          >
            {inviteBusy ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
        {inviteError && <p className="text-[10px] text-red-500 font-semibold">{inviteError}</p>}
        {inviteSuccess && (
          <p className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
            <Check className="w-3 h-3" /> {inviteSuccess}
          </p>
        )}
        <p className="text-[9px] text-slate-400">Creates the account and emails them a link to set their own password — they won't need a workspace invite code separately unless you want them in a specific workspace.</p>
      </div>

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
            <div key={plan.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {plan.name}
                  {plan.isSystem && <span className="text-[8px] font-black uppercase text-slate-400">Default</span>}
                </p>
                <p className="text-[9px] text-slate-400">
                  {plan.features.length === 0 ? 'Bills & Expenses only' : plan.features.map(f => PLAN_FEATURE_LABELS[f] || f).join(', ')}
                </p>
              </div>
              {!plan.isSystem && (
                <button onClick={() => onDeletePlan?.(plan.id)} className="p-1.5 text-slate-300 hover:text-red-500 cursor-pointer shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
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
            {planError && <p className="text-[10px] text-red-500 font-semibold">{planError}</p>}
            <button type="submit" disabled={planBusy || !newPlanName.trim()} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer">
              {planBusy ? 'Creating…' : 'Create Plan'}
            </button>
          </form>
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
        <div className="space-y-2.5">
          {users.map(u => (
            <div key={u.id} className="apple-card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs uppercase shrink-0">
                {(u.displayName || u.email).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.displayName || u.email.split('@')[0]}</p>
                  {u.isSuperAdmin && (
                    <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-wider rounded-full">Super Admin</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                <p className="text-[9px] text-slate-350 dark:text-slate-600 font-semibold mt-0.5">
                  Joined {new Date(u.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-1.5">
                  <select
                    value={u.licensePlanId || ''}
                    onChange={(e) => handleSetPlan(u.id, e.target.value)}
                    disabled={changingPlanFor === u.id}
                    className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer disabled:opacity-50"
                  >
                    {accessPlans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {u.workspaces.length === 0 ? (
                  <span className="text-[9px] text-slate-350 dark:text-slate-600 font-semibold">No workspace</span>
                ) : (
                  u.workspaces.map(ws => (
                    <span key={ws.id} className="flex items-center gap-1 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                      {ws.type === 'business' ? <Briefcase className="w-2.5 h-2.5" /> : <Home className="w-2.5 h-2.5" />}
                      {ws.name} · {ws.role}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
