/**
 * Risk and control IDs (S11).
 *
 *   Risk ID    = PROCESS/ENTITY/R001          e.g. TRY/AIH/R001
 *   Control ID = PROCESS/ENTITY/R001/C001     e.g. TRY/AIH/R001/C001
 *
 * PROCESS and ENTITY are short codes, made from the names and editable where a
 * RACM is imported. The entity is the company the row is tested at (the file's
 * entity column, else the one chosen at upload). R and C numbers come from the
 * file's own Risk ID / Control ID when those carry a number, else from the order
 * of the rows.
 *
 * The seeds, the RACM tab's import review and the store all read this. The one
 * piece of state is the code register at the bottom: a name keeps the code it
 * was first given (or was edited to), so every RACM and engagement agrees.
 */
import type { Control } from './types';

// ─── Short codes ────────────────────────────────────────────────────────────────

/** The codes auditors already use for the standard cycles — kept rather than
 *  re-derived, so Treasury stays TRY and Order to Cash stays O2C. */
const KNOWN_PROCESS_CODES: Record<string, string> = {
  'order to cash': 'O2C',
  'procure to pay': 'P2P',
  'record to report': 'R2R',
  'treasury': 'TRY',
  'fixed assets': 'FIX',
  'payroll': 'PAY',
  'payroll (hire to retire)': 'PAY',
  'hire to retire': 'PAY',
  'inventory': 'INV',
  'tax': 'TAX',
  'it general controls': 'ITGC',
  'financial close': 'FCL',
};

const FILLER_WORDS = new Set(['to', 'and', 'of', 'the', 'for', '&']);
/** Legal suffixes say what kind of company it is, not which one. */
const LEGAL_WORDS = new Set(['ltd', 'limited', 'pvt', 'private', 'inc', 'llc', 'plc', 'co', 'corp', 'corporation', 'gmbh', 'sa', 'bv', 'llp', 'fze', 'fzco']);

function words(name: string, drop: Set<string>): string[] {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^A-Za-z0-9]+/)
    .filter(w => w && !drop.has(w.toLowerCase()));
}

/** Initials of the words, topped up to three letters from the last word. */
function initialsCode(ws: string[], max: number): string {
  if (!ws.length) return '';
  if (ws.length === 1) return ws[0]!.slice(0, 3).toUpperCase();
  let code = ws.slice(0, max).map(w => w[0]!).join('');
  const last = ws[Math.min(ws.length, max) - 1]!;
  for (let i = 1; code.length < 3 && i < last.length; i++) code += last[i]!;
  return code.toUpperCase();
}

/** A process's short code — the standard one when it has one. */
export function suggestProcessCode(process: string): string {
  const known = KNOWN_PROCESS_CODES[process.trim().toLowerCase()];
  if (known) return known;
  return initialsCode(words(process, FILLER_WORDS), 4) || 'GEN';
}

/** A company's short code — "Altura Infra Holdings Ltd" → AIH, "Altura Solar Pvt Ltd" → ASO. */
export function suggestEntityCode(entity: string): string {
  return initialsCode(words(entity, LEGAL_WORDS), 3) || 'ENT';
}

/** What a typed code is allowed to be: letters and digits, 2–6 of them. */
export function cleanCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
export const CODE_OK = (code: string) => /^[A-Z0-9]{2,6}$/.test(code);

// ─── Building IDs ───────────────────────────────────────────────────────────────

const pad3 = (n: number) => String(n).padStart(3, '0');
export const riskIdOf = (processCode: string, entityCode: string, r: number) => `${processCode}/${entityCode}/R${pad3(r)}`;
export const controlIdOf = (processCode: string, entityCode: string, r: number, c: number) => `${riskIdOf(processCode, entityCode, r)}/C${pad3(c)}`;

/** True when an ID is already in the PROCESS/ENTITY/R001/C001 shape. */
export const isFormattedControlId = (id: string) => /^[A-Z0-9]{2,6}\/[A-Z0-9]{2,6}\/R\d{3,}\/C\d{3,}$/.test(id);

/** The last run of digits in a file's own ID — "R-07" → 7, "TRE-C-012" → 12. */
function fileNumber(id: string | undefined): number | null {
  const m = String(id ?? '').match(/(\d+)(?!.*\d)/);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return n > 0 ? n : null;
}

export interface AssignIdsOptions {
  processCode: string;
  /** The code for the company a row is tested at. */
  entityCodeOf: (entity: string | undefined) => string;
  /** Read R and C numbers off the rows' own IDs where they carry one. */
  useFileNumbers: boolean;
}

/**
 * Give one RACM's rows their IDs. Rows keep their order; a row whose file
 * number is already taken under the same risk moves to the next free one.
 * Returns the renamed controls (ids and risk ids replaced, nothing else).
 */
export function assignRacmIds(controls: Control[], opts: AssignIdsOptions): Control[] {
  const { processCode, entityCodeOf, useFileNumbers } = opts;
  /** entity code → old risk id → R number */
  const riskNo = new Map<string, Map<string, number>>();
  /** entity code → taken R numbers */
  const riskTaken = new Map<string, Set<number>>();
  /** `${entity}|${r}` → taken C numbers */
  const ctlTaken = new Map<string, Set<number>>();

  return controls.map(c => {
    const ec = entityCodeOf(c.entity);
    const byRisk = riskNo.get(ec) ?? new Map<string, number>();
    riskNo.set(ec, byRisk);
    const rTaken = riskTaken.get(ec) ?? new Set<number>();
    riskTaken.set(ec, rTaken);

    let r = byRisk.get(c.riskId);
    if (r == null) {
      const wanted = useFileNumbers ? fileNumber(c.riskId) : null;
      r = wanted != null && !rTaken.has(wanted) ? wanted : 1;
      while (rTaken.has(r)) r++;
      rTaken.add(r);
      byRisk.set(c.riskId, r);
    }

    const key = `${ec}|${r}`;
    const cTaken = ctlTaken.get(key) ?? new Set<number>();
    ctlTaken.set(key, cTaken);
    const wantedC = useFileNumbers ? fileNumber(c.code ?? c.id) : null;
    let n = wantedC != null && !cTaken.has(wantedC) ? wantedC : 1;
    while (cTaken.has(n)) n++;
    cTaken.add(n);

    return { ...c, id: controlIdOf(processCode, ec, r, n), riskId: riskIdOf(processCode, ec, r) };
  });
}

// ─── Renaming a whole engagement ───────────────────────────────────────────────

/** Keys whose values are never control references: the id a row was seeded
 *  under, and references that embed an id as part of a longer key. */
const KEEP_KEYS = new Set(['seedKey', 'ref', 'wpRef']);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Rename every control and risk in a seeded engagement to the new format.
 *
 * Each control keeps the id it was seeded under as `seedKey`, which every
 * deterministic "real-looking" number (population values, due dates, draws)
 * hashes — so the rename moves no demo number. Every reference to a control
 * across the engagement (findings, audits, runs, the trail, notes) follows the
 * rename: exact matches anywhere, and the id as a whole word inside text.
 * Process and entity codes come from the two lookups, so the RACM tab and the
 * engagement agree on them.
 */
export function renameEngagementIds<T extends { controls: Control[] }>(
  eng: T,
  processCodeOf: (process: string) => string,
  entityCodeOf: (entity: string | undefined) => string,
): T {
  if (!eng.controls.length || eng.controls.every(c => isFormattedControlId(c.id))) return eng;
  const byProcess = new Map<string, Control[]>();
  eng.controls.forEach(c => { const l = byProcess.get(c.process) ?? []; l.push(c); byProcess.set(c.process, l); });
  const renamed = new Map<Control, Control>();
  byProcess.forEach((rows, process) => {
    const out = assignRacmIds(rows, { processCode: processCodeOf(process), entityCodeOf, useFileNumbers: false });
    rows.forEach((c, i) => renamed.set(c, out[i]!));
  });
  const map = new Map<string, string>();
  eng.controls.forEach(c => { map.set(c.id, renamed.get(c)!.id); });

  const olds = Array.from(map.keys()).sort((a, b) => b.length - a.length);
  const inText = new RegExp(`(?<![\\w/-])(${olds.map(escapeRe).join('|')})(?![\\w-])`, 'g');
  const renameString = (s: string): string => {
    const exact = map.get(s);
    if (exact) return exact;
    if (s.length < 4) return s;
    return s.replace(inText, m => map.get(m) ?? m);
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return renameString(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) return v;
      const out: Record<string, unknown> = {};
      Object.entries(v as Record<string, unknown>).forEach(([k, val]) => {
        out[map.get(k) ?? k] = KEEP_KEYS.has(k) ? val : walk(val);
      });
      return out;
    }
    return v;
  };

  const { controls, ...rest } = eng;
  const restRenamed = walk(rest) as Omit<T, 'controls'>;
  const nextControls = controls.map(c => {
    const r = renamed.get(c)!;
    const body = walk({ ...c, id: undefined, riskId: undefined, code: undefined, seedKey: undefined }) as Control;
    // `code` was the client's number when the id had to be made unique across
    // companies; the entity is part of the ID now, so it has nothing to add.
    return { ...body, id: r.id, riskId: r.riskId, code: undefined, seedKey: c.seedKey ?? c.id };
  });
  return { ...restRenamed, controls: nextControls } as T;
}

// ─── The code register ──────────────────────────────────────────────────────────

const PROCESS_CODES = new Map<string, string>();
const ENTITY_CODES = new Map<string, string>();
const nameKey = (name: string) => name.trim().toLowerCase();

function codeFor(register: Map<string, string>, name: string, suggest: (n: string) => string, keep = true): string {
  const key = nameKey(name);
  const had = register.get(key);
  if (had) return had;
  const base = suggest(name);
  const taken = new Set(register.values());
  let code = base;
  for (let n = 2; taken.has(code); n++) code = `${base.slice(0, 5)}${n}`;
  if (keep) register.set(key, code);
  return code;
}
function ownerOf(register: Map<string, string>, code: string): string | undefined {
  for (const [k, v] of register) if (v === code) return k;
  return undefined;
}

/** Names that are the same cycle share its register entry — "Payroll (Hire to
 *  Retire)" is Payroll, so both read PAY rather than PAY and PAY2. */
const PROCESS_ALIASES: Record<string, string> = { 'payroll (hire to retire)': 'payroll', 'hire to retire': 'payroll' };
const processName = (process: string) => PROCESS_ALIASES[nameKey(process)] ?? process;

/** The process's code — the one it already has, else a new unique one. */
export const processCodeFor = (process: string) => codeFor(PROCESS_CODES, processName(process), suggestProcessCode);
/** The company's code — the one it already has, else a new unique one. */
export const entityCodeFor = (entity: string) => codeFor(ENTITY_CODES, entity, suggestEntityCode);

/** The code a name has or would get — without giving it one. For previews
 *  that change as someone types. */
export const peekProcessCode = (process: string) => codeFor(PROCESS_CODES, processName(process), suggestProcessCode, false);
export const peekEntityCode = (entity: string) => codeFor(ENTITY_CODES, entity, suggestEntityCode, false);

/** Which other process already uses this code (lower-cased name), if any. */
export const processCodeTakenBy = (code: string, process: string) => {
  const owner = ownerOf(PROCESS_CODES, code);
  return owner && owner !== nameKey(processName(process)) ? owner : undefined;
};
/** Which other company already uses this code (lower-cased name), if any. */
export const entityCodeTakenBy = (code: string, entity: string) => {
  const owner = ownerOf(ENTITY_CODES, code);
  return owner && owner !== nameKey(entity) ? owner : undefined;
};

/** Record an edited code. Refused (false) when another name holds it. */
export function setProcessCode(process: string, code: string): boolean {
  if (!CODE_OK(code) || processCodeTakenBy(code, process)) return false;
  PROCESS_CODES.set(nameKey(processName(process)), code);
  return true;
}
export function setEntityCode(entity: string, code: string): boolean {
  if (!CODE_OK(code) || entityCodeTakenBy(code, entity)) return false;
  ENTITY_CODES.set(nameKey(entity), code);
  return true;
}
