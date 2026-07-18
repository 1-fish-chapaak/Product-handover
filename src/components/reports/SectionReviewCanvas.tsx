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
  Plus, CornerDownRight, Check, Table2, BarChart3, Gauge,
  GripVertical, ArrowUpToLine, ArrowDownToLine, Pencil, FileSearch, FileText, Info,
} from 'lucide-react';
import type { DataBlock } from './reportShared';

// Data-block placeholders detected inside a section (Table / Graph / KPI). Shown in
// review so a section reads as "heading + description + its own data"; each binds to
// a query at generation. Icon + label only — no numbers are scraped from the upload.
const DATA_BLOCK_META: Record<DataBlock['kind'], { icon: typeof Table2; label: string }> = {
  table: { icon: Table2, label: 'Table' },
  graph: { icon: BarChart3, label: 'Graph' },
  kpi: { icon: Gauge, label: 'KPI' },
};
function DataBlockChips({ blocks }: { blocks: DataBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="mt-1 pl-[2.25rem] pr-1 flex items-center gap-1.5 flex-wrap">
      <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">Data</span>
      {blocks.map(b => {
        const meta = DATA_BLOCK_META[b.kind];
        const Icon = meta.icon;
        return (
          <span key={b.id} title={`${meta.label} — binds to a query at generation`} className="inline-flex items-center gap-1 rounded-[6px] border border-canvas-border bg-canvas/60 px-1.5 py-0.5 text-[0.625rem] font-medium text-ink-600">
            <Icon size={11} className="text-brand-600" />
            {b.label && b.label.toLowerCase() !== meta.label.toLowerCase() ? `${meta.label} · ${b.label}` : meta.label}
          </span>
        );
      })}
    </div>
  );
}
import { useToast } from '../shared/Toast';
import { RowDeleteButton } from './RowDeleteButton';
import { ReportBrandBanner } from './ReportDocumentChrome';
import { sectionSummary } from './reportShared';
import type { RatingScale, WritingStyle } from './reportShared';
import { matchHeading } from './sectionSynonyms';
import {
  EVIDENCE_META,
  type CanvasSection,
} from './sectionReviewShared';

// One draggable detected-section row. Owns its own drag controls so the handle
// (not the text input) starts the drag. A section is a heading + description (+ its
// own data blocks, bound to queries at generation) — NOT a single whole-section
// "fills from" source. So the row confirms the heading + description; there is no
// per-section source dropdown (removed per PRD "Custom Internal Audit Report Formats").
function SectionRow({ section, index, total, flashed, registerRef, onRename, onDescribe, onDelete, onJump, onMerge, onToggleConfirm }: {
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
  onToggleConfirm: () => void;
}) {
  const controls = useDragControls();
  const meta = EVIDENCE_META[section.evidence];
  const empty = !section.name.trim();
  const isDetected = section.source !== undefined;
  const isManual = !!section.manual;
  // A manual section's description is its own text only (no auto blurb seed), so a
  // blank one is genuinely blank and the mandatory check is honest.
  const descText = section.description ?? (isManual ? '' : (sectionSummary(section.name) ?? ''));
  const descMissing = isManual && !empty && !descText.trim();
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
        <RowDeleteButton
          onConfirm={onDelete}
          ariaLabel="Remove section"
          triggerClassName="p-1 rounded-[6px] text-ink-300 hover:text-high-700 hover:bg-high-50 transition-all cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        />
      </div>
      {/* Description — editable, seeded from the auto blurb. An auto-growing textarea
          so the whole description wraps and shows in full (never clipped to one line). */}
      {!empty && (
        <div className="mt-0.5 pl-[2.25rem] pr-1">
          <textarea
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
            rows={1}
            value={descText}
            onChange={e => { onDescribe(e.target.value); const t = e.target; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; }}
            placeholder={isManual ? 'Add a description (required)…' : 'Add a one-line description…'}
            title="Click to edit this section's description"
            className={`w-full -ml-1 resize-none overflow-hidden rounded-[6px] border bg-transparent px-1.5 py-0.5 text-[0.75rem] text-ink-400 leading-relaxed transition-colors cursor-text hover:bg-white focus:outline-none focus:border-brand-600/40 focus:bg-white focus:ring-2 focus:ring-brand-600/10 placeholder:text-ink-300 ${descMissing ? 'border-high-300 bg-high-50/40' : 'border-transparent hover:border-canvas-border'}`}
          />
        </div>
      )}
      {/* Data blocks (Table / Graph / KPI) this section holds — placeholders that
          bind to queries at generation. */}
      {!empty && section.dataBlocks?.length ? <DataBlockChips blocks={section.dataBlocks} /> : null}
      {/* Confirm — the auditor reviews the heading + description and confirms the
          section. A section is a description plus its own data blocks (bound to
          queries at generation), not a single source, so there is no per-section
          "fills from" picker. The import can't be saved until every section is
          confirmed (nothing auto-applies). */}
      {/* A manual section has no Confirm button — it is the author's own writing, so
          it confirms itself once its name AND description are both filled. A blank
          description shows a required hint and blocks the section (never a button). */}
      {!empty && isManual && (
        <div className="mt-1 pl-[2.25rem] pr-1 flex items-center gap-2 flex-wrap">
          {descMissing ? (
            <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold text-high-700">
              <Info size={11} /> Description required
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold bg-compliant-600 text-white">
              <Check size={11} /> Ready
            </span>
          )}
        </div>
      )}
      {!empty && !isManual && (
        <div className="mt-1 pl-[2.25rem] pr-1 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onToggleConfirm}
            aria-pressed={!!section.confirmed}
            title={section.confirmed ? 'Confirmed — click to unconfirm' : 'Confirm this section'}
            className={`no-focus-ring inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold transition-colors cursor-pointer ${
              section.confirmed
                ? 'bg-compliant-600 text-white hover:bg-compliant-700'
                : 'border border-high-300 text-high-700 bg-high-50/50 hover:bg-high-50'
            }`}
          >
            <Check size={11} /> {section.confirmed ? 'Confirmed' : 'Confirm'}
          </button>
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

// "Detected from the document" — the assurance scale + writing style read on
// import (Gap 3), shown so the auditor can see and confirm what was captured. It
// carries forward onto the template as generation constraints.
const STYLE_LABEL: Record<string, string> = {
  'first-plural': 'First-person plural (we / our)',
  'third-person': 'Third-person',
  past: 'Past tense',
  present: 'Present tense',
  'count-of-total': 'Samples as “7 of 40”',
  percentage: 'Samples as “17.5%”',
  roles: 'People named by role',
  names: 'People named by name',
};
function DetectedMeaningPanel({ scale, style }: { scale?: RatingScale; style?: WritingStyle }) {
  if (!scale && !style) return null;
  const styleChips = style
    ? [style.voice, style.tense, style.numbering ? `Numbering ${style.numbering}` : undefined, style.sampleFormat, style.personNaming]
        .filter(Boolean)
        .map(v => (typeof v === 'string' && STYLE_LABEL[v]) ? STYLE_LABEL[v] : (v as string))
    : [];
  return (
    <div className="shrink-0 mb-3 rounded-[10px] border border-evidence-200 bg-evidence-50/40 px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <FileSearch size={13} className="text-evidence-700" />
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-evidence-700">Detected from the document</span>
        <span className="text-[0.6875rem] text-ink-400">· confirm these carry onto the template</span>
      </div>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        {scale && (
          <div className="min-w-0">
            <div className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400 mb-1">Assurance scale{scale.heading ? ` · ${scale.heading}` : ''}</div>
            <div className="flex flex-wrap gap-1.5">
              {scale.levels.map(l => (
                <span key={l.label} title={l.definition} className="inline-flex items-center rounded-full bg-white border border-canvas-border px-2 py-0.5 text-[0.6875rem] font-medium text-ink-700">{l.label}</span>
              ))}
            </div>
          </div>
        )}
        {styleChips.length > 0 && (
          <div className="min-w-0">
            <div className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400 mb-1">Writing style</div>
            <div className="flex flex-wrap gap-1.5">
              {styleChips.map(c => (
                <span key={c} className="inline-flex items-center rounded-full bg-white border border-canvas-border px-2 py-0.5 text-[0.6875rem] font-medium text-ink-700">{c}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
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
  scale,
  style,
  letterheadCaptured,
}: {
  sections: CanvasSection[];
  onSectionsChange: (next: CanvasSection[] | ((prev: CanvasSection[]) => CanvasSection[])) => void;
  /** The assurance scale + writing style read from the document (Gap 3), shown as a
   *  "Detected from the document" panel for the auditor to confirm. */
  scale?: RatingScale;
  style?: WritingStyle;
  /** Whether the import captured a running letterhead — shown in the to-be header. */
  letterheadCaptured?: boolean;
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

  // Renaming can change the inferred mapping, so it re-opens the section for
  // confirmation (a changed heading is a new decision). A manual section has no
  // Confirm button — it confirms itself once its name AND description are filled.
  const renameSection = (id: string, name: string) =>
    set(prev => prev.map(s => {
      if (s.id !== id) return s;
      if (s.manual) return { ...s, name, match: matchHeading(name), confirmed: !!name.trim() && !!(s.description ?? '').trim() };
      return { ...s, name, match: matchHeading(name), confirmed: false };
    }));
  const describeSection = (id: string, description: string) =>
    set(prev => prev.map(s => {
      if (s.id !== id) return s;
      if (s.manual) return { ...s, description, confirmed: !!s.name.trim() && !!description.trim() };
      return { ...s, description };
    }));
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
  // The per-row confirm toggle — the auditor acknowledges (or re-opens) a section.
  const toggleConfirm = (id: string) =>
    set(prev => prev.map(s => (s.id === id ? { ...s, confirmed: !s.confirmed } : s)));
  // Add a section the detector missed — a plain prose section the author names.
  const addSection = () =>
    set(prev => [...prev, { id: `new-${Date.now()}`, name: '', evidence: 'added', manual: true }]);

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
            onToggleConfirm={() => toggleConfirm(s.id)}
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
      </div>
    </>
  );

  return (
    <>
      <DetectedMeaningPanel scale={scale} style={style} />
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
            {/* Confirmation progress + letterhead status — sits with the to-be header
                (the sections being confirmed), not in the action footer. */}
            {(() => {
              const named = sections.filter(s => s.name.trim());
              const confirmedCount = named.filter(s => s.confirmed).length;
              const allConfirmed = named.length > 0 && confirmedCount === named.length;
              return (
                <span className="ml-auto text-[0.75rem] text-ink-400">
                  <span className={allConfirmed ? 'text-compliant-700 font-semibold' : 'text-high-700 font-semibold'}>{confirmedCount}/{named.length} confirmed</span>
                  {letterheadCaptured != null && <> · {letterheadCaptured ? 'letterhead captured' : 'no letterhead found'}</>}
                </span>
              );
            })()}
          </div>
          <div className="flex-1 overflow-y-auto -mx-2 px-2 pb-2">
            {reportChrome ? (
              <div className="rounded-[12px] shadow-[0_1px_2px_rgba(15,8,30,0.04),0_8px_24px_-12px_rgba(15,8,30,0.10)]" style={reportChrome.accent ? ({ '--rep-accent': reportChrome.accent } as CSSProperties) : undefined}>
                {/* This is a TEMPLATE (a format skin), not a generated report — the
                    cover carries template facts (brand + section count), not report
                    chrome (no "Generate ATR", no report id, no Author/Date/queries
                    byline). Matches the editor's preview cover. */}
                <ReportBrandBanner
                  title={reportChrome.title || 'Untitled Template'}
                  titleClassName="text-[1.375rem]"
                  className="rounded-t-[12px]"
                  gradient={reportChrome.gradient}
                  eyebrow={<span className="font-mono text-[0.75rem] tracking-[0.04em] text-white/65">GR-000000</span>}
                  actions={
                    /* Generate ATR (hidden for ATR / SOX templates); non-interactive
                       in a preview. Matches the standard template preview cover. */
                    /\batr\b|action taken/i.test(reportChrome.title || '') || /\bsox\b/i.test(reportChrome.title || '')
                      ? undefined
                      : (
                        <span
                          aria-hidden="true"
                          className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.75rem] font-semibold text-white/70 bg-brand-700/60 border border-white/20 rounded-[8px]"
                        >
                          <FileText size={13} /> Generate ATR
                        </span>
                      )
                  }
                  footer={
                    /* Same cover byline as the standard template preview: the slots
                       a generated report fills, as placeholders, not the live count. */
                    <div className="flex items-center gap-2.5 text-[0.875rem] flex-wrap">
                      {['Author', 'Date', 'N queries'].map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-2.5">
                          {i > 0 && <span className="text-white/30" aria-hidden="true">|</span>}
                          <span className={i === 0 ? 'font-semibold text-white' : 'text-white/70'}>{p}</span>
                        </span>
                      ))}
                    </div>
                  }
                >
                  <p className="text-[0.875rem] text-white/75">{reportChrome.desc || 'Custom template'}</p>
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
