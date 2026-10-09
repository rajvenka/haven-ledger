import React, { useEffect, useMemo, useState } from 'react';
import { Star, BarChart3, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Vote { voter_id: string; voter_label: string | null; design: number; section: string; rating: number; comment: string | null }

/** Temporary rating bar: rate the design currently shown, per section. Votes are shared, so others can rate too. */
export default function DesignVoting({ page, design, designNames, section, sections }: {
  page: string; design: number; designNames: string[]; section: string; sections: { k: string; label: string }[];
}) {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [me, setMe] = useState<{ id: string; label: string } | null>(null);
  const [comment, setComment] = useState('');
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const { data } = await supabase.from('design_votes').select('voter_id, voter_label, design, section, rating, comment').eq('page', page);
    setVotes((data as Vote[]) || []);
  };
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { const u = data?.user; if (u) setMe({ id: u.id, label: u.email || u.id.slice(0, 6) }); });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mine = useMemo(() => votes.find((v) => me && v.voter_id === me.id && v.design === design && v.section === section), [votes, me, design, section]);
  useEffect(() => { setComment(mine?.comment || ''); setMsg(''); }, [design, section, mine?.rating]); // eslint-disable-line

  const save = async (rating: number, cmt: string) => {
    if (!me) { setMsg('Sign in to vote'); return; }
    const { error } = await supabase.from('design_votes').upsert({ voter_id: me.id, voter_label: me.label, page, design, section, rating, comment: cmt || null, updated_at: new Date().toISOString() }, { onConflict: 'voter_id,page,design,section' });
    setMsg(error ? error.message : 'Saved');
    if (!error) load();
  };

  const voters = new Set(votes.map((v) => v.voter_id)).size;
  const cell = (d: number, k: string) => { const l = votes.filter((v) => v.design === d && v.section === k); return l.length ? { avg: l.reduce((a, v) => a + v.rating, 0) / l.length, n: l.length } : null; };
  const overall = (d: number) => { const l = votes.filter((v) => v.design === d); return l.length ? l.reduce((a, v) => a + v.rating, 0) / l.length : 0; };
  const best = designNames.map((_, i) => ({ d: i + 1, v: overall(i + 1) })).sort((a, b) => b.v - a.v)[0];
  const secLabel = sections.find((s) => s.k === section)?.label || section;

  return (
    <div className="mb-4 rounded-2xl border border-dashed border-violet-300 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/20 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="text-xs font-black text-violet-700 dark:text-violet-300">Rate: Option {design} · {designNames[design - 1]} · {secLabel}</div>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => save(n, comment)} title={`${n} / 5`} className="p-0.5">
            <Star className={`w-5 h-5 ${mine && n <= mine.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
          </button>
        ))}
      </div>
      <input value={comment} onChange={(e) => setComment(e.target.value)} onBlur={() => mine && comment !== (mine.comment || '') && save(mine.rating, comment)} onKeyDown={(e) => { if (e.key === 'Enter' && mine) save(mine.rating, comment); }} placeholder="Optional comment (what to change)…" className="flex-1 min-w-[160px] text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none" />
      {msg && <span className="text-[11px] font-bold text-slate-500">{msg}</span>}
      <button onClick={() => { load(); setOpen(true); }} className="inline-flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg bg-violet-600 text-white"><BarChart3 className="w-3.5 h-3.5" /> Results ({voters} voter{voters === 1 ? '' : 's'})</button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3" onClick={() => setOpen(false)}>
          <div className="w-full max-w-4xl max-h-[88vh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-base font-black">Design votes — average rating (votes)</h3><button onClick={() => setOpen(false)}><X className="w-4 h-4" /></button></div>
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase text-slate-400"><th className="py-2">Option</th>{sections.map((s) => <th key={s.k} className="text-center">{s.label}</th>)}<th className="text-center">Overall</th></tr></thead>
              <tbody>
                {designNames.map((nm, i) => {
                  const o = overall(i + 1);
                  return (
                    <tr key={nm} className={`border-t border-slate-100 dark:border-slate-800 ${best && best.v > 0 && best.d === i + 1 ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                      <td className="py-2 font-black">{i + 1}. {nm}</td>
                      {sections.map((s) => { const c = cell(i + 1, s.k); return <td key={s.k} className="text-center tabular-nums">{c ? <span className={c.avg >= 4 ? 'text-emerald-600 font-black' : c.avg < 3 ? 'text-rose-500' : ''}>{c.avg.toFixed(1)} <span className="text-slate-400">({c.n})</span></span> : <span className="text-slate-300">—</span>}</td>; })}
                      <td className="text-center font-black tabular-nums">{o ? o.toFixed(2) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-4 text-[11px] font-black uppercase text-slate-400">Comments</div>
            <div className="space-y-1 mt-1">
              {votes.filter((v) => v.comment).map((v, i) => <div key={i} className="text-xs"><b>Option {v.design} · {sections.find((s) => s.k === v.section)?.label}</b> <span className="text-slate-400">({v.voter_label?.split('@')[0]}, {v.rating}★)</span>: {v.comment}</div>)}
              {votes.every((v) => !v.comment) && <div className="text-xs text-slate-400">No comments yet.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
