import { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, GitBranch, UserPlus, Plus, Trash2 } from 'lucide-react';
import { useWorkflow } from './WorkflowContext';
import { buildDefaultPermissions } from './workflowData';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { useToast } from '../../shared/Toast';
import WorkflowPipelineView from './WorkflowPipelineView';

/** Assign selected exceptions through a workflow with column-level RBAC.
 *  Invoked from the Exceptions table; reads the selected ids from context. */
export default function AssignmentModal() {
  const { assignmentModalIds, closeAssignment, templates, role, assignments, auditorRoutes, createAssignments, attachAuditorRoute, removeAssignments, currentUserId } = useWorkflow();
  const { addToast } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, !!assignmentModalIds, closeAssignment);

  const ids = assignmentModalIds ?? [];
  // Only the current side's routes are selectable — the Risk Owner screen shows
  // Risk Owner routes, the Auditor screen shows Auditor routes.
  const sideTemplates = useMemo(() => templates.filter(t => t.persona === role), [templates, role]);
  // Start unselected so the user is asked to pick a flow first ('' = none).
  const [workflowId, setWorkflowId] = useState<string>('');
  // Column permissions default to all-visible — the assignment still carries them,
  // but they're no longer configured in this modal.
  const perms = buildDefaultPermissions();

  if (!assignmentModalIds) return null;
  // Only honour a selection that belongs to the CURRENT side; otherwise stay empty.
  const effectiveWorkflowId = sideTemplates.some(t => t.id === workflowId) ? workflowId : '';
  const template = templates.find(t => t.id === effectiveWorkflowId);

  // Do the selected cases already carry a flow on this side? Drives the Remove option.
  const alreadyAssigned = role === 'auditor'
    ? ids.some(id => !!auditorRoutes[id])
    : assignments.some(a => a.persona === 'risk-owner' && ids.includes(a.exceptionId));

  const createNewFlow = () => {
    window.dispatchEvent(new CustomEvent('app:navigate-view', { detail: { view: 'engagements', engTab: 'approval-flow' } }));
    closeAssignment();
  };

  const removeFlow = () => {
    removeAssignments(ids, role);
    addToast({ type: 'success', message: `Approval flow removed from ${ids.length} case${ids.length === 1 ? '' : 's'}.` });
    closeAssignment();
  };

  // The work-assignee is no longer picked here — a Risk Owner route uses whoever
  // the case is assigned to (the "Assigned to" column); an Auditor route is a pure
  // approval chain. So the modal just needs a valid flow selected.
  const isAuditorSide = (template?.persona ?? role) === 'auditor';
  const canAssign = !!template;

  const assign = () => {
    if (!canAssign || !template) return;
    if (isAuditorSide) {
      // Auditor route attaches onto the case's existing record (one record) — it
      // runs as the Auditor phase after the Risk Owner approvals complete.
      attachAuditorRoute({ exceptionIds: ids, template, assignedBy: currentUserId });
      addToast({ type: 'success', message: `Auditor route "${template.name}" attached to ${ids.length} case${ids.length === 1 ? '' : 's'} — runs after Risk Owner approvals.` });
    } else {
      // assigneeId is a fallback; createAssignments uses the case's assignee.
      createAssignments({ exceptionIds: ids, template, assigneeId: currentUserId, columnPermissions: perms, assignedBy: currentUserId });
      addToast({ type: 'success', message: `${ids.length} exception${ids.length === 1 ? '' : 's'} assigned via "${template.name}".` });
    }
    closeAssignment();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px] z-[80]" onClick={closeAssignment} />
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[920px] max-w-[94vw] max-h-[90vh] bg-canvas-elevated rounded-xl shadow-xl border border-canvas-border z-[90] flex flex-col"
        role="dialog" aria-modal="true" aria-label="Assign approval flow" tabIndex={-1}
      >
        <header className="shrink-0 px-6 py-3 flex items-center justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center"><UserPlus size={16} /></div>
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Assign Approval Flow</h2>
              <p className="text-[0.75rem] text-ink-500">{ids.length} exception{ids.length === 1 ? '' : 's'} · {role === 'auditor' ? 'Auditor' : 'Risk Owner'} side</p>
            </div>
          </div>
          <button onClick={closeAssignment} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto grid md:grid-cols-2">
          {/* Left — choices */}
          <div className="p-6 space-y-5 border-b md:border-b-0 md:border-r border-canvas-border">
            <div>
              <label className="text-[0.75rem] font-semibold text-ink-800 mb-1.5 block">Approval Flow <span className="text-risk">*</span></label>
              <select value={effectiveWorkflowId} onChange={e => setWorkflowId(e.target.value)} className="w-full h-10 px-3 bg-canvas-elevated border border-canvas-border rounded-md text-[0.8125rem] text-ink-900 focus:outline-none focus:border-brand-600 cursor-pointer">
                <option value="" disabled>Select an approval flow…</option>
                {sideTemplates.map(t => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''} · v{t.version}</option>)}
              </select>
              {sideTemplates.length === 0 && (
                <p className="mt-1.5 text-[0.6875rem] text-mitigated-700">No {role === 'auditor' ? 'Auditor' : 'Risk Owner'} flows exist yet — create one to assign it here.</p>
              )}
              {template && (
                <p className="mt-1.5 text-[0.6875rem] text-ink-500">
                  {template.persona === 'auditor'
                    ? 'Auditor route — the Auditor lead reviews & approves first, then the team approval chain runs.'
                    : 'Risk Owner route — the assignee does the work (classify + action), then the approval chain runs.'}
                </p>
              )}

              {/* Create-new entry point — jumps to Engagements → Approval Flow. */}
              <button onClick={createNewFlow} className="mt-3 inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer">
                <Plus size={14} /> Create new approval flow
              </button>
            </div>

            {!isAuditorSide && (
              <p className="text-[0.71875rem] text-ink-500 bg-[#FAFAFB] border border-canvas-border rounded-md px-3 py-2">
                The work goes to whoever the case is <span className="font-medium text-ink-700">assigned to</span> (the Assigned to column). Assign or reassign there to change who classifies and acts.
              </p>
            )}
          </div>

          {/* Right — approval chain preview + the exceptions in scope */}
          <div className="p-6 space-y-5">
            <div>
              <div className="text-[0.75rem] font-semibold text-ink-800 mb-2">Approval chain</div>
              {template ? (
                <div className="rounded-lg border border-canvas-border bg-[#FAFAFB] p-3">
                  <WorkflowPipelineView assignment={{ id: '', exceptionId: '', workflowId: template.id, workflowName: template.name, workflowVersion: template.version, persona: template.persona, levels: template.levels, assigneeId: '', columnPermissions: [], status: 'drafting', currentLevelIndex: -1, levelStates: template.levels.map(l => ({ levelId: l.id, status: 'pending', approvals: [] })), sendBackCount: 0, assignedBy: currentUserId, assignedAt: new Date().toISOString() }} />
                </div>
              ) : (
                <p className="text-[0.75rem] text-ink-500">Pick an approval flow to preview its chain.</p>
              )}
            </div>

            <div>
              <div className="text-[0.75rem] font-semibold text-ink-800 mb-2">Exception{ids.length === 1 ? '' : 's'} being sent <span className="text-ink-400 font-normal tabular-nums">({ids.length})</span></div>
              <div className="flex flex-wrap gap-1.5">
                {ids.map(id => (
                  <span key={id} className="inline-flex items-center h-6 px-2.5 text-[0.71875rem] font-mono font-medium bg-brand-50 text-brand-700 rounded-full">{id}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="shrink-0 px-6 py-3.5 border-t border-canvas-border flex items-center justify-between gap-2">
          {alreadyAssigned ? (
            <button onClick={removeFlow} className="inline-flex items-center gap-1.5 text-[0.71875rem] font-medium text-risk-700 hover:text-risk-800 cursor-pointer">
              <Trash2 size={13} /> Remove {role === 'auditor' ? 'Auditor' : 'Risk Owner'} flow
            </button>
          ) : (
            <span className="text-[0.71875rem] text-ink-500">{ids.length} exception{ids.length === 1 ? '' : 's'} → {template?.name ?? 'select an approval flow'}</span>
          )}
          <div className="flex items-center gap-2">
            <button onClick={closeAssignment} className="h-10 px-5 text-[0.78125rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:border-brand-200 cursor-pointer">Cancel</button>
            <button onClick={assign} disabled={!canAssign} className="h-10 px-5 inline-flex items-center gap-2 text-[0.78125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              <GitBranch size={14} /> Assign Approval Flow ({ids.length})
            </button>
          </div>
        </footer>
      </motion.div>
    </>
  );
}
