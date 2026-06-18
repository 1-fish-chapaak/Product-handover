/**
 * Engagement-level activity trail (events) + daily aggregates.
 *
 * Used by the Action Trail tab on EngagementOverviewView. Every event is
 * scoped to an engagement and (optionally) a workflow so the page can filter
 * by workflow.
 *
 * Day-offsets are relative to "today" — render layer formats them to dates.
 */

export type ActivityType =
  | 'workflow_run'         // a linked workflow completed (success / fail)
  | 'exception_fired'      // a new exception was raised
  | 'exception_assigned'   // exception assigned to someone
  | 'exception_classified' // risk-owner classified the exception
  | 'exception_closed'     // exception resolved / closed
  | 'evidence_uploaded'    // working paper / sample uploaded
  | 'control_tested'       // control test completed (Compliance / IA)
  | 'comment_added'        // comment on engagement / exception
  | 'status_changed'       // engagement status moved
  | 'signoff';             // reviewer signed off

export interface ActivityEvent {
  id: string;
  engagementId: string;
  type: ActivityType;
  actor: string;
  /** Days ago (0 = today, 1 = yesterday, ...). */
  dayOffset: number;
  /** Hour of the day, 0-23. */
  hour: number;
  title: string;
  detail?: string;
  workflowId?: string;
  workflowName?: string;
  refId?: string;
}

/** Buckets used for the daily new/closed chart and the New/Closed KPIs. */
export type DailyBucket = { dayOffset: number; created: number; closed: number };

/** Roll events up into a daily new-vs-closed series across the given range. */
export function dailyCounts(events: ActivityEvent[], rangeDays = 30): DailyBucket[] {
  const buckets: DailyBucket[] = Array.from({ length: rangeDays }, (_, i) => ({
    dayOffset: rangeDays - 1 - i, // oldest first → today last
    created: 0,
    closed: 0,
  }));
  events.forEach(ev => {
    if (ev.dayOffset >= rangeDays) return;
    const idx = rangeDays - 1 - ev.dayOffset;
    if (idx < 0 || idx >= buckets.length) return;
    if (ev.type === 'exception_fired') buckets[idx].created += 1;
    if (ev.type === 'exception_closed') buckets[idx].closed += 1;
  });
  return buckets;
}

/** Format a day offset to a short display string. */
export function formatDay(offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Yesterday';
  if (offset < 7) return `${offset}d ago`;
  // For older dates, render a static demo date — every offset corresponds to
  // a real day relative to today (2026-05-15), but the prototype displays
  // them as relative strings for simplicity.
  return `${offset}d ago`;
}

/** Format a day offset to a chart-axis date label (e.g. "May 14"). */
export function formatChartDay(offset: number): string {
  // Anchor on 2026-05-15 (today). Stepping back N days.
  const today = new Date('2026-05-15T00:00:00Z');
  const d = new Date(today.getTime() - offset * 86400000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Seed data ────────────────────────────────────────────────────────────────

/**
 * Per-engagement event list. Engagements without an entry get an empty trail
 * in the UI (with an empty-state). We seed rich data for three demo
 * engagements (one of each type) so the Action Trail tab feels real.
 */
export const ENGAGEMENT_ACTIVITY: Record<string, ActivityEvent[]> = {
  // ─── Compliance — P2P SOX Audit ────────────────────────────────────────────
  'eng-1': [
    { id: 'a-1-1',  engagementId: 'eng-1', type: 'exception_fired',      actor: 'System',       dayOffset: 0,  hour: 9,  title: 'New exception — payment release missing dual sign-off', detail: 'Control P2P-C-06 · ₹14.5L', workflowId: 'wf3', workflowName: 'PO Approval Threshold Scan', refId: 'EX-1248' },
    { id: 'a-1-2',  engagementId: 'eng-1', type: 'exception_assigned',   actor: 'Tushar Goel',  dayOffset: 0,  hour: 10, title: 'EX-1248 assigned to Neha Joshi',                       refId: 'EX-1248' },
    { id: 'a-1-3',  engagementId: 'eng-1', type: 'control_tested',       actor: 'Tushar Goel',  dayOffset: 0,  hour: 14, title: 'Control P2P-C-03 tested — Three-way match',            detail: '15 of 18 samples effective', refId: 'P2P-C-03' },
    { id: 'a-1-4',  engagementId: 'eng-1', type: 'comment_added',        actor: 'Neha Joshi',   dayOffset: 1,  hour: 11, title: 'Comment on EX-1248',                                   detail: '"Vendor confirmed unauthorised release — escalating."', refId: 'EX-1248' },
    { id: 'a-1-5',  engagementId: 'eng-1', type: 'evidence_uploaded',    actor: 'Tushar Goel',  dayOffset: 1,  hour: 16, title: 'Evidence uploaded — Walkthrough notes P2P FY26.pdf',   detail: '1.4 MB' },
    { id: 'a-1-6',  engagementId: 'eng-1', type: 'exception_classified', actor: 'Priya Singh',  dayOffset: 2,  hour: 9,  title: 'EX-1242 classified as Control Deficiency',              refId: 'EX-1242' },
    { id: 'a-1-7',  engagementId: 'eng-1', type: 'workflow_run',         actor: 'System',       dayOffset: 2,  hour: 6,  title: 'Workflow run — Three-Way Match',                       detail: '2 exceptions detected', workflowId: 'wf1', workflowName: 'Three-Way Match (PO · GRN · Invoice)' },
    { id: 'a-1-8',  engagementId: 'eng-1', type: 'exception_closed',     actor: 'Neha Joshi',   dayOffset: 3,  hour: 14, title: 'EX-1230 closed — false positive',                      refId: 'EX-1230' },
    { id: 'a-1-9',  engagementId: 'eng-1', type: 'exception_fired',      actor: 'System',       dayOffset: 3,  hour: 6,  title: 'New exception — duplicate invoice',                    workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector', refId: 'EX-1245' },
    { id: 'a-1-10', engagementId: 'eng-1', type: 'control_tested',       actor: 'Tushar Goel',  dayOffset: 4,  hour: 11, title: 'Control P2P-C-01 tested — Vendor master dual approval', detail: '24 of 24 samples effective', refId: 'P2P-C-01' },
    { id: 'a-1-11', engagementId: 'eng-1', type: 'exception_closed',     actor: 'Tushar Goel',  dayOffset: 5,  hour: 10, title: 'EX-1228 closed — remediated',                          refId: 'EX-1228' },
    { id: 'a-1-12', engagementId: 'eng-1', type: 'exception_fired',      actor: 'System',       dayOffset: 6,  hour: 9,  title: 'New exception — PO threshold override',                workflowId: 'wf3', workflowName: 'PO Approval Threshold Scan', refId: 'EX-1240' },
    { id: 'a-1-13', engagementId: 'eng-1', type: 'evidence_uploaded',    actor: 'Neha Joshi',   dayOffset: 8,  hour: 15, title: 'Evidence uploaded — Control testing sample Q4.xlsx',   detail: '320 KB' },
    { id: 'a-1-14', engagementId: 'eng-1', type: 'exception_closed',     actor: 'Priya Singh',  dayOffset: 9,  hour: 13, title: 'EX-1219 closed — accepted with action plan',           refId: 'EX-1219' },
    { id: 'a-1-15', engagementId: 'eng-1', type: 'status_changed',       actor: 'Karan Mehta',  dayOffset: 12, hour: 10, title: 'Engagement status → Active',                            detail: 'Was: Planned' },
    { id: 'a-1-16', engagementId: 'eng-1', type: 'exception_fired',      actor: 'System',       dayOffset: 14, hour: 8,  title: 'New exception — vendor onboarding without KYC',        workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor', refId: 'EX-1215' },
    { id: 'a-1-17', engagementId: 'eng-1', type: 'exception_closed',     actor: 'Neha Joshi',   dayOffset: 16, hour: 11, title: 'EX-1210 closed — false positive',                      refId: 'EX-1210' },
    { id: 'a-1-18', engagementId: 'eng-1', type: 'exception_fired',      actor: 'System',       dayOffset: 20, hour: 7,  title: 'New exception — segregation of duties violation',      workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector', refId: 'EX-1198' },
    { id: 'a-1-19', engagementId: 'eng-1', type: 'workflow_run',         actor: 'System',       dayOffset: 22, hour: 6,  title: 'Workflow run — Vendor Master Change Monitor',          detail: '1 exception detected', workflowId: 'wf4', workflowName: 'Vendor Master Change Monitor' },
    { id: 'a-1-20', engagementId: 'eng-1', type: 'comment_added',        actor: 'Tushar Goel',  dayOffset: 25, hour: 16, title: 'Comment on engagement',                                detail: '"Aligned with Vijay on Q4 sign-off cadence."' },
  ],

  // ─── Automation (CCM) — AP Duplicate Invoice Monitor ────────────────────────
  'eng-3': [
    { id: 'a-3-1',  engagementId: 'eng-3', type: 'workflow_run',         actor: 'System',       dayOffset: 0,  hour: 8,  title: 'Workflow run — Duplicate Invoice Detector',           detail: '3 exceptions detected · 1,248 invoices scanned', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector' },
    { id: 'a-3-2',  engagementId: 'eng-3', type: 'exception_fired',      actor: 'System',       dayOffset: 0,  hour: 8,  title: 'EX-1248 — Duplicate invoice posted vendor V-3344',     detail: '₹2.4L', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector', refId: 'EX-1248' },
    { id: 'a-3-3',  engagementId: 'eng-3', type: 'exception_fired',      actor: 'System',       dayOffset: 0,  hour: 8,  title: 'EX-1247 — Duplicate invoice posted vendor V-2155',     detail: '₹86K', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector', refId: 'EX-1247' },
    { id: 'a-3-4',  engagementId: 'eng-3', type: 'exception_assigned',   actor: 'Priya Singh',  dayOffset: 0,  hour: 9,  title: 'EX-1248 assigned to Priya Singh',                      refId: 'EX-1248' },
    { id: 'a-3-5',  engagementId: 'eng-3', type: 'workflow_run',         actor: 'System',       dayOffset: 1,  hour: 8,  title: 'Workflow run — Duplicate Invoice Detector',           detail: '1 exception detected', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector' },
    { id: 'a-3-6',  engagementId: 'eng-3', type: 'exception_fired',      actor: 'System',       dayOffset: 1,  hour: 8,  title: 'EX-1240 — Duplicate invoice posted vendor V-0044',     workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector', refId: 'EX-1240' },
    { id: 'a-3-7',  engagementId: 'eng-3', type: 'exception_closed',     actor: 'Priya Singh',  dayOffset: 1,  hour: 14, title: 'EX-1232 closed — confirmed duplicate, reversed',       refId: 'EX-1232' },
    { id: 'a-3-8',  engagementId: 'eng-3', type: 'workflow_run',         actor: 'System',       dayOffset: 2,  hour: 8,  title: 'Workflow run — Duplicate Invoice Detector',           detail: '0 exceptions', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector' },
    { id: 'a-3-9',  engagementId: 'eng-3', type: 'exception_closed',     actor: 'Priya Singh',  dayOffset: 2,  hour: 11, title: 'EX-1235 closed — false positive (legitimate retry)',   refId: 'EX-1235' },
    { id: 'a-3-10', engagementId: 'eng-3', type: 'workflow_run',         actor: 'System',       dayOffset: 3,  hour: 8,  title: 'Workflow run — Duplicate Invoice Detector',           detail: '2 exceptions detected', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector' },
    { id: 'a-3-11', engagementId: 'eng-3', type: 'exception_fired',      actor: 'System',       dayOffset: 3,  hour: 8,  title: 'EX-1230 — Duplicate invoice posted vendor V-9912',     workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector', refId: 'EX-1230' },
    { id: 'a-3-12', engagementId: 'eng-3', type: 'exception_closed',     actor: 'Priya Singh',  dayOffset: 3,  hour: 16, title: 'EX-1230 closed — confirmed and reversed',              refId: 'EX-1230' },
    { id: 'a-3-13', engagementId: 'eng-3', type: 'workflow_run',         actor: 'System',       dayOffset: 4,  hour: 8,  title: 'Workflow run — Duplicate Invoice Detector',           detail: '0 exceptions', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector' },
    { id: 'a-3-14', engagementId: 'eng-3', type: 'workflow_run',         actor: 'System',       dayOffset: 5,  hour: 8,  title: 'Workflow run — Duplicate Invoice Detector',           detail: '4 exceptions detected', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector' },
    { id: 'a-3-15', engagementId: 'eng-3', type: 'exception_fired',      actor: 'System',       dayOffset: 5,  hour: 8,  title: 'EX-1220 — Duplicate invoice (high-value)',             detail: '₹4.8L', workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector', refId: 'EX-1220' },
    { id: 'a-3-16', engagementId: 'eng-3', type: 'exception_closed',     actor: 'Priya Singh',  dayOffset: 6,  hour: 10, title: 'EX-1220 closed — vendor confirmed, AP reversed',       refId: 'EX-1220' },
    { id: 'a-3-17', engagementId: 'eng-3', type: 'comment_added',        actor: 'Tushar Goel',  dayOffset: 7,  hour: 11, title: 'Comment — threshold tuning suggestion',                detail: '"Recommend tightening fuzzy-match on PAN field."' },
    { id: 'a-3-18', engagementId: 'eng-3', type: 'exception_closed',     actor: 'Priya Singh',  dayOffset: 8,  hour: 14, title: 'EX-1212 closed — false positive',                      refId: 'EX-1212' },
    { id: 'a-3-19', engagementId: 'eng-3', type: 'exception_fired',      actor: 'System',       dayOffset: 10, hour: 8,  title: 'EX-1205 — Duplicate invoice posted',                   workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector', refId: 'EX-1205' },
    { id: 'a-3-20', engagementId: 'eng-3', type: 'exception_closed',     actor: 'Priya Singh',  dayOffset: 11, hour: 9,  title: 'EX-1205 closed — confirmed duplicate',                 refId: 'EX-1205' },
    { id: 'a-3-21', engagementId: 'eng-3', type: 'status_changed',       actor: 'Karan Mehta',  dayOffset: 15, hour: 10, title: 'Engagement status → In Progress',                       detail: 'Was: Planned' },
    { id: 'a-3-22', engagementId: 'eng-3', type: 'exception_closed',     actor: 'Priya Singh',  dayOffset: 18, hour: 13, title: 'EX-1188 closed — confirmed and reversed',              refId: 'EX-1188' },
    { id: 'a-3-23', engagementId: 'eng-3', type: 'exception_fired',      actor: 'System',       dayOffset: 22, hour: 8,  title: 'EX-1170 — Duplicate invoice (multiple)',               workflowId: 'wf2', workflowName: 'Duplicate Invoice Detector', refId: 'EX-1170' },
    { id: 'a-3-24', engagementId: 'eng-3', type: 'exception_closed',     actor: 'Priya Singh',  dayOffset: 24, hour: 11, title: 'EX-1170 closed — bulk reversal completed',             refId: 'EX-1170' },
    { id: 'a-3-25', engagementId: 'eng-3', type: 'comment_added',        actor: 'Vijay Reddy',  dayOffset: 28, hour: 15, title: 'Comment — monthly review',                              detail: '"Pass rate trending upward. Good signal-to-noise."' },
  ],

  // ─── Automation (Reconciliation) — Vendor Reconciliation Air India ─────────
  'eng-9': [
    { id: 'a-9-1', engagementId: 'eng-9', type: 'workflow_run',     actor: 'System',      dayOffset: 3,  hour: 6,  title: 'Workflow run — Three-Way Match',                detail: '6 mismatches flagged across 4,521 records', workflowId: 'wf1', workflowName: 'Three-Way Match (PO · GRN · Invoice)' },
    { id: 'a-9-2', engagementId: 'eng-9', type: 'exception_fired',  actor: 'System',      dayOffset: 3,  hour: 6,  title: 'EX-2410 — Invoice/GRN amount mismatch',         detail: '₹1.2L diff', workflowId: 'wf1', refId: 'EX-2410' },
    { id: 'a-9-3', engagementId: 'eng-9', type: 'exception_fired',  actor: 'System',      dayOffset: 3,  hour: 6,  title: 'EX-2411 — PO/Invoice quantity mismatch',        workflowId: 'wf1', refId: 'EX-2411' },
    { id: 'a-9-4', engagementId: 'eng-9', type: 'exception_assigned',actor: 'Rohan Patel',dayOffset: 3,  hour: 9,  title: 'EX-2410 assigned to Rohan Patel',               refId: 'EX-2410' },
    { id: 'a-9-5', engagementId: 'eng-9', type: 'comment_added',    actor: 'Rohan Patel', dayOffset: 4,  hour: 14, title: 'Comment on EX-2410',                            detail: '"Confirmed with vendor — pricing error on their side."', refId: 'EX-2410' },
    { id: 'a-9-6', engagementId: 'eng-9', type: 'exception_closed', actor: 'Rohan Patel', dayOffset: 5,  hour: 11, title: 'EX-2410 closed — vendor credit note issued',    refId: 'EX-2410' },
    { id: 'a-9-7', engagementId: 'eng-9', type: 'workflow_run',     actor: 'System',      dayOffset: 10, hour: 6,  title: 'Workflow run — Three-Way Match',                detail: '4 mismatches flagged', workflowId: 'wf1', workflowName: 'Three-Way Match (PO · GRN · Invoice)' },
    { id: 'a-9-8', engagementId: 'eng-9', type: 'exception_closed', actor: 'Rohan Patel', dayOffset: 12, hour: 10, title: 'EX-2398 closed — vendor confirmed',             refId: 'EX-2398' },
    { id: 'a-9-9', engagementId: 'eng-9', type: 'exception_fired',  actor: 'System',      dayOffset: 17, hour: 6,  title: 'EX-2380 — Bank statement mismatch',             workflowId: 'wf1', refId: 'EX-2380' },
    { id: 'a-9-10',engagementId: 'eng-9', type: 'status_changed',   actor: 'Karan Mehta', dayOffset: 24, hour: 10, title: 'Engagement status → Active',                     detail: 'Was: Planned' },
    { id: 'a-9-11',engagementId: 'eng-9', type: 'workflow_run',     actor: 'System',      dayOffset: 25, hour: 6,  title: 'Workflow run — Three-Way Match',                detail: '8 mismatches flagged', workflowId: 'wf1', workflowName: 'Three-Way Match (PO · GRN · Invoice)' },
    { id: 'a-9-12',engagementId: 'eng-9', type: 'exception_closed', actor: 'Rohan Patel', dayOffset: 27, hour: 14, title: 'EX-2360 closed — false positive',               refId: 'EX-2360' },
  ],
};

/** Demo "avg time to close" per engagement — rendered as a KPI. */
export const AVG_TIME_TO_CLOSE: Record<string, string> = {
  'eng-1': '2.4 days',
  'eng-3': '6.2 hours',
  'eng-9': '1.8 days',
};
