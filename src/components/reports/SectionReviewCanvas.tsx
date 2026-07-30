// Shared "AI proposes, the human curates" review canvas — the BYOT review step.
// The uploaded document on the left, the detected skeleton on the right as a
// HIERARCHY: sections collapsed, blocks expandable beneath them. Every section
// carries a pre-filled one-line description and a fill-type dropdown (the five
// cases — the engine guesses, the user confirms). Being 80% right + a 2-minute
// fix beats chasing 100% automation; "Check this" flags jump the queue so the
// user fixes the doubtful 20%, not proof-reads everything.

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import {
  Plus, CornerDownRight, ChevronRight,
  GripVertical, ArrowUpToLine, ArrowDownToLine, Pencil, Lock, AlertTriangle,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { RowDeleteButton } from './RowDeleteButton';
import { ReportBrandBanner } from './ReportDocumentChrome';
import { sectionBlurb, type SectionFill } from './reportShared';
import type { TocCheck } from './byotExtraction';
import {
  FILL_META,
  BLOCK_KIND_LABEL,
  SHAKY_CONFIDENCE,
  type CanvasSection,
  type CanvasBlock,
} from './sectionReviewShared';

// ─── One block row inside an expanded section ───────────────────────────────
// A compact sample of the shape that was kept: type chip, label, and the
// structure that survives (columns, card fields, slot labels) — never values.
function BlockRow({ block, refSource }: {
  block: CanvasBlock;
  /** When this block is a second placement, the section that holds the shape. */
  refSource?: string;
}) {
  const fillMeta = FILL_META[block.fill];
  return (
    <div className="flex items-start gap-2 rounded-md border border-canvas-border/70 bg-white px-2.5 py-2">
      <span className="shrink-0 inline-flex items-center rounded-full bg-evidence-50 text-evidence-700 px-1.5 py-px text-[0.5625rem] font-semibold uppercase tracking-wide mt-px">
        {BLOCK_KIND_LABEL[block.kind]}{block.kind === 'cards' && block.cardCount ? ` × ${block.cardCount}` : ''}
      </span>
      <div className="min-w-0 flex-1">
        {block.label && <p className="text-[0.75rem] font-medium text-ink-900 truncate">{block.label}</p>}
        {/* The same block printed twice is stored once. Saying so here is what
            stops it reading as a duplicate we failed to notice. */}
        {block.ref && (
          <p className="text-[0.6875rem] text-brand-700">
            One box in two places. Saved once here and in “{refSource ?? 'another section'}”, so edits stay in step.
          </p>
        )}
        {/* The structure that was kept, said plainly. A placement has no shape
            of its own — the reference line above already said where it lives. */}
        {!block.ref && block.kind === 'table' && (
          <p className="text-[0.6875rem] text-ink-500 truncate">
            {block.columns?.length ? `Columns: ${block.columns.join(' · ')}` : 'Column names pending — rows are always thrown away'}
            {block.linkedTo ? ` — auto-built from “${block.linkedTo}”` : ''}
          </p>
        )}
        {!block.ref && block.kind === 'cards' && (
          <p className="text-[0.6875rem] text-ink-500">
            One shape, stamped per finding{block.idPattern ? ` (${block.idPattern})` : ''}.
            {block.cardFields?.length ? ` Fields: ${block.cardFields.join(', ')}.` : ''}
            {block.humanFields?.length ? ` A person fills: ${block.humanFields.join(', ')}.` : ''}
          </p>
        )}
        {!block.ref && (block.kind === 'stat' || block.kind === 'slot') && (block.slotLabels?.length ?? 0) > 0 && (
          <p className="text-[0.6875rem] text-ink-500 truncate">{block.kind === 'stat' ? 'Stats' : 'Slots'}: {block.slotLabels!.join(' · ')} — labels kept, values thrown away</p>
        )}
        {block.kind === 'signoff' && (
          <p className="text-[0.6875rem] text-ink-500">{block.signRoles?.length ? `Roles: ${block.signRoles.join(', ')}` : 'Signature slots'} — real people only</p>
        )}
        {block.kind === 'chart' && <p className="text-[0.6875rem] text-ink-500">A graph renders here — its numbers come from data, never the PDF.</p>}
        {(block.kind === 'narrative' || block.kind === 'callout') && block.fill === 'fixed' && (block.fixedBody?.length ?? 0) > 0 && (
          <p className="text-[0.6875rem] text-ink-500 line-clamp-2"><Lock size={9} className="inline mr-1" />{block.fixedBody!.join(' ')}</p>
        )}
        {(block.kind === 'narrative' || block.kind === 'callout') && block.fill !== 'fixed' && (block.preview?.length ?? 0) > 0 && (
          <p className="text-[0.6875rem] text-ink-400 line-clamp-1 italic">was: “{block.preview![0]}” — thrown away</p>
        )}
      </div>
      <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-px text-[0.5625rem] font-semibold ${fillMeta.tint}`} title={fillMeta.hint}>
        {fillMeta.label}
      </span>
    </div>
  );
}

// ─── One draggable section row ──────────────────────────────────────────────
function SectionRow({ section, index, total, flashed, registerRef, onRename, onDescribe, onFill, onDelete, onJump, onMerge, onWrapper, refSources, lockFill }: {
  section: CanvasSection;
  index: number;
  total: number;
  flashed: boolean;
  registerRef: (el: HTMLElement | null) => void;
  onRename: (name: string) => void;
  onDescribe: (description: string) => void;
  onFill: (fill: SectionFill) => void;
  onDelete: () => void;
  onJump: () => void;
  onMerge: (direction: 'up' | 'down') => void;
  onWrapper: (keep: boolean) => void;
  /** Block id → the section that stores its shape, for placements. */
  refSources?: Record<string, string>;
  /** No fill-type question: the badge reports what the section is. */
  lockFill?: boolean;
}) {
  const controls = useDragControls();
  const [expanded, setExpanded] = useState(false);
  const empty = !section.name.trim();
  const isDetected = section.source !== undefined || section.page !== undefined;
  const isFragment = section.evidence === 'fragment';
  const canMerge = isFragment && (index > 0 || index < total - 1);
  const blocks = section.blocks ?? [];
  const shaky = section.evidence !== 'added' && section.confidence !== undefined && section.confidence <= SHAKY_CONFIDENCE;
  const fill = section.fill ?? 'query';
  const bg = flashed
    ? 'bg-brand-600/[0.07]'
    : empty
      ? 'bg-high-50/50'
      : section.wrapper
        ? 'bg-mitigated-50/60'
        : shaky
          ? 'bg-mitigated-50/40'
          : 'hover:bg-canvas';
  return (
    <Reorder.Item
      value={section}
      dragListener={false}
      dragControls={controls}
      ref={registerRef}
      whileDrag={{ scale: 1.015, boxShadow: '0 12px 28px -12px rgba(15,8,30,0.28)' }}
      className={`group relative rounded-lg px-2.5 py-2 transition-colors ${bg} ${flashed ? 'ring-1 ring-brand-600/25' : ''}`}
    >
      {/* Clicking the row (anywhere non-interactive) highlights the matching
          part of the uploaded report on the left — their own document is the
          best documentation for what a section is. */}
      <div
        className="flex items-center gap-2.5"
        onClick={e => {
          if ((e.target as HTMLElement).closest('input,select,button')) return;
          if (isDetected) onJump();
        }}
      >
        <button
          onPointerDown={e => controls.start(e)}
          aria-label="Drag to reorder"
          className="-ml-1.5 touch-none cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-500 transition-all shrink-0 opacity-0 group-hover:opacity-100"
        >
          <GripVertical size={14} />
        </button>
        <span
          className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[0.6875rem] font-bold tabular-nums ${empty ? 'bg-high-50 text-high-700' : ''}`}
          style={empty ? undefined : { color: 'var(--rep-accent, #550fa5)', backgroundColor: 'color-mix(in srgb, var(--rep-accent, #6a12cd) 12%, transparent)' }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <input
          value={section.name}
          onChange={e => onRename(e.target.value)}
          placeholder="Name this section"
          title="Click to rename this section"
          className="flex-1 min-w-0 -ml-1 rounded-sm border border-transparent bg-transparent px-1.5 py-0.5 text-[0.8125rem] font-semibold text-ink-900 transition-colors cursor-text hover:border-canvas-border hover:bg-white focus:outline-none focus:border-brand-600/40 focus:bg-white focus:ring-2 focus:ring-brand-600/10 placeholder:font-medium placeholder:text-high-400"
        />
        <Pencil size={12} className="shrink-0 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
        {isDetected && (
          <button
            onClick={onJump}
            title="Show in document"
            aria-label="Show in document"
            className="shrink-0 p-1 rounded-sm text-ink-300 hover:text-brand-600 hover:bg-brand-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          >
            <CornerDownRight size={12} />
          </button>
        )}
        {shaky && !empty && (
          <span data-shaky className="shrink-0 inline-flex items-center rounded-full bg-mitigated-50 text-mitigated-700 px-2 py-0.5 text-[0.625rem] font-semibold">
            Check this
          </span>
        )}
        {/* BYOT keeps only what it can fill, so there is nothing to choose:
            the badge states which of the two kinds this section is, and the
            reason line below says why we claimed it. */}
        {!empty && lockFill && (
          <span
            title={FILL_META[fill].hint}
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-semibold ${FILL_META[fill].tint}`}
          >
            {FILL_META[fill].label}
          </span>
        )}
        {/* The fill-case dropdown — where does this section's content come
            from? The engine guessed; the user confirms. Never silently skipped. */}
        {!empty && !lockFill && (
          <select
            value={fill}
            onChange={e => onFill(e.target.value as SectionFill)}
            title={FILL_META[fill].hint}
            className={`shrink-0 rounded-full border-0 px-2 py-0.5 text-[0.625rem] font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-600/20 ${FILL_META[fill].tint}`}
          >
            {(Object.keys(FILL_META) as SectionFill[]).map(f => (
              <option key={f} value={f} title={FILL_META[f].hint}>{FILL_META[f].label}</option>
            ))}
          </select>
        )}
        <RowDeleteButton
          onConfirm={onDelete}
          ariaLabel="Remove section"
          triggerClassName="p-1 rounded-sm text-ink-300 hover:text-high-700 hover:bg-high-50 transition-all cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        />
      </div>

      {/* Wrapper paperwork — excluded with ONE confirmation, never silently. */}
      {section.wrapper && !empty && (
        <div className="mt-1.5 ml-[2.25rem] mr-1 flex items-center gap-2 rounded-md border border-mitigated-200 bg-white px-2.5 py-1.5">
          <AlertTriangle size={12} className="shrink-0 text-mitigated-600" />
          <p className="flex-1 text-[0.6875rem] text-mitigated-800">Looks like wrapper paperwork around the report (committee forms), not report content.</p>
          <button onClick={() => onWrapper(false)} className="shrink-0 px-2 py-0.5 rounded-full bg-mitigated-100 text-[0.625rem] font-semibold text-mitigated-800 hover:bg-mitigated-200 transition-colors cursor-pointer">Exclude it</button>
          <button onClick={() => onWrapper(true)} className="shrink-0 px-2 py-0.5 rounded-full text-[0.625rem] font-semibold text-ink-500 hover:bg-canvas transition-colors cursor-pointer">It's part of the report</button>
        </div>
      )}

      {/* One-line description — pre-filled by pass 6, editable. An empty
          description would mean the labelling pass isn't running. */}
      {!empty && (() => {
        const blurb = sectionBlurb(section.name);
        // Pass 6 annotates every section, including ones it has never seen. If
        // it could not write the line, say so and ask for it — the raw
        // "Describe what this section will cover" placeholder reads as broken.
        const unsummarised = !section.description && blurb.startsWith('Describe what this section will cover');
        return (
        <div className="mt-0.5 pl-[2.25rem] pr-1">
          <input
            value={section.description ?? (unsummarised ? '' : blurb)}
            onChange={e => onDescribe(e.target.value)}
            placeholder={unsummarised ? 'We couldn’t summarise this, add one line.' : undefined}
            title="Click to edit this section's description"
            className="w-full -ml-1 rounded-sm border border-transparent bg-transparent px-1.5 py-0.5 text-[0.75rem] text-ink-400 leading-relaxed transition-colors cursor-text hover:border-canvas-border hover:bg-white focus:outline-none focus:border-brand-600/40 focus:bg-white focus:ring-2 focus:ring-brand-600/10 placeholder:text-ink-300"
          />
          {/* The why + the consequence — the engine's evidence for its guess,
              so the user checks our reason, not the abstract option. Once they
              override, the reason no longer applies and the chosen option's
              consequence stands alone. */}
          <p className="px-0.5 text-[0.6875rem] text-ink-300 leading-relaxed">
            {section.fillReason ?? `${FILL_META[fill].label} — ${FILL_META[fill].hint}`}
          </p>
        </div>
        );
      })()}

      {/* The section's blocks — collapsed by default (a flat checklist breaks
          at 40 entries); expand to see the furniture that was kept. */}
      {!empty && blocks.length > 0 && (
        <div className="mt-1 pl-[2.25rem] pr-1">
          <button
            onClick={() => setExpanded(x => !x)}
            className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-ink-400 hover:text-brand-600 transition-colors cursor-pointer"
          >
            <ChevronRight size={11} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
            {blocks.length} block{blocks.length === 1 ? '' : 's'}
            <span className="text-ink-300 font-normal">· {[...new Set(blocks.map(b => BLOCK_KIND_LABEL[b.kind]))].join(', ')}</span>
          </button>
          {expanded && (
            <div className="mt-1.5 space-y-1.5">
              {blocks.map(b => <BlockRow key={b.id} block={b} refSource={b.ref ? refSources?.[b.ref] : undefined} />)}
            </div>
          )}
        </div>
      )}

      {(canMerge || empty) && (
        <div className="flex items-center gap-2 mt-1 pl-[2.25rem]">
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
 * The two-panel curation body. Owns the review interactions (rename / describe /
 * fill-confirm / delete-with-undo / merge / add / reorder / jump / wrapper
 * confirm); the parent owns the `sections` state.
 */
export default function SectionReviewCanvas({
  sections,
  onSectionsChange,
  reportChrome,
  pages,
  pageCount,
  toc,
  lockFill,
  notIncluded,
}: {
  sections: CanvasSection[];
  onSectionsChange: (next: CanvasSection[] | ((prev: CanvasSection[]) => CanvasSection[])) => void;
  /** When provided, the curated outline renders inside the report's own chrome —
   *  the same letterhead + white sheet + footer the editor preview uses. */
  reportChrome?: {
    title: string;
    desc?: string;
    brand: string;
    headerText?: string;
    footerText?: string;
    gradient?: [string, string];
    accent?: string;
  };
  /** Rendered pages of the uploaded PDF (data URLs) — the real document. */
  pages?: string[];
  pageCount?: number;
  /** The only valid sanity check — our list vs the report's own contents page. */
  toc?: TocCheck;
  /** Hide the fill-type dropdown: BYOT keeps only sections it can fill, so
   *  there is no "who fills this?" question left to answer. */
  lockFill?: boolean;
  /** Sections the template does not keep, said once and never silently. */
  notIncluded?: { name: string; why: string; captured?: boolean }[];
}) {
  const { addToast } = useToast();
  const sourceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pageRefs = useRef<Record<number, HTMLElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);
  const [flashPage, setFlashPage] = useState<number | null>(null);
  const [rightFlashId, setRightFlashId] = useState<string | null>(null);

  const set = (updater: CanvasSection[] | ((prev: CanvasSection[]) => CanvasSection[])) => onSectionsChange(updater);

  const detected = useMemo(() => sections.filter(s => s.source !== undefined), [sections]);
  // Which section holds the shape a placement points at, so a referenced block
  // can name its source instead of looking like an unnoticed duplicate.
  const refSources = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sections) {
      for (const b of s.blocks ?? []) if (b.refId) map[b.refId] = s.name;
    }
    return map;
  }, [sections]);
  const hasPages = !!pages && pages.length > 0;
  const shaky = useMemo(
    () => sections.filter(s => s.evidence !== 'added' && s.confidence !== undefined && s.confidence <= SHAKY_CONFIDENCE),
    [sections],
  );

  const jumpToSource = (id: string) => {
    const sec = sections.find(s => s.id === id);
    if (hasPages && sec?.page) {
      const pageNo = Math.min(sec.page, pages!.length);
      const el = pageRefs.current[pageNo];
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashPage(pageNo);
      setTimeout(() => setFlashPage(curr => (curr === pageNo ? null : curr)), 1200);
      return;
    }
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
  // Confirming a uniform fill case pushes it down to the blocks; 'mixed' keeps
  // each block's own answer — granularity only appears when needed. A user
  // override retires the engine's reasoning line (it no longer applies).
  const fillSection = (id: string, fill: SectionFill) =>
    set(prev => prev.map(s => (s.id === id
      ? {
          ...s,
          fill,
          fillReason: undefined,
          blocks: fill === 'mixed' ? s.blocks : s.blocks?.map(b => ({ ...b, fill })),
        }
      : s)));
  // Wrapper confirm: keep clears the flag; exclude deletes (with undo).
  const resolveWrapper = (id: string, keep: boolean) => {
    if (keep) {
      set(prev => prev.map(s => (s.id === id ? { ...s, wrapper: undefined } : s)));
      return;
    }
    deleteSection(id);
  };
  const deleteSection = (id: string) => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const removed = sections[idx];
    set(prev => prev.filter(s => s.id !== id));
    addToast({
      type: 'info',
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
  // Add a section the detector missed — plain, or seeded with one typed block
  // (charts/stats are images in a PDF, so un-captioned ones can't be pulled).
  const addSection = (blockKind?: 'stat' | 'chart' | 'table' | 'cards') =>
    set(prev => [...prev, {
      id: `new-${Date.now()}`,
      name: '',
      evidence: 'added',
      fill: blockKind ? 'query' : undefined,
      blocks: blockKind ? [{ id: `new-b-${Date.now()}`, kind: blockKind, fill: 'query' as const }] : undefined,
    }]);

  const jumpToFirstShaky = () => { if (shaky.length) jumpToSection(shaky[0].id); };

  const outlineBody = (
    <>
      {/* The relative sanity check — our list vs the report's own contents.
          A 40-section report with a 40-entry TOC is correct, not a failure. */}
      {toc && (
        <div className={`mb-2 flex items-start gap-2 rounded-md border px-3 py-2 ${toc.verdict === 'match' ? 'border-compliant-200 bg-compliant-50/50' : 'border-mitigated-200 bg-mitigated-50/60'}`}>
          <p className={`text-[0.6875rem] leading-relaxed ${toc.verdict === 'match' ? 'text-compliant-800' : 'text-mitigated-800'}`}>
            {toc.verdict === 'match'
              ? <>Matches the report’s own contents page ({toc.detected} detected, {toc.docEntries} listed).</>
              : toc.verdict === 'over-split'
                ? <>We detected {toc.detected} sections but the report’s own contents lists {toc.docEntries} — some rows below are probably blocks inside a section. Merge or delete the extras.</>
                : <>The report’s own contents lists {toc.docEntries} sections but we only detected {toc.detected} — some may be missing. Add them below.</>}
          </p>
        </div>
      )}
      {/* "We weren't sure" — flagged detections jump the queue. */}
      {shaky.length > 0 && (
        <button
          onClick={jumpToFirstShaky}
          className="w-full text-left mb-2 flex items-start gap-2 rounded-md border border-mitigated-200 bg-mitigated-50/60 px-3 py-2 hover:bg-mitigated-50 transition-colors cursor-pointer"
        >
          <AlertTriangle size={13} className="mt-px shrink-0 text-mitigated-600" />
          <p className="text-[0.6875rem] text-mitigated-800 leading-relaxed">
            We weren’t sure about {shaky.length} section{shaky.length === 1 ? '' : 's'} — marked “Check this”. Tap to jump to the first; a quick look at those beats rechecking everything.
          </p>
        </button>
      )}
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
            onFill={fill => fillSection(s.id, fill)}
            onDelete={() => deleteSection(s.id)}
            onJump={() => jumpToSource(s.id)}
            onMerge={dir => mergeSection(s.id, dir)}
            onWrapper={keep => resolveWrapper(s.id, keep)}
            refSources={refSources}
            lockFill={lockFill}
          />
        ))}
      </Reorder.Group>
      {/* Everything the template does not keep, said once, here, rather than
          discovered at export. The client covers these per report through Add
          Observation, which already carries name, description and evidence. */}
      {(notIncluded?.length ?? 0) > 0 && (
        <div className="mt-3 rounded-lg border border-canvas-border bg-canvas px-3 py-2.5">
          <p className="text-[0.6875rem] font-semibold text-ink-700">
            Not included ({notIncluded!.length})
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-ink-500 leading-relaxed">
            We kept the sections we can fill from your audit results. These ones stay out of the template. Anything else goes in one report at a time through Add Observation.
          </p>
          <ul className="mt-1.5 space-y-1">
            {notIncluded!.map(n => (
              <li key={n.name} className={`text-[0.6875rem] leading-relaxed ${n.captured ? 'text-compliant-700' : 'text-ink-400'}`}>
                <span className={`font-medium ${n.captured ? 'text-compliant-700' : 'text-ink-500'}`}>{n.name}</span>
                {' · '}{n.why.replace(/^(Not included|Captured as a setting):\s*/, '')}
                {n.captured && ' ✓'}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-1.5 space-y-1.5">
        <button
          onClick={() => addSection()}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[0.75rem] font-medium text-ink-400 hover:text-brand-600 hover:bg-brand-600/[0.04] transition-colors cursor-pointer"
        >
          <Plus size={13} /> Add a section the detector missed
        </button>
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-[0.625rem] text-ink-400">or add one with a block:</span>
          {([['stat', 'Stats'], ['chart', 'Chart'], ['table', 'Table'], ['cards', 'Finding cards']] as const).map(([k, label]) => (
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
            {hasPages ? (
              <div className="space-y-3">
                {pages!.map((src, pi) => {
                  const pageNo = pi + 1;
                  const first = sections.find(s => s.page === pageNo);
                  return (
                    <figure
                      key={pageNo}
                      ref={el => { pageRefs.current[pageNo] = el; }}
                      onClick={() => { if (first) jumpToSection(first.id); }}
                      title={first ? 'Show this page’s first section in the detected list' : undefined}
                      className={`rounded-lg p-1 transition-colors duration-300 ${first ? 'cursor-pointer hover:bg-canvas/70' : ''} ${flashPage === pageNo ? 'bg-brand-600/[0.06] ring-1 ring-brand-600/25' : ''}`}
                    >
                      <img
                        src={src}
                        alt={`Page ${pageNo} of the uploaded report`}
                        className="w-full rounded-md border border-canvas-border bg-white shadow-[0_1px_2px_rgba(15,8,30,0.04),0_8px_24px_-12px_rgba(15,8,30,0.10)]"
                      />
                      <figcaption className="mt-1 text-center text-[0.625rem] text-ink-400 tabular-nums">Page {pageNo}{pageCount ? ` of ${pageCount}` : ''}</figcaption>
                    </figure>
                  );
                })}
                {pageCount !== undefined && pageCount > pages!.length && (
                  <p className="px-2 pb-1 text-center text-[0.625rem] text-ink-400 leading-relaxed">
                    Showing the first {pages!.length} pages. All {pageCount} were read for structure.
                  </p>
                )}
              </div>
            ) : detected.length === 0 ? (
              <div className="rounded-lg border border-dashed border-canvas-border bg-white px-6 py-12 text-center text-[0.75rem] text-ink-400 leading-relaxed">
                No section headings were detected in the document. Add the sections it should have on the right.
              </div>
            ) : (
              <article className="rounded-lg border border-canvas-border bg-white shadow-[0_1px_2px_rgba(15,8,30,0.04),0_8px_24px_-12px_rgba(15,8,30,0.10)] px-8 py-7">
                {detected.map((d, idx) => (
                  <div
                    key={d.id}
                    ref={el => { sourceRefs.current[d.id] = el; }}
                    onClick={() => jumpToSection(d.id)}
                    title="Show this section in the detected list"
                    className={`group/src relative -mx-4 px-4 rounded-md cursor-pointer transition-colors duration-300 hover:bg-canvas/60 ${
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

        {/* Right — the curated skeleton, inside the report's own chrome. */}
        <section className="flex flex-col min-h-0">
          <div className="shrink-0 pb-2.5 flex items-baseline gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-brand-600">To-be state</span>
            <span className="text-[0.6875rem] text-ink-400">your template</span>
          </div>
          <div className="flex-1 overflow-y-auto -mx-2 px-2 pb-2">
            {reportChrome ? (
              <div className="rounded-lg shadow-[0_1px_2px_rgba(15,8,30,0.04),0_8px_24px_-12px_rgba(15,8,30,0.10)]" style={reportChrome.accent ? ({ '--rep-accent': reportChrome.accent } as CSSProperties) : undefined}>
                <ReportBrandBanner
                  title={reportChrome.title || 'Untitled Template'}
                  titleClassName="text-[1.375rem]"
                  className="rounded-t-lg"
                  gradient={reportChrome.gradient}
                  footer={
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
                <div className="border-x border-b border-canvas-border bg-canvas/60 rounded-b-lg px-5 py-3 flex items-center justify-center">
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
