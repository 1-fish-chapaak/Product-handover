// ─── BYOT extraction engine ───
// "Bring Your Own Template": the client uploads one finished report (PDF), we
// read its SHAPE and throw away its WORDS AND NUMBERS. The one rule: extraction
// keeps the skeleton, never the content — section order, headings, tables,
// ratings, branding survive; their actual findings and figures are discarded.
//
// The engine reads the file six times; each pass answers exactly one question,
// so when detection goes wrong we can point at which pass failed:
//   1. Unpack           — what text pieces exist, and where do they sit?
//   2. Remove furniture — which lines repeat on every page? Lift them out and
//                         store them as pre-filled template settings.
//   3. Build the tree   — which lines are headings, at which level? Sections
//                         contain blocks; numbering depth is the clue.
//   4. Classify blocks  — paragraph, table, stat strip, slot, callout, chart?
//   5. Spot repeats     — same shape 2+ times → one repeating card, count
//                         discarded. Nothing repeating is also a valid result.
//   6. Label it         — structure-only naming: section purpose, fill case,
//                         rating scale, confidence. Never numbers, never new
//                         sections.
// Rules first, AI last: geometry decides WHAT EXISTS, labelling decides WHAT TO
// CALL IT.

import { getPdfjs } from '../data-sources/datasetFiles';
import type { BlockFill, SectionFill, DataBinding, TemplateBlock } from './reportShared';

// ═══ Model ═══════════════════════════════════════════════════════════════════
// The block model itself (BlockFill / SectionFill / DataBinding / TemplateBlock)
// lives in reportShared — templates persist it; the engine produces it.

export type { BlockFill, SectionFill, DataBinding };

export type DetectionEvidence = 'explicit' | 'inferred';

/** A detected block: the persisted TemplateBlock shape plus the detection
 *  facts the review screen needs (confidence, page, source preview). */
export interface ExtractedBlock extends TemplateBlock {
  /** How sure pass 4/5 is (0–1) — grounds the review screen's "check this". */
  confidence: number;
  /** 1-based page the block starts on — drives jump-to-page in review. */
  page?: number;
  /** Up to two source lines, review-screen preview only — never persisted. */
  preview?: string[];
}

export interface ExtractedSection {
  name: string;
  /** One-line purpose, ALWAYS pre-filled by pass 6 — never an empty prompt. */
  description: string;
  fill: SectionFill;
  /** Why the engine guessed this fill case — one plain-words line of evidence
   *  the user checks instead of reasoning about abstract options. Review-only. */
  fillReason?: string;
  binding?: DataBinding;
  blocks: ExtractedBlock[];
  evidence: DetectionEvidence;
  confidence: number;
  page?: number;
  appendix?: boolean;
  /** Carrier paperwork around the real report (committee cover pages) —
   *  excluded with one confirmation question in review, never silently. */
  wrapper?: boolean;
  /** Body lines under the heading — review-screen source preview only. */
  source?: string[];
}

/** Pass 2's output, stored as pre-filled values the user verifies in template
 *  settings instead of typing them in. */
export interface ExtractedFurniture {
  header: string[];
  footer: string[];
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

/** The only valid sanity check — relative, never absolute: our section list vs
 *  the report's own table of contents. A 40-section report with a 40-entry TOC
 *  is correct, not a failure. */
export interface TocCheck {
  docEntries: number;
  detected: number;
  verdict: 'match' | 'over-split' | 'under-detected';
}

export interface ExtractedTemplate {
  furniture: ExtractedFurniture | null;
  sections: ExtractedSection[];
  /** Headings with no body beneath — not auto-added, never silently dropped. */
  skipped: string[];
  pageCount: number;
  /** Page snapshots (JPEG data URLs) for the review screen — transient. */
  pages?: string[];
  snapshotLimit: number;
  /** The document's own rating language — saved as template settings. */
  findingScale?: string[];
  opinionScale?: string[];
  /** Dominant saturated colour from the cover — the brand-colour candidate. */
  coverColor?: string;
  toc?: TocCheck;
}

/** Why an extraction was declined — each reason gets its own honest message,
 *  never a silent failure. */
export type ExtractFailReason = 'not-pdf' | 'too-large' | 'password' | 'scanned' | 'too-long' | 'unreadable';
export type ExtractOutcome =
  | { ok: true; template: ExtractedTemplate }
  | { ok: false; reason: ExtractFailReason; pageCount?: number };

// ═══ Guardrails ═══════════════════════════════════════════════════════════════

const MAX_PARSE_BYTES = 30 * 1024 * 1024; // parsing bigger inline locks the tab
/** "Upload a representative report" — a 300-page pack isn't a template. */
const PAGE_CAP = 50;
const SNAPSHOT_MAX = 24;
const SNAPSHOT_WIDTH = 520;
const MAX_SECTIONS = 48;

// ═══ Clues — the hints the engine reads (a PDF never says "this is a heading") ═

// Fraction of page height treated as the header/footer margin band.
const BAND = 0.08;
// A line is "running furniture" when it recurs on this share of pages.
const REPEAT_RATIO = 0.6;

const PAGE_NUM_RE = /^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i;
const PAGE_NUM_TOKEN_RE = /\b(page\s*\d+(\s*of\s*\d+)?|\d+\s*\/\s*\d+)\b/i;
const CONFIDENTIALITY_RE = /\b(strictly confidential|confidential|internal use only|for internal use|restricted|private and confidential|draft)\b/i;
const ENTITY_RE = /\b(ltd|limited|llp|inc\.?|pvt|private|corp(oration)?|gmbh|plc|& co|council|authority|trust)\b/i;

// Numbering: "1 Introduction", "2.1 Scope" — the number gives order AND level.
const HEADING_NUM_RE = /^(?:section|part|chapter|step|phase)?\s*(\d+(?:\.\d+)*)[.):]?\s+\p{L}[\p{L} ]/iu;
// Letters mean appendix: "Appendix A", "Annexure II — Evidence".
const HEADING_ALPHA_RE = /^(?:appendix|annex(?:ure)?|schedule|exhibit)\s+[A-Z0-9]{1,3}\b/i;
const isAllCapsHeading = (t: string) => /[A-Z]{2}/.test(t) && !/\p{Ll}/u.test(t) && t.length <= 64;

// Sizes relative to the body median: bigger text is probably a heading.
const HEADING_SIZE_RATIO = 1.18;
const EXPLICIT_SIZE_RATIO = 1.4;
const KPI_SIZE_RATIO = 1.25;

// Captions: "Figure 1:", "Table 3 –" — a numbered label + punctuation.
const FIGURE_CAP_RE = /^(figure|fig\.?|chart|exhibit|graph|diagram)\s*\.?\s*[\divxlc]+\s*[:.\-–)]/i;
const TABLE_CAP_RE = /^(table|tbl\.?)\s*\.?\s*[\divxlc]+\s*[:.\-–)]/i;
// A KPI value: "94%", "$2.3M", "1,204", "3.5x".
const KPI_VALUE_RE = /^[$£€₹]?\s?\d[\d,]*(\.\d+)?\s?(%|k|m|bn|cr|x|pts?|days?|hrs?)?$/i;
const TABLE_MIN_COLS = 3;
const TABLE_MIN_ROWS = 3;
const MIN_FIGURE_FRAC = 0.06;

// A finding-card ID: "IA-26-H01 —", "OBS-04:". Letters + separators + digits.
const CARD_ID_RE = /^([A-Z]{1,5}(?:[-/][A-Z0-9]{1,6}){1,4})\b/;
const CARD_WORD_RE = /^(finding|observation|issue|exception)\s+(\d{1,3})\b/i;
const CARD_LABEL_RE = /^([A-Z][A-Za-z /&']{2,30}):(\s|$)/;
// Boxes only a real person may fill — the AI is banned from writing these.
const HUMAN_FIELD_RE = /\bmanagement('s)?\s+(response|reply|comments?|action)|auditee('s)?\s+(response|comments?)|signature\b/i;
// Fixed text: formal words that must print word-for-word (paraphrasing a
// conformance statement changes its meaning and its validity).
const FIXED_RE = /\b((rating|grading|risk|classification)\s+(definitions?|scale|criteria|matrix)|how to read|glossary|definitions|disclaimer|limitations?\s+(of|on)|basis of (preparation|opinion)|conformance|distribution (list|statement))\b/i;
// Human-input sections: real people's decisions and words — never guessed.
const HUMAN_SECTION_RE = /\b(objectives?\b|scope\b|in[\s-]?scope|out[\s-]?of[\s-]?scope|management('s)?\s+(response|comments?)|area under review)\b/i;
// Boilerplate that's mostly identical every audit — captured as fixed text.
const INTRO_RE = /\b(introduction|background|about (the|this)|overview of)\b/i;
const SIGNOFF_RE = /\bsign[\s-]?offs?\b|\bsignatures?\b|\bapprovals?\s*(&|and)?\s*(sign[\s-]?off)?\b/i;
const ROLE_RE = /\b((prepared|reviewed|approved|authori[sz]ed|noted|issued)\s+by)\b/i;
// A section spilling onto the next page must merge into one section, not two.
const CONTINUED_RE = /\s*[([]?\s*(continued|cont'?d)\s*[)\]]?\s*$/i;
// The report's own contents page — never copied (our TOC engine rebuilds it),
// but its entry count is the sanity check for our section list.
const TOC_HEAD_RE = /^(table of )?contents$/i;
const TOC_ROW_RE = /\.{3,}\s*\d{1,3}$|\s{2,}\d{1,3}$/;
// Carrier paperwork around the real report (committee forms) — wrapper fold.
const WRAPPER_RE = /\b(committee|cabinet|agenda item|financial implications|legal implications|equalit(y|ies) (implications|impact)|ward(s)? affected|contact officer|background papers|recommendation to (the )?(board|council))\b/i;
// A callout: text set apart as a note or key message.
const CALLOUT_RE = /^(note|important|key (point|message|takeaway)|nb|remember|caution|warning)\b[:\s]/i;
// Bold font names — boldness is a heading clue size alone can't give.
const BOLD_FONT_RE = /bold|black|heavy|semibold|demi|[789]00/i;

// Concepts our query data can fill — the data-binding guess (pass 6).
const BIND_FINDINGS_RE = /\bfindings?|observations?|exceptions?|issues?|detailed (observations|results)|testing results?\b/i;
const BIND_SUMMARY_RE = /\bexecutive summary|summary of|opinion|conclusion\b/i;
const BIND_METRICS_RE = /\bat a glance|kpi|key (metrics|figures|statistics)|dashboard\b/i;
const BIND_ACTIONS_RE = /\baction plan|remediation|agreed actions|management action\b/i;
// Data our queries never produce — kept, rendered empty, honestly marked.
const NO_DATA_RE = /\b(revenue|turnover|profit|margin|balance sheet|cash ?flow|segment|financial statement|ratio|income statement)\b/i;

// Known rating vocabularies — appendix A literally defines their language.
const FINDING_SCALE_SETS: string[][] = [
  ['Critical', 'High', 'Medium', 'Low'],
  ['High', 'Medium', 'Low'],
  ['Major', 'Moderate', 'Minor'],
  ['Priority 1', 'Priority 2', 'Priority 3'],
];
const OPINION_SCALE_SETS: string[][] = [
  ['Effective', 'Generally Effective', 'Partially Effective', 'Ineffective'],
  ['Effective', 'Generally Effective', 'Needs Improvement', 'Unsatisfactory'],
  ['Satisfactory', 'Partially Satisfactory', 'Unsatisfactory'],
  ['Effective', 'Needs Improvement', 'Unsatisfactory'],
  ['Substantial', 'Reasonable', 'Limited', 'No'],
  ['Adequate', 'Needs Improvement', 'Inadequate'],
];

// ═══ Pass 1 — Unpack ═════════════════════════════════════════════════════════
// Every text piece comes out with its facts: words, page, position, size, bold.

interface Piece { str: string; x: number; y: number; w: number; size: number; bold: boolean }
interface PageData { width: number; height: number; pieces: Piece[]; figureYs: number[] }
interface Unpacked {
  pages: PageData[];
  pageCount: number;
  snapshots: string[];
  coverColor?: string;
  totalTextItems: number;
}

// 2D affine product — tracks the CTM so image draws can be placed on the page.
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

// Vertical centres of non-trivial raster images — the "there's a figure here"
// signal. Best-effort: [] if the operator list can't be read.
async function pageFigureYs(
  page: { getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }> },
  OPS: Record<string, number>,
  pageH: number,
): Promise<number[]> {
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
        if (w >= pageH * MIN_FIGURE_FRAC && h >= pageH * MIN_FIGURE_FRAC) ys.push(ctm[5] + h / 2);
      }
    }
    return ys;
  } catch {
    return [];
  }
}

// Dominant saturated colour on the rendered cover → the brand-colour candidate.
// Greys / near-white / near-black ignored; needs real presence to count.
function dominantCoverColor(canvas: HTMLCanvasElement): string | undefined {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; } catch { return undefined; }
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let sampled = 0;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    sampled++;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const v = max / 255, s = max === 0 ? 0 : (max - min) / max;
    if (s < 0.28 || v < 0.16 || v > 0.97) continue;
    let h = 0;
    if (max !== min) {
      if (max === r) h = ((g - b) / (max - min)) % 6;
      else if (max === g) h = (b - r) / (max - min) + 2;
      else h = (r - g) / (max - min) + 4;
      h = (h * 60 + 360) % 360;
    }
    const key = Math.floor(h / 15);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  let best: { n: number; r: number; g: number; b: number } | undefined;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  if (!best || sampled === 0 || best.n / sampled < 0.015) return undefined;
  const hex = (x: number) => Math.round(x / best!.n).toString(16).padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}

async function passUnpack(doc: {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    getTextContent: () => Promise<{ items: unknown[]; styles?: Record<string, { fontFamily?: string }> }>;
    getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
    render: (o: unknown) => { promise: Promise<unknown> };
  }>;
}, OPS: Record<string, number>): Promise<Unpacked> {
  const pages: PageData[] = [];
  const snapshots: string[] = [];
  let coverColor: string | undefined;
  let totalTextItems = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items as { str: string; transform: number[]; width?: number; height?: number; fontName?: string }[];
    totalTextItems += items.length;
    const styles = content.styles ?? {};
    const pieces: Piece[] = [];
    for (const it of items) {
      if (!it.str || !it.str.trim()) continue;
      const size = Math.hypot(it.transform[2] || 0, it.transform[3] || 0) || (it.height ?? 0);
      const fontKey = `${it.fontName ?? ''} ${styles[it.fontName ?? '']?.fontFamily ?? ''}`;
      pieces.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width ?? 0,
        size,
        bold: BOLD_FONT_RE.test(fontKey),
      });
    }
    const figureYs = (await pageFigureYs(page, OPS, viewport.height))
      .filter(y => y < viewport.height * (1 - BAND) && y > viewport.height * BAND);
    pages.push({ width: viewport.width, height: viewport.height, pieces, figureYs });

    // Page snapshots for the side-by-side review, and the cover's brand colour.
    // Best-effort — a render failure never fails the extraction.
    if (p <= SNAPSHOT_MAX && typeof document !== 'undefined') {
      try {
        const vp = page.getViewport({ scale: SNAPSHOT_WIDTH / viewport.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const cctx = canvas.getContext('2d');
        if (cctx) {
          await page.render({ canvasContext: cctx, viewport: vp, canvas }).promise;
          snapshots.push(canvas.toDataURL('image/jpeg', 0.74));
          if (p === 1) coverColor = dominantCoverColor(canvas);
        }
      } catch { /* snapshot is best-effort */ }
    }
  }
  return { pages, pageCount: doc.numPages, snapshots, coverColor, totalTextItems };
}

// ═══ Line assembly (shared by passes 2–4) ════════════════════════════════════

interface Line { y: number; x: number; text: string; size: number; bold: boolean }
interface Row { y: number; cells: Line[]; text: string; size: number; bold: boolean; page: number }

/** Normalize for the repetition test: lowercase, collapse whitespace, digits →
 *  '#' so "Page 3 of 12" and "Page 4 of 12" match. */
const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/\d+/g, '#').trim();

function stripPageNumber(text: string): { text: string; pattern?: string } {
  const m = text.match(PAGE_NUM_TOKEN_RE);
  if (!m) return { text };
  return {
    text: text.replace(PAGE_NUM_TOKEN_RE, '').replace(/\s+/g, ' ').trim(),
    pattern: /of|\//.test(m[0]) ? 'Page N of M' : 'Page N',
  };
}

/** Group pieces sharing a baseline into lines, splitting a baseline into cells
 *  across visible gaps — a gap wider than ~an em is a cell boundary (table
 *  cells, left "Confidential" vs right "Page 3 of 12"), smaller gaps are word
 *  spacing (which gets the space a bare join loses). The fine, em-based split
 *  is what keeps tightly packed table cells apart — alignment is a clue. */
function piecesToLines(pieces: Piece[]): Line[] {
  const rows: { y: number; parts: Piece[] }[] = [];
  for (const p of pieces) {
    const row = rows.find(r => Math.abs(r.y - p.y) < 2);
    if (row) row.parts.push(p);
    else rows.push({ y: p.y, parts: [p] });
  }
  const lines: Line[] = [];
  for (const r of rows) {
    const parts = r.parts.sort((a, b) => a.x - b.x);
    let cell: Piece[] = [];
    const flush = () => {
      if (cell.length === 0) return;
      let text = '';
      cell.forEach((p, i) => {
        if (i > 0) {
          const prev = cell[i - 1];
          const em = p.size || prev.size || 4;
          const prevW = prev.w > 0 ? prev.w : prev.str.length * em * 0.5;
          const g = p.x - (prev.x + prevW);
          if (g > em * 0.2 && !/\s$/.test(text) && !/^\s/.test(p.str)) text += ' ';
        }
        text += p.str;
      });
      text = text.replace(/\s+/g, ' ').trim();
      if (text) lines.push({ y: r.y, x: cell[0].x, text, size: Math.max(...cell.map(p => p.size)), bold: cell.some(p => p.bold) });
      cell = [];
    };
    parts.forEach((p, i) => {
      if (i > 0) {
        const prev = parts[i - 1];
        const em = p.size || prev.size || 4;
        // Estimate a run's advance when pdf.js reports no width, so a
        // zero-width run doesn't defeat the gap test.
        const prevW = prev.w > 0 ? prev.w : prev.str.length * em * 0.5;
        if (p.x - (prev.x + prevW) > Math.max(6, em * 0.9)) flush();
      }
      cell.push(p);
    });
    flush();
  }
  return lines;
}

/** Group a page's body lines (top→bottom) into rows: cells sharing a baseline
 *  become one row, so a table row is a row with several cells. */
function linesToRows(lines: Line[], page: number): Row[] {
  const sorted = [...lines].sort((a, b) => b.y - a.y);
  const rows: Row[] = [];
  for (const l of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - l.y) < 2) {
      last.cells.push(l);
      last.size = Math.max(last.size, l.size);
      last.bold = last.bold || l.bold;
    } else {
      rows.push({ y: l.y, cells: [l], text: '', size: l.size, bold: l.bold, page });
    }
  }
  for (const r of rows) {
    r.cells.sort((a, b) => a.x - b.x);
    r.text = r.cells.map(c => c.text).join(' ').replace(/\s+/g, ' ').trim();
  }
  return rows;
}

// ═══ Pass 2 — Remove furniture ═══════════════════════════════════════════════
// Header/footer text repeats in the margin bands across most pages. It's lifted
// out of reading (so it isn't misread as headings) and stored as pre-filled
// values the user simply verifies in template settings.

interface FurniturePassResult {
  furniture: ExtractedFurniture | null;
  /** Per-page body rows, furniture removed, top→bottom reading order. */
  bodyRows: Row[][];
  /** The running-line set — pass 3 skips anything matching it. */
  runningSet: Set<string>;
  /** Median body font size — grounds every relative size test. */
  median: number;
}

function runningLines(perPage: Line[][]): string[] {
  const n = perPage.length;
  if (n === 0) return [];
  // Exclude page 1 when there's more than one page — cover pages differ, and a
  // one-off cover title is content, not a running header.
  const pages = n > 1 ? perPage.slice(1) : perPage;
  const seen = new Map<string, { count: number; raw: string; order: number }>();
  let order = 0;
  pages.forEach(lines => {
    const onThisPage = new Set<string>();
    lines.forEach(l => {
      if (PAGE_NUM_RE.test(l.text)) return;
      const clean = stripPageNumber(l.text).text;
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

/** A letter-spaced display line ("M E R I D I A N") — an eyebrow, not a title. */
function isLetterSpaced(line: string): boolean {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 4) return false;
  return tokens.filter(t => t.length === 1).length / tokens.length > 0.5;
}

/** Best-effort metadata candidates out of the furniture lines — pre-filled
 *  template settings the user verifies instead of typing. */
function deriveFields(header: string[], footer: string[]): ExtractedFurniture['fields'] {
  const all = [...header, ...footer];
  const fields: ExtractedFurniture['fields'] = {};

  const entity = header.find(l => ENTITY_RE.test(l));
  if (entity) {
    const seg = entity.split(/\s*[·|]\s*|\s+[—–]\s+/).find(s => ENTITY_RE.test(s));
    fields.auditEntity = (seg ?? entity).trim();
  }

  const periodLine = all.find(l =>
    /\bQ[1-4]\b.*\bFY?\s?\d{2,4}/i.test(l) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\s*[–\-to]+\s*\w/i.test(l) ||
    /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\s*[–\-to]+\s*\d{1,2}/i.test(l));
  if (periodLine) fields.auditPeriod = periodLine;

  const ref = all.map(l =>
    l.match(/(?:ref(?:erence)?|doc(?:ument)?)\s*(?:no\.?|number|#|:)?\s*([A-Z][A-Z0-9][A-Z0-9\-/]*\d[A-Z0-9\-/]*)/i)?.[1]
    ?? l.match(/\b([A-Z]{2,}[-/][A-Z0-9\-/]*\d[A-Z0-9\-/]*)\b/)?.[1]
  ).find(Boolean);
  if (ref) fields.reportId = ref.trim();

  const prep = all.map(l => l.match(/prepared\s+by[:\s]+(.+)/i)?.[1]).find(Boolean);
  if (prep) fields.preparedBy = prep.trim();

  const title = header
    // A fill-in slot ("Overall opinion: Generally Effective") is a label +
    // value, never the report's title — exclude the "Label: value" shape.
    .filter(l => l !== entity && l !== periodLine && !PAGE_NUM_RE.test(l) && !CONFIDENTIALITY_RE.test(l) && !isLetterSpaced(l) && !/^[A-Z][A-Za-z /&']{1,28}:\s/.test(l))
    .map(l => l.replace(/\bref(?:erence)?\s*(?:no\.?|number|#|:)?\s*[A-Z0-9][A-Z0-9\-/]*\d[A-Z0-9\-/]*/i, '').replace(/\s+/g, ' ').trim())
    .filter(l => l.length >= 6)
    .sort((a, b) => b.length - a.length)[0];
  if (title) fields.auditTitle = title;

  return fields;
}

function passRemoveFurniture(unpacked: Unpacked): FurniturePassResult {
  const headerByPage: Line[][] = [];
  const footerByPage: Line[][] = [];
  const allByPage: Line[][] = [];

  for (const page of unpacked.pages) {
    const lines = piecesToLines(page.pieces);
    const H = page.height;
    headerByPage.push(lines.filter(l => l.y >= H * (1 - BAND)));
    footerByPage.push(lines.filter(l => l.y <= H * BAND));
    allByPage.push(lines);
  }

  const header = runningLines(headerByPage);
  const footer = runningLines(footerByPage);
  const runningSet = new Set([...header, ...footer].map(normalize));

  // Furniture is lifted out by REPETITION, not position: a line matching the
  // running set (or a bare page number) is furniture wherever it appears. A
  // one-off line that merely sits high on the page (a heading at the very top
  // of a page) is content and stays — dropping the whole margin band would
  // eat it.
  const isFurniture = (l: Line) =>
    runningSet.has(normalize(stripPageNumber(l.text).text)) || PAGE_NUM_RE.test(l.text);
  const bodyRows: Row[][] = allByPage.map((lines, p) =>
    linesToRows(lines.filter(l => !isFurniture(l)), p + 1));

  const sizes = allByPage.flat().filter(l => !isFurniture(l)).map(l => l.size).sort((a, b) => a - b);
  const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;

  const furniture: ExtractedFurniture | null = (header.length || footer.length)
    ? {
        header,
        footer,
        pageNumberPattern: detectPageNumberPattern([...headerByPage, ...footerByPage]),
        confidentiality: [...header, ...footer].map(l => l.match(CONFIDENTIALITY_RE)?.[0]).find(Boolean) || undefined,
        fields: deriveFields(header, footer),
      }
    : null;

  return { furniture, bodyRows, runningSet, median };
}

// ═══ Pass 3 — Build the tree ═════════════════════════════════════════════════
// Big + rare + numbered = headings; numbering depth gives the LEVEL. Two levels
// minimum: sections contain blocks — "1." is a section, "1.1" is a block inside
// it. "…continued" pages merge. The result is the section spine.

interface HeadingSignal {
  level: number;              // 1 = section, 2+ = a block heading inside it
  evidence: DetectionEvidence;
  confidence: number;
  appendix: boolean;
  strong: boolean;            // can stand as a section with no lead paragraph
}

interface SpineSection {
  name: string;
  level: number;
  page: number;
  evidence: DetectionEvidence;
  confidence: number;
  appendix: boolean;
  wrapper: boolean;
  /** The section's body: rows + sub-headings + figures, in reading order. */
  content: SpineEl[];
}

type SpineEl =
  | { kind: 'row'; row: Row }
  | { kind: 'subheading'; row: Row; name: string }
  | { kind: 'figure'; page: number };

interface TreePassResult {
  spine: SpineSection[];
  skipped: string[];
  toc?: TocCheck;
  coverLines: { text: string; size: number }[];
}

function passBuildTree(pass2: FurniturePassResult, unpacked: Unpacked): TreePassResult {
  const { bodyRows, runningSet, median } = pass2;

  // The heading test — the clues, in the order a person reads them: numbering,
  // letters (appendix), size, boldness, ALL-CAPS, position (alone on its line).
  const headingSignal = (r: Row): HeadingSignal | null => {
    if (r.cells.length !== 1) return null;              // columned rows are table data
    const t = r.text;
    if (t.length < 2 || t.length > 90) return null;
    if (/[.,:;]$/.test(t)) return null;                 // sentences aren't headings
    if (PAGE_NUM_RE.test(t)) return null;
    if (runningSet.has(normalize(t))) return null;
    // Data-like lines (IDs, amounts, digit-heavy) are table leakage, not titles.
    if (/\d{4,}/.test(t)) return null;
    const digitCount = (t.match(/\d/g) ?? []).length;
    if (digitCount / t.length > 0.35) return null;
    if ((t.match(/(?:^|\s)(?:\d{1,3}|-)(?=\s|$)/g) ?? []).length >= 3) return null;
    if (/\d[\d-]{2,}$/.test(t)) return null;

    const num = t.match(HEADING_NUM_RE);
    const alpha = HEADING_ALPHA_RE.test(t);
    const caps = isAllCapsHeading(t);
    const explicitBig = median > 0 && r.size >= median * EXPLICIT_SIZE_RATIO;
    const big = median > 0 && r.size >= median * HEADING_SIZE_RATIO;
    const boldish = r.bold && t.length <= 70;
    if (!num && !alpha && !caps && !big && !boldish) return null;

    // Level from the document's own nesting — never flattened: "1." is a
    // section, "1.1" is a block inside it, "1.1.1" nests deeper still.
    let level = 1;
    if (num) level = Math.min(3, num[1].split('.').length);
    else if (alpha || explicitBig) level = 1;
    else level = 2; // caps / bold / mildly-big without numbering → sub-heading

    const strong = !!num || alpha || caps || explicitBig;
    const confidence = num || alpha ? 0.95 : explicitBig ? 0.9 : caps ? 0.85 : boldish && big ? 0.75 : 0.6;
    return { level, evidence: strong ? 'explicit' : 'inferred', confidence, appendix: alpha, strong };
  };

  // ── The report's own contents page: detected, excluded from the walk (our
  //    TOC engine rebuilds it from the skeleton), counted for the sanity check.
  const tocPages = new Set<number>();
  let tocEntries = 0;
  for (let p = 0; p < Math.min(bodyRows.length, 5); p++) {
    const rows = bodyRows[p];
    if (!rows.length) continue;
    const hasHead = rows.some(r => TOC_HEAD_RE.test(r.text));
    const tocRows = rows.filter(r => TOC_ROW_RE.test(r.text) || (r.cells.length >= 2 && /^\d{1,3}$/.test(r.cells[r.cells.length - 1].text)));
    if ((hasHead && tocRows.length >= 3) || tocRows.length >= Math.max(5, rows.length * 0.6)) {
      tocPages.add(p + 1);
      tocEntries += tocRows.filter(r => {
        // Count only top-level entries: not "1.1"-numbered sub-rows.
        const m = r.text.match(/^(\d+(?:\.\d+)*)[.)]?\s/);
        return !m || !m[1].includes('.');
      }).length;
    }
  }

  // ── Cover letterhead block: the title/entity/confidentiality lines on page 1
  //    are letterhead, not sections — pulled out so they don't leak in.
  const coverLines: { text: string; size: number }[] = [];
  const coverSet = new Set<string>();
  if (bodyRows.length > 0 && !tocPages.has(1)) {
    for (const r of bodyRows[0]) {
      if (r.cells.length !== 1) break;
      const t = r.text;
      if (!t || PAGE_NUM_RE.test(t)) continue;
      if (t.length > 90 || /[.,:;]$/.test(t)) break;
      if (HEADING_NUM_RE.test(t) || HEADING_ALPHA_RE.test(t) || (isAllCapsHeading(t) && !CONFIDENTIALITY_RE.test(t))) break;
      coverLines.push({ text: t, size: r.size });
      coverSet.add(normalize(t));
      if (coverLines.length >= 8) break;
    }
  }
  const looksLikeLetterhead = coverLines.some(l =>
    (median > 0 && l.size >= median * HEADING_SIZE_RATIO) ||
    ENTITY_RE.test(l.text) || CONFIDENTIALITY_RE.test(l.text));
  if (!looksLikeLetterhead) { coverSet.clear(); coverLines.length = 0; }

  // ── The walk: rows + figures in reading order → the section spine.
  const spine: SpineSection[] = [];
  const skipped: string[] = [];
  const seen = new Map<string, SpineSection>();
  const seenSkip = new Set<string>();
  let firstNumberedPage: number | null = null;

  const els: ({ kind: 'row'; row: Row } | { kind: 'figure'; page: number })[] = [];
  for (let p = 0; p < bodyRows.length; p++) {
    if (tocPages.has(p + 1)) continue;
    const figs = unpacked.pages[p].figureYs;
    const merged: { y: number; el: { kind: 'row'; row: Row } | { kind: 'figure'; page: number } }[] = [
      ...bodyRows[p].map(r => ({ y: r.y, el: { kind: 'row' as const, row: r } })),
      ...figs.map(y => ({ y, el: { kind: 'figure' as const, page: p + 1 } })),
    ].sort((a, b) => b.y - a.y);
    merged.forEach(m => els.push(m.el));
  }

  let current: SpineSection | null = null;
  for (const el of els) {
    if (el.kind === 'figure') {
      current?.content.push({ kind: 'figure', page: el.page });
      continue;
    }
    const r = el.row;
    if (!r.text) continue;
    if (r.page === 1 && coverSet.has(normalize(r.text))) continue;

    const sig = headingSignal(r);
    if (sig) {
      const cleanName = r.text.replace(CONTINUED_RE, '').trim() || r.text;
      const key = normalize(cleanName);
      // "…continued": a heading naming an existing section merges into it —
      // one section, not two; its content keeps flowing into the original.
      const existing = seen.get(key);
      if (existing) { current = existing; continue; }

      if (sig.level === 1) {
        if (spine.length >= MAX_SECTIONS) continue;
        if (HEADING_NUM_RE.test(r.text) && firstNumberedPage === null) firstNumberedPage = r.page;
        current = {
          name: cleanName,
          level: 1,
          page: r.page,
          evidence: sig.evidence,
          confidence: sig.confidence,
          appendix: sig.appendix,
          wrapper: false,
          content: [],
        };
        seen.set(key, current);
        spine.push(current);
      } else if (current) {
        // A sub-heading is a BLOCK inside its section, never promoted to a
        // section itself — the fix for flat detection.
        current.content.push({ kind: 'subheading', row: r, name: cleanName });
      } else if (!seenSkip.has(key)) {
        // A sub-heading before any section — noted, never silently dropped.
        seenSkip.add(key);
        skipped.push(cleanName);
      }
      continue;
    }
    current?.content.push({ kind: 'row', row: r });
  }

  // ── Wrapper fold: carrier paperwork around the real report. Sections before
  //    the numbered scheme starts, or matching committee-form vocabulary, are
  //    excluded with one confirmation question — never silently.
  for (const s of spine) {
    if (WRAPPER_RE.test(s.name)) s.wrapper = true;
    else if (
      firstNumberedPage !== null && s.page < firstNumberedPage && !HEADING_NUM_RE.test(s.name) && !s.appendix &&
      s.content.some(c => c.kind === 'row' && WRAPPER_RE.test((c as { row: Row }).row.text))
    ) s.wrapper = true;
  }

  // Headings with nothing beneath them: not auto-added (a heading needs prose
  // or blocks to be a section), surfaced so the user can add them back.
  const emptied: string[] = [];
  const kept = spine.filter(s => {
    if (s.content.length > 0 || s.appendix || HEADING_NUM_RE.test(s.name)) return true;
    emptied.push(s.name);
    return false;
  });

  const detectedTop = kept.filter(s => !s.wrapper).length;
  const toc: TocCheck | undefined = tocEntries >= 3
    ? {
        docEntries: tocEntries,
        detected: detectedTop,
        verdict: detectedTop > tocEntries * 1.4 ? 'over-split' : detectedTop < tocEntries * 0.6 ? 'under-detected' : 'match',
      }
    : undefined;

  return { spine: kept, skipped: [...skipped, ...emptied], toc, coverLines };
}

// ═══ Pass 4 — Classify blocks ════════════════════════════════════════════════
// Inside each section, geometry tests name each chunk: narrative, table, stat
// strip, slot, callout, chart. Values are never kept — shapes and labels are.

// x-tolerance for treating two start positions as the same table column.
const COL_TOL = 7;

function sharedColumns(rows: Row[]): number {
  if (!rows.length) return 0;
  const counts = new Map<number, number>();
  for (const r of rows) {
    const seenKeys = new Set<number>();
    for (const c of r.cells) {
      let key: number | null = null;
      for (const k of counts.keys()) if (Math.abs(k - c.x) <= COL_TOL) { key = k; break; }
      if (key === null) { key = c.x; counts.set(key, 0); }
      if (!seenKeys.has(key)) { seenKeys.add(key); counts.set(key, (counts.get(key) ?? 0) + 1); }
    }
  }
  const threshold = Math.max(2, Math.ceil(rows.length * 0.6));
  let cols = 0;
  for (const c of counts.values()) if (c >= threshold) cols++;
  return cols;
}

/** Validate a row's cells as column names: several short, mostly non-numeric
 *  labels. Undefined when the row reads as data (data is thrown away). */
function asColumns(cells: string[]): string[] | undefined {
  const clean = cells.map(c => c.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (clean.length < 2 || clean.length > 10) return undefined;
  if (!clean.every(c => c.length <= 28)) return undefined;
  const numeric = clean.filter(c => /^[\d,.%/-]+$/.test(c)).length;
  if (numeric * 3 > clean.length) return undefined;
  return clean;
}

function cleanCaption(text: string): string {
  const stripped = text.replace(/^(figure|fig\.?|chart|exhibit|graph|diagram|table|tbl\.?)\s*\.?\s*[\divxlc]+\s*[:.\-–)]\s*/i, '').trim();
  return stripped || text.trim();
}

/** A transient classified block — pass 5 reshapes these, pass 6 labels them. */
interface RawBlock extends Omit<ExtractedBlock, 'fill'> {
  fill?: BlockFill;
  /** Table row texts — the ID-matching signal for linked sections. Transient. */
  _rows?: string[];
  /** A narrative block's lines — card-field + fixed-text material. Transient. */
  _lines?: string[];
}

function passClassifyBlocks(section: SpineSection, median: number): RawBlock[] {
  const blocks: RawBlock[] = [];
  const els = section.content;
  let pendingLabel: string | undefined;         // a sub-heading names the next block
  let narrative: { label?: string; lines: string[]; page: number; bold?: boolean } | null = null;

  const flushNarrative = () => {
    if (!narrative) return;
    const lines = narrative.lines;
    if (lines.length) {
      blocks.push({
        kind: CALLOUT_RE.test(lines[0]) ? 'callout' : 'narrative',
        label: narrative.label,
        confidence: 0.85,
        page: narrative.page,
        preview: lines.slice(0, 2),
        _lines: lines.slice(0, 24),
      });
    } else if (narrative.label) {
      // A sub-heading with no prose — still a named narrative slot.
      blocks.push({ kind: 'narrative', label: narrative.label, confidence: 0.6, page: narrative.page, _lines: [] });
    }
    narrative = null;
  };

  const rowAt = (i: number): Row | null => {
    const e = els[i];
    return e && e.kind !== 'figure' ? e.row : null;
  };

  for (let i = 0; i < els.length; i++) {
    const el = els[i];

    if (el.kind === 'figure') {
      flushNarrative();
      // Name the chart from an adjacent caption when there is one.
      const below = rowAt(i + 1);
      let label = pendingLabel;
      if (below && FIGURE_CAP_RE.test(below.text)) { label = cleanCaption(below.text); i++; }
      blocks.push({ kind: 'chart', label, confidence: label ? 0.92 : 0.85, page: el.page });
      pendingLabel = undefined;
      continue;
    }

    if (el.kind === 'subheading') {
      flushNarrative();
      pendingLabel = el.name;
      narrative = { label: pendingLabel, lines: [], page: el.row.page };
      pendingLabel = undefined;
      continue;
    }

    const r = el.row;
    const t = r.text;

    // Figure caption with no adjacent image (a vector chart).
    if (FIGURE_CAP_RE.test(t)) {
      flushNarrative();
      blocks.push({ kind: 'chart', label: cleanCaption(t), confidence: 0.92, page: r.page });
      continue;
    }

    // Table caption → the table it titles (columns from the next header row).
    if (TABLE_CAP_RE.test(t)) {
      flushNarrative();
      const block: RawBlock = { kind: 'table', label: cleanCaption(t), confidence: 0.92, page: r.page };
      const next = rowAt(i + 1);
      if (next && next.cells.length >= 2) {
        block.columns = asColumns(next.cells.map(c => c.text));
        i++;
        // Absorb the table body so data rows never leak out as prose.
        while (rowAt(i + 1) && rowAt(i + 1)!.cells.length >= 2) {
          (block._rows ??= []).push(rowAt(i + 1)!.text);
          i++;
        }
      }
      blocks.push(block);
      continue;
    }

    // Stat strip: an oversized numeric value (its caption is the small line
    // around it). Consecutive stats group into ONE strip — labels kept.
    if (r.cells.length === 1 && median > 0 && r.size >= median * KPI_SIZE_RATIO && KPI_VALUE_RE.test(t)) {
      flushNarrative();
      const labels: string[] = [];
      let j = i;
      while (j < els.length) {
        const v = rowAt(j);
        if (!v || v.cells.length !== 1 || !(v.size >= median * KPI_SIZE_RATIO && KPI_VALUE_RE.test(v.text))) break;
        const cap = rowAt(j + 1);
        if (cap && cap.cells.length === 1 && cap.text.length <= 40 && !KPI_VALUE_RE.test(cap.text)) {
          labels.push(cap.text);
          j += 2;
        } else {
          j += 1;
        }
      }
      // A row of several values on one baseline: cells are value+caption pairs.
      blocks.push({
        kind: 'stat',
        label: labels[0],
        slotLabels: labels.length ? labels : undefined,
        confidence: 0.78,
        page: r.page,
      });
      i = Math.max(i, j - 1);
      continue;
    }

    // Multi-value stat row: one baseline carrying several bare numbers, with a
    // caption row of matching cell count beside it ("0 · Critical findings").
    if (r.cells.length >= 2 && r.cells.every(c => KPI_VALUE_RE.test(c.text)) && median > 0 && r.size >= median * KPI_SIZE_RATIO) {
      flushNarrative();
      const cap = rowAt(i + 1) ?? rowAt(i - 1);
      const labels = cap && cap.cells.length === r.cells.length ? cap.cells.map(c => c.text) : undefined;
      if (cap && labels) i++;
      blocks.push({ kind: 'stat', slotLabels: labels, label: labels?.[0], confidence: 0.72, page: r.page });
      continue;
    }

    // Slot pairs: "Label: value" rows, or a short CAPS label over a value — the
    // fill-in-the-blank shape. Labels kept, values thrown away. A run of them
    // is one slot block (the cover's 6 metadata slots, document control, etc.).
    const slotLabelOf = (row: Row): string | null => {
      if (row.cells.length === 2) {
        const [a, b] = row.cells.map(c => c.text);
        if (a.length <= 30 && /^[A-Z]/.test(a) && b.length <= 60 && !TABLE_CAP_RE.test(a)) return a.replace(/:$/, '');
        return null;
      }
      const m = row.text.match(/^([A-Z][A-Za-z /&']{1,28}):\s+(.{1,60})$/);
      return m ? m[1] : null;
    };
    const firstSlot = slotLabelOf(r);
    if (firstSlot) {
      const labels: string[] = [];
      let j = i;
      while (j < els.length) {
        const row = rowAt(j);
        if (!row) break;
        const lab = slotLabelOf(row);
        if (!lab) break;
        labels.push(lab);
        j++;
      }
      if (labels.length >= 2) {
        flushNarrative();
        blocks.push({ kind: 'slot', slotLabels: labels.slice(0, 10), label: pendingLabel, confidence: 0.72, page: r.page });
        i = j - 1;
        continue;
      }
    }

    // Structural table: a run of aligned multi-column rows with no caption.
    // The run grows incrementally — only while the next row keeps sharing the
    // established columns — so the first row stays the header row, and an
    // adjacent WIDER table (a new schema) starts its own run instead of
    // poisoning this one. Alignment is the clue.
    if (r.cells.length >= TABLE_MIN_COLS) {
      const run: Row[] = [r];
      let j = i;
      while (true) {
        const next = rowAt(j + 1);
        if (!next || next.cells.length < TABLE_MIN_COLS) break;
        if (next.cells.length > r.cells.length) break; // a wider row = a new table's header
        if (sharedColumns([...run, next]) < TABLE_MIN_COLS) break;
        run.push(next);
        j++;
      }
      if (run.length >= TABLE_MIN_ROWS && sharedColumns(run) >= TABLE_MIN_COLS) {
        flushNarrative();
        blocks.push({
          kind: 'table',
          confidence: 0.72,
          page: r.page,
          columns: asColumns(run[0].cells.map(c => c.text)),
          _rows: run.slice(1, 9).map(x => x.text),
        });
        i = j;
        continue;
      }
    }

    // Everything else is narrative prose under the current (sub-)heading.
    if (!narrative) narrative = { lines: [], page: r.page };
    narrative.lines.push(t);
  }
  flushNarrative();
  return blocks;
}

// ═══ Pass 5 — Spot repeats ═══════════════════════════════════════════════════
// The same shape 2+ times → save the shape ONCE and mark "repeats as needed".
// The count never matters — the next report can have 3 or 30. If nothing
// repeats, this pass finds nothing: also a valid result.

const generaliseId = (id: string) => id.replace(/\d/g, '#');

/** Grouping key for card-shaped labels: the leading ID reduced to its SHAPE —
 *  in digit-carrying segments, letters ALSO generalise ("IA-26-H01" and
 *  "IA-26-M02" both key the same: the letter encodes the rating, not the
 *  pattern). Word forms ("Finding 3") key on the word. */
function cardKey(name: string | undefined): string | null {
  if (!name) return null;
  const m = name.match(CARD_ID_RE);
  if (m) {
    return m[1]
      .split(/([-/])/)
      .map(seg => (/\d/.test(seg) ? seg.replace(/\d/g, '#').replace(/[A-Z]/g, '@') : seg))
      .join('');
  }
  const w = name.match(CARD_WORD_RE);
  if (w) return `${w[1].toLowerCase()} #`;
  return null;
}

function idPatternToRegex(pattern: string): RegExp {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/#+/g, '\\d+');
  return new RegExp(`\\b${esc}\\b`, 'g');
}

/** Collapse a section's repeated card-shaped blocks into one `cards` block. */
function collapseRepeats(blocks: RawBlock[]): RawBlock[] {
  const out: RawBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    const key = b.kind === 'narrative' ? cardKey(b.label) : null;
    if (!key) { out.push(b); i++; continue; }
    // Gather the run: blocks with the same key; non-narrative blocks between
    // cards (mini tables, stats) are card content and fold in with them.
    const members: RawBlock[] = [];
    let j = i, gap = 0;
    while (j < blocks.length && gap <= 2) {
      const c = blocks[j];
      if (c.kind === 'narrative' && cardKey(c.label)) {
        if (cardKey(c.label) !== key) break;
        members.push(c);
        gap = 0;
      } else {
        gap++;
      }
      j++;
    }
    // 2+ of the same shape → one repeating card; the count is recorded for
    // honesty but the template stores the shape, never the number.
    if (members.length >= 2) {
      const counts = new Map<string, { n: number; raw: string; order: number }>();
      let order = 0;
      members.forEach(m => {
        const seenHere = new Set<string>();
        for (const line of m._lines ?? []) {
          const lm = line.match(CARD_LABEL_RE);
          const raw = lm ? lm[1].trim() : (HUMAN_FIELD_RE.test(line) && line.length <= 34 ? line.replace(/:.*$/, '').trim() : null);
          if (!raw) continue;
          const k = raw.toLowerCase();
          if (seenHere.has(k)) continue;
          seenHere.add(k);
          const e = counts.get(k);
          if (e) e.n++;
          else counts.set(k, { n: 1, raw, order: order++ });
        }
      });
      const cardFields = [...counts.values()]
        .filter(e => e.n >= Math.ceil(members.length / 2))
        .sort((a, b) => a.order - b.order)
        .slice(0, 10)
        .map(e => e.raw);
      const humanFields = cardFields.filter(f => HUMAN_FIELD_RE.test(f));
      const idTok = members[0].label?.match(CARD_ID_RE)?.[1];
      out.push({
        kind: 'cards',
        confidence: 0.92,
        page: members[0].page,
        cardFields: cardFields.length ? cardFields : undefined,
        humanFields: humanFields.length ? humanFields : undefined,
        idPattern: idTok ? generaliseId(idTok) : key,
        cardCount: members.length,
      });
      i = j;
    } else {
      out.push(b);
      i++;
    }
  }
  return out;
}

// ═══ Pass 6 — Label it ═══════════════════════════════════════════════════════
// Only now do naming questions get answered — from a fixed list, never invented:
// what is each section FOR (its description, always pre-filled), which fill case
// applies, which rating words does this company use. Never numbers, never new
// sections.

function detectScales(allText: string): { findingScale?: string[]; opinionScale?: string[] } {
  const count = (phrase: string) => (allText.match(new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'gi')) ?? []).length;
  const findingScale = FINDING_SCALE_SETS.find(set => set.every(w => count(w) >= 2));
  const opinionScale = OPINION_SCALE_SETS.find(set => set.every(w => count(w) >= 1));
  return { findingScale, opinionScale };
}

/** The engine's fill-case guess for one block — multiple-choice from the fixed
 *  list; the user confirms via dropdown at review. */
function guessBlockFill(block: RawBlock, sectionName: string): { fill: BlockFill; binding?: DataBinding } {
  const label = `${block.label ?? ''} ${sectionName}`;
  if (block.kind === 'cards') return { fill: 'query', binding: 'findings' };
  if (block.kind === 'signoff') return { fill: 'human' };
  if (block.linkedTo) return { fill: 'query', binding: 'actions' };
  if (block.kind === 'table') {
    if (BIND_ACTIONS_RE.test(label)) return { fill: 'query', binding: 'actions' };
    if (BIND_FINDINGS_RE.test(label)) return { fill: 'query', binding: 'findings' };
    if (NO_DATA_RE.test(`${label} ${(block.columns ?? []).join(' ')}`)) return { fill: 'manual' };
    return { fill: 'manual' };
  }
  if (block.kind === 'chart' || block.kind === 'stat') {
    if (NO_DATA_RE.test(label)) return { fill: 'manual' };
    if (BIND_FINDINGS_RE.test(label) || BIND_METRICS_RE.test(label) || BIND_SUMMARY_RE.test(label)) return { fill: 'query', binding: 'metrics' };
    return { fill: 'manual' };
  }
  if (block.kind === 'slot') return { fill: 'query', binding: 'metrics' }; // metadata slots fill from report details
  // Narrative / callout:
  if (FIXED_RE.test(label)) return { fill: 'fixed' };
  if (HUMAN_FIELD_RE.test(label) || HUMAN_SECTION_RE.test(label)) return { fill: 'human' };
  if (BIND_FINDINGS_RE.test(label)) return { fill: 'query', binding: 'findings' };
  if (BIND_SUMMARY_RE.test(label)) return { fill: 'query', binding: 'summary' };
  if (INTRO_RE.test(label)) return { fill: 'fixed' };
  if (NO_DATA_RE.test(label)) return { fill: 'manual' };
  return { fill: 'query', binding: 'summary' };
}

/** Every section's one-line purpose, pre-filled — never the empty prompt. */
function describeSection(name: string, fill: SectionFill, blocks: ExtractedBlock[]): string {
  const cards = blocks.find(b => b.kind === 'cards');
  if (cards) {
    return `One repeating card per finding${cards.idPattern ? ` (${cards.idPattern})` : ''}${cards.cardFields?.length ? `, fields: ${cards.cardFields.slice(0, 4).join(', ')}${cards.cardFields.length > 4 ? '…' : ''}` : ''}.`;
  }
  const linked = blocks.find(b => b.linkedTo);
  if (linked) return `Auto-built from “${linked.linkedTo}” — never typed fresh, so the two sections can’t disagree.`;
  if (SIGNOFF_RE.test(name)) return 'Signature slots — filled by real people when the report is approved.';
  if (BIND_SUMMARY_RE.test(name)) return 'Explains the overall opinion and what drives it, from this period’s audit data.';
  if (BIND_FINDINGS_RE.test(name)) return 'The detailed findings for this period, in this template’s own shape.';
  if (BIND_ACTIONS_RE.test(name)) return 'The agreed actions, owners and deadlines arising from the findings.';
  if (FIXED_RE.test(name)) return 'Prints word-for-word every time — never rewritten.';
  if (HUMAN_SECTION_RE.test(name)) return 'Filled in by the audit team — real people’s decisions, never guessed.';
  if (INTRO_RE.test(name)) return 'Standing context about the organisation — mostly identical every audit.';
  const shapes: string[] = [];
  const tables = blocks.filter(b => b.kind === 'table');
  if (tables.length) shapes.push(`${tables.length} table${tables.length > 1 ? 's' : ''}${tables[0].columns?.length ? ` (${tables[0].columns.slice(0, 4).join(', ')}${tables[0].columns.length > 4 ? '…' : ''})` : ''}`);
  const charts = blocks.filter(b => b.kind === 'chart').length;
  if (charts) shapes.push(`${charts} chart${charts > 1 ? 's' : ''}`);
  const stats = blocks.filter(b => b.kind === 'stat').length;
  if (stats) shapes.push('a stat strip');
  const slots = blocks.find(b => b.kind === 'slot');
  if (slots) shapes.push(`${slots.slotLabels?.length ?? ''} fill-in slots`);
  if (shapes.length) {
    return fill === 'manual'
      ? `Carries ${shapes.join(', ')} — no connected data yet, filled in manually.`
      : `Carries ${shapes.join(', ')}, filled at generation.`;
  }
  return fill === 'manual'
    ? 'Kept in the report shape — no connected data yet, filled in manually.'
    : fill === 'human'
      ? 'Filled in by a real person before the report goes out.'
      : 'Narrative section, written from this period’s audit data.';
}

/** The grey line next to each fill guess: the engine's EVIDENCE, in plain
 *  words, so the user checks our reason against their own document instead of
 *  reasoning about five abstract options. */
function fillReasonFor(name: string, fill: SectionFill, blocks: ExtractedBlock[]): string {
  if (fill === 'mixed') return 'Set to Mixed because the parts inside behave differently — each block carries its own setting below.';
  if (blocks.some(b => b.kind === 'signoff')) return 'Set to “A person fills this” because signatures can only come from people.';
  if (blocks.some(b => b.linkedTo)) return 'Set to “Fills from audit data” because this table’s rows reuse the finding IDs — it derives from the findings.';
  if (blocks.some(b => b.kind === 'cards')) return 'Set to “Fills from audit data” because this is the repeating finding card — each audit finding stamps one.';
  if (fill === 'fixed') {
    return FIXED_RE.test(name)
      ? 'Set to “Fixed text” because this wording (definitions, formal statements) must print identically every time.'
      : 'Set to “Fixed text” because this reads as standing boilerplate that looks identical across audits.';
  }
  if (fill === 'human') {
    return HUMAN_SECTION_RE.test(name)
      ? 'Set to “A person fills this” because scope and objectives are the audit team’s own words — we can’t guess them.'
      : 'Set to “A person fills this” because this waits for a real person’s input.';
  }
  if (fill === 'manual') return 'Set to “No data connected” because none of our audit queries produce this data.';
  return BIND_SUMMARY_RE.test(name)
    ? 'Set to “Fills from audit data” because the summary is written from this period’s results.'
    : 'Set to “Fills from audit data” because our audit data can write this section.';
}

// ═══ The engine ══════════════════════════════════════════════════════════════

/**
 * Read one finished report (digital PDF) and return its reusable skeleton:
 * sections containing typed blocks, the furniture as pre-filled settings, the
 * brand colour, and the document's own rating language. Declines non-PDF,
 * oversize, password-protected, scanned, and over-length files with a typed
 * reason — an honest message, never a silent failure.
 */
export async function extractTemplateFromReport(file: File): Promise<ExtractOutcome> {
  if (!/\.pdf$/i.test(file.name)) return { ok: false, reason: 'not-pdf' };
  if (file.size > MAX_PARSE_BYTES) return { ok: false, reason: 'too-large' };
  try {
    const pdfjs = await getPdfjs();
    const buf = await file.arrayBuffer();
    let doc;
    try {
      doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'PasswordException') return { ok: false, reason: 'password' };
      return { ok: false, reason: 'unreadable' };
    }
    if (doc.numPages > PAGE_CAP) {
      const pageCount = doc.numPages;
      await doc.destroy();
      return { ok: false, reason: 'too-long', pageCount };
    }

    // Pass 1 — unpack: every text piece with its facts, plus page snapshots.
    // (pdf.js's RenderParameters is structurally stricter than the minimal
    // shape pass 1 needs — the cast bridges the two.)
    const unpacked = await passUnpack(doc as unknown as Parameters<typeof passUnpack>[0], pdfjs.OPS as Record<string, number>);
    await doc.destroy();
    // A scanned PDF is a photo of paper — no text inside. Said honestly.
    if (unpacked.totalTextItems === 0) return { ok: false, reason: 'scanned', pageCount: unpacked.pageCount };

    // Pass 2 — remove furniture: running header/footer lifted out and stored
    // as pre-filled values the user verifies in template settings.
    const pass2 = passRemoveFurniture(unpacked);

    // Pass 3 — build the tree: the section spine, levels from the document's
    // own nesting, "…continued" merged, TOC excluded, wrappers flagged.
    const tree = passBuildTree(pass2, unpacked);

    // Pass 4 — classify blocks inside each section by geometry.
    // Pass 5 — spot repeats: same shape 2+ → one repeating card.
    const rawSections = tree.spine.map(s => ({
      spine: s,
      blocks: collapseRepeats(passClassifyBlocks(s, pass2.median)),
    }));

    // Sign-off detection: a section whose rows carry signature roles becomes a
    // signoff block (roles kept) rather than prose.
    for (const rs of rawSections) {
      if (!SIGNOFF_RE.test(rs.spine.name)) continue;
      const roles: string[] = [];
      const seenRole = new Set<string>();
      for (const el of rs.spine.content) {
        if (el.kind === 'figure') continue;
        for (const cell of el.row.cells) {
          for (const m of cell.text.matchAll(new RegExp(ROLE_RE.source, 'gi'))) {
            const role = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
            if (!seenRole.has(role.toLowerCase())) { seenRole.add(role.toLowerCase()); roles.push(role); }
          }
        }
      }
      rs.blocks = [{ kind: 'signoff', confidence: 0.85, page: rs.spine.page, signRoles: roles.length ? roles : undefined }];
    }

    // Linked sections: a table whose rows reuse the finding IDs is auto-built
    // FROM the findings — generation derives it, never types it fresh.
    let lastCards: { name: string; idPattern?: string } | null = null;
    for (const rs of rawSections) {
      for (const b of rs.blocks) {
        if (b.kind === 'cards') { lastCards = { name: rs.spine.name, idPattern: b.idPattern }; continue; }
        if (b.kind === 'table' && lastCards?.idPattern && b._rows?.length) {
          const re = idPatternToRegex(lastCards.idPattern);
          const hits = b._rows.reduce((n, row) => n + (row.match(re) ?? []).length, 0);
          if (hits >= 2) b.linkedTo = lastCards.name;
        }
      }
    }

    // Pass 6 — label: fill cases (guessed, user confirms), descriptions
    // (always pre-filled), the document's own rating language, confidence.
    const allBodyText = pass2.bodyRows.flat().map(r => r.text).join('\n');
    const { findingScale, opinionScale } = detectScales(allBodyText);

    const sections: ExtractedSection[] = rawSections.map(rs => {
      const isFixedSection = FIXED_RE.test(rs.spine.name) || (INTRO_RE.test(rs.spine.name) && rs.blocks.every(b => b.kind === 'narrative' || b.kind === 'callout'));
      const blocks: ExtractedBlock[] = rs.blocks.map(rb => {
        const { _rows, _lines, ...rest } = rb;
        void _rows;
        const guess = guessBlockFill(rb, rs.spine.name);
        const fill: BlockFill = isFixedSection && (rb.kind === 'narrative' || rb.kind === 'callout') ? 'fixed' : guess.fill;
        return {
          ...rest,
          fill,
          binding: fill === 'query' ? guess.binding : undefined,
          // Fixed text is the one deliberate exception to "throw the content
          // away" — the verbatim lines survive so they print identically.
          fixedBody: fill === 'fixed' ? (_lines ?? []).slice(0, 20) : undefined,
        };
      });
      const fills = [...new Set(blocks.map(b => b.fill))];
      const fill: SectionFill = fills.length === 0 ? 'manual' : fills.length === 1 ? fills[0] : 'mixed';
      const binding = blocks.find(b => b.binding)?.binding;
      const source = rs.spine.content
        .filter((c): c is { kind: 'row'; row: Row } => c.kind === 'row')
        .slice(0, 2)
        .map(c => c.row.text);
      return {
        name: rs.spine.name,
        description: describeSection(rs.spine.name, fill, blocks),
        fill,
        fillReason: fillReasonFor(rs.spine.name, fill, blocks),
        binding: fill === 'query' || fill === 'mixed' ? binding : undefined,
        blocks,
        evidence: rs.spine.evidence,
        confidence: Math.min(rs.spine.confidence, ...blocks.map(b => b.confidence)),
        page: rs.spine.page,
        appendix: rs.spine.appendix || undefined,
        wrapper: rs.spine.wrapper || undefined,
        source: source.length ? source : undefined,
      };
    });

    // The cover letterhead feeds the furniture fields (title/entity), so a
    // cover-only title is captured instead of leaking in as a section.
    const coverTexts = tree.coverLines.map(l => l.text);
    let furniture = pass2.furniture;
    if (coverTexts.length) {
      const fields = deriveFields([...(furniture?.header ?? []), ...coverTexts], furniture?.footer ?? []);
      if (!fields.auditTitle) {
        const coverTitle = [...tree.coverLines]
          .filter(l => !CONFIDENTIALITY_RE.test(l.text) && !ENTITY_RE.test(l.text) && !isLetterSpaced(l.text) && l.text.length >= 4)
          .sort((a, b) => b.size - a.size)[0]?.text;
        if (coverTitle) fields.auditTitle = coverTitle;
      }
      const confidentiality = [...(furniture?.header ?? []), ...(furniture?.footer ?? []), ...coverTexts]
        .map(l => l.match(CONFIDENTIALITY_RE)?.[0]).find(Boolean);
      furniture = {
        header: furniture?.header ?? [],
        footer: furniture?.footer ?? [],
        pageNumberPattern: furniture?.pageNumberPattern,
        confidentiality: confidentiality || furniture?.confidentiality,
        fields,
      };
    }

    return {
      ok: true,
      template: {
        furniture,
        sections,
        skipped: tree.skipped.filter(name => !sections.some(s => normalize(s.name) === normalize(name))),
        pageCount: unpacked.pageCount,
        pages: unpacked.snapshots.length ? unpacked.snapshots : undefined,
        snapshotLimit: SNAPSHOT_MAX,
        findingScale,
        opinionScale,
        coverColor: unpacked.coverColor,
        toc: tree.toc,
      },
    };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}
