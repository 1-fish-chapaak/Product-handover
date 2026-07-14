// Shared "AI proposes, the human curates" review canvas (Template Studio §4).
// The uploaded document on the left, the AI-detected sections on the right with an
// evidence-grounded signal, inline rename / delete-with-undo / merge / drag-reorder
// / add, and two-way jump-to-source.
//
// Reached from the editor's "Import from a report" step: the author curates what
// the detector proposed before it lands in the outline.

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import {
  Plus, CornerDownRight,
  GripVertical, ArrowUpToLine, ArrowDownToLine, Pencil,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { RowDeleteButton } from './RowDeleteButton';
import { ReportBrandBanner } from './ReportDocumentChrome';
import { sectionBlurb } from './reportShared';
import {
  EVIDENCE_META,
  type CanvasSection,
} from './sectionReviewShared';

// A labelled sample for a detected KPI / chart / table block. A report's charts
// and stat figures are images in the PDF, so their real values can't be pulled —
// instead we show WHERE each renders in the finished report, as a clear sample.
function PlaceholderSample({ kind, metric }: { kind: 'kpi' | 'chart' | 'table'; metric?: string }) {
  if (kind === 'kpi') {
    return (
      <div className="flex items-center gap-3 rounded-[8px] border border-dashed border-canvas-border bg-canvas/40 px-3 py-2">
        <div className="shrink-0">
          <div className="text-[1.25rem] font-bold text-ink-300 leading-none tabular-nums">—</div>
          <div className="text-[0.5625rem] font-semibold uppercase tracking-wider text-ink-400 mt-1">{metric || 'Metric'}</div>
        </div>
        <p className="text-[0.625rem] text-ink-400 leading-relaxed">KPI — a metric renders here in the report (filled at generation).</p>
      </div>
    );
  }
  if (kind === 'chart') {
    return (
      <div className="rounded-[8px] border border-dashed border-canvas-border bg-canvas/40 px-3 py-2">
        <div className="flex items-end gap-1 h-8">
          {[40, 66, 32, 80, 52, 70].map((h, k) => <div key={k} className="flex-1 rounded-t-[2px] bg-canvas-border" style={{ height: `${h}%` }} />)}
        </div>
        <p className="text-[0.625rem] text-ink-400 mt-1.5">Chart — {metric ? `“${metric}” ` : ''}a graph renders here in the report.</p>
      </div>
    );
  }
  return (
    <div className="rounded-[8px] border border-dashed border-canvas-border bg-canvas/40 px-3 py-2">
      <div className="rounded-[4px] overflow-hidden border border-canvas-border">
        <div className="grid grid-cols-4 bg-canvas">
          {Array.from({ length: 4 }).map((_, c) => <div key={c} className="h-3 border-r last:border-r-0 border-canvas-border" />)}
        </div>
        {Array.from({ length: 2 }).map((_, r) => (
          <div key={r} className="grid grid-cols-4 border-t border-canvas-border">
            {Array.from({ length: 4 }).map((_, c) => <div key={c} className="h-3 border-r last:border-r-0 border-canvas-border" />)}
          </div>
        ))}
      </div>
      <p className="text-[0.625rem] text-ink-400 mt-1.5">Table — {metric ? `“${metric}” ` : ''}a table renders here in the report.</p>
    </div>
  );
}

// One draggable detected-section row. Owns its own drag controls so the handle
// (not the text input) starts the drag.
function SectionRow({ section, index, total, flashed, registerRef, onRename, onDescribe, onDelete, onJump, onMerge }: {
  section: CanvasSection;
  index: number;
  total: number;
  flashed: boolean;
  registerRef: (el: HTMLElement | null) => void;
  onRename: (name: string) => void;
  onDescribe: (description: string) => void;
  onDelete: () => void;
  onJump: () => void;
  onMerge: (direction: 'up' | 'down') => void;
}) {
  const controls = useDragControls();
  const meta = EVIDENCE_META[section.evidence];
  const empty = !section.name.trim();
  const isDetected = section.source !== undefined;
  // A kpi/chart/table placeholder — its type chip is the status, so the
  // "explicit heading" evidence label (meant for text sections) is suppressed.
  const isPlaceholder = !!section.kind && section.kind !== 'text';
  const isFragment = section.evidence === 'fragment';
  const canMerge = isFragment && (index > 0 || index < total - 1);
  // Flat list rows — no per-row border. The chosen background is the only fill,
  // and it stays quiet unless the row actually needs attention.
  const bg = flashed
    ? 'bg-brand-600/[0.07]'
    : empty
      ? 'bg-high-50/50'
      : meta.flag
        ? 'bg-mitigated-50/40'
        : 'hover:bg-canvas';
  // Brand-purple index to match the report letterhead — the outline reads as the
  // report's own numbered sections, not an evidence-coloured status list. A missing
  // name still flags amber (a validation state); the row tint carries any review flag.
  const numTint = empty ? 'bg-high-50 text-high-700' : '';
  return (
    <Reorder.Item
      value={section}
      dragListener={false}
      dragControls={controls}
      ref={registerRef}
      whileDrag={{ scale: 1.015, boxShadow: '0 12px 28px -12px rgba(15,8,30,0.28)' }}
      className={`group relative rounded-[10px] px-2.5 py-2 transition-colors ${bg} ${flashed ? 'ring-1 ring-brand-600/25' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <button
          onPointerDown={e => controls.start(e)}
          aria-label="Drag to reorder"
          className="-ml-1.5 touch-none cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-500 transition-all shrink-0 opacity-0 group-hover:opacity-100"
        >
          <GripVertical size={14} />
        </button>
        {/* Brand-purple numbered index — the report's own outline mark. Two-digit
            like the editor preview (01, 02…) so the badge reads the same across
            the import → review → outline flow. */}
        <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[0.6875rem] font-bold tabular-nums ${numTint}`} style={empty ? undefined : { color: 'var(--rep-accent, #550fa5)', backgroundColor: 'color-mix(in srgb, var(--rep-accent, #6a12cd) 12%, transparent)' }}>{String(index + 1).padStart(2, '0')}</span>
        <input
          value={section.name}
          onChange={e => onRename(e.target.value)}
          placeholder="Name this section"
          title="Click to rename this section"
          className="flex-1 min-w-0 -ml-1 rounded-[6px] border border-transparent bg-transparent px-1.5 py-0.5 text-[0.8125rem] font-semibold text-ink-900 transition-colors cursor-text hover:border-canvas-border hover:bg-white focus:outline-none focus:border-brand-600/40 focus:bg-white focus:ring-2 focus:ring-brand-600/10 placeholder:font-medium placeholder:text-high-400"
        />
        {/* Pencil hint — makes it obvious the name is editable after upload. */}
        <Pencil size={12} className="shrink-0 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
        {/* Jump to the source — a hover action on the row, not a persistent second
            line, so the list stays a compact one-row-per-section scan. */}
        {isDetected && (
          <button
            onClick={onJump}
            title="Show in document"
            aria-label="Show in document"
            className="shrink-0 p-1 rounded-[6px] text-ink-300 hover:text-brand-600 hover:bg-brand-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          >
            <CornerDownRight size={12} />
          </button>
        )}
        {/* Placeholder blocks (chart/KPI/table detected in the document) wear a
            type chip — an empty block, no numbers, filled at generation. Text
            sections carry no evidence label; the row tint + index-chip colour
            already flag any row that needs a look. */}
        {isPlaceholder && (
          <span className="shrink-0 inline-flex items-center rounded-full bg-evidence-50 text-evidence-700 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide">
            {section.kind === 'kpi' ? 'KPI' : section.kind === 'table' ? 'Table' : 'Chart'}
          </span>
        )}
        <RowDeleteButton
          onConfirm={onDelete}
          ariaLabel="Remove section"
          triggerClassName="p-1 rounded-[6px] text-ink-300 hover:text-high-700 hover:bg-high-50 transition-all cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        />
      </div>
      {/* One-line description — editable. Seeded from the auto blurb; the author can
          overwrite it. Text sections only; placeholder blocks carry their own sample. */}
      {!isPlaceholder && !empty && (
        <div className="mt-0.5 pl-[2.25rem] pr-1">
          <input
            value={section.description ?? sectionBlurb(section.name)}
            onChange={e => onDescribe(e.target.value)}
            placeholder="Add a one-line description…"
            title="Click to edit this section's description"
            className="w-full -ml-1 rounded-[6px] border border-transparent bg-transparent px-1.5 py-0.5 text-[0.75rem] text-ink-400 leading-relaxed transition-colors cursor-text hover:border-canvas-border hover:bg-white focus:outline-none focus:border-brand-600/40 focus:bg-white focus:ring-2 focus:ring-brand-600/10 placeholder:text-ink-300"
          />
        </div>
      )}
      {/* KPI / chart / table blocks — a labelled sample of what renders here, since
          the document's real figures can't be extracted from the PDF. */}
      {isPlaceholder && (
        <div className="mt-2 pl-[2.25rem] pr-1">
          <PlaceholderSample kind={section.kind as 'kpi' | 'chart' | 'table'} metric={section.metric} />
        </div>
      )}
      {(canMerge || empty) && (
        <div className="flex items-center gap-2 mt-1 pl-[2.25rem]">
          {/* A fragment is usually one section split in two — let the user fold it
              into the neighbour, the fix the red badge otherwise lacks (§4.7.1). */}
          {canMerge && (
            <span className="inline-flex items-center gap-1">
              {index > 0 && (
                <button onClick={() => onMerge('up')} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-brand-50 text-[0.625rem] font-semibold text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer">
                  <ArrowUpToLine size={10} /> Merge up
                </button>
              )}
              {index < total - 1 && (
                <button onClick={() => onMerge('down')} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-brand-50 text-[0.625rem] font-semibold text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer">
                  <ArrowDownToLine size={10} /> Merge down
                </button>
              )}
            </span>
          )}
          {empty && <span className="text-[0.625rem] text-high-700 font-medium">Name required</span>}
        </div>
      )}
    </Reorder.Item>
  );
}

/**
 * The two-panel curation body. Owns the review interactions (rename / delete-with-
 * undo / merge / add / reorder / jump); the parent owns the `sections` state.
 */
export default function SectionReviewCanvas({
  sections,
  onSectionsChange,
  reportChrome,
}: {
  sections: CanvasSection[];
  onSectionsChange: (next: CanvasSection[] | ((prev: CanvasSection[]) => CanvasSection[])) => void;
  /** When provided, the curated outline renders inside the report's own chrome —
   *  the same purple letterhead + white sheet + footer the editor preview uses —
   *  so the right column reads as "the report being assembled", not a bare list. */
  reportChrome?: {
    title: string;
    desc?: string;
    brand: string;
    headerText?: string;
    footerText?: string;
    gradient?: [string, string];
    accent?: string;
  };
}) {
  const { addToast } = useToast();
  const sourceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);
  const [rightFlashId, setRightFlashId] = useState<string | null>(null);

  const set = (updater: CanvasSection[] | ((prev: CanvasSection[]) => CanvasSection[])) => onSectionsChange(updater);

  // Sections that carry a source preview — the left "document" column.
  const detected = useMemo(() => sections.filter(s => s.source !== undefined), [sections]);

  const jumpToSource = (id: string) => {
    const el = sourceRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(id);
    setTimeout(() => setFlashId(curr => (curr === id ? null : curr)), 1200);
  };
  const jumpToSection = (id: string) => {
    const el = rightRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setRightFlashId(id);
    setTimeout(() => setRightFlashId(curr => (curr === id ? null : curr)), 1200);
  };

  const renameSection = (id: string, name: string) =>
    set(prev => prev.map(s => (s.id === id ? { ...s, name } : s)));
  const describeSection = (id: string, description: string) =>
    set(prev => prev.map(s => (s.id === id ? { ...s, description } : s)));
  // Delete is reversible — a misclick shouldn't silently drop a section.
  const deleteSection = (id: string) => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const removed = sections[idx];
    set(prev => prev.filter(s => s.id !== id));
    addToast({
      type: 'info',
      // Persistent — the Undo stays until acted on or dismissed (#4).
      persist: true,
      message: `Removed “${removed.name || 'Untitled section'}”.`,
      secondaryAction: { label: 'Undo', onClick: () => set(prev => {
        if (prev.some(s => s.id === removed.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(idx, next.length), 0, removed);
        return next;
      }) },
    });
  };
  // Fragment → merge (§4.7.1): fold a detected fragment into its neighbour.
  const mergeSection = (id: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const fragment = sections[idx];
    const target = sections[targetIdx];
    set(prev => prev.filter(s => s.id !== id));
    addToast({
      type: 'info',
      persist: true,
      message: `Merged “${fragment.name || 'fragment'}” into “${target.name || 'the section ' + direction}”.`,
      secondaryAction: { label: 'Undo', onClick: () => set(prev => {
        if (prev.some(s => s.id === fragment.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(idx, next.length), 0, fragment);
        return next;
      }) },
    });
  };
  // Add a section the detector missed — a plain text section, or a KPI / chart /
  // table block the extractor couldn't pull from the PDF (charts are images).
  const addSection = (kind?: 'kpi' | 'chart' | 'table') =>
    set(prev => [...prev, { id: `new-${Date.now()}`, name: '', evidence: 'added', ...(kind ? { kind } : {}) }]);

  // The curated outline — the draggable section rows plus the add-a-section /
  // add-a-block controls. Rendered bare, or inside the report chrome (below).
  const outlineBody = (
    <>
      <Reorder.Group axis="y" values={sections} onReorder={set} className="space-y-0.5">
        {sections.map((s, i) => (
          <SectionRow
            key={s.id}
            section={s}
            index={i}
            total={sections.length}
            flashed={rightFlashId === s.id}
            registerRef={el => { rightRefs.current[s.id] = el; }}
            onRename={name => renameSection(s.id, name)}
            onDescribe={description => describeSection(s.id, description)}
            onDelete={() => deleteSection(s.id)}
            onJump={() => jumpToSource(s.id)}
            onMerge={dir => mergeSection(s.id, dir)}
          />
        ))}
      </Reorder.Group>
      <div className="mt-1.5 space-y-1.5">
        <button
          onClick={() => addSection()}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-[0.75rem] font-medium text-ink-400 hover:text-brand-600 hover:bg-brand-600/[0.04] transition-colors cursor-pointer"
        >
          <Plus size={13} /> Add a section the detector missed
        </button>
        {/* Add a block the extractor couldn't pull (un-captioned charts/KPIs
            are images in the PDF) — name it, and its sample shows above. */}
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-[0.625rem] text-ink-400">or add a block:</span>
          {([['kpi', 'KPI'], ['chart', 'Chart'], ['table', 'Table']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => addSection(k)}
              className="inline-flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full border border-canvas-border bg-white text-[0.625rem] font-semibold text-ink-600 hover:border-brand-600/40 hover:text-brand-700 transition-colors cursor-pointer"
            >
              <Plus size={10} className="opacity-60" /> {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="grid grid-cols-[2fr_3fr] gap-6 flex-1 min-h-0">
        {/* Left — the source document (the report as uploaded: the "as-is" state) */}
        <section className="flex flex-col min-h-0">
          <div className="shrink-0 pb-2.5 flex items-baseline gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-ink-500">As-is state</span>
            <span className="text-[0.6875rem] text-ink-400">the report you uploaded</span>
          </div>
          <div className="flex-1 overflow-y-auto -mx-2 px-2 pb-2">
            {detected.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-canvas-border bg-white px-6 py-12 text-center text-[0.75rem] text-ink-400 leading-relaxed">
                No section headings were detected in the document. Add the sections it should have on the right.
              </div>
            ) : (
              /* The source rendered as the page it came from — a white sheet with a
                 letterhead-style title block and document body, so it reads as the
                 real report, not a list of snippets. Each block stays click-to-jump. */
              <article className="rounded-[12px] border border-canvas-border bg-white shadow-[0_1px_2px_rgba(15,8,30,0.04),0_8px_24px_-12px_rgba(15,8,30,0.10)] px-8 py-7">
                {detected.map((d, idx) => (
                  <div
                    key={d.id}
                    ref={el => { sourceRefs.current[d.id] = el; }}
                    onClick={() => jumpToSection(d.id)}
                    title="Show this section in the detected list"
                    className={`group/src relative -mx-4 px-4 rounded-[8px] cursor-pointer transition-colors duration-300 hover:bg-canvas/60 ${
                      idx === 0 ? 'pb-4 mb-5 border-b border-canvas-border pt-1' : 'py-3'
                    } ${flashId === d.id ? 'bg-brand-600/[0.06] ring-1 ring-brand-600/20' : ''}`}
                  >
                    <h4 className={`flex items-center gap-1.5 text-ink-900 ${idx === 0 ? 'text-[1.0625rem] font-bold tracking-tight' : 'text-[0.9375rem] font-semibold'}`}>
                      <span className="min-w-0 truncate">{d.name}</span>
                      <CornerDownRight size={12} className="shrink-0 text-brand-600 opacity-0 group-hover/src:opacity-100 transition-opacity" />
                    </h4>
                    {(d.source ?? []).map((line, i) => (
                      <p key={i} className={`leading-relaxed text-ink-600 ${idx === 0 ? 'text-[0.8125rem] mt-1 text-ink-500' : 'text-[0.8125rem] mt-1.5'}`}>{line}</p>
                    ))}
                  </div>
                ))}
              </article>
            )}
          </div>
        </section>


        {/* Right — the curated outline. With `reportChrome` it renders inside the
            report's own letterhead + sheet + footer (mirrors the editor preview),
            so it reads as the report being assembled, not a detached list. */}
        <section className="flex flex-col min-h-0">
          <div className="shrink-0 pb-2.5 flex items-baseline gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-brand-600">To-be state</span>
            <span className="text-[0.6875rem] text-ink-400">your template</span>
          </div>
          <div className="flex-1 overflow-y-auto -mx-2 px-2 pb-2">
            {reportChrome ? (
              <div className="rounded-[12px] shadow-[0_1px_2px_rgba(15,8,30,0.04),0_8px_24px_-12px_rgba(15,8,30,0.10)]" style={reportChrome.accent ? ({ '--rep-accent': reportChrome.accent } as CSSProperties) : undefined}>
                <ReportBrandBanner
                  title={reportChrome.title || 'Untitled Template'}
                  titleClassName="text-[1.375rem]"
                  className="rounded-t-[12px]"
                  gradient={reportChrome.gradient}
                  footer={
                    /* Narrow half-width card — only the facts that matter while
                       assembling a template. "Generated on" is dropped (a template
                       isn't generated) so the two columns stay roomy, no truncation. */
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Brand', value: reportChrome.brand || 'Irame' },
                        { label: 'Sections', value: `${sections.length}` },
                      ].map(f => (
                        <div key={f.label} className="min-w-0">
                          <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-white/50 whitespace-nowrap">{f.label}</div>
                          <div className="text-[0.8125rem] font-medium text-white/90 mt-1 truncate">{f.value}</div>
                        </div>
                      ))}
                    </div>
                  }
                >
                  <p className="text-[0.8125rem] text-white/75">{reportChrome.desc || 'Custom report template'}</p>
                </ReportBrandBanner>
                <div className="border-x border-canvas-border bg-white px-5 py-4">
                  {outlineBody}
                </div>
                <div className="border-x border-b border-canvas-border bg-canvas/60 rounded-b-[12px] px-5 py-3 flex items-center justify-center">
                  <span className="text-[0.6875rem] text-ink-400 tracking-wide">{reportChrome.footerText || 'Generated by Irame'}</span>
                </div>
              </div>
            ) : (
              outlineBody
            )}
          </div>
        </section>
      </div>
    </>
  );
}
