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
  BookOpen, Search, Upload, Info, Maximize2, Minimize2,
  UploadCloud, PenLine, ArrowLeft,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { REPORT_TEMPLATES } from '../../data/mockData';
import { ReportBrandBanner, ReportSignoffBlock, ReportClosingBlock } from './ReportDocumentChrome';
import ConfirmDialog from './ConfirmDialog';
import {
  ICON_MAP, CATEGORY_COLORS, SECTION_ICONS, TEMPLATE_THEME_GRADIENT, TEMPLATE_THEME_SWATCH,
  sectionBlurb, DEFAULT_WATERMARK, reportGradient, reportAccent, DEFAULT_SIGNATORIES,
  collectBlockLibrary, DEFAULT_TEMPLATE_BRAND, DEFAULT_HEADER_TEXT, DEFAULT_THEME, defaultFooterText,
  type EditableTemplate, type WatermarkConfig,
  type TemplateSection, type SignatorySlot, type TemplateBlock,
} from './reportShared';
import { readTemplateFromReport, classifyUpload, type UploadKind } from './byot/byotRead';
import type { ReadResult, ReadOutcome } from './byot/byotRead';
import SectionReviewCanvas from './SectionReviewCanvas';
import { RowDeleteButton } from './RowDeleteButton';
import { renderSectionShape, sectionTypeLabel } from './templateSectionShape';
import { SHAKY_CONFIDENCE, reviewChrome, type CanvasSection, type CanvasBlock } from './sectionReviewShared';
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
// Starting from a report you already send is the same journey here as it is on
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

function ReportSectionBlock({ section, index, onMove, listRef, onDelete, onRename, onDescribe, blockLibrary }: {
  section: TemplateSection;
  index: number;
  onMove: (from: number, to: number) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  onDelete: () => void;
  onRename: (name: string) => void;
  onDescribe: (description: string) => void;
  /** Blocks the template stores by id, so a placement resolves to its shape. */
  blockLibrary?: Record<string, TemplateBlock>;
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
  const shape = renderSectionShape(section, blockLibrary, shownDesc);
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

// The sections a report commonly carries — offered as click-to-add suggestion
// chips under the composer so a blank template fills in fast. A static set, not
// tied to any report type.
const SUGGESTED_SECTIONS: { name: string; icon: string }[] = [
  { name: 'Executive Summary', icon: 'file-text' },
  { name: 'Scope & Objectives', icon: 'file-text' },
  { name: 'Testing Methodology', icon: 'file-text' },
  { name: 'Findings / Observations', icon: 'check-circle' },
  { name: 'Recommendations', icon: 'trending-up' },
  { name: 'Management Response', icon: 'book-open' },
  { name: 'Conclusion', icon: 'shield' },
  { name: 'Sign-off', icon: 'shield' },
];

export function TemplateEditor({ template, onClose, onCancel, onSaveNew, onSaveEdit, existingTemplateNames = [], existingStructures = [], initialName }: { template: EditableTemplate; onClose: () => void; onCancel?: () => void; onSaveNew?: (created: EditableTemplate) => void; onSaveEdit?: (updated: EditableTemplate) => void; existingTemplateNames?: string[]; existingStructures?: { name: string; sectionNames: string[] }[]; initialName?: string }) {
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
  // Cover gradient + accent for the live preview — the named theme, overridden
  // by the captured brand colour when present.
  const coverGradient = reportGradient(theme, brandColor) ?? TEMPLATE_THEME_GRADIENT[DEFAULT_THEME];
  const coverAccent = reportAccent(theme, brandColor);
  const [headerText, setHeaderText] = useState(template.headerText ?? DEFAULT_HEADER_TEXT);
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
  const [stage, setStage] = useState<'start' | 'build'>(isNew ? 'start' : 'build');

  // Add one or more sections, skipping any already in the outline (case-insensitive).
  const addSections = (list: { name: string; icon: string }[]) => {
    if (!list.length) return;
    setSections(prev => {
      const have = new Set(prev.map(s => s.name.toLowerCase()));
      const fresh = list.filter(s => !have.has(s.name.toLowerCase()));
      return [...prev, ...fresh.map(s => ({ name: s.name, icon: s.icon }))];
    });
  };
  // Suggested sections that aren't in the outline yet — a static set of the
  // sections a report commonly carries, offered as click-to-add chips under the
  // composer. Not tied to any report type.
  const recommendations = SUGGESTED_SECTIONS.filter(
    rec => !sections.some(s => s.name.toLowerCase() === rec.name.toLowerCase()),
  );

  // ── Start from a report you already send ──────────────────────────────────
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
      addToast({ type: 'info', message: 'A spreadsheet has no report format in it. Upload the PowerPoint or the PDF you send out.' });
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
        : outcome.reason === 'too-long' ? `This report is ${outcome.pageCount} ${kind === 'deck' ? 'slides' : 'pages'}. Upload one of about 50 or fewer, typical of your work.`
        : outcome.reason === 'too-large' ? `“${file.name}” is too big to read here. Keep it under 30 MB.`
        : `We could not read “${file.name}”. Try saving it again from ${kind === 'deck' ? 'PowerPoint' : 'the tool you wrote it in'} and uploading that.`;
      addToast({ type: 'error', message });
      return;
    }
    const result = outcome.result;
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

    // Review is where the import lands, not the outline. Nothing is applied
    // until it is confirmed beside the pages of the real document.
    setReviewSections(detected);
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
  // Review again — reopen the canvas on an import that already landed. Cancelling
  // out of it leaves the applied import exactly as it is.
  const openReview = () => {
    if (!importBanner) return;
    setReviewSections(importBanner.detected);
    setImportKind(importBanner.kind);
    setPendingImport({ fileName: importBanner.fileName, kind: importBanner.kind, result: importBanner.result });
  };
  // Cancel the review. Before anything has been applied that means discarding
  // the read altogether, so it says so; afterwards it just closes the canvas.
  const cancelImport = () => {
    setPendingImport(null);
    if (!importBanner) { setReviewSections([]); setStage(isNew ? 'start' : 'build'); }
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
    setStage('build');
  };

  // One block printed in two places is stored once; every other placement
  // points at it, so the preview resolves both to the same shape.
  const blockLibrary = collectBlockLibrary(sections);

  const [newSectionName, setNewSectionName] = useState('');
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
  const [suggestedConfirm, setSuggestedConfirm] = useState<string[] | null>(null);
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
    headerText: template.headerText ?? DEFAULT_HEADER_TEXT,
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
  const isDirty =
    copyName !== initial.copyName ||
    brand !== initial.brand ||
    theme !== initial.theme ||
    brandColor !== initial.brandColor ||
    findingScale !== initial.findingScale ||
    opinionScale !== initial.opinionScale ||
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
  // verbatim (#1). Arriving from the start step counts as opening it.
  useEffect(() => {
    if (stage !== 'build') return;
    const t = setTimeout(() => { const el = copyNameRef.current; if (el) { el.focus(); el.select(); } }, 80);
    return () => clearTimeout(t);
  }, [stage]);

  const fieldRefs: Record<string, React.RefObject<HTMLElement | null>> = {
    copyName: copyNameRef,
    brand: brandRef,
    sections: sectionsRef,
  };

  const handleSave = (skipDup = false, skipSuggested = false) => {
    // Required-field validation: name + brand are required; sections non-empty.
    const next: { field: 'copyName' | 'brand' | 'sections'; label: string }[] = [];
    if (!copyName.trim()) next.push({ field: 'copyName', label: 'Template Name' });
    if (!brand.trim()) next.push({ field: 'brand', label: 'Brand Name' });
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
    // Missing suggested sections (non-blocking): warn once, then proceed on confirm.
    // New templates built from scratch only — an imported report's own format is
    // authoritative, so it's never audited against our generic section list.
    if (isNew && !skipSuggested && !importedFrom && recommendations.length > 0) {
      setSuggestedConfirm(recommendations.map(r => r.name));
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }} className="fixed inset-0 z-[60] flex items-center justify-center" onClick={attemptClose}>
      <div className="absolute inset-0 bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px]" />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        role="dialog" aria-modal="true" aria-label="Edit Template"
        className="relative bg-canvas-elevated rounded-xl border border-canvas-border shadow-xl w-[1220px] max-w-[95vw] h-[780px] max-h-[92vh] overflow-hidden flex flex-col"
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

        <div className="px-7 py-2.5 border-b border-canvas-border flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><FileText size={16} /></div>
            <div className="min-w-0">
              <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight">{isNew ? 'Create template' : 'Edit template'}</h3>
              <p className="text-[0.75rem] text-ink-500 leading-snug truncate">
                {!isNew ? template.name
                  : stage === 'start' ? 'Two ways in. One is much shorter than the other.'
                  : importedFrom ? `Your format, read from ${importedFrom}`
                  : 'A reusable layout for your reports'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Back to the two ways in, while the outline is still untouched. */}
            {isNew && stage === 'build' && sections.length === 0 && !importedFrom && (
              <button
                type="button"
                onClick={() => setStage('start')}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[0.75rem] font-semibold text-ink-500 hover:text-ink-900 hover:bg-canvas transition-colors cursor-pointer"
              ><ArrowLeft size={13} /> Back</button>
            )}
            <motion.button whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} onClick={attemptClose} aria-label="Close" className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"><X size={16} /></motion.button>
          </div>
        </div>

        {/* ── The two ways in ──────────────────────────────────────────────
            Uploading a report you already send is the whole job in one
            gesture, so it gets the room and the drop target. Building from
            scratch is the honest second option, not a hidden one. */}
        {stage === 'start' ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
            <div className="mx-auto grid w-full max-w-[1060px] gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
              {/* Left — the offer, the drop target, and what actually happens. */}
              <div className="min-w-0">
                <p className="text-[1.0625rem] font-semibold leading-snug text-ink-900">
                  Give us one old report, and every report we make for you will look like you made it yourself.
                </p>
                <p className="mt-1 text-[0.875rem] text-ink-500">
                  We copy <span className="font-semibold text-brand-700">how your report looks</span>, not <span className="font-semibold text-brand-700">what it says</span>.
                </p>

                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="group mt-4 w-full rounded-lg border border-dashed border-canvas-border bg-white px-8 py-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
                >
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                    <UploadCloud size={22} />
                  </span>
                  <span className="mt-3.5 block text-[1rem] font-semibold text-ink-900">Start from a report you already send</span>
                  <span className="mt-1.5 block text-[0.875rem] text-ink-500 leading-relaxed">
                    One file, a PowerPoint or a PDF. Pick one that is typical of your work.
                  </span>
                  <span className="mt-3.5 inline-flex items-center gap-2 h-9 px-4 rounded-md bg-brand-600 text-white text-[0.8125rem] font-semibold transition-colors group-hover:bg-brand-500">
                    <Upload size={14} /> Choose a file
                  </span>
                  {/* Keeping their file is a security question every review asks,
                      so the upload screen is where the answer belongs. */}
                  <span className="mt-3 block text-[0.75rem] text-ink-400">
                    or drop it anywhere here · up to about 50 pages or slides · we keep it only while you set this up and delete it when you save
                  </span>
                </button>

                {/* The whole thing in one picture. You do one step of it. */}
                <div className="mt-4 rounded-lg border border-canvas-border bg-white px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    What happens <span className="font-normal normal-case tracking-normal text-ink-400">· you do one step of it</span>
                  </div>
                  <ol className="mt-2.5 grid grid-cols-5 gap-1.5">
                    {([
                      { n: 1, head: 'You upload', sub: 'one past report' },
                      { n: 2, head: 'We read it', sub: 'six reads' },
                      { n: 3, head: 'You check it', sub: 'rename, untick' },
                      { n: 4, head: 'Saved', sub: 'your file deleted' },
                      { n: 5, head: 'Every report', sub: 'comes out your way' },
                    ]).map(s => (
                      <li key={s.n} className={`rounded-md border px-2.5 py-1.5 ${s.n === 3 ? 'border-brand-300 bg-brand-50/60' : 'border-canvas-border bg-canvas/50'}`}>
                        <span className={`block text-[0.75rem] font-semibold leading-snug ${s.n === 3 ? 'text-brand-700' : 'text-ink-800'}`}>
                          <span className="tabular-nums text-ink-400">{s.n}.</span> {s.head}
                        </span>
                        <span className="block text-[0.6875rem] leading-snug text-ink-400">{s.sub}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* The other way in. Quieter, never hidden. */}
                <div className="mt-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-canvas-border" />
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-ink-400">or</span>
                  <span className="h-px flex-1 bg-canvas-border" />
                </div>
                <button
                  type="button"
                  onClick={() => setStage('build')}
                  className="mt-3.5 group w-full flex items-center gap-3 rounded-lg border border-canvas-border bg-white px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-canvas/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-500 transition-colors group-hover:bg-brand-50 group-hover:text-brand-700">
                    <PenLine size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.875rem] font-semibold text-ink-900">Build it section by section</span>
                    <span className="block text-[0.75rem] text-ink-500">Name it, add the sections you want, set the letterhead and branding.</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </button>
              </div>

              {/* Right — the two kinds of part that make it in, what does not,
                  and which files we can actually read. Said before the upload
                  rather than after it. */}
              <div className="min-w-0 space-y-3">
                <div className="rounded-lg border border-canvas-border bg-white p-3.5">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-compliant-700">What we keep</p>
                  <ul className="mt-2 space-y-1.5">
                    {([
                      { head: 'Parts we can fill from your audit results', body: 'the findings, the counts, the summary, recommendations, action tables, the cover details' },
                      { head: 'Parts whose wording never changes', body: 'rating definitions, how to read this report, the professional standards line, confidentiality notes' },
                      { head: 'Your look', body: 'headings, layout and order, your logo and colour, your letterhead, and your words for how bad a problem is' },
                    ]).map(i => (
                      <li key={i.head} className="flex gap-2">
                        <span className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-compliant-500" />
                        <span className="min-w-0 text-[0.75rem] leading-snug text-ink-500">
                          <span className="font-medium text-ink-800">{i.head}</span>, {i.body}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-canvas-border bg-white p-3.5">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-high-700">What we leave out</p>
                  <ul className="mt-2 space-y-1.5">
                    {([
                      { head: 'Every word and number in the file', body: 'the findings, figures, names and dates from the report you upload' },
                      { head: 'Parts we cannot fill', body: 'what was checked, replies from management, financial tables, admin pages, the aim of the audit' },
                    ]).map(i => (
                      <li key={i.head} className="flex gap-2">
                        <span className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-high-500" />
                        <span className="min-w-0 text-[0.75rem] leading-snug text-ink-500">
                          <span className="font-medium text-ink-800">{i.head}</span>, {i.body}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[0.6875rem] leading-snug text-ink-400">
                    You see that list once, before you save, each with its reason. Anything else goes in one report at a time
                    through Add Observation. The signature page is the exception, and comes back as a setting.
                  </p>
                </div>

                {/* Which files we accept. The picker offers the two we can read
                    and says plainly what happens to the rest. */}
                <div className="overflow-hidden rounded-lg border border-canvas-border bg-white">
                  <p className="border-b border-canvas-border bg-canvas px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500">
                    Which files we can read
                  </p>
                  <ul>
                    {([
                      { format: 'A PowerPoint (.pptx)', verdict: 'Works today', tone: 'ok' as const },
                      { format: 'A normal PDF', verdict: 'Works today', tone: 'ok' as const },
                      { format: 'A Word file', verdict: 'Later. Save it as a PDF.', tone: 'soon' as const },
                      { format: 'A scanned PDF', verdict: 'Later. No text inside.', tone: 'soon' as const },
                      { format: 'Excel, images, older .ppt', verdict: 'No', tone: 'no' as const },
                    ]).map(f => (
                      <li key={f.format} className="flex items-baseline gap-2 border-b border-canvas-border px-3.5 py-1.5 last:border-b-0">
                        <span className="text-[0.75rem] font-medium text-ink-800">{f.format}</span>
                        <span className={`ml-auto shrink-0 text-[0.6875rem] ${f.tone === 'ok' ? 'font-medium text-compliant-700' : f.tone === 'soon' ? 'text-mitigated-700' : 'text-ink-400'}`}>{f.verdict}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
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
                    <FieldLabel>Brand name</FieldLabel>
                    <input ref={brandRef} value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Irame" className="w-full h-10 px-3 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors placeholder:text-ink-400 hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                    <p className="mt-1 text-[0.6875rem] text-ink-400">The organisation shown on the report cover and letterhead.</p>
                  </div>
                </div>

                {/* Letterhead — header & footer shown on every printed page. */}
                <div className="mt-5 pt-4 border-t border-canvas-border">
                  <GroupEyebrow hint="shown on every page">Letterhead</GroupEyebrow>
                  <div className="space-y-4">
                    <div>
                      <FieldLabel
                        right={<span className={`text-[0.6875rem] tabular-nums ${headerText.length > LETTERHEAD_SOFT_MAX ? 'text-risk-600 font-medium' : 'text-ink-400'}`}>{headerText.length}/{LETTERHEAD_SOFT_MAX}</span>}
                      >Header text</FieldLabel>
                      <input value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder={DEFAULT_HEADER_TEXT} className="w-full h-10 px-3 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                      {headerText.length > LETTERHEAD_SOFT_MAX && <p className="mt-1 text-[0.6875rem] text-risk-600">Long header text may be truncated in the letterhead.</p>}
                    </div>
                    <div>
                      <FieldLabel
                        right={<span className={`text-[0.6875rem] tabular-nums ${footerText.length > LETTERHEAD_SOFT_MAX ? 'text-risk-600 font-medium' : 'text-ink-400'}`}>{footerText.length}/{LETTERHEAD_SOFT_MAX}</span>}
                      >Footer text</FieldLabel>
                      <input value={footerText} onChange={e => { setFooterCustom(true); setFooterText(e.target.value); }} placeholder={defaultFooterText(brand)} className="w-full h-10 px-3 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                      {footerText.length > LETTERHEAD_SOFT_MAX && <p className="mt-1 text-[0.6875rem] text-risk-600">Long footer text may be truncated in the letterhead.</p>}
                    </div>
                  </div>
                </div>

                {/* Rating language — the words the uploaded report rates things
                    in, captured at import. Generated reports speak these words. */}
                {(findingScale || opinionScale) && (
                  <div className="mt-5 pt-4 border-t border-canvas-border">
                    <GroupEyebrow hint="captured from your report">Rating language</GroupEyebrow>
                    <div className="space-y-2.5">
                      {findingScale && (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="block text-[0.6875rem] font-semibold text-ink-600 mb-1">Finding ratings</span>
                            <div className="flex flex-wrap gap-1">
                              {findingScale.map(w => (
                                <span key={w} className="inline-flex items-center rounded-full border border-canvas-border bg-canvas px-2 py-0.5 text-[0.6875rem] font-medium text-ink-700">{w}</span>
                              ))}
                            </div>
                          </div>
                          <button type="button" onClick={() => setFindingScale(undefined)} className="shrink-0 text-[0.6875rem] font-medium text-ink-400 hover:text-risk-600 transition-colors cursor-pointer">Remove</button>
                        </div>
                      )}
                      {opinionScale && (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="block text-[0.6875rem] font-semibold text-ink-600 mb-1">Overall opinion</span>
                            <div className="flex flex-wrap gap-1">
                              {opinionScale.map(w => (
                                <span key={w} className="inline-flex items-center rounded-full border border-canvas-border bg-canvas px-2 py-0.5 text-[0.6875rem] font-medium text-ink-700">{w}</span>
                              ))}
                            </div>
                          </div>
                          <button type="button" onClick={() => setOpinionScale(undefined)} className="shrink-0 text-[0.6875rem] font-medium text-ink-400 hover:text-risk-600 transition-colors cursor-pointer">Remove</button>
                        </div>
                      )}
                      <p className="text-[0.6875rem] text-ink-400 leading-relaxed">Generated reports rate findings in these words, not ours.</p>
                    </div>
                  </div>
                )}
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
            {/* Post-import banner — what the read confirmed, and the two ways
                back out of it: check the review again, or remove the whole
                import and its captured settings in one tap. */}
            <AnimatePresence>
              {importBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                  className="shrink-0 px-6 pt-4"
                >
                  <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/70 px-4 py-2.5">
                    <span className="w-7 h-7 rounded-full bg-compliant-500 text-white flex items-center justify-center shrink-0"><Check size={15} strokeWidth={2.5} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-semibold text-ink-900 leading-tight">
                        Your format is in · {importBanner.count} section{importBanner.count === 1 ? '' : 's'}{importBanner.gotLetterhead ? ' and the letterhead' : ''}
                      </p>
                      <p className="text-[0.75rem] text-ink-500 leading-tight truncate">
                        read from {importBanner.fileName}
                        {importBanner.captured.length > 0 && <> · we also kept your {importBanner.captured.join(', ')}</>}
                        {' '}· edit anything below
                      </p>
                    </div>
                    <button
                      type="button" onClick={openReview}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white border border-brand-200 text-brand-700 text-[0.75rem] font-semibold hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
                    ><Pencil size={13} /> Check again</button>
                    <button
                      type="button" onClick={() => setConfirmRemoveImport(true)} aria-label="Remove the report this came from"
                      title="Remove the report this came from"
                      className="w-7 h-7 rounded-full text-ink-400 hover:text-ink-700 hover:bg-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    ><X size={15} /></button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* The report page — a white sheet on the canvas desk. Sections and the
                composer that adds them both live INSIDE the page, the way the
                finished report reads; there's no separate toolbar on top. */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
              <div className="relative mx-auto w-full max-w-3xl rounded-lg shadow-[0_10px_34px_-14px_rgba(15,8,30,0.22)]" style={{ '--rep-accent': coverAccent } as CSSProperties}>
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
                    <div className="grid grid-cols-3 gap-6">
                      {[
                        { label: 'Brand', value: brand || DEFAULT_TEMPLATE_BRAND },
                        { label: 'Generated On', value: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) },
                        { label: 'Sections', value: `${sections.length}` },
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
                    detached toolbar). Suggested sections sit right beneath it. */}
                <div ref={sectionsRef} tabIndex={-1} className="border-x border-canvas-border bg-white px-9 pt-5 pb-7">
                  {sections.length === 0 && (
                    <p className="mb-3 text-[0.8125rem] text-ink-400">No sections yet. Type one below, or tap a suggested one.</p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      value={newSectionName}
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
                  {recommendations.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0 text-[0.75rem] font-semibold text-ink-600">
                          <ShieldCheck size={13} className="text-brand-500 shrink-0" />
                          <span className="truncate">Suggested sections</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addSections(recommendations)}
                          className="no-focus-ring shrink-0 text-[0.75rem] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
                        >
                          Add all
                        </button>
                      </div>
                      {/* Non-blocking advisory: these aren't required, but a report
                          built without them tends to generate incomplete. Placed above
                          the chips so the trade-off is clear before the author skips them. */}
                      <p className="mb-2.5 flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-ink-400">
                        <Info size={12} className="mt-[1.5px] shrink-0 text-ink-300" />
                        <span>Not required, but a report built without these tends to come out incomplete.</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <AnimatePresence initial={false}>
                          {recommendations.map((rec, ri) => {
                            const RecIcon = SECTION_ICONS[rec.icon] || FileText;
                            return (
                              <motion.button
                                key={rec.name}
                                type="button"
                                layout
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.94 }}
                                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1], delay: ri * 0.02 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => addSections([rec])}
                                className="no-focus-ring group/rec inline-flex items-center gap-1.5 h-8 pl-1.5 pr-3 rounded-full border border-dashed border-canvas-border bg-canvas/40 text-[0.8125rem] font-medium text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 cursor-pointer"
                              >
                                <span className="shrink-0 w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center group-hover/rec:bg-brand-600 group-hover/rec:text-white transition-colors"><RecIcon size={11} /></span>
                                {rec.name}
                              </motion.button>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
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
            </div>
          </div>
        </div>
        )}

        <div className="px-7 py-2.5 border-t border-canvas-border flex items-center justify-between gap-2 shrink-0">
          {/* Left — the way back to a report you already send. The whole offer
              lives on the start step now, so this is a quiet second door into
              the same journey, not a competing button. */}
          <div className="min-w-0 flex items-center gap-2.5">
            {stage === 'build' && (
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={isSaving || importing}
                title="Upload a past report as a PowerPoint or a PDF. We read its shape and throw away its words and numbers"
                className="inline-flex items-center gap-1.5 max-w-full text-[0.75rem] font-semibold text-ink-500 hover:text-brand-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 rounded-sm"
              >
                {importing
                  ? <><Loader2 size={14} className="animate-spin shrink-0" /> Reading your report…</>
                  : importedFrom
                    ? <><FileText size={14} className="shrink-0" /> <span className="truncate">Read from {importedFrom}</span> <span className="shrink-0 text-ink-400">· replace</span></>
                    : <><UploadCloud size={14} className="shrink-0" /> Start from a report instead</>}
              </button>
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
              in place (overwrite). Nothing exists to save on the start step. */}
          {stage === 'build' && (
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
          )}
          </div>
        </div>

        {/* Drop-to-import affordance — shown whenever a file is dragged over the
            editor. The whole modal is the drop target, so there's nothing to aim at. */}
        <AnimatePresence>
          {dragActive && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-brand-950/40 backdrop-blur-[2px] pointer-events-none"
            >
              <div className="w-full h-full rounded-lg border-2 border-dashed border-brand-300 bg-canvas-elevated/95 flex flex-col items-center justify-center gap-3 text-center px-8">
                <motion.span
                  initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                  className="w-14 h-14 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center"
                >
                  <Upload size={24} />
                </motion.span>
                <div>
                  <div className="text-[0.9375rem] font-semibold text-ink-900">Drop a past report to read its format</div>
                  <div className="mt-1 text-[0.8125rem] text-ink-500">A PowerPoint or a PDF. We keep its sections, tables, cards and letterhead, and throw away its words and numbers.</div>
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
              className="absolute inset-0 z-50 bg-canvas-elevated overflow-y-auto"
              role="status" aria-busy="true" aria-label={`Scanning ${scanningName ?? 'your document'}`}
            >
              <div className="min-h-full flex items-center justify-center px-8 py-8">
                <div className="flex w-full max-w-[740px] items-center gap-10">
                <div className="shrink-0 flex flex-col items-center">
                {/* Scanner stage — the document page under the sweeping light. */}
                <div className="relative w-[212px] h-[278px]">
                  {/* focus-frame corner brackets */}
                  {CORNERS.map((c, i) => (
                    <span key={i} className={`absolute w-5 h-5 border-brand-500/70 ${c}`} aria-hidden="true" />
                  ))}

                  <div className="absolute inset-0 rounded-lg bg-white border border-canvas-border shadow-[0_22px_50px_-20px_rgba(15,8,30,0.4)] overflow-hidden">
                    {/* the page content — reads as a real report page */}
                    <div className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-sm bg-gradient-to-br from-brand-500 to-brand-400 shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-1.5 w-20 rounded-full bg-ink-200" />
                          <div className="h-1 w-12 rounded-full bg-paper-200" />
                        </div>
                      </div>
                      <div className="mt-4 space-y-1.5">
                        <div className="h-2.5 w-11/12 rounded bg-ink-300" />
                        <div className="h-2.5 w-2/3 rounded bg-ink-300" />
                      </div>
                      <div className="mt-4 space-y-[7px]">
                        {[100, 94, 98, 86].map((w, i) => <div key={i} className="h-1.5 rounded-full bg-paper-200" style={{ width: `${w}%` }} />)}
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-1">
                        {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-3 rounded-xs bg-paper-100 border border-paper-200" />)}
                      </div>
                      <div className="mt-4 space-y-[7px]">
                        {[96, 82, 90].map((w, i) => <div key={i} className="h-1.5 rounded-full bg-paper-200" style={{ width: `${w}%` }} />)}
                      </div>
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

                {/* filename + progress, under the page being read */}
                <div className="mt-6 flex flex-col items-center text-center w-[240px] max-w-full">
                  <div className="flex items-center gap-2 max-w-full">
                    <span className="inline-flex items-center h-5 px-2 rounded-full bg-brand-600 text-white text-[0.5625rem] font-bold tracking-wider uppercase shrink-0">
                      {kindLabel}
                    </span>
                    {scanningName && <span className="text-[0.8125rem] font-medium text-ink-700 truncate">{scanningName}</span>}
                  </div>

                  <div className="mt-3.5 w-full flex items-center gap-3">
                    <div className="relative flex-1 h-2.5 rounded-full bg-brand-100 overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
                        style={{ background: 'linear-gradient(90deg, #550FA5 0%, #6A12CD 55%, #8838DE 100%)', boxShadow: '0 0 4px 0 rgba(106,18,205,0.25)' }}
                        animate={{ width: `${importProgress}%` }}
                        transition={{ ease: 'easeOut', duration: 0.2 }}
                      >
                        {/* subtle leading edge — the "scan head" */}
                        <div className="absolute right-0 inset-y-0 w-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(233,213,255,0.55))' }} />
                        {/* light sheen sweeping the fill — echoes the scan */}
                        {!reduceMotion && (
                          <motion.div
                            className="absolute inset-y-0 w-1/2"
                            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }}
                            initial={{ x: '-140%' }}
                            animate={{ x: ['-140%', '320%'] }}
                            transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.25 }}
                          />
                        )}
                      </motion.div>
                    </div>
                    <span className="text-[0.8125rem] font-bold tabular-nums text-brand-700 w-10 text-right">{Math.round(importProgress)}%</span>
                  </div>
                </div>
                </div>

                {/* The six reads, named as they run. One read, one question, so
                    a wrong answer can be pointed at the read that gave it. */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-[1rem] font-semibold text-ink-900">Reading your report</h3>
                  <p className="mt-1 text-[0.8125rem] text-ink-500 leading-relaxed">
                    {importKind === 'deck'
                      ? 'Six reads. A deck labels its own parts, so the first five have little to work out. The AI runs last, only to name what was found.'
                      : 'Six reads. Five are just measuring; the AI runs last, only to name what the measuring found.'}
                  </p>
                  <ol className="mt-4 space-y-0.5">
                    {passes.map((p, i) => {
                      const done = i < importMsgIdx;
                      const active = i === importMsgIdx;
                      return (
                        <li key={p.title} className={`flex items-start gap-3 rounded-md px-2.5 py-2 transition-colors ${active ? 'bg-brand-50/70' : ''}`}>
                          <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-canvas-border bg-white text-ink-400">
                            {done ? <Check size={12} className="text-compliant-600" />
                              : active ? <Loader2 size={12} className="animate-spin motion-reduce:animate-none text-brand-600" />
                              : <span className="text-[0.625rem] font-semibold tabular-nums">{i + 1}</span>}
                          </span>
                          <div className="min-w-0">
                            <p className={`text-[0.8125rem] font-medium ${done || active ? 'text-ink-900' : 'text-ink-400'}`}>{p.title}</p>
                            <p className="text-[0.75rem] text-ink-500 leading-relaxed">{p.question}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => setMinimized(true)}
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-[0.8125rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
                    >
                      <Minimize2 size={15} aria-hidden="true" /> Minimize
                    </button>
                    <p className="text-[0.6875rem] text-ink-400">It keeps running in the background. Keep working.</p>
                  </div>
                </div>
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
            // The check queue: one of the four named situations, or a detector
            // that could not call it cleanly. Both go first on the list.
            const shaky = reviewSections.filter(s =>
              s.evidence !== 'added'
              && (!!s.flag || (s.confidence !== undefined && s.confidence <= SHAKY_CONFIDENCE))).length;
            // Some decks are built free-hand: text boxes drawn anywhere, titles
            // typed into plain boxes. Those lose their labels and get read by
            // position and size instead, the way a PDF is, so it is worth saying.
            const freehandDeck = pendingImport.result?.unit === 'slide'
              && reviewSections.length > 0
              && reviewSections.filter(s => s.evidence === 'inferred').length > reviewSections.length * 0.4;
            return (
              <motion.div
                initial={{ opacity: 1, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 z-40 bg-canvas-elevated flex flex-col"
              >
                <header className="shrink-0 px-7 py-2.5 border-b border-canvas-border flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><FileText size={16} /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight truncate">What we found in {pendingImport.fileName}</h3>
                        <span className="shrink-0 inline-flex items-center rounded-full bg-paper-100 text-ink-500 text-[0.625rem] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5">{kindLabel}</span>
                      </div>
                      {/* Don't make them choose: every dropdown is already set,
                          so the job here is verify, not decide. */}
                      <p className="text-[0.75rem] text-ink-500 leading-snug">
                        We kept {kept.length} section{kept.length === 1 ? '' : 's'} we can fill from your audit results. Confirm, rename, reorder or untick them.
                        {dropped.length > 0 && <> The other sections from your report are not included, and they are listed at the end with the reason.</>}
                        {shaky > 0 && <span className="text-mitigated-700 font-medium"> {shaky} we are unsure about, listed first.</span>}
                        {freehandDeck && <span className="text-mitigated-700"> This deck looks hand built, with text typed into plain boxes rather than the title and layout slots, so we read it by position and size. Worth a closer look than usual.</span>}
                      </p>
                    </div>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} onClick={cancelImport} aria-label="Cancel import" className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"><X size={16} /></motion.button>
                </header>
                <div className="flex-1 min-h-0 px-6 py-4 flex flex-col">
                  <SectionReviewCanvas
                    sections={reviewSections}
                    onSectionsChange={setReviewSections}
                    pages={pendingImport.result?.pages}
                    pageCount={pendingImport.result?.pageCount}
                    toc={pendingImport.result?.toc}
                    unit={pendingImport.result?.unit ?? 'page'}
                    notIncluded={dropped}
                    // Their captured letterhead where the read found one, the
                    // editor's own live values next, the platform's defaults
                    // last. Built in one place with the Bring Your Own Template
                    // tab's review, so the cover approved here is the cover the
                    // save produces whichever door they came through.
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
                <footer className="shrink-0 px-7 py-2.5 border-t border-canvas-border flex items-center justify-between gap-4">
                  {/* The trade-off, said here rather than after they export
                      something and find the gap. */}
                  <div className="min-w-0">
                    <span className="block text-[0.75rem] text-ink-500">
                      {kept.length} section{kept.length === 1 ? '' : 's'} kept, none of their words · {hasLetterhead ? 'letterhead captured' : 'no letterhead found'}
                    </span>
                    <span className="block text-[0.6875rem] text-ink-400 leading-snug">
                      We make the findings and the summary in your format. What was checked, replies from management and admin pages come in one report at a time.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <motion.button whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} onClick={cancelImport} className="inline-flex items-center justify-center h-9 px-5 text-[0.875rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 rounded-md transition-colors cursor-pointer">
                      {importBanner ? 'Cancel' : 'Discard'}
                    </motion.button>
                    <motion.button whileTap={namedCount === 0 ? undefined : { scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} onClick={applyImport} disabled={namedCount === 0} className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-brand-600 text-white text-[0.875rem] font-semibold transition-colors rounded-md enabled:hover:bg-brand-500 enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
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
        open={suggestedConfirm !== null}
        onClose={() => setSuggestedConfirm(null)}
        onConfirm={() => { setSuggestedConfirm(null); handleSave(false, true); }}
        title="Create without the suggested sections?"
        description={
          <>Your template is missing {suggestedConfirm?.length} suggested section{suggestedConfirm?.length === 1 ? '' : 's'} ({suggestedConfirm?.join(', ')}). A report built without {suggestedConfirm?.length === 1 ? 'it' : 'them'} may come out incomplete. You can go back and add {suggestedConfirm?.length === 1 ? 'it' : 'them'}, or create the template as is.</>
        }
        confirmLabel="Create anyway"
        cancelLabel="Go back and add"
      />
      <ConfirmDialog
        open={dupConfirm !== null}
        onClose={() => setDupConfirm(null)}
        onConfirm={() => { setDupConfirm(null); handleSave(true, true); }}
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

