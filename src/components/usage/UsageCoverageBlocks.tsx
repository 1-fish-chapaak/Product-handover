/**
 * How much of the control library the platform touched, what it never touched,
 * where the risk sits, and what was caught.
 *
 * The coverage block carries the guide's hardest rule: a population is counted
 * once however often it is re-tested. The repeats are counted too, on the same
 * block, under a name that says what they are.
 */

import { formatDate } from '../../data/platform-usage';
import {
  fmtInt, fmtOneDp, fmtPct, openLabel, plural,
  type CoverageFigures, type ExceptionFigures, type Period, type RiskFigures, type Scope,
} from '../../data/platform-usage-metrics';
import { Block, Bars, DataTable, Drill, Empty, Fig, MadeList, MadeRow, Meter, Stat, StatRow } from './usageKit';
import { DeduplicationLimits } from './UsageValueBlocks';

/* ── Control coverage ────────────────────────────────────────────────────── */

export function ControlCoverage({
  coverage, period, checksPerformed, coveredRows,
}: {
  coverage: CoverageFigures;
  period: Period;
  checksPerformed: number;
  coveredRows: number;
}) {
  if (coverage.controlsInLibrary === 0) {
    return (
      <Block id="coverage" title="Control coverage" lede={null}>
        <Empty kind="quiet" title="There are no controls in the library yet." />
      </Block>
    );
  }

  const multiple = coveredRows > 0 ? checksPerformed / coveredRows : 0;

  /*
   * "4 never tested in this window" and "4 controls have never been exercised"
   * are two different facts that print the same number, and side by side they
   * read as the page saying one thing twice. So this tile says how many of its
   * own controls are in the harder list, which is the only thing that separates
   * them.
   */
  const neverEverIds = new Set(coverage.neverExercised.map(c => c.id));
  const quietAndNeverEver = coverage.neverTested.filter(c => neverEverIds.has(c.id)).length;
  const untestedSub = coverage.neverTested.length === 0
    ? undefined
    : quietAndNeverEver === coverage.neverTested.length
      ? 'and none of them has ever been tested'
      : quietAndNeverEver > 0
        ? `${fmtInt(quietAndNeverEver)} of them never tested at all`
        : 'all of them tested at some point before';

  return (
    <Block
      id="coverage"
      title="Control coverage"
      code="COV-CONTROLS"
      figure={fmtInt(coverage.tested.length)}
      of={fmtInt(coverage.controlsInLibrary)}
      context={<>controls exercised {period.phrase}, over {fmtInt(coverage.populations.length)} populations</>}
      lede={
        <>
          <Fig>{fmtInt(coverage.tested.length)}</Fig> of{' '}
          <Fig>{fmtInt(coverage.controlsInLibrary)}</Fig> controls were exercised {period.phrase},
          over populations holding <Fig>{fmtInt(coveredRows)}</Fig> rows.
        </>
      }
      hint="A population is counted once however often it is re-tested. Re-testing the same rows catches problems sooner, but it does not widen what is covered."
      chart={<Meter pct={coverage.pctTested} label={`${fmtPct(coverage.pctTested)} of the library exercised`} />}
      table={
        <DataTable
          head={['Population', 'Checked by', 'Rows', 'Runs in this window']}
          numericFrom={2}
          rows={coverage.populations.map(p => [p.name, p.workflowName, fmtInt(p.size), fmtInt(p.runs)])}
        />
      }
      footer={
        <>
          Coverage counts <Fig>{fmtInt(coveredRows)}</Fig> rows. The platform performed{' '}
          <Fig>{fmtInt(checksPerformed)}</Fig> row checks to do it, about{' '}
          <Fig>{fmtOneDp(multiple)}</Fig> times over, because scheduled checks re-read the same
          populations. Adding those together would give a badly inflated figure, so they appear here
          as checks performed and stay out of the coverage line.
        </>
      }
    >
      <div className="mb-4">
        <StatRow>
          {/* The head carries how many controls were exercised, so this row
              keeps what it alone can say: what was under test, how much of it,
              and how often it was re-read. */}
          <Stat value={fmtInt(coverage.populations.length)} label="populations under test" />
          <Stat value={fmtInt(coveredRows)} label="records covered" sub="each list counted once" />
          <Stat value={fmtInt(checksPerformed)} label="checks performed" sub="repeats included" />
          <Stat value={fmtInt(coverage.neverTested.length)} label="not exercised in this window" sub={untestedSub} />
        </StatRow>
      </div>
      {coverage.tested.length > 0 && (
        <div className="mb-4">
          <Drill label={openLabel(coverage.tested.length, 'control that was tested', 'controls that were tested')}>
            <MadeList>
              {coverage.tested.map(c => (
                <MadeRow key={c.id} name={`${c.id} · ${c.name}`} madeBy={`${fmtInt(c.runs)} tests`} when={formatDate(c.lastTested)} />
              ))}
            </MadeList>
          </Drill>
        </div>
      )}
    </Block>
  );
}

/* ── Never tested ────────────────────────────────────────────────────────── */

export function NeverTested({ coverage, period }: { coverage: CoverageFigures; period: Period }) {
  const { neverExercised, workflowsNeverRun } = coverage;
  const nothingMissed = neverExercised.length === 0 && workflowsNeverRun.length === 0;

  /*
   * The window figure sits on the coverage block above with the same value on
   * it more often than not. Saying "separately, 4 controls" under a list of the
   * same 4 controls is the page repeating itself in a voice that sounds like a
   * second finding, so when the two lists are the same list the footer says so.
   */
  const neverEverIds = new Set(neverExercised.map(c => c.id));
  const sameList = coverage.neverTested.length > 0
    && coverage.neverTested.length === neverExercised.length
    && coverage.neverTested.every(c => neverEverIds.has(c.id));
  const windowFooter = coverage.neverTested.length === 0
    ? undefined
    : sameList
      ? `The ${plural(coverage.neverTested.length, 'control', 'controls')} not exercised ${period.phrase} `
        + `${coverage.neverTested.length === 1 ? 'is that same one' : 'are those same ones'}, so nothing that was tested before has gone quiet since.`
      : `Separately, ${plural(coverage.neverTested.length, 'control was', 'controls were')} not exercised ${period.phrase}, `
        + 'counting the ones above and the ones that were tested before and have gone quiet. That figure moves with the window; the lists above do not.';

  return (
    <Block
      id="never"
      title="Never exercised"
      code="COV-NEVER"
      figure={fmtInt(coverage.neverExercised.length)}
      tone={coverage.neverExercised.length > 0 ? 'risk' : 'plain'}
      context="controls with no test on record, in any window"
      hint="This block ignores the window. Never means never, over the whole history, which is the one coverage figure with no setting behind it to argue with. You cannot rely on a control nobody has ever tested, whatever the coverage percentage says."
      lede={
        nothingMissed
          ? <>Every control in the library and every check in the library has run at least once.</>
          : (
            <>
              {neverExercised.length > 0 && (
                <>
                  <Fig>{fmtInt(neverExercised.length)}</Fig>{' '}
                  {neverExercised.length === 1 ? 'control has' : 'controls have'} never been exercised
                  {workflowsNeverRun.length > 0 ? ', and ' : '. Every check in the library has run at least once.'}
                </>
              )}
              {workflowsNeverRun.length > 0 && (
                <>
                  <Fig>{fmtInt(workflowsNeverRun.length)}</Fig>{' '}
                  {workflowsNeverRun.length === 1 ? 'check has' : 'checks have'} never run.
                  {neverExercised.length === 0 && <> Every control in the library has been exercised at least once.</>}
                </>
              )}
            </>
          )
      }
      footer={windowFooter}
    >
      {nothingMissed
        ? <Empty kind="quiet" title="Nothing was missed." />
        : (
          <div className="space-y-2">
            {neverExercised.length > 0 && (
              <Drill label={openLabel(neverExercised.length, 'control never exercised', 'controls never exercised')}>
                <MadeList>
                  {neverExercised.map(c => (
                    <MadeRow key={c.id} name={`${c.id} · ${c.name}`} madeBy={c.owner} when={c.process} />
                  ))}
                </MadeList>
              </Drill>
            )}
            {workflowsNeverRun.length > 0 && (
              <Drill label={openLabel(workflowsNeverRun.length, 'check that has never run', 'checks that have never run')}>
                <MadeList>
                  {workflowsNeverRun.map(w => (
                    <MadeRow key={w.id} name={w.name} madeBy="never run" when="no runs on record" />
                  ))}
                </MadeList>
              </Drill>
            )}
          </div>
        )}
    </Block>
  );
}

/* ── The risk picture ────────────────────────────────────────────────────── */

export function RiskPicture({ risks, scope, onOpenRisks }: { risks: RiskFigures; scope: Scope; onOpenRisks: () => void }) {
  if (risks.total === 0) {
    return (
      <Block id="risks" title="The risk picture" lede={null}>
        <Empty kind="quiet" title={scope.persona === 'head_of_team' ? 'No risks are recorded against your team.' : 'The risk register is empty.'} />
      </Block>
    );
  }

  /*
   * The bars count what the head counts.
   *
   * They used to draw every risk on the register by priority while the figure
   * above them said how many had no control. Critical read as 5 under a head
   * that said 1, and a reader with no reason to doubt the chart took the louder
   * number away with them. So the bars are the uncovered risks, split the same
   * way, and the register total stays where it already was: on the right of the
   * figure, and in the sentence.
   */
  const uncoveredByPriority = risks.byPriority.map(row => ({
    label: row.label,
    value: risks.unmapped.filter(r => r.priority === row.label).length,
  }));

  return (
    <Block
      id="risks"
      title="The risk picture"
      code="RISK-UNCOVERED"
      figure={fmtInt(risks.unmapped.length)}
      of={fmtInt(risks.total)}
      tone={risks.criticalUnmapped.length > 0 ? 'risk' : 'plain'}
      context="risks on the register with no control against them"
      lede={
        risks.criticalUnmapped.length > 0
          ? (
            <>
              <Fig>{fmtInt(risks.criticalUnmapped.length)}</Fig>{' '}
              {risks.criticalUnmapped.length === 1 ? 'critical risk has' : 'critical risks have'} no
              control covering {risks.criticalUnmapped.length === 1 ? 'it' : 'them'} at all, out of{' '}
              <Fig>{fmtInt(risks.unmapped.length)}</Fig> uncovered and{' '}
              <Fig>{fmtInt(risks.total)}</Fig> on the register.
            </>
          )
          : (
            <>
              Every critical risk has a control against it. <Fig>{fmtInt(risks.unmapped.length)}</Fig> of{' '}
              <Fig>{fmtInt(risks.total)}</Fig> risks{' '}
              {risks.unmapped.length === 1 ? 'is' : 'are'} still uncovered at lower priorities.
            </>
          )
      }
      action={
        <button type="button" onClick={onOpenRisks} className="text-[0.75rem] font-medium text-brand-700 hover:underline">
          Open the register
        </button>
      }
      chart={
        <Bars
          rows={uncoveredByPriority}
          tone={risks.criticalUnmapped.length > 0 ? 'risk' : 'brand'}
          caption={
            <>
              The {plural(risks.unmapped.length, 'risk', 'risks')} with no control, by priority.
              {risks.total > risks.unmapped.length && (
                <> The other {plural(risks.total - risks.unmapped.length, 'risk on the register has', 'risks on the register have')} one.</>
              )}
            </>
          }
        />
      }
      table={
        <DataTable
          head={['Priority', 'With no control', 'On the register']}
          numericFrom={1}
          rows={uncoveredByPriority.map((r, i) => [r.label, fmtInt(r.value), fmtInt(risks.byPriority[i].value)])}
        />
      }
      footer={<><Fig>{fmtInt(risks.raisedByAi)}</Fig> of the <Fig>{fmtInt(risks.total)}</Fig> risks on the register were proposed by the assistant rather than raised by a person.</>}
    >
      {risks.unmapped.length > 0 && (
        <div className="mb-4">
          <Drill label={openLabel(risks.unmapped.length, 'risk with no control', 'risks with no control')}>
            <MadeList>
              {risks.unmapped.map(r => (
                <MadeRow key={r.id} name={`${r.id} · ${r.name}`} madeBy={r.raisedByAi ? null : r.owner} when={r.priority} note={r.category} />
              ))}
            </MadeList>
          </Drill>
        </div>
      )}
    </Block>
  );
}

/* ── What was caught ─────────────────────────────────────────────────────── */

export function ExceptionsCaught({
  exceptions, period, subject, onOpenException,
}: {
  exceptions: ExceptionFigures;
  period: Period;
  subject: string;
  onOpenException: (id: string) => void;
}) {
  if (exceptions.total === 0) {
    return (
      <Block id="caught" title="What was caught" lede={null}>
        <Empty kind="quiet" title={`Nothing was caught ${period.phrase}.`} detail="No exception was raised in this window. Findings are recorded whenever they happen, so the window was quiet and nothing went unrecorded." />
      </Block>
    );
  }

  const worst = exceptions.bySeverity.find(s => s.value > 0);

  return (
    <Block
      id="caught"
      title="What was caught"
      code="EXC-RAISED"
      figure={fmtInt(exceptions.total)}
      context={<>exceptions raised {period.phrase}, {fmtInt(exceptions.open)} still open</>}
      lede={
        <>
          <Fig>{fmtInt(exceptions.total)}</Fig>{' '}
          {exceptions.total === 1 ? 'exception was' : 'exceptions were'} raised across{' '}
          {subject === 'you' ? 'your own work' : subject} {period.phrase},{' '}
          <Fig>{fmtInt(exceptions.open)}</Fig> of those still open
          {worst && <> and <Fig>{fmtInt(worst.value)}</Fig> at {worst.label.toLowerCase()} severity</>}.
        </>
      }
      chart={
        <Bars
          rows={exceptions.bySeverity.map(s => ({ label: s.label, value: s.value }))}
          tone="risk"
          caption={exceptions.total === 1
            ? <>The one raised, by severity.</>
            : <>All {fmtInt(exceptions.total)} of them, by severity, open and resolved together.</>}
        />
      }
      table={<DataTable head={['Severity', 'Exceptions']} rows={exceptions.bySeverity.map(s => [s.label, fmtInt(s.value)])} />}
      footer={<DeduplicationLimits beforeDeduplication={exceptions.beforeDeduplication} />}
    >
      <div className="mb-4">
        <Drill label={openLabel(exceptions.total, 'exception', 'exceptions')}>
          <MadeList>
            {exceptions.rows.map(ex => (
              <MadeRow
                key={ex.id}
                name={`${ex.ref} · ${ex.title}`}
                madeBy={`${ex.severity} · ${ex.status} · found by ${ex.workflowName}`}
                when={formatDate(ex.detectedAt)}
                note={`caught ${fmtOneDp((ex.detectedAt - ex.occurredAt) / 86_400_000)} days after it happened`}
                onOpen={() => onOpenException(ex.engagementId)}
              />
            ))}
          </MadeList>
        </Drill>
      </div>
    </Block>
  );
}
