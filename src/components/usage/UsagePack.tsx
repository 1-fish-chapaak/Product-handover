/**
 * The pack: six lines, and nothing else on the first screen.
 *
 * Somebody who reads only the six sentences understands the quarter. That is
 * the whole shape, and everything below is in service of it.
 *
 * ## Flows get two columns. Stocks get a date.
 *
 * This is the rule the page turns on, and it was measured rather than assumed.
 * A flow accumulates over a window: findings raised, sample validations
 * performed, days from a problem happening to somebody catching it. A stock is
 * a position at a moment: how much of the control library has ever been
 * exercised, how many action plans are past their date right now.
 *
 * A stock has no quarter value and no year value. On this customer's records
 * the quarter and the year to date both come to 1,428,000 rows over eleven
 * populations, fourteen controls in the library and 71 per cent of them tested,
 * because the same populations are re-tested all year. Printed as two columns
 * those lines read as a bug in the page rather than as the truth about the
 * work. So a stock prints once, with the date it is true at, and the two column
 * heads sit over the flow columns only.
 *
 * ## One block, not six
 *
 * Six cards side by side is the card grid the design system forbids, and it is
 * what made the old page read as generic. This is one bordered container
 * holding six hairline separated rows. The sentence is the widest thing in each
 * row, the figures are right aligned after it, the honesty label is plain text
 * under the sentence rather than a badge, and the drill down is named inside
 * the sentence rather than hidden behind a chevron.
 *
 * ## No third column
 *
 * A line compares the quarter against the year to date and nothing else. No
 * arrow, no percentage change, no comparison against the quarter before. The
 * year to date is the context the quarter is read in, and a second comparison
 * would make six lines read as eighteen figures.
 */

import { useState, type ReactNode } from 'react';
import { ANCHOR, formatDate } from '../../data/platform-usage';
import {
  fmtInt, fmtOneDp, fmtPct, windowShort,
  type UsageSnapshot,
} from '../../data/platform-usage-metrics';
import { MadeList, MadeRow } from './usageKit';

/** A middle value keeps its half day, but a whole one does not grow a ".0". */
const days = (n: number): string => (Number.isInteger(n) ? fmtInt(n) : fmtOneDp(n));

/** What a drill down lists: a name, a maker and a date, every time. */
interface DrillItem {
  key: string;
  name: string;
  by: string | null;
  at: number;
  note?: string;
  targetId?: string;
}

interface PackLine {
  id: string;
  /** The sentence, with the drill named inside it. */
  sentence: ReactNode;
  /** The inference label, or the caveat, in plain text under the sentence. */
  note?: string;
  /** Two figures for a flow, one figure and a date for a stock. */
  figures:
    | { kind: 'flow'; quarter: string; ytd: string; unit: string }
    | { kind: 'stock'; value: string; unit: string }
    | { kind: 'unmeasured' };
  drill: { label: string; empty: string; items: DrillItem[] };
}

/* ── The six ─────────────────────────────────────────────────────────────── */

/**
 * The six lines, built from the two snapshots the page already holds.
 *
 * Both windows come out of the same `snapshot()`, so a figure here and the same
 * figure in an export cannot disagree.
 */
function lines(q: UsageSnapshot, y: UsageSnapshot): PackLine[] {
  const asAt = formatDate(ANCHOR);
  const qc = q.committee;
  const yc = y.committee;

  /* 1 · Plan completion. A flow, and on these records an unmeasured one. */
  const plan: PackLine = {
    id: 'plan',
    sentence: qc.plan.completionPct !== null
      ? (
        <>
          {fmtInt(qc.plan.closed)} of the {fmtInt(qc.plan.onTheBooks)} engagements on the books closed inside
          the quarter, {fmtInt(qc.plan.closedOnTime)} of them on or before the date they planned for
          themselves.
        </>
      )
      : (
        <>
          No engagement in your records carries a completion date, so how much of the plan closed cannot be
          worked out.
        </>
      ),
    note: qc.plan.completionPct !== null
      ? 'The engagement list is treated as your approved annual plan. That is our inference and not your record.'
      : 'The engagement list is treated as your approved annual plan. That is our inference and not your record. '
        + 'The figure appears here as soon as engagements are closed in the product.',
    figures: qc.plan.completionPct !== null
      ? { kind: 'flow', quarter: `${qc.plan.closed}`, ytd: `${yc.plan.closed}`, unit: 'closed' }
      : { kind: 'unmeasured' },
    drill: {
      label: `Open the ${fmtInt(qc.plan.onTheBooks)} engagements on the books`,
      empty: 'No engagement is on the books yet. One appears here as soon as an engagement is created.',
      items: qc.plan.rows.map(e => ({
        key: e.id,
        name: `${e.code} · ${e.name}`,
        by: e.owner,
        at: e.plannedEnd,
        note: `${e.status}, planned to end`,
        targetId: e.id,
      })),
    },
  };

  /* 2 · Coverage. A stock: what has ever been exercised, as at the anchor. */
  const cov: PackLine = {
    id: 'coverage',
    sentence: (
      <>
        Machine checks have exercised {fmtInt(q.coverage.tested.length)} of the{' '}
        {fmtInt(q.coverage.controlsInLibrary)} controls in your library. {fmtInt(qc.risks.uncovered)} of your{' '}
        {fmtInt(qc.risks.total)} risks still have no control mapped to them, and {fmtInt(qc.risks.criticalUncovered)}{' '}
        of those is critical.
      </>
    ),
    note: 'This stands in for the audit universe. We do not hold your approved list of auditable entities, so '
      + 'the control library is the nearest record we have to one.',
    figures: q.coverage.controlsInLibrary > 0
      ? { kind: 'stock', value: fmtPct(q.coverage.pctTested), unit: 'of the library' }
      : { kind: 'unmeasured' },
    drill: {
      label: `Open the ${fmtInt(q.coverage.neverExercised.length)} controls never exercised`,
      empty: 'Every control in your library has been exercised at least once.',
      items: q.coverage.neverExercised.map(c => ({
        key: c.id,
        name: `${c.id} · ${c.name}`,
        by: c.owner,
        at: c.addedAt,
        note: `${c.process}, added`,
        targetId: c.id,
      })),
    },
  };

  /* 3 · Everything, against a sample of it. The population is a stock, the
   * sampling that ran beside it is a flow, so the sentence carries the first
   * with its date and the columns carry the second. */
  const pop: PackLine = {
    id: 'population',
    sentence: qc.population.populations > 0
      ? (
        <>
          Machine checks read every row of {fmtInt(qc.population.populations)} populations,{' '}
          {fmtInt(qc.population.fullRows)} rows in all, as at {asAt}. People sampled{' '}
          {fmtInt(qc.population.sampledRows)} rows by hand over the same quarter
          {qc.population.multiple !== null ? `, about one row in every ${fmtInt(qc.population.multiple)}` : ''}.
        </>
      )
      : <>No population has been read end to end yet, so there is nothing to hold a sample against.</>,
    figures: qc.population.samples > 0 || yc.population.samples > 0
      ? {
        kind: 'flow',
        quarter: fmtInt(qc.population.samples),
        ytd: fmtInt(yc.population.samples),
        unit: qc.population.samples === 1 ? 'sample' : 'samples',
      }
      : { kind: 'unmeasured' },
    drill: {
      label: `Open the ${fmtInt(qc.population.samples)} sample validations`,
      empty: 'Nobody validated a sample in this quarter.',
      items: qc.population.rows.map(s => ({
        key: s.id,
        name: `${s.controlName} · ${fmtInt(s.sampleSize)} rows`,
        by: s.actor.name,
        at: s.at,
        note: s.outcome,
        targetId: s.engagementId,
      })),
    },
  };

  /* 4 · How long a thing sat before anybody saw it. A flow. */
  const det: PackLine = {
    id: 'detection',
    sentence: (
      <>
        How long a problem sat in the business before anybody saw it, taken at the middle of the range so a
        handful of very old ones cannot drag it.
      </>
    ),
    figures: qc.detection.medianDays !== null && yc.detection.medianDays !== null
      ? {
        kind: 'flow',
        quarter: days(qc.detection.medianDays),
        ytd: days(yc.detection.medianDays),
        unit: 'days',
      }
      : { kind: 'unmeasured' },
    drill: {
      label: `Open the ${fmtInt(qc.detection.sample)} findings traced back to the day they happened`,
      empty: 'Nothing caught in this quarter carries the day the problem actually happened.',
      items: qc.detection.rows.map(ex => ({
        key: ex.id,
        name: `${ex.ref} · ${ex.title}`,
        by: ex.assignee.name,
        at: ex.detectedAt,
        note: `${ex.severity}, happened ${formatDate(ex.occurredAt)}, caught`,
        targetId: ex.id,
      })),
    },
  };

  /* 5 · What was found, and how old it is. Raised is a flow, open is a stock,
   * so the columns carry what was raised and the sentence carries the rest. */
  const find: PackLine = {
    id: 'findings',
    sentence: (
      <>
        {fmtInt(qc.findings.open)} findings are open as at {asAt}, and {fmtInt(qc.findings.overdue.length)} of
        them are already past the date they were given.
      </>
    ),
    note: qc.findings.legacyExcluded > 0
      ? `${fmtInt(qc.findings.legacyExcluded)} more findings were raised before the product started `
        + 'fingerprinting the row behind a finding, so nothing guarantees two of them are not the same problem '
        + 'twice. They are counted here and left out of the open figure and out of the ageing.'
      : undefined,
    figures: qc.findings.raised > 0 || yc.findings.raised > 0
      ? {
        kind: 'flow',
        quarter: fmtInt(qc.findings.raised),
        ytd: fmtInt(yc.findings.raised),
        unit: 'raised',
      }
      : { kind: 'unmeasured' },
    drill: {
      label: `Open the ${fmtInt(qc.findings.raised)} raised this quarter`,
      empty: 'No finding was raised in this quarter.',
      items: qc.findings.raisedRows.map(ex => ({
        key: ex.id,
        name: `${ex.ref} · ${ex.title}`,
        by: ex.assignee.name,
        at: ex.detectedAt,
        note: `${ex.severity}, ${ex.status.toLowerCase()}, raised`,
        targetId: ex.id,
      })),
    },
  };

  /* 6 · What was promised, and whether it happened. A stock. */
  const oldest = qc.actions.overdue[0];
  const act: PackLine = {
    id: 'actions',
    sentence: qc.actions.open > 0
      ? (
        <>
          {fmtInt(qc.actions.overdue.length)} of the {fmtInt(qc.actions.open)} open action plans are past the
          date somebody agreed to{oldest ? `, and the oldest was due on ${formatDate(oldest.dueAt)}` : ''}.
        </>
      )
      : <>No action plan is open, so nothing is waiting on a date.</>,
    figures: qc.actions.open > 0
      ? { kind: 'stock', value: fmtInt(qc.actions.overdue.length), unit: 'past their date' }
      : { kind: 'unmeasured' },
    drill: {
      label: `Open the ${fmtInt(qc.actions.overdue.length)} past the date somebody agreed to`,
      empty: 'Every open action plan is still inside the date it was given.',
      items: qc.actions.overdue.map(a => ({
        key: a.id,
        name: a.title,
        by: a.owner.name,
        at: a.dueAt,
        note: `${a.severity ?? 'no risk recorded'}, due`,
        targetId: a.engagementId,
      })),
    },
  };

  return [plan, cov, pop, det, find, act];
}

/* ── The rendering ───────────────────────────────────────────────────────── */

/** Widths shared by the heads and by every row, so the columns actually line up. */
const Q_COL = 'w-[7.5rem]';
const Y_COL = 'w-[9rem]';
/** The two flow columns and the gap between them, for a stock that spans both. */
const BAND = 'w-[18.5rem]';

function Figure({ value, unit, align = 'text-right' }: { value: string; unit: string; align?: string }) {
  return (
    <div className={align}>
      <span className="text-[1.25rem] font-semibold text-ink-900 tabular-nums">{value}</span>{' '}
      <span className="text-[0.875rem] text-ink-500">{unit}</span>
    </div>
  );
}

function Row({ line, heads }: { line: PackLine; heads: { quarter: string; ytd: string } }) {
  const [open, setOpen] = useState(false);
  const { figures, drill } = line;

  return (
    <div className="border-t border-canvas-border px-6 py-5">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-8">
        <div className="min-w-0 lg:flex-1">
          <p className="text-[1rem] text-ink-900 leading-relaxed max-w-[70ch]">
            {line.sentence}{' '}
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              aria-expanded={open}
              className="font-medium text-brand-700 hover:underline"
            >
              {open ? 'Hide the list' : drill.label}
            </button>
          </p>
          {line.note && (
            <p className="mt-2 text-[0.75rem] text-ink-500 leading-relaxed max-w-[80ch]">{line.note}</p>
          )}
        </div>

        <div className="shrink-0 flex items-start gap-8">
          {figures.kind === 'flow' && (
            <>
              <div className={Q_COL}>
                <div className="lg:hidden text-[0.75rem] font-semibold text-ink-500 text-right">{heads.quarter}</div>
                <Figure value={figures.quarter} unit={figures.unit} />
              </div>
              <div className={Y_COL}>
                <div className="lg:hidden text-[0.75rem] font-semibold text-ink-500 text-right">{heads.ytd}</div>
                <Figure value={figures.ytd} unit={figures.unit} />
              </div>
            </>
          )}

          {/* A stock spans both columns rather than sitting under one of them,
              and says the day it is true at, so nobody reads it as a year
              figure that happens to match its own quarter. */}
          {figures.kind === 'stock' && (
            <div className={BAND}>
              <Figure value={figures.value} unit={figures.unit} align="text-center" />
              <p className="mt-1 text-[0.75rem] text-ink-500 text-center">as at {formatDate(ANCHOR)}</p>
            </div>
          )}

          {/* Nothing happened and we do not measure this are different facts.
              This is the second one, and it never renders as a nought. */}
          {figures.kind === 'unmeasured' && (
            <div className={`${BAND} text-center`}>
              <span className="text-[0.875rem] italic text-ink-500">not recorded</span>
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4">
          {drill.items.length > 0
            ? (
              <MadeList>
                {drill.items.map(item => (
                  <MadeRow
                    key={item.key}
                    name={item.name}
                    madeBy={item.by}
                    when={formatDate(item.at)}
                    note={item.note}
                  />
                ))}
              </MadeList>
            )
            : <p className="text-[0.875rem] text-ink-700">{drill.empty}</p>}
        </div>
      )}
    </div>
  );
}

export function UsagePack({ quarter, ytd }: { quarter: UsageSnapshot; ytd: UsageSnapshot }) {
  const heads = { quarter: windowShort(quarter.period), ytd: windowShort(ytd.period) };
  const rows = lines(quarter, ytd);

  return (
    <section aria-label="The quarter, and the year it sits in" data-usage-pack>
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        {/* The heads are stated once, over the flow columns only. A stock line
            has no quarter figure and no year figure, so nothing of its own
            sits under either of them. */}
        <div className="hidden lg:flex items-end gap-8 px-6 pt-5 pb-3">
          <div className="flex-1" />
          <div className={`${Q_COL} text-right text-[0.75rem] font-semibold text-ink-500`}>{heads.quarter}</div>
          <div className={`${Y_COL} text-right text-[0.75rem] font-semibold text-ink-500`}>{heads.ytd}</div>
        </div>

        {rows.map(line => (
          <Row key={line.id} line={line} heads={heads} />
        ))}
      </div>
    </section>
  );
}
