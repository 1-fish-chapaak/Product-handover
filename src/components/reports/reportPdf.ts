// Real PDF export for the report download modal.
//
// The other three formats hand the browser a file. PDF used to hand it a print
// window and ask the reader to pick "Save as PDF", which meant the one format
// an audit report is actually circulated in was the one the product could not
// produce. This composes the document with pdfmake and downloads a genuine
// .pdf: vector text that stays selectable and searchable, real page breaks, a
// numbered footer on every page, and the report's own brand colour.
//
// pdfmake and its font pack are loaded on demand — they are around 1.5 MB and
// nothing outside this one action needs them, so they stay out of the app's
// initial bundle.

import type { DownloadPreviewSection, DownloadPreviewKpi } from './ReportDownloadModal';
import type { ReportExportContext } from './reportExport';
import { brandGradient, brandAccent, isValidHexColor } from './reportShared';

const INK = '#0F0720';
const MUTED = '#6B5D82';
const HAIRLINE = '#E7E2EE';
const CODE = '#3C2A5B';   // inline code spans — ink, not a second accent
const PAGE_MARGIN: [number, number, number, number] = [56, 56, 56, 64];

// A4 in points, so cover art can be sized against the real sheet.
const PAGE_W = 595.28;
// Depth of the cover's brand band, in points.
const BAND_H = 250;

type Content = Record<string, unknown> | string | Content[];

// ─── loader ───
// The UMD browser build carries the client document (download / getBlob); the
// font pack registers itself against it. Cached so a second export is instant.
let pdfMakePromise: Promise<PdfMake> | null = null;

interface PdfDoc { download: (filename: string) => void }
interface PdfMake {
  createPdf: (def: unknown) => PdfDoc;
  addVirtualFileSystem?: (vfs: unknown) => void;
  vfs?: unknown;
  setFonts: (fonts: unknown) => void;
}

async function loadPdfMake(): Promise<PdfMake> {
  if (!pdfMakePromise) {
    pdfMakePromise = (async () => {
      const [core, fonts] = await Promise.all([
        import('pdfmake/build/pdfmake.min.js'),
        import('pdfmake/build/vfs_fonts.js'),
      ]);
      const pdfMake = ((core as { default?: PdfMake }).default ?? core) as PdfMake;
      const vfs = (fonts as { default?: unknown }).default ?? fonts;
      if (typeof pdfMake.addVirtualFileSystem === 'function') pdfMake.addVirtualFileSystem(vfs);
      else pdfMake.vfs = vfs;
      // Roboto ships with pdfmake and is the closest metric match to the Inter
      // the app renders in. Embedding Inter itself would add a megabyte of font
      // data to every export for a difference nobody reads.
      pdfMake.setFonts({
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf',
        },
      });
      return pdfMake;
    })();
    // A rejected promise must not stay in the cache. Caching it would mean one
    // transient chunk-fetch failure disables PDF export for the rest of the
    // session, with a page reload the only way back.
    pdfMakePromise.catch(() => { pdfMakePromise = null; });
  }
  return pdfMakePromise;
}

// ─── markdown → pdfmake ───
// Query answers are written in markdown. Flattening them to plain text turned
// a heading and four bullets into one run-on paragraph starting with "- ", so
// the structure is carried across instead: headings stay headings, lists stay
// lists, and the pull-quote keeps its rule.

/** Characters the bundled Roboto has no glyph for come out as empty boxes, so
 *  the few the report content actually uses are swapped for readable stand-ins. */
const safeGlyphs = (s: string): string =>
  s
    .replace(/\u2192/g, ' > ')    // → : "Payments → Invoice ID" is a path
    .replace(/[\u2190\u2194]/g, '-')
    .replace(/\u2022/g, '·')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00a0/g, ' ');

type Run = { text: string; bold?: boolean; italics?: boolean; color?: string; background?: string };

/** Inline markdown: **bold** and `code`, including a code span nested inside a
 *  bold one (`**Invoice ID `INV-005790`**` is how the seed answers are written),
 *  which a single flat pass would leave with its backticks showing. */
function inline(src: string, inherited: Partial<Run> = {}): Run[] {
  const out: Run[] = [];
  const re = /(\*\*([\s\S]+?)\*\*)|(`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ ...inherited, text: safeGlyphs(src.slice(last, m.index)) });
    if (m[2] !== undefined) out.push(...inline(m[2], { ...inherited, bold: true }));
    else out.push({ ...inherited, text: safeGlyphs(m[4]), color: CODE });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ ...inherited, text: safeGlyphs(src.slice(last)) });
  return out.length ? out : [{ ...inherited, text: '' }];
}

/** Escaped backticks arrive from the seed data as \` — unescape before parsing. */
const unescapeMd = (s: string): string => s.replace(/\\`/g, '`');

/** Turn a markdown string into pdfmake blocks. */
function markdown(src: string | undefined, accent: string, fontSize = 9.5): Content[] {
  const text = unescapeMd(src ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim();
  if (!text) return [];

  const out: Content[] = [];
  const lines = text.split('\n');
  let para: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    out.push({ text: inline(para.join(' ')), fontSize, color: INK, lineHeight: 1.45, margin: [0, 0, 0, 8] });
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    out.push({
      ul: list.map(i => ({ text: inline(i), fontSize, color: INK, lineHeight: 1.35 })),
      margin: [0, 0, 0, 10],
    });
    list = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    // A left brand rule, the way the reader renders a pull-quote.
    out.push({
      table: { widths: ['*'], body: [[{ text: inline(quote.join(' ')), fontSize, italics: true, color: '#3C2A5B', lineHeight: 1.45, margin: [12, 8, 8, 8] }]] },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: (i: number) => (i === 0 ? 2.5 : 0),
        vLineColor: () => accent,
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
      margin: [0, 2, 0, 12],
    });
    quote = [];
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushAll(); continue; }
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      flushAll();
      out.push({ text: inline(heading[1]), fontSize: fontSize - 0.5, bold: true, color: INK, margin: [0, 4, 0, 5] });
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) { flushPara(); flushQuote(); list.push(bullet[1]); continue; }
    const q = line.match(/^>\s?(.*)$/);
    if (q) { flushPara(); flushList(); quote.push(q[1]); continue; }
    flushList(); flushQuote();
    para.push(line);
  }
  flushAll();
  return out;
}

/** Plain text for places that take a single line (titles, table cells). */
const plain = (s?: string): string =>
  safeGlyphs(unescapeMd(s ?? ''))
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const SEVERITY_COLOR: Record<string, string> = {
  High: '#B42318', Medium: '#B54708', Low: '#067647',
};
const sevColor = (s?: string) => SEVERITY_COLOR[s ?? ''] ?? MUTED;

// ─── section pieces ───

function kpiRow(kpis: { label: string; value: string; accent?: string }[], accent: string): Content | null {
  // Up to six tiles, wrapped to two rows past four. Slicing to four dropped
  // real numbers off the exported ATR summary, and six across A4 squeezes the
  // labels to nothing.
  const cells = kpis.slice(0, 6);
  if (cells.length === 0) return null;
  const perRow = cells.length > 4 ? 3 : cells.length;
  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += perRow) rows.push(cells.slice(i, i + perRow));
  // A short final row is padded so the columns stay the same width throughout.
  const cell = (k?: { label: string; value: string; accent?: string }) => (k
    ? {
      stack: [
        { text: k.value, fontSize: 17, bold: true, color: k.accent ?? accent, margin: [0, 0, 0, 3] },
        { text: k.label.toUpperCase(), fontSize: 6.5, color: MUTED, characterSpacing: 0.6 },
      ],
      margin: [8, 8, 8, 8],
    }
    : { text: '', margin: [8, 8, 8, 8] });
  return {
    table: {
      widths: Array.from({ length: perRow }, () => '*'),
      body: rows.map(r => Array.from({ length: perRow }, (_, i) => cell(r[i]))),
    },
    layout: {
      hLineWidth: () => 0.5, vLineWidth: () => 0.5,
      hLineColor: () => HAIRLINE, vLineColor: () => HAIRLINE,
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 14],
  };
}

function dataTable(t: { title: string; columns: string[]; rows: string[][] }, accent: string): Content[] {
  if (!t.rows.length) return [];
  // Wide tables are capped so a 12-column sheet does not squeeze to unreadable
  // slivers; the count of what was left out is printed rather than hidden.
  const MAX_COLS = 7;
  const MAX_ROWS = 40;
  const cols = t.columns.slice(0, MAX_COLS);
  const rows = t.rows.slice(0, MAX_ROWS).map(r => r.slice(0, MAX_COLS));
  const trimmed: string[] = [];
  if (t.columns.length > MAX_COLS) trimmed.push(`${t.columns.length - MAX_COLS} more columns`);
  if (t.rows.length > MAX_ROWS) trimmed.push(`${t.rows.length - MAX_ROWS} more rows`);
  return [
    { text: t.title, fontSize: 9, bold: true, color: INK, margin: [0, 6, 0, 5] },
    {
      table: {
        headerRows: 1,
        widths: cols.map(() => '*'),
        body: [
          cols.map(c => ({ text: c, fontSize: 7, bold: true, color: accent, fillColor: '#F7F4FB', margin: [4, 5, 4, 5] })),
          ...rows.map(r => cols.map((_, i) => ({ text: r[i] ?? '', fontSize: 7, color: INK, margin: [4, 4, 4, 4] }))),
        ],
      },
      layout: {
        hLineWidth: () => 0.5, vLineWidth: () => 0,
        hLineColor: () => HAIRLINE,
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
      margin: [0, 0, 0, trimmed.length ? 4 : 12],
    },
    ...(trimmed.length
      // Names what was left out without pointing at a file the product may not
      // produce: the Excel export is optional and most reports never offer it.
      ? [{ text: `Not shown here: ${trimmed.join(' and ')}. The full table is on the query in the app.`, fontSize: 6.5, italics: true, color: MUTED, margin: [0, 0, 0, 12] } as Content]
      : []),
  ];
}

function bullets(items: string[]): Content[] {
  const list = items.map(f => plain(f)).filter(Boolean);
  if (!list.length) return [];
  return [{ ul: list, fontSize: 9.5, color: INK, lineHeight: 1.35, margin: [0, 0, 0, 10] }];
}

function sectionHeading(n: number, title: string, accent: string, subtitle?: string, anchor?: { id: string }): Content[] {
  return [
    // One top-level text node rather than a columns row: pdfmake registers an
    // `id` on text nodes, and an id buried inside a column never resolved, so
    // the contents page could not find the page it was pointing at.
    {
      text: [
        { text: `${String(n).padStart(2, '0')}   `, fontSize: 8.5, bold: true, color: accent },
        { text: title, fontSize: 14, bold: true, color: INK },
      ],
      margin: [0, 0, 0, subtitle ? 3 : 6],
      ...(anchor ?? {}),
    },
    ...(subtitle ? [{ text: subtitle, fontSize: 8.5, color: MUTED, margin: [26, 0, 0, 6] } as Content] : []),
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 26, y2: 0, lineWidth: 2, lineColor: accent }], margin: [0, 0, 0, 12] },
  ];
}

function sectionBody(s: DownloadPreviewSection, n: number, accent: string, anchorId: string): Content[] {
  // The anchor rides the section's first text node. The contents page points at
  // it with pdfmake's pageReference, so the page numbers printed there are the
  // pages the sections actually landed on rather than one-per-section
  // arithmetic that a long results table quietly breaks.
  const anchor = { id: anchorId };
  switch (s.kind) {
    case 'summary': {
      const tiles = (s.stats ?? []).map(t => ({ label: t.label, value: t.value, accent: t.accent }));
      const row = kpiRow(tiles, accent);
      return [
        ...sectionHeading(n, s.title, accent, 'Overall observation and action plan rollup', anchor),
        ...(row ? [row] : []),
        ...markdown(s.content, accent, 10),
      ];
    }
    case 'query': {
      const kpis = (s.kpis ?? []) as DownloadPreviewKpi[];
      const row = kpiRow(kpis.map(k => ({ label: k.label, value: k.value })), accent);
      return [
        {
          text: [
            { text: s.queryId, bold: true, color: accent },
            { text: `  ·  ${s.risk}  ·  `, color: MUTED },
            { text: s.severity.toUpperCase(), bold: true, color: sevColor(s.severity) },
          ],
          fontSize: 7.5, characterSpacing: 0.4, margin: [0, 0, 0, 5], ...anchor,
        },
        { text: s.queryTitle, fontSize: 12.5, bold: true, color: INK, lineHeight: 1.25, margin: [0, 0, 0, 10] },
        ...(row ? [row] : []),
        ...markdown(s.answer || s.summary, accent),
        // "Findings", not "What to verify" — several seed answers carry their
        // own "### What to verify" heading, and the two collided into the same
        // words printed twice on one page.
        ...(s.findings.length ? [{ text: 'Findings', fontSize: 9, bold: true, color: INK, margin: [0, 4, 0, 5] } as Content] : []),
        ...bullets(s.findings),
        ...(s.tables ?? []).flatMap(t => dataTable(t, accent)),
      ];
    }
    case 'workflow':
      return [
        {
          text: [
            { text: s.workflowId, bold: true, color: accent },
            { text: '  ·  ', color: MUTED },
            { text: s.severity.toUpperCase(), bold: true, color: sevColor(s.severity) },
          ],
          fontSize: 7.5, characterSpacing: 0.4, margin: [0, 0, 0, 5], ...anchor,
        },
        { text: s.workflowName, fontSize: 12.5, bold: true, color: INK, lineHeight: 1.25, margin: [0, 0, 0, 10] },
        ...markdown(s.summary, accent),
        ...bullets(s.findings),
      ];
    case 'observation':
      return [
        { text: s.obsId, fontSize: 7.5, bold: true, color: accent, characterSpacing: 0.4, margin: [0, 0, 0, 5], ...anchor },
        { text: s.title, fontSize: 12.5, bold: true, color: INK, lineHeight: 1.25, margin: [0, 0, 0, 8] },
        ...markdown(s.description, accent),
      ];
    case 'note':
      return [
        ...sectionHeading(n, s.title, accent, undefined, anchor),
        ...markdown(s.content, accent),
      ];
    default:
      return [];
  }
}

function contentsLabel(s: DownloadPreviewSection): string {
  if (s.kind === 'summary') return 'Executive Summary';
  if (s.kind === 'query') return `${s.queryId} · ${s.queryTitle}`;
  if (s.kind === 'workflow') return `${s.workflowId} · ${s.workflowName}`;
  if (s.kind === 'observation') return `${s.obsId} · ${s.title}`;
  return s.title;
}

/** Cover, contents, then one page per body block — the executive summary shares
 *  its page with the block after it, matching the on-screen download preview so
 *  the page count in the modal footer is the page count in the file. */
function pageBlocks(sections: DownloadPreviewSection[]): DownloadPreviewSection[][] {
  const out: DownloadPreviewSection[][] = [];
  let i = 0;
  while (i < sections.length) {
    if (sections[i].kind === 'summary' && i + 1 < sections.length) { out.push([sections[i], sections[i + 1]]); i += 2; }
    else { out.push([sections[i]]); i += 1; }
  }
  return out;
}

/** The cover's brand band is painted by the document `background` on page 1,
 *  not by an inline canvas — an inline rectangle has to be pulled back into
 *  place with a negative margin, which drifts the moment the title wraps to a
 *  different number of lines. */
function coverBackground(deep: string, mid: string) {
  return (currentPage: number) => (currentPage !== 1 ? null : {
    canvas: [
      { type: 'rect', x: 0, y: 0, w: PAGE_W, h: BAND_H, color: deep },
      { type: 'rect', x: 0, y: BAND_H, w: PAGE_W, h: 5, color: mid },
    ],
  });
}

function coverPage(ctx: ReportExportContext): Content[] {
  // Everything above the band's lower edge is set in white on the band; the
  // strap and the meta grid sit on white paper below it.
  return [
    ...(ctx.logoDataUrl
      ? [{ image: ctx.logoDataUrl, fit: [120, 30], margin: [0, 4, 0, 14] } as Content]
      : []),
    ...(ctx.reportTag
      ? [{ text: ctx.reportTag.toUpperCase(), fontSize: 7.5, bold: true, color: '#D9C2F6', characterSpacing: 1.4, margin: [0, ctx.logoDataUrl ? 0 : 30, 0, 10] } as Content]
      : []),
    { text: ctx.reportName, fontSize: 23, bold: true, color: '#FFFFFF', lineHeight: 1.15, margin: [0, 0, 0, 12] },
    {
      text: [
        { text: ctx.generatedBy, bold: true },
        { text: `   ·   ${ctx.generatedAt}` },
        ...(ctx.templateName ? [{ text: `   ·   ${ctx.templateName}` }] : []),
      ],
      fontSize: 9, color: '#E3D3F7',
    },
    // Pinned below the band rather than flowed after the title, so a title that
    // wraps to one line or to three never moves the strap onto the purple.
    {
      absolutePosition: { x: PAGE_MARGIN[0], y: BAND_H + 44 },
      width: PAGE_W - PAGE_MARGIN[0] - PAGE_MARGIN[2],
      stack: [
        { text: 'Findings, observations, and remediation for the period.', fontSize: 9.5, color: MUTED, margin: [0, 0, 0, 24] },
        {
          columns: [
            { stack: [{ text: 'AUTHOR', fontSize: 6.5, color: MUTED, characterSpacing: 0.9 }, { text: ctx.generatedBy, fontSize: 10, bold: true, color: INK, margin: [0, 3, 0, 0] }] },
            { stack: [{ text: 'DATE', fontSize: 6.5, color: MUTED, characterSpacing: 0.9 }, { text: ctx.generatedAt, fontSize: 10, bold: true, color: INK, margin: [0, 3, 0, 0] }] },
            ...(ctx.reportId ? [{ stack: [{ text: 'REPORT ID', fontSize: 6.5, color: MUTED, characterSpacing: 0.9 }, { text: ctx.reportId.toUpperCase(), fontSize: 10, bold: true, color: INK, margin: [0, 3, 0, 0] }] }] : []),
          ],
        },
      ],
    },
  ];
}

function contentsPage(sections: DownloadPreviewSection[], accent: string, showPageNo: boolean, anchorId: (i: number) => string): Content[] {
  return [
    { text: 'Table of Contents', fontSize: 16, bold: true, color: INK, margin: [0, 0, 0, 4] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 34, y2: 0, lineWidth: 2, lineColor: accent }], margin: [0, 0, 0, 18] },
    {
      table: {
        widths: [22, '*', 30],
        body: sections.map((s, i) => [
          { text: String(i + 1).padStart(2, '0'), fontSize: 8.5, color: MUTED, margin: [0, 4, 0, 4] },
          { text: contentsLabel(s), fontSize: 9.5, color: INK, margin: [0, 4, 0, 4] },
          showPageNo
            ? { text: '00', pageReference: anchorId(i), fontSize: 8.5, color: MUTED, alignment: 'right', margin: [0, 4, 0, 4] }
            : { text: '', fontSize: 8.5, margin: [0, 4, 0, 4] },
        ]),
      },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => HAIRLINE,
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
    },
  ];
}

function signoffBlock(ctx: ReportExportContext, accent: string): Content[] {
  const slots = ctx.signatories ?? [];
  if (!slots.length) return [];
  return [
    { text: '', pageBreak: 'before' },
    { text: 'Approvals & Sign-Off', fontSize: 16, bold: true, color: accent, margin: [0, 0, 0, 16] },
    {
      table: {
        widths: slots.map(() => '*'),
        body: [slots.map(s => {
          const signed = ctx.signoffs?.[s.id];
          return {
            stack: [
              { text: s.role.toUpperCase(), fontSize: 6.5, bold: true, color: MUTED, characterSpacing: 0.9, margin: [0, 0, 0, 6] },
              { text: signed?.signedBy || s.name || ' ', fontSize: 10.5, bold: true, color: INK, margin: [0, 0, 0, 26] },
              signed
                ? { text: `Signed · ${signed.signedAt}`, fontSize: 8.5, bold: true, color: '#067647' }
                : { text: 'Signature / Approval', fontSize: 8, italics: true, color: MUTED },
            ],
            margin: [10, 12, 10, 12],
          };
        })],
      },
      layout: {
        hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        hLineColor: () => HAIRLINE, vLineColor: () => HAIRLINE,
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
    },
  ];
}

/** Their closing page, printed word for word — the last thing in the file the
 *  same way it was the last thing in theirs. */
function closingPage(ctx: ReportExportContext, accent: string): Content[] {
  const lines = (ctx.closingText ?? []).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  return [
    { text: '', pageBreak: 'before' },
    { text: lines[0], fontSize: 22, bold: true, color: accent, alignment: 'center', margin: [0, 200, 0, 0] },
    ...lines.slice(1).map(l => ({ text: l, fontSize: 10, color: MUTED, alignment: 'center', margin: [0, 8, 0, 0] })),
  ];
}

// ─── entry point ───

/**
 * Compose and download the report as a real .pdf.
 *
 * Resolves once the browser has been handed the file. Throws if pdfmake fails
 * to load, so the caller can say so rather than silently doing nothing.
 */
export async function exportReportPdfFile(ctx: ReportExportContext): Promise<void> {
  const pdfMake = await loadPdfMake();
  const [deep, mid] = brandGradient(isValidHexColor(ctx.brandColor) ? ctx.brandColor : undefined);
  const accent = brandAccent(isValidHexColor(ctx.brandColor) ? ctx.brandColor : undefined);
  const showPageNo = ctx.pageNumbers !== false;

  // Cover and contents are not body sections; the preview drops them the same way.
  const body = ctx.sections.filter(s => s.kind !== 'cover' && s.kind !== 'stats');
  const blocks = pageBlocks(body);
  const anchorId = (i: number) => `sec-${i}`;

  const content: Content[] = [
    ...coverPage(ctx),
    { text: '', pageBreak: 'before' },
    ...contentsPage(body, accent, showPageNo, anchorId),
  ];

  // Anchors are handed out by position as the blocks are walked. Looking the
  // section up with indexOf compared by reference, so the same section object
  // appearing twice gave both occurrences the first one's id — a duplicate
  // anchor, and a contents page pointing at the wrong page. It was also a scan
  // per section.
  let n = 0;
  blocks.forEach(block => {
    content.push({ text: '', pageBreak: 'before' });
    block.forEach((s, j) => {
      if (j > 0) {
        content.push({
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_W - PAGE_MARGIN[0] - PAGE_MARGIN[2], y2: 0, lineWidth: 0.5, lineColor: HAIRLINE }],
          margin: [0, 14, 0, 16],
        });
      }
      content.push(...sectionBody(s, n + 1, accent, anchorId(n)));
      n += 1;
    });
  });

  content.push(...signoffBlock(ctx, accent), ...closingPage(ctx, accent));

  const docDefinition = {
    info: {
      title: ctx.reportName,
      author: ctx.generatedBy,
      subject: ctx.reportTag ?? 'Audit report',
      creator: 'Irame',
    },
    pageSize: 'A4',
    background: coverBackground(deep, mid),
    pageMargins: PAGE_MARGIN,
    defaultStyle: { font: 'Roboto', fontSize: 10, color: INK },
    content,
    // The cover carries the brand band, so the running footer starts on page 2.
    footer: (currentPage: number, pageCount: number) => (currentPage === 1 ? null : {
      columns: [
        { text: ctx.reportName, fontSize: 7, color: MUTED, margin: [PAGE_MARGIN[0], 0, 0, 0] },
        ...(showPageNo
          ? [{ text: `${currentPage} / ${pageCount}`, fontSize: 7, color: MUTED, alignment: 'right', margin: [0, 0, PAGE_MARGIN[2], 0] }]
          : []),
      ],
      margin: [0, 22, 0, 0],
    }),
  };

  pdfMake.createPdf(docDefinition).download(`${ctx.reportName}.pdf`);
}
