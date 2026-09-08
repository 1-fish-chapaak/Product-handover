/**
 * Controls and benchmarks. The worklist that decides how much of the page can
 * carry a number at all.
 *
 * Sorted by how much each workflow runs, so the workflows that move the total
 * most sit at the top and the gap worth closing first is the gap seen first. A
 * screen listing eleven workflows alphabetically would bury the one that runs
 * forty times a quarter behind three that ran twice.
 *
 * Two things here write, and both change every figure on every scope the
 * moment they are done: checking a parsed control, and mapping a workflow to
 * one. Everything else on this screen is evidence somebody has to go and
 * gather with a stopwatch, and the screen says so rather than offering a box
 * to type a number into.
 */

import {
  BAND_LABEL, fmtInt, fmtMinutes, fmtPct, formatDate, ladderRows, mappableControls, plural,
  reviewQueue, stepTiming, surfaceRows,
  type Range, type Snapshot, type ValueSettings,
} from '../../data/value/model';
import { EFFORT_BASIS_LABEL, documentedHours, type ControlRegisterEntry } from '../../data/value/controls';
import { BasisChip, Block, CoverageBar, Flag, NotValued, Row, Table } from './chrome';

export default function ControlsBenchmarks({
  r, phrase, snap, gatePct, settings, onSettings,
}: {
  r: Range;
  phrase: string;
  snap: Snapshot;
  /** Run coverage over all time, which is what the tab is actually gated on. */
  gatePct: number;
  settings: ValueSettings;
  onSettings: (next: ValueSettings) => void;
}) {
  const rows = ladderRows(r, settings);
  const queue = reviewQueue(settings);
  const surfaces = surfaceRows(settings);
  const diverging = rows.filter(row => row.diverges);
  const stale = rows.filter(row => row.stale);
  const step = stepTiming();

  const approve = (c: ControlRegisterEntry) =>
    onSettings({ ...settings, extraApprovals: [...settings.extraApprovals, c.controlId] });

  const map = (workflowId: string, controlId: string) => {
    if (!controlId) return;
    onSettings({ ...settings, extraMappings: [...settings.extraMappings, { workflowId, controlId }] });
  };

  return (
    <div className="space-y-7">
      <p className="text-[1rem] leading-relaxed text-ink-800">
        Nothing on this platform is valued without evidence, so this screen is where the value page
        gets bigger. Every line below either has a document or a timing behind it, or it is work the
        page is counting and refusing to price.
      </p>

      <div>
        <CoverageBar
          documentedPct={snap.coverage.documentedPct}
          measuredPct={snap.coverage.measuredPct}
          unvaluedPct={snap.coverage.unvaluedPct}
        />
        <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-3">
          <Row
            label="Work with evidence behind it"
            value={fmtPct(snap.coverage.valuedPct)}
            sub={`${fmtInt(snap.valued)} of ${fmtInt(snap.counted)} things counted ${phrase}`}
          />
          <Row
            label="Run volume with evidence, all time"
            value={fmtPct(gatePct)}
            sub={`The page is hidden below ${fmtPct(settings.minCoveragePct)}, so this is the figure that keeps it open.`}
          />
          <Row
            label="Waiting to be checked"
            value={fmtInt(queue.length)}
            sub="A parsed control counts for nothing until a person has looked at it."
          />
        </div>
      </div>

      {queue.length > 0 ? (
        <Block
          title="Waiting to be checked"
          hint="Read out of a document by the platform and not yet confirmed by a person. None of these count for anything until somebody looks."
        >
          <div className="space-y-3">
            {queue.map(c => (
              <div key={c.controlId} className="border-b border-canvas-border/60 pb-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="text-[0.875rem] font-medium text-ink-900">{c.controlId}</span>
                  <button
                    type="button"
                    onClick={() => approve(c)}
                    className="rounded border border-canvas-border px-2.5 py-1 text-[0.875rem] text-ink-800 hover:border-ink-400 hover:bg-canvas"
                  >
                    This reading is right
                  </button>
                </div>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-800">{c.description}</p>
                <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
                  Read as{' '}
                  {documentedHours(c) === null
                    ? 'a step count with no timed step behind it'
                    : fmtMinutes((documentedHours(c) as number) * 60)}{' '}
                  of manual effort, {EFFORT_BASIS_LABEL[c.effortBasis].toLowerCase()}, from{' '}
                  {c.sourceDocument} page {c.sourcePage}.
                </p>
              </div>
            ))}
          </div>
          <Flag>
            Confirming one of these moves every figure on the value page. A misread cell in a
            spreadsheet becoming the headline number is the single worst thing that could happen
            here, which is why nothing promotes itself.
          </Flag>
        </Block>
      ) : null}

      <Block
        title="Every workflow, busiest first"
        hint={`Runs counted ${phrase}. A workflow with no line under How we know is being counted and not valued.`}
      >
        <Table
          columns={[
            { head: 'Workflow' },
            { head: 'Band' },
            { head: 'Runs', align: 'right' },
            { head: 'Control' },
            { head: 'Timing' },
            { head: 'Setup' },
            { head: 'By hand', align: 'right' },
            { head: 'How we know' },
          ]}
          rows={rows.map(row => [
            <span key="n">
              {row.name}
              {row.sharedWith.length > 0 ? (
                <span className="mt-0.5 block text-[0.75rem] text-ink-500">{row.sharedWith.join('. ')}</span>
              ) : null}
            </span>,
            <span key="b" className="text-ink-500">{BAND_LABEL[row.band]}</span>,
            fmtInt(row.runs),
            row.controls.length > 0 ? (
              <span key="c">
                {row.controls.map(c => (
                  <span key={c.controlId} className="block">
                    <span className="font-medium">{c.controlId}</span>{' '}
                    <span className="text-ink-500">
                      {c.sourceDocument} page {c.sourcePage}
                    </span>
                  </span>
                ))}
              </span>
            ) : (
              <MapControl key="m" workflowId={row.workflowId} onMap={map} />
            ),
            row.timing ? (
              <span key="t" className={row.timingUsed ? 'text-ink-800' : 'text-ink-500'}>
                {fmtMinutes(row.timing.minutes)} on {plural(row.timing.sampleSize, 'auditor', 'auditors')},{' '}
                {formatDate(row.timing.timedAt)}
                {row.timingUsed ? '' : ', not used'}
                {row.divergencePct !== null ? (
                  <span className="block text-[0.75rem]">{fmtPct(row.divergencePct)} away from the document</span>
                ) : null}
              </span>
            ) : (
              <span key="t" className="text-ink-400">none</span>
            ),
            row.setup ? (
              <span key="s" className="text-ink-500">
                {fmtInt(row.setup.minutes)} min on {plural(row.setup.sampleSize, 'auditor', 'auditors')}
              </span>
            ) : (
              <span key="s" className="text-ink-400">not timed</span>
            ),
            row.manualMinutes === null
              ? <span key="h" className="text-ink-400">—</span>
              : fmtMinutes(row.manualMinutes),
            <span key="k" className="inline-flex flex-col items-start gap-1">
              {row.basis ? <BasisChip basis={row.basis} small /> : <NotValued small />}
              <span className="text-[0.75rem] text-ink-500">{row.basis ? row.source : row.miss?.reason}</span>
              {row.basis ? null : <span className="text-[0.75rem] text-ink-500">{row.miss?.fix}</span>}
              {row.stale ? <span className="text-[0.75rem] text-ink-500">This figure is over a year old</span> : null}
            </span>,
          ])}
          caption={
            <>
              Setup is what a batch avoids, once for every run after the first. A workflow with no
              setup timing still values its runs normally and earns nothing extra for batching.
            </>
          }
        />
      </Block>

      <Block
        title="The other three surfaces"
        hint="Chat, files and government lookups have no control documentation behind them, so a timing is the only way any of them can be valued. One sitting brings a whole band into scope."
      >
        <Table
          columns={[
            { head: 'Surface' },
            { head: 'Band' },
            { head: 'Timing' },
            { head: 'In use' },
          ]}
          rows={surfaces.map(s => [
            s.surface,
            s.band ? BAND_LABEL[s.band] : <span key="b" className="text-ink-400">not banded</span>,
            s.timing
              ? `${fmtMinutes(s.timing.minutes)} on ${plural(s.timing.sampleSize, 'auditor', 'auditors')}, ${formatDate(s.timing.timedAt)}`
              : <span key="t" className="text-ink-400">none</span>,
            s.used
              ? <BasisChip key="u" basis="measured" small />
              : (
                <span key="u" className="inline-flex flex-col items-start gap-1">
                  <NotValued small />
                  <span className="text-[0.75rem] text-ink-500">{s.miss?.reason}</span>
                </span>
              ),
          ])}
          caption={
            <>
              A government lookup is timed per lookup type rather than per band, because each one is
              a different portal. Nine of the fourteen have not been timed and are counted without a
              value.
            </>
          }
        />
      </Block>

      <Block title="Worth a look" hint="Things this screen found that are not errors and are not nothing either.">
        <div className="space-y-3">
          {diverging.map(row => (
            <Flag key={row.workflowId}>
              On {row.name}, your document says {fmtMinutes(row.manualMinutes ?? 0)} and a timing on{' '}
              {plural(row.timing?.sampleSize ?? 0, 'auditor', 'auditors')} says{' '}
              {fmtMinutes(row.timing?.minutes ?? 0)}, a gap of {fmtPct(row.divergencePct ?? 0)}. That is
              either a padded budget or a timing that was not representative. The document still
              wins, because it is the one nobody can argue with.
            </Flag>
          ))}
          {stale.map(row => (
            <Flag key={`stale-${row.workflowId}`}>
              The figure behind {row.name} was last confirmed over a year ago. It is still used and
              it is still said to be old, because dropping it would leave the work unvalued rather
              than better valued.
            </Flag>
          ))}
          <Flag>
            Documented effort is usually planned or budgeted time rather than measured actual, and
            budgets are often generous. It may overstate what the work really takes. It stays the
            figure in force because it is yours, and wherever a timing disagrees with it both are
            shown rather than the flattering one being picked quietly.
          </Flag>
          <Flag>
            Effort built from written steps rests on one timing: {fmtInt(step.minutes)} minutes a
            step, on {plural(step.sampleSize, 'auditor', 'auditors')}, by {step.timedBy.name} on{' '}
            {formatDate(step.timedAt)}. Without it a step count is just a count, and every control
            priced that way would fall out of the figures.
          </Flag>
          {!settings.chatBands.validatedAgainstSample ? (
            <Flag>{settings.chatBands.validationNote}</Flag>
          ) : null}
          <Flag>
            {settings.reachBackOverHistory
              ? 'Closing a line here values history as well as the future. The runs were recorded long before anybody wrote the effort down, so a register loaded today makes every past run of the workflows it covers worth something at once. The value page says how much of its total came that way.'
              : 'History is switched off in settings, so a figure closed here values only work done from its effective date onwards. Past runs of the same workflow stay counted and unvalued.'}
          </Flag>
        </div>
      </Block>

      <Block
        title="What this screen cannot do"
        hint="Said plainly, because a button that does not do what it says is worse than no button."
      >
        <ul className="space-y-2 text-[0.875rem] leading-relaxed text-ink-500">
          <li>
            A timing cannot be added here. It comes from somebody sitting with an auditor and a
            stopwatch, and typing a number into this screen would produce a figure with nothing
            behind it wearing the word measured.
          </li>
          <li>
            A documented effort figure cannot be edited here. It is your document, and if the
            document is wrong the fix belongs in the document.
          </li>
          <li>
            Checking a parse and mapping a workflow take effect for this session only in this build.
            In the real thing both are written, dated and attributed.
          </li>
        </ul>
      </Block>
    </div>
  );
}

/** A control to hang an unmapped workflow on. The one change that moves the most. */
function MapControl({
  workflowId, onMap,
}: { workflowId: string; onMap: (workflowId: string, controlId: string) => void }) {
  return (
    <select
      defaultValue=""
      onChange={e => onMap(workflowId, e.target.value)}
      className="rounded border border-canvas-border bg-canvas-elevated px-2 py-1 text-[0.875rem] text-ink-800"
    >
      <option value="">Map to a control</option>
      {mappableControls().map(c => {
        const hours = documentedHours(c);
        return (
          <option key={c.controlId} value={c.controlId}>
            {c.controlId}, {hours === null ? 'no hours' : fmtMinutes(hours * 60)}
          </option>
        );
      })}
    </select>
  );
}
