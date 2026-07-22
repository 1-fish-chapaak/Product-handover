import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import type { WorkflowLevel, ApprovalMode, Persona } from './workflowTypes';
import { usersForPersona } from './workflowData';
import { UserMultiSelect } from './UserPicker';

const MODES: { value: ApprovalMode; label: string; hint: string }[] = [
  { value: 'all', label: 'All must approve', hint: 'Parallel — every approver signs off' },
  { value: 'any', label: 'Any one approves', hint: 'Parallel — first approval clears the level' },
  { value: 'sequential', label: 'Sequential', hint: 'Approvers act in the listed order' },
];

let levelSeq = 0;
const newLevelId = () => `lvl-new-${Date.now()}-${levelSeq++}`;

/** Build/edit the configurable approval chain — add/remove/reorder levels,
 *  each with name, approver(s), approval mode, SLA and send-back policy. */
export default function WorkflowPipelineBuilder({
  levels, persona, onChange,
}: {
  levels: WorkflowLevel[];
  persona: Persona;
  onChange: (levels: WorkflowLevel[]) => void;
}) {
  const users = usersForPersona(persona);

  const update = (id: string, patch: Partial<WorkflowLevel>) =>
    onChange(levels.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => onChange(levels.filter(l => l.id !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= levels.length) return;
    const next = [...levels];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...levels, {
    id: newLevelId(),
    name: `L${levels.length + 1} — Review`,
    assigneeIds: [],
    mode: 'any',
    slaHours: 48,
    allowSendBack: true,
  }]);

  return (
    <div className="space-y-3">
      {levels.map((lvl, i) => (
        <div key={lvl.id} className="border border-canvas-border rounded-lg p-3.5 bg-canvas-elevated">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-[0.6875rem] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <GripVertical size={14} className="text-ink-300" />
            <input
              value={lvl.name}
              onChange={e => update(lvl.id, { name: e.target.value })}
              placeholder="Level name"
              className="flex-1 h-9 px-2.5 bg-canvas-elevated border border-canvas-border rounded-md text-[0.8125rem] font-semibold text-ink-800 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
            />
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-7 h-7 rounded flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-[#F4F2F7] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === levels.length - 1} className="w-7 h-7 rounded flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-[#F4F2F7] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
            <button type="button" onClick={() => remove(lvl.id)} disabled={levels.length === 1} className="w-7 h-7 rounded flex items-center justify-center text-ink-400 hover:text-risk-700 hover:bg-risk-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"><Trash2 size={14} /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[0.6875rem] font-semibold text-ink-600 mb-1 block">Approver(s)</label>
              <UserMultiSelect users={users} selectedIds={lvl.assigneeIds} onChange={ids => update(lvl.id, { assigneeIds: ids })} />
            </div>
            <div className="col-span-2">
              <label className="text-[0.6875rem] font-semibold text-ink-600 mb-1 block">Approval mode</label>
              <select
                value={lvl.mode}
                onChange={e => update(lvl.id, { mode: e.target.value as ApprovalMode })}
                className="w-full h-9 px-2.5 bg-canvas-elevated border border-canvas-border rounded-md text-[0.78125rem] text-ink-800 focus:outline-none focus:border-brand-600 cursor-pointer"
              >
                {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <label className="col-span-2 flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={lvl.allowSendBack} onChange={e => update(lvl.id, { allowSendBack: e.target.checked })} className="w-4 h-4 accent-brand-600 cursor-pointer" />
              <span className="text-[0.78125rem] text-ink-700">Allow this level to send the case back to the previous level</span>
            </label>
          </div>
        </div>
      ))}

      <button type="button" onClick={add} className="w-full h-10 inline-flex items-center justify-center gap-1.5 text-[0.78125rem] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-md cursor-pointer transition-colors">
        <Plus size={14} /> Add approval level
      </button>
    </div>
  );
}
