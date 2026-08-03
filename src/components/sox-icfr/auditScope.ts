import {
  PROGRAMMES, SEED_CAPTIONS, SEED_ENTITIES,
  type GroupEntity, type SoxProgramme, type TbCaption, entityShort,
} from '../audit/sox-testing/soxTestingData';
import { CAPTIONS as V2C_CAPTIONS, V2C_PROGRAMMES } from '../audit/sox-testing/v2/v2ClassicStore';
import type { AuditRecord, Control } from './types';

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
  /** Who holds this company, when it is not held by the top company directly.
   *  Carried through from the engagement's register so the scope list can show
   *  the group's shape: taking a parent in while leaving its subsidiary out is
   *  a real scoping decision, and a flat list hides that it was even made. */
  parentId?: string;
}

/** How deep a company sits in the ownership chain — 0 for the top company.
 *  Tolerates a parent that is not in the list (dropped from this audit, or
 *  never registered) by stopping where the chain breaks. */
export function chainDepth(row: { id: string; parentId?: string }, all: { id: string; parentId?: string }[]): number {
  let depth = 0;
  let cur: { id: string; parentId?: string } | undefined = row;
  while (cur?.parentId && depth < 8) {
    const parent: { id: string; parentId?: string } | undefined = all.find(x => x.id === cur!.parentId);
    if (!parent) break;
    cur = parent;
    depth++;
  }
  return depth;
}

/** Merge the engagement's entity register with what the files carry, by name —
 *  names are what a trial balance actually gives you; ids are ours. */
export function mergeScopeEntities(registered: GroupEntity[], inFiles: GroupEntity[]): ScopeEntityRow[] {
  const rows = new Map<string, ScopeEntityRow>();
  registered.forEach(e => rows.set(e.name, { id: e.id, name: e.name, type: e.type, inRegister: true, inData: false, parentId: e.parentId }));
  inFiles.forEach(e => {
    const hit = rows.get(e.name);
    if (hit) hit.inData = true;
    else rows.set(e.name, { id: e.id, name: e.name, type: e.type, inRegister: false, inData: true });
  });
  return Array.from(rows.values());
}

// ─── Derived entity scope — the numbers decide, the auditor overrules ────────
//
// Scope is not a blank list to tick through. The trial balance already says
// which companies carry enough to matter, so the wizard works that out and the
// auditor overrules it where judgement differs. Three ways in, in order:
//
//   1. the company's trial-balance total clears performance materiality;
//   2. it is pulled in to reach the group coverage target, largest first;
//   3. the auditor toggles it in by hand.
//
// A company the trial balance never mentioned takes no part in this — it can't
// be weighed, so it is excluded outright rather than judged as "too small".

/** How much of the group's balance the entities in scope must cover before the
 *  derivation stops pulling more in. */
export const COVERAGE_TARGET = 60;

/** Every trial-balance caption belonging to an engagement's group. */
export function captionsFor(engagementId: string): TbCaption[] {
  if (V2C_PROGRAMMES.some(p => p.engagementId === engagementId)) return V2C_CAPTIONS;
  return SEED_CAPTIONS;
}

/** Each company's trial-balance total, ₹ Cr, keyed by entity id. A company with
 *  no captions totals zero — which is the honest answer, not a missing one. */
export function entityTotals(engagementId: string): Record<string, number> {
  const out: Record<string, number> = {};
  captionsFor(engagementId).forEach(c => { out[c.entityId] = (out[c.entityId] ?? 0) + c.balance; });
  return out;
}

export type ScopeStatus = 'tb' | 'coverage' | 'out' | 'absent';

export interface DerivedScopeRow extends ScopeEntityRow {
  /** Trial-balance total, ₹ Cr. */
  total: number;
  /** Share of the group's total balance, %. */
  sharePct: number;
  status: ScopeStatus;
  /** Plain-English why, written for someone who did not do the maths. */
  reason: string;
}

/**
 * Work out what belongs in the audit.
 *
 * `pm` is performance materiality in ₹ Cr — the threshold testing actually runs
 * against, which is why it decides scope rather than overall materiality does.
 */
export function deriveEntityScope(
  rows: ScopeEntityRow[],
  totals: Record<string, number>,
  pm: number,
  fmt: (cr: number) => string,
  /** Whether a trial balance was actually attached. "Not in the trial balance"
   *  is only a thing you can say once there IS one — with the file step skipped
   *  every company is still weighed, or an optional step would silently empty
   *  the audit. */
  filesAttached: boolean,
): { rows: DerivedScopeRow[]; coveragePct: number; groupTotal: number } {
  const withTotals = rows.map(r => ({ ...r, total: totals[r.id] ?? 0 }));
  const groupTotal = withTotals.reduce((s, r) => s + r.total, 0);
  const share = (t: number) => (groupTotal ? Math.round((t / groupTotal) * 1000) / 10 : 0);

  // A company the file never mentioned can't be weighed against anything.
  const weighable = filesAttached ? withTotals.filter(r => r.inData) : withTotals;
  const clears = new Set(weighable.filter(r => pm > 0 && r.total >= pm).map(r => r.id));

  // Coverage top-up: biggest first, until the target is met. Ordering by size
  // means the fewest extra companies are pulled in to get there.
  const coveragePulled = new Set<string>();
  if (groupTotal > 0) {
    let covered = withTotals.filter(r => clears.has(r.id)).reduce((s, r) => s + r.total, 0);
    const spare = weighable.filter(r => !clears.has(r.id)).sort((a, b) => b.total - a.total);
    for (const r of spare) {
      if ((covered / groupTotal) * 100 >= COVERAGE_TARGET) break;
      clears.add(r.id);
      coveragePulled.add(r.id);
      covered += r.total;
    }
  }

  const derived: DerivedScopeRow[] = withTotals.map(r => {
    const sharePct = share(r.total);
    if (filesAttached && !r.inData) {
      return {
        ...r, sharePct, status: 'absent' as const,
        reason: 'Not in the trial balance — excluded from this audit',
      };
    }
    if (coveragePulled.has(r.id)) {
      return {
        ...r, sharePct, status: 'coverage' as const,
        reason: `Added to reach ${COVERAGE_TARGET}% coverage of the group`,
      };
    }
    if (clears.has(r.id)) {
      return {
        ...r, sharePct, status: 'tb' as const,
        reason: `${fmt(r.total)} clears performance materiality`,
      };
    }
    return {
      ...r, sharePct, status: 'out' as const,
      reason: r.inRegister
        ? `${fmt(r.total)} is below ${fmt(pm)}`
        : 'Found in the data only — not on the engagement',
    };
  });

  const inScopeTotal = derived.filter(r => r.status === 'tb' || r.status === 'coverage').reduce((s, r) => s + r.total, 0);
  return {
    rows: derived,
    coveragePct: groupTotal ? Math.round((inScopeTotal / groupTotal) * 1000) / 10 : 0,
    groupTotal,
  };
}

/**
 * The RACMs a set of companies feeds.
 *
 * The programme's RACMs carry entity SHORT names ('Holdings', 'Solar') because
 * that is what the trial-balance derivation wrote; audits carry ids. Same
 * translation processesForAudit does — factored out so the New audit wizard can
 * pre-tick the RACM side from whatever entities are in scope.
 */
export function racmsForEntities(engagementId: string, entityIds: string[]): string[] {
  const prog = programmeFor(engagementId);
  if (!prog) return [];
  const shorts = new Set(entityIds.map(id => entityShort(id, prog.entities)));
  if (!shorts.size) return [];
  return Array.from(new Set(
    prog.racms.filter(r => r.entities.some(e => shorts.has(e))).map(r => normaliseProcess(r.process)),
  ));
}

/**
 * Does this audit's scope cover this control?
 *
 * Same precedence useAuditControls applies: controls picked one by one on the
 * scope step decide, and only when none were does the process filter. Lives here
 * rather than in a view because three surfaces now ask it — the library, the
 * portfolio selectors and the archive snapshot.
 */
export function auditCovers(a: AuditRecord, c: Control, engagementId: string): boolean {
  if (a.controlIds?.length) return a.controlIds.includes(c.id);
  const procs = processesForAudit(a, engagementId);
  return !procs || procs.includes(normaliseProcess(c.process));
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
