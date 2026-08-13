/**
 * Shared Pulse chrome — badge + full-height scroll region.
 * Classic screens can be dropped in as children for feature parity while UI migrates.
 */
import React from 'react';

export default function PulsePageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-left w-full max-w-full">
      <div className="shrink-0 px-3 sm:px-4 pt-2 pb-1.5 border-b border-slate-100 dark:border-slate-900/80">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
            {title}
          </h1>
          <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-600 text-white">
            Pulse
          </span>
        </div>
        {subtitle && <p className="text-[10px] text-slate-400 font-bold mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24 md:pb-6">{children}</div>
    </div>
  );
}
