/**
 * Export.
 *
 * An exported figure travels further than the screen it came from: a headline
 * saying the platform did the work of fifteen people ends up in a pack, detached
 * from the page that produced it. So every file carries the four things needed
 * to read it honestly — whose view, which window, the settings the value figures
 * rest on, and the coverage note — and carries them at the top rather than in a
 * footnote.
 *
 * Two things it deliberately will not do: print a cost total there isn't one of,
 * and add the four work-volume counts together.
 */

import { COVERAGE_NOTE, dataAsOfLabel, formatDate } from '../../data/platform-usage';
import {
  PERSONA_TITLE, SETTING_LABEL, SOURCE_FIELD, SOURCE_LABEL, fmtHours, fmtInt, fmtMoney, fmtPeople, fmtPct, fmtUsd,
  type AiAreaRow, type CoverageResult, type CostResult, type CreatedArea, type ExceptionsResult,
  type NumericSetting, type Period,
  type Scope, type SmartLearnResult, type UsageSettings, type ValueResult, type VolumeUnit,
} from '../../data/platform-usage-metrics';

export interface ExportInput {
  scope: Scope;
  period: Period;
  settings: UsageSettings;
  value: ValueResult;
  /** An auditor's export carries hours, not rupees, exactly like their screen. */
  showMoney: boolean;
  cost: CostResult | null;
  coverage: CoverageResult | null;
  neverExercised: { controls: string[]; workflows: string[] } | null;
  volume: VolumeUnit[];
  /** PU-21. Absent on the auditor view, where a creation tally is a tally of a person. */
  created: CreatedArea[] | null;
  ai: AiAreaRow[] | null;
  exceptions: ExceptionsResult | null;
  smartLearn: SmartLearnResult | null;
  wasted: { hours: number; runs: number };
}

const esc = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const row = (...cells: (string | number)[]): string => cells.map(esc).join(',');

/** The header every export carries, in both formats. */
export function exportHeader(input: ExportInput): [string, string][] {
  const { scope, period, settings } = input;
  return [
    ['View', PERSONA_TITLE[scope.persona]],
    ['Scope', scope.label],
    ['Period', `${formatDate(period.from)} to ${formatDate(period.to)}`],
    ['Data', dataAsOfLabel()],
    // Each assumption travels with where its value came from. A rate defended as
    // measured from the customer's own history reads differently from one the
    // vendor picked, and the file has to carry that difference.
    ...(Object.keys(SETTING_LABEL) as NumericSetting[]).map(k => {
      const field = SOURCE_FIELD[k];
      const value = k === 'hourlyRate' ? fmtMoney(settings[k]) : fmtInt(settings[k]);
      return [SETTING_LABEL[k], field ? `${value} (${SOURCE_LABEL[settings[field]]})` : value] as [string, string];
    }),
    ['Failed runs', 'Excluded from every saving figure, reported separately as wasted machine time'],
    ['What this covers', COVERAGE_NOTE],
  ];
}

export function buildUsageCsv(input: ExportInput): string {
  const lines: string[] = ['Platform Usage'];

  for (const [k, v] of exportHeader(input)) lines.push(row(k, v));

  lines.push('', 'What the work was worth');
  lines.push(row('Hours saved', fmtHours(input.value.hours)));
  if (input.showMoney) {
    lines.push(row('Worth', fmtMoney(input.value.money)));
    lines.push(row('People equivalent', fmtPeople(input.value.people)));
  }
  lines.push(row('Runs counted', fmtInt(input.value.runsCounted)));
  lines.push(row('Rows processed', fmtInt(input.value.rowsProcessed)));
  lines.push(row('Machine time (hours)', fmtHours(input.value.machineHours)));
  lines.push(row('Hours lost to failed runs', fmtHours(input.wasted.hours)));

  if (input.cost) {
    lines.push('', 'Cost to run');
    if (input.cost.complete) {
      lines.push(row('Paid vendor lookups', fmtMoney(input.cost.lookupMoney ?? 0)));
      lines.push(row('Runs of workflows that call a paid lookup', fmtInt(input.cost.lookupRuns)));
    } else {
      // No volume line either: which workflows are billable is defined by the
      // price list, so a zero here would be the empty table talking about itself.
      lines.push(row('Paid vendor lookups', 'Price list not yet loaded, so no cost total exists'));
    }
    lines.push(row('Concierge job cost', fmtUsd(input.cost.conciergeUsd)));
  }

  if (input.coverage) {
    lines.push('', 'Control coverage');
    lines.push(row('Controls exercised', fmtInt(input.coverage.exercised)));
    lines.push(row('Controls in the library', fmtInt(input.coverage.total)));
    lines.push(row('Coverage', fmtPct(input.coverage.pct)));
  }

  if (input.neverExercised) {
    lines.push('', 'Never checked by anything (ignores the period)');
    lines.push(row('Controls', fmtInt(input.neverExercised.controls.length)));
    for (const c of input.neverExercised.controls) lines.push(row('Control', c));
    lines.push(row('Workflows', fmtInt(input.neverExercised.workflows.length)));
    for (const w of input.neverExercised.workflows) lines.push(row('Workflow', w));
  }

  if (input.exceptions && input.exceptions.total > 0) {
    lines.push('', 'What was caught');
    lines.push(row('Reference', 'Severity', 'Status', 'Workflow', 'Raised'));
    for (const e of input.exceptions.rows) {
      lines.push(row(e.ref, e.severity, e.status, e.workflowName, formatDate(e.openedAt)));
    }
  }

  // Four rows, never a sum.
  lines.push('', 'Work volume, in four units that are not addable');
  lines.push(row('Unit', 'Count', 'What it is'));
  for (const u of input.volume) lines.push(row(u.label, u.count, u.note));

  if (input.created) {
    lines.push('', 'Created this period');
    lines.push(row('Area', 'Created'));
    for (const a of input.created) lines.push(row(a.label, a.count));
    lines.push(row('Not counted here', 'Edits, reviews, views and time spent'));
  }

  if (input.ai) {
    lines.push('', 'AI usage by area');
    lines.push(row('Area', 'Volume', 'Unit', 'Cost', 'How well we know it', 'Note'));
    for (const a of input.ai) {
      lines.push(row(
        a.area,
        a.volume === null ? '' : a.volume,
        a.volumeUnit,
        a.costUsd === null ? '' : `${fmtUsd(a.costUsd)} (Concierge job cost)`,
        a.accuracy,
        a.note,
      ));
    }
  }

  if (input.smartLearn?.hasData) {
    lines.push('', 'What the assistant has learned');
    lines.push(row('Memories in use', fmtInt(input.smartLearn.active)));
    lines.push(row('Recalled in the last 7 days', fmtInt(input.smartLearn.recalls7d)));
    lines.push(row('Due for review', fmtInt(input.smartLearn.dueReview)));
    lines.push(row('Waiting for approval', fmtInt(input.smartLearn.pending)));
  }

  return lines.join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
