// One control's working paper, opened as the report it is: a letterhead, a
// numbered body, and the same command bar every other open report in the
// product carries — back, the format it comes out in, download. A format that
// carries branding (one imported from a real report) re-letterheads this page;
// the built-in formats have no branding of their own, so those keep the house
// letterhead and only the named format changes. The format belongs to the whole
// audit, so picking one here changes every control report in it.
import { motion } from 'motion/react';
import { ArrowLeft, Download, History, Share2 } from 'lucide-react';
import { ReportBrandBanner, ReportNumberedHeading } from '../reports/ReportDocumentChrome';
import { ApplyTemplateChip, ReportVisibilityChip } from '../reports/ReportBarControls';
import type { Audience } from '../shared/audience';
import { reportGradient, type EditableTemplate } from '../reports/reportShared';
import type { REPORT_TEMPLATES } from '../../data/mockData';

export interface ControlReport {
  controlId: string;
  description: string;
  isKey: boolean;
  subProcess: string;
  riskId: string;
  riskDescription: string;
  scope: string;
  testProcedure: string;
  results: string;
  conclusion: string;
  status: string;
  samplesSelected: number;
  samplesTested: number;
  exceptionsFound: number;
}

/** A body block: a numbered heading and whatever sits under it. Keeps the
 *  page one rhythm instead of a different wrapper per field. */
function Block({ n, title, subtitle, children }: {
  n: number; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <ReportNumberedHeading n={n} title={title} subtitle={subtitle} />
      {children}
    </section>
  );
}

export default function ControlReportView({
  report, engagementName, period, recordedBy, conclusionClass, conclusionIcon: Ic,
  templates, activeFormat, fallbackFormatName, onSelectFormat,
  audience, onAudienceChange, onOpenActivity, onShare, onBack, onDownload,
}: {
  report: ControlReport;
  engagementName: string;
  period: string;
  recordedBy: string;
  conclusionClass: string;
  conclusionIcon: React.ElementType;
  templates: typeof REPORT_TEMPLATES[number][];
  /** The format the whole audit goes out in, or null while none is picked. */
  activeFormat: typeof REPORT_TEMPLATES[number] | null;
  /** What the audit falls back to when no format has been picked. */
  fallbackFormatName: string;
  /** Picks the format for the whole audit, not for this control alone. */
  onSelectFormat: (t: typeof REPORT_TEMPLATES[number]) => void;
  /** Who can open this control report. */
  audience: Audience;
  onAudienceChange: (a: Audience) => void;
  /** Opens the review drawer — comments and version history for this paper. */
  onOpenActivity: () => void;
  /** Absent when the reader cannot share, so the button is not shown at all. */
  onShare?: (e: React.MouseEvent<HTMLElement>) => void;
  onBack: () => void;
  onDownload: () => void;
}) {
  const brand = activeFormat as EditableTemplate | null;
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="report-printable"
    >
      {/* Command bar — page-coloured and borderless, the same row the reports
          reader uses, so an opened working paper is the same object. */}
      <div className="sticky top-0 z-30 bg-canvas h-14 flex items-center justify-between gap-4 print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-[0.75rem] font-semibold text-ink-600 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:text-ink-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          <ArrowLeft size={14} /> Back to Audit Report
        </button>
        <div className="flex items-center gap-2">
          {/* The format, then who can open it, then what you can do with it —
              the same row, in the same order, as the reports reader. */}
          <ApplyTemplateChip
            templates={templates}
            activeId={activeFormat?.id ?? null}
            activeName={activeFormat?.name ?? fallbackFormatName}
            onSelect={onSelectFormat}
          />
          <ReportVisibilityChip audience={audience} onChange={onAudienceChange} />
          <button
            onClick={onOpenActivity}
            title="View this working paper's comments and version history"
            aria-label="View comments and version history"
            className="flex items-center justify-center w-9 h-9 text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          >
            <History size={16} />
          </button>
          {onShare && (
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <Share2 size={14} /> <span className="hidden sm:inline">Share</span>
            </button>
          )}
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100 hover:border-brand-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
          >
            <Download size={14} /> Download
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[880px] pb-10">
        <div className="rounded-lg overflow-hidden border border-canvas-border bg-white">
          <ReportBrandBanner
            title={report.description}
            titleClassName="text-[1.5rem]"
            titleWrap
            gradient={reportGradient(brand?.theme, brand?.brandColor)}
            logo={brand?.logoDataUrl}
            eyebrow={
              <span className="font-mono text-[0.6875rem] tracking-[0.04em] text-white/65">
                {report.controlId}{report.isKey ? ' · KEY CONTROL' : ''}
              </span>
            }
            footer={
              <div className="flex items-center gap-2.5 text-[0.8125rem] flex-wrap">
                {[engagementName, report.subProcess, period, `${report.samplesTested} / ${report.samplesSelected} samples tested`].map((part, i) => (
                  <span key={i} className="inline-flex items-center gap-2.5">
                    {i > 0 && <span className="text-white/30" aria-hidden="true">|</span>}
                    <span className={i === 0 ? 'font-semibold text-white' : 'text-white/70'}>{part}</span>
                  </span>
                ))}
              </div>
            }
          />

          <div className="px-8 py-7">
            <Block n={1} title="Risk addressed" subtitle="What this control exists to stop">
              <p className="text-[0.875rem] text-ink-700 leading-relaxed">
                <span className="font-mono text-[0.75rem] text-ink-400">{report.riskId}</span> · {report.riskDescription}
              </p>
            </Block>

            <Block n={2} title="Scope" subtitle="What was covered, and over what period">
              <p className="text-[0.875rem] text-ink-700 leading-relaxed">{report.scope}</p>
            </Block>

            <Block n={3} title="Test procedure" subtitle="The steps performed">
              <pre className="whitespace-pre-wrap font-sans text-[0.875rem] text-ink-700 leading-relaxed">{report.testProcedure}</pre>
            </Block>

            <Block n={4} title="Samples and exceptions" subtitle="What the testing counted">
              {/* A three-column table rather than three tiles: these are one
                  set of counts, not three separate facts. */}
              <table className="w-full text-left border-t border-canvas-border">
                <tbody>
                  {[
                    { label: 'Samples selected', value: report.samplesSelected, tone: 'text-ink-900' },
                    { label: 'Samples tested', value: report.samplesTested, tone: 'text-ink-900' },
                    { label: 'Exceptions', value: report.exceptionsFound, tone: report.exceptionsFound > 0 ? 'text-risk-700' : 'text-compliant-700' },
                  ].map(r => (
                    <tr key={r.label} className="border-b border-canvas-border">
                      <th scope="row" className="py-2.5 text-[0.8125rem] font-medium text-ink-500">{r.label}</th>
                      <td className={`py-2.5 text-right text-[0.9375rem] font-semibold tabular-nums ${r.tone}`}>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Block>

            <Block n={5} title="Results" subtitle="What the testing found">
              <p className="text-[0.875rem] text-ink-700 leading-relaxed">{report.results}</p>
            </Block>

            <Block n={6} title="Conclusion" subtitle={`Recorded by ${recordedBy}`}>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full border text-[0.8125rem] font-semibold ${conclusionClass}`}>
                  <Ic size={13} /> {report.conclusion}
                </span>
                <span className="text-[0.8125rem] text-ink-400">Working paper status: {report.status}</span>
              </div>
            </Block>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
