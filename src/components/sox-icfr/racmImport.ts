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
 *                                         duplicates against the engagement)
 *     ─ proposeBlankFills / applyFills  (A9: previewed, accepted, then applied)
 *     ─ suggestForRow                   (A7: Ira's missing attributes / design checks)
 *     ─ importRowsToControls ─▶ Control[] for createRacm
 *
 * An SOP has no rows to read in this prototype, so `draftRowsFromSop` drafts
 * them from the process template once the prompt has been validated, tagging
 * each as read from the SOP (with a section reference) or suggested by Ira.
 */
import * as XLSX from 'xlsx';
import { requiredFilesOf, suggestedDesignChecks } from './helpers';
import { racmTemplateForProcesses } from './mockData';
import type { Assertion, Control, ControlClass, ControlType, DesignPoint, Frequency, Nature, OperatingStep, RiskRating } from './types';

// ─── Fields ──────────────────────────────────────────────────────────────────────

export type RacmFieldKey =
  | 'riskId' | 'riskDescription' | 'riskCategory' | 'riskRating'
  | 'controlId' | 'controlTitle' | 'objective' | 'controlActivity'
  | 'subProcess' | 'type' | 'nature' | 'frequency' | 'isKey'
  | 'owner' | 'processOwner' | 'assertions' | 'attributes'
  | 'controlEvidence' | 'designChecks' | 'sopSectionRef';

export interface RacmField {
  key: RacmFieldKey;
  /** What the review screen calls the field. */
  label: string;
  /** Import can't go ahead until a required field has a column (or, for
   *  controlTitle / controlActivity, at least one of the two does). */
  required: boolean;
  /** Header spellings that mean this field, lower-case. */
  synonyms: string[];
}

export const RACM_FIELDS: RacmField[] = [
  { key: 'riskId', label: 'Risk ID', required: false, synonyms: ['risk id', 'risk ref', 'risk no', 'risk number', 'risk #'] },
  { key: 'riskDescription', label: 'Risk description', required: true, synonyms: ['risk description', 'risk', 'risk statement', 'what could go wrong'] },
  { key: 'riskCategory', label: 'Risk category', required: false, synonyms: ['risk category', 'risk type', 'category'] },
  { key: 'riskRating', label: 'Risk rating', required: false, synonyms: ['risk rating', 'inherent risk', 'risk level', 'rating'] },
  { key: 'controlId', label: 'Control ID', required: true, synonyms: ['control id', 'control ref', 'control no', 'control number', 'control #'] },
  { key: 'controlTitle', label: 'Control title', required: false, synonyms: ['control title', 'control name', 'control description', 'control'] },
  { key: 'objective', label: 'Control objective', required: false, synonyms: ['control objective', 'objective'] },
  { key: 'controlActivity', label: 'Control activity', required: true, synonyms: ['control activity', 'control procedure', 'activity', 'how the control operates'] },
  { key: 'subProcess', label: 'Sub-process', required: false, synonyms: ['sub-process', 'sub process', 'subprocess', 'process area'] },
  { key: 'type', label: 'Control type', required: false, synonyms: ['control type', 'type', 'preventive / detective'] },
  { key: 'nature', label: 'Control nature', required: false, synonyms: ['control nature', 'nature', 'manual / automated', 'automation'] },
  { key: 'frequency', label: 'Frequency', required: true, synonyms: ['frequency', 'control frequency', 'how often'] },
  { key: 'isKey', label: 'Key control', required: false, synonyms: ['key control', 'key', 'key / non-key', 'is key'] },
  { key: 'owner', label: 'Control owner', required: false, synonyms: ['control owner', 'owner', 'performed by', 'control performer'] },
  { key: 'processOwner', label: 'Process owner', required: false, synonyms: ['process owner'] },
  { key: 'assertions', label: 'Assertions', required: false, synonyms: ['assertions', 'assertion', 'financial statement assertions', 'ceavop'] },
  { key: 'attributes', label: 'Attributes', required: false, synonyms: ['attributes', 'test attributes', 'attribute', 'testing attributes'] },
  { key: 'controlEvidence', label: 'Control evidence', required: false, synonyms: ['control evidence', 'evidence', 'supporting evidence', 'documents'] },
  { key: 'designChecks', label: 'Design checks (TOD)', required: false, synonyms: ['tod checks performed', 'tod checks', 'design checks', 'test of design', 'tod'] },
  { key: 'sopSectionRef', label: 'SOP section', required: false, synonyms: ['sop section ref', 'sop section', 'sop reference', 'sop ref'] },
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

function keywordJaccard(a: string, b: string): number {
  const wa = meaningfulWords(a);
  const wb = meaningfulWords(b);
  if (!wa.length || !wb.length) return 0;
  const shared = wa.filter(x => wb.some(y => sameWord(x, y))).length;
  return shared / (wa.length + wb.length - shared);
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

function pad3(n: number): string { return String(n).padStart(3, '0'); }

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
export function matchColumns(headers: string[]): ColumnMatch[] {
  const norm = headers.map(h => normaliseHeader(h));
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
  for (const p of pairs) {
    if (byField.has(p.field) || usedColumns.has(p.column)) continue;
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
  nature: Nature;
  type: ControlType;
  assertions: Assertion[];
  riskRating?: RiskRating;
  /** A8: this looks like a control another RACM on the engagement already has. */
  duplicateOf?: { controlId: string; process: string; reason: string };
}

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

function parseNature(cell: string): Nature {
  const t = normaliseHeader(cell);
  if (/\bit dependent\b|\bsemi automated\b|\bitdm\b/.test(t)) return 'IT-dependent';
  if (/\bautomat(?:ed|ic|ically)\b/.test(t)) return 'Automated';
  return 'Manual';
}

function parseType(cell: string): ControlType {
  return /detect/i.test(cell) ? 'Detective' : 'Preventive';
}

const ASSERTION_ORDER: Assertion[] = ['Completeness', 'Accuracy', 'Existence / Occurrence', 'Cut-off', 'Valuation', 'Rights & Obligations', 'Presentation'];
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

function parseRiskRating(cell: string): RiskRating | undefined {
  const t = normaliseHeader(cell);
  if (!t) return undefined;
  if (/\b(?:high|critical)\b/.test(t)) return 'High';
  if (/\b(?:medium|moderate)\b/.test(t)) return 'Medium';
  if (/\blow\b/.test(t)) return 'Low';
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

function findDuplicate(values: Partial<Record<RacmFieldKey, string>>, idWasGenerated: boolean, existing: Control[], process: string): ImportRow['duplicateOf'] {
  const others = existing.filter(c => c.process !== process);
  if (!others.length) return undefined;
  const id = (values.controlId ?? '').trim().toLowerCase();
  if (id && !idWasGenerated) {
    const same = others.find(c => (c.code ?? c.id).toLowerCase() === id);
    if (same) {
      const shown = same.code ?? same.id;
      return { controlId: same.id, process: same.process, reason: `Same control ID as ${shown} in the ${same.process} RACM` };
    }
  }
  const text = (values.controlTitle ?? '').trim() || (values.controlActivity ?? '').trim();
  if (!text) return undefined;
  let best: { c: Control; score: number } | null = null;
  for (const c of others) {
    const score = Math.max(keywordJaccard(text, c.description), c.controlActivity ? keywordJaccard(text, c.controlActivity) : 0);
    if (score >= 0.75 && (!best || score > best.score)) best = { c, score };
  }
  if (!best) return undefined;
  return { controlId: best.c.id, process: best.c.process, reason: `Reads like ${best.c.code ?? best.c.id} in the ${best.c.process} RACM` };
}

/** Build review rows from the data rows below `headerRow`, skipping fully blank
 *  rows. `existing` is every control on the engagement (for A8 duplicates);
 *  `process` is the RACM being created (duplicates are only looked for in OTHER
 *  processes). */
export function buildImportRows(rows: string[][], headerRow: number, matches: ColumnMatch[], existing: Control[], process: string): ImportRow[] {
  const mapped = matches.filter((m): m is ColumnMatch & { column: number } => m.column != null);
  const out: ImportRow[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    const values: Partial<Record<RacmFieldKey, string>> = {};
    for (const m of mapped) values[m.field] = String(cells[m.column] ?? '').trim();
    // Blank across every mapped column is blank for import too — a section label
    // sitting only in an unmapped column (e.g. the process name) is not a control.
    if (!Object.values(values).some(v => v)) continue;
    const rowNo = r + 1;
    out.push(rowFromValues(values, { key: `row-${rowNo}`, rowNo, origin: 'file' }, existing, process));
  }
  return out;
}

/** Rebuild one row from edited `values` (after fills, or a frequency picked in
 *  review), re-deriving everything else the same way buildImportRows does. */
export function rowFromValues(values: Partial<Record<RacmFieldKey, string>>, base: Pick<ImportRow, 'key' | 'rowNo' | 'origin' | 'sectionRef'>, existing: Control[], process: string): ImportRow {
  const v: Partial<Record<RacmFieldKey, string>> = { ...values };
  const generatedId = `C-${pad3(base.rowNo)}`;
  if (!(v.controlId ?? '').trim()) v.controlId = generatedId;
  const idWasGenerated = v.controlId === generatedId;

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

  const row: ImportRow = {
    key: base.key,
    rowNo: base.rowNo,
    origin: base.origin,
    values: v,
    attributes,
    designChecks: checks,
    mergedDuplicateChecks: merged,
    frequency: freq.frequency,
    isKey: parseIsKey(v.isKey ?? ''),
    nature: parseNature(v.nature ?? ''),
    type: parseType(v.type ?? ''),
    assertions: parseAssertions(v.assertions ?? ''),
  };
  if (base.sectionRef) row.sectionRef = base.sectionRef;
  if (freq.flag) row.frequencyFlag = freq.flag;
  const rating = parseRiskRating(v.riskRating ?? '');
  if (rating) row.riskRating = rating;
  const dup = findDuplicate(v, idWasGenerated, existing, process);
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

/** A9: values for this row's empty fields, read off its other columns. Never
 *  proposes a value for a field that already has one, and never for isKey. */
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
    if (auto) fills.push({ field: 'nature', value: 'Automated', reason: `${source} says '${phraseAt(text, auto.index)}'` });
    else if (it) fills.push({ field: 'nature', value: 'IT-dependent', reason: `${source} mentions '${it[0]}' — a person working off system output` });
    else fills.push({ field: 'nature', value: 'Manual', reason: `${source} names no system — a person does the work` });
  }

  // Type — does it stop the error, or find it afterwards?
  if (blank('type') && (activity || title || objective)) {
    const text = [activity, title, objective].filter(Boolean).join(' ');
    const m = /\breview\w*|\breconcil\w*|\bmonitor\w*|\binvestigat\w*/i.exec(text);
    if (m) fills.push({ field: 'type', value: 'Detective', reason: `Says '${phraseAt(text, m.index)}' — it finds errors after the fact` });
    else fills.push({ field: 'type', value: 'Preventive', reason: 'Nothing reviews or reconciles after the fact — it stops the error up front' });
  }

  // Owner — the (WHO) of the activity.
  if (blank('owner') && activity) {
    const m = /^([\s\S]*?)\(\s*who\s*\)/i.exec(activity);
    if (m) {
      const who = (m[1].split(/[.;:,]/).pop() ?? '').trim().replace(/^the\s+/i, '').trim();
      if (who) fills.push({ field: 'owner', value: who, reason: `Activity names '${who}' as the WHO` });
    }
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

  // Risk rating — only a starting point; the rating is agreed with management.
  if (blank('riskRating') && risk) {
    const m = /\bfraud\w*|\bmaterial\w*|\bmisstat\w*/i.exec(risk);
    if (m) fills.push({ field: 'riskRating', value: 'High', reason: `Risk mentions '${m[0].toLowerCase()}'` });
    else fills.push({ field: 'riskRating', value: 'Medium', reason: 'Risk names no fraud or material misstatement — Medium until agreed with management' });
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
 *  re-derive it. */
export function applyFills(row: ImportRow, fills: BlankFill[], existing: Control[], process: string): ImportRow {
  const values = { ...row.values };
  for (const f of fills) {
    if (f.field === 'isKey' || (values[f.field] ?? '').trim()) continue;
    values[f.field] = f.value;
  }
  return rowFromValues(values, row, existing, process);
}

// ── A7 suggestions ───────────────────────────────────────────────────────────────

const SUGGESTED_ATTRIBUTES: Record<ControlType, string[]> = {
  Preventive: ['Approval is evidenced before the transaction is processed', 'Approver is independent of the preparer'],
  Detective: ['Review is performed within the required timeframe', 'Exceptions are investigated and resolved'],
};

/** A7: attributes and design checks Ira would add to this row — only ones the
 *  row doesn't already have. */
export function suggestForRow(row: ImportRow, process: string): { attributes: string[]; designChecks: string[] } {
  const control = controlFromRow(row, process, 1, row.frequency ?? 'Recurring');
  const have = new Set(row.designChecks.map(sameText));
  const designChecks = suggestedDesignChecks(control).filter(t => !have.has(sameText(t)));
  const present = row.attributes.map(a => a.text);
  const attributes = row.attributes.length < 2
    ? SUGGESTED_ATTRIBUTES[row.type].filter(t => !alreadySaid(present, t))
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

function clazzOf(category: string): ControlClass {
  if (/complian|regulat/i.test(category)) return 'Compliance';
  if (/operation/i.test(category)) return 'Operational';
  return 'Financial';
}

/** One row as an engagement control. `n` is the row's 1-based place in the import. */
function controlFromRow(row: ImportRow, process: string, n: number, frequency: Frequency, wpPrefix = processInitials(process)): Control {
  const val = (k: RacmFieldKey) => (row.values[k] ?? '').trim();
  const id = val('controlId') || `C-${pad3(row.rowNo)}`;
  const wpRef = `${wpPrefix}-${String(n).padStart(2, '0')}`;
  const activity = val('controlActivity');
  const objective = val('objective');
  const description = val('controlTitle') || (activity ? firstSentence(activity) : '') || objective || `Control ${id}`;
  const assertions: Assertion[] = row.assertions.length ? row.assertions : ['Accuracy'];

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
    subProcess: val('subProcess') || 'General',
    nature: row.nature,
    type: row.type,
    frequency,
    isKey: row.isKey,
    clazz: clazzOf(val('riskCategory')),
    precision: description,
    owner: val('owner'),
    riskId: val('riskId') || `R-${n}`,
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
  if (row.riskRating) control.riskRating = row.riskRating;
  return control;
}

/** Turn reviewed rows into engagement controls for createRacm. Every row must
 *  have a frequency by now. Attributes become operating steps with their
 *  `requiredFiles`; design checks become design points (merged, not doubled). */
export function importRowsToControls(rows: ImportRow[], process: string): Control[] {
  const missing = rows.filter(r => r.frequency === null);
  if (missing.length) {
    const ids = missing.map(r => (r.values.controlId ?? '').trim() || `row ${r.rowNo}`);
    throw new Error(`Pick a frequency before importing — ${missing.length === 1 ? `${ids[0]} has` : `${ids.join(', ')} have`} none.`);
  }
  const prefix = processInitials(process);
  return rows.map((row, i) => controlFromRow(row, process, i + 1, row.frequency as Frequency, prefix));
}

// ─── SOP extraction (A6) ─────────────────────────────────────────────────────────

/** The instruction Ira extracts a RACM from an SOP with. Shown in full and
 *  editable before extraction; nothing is extracted until it is validated. */
export const DEFAULT_SOP_PROMPT = `You are extracting a SOX / ICFR risk and control matrix (RACM) from the attached standard operating procedure.

1. Read the whole SOP. Work only from what it says; do not invent controls it does not describe.
2. For every risk the SOP addresses, record: Risk ID, risk description, risk category and risk rating.
3. For every control that mitigates a risk, record: Control ID, control title, control objective, control activity (who does what, where, when, how and why), control type (Preventive / Detective), control nature (Manual / Automated / IT-dependent), frequency (Annual, Quarterly, Monthly, Weekly, Daily, Recurring or Ad-hoc — never "Continuous"), key control (Yes / No), control owner and process owner.
4. Keep the SOP's own risk and control IDs exactly as written. Only create an ID when the SOP has none, and say so.
5. For each control, list its test attributes one per line, and the control evidence each attribute needs.
6. Cite the SOP section every row came from (for example "§ 4.2").
7. Where the SOP is silent but a control is clearly expected for the risk, add it separately and mark it "Suggested", so a reviewer can accept or reject it.`;

/** Draft review rows for `process` from its template once the prompt is
 *  validated: most rows `origin: 'sop'` with a section ref, roughly one in four
 *  `origin: 'suggested'`. Deterministic for the same process + file name. */
export function draftRowsFromSop(process: string, fileName: string, prompt: string, existing: Control[]): ImportRow[] {
  void prompt; // validated upstream; the draft reads the same whatever it says
  const template = racmTemplateForProcesses([process], 'fresh');
  const seed = hashString(`${process}|${fileName}`);
  const offset = seed % 4;
  const firstSection = 2 + ((seed >>> 3) % 3);
  const subProcesses = Array.from(new Set(template.map(c => c.subProcess)));
  const perSection = new Map<string, number>();

  return template.map((c, i) => {
    const suggested = (i + offset) % 4 === 3;
    let sectionRef: string | undefined;
    if (!suggested) {
      const minor = (perSection.get(c.subProcess) ?? 0) + 1;
      perSection.set(c.subProcess, minor);
      sectionRef = `§ ${firstSection + subProcesses.indexOf(c.subProcess)}.${minor}`;
    }
    const steps = c.operating.steps;
    const evidence = Array.from(new Set(steps.flatMap(s => requiredFilesOf(s, c).map(f => f.label))));
    const values: Partial<Record<RacmFieldKey, string>> = {
      riskId: c.riskId,
      riskDescription: c.riskDescription,
      riskCategory: c.clazz ?? '',
      riskRating: c.riskRating ?? '',
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
      attributes: steps.map(s => s.description).join('\n'),
      controlEvidence: evidence.join('; '),
      // control-level checks only — attribute-level ones belong to their attribute
      designChecks: c.design.points.filter(p => !p.stepId).map(p => p.text).join('\n'),
      sopSectionRef: sectionRef ?? '',
    };
    return rowFromValues(values, { key: `sop-${i + 1}`, rowNo: i + 1, origin: suggested ? 'suggested' : 'sop', sectionRef }, existing, process);
  });
}
