// Template authoring + apply surfaces, extracted from ReportsView:
//   • TemplateEditor       — the brand/theme/header-footer/arrangement editor
//   • ApplyTemplateDropdown — pick a template to apply to an open report
//   • TemplateSectionRow / TemplateCarousel — internal helpers
// (mergeTemplateOptions lives in reportShared so this module exports only
//  components, keeping React Fast Refresh intact.)
// Depends only on the shared keystone, ReportDocumentChrome, and ConfirmDialog.

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import {
  Check, ChevronDown, ChevronRight, FileText, GripVertical, Image, Layout,
  Loader2, Palette, Plus, Settings, Trash2, Type, X,
  Tag, ShieldCheck, BookOpen, Search,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { REPORT_TEMPLATES } from '../../data/mockData';
import { ReportBrandBanner } from './ReportDocumentChrome';
import ConfirmDialog from './ConfirmDialog';
import {
  ICON_MAP, CATEGORY_COLORS, SECTION_ICONS, TEMPLATE_THEME_GRADIENT,
  REPORT_TYPES, typeSectionsFor, sectionCoverage,
  type ReportTypeName, type EditableTemplate,
} from './reportShared';


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
function LeftSectionRow({ section, index, onMove, listRef, onDelete }: {
  section: { name: string; icon: string };
  index: number;
  onMove: (from: number, to: number) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  onDelete: () => void;
}) {
  const SectionIcon = SECTION_ICONS[section.icon] || FileText;
  const controls = useDragControls();
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
      className="group flex items-center gap-2 rounded-[9px] border border-canvas-border bg-white pl-1.5 pr-2 py-1.5 transition-colors hover:border-brand-600/40"
    >
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
      <button
        onClick={onDelete}
        aria-label={`Delete ${section.name}`}
        className="no-focus-ring shrink-0 w-6 h-6 flex items-center justify-center rounded-[6px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 size={12} />
      </button>
    </motion.div>
  );
}

// Document-preview section block. Reordering / deleting now lives in the left
// outline, so the right pane renders these read-only as the report would print.
function TemplateSectionRow({
  section,
  index,
}: {
  section: { name: string; icon: string };
  index: number;
}) {
  const SectionIcon = SECTION_ICONS[section.icon] || FileText;
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
        <span className="shrink-0 text-[0.75rem] text-ink-400 tabular-nums whitespace-nowrap">Section {index + 1}</span>
      </div>
      <div className="border border-dashed border-canvas-border rounded-[10px] bg-canvas/40 px-5 py-6 text-center">
        <p className="text-[0.75rem] text-ink-400/80">Section content generated from report data</p>
      </div>
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

export function TemplateEditor({ template, onClose, onCancel, onSaveNew, onSaveEdit, existingTemplateNames = [], initialName }: { template: EditableTemplate; onClose: () => void; onCancel?: () => void; onSaveNew?: (created: EditableTemplate) => void; onSaveEdit?: (updated: EditableTemplate) => void; existingTemplateNames?: string[]; initialName?: string }) {
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
  }));
  const isDirty =
    copyName !== initial.copyName ||
    brand !== initial.brand ||
    theme !== initial.theme ||
    headerText !== initial.headerText ||
    footerText !== initial.footerText ||
    sections !== initial.sections;

  const attemptClose = () => {
    if (isDirty && !isSaving) {
      setShowAbandonConfirm(true);
    } else {
      cancel();
    }
  };
  useFocusTrap(containerRef, true, attemptClose);

  const fieldRefs: Record<string, React.RefObject<HTMLElement | null>> = {
    copyName: copyNameRef,
    brand: brandRef,
    sections: sectionsRef,
  };

  const handleSave = (skipMissing = false) => {
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
    setErrors([]);
    setIsSaving(true);
    // Simulate an async save so the spinner is observable.
    window.setTimeout(() => {
      if (isNew && onSaveNew) {
        const finalName = copyName.trim() || 'Untitled Template';
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
        });
        addToast({ type: 'success', message: 'Template saved to Custom Templates.' });
      } else {
        // In-place edit (existing custom templates): persist changes back to
        // the same entry. New templates use the create path above.
        if (onSaveEdit) {
          const finalName = copyName.trim() || template.name;
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
          });
        }
        addToast({ type: 'success', message: 'Template saved.' });
      }
      setIsSaving(false);
      onClose();
    }, 320);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }} className="fixed inset-0 z-[60] flex items-center justify-center" onClick={attemptClose}>
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-[3px]" />
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
            <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Settings size={16} /></div>
            <div className="min-w-0">
              <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight">{isNew ? 'Create template' : 'Edit template'}</h3>
              <p className="text-[0.75rem] text-ink-500 leading-snug truncate">{isNew ? 'New custom template' : template.name}</p>
            </div>
          </div>
          <button onClick={attemptClose} aria-label="Close" className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"><X size={16} /></button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* Left pane — settings split into Identity / Branding groups so the
              column reads as a structured panel, not a flat six-field stack. */}
          <div className="w-[360px] shrink-0 border-r border-canvas-border flex flex-col min-h-0">
            {/* Sticky top — validation + the tab switch stay put while the
                panel below scrolls. */}
            <div className="px-6 pt-5 pb-4 shrink-0 space-y-4">
              {errors.length > 0 && (
                <div
                  role="alert"
                  className="border border-risk-200 bg-risk-50 rounded-[8px] px-3 py-2 text-[0.75rem] text-risk-800"
                >
                  <div className="font-semibold mb-1">Please complete the following before saving:</div>
                  <ul className="space-y-0.5">
                    {errors.map(err => (
                      <li key={err.field}>
                        <button
                          type="button"
                          onClick={() => {
                            if (err.field === 'copyName' || err.field === 'brand') setPanel('identity');
                            requestAnimationFrame(() => {
                              const el = fieldRefs[err.field]?.current;
                              el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                              el?.focus?.();
                            });
                          }}
                          className="underline hover:text-risk-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded"
                        >
                          {err.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Segmented group switcher — Details (what the template is + its
                  outline) vs Branding (how it looks). */}
              <div className="relative flex p-1 bg-canvas rounded-[10px] gap-1">
                {([['identity', 'Details'], ['branding', 'Branding']] as const).map(([key, label]) => {
                  const active = panel === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPanel(key)}
                      aria-pressed={active}
                      className={`no-focus-ring relative flex-1 h-8 rounded-[7px] text-[0.75rem] font-semibold cursor-pointer transition-colors duration-150 ${active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800'}`}
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
                      <label className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink-800 mb-1.5"><FileText size={14} /> Template Name</label>
                      <input ref={copyNameRef} value={copyName} onChange={e => setCopyName(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[0.875rem] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink-800 mb-1.5"><Tag size={14} /> Report Type</label>
                      <ReportTypeSelect value={reportType} onChange={onTypeChange} />
                      {/* Choosing a type surfaces its recommended sections in the
                          preview; the report itself starts empty. */}
                      <p className="text-[0.75rem] text-ink-400 mt-1 truncate">
                        {reportType === 'Other'
                          ? 'Pick a type to see suggestions.'
                          : `Suggested ${reportTypeLabel(reportType)} sections below.`}
                      </p>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink-800 mb-1.5"><Image size={14} /> Brand Name</label>
                      <input ref={brandRef} value={brand} onChange={e => setBrand(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[0.875rem] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                    </div>
                  </div>

                  {/* Report Sections — the draggable outline, clubbed into Details. */}
                  <div className="mt-5 pt-4 border-t border-canvas-border flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink-800"><FileText size={14} /> Report Sections</label>
                    {sections.length > 0 && (
                      <span className="inline-flex items-center h-5 px-2 rounded-full bg-canvas border border-canvas-border text-[0.75rem] font-medium text-ink-500 tabular-nums">{sections.length}</span>
                    )}
                  </div>

                  {/* Added sections — only render the list (and its drag hint)
                      once there's something in the outline. */}
                  {sections.length > 0 && (
                    <>
                      <p className="pt-1 text-[0.75rem] text-ink-400">Drag to reorder · hover a row to remove.</p>
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
                    placeholder="Add a section…"
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
              <motion.div key="panel-branding" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink-800 mb-1.5"><Palette size={14} /> Color Theme</label>
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
                          <div className="flex h-11 rounded-[8px] overflow-hidden ring-1 ring-inset ring-black/[0.06]">
                            {t.palette.map((c, i) => (
                              <span key={i} className="flex-1" style={{ background: c }} />
                            ))}
                          </div>
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
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink-800 mb-1.5"><Type size={14} /> Header Text</label>
                  <input value={headerText} onChange={e => setHeaderText(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[0.875rem] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink-800 mb-1.5"><Layout size={14} /> Footer Text</label>
                  <input value={footerText} onChange={e => setFooterText(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[0.875rem] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
                </div>
              </motion.div>
            )}
          </div>

          {/* Right pane — the template document itself, readable and edited in
              place. The report cover, metadata, and section outline all live on
              one full-size page; sections are added / reordered / deleted right
              where they appear, so there's no separate detached editor card. */}
          <div className="flex-1 min-w-0 flex flex-col bg-white min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div>
                <ReportBrandBanner
                  title={copyName || 'Untitled Template'}
                  titleClassName="text-[1.5rem]"
                  gradient={TEMPLATE_THEME_GRADIENT[theme]}
                  headerText={headerText}
                  footer={
                    /* All report facts live in the letterhead as one full-width
                       strip — no duplicated meta panel below. */
                    <div className="grid grid-cols-4 gap-6">
                      {[
                        { label: 'Brand', value: brand || 'Irame' },
                        { label: 'Report Type', value: reportType },
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

                  {/* Added sections — the live report preview. */}
                  {sections.length > 0 && (
                    <div className="space-y-3.5">
                      <AnimatePresence initial={false}>
                        {sections.map((section, i) => (
                          <TemplateSectionRow key={section.name} section={section} index={i} />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Recommended sections for the chosen type — click to add (or
                      drag in from the left list). Re-derives when the type changes. */}
                  {recommendations.length > 0 ? (
                    <div className={`rounded-[12px] border border-canvas-border bg-canvas/40 p-4 ${sections.length > 0 ? 'mt-5' : ''}`}>
                      <div className="flex items-start justify-between gap-3 mb-3.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="shrink-0 w-8 h-8 rounded-[9px] bg-brand-50 text-brand-600 flex items-center justify-center"><ShieldCheck size={16} /></span>
                          <div className="min-w-0">
                            <div className="text-[0.875rem] font-semibold text-ink-900 truncate leading-tight">Recommended for {reportTypeLabel(reportType)}</div>
                            <div className="text-[0.75rem] text-ink-400 leading-tight mt-0.5">Tap a section to add it to your report</div>
                          </div>
                        </div>
                        <button
                          onClick={() => addSections(recommendations)}
                          className="no-focus-ring shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-[7px] border border-brand-200 bg-white text-[0.75rem] font-semibold text-brand-700 hover:bg-brand-50 hover:border-brand-300 cursor-pointer transition-colors"
                        >
                          <Plus size={12} /> Add all
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <AnimatePresence initial={false}>
                          {recommendations.map((rec, ri) => {
                            const RecIcon = SECTION_ICONS[rec.icon] || FileText;
                            return (
                              <motion.button
                                key={rec.name}
                                layout
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: ri * 0.03 }}
                                whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                                onClick={() => addSections([rec])}
                                className="no-focus-ring group/rec flex items-center gap-2.5 rounded-[10px] border border-canvas-border bg-white pl-2.5 pr-2 py-2 text-left transition-all hover:border-brand-300 hover:shadow-[0_2px_8px_rgba(15,8,30,0.06)] cursor-pointer"
                              >
                                <span className="shrink-0 w-6 h-6 rounded-[6px] bg-brand-50 text-brand-600 flex items-center justify-center"><RecIcon size={13} /></span>
                                <span className="flex-1 min-w-0 truncate text-[0.875rem] font-medium text-ink-800">{rec.name}</span>
                                <span className="shrink-0 w-5 h-5 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center group-hover/rec:bg-brand-600 group-hover/rec:text-white transition-colors"><Plus size={12} /></span>
                              </motion.button>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  ) : sections.length === 0 ? (
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
                  ) : null}
                </div>
              </div>
            </div>
            {footerText && (
              <div className="shrink-0 px-9 h-[58px] flex items-center border-t border-canvas-border">
                <p className="text-[0.75rem] text-ink-400">{footerText}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-7 py-2.5 border-t border-canvas-border flex justify-end gap-2 shrink-0">
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
    </motion.div>
  );
}

