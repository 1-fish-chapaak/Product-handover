// ─── Case management → notifications ───
// Derives the map's Exceptions / Action Hub events from what changed on a case
// (before → after) plus its detail record. One place, so the single drawer,
// bulk review and the approval workflow all notify identically.

import { GENERATED_REPORTS_KEY, type GrcException, type GrcCaseDetail } from '../../data/mockData';
import type { NotifyInput, Person } from '../types';

/** Who holds the standing roles in the demo engagement. */
export const ROSTER = {
  engagementOwner: { name: 'Karan Mehta', role: 'Engagement owner' } as Person,
  engagementAuditor: { name: 'Tushar Goel', role: 'Engagement auditor' } as Person,
  processOwner: { name: 'Vijay Reddy', role: 'Process owner' } as Person,
  compliance: { name: 'Sana Kapoor', role: 'Compliance' } as Person,
  systemAdmin: { name: 'Nilesh Anand', role: 'System admin' } as Person,
  roChainApprover: { name: 'Karan Mehta', role: 'RO chain approver' } as Person,
  engagementCode: 'ENG-003 · P2P Internal Audit Review',
};

/** A saved report's display name, for messages that only know its id. */
export function reportNameFor(reportId: string): string {
  try {
    const raw = localStorage.getItem(GENERATED_REPORTS_KEY);
    const list = raw ? (JSON.parse(raw) as { id: string; name?: string }[]) : [];
    return list.find(r => r.id === reportId)?.name ?? reportId;
  } catch { return reportId; }
}

const ACTIONABLE = new Set(['Design Deficiency', 'System Deficiency', 'Procedural Non-Compliance']);
const link = (id: string) => ({ view: 'manage-exceptions' as const, ref: { kind: 'exception' as const, id } });
const names = (list?: { name: string }[]) => (list ?? []).map(a => a.name);
const assignedRos = (e: GrcException): Person[] => {
  const all = e.assignees?.length ? e.assignees : e.assignedTo ? [e.assignedTo] : [];
  return all.map(a => ({ name: a.name, role: 'Risk Owner' }));
};
const lastComment = (d?: GrcCaseDetail) => d?.activityLog?.find(a => a.comment)?.comment;

export interface CaseChangeContext {
  actor: string;
  role: 'auditor' | 'risk-owner';
  /** Same for every case changed in one commit — drives rollups. */
  operationKey: string;
  /** How many cases changed in this commit (bulk when > 1). */
  bulkSize: number;
}

export function caseNotifications(prev: GrcException, next: GrcException, detail: GrcCaseDetail | undefined, ctx: CaseChangeContext): NotifyInput[] {
  const out: NotifyInput[] = [];
  const { actor, operationKey, bulkSize } = ctx;
  const bulk = bulkSize > 1;
  const ros = assignedRos(next);
  // The plan owner is the assigned RO; an unassigned case's plan belongs to
  // whoever classified it (the Risk Owner acting on it).
  const planOwner: Person = ros[0] ? { ...ros[0], role: 'Plan owner' } : { name: actor, role: 'Plan owner' };
  const engagement = { label: 'Engagement', value: ROSTER.engagementCode };
  const excFact = { label: 'Exception', value: `${next.id} · ${next.title}` };
  const planId = next.actionableId ?? `MAP-${next.id.replace(/\D/g, '').padStart(4, '0')}`;
  const planTitle = detail?.actionPlans?.[0]?.name || detail?.actionTitle || next.title;
  const planDue = detail?.actionPlans?.[0]?.dueDate || detail?.actionDueDate || next.dueDate || '—';

  // ── Assignment (EXC-03 / EXC-05 / EXC-04) ──
  const before = names(prev.assignees?.length ? prev.assignees : prev.assignedTo ? [prev.assignedTo] : []);
  const after = names(next.assignees?.length ? next.assignees : next.assignedTo ? [next.assignedTo] : []);
  const added = after.filter(n => !before.includes(n));
  const removed = before.filter(n => !after.includes(n));
  if (added.length || removed.length) {
    const inProgress = before.length > 0;
    if (!inProgress && added.length) {
      added.forEach(ro => {
        const others = after.filter(n => n !== ro);
        if (bulk) {
          out.push({
            eventId: 'EXC-05', title: `${bulkSize} exceptions assigned to you`, actor,
            message: `${actor} bulk-assigned exceptions on ${ROSTER.engagementCode.split(' · ')[0]}. Open “assigned to me” to start.`,
            facts: [{ label: 'Items', value: String(bulkSize) }, engagement, { label: 'Assigned by', value: actor }],
            recipients: [{ name: ro, role: 'Risk Owner' }], watchers: [ROSTER.engagementOwner],
            link: { view: 'manage-exceptions' }, linkLabel: 'Open “assigned to me”', operationKey: `${operationKey}:${ro}`, itemLabel: `${next.id} · ${next.title}`,
          });
        } else {
          out.push({
            eventId: 'EXC-03', title: `You were assigned ${next.id} — ${next.title}`, actor,
            message: `${actor} assigned you as Risk Owner. Severity ${next.severity} · ${next.riskCategory}${others.length ? ` · also assigned: ${others.join(', ')}` : ''}.`,
            facts: [excFact, { label: 'Severity', value: next.severity }, { label: 'Risk category', value: next.riskCategory }, engagement, { label: 'Assigned by', value: actor }, ...(others.length ? [{ label: 'Other ROs', value: others.join(', ') }] : [])],
            recipients: [{ name: ro, role: 'Risk Owner' }], watchers: [ROSTER.engagementOwner],
            link: link(next.id), linkLabel: 'Open exception', dedupKey: `assign:${ro}`, itemLabel: `${next.id} · ${next.title}`,
          });
        }
      });
    } else {
      out.push({
        eventId: 'EXC-04', title: `Assignment changed on ${next.id}`, actor,
        message: `${actor}${removed.length ? ` removed ${removed.join(', ')}` : ''}${removed.length && added.length ? ' and' : ''}${added.length ? ` added ${added.join(', ')}` : ''}. Now assigned: ${after.join(', ') || 'nobody'}.`,
        facts: [excFact, ...(removed.length ? [{ label: 'Removed', value: removed.join(', ') }] : []), ...(added.length ? [{ label: 'Added', value: added.join(', ') }] : []), { label: 'Now assigned', value: after.join(', ') || '—' }],
        recipients: [...removed.map(n => ({ name: n, role: 'Removed RO' })), ...added.map(n => ({ name: n, role: 'Added RO' }))],
        watchers: [...ros, ROSTER.engagementOwner], link: link(next.id), linkLabel: 'Open exception', dedupKey: `${next.id}:${actor}`,
      });
    }
  }

  // ── Classification (EXC-06 / ACT-12 / ACT-01) ──
  if (prev.classification !== next.classification && next.classification !== 'Unclassified') {
    const cls = next.classification;
    const actionable = ACTIONABLE.has(cls);
    const justification = detail?.classificationJustification || lastComment(detail);
    if (bulk) {
      out.push({
        eventId: 'ACT-12', title: `Bulk classification touched ${bulkSize} exceptions`, actor,
        message: `${actor} bulk-classified exceptions as ${cls}.`,
        facts: [{ label: 'Items', value: String(bulkSize) }, { label: 'Operation', value: 'Bulk classify' }, { label: 'Classification', value: cls }, { label: 'By', value: actor }],
        recipients: [planOwner], watchers: [ROSTER.engagementAuditor, ROSTER.engagementOwner],
        link: { view: 'manage-exceptions' }, linkLabel: 'Open exceptions', operationKey, itemLabel: `${next.id} · ${cls}`,
      });
    } else {
      out.push({
        eventId: 'EXC-06', title: `${next.id} classified as ${cls} — your approval is needed`, actor,
        message: `${actor} classified ${next.id} as ${cls}.${actionable ? ' Level 1 of the RO chain is with you.' : ' No action plan is required for this disposition.'}`,
        facts: [excFact, { label: 'Classification', value: cls }, { label: 'By', value: actor }],
        quoted: justification ? { by: actor, text: justification } : undefined,
        recipients: [ROSTER.roChainApprover], watchers: [ROSTER.engagementAuditor],
        link: link(next.id), linkLabel: 'Review classification', operationKey,
      });
    }
    if (actionable) {
      const plans = detail?.actionPlans?.length ? detail.actionPlans : [{ name: planTitle, details: detail?.actionDescription ?? '', dueDate: planDue }];
      plans.forEach((p, i) => out.push({
        eventId: 'ACT-01', title: `Management action plan ${planId}${plans.length > 1 ? `-${i + 1}` : ''} created for you`, actor,
        message: `“${p.name}” — due ${p.dueDate || '—'}, against ${next.id} classified ${cls}.`,
        facts: [{ label: 'Plan', value: `${planId}${plans.length > 1 ? `-${i + 1}` : ''}` }, { label: 'Due', value: p.dueDate || '—' }, { label: 'Scope', value: bulk ? `Bulk · ${bulkSize} exceptions` : `Per exception · ${next.id}` }, { label: 'Sub-classification', value: cls }, { label: 'Created by', value: actor }],
        quoted: p.details ? { by: actor, text: p.details } : undefined,
        recipients: [planOwner], watchers: [ROSTER.engagementAuditor, ROSTER.engagementOwner],
        link: link(next.id), linkLabel: 'Open plan', operationKey: `${operationKey}:${planOwner.name}`, itemLabel: p.name,
      }));
    }
  }

  // ── Plan review rejected → classification back to Open (EXC-07) ──
  if (prev.actionPhase === 'plan-review' && !next.actionPhase && next.actionReview === 'Rejected' && prev.actionReview !== 'Rejected') {
    const comment = lastComment(detail);
    out.push({
      eventId: 'EXC-07', title: `Classification rejected — ${next.id} is back to Open`, actor,
      message: `${actor} rejected the action plan at the Auditor chain. The exception has reverted to Open; your classification and plan are preserved for rework.`,
      facts: [excFact, { label: 'Chain / level', value: 'Auditor · Level 1' }, { label: 'Reverted', value: 'Plan review → Open (prior work kept)' }],
      quoted: comment ? { by: actor, text: comment } : { by: actor, text: 'Rejected — please revise the classification / plan and resubmit.' },
      recipients: ros.length ? ros : [planOwner], watchers: [planOwner, ROSTER.engagementOwner],
      link: link(next.id), linkLabel: 'Reclassify',
    });
  }

  // ── Action taken recorded (ACT-06) ──
  if (prev.actionPhase !== 'completion-review' && next.actionPhase === 'completion-review') {
    const c = detail?.completion;
    const evidence = c?.evidence?.map(e => e.name).join(', ');
    out.push({
      eventId: 'ACT-06', title: `Action taken on ${planId} — awaiting your verification`, actor,
      message: `${actor} recorded the action taken${evidence ? ` with ${c!.evidence.length} evidence file${c!.evidence.length === 1 ? '' : 's'}` : ''}${c?.selfAssessment ? ` and self-assessed it ${c.selfAssessment}` : ''}. RO chain level 1 is with you; the auditor is notified once you decide.`,
      facts: [{ label: 'Plan', value: `${planId} · ${planTitle}` }, { label: 'Covers', value: next.id }, ...(evidence ? [{ label: 'Evidence', value: evidence }] : []), { label: 'Level', value: 'RO chain · Level 1' }],
      quoted: c?.note ? { by: actor, text: c.note } : undefined,
      recipients: [ROSTER.roChainApprover], watchers: [ROSTER.engagementOwner],
      link: link(next.id), linkLabel: 'Review action taken', operationKey: `${operationKey}:${next.id}`,
    });
  }

  // ── Completion review decided (ACT-07 / ACT-08 / ACT-09) ──
  if (prev.actionPhase === 'completion-review' && next.actionPhase !== 'completion-review') {
    const comment = lastComment(detail);
    const submitter = planOwner;
    if (next.actionReview === 'Approved') {
      const partial = next.actionPhase === 'in-progress' || detail?.actionStatus === 'Partially Implemented';
      if (partial) {
        out.push({
          eventId: 'ACT-09', title: `Auditor outcome on ${planId}: Partially Implemented`, actor,
          message: `${actor} recorded Partially Implemented. Remaining work continues on ${next.id}.`,
          facts: [{ label: 'Plan', value: `${planId} · ${planTitle}` }, { label: 'Outcome', value: 'Partially Implemented' }, { label: 'Reviewed by', value: actor }, { label: 'Remaining', value: `${next.id} stays In-Progress` }],
          quoted: comment ? { by: actor, text: comment } : undefined,
          recipients: [submitter], watchers: [ROSTER.engagementOwner], link: link(next.id), linkLabel: 'Open plan',
        });
      } else {
        out.push({
          eventId: 'ACT-07', title: `Action taken on ${planId} accepted`, actor,
          message: `Both chains approved. ${next.id} is now ${next.status === 'Closed' ? 'Closed' : next.status}.`,
          facts: [{ label: 'Plan', value: `${planId} · ${planTitle}` }, { label: 'Closed', value: next.id }, { label: 'Progress', value: '100%' }],
          recipients: [submitter], watchers: [], link: link(next.id), linkLabel: 'Open plan', dedupKey: planId,
        });
        if (next.status === 'Closed') {
          out.push({
            eventId: 'ACT-11', title: `${planId} fully closed`, actor: 'System',
            message: `All linked exceptions are Closed${planDue !== '—' ? ` · due ${planDue}` : ''}.`,
            facts: [{ label: 'Plan', value: `${planId} · ${planTitle}` }, { label: 'Progress', value: '100%' }, { label: 'Due', value: planDue }],
            recipients: [submitter, ROSTER.engagementAuditor], watchers: [ROSTER.engagementOwner], link: link(next.id), linkLabel: 'Open plan',
          });
        }
      }
    } else if (next.actionReview === 'Rejected') {
      out.push({
        eventId: 'ACT-08', title: `Action taken on ${planId} sent back`, actor,
        message: `${actor} returned the submission. ${next.id} reverts to In-Progress with your work preserved.`,
        facts: [{ label: 'Plan', value: `${planId} · ${planTitle}` }, { label: 'Chain / level', value: 'Auditor · Level 1' }, { label: 'Affected', value: next.id }],
        quoted: { by: actor, text: comment ?? 'Sent back for rework — see the case for details.' },
        recipients: [submitter], watchers: [ROSTER.engagementOwner], link: link(next.id), linkLabel: 'Rework submission',
      });
      out.push({
        eventId: 'ACT-09', title: `Auditor outcome on ${planId}: Discrepancy`, actor,
        message: `${actor} recorded Discrepancy on the completed action for ${next.id}.`,
        facts: [{ label: 'Plan', value: `${planId} · ${planTitle}` }, { label: 'Outcome', value: 'Discrepancy' }, { label: 'Reviewed by', value: actor }, { label: 'Remaining', value: 'Rework and resubmit the action taken' }],
        quoted: comment ? { by: actor, text: comment } : undefined,
        recipients: [submitter], watchers: [ROSTER.engagementOwner, ROSTER.processOwner, ROSTER.compliance], link: link(next.id), linkLabel: 'Open plan',
      });
    }
  }

  // ── Reopened (EXC-09) ──
  if (prev.status === 'Closed' && next.status !== 'Closed') {
    const comment = lastComment(detail);
    out.push({
      eventId: 'EXC-09', title: `Closed exception ${next.id} reopened`, actor,
      message: `${next.id} “${next.title}” was Closed and has returned to ${next.status}. If it appears in an issued Action Taken Report, a re-issue may be needed.`,
      facts: [excFact, { label: 'Previous status', value: 'Closed' }, { label: 'Now', value: next.status }, { label: 'Reason', value: comment ?? 'Downstream rejection / amendment' }],
      quoted: comment ? { by: actor, text: comment } : undefined,
      recipients: ros.length ? [...ros, planOwner] : [planOwner], watchers: [ROSTER.engagementAuditor, ROSTER.engagementOwner], link: link(next.id), linkLabel: 'Open exception',
    });
  }

  // ── Due date revision approved (ACT-05) ──
  if (next.dueDateRevision?.status === 'Approved' && prev.dueDateRevision?.status !== 'Approved') {
    const r = next.dueDateRevision;
    out.push({
      eventId: 'ACT-05', title: `Due date changed on ${planId} after approval`, actor,
      message: `${actor} approved moving the due date from ${r.previousDueDate} to ${r.revisedDueDate}. Justification: “${r.reason}”.`,
      facts: [{ label: 'Plan', value: `${planId} · ${planTitle}` }, { label: 'Old due', value: r.previousDueDate }, { label: 'New due', value: r.revisedDueDate }, { label: 'Requested by', value: r.requestedBy }],
      quoted: r.decisionComment ? { by: actor, text: r.decisionComment } : undefined,
      recipients: [ROSTER.engagementAuditor], watchers: [ROSTER.engagementOwner, planOwner], link: link(next.id), linkLabel: 'Open plan',
    });
  }

  return out;
}

/** A comment on the trail (EXC-15). Detects `@First Last` mentions. */
export function commentNotification(e: GrcException, body: string, actor: string, role: 'auditor' | 'risk-owner', attachment?: { name: string }): NotifyInput {
  const mentions = Array.from(body.matchAll(/@([A-Z][a-z]+(?: [A-Z][a-z]+)?)/g)).map(m => m[1]);
  const participants: Person[] = role === 'risk-owner'
    ? [ROSTER.engagementAuditor, ROSTER.engagementOwner]
    : assignedRos(e).length ? assignedRos(e) : [ROSTER.engagementOwner];
  const others = participants.filter(p => p.name !== actor);
  return {
    eventId: 'EXC-15', title: `${actor} commented on ${e.id}`, actor,
    message: body ? `“${body}”` : `Attached ${attachment?.name ?? 'a file'}.`,
    facts: [{ label: 'Exception', value: `${e.id} · ${e.title}` }, ...(attachment ? [{ label: 'Attachment', value: attachment.name }] : [])],
    recipients: others, watchers: mentions.map(m => ({ name: m, role: '@mentioned' })),
    link: link(e.id), linkLabel: 'Open comment', dedupKey: `${e.id}:${actor}`, mention: mentions.length > 0,
  };
}
