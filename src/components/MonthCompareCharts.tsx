import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { CompareRow } from '../utils/accounts';

const card = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3';

export function CompareHeadline({ last, cur, stillToPay, money }: { last: number; cur: number; stillToPay: number; money: (n: number) => string }) {
  const projected = cur + stillToPay;
  const pct = last > 0 ? ((projected - last) / last) * 100 : null;
  return (
    <div className={`${card} flex flex-wrap items-center gap-x-6 gap-y-2`}>
      <div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Last month paid</p><p className="text-[15px] font-black tabular-nums text-slate-900 dark:text-white">{money(last)}</p></div>
      <div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">This month so far</p><p className="text-[15px] font-black tabular-nums text-emerald-600">{money(cur)}</p></div>
      <div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Projected month</p><p className="text-[15px] font-black tabular-nums text-slate-900 dark:text-white">{money(projected)}</p></div>
      {pct !== null && (
        <span className={`ml-auto text-[11px] font-black px-2 py-1 rounded-full ${pct > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
          {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% vs last month
        </span>
      )}
    </div>
  );
}

export function CompareBars({ title, rows, money, limit = 7 }: { title: string; rows: CompareRow[]; money: (n: number) => string; limit?: number }) {
  const data = rows.slice(0, limit).map((r) => ({ ...r, last: Math.round(r.last), cur: Math.round(r.cur) }));
  return (
    <section className={card}>
      <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-200 mb-2">{title}</h3>
      {data.length === 0 ? <p className="text-[12px] text-slate-400 py-8 text-center">No payments logged in the last two months</p> : (
        <div style={{ height: Math.max(160, data.length * 38 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b833" />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => money(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="last" name="Last month" fill="#cbd5e1" radius={[0, 4, 4, 0]} />
              <Bar dataKey="cur" name="This month" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export function CumulativeLines({ data, money }: { data: { day: number; last: number; cur: number | null }[]; money: (n: number) => string }) {
  return (
    <section className={card}>
      <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-200 mb-2">Spend pace <span className="text-slate-400 font-bold">cumulative paid by day</span></h3>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b833" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: any) => money(Number(v))} labelFormatter={(d) => `Day ${d}`} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="last" name="Last month" stroke="#94a3b8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cur" name="This month" stroke="#7c3aed" strokeWidth={2.5} dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
