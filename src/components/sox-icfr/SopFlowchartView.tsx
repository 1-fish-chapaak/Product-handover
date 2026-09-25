/**
 * The flowchart view of an SOP draft — the third of the three things an SOP
 * upload produces, and the one the user named the aim of: "you will map out the
 * risks on the flowchart, and then your corresponding controls."
 *
 * So that is what it draws, top to bottom:
 *
 *      stage  →  the risks that arise there  →  the controls against each risk
 *
 * It reads `buildNarrative` — the very structure the Narrative prints — rather
 * than grouping the rows again. Two readings of one draft that did their own
 * grouping would eventually disagree, and a flowchart that disagreed with the
 * narrative beside it would be worse than having neither.
 *
 * Drawn with stacked boxes and chevrons rather than measured SVG edges: the
 * shape is a tree that only ever flows one way, so there is nothing a bezier
 * would buy that a border and an arrow do not. It matches the process flow the
 * audit module already draws (`audit/SopProcessFlow`).
 */
import { Fragment, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ShieldCheck, Sparkles, Star, Undo2 } from 'lucide-react';
import { Pill } from '../shared/StatusBadge';
import { buildNarrative, type NarrativeControl, type NarrativeRisk, type NarrativeOptions } from './sopNarrative';
import type { ImportRow } from './racmImport';

interface SopFlowchartViewProps extends NarrativeOptions {
  rows: ImportRow[];
  onUngroup: (off: boolean) => void;
  /** Rename a risk, keyed by `NarrativeRisk.key`. The user's ask (25 Sep):
   *  "agar user ko koi risk name change karna ho to wo kar sakta hai, instead
   *  of writing in prompt." */
  onRenameRisk: (key: string, to: string) => void;
  /** The same for a control, keyed by `NarrativeControl.sourceId`. `was` is the
   *  name on screen before the edit — kept so the first rename can record the
   *  title the stage grouping was worked out from. */
  onRenameControl: (sourceId: string, to: string, was: string) => void;
  /** Drawn beside the prompt rather than on its own step: narrower boxes, and
   *  no header of its own — the prompt step has one. */
  compact?: boolean;
}

/**
 * A name on the chart that can be typed over.
 *
 * Rendered as a button so it is reachable by keyboard and announces itself as
 * something to press; it swaps for an input in place, so the box never moves
 * and the reader never loses where they were. A blank or unchanged value is
 * dropped rather than saved — an edit nobody made is not an edit.
 */
function EditableName({ value, onSave, label, className }: {
  value: string; onSave: (to: string) => void; label: string; className: string;
}) {
  const [editing, setEditing] = useState(false);
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

/** The line and arrow between one box and the next. */
function Connector({ tall }: { tall?: boolean }) {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <span className={tall ? 'h-5 w-px bg-canvas-border' : 'h-3 w-px bg-canvas-border'} />
      <ChevronDown size={12} className="text-ink-400 -mt-1.5" />
    </div>
  );
}

/** A stage of the process. Structural, so it carries no semantic colour — the
 *  only things on this chart that mean something are the risk and the control. */
function StageNode({ n, label, inferred, sections, width }: {
  n: number; label: string; inferred: boolean; sections: string[]; width: string;
}) {
  return (
    <div className={`${width} rounded-xl border border-ink-300 bg-canvas-elevated px-3.5 py-2.5 text-center`}>
      <p className="text-[0.8125rem] font-semibold text-ink-900 leading-snug">
        <span className="text-ink-400 tabular-nums mr-1.5">{String(n).padStart(2, '0')}</span>{label}
      </p>
      {inferred
        ? <span className="mt-1 inline-block"><Pill tone="info">Grouped by Ira</Pill></span>
        : sections.length > 0 && <p className="mt-0.5 text-[0.65625rem] font-mono text-ink-400">{sections.join(' · ')}</p>}
    </div>
  );
}

function RiskNode({ risk, width, onRename }: { risk: NarrativeRisk; width: string; onRename: (key: string, to: string) => void }) {
  return (
    <div className={`${width} rounded-xl border border-risk-300 bg-risk-50 px-3.5 py-2.5`}>
      <p className="flex items-center gap-1.5 text-[0.65625rem] font-semibold uppercase tracking-wide text-risk-700">
        <AlertTriangle size={11} aria-hidden /> Risk{risk.riskId ? ` · ${risk.riskId}` : ''}
      </p>
      <div className="mt-1">
        <EditableName value={risk.title} label={`Rename the risk ${risk.title}`}
          onSave={to => onRename(risk.key, to)}
          className="text-[0.78125rem] font-medium leading-snug text-ink-900" />
      </div>
    </div>
  );
}

function ControlNode({ c, width, onRename }: {
  c: NarrativeControl; width: string; onRename: (sourceId: string, to: string, was: string) => void;
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
        <EditableName value={c.title} label={`Rename the control ${c.title}`}
          onSave={to => onRename(c.sourceId, to, c.title)}
          className="text-[0.78125rem] leading-snug text-ink-900" />
      </div>
      {c.suggested
        ? <p className="mt-1 text-[0.65625rem] text-ink-500">Not in the SOP — suggested by Ira</p>
        : c.section && <p className="mt-1 text-[0.65625rem] font-mono text-ink-400">{c.section}</p>}
    </div>
  );
}

/** A risk and everything standing against it — one column of the chart. */
function RiskBranch({ risk, width, onRenameRisk, onRenameControl }: {
  risk: NarrativeRisk; width: string;
  onRenameRisk: (key: string, to: string) => void;
  onRenameControl: (sourceId: string, to: string, was: string) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <RiskNode risk={risk} width={width} onRename={onRenameRisk} />
      {risk.controls.length === 0 ? (
        <>
          <Connector />
          {/* The one thing this chart exists to make impossible to miss. */}
          <div className={`${width} rounded-xl border border-dashed border-risk-300 px-3.5 py-2.5 text-center text-[0.75rem] font-semibold text-risk-700`}>
            No control against this risk
          </div>
        </>
      ) : risk.controls.map(c => (
        <Fragment key={c.id}>
          <Connector />
          <ControlNode c={c} width={width} onRename={onRenameControl} />
        </Fragment>
      ))}
    </div>
  );
}

export default function SopFlowchartView({
  rows, process, entity, source, idFor, omitted, ungrouped, nameFor,
  onUngroup, onRenameRisk, onRenameControl, compact = false,
}: SopFlowchartViewProps) {
  const narrative = useMemo(
    () => buildNarrative(rows, { process, entity, source, idFor, omitted, ungrouped, nameFor }),
    [rows, process, entity, source, idFor, omitted, ungrouped, nameFor],
  );
  const grouped = narrative.stages.some(s => s.inferred);
  const width = compact ? 'w-[13rem]' : 'w-[15rem]';

  if (!narrative.stages.length) {
    return (
      <div className="rounded-xl border border-dashed border-canvas-border py-14 text-center text-[0.78125rem] text-ink-500">
        Nothing is going in, so there is no process to draw. Tick a row back in on the Matrix.
      </div>
    );
  }

  return (
    <section aria-label="Process flowchart">
      {/* Beside the prompt the pane has its own heading and count, so all this
          row carries there is the way out of Ira's grouping. */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${compact ? 'mb-2 empty:mb-0' : 'mb-4'}`}>
        {!compact && (
          <p className="text-[0.75rem] text-ink-500">
            {narrative.staged ? `${narrative.stages.length} stages · ` : ''}
            {narrative.riskCount} {narrative.riskCount === 1 ? 'risk' : 'risks'} · {narrative.controlCount}{' '}
            {narrative.controlCount === 1 ? 'control' : 'controls'}
          </p>
        )}
        <div className="flex-1" />
        {narrative.groupable && (
          <button type="button" onClick={() => onUngroup(grouped)}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas text-[0.75rem] font-semibold text-ink-600 hover:border-ink-400 hover:text-ink-800 transition-colors cursor-pointer"
            title={grouped ? 'Drop the stages Ira worked out' : 'Let Ira group the controls into stages by what each one does'}>
            {grouped ? <><Undo2 size={13} aria-hidden /> Ungroup</> : <><Sparkles size={13} className="text-brand-600" aria-hidden /> Group into stages</>}
          </button>
        )}
      </div>

      {grouped && !compact && (
        <p className="max-w-[46rem] mb-4 text-[0.75rem] leading-snug text-ink-500">
          {source} names no stages, so Ira grouped the controls by what each one does. Rename them on the Narrative,
          or drop the grouping here.
        </p>
      )}

      {/* A stage with several risks lays them side by side, so a wide process
          can outrun the dialog. It scrolls rather than squeezing the boxes. */}
      <div className="overflow-x-auto">
        <div className="flex flex-col items-center gap-2 py-2 min-w-max mx-auto">
          {narrative.stages.map((stage, i) => (
            <Fragment key={stage.name}>
              {i > 0 && <Connector tall />}
              {narrative.staged && (
                <>
                  <StageNode n={i + 1} label={stage.label} inferred={stage.inferred} sections={stage.sections} width={width} />
                  <Connector />
                </>
              )}
              {/* Risks of one stage sit beside each other: they arise together,
                  not one after the other, and a column each says so. */}
              <div className="flex flex-wrap justify-center items-start gap-x-6 gap-y-4">
                {stage.risks.map(risk => (
                  <RiskBranch key={risk.key} risk={risk} width={width}
                    onRenameRisk={onRenameRisk} onRenameControl={onRenameControl} />
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      {narrative.omitted > 0 && (
        <p className="mt-6 pt-3 border-t border-canvas-border text-[0.71875rem] text-ink-500">
          {narrative.omitted === 1 ? '1 draft row is' : `${narrative.omitted} draft rows are`} left out of the import,
          so {narrative.omitted === 1 ? 'it is' : 'they are'} not drawn here. The Matrix says which.
        </p>
      )}
    </section>
  );
}
