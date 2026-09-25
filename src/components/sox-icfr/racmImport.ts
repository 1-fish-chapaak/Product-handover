/**
 * RACM import — reading an uploaded matrix (A5) or an SOP extraction (A6) into
 * rows the RACM tab reviews before anything is written.
 *
 * Everything here is pure: the RACM tab's review screens call it, and only the
 * final Import hands `importRowsToControls` output to the store's createRacm.
 *
 *   workbook ─ readRacmWorkbook ─▶ sheets ─ guessHeaderRow ─▶ header row
 *     ─ matchColumns ─▶ one ColumnMatch per RACM field (confidence, needs attention)
 *     ─ buildImportRows ─▶ ImportRow[]  (split attributes, evidence per attribute,
 *                                         merged duplicate checks, frequency flags,
 *                                         duplicates — against the engagement and
 *                                         against the rows already read)
 *     ─ proposeBlankFills / applyFills  (A9: previewed, accepted, then applied)
 *     ─ suggestForRow                   (A7: Ira's missing attributes / design checks)
 *     ─ importRowsToControls ─▶ Control[] for createRacm
 *
 * An SOP has no rows to read in this prototype, so `draftRowsFromSop` drafts
 * them from the process template once the prompt has been validated, tagging
 * each as read from the SOP (with a section reference) or suggested by Ira.
 */
import * as XLSX from 'xlsx';
import { sameCompany } from './auditScope';
import { requiredFilesOf, suggestedDesignChecks, titleFromRisk } from './helpers';
import { racmTemplateForProcesses } from './mockData';
import { CONTROL_CLASSES } from './types';
import type { Assertion, Control, ControlClass, ControlType, DesignPoint, Frequency, Nature, OperatingStep, RiskLikelihood, RiskRating, TestingStrategy } from './types';

// ─── Fields ──────────────────────────────────────────────────────────────────────

export type RacmFieldKey =
  | 'riskId' | 'riskTitle' | 'riskDescription' | 'riskCategory' | 'riskRating'
  | 'controlId' | 'controlTitle' | 'objective' | 'controlActivity'
  | 'subProcess' | 'type' | 'nature' | 'frequency' | 'isKey'
  | 'owner' | 'processOwner' | 'riskOwner' | 'assertions' | 'attributes'
  | 'controlEvidence' | 'designChecks' | 'sopSectionRef' | 'entity'
  | 'effectiveDate' | 'country' | 'testingStrategy' | 'likelihood';

/** What a client's own column holds. Decides what the upload checks and which
 *  box Review offers when one is blank. */
export type ExtraKind = 'text' | 'number' | 'date' | 'yesno' | 'list';

/**
 * A column this client's matrix has and ours does not (22 Sep, feedback #2 —
 * "add, remove, rename and define columns during initial setup").
 *
 * `header` is the client's own spelling and is what an upload matches on, so a
 * rename can never break the match: `label` is only what we call it on screen.
 * That split is the whole reason rename is safe to offer.
 */
export interface ExtraColumn {
  /** The header as the client's file spells it. The match key — never edited. */
  header: string;
  /** What we call it on screen. Absent until someone renames it. */
  label?: string;
  kind: ExtraKind;
  /** For `list` — the only values it may hold, in the order they're offered. */
  options?: string[];
  /** A row can't be imported with this one blank. Off unless someone says so:
   *  a column the product kept from a file should not block the next upload. */
  required: boolean;
}

/** What to call a client's column on screen. */
export const extraLabel = (e: ExtraColumn): string => e.label?.trim() || e.header;

/**
 * A row's value for one of the client's columns.
 *
 * Matched on the normalised heading, never on the exact string. A row's extras
 * are keyed by what the FILE wrote; the set-up is keyed by what someone typed
 * on the Config tab. "Cost centre" and "Cost Centre" are the same column to
 * every other part of the import, and an exact match here would hold every row
 * for a value that is sitting right there.
 */
export function extraValue(row: Pick<ImportRow, 'extras'>, column: ExtraColumn): string {
  const want = normaliseHeader(column.header);
  const hit = Object.entries(row.extras).find(([header]) => normaliseHeader(header) === want);
  return (hit?.[1] ?? '').trim();
}

/** A client's own columns this row has left blank — the required ones only.
 *  Kept apart from `coreBlanks` because these are the client's columns, not
 *  ours: they have no `RacmFieldKey` and no meaning we can read. */
export function extraBlanks(row: ImportRow, extras: ExtraColumn[] = []): ExtraColumn[] {
  return extras.filter(e => e.required && !extraValue(row, e));
}

export interface RacmField {
  key: RacmFieldKey;
  /** What the review screen calls the field. */
  label: string;
  /** Every imported control must end up with a value (22 Sep list — locked:
   *  neither the Config tab nor a first upload can switch it off). A missing
   *  COLUMN only stops the import when nothing can supply it: Ira fills what she
   *  can read, IDs are built, and the rest is filled at Review. The one hard
   *  stop is a file with neither a control title nor a description column. */
  required: boolean;
  /** Header spellings that mean this field, lower-case. */
  synonyms: string[];
}

export const RACM_FIELDS: RacmField[] = [
  { key: 'riskId', label: 'Risk ID', required: false, synonyms: ['risk id', 'risk ref', 'risk no', 'risk number', 'risk #'] },
  { key: 'riskTitle', label: 'Risk title', required: true, synonyms: ['risk title', 'risk name', 'risk heading', 'risk short name'] },
  { key: 'riskDescription', label: 'Risk description', required: true, synonyms: ['risk description', 'risk', 'risk statement', 'what could go wrong'] },
  // 22 Sep: on the required list, and one of the six (see CONTROL_CLASSES).
  // Ira reads it off the risk where the file has no column.
  { key: 'riskCategory', label: 'Risk category', required: true, synonyms: ['risk category', 'risk type', 'category', 'risk classification', 'classification', 'class'] },
  { key: 'riskRating', label: 'Risk rating', required: true, synonyms: ['risk rating', 'inherent risk', 'risk level', 'rating'] },
  { key: 'likelihood', label: 'Likelihood', required: true, synonyms: ['likelihood', 'risk likelihood', 'probability', 'likelihood rating', 'likelihood of occurrence', 'chance'] },
  { key: 'controlId', label: 'Control ID', required: false, synonyms: ['control id', 'control ref', 'control no', 'control number', 'control #'] },
  { key: 'controlTitle', label: 'Control title', required: true, synonyms: ['control title', 'control name', 'control'] },
  { key: 'objective', label: 'Control objective', required: true, synonyms: ['control objective', 'objective'] },
  // Labelled "Control description" since the 17 Sep call: this is the narrative
  // the auditor tests against. 'control description' moved here from
  // controlTitle with the label, so a file using that header lands on the field
  // the header now names.
  { key: 'controlActivity', label: 'Control description', required: true, synonyms: ['control activity', 'control description', 'control procedure', 'activity', 'how the control operates'] },
  { key: 'subProcess', label: 'Sub-process', required: true, synonyms: ['sub-process', 'sub process', 'subprocess', 'process area'] },
  { key: 'type', label: 'Control type', required: true, synonyms: ['control type', 'type', 'preventive / detective'] },
  { key: 'nature', label: 'Control nature', required: true, synonyms: ['control nature', 'nature', 'manual / automated', 'automation'] },
  { key: 'frequency', label: 'Frequency', required: true, synonyms: ['frequency', 'control frequency', 'how often'] },
  { key: 'isKey', label: 'Key control', required: true, synonyms: ['key control', 'key', 'key / non-key', 'is key'] },
  { key: 'owner', label: 'Control owner', required: true, synonyms: ['control owner', 'owner', 'performed by', 'control performer'] },
  { key: 'processOwner', label: 'Process owner', required: true, synonyms: ['process owner'] },
  // 22 Sep: accountable for the risk. A record on the matrix only — it routes no
  // task or request (that lane stays the control and process owner).
  { key: 'riskOwner', label: 'Risk owner', required: true, synonyms: ['risk owner', 'risk accountable', 'risk accountability', 'owner of the risk', 'accountable for risk'] },
  { key: 'assertions', label: 'Assertions', required: true, synonyms: ['assertions', 'assertion', 'financial statement assertions', 'ceavop'] },
  { key: 'attributes', label: 'Attributes', required: true, synonyms: ['attributes', 'test attributes', 'attribute', 'testing attributes'] },
  { key: 'controlEvidence', label: 'Control evidence', required: false, synonyms: ['control evidence', 'evidence', 'supporting evidence', 'documents'] },
  { key: 'designChecks', label: 'Design checks (TOD)', required: true, synonyms: ['tod checks performed', 'tod checks', 'design checks', 'test of design', 'tod'] },
  { key: 'sopSectionRef', label: 'SOP section', required: false, synonyms: ['sop section ref', 'sop section', 'sop reference', 'sop ref'] },
  // The company a row is tested at — the ENTITY part of its ID (S11). A file
  // without one takes the company chosen when the RACM was created.
  { key: 'entity', label: 'Entity', required: true, synonyms: ['entity', 'legal entity', 'entity name', 'subsidiary', 'company', 'company name'] },
  // Added 17 Sep. None of the three blocks an import — a file that does not
  // carry them still lands, and Ira offers a fill per row.
  { key: 'effectiveDate', label: 'Effective date', required: false, synonyms: ['effective date', 'effective from', 'date effective', 'implementation date', 'in place from', 'go live date'] },
  { key: 'country', label: 'Country', required: false, synonyms: ['country', 'location', 'geography', 'jurisdiction'] },
  { key: 'testingStrategy', label: 'Testing strategy', required: false, synonyms: ['testing strategy', 'test strategy', 'testing approach', 'test approach', 'sampling approach', 'coverage'] },
];

// ─── Text helpers (private) ──────────────────────────────────────────────────────

/** Header / synonym comparison form: lower-case, "&" → "and", "#" → "no" (so
 *  "Risk #" reads as "risk no" rather than colliding with plain "risk"),
 *  punctuation → space, spaces collapsed. */
export function normaliseHeader(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/#/g, ' no ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The RACM's own process column. The process is chosen before import, so these
 *  headers are never read as a field — above all not as Sub-process or Process
 *  owner, which share the word. */
const PROCESS_HEADERS = new Set(['process', 'business process', 'process name', 'business cycle', 'cycle', 'mega process', 'major process']);

const NORMALISED_SYNONYMS: Record<RacmFieldKey, string[]> = Object.fromEntries(
  RACM_FIELDS.map(f => [f.key, f.synonyms.map(normaliseHeader).filter(Boolean)]),
) as Record<RacmFieldKey, string[]>;

const FIELD_BY_KEY: Record<RacmFieldKey, RacmField> = Object.fromEntries(RACM_FIELDS.map(f => [f.key, f])) as Record<RacmFieldKey, RacmField>;

/** 98 exact multi-word · 90 exact single word · 85 one contains the other ·
 *  60–80 token overlap (Jaccard ≥ 0.5) · 0 otherwise. Both sides normalised. */
function synonymScore(header: string, synonym: string): number {
  if (!header || !synonym) return 0;
  const multi = synonym.includes(' ');
  if (header === synonym) return multi ? 98 : 90;
  if (multi && (` ${header} `.includes(` ${synonym} `) || (header.length >= 4 && ` ${synonym} `.includes(` ${header} `)))) return 85;
  const a = new Set(header.split(' '));
  const b = new Set(synonym.split(' '));
  let shared = 0;
  a.forEach(w => { if (b.has(w)) shared++; });
  const jaccard = shared / (a.size + b.size - shared);
  return jaccard >= 0.5 ? Math.round(60 + 20 * jaccard) : 0;
}

function bestScore(header: string, field: RacmFieldKey): number {
  if (!header || PROCESS_HEADERS.has(header)) return 0;
  let best = 0;
  for (const s of NORMALISED_SYNONYMS[field]) best = Math.max(best, synonymScore(header, s));
  return best;
}

/** The (WHO) (WHERE) (WHEN) (HOW) (WHY) markers a RACM activity is written with. */
function stripMarkers(text: string): string {
  return text
    .replace(/\s*\(\s*(?:who|what|where|when|how|why)\s*\)/gi, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function firstSentence(text: string): string {
  const t = stripMarkers(text);
  return (t.split(/(?<=[.!?])\s+/)[0] ?? '').trim();
}

function firstClause(text: string): string {
  const t = stripMarkers(text);
  return (t.split(/[,;:]\s|\s[—–-]\s|\.(?:\s|$)/)[0] ?? '').trim().replace(/[.,;:]+$/, '');
}

function sentenceCase(text: string): string {
  const t = text === text.toUpperCase() && /[A-Z]{4}/.test(text) ? text.toLowerCase() : text;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Up to seven words from `index`, stopping at the first punctuation or a
 *  (WHO)-style marker — the phrase a fill's reason quotes. */
function phraseAt(text: string, index: number): string {
  const rest = text.slice(index);
  const stop = rest.search(/[,.;:()]/);
  const phrase = (stop === -1 ? rest : rest.slice(0, stop)).trim();
  const words = phrase.split(/\s+/);
  return words.length > 7 ? `${words.slice(0, 7).join(' ')}…` : phrase;
}

/** Same check twice is one check — compared on its words, ignoring case, spacing
 *  and trailing punctuation. */
function sameText(text: string): string {
  return normaliseHeader(text);
}

const STOPWORDS = new Set([
  'with', 'from', 'into', 'onto', 'that', 'this', 'these', 'those', 'than', 'then', 'there', 'their', 'them', 'they',
  'before', 'after', 'where', 'when', 'whenever', 'what', 'which', 'whom', 'whose', 'while', 'will', 'shall', 'must',
  'should', 'would', 'could', 'been', 'being', 'have', 'having', 'were', 'each', 'every', 'only', 'also', 'such',
  'more', 'most', 'other', 'over', 'under', 'upon', 'within', 'without', 'against', 'between', 'through', 'using',
  'based', 'control', 'controls', 'perform', 'performs', 'performed', 'ensure', 'ensures', 'attribute', 'attributes',
  'tested', 'test', 'primary', 'item', 'items',
]);

function stem(word: string): string {
  for (const suffix of ['ing', 'ed', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) return word.slice(0, -suffix.length);
  }
  return word;
}

/** Meaningful words (4+ letters, no stopwords), lightly stemmed. */
function meaningfulWords(text: string): string[] {
  const words = stripMarkers(String(text ?? '')).toLowerCase().split(/[^a-z]+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w))
    .map(stem);
  return Array.from(new Set(words));
}

/** "approver" ~ "approval", "invoice" ~ "invoices", "change" ~ "changes". */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 5 && long.startsWith(short) && long.length - short.length <= 4) return true;
  return short.length >= 6 && short.slice(0, 6) === long.slice(0, 6);
}

function sharesWord(a: string[], b: string[]): boolean {
  return a.some(x => b.some(y => sameWord(x, y)));
}

/** Share of the candidate's words already said by some line in `have`. */
function alreadySaid(have: string[], candidate: string): boolean {
  const cand = meaningfulWords(candidate);
  if (!cand.length) return false;
  return have.some(h => {
    const hw = meaningfulWords(h);
    return cand.filter(w => hw.some(x => sameWord(w, x))).length / cand.length >= 0.5;
  });
}


function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

let idSeq = 0;
/** Locally unique ids — the store makes them unique across the engagement. */
function nid(prefix: string): string { return `${prefix}-imp${(++idSeq).toString(36)}`; }

// ─── Reading and matching ────────────────────────────────────────────────────────

export interface SheetData { name: string; rows: string[][] }

export interface ColumnMatch {
  field: RacmFieldKey;
  /** 0-based column index in the sheet, or null when nothing matched. */
  column: number | null;
  /** 0–100. Below 70, or null column on a required field, is "needs attention". */
  confidence: number;
}

/** Read every sheet of an .xlsx / .xls / .csv into trimmed string cells. Rejects
 *  when the file can't be parsed. */
export async function readRacmWorkbook(file: File): Promise<SheetData[]> {
  let wb: XLSX.WorkBook;
  try {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: 'array' });
  } catch {
    throw new Error(`${file.name} couldn't be read as a spreadsheet. Save it as .xlsx, .xls or .csv and upload it again.`);
  }
  if (!wb.SheetNames.length) throw new Error(`${file.name} has no sheets to read.`);
  return wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const raw = ws ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false, blankrows: true }) : [];
    return { name, rows: raw.map(r => (Array.isArray(r) ? r : []).map(v => String(v ?? '').trim())) };
  });
}

/** Index of the row that holds the headers — the first row whose cells match at
 *  least three field synonyms; 0 when none does. */
export function guessHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, 30);
  for (let r = 0; r < limit; r++) {
    const fields = new Set<RacmFieldKey>();
    for (const cell of rows[r] ?? []) {
      const text = String(cell ?? '');
      // a header is a label, not a paragraph — long data cells can quote field names
      if (!text || text.length > 60) continue;
      const h = normaliseHeader(text);
      for (const f of RACM_FIELDS) {
        if (bestScore(h, f.key) >= 85) { fields.add(f.key); break; }
      }
    }
    if (fields.size >= 3) return r;
  }
  return 0;
}

/** One ColumnMatch per RACM_FIELDS entry, in that order. Each column is used by
 *  at most one field (best confidence wins). */
export function matchColumns(headers: string[], remembered: Record<string, RacmFieldKey | null> = {}): ColumnMatch[] {
  const norm = headers.map(h => normaliseHeader(h));
  // What this header was taken to mean last time wins outright (B4). Matching
  // headers is work, and doing it again for every monthly upload of the same
  // workbook is work nobody should be asked to repeat. A header recorded as
  // deliberately unmapped stays unmapped — the refusal is remembered too.
  const pinned = new Map<RacmFieldKey, number>();
  const spokenFor = new Set<number>();
  norm.forEach((h, column) => {
    const was = remembered[h];
    if (was === undefined) return;
    spokenFor.add(column);
    if (was !== null && !pinned.has(was)) pinned.set(was, column);
  });
  const pairs: { field: RacmFieldKey; order: number; column: number; confidence: number }[] = [];
  RACM_FIELDS.forEach((f, order) => {
    norm.forEach((h, column) => {
      const confidence = bestScore(h, f.key);
      if (confidence > 0) pairs.push({ field: f.key, order, column, confidence });
    });
  });
  // Greedy on confidence across every (field, column) pair; ties go to the field
  // listed first, then the leftmost column.
  pairs.sort((a, b) => b.confidence - a.confidence || a.order - b.order || a.column - b.column);
  const byField = new Map<RacmFieldKey, { column: number; confidence: number }>();
  const usedColumns = new Set<number>();
  // 100 rather than 98: a remembered header is more certain than an exact
  // wording match, because a person confirmed it on a real file.
  pinned.forEach((column, field) => { byField.set(field, { column, confidence: 100 }); usedColumns.add(column); });
  for (const p of pairs) {
    if (byField.has(p.field) || usedColumns.has(p.column) || spokenFor.has(p.column)) continue;
    byField.set(p.field, { column: p.column, confidence: p.confidence });
    usedColumns.add(p.column);
  }
  return RACM_FIELDS.map(f => {
    const hit = byField.get(f.key);
    return { field: f.key, column: hit ? hit.column : null, confidence: hit ? hit.confidence : 0 };
  });
}

/** Needs attention = a required field with no column (controlTitle and
 *  controlActivity count as satisfied if either has one), or any matched field
 *  below 70% confidence. */
export function needsAttention(matches: ColumnMatch[]): ColumnMatch[] {
  const hasColumn = (k: RacmFieldKey) => matches.some(m => m.field === k && m.column != null);
  const titleOrActivity = hasColumn('controlTitle') || hasColumn('controlActivity');
  return matches.filter(m => {
    if (m.column != null) return m.confidence < 70;
    if (!FIELD_BY_KEY[m.field]?.required) return false;
    if (m.field === 'controlTitle' || m.field === 'controlActivity') return !titleOrActivity;
    return true;
  });
}

// ─── Rows ────────────────────────────────────────────────────────────────────────

export type ImportOrigin = 'file' | 'sop' | 'suggested';

export interface ImportAttribute {
  text: string;
  /** Required files for this attribute — the Control evidence split per attribute. */
  requiredFiles: string[];
}

/** One proposed value for an empty field (A9) — shown before → after, applied only once accepted. */
export interface BlankFill {
  field: RacmFieldKey;
  value: string;
  /** Plain-English reason, e.g. "Activity says 'on receipt of every invoice'". */
  reason: string;
}

export interface ImportRow {
  /** Stable React key. */
  key: string;
  /** 1-based row number in the sheet, or order in the SOP draft. */
  rowNo: number;
  origin: ImportOrigin;
  /** SOP section the row was read from, e.g. "§ 4.2". SOP rows only. */
  sectionRef?: string;
  /** Cell text per mapped field, after any accepted fills. Blank cells are ''. */
  values: Partial<Record<RacmFieldKey, string>>;
  /** THE FILE'S OWN COLUMNS WE HAVE NO FIELD FOR, by their header (B1).
   *
   *  These used to be dropped on the floor. A client put a column in their
   *  matrix for a reason, and a product that silently discards it is asking them
   *  to maintain their real RACM somewhere else. We do not understand these
   *  values, so nothing reads them — they are carried, shown, and exported. */
  extras: Record<string, string>;
  /** Attributes split one per line or per "|" (also ";" and bullets). */
  attributes: ImportAttribute[];
  /** Design checks split the same way, duplicates merged (R2). */
  designChecks: string[];
  /** How many duplicate design checks were merged on this row. */
  mergedDuplicateChecks: number;
  /** Parsed frequency. null when blank, unreadable, or "Continuous" — the user must pick one. */
  frequency: Frequency | null;
  frequencyFlag?: 'continuous' | 'unreadable' | 'blank';
  isKey: boolean;
  /** null when the file leaves it blank or says something we can't read — the
   *  reviewer picks it (17 Sep: no silent "Manual"). */
  nature: Nature | null;
  natureFlag?: 'unreadable' | 'blank';
  /** null the same way — no silent "Preventive". */
  type: ControlType | null;
  typeFlag?: 'unreadable' | 'blank';
  assertions: Assertion[];
  riskRating?: RiskRating;
  likelihood?: RiskLikelihood;
  /** Undefined when the file leaves it blank or says something we can't read —
   *  optional, so a blank one never blocks the import (17 Sep). */
  testingStrategy?: TestingStrategy;
  /** A8: this row says, word for word, what a control already on file says —
   *  one already in this RACM, one in another RACM, or one an earlier row of
   *  this same file already wrote. Set only when EVERY field in
   *  `DUPLICATE_FIELDS` is identical (24 Sep rule); anything less is a different
   *  control and is imported. `kind` only says which RACM the twin sits in —
   *  both are duplicates and both start left out. */
  duplicateOf?: {
    kind: 'same-process' | 'other-process';
    /** The control's id, or the key of an earlier row in this import. */
    controlId: string;
    process: string;
    /** What a person recognises it by — 'AIH/INV/R001/C001', or 'row 4'. */
    name: string;
    /** Where it sits, in words — 'this RACM', 'this file', 'the Treasury RACM
     *  for Airline Group Ltd'. */
    where: string;
    /** The whole verdict in one sentence, for a tooltip or a screen reader. */
    reason: string;
  };
}

/** Held back from import: the row is a duplicate — every field in
 *  `DUPLICATE_FIELDS` matches a control already on file.
 *
 *  Both kinds count. The 17 Sep build held back only a twin in THIS matrix and
 *  let a twin in another RACM through as a note, on the reasoning that one
 *  control can legitimately answer for two processes. The 24 Sep rule is about
 *  the control, not about where its twin sits: if all of it is the same, it is
 *  the same control and we do not write it again. Nothing is hidden either way
 *  — a left-out row is still on screen, still says which control it repeats,
 *  and is still one tick from going in. */
export const rowRepeats = (row: ImportRow) => !!row.duplicateOf;

// ── cell readers ─────────────────────────────────────────────────────────────────

const FREQUENCY_CELL: [RegExp, Frequency][] = [
  [/\b(?:annual|annually|yearly|once a year)\b/, 'Annual'],
  [/\bquarterly\b/, 'Quarterly'],
  [/\bmonthly\b/, 'Monthly'],
  [/\bweekly\b/, 'Weekly'],
  [/\bdaily\b/, 'Daily'],
  [/\b(?:recurring|per transaction|each transaction|every transaction|transactional|as and when|on occurrence|event driven|event based|multiple times a day)\b/, 'Recurring'],
  [/\b(?:ad hoc|adhoc|as needed|as required)\b/, 'Ad-hoc'],
];

/** Frequencies the prototype has no word for — read as unreadable rather than
 *  rounded to the nearest one ("semi-annual" is not Annual). */
const FREQUENCY_UNSUPPORTED = /\b(?:semi annual|semiannual|bi annual|biannual|half yearly|bi weekly|biweekly|fortnightly|bi monthly|bimonthly)\b/;

export function parseFrequency(cell: string): { frequency: Frequency | null; flag?: 'continuous' | 'unreadable' | 'blank' } {
  const t = normaliseHeader(cell);
  if (!t) return { frequency: null, flag: 'blank' };
  if (/\bcontinuous(?:ly)?\b/.test(t)) return { frequency: null, flag: 'continuous' };
  if (FREQUENCY_UNSUPPORTED.test(t)) return { frequency: null, flag: 'unreadable' };
  const found = new Set<Frequency>();
  for (const [re, f] of FREQUENCY_CELL) if (re.test(t)) found.add(f);
  // "Quarterly / annual" names two — the user picks, nothing is guessed
  return found.size === 1 ? { frequency: [...found][0] } : { frequency: null, flag: 'unreadable' };
}

function parseIsKey(cell: string): boolean {
  return ['yes', 'y', 'true', 'key', '1', '✓', '✔'].includes(String(cell ?? '').trim().toLowerCase());
}

function parseNature(cell: string): { nature: Nature | null; flag?: 'unreadable' | 'blank' } {
  const t = normaliseHeader(cell);
  if (!t) return { nature: null, flag: 'blank' };
  if (/\bit dependent\b|\bsemi automated\b|\bitdm\b/.test(t)) return { nature: 'IT-dependent' };
  if (/\bautomat(?:ed|ic|ically)\b/.test(t)) return { nature: 'Automated' };
  if (/\bmanual(?:ly)?\b/.test(t)) return { nature: 'Manual' };
  return { nature: null, flag: 'unreadable' };
}

function parseType(cell: string): { type: ControlType | null; flag?: 'unreadable' | 'blank' } {
  const t = normaliseHeader(cell);
  if (!t) return { type: null, flag: 'blank' };
  const detect = /\bdetect/.test(t);
  const prevent = /\bprevent/.test(t);
  if (detect !== prevent) return { type: detect ? 'Detective' : 'Preventive' };
  return { type: null, flag: 'unreadable' };
}

export const ASSERTION_ORDER: Assertion[] = ['Completeness', 'Accuracy', 'Existence / Occurrence', 'Cut-off', 'Valuation', 'Rights & Obligations', 'Presentation'];
const ASSERTION_CELL: [RegExp, Assertion][] = [
  [/\bcompleteness\b|\bcomplete\b/, 'Completeness'],
  [/\baccuracy\b|\baccurate\b/, 'Accuracy'],
  [/\bexistence\b|\boccurrence\b/, 'Existence / Occurrence'],
  [/\bcut off\b|\bcutoff\b/, 'Cut-off'],
  [/\bvaluation\b/, 'Valuation'],
  [/\brights\b|\bobligations?\b/, 'Rights & Obligations'],
  [/\bpresentation\b|\bdisclosures?\b/, 'Presentation'],
];
const CEAVOP_LETTER: Record<string, Assertion> = {
  c: 'Completeness', e: 'Existence / Occurrence', a: 'Accuracy', v: 'Valuation', o: 'Rights & Obligations', p: 'Presentation',
};

export function parseAssertions(cell: string): Assertion[] {
  const t = normaliseHeader(cell);
  if (!t) return [];
  const tokens = t.split(' ');
  // "C, A, V" — the CEAVOP letters on their own
  const found = new Set<Assertion>();
  if (tokens.every(w => w.length === 1 && CEAVOP_LETTER[w])) tokens.forEach(w => found.add(CEAVOP_LETTER[w]));
  else for (const [re, a] of ASSERTION_CELL) if (re.test(t)) found.add(a);
  return ASSERTION_ORDER.filter(a => found.has(a));
}

/** Reads the likelihood column onto the standard's three words. A client's
 *  matrix rarely uses them — most say High/Medium/Low, some say Likely/Rare —
 *  so the common dialects map across. "Reasonably possible" is checked before
 *  the bare "possible" and "remote" alternatives, because the phrase contains
 *  both words and would otherwise be caught by whichever line ran first. */
function parseLikelihood(cell: string): RiskLikelihood | undefined {
  const t = normaliseHeader(cell);
  if (!t) return undefined;
  if (/\breasonably possible\b/.test(t)) return 'Reasonably possible';
  if (/\b(?:probable|likely|almost certain|high|frequent)\b/.test(t)) return 'Probable';
  if (/\b(?:possible|moderate|medium|occasional)\b/.test(t)) return 'Reasonably possible';
  if (/\b(?:remote|unlikely|rare|low|improbable)\b/.test(t)) return 'Remote';
  return undefined;
}
function parseRiskRating(cell: string): RiskRating | undefined {
  const t = normaliseHeader(cell);
  if (!t) return undefined;
  if (/\b(?:high|critical)\b/.test(t)) return 'High';
  if (/\b(?:medium|moderate)\b/.test(t)) return 'Medium';
  if (/\blow\b/.test(t)) return 'Low';
  return undefined;
}

/** Reads the coverage column. Deliberately narrow — a cell we cannot place
 *  comes back undefined and the reviewer picks, rather than being rounded into
 *  'Sampling' because that is the commonest answer. */
function parseTestingStrategy(cell: string): TestingStrategy | undefined {
  const t = normaliseHeader(cell);
  if (!t) return undefined;
  if (/\b(?:full population|whole population|entire population|100 ?%|census|all items|complete testing)\b/.test(t)) return 'Full population';
  if (/\b(?:test of one|single instance|one instance|sample of one|one occurrence|1 item)\b/.test(t)) return 'Test of one';
  if (/\b(?:sampl\w*|judgemental|judgmental|statistical|attribute testing|haphazard|random)\b/.test(t)) return 'Sampling';
  return undefined;
}

function mergeChecks(items: string[]): { checks: string[]; merged: number } {
  const seen = new Set<string>();
  const checks: string[] = [];
  for (const item of items) {
    const k = sameText(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    checks.push(item);
  }
  return { checks, merged: items.length - checks.length };
}

/** Required files an SOP row's attribute needs, read the same way the control
 *  page reads an unedited attribute (its wording, then the activity) — kept to the
 *  items still in the row's evidence, so an SOP draft re-derives to itself. */
function sopFilesFor(text: string, values: Partial<Record<RacmFieldKey, string>>, evidence: string[]): string[] {
  const step: OperatingStep = { id: 'sop', code: '', description: text, assertion: 'Accuracy', precision: '', procedures: [], result: 'Not tested' };
  const activity = (values.controlActivity ?? '').trim();
  const labels = requiredFilesOf(step, { description: (values.controlTitle ?? '').trim(), controlActivity: activity || undefined }).map(f => f.label);
  const inEvidence = new Set(evidence.map(sameText));
  return labels.filter(l => inEvidence.has(sameText(l)));
}

/**
 * EVERY field that has to be identical before a row is called a duplicate
 * (24 Sep rule). All of them, or it is a different control and it is imported.
 *
 * This replaces a similarity score. The old rule held a row back when three
 * quarters of the meaningful words in its control wording matched something
 * else — a resemblance, not a repeat. Two different approval controls written
 * by the same hand scored the same as one control uploaded twice, so the
 * reviewer was asked to argue with a guess, about rows they could not see the
 * other side of. Nothing is held back now unless it says, field for field,
 * what something already on file says.
 *
 * The list doubles as the reason on screen: Review prints these labels and puts
 * the two values side by side, so the verdict is read rather than trusted.
 * Anything added here appears there automatically.
 *
 * The control's activity and its description are ONE field, because they are
 * one field in this product: `controlActivity` is labelled "Control
 * description" (17 Sep call) and holds the narrative the auditor tests against.
 */
export const DUPLICATE_FIELDS: { key: RacmFieldKey; label: string }[] = [
  { key: 'riskTitle', label: 'Risk title' },
  { key: 'riskDescription', label: 'Risk description' },
  { key: 'controlTitle', label: 'Control title' },
  { key: 'controlActivity', label: 'Control description' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'type', label: 'Control type' },
  // A control tested differently IS a different control (user ask, 24 Sep):
  // two rows sharing a title and a description but asking for different design
  // checks, or different test attributes, are two pieces of work and both belong
  // in the matrix. Order does not matter — see `listKey`.
  { key: 'designChecks', label: 'Design checks' },
  { key: 'attributes', label: 'Attributes' },
];

/** A list compared as a set: normalised, de-duplicated and sorted, so the same
 *  checks written in a different order still read as the same checks. */
const listKey = (items: string[]): string =>
  Array.from(new Set(items.map(sameText).filter(Boolean))).sort().join(' | ');

/** The six values of one side of the comparison. */
export type DuplicateValues = Partial<Record<RacmFieldKey, string>>;

/** Something a row is compared against: a control already on the engagement, or
 *  a row earlier in the same import. */
interface DuplicateCandidate {
  /** What `duplicateOf` carries — a control's id, or an earlier row's key. */
  id: string;
  process: string;
  /** Whether the twin sits in the RACM being built. It changes how the reason
   *  reads, not whether the row is a duplicate. */
  sameProcess: boolean;
  /** Whether the twin belongs to the SAME COMPANY. Only these are compared at
   *  all — see `findDuplicate`. */
  sameFirm: boolean;
  /** How the reason names it, and where it says that thing sits. */
  name: string;
  where: string;
  /** The six fields, read the same way on both sides. */
  values: DuplicateValues;
}

/** The same matrix means the same process AT THE SAME COMPANY.
 *
 *  A RACM is named for both — the IDs read ENTITY/PROCESS/R001/C001 — and the
 *  library holds one Treasury matrix per company on purpose. Comparing on the
 *  process alone would call the second company's Treasury upload a repeat of
 *  the first's, row for row, and block an import that is entirely correct.
 *
 *  A blank company on either side is treated as a match rather than a mismatch:
 *  it means nobody said, and a silent "different company" would let a real
 *  repeat through. */
const sameMatrix = (aProcess: string, aEntity: string, bProcess: string, bEntity: string): boolean =>
  aProcess === bProcess && (!aEntity.trim() || !bEntity.trim() || sameCompany(aEntity, bEntity));

function candidateFromControl(c: Control, process: string, entity: string): DuplicateCandidate {
  const shown = c.code ?? c.id;
  const sameProcess = sameMatrix(c.process, c.entity ?? '', process, entity);
  return {
    id: c.id,
    process: c.process,
    sameProcess,
    sameFirm: !c.entity?.trim() || !entity.trim() || sameCompany(c.entity, entity),
    name: shown,
    where: sameProcess ? 'this RACM' : `the ${c.process} RACM${c.entity && !sameCompany(c.entity, entity) ? ` for ${c.entity}` : ''}`,
    values: controlDuplicateValues(c),
  };
}

/** The six fields off a control already on the engagement — the other side of
 *  the comparison, and what Review prints beside the row's own values. */
export function controlDuplicateValues(c: Control): DuplicateValues {
  return {
    riskTitle: c.riskTitle ?? '',
    riskDescription: c.riskDescription,
    // `description` is what the RACM calls the control title; `controlActivity`
    // is what it calls the control description. Same two fields, both sides.
    controlTitle: c.description,
    controlActivity: c.controlActivity ?? '',
    frequency: c.frequency,
    type: c.type,
    designChecks: listKey(c.design.points.map(p => p.text)),
    attributes: listKey(c.operating.steps.map(st => st.description)),
  };
}

/** A row read earlier in this same file. Every row of one import lands in the
 *  RACM being created, so the process always matches — but a file can name a
 *  company per row, and the same control tested at two companies is two rows,
 *  not a repeat. */
function candidateFromRow(row: ImportRow, process: string, entity: string): DuplicateCandidate {
  const rowEntity = (row.values.entity ?? '').trim() || entity;
  return {
    id: row.key,
    process,
    sameProcess: sameMatrix(process, rowEntity, process, entity),
    sameFirm: !rowEntity.trim() || !entity.trim() || sameCompany(rowEntity, entity),
    name: `row ${row.rowNo}`,
    where: 'this file',
    values: duplicateValues(row),
  };
}

/** The six fields off a row. Frequency and type are read from what the row
 *  PARSED, not from the raw cell, so the comparison is between the two values
 *  this product will actually store — "Monthly", "monthly" and "MONTHLY " are
 *  one frequency here, and a spelling `parseFrequency` cannot read is not
 *  quietly compared as text (it is null, the row is held for a frequency, and
 *  it is never called a duplicate on a value nobody has confirmed). */
export function duplicateValues(row: ImportRow): DuplicateValues {
  const v = row.values;
  return {
    riskTitle: (v.riskTitle ?? '').trim(),
    riskDescription: (v.riskDescription ?? '').trim(),
    controlTitle: (v.controlTitle ?? '').trim(),
    controlActivity: (v.controlActivity ?? '').trim(),
    frequency: row.frequency ?? '',
    type: row.type ?? '',
    designChecks: listKey(row.designChecks),
    attributes: listKey(row.attributes.map(a => a.text)),
  };
}

/**
 * Are these the same control? Field by field, normalised for case, punctuation
 * and spacing — nothing looser.
 *
 * A blank on EITHER side is never a match. Sameness cannot be established on a
 * field nobody filled in, and the two mistakes here are not equal: keeping a
 * row that turns out to be a repeat costs one deletion, while dropping a
 * control nobody meant to drop leaves a hole in the matrix that only shows up
 * at testing. So an unanswered field keeps the row.
 */
function identical(mine: DuplicateValues, theirs: DuplicateValues): boolean {
  return DUPLICATE_FIELDS.every(f => {
    const a = sameText(mine[f.key] ?? '');
    return !!a && a === sameText(theirs[f.key] ?? '');
  });
}

/**
 * Does this row say, field for field, what something already on file says?
 *
 * The only answer that counts is all of `DUPLICATE_FIELDS` or none of it
 * (24 Sep): a row is either the same control, and we do not write it twice, or
 * it is a different control, and we keep it. Nothing in between is a reason to
 * hold anything back — a row that merely reads alike imports like any other.
 *
 * Three places a twin can sit, all of them checked: this RACM, another RACM of
 * the SAME COMPANY, and `earlier` — the rows already read from this same file,
 * since two identical lines in one upload are the commonest repeat there is.
 *
 * Another company is never a duplicate, however identical the wording. The
 * library holds one Inventory matrix per legal entity on purpose, and the same
 * control written the same way is exactly what two entities running the same
 * procedure SHOULD have — each is tested, evidenced and signed off separately.
 * Without this, uploading Altura's Inventory SOP called all five of its rows
 * repeats of Airline Group's Inventory RACM and left every one of them out, for
 * a matrix Altura did not yet have. "The same control in another RACM" means
 * another of this company's RACMs.
 *
 * A control ID no longer decides anything on its own. Two files number their
 * controls independently, so the same ID rarely meant the same control; and the
 * ID this row imports under is built at Import from the codes and the row
 * order, not taken from the file. What the ID does now is NAME the twin in the
 * reason, so the reviewer can go and look at it.
 */
function findDuplicate(row: ImportRow, existing: Control[], process: string, earlier: ImportRow[], entity: string): ImportRow['duplicateOf'] {
  // The row's own company wins over the RACM's, the same way it does everywhere
  // else a row carries one.
  const mine = (row.values.entity ?? '').trim() || entity;
  const values = duplicateValues(row);
  // Nothing to compare: a row still missing one of the six cannot be shown to
  // be a duplicate, so it is not one. See `identical`.
  if (DUPLICATE_FIELDS.some(f => !sameText(values[f.key] ?? ''))) return undefined;

  const hits = [
    ...existing.map(c => candidateFromControl(c, process, mine)),
    ...earlier.map(r => candidateFromRow(r, process, mine)),
  ].filter(c => c.sameFirm && identical(values, c.values));
  if (!hits.length) return undefined;

  // A twin in this RACM is named ahead of one elsewhere — it is the one the
  // reviewer can open in the next tab and check.
  const hit = hits.find(c => c.sameProcess) ?? hits[0]!;
  return {
    kind: hit.sameProcess ? 'same-process' : 'other-process',
    controlId: hit.id,
    process: hit.process,
    name: hit.name,
    where: hit.where,
    reason: `Identical to ${hit.name} in ${hit.where} — all ${DUPLICATE_FIELDS.length} fields match`,
  };
}

/** Build review rows from the data rows below `headerRow`, skipping fully blank
 *  rows. `existing` is every control on the engagement (for A8 duplicates) and
 *  `process` is the RACM being created — a row is checked against both, and
 *  against the rows read before it. */
export function buildImportRows(rows: string[][], headerRow: number, matches: ColumnMatch[], existing: Control[], process: string, entity = '', keepExtras: ExtraColumn[] = []): ImportRow[] {
  const mapped = matches.filter((m): m is ColumnMatch & { column: number } => m.column != null);
  // Columns no field claimed. The process column is skipped — it is chosen
  // before the import and would otherwise ride along on every row as an extra
  // saying what the RACM already says.
  const spokenFor = new Set(mapped.map(m => m.column));
  const headers = rows[headerRow] ?? [];
  const wanted = new Set(keepExtras.map(e => normaliseHeader(e.header)));
  const extraCols = headers
    .map((h, column) => ({ header: String(h ?? '').trim(), column }))
    .filter(h => h.header && !spokenFor.has(h.column) && !PROCESS_HEADERS.has(normaliseHeader(h.header)))
    // An empty configuration means nothing has been set up yet, so every
    // unclaimed column is kept; once a team has said which extras it wants, that
    // list is honoured exactly.
    .filter(h => !wanted.size || wanted.has(normaliseHeader(h.header)));
  const out: ImportRow[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    const values: Partial<Record<RacmFieldKey, string>> = {};
    for (const m of mapped) values[m.field] = String(cells[m.column] ?? '').trim();
    // Blank across every mapped column is blank for import too — a section label
    // sitting only in an unmapped column (e.g. the process name) is not a control.
    if (!Object.values(values).some(v => v)) continue;
    const extras: Record<string, string> = {};
    for (const e of extraCols) {
      const cell = String(cells[e.column] ?? '').trim();
      if (cell) extras[e.header] = cell;
    }
    const rowNo = r + 1;
    // `out` is the rows read before this one: the first of two identical lines is
    // the one that stands, the second is the one flagged.
    out.push(rowFromValues(values, { key: `row-${rowNo}`, rowNo, origin: 'file', extras }, existing, process, out, entity));
  }
  return out;
}

/** The file's headers paired with what the matcher took each to mean — what the
 *  Config tab sets up from, and what the mapping is remembered from. */
export function headerMapping(rows: string[][], headerRow: number, matches: ColumnMatch[]): { header: string; field: RacmFieldKey | null }[] {
  const byColumn = new Map<number, RacmFieldKey>();
  matches.forEach(m => { if (m.column != null) byColumn.set(m.column, m.field); });
  return (rows[headerRow] ?? [])
    .map((h, column) => ({ header: String(h ?? '').trim(), field: byColumn.get(column) ?? null }))
    .filter(h => h.header && !PROCESS_HEADERS.has(normaliseHeader(h.header)));
}

/** Rebuild one row from edited `values` (after fills, or a frequency picked in
 *  review), re-deriving everything else the same way buildImportRows does.
 *  `earlier` is the rows that come before it in the same import. */
export function rowFromValues(values: Partial<Record<RacmFieldKey, string>>, base: Pick<ImportRow, 'key' | 'rowNo' | 'origin' | 'sectionRef'> & { extras?: Record<string, string> }, existing: Control[], process: string, earlier: ImportRow[] = [], entity = ''): ImportRow {
  const v: Partial<Record<RacmFieldKey, string>> = { ...values };

  const attributeTexts = splitList(v.attributes ?? '');
  const evidence = splitList(v.controlEvidence ?? '');
  const splitFiles = splitEvidencePerAttribute(evidence, attributeTexts);
  const attributes: ImportAttribute[] = attributeTexts.map((text, i) => {
    if (base.origin !== 'file') {
      const files = sopFilesFor(text, v, evidence);
      if (files.length) return { text, requiredFiles: files };
    }
    return { text, requiredFiles: splitFiles[i] ?? [] };
  });

  const { checks, merged } = mergeChecks(splitList(v.designChecks ?? ''));
  const freq = parseFrequency(v.frequency ?? '');
  const nature = parseNature(v.nature ?? '');
  const type = parseType(v.type ?? '');

  const row: ImportRow = {
    key: base.key,
    rowNo: base.rowNo,
    origin: base.origin,
    values: v,
    extras: base.extras ?? {},
    attributes,
    designChecks: checks,
    mergedDuplicateChecks: merged,
    frequency: freq.frequency,
    isKey: parseIsKey(v.isKey ?? ''),
    nature: nature.nature,
    type: type.type,
    assertions: parseAssertions(v.assertions ?? ''),
  };
  if (base.sectionRef) row.sectionRef = base.sectionRef;
  if (freq.flag) row.frequencyFlag = freq.flag;
  if (nature.flag) row.natureFlag = nature.flag;
  if (type.flag) row.typeFlag = type.flag;
  const rating = parseRiskRating(v.riskRating ?? '');
  if (rating) row.riskRating = rating;
  const likely = parseLikelihood(v.likelihood ?? '');
  if (likely) row.likelihood = likely;
  const strategy = parseTestingStrategy(v.testingStrategy ?? '');
  if (strategy) row.testingStrategy = strategy;
  // Read off the BUILT row, not the raw cells: the duplicate rule compares the
  // frequency and the type this row actually parsed to.
  const dup = findDuplicate(row, existing, process, earlier, entity);
  if (dup) row.duplicateOf = dup;
  return row;
}

const LEADING_BULLET = /^\s*(?:[-–—•*·▪◦]+|\(?\d{1,3}[.)](?!\d)|\(?[a-z]\))\s*/i;

/** Split a cell into items: new lines, "|", ";", and leading bullets / numbering. Trimmed, empties dropped. */
export function splitList(text: string): string[] {
  return String(text ?? '')
    .split(/\r\n|\r|\n|[|;•]/)
    .map(s => s.replace(LEADING_BULLET, '').trim())
    .filter(s => /[\p{L}\p{N}]/u.test(s));
}

/** Give each attribute the evidence items that share words with it; an
 *  attribute nothing matches gets the first item. Returns one list per attribute. */
export function splitEvidencePerAttribute(evidence: string[], attributes: string[]): string[][] {
  if (!evidence.length) return attributes.map(() => []);
  const evidenceWords = evidence.map(meaningfulWords);
  return attributes.map(a => {
    const words = meaningfulWords(a);
    const hits = evidence.filter((_, i) => sharesWord(words, evidenceWords[i]));
    return hits.length ? hits : [evidence[0]];
  });
}

// ── A9 blank fills ───────────────────────────────────────────────────────────────

const FREQUENCY_TEXT: [RegExp, Frequency][] = [
  [/\bdaily\b|\b(?:every|each) (?:working |business )?day\b/i, 'Daily'],
  [/\bweekly\b|\b(?:every|each) week\b/i, 'Weekly'],
  [/\bmonthly\b|\b(?:every|each) month\b|\bmonth[- ]end\b/i, 'Monthly'],
  [/\bquarterly\b|\b(?:every|each) quarter\b|\bquarter[- ]end\b/i, 'Quarterly'],
  [/\bannual(?:ly)?\b|\byearly\b|\b(?:every|each) year\b|\byear[- ]end\b/i, 'Annual'],
  [/\bwhenever\b|\bon receipt of\b|\bper transaction\b|\bas and when\b|\bin real[- ]time\b|\bas it is raised\b|\bon occurrence\b|\b(?:every|each) (?:transaction|invoice|payment|order|request|entry|journal|change|receipt)\b/i, 'Recurring'],
  [/\bad[- ]hoc\b|\bas needed\b|\bas required\b/i, 'Ad-hoc'],
];

const ASSERTION_RISK_WORDS: [RegExp, Assertion][] = [
  [/\bcomplete(?:ness)?\b|\bunrecorded\b|\bnot recorded\b|\bomitted\b|\bmissing\b|\bunderstat\w*/i, 'Completeness'],
  [/\baccura\w*|\binaccura\w*|\bincorrect\w*|\berrors?\b|\bmiscalculat\w*/i, 'Accuracy'],
  [/\bexist\w*|\boccurr\w*|\binvalid\b|\bfictitious\b|\bunauthori[sz]ed\b|\bwithout (?:dual )?authori[sz]ation\b|\bfraudulent\b|\boverstat\w*/i, 'Existence / Occurrence'],
  [/\bcut[- ]?off\b|\bwrong period\b|\bincorrect period\b/i, 'Cut-off'],
  [/\bvaluation\b|\bvalued\b|\bimpair\w*|\bprovision\w*/i, 'Valuation'],
  [/\brights\b|\bobligations?\b|\bownership\b/i, 'Rights & Obligations'],
  [/\bpresentation\b|\bdisclos\w*|\bclassif\w*/i, 'Presentation'],
];

/** "To ensure vendor invoices are approved" → "Risk that vendor invoices are
 *  not approved." Only the words the row already has — when there is no verb to
 *  turn round, the control's own words are quoted. */
function riskFromText(text: string): string {
  const clause = firstClause(text.replace(/^\s*to\s+ensure\s+(?:that\s+)?/i, '')).replace(/[.;:]+$/, '').trim();
  if (clause.length < 3) return '';
  const aux = /\b(is|are|was|were|will)\b/i.exec(clause);
  const lower = clause[0]!.toLowerCase() + clause.slice(1);
  if (aux) {
    const at = aux.index + aux[0].length;
    const turned = lower.slice(0, at) + ' not' + lower.slice(at);
    return `Risk that ${turned}.`;
  }
  return `Risk that "${lower}" does not happen, so errors go unnoticed.`;
}

/**
 * Ira's risk category, read off the risk's own words (22 Sep). One rule for the
 * upload's Review and the New control form, like `draftAttributes`.
 *
 * `word` comes back so the screen can say WHY — "Risk mentions 'diverted'" is
 * checkable; "Fraud" on its own is not.
 *
 * The fallback is deliberate and stated rather than hidden: on an ICFR matrix a
 * risk that names nothing else is a risk to the financial statements. That is
 * the matrix's whole subject. She says so, and the reviewer can change it.
 */
export function draftRiskCategory(riskText: string, controlText = ''): { category: ControlClass; word: string | null } {
  const text = `${riskText} ${controlText}`.trim();
  if (text) {
    for (const [re, category] of CATEGORY_TEXT) {
      const m = re.exec(text);
      if (m) return { category, word: m[0].toLowerCase() };
    }
  }
  return { category: 'Financial', word: null };
}

/** The values a row can't be imported without. 17 Sep started it; the 22 Sep
 *  list made it every field below and locked it (`ALWAYS_REQUIRED`). A blank
 *  Risk or Control ID is not one — the ID is built at import. Frequency is
 *  checked on its own (`rowBlocked`), because it is parsed, not typed. */
export type CoreBlank =
  | 'riskTitle' | 'riskDescription' | 'riskOwner' | 'riskCategory'
  | 'controlTitle' | 'controlActivity' | 'owner'
  | 'nature' | 'type' | 'assertions' | 'designChecks' | 'attributes'
  // Switched on per client group on the Config tab: a blank one holds the row
  // only where that client's set-up says the column is required (22 Sep).
  | 'objective' | 'subProcess' | 'riskRating' | 'likelihood' | 'processOwner'
  | 'controlEvidence' | 'sopSectionRef' | 'effectiveDate' | 'country' | 'testingStrategy';
export const CORE_BLANK_LABEL: Record<CoreBlank, string> = {
  riskTitle: 'a risk title', riskDescription: 'a risk description', riskOwner: 'a risk owner',
  controlTitle: 'a control title', controlActivity: 'a control description', owner: 'a control owner',
  nature: 'a nature', type: 'a type', assertions: 'assertions', designChecks: 'design checks', attributes: 'attributes',
  objective: 'an objective', subProcess: 'a sub-process', riskCategory: 'a risk category', riskRating: 'a risk rating', likelihood: 'a likelihood',
  processOwner: 'a process owner', controlEvidence: 'control evidence', sopSectionRef: 'an SOP section',
  effectiveDate: 'an effective date', country: 'a country', testingStrategy: 'a testing strategy',
};
/** The order a row's blanks are asked for, and said in the Review summary. */
export const CORE_BLANK_ORDER: CoreBlank[] = [
  'riskTitle', 'riskDescription', 'riskOwner', 'riskCategory', 'riskRating', 'likelihood',
  'controlTitle', 'controlActivity', 'objective', 'subProcess', 'owner', 'processOwner',
  'nature', 'type', 'assertions', 'designChecks', 'attributes', 'controlEvidence',
  'testingStrategy', 'effectiveDate', 'country', 'sopSectionRef',
];
/** THE 22 SEP LIST — every imported control ends up with each of these, whatever
 *  the first file carried or the Config tab says. Risk and Control ID are on it
 *  and always met: a blank one is built at import. */
export const ALWAYS_REQUIRED: RacmFieldKey[] = [
  'riskId', 'controlId', 'riskTitle', 'riskDescription', 'riskCategory', 'controlTitle', 'controlActivity',
  'nature', 'type', 'frequency', 'owner', 'riskOwner', 'designChecks', 'attributes', 'assertions',
  // Added 24 Sep — the client's own list of what a matrix cannot arrive without.
  // `sopSectionRef` is NOT here: it is required "in case of SOP" only, and an
  // .xlsx has no section to quote, so it is switched on per row below.
  'objective', 'subProcess', 'riskRating', 'likelihood', 'isKey', 'entity', 'processOwner',
];
export const isAlwaysRequired = (field: RacmFieldKey): boolean => ALWAYS_REQUIRED.includes(field);
export function coreBlanks(row: ImportRow, core: RacmFieldKey[] = DEFAULT_CORE_FIELDS): CoreBlank[] {
  const val = (k: RacmFieldKey) => (row.values[k] ?? '').trim();
  // "SOP section reference in case of SOP" (24 Sep) — an uploaded workbook has
  // no section to quote, so this one is required of SOP-drafted rows only.
  const on = (k: RacmFieldKey) => isAlwaysRequired(k) || core.includes(k)
    || (k === 'sopSectionRef' && row.origin === 'sop');
  const blank: Record<CoreBlank, boolean> = {
    riskTitle: !val('riskTitle'),
    riskDescription: !val('riskDescription'),
    riskOwner: !val('riskOwner'),
    controlTitle: !val('controlTitle'),
    controlActivity: !val('controlActivity'),
    owner: !val('owner'),
    nature: row.nature === null,
    type: row.type === null,
    assertions: row.assertions.length === 0,
    designChecks: row.designChecks.length === 0,
    attributes: row.attributes.length === 0,
    objective: !val('objective'),
    subProcess: !val('subProcess'),
    // A word we don't recognise counts as blank: better to ask at Review than
    // to file an "Environmental" risk under Financial without saying so.
    riskCategory: !riskCategoryOf(val('riskCategory')),
    riskRating: !row.riskRating,
    likelihood: !row.likelihood,
    processOwner: !val('processOwner'),
    controlEvidence: !val('controlEvidence'),
    sopSectionRef: !val('sopSectionRef') && !row.sectionRef,
    effectiveDate: !val('effectiveDate'),
    country: !val('country'),
    testingStrategy: !row.testingStrategy,
  };
  // Entity and Key control are never blank in the sense a row is held for: the
  // company comes from Create RACM where the file is silent, and a tick box
  // always answers. They stay switchable on Config for what they mean, not as a
  // gate.
  return CORE_BLANK_ORDER.filter(b => on(b) && blank[b]);
}
/** The fields a row can't be imported without — the locked 22 Sep list. The
 *  Config tab can add to it, never take from it. Kept here so `racmImport`
 *  stays pure — the configured list is passed in. */
export const DEFAULT_CORE_FIELDS: RacmFieldKey[] = [...ALWAYS_REQUIRED];

/** Held back from import: a required value missing, or no frequency. Frequency
 *  is always required (22 Sep), so a row without one never reaches a control. */
export const rowBlocked = (row: ImportRow, core: RacmFieldKey[] = DEFAULT_CORE_FIELDS, extras: ExtraColumn[] = []) =>
  row.frequency === null || coreBlanks(row, core).length > 0 || extraBlanks(row, extras).length > 0;

/** A9: values for this row's empty fields, read off its other columns. Never
 *  proposes a value for a field that already has one, and never for isKey. */
/**
 * Required fields Ira can fill from the row's other columns when the file has
 * no column for them at all.
 *
 * Read it as the answer to "does the import have to stop here?". A RACM that
 * never wrote a Frequency column is an ordinary RACM — the activity says
 * "monthly" and `proposeBlankFills` reads it. One with no control description
 * is not a RACM at all: there is nothing to derive a control FROM, and a
 * suggestion built on nothing would be the import inventing controls.
 *
 * Kept beside `proposeBlankFills` on purpose. The two are one statement about
 * the same thing, and in two files they would drift the first time a field
 * was added to either.
 */
export const IRA_FILLS: RacmFieldKey[] = ['frequency', 'riskDescription', 'riskTitle', 'riskCategory', 'controlTitle', 'controlActivity', 'nature', 'type', 'owner', 'testingStrategy', 'riskRating', 'assertions', 'designChecks'];
/** Required fields Ira SUGGESTS at Review but does not write herself (22 Sep:
 *  attributes stay suggestions to accept) — a file without the column is not
 *  stopped, the reviewer takes her suggestions or types their own. */
export const IRA_SUGGESTS: RacmFieldKey[] = ['attributes'];

export const iraCanFill = (field: RacmFieldKey): boolean => IRA_FILLS.includes(field);

export function proposeBlankFills(row: ImportRow): BlankFill[] {
  const val = (k: RacmFieldKey) => (row.values[k] ?? '').trim();
  const blank = (k: RacmFieldKey) => !val(k);
  const activity = val('controlActivity');
  const title = val('controlTitle');
  const objective = val('objective');
  const risk = val('riskDescription');
  const fills: BlankFill[] = [];

  // Frequency — the earliest timing words in the activity, then the title.
  if (blank('frequency')) {
    for (const [label, text] of [['Activity', activity], ['Title', title]] as const) {
      if (!text) continue;
      let hit: { index: number; f: Frequency } | null = null;
      for (const [re, f] of FREQUENCY_TEXT) {
        const m = re.exec(text);
        if (m && (!hit || m.index < hit.index)) hit = { index: m.index, f };
      }
      if (hit) {
        fills.push({ field: 'frequency', value: hit.f, reason: `${label} says '${phraseAt(text, hit.index)}'` });
        break;
      }
    }
  }

  // Nature — who or what does the work.
  if (blank('nature') && (activity || title)) {
    const text = activity || title;
    const source = activity ? 'Activity' : 'Title';
    const auto = /\bautomatically\b|\bconfigured\b|\bsystem blocks\b/i.exec(text);
    const it = /\b(?:SAP|ERP|systems?|reports?)\b/i.exec(text);
    const manual = /\bmanually\b|\breviews?\b|\bapproves?\b|\bsigns?\b|\bchecks?\b/i.exec(text);
    if (auto) fills.push({ field: 'nature', value: 'Automated', reason: `${source} says '${phraseAt(text, auto.index)}'` });
    else if (it) fills.push({ field: 'nature', value: 'IT-dependent', reason: `${source} mentions '${it[0]}' — a person working off system output` });
    else if (manual) fills.push({ field: 'nature', value: 'Manual', reason: `${source} says '${phraseAt(text, manual.index)}' — a person does the work` });
    // Nothing in the text says either way: no proposal (17 Sep — no bare defaults).
  }

  // Type — does it stop the error, or find it afterwards?
  if (blank('type') && (activity || title || objective)) {
    const text = [activity, title, objective].filter(Boolean).join(' ');
    const m = /\breview\w*|\breconcil\w*|\bmonitor\w*|\binvestigat\w*/i.exec(text);
    const stop = /\bapprov\w*|\bauthori[sz]\w*|\bblocks?\b|\bprevents?\b|\bbefore\b/i.exec(text);
    if (m) fills.push({ field: 'type', value: 'Detective', reason: `Says '${phraseAt(text, m.index)}' — it finds errors after the fact` });
    else if (stop) fills.push({ field: 'type', value: 'Preventive', reason: `Says '${phraseAt(text, stop.index)}' — it stops the error up front` });
  }

  // Owner — the (WHO) of the activity.
  if (blank('owner') && activity) {
    const m = /^([\s\S]*?)\(\s*who\s*\)/i.exec(activity);
    if (m) {
      const who = (m[1].split(/[.;:,]/).pop() ?? '').trim().replace(/^the\s+/i, '').trim();
      if (who) fills.push({ field: 'owner', value: who, reason: `Activity names '${who}' as the WHO` });
    }
  }

  // Risk description — the risk title written out (22 Sep), else what goes
  // wrong if the control's aim isn't met.
  if (blank('riskDescription')) {
    const fromTitle = draftRiskDescription(val('riskTitle'));
    if (fromTitle) {
      fills.push({ field: 'riskDescription', value: fromTitle, reason: 'The risk title, written out as what could go wrong' });
    } else {
      const source = objective ? ['objective', objective] as const : title ? ['title', title] as const : activity ? ['activity', activity] as const : null;
      const text = source ? riskFromText(source[1]) : '';
      if (source && text) fills.push({ field: 'riskDescription', value: text, reason: `The control ${source[0]}, turned round into what could go wrong` });
    }
  }

  // Risk title — the description, shortened. Only where the file had no title
  // column of its own; a file that names its risks is taken at its word.
  if (blank('riskTitle')) {
    const from = risk || (blank('riskDescription') ? fills.find(f => f.field === 'riskDescription')?.value ?? '' : '');
    const short = titleFromRisk(from);
    if (short && short.length < from.length) fills.push({ field: 'riskTitle', value: short, reason: 'The risk description, shortened to its opening clause' });
  }

  // Testing strategy — an annual control operated once, so one occurrence is the
  // whole population. Everything else is sampled unless someone says otherwise.
  if (blank('testingStrategy')) {
    const freq = row.frequency ?? parseFrequency(val('frequency')).frequency ?? fills.find(f => f.field === 'frequency')?.value;
    if (freq === 'Annual') fills.push({ field: 'testingStrategy', value: 'Test of one', reason: 'An annual control operates once, so there is nothing to sample' });
    else if (freq) fills.push({ field: 'testingStrategy', value: 'Sampling', reason: `A ${String(freq).toLowerCase()} control is tested on a sample` });
  }

  // Control title — the objective as a statement, else the activity's first clause.
  if (blank('controlTitle')) {
    const fromObjective = objective ? firstClause(objective.replace(/^\s*to\s+ensure\s+(?:that\s+)?/i, '')) : '';
    if (fromObjective.length >= 3) {
      fills.push({ field: 'controlTitle', value: sentenceCase(fromObjective), reason: 'The control objective, written as a statement' });
    } else if (activity) {
      const clause = firstClause(activity);
      if (clause.length >= 3) fills.push({ field: 'controlTitle', value: sentenceCase(clause), reason: 'The first clause of the control activity' });
    }
  }

  // Control description — the title written out as what is done (22 Sep), with
  // the owner and frequency the row already names. Only where the file had no
  // description of its own.
  if (blank('controlActivity')) {
    const from = title || fills.find(f => f.field === 'controlTitle')?.value || '';
    const owner = val('owner') || fills.find(f => f.field === 'owner')?.value || '';
    const frequency = row.frequency ?? fills.find(f => f.field === 'frequency')?.value;
    const text = draftControlDescription(from, { owner, frequency: frequency as Frequency | undefined });
    if (text) {
      fills.push({
        field: 'controlActivity',
        value: text,
        reason: `The control title, written out as what is done${owner || frequency ? ` — with the ${[owner && 'owner', frequency && 'frequency'].filter(Boolean).join(' and ')} the row names` : ''}`,
      });
    }
  }

  // Risk category — the risk's own words, then the control's. Runs against the
  // filled risk description too, so a file with neither column still lands on a
  // category rather than holding every row.
  if (!riskCategoryOf(val('riskCategory'))) {
    const riskText = [val('riskTitle'), risk || fills.find(f => f.field === 'riskDescription')?.value || ''].filter(Boolean).join(' ');
    const { category, word } = draftRiskCategory(riskText, [title, objective, activity].filter(Boolean).join(' '));
    fills.push({
      field: 'riskCategory',
      value: category,
      reason: word
        ? `Risk mentions '${word}'`
        : 'Nothing names another category, and an ICFR matrix’s default risk is to the financial statements',
    });
  }

  // Risk rating — only a starting point; the rating is agreed with management.
  if (blank('riskRating') && risk) {
    const m = /\bfraud\w*|\bmaterial\w*|\bmisstat\w*/i.exec(risk);
    if (m) fills.push({ field: 'riskRating', value: 'High', reason: `Risk mentions '${m[0].toLowerCase()}'` });
  }

  // Assertions — what the risk says could go wrong.
  if (blank('assertions') && risk) {
    const words: string[] = [];
    const found = new Set<Assertion>();
    for (const [re, a] of ASSERTION_RISK_WORDS) {
      const m = re.exec(risk);
      if (m) { found.add(a); words.push(`'${m[0].toLowerCase()}'`); }
    }
    if (found.size) {
      fills.push({
        field: 'assertions',
        value: ASSERTION_ORDER.filter(a => found.has(a)).join(', '),
        reason: `Risk mentions ${words.join(', ')}`,
      });
    }
  }

  return fills;
}

/** Apply accepted fills to a row — only into fields that are still blank — and
 *  re-derive it against the rows that come before it. */
export function applyFills(row: ImportRow, fills: BlankFill[], existing: Control[], process: string, earlier: ImportRow[] = [], entity = ''): ImportRow {
  const values = { ...row.values };
  for (const f of fills) {
    if (f.field === 'isKey' || (values[f.field] ?? '').trim()) continue;
    values[f.field] = f.value;
  }
  return rowFromValues(values, row, existing, process, earlier, entity);
}

/** Write a value into one of the client's own columns and re-derive the row.
 *  Review's counterpart to `applyFills`, kept separate because an extra has no
 *  field key to write into `values`. */
export function setRowExtra(row: ImportRow, header: string, value: string, existing: Control[], process: string, earlier: ImportRow[] = [], entity = ''): ImportRow {
  // Written back over the spelling the FILE used where the row already has one,
  // so filling a blank can't leave the same column on the control twice under
  // two spellings. Only a column the file never wrote takes the set-up's.
  const want = normaliseHeader(header);
  const key = Object.keys(row.extras).find(h => normaliseHeader(h) === want) ?? header;
  return rowFromValues(row.values, { ...row, extras: { ...row.extras, [key]: value } }, existing, process, earlier, entity);
}

// ── A7 suggestions ───────────────────────────────────────────────────────────────

/** The attributes a control is usually tested on, by type — only where the
 *  control's own wording names nothing Ira recognises. */
const TYPE_ATTRIBUTES: Record<ControlType, string[]> = {
  Preventive: ['Approval is evidenced before the transaction is processed', 'Approver is independent of the preparer'],
  Detective: ['Review is performed within the required timeframe', 'Exceptions are investigated and resolved'],
};

/** What a control's wording says it does, and the attributes that test it. */
const ATTRIBUTE_RULES: { re: RegExp; attributes: string[] }[] = [
  { re: /\bapprov\w*|\bauthori[sz]\w*|\bsign(?:s|ed)? off\b/i, attributes: ['Approval is evidenced before the item is processed', 'The approver is independent of the preparer', 'The approver holds the authority for the amount approved'] },
  { re: /\breconcil\w*/i, attributes: ['The reconciliation agrees to the source balances', 'Reconciling differences are investigated and cleared', 'The reconciliation is reviewed and signed off'] },
  { re: /\b(?:three|3)[- ]way\b|\bmatch\w*/i, attributes: ['The documents agree before the item is paid or posted', 'Mismatches beyond tolerance are held for resolution'] },
  { re: /\breview\w*|\bmonitor\w*|\banaly[sz]\w*|\binspect\w*/i, attributes: ['The review is evidenced with a sign-off and date', 'Exceptions found in the review are followed up to resolution'] },
  { re: /\baccess\b|\buser\w*|\bpassword\w*|\brole\w*/i, attributes: ['Access is granted only on an approved request', 'Access held matches the user\'s role'] },
  { re: /\bautomatic\w*|\bsystem\w*|\bconfigur\w*|\bblock\w*/i, attributes: ['The system rule operates as configured', 'Changes to the configuration are authorised and tested'] },
  { re: /\bsegregat\w*/i, attributes: ['Duties are segregated as described'] },
  { re: /\bthreshold\w*|\blimit\w*|\btoleran\w*/i, attributes: ['The threshold applied matches the approved limit'] },
];

/**
 * Ira's attributes for a control, read off its title and description (22 Sep:
 * "attributes are derived from the control description"). One rule for the
 * upload's Review and the New control form. Falls back to the usual attributes
 * for the control's type only when the wording names nothing she recognises;
 * with neither, she offers nothing rather than guessing.
 */
export function draftAttributes(text: string, type: ControlType | null = null): string[] {
  const out: string[] = [];
  for (const rule of ATTRIBUTE_RULES) {
    if (!rule.re.test(text)) continue;
    rule.attributes.forEach(a => { if (!alreadySaid(out, a)) out.push(a); });
    if (out.length >= 4) break;
  }
  if (out.length === 0 && type) return [...TYPE_ATTRIBUTES[type]];
  return out.slice(0, 4);
}

const FREQUENCY_PHRASE: Record<Frequency, string> = {
  Annual: 'once a year', Quarterly: 'every quarter', Monthly: 'every month', Weekly: 'every week',
  Daily: 'every day', Recurring: 'on every transaction', 'Ad-hoc': 'whenever it is needed',
};

/**
 * Ira's control description, written from the control title (22 Sep). It says
 * what is done, by whom and how often — using only the owner and frequency the
 * row or form already names, never an invented person. '' when the title is too
 * short to write from.
 */
export function draftControlDescription(title: string, ctx: { owner?: string; frequency?: Frequency | null } = {}): string {
  const t = stripMarkers(title).replace(/[.;:\s]+$/, '').trim();
  if (t.length < 3) return '';
  // A role reads with "The" ("The AP Manager reviews…"); a person's name
  // doesn't ("S. Iyer reviews…").
  const owner = (ctx.owner ?? '').trim().replace(/^the\s+/i, '');
  const isRole = /\b(?:manager|controller|head|officer|lead|team|director|clerk|analyst|accountant|cfo|ceo|coo|cfo|treasurer|executive|supervisor|department|desk|committee|board|admin\w*|owner)\b/i.test(owner);
  const who = !owner ? 'An authorised person' : isRole ? `The ${owner}` : owner;
  const when = ctx.frequency ? ` ${FREQUENCY_PHRASE[ctx.frequency]}` : '';
  const lead = sentenceCase(t);
  if (/\bautomatic\w*|\bsystem\b|\bconfigur\w*|\bblock\w*/i.test(t)) {
    return `${lead}. The system enforces this${when}; any change to the rule is authorised before it takes effect.`;
  }
  if (/\breconcil\w*/i.test(t)) {
    return `${lead}. ${who} prepares the reconciliation${when}, investigates any difference and records how it was cleared.`;
  }
  if (/\bapprov\w*|\bauthori[sz]\w*/i.test(t)) {
    return `${lead}. ${who} reviews each item and approves it before it is processed${when ? `,${when}` : ''}; the approval is recorded.`;
  }
  if (/\b(?:three|3)[- ]way\b|\bmatch\w*/i.test(t)) {
    return `${lead}. The documents are matched before the item is paid or posted${when ? `,${when}` : ''}; a mismatch is held until it is resolved.`;
  }
  if (/\breview\w*|\bmonitor\w*|\banaly[sz]\w*/i.test(t)) {
    return `${lead}. ${who} performs the review${when}, follows up every exception and signs the review off.`;
  }
  return `${lead}. ${who} performs this control${when} and keeps evidence that it was done.`;
}

/**
 * Ira's risk description, written from the risk title (22 Sep). The title is
 * kept word for word — its negative included — and said as a risk. '' when
 * there is no title.
 */
export function draftRiskDescription(riskTitle: string): string {
  const t = stripMarkers(riskTitle).replace(/[.;:\s]+$/, '').trim();
  if (t.length < 3) return '';
  const lower = /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
  const clause = /\b(?:is|are|was|were|may|can|could|might|do|does|get|gets|go|goes|has|have)\b/i.test(t);
  return `Risk ${clause ? 'that' : 'of'} ${lower}, and that it is not prevented or detected in time.`;
}

/** A7: attributes and design checks Ira would add to this row — only ones the
 *  row doesn't already have. */
export function suggestForRow(row: ImportRow, process: string): { attributes: string[]; designChecks: string[] } {
  const control = controlFromRow(row, process, 1, row.frequency ?? 'Recurring');
  const have = new Set(row.designChecks.map(sameText));
  const designChecks = suggestedDesignChecks(control).filter(t => !have.has(sameText(t)));
  const present = row.attributes.map(a => a.text);
  // Attributes are read off the control's own wording (22 Sep).
  const wording = [row.values.controlTitle, row.values.controlActivity].filter(Boolean).join('. ');
  const attributes = row.attributes.length < 2
    ? draftAttributes(wording, row.type).filter(t => !alreadySaid(present, t))
    : [];
  return { attributes, designChecks };
}

// ── Rows → controls ──────────────────────────────────────────────────────────────

const SMALL_WORDS = new Set(['to', 'and', 'of', 'the', 'for', 'in', 'on', 'a', 'an']);

/** "Procure to Pay" → "PP", "Order to Cash" → "OC", "Treasury" → "TR". */
function processInitials(process: string): string {
  const words = process.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const significant = words.filter(w => !SMALL_WORDS.has(w.toLowerCase()));
  const use = significant.length ? significant : words;
  if (!use.length) return 'C';
  if (use.length === 1) return use[0].slice(0, 2).toUpperCase();
  return use.map(w => w[0].toUpperCase()).join('').slice(0, 3);
}

/** What a file's own category word means in our six (22 Sep). Read top-down —
 *  the narrower readings come first, because a file that writes "IT general
 *  control" also contains the word "control", and one that writes "financial
 *  reporting fraud" is a fraud risk before it is a financial one.
 *
 *  Two mappings are the user's calls, not inference: "financial reporting"
 *  reads as **Financial** (one category, not two), and "strategic" reads as
 *  **Operational** (there is no strategic category to put it in). */
const CATEGORY_TEXT: [RegExp, ControlClass][] = [
  [/\bfraud\w*|\btheft\b|\bmisappropriat\w*|\bcorrupt\w*|\bbrib\w*|\bcollusion\b|\bdivert\w*|\bfictitious\b|\bforg(?:ed|ery)\b|\bfalsif\w*/i, 'Fraud'],
  [/\bitgc\b|\bit\s*general\b|\bgeneral\s*it\b|\bit\s*(?:application|dependent|system|access)\b|\binformation\s*technology\b|\bcyber\w*|\bchange\s*management\b/i, 'IT general control'],
  [/\breputation\w*|\bbrand\b|\bpublic\s*(?:perception|confidence|trust)\b|\bmedia\b/i, 'Reputational'],
  [/\bcomplian\w*|\bregulat\w*|\blegal\b|\bstatutor\w*|\blicen[cs]\w*/i, 'Compliance'],
  [/\boperation\w*|\bstrateg\w*|\bprocess\b|\bbusiness\b|\bsupply\b|\bhealth\b|\bsafety\b/i, 'Operational'],
  [/\bfinancial\w*|\breport\w*|\baccount\w*|\bmisstat\w*|\bledger\b|\bdisclos\w*/i, 'Financial'],
];

/** The category a file's word maps to, or null where it says nothing. Null
 *  only reaches a control through a path that imports a blank row — the
 *  import itself holds one back (`coreBlanks`), because the category is on the
 *  22 Sep required list. */
export function riskCategoryOf(category: string): ControlClass | null {
  const text = category.trim();
  if (!text) return null;
  const exact = CONTROL_CLASSES.find(c => c.toLowerCase() === text.toLowerCase());
  if (exact) return exact;
  for (const [re, c] of CATEGORY_TEXT) if (re.test(text)) return c;
  return null;
}

function clazzOf(category: string): ControlClass {
  return riskCategoryOf(category) ?? 'Financial';
}

/** Placeholder keys for rows the file gave no ID — digit-free, so the ID
 *  builder numbers them by row order instead of reading a number out of them. */
const noDigits = (s: string) => s.replace(/\d/g, d => 'abcdefghij'[Number(d)]!);

/** One row as an engagement control. `n` is the row's 1-based place in the import.
 *  Nature and type are read as given — callers that import make sure both are
 *  set (rowBlocked); suggestions read the row before they are. */
function controlFromRow(row: ImportRow, process: string, n: number, frequency: Frequency, wpPrefix = processInitials(process)): Control {
  const val = (k: RacmFieldKey) => (row.values[k] ?? '').trim();
  const id = val('controlId') || `~row-${noDigits(row.key)}`;
  const wpRef = `${wpPrefix}-${String(n).padStart(2, '0')}`;
  const activity = val('controlActivity');
  const objective = val('objective');
  const description = val('controlTitle') || (activity ? firstSentence(activity) : '') || objective;
  // No assertion in the file stays no assertion (17 Sep — no silent "Accuracy").
  const assertions: Assertion[] = row.assertions;

  const steps: OperatingStep[] = row.attributes.map((a, k) => {
    const stepId = nid('st');
    // the attribute's own assertion when its wording names one the control carries
    const named = parseAssertions(a.text).find(x => assertions.includes(x));
    const step: OperatingStep = {
      id: stepId,
      code: `${wpRef}.${k + 1}`,
      description: a.text,
      assertion: named ?? assertions[0],
      precision: 'Per item',
      procedures: ['Inspection'],
      result: 'Not tested',
    };
    // No evidence named: leave requiredFiles unset so the control page reads them
    // off the attribute's wording instead of showing an empty checklist.
    if (a.requiredFiles.length) step.requiredFiles = a.requiredFiles.map((label, j) => ({ id: `${stepId}-rf${j + 1}`, label }));
    return step;
  });

  const points: DesignPoint[] = mergeChecks(row.designChecks).checks.map(text => ({
    id: nid('dp'), text, result: 'Not tested', workflowId: nid('wf-tod'), workflowName: 'Design walkthrough check',
  }));

  const control: Control = {
    id,
    wpRef,
    description,
    process,
    subProcess: val('subProcess'),
    nature: row.nature as Nature,
    type: row.type as ControlType,
    frequency,
    isKey: row.isKey,
    clazz: clazzOf(val('riskCategory')),
    precision: description,
    owner: val('owner'),
    // Rows with no Risk ID and the same risk description are one risk.
    riskId: val('riskId') || `~risk-${noDigits(sameText(val('riskDescription')) || row.key)}`,
    riskDescription: val('riskDescription'),
    assertions,
    design: {
      documents: [
        { id: nid('dd'), kind: 'Process narrative', name: 'Process narrative — to provide', status: 'Missing' },
        { id: nid('dd'), kind: 'Control description', name: 'Control description — to provide', status: 'Missing' },
      ],
      points,
      conclusion: 'Not tested',
      testedBy: null,
      testedAt: null,
    },
    operating: { method: 'Manual', steps, conclusion: 'Not tested', testedBy: null, testedAt: null },
  };
  if (objective) control.objective = objective;
  if (activity) control.controlActivity = activity;
  const processOwner = val('processOwner');
  if (processOwner) control.processOwner = processOwner;
  const riskOwner = val('riskOwner');
  if (riskOwner) control.riskOwner = riskOwner;
  if (row.riskRating) control.riskRating = row.riskRating;
  if (row.likelihood) control.likelihood = row.likelihood;
  // The risk's short name, where the file carried one. A blank is filled by
  // proposeBlankFills before import, so this is the file's wording or Ira's.
  const riskTitle = val('riskTitle');
  if (riskTitle) control.riskTitle = riskTitle;
  // 17 Sep fields. Entity is read here rather than patched on afterwards, so a
  // file's Entity column reaches the control the same way every other cell does.
  const entity = val('entity');
  if (entity) control.entity = entity;
  const effectiveDate = val('effectiveDate');
  if (effectiveDate) control.effectiveDate = effectiveDate;
  // Stored only when the file named one — otherwise the row takes its entity's
  // country and the two can never drift apart (see `countryFor`).
  const country = val('country');
  if (country) control.country = country;
  const sopSectionRef = val('sopSectionRef');
  if (sopSectionRef) control.sopSectionRef = sopSectionRef;
  if (row.testingStrategy) control.testingStrategy = row.testingStrategy;
  if (Object.keys(row.extras).length) control.extras = { ...row.extras };
  return control;
}

/** Turn reviewed rows into engagement controls for createRacm. Every row must
 *  have a frequency by now. Attributes become operating steps with their
 *  `requiredFiles`; design checks become design points (merged, not doubled). */
export function importRowsToControls(rows: ImportRow[], process: string, core: RacmFieldKey[] = DEFAULT_CORE_FIELDS, extras: ExtraColumn[] = []): Control[] {
  const missing = rows.filter(r => rowBlocked(r, core, extras));
  if (missing.length) {
    const ids = missing.map(r => (r.values.controlId ?? '').trim() || `row ${r.rowNo}`);
    throw new Error(`Fill the blanks before importing — ${missing.length === 1 ? `${ids[0]} has` : `${ids.join(', ')} have`} some.`);
  }
  const prefix = processInitials(process);
  return rows.map((row, i) => controlFromRow(row, process, i + 1, row.frequency as Frequency, prefix));
}

// ─── SOP extraction (A6) ─────────────────────────────────────────────────────────

/** The instruction Ira extracts a RACM from an SOP with. Shown in full and
 *  editable before extraction; nothing is extracted until it is validated. */
export const DEFAULT_SOP_PROMPT = `You are extracting a SOX / ICFR risk and control matrix (RACM) from the attached standard operating procedure.

1. Read the whole SOP. Work only from what it says; do not invent controls it does not describe.
2. For every risk the SOP addresses, record: Risk ID, risk description, risk owner, risk rating, and risk category — one of Financial, Operational, Compliance, Fraud, IT general control or Reputational.
3. For every control that mitigates a risk, record: Control ID, control title, control objective, control activity (who does what, where, when, how and why), control type (Preventive / Detective), control nature (Manual / Automated / IT-dependent), frequency (Annual, Quarterly, Monthly, Weekly, Daily, Recurring or Ad-hoc — never "Continuous"), key control (Yes / No), control owner and process owner.
4. Keep the SOP's own risk and control IDs exactly as written. Only create an ID when the SOP has none, and say so.
5. For each control, list its test attributes one per line, and the control evidence each attribute needs.
6. Cite the SOP section every row came from (for example "§ 4.2").
7. Where the SOP is silent but a control is clearly expected for the risk, add it separately and mark it "Suggested", so a reviewer can accept or reject it.`;

/**
 * WHAT THE PROMPT ACTUALLY DOES (25 Sep).
 *
 * Until now `draftRowsFromSop` opened with `void prompt` — the draft read the
 * same whatever you typed. That was honest while the prompt was scenery, but
 * the prompt is now the one place a reviewer shapes the extraction: edit it,
 * re-extract, and the rows AND the flowchart follow. A box that invites an
 * instruction and then ignores it is worse than no box.
 *
 * There is no model behind this and no document to read, so the prompt is read
 * against a vocabulary that is small, exact and stated on screen. Two kinds of
 * instruction count:
 *
 *   WHAT IS STILL ASKED FOR — the default prompt's own numbered points. Delete
 *   point 7 and no "Suggested" rows are drafted; delete point 6 and no § refs
 *   are cited; delete point 5 and no attributes or evidence come across. The
 *   prompt already said these things, so honouring their absence costs the
 *   reader nothing to learn.
 *
 *   WHAT IS NARROWED — "only key controls", "preventive only", "manual only",
 *   "at most 6 controls". Each needs a narrowing word (only / just / at most /
 *   exclude / skip), never a bare mention: the default prompt lists
 *   "(Preventive / Detective)" as the field's values, and a rule that read that
 *   as a filter would empty the draft the first time anybody pressed Continue.
 *
 * Anything else is left alone and `read` stays quiet about it, so Review can
 * say what was honoured rather than implying everything was.
 */
export interface PromptRules {
  /** Point 7 still asked for: draft the controls the SOP implies but omits. */
  suggestExtras: boolean;
  /** Point 6 still asked for: cite "§ 4.2" against every row. */
  citeSections: boolean;
  /** Point 5 still asked for: test attributes and the evidence each needs. */
  listAttributes: boolean;
  /** Key controls alone. */
  keyOnly: boolean;
  /** Empty means every type / nature. */
  types: ControlType[];
  natures: Nature[];
  /** A cap on how many controls are drafted. */
  limit: number | null;
  /** What was honoured, in the reader's words — for Review to print back. */
  read: string[];
  /** The prompt was edited but nothing in it could be read. */
  editedButUnread: boolean;
}

/** `only|just|exclusively <term>` or `<term> only` — a narrowing, not a mention. */
const narrowedTo = (p: string, term: string): boolean =>
  new RegExp(`\\b(?:only|just|exclusively)\\b[^.\n]{0,24}\\b${term}\\b`, 'i').test(p)
  || new RegExp(`\\b${term}\\b[^.\n]{0,16}\\b(?:only|alone)\\b`, 'i').test(p);

/** `exclude|skip|without|omit|no|don't <term>` — the other direction. */
const ruledOut = (p: string, term: string): boolean =>
  new RegExp(`\\b(?:exclude|excluding|skip|without|omit|no|not|don'?t|do not|never)\\b[^.\n]{0,24}\\b${term}\\b`, 'i').test(p);

/** Still asked for: mentioned, and not mentioned in order to refuse it. */
const stillAsked = (p: string, term: string): boolean =>
  new RegExp(`\\b${term}`, 'i').test(p) && !ruledOut(p, term);

export function readPromptRules(prompt: string): PromptRules {
  const p = String(prompt ?? '');
  const read: string[] = [];

  const suggestExtras = stillAsked(p, 'suggest');
  if (!suggestExtras) read.push('no suggested controls');
  const citeSections = stillAsked(p, 'section');
  if (!citeSections) read.push('no SOP section refs');
  const listAttributes = stillAsked(p, 'attribute');
  if (!listAttributes) read.push('no test attributes');

  const keyOnly = narrowedTo(p, 'key');
  if (keyOnly) read.push('key controls only');

  const types = CONTROL_TYPES.filter(t => narrowedTo(p, t) || (ruledOut(p, other(t)) && !narrowedTo(p, other(t))));
  if (types.length === 1) read.push(`${types[0]!.toLowerCase()} controls only`);

  const natures = NATURES.filter(n => narrowedTo(p, n.replace('-', '.?')));
  if (natures.length && natures.length < NATURES.length) read.push(`${natures.map(n => n.toLowerCase()).join(' and ')} controls only`);

  // "6 controls", "at most 6 controls", "no more than 6 controls". A bare digit
  // never counts — the prompt's own points are numbered.
  const cap = /\b(?:at most|no more than|up to|draft|give me|extract)?\s*(\d{1,2})\s+controls?\b/i.exec(p);
  const limit = cap ? Number(cap[1]) : null;
  if (limit) read.push(`at most ${limit} controls`);

  return {
    suggestExtras, citeSections, listAttributes, keyOnly,
    types: types.length === 1 ? types : [],
    natures: natures.length && natures.length < NATURES.length ? natures : [],
    limit,
    read,
    editedButUnread: p.trim() !== DEFAULT_SOP_PROMPT.trim() && read.length === 0,
  };
}

const CONTROL_TYPES: ControlType[] = ['Preventive', 'Detective'];
const NATURES: Nature[] = ['Manual', 'Automated', 'IT-dependent'];
const other = (t: ControlType): ControlType => (t === 'Preventive' ? 'Detective' : 'Preventive');

/** Draft review rows for `process` from its template once the prompt is
 *  validated: most rows `origin: 'sop'` with a section ref, roughly one in four
 *  `origin: 'suggested'`. Deterministic for the same process + file name. */
/**
 * `entity` is not optional in practice (24 Sep). Without it every drafted row
 * was compared against every control of the same process in the WHOLE library,
 * because `sameMatrix` reads a blank company on either side as a match — so
 * re-extracting a process that already had a RACM flagged the entire draft as
 * repeats, and `resetReview` then left every one of them out. The reviewer met
 * a screen of grey rows and a button reading "Import 0 controls", with nothing
 * on it saying why.
 */
export function draftRowsFromSop(process: string, fileName: string, prompt: string, existing: Control[], entity = ''): ImportRow[] {
  const rules = readPromptRules(prompt);
  // What the prompt narrowed the draft to. Filtering BEFORE the walk rather
  // than after it keeps the row numbers and the § refs consecutive: a draft
  // that reads 1, 2, 5 says a row was lost, when in truth it was never asked
  // for.
  const template = racmTemplateForProcesses([process], 'fresh').filter(c =>
    (!rules.keyOnly || c.isKey)
    && (!rules.types.length || rules.types.includes(c.type))
    && (!rules.natures.length || rules.natures.includes(c.nature)))
    .slice(0, rules.limit ?? undefined);
  const seed = hashString(`${process}|${fileName}`);
  const offset = seed % 4;
  const firstSection = 2 + ((seed >>> 3) % 3);
  const subProcesses = Array.from(new Set(template.map(c => c.subProcess)));
  const perSection = new Map<string, number>();
  const out: ImportRow[] = [];

  template.forEach((c, i) => {
    // Point 7 of the prompt is what asks for these. Take it out and Ira stops
    // offering controls the SOP never described.
    const suggested = rules.suggestExtras && (i + offset) % 4 === 3;
    let sectionRef: string | undefined;
    if (!suggested && rules.citeSections) {
      const minor = (perSection.get(c.subProcess) ?? 0) + 1;
      perSection.set(c.subProcess, minor);
      sectionRef = `§ ${firstSection + subProcesses.indexOf(c.subProcess)}.${minor}`;
    }
    const steps = c.operating.steps;
    // Two rows in three are the SOP's own account; the rest read verbatim, so
    // the duplicate band still has something true to catch.
    const saysMore = !suggested && (i + offset) % 3 !== 0;
    const evidence = Array.from(new Set(steps.flatMap(s => requiredFilesOf(s, c).map(f => f.label))));
    const values: Partial<Record<RacmFieldKey, string>> = {
      riskId: c.riskId,
      riskDescription: c.riskDescription,
      riskCategory: c.clazz ?? '',
      riskRating: c.riskRating ?? '',
      likelihood: c.likelihood ?? '',
      controlId: c.code ?? c.id,
      controlTitle: c.description.replace(/\.$/, ''),
      objective: c.objective ?? '',
      controlActivity: c.controlActivity ?? '',
      subProcess: c.subProcess,
      type: c.type,
      nature: c.nature,
      frequency: c.frequency,
      isKey: c.isKey ? 'Yes' : 'No',
      owner: c.owner,
      processOwner: c.processOwner ?? '',
      assertions: c.assertions.join(', '),
      // WHAT THE SOP ITSELF SAYS, which is not word for word what the matrix
      // already holds (24 Sep). A procedure is written for the people who run
      // the control, so it spells out things a matrix row never captured — and
      // a control tested against different checks or different attributes IS a
      // different control, so these rows import rather than reading as repeats.
      // Every third row is left verbatim: those genuinely ARE already on file,
      // and catching them is the other half of the job.
      attributes: rules.listAttributes
        ? [...steps.map(s => s.description), ...(saysMore ? [`The ${c.subProcess.toLowerCase()} record names who performed it and when${sectionRef ? ` (${sectionRef})` : ''}`] : [])].join('\n')
        : '',
      controlEvidence: rules.listAttributes ? evidence.join('; ') : '',
      // control-level checks only — attribute-level ones belong to their attribute
      designChecks: [...c.design.points.filter(p => !p.stepId).map(p => p.text),
        ...(saysMore ? [`The procedure requires the ${c.nature === 'Automated' ? 'system to enforce this without an override' : 'reviewer to be someone other than the preparer'}${sectionRef ? ` (${sectionRef})` : ''}`] : [])].join('\n'),
      sopSectionRef: sectionRef ?? '',
    };
    out.push(rowFromValues(values, { key: `sop-${i + 1}`, rowNo: i + 1, origin: suggested ? 'suggested' : 'sop', sectionRef }, existing, process, out, entity));
  });
  return out;
}
