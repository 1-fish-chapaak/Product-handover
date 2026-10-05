import type { TabDef } from '../audit/EngagementTabBar';

/**
 * Which SOX engagement the reworked flow is being built on.
 *
 * The audit level is GONE from both shells (user ask): every SOX engagement now
 * opens on one level and the same tabs — Overview · Control Library · SOX audit —
 * with deficiencies as a drill-in. (RACM is parked too, S11: RACMs live on the
 * Engagements page's RACM tab and come in through Add RACM.) The SOX audit tab is the audit
 * register: audits are created from there and from the Overview, and an audit
 * sets a cycle's ground rules rather than opening a workspace of its own.
 * Risk Register, Configuration, the run registry and, on the reworked shell,
 * Dashboard are parked; see SOX_TABS in SoxClassicApp.tsx and SoxIcfrApp.tsx for
 * what each park costs and how to undo it.
 *
 * So what still forks on this flag is the WORDING and the details, not the
 * shape: a failed control is a deficiency here and an exception there (defWord
 * below), and the reworked engagement carries the body class its portalled CSS
 * hangs off.
 *
 * Read this rather than hard-coding the id: when the flow is finalised, the
 * rollout is deleting `isNewFlow`'s body and letting every engagement through,
 * and every call site is already pointing here.
 */
/**
 * The tabs an OPEN AUDIT has — the same four on both shells.
 *
 * Lives here rather than in either shell because both need it and a shell
 * importing the other creates a cycle. Deliberately not the engagement's four:
 * no RACM (the matrix is maintained once, not per cycle) and no audit register
 * (you are inside one). 'overview' keeps its id and wears the label Dashboard —
 * renaming the id would ripple through SoxTab, View, TAB_ROOT and RETURNABLE in
 * store.tsx for no user-visible gain.
 */
/* ONE ENGAGEMENT = ONE AUDIT ROUND (product owner, 5 Oct 2026). These four are
   now the ENGAGEMENT's tabs on both shells: the audit register and the second
   level of tabs are gone, and each engagement holds exactly one audit that is
   always open (see openAuditId in store.tsx). 'overview' is labelled Overview
   again — it is the engagement's own page now, not a dashboard one level down. */
export const AUDIT_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'controls', label: 'Control Library' },
  { id: 'deficiencies', label: 'Deficiencies' },
  { id: 'config', label: 'Configuration' },
];

export const NEW_FLOW_ENGAGEMENT_ID = 'sox-v2-fy26'; // FY26 ICFR — Altura Infra Group · CY 2026 Interim (SOX-104)
/** The CY 2025 year-end Altura used to hold as a second, archived audit — split
 *  out into an engagement of its own (5 Oct 2026). Same seed, same shell. */
export const ALTURA_YE_ENGAGEMENT_ID = 'sox-v2-fy25-ye';

/** True for the engagements the new flow is built on — Altura's two rounds. */
export const isNewFlow = (engagementId: string): boolean =>
  engagementId === NEW_FLOW_ENGAGEMENT_ID || engagementId === ALTURA_YE_ENGAGEMENT_ID;

/**
 * Class stamped on <body> while the new flow is mounted.
 *
 * Portalled surfaces (every `.modal-backdrop` lands on document.body) can't be
 * scoped by a React ancestor, so CSS that must not reach the classic
 * engagements hangs off this instead.
 */
export const NEW_FLOW_BODY_CLASS = 'sox-new-flow';

/**
 * What a failed control is called on this engagement.
 *
 * The rework renamed exceptions to deficiencies throughout; classic engagements
 * keep the old word. Kept as one lookup rather than a ternary at each string, so
 * the rename can't go half-done — every surface reads the same table.
 */
// 5 Oct (product decision): "Deficiencies" everywhere for the finding, on
// classic engagements too. "Exception" is kept only for one failed sample item
// in TOE, which never reads this table.
export const defWord = (engagementId: string) => (isNewFlow(engagementId)
  ? { one: 'deficiency', many: 'deficiencies', Many: 'Deficiencies', page: 'Deficiency management', mine: 'My deficiencies' }
  : { one: 'deficiency', many: 'deficiencies', Many: 'Deficiencies', page: 'Deficiencies', mine: 'My deficiencies' });
