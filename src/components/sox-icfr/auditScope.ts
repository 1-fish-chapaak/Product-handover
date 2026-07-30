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

/**
 * Entities the audit's uploaded trial balance / GL turned out to contain.
 *
 * A SIMULATED parse — prototype uploads carry no bytes, so this stands in for
 * reading entity names out of the file. What it models is the reason the New
 * audit sheet shows two columns on its scope step: the register is maintained by
 * hand and the trial balance is not, so an entity nobody remembered to add still
 * shows up in the group's numbers, and an entity that hasn't filed its TB yet is
 * in the register but absent from the data.
 *
 * The shape of the stand-in: every registered entity but the last one (its TB
 * submission is late), plus whatever the group's file carries that the register
 * has never heard of.
 */
const TB_ONLY_ENTITIES: Record<string, GroupEntity[]> = {
  // FY26 ICFR — Altura Infra Group: the group TB carries a ninth company.
  'sox-v2-fy26': [
    { id: 'tb-a-h2', name: 'Altura Green Hydrogen Pvt Ltd', type: 'Subsidiary', ownership: 100 },
  ],
};

export function entitiesInFiles(engagementId: string, hasFiles: boolean): GroupEntity[] {
  if (!hasFiles) return [];
  const registered = entitiesFor(engagementId);
  return [...registered.slice(0, -1), ...(TB_ONLY_ENTITIES[engagementId] ?? [])];
}

/** One row of the scope step's entity matrix — the same entity seen from both
 *  sides. `inRegister` without `inData` is a late TB; `inData` without
 *  `inRegister` is the entity somebody forgot to add. */
export interface ScopeEntityRow {
  id: string;
  name: string;
  type: GroupEntity['type'];
  inRegister: boolean;
  inData: boolean;
}

/** Merge the engagement's entity register with what the files carry, by name —
 *  names are what a trial balance actually gives you; ids are ours. */
export function mergeScopeEntities(registered: GroupEntity[], inFiles: GroupEntity[]): ScopeEntityRow[] {
  const rows = new Map<string, ScopeEntityRow>();
  registered.forEach(e => rows.set(e.name, { id: e.id, name: e.name, type: e.type, inRegister: true, inData: false }));
  inFiles.forEach(e => {
    const hit = rows.get(e.name);
    if (hit) hit.inData = true;
    else rows.set(e.name, { id: e.id, name: e.name, type: e.type, inRegister: false, inData: true });
  });
  return Array.from(rows.values());
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
