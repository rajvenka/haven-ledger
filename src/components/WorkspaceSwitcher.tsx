import React, { useState } from 'react';
import { ChevronDown, Home, Briefcase, Plus, Check, Pencil, Trash2 } from 'lucide-react';
import { Workspace } from '../types';

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSwitch: (id: string) => Promise<void>;
  onCreateNew: (name: string, type: 'family' | 'business') => Promise<any>;
  onRename?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function WorkspaceSwitcher({ workspaces, activeWorkspace, onSwitch, onCreateNew, onRename, onDelete }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'family' | 'business'>('family');
  const [busy, setBusy] = useState(false);

  if (workspaces.length === 0) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await onCreateNew(newName.trim(), newType);
      setIsCreating(false);
      setIsOpen(false);
      setNewName('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-left"
      >
        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${activeWorkspace?.type === 'business' ? 'bg-[#34c759]' : 'bg-[#007aff]'}`}>
          {activeWorkspace?.type === 'business' ? <Briefcase className="w-3 h-3 text-white" /> : <Home className="w-3 h-3 text-white" />}
        </div>
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[110px] truncate">{activeWorkspace?.name || 'Workspace'}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setIsCreating(false); }} />
          <div className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1.5 text-left">
            {workspaces.map(ws => (
              renamingId === ws.id ? (
                <form
                  key={ws.id}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!renameValue.trim()) return;
                    setBusy(true);
                    try { await onRename?.(ws.id, renameValue.trim()); setRenamingId(null); } finally { setBusy(false); }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5"
                >
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-md text-xs"
                  />
                  <button type="submit" disabled={busy} className="p-1.5 bg-indigo-600 text-white rounded-md cursor-pointer"><Check className="w-3 h-3" /></button>
                </form>
              ) : (
                <div key={ws.id} className="group flex items-center gap-1 px-1">
                  <button
                    onClick={async () => { await onSwitch(ws.id); setIsOpen(false); }}
                    className="flex-1 flex items-center gap-2.5 px-1.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer min-w-0"
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${ws.type === 'business' ? 'bg-[#34c759]' : 'bg-[#007aff]'}`}>
                      {ws.type === 'business' ? <Briefcase className="w-3.5 h-3.5 text-white" /> : <Home className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{ws.name}</p>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">{ws.type} · {ws.isOwner ? 'Owner' : ws.role}</p>
                    </div>
                    {ws.id === activeWorkspace?.id && <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                  </button>
                  {ws.isOwner && (
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <button onClick={() => { setRenamingId(ws.id); setRenameValue(ws.name); }} className="p-1.5 text-slate-400 hover:text-indigo-500 cursor-pointer" title="Rename">
                        <Pencil className="w-3 h-3" />
                      </button>
                      {workspaces.length > 1 && (
                        <button
                          onClick={async () => { if (confirm(`Delete "${ws.name}" and all of its data? This can't be undone.`)) { await onDelete?.(ws.id); } }}
                          className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            ))}

            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />

            {!isCreating ? (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer text-indigo-600 dark:text-indigo-400"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold">New Workspace</span>
              </button>
            ) : (
              <form onSubmit={handleCreate} className="p-2 space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setNewType('family')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${newType === 'family' ? 'bg-[#007aff] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Family</button>
                  <button type="button" onClick={() => setNewType('business')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${newType === 'business' ? 'bg-[#34c759] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>Business</button>
                </div>
                <button type="submit" disabled={busy || !newName.trim()} className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer">
                  {busy ? 'Creating…' : 'Create'}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
