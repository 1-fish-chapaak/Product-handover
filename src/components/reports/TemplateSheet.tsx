// The template printed as the page it produces — letterhead, numbered
// sections, block shapes, sign-off, closing page, footer, watermark.
//
// One renderer, two callers: the read-only Template preview opened from the
// Templates list, and the preview step before an imported template is saved.
// Two sheets would drift, and then the page a client approves at import would
// not be the page the library shows afterwards.
//
// Pass `fill` to draw the shapes WITH data. The Templates list passes nothing
// and gets the empty shape; the import preview passes made-up findings.

import type { CSSProperties } from 'react';
import { renderSectionShape, sectionTypeLabel, type ShapeFill } from './templateSectionShape';
import { ReportBrandBanner, ReportSignoffBlock, ReportClosingBlock } from './ReportDocumentChrome';
import {
  sectionBlurb, reportGradient, reportAccent, collectBlockLibrary,
  type EditableTemplate,
  templateCoverFields,
} from './reportShared';

const WATERMARK_POS: Record<'center' | 'top' | 'bottom' | 'left' | 'right', string> = {
  center: 'items-center justify-center',
  top: 'items-start justify-center pt-8',
  bottom: 'items-end justify-center pb-8',
  left: 'items-center justify-start pl-8',
  right: 'items-center justify-end pr-8',
};

export default function TemplateSheet({
  template,
  fill,
  bannerFooter,
}: {
  template: EditableTemplate;
  /** Data to draw the shapes with. Absent = the empty shape. */
  fill?: ShapeFill;
  /** The three fields under the letterhead title. */
  bannerFooter?: { label: string; value: string }[];
}) {
  const sections = template.sections ?? [];
  const gradient = reportGradient(template.theme, template.brandColor);
  const accent = reportAccent(template.theme, template.brandColor);
  const blockLibrary = collectBlockLibrary(sections);
  const watermark = template.watermark;
  const pageNumbers = template.pageNumbers !== false;
  const signatories = (template.signatories ?? []).filter(s => s.role.trim());
  // One cover, three surfaces: the meta row comes from the shared builder so
  // this sheet, the editor's live page and the check screen cannot drift.
  const footerFields = bannerFooter ?? templateCoverFields(template.brand);

  return (
    <div
      className="relative rounded-lg shadow-[0_10px_34px_-14px_rgba(15,8,30,0.22)]"
      style={{ '--rep-accent': accent } as CSSProperties}
    >
      <ReportBrandBanner
        title={template.name}
        titleClassName="text-[1.5rem]"
        logo={template.logoDataUrl}
        className="rounded-t-lg"
        gradient={gradient}
        headerText={template.headerText}
        footer={
          <div className="grid grid-cols-2 gap-6">
            {footerFields.map(f => (
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
          const shape = renderSectionShape(section, blockLibrary, shownDesc, fill);
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

      {/* Closing page — printed word for word at the end of every report. */}
      {template.closingEnabled && (template.closingText?.length ?? 0) > 0 && (
        <div className="border-x border-canvas-border bg-white px-9">
          <ReportClosingBlock lines={template.closingText!} />
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
  );
}
