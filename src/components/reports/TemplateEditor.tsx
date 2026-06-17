// Template authoring + apply surfaces, extracted from ReportsView:
//   • TemplateEditor       — the brand/theme/header-footer/arrangement editor
//   • ApplyTemplateDropdown — pick a template to apply to an open report
//   • TemplateSectionRow / TemplateCarousel — internal helpers
// (mergeTemplateOptions lives in reportShared so this module exports only
//  components, keeping React Fast Refresh intact.)
// Depends only on the shared keystone, ReportDocumentChrome, and ConfirmDialog.

import { useState, useRef } from 'react';
import { motion, Reorder, useDragControls } from 'motion/react';
import {
  Check, Copy, FileText, GripVertical, Image, Layout,
  Loader2, Palette, Plus, Settings, Trash2, Type, X,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { REPORT_TEMPLATES } from '../../data/mockData';
import { ReportBrandBanner, ReportMetaPanel } from './ReportDocumentChrome';
import ConfirmDialog from './ConfirmDialog';
import {
  ICON_MAP, CATEGORY_COLORS, SECTION_ICONS, TEMPLATE_THEME_GRADIENT,
  type EditableTemplate,
} from './reportShared';


// ─── Apply Template Dropdown ───
export function ApplyTemplateDropdown({ templates = REPORT_TEMPLATES, activeId = null, onSelect, onClose }: { templates?: typeof REPORT_TEMPLATES[number][]; activeId?: string | null; onSelect: (template: typeof REPORT_TEMPLATES[0]) => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.97 }}
      className="absolute right-0 top-full mt-1 w-[280px] bg-white rounded-[8px] shadow-xl border border-canvas-border z-50 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-canvas-border">
        <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Select Template</span>
      </div>
      <div className="max-h-[260px] overflow-y-auto p-1.5">
        {templates.map(rt => {
          const Icon = ICON_MAP[rt.icon] || FileText;
          const isActive = rt.id === activeId;
          return (
            <button
              key={rt.id}
              onClick={() => { onSelect(rt); onClose(); }}
              aria-current={isActive || undefined}
              className={`w-full text-left px-3 py-2.5 rounded-[8px] transition-colors cursor-pointer flex items-center gap-2.5 ${isActive ? 'bg-brand-50' : 'hover:bg-brand-50'}`}
            >
              <div className={`p-1.5 rounded-[8px] ${CATEGORY_COLORS[rt.category] || 'text-ink-500 bg-paper-50'}`}>
                <Icon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[12px] truncate ${isActive ? 'font-semibold text-brand-600' : 'font-medium text-ink-800'}`}>{rt.name}</div>
                <div className="text-[10px] text-ink-400">{rt.category}</div>
              </div>
              {isActive && <Check size={14} className="shrink-0 text-brand-600" />}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Template Editor Modal ───
function TemplateSectionRow({
  section,
  index,
  onDelete,
}: {
  section: { name: string; icon: string };
  index: number;
  onDelete: () => void;
}) {
  const SectionIcon = SECTION_ICONS[section.icon] || FileText;
  const controls = useDragControls();
  // A section reads as a real report block (heading + generated-content
  // placeholder) but reveals drag + delete affordances on hover, so the
  // document itself is the editor — no separate list.
  return (
    <Reorder.Item
      value={section}
      dragListener={false}
      dragControls={controls}
      className="group relative rounded-[12px] border border-canvas-border bg-white px-5 py-4 transition-shadow hover:shadow-[0_2px_10px_rgba(15,8,30,0.06)]"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <button
          onPointerDown={(e) => controls.start(e)}
          aria-label={`Drag ${section.name} to reorder`}
          className="shrink-0 -ml-1 text-ink-300 hover:text-brand-600 cursor-grab active:cursor-grabbing touch-none transition-all opacity-0 group-hover:opacity-100"
        >
          <GripVertical size={15} />
        </button>
        <SectionIcon size={16} className="shrink-0 text-brand-600" />
        <h4 className="flex-1 min-w-0 truncate text-[14px] font-bold text-ink-800 tracking-tight">{section.name}</h4>
        <span className="shrink-0 text-[11px] text-ink-400 tabular-nums whitespace-nowrap">Section {index + 1}</span>
        <button
          onClick={onDelete}
          aria-label={`Delete ${section.name}`}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-[7px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="border border-dashed border-canvas-border rounded-[10px] bg-canvas/40 px-5 py-6 text-center">
        <p className="text-[12px] text-ink-400/80">Section content generated from report data</p>
      </div>
    </Reorder.Item>
  );
}

export function TemplateEditor({ template, onClose, onCancel, isCopy = false, onSaveCopy, onSaveEdit, existingTemplateNames = [], initialName }: { template: EditableTemplate; onClose: () => void; onCancel?: () => void; isCopy?: boolean; onSaveCopy?: (copy: EditableTemplate) => void; onSaveEdit?: (updated: EditableTemplate) => void; existingTemplateNames?: string[]; initialName?: string }) {
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
  const defaultName = initialName ?? (isCopy ? `Copy of ${template.name}` : template.name);
  const [copyName, setCopyName] = useState(defaultName);
  const [brand, setBrand] = useState(template.brand ?? 'Irame');
  const [theme, setTheme] = useState(template.theme ?? 'Purple & White');
  const [headerText, setHeaderText] = useState(template.headerText ?? 'Confidential — For Internal Use Only');
  const [footerText, setFooterText] = useState(template.footerText ?? 'Generated by Auditify Copilot');
  const [sections, setSections] = useState(template.sections || []);
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
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ field: 'copyName' | 'brand' | 'sections'; label: string }[]>([]);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  const copyNameRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLInputElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initial state captured at mount for dirty-detection.
  const initialRef = useRef({
    copyName: defaultName,
    brand: template.brand ?? 'Irame',
    theme: template.theme ?? 'Purple & White',
    headerText: template.headerText ?? 'Confidential — For Internal Use Only',
    footerText: template.footerText ?? 'Generated by Auditify Copilot',
    sections: template.sections || [],
  });
  const isDirty =
    copyName !== initialRef.current.copyName ||
    brand !== initialRef.current.brand ||
    theme !== initialRef.current.theme ||
    headerText !== initialRef.current.headerText ||
    footerText !== initialRef.current.footerText ||
    sections !== initialRef.current.sections;

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

  const handleSave = () => {
    // Required-field validation: brand is always required; copyName is
    // required in the Copy flow; sections must be non-empty.
    const next: { field: 'copyName' | 'brand' | 'sections'; label: string }[] = [];
    if (!copyName.trim()) next.push({ field: 'copyName', label: 'Template Name' });
    if (!brand.trim()) next.push({ field: 'brand', label: 'Brand Name' });
    if (!sections || sections.length === 0) next.push({ field: 'sections', label: 'At least one section' });
    if (next.length > 0) {
      setErrors(next);
      const first = fieldRefs[next[0].field]?.current;
      first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      first?.focus?.();
      return;
    }
    setErrors([]);
    setIsSaving(true);
    // Simulate an async save so the spinner is observable.
    window.setTimeout(() => {
      if (isCopy && onSaveCopy) {
        const finalName = copyName.trim() || `Copy of ${template.name}`;
        if (existingTemplateNames.some(n => n.toLowerCase() === finalName.toLowerCase())) {
          setIsSaving(false);
          addToast({ type: 'error', message: `A template named "${finalName}" already exists. Choose a different name.` });
          return;
        }
        onSaveCopy({
          ...template,
          id: `ct-copy-${Date.now()}`,
          name: finalName,
          sections,
          brand: brand.trim(),
          theme,
          headerText: headerText.trim(),
          footerText: footerText.trim(),
        });
        addToast({ type: 'success', message: 'Copy saved to Custom Templates.' });
      } else {
        // In-place edit (custom templates): persist the changes back to the
        // same entry. Standard templates never reach here — they open as a copy.
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

  // Fork from edit mode: save the current edits as a brand-new custom template
  // instead of overwriting this one. Auto-names "Copy of X" (suffixing on
  // collision) since edit mode has no name field of its own.
  const handleSaveAsCopy = () => {
    if (!onSaveCopy) return;
    const next: { field: 'copyName' | 'brand' | 'sections'; label: string }[] = [];
    if (!brand.trim()) next.push({ field: 'brand', label: 'Brand Name' });
    if (!sections || sections.length === 0) next.push({ field: 'sections', label: 'At least one section' });
    if (next.length > 0) {
      setErrors(next);
      const first = fieldRefs[next[0].field]?.current;
      first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      first?.focus?.();
      return;
    }
    setErrors([]);
    setIsSaving(true);
    window.setTimeout(() => {
      let finalName = `Copy of ${template.name}`;
      let i = 2;
      while (existingTemplateNames.some(n => n.toLowerCase() === finalName.toLowerCase())) {
        finalName = `Copy of ${template.name} (${i++})`;
      }
      onSaveCopy({
        ...template,
        id: `ct-copy-${Date.now()}`,
        name: finalName,
        sections,
        brand: brand.trim(),
        theme,
        headerText: headerText.trim(),
        footerText: footerText.trim(),
      });
      addToast({ type: 'success', message: `Saved as "${finalName}".` });
      setIsSaving(false);
      onClose();
    }, 320);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }} className="fixed inset-0 z-[60] flex items-center justify-center" onClick={attemptClose}>
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        role="dialog" aria-modal="true" aria-label="Edit Template"
        className="relative bg-canvas-elevated rounded-[16px] border border-canvas-border shadow-xl w-[840px] max-w-[94vw] h-[78vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-7 py-2.5 border-b border-canvas-border flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Settings size={16} /></div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink-900 leading-tight">{isNew ? 'Create template' : 'Edit template'}</h3>
              <p className="text-[11px] text-ink-500 leading-snug truncate">{isNew ? 'New custom template' : template.name}</p>
            </div>
          </div>
          <button onClick={attemptClose} aria-label="Close" className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"><X size={16} /></button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* Left pane — branding & layout settings (narrow column) */}
          <div className="w-[360px] shrink-0 overflow-y-auto border-r border-canvas-border flex flex-col">
            <div className="px-7 py-6 flex-1 flex flex-col justify-between gap-4">
          {errors.length > 0 && (
            <div
              role="alert"
              className="border border-risk-200 bg-risk-50 rounded-[8px] px-3 py-2 text-[12px] text-risk-800"
            >
              <div className="font-semibold mb-1">Please complete the following before saving:</div>
              <ul className="space-y-0.5">
                {errors.map(err => (
                  <li key={err.field}>
                    <button
                      type="button"
                      onClick={() => {
                        const el = fieldRefs[err.field]?.current;
                        el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                        el?.focus?.();
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
          {/* Template Name + Brand — stacked in the narrow column. Shown in every
              flow (Create, Customize, Edit) so a custom template can be renamed.
              Standard templates lock every field — clone to edit. */}
          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-800 mb-1.5"><FileText size={14} /> Template Name</label>
            <input ref={copyNameRef} value={copyName} onChange={e => setCopyName(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[13px] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-800 mb-1.5"><Image size={14} /> Brand Name</label>
            <input ref={brandRef} value={brand} onChange={e => setBrand(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[13px] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
          </div>

          {/* Theme */}
          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-800 mb-1.5"><Palette size={14} /> Color Theme</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Purple & White', colors: ['#6a12cd', '#f8f9fc'] },
                { name: 'Navy & Gold', colors: ['#1a2744', '#c5a55a'] },
                { name: 'Teal & Light', colors: ['#0d9488', '#f0fdfa'] },
                { name: 'Slate & Blue', colors: ['#334155', '#3b82f6'] },
              ].map(t => {
                const active = theme === t.name;
                return (
                  <button key={t.name} onClick={() => setTheme(t.name)} aria-pressed={active} className={`relative px-2 pt-2 pb-1.5 rounded-[10px] border text-center transition-all cursor-pointer ${active ? 'border-brand-600 bg-brand-600/[0.04] ring-1 ring-brand-600/20' : 'border-canvas-border hover:border-brand-600/40 hover:bg-paper-50/60'}`}>
                    {active && (
                      <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-brand-600 text-white flex items-center justify-center">
                        <Check size={9} strokeWidth={3} />
                      </span>
                    )}
                    <div className="flex justify-center mb-1">
                      {t.colors.map((c, i) => <div key={i} className={`w-5 h-5 rounded-full border-2 border-white shadow-sm ${i > 0 ? '-ml-2' : ''}`} style={{ background: c }} />)}
                    </div>
                    <span className="block text-[10px] font-medium text-ink-500 truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Header text */}
          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-800 mb-1.5"><Type size={14} /> Header Text</label>
            <input value={headerText} onChange={e => setHeaderText(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[13px] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
          </div>

          {/* Footer text */}
          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-800 mb-1.5"><Layout size={14} /> Footer Text</label>
            <input value={footerText} onChange={e => setFooterText(e.target.value)} className="w-full px-3 py-2 rounded-[8px] border border-canvas-border text-[13px] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10" />
          </div>
            </div>
          </div>

          {/* Right pane — the template document itself, readable and edited in
              place. The report cover, metadata, and section outline all live on
              one full-size page; sections are added / reordered / deleted right
              where they appear, so there's no separate detached editor card. */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-canvas/40">
            <div className="px-6 py-7">
              <div className="rounded-[14px] overflow-hidden border border-canvas-border bg-white shadow-[0_8px_28px_rgba(15,8,30,0.10)]">
                <ReportBrandBanner
                  title={copyName || 'Untitled Template'}
                  gradient={TEMPLATE_THEME_GRADIENT[theme]}
                  headerText={headerText}
                >
                  <p className="text-[13px] text-white/75 mb-3">{template.desc || 'Custom report template'}</p>
                  <div className="flex items-center gap-1.5 text-[13px] flex-wrap">
                    <span className="font-semibold text-white">{brand || 'Irame'}</span>
                    <span className="text-white/30 mx-0.5">|</span>
                    <span className="text-white/70">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    <span className="text-white/30 mx-0.5">|</span>
                    <span className="text-white/70">{sections.length} {sections.length === 1 ? 'section' : 'sections'}</span>
                  </div>
                </ReportBrandBanner>

                <div className="px-8 py-6 border-b border-canvas-border">
                  <ReportMetaPanel
                    items={[
                      { label: 'Template', value: copyName || 'Untitled Template' },
                      { label: 'Brand', value: brand || 'Irame' },
                      { label: 'Report Type', value: template.category || 'Custom' },
                      { label: 'Generated On', value: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) },
                    ]}
                  />
                </div>

                {/* Section outline — edited in place inside the page */}
                <div ref={sectionsRef} tabIndex={-1} className="px-8 py-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink-900"><FileText size={15} className="text-brand-600" /> Report Sections</h3>
                    <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-canvas text-[12px] font-medium text-ink-400 tabular-nums">{sections.length} {sections.length === 1 ? 'section' : 'sections'}</span>
                  </div>

                  {sections.length === 0 ? (
                    <div className="rounded-[12px] border border-dashed border-canvas-border bg-canvas/30 px-6 py-10 text-center">
                      <FileText size={22} className="mx-auto text-ink-300 mb-2.5" />
                      <p className="text-[14px] font-semibold text-ink-800">No sections yet</p>
                      <p className="text-[12.5px] text-ink-400 mt-1">Add a section below to build the report outline.</p>
                    </div>
                  ) : (
                    <Reorder.Group axis="y" values={sections} onReorder={setSections} className="space-y-3">
                      {sections.map((section, i) => (
                        <TemplateSectionRow
                          key={section.name}
                          section={section}
                          index={i}
                          onDelete={() => setSections(prev => prev.filter(s => s.name !== section.name))}
                        />
                      ))}
                    </Reorder.Group>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <input
                      value={newSectionName}
                      onChange={e => setNewSectionName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSection(); } }}
                      placeholder="Add a section…"
                      className="flex-1 h-10 px-3.5 rounded-[8px] border border-canvas-border text-[13px] focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                    />
                    <button
                      onClick={addSection}
                      disabled={!newSectionName.trim()}
                      className="inline-flex items-center gap-1.5 h-10 px-4 text-[13px] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={15} /> Add
                    </button>
                  </div>
                </div>

                {footerText && (
                  <div className="px-8 pb-6">
                    <p className="text-[12px] text-ink-400">{footerText}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-7 py-2.5 border-t border-canvas-border flex justify-end gap-2 shrink-0">
          <button
            onClick={attemptClose}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
          >Cancel</button>
          {!isCopy && onSaveCopy && (
            <button
              onClick={handleSaveAsCopy}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-brand-700 bg-white border border-brand-600/30 hover:bg-brand-600/[0.05] rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              <Copy size={13} /> Save as copy
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-brand-600 text-white rounded-[8px] text-[13px] font-semibold hover:bg-brand-500 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
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
    </motion.div>
  );
}

