/**
 * Platform Usage as a real .pdf.
 *
 * The same payload the CSV carries, laid out to be read by somebody who was not
 * in the room: the scope, the window, the four assumptions and the coverage note
 * on the first page, above any figure that rests on them.
 *
 * pdfmake and its font pack load on demand, the way the report export does it —
 * about 1.5 MB nothing else needs in the initial bundle.
 *
 * Money is written as plain numbers under an "INR" heading rather than with a
 * rupee sign: the bundled Roboto is not guaranteed to carry the glyph, and a
 * money figure printed as an empty box is worse than one printed as a word.
 */

import { COVERAGE_NOTE, dataAsOfLabel, formatDate } from '../../data/platform-usage';
import { PERSONA_TITLE, fmtHours, fmtInt, fmtPct, fmtUsd } from '../../data/platform-usage-metrics';
import { exportHeader, type ExportInput } from './usageExport';

const INK = '#0F0720';
const MUTED = '#6B5D82';
const HAIRLINE = '#E7E2EE';
const BRAND = '#6A12CD';

type Content = Record<string, unknown> | string | Content[];

interface PdfDoc { download: (filename: string) => void }
interface PdfMake {
  createPdf: (def: unknown) => PdfDoc;
  addVirtualFileSystem?: (vfs: unknown) => void;
  vfs?: unknown;
  setFonts: (fonts: unknown) => void;
}

let pdfMakePromise: Promise<PdfMake> | null = null;

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
  }
  return pdfMakePromise;
}

/** Rupees without the glyph — the figure, under a column that says INR. */
const inr = (n: number): string => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));

const heading = (text: string): Content => ({
  text, fontSize: 11, bold: true, color: INK, margin: [0, 16, 0, 6],
});

const table = (head: string[], rows: (string | number)[][], widths: (string | number)[]): Content => ({
  table: {
    headerRows: 1,
    widths,
    body: [
      head.map(h => ({ text: h, fontSize: 8, bold: true, color: MUTED })),
      ...rows.map(r => r.map(c => ({ text: String(c), fontSize: 9, color: INK }))),
    ],
  },
  layout: {
    hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === 1 || i === node.table.body.length ? 0.7 : 0.4),
    vLineWidth: () => 0,
    hLineColor: () => HAIRLINE,
    paddingTop: () => 4,
    paddingBottom: () => 4,
    paddingLeft: () => 0,
    paddingRight: () => 8,
  },
});

export async function downloadUsagePdf(input: ExportInput, filename: string): Promise<void> {
  const pdfMake = await loadPdfMake();
  const { value, period, scope } = input;

  const content: Content[] = [
    { text: 'Platform Usage', fontSize: 20, bold: true, color: INK },
    {
      text: `${PERSONA_TITLE[scope.persona]} · ${scope.label} · ${formatDate(period.from)} to ${formatDate(period.to)}`,
      fontSize: 9, color: MUTED, margin: [0, 4, 0, 0],
    },
    { text: dataAsOfLabel(), fontSize: 9, color: MUTED, margin: [0, 2, 0, 12] },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: BRAND }],
      margin: [0, 0, 0, 12],
    },
    { text: COVERAGE_NOTE, fontSize: 9, color: MUTED, italics: true },
  ];

  content.push(heading('What this rests on'));
  content.push(table(
    ['', ''],
    exportHeader(input).map(([k, v]) => [k, v]),
    [160, '*'],
  ));

  content.push(heading('What the work was worth'));
  const worth: (string | number)[][] = [
    ['Hours saved (estimated)', fmtHours(value.hours)],
    ...(input.showMoney
      ? [['Money saved, estimated (INR)', inr(value.money)], ['People equivalent (estimated)', value.people.toFixed(1)]]
      : []),
    ['Runs counted', fmtInt(value.runsCounted)],
    ['Rows processed', fmtInt(value.rowsProcessed)],
    ['Machine time (hours)', fmtHours(value.machineHours)],
    ['Hours lost to failed runs', fmtHours(input.wasted.hours)],
  ];
  content.push(table(['', ''], worth, [220, '*']));

  if (input.cost) {
    content.push(heading('Cost to run'));
    content.push(table(['', ''], [
      ['Paid vendor lookups', input.cost.complete
        ? `INR ${inr(input.cost.lookupMoney ?? 0)}`
        : `${input.cost.missing ?? 'No invoice entered for this period.'} No cost total exists.`],
      ...(input.cost.complete
        ? [
            ['Invoices that figure is the sum of', fmtInt(input.cost.invoices)],
            ['Recorded calls', fmtInt(input.cost.recordedCalls)],
            ...(input.cost.effectiveRate !== null
              ? [['Derived from your invoices', `INR ${inr(input.cost.effectiveRate)} per recorded call, not a quoted price`]]
              : []),
            ...(input.cost.split
              ? [['The same runs priced per API', `INR ${inr(input.cost.split.total)}, a gap of INR ${inr(input.cost.split.gap)} against the bill`]]
              : []),
          ]
        : [['Months invoiced', `${fmtInt(input.cost.monthsInvoiced)} of ${fmtInt(input.cost.monthsInWindow)}`]]),
      ['Concierge job cost', fmtUsd(input.cost.conciergeUsd)],
    ], [220, '*']));
  }

  if (input.coverage) {
    content.push(heading('Control coverage'));
    content.push(table(['', ''], [
      ['Controls exercised', `${fmtInt(input.coverage.exercised)} of ${fmtInt(input.coverage.total)}`],
      ['Coverage', fmtPct(input.coverage.pct)],
    ], [220, '*']));
  }

  if (input.neverExercised && (input.neverExercised.controls.length > 0 || input.neverExercised.workflows.length > 0)) {
    content.push(heading('Never exercised'));
    content.push({ text: 'This ignores the period. Nothing has ever exercised these.', fontSize: 8, color: MUTED, margin: [0, 0, 0, 6] });
    content.push(table(
      ['Kind', 'Name'],
      [
        ...input.neverExercised.controls.map(c => ['Control', c]),
        ...input.neverExercised.workflows.map(w => ['Workflow', w]),
      ],
      [70, '*'],
    ));
  }

  if (input.exceptions && input.exceptions.total > 0) {
    content.push(heading('Exceptions caught'));
    content.push(table(
      ['Reference', 'Severity', 'Status', 'Workflow', 'Raised'],
      input.exceptions.rows.map(e => [e.ref, e.severity, e.status, e.workflowName, formatDate(e.openedAt)]),
      [60, 55, 55, '*', 65],
    ));
  }

  content.push(heading('Work volume by unit'));
  content.push({
    text: 'Four different units of work. They are not added together here because the sum would mean nothing.',
    fontSize: 8, color: MUTED, margin: [0, 0, 0, 6],
  });
  content.push(table(
    ['Unit of work', 'Count', 'What it is'],
    input.volume.map(u => [u.label, fmtInt(u.count), u.note]),
    [110, 45, '*'],
  ));

  if (input.created) {
    content.push(heading('Created this period'));
    content.push({
      text: 'Records made in this window. Not edits, reviews or time spent.',
      fontSize: 8, color: MUTED, margin: [0, 0, 0, 6],
    });
    content.push(table(
      ['Area', 'Created'],
      input.created.map(a => [a.label, fmtInt(a.count)]),
      [220, '*'],
    ));
  }

  if (input.ai) {
    content.push(heading('AI usage by area'));
    content.push(table(
      ['Area', 'Volume', 'Cost', 'How well we know it'],
      input.ai.map(a => [
        a.area,
        a.volume === null ? '—' : `${fmtInt(a.volume)} ${a.volumeUnit}`,
        a.costUsd === null ? '—' : `${fmtUsd(a.costUsd)} Concierge job cost`,
        a.accuracy,
      ]),
      [95, 80, 140, '*'],
    ));
  }

  if (input.portfolio && input.portfolio.total > 0) {
    content.push(heading('Engagements'));
    content.push(table(
      ['', ''],
      [
        ...input.portfolio.byStatus.map(st => [st.label, fmtInt(st.count)]),
        ['Recorded changes in this window', fmtInt(input.portfolio.changes)],
        ['Open past the end of the audit period', fmtInt(input.portfolio.slipping.length)],
      ],
      [220, '*'],
    ));
    if (input.portfolio.strip.length > 0) {
      content.push(table(
        ['Engagement', 'Controls tested', 'Open exceptions', 'Report', 'Period ends'],
        input.portfolio.strip.map(e => [
          e.name,
          `${fmtInt(e.controlsTested)} of ${fmtInt(e.controlsTotal)}`,
          fmtInt(e.exceptionsOpen),
          e.report,
          e.periodEnd,
        ]),
        ['*', 80, 75, 60, 70],
      ));
    }
  }

  if (input.risks && input.risks.total > 0) {
    content.push(heading('Risks'));
    content.push(table(['', ''], [
      ['Critical or high with no control covering them', fmtInt(input.risks.unmappedSevere)],
      ['Risks recorded', fmtInt(input.risks.total)],
      ['Covered by a control', fmtInt(input.risks.mapped)],
      ['Covered by nothing', fmtInt(input.risks.unmapped)],
      ...input.risks.byPriority.map(b => [`Priority ${b.label}`, fmtInt(b.count)]),
    ], [280, '*']));
    if (input.risks.unmappedList.length > 0) {
      content.push(table(
        ['Uncovered risk', 'Priority', 'Owner'],
        input.risks.unmappedList.map(r => [`${r.id} ${r.name}`, r.priority, r.owner]),
        ['*', 60, 110],
      ));
    }
  }

  if (input.sampling && input.sampling.total > 0) {
    content.push(heading('Sampling'));
    content.push({
      text: 'A failed validation says the control did not hold. An errored one says nothing about the control, so somebody has to look.',
      fontSize: 8, color: MUTED, margin: [0, 0, 0, 6],
    });
    content.push(table(
      ['Control', 'Engagement', 'Passed', 'Failed', 'Errored'],
      input.sampling.byControl.map(c => [c.control, c.engagement, fmtInt(c.passed), fmtInt(c.failed), fmtInt(c.errored)]),
      ['*', 140, 45, 45, 45],
    ));
  }

  if (input.ccm && input.ccm.engagementsOn > 0) {
    content.push(heading('CCM and automation'));
    content.push(table(
      ['Engagement', 'Expects', 'Actual', 'Validations', 'Cadence', 'In a gate'],
      input.ccm.rows.map(r => [
        r.engagement,
        `${fmtInt(r.threshold)}%`,
        r.actual === null ? 'nothing landed' : fmtPct(r.actual),
        fmtInt(r.sampleN),
        r.cadence,
        fmtInt(r.inGate),
      ]),
      ['*', 50, 75, 60, 55, 50],
    ));
  }

  if (input.product) {
    content.push(heading('Dashboards, widgets and alerts'));
    content.push(table(['', ''], [
      ['Dashboards built', fmtInt(input.product.dashboardsCreated)],
      ['Dashboards changed or shared', fmtInt(input.product.dashboardsChanged)],
      ['Dashboards in the workspace now', fmtInt(input.product.dashboardsTotal)],
      ['Alerts fired', fmtInt(input.product.alertsFired)],
      ['Of those, fired automatically with nobody watching', fmtInt(input.product.automaticFires)],
    ], [280, '*']));
    if (input.product.makers.length > 0) {
      content.push(table(
        ['Dashboard', 'Made by', 'When'],
        input.product.makers.map(m => [m.name, m.madeBy ?? 'automatic', formatDate(m.at)]),
        ['*', 130, 70],
      ));
    }
  }

  if (input.reports) {
    content.push(heading('Reports'));
    content.push({
      text: 'A report edited fifty times is one report and fifty activities. The two are never added together.',
      fontSize: 8, color: MUTED, margin: [0, 0, 0, 6],
    });
    content.push(table(['', ''], [
      ['Made', fmtInt(input.reports.made)],
      ['Recorded activities', fmtInt(input.reports.activity)],
      ['Shared', fmtInt(input.reports.shared)],
      ['Action plans open right now', fmtInt(input.reports.actionPlansOpen)],
      ['Action plans implemented', fmtInt(input.reports.actionPlansClosed)],
    ], [280, '*']));
  }

  if (input.insights && input.insights.perRun + input.insights.consolidated > 0) {
    content.push(heading('AI insights'));
    content.push(table(
      ['Severity', 'From one run', 'Across an engagement'],
      input.insights.bySeverity.map(b => [b.severity, fmtInt(b.perRun), fmtInt(b.consolidated)]),
      [120, 100, '*'],
    ));
  }

  if (input.smartLearn?.hasData) {
    content.push(heading('Smart Learn'));
    content.push(table(['', ''], [
      ['Memories in use', fmtInt(input.smartLearn.active)],
      ['Recalled in the last 7 days', fmtInt(input.smartLearn.recalls7d)],
      ['Due for review', fmtInt(input.smartLearn.dueReview)],
      ['Waiting for approval', fmtInt(input.smartLearn.pending)],
    ], [220, '*']));
  }

  pdfMake.createPdf({
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 48],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: INK },
    content,
    footer: (page: number, pages: number) => ({
      columns: [
        { text: COVERAGE_NOTE, fontSize: 7, color: MUTED, width: '*' },
        { text: `${page} of ${pages}`, fontSize: 7, color: MUTED, width: 40, alignment: 'right' },
      ],
      margin: [40, 12, 40, 0],
    }),
  }).download(filename);
}
