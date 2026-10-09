import React from 'react';
import { Sparkles, Undo2 } from 'lucide-react';

/** Slim bar above a Pulse page: flips between the current design and the new Accounts design. */
export default function NewDesignSwitch({
  isNew,
  onChange,
  children,
  plain = false,
}: {
  isNew: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  /** plain = Classic layout: bar sits in normal flow and the page scrolls as before. */
  plain?: boolean;
}) {
  const bar = (
      <div className="shrink-0 flex items-center justify-end px-3 sm:px-4 py-1 bg-slate-50 dark:bg-slate-950">
        <button
          type="button"
          onClick={() => onChange(!isNew)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide transition-all ${
            isNew
              ? 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/30'
          }`}
        >
          {isNew ? <><Undo2 className="w-3 h-3" /> Back to current design</> : <><Sparkles className="w-3 h-3" /> Try new design</>}
        </button>
      </div>
  );
  if (plain) return <>{bar}{children}</>;
  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
      {bar}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
}
