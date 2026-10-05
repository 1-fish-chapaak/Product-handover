import { findEngagement, libraryEngagements, type Engagement } from '../../data/engagements';
import { ALTURA_YE_ENGAGEMENT_ID, NEW_FLOW_ENGAGEMENT_ID } from './flow';
import { seedIcfrEngagement, type SeedMeta } from './mockData';
import { seedMetaFor } from './racmLibrary';
import { conclusionOf } from './helpers';
import { normaliseProcess, processesForAudit } from './auditScope';
import type { AuditRecord, AuditRound, IcfrEngagement } from './types';

/**
 * ONE ENGAGEMENT = ONE AUDIT ROUND (product owner, 5 Oct 2026).
 *
 * A SOX engagement no longer holds a register of audits: it IS one round —
 * interim, year-end or roll-forward — and the round is set on Create
 * engagement's Basics. A year-end or roll-forward can carry its controls over
 * from a signed interim engagement of the same client; this file is how the
 * Engagements page, the create wizard and the workspace find those.
 *
 * Nothing here runs at module load (sox-icfr import-cycle rule) — every read
 * of another sox-icfr export happens inside a function.
 */

export const ROUND_LABEL: Record<AuditRound, string> = { interim: 'Interim', rollforward: 'Roll-forward', yearend: 'Year-end' };

/** The round an engagement is. The older seeds predate the field and are each
 *  one year-end (singleAudit). */
export function soxRoundOf(e: Engagement): AuditRound {
  return e.soxAudit?.round ?? 'yearend';
}

/** The seed meta the workspace is built from — the RACM library's own meta,
 *  plus the round and, for a carried engagement, its parent's meta. */
export function workspaceMetaFor(e: Engagement): SeedMeta {
  const base = seedMetaFor(e);
  // Altura's CY 2025 year-end is built off the same seed as its CY 2026 interim,
  // so it takes that engagement's process list.
  const processes = e.id === ALTURA_YE_ENGAGEMENT_ID
    ? (base.processes ?? findEngagement(NEW_FLOW_ENGAGEMENT_ID)?.soxProcesses)
    : base.processes;
  const parent = e.soxAudit?.carriedFromId ? findEngagement(e.soxAudit.carriedFromId) : undefined;
  return {
    ...base,
    processes,
    ...(e.soxAudit ? { audit: e.soxAudit } : {}),
    ...(parent ? { carryFrom: workspaceMetaFor(parent) } : {}),
  };
}

const seeded = new Map<string, IcfrEngagement>();

/**
 * The work done in each engagement this session, keyed by engagement id.
 *
 * The workspace store lives inside the engagement page, so Back to Engagements
 * unmounts it — and reopening used to re-seed, throwing away every override,
 * Ira result, request and sign-off made since. The store reads its starting
 * state from here and writes every change back, so an engagement keeps its work
 * for the session. In memory only, as the rest of the session's state is (a
 * page reload starts from the seed again, as it always has).
 */
const live = new Map<string, { eng: IcfrEngagement; racmDocs: unknown[] }>();
export function liveWorkspace(id: string): { eng: IcfrEngagement; racmDocs: unknown[] } | undefined {
  return live.get(id);
}
export function keepWorkspace(id: string, eng: IcfrEngagement, racmDocs: unknown[]): void {
  live.set(id, { eng, racmDocs });
}
/** The workspace as it stands now — this session's work when there is any, the
 *  seed otherwise. */
export function currentWorkspace(e: Engagement): IcfrEngagement {
  return live.get(e.id)?.eng ?? seededWorkspace(e);
}

/**
 * The figures the Engagements list card shows for a SOX engagement — counted
 * off the same workspace and with the same rule as the engagement's Overview
 * (the round's controls; Effective = conclusionOf), so the card and the page
 * can never disagree. The static numbers on the seed record are not read.
 */
export function soxCardStats(e: Engagement): { controls: number; effective: number; health: number; openIssues: number } {
  const ws = currentWorkspace(e);
  const audit = ws.audits[0];
  let scoped = ws.controls;
  const ids = audit?.controlIds?.length ? new Set(audit.controlIds) : null;
  const picked = ids ? ws.controls.filter(c => ids.has(c.id)) : [];
  if (picked.length) scoped = picked;
  else {
    const procs = processesForAudit(audit, ws.id);
    if (procs) scoped = ws.controls.filter(c => procs.includes(normaliseProcess(c.process)));
  }
  const effective = scoped.filter(c => conclusionOf(ws, c) === 'Effective').length;
  const inScope = new Set(scoped.map(c => c.id));
  const openIssues = ws.deficiencies.filter(d => inScope.has(d.controlId) && d.status !== 'Closed').length;
  return { controls: scoped.length, effective, health: scoped.length ? Math.round((effective / scoped.length) * 100) : 0, openIssues };
}

/** The engagement's workspace as seeded — memoised, since a seed is not cheap. */
export function seededWorkspace(e: Engagement): IcfrEngagement {
  const hit = seeded.get(e.id);
  if (hit) return hit;
  const ws = seedIcfrEngagement(workspaceMetaFor(e));
  seeded.set(e.id, ws);
  return ws;
}

/** Bare client name — the listing tag and case never decide "same client". */
const bare = (n: string) => n.replace(/\s*\((listed|unlisted|nyse|nasdaq|bse|nse)[^)]*\)\s*$/i, '').trim().toLowerCase();

export interface CarrySource { engagement: Engagement; audit: AuditRecord; workspace: IcfrEngagement }

/**
 * What a year-end or roll-forward can carry over from: INTERIM engagements of
 * the same client, signed by BOTH the preparer and the reviewer. An unsigned
 * interim is still somebody's open work, and a carry can only extend an answer
 * that has been given — the rule the old "Sign off X first" block enforced.
 */
export function signedInterimsFor(group: string): CarrySource[] {
  const g = bare(group);
  if (!g) return [];
  return libraryEngagements()
    .filter(e => e.type === 'SOX / ICFR' && soxRoundOf(e) === 'interim' && !!e.entity && bare(e.entity) === g)
    .map(e => {
      // This session's work counts: an interim signed off since the page loaded
      // is a carry source straight away.
      const workspace = currentWorkspace(e);
      return { engagement: e, audit: workspace.audits[0]!, workspace };
    })
    .filter(s => !!s.audit?.signoff?.preparer && !!s.audit?.signoff?.reviewer);
}
