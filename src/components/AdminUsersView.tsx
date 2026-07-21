import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, Home, Briefcase, RefreshCw, UserPlus, Check } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  isSuperAdmin: boolean;
  workspaces: { id: string; name: string; type: 'family' | 'business'; role: string }[];
}

interface AdminUsersViewProps {
  fetchAllUsersForAdmin: () => Promise<AdminUser[]>;
  inviteNewUser: (email: string) => Promise<any>;
}

export default function AdminUsersView({ fetchAllUsersForAdmin, inviteNewUser }: AdminUsersViewProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllUsersForAdmin();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
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
            <ShieldCheck className="w-5 h-5 text-indigo-500" /> User Management
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

      {error && (
        <div className="apple-card p-4 text-rose-500 text-xs font-semibold">{error}</div>
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
