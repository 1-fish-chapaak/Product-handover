// ─── Notification catalogue — the Real-time events ───
// One entry per row of the notification map whose trigger type is Real-time
// (plus the real-time half of ACT-09). Everything the service, the preferences
// screen and the email renderer need is declared here, so a rule change is a
// data change. Digest / reminder / threshold rows are out of scope for now.

export type NotificationModule = 'Exceptions Management' | 'ATR & Reports' | 'Engagements' | 'Workflows & Data' | 'Dashboards';
export type NotificationChannel = 'in-app' | 'email';
export type NotificationPriority = 'P0' | 'P1' | 'P2';

/** Roles the map addresses. Resolved to people by the caller's payload. */
export type RecipientRole =
  | 'engagement-owner' | 'engagement-auditor' | 'process-owner' | 'risk-owner' | 'plan-owner'
  | 'approver' | 'prior-approvers' | 'submitter' | 'manager' | 'compliance' | 'system-admin' | 'team-admin'
  | 'report-owner' | 'shared-with' | 'team' | 'participants' | 'mentioned' | 'workflow-owner' | 'uploader'
  | 'dashboard-owner' | 'viewers' | 'editors' | 'delegate' | 'requester' | 'chain-members' | 'affected-member'
  | 'both-teams-admins' | 'assignees' | 'initiator';

/** How repeats are collapsed. `window` is minutes. */
export type DedupRule =
  | { kind: 'none' }
  | { kind: 'collapse-by-operation'; note: string }
  | { kind: 'window'; minutes: number; note: string }
  | { kind: 'cap-then-rollup'; cap: number; note: string }
  | { kind: 'batch'; minutes: number; note: string }
  | { kind: 'suppress-repeat'; hours: number; note: string };

export interface NotificationEventDef {
  id: string;
  module: NotificationModule;
  /** Short event name (the "Event" column). */
  event: string;
  /** When it fires (the "Trigger condition" column). */
  trigger: string;
  /** Channels the map assigns. 'both' = in-app + email. */
  channel: 'in-app' | 'email' | 'both' | 'in-app+email-opt-in';
  /** Real-time, or real-time only for some outcomes (ACT-09). */
  realtimeNote?: string;
  whyThisChannel: string;
  recipients: { role: RecipientRole; label: string }[];
  watchers: { role: RecipientRole; label: string; digestOnly?: boolean }[];
  cadence: string;
  /** Tokens the message must carry (the "Content requirements" column). */
  content: string[];
  dedup: DedupRule;
  /** Configurability. `mandatory` = delivery can't be switched off (channel may
   *  still be chosen when `channelConfigurable`). `optOut` = user may turn off. */
  configurability: { mandatory: boolean; channelConfigurable: boolean; optOut: boolean; note: string };
  priority: NotificationPriority;
  /** Delivered even inside quiet hours. */
  overridesQuietHours: boolean;
  /** The recipient has something to do (drives the Action filter). */
  requiresAction: boolean;
  /** Where the deep link lands. */
  deeplink: 'exception' | 'plan' | 'approval' | 'report' | 'engagement' | 'workflow' | 'data-source' | 'dashboard' | 'access-request' | 'admin';
}

const R = (role: RecipientRole, label: string) => ({ role, label });
const W = (role: RecipientRole, label: string, digestOnly = false) => ({ role, label, digestOnly });
const MANDATORY = (note = 'Channel configurable, delivery mandatory.') => ({ mandatory: true, channelConfigurable: true, optOut: false, note });
const MANDATORY_FIXED = (note = 'Mandatory, no opt-out.') => ({ mandatory: true, channelConfigurable: false, optOut: false, note });
const OPT_OUT = (note = 'User opt-out allowed.') => ({ mandatory: false, channelConfigurable: true, optOut: true, note });

export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  // ── Exceptions Management ──
  {
    id: 'EXC-02', module: 'Exceptions Management', event: 'Critical or High severity exception created',
    trigger: 'New exception where Severity is Critical or High.', channel: 'both',
    whyThisChannel: 'Severity is the product’s only per-row risk signal; a Critical finding that waits for a digest is the case the audit committee asks about.',
    recipients: [R('engagement-owner', 'Engagement owner'), R('engagement-auditor', 'Engagement auditor')],
    watchers: [W('process-owner', 'Process owner for the control (when mapped)')],
    cadence: 'Immediate; overrides quiet hours',
    content: ['exception.id', 'exception.title', 'exception.severity', 'control.attribute_id', 'control.text', 'engagement.code', 'deeplink'],
    dedup: { kind: 'cap-then-rollup', cap: 10, note: 'Cap at 10 individual real-time messages per run; beyond that one “N critical exceptions raised” rollup with a link to the filtered list.' },
    configurability: MANDATORY('Channel configurable, delivery mandatory. No opt-out.'), priority: 'P0', overridesQuietHours: true, requiresAction: true, deeplink: 'exception',
  },
  {
    id: 'EXC-03', module: 'Exceptions Management', event: 'Risk owner assigned to an exception',
    trigger: 'Any RO added to an exception; trail records “assigned a risk owner”.', channel: 'both',
    whyThisChannel: 'Work cannot start until the assignee knows. This is the single highest-value notification in the product.',
    recipients: [R('risk-owner', 'Each newly assigned RO')],
    watchers: [W('engagement-owner', 'Engagement owner', true)],
    cadence: 'Immediate, respecting quiet hours (queued to 08:00 IST if outside)',
    content: ['exception.id', 'exception.title', 'exception.severity', 'control.attribute_id', 'engagement.code', 'actor.name', 'other assigned ROs', 'deeplink'],
    dedup: { kind: 'window', minutes: 10, note: 'If the same RO receives assignments on more than 5 exceptions within 10 minutes, collapse into EXC-05 instead.' },
    configurability: MANDATORY(), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'exception',
  },
  {
    id: 'EXC-04', module: 'Exceptions Management', event: 'Risk owner removed or reassigned',
    trigger: 'Assignment list changes on an exception already in progress.', channel: 'in-app',
    whyThisChannel: 'A workload change, not a deadline. The in-app queue is where the RO will notice it.',
    recipients: [R('risk-owner', 'Removed RO, added RO')],
    watchers: [W('risk-owner', 'Appointed RO'), W('engagement-owner', 'Engagement owner')],
    cadence: 'Immediate',
    content: ['exception.id', 'actor.name', 'added/removed', 'current assignee list', 'deeplink'],
    dedup: { kind: 'window', minutes: 10, note: 'One message per exception per actor per 10-minute window, listing net changes.' },
    configurability: OPT_OUT(), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'exception',
  },
  {
    id: 'EXC-05', module: 'Exceptions Management', event: 'Bulk assignment of exceptions to a risk owner',
    trigger: 'Engagement.Assign_exceptions applied to a multi-row selection.', channel: 'both',
    whyThisChannel: 'Same reason as EXC-03, but the bulk path is how assignment actually happens at this volume.',
    recipients: [R('assignees', 'Each assignee, once')],
    watchers: [W('engagement-owner', 'Engagement owner')],
    cadence: 'Immediate, one message per assignee per bulk operation',
    content: ['count.items', 'engagement.code', 'severity split', 'control.attribute_id list', 'actor.name', 'deeplink to “assigned to me”'],
    dedup: { kind: 'collapse-by-operation', note: 'One rollup per assignee per operation. Never one message per row.' },
    configurability: MANDATORY(), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'exception',
  },
  {
    id: 'EXC-06', module: 'Exceptions Management', event: 'Exception classified',
    trigger: 'RO submits Result (True / False Exception / Business as Usual) with sub-classification and comment.', channel: 'in-app',
    whyThisChannel: 'The actionable half of this event is the approval request; the classification itself is informational to everyone else.',
    recipients: [R('approver', 'RO chain level 1 approver (as APR-01)')],
    watchers: [W('engagement-auditor', 'Engagement auditor', true)],
    cadence: 'Immediate to the approver; auditor sees it in the daily digest',
    content: ['exception.id', 'exception.classification', 'exception.subclass', 'decision.comment', 'actor.name', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'Suppress the auditor copy entirely when the classification is part of a bulk operation — send the ACT-12 rollup instead.' },
    configurability: { mandatory: true, channelConfigurable: false, optOut: true, note: 'User opt-out on the auditor copy only.' }, priority: 'P1', overridesQuietHours: false, requiresAction: true, deeplink: 'approval',
  },
  {
    id: 'EXC-07', module: 'Exceptions Management', event: 'Classification rejected — exception returns to Open',
    trigger: 'Any approver in either chain rejects. The exception reverts to Open with prior work preserved.', channel: 'both',
    whyThisChannel: 'Work already counted as done has been undone. Without a message the exception simply reappears in a queue with no explanation.',
    recipients: [R('risk-owner', 'Appointed RO, all assigned ROs')],
    watchers: [W('plan-owner', 'Plan owner if a plan was attached'), W('engagement-owner', 'Engagement owner')],
    cadence: 'Immediate; overrides quiet hours',
    content: ['exception.id', 'exception.title', 'actor.name (rejecting)', 'approval.chain', 'approval.level', 'decision.comment VERBATIM (mandatory)', 'what reverted', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: MANDATORY('Channel configurable, delivery mandatory. No opt-out.'), priority: 'P0', overridesQuietHours: true, requiresAction: true, deeplink: 'exception',
  },
  {
    id: 'EXC-09', module: 'Exceptions Management', event: 'Closed exception reopened',
    trigger: 'A resolved exception returns to Open through downstream rejection or amendment.', channel: 'both',
    whyThisChannel: 'A reopened exception may already have been reported in an issued ATR. Audit risk if missed.',
    recipients: [R('risk-owner', 'Appointed RO'), R('plan-owner', 'Plan owner')],
    watchers: [W('engagement-auditor', 'Engagement auditor'), W('engagement-owner', 'Engagement owner')],
    cadence: 'Immediate',
    content: ['exception.id', 'previous status', 'reason / decision.comment', 'whether it appears in an issued report.id', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: MANDATORY_FIXED(), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'exception',
  },
  {
    id: 'EXC-15', module: 'Exceptions Management', event: 'Comment added to an exception trail',
    trigger: 'Any participant posts on the trail — comments, assignments, approvals and stage changes share one stream.', channel: 'in-app+email-opt-in',
    whyThisChannel: 'Conversation belongs in-app; email would be unbearable at this volume unless the user asks for it.',
    recipients: [R('participants', 'Other participants on that exception')],
    watchers: [W('mentioned', '@mentioned users (real-time regardless of settings)')],
    cadence: 'Immediate in-app; email batched hourly',
    content: ['actor.name', 'comment body', 'exception.id', 'deeplink anchored to the comment'],
    dedup: { kind: 'batch', minutes: 5, note: 'Batch consecutive comments by the same author within 5 minutes into one notification.' },
    configurability: OPT_OUT('Full user control; @mention always delivered.'), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'exception',
  },

  // ── Exceptions Management · Action Hub (ACT-*) ──
  {
    id: 'ACT-01', module: 'Exceptions Management', event: 'Management action plan created',
    trigger: 'Plan added against a Design Deficiency, System Deficiency or Procedural Non-Compliance.', channel: 'both',
    whyThisChannel: 'Creates an obligation with a due date for a named person. They must be told the moment it exists.',
    recipients: [R('plan-owner', 'Named plan owner')],
    watchers: [W('engagement-auditor', 'Engagement auditor'), W('engagement-owner', 'Engagement owner')],
    cadence: 'Immediate',
    content: ['plan.id', 'plan.title', 'plan.due', 'scope (per exception / bulk)', 'linked exception count', 'exception.subclass', 'actor.name', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'If several plans are created for one owner in a single operation, collapse into one message listing them.' },
    configurability: MANDATORY(), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'plan',
  },
  {
    id: 'ACT-02', module: 'Exceptions Management', event: 'Plan owner assigned or changed',
    trigger: 'Owner field set or edited on an action plan.', channel: 'both',
    whyThisChannel: 'Ownership of a dated obligation moving between people is exactly the handover that gets lost.',
    recipients: [R('plan-owner', 'New owner, previous owner')],
    watchers: [W('engagement-owner', 'Engagement owner'), W('engagement-auditor', 'Auditor')],
    cadence: 'Immediate',
    content: ['plan.id', 'plan.title', 'plan.due', 'plan.progress', 'previous owner', 'actor.name', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: MANDATORY_FIXED('Mandatory.'), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'plan',
  },
  {
    id: 'ACT-05', module: 'Exceptions Management', event: 'Plan due date changed',
    trigger: 'Due date edited after the plan entered approval.', channel: 'in-app',
    whyThisChannel: 'Audit-integrity visibility — a silently extended deadline should never be silent.',
    recipients: [R('engagement-auditor', 'Engagement auditor')],
    watchers: [W('engagement-owner', 'Engagement owner'), W('plan-owner', 'Plan owner')],
    cadence: 'Immediate',
    content: ['plan.id', 'old due', 'new due', 'actor.name', 'justification if captured', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: { mandatory: true, channelConfigurable: false, optOut: false, note: 'Mandatory for the auditor copy.' }, priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'plan',
  },
  {
    id: 'ACT-06', module: 'Exceptions Management', event: 'Action taken recorded, awaiting verification',
    trigger: 'Owner submits an action-taken record with narrative and evidence attachment.', channel: 'both',
    whyThisChannel: 'This is the queue that currently shows 120 rows of Action review pending with nobody told.',
    recipients: [R('approver', 'RO chain approver, then auditor reviewer (sequential)')],
    watchers: [W('engagement-owner', 'Engagement owner', true)],
    cadence: 'Immediate to the current level only; next level notified when the previous completes',
    content: ['plan.id', 'exception.id list covered', 'narrative', 'attachment names', 'actor.name', 'approval.level', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One message per submission, however many exceptions it covers.' },
    configurability: MANDATORY(), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'approval',
  },
  {
    id: 'ACT-07', module: 'Exceptions Management', event: 'Action taken accepted',
    trigger: 'Submission marked Accepted after RO and Auditor approval both complete.', channel: 'in-app',
    whyThisChannel: 'Positive confirmation; no action follows, so it does not need an email.',
    recipients: [R('submitter', 'Submitter'), R('plan-owner', 'Plan owner')],
    watchers: [],
    cadence: 'Immediate',
    content: ['plan.id', 'exceptions closed by this acceptance', 'plan.progress', 'deeplink'],
    dedup: { kind: 'batch', minutes: 60, note: 'Batch to one message per plan per hour when several submissions are accepted together.' },
    configurability: OPT_OUT(), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'plan',
  },
  {
    id: 'ACT-08', module: 'Exceptions Management', event: 'Action taken rejected or sent back with comments',
    trigger: 'Approver returns the submission; the exception reverts with prior work preserved.', channel: 'both',
    whyThisChannel: 'Rework cannot start without the comment. Same class of event as EXC-07.',
    recipients: [R('submitter', 'Submitter'), R('plan-owner', 'Plan owner')],
    watchers: [W('engagement-owner', 'Engagement owner')],
    cadence: 'Immediate; overrides quiet hours',
    content: ['plan.id', 'actor.name (rejecting)', 'approval.chain / approval.level', 'decision.comment VERBATIM', 'affected exception.id list', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: MANDATORY_FIXED(), priority: 'P0', overridesQuietHours: true, requiresAction: true, deeplink: 'plan',
  },
  {
    id: 'ACT-09', module: 'Exceptions Management', event: 'Auditor review outcome recorded',
    trigger: 'Outcome set to Implemented, Partially Implemented or Discrepancy.', channel: 'both',
    realtimeNote: 'Real-time for Discrepancy and Partially Implemented; Implemented goes to the daily digest.',
    whyThisChannel: 'Discrepancy is a reportable finding about remediation quality and must not wait for a digest.',
    recipients: [R('plan-owner', 'Plan owner')],
    watchers: [W('engagement-owner', 'Engagement owner'), W('process-owner', 'Process owner (on Discrepancy)'), W('compliance', 'Compliance (on Discrepancy)')],
    cadence: 'Immediate / next daily digest',
    content: ['plan.id', 'decision.outcome', 'decision.comment', 'actor.name (reviewing)', 'remaining work', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: MANDATORY('Channel configurable; Discrepancy delivery mandatory.'), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'plan',
  },
  {
    id: 'ACT-11', module: 'Exceptions Management', event: 'Plan fully closed',
    trigger: 'All linked exceptions closed for that plan.', channel: 'in-app',
    whyThisChannel: 'Completion confirmation, useful for the ATR narrative but not time-critical.',
    recipients: [R('plan-owner', 'Plan owner'), R('engagement-auditor', 'Engagement auditor')],
    watchers: [W('engagement-owner', 'Engagement owner')],
    cadence: 'Immediate',
    content: ['plan.id', 'plan.progress', 'elapsed vs plan.due', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: OPT_OUT(), priority: 'P2', overridesQuietHours: false, requiresAction: false, deeplink: 'plan',
  },
  {
    id: 'ACT-12', module: 'Exceptions Management', event: 'Bulk classification or bulk close applied',
    trigger: 'Multi-row classify, close or bulk run touches many exceptions at once.', channel: 'in-app',
    whyThisChannel: 'Without collapsing, a single bulk operation generates dozens of messages to one person.',
    recipients: [R('plan-owner', 'Affected owners (one rollup each)')],
    watchers: [W('engagement-auditor', 'Engagement auditor'), W('engagement-owner', 'Engagement owner')],
    cadence: 'One rollup per operation per recipient',
    content: ['count.items', 'operation type', 'actor.name', 'affected control.attribute_id list', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'Hard requirement: collapse by operation ID. AP-5’s trail shows 21 classification approvals inside three minutes.' },
    configurability: OPT_OUT('User-configurable.'), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'exception',
  },

  // ── Exceptions Management · Approval chains (APR-*) ──
  {
    id: 'APR-01', module: 'Exceptions Management', event: 'Approval requested at RO chain level N',
    trigger: 'Classification or action taken enters an RO level. Depth from engagement Configuration → Approval level — RO.', channel: 'both',
    whyThisChannel: 'An approver who is not told is a stalled chain. Nothing downstream can move.',
    recipients: [R('approver', 'That level’s approver')],
    watchers: [W('submitter', 'Submitter (confirmation copy, in-app only)')],
    cadence: 'Immediate, respecting quiet hours',
    content: ['what is being approved', 'exception.id or plan.id', 'approval.chain', 'approval.level', 'submitter', 'decision.comment from submission', 'deeplink to the decision screen'],
    dedup: { kind: 'collapse-by-operation', note: 'Collapse to one message per approver per batch when a bulk classification enters the chain, with a link to a filtered approval queue.' },
    configurability: MANDATORY(), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'approval',
  },
  {
    id: 'APR-02', module: 'Exceptions Management', event: 'Approval requested at Auditor chain level N',
    trigger: 'Item advances into the Auditor chain.', channel: 'both',
    whyThisChannel: 'Same as APR-01; the auditor chain is the one that gates the ATR.',
    recipients: [R('approver', 'That level’s approver')],
    watchers: [W('submitter', 'Submitter (in-app)')],
    cadence: 'Immediate',
    content: ['as APR-01', 'what the RO chain already decided'],
    dedup: { kind: 'collapse-by-operation', note: 'As APR-01.' },
    configurability: MANDATORY(), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'approval',
  },
  {
    id: 'APR-03', module: 'Exceptions Management', event: 'Approver approves at a level',
    trigger: 'Level marked done; chain advances.', channel: 'in-app',
    whyThisChannel: 'The actionable message is the next level’s request. The submitter only needs progress.',
    recipients: [R('approver', 'Next level’s approver (as APR-01/02)')],
    watchers: [W('submitter', 'Submitter')],
    cadence: 'Immediate to next approver; submitter copy batched hourly',
    content: ['approval.level completed', 'approver', 'remaining levels', 'deeplink'],
    dedup: { kind: 'batch', minutes: 60, note: 'Batch the submitter copy — 21 approvals in three minutes must not be 21 messages.' },
    configurability: { mandatory: true, channelConfigurable: false, optOut: true, note: 'Submitter copy user-configurable.' }, priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'approval',
  },
  {
    id: 'APR-04', module: 'Exceptions Management', event: 'Approver rejects or requests changes',
    trigger: 'Rejection at any point returns that exception to Open with prior work preserved.', channel: 'both',
    whyThisChannel: 'Prior approvers must know their approval has been undone — otherwise the audit trail says approved and the item is open.',
    recipients: [R('submitter', 'Submitter')],
    watchers: [W('prior-approvers', 'Every prior approver in the chain'), W('plan-owner', 'Plan owner'), W('engagement-owner', 'Engagement owner')],
    cadence: 'Immediate; overrides quiet hours',
    content: ['decision.comment VERBATIM (mandatory)', 'actor.name (rejecting)', 'approval.level', 'what reverted', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: MANDATORY_FIXED(), priority: 'P0', overridesQuietHours: true, requiresAction: true, deeplink: 'approval',
  },
  {
    id: 'APR-05', module: 'Exceptions Management', event: 'Final approval completed',
    trigger: 'Both chains complete for an exception or plan.', channel: 'both',
    whyThisChannel: 'Closes the loop the submitter has been waiting on, and releases the next stage of work.',
    recipients: [R('submitter', 'Submitter'), R('plan-owner', 'Plan owner')],
    watchers: [W('engagement-owner', 'Engagement owner'), W('engagement-auditor', 'Auditor')],
    cadence: 'Immediate',
    content: ['item reference', 'full chain decision history with timestamps', 'next step (action plan? closed?)', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'Batch per plan when a bulk operation completes many chains at once.' },
    configurability: MANDATORY(), priority: 'P0', overridesQuietHours: false, requiresAction: false, deeplink: 'approval',
  },
  {
    id: 'APR-07', module: 'Exceptions Management', event: 'Approval delegated or reassigned',
    trigger: 'Approver hands a level to a deputy, or an out-of-office rule reassigns it.', channel: 'both',
    whyThisChannel: 'The delegate has inherited a queue they did not know existed.',
    recipients: [R('delegate', 'Delegate')],
    watchers: [W('approver', 'Original approver'), W('submitter', 'Submitter'), W('engagement-owner', 'Engagement owner')],
    cadence: 'Immediate, plus a summary of everything inherited',
    content: ['delegating approver', 'period of delegation', 'count.items inherited', 'oldest waiting item', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One summary message per delegation event, not per item.' },
    configurability: MANDATORY_FIXED('Mandatory.'), priority: 'P1', overridesQuietHours: false, requiresAction: true, deeplink: 'approval',
  },
  {
    id: 'APR-08', module: 'Exceptions Management', event: 'Approval depth changed on an engagement',
    trigger: 'Approval level — RO or Approval level — Auditor edited in Configuration.', channel: 'in-app',
    whyThisChannel: 'Changes who must approve what, retrospectively as well as going forward.',
    recipients: [R('chain-members', 'Both chains’ members')],
    watchers: [W('engagement-owner', 'Engagement owner'), W('engagement-auditor', 'Auditor'), W('compliance', 'Compliance')],
    cadence: 'Immediate',
    content: ['old depth', 'new depth', 'which chain', 'actor.name', 'effect on in-flight items', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: MANDATORY_FIXED('Mandatory.'), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'engagement',
  },
  {
    id: 'APR-09', module: 'Exceptions Management', event: 'Approval-flow hierarchy edited',
    trigger: 'Member added, removed or re-parented on the Approval Flow tab.', channel: 'in-app',
    whyThisChannel: 'Low frequency, but it silently changes every escalation path.',
    recipients: [R('affected-member', 'Affected member')],
    watchers: [W('manager', 'Their Manager'), W('engagement-owner', 'Engagement owner')],
    cadence: 'Immediate',
    content: ['what changed', 'new Manager', 'actor.name', 'deeplink'],
    dedup: { kind: 'window', minutes: 30, note: 'One message per member per edit session.' },
    configurability: OPT_OUT(), priority: 'P2', overridesQuietHours: false, requiresAction: false, deeplink: 'engagement',
  },
  {
    id: 'APR-10', module: 'Exceptions Management', event: 'Resource access, role change or team join requested',
    trigger: 'Approval.Approve_resource_access / Approve_role_change / Approve_team_join raised.', channel: 'both',
    whyThisChannel: 'These permissions exist in the RBAC model but have no request queue, no alert and no reminder.',
    recipients: [R('approver', 'Holder of that approval permission')],
    watchers: [W('team-admin', 'Team admin')],
    cadence: 'Immediate, reminder at 24h, escalate at 72h',
    content: ['requester', 'what is requested', 'justification', 'current access', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: MANDATORY(), priority: 'P1', overridesQuietHours: false, requiresAction: true, deeplink: 'access-request',
  },
  {
    id: 'APR-11', module: 'Exceptions Management', event: 'Access request decided',
    trigger: 'Approver grants or denies.', channel: 'both',
    whyThisChannel: 'The requester is blocked until they know.',
    recipients: [R('requester', 'Requester')],
    watchers: [W('team-admin', 'Team admin')],
    cadence: 'Immediate',
    content: ['decision', 'approver', 'decision.comment', 'what access is now effective', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: MANDATORY_FIXED('Mandatory.'), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'access-request',
  },

  // ── ATR & Reports ──
  {
    id: 'ATR-01', module: 'ATR & Reports', event: 'Report created from a template',
    trigger: 'New report from Internal Audit Report, SOX Compliance Report or Action Taken Report.', channel: 'in-app',
    whyThisChannel: 'Housekeeping visibility.',
    recipients: [R('engagement-owner', 'Engagement owner')], watchers: [],
    cadence: 'Immediate',
    content: ['report.id', 'report.type', 'template used', 'actor.name', 'deeplink'],
    dedup: { kind: 'none' }, configurability: OPT_OUT(), priority: 'P2', overridesQuietHours: false, requiresAction: false, deeplink: 'report',
  },
  {
    id: 'ATR-02', module: 'ATR & Reports', event: 'ATR generated by upload',
    trigger: 'Create Report produces an ATR from an uploaded report.', channel: 'in-app',
    whyThisChannel: 'An ATR entering the system from outside the workflow needs to be visible to the people accountable for it.',
    recipients: [R('engagement-owner', 'Engagement owner'), R('engagement-auditor', 'Engagement auditor')], watchers: [],
    cadence: 'Immediate',
    content: ['report.id', 'observation and action-plan counts', 'audit period', 'actor.name', 'deeplink'],
    dedup: { kind: 'none' }, configurability: OPT_OUT(), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'report',
  },
  {
    id: 'ATR-03', module: 'ATR & Reports', event: 'ATR issued while readiness is incomplete',
    trigger: 'Report issued with gates unmet.', channel: 'both',
    whyThisChannel: 'Issuing a report over unfinished work is an audit-quality risk that must leave a record.',
    recipients: [R('engagement-owner', 'Engagement owner'), R('engagement-auditor', 'Engagement auditor')],
    watchers: [W('compliance', 'Compliance')],
    cadence: 'Immediate',
    content: ['report.id', 'gate status for all four gates', 'count.items cases still open', 'who issued it', 'deeplink'],
    dedup: { kind: 'none' }, configurability: MANDATORY_FIXED(), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'report',
  },
  {
    id: 'ATR-04', module: 'ATR & Reports', event: 'Report visibility changed Private → Public',
    trigger: 'Visibility toggled; Public means everyone on the team can view.', channel: 'in-app',
    whyThisChannel: 'A findings document becoming team-visible is worth a passive signal.',
    recipients: [R('report-owner', 'Report owner')], watchers: [W('team', 'The team')],
    cadence: 'Immediate',
    content: ['report.id', 'old and new visibility', 'actor.name', 'deeplink'],
    dedup: { kind: 'none' }, configurability: OPT_OUT(), priority: 'P2', overridesQuietHours: false, requiresAction: false, deeplink: 'report',
  },
  {
    id: 'ATR-05', module: 'ATR & Reports', event: 'Report shared with named users',
    trigger: 'Share applied.', channel: 'both',
    whyThisChannel: 'Recipients have no way to discover a share today — they have to go looking.',
    recipients: [R('shared-with', 'Each recipient')], watchers: [W('report-owner', 'Report owner (confirmation)')],
    cadence: 'Immediate',
    content: ['report.id', 'report.type', 'sharer', 'optional message', 'audit period', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One message per recipient per share operation.' },
    configurability: MANDATORY(), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'report',
  },
  {
    id: 'ATR-07', module: 'ATR & Reports', event: 'Issued ATR drifts from live data (amendment)',
    trigger: 'An exception, classification, MAP or verification underlying an issued ATR changes after issue.', channel: 'both',
    whyThisChannel: 'A circulated report that silently changed is the highest audit risk in this map. Recipients acted on a version that no longer exists.',
    recipients: [R('engagement-owner', 'Engagement owner'), R('engagement-auditor', 'Engagement auditor')],
    watchers: [W('shared-with', 'Everyone the report was shared with', true)],
    cadence: 'Immediate to owner and auditor; recipients once per day with the accumulated change set',
    content: ['report.id', 'what changed', 'which observation / exception.id', 'old vs new value', 'actor.name', 'whether a re-issue is needed', 'deeplink'],
    dedup: { kind: 'batch', minutes: 1440, note: 'Batch recipient-facing messages to one per report per day; never batch the owner and auditor copy.' },
    configurability: MANDATORY_FIXED(), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'report',
  },
  {
    id: 'ATR-08', module: 'ATR & Reports', event: 'Snapshot generated and locked',
    trigger: 'A version is frozen for circulation.', channel: 'both',
    whyThisChannel: 'Tells recipients which version is authoritative and stops them reading a live page.',
    recipients: [R('shared-with', 'Shared-with list')], watchers: [W('engagement-owner', 'Engagement owner'), W('engagement-auditor', 'Auditor')],
    cadence: 'Immediate',
    content: ['report.id', 'version number', 'locked-at timestamp', 'who locked it', 'diff summary vs previous version', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One message per snapshot.' },
    configurability: MANDATORY(), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'report',
  },
  {
    id: 'ATR-09', module: 'ATR & Reports', event: 'Concurrent edit or version conflict',
    trigger: 'Two editors change one report; a later write overwrites an unseen earlier one.', channel: 'in-app',
    whyThisChannel: 'Must interrupt the person who is editing right now; email arrives too late to be useful.',
    recipients: [R('editors', 'Both editors')], watchers: [W('report-owner', 'Report owner')],
    cadence: 'Immediate',
    content: ['report.id', 'conflicting section', 'both editors', 'timestamps', 'recovery action'],
    dedup: { kind: 'none' }, configurability: MANDATORY_FIXED('Mandatory.'), priority: 'P1', overridesQuietHours: false, requiresAction: true, deeplink: 'report',
  },
  {
    id: 'ATR-10', module: 'ATR & Reports', event: 'Working-paper run generated',
    trigger: 'New Control Report run produced under engagement → Audit Report.', channel: 'in-app',
    whyThisChannel: 'Confirms a long-running job finished.',
    recipients: [R('initiator', 'Auditor who initiated it')], watchers: [W('engagement-owner', 'Engagement owner')],
    cadence: 'On completion',
    content: ['run timestamp', 'controls and cards produced', 'COMPLETE or PARTIAL', 'deeplink'],
    dedup: { kind: 'none' }, configurability: OPT_OUT(), priority: 'P2', overridesQuietHours: false, requiresAction: false, deeplink: 'engagement',
  },
  {
    id: 'ATR-11', module: 'ATR & Reports', event: 'Working-paper run finished PARTIAL',
    trigger: 'Run completes with incomplete coverage rather than COMPLETE.', channel: 'both',
    whyThisChannel: 'A PARTIAL run means evidence gaps in the working papers — the auditor must know before relying on it.',
    recipients: [R('initiator', 'Auditor who initiated it')], watchers: [W('engagement-owner', 'Engagement owner')],
    cadence: 'On completion',
    content: ['which controls produced no card and why', 'controls covered vs expected', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One message per run.' },
    configurability: MANDATORY(), priority: 'P1', overridesQuietHours: false, requiresAction: true, deeplink: 'engagement',
  },

  // ── Engagements ──
  {
    id: 'ENG-01', module: 'Engagements', event: 'Engagement created as Draft',
    trigger: 'New Engagement saved with owner, process and period.', channel: 'both',
    whyThisChannel: 'The owner may not be the creator.',
    recipients: [R('engagement-owner', 'Named owner')], watchers: [],
    cadence: 'Immediate',
    content: ['engagement.code', 'engagement.name', 'engagement.type', 'process', 'period', 'actor.name', 'deeplink'],
    dedup: { kind: 'none' }, configurability: MANDATORY(), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'engagement',
  },
  {
    id: 'ENG-02', module: 'Engagements', event: 'Engagement kicked off (Draft → Active)',
    trigger: 'Status moves to Active and work becomes assignable.', channel: 'both',
    whyThisChannel: 'The starting gun for everyone in scope.',
    recipients: [R('engagement-owner', 'Owner'), R('team', 'Assigned team'), R('risk-owner', 'ROs'), R('engagement-auditor', 'Auditors')],
    watchers: [W('process-owner', 'Process owner')],
    cadence: 'Immediate',
    content: ['engagement.code', 'engagement.name', 'engagement.type', 'period start and end', 'approval depths', 'each recipient’s role in it', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One message per person even if they hold several roles.' },
    configurability: MANDATORY(), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'engagement',
  },
  {
    id: 'ENG-03', module: 'Engagements', event: 'Engagement owner changed',
    trigger: 'Owner reassigned in Configuration.', channel: 'both',
    whyThisChannel: 'Ownership handover of everything inside the engagement.',
    recipients: [R('engagement-owner', 'New owner, previous owner')], watchers: [W('engagement-auditor', 'Auditor')],
    cadence: 'Immediate',
    content: ['engagement.code', 'previous owner', 'open exception count', 'overdue plan count', 'deeplink'],
    dedup: { kind: 'none' }, configurability: MANDATORY_FIXED('Mandatory.'), priority: 'P1', overridesQuietHours: false, requiresAction: true, deeplink: 'engagement',
  },
  {
    id: 'ENG-04', module: 'Engagements', event: 'Engagement moved to Inactive or Completed',
    trigger: 'Status transition out of Active.', channel: 'in-app',
    whyThisChannel: 'Stops people working on something that has closed.',
    recipients: [R('participants', 'All participants')], watchers: [],
    cadence: 'Immediate',
    content: ['engagement.code', 'new status', 'actor.name', 'what remains open', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One message per participant.' },
    configurability: OPT_OUT(), priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'engagement',
  },
  {
    id: 'ENG-05', module: 'Engagements', event: 'Engagement closed with unresolved exceptions',
    trigger: 'Completed while open or unclassified exceptions remain.', channel: 'both',
    whyThisChannel: 'Closing over open findings is a reportable control weakness in its own right.',
    recipients: [R('engagement-owner', 'Engagement owner'), R('engagement-auditor', 'Engagement auditor')], watchers: [W('compliance', 'Compliance')],
    cadence: 'Immediate',
    content: ['engagement.code', 'counts by status and classification', 'overdue plans', 'who closed it', 'deeplink'],
    dedup: { kind: 'none' }, configurability: MANDATORY_FIXED(), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'engagement',
  },
  {
    id: 'ENG-10', module: 'Engagements', event: 'Standing instruction added or changed',
    trigger: 'A rule the AI follows on every run in the engagement is edited.', channel: 'in-app',
    whyThisChannel: 'Changes how all future evidence is produced — should never be silent.',
    recipients: [R('engagement-auditor', 'Engagement auditor'), R('engagement-owner', 'Engagement owner')], watchers: [W('compliance', 'Compliance')],
    cadence: 'Immediate',
    content: ['instruction text before and after', 'actor.name', 'engagement.code', 'effect on future runs', 'deeplink'],
    dedup: { kind: 'window', minutes: 30, note: 'One message per edit session.' },
    configurability: { mandatory: true, channelConfigurable: false, optOut: false, note: 'Mandatory for the auditor copy.' }, priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'engagement',
  },

  // ── Workflows & Data ──
  {
    id: 'WFL-01', module: 'Workflows & Data', event: 'Workflow run completed',
    trigger: 'Run finishes; the per-workflow recipient list fires.', channel: 'email',
    whyThisChannel: 'Already built. Retained, but routed through the notification service so it respects preferences and digest windows.',
    recipients: [R('workflow-owner', 'Configured recipient list')], watchers: [],
    cadence: 'On every run, regardless of outcome',
    content: ['workflow.code', 'run.id', 'run.status', 'duration', 'exceptions raised', 'deeplink'],
    dedup: { kind: 'none' },
    configurability: { mandatory: false, channelConfigurable: true, optOut: true, note: 'Recipient list only today; channel and frequency now user-configurable.' }, priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'workflow',
  },
  {
    id: 'WFL-02', module: 'Workflows & Data', event: 'Workflow run failed',
    trigger: 'Run ends in Error.', channel: 'both',
    whyThisChannel: 'A failed run means no evidence was produced. Everything downstream is silently missing data.',
    recipients: [R('workflow-owner', 'Workflow owner'), R('engagement-owner', 'Engagement owner')], watchers: [W('system-admin', 'System admin')],
    cadence: 'Immediate; overrides quiet hours',
    content: ['workflow.code', 'run.id', 'error message', 'last successful run', 'affected control.attribute_id', 'engagement.code', 'deeplink'],
    dedup: { kind: 'suppress-repeat', hours: 6, note: 'Suppress repeat alerts for the same workflow and same error within 6 hours; send a summary instead if it keeps failing.' },
    configurability: MANDATORY(), priority: 'P0', overridesQuietHours: true, requiresAction: true, deeplink: 'workflow',
  },
  {
    id: 'WFL-06', module: 'Workflows & Data', event: 'Workflow published or version changed',
    trigger: 'Draft → Live, or a new entry in Version history.', channel: 'in-app',
    whyThisChannel: 'Changes the evidence basis for everything downstream of it.',
    recipients: [R('engagement-owner', 'Engagement owner'), R('engagement-auditor', 'Engagement auditor')], watchers: [W('compliance', 'Compliance')],
    cadence: 'Immediate',
    content: ['workflow.code', 'version', 'what changed', 'actor.name', 'affected engagements', 'deeplink to version history'],
    dedup: { kind: 'collapse-by-operation', note: 'One message per publish.' },
    configurability: { mandatory: true, channelConfigurable: false, optOut: false, note: 'Mandatory for the auditor copy.' }, priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'workflow',
  },
  {
    id: 'WFL-07', module: 'Workflows & Data', event: 'Bulk run started and finished',
    trigger: 'Bulk Run launched across multiple workflows.', channel: 'both',
    whyThisChannel: 'A long job the initiator walked away from; failures inside it need their own routing.',
    recipients: [R('initiator', 'Initiator')], watchers: [W('workflow-owner', 'Owners of any workflow that failed')],
    cadence: 'On completion',
    content: ['workflows run', 'pass/fail split', 'duration', 'exceptions raised', 'failures listed individually', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One completion message, not one per workflow.' },
    configurability: { mandatory: false, channelConfigurable: true, optOut: false, note: 'Channel configurable.' }, priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'workflow',
  },
  {
    id: 'WFL-08', module: 'Workflows & Data', event: 'Data source ingestion failed',
    trigger: 'Upload or sync ends in Failed.', channel: 'both',
    whyThisChannel: 'Silent ingestion failure produces an audit run over incomplete data, which is worse than no run.',
    recipients: [R('uploader', 'Uploader'), R('system-admin', 'System admin')], watchers: [W('engagement-owner', 'Engagement owners depending on that source')],
    cadence: 'Immediate',
    content: ['source name', 'type', 'error', 'rows attempted', 'dependent workflows', 'deeplink'],
    dedup: { kind: 'suppress-repeat', hours: 6, note: 'One message per source per failure; suppress repeats within 6 hours.' },
    configurability: MANDATORY(), priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'data-source',
  },
  {
    id: 'WFL-09', module: 'Workflows & Data', event: 'Integrated database connection lost',
    trigger: 'An integrated DB stops responding or credentials expire.', channel: 'both',
    whyThisChannel: 'Every workflow reading that source will fail or, worse, return partial data.',
    recipients: [R('system-admin', 'System admin')], watchers: [W('engagement-owner', 'Dependent engagement owners')],
    cadence: 'Immediate, then every 4 hours while down',
    content: ['connection name', 'error', 'last successful query', 'dependent workflows and engagements', 'deeplink'],
    dedup: { kind: 'suppress-repeat', hours: 4, note: 'One message per connection per outage, with a recovery message when it returns.' },
    configurability: { mandatory: true, channelConfigurable: false, optOut: false, note: 'Admin policy; delivery mandatory.' }, priority: 'P0', overridesQuietHours: false, requiresAction: true, deeplink: 'data-source',
  },
  {
    id: 'WFL-10', module: 'Workflows & Data', event: 'Bulk upload summary',
    trigger: 'Multi-file or multi-sheet upload completes with accepted and rejected counts.', channel: 'both',
    whyThisChannel: 'The uploader has to know what did not land, and usually will not still be on the page.',
    recipients: [R('uploader', 'Uploader')], watchers: [],
    cadence: 'On completion',
    content: ['files accepted and rejected', 'row counts', 'rejection reasons grouped', 'link to an error report', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One message per upload operation.' },
    configurability: { mandatory: false, channelConfigurable: true, optOut: false, note: 'Channel configurable.' }, priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'data-source',
  },
  {
    id: 'WFL-12', module: 'Workflows & Data', event: 'Workflows moved between teams',
    trigger: 'Admin → Move Workflows used.', channel: 'in-app',
    whyThisChannel: 'Changes who can see and run an audit procedure.',
    recipients: [R('both-teams-admins', 'Both teams’ admins')], watchers: [W('engagement-owner', 'Affected engagement owners')],
    cadence: 'Immediate',
    content: ['workflows moved', 'source and destination team', 'actor.name', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One message per move operation.' },
    configurability: { mandatory: true, channelConfigurable: false, optOut: false, note: 'Admin policy.' }, priority: 'P2', overridesQuietHours: false, requiresAction: false, deeplink: 'admin',
  },

  // ── Dashboards ──
  {
    id: 'DSH-01', module: 'Dashboards', event: 'Dashboard shared with you',
    trigger: 'Dashboard visibility extended to another user or team.', channel: 'both',
    whyThisChannel: 'Same discovery problem as shared reports — recipients have no way to know.',
    recipients: [R('shared-with', 'Each recipient')], watchers: [W('dashboard-owner', 'Dashboard owner (confirmation)')],
    cadence: 'Immediate',
    content: ['dashboard name', 'sharer', 'optional message', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One message per recipient per share operation.' },
    configurability: { mandatory: false, channelConfigurable: true, optOut: false, note: 'Channel configurable.' }, priority: 'P1', overridesQuietHours: false, requiresAction: false, deeplink: 'dashboard',
  },
  {
    id: 'DSH-03', module: 'Dashboards', event: 'Underlying source changed or removed',
    trigger: 'The workflow or Excel/CSV source behind a widget is deleted, moved or re-shaped.', channel: 'both',
    whyThisChannel: 'Breaks the dashboard permanently rather than transiently — needs a durable record.',
    recipients: [R('dashboard-owner', 'Dashboard owner')], watchers: [W('viewers', 'Viewers of shared copies')],
    cadence: 'Immediate',
    content: ['source name', 'what changed', 'affected dashboards and widgets', 'actor.name', 'deeplink'],
    dedup: { kind: 'collapse-by-operation', note: 'One message per source change listing all affected dashboards.' },
    configurability: { mandatory: false, channelConfigurable: true, optOut: false, note: 'Channel configurable.' }, priority: 'P1', overridesQuietHours: false, requiresAction: true, deeplink: 'dashboard',
  },
];

export const NOTIFICATION_MODULES: NotificationModule[] = [
  'Exceptions Management', 'ATR & Reports', 'Engagements', 'Workflows & Data', 'Dashboards',
];

export const eventById = (id: string): NotificationEventDef | undefined => NOTIFICATION_EVENTS.find(e => e.id === id);

export const PRIORITY_LABEL: Record<NotificationPriority, string> = { P0: 'Critical', P1: 'Important', P2: 'FYI' };

/** Default channels for an event: what the map assigns. */
export function defaultChannels(def: NotificationEventDef): NotificationChannel[] {
  switch (def.channel) {
    case 'both': return ['in-app', 'email'];
    case 'email': return ['email'];
    case 'in-app': return ['in-app'];
    case 'in-app+email-opt-in': return ['in-app'];
  }
}

/** Sub-area of Exceptions Management an event belongs to, from its id prefix —
 *  Action Hub (ACT) and Approval chains (APR) live inside that one module. */
export function eventArea(id: string): string {
  if (id.startsWith('ACT-')) return 'Action Hub';
  if (id.startsWith('APR-')) return 'Approval chains';
  if (id.startsWith('EXC-')) return 'Exceptions';
  return '';
}
