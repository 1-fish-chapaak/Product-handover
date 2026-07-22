// Template preview — the template printed as the page it produces, full width,
// read only.
//
// Clicking a template in the Templates list opens this, so the answer to "what
// report is this?" is the report itself: letterhead, numbered sections, block
// shapes, sign-off, footer. Nothing here is editable or generated; the sheet is
// the same one the editor builds (same section shape renderer), so what is
// previewed is what generates.

import type { CSSProperties } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Edit3, Trash2, FileText } from 'lucide-react';
import { ReportBrandBanner, ReportSignoffBlock } from './ReportDocumentChrome';
import { renderSectionShape, sectionTypeLabel } from './templateSectionShape';
import {
  ICON_MAP, CATEGORY_COLORS, sectionBlurb, reportGradient, reportAccent,
  collectBlockLibrary,
  type EditableTemplate,
} from './reportShared';

const WATERMARK_POS: Record<'center' | 'top' | 'bottom' | 'left' | 'right', string> = {
  center: 'items-center justify-center',
  top: 'items-start justify-center pt-8',
  bottom: 'items-end justify-center pb-8',
  left: 'items-center justify-start pl-8',
  right: 'items-center justify-end pr-8',
};

export default function TemplatePreview({
  template,
  isCustom,
  onBack,
  onEdit,
  onDelete,
}: {
  template: EditableTemplate;
  /** Custom templates carry Edit + Delete; system templates are read-only. */
  isCustom?: boolean;
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const sections = template.sections ?? [];
  const Icon = ICON_MAP[template.icon] || FileText;
  const color = CATEGORY_COLORS[template.category] || 'text-ink-500 bg-paper-50';
  const eyebrowTone = color.split(' ')[0];
  const tintBg = color.split(' ')[1] ?? 'bg-paper-50';
  const gradient = reportGradient(template.theme, template.brandColor);
  const accent = reportAccent(template.theme, template.brandColor);
  const blockLibrary = collectBlockLibrary(sections);
  const watermark = template.watermark;
  const pageNumbers = template.pageNumbers !== false;
  const signatories = (template.signatories ?? []).filter(s => s.role.trim());

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      {/* Action bar — page-coloured and borderless, so the sheet slides
          cleanly beneath it (the report reader's recipe). */}
      <div className="shrink-0 px-6 lg:px-12 xl:px-[124px] h-16 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-[0.75rem] font-semibold text-ink-600 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:text-ink-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          <ArrowLeft size={14} /> Back to Templates
        </button>
        <div className="flex items-center gap-2">
          {isCustom && onEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <Edit3 size={14} /> Edit template
            </button>
          )}
          {isCustom && onDelete && (
            <button
              onClick={onDelete}
              aria-label={`Delete template ${template.name}`}
              className="inline-flex items-center justify-center w-9 h-9 text-ink-500 bg-canvas-elevated border border-canvas-border rounded-md hover:text-risk-700 hover:border-risk-200 hover:bg-risk-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-12 xl:px-[124px] pb-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-3xl"
        >
          {/* One honest line above the sheet: this is the shape, not a report. */}
          <div className="flex flex-wrap items-center gap-2 pb-3 text-[0.75rem] text-ink-500">
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${tintBg}`}>
              <Icon size={12} className={eyebrowTone} strokeWidth={1.75} />
            </span>
            <span className={`text-[0.625rem] font-semibold uppercase tracking-[0.14em] ${eyebrowTone}`}>{template.category}</span>
            <span className="text-ink-300">·</span>
            <span>{sections.length} {sections.length === 1 ? 'section' : 'sections'}</span>
            <span className="text-ink-300">·</span>
            <span>Empty shape. Your audit data fills it in when you generate.</span>
          </div>

          <div
            className="relative rounded-lg shadow-[0_10px_34px_-14px_rgba(15,8,30,0.22)]"
            style={{ '--rep-accent': accent } as CSSProperties}
          >
            <ReportBrandBanner
              title={template.name}
              titleClassName="text-[1.5rem]"
              className="rounded-t-lg"
              gradient={gradient}
              headerText={template.headerText}
              footer={
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { label: 'Brand', value: template.brand || 'Irame' },
                    { label: 'Generated On', value: 'Fills at generation' },
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

            {sections.length === 0 ? (
              <div className="border-x border-canvas-border bg-white px-9 py-10 text-center">
                <p className="text-[0.8125rem] text-ink-400">This template has no sections yet.</p>
              </div>
            ) : (
              sections.map((section, i) => {
                const shownDesc = section.description ?? sectionBlurb(section.name);
                const shape = renderSectionShape(section, blockLibrary, shownDesc);
                const typeLabel = sectionTypeLabel(section);
                return (
                  <div key={`${section.name}-${i}`} className="border-x border-canvas-border bg-white px-9 py-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-baseline gap-3.5 min-w-0 flex-1">
                        <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums tracking-[0.16em] leading-none" style={{ color: 'var(--rep-accent, #550fa5)' }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <h2 className="min-w-0 text-[1.25rem] font-semibold text-ink-900 tracking-[-0.012em] leading-[1.15]">{section.name}</h2>
                      </div>
                      {typeLabel && (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-evidence-50 text-evidence-700 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide">{typeLabel}</span>
                      )}
                    </div>
                    <span className="mt-3 block h-[2px] w-8 rounded-full" style={{ backgroundColor: 'var(--rep-accent, rgba(136,56,222,0.8))' }} aria-hidden="true" />
                    <div className="mt-4 pl-[1.9rem]">
                      {shape ?? <p className="max-w-[80ch] text-[0.875rem] leading-relaxed text-ink-600">{shownDesc}</p>}
                    </div>
                  </div>
                );
              })
            )}

            {/* Sign-off block — the Approvals section on the finished report. */}
            {template.signoffEnabled && signatories.length > 0 && (
              <div className="border-x border-canvas-border bg-white px-9 pt-3 pb-8">
                <ReportSignoffBlock signatories={signatories} />
              </div>
            )}

            <div className={`border-x border-b border-canvas-border bg-canvas/60 rounded-b-lg px-9 py-3 flex items-center ${pageNumbers ? 'justify-between' : 'justify-center'}`}>
              <span className="text-[0.6875rem] text-ink-400 tracking-wide">{template.footerText || `Generated by ${(template.brand ?? '').trim() || 'Irame'}`}</span>
              {pageNumbers && <span className="text-[0.6875rem] text-ink-400 tabular-nums tracking-wide">Page 1</span>}
            </div>

            {watermark?.enabled && (watermark.mode === 'text' ? watermark.text.trim() : watermark.imageDataUrl) && (
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
        </motion.div>
      </div>
    </div>
  );
}
