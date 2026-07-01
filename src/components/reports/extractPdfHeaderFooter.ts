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

/** A report's full importable structure: its letterhead plus the section
 *  headings detected in the body. Used by the template editor's "Import from a
 *  report" action to pre-fill the outline + header/footer in one pass. */
export interface ReportStructure {
  headerFooter: ExtractedHeaderFooter | null;
  sections: string[];
  /** Headings that had no body text beneath them — not auto-added (§4.5), but
   *  surfaced so the user can add them back if they're real sections. */
  skipped: string[];
}

// A body line is a section heading when it's set noticeably larger than the
// body text, short, and not a sentence (no trailing punctuation).
const HEADING_SIZE_RATIO = 1.18;
const MAX_HEADINGS = 24;

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
    const bodyLines: Line[] = []; // in reading order across pages
    const bodySizes: number[] = [];
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
      lines
        .filter(l => l.y < H * (1 - BAND) && l.y > H * BAND)
        .sort((a, b) => b.y - a.y)
        .forEach(l => { bodyLines.push(l); bodySizes.push(l.size); });
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

    // Section headings: body lines set larger than the median body size.
    const sorted = bodySizes.slice().sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const runningSet = new Set([...header, ...footer].map(normalize));
    const isHeadingLine = (l: Line): boolean => {
      if (median > 0 && l.size < median * HEADING_SIZE_RATIO) return false;
      const t = l.text.trim();
      if (t.length < 2 || t.length > 80) return false;
      if (/[.,:;]$/.test(t)) return false;   // headings don't end in sentence punctuation
      if (PAGE_NUM_RE.test(t)) return false;
      if (runningSet.has(normalize(t))) return false;
      return true;
    };
    const seen = new Set<string>();
    const seenSkip = new Set<string>();
    const sections: string[] = [];
    const skipped: string[] = [];
    for (let i = 0; i < bodyLines.length; i++) {
      const l = bodyLines[i];
      if (!isHeadingLine(l)) continue;
      const t = l.text.trim();
      const key = normalize(t);
      if (seen.has(key)) continue;
      // "Has content" = at least one non-heading line before the next heading.
      // An empty heading (nothing beneath it) isn't a confirmable section (§4.5).
      let hasContent = false;
      for (let j = i + 1; j < bodyLines.length; j++) {
        if (isHeadingLine(bodyLines[j])) break;
        if (bodyLines[j].text.trim()) { hasContent = true; break; }
      }
      if (hasContent) {
        if (sections.length < MAX_HEADINGS) { seen.add(key); sections.push(t); }
      } else if (!seenSkip.has(key)) {
        seenSkip.add(key);
        skipped.push(t);
      }
    }
    // A heading that appears empty once but has content elsewhere is a real section.
    const finalSkipped = skipped.filter(s => !seen.has(normalize(s)));

    return { headerFooter, sections, skipped: finalSkipped };
  } catch {
    return null;
  }
}
