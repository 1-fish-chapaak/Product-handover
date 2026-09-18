/**
 * The RACM tab on the Engagements page (S11) — every SOX RACM, outside any one
 * engagement.
 *
 * RACMs are uploaded or extracted here, several can exist for one process, and a
 * new SOX engagement picks the ones it tests on its Scope step. Picking COPIES the
 * rows: the engagement's Control library is its own from then on, so editing a
 * RACM here only reaches engagements created afterwards. A RACM an engagement was
 * created from can't be deleted — the engagement still names it as its source.
 *
 * The rows are RACM rows, not working papers: a control's definition (risk,
 * activity, owners, attributes, required files, design checks) with no testing
 * state. Pre-testing review stays with each engagement.
 *
 * On first read the tab is filled from every existing SOX engagement's RACMs —
 * one per process per engagement, "Used by" that engagement — so the tab starts
 * with the matrices the engagements already test.
 *
 * Module state, like the engagement registry: it lives for the session.
 */
import { useSyncExternalStore } from 'react';
import { libraryEngagements, type Engagement } from '../../data/engagements';
import { programmeFor } from './auditScope';
import { seedIcfrEngagement, type SeedMeta } from './mockData';
import type { Control } from './types';

export interface LibraryRacm {
  id: string;
  /** What the list calls it — "Treasury — Altura Infra Holdings Ltd", or the file's name. */
  name: string;
  process: string;
  /** The company chosen when it was created. Rows carry their own `entity`
   *  (the file's entity column wins row by row), so this is the default. */
  entity: string;
  /** How it came in — a matrix, an SOP extraction, or an existing engagement. */
  source: 'racm' | 'sop' | 'engagement';
  fileName?: string;
  /** The SOP behind an extracted RACM, viewable for the session. */
  sopUrl?: string;
  /** The rows, IDs already ENTITY/PROCESS/R001/C001. */
  controls: Control[];
  createdBy: string;
  createdAt: string;
  /** Engagements that copied this RACM. Delete is blocked while any. */
  usedBy: { id: string; name: string }[];
}

// ─── Store ──────────────────────────────────────────────────────────────────────

let RACMS: LibraryRacm[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function all(): LibraryRacm[] {
  if (!RACMS) RACMS = seedFromEngagements();
  return RACMS;
}
function commit(next: LibraryRacm[]): void {
  RACMS = next;
  emit();
}

/** Every RACM on the tab, newest first. Re-renders when one is added, deleted or picked. */
export function useRacmLibrary(): LibraryRacm[] {
  return useSyncExternalStore(subscribe, all, all);
}
/** The same list, read once — for code outside React. */
export const racmLibrary = (): LibraryRacm[] => all();
export const findLibraryRacm = (id: string): LibraryRacm | undefined => all().find(r => r.id === id);

let seq = 0;
/** Put a new RACM on the tab. Its rows are stripped to RACM rows on the way in. */
export function addLibraryRacm(input: Omit<LibraryRacm, 'id' | 'usedBy' | 'createdAt'> & { createdAt?: string }): LibraryRacm {
  const racm: LibraryRacm = {
    ...input,
    id: `racm-${Date.now().toString(36)}-${(++seq).toString(36)}`,
    controls: input.controls.map(racmRowOf),
    createdAt: input.createdAt ?? 'just now',
    usedBy: [],
  };
  commit([racm, ...all()]);
  return racm;
}

/** Why a RACM can't be deleted, or null when it can. */
export function racmInUse(r: LibraryRacm): string | null {
  if (!r.usedBy.length) return null;
  const [first, ...rest] = r.usedBy;
  return `Used by ${first!.name}${rest.length ? ` and ${rest.length} more engagement${rest.length === 1 ? '' : 's'}` : ''}`;
}

/** Delete a RACM. Refused (false) while an engagement was created from it. */
export function deleteLibraryRacm(id: string): boolean {
  const r = findLibraryRacm(id);
  if (!r || racmInUse(r)) return false;
  commit(all().filter(x => x.id !== id));
  return true;
}

/** Record that an engagement copied these RACMs. */
export function markRacmsUsed(racmIds: string[], eng: { id: string; name: string }): void {
  const ids = new Set(racmIds);
  commit(all().map(r => (ids.has(r.id) && !r.usedBy.some(u => u.id === eng.id)
    ? { ...r, usedBy: [...r.usedBy, { id: eng.id, name: eng.name }] }
    : r)));
}

/** The rows an engagement takes when it picks a RACM — its own copy. */
export function copyRacmControls(r: LibraryRacm): Control[] {
  return structuredClone(r.controls);
}

// ─── Clashes ────────────────────────────────────────────────────────────────────

export interface IdClash {
  id: string;
  /** Names of the RACMs (or "this engagement") that each hold the ID. */
  holders: string[];
}

/**
 * Control IDs held by more than one of the sets — two RACMs written for the same
 * process at the same company both numbering from R001/C001, or a RACM repeating
 * a control an engagement already has. Picking both is blocked until one goes.
 */
export function controlIdClashes(sets: { name: string; controls: Pick<Control, 'id'>[] }[]): IdClash[] {
  const holders = new Map<string, string[]>();
  sets.forEach(s => {
    new Set(s.controls.map(c => c.id)).forEach(id => {
      const l = holders.get(id) ?? [];
      l.push(s.name);
      holders.set(id, l);
    });
  });
  return Array.from(holders, ([id, h]) => ({ id, holders: h })).filter(x => x.holders.length > 1);
}

/** "3 control IDs appear in both Treasury RACMs" — one line per pair of holders. */
export function clashSummary(clashes: IdClash[]): string[] {
  const byPair = new Map<string, number>();
  clashes.forEach(c => { const k = c.holders.join(' and '); byPair.set(k, (byPair.get(k) ?? 0) + 1); });
  return Array.from(byPair, ([pair, n]) => `${n} control ID${n === 1 ? '' : 's'} appear${n === 1 ? 's' : ''} in both ${pair}`);
}

// ─── Companies ──────────────────────────────────────────────────────────────────

const bare = (n: string) => n.replace(/\s*\((listed|unlisted|nyse|nasdaq|bse|nse)[^)]*\)\s*$/i, '').trim();

/**
 * Every company already named on a SOX engagement, grouped by its group — the
 * Entity list Create RACM offers. Companies typed in on the tab join under
 * "Added on the RACM tab".
 */
export function knownCompanies(): { group: string; companies: string[] }[] {
  const groups = new Map<string, Set<string>>();
  const add = (group: string, company: string | undefined) => {
    const c = company ? bare(company) : '';
    if (!c) return;
    const set = groups.get(group) ?? new Set<string>();
    set.add(c);
    groups.set(group, set);
  };
  const racms = all();
  soxEngagements().forEach(e => {
    const prog = programmeFor(e.id);
    const group = bare(prog?.groupName ?? e.entity ?? e.name);
    prog?.entities.forEach(en => add(group, en.name));
    racms.filter(r => r.usedBy.some(u => u.id === e.id)).forEach(r => r.controls.forEach(c => add(group, c.entity)));
  });
  const named = new Set(Array.from(groups.values()).flatMap(s => Array.from(s)));
  racms.forEach(r => [r.entity, ...r.controls.map(c => c.entity)].forEach(c => {
    if (c && !named.has(bare(c))) add('Added on the RACM tab', c);
  }));
  return Array.from(groups, ([group, set]) => ({ group, companies: Array.from(set).sort((a, b) => a.localeCompare(b)) }));
}

// ─── Seeding ────────────────────────────────────────────────────────────────────

const soxEngagements = (): Engagement[] => libraryEngagements().filter(e => e.type === 'SOX / ICFR');

/** The seed an engagement's workspace is built from — the same one the SOX
 *  workspace uses, so the tab and the engagement show the same IDs. */
export function seedMetaFor(e: Engagement): SeedMeta {
  return {
    id: e.id, code: e.code, name: e.name, entity: e.entity, process: e.process,
    processes: e.soxProcesses, seedMode: e.soxSeedMode,
    periodStart: e.periodStart, periodEnd: e.periodEnd, owner: e.owner,
    materiality: e.soxConfig?.overallMateriality, performanceMateriality: e.soxConfig?.performanceMateriality,
    clearlyTrivial: e.soxConfig?.clearlyTrivial, sdBandPct: e.soxConfig?.sdBandPct,
    controls: e.soxControls,
  };
}

function seedFromEngagements(): LibraryRacm[] {
  const out: LibraryRacm[] = [];
  soxEngagements().forEach(e => {
    // Created from the tab — its RACMs are already here, marked as used.
    if (e.soxControls) return;
    const ws = seedIcfrEngagement(seedMetaFor(e));
    const byProcess = new Map<string, Control[]>();
    ws.controls.forEach(c => { const l = byProcess.get(c.process) ?? []; l.push(c); byProcess.set(c.process, l); });
    byProcess.forEach((rows, process) => {
      const counts = new Map<string, number>();
      rows.forEach(c => { if (c.entity) counts.set(c.entity, (counts.get(c.entity) ?? 0) + 1); });
      const entity = Array.from(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? bare(e.entity ?? '');
      // Two engagements can hold the same process at the same company; the list
      // tells their RACMs apart by number rather than showing one name twice.
      const base = `${process} — ${entity || e.name}`;
      let name = base;
      for (let n = 2; out.some(r => r.name === name); n++) name = `${base} (${n})`;
      out.push({
        id: `racm-seed-${e.id}-${process.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        process,
        entity,
        source: 'engagement',
        controls: rows.map(racmRowOf),
        createdBy: e.owner,
        createdAt: e.periodStart ? `with ${e.code}` : 'earlier',
        usedBy: [{ id: e.id, name: e.name }],
      });
    });
  });
  return out;
}

// ─── RACM rows ──────────────────────────────────────────────────────────────────

/**
 * A control as a RACM row: what the matrix says, none of what testing added.
 * Kept: identity, risk, activity, owners, assertions, attributes with their
 * required files (no uploads), design elements and checks (no evidence, no
 * results). Gone: conclusions, populations, samples, overrides, sign-offs,
 * reviews and anything else a cycle wrote.
 */
export function racmRowOf(c: Control): Control {
  return {
    id: c.id,
    ...(c.seedKey ? { seedKey: c.seedKey } : {}),
    ...(c.entity ? { entity: c.entity } : {}),
    ...(c.entities ? { entities: [...c.entities] } : {}),
    ...(c.paths ? { paths: [...c.paths] } : {}),
    wpRef: c.wpRef,
    description: c.description,
    process: c.process,
    subProcess: c.subProcess,
    nature: c.nature,
    type: c.type,
    frequency: c.frequency,
    isKey: c.isKey,
    ...(c.objective ? { objective: c.objective } : {}),
    ...(c.clazz ? { clazz: c.clazz } : {}),
    ...(c.controlActivity ? { controlActivity: c.controlActivity } : {}),
    precision: c.precision,
    ...(c.isMrc ? { isMrc: c.isMrc, mrcThreshold: c.mrcThreshold } : {}),
    owner: c.owner,
    ...(c.processOwner ? { processOwner: c.processOwner } : {}),
    riskId: c.riskId,
    ...(c.riskTitle ? { riskTitle: c.riskTitle } : {}),
    riskDescription: c.riskDescription,
    ...(c.riskRating ? { riskRating: c.riskRating } : {}),
    ...(c.effectiveDate ? { effectiveDate: c.effectiveDate } : {}),
    ...(c.country ? { country: c.country } : {}),
    ...(c.testingStrategy ? { testingStrategy: c.testingStrategy } : {}),
    ...(c.accountIds ? { accountIds: [...c.accountIds] } : {}),
    assertions: [...c.assertions],
    design: {
      documents: c.design.documents.map(d => ({
        id: d.id, kind: d.kind, name: d.name, status: 'Missing' as const,
        ...(d.description ? { description: d.description } : {}),
        ...(d.required != null ? { required: d.required } : {}),
      })),
      points: c.design.points.map(p => ({
        id: p.id, text: p.text, result: 'Not tested' as const,
        ...(p.stepId ? { stepId: p.stepId } : {}),
      })),
      conclusion: 'Not tested',
      testedBy: null,
      testedAt: null,
    },
    operating: {
      method: c.operating.method,
      steps: c.operating.steps.map(s => ({
        id: s.id, code: s.code, description: s.description, assertion: s.assertion,
        precision: s.precision, procedures: [...s.procedures], result: 'Not tested' as const,
        ...(s.requiredFiles ? { requiredFiles: s.requiredFiles.map(f => ({ id: f.id, label: f.label })) } : {}),
      })),
      conclusion: 'Not tested',
      testedBy: null,
      testedAt: null,
    },
  };
}
