// The template printed as the page it produces — letterhead, numbered
// sections, block shapes, sign-off, closing page, footer, watermark.
//
// Two shapes, because templates are two different things. The Action Taken
// Report has a structure the platform knows: fixed sections, and a set of
// fields the template chooses from (templateFields.ts). Every other template is
// whatever sections its author wrote, so it is drawn from those sections and
// nothing is assumed about them.
//
// Either way this is the empty shape, not a report: fields are named and the
// slot beside them left blank, because the audit fills them in at generate time.
//
// Pass `fill` to draw the authored shapes WITH data. The Templates list passes
// nothing and gets the empty shape; the import preview passes made-up findings.

import type { CSSProperties, ReactNode } from 'react';
import { Fragment } from 'react';
import { renderSectionShape, sectionTypeLabel, type ShapeFill } from './templateSectionShape';
import { ReportNumberedHeading, ReportBrandBanner, ReportSignoffBlock, ReportClosingBlock } from './ReportDocumentChrome';
import {
  sectionBlurb, reportGradient, reportAccent, collectBlockLibrary,
  type EditableTemplate,
  templateCoverFields,
} from './reportShared';
import {
  HEADER_FIELD_CHOICES, BODY_FIELD_CHOICES, KPI_CHOICES, SUMMARY_COLUMN_CHOICES,
  DEFAULT_HEADER_FIELDS, DEFAULT_BODY_FIELDS, DEFAULT_KPI_FIELDS, DEFAULT_SUMMARY_COLUMNS,
  isAtrTemplate,
} from './templateFields';

const WATERMARK_POS: Record<'center' | 'top' | 'bottom' | 'left' | 'right', string> = {
  center: 'items-center justify-center',
  top: 'items-start justify-center pt-8',
  bottom: 'items-end justify-center pb-8',
  left: 'items-center justify-start pl-8',
  right: 'items-center justify-end pr-8',
};

/** Where a value will land once the audit is read. Deliberately blank — this
 *  sheet promises a shape, and a made-up figure here would read as a finding. */
function EmptySlot({ wide }: { wide?: boolean }) {
  return <span className={`block h-[0.4375rem] rounded-full bg-canvas-border/70 ${wide ? 'w-3/4' : 'w-1/2'}`} aria-hidden="true" />;
}

/** A field named but not filled, for the pills the ATR carries in its card head. */
function SlotPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[0.625rem] font-semibold uppercase tracking-[0.08em] bg-canvas text-ink-400 border border-canvas-border whitespace-nowrap">
      {label}
    </span>
  );
}

export default function TemplateSheet({
  template,
  fill,
  bannerFooter,
  actions,
}: {
  template: EditableTemplate;
  /** Data to draw the authored shapes with. Absent = the empty shape. */
  fill?: ShapeFill;
  /** The fields under the letterhead title, on an authored template. */
  bannerFooter?: { label: string; value: string }[];
  /** Rendered top-right in the letterhead. */
  actions?: ReactNode;
}) {
  const sections = template.sections ?? [];
  const gradient = reportGradient(template.theme, template.brandColor);
  const accent = reportAccent(template.theme, template.brandColor);
  const blockLibrary = collectBlockLibrary(sections);
  const watermark = template.watermark;
  const pageNumbers = template.pageNumbers !== false;
  const signatories = (template.signatories ?? []).filter(s => s.role.trim());
  const footerFields = bannerFooter ?? templateCoverFields(template.brand);

  const atr = isAtrTemplate(template);
  const headerFields = template.headerFields ?? DEFAULT_HEADER_FIELDS;
  const kpiFields = template.kpiFields ?? DEFAULT_KPI_FIELDS;
  const summaryColumns = template.summaryColumns ?? DEFAULT_SUMMARY_COLUMNS;
  const bodyFields = template.bodyFields ?? DEFAULT_BODY_FIELDS;
  const columns = SUMMARY_COLUMN_CHOICES.filter(c => summaryColumns.includes(c.key));
  const detailRows = BODY_FIELD_CHOICES.filter(x => bodyFields.includes(x.key) && !['title', 'actionTakenStatus', 'observationStatus', 'risk'].includes(x.key));

  return (
    <div
      className="relative rounded-lg shadow-[0_10px_34px_-14px_rgba(15,8,30,0.22)]"
      style={{ '--rep-accent': accent } as CSSProperties}
    >
      <ReportBrandBanner
        title={atr ? 'Action Taken Report' : template.name}
        titleClassName="text-[1.5rem]"
        logo={template.logoDataUrl}
        className="rounded-t-lg"
        gradient={gradient}
        headerText={template.headerText}
        actions={actions}
        footer={atr ? undefined : (
          <div className="grid grid-cols-2 gap-6">
            {footerFields.map(f => (
              <div key={f.label} className="min-w-0">
                <div className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-white/50">{f.label}</div>
                <div className="text-[0.875rem] font-medium text-white/90 mt-1 truncate">{f.value}</div>
              </div>
            ))}
          </div>
        )}
      >
        {!atr && <p className="text-[0.875rem] text-white/75">{template.desc || 'Custom report template'}</p>}
      </ReportBrandBanner>

      {atr ? (
        <>
          {/* The report's own facts — named, not filled. */}
          {headerFields.length > 0 && (
            <div className="border-x border-b border-canvas-border bg-white px-9 py-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
                {HEADER_FIELD_CHOICES.filter(h => headerFields.includes(h.key)).map(h => (
                  <div key={h.key} className="min-w-0">
                    <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-ink-900">{h.label}</div>
                    <div className="mt-2"><EmptySlot wide /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {kpiFields.length > 0 && (
            <div className="border-x border-canvas-border bg-white px-9 py-6">
              <ReportNumberedHeading n={1} title="Executive Summary" subtitle="Overall observation and action plan rollup" />
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {KPI_CHOICES.filter(k => kpiFields.includes(k.key)).map(k => (
                  <div key={k.key} className="rounded-lg border border-canvas-border px-3 py-3">
                    <EmptySlot />
                    <div className="mt-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-ink-400 leading-snug">{k.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {columns.length > 0 && (
            <div className="border-x border-canvas-border bg-white px-9 py-6">
              <ReportNumberedHeading n={2} title="Observation Wise Summary" subtitle="Severity, action plans and status — per observation" />
              <div className="overflow-hidden rounded-lg border border-canvas-border">
                <table className="w-full text-[0.75rem]">
                  <thead>
                    <tr className="bg-brand-50/60 text-ink-700 text-left">
                      <th className="px-4 py-2.5 font-semibold">Observation &amp; Action Plans</th>
                      {columns.map(c => (
                        <th
                          key={c.key}
                          className={`py-2.5 font-semibold text-center whitespace-nowrap ${c.key === 'severity' ? 'px-3 w-[104px]' : c.key === 'status' ? 'px-3 w-[136px]' : 'px-2 w-[74px]'}`}
                        >{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-canvas-border">
                      <td className="px-4 py-3"><EmptySlot wide /></td>
                      {columns.map(c => (
                        <td key={c.key} className="px-2 py-3">
                          <span className="mx-auto block h-[0.4375rem] w-8 rounded-full bg-canvas-border/70" aria-hidden="true" />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bodyFields.length > 0 && (
            <div className="border-x border-canvas-border bg-white px-9 py-6">
              <ReportNumberedHeading n={3} title="Observation Details" subtitle="Issue, risk, action plan and verification" />
              <div className="rounded-lg border border-canvas-border overflow-hidden">
                <div className="bg-brand-50/40 px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="shrink-0 w-7 h-7 rounded-md bg-brand-600 text-white text-[0.8125rem] font-bold flex items-center justify-center">1</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-900">
                        {BODY_FIELD_CHOICES.find(x => x.key === 'title')?.label ?? 'Observation Title'}
                      </div>
                      <div className="mt-2 max-w-[22rem]"><EmptySlot wide /></div>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {bodyFields.includes('observationStatus') && <SlotPill label="Observation Status" />}
                    {bodyFields.includes('risk') && <SlotPill label="Risk Rating" />}
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="grid grid-cols-[180px_1fr] gap-x-5 gap-y-3 items-start">
                    {detailRows.map(x => (
                      <Fragment key={x.key}>
                        <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500 pt-1">{x.label}</div>
                        <div className="pt-1">
                          {x.key === 'actionPlanTitle' && bodyFields.includes('actionTakenStatus') ? (
                            <span className="flex items-center gap-2">
                              <EmptySlot wide />
                              <SlotPill label="Action Taken Status" />
                            </span>
                          ) : <EmptySlot wide />}
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : sections.length === 0 ? (
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
