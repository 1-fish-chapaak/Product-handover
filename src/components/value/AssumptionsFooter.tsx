/**
 * Every figure the page multiplied by, on every scope, always open.
 *
 * It cannot be collapsed and it is not behind a link. A page that turns
 * machine time into rupees is only worth reading if the reader can see what it
 * used on the way, and a reader who has to go looking for that will decide the
 * page is hiding it.
 *
 * There is no multiplier section, because there are no multipliers. What is
 * listed instead is the evidence: which document said what, and who timed
 * what, on how many people, and when.
 */

import {
  CHAT_TIMINGS, CONTROL_REGISTER, EFFORT_BASIS_LABEL, GOVT_TIMINGS, INGESTION_TIMINGS,
  SETUP_TIMINGS, STEP_TIMING, WORKFLOW_TIMINGS, documentedHours, isReviewed, type Timing,
} from '../../data/value/controls';
import { WORKFLOW_BY_ID } from '../../data/usage/seed';
import { BAND_LABEL, GOVT_LABEL, SETTING_PROVENANCE, type ValueSettings } from '../../data/value/settings';
import { fmtInt, fmtMinutes, formatDate, plural } from '../../data/value/model';

export default function AssumptionsFooter({ settings }: { settings: ValueSettings }) {
  const documented = CONTROL_REGISTER
    .filter(c => isReviewed(c) || settings.extraApprovals.includes(c.controlId));
  const waiting = CONTROL_REGISTER
    .filter(c => !isReviewed(c) && !settings.extraApprovals.includes(c.controlId));

  const timings: { what: string; timing: Timing }[] = [
    ...Object.entries(WORKFLOW_TIMINGS).map(([id, t]) => ({
      what: WORKFLOW_BY_ID.get(id)?.name ?? id,
      timing: t,
    })),
    ...Object.entries(CHAT_TIMINGS).map(([band, t]) => ({
      what: `${BAND_LABEL[band as keyof typeof BAND_LABEL]} band chat`,
      timing: t as Timing,
    })),
    ...Object.entries(INGESTION_TIMINGS).map(([band, t]) => ({
      what: `${BAND_LABEL[band as keyof typeof BAND_LABEL]} band files`,
      timing: t as Timing,
    })),
    ...Object.entries(GOVT_TIMINGS).map(([key, t]) => ({
      what: `${GOVT_LABEL.get(key) ?? key} lookup`,
      timing: t,
    })),
    ...Object.entries(SETUP_TIMINGS).map(([id, t]) => ({
      what: `Setup for ${WORKFLOW_BY_ID.get(id)?.name ?? id}`,
      timing: t,
    })),
    { what: 'One written step of a procedure', timing: STEP_TIMING },
  ];

  return (
    <section className="mt-8 border-t border-canvas-border pt-5">
      <h2 className="text-[1rem] font-semibold text-ink-900">What this page used</h2>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        Platform Usage counts and never assumes. This page has to compare, because how long the same
        work takes by hand is not something the platform can watch. Every figure it compared against
        is here, and there is no multiplier among them.
      </p>

      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {SETTING_PROVENANCE.map(p => (
          <div key={p.key} className="border-b border-canvas-border/60 pb-3">
            <dt className="text-[0.875rem] text-ink-500">{p.label}</dt>
            <dd className="mt-0.5 text-[0.875rem] text-ink-900">{p.value}</dd>
            <dd className="mt-1 text-[0.75rem] leading-relaxed text-ink-400">
              {p.basis} Set by {p.setBy}, {formatDate(p.setAt)}.
            </dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-6 text-[0.875rem] font-semibold text-ink-900">Documented effort in force</h3>
      <ul className="mt-2 space-y-1 text-[0.875rem] text-ink-800">
        {documented.map(c => {
          const hours = documentedHours(c);
          return (
            <li key={c.controlId} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium tabular-nums">{c.controlId}</span>
              <span className="tabular-nums">
                {hours === null ? 'no usable hours' : fmtMinutes(hours * 60)}
              </span>
              <span className="text-ink-500">
                {EFFORT_BASIS_LABEL[c.effortBasis].toLowerCase()}
                {c.sopSteps ? `, ${c.sopSteps} steps at ${fmtInt(STEP_TIMING.minutes)} timed minutes each` : ''}
                , {c.sourceDocument} page {c.sourcePage}, checked by{' '}
                {c.reviewedBy?.name ?? 'this session'} on{' '}
                {c.reviewedAt === null ? 'no recorded date' : formatDate(c.reviewedAt)}
              </span>
            </li>
          );
        })}
      </ul>

      {waiting.length > 0 ? (
        <p className="mt-3 border-l-2 border-ink-400 pl-3 text-[0.875rem] leading-relaxed text-ink-600">
          {waiting.map(c => c.controlId).join(', ')} {waiting.length === 1 ? 'was' : 'were'} read out
          of a document and nobody has checked the reading, so {waiting.length === 1 ? 'it counts' : 'they count'} for
          nothing here. The workflows behind {waiting.length === 1 ? 'it are' : 'them are'} counted
          and left unvalued until somebody does.
        </p>
      ) : null}

      <h3 className="mt-6 text-[0.875rem] font-semibold text-ink-900">Timings in force</h3>
      <ul className="mt-2 space-y-1 text-[0.875rem] text-ink-800">
        {timings.map(t => (
          <li key={t.what} className="flex flex-wrap items-baseline gap-x-2">
            <span className="tabular-nums">{fmtMinutes(t.timing.minutes)}</span>
            <span>{t.what}</span>
            <span className="text-ink-500">
              on {plural(t.timing.sampleSize, 'auditor', 'auditors')}, by {t.timing.timedBy.name},{' '}
              {formatDate(t.timing.timedAt)}
              {t.timing.sampleSize < settings.minBenchmarkSample ? ', not in use yet' : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-400">
        Anything not on either list above is counted on this page and carries no hours and no rupees
        at all.
      </p>

      <h3 className="mt-6 text-[0.875rem] font-semibold text-ink-900">
        What this page assumes the ledger records
      </h3>
      <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
        Platform Usage lists several of these under what it cannot tell you, and it is right about
        the platform as it stands. This page reads the same events with the columns below added,
        which is what the feature asks for. Until each one is actually written, the figure resting
        on it is the first thing to check.
      </p>
      <ul className="mt-2 space-y-1.5 text-[0.875rem] leading-relaxed text-ink-800">
        {ASSUMED_COLUMNS.map(c => (
          <li key={c.column}>
            <span className="font-medium">{c.column}</span>
            <span className="text-ink-500"> {c.why}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The columns this page reads that the platform does not write today.
 *
 * Both pages rest on saying plainly what they cannot know, so a reader who
 * finds one page reporting a figure the other calls impossible has to be told
 * why here rather than left to work it out.
 */
const ASSUMED_COLUMNS: { column: string; why: string }[] = [
  {
    column: 'The model that ran, and its published price, on every row.',
    why: 'Running cost and the rows with no published price both come off this. Platform Usage reports no cost at all, because nothing records one today.',
  },
  {
    column: 'The user on a workflow execution.',
    why: 'This is what makes a personal view possible. The column exists on the table and nothing writes it, which is why Platform Usage can put a run against a team and never against a person.',
  },
  {
    column: 'Which of the fourteen government lookups a call was.',
    why: 'The ledger holds how many government calls a row made and what they cost, not which one ran. Without it the government section can show spend and no value.',
  },
  {
    column: 'A batch identifier written at the trigger.',
    why: 'Runs started together have to be groupable, or bulk is invisible.',
  },
  {
    column: 'A complexity band, written when the work happened.',
    why: 'Sizing a job later, from the columns the row already held, is what the backfill does and it is marked wherever it happened.',
  },
  {
    column: 'The team on the row, written at the time.',
    why: 'Joined live to who is on which team today, a person changing team would take their history with them.',
  },
];
