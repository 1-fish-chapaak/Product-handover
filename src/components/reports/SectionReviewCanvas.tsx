// Shared "AI proposes, the human curates" review canvas — the BYOT review step.
// The uploaded document on the left, the detected skeleton on the right as a
// HIERARCHY: sections collapsed, blocks expandable beneath them. Every section
// carries a pre-filled one-line description and its TAG — the instruction the
// filling step reads, stated rather than offered, because a tag is not a
// preference. Being 80% right + a 2-minute fix beats chasing 100% automation;
// "Check this" flags jump the queue so the user fixes the doubtful 20%, not
// proof-reads everything.

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import {
  CornerDownRight, ChevronRight,
  GripVertical, ArrowUpToLine, ArrowDownToLine, Pencil, Lock, AlertTriangle,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { RowDeleteButton } from './RowDeleteButton';
import { ReportBrandBanner } from './ReportDocumentChrome';
import { sectionBlurb } from './reportShared';
import {
  TAG_GLOSSARY,
  fillTag,
  BLOCK_KIND_LABEL,
  SHAKY_CONFIDENCE,
  CHECK_REASON,
  type CanvasSection,
  type CanvasBlock,
  type TocCheck,
} from './sectionReviewShared';

/** A row is in the check queue when one of the four situations named it, or
 *  when the detector's own confidence was low. The flag is the better signal of
 *  the two, because it says WHAT to look at. */
const isShaky = (s: CanvasSection) =>
  s.evidence !== 'added'
  && (!!s.flag || (s.confidence !== undefined && s.confidence <= SHAKY_CONFIDENCE));

// ─── One block row inside an expanded section ───────────────────────────────
// A compact sample of the shape that was kept: type chip, label, and the
// structure that survives (columns, card fields, slot labels) — never values.
function BlockRow({ block, refSource, onOwnWording }: {
  block: CanvasBlock;
  /** When this block is a second placement, the section that holds the shape. */
  refSource?: string;
  /** The client makes authored wording theirs. Saving locks it like any other
   *  fixed text: the flag is gone and it prints as written from then on. */
  onOwnWording?: (lines: string[]) => void;
}) {
  const fillMeta = fillTag(block.fill, block.frame);
  const [draft, setDraft] = useState<string | null>(null);
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
        {(block.kind === 'narrative' || block.kind === 'callout') && block.fill === 'fixed' && (block.fixedBody?.length ?? 0) > 0 && draft === null && (
          <p className={`text-[0.6875rem] text-ink-500 ${block.authored ? '' : 'line-clamp-2'}`}><Lock size={9} className="inline mr-1" />{block.fixedBody!.join(' ')}</p>
        )}
        {/* WHOSE WORDS ARE THESE? Boilerplate in their old report was written by
            whoever ran that engagement, and printing another firm's voice on
            their own reports would certify an engagement that never happened.
            So it arrives as a draft, in their author's words, until the client
            says it speaks for them. Then it locks like any other fixed text. */}
        {block.fill === 'fixed' && block.authored && onOwnWording && (
          draft === null ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="flex-1 min-w-[14rem] text-[0.6875rem] text-mitigated-700 leading-relaxed">
                This wording came from the report's author, so check it still speaks for you.
              </p>
              <button
                onClick={() => setDraft((block.fixedBody ?? []).join('\n'))}
                className="shrink-0 px-2 py-0.5 rounded-full bg-mitigated-100 text-[0.625rem] font-semibold text-mitigated-800 hover:bg-mitigated-200 transition-colors cursor-pointer"
              >
                Make it ours
              </button>
              <button
                onClick={() => onOwnWording(block.fixedBody ?? [])}
                className="shrink-0 px-2 py-0.5 rounded-full text-[0.625rem] font-semibold text-ink-500 hover:bg-canvas transition-colors cursor-pointer"
              >
                It already does
              </button>
            </div>
          ) : (
            <div className="mt-1">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={Math.min(10, Math.max(3, draft.split('\n').length))}
                aria-label="Fixed wording"
                className="w-full resize-y rounded-md border border-canvas-border bg-white px-2 py-1.5 text-[0.6875rem] text-ink-700 leading-relaxed focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
              />
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => {
                    onOwnWording(draft.split('\n').map(l => l.trim()).filter(Boolean));
                    setDraft(null);
                  }}
                  className="px-2 py-0.5 rounded-full bg-brand-50 text-[0.625rem] font-semibold text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer"
                >
                  Save wording
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className="px-2 py-0.5 rounded-full text-[0.625rem] font-semibold text-ink-500 hover:bg-canvas transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <span className="text-[0.625rem] text-ink-400">Saved once, it prints exactly like this in every report.</span>
              </div>
            </div>
          )
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
function SectionRow({ section, index, total, flashed, registerRef, onRename, onDescribe, onDelete, onJump, onMerge, onWrapper, onOwnWording, refSources }: {
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
  onWrapper: (keep: boolean) => void;
  /** The client took ownership of one block's authored wording. */
  onOwnWording: (blockId: string, lines: string[]) => void;
  /** Block id → the section that stores its shape, for placements. */
  refSources?: Record<string, string>;
}) {
  const controls = useDragControls();
  const [expanded, setExpanded] = useState(false);
  const empty = !section.name.trim();
  const isDetected = section.source !== undefined || section.page !== undefined;
  const isFragment = section.evidence === 'fragment';
  const canMerge = isFragment && (index > 0 || index < total - 1);
  const blocks = section.blocks ?? [];
  const shaky = isShaky(section);
  const fill = section.fill ?? 'query';
  // Fixed wording whose only changing values are report details carries its
  // own tag, because what it makes happen at generation is different.
  const sectionTag = fillTag(fill, blocks.length > 0 && blocks.every(b => b.fill !== 'fixed' || b.frame));
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
          <span
            data-shaky
            title={section.flag ? CHECK_REASON[section.flag] : undefined}
            className="shrink-0 inline-flex items-center rounded-full bg-mitigated-50 text-mitigated-700 px-2 py-0.5 text-[0.625rem] font-semibold"
          >
            Check this
          </span>
        )}
        {/* The tag, stated rather than offered. It is not a preference: it is
            the instruction the filling step reads, and only ever one of the
            tags a read can produce. A dropdown here offered options the reader
            never assigns ("no data connected", "a person fills this") and left
            out one it does ("fixed frame with blanks"), so it asked the client
            to choose from a list that was not the model. Getting it wrong is
            handled where wrongness lives: the reason line underneath, the
            "check this" queue, and untick. */}
        {!empty && (
          <span
            title={sectionTag.hint}
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-semibold ${sectionTag.tint}`}
          >
            {sectionTag.label}
          </span>
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
        const unsummarised = !section.description
          && (section.flag === 'no-line' || blurb.startsWith('Describe what this section will cover'));
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
            {section.fillReason ?? `${sectionTag.label}. ${sectionTag.hint}`}
          </p>
          {/* The flag names the tension rather than reporting a doubt: "check
              this" on its own tells the user to look without telling them what
              at, which is the same as asking them to proof-read everything.
              A half yes is the exception: the detector already wrote the exact
              tension into the line above ("some of these captions are money"),
              so a second, vaguer sentence saying the same thing would only
              argue with it. */}
          {section.flag && section.flag !== 'half-yes' && !empty && (
            <p className="px-0.5 text-[0.6875rem] text-mitigated-700 leading-relaxed">
              {CHECK_REASON[section.flag]}
            </p>
          )}
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
              {blocks.map(b => (
                <BlockRow
                  key={b.id}
                  block={b}
                  refSource={b.ref ? refSources?.[b.ref] : undefined}
                  onOwnWording={lines => onOwnWording(b.id, lines)}
                />
              ))}
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
  notIncluded,
  unit = 'page',
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
    /** Their brand mark, read from the report they uploaded. */
    logo?: string;
  };
  /** Rendered pages of the uploaded document (data URLs) — the real thing. */
  pages?: string[];
  pageCount?: number;
  /** What the source counts in. A deck has slides, not pages, and calling a
   *  slide a page is exactly the kind of label that reads as broken. */
  unit?: 'page' | 'slide';
  /** The only valid sanity check — our list vs the report's own contents page. */
  toc?: TocCheck;
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
  const unitLabel = unit === 'slide' ? 'Slide' : 'Page';
  const shaky = useMemo(() => sections.filter(isShaky), [sections]);
  // A contents page was found and consumed: it is routed to the contents
  // builder rather than kept, and routing happens a stage before any check
  // runs. Counted entries are the proof it was there, so the client can see
  // what became of it instead of finding it simply gone.
  const routedContents = (toc?.docEntries ?? 0) > 0;

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
  // Authored wording, made theirs: the words they settled on are saved and the
  // flag clears, so from the next report on it prints as ordinary fixed text.
  const ownWording = (sectionId: string, blockId: string, lines: string[]) =>
    set(prev => prev.map(s => (s.id === sectionId
      ? {
          ...s,
          blocks: s.blocks?.map(b => (b.id === blockId
            ? { ...b, fixedBody: lines.length ? lines : b.fixedBody, authored: undefined }
            : b)),
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
  // Nothing is added here. This screen judges what the read found: confirm,
  // rename, reorder, untick. A part invented at review has no evidence behind
  // it and nothing bound to fill it, so it would print empty in every report
  // for ever — and a part left out here can never be filled later either, which
  // is what makes both directions the read's business rather than this screen's.
  // Anything the client still wants goes into one report at a time through Add
  // Observation, and gets promoted to the template deliberately from there.

  const jumpToFirstShaky = () => { if (shaky.length) jumpToSection(shaky[0].id); };

  const outlineBody = (
    <>
      {/* What the tags mean. Every part carries exactly one, and the tag is not
          decoration: it is the instruction the filling step reads. Here the
          client verifies it, at generation the engine obeys it, and when a
          capability grows only the tag changes. Folded shut so the list stays
          the screen, open for anyone asking what a badge does. */}
      <details className="mb-2 rounded-md border border-canvas-border bg-white px-3 py-2 group/tags">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[0.6875rem] font-semibold text-ink-600 hover:text-ink-900">
          <ChevronRight size={12} className="shrink-0 transition-transform group-open/tags:rotate-90" />
          What the tags mean
          <span className="font-normal text-ink-400">· every part carries exactly one, and it decides what happens at generation</span>
        </summary>
        <dl className="mt-2 space-y-1.5">
          {TAG_GLOSSARY.map(t => (
            <div key={t.label} className="flex items-start gap-2">
              <dt className={`mt-px shrink-0 inline-flex items-center rounded-full px-1.5 py-px text-[0.5625rem] font-semibold uppercase tracking-wide ${t.tint}`}>{t.label}</dt>
              <dd className="min-w-0 text-[0.6875rem] leading-relaxed text-ink-500">{t.does}</dd>
            </div>
          ))}
        </dl>
      </details>

      {/* The only valid sanity check, and it is relative: our list against the
          report's own contents page. A 40 section report with a 40 entry
          contents page is correct, not a failure. Much longer means we split
          too much; much shorter means we read it badly — and reading it badly
          is ours to fix, not the client's to patch by hand. */}
      {toc && (
        <div className={`mb-2 flex items-start gap-2 rounded-md border px-3 py-2 ${toc.verdict === 'match' ? 'border-compliant-200 bg-compliant-50/50' : 'border-mitigated-200 bg-mitigated-50/60'}`}>
          <p className={`text-[0.6875rem] leading-relaxed ${toc.verdict === 'match' ? 'text-compliant-800' : 'text-mitigated-800'}`}>
            {toc.verdict === 'match'
              ? <>Matches the report’s own contents page ({toc.detected} found, {toc.docEntries} listed).</>
              : toc.verdict === 'over-split'
                ? <>We found {toc.detected} sections and your own contents page lists {toc.docEntries}, so we have split some of them too far. The extra rows below are pieces inside another section: merge them into it, or untick them.</>
                : <>Your own contents page lists {toc.docEntries} sections and we only found {toc.detected}, so we did not read this one well. Save what we did find and add the rest one report at a time, or start over with a report more typical of your work.</>}
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
            onDelete={() => deleteSection(s.id)}
            onJump={() => jumpToSource(s.id)}
            onMerge={dir => mergeSection(s.id, dir)}
            onWrapper={keep => resolveWrapper(s.id, keep)}
            onOwnWording={(blockId, lines) => ownWording(s.id, blockId, lines)}
            refSources={refSources}
          />
        ))}
      </Reorder.Group>
      {/* Everything the template does not keep, said once, here, rather than
          discovered at export. The client covers these per report through Add
          Observation, which already carries name, description and evidence. */}
      {(notIncluded?.length ?? 0) + (routedContents ? 1 : 0) > 0 && (
        <div className="mt-3 rounded-lg border border-canvas-border bg-canvas px-3 py-2.5">
          <p className="text-[0.6875rem] font-semibold text-ink-700">
            The rest of your report ({(notIncluded?.length ?? 0) + (routedContents ? 1 : 0)})
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-ink-500 leading-relaxed">
            Everything that did not become a section, and what happened to it instead. Anything you still want goes in one report at a time through Add Observation.
          </p>
          {/* Each row carries its tag, because the tag is what decides its fate:
              a setting still prints, a routed part feeds the engine, and only a
              left-out part is really gone. */}
          <ul className="mt-2 space-y-1.5">
            {routedContents && (
              <li className="flex items-start gap-2">
                <span className="mt-px shrink-0 inline-flex items-center rounded-full bg-canvas text-ink-600 border border-canvas-border px-1.5 py-px text-[0.5625rem] font-semibold uppercase tracking-wide">Routed</span>
                <span className="min-w-0 text-[0.6875rem] leading-relaxed text-ink-400">
                  <span className="font-medium text-ink-500">Your contents page</span>
                  {' · '}Never copied. It feeds the contents page we build from your own sections.
                </span>
              </li>
            )}
            {(notIncluded ?? []).map((n, i) => (
              // A report can carry the same heading twice (one part running on
              // under its own title), so the name alone is not a key.
              <li key={`${n.name}-${i}`} className="flex items-start gap-2">
                <span className={`mt-px shrink-0 inline-flex items-center rounded-full px-1.5 py-px text-[0.5625rem] font-semibold uppercase tracking-wide ${n.captured ? 'bg-evidence-50 text-evidence-700' : 'bg-high-50 text-high-700'}`}>
                  {n.captured ? 'Setting' : 'Left out'}
                </span>
                <span className={`min-w-0 text-[0.6875rem] leading-relaxed ${n.captured ? 'text-ink-500' : 'text-ink-400'}`}>
                  <span className={`font-medium ${n.captured ? 'text-evidence-700' : 'text-ink-500'}`}>{n.name}</span>
                  {' · '}{n.why.replace(/^(Not included|Captured as a setting|Saved as a setting):\s*/, '')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="grid grid-cols-[2fr_3fr] gap-6 flex-1 min-h-0">
        {/* Left — the source document (the report as uploaded: the "as-is" state) */}
        <section className="flex flex-col min-h-0">
          <div className="shrink-0 pb-2.5 flex items-baseline gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-ink-500">As-is state</span>
            <span className="text-[0.6875rem] text-ink-400">the {unit === 'slide' ? 'deck' : 'report'} you uploaded</span>
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
                      title={first ? `Show this ${unit}’s first section in the detected list` : undefined}
                      className={`rounded-lg p-1 transition-colors duration-300 ${first ? 'cursor-pointer hover:bg-canvas/70' : ''} ${flashPage === pageNo ? 'bg-brand-600/[0.06] ring-1 ring-brand-600/25' : ''}`}
                    >
                      <img
                        src={src}
                        alt={`${unitLabel} ${pageNo} of the uploaded ${unit === 'slide' ? 'deck' : 'report'}`}
                        className="w-full rounded-md border border-canvas-border bg-white shadow-[0_1px_2px_rgba(15,8,30,0.04),0_8px_24px_-12px_rgba(15,8,30,0.10)]"
                      />
                      <figcaption className="mt-1 text-center text-[0.625rem] text-ink-400 tabular-nums">{unitLabel} {pageNo}{pageCount ? ` of ${pageCount}` : ''}</figcaption>
                    </figure>
                  );
                })}
                {pageCount !== undefined && pageCount > pages!.length && (
                  <p className="px-2 pb-1 text-center text-[0.625rem] text-ink-400 leading-relaxed">
                    Showing the first {pages!.length} {unit === 'slide' ? 'slides' : 'pages'}. All {pageCount} were read for structure.
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
                  logo={reportChrome.logo}
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
