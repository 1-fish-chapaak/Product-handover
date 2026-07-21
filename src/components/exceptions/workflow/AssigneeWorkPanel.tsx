import { useState } from 'react';
import { Send, Inbox, Lock, MessageSquare, Calendar, RotateCcw } from 'lucide-react';
import type { GrcException } from '../../../data/mockData';
import type { Assignment } from './workflowTypes';
import { useWorkflow } from './WorkflowContext';
import { assignmentsForAssignee } from './workflowEngine';
import { userById, userName } from './workflowData';
import { cellDisplay, CLASSIFICATION_OPTIONS, ACTIONABLE_CLASSIFICATIONS } from './exceptionCells';
import WorkflowPipelineView from './WorkflowPipelineView';
import { useToast } from '../../shared/Toast';
import { CustomDatePicker } from '../../shared/CustomDatePicker';

/** The view an assigned team member sees: only their assignments, only the
 *  columns granted, editable per the assigner's configuration. */
export default function AssigneeWorkPanel({ exceptions }: { exceptions: GrcException[] }) {
  const { currentUserId, assignments } = useWorkflow();
  const mine = assignmentsForAssignee(assignments, currentUserId);
  const exById = (id: string) => exceptions.find(e => e.id === id);

  if (mine.length === 0) {
    return (
      <div className="border border-dashed border-canvas-border rounded-lg p-10 text-center">
        <Inbox size={22} className="text-ink-300 mx-auto mb-2" />
        <p className="text-[0.8125rem] font-semibold text-ink-700">No work assigned to {userName(currentUserId)}</p>
        <p className="text-[0.75rem] text-ink-500 mt-1">Switch "Acting as" to a user who has assignments, or assign exceptions from the Exceptions tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mine.map(a => {
        const ex = exById(a.exceptionId);
        if (!ex) return null;
        return <WorkCard key={a.id} assignment={a} ex={ex} />;
      })}
    </div>
  );
}

export function WorkCard({ assignment, ex }: { assignment: Assignment; ex: GrcException }) {
  const { submitForApproval, updateDraft } = useWorkflow();
  const { addToast } = useToast();
  const [draft, setDraft] = useState(assignment.draft ?? {});

  const visible = assignment.columnPermissions.filter(p => p.visible);
  const isEditable = (key: string) => assignment.columnPermissions.find(p => p.key === key)?.editable ?? false;
  const rejected = assignment.status === 'rejected';

  const setField = (patch: Partial<typeof draft>) => { const next = { ...draft, ...patch }; setDraft(next); updateDraft(assignment.id, next); };

  // Submit gating: any editable classification/dueDate the assigner granted must be filled.
  const needsClassification = isEditable('classification');
  const needsDue = isEditable('dueDate');
  const classification = draft.classification ?? '';
  const showActionPlan = ACTIONABLE_CLASSIFICATIONS.has(classification);
  const canSubmit =
    (!needsClassification || !!classification) &&
    (!needsDue || !!draft.dueDate) &&
    (!showActionPlan || (!!draft.actionName && !!draft.actionDetails));

  return (
    <div className="border border-canvas-border rounded-lg bg-canvas-elevated overflow-hidden">
      <div className="px-5 py-3.5 border-b border-canvas-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[0.8125rem] font-semibold text-brand-700">{ex.id}</span>
          <span className="text-[0.78125rem] text-ink-700 truncate max-w-[420px]">{ex.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.6875rem] text-ink-500">via {assignment.workflowName}</span>
          {assignment.dueDate && <span className="inline-flex items-center gap-1 h-6 px-2 text-[0.6875rem] text-ink-700 bg-[#FAFAFB] border border-canvas-border rounded-full"><Calendar size={10} /> {assignment.dueDate}</span>}
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_240px]">
        <div className="p-5 space-y-4">
          {assignment.note && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-brand-50/40 border border-brand-100 rounded-md">
              <MessageSquare size={13} className="text-brand-700 mt-0.5 shrink-0" />
              <div className="text-[0.75rem] text-ink-700"><span className="font-semibold text-brand-700">{userName(assignment.assignedBy)}:</span> {assignment.note}</div>
            </div>
          )}
          {rejected && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-risk-50 border border-risk/30 rounded-md">
              <RotateCcw size={13} className="text-risk-700 mt-0.5 shrink-0" />
              <div className="text-[0.75rem] text-risk-700">Returned for revision. Update and resubmit.</div>
            </div>
          )}

          {/* Granted columns — read-only display */}
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            {visible.filter(p => !(isEditable(p.key) && (p.key === 'classification' || p.key === 'dueDate'))).map(p => (
              <div key={p.key}>
                <div className="text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-400 mb-0.5 flex items-center gap-1"><Lock size={9} /> {p.label}</div>
                <div className="text-[0.78125rem] text-ink-800">{cellDisplay(ex, p.key)}</div>
              </div>
            ))}
          </div>

          {/* Editable work fields (only those granted editable) */}
          {(needsClassification || needsDue) && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              {needsClassification && (
                <div>
                  <label className="text-[0.75rem] font-semibold text-ink-800 mb-1.5 block">Classification <span className="text-risk">*</span></label>
                  <select value={classification} onChange={e => setField({ classification: e.target.value })} className="w-full h-9 px-2.5 bg-canvas-elevated border border-canvas-border rounded-md text-[0.78125rem] text-ink-900 focus:outline-none focus:border-brand-600 cursor-pointer">
                    <option value="">Select…</option>
                    {CLASSIFICATION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {needsDue && (
                <div>
                  <label className="text-[0.75rem] font-semibold text-ink-800 mb-1.5 block">Action Due Date <span className="text-risk">*</span></label>
                  <CustomDatePicker value={draft.dueDate ?? ''} onChange={v => setField({ dueDate: v })} minDate={new Date().toISOString().slice(0, 10)} />
                </div>
              )}
            </div>
          )}

          {showActionPlan && (
            <div className="space-y-3 border-t border-dashed border-canvas-border pt-3">
              <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">Action Plan</div>
              <input value={draft.actionName ?? ''} onChange={e => setField({ actionName: e.target.value })} placeholder="Action name *" className="w-full h-9 px-2.5 bg-canvas-elevated border border-canvas-border rounded-md text-[0.78125rem] focus:outline-none focus:border-brand-600" />
              <textarea value={draft.actionDetails ?? ''} onChange={e => setField({ actionDetails: e.target.value })} rows={2} placeholder="Action details — remediation steps, evidence *" className="w-full resize-none p-2.5 bg-canvas-elevated border border-canvas-border rounded-md text-[0.78125rem] focus:outline-none focus:border-brand-600" />
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[0.6875rem] text-ink-400">Next: {assignment.levels[0] ? `${assignment.levels[0].name} (${userById(assignment.levels[0].assigneeIds[0])?.name ?? '—'})` : '—'}</span>
            <button
              onClick={() => { submitForApproval(assignment.id, draft); addToast({ type: 'success', message: `${ex.id} submitted for approval.` }); }}
              disabled={!canSubmit}
              className="h-9 px-4 inline-flex items-center gap-1.5 text-[0.78125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={13} /> Submit for Approval
            </button>
          </div>
        </div>

        {/* Chain */}
        <div className="p-5 bg-[#FAFAFB] border-t md:border-t-0 md:border-l border-canvas-border">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500 mb-3">Approval chain</div>
          <WorkflowPipelineView assignment={assignment} />
        </div>
      </div>
    </div>
  );
}
