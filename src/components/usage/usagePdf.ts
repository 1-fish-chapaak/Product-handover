/**
 * Platform Usage as a real .pdf.
 *
 * The same payload the CSV carries, laid out for somebody who was not in the
 * room. Whose view it is, what window it covers, the four assumptions and the
 * coverage note all sit on the first page, above any figure that rests on them.
 *
 * pdfmake and its font pack load on demand, the way the report export does.
 * That is about 1.5 MB nothing else in the app needs in its initial bundle.
 *
 * Money is written as plain numbers under an "INR" heading rather than with a
 * rupee sign. The bundled Roboto is not guaranteed to carry the glyph, and a
 * money figure printed as an empty box is worse than one printed as a word.
 */

import { COVERAGE_NOTE, dataAsOfLabel, formatDate } from '../../data/platform-usage';
import {
  ASSUMPTIONS, PERSONA_SCOPE_LABEL, PERSONA_TITLE, REVIEW_PROXY_NOTE, SETTING_SHORT, SOURCE_LABEL,
  fmtDuration, fmtHours, fmtInt, fmtOneDp, fmtPct, fmtPeople, priorLabel, usageFileName,
  type UsageSnapshot,
} from '../../data/platform-usage-metrics';

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
}

let pdfMakePromise: Promise<PdfMake> | null = null;

async function loadPdfMake(): Promise<PdfMake> {
  if (!pdfMakePromise) {
    pdfMakePromise = (async () => {
      const [pdfMakeModule, pdfFontsModule] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts'),
      ]);
      const pdfMake = ((pdfMakeModule as unknown as { default?: PdfMake }).default ?? pdfMakeModule) as PdfMake;
      const fonts = (pdfFontsModule as unknown as { default?: unknown }).default ?? pdfFontsModule;
      const vfs = (fonts as { pdfMake?: { vfs?: unknown }; vfs?: unknown }).pdfMake?.vfs
        ?? (fonts as { vfs?: unknown }).vfs
        ?? fonts;
      if (typeof pdfMake.addVirtualFileSystem === 'function') pdfMake.addVirtualFileSystem(vfs);
      else pdfMake.vfs = vfs;
      return pdfMake;
    })();
  }
  return pdfMakePromise;
}


const heading = (text: string): Content => ({ text, fontSize: 12, bold: true, color: INK, margin: [0, 16, 0, 6] });
const note = (text: string): Content => ({ text, fontSize: 8, color: MUTED, margin: [0, 0, 0, 6], lineHeight: 1.3 });

const table = (head: string[], rows: (string | number)[][]): Content => ({
  margin: [0, 2, 0, 6],
  layout: {
    hLineWidth: (i: number) => (i === 1 ? 0.7 : 0.4),
    vLineWidth: () => 0,
    hLineColor: () => HAIRLINE,
    paddingTop: () => 4,
    paddingBottom: () => 4,
    paddingLeft: () => 0,
    paddingRight: () => 8,
  },
  table: {
    headerRows: 1,
    widths: head.map((_, i) => (i === 0 ? '*' : 'auto')),
    body: [
      head.map(h => ({ text: h, fontSize: 7.5, bold: true, color: MUTED })),
      ...rows.map(r => r.map((cell, i) => ({
        text: String(cell),
        fontSize: 9,
        color: INK,
        alignment: i === 0 ? 'left' : 'right',
      }))),
    ],
  },
});

export function usagePdfDefinition(data: UsageSnapshot) {
  const { scope, period, settings, value, cost } = data;

  const content: Content[] = [
    { text: 'Platform Usage', fontSize: 20, bold: true, color: INK },
    {
      text: `${PERSONA_TITLE[scope.persona]} view · ${PERSONA_SCOPE_LABEL[scope.persona]}${scope.team ? ` · ${scope.team}` : ''}`,
      fontSize: 10,
      color: BRAND,
      margin: [0, 4, 0, 0],
    },
    {
      text: `${period.label}: ${formatDate(period.from)} to ${formatDate(period.to)} · compared with ${priorLabel(period)} · ${dataAsOfLabel()}`,
      fontSize: 9,
      color: MUTED,
      margin: [0, 3, 0, 10],
    },
    note(COVERAGE_NOTE),

    heading('What the figures assume'),
    table(
      ['Assumption', 'Value', 'Source'],
      ASSUMPTIONS.map(key => [
        SETTING_SHORT[key],
        key === 'manualControlTestHours' ? fmtOneDp(settings[key]) : fmtInt(settings[key]),
        SOURCE_LABEL[settings.source[key]],
      ]),
    ),
    note(REVIEW_PROXY_NOTE),

    heading('What it was worth'),
    table(
      ['Figure', 'Value', 'How it is known'],
      [
        ['Successful runs', fmtInt(value.runs), 'measured'],
        ['Rows covered, each population once', fmtInt(value.coveredRows), 'measured'],
        ['Row checks performed, repeats included', fmtInt(value.checksPerformed), 'measured'],
        ['Machine time', fmtDuration(value.machineHours), 'measured'],
        ['Hours if done by hand', fmtHours(value.manualHours), 'estimated'],
        ['Hours saved', fmtHours(value.hoursSaved), 'estimated'],
        ['What the hours saved are worth, INR', fmtInt(value.rupees), 'estimated'],
        ['People freed, full time', fmtPeople(value.people), 'estimated'],
        ['Charged by the contract, INR', fmtInt(cost.totalPaise / 100), 'measured'],
        ['Net value, INR', fmtInt(data.netRupees), 'estimated'],
        ['Machine time wasted on failed runs', fmtDuration(data.reliability.wastedHours), 'measured'],
      ],
    ),
    note('Failed runs are excluded from every saving above and reported on their own line. Rows covered counts each population once however often it was re-tested, and the repeats appear on the checks-performed line.'),

    heading('How much the pace matters'),
    table(
      ['Rows checked by hand per hour', 'Hours by hand', 'The same work in money, INR'],
      data.sensitivity.map(s => [fmtInt(s.rate), fmtHours(s.hours), fmtInt(s.rupees)]),
    ),

    heading('Control coverage'),
    table(
      ['Figure', 'Value'],
      [
        ['Controls in the library', fmtInt(data.coverage.controlsInLibrary)],
        ['Controls exercised in this window', fmtInt(data.coverage.tested.length)],
        ['Controls never tested in this window', fmtInt(data.coverage.neverTested.length)],
        ['Share of the library exercised', fmtPct(data.coverage.pctTested)],
      ],
    ),

    heading('The risk picture'),
    table(
      ['Figure', 'Value'],
      [
        ['Risks on the register', fmtInt(data.risks.total)],
        ['Risks with no control', fmtInt(data.risks.unmapped.length)],
        ['Critical risks with no control', fmtInt(data.risks.criticalUnmapped.length)],
      ],
    ),

    heading('What was caught'),
    table(
      ['Severity', 'Exceptions'],
      data.exceptions.bySeverity.map(s => [s.label, fmtInt(s.value)]),
    ),
    note(`${fmtInt(data.exceptions.open)} of these are still open. A finding never closes itself, so open means nobody has dealt with it yet rather than that the problem is still there.`),

    heading('How long open findings have been open'),
    table(['Age', 'Findings'], data.ageing.buckets.map(b => [b.label, fmtInt(b.value)])),
    note(
      data.ageing.excludedLegacy > 0
        ? `${fmtInt(data.ageing.excludedLegacy)} findings are left out because they were raised before de-duplication shipped and nothing guarantees they are distinct.`
        : 'Age runs from the day a finding was first raised. A repeat occurrence never created a second row.',
    ),

    heading('Whether the findings were real'),
    table(
      ['Verdict', 'Findings'],
      [
        ['Called real', fmtInt(data.quality.truePositives)],
        ['Called a false alarm', fmtInt(data.quality.falsePositives)],
        ['Not yet classified', fmtInt(data.quality.unclassified)],
      ],
    ),
    note(
      data.quality.falsePositiveRatePct === null
        ? 'Nothing has been classified in this window, so there is no rate. Nought per cent would read as perfection when it really means nobody has looked.'
        : `${fmtPct(data.quality.falsePositiveRatePct)} of the classified findings were the rule firing on something that was fine. A rising rate means a control's rule wants tuning, not that the team is failing.`,
    ),

    heading('What the assistant noticed'),
    table(
      ['Kind', 'Insights'],
      [
        ['Inside one check', fmtInt(data.insights.perRun)],
        ['Across an engagement', fmtInt(data.insights.consolidated)],
      ],
    ),
    note('The two kinds are never added together. A consolidated insight summarises the per-run ones, so a total would count the same observation twice.'),
  ];

  if (data.portfolio.strip.length > 0) {
    content.push(
      heading('Where each open engagement has got to'),
      table(
        ['Engagement', 'Controls tested', 'Findings open', 'Plans open', 'Report'],
        data.portfolio.strip.map(e => [
          `${e.code} · ${e.name}`,
          `${fmtInt(e.controlsTested)} of ${fmtInt(e.controlsTotal)}`,
          fmtInt(e.exceptionsOpen),
          fmtInt(e.actionPlansOpen),
          e.reportState === 'none' ? 'not started' : e.reportState,
        ]),
      ),
      note('Sorted by the date the audit period ends, soonest first. Sorted by a date rather than by a person.'),
    );
  }

  if (cost.lines.length > 0) {
    content.push(
      heading('What the contract charged'),
      table(
        ['Lookup', 'Calls', 'Billed', 'Cost, INR'],
        cost.lines.map(line => [
          line.name,
          fmtInt(line.calls),
          line.billingUnit === 'run' ? `${fmtInt(line.batches)} runs` : `${fmtInt(line.calls)} rows`,
          fmtInt(line.paise / 100),
        ]),
      ),
    );
  }

  if (cost.unpriced.length > 0) {
    content.push(note(`Not priced by the contract yet, so counted and charged nothing: ${cost.unpriced.map(l => l.name).join(', ')}. The reminder goes to our operations team.`));
  }

  content.push(
    heading('What the AI did'),
    table(['Surface', 'Count'], data.aiUsage.map(a => [a.surface, fmtInt(a.count)])),
    note(data.aiUsage.map(a => `${a.surface}: ${a.money}`).join(' · ')),
  );

  if (data.people.length > 0) {
    content.push(
      heading(`${scope.team ?? 'Team'} · work by outcome`),
      table(
        ['Person', 'Runs', 'Exceptions found', 'Resolved'],
        data.people.map(p => [p.name, fmtInt(p.runs), fmtInt(p.exceptionsFound), fmtInt(p.exceptionsResolved)]),
      ),
      note('Alphabetical. It records what each person worked on rather than comparing them.'),
    );
  }

  return {
    pageSize: 'A4',
    pageMargins: [44, 44, 44, 52],
    content,
    defaultStyle: { font: 'Roboto', fontSize: 9, color: INK },
    footer: (current: number, total: number) => ({
      margin: [44, 0, 44, 0],
      columns: [
        { text: `Platform Usage · ${PERSONA_TITLE[scope.persona]} view · ${period.label}`, fontSize: 7.5, color: MUTED },
        { text: `${current} of ${total}`, fontSize: 7.5, color: MUTED, alignment: 'right' },
      ],
    }),
  };
}

export async function downloadUsagePdf(data: UsageSnapshot) {
  const pdfMake = await loadPdfMake();
  pdfMake.createPdf(usagePdfDefinition(data)).download(usageFileName(data.scope, data.period, 'pdf'));
}
