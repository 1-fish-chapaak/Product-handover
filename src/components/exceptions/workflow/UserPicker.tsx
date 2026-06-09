import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Search, UserX } from 'lucide-react';
import type { OrgUser } from './workflowTypes';

function useOutside(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [ref, onClose, open]);
}

function Avatar({ u }: { u: OrgUser }) {
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold shrink-0 ${u.active ? 'bg-brand-50 text-brand-700' : 'bg-risk-50 text-risk-700'}`}>
      {u.initials}
    </span>
  );
}

/** Single-user select (the work assignee). */
export function UserSelect({ users, value, onChange, placeholder = 'Select a user…' }: {
  users: OrgUser[]; value: string | null; onChange: (id: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);
  const sel = users.find(u => u.id === value);
  const filtered = users.filter(u => `${u.name} ${u.role} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full h-10 px-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] flex items-center justify-between gap-2 hover:border-brand-200 cursor-pointer">
        {sel ? (
          <span className="flex items-center gap-2 min-w-0"><Avatar u={sel} /><span className="truncate text-ink-800">{sel.name}</span><span className="text-ink-400 text-[11px] truncate">· {sel.role}</span>{!sel.active && <span className="text-[10px] text-risk-700 inline-flex items-center gap-0.5"><UserX size={10}/>inactive</span>}</span>
        ) : <span className="text-ink-400">{placeholder}</span>}
        <ChevronDown size={14} className={`text-ink-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-canvas-elevated border border-canvas-border rounded-[8px] shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-canvas-border">
            <Search size={13} className="text-ink-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search users…" className="flex-1 text-[12.5px] bg-transparent focus:outline-none text-ink-800 placeholder:text-ink-400" />
          </div>
          <div className="max-h-[220px] overflow-y-auto py-1">
            {filtered.map(u => (
              <button key={u.id} type="button" onClick={() => { onChange(u.id); setOpen(false); setQ(''); }} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#FAFAFB] cursor-pointer">
                <Avatar u={u} />
                <span className="flex-1 min-w-0"><span className="text-[12.5px] text-ink-800">{u.name}</span> <span className="text-[11px] text-ink-400">· {u.role}</span></span>
                {!u.active && <span className="text-[10px] text-risk-700 inline-flex items-center gap-0.5"><UserX size={10}/>inactive</span>}
                {u.id === value && <Check size={14} className="text-brand-700" />}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-3 text-[12px] text-ink-400 text-center">No users found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Multi-user select (level approvers). */
export function UserMultiSelect({ users, selectedIds, onChange }: {
  users: OrgUser[]; selectedIds: string[]; onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  const sel = users.filter(u => selectedIds.includes(u.id));

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full min-h-9 px-2 py-1 bg-canvas-elevated border border-canvas-border rounded-[8px] flex items-center flex-wrap gap-1.5 hover:border-brand-200 cursor-pointer">
        {sel.length === 0 && <span className="text-[12.5px] text-ink-400 px-1">Select approver(s)…</span>}
        {sel.map(u => (
          <span key={u.id} className="inline-flex items-center gap-1.5 h-7 pl-1 pr-2 bg-brand-50 rounded-full text-[11.5px] text-brand-700">
            <Avatar u={u} /><span className="font-medium">{u.name}</span>
          </span>
        ))}
        <ChevronDown size={14} className={`text-ink-400 transition-transform ml-auto shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-canvas-elevated border border-canvas-border rounded-[8px] shadow-lg overflow-hidden max-h-[240px] overflow-y-auto py-1">
          {users.map(u => {
            const on = selectedIds.includes(u.id);
            return (
              <button key={u.id} type="button" onClick={() => toggle(u.id)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#FAFAFB] cursor-pointer">
                <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center ${on ? 'bg-brand-600 border-brand-600' : 'border-canvas-border'}`}>{on && <Check size={11} className="text-white" />}</span>
                <Avatar u={u} />
                <span className="flex-1 min-w-0"><span className="text-[12.5px] text-ink-800">{u.name}</span> <span className="text-[11px] text-ink-400">· {u.role}</span></span>
                {!u.active && <span className="text-[10px] text-risk-700 inline-flex items-center gap-0.5"><UserX size={10}/>inactive</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
