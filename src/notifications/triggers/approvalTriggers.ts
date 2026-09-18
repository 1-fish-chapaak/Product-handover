// ─── Approval chains → notifications ───
// Derived from an Assignment's before → after state, so every path through the
// chain (single approve, bulk review, hand-off to the auditor phase, final
// sign-off, rejection, reassignment) notifies the same way.

import type { Assignment } from '../../components/exceptions/workflow/workflowTypes';
import { userName } from '../../components/exceptions/workflow/workflowData';
import type { NotifyInput, Person } from '../types';
import { ROSTER } from './caseTriggers';

const link = (exceptionId: string) => ({ view: 'manage-exceptions' as const, ref: { kind: 'exception' as const, id: exceptionId } });
const person = (id: string, role: string): Person => ({ name: userName(id), role });
const itemRef = (a: Assignment) => `${a.exceptionId} · ${a.actionCycle ? 'action taken' : 'classification / plan'}`;
const chainName = (a: Assignment) => (a.auditorPhase ? 'Auditor' : 'RO');

/** People who approved so far in the current cycle (for "prior approvers"). */
function priorApprovers(a: Assignment): Person[] {
  const ids = new Set<string>();
  a.levelStates.forEach(ls => ls.approvals.filter(x => x.decision === 'approve').forEach(x => ids.add(x.userId)));
  return Array.from(ids).map(id => person(id, 'Prior approver'));
}

function requestAtLevel(a: Assignment, submitterName: string, roDecided?: string): NotifyInput | null {
  const lvl = a.levels[a.currentLevelIndex];
  if (!lvl) return null;
  const auditor = !!a.auditorPhase;
  const total = a.levels.length;
  const draftComment = a.actionCycle ? a.draft?.actionTaken : a.draft?.actionDetails;
  return {
    eventId: auditor ? 'APR-02' : 'APR-01',
    title: `Approval requested — ${chainName(a)} chain level ${a.currentLevelIndex + 1}`,
    actor: submitterName,
    message: `${submitterName} submitted ${a.actionCycle ? 'the action taken' : `the classification${a.draft?.classification ? ` (${a.draft.classification})` : ''} and plan`} for ${a.exceptionId}. ${auditor && roDecided ? `${roDecided} ` : ''}Level ${a.currentLevelIndex + 1} of ${total} in the ${chainName(a)} chain is with you.`,
    facts: [
      { label: 'Approving', value: a.actionCycle ? 'Action taken' : 'Classification & action plan' },
      { label: 'Item', value: a.exceptionId },
      { label: 'Chain / level', value: `${chainName(a)} · Level ${a.currentLevelIndex + 1} of ${total} — ${lvl.name}` },
      { label: 'Submitter', value: submitterName },
      ...(auditor && roDecided ? [{ label: 'RO chain', value: roDecided }] : []),
      ...(lvl.slaHours ? [{ label: 'SLA', value: `${lvl.slaHours}h` }] : []),
    ],
    quoted: draftComment ? { by: submitterName, text: draftComment } : undefined,
    recipients: lvl.assigneeIds.map(id => person(id, `Level ${a.currentLevelIndex + 1} approver`)),
    watchers: [{ name: submitterName, role: 'Submitter' }],
    link: link(a.exceptionId), linkLabel: 'Decide', operationKey: `${a.id}:${a.currentLevelIndex}:${auditor ? 'aud' : 'ro'}`, itemLabel: itemRef(a),
  };
}

export function approvalNotifications(prev: Assignment | undefined, next: Assignment, operationKey: string): NotifyInput[] {
  const out: NotifyInput[] = [];
  const submitterName = userName(next.assigneeId);
  const submitter: Person = { name: submitterName, role: 'Submitter' };
  const planOwner: Person = { name: submitterName, role: 'Plan owner' };

  // Reassigned / delegated (APR-07)
  if (prev && prev.assigneeId !== next.assigneeId) {
    out.push({
      eventId: 'APR-07', title: `${userName(prev.assignedBy)} reassigned ${next.exceptionId} to you`, actor: userName(prev.assignedBy),
      message: `You inherit the work on ${next.exceptionId} (“${next.workflowName}”) from ${userName(prev.assigneeId)}. The approval chain restarts from drafting.`,
      facts: [{ label: 'Delegating approver', value: userName(prev.assignedBy) }, { label: 'Inherited', value: `1 item · ${next.exceptionId}` }, { label: 'Route', value: next.workflowName }, { label: 'Previous assignee', value: userName(prev.assigneeId) }],
      recipients: [person(next.assigneeId, 'Delegate')], watchers: [person(prev.assigneeId, 'Original assignee'), ROSTER.engagementOwner],
      link: link(next.exceptionId), linkLabel: 'Open approval queue', operationKey,
    });
    return out;
  }

  const enteredApproval = next.status === 'in-approval' && (!prev || prev.status !== 'in-approval' || prev.actionCycle !== next.actionCycle);
  const levelAdvanced = !!prev && prev.status === 'in-approval' && next.status === 'in-approval' && (next.currentLevelIndex > prev.currentLevelIndex || (!prev.auditorPhase && !!next.auditorPhase));

  if (enteredApproval) {
    const req = requestAtLevel(next, submitterName);
    if (req) out.push(req);
  } else if (levelAdvanced) {
    // Who just approved: the latest approval recorded.
    const approvals = next.levelStates.flatMap(ls => ls.approvals).sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
    const approver = approvals[0] ? userName(approvals[0].userId) : 'An approver';
    const remaining = next.levels.length - next.currentLevelIndex;
    out.push({
      eventId: 'APR-03', title: `${prev!.auditorPhase ? 'Auditor' : 'RO'} chain level ${prev!.currentLevelIndex + 1} approved on ${next.exceptionId}`, actor: approver,
      message: `${approver} approved. ${remaining} level${remaining === 1 ? '' : 's'} remain in the ${chainName(next)} chain.`,
      facts: [{ label: 'Completed', value: `${prev!.auditorPhase ? 'Auditor' : 'RO'} · Level ${prev!.currentLevelIndex + 1}` }, { label: 'Approver', value: approver }, { label: 'Remaining', value: `${remaining} in ${chainName(next)} chain` }],
      recipients: next.levels[next.currentLevelIndex]?.assigneeIds.map(id => person(id, 'Next approver')) ?? [], watchers: [submitter],
      link: link(next.exceptionId), linkLabel: 'Open chain', dedupKey: `sub:${submitterName}`,
    });
    const roDecided = !prev!.auditorPhase && next.auditorPhase ? `The RO chain approved (${priorApprovers(prev!).map(p => p.name).join(', ') || 'all levels'}).` : undefined;
    const req = requestAtLevel(next, submitterName, roDecided);
    if (req) out.push(req);
  }

  // Rejected / sent back (APR-04)
  if (prev && prev.status === 'in-approval' && next.status === 'rejected') {
    const approvals = next.levelStates.flatMap(ls => ls.approvals).sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
    const rej = approvals.find(x => x.decision === 'reject') ?? approvals[0];
    const rejecter = rej ? userName(rej.userId) : 'An approver';
    const prior = priorApprovers(prev).filter(p => p.name !== rejecter);
    out.push({
      eventId: 'APR-04', title: `Rejected at ${chainName(prev)} level ${prev.currentLevelIndex + 1} — ${next.exceptionId} back to ${next.actionCycle ? 'In-Progress' : 'Open'}`, actor: rejecter,
      message: `${rejecter} rejected ${next.actionCycle ? 'the action taken' : 'the classification / plan'}. ${prior.length ? `${prior.length} prior approval${prior.length === 1 ? '' : 's'} (${prior.map(p => p.name).join(', ')}) ${prior.length === 1 ? 'has' : 'have'} been undone; ` : ''}prior work is preserved.`,
      facts: [{ label: 'Item', value: next.exceptionId }, { label: 'Level', value: `${chainName(prev)} · Level ${prev.currentLevelIndex + 1}` }, { label: 'Reverted', value: `${next.actionCycle ? 'In-Progress' : 'Open'} · ${prior.length} prior approval${prior.length === 1 ? '' : 's'} undone` }],
      quoted: { by: rejecter, text: rej?.comment || 'Rejected — see the case activity log.' },
      recipients: [submitter], watchers: [...prior, planOwner, ROSTER.engagementOwner],
      link: link(next.exceptionId), linkLabel: 'Open exception',
    });
  }

  // Final approval (APR-05)
  if (prev && prev.status !== 'approved' && next.status === 'approved') {
    const history = next.levelStates.flatMap((ls, i) => ls.approvals.map(x => `${next.levels[i]?.name ?? `L${i + 1}`}: ${userName(x.userId)} · ${new Date(x.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`));
    out.push({
      eventId: 'APR-05', title: `Final approval completed on ${next.exceptionId}`, actor: history.length ? userName(next.levelStates.flatMap(ls => ls.approvals).slice(-1)[0]?.userId ?? '') : 'System',
      message: `Both chains are complete for ${next.exceptionId}. Next step: ${next.actionCycle ? 'the case is Closed' : 'implement the management action plan and record the action taken'}.`,
      facts: [{ label: 'Item', value: itemRef(next) }, ...history.map((h, i) => ({ label: i === 0 ? 'Decisions' : ' ', value: h })), { label: 'Next', value: next.actionCycle ? 'Closed' : 'Action plan → action taken' }],
      recipients: [submitter, planOwner], watchers: [ROSTER.engagementOwner, ROSTER.engagementAuditor],
      link: link(next.exceptionId), linkLabel: 'Open case', operationKey: `final-${operationKey}`, itemLabel: itemRef(next),
    });
  }

  return out;
}
