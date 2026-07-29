/**
 * Which SOX engagement the reworked flow is being built on.
 *
 * The audit-first journey — an engagement holding Dashboard + Audit logs, audits
 * you drill into, controls that reset to zero when one is created — is not
 * finished being designed. Until it is signed off it runs on ONE engagement, and
 * every other SOX engagement keeps the shape it had before the work started
 * (commit 1a0fe4d): Overview · RACM · Risk Register · Control Library · Test
 * runs · Configuration, deficiencies as a drill-in, no audits at all.
 *
 * Read this rather than hard-coding the id: when the flow is finalised, the
 * rollout is deleting `isNewFlow`'s body and letting every engagement through,
 * and every call site is already pointing here.
 */
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
