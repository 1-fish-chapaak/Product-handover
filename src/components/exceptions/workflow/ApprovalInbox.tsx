import { Inbox, MessageSquare, ArrowRight } from 'lucide-react';
import type { GrcException } from '../../../data/mockData';
import type { Assignment } from './workflowTypes';
import { useWorkflow } from './WorkflowContext';
import { pendingApprovalsForUser, currentLevel, canAct } from './workflowEngine';
import { userName } from './workflowData';
import { cellDisplay } from './exceptionCells';
import SLABadge from './SLABadge';
import WorkflowPipelineView from './WorkflowPipelineView';
import ApprovalActionBar from './ApprovalActionBar';
import { useToast } from '../../shared/Toast';

/** A single pending-approval card — the data the assignee saw, the drafted
 *  result, prior comments, the Approve / Reject / Send-back bar, and the chain.
 *  Exported so the case detail drawer can render the very same surface inline. */
export function ApprovalCard({ assignment: a, ex, onDone }: { assignment: Assignment; ex: GrcException; onDone?: () => void }) {
  const { currentUserId, decide } = useWorkflow();
  const { addToast } = useToast();
  const lvl = currentLevel(a);
  if (!lvl) return null;
  const reason = canAct(a, currentUserId).reason;
  const priorComments = a.levelStates
    .slice(0, a.currentLevelIndex)
    .flatMap((s, i) => s.approvals.map(ap => ({ level: a.levels[i].name, by: userName(ap.userId), comment: ap.comment })))
    .filter(c => c.comment);
  const visible = a.columnPermissions.filter(p => p.visible);

  return (
    <div className="border border-canvas-border rounded-[12px] bg-canvas-elevated overflow-hidden">
      <div className="px-5 py-3.5 border-b border-canvas-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[13px] font-semibold text-brand-700">{ex.id}</span>
          <span className="text-[12.5px] text-ink-700 truncate max-w-[360px]">{ex.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center h-6 px-2.5 text-[11px] font-semibold bg-brand-50 text-brand-700 rounded-full">{lvl.name}</span>
          <SLABadge startIso={a.assignedAt} slaHours={lvl.slaHours} />
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_240px]">
        <div className="p-5 space-y-4">
          <div className="text-[11.5px] text-ink-500">Assigned by <span className="font-semibold text-ink-700">{userName(a.assignedBy)}</span> · worked by <span className="font-semibold text-ink-700">{userName(a.assigneeId)}</span> · {a.workflowName} v{a.workflowVersion}</div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
            {visible.map(p => (
              <div key={p.key}>
                <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400 mb-0.5">{p.label}</div>
                <div className="text-[12.5px] text-ink-800">{cellDisplay(ex, p.key)}</div>
              </div>
            ))}
          </div>

          {a.draft && (a.draft.classification || a.draft.actionName || a.draft.actionReview) && (
            <div className="rounded-[8px] border border-canvas-border bg-[#FAFAFB] p-3 space-y-1.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-500">Submitted by assignee</div>
              {a.draft.classification && <div className="text-[12px] text-ink-800"><span className="text-ink-500">Classification:</span> {a.draft.classification}</div>}
              {a.draft.actionName && <div className="text-[12px] text-ink-800"><span className="text-ink-500">Action:</span> {a.draft.actionName}{a.draft.dueDate ? ` · due ${a.draft.dueDate}` : ''}</div>}
              {a.draft.actionDetails && <div className="text-[12px] text-ink-700">{a.draft.actionDetails}</div>}
              {a.draft.actionReview && <div className="text-[12px] text-ink-800"><span className="text-ink-500">Review:</span> {a.draft.actionReview}{a.draft.actionStatus ? ` · ${a.draft.actionStatus}` : ''}</div>}
            </div>
          )}

          {priorComments.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-500">Prior approvals</div>
              {priorComments.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px]">
                  <MessageSquare size={12} className="text-ink-400 mt-0.5 shrink-0" />
                  <div><span className="font-semibold text-ink-700">{c.by}</span> <span className="text-ink-400">· {c.level}</span><div className="text-ink-700">{c.comment}</div></div>
                </div>
              ))}
            </div>
          )}

          <ApprovalActionBar
            canSendBack={lvl.allowSendBack}
            disabledReason={reason}
            onDecide={(decision, comment) => {
              decide(a.id, currentUserId, decision, comment);
              addToast({ type: decision === 'approve' ? 'success' : 'info', message: `${ex.id}: ${decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'sent back'}.` });
              onDone?.();
            }}
          />
        </div>

        <div className="p-5 bg-[#FAFAFB] border-t md:border-t-0 md:border-l border-canvas-border">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500 mb-3 flex items-center gap-1">Chain <ArrowRight size={11} /></div>
          <WorkflowPipelineView assignment={a} />
        </div>
      </div>
    </div>
  );
}

/** Inbox for any user sitting at L1/L2/L3 — pending items with full context,
 *  SLA countdown, prior comments, and Approve / Reject / Send-back actions. */
export default function ApprovalInbox({ exceptions }: { exceptions: GrcException[] }) {
  const { currentUserId, assignments } = useWorkflow();
  const pending = pendingApprovalsForUser(assignments, currentUserId);
  const exById = (id: string) => exceptions.find(e => e.id === id);

  if (pending.length === 0) {
    return (
      <div className="border border-dashed border-canvas-border rounded-[12px] p-10 text-center">
        <Inbox size={22} className="text-ink-300 mx-auto mb-2" />
        <p className="text-[13px] font-semibold text-ink-700">Nothing awaiting {userName(currentUserId)}</p>
        <p className="text-[12px] text-ink-500 mt-1">Switch "Acting as" to an approver in an active route to see pending items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.map(a => {
        const ex = exById(a.exceptionId);
        if (!ex) return null;
        return <ApprovalCard key={a.id} assignment={a} ex={ex} />;
      })}
    </div>
  );
}
