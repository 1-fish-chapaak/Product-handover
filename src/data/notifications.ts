import type { View } from '../hooks/useAppState';

export type NotificationCategory =
  | 'exception'
  | 'workflow'
  | 'engagement'
  | 'report';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

/** Inline review actions surfaced on a notification row in the Action filter.
 *  Not every notification supports the full set — e.g. you can't "decline"
 *  a deadline reminder or a control failure. Each seed entry declares its
 *  own subset; if the field is omitted, no action buttons render. */
export type NotificationAction = 'accept' | 'decline' | 'comment';

/** Persisted snapshot of how the user resolved an action item. Replaces the
 *  buttons with a "✓ Accepted 5m ago" pill so the row keeps a visible audit
 *  trail instead of disappearing. */
export interface NotificationActionState {
  type: NotificationAction;
  takenAt: string;   // ISO timestamp of the action
  comment?: string;  // populated for type === 'comment'
}

export interface NotificationLink {
  view: View;
  // Soft hint for what to focus once the target view loads. v1 doesn't
  // wire these into module navigation — extension point for later.
  ref?: { kind: 'exception' | 'workflow' | 'engagement' | 'report' | 'dashboard'; id: string };
}

export interface PlatformNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actor?: string;
  /** ISO timestamp — used by timeAgo + day grouping. */
  createdAt: string;
  read: boolean;
  /** True when the user needs to do something (assigned, review needed,
   *  deadline approaching, decision required). False/absent for informational
   *  events (FYI shares, completed runs, status changes). Drives the
   *  "Action Required" primary filter in the notification drawer. */
  requiresAction?: boolean;
  /** Inline action buttons rendered on this row in the Action filter.
   *  Only meaningful when `requiresAction === true`. */
  actions?: NotificationAction[];
  /** Recorded user response. When set, the row shows a confirmation pill
   *  instead of action buttons. Cleared by Undo. */
  actionState?: NotificationActionState;
  link?: NotificationLink;
}

// ---------------------------------------------------------------------------
// Seed data
// Mock entries spanning all four categories, time-spread across
// Today / Yesterday / Earlier, mixing read + unread. Drawn loosely from
// existing mockData (ACTION_HUB_TIMELINE, workflow runs, shared
// dashboards/reports) so the feed feels grounded in the rest of the app.
// ---------------------------------------------------------------------------

const now = new Date();
const iso = (offsetMs: number) => new Date(now.getTime() - offsetMs).toISOString();

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const SEED_NOTIFICATIONS: PlatformNotification[] = [
  // ── Today ──
  {
    id: 'n-001',
    category: 'workflow',
    severity: 'warning',
    title: 'Workflow run completed',
    message: 'Revenue Recognition Anomaly Scan flagged 5 exceptions across 2,310 transactions.',
    actor: 'Ira (AI)',
    createdAt: iso(4 * MIN),
    read: false,
    link: { view: 'workflow-library', ref: { kind: 'workflow', id: 'wf-ap-dup' } },
  },
  {
    id: 'n-002',
    category: 'exception',
    severity: 'critical',
    title: 'Exception assigned to you',
    message: 'EX-3102 — Duplicate payment of $48,200 to Northwind Supplies flagged as Material Weakness.',
    actor: 'Sarah Johnson',
    createdAt: iso(22 * MIN),
    read: false,
    requiresAction: true,
    // assignment → can accept (own it), decline (push back), or comment
    actions: ['accept', 'decline', 'comment'],
    link: { view: 'manage-exceptions', ref: { kind: 'exception', id: 'EX-2418' } },
  },
  {
    id: 'n-003',
    category: 'report',
    severity: 'info',
    title: 'Report shared with you',
    message: 'FY26 Q1 ITGC Testing Results was shared by Michael Chen.',
    actor: 'Michael Chen',
    createdAt: iso(45 * MIN),
    read: false,
    link: { view: 'reports', ref: { kind: 'report', id: 'rpt-sox-q1' } },
  },
  {
    id: 'n-004',
    category: 'engagement',
    severity: 'critical',
    title: 'Control test failed',
    message: 'Control C-204 (Change Management Approval) failed sampling — 6 of 30 samples in exception.',
    actor: 'System',
    createdAt: iso(2 * HOUR),
    read: false,
    requiresAction: true,
    // failure → acknowledge or comment; can't be "declined"
    actions: ['accept', 'comment'],
    link: { view: 'engagement-detail', ref: { kind: 'engagement', id: 'eng-1' } },
  },
  {
    id: 'n-005',
    category: 'exception',
    severity: 'info',
    title: 'Action plan submitted',
    message: 'Risk owner submitted remediation plan for EX-3088 — pending auditor review.',
    actor: 'Priya Menon',
    createdAt: iso(5 * HOUR),
    read: true,
    requiresAction: true,
    // approval flow → approve (accept), reject (decline), or request changes (comment)
    actions: ['accept', 'decline', 'comment'],
    link: { view: 'manage-exceptions', ref: { kind: 'exception', id: 'EX-2401' } },
  },
  {
    id: 'n-006',
    category: 'workflow',
    severity: 'info',
    title: 'Workflow published',
    message: 'Bank Reconciliation Anomaly Scan moved from draft to active.',
    actor: 'You',
    createdAt: iso(7 * HOUR),
    read: true,
    link: { view: 'workflow-library', ref: { kind: 'workflow', id: 'wf-gl-recon' } },
  },

  // ── Yesterday ──
  {
    id: 'n-007',
    category: 'engagement',
    severity: 'warning',
    title: 'Evidence due in 2 days',
    message: 'Engagement ENG-219 has 9 outstanding evidence requests due Thursday.',
    actor: 'System',
    createdAt: iso(1 * DAY + 2 * HOUR),
    read: false,
    requiresAction: true,
    // deadline reminder → acknowledge only; you can't decline a deadline
    actions: ['accept'],
    link: { view: 'engagement-detail', ref: { kind: 'engagement', id: 'eng-204' } },
  },
  {
    id: 'n-008',
    category: 'report',
    severity: 'info',
    title: 'Dashboard shared with you',
    message: 'Third-Party Risk dashboard was shared by Sneha Desai.',
    actor: 'Sneha Desai',
    createdAt: iso(1 * DAY + 5 * HOUR),
    read: true,
    link: { view: 'dashboards', ref: { kind: 'dashboard', id: 'shared-1' } },
  },
  {
    id: 'n-009',
    category: 'exception',
    severity: 'warning',
    title: 'Auditor returned classification',
    message: 'EX-3061 sent back for re-classification — see auditor notes.',
    actor: 'David Kim',
    createdAt: iso(1 * DAY + 8 * HOUR),
    read: true,
    requiresAction: true,
    // sent back → accept the feedback or push back via comment
    actions: ['accept', 'comment'],
    link: { view: 'manage-exceptions', ref: { kind: 'exception', id: 'EX-2390' } },
  },
  {
    id: 'n-010',
    category: 'workflow',
    severity: 'info',
    title: 'Workflow run completed',
    message: 'Inventory Cycle-Count Variance scan completed — 0 exceptions.',
    actor: 'Ira (AI)',
    createdAt: iso(1 * DAY + 11 * HOUR),
    read: true,
    link: { view: 'workflow-library', ref: { kind: 'workflow', id: 'wf-3way' } },
  },

  // ── Earlier ──
  {
    id: 'n-011',
    category: 'engagement',
    severity: 'info',
    title: 'RACM ready for review',
    message: 'Revenue RACM (52 controls) marked ready by Lead Auditor.',
    actor: 'John Doe',
    createdAt: iso(3 * DAY),
    read: true,
    requiresAction: true,
    // approval flow → approve (accept), reject (decline), or request changes
    actions: ['accept', 'decline', 'comment'],
    link: { view: 'governance-racm' },
  },
  {
    id: 'n-012',
    category: 'report',
    severity: 'info',
    title: 'Scheduled report ready',
    message: 'Monthly Exceptions Summary (May) generated and ready to share.',
    actor: 'System',
    createdAt: iso(4 * DAY),
    read: true,
    link: { view: 'reports', ref: { kind: 'report', id: 'rpt-mes-apr' } },
  },
  {
    id: 'n-013',
    category: 'exception',
    severity: 'critical',
    title: 'Risk priority escalated',
    message: 'R-104 (Unauthorised journal entries) escalated to Critical by reviewer.',
    actor: 'Lead Auditor',
    createdAt: iso(5 * DAY),
    read: true,
    link: { view: 'audit-risk-register', ref: { kind: 'exception', id: 'R-088' } },
  },

  // ── Additional unread items for visual variety on the Unread tab ──
  // Spread across all four categories so each stripe color is visible.
  {
    id: 'n-014',
    category: 'workflow',
    severity: 'warning',
    title: 'Workflow paused — input required',
    message: 'Vendor Onboarding Review needs you to confirm the risk threshold for offshore suppliers.',
    actor: 'Ira (AI)',
    createdAt: iso(35 * MIN),
    read: false,
    link: { view: 'workflow-library', ref: { kind: 'workflow', id: 'wf-po-threshold' } },
  },
  {
    id: 'n-015',
    category: 'report',
    severity: 'info',
    title: 'Dashboard refreshed',
    message: 'Record-to-Report dashboard auto-refresh completed — 4 new exceptions surfaced.',
    actor: 'System',
    createdAt: iso(1 * HOUR + 10 * MIN),
    read: false,
    link: { view: 'dashboards', ref: { kind: 'dashboard', id: 'p2p' } },
  },
  {
    id: 'n-016',
    category: 'exception',
    severity: 'warning',
    title: 'Duplicate vendor detected',
    message: 'V-3044 "Globex Trading LLC" matches existing V-1290 by bank account — review for merge.',
    actor: 'Ira (AI)',
    createdAt: iso(3 * HOUR),
    read: false,
    link: { view: 'manage-exceptions', ref: { kind: 'exception', id: 'V-2017' } },
  },
  {
    id: 'n-017',
    category: 'engagement',
    severity: 'info',
    title: 'New engagement created',
    message: 'Q2 Revenue Assurance engagement (ENG-231) has been opened — 15 controls in scope.',
    actor: 'John Doe',
    createdAt: iso(4 * HOUR + 20 * MIN),
    read: false,
    link: { view: 'engagement-detail', ref: { kind: 'engagement', id: 'ENG-217' } },
  },
  {
    id: 'n-018',
    category: 'report',
    severity: 'info',
    title: 'Report shared with you',
    message: 'Quarterly Fraud Indicators Review was shared by Karan Mehta.',
    actor: 'Karan Mehta',
    createdAt: iso(6 * HOUR),
    read: false,
    link: { view: 'reports', ref: { kind: 'report', id: 'rpt-vendor-q' } },
  },
  {
    id: 'n-019',
    category: 'workflow',
    severity: 'info',
    title: 'New workflow template available',
    message: '"Segregation of Duties — Conflict Scan" added to the workflow library.',
    actor: 'System',
    createdAt: iso(1 * DAY + 4 * HOUR),
    read: false,
    link: { view: 'workflow-library' },
  },
];

// ---------------------------------------------------------------------------
// Producer factory (v1.5 Phase 3)
// Real module actions (exception classified, workflow run done, report
// shared, etc.) call this to push a notification into the feed via
// useAppState's `addNotification`. Fills in the system-managed fields
// (id, createdAt, read) so call-sites only specify the meaningful payload.
// ---------------------------------------------------------------------------

export function createNotification(
  input: Omit<PlatformNotification, 'id' | 'createdAt' | 'read'>,
): PlatformNotification {
  return {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    read: false,
    ...input,
  };
}

// ---------------------------------------------------------------------------
// Persistence (v1.5 Phase 1)
// Wraps localStorage with two responsibilities:
//   1. Round-trip the user's notifications array (read/dismissed state)
//   2. Track which seed ids the user has already seen, so new seeds added
//      to SEED_NOTIFICATIONS in code show up after a reload — without
//      bringing back seeds the user has explicitly dismissed.
// All operations are wrapped in try/catch — if localStorage is unavailable
// (private browsing, quota exceeded), we silently fall back to in-memory
// behavior.
// ---------------------------------------------------------------------------

const PERSIST_KEY = 'irame.notifications.v1';

interface PersistedState {
  notifications: PlatformNotification[];
  /** Seed ids known to this client at the time of the last save. New seeds
   *  added to the codebase between loads are detected by diff. */
  seenSeedIds: string[];
}

export function loadPersistedNotifications(): PlatformNotification[] {
  if (typeof window === 'undefined') return SEED_NOTIFICATIONS;
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) {
      // First load on this device — seed the store.
      const initial: PersistedState = {
        notifications: SEED_NOTIFICATIONS,
        seenSeedIds: SEED_NOTIFICATIONS.map(n => n.id),
      };
      try { window.localStorage.setItem(PERSIST_KEY, JSON.stringify(initial)); } catch { /* quota */ }
      return SEED_NOTIFICATIONS;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || !Array.isArray(parsed.notifications)) return SEED_NOTIFICATIONS;

    const seenSet = new Set<string>(Array.isArray(parsed.seenSeedIds) ? parsed.seenSeedIds : []);
    // Append seed entries that didn't exist last time we saved. Existing
    // ids stay in their persisted order — read/dismiss state is preserved.
    const newSeeds = SEED_NOTIFICATIONS.filter(n => !seenSet.has(n.id));

    return [...parsed.notifications, ...newSeeds];
  } catch {
    return SEED_NOTIFICATIONS;
  }
}

export function persistNotifications(notifications: PlatformNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    const state: PersistedState = {
      notifications,
      seenSeedIds: SEED_NOTIFICATIONS.map(n => n.id),
    };
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
  } catch {
    // Silent fallback — quota exceeded, serialization error, or storage
    // disabled. Notifications stay in memory for the session.
  }
}
