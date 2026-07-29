import { PROGRAMMES, SEED_ENTITIES, type GroupEntity, type SoxProgramme, entityShort } from '../audit/sox-testing/soxTestingData';
import { V2C_PROGRAMMES } from '../audit/sox-testing/v2/v2ClassicStore';
import type { AuditRecord } from './types';

/**
 * What a SOX audit covers — the bridge between an audit's scope selection and
 * the controls the workspace shows.
 *
 * This is a leaf module on purpose. Programme records live in TWO stores:
 * `PROGRAMMES` (soxTestingData) and `V2C_PROGRAMMES` (the V2 tab's own store,
 * which is where FY26 ICFR — Altura Infra Group lives). soxTestingData cannot
 * import the V2 store — the V2 store imports soxTestingData — so the lookup
 * across both belongs here rather than in either of them.
 */

/** The programme backing an engagement, from whichever store holds it. */
export function programmeFor(engagementId: string): SoxProgramme | undefined {
  return PROGRAMMES.find(p => p.engagementId === engagementId)
    ?? V2C_PROGRAMMES.find(p => p.engagementId === engagementId);
}

/** The group's entities. Engagements with no programme record fall back to the
 *  demo group so the scope step is never empty — a prototype stand-in. */
export function entitiesFor(engagementId: string): GroupEntity[] {
  return programmeFor(engagementId)?.entities ?? SEED_ENTITIES;
}

/** The processes an engagement has RACMs for, as the programme derived them. */
export function processesFor(engagementId: string): string[] {
  return programmeFor(engagementId)?.racms.map(r => r.process) ?? [];
}

/** Trial-balance captions name processes slightly differently from the control
 *  register (the scoping derivation says "Payroll (Hire to Retire)", controls
 *  say "Payroll"). Normalising here keeps the filter from silently missing
 *  controls that genuinely belong to the audit. */
const PROCESS_ALIAS: Record<string, string> = {
  'Payroll (Hire to Retire)': 'Payroll',
  'Hire to Retire': 'Payroll',
  'Record to Report (R2R)': 'Record to Report',
};
export const normaliseProcess = (p: string): string => PROCESS_ALIAS[p] ?? p;

/**
 * The processes an audit covers.
 *
 * Scoped by RACM, the audit already names its processes. Scoped by entity, an
 * entity's processes are the ones its trial-balance captions mapped to — the
 * same derivation the scoping wizard runs, read back off the programme's RACMs
 * so the two can never disagree.
 *
 * Returns null when the audit's scope can't be resolved to any process, which
 * the caller should read as "don't filter" rather than "show nothing" — an
 * empty workspace is a worse lie than an unfiltered one.
 */
export function processesForAudit(audit: AuditRecord | undefined, engagementId: string): string[] | null {
  if (!audit) return null;

  if (audit.scopeKind === 'racm') {
    const picked = audit.scopeNames.map(normaliseProcess);
    return picked.length ? picked : null;
  }

  const prog = programmeFor(engagementId);
  if (!prog) return null;

  // The programme's RACMs carry entity SHORT names; the audit stores ids.
  const shorts = new Set(
    (audit.scopeIds.length ? audit.scopeIds : [])
      .map(id => entityShort(id, prog.entities)),
  );
  if (!shorts.size) return null;

  const procs = prog.racms
    .filter(r => r.entities.some(e => shorts.has(e)))
    .map(r => normaliseProcess(r.process));

  return procs.length ? Array.from(new Set(procs)) : null;
}
