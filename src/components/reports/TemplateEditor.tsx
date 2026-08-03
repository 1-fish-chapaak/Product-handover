// Template authoring + apply surfaces, extracted from ReportsView:
//   • TemplateEditor       — the brand/theme/header-footer/arrangement editor
//   • ApplyTemplateDropdown — pick a template to apply to an open report
//   • ReportSectionBlock — internal draggable report-styled section
// (mergeTemplateOptions lives in reportShared so this module exports only
//  components, keeping React Fast Refresh intact.)
// Depends only on the shared keystone, ReportDocumentChrome, and ConfirmDialog.

import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, useReducedMotion } from 'motion/react';
import {
  Check, ChevronRight, FileText, GripVertical,
  Loader2, Plus, X, Pencil, ShieldCheck, Trash2,
  BookOpen, Search, Upload, Maximize2, Minimize2,
  UploadCloud, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { REPORT_TEMPLATES } from '../../data/mockData';
import { ReportBrandBanner, ReportSignoffBlock, ReportClosingBlock } from './ReportDocumentChrome';
import ConfirmDialog from './ConfirmDialog';
import {
  ICON_MAP, CATEGORY_COLORS, TEMPLATE_THEME_GRADIENT, TEMPLATE_THEME_SWATCH,
  sectionBlurb, DEFAULT_WATERMARK, reportGradient, reportAccent, DEFAULT_SIGNATORIES,
  collectBlockLibrary, DEFAULT_TEMPLATE_BRAND, DEFAULT_THEME, defaultFooterText,
  proposeScaleMap, unusedScaleWords, OUR_SCALE,
  type EditableTemplate, type WatermarkConfig, type ScaleMap,
  type TemplateSection, type SignatorySlot, type TemplateBlock,
} from './reportShared';
import { readTemplateFromReport, classifyUpload, PAGE_CAP, type UploadKind } from './byot/byotRead';
import type { ReadResult, ReadOutcome } from './byot/byotRead';
import SectionReviewCanvas from './SectionReviewCanvas';
import { FormSelect } from '../shared/FilterSelect';
import MadeUpPreview from './byot/PreviewStep';
import { RowDeleteButton } from './RowDeleteButton';
import { renderSectionShape, sectionTypeLabel, type ShapeFill } from './templateSectionShape';
import { reviewChrome, belowTheReadFloor, type CanvasSection, type CanvasBlock } from './sectionReviewShared';
import { useAuditLog } from '../../context/AdminDataContext';

// Soft length guide for letterhead header/footer text — past this the counter
// turns amber and a hint warns about truncation, but saving is never blocked.
const LETTERHEAD_SOFT_MAX = 60;
// Hard cap on the template name — mirrors the letterhead 60-char counter, but
// enforced (a name this long overflows the cover and the picker rows).
const TEMPLATE_NAME_MAX = 60;

// Watermark placement → the flex alignment (+ edge padding) that pins the mark to
// that side of the page. Center is the default diagonal stamp.
const WATERMARK_POS: Record<'center' | 'top' | 'bottom' | 'left' | 'right', string> = {
  center: 'items-center justify-center',
  top: 'items-start justify-center pt-8',
  bottom: 'items-end justify-center pb-8',
  left: 'items-center justify-start pl-8',
  right: 'items-center justify-end pr-8',
};

// Plain field label — matches the platform's form convention (no per-field icon
// tile, which over-spent the brand accent). Optional right-aligned content
// (e.g. a character counter) and a required marker.
function FieldLabel({ children, right, required }: { children: ReactNode; right?: ReactNode; required?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <span className="text-[0.8125rem] font-semibold text-ink-800">
        {children}{required && <span className="ml-0.5 text-risk-600" title="Required">*</span>}
      </span>
      {right}
    </div>
  );
}

// Small uppercase group heading that structures the Details panel into sections.
function GroupEyebrow({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.13em] text-ink-400">{children}</span>
      {hint && <span className="text-[0.6875rem] text-ink-400">· {hint}</span>}
    </div>
  );
}

// A labelled range slider with a live value read-out (watermark controls).
function Slider({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[0.75rem] font-medium text-ink-600">{label}</span>
        <span className="text-[0.6875rem] tabular-nums text-ink-400">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 appearance-none rounded-full bg-canvas-border accent-brand-600 cursor-pointer"
      />
    </div>
  );
}

// A small on/off switch.
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0 ${checked ? 'bg-brand-600' : 'bg-ink-300'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ─── Bring Your Own Template, inside the editor ─────────────────────────────
// Building a template from a past report is the same journey here as it is on
// the Bring Your Own Template tab: one file, six reads, a review you actually
// do, then the format is yours. Same engine, same passes, same words — so a
// format read here and a format read there come out identical.
//
// One read, one question. Six separate reads means that when the result is
// wrong we can point at exactly which read failed instead of debugging magic.
const PDF_PASSES = [
  { title: 'Pull the text out', question: 'Every bit of text with its page, its spot, its size and its weight.' },
  { title: 'Take off tops and bottoms', question: 'Page numbers and “Confidential” stamps come off, and are saved as settings you check.' },
  { title: 'Find the headings', question: 'Big, rare and numbered means a heading. That gives the sections, in order.' },
  { title: 'Work out each block', question: 'Paragraph, table, row of numbers, box to fill in, highlighted note or chart?' },
  { title: 'Look for repeats', question: 'A shape that repeats is saved once and marked “as many as needed”.' },
  { title: 'The AI names things', question: 'What each section is for, and which words you use for how bad a problem is.' },
] as const;

// A deck runs the same six, but the first five have almost nothing to do: the
// file says outright which box is the title, which shape is a table and which
// layout repeats. Only the reading changes.
const DECK_PASSES = [
  { title: 'Open the slides', question: 'Every box with what PowerPoint calls it, where it sits and what it says.' },
  { title: 'Take off the running header', question: 'A box saying the same thing on every slide is a running header, even if it is the title box. It is saved as a setting.' },
  { title: 'Read the headings', question: 'The title box names the slide, and a divider slide names the run that follows it. Nothing to guess.' },
  { title: 'Work out each block', question: 'A table object is a table, with its real columns. Same for the rest of the boxes.' },
  { title: 'Look for repeats', question: 'One slide per finding, or a run of slides repeating together. Saved once, marked “as many as needed”.' },
  { title: 'The AI names things', question: 'What each part is for, and which words you use for how bad a problem is.' },
] as const;

// Each pass holds the screen long enough to read. The real parse resolves
// behind the list, so this is the floor on the wait, never the whole of it.
const PASS_MS = 900;
const SCAN_DURATION_MS = PDF_PASSES.length * PASS_MS;
// Fail a parse that hasn't settled by here, so the progress card can't hang.
// Kept well above SCAN_DURATION_MS so a slow but fine parse still lands.
const EXTRACT_TIMEOUT_MS = 60000;

// Two formats, both done well: the PowerPoint a client presents to a committee
// and the PDF they keep on file. A deck is the easier read of the two, because
// the file labels its own parts. Everything else converts to one of those in a
// click, nothing converts the other way, so the picker accepts .pptx and .pdf
// and stops advertising what we can't read. Word, the older binary .ppt and
// everything else get an honest way out instead of a fabricated outline.
const IMPORT_ACCEPT = '.pptx,.pdf';
const IMPORT_KIND_LABEL: Record<UploadKind, string> = { pdf: 'PDF', deck: 'PowerPoint' };
// Detected headings often carry their own enumerator ("1. Executive Summary",
// "2.1 Scope"). The outline already numbers every row with its own index badge,
// so we strip the leading enumerator to avoid a doubled "2. 1. Executive Summary".
function stripLeadingEnumerator(name: string): string {
  return name.replace(/^\s*(?:\d+(?:[.)]\d+)*[.)]?|[A-Za-z][.)]|[IVXLCM]+[.)])\s+/, '').trim() || name.trim();
}

// Non-blocking extraction progress card — a compact toast pinned to the VIEWPORT
// bottom-right (portaled to <body>, not inside the editor modal). It's the whole
// UI while the editor is minimized, so extraction keeps running with the app
// fully usable behind it. Shows an extracting state (with Minimize while the
// modal is open, or Open while minimized) and a done state (Open to review).
function ExtractionCard({
  filename, messages, done = false, sectionCount,
  progress = 0, msgIdx = 0,
  onMinimize, onOpen, onClose,
}: {
  filename: string;
  /** The pass titles, so the corner card narrates the same six reads the
      full-screen scan does. */
  messages: readonly string[];
  done?: boolean;
  sectionCount?: number;
  /** Controlled progress + message step — driven by the parent so the run stays
      continuous when switching between the full-modal overlay and this card. */
  progress?: number;
  msgIdx?: number;
  onMinimize?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <motion.div
      role="status"
      aria-label={done ? 'Extraction complete' : `Extracting ${filename}`}
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="fixed bottom-5 right-5 z-[80] w-[360px] max-w-[calc(100vw-2.5rem)] rounded-lg border border-canvas-border bg-white shadow-[0_16px_40px_-12px_rgba(15,8,30,0.28)] p-4"
    >
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${done ? 'bg-compliant-50 text-compliant-600' : 'bg-brand-50 text-brand-600'}`}>
          {done ? <Check size={16} strokeWidth={2.5} /> : <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[0.8125rem] font-semibold text-ink-900 leading-tight">{done ? 'Finished reading' : 'Reading your report'}</div>
          <div className="text-[0.75rem] text-ink-500 truncate mt-0.5">
            {done
              ? (sectionCount ? `${sectionCount} section${sectionCount === 1 ? '' : 's'} ready to check` : 'Ready to check')
              : (
                <AnimatePresence mode="wait">
                  <motion.span key={msgIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    {messages[msgIdx]}
                  </motion.span>
                </AnimatePresence>
              )}
          </div>
        </div>
        {!done && <span className="text-[0.8125rem] font-bold tabular-nums text-brand-700 shrink-0">{Math.round(progress)}%</span>}
        {onClose && (
          <button onClick={onClose} aria-label="Dismiss" className="w-7 h-7 -mr-1 -mt-0.5 rounded-full text-ink-400 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0"><X size={14} /></button>
        )}
      </div>
      {!done && (
        <div className="mt-3 h-1.5 rounded-full bg-brand-50 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-500 transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] text-ink-400">{done ? 'Open it to check what we found.' : 'Running in the background. Keep working.'}</span>
        {onOpen ? (
          <button onClick={onOpen} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[0.75rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 cursor-pointer transition-colors">
            <Maximize2 size={13} /> Open
          </button>
        ) : onMinimize ? (
          <button onClick={onMinimize} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[0.75rem] font-semibold text-ink-700 border border-canvas-border bg-white hover:bg-paper-50 cursor-pointer transition-colors">
            <Minimize2 size={13} /> Minimize
          </button>
        ) : null}
      </div>
    </motion.div>,
    document.body,
  );
}

// ─── Apply Template Dropdown ───
export function ApplyTemplateDropdown({ templates = REPORT_TEMPLATES, activeId = null, onSelect, onClose, onSaveAsTemplate }: { templates?: typeof REPORT_TEMPLATES[number][]; activeId?: string | null; onSelect: (template: typeof REPORT_TEMPLATES[0]) => void; onClose: () => void; onSaveAsTemplate?: () => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q
    ? templates.filter(rt => rt.name.toLowerCase().includes(q) || (rt.category ?? '').toLowerCase().includes(q))
    : templates;
  return (
    <motion.div
      initial={{ opacity: 0, y: -5, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.97 }}
      className="absolute right-0 top-full mt-1.5 w-[300px] bg-white rounded-lg shadow-[0_16px_40px_-12px_rgba(15,8,30,0.22)] border border-canvas-border z-50 overflow-hidden"
    >
      <div className="px-3.5 pt-3 pb-1">
        <span className="text-[0.6875rem] font-semibold text-ink-400 uppercase tracking-[0.12em]">Select Template</span>
      </div>
      {/* Search — clean filled field (no stroke), filters by name or category */}
      <div className="px-2.5 pt-1.5 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); if (query) setQuery(''); else onClose(); } }}
            placeholder="Search templates…"
            aria-label="Search templates"
            className="w-full h-9 pl-9 pr-8 rounded-md bg-canvas border border-canvas-border text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:bg-white focus:border-brand-600/40 transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 inline-flex items-center justify-center rounded-full text-ink-400 hover:text-ink-700 hover:bg-canvas-border/60 transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="max-h-[280px] overflow-y-auto px-1.5 pb-1.5 border-t border-canvas-border pt-1.5">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[0.75rem] text-ink-400">No templates match “{query.trim()}”.</div>
        ) : filtered.map(rt => {
          const Icon = ICON_MAP[rt.icon] || FileText;
          const isActive = rt.id === activeId;
          return (
            <button
              key={rt.id}
              onClick={() => { onSelect(rt); onClose(); }}
              aria-current={isActive || undefined}
              className={`group/item relative w-full text-left px-3 py-2.5 rounded-md transition-all duration-150 cursor-pointer flex items-center gap-2.5 ${isActive ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-brand-50'}`}
            >
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-brand-600" aria-hidden="true" />}
              <div className={`p-1.5 rounded-md transition-colors ${CATEGORY_COLORS[rt.category] || 'text-ink-500 bg-paper-50'}`}>
                <Icon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[0.75rem] truncate transition-colors ${isActive ? 'font-semibold text-brand-700' : 'font-medium text-ink-800 group-hover/item:text-brand-700'}`}>{rt.name}</div>
                <div className={`text-[0.75rem] transition-colors ${isActive ? 'text-brand-600/70' : 'text-ink-400 group-hover/item:text-ink-500'}`}>{rt.category}</div>
              </div>
              {isActive
                ? <Check size={14} className="shrink-0 text-brand-600" />
                : <ChevronRight size={14} className="shrink-0 text-brand-500 opacity-0 -translate-x-1 transition-all duration-150 group-hover/item:opacity-100 group-hover/item:translate-x-0" />}
            </button>
          );
        })}
      </div>
      {onSaveAsTemplate && (
        <div className="border-t border-canvas-border p-1.5">
          <button
            onClick={() => { onSaveAsTemplate(); onClose(); }}
            title="Save this report's structure as a reusable custom template"
            className="w-full text-left px-3 py-2.5 rounded-md transition-colors cursor-pointer flex items-center gap-2.5 hover:bg-brand-50 group/save"
          >
            <div className="p-1.5 rounded-md text-ink-500 bg-paper-50 group-hover/save:text-brand-600">
              <BookOpen size={12} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[0.75rem] font-medium text-ink-800 group-hover/save:text-brand-600">Save current as template…</div>
              <div className="text-[0.75rem] text-ink-400">Reuse this report's structure</div>
            </div>
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Template Editor Modal ───

// A section rendered as it prints in the report — an editorial numbered heading
// (zero-padded brand index + title + a short brand tick, matching the report
// reader) over a body placeholder shaped to the section's kind. It stays fully
// editable: a grip in the left margin drags to reorder (freely, in any
// direction — on release it snaps to the slot nearest the drop point), and a
// hover control removes it. Reordering drives the same `sections` state.

function ReportSectionBlock({ section, index, onMove, listRef, onDelete, onRename, onDescribe, blockLibrary, fill }: {
  section: TemplateSection;
  index: number;
  onMove: (from: number, to: number) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  onDelete: () => void;
  onRename: (name: string) => void;
  onDescribe: (description: string) => void;
  /** Blocks the template stores by id, so a placement resolves to its shape. */
  blockLibrary?: Record<string, TemplateBlock>;
  /** Made-up problems to draw the shapes with, when the preview is switched to
   *  show a filled report rather than an empty shape. */
  fill?: ShapeFill;
}) {
  // BYOT sections carry typed blocks — their body renders through the shared
  // shape renderer, and the chip says where the content comes from (fill case).
  const typeLabel = sectionTypeLabel(section);
  const controls = useDragControls();
  // Inline rename — a local draft keeps the field stable while typing (the parent
  // only hears the new name on commit), then Enter/blur saves and Escape reverts.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const startEdit = () => { setDraft(section.name); setEditing(true); requestAnimationFrame(() => inputRef.current?.select()); };
  const commitEdit = () => {
    const name = draft.trim();
    setEditing(false);
    if (name && name !== section.name) onRename(name);
  };
  // The description (body blurb) is editable too: it falls back to the auto blurb
  // until the author types their own, then persists on the section. Same inline
  // draft-then-commit pattern as the name.
  const fallbackDesc = sectionBlurb(section.name);
  const shownDesc = section.description ?? fallbackDesc;
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(shownDesc);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const startDescEdit = () => { setDescDraft(section.description ?? fallbackDesc); setEditingDesc(true); requestAnimationFrame(() => descRef.current?.select()); };
  const commitDesc = () => {
    const next = descDraft.trim();
    setEditingDesc(false);
    // Store only a real override; clearing back to the auto blurb drops it.
    if (next && next !== fallbackDesc) onDescribe(next);
    else if (!next || next === fallbackDesc) onDescribe('');
  };
  // The pencil edits BOTH at once: open the heading (focused) and the description
  // together. The description opens WITHOUT taking focus — otherwise moving focus
  // onto the heading blurs the textarea, fires commitDesc, and closes it (leaving
  // only the heading editable). Double-click still edits each field on its own.
  const startEditBoth = () => {
    setDescDraft(section.description ?? fallbackDesc);
    setEditingDesc(true);
    startEdit();
  };
  // The body placeholder — null for a plain prose section, where the editable
  // description takes its place.
  const shape = renderSectionShape(section, blockLibrary, shownDesc, fill);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ layout: { type: 'spring', stiffness: 420, damping: 36 }, duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      drag
      dragSnapToOrigin
      dragElastic={0.2}
      dragControls={controls}
      dragListener={false}
      whileDrag={{ scale: 1.01, zIndex: 50, boxShadow: '0 12px 30px rgba(15,8,30,0.16)' }}
      onDragEnd={(_, info) => {
        // Reorder by where the block was dropped: count how many *other* blocks
        // sit above the drop point → that's the new insertion index.
        const rows = listRef.current ? (Array.from(listRef.current.children) as HTMLElement[]) : [];
        const y = info.point.y;
        let target = 0;
        rows.forEach((r, ri) => {
          if (ri === index) return;
          const rect = r.getBoundingClientRect();
          if (y > rect.top + rect.height / 2) target += 1;
        });
        onMove(index, target);
      }}
      className="group relative border-x border-canvas-border bg-white px-9 py-6 transition-colors hover:bg-canvas/20"
    >
      {/* Drag grip — sits in the left margin, revealed on hover. */}
      <button
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Drag ${section.name} to reorder`}
        className="no-focus-ring absolute left-2.5 top-6 text-ink-300 hover:text-brand-600 cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-all"
      >
        <GripVertical size={15} />
      </button>
      {/* Edit + remove — revealed on hover, top-right. */}
      <div className="absolute right-4 top-5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={startEditBoth}
          aria-label={`Edit ${section.name}`}
          title="Edit heading and description"
          className="no-focus-ring w-7 h-7 flex items-center justify-center rounded-sm text-ink-400 hover:text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors"
        >
          <Pencil size={14} />
        </button>
        <RowDeleteButton
          onConfirm={onDelete}
          ariaLabel={`Delete ${section.name}`}
          triggerClassName="no-focus-ring w-7 h-7 flex items-center justify-center rounded-sm text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors"
        />
      </div>

      {/* Editorial numbered heading — matches the report reader. Double-click or the
          hover pencil turns it into an inline rename field. */}
      <div className="flex items-start justify-between gap-4 pr-16">
        <div className="flex items-baseline gap-3.5 min-w-0 flex-1">
          <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums tracking-[0.16em] leading-none" style={{ color: 'var(--rep-accent, #550fa5)' }}>{String(index + 1).padStart(2, '0')}</span>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              autoFocus
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                else if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
              }}
              onPointerDown={e => e.stopPropagation()}
              aria-label="Section name"
              className="min-w-0 flex-1 -my-0.5 px-1.5 py-0.5 rounded-sm bg-white border border-brand-400 text-[1.25rem] font-semibold text-ink-900 tracking-[-0.012em] leading-[1.15] focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            />
          ) : (
            <h2 onDoubleClick={startEdit} title="Double-click to rename" className="min-w-0 truncate text-[1.25rem] font-semibold text-ink-900 tracking-[-0.012em] leading-[1.15] cursor-text">{section.name}</h2>
          )}
        </div>
        {typeLabel && (
          <span className="shrink-0 inline-flex items-center rounded-full bg-evidence-50 text-evidence-700 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide">{typeLabel}</span>
        )}
      </div>
      <span className="mt-3 block h-[2px] w-8 rounded-full" style={{ backgroundColor: 'var(--rep-accent, rgba(136,56,222,0.8))' }} aria-hidden="true" />

      {/* Body placeholder — the shape of the content this section will hold. */}
      <div className="mt-4 pl-[1.9rem]">
        {shape ?? (editingDesc ? (
          <textarea
            ref={descRef}
            value={descDraft}
            rows={2}
            onChange={e => setDescDraft(e.target.value)}
            onBlur={commitDesc}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitDesc(); }
              else if (e.key === 'Escape') { e.preventDefault(); setEditingDesc(false); }
            }}
            onPointerDown={e => e.stopPropagation()}
            aria-label="Section description"
            className="w-full max-w-[80ch] resize-none rounded-sm bg-white border border-brand-400 px-2 py-1.5 text-[0.875rem] text-ink-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          />
        ) : (
          <p
            onDoubleClick={startDescEdit}
            title="Double-click to edit this description"
            className={`max-w-[80ch] text-[0.875rem] leading-relaxed cursor-text rounded-xs -mx-1 px-1 hover:bg-canvas/60 transition-colors ${section.description ? 'text-ink-600' : 'text-ink-500'}`}
          >
            {shownDesc}
          </p>
        ))}
      </div>
    </motion.div>
  );
}


export function TemplateEditor({ template, onClose, onCancel, onSaveNew, onSaveEdit, existingTemplateNames = [], existingStructures = [], initialName, openingNote }: { template: EditableTemplate; onClose: () => void; onCancel?: () => void; onSaveNew?: (created: EditableTemplate) => void; onSaveEdit?: (updated: EditableTemplate) => void; existingTemplateNames?: string[]; existingStructures?: { name: string; sectionNames: string[] }[]; initialName?: string; /** One honest line above the sheet when the builder was opened because a report read badly, rather than by choice. */ openingNote?: string }) {
  const { addToast } = useToast();
  // Cancel / X / discard route through onCancel (which may return to the
  // originating modal, e.g. the Generate wizard); a completed save uses onClose.
  const cancel = onCancel ?? onClose;
  // Seed from the template's saved branding when editing an existing custom
  // template; fall back to defaults for standard templates / new templates.
  // A brand-new template (BLANK_TEMPLATE) opens the same surface as Customize /
  // Edit, but it isn't "based on" anything — it's a create flow.
  const isNew = template.id === 'ct-blank';
  // The name field is shown in every flow (New / Edit), seeded to a sensible
  // default: an explicit initialName, or the template's own name when editing.
  // Cap the seeded name to the same 60-char limit the field enforces, so a long
  // auto-generated name doesn't start over the limit (counter red on open).
  const defaultName = (initialName ?? template.name).slice(0, TEMPLATE_NAME_MAX);
  const [copyName, setCopyName] = useState(defaultName);
  const [brand, setBrand] = useState(template.brand ?? DEFAULT_TEMPLATE_BRAND);
  const [theme, setTheme] = useState(template.theme ?? DEFAULT_THEME);
  // Custom brand colour (hex). Empty = use the named theme. When set (and valid)
  // it drives the cover gradient + body accent everywhere the report renders.
  // Importing a report samples this from the uploaded cover (the brand kit).
  const [brandColor, setBrandColor] = useState(template.brandColor ?? '');
  // The document's own rating language, captured at import (template settings).
  const [findingScale, setFindingScale] = useState<string[] | undefined>(template.findingScale);
  const [opinionScale, setOpinionScale] = useState<string[] | undefined>(template.opinionScale);
  // Their word for each of ours, proposed by the read and settled by the client
  // on the matching screen. Every rating a report prints goes through it.
  const [scaleMap, setScaleMap] = useState<ScaleMap>(template.scaleMap ?? {});
  /** What the right-hand pane draws: the empty shape, or the same shape with
   *  three invented findings in it. Never saved, never exported. */
  const [previewMode, setPreviewMode] = useState<'shape' | 'filled'>('shape');
  // The import walks the same two steps the Bring Your Own Template tab walks:
  // what we found, and a report in their format before any of it lands.
  // Said plainly when the read was too poor to be worth checking, and the
  // builder opened with what little we found instead of a check screen.
  const [badRead, setBadRead] = useState<string | null>(openingNote ?? null);
  // Cover gradient + accent for the live preview — the named theme, overridden
  // by the captured brand colour when present.
  const coverGradient = reportGradient(theme, brandColor) ?? TEMPLATE_THEME_GRADIENT[DEFAULT_THEME];
  const coverAccent = reportAccent(theme, brandColor);
  const [headerText, setHeaderText] = useState(template.headerText ?? '');
  // Footer auto-tracks the brand ("Generated by <brand>") until the author edits it
  // directly; an existing saved footer or an imported one counts as customised.
  const [footerText, setFooterText] = useState(template.footerText ?? defaultFooterText(template.brand));
  const [footerCustom, setFooterCustom] = useState(!!template.footerText);
  useEffect(() => {
    if (!footerCustom) setFooterText(defaultFooterText(brand));
  }, [brand, footerCustom]);
  // Page numbers on the exported report — on by default (undefined = on).
  const [pageNumbers, setPageNumbers] = useState(template.pageNumbers ?? true);
  // Sign-off block — off by default. Enabling seeds default signatory rows.
  const [signoffEnabled, setSignoffEnabled] = useState(template.signoffEnabled ?? false);
  const [signatories, setSignatories] = useState<SignatorySlot[]>(template.signatories ?? []);
  const toggleSignoff = (on: boolean) => {
    setSignoffEnabled(on);
    if (on && signatories.length === 0) setSignatories(DEFAULT_SIGNATORIES.map(s => ({ ...s })));
  };
  // Closing page — the "thank you" slide a committee deck ends on. Same kind of
  // thing as the sign-off block: shape, not writing, so there is nothing to
  // generate in it. Off unless their own report had one.
  const [closingEnabled, setClosingEnabled] = useState(template.closingEnabled ?? false);
  const [closingText, setClosingText] = useState<string[]>(template.closingText ?? []);
  const toggleClosing = (on: boolean) => {
    setClosingEnabled(on);
    if (on && closingText.length === 0) setClosingText(['Thank you']);
  };
  const cleanClosing = closingText.map(l => l.trim()).filter(Boolean);
  const addSignatory = () => setSignatories(prev => [...prev, { id: `sig-${Date.now()}`, role: '' }]);
  const updateSignatory = (id: string, patch: Partial<SignatorySlot>) => setSignatories(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  const removeSignatory = (id: string) => setSignatories(prev => prev.filter(s => s.id !== id));
  // Persisted signatory list: drop empty rows, trim, keep only real content.
  const cleanSignatories: SignatorySlot[] = signatories
    .filter(s => s.role.trim() || (s.name ?? '').trim())
    .map(s => ({ id: s.id, role: s.role.trim() || 'Signatory', ...(s.name?.trim() ? { name: s.name.trim() } : {}) }));
  const logEvent = useAuditLog();
  // Their brand mark on the letterhead. Read off an uploaded deck when there is
  // one, and replaceable here either way.
  const [logoDataUrl, setLogoDataUrl] = useState<string>(template.logoDataUrl ?? '');
  const logoInputRef = useRef<HTMLInputElement>(null);
  // Diagonal page watermark — the full-document branding.
  const [watermark, setWatermark] = useState<WatermarkConfig>(template.watermark ?? DEFAULT_WATERMARK);
  const watermarkImgInputRef = useRef<HTMLInputElement>(null);
  const setWm = (patch: Partial<WatermarkConfig>) => setWatermark(w => ({ ...w, ...patch }));
  // Read an uploaded image as a data URL (watermark image). 2 MB cap.
  const readImageFile = (file: File, onDone: (url: string) => void) => {
    if (!file.type.startsWith('image/')) { addToast({ type: 'error', message: 'Upload an image (PNG, JPG or SVG).' }); return; }
    if (file.size > 2 * 1024 * 1024) { addToast({ type: 'error', message: 'Image is too large — 2 MB max.' }); return; }
    const reader = new FileReader();
    reader.onload = () => onDone(reader.result as string);
    reader.readAsDataURL(file);
  };
  // Seed from the template's own sections when editing/customising; a brand-new
  // template starts EMPTY and is built up section by section.
  const seededSections = (template.sections && template.sections.length > 0)
    ? template.sections
    : [];
  const [sections, setSections] = useState(seededSections);
  // Left settings column is split into two segmented groups so the form reads as
  // a structured panel instead of a flat six-field stack.
  const [panel, setPanel] = useState<'identity' | 'branding'>('identity');
  // A new template opens on the question that actually matters first: do you
  // already have a report that looks the way you want, or are you building one?
  // Uploading one is the shorter road by a mile, so it leads. Editing an
  // existing template skips straight to the builder.
  // A new template opens on the two ways in — unless it arrives with sections
  // already in it, which means a report was read badly elsewhere and handed
  // here to build on. Offering "start from a report" again would be offering
  // the step that just failed.

  // ── Build this template from a past report ────────────────────────────────
  // The Bring Your Own Template journey, run inside the editor: upload one past
  // report, six reads take its shape apart, you review what was found beside
  // your own document, and the format lands here as a template you can still
  // tune. The words and numbers in the file are thrown away; only the shape
  // survives. Review is a real step, not a formality — being 80% right and
  // letting you fix the rest in two minutes is the design choice.
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [scanningName, setScanningName] = useState<string | null>(null);
  // Which reader is running, so the pass list names what it is actually doing.
  const [importKind, setImportKind] = useState<UploadKind>('pdf');
  const passes = importKind === 'deck' ? DECK_PASSES : PDF_PASSES;
  // Minimize-and-continue: when true the editor collapses to the bottom-right
  // extraction card and the full modal isn't rendered, so extraction keeps
  // running (this component stays mounted) with the app fully usable behind it.
  const [minimized, setMinimized] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMsgIdx, setImportMsgIdx] = useState(0);
  // Which read the pointer is over, so a client can open any of the six and
  // read what it does without waiting for it to come round.
  const [peekPass, setPeekPass] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  // Drive the extraction progress + status message here (not in the card) so the
  // same run feeds both the full-modal overlay and the minimized corner card —
  // progress stays continuous when the user minimizes/restores. An eased rAF loop
  // over SCAN_DURATION_MS (the same easeOutQuad the ATR flow uses) advances the
  // bar and steps the status; messages spread evenly across the run. Holds just
  // shy of 100% if the real parse outlasts the scan window.
  useEffect(() => {
    if (!importing) { setImportProgress(0); setImportMsgIdx(0); return; }
    const steps = PDF_PASSES.length;
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const t = Math.min(1, (now - start) / SCAN_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 2);
      setImportProgress(Math.min(99, eased * 100));
      setImportMsgIdx(Math.min(steps - 1, Math.floor(t * steps)));
      if (t < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [importing]);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  // Drag-and-drop: drop a report anywhere on the editor to import it. A depth
  // counter avoids the flicker that dragenter/dragleave cause over child nodes.
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  // After the read finishes the detected sections land in the shared review
  // canvas beside the pages of the uploaded document. Nothing touches the
  // outline until it is confirmed there, which is the Bring Your Own Template
  // rule: the reader proposes, the human decides. pendingImport drives the
  // canvas; reviewSections is its working copy while open.
  const [pendingImport, setPendingImport] = useState<{ fileName: string; kind: UploadKind; result: ReadResult | null } | null>(null);
  const [reviewSections, setReviewSections] = useState<CanvasSection[]>([]);
  /** What the read proposed, frozen the moment the check screen opened. The
   *  counting on that screen is the difference between this and what the client
   *  ends up confirming, and there is nowhere else to get it from once they
   *  start renaming rows. */
  const [reviewBaseline, setReviewBaseline] = useState<CanvasSection[]>([]);
  // Once confirmed, a banner sits over the outline with what was captured, a
  // way back into the review canvas, and one-tap Undo of the whole import.
  type ImportSnapshot = {
    sections: typeof sections; headerText: string; footerText: string; brand: string; copyName: string; importedFrom: string | null;
    brandColor: string; findingScale?: string[]; opinionScale?: string[]; signoffEnabled: boolean; signatories: SignatorySlot[];
    closingEnabled: boolean; closingText: string[]; logoDataUrl: string;
  };
  const [importBanner, setImportBanner] = useState<
    { fileName: string; kind: UploadKind; result: ReadResult | null; detected: CanvasSection[]; count: number; gotLetterhead: boolean; captured: string[] } | null
  >(null);
  // The state as it was just before the import applied, so Undo is exact.
  const preImportRef = useRef<ImportSnapshot | null>(null);

  // Apply a section list + captured letterhead to the editor. Shared by the
  // initial optimistic import and the on-demand Review confirm. Empty-named rows
  // are dropped; placeholder blocks (kpi/chart/table) keep their type + label.
  // Returns a template name unique against existing names (case-insensitive),
  // ignoring the template being edited. Suffixes " (2)", " (3)"… on collision.
  const uniqueTemplateName = (name: string): string => {
    const own = isNew ? null : template.name.toLowerCase();
    const taken = new Set(existingTemplateNames.map(n => n.toLowerCase()).filter(n => n !== own));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 100; i++) {
      const cand = `${name} (${i})`;
      if (!taken.has(cand.toLowerCase())) return cand;
    }
    return name;
  };

  const applyToOutline = (
    secs: CanvasSection[], result: ReadResult | null, fileName: string,
  ): { count: number; gotLetterhead: boolean; captured: string[] } => {
    // Pass 2's furniture lands as pre-filled template settings — the user
    // verifies them here instead of typing them in.
    const hf = result?.furniture;
    if (hf?.confidentiality || hf?.header.length) setHeaderText(hf.confidentiality || hf.header.join('  ·  '));
    // Apply the PDF's own footer when it has one, and mark it customised so the
    // "footer follows brand" effect doesn't immediately overwrite it back to
    // "Generated by <brand>".
    if (hf?.footer.length) { setFooterText(hf.footer.join('  ·  ')); setFooterCustom(true); }
    if (hf?.fields.auditEntity) setBrand(hf.fields.auditEntity);
    // Brand kit: the dominant colour sampled from the uploaded cover drives the
    // template's cover gradient + accent (clearable in Branding).
    const captured: string[] = [];
    if (result?.coverColor) { setBrandColor(result.coverColor); captured.push('brand colour'); }
    // The document's own rating language becomes a template setting — generated
    // reports speak these words, not ours.
    if (result?.findingScale) { setFindingScale(result.findingScale); captured.push('rating scale'); }
    if (result?.opinionScale) { setOpinionScale(result.opinionScale); captured.push('opinion scale'); }
    // A detected sign-off block (signature slots) turns on the template's
    // existing signature block, seeded with the document's own roles — it isn't
    // duplicated as a prose section.
    const signRolesOf = (s: CanvasSection) => (s.blocks ?? []).find(b => b.kind === 'signoff' && (b.signRoles?.length ?? 0) > 0)?.signRoles;
    const signRoles = result?.signoff?.roles ?? secs.map(signRolesOf).find(Boolean);
    if (signRoles) {
      setSignoffEnabled(true);
      setSignatories(signRoles.map((role, i) => ({ id: `sig-imp-${i}`, role })));
      captured.push(`${signRoles.length} signature slot${signRoles.length === 1 ? '' : 's'}`);
    }
    // A closing page is captured the same way and for the same reason: the
    // shape is the whole feature, so it prints as it is at the end of every
    // report rather than being generated.
    if (result?.closing?.lines.length) {
      setClosingEnabled(true);
      setClosingText(result.closing.lines);
      captured.push('closing page');
    }
    // Their mark off the deck's own master. A picture repeating in the same
    // place slide after slide is the brand, by the same rule that finds the
    // running header.
    if (result?.logo) { setLogoDataUrl(result.logo); captured.push('logo'); }
    // Name: only fill if still the untouched default, and never fill a name that
    // already exists — a fresh import landing on an instant "already exists" error
    // reads as a failure. Suffix "(2)", "(3)"… until unique.
    const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (copyName === defaultName) {
      const candidate = hf?.fields.auditTitle || base.replace(/\b\w/g, c => c.toUpperCase());
      setCopyName(uniqueTemplateName(candidate).slice(0, TEMPLATE_NAME_MAX));
    }
    // Sections that are ONLY a sign-off block moved into the signature block
    // above; wrapper paperwork the user didn't keep is excluded here too —
    // with the review row's confirmation, never silently.
    const kept = secs.filter(s =>
      s.name.trim() &&
      !s.wrapper &&
      !((s.blocks ?? []).length > 0 && (s.blocks ?? []).every(b => b.kind === 'signoff')));
    const toTemplateBlock = (b: CanvasBlock): TemplateBlock => {
      // Strip the review-only detection facts; the persisted skeleton keeps
      // shape + labels only.
      const { id, confidence, page, preview, ...block } = b;
      void id; void confidence; void page; void preview;
      return block;
    };
    setSections(kept.map(s => ({
      name: s.name.trim(),
      icon: 'file-text',
      ...(s.description ? { description: s.description } : {}),
      ...(s.fill ? { fill: s.fill } : {}),
      ...(s.binding ? { binding: s.binding } : {}),
      ...(s.blocks?.length ? { blocks: s.blocks.map(toTemplateBlock) } : {}),
    })));
    setImportedFrom(fileName);
    return { count: kept.length, gotLetterhead: !!hf, captured };
  };

  const handleImportFile = async (file: File) => {
    const kind = classifyUpload(file.name);
    // Every decline is said out loud, and each one names the way out of it.
    // Never a fabricated outline.
    if (kind === 'word') {
      addToast({ type: 'info', message: 'Word files come later. Save it as a PDF (File → Save as PDF) and upload that.' });
      return;
    }
    if (kind === 'legacy-ppt') {
      addToast({ type: 'info', message: 'That is an older .ppt, which is a different file format. Open it in PowerPoint, save it as .pptx and upload that.' });
      return;
    }
    if (kind === 'spreadsheet') {
      addToast({ type: 'info', message: 'A spreadsheet has no report format in it. Upload a past report as a PowerPoint or a PDF.' });
      return;
    }
    if (!kind) {
      addToast({ type: 'error', message: 'Upload one past report as a PowerPoint (.pptx) or a PDF. Those are the two we can read.' });
      return;
    }

    // Read the file for real. One engine for both shapes: a deck goes to the
    // PowerPoint reader, a PDF to the PDF one, and the template that comes out
    // is identical either way, because only the reading differs.
    setImportKind(kind);
    setImporting(true);
    setScanningName(file.name);
    // The six passes play in full; the parse resolves behind them. A timeout
    // guards a hung read (the pdf.js worker failing to load, say) so the
    // progress card can't stick forever — it falls through to the decline path.
    let outcome: ReadOutcome;
    try {
      const [res] = await Promise.all([
        Promise.race<ReadOutcome>([
          readTemplateFromReport(file),
          new Promise<ReadOutcome>((_, reject) =>
            setTimeout(() => reject(new Error('extract-timeout')), EXTRACT_TIMEOUT_MS)),
        ]),
        new Promise(resolve => setTimeout(resolve, SCAN_DURATION_MS)),
      ]);
      outcome = res;
    } catch {
      outcome = { ok: false, reason: 'unreadable' };
    } finally {
      setImporting(false);
      setScanningName(null);
    }
    if (!outcome.ok) {
      // Restore the editor if it was minimized, so the failure isn't hidden
      // behind a card that would otherwise read as "complete". Each decline
      // reason gets its own honest message — never a silent failure.
      setMinimized(false);
      const message =
        outcome.reason === 'password' ? `“${file.name}” is password protected. Remove the password and upload it again.`
        : outcome.reason === 'scanned' ? 'This looks like a scan, so there is no text inside, only a picture. Please upload the original PDF.'
        : outcome.reason === 'empty-deck' ? 'Every slide in this deck is a picture, so there is no text to read. Upload the deck you actually edit in PowerPoint.'
        : outcome.reason === 'legacy-ppt' ? 'That is an older .ppt. Open it in PowerPoint and save it as .pptx, then upload that.'
        // "Upload a shorter one, typical of your work" was a lie for half the
        // corpus: there is no short version of a 276-slide SOP, and 16 of 35
        // real files came back too long. Until the cap itself is settled, the
        // message says what is true — this is our limit, not their file's
        // fault — and points at the one thing that actually works today.
        : outcome.reason === 'too-long' ? `We read up to ${PAGE_CAP} ${kind === 'deck' ? 'slides' : 'pages'} and this one is ${outcome.pageCount}. If you have a shorter report in the same format, that will build the same template. If you do not, tell us: raising this is on our list.`
        : outcome.reason === 'too-large' ? `“${file.name}” is too big to read here. Keep it under 30 MB.`
        : `We could not read “${file.name}”. Try saving it again from ${kind === 'deck' ? 'PowerPoint' : 'the tool you wrote it in'} and uploading that.`;
      addToast({ type: 'error', message });
      return;
    }
    const result = outcome.result;
    // Their word for each of ours, matched off their own scale as soon as the
    // read lands, and saved with the template. Where a rating of ours has no
    // plain match, `sayRating` falls back to their scale by position, so a
    // report never prints our wording in their document.
    if (result.findingScale?.length) setScaleMap(proposeScaleMap(result.findingScale));
    // The engine's hierarchical output → review rows: a section with its typed
    // blocks, pre-filled description, and guessed fill case intact.
    const detected: CanvasSection[] = result.sections.map((s, i) => ({
      id: `imp-${i}-${s.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: stripLeadingEnumerator(s.name),
      description: s.description,
      evidence: s.evidence,
      fill: s.fill,
      fillReason: s.fillReason,
      binding: s.binding,
      blocks: s.blocks.map((b, bi) => ({ ...b, id: `imp-${i}-b${bi}` })),
      confidence: s.confidence,
      flag: s.flag,
      page: s.page,
      appendix: s.appendix,
      wrapper: s.wrapper,
      source: s.source,
    }));

    // Name it now, not on confirm: the letterhead they are approving in review
    // has to carry their own title, or they approve a preview that lies. Their
    // document's title wins; the filename is the fallback. Never a name that is
    // already taken, so a fresh read can't land on an instant "already exists".
    if (copyName === defaultName) {
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      const candidate = result.furniture?.fields.auditTitle || base.replace(/\b\w/g, c => c.toUpperCase());
      setCopyName(uniqueTemplateName(candidate).slice(0, TEMPLATE_NAME_MAX));
    }

    // Below the floor there is not enough to check: two parts out of fifteen
    // makes the review canvas a pretence. Skip it, put what we did find into
    // the outline, and say plainly that we read it badly.
    if (belowTheReadFloor(result)) {
      const claimed = result.toc?.docEntries ?? 0;
      applyToOutline(detected, result, file.name);
      setBadRead(
        `We could not read ${file.name} well. We found ${detected.length} ${detected.length === 1 ? 'part' : 'parts'}`
        + `${claimed >= 6 ? ` out of the ${claimed} your contents page lists` : ''}, which is too little to check `
        + 'against your document, so this is the builder with what we found. Everything else is yours to add.',
      );
      return;
    }

    // Review is where the import lands, not the outline. Nothing is applied
    // until it is confirmed beside the pages of the real document.
    setReviewSections(detected);
    setReviewBaseline(detected);
    setPendingImport({ fileName: file.name, kind, result });

    // Headings with nothing beneath them aren't turned into sections, but they
    // are never dropped in silence either: say so, and offer a one-tap add-back.
    const skipped = result?.skipped ?? [];
    if (skipped.length > 0) {
      // Said, never silently dropped, and with no way to add it back here: a
      // heading with nothing underneath is not a section, and inventing one at
      // review would print an empty part in every report from then on.
      addToast({
        type: 'info',
        message: `${skipped.length} heading${skipped.length === 1 ? ' had' : 's had'} nothing underneath, so ${skipped.length === 1 ? 'it was' : 'they were'} left out: ${skipped.map(s => `"${s}"`).join(', ')}.`,
      });
    }
  };

  // Remove the imported file — revert the whole import (sections + letterhead +
  // name) to the pre-import snapshot. The banner's X routes here through a
  // confirmation, so removing an upload is deliberate, never an accidental tap.
  const undoImport = () => {
    const snap = preImportRef.current;
    if (snap) {
      setSections(snap.sections);
      setHeaderText(snap.headerText);
      setFooterText(snap.footerText);
      setBrand(snap.brand);
      setCopyName(snap.copyName);
      setImportedFrom(snap.importedFrom);
      setBrandColor(snap.brandColor);
      setFindingScale(snap.findingScale);
      setOpinionScale(snap.opinionScale);
      setSignoffEnabled(snap.signoffEnabled);
      setSignatories(snap.signatories);
      setClosingEnabled(snap.closingEnabled);
      setClosingText(snap.closingText);
      setLogoDataUrl(snap.logoDataUrl);
    }
    preImportRef.current = null;
    setImportBanner(null);
    setPendingImport(null);
    setReviewSections([]);
    addToast({ type: 'info', message: 'Imported file removed.' });
  };
  // Cancel the review. Before anything has been applied that means discarding
  // the read altogether, so it says so; afterwards it just closes the canvas.
  const cancelImport = () => {
    setPendingImport(null);
    if (!importBanner) setReviewSections([]);
  };
  // Confirm the review: the curated sections become the outline, the captured
  // settings become template settings, and the banner takes over with Undo.
  const applyImport = () => {
    if (!pendingImport) return;
    // Snapshot the state as it was before the first apply, so Undo is exact.
    if (!importBanner) {
      preImportRef.current = { sections, headerText, footerText, brand, copyName, importedFrom, brandColor, findingScale, opinionScale, signoffEnabled, signatories, closingEnabled, closingText, logoDataUrl };
    }
    const { count, gotLetterhead, captured } = applyToOutline(reviewSections, pendingImport.result, pendingImport.fileName);
    setImportBanner({
      fileName: pendingImport.fileName, kind: pendingImport.kind, result: pendingImport.result,
      detected: reviewSections, count, gotLetterhead, captured,
    });
    setPendingImport(null);
  };

  // One block printed in two places is stored once; every other placement
  // points at it, so the preview resolves both to the same shape.
  const blockLibrary = collectBlockLibrary(sections);

  const [newSectionName, setNewSectionName] = useState('');
  // The moment they touch the composer they have chosen to write the format
  // themselves, so the upload offer stops being the answer and becomes a tool:
  // it leaves the page and reappears as the footer button. Sticky, because a
  // block that came back on every blur would jump the page under their cursor.
  const [writingByHand, setWritingByHand] = useState(false);
  const addSection = () => {
    const name = newSectionName.trim();
    if (!name) return;
    if (sections.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      addToast({ type: 'error', message: `Section "${name}" already exists.` });
      return;
    }
    setSections(prev => [...prev, { name, icon: 'file-text' }]);
    setNewSectionName('');
  };
  // Rename a section in place — keyed by index so duplicate names stay distinct.
  const renameSection = (index: number, name: string) => {
    setSections(prev => prev.map((s, i) => (i === index ? { ...s, name } : s)));
  };
  // Set (or clear, with '') the section's custom description.
  const describeSection = (index: number, description: string) => {
    setSections(prev => prev.map((s, i) => (i === index ? { ...s, description: description || undefined } : s)));
  };
  // Move a section from one index to another (drag-drop reorder).
  const moveSection = (from: number, to: number) => {
    if (to < 0 || to >= sections.length || to === from) return;
    setSections(prev => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  // Remove a section — reversible, not a silent drop (matches the review canvas).
  // Keyed by index so duplicate names can't delete the wrong row, and Undo
  // restores it at its original position.
  const removeSection = (index: number) => {
    const removed = sections[index];
    if (!removed) return;
    setSections(prev => prev.filter((_, i) => i !== index));
    addToast({
      type: 'info',
      // Persistent — the Undo stays until acted on or dismissed, so a delete is
      // never a point of no return (#4).
      persist: true,
      message: `Removed “${removed.name || 'Untitled section'}”.`,
      secondaryAction: {
        label: 'Undo',
        onClick: () => setSections(prev => {
          const next = prev.slice();
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        }),
      },
    });
  };
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ field: 'copyName' | 'brand' | 'sections'; label: string }[]>([]);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  // The X on the post-import banner is the single "remove the uploaded file"
  // action — it reverts the whole import, guarded by a confirmation (destructive).
  const [confirmRemoveImport, setConfirmRemoveImport] = useState(false);
  // Near-duplicate structure warning (§9) — the section overlap with the closest
  // existing template, surfaced at save to kill "Copy of…" sprawl.
  const [dupConfirm, setDupConfirm] = useState<{ name: string; shared: number; total: number } | null>(null);
  // Soft advisory at save (non-blocking): the suggested sections not yet added.
  // A template built without them tends to generate incomplete, so we surface the
  // gap on "Create" but always let the author proceed.
  const nearDuplicate = (): { name: string; shared: number; total: number } | null => {
    const mine = sections.map(s => s.name.toLowerCase());
    if (mine.length < 3) return null;
    for (const other of existingStructures) {
      const theirs = other.sectionNames.map(n => n.toLowerCase());
      if (theirs.length < 3) continue;
      const shared = mine.filter(m => theirs.includes(m)).length;
      if (shared / Math.max(mine.length, theirs.length) >= 0.8) return { name: other.name, shared, total: mine.length };
    }
    return null;
  };

  const copyNameRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLInputElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const sectionsListRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initial state captured once at mount for dirty-detection. Lazy useState (not
  // a ref) so it's safe to read during render — the snapshot never changes after
  // mount, so the setter is intentionally unused.
  const [initial] = useState(() => ({
    copyName: defaultName,
    brand: template.brand ?? DEFAULT_TEMPLATE_BRAND,
    theme: template.theme ?? DEFAULT_THEME,
    brandColor: template.brandColor ?? '',
    findingScale: template.findingScale,
    opinionScale: template.opinionScale,
    scaleMap: template.scaleMap ?? {},
    headerText: template.headerText ?? '',
    footerText: template.footerText ?? defaultFooterText(template.brand),
    sections: seededSections,
    watermark: template.watermark ?? DEFAULT_WATERMARK,
    pageNumbers: template.pageNumbers ?? true,
    signoffEnabled: template.signoffEnabled ?? false,
    signatories: template.signatories ?? [],
    closingEnabled: template.closingEnabled ?? false,
    closingText: template.closingText ?? [],
    logoDataUrl: template.logoDataUrl ?? '',
  }));
  /** The template exactly as it stands, in the shape the sheet renderer reads.
   *  Assembled from the same fields the save writes, so the made-up preview
   *  cannot show a page the save would not produce. */
  const liveTemplate: EditableTemplate = {
    ...template,
    name: copyName || 'Untitled Template',
    sections,
    brand: brand.trim(),
    theme,
    brandColor: brandColor || undefined,
    findingScale,
    opinionScale,
    scaleMap: Object.keys(scaleMap).length > 0 ? scaleMap : undefined,
    headerText,
    footerText: footerText || defaultFooterText(brand),
    watermark,
    pageNumbers,
    signoffEnabled,
    signatories,
    closingEnabled,
    closingText,
    logoDataUrl: logoDataUrl || undefined,
  };
  /* THE MATCHING SCREEN, on the check screen beside the to-be template. Their
     rating words are a property of the format the client is approving, not a
     setting to be found afterwards, so it is rendered into the review canvas.
     The easy ones arrive filled in from `proposeScaleMap`; this is
     verify-and-sort, not data entry, and the "ours" side is `OUR_SCALE`, the
     same list the severity picker reads. */
  // The scales come from the READ while the check screen is up: the editor's
  // own state is only filled once the format is applied, so reading it here
  // left the panel empty on the one screen it belongs to.
  const rwFinding = pendingImport?.result?.findingScale ?? findingScale;
  const rwOpinion = pendingImport?.result?.opinionScale ?? opinionScale;
  const ratingWordsPanel = (rwFinding?.length || rwOpinion?.length) ? (
    <>
                {/* THE MATCHING SCREEN. Our three words against theirs, which
                    is the one thing about their scale we cannot work out on our
                    own: we can read that a report grades things Significant /
                    Moderate / Minor, but only the client knows which of those
                    they would call a High. The easy ones arrive filled in from
                    `proposeScaleMap`, so this is verify-and-sort, not data
                    entry, and the "ours" side is `OUR_SCALE` — the same list
                    the severity picker reads, from one place, so the two can
                    never drift. Until this existed the map was proposed at
                    import, saved, and never once shown to the person who is the
                    only authority on it. */}
                  <div className="mt-5 pt-4 border-t border-canvas-border">
                    <GroupEyebrow hint="captured from your report">Rating words</GroupEyebrow>
                    {rwFinding && rwFinding.length > 0 && (
                      <>
                        <p className="mb-2.5 text-[0.6875rem] leading-relaxed text-ink-500">
                          Your word for each of ours. Every report swaps through this, so your document never prints our wording.
                        </p>
                        <div className="space-y-1.5">
                          {OUR_SCALE.map(o => (
                            <div key={o.value} className="flex items-center gap-2">
                              <span className="flex w-[4.25rem] shrink-0 items-center gap-1.5 text-[0.75rem] font-medium text-ink-700">
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${o.dot}`} aria-hidden="true" />
                                {o.label}
                              </span>
                              <ArrowRight size={12} className="shrink-0 text-ink-300" aria-hidden="true" />
                              <FormSelect
                                value={scaleMap[o.value] ?? ''}
                                options={[{ value: '', label: 'Not used' }, ...rwFinding.map(w => ({ value: w, label: w }))]}
                                onChange={v => setScaleMap(m => {
                                  const next = { ...m };
                                  // One of their words per rating of ours. Pointing
                                  // two of ours at one of theirs makes the swap
                                  // ambiguous in the other direction, so the earlier
                                  // claim is released rather than silently doubled.
                                  if (v) for (const k of Object.keys(next) as (keyof ScaleMap)[]) {
                                    if (next[k] === v) delete next[k];
                                  }
                                  if (v) next[o.value] = v; else delete next[o.value];
                                  return next;
                                })}
                                ariaLabel={`Your word for ${o.label}`}
                                className="h-8 min-w-0 flex-1 rounded-md border border-canvas-border bg-white px-2.5 text-[0.75rem] text-ink-900"
                              />
                            </div>
                          ))}
                        </div>
                        {/* The odd ones. A client using four levels against our
                            three always has a leftover, and it is their call
                            what happens to it, not ours to guess. */}
                        {unusedScaleWords(rwFinding, scaleMap).length > 0 && (
                          <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-400">
                            {unusedScaleWords(rwFinding, scaleMap).join(', ')} {unusedScaleWords(rwFinding, scaleMap).length === 1 ? 'is a level' : 'are levels'} your report has and we never raise. Point one of ours at it, or leave it and no report will use it.
                          </p>
                        )}
                      </>
                    )}
                    {rwOpinion && (
                      <div className={rwFinding?.length ? 'mt-4 border-t border-canvas-border pt-3' : ''}>
                        {/* Not matched, because the overall verdict is not one
                            of ours to raise. Captured so the report prints their
                            word where their report printed one. */}
                        <span className="mb-1 block text-[0.6875rem] font-semibold text-ink-600">Overall opinion</span>
                        <div className="flex flex-wrap gap-1">
                          {rwOpinion.map(w => (
                            <span key={w} className="inline-flex items-center rounded-full border border-canvas-border bg-canvas px-2 py-0.5 text-[0.6875rem] font-medium text-ink-700">{w}</span>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-ink-400">Your words for the verdict on the whole audit. We do not write that one, so there is nothing to match.</p>
                      </div>
                    )}
                  </div>
    </>
  ) : null;

  const isDirty =
    copyName !== initial.copyName ||
    brand !== initial.brand ||
    theme !== initial.theme ||
    brandColor !== initial.brandColor ||
    findingScale !== initial.findingScale ||
    opinionScale !== initial.opinionScale ||
    // Sorting the odd rating word is an edit like any other, and leaving it out
    // of here meant a client could match their scale and find Save still greyed.
    scaleMap !== initial.scaleMap ||
    headerText !== initial.headerText ||
    footerText !== initial.footerText ||
    sections !== initial.sections ||
    watermark !== initial.watermark ||
    pageNumbers !== initial.pageNumbers ||
    signoffEnabled !== initial.signoffEnabled ||
    signatories !== initial.signatories ||
    closingEnabled !== initial.closingEnabled ||
    closingText !== initial.closingText ||
    logoDataUrl !== initial.logoDataUrl;

  // Inline duplicate-name check (#4) — warn before save, not only on submit. An
  // existing template's own name isn't "taken"; only a real collision is.
  const nameTaken = !!copyName.trim() && existingTemplateNames.some(
    n => n.toLowerCase() === copyName.trim().toLowerCase() && (isNew || n.toLowerCase() !== template.name.toLowerCase()),
  );

  const attemptClose = () => {
    if (isDirty && !isSaving) {
      setShowAbandonConfirm(true);
    } else {
      cancel();
    }
  };
  useFocusTrap(containerRef, !minimized, attemptClose);

  // Only surface a validation chip while its condition still holds. Adding a
  // section (or typing a name/brand) clears its banner immediately, instead of
  // leaving a stale "At least one section" until the next save attempt. Derived,
  // not stored, so there's no setState-in-effect.
  const activeErrors = errors.filter(e =>
    e.field === 'copyName' ? !copyName.trim()
    : e.field === 'brand' ? !brand.trim()
    : !sections || sections.length === 0,
  );

  // Land focus in the name field as the builder opens and select its text, so
  // typing replaces the "Untitled Template" default rather than shipping it
  // verbatim (#1).
  useEffect(() => {
    const t = setTimeout(() => { const el = copyNameRef.current; if (el) { el.focus(); el.select(); } }, 80);
    return () => clearTimeout(t);
  }, []);

  const fieldRefs: Record<string, React.RefObject<HTMLElement | null>> = {
    copyName: copyNameRef,
    brand: brandRef,
    sections: sectionsRef,
  };

  const handleSave = (skipDup = false) => {
    // Required-field validation: name + brand are required; sections non-empty.
    const next: { field: 'copyName' | 'brand' | 'sections'; label: string }[] = [];
    if (!copyName.trim()) next.push({ field: 'copyName', label: 'Template Name' });
    if (!brand.trim()) next.push({ field: 'brand', label: 'Organisation Name' });
    if (!sections || sections.length === 0) next.push({ field: 'sections', label: 'At least one section' });
    if (next.length > 0) {
      setErrors(next);
      const firstField = next[0].field;
      // copyName / brand live in the Identity group — surface it before focusing
      // so the input is mounted (sections sit in the always-visible preview pane).
      if (firstField === 'copyName' || firstField === 'brand') setPanel('identity');
      requestAnimationFrame(() => {
        const first = fieldRefs[firstField]?.current;
        first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        first?.focus?.();
      });
      return;
    }
    // Near-duplicate structure warning (§9) — new templates only.
    if (isNew && !skipDup) {
      const dup = nearDuplicate();
      if (dup) { setDupConfirm(dup); return; }
    }
    setErrors([]);
    setIsSaving(true);
    // Simulate an async save so the spinner is observable.
    window.setTimeout(() => {
      const finalName = copyName.trim() || (isNew ? 'Untitled Template' : template.name);

      if (isNew && onSaveNew) {
        if (existingTemplateNames.some(n => n.toLowerCase() === finalName.toLowerCase())) {
          setIsSaving(false);
          addToast({ type: 'error', message: `A template named "${finalName}" already exists. Choose a different name.` });
          return;
        }
        onSaveNew({
          ...template,
          id: `ct-new-${Date.now()}`,
          name: finalName,
          category: template.category ?? 'Custom',
          sections,
          brand: brand.trim(),
          theme,
          brandColor: brandColor || undefined,
          findingScale,
          opinionScale,
          scaleMap: Object.keys(scaleMap).length > 0 ? scaleMap : undefined,
          headerText: headerText.trim(),
          footerText: footerText.trim(),
          watermark,
          pageNumbers,
          signoffEnabled,
          signatories: cleanSignatories,
          closingEnabled,
          closingText: cleanClosing,
          logoDataUrl: logoDataUrl || undefined,
        });
        addToast({ type: 'success', message: 'Template saved to Custom Templates.' });
      } else {
        // In-place edit (existing custom templates): persist changes back to
        // the same entry. New templates use the create path above.
        if (onSaveEdit) {
          // A rename can collide with another template; the template's own name
          // is always "taken", so only block when the name actually changed.
          if (
            finalName.toLowerCase() !== template.name.toLowerCase() &&
            existingTemplateNames.some(n => n.toLowerCase() === finalName.toLowerCase())
          ) {
            setIsSaving(false);
            addToast({ type: 'error', message: `A template named "${finalName}" already exists. Choose a different name.` });
            return;
          }
          onSaveEdit({
            ...template,
            name: finalName,
            sections,
            brand: brand.trim(),
            theme,
            brandColor: brandColor || undefined,
            findingScale,
            opinionScale,
            scaleMap: Object.keys(scaleMap).length > 0 ? scaleMap : undefined,
            headerText: headerText.trim(),
            footerText: footerText.trim(),
            watermark,
            pageNumbers,
            signoffEnabled,
            signatories: cleanSignatories,
            closingEnabled,
            closingText: cleanClosing,
            logoDataUrl: logoDataUrl || undefined,
          });
        }
        addToast({ type: 'success', message: 'Template saved.' });
      }
      logEvent({
        action: isNew ? 'Create' : 'Update',
        description: `${isNew ? 'Created' : 'Saved'} template "${finalName}"`,
        module: 'Reports',
        entity: 'Report Template',
      });
      setIsSaving(false);
      onClose();
    }, 320);
  };

  // The builder is a settings panel beside one page of preview, so it does not
  // need the 1600×1000 workbench: at that size half the dialog was empty. Only
  // the check screen earns the big box, because it puts their real document next
  // to the template we propose. The scan stays in the box the dialog is already
  // in: growing the window while they are watching a progress bar is a jump for
  // nothing, and the size change belongs to the arrival of the result.
  const wideShell = !!pendingImport;

  // The upload door is the offer on the desk only while the page is untouched.
  // Writing a section by hand, or reading one from a file, answers the question
  // it was asking, so it moves to the footer as a plain button and stays there.
  const showImportOffer = sections.length === 0 && !importedFrom && !importing && !writingByHand;

  // Minimized — the full modal is not rendered, so the app behind is usable while
  // extraction runs (or after it finishes). Only the corner card shows; Open
  // restores the editor with the imported outline in place.
  if (minimized) {
    return (
      <ExtractionCard
        filename={scanningName ?? importedFrom ?? 'your report'}
        messages={passes.map(p => p.title)}
        done={!importing}
        sectionCount={!importing ? (importBanner?.count ?? reviewSections.length) : undefined}
        progress={importProgress}
        msgIdx={importMsgIdx}
        onOpen={() => setMinimized(false)}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }} className={`fixed inset-0 z-[60] flex items-center justify-center ${isNew ? 'p-6' : ''}`} onClick={attemptClose}>
      {/* Editing an existing template opens full screen — there's no page
          behind it worth hinting at, and a fixed-size dialog wasted the room
          a real document needs to edit comfortably. New/create still opens as
          a dialog over the reports page it was launched from. */}
      {isNew && <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />}
      {/* A big dialog, not the page. Everything in here is a document — the
          start screen, the check screen, the outline the editor builds — so it
          takes nearly the whole window and leaves a margin that says the page
          is still there behind it. */}
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        role="dialog" aria-modal="true" aria-label="Edit Template"
        // The one size change in this dialog is the check screen arriving, so it
        // eases rather than snaps.
        className={`relative flex max-h-full max-w-full flex-col overflow-hidden border border-canvas-border bg-canvas-elevated transition-[width,height] duration-[420ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
          isNew ? `rounded-2xl ${wideShell ? 'h-[1000px] w-[1600px]' : 'h-[720px] w-[1180px]'}` : 'h-full w-full rounded-none border-none'
        }`}
        onClick={e => e.stopPropagation()}
        onDragEnter={e => {
          // Only react to file drags, and not while a scan/review is already up.
          if (importing || pendingImport || !Array.from(e.dataTransfer.types).includes('Files')) return;
          e.preventDefault();
          dragDepth.current += 1;
          setDragActive(true);
        }}
        onDragOver={e => { if (dragActive) e.preventDefault(); }}
        onDragLeave={() => {
          if (!dragActive) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragActive(false);
        }}
        onDrop={e => {
          if (!dragActive) return;
          e.preventDefault();
          dragDepth.current = 0;
          setDragActive(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleImportFile(f);
        }}
      >
        {/* The file picker for every "start from a report" door in this modal —
            the start step, the footer link and the banner's replace. Mounted
            once, above the stages, so any of them can open it. */}
        <input ref={importInputRef} type="file" accept={IMPORT_ACCEPT} className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); if (importInputRef.current) importInputRef.current.value = ''; }} />

        {/* Header, footer and shell all follow shared/Modal (DESIGN.md §7.9.1)
            rather than a smaller set of one-off values, so this dialog reads as
            the same object as every other create surface in the product. */}
        <header className="px-7 py-3.5 border-b border-canvas-border flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h3 className="text-[0.875rem] font-semibold leading-tight tracking-tight text-ink-900">{isNew ? 'Create template' : 'Edit template'}</h3>
            <p className="mt-0.5 text-[0.75rem] text-ink-500 leading-snug truncate">
              {!isNew ? template.name
                : importedFrom ? `Your format, read from ${importedFrom}`
                : 'A reusable layout for your reports'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <motion.button whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} onClick={attemptClose} aria-label="Close" className="w-8 h-8 rounded-md text-ink-500 hover:text-ink-800 hover:bg-canvas flex items-center justify-center cursor-pointer shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"><X size={18} /></motion.button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex">
          {/* Left pane — settings split into Identity / Branding groups so the
              column reads as a structured panel, not a flat six-field stack. */}
          <div className="w-[360px] shrink-0 border-r border-canvas-border flex flex-col min-h-0">
            {/* Sticky top — validation + the tab switch stay put while the
                panel below scrolls. */}
            <div className="px-6 pt-5 pb-4 shrink-0 space-y-4">
              {/* Validation summary — animates in/out (no hard layout jump) and
                  each item is a clear, tappable "fix this field" chip. */}
              <AnimatePresence initial={false}>
                {activeErrors.length > 0 && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border border-risk-200 bg-risk-50 rounded-md px-3 py-2.5 text-[0.75rem] text-risk-800">
                      <div className="font-semibold mb-1.5">Please complete the following before saving:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeErrors.map(err => (
                          <button
                            key={err.field}
                            type="button"
                            onClick={() => {
                              if (err.field === 'copyName' || err.field === 'brand') setPanel('identity');
                              requestAnimationFrame(() => {
                                const el = fieldRefs[err.field]?.current;
                                el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                                el?.focus?.();
                              });
                            }}
                            className="inline-flex items-center gap-0.5 rounded-full border border-risk-300 bg-white pl-2.5 pr-1.5 py-0.5 text-[0.6875rem] font-semibold text-risk-700 hover:bg-risk-100 hover:border-risk-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
                          >
                            {err.label} <ChevronRight size={12} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Segmented group switcher — Details (what the template is + its
                  outline) vs Branding (how it looks). Full ARIA tab pattern with
                  ←/→ navigation (#9). */}
              <div role="tablist" aria-label="Template settings" className="relative flex p-1 bg-canvas rounded-lg gap-1">
                {([['identity', 'Details'], ['branding', 'Branding']] as const).map(([key, label], i, arr) => {
                  const active = panel === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      tabIndex={active ? 0 : -1}
                      onClick={() => setPanel(key)}
                      onKeyDown={e => {
                        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                          e.preventDefault();
                          setPanel(arr[(i + (e.key === 'ArrowRight' ? 1 : arr.length - 1)) % arr.length][0]);
                        }
                      }}
                      className={`relative flex-1 h-8 rounded-sm text-[0.75rem] font-semibold cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${active ? 'text-brand-700' : 'text-ink-600 hover:text-ink-900'}`}
                    >
                      {active && (
                        <motion.span
                          layoutId="template-panel-pill"
                          transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
                          className="absolute inset-0 rounded-sm bg-white border border-canvas-border shadow-[0_1px_2px_rgba(15,8,30,0.08)]"
                        />
                      )}
                      <span className="relative z-10">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {panel === 'identity' ? (
              <motion.div key="panel-identity" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
                {/* Details holds only the template's properties — name, brand and
                    letterhead. Section-building lives in the roomy right pane
                    (next to its preview), so this column stays short and calm. */}
                <div className="space-y-4">
                  <div>
                    <FieldLabel
                      required
                      right={<span className={`text-[0.6875rem] tabular-nums ${copyName.length >= TEMPLATE_NAME_MAX ? 'text-risk-600 font-medium' : 'text-ink-400'}`}>{copyName.length}/{TEMPLATE_NAME_MAX}</span>}
                    >Template name</FieldLabel>
                    <input ref={copyNameRef} value={copyName} onChange={e => setCopyName(e.target.value.slice(0, TEMPLATE_NAME_MAX))} maxLength={TEMPLATE_NAME_MAX} aria-invalid={nameTaken}
                      placeholder="e.g. Internal Audit Report"
                      className={`w-full h-10 px-3 rounded-lg border text-[0.8125rem] transition-colors placeholder:text-ink-400 focus:outline-none focus:ring-2 ${nameTaken ? 'border-high/60 focus:border-high focus:ring-high/10' : 'border-canvas-border hover:border-ink-300 focus:border-brand-600/40 focus:ring-brand-600/10'}`} />
                    {nameTaken && <p className="mt-1 text-[0.6875rem] text-high-700 font-medium">A template named “{copyName.trim()}” already exists — choose a different name to save.</p>}
                  </div>
                  <div>
                    <FieldLabel>Organisation name</FieldLabel>
                    <input ref={brandRef} value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Irame" className="w-full h-10 px-3 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors placeholder:text-ink-400 hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                    <p className="mt-1 text-[0.6875rem] text-ink-400">The organisation shown on the report cover and letterhead.</p>
                  </div>
                </div>

                {/* Letterhead — footer only. There is NO header-text field and
                    NO platform header line, by request (the field was removed
                    three times, once after a19bcde re-added it). The header
                    prints only the confidentiality line a read of the client's
                    own report captured; a hand-built template has none. Do not
                    put the field or a default back. */}
                <div className="mt-5 pt-4 border-t border-canvas-border">
                  <GroupEyebrow hint="shown on every page">Letterhead</GroupEyebrow>
                  <div className="space-y-4">
                    <div>
                      <FieldLabel
                        right={<span className={`text-[0.6875rem] tabular-nums ${footerText.length > LETTERHEAD_SOFT_MAX ? 'text-risk-600 font-medium' : 'text-ink-400'}`}>{footerText.length}/{LETTERHEAD_SOFT_MAX}</span>}
                      >Footer text</FieldLabel>
                      <input value={footerText} onChange={e => { setFooterCustom(true); setFooterText(e.target.value); }} placeholder={defaultFooterText(brand)} className="w-full h-10 px-3 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                      {footerText.length > LETTERHEAD_SOFT_MAX && <p className="mt-1 text-[0.6875rem] text-risk-600">Long footer text may be truncated in the letterhead.</p>}
                    </div>
                  </div>
                </div>

              </motion.div>
            ) : (
              <motion.div key="panel-branding" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="flex-1 min-h-0 overflow-y-auto px-6 pt-3 pb-6">
                <div>
                  {/* One eyebrow heads the group — no separate "Color Theme" label
                      stacked under an "Appearance" eyebrow. */}
                  <GroupEyebrow hint="applied to the report cover">Color Theme</GroupEyebrow>
                  {/* Theme rows — the combination shown as its two named colours
                      (purple + white, navy + gold…) as a pair of floating dots.
                      Compact so all combinations fit with little scrolling. */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.keys(TEMPLATE_THEME_SWATCH).map((name, ti) => {
                      const active = theme === name;
                      const [a, b] = TEMPLATE_THEME_SWATCH[name];
                      const dotShadow = '0 0 0 2px #fff, 0 1px 4px rgba(15,8,30,0.22)';
                      return (
                        <motion.button
                          key={name}
                          type="button"
                          onClick={() => setTheme(name)}
                          aria-pressed={active}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: ti * 0.03 }}
                          whileTap={{ scale: 0.98 }}
                          className={`no-focus-ring flex items-center gap-2 rounded-lg border pl-2 pr-2.5 py-2 text-left transition-all cursor-pointer ${active ? 'border-brand-600 ring-2 ring-brand-600/15 bg-brand-50/40' : 'border-canvas-border bg-white hover:border-brand-300 hover:bg-canvas/40'}`}
                        >
                          {/* The two named colours, overlapping with a white gap. */}
                          <span className="shrink-0 flex items-center">
                            <span className="w-5 h-5 rounded-full" style={{ background: a, boxShadow: dotShadow }} />
                            <span className="w-5 h-5 rounded-full -ml-1.5" style={{ background: b, boxShadow: dotShadow }} />
                          </span>
                          <span className={`flex-1 min-w-0 text-[0.75rem] font-medium truncate ${active ? 'text-brand-700' : 'text-ink-700'}`}>{name}</span>
                          {active && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} className="shrink-0 w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center">
                              <Check size={10} strokeWidth={3} />
                            </motion.span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                  {/* Brand colour sampled from the uploaded report's cover — it
                      overrides the named theme until cleared. */}
                  {brandColor && (
                    <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-canvas-border bg-white px-3 py-2">
                      <span className="w-5 h-5 rounded-full shrink-0" style={{ background: brandColor, boxShadow: '0 0 0 2px #fff, 0 1px 4px rgba(15,8,30,0.22)' }} />
                      <span className="flex-1 min-w-0 text-[0.75rem] font-medium text-ink-700 truncate">Brand colour from your report’s cover</span>
                      <button type="button" onClick={() => setBrandColor('')} className="shrink-0 text-[0.6875rem] font-medium text-ink-400 hover:text-risk-600 transition-colors cursor-pointer">Clear</button>
                    </div>
                  )}
                </div>


                {/* Logo — their mark on the cover, read off an uploaded deck
                    when there was one. A brand asset, so it lives beside the
                    colour it sits on rather than in the text settings. */}
                <div className="mt-4 pt-3.5 border-t border-canvas-border">
                  <span className="block mb-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.13em] text-ink-400">Logo <span className="font-normal normal-case tracking-normal text-ink-400">· on the report cover</span></span>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, setLogoDataUrl); if (logoInputRef.current) logoInputRef.current.value = ''; }} />
                  {logoDataUrl ? (
                    <div className="flex items-center gap-3 rounded-lg border border-canvas-border bg-canvas p-2.5">
                      <div className="h-11 w-16 rounded-sm bg-white border border-canvas-border flex items-center justify-center overflow-hidden shrink-0">
                        <img src={logoDataUrl} alt="Logo" className="max-h-9 max-w-[56px] object-contain" />
                      </div>
                      <button type="button" onClick={() => logoInputRef.current?.click()} className="text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer">Replace</button>
                      <button type="button" onClick={() => setLogoDataUrl('')} className="ml-auto text-[0.75rem] font-medium text-ink-400 hover:text-risk-600 transition-colors cursor-pointer">Remove</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => logoInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-canvas-border bg-canvas/40 px-3 py-3 text-[0.8125rem] font-medium text-ink-500 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/30 transition-colors cursor-pointer">
                      <Upload size={15} /> Upload a logo
                    </button>
                  )}
                </div>

                {/* Page numbers — shown on every page of the exported report. */}
                <div className="mt-4 pt-3.5 border-t border-canvas-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.625rem] font-semibold uppercase tracking-[0.13em] text-ink-400">Page numbers <span className="font-normal normal-case tracking-normal text-ink-400">· numbered footer on every page</span></span>
                    <Toggle checked={pageNumbers} onChange={setPageNumbers} label="Show page numbers" />
                  </div>
                </div>

                {/* Sign-off block — an Approvals & Sign-Off section on the report;
                    each signatory gets a manual Sign / Sign-off in the reader. */}
                <div className="mt-4 pt-3.5 border-t border-canvas-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.625rem] font-semibold uppercase tracking-[0.13em] text-ink-400">Signature block <span className="font-normal normal-case tracking-normal text-ink-400">· job titles, signature lines and a date on every report</span></span>
                    <Toggle checked={signoffEnabled} onChange={toggleSignoff} label="Enable signature block" />
                  </div>
                  {signoffEnabled && (
                    <div className="mt-3 space-y-2">
                      {signatories.length === 0 && (
                        <p className="text-[0.6875rem] text-ink-400">Add the roles that sign this report (e.g. Prepared by, Approved by).</p>
                      )}
                      {/* Say exactly what this does, or it reads as e-signing. */}
                      <p className="text-[0.6875rem] text-ink-400 leading-relaxed">
                        Prints the page and nothing more. Names are optional and are kept for next time. No sending, no notifying, no signing online.
                      </p>
                      {signatories.map(s => (
                        <div key={s.id} className="flex items-center gap-2">
                          <input
                            value={s.role}
                            onChange={e => updateSignatory(s.id, { role: e.target.value })}
                            placeholder="Role — e.g. Approved by"
                            aria-label="Signatory role"
                            className="w-[42%] h-9 px-2.5 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                          />
                          <input
                            value={s.name ?? ''}
                            onChange={e => updateSignatory(s.id, { name: e.target.value })}
                            placeholder="Name (optional)"
                            aria-label="Signatory name"
                            className="flex-1 min-w-0 h-9 px-2.5 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                          />
                          <button type="button" onClick={() => removeSignatory(s.id)} aria-label={`Remove ${s.role || 'signatory'}`} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-sm text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                        </div>
                      ))}
                      <button type="button" onClick={addSignatory} className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer"><Plus size={13} /> Add signatory</button>
                    </div>
                  )}
                </div>

                {/* Closing page — the last slide a committee deck ends on. Same
                    kind of setting as the signature block: the shape is the
                    whole feature, so nothing about it is generated. */}
                <div className="mt-4 pt-3.5 border-t border-canvas-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.625rem] font-semibold uppercase tracking-[0.13em] text-ink-400">Closing page <span className="font-normal normal-case tracking-normal text-ink-400">· the last page, printed exactly as written</span></span>
                    <Toggle checked={closingEnabled} onChange={toggleClosing} label="Enable closing page" />
                  </div>
                  {closingEnabled && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[0.6875rem] text-ink-400 leading-relaxed">
                        Whatever you write here prints at the end of every report, word for word. Nothing in it is filled in from audit results.
                      </p>
                      {closingText.map((line, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            value={line}
                            onChange={e => setClosingText(prev => prev.map((l, li) => (li === i ? e.target.value : l)))}
                            placeholder={i === 0 ? 'Thank you' : 'Another line (optional)'}
                            aria-label={`Closing page line ${i + 1}`}
                            className="flex-1 min-w-0 h-9 px-2.5 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                          />
                          <button type="button" onClick={() => setClosingText(prev => prev.filter((_, li) => li !== i))} aria-label={`Remove closing line ${i + 1}`} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-sm text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setClosingText(prev => [...prev, ''])} className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer"><Plus size={13} /> Add line</button>
                    </div>
                  )}
                </div>

                {/* Watermark — a diagonal text or image mark across every page. */}
                <div className="mt-4 pt-3.5 border-t border-canvas-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[0.625rem] font-semibold uppercase tracking-[0.13em] text-ink-400">Watermark <span className="font-normal normal-case tracking-normal text-ink-400">· diagonal mark on every page</span></span>
                    <Toggle checked={watermark.enabled} onChange={v => setWm({ enabled: v })} label="Enable watermark" />
                  </div>
                  {watermark.enabled && (
                    <div className="space-y-3.5">
                      {/* content mode — text or an uploaded image */}
                      <div className="inline-flex p-0.5 bg-canvas rounded-md gap-0.5">
                        {(['text', 'image'] as const).map(m => (
                          <button key={m} type="button" onClick={() => setWm({ mode: m })}
                            className={`h-7 px-3 rounded-sm text-[0.75rem] font-semibold capitalize transition-colors cursor-pointer ${watermark.mode === m ? 'bg-white border border-canvas-border text-brand-700 shadow-[0_1px_2px_rgba(15,8,30,0.08)]' : 'text-ink-500 hover:text-ink-800'}`}>
                            {m}
                          </button>
                        ))}
                      </div>

                      {watermark.mode === 'text' ? (
                        <input value={watermark.text} onChange={e => setWm({ text: e.target.value })} placeholder="CONFIDENTIAL"
                          className="w-full px-3 py-2 rounded-md border border-canvas-border text-[0.875rem] uppercase tracking-wide transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                      ) : (
                        <>
                          <input ref={watermarkImgInputRef} type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, url => setWm({ imageDataUrl: url })); if (watermarkImgInputRef.current) watermarkImgInputRef.current.value = ''; }} />
                          {watermark.imageDataUrl ? (
                            <div className="flex items-center gap-3 rounded-lg border border-canvas-border bg-canvas p-2.5">
                              <div className="h-11 w-16 rounded-sm bg-white border border-canvas-border flex items-center justify-center overflow-hidden shrink-0">
                                <img src={watermark.imageDataUrl} alt="Watermark" className="max-h-9 max-w-[56px] object-contain" />
                              </div>
                              <button type="button" onClick={() => watermarkImgInputRef.current?.click()} className="text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer">Replace</button>
                              <button type="button" onClick={() => setWm({ imageDataUrl: undefined })} className="ml-auto text-[0.75rem] font-medium text-ink-400 hover:text-risk-600 transition-colors cursor-pointer">Remove</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => watermarkImgInputRef.current?.click()}
                              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-canvas-border bg-canvas/40 px-3 py-3 text-[0.8125rem] font-medium text-ink-500 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/30 transition-colors cursor-pointer">
                              <Upload size={15} /> Upload a watermark image
                            </button>
                          )}
                        </>
                      )}

                      <Slider label="Opacity" min={2} max={40} value={Math.round(watermark.opacity * 100)} suffix="%" onChange={v => setWm({ opacity: v / 100 })} />
                      <Slider label="Rotation" min={-90} max={90} value={watermark.rotation} suffix="°" onChange={v => setWm({ rotation: v })} />
                      <Slider label="Size" min={20} max={100} value={watermark.size} suffix="%" onChange={v => setWm({ size: v })} />

                      {/* Placement — pin the mark to the centre (default) or a side of
                          the page. Live-previews on the sheet beside this panel. */}
                      <div>
                        <span className="block text-[0.75rem] font-medium text-ink-600 mb-1.5">Placement</span>
                        <div className="grid grid-cols-5 gap-1">
                          {(['center', 'top', 'bottom', 'left', 'right'] as const).map(p => {
                            const active = (watermark.position ?? 'center') === p;
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setWm({ position: p })}
                                aria-pressed={active}
                                className={`h-7 rounded-sm text-[0.6875rem] font-semibold capitalize transition-colors cursor-pointer ${active ? 'bg-brand-50 text-brand-700 border border-brand-300' : 'bg-canvas border border-canvas-border text-ink-500 hover:text-ink-800 hover:border-ink-300'}`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right pane — a working preview of the report on a desk. A thin
              builder toolbar (add a section) sits on top; below it the
              template renders as the report page it will produce: gradient
              letterhead cover, editorial numbered sections, footer strip. */}
          <div className="relative flex-1 min-w-0 flex flex-col bg-canvas min-h-0">
            {/* Read badly, said plainly: the check screen was skipped because
                there was too little to check. */}
            {badRead && (
              <div className="shrink-0 px-6 pt-4">
                <div className="flex items-start gap-2.5 rounded-lg border border-mitigated-300 bg-mitigated-50/60 px-4 py-2.5">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-mitigated-700" />
                  <p className="min-w-0 flex-1 text-[0.75rem] leading-relaxed text-ink-700">{badRead}</p>
                  <button
                    type="button" onClick={() => setBadRead(null)} aria-label="Dismiss"
                    className="w-7 h-7 rounded-full text-ink-400 hover:text-ink-700 hover:bg-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  ><X size={15} /></button>
                </div>
              </div>
            )}
            {/* THE PREVIEW BEFORE SAVING. Up to here the client has only seen
                empty boxes, so a wrong column or a card missing a field turns
                up in their first real report, months later. Three invented
                findings printed through their own template move that to minute
                five. It is a view on this screen rather than a step in front of
                Save, because the same decision was already taken for the check
                screen: nothing stands between a read and a saved template. */}
            {sections.length > 0 && (
              <div className="shrink-0 flex items-center justify-end px-6 pt-5">
                <div role="group" aria-label="What the preview shows" className="inline-flex rounded-md border border-canvas-border bg-white p-0.5">
                  {([['shape', 'Empty shape'], ['filled', 'With made-up problems']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPreviewMode(key)}
                      aria-pressed={previewMode === key}
                      className={`h-7 rounded-sm px-2.5 text-[0.75rem] font-semibold transition-colors cursor-pointer ${
                        previewMode === key ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-800'
                      }`}
                    >{label}</button>
                  ))}
                </div>
              </div>
            )}
            {/* The report page — a white sheet on the canvas desk. Sections and the
                composer that adds them both live INSIDE the page, the way the
                finished report reads; there's no separate toolbar on top. */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
              {previewMode === 'filled' && sections.length > 0 ? (
                <MadeUpPreview template={liveTemplate} />
              ) : (
              <div className="relative mx-auto w-full max-w-3xl rounded-lg border border-canvas-border" style={{ '--rep-accent': coverAccent } as CSSProperties}>
                <ReportBrandBanner
                  title={copyName || 'Untitled Template'}
                  titleClassName="text-[1.5rem]"
                  logo={logoDataUrl || undefined}
                  className="rounded-t-lg"
                  gradient={coverGradient}
                  headerText={headerText}
                  footer={
                    /* All report facts live in the letterhead as one full-width
                       strip — no duplicated meta panel below. */
                    /* Only what a generated report really prints. The period comes
                       from the report (the wizard's period, else the current
                       fiscal quarter), so it fills the same way whether this
                       template was read from a file or typed here. A reference
                       number is NOT held for reports built from a custom
                       template — only ATR documents carry one — so no box
                       promises one. */
                    <div className="grid grid-cols-2 gap-6">
                      {[
                        { label: 'Prepared by', value: brand || DEFAULT_TEMPLATE_BRAND },
                        { label: 'Period', value: 'Fills from the report' },
                      ].map(f => (
                        <div key={f.label} className="min-w-0">
                          <div className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-white/50">{f.label}</div>
                          <div className="text-[0.875rem] font-medium text-white/90 mt-1 truncate">{f.value}</div>
                        </div>
                      ))}
                    </div>
                  }
                >
                  <p className="text-[0.875rem] text-white/75">{template.desc || 'Custom report template'}</p>
                </ReportBrandBanner>

                {/* Sections — each drag-reorderable and removable on hover. */}
                {sections.length > 0 && (
                  <div ref={sectionsListRef}>
                    <AnimatePresence initial={false}>
                      {sections.map((section, i) => (
                        <ReportSectionBlock
                          key={section.name}
                          section={section}
                          index={i}
                          listRef={sectionsListRef}
                          onMove={moveSection}
                          onDelete={() => removeSection(i)}
                          onRename={name => renameSection(i, name)}
                          onDescribe={description => describeSection(i, description)}
                          blockLibrary={blockLibrary}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* Composer — add a section, in the flow of the document (not a
                    detached toolbar). */}
                <div ref={sectionsRef} tabIndex={-1} className="border-x border-canvas-border bg-white px-9 pt-5 pb-7">
                  {sections.length === 0 && (
                    <p className="mb-3 text-[0.8125rem] text-ink-400">No sections yet. Write the first one below.</p>
                  )}
                  {/* Touching either half of the composer is the choice to write
                      it by hand, so the upload offer leaves the desk on the
                      first click, not on the first saved section. */}
                  <div className="flex items-center gap-2" onPointerDown={() => setWritingByHand(true)}>
                    <input
                      value={newSectionName}
                      onFocus={() => setWritingByHand(true)}
                      onChange={e => setNewSectionName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSection(); } }}
                      placeholder="Add a section, then press ↵"
                      title="Type a section name and press Enter to add"
                      className="flex-1 h-10 px-3 rounded-lg border border-dashed border-canvas-border bg-canvas/30 text-[0.8125rem] transition-colors hover:border-brand-300 focus:outline-none focus:border-brand-600/40 focus:bg-white focus:ring-2 focus:ring-brand-600/10"
                    />
                    <button
                      onClick={addSection}
                      disabled={!newSectionName.trim()}
                      className={`no-focus-ring inline-flex items-center gap-1 h-10 px-4 text-[0.8125rem] font-semibold rounded-lg transition-colors ${
                        newSectionName.trim()
                          ? 'text-white bg-brand-600 hover:bg-brand-500 cursor-pointer'
                          : 'text-text-muted bg-canvas-border cursor-not-allowed'
                      }`}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>

                {/* Sign-off block — the Approvals section on the finished report.
                    Static here (no Sign action); the reader makes it signable. */}
                {signoffEnabled && cleanSignatories.length > 0 && (
                  <div className="border-x border-canvas-border bg-white px-9 pt-3 pb-8">
                    <ReportSignoffBlock signatories={cleanSignatories} />
                  </div>
                )}

                {/* Closing page — printed word for word at the end of every
                    report, so the preview shows it the same way. */}
                {closingEnabled && cleanClosing.length > 0 && (
                  <div className="border-x border-canvas-border bg-white px-9">
                    <ReportClosingBlock lines={cleanClosing} />
                  </div>
                )}

                {/* Footer strip — closes the page. With page numbers on, the
                    footer text sits left and a page number sits right, mirroring
                    the numbered footer the export produces. */}
                <div className={`border-x border-b border-canvas-border bg-canvas/60 rounded-b-lg px-9 py-3 flex items-center ${pageNumbers ? 'justify-between' : 'justify-center'}`}>
                  <span className="text-[0.6875rem] text-ink-400 tracking-wide">{footerText || defaultFooterText(brand)}</span>
                  {pageNumbers && <span className="text-[0.6875rem] text-ink-400 tabular-nums tracking-wide">Page 1</span>}
                </div>

                {/* Watermark — a diagonal text/image mark stamped across the page. */}
                {watermark.enabled && (watermark.mode === 'text' ? watermark.text.trim() : watermark.imageDataUrl) && (
                  <div className={`pointer-events-none absolute inset-0 z-[6] flex overflow-hidden rounded-lg ${WATERMARK_POS[watermark.position ?? 'center']}`}>
                    {watermark.mode === 'text' ? (
                      <span
                        className="font-extrabold uppercase tracking-[0.15em] whitespace-nowrap text-ink-900 select-none leading-none"
                        style={{ opacity: watermark.opacity, transform: `rotate(${watermark.rotation}deg)`, fontSize: `${watermark.size * 1.4}px` }}
                      >
                        {watermark.text}
                      </span>
                    ) : (
                      <img
                        src={watermark.imageDataUrl}
                        alt=""
                        className="max-w-none select-none"
                        style={{ opacity: watermark.opacity, transform: `rotate(${watermark.rotation}deg)`, width: `${watermark.size * 5}px` }}
                      />
                    )}
                  </div>
                )}
              </div>
              )}

              {/* The other way to build this: one card under the report, off the
                  page, with the primary action on it. It sits after the sheet
                  because the page is the thing being built and this is the
                  shortcut past it, and it goes the moment they start writing
                  sections by hand or a file has been read, where the footer
                  button takes over. */}
              {showImportOffer && (
                <div className="mx-auto mt-5 w-full max-w-3xl rounded-lg border border-canvas-border bg-white px-6 py-5">
                  {/* The memo's promise, said once, in the memo's own words: we
                      copy how it looks, not what it says. The footer's import
                      door says the same thing in fewer words, so the two doors
                      into this journey read as one offer, not two. */}
                  <p className="text-[0.875rem] font-semibold text-ink-900">Build this template from one of your reports</p>
                  <p className="mt-1 text-[0.875rem] text-ink-500">
                    Upload a past report and the template copies how it looks: its sections, its tables, its
                    letterhead. Nothing the report says is kept, and the file goes when you save.
                  </p>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    disabled={isSaving}
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-brand-600 px-4 text-[0.875rem] font-semibold text-white transition-colors hover:bg-brand-500 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                  >
                    <UploadCloud size={15} /> Upload a report
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="px-7 py-3 border-t border-canvas-border flex items-center justify-between gap-4 shrink-0">
          {/* Left — once there is an outline, whether it was typed by hand or
              read from a file, the import door lives here as a plain bordered
              button. The offer on the blank page is only for a template with
              nothing in it yet, so the two never show together. */}
          <div className="min-w-0 flex items-center gap-3">
            {!showImportOffer && (
              <>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={isSaving || importing}
                  title="Upload a past report as a PowerPoint or a PDF. The template takes its shape, and everything the report says stays out"
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-canvas-border bg-white px-4 text-[0.875rem] font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50/50 cursor-pointer disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                >
                  {importing
                    ? <><Loader2 size={15} className="animate-spin" /> Reading it now…</>
                    : <><Upload size={15} /> {importedFrom ? 'Use a different report' : 'Build from a report'}</>}
                </button>
                {importedFrom && !importing && (
                  <p className="min-w-0 truncate text-[0.75rem] text-ink-400">Shape taken from {importedFrom}</p>
                )}
              </>
            )}
          </div>
          {/* Right — primary actions. */}
          <div className="flex items-center gap-2 shrink-0">
          <motion.button
            onClick={attemptClose}
            disabled={isSaving}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[0.875rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
          >Cancel</motion.button>
          {/* New templates create a fresh entry; existing custom templates save
              in place (overwrite). */}
          <motion.button
            onClick={() => handleSave()}
            disabled={isSaving || nameTaken || !copyName.trim()}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            title={nameTaken ? 'A template with this name already exists — choose a different name' : undefined}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-brand-600 text-white rounded-md text-[0.875rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isSaving ? 'saving' : 'idle'}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="inline-flex items-center gap-1.5"
              >
                {isSaving && <Loader2 size={12} className="animate-spin" />}
                {isSaving ? 'Saving…' : isNew ? 'Create template' : 'Save changes'}
              </motion.span>
            </AnimatePresence>
          </motion.button>
          </div>
        </footer>

        {/* Drop-to-import affordance — shown whenever a file is dragged over the
            editor. The whole modal is the drop target, so there's nothing to aim at. */}
        <AnimatePresence>
          {dragActive && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-brand-950/40 backdrop-blur-[2px] pointer-events-none"
            >
              <div className="w-full h-full rounded-xl border-2 border-dashed border-brand-300 bg-canvas-elevated/95 flex flex-col items-center justify-center gap-3 text-center px-8">
                <motion.span
                  initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                  className="w-14 h-14 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center"
                >
                  <Upload size={24} />
                </motion.span>
                <div>
                  <div className="text-[1rem] font-semibold text-ink-900">Drop a past report to read its format</div>
                  <div className="mx-auto mt-1 max-w-[58ch] text-[0.875rem] leading-relaxed text-ink-500">A PowerPoint or a PDF. We keep its sections, tables, cards and letterhead, and throw away its words and numbers.</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reading the report — a real document-scanner on the left, and on the
            right the six reads, named as they run. The scanner says something is
            happening; the list says what, so a wrong result can be pointed at
            the read that got it wrong. Minimize collapses the whole modal to the
            bottom-right card, where the same run keeps advancing. */}
        <AnimatePresence>
          {importing && (() => {
            const kind = scanningName ? classifyUpload(scanningName) : null;
            const kindLabel = kind === 'deck' || kind === 'pdf' ? IMPORT_KIND_LABEL[kind] : 'File';
            const CORNERS = [
              '-top-1.5 -left-1.5 border-t-2 border-l-2 rounded-tl-md',
              '-top-1.5 -right-1.5 border-t-2 border-r-2 rounded-tr-md',
              '-bottom-1.5 -left-1.5 border-b-2 border-l-2 rounded-bl-md',
              '-bottom-1.5 -right-1.5 border-b-2 border-r-2 rounded-br-md',
            ];
            const sweep = { duration: 2.6, ease: 'linear' as const, repeat: Infinity };
            return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              className="absolute inset-0 z-50 flex bg-canvas-elevated"
              role="status" aria-busy="true" aria-label={`Scanning ${scanningName ?? 'your document'}`}
            >
                {/* Left panel — the page being read. It is a panel of its own,
                    edge to edge, so the room around the page reads as a surface
                    rather than as blank space in the middle of a big window. */}
                <div className="relative flex shrink-0 basis-[38%] min-w-[268px] max-w-[420px] flex-col items-center justify-center gap-8 overflow-hidden border-r border-canvas-border bg-canvas px-8 py-10">
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ background: 'radial-gradient(115% 68% at 50% 0%, rgba(136,56,222,0.08), transparent 72%)' }}
                    aria-hidden="true"
                  />
                {/* Scanner stage — the document page under the sweeping light. */}
                <div className="relative z-10 w-[236px] h-[310px]">
                  {/* focus-frame corner brackets */}
                  {CORNERS.map((c, i) => (
                    <span key={i} className={`absolute w-5 h-5 border-brand-500/70 ${c}`} aria-hidden="true" />
                  ))}

                  <div className="absolute inset-0 rounded-lg bg-white border border-canvas-border shadow-[0_22px_50px_-20px_rgba(15,8,30,0.4)] overflow-hidden">
                    {/* The page content, reading as a real report page. Each
                        part of it answers to one of the six reads, so the read
                        that is running lights its own part and the rest of the
                        page steps back. The client can see what "find the
                        headings" means without being told: the two big bars are
                        the only thing still lit while it runs. Hovering a read
                        on the right lights its part here too. */}
                    <div className="p-4">
                      {(() => {
                        const shown = peekPass ?? importMsgIdx;
                        // read → the part of the page it is about, in the order
                        // the six run. The last one names what was found, so it
                        // is about the whole page and lights all of it.
                        const FOCUS = ['text', 'furniture', 'headings', 'blocks', 'repeats', null] as const;
                        const focus = FOCUS[Math.min(shown, FOCUS.length - 1)];
                        const part = (key: string) =>
                          `transition-all duration-500 ${focus && focus !== key ? 'opacity-20' : 'opacity-100'} ${
                            focus === key ? 'rounded-xs outline outline-1 outline-brand-400/70 outline-offset-[3px]' : ''
                          }`;
                        return (
                          <>
                            <div className={`flex items-center gap-2 ${part('furniture')}`}>
                              <div className="w-6 h-6 rounded-sm bg-gradient-to-br from-brand-500 to-brand-400 shrink-0" />
                              <div className="flex-1 space-y-1">
                                <div className="h-1.5 w-20 rounded-full bg-ink-200" />
                                <div className="h-1 w-12 rounded-full bg-paper-200" />
                              </div>
                            </div>
                            <div className={`mt-4 space-y-1.5 ${part('headings')}`}>
                              <div className="h-2.5 w-11/12 rounded bg-ink-300" />
                              <div className="h-2.5 w-2/3 rounded bg-ink-300" />
                            </div>
                            <div className={`mt-4 space-y-[7px] ${part('text')}`}>
                              {[100, 94, 98, 86].map((w, i) => <div key={i} className="h-1.5 rounded-full bg-paper-200" style={{ width: `${w}%` }} />)}
                            </div>
                            <div className={`mt-4 grid grid-cols-3 gap-1 ${part('blocks')}`}>
                              {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-3 rounded-xs bg-paper-100 border border-paper-200" />)}
                            </div>
                            <div className={`mt-4 space-y-[7px] ${part('repeats')}`}>
                              {[96, 82, 90].map((w, i) => <div key={i} className="h-1.5 rounded-full bg-paper-200" style={{ width: `${w}%` }} />)}
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* digitized region — grows top→down behind the beam, with a
                        scan-line texture so the passed area reads as "captured" */}
                    {!reduceMotion && (
                      <motion.div
                        className="absolute inset-x-0 top-0 pointer-events-none"
                        style={{
                          backgroundColor: 'rgba(136,56,222,0.05)',
                          backgroundImage: 'repeating-linear-gradient(0deg, rgba(106,18,205,0.07) 0px, rgba(106,18,205,0.07) 1px, transparent 1px, transparent 4px)',
                        }}
                        initial={{ height: '0%' }}
                        animate={{ height: ['0%', '100%'] }}
                        transition={sweep}
                      />
                    )}

                    {/* the sweeping scan light: a bright line + a soft light bloom */}
                    <motion.div
                      className="absolute inset-x-0 pointer-events-none"
                      initial={{ top: '0%' }}
                      animate={reduceMotion ? { top: '46%' } : { top: ['0%', '100%'] }}
                      transition={reduceMotion ? { duration: 0 } : sweep}
                    >
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-brand-400/40 to-transparent" />
                      <div
                        className="absolute inset-x-0 bottom-0 h-[2px] bg-brand-200"
                        style={{ boxShadow: '0 0 16px 3px rgba(136,56,222,0.8), 0 0 5px 1px rgba(216,180,254,0.95)' }}
                      />
                    </motion.div>
                  </div>
                </div>

                {/* What is being read, said quietly under the page: the kind as a
                    label rather than a filled pill, the name in one line, and a
                    hairline track. The scan itself is the moving part here, so
                    the meter does not compete with it. */}
                <div className="relative z-10 flex w-[236px] max-w-full flex-col items-center text-center">
                  <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink-400">{kindLabel}</p>
                  {scanningName && (
                    <p className="mt-1.5 max-w-full truncate text-[0.875rem] font-medium text-ink-800" title={scanningName}>{scanningName}</p>
                  )}

                  <div className="mt-5 flex w-full items-center gap-3">
                    <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-brand-100">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-brand-600"
                        animate={{ width: `${importProgress}%` }}
                        transition={{ ease: 'easeOut', duration: 0.25 }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-[0.75rem] font-medium tabular-nums text-ink-500">{Math.round(importProgress)}%</span>
                  </div>
                </div>
                </div>

                {/* The six reads, named as they run. One read, one question, so
                    a wrong answer can be pointed at the read that gave it.
                    Six boxed rows each carrying a line of explanation was a wall
                    of text nobody reads while they wait, so only the read that
                    is running says what it is doing. The rest are titles on a
                    rail, and any of them opens on hover for a client who wants
                    to know what read four was before it gets there. */}
                <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-9 py-8">
                  <div className="flex items-baseline justify-between gap-8">
                    <h3 className="text-[1.125rem] font-semibold tracking-tight text-ink-900">Reading your report</h3>
                    <span className="shrink-0 text-[0.75rem] font-medium tabular-nums text-ink-400">
                      {Math.min(importMsgIdx + 1, passes.length)} of {passes.length}
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-[62ch] text-[0.875rem] leading-relaxed text-ink-500">
                    {importKind === 'deck'
                      ? 'A deck labels its own parts, so the first five reads have little to work out. The AI runs last, only to name what was found.'
                      : 'Five reads are just measuring. The AI runs last, only to name what the measuring found.'}
                  </p>

                  {/* The thread runs the height of the panel, so the six reads
                      are spaced by the room there is rather than bunched at the
                      top with the rest of the page left empty. */}
                  <ol className="relative mt-8 flex flex-1 flex-col justify-between">
                    {/* One thread behind the six, filled as far as the reading
                        has got. Drawn once for the whole list, so it stays
                        unbroken however the rows space themselves. */}
                    <span aria-hidden="true" className="pointer-events-none absolute left-[7px] top-2.5 bottom-2.5 w-px bg-canvas-border">
                      <motion.span
                        className="absolute inset-x-0 top-0 block bg-brand-400"
                        animate={{ height: `${Math.min(100, (importMsgIdx / Math.max(1, passes.length - 1)) * 100)}%` }}
                        transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
                      />
                    </span>
                    {passes.map((p, i) => {
                      const done = i < importMsgIdx;
                      const active = i === importMsgIdx;
                      const open = active || peekPass === i;
                      // How far through its own read this one is, taken from the
                      // same run as the meter, so the ring is never ahead of it.
                      const within = Math.max(0, Math.min(1, (importProgress / 100) * passes.length - i));
                      return (
                        <motion.li layout={!reduceMotion} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }} key={p.title} className="relative flex pb-7 last:pb-0">
                          {/* The whole row is the control: pointer or keyboard,
                              it opens the read and lights that read's part of
                              the page on the left. */}
                          <button
                            type="button"
                            aria-expanded={open}
                            onMouseEnter={() => setPeekPass(i)}
                            onMouseLeave={() => setPeekPass(c => (c === i ? null : c))}
                            onFocus={() => setPeekPass(i)}
                            onBlur={() => setPeekPass(c => (c === i ? null : c))}
                            className="group flex w-full min-w-0 gap-4 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-4 cursor-default"
                          >
                            <span
                              role="img"
                              aria-label={done ? 'done' : active ? 'running now' : 'not started yet'}
                              className="relative mt-1 flex h-[15px] w-[15px] shrink-0 items-center justify-center bg-canvas-elevated"
                            >
                              {done ? (
                                <motion.span
                                  initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                                  className="flex h-[15px] w-[15px] items-center justify-center rounded-full bg-brand-600 text-white"
                                >
                                  <Check size={9} strokeWidth={3.5} />
                                </motion.span>
                              ) : active ? (
                                <>
                                  {/* The read's own progress, drawn round its
                                      dot. The meter under the page says how far
                                      the whole run is; this says how far THIS
                                      read is, which is the thing being waited on. */}
                                  <svg viewBox="0 0 20 20" className="absolute h-[21px] w-[21px] -rotate-90 overflow-visible" aria-hidden="true">
                                    <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2" className="stroke-brand-100" />
                                    <motion.circle
                                      cx="10" cy="10" r="8" fill="none" strokeWidth="2" strokeLinecap="round"
                                      className="stroke-brand-600"
                                      initial={reduceMotion ? false : { pathLength: 0 }}
                                      animate={{ pathLength: within }}
                                      transition={{ ease: 'linear', duration: 0.3 }}
                                    />
                                  </svg>
                                  <span className="relative h-[7px] w-[7px] rounded-full bg-brand-600" />
                                </>
                              ) : (
                                <span className="h-[7px] w-[7px] rounded-full bg-canvas-border transition-colors group-hover:bg-ink-300" />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className={`block text-[0.875rem] transition-colors ${
                                active ? 'font-semibold text-ink-900'
                                  : done ? 'font-medium text-ink-700 group-hover:text-ink-900'
                                  : 'font-medium text-ink-400 group-hover:text-ink-700'
                              }`}>{p.title}</span>
                              {/* Only the read that is running explains itself.
                                  Hovering or tabbing to any other opens it too,
                                  so nothing is hidden, it just is not all
                                  shouting at once. */}
                              <AnimatePresence initial={false}>
                                {open && (
                                  <motion.span
                                    key="q"
                                    initial={reduceMotion ? false : { opacity: 0, y: -2 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                                    className="block pt-1 text-[0.875rem] leading-relaxed text-ink-500"
                                  >
                                    {p.question}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </span>
                          </button>
                        </motion.li>
                      );
                    })}
                  </ol>

                  <div className="mt-auto flex items-center gap-3 pt-8">
                    <button
                      onClick={() => setMinimized(true)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-canvas-border bg-white px-4 text-[0.875rem] font-semibold text-ink-800 transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                    >
                      <Minimize2 size={15} aria-hidden="true" /> Minimize
                    </button>
                    <p className="text-[0.875rem] text-ink-400">It keeps running in the background. Keep working.</p>
                  </div>
                </div>
            </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* The review step — a real step, not a formality. The reader proposes,
            the human decides, side by side with the pages of their own document.
            Being 80% right and letting the rest be fixed in two minutes is the
            design choice, which is why nothing lands until this is confirmed. */}
        <AnimatePresence>
          {pendingImport && (() => {
            const kept = reviewSections.filter(s => s.name.trim() && !s.wrapper);
            const namedCount = reviewSections.filter(s => s.name.trim()).length;
            const hasLetterhead = !!pendingImport.result?.furniture;
            const kindLabel = IMPORT_KIND_LABEL[pendingImport.kind];
            const dropped = pendingImport.result?.dropped ?? [];
            // The check queue — one of the four named situations, or a detector
            // that could not call it cleanly — is counted and shown by the
            // canvas itself, in a callout that jumps to the first one. This
            // header does not count it again.
            // Some decks are built free-hand: text boxes drawn anywhere, titles
            // typed into plain boxes. Those lose their labels and get read by
            // position and size instead, the way a PDF is, so it is worth saying.
            // The memo's own word for its parts: a deck calls them slides and
            // a PDF calls them pages. Said back in the client's vocabulary
            // rather than in "sections", which is ours.
            const partWord = pendingImport.result?.unit === 'slide' ? 'slide' : 'page';
            const freehandDeck = pendingImport.result?.unit === 'slide'
              && reviewSections.length > 0
              && reviewSections.filter(s => s.evidence === 'inferred').length > reviewSections.length * 0.4;
            return (
              <motion.div
                initial={{ opacity: 1, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                // Fills the dialog, which is nearly the whole window anyway.
                className="absolute inset-0 z-40 bg-canvas-elevated flex flex-col"
              >
                {/* Same header scale as the dialog it replaces (DESIGN.md
                    §7.9.1). It covers the whole dialog, so a smaller title here
                    read as a different, lesser window. */}
                <header className="shrink-0 border-b border-canvas-border px-7 py-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <h3 className="truncate text-[0.875rem] font-semibold leading-tight tracking-tight text-ink-900">
                          {`What we found in ${pendingImport.fileName}`}
                        </h3>
                        <span className="shrink-0 inline-flex items-center rounded-full bg-paper-100 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-ink-500">{kindLabel}</span>
                      </div>
                      {/* Don't make them choose: every dropdown is already set,
                          so the job here is verify, not decide. */}
                      <>
                        <p className="mt-0.5 text-[0.75rem] leading-snug text-ink-500">
                          We kept {kept.length} {kept.length === 1 ? partWord : `${partWord}s`} we can fill from your audit results. Confirm, rename, reorder or untick them.
                          {dropped.length > 0 && <> The rest of your report is not included, and it is listed at the end with the reason.</>}
                        </p>
                        {/* Its own line, under the sentence. Spliced into it, the
                            whole thing read as one run-on paragraph in three
                            colours. The "N we are unsure about" count is not
                            here at all: the canvas below already says it, in a
                            callout that jumps to the first one. */}
                        {freehandDeck && (
                          <p className="mt-1 flex items-start gap-1.5 text-[0.75rem] leading-relaxed text-mitigated-700">
                            <span aria-hidden="true" className="mt-[0.4375rem] h-1 w-1 shrink-0 rounded-full bg-mitigated-600" />
                            This deck looks hand built, with text typed into plain boxes rather than the title and layout slots, so we read it by position and size. Worth a closer look than usual.
                          </p>
                        )}
                      </>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <motion.button whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} onClick={cancelImport} aria-label="Cancel import" className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-canvas hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"><X size={18} /></motion.button>
                    </div>
                  </div>
                </header>
                {/* One canvas, one layout. It draws the as-is state (the
                    report they actually uploaded, page by page) beside the
                    to-be state (the template, in its own letterhead) itself,
                    which is what the other door shows. This screen used to
                    hand-roll two columns and put our reading of their report
                    on the left instead of their report. */}
                <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
                  <SectionReviewCanvas
                    ratingWords={ratingWordsPanel}
                    sections={reviewSections}
                    onSectionsChange={setReviewSections}
                    pages={pendingImport.result?.pages}
                    pageCount={pendingImport.result?.pageCount}
                    unit={pendingImport.result?.unit ?? 'page'}
                    toc={pendingImport.result?.toc}
                    notIncluded={dropped}
                    partWord={partWord}
                    // Their captured letterhead where the read found one, the
                    // editor's own live values next, the platform's defaults
                    // last, so the cover approved here is the cover the save
                    // produces whichever door they came through.
                    reportChrome={reviewChrome(pendingImport.result, {
                      title: copyName,
                      desc: template.desc,
                      brand,
                      headerText,
                      footerText,
                      theme,
                      brandColor,
                      logo: logoDataUrl,
                    })}
                  />
                </div>

                <footer className="shrink-0 px-7 py-3 border-t border-canvas-border flex items-center justify-between gap-4">
                  {/* The file this all came out of, in the same shape the
                      editor's own footer names it, with the same way to swap it
                      for another. Then what it produced, then the trade-off. */}
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      title="Read a different report instead"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-[0.75rem] font-semibold text-ink-500 transition-colors hover:text-brand-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
                    >
                      <FileText size={14} className="shrink-0" />
                      <span className="truncate">Read from {pendingImport.fileName}</span>
                      <span className="shrink-0 text-ink-400">· replace</span>
                    </button>
                    <span className="mt-0.5 block text-[0.75rem] text-ink-500">
                      {kept.length} {kept.length === 1 ? partWord : `${partWord}s`} kept, none of their words · {hasLetterhead ? 'letterhead captured' : 'no letterhead found'}
                      {/* THE COUNTING, on the screen where the editing happens.
                          How much of the read stood without a correction is the
                          number that says whether this is working, and it can
                          only be taken here: once the client leaves this screen
                          what they changed is indistinguishable from what we
                          proposed. Reported plainly, never scored — the target
                          behind it is ours to hit, not theirs to be graded on. */}
                      {reviewBaseline.length > 0 && (() => {
                        const before = new Map(reviewBaseline.map(s => [s.id, s.name]));
                        const here = new Set(reviewSections.map(s => s.id));
                        const renamed = reviewSections.filter(s => before.has(s.id) && before.get(s.id) !== s.name).length;
                        const unticked = reviewBaseline.filter(s => !here.has(s.id)).length;
                        if (!renamed && !unticked) return <> · all of them as we read them</>;
                        return (
                          <> · {reviewBaseline.length - renamed - unticked} of {reviewBaseline.length} as we read them
                            {renamed > 0 && `, ${renamed} renamed`}
                            {unticked > 0 && `, ${unticked} unticked`}
                          </>
                        );
                      })()}
                    </span>
                    <span className="block text-[0.6875rem] leading-snug text-ink-400">
                      We make the findings and the summary in your format. What was checked, replies from management and admin pages come one report at a time.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <motion.button whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} onClick={cancelImport} className="inline-flex items-center justify-center h-9 px-5 text-[0.875rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 rounded-md transition-colors cursor-pointer">
                      {importBanner ? 'Cancel' : 'Discard'}
                    </motion.button>
                    <motion.button
                      whileTap={namedCount === 0 ? undefined : { scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      // Straight in. The preview is a view on this same screen,
                      // not a gate on the way to using the format.
                      onClick={applyImport}
                      disabled={namedCount === 0}
                      className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-brand-600 text-white text-[0.875rem] font-semibold transition-colors rounded-md enabled:hover:bg-brand-500 enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ShieldCheck size={14} /> Use this format
                    </motion.button>
                  </div>
                </footer>
              </motion.div>
            );
          })()}
        </AnimatePresence>

      </motion.div>
      <ConfirmDialog
        open={showAbandonConfirm}
        onClose={() => setShowAbandonConfirm(false)}
        onConfirm={() => { setShowAbandonConfirm(false); cancel(); }}
        title="Discard changes?"
        description={<>You have unsaved changes to this template. Closing now will discard them.</>}
        confirmLabel="Discard"
        destructive
      />
      <ConfirmDialog
        open={dupConfirm !== null}
        onClose={() => setDupConfirm(null)}
        onConfirm={() => { setDupConfirm(null); handleSave(true); }}
        title={dupConfirm && dupConfirm.shared === dupConfirm.total ? 'You already have this template' : 'This looks like a duplicate'}
        description={
          dupConfirm && dupConfirm.shared === dupConfirm.total
            ? <>It has the same sections as your <span className="font-semibold">“{dupConfirm.name}”</span> template — all {dupConfirm.total}. Creating it just makes a second copy of the same thing.</>
            : <>{dupConfirm?.shared} of its {dupConfirm?.total} sections are the same as your <span className="font-semibold">“{dupConfirm?.name}”</span> template, so this would be nearly a copy.</>
        }
        confirmLabel={dupConfirm && dupConfirm.shared === dupConfirm.total ? 'Create a copy anyway' : 'Create anyway'}
        cancelLabel="Go back"
      />
      <ConfirmDialog
        open={confirmRemoveImport}
        onClose={() => setConfirmRemoveImport(false)}
        onConfirm={() => { setConfirmRemoveImport(false); undoImport(); }}
        title="Remove this format?"
        description={
          <>This clears the {importBanner?.count ?? ''} section{importBanner?.count === 1 ? '' : 's'}{importBanner?.gotLetterhead ? ' and the letterhead' : ''} we read{importBanner?.fileName ? <> from <span className="font-semibold">{importBanner.fileName}</span></> : ''}. You can start from a report again anytime.</>
        }
        confirmLabel="Remove"
        destructive
      />
    </motion.div>
  );
}

