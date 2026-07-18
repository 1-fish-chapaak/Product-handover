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
import type { RatingScale, RatingScaleLevel, WritingStyle, DataBlock, DataBlockKind } from './reportShared';
import { knownSectionFor } from './sectionSynonyms';

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
// An organisation name — used to pull the audited entity out of the letterhead.
const ENTITY_RE = /\b(ltd|limited|llp|inc\.?|pvt|private|corp(oration)?|gmbh|plc|& co)\b/i;

// ─── Size-independent heading signals ───
// A heading is often NOT larger than the body — it's bold, ALL-CAPS, or numbered.
// Relying on font size alone misses every such heading, so a fresh export (Word /
// Google Docs / letters) can detect zero sections. These text-shape signals catch
// headings the size test can't, so detection works on real documents, not just
// ones with an oversized heading font.

// A numbered section heading: "1 Introduction", "2.1 Scope", "3.2.4 Findings",
// optionally prefixed with a structural word. The trailing \p{L} requires a word
// after the number, so a bare "3" or a figure of "1,204" never qualifies.
const HEADING_NUM_RE = /^(?:section|part|chapter|step|phase)?\s*\d+(?:\.\d+)*[.):]?\s+\p{L}[\p{L} ]/iu;
// A lettered appendix / annexure heading: "Appendix A", "Annexure II — Evidence".
const HEADING_ALPHA_RE = /^(?:appendix|annex(?:ure)?|schedule|exhibit)\s+[A-Z0-9]{1,3}\b/i;
// A "Contents" / "Table of Contents" heading — navigation, never a section (AC27).
const CONTENTS_RE = /^(?:table of )?contents$/i;
// A table-of-contents ENTRY row: a section name that ends in a page number, or
// carries dotted / mid-dot leaders ("Findings …… 7"). Used to skip the TOC block.
const TOC_ENTRY_RE = /\.{3,}|…|·{2,}|\s+\d{1,4}$/;
// ALL-CAPS heading: at least two capital letters, no lowercase, reasonably short.
// "EXECUTIVE SUMMARY", "BACKGROUND & SCOPE". A body line is rarely fully upper-case.
const isAllCapsHeading = (t: string) => /[A-Z]{2}/.test(t) && !/\p{Ll}/u.test(t) && t.length <= 64;

interface Line { y: number; text: string; size: number }

/** Normalize a line for the repetition test: lowercase, collapse whitespace, and
 *  replace digit runs with "#" so "Page 3 of 12" and "Page 4 of 12" match. */
const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/\d+/g, '#').trim();

/** A comparable section key: drop a leading enumerator ("1.", "7.2", "Appendix A"),
 *  and any trailing dotted-leader + page number (a table-of-contents entry), then
 *  lowercase. Lets a TOC entry ("Executive Summary …… 2") match its body heading
 *  ("7 Executive Summary") so the TOC can drive the real section list (AC27). */
const sectionKey = (s: string) =>
  s
    .replace(/^\s*(?:(?:section|part|chapter|appendix|annex(?:ure)?|schedule|exhibit)\s+)?[0-9ivxlcm]+(?:[.)][0-9]+)*[.)]?\s+/i, '')
    .replace(/\s*(?:\.{2,}|·{2,}|…).*$/, '')
    .replace(/\s+\d{1,4}$/, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

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
      // Join the runs within a cell, inserting a space where there's a visible
      // horizontal gap between two runs and neither side already carries one.
      // pdf.js often splits a label and its value ("Report period" | "FY2026"),
      // or adjacent words / table sub-cells, into separate runs with no explicit
      // space glyph — a bare join() jams them into "Report periodFY2026". A gap
      // wider than a fraction of the em is the boundary a space would occupy.
      let text = '';
      cell.forEach((p, i) => {
        if (i > 0) {
          const prev = cell[i - 1];
          const em = p.size || prev.size || 4;
          // Estimate a run's advance when pdf.js reports no width (~half an em per
          // char), so a zero-width run doesn't defeat the gap test and jam its
          // neighbour ("Total48"). Insert a space when the gap is space-sized and
          // there isn't already a boundary space on either side.
          const prevW = prev.w > 0 ? prev.w : prev.str.length * em * 0.5;
          const g = p.x - (prev.x + prevW);
          if (g > em * 0.2 && !/\s$/.test(text) && !/^\s/.test(p.str)) text += ' ';
        }
        text += p.str;
      });
      text = text.replace(/\s+/g, ' ').trim();
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

  const entity = header.find(l => ENTITY_RE.test(l));
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
  /** The data blocks (Table / Graph / KPI) detected INSIDE this text section, in
   *  reading order (PRD: a section = heading + description + data blocks). Empty /
   *  absent = a pure prose section. */
  dataBlocks?: DataBlock[];
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
  /** The customer's assurance / rating scale, read from their appendix (Gap 3). */
  scale?: RatingScale;
  /** The writing style measured from the body prose, kept as generation
   *  constraints so generated prose matches how they write (Gap 3). */
  style?: WritingStyle;
}

// ─── Gap 3: reading meaning, not just structure ──────────────────────────────

// The assurance / rating words real reports grade against. A scale line reads
// "<level> [assurance/rating] <separator> <definition>" — a level term, an
// optional qualifier, then a dash/colon and the definition. Two or more of these
// (usually in an appendix) is the customer's scale.
const RATING_HEADING_RE = /\b((assurance|rating|grading|opinion|risk|priority)\s+(scale|levels?|definitions?|categories|framework|key)|scale of assurance|basis of (our )?(opinion|assurance)|rating (definitions|key))\b/i;
const RATING_LEVEL_RE = /^\s*(substantial|reasonable|moderate|limited|minimal|no|high|medium|low|satisfactory|adequate|partially satisfactory|needs improvement|unsatisfactory|significant|critical|major|minor|priority\s*\d|category\s*[a-e]|grade\s*[a-e]|red|amber|green)\b\s*(assurance|rating|risk|priority|control)?\s*[:\-–—]\s*(.+)$/i;

const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

/** Read the customer's assurance / rating scale from the report body — the level
 *  words and their definitions, usually in an appendix. Returns undefined unless
 *  at least two levels are found (a heading anchor or two defined levels guards
 *  against a stray sentence matching). Exported for testing. */
export function detectRatingScale(lines: string[]): RatingScale | undefined {
  const levels: RatingScaleLevel[] = [];
  let heading: string | undefined;
  for (const raw of lines) {
    const line = (raw ?? '').trim();
    if (!line) continue;
    if (!heading && RATING_HEADING_RE.test(line)) heading = line;
    const m = line.match(RATING_LEVEL_RE);
    if (m) {
      const label = titleCase([m[1], m[2]].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim());
      const definition = m[3]?.trim();
      if (label && !levels.some(l => l.label.toLowerCase() === label.toLowerCase())) {
        levels.push({ label, ...(definition ? { definition } : {}) });
      }
    }
  }
  const defined = levels.filter(l => l.definition).length;
  if (levels.length >= 2 && (heading || defined >= 2)) {
    return { levels: levels.slice(0, 6), ...(heading ? { heading } : {}) };
  }
  return undefined;
}

/** Measure how the report is written, as generation constraints: voice, tense,
 *  numbering scheme, how samples are stated, and whether people are named by role
 *  or name. Heuristic counts over the body prose. Exported for testing. */
export function measureWritingStyle(corpus: string, sectionNames: string[]): WritingStyle | undefined {
  if (!corpus || corpus.length < 200) return undefined; // too little text to measure
  const text = corpus.toLowerCase();
  const count = (re: RegExp) => (corpus.match(re) ?? []).length;
  const countL = (re: RegExp) => (text.match(re) ?? []).length;

  const firstPlural = countL(/\b(we|our|us)\b/g);
  const thirdPerson = countL(/\b(the auditor|the review|the team|it was found|management (has|have|is|are))\b/g);
  const past = countL(/\b(was|were|had|found|identified|noted|observed|reviewed|tested|reported|assessed)\b/g);
  const present = countL(/\b(is|are|has|have|finds|identifies|notes|observes|reviews|tests|assesses)\b/g);
  const countOf = count(/\b\d+\s+of\s+\d+\b/gi);
  const pct = count(/\b\d+(?:\.\d+)?\s?%/g);
  const roles = countL(/\b(manager|head of|director|officer|controller|committee|the board|department|function|team lead)\b/g);
  const names = count(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g);

  // Heading numbering depth, from the detected section names ("7.3.1 …").
  const depths = sectionNames
    .map(n => n.match(/^\s*(\d+(?:\.\d+)*)/)?.[1])
    .filter((n): n is string => !!n)
    .map(n => n.split('.').length);
  const maxDepth = depths.length ? Math.max(...depths) : 0;

  const style: WritingStyle = {
    voice: firstPlural > 0 && firstPlural >= thirdPerson ? 'first-plural' : 'third-person',
    tense: past >= present ? 'past' : 'present',
    personNaming: roles >= names ? 'roles' : 'names',
  };
  if (maxDepth >= 3) style.numbering = '7.3.1';
  else if (maxDepth === 2) style.numbering = '7.3';
  else if (maxDepth === 1) style.numbering = '1.';
  if (countOf > 0 || pct > 0) style.sampleFormat = countOf >= pct ? 'count-of-total' : 'percentage';
  return style;
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

    // Running header / footer (repeats across pages). The merged headerFooter is
    // assembled after the cover-block pass below, so the cover letterhead (which
    // lives on page 1 and never repeats) can feed the header/title/entity too.
    const header = runningLines(headerByPage);
    const footer = runningLines(footerByPage);

    // Median body size grounds the heading / KPI size tests.
    const sorted = bodySizes.slice().sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const runningSet = new Set([...header, ...footer].map(normalize));
    // Score a single-column line as a section heading. Returns null when it isn't
    // one; otherwise `strong` marks a confident, size-independent signal (numbered,
    // appendix, ALL-CAPS, or clearly oversized) that can stand as a section even
    // with no lead paragraph beneath it. A line that only just clears the size
    // ratio is weak — kept only when it leads into body text (guards against noise).
    const headingSignal = (t: string, size: number): { strong: boolean; evidence: DetectionEvidence } | null => {
      if (t.length < 2 || t.length > 90) return null;
      if (/[.,:;]$/.test(t)) return null;    // headings don't end in sentence punctuation
      if (PAGE_NUM_RE.test(t)) return null;
      // Never a section (AC28 — never a dump): a print/page marker ("PAGE 1",
      // "PAGE 2 — Overview") is navigation, not a report section.
      if (/^page\s+\d+\b/i.test(t)) return null;
      // Never a section: a dash / bullet sub-item ("— Create a template", "• Key
      // definitions") is a nested list entry under a real heading, not a top-level
      // section. Covers every dash variant (hyphen, en/em/figure/bar dash, minus) and
      // common bullets. An em-dash INSIDE a title ("Scope — Objectives") is unaffected.
      if (/^\s*[\p{Pd}\u2022\u00b7\u2219\u25cf\u25cb\u25e6\u25aa\u2212*]\s/u.test(t)) return null;
      if (runningSet.has(normalize(t))) return null;
      // Reject data-like rows: long digit runs (IDs, amounts) or digit-heavy text
      // are table/figure data that leaked past cell-splitting, not section titles.
      // (0.35 tolerance so "2.1.3 Scope"-style numbered headings still qualify.)
      if (/\d{4,}/.test(t)) return null;
      const digitCount = (t.match(/\d/g) ?? []).length;
      if (digitCount / t.length > 0.35) return null;
      // Several standalone short numbers / dashes = table columns that merged into
      // one cell (a wide description bridging the number columns), not a heading.
      if ((t.match(/(?:^|\s)(?:\d{1,3}|-)(?=\s|$)/g) ?? []).length >= 3) return null;
      // Cells join without spaces, so a merged table row ends in jammed column
      // values ("…form".155-65"). A heading never ends in a run of digits/dashes.
      if (/\d[\d-]{2,}$/.test(t)) return null;
      // Signals — any one qualifies the line as a heading. Size is only one of them,
      // so a bold/caps/numbered heading at body size is no longer invisible.
      const explicitBig = median > 0 && size >= median * EXPLICIT_SIZE_RATIO;
      const big = median > 0 && size >= median * HEADING_SIZE_RATIO;
      const numbered = HEADING_NUM_RE.test(t);
      const alpha = HEADING_ALPHA_RE.test(t);
      const caps = isAllCapsHeading(t);
      if (!big && !numbered && !alpha && !caps) return null;
      const strong = numbered || alpha || caps || explicitBig;
      return { strong, evidence: strong ? 'explicit' : 'inferred' };
    };
    const isHeadingText = (t: string, size: number): boolean => headingSignal(t, size) !== null;

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

    // ── Cover-page letterhead block ──────────────────────────────────────────
    // A report's cover carries its title, entity and confidentiality line in the
    // BODY band (below the top-margin header band), so the section walk would emit
    // them as bogus sections while the running-header pass (which skips page 1)
    // never captures them. Pull that leading block off page 1 and treat it as
    // letterhead: title → name, entity → brand, confidentiality → header. Its
    // lines are added to coverSet so the walk skips them (no phantom sections).
    const coverSet = new Set<string>();
    const coverLines: { text: string; size: number }[] = [];
    // Whether the cover block ended at a real section heading (a known section name,
    // a numbered/appendix heading, or an ALL-CAPS heading). When it does, the whole
    // leading block before it is cover front-matter — title + subtitle + report
    // period + "Prepared by" + date — and none of it is a section (AC26 / E16).
    let coverEndedOnSection = false;
    if (pageBody.length > 0) {
      for (const r of toRows(pageBody[0])) {
        // A columned row AFTER the title ends the block (body/table begins). The title
        // row itself often shares its baseline with a logo, a doc number, or a date, so
        // it can read as multi-cell — don't let that abort the whole cover block and
        // dump the title + subtitle into the sections (AC26 / E16).
        if (coverLines.length > 0 && r.cells.length !== 1) break;
        const t = r.text;
        if (!t || PAGE_NUM_RE.test(t)) continue;
        if (t.length > 90 || /[.,:;]$/.test(t)) break;   // sentence-like → body prose begins
        // A "Contents" page ends the cover block so the section walk handles the table
        // of contents (AC27) — otherwise the cover loop would swallow "Contents" and its
        // entries, and the walk would never see them as the section list.
        if (CONTENTS_RE.test(normalize(t))) { coverEndedOnSection = true; break; }
        // A recognised section name after the title ("Executive Summary", "Scope")
        // is the FIRST real section, so it ends the cover block whatever its case
        // (AC26: the first section is the first heading after the cover front-matter).
        if (coverLines.length > 0 && knownSectionFor(t)) { coverEndedOnSection = true; break; }
        // A numbered / appendix heading ("1 Introduction", "Appendix A") is a real
        // body section, never a title — it ends the letterhead block.
        if (HEADING_NUM_RE.test(t) || HEADING_ALPHA_RE.test(t)) { coverEndedOnSection = true; break; }
        // An ALL-CAPS heading ends the block too — EXCEPT the report TITLE, which is
        // often ALL-CAPS and sits first ("AUDIT OF FINANCIAL CONTROLS"). A title is
        // never a section (PRD: sections are read only from the body), so the first
        // ALL-CAPS line is captured as the title unless it's a recognised section
        // name (e.g. "EXECUTIVE SUMMARY"), which is a real section and ends the block.
        if (isAllCapsHeading(t) && !CONFIDENTIALITY_RE.test(t) && (coverLines.length > 0 || knownSectionFor(t))) { coverEndedOnSection = true; break; }
        coverLines.push({ text: t, size: r.size });
        coverSet.add(normalize(t));
        if (coverLines.length >= 8) break;               // a letterhead block is short
      }
    }
    // Only trust it as a full letterhead when it reads like one — an oversized title
    // line, an entity, a confidentiality tag, or a reporting-period line.
    const coverMedian = bodySizes.length ? median : 0;
    const looksLikeLetterhead = coverLines.some(l =>
      (coverMedian > 0 && l.size >= coverMedian * HEADING_SIZE_RATIO) ||
      ENTITY_RE.test(l.text) || CONFIDENTIALITY_RE.test(l.text));
    // Keep the whole leading block as cover front-matter when it cleanly transitioned
    // into a real section (title + subtitle + byline all belong to the cover, never a
    // section — AC26 / E16). Only when the block ended ambiguously (prose, a columned
    // row) AND it doesn't read like a letterhead do we fall back to keeping just the
    // title, letting the rest go to the section walk.
    if (!looksLikeLetterhead && !coverEndedOnSection) {
      const title = coverLines[0];
      coverSet.clear();
      coverLines.length = 0;
      if (title) { coverLines.push(title); coverSet.add(normalize(title.text)); }
    }

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
    // The section keys listed in a table of contents. When non-empty it is the
    // authoritative list of the report's real sections — the body scan is filtered to
    // it, so a Contents page + nested sub-headings yields the real ~5–12, not a dump (AC27).
    const tocSections = new Set<string>();
    const sections: DetectedSection[] = [];
    const skipped: string[] = [];
    const consumed = new Set<number>();   // caption rows absorbed by an adjacent image
    const emittedBands = new Set<string>(); // table bands already turned into a placeholder
    let figCount = 0, tableCount = 0, blockCount = 0;
    const push = (s: DetectedSection) => { if (sections.length < MAX_BLOCKS) sections.push(s); };
    const rowAt = (i: number): Row | null => (i >= 0 && i < els.length && els[i].kind === 'row' ? (els[i] as { row: Row }).row : null);
    // A data block (Table / Graph / KPI) belongs INSIDE the section it sits under —
    // it attaches to the current text section's dataBlocks, not as its own section
    // (PRD: a section = heading + description + data blocks). A block seen before any
    // heading (rare) falls back to its own placeholder section so nothing is lost.
    const MAX_BLOCKS_PER_SECTION = 12;
    let currentText: DetectedSection | null = null;
    const addBlock = (kind: DataBlockKind, label?: string, chartType?: 'bar' | 'line') => {
      if (currentText) {
        const blocks = (currentText.dataBlocks ??= []);
        if (blocks.length >= MAX_BLOCKS_PER_SECTION) return;
        blocks.push({ id: `blk-${blockCount++}`, kind, ...(label ? { label } : {}), ...(chartType ? { chartType } : {}) });
      } else {
        push({ name: label || (kind === 'graph' ? 'Chart' : kind === 'kpi' ? 'KPI' : 'Table'), evidence: 'inferred', kind: kind === 'graph' ? 'chart' : kind, body: [] });
      }
    };

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
        addBlock('graph', name || undefined);
        continue;
      }

      // Rows inside a table band collapse into one Table placeholder (emitted at
      // the first row of the band); the rest of the band's rows are skipped, so
      // data rows never leak out as bogus headings.
      if (el.band) {
        if (!emittedBands.has(el.band)) {
          emittedBands.add(el.band);
          tableCount++;
          addBlock('table', `Table ${tableCount}`);
        }
        continue;
      }

      if (consumed.has(i)) continue;
      const r = el.row;
      const t = r.text;
      if (!t) continue;
      // Cover-page letterhead (title / entity / confidentiality) → not a section.
      if (coverSet.has(normalize(t))) continue;

      // Figure/chart caption with no adjacent image (e.g. a vector chart).
      if (FIGURE_CAP_RE.test(t)) { figCount++; addBlock('graph', cleanCaption(t)); continue; }

      // Table caption → a table placeholder. Absorb the body below it — gap-split
      // rows and/or a column-aligned band — so the same table isn't emitted twice.
      if (TABLE_CAP_RE.test(t)) {
        tableCount++;
        addBlock('table', cleanCaption(t));
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
        addBlock('kpi', label || t);
        continue;
      }

      // Structural table — a run of consecutive multi-column rows with no caption.
      if (r.cells.length >= TABLE_MIN_COLS) {
        let j = i, run = 0;
        while (rowAt(j) && rowAt(j)!.cells.length >= TABLE_MIN_COLS) { run++; j++; }
        if (run >= TABLE_MIN_ROWS) {
          tableCount++;
          addBlock('table', `Table ${tableCount}`);
          i = j - 1;
          continue;
        }
      }

      // Text section heading — a single-column run of text (multi-cell rows are
      // table rows, not headings). Captures up to two body lines for the preview.
      const sig = r.cells.length === 1 ? headingSignal(t, r.size) : null;
      if (sig) {
        const key = normalize(t);
        if (seen.has(key)) continue;
        // AC27 / E17 — a table of contents is navigation, never a section. Skip the
        // "Contents" heading and the TOC entry rows beneath it (name + page number /
        // dotted leader) so the list of pages isn't emitted as sections.
        if (CONTENTS_RE.test(key)) {
          let j = i + 1;
          while (j < els.length) {
            const nr = rowAt(j);
            if (!nr || !TOC_ENTRY_RE.test(nr.text)) break;
            // Record the entry's section name — this list is the authoritative set
            // of real sections the body scan is filtered against.
            const k = sectionKey(nr.text);
            if (k && k.length >= 3) tocSections.add(k);
            j++;
          }
          i = j - 1;
          continue;
        }
        // AC27 / E17 — skip deep sub-headings (three or more numbering levels, e.g.
        // "7.2.1"); a report's real sections are its top-level headings, not every
        // nested point, so a normal report yields about 5–12, not a 22-heading dump.
        const numGroup = t.match(/^(?:section|part|chapter|step|phase)?\s*(\d+(?:\.\d+)+)/i)?.[1];
        if (numGroup && numGroup.split('.').length >= 3) continue;
        const body: string[] = [];
        for (let j = i + 1; j < els.length && body.length < 2; j++) {
          const nr = rowAt(j);
          if (!nr) break; // a figure ends the section's lead-in
          if (isHeadingText(nr.text, nr.size) || FIGURE_CAP_RE.test(nr.text) || TABLE_CAP_RE.test(nr.text)) break;
          if (nr.text) body.push(nr.text);
        }
        // Keep it when it leads into body text, OR when the signal is strong on its
        // own (numbered / appendix / ALL-CAPS / clearly oversized) — a strong heading
        // whose next line is another heading is a real section (nested outline), not
        // a stray line. Weak size-only headings still need body to avoid noise.
        if (body.length > 0 || sig.strong) {
          seen.add(key);
          const sec: DetectedSection = { name: t, evidence: sig.evidence, kind: 'text', body };
          push(sec);
          currentText = sec;
        } else if (!seenSkip.has(key)) {
          seenSkip.add(key);
          skipped.push(t);
        }
      }
    }
    // AC27 — when a table of contents is present, it is the authoritative section
    // list: keep only the body headings that the TOC names, dropping stray bold lines
    // and nested sub-headings the TOC doesn't list. Guarded — if the TOC wording
    // doesn't match the body (so almost nothing survives), fall back to the full scan
    // rather than emit an empty template.
    if (tocSections.size > 0) {
      const kept = sections.filter(s => tocSections.has(sectionKey(s.name)));
      if (kept.length >= Math.min(3, tocSections.size)) {
        sections.splice(0, sections.length, ...kept);
      }
    } else {
      // AC28 / §5 — no table of contents, so the real sections are the TOP-LEVEL
      // numbered headings. The shallowest numbering depth present is the section
      // level; anything deeper is a sub-point ("7.1 nested under 7"), never a section.
      // Unnumbered headings (Executive Summary, Findings…) are unaffected. Keeps the
      // output to the real sections instead of a dump the auditor has to trim.
      const depthOf = (name: string): number => {
        const m = name.match(/^\s*(?:section|part|chapter)?\s*(\d+(?:\.\d+)*)/i);
        return m ? m[1].split('.').length : 0;
      };
      const numberedDepths = sections.map(s => depthOf(s.name)).filter(d => d > 0);
      if (numberedDepths.length > 0) {
        const topLevel = Math.min(...numberedDepths);
        const kept = sections.filter(s => { const d = depthOf(s.name); return d === 0 || d <= topLevel; });
        if (kept.length > 0) sections.splice(0, sections.length, ...kept);
      }
    }

    // A heading that appears empty once but has content elsewhere is a real section.
    const finalSkipped = skipped.filter(s => !seen.has(normalize(s)));

    // Assemble the letterhead from the running header/footer AND the cover block.
    // Field derivation sees the cover lines too, so a cover-only title/entity is
    // captured (title → name, entity → brand) instead of leaking in as a section.
    const coverTexts = coverLines.map(l => l.text);
    const confidentiality = [...header, ...footer, ...coverTexts]
      .map(l => l.match(CONFIDENTIALITY_RE)?.[0]).find(Boolean);
    const fields = deriveFields([...header, ...coverTexts], footer);
    // The report title is the cover's most prominent (largest) line — the template
    // name. This RANKS BY FONT SIZE, which beats deriveFields' length ranking: a title
    // ("Internal Audit Report") is shorter than its subtitle ("Revenue Recognition &
    // Financial Controls Review"), so length would wrongly name the report after the
    // subtitle. The largest cover line wins whenever the cover yielded one.
    const coverTitle = [...coverLines]
      .filter(l => !CONFIDENTIALITY_RE.test(l.text) && !ENTITY_RE.test(l.text) && !PAGE_NUM_RE.test(l.text) && l.text.length >= 4)
      .sort((a, b) => b.size - a.size)[0]?.text;
    if (coverTitle) fields.auditTitle = coverTitle;
    // The header field is the letterhead strip — the confidentiality line if present,
    // otherwise the running header lines (cover title/entity go to name/brand, not here).
    const headerFooter: ExtractedHeaderFooter | null = (header.length || footer.length || coverLines.length)
      ? {
          header,
          footer,
          pageNumberPattern: detectPageNumberPattern([...headerByPage, ...footerByPage]),
          confidentiality: confidentiality || undefined,
          fields,
        }
      : null;

    // Gap 3 — read meaning, not just structure: the assurance scale (from the
    // appendix) and the writing style (from the body prose), captured as template
    // constraints. Both operate on the full body text gathered above.
    const allBodyLines = pageBody.flat().map(l => l.text);
    const scale = detectRatingScale(allBodyLines);
    const style = measureWritingStyle(
      allBodyLines.join(' '),
      sections.filter(s => s.kind === 'text').map(s => s.name),
    );

    return { headerFooter, sections, skipped: finalSkipped, ...(scale ? { scale } : {}), ...(style ? { style } : {}) };
  } catch {
    return null;
  }
}
