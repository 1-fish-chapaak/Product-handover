// Template authoring + apply surfaces, extracted from ReportsView:
//   • TemplateEditor       — the brand/theme/header-footer/arrangement editor
//   • ApplyTemplateDropdown — pick a template to apply to an open report
//   • ReportSectionBlock — internal draggable report-styled section
// (mergeTemplateOptions lives in reportShared so this module exports only
//  components, keeping React Fast Refresh intact.)
// Depends only on the shared keystone, ReportDocumentChrome, and ConfirmDialog.

import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import {
  Check, ChevronRight, FileText, GripVertical,
  Loader2, Plus, X, Pencil, ShieldCheck, Trash2,
  BookOpen, Search, Upload, Info, Maximize2, Minimize2,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { REPORT_TEMPLATES } from '../../data/mockData';
import { ReportBrandBanner, ReportSignoffBlock } from './ReportDocumentChrome';
import ConfirmDialog from './ConfirmDialog';
import {
  ICON_MAP, CATEGORY_COLORS, SECTION_ICONS, TEMPLATE_THEME_GRADIENT, TEMPLATE_THEME_SWATCH, TEMPLATE_THEME_ACCENT,
  sectionBlurb, DEFAULT_WATERMARK, reportGradient, reportAccent, DEFAULT_SIGNATORIES,
  type EditableTemplate, type WatermarkConfig,
  type TemplateSection, type SignatorySlot,
} from './reportShared';
import { extractReportStructure, type ReportStructure } from './extractPdfHeaderFooter';
import SectionReviewCanvas from './SectionReviewCanvas';
import { RowDeleteButton } from './RowDeleteButton';
import { type CanvasSection } from './sectionReviewShared';
import { useAuditLog } from '../../context/AdminDataContext';

// Soft length guide for letterhead header/footer text — past this the counter
// turns amber and a hint warns about truncation, but saving is never blocked.
const LETTERHEAD_SOFT_MAX = 60;

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

// "Import from a report" extraction theatre — staged status while the PDF is read.
// A short minimum on-screen time so the scan doesn't flicker on fast parses, but
// no longer padded to feel "deliberate": the moment the parse finishes, sections
// land straight in the outline (optimistic apply) and the overlay dismisses.
const IMPORT_SCAN_MESSAGES = [
  'Reading the document…',
  'Detecting structure…',
  'Extracting sections…',
];
// Word/PowerPoint aren't parsed, so their scan copy doesn't claim extraction —
// it says what actually happens: a suggested outline is prepared.
const SEED_SCAN_MESSAGES = [
  'Reading the document…',
  'Preparing a suggested outline…',
];
const IMPORT_MIN_MS = 850;
// Fail a PDF parse that hasn't settled by here, so the progress card can't hang.
const EXTRACT_TIMEOUT_MS = 30000;

// Accepted source formats for "Import from a report". A PDF's structure (section
// headings) and letterhead are read for real and land in the review canvas. Word
// and PowerPoint layout detection isn't built yet, so those don't get parsed —
// they seed a suggested outline instead, and the UI says so plainly rather than
// pretending it read sections from the file (no false promise).
const IMPORT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx';
type ImportKind = 'pdf' | 'word' | 'ppt';
const IMPORT_KIND_LABEL: Record<ImportKind, string> = { pdf: 'PDF', word: 'Word', ppt: 'PowerPoint' };
function classifyImport(name: string): ImportKind | null {
  if (/\.pdf$/i.test(name)) return 'pdf';
  if (/\.docx?$/i.test(name)) return 'word';
  if (/\.pptx?$/i.test(name)) return 'ppt';
  return null;
}
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
  filename, messages = IMPORT_SCAN_MESSAGES, done = false, sectionCount,
  onMinimize, onOpen, onClose,
}: {
  filename: string;
  messages?: string[];
  done?: boolean;
  sectionCount?: number;
  onMinimize?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(8);
  useEffect(() => {
    if (done) return;
    const step = Math.max(300, Math.floor(IMPORT_MIN_MS / messages.length));
    const t = setInterval(() => setMsgIdx(i => Math.min(i + 1, messages.length - 1)), step);
    return () => clearInterval(t);
  }, [messages, done]);
  useEffect(() => {
    if (done) return;
    // Ease toward ~95% while extraction runs; real completion flips to done.
    const t = setInterval(() => setProgress(p => (p < 95 ? p + Math.max(1, Math.round((95 - p) / 10)) : p)), 240);
    return () => clearInterval(t);
  }, [done]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <motion.div
      role="status"
      aria-label={done ? 'Extraction complete' : `Extracting ${filename}`}
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="fixed bottom-5 right-5 z-[80] w-[360px] max-w-[calc(100vw-2.5rem)] rounded-[14px] border border-canvas-border bg-white shadow-[0_16px_40px_-12px_rgba(15,8,30,0.28)] p-4"
    >
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${done ? 'bg-compliant-50 text-compliant-600' : 'bg-brand-50 text-brand-600'}`}>
          {done ? <Check size={16} strokeWidth={2.5} /> : <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[0.8125rem] font-semibold text-ink-900 leading-tight">{done ? 'Extraction complete' : 'Extracting your report'}</div>
          <div className="text-[0.75rem] text-ink-500 truncate mt-0.5">
            {done
              ? (sectionCount != null ? `${sectionCount} section${sectionCount === 1 ? '' : 's'} ready to review` : 'Ready to review')
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
        <span className="text-[0.6875rem] text-ink-400">{done ? 'Your report is ready.' : 'Running in the background. Keep working.'}</span>
        {onOpen ? (
          <button onClick={onOpen} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[8px] text-[0.75rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 cursor-pointer transition-colors">
            <Maximize2 size={13} /> Open
          </button>
        ) : onMinimize ? (
          <button onClick={onMinimize} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[8px] text-[0.75rem] font-semibold text-ink-700 border border-canvas-border bg-white hover:bg-paper-50 cursor-pointer transition-colors">
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
      className="absolute right-0 top-full mt-1.5 w-[300px] bg-white rounded-[12px] shadow-[0_16px_40px_-12px_rgba(15,8,30,0.22)] border border-canvas-border z-50 overflow-hidden"
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
            className="w-full h-9 pl-9 pr-8 rounded-[8px] bg-canvas border border-canvas-border text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:bg-white focus:border-brand-600/40 transition-colors"
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
              className={`group/item relative w-full text-left px-3 py-2.5 rounded-[8px] transition-all duration-150 cursor-pointer flex items-center gap-2.5 ${isActive ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-brand-50'}`}
            >
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-brand-600" aria-hidden="true" />}
              <div className={`p-1.5 rounded-[8px] transition-colors ${CATEGORY_COLORS[rt.category] || 'text-ink-500 bg-paper-50'}`}>
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
            className="w-full text-left px-3 py-2.5 rounded-[8px] transition-colors cursor-pointer flex items-center gap-2.5 hover:bg-brand-50 group/save"
          >
            <div className="p-1.5 rounded-[8px] text-ink-500 bg-paper-50 group-hover/save:text-brand-600">
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

function ReportSectionBlock({ section, index, onMove, listRef, onDelete, onRename, onDescribe }: {
  section: TemplateSection;
  index: number;
  onMove: (from: number, to: number) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  onDelete: () => void;
  onRename: (name: string) => void;
  onDescribe: (description: string) => void;
}) {
  const kind = section.kind ?? 'text';
  const metric = section.metric?.trim();
  const typeLabel = kind === 'kpi' ? 'KPI' : kind === 'table' ? 'Table' : kind === 'chart' ? 'Chart' : null;
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
          className="no-focus-ring w-7 h-7 flex items-center justify-center rounded-[7px] text-ink-400 hover:text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors"
        >
          <Pencil size={14} />
        </button>
        <RowDeleteButton
          onConfirm={onDelete}
          ariaLabel={`Delete ${section.name}`}
          triggerClassName="no-focus-ring w-7 h-7 flex items-center justify-center rounded-[7px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors"
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
              className="min-w-0 flex-1 -my-0.5 px-1.5 py-0.5 rounded-[6px] bg-white border border-brand-400 text-[1.25rem] font-semibold text-ink-900 tracking-[-0.012em] leading-[1.15] focus:outline-none focus:ring-2 focus:ring-brand-600/30"
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
        {kind === 'kpi' ? (
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <div className="text-[1.75rem] font-bold text-ink-300 leading-none tabular-nums">—</div>
              <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mt-1.5">{metric || 'Metric'}</div>
            </div>
            <p className="text-[0.75rem] text-ink-400 leading-relaxed">KPI filled from query data at generation.</p>
          </div>
        ) : kind === 'chart' ? (
          <div className="max-w-[75%]">
            <div className="flex items-end gap-1.5 h-14">
              {(section.chartType ?? 'bar') === 'bar'
                ? [40, 68, 30, 82, 54, 72].map((h, k) => <div key={k} className="flex-1 rounded-t-[3px] bg-canvas-border" style={{ height: `${h}%` }} />)
                : <svg viewBox="0 0 120 40" className="w-full h-full text-canvas-border" preserveAspectRatio="none"><polyline points="0,32 24,20 48,26 72,10 96,16 120,6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}
            </div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mt-2">{metric || 'Metric'} · {(section.chartType ?? 'bar')} chart</p>
          </div>
        ) : kind === 'table' ? (
          <div className="max-w-[90%] rounded-[6px] overflow-hidden border border-canvas-border">
            <div className="grid grid-cols-4 bg-canvas">
              {Array.from({ length: 4 }).map((_, c) => <div key={c} className="h-4 border-r last:border-r-0 border-canvas-border" />)}
            </div>
            {Array.from({ length: 3 }).map((_, r) => (
              <div key={r} className="grid grid-cols-4 border-t border-canvas-border">
                {Array.from({ length: 4 }).map((_, c) => <div key={c} className="h-4 border-r last:border-r-0 border-canvas-border" />)}
              </div>
            ))}
          </div>
        ) : editingDesc ? (
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
            className="w-full max-w-[80ch] resize-none rounded-[6px] bg-white border border-brand-400 px-2 py-1.5 text-[0.875rem] text-ink-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          />
        ) : (
          <p
            onDoubleClick={startDescEdit}
            title="Double-click to edit this description"
            className={`max-w-[80ch] text-[0.875rem] leading-relaxed cursor-text rounded-[4px] -mx-1 px-1 hover:bg-canvas/60 transition-colors ${section.description ? 'text-ink-600' : 'text-ink-500'}`}
          >
            {shownDesc}
          </p>
        )}
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
  const defaultName = initialName ?? template.name;
  const [copyName, setCopyName] = useState(defaultName);
  const [brand, setBrand] = useState(template.brand ?? 'Irame');
  const [theme, setTheme] = useState(template.theme ?? 'Purple & White');
  // Custom brand colour (hex). Empty = use the named theme. When set (and valid)
  // it drives the cover gradient + body accent everywhere the report renders.
  // Cover gradient + accent for the live preview, driven by the named theme.
  const coverGradient = reportGradient(theme, '') ?? TEMPLATE_THEME_GRADIENT['Purple & White'];
  const coverAccent = reportAccent(theme, '');
  const [headerText, setHeaderText] = useState(template.headerText ?? 'Confidential — For Internal Use Only');
  // Footer auto-tracks the brand ("Generated by <brand>") until the author edits it
  // directly; an existing saved footer or an imported one counts as customised.
  const [footerText, setFooterText] = useState(template.footerText ?? `Generated by ${template.brand ?? 'Irame'}`);
  const [footerCustom, setFooterCustom] = useState(!!template.footerText);
  useEffect(() => {
    if (!footerCustom) setFooterText(`Generated by ${brand.trim() || 'Irame'}`);
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
  const addSignatory = () => setSignatories(prev => [...prev, { id: `sig-${Date.now()}`, role: '' }]);
  const updateSignatory = (id: string, patch: Partial<SignatorySlot>) => setSignatories(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  const removeSignatory = (id: string) => setSignatories(prev => prev.filter(s => s.id !== id));
  // Persisted signatory list: drop empty rows, trim, keep only real content.
  const cleanSignatories: SignatorySlot[] = signatories
    .filter(s => s.role.trim() || (s.name ?? '').trim())
    .map(s => ({ id: s.id, role: s.role.trim() || 'Signatory', ...(s.name?.trim() ? { name: s.name.trim() } : {}) }));
  const logEvent = useAuditLog();
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

  // ── Import from a report ──────────────────────────────────────────────────
  // Reads an existing PDF report and pre-fills the outline + letterhead, so the
  // author starts from the real document instead of a blank page. This is the
  // merged "Upload template" path, folded into the editor (one creation surface).
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [scanningName, setScanningName] = useState<string | null>(null);
  // Whether the in-progress scan is a Word/PowerPoint seed (vs a real PDF parse) —
  // drives the honest overlay copy.
  const [scanSeed, setScanSeed] = useState(false);
  // Minimize-and-continue: when true the editor collapses to the bottom-right
  // extraction card and the full modal isn't rendered, so extraction keeps
  // running (this component stays mounted) with the app fully usable behind it.
  const [minimized, setMinimized] = useState(false);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  // Drag-and-drop: drop a report anywhere on the editor to import it. A depth
  // counter avoids the flicker that dragenter/dragleave cause over child nodes.
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  // After a successful extraction the detected sections land in the shared review
  // canvas (§4) for curation — nothing is applied to the outline until the author
  // confirms. This is the same detect-and-curate step the format-check modal uses,
  // so "import" behaves identically to "upload".
  // The curation canvas is now opt-in (opened from the post-import banner's
  // "Review"), not a required gate. pendingImport drives that on-demand canvas;
  // reviewSections is its working copy while open.
  const [pendingImport, setPendingImport] = useState<{ fileName: string; kind: ImportKind; result: ReportStructure | null } | null>(null);
  const [reviewSections, setReviewSections] = useState<CanvasSection[]>([]);
  // Optimistic apply: detected sections + letterhead land in the outline the
  // moment the parse finishes. This banner then offers Undo (revert the whole
  // import in one tap) and Review (open the curation canvas). Curation is a
  // choice, not a step — the common path is one gesture: pick file → done.
  type ImportSnapshot = { sections: typeof sections; headerText: string; footerText: string; brand: string; copyName: string; importedFrom: string | null };
  const [importBanner, setImportBanner] = useState<
    { fileName: string; kind: ImportKind; result: ReportStructure | null; detected: CanvasSection[]; count: number; gotLetterhead: boolean } | null
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
    secs: CanvasSection[], result: ReportStructure | null, fileName: string,
  ): { count: number; gotLetterhead: boolean } => {
    const hf = result?.headerFooter;
    if (hf?.confidentiality || hf?.header.length) setHeaderText(hf.confidentiality || hf.header.join('  ·  '));
    // Apply the PDF's own footer when it has one, and mark it customised so the
    // "footer follows brand" effect doesn't immediately overwrite it back to
    // "Generated by <brand>".
    if (hf?.footer.length) { setFooterText(hf.footer.join('  ·  ')); setFooterCustom(true); }
    if (hf?.fields.auditEntity) setBrand(hf.fields.auditEntity);
    // Name: only fill if still the untouched default, and never fill a name that
    // already exists — a fresh import landing on an instant "already exists" error
    // reads as a failure. Suffix "(2)", "(3)"… until unique.
    const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (copyName === defaultName) {
      const candidate = hf?.fields.auditTitle || base.replace(/\b\w/g, c => c.toUpperCase());
      setCopyName(uniqueTemplateName(candidate));
    }
    const kept = secs.filter(s => s.name.trim());
    setSections(kept.map(s => ({
      name: s.name.trim(),
      icon: 'file-text',
      ...(s.description ? { description: s.description } : {}),
      ...(s.kind && s.kind !== 'text' ? { kind: s.kind } : {}),
      ...(s.metric ? { metric: s.metric } : {}),
    })));
    setImportedFrom(fileName);
    return { count: kept.length, gotLetterhead: !!hf };
  };

  const handleImportFile = async (file: File) => {
    const kind = classifyImport(file.name);
    if (!kind) {
      addToast({ type: 'error', message: 'Import reads PDF, Word or PowerPoint files.' });
      return;
    }

    // Word / PowerPoint: their layout can't be read yet, so we don't fabricate
    // "detected" sections from the file. We seed the suggested outline, capture
    // no letterhead, and the banner + toast say plainly that it's a starting
    // point, not an extraction. Refine inline from there. It still runs through
    // the same scan theatre (min on-screen time) so the upload feels consistent
    // with the PDF path rather than snapping in instantly.
    if (kind !== 'pdf') {
      setScanSeed(true);
      setImporting(true);
      setScanningName(file.name);
      await new Promise(resolve => setTimeout(resolve, IMPORT_MIN_MS));
      setImporting(false);
      setScanningName(null);
      const seeded: CanvasSection[] = SUGGESTED_SECTIONS.map((s, i) => ({
        id: `seed-${i}-${s.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: s.name,
        evidence: 'added',
      }));
      preImportRef.current = { sections, headerText, footerText, brand, copyName, importedFrom };
      const { count } = applyToOutline(seeded, null, file.name);
      setImportBanner({ fileName: file.name, kind, result: null, detected: seeded, count, gotLetterhead: false });
      addToast({ type: 'info', message: `${IMPORT_KIND_LABEL[kind]} layout can’t be read yet, so we started you with a suggested outline. Refine it below.` });
      return;
    }

    // Read the PDF for real — structure preserved with evidence + source lines.
    setScanSeed(false);
    setImporting(true);
    setScanningName(file.name);
    // Guard the parse with a timeout so a hung read (e.g. the pdf.js worker
    // failing to load) can't leave the progress card stuck forever — after
    // EXTRACT_TIMEOUT_MS it falls through to the error path below.
    let result: ReportStructure | null = null;
    try {
      const [res] = await Promise.all([
        Promise.race([
          extractReportStructure(file),
          new Promise<ReportStructure | null>((_, reject) =>
            setTimeout(() => reject(new Error('extract-timeout')), EXTRACT_TIMEOUT_MS)),
        ]),
        new Promise(resolve => setTimeout(resolve, IMPORT_MIN_MS)),
      ]);
      result = res;
    } catch {
      result = null;
    } finally {
      setImporting(false);
      setScanningName(null);
    }
    if (!result) {
      // Restore the editor if it was minimized, so the failure isn't hidden
      // behind a card that would otherwise read as "complete".
      setMinimized(false);
      addToast({ type: 'error', message: `Couldn't read "${file.name}". It may be scanned, image-only, or too large.` });
      return;
    }
    const detected: CanvasSection[] = result.sections.map((s, i) => ({
      id: `imp-${i}-${s.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: stripLeadingEnumerator(s.name),
      evidence: s.evidence,
      kind: s.kind,
      metric: s.metric,
      // Only text sections carry a source preview; kpi/chart/table are empty
      // placeholders, so they show on the right with a type chip, not the left.
      source: s.kind === 'text' ? s.body : undefined,
    }));

    // Snapshot pre-import state, then apply optimistically and raise the banner.
    preImportRef.current = { sections, headerText, footerText, brand, copyName, importedFrom };
    const { count, gotLetterhead } = applyToOutline(detected, result, file.name);
    setImportBanner({ fileName: file.name, kind, result, detected, count, gotLetterhead });

    // §4.5 — headings with no content beneath aren't auto-added, but never silently
    // dropped: tell the user and offer a one-tap add-back.
    const skipped = result?.skipped ?? [];
    if (skipped.length > 0) {
      addToast({
        type: 'info',
        message: `Skipped ${skipped.length} empty heading${skipped.length === 1 ? '' : 's'} (no content beneath): ${skipped.map(s => `"${s}"`).join(', ')}.`,
        secondaryAction: {
          label: `Add ${skipped.length === 1 ? 'it' : 'all'}`,
          onClick: () => setSections(prev => {
            const have = new Set(prev.map(s => s.name.toLowerCase()));
            return [...prev, ...skipped.filter(s => !have.has(s.toLowerCase())).map(s => ({ name: s, icon: 'file-text' }))];
          }),
        },
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
    }
    preImportRef.current = null;
    setImportBanner(null);
    setPendingImport(null);
    setReviewSections([]);
    addToast({ type: 'info', message: 'Imported file removed.' });
  };
  // Review — open the curation canvas, seeded from the detected sections.
  const openReview = () => {
    if (!importBanner) return;
    setReviewSections(importBanner.detected);
    setPendingImport({ fileName: importBanner.fileName, kind: importBanner.kind, result: importBanner.result });
  };
  // Cancel the review canvas — the already-applied import is untouched.
  const cancelImport = () => { setPendingImport(null); };
  // Confirm the review: re-apply the curated sections and keep the banner (and
  // its one-tap Undo, still pointing at the pre-import snapshot) in sync.
  const applyImport = () => {
    if (!pendingImport) return;
    const { count, gotLetterhead } = applyToOutline(reviewSections, pendingImport.result, pendingImport.fileName);
    setImportBanner(b => (b ? { ...b, detected: reviewSections, count, gotLetterhead } : b));
    setPendingImport(null);
  };

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
    brand: template.brand ?? 'Irame',
    theme: template.theme ?? 'Purple & White',
    headerText: template.headerText ?? 'Confidential — For Internal Use Only',
    footerText: template.footerText ?? `Generated by ${template.brand ?? 'Irame'}`,
    sections: seededSections,
    watermark: template.watermark ?? DEFAULT_WATERMARK,
    pageNumbers: template.pageNumbers ?? true,
    signoffEnabled: template.signoffEnabled ?? false,
    signatories: template.signatories ?? [],
  }));
  const isDirty =
    copyName !== initial.copyName ||
    brand !== initial.brand ||
    theme !== initial.theme ||
    headerText !== initial.headerText ||
    footerText !== initial.footerText ||
    sections !== initial.sections ||
    watermark !== initial.watermark ||
    pageNumbers !== initial.pageNumbers ||
    signoffEnabled !== initial.signoffEnabled ||
    signatories !== initial.signatories;

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

  // Land focus in the name field on open and select its text, so typing replaces
  // the "Untitled Template" default rather than shipping it verbatim (#1).
  useEffect(() => {
    const t = setTimeout(() => { const el = copyNameRef.current; if (el) { el.focus(); el.select(); } }, 80);
    return () => clearTimeout(t);
  }, []);

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
    // New templates only, and only when some suggested sections are still absent.
    if (isNew && !skipSuggested && recommendations.length > 0) {
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
          headerText: headerText.trim(),
          footerText: footerText.trim(),
          watermark,
          pageNumbers,
          signoffEnabled,
          signatories: cleanSignatories,
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
              headerText: headerText.trim(),
            footerText: footerText.trim(),
            watermark,
            pageNumbers,
            signoffEnabled,
            signatories: cleanSignatories,
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
        messages={scanSeed ? SEED_SCAN_MESSAGES : IMPORT_SCAN_MESSAGES}
        done={!importing}
        sectionCount={!importing ? importBanner?.count : undefined}
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
        className="relative bg-canvas-elevated rounded-[16px] border border-canvas-border shadow-xl w-[1040px] max-w-[95vw] h-[662px] max-h-[90vh] overflow-hidden flex flex-col"
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
        <div className="px-7 py-2.5 border-b border-canvas-border flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><FileText size={16} /></div>
            <div className="min-w-0">
              <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight">{isNew ? 'Create template' : 'Edit template'}</h3>
              <p className="text-[0.75rem] text-ink-500 leading-snug truncate">{isNew ? 'A reusable layout for your reports' : template.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <motion.button whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} onClick={attemptClose} aria-label="Close" className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"><X size={16} /></motion.button>
          </div>
        </div>

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
                    <div className="border border-risk-200 bg-risk-50 rounded-[8px] px-3 py-2.5 text-[0.75rem] text-risk-800">
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
              <div role="tablist" aria-label="Template settings" className="relative flex p-1 bg-canvas rounded-[10px] gap-1">
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
                      className={`relative flex-1 h-8 rounded-[7px] text-[0.75rem] font-semibold cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${active ? 'text-brand-700' : 'text-ink-600 hover:text-ink-900'}`}
                    >
                      {active && (
                        <motion.span
                          layoutId="template-panel-pill"
                          transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
                          className="absolute inset-0 rounded-[7px] bg-white border border-canvas-border shadow-[0_1px_2px_rgba(15,8,30,0.08)]"
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
                    <FieldLabel required>Template name</FieldLabel>
                    <input ref={copyNameRef} value={copyName} onChange={e => setCopyName(e.target.value)} aria-invalid={nameTaken}
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
                      <input value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="Confidential — For Internal Use Only" className="w-full h-10 px-3 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                      {headerText.length > LETTERHEAD_SOFT_MAX && <p className="mt-1 text-[0.6875rem] text-risk-600">Long header text may be truncated in the letterhead.</p>}
                    </div>
                    <div>
                      <FieldLabel
                        right={<span className={`text-[0.6875rem] tabular-nums ${footerText.length > LETTERHEAD_SOFT_MAX ? 'text-risk-600 font-medium' : 'text-ink-400'}`}>{footerText.length}/{LETTERHEAD_SOFT_MAX}</span>}
                      >Footer text</FieldLabel>
                      <input value={footerText} onChange={e => { setFooterCustom(true); setFooterText(e.target.value); }} placeholder={`Generated by ${brand.trim() || 'Irame'}`} className="w-full h-10 px-3 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
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
                          className={`no-focus-ring flex items-center gap-2 rounded-[10px] border pl-2 pr-2.5 py-2 text-left transition-all cursor-pointer ${active ? 'border-brand-600 ring-2 ring-brand-600/15 bg-brand-50/40' : 'border-canvas-border bg-white hover:border-brand-300 hover:bg-canvas/40'}`}
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
                    <span className="text-[0.625rem] font-semibold uppercase tracking-[0.13em] text-ink-400">Signature block <span className="font-normal normal-case tracking-normal text-ink-400">· sign-off section on the report</span></span>
                    <Toggle checked={signoffEnabled} onChange={toggleSignoff} label="Enable signature block" />
                  </div>
                  {signoffEnabled && (
                    <div className="mt-3 space-y-2">
                      {signatories.length === 0 && (
                        <p className="text-[0.6875rem] text-ink-400">Add the roles that sign this report (e.g. Prepared by, Approved by).</p>
                      )}
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
                          <button type="button" onClick={() => removeSignatory(s.id)} aria-label={`Remove ${s.role || 'signatory'}`} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[7px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                        </div>
                      ))}
                      <button type="button" onClick={addSignatory} className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer"><Plus size={13} /> Add signatory</button>
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
                      <div className="inline-flex p-0.5 bg-canvas rounded-[8px] gap-0.5">
                        {(['text', 'image'] as const).map(m => (
                          <button key={m} type="button" onClick={() => setWm({ mode: m })}
                            className={`h-7 px-3 rounded-[6px] text-[0.75rem] font-semibold capitalize transition-colors cursor-pointer ${watermark.mode === m ? 'bg-white border border-canvas-border text-brand-700 shadow-[0_1px_2px_rgba(15,8,30,0.08)]' : 'text-ink-500 hover:text-ink-800'}`}>
                            {m}
                          </button>
                        ))}
                      </div>

                      {watermark.mode === 'text' ? (
                        <input value={watermark.text} onChange={e => setWm({ text: e.target.value })} placeholder="CONFIDENTIAL"
                          className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[0.875rem] uppercase tracking-wide transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                      ) : (
                        <>
                          <input ref={watermarkImgInputRef} type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, url => setWm({ imageDataUrl: url })); if (watermarkImgInputRef.current) watermarkImgInputRef.current.value = ''; }} />
                          {watermark.imageDataUrl ? (
                            <div className="flex items-center gap-3 rounded-[10px] border border-canvas-border bg-canvas p-2.5">
                              <div className="h-11 w-16 rounded-[6px] bg-white border border-canvas-border flex items-center justify-center overflow-hidden shrink-0">
                                <img src={watermark.imageDataUrl} alt="Watermark" className="max-h-9 max-w-[56px] object-contain" />
                              </div>
                              <button type="button" onClick={() => watermarkImgInputRef.current?.click()} className="text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer">Replace</button>
                              <button type="button" onClick={() => setWm({ imageDataUrl: undefined })} className="ml-auto text-[0.75rem] font-medium text-ink-400 hover:text-risk-600 transition-colors cursor-pointer">Remove</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => watermarkImgInputRef.current?.click()}
                              className="w-full flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-canvas-border bg-canvas/40 px-3 py-3 text-[0.8125rem] font-medium text-ink-500 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/30 transition-colors cursor-pointer">
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
                                className={`h-7 rounded-[6px] text-[0.6875rem] font-semibold capitalize transition-colors cursor-pointer ${active ? 'bg-brand-50 text-brand-700 border border-brand-300' : 'bg-canvas border border-canvas-border text-ink-500 hover:text-ink-800 hover:border-ink-300'}`}
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
            {/* Post-import banner — the sections below are ALREADY applied. This is
                the whole "flow": pick a file, it lands, and this offers to Review
                (curate in the canvas) or Undo (revert the entire import). */}
            <AnimatePresence>
              {importBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                  className="shrink-0 px-6 pt-4"
                >
                  <div className="flex items-center gap-3 rounded-[12px] border border-brand-200 bg-brand-50/70 px-4 py-2.5">
                    <span className="w-7 h-7 rounded-full bg-compliant-500 text-white flex items-center justify-center shrink-0"><Check size={15} strokeWidth={2.5} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-semibold text-ink-900 leading-tight">
                        {importBanner.kind === 'pdf'
                          ? <>Imported {importBanner.count} section{importBanner.count === 1 ? '' : 's'}{importBanner.gotLetterhead ? ' + letterhead' : ''}</>
                          : <>Started a suggested outline ({importBanner.count} section{importBanner.count === 1 ? '' : 's'})</>}
                      </p>
                      <p className="text-[0.75rem] text-ink-500 leading-tight truncate">
                        {importBanner.kind === 'pdf'
                          ? <>from {importBanner.fileName} · edit inline below</>
                          : <>{importBanner.fileName} · {IMPORT_KIND_LABEL[importBanner.kind]} layout isn’t read yet · edit inline below</>}
                      </p>
                    </div>
                    <button
                      type="button" onClick={openReview}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-white border border-brand-200 text-brand-700 text-[0.75rem] font-semibold hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
                    ><Pencil size={13} /> Review</button>
                    <button
                      type="button" onClick={() => setConfirmRemoveImport(true)} aria-label="Remove imported file"
                      title="Remove imported file"
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
              <div className="relative mx-auto w-full max-w-3xl rounded-[12px] shadow-[0_10px_34px_-14px_rgba(15,8,30,0.22)]" style={{ '--rep-accent': coverAccent } as CSSProperties}>
                <ReportBrandBanner
                  title={copyName || 'Untitled Template'}
                  titleClassName="text-[1.5rem]"
                  className="rounded-t-[12px]"
                  gradient={coverGradient}
                  headerText={headerText}
                  footer={
                    /* All report facts live in the letterhead as one full-width
                       strip — no duplicated meta panel below. */
                    <div className="grid grid-cols-3 gap-6">
                      {[
                        { label: 'Brand', value: brand || 'Irame' },
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
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* Composer — add a section, in the flow of the document (not a
                    detached toolbar). Suggested sections sit right beneath it. */}
                <div ref={sectionsRef} tabIndex={-1} className="border-x border-canvas-border bg-white px-9 pt-5 pb-7">
                  {sections.length === 0 && (
                    <p className="mb-3 text-[0.8125rem] text-ink-400">This report has no sections yet — add one below, or tap a suggested section.</p>
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
                        <Info size={12} className="mt-[1.5px] shrink-0 text-brand-400" />
                        <span>Recommended, not required. Skipping these may leave parts of the generated report incomplete.</span>
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

                {/* Footer strip — closes the page. With page numbers on, the
                    footer text sits left and a page number sits right, mirroring
                    the numbered footer the export produces. */}
                <div className={`border-x border-b border-canvas-border bg-canvas/60 rounded-b-[12px] px-9 py-3 flex items-center ${pageNumbers ? 'justify-between' : 'justify-center'}`}>
                  <span className="text-[0.6875rem] text-ink-400 tracking-wide">{footerText || `Generated by ${brand.trim() || 'Irame'}`}</span>
                  {pageNumbers && <span className="text-[0.6875rem] text-ink-400 tabular-nums tracking-wide">Page 1</span>}
                </div>

                {/* Watermark — a diagonal text/image mark stamped across the page. */}
                {watermark.enabled && (watermark.mode === 'text' ? watermark.text.trim() : watermark.imageDataUrl) && (
                  <div className={`pointer-events-none absolute inset-0 z-[6] flex overflow-hidden rounded-[12px] ${WATERMARK_POS[watermark.position ?? 'center']}`}>
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

        <div className="px-7 py-2.5 border-t border-canvas-border flex items-center justify-between gap-2 shrink-0">
          {/* Left — import from a report (the merged "Upload template" path). A PDF
              is read for its outline + letterhead; Word/PowerPoint seed a suggested
              outline. Drop a file anywhere on the editor, or click to browse. */}
          <div className="min-w-0 flex items-center gap-2.5">
            <input ref={importInputRef} type="file" accept={IMPORT_ACCEPT} className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); if (importInputRef.current) importInputRef.current.value = ''; }} />
            <motion.button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={isSaving || importing}
              whileTap={isSaving || importing ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              title="Start from an existing report — a PDF's outline + letterhead are detected; Word/PowerPoint seed a suggested outline"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] border border-canvas-border bg-white text-brand-700 text-[0.8125rem] font-semibold transition-colors hover:bg-brand-50 hover:border-brand-300 cursor-pointer disabled:opacity-60 disabled:cursor-wait max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
            >
              {importing
                ? <><Loader2 size={15} className="animate-spin shrink-0" /> Reading the report…</>
                : importedFrom
                  ? <><FileText size={15} className="shrink-0" /> <span className="truncate">Imported · {importedFrom}</span> <Upload size={13} className="shrink-0 opacity-70" /></>
                  : <><Upload size={15} className="shrink-0" /> Import from a report</>}
            </motion.button>
            {!importing && !importedFrom && (
              <span className="hidden sm:inline text-[0.6875rem] text-ink-400 whitespace-nowrap">or drop a PDF. Word &amp; PowerPoint seed an outline.</span>
            )}
          </div>
          {/* Right — primary actions. */}
          <div className="flex items-center gap-2 shrink-0">
          <motion.button
            onClick={attemptClose}
            disabled={isSaving}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[0.875rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
          >Cancel</motion.button>
          {/* New templates create a fresh entry; existing custom templates save
              in place (overwrite). */}
          <motion.button
            onClick={() => handleSave()}
            disabled={isSaving || nameTaken || !copyName.trim()}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            title={nameTaken ? 'A template with this name already exists — choose a different name' : undefined}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-brand-600 text-white rounded-[8px] text-[0.875rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
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
              <div className="w-full h-full rounded-[14px] border-2 border-dashed border-brand-300 bg-canvas-elevated/95 flex flex-col items-center justify-center gap-3 text-center px-8">
                <motion.span
                  initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                  className="w-14 h-14 rounded-[14px] bg-brand-50 text-brand-600 flex items-center justify-center"
                >
                  <Upload size={24} />
                </motion.span>
                <div>
                  <div className="text-[0.9375rem] font-semibold text-ink-900">Drop a PDF, Word or PowerPoint file to import</div>
                  <div className="mt-1 text-[0.8125rem] text-ink-500">A PDF's outline + letterhead are detected; Word/PowerPoint start a suggested outline</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Import-from-a-report extraction theatre — covers the editor while the
            PDF is read, then dismisses as the fields populate. */}
        <AnimatePresence>
          {importing && <ExtractionCard filename={scanningName ?? 'your report'} messages={scanSeed ? SEED_SCAN_MESSAGES : IMPORT_SCAN_MESSAGES} onMinimize={() => setMinimized(true)} />}
        </AnimatePresence>

        {/* Import review step — the shared "AI proposes, the human curates" canvas.
            Detected sections are curated here before anything touches the outline,
            so importing behaves exactly like the format-check upload flow (§4). */}
        <AnimatePresence>
          {pendingImport && (() => {
            const namedCount = reviewSections.filter(s => s.name.trim()).length;
            const hasLetterhead = !!pendingImport.result?.headerFooter;
            const kindLabel = IMPORT_KIND_LABEL[pendingImport.kind];
            return (
              <motion.div
                initial={{ opacity: 1, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 z-40 bg-canvas-elevated flex flex-col"
              >
                <header className="shrink-0 px-7 py-2.5 border-b border-canvas-border flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><FileText size={16} /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight">Review detected sections</h3>
                        <span className="shrink-0 inline-flex items-center rounded-full bg-paper-100 text-ink-500 text-[0.625rem] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5">{kindLabel}</span>
                      </div>
                      <p className="text-[0.75rem] text-ink-500 leading-snug truncate">
                        From {pendingImport.fileName} — already in your outline. Refine here, then apply.
                      </p>
                    </div>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} onClick={cancelImport} aria-label="Cancel import" className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"><X size={16} /></motion.button>
                </header>
                <div className="flex-1 min-h-0 px-6 py-4 flex flex-col">
                  <SectionReviewCanvas
                    sections={reviewSections}
                    onSectionsChange={setReviewSections}
                    reportChrome={{
                      title: copyName || 'Untitled Template',
                      desc: template.desc,
                      brand,
                      headerText,
                      footerText,
                      gradient: TEMPLATE_THEME_GRADIENT[theme],
                      accent: TEMPLATE_THEME_ACCENT[theme],
                    }}
                  />
                </div>
                <footer className="shrink-0 px-7 py-2.5 border-t border-canvas-border flex items-center justify-between gap-2">
                  <span className="text-[0.75rem] text-ink-500">
                    {namedCount} section{namedCount === 1 ? '' : 's'} · {hasLetterhead ? 'letterhead captured' : 'no letterhead found'}
                  </span>
                  <div className="flex items-center gap-2">
                    <motion.button whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} onClick={cancelImport} className="inline-flex items-center justify-center h-9 px-5 text-[0.875rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer">Discard</motion.button>
                    <motion.button whileTap={namedCount === 0 ? undefined : { scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} onClick={applyImport} disabled={namedCount === 0} className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-brand-600 text-white text-[0.875rem] font-semibold transition-colors rounded-[8px] enabled:hover:bg-brand-500 enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      Use these sections
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
        title="Remove imported file?"
        description={
          <>This clears the {importBanner?.count ?? ''} imported section{importBanner?.count === 1 ? '' : 's'}{importBanner?.gotLetterhead ? ' and letterhead' : ''}{importBanner?.fileName ? <> from <span className="font-semibold">{importBanner.fileName}</span></> : ''}. You can import again anytime.</>
        }
        confirmLabel="Remove"
        destructive
      />
    </motion.div>
  );
}

