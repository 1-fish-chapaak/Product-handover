import { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, GitBranch, AlertTriangle, UserPlus } from 'lucide-react';
import { useWorkflow } from './WorkflowContext';
import { usersForPersona, buildDefaultPermissions, userById } from './workflowData';
import { userInApprovalChain } from './workflowEngine';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { useToast } from '../../shared/Toast';
import { UserSelect } from './UserPicker';
import ColumnPermissionMatrix from './ColumnPermissionMatrix';
import WorkflowPipelineView from './WorkflowPipelineView';
import { CustomDatePicker } from '../../shared/CustomDatePicker';
import type { ColumnPermission } from './workflowTypes';

/** Assign selected exceptions through a workflow with column-level RBAC.
 *  Invoked from the Exceptions table; reads the selected ids from context. */
export default function AssignmentModal() {
  const { assignmentModalIds, closeAssignment, templates, role, createAssignments, currentUserId } = useWorkflow();
  const { addToast } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, !!assignmentModalIds, closeAssignment);

  const ids = assignmentModalIds ?? [];
  const myTemplates = useMemo(() => templates.filter(t => t.persona === role), [templates, role]);
  const [workflowId, setWorkflowId] = useState<string>(() => myTemplates.find(t => t.isDefault)?.id ?? myTemplates[0]?.id ?? '');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [perms, setPerms] = useState<ColumnPermission[]>(buildDefaultPermissions());
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');

  if (!assignmentModalIds) return null;
  const template = myTemplates.find(t => t.id === workflowId);
  const personaUsers = usersForPersona(role);

  // RBAC: cannot assign work to a user who also approves it in the same chain.
  const selfApproval = !!(assigneeId && template && userInApprovalChain(template.levels, assigneeId));
  const assigneeInactive = !!(assigneeId && userById(assigneeId)?.active === false);
  const visibleCount = perms.filter(p => p.visible).length;
  const canAssign = !!template && !!assigneeId && !selfApproval && !assigneeInactive && visibleCount > 0;
  const todayIso = new Date().toISOString().slice(0, 10);

  const assign = () => {
    if (!canAssign || !template || !assigneeId) return;
    createAssignments({ exceptionIds: ids, template, assigneeId, columnPermissions: perms, note: note.trim() || undefined, dueDate: dueDate || undefined, assignedBy: currentUserId });
    addToast({ type: 'success', message: `${ids.length} exception${ids.length === 1 ? '' : 's'} assigned via "${template.name}".` });
    closeAssignment();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px] z-[80]" onClick={closeAssignment} />
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[920px] max-w-[94vw] max-h-[90vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[90] flex flex-col"
        role="dialog" aria-modal="true" aria-label="Assign to approval route" tabIndex={-1}
      >
        <header className="shrink-0 px-6 py-3 flex items-center justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center"><UserPlus size={16} /></div>
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Assign to Approval Route</h2>
              <p className="text-[0.75rem] text-ink-500">{ids.length} exception{ids.length === 1 ? '' : 's'} · {role === 'auditor' ? 'Auditor' : 'Risk Owner'} side</p>
            </div>
          </div>
          <button onClick={closeAssignment} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto grid md:grid-cols-2">
          {/* Left — choices */}
          <div className="p-6 space-y-5 border-b md:border-b-0 md:border-r border-canvas-border">
            <div>
              <label className="text-[12px] font-semibold text-ink-800 mb-1.5 block">Approval Route <span className="text-risk">*</span></label>
              {myTemplates.length === 0 ? (
                <div className="text-[12px] text-mitigated-700 bg-mitigated-50 border border-mitigated/30 rounded-[8px] px-3 py-2">No approval routes for this persona yet — create one in the Route Configurator.</div>
              ) : (
                <select value={workflowId} onChange={e => setWorkflowId(e.target.value)} className="w-full h-10 px-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-900 focus:outline-none focus:border-brand-600 cursor-pointer">
                  {myTemplates.map(t => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''} · v{t.version}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="text-[12px] font-semibold text-ink-800 mb-1.5 block">Assign work to <span className="text-risk">*</span></label>
              <UserSelect users={personaUsers} value={assigneeId} onChange={setAssigneeId} placeholder="Select a team member…" />
              {selfApproval && <p className="mt-2 text-[11.5px] text-risk-700 inline-flex items-start gap-1.5"><AlertTriangle size={13} className="mt-px shrink-0" /> This user is also an approver in this route. A user can't approve their own work — pick someone else or adjust the chain.</p>}
              {assigneeInactive && <p className="mt-2 text-[11.5px] text-risk-700 inline-flex items-start gap-1.5"><AlertTriangle size={13} className="mt-px shrink-0" /> This user is deactivated. Pick an active user.</p>}
            </div>

            <div>
              <label className="text-[12px] font-semibold text-ink-800 mb-1.5 block">Instructions for assignee <span className="text-ink-400 font-normal">(optional)</span></label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="What should the assignee do?" className="w-full resize-none p-2.5 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" />
            </div>

            <div>
              <label className="text-[12px] font-semibold text-ink-800 mb-1.5 block">Assignment due date <span className="text-ink-400 font-normal">(optional)</span></label>
              <div className="w-[200px]"><CustomDatePicker value={dueDate} onChange={setDueDate} minDate={todayIso} /></div>
            </div>

            {template && (
              <div className="rounded-[10px] border border-canvas-border bg-[#FAFAFB] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500 mb-2.5">Approval chain</div>
                <WorkflowPipelineView assignment={{ id: '', exceptionId: '', workflowId: template.id, workflowName: template.name, workflowVersion: template.version, persona: template.persona, levels: template.levels, assigneeId: assigneeId ?? '', columnPermissions: [], status: 'drafting', currentLevelIndex: -1, levelStates: template.levels.map(l => ({ levelId: l.id, status: 'pending', approvals: [] })), sendBackCount: 0, assignedBy: currentUserId, assignedAt: new Date().toISOString() }} />
              </div>
            )}
          </div>

          {/* Right — column permissions */}
          <div className="p-6">
            <label className="text-[12px] font-semibold text-ink-800 mb-1.5 block">Column visibility & edit rights</label>
            <p className="text-[11.5px] text-ink-500 mb-3">The assignee sees only the columns you mark visible, and can only edit those you mark editable.</p>
            <ColumnPermissionMatrix permissions={perms} onChange={setPerms} />
            <p className="text-[11px] text-ink-400 mt-3">Exception IDs: {ids.slice(0, 6).join(', ')}{ids.length > 6 ? ` +${ids.length - 6} more` : ''}</p>
          </div>
        </div>

        <footer className="shrink-0 px-6 py-3.5 border-t border-canvas-border flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-ink-500">{visibleCount} of {perms.length} columns visible to assignee</span>
          <div className="flex items-center gap-2">
            <button onClick={closeAssignment} className="h-10 px-5 text-[12.5px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 cursor-pointer">Cancel</button>
            <button onClick={assign} disabled={!canAssign} className="h-10 px-5 inline-flex items-center gap-2 text-[12.5px] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              <GitBranch size={14} /> Assign {ids.length} to Route
            </button>
          </div>
        </footer>
      </motion.div>
    </>
  );
}
