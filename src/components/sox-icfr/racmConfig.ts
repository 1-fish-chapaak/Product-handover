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
 * Scope note: the call wanted one of these PER TEAM. Workspaces in this
 * prototype are decorative — nothing switches between them and every screen
 * shows everything — so this is one config for the session, shaped so a team key
 * can be added in front of it without the callers changing. See the gap list.
 *
 * Session-lifetime, like `racmLibrary` beside it: a prototype reload starts from
 * the defaults, which are the shape the SOX module has always assumed.
 */
import { useSyncExternalStore } from 'react';
import { DEFAULT_CORE_FIELDS, RACM_FIELDS, normaliseHeader, type RacmFieldKey } from './racmImport';

export interface RacmConfig {
  /** The columns a row cannot import without. Everything else may be blank. */
  core: RacmFieldKey[];
  /** Headers this team keeps even though no field means them, in file order. */
  extras: string[];
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

let CONFIG: RacmConfig = { ...DEFAULT };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const racmConfig = (): RacmConfig => CONFIG;
export function useRacmConfig(): RacmConfig {
  return useSyncExternalStore(subscribe, racmConfig, racmConfig);
}

export function setRacmConfig(patch: Partial<RacmConfig>): void {
  CONFIG = { ...CONFIG, ...patch, configured: true };
  emit();
}

export function resetRacmConfig(): void {
  CONFIG = { ...DEFAULT };
  emit();
}

/** Is this field one the team has said a row cannot arrive without? */
export const isCore = (key: RacmFieldKey): boolean => CONFIG.core.includes(key);

/**
 * Remember what a header turned out to mean.
 *
 * Called once an import actually goes ahead, never while the reviewer is still
 * changing their mind — a mapping saved from an abandoned import would teach the
 * next upload a lesson nobody agreed to.
 */
export function rememberMapping(pairs: { header: string; field: RacmFieldKey | null }[]): void {
  const mapping = { ...CONFIG.mapping };
  pairs.forEach(({ header, field }) => {
    const key = normaliseHeader(header);
    if (key) mapping[key] = field;
  });
  CONFIG = { ...CONFIG, mapping };
  emit();
}

/** What this header meant last time, or undefined if it has never been seen. */
export function rememberedField(header: string): RacmFieldKey | null | undefined {
  return CONFIG.mapping[normaliseHeader(header)];
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
 * block every upload they will ever make.
 */
export function configureFromSample(
  headers: { header: string; field: RacmFieldKey | null }[], fileName: string,
): RacmConfig {
  const mapped = headers.filter((h): h is { header: string; field: RacmFieldKey } => h.field !== null);
  const present = new Set(mapped.map(h => h.field));
  const core = RACM_FIELDS.map(f => f.key).filter(k => present.has(k) && DEFAULT_CORE.includes(k));
  const extras = headers.filter(h => h.field === null).map(h => h.header.trim()).filter(Boolean);
  CONFIG = {
    core: core.length ? core : [...DEFAULT_CORE],
    extras: Array.from(new Set(extras)),
    mapping: Object.fromEntries(headers.map(h => [normaliseHeader(h.header), h.field]).filter(([k]) => k)),
    sampleFileName: fileName,
    configured: true,
  };
  emit();
  return CONFIG;
}
