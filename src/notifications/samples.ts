// ─── Sample deliveries — one per catalogue event ───
// Realistic content for every Real-time event, built from the platform's own
// demo data (engagement codes, controls, people). Used to seed the centre on
// first run and by "Preview" in Notification preferences, so every rule in the
// map can be seen — in-app row and email — without waiting for the trigger.

import type { NotifyInput, Person } from './types';

const P = (name: string, role: string): Person => ({ name, role });
const OWNER = P('Karan Mehta', 'Engagement owner');
const AUDITOR = P('Tushar Goel', 'Engagement auditor');
const RO = P('Priya Singh', 'Risk Owner');
const RO2 = P('Ayushi Narang', 'Risk Owner');
const PROC = P('Vijay Reddy', 'Process owner');
const ADMIN = P('Nilesh Anand', 'System admin');
const COMPLIANCE = P('Sana Kapoor', 'Compliance');
const ENG = 'ENG-003 · P2P Internal Audit Review';

const SAMPLES: Record<string, NotifyInput> = {
  'EXC-02': {
    eventId: 'EXC-02', title: 'Critical exception raised on CA378 — Three-way match', actor: 'System',
    message: 'EXC003 “Vendor Invoice Approval Bypassed for Transactions Over $50K” was created by run RUN-2291 with severity Critical.',
    facts: [{ label: 'Exception', value: 'EXC003' }, { label: 'Severity', value: 'Critical' }, { label: 'Control', value: 'CA378 · Three-way match enforced before AP posting' }, { label: 'Engagement', value: ENG }, { label: 'Run', value: 'RUN-2291' }],
    recipients: [OWNER, AUDITOR], watchers: [PROC], link: { view: 'manage-exceptions', ref: { kind: 'exception', id: 'EXC003' } }, linkLabel: 'Open exception', operationKey: 'RUN-2291', itemLabel: 'EXC003 · Vendor invoice approval bypassed',
  },
  'EXC-03': {
    eventId: 'EXC-03', title: 'You were assigned EXC001 — Unauthorized admin access via legacy VPN', actor: 'Karan Mehta',
    message: 'Karan Mehta assigned you as Risk Owner. Severity High · control CA212 · ENG-003. Ayushi Narang is also assigned.',
    facts: [{ label: 'Exception', value: 'EXC001' }, { label: 'Severity', value: 'High' }, { label: 'Control', value: 'CA212 · Privileged access review' }, { label: 'Engagement', value: ENG }, { label: 'Assigned by', value: 'Karan Mehta' }, { label: 'Other ROs', value: 'Ayushi Narang' }],
    recipients: [RO], watchers: [OWNER], link: { view: 'manage-exceptions', ref: { kind: 'exception', id: 'EXC001' } }, linkLabel: 'Open exception', dedupKey: 'assign:Priya Singh', itemLabel: 'EXC001 · Unauthorized admin access',
  },
  'EXC-04': {
    eventId: 'EXC-04', title: 'Assignment changed on EXC004', actor: 'Karan Mehta',
    message: 'Karan Mehta removed Vijay Reddy and added Ayushi Narang. Current assignees: Priya Singh, Ayushi Narang.',
    facts: [{ label: 'Exception', value: 'EXC004' }, { label: 'Removed', value: 'Vijay Reddy' }, { label: 'Added', value: 'Ayushi Narang' }, { label: 'Now assigned', value: 'Priya Singh, Ayushi Narang' }],
    recipients: [P('Vijay Reddy', 'Removed RO'), P('Ayushi Narang', 'Added RO')], watchers: [RO, OWNER], link: { view: 'manage-exceptions', ref: { kind: 'exception', id: 'EXC004' } }, linkLabel: 'Open exception', dedupKey: 'EXC004:Karan Mehta',
  },
  'EXC-05': {
    eventId: 'EXC-05', title: '7 exceptions assigned to you', actor: 'Karan Mehta',
    message: 'Karan Mehta bulk-assigned 7 exceptions on ENG-003: 2 Critical · 4 High · 1 Medium, across CA378, CA381 and CA212.',
    facts: [{ label: 'Items', value: '7' }, { label: 'Engagement', value: ENG }, { label: 'Severity split', value: '2 Critical · 4 High · 1 Medium' }, { label: 'Controls', value: 'CA378, CA381, CA212' }, { label: 'Assigned by', value: 'Karan Mehta' }],
    recipients: [RO], watchers: [OWNER], link: { view: 'manage-exceptions' }, linkLabel: 'Open “assigned to me”', operationKey: 'bulk-assign-1',
  },
  'EXC-06': {
    eventId: 'EXC-06', title: 'EXC002 classified as Design Deficiency — your approval is needed', actor: 'Priya Singh',
    message: 'Priya Singh classified EXC002 as True Exception · Design Deficiency. “Bucket policies were never scoped per-environment.” Level 1 of the RO chain is with you.',
    facts: [{ label: 'Exception', value: 'EXC002' }, { label: 'Classification', value: 'True Exception' }, { label: 'Sub-classification', value: 'Design Deficiency' }, { label: 'By', value: 'Priya Singh' }],
    quoted: { by: 'Priya Singh', text: 'Bucket policies were never scoped per-environment; encryption at rest was assumed from the account default.' },
    recipients: [P('Karan Mehta', 'RO chain level 1 approver')], watchers: [AUDITOR], link: { view: 'manage-exceptions', ref: { kind: 'exception', id: 'EXC002' } }, linkLabel: 'Review classification', operationKey: 'cls-EXC002',
  },
  'EXC-07': {
    eventId: 'EXC-07', title: 'Classification rejected — EXC005 is back to Open', actor: 'Tushar Goel',
    message: 'Tushar Goel rejected the classification at Auditor chain level 1. The exception has reverted to Open; your classification and comments are preserved.',
    facts: [{ label: 'Exception', value: 'EXC005 · GDPR requests exceeding 30-day SLA' }, { label: 'Chain / level', value: 'Auditor · Level 1' }, { label: 'Reverted', value: 'Classification → Open (prior work kept)' }],
    quoted: { by: 'Tushar Goel', text: 'Business as Usual isn’t supportable here — 30-day SLA breaches are a statutory exposure. Please reclassify as Procedural Non-Compliance with a plan.' },
    recipients: [RO, RO2], watchers: [OWNER], link: { view: 'manage-exceptions', ref: { kind: 'exception', id: 'EXC005' } }, linkLabel: 'Reclassify',
  },
  'EXC-09': {
    eventId: 'EXC-09', title: 'Closed exception EXC010 reopened', actor: 'Tushar Goel',
    message: 'EXC010 “Duplicate payments to 3 vendors” was Closed and has returned to Open after the completed action was marked Discrepancy. It appears in issued report ATR-2026-014.',
    facts: [{ label: 'Exception', value: 'EXC010' }, { label: 'Previous status', value: 'Closed' }, { label: 'Reason', value: 'Discrepancy on completed action' }, { label: 'Issued report', value: 'ATR-2026-014 — re-issue may be needed' }],
    quoted: { by: 'Tushar Goel', text: 'The recovery evidence covers 2 of the 3 vendors. The third (Meridian Supplies) shows no credit note.' },
    recipients: [RO, P('Ayushi Narang', 'Plan owner')], watchers: [AUDITOR, OWNER], link: { view: 'manage-exceptions', ref: { kind: 'exception', id: 'EXC010' } }, linkLabel: 'Open exception',
  },
  'EXC-15': {
    eventId: 'EXC-15', title: 'Karan Mehta commented on EXC003', actor: 'Karan Mehta',
    message: '“@Priya Singh can you attach the approval matrix that was in force in Q3? The bypass may predate the current threshold.”',
    facts: [{ label: 'Exception', value: 'EXC003' }],
    recipients: [RO], watchers: [P('Priya Singh', '@mentioned')], link: { view: 'manage-exceptions', ref: { kind: 'exception', id: 'EXC003' } }, linkLabel: 'Open comment', dedupKey: 'EXC003:Karan Mehta', mention: true,
  },
  'ACT-01': {
    eventId: 'ACT-01', title: 'Management action plan MAP-0007 created for you', actor: 'Priya Singh',
    message: '“Enforce dual approval above $50K in the AP workflow” — due 30 Nov 2026, covering 3 exceptions classified Design Deficiency.',
    facts: [{ label: 'Plan', value: 'MAP-0007' }, { label: 'Due', value: '30 Nov 2026' }, { label: 'Scope', value: 'Bulk · 3 exceptions' }, { label: 'Sub-classification', value: 'Design Deficiency' }, { label: 'Created by', value: 'Priya Singh' }],
    recipients: [P('Ayushi Narang', 'Plan owner')], watchers: [AUDITOR, OWNER], link: { view: 'manage-exceptions' }, linkLabel: 'Open plan', operationKey: 'cls-bulk-7',
  },
  'ACT-02': {
    eventId: 'ACT-02', title: 'You now own MAP-0004 — Vendor master maker-checker', actor: 'Karan Mehta',
    message: 'Karan Mehta moved ownership from Vijay Reddy to you. Due 15 Oct 2026 · 40% progress.',
    facts: [{ label: 'Plan', value: 'MAP-0004' }, { label: 'Due', value: '15 Oct 2026' }, { label: 'Progress', value: '40%' }, { label: 'Previous owner', value: 'Vijay Reddy' }],
    recipients: [P('Priya Singh', 'New owner'), P('Vijay Reddy', 'Previous owner')], watchers: [OWNER, AUDITOR], link: { view: 'manage-exceptions' }, linkLabel: 'Open plan',
  },
  'ACT-05': {
    eventId: 'ACT-05', title: 'Due date changed on MAP-0004 after approval', actor: 'Priya Singh',
    message: 'Priya Singh moved the due date from 15 Oct 2026 to 30 Nov 2026. Justification: “SAP transport window is frozen until the quarter close.”',
    facts: [{ label: 'Plan', value: 'MAP-0004' }, { label: 'Old due', value: '15 Oct 2026' }, { label: 'New due', value: '30 Nov 2026' }],
    recipients: [AUDITOR], watchers: [OWNER, P('Priya Singh', 'Plan owner')], link: { view: 'manage-exceptions' }, linkLabel: 'Open plan',
  },
  'ACT-06': {
    eventId: 'ACT-06', title: 'Action taken on MAP-0004 — awaiting your verification', actor: 'Priya Singh',
    message: 'Priya Singh recorded the action taken with 2 evidence files. RO chain level 1 is with you; the auditor is notified once you decide.',
    facts: [{ label: 'Plan', value: 'MAP-0004' }, { label: 'Covers', value: 'EXC004, EXC009' }, { label: 'Evidence', value: 'SAP_maker_checker_config.pdf, change_log_Q3.xlsx' }, { label: 'Level', value: 'RO chain · Level 1' }],
    quoted: { by: 'Priya Singh', text: 'Maker-checker enforced in SAP MM for all vendor master changes from 12 Sep. Re-tested 40 changes; 0 single-actor.' },
    recipients: [P('Karan Mehta', 'RO chain approver')], watchers: [OWNER], link: { view: 'manage-exceptions' }, linkLabel: 'Review action taken', operationKey: 'sub-MAP-0004-1',
  },
  'ACT-07': {
    eventId: 'ACT-07', title: 'Action taken on MAP-0002 accepted', actor: 'Tushar Goel',
    message: 'Both chains approved. EXC006 and EXC008 are now Closed · plan progress 100%.',
    facts: [{ label: 'Plan', value: 'MAP-0002' }, { label: 'Closed', value: 'EXC006, EXC008' }, { label: 'Progress', value: '100%' }],
    recipients: [P('Priya Singh', 'Submitter'), P('Priya Singh', 'Plan owner')], watchers: [], link: { view: 'manage-exceptions' }, linkLabel: 'Open plan', dedupKey: 'MAP-0002',
  },
  'ACT-08': {
    eventId: 'ACT-08', title: 'Action taken on MAP-0007 sent back', actor: 'Tushar Goel',
    message: 'Tushar Goel returned the submission at Auditor chain level 2. EXC003 and EXC007 revert to In-Progress with your work preserved.',
    facts: [{ label: 'Plan', value: 'MAP-0007' }, { label: 'Chain / level', value: 'Auditor · Level 2' }, { label: 'Affected', value: 'EXC003, EXC007' }],
    quoted: { by: 'Tushar Goel', text: 'The evidence shows the rule was configured, not that it fired. Attach a sample of blocked invoices above $50K from the last 30 days.' },
    recipients: [P('Ayushi Narang', 'Submitter'), P('Ayushi Narang', 'Plan owner')], watchers: [OWNER], link: { view: 'manage-exceptions' }, linkLabel: 'Rework submission',
  },
  'ACT-09': {
    eventId: 'ACT-09', title: 'Auditor outcome on MAP-0004: Discrepancy', actor: 'Tushar Goel',
    message: 'Tushar Goel recorded Discrepancy. Remaining work: re-run the maker-checker sample with the 3 late-September changes included.',
    facts: [{ label: 'Plan', value: 'MAP-0004' }, { label: 'Outcome', value: 'Discrepancy' }, { label: 'Reviewed by', value: 'Tushar Goel' }, { label: 'Remaining', value: 'Re-run sample incl. late-Sep changes' }],
    quoted: { by: 'Tushar Goel', text: 'Three changes on 28–30 Sep were single-actor. The control was not operating for the full period.' },
    recipients: [P('Priya Singh', 'Plan owner')], watchers: [OWNER, PROC, COMPLIANCE], link: { view: 'manage-exceptions' }, linkLabel: 'Open plan',
  },
  'ACT-11': {
    eventId: 'ACT-11', title: 'MAP-0002 fully closed', actor: 'System',
    message: 'All linked exceptions are Closed. Completed 12 days before the 30 Sep 2026 due date.',
    facts: [{ label: 'Plan', value: 'MAP-0002' }, { label: 'Progress', value: '100%' }, { label: 'Elapsed vs due', value: '12 days early' }],
    recipients: [P('Priya Singh', 'Plan owner'), AUDITOR], watchers: [OWNER], link: { view: 'manage-exceptions' }, linkLabel: 'Open plan',
  },
  'ACT-12': {
    eventId: 'ACT-12', title: 'Bulk classification touched 21 exceptions', actor: 'Priya Singh',
    message: 'Priya Singh bulk-classified 21 exceptions as Business as Usual across CA381 and CA212.',
    facts: [{ label: 'Items', value: '21' }, { label: 'Operation', value: 'Bulk classify' }, { label: 'By', value: 'Priya Singh' }, { label: 'Controls', value: 'CA381, CA212' }],
    recipients: [P('Ayushi Narang', 'Affected owner')], watchers: [AUDITOR, OWNER], link: { view: 'manage-exceptions' }, linkLabel: 'Open exceptions', operationKey: 'bulk-cls-21',
  },
  'APR-01': {
    eventId: 'APR-01', title: 'Approval requested — RO chain level 1', actor: 'Priya Singh',
    message: 'Priya Singh submitted the classification of EXC002 (Design Deficiency) for approval. Level 1 of 2 in the RO chain is with you.',
    facts: [{ label: 'Approving', value: 'Classification' }, { label: 'Item', value: 'EXC002' }, { label: 'Chain / level', value: 'RO · Level 1 of 2' }, { label: 'Submitter', value: 'Priya Singh' }],
    quoted: { by: 'Priya Singh', text: 'Design gap: no environment-scoped bucket policy exists. Plan MAP-0009 attached.' },
    recipients: [P('Karan Mehta', 'Level 1 approver')], watchers: [P('Priya Singh', 'Submitter')], link: { view: 'manage-exceptions' }, linkLabel: 'Decide', operationKey: 'apr-EXC002', itemLabel: 'EXC002 · classification',
  },
  'APR-02': {
    eventId: 'APR-02', title: 'Approval requested — Auditor chain level 1', actor: 'Karan Mehta',
    message: 'The RO chain approved EXC002 (Karan Mehta, 2 levels). Level 1 of 2 in the Auditor chain is with you.',
    facts: [{ label: 'Item', value: 'EXC002 · classification' }, { label: 'RO chain', value: 'Approved · 2 levels' }, { label: 'Chain / level', value: 'Auditor · Level 1 of 2' }],
    recipients: [P('Tushar Goel', 'Level 1 approver')], watchers: [P('Priya Singh', 'Submitter')], link: { view: 'manage-exceptions' }, linkLabel: 'Decide', operationKey: 'apr-EXC002-aud',
  },
  'APR-03': {
    eventId: 'APR-03', title: 'RO chain level 1 approved on EXC002', actor: 'Karan Mehta',
    message: 'Karan Mehta approved. 1 level remains in the RO chain, then 2 in the Auditor chain.',
    facts: [{ label: 'Completed', value: 'RO · Level 1' }, { label: 'Approver', value: 'Karan Mehta' }, { label: 'Remaining', value: 'RO L2 → Auditor L1, L2' }],
    recipients: [P('Vijay Reddy', 'Next approver')], watchers: [P('Priya Singh', 'Submitter')], link: { view: 'manage-exceptions' }, linkLabel: 'Open chain', dedupKey: 'sub:Priya Singh',
  },
  'APR-04': {
    eventId: 'APR-04', title: 'Rejected at Auditor level 2 — EXC002 back to Open', actor: 'Vijay Reddy',
    message: 'Vijay Reddy rejected the classification. Approvals at RO L1, RO L2 and Auditor L1 have been undone; the exception is Open with prior work preserved.',
    facts: [{ label: 'Item', value: 'EXC002' }, { label: 'Level', value: 'Auditor · Level 2' }, { label: 'Reverted', value: 'Open · 3 prior approvals undone' }],
    quoted: { by: 'Vijay Reddy', text: 'Classification is fine but the plan due date is after the FY close. Bring MAP-0009 forward to 15 Dec.' },
    recipients: [P('Priya Singh', 'Submitter')], watchers: [P('Karan Mehta', 'Prior approver'), P('Tushar Goel', 'Prior approver'), P('Ayushi Narang', 'Plan owner'), OWNER], link: { view: 'manage-exceptions' }, linkLabel: 'Open exception',
  },
  'APR-05': {
    eventId: 'APR-05', title: 'Final approval completed on MAP-0002', actor: 'Vijay Reddy',
    message: 'Both chains are complete. Next step: none — the linked exceptions are Closed.',
    facts: [{ label: 'Item', value: 'MAP-0002 · action taken' }, { label: 'RO chain', value: 'Karan Mehta · 14 Sep 09:12 → Vijay Reddy · 14 Sep 11:40' }, { label: 'Auditor chain', value: 'Tushar Goel · 15 Sep 10:05' }, { label: 'Next', value: 'Closed' }],
    recipients: [P('Priya Singh', 'Submitter'), P('Priya Singh', 'Plan owner')], watchers: [OWNER, AUDITOR], link: { view: 'manage-exceptions' }, linkLabel: 'Open plan', operationKey: 'final-MAP-0002',
  },
  'APR-07': {
    eventId: 'APR-07', title: 'Karan Mehta delegated their approvals to you', actor: 'Karan Mehta',
    message: 'Out of office 18–25 Sep. You inherit 6 waiting approvals on ENG-003; the oldest has waited 4 days.',
    facts: [{ label: 'Delegating approver', value: 'Karan Mehta' }, { label: 'Period', value: '18–25 Sep 2026' }, { label: 'Inherited', value: '6 items' }, { label: 'Oldest waiting', value: '4 days · EXC002' }],
    recipients: [P('Vijay Reddy', 'Delegate')], watchers: [P('Karan Mehta', 'Original approver'), P('Priya Singh', 'Submitter'), OWNER], link: { view: 'manage-exceptions' }, linkLabel: 'Open approval queue', operationKey: 'deleg-1',
  },
  'APR-08': {
    eventId: 'APR-08', title: 'Approval depth changed on ENG-003', actor: 'Karan Mehta',
    message: 'Auditor chain depth changed from 1 to 2. 4 in-flight items now need a second auditor decision.',
    facts: [{ label: 'Chain', value: 'Auditor' }, { label: 'Old depth', value: '1' }, { label: 'New depth', value: '2' }, { label: 'In-flight items', value: '4 need one more decision' }],
    recipients: [P('Tushar Goel', 'Chain member'), P('Vijay Reddy', 'Chain member')], watchers: [OWNER, AUDITOR, COMPLIANCE], link: { view: 'engagement-overview', ref: { kind: 'engagement', id: 'ef-001' } }, linkLabel: 'Open configuration',
  },
  'APR-09': {
    eventId: 'APR-09', title: 'Your manager in the approval flow changed', actor: 'Nilesh Anand',
    message: 'Nilesh Anand re-parented you under Karan Mehta on the Approval Flow tab. Escalations now route to Karan.',
    facts: [{ label: 'Change', value: 'Re-parented' }, { label: 'New manager', value: 'Karan Mehta' }],
    recipients: [P('Priya Singh', 'Affected member')], watchers: [P('Karan Mehta', 'Manager'), OWNER], link: { view: 'engagement-overview', ref: { kind: 'engagement', id: 'ef-001' } }, linkLabel: 'Open approval flow', dedupKey: 'Priya Singh',
  },
  'APR-10': {
    eventId: 'APR-10', title: 'Access request: Sana Kapoor → Auditor role on ENG-003', actor: 'Sana Kapoor',
    message: '“Covering Tushar during fieldwork week.” Current access: Viewer. Reminder in 24h, escalates at 72h.',
    facts: [{ label: 'Requester', value: 'Sana Kapoor' }, { label: 'Requested', value: 'Role change → Auditor' }, { label: 'Current access', value: 'Viewer' }],
    recipients: [P('Nilesh Anand', 'Approver')], watchers: [P('Nilesh Anand', 'Team admin')], link: { view: 'admin-users' }, linkLabel: 'Decide request',
  },
  'APR-11': {
    eventId: 'APR-11', title: 'Your access request was granted', actor: 'Nilesh Anand',
    message: 'Nilesh Anand granted Auditor on ENG-003 until 30 Sep 2026. “Approved for fieldwork cover.”',
    facts: [{ label: 'Decision', value: 'Granted' }, { label: 'Approver', value: 'Nilesh Anand' }, { label: 'Now effective', value: 'Auditor on ENG-003 (to 30 Sep)' }],
    quoted: { by: 'Nilesh Anand', text: 'Approved for fieldwork cover.' },
    recipients: [P('Sana Kapoor', 'Requester')], watchers: [ADMIN], link: { view: 'admin-users' }, linkLabel: 'Open access',
  },
  'ATR-01': {
    eventId: 'ATR-01', title: 'Report created from “Internal Audit Report”', actor: 'Tushar Goel',
    message: 'Tushar Goel created IA-2026-021 on ENG-003 from the Internal Audit Report template.',
    facts: [{ label: 'Report', value: 'IA-2026-021' }, { label: 'Type', value: 'Internal Audit Report' }, { label: 'Template', value: 'Internal Audit Report' }],
    recipients: [OWNER], watchers: [], link: { view: 'reports' }, linkLabel: 'Open report',
  },
  'ATR-02': {
    eventId: 'ATR-02', title: 'ATR generated by upload — “Q3 Procurement Review”', actor: 'Nilesh Anand',
    message: '6 observations · 11 action plans · audit period Jul–Sep 2026. Saved to My Reports.',
    facts: [{ label: 'Report', value: 'Q3 Procurement Review' }, { label: 'Observations', value: '6' }, { label: 'Action plans', value: '11' }, { label: 'Audit period', value: 'Jul–Sep 2026' }],
    recipients: [OWNER, AUDITOR], watchers: [], link: { view: 'reports' }, linkLabel: 'Open report',
  },
  'ATR-03': {
    eventId: 'ATR-03', title: 'ATR-2026-014 issued with readiness incomplete', actor: 'Karan Mehta',
    message: 'Issued with 2 of 4 gates unmet: Action Taken (3 pending) and Auditor Review Complete (5 pending). 8 cases still open.',
    facts: [{ label: 'Report', value: 'ATR-2026-014' }, { label: 'Gates', value: 'Classified ✓ · Plan ✓ · Action Taken ✗ · Auditor Review ✗' }, { label: 'Open cases', value: '8' }, { label: 'Issued by', value: 'Karan Mehta' }],
    recipients: [OWNER, AUDITOR], watchers: [COMPLIANCE], link: { view: 'reports' }, linkLabel: 'Open report',
  },
  'ATR-04': {
    eventId: 'ATR-04', title: 'ATR-2026-014 is now Public to the team', actor: 'Karan Mehta',
    message: 'Visibility changed from Private to Public — everyone on the team can open it.',
    facts: [{ label: 'Report', value: 'ATR-2026-014' }, { label: 'Was', value: 'Private' }, { label: 'Now', value: 'Public' }],
    recipients: [P('Karan Mehta', 'Report owner')], watchers: [P('Team', 'The team')], link: { view: 'reports' }, linkLabel: 'Open report',
  },
  'ATR-05': {
    eventId: 'ATR-05', title: 'Karan Mehta shared “FY26 Q1 — Procure-to-Pay Controls ATR” with you', actor: 'Karan Mehta',
    message: '“Please review the vendor-master observations before Thursday’s committee.” Audit period FY26 Q1.',
    facts: [{ label: 'Report', value: 'FY26 Q1 — Procure-to-Pay Controls ATR' }, { label: 'Type', value: 'Action Taken Report' }, { label: 'Shared by', value: 'Karan Mehta' }, { label: 'Audit period', value: 'FY26 Q1 (Jan–Mar 2026)' }],
    recipients: [P('Priya Singh', 'Recipient')], watchers: [P('Karan Mehta', 'Report owner')], link: { view: 'reports', ref: { kind: 'report', id: 'gr-atr-lib-001' } }, linkLabel: 'Open report', operationKey: 'share-1',
  },
  'ATR-07': {
    eventId: 'ATR-07', title: 'Issued report ATR-2026-014 has drifted from live data', actor: 'Tushar Goel',
    message: 'Observation 2 “Vendor master data changes without approval”: action plan status Implemented → Partially Implemented after a Discrepancy outcome. A re-issue is recommended.',
    facts: [{ label: 'Report', value: 'ATR-2026-014 (issued 10 Sep)' }, { label: 'Changed', value: 'OBS-02 · MAP-0004 status' }, { label: 'Old → new', value: 'Implemented → Partially Implemented' }, { label: 'By', value: 'Tushar Goel' }, { label: 'Re-issue', value: 'Recommended' }],
    recipients: [OWNER, AUDITOR], watchers: [P('Board pack recipients', 'Shared with')], link: { view: 'reports' }, linkLabel: 'Open Report Snapshot', dedupKey: 'ATR-2026-014',
  },
  'ATR-08': {
    eventId: 'ATR-08', title: 'Snapshot v3 of ATR-2026-014 locked for circulation', actor: 'Karan Mehta',
    message: 'Locked 17 Sep 2026, 16:40 IST. Versus v2: 2 observations updated, 1 action plan verified. Read v3 — the live page keeps changing.',
    facts: [{ label: 'Report', value: 'ATR-2026-014' }, { label: 'Version', value: 'v3' }, { label: 'Locked by', value: 'Karan Mehta' }, { label: 'Diff vs v2', value: '2 observations updated · 1 plan verified' }],
    recipients: [P('Priya Singh', 'Shared with'), P('Vijay Reddy', 'Shared with')], watchers: [OWNER, AUDITOR], link: { view: 'reports' }, linkLabel: 'Open v3', operationKey: 'snap-ATR-2026-014-v3',
  },
  'ATR-09': {
    eventId: 'ATR-09', title: 'Edit conflict on ATR-2026-014 — Executive Summary', actor: 'System',
    message: 'Tushar Goel saved at 15:02; your unsaved edit from 14:58 overlaps the same section. Review the diff before saving again.',
    facts: [{ label: 'Report', value: 'ATR-2026-014' }, { label: 'Section', value: 'Executive Summary' }, { label: 'Editors', value: 'Tushar Goel (15:02) · Karan Mehta (14:58)' }, { label: 'Recovery', value: 'Review diff, then save' }],
    recipients: [P('Karan Mehta', 'Editor'), P('Tushar Goel', 'Editor')], watchers: [P('Karan Mehta', 'Report owner')], link: { view: 'reports' }, linkLabel: 'Review conflict',
  },
  'ATR-10': {
    eventId: 'ATR-10', title: 'Working-paper run generated on ENG-003', actor: 'System',
    message: 'Run finished COMPLETE: 48 controls, 50 cards.',
    facts: [{ label: 'Run', value: '17 Sep 2026, 14:20 IST' }, { label: 'Controls', value: '48' }, { label: 'Cards', value: '50' }, { label: 'Status', value: 'COMPLETE' }],
    recipients: [P('Tushar Goel', 'Initiating auditor')], watchers: [OWNER], link: { view: 'engagement-overview', ref: { kind: 'engagement', id: 'ef-001' } }, linkLabel: 'Open Audit Report',
  },
  'ATR-11': {
    eventId: 'ATR-11', title: 'Working-paper run finished PARTIAL on ENG-003', actor: 'System',
    message: '45 of 48 controls produced a card. CA381, CA390 and CA402 produced none — no linked workflow output for the period.',
    facts: [{ label: 'Covered', value: '45 of 48 controls' }, { label: 'No card', value: 'CA381, CA390, CA402' }, { label: 'Why', value: 'No workflow output for the period' }],
    recipients: [P('Tushar Goel', 'Initiating auditor')], watchers: [OWNER], link: { view: 'engagement-overview', ref: { kind: 'engagement', id: 'ef-001' } }, linkLabel: 'Open Audit Report', operationKey: 'wp-run-17',
  },
  'ENG-01': {
    eventId: 'ENG-01', title: 'You own new engagement ENG-011 — O2C Revenue Assurance', actor: 'Nilesh Anand',
    message: 'Internal Audit · O2C · 1 Oct – 31 Dec 2026. Created by Nilesh Anand as Draft.',
    facts: [{ label: 'Engagement', value: 'ENG-011 · O2C Revenue Assurance' }, { label: 'Type', value: 'Internal Audit' }, { label: 'Process', value: 'O2C' }, { label: 'Period', value: '1 Oct – 31 Dec 2026' }],
    recipients: [P('Karan Mehta', 'Named owner')], watchers: [], link: { view: 'engagements' }, linkLabel: 'Open engagement',
  },
  'ENG-02': {
    eventId: 'ENG-02', title: 'ENG-011 kicked off — you’re the Engagement auditor', actor: 'Karan Mehta',
    message: 'O2C Revenue Assurance is Active. Period 1 Oct – 31 Dec 2026 · approval depth RO 2 / Auditor 1.',
    facts: [{ label: 'Engagement', value: 'ENG-011 · O2C Revenue Assurance' }, { label: 'Period', value: '1 Oct – 31 Dec 2026' }, { label: 'Approval depths', value: 'RO 2 · Auditor 1' }, { label: 'Your role', value: 'Engagement auditor' }],
    recipients: [AUDITOR], watchers: [PROC], link: { view: 'engagements' }, linkLabel: 'Open engagement', operationKey: 'kickoff-ENG-011',
  },
  'ENG-03': {
    eventId: 'ENG-03', title: 'You are now the owner of ENG-003', actor: 'Nilesh Anand',
    message: 'Ownership moved from Karan Mehta. 8 exceptions open · 2 plans overdue.',
    facts: [{ label: 'Engagement', value: ENG }, { label: 'Previous owner', value: 'Karan Mehta' }, { label: 'Open exceptions', value: '8' }, { label: 'Overdue plans', value: '2' }],
    recipients: [P('Vijay Reddy', 'New owner'), P('Karan Mehta', 'Previous owner')], watchers: [AUDITOR], link: { view: 'engagement-overview', ref: { kind: 'engagement', id: 'ef-001' } }, linkLabel: 'Open engagement',
  },
  'ENG-04': {
    eventId: 'ENG-04', title: 'ENG-007 moved to Completed', actor: 'Karan Mehta',
    message: 'Vendor Risk Assessment is Completed. Nothing remains open.',
    facts: [{ label: 'Engagement', value: 'ENG-007 · Vendor Risk Assessment' }, { label: 'New status', value: 'Completed' }, { label: 'Remaining open', value: 'None' }],
    recipients: [P('Priya Singh', 'Participant')], watchers: [], link: { view: 'engagements' }, linkLabel: 'Open engagement', operationKey: 'close-ENG-007',
  },
  'ENG-05': {
    eventId: 'ENG-05', title: 'ENG-004 closed with 5 unresolved exceptions', actor: 'Karan Mehta',
    message: 'Completed with 3 Open (2 unclassified) and 2 In-Progress exceptions; 1 plan overdue. Closed by Karan Mehta.',
    facts: [{ label: 'Engagement', value: 'ENG-004 · S2C Contract Review' }, { label: 'Open', value: '3 (2 unclassified)' }, { label: 'In-Progress', value: '2' }, { label: 'Overdue plans', value: '1' }, { label: 'Closed by', value: 'Karan Mehta' }],
    recipients: [OWNER, AUDITOR], watchers: [COMPLIANCE], link: { view: 'engagements' }, linkLabel: 'Open engagement',
  },
  'ENG-10': {
    eventId: 'ENG-10', title: 'Standing instruction changed on ENG-003', actor: 'Karan Mehta',
    message: '“Treat invoices under ₹10,000 as immaterial” → “Treat invoices under ₹25,000 as immaterial”. Applies to every future run.',
    facts: [{ label: 'Before', value: 'Under ₹10,000 immaterial' }, { label: 'After', value: 'Under ₹25,000 immaterial' }, { label: 'Engagement', value: ENG }, { label: 'Effect', value: 'All future runs' }],
    recipients: [AUDITOR, OWNER], watchers: [COMPLIANCE], link: { view: 'engagement-overview', ref: { kind: 'engagement', id: 'ef-001' } }, linkLabel: 'Open Memory', dedupKey: 'ENG-003',
  },
  'WFL-01': {
    eventId: 'WFL-01', title: 'WF-P2P-001 Three-Way Match run completed', actor: 'System',
    message: 'RUN-2305 finished Success in 2m 41s · 47 rows checked · 3 exceptions raised.',
    facts: [{ label: 'Workflow', value: 'WF-P2P-001' }, { label: 'Run', value: 'RUN-2305' }, { label: 'Status', value: 'Success' }, { label: 'Duration', value: '2m 41s' }, { label: 'Exceptions raised', value: '3' }],
    recipients: [P('Nilesh Anand', 'Configured recipient')], watchers: [], link: { view: 'workflow-library' }, linkLabel: 'Open run',
  },
  'WFL-02': {
    eventId: 'WFL-02', title: 'Workflow WF-P2P-004 failed — Vendor Master Change Monitor', actor: 'System',
    message: 'Run RUN-2304 ended in Error: “SAP RFC timeout after 120s”. Last successful run 16 Sep 08:00. Affects CA212 on ENG-003.',
    facts: [{ label: 'Workflow', value: 'WF-P2P-004' }, { label: 'Run', value: 'RUN-2304' }, { label: 'Error', value: 'SAP RFC timeout after 120s' }, { label: 'Last success', value: '16 Sep 2026, 08:00' }, { label: 'Affected control', value: 'CA212' }, { label: 'Engagement', value: ENG }],
    recipients: [P('Nilesh Anand', 'Workflow owner'), OWNER], watchers: [ADMIN], link: { view: 'workflow-library' }, linkLabel: 'Open run', dedupKey: 'WF-P2P-004:SAP RFC timeout',
  },
  'WFL-06': {
    eventId: 'WFL-06', title: 'WF-P2P-002 Duplicate Invoice Detector published v4', actor: 'Nilesh Anand',
    message: 'Draft → Live. Fuzzy match threshold lowered to 0.85; PAN normalisation added. Affects ENG-003 and ENG-004.',
    facts: [{ label: 'Workflow', value: 'WF-P2P-002' }, { label: 'Version', value: 'v4' }, { label: 'Changed', value: 'Fuzzy threshold 0.9 → 0.85 · PAN normalisation' }, { label: 'Affected engagements', value: 'ENG-003, ENG-004' }],
    recipients: [OWNER, AUDITOR], watchers: [COMPLIANCE], link: { view: 'workflow-library' }, linkLabel: 'Open version history', operationKey: 'pub-WF-P2P-002-v4',
  },
  'WFL-07': {
    eventId: 'WFL-07', title: 'Bulk run finished — 5 workflows, 1 failed', actor: 'System',
    message: '4 passed · 1 failed (WF-P2P-004) in 6m 12s. 47 exceptions raised.',
    facts: [{ label: 'Workflows', value: 'WF-P2P-001 … WF-P2P-005' }, { label: 'Pass / fail', value: '4 / 1' }, { label: 'Duration', value: '6m 12s' }, { label: 'Exceptions raised', value: '47' }, { label: 'Failed', value: 'WF-P2P-004 · SAP RFC timeout' }],
    recipients: [P('Tushar Goel', 'Initiator')], watchers: [P('Nilesh Anand', 'Owner of failed workflow')], link: { view: 'workflow-library' }, linkLabel: 'Open bulk run', operationKey: 'bulk-run-9',
  },
  'WFL-08': {
    eventId: 'WFL-08', title: 'Ingestion failed — emaar_payments_q3.xlsx', actor: 'System',
    message: 'Excel · 84,120 rows attempted · “Sheet ‘Payments’ has merged header cells in row 3”. Dependent workflows: WF-P2P-001, WF-P2P-002.',
    facts: [{ label: 'Source', value: 'emaar_payments_q3.xlsx' }, { label: 'Type', value: 'Excel' }, { label: 'Error', value: 'Merged header cells in row 3' }, { label: 'Rows attempted', value: '84,120' }, { label: 'Dependent workflows', value: 'WF-P2P-001, WF-P2P-002' }],
    recipients: [P('Priya Singh', 'Uploader'), ADMIN], watchers: [OWNER], link: { view: 'knowledge-hub' }, linkLabel: 'Open data source', dedupKey: 'emaar_payments_q3.xlsx',
  },
  'WFL-09': {
    eventId: 'WFL-09', title: 'Connection lost — SAP ECC (Finance) database', actor: 'System',
    message: 'Credentials expired at 03:12 IST. Last successful query 02:58. 6 workflows and 3 engagements depend on it. Re-alerting every 4h while down.',
    facts: [{ label: 'Connection', value: 'SAP ECC (Finance)' }, { label: 'Error', value: 'Credentials expired' }, { label: 'Last successful query', value: '17 Sep 2026, 02:58 IST' }, { label: 'Dependent', value: '6 workflows · 3 engagements' }],
    recipients: [ADMIN], watchers: [OWNER], link: { view: 'knowledge-hub' }, linkLabel: 'Open connection', dedupKey: 'SAP ECC (Finance)',
  },
  'WFL-10': {
    eventId: 'WFL-10', title: 'Bulk upload: 11 files accepted, 2 rejected', actor: 'System',
    message: '13 files · 312,440 rows. Rejected: 1 password-protected workbook, 1 empty CSV.',
    facts: [{ label: 'Accepted', value: '11 files' }, { label: 'Rejected', value: '2 files' }, { label: 'Rows', value: '312,440' }, { label: 'Reasons', value: 'Password-protected (1) · Empty (1)' }],
    recipients: [P('Priya Singh', 'Uploader')], watchers: [], link: { view: 'knowledge-hub' }, linkLabel: 'Open error report', operationKey: 'upload-33',
  },
  'WFL-12': {
    eventId: 'WFL-12', title: '3 workflows moved from SOX Audit to Internal Audit', actor: 'Nilesh Anand',
    message: 'WF-P2P-001, WF-P2P-002 and WF-P2P-004 now belong to the Internal Audit team.',
    facts: [{ label: 'Workflows', value: 'WF-P2P-001, WF-P2P-002, WF-P2P-004' }, { label: 'From → to', value: 'SOX Audit → Internal Audit' }, { label: 'By', value: 'Nilesh Anand' }],
    recipients: [P('Ayushi Narang', 'SOX Audit admin'), P('Karan Mehta', 'Internal Audit admin')], watchers: [OWNER], link: { view: 'admin-users' }, linkLabel: 'Open Move Workflows', operationKey: 'move-4',
  },
  'DSH-01': {
    eventId: 'DSH-01', title: 'Karan Mehta shared the dashboard “P2P Control Health” with you', actor: 'Karan Mehta',
    message: '“Weekly view for the steering committee — filters are saved.”',
    facts: [{ label: 'Dashboard', value: 'P2P Control Health' }, { label: 'Shared by', value: 'Karan Mehta' }],
    recipients: [P('Priya Singh', 'Recipient')], watchers: [P('Karan Mehta', 'Dashboard owner')], link: { view: 'dashboards' }, linkLabel: 'Open dashboard', operationKey: 'dsh-share-2',
  },
  'DSH-03': {
    eventId: 'DSH-03', title: 'A source behind “P2P Control Health” was removed', actor: 'Nilesh Anand',
    message: 'emaar_payments_q1.xlsx was deleted from Data Sources. 2 dashboards · 5 widgets are affected.',
    facts: [{ label: 'Source', value: 'emaar_payments_q1.xlsx' }, { label: 'Change', value: 'Deleted' }, { label: 'Affected', value: 'P2P Control Health (3 widgets) · Vendor Risk (2 widgets)' }, { label: 'By', value: 'Nilesh Anand' }],
    recipients: [P('Karan Mehta', 'Dashboard owner')], watchers: [P('Priya Singh', 'Viewer')], link: { view: 'dashboards' }, linkLabel: 'Open dashboard', operationKey: 'src-del-1',
  },
};

export function sampleInput(eventId: string): NotifyInput | undefined {
  return SAMPLES[eventId];
}
export const SAMPLE_EVENT_IDS = Object.keys(SAMPLES);
