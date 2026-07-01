// Shared "AI proposes, the human curates" review canvas (Template Studio §4).
// The uploaded document on the left, the AI-detected sections on the right with an
// evidence-grounded signal, inline rename / delete-with-undo / merge / drag-reorder
// / add, two-way jump-to-source, and a per-type coverage meter.
//
// Reached from the editor's "Import from a report" step: the author curates what
// the detector proposed before it lands in the outline.

import { useMemo, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import {
  AlertTriangle, Plus, Trash2, CornerDownRight,
  GripVertical, Tag, ArrowUpToLine, ArrowDownToLine,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { sectionCoverage, type ReportTypeName, type TypeSection } from './reportShared';
import {
  EVIDENCE_META,
  type Evidence, type CanvasSection,
} from './sectionReviewShared';

// Segmented coverage meter — one pip per required/recommended section, filled as
// the document covers it. Pips read the gap at a glance without parsing "1/3".
function CoverageMeter({ label, present, total, required = false }: { label: string; present: number; total: number; required?: boolean }) {
  const complete = present >= total;
  const fill = required ? 'bg-compliant-500' : 'bg-brand-400';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[0.6875rem] font-medium text-ink-500">{label}</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-1.5 w-3.5 rounded-full transition-colors ${i < present ? fill : 'bg-ink-900/[0.08]'}`} />
        ))}
      </span>
      <span className={`text-[0.6875rem] font-semibold tabular-nums ${complete ? 'text-compliant-700' : required ? 'text-high-700' : 'text-ink-500'}`}>{present}/{total}</span>
    </span>
  );
}

// One draggable detected-section row. Owns its own drag controls so the handle
// (not the text input) starts the drag.
function SectionRow({ section, index, total, flashed, registerRef, onRename, onDelete, onJump, onMerge }: {
  section: CanvasSection;
  index: number;
  total: number;
  flashed: boolean;
  registerRef: (el: HTMLElement | null) => void;
  onRename: (name: string) => void;
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
  const numTint = empty ? 'bg-high-50 text-high-700' : meta.tint;
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
        {/* The index chip carries the evidence colour — status without a rail. */}
        <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[0.6875rem] font-bold tabular-nums ${numTint}`}>{index + 1}</span>
        <input
          value={section.name}
          onChange={e => onRename(e.target.value)}
          placeholder="Name this section"
          className="flex-1 min-w-0 bg-transparent text-[0.8125rem] font-semibold text-ink-900 focus:outline-none placeholder:font-medium placeholder:text-high-400"
        />
        {/* Placeholder blocks (chart/KPI/table detected in the document) wear a
            type chip — an empty block, no numbers, filled at generation. The chip
            IS the status, so these rows drop the text-oriented evidence label. */}
        {isPlaceholder ? (
          <span className="shrink-0 inline-flex items-center rounded-full bg-evidence-50 text-evidence-700 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide">
            {section.kind === 'kpi' ? 'KPI' : section.kind === 'table' ? 'Table' : 'Chart'}
          </span>
        ) : (
          /* Tiered status — clean rows stay a quiet grey label; only the rows that
             need a look pick up the evidence colour + warning glyph. */
          <span className={`inline-flex items-center gap-1.5 text-[0.625rem] font-medium shrink-0 ${meta.flag ? meta.text : 'text-ink-400'}`}>
            {meta.flag ? <AlertTriangle size={10} /> : <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />}
            {meta.label}
          </span>
        )}
        <button
          onClick={onDelete}
          aria-label="Remove section"
          className="p-1 rounded-[6px] text-ink-300 hover:text-high-700 hover:bg-high-50 transition-all cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {(isDetected || canMerge || empty) && (
        <div className="flex items-center gap-2 mt-1 pl-[2.25rem]">
          {isDetected && (
            <button onClick={onJump} className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-ink-400 hover:text-brand-600 transition-colors cursor-pointer">
              <CornerDownRight size={10} /> Show in document
            </button>
          )}
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
 * undo / merge / add / reorder / jump); the parent owns the `sections` state and
 * the report-type context (for the coverage meter).
 */
export default function SectionReviewCanvas({
  sections,
  onSectionsChange,
  reportType,
  reportTypeLabel,
}: {
  sections: CanvasSection[];
  onSectionsChange: (next: CanvasSection[] | ((prev: CanvasSection[]) => CanvasSection[])) => void;
  reportType: ReportTypeName;
  reportTypeLabel: string;
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
  // Delete is reversible — a misclick shouldn't silently drop a section.
  const deleteSection = (id: string) => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const removed = sections[idx];
    set(prev => prev.filter(s => s.id !== id));
    addToast({
      type: 'info',
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
      message: `Merged “${fragment.name || 'fragment'}” into “${target.name || 'the section ' + direction}”.`,
      secondaryAction: { label: 'Undo', onClick: () => set(prev => {
        if (prev.some(s => s.id === fragment.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(idx, next.length), 0, fragment);
        return next;
      }) },
    });
  };
  const addSection = () =>
    set(prev => [...prev, { id: `new-${Date.now()}`, name: '', evidence: 'explicit' }]);

  // Coverage of the detected sections against the chosen type's required /
  // recommended set.
  const typeCoverage = sectionCoverage(reportType, sections.map(s => s.name));
  const addTypeSections = (list: TypeSection[]) =>
    set(prev => [
      ...prev,
      ...list
        .filter(spec => !prev.some(p => spec.match.test(p.name)))
        .map(spec => ({ id: `type-${Date.now()}-${spec.name}`, name: spec.name, evidence: 'added' as Evidence })),
    ]);

  return (
    <>
      {typeCoverage.spec.length > 0 && (
        <div className="shrink-0 mb-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
            <span className="inline-flex items-center gap-2 shrink-0">
              <Tag size={14} className="text-ink-400" />
              <span className="text-[0.8125rem] font-semibold text-ink-800">{reportTypeLabel} coverage</span>
            </span>
            <CoverageMeter label="Required" present={typeCoverage.requiredPresent} total={typeCoverage.requiredTotal} required />
            <CoverageMeter label="Recommended" present={typeCoverage.recommendedPresent} total={typeCoverage.recommendedTotal} />
            {typeCoverage.allMissing.length > 0 && (
              <button onClick={() => addTypeSections(typeCoverage.allMissing)} className="ml-auto inline-flex items-center gap-1 h-7 px-3 rounded-full bg-brand-600 text-white text-[0.6875rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer shrink-0">
                <Plus size={12} /> Add {typeCoverage.allMissing.length} missing
              </button>
            )}
          </div>
          {typeCoverage.allMissing.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[0.6875rem] font-medium text-ink-400 mr-0.5">Missing</span>
              {typeCoverage.allMissing.map(spec => {
                const req = spec.tier === 'required';
                return (
                  <button
                    key={spec.name}
                    onClick={() => addTypeSections([spec])}
                    title={`Add "${spec.name}"`}
                    className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full border text-[0.6875rem] font-medium cursor-pointer transition-colors ${req ? 'border-high/40 bg-high-50 text-high-700 hover:bg-high-100' : 'border-canvas-border bg-white text-ink-600 hover:border-brand-600/40 hover:text-brand-700'}`}
                  >
                    <Plus size={11} className="shrink-0 opacity-60" />
                    {spec.name}
                    {req && <span className="w-1 h-1 rounded-full bg-high-600 shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-[1fr_1px_1fr] flex-1 min-h-0">
        {/* Left — the source document */}
        <section className="flex flex-col min-h-0 pr-6">
          <header className="shrink-0 flex items-baseline gap-2 mb-3">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Source document</h3>
          </header>
          <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
            {detected.length === 0 ? (
              <p className="px-3 py-6 text-[0.75rem] text-ink-400 leading-relaxed">No section headings were detected in the document. Add the sections it should have on the right.</p>
            ) : detected.map(d => (
              <button
                key={d.id}
                type="button"
                ref={el => { sourceRefs.current[d.id] = el as unknown as HTMLDivElement; }}
                onClick={() => jumpToSection(d.id)}
                title="Show this section in the detected list"
                className={`group/src block w-full text-left rounded-[10px] px-3 py-2.5 transition-colors duration-300 cursor-pointer hover:bg-canvas ${flashId === d.id ? 'bg-brand-600/[0.07] ring-1 ring-brand-600/25' : ''}`}
              >
                <h4 className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-900 mb-0.5">
                  <span className="truncate">{d.name}</span>
                  <CornerDownRight size={11} className="shrink-0 text-brand-600 opacity-0 group-hover/src:opacity-100 transition-opacity" />
                </h4>
                {(d.source ?? []).map((line, i) => (
                  <p key={i} className="text-[0.6875rem] leading-relaxed text-ink-400">{line}</p>
                ))}
              </button>
            ))}
          </div>
        </section>

        {/* Hairline divider — one line instead of two facing card borders. */}
        <div className="bg-canvas-border" aria-hidden="true" />

        {/* Right — detected sections to curate */}
        <section className="flex flex-col min-h-0 pl-6">
          <header className="shrink-0 mb-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Detected sections</h3>
              <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-ink-900/[0.05] text-[0.625rem] font-semibold tabular-nums text-ink-500">{sections.length}</span>
            </div>
            {/* Evidence legend — decodes the index-chip colours at a glance. */}
            <div className="flex items-center gap-3 mt-2 text-[0.625rem] font-medium text-ink-400">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-compliant-500" /> Explicit</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-mitigated-500" /> Review</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-high-500" /> Fragment</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> Added</span>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto -mx-2 px-2">
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
                  onDelete={() => deleteSection(s.id)}
                  onJump={() => jumpToSource(s.id)}
                  onMerge={dir => mergeSection(s.id, dir)}
                />
              ))}
            </Reorder.Group>
            <button
              onClick={addSection}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-[0.75rem] font-medium text-ink-400 hover:text-brand-600 hover:bg-brand-600/[0.04] transition-colors cursor-pointer"
            >
              <Plus size={13} /> Add a section the detector missed
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
