/**
 * Platform Usage as a CSV.
 *
 * The export carries the same four things the screen does, in the same words:
 * whose view it is, what window it covers, which assumptions produced the value
 * figures, and the one line coverage note saying what is not counted. A figure
 * that leaves the building without them is a figure somebody will quote back
 * without them.
 *
 * The four work volume units are written as four rows and never as a total, the
 * same rule the screen holds to. An unpriced cost is written as an empty cell
 * with its reason next to it rather than as a zero.
 */

import {
  COVERAGE_NOTE, dataAsOfLabel, formatDate,
} from '../../data/platform-usage';
import {
  PERSONA_TITLE, SETTING_SHORT, SOURCE_FIELD, SOURCE_LABEL,
  fmtOneDp, priorLabel,
  type NumericSetting, type UsageSnapshot,
} from '../../data/platform-usage-metrics';

/** One CSV cell, quoted only when it has to be. */
function cell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const row = (...cells: (string | number | null)[]): string => cells.map(cell).join(',');

/** The header every export opens with, so a file can be read on its own. */
export function exportHeader(data: UsageSnapshot): string[][] {
  const settings = data.settings;
  const keys: NumericSetting[] = ['manualReviewRate', 'manualControlTestHours', 'hourlyRate', 'hoursPerPersonPerMonth'];
  return [
    ['Platform Usage'],
    ['Viewing as', PERSONA_TITLE[data.scope.persona]],
    ['Scope', data.scope.label],
    ['Window', `${data.period.label}, ${formatDate(data.period.from)} to ${formatDate(data.period.to)}`],
    ['Compared with', data.prior ? priorLabel(data.period) : 'nothing, there is no earlier window of the same length'],
    ['Data as of', dataAsOfLabel().replace('Data as of ', '')],
    ['What this covers', COVERAGE_NOTE],
    [],
    ['Assumptions behind every value figure'],
    ['Setting', 'Value', 'Where it came from'],
    ...keys.map(key => [
      SETTING_SHORT[key],
      String(settings[key]),
      SOURCE_LABEL[settings[SOURCE_FIELD[key]] as keyof typeof SOURCE_LABEL],
    ]),
  ];
}

/** The whole view as rows. */
export function buildUsageCsv(
  data: UsageSnapshot,
  volumeBuckets: { label: string; runs: number; chat: number }[],
): string {
  const lines: string[] = [];
  const push = (...cells: (string | number | null)[]) => lines.push(row(...cells));
  const section = (title: string) => {
    lines.push('');
    push(title);
  };

  for (const header of exportHeader(data)) lines.push(row(...header));

  section('Value (estimated, from the assumptions above)');
  push('Figure', 'Value', 'Compared with the previous window');
  push('Hours saved', fmtOneDp(data.value.hours), data.priorValue ? fmtOneDp(data.priorValue.hours) : null);
  push('Money saved (INR)', Math.round(data.value.money), data.priorValue ? Math.round(data.priorValue.money) : null);
  push('People equivalent', fmtOneDp(data.value.people), data.priorValue ? fmtOneDp(data.priorValue.people) : null);
  push('Rows worked through', data.value.rows, data.priorValue ? data.priorValue.rows : null);
  push('Machine time (hours)', fmtOneDp(data.value.machineHours), null);

  section('Cost to run (your contract, not an estimate)');
  push('Figure', 'Value', 'Note');
  push(
    'Charged by your contract (INR)',
    data.cost.lookupRupees === null ? null : Math.round(data.cost.lookupRupees),
    data.cost.noContract
      ? 'your contract prices have not been loaded yet'
      : data.cost.complete
        ? 'every recorded call is priced by the contract'
        : `${data.cost.unpriced.reduce((sum, row) => sum + row.calls, 0)} calls are on APIs the contract does not price yet`,
  );
  push('Paid lookups recorded', data.cost.lookupCalls, `${data.lookups.failed} failed, which are not charged`);
  push('Concierge job cost (USD)', fmtOneDp(data.cost.conciergeUsd), 'recorded in dollars by the tools, never converted here');
  push('Net value (INR)', data.net.net === null ? null : Math.round(data.net.net), data.net.headline === 'Net value' ? 'work avoided less what the contract charged' : 'not computed while the contract prices are missing');

  section('Value over time');
  push('Bucket', 'Runs', 'Rows', 'Hours saved', 'Worth (INR)');
  for (const bucket of data.overTime) {
    push(bucket.label, bucket.runs, bucket.rows, fmtOneDp(bucket.hours), Math.round(bucket.money));
  }

  section('Control coverage');
  push('Controls exercised in this window', data.coverage.exercised);
  push('Controls in the library', data.coverage.total);
  push('Coverage percent', fmtOneDp(data.coverage.pct));
  section('Never exercised, ever (ignores the window)');
  push('Control', 'Owner');
  for (const control of data.never.controls) push(`${control.id} ${control.name}`, control.owner);
  for (const workflow of data.never.workflows) push(`Workflow: ${workflow}`, null);

  section('Exceptions caught');
  push('Severity', 'Raised', 'Still open');
  for (const severity of data.exceptions.bySeverity) push(severity.severity, severity.total, severity.open);
  push('Without a run reference', data.exceptions.untraced, null);

  section('Work volume by unit (four units, never summed)');
  push('Unit', 'Count');
  push('Workflow runs', data.volume.workflowRuns);
  push('Bulk runs', data.volume.bulkRuns);
  push('Chat questions', data.volume.chatQuestions);
  push('Concierge jobs', data.volume.conciergeJobs);
  push('Bucket', 'Workflow runs', 'Chat questions');
  for (const bucket of volumeBuckets) push(bucket.label, bucket.runs, bucket.chat);

  section('Reliability by workflow');
  push('Workflow', 'Runs', 'Failed', 'Failure percent', 'Hours lost');
  for (const line of data.reliability) {
    push(line.workflow, line.total, line.failed, fmtOneDp(line.failurePct), fmtOneDp(line.wastedHours));
  }

  section('Stuck runs');
  push('Workflow', 'Ran by', 'When', 'State', 'Times in this window', 'What the engine said');
  for (const run of data.stuck) {
    push(run.workflow, run.ranBy, formatDate(run.at), run.status, run.repeats, run.error);
  }

  section('AI usage by area');
  push('Area', 'Volume', 'Unit', 'How well it is known', 'Detail');
  for (const line of data.aiUsage) {
    push(line.area, line.volume, line.volumeUnit, line.accuracy, line.detail);
  }

  if (data.people.length > 0) {
    section('Your team, by outcome (alphabetical, never ranked)');
    push('Member', 'Runs', 'Exceptions found', 'Waiting on them');
    for (const person of data.people) push(person.name, person.runs, person.exceptionsFound, person.waitingOnThem);
  }

  if (data.queue.length > 0) {
    section('Waiting on you');
    push('Item', 'Kind', 'Due', 'State');
    for (const item of data.queue) {
      push(item.title, item.kind, item.dueAt === null ? null : formatDate(item.dueAt), item.overdue ? 'overdue' : 'on track');
    }
  }

  section('Created in this window');
  push('Kind', 'Created');
  for (const created of data.created) push(created.label, created.count);

  section('Dashboards, widgets and alerts');
  push('Dashboards built', data.product.dashboardsCreated);
  push('Widgets created or changed', data.product.widgetsChanged);
  push('Alerts fired', data.product.alertsFired);
  push('Alerts fired with no person', data.product.alertsAutomatic);

  section('Reports');
  push('Reports made', data.reports.made);
  push('Times worked on', data.reports.activity);
  push('Shared', data.reports.shared);
  push('Action plans open', data.reports.actionPlansOpen);
  push('Action plans closed', data.reports.actionPlansClosed);

  section('Sample validation');
  push('Passed', data.sampling.passed);
  push('Failed', data.sampling.failed);
  push('Errored, needs a person', data.sampling.error);
  push('Queued or running', data.sampling.inFlight);

  section('Insights generated');
  push('Severity', 'Insights');
  for (const line of data.insights.bySeverity) push(line.severity, line.count);
  push('Per run', data.insights.perRun);
  push('Consolidated', data.insights.consolidated);

  section('Risks');
  push('Recorded', data.risks.total);
  push('With a control', data.risks.mapped);
  push('With no control', data.risks.unmapped);
  push('Critical or high with no control', data.risks.unmappedSevere.length);
  push('Written by the AI (percent)', fmtOneDp(data.risks.aiGeneratedShare));
  push('Risk', 'Priority', 'Owner');
  for (const risk of data.risks.unmappedSevere) push(`${risk.id} ${risk.name}`, risk.priority, risk.owner);

  section('Engagements');
  push('Status', 'Engagements');
  for (const line of data.portfolio.byStatus) push(line.status, line.count);
  push('Past their planned finish', data.portfolio.slipping.length);
  push('Record changes in this window', data.portfolio.changes);
  push('Engagement', 'Controls tested', 'Of', 'Exceptions open', 'Report');
  for (const line of data.portfolio.strip) {
    push(`${line.code} ${line.name}`, line.controlsTested, line.controlsTotal, line.exceptionsOpen, line.report);
  }

  section('Continuous monitoring');
  push('Engagements monitoring continuously', data.ccm.engagementsOn);
  push('Engagements in scope', data.ccm.engagementsTotal);
  push('Bulk runs in this window', data.ccm.bulkRuns);
  push('Engagement', 'Schedule', 'Must hold (percent)', 'Actually passing (percent)');
  for (const line of data.ccm.thresholdRows) {
    push(line.engagement, line.frequency, line.threshold, line.actual === null ? null : fmtOneDp(line.actual));
  }

  section('Paid lookups');
  push('API', 'Successful calls', 'Runs', 'Failed', 'Touches personal data', 'Contract price (paise)', 'Charged per', 'Charged (INR)');
  for (const line of data.lookups.rows) {
    push(
      line.name, line.calls, line.batches, line.failed, line.personalData ? 'yes' : 'no',
      line.pricePaise, line.billingUnit, line.chargedPaise === null ? null : line.chargedPaise / 100,
    );
  }
  section('Your contract prices');
  push('API', 'Vendor', 'Charged per', 'Charge (INR)', 'In force from', 'Until', 'Set by');
  for (const price of data.cost.prices) {
    push(
      price.apiName, price.vendor, price.billingUnit, price.pricePaise / 100,
      formatDate(price.effectiveFrom),
      price.effectiveTo === null ? 'in force' : formatDate(price.effectiveTo),
      price.setBy,
    );
  }

  section("What the assistant has learned");
  push('Active memories', data.learn.active);
  push('Awaiting approval', data.learn.pending);
  push('Due for review', data.learn.dueReview);
  push('Used in the last seven days', data.learn.usedThisWeek);

  if (data.changes.rows.length > 0) {
    section('Changes to the numbers behind the figures');
    push('What changed', 'From', 'To', 'Where it came from', 'Who', 'When');
    for (const change of data.changes.rows) {
      push(change.field, change.from, change.to, change.source, change.by, formatDate(change.at));
    }
  }

  return lines.join('\n');
}

/** The file name says whose view and which window, so two files never collide. */
export function usageFileName(data: UsageSnapshot, extension: string): string {
  const persona = PERSONA_TITLE[data.scope.persona].toLowerCase().replace(/\s+/g, '-');
  return `platform-usage-${persona}-${formatDate(data.period.from).replace(/\s+/g, '-')}-to-${formatDate(data.period.to).replace(/\s+/g, '-')}.${extension}`;
}

export function downloadUsageCsv(
  data: UsageSnapshot,
  volumeBuckets: { label: string; runs: number; chat: number }[],
): void {
  const blob = new Blob([buildUsageCsv(data, volumeBuckets)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = usageFileName(data, 'csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
