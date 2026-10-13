import React from 'react';

/** Shared new-design page frame: one scroll pane, centered max width, bottom room for mobile dock. */
export default function PagePane({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-950" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className={`${wide ? 'max-w-7xl' : 'max-w-5xl'} mx-auto w-full min-w-0 pb-24 md:pb-6`}>{children}</div>
    </div>
  );
}
