/**
 * Platform Usage as a real .pdf.
 *
 * The same payload the CSV carries, laid out to be read by somebody who was not
 * in the room: whose view it is, what window it covers, the four assumptions and
 * the coverage note on the first page, above any figure that rests on them.
 *
 * pdfmake and its font pack load on demand, the way the report export does it.
 * That is about 1.5 MB nothing else in the app needs in its initial bundle.
 *
 * Money is written as plain numbers under an "INR" heading rather than with a
 * rupee sign: the bundled Roboto is not guaranteed to carry the glyph, and a
 * money figure printed as an empty box is worse than one printed as a word.
 */

import { COVERAGE_NOTE, dataAsOfLabel, formatDate } from '../../data/platform-usage';
import {
  PERSONA_TITLE, SETTING_SHORT, SOURCE_FIELD, SOURCE_LABEL,
  fmtInt, fmtOneDp, fmtPct, priorLabel,
  type NumericSetting, type UsageSnapshot,
} from '../../data/platform-usage-metrics';
import { usageFileName } from './usageExport';

const INK = '#0F0720';
const MUTED = '#6B5D82';
const HAIRLINE = '#E5E7EB';
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

const heading = (text: string): Content => ({ text, style: 'h2', margin: [0, 16, 0, 6] });

const sentence = (text: string): Content => ({ text, style: 'body', margin: [0, 0, 0, 8] });

function table(head: string[], rows: (string | number)[][], widths?: (string | number)[]): Content {
  return {
    table: {
      headerRows: 1,
      widths: widths ?? ['*', ...head.slice(1).map(() => 'auto')],
      body: [
        head.map(h => ({ text: h, style: 'th' })),
        ...rows.map(row => row.map((cell, i) => ({
          text: String(cell),
          style: 'td',
          alignment: i === 0 ? 'left' : 'right',
        }))),
      ],
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === 1 || i === node.table.body.length ? 0.7 : 0.4),
      vLineWidth: () => 0,
      hLineColor: () => HAIRLINE,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 6],
  };
}

/** The whole view as a document definition. */
function buildDoc(data: UsageSnapshot): Record<string, unknown> {
  const keys: NumericSetting[] = ['manualReviewRate', 'manualControlTestHours', 'hourlyRate', 'hoursPerPersonPerMonth'];
  const content: Content[] = [];

  content.push({ text: 'Platform Usage', style: 'h1' });
  content.push({
    text: [
      { text: `Viewing as ${PERSONA_TITLE[data.scope.persona]}`, bold: true },
      `  ·  ${data.scope.label}  ·  ${data.period.label}, ${formatDate(data.period.from)} to ${formatDate(data.period.to)}  ·  ${dataAsOfLabel()}`,
    ],
    style: 'meta',
    margin: [0, 6, 0, 2],
  });
  content.push({
    text: data.prior
      ? `Every change on this page compares with ${priorLabel(data.period)}.`
      : 'There is no earlier window of the same length, so nothing is compared.',
    style: 'meta',
    margin: [0, 0, 0, 10],
  });
  content.push({ text: COVERAGE_NOTE, style: 'note', margin: [0, 0, 0, 12] });

  content.push(heading('The assumptions every value figure rests on'));
  content.push(table(
    ['Setting', 'Value', 'Where it came from'],
    keys.map(key => [
      SETTING_SHORT[key],
      key === 'hourlyRate' ? `${fmtInt(data.settings[key])} INR` : String(data.settings[key]),
      SOURCE_LABEL[data.settings[SOURCE_FIELD[key]] as keyof typeof SOURCE_LABEL],
    ]),
    ['*', 'auto', 'auto'],
  ));

  content.push(heading('What the work was worth'));
  content.push(sentence(
    `The platform saved ${fmtOneDp(data.value.hours)} hours in this window, from ${fmtInt(data.value.rowRuns)} runs `
    + `over ${fmtInt(data.value.rows)} rows and ${fmtInt(data.value.testRuns)} control tests. `
    + 'Every figure in this section is an estimate built from the assumptions above.',
  ));
  content.push(table(
    ['Figure', 'This window', 'Previous window'],
    [
      ['Hours saved', fmtOneDp(data.value.hours), data.priorValue ? fmtOneDp(data.priorValue.hours) : 'no window'],
      ['Money saved, INR', fmtInt(data.value.money), data.priorValue ? fmtInt(data.priorValue.money) : 'no window'],
      ['People equivalent', fmtOneDp(data.value.people), data.priorValue ? fmtOneDp(data.priorValue.people) : 'no window'],
      ['Rows worked through', fmtInt(data.value.rows), data.priorValue ? fmtInt(data.priorValue.rows) : 'no window'],
      ['Machine time, hours', fmtOneDp(data.value.machineHours), data.priorValue ? fmtOneDp(data.priorValue.machineHours) : 'no window'],
    ],
  ));

  content.push(heading('What it cost to run'));
  content.push(sentence(
    data.cost.lookupRupees === null
      ? `The vendor's bill has not been entered for ${data.cost.missingMonths.map(m => m.label).join(', ') || 'this window'}, `
        + `so no cost is claimed. ${fmtInt(data.cost.lookupCalls)} paid lookups were recorded.`
      : `The vendor billed ${fmtInt(data.cost.lookupRupees)} INR for ${fmtInt(data.cost.lookupCalls)} paid lookups.`,
  ));
  content.push(table(
    ['Figure', 'Value'],
    [
      ['Billed by the vendor, INR', data.cost.lookupRupees === null ? 'no bill entered' : fmtInt(data.cost.lookupRupees)],
      ['Paid lookups recorded', fmtInt(data.cost.lookupCalls)],
      ['Concierge job cost, USD', fmtOneDp(data.cost.conciergeUsd)],
      [data.net.headline + ', INR', data.net.net === null ? fmtInt(data.net.workAvoided) + ' of work avoided' : fmtInt(data.net.net)],
    ],
  ));

  content.push(heading('Value over time'));
  content.push(table(
    ['Bucket', 'Runs', 'Rows', 'Hours saved', 'Worth, INR'],
    data.overTime.map(b => [b.label, fmtInt(b.runs), fmtInt(b.rows), fmtOneDp(b.hours), fmtInt(b.money)]),
  ));

  content.push(heading('What it covered'));
  content.push(sentence(
    `The platform exercised ${fmtInt(data.coverage.exercised)} of ${fmtInt(data.coverage.total)} controls in this window, `
    + `which is ${fmtPct(data.coverage.pct)} of the library. ${fmtInt(data.never.controls.length)} controls have never been `
    + 'exercised in any window, and that count deliberately ignores the window above.',
  ));
  if (data.never.controls.length > 0) {
    content.push(table(
      ['Never exercised, ever', 'Owner'],
      data.never.controls.map(c => [`${c.id} ${c.name}`, c.owner]),
      ['*', 'auto'],
    ));
  }

  content.push(heading('What the platform caught'));
  content.push(table(
    ['Severity', 'Raised', 'Still open'],
    data.exceptions.bySeverity.map(s => [s.severity, fmtInt(s.total), fmtInt(s.open)]),
  ));

  content.push(heading('Work volume, four units that are never added together'));
  content.push(table(
    ['Unit', 'Count'],
    [
      ['Workflow runs', fmtInt(data.volume.workflowRuns)],
      ['Bulk runs', fmtInt(data.volume.bulkRuns)],
      ['Chat questions', fmtInt(data.volume.chatQuestions)],
      ['Concierge jobs', fmtInt(data.volume.conciergeJobs)],
    ],
  ));

  if (data.stuck.length > 0) {
    content.push(heading('What is stuck, in the engine’s own words'));
    content.push(table(
      ['Workflow', 'State', 'Times', 'What the engine said'],
      data.stuck.map(run => [run.workflow, run.status, fmtInt(run.repeats), run.error]),
      ['auto', 'auto', 'auto', '*'],
    ));
  }

  content.push(heading('AI usage by area'));
  content.push(table(
    ['Area', 'Volume', 'How well it is known'],
    data.aiUsage.map(row => [row.area, `${fmtInt(row.volume)} ${row.volumeUnit}`, row.accuracy]),
    ['*', 'auto', 'auto'],
  ));

  if (data.people.length > 0) {
    content.push(heading('The team, by outcome'));
    content.push(sentence('Alphabetical. Nobody here is ranked, compared or averaged.'));
    content.push(table(
      ['Member', 'Runs', 'Exceptions found', 'Waiting on them'],
      data.people.map(p => [p.name, fmtInt(p.runs), fmtInt(p.exceptionsFound), fmtInt(p.waitingOnThem)]),
    ));
  }

  content.push(heading('Risks'));
  content.push(sentence(
    `${fmtInt(data.risks.unmappedSevere.length)} critical and high risks have no control covering them, out of `
    + `${fmtInt(data.risks.total)} recorded. ${fmtPct(data.risks.aiGeneratedShare)} of the register was written by the AI.`,
  ));
  if (data.risks.unmappedSevere.length > 0) {
    content.push(table(
      ['Risk with no control', 'Priority', 'Owner'],
      data.risks.unmappedSevere.map(r => [`${r.id} ${r.name}`, r.priority, r.owner]),
      ['*', 'auto', 'auto'],
    ));
  }

  content.push(heading('Engagements and continuous monitoring'));
  content.push(table(
    ['Status', 'Engagements'],
    data.portfolio.byStatus.map(s => [s.status, fmtInt(s.count)]),
  ));
  content.push(table(
    ['Engagement on a schedule', 'Schedule', 'Must hold', 'Actually passing'],
    data.ccm.thresholdRows.map(r => [
      r.engagement,
      r.frequency,
      fmtPct(r.threshold),
      r.actual === null ? 'too few tests' : fmtPct(r.actual),
    ]),
    ['*', 'auto', 'auto', 'auto'],
  ));

  content.push(heading('What the assistant has learned'));
  content.push(table(
    ['Figure', 'Value'],
    [
      ['Active memories', fmtInt(data.learn.active)],
      ['Awaiting approval', fmtInt(data.learn.pending)],
      ['Due for review', fmtInt(data.learn.dueReview)],
      ['Used in the last seven days', fmtInt(data.learn.usedThisWeek)],
    ],
  ));

  if (data.changes.rows.length > 0) {
    content.push(heading('Changes to the numbers a person or the platform set'));
    content.push(table(
      ['What changed', 'From', 'To', 'Who', 'When'],
      data.changes.rows.map(c => [c.field, c.from ?? '', c.to ?? '', c.by, formatDate(c.at)]),
      ['*', 'auto', 'auto', 'auto', 'auto'],
    ));
  }

  return {
    info: { title: `Platform Usage, ${PERSONA_TITLE[data.scope.persona]}, ${data.period.label}` },
    pageSize: 'A4',
    pageMargins: [44, 44, 44, 52],
    content,
    footer: (page: number, pages: number) => ({
      columns: [
        { text: `Platform Usage  ·  ${data.scope.label}  ·  ${data.period.label}`, style: 'foot' },
        { text: `${page} of ${pages}`, style: 'foot', alignment: 'right' },
      ],
      margin: [44, 12, 44, 0],
    }),
    styles: {
      h1: { fontSize: 20, bold: true, color: INK },
      h2: { fontSize: 12, bold: true, color: BRAND },
      body: { fontSize: 10, color: INK, lineHeight: 1.35 },
      meta: { fontSize: 9, color: MUTED },
      note: { fontSize: 9, color: MUTED, italics: true, lineHeight: 1.3 },
      th: { fontSize: 8, bold: true, color: MUTED },
      td: { fontSize: 9, color: INK },
      foot: { fontSize: 8, color: MUTED },
    },
    defaultStyle: { font: 'Roboto' },
  };
}

export async function downloadUsagePdf(
  data: UsageSnapshot,
  _volumeBuckets: { label: string; runs: number; chat: number }[],
): Promise<void> {
  void _volumeBuckets;
  const pdfMake = await loadPdfMake();
  pdfMake.createPdf(buildDoc(data)).download(usageFileName(data, 'pdf'));
}
