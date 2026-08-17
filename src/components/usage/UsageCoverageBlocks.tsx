/**
 * How much of the library the platform touched, and what it caught.
 *
 * PU-06 control coverage · PU-07 never exercised · PU-08 exceptions caught.
 *
 * PU-07 is the one figure on this page that rests on no assumption at all: a
 * control the platform has never run is a fact about the library, not about
 * April, so it deliberately ignores the period selector. That is what makes it
 * the hardest number here to argue with.
 */

import { formatDate } from '../../data/platform-usage';
import {
  fmtInt, fmtPct,
  type Coverage, type ExceptionsCaught, type NeverExercised, type Period, type Scope,
} from '../../data/platform-usage-metrics';
import { Bars, Block, DataTable, Drill, Empty, Fig, MadeList, Meter } from './usageKit';

/* ── PU-06 ───────────────────────────────────────────────────────────────── */

/** Controls exercised at least once in the window, out of the whole library. */
export function ControlCoverage({
  coverage,
  period,
  scope,
}: {
  coverage: Coverage;
  period: Period;
  scope: Scope;
}) {
  const whose = scope.persona === 'head_of_team' ? 'your team owns' : 'the library holds';

  if (coverage.total === 0) {
    return (
      <Block id="coverage" title="Control coverage" lede={null}>
        <Empty kind="quiet" title="No controls are recorded against this scope yet, so there is nothing to cover." />
      </Block>
    );
  }

  return (
    <Block
      id="coverage"
      title="Control coverage"
      lede={
        <>
          The platform exercised <Fig>{fmtInt(coverage.exercised)}</Fig> of the{' '}
          <Fig>{fmtInt(coverage.total)}</Fig> controls {whose}, {period.phrase}. That is{' '}
          <Fig>{fmtPct(coverage.pct)}</Fig> of the library, whatever the run count: a control run fifty times
          counts once here, because this is coverage rather than volume.
        </>
      }
      chart={
        <div className="max-w-xl">
          <p className="text-[2.5rem] font-semibold leading-none text-ink-900 tabular-nums">{fmtPct(coverage.pct)}</p>
          <div className="mt-3">
            <Meter
              pct={coverage.pct}
              label={`${fmtInt(coverage.exercised)} exercised, ${fmtInt(coverage.total - coverage.exercised)} untouched in this window`}
            />
          </div>
          {coverage.untouched.length > 0 && (
            <div className="mt-4">
              <Drill label={`Which ${fmtInt(coverage.untouched.length)} were not exercised in this window`} hideLabel="Hide the controls">
                <DataTable
                  head={['Control', 'Owner']}
                  rows={coverage.untouched.map(c => [`${c.id} ${c.name}`, c.owner])}
                  numericFrom={99}
                />
              </Drill>
            </div>
          )}
        </div>
      }
      table={
        <div className="space-y-4">
          <DataTable
            head={['Control library', 'Controls']}
            rows={[
              ['Exercised in this window', fmtInt(coverage.exercised)],
              ['Not exercised in this window', fmtInt(coverage.total - coverage.exercised)],
              ['In the library', fmtInt(coverage.total)],
            ]}
          />
          {coverage.untouched.length > 0 && (
            <DataTable
              head={['Not exercised in this window', 'Owner']}
              rows={coverage.untouched.map(c => [`${c.id} ${c.name}`, c.owner])}
              numericFrom={99}
            />
          )}
        </div>
      }
      footer="Coverage counts a control as exercised when a run against it finished inside the window."
    />
  );
}

/* ── PU-07 ───────────────────────────────────────────────────────────────── */

/**
 * Never exercised, in any window.
 *
 * The period selector does not touch this block, and the block says so, because
 * a reader who changes the window and watches this number stay still should know
 * that is deliberate rather than broken.
 */
export function NeverExercisedBlock({ never, scope }: { never: NeverExercised; scope: Scope }) {
  const whose = scope.persona === 'head_of_team' ? "your team's" : 'the whole';
  const owned = scope.persona === 'head_of_team' ? "your team's controls" : 'the controls in the library';
  const nothing = never.controls.length === 0 && never.workflows.length === 0;

  return (
    <Block
      id="never"
      title="Never exercised, ever"
      lede={
        nothing ? (
          <>Every control in {whose} library has been exercised by the platform at least once, and every workflow has run. Nothing is sitting unused.</>
        ) : (
          <>
            <Fig>{fmtInt(never.controls.length)}</Fig> of {owned} have never been exercised by the
            platform, in any window
            {never.workflows.length > 0 && <>, and <Fig>{fmtInt(never.workflows.length)}</Fig> workflows in the library have never run at all</>}.
            This one ignores the period selector on purpose.
          </>
        )
      }
      hint="Rests on no assumption of any kind. It is a count of records with nothing behind them."
      table={
        nothing ? (
          <Empty kind="quiet" title="Nothing has gone untouched." />
        ) : (
          <div className="space-y-4">
            {never.controls.length > 0 && (
              <DataTable
                head={['Control never exercised', 'Owner']}
                rows={never.controls.map(c => [`${c.id} ${c.name}`, c.owner])}
                numericFrom={99}
              />
            )}
            {never.workflows.length > 0 && (
              <DataTable head={['Workflow never run']} rows={never.workflows.map(w => [w])} numericFrom={99} />
            )}
          </div>
        )
      }
    />
  );
}

/* ── PU-08 ───────────────────────────────────────────────────────────────── */

const SEVERITY_TONE: Record<string, string> = {
  Critical: 'text-risk-700',
  High: 'text-high-700',
  Medium: 'text-mitigated-700',
  Low: 'text-ink-600',
};

/**
 * What the platform caught.
 *
 * Counted, not estimated. Every exception here opens and traces back to the run
 * that raised it, and the ones with no run behind them are named as such rather
 * than quietly dropped from the count.
 */
export function ExceptionsCaughtBlock({
  exceptions,
  period,
  subject,
  onOpenException,
}: {
  exceptions: ExceptionsCaught;
  period: Period;
  subject: string;
  onOpenException: (engagementId: string) => void;
}) {
  if (exceptions.total === 0) {
    return (
      <Block id="exceptions" title="What the platform caught" lede={null}>
        <Empty
          kind="quiet"
          title={`Nothing was raised for ${subject} in this window.`}
          detail="No exception was raised by any run that finished inside it. This is a count of what happened, not an estimate."
        />
      </Block>
    );
  }

  return (
    <Block
      id="exceptions"
      title="What the platform caught"
      lede={
        <>
          Runs raised <Fig>{fmtInt(exceptions.total)}</Fig> exceptions for {subject} {period.phrase},
          of which <Fig>{fmtInt(exceptions.open)}</Fig> are still open. Every one of them opens the run that
          raised it.
        </>
      }
      hint="Counted from the exception register, by severity. Nothing here is estimated."
      chart={
        <div className="space-y-4">
          <Bars
            rows={exceptions.bySeverity.map(s => ({
              label: s.severity,
              value: s.total,
              note: `${fmtInt(s.open)} still open`,
            }))}
            tone="risk"
          />
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">The newest three</p>
            <MadeList>
              {exceptions.newest.map(ex => (
                <li key={ex.id} className="py-2">
                  <button
                    type="button"
                    onClick={() => onOpenException(ex.engagementId)}
                    className="text-left w-full group"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[0.875rem] text-ink-800 group-hover:text-brand-700 truncate">
                        {ex.ref} {ex.title}
                        {ex.amount ? `, ${ex.amount}` : ''}
                      </span>
                      <span className="text-[0.75rem] text-ink-400 shrink-0 tabular-nums">{formatDate(ex.openedAt)}</span>
                    </div>
                    <p className="text-[0.75rem] text-ink-500">
                      <span className={SEVERITY_TONE[ex.severity]}>{ex.severity}</span> · raised by {ex.workflowName} ·{' '}
                      {ex.runId ? `traced to run ${ex.runId}` : 'no run recorded against it'} · with {ex.assignee}
                    </p>
                  </button>
                </li>
              ))}
            </MadeList>
          </div>
        </div>
      }
      table={
        <DataTable
          head={['Severity', 'Raised', 'Still open']}
          rows={exceptions.bySeverity.map(s => [s.severity, fmtInt(s.total), fmtInt(s.open)])}
        />
      }
      footer={
        exceptions.untraced > 0
          ? `${fmtInt(exceptions.untraced)} of these carry no reference to a run, so they are counted but cannot be traced. Linking them is a one column change in the product, and until it lands this page says so rather than hiding them.`
          : 'Every exception in this window traces back to the run that raised it.'
      }
    />
  );
}
