// ─── Internal Audit Announcement — Types & Helpers ────────────────────────

export type AnnouncementStatus = 'DRAFT' | 'READY_TO_SEND' | 'SENT' | 'ACKNOWLEDGED';
export type AnnouncementAction = 'DRAFT_CREATED' | 'UPDATED' | 'SENT' | 'ACKNOWLEDGED';

export interface AnnouncementHistoryItem {
  id: string;
  action: AnnouncementAction;
  actor: string;
  timestamp: string;
  comments: string;
}

export interface InternalAuditAnnouncementState {
  status: AnnouncementStatus;
  subject: string;
  recipients: string;
  ccRecipients: string;
  announcementDate: string;
  expectedStartDate: string;
  expectedEndDate: string;
  responseDueDate: string;
  body: string;
  sentAt: string | null;
  sentBy: string;
  acknowledgedBy: string;
  acknowledgedAt: string | null;
  history: AnnouncementHistoryItem[];
  initialized: boolean;
}

export const DEFAULT_ANNOUNCEMENT: InternalAuditAnnouncementState = {
  status: 'DRAFT',
  subject: '',
  recipients: '',
  ccRecipients: '',
  announcementDate: '',
  expectedStartDate: '',
  expectedEndDate: '',
  responseDueDate: '',
  body: '',
  sentAt: null,
  sentBy: '',
  acknowledgedBy: '',
  acknowledgedAt: null,
  history: [],
  initialized: false,
};

function now(): string {
  return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function generateAnnouncementDraft(ctx: {
  assignmentName: string;
  objective: string;
  businessProcess: string;
  entityOrLocation: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  processOwner: string;
  owner: string;
  reviewer: string;
  plannedStartDate: string;
  plannedEndDate: string;
  scopeSummary: string;
}): Partial<InternalAuditAnnouncementState> {
  const subject = `Internal Audit Announcement — ${ctx.assignmentName}`;
  const recipients = [ctx.processOwner, ctx.owner].filter(Boolean).join(', ');
  const ccRecipients = ctx.reviewer || '';

  const body = `Dear Stakeholders,

This is to inform you that the Internal Audit function will be conducting an audit assignment as detailed below.

Assignment: ${ctx.assignmentName}
Objective: ${ctx.objective || 'To be confirmed'}

Scope: ${ctx.scopeSummary || ctx.businessProcess || 'To be defined'}
Entity / Location: ${ctx.entityOrLocation || 'To be confirmed'}
Audit Period: ${ctx.auditPeriodStart || '—'} to ${ctx.auditPeriodEnd || '—'}
Expected Fieldwork: ${ctx.plannedStartDate || '—'} to ${ctx.plannedEndDate || '—'}

Audit Team:
- Lead Auditor: ${ctx.owner || 'To be assigned'}
- Reviewer: ${ctx.reviewer || 'To be assigned'}

Process Owner: ${ctx.processOwner || 'To be confirmed'}

We may follow up with an Information / Document Request (IDR) for supporting data and evidence. Your cooperation and timely response will be appreciated.

Please acknowledge receipt of this announcement at your earliest convenience.

Best regards,
${ctx.owner || 'Internal Audit Team'}`;

  return {
    subject,
    recipients,
    ccRecipients,
    expectedStartDate: ctx.plannedStartDate,
    expectedEndDate: ctx.plannedEndDate,
    body,
    initialized: true,
    history: [{ id: `ah-${Date.now()}`, action: 'DRAFT_CREATED', actor: ctx.owner || 'System', timestamp: now(), comments: 'Auto-generated from scope.' }],
  };
}

export function deriveAnnouncementReadiness(ann: InternalAuditAnnouncementState): { canSend: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!ann.recipients.trim()) missing.push('Recipients');
  if (!ann.subject.trim()) missing.push('Subject');
  if (!ann.body.trim()) missing.push('Body');
  return { canSend: missing.length === 0, missing };
}
