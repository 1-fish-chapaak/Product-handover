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
import { applyEditorRows, lockedEditorIds, RACM_LOCKED_KEY, RACM_ROWS_KEY, racmEditorRows } from './helpers';
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
  /** THE CONTROL IDS THAT HAVE BEEN PUBLISHED (17 Sep call).
   *
   *  Published row by row rather than matrix by matrix, because a RACM outlives
   *  its first publish: a control found later is added to a matrix engagements
   *  are already testing from. Freezing the whole record on first publish would
   *  make that impossible, and republishing the whole record would quietly
   *  reopen rows somebody has already tested against.
   *
   *  So: a published row is fixed and a new one is a draft until it is published
   *  too. Scoping only ever sees the published ones. Empty on a new RACM — the
   *  status is derived from this list, never stored (house convention, see
   *  `racmStateEngine.ts`). */
  published: string[];
  /** When the matrix was last published, and by whom — for the list's Status column. */
  publishedAt?: string;
  publishedBy?: string;
  /** WHAT HAS HAPPENED TO THIS MATRIX, newest last.
   *
   *  A published RACM is a thing engagements are tested against, so "who changed
   *  it and when" stops being housekeeping and becomes part of the audit trail.
   *  Each entry is one event a person caused — never a keystroke — so the list
   *  reads as a history rather than a log. */
  history: RacmEvent[];
}

export interface RacmEvent {
  /** v1, v2, v3 — counted from the first publish, so a draft has no version. */
  version: number;
  kind: 'created' | 'published' | 'controls-added' | 'edited';
  at: string;
  by: string;
  /** One line saying what changed, in the same plain English the toasts use. */
  what: string;
}

/** Draft until a row is published; Published once every row is. In between it is
 *  a published matrix with additions still being written — which the list has to
 *  say out loud, because the difference decides what scoping can pick up. */
export type RacmStatus = 'Draft' | 'Published' | 'Published · additions';

export function racmStatus(r: LibraryRacm): {
  status: RacmStatus; publishedCount: number; draftCount: number; draftIds: string[];
} {
  const live = new Set(r.published);
  const draftIds = r.controls.filter(c => !live.has(c.id)).map(c => c.id);
  const publishedCount = r.controls.length - draftIds.length;
  const status: RacmStatus = publishedCount === 0 ? 'Draft'
    : draftIds.length === 0 ? 'Published'
    : 'Published · additions';
  return { status, publishedCount, draftCount: draftIds.length, draftIds };
}

/** A published row is fixed: it may be read, copied and tested, never rewritten.
 *  What an engagement already concluded against cannot change underneath it. */
export const isRowPublished = (r: LibraryRacm, controlId: string): boolean => r.published.includes(controlId);

/** The version a publish would create. v1 is the first publish; a draft that has
 *  never been published is still v0, which is why the list shows no version
 *  against it. */
export const nextVersion = (r: LibraryRacm): number => Math.max(0, ...r.history.map(h => h.version)) + 1;
export const currentVersion = (r: LibraryRacm): number => Math.max(0, ...r.history.map(h => h.version));

/** Publish every row not yet published, and stamp who did it. Returns how many
 *  rows moved — 0 when there was nothing to publish. */
export function publishRacm(id: string, by: string): number {
  const r = findLibraryRacm(id);
  if (!r) return 0;
  const { draftIds } = racmStatus(r);
  if (!draftIds.length) return 0;
  const version = nextVersion(r);
  const first = version === 1;
  commit(all().map(x => (x.id === id
    ? {
        ...x,
        published: [...x.published, ...draftIds],
        publishedAt: 'just now',
        publishedBy: by,
        history: [...x.history, {
          version, kind: 'published' as const, at: 'just now', by,
          what: first
            ? `${draftIds.length} control${draftIds.length === 1 ? '' : 's'} published`
            : `${draftIds.length} new control${draftIds.length === 1 ? '' : 's'} published`,
        }],
      }
    : x)));
  return draftIds.length;
}

/** Add rows to a RACM already on the tab. They arrive as drafts — a control that
 *  reached an engagement without anyone publishing it would make publishing
 *  mean nothing. */
export function addRacmControls(id: string, controls: Control[]): number {
  const r = findLibraryRacm(id);
  if (!r || !controls.length) return 0;
  const have = new Set(r.controls.map(c => c.id));
  const fresh = controls.map(racmRowOf).filter(c => !have.has(c.id));
  if (!fresh.length) return 0;
  commit(all().map(x => (x.id === id
    ? {
        ...x,
        controls: [...x.controls, ...fresh],
        history: [...x.history, {
          version: currentVersion(x), kind: 'controls-added' as const, at: 'just now', by: 'You',
          what: `${fresh.length} control${fresh.length === 1 ? '' : 's'} added, not published yet`,
        }],
      }
    : x)));
  return fresh.length;
}

/** Replace a DRAFT row's content. Refused for a published row — that is the lock.
 *  Returns false when the row is missing or fixed. */
export function updateDraftControl(id: string, controlId: string, patch: Partial<Control>): boolean {
  const r = findLibraryRacm(id);
  if (!r || isRowPublished(r, controlId)) return false;
  if (!r.controls.some(c => c.id === controlId)) return false;
  commit(all().map(x => (x.id === id
    ? { ...x, controls: x.controls.map(c => (c.id === controlId ? { ...c, ...patch, id: c.id } : c)) }
    : x)));
  return true;
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
export function addLibraryRacm(input: Omit<LibraryRacm, 'id' | 'usedBy' | 'createdAt' | 'published' | 'history'> & { createdAt?: string; published?: string[] }): LibraryRacm {
  const racm: LibraryRacm = {
    ...input,
    id: `racm-${Date.now().toString(36)}-${(++seq).toString(36)}`,
    controls: input.controls.map(racmRowOf),
    createdAt: input.createdAt ?? 'just now',
    usedBy: [],
    published: input.published ?? [],
    history: [],
  };
  const how = racm.source === 'sop' ? 'Extracted from' : racm.source === 'engagement' ? 'Read back from' : 'Imported from';
  racm.history.push({
    version: 0, kind: 'created', at: racm.createdAt, by: racm.createdBy,
    what: `${how} ${racm.fileName ?? 'an existing engagement'} — ${racm.controls.length} control${racm.controls.length === 1 ? '' : 's'}`,
  });
  // A RACM that arrives already published (the seeds, and the Scope step's own
  // upload) has a first version from the moment it exists.
  if (racm.published.length) {
    racm.history.push({
      version: 1, kind: 'published', at: racm.publishedAt ?? racm.createdAt, by: racm.publishedBy ?? racm.createdBy,
      what: `${racm.published.length} control${racm.published.length === 1 ? '' : 's'} published`,
    });
  }
  commit([racm, ...all()]);
  return racm;
}

/**
 * Edits made in the spreadsheet editor, coming back.
 *
 * The editor runs in its own browser tab — it was opened with `window.open`, and
 * the rows were handed to it through localStorage. So its edits arrive the same
 * way: it writes the rows back under the key it read them from, and the browser
 * raises a `storage` event in every OTHER tab, which is this one.
 *
 * That event is the only thing this listens to, and only for keys that name a
 * RACM the tab actually has. Anything unreadable is ignored in silence: a RACM
 * disappearing because a JSON parse failed would be far worse than an edit that
 * did not arrive, and the editor still holds the rows either way.
 */
function applyEditorWrite(key: string, raw: string | null): void {
  if (!raw || !key.startsWith('sox-racm-rows:')) return;
  const racm = findLibraryRacm(key.slice('sox-racm-rows:'.length));
  if (!racm) return;
  let rows;
  try { rows = JSON.parse(raw); } catch { return; }
  if (!Array.isArray(rows)) return;
  const { controls, changed, added } = applyEditorRows(racm.controls, racm.process, rows, new Set(racm.published));
  if (!changed && !added) return;
  const what = [
    changed ? `${changed} row${changed === 1 ? '' : 's'} edited` : '',
    added ? `${added} control${added === 1 ? '' : 's'} added` : '',
  ].filter(Boolean).join(', ');
  commit(all().map(r => (r.id === racm.id
    ? {
        ...r,
        controls,
        history: [...r.history, {
          version: currentVersion(r), kind: 'edited' as const, at: 'just now', by: 'You',
          what: `${what} in the spreadsheet editor`,
        }],
      }
    : r)));
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => { if (e.key) applyEditorWrite(e.key, e.newValue); });
}

/** Hand a RACM's rows to the spreadsheet editor, with the list of rows it must
 *  not let anyone change. Both go into storage under the RACM's own keys; the
 *  editor reads them when its tab opens, and writes the rows back to the first
 *  of them as they change. */
export function writeEditorHandoff(r: LibraryRacm): void {
  try {
    window.localStorage.setItem(RACM_ROWS_KEY(r.id), JSON.stringify(racmEditorRows(r.controls, r.process)));
    window.localStorage.setItem(RACM_LOCKED_KEY(r.id), JSON.stringify(lockedEditorIds(r.controls, r.process, r.published)));
  } catch { /* storage blocked — the editor falls back to its own sample */ }
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

/** The rows an engagement takes when it picks a RACM — its own copy, and only
 *  the published ones. A draft row is work in progress; scoping an engagement
 *  from it would be testing against something nobody has agreed to yet. */
export function copyRacmControls(r: LibraryRacm): Control[] {
  return structuredClone(r.controls.filter(c => isRowPublished(r, c.id)));
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
      const controls = rows.map(racmRowOf);
      out.push({
        id: `racm-seed-${e.id}-${process.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        process,
        entity,
        source: 'engagement',
        controls,
        createdBy: e.owner,
        createdAt: e.periodStart ? `with ${e.code}` : 'earlier',
        usedBy: [{ id: e.id, name: e.name }],
        // Published from birth: these rows were read back OUT of an engagement
        // that is already testing them. Landing them as drafts would be telling
        // the auditor that work already under way had never been agreed.
        published: controls.map(c => c.id),
        publishedAt: e.periodStart ? `with ${e.code}` : 'earlier',
        publishedBy: e.owner,
        history: [{
          version: 1, kind: 'published', at: e.periodStart ? `with ${e.code}` : 'earlier', by: e.owner,
          what: `Read back from ${e.name} — ${controls.length} control${controls.length === 1 ? '' : 's'}`,
        }],
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
    ...(c.extras ? { extras: { ...c.extras } } : {}),
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
