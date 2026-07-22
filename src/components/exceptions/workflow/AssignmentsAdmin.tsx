import { useState } from 'react';
import { ClipboardList, RotateCcw, Undo2, AlertTriangle, X } from 'lucide-react';
import type { GrcException } from '../../../data/mockData';
import type { Persona, AssignmentStatus } from './workflowTypes';
import { useWorkflow } from './WorkflowContext';
import { currentLevel } from './workflowEngine';
import { usersForPersona, userName } from './workflowData';
import { UserSelect } from './UserPicker';
import SLABadge from './SLABadge';

const STATUS_STYLE: Record<AssignmentStatus, { cls: string; label: (lvl?: string) => string }> = {
  drafting:            { cls: 'bg-mitigated-50 text-mitigated-700', label: () => 'Drafting' },
  'in-approval':       { cls: 'bg-brand-50 text-brand-700',         label: l => `In approval · ${l ?? ''}` },
  approved:            { cls: 'bg-compliant-50 text-compliant-700', label: () => 'Approved' },
  rejected:            { cls: 'bg-risk-50 text-risk-700',           label: () => 'Rejected' },
  'needs-reassignment':{ cls: 'bg-risk-50 text-risk-700',           label: () => 'Needs reassignment' },
  'pulled-back':       { cls: 'bg-[#EEEEF1] text-ink-600',          label: () => 'Pulled back' },
  escalated:           { cls: 'bg-high-50 text-high-700',           label: () => 'Escalated' },
};

/** Assigner's control panel — all in-flight assignments for this persona with
 *  pull-back, reassignment and the deactivated-assignee flag. */
export default function AssignmentsAdmin({ role, exceptions }: { role: Persona; exceptions: GrcException[] }) {
  const { assignments, reassign, pullBack } = useWorkflow();
  const mine = assignments.filter(a => a.persona === role);
  const [reassigning, setReassigning] = useState<string | null>(null);
  const exById = (id: string) => exceptions.find(e => e.id === id);

  if (mine.length === 0) {
    return (
      <div className="border border-dashed border-canvas-border rounded-lg p-10 text-center">
        <ClipboardList size={22} className="text-ink-300 mx-auto mb-2" />
        <p className="text-[0.8125rem] font-semibold text-ink-700">No assignments yet</p>
        <p className="text-[0.75rem] text-ink-500 mt-1">Select exceptions in the Exceptions tab and click "Assign Approval Flow".</p>
      </div>
    );
  }

  return (
    <div className="border border-canvas-border rounded-lg bg-canvas-elevated overflow-hidden">
      <div className="grid grid-cols-[120px_1fr_160px_180px_auto] gap-3 px-4 py-2.5 bg-[#FAFAFB] border-b border-canvas-border text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-400">
        <span>Exception</span><span>Approval Route</span><span>Assignee</span><span>Status</span><span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-canvas-border">
        {mine.map(a => {
          const ex = exById(a.exceptionId);
          const lvl = currentLevel(a);
          const st = STATUS_STYLE[a.status];
          const active = a.status === 'drafting' || a.status === 'in-approval' || a.status === 'needs-reassignment';
          return (
            <div key={a.id} className="grid grid-cols-[120px_1fr_160px_180px_auto] gap-3 px-4 py-3 items-center">
              <span className="font-mono text-[0.78125rem] font-semibold text-brand-700">{a.exceptionId}</span>
              <span className="text-[0.78125rem] text-ink-700 truncate" title={ex?.title}>{a.workflowName} <span className="text-ink-400">v{a.workflowVersion}</span></span>
              <span className="text-[0.78125rem] text-ink-800 truncate">{userName(a.assigneeId)}</span>
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 h-6 px-2.5 text-[0.6875rem] font-semibold rounded-full ${st.cls}`}>
                  {a.status === 'needs-reassignment' && <AlertTriangle size={10} />}
                  {st.label(lvl?.name)}
                </span>
                {a.status === 'in-approval' && lvl && <SLABadge startIso={a.assignedAt} slaHours={lvl.slaHours} compact />}
              </span>
              <span className="flex items-center justify-end gap-1">
                {active && (
                  <button onClick={() => setReassigning(reassigning === a.id ? null : a.id)} title="Reassign" className="w-7 h-7 rounded flex items-center justify-center text-ink-400 hover:text-brand-700 hover:bg-brand-50 cursor-pointer"><RotateCcw size={13} /></button>
                )}
                {(a.status === 'drafting' || a.status === 'in-approval') && (
                  <button onClick={() => pullBack(a.id)} title="Pull back" className="w-7 h-7 rounded flex items-center justify-center text-ink-400 hover:text-mitigated-700 hover:bg-mitigated-50 cursor-pointer"><Undo2 size={13} /></button>
                )}
              </span>

              {reassigning === a.id && (
                <div className="col-span-5 mt-1 mb-1 flex items-center gap-2 bg-[#FAFAFB] border border-canvas-border rounded-md p-2">
                  <span className="text-[0.71875rem] font-semibold text-ink-600 px-1">Reassign to</span>
                  <div className="w-[260px]"><UserSelect users={usersForPersona(role)} value={null} onChange={(id) => { reassign(a.id, id); setReassigning(null); }} placeholder="Pick a user…" /></div>
                  <button onClick={() => setReassigning(null)} className="w-7 h-7 rounded flex items-center justify-center text-ink-400 hover:bg-[#F4F2F7] cursor-pointer"><X size={14} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
