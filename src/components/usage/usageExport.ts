/**
 * Platform Usage as a CSV.
 *
 * The export carries the scope it was read at, the window it covers,
 * which assumptions produced the figures, and the coverage note, so that a
 * number pasted into a board pack can still be defended six weeks later. It
 * reads the same `snapshot()` the page renders, so the file and the screen
 * cannot drift apart.
 */

import { COVERAGE_NOTE, dataAsOfLabel, formatDate } from '../../data/platform-usage';
import {
  ASSUMPTIONS, REVIEW_PROXY_NOTE, SCOPE_LABEL, SETTING_SHORT, SOURCE_LABEL,
  fmtDuration, fmtHours, fmtInt, fmtMoneyExact, fmtOneDp, fmtPct, fmtPeople, priorLabel, usageFileName,
  type UsageSnapshot,
} from '../../data/platform-usage-metrics';


const cell = (value: string | number): string => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const row = (...values: (string | number)[]): string => values.map(cell).join(',');

export function usageCsv(data: UsageSnapshot): string {
  const { scope, period, settings, value, cost } = data;
  const lines: string[] = [];

  lines.push(row('Platform Usage'));
  lines.push(row('Scope', SCOPE_LABEL[scope.level]));
  if (scope.team) lines.push(row('Team', scope.team));
  lines.push(row('Window', `${period.label}: ${formatDate(period.from)} to ${formatDate(period.to)}`));
  lines.push(row('Compared with', priorLabel(period)));
  lines.push(row('Data', dataAsOfLabel()));
  lines.push(row('Coverage note', COVERAGE_NOTE));
  lines.push('');

  lines.push(row('Assumption', 'Value', 'Source', 'Note'));
  ASSUMPTIONS.forEach(key => {
    lines.push(row(
      SETTING_SHORT[key],
      key === 'manualControlTestHours' ? fmtOneDp(settings[key]) : settings[key],
      SOURCE_LABEL[settings.source[key]],
      settings.note[key],
    ));
  });
  lines.push(row('Limit', '', '', REVIEW_PROXY_NOTE));
  lines.push('');

  lines.push(row('Figure', 'Value', 'How it is known'));
  lines.push(row('Successful runs', value.runs, 'measured'));
  lines.push(row('Populations covered', value.populations, 'measured'));
  lines.push(row('Rows covered (each population once)', value.coveredRows, 'measured'));
  lines.push(row('Row checks performed (repeats included)', value.checksPerformed, 'measured'));
  lines.push(row('Machine time', fmtDuration(value.machineHours), 'measured'));
  lines.push(row('Hours if done by hand', fmtHours(value.manualHours), 'estimated'));
  lines.push(row('Hours saved', fmtHours(value.hoursSaved), 'estimated'));
  lines.push(row('People freed, full time', fmtPeople(value.people), 'estimated'));
  lines.push(row('Charged by the contract (INR)', Math.round(cost.totalPaise / 100), 'measured'));
  lines.push(row('Machine time wasted on failed runs', fmtDuration(data.reliability.wastedHours), 'measured'));
  lines.push('');

  lines.push(row('Over time. A population is credited once, to the window that first tested it'));
  lines.push(row('Window', 'Runs', 'Row checks performed', 'Rows newly covered', 'Hours avoided'));
  data.buckets.forEach(b => lines.push(row(b.label, b.runs, b.checks, b.newRows, fmtHours(b.hours))));
  lines.push('');

  lines.push(row('Control coverage'));
  lines.push(row('Controls in the library', data.coverage.controlsInLibrary));
  lines.push(row('Controls exercised', data.coverage.tested.length));
  lines.push(row('Controls never tested in this window', data.coverage.neverTested.length));
  lines.push(row('Share of the library exercised', fmtPct(data.coverage.pctTested)));
  data.coverage.neverTested.forEach(c => lines.push(row('Never tested', c.id, c.name, c.owner)));
  lines.push('');

  lines.push(row('Cost by lookup'));
  lines.push(row('Lookup', 'Vendor', 'Calls', 'Billing unit', 'Cost (INR)'));
  cost.lines.forEach(line => lines.push(row(line.name, line.vendor ?? '', line.calls, line.billingUnit ?? '', line.paise / 100)));
  cost.unpriced.forEach(line => lines.push(row(line.name, line.vendor ?? '', line.calls, 'no contract price yet', '')));
  lines.push('');

  lines.push(row('Exceptions by severity'));
  data.exceptions.bySeverity.forEach(s => lines.push(row(s.label, s.value)));
  lines.push(row('Open', data.exceptions.open));
  lines.push(row('Findings raised before de-duplication shipped', data.exceptions.beforeDeduplication));
  lines.push('');

  lines.push(row('Risks'));
  lines.push(row('On the register', data.risks.total));
  lines.push(row('With no control', data.risks.unmapped.length));
  lines.push(row('Critical with no control', data.risks.criticalUnmapped.length));
  lines.push('');

  lines.push(row('What keeps failing'));
  lines.push(row('Check', 'Failures', 'Runs', 'Failure rate', 'Machine time wasted'));
  data.reliability.rows.forEach(r => lines.push(row(r.workflowName, r.failures, r.runs, fmtPct(r.failureRatePct), fmtDuration(r.wastedHours))));
  lines.push('');

  lines.push(row('How long open findings have been open'));
  data.ageing.buckets.forEach(b => lines.push(row(b.label, b.value)));
  lines.push(row('Open in total', data.ageing.open));
  if (data.ageing.excludedLegacy > 0) {
    lines.push(row('Left out: raised before de-duplication shipped, so not guaranteed distinct', data.ageing.excludedLegacy));
  }
  lines.push('');

  lines.push(row('Whether the findings were real. The rate is out of classified findings only'));
  lines.push(row('Called real', data.quality.truePositives));
  lines.push(row('Called a false alarm', data.quality.falsePositives));
  lines.push(row('Not yet classified', data.quality.unclassified));
  lines.push(row('False alarm rate', data.quality.falsePositiveRatePct === null ? 'nothing classified yet' : fmtPct(data.quality.falsePositiveRatePct)));
  data.quality.byRootCause.forEach(r => lines.push(row('Root cause', r.label, r.value)));
  data.quality.byFalsePositiveReason.forEach(r => lines.push(row('Why the rule fired anyway', r.label, r.value)));
  lines.push('');

  lines.push(row('What the assistant noticed. The two kinds are never added together'));
  lines.push(row('Inside one check', data.insights.perRun));
  lines.push(row('Across an engagement', data.insights.consolidated));
  data.insights.bySeverity.forEach(s => lines.push(row(s.label, s.value)));
  lines.push('');

  lines.push(row('The engagement portfolio'));
  data.portfolio.byStatus.forEach(s => lines.push(row(s.label, s.value)));
  lines.push(row('Changes recorded in this window', data.portfolio.changesInPeriod));
  lines.push('');
  lines.push(row('Engagement', 'Owner', 'Reviewer', 'Controls tested', 'Of', 'Findings open', 'Plans open', 'Report', 'Period ends'));
  data.portfolio.strip.forEach(e => lines.push(row(
    `${e.code} · ${e.name}`, e.owner, e.reviewer, e.controlsTested, e.controlsTotal,
    e.exceptionsOpen, e.actionPlansOpen, e.reportState === 'none' ? 'not started' : e.reportState,
    formatDate(e.auditPeriodEnd),
  )));
  lines.push('');

  lines.push(row('AI usage by surface'));
  lines.push(row('Surface', 'Count', 'What can be said about money'));
  data.aiUsage.forEach(a => lines.push(row(a.surface, a.count, a.money)));

  if (data.people.length > 0) {
    lines.push('');
    lines.push(row(`${scope.team ?? 'Team'} · work by outcome (alphabetical, not a ranking)`));
    lines.push(row('Person', 'Runs', 'Exceptions found', 'Resolved'));
    data.people.forEach(p => lines.push(row(p.name, p.runs, p.exceptionsFound, p.exceptionsResolved)));
  }

  lines.push('');
  lines.push(row('Rows covered counts each population once however often it was re-tested. '
    + `Failed runs are excluded from every saving and reported on their own, at ${fmtDuration(data.reliability.wastedHours)} of wasted machine time. `
    + `Contract cost is the recorded volume at the price in force on the day, as per your contract. The window holds ${fmtInt(value.runs)} successful runs.`));

  return lines.join('\n');
}

export function downloadUsageCsv(data: UsageSnapshot) {
  const blob = new Blob([usageCsv(data)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = usageFileName(data.scope, data.period, 'csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { usageFileName, fmtMoneyExact };
