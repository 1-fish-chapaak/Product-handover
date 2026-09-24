/** ── Reading a client's own org chart ──────────────────────────────────────
 *  Until 24 Sep the "extraction" recognised two filenames and handed back a
 *  chart we had authored ourselves, which meant every upload produced the same
 *  twelve companies whatever the document said. This reads the file.
 *
 *  Only a spreadsheet can be read honestly. A PDF, a photo of a printed chart
 *  or a Visio drawing needs OCR and a diagram parser that this prototype does
 *  not have, so those are refused by name and the user fills the table the way
 *  they already can — rather than being handed invented companies and left to
 *  discover later that none of them came from their document.
 *
 *  Structure only: who exists, who holds whom, how much of it, and where it is
 *  incorporated. An org chart says nothing about processes, so those cells stay
 *  the user's to fill.
 */
import * as XLSX from 'xlsx';
import type { GroupEntity, EntityType } from './soxTestingData';

/** Deliberately not borrowed from the RACM importer. An org chart has nothing
 *  to do with a control matrix, and reaching into that module for two helpers
 *  dragged its whole field dictionary — and a cycle — along with them. */
function normaliseHeader(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/#/g, ' no ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Every sheet of an .xlsx / .xls / .csv, as trimmed string cells. */
async function readWorkbook(file: File): Promise<{ name: string; rows: string[][] }[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const raw = ws ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false, blankrows: true }) : [];
    return { name, rows: raw.map(r => (Array.isArray(r) ? r : []).map(v => String(v ?? '').trim())) };
  });
}

/** Formats a spreadsheet reader can actually open. Everything else the upload
 *  control accepts — PDF, image, Visio, PowerPoint, draw.io — lands here as
 *  "can't read this", which is the truth. */
const READABLE = /\.(xlsx|xlsm|xlsb|xls|csv|tsv)$/i;
export const isReadableOrgChart = (fileName: string): boolean => READABLE.test(fileName.trim());

/** A guard rather than a limit anyone should hit: a group register of this size
 *  is a different document from an org chart, and rendering it row by row would
 *  hang the table rather than fill it. */
const MAX_ROWS = 600;

export interface ParsedOrgChart {
  /** The company the chart sits on top of — what the engagement is named for. */
  groupName: string;
  entities: GroupEntity[];
  /** Which columns were actually found, for the line shown under the upload. */
  matched: OrgChartFieldKey[];
}

export type OrgChartResult =
  | { ok: true; chart: ParsedOrgChart }
  | { ok: false; reason: string };

export type OrgChartFieldKey = 'name' | 'entityId' | 'parentId' | 'parentName' | 'ownership' | 'country' | 'type' | 'level';

/** Header words that name each column, longest and most specific first — the
 *  order matters, because "immediate parent id" contains "parent" and "id", and
 *  whichever field claims a column first keeps it. */
const FIELD_SYNONYMS: { key: OrgChartFieldKey; synonyms: string[] }[] = [
  { key: 'parentId',   synonyms: ['immediate parent id', 'parent entity id', 'parent id', 'parent code', 'parent ref', 'holding company id'] },
  { key: 'parentName', synonyms: ['immediate parent name', 'immediate parent', 'parent entity name', 'parent entity', 'parent name', 'parent company', 'holding company', 'held by', 'owned by', 'reports to', 'parent'] },
  { key: 'entityId',   synonyms: ['legal entity id', 'entity id', 'entity code', 'entity ref', 'company id', 'company code', 'cin', 'id', 'code'] },
  { key: 'name',       synonyms: ['legal entity name', 'entity name', 'company name', 'subsidiary name', 'name of entity', 'name of company', 'legal entity', 'entity', 'company', 'subsidiary', 'name'] },
  { key: 'ownership',  synonyms: ['direct ownership', 'direct ownership percent', 'direct holding', 'ownership percent', 'ownership', 'shareholding', 'holding percent', 'percent held', 'stake', 'equity interest', 'holding'] },
  { key: 'country',    synonyms: ['jurisdiction of incorporation', 'country of incorporation', 'jurisdiction', 'country', 'incorporated in', 'domicile', 'location'] },
  { key: 'type',       synonyms: ['entity type', 'entity category', 'relationship', 'entity class', 'type', 'legal form', 'category'] },
  { key: 'level',      synonyms: ['level', 'tier', 'depth', 'generation'] },
];

/** Strips the trailing "%" and any thousands separators a sheet carries, so
 *  "74%", "74.0" and " 74 " all read as 74. An unreadable cell means nobody
 *  said, which is not the same as nought. */
function parsePercent(cell: string): number | undefined {
  const t = String(cell ?? '').replace(/[%,\s]/g, '');
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  // A sheet that stores 0.74 for 74% is common enough to be worth reading.
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

/** Maps whatever word the client uses onto the five the table offers. Anything
 *  unrecognised becomes Subsidiary, because a row on an org chart that is not
 *  the top company is held by somebody. */
function parseEntityType(cell: string, isRoot: boolean): EntityType {
  const t = normaliseHeader(cell);
  if (isRoot) return 'Holding';
  if (!t) return 'Subsidiary';
  if (/\b(?:holding|parent|ultimate|topco|hold co)\b/.test(t)) return 'Holding';
  if (/\b(?:joint venture|jv)\b/.test(t)) return 'Joint venture';
  if (/\bassociate\b/.test(t)) return 'Associate';
  if (/\b(?:branch|permanent establishment)\b/.test(t)) return 'Branch';
  return 'Subsidiary';
}

/** Which column holds what. Exact header matches are taken first across every
 *  field, so "entity name" and "entity id" cannot be confused by a substring
 *  rule; only then do the looser contains-matches run. */
function matchColumns(header: string[]): Partial<Record<OrgChartFieldKey, number>> {
  const norm = header.map(h => normaliseHeader(h));
  const taken = new Set<number>();
  const found: Partial<Record<OrgChartFieldKey, number>> = {};

  for (const { key, synonyms } of FIELD_SYNONYMS) {
    const i = norm.findIndex((h, idx) => !taken.has(idx) && h && synonyms.includes(h));
    if (i >= 0) { found[key] = i; taken.add(i); }
  }
  for (const { key, synonyms } of FIELD_SYNONYMS) {
    if (found[key] !== undefined) continue;
    const i = norm.findIndex((h, idx) => !taken.has(idx) && h && synonyms.some(s => h.includes(s)));
    if (i >= 0) { found[key] = i; taken.add(i); }
  }
  return found;
}

/** The header is the first row that names at least the entity — a register
 *  often carries a title line or two above it. */
function findHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, 20);
  for (let r = 0; r < limit; r++) {
    const cols = matchColumns(rows[r] ?? []);
    if (cols.name !== undefined) return r;
  }
  return 0;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Reads the sheet into the table's own shape. The ids are ours, not the
 *  file's: a client's "ALT-0001" has to survive alongside rows the user typed,
 *  and two uploads of two charts must not collide on a shared code. */
export async function parseOrgChartFile(file: File): Promise<OrgChartResult> {
  if (!isReadableOrgChart(file.name)) {
    return { ok: false, reason: 'not-a-spreadsheet' };
  }

  let sheets: { name: string; rows: string[][] }[];
  try {
    sheets = await readWorkbook(file);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (!sheets.length) return { ok: false, reason: 'unreadable' };

  // The sheet that looks most like a register — the one naming the most of our
  // columns — rather than simply the first, which is often a cover page.
  let best: { rows: string[][]; header: number; cols: Partial<Record<OrgChartFieldKey, number>> } | null = null;
  for (const sheet of sheets) {
    const header = findHeaderRow(sheet.rows);
    const cols = matchColumns(sheet.rows[header] ?? []);
    if (cols.name === undefined) continue;
    if (!best || Object.keys(cols).length > Object.keys(best.cols).length) {
      best = { rows: sheet.rows, header, cols };
    }
  }
  if (!best) return { ok: false, reason: 'no-entity-column' };

  const { rows, header, cols } = best;
  const at = (row: string[], key: OrgChartFieldKey): string => {
    const i = cols[key];
    return i === undefined ? '' : String(row[i] ?? '').trim();
  };

  // ── Pass one: every named row becomes an entity with an id of our own ──────
  interface Raw { ent: GroupEntity; fileId: string; parentFileId: string; parentName: string; typeCell: string; level: number | undefined }
  const raws: Raw[] = [];
  const usedIds = new Set<string>();
  for (let r = header + 1; r < rows.length && raws.length < MAX_ROWS; r++) {
    const row = rows[r] ?? [];
    const name = at(row, 'name');
    if (!name) continue;
    // A totals or notes line at the foot of a register is not a company.
    if (/^(?:total|grand total|notes?|source)\b/i.test(name)) continue;

    let id = `oc-${slug(at(row, 'entityId') || name)}`;
    while (usedIds.has(id)) id += '-x';
    usedIds.add(id);

    const lvlRaw = at(row, 'level');
    const lvl = lvlRaw === '' ? undefined : Number(lvlRaw);
    raws.push({
      ent: {
        id,
        name,
        type: 'Subsidiary',
        ownership: parsePercent(at(row, 'ownership')) ?? 100,
        country: at(row, 'country') || undefined,
      },
      fileId: at(row, 'entityId'),
      parentFileId: at(row, 'parentId'),
      parentName: at(row, 'parentName'),
      typeCell: at(row, 'type'),
      level: Number.isFinite(lvl) ? lvl : undefined,
    });
  }
  if (!raws.length) return { ok: false, reason: 'no-rows' };

  // ── Pass two: wire the chain, by the file's own id where it has one and by
  // name where it does not ──────────────────────────────────────────────────
  const byFileId = new Map(raws.filter(r => r.fileId).map(r => [r.fileId.toLowerCase(), r.ent.id]));
  const byName = new Map(raws.map(r => [r.ent.name.toLowerCase(), r.ent.id]));
  raws.forEach(r => {
    const parent =
      (r.parentFileId && byFileId.get(r.parentFileId.toLowerCase())) ||
      (r.parentName && byName.get(r.parentName.toLowerCase())) ||
      undefined;
    // A row cannot hold itself — a register that repeats its own id in the
    // parent column for the top company would otherwise build a loop.
    if (parent && parent !== r.ent.id) r.ent.parentId = parent;
  });

  // ── The root: whoever nobody holds. Where a file says so with a level
  // column, the lowest level wins; otherwise it is the first parentless row ──
  const parentless = raws.filter(r => !r.ent.parentId);
  const root =
    parentless.find(r => r.level === 0) ??
    parentless.slice().sort((a, b) => (a.level ?? 99) - (b.level ?? 99))[0] ??
    raws[0];

  // Type is settled last, because the top company reads Holding whatever word
  // the file used for it — and which row that is only became clear just now.
  raws.forEach(r => { r.ent.type = parseEntityType(r.typeCell, r.ent.id === root.ent.id); });
  root.ent.parentId = undefined;

  // The table indents rather than sorts, so the root is authored first and
  // everything held beneath it follows in the order the file reads.
  const ordered = [root.ent, ...raws.filter(r => r.ent.id !== root.ent.id).map(r => r.ent)];

  return {
    ok: true,
    chart: {
      groupName: root.ent.name,
      entities: ordered,
      matched: (Object.keys(cols) as OrgChartFieldKey[]).filter(k => cols[k] !== undefined),
    },
  };
}
