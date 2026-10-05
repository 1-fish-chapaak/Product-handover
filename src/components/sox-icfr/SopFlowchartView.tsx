/**
 * The flowchart of an SOP draft — the risks mapped onto the process, with the
 * controls standing against them.
 *
 * DRAWN AS A FISHBONE (29 Sep, user: "fishbone wala structure chahiye is
 * flowchart mein"). The spine runs left to right, from the document it was read
 * out of to the process itself; every risk is a rib off that spine, touching it
 * directly, and its controls hang beyond the risk (5 Oct — swapped from controls
 * nearest the spine):
 *
 *        Ctrl 1                    Ctrl 4
 *        Ctrl 2                       ╲
 *        Risk 1 ─╲                 Risk 3 ─╲
 *  P2P-SOP ══════╪═══════════════════════════╪═══▶  Procure to Pay
 *        Risk 2 ─╱                 Risk 4 ─╱
 *        Ctrl 3                       ╱
 *                                  Ctrl 5
 *
 * Why this shape and not the tree it used to be: a process HAPPENS in an order,
 * and a fishbone has a direction where a tree has only a depth. Reading left to
 * right you are walking the process; each rib is a place something can go wrong
 * and what is in place there. Risks alternate above and below the spine, which
 * is what keeps a wide process readable — twelve risks stacked in one row would
 * run off any dialog.
 *
 * Note this is the SHAPE only. It is not a cause-and-effect fishbone, which is
 * a root-cause tool and belongs after a retest has failed twice — see
 * `project_sop_three_artefacts`. Nothing here diagnoses anything.
 *
 * Each risk appears once, however many stages its controls fall across: a
 * diagram has one node per thing, and a risk drawn twice would read as two
 * risks. It reads `buildSpine` rather than grouping the rows itself, so the
 * chart and the Matrix can never be two different accounts of one draft.
 *
 * Two things are drawn in this file, from one `buildSpine` and one set of ribs:
 * the chart itself, and `SopFlowchartStructure` — its shape with the names taken
 * off, which is all the prompt step shows until the prompt has been validated.
 *
 * WHAT IT DRAWS IS A DRAFT (29 Sep). An SOP gives the order of steps, the roles,
 * the systems and the decision points. It does NOT give where the control
 * actually sits — before the entry is posted or after it, which is the single
 * question the design test exists to answer — nor the workarounds the process
 * has grown since the SOP was written, nor the override routes the SOP lists as
 * exceptions and people use routinely. So the chart says `SOP-derived,
 * unconfirmed` on its face, and the auditor confirms or corrects it after the
 * walkthrough. Until then it satisfies no document requirement.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
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
  /** Drawn beside the edit box rather than on its own: narrower boxes, and no
   *  header of its own — the step has one. Compact also means the chart is
   *  framed by a pane of a fixed height, which is what makes Fit mean something. */
  compact?: boolean;
  /** Preview draws the same chart with its names not offering to be typed
   *  over (user ask, 29 Sep: "there will be a preview and an edit option").
   *  Renaming belongs to Edit, beside the box that explains it. */
  editable?: boolean;
}

/** Zoom stops. A fishbone runs wide long before it runs tall, so the floor is
 *  low enough to get a twenty-control chart into one pane (user ask, 27 Sep:
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

// ── the bones ─────────────────────────────────────────────────────────────────

/** How far each box leans along its rib, in pixels per step out from the spine.
 *  It has to match `RIB_DEG` or the boxes drift off the bone they hang on:
 *  a box one step further out sits one box-height higher, so it sits
 *  `height × tan(deg)` further back. */
const LEAN = 18;
const RIB_DEG = 22;

/** The rib itself: the bone a risk and its controls hang on, leaning the way
 *  the process flows so a branch above the spine and one below both point
 *  downstream rather than at each other. */
const Rib = ({ side }: { side: 'top' | 'bottom' }) => (
  <span className="block h-9 w-0.5 bg-ink-300 shrink-0 rounded-full"
    // `skewX` pushes the LOWER end of a line rightwards for a positive angle,
    // and the boxes lean the other way as they descend — so a top rib is
    // positive (its foot, at the spine, is the rightmost point) and a bottom
    // rib negative. Signed the other way round they crossed their own stack.
    style={{ transform: `skewX(${side === 'top' ? RIB_DEG : -RIB_DEG}deg)` }} aria-hidden />
);

/** Where the spine starts: the document everything on it was read out of. */
const SourceNode = ({ source }: { source: string }) => (
  <div className="w-52 shrink-0 rounded-xl border border-ink-300 bg-canvas-elevated px-3.5 py-2.5">
    <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-900 leading-snug">
      <FileText size={13} className="text-ink-400 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">{source}</span>
    </p>
  </div>
);

/** Where it ends: the process the whole diagram is about. A fishbone points at
 *  its subject, and here the subject is the process, not a failure. */
const ProcessNode = ({ process, entity }: { process: string; entity: string }) => (
  <div className="w-44 shrink-0 rounded-xl border border-ink-400 bg-ink-900 px-3.5 py-2.5">
    <p className="text-[0.8125rem] font-semibold text-white leading-snug break-words">{process}</p>
    {entity && <p className="mt-0.5 text-[0.6875rem] text-paper-200 break-words">{entity}</p>}
  </div>
);

/** The spine's own arrowhead, so the direction is stated rather than implied. */
const Arrow = () => (
  <span className="w-0 h-0 shrink-0 border-y-[5px] border-y-transparent border-l-[9px] border-l-ink-300" aria-hidden />
);

/**
 * ONE BRANCH — a risk, what stands against it, and the rib carrying them to the
 * spine.
 *
 * The risk sits on the rib right against the spine, and its controls stack
 * outward from it — above the risk on a top branch, below it on a bottom one
 * (user ask, 5 Oct: risks connect to the fishbone directly, controls beyond).
 * The caller passes the nodes nearest-the-spine LAST for a top branch and FIRST
 * for a bottom one.
 */
function Branch({ side, children }: { side: 'top' | 'bottom'; children: ReactNode[] }) {
  const n = children.length;
  // Each box a step further from the spine sits a step further BACK, so the
  // stack leans along the rib instead of hanging square off it. Without this
  // they read as a column that happens to have a line under it.
  const lean = (i: number) => (side === 'top' ? i : n - 1 - i) * LEAN;
  const boxes = children.map((c, i) => (
    <div key={i} style={{ transform: `translateX(${lean(i)}px)` }}>{c}</div>
  ));
  const rib = <div key="rib" style={{ transform: `translateX(${n * LEAN}px)` }}><Rib side={side} /></div>;
  return (
    <div className="flex flex-col items-center gap-1.5 px-3" style={{ paddingRight: n * LEAN }}>
      {side === 'top' ? <>{boxes}{rib}</> : <>{rib}{boxes}</>}
    </div>
  );
}

/**
 * THE DIAGRAM.
 *
 * A three-row grid — branches above, the spine, branches below — with each risk
 * given a column and put on the row its index says. `1fr auto 1fr` makes the
 * two branch rows equal, which is what puts the spine down the middle and lets
 * the source and process boxes beside it line up with it.
 */
function Fishbone({ n, source, process, entity, branch }: {
  n: number; source: string; process: string; entity: string;
  branch: (i: number, side: 'top' | 'bottom') => ReactNode;
}) {
  // The source and the process sit IN the grid, on the spine's own row, rather
  // than in a flex row beside it. Centring them against the grid only lines
  // them up when the branches above and below are the same height, which they
  // never are — the spine drifted halfway down the diagram.
  const cols = `max-content repeat(${n}, max-content) max-content`;
  return (
    <div className="grid min-w-max py-2"
      // The spine's row is the LINE and nothing else. The source and process
      // boxes are centred on it and allowed to overflow, so the branch rows
      // touch the bone directly — sized to the boxes instead, the row opened a
      // gap between the last control and the spine its rib was pointing at.
      style={{ gridTemplateColumns: cols, gridTemplateRows: n < 2 ? 'auto 2px 0' : '1fr 2px 1fr' }}>
      <div style={{ gridColumn: 1, gridRow: 2 }} className="self-center">
        <SourceNode source={source} />
      </div>

      {Array.from({ length: n }, (_, i) => {
        const side = i % 2 === 0 ? 'top' : 'bottom';
        return (
          <div key={i} style={{ gridColumn: i + 2, gridRow: side === 'top' ? 1 : 3 }}
            className={`flex ${side === 'top' ? 'items-end' : 'items-start'}`}>
            {branch(i, side)}
          </div>
        );
      })}

      {/* Drawn across every branch column at once rather than per branch, so it
          is one bone and not a row of touching dashes. */}
      <div style={{ gridColumn: `2 / ${n + 2}`, gridRow: 2 }} className="flex items-center min-w-12">
        <span className="h-0.5 flex-1 bg-ink-300" aria-hidden />
        <Arrow />
      </div>

      <div style={{ gridColumn: n + 2, gridRow: 2 }} className="self-center">
        <ProcessNode process={process} entity={entity} />
      </div>
    </div>
  );
}

// ── the named chart ───────────────────────────────────────────────────────────

function RiskNode({ risk, width, onRename, editable }: {
  risk: SpineRisk; width: string; onRename: (key: string, to: string) => void; editable: boolean;
}) {
  return (
    <div className={`${width} rounded-xl border border-risk-300 bg-risk-50 px-3.5 py-2.5`}>
      <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-risk-700">
        <AlertTriangle size={11} aria-hidden /> Risk{risk.riskId ? ` · ${risk.riskId}` : ''}
      </p>
      <div className="mt-1">
        <EditableName value={risk.title} label={`Rename the risk ${risk.title}`} editable={editable}
          onSave={to => onRename(risk.key, to)}
          className="text-[0.8125rem] font-medium leading-snug text-ink-900" />
      </div>
    </div>
  );
}

function ControlNode({ c, width, onRename, editable }: {
  c: SpineControl; width: string; onRename: (sourceId: string, to: string, was: string) => void; editable: boolean;
}) {
  return (
    <div className={`${width} rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2`}>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.6875rem] font-semibold text-brand-700">
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
          className="text-[0.8125rem] leading-snug text-ink-900" />
      </div>
      {c.suggested
        ? <p className="mt-1 text-[0.6875rem] text-ink-500">Not in the SOP — suggested by Ira</p>
        : c.section && <p className="mt-1 text-[0.6875rem] font-mono text-ink-400">{c.section}</p>}
    </div>
  );
}

// ── the structure, for the prompt step ────────────────────────────────────────

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
 * Same bones, numbered rather than named — Risk 1, Control 1 — with the SOP's
 * own file name at the head. Blank boxes were ruled out ("box mein blank nahi
 * rakhna hai"): a grey rectangle says nothing about what it stands for, and a
 * reader cannot tell a risk from a control by shape alone.
 *
 * What is being read here is the COUNT and the SPREAD, which is exactly what a
 * prompt changes: does this wording find four risks or one, do the controls
 * spread across them, and is any risk left standing on its own. The names are
 * the chart, and the chart is what validating the prompt earns.
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

  const box = 'w-30 rounded-lg px-2.5 py-1.5 text-center';
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
      <Fishbone n={risks.length} source={source} process={process} entity={entity}
        branch={(i, side) => {
          const risk = risks[i]!;
          const nodes = [
            <div key="r" className={`${box} border border-risk-300 bg-risk-50`}>
              <p className={`${boxLabel} text-risk-700`}><AlertTriangle size={11} aria-hidden /> Risk {i + 1}</p>
            </div>,
            ...(risk.controls.length === 0
              /* The one thing worth reading off a shape with no names on it. */
              ? [<div key="none" className={`${box} border border-dashed border-risk-300`}>
                <p className={`${boxLabel} text-risk-700`}>No control</p>
              </div>]
              : risk.controls.map((c, j) => (
                <div key={c.id} className={`${box} border border-brand-200 bg-brand-50`}>
                  <p className={`${boxLabel} text-brand-700`}>
                    <ShieldCheck size={11} aria-hidden /> Control {firstControlNo[i]! + j + 1}
                  </p>
                </div>
              ))),
          ];
          return <Branch side={side}>{side === 'top' ? [...nodes].reverse() : nodes}</Branch>;
        }} />
    </section>
  );
}

// ── the chart ─────────────────────────────────────────────────────────────────

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
  const width = compact ? 'w-48' : 'w-56';

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
    // A hair under, because the frame this sits in has padding of its own and
    // `clientHeight` counts it: fitted exactly, the spine came to rest a few
    // pixels under the bottom edge — the one line the diagram hangs on, cut off
    // by the button that was supposed to bring it into view.
    setZoom(clampZoom(Math.min(view.clientWidth / w, view.clientHeight / h, 1) * 0.94));
  }, [zoom]);

  if (!risks.length) {
    return (
      <div className="rounded-xl border border-dashed border-canvas-border py-14 text-center text-[0.8125rem] text-ink-500">
        Nothing is going in, so there is no process to draw. Tick a row back in on the Matrix.
      </div>
    );
  }

  return (
    <section aria-label="Process flowchart" className={compact ? 'h-full relative' : undefined}>
      {/* Beside the edit box the pane has its own heading and count, so all this
          row carries there is the zoom. It floats over the top-right corner
          rather than taking a strip of its own (user ask, 27 Sep: "remove the bg
          of the buttons section from the flowchart window so that i can view the
          flowchart there as well"). */}
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
            className="h-8 w-13 text-[0.75rem] font-semibold text-ink-600 tabular-nums border-x border-canvas-border enabled:hover:text-ink-900 disabled:cursor-default cursor-pointer">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={() => setZoom(z => clampZoom(z + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in" title="Zoom in"
            className="h-8 w-8 inline-flex items-center justify-center rounded-r-lg text-ink-500 enabled:hover:text-ink-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            <Plus size={13} aria-hidden />
          </button>
        </div>
        {/* Only where there is a frame to fit into. On its own step the chart
            runs across the page, so "fit" would have nothing to measure against. */}
        {compact && (
          <button type="button" onClick={fitToPane} title="Scale the chart down until the whole process is in view"
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas text-[0.75rem] font-semibold text-ink-600 hover:border-ink-400 hover:text-ink-800 transition-colors cursor-pointer">
            Fit
          </button>
        )}
      </div>

      {/* A fishbone grows sideways, so a long process outruns the dialog. It
          scrolls rather than squeezing the boxes, and Fit puts it all in view. */}
      <div ref={viewRef} className={compact ? 'h-full overflow-auto' : 'overflow-x-auto'}>
        <div ref={drawnRef} style={{ zoom }} className="min-w-max">
          <Fishbone n={risks.length} source={source} process={process} entity={entity}
            branch={(i, side) => {
              const risk = risks[i]!;
              const nodes = [
                <RiskNode key="r" risk={risk} width={width} onRename={onRenameRisk} editable={editable} />,
                ...(risk.controls.length === 0
                  /* The one thing this chart exists to make impossible to miss. */
                  ? [<div key="none" className={`${width} rounded-xl border border-dashed border-risk-300 px-3.5 py-2 text-center text-[0.75rem] font-semibold text-risk-700`}>
                    No control against this risk
                  </div>]
                  : risk.controls.map(c => (
                    <ControlNode key={c.id} c={c} width={width} onRename={onRenameControl} editable={editable} />
                  ))),
              ];
              return <Branch side={side}>{side === 'top' ? [...nodes].reverse() : nodes}</Branch>;
            }} />
        </div>
      </div>

      {/* An SOP cannot say where the control actually sits, which is the one
          thing the design test turns on. So this counts for nothing until the
          walkthrough, and what the auditor changes afterwards is itself the
          evidence — the gap between the written process and the real one. */}
      {!compact && (
        <p className="mt-6 pt-3 border-t border-canvas-border text-[0.75rem] leading-snug text-ink-500 max-w-184">
          Read from {source}, so it shows the process as written. It does not satisfy the flowchart document
          requirement and does not count towards control completeness until the auditor confirms or corrects it
          against the walkthrough.
        </p>
      )}

      {spine.omitted > 0 && (
        <p className="mt-6 pt-3 border-t border-canvas-border text-[0.75rem] text-ink-500">
          {spine.omitted === 1 ? '1 draft row is' : `${spine.omitted} draft rows are`} left out of the import,
          so {spine.omitted === 1 ? 'it is' : 'they are'} not drawn here. The Matrix says which.
        </p>
      )}
    </section>
  );
}
