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
  type AiAreaRow, type CcmResult, type CoverageResult, type CostResult, type CreatedArea, type ExceptionsResult,
  type InsightsResult, type NumericSetting, type Period, type PortfolioResult, type ProductActivity,
  type ReportsActivity, type RiskPicture, type SamplingResult,
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
  /** PU-22 to PU-28. Null wherever the view does not show that block. */
  product: ProductActivity | null;
  reports: ReportsActivity | null;
  sampling: SamplingResult | null;
  insights: InsightsResult | null;
  risks: RiskPicture | null;
  portfolio: PortfolioResult | null;
  ccm: CcmResult | null;
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
  lines.push(row('Hours saved (estimated)', fmtHours(input.value.hours)));
  if (input.showMoney) {
    lines.push(row('Money saved (estimated)', fmtMoney(input.value.money)));
    lines.push(row('People equivalent (estimated)', fmtPeople(input.value.people)));
  }
  lines.push(row('Runs counted', fmtInt(input.value.runsCounted)));
  lines.push(row('Rows processed', fmtInt(input.value.rowsProcessed)));
  lines.push(row('Machine time (hours)', fmtHours(input.value.machineHours)));
  lines.push(row('Hours lost to failed runs', fmtHours(input.wasted.hours)));

  if (input.cost) {
    lines.push('', 'Cost to run');
    if (input.cost.complete) {
      lines.push(row('Paid vendor lookups', fmtMoney(input.cost.lookupMoney ?? 0)));
      lines.push(row('Invoices that figure is the sum of', fmtInt(input.cost.invoices)));
      lines.push(row('Months in this window, all invoiced', fmtInt(input.cost.monthsInWindow)));
      lines.push(row('Recorded calls', fmtInt(input.cost.recordedCalls)));
      if (input.cost.effectiveRate !== null) {
        lines.push(row('Derived from your invoices', `${fmtMoney(input.cost.effectiveRate)} per recorded call, not a price anybody quoted`));
      }
      if (input.cost.split) {
        lines.push(row('The same runs priced per API', fmtMoney(input.cost.split.total)));
        lines.push(row('Gap against the bill', fmtMoney(input.cost.split.gap)));
      }
    } else {
      // No total under a total's label: an unfinished window is unfinished.
      lines.push(row('Paid vendor lookups', `${input.cost.missing ?? 'No invoice entered for this period.'} No cost total exists.`));
      lines.push(row('Months invoiced', `${fmtInt(input.cost.monthsInvoiced)} of ${fmtInt(input.cost.monthsInWindow)}`));
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
    lines.push('', 'Never exercised (ignores the period)');
    lines.push(row('Controls', fmtInt(input.neverExercised.controls.length)));
    for (const c of input.neverExercised.controls) lines.push(row('Control', c));
    lines.push(row('Workflows', fmtInt(input.neverExercised.workflows.length)));
    for (const w of input.neverExercised.workflows) lines.push(row('Workflow', w));
  }

  if (input.exceptions && input.exceptions.total > 0) {
    lines.push('', 'Exceptions caught');
    lines.push(row('Reference', 'Severity', 'Status', 'Workflow', 'Raised'));
    for (const e of input.exceptions.rows) {
      lines.push(row(e.ref, e.severity, e.status, e.workflowName, formatDate(e.openedAt)));
    }
  }

  // Four rows, never a sum.
  lines.push('', 'Work volume by unit, in four units that are not addable');
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

  if (input.portfolio && input.portfolio.total > 0) {
    lines.push('', 'Engagements');
    for (const st of input.portfolio.byStatus) lines.push(row(st.label, st.count));
    lines.push(row('Recorded changes in this window', fmtInt(input.portfolio.changes)));
    lines.push(row('Open past the end of the audit period', fmtInt(input.portfolio.slipping.length)));
    if (input.portfolio.strip.length > 0) {
      lines.push(row('Engagement', 'Controls tested', 'Of', 'Open exceptions', 'In remediation', 'Report', 'Period ends'));
      for (const e of input.portfolio.strip) {
        lines.push(row(e.name, e.controlsTested, e.controlsTotal, e.exceptionsOpen, e.actionPlansOpen, e.report, e.periodEnd));
      }
    }
  }

  if (input.risks) {
    lines.push('', 'Risks');
    lines.push(row('Risks recorded', fmtInt(input.risks.total)));
    lines.push(row('Critical or high with no control covering them', fmtInt(input.risks.unmappedSevere)));
    lines.push(row('Covered by a control', fmtInt(input.risks.mapped)));
    lines.push(row('Covered by nothing', fmtInt(input.risks.unmapped)));
    for (const b of input.risks.byPriority) lines.push(row(`Priority ${b.label}`, b.count));
    for (const r of input.risks.unmappedList) lines.push(row('Uncovered risk', `${r.id} ${r.name}`, r.priority, r.owner));
    lines.push(row('Not recorded', 'Whether a risk was typed by a person or drafted by the assistant'));
  }

  if (input.sampling && input.sampling.total > 0) {
    lines.push('', 'Sampling');
    lines.push(row('Passed', fmtInt(input.sampling.passed)));
    lines.push(row('Failed, the control did not hold', fmtInt(input.sampling.failed)));
    lines.push(row('Errored, needs a person', fmtInt(input.sampling.errored)));
    lines.push(row('Still running', fmtInt(input.sampling.inFlight)));
    lines.push(row('Control', 'Engagement', 'Passed', 'Failed', 'Errored'));
    for (const c of input.sampling.byControl) lines.push(row(c.control, c.engagement, c.passed, c.failed, c.errored));
  }

  if (input.ccm && input.ccm.engagementsOn > 0) {
    lines.push('', 'CCM and automation');
    lines.push(row('Engagements monitored continuously', fmtInt(input.ccm.engagementsOn)));
    lines.push(row('Engagements in scope', fmtInt(input.ccm.engagementsTotal)));
    lines.push(row('Bulk runs in this window', fmtInt(input.ccm.bulkRuns)));
    lines.push(row('Engagement', 'Expects', 'Actual', 'Validations counted', 'Cadence', 'Approvals', 'Exceptions in a gate now'));
    for (const r of input.ccm.rows) {
      lines.push(row(
        r.engagement, `${fmtInt(r.threshold)}%`, r.actual === null ? 'nothing landed' : fmtPct(r.actual),
        r.sampleN, r.cadence, r.approvals, r.inGate,
      ));
    }
  }

  if (input.product) {
    lines.push('', 'Dashboards, widgets and alerts');
    lines.push(row('Dashboards built', fmtInt(input.product.dashboardsCreated)));
    lines.push(row('Dashboards changed or shared', fmtInt(input.product.dashboardsChanged)));
    lines.push(row('Dashboards in the workspace now', fmtInt(input.product.dashboardsTotal)));
    lines.push(row('Alerts fired', fmtInt(input.product.alertsFired)));
    lines.push(row('Of those, fired automatically', fmtInt(input.product.automaticFires)));
    if (input.product.makers.length > 0) {
      lines.push(row('Dashboard', 'Made by', 'When'));
      for (const m of input.product.makers) lines.push(row(m.name, m.madeBy ?? 'automatic', formatDate(m.at)));
    }
  }

  if (input.reports) {
    lines.push('', 'Reports');
    lines.push(row('Made', fmtInt(input.reports.made)));
    lines.push(row('Recorded activities', fmtInt(input.reports.activity)));
    lines.push(row('Shared', fmtInt(input.reports.shared)));
    lines.push(row('Action plans open right now', fmtInt(input.reports.actionPlansOpen)));
    lines.push(row('Action plans implemented', fmtInt(input.reports.actionPlansClosed)));
    if (input.reports.list.length > 0) {
      lines.push(row('Report', 'Made by', 'When'));
      for (const r of input.reports.list) lines.push(row(r.name, r.madeBy ?? 'automatic', formatDate(r.at)));
    }
  }

  if (input.insights && input.insights.perRun + input.insights.consolidated > 0) {
    lines.push('', 'AI insights');
    lines.push(row('Written from one run', fmtInt(input.insights.perRun)));
    lines.push(row('Written across an engagement', fmtInt(input.insights.consolidated)));
    lines.push(row('Severity', 'From one run', 'Across an engagement'));
    for (const b of input.insights.bySeverity) lines.push(row(b.severity, b.perRun, b.consolidated));
  }

  if (input.smartLearn?.hasData) {
    lines.push('', 'Smart Learn');
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
