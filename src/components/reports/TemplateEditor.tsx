// Template authoring + apply surfaces, extracted from ReportsView:
//   • TemplateEditor       — the brand/theme/header-footer/arrangement editor
//   • ApplyTemplateDropdown — pick a template to apply to an open report
//   • ReportSectionBlock — internal draggable report-styled section
// (mergeTemplateOptions lives in reportShared so this module exports only
//  components, keeping React Fast Refresh intact.)
// Depends only on the shared keystone, ReportDocumentChrome, and ConfirmDialog.

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import {
  Check, ChevronRight, FileText, GripVertical,
  Loader2, Plus, Trash2, X, Pencil,
  ShieldCheck, BookOpen, Search, Upload, RotateCcw,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { REPORT_TEMPLATES } from '../../data/mockData';
import { ReportBrandBanner } from './ReportDocumentChrome';
import ConfirmDialog from './ConfirmDialog';
import {
  ICON_MAP, CATEGORY_COLORS, SECTION_ICONS, TEMPLATE_THEME_GRADIENT,
  typeSectionsFor, sectionCoverage, DEFAULT_WATERMARK,
  type ReportTypeName, type EditableTemplate, type WatermarkConfig,
  type TemplateSection,
} from './reportShared';
import { extractReportStructure, type ReportStructure } from './extractPdfHeaderFooter';
import SectionReviewCanvas from './SectionReviewCanvas';
import { type CanvasSection } from './sectionReviewShared';
import { useAuditLog } from '../../context/AdminDataContext';

// Soft length guide for letterhead header/footer text — past this the counter
// turns amber and a hint warns about truncation, but saving is never blocked.
const LETTERHEAD_SOFT_MAX = 60;

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
// A minimum on-screen time so the scan reads as deliberate work, not a flicker,
// even when the parse finishes in a few hundred ms.
const IMPORT_SCAN_MESSAGES = [
  'Reading the document…',
  'Detecting document structure…',
  'Extracting the letterhead…',
  'Identifying section headings…',
  'Finalizing the import…',
];
const IMPORT_MIN_MS = 2600;

// Accepted source formats for "Import from a report". PDF is read for real —
// its structure (section headings) and letterhead are detected and land in the
// review canvas. Word and PowerPoint are accepted so the author can start from
// the real deliverable, but layout auto-detection is PDF-only today, so those
// seed the review canvas with the report type's recommended outline instead.
// Honest by design (mirrors the upload modal's "Excel & CSV read for real").
const IMPORT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx';
type ImportKind = 'pdf' | 'word' | 'ppt';
const IMPORT_KIND_LABEL: Record<ImportKind, string> = { pdf: 'PDF', word: 'Word', ppt: 'PowerPoint' };
function classifyImport(name: string): ImportKind | null {
  if (/\.pdf$/i.test(name)) return 'pdf';
  if (/\.docx?$/i.test(name)) return 'word';
  if (/\.pptx?$/i.test(name)) return 'ppt';
  return null;
}

// Full-bleed scan overlay shown over the editor while a report is being imported.
// Reuses the upload flow's sweep-beam language so the wait feels transparent.
function ImportScanOverlay({ filename }: { filename: string }) {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const step = Math.floor(IMPORT_MIN_MS / IMPORT_SCAN_MESSAGES.length);
    const t = setInterval(() => setMsgIdx(i => Math.min(i + 1, IMPORT_SCAN_MESSAGES.length - 1)), step);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-30 bg-canvas-elevated/96 backdrop-blur-[2px] flex items-center justify-center px-8"
    >
      <div className="w-[440px] max-w-full">
        <div className="flex items-center gap-2 text-[0.875rem]">
          <span className="w-7 h-7 rounded-[8px] bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Loader2 size={15} className="animate-spin" /></span>
          <span className="font-semibold text-ink-900 truncate">Reading {filename}</span>
        </div>
        {/* progress bar — eases toward full over the minimum scan time */}
        <div className="mt-3 h-1 w-full rounded-full bg-paper-100 overflow-hidden">
          <motion.div className="h-full rounded-full bg-brand-500" initial={{ width: '6%' }} animate={{ width: '94%' }} transition={{ duration: IMPORT_MIN_MS / 1000, ease: [0.2, 0, 0, 1] }} />
        </div>
        {/* A real report page being scanned — purple letterhead, section headings,
            body text and a footer, with a brand scan-line sweeping top→bottom. */}
        <div className="relative mt-4 h-[224px] rounded-[12px] border border-canvas-border bg-paper-50 overflow-hidden flex justify-center pt-3.5">
          <div className="relative w-[208px] rounded-[7px] bg-white shadow-[0_8px_24px_-8px_rgba(15,8,30,0.28)] overflow-hidden">
            {/* letterhead */}
            <div className="px-3 py-2.5" style={{ backgroundImage: 'linear-gradient(125deg, #3b0b72, #6a12cd)' }}>
              <div className="h-1.5 w-2/3 rounded-full bg-white/45" />
              <div className="h-1 w-2/5 rounded-full bg-white/25 mt-1.5" />
            </div>
            {/* body — section headings (darker) + paragraph lines */}
            <div className="px-3 py-2.5 space-y-1.5">
              <div className="h-1.5 w-2/5 rounded-full bg-ink-900/30" />
              <div className="h-1 w-full rounded-full bg-ink-900/10" />
              <div className="h-1 w-11/12 rounded-full bg-ink-900/10" />
              <div className="h-1.5 w-1/3 rounded-full bg-ink-900/30 mt-2.5" />
              <div className="h-1 w-full rounded-full bg-ink-900/10" />
              <div className="h-1 w-3/4 rounded-full bg-ink-900/10" />
            </div>
            {/* footer */}
            <div className="px-3 py-1.5 border-t border-canvas-border flex items-center justify-between">
              <div className="h-1 w-1/3 rounded-full bg-ink-900/15" />
              <div className="h-1 w-5 rounded-full bg-ink-900/10" />
            </div>
            {/* scan line sweeping the page */}
            <motion.div
              className="pointer-events-none absolute inset-x-0 h-10"
              initial={{ top: '-2.5rem' }} animate={{ top: ['-2.5rem', '100%'] }}
              transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="h-10 w-full bg-gradient-to-b from-brand-500/20 to-transparent" />
              <div className="h-[2px] w-full -mt-px bg-gradient-to-r from-transparent via-brand-400 to-transparent shadow-[0_0_14px_3px_rgba(106,18,205,0.45)]" />
            </motion.div>
          </div>
        </div>
        {/* cycling status line */}
        <div className="mt-3.5 flex items-center gap-2 text-[0.8125rem] text-ink-600">
          <AnimatePresence mode="wait">
            <motion.span
              key={msgIdx}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {IMPORT_SCAN_MESSAGES[msgIdx]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
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

function ReportSectionBlock({ section, index, onMove, listRef, onDelete, onRename }: {
  section: TemplateSection;
  index: number;
  onMove: (from: number, to: number) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  onDelete: () => void;
  onRename: (name: string) => void;
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
          onClick={startEdit}
          aria-label={`Rename ${section.name}`}
          className="no-focus-ring w-7 h-7 flex items-center justify-center rounded-[7px] text-ink-400 hover:text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          aria-label={`Delete ${section.name}`}
          className="no-focus-ring w-7 h-7 flex items-center justify-center rounded-[7px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Editorial numbered heading — matches the report reader. Double-click or the
          hover pencil turns it into an inline rename field. */}
      <div className="flex items-start justify-between gap-4 pr-16">
        <div className="flex items-baseline gap-3.5 min-w-0 flex-1">
          <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums tracking-[0.16em] text-brand-700 leading-none">{String(index + 1).padStart(2, '0')}</span>
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
      <span className="mt-3 block h-[2px] w-8 rounded-full bg-brand-500/80" aria-hidden="true" />

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
        ) : (
          <p className="max-w-[80ch] text-[0.875rem] text-ink-500 leading-relaxed">{sectionBlurb(section.name)}</p>
        )}
      </div>
    </motion.div>
  );
}

// Templates only produce the Internal Audit report; the report type is fixed, so
// there's no picker — recommendations and coverage always use Internal Audit.
const REPORT_TYPE: ReportTypeName = 'Audit';
const REPORT_TYPE_LABEL = 'Internal Audit';

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
  const [headerText, setHeaderText] = useState(template.headerText ?? 'Confidential — For Internal Use Only');
  const [footerText, setFooterText] = useState(template.footerText ?? 'Generated by Irame');
  // Tags (§9) — free-form labels for findability once the library grows.
  const [tags, setTags] = useState<string[]>(template.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const addTag = (raw: string) => {
    const t = raw.trim().replace(/,$/, '').trim();
    if (!t) return;
    setTags(prev => prev.some(x => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]);
    setTagDraft('');
  };
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
  // New (blank) templates open with a default 10-section skeleton so the author
  // reorders rather than starting from an empty outline; a brand-new template
  // starts EMPTY and is built up from the type's recommended sections.
  const seededSections = (template.sections && template.sections.length > 0)
    ? template.sections
    : [];
  const [sections, setSections] = useState(seededSections);
  // Templates only produce the Internal Audit report, so the type is fixed — it
  // drives the §4.6 recommended sections + coverage, but there's no picker.
  const reportType = REPORT_TYPE;
  const reportTypeLabel = REPORT_TYPE_LABEL;
  // Left settings column is split into two segmented groups so the form reads as
  // a structured panel instead of a flat six-field stack.
  const [panel, setPanel] = useState<'identity' | 'branding'>('identity');

  const addSections = (list: { name: string; icon: string }[]) => {
    if (!list.length) return;
    setSections(prev => {
      const have = new Set(prev.map(s => s.name.toLowerCase()));
      const fresh = list.filter(s => !have.has(s.name.toLowerCase()));
      return [...prev, ...fresh.map(s => ({ name: s.name, icon: s.icon }))];
    });
  };
  const coverage = sectionCoverage(reportType, sections.map(s => s.name));

  // ── Import from a report ──────────────────────────────────────────────────
  // Reads an existing PDF report and pre-fills the outline + letterhead, so the
  // author starts from the real document instead of a blank page. This is the
  // merged "Upload template" path, folded into the editor (one creation surface).
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [scanningName, setScanningName] = useState<string | null>(null);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  // Drag-and-drop: drop a report anywhere on the editor to import it. A depth
  // counter avoids the flicker that dragenter/dragleave cause over child nodes.
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  // After a successful extraction the detected sections land in the shared review
  // canvas (§4) for curation — nothing is applied to the outline until the author
  // confirms. This is the same detect-and-curate step the format-check modal uses,
  // so "import" behaves identically to "upload".
  const [pendingImport, setPendingImport] = useState<{ fileName: string; kind: ImportKind; result: ReportStructure | null } | null>(null);
  const [reviewSections, setReviewSections] = useState<CanvasSection[]>([]);
  const handleImportFile = async (file: File) => {
    const kind = classifyImport(file.name);
    if (!kind) {
      addToast({ type: 'error', message: 'Import reads PDF, Word or PowerPoint files. Choose a .pdf, .doc, .docx, .ppt or .pptx.' });
      return;
    }
    // Word / PowerPoint: layout detection isn't available for these yet, so we
    // don't run the scan theatre (nothing is being read). Instead seed the review
    // canvas with the type's recommended outline — an honest head start from the
    // real file — and let the author curate it exactly like a detected outline.
    if (kind !== 'pdf') {
      const recs = typeSectionsFor(reportType);
      setReviewSections(recs.map((r, i) => ({
        id: `imp-${i}-${r.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: r.name,
        evidence: 'added',
        kind: 'text',
      })));
      setPendingImport({ fileName: file.name, kind, result: null });
      return;
    }
    setImporting(true);
    setScanningName(file.name);
    try {
      // Run the real extraction, but keep the scan on screen for a minimum time so
      // the wait reads as deliberate work rather than a flicker.
      const [result] = await Promise.all([
        extractReportStructure(file),
        new Promise(resolve => setTimeout(resolve, IMPORT_MIN_MS)),
      ]);
      if (!result) {
        addToast({ type: 'error', message: `Couldn't read "${file.name}". It may be scanned or image-only.` });
        return;
      }
      // Seed the review canvas from the detected sections (evidence + source lines
      // preserved), then open the curation step. Letterhead/name/brand are applied
      // on confirm, so cancelling discards the whole import cleanly.
      setReviewSections(result.sections.map((s, i) => ({
        id: `imp-${i}-${s.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: s.name,
        evidence: s.evidence,
        kind: s.kind,
        metric: s.metric,
        // Only text sections carry a source preview; kpi/chart/table are empty
        // placeholders, so they show on the right with a type chip, not the left.
        source: s.kind === 'text' ? s.body : undefined,
      })));
      setPendingImport({ fileName: file.name, kind, result });
    } finally {
      setImporting(false);
      setScanningName(null);
    }
  };

  const cancelImport = () => { setPendingImport(null); setReviewSections([]); };
  // Confirm the review: apply the curated sections + captured letterhead to the
  // editor. Empty-named rows are dropped; §4.5 skipped headings are offered back.
  const applyImport = () => {
    if (!pendingImport) return;
    const { fileName, result } = pendingImport;
    const hf = result?.headerFooter;
    if (hf?.confidentiality || hf?.header.length) setHeaderText(hf.confidentiality || hf.header.join('  ·  '));
    if (hf?.footer.length) setFooterText(hf.footer.join('  ·  '));
    if (hf?.fields.auditEntity) setBrand(hf.fields.auditEntity);
    // Name: only fill if still the untouched default.
    const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (copyName === defaultName) setCopyName(hf?.fields.auditTitle || base.replace(/\b\w/g, c => c.toUpperCase()));
    // Curated sections → outline (named rows only, order preserved). Placeholder
    // blocks (kpi/chart/table) keep their type + label so they land typed, not text.
    const kept = reviewSections.filter(s => s.name.trim());
    setSections(kept.map(s => ({
      name: s.name.trim(),
      icon: 'file-text',
      ...(s.kind && s.kind !== 'text' ? { kind: s.kind } : {}),
      ...(s.metric ? { metric: s.metric } : {}),
    })));
    setImportedFrom(fileName);
    const gotLetterhead = !!hf;
    addToast({
      type: 'success',
      message: kept.length > 0
        ? `Imported ${kept.length} section${kept.length === 1 ? '' : 's'}${gotLetterhead ? ' and the letterhead' : ''} from "${fileName}".`
        : gotLetterhead
          ? `Imported the letterhead from "${fileName}". No sections kept — add them below.`
          : `Started from "${fileName}". No sections kept — add them below.`,
    });
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
    setPendingImport(null);
    setReviewSections([]);
  };

  // Recommended sections for the chosen type that aren't in the outline yet.
  // Re-derives whenever the type or current sections change.
  const recommendations = typeSectionsFor(reportType).filter(
    rec => !sections.some(s => s.name.toLowerCase() === rec.name.toLowerCase()),
  );

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
  // Missing a required (🔒) section warns but never walls — save proceeds through
  // a confirmation (PRD §4.6: "skippable with a confirmation, not a wall").
  const [missingConfirm, setMissingConfirm] = useState<string[] | null>(null);
  // Near-duplicate structure warning (§9) — the section overlap with the closest
  // existing template, surfaced at save to kill "Copy of…" sprawl.
  const [dupConfirm, setDupConfirm] = useState<{ name: string; shared: number; total: number } | null>(null);
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
    footerText: template.footerText ?? 'Generated by Irame',
    sections: seededSections,
    watermark: template.watermark ?? DEFAULT_WATERMARK,
    tags: template.tags ?? [],
  }));
  const isDirty =
    copyName !== initial.copyName ||
    brand !== initial.brand ||
    theme !== initial.theme ||
    headerText !== initial.headerText ||
    footerText !== initial.footerText ||
    sections !== initial.sections ||
    watermark !== initial.watermark ||
    tags !== initial.tags;

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
  useFocusTrap(containerRef, true, attemptClose);

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

  const handleSave = (skipMissing = false, skipDup = false) => {
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
    // Soft block: missing a required (🔒) section for this type asks once, then
    // saves anyway on confirm — never an absolute wall. New-from-scratch only;
    // an uploaded/existing template's own sections are authoritative (§4.6).
    if (isNew && !skipMissing && coverage.missingRequired.length > 0) {
      setMissingConfirm(coverage.missingRequired.map(s => s.name));
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
          category: reportType,
          sections,
          brand: brand.trim(),
          theme,
          headerText: headerText.trim(),
          footerText: footerText.trim(),
          watermark,
          tags,
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
            category: reportType,
            sections,
            brand: brand.trim(),
            theme,
            headerText: headerText.trim(),
            footerText: footerText.trim(),
            watermark,
            tags,
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
            <button onClick={attemptClose} aria-label="Close" className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"><X size={16} /></button>
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
                {errors.length > 0 && (
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
                        {errors.map(err => (
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
                {/* Details holds only the template's properties — name, brand, tags
                    and letterhead. Section-building lives in the roomy right pane
                    (next to its preview), so this column stays short and calm. */}
                <div className="space-y-4">
                  <div>
                    <FieldLabel required>Template name</FieldLabel>
                    <input ref={copyNameRef} value={copyName} onChange={e => setCopyName(e.target.value)} aria-invalid={nameTaken}
                      placeholder="e.g. Internal Audit Report"
                      className={`w-full h-10 px-3 rounded-lg border text-[0.8125rem] transition-colors placeholder:text-ink-400 focus:outline-none focus:ring-2 ${nameTaken ? 'border-mitigated/60 focus:border-mitigated focus:ring-mitigated/10' : 'border-canvas-border hover:border-ink-300 focus:border-brand-600/40 focus:ring-brand-600/10'}`} />
                    {nameTaken && <p className="mt-1 text-[0.6875rem] text-mitigated-700">A template named “{copyName.trim()}” already exists — saving creates a copy.</p>}
                  </div>
                  <div>
                    <FieldLabel>Brand name</FieldLabel>
                    <input ref={brandRef} value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Irame" className="w-full h-10 px-3 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors placeholder:text-ink-400 hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                    <p className="mt-1 text-[0.6875rem] text-ink-400">The organisation shown on the report cover and letterhead.</p>
                  </div>
                  <div>
                    <FieldLabel>Tags</FieldLabel>
                    <div className="w-full flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-lg border border-canvas-border bg-white transition-colors focus-within:border-brand-600/40 focus-within:ring-2 focus-within:ring-brand-600/10">
                      {tags.map(t => (
                        <span key={t} className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full bg-brand-50 text-brand-700 text-[0.75rem] font-medium">
                          {t}
                          <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} aria-label={`Remove tag ${t}`} className="w-4 h-4 inline-flex items-center justify-center rounded-full text-brand-500 hover:text-brand-800 hover:bg-brand-100 transition-colors cursor-pointer"><X size={11} /></button>
                        </span>
                      ))}
                      <input
                        value={tagDraft}
                        onChange={e => setTagDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagDraft); }
                          else if (e.key === 'Backspace' && !tagDraft && tags.length) setTags(prev => prev.slice(0, -1));
                        }}
                        onBlur={() => addTag(tagDraft)}
                        placeholder={tags.length ? 'Add…' : 'e.g. quarterly, ISO 27001, EMEA'}
                        className="flex-1 min-w-[90px] h-6 bg-transparent text-[0.8125rem] outline-none placeholder:text-ink-400"
                      />
                    </div>
                    <p className="mt-1 text-[0.6875rem] text-ink-400">Press Enter or comma to add. Tags make this template easier to find.</p>
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
                      <input value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="Generated by Irame" className="w-full h-10 px-3 rounded-lg border border-canvas-border text-[0.8125rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
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
                  {/* Theme cards — the actual cover gradient as a swatch, so the
                      combination reads at a glance. */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: 'Purple & White', palette: ['#2e0a52', '#6a12cd', '#a855f7', '#ede9fe'] },
                      { name: 'Navy & Gold', palette: ['#0f1830', '#1a2744', '#c5a55a', '#ece1c5'] },
                      { name: 'Teal & Light', palette: ['#075e54', '#0d9488', '#5eead4', '#e6fffb'] },
                      { name: 'Slate & Blue', palette: ['#1e293b', '#334155', '#3b82f6', '#bfdbfe'] },
                    ].map((t, ti) => {
                      const active = theme === t.name;
                      return (
                        <motion.button
                          key={t.name}
                          type="button"
                          onClick={() => setTheme(t.name)}
                          aria-pressed={active}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: ti * 0.04 }}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className={`no-focus-ring rounded-[12px] border p-2 text-left transition-all cursor-pointer ${active ? 'border-brand-600 ring-2 ring-brand-600/15 bg-brand-50/30' : 'border-canvas-border bg-white hover:border-brand-300 hover:shadow-[0_2px_8px_rgba(15,8,30,0.06)]'}`}
                        >
                          {/* The actual cover gradient (not flat swatches) so the
                              preview matches what this theme produces (#8). */}
                          <div
                            className="h-9 rounded-[8px] ring-1 ring-inset ring-black/[0.06]"
                            style={{ backgroundImage: `linear-gradient(125deg, ${TEMPLATE_THEME_GRADIENT[t.name][0]} 0%, ${TEMPLATE_THEME_GRADIENT[t.name][1]} 62%, ${TEMPLATE_THEME_GRADIENT[t.name][1]} 100%)` }}
                          />
                          <div className="flex items-center justify-between gap-1 px-1 pt-1.5 pb-0.5">
                            <span className={`text-[0.75rem] font-medium truncate ${active ? 'text-brand-700' : 'text-ink-700'}`}>{t.name}</span>
                            {active && (
                              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} className="shrink-0 w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center">
                                <Check size={10} strokeWidth={3} />
                              </motion.span>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
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
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right pane — a working preview of the report on a desk. A thin
              builder toolbar (add + recommended) sits on top; below it the
              template renders as the report page it will produce: gradient
              letterhead cover, editorial numbered sections, footer strip. */}
          <div className="relative flex-1 min-w-0 flex flex-col bg-canvas min-h-0">
            {/* The report page — a white sheet on the canvas desk. Sections and the
                composer that adds them both live INSIDE the page, the way the
                finished report reads; there's no separate toolbar on top. */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
              <div className="relative mx-auto w-full max-w-3xl rounded-[12px] shadow-[0_10px_34px_-14px_rgba(15,8,30,0.22)]">
                <ReportBrandBanner
                  title={copyName || 'Untitled Template'}
                  titleClassName="text-[1.5rem]"
                  className="rounded-t-[12px]"
                  gradient={TEMPLATE_THEME_GRADIENT[theme]}
                  headerText={headerText}
                  footer={
                    /* All report facts live in the letterhead as one full-width
                       strip — no duplicated meta panel below. */
                    <div className="grid grid-cols-4 gap-6">
                      {[
                        { label: 'Brand', value: brand || 'Irame' },
                        { label: 'Report Type', value: reportTypeLabel },
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
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* Composer — add a section, in the flow of the document (not a
                    detached toolbar). Recommended sections sit right beneath it. */}
                <div ref={sectionsRef} tabIndex={-1} className="border-x border-canvas-border bg-white px-9 pt-5 pb-7">
                  {sections.length === 0 && (
                    <p className="mb-3 text-[0.8125rem] text-ink-400">This report has no sections yet — add one below, or tap a recommended section.</p>
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
                          <span className="truncate">Recommended for {reportTypeLabel}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addSections(recommendations)}
                          className="no-focus-ring shrink-0 text-[0.75rem] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
                        >
                          Add all
                        </button>
                      </div>
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

                {/* Footer strip — closes the page. */}
                <div className="border-x border-b border-canvas-border bg-canvas/60 rounded-b-[12px] px-9 py-3 flex items-center justify-center">
                  <span className="text-[0.6875rem] text-ink-400 tracking-wide">{footerText || 'Generated by Irame'}</span>
                </div>

                {/* Watermark — a diagonal text/image mark stamped across the page. */}
                {watermark.enabled && (watermark.mode === 'text' ? watermark.text.trim() : watermark.imageDataUrl) && (
                  <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center overflow-hidden rounded-[12px]">
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
          {/* Left — import from a report (the merged "Upload template" path). Reads
              a PDF for its outline + letterhead; Word/PPT start from the recommended
              outline. Drop a file anywhere on the editor, or click to browse. */}
          <div className="min-w-0 flex items-center gap-2.5">
            <input ref={importInputRef} type="file" accept={IMPORT_ACCEPT} className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); if (importInputRef.current) importInputRef.current.value = ''; }} />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={isSaving || importing}
              title="Start from an existing report — PDF (outline + letterhead detected), Word or PowerPoint"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] border border-canvas-border bg-white text-brand-700 text-[0.8125rem] font-semibold transition-colors hover:bg-brand-50 hover:border-brand-300 cursor-pointer disabled:opacity-60 disabled:cursor-wait max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
            >
              {importing
                ? <><Loader2 size={15} className="animate-spin shrink-0" /> Reading the report…</>
                : importedFrom
                  ? <><FileText size={15} className="shrink-0" /> <span className="truncate">Imported · {importedFrom}</span> <RotateCcw size={13} className="shrink-0 opacity-70" /></>
                  : <><Upload size={15} className="shrink-0" /> Import from a report</>}
            </button>
            {!importing && !importedFrom && (
              <span className="hidden sm:inline text-[0.6875rem] text-ink-400 whitespace-nowrap">or drop a PDF, Word or PowerPoint file</span>
            )}
          </div>
          {/* Right — primary actions. */}
          <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={attemptClose}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[0.875rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
          >Cancel</button>
          {/* New templates create a fresh entry; existing custom templates save
              in place (overwrite). */}
          <button
            onClick={() => handleSave()}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-brand-600 text-white rounded-[8px] text-[0.875rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
          >
            {isSaving && <Loader2 size={12} className="animate-spin" />}
            {isSaving ? 'Saving…' : isNew ? 'Create template' : 'Save template'}
          </button>
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
                  <div className="text-[0.9375rem] font-semibold text-ink-900">Drop to import from a report</div>
                  <div className="mt-1 text-[0.8125rem] text-ink-500">PDF, Word or PowerPoint · we detect the outline from PDFs</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Import-from-a-report extraction theatre — covers the editor while the
            PDF is read, then dismisses as the fields populate. */}
        <AnimatePresence>
          {importing && <ImportScanOverlay filename={scanningName ?? 'your report'} />}
        </AnimatePresence>

        {/* Import review step — the shared "AI proposes, the human curates" canvas.
            Detected sections are curated here before anything touches the outline,
            so importing behaves exactly like the format-check upload flow (§4). */}
        <AnimatePresence>
          {pendingImport && (() => {
            const namedCount = reviewSections.filter(s => s.name.trim()).length;
            const isPdf = pendingImport.kind === 'pdf';
            const hasLetterhead = !!pendingImport.result?.headerFooter;
            const kindLabel = IMPORT_KIND_LABEL[pendingImport.kind];
            return (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                className="absolute inset-0 z-40 bg-canvas-elevated flex flex-col"
              >
                <header className="shrink-0 px-6 pt-3 pb-3 border-b border-canvas-border flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><FileText size={16} /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight">{isPdf ? 'Review detected sections' : 'Review the recommended outline'}</h3>
                        <span className="shrink-0 inline-flex items-center rounded-full bg-paper-100 text-ink-500 text-[0.625rem] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5">{kindLabel}</span>
                      </div>
                      <p className="text-[0.75rem] text-ink-500 leading-snug truncate">
                        {isPdf
                          ? <>From {pendingImport.fileName} — curate before adding to the outline.</>
                          : <>Layout detection isn't available for {kindLabel} yet — start from the recommended {reportTypeLabel} outline, then adjust.</>}
                      </p>
                    </div>
                  </div>
                  <button onClick={cancelImport} aria-label="Cancel import" className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0"><X size={16} /></button>
                </header>
                <div className="flex-1 min-h-0 px-6 py-4 flex flex-col">
                  <SectionReviewCanvas
                    sections={reviewSections}
                    onSectionsChange={setReviewSections}
                    reportType={reportType}
                    reportTypeLabel={reportTypeLabel}
                  />
                </div>
                <footer className="shrink-0 px-6 py-3.5 border-t border-canvas-border flex items-center justify-between gap-3">
                  <span className="text-[0.75rem] text-ink-500">
                    {namedCount} section{namedCount === 1 ? '' : 's'} · {isPdf ? (hasLetterhead ? 'letterhead captured' : 'no letterhead found') : `recommended ${reportTypeLabel} outline`}
                  </span>
                  <div className="flex items-center gap-3">
                    <button onClick={cancelImport} className="inline-flex items-center justify-center h-9 px-4 text-[0.8125rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 transition-colors cursor-pointer rounded-[8px]">Cancel</button>
                    <button onClick={applyImport} disabled={namedCount === 0} className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-brand-600 text-white text-[0.8125rem] font-semibold transition-colors rounded-[8px] enabled:hover:bg-brand-500 enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      Use {namedCount} section{namedCount === 1 ? '' : 's'}
                    </button>
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
        open={missingConfirm !== null}
        onClose={() => setMissingConfirm(null)}
        onConfirm={() => { setMissingConfirm(null); handleSave(true); }}
        title={`Save without ${missingConfirm && missingConfirm.length > 1 ? 'these sections' : 'this section'}?`}
        description={
          <>A standard <span className="font-semibold">{reportTypeLabel}</span> report usually includes {missingConfirm?.map(n => `“${n}”`).join(', ')}. You can save without {missingConfirm && missingConfirm.length > 1 ? 'them' : 'it'} and add {missingConfirm && missingConfirm.length > 1 ? 'them' : 'it'} later.</>
        }
        confirmLabel="Save anyway"
      />
      <ConfirmDialog
        open={dupConfirm !== null}
        onClose={() => setDupConfirm(null)}
        onConfirm={() => { setDupConfirm(null); handleSave(true, true); }}
        title="Nearly identical template?"
        description={
          <>This shares {dupConfirm?.shared} of {dupConfirm?.total} sections with <span className="font-semibold">“{dupConfirm?.name}”</span>. Create it as a separate template anyway, or Cancel to edit the existing one instead.</>
        }
        confirmLabel="Create anyway"
      />
    </motion.div>
  );
}

