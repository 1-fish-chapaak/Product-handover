import { buildAuditReport } from './icfrAuditReport';
import { periodLine, type PaperBlock } from './icfrWorkingPaper';
import type { Control, IcfrEngagement } from './types';

// The audit report as a real .pdf — the format it is actually issued in.
//
// The user's rule (Aug 2026): the report goes out as a PDF first; preview and
// the .xlsx export stay as options. All three read the SAME sheets from
// buildAuditReport — this file only turns each sheet into a page (Summary,
// Control Rollup, Exceptions, Deficiency Severity, Management action plan),
// it never composes content of its own.
//
// pdfmake and its font pack are loaded on demand — they are around 1.5 MB and
// nothing outside this one action needs them, so they stay out of the app's
// initial bundle. Loader pattern shared with reports/reportPdf.ts.

// The app's own ink/brand tokens (src/index.css), so the file matches the screen.
const INK = '#0F0720';
const MUTED = '#6B5D82';
const HAIRLINE = '#E5E7EB';
const BRAND = '#6A12CD';
const BRAND_WASH = '#F7F0FF';
const GOOD = '#166534';
const BAD = '#912018';
const GOOD_WASH = '#EFF7F0';
const BAD_WASH = '#FBEFEE';
const PAPER = '#FAF7F2';

// Landscape A4: the Control Rollup runs ten columns and Deficiency Severity
// nine — portrait squeezes both to slivers.
const PAGE_MARGIN: [number, number, number, number] = [40, 44, 40, 52];

type Content = Record<string, unknown> | string | Content[];

// ─── loader ───
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
    // A rejected promise must not stay in the cache — one transient chunk-fetch
    // failure must not disable PDF export for the rest of the session.
    pdfMakePromise.catch(() => { pdfMakePromise = null; });
  }
  return pdfMakePromise;
}

/** Glyphs the bundled Roboto has no character for, swapped for stand-ins. */
const safe = (s: string): string =>
  s
    .replace(/→/g, ' > ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, ' ');

// ─── block renderers — one per PaperBlock kind, matching the preview's order ───

function headingBlock(b: Extract<PaperBlock, { kind: 'heading' }>): Content[] {
  return [
    { text: safe(b.text), fontSize: 16, bold: true, color: INK, margin: [0, 0, 0, 3] },
    { text: safe(b.sub), fontSize: 9, color: MUTED, margin: [0, 0, 0, 4] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 30, y2: 0, lineWidth: 2, lineColor: BRAND }], margin: [0, 0, 0, 14] },
  ];
}

function kvBlock(b: Extract<PaperBlock, { kind: 'kv' }>): Content[] {
  return [
    ...(b.title ? [{ text: b.title.toUpperCase(), fontSize: 7, bold: true, color: MUTED, characterSpacing: 0.8, margin: [0, 6, 0, 4] } as Content] : []),
    {
      table: {
        widths: [170, '*'],
        body: b.rows.map(([k, v]) => [
          { text: safe(k), fontSize: 8.5, color: MUTED, margin: [0, 3, 8, 3] },
          { text: safe(v), fontSize: 8.5, color: /NOT YET|DRAFT/.test(v) ? MUTED : INK, margin: [0, 3, 0, 3] },
        ]),
      },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => HAIRLINE,
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
      margin: [0, 0, 0, 10],
    },
  ];
}

function tableBlock(b: Extract<PaperBlock, { kind: 'table' }>): Content[] {
  return [
    { text: b.title.toUpperCase(), fontSize: 7, bold: true, color: MUTED, characterSpacing: 0.8, margin: [0, 6, 0, 2] },
    ...(b.note ? [{ text: safe(b.note), fontSize: 7.5, italics: true, color: MUTED, margin: [0, 0, 0, 4] } as Content] : []),
    {
      table: {
        headerRows: 1,
        widths: b.headers.map(() => '*'),
        // dontBreakRows keeps one control's row on one page; the header row
        // repeats on every page a long table spills onto.
        dontBreakRows: true,
        body: [
          b.headers.map(h => ({ text: safe(h), fontSize: 7, bold: true, color: BRAND, fillColor: BRAND_WASH, margin: [4, 4, 4, 4] })),
          ...b.rows.map(r => b.headers.map((_, i) => ({ text: safe(r[i] ?? ''), fontSize: 7, color: INK, margin: [4, 3, 4, 3] }))),
        ],
      },
      layout: {
        hLineWidth: () => 0.5, vLineWidth: () => 0,
        hLineColor: () => HAIRLINE,
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
      margin: [0, 0, 0, 10],
    },
  ];
}

function noteBlock(b: Extract<PaperBlock, { kind: 'note' }>): Content[] {
  const fill = b.tone === 'good' ? GOOD_WASH : b.tone === 'bad' ? BAD_WASH : PAPER;
  const labelColor = b.tone === 'good' ? GOOD : b.tone === 'bad' ? BAD : MUTED;
  return [{
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: b.label.toUpperCase(), fontSize: 6.5, bold: true, color: labelColor, characterSpacing: 0.8, margin: [0, 0, 0, 3] },
          { text: safe(b.text), fontSize: 8, color: INK, lineHeight: 1.35 },
        ],
        fillColor: fill,
        margin: [8, 7, 8, 7],
      }]],
    },
    layout: {
      hLineWidth: () => 0.5, vLineWidth: () => 0.5,
      hLineColor: () => HAIRLINE, vLineColor: () => HAIRLINE,
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: [0, 4, 0, 10],
  }];
}

function blockContent(b: PaperBlock): Content[] {
  if (b.kind === 'heading') return headingBlock(b);
  if (b.kind === 'kv') return kvBlock(b);
  if (b.kind === 'table') return tableBlock(b);
  return noteBlock(b);
}

// ─── entry point ───

/**
 * Compose and download the audit report as a real .pdf — each sheet a page.
 *
 * Resolves once the browser has been handed the file. Throws if pdfmake fails
 * to load, so the caller can say so rather than silently doing nothing.
 */
export async function downloadAuditReportPdf(eng: IcfrEngagement, controls: Control[] = eng.controls): Promise<void> {
  const pdfMake = await loadPdfMake();
  const sheets = buildAuditReport(eng, controls);
  const reportName = `Audit_Report_ICFR_${eng.code}`;

  const content: Content[] = [];
  sheets.forEach((sheet, i) => {
    if (i > 0) content.push({ text: '', pageBreak: 'before' });
    // Every page opens with the sheet's name, the way the workbook's tabs read —
    // except where the sheet carries its own masthead (the Summary's heading).
    if (sheet.blocks[0]?.kind !== 'heading') {
      content.push(
        { text: sheet.name, fontSize: 13, bold: true, color: INK, margin: [0, 0, 0, 4] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 30, y2: 0, lineWidth: 2, lineColor: BRAND }], margin: [0, 0, 0, 12] },
      );
    }
    sheet.blocks.forEach(b => content.push(...blockContent(b)));
  });

  const docDefinition = {
    info: {
      title: `Audit report — ${eng.name} (${eng.code})`,
      author: eng.preparer,
      subject: `${eng.framework} · ${periodLine(eng)}`,
      creator: 'Irame',
    },
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: PAGE_MARGIN,
    defaultStyle: { font: 'Roboto', fontSize: 8.5, color: INK },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${eng.name} (${eng.code}) · ${periodLine(eng)}`, fontSize: 7, color: MUTED, margin: [PAGE_MARGIN[0], 0, 0, 0] },
        { text: `${currentPage} / ${pageCount}`, fontSize: 7, color: MUTED, alignment: 'right', margin: [0, 0, PAGE_MARGIN[2], 0] },
      ],
      margin: [0, 20, 0, 0],
    }),
  };

  pdfMake.createPdf(docDefinition).download(`${reportName}.pdf`);
}
