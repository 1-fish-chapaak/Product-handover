// ─── Bring Your Own Template — the reading engine ───────────────────────────
//
// THE ONE RULE: extraction keeps the SKELETON, never the CONTENT. Section
// order, headings, tables, ratings and branding survive. Their findings, their
// figures, their names and their dates are thrown away.
//
// A PDF never says "this line is a heading" or "this box is a table", so the
// engine guesses from clues: size, boldness, position, numbering, alignment,
// repetition. It reads the file six times and each read answers exactly one
// question, so when a result is wrong we can point at the read that failed:
//
//   1  Unpack            what text pieces exist, and where do they sit?
//   2  Remove furniture   which lines repeat on every page? Lift them out and
//                         keep them as pre filled settings, not headings.
//   3  Build the tree     which lines are headings, and in what order?
//   4  Classify blocks    inside a section, is this prose, a table, a stat
//                         strip, a slot or a callout?
//   5  Spot repeats       does any shape appear more than once? Save it once
//                         and mark it as repeating. The count never matters.
//   6  Name what we found section purpose, fill case, rating words, confidence.
//                         Never numbers, never new sections.
//
// Rules first, naming last: geometry decides WHAT EXISTS, labelling decides
// WHAT TO CALL IT.

import { getPdfjs } from '../../data-sources/datasetFiles';
import type { BlockFill, SectionFill, DataBinding, TemplateBlock } from '../reportShared';

export type { BlockFill, SectionFill, DataBinding };

// ═══ What the engine hands back ══════════════════════════════════════════════

export type ReadEvidence = 'explicit' | 'inferred';

export interface ReadBlock extends TemplateBlock {
  /** How sure passes 4 and 5 are (0 to 1). Grounds the "check this" flag. */
  confidence: number;
  page?: number;
  /** Up to two source lines for the review screen. Never persisted. */
  preview?: string[];
}

export interface ReadSection {
  name: string;
  /** One line purpose, always pre filled by pass 6, never an empty prompt. */
  description: string;
  fill: SectionFill;
  /** Why the engine guessed this fill, in plain words the user can check. */
  fillReason?: string;
  binding?: DataBinding;
  blocks: ReadBlock[];
  evidence: ReadEvidence;
  confidence: number;
  page?: number;
  appendix?: boolean;
  /** Carrier paperwork wrapped around the real report. Excluded with one
   *  confirmation question in review, never in silence. */
  wrapper?: boolean;
  source?: string[];
}

/** Pass 2's output. Stored as pre filled settings the user verifies. */
export interface ReadFurniture {
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

/** The only valid sanity check, and it is relative: our section list against
 *  the report's own contents page. A 40 section report with a 40 entry
 *  contents page is correct, not a failure. */
export interface ReadTocCheck {
  docEntries: number;
  detected: number;
  verdict: 'match' | 'over-split' | 'under-detected';
}

/** A section the template does not keep, listed once at review so nothing
 *  disappears in silence. The client covers these per report through Add
 *  Observation. */
export interface ReadDropped {
  name: string;
  why: string;
  /** Not really left out: its structure came back as a template setting. */
  captured?: boolean;
}

export interface ReadResult {
  furniture: ReadFurniture | null;
  sections: ReadSection[];
  /** Sections neither detector claimed. Said once, never silently. */
  dropped: ReadDropped[];
  /** Headings with nothing beneath them. Not added, never silently dropped. */
  skipped: string[];
  pageCount: number;
  /** Page snapshots for the side by side review. Transient, never saved. */
  pages?: string[];
  snapshotLimit: number;
  findingScale?: string[];
  opinionScale?: string[];
  coverColor?: string;
  toc?: ReadTocCheck;
  /** The signature block, captured as a SETTING rather than a section. There is
   *  nothing to generate in a sign-off: role labels and empty boxes are the
   *  whole feature, so it sits with page numbers and the watermark. */
  signoff?: { roles: string[] };
}

export type ReadFailReason = 'not-pdf' | 'too-large' | 'password' | 'scanned' | 'too-long' | 'unreadable';
export type ReadOutcome =
  | { ok: true; result: ReadResult }
  | { ok: false; reason: ReadFailReason; pageCount?: number };

// ═══ Guardrails ══════════════════════════════════════════════════════════════

const MAX_BYTES = 30 * 1024 * 1024;
/** "Upload a representative report." A 300 page pack is not a template. */
const PAGE_CAP = 50;
const SNAPSHOT_MAX = 24;
const SNAPSHOT_WIDTH = 520;
const SECTION_CAP = 48;

// ═══ Clue constants ══════════════════════════════════════════════════════════

/** Share of the page height treated as the header / footer margin band. */
const BAND = 0.08;
/** A line is running furniture when it recurs on this share of pages. */
const REPEAT_SHARE = 0.6;
/** …or when it appears in the SAME PLACE on this many pages. Nothing that
 *  repeats in one spot page after page is content. */
const REPEAT_PAGES = 3;
/** How close two lines must sit vertically to count as the same position. */
const POSITION_TOLERANCE = 6;
/** A line reads as a heading at this multiple of the body text size. */
const HEADING_SIZE = 1.14;

const NUMBERED = /^(\d+(?:\.\d+)*)[.)]?\s+(\S.*)$/;
const LETTERED = /^([A-Z])[.)]\s+(\S.*)$/;
const APPENDIX = /^(appendix|annexure|annex|schedule|exhibit)\s+([A-Z0-9]+)\b[:.\-\s]*(.*)$/i;
const CONTINUED = /\(?\bcont(?:inued|\.|d)?\b\)?\s*$/i;
const CONTENTS = /^(table of contents|contents|index)$/i;
const PAGE_NUMBER = /^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i;
const CONFIDENTIAL = /\b(strictly\s+)?(confidential|private and confidential|internal use only|restricted)\b/i;
const WRAPPER = /\b(committee|cabinet|financial implications|legal implications|report to|cover sheet|covering report|decision required|recommendation to)\b/i;
const SIGNOFF = /\b(sign[\s-]?off|signature|approvals?|prepared by and approved)\b/i;
const ROLE = /\b(prepared by|reviewed by|approved by|authorised by|authorized by|head of internal audit|chief audit executive|audit manager|engagement partner|director)\b/i;
/** Words that make a short cell read as somebody's role on a signature row. */
const ROLE_TITLE = /\b(lead|head|chair|chairman|director|partner|manager|officer|controller|executive|auditor|prepared|reviewed|approved|authorised|authorized|signed)\b/i;
/** A cross reference: the line points at a section instead of opening one. */
const POINTER = /\b(see|refer(?:red)?\s+to|as\s+(?:set\s+out|described)\s+in|per)\s+(section|appendix|annexure|para(?:graph)?|part|table)\s*[\dA-Z][\d.]*/i;
/** Noise that sits between real content and must never be proposed. */
const BLANK_PAGE = /^(this )?page (is )?intentionally left blank$|^\[?this page.*blank\]?$/i;
/** The only words that name a section on their own. Everything else that is
 *  one word long is a wrapped fragment, a watermark or a stray label. */
const SINGLE_WORD_SECTION = /^(introduction|background|scope|objective|objectives|approach|methodology|findings|observations|recommendations|conclusion|conclusions|summary|opinion|limitations|appendix|appendices|annexure|glossary|definitions|sources|distribution|contents|acknowledgements?)$/i;
/** A finding reference: letters, then numbers, joined by dashes or slashes.
 *  Deliberately strict — "IFRS16" and "FY26" are not finding IDs, and a loose
 *  match turns every section into a repeating card. */
const FINDING_ID = /\b[A-Z]{2,4}[-/]\d{2,4}[-/][A-Z]?\d{1,3}\b|\b[A-Z]{1,3}-\d{1,3}\b/;

/** Field labels worth keeping off the cover and the letterhead. */
const FIELD_LABELS: { key: keyof ReadFurniture['fields']; re: RegExp }[] = [
  { key: 'auditTitle', re: /^(report title|audit title|title|subject)$/i },
  { key: 'auditEntity', re: /^(entity|organisation|organization|company|client|auditee|business unit)$/i },
  { key: 'auditPeriod', re: /^(period|audit period|period covered|financial year|reporting period|for the year)$/i },
  { key: 'preparedBy', re: /^(prepared by|issued by|author|audit lead)$/i },
  { key: 'reportId', re: /^(report (reference|ref|no\.?|number|id)|reference|ref)$/i },
];

/** Boilerplate fingerprints: the phrasings that mark words as standard, and
 *  that must therefore print unchanged. Names are a hint, the wording is the
 *  evidence. */
const FIXED_NAME = /\b(rating (definitions?|scale)|definitions?|how to read|basis of|conformance|standards?|disclaimer|glossary|legal|statement of responsibility)\b/i;
const FIXED_PHRASE = /\b(is defined as|are defined as|for the purposes of this report|in (conformance|compliance) with (the )?(international )?standards|conforms? (to|with) the|the following definitions|this report (should|must) be read|no assurance is given|does not constitute|shall not be (relied|reproduced)|without our prior written consent)\b/i;

/** Captions that count things Irame records, so a stat card carrying them is
 *  computable. A financial caption is the same card shape and is NOT. */
const COUNT_NOUN = /\b(exceptions?|findings?|observations?|issues?|open|closed|tested|samples?|controls? tested|recommendations?|actions?|overdue|total)\b/i;
const MONEY_NOUN = /\b(revenue|margins?|profit|cash|cost|turnover|ebitda|crore|cr\b|₹|\$|£|€)/i;

/** Slot labels the system already knows about every report it generates. */
const METADATA_LABEL = /^(report (title|date|reference|ref|no\.?|number|id)|title|subject|audit (title|period|date)|period|date|prepared by|issued by|author|audit lead|version)$/i;

/** Rating vocabularies. Whichever set the document uses becomes a setting, and
 *  generated reports then speak their words instead of ours. */
const FINDING_SCALES = [
  ['Critical', 'High', 'Medium', 'Low'],
  ['High', 'Medium', 'Low'],
  ['Priority 1', 'Priority 2', 'Priority 3'],
  ['Significant', 'Moderate', 'Minor'],
  ['Fundamental', 'Significant', 'Housekeeping'],
];
const OPINION_SCALES = [
  ['Effective', 'Substantially effective', 'Partially effective', 'Unsatisfactory'],
  ['Substantial', 'Reasonable', 'Limited', 'No assurance'],
  ['Satisfactory', 'Needs improvement', 'Unsatisfactory'],
  ['Green', 'Amber', 'Red'],
];

// ═══ Internal shapes ═════════════════════════════════════════════════════════

type Piece = { text: string; x: number; right: number; y: number; size: number; bold: boolean };
type Line = {
  text: string; cells: { text: string; x: number; right: number }[];
  x: number; y: number; size: number; bold: boolean; page: number;
  /** This line opens a page but carries on the sentence the page before it
   *  left unfinished, so it belongs to that page's last block. */
  continuation?: boolean;
};

type Unpacked = {
  pageCount: number;
  /** Lines per page, top of page first. */
  perPage: Line[][];
  textItems: number;
  snapshots: string[];
  coverColor?: string;
  bodySize: number;
};

type Furnished = {
  furniture: ReadFurniture | null;
  /** Body lines per page with the running furniture lifted out. */
  body: Line[][];
  headerLines: Set<string>;
};

type SpineSection = {
  name: string;
  level: number;
  page: number;
  evidence: ReadEvidence;
  confidence: number;
  appendix: boolean;
  wrapper: boolean;
  /** Everything under the heading, including deeper sub headings. */
  lines: Line[];
};

type Tree = {
  spine: SpineSection[];
  skipped: string[];
  cover: Line[];
  toc?: ReadTocCheck;
};

/** Blocks before pass 6, still carrying the raw lines the classifier saw. */
type RawBlock = Omit<TemplateBlock, 'fill'> & {
  confidence: number;
  page?: number;
  lines: string[];
};

// ═══ Small helpers ═══════════════════════════════════════════════════════════

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const median = (ns: number[]) => {
  if (ns.length === 0) return 10;
  const s = [...ns].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const titleCase = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
/** Digits generalised: "IA-26-H01" becomes "IA-##-H##". */
const generalisePattern = (id: string) => id.replace(/\d/g, '#');
/** …and back again, so rows can be tested against the document's own shape. */
const idPatternToRegex = (pattern: string) =>
  new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/#/g, '\\d'), 'g');
const isNumeric = (s: string) => /^[₹$€£]?\s*-?[\d,.]+\s*(%|cr|mn|bn|k|m)?$/i.test(s.trim()) && /\d/.test(s);
const sentenceish = (s: string) => s.split(/\s+/).length > 12 || /[.;:]$/.test(s.trim());

// ═══ Pass 1 — unpack ═════════════════════════════════════════════════════════
// Every text piece comes out with its facts: words, page, position, size,
// boldness. Pieces on one baseline become a line; a wide gap inside a line
// splits it into cells, which is what makes a table detectable later.

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: unknown[]; styles?: Record<string, { fontFamily?: string }> }>;
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};

async function passUnpack(doc: PdfDoc): Promise<Unpacked> {
  const perPage: Line[][] = [];
  const snapshots: string[] = [];
  let textItems = 0;
  let coverColor: string | undefined;
  const sizes: number[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const styles = content.styles ?? {};

    const pieces: Piece[] = [];
    for (const raw of content.items) {
      const item = raw as { str?: string; transform?: number[]; width?: number; fontName?: string; height?: number };
      const text = (item.str ?? '').replace(/\s+/g, ' ');
      if (!item.transform) continue;
      textItems += text.trim() ? 1 : 0;
      if (!text.trim()) continue;
      const [a, b, , , e, f] = item.transform;
      const size = Math.hypot(a, b) || item.height || 10;
      const family = styles[item.fontName ?? '']?.fontFamily ?? item.fontName ?? '';
      pieces.push({
        text,
        x: e,
        right: e + (item.width ?? text.length * size * 0.5),
        // Flip to a top down axis so "first on the page" is simply smallest y.
        y: viewport.height - f,
        size,
        bold: /bold|black|heavy|semib/i.test(family),
      });
      sizes.push(size);
    }

    perPage.push(piecesToLines(pieces, p));

    // Page snapshots for the side by side review, plus the cover colour that
    // becomes the brand candidate. Both are read only from page images.
    if (snapshots.length < SNAPSHOT_MAX) {
      const canvas = document.createElement('canvas');
      const scale = SNAPSHOT_WIDTH / viewport.width;
      canvas.width = Math.round(viewport.width * scale);
      canvas.height = Math.round(viewport.height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        try {
          await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale }) }).promise;
          snapshots.push(canvas.toDataURL('image/jpeg', 0.72));
          if (p === 1) coverColor = dominantColor(ctx, canvas.width, canvas.height);
        } catch { /* a page that will not paint just has no snapshot */ }
      }
    }
  }

  return { pageCount: doc.numPages, perPage, textItems, snapshots, coverColor, bodySize: median(sizes) };
}

/** Pieces on a shared baseline become one line; wide gaps split it into cells. */
function piecesToLines(pieces: Piece[], page: number): Line[] {
  const sorted = [...pieces].sort((a, b) => (Math.abs(a.y - b.y) > 2 ? a.y - b.y : a.x - b.x));
  const lines: Line[] = [];
  let bucket: Piece[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const ordered = [...bucket].sort((a, b) => a.x - b.x);
    const size = Math.max(...ordered.map(p => p.size));
    const cells: { text: string; x: number; right: number }[] = [];
    for (const p of ordered) {
      const last = cells[cells.length - 1];
      // A gap wider than roughly two characters starts a new cell — this is
      // the alignment clue that makes a real table readable as a table.
      if (last && p.x - last.right < size * 1.1) {
        last.text = `${last.text}${p.x - last.right > size * 0.18 ? ' ' : ''}${p.text}`.replace(/\s+/g, ' ');
        last.right = Math.max(last.right, p.right);
      } else {
        cells.push({ text: p.text.trim(), x: p.x, right: p.right });
      }
    }
    const clean = cells.map(c => ({ ...c, text: c.text.trim() })).filter(c => c.text);
    if (clean.length > 0) {
      lines.push({
        text: clean.map(c => c.text).join('  '),
        cells: clean,
        x: clean[0].x,
        y: ordered[0].y,
        size,
        bold: ordered.some(p => p.bold),
        page,
      });
    }
    bucket = [];
  };

  for (const p of sorted) {
    if (bucket.length === 0) { bucket = [p]; continue; }
    const ref = bucket[bucket.length - 1];
    if (Math.abs(p.y - ref.y) <= Math.max(2, ref.size * 0.55)) bucket.push(p);
    else { flush(); bucket = [p]; }
  }
  flush();
  return lines;
}

/** The strongest saturated colour on the cover, used as the brand candidate. */
function dominantColor(ctx: CanvasRenderingContext2D, w: number, h: number): string | undefined {
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, w, Math.min(h, Math.round(h * 0.45))).data; } catch { return undefined; }
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4 * 12) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min < 40 || max < 40 || max > 245) continue; // grey, black, paper
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    buckets.set(key, { n: cur.n + 1, r: cur.r + r, g: cur.g + g, b: cur.b + b });
  }
  const best = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  if (!best || best.n < 25) return undefined;
  const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}

// ═══ Pass 2 — remove furniture ═══════════════════════════════════════════════
// Which lines repeat on every page? Page numbers, "Confidential" footers, the
// running title. They are lifted out of the reading so they are never misread
// as headings, and kept as pre filled settings the user verifies instead of
// types.

function passRemoveFurniture(unpacked: Unpacked): Furnished {
  const { perPage } = unpacked;
  const pages = perPage.length;
  if (pages === 0) return { furniture: null, body: [], headerLines: new Set() };

  const heightOf = (page: Line[]) => Math.max(...page.map(l => l.y), 1);
  // Two lines are "the same line in the same place" when their text matches
  // with the digits masked (page numbers change) and they sit within a few
  // points of each other vertically.
  const slot = (line: Line) => `${Math.round(line.y / POSITION_TOLERANCE)}|${norm(line.text.replace(/\d+/g, '#'))}`;

  // THE FIRST THING PASS 2 DOES: any line that appears in the same position on
  // three or more pages is furniture. A running header, a footer, a page
  // number, a watermark, a letterhead strip. Content does not repeat itself in
  // the same spot page after page, so nothing here is ever content.
  const bySlot = new Map<string, { pages: Set<number>; top: number; text: string }>();
  perPage.forEach((page, pi) => {
    const height = Math.max(heightOf(page), 1);
    const bandTop = height * BAND;
    const inBand = (l: Line) => l.y <= bandTop || l.y >= height * (1 - BAND);
    for (const line of page) {
      // The one exception: a row of three or more aligned cells in the body of
      // the page is a table row, and a table continuing across pages repeats
      // its header row in exactly the same spot. Striking those would take the
      // column names with them. In the margins, three cells is still a running
      // header, so the band is exempt from the exception.
      if (line.cells.length >= 3 && !inBand(line)) continue;
      const key = slot(line);
      if (!key.split('|')[1]) continue;
      const cur = bySlot.get(key) ?? { pages: new Set<number>(), top: 0, text: line.text };
      cur.pages.add(pi);
      if (line.y <= bandTop) cur.top++;
      bySlot.set(key, cur);
    }
  });

  const header: string[] = [];
  const footer: string[] = [];
  /** Position-keyed slots to strike out, and their plain text keys. */
  const strikeSlots = new Set<string>();
  const headerLines = new Set<string>();
  let pageNumberPattern: string | undefined;

  for (const [key, v] of bySlot) {
    if (v.pages.size < REPEAT_PAGES) continue;
    strikeSlots.add(key);
    headerLines.add(key.split('|').slice(1).join('|'));
    if (PAGE_NUMBER.test(v.text.trim())) {
      pageNumberPattern = /of|\//i.test(v.text) ? 'Page N of M' : 'N';
      continue;
    }
    (v.top >= v.pages.size / 2 ? header : footer).push(v.text.trim());
  }

  // Second net, for documents whose furniture drifts a few points down the
  // page: the same short line recurring on most pages, wherever it sits.
  const loose = new Map<string, { count: number; top: number; text: string }>();
  perPage.forEach(page => {
    const bandTop = Math.max(heightOf(page), 1) * BAND;
    const local = new Set<string>();
    for (const line of page) {
      if (line.cells.length > 2 || line.text.length > 120) continue;
      const key = norm(line.text.replace(/\d+/g, '#'));
      if (!key || local.has(key)) continue;
      local.add(key);
      const cur = loose.get(key) ?? { count: 0, top: 0, text: line.text };
      loose.set(key, { count: cur.count + 1, top: cur.top + (line.y <= bandTop ? 1 : 0), text: cur.text });
    }
  });
  const threshold = Math.max(2, Math.ceil(pages * REPEAT_SHARE));
  for (const [key, v] of loose) {
    if (v.count < threshold || headerLines.has(key)) continue;
    headerLines.add(key);
    if (PAGE_NUMBER.test(v.text.trim())) {
      pageNumberPattern = /of|\//i.test(v.text) ? 'Page N of M' : 'N';
      continue;
    }
    (v.top >= v.count / 2 ? header : footer).push(v.text.trim());
  }

  // Single page reports have nothing repeating, which is a valid result.
  const body = perPage.map(page => page.filter(line => {
    if (strikeSlots.has(slot(line))) return false;
    return !headerLines.has(norm(line.text.replace(/\d+/g, '#')));
  }));

  const all = [...header, ...footer];
  const confidentiality = all.map(t => t.match(CONFIDENTIAL)?.[0]).find(Boolean);
  const furniture: ReadFurniture | null = all.length || pageNumberPattern
    ? { header, footer, pageNumberPattern, confidentiality, fields: {} }
    : null;

  markPageContinuations(body);

  return { furniture, body, headerLines };
}

/**
 * A paragraph does not stop at a page break. Once the furniture is gone, the
 * first line of a page is a continuation when it starts mid sentence, or when
 * the page before it ended without finishing one, and no heading sits above
 * it. Those lines join the previous page's last block instead of opening a
 * new one, so one paragraph is never read as two.
 */
function markPageContinuations(body: Line[][]): void {
  for (let pi = 1; pi < body.length; pi++) {
    const first = body[pi][0];
    if (!first) continue;
    const previousPage = body[pi - 1];
    const last = previousPage[previousPage.length - 1];
    if (!last) continue;

    const opensLower = /^["'“‘([]?[a-z]/.test(first.text.trim());
    const previousUnfinished = !/[.!?:;]["'”’)\]]?$/.test(last.text.trim());
    if (!opensLower && !previousUnfinished) continue;
    // A heading of its own is never a continuation, whatever it starts with.
    if (NUMBERED.test(first.text.trim()) || APPENDIX.test(first.text.trim())) continue;
    if (first.cells.length > 2) continue;                 // a table row carries on as a table

    first.continuation = true;
  }
}

/** Label and value pairs off the cover become pre filled settings. Only the
 *  labels matter; the values are read once so the user can confirm them. */
function deriveFields(lines: Line[]): ReadFurniture['fields'] {
  const fields: ReadFurniture['fields'] = {};
  for (const line of lines) {
    const pair = line.text.match(/^([A-Za-z][A-Za-z /.'-]{2,32})\s*[::]\s*(.+)$/)
      ?? (line.cells.length === 2 ? [null, line.cells[0].text, line.cells[1].text] as unknown as RegExpMatchArray : null);
    if (!pair) continue;
    const label = String(pair[1]).replace(/[::]\s*$/, '').trim();
    const value = String(pair[2]).trim();
    if (!value || value.length > 90) continue;
    for (const f of FIELD_LABELS) {
      if (f.re.test(label) && !fields[f.key]) fields[f.key] = value;
    }
  }
  return fields;
}

// ═══ Pass 3 — build the tree ═════════════════════════════════════════════════
// Which lines are headings, and in what order? Big, rare, numbered, alone on
// the line. Numbering depth is the level clue: "1." is a section, "1.1" is a
// block inside it, so the document's own nesting is matched rather than
// flattened. "…continued" pages merge back into the section they belong to.

type HeadingHit = { name: string; level: number; evidence: ReadEvidence; confidence: number; appendix: boolean };

function headingOf(line: Line, bodySize: number): HeadingHit | null {
  const text = line.text.trim();
  if (!text || text.length > 110) return null;
  if (line.cells.length > 2) return null;              // a table row, not a heading
  if (BLANK_PAGE.test(text)) return null;              // furniture-adjacent noise
  // Rule 4, pointer resolution. A heading carrying a cross reference is a link
  // to a section, not a section: "Procedures — (see section 7.1)" belongs to
  // the summary list it sits in. It stays a list item under its parent and no
  // second section is created for the same content.
  if (POINTER.test(text)) return null;
  // A date row reads as numbered text ("17 July 2026 …") but numbers a day,
  // not a section, so the guards below apply to numbered lines as well.
  if (!APPENDIX.test(text)) {
    // A line ending in a colon is leading into a list, and a line that is
    // mostly digits is a date or a reference. Neither names a section.
    if (/[.;,:]$/.test(text)) return null;
    if (/^[A-Z]{1,3}\d{3,}\b/.test(text)) return null;
    const digits = (text.match(/\d/g) ?? []).length;
    if (digits > text.replace(/\s/g, '').length * 0.4) return null;
    // "Audit of Revenue Recognition — Reasonable assurance (June 2024)" is a
    // list entry: a name, a dash, then its value. Headings do not carry values.
    if (/\s[—–]\s\S/.test(text)) return null;
    if (/\)\s*$/.test(text) && /\s[—–(]/.test(text)) return null;
    // A single word is a fragment of a wrapped line far more often than it is
    // a section, so only the words that really do name sections pass.
    if (text.split(/\s+/).length < 2 && !SINGLE_WORD_SECTION.test(text)) return null;
  }

  const appendix = APPENDIX.exec(text);
  if (appendix) {
    const tail = appendix[3]?.replace(/^[\s—–\-:·]+/, '').trim();
    return {
      name: tail ? `${titleCase(appendix[1])} ${appendix[2]}: ${tail}` : `${titleCase(appendix[1])} ${appendix[2]}`,
      level: 1, evidence: 'explicit', confidence: 0.92, appendix: true,
    };
  }

  const numbered = NUMBERED.exec(text);
  if (numbered && !sentenceish(numbered[2])) {
    const depth = numbered[1].split('.').length;
    return { name: numbered[2].trim(), level: Math.min(depth, 3), evidence: 'explicit', confidence: 0.9, appendix: false };
  }

  const lettered = LETTERED.exec(text);
  if (lettered && !sentenceish(lettered[2]) && line.bold) {
    return { name: lettered[2].trim(), level: 2, evidence: 'inferred', confidence: 0.7, appendix: false };
  }

  const big = line.size >= bodySize * HEADING_SIZE;
  const words = text.split(/\s+/).length;
  const caps = text === text.toUpperCase() && /[A-Z]{3}/.test(text);
  const alone = line.cells.length === 1;

  // Bold alone is not enough. A finding title is bold too, and promoting every
  // bold line is exactly the flat-detection failure: size or capitals have to
  // agree before a line is called a heading.
  if (alone && words <= 12 && (big || caps)) {
    const strong = big && (line.bold || caps);
    return {
      name: titleCaseIfCaps(text),
      level: big ? 1 : 2,
      evidence: strong ? 'explicit' : 'inferred',
      confidence: strong ? 0.85 : 0.6,
      appendix: false,
    };
  }
  return null;
}

/** A shouted line reads better in title case, but the words that are genuinely
 *  abbreviations stay shouted: FY2026 must not become Fy2026. */
const titleCaseIfCaps = (s: string) =>
  s === s.toUpperCase() && s.length > 3
    ? s.split(/\s+/).map(w => (/\d/.test(w) || w.replace(/\W/g, '').length <= 4 ? w : titleCase(w.toLowerCase()))).join(' ')
    : s;

function passBuildTree(furnished: Furnished, unpacked: Unpacked): Tree {
  const { bodySize } = unpacked;
  const spine: SpineSection[] = [];
  const cover: Line[] = [];
  const skipped: string[] = [];
  let current: SpineSection | null = null;
  let docEntries = 0;
  let inContents = false;

  furnished.body.forEach((page, pi) => {
    for (const line of page) {
      // The report's own contents page is never copied into the template; our
      // export engine rebuilds one. It is read only as the sanity check.
      if (CONTENTS.test(line.text.trim())) { inContents = true; continue; }
      if (inContents) {
        const entry = /\.{3,}\s*\d+$|\s\d{1,3}$/.test(line.text.trim());
        if (entry) { docEntries++; continue; }
        // Two ordinary lines in a row end the contents page.
        if (line.text.trim().length > 60 || headingOf(line, bodySize)) inContents = false;
        else continue;
      }

      // A line that carries on the previous page's sentence is body text, even
      // if its size or capitals would otherwise read as a heading.
      const hit = line.continuation ? null : headingOf(line, bodySize);
      if (!hit) {
        if (current) current.lines.push(line);
        else if (pi === 0) cover.push(line);
        continue;
      }

      // The cover is a letterhead, not the first section. Until the report's
      // own numbering starts, page one is read as cover: its title and its
      // label-and-value pairs become settings, never headings.
      if (!current && pi === 0 && hit.evidence !== 'explicit') { cover.push(line); continue; }
      if (!current && pi === 0 && !hit.appendix && !NUMBERED.test(line.text.trim())) { cover.push(line); continue; }

      // A "…continued" heading, or the same heading again on the next page, is
      // one section spilling over, not two sections.
      const continued = CONTINUED.test(line.text.trim());
      const sameAsCurrent = current && norm(hit.name) === norm(current.name);
      if (current && (continued || sameAsCurrent)) continue;

      // Numbering depth decides the level: a level 2 heading is a block inside
      // the section above it, so sub headings never inflate the section list.
      if (hit.level > 1 && current) {
        current.lines.push({ ...line, text: `§§${hit.name}` });
        continue;
      }

      current = {
        name: hit.name,
        level: 1,
        page: line.page,
        evidence: hit.evidence,
        confidence: hit.confidence,
        appendix: hit.appendix,
        wrapper: line.page <= 2 && WRAPPER.test(line.text),
        lines: [],
      };
      spine.push(current);
    }
  });

  const resolved = foldLookAlikes(spine);

  // A heading with no prose beneath it is not a section. It is never dropped in
  // silence either: the caller offers it back.
  const kept: SpineSection[] = [];
  for (const s of resolved) {
    const prose = s.lines.some(l => !l.text.startsWith('§§') && l.text.trim().length > 3);
    if (prose) kept.push(s);
    else skipped.push(s.name);
  }

  const detected = Math.min(kept.length, SECTION_CAP);
  const toc: ReadTocCheck | undefined = docEntries > 0
    ? {
      docEntries,
      detected,
      // Relative, never absolute. Only a big gap either way is a real signal.
      verdict: detected > docEntries * 1.5 ? 'over-split'
        : detected < docEntries * 0.6 ? 'under-detected'
          : 'match',
    }
    : undefined;

  return { spine: kept.slice(0, SECTION_CAP), skipped, cover, toc };
}

/**
 * The look-alike traps: things that resemble a section but are not one.
 *
 *  · A run of three or more bare headings with nothing beneath them is a LIST,
 *    not three sections. Glossary terms, a summary's preview bullets and the
 *    rows of a definitions table all arrive in exactly this shape, so they fold
 *    back into the section above them as content.
 *  · Two sections with the same title, or a title that only differs by its
 *    cross-reference suffix, are one section written twice. Rule 4's backstop:
 *    merge them and flag the survivor so the user takes a look.
 */
function foldLookAlikes(spine: SpineSection[]): SpineSection[] {
  const hasProse = (s: SpineSection) => s.lines.some(l => !l.text.startsWith('§§') && l.text.trim().length > 3);

  // Fold runs of bare headings into the section that carries them.
  const folded: SpineSection[] = [];
  let i = 0;
  while (i < spine.length) {
    let run = 0;
    while (i + run < spine.length && !hasProse(spine[i + run])) run++;
    if (run >= 3 && folded.length > 0) {
      const parent = folded[folded.length - 1];
      for (let k = 0; k < run; k++) {
        const item = spine[i + k];
        parent.lines.push({ text: item.name, cells: [{ text: item.name, x: 0, right: 0 }], x: 0, y: 0, size: 0, bold: false, page: item.page });
        parent.lines.push(...item.lines);
      }
      i += run;
      continue;
    }
    folded.push(spine[i]);
    i++;
  }

  // Merge the duplicates a pointer leaves behind.
  const byTitle = new Map<string, SpineSection>();
  const out: SpineSection[] = [];
  for (const s of folded) {
    const key = norm(s.name.replace(POINTER, '').replace(/[()—–\-:,]+\s*$/, ''));
    const first = key ? byTitle.get(key) : undefined;
    if (first) {
      first.lines.push(...s.lines);
      // Two headings resolving to one section is exactly the case worth a
      // second pair of eyes, so the survivor goes into the check queue.
      first.evidence = 'inferred';
      first.confidence = Math.min(first.confidence, 0.6);
      continue;
    }
    if (key) byTitle.set(key, s);
    out.push(s);
  }
  return out;
}

// ═══ Pass 4 — classify blocks ════════════════════════════════════════════════
// Inside a section, what is each chunk? Geometry answers, not vocabulary:
// aligned columns are a table, big numbers with small captions are a stat
// strip, a short label with a value is a slot, an indented note is a callout,
// everything else is prose.

function passClassifyBlocks(section: SpineSection, bodySize: number): RawBlock[] {
  const blocks: RawBlock[] = [];
  const lines = section.lines;
  let i = 0;
  let subLabel: string | undefined;

  const pushNarrative = (buf: Line[]) => {
    if (buf.length === 0) return;
    blocks.push({
      kind: 'narrative',
      label: subLabel,
      confidence: 0.9,
      page: buf[0].page,
      lines: buf.map(l => l.text),
    });
    subLabel = undefined;
  };

  let prose: Line[] = [];
  while (i < lines.length) {
    const line = lines[i];

    // The page break rule: this line finishes the sentence the previous page
    // left open, so it joins that page's last block instead of starting one.
    if (line.continuation) {
      if (prose.length > 0) { prose.push(line); i++; continue; }
      const previous = blocks[blocks.length - 1];
      if (previous) { previous.lines.push(line.text); i++; continue; }
    }

    // A sub heading kept from pass 3 labels the block that follows it.
    if (line.text.startsWith('§§')) {
      pushNarrative(prose); prose = [];
      subLabel = line.text.slice(2).trim();
      i++;
      continue;
    }

    // Table: two or more consecutive rows sharing at least two columns.
    const run = tableRun(lines, i);
    if (run > 1) {
      pushNarrative(prose); prose = [];
      const rows = lines.slice(i, i + run);
      const head = rows[0];
      // Column names come from the header row only when it reads like one:
      // short labels, no numbers, no sentences. A first data row would
      // otherwise be saved as the column names, which is worse than none.
      const looksLikeHeader = head.cells.every(c =>
        c.text.split(/\s+/).length <= 4 && c.text.length <= 40 && !isNumeric(c.text));
      const columns = looksLikeHeader && (head.bold || head.text === head.text.toUpperCase() || rows.length > 2)
        ? head.cells.map(c => titleCaseIfCaps(c.text)).filter(Boolean)
        : undefined;
      blocks.push({
        kind: 'table',
        label: subLabel,
        columns: columns && columns.length >= 2 ? columns : undefined,
        confidence: columns ? 0.85 : 0.62,
        page: head.page,
        lines: rows.map(r => r.text),
      });
      subLabel = undefined;
      i += run;
      continue;
    }

    // Stat strip: a row of numbers with a caption row above or below. This and
    // a tiny two column table look almost identical, so confidence stays low
    // and the review screen surfaces it.
    const stat = statAt(lines, i, bodySize);
    if (stat) {
      pushNarrative(prose); prose = [];
      blocks.push({ kind: 'stat', label: subLabel, slotLabels: stat.captions, confidence: 0.6, page: line.page, lines: stat.lines });
      subLabel = undefined;
      i += stat.consumed;
      continue;
    }

    // Slot: a short label with a value beside it. The label survives, the value
    // is thrown away, which is exactly the fill in the blank shape.
    const slots = slotRun(lines, i);
    if (slots) {
      pushNarrative(prose); prose = [];
      blocks.push({ kind: 'slot', label: subLabel, slotLabels: slots.labels, confidence: 0.75, page: line.page, lines: slots.lines });
      subLabel = undefined;
      i += slots.consumed;
      continue;
    }

    // Callout: text set apart as a note or key message.
    if (/^(note|important|key (message|point)|please note|caution|disclaimer)\b/i.test(line.text)) {
      pushNarrative(prose); prose = [];
      blocks.push({ kind: 'callout', label: subLabel, confidence: 0.65, page: line.page, lines: [line.text] });
      subLabel = undefined;
      i++;
      continue;
    }

    prose.push(line);
    i++;
  }
  pushNarrative(prose);

  // A section made only of a signature list is a sign off block, roles kept.
  if (SIGNOFF.test(section.name)) {
    const roles: string[] = [];
    const add = (role: string) => {
      const clean = role.replace(/\s+/g, ' ').trim();
      // Their casing, kept: "Head of Internal Audit", never "Head Of Internal
      // Audit". The role labels are the whole point of the block.
      if (clean && !roles.some(r => norm(r) === norm(clean))) roles.push(clean);
    };
    for (const l of lines) {
      // A signature row: two to four short title cells side by side, at least
      // one of which reads like a role. This is how sign-off pages are laid
      // out, and it carries the roles a plain phrase match misses.
      if (l.cells.length >= 2 && l.cells.length <= 4
        && l.cells.every(c => c.text.length <= 44 && c.text.split(/\s+/).length <= 5 && /^[A-Z]/.test(c.text))
        && l.cells.some(c => ROLE_TITLE.test(c.text))) {
        l.cells.forEach(c => add(c.text));
        continue;
      }
      const m = l.text.match(ROLE);
      if (m) add(m[0]);
    }
    if (roles.length) return [{ kind: 'signoff', signRoles: roles, confidence: 0.85, page: section.page, lines: [] }];
  }

  return blocks;
}

/** How many consecutive lines from `i` read as one table. */
function tableRun(lines: Line[], i: number): number {
  const first = lines[i];
  // Wrapped prose can fall into two cells by accident, so a table row also has
  // to be made of short cells, not sentences.
  const cellish = (l: Line) => l.cells.length >= 2 && l.cells.filter(c => c.text.length <= 60).length >= 2;
  if (!first || !cellish(first)) return 0;
  let n = 1;
  while (i + n < lines.length) {
    const next = lines[i + n];
    if (next.text.startsWith('§§') || !cellish(next)) break;
    // Columns line up when a cell starts near a cell of the first row.
    const aligned = next.cells.filter(c => first.cells.some(f => Math.abs(f.x - c.x) < 12)).length;
    if (aligned < Math.min(2, first.cells.length)) break;
    n++;
  }
  return n;
}

/** A stat strip: a numbers row plus its captions. */
function statAt(lines: Line[], i: number, bodySize: number): { captions: string[]; lines: string[]; consumed: number } | null {
  const line = lines[i];
  if (!line || line.cells.length < 2) return null;
  const numeric = line.cells.filter(c => isNumeric(c.text)).length;
  if (numeric < 2 || numeric < line.cells.length - 1) return null;
  if (line.size < bodySize * 1.2) return null;         // big numbers, not a data row
  const next = lines[i + 1];
  const captions = next && next.cells.length >= numeric && next.cells.every(c => c.text.split(/\s+/).length <= 4)
    ? next.cells.map(c => titleCaseIfCaps(c.text))
    : [];
  return { captions, lines: [line.text, ...(captions.length ? [next.text] : [])], consumed: captions.length ? 2 : 1 };
}

/** A run of label and value pairs. */
function slotRun(lines: Line[], i: number): { labels: string[]; lines: string[]; consumed: number } | null {
  const labels: string[] = [];
  const used: string[] = [];
  let n = 0;
  while (i + n < lines.length) {
    const line = lines[i + n];
    if (line.text.startsWith('§§')) break;
    const inline = line.text.match(/^([A-Za-z][A-Za-z /.'-]{2,34})\s*[::]\s*(\S.+)$/);
    const twoCell = line.cells.length === 2 && line.cells[0].text.length <= 34 && !sentenceish(line.cells[1].text);
    if (!inline && !twoCell) break;
    labels.push(titleCaseIfCaps((inline ? inline[1] : line.cells[0].text).replace(/[::]\s*$/, '').trim()));
    used.push(line.text);
    n++;
  }
  return n >= 2 ? { labels, lines: used, consumed: n } : null;
}

// ═══ Pass 5 — spot repeats ═══════════════════════════════════════════════════
// Does any shape appear more than once? Save it once and mark it as repeating.
// Two findings or two hundred, the template stores the shape and never the
// count, so the next report can stamp three or thirty.

function passSpotRepeats(blocks: RawBlock[]): RawBlock[] {
  // A run of same shaped blocks carrying finding IDs is one repeating card.
  const ids = blocks.flatMap(b => b.lines.map(l => l.match(FINDING_ID)?.[0]).filter(Boolean) as string[]);
  // Distinct IDs, not occurrences: the same reference quoted twice in one
  // paragraph is a mention, while two different IDs are two stamped cards.
  const patterns = new Map<string, Set<string>>();
  for (const id of ids) {
    const key = generalisePattern(id);
    (patterns.get(key) ?? patterns.set(key, new Set()).get(key)!).add(id);
  }
  const best = [...patterns.entries()].sort((a, b) => b[1].size - a[1].size)[0];
  const idPattern = best?.[0];
  const idCount = best?.[1].size ?? 0;

  const out: RawBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const sig = signature(blocks[i]);
    let n = 1;
    while (i + n < blocks.length && signature(blocks[i + n]) === sig) n++;

    if (n >= 2 && blocks[i].kind === 'table') {
      // One table split across pages is still one table. Repeating rows are
      // what a table already does, so it never becomes a card.
      out.push({ ...blocks[i], lines: blocks.slice(i, i + n).flatMap(b => b.lines) });
      i += n;
      continue;
    }
    if (n >= 2 && blocks[i].kind !== 'narrative') {
      // Same shape twice or more: one card, count discarded.
      out.push({ ...blocks[i], kind: 'cards', cardCount: n, lines: blocks[i].lines, confidence: 0.8 });
      i += n;
      continue;
    }
    out.push(blocks[i]);
    i++;
  }

  // Findings written as prose still repeat: the ID pattern is the giveaway.
  if (idPattern && idCount >= 2) {
    const first = out.findIndex(b => b.lines.some(l => FINDING_ID.test(l)));
    // A TABLE keyed by the finding IDs is the action-plan pattern: it is built
    // from the findings, not a second stack of finding cards. It keeps its
    // columns and is marked as derived instead of being restamped.
    if (first >= 0 && (out[first].kind === 'table' || out[first].kind === 'stat')) {
      out[first] = { ...out[first], idPattern, cardCount: idCount, linkedTo: out[first].linkedTo ?? 'findings' };
    } else if (first >= 0 && out[first].kind !== 'cards') {
      const fields = cardFieldsFrom(out.slice(first).flatMap(b => b.lines));
      out[first] = {
        ...out[first],
        kind: 'cards',
        idPattern,
        cardCount: idCount,
        cardFields: fields.fields.length ? fields.fields : undefined,
        humanFields: fields.human.length ? fields.human : undefined,
        confidence: 0.78,
      };
    } else if (first >= 0) {
      out[first] = { ...out[first], idPattern, cardCount: idCount };
    }
  }
  return out;
}

const signature = (b: RawBlock) =>
  `${b.kind}:${(b.columns ?? []).join('|')}:${(b.slotLabels ?? []).length}`;

/** The field labels a finding card carries, and the ones only a person fills. */
function cardFieldsFrom(lines: string[]): { fields: string[]; human: string[] } {
  const known = [
    'Condition', 'Criteria', 'Cause', 'Effect', 'Impact', 'Observation', 'Risk',
    'Risk rating', 'Rating', 'Recommendation', 'Owner', 'Responsibility',
    'Due date', 'Target date', 'Management response', 'Agreed action', 'Status',
  ];
  const humanOnly = /^(management response|agreed action|owner|responsibility|due date|target date)$/i;
  const fields: string[] = [];
  const human: string[] = [];
  for (const label of known) {
    const re = new RegExp(`^\\s*${label}\\s*[::]`, 'i');
    if (!lines.some(l => re.test(l))) continue;
    fields.push(label);
    if (humanOnly.test(label)) human.push(label);
  }
  return { fields, human };
}

// ═══ Pass 6 — the two detectors ══════════════════════════════════════════════
//
// V1 keeps exactly two kinds of section: the ones that FILL FROM AUDIT DATA and
// the ones that are FIXED TEXT. Everything else is dropped from the template
// and said once, honestly, at review. There is no "who fills this?" question to
// answer, because a template that keeps a section we cannot fill is a template
// full of empty boxes. Anything else the client wants in a report they add per
// report through Add Observation, a flow that already exists.
//
// The template is their skin on our data.

/** Headings that name something our generator already produces. Wording is a
 *  weak signal on its own, which is why it is paired with position below: a
 *  rollup of recommendations comes AFTER the findings it rolls up. */
const CONCEPT_TITLES: { re: RegExp; binding: DataBinding; word: string; needsPosition: boolean }[] = [
  // Titles that say "rollup" outright. A report may summarise its
  // recommendations before it details them, so these do not depend on order,
  // only on the report having findings to roll up at all.
  { re: /\b(summary of recommendations?|recommendations? summary|summary of actions?|action plan|agreed actions?|management actions?|management response summary)\b/i, binding: 'actions', word: 'recommendations', needsPosition: false },
  { re: /\b(summary of (findings?|observations?|exceptions?)|findings? summary)\b/i, binding: 'findings', word: 'findings', needsPosition: false },
  { re: /\b(executive summary|overall (opinion|conclusion)|audit opinion|assurance opinion|conclusion)\b/i, binding: 'summary', word: 'summary', needsPosition: false },
  // A bare "Recommendations" heading could be the client's own advice, so this
  // one leans on position: after the findings, it is a rollup of them.
  { re: /\b(recommendations?|grading of (audit )?recommendations?)\b/i, binding: 'actions', word: 'recommendations', needsPosition: true },
];

/**
 * The concept a heading names. Wording alone is weak, so it is read together
 * with the report itself: an explicit rollup title counts whenever the report
 * has findings to roll up, and a bare one counts once the findings have
 * already appeared above it.
 */
function conceptOf(
  sectionName: string, findingsSeen: boolean, docHasFindings: boolean,
): { binding: DataBinding; word: string } | undefined {
  const hit = CONCEPT_TITLES.find(c => c.re.test(sectionName));
  if (!hit) return undefined;
  if (hit.needsPosition ? !findingsSeen : !docHasFindings) return undefined;
  return { binding: hit.binding, word: hit.word };
}

type Detected =
  | { keep: 'query'; binding?: DataBinding; why: string; shaky?: boolean }
  | { keep: 'fixed'; why: string; shaky?: boolean }
  | { keep: null; why: string; shaky?: undefined };

/** Context both detectors read: the report's own rating words, its finding
 *  reference shape, and how often a block's text appears in the document. */
type DetectContext = {
  scale?: string[];
  /** Organisations this report names, read from its letterhead and cover. */
  orgNames?: string[];
  /** Both scales the report speaks: finding ratings AND opinion levels. A
   *  legend table is built from either. */
  definitionWords?: string[];
  idPattern?: string;
  /** Normalised block text → how many times it appears in the report. */
  repeats: Map<string, number>;
  sectionName: string;
  /** What the HEADING says this section is, when it names a concept we
   *  generate, and whether its position agrees (a recommendations rollup sits
   *  after the findings, not before them). */
  concept?: { binding: DataBinding; word: string };
};

const bodyKey = (lines: string[]) => norm(lines.join(' ')).slice(0, 160);

/** Values that change from one report to the next. Fingerprint 1 of detector 2
 *  is the gate: one of these inside a block and it is not fixed text. */
/** The only figures a template may hold: a duration that states a rule ("within
 *  90 days"), and a list number. Everything else with a digit in it is this
 *  report's data, not the client's format. */
const RULE_FIGURE = /\b\d{1,3}\s?(?:calendar\s|working\s|business\s)?(?:day|days|week|weeks|month|months|year|years)\b/gi;
const LIST_NUMBER = /(?:^|\n)\s*\(?\d{1,2}[.)]\s/g;

/** An organisation this report names. Any of them, and the wording belongs to
 *  one report rather than to the format. */
const ORG_NAME = /\b[A-Z][\w&.'’-]*(?:\s+[A-Z][\w&.'’-]*)*\s+(limited|ltd\.?|inc\.?|plc|llp|llc|gmbh|s\.a\.|corporation|corp\.?|company|pvt\.?|holdings|group)\b/i;
/** A reference code: IA/FY26/FC-04, J2601, ITGC-03. */
const REFERENCE_CODE = /\b[A-Z]{1,5}\/[A-Z0-9]{2,}(?:\/[A-Z0-9-]+)*\b|\b[A-Z]{2,6}-\d{1,4}\b|\b[A-Z]\d{4,}\b/;

/**
 * Fingerprint 1, the gate. A block is fixed text only if it carries no number,
 * date, reference or organisation name that changes from one report to the
 * next. Anything that does, and that no audit-data check claimed, is dropped
 * rather than kept: printing last quarter's figures as this quarter's
 * boilerplate is the worst thing the template could do.
 */
function hasVariableData(text: string, orgNames: string[] = []): boolean {
  // Strip the two figures a format is allowed to state, then any digit still
  // standing is a value from this particular report.
  const stripped = text.replace(RULE_FIGURE, ' ').replace(LIST_NUMBER, ' ');
  if (/\d/.test(stripped)) return true;
  if (FINDING_ID.test(text) || REFERENCE_CODE.test(text)) return true;
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(text)) return true;
  if (/[₹$£€]/.test(text)) return true;
  if (ORG_NAME.test(text)) return true;
  return orgNames.some(name => name.length > 3 && text.toLowerCase().includes(name.toLowerCase()));
}

/**
 * Detector 1 — does this block fill from audit data?
 *
 * One question: could our generator have produced this shape? Shape, never
 * wording. Heading text is unreliable across clients ("Findings" here,
 * "Detailed observations" there); structure is not. Five checks, each carrying
 * the reason shown on the badge.
 */
function detectAuditData(block: RawBlock, ctx: DetectContext): Detected | null {
  const text = block.lines.join('\n');
  const scaleWords = ctx.scale?.length
    ? new RegExp(`\\b(${ctx.scale.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
    : null;
  const ratingHits = scaleWords ? (text.match(scaleWords) ?? []).length : 0;
  const idHits = ctx.idPattern ? (text.match(idPatternToRegex(ctx.idPattern)) ?? []).length : 0;

  // Check 1 — a repeating shape whose slots carry the report's own rating
  // words. Only findings repeat WITH a rating: scope lists and appendix rows
  // repeat without one.
  if (block.kind === 'cards') {
    const rated = ratingHits >= 1 || (block.cardFields ?? []).some(f => /rating|severity|priority|grading/i.test(f));
    return rated
      ? { keep: 'query', binding: 'findings', why: 'Kept: a card that repeats with a rating on it. Only findings repeat with a rating, so this is ours to fill.' }
      : null;
  }

  // Check 2 — stat cards whose captions count things we record. The caption
  // decides, not the card shape: "₹1,78,650 cr Revenue" is the same shape and
  // is not ours to fill.
  if (block.kind === 'stat') {
    const labels = block.slotLabels ?? [];
    const counted = labels.filter(l => COUNT_NOUN.test(l)).length;
    const money = labels.filter(l => MONEY_NOUN.test(l)).length;
    if (counted > 0 && money > 0) {
      return { keep: 'query', binding: 'metrics', shaky: true, why: 'Kept, but worth a look: some of these captions count things we record and others are money, which we cannot produce.' };
    }
    if (counted >= 1 && counted >= labels.length - 1) {
      return { keep: 'query', binding: 'metrics', why: 'Kept: a row of numbers counting things we record, such as exceptions and findings.' };
    }
    return null;
  }

  // Check 3 — a table keyed by the finding IDs is built FROM the findings, so
  // it is generatable too. Keyed by vendor names or account numbers, it is not.
  if (block.kind === 'table') {
    return block.linkedTo || idHits >= 2
      ? { keep: 'query', binding: 'actions', why: 'Kept: a table using the finding numbers, so it is built from the findings rather than typed fresh.' }
      : null;
  }

  // Check 5 — label and value slots the system already knows for every report.
  if (block.kind === 'slot') {
    const labels = block.slotLabels ?? [];
    const known = labels.filter(l => METADATA_LABEL.test(l.trim())).length;
    return known >= 1 && known >= labels.length - 1
      ? { keep: 'query', why: 'Kept: boxes for details we already know, such as the title, the period and the date.' }
      : null;
  }

  // Check 4 — prose that rolls up the things above. Text summarising
  // generatable things is itself generatable; prose about the organisation,
  // the methodology or the scope shares nothing with the findings.
  if (block.kind === 'narrative' || block.kind === 'callout') {
    const counts = (text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(findings?|exceptions?|observations?|issues?|recommendations?|actions?)\b/gi) ?? []).length;
    const signals = [ratingHits >= 2, idHits >= 2, counts >= 1].filter(Boolean).length;
    return signals >= 2
      ? { keep: 'query', binding: 'summary', why: 'Kept: text that sums up the findings, and a summary of what we produce is something we can produce.' }
      : null;
  }

  return null;
}

/**
 * Detector 2 — is this block fixed text?
 *
 * Four fingerprints. The first is the gate: text carrying even one per-report
 * value cannot print identically next quarter. Past the gate, one of the other
 * three has to agree.
 */
function detectFixedText(block: RawBlock, ctx: DetectContext): Detected | null {
  if (block.kind === 'cards' || block.kind === 'stat' || block.kind === 'signoff' || block.kind === 'chart') return null;
  const text = block.lines.join('\n');
  if (!text.trim()) return null;

  // Fingerprint 1 · the gate — nothing inside that changes per report.
  if (hasVariableData(text, ctx.orgNames)) return null;

  // Fingerprint 2 · definition or legend structure: a table whose rows are the
  // rating words the scale detector already found. Definitions describe the
  // scale, not this audit.
  const scaleWords = ctx.definitionWords ?? ctx.scale ?? [];
  const definitionRows = block.kind === 'table' && scaleWords.length
    ? block.lines.filter(l => scaleWords.some(w => l.toLowerCase().trimStart().startsWith(w.toLowerCase()))).length
    : 0;
  if (definitionRows >= 2) {
    return { keep: 'fixed', why: 'Kept word for word: a table of definitions. It explains the words, not this audit, so it holds for every report.' };
  }

  // Fingerprint 3 · formal or regulatory phrasing. Paraphrasing a conformance
  // statement changes what it certifies, so the wording must not vary.
  if (FIXED_PHRASE.test(text) || CONFIDENTIAL.test(text)) {
    return { keep: 'fixed', why: 'Kept word for word: formal wording. Change it and you change what it promises.' };
  }

  // Fingerprint 4 · front or back matter, or text repeated word for word. Text
  // the document itself repeats is already behaving as boilerplate.
  const repeated = (ctx.repeats.get(bodyKey(block.lines)) ?? 0) >= 2;
  if (repeated) {
    return { keep: 'fixed', why: 'Kept word for word: the same wording shows up twice in their report, so it is already behaving as fixed wording.' };
  }

  // The weak end of fingerprint 4: the heading says this is front or back
  // matter, and nothing inside changes, but nothing else agrees. Kept and
  // flagged, because only the client knows whether these words really hold.
  const instructional = FIXED_NAME.test(ctx.sectionName) || FIXED_NAME.test(block.label ?? '');
  if (instructional) {
    return { keep: 'fixed', shaky: true, why: 'Looks fixed, please confirm: it explains the document rather than the audit, and nothing inside it changes.' };
  }

  // The gate alone proves nothing. Prose can be free of dates and amounts and
  // still be this quarter's writing, so it is not claimed as boilerplate.
  return null;
}

/** Check 4, second half: the shape said nothing, but the HEADING names a
 *  concept we generate and it sits where that concept belongs. A "Summary of
 *  recommendations" after the findings is a rollup of recommendations we
 *  already write, whatever words its paragraphs happen to share with them. */
const ROLLUP_COLUMN = /\b(ref|rating|severity|priority|grading|action|recommendation|owner|responsib\w*|due|target|status|finding|observation|exception|area|cycle|process|critical|high|medium|low|total|count)\b/i;

function detectByTitle(block: RawBlock, ctx: DetectContext, firstProse: boolean): Detected | null {
  if (!ctx.concept) return null;
  if (block.kind === 'cards' || block.kind === 'signoff') return null;
  // A rollup is its opening paragraph and the table that carries it. The rest
  // of a long section still has to earn its place through the shape checks,
  // or the heading alone would drag every block under it into the template.
  if (block.kind === 'narrative' || block.kind === 'callout') {
    if (!firstProse) return null;
  } else if (block.kind === 'table' || block.kind === 'stat') {
    const named = [...(block.columns ?? []), ...(block.slotLabels ?? [])];
    if (!named.some(c => ROLLUP_COLUMN.test(c))) return null;
  } else {
    return null;
  }
  return {
    keep: 'query',
    binding: ctx.concept.binding,
    why: `Kept: a summary of the ${ctx.concept.word} we produce, judged by what the heading means and where it sits.`,
  };
}

function detectBlock(block: RawBlock, ctx: DetectContext, firstProse = false): Detected {
  return detectAuditData(block, ctx)
    ?? detectByTitle(block, ctx, firstProse)
    ?? detectFixedText(block, ctx)
    ?? { keep: null, why: 'Not included: nothing here comes from audit results, and it is not wording that never changes.' };
}

/** What the section is about, read from its own body. Never a quote: the
 *  template holds zero content, so the line names the subject, it does not
 *  repeat their words. Works on a section nobody has seen before, because the
 *  question "what does this section contain?" is answerable from any body. */
const TOPIC_CUES: { re: RegExp; says: string }[] = [
  { re: /\b(rating|grading|definitions?|criteria|scale)\b/i, says: 'the rating words this report uses' },
  { re: /\b(recommendations?|agreed actions?|action plan|remediation)\b/i, says: 'the recommendations and who owns them' },
  { re: /\b(findings?|exceptions?|weakness(es)?|observations?|deficienc\w+)\b/i, says: 'the findings raised' },
  { re: /\b(opinion|assurance|conclusions?)\b/i, says: 'the opinion and what it rests on' },
  { re: /\b(scopes?|in scope|out of scope|coverage|period covered)\b/i, says: 'what the audit covered' },
  { re: /\b(objectives?|purpose)\b/i, says: 'what the audit set out to test' },
  { re: /\b(distribut\w+|recipients?|circulat\w+|version history|issued to)\b/i, says: 'who receives the report and when' },
  { re: /\b(revenue|margins?|cash|ratios?|segments?|financial statements?|balance sheet|profitability)\b/i, says: 'the financial numbers behind the review' },
  { re: /\b(control environment|coso|control cycles?|entity level|processes)\b/i, says: 'the control areas assessed' },
  { re: /\b(signatures?|signed|sign[\s-]?off|approved by)\b/i, says: 'who signs the report off' },
  { re: /\b(sources?|basis of preparation|data used|methodolog\w+)\b/i, says: 'where the information came from' },
  { re: /\b(risks?|risk assessment)\b/i, says: 'the risks in view' },
  { re: /\b(samples?|sampling|tested|testing|walkthroughs?|procedures)\b/i, says: 'how the work was carried out' },
  { re: /\b(limitations?|constraints?|caveats?)\b/i, says: 'the limits on what this work can say' },
  { re: /\b(introduction|background|about (the|this))\b/i, says: 'the background to the review' },
];

/** The heading answers the question far more reliably than the body, so it
 *  carries the weight. The body only breaks a tie. */
function topicOf(name: string, body: string): string | undefined {
  let best: { says: string; score: number } | null = null;
  for (const cue of TOPIC_CUES) {
    const inName = cue.re.test(name) ? 5 : 0;
    const inBody = (body.match(new RegExp(cue.re.source, 'gi')) ?? []).length;
    // The body can only break a tie between headings, never outvote one. A
    // findings section is full of the word "rating" and is still a findings
    // section.
    // A cue found only in the body has to be insistent (three mentions or
    // more) before it names the section. A wrong line is worse than none.
    const score = inName + (inBody >= 3 ? 3 : inBody >= 1 ? 1 : 0);
    if (score >= 3 && (!best || score > best.score)) best = { says: cue.says, score };
  }
  return best?.says;
}

const SHAPE_WORDS: Record<string, string> = {
  narrative: 'writing', table: 'a table', stat: 'a row of numbers',
  slot: 'boxes to fill in', callout: 'a highlighted note', chart: 'a chart',
  cards: 'one card each', signoff: 'signature lines',
};

function describe(section: SpineSection, fill: SectionFill, blocks: ReadBlock[], severity?: string): string {
  const shapes = [...new Set(blocks.map(b => b.kind))];
  const topic = topicOf(section.name, section.lines.map(l => l.text).join('\n'));

  // Rule 1 · a description is timeless. A severity-split section says which
  // rating it holds, because that is true of every report it will ever
  // produce, unlike "2 findings were rated high", which is one upload's data.
  const subject = severity ? `findings rated ${severity.toLowerCase()}` : topic;
  const carries = shapes.length
    ? `${subject ? `${subject.charAt(0).toUpperCase()}${subject.slice(1)}, in ` : 'Holds '}${shapes.map(s => SHAPE_WORDS[s] ?? s).join(', ')}.`
    : subject ? `${subject.charAt(0).toUpperCase()}${subject.slice(1)}.` : '';
  // Nothing to say about it honestly. The review card then asks for the line
  // instead of printing a placeholder that reads as broken.
  if (!carries) return '';

  const filled =
    fill === 'query' ? 'Filled from your audit results.'
      : fill === 'fixed' ? 'Prints the same every time.'
        : fill === 'human' ? 'Waits for a person.'
          : fill === 'mixed' ? 'Its parts behave differently.'
            : 'Nothing connected to it yet.';
  return gateDescription(`${carries} ${filled}`);
}

/** Rule 2 · the no-variable-data gate applies to descriptions too. A count, a
 *  date, a percentage or a severity tally is one upload's data leaking into a
 *  template that must hold zero content, so the line is rejected mechanically
 *  rather than judged. */
function gateDescription(line: string): string {
  return /\d/.test(line) ? '' : line;
}

/** Rule 3 · per-section input, deduped output. Two sections carrying the same
 *  sentence means the annotation ran once and pasted, so both are rewritten
 *  from what actually distinguishes them: their own heading. */
function dedupeDescriptions(sections: ReadSection[]): void {
  const byLine = new Map<string, ReadSection[]>();
  for (const s of sections) {
    if (!s.description) continue;
    (byLine.get(s.description) ?? byLine.set(s.description, []).get(s.description)!).push(s);
  }
  for (const [line, group] of byLine) {
    if (group.length < 2) continue;
    for (const s of group) {
      const shapes = [...new Set(s.blocks.map(b => b.kind))].map(k => SHAPE_WORDS[k] ?? k).join(', ');
      const rewritten = gateDescription(`${s.name.trim()}: ${shapes || 'the shape kept from your report'}. ${line.split('. ').slice(-1)[0]}`);
      s.description = rewritten;
    }
  }
}

function detectScales(text: string): { findingScale?: string[]; opinionScale?: string[] } {
  const hay = text.toLowerCase();
  const pick = (sets: string[][]) => {
    let best: { set: string[]; hits: number } | null = null;
    for (const set of sets) {
      const hits = set.filter(w => hay.includes(w.toLowerCase())).length;
      if (hits >= Math.max(2, set.length - 1) && (!best || hits > best.hits)) best = { set, hits };
    }
    return best?.set;
  };
  return { findingScale: pick(FINDING_SCALES), opinionScale: pick(OPINION_SCALES) };
}

// ─── One block, two places ──────────────────────────────────────────────────
// A report often prints the same block twice: the net risk table on the cover
// and again in the executive summary, the ratings key in the summary and again
// in an appendix. That is one block referenced twice, not two blocks. The first
// occurrence keeps the shape and gets an id; the later ones become placements
// that point at it, so editing the shape once keeps every position in step.

/** What makes two blocks the same block: a named table or stat strip carrying
 *  exactly the same headings. Prose is never "one block"; slots and cards are
 *  excluded too, because a shape that recurs by design is pass 5's job, not a
 *  reference. */
function blockIdentity(b: ReadBlock): string | null {
  if (b.kind !== 'table' && b.kind !== 'stat') return null;
  const named = [...(b.columns ?? []), ...(b.slotLabels ?? [])];
  if (named.length < 2) return null;                    // too thin to match on
  return `${b.kind}:${named.map(n => norm(n)).join('|')}`;
}

/** A block printed in two or three places is one block placed more than once.
 *  A shape that turns up in half the report is a pattern, not a reference, so
 *  it is left alone. */
const MAX_PLACEMENTS = 3;

function linkRepeatedBlocks(sections: ReadSection[]): void {
  const homes = new Map<string, Set<string>>();
  for (const section of sections) {
    for (const b of section.blocks) {
      const identity = blockIdentity(b);
      if (!identity) continue;
      (homes.get(identity) ?? homes.set(identity, new Set()).get(identity)!).add(section.name);
    }
  }

  const first = new Map<string, ReadBlock>();
  let n = 0;
  for (const section of sections) {
    section.blocks = section.blocks.map(b => {
      const identity = blockIdentity(b);
      if (!identity) return b;
      const places = homes.get(identity)?.size ?? 0;
      if (places < 2 || places > MAX_PLACEMENTS) return b;
      const seen = first.get(identity);
      if (!seen) {
        first.set(identity, b);
        return b;
      }
      // Stored once: the definition gets its id the moment a second placement
      // needs it, so single-use blocks stay plain.
      if (!seen.refId) seen.refId = `blk-${++n}`;
      return {
        kind: b.kind,
        fill: b.fill,
        binding: b.binding,
        label: b.label,
        ref: seen.refId,
        confidence: b.confidence,
        page: b.page,
        preview: b.preview,
      };
    });
  }
}

// ═══ The entry point ═════════════════════════════════════════════════════════

export async function readTemplateFromReport(file: File): Promise<ReadOutcome> {
  // V1 reads one format well. Every decline is said out loud.
  if (!/\.pdf$/i.test(file.name)) return { ok: false, reason: 'not-pdf' };
  if (file.size > MAX_BYTES) return { ok: false, reason: 'too-large' };

  try {
    const pdfjs = await getPdfjs();
    const buf = await file.arrayBuffer();
    let doc: PdfDoc;
    try {
      doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise as unknown as PdfDoc;
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'PasswordException') return { ok: false, reason: 'password' };
      return { ok: false, reason: 'unreadable' };
    }
    if (doc.numPages > PAGE_CAP) {
      const pageCount = doc.numPages;
      await doc.destroy();
      return { ok: false, reason: 'too-long', pageCount };
    }

    const unpacked = await passUnpack(doc);
    await doc.destroy();
    // A scanned PDF is a photo of paper with no text inside. Said honestly,
    // never a silent failure or a fabricated outline.
    if (unpacked.textItems === 0) return { ok: false, reason: 'scanned', pageCount: unpacked.pageCount };

    const furnished = passRemoveFurniture(unpacked);
    const tree = passBuildTree(furnished, unpacked);

    const bodyText = furnished.body.flat().map(l => l.text).join('\n');
    const { findingScale, opinionScale } = detectScales(bodyText);

    // The document's own finding reference shape, read once so every section's
    // tables can be tested against it (check 3).
    const docIdPattern = (bodyText.match(new RegExp(FINDING_ID.source, 'g')) ?? [])
      .map(generalisePattern)
      .sort((a, b) => a.length - b.length)[0];

    // The organisations this report names, taken from its own letterhead and
    // cover. A block repeating one of them is that report's wording, not the
    // client's format.
    const orgNames = [
      ...(furnished.furniture?.header ?? []),
      ...(furnished.furniture?.footer ?? []),
      ...tree.cover.map(l => l.text),
    ].flatMap(line => {
      const hit = line.match(ORG_NAME);
      return hit ? [hit[0].trim()] : [];
    });

    const rawSections = tree.spine.map(s => ({ s, raw: passSpotRepeats(passClassifyBlocks(s, unpacked.bodySize)) }));

    // Fingerprint 4 needs to know what the document repeats word for word, so
    // the whole report is counted once before either detector runs.
    const repeats = new Map<string, number>();
    for (const { raw } of rawSections) {
      for (const rb of raw) {
        const key = bodyKey(rb.lines);
        if (key) repeats.set(key, (repeats.get(key) ?? 0) + 1);
      }
    }

    const sections: ReadSection[] = [];
    const dropped: ReadDropped[] = [];
    // Position: a rollup only rolls up what came before it, so the findings
    // have to have appeared already for a recommendations heading to count.
    let findingsSeen = false;
    const signoffRoles: string[] = [];
    const docHasFindings = rawSections.some(({ s: sec, raw }) =>
      raw.some(b => b.kind === 'cards') || /\b(findings?|observations?|exceptions?)\b/i.test(sec.name));

    for (const { s, raw } of rawSections) {
      // A severity-split section ("Detailed findings — medium") is one
      // repeating card plus a filter, not a second card shape. Without the
      // filter each section claims every finding and generation stamps all of
      // them into all of the sections.
      const severity = (findingScale ?? []).find(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s.name));

      const ctx: DetectContext = {
        scale: findingScale,
        orgNames,
        definitionWords: [...(findingScale ?? []), ...(opinionScale ?? [])],
        idPattern: docIdPattern,
        repeats,
        sectionName: s.name,
        concept: conceptOf(s.name, findingsSeen, docHasFindings),
      };
      const firstProseIndex = raw.findIndex(b => b.kind === 'narrative' || b.kind === 'callout');
      const verdicts = raw.map((rb, i) => detectBlock(rb, ctx, i === firstProseIndex));

      // Only the blocks a detector claimed survive. A kept section is their
      // shape around our data, never a shape with an empty box in it.
      const blocks: ReadBlock[] = [];
      const kinds: Detected[] = [];
      raw.forEach((rb, i) => {
        const v = verdicts[i];
        if (!v.keep) return;
        const { lines, ...rest } = rb;
        blocks.push({
          ...rest,
          ...(severity && rb.kind === 'cards' ? { severity } : {}),
          fill: v.keep,
          binding: v.keep === 'query' ? v.binding : undefined,
          // Fixed text is the one deliberate exception to throwing content
          // away: the words themselves must survive to print unchanged.
          fixedBody: v.keep === 'fixed' ? lines.slice(0, 20) : undefined,
          preview: lines.slice(0, 2),
        });
        kinds.push(v);
      });

      // A heading kept alive by one stray paragraph is not a section we can
      // fill; it is a fragment of one. Keeping it would print their heading
      // with a scrap under it, which is worse than saying we left it out.
      const fragment = blocks.length > 0
        && blocks.length / raw.length < 0.34
        && blocks.every(b => b.kind === 'narrative' || b.kind === 'callout');

      // Once a section has carried the findings, everything after it can roll
      // them up.
      if (raw.some(b => b.kind === 'cards') || /\b(findings?|observations?|exceptions?)\b/i.test(s.name)) findingsSeen = true;

      const signRoles = raw.find(b => b.kind === 'signoff' && (b.signRoles?.length ?? 0) > 0)?.signRoles;
      if (signRoles?.length) signoffRoles.push(...signRoles.filter(r => !signoffRoles.includes(r)));

      if (blocks.length === 0 || fragment) {
        if (signRoles?.length) {
          dropped.push({
            name: s.name,
            captured: true,
            why: 'Saved as a setting: the signature page, with the job titles it is signed off by.',
          });
          continue;
        }
        dropped.push({
          name: s.name,
          why: fragment
            ? 'Not included: only a small part of it matched, so keeping the heading would print a scrap underneath.'
            : verdicts[0]?.why ?? 'Not included: nothing in it comes from audit results, and it is not wording that never changes.',
        });
        continue;
      }

      // The badge names what the section is: data first, because that is the
      // claim that decides what gets written.
      const lead = kinds.find(k => k.keep === 'query') ?? kinds[0];
      const fill: SectionFill = lead.keep === 'query' ? 'query' : 'fixed';
      const shaky = kinds.some(k => k.shaky);

      sections.push({
        name: s.name,
        description: describe(s, fill, blocks, severity),
        fill,
        fillReason: lead.why,
        binding: fill === 'query' ? blocks.find(b => b.binding)?.binding : undefined,
        blocks,
        evidence: s.evidence,
        // The section's own confidence is about the HEADING: was this really a
        // section? A detector that could not call it cleanly pulls it into the
        // check queue, which is exactly what review is for.
        confidence: shaky ? Math.min(s.confidence, 0.65) : s.confidence,
        page: s.page,
        appendix: s.appendix || undefined,
        wrapper: s.wrapper || undefined,
        source: s.lines.filter(l => !l.text.startsWith('§§')).slice(0, 2).map(l => l.text),
      });
    }

    // Once the report splits its findings by severity, every finding already
    // has exactly one home. Another card stamp somewhere else would print the
    // same findings a second time, so it is dropped and the section keeps the
    // prose that summarises them.
    if (sections.some(sec => sec.blocks.some(b => b.kind === 'cards' && b.severity))) {
      for (const sec of sections) {
        sec.blocks = sec.blocks.filter(b => b.kind !== 'cards' || b.severity);
      }
      for (let i = sections.length - 1; i >= 0; i--) {
        if (sections[i].blocks.length > 0) continue;
        dropped.push({ name: sections[i].name, why: 'Not included: these findings already have a home in the sections split by rating.' });
        sections.splice(i, 1);
      }
    }

    dedupeDescriptions(sections);
    linkRepeatedBlocks(sections);

    // The cover's own label and value pairs land as pre filled settings, so a
    // cover title is captured as a setting instead of leaking in as a section.
    let furniture = furnished.furniture;
    const coverFields = deriveFields(tree.cover);
    if (!coverFields.auditTitle) {
      // The biggest line on the cover that reads like a title: not the web
      // address in the corner, not a reference code, not a label.
      const title = [...tree.cover]
        .filter(l =>
          l.text.trim().split(/\s+/).length >= 2 &&
          l.text.length >= 8 &&
          !CONFIDENTIAL.test(l.text) &&
          !/[::]$/.test(l.text) &&
          !/(https?:\/\/|www\.|\.com|\.co\.|\.org|\.net|@)/i.test(l.text) &&
          !/^[A-Z]?\d[\d/-]{2,}/.test(l.text.trim()))
        .sort((a, b) => b.size - a.size)[0]?.text;
      if (title) coverFields.auditTitle = title.trim();
    }
    if (furniture) furniture = { ...furniture, fields: coverFields };
    else if (Object.keys(coverFields).length) furniture = { header: [], footer: [], fields: coverFields };

    return {
      ok: true,
      result: {
        furniture,
        sections,
        skipped: tree.skipped.filter(name => !sections.some(s => norm(s.name) === norm(name))),
        dropped,
        pageCount: unpacked.pageCount,
        pages: unpacked.snapshots.length ? unpacked.snapshots : undefined,
        snapshotLimit: SNAPSHOT_MAX,
        findingScale,
        opinionScale,
        coverColor: unpacked.coverColor,
        toc: tree.toc,
        signoff: signoffRoles.length ? { roles: signoffRoles } : undefined,
      },
    };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}
