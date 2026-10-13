import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const LIMIT_BYTES = 500 * 1024 * 1024; // Supabase free plan database size (assumed)
const mb = (b: number) => (b >= 1024 * 1024 * 1024 ? `${(b / 1024 / 1024 / 1024).toFixed(2)} GB` : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const ago = (iso?: string | null) => {
  if (!iso) return '—';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** System-admin card: database size, biggest tables, backups, scheduled jobs and data freshness. */
export default function DatabaseHealth() {
  const [d, setD] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<boolean>(() => { try { return localStorage.getItem('hv_dbh_open') === '1'; } catch { return false; } });
  const toggle = () => setOpen((o) => { try { localStorage.setItem('hv_dbh_open', o ? '0' : '1'); } catch { /* */ } return !o; });

  const load = async () => {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('db_health');
    if (error) setErr(error.message); else setD(data);
    setBusy(false);
  };
  useEffect(() => { load(); }, []);

  const used = d?.db_size_bytes ?? 0;
  const pct = Math.min(100, (used / LIMIT_BYTES) * 100);
  const warn = pct > 80;
  const fresh = d?.freshness;
  const pricesAgeH = fresh?.prices_updated_at ? (Date.now() - new Date(fresh.prices_updated_at).getTime()) / 3600000 : null;
  const issues: string[] = [];
  if (warn) issues.push(`Database is ${pct.toFixed(0)}% full`);
  (d?.jobs || []).filter((j: any) => j.active && j.last_status && j.last_status !== 'succeeded').forEach((j: any) => issues.push(`Job "${j.jobname}" last run: ${j.last_status}`));
  if (fresh?.stale_prices > 0) issues.push(`${fresh.stale_prices} holdings have stale prices`);
  if (pricesAgeH != null && pricesAgeH > 72) issues.push('Prices not refreshed for over 3 days');
  const healthy = d && issues.length === 0;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <button onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <Database className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-black">Database health</span>
        {d && <span className="text-xs text-slate-500">{mb(used)} of {mb(LIMIT_BYTES)} · {pct.toFixed(1)}%</span>}
        <span className="flex-1" />
        {d && (healthy
          ? <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Healthy</span>
          : <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> {issues.length} to check</span>)}
        <span role="button" onClick={(e) => { e.stopPropagation(); load(); }} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Refresh"><RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${busy ? 'animate-spin' : ''}`} /></span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-3">
          {err && <div className="text-xs font-bold text-rose-600">{err}</div>}
          {d && (
            <>
              {issues.length > 0 && <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-0.5">{issues.map((i) => <div key={i}>• {i}</div>)}</div>}

              <div>
                <div className="flex justify-between text-xs mb-1"><span className="font-black">Storage used</span><span className="tabular-nums text-slate-500">{mb(used)} / {mb(LIMIT_BYTES)} (free-plan limit, assumed)</span></div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={`h-full ${warn ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} /></div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                {[
                  ['Workspaces', d.counts?.workspaces], ['Active holdings', d.counts?.holdings_active],
                  ['Bills', d.counts?.payments], ['Payment history', d.counts?.payment_history],
                ].map(([k, v]) => <div key={k as string} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2"><div className="text-[10px] font-black uppercase text-slate-400">{k}</div><div className="text-base font-black tabular-nums">{Number(v || 0).toLocaleString()}</div></div>)}
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-black mb-2">Biggest tables</div>
                  {(d.tables || []).map((t: any) => (
                    <div key={t.name} className="flex items-center gap-2 text-xs py-0.5">
                      <span className="w-40 truncate font-bold">{t.name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-400" style={{ width: `${Math.max(2, (t.total_bytes / (d.tables[0]?.total_bytes || 1)) * 100)}%` }} /></div>
                      <span className="w-16 text-right tabular-nums text-slate-500">{mb(t.total_bytes)}</span>
                      <span className="w-16 text-right tabular-nums text-slate-400">{Number(t.rows).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-black mb-2">Backups</div>
                    {[['Nightly full (kept 30 days)', d.backups?.full], ['In-app backups', d.backups?.app]].map(([l, b]: any) => (
                      <div key={l} className="flex justify-between text-xs py-0.5"><span className="font-bold">{l}</span><span className="text-slate-500 tabular-nums">{b?.count ?? 0} copies · {mb(b?.bytes || 0)} · latest {ago(b?.newest)}</span></div>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs font-black mb-2">Data freshness</div>
                    <div className="text-xs space-y-0.5 text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between"><span>Prices last refreshed</span><b className={pricesAgeH != null && pricesAgeH > 24 ? 'text-amber-600' : ''}>{ago(fresh?.prices_updated_at)}</b></div>
                      <div className="flex justify-between"><span>Latest daily snapshot</span><b>{fresh?.daily_positions_latest || '—'}</b></div>
                      <div className="flex justify-between"><span>Latest price-history day</span><b>{fresh?.price_history_latest || '—'}</b></div>
                      <div className="flex justify-between"><span>Stale prices</span><b className={fresh?.stale_prices > 0 ? 'text-amber-600' : ''}>{fresh?.stale_prices ?? 0}</b></div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-black mb-2">Scheduled jobs</div>
                <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-400"><tr><th className="text-left p-2">Job</th><th className="text-left p-2">Schedule (UTC)</th><th className="text-left p-2">State</th><th className="text-left p-2">Last run</th></tr></thead>
                    <tbody>
                      {(d.jobs || []).map((j: any) => (
                        <tr key={j.jobname} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="p-2 font-bold">{j.jobname}</td>
                          <td className="p-2 font-mono text-slate-500">{j.schedule}</td>
                          <td className="p-2">{j.active ? <span className="text-emerald-600 font-black">active</span> : <span className="text-slate-400">paused</span>}</td>
                          <td className="p-2">{j.last_run ? <span className={j.last_status === 'succeeded' ? 'text-slate-600 dark:text-slate-300' : 'text-rose-600 font-black'}>{j.last_status} · {ago(j.last_run)}</span> : <span className="text-slate-300">never</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
