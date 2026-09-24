/**
 * How this team's RACMs are shaped — which columns must be filled, which extra
 * columns are kept, and what the last upload's headers turned out to mean.
 *
 * The 17 Sep dev call asked for three things this answers:
 *
 *  · **Core columns are the team's choice, not ours.** Every client's matrix is
 *    different, so the list of columns a row cannot import without is set here
 *    rather than hard-coded. `RACM_FIELDS` still says what a column MEANS; this
 *    says which of them are compulsory.
 *
 *  · **Extra columns survive.** A column we have no field for used to be
 *    dropped on the floor. The client put it there for a reason, so its header
 *    is remembered here and its values ride along on the row.
 *
 *  · **The mapping is remembered.** Matching headers to fields is work; doing it
 *    again for every monthly upload of the same workbook is wasted work. What a
 *    header was taken to mean last time is kept and offered first next time.
 *
 * ONE SET-UP PER CLIENT GROUP (22 Sep). Every client writes their matrix
 * differently, so the shape belongs to the client rather than to the product or
 * to a team: Altura's columns are not the Airline group's. The key is the client
 * group a company belongs to (`racmSetupKeyFor` in `racmLibrary`), and a company
 * that belongs to no group yet keeps a set-up under its own name until it joins
 * one. An upload never asks which — the company was chosen at Create RACM.
 *
 * Kept across reloads in the browser (the 17 Sep call's per-TEAM version waits
 * for workspaces to be real; the key here can take a team in front of it). A
 * blocked or cleared store simply starts from the built-in shape.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { ALWAYS_REQUIRED, DEFAULT_CORE_FIELDS, RACM_FIELDS, normaliseHeader, type ExtraColumn, type RacmFieldKey } from './racmImport';

// A client's own column is declared in `racmImport` beside the code that reads
// and checks it, and re-exported here because this is where callers look for
// the shape of a set-up. Same reason `DEFAULT_CORE` lives there.
export type { ExtraColumn, ExtraKind } from './racmImport';
export { extraLabel } from './racmImport';

export interface RacmConfig {
  /** The columns a row cannot import without. Everything else may be blank. */
  core: RacmFieldKey[];
  /** Columns this team keeps even though no field of ours means them, in file
   *  order. Held as strings before 22 Sep — `load` brings those forward. */
  extras: ExtraColumn[];
  /** What a header was taken to mean last time, by its normalised spelling.
   *  `null` records a header deliberately left unmapped, so the next upload
   *  doesn't helpfully re-suggest something already refused. */
  mapping: Record<string, RacmFieldKey | null>;
  /** The file the columns were set up from, for the Config tab to name. */
  sampleFileName?: string;
  /** Whether anyone has configured this, or it is still the built-in shape. */
  configured: boolean;
}

/** The shape the module assumed before any of this was the team's to choose.
 *  Defined in `racmImport` beside the check that reads it, so the two can never
 *  drift apart, and re-exported here because this is where callers look. */
export const DEFAULT_CORE: RacmFieldKey[] = DEFAULT_CORE_FIELDS;

const DEFAULT: RacmConfig = { core: [...DEFAULT_CORE], extras: [], mapping: {}, configured: false };

/** Every client group's set-up, by key. A key with nothing saved reads as the
 *  built-in shape, so a new client needs no set-up act before their first
 *  upload. */
const STORE_KEY = 'irame.racmSetups.v1';
let SETUPS: Record<string, RacmConfig> = load();
const listeners = new Set<() => void>();

/** Extras as they may have been stored — bare headers before 22 Sep, defined
 *  columns after. Anything unreadable is dropped rather than guessed at. */
function readExtras(stored: unknown): ExtraColumn[] {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((e): ExtraColumn[] => {
    if (typeof e === 'string') return e.trim() ? [{ header: e.trim(), kind: 'text', required: false }] : [];
    if (e && typeof e === 'object' && typeof (e as ExtraColumn).header === 'string') {
      const c = e as ExtraColumn;
      return c.header.trim() ? [{ ...c, header: c.header.trim(), kind: c.kind ?? 'text', required: !!c.required }] : [];
    }
    return [];
  });
}

function load(): Record<string, RacmConfig> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) as Record<string, RacmConfig> : {};
    // The locked list may have grown since this was written — a stored set-up
    // never holds a row to less than the product requires. Extras were bare
    // header strings until 22 Sep; one saved then reads as plain text nobody
    // has made compulsory, which is exactly what it was.
    return Object.fromEntries(Object.entries(parsed).map(([k, c]) => [k, {
      ...DEFAULT, ...c,
      core: withLocked(c.core ?? []),
      extras: readExtras(c.extras),
    }]));
  } catch {
    return {}; // private window, blocked storage, or something we didn't write
  }
}
function save(): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(SETUPS)); } catch { /* nothing to do about it */ }
}
const emit = () => { save(); listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The 22 Sep list is always in `core`, whoever asks to take it out — the
 *  Config tab shows it locked, and this is the guarantee behind the padlock. */
function withLocked(core: RacmFieldKey[]): RacmFieldKey[] {
  return RACM_FIELDS.map(f => f.key).filter(k => ALWAYS_REQUIRED.includes(k) || core.includes(k));
}

/** One client group's set-up. Unsaved keys read as the built-in shape. */
export const racmConfig = (key: string): RacmConfig => SETUPS[key] ?? DEFAULT;
export function useRacmConfig(key: string): RacmConfig {
  const read = useCallback(() => racmConfig(key), [key]);
  return useSyncExternalStore(subscribe, read, read);
}
/** The keys that have been set up, for the Config tab to list beside the client
 *  groups it already knows. */
export function savedSetupKeys(): string[] {
  return Object.keys(SETUPS).sort((a, b) => a.localeCompare(b));
}

export function setRacmConfig(key: string, patch: Partial<RacmConfig>): void {
  const cur = racmConfig(key);
  SETUPS = { ...SETUPS, [key]: { ...cur, ...patch, ...(patch.core ? { core: withLocked(patch.core) } : {}), configured: true } };
  emit();
}

export function resetRacmConfig(key: string): void {
  const next = { ...SETUPS };
  delete next[key];
  SETUPS = next;
  emit();
}

/**
 * Remember what a header turned out to mean.
 *
 * Called once an import actually goes ahead, never while the reviewer is still
 * changing their mind — a mapping saved from an abandoned import would teach the
 * next upload a lesson nobody agreed to.
 */
export function rememberMapping(key: string, pairs: { header: string; field: RacmFieldKey | null }[]): void {
  const cur = racmConfig(key);
  const mapping = { ...cur.mapping };
  pairs.forEach(({ header, field }) => {
    const k = normaliseHeader(header);
    if (k) mapping[k] = field;
  });
  SETUPS = { ...SETUPS, [key]: { ...cur, mapping } };
  emit();
}

/**
 * Set the team's columns up from a sample matrix.
 *
 * The first upload is the one that teaches the product what this client's RACM
 * looks like: which of our fields their file actually carries — those become the
 * core list, because a column they always fill is a column we can insist on —
 * and which of their columns we have no field for, which are kept as extras.
 *
 * Fields the file does NOT carry are dropped from core even if they were there
 * by default: insisting on a column the client has never once produced would
 * block every upload they will ever make. The exception is the locked 22 Sep
 * list (`ALWAYS_REQUIRED`): those stay required, and a file without one of
 * them gets Ira's fill or a box at Review instead of a block.
 */
export function configureFromSample(
  key: string, headers: { header: string; field: RacmFieldKey | null }[], fileName: string,
): RacmConfig {
  const mapped = headers.filter((h): h is { header: string; field: RacmFieldKey } => h.field !== null);
  const present = new Set(mapped.map(h => h.field));
  // The locked list stays whatever the file carried (22 Sep) — a column it
  // lacks is filled by Ira or at Review, never dropped from what a row needs.
  const core = withLocked(RACM_FIELDS.map(f => f.key).filter(k => present.has(k) && DEFAULT_CORE.includes(k)));
  // A column we have no field for is kept as the client's own — as plain text
  // nobody has made compulsory, because the file has just told us it exists and
  // nothing more. What it holds is theirs to define on the Config tab.
  const kept = headers.filter(h => h.field === null).map(h => h.header.trim()).filter(Boolean);
  const known = new Map(racmConfig(key).extras.map(e => [e.header.toLowerCase(), e]));
  const extras: ExtraColumn[] = Array.from(new Set(kept)).map(header =>
    // A column already defined keeps its definition — a second upload of the
    // same workbook is not an occasion to forget what it holds.
    known.get(header.toLowerCase()) ?? { header, kind: 'text', required: false });
  const next: RacmConfig = {
    core,
    extras,
    mapping: Object.fromEntries(headers.map(h => [normaliseHeader(h.header), h.field]).filter(([k]) => k)),
    sampleFileName: fileName,
    configured: true,
  };
  SETUPS = { ...SETUPS, [key]: next };
  emit();
  return next;
}
