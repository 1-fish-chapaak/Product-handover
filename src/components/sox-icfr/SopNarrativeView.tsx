/**
 * The narrative view of an SOP draft — one of the three things an SOP upload
 * produces (narrative, flowchart, matrix), all read off the same rows.
 *
 * It is prose, so it is laid out as prose: one measured column, stages in the
 * order the SOP runs, and under each stage the risks with their controls
 * beneath them. No cards, no grid — a card per control would turn a document
 * back into the matrix sitting on the other tab.
 *
 * The sentences themselves are built in sopNarrative.ts. Nothing is written
 * here that the draft does not hold.
 */
import { useMemo, useState } from 'react';
import { ClipboardCheck, Copy, Pencil, Sparkles, Star, Undo2 } from 'lucide-react';
import { Pill } from '../shared/StatusBadge';
import { buildNarrative, narrativeText, type NarrativeOptions } from './sopNarrative';
import type { ImportRow } from './racmImport';

interface SopNarrativeViewProps extends NarrativeOptions {
  rows: ImportRow[];
  /** Rename a stage Ira grouped. The key is the name she gave it. */
  onRenameStage: (name: string, to: string) => void;
  /** Turn Ira's grouping off, or back on. `off` is what the button is doing. */
  onUngroup: (off: boolean) => void;
}

export default function SopNarrativeView({
  rows, process, entity, source, idFor, omitted, ungrouped, nameFor, onRenameStage, onUngroup,
}: SopNarrativeViewProps) {
  // Named dependencies rather than the options object: rest-spreading the props
  // would build a new object every render and the memo would never hold.
  const narrative = useMemo(
    () => buildNarrative(rows, { process, entity, source, idFor, omitted, ungrouped, nameFor }),
    [rows, process, entity, source, idFor, omitted, ungrouped, nameFor],
  );
  const [copied, setCopied] = useState(false);
  /** The stage whose name is being edited, by the key it is stored under. */
  const [editing, setEditing] = useState<string | null>(null);
  const grouped = narrative.stages.some(s => s.inferred);

  const copy = () => {
    navigator.clipboard?.writeText(narrativeText(narrative)).then(
      () => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); },
      () => undefined,
    );
  };

  if (!narrative.stages.length) {
    return (
      <div className="rounded-xl border border-dashed border-canvas-border py-14 text-center text-[0.78125rem] text-ink-500">
        Nothing is going in, so there is no process to describe. Tick a row back in on the Matrix.
      </div>
    );
  }

  return (
    <section aria-label="Process narrative">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
        <p className="text-[0.75rem] text-ink-500">
          {narrative.process}{narrative.entity ? ` · ${narrative.entity}` : ''} — as{' '}
          <span className="text-ink-700">{narrative.source}</span> describes it
        </p>
        <div className="flex-1" />
        {/* Ira's grouping is a proposal, so it has a way out. The SOP's own
            stages never get this button — they are not ours to switch off. */}
        {narrative.groupable && (
          <button type="button" onClick={() => onUngroup(grouped)}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas text-[0.75rem] font-semibold text-ink-600 hover:border-ink-400 hover:text-ink-800 transition-colors cursor-pointer"
            title={grouped ? 'Drop the stages Ira worked out and list the risks as they came'
              : 'Let Ira group the controls into stages by what each one does'}>
            {grouped ? <><Undo2 size={13} aria-hidden /> Ungroup</> : <><Sparkles size={13} className="text-brand-600" aria-hidden /> Group into stages</>}
          </button>
        )}
        <button type="button" onClick={copy}
          className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas text-[0.75rem] font-semibold text-ink-700 hover:border-ink-400 transition-colors cursor-pointer">
          {copied ? <ClipboardCheck size={13} className="text-compliant-600" aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? 'Copied' : 'Copy as text'}
        </button>
      </div>

      {/* Said once, at the top, rather than argued for at every heading: where
          these stages came from, and that they are ours rather than the SOP's. */}
      {grouped && (
        <p className="max-w-[46rem] mb-5 text-[0.75rem] leading-snug text-ink-500">
          {source} names no stages, so Ira grouped the controls by what each one does. Rename any of them,
          or drop the grouping altogether.
        </p>
      )}

      <div className="max-w-[46rem] space-y-8">
        {narrative.stages.map((stage, i) => (
          <article key={stage.name}>
            {/* No heading where the SOP named no stages: one sub-process across
                every row is the process itself, and a box for it would be
                structure the document never carried. The owner line still
                earns its place, so it stays. */}
            {narrative.staged ? (
              <header className="pb-2 border-b border-canvas-border">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-[0.6875rem] font-semibold tabular-nums text-ink-400">{String(i + 1).padStart(2, '0')}</span>
                  {editing === stage.name ? (
                    <input autoFocus defaultValue={stage.label} aria-label={`Rename the ${stage.label} stage`}
                      onBlur={e => { onRenameStage(stage.name, e.target.value.trim()); setEditing(null); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); }
                      }}
                      className="h-7 w-52 px-2 rounded-lg border border-brand-400 bg-canvas text-[0.9375rem] font-semibold text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                  ) : (
                    <h3 className="text-[0.9375rem] font-semibold text-ink-900">{stage.label}</h3>
                  )}
                  {/* What the SOP said, or what Ira worked out — never both, and
                      never neither. A reader has to be able to tell them apart. */}
                  {stage.inferred ? (
                    <>
                      <Pill tone="info">Grouped by Ira</Pill>
                      {editing !== stage.name && (
                        <button type="button" onClick={() => setEditing(stage.name)}
                          className="h-6 px-1.5 inline-flex items-center gap-1 rounded-md text-[0.6875rem] font-semibold text-ink-500 hover:text-ink-800 hover:bg-paper-50 transition-colors cursor-pointer"
                          aria-label={`Rename the ${stage.label} stage`}>
                          <Pencil size={11} aria-hidden /> Rename
                        </button>
                      )}
                    </>
                  ) : stage.sections.length > 0 && (
                    <span className="text-[0.6875rem] font-mono text-ink-400" title="Sections of the SOP these controls were read from">
                      {stage.sections.join(' · ')}
                    </span>
                  )}
                </div>
                {stage.opening && <p className="mt-1 text-[0.75rem] text-ink-500">{stage.opening}</p>}
              </header>
            ) : stage.opening && (
              <p className="text-[0.75rem] text-ink-500 pb-2 border-b border-canvas-border">{stage.opening}</p>
            )}

            <div className={narrative.staged || stage.opening ? 'mt-4 space-y-5' : 'space-y-5'}>
              {stage.risks.map(risk => (
                <div key={`${risk.riskId}|${risk.title}`} className="border-l border-canvas-border pl-4">
                  <p className="text-[0.8125rem] leading-snug">
                    {risk.riskId && <span className="font-mono text-[0.71875rem] text-ink-400 mr-1.5">{risk.riskId}</span>}
                    <span className="font-semibold text-ink-900">{risk.title}</span>
                  </p>
                  {/* The description, only when it says more than the heading did. */}
                  {risk.statement && risk.statement !== risk.title && (
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-600">{risk.statement}</p>
                  )}

                  <div className="mt-3 space-y-3.5">
                    {risk.controls.map(c => (
                      <div key={c.id}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-[0.71875rem] font-semibold text-ink-700">{c.id}</span>
                          <span className="text-[0.8125rem] font-medium text-ink-900">{c.title}</span>
                          {c.isKey && (
                            <span className="inline-flex items-center gap-1 text-[0.65625rem] font-semibold text-mitigated-700" title="Key control">
                              <Star size={11} className="fill-mitigated-200" aria-hidden /> Key
                            </span>
                          )}
                          {c.suggested
                            ? <Pill tone="info">Suggested by Ira</Pill>
                            : c.section && <Pill tone="evidence">{c.section}</Pill>}
                        </div>
                        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-700">{c.sentences.join(' ')}</p>
                        {c.evidence && (
                          <p className="mt-1 text-[0.71875rem] leading-snug text-ink-500">
                            <span className="text-ink-400">Evidence: </span>{c.evidence}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      {narrative.omitted > 0 && (
        <p className="max-w-[46rem] mt-8 pt-3 border-t border-canvas-border text-[0.71875rem] text-ink-500">
          {narrative.omitted === 1 ? '1 draft row is' : `${narrative.omitted} draft rows are`} left out of the import,
          so {narrative.omitted === 1 ? 'it is' : 'they are'} left out of this narrative too. The Matrix says which.
        </p>
      )}
    </section>
  );
}
