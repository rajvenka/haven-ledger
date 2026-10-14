import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { avatarClass } from '../utils/accounts';

export interface SplitItem { id: string; label: string; sub?: string; icon?: React.ReactNode; badge?: string }

function useIsDesktop() {
  const [d, setD] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 900 : true));
  useEffect(() => {
    const f = () => setD(window.innerWidth >= 900);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return d;
}

/** Master/detail page (same look as Accounts): left rail of sections, right detail. Mobile: list -> detail with back. */
export default function SplitPage({
  title, subtitle, items, selected, onSelect, railTop, children,
}: {
  title: string; subtitle?: string; items: SplitItem[]; selected: string | null;
  onSelect: (id: string | null) => void; railTop?: React.ReactNode; children: React.ReactNode;
}) {
  const isDesktop = useIsDesktop();
  const current = items.find((i) => i.id === selected) || (isDesktop ? items[0] : undefined);
  const showDetail = !!current && (isDesktop || !!selected);

  const rail = (
    <div className={`${isDesktop ? 'w-[280px] shrink-0 border-r border-slate-200 dark:border-slate-800' : 'w-full'} flex flex-col min-h-0 bg-white/60 dark:bg-slate-950`}>
      <div className="p-3 border-b border-slate-100 dark:border-slate-800">
        <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-[10px] text-slate-400 font-bold">{subtitle}</p>}
        {railTop}
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 pb-24 md:pb-4">
        {items.map((it) => {
          const active = current?.id === it.id && (isDesktop || selected === it.id);
          return (
            <li key={it.id}>
              <button type="button" onClick={() => onSelect(it.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${active ? 'bg-violet-50 dark:bg-violet-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'}`}>
                {it.icon && <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white ${avatarClass(it.label)} ${active ? 'ring-2 ring-offset-2 ring-violet-400 dark:ring-offset-slate-950' : ''}`}>{it.icon}</div>}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{it.label}</p>
                  {it.sub && <p className="text-[10px] text-slate-500 truncate">{it.sub}</p>}
                </div>
                {it.badge && <span className="text-[10px] font-black text-slate-500">{it.badge}</span>}
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 md:hidden" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full overflow-hidden">
      {(isDesktop || !showDetail) && rail}
      {showDetail && (
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="shrink-0 px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            {!isDesktop && (
              <button type="button" onClick={() => onSelect(null)} className="inline-flex items-center gap-0.5 text-[11px] font-bold text-violet-600 mb-1">
                <ChevronLeft className="w-4 h-4" />{title}
              </button>
            )}
            <h2 className="text-base font-black text-slate-900 dark:text-white">{current!.label}</h2>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24 md:pb-6" style={{ WebkitOverflowScrolling: 'touch' }}>{children}</div>
        </div>
      )}
    </div>
  );
}
