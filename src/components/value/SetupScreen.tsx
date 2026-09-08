/**
 * What a workspace sees before the groundwork is done.
 *
 * A tenant with no control register loaded and nothing timed would see a page
 * of noughts. That is correct behaviour under the no estimation rule, and it
 * is also unusable: a finance lead opening a blank page decides the feature is
 * broken rather than that the evidence is missing.
 *
 * So below the coverage threshold the value page does not open at all. An
 * administrator gets this instead, which is the same worklist the benchmarks
 * screen holds, framed as the thing to go and do. Everybody else is told
 * plainly that it is not ready and who is working on it.
 *
 * That makes coverage the thing people work on, which is the correct thing for
 * them to work on.
 */

import {
  fmtInt, fmtPct, ladderRows, plural, reviewQueue, surfaceRows, ALL_TIME,
  type Snapshot, type ValueSettings,
} from '../../data/value/model';
import { BAND_LABEL } from '../../data/value/settings';
import { Block, Flag, Row, Table } from './chrome';

export default function SetupScreen({
  platform, settings, isAdmin, onSettings,
}: {
  platform: Snapshot;
  settings: ValueSettings;
  isAdmin: boolean;
  onSettings: (next: ValueSettings) => void;
}) {
  const rows = ladderRows(ALL_TIME, settings);
  const unmapped = rows.filter(row => row.basis === null);
  const queue = reviewQueue(settings);
  const surfaces = surfaceRows(settings).filter(s => !s.used);

  if (!isAdmin) {
    return (
      <div className="border-t border-canvas-border py-10">
        <p className="text-[1rem] leading-relaxed text-ink-800">
          This page is not ready yet.
        </p>
        <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-ink-500">
          It reports what the platform gave back, and it will only report work whose manual effort
          your own control documentation states or somebody has timed. Not enough of that exists
          yet, so the page would be mostly blank and the little it did show would be misleading. An
          administrator is loading the control registers and running the timings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7 pt-5">
      <div>
        <p className="text-[1rem] leading-relaxed text-ink-800">
          The value page is not open yet, because too little of what this workspace does has
          evidence behind it.
        </p>
        <p className="mt-2 max-w-3xl text-[0.875rem] leading-relaxed text-ink-500">
          Nothing here is estimated, so a workflow with no documented control and no timing produces
          no hours and no rupees at all. Below {fmtPct(settings.minCoveragePct)} of run volume the
          page would be mostly blank, so it stays shut and this worklist stands in its place. Every
          line you close moves the page closer to opening, and the ones at the top move it most.
        </p>
      </div>

      <div className="grid gap-x-8 gap-y-2 border-y border-canvas-border py-4 sm:grid-cols-3">
        <Row
          label="Run volume with evidence"
          value={fmtPct(platform.runCoveragePct)}
          sub={`The page opens at ${fmtPct(settings.minCoveragePct)}.`}
        />
        <Row
          label="Workflows with nothing behind them"
          value={fmtInt(unmapped.length)}
          sub={`${fmtInt(unmapped.reduce((sum, row) => sum + row.runs, 0))} runs between them.`}
        />
        <Row
          label="Timings still to do"
          value={fmtInt(surfaces.length)}
          sub="One sitting each, and a whole band comes into scope."
        />
      </div>

      {queue.length > 0 ? (
        <Block
          title="First, check what was read out of your documents"
          hint="The platform parsed these out of a register. None of them count until a person confirms the reading."
        >
          <div className="space-y-3">
            {queue.map(c => (
              <div key={c.controlId} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-canvas-border/60 pb-3">
                <span className="text-[0.875rem] text-ink-800">
                  <span className="font-medium">{c.controlId}</span> {c.description}
                  <span className="mt-0.5 block text-ink-500">
                    {c.sourceDocument} page {c.sourcePage}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onSettings({ ...settings, extraApprovals: [...settings.extraApprovals, c.controlId] })}
                  className="rounded border border-canvas-border px-2.5 py-1 text-[0.875rem] text-ink-800 hover:border-ink-400 hover:bg-canvas"
                >
                  This reading is right
                </button>
              </div>
            ))}
          </div>
        </Block>
      ) : null}

      <Block
        title="Then map the workflows that run most"
        hint="Busiest first, because those are the ones that move coverage."
      >
        <Table
          columns={[
            { head: 'Workflow' },
            { head: 'Band' },
            { head: 'Runs', align: 'right' },
            { head: 'What it needs' },
          ]}
          rows={unmapped.slice(0, 8).map(row => [
            row.name,
            <span key="b" className="text-ink-500">{BAND_LABEL[row.band]}</span>,
            fmtInt(row.runs),
            <span key="f">
              {row.miss?.reason}
              <span className="mt-0.5 block text-ink-500">{row.miss?.fix}</span>
            </span>,
          ])}
          caption={
            unmapped.length > 8
              ? `${plural(unmapped.length - 8, 'more workflow is', 'more workflows are')} in the same state.`
              : undefined
          }
        />
      </Block>

      <Block
        title="And run the timings"
        hint="Chat, files and government lookups have no control documentation behind them, so a stopwatch is the only route."
      >
        <Table
          columns={[{ head: 'What to time' }, { head: 'Band' }, { head: 'Why it is waiting' }]}
          rows={surfaces.slice(0, 10).map(s => [
            s.surface,
            s.band ? BAND_LABEL[s.band] : <span key="b" className="text-ink-400">not banded</span>,
            s.miss?.reason ?? '',
          ])}
        />
      </Block>

      <Flag>
        {settings.reachBackOverHistory
          ? 'None of this work is lost while the page is shut. Every run is already recorded, so the first register you load values a year of history at once rather than starting the clock today.'
          : 'History is switched off in settings, so the figures you load will value only work done after them. Turning it on makes the first register you load value a year of history at once.'}
      </Flag>

      <Flag>
        You can also lower the threshold in settings, and it is worth thinking about before you do.
        The page is only as good as the coverage figure beside it, and a finance lead who opens it
        at fifteen per cent coverage will remember the blank space rather than the number.
      </Flag>
    </div>
  );
}
