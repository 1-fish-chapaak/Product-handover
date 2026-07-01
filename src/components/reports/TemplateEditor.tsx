// Template authoring + apply surfaces, extracted from ReportsView:
//   • TemplateEditor       — the brand/theme/header-footer/arrangement editor
//   • ApplyTemplateDropdown — pick a template to apply to an open report
//   • TemplateSectionRow / TemplateCarousel — internal helpers
// (mergeTemplateOptions lives in reportShared so this module exports only
//  components, keeping React Fast Refresh intact.)
// Depends only on the shared keystone, ReportDocumentChrome, and ConfirmDialog.

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import {
  Check, ChevronDown, ChevronRight, FileText, GripVertical, Image, Layout,
  Loader2, Palette, Plus, Trash2, Type, X,
  Tag, ShieldCheck, BookOpen, Search, Upload, RotateCcw, Sparkles, History,
  Library, BookmarkPlus, Hash, BarChart3, AlignLeft,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { REPORT_TEMPLATES } from '../../data/mockData';
import { ReportBrandBanner } from './ReportDocumentChrome';
import ConfirmDialog from './ConfirmDialog';
import {
  ICON_MAP, CATEGORY_COLORS, SECTION_ICONS, TEMPLATE_THEME_GRADIENT,
  REPORT_TYPES, typeSectionsFor, sectionCoverage, DEFAULT_WATERMARK, TEMPLATE_STATUS_META,
  type ReportTypeName, type EditableTemplate, type WatermarkConfig,
  type TemplateStatus, type TemplateVersion, type TemplateSection, type SectionKind,
} from './reportShared';
import { extractReportStructure } from './extractPdfHeaderFooter';
import { loadSectionLibrary, addToSectionLibrary, type LibrarySection } from './sectionLibrary';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useAuditLog } from '../../context/AdminDataContext';

// Soft length guide for letterhead header/footer text — past this the counter
// turns amber and a hint warns about truncation, but saving is never blocked.
const LETTERHEAD_SOFT_MAX = 60;

// Consistent field label: a brand-tinted icon tile + label, with optional
// right-aligned content (e.g. a character counter). Matches the editor's accent
// tiles so the form reads as a designed panel, not a flat icon+text stack.
function FieldLabel({ icon: Icon, children, right, required }: { icon: typeof FileText; children: ReactNode; right?: ReactNode; required?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <span className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink-800">
        <span className="w-6 h-6 rounded-[7px] bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Icon size={13} /></span>
        {children}{required && <span className="text-risk-600" title="Required">*</span>}
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

// Compact, freely-draggable section row for the left-hand outline editor. The
// row can be picked up by its grip and moved in ANY direction (not locked to a
// vertical rail); on release it snaps into the slot nearest the drop point, so
// dragging left↔right works as well as up↕down. Reordering drives the same
// `sections` state the document preview renders from.
// Block-type registry (§4.7) — text / KPI / chart, with their row icon + label.
const BLOCK_KINDS: { kind: SectionKind; label: string; icon: typeof FileText }[] = [
  { kind: 'text', label: 'Text', icon: AlignLeft },
  { kind: 'kpi', label: 'KPI', icon: Hash },
  { kind: 'chart', label: 'Chart', icon: BarChart3 },
];

function LeftSectionRow({ section, index, onMove, listRef, onDelete, onPatch, onSaveToLibrary }: {
  section: TemplateSection;
  index: number;
  onMove: (from: number, to: number) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  onDelete: () => void;
  onPatch: (patch: Partial<TemplateSection>) => void;
  onSaveToLibrary: () => void;
}) {
  const kind = section.kind ?? 'text';
  // KPI/chart blocks use a type icon; text blocks use the section's own icon.
  const SectionIcon = kind === 'kpi' ? Hash : kind === 'chart' ? BarChart3 : (SECTION_ICONS[section.icon] || FileText);
  const controls = useDragControls();
  const hasGuidance = !!section.guidance?.trim();
  const configured = hasGuidance || kind !== 'text';
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ layout: { type: 'spring', stiffness: 420, damping: 36 }, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      drag
      dragSnapToOrigin
      dragElastic={0.2}
      dragControls={controls}
      dragListener={false}
      whileDrag={{ scale: 1.03, zIndex: 50, boxShadow: '0 10px 26px rgba(15,8,30,0.18)' }}
      onDragEnd={(_, info) => {
        // Reorder by where the row was dropped: count how many *other* rows sit
        // above the drop point → that's the new insertion index.
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
      className="group rounded-[9px] border border-canvas-border bg-white transition-colors hover:border-brand-600/40"
    >
      <div className="flex items-center gap-2 pl-1.5 pr-2 py-1.5">
        <button
          onPointerDown={(e) => controls.start(e)}
          aria-label={`Drag ${section.name} to reorder`}
          className="no-focus-ring shrink-0 text-ink-300 hover:text-brand-600 cursor-grab active:cursor-grabbing touch-none transition-colors"
        >
          <GripVertical size={14} />
        </button>
        <span className="shrink-0 w-6 h-6 rounded-[6px] bg-brand-50 text-brand-600 flex items-center justify-center">
          <SectionIcon size={13} />
        </span>
        <span className="flex-1 min-w-0 truncate text-[0.875rem] font-medium text-ink-800">{section.name}</span>
        <span className="shrink-0 text-[0.75rem] text-ink-400 tabular-nums">{index + 1}</span>
        {/* Configure the section — block type (§4.7) + AI guidance (§7). Lit when set. */}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={`Configure ${section.name}`}
          title="Configure section — block type + AI guidance"
          className={`no-focus-ring shrink-0 w-6 h-6 flex items-center justify-center rounded-[6px] transition-all cursor-pointer ${configured ? 'text-brand-600 bg-brand-50' : 'text-ink-400 hover:text-brand-600 hover:bg-brand-50 opacity-0 group-hover:opacity-100'}`}
        >
          <Sparkles size={12} />
        </button>
        {/* Save this section (with its guidance) to the reusable library (§6). */}
        <button
          onClick={onSaveToLibrary}
          aria-label={`Save ${section.name} to the section library`}
          title="Save to library"
          className="no-focus-ring shrink-0 w-6 h-6 flex items-center justify-center rounded-[6px] text-ink-400 hover:text-brand-600 hover:bg-brand-50 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
        >
          <BookmarkPlus size={12} />
        </button>
        <button
          onClick={onDelete}
          aria-label={`Delete ${section.name}`}
          className="no-focus-ring shrink-0 w-6 h-6 flex items-center justify-center rounded-[6px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {(open || configured) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2.5 pt-0.5 space-y-2.5">
              {/* §4.7 — block type: text / KPI / chart (placeholder, no numbers). */}
              <div>
                <div className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-400 mb-1">Block type</div>
                <div className="inline-flex p-0.5 bg-canvas rounded-[7px] gap-0.5">
                  {BLOCK_KINDS.map(b => {
                    const on = kind === b.kind;
                    return (
                      <button
                        key={b.kind}
                        type="button"
                        onClick={() => onPatch({ kind: b.kind })}
                        className={`inline-flex items-center gap-1 h-6 px-2 rounded-[6px] text-[0.6875rem] font-semibold transition-colors cursor-pointer ${on ? 'bg-white border border-canvas-border text-brand-700 shadow-[0_1px_2px_rgba(15,8,30,0.08)]' : 'text-ink-500 hover:text-ink-800'}`}
                      >
                        <b.icon size={11} /> {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* KPI/chart blocks: which metric, and (charts) the style. Values are
                  filled from query data at generate time — never from an upload. */}
              {kind !== 'text' && (
                <div className="space-y-2">
                  <input
                    value={section.metric ?? ''}
                    onChange={e => onPatch({ metric: e.target.value })}
                    placeholder={kind === 'kpi' ? 'Metric — e.g. Controls passed' : 'Metric — e.g. Exceptions by severity'}
                    className="w-full px-2.5 py-1.5 rounded-[7px] border border-canvas-border bg-canvas/40 text-[0.8125rem] transition-colors hover:border-ink-300 focus:outline-none focus:bg-white focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                  />
                  {kind === 'chart' && (
                    <div className="inline-flex p-0.5 bg-canvas rounded-[7px] gap-0.5">
                      {(['bar', 'line'] as const).map(ct => {
                        const on = (section.chartType ?? 'bar') === ct;
                        return (
                          <button key={ct} type="button" onClick={() => onPatch({ chartType: ct })}
                            className={`h-6 px-2.5 rounded-[6px] text-[0.6875rem] font-semibold capitalize transition-colors cursor-pointer ${on ? 'bg-white border border-canvas-border text-brand-700 shadow-[0_1px_2px_rgba(15,8,30,0.08)]' : 'text-ink-500 hover:text-ink-800'}`}>
                            {ct}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[0.625rem] text-ink-400">Placeholder — the value fills from your query data at generation, not from any upload.</p>
                </div>
              )}

              {/* AI guidance (§7) — how the section is written. */}
              <div>
                <div className="flex items-center gap-1.5 mb-1 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-brand-600">
                  <Sparkles size={10} /> AI guidance
                </div>
                <textarea
                  value={section.guidance ?? ''}
                  onChange={e => onPatch({ guidance: e.target.value })}
                  rows={2}
                  placeholder={kind === 'text' ? 'How should AI write this section? e.g. “Under 150 words, executive tone.”' : 'Optional — how to caption or frame this block.'}
                  className="w-full px-2.5 py-1.5 rounded-[7px] border border-canvas-border bg-canvas/40 text-[0.8125rem] resize-none transition-colors hover:border-ink-300 focus:outline-none focus:bg-white focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Document-preview section block. Reordering / deleting now lives in the left
// outline, so the right pane renders these read-only as the report would print.
function TemplateSectionRow({
  section,
  index,
}: {
  section: TemplateSection;
  index: number;
}) {
  const kind = section.kind ?? 'text';
  const SectionIcon = kind === 'kpi' ? Hash : kind === 'chart' ? BarChart3 : (SECTION_ICONS[section.icon] || FileText);
  const guidance = section.guidance?.trim();
  const metric = section.metric?.trim();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ layout: { type: 'spring', stiffness: 420, damping: 36 }, duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: Math.min(index, 8) * 0.035 }}
      className="relative rounded-[12px] border border-canvas-border bg-white px-5 py-4"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <SectionIcon size={16} className="shrink-0 text-brand-600" />
        <h4 className="flex-1 min-w-0 truncate text-[0.875rem] font-bold text-ink-800 tracking-tight">{section.name}</h4>
        {kind !== 'text' && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-evidence-50 text-evidence-700 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide">{kind === 'kpi' ? 'KPI' : 'Chart'}</span>
        )}
        {guidance && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[0.625rem] font-semibold" title={guidance}>
            <Sparkles size={10} /> Guided
          </span>
        )}
        <span className="shrink-0 text-[0.75rem] text-ink-400 tabular-nums whitespace-nowrap">Section {index + 1}</span>
      </div>
      {kind === 'kpi' ? (
        <div className="border border-dashed border-canvas-border rounded-[10px] bg-canvas/40 px-4 py-4 flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-[1.75rem] font-bold text-ink-300 leading-none tabular-nums">—</div>
            <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mt-1.5">{metric || 'Metric'}</div>
          </div>
          <p className="text-[0.6875rem] text-ink-400/80 leading-relaxed">KPI placeholder — filled from query data at generation.</p>
        </div>
      ) : kind === 'chart' ? (
        <div className="border border-dashed border-canvas-border rounded-[10px] bg-canvas/40 px-4 py-3">
          <div className="flex items-end gap-1.5 h-14">
            {(section.chartType ?? 'bar') === 'bar'
              ? [40, 68, 30, 82, 54, 72].map((h, k) => <div key={k} className="flex-1 rounded-t-[3px] bg-ink-900/10" style={{ height: `${h}%` }} />)
              : <svg viewBox="0 0 120 40" className="w-full h-full" preserveAspectRatio="none"><polyline points="0,32 24,20 48,26 72,10 96,16 120,6" fill="none" stroke="rgb(15 8 30 / 0.15)" strokeWidth="2" /></svg>}
          </div>
          <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mt-2">{metric || 'Metric'} · {(section.chartType ?? 'bar')} chart placeholder</p>
        </div>
      ) : guidance ? (
        <div className="border border-brand-200/70 rounded-[10px] bg-brand-50/40 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-brand-600"><Sparkles size={10} /> AI guidance</div>
          <p className="text-[0.75rem] text-ink-600 leading-relaxed">{guidance}</p>
        </div>
      ) : (
        <div className="border border-dashed border-canvas-border rounded-[10px] bg-canvas/40 px-5 py-6 text-center">
          <p className="text-[0.75rem] text-ink-400/80">Section content generated from report data</p>
        </div>
      )}
    </motion.div>
  );
}

// The report types valid on the platform. 'Other' stays as the internal
// "none selected" state (shown as a placeholder), so it isn't offered here.
const VALID_REPORT_TYPES = ['Audit', 'SOX', 'ATR'] as const;
const REPORT_TYPE_LABEL: Partial<Record<ReportTypeName, string>> = {
  Audit: 'Internal Audit',
  SOX: 'SOX',
  ATR: 'ATR',
};
const reportTypeLabel = (t: ReportTypeName) => REPORT_TYPE_LABEL[t] ?? t;

// Styled report-type dropdown — replaces the native <select> (which falls back
// to the OS-dark menu). Shows only the platform-valid types; an unset value
// ('Other') renders as a placeholder.
function ReportTypeSelect({ value, onChange }: { value: ReportTypeName; onChange: (t: ReportTypeName) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const chosen = (VALID_REPORT_TYPES as readonly string[]).includes(value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="no-focus-ring w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] border border-canvas-border bg-white text-[0.875rem] cursor-pointer hover:border-brand-300 focus:outline-none focus:border-brand-600/40 transition-colors"
      >
        <span className={chosen ? 'text-ink-800 font-medium' : 'text-ink-400'}>{chosen ? reportTypeLabel(value) : 'Select a report type'}</span>
        <ChevronDown size={15} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            className="absolute z-30 left-0 right-0 mt-1.5 rounded-[10px] border border-canvas-border bg-white shadow-[0_10px_28px_rgba(15,8,30,0.14)] p-1"
          >
            {VALID_REPORT_TYPES.map(t => {
              const active = t === value;
              return (
                <button
                  key={t}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange(t as ReportTypeName); setOpen(false); }}
                  className={`no-focus-ring w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[7px] text-left text-[0.875rem] cursor-pointer transition-colors ${active ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-700 hover:bg-canvas'}`}
                >
                  {reportTypeLabel(t as ReportTypeName)}
                  {active && <Check size={14} className="text-brand-600 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TemplateEditor({ template, onClose, onCancel, onSaveNew, onSaveEdit, existingTemplateNames = [], existingStructures = [], initialName, autoImport }: { template: EditableTemplate; onClose: () => void; onCancel?: () => void; onSaveNew?: (created: EditableTemplate) => void; onSaveEdit?: (updated: EditableTemplate) => void; existingTemplateNames?: string[]; existingStructures?: { name: string; sectionNames: string[] }[]; initialName?: string; autoImport?: boolean }) {
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
  const [footerText, setFooterText] = useState(template.footerText ?? 'Generated by Auditify Copilot');
  // Tags (§9) — free-form labels for findability once the library grows.
  const [tags, setTags] = useState<string[]>(template.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const addTag = (raw: string) => {
    const t = raw.trim().replace(/,$/, '').trim();
    if (!t) return;
    setTags(prev => prev.some(x => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]);
    setTagDraft('');
  };
  // Governance (§8) — lifecycle status + version history + who's acting.
  const [status, setStatus] = useState<TemplateStatus>(template.status ?? 'draft');
  const [versions, setVersions] = useState<TemplateVersion[]>(template.versions ?? []);
  const [showHistory, setShowHistory] = useState(false);
  const { currentUser } = useCurrentUser();
  const logEvent = useAuditLog();
  const authorName = currentUser?.name ?? 'You';
  // Brand logo (letterhead) + diagonal page watermark — the full-document branding.
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(template.logoDataUrl);
  const [watermark, setWatermark] = useState<WatermarkConfig>(template.watermark ?? DEFAULT_WATERMARK);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const watermarkImgInputRef = useRef<HTMLInputElement>(null);
  const setWm = (patch: Partial<WatermarkConfig>) => setWatermark(w => ({ ...w, ...patch }));
  // Read an uploaded image as a data URL (logo / watermark image). 2 MB cap.
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
  // Report type drives the §4.6 smart defaults. Seed from the template's category
  // when it's already one of the known types, else "Other".
  const knownType = (REPORT_TYPES as readonly string[]).includes(template.category)
    ? (template.category as ReportTypeName) : 'Other';
  const [reportType, setReportType] = useState<ReportTypeName>(knownType);
  // Left settings column is split into two segmented groups so the form reads as
  // a structured panel instead of a flat six-field stack.
  const [panel, setPanel] = useState<'identity' | 'branding'>('identity');

  // Changing the type never auto-fills — it just re-derives the recommendations
  // shown for that type, which the author adds when they want.
  const onTypeChange = (next: ReportTypeName) => setReportType(next);
  const addSections = (list: { name: string; icon: string }[]) => {
    if (!list.length) return;
    setSections(prev => {
      const have = new Set(prev.map(s => s.name.toLowerCase()));
      const fresh = list.filter(s => !have.has(s.name.toLowerCase()));
      return [...prev, ...fresh.map(s => ({ name: s.name, icon: s.icon }))];
    });
  };
  const coverage = sectionCoverage(reportType, sections.map(s => s.name));

  // ── Section Library (§6) — reusable blocks that carry their own guidance ────
  const [library, setLibrary] = useState<LibrarySection[]>(() => loadSectionLibrary());
  const [showLibrary, setShowLibrary] = useState(false);
  // Insert a library block into the outline, preserving its guidance (deduped).
  const insertFromLibrary = (lib: LibrarySection) => {
    setSections(prev => prev.some(s => s.name.toLowerCase() === lib.name.toLowerCase())
      ? prev
      : [...prev, { name: lib.name, icon: lib.icon, guidance: lib.guidance }]);
  };
  // Save a template section back to the library as a reusable block.
  const saveToLibrary = (section: { name: string; icon: string; guidance?: string }) => {
    const before = library.length;
    const next = addToSectionLibrary(library, section);
    setLibrary(next);
    addToast(next.length > before
      ? { type: 'success', message: `“${section.name}” saved to the section library.` }
      : { type: 'info', message: `“${section.name}” is already in the library.` });
  };

  // ── Import from a report ──────────────────────────────────────────────────
  // Reads an existing PDF report and pre-fills the outline + letterhead, so the
  // author starts from the real document instead of a blank page. This is the
  // merged "Upload template" path, folded into the editor (one creation surface).
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [scanningName, setScanningName] = useState<string | null>(null);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const handleImportFile = async (file: File) => {
    if (!/\.pdf$/i.test(file.name)) {
      addToast({ type: 'error', message: 'Import reads PDF reports. Upload a .pdf file.' });
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
      const hf = result.headerFooter;
      // Letterhead → header/footer + brand; only overwrite when we found something.
      if (hf?.confidentiality || hf?.header.length) setHeaderText(hf.confidentiality || hf!.header.join('  ·  '));
      if (hf?.footer.length) setFooterText(hf.footer.join('  ·  '));
      if (hf?.fields.auditEntity) setBrand(hf.fields.auditEntity);
      // Name: only fill if still the untouched default.
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      if (copyName === defaultName) setCopyName(hf?.fields.auditTitle || base.replace(/\b\w/g, c => c.toUpperCase()));
      // Structure → the detected section outline (replaces, since import defines it).
      if (result.sections.length > 0) {
        setSections(result.sections.map(name => ({ name, icon: 'file-text' })));
      }
      setImportedFrom(file.name);
      const n = result.sections.length;
      addToast({
        type: 'success',
        message: n > 0
          ? `Imported ${n} section${n === 1 ? '' : 's'} and the letterhead from "${file.name}".`
          : `Imported the letterhead from "${file.name}". No clear sections detected — add them below.`,
      });
      // §4.5 — headings with no content beneath aren't auto-added, but never
      // silently dropped: tell the user and offer a one-tap add-back.
      const skipped = result.sections.length ? result.skipped : [];
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
    } finally {
      setImporting(false);
      setScanningName(null);
    }
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
  // Patch a section in place — used by per-section guidance (§7) and block-type /
  // metric config (§4.7).
  const patchSection = (index: number, patch: Partial<TemplateSection>) =>
    setSections(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
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
    footerText: template.footerText ?? 'Generated by Auditify Copilot',
    sections: seededSections,
    logoDataUrl: template.logoDataUrl,
    watermark: template.watermark ?? DEFAULT_WATERMARK,
    status: template.status ?? 'draft',
    tags: template.tags ?? [],
  }));
  const isDirty =
    copyName !== initial.copyName ||
    brand !== initial.brand ||
    theme !== initial.theme ||
    headerText !== initial.headerText ||
    footerText !== initial.footerText ||
    sections !== initial.sections ||
    logoDataUrl !== initial.logoDataUrl ||
    watermark !== initial.watermark ||
    status !== initial.status ||
    tags !== initial.tags;

  // Restore an earlier version's outline + status into the working editor (§8).
  const restoreVersion = (v: TemplateVersion) => {
    setSections(v.sections.map(s => ({ ...s })));
    setStatus(v.status);
    setShowHistory(false);
    addToast({ type: 'info', message: `Restored ${v.version} — review and save to keep it.` });
  };

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

  // "Upload my report" starting point (§3) opens the editor and immediately
  // fires the import picker, so the one-door chooser flows straight into upload.
  useEffect(() => {
    if (!autoImport) return;
    const t = setTimeout(() => importInputRef.current?.click(), 220);
    return () => clearTimeout(t);
  }, [autoImport]);

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
      // §8 — snapshot this save as a new version, and log it to the audit trail.
      const note = isNew ? 'Created'
        : status !== initial.status ? (status === 'approved' ? 'Approved' : `Status → ${TEMPLATE_STATUS_META[status].label}`)
        : 'Edited';
      const nextVersions: TemplateVersion[] = [
        ...versions,
        { version: `v${versions.length + 1}`, status, at: new Date().toISOString(), by: authorName, note, sections: sections.map(s => ({ ...s })) },
      ];
      const governance = { status, versions: nextVersions, tags };

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
          logoDataUrl,
          watermark,
          ...governance,
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
            logoDataUrl,
            watermark,
            ...governance,
          });
        }
        addToast({ type: 'success', message: 'Template saved.' });
      }
      logEvent({
        action: isNew ? 'Create' : 'Update',
        description: `${isNew ? 'Created' : 'Saved'} template "${finalName}" — ${TEMPLATE_STATUS_META[status].label}, ${nextVersions[nextVersions.length - 1].version}`,
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
      >
        <div className="px-7 py-2.5 border-b border-canvas-border flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><FileText size={16} /></div>
            <div className="min-w-0">
              <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight">{isNew ? 'Create template' : 'Edit template'}</h3>
              <p className="text-[0.75rem] text-ink-500 leading-snug truncate">{isNew ? 'New custom template' : template.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* §8 — lifecycle status. Teams generate from Approved templates. */}
            <div role="group" aria-label="Template status" className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-canvas border border-canvas-border">
              {(['draft', 'in-review', 'approved'] as TemplateStatus[]).map(s => {
                const on = status === s;
                const m = TEMPLATE_STATUS_META[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[0.6875rem] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${on ? `${m.pill} border` : 'border border-transparent text-ink-500 hover:text-ink-800'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${on ? m.dot : 'bg-ink-300'}`} />{m.label}
                  </button>
                );
              })}
            </div>
            {versions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[8px] border border-canvas-border bg-white text-[0.75rem] font-semibold text-ink-700 hover:bg-paper-50 hover:border-brand-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
              >
                <History size={13} /> {versions.length} version{versions.length === 1 ? '' : 's'}
              </button>
            )}
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
              <motion.div key="panel-identity" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="flex-1 min-h-0 flex flex-col">
                {/* One scroll region for the fields + outline, so the section list
                    gets the full column height. Tabs (above) and the Add bar
                    (below) stay pinned. */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-3">
                  <div className="space-y-4">
                    <div>
                      <FieldLabel icon={FileText} required>Template Name</FieldLabel>
                      <input ref={copyNameRef} value={copyName} onChange={e => setCopyName(e.target.value)} aria-invalid={nameTaken}
                        className={`w-full px-3 py-2 rounded-[8px] border text-[0.875rem] transition-colors focus:outline-none focus:ring-2 ${nameTaken ? 'border-mitigated/60 focus:border-mitigated focus:ring-mitigated/10' : 'border-canvas-border hover:border-ink-300 focus:border-brand-600/40 focus:ring-brand-600/10'}`} />
                      {nameTaken && <p className="mt-1 text-[0.6875rem] text-mitigated-700">A template named “{copyName.trim()}” already exists — saving creates a copy.</p>}
                    </div>
                    <div>
                      <FieldLabel icon={Tag} required>Report Type</FieldLabel>
                      <ReportTypeSelect value={reportType} onChange={onTypeChange} />
                      {/* Choosing a type surfaces its recommended sections in the
                          preview; the report itself starts empty. */}
                      <p className="text-[0.75rem] text-ink-400 mt-1.5">
                        {reportType === 'Other'
                          ? 'Required — choosing a type unlocks its recommended sections.'
                          : `Suggested ${reportTypeLabel(reportType)} sections below.`}
                      </p>
                    </div>
                    <div>
                      <FieldLabel icon={Image}>Brand Name</FieldLabel>
                      <input ref={brandRef} value={brand} onChange={e => setBrand(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[0.875rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                    </div>
                    <div>
                      <FieldLabel icon={Hash}>Tags</FieldLabel>
                      <div className="w-full flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-[8px] border border-canvas-border bg-white transition-colors focus-within:border-brand-600/40 focus-within:ring-2 focus-within:ring-brand-600/10">
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
                      <p className="mt-1 text-[0.6875rem] text-ink-400">Press Enter or comma to add. Tags help you find templates later.</p>
                    </div>
                  </div>

                  {/* Letterhead — header & footer sit before the sections, in their
                      own labelled group (the Details rhythm: identity →
                      letterhead → sections). */}
                  <div className="mt-5 pt-4 border-t border-canvas-border">
                    <GroupEyebrow hint="shown on every page">Letterhead</GroupEyebrow>
                    <div className="space-y-4">
                    <div>
                      <FieldLabel
                        icon={Type}
                        right={<span className={`text-[0.6875rem] tabular-nums ${headerText.length > LETTERHEAD_SOFT_MAX ? 'text-risk-600 font-medium' : 'text-ink-400'}`}>{headerText.length}/{LETTERHEAD_SOFT_MAX}</span>}
                      >Header Text</FieldLabel>
                      <input value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="Confidential — For Internal Use Only" className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[0.875rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                      {headerText.length > LETTERHEAD_SOFT_MAX && <p className="mt-1 text-[0.6875rem] text-risk-600">Long header text may be truncated in the letterhead.</p>}
                    </div>
                    <div>
                      <FieldLabel
                        icon={Layout}
                        right={<span className={`text-[0.6875rem] tabular-nums ${footerText.length > LETTERHEAD_SOFT_MAX ? 'text-risk-600 font-medium' : 'text-ink-400'}`}>{footerText.length}/{LETTERHEAD_SOFT_MAX}</span>}
                      >Footer Text</FieldLabel>
                      <input value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="Generated by Auditify Copilot" className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[0.875rem] transition-colors hover:border-ink-300 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                      {footerText.length > LETTERHEAD_SOFT_MAX && <p className="mt-1 text-[0.6875rem] text-risk-600">Long footer text may be truncated in the letterhead.</p>}
                    </div>
                    </div>
                  </div>

                  {/* Report Sections — the draggable outline, clubbed into Details.
                      (Import from a report lives in the modal footer.) */}
                  <div className="mt-5 pt-4 border-t border-canvas-border flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink-800"><span className="w-6 h-6 rounded-[7px] bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><FileText size={13} /></span> Report Sections</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowLibrary(v => !v)}
                        aria-pressed={showLibrary}
                        className={`inline-flex items-center gap-1.5 h-6 pl-2 pr-2.5 rounded-full text-[0.6875rem] font-semibold border transition-colors cursor-pointer ${showLibrary ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-canvas-border bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700'}`}
                      >
                        <Library size={12} /> Library
                      </button>
                      {sections.length > 0 && (
                        <span className="inline-flex items-center h-5 px-2 rounded-full bg-canvas border border-canvas-border text-[0.75rem] font-medium text-ink-500 tabular-nums">{sections.length}</span>
                      )}
                    </div>
                  </div>

                  {/* §6 — reusable section blocks (with their guidance). Insert one
                      and it brings its AI rules with it. */}
                  <AnimatePresence initial={false}>
                    {showLibrary && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 rounded-[10px] border border-canvas-border bg-canvas/40 p-2">
                          <p className="px-1 pt-0.5 pb-1.5 text-[0.6875rem] text-ink-400">Reusable blocks — insert one and it carries its AI guidance.</p>
                          <div className="space-y-1">
                            {library.map(lib => {
                              const LibIcon = SECTION_ICONS[lib.icon] || FileText;
                              const added = sections.some(s => s.name.toLowerCase() === lib.name.toLowerCase());
                              return (
                                <button
                                  key={lib.id}
                                  type="button"
                                  onClick={() => insertFromLibrary(lib)}
                                  disabled={added}
                                  className={`no-focus-ring group/lib w-full flex items-center gap-2 rounded-[8px] border px-2 py-1.5 text-left transition-colors ${added ? 'border-transparent bg-transparent cursor-default' : 'border-canvas-border bg-white hover:border-brand-300 hover:bg-brand-50/40 cursor-pointer'}`}
                                >
                                  <span className={`shrink-0 w-6 h-6 rounded-[6px] flex items-center justify-center ${added ? 'bg-canvas text-ink-400' : 'bg-brand-50 text-brand-600'}`}><LibIcon size={12} /></span>
                                  <span className="flex-1 min-w-0">
                                    <span className={`block text-[0.8125rem] font-medium truncate ${added ? 'text-ink-400' : 'text-ink-800'}`}>{lib.name}</span>
                                    {lib.guidance && <span className="block text-[0.625rem] text-ink-400 truncate">{lib.guidance}</span>}
                                  </span>
                                  {added
                                    ? <Check size={13} className="shrink-0 text-compliant" />
                                    : <Plus size={13} className="shrink-0 text-brand-500 group-hover/lib:text-brand-700 transition-colors" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Added sections — only render the list (and its drag hint)
                      once there's something in the outline. */}
                  {sections.length > 0 && (
                    <>
                      <p className="pt-2 text-[0.75rem] text-ink-400">Drag to reorder · hover a row to remove · <Sparkles size={10} className="inline align-[-1px] text-brand-500" /> to guide the AI · <BookmarkPlus size={10} className="inline align-[-1px] text-brand-500" /> to save to library.</p>
                      <div ref={sectionsListRef} className="mt-2 space-y-1.5">
                        <AnimatePresence initial={false}>
                          {sections.map((section, i) => (
                            <LeftSectionRow
                              key={section.name}
                              section={section}
                              index={i}
                              listRef={sectionsListRef}
                              onMove={moveSection}
                              onDelete={() => setSections(prev => prev.filter(s => s.name !== section.name))}
                              onPatch={patch => patchSection(i, patch)}
                              onSaveToLibrary={() => saveToLibrary(section)}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </>
                  )}

                  {/* Recommendations — the primary way to build the outline. When
                      it's empty these sit right under the header (no buried empty
                      box) so the options are immediately obvious. */}
                  {recommendations.length > 0 ? (
                    <div className={sections.length > 0 ? 'mt-4 pt-4 border-t border-canvas-border' : 'mt-3'}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0 text-[0.75rem] font-semibold text-ink-700">
                          <ShieldCheck size={13} className="text-brand-500 shrink-0" />
                          <span className="truncate">Recommended for {reportTypeLabel(reportType)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addSections(recommendations)}
                          className="no-focus-ring shrink-0 text-[0.75rem] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
                        >
                          Add all
                        </button>
                      </div>
                      <p className="text-[0.75rem] text-ink-400 mb-2.5">Tap a section to add it to your report.</p>
                      <div className="space-y-1.5">
                        <AnimatePresence initial={false}>
                          {recommendations.map((rec, ri) => {
                            const RecIcon = SECTION_ICONS[rec.icon] || FileText;
                            return (
                              <motion.button
                                key={rec.name}
                                type="button"
                                layout
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: ri * 0.03 }}
                                whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                                onClick={() => addSections([rec])}
                                className="no-focus-ring group/rec w-full flex items-center gap-2 rounded-[9px] border border-dashed border-canvas-border bg-canvas/30 pl-1.5 pr-2 py-1.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 cursor-pointer"
                              >
                                <span className="shrink-0 w-6 h-6 rounded-[6px] bg-brand-50 text-brand-600 flex items-center justify-center"><RecIcon size={13} /></span>
                                <span className="flex-1 min-w-0 truncate text-[0.875rem] font-medium text-ink-700">{rec.name}</span>
                                <span className="shrink-0 w-5 h-5 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center group-hover/rec:bg-brand-600 group-hover/rec:text-white transition-colors"><Plus size={12} /></span>
                              </motion.button>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  ) : sections.length === 0 ? (
                    <div className="mt-3 rounded-[10px] border border-dashed border-canvas-border bg-canvas/30 px-4 py-7 text-center">
                      <FileText size={20} className="mx-auto text-ink-300 mb-2" />
                      <p className="text-[0.875rem] font-semibold text-ink-800">No sections yet</p>
                      <p className="text-[0.75rem] text-ink-400 mt-0.5">Pick a report type above to see recommendations, or type your own below.</p>
                    </div>
                  ) : null}
                </div>
                <div className="px-6 shrink-0 h-[58px] border-t border-canvas-border flex items-center gap-2">
                  <input
                    value={newSectionName}
                    onChange={e => setNewSectionName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSection(); } }}
                    placeholder="Add a section, then press ↵"
                    title="Type a section name and press Enter to add"
                    className="flex-1 h-9 px-3 rounded-[8px] border border-canvas-border text-[0.875rem] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                  />
                  <button
                    onClick={addSection}
                    disabled={!newSectionName.trim()}
                    className={`no-focus-ring inline-flex items-center gap-1 h-9 px-3 text-[0.875rem] font-semibold rounded-[8px] transition-colors ${
                      newSectionName.trim()
                        ? 'text-white bg-brand-600 hover:bg-brand-500 cursor-pointer'
                        : 'text-ink-400 bg-paper-100 border border-canvas-border cursor-not-allowed'
                    }`}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="panel-branding" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="flex-1 min-h-0 overflow-y-auto px-6 pt-1 pb-6">
                <GroupEyebrow hint="applied to the report cover">Appearance</GroupEyebrow>
                <div>
                  <FieldLabel icon={Palette}>Color Theme</FieldLabel>
                  {/* Theme cards — each shows its full colour palette (a dark →
                      accent → light ramp) as a clean swatch bar, so the combination
                      reads at a glance. No hex codes, just the colours. */}
                  <div className="grid grid-cols-2 gap-2.5">
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
                            className="h-11 rounded-[8px] ring-1 ring-inset ring-black/[0.06]"
                            style={{ backgroundImage: `linear-gradient(125deg, ${TEMPLATE_THEME_GRADIENT[t.name][0]} 0%, ${TEMPLATE_THEME_GRADIENT[t.name][1]} 62%, ${TEMPLATE_THEME_GRADIENT[t.name][1]} 100%)` }}
                          />
                          <div className="flex items-center justify-between gap-1 px-1 pt-2 pb-0.5">
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
                  <p className="mt-2.5 text-[0.75rem] text-ink-400">Sets the letterhead gradient shown in the preview.</p>
                </div>

                {/* Brand Logo — an image shown on the letterhead cover. */}
                <div className="mt-5 pt-4 border-t border-canvas-border">
                  <GroupEyebrow hint="shown on the letterhead">Brand Logo</GroupEyebrow>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) readImageFile(f, url => setLogoDataUrl(url)); if (logoInputRef.current) logoInputRef.current.value = ''; }} />
                  {logoDataUrl ? (
                    <div className="flex items-center gap-3 rounded-[10px] border border-canvas-border bg-canvas p-2.5">
                      <div className="h-11 w-16 rounded-[6px] bg-white border border-canvas-border flex items-center justify-center overflow-hidden shrink-0">
                        <img src={logoDataUrl} alt="Brand logo" className="max-h-9 max-w-[56px] object-contain" />
                      </div>
                      <button type="button" onClick={() => logoInputRef.current?.click()} className="text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer">Replace</button>
                      <button type="button" onClick={() => setLogoDataUrl(undefined)} className="ml-auto text-[0.75rem] font-medium text-ink-400 hover:text-risk-600 transition-colors cursor-pointer">Remove</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => logoInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-canvas-border bg-canvas/40 px-3 py-3 text-[0.8125rem] font-medium text-ink-500 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/30 transition-colors cursor-pointer">
                      <Upload size={15} /> Upload a logo
                    </button>
                  )}
                  <p className="mt-1.5 text-[0.6875rem] text-ink-400">PNG, JPG or SVG · up to 2 MB.</p>
                </div>

                {/* Watermark — a diagonal text or image mark across every page. */}
                <div className="mt-5 pt-4 border-t border-canvas-border">
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

          {/* Right pane — the template document itself, readable and edited in
              place. The report cover, metadata, and section outline all live on
              one full-size page; sections are added / reordered / deleted right
              where they appear, so there's no separate detached editor card. */}
          <div className="relative flex-1 min-w-0 flex flex-col bg-white min-h-0">
            {/* Non-editable preview marker (#6). */}
            <span className="pointer-events-none absolute top-3 left-4 z-30 inline-flex items-center rounded-full bg-white/15 border border-white/25 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm">
              Preview
            </span>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="relative">
                <ReportBrandBanner
                  title={copyName || 'Untitled Template'}
                  titleClassName="text-[1.5rem]"
                  gradient={TEMPLATE_THEME_GRADIENT[theme]}
                  headerText={headerText}
                  actions={logoDataUrl ? <img src={logoDataUrl} alt="Brand logo" className="h-10 max-w-[128px] object-contain rounded-[4px] bg-white/95 px-1.5 py-1" /> : undefined}
                  footer={
                    /* All report facts live in the letterhead as one full-width
                       strip — no duplicated meta panel below. */
                    <div className="grid grid-cols-4 gap-6">
                      {[
                        { label: 'Brand', value: brand || 'Irame' },
                        { label: 'Report Type', value: reportType === 'Other' ? '—' : reportTypeLabel(reportType) },
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

                {/* Section outline — read-only preview; editing lives in the left panel. */}
                <div ref={sectionsRef} tabIndex={-1} className="px-9 pt-7 pb-7">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-[0.875rem] font-semibold text-ink-900"><FileText size={15} className="text-brand-600" /> Report Sections</h3>
                    {sections.length > 0 && (
                      <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-canvas text-[0.75rem] font-medium text-ink-400 tabular-nums">{sections.length} {sections.length === 1 ? 'section' : 'sections'}</span>
                    )}
                  </div>

                  {/* The live report preview. Recommendations live only in the left
                      panel now, so the preview stays a clean document (no suggestion
                      widget to scroll past below the sections). */}
                  {sections.length > 0 ? (
                    <div className="space-y-3.5">
                      <AnimatePresence initial={false}>
                        {sections.map((section, i) => (
                          <TemplateSectionRow key={section.name} section={section} index={i} />
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mb-3.5">
                        <FileText size={20} className="text-brand-300" />
                      </div>
                      <p className="text-[0.875rem] font-semibold text-ink-700">Your report is empty</p>
                      <p className="text-[0.75rem] text-ink-400 mt-1 max-w-[300px] mx-auto leading-relaxed">
                        {reportType === 'Other'
                          ? 'Choose a report type to see recommended sections, then add them from the left to build the outline.'
                          : `Add ${reportTypeLabel(reportType)} sections from the left, and they'll preview here.`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Watermark — a diagonal text/image mark stamped across the page. */}
                {watermark.enabled && (watermark.mode === 'text' ? watermark.text.trim() : watermark.imageDataUrl) && (
                  <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center overflow-hidden">
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
            {footerText && (
              <div className="shrink-0 px-9 h-[58px] flex items-center border-t border-canvas-border">
                <p className="text-[0.75rem] text-ink-400">{footerText}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-7 py-2.5 border-t border-canvas-border flex items-center justify-between gap-2 shrink-0">
          {/* Left — import from a report (the merged "Upload template" path). Reads
              a PDF and pre-fills the outline + letterhead. */}
          <div className="min-w-0">
            <input ref={importInputRef} type="file" accept=".pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); if (importInputRef.current) importInputRef.current.value = ''; }} />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={isSaving || importing}
              title="Pull the section outline + header/footer from an existing PDF report"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] border border-canvas-border bg-white text-brand-700 text-[0.8125rem] font-semibold transition-colors hover:bg-brand-50 hover:border-brand-300 cursor-pointer disabled:opacity-60 disabled:cursor-wait max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
            >
              {importing
                ? <><Loader2 size={15} className="animate-spin shrink-0" /> Reading the report…</>
                : importedFrom
                  ? <><FileText size={15} className="shrink-0" /> <span className="truncate">Imported · {importedFrom}</span> <RotateCcw size={13} className="shrink-0 opacity-70" /></>
                  : <><Upload size={15} className="shrink-0" /> Import from a report</>}
            </button>
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
            {isSaving ? 'Saving…' : isNew ? 'Create template' : 'Save Template'}
          </button>
          </div>
        </div>

        {/* Import-from-a-report extraction theatre — covers the editor while the
            PDF is read, then dismisses as the fields populate. */}
        <AnimatePresence>
          {importing && <ImportScanOverlay filename={scanningName ?? 'your report'} />}
        </AnimatePresence>

        {/* §8 — version history sheet: every save is a snapshot; restore rolls the
            outline + status back into the working editor. */}
        <AnimatePresence>
          {showHistory && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="absolute inset-0 z-40 bg-ink-900/20" onClick={() => setShowHistory(false)}
              />
              <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
                className="absolute top-0 right-0 bottom-0 z-40 w-[360px] max-w-[86vw] bg-canvas-elevated border-l border-canvas-border shadow-xl flex flex-col"
              >
                <div className="shrink-0 px-5 py-3 border-b border-canvas-border flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-[0.875rem] font-semibold text-ink-900"><History size={15} className="text-brand-600" /> Version history</span>
                  <button onClick={() => setShowHistory(false)} aria-label="Close history" className="w-7 h-7 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer transition-colors"><X size={15} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  {[...versions].reverse().map((v, idx) => {
                    const isLatest = idx === 0;
                    const m = TEMPLATE_STATUS_META[v.status];
                    return (
                      <div key={v.version} className={`rounded-[10px] border p-3 ${isLatest ? 'border-brand-300 bg-brand-50/20' : 'border-canvas-border bg-white'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-[0.8125rem] font-bold text-ink-900 tabular-nums">{v.version}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold border ${m.pill}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>
                          {isLatest
                            ? <span className="ml-auto text-[0.6875rem] font-medium text-ink-400">Current</span>
                            : <button onClick={() => restoreVersion(v)} className="ml-auto inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-700 hover:text-brand-800 transition-colors cursor-pointer"><RotateCcw size={11} /> Restore</button>}
                        </div>
                        <p className="mt-1.5 text-[0.75rem] text-ink-600">{v.note} · {v.by}</p>
                        <p className="text-[0.6875rem] text-ink-400">{new Date(v.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {v.sections.length} section{v.sections.length === 1 ? '' : 's'}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
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
          <>A standard <span className="font-semibold">{reportType}</span> report usually includes {missingConfirm?.map(n => `“${n}”`).join(', ')}. You can save without {missingConfirm && missingConfirm.length > 1 ? 'them' : 'it'} and add {missingConfirm && missingConfirm.length > 1 ? 'them' : 'it'} later.</>
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

