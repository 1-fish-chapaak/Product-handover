/** ── Reading a client's own org chart ──────────────────────────────────────
 *  Until 24 Sep the "extraction" recognised two filenames and handed back a
 *  chart we had authored ourselves, which meant every upload produced the same
 *  twelve companies whatever the document said. This reads the file.
 *
 *  A register kept as a spreadsheet, a PDF, a Word file or a scan is read
 *  through the shared table reader (1 Oct) — the PDF, Word and image cases used
 *  to be refused. A file with no table in it (a drawn chart, a blank scan) is
 *  still refused, and the user fills the table the way they already can —
 *  rather than being handed invented companies.
 *
 *  Structure only: who exists, who holds whom, how much of it, and where it is
 *  incorporated. An org chart says nothing about processes, so those cells stay
 *  the user's to fill.
 */
import type { GroupEntity, EntityType } from './soxTestingData';
import { readTableRows, isReadableTableFile, type ReadSheet, type PlacedText } from './tableReader';

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

/** Spreadsheet, PDF, Word or image — whatever the shared reader can open. */
export const isReadableOrgChart = (fileName: string): boolean => isReadableTableFile(fileName);

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
  { key: 'ownership',  synonyms: ['direct ownership', 'direct ownership percent', 'direct holding', 'ownership percent', 'ownership', 'shareholding', 'holding percent', 'percent held', 'stake', 'equity interest', 'holding', 'direct'] },
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
export async function parseOrgChartFile(file: File, onScan?: () => void): Promise<OrgChartResult> {
  const read = await readTableRows(file, onScan);
  const fromTable = read.ok ? orgChartFromSheets(read.sheets) : null;
  if (fromTable?.ok) return fromTable;
  // No register in it — but a PDF or a picture of a DRAWN chart still names
  // every company in its boxes (5 Oct). Read those before giving up.
  if (read.pages?.length) {
    const fromBoxes = orgChartFromPages(read.pages);
    if (fromBoxes.ok) return fromBoxes;
  }
  return fromTable ?? { ok: false, reason: read.ok ? 'no-table' : read.reason };
}

/** The same, from rows already read — any file type ends up here. */
export function orgChartFromSheets(sheets: ReadSheet[]): OrgChartResult {
  if (!sheets.length) return { ok: false, reason: 'no-table' };

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
  /** A PDF or Word table repeats its header on every page — not a company. */
  const headerKey = (rows[header] ?? []).map(normaliseHeader).join('|');
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
    if (row.map(normaliseHeader).join('|') === headerKey) continue;
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
      // A printed register often heads its id column just "Parent".
      (r.parentName && byFileId.get(r.parentName.toLowerCase())) ||
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

// ── A drawn chart: boxes, not a table (5 Oct) ──────────────────────────────
/** The ending a company's name carries — what tells a box's title from a
 *  heading, a note or a footer on the same page. */
const LEGAL_FORM = /\b(?:ltd|limited|llc|l\.l\.c|inc|incorporated|corp|corporation|plc|gmbh|ag|sa|s\.a|sas|sarl|bv|b\.v|nv|n\.v|ulc|pty|pte|llp|lp|spa|s\.p\.a|kk|bhd|company|co|holdings?|lda|oy|ab|as|a\/s|aps|srl|s\.r\.l|sl|s\.l|kft|zrt|sp\.? z o\.?o|pjsc|jsc|fze|fzco|wll|saog)\.?\)?$/i;

/** Countries a box's detail line may name, as the register writes them. */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States', us: 'United States', 'u.s.': 'United States', 'u.s.a.': 'United States', 'united states': 'United States',
  uk: 'United Kingdom', 'united kingdom': 'United Kingdom', england: 'United Kingdom', uae: 'United Arab Emirates',
};
const COUNTRIES = new Set([
  'india', 'canada', 'netherlands', 'germany', 'france', 'switzerland', 'singapore', 'mauritius', 'ireland', 'luxembourg', 'spain',
  'italy', 'belgium', 'australia', 'new zealand', 'japan', 'china', 'hong kong', 'south africa', 'brazil', 'mexico', 'sweden',
  'norway', 'denmark', 'finland', 'poland', 'austria', 'portugal', 'saudi arabia', 'qatar', 'oman', 'bahrain', 'kenya', 'nigeria',
  'indonesia', 'malaysia', 'thailand', 'vietnam', 'philippines', 'sri lanka', 'bangladesh', 'nepal', 'egypt', 'turkey', 'israel',
  'united states', 'united kingdom', 'united arab emirates', 'cyprus', 'jersey', 'cayman islands', 'chile', 'peru', 'colombia', 'argentina',
]);
const titleCase = (t: string) => t.replace(/\b\p{L}/gu, c => c.toUpperCase());
function countryIn(detail: string): string | undefined {
  for (const seg of detail.split(/\s*[·•|–—]\s*|\s*-\s+/)) {
    // "Delaware, USA" / "Ontario, Canada": the country is after the last comma.
    const parts = seg.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    for (const part of [...parts].reverse()) {
      if (COUNTRY_ALIASES[part]) return COUNTRY_ALIASES[part];
      if (COUNTRIES.has(part)) return titleCase(part);
    }
  }
  return undefined;
}

interface TextLine { x0: number; x1: number; y: number; h: number; text: string }
interface Box { name: string; detail: string[]; x0: number; x1: number; y0: number; y1: number; h: number; page: number }

/** Runs on one baseline, close enough to be one phrase, joined into a line. */
export function linesOf(page: PlacedText[]): TextLine[] {
  const items = page.filter(t => t.text.trim() && t.h > 0).sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: PlacedText[][] = [];
  for (const t of items) {
    const cur = rows[rows.length - 1];
    if (cur && Math.abs(t.y - cur[0].y) <= Math.max(cur[0].h, t.h) * 0.4) cur.push(t);
    else rows.push([t]);
  }
  const out: TextLine[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let cur: TextLine | null = null;
    for (const t of row) {
      const s = t.text.replace(/\s+/g, ' ').trim();
      if (cur && t.x - cur.x1 < t.h * 1.2) {
        cur.text = t.x - cur.x1 < t.h * 0.12 ? `${cur.text}${s}` : `${cur.text} ${s}`;
        cur.x1 = Math.max(cur.x1, t.x + t.w);
        cur.h = Math.max(cur.h, t.h);
      } else {
        if (cur) out.push(cur);
        cur = { x0: t.x, x1: t.x + t.w, y: t.y, h: t.h, text: s };
      }
    }
    if (cur) out.push(cur);
  }
  return out.sort((a, b) => a.y - b.y || a.x0 - b.x0);
}

/** A line that could be a company's name: short, capitalised, no bullet,
 *  dash or percentage (those are the detail lines under it), and ending the
 *  way a company name does. Font size is not trusted — OCR's line heights
 *  wander more than the type does. */
const isNameLine = (t: string) =>
  /^\p{Lu}/u.test(t) && !/%|\s[·•|–—-]\s|;/.test(t) && t.split(/\s+/).length <= 10 && LEGAL_FORM.test(t);
/** The first half of a name that wrapped onto two lines. */
const isNamePart = (t: string) => /^\p{Lu}\p{L}/u.test(t) && !/%|\s[·•|–—-]\s|[.;:]$/.test(t) && t.split(/\s+/).length <= 6;

/** Lines stacked under one another in one column, then cut into boxes: each
 *  box starts at a name and keeps the detail lines under it. */
export function boxesOf(lines: TextLine[], page: number): Box[] {
  const stacks: TextLine[][] = [];
  for (const l of lines) {
    let best: TextLine[] | undefined;
    let bestGap = Infinity;
    for (const st of stacks) {
      const last = st[st.length - 1];
      const gap = l.y - last.y;
      const overlap = Math.min(l.x1, last.x1) - Math.max(l.x0, last.x0);
      if (gap > 0 && gap <= Math.max(last.h, l.h) * 2.2 && overlap > 0 && gap < bestGap) { best = st; bestGap = gap; }
    }
    if (best) best.push(l); else stacks.push([l]);
  }
  const boxes: Box[] = [];
  for (const st of stacks) {
    let cur: Box | null = null;
    st.forEach((l, i) => {
      if (!isNameLine(l.text)) { cur?.detail.push(l.text); return; }
      const parts = [l];
      const prev = st[i - 1];
      // A wrapped name: the line above opens the stack, or is set larger than
      // the detail line before it (the type steps back up to name size).
      if (prev && isNamePart(prev.text) && !isNameLine(prev.text)
        && (i === 1 || (prev.h > st[i - 2].h + 0.25 && prev.h >= l.h - 0.25))) {
        parts.unshift(prev);
        if (cur && cur.detail[cur.detail.length - 1] === prev.text) cur.detail.pop();
      }
      cur = {
        name: parts.map(p => p.text).join(' ').replace(/\s+/g, ' ').trim(),
        detail: [],
        x0: Math.min(...parts.map(p => p.x0)), x1: Math.max(...parts.map(p => p.x1)),
        y0: parts[0].y, y1: l.y, h: Math.max(...parts.map(p => p.h)), page,
      };
      boxes.push(cur);
    });
  }
  return boxes;
}

/**
 * The companies on a drawn org chart — one per box, read from the text the
 * PDF (or OCR) placed on each page. A box's title is its largest line (joined
 * when it wraps) and counts only when it ends the way a company name does.
 * Under it: "City, Country · what it does" and "74% owned" — read for the
 * jurisdiction and the direct holding. Who holds whom is read off the layout:
 * a box hangs from the nearest company box above it that starts further left
 * and spans its column, and a box with nothing above it from the chart's top
 * company. The same company drawn twice (a page that repeats its parent at
 * the top) is one company.
 */
export function orgChartFromPages(pages: PlacedText[][]): OrgChartResult {
  interface Found { box: Box; name: string; ownership?: number; country?: string }
  const found: Found[] = [];
  pages.forEach((page, p) => {
    for (const box of boxesOf(linesOf(page), p)) {
      if (box.name.length < 4 || box.name.length > 120) continue;
      const pct = box.detail.map(t => t.match(/(\d{1,3}(?:\.\d+)?)\s*%\s*(?:owned|held|[·•–—-]|$)/i)).find(Boolean);
      const own = pct ? Number(pct[1]) : undefined;
      found.push({ box, name: box.name, ownership: own !== undefined && own <= 100 ? own : undefined, country: box.detail.length ? countryIn(box.detail.join(' · ')) : undefined });
    }
  });
  if (!found.length) return { ok: false, reason: 'no-table' };

  // One company per name, the first drawing carrying its facts.
  const key = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const byKey = new Map<string, GroupEntity>();
  const usedIds = new Set<string>();
  for (const f of found) {
    const k = key(f.name);
    const have = byKey.get(k);
    if (have) {
      if (have.country === undefined && f.country) have.country = f.country;
      continue;
    }
    let id = `oc-${slug(f.name)}`;
    while (usedIds.has(id)) id += '-x';
    usedIds.add(id);
    byKey.set(k, { id, name: f.name, type: 'Subsidiary', ownership: f.ownership ?? 100, country: f.country });
  }

  // The top company: the largest title on the first page that has one, the
  // highest up when two tie.
  const first = found.filter(f => f.box.page === found[0].box.page);
  const top = [...first].sort((a, b) => b.box.h - a.box.h || a.box.y0 - b.box.y0)[0];
  const root = byKey.get(key(top.name))!;

  for (const f of found) {
    const me = byKey.get(key(f.name))!;
    if (me === root || me.parentId) continue;
    const above = found
      .filter(o => o.box.page === f.box.page && o.box.y1 < f.box.y0 && o.box.x0 < f.box.x0 - 3
        && Math.min(o.box.x1, f.box.x1) - Math.max(o.box.x0, f.box.x0) > 0 && byKey.get(key(o.name)) !== me)
      .sort((a, b) => b.box.y1 - a.box.y1)[0];
    const parent = above ? byKey.get(key(above.name))! : root;
    if (parent !== me) me.parentId = parent.id;
  }
  // A chain must reach the top — anything that loops is hung from the root.
  for (const e of byKey.values()) {
    const seen = new Set<string>([e.id]);
    let cur = e.parentId ? [...byKey.values()].find(x => x.id === e.parentId) : undefined;
    while (cur) {
      if (seen.has(cur.id)) { e.parentId = root.id; break; }
      seen.add(cur.id);
      cur = cur.parentId ? [...byKey.values()].find(x => x.id === cur!.parentId) : undefined;
    }
  }
  root.parentId = undefined;
  root.type = 'Holding';
  root.ownership = 100;
  const entities = [root, ...[...byKey.values()].filter(e => e !== root)].slice(0, MAX_ROWS);
  if (entities.length < 2) return { ok: false, reason: 'no-table' };
  return {
    ok: true,
    chart: {
      groupName: root.name,
      entities,
      matched: (['name', 'parentName', 'ownership', 'country'] as OrgChartFieldKey[])
        .filter(k => k === 'name' || k === 'parentName' || (k === 'ownership' ? found.some(f => f.ownership !== undefined) : found.some(f => f.country))),
    },
  };
}
