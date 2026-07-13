import { Check, X, CornerUpLeft, Circle, Clock } from 'lucide-react';
import type { Assignment, LevelStatus } from './workflowTypes';
import { userById, userName } from './workflowData';

const MODE_LABEL: Record<string, string> = { all: 'All must approve', any: 'Any one approves', sequential: 'Sequential' };

// Plain-language "where is it right now" line, so a non-technical user can read
// the state at a glance instead of decoding the chain dots.
function positionLine(a: Assignment): { text: string; cls: string } {
  const assignee = userName(a.assigneeId);
  switch (a.status) {
    case 'approved':            return { text: 'Fully approved — complete', cls: 'bg-compliant-50 text-compliant-700' };
    case 'rejected':            return { text: `Rejected — back with ${assignee} to revise`, cls: 'bg-risk-50 text-risk-700' };
    case 'pulled-back':         return { text: 'Pulled back by the assigner', cls: 'bg-[#EEEEF1] text-ink-600' };
    case 'needs-reassignment':  return { text: 'Needs reassignment (assignee inactive)', cls: 'bg-risk-50 text-risk-700' };
    case 'escalated':           return { text: 'Escalated to the assigner', cls: 'bg-mitigated-50 text-mitigated-700' };
    case 'drafting':            return { text: `Being worked on by ${assignee}`, cls: 'bg-brand-50 text-brand-700' };
    default: {
      const lvl = a.levels[a.currentLevelIndex];
      if (!lvl) return { text: `Being worked on by ${assignee}`, cls: 'bg-brand-50 text-brand-700' };
      const approvers = lvl.assigneeIds.map(userName).join(', ');
      return { text: `Waiting on ${approvers} · ${lvl.name}`, cls: 'bg-brand-50 text-brand-700' };
    }
  }
}

const STATUS_DOT: Record<LevelStatus, { cls: string; Icon: typeof Check }> = {
  pending:       { cls: 'bg-[#EEEEF1] text-ink-500',          Icon: Circle },
  'in-progress': { cls: 'bg-brand-50 text-brand-700 ring-2 ring-brand-200', Icon: Clock },
  approved:      { cls: 'bg-compliant-50 text-compliant-700', Icon: Check },
  rejected:      { cls: 'bg-risk-50 text-risk-700',           Icon: X },
  'sent-back':   { cls: 'bg-mitigated-50 text-mitigated-700', Icon: CornerUpLeft },
};

function Avatar({ id }: { id: string }) {
  const u = userById(id);
  return (
    <span
      title={u ? `${u.name} · ${u.role}` : id}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[0.5625rem] font-semibold ${u?.active === false ? 'bg-risk-50 text-risk-700' : 'bg-brand-50 text-brand-700'}`}
    >
      {u?.initials ?? '?'}
    </span>
  );
}

/** Read-only view of an assignment's approval chain + current position. */
export default function WorkflowPipelineView({ assignment }: { assignment: Assignment }) {
  const pos = positionLine(assignment);
  return (
    <div className="flex flex-col gap-2">
      {/* Plain-language current position — "what's pending and where". */}
      <div className={`inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold ${pos.cls} mb-1`}>
        {pos.text}
      </div>

      {/* Assignee (drafting) node */}
      <div className="flex items-center gap-2.5">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${assignment.currentLevelIndex < 0 && assignment.status !== 'approved' ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-200' : 'bg-compliant-50 text-compliant-700'}`}>
          {assignment.currentLevelIndex < 0 && assignment.status !== 'approved' ? <Clock size={12} /> : <Check size={12} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[0.75rem] font-semibold text-ink-800">Assignee · drafting</div>
          <div className="text-[0.6875rem] text-ink-500">{userById(assignment.assigneeId)?.name ?? assignment.assigneeId}</div>
        </div>
      </div>

      {assignment.levels.map((lvl, i) => {
        const st = assignment.levelStates[i];
        const dot = STATUS_DOT[st?.status ?? 'pending'];
        return (
          <div key={lvl.id} className="flex items-center gap-2.5">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${dot.cls}`}>
              <dot.Icon size={12} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.75rem] font-semibold text-ink-800">{lvl.name}</span>
                <span className="text-[0.625rem] text-ink-500">· {MODE_LABEL[lvl.mode]}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {lvl.assigneeIds.map(id => <Avatar key={id} id={id} />)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
