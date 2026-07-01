// ─── Real PDF header / footer extraction ───
// Reads the running header and footer out of an uploaded PDF using pdf.js (the
// platform's existing `getPdfjs()` worker setup — no new dependency). Used by the
// Smart Upload template flow to capture the source document's letterhead / footer
// and surface a confidentiality line, alongside the detected sections.
//
// The signal is repetition: a header/footer is text that recurs in the top or
// bottom margin band across most pages. A line that appears once (a cover-page
// title) is content, not a running header — so repetition is measured excluding
// page 1, which usually differs.

import { getPdfjs } from '../data-sources/datasetFiles';

/** Running header / footer read out of an uploaded PDF. The lines are the
 *  de-duplicated running text; `fields` are best-effort metadata candidates. */
export interface ExtractedHeaderFooter {
  header: string[];
  footer: string[];
  /** Detected page-numbering pattern, excluded from the header/footer content. */
  pageNumberPattern?: string;
  confidentiality?: string;
  fields: {
    auditTitle?: string;
    auditEntity?: string;
    auditPeriod?: string;
    preparedBy?: string;
    reportId?: string;
  };
}

// Above this size we skip the parse (mirrors datasetFiles' DEEP_PARSE_MAX_BYTES):
// loading + parsing a large PDF inline spikes memory and blocks the main thread.
const MAX_PARSE_BYTES = 30 * 1024 * 1024; // 30 MB
// Enough pages to establish a repetition pattern without parsing a 400-page file.
const MAX_PAGES = 12;
// Fraction of the page height treated as the header / footer margin band.
const BAND = 0.08; // top 8% / bottom 8%
// A line counts as "running" if it recurs on at least this share of pages.
const REPEAT_RATIO = 0.6;
// Items in the same band but separated by a gap this large (share of page width)
// are distinct cells (e.g. left "Confidential" vs right "Page 3 of 12"), not one
// line — splitting them keeps page numbers from contaminating the footer text.
const CELL_GAP_RATIO = 0.15;

// A line that is *only* a page number: "3", "Page 3", "Page 3 of 12", "3 / 12".
const PAGE_NUM_RE = /^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i;
// A page-number token embedded in a wider line (e.g. "Confidential   Page 3 of 12").
const PAGE_NUM_TOKEN_RE = /\b(page\s*\d+(\s*of\s*\d+)?|\d+\s*\/\s*\d+)\b/i;
const CONFIDENTIALITY_RE = /\b(strictly confidential|confidential|internal use only|for internal use|restricted|private and confidential|draft)\b/i;

interface Line { y: number; text: string; size: number }

/** Normalize a line for the repetition test: lowercase, collapse whitespace, and
 *  replace digit runs with "#" so "Page 3 of 12" and "Page 4 of 12" match. */
const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/\d+/g, '#').trim();

/** Remove an embedded page-number token from a line, returning the cleaned text
 *  and the pattern found (if any). */
function stripPageNumber(text: string): { text: string; pattern?: string } {
  const m = text.match(PAGE_NUM_TOKEN_RE);
  if (!m) return { text };
  return {
    text: text.replace(PAGE_NUM_TOKEN_RE, '').replace(/\s+/g, ' ').trim(),
    pattern: /of|\//.test(m[0]) ? 'Page N of M' : 'Page N',
  };
}

/** Group text items sharing a baseline into lines, splitting a baseline into
 *  separate cells across large horizontal gaps. pdf.js gives origin-bottom-left
 *  coordinates: transform[5] is y, transform[4] is x; width is the item width. */
function itemsToLines(items: { str: string; transform: number[]; width?: number; height?: number }[], pageWidth: number): Line[] {
  const rows: { y: number; parts: { x: number; w: number; str: string; size: number }[] }[] = [];
  for (const it of items) {
    const str = it.str;
    if (!str || !str.trim()) continue;
    const y = it.transform[5];
    const x = it.transform[4];
    // Font size ≈ the transform's vertical scale (hypot covers rotated text).
    const size = Math.hypot(it.transform[2] || 0, it.transform[3] || 0) || (it.height ?? 0);
    const row = rows.find(r => Math.abs(r.y - y) < 2); // same baseline within 2 units
    if (row) row.parts.push({ x, w: it.width ?? 0, str, size });
    else rows.push({ y, parts: [{ x, w: it.width ?? 0, str, size }] });
  }
  const gap = pageWidth * CELL_GAP_RATIO;
  const lines: Line[] = [];
  for (const r of rows) {
    const parts = r.parts.sort((a, b) => a.x - b.x);
    let cell: typeof parts = [];
    const flush = () => {
      if (cell.length === 0) return;
      const text = cell.map(p => p.str).join('').replace(/\s+/g, ' ').trim();
      if (text) lines.push({ y: r.y, text, size: Math.max(...cell.map(p => p.size)) });
      cell = [];
    };
    parts.forEach((p, i) => {
      if (i > 0) {
        const prev = parts[i - 1];
        if (p.x - (prev.x + prev.w) > gap) flush(); // wide blank gap → new cell
      }
      cell.push(p);
    });
    flush();
  }
  return lines;
}

/** Keep the lines that recur on >= REPEAT_RATIO of the considered pages. */
function runningLines(perPage: Line[][]): string[] {
  const n = perPage.length;
  if (n === 0) return [];
  // Exclude page 1 when there's more than one page (cover pages differ).
  const pages = n > 1 ? perPage.slice(1) : perPage;
  const seen = new Map<string, { count: number; raw: string; order: number }>();
  let order = 0;
  pages.forEach(lines => {
    const onThisPage = new Set<string>();
    lines.forEach(l => {
      if (PAGE_NUM_RE.test(l.text)) return; // a page-number-only line isn't content
      const clean = stripPageNumber(l.text).text; // drop any embedded page number
      if (!clean) return;
      const key = normalize(clean);
      if (!key || onThisPage.has(key)) return;
      onThisPage.add(key);
      const e = seen.get(key);
      if (e) e.count++;
      else seen.set(key, { count: 1, raw: clean, order: order++ });
    });
  });
  const threshold = Math.max(1, Math.ceil(pages.length * REPEAT_RATIO));
  return [...seen.values()]
    .filter(e => e.count >= threshold)
    .sort((a, b) => a.order - b.order)
    .map(e => e.raw);
}

/** Did any band on any page carry a page-number token, standalone or embedded? */
function detectPageNumberPattern(perPage: Line[][]): string | undefined {
  for (const lines of perPage) {
    for (const l of lines) {
      if (PAGE_NUM_RE.test(l.text)) return /of|\//.test(l.text) ? 'Page N of M' : 'Page N';
      const { pattern } = stripPageNumber(l.text);
      if (pattern) return pattern;
    }
  }
  return undefined;
}

/** Best-effort field candidates derived from the running header/footer lines. */
function deriveFields(header: string[], footer: string[]): ExtractedHeaderFooter['fields'] {
  const all = [...header, ...footer];
  const fields: ExtractedHeaderFooter['fields'] = {};

  const entity = header.find(l => /\b(ltd|limited|llp|inc\.?|pvt|private|corp(oration)?|gmbh|plc|& co)\b/i.test(l));
  if (entity) fields.auditEntity = entity;

  const periodLine = all.find(l =>
    /\bQ[1-4]\b.*\bFY?\s?\d{2,4}/i.test(l) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\s*[–\-to]+\s*\w/i.test(l) ||
    /\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s*[–\-to]+\s*\d{1,2}/i.test(l));
  if (periodLine) fields.auditPeriod = periodLine;

  // A reference code: a labelled "Ref No: XYZ", or a bare code like "ATR-2025-Q3-001"
  // (letters, a separator, and at least one digit — so a bare word isn't an ID).
  const ref = all.map(l =>
    l.match(/(?:ref(?:erence)?|doc(?:ument)?)\s*(?:no\.?|number|#|:)?\s*([A-Z][A-Z0-9][A-Z0-9\-\/]*\d[A-Z0-9\-\/]*)/i)?.[1]
    ?? l.match(/\b([A-Z]{2,}[-\/][A-Z0-9\-\/]*\d[A-Z0-9\-\/]*)\b/)?.[1]
  ).find(Boolean);
  if (ref) fields.reportId = ref.trim();

  const prep = all.map(l => l.match(/prepared\s+by[:\s]+(.+)/i)?.[1]).find(Boolean);
  if (prep) fields.preparedBy = prep.trim();

  // Title: the longest header line that isn't the entity / a reference / a date,
  // with any trailing reference label + code trimmed off.
  const title = header
    .filter(l => l !== entity && l !== periodLine && !PAGE_NUM_RE.test(l) && !CONFIDENTIALITY_RE.test(l))
    .map(l => l.replace(/\bref(?:erence)?\s*(?:no\.?|number|#|:)?\s*[A-Z0-9][A-Z0-9\-\/]*\d[A-Z0-9\-\/]*/i, '').replace(/\s+/g, ' ').trim())
    .filter(l => l.length >= 6)
    .sort((a, b) => b.length - a.length)[0];
  if (title) fields.auditTitle = title;

  return fields;
}

/**
 * Extract the running header and footer from a PDF File. Returns null when the
 * file isn't a parseable PDF, is too large to parse inline, or carries no text
 * layer (a scanned/image-only PDF) — callers then fall back gracefully.
 */
export async function extractPdfHeaderFooter(file: File): Promise<ExtractedHeaderFooter | null> {
  if (!/\.pdf$/i.test(file.name) || file.size > MAX_PARSE_BYTES) return null;
  try {
    const pdfjs = await getPdfjs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const pageCount = Math.min(doc.numPages, MAX_PAGES);

    const headerByPage: Line[][] = [];
    const footerByPage: Line[][] = [];
    let totalTextItems = 0;

    for (let p = 1; p <= pageCount; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const H = viewport.height;
      const content = await page.getTextContent();
      const items = content.items as { str: string; transform: number[]; width?: number }[];
      totalTextItems += items.length;
      const lines = itemsToLines(items, viewport.width);
      // PDF origin is bottom-left: top band = high y, bottom band = low y.
      headerByPage.push(lines.filter(l => l.y >= H * (1 - BAND)));
      footerByPage.push(lines.filter(l => l.y <= H * BAND));
    }

    await doc.destroy();

    // Scanned / image-only PDF: no text layer to read. Signal "nothing found".
    if (totalTextItems === 0) return null;

    const header = runningLines(headerByPage);
    const footer = runningLines(footerByPage);
    if (header.length === 0 && footer.length === 0) return null;

    const confidentiality = [...header, ...footer].map(l => l.match(CONFIDENTIALITY_RE)?.[0]).find(Boolean);

    return {
      header,
      footer,
      pageNumberPattern: detectPageNumberPattern([...headerByPage, ...footerByPage]),
      confidentiality: confidentiality || undefined,
      fields: deriveFields(header, footer),
    };
  } catch {
    return null;
  }
}

/** How sure we are a detected heading is really a section heading. An explicit
 *  heading is set well above the body text; an inferred one only just clears the
 *  body size, so it's flagged for the human to confirm in the review canvas. */
export type DetectionEvidence = 'explicit' | 'inferred';

/** What kind of block a detection is. Text = a normal section heading; the rest
 *  are empty placeholders — a chart/figure, a KPI stat, or a table — whose numbers
 *  are filled from trusted query data at generation, never scraped from the PDF. */
export type DetectedKind = 'text' | 'kpi' | 'chart' | 'table';

/** A block detected in a report body, with the evidence behind it. For text it's a
 *  section heading with a snippet beneath (the review-canvas source preview); for
 *  kpi/chart/table it's an empty placeholder, optionally with the label it carried. */
export interface DetectedSection {
  name: string;
  evidence: DetectionEvidence;
  kind: DetectedKind;
  /** Up to a couple of body lines beneath the heading, for the source preview. */
  body: string[];
  /** For KPI/table placeholders — the label the block carried in the document. */
  metric?: string;
}

/** A report's full importable structure: its letterhead plus the section
 *  headings detected in the body. Used by the template editor's "Import from a
 *  report" action to pre-fill the outline + header/footer in one pass. */
export interface ReportStructure {
  headerFooter: ExtractedHeaderFooter | null;
  sections: DetectedSection[];
  /** Headings that had no body text beneath them — not auto-added (§4.5), but
   *  surfaced so the user can add them back if they're real sections. */
  skipped: string[];
}

// A body line is a section heading when it's set noticeably larger than the
// body text, short, and not a sentence (no trailing punctuation).
const HEADING_SIZE_RATIO = 1.18;
// Well above the body size → an explicit styled heading; only just above →
// inferred (flagged for review). Grounds the review canvas' evidence badge.
const EXPLICIT_SIZE_RATIO = 1.4;

// Caption patterns — "Figure 1:", "Chart 2 –", "Table 3.". A numbered label
// followed by punctuation is how real reports title a graph or table, so it's the
// most reliable placeholder signal (and won't fire on prose like "Figure 1 shows…").
const FIGURE_CAP_RE = /^(figure|fig\.?|chart|exhibit|graph|diagram)\s*\.?\s*[\divxlc]+\s*[:.\-–)]/i;
const TABLE_CAP_RE = /^(table|tbl\.?)\s*\.?\s*[\divxlc]+\s*[:.\-–)]/i;
// A KPI value: a bare number, optionally currency-prefixed and unit-suffixed
// ("94%", "$2.3M", "42", "1,204", "3.5x").
const KPI_VALUE_RE = /^[$£€]?\s?\d[\d,]*(\.\d+)?\s?(%|k|m|bn|x|pts?|days?|hrs?)?$/i;
// A KPI value is set larger than body text; a table row has at least this many cells.
const KPI_SIZE_RATIO = 1.25;
const TABLE_MIN_COLS = 3;
const TABLE_MIN_ROWS = 3;
// Minimum image size (share of page height) to count as a figure — filters logos/icons.
const MIN_FIGURE_FRAC = 0.06;
const MAX_BLOCKS = 40;

// 2D affine matrix product (both [a,b,c,d,e,f]) — used to track the CTM so image
// draws can be placed on the page.
function matMul(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

// Walk a page's operator list tracking the transform matrix, returning the vertical
// centre (PDF bottom-up coords) of every non-trivial raster image drawn on it — the
// "there's a figure here" signal. Best-effort: returns [] if the op list can't be read.
async function pageFigureYs(page: { getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }> }, OPS: Record<string, number>, pageH: number): Promise<number[]> {
  try {
    const { fnArray, argsArray } = await page.getOperatorList();
    const imageOps = new Set([OPS.paintImageXObject, OPS.paintJpegXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject]);
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    const ys: number[] = [];
    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) { const prev = stack.pop(); if (prev) ctm = prev; }
      else if (fn === OPS.transform) ctm = matMul(ctm, argsArray[i] as number[]);
      else if (imageOps.has(fn)) {
        const w = Math.hypot(ctm[0], ctm[1]);
        const h = Math.hypot(ctm[2], ctm[3]);
        // An image is drawn in the unit square, so its height on the page is |ctm d|
        // and its vertical centre is ctm[5] + h/2.
        if (w >= pageH * MIN_FIGURE_FRAC && h >= pageH * MIN_FIGURE_FRAC) ys.push(ctm[5] + h / 2);
      }
    }
    return ys;
  } catch {
    return [];
  }
}

// Strip a caption down to its title: drop the "Figure 1:" label prefix, keep the
// rest; fall back to the label itself when there's no title after it.
function cleanCaption(text: string): string {
  const stripped = text.replace(/^(figure|fig\.?|chart|exhibit|graph|diagram|table|tbl\.?)\s*\.?\s*[\divxlc]+\s*[:.\-–)]\s*/i, '').trim();
  return stripped || text.trim();
}

// x-tolerance for treating two text-item start positions as the same column.
const COL_TOL = 7;

/** How many columns recur across a group of rows — an x start-position that shows
 *  up (within COL_TOL) in at least 60% of the rows is a shared column. Tables have
 *  several; prose has only the left margin. */
function sharedColumns(rows: { xs: number[] }[]): number {
  if (!rows.length) return 0;
  const counts = new Map<number, number>();
  for (const r of rows) {
    const seenKeys = new Set<number>();
    for (const x of r.xs) {
      let key: number | null = null;
      for (const k of counts.keys()) if (Math.abs(k - x) <= COL_TOL) { key = k; break; }
      if (key === null) { key = x; counts.set(key, 0); }
      if (!seenKeys.has(key)) { seenKeys.add(key); counts.set(key, (counts.get(key) ?? 0) + 1); }
    }
  }
  const threshold = Math.max(2, Math.ceil(rows.length * 0.6));
  let cols = 0;
  for (const c of counts.values()) if (c >= threshold) cols++;
  return cols;
}

/** Find table bands on a page from the raw text items: baselines are grouped into
 *  rows, then maximal runs of multi-item rows that share ≥ TABLE_MIN_COLS aligned
 *  columns become a table. Catches tightly-packed tables that cell-gap splitting
 *  merges into one string — the common real-world failure. Returns [topY, bottomY]
 *  ranges (PDF bottom-up coords, so topY ≥ bottomY). */
function detectTableBands(items: { str: string; transform: number[] }[], pageH: number): [number, number][] {
  const rows: { y: number; xs: number[] }[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5];
    if (y >= pageH * (1 - BAND) || y <= pageH * BAND) continue; // body band only
    let row = rows.find(r => Math.abs(r.y - y) < 2);
    if (!row) { row = { y, xs: [] }; rows.push(row); }
    row.xs.push(it.transform[4]);
  }
  rows.sort((a, b) => b.y - a.y);          // top → bottom
  rows.forEach(r => r.xs.sort((a, b) => a - b));

  const bands: [number, number][] = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i].xs.length < TABLE_MIN_COLS) { i++; continue; }
    let j = i;
    while (
      j + 1 < rows.length &&
      rows[j + 1].xs.length >= TABLE_MIN_COLS &&
      sharedColumns(rows.slice(i, j + 2)) >= TABLE_MIN_COLS
    ) j++;
    if (j - i + 1 >= TABLE_MIN_ROWS && sharedColumns(rows.slice(i, j + 1)) >= TABLE_MIN_COLS) {
      bands.push([rows[i].y, rows[j].y]);
      i = j + 1;
    } else i++;
  }
  return bands;
}

/**
 * Read a PDF once and return both its letterhead (running header/footer) and the
 * section headings detected in the body — headings inferred from font size
 * relative to the body text. Returns null for non-PDF, oversize, or scanned files.
 */
export async function extractReportStructure(file: File): Promise<ReportStructure | null> {
  if (!/\.pdf$/i.test(file.name) || file.size > MAX_PARSE_BYTES) return null;
  try {
    const pdfjs = await getPdfjs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const pageCount = Math.min(doc.numPages, MAX_PAGES);

    const headerByPage: Line[][] = [];
    const footerByPage: Line[][] = [];
    const bodySizes: number[] = []; // all body cell sizes → median (heading/KPI test)
    const pageBody: Line[][] = [];   // per-page body lines, top→bottom
    const pageImageYs: number[][] = []; // per-page figure vertical centres
    const pageTableBands: [number, number][][] = []; // per-page column-aligned table y-ranges
    let totalTextItems = 0;

    for (let p = 1; p <= pageCount; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const H = viewport.height;
      const content = await page.getTextContent();
      const items = content.items as { str: string; transform: number[]; width?: number; height?: number }[];
      totalTextItems += items.length;
      const lines = itemsToLines(items, viewport.width);
      headerByPage.push(lines.filter(l => l.y >= H * (1 - BAND)));
      footerByPage.push(lines.filter(l => l.y <= H * BAND));
      // Body lines, top→bottom (PDF y is bottom-up, so sort descending).
      const body = lines
        .filter(l => l.y < H * (1 - BAND) && l.y > H * BAND)
        .sort((a, b) => b.y - a.y);
      body.forEach(l => bodySizes.push(l.size));
      pageBody.push(body);
      // Figures drawn on this page (raster images), kept to the body band.
      const figs = (await pageFigureYs(page, pdfjs.OPS as Record<string, number>, H))
        .filter(y => y < H * (1 - BAND) && y > H * BAND);
      pageImageYs.push(figs);
      // Column-aligned table bands on this page (catches tightly-packed tables).
      pageTableBands.push(detectTableBands(items, H));
    }

    await doc.destroy();
    if (totalTextItems === 0) return null;

    // Letterhead (same logic as extractPdfHeaderFooter).
    const header = runningLines(headerByPage);
    const footer = runningLines(footerByPage);
    const confidentiality = [...header, ...footer].map(l => l.match(CONFIDENTIALITY_RE)?.[0]).find(Boolean);
    const headerFooter: ExtractedHeaderFooter | null = (header.length || footer.length)
      ? {
          header,
          footer,
          pageNumberPattern: detectPageNumberPattern([...headerByPage, ...footerByPage]),
          confidentiality: confidentiality || undefined,
          fields: deriveFields(header, footer),
        }
      : null;

    // Median body size grounds the heading / KPI size tests.
    const sorted = bodySizes.slice().sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const runningSet = new Set([...header, ...footer].map(normalize));
    const isHeadingText = (t: string, size: number): boolean => {
      if (median > 0 && size < median * HEADING_SIZE_RATIO) return false;
      if (t.length < 2 || t.length > 80) return false;
      if (/[.,:;]$/.test(t)) return false;   // headings don't end in sentence punctuation
      if (PAGE_NUM_RE.test(t)) return false;
      if (runningSet.has(normalize(t))) return false;
      // Reject data-like rows: long digit runs (IDs, amounts) or digit-heavy text
      // are table/figure data that leaked past cell-splitting, not section titles.
      if (/\d{4,}/.test(t)) return false;
      const digitCount = (t.match(/\d/g) ?? []).length;
      if (digitCount / t.length > 0.25) return false;
      // Several standalone short numbers / dashes = table columns that merged into
      // one cell (a wide description bridging the number columns), not a heading.
      if ((t.match(/(?:^|\s)(?:\d{1,3}|-)(?=\s|$)/g) ?? []).length >= 3) return false;
      // Cells join without spaces, so a merged table row ends in jammed column
      // values ("…form".155-65"). A heading never ends in a run of digits/dashes.
      if (/\d[\d-]{2,}$/.test(t)) return false;
      return true;
    };

    // Group a page's body lines (already top→bottom) into rows — cells sharing a
    // baseline become one row, so a table row is a row with several cells.
    type Row = { y: number; cells: string[]; text: string; size: number };
    const toRows = (body: Line[]): Row[] => {
      const rows: Row[] = [];
      for (const l of body) {
        const last = rows[rows.length - 1];
        if (last && Math.abs(last.y - l.y) < 2) last.cells.push(l.text);
        else rows.push({ y: l.y, cells: [l.text], text: '', size: l.size });
        rows[rows.length - 1].size = Math.max(rows[rows.length - 1].size, l.size);
      }
      for (const r of rows) r.text = r.cells.join(' ').replace(/\s+/g, ' ').trim();
      return rows;
    };

    // One ordered stream of body elements across all pages, in reading order:
    // text rows interleaved with figure markers by vertical position. Rows inside a
    // detected table band carry that band's id so the walk collapses them into one
    // Table placeholder instead of misreading each data row as a heading.
    type El = { kind: 'row'; row: Row; band: string } | { kind: 'image' };
    const els: El[] = [];
    for (let p = 0; p < pageBody.length; p++) {
      const rows = toRows(pageBody[p]);
      const bands = pageTableBands[p] ?? [];
      const bandOf = (y: number): string => {
        const idx = bands.findIndex(([top, bot]) => y <= top && y >= bot);
        return idx < 0 ? '' : `p${p}-b${idx}`;
      };
      const imgs = pageImageYs[p] ?? [];
      const merged: { y: number; el: El }[] = [
        ...rows.map(r => ({ y: r.y, el: { kind: 'row', row: r, band: bandOf(r.y) } as El })),
        ...imgs.map(y => ({ y, el: { kind: 'image' } as El })),
      ].sort((a, b) => b.y - a.y); // top→bottom
      merged.forEach(m => els.push(m.el));
    }

    const seen = new Set<string>();       // text-heading dedup
    const seenSkip = new Set<string>();
    const sections: DetectedSection[] = [];
    const skipped: string[] = [];
    const consumed = new Set<number>();   // caption rows absorbed by an adjacent image
    const emittedBands = new Set<string>(); // table bands already turned into a placeholder
    let figCount = 0, tableCount = 0;
    const push = (s: DetectedSection) => { if (sections.length < MAX_BLOCKS) sections.push(s); };
    const rowAt = (i: number): Row | null => (i >= 0 && i < els.length && els[i].kind === 'row' ? (els[i] as { row: Row }).row : null);

    for (let i = 0; i < els.length; i++) {
      const el = els[i];

      // A figure (raster image). Name it from an adjacent figure caption if there is
      // one — and mark that caption consumed so it isn't emitted twice.
      if (el.kind === 'image') {
        figCount++;
        const above = rowAt(i - 1), below = rowAt(i + 1);
        let name = '';
        if (below && FIGURE_CAP_RE.test(below.text)) { name = cleanCaption(below.text); consumed.add(i + 1); }
        else if (above && FIGURE_CAP_RE.test(above.text)) { name = cleanCaption(above.text); consumed.add(i - 1); }
        push({ name: name || `Figure ${figCount}`, evidence: 'explicit', kind: 'chart', body: [] });
        continue;
      }

      // Rows inside a table band collapse into one Table placeholder (emitted at
      // the first row of the band); the rest of the band's rows are skipped, so
      // data rows never leak out as bogus headings.
      if (el.band) {
        if (!emittedBands.has(el.band)) {
          emittedBands.add(el.band);
          tableCount++;
          push({ name: `Table ${tableCount}`, evidence: 'inferred', kind: 'table', body: [] });
        }
        continue;
      }

      if (consumed.has(i)) continue;
      const r = el.row;
      const t = r.text;
      if (!t) continue;

      // Figure/chart caption with no adjacent image (e.g. a vector chart).
      if (FIGURE_CAP_RE.test(t)) { figCount++; push({ name: cleanCaption(t), evidence: 'explicit', kind: 'chart', body: [] }); continue; }

      // Table caption → a table placeholder. Absorb the body below it — gap-split
      // rows and/or a column-aligned band — so the same table isn't emitted twice.
      if (TABLE_CAP_RE.test(t)) {
        tableCount++;
        push({ name: cleanCaption(t), evidence: 'explicit', kind: 'table', body: [], metric: cleanCaption(t) });
        let j = i + 1;
        while (j < els.length) {
          const e = els[j];
          if (e.kind !== 'row') break;
          if (e.band) { emittedBands.add(e.band); j++; continue; }
          if (e.row.cells.length >= TABLE_MIN_COLS) { j++; continue; }
          break;
        }
        // Tolerate a header row between the caption and the detected band.
        for (let k = i + 1; k < Math.min(els.length, i + 8); k++) {
          const e = els[k];
          if (e.kind === 'row' && e.band) { emittedBands.add(e.band); break; }
          if (e.kind === 'image') break;
        }
        i = Math.max(i, j - 1);
        continue;
      }

      // KPI — a prominent numeric value, with the small line beneath as its label.
      if (r.cells.length === 1 && median > 0 && r.size >= median * KPI_SIZE_RATIO && KPI_VALUE_RE.test(t)) {
        const next = rowAt(i + 1);
        let label = '';
        if (next && next.cells.length === 1) {
          const nt = next.text;
          if (nt && nt.length <= 40 && !KPI_VALUE_RE.test(nt) && !FIGURE_CAP_RE.test(nt) && !TABLE_CAP_RE.test(nt)) { label = nt; i++; }
        }
        push({ name: label || t, evidence: 'explicit', kind: 'kpi', body: [], metric: label || t });
        continue;
      }

      // Structural table — a run of consecutive multi-column rows with no caption.
      if (r.cells.length >= TABLE_MIN_COLS) {
        let j = i, run = 0;
        while (rowAt(j) && rowAt(j)!.cells.length >= TABLE_MIN_COLS) { run++; j++; }
        if (run >= TABLE_MIN_ROWS) {
          tableCount++;
          push({ name: `Table ${tableCount}`, evidence: 'inferred', kind: 'table', body: [] });
          i = j - 1;
          continue;
        }
      }

      // Text section heading — a single-column run of text (multi-cell rows are
      // table rows, not headings). Captures up to two body lines for the preview.
      if (r.cells.length === 1 && isHeadingText(t, r.size)) {
        const key = normalize(t);
        if (seen.has(key)) continue;
        const body: string[] = [];
        for (let j = i + 1; j < els.length && body.length < 2; j++) {
          const nr = rowAt(j);
          if (!nr) break; // a figure ends the section's lead-in
          if (isHeadingText(nr.text, nr.size) || FIGURE_CAP_RE.test(nr.text) || TABLE_CAP_RE.test(nr.text)) break;
          if (nr.text) body.push(nr.text);
        }
        if (body.length > 0) {
          seen.add(key);
          const evidence: DetectionEvidence = median > 0 && r.size >= median * EXPLICIT_SIZE_RATIO ? 'explicit' : 'inferred';
          push({ name: t, evidence, kind: 'text', body });
        } else if (!seenSkip.has(key)) {
          seenSkip.add(key);
          skipped.push(t);
        }
      }
    }
    // A heading that appears empty once but has content elsewhere is a real section.
    const finalSkipped = skipped.filter(s => !seen.has(normalize(s)));

    return { headerFooter, sections, skipped: finalSkipped };
  } catch {
    return null;
  }
}
