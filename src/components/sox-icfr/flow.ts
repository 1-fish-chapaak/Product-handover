import type { TabDef } from '../audit/EngagementTabBar';

/**
 * Which SOX engagement the reworked flow is being built on.
 *
 * The audit level is GONE from both shells (user ask): every SOX engagement now
 * opens on one level and the same four tabs — Overview · RACM · Control Library
 * · SOX audit — with deficiencies as a drill-in. The SOX audit tab is the audit
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
export const AUDIT_TABS: TabDef[] = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'controls', label: 'Control Library' },
  { id: 'deficiencies', label: 'Deficiency management' },
  { id: 'config', label: 'Configuration' },
];

export const NEW_FLOW_ENGAGEMENT_ID = 'sox-v2-fy26'; // FY26 ICFR — Altura Infra Group (SOX-104)

/** True only for the engagement the new flow is being built on. */
export const isNewFlow = (engagementId: string): boolean => engagementId === NEW_FLOW_ENGAGEMENT_ID;

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
export const defWord = (engagementId: string) => (isNewFlow(engagementId)
  ? { one: 'deficiency', many: 'deficiencies', Many: 'Deficiencies', page: 'Deficiency management', mine: 'My deficiencies' }
  : { one: 'exception', many: 'exceptions', Many: 'Exceptions', page: 'Exceptions', mine: 'My exceptions' });
