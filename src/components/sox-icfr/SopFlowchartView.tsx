/**
 * The flowchart view of an SOP draft — the third of the three things an SOP
 * upload produces, and the one the user named the aim of: "you will map out the
 * risks on the flowchart, and then your corresponding controls."
 *
 * So that is what it draws, as a tree from the SOP outwards (29 Sep):
 *
 *                       ┌───────────────┐
 *                       │   SOP name    │      the initiation point
 *                       └───────┬───────┘
 *                  ┌────────────┼────────────┐
 *               [risk]       [risk]       [risk]
 *              ┌───┴───┐        │        ┌───┴───┐
 *           [ctrl] [ctrl]    [ctrl]   [ctrl] [ctrl]
 *
 * Each risk appears once, however many stages its controls fall across — a
 * tree has one node per thing, and a risk drawn twice would read as two risks.
 * Stages have no boxes here; they decide the left-to-right order and keep
 * their own headings on the Spine.
 *
 * It reads `buildSpine` rather than grouping the rows itself, so the chart and
 * the Matrix beside it can never be two different accounts of one draft.
 *
 * WHAT IT DRAWS IS A DRAFT (29 Sep). An SOP gives the order of steps, the roles,
 * the systems and the decision points. It does NOT give where the control
 * actually sits — before the entry is posted or after it, which is the single
 * question the design test exists to answer — nor the workarounds the process
 * has grown since the SOP was written, nor the override routes the SOP lists as
 * exceptions and people use routinely. So the chart says `SOP-derived,
 * unconfirmed` on its face, and the auditor confirms or corrects it after the
 * walkthrough. Until then it satisfies no document requirement.
 *
 * Two things are drawn in this file, from one `buildSpine` and one set of
 * rails: the chart itself, and `SopFlowchartStructure` — its shape with the
 * names taken off, which is all the prompt step shows until the prompt has been
 * validated. See that component for why.
 *
 * Drawn with stacked boxes and chevrons rather than measured SVG edges: the
 * shape is a tree that only ever flows one way, so there is nothing a bezier
 * would buy that a border and an arrow do not. It matches the process flow the
 * audit module already draws (`audit/SopProcessFlow`).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileText, Minus, Plus, ShieldCheck, Star } from 'lucide-react';
import { Pill } from '../shared/StatusBadge';
import { buildSpine, risksAcrossStages, type SpineControl, type SpineRisk, type SpineOptions } from './sopSpine';
import type { ImportRow } from './racmImport';

interface SopFlowchartViewProps extends SpineOptions {
  rows: ImportRow[];
  /** Rename a risk, keyed by `SpineRisk.key`. The user's ask (25 Sep):
   *  "agar user ko koi risk name change karna ho to wo kar sakta hai, instead
   *  of writing in prompt." */
  onRenameRisk: (key: string, to: string) => void;
  /** The same for a control, keyed by `SpineControl.sourceId`. `was` is the
   *  name on screen before the edit — kept so the first rename can record the
   *  title the stage grouping was worked out from. */
  onRenameControl: (sourceId: string, to: string, was: string) => void;
  /** Drawn beside the prompt rather than on its own step: narrower boxes, and
   *  no header of its own — the prompt step has one. Compact also means the
   *  chart is framed by a pane of a fixed height, which is what makes Fit
   *  mean something. */
  compact?: boolean;
  /** Preview draws the same chart with its names not offering to be typed
   *  over (user ask, 29 Sep: "there will be a preview and an edit option").
   *  Renaming belongs to Edit, beside the box that explains it. */
  editable?: boolean;
}

/** Zoom stops. A process runs long before it runs wide, so the floor is low
 *  enough to get a twenty-control chart into one pane (user ask, 27 Sep:
 *  "so that user can look at the complete flowchart in one go") — small, but
 *  the shape is what you are reading at that size, not the words. */
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

/**
 * A name on the chart that can be typed over.
 *
 * Rendered as a button so it is reachable by keyboard and announces itself as
 * something to press; it swaps for an input in place, so the box never moves
 * and the reader never loses where they were. A blank or unchanged value is
 * dropped rather than saved — an edit nobody made is not an edit.
 */
function EditableName({ value, onSave, label, className, editable }: {
  value: string; onSave: (to: string) => void; label: string; className: string; editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  // In Preview the names are not offering anything, so they must not look as
  // though they are: a box that highlights under the cursor and then does
  // nothing is a worse lie than a plain one.
  if (!editable) return <p className={className}>{value}</p>;
  if (editing) {
    return (
      <input autoFocus defaultValue={value} aria-label={label}
        onBlur={e => { const v = e.target.value.trim(); if (v && v !== value) onSave(v); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          // Stops the dialog's own Escape handler from closing the step under us.
          if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); }
        }}
        className={`${className} w-full rounded border border-brand-400 bg-canvas px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-200`} />
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)} title="Click to rename"
      className={`${className} w-full text-left rounded px-1 py-0.5 -mx-1 hover:bg-canvas/70 hover:ring-1 hover:ring-canvas-border transition-colors cursor-text`}>
      {value}
    </button>
  );
}

/** The stub of line that leaves a box on its way down to the fan below it. */
const Trunk = () => <span className="h-4 w-px bg-canvas-border shrink-0" aria-hidden />;

/**
 * The join above ONE child of a fan.
 *
 * Drawn the way an org chart draws one: a horizontal rail that reaches toward
 * the siblings — rightwards from the first, leftwards from the last, both ways
 * from the ones between — and a drop into the box. The rails of neighbouring
 * children meet because each spans its whole column, padding included.
 *
 * An only child gets the drop and no rail: there is nothing to reach for, and
 * a stub of line hanging in the air reads as an edge to something missing.
 */
function Elbow({ i, n }: { i: number; n: number }) {
  const rail = n < 2 ? null
    : i === 0 ? 'left-1/2 right-0'
      : i === n - 1 ? 'left-0 right-1/2'
        : 'left-0 right-0';
  return (
    <div className="relative h-5 w-full shrink-0" aria-hidden>
      {rail && <span className={`absolute top-0 h-px bg-canvas-border ${rail}`} />}
      <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-canvas-border" />
    </div>
  );
}

/** Where the whole chart starts: the document everything below was read out of. */
function RootNode({ source, process, entity }: { source: string; process: string; entity: string }) {
  return (
    <div className="w-[19rem] rounded-xl border border-ink-300 bg-canvas-elevated px-4 py-3 text-center">
      <p className="flex items-center justify-center gap-1.5 text-[0.8125rem] font-semibold text-ink-900 leading-snug">
        <FileText size={13} className="text-ink-400 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">{source}</span>
      </p>
      <p className="mt-0.5 text-[0.6875rem] text-ink-500">{process}{entity ? ` · ${entity}` : ''}</p>
    </div>
  );
}

function RiskNode({ risk, width, onRename, editable }: {
  risk: SpineRisk; width: string; onRename: (key: string, to: string) => void; editable: boolean;
}) {
  return (
    <div className={`${width} rounded-xl border border-risk-300 bg-risk-50 px-3.5 py-2.5`}>
      <p className="flex items-center gap-1.5 text-[0.65625rem] font-semibold uppercase tracking-wide text-risk-700">
        <AlertTriangle size={11} aria-hidden /> Risk{risk.riskId ? ` · ${risk.riskId}` : ''}
      </p>
      <div className="mt-1">
        <EditableName value={risk.title} label={`Rename the risk ${risk.title}`} editable={editable}
          onSave={to => onRename(risk.key, to)}
          className="text-[0.78125rem] font-medium leading-snug text-ink-900" />
      </div>
    </div>
  );
}

function ControlNode({ c, width, onRename, editable }: {
  c: SpineControl; width: string; onRename: (sourceId: string, to: string, was: string) => void; editable: boolean;
}) {
  return (
    <div className={`${width} rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5`}>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.65625rem] font-semibold text-brand-700">
        <ShieldCheck size={11} aria-hidden />
        <span className="font-mono">{c.id}</span>
        {c.isKey && (
          <span className="inline-flex items-center gap-0.5 text-mitigated-700" title="Key control">
            <Star size={10} className="fill-mitigated-200" aria-hidden /> Key
          </span>
        )}
      </p>
      <div className="mt-1">
        <EditableName value={c.title} label={`Rename the control ${c.title}`} editable={editable}
          onSave={to => onRename(c.sourceId, to, c.title)}
          className="text-[0.78125rem] leading-snug text-ink-900" />
      </div>
      {c.suggested
        ? <p className="mt-1 text-[0.65625rem] text-ink-500">Not in the SOP — suggested by Ira</p>
        : c.section && <p className="mt-1 text-[0.65625rem] font-mono text-ink-400">{c.section}</p>}
    </div>
  );
}

/** A risk and everything standing against it — one branch of the tree. Its
 *  controls fan out beneath it rather than stacking, so two controls against
 *  one risk read as two answers to it and not as one after the other. */
function RiskBranch({ risk, i, n, width, onRenameRisk, onRenameControl, editable }: {
  risk: SpineRisk; i: number; n: number; width: string;
  onRenameRisk: (key: string, to: string) => void;
  onRenameControl: (sourceId: string, to: string, was: string) => void;
  editable: boolean;
}) {
  const controls = risk.controls;
  return (
    <div className="flex flex-col items-center">
      <Elbow i={i} n={n} />
      <RiskNode risk={risk} width={width} onRename={onRenameRisk} editable={editable} />
      {controls.length === 0 ? (
        <>
          <Trunk />
          {/* The one thing this chart exists to make impossible to miss. */}
          <div className={`${width} rounded-xl border border-dashed border-risk-300 px-3.5 py-2.5 text-center text-[0.75rem] font-semibold text-risk-700`}>
            No control against this risk
          </div>
        </>
      ) : (
        <>
          <Trunk />
          <div className="flex items-start justify-center">
            {controls.map((c, j) => (
              <div key={c.id} className="flex flex-col items-center">
                <Elbow i={j} n={controls.length} />
                <ControlNode c={c} width={width} onRename={onRenameControl} editable={editable} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface SopFlowchartStructureProps extends SpineOptions {
  rows: ImportRow[];
}

/**
 * THE STRUCTURE — what a prompt draws, beside the prompt that draws it.
 *
 * The user's ask (29 Sep): "in the preview where we show the prompt on the
 * left-hand side, we will just show the structure of the flowchart and not the
 * complete flowchart. Once we have validated the prompt, then only the user
 * will be able to see the flowchart."
 *
 * So the boxes are numbered rather than named — Risk 1, Control 1 — and the
 * only words on the page are the SOP's own file name at the top. Blank boxes
 * were ruled out ("box mein blank nahi rakhna hai"): a grey rectangle says
 * nothing about what it stands for, and a reader cannot tell a risk from a
 * control by shape alone.
 *
 * What is being read here is the COUNT and the FAN, which is exactly what a
 * prompt changes: does this wording find four risks or one, do the controls
 * spread across them, and is any risk left standing on its own. The names are
 * the chart, and the chart is what validating the prompt earns.
 *
 * It goes through `buildSpine` like the chart does, so the shape shown here is
 * the shape that arrives — never a flattering sketch of a draft that then
 * lands different.
 */
export function SopFlowchartStructure({
  rows, process, entity, source, idFor, omitted, classifyBy,
}: SopFlowchartStructureProps) {
  const spine = useMemo(
    () => buildSpine(rows, { process, entity, source, idFor, omitted, classifyBy }),
    [rows, process, entity, source, idFor, omitted, classifyBy],
  );
  const risks = useMemo(() => risksAcrossStages(spine), [spine]);

  /** Controls are numbered straight through the chart rather than restarting
   *  under each risk: 1 to 9 reads as nine controls, where 1,2 · 1,2,3 · 1 has
   *  to be added up before it says anything. */
  const firstControlNo = useMemo(
    () => risks.map((_, i) => risks.slice(0, i).reduce((n, r) => n + r.controls.length, 0)),
    [risks],
  );

  // The horizontal gap between columns is a MARGIN on the box, never padding
  // on the column: `Elbow` is `w-full` of its column, so padding there would
  // hold the rails apart and five boxes would read as five loose ticks rather
  // than one fan. With a margin the column is box+gap wide and the rails of
  // neighbouring columns meet exactly.
  const box = 'w-[7.5rem] mx-1.5 rounded-lg px-2.5 py-2 text-center';
  const boxLabel = 'flex items-center justify-center gap-1 text-[0.75rem] font-semibold';

  if (!risks.length) {
    return (
      <p className="h-full flex items-center justify-center text-center text-[0.75rem] text-ink-500">
        This prompt finds no risks, so there is no shape to draw.
      </p>
    );
  }

  return (
    <section aria-label="Flowchart structure" className="h-full overflow-auto">
      <div className="flex flex-col items-center py-2 min-w-max mx-auto">
        {/* The one real name on the structure — everything below is read out
            of this document, and without it the shape belongs to nothing. */}
        <div className="w-[15rem] rounded-xl border border-ink-300 bg-canvas-elevated px-4 py-2.5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[0.78125rem] font-semibold text-ink-900 leading-snug">
            <FileText size={12} className="text-ink-400 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{source}</span>
          </p>
        </div>
        <Trunk />
        <div className="flex items-start justify-center">
          {risks.map((risk, i) => (
            <div key={risk.key} className="flex flex-col items-center">
              <Elbow i={i} n={risks.length} />
              <div className={`${box} border border-risk-300 bg-risk-50`}>
                <p className={`${boxLabel} text-risk-700`}>
                  <AlertTriangle size={11} aria-hidden /> Risk {i + 1}
                </p>
              </div>
              <Trunk />
              {risk.controls.length === 0 ? (
                /* The one thing worth reading off a shape with no names on it. */
                <div className={`${box} border border-dashed border-risk-300`}>
                  <p className={`${boxLabel} text-risk-700`}>No control</p>
                </div>
              ) : (
                <div className="flex items-start justify-center">
                  {risk.controls.map((c, j) => (
                    <div key={c.id} className="flex flex-col items-center">
                      <Elbow i={j} n={risk.controls.length} />
                      <div className={`${box} border border-brand-200 bg-brand-50`}>
                        <p className={`${boxLabel} text-brand-700`}>
                          <ShieldCheck size={11} aria-hidden /> Control {firstControlNo[i]! + j + 1}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function SopFlowchartView({
  rows, process, entity, source, idFor, omitted, classifyBy,
  onRenameRisk, onRenameControl, compact = false, editable = true,
}: SopFlowchartViewProps) {
  const spine = useMemo(
    () => buildSpine(rows, { process, entity, source, idFor, omitted, classifyBy }),
    [rows, process, entity, source, idFor, omitted, classifyBy],
  );
  /** One node per risk, in the order the work happens. */
  const risks = useMemo(() => risksAcrossStages(spine), [spine]);
  // The gap between branches rides on the node as a margin, so `Elbow`
  // (w-full of its column) spans the whole column and neighbouring rails
  // touch. As padding on the column it did not, and the fan read as a row of
  // detached stubs.
  const width = compact ? 'w-[13rem] mx-2' : 'w-[15rem] mx-2';

  // Drawn with CSS `zoom` rather than a transform, because zoom reflows: the
  // pane's scrollbars shrink with the chart instead of guarding empty space
  // where the full-size drawing used to be.
  const [zoom, setZoom] = useState(1);
  const viewRef = useRef<HTMLDivElement>(null);
  const drawnRef = useRef<HTMLDivElement>(null);

  /** The scale at which the whole chart lands inside the pane. Measured from
   *  what is on screen and divided back out by the zoom already applied, so it
   *  is right whatever the chart is currently sitting at. Never zooms past 1:1
   *  — a chart that already fits is not made bigger by asking to see all of it. */
  const fitToPane = useCallback(() => {
    const view = viewRef.current, drawn = drawnRef.current;
    if (!view || !drawn) return;
    const box = drawn.getBoundingClientRect();
    const w = box.width / zoom, h = box.height / zoom;
    if (!w || !h) return;
    setZoom(clampZoom(Math.min(view.clientWidth / w, view.clientHeight / h, 1)));
  }, [zoom]);

  if (!risks.length) {
    return (
      <div className="rounded-xl border border-dashed border-canvas-border py-14 text-center text-[0.78125rem] text-ink-500">
        Nothing is going in, so there is no process to draw. Tick a row back in on the Matrix.
      </div>
    );
  }

  return (
    <section aria-label="Process flowchart" className={compact ? 'h-full relative' : undefined}>
      {/* Beside the prompt the pane has its own heading and count, so all this
          row carries there is the zoom and the way out of Ira's grouping.
          There it floats over the top-right corner rather than taking a strip
          of its own (user ask, 27 Sep: "remove the bg of the buttons section
          from the flowchart window so that i can view the flowchart there as
          well") — the chart is drawn down the middle, so the corner it covers
          is the corner it was never using, and the pane is that much taller. */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${compact ? 'absolute top-0 right-0 z-10' : 'mb-4'}`}>
        {!compact && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-ink-500">
            <Pill tone="draft">SOP-derived · unconfirmed</Pill>
            <span>
              {spine.riskCount} {spine.riskCount === 1 ? 'risk' : 'risks'} · {spine.controlCount}{' '}
              {spine.controlCount === 1 ? 'control' : 'controls'}
            </span>
          </p>
        )}
        <div className="flex-1" />
        {/* One cluster, read left to right as smaller · where you are · bigger.
            The percentage is the way back to 1:1, so the reading and the reset
            are the same control rather than a fourth button. */}
        <div className="inline-flex items-center rounded-lg border border-canvas-border bg-canvas">
          <button type="button" onClick={() => setZoom(z => clampZoom(z - ZOOM_STEP))} disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out" title="Zoom out"
            className="h-8 w-8 inline-flex items-center justify-center rounded-l-lg text-ink-500 enabled:hover:text-ink-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            <Minus size={13} aria-hidden />
          </button>
          <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1}
            title="Back to full size" aria-label={`Zoom ${Math.round(zoom * 100)} per cent — back to full size`}
            className="h-8 w-[3.25rem] text-[0.71875rem] font-semibold text-ink-600 tabular-nums border-x border-canvas-border enabled:hover:text-ink-900 disabled:cursor-default cursor-pointer">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={() => setZoom(z => clampZoom(z + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in" title="Zoom in"
            className="h-8 w-8 inline-flex items-center justify-center rounded-r-lg text-ink-500 enabled:hover:text-ink-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            <Plus size={13} aria-hidden />
          </button>
        </div>
        {/* Only where there is a frame to fit into. On its own step the chart
            runs down the page, so "fit" would have nothing to measure against. */}
        {compact && (
          <button type="button" onClick={fitToPane} title="Scale the chart down until the whole process is in view"
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas text-[0.75rem] font-semibold text-ink-600 hover:border-ink-400 hover:text-ink-800 transition-colors cursor-pointer">
            Fit
          </button>
        )}
      </div>

      {/* A stage with several risks lays them side by side, so a wide process
          can outrun the dialog. It scrolls rather than squeezing the boxes. */}
      <div ref={viewRef} className={compact ? 'h-full overflow-auto' : 'overflow-x-auto'}>
        <div ref={drawnRef} style={{ zoom }} className="flex flex-col items-center py-2 min-w-max mx-auto">
          <RootNode source={source} process={process} entity={entity} />
          <Trunk />
          {/* Every risk on one rail. They arise out of the same document, not
              one after another, and a column each is what says so. Nothing
              wraps: a wrapped branch would sit under a risk it does not belong
              to. The pane scrolls, and Fit puts the whole tree in view. */}
          <div className="flex items-start justify-center">
            {risks.map((risk, i) => (
              <RiskBranch key={risk.key} risk={risk} i={i} n={risks.length} width={width} editable={editable}
                onRenameRisk={onRenameRisk} onRenameControl={onRenameControl} />
            ))}
          </div>
        </div>
      </div>

      {/* An SOP cannot say where the control actually sits, which is the one
          thing the design test turns on. So this counts for nothing until the
          walkthrough, and what the auditor changes afterwards is itself the
          evidence — the gap between the written process and the real one. */}
      {!compact && (
        <p className="mt-6 pt-3 border-t border-canvas-border text-[0.71875rem] leading-snug text-ink-500 max-w-[46rem]">
          Read from {source}, so it shows the process as written. It does not satisfy the flowchart document
          requirement and does not count towards control completeness until the auditor confirms or corrects it
          against the walkthrough.
        </p>
      )}

      {spine.omitted > 0 && (
        <p className="mt-6 pt-3 border-t border-canvas-border text-[0.71875rem] text-ink-500">
          {spine.omitted === 1 ? '1 draft row is' : `${spine.omitted} draft rows are`} left out of the import,
          so {spine.omitted === 1 ? 'it is' : 'they are'} not drawn here. The Matrix says which.
        </p>
      )}
    </section>
  );
}
