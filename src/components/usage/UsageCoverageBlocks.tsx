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
  fmtInt, fmtOneDp, fmtPct, openLabel,
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

  return (
    <Block
      id="coverage"
      title="Control coverage"
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
          <Stat value={fmtInt(coverage.tested.length)} label="controls exercised" />
          <Stat value={fmtInt(coverage.neverTested.length)} label="never tested in this window" />
          <Stat value={fmtInt(coverage.populations.length)} label="populations under test" />
          <Stat value={fmtInt(checksPerformed)} label="checks performed" sub="repeats included" />
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

  return (
    <Block
      id="never"
      title="Never exercised"
      hint="This block ignores the window. Never means never, over the whole history, which is the one coverage figure with no setting behind it to argue with."
      lede={
        nothingMissed
          ? <>Every control in the library and every check in the library has run at least once.</>
          : (
            <>
              <Fig>{fmtInt(neverExercised.length)}</Fig>{' '}
              {neverExercised.length === 1 ? 'control has' : 'controls have'} never been exercised,
              and <Fig>{fmtInt(workflowsNeverRun.length)}</Fig>{' '}
              {workflowsNeverRun.length === 1 ? 'check has' : 'checks have'} never run. You cannot
              rely on a control nobody has ever tested, whatever the coverage percentage says.
            </>
          )
      }
      footer={
        coverage.neverTested.length > 0
          ? `Separately, ${fmtInt(coverage.neverTested.length)} ${coverage.neverTested.length === 1 ? 'control was' : 'controls were'} not exercised ${period.phrase}. That one moves with the window; the lists above do not.`
          : undefined
      }
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

  return (
    <Block
      id="risks"
      title="The risk picture"
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
      chart={<Bars rows={risks.byPriority} tone={risks.criticalUnmapped.length > 0 ? 'risk' : 'brand'} />}
      table={<DataTable head={['Priority', 'Risks']} rows={risks.byPriority.map(r => [r.label, fmtInt(r.value)])} />}
      footer={<><Fig>{fmtInt(risks.raisedByAi)}</Fig> of these were proposed by the assistant rather than raised by a person.</>}
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
      lede={
        <>
          <Fig>{fmtInt(exceptions.total)}</Fig>{' '}
          {exceptions.total === 1 ? 'exception was' : 'exceptions were'} raised across{' '}
          {subject === 'you' ? 'your own work' : subject} {period.phrase},{' '}
          <Fig>{fmtInt(exceptions.open)}</Fig> of them still open
          {worst && <> and <Fig>{fmtInt(worst.value)}</Fig> at {worst.label.toLowerCase()} severity</>}.
        </>
      }
      chart={<Bars rows={exceptions.bySeverity.map(s => ({ label: s.label, value: s.value }))} tone="risk" />}
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
