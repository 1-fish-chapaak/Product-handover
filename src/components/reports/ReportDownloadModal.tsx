import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Gated from '../shared/Gated';
import {
  X, Download, FileText, AlertTriangle, CheckCircle2, Sparkles, ShieldAlert, BarChart3, LayoutGrid, Loader2,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { exportReportWord, exportReportPpt, exportReportPdf, exportReportHtml } from './reportExport';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';
import type { QueryGraph, QueryTableDef } from '../../data/queryGraphs';
import { cellRender } from './queryTableCell';

export type DownloadPreviewKpi = { label: string; value: string };
/** Report-level KPI tile — accent is the resolved hex of the tile's tone. */
export type DownloadPreviewStat = { label: string; value: string; accent?: string };

export type DownloadPreviewSection =
  | { id: string; kind: 'cover'; title: string }
  | { id: string; kind: 'summary'; title: string; content: string; stats?: DownloadPreviewStat[] }
  | { id: string; kind: 'stats'; title: string; stats?: DownloadPreviewStat[] }
  | {
      id: string;
      kind: 'query';
      title: string;
      queryId: string;
      queryTitle: string;
      severity: string;
      risk: string;
      summary: string;
      answer: string;
      findings: string[];
      observations: string[];
      kpis?: DownloadPreviewKpi[];
      charts?: QueryGraph[];
      tables?: QueryTableDef[];
    }
  | {
      id: string;
      kind: 'workflow';
      title: string;
      workflowId: string;
      workflowName: string;
      severity: string;
      summary: string;
      findings: string[];
      observations: string[];
    }
  | { id: string; kind: 'note'; title: string; content: string }
  | { id: string; kind: 'observation'; title: string; obsId: string; description: string };

interface Props {
  reportName: string;
  reportTag?: string;
  reportId?: string;
  templateName?: string;
  generatedBy: string;
  generatedAt: string;
  /** Page numbers on the exported document — carried from the report's template.
   *  Absent = on (reports paginate by default). */
  pageNumbers?: boolean;
  /** Custom brand colour (hex) — recolours the exported cover + accents. */
  brandColor?: string;
  /** Sign-off block — signatory slots + their sign state (rendered in exports). */
  signatories?: import('./reportShared').SignatorySlot[];
  signoffs?: Record<string, import('./reportShared').Signoff>;
  sections: DownloadPreviewSection[];
  /** Optional spreadsheet export. When provided, an "Excel" tab is shown and the
   *  Download action delegates to this callback (the report owns the .xlsx
   *  composer — e.g. ATR / bulk-audit tabular exports). */
  onExcelExport?: () => void;
  onClose: () => void;
}

type Format = 'pdf' | 'docx' | 'pptx' | 'html' | 'xlsx';

const BASE_FORMATS: { id: Format; label: string; ext: string }[] = [
  { id: 'pdf', label: 'PDF', ext: 'pdf' },
  { id: 'docx', label: 'DOCX', ext: 'doc' },
  { id: 'pptx', label: 'PPTX', ext: 'ppt' },
  { id: 'html', label: 'HTML', ext: 'html' },
];
const EXCEL_FORMAT = { id: 'xlsx' as Format, label: 'Excel', ext: 'xlsx' };

// Severity badge colour mapping — High (red) / Medium (amber) / Low (green).
function severityBadgeClass(severity: string): string {
  if (severity === 'Medium') return 'bg-mitigated-50 text-mitigated-700';
  if (severity === 'Low') return 'bg-compliant-50 text-compliant-700';
  return 'bg-risk-50 text-risk-700';
}

export default function ReportDownloadModal({
  reportName,
  reportTag,
  reportId,
  templateName,
  generatedBy,
  generatedAt,
  pageNumbers,
  brandColor,
  signatories,
  signoffs,
  sections,
  onExcelExport,
  onClose,
}: Props) {
  const { addToast } = useToast();
  const FORMATS = useMemo(() => (onExcelExport ? [...BASE_FORMATS, EXCEL_FORMAT] : BASE_FORMATS), [onExcelExport]);
  const [format, setFormat] = useState<Format>('pdf');
  const [isDownloading, setIsDownloading] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const activeFormat = FORMATS.find(f => f.id === format)!;

  // Skip 'cover' and 'stats' kinds. For 'query' sections, only keep the ones
  // that actually have widgets (graphs/KPIs) so the preview shows visual
  // content per query rather than empty text-only pages.
  const bodySections = useMemo(
    () => sections.filter(s => {
      if (s.kind === 'cover' || s.kind === 'stats') return false;
      if (s.kind === 'query') {
        const hasCharts = (s.charts?.length ?? 0) > 0;
        const hasKpis = (s.kpis?.length ?? 0) > 0;
        return hasCharts && hasKpis;
      }
      return true;
    }),
    [sections],
  );

  const handleDownload = () => {
    if (isDownloading) return;
    setIsDownloading(true);
    // Brief preparing window so the in-place spinner registers visually
    // before the export fires and the modal closes.
    window.setTimeout(() => {
      const ctx = { reportName, reportTag, reportId, templateName, generatedBy, generatedAt, sections, pageNumbers: pageNumbers ?? true, brandColor, signatories, signoffs };
      if (format === 'xlsx') {
        onExcelExport?.();
        addToast({ type: 'success', message: `${reportName}.xlsx downloaded.` });
      } else if (format === 'docx') {
        exportReportWord(ctx);
        addToast({ type: 'success', message: `${reportName}.${activeFormat.ext} downloaded.` });
      } else if (format === 'pptx') {
        exportReportPpt(ctx);
        addToast({ type: 'success', message: `${reportName}.${activeFormat.ext} downloaded.` });
      } else if (format === 'html') {
        exportReportHtml(ctx);
        addToast({ type: 'success', message: `${reportName}.${activeFormat.ext} downloaded.` });
      } else if (exportReportPdf(ctx)) {
        addToast({ type: 'info', message: 'Opening print dialog — choose “Save as PDF”.' });
      } else {
        addToast({ type: 'error', message: 'Pop-up blocked — allow pop-ups to export the PDF.' });
        setIsDownloading(false);
        return;
      }
      setIsDownloading(false);
      onClose();
    }, 700);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <div
          className="absolute inset-0 bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px]"
          onClick={onClose}
        />
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label={`Download preview for ${reportName}`}
          tabIndex={-1}
          className="relative w-[1040px] max-w-[95vw] h-[662px] max-h-[90vh] flex flex-col bg-canvas-elevated rounded-2xl border border-canvas-border shadow-xl overflow-hidden"
        >
          {/* Header — matches the shared Modal chrome (px-7, canonical title) */}
          <div className="shrink-0 flex items-center justify-between gap-4 px-7 py-3.5 border-b border-canvas-border">
            <h2 className="text-[1.25rem] leading-tight font-semibold text-ink-900 tracking-tight">Download Report</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md text-ink-500 hover:text-ink-800 hover:bg-canvas transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
          </div>

          {/* Format Tabs */}
          <div className="shrink-0 px-7 border-b border-canvas-border">
            <div role="tablist" aria-label="Download format" className="flex items-center gap-1">
              {FORMATS.map(f => {
                const isActive = format === f.id;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setFormat(f.id)}
                    className={`relative inline-flex items-center h-11 px-4 text-[0.8125rem] font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded-[8px] ${
                      isActive ? 'text-brand-600' : 'text-ink-400 hover:text-ink-800'
                    }`}
                  >
                    <span>{f.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="download-tab-indicator"
                        className="absolute left-2 right-2 -bottom-px h-[2px] bg-brand-600 rounded-t"
                        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview Body — fixed-pixel-width PDF/PPT/DOCX page mockups need
              horizontal scroll + scale-down on narrow viewports so the preview
              doesn't clip past the modal edge. */}
          <div className="flex-1 overflow-y-auto overflow-x-auto bg-canvas py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={format}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="max-w-full scale-[0.7] origin-top md:scale-100"
              >
                {format === 'pdf' && (
                  <PdfPreview
                    reportName={reportName}
                    reportTag={reportTag}
                    generatedBy={generatedBy}
                    generatedAt={generatedAt}
                    showPageNo={pageNumbers ?? true}
                    sections={bodySections}
                  />
                )}
                {format === 'pptx' && (
                  <PptPreview
                    reportName={reportName}
                    reportTag={reportTag}
                    generatedBy={generatedBy}
                    generatedAt={generatedAt}
                    showPageNo={pageNumbers ?? true}
                    sections={bodySections}
                  />
                )}
                {(format === 'docx' || format === 'html') && (
                  <DocxPreview
                    reportName={reportName}
                    reportTag={reportTag}
                    generatedBy={generatedBy}
                    generatedAt={generatedAt}
                    showPageNo={pageNumbers ?? true}
                    sections={bodySections}
                  />
                )}
                {format === 'xlsx' && <XlsxPreview reportName={reportName} sections={bodySections} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer — primary Download action */}
          <div className="shrink-0 px-7 py-3 border-t border-canvas-border bg-canvas-elevated flex items-center justify-end">
            <Gated permission="rp_edit" mode="disable" title="You don't have permission to export reports">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              aria-busy={isDownloading || undefined}
              className="flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-80 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isDownloading ? 'Preparing…' : 'Download'}
            </button>
            </Gated>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ───────────────────────── PDF Preview ─────────────────────────
// A4-aspect paper sheets stacked vertically. Each sheet has page-number
// footer + report-name header. Sections rendered in serif body for the
// printed-document feel.

function PdfPreview({
  reportName, reportTag, generatedBy, generatedAt, sections, showPageNo = true,
}: {
  reportName: string;
  reportTag?: string;
  generatedBy: string;
  generatedAt: string;
  showPageNo?: boolean;
  sections: DownloadPreviewSection[];
}) {
  // Group sections into page blocks. The Executive Summary shares its page
  // with the next section (typically the first query) so queries flow
  // naturally after summary instead of leaving summary on a half-empty page.
  const blocks = useMemo(() => groupSectionsIntoBlocks(sections), [sections]);
  const totalPages = blocks.length + 2;
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Cover page — chrome carries the tag + Irame mark, body shows title + meta */}
      <PdfPage pageNo={1} totalPages={totalPages} variant="cover" reportName={reportName} reportTag={reportTag}>
        <div className="h-full flex flex-col justify-center text-center">
          <h1 className="text-[1.75rem] leading-[1.15] font-semibold text-ink-900 tracking-tight mb-4">
            {reportName}
          </h1>
          <div className="mx-auto h-px bg-ink-900/20 w-16 mb-5" />
          <p className="text-[0.75rem] text-ink-500 leading-relaxed max-w-[68%] mx-auto mb-10">
            Findings, observations, and remediation for the period.
          </p>
          <div className="grid grid-cols-2 gap-4 text-[0.6875rem] max-w-[60%] mx-auto">
            <div>
              <div className="text-[0.5625rem] uppercase tracking-wider text-ink-400 mb-0.5">Author</div>
              <div className="font-semibold text-ink-800">{generatedBy}</div>
            </div>
            <div>
              <div className="text-[0.5625rem] uppercase tracking-wider text-ink-400 mb-0.5">Date</div>
              <div className="font-semibold text-ink-800">{generatedAt}</div>
            </div>
          </div>
        </div>
      </PdfPage>

      {/* Contents page */}
      <PdfPage pageNo={2} totalPages={totalPages} reportName={reportName} reportTag={reportTag} showPageNo={showPageNo}>
        <PdfContents sections={sections} showPageNo={showPageNo} />
      </PdfPage>

      {/* Content pages — one PdfPage per block */}
      {blocks.map((block, i) => (
        <PdfPage key={block.map(b => b.id).join('-')} pageNo={i + 3} totalPages={totalPages} reportName={reportName} reportTag={reportTag} showPageNo={showPageNo}>
          <PageBlockBody block={block} typeface="serif" />
        </PdfPage>
      ))}
    </div>
  );
}

// Pairs the Executive Summary section with the next section so they share a
// page. Every other section starts on a new page.
function groupSectionsIntoBlocks(sections: DownloadPreviewSection[]): DownloadPreviewSection[][] {
  const out: DownloadPreviewSection[][] = [];
  let i = 0;
  while (i < sections.length) {
    const s = sections[i];
    if (s.kind === 'summary' && i + 1 < sections.length) {
      out.push([s, sections[i + 1]]);
      i += 2;
    } else {
      out.push([s]);
      i += 1;
    }
  }
  return out;
}

function PageBlockBody({ block, typeface }: { block: DownloadPreviewSection[]; typeface: 'serif' | 'sans' }) {
  return (
    <>
      {block.map((s, j) => (
        <div key={s.id} className={j > 0 ? 'mt-6 pt-6 border-t border-ink-900/15' : ''}>
          <SectionContent section={s} typeface={typeface} />
        </div>
      ))}
    </>
  );
}

function PdfContents({ sections, showPageNo = true }: { sections: DownloadPreviewSection[]; showPageNo?: boolean }) {
  return (
    <div>
      <h2 className="text-[1.25rem] leading-[1.2] font-semibold text-ink-900 tracking-tight mb-1">
        Table of Contents
      </h2>
      <div className="h-px bg-ink-900/20 w-12 mb-6" />
      <ol className="space-y-2">
        {sections.map((s, i) => {
          const pageNo = i + 3;
          const label = contentsLabel(s);
          return (
            <li key={s.id} className="flex items-baseline gap-3 text-[0.75rem]">
              <span className="font-mono tabular-nums text-ink-400 w-7 shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-ink-900 truncate">{label}</span>
              <span className="flex-1 border-b border-dotted border-ink-900/20 translate-y-[-3px]" />
              {showPageNo && <span className="font-mono tabular-nums text-ink-400">{pageNo}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function contentsLabel(s: DownloadPreviewSection): string {
  if (s.kind === 'summary') return 'Executive Summary';
  if (s.kind === 'query') return `${s.queryId} · ${s.queryTitle}`;
  if (s.kind === 'workflow') return `${s.workflowId} · ${s.workflowName}`;
  if (s.kind === 'observation') return `${s.obsId} · ${s.title}`;
  if (s.kind === 'note') return s.title;
  return s.title;
}

// ───────────────────────── Branded chrome ─────────────────────────
// Header/footer ornamentation for the printed PDF look — purple chevron
// corner marks on the cover, a thin dark-brand top bar + tag badge on
// interior pages, an Irame bracket wordmark in the footer, and a tiled
// gradient chevron band along the bottom edge.

const BRAND_CHEV_LIGHT = '#C393FA'; // brand-300
const BRAND_CHEV_DARK = '#550FA5';  // brand-700
const BRAND_BAR_DARK = '#26064A';   // brand-900

// Decorative double-chevron used in cover corners.
function BrandChevronCorner({ corner }: { corner: 'tr' | 'bl' }) {
  const isTR = corner === 'tr';
  return (
    <svg
      viewBox="0 0 160 130"
      width="150"
      height="120"
      aria-hidden
      className={`absolute pointer-events-none ${isTR ? 'top-0 right-0' : 'bottom-0 left-0 rotate-180'}`}
    >
      <path d="M30 0 L160 0 L160 130 L130 130 L130 30 L0 30 Z" fill={BRAND_CHEV_LIGHT} />
      <path d="M80 50 L160 50 L160 130 L130 130 L130 80 L50 80 Z" fill={BRAND_CHEV_DARK} />
    </svg>
  );
}

// Bracket-corner wordmark used on cover and as footer brand mark.
function IrameWordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const textSize = size === 'lg' ? 13 : 10;
  const cornerSz = size === 'lg' ? 7 : 5;
  const stroke = size === 'lg' ? 1.5 : 1;
  return (
    <span className="relative inline-block px-1.5 py-0.5 text-brand-700">
      <span
        aria-hidden
        className="absolute"
        style={{ top: 0, right: 0, width: cornerSz, height: cornerSz, borderTop: `${stroke}px solid currentColor`, borderRight: `${stroke}px solid currentColor` }}
      />
      <span
        aria-hidden
        className="absolute"
        style={{ bottom: 0, left: 0, width: cornerSz, height: cornerSz, borderBottom: `${stroke}px solid currentColor`, borderLeft: `${stroke}px solid currentColor` }}
      />
      <span className="font-bold tracking-[0.18em]" style={{ fontSize: textSize }}>IRAME</span>
    </span>
  );
}

// Smooth gradient strip along the bottom edge — light purple → deep brand.
function FooterChevronBand() {
  return (
    <div
      className="absolute bottom-0 inset-x-0"
      style={{
        height: 14,
        background: 'linear-gradient(90deg, #EDDEFE 0%, #DCBBFD 18%, #C393FA 38%, #8838DE 58%, #550FA5 78%, #26064A 100%)',
      }}
      aria-hidden
    />
  );
}

function PdfPage({ pageNo, totalPages, variant = 'interior', reportName, showPageNo = true, children }: {
  pageNo: number;
  totalPages: number;
  variant?: 'cover' | 'interior';
  reportName: string;
  reportTag?: string;
  showPageNo?: boolean;
  children: React.ReactNode;
}) {
  if (variant === 'cover') {
    return (
      <div
        className="bg-white shadow-[0_2px_12px_rgba(0,0,0,0.10)] relative overflow-hidden"
        style={{ width: 640, minHeight: 906 /* ~A4 at this scale */ }}
      >
        <BrandChevronCorner corner="tr" />
        <BrandChevronCorner corner="bl" />
        <div className="absolute top-12 left-10 right-44">
          <div className="h-[2px] bg-brand-700 w-2/3" />
        </div>
        <div className="absolute bottom-8 right-10">
          <IrameWordmark size="lg" />
        </div>
        <div className="absolute inset-0 px-10 pt-44 pb-32 overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white shadow-[0_2px_12px_rgba(0,0,0,0.10)] relative overflow-hidden"
      style={{ width: 640, minHeight: 906 /* ~A4 at this scale */ }}
    >
      {/* Header: thin dark-brand bar */}
      <div className="absolute top-0 inset-x-0 h-1.5" style={{ background: BRAND_BAR_DARK }} />

      {/* Page body — clipped above the footer plate */}
      <div className="absolute left-0 right-0 top-1.5 bottom-16 px-10 pt-6 overflow-hidden">
        {children}
      </div>

      {/* Footer plate — solid white so chart/table content can't bleed into the footer row */}
      <div className="absolute bottom-3.5 left-0 right-0 bg-white px-10 py-3 z-10">
        <div className="flex items-center gap-3">
          <span className="text-[0.6875rem] font-semibold text-brand-700">{reportName}</span>
          <div className="flex-1 h-px bg-ink-900/25" />
          {showPageNo && <span className="text-[0.625rem] font-mono tabular-nums text-ink-400">{pageNo} / {totalPages}</span>}
        </div>
      </div>
      <FooterChevronBand />
    </div>
  );
}

// ───────────────────────── PPT Preview ─────────────────────────
// 16:9 slides. Title slide first, then one slide per section. Slide
// number bottom right. Primary-colored title bar.

function PptPreview({
  reportName, generatedBy, generatedAt, sections, showPageNo = true,
}: {
  reportName: string;
  reportTag?: string;
  generatedBy: string;
  generatedAt: string;
  showPageNo?: boolean;
  sections: DownloadPreviewSection[];
}) {
  const total = sections.length + 2;
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Title slide */}
      <PptSlide slideNo={1} total={total} reportName={reportName} showPageNo={showPageNo}>
        <div className="h-full flex flex-col justify-center">
          <h1 className="text-[2.125rem] leading-[1.1] font-semibold text-ink-900 tracking-tight mb-3">
            {reportName}
          </h1>
          <div className="h-[3px] bg-brand-600 w-12 mb-4" />
          <div className="flex items-center gap-3 text-[0.75rem] text-ink-500">
            <span className="font-semibold text-ink-800">{generatedBy}</span>
            <span className="text-ink-400/60">·</span>
            <span>{generatedAt}</span>
          </div>
        </div>
      </PptSlide>

      {/* Contents slide */}
      <PptSlide slideNo={2} total={total} reportName={reportName} showPageNo={showPageNo}>
        <PdfContents sections={sections} showPageNo={showPageNo} />
      </PptSlide>

      {/* Content slides — one section per slide, widgets included.
          Query slides use a 2-column split (chart left, meta/KPIs/findings right). */}
      {sections.map((s, i) => (
        <PptSlide key={s.id} slideNo={i + 3} total={total} reportName={reportName} showPageNo={showPageNo}>
          <div className="h-full flex flex-col overflow-hidden">
            {s.kind === 'query'
              ? <PptQuerySlideBody section={s} />
              : <SectionContent section={s} typeface="sans" />}
          </div>
        </PptSlide>
      ))}
    </div>
  );
}

function PptSlide({ slideNo, total, reportName, showPageNo = true, children }: {
  slideNo: number;
  total: number;
  reportName: string;
  showPageNo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white shadow-[0_2px_12px_rgba(0,0,0,0.10)] relative overflow-hidden"
      style={{ width: 720, height: 405 /* 16:9 */ }}
    >
      {/* Header: thin dark-brand bar */}
      <div className="absolute top-0 inset-x-0 h-1.5" style={{ background: BRAND_BAR_DARK }} />

      {/* Slide body */}
      <div className="absolute left-0 right-0 top-1.5 bottom-14 px-12 pt-6 overflow-hidden">
        {children}
      </div>

      {/* Footer plate */}
      <div className="absolute bottom-3.5 left-0 right-0 bg-white px-12 py-3 z-10">
        <div className="flex items-center gap-3">
          <span className="text-[0.6875rem] font-semibold text-brand-700">{reportName}</span>
          <div className="flex-1 h-px bg-ink-900/25" />
          {showPageNo && <span className="text-[0.625rem] font-mono tabular-nums text-ink-400">{slideNo} / {total}</span>}
        </div>
      </div>
      <FooterChevronBand />
    </div>
  );
}

// Query-card slide body: 2-column layout — chart on the left, KPIs +
// textual summary + findings stacked on the right.
function PptQuerySlideBody({ section }: { section: Extract<DownloadPreviewSection, { kind: 'query' }> }) {
  const kpis = section.kpis ?? [];
  const charts = section.charts ?? [];
  const firstChart = charts[0];
  const summaryText = section.summary || section.answer;

  return (
    <div className="h-full flex flex-col">
      {/* Header band */}
      <div className="mb-3 shrink-0">
        <div className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-ink-400 mb-1">{section.queryId}</div>
        <h2 className="text-[1.125rem] leading-[1.2] font-semibold text-ink-900 tracking-tight mb-2">{section.queryTitle}</h2>
        <div className="flex items-center gap-2 text-[0.625rem]">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${severityBadgeClass(section.severity)}`}>
            <AlertTriangle size={12} /> {section.severity}
          </span>
          <span className="text-ink-400">·</span>
          <span className="text-ink-500">{section.risk}</span>
        </div>
      </div>

      {/* 2-column body */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Left: chart */}
        <div className="bg-canvas-elevated border border-canvas-border rounded-[12px] p-3 flex flex-col min-h-0">
          {firstChart ? (
            <>
              <div className="flex items-center gap-1.5 mb-1.5 text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-ink-500 shrink-0">
                <BarChart3 size={12} /> {firstChart.title}
              </div>
              <div className="flex-1 min-h-0">
                <ConfigurableChart
                  type={firstChart.type}
                  xAxis={firstChart.xAxis}
                  yAxis={firstChart.yAxis}
                  color={firstChart.color ?? '#6a12cd'}
                  showTarget={false}
                  showLegend
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[0.6875rem] text-ink-400">No chart attached</div>
          )}
        </div>

        {/* Right: KPIs + summary + findings */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          {kpis.length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 tabular-nums">
              {kpis.map(k => (
                <div key={k.label} className="flex items-baseline gap-1.5">
                  <span className="text-[0.9375rem] font-semibold text-ink-900 leading-none">{k.value}</span>
                  <span className="text-[0.625rem] text-ink-400 font-medium leading-tight">{k.label}</span>
                </div>
              ))}
            </div>
          )}
          {summaryText && (
            <p className="text-[0.6875rem] leading-[1.5] text-ink-800 line-clamp-3">{summaryText}</p>
          )}
          {section.findings.length > 0 && (
            <div>
              <div className="text-[0.5625rem] font-bold uppercase tracking-[0.16em] text-ink-400 mb-1">Findings</div>
              <ul className="space-y-0.5">
                {section.findings.slice(0, 3).map((f, i) => (
                  <li key={i} className="text-[0.625rem] leading-[1.4] text-ink-800 flex gap-1.5">
                    <span className="text-brand-600 mt-[3px] shrink-0">•</span>
                    <span className="line-clamp-2">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── DOCX Preview ─────────────────────────
// Single continuous "Letter-sized" document with serif typography.
// No page breaks visible — flows like a Word doc.

function DocxPreview({
  reportName, reportTag, generatedBy, generatedAt, sections, showPageNo = true,
}: {
  reportName: string;
  reportTag?: string;
  generatedBy: string;
  generatedAt: string;
  showPageNo?: boolean;
  sections: DownloadPreviewSection[];
}) {
  // Same pagination model as PDF: cover, contents, then summary pairs with
  // the next section, queries follow one per page.
  const blocks = useMemo(() => groupSectionsIntoBlocks(sections), [sections]);
  const totalPages = blocks.length + 2;
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Cover-style title page */}
      <PdfPage pageNo={1} totalPages={totalPages} reportName={reportName} reportTag={reportTag}>
        <div className="pt-2">
          <h1 className="text-[1.625rem] leading-[1.2] font-semibold text-ink-900 tracking-tight mb-2">
            {reportName}
          </h1>
          <p className="text-[0.75rem] text-ink-400 italic mb-1">
            Prepared by {generatedBy}
          </p>
          <p className="text-[0.75rem] text-ink-400 italic">{generatedAt}</p>
        </div>
      </PdfPage>

      {/* Contents page */}
      <PdfPage pageNo={2} totalPages={totalPages} reportName={reportName} reportTag={reportTag} showPageNo={showPageNo}>
        <PdfContents sections={sections} showPageNo={showPageNo} />
      </PdfPage>

      {/* Content pages */}
      {blocks.map((block, i) => (
        <PdfPage key={block.map(b => b.id).join('-')} pageNo={i + 3} totalPages={totalPages} reportName={reportName} reportTag={reportTag} showPageNo={showPageNo}>
          <PageBlockBody block={block} typeface="serif" />
        </PdfPage>
      ))}
    </div>
  );
}

// ───────────────────────── XLSX Preview ─────────────────────────
// Spreadsheet mockup — one row per content section, the columns an export would
// carry. Excel-green chrome so the format reads at a glance; no page metaphor.

function XlsxPreview({ reportName, sections }: { reportName: string; sections: DownloadPreviewSection[] }) {
  const rows = sections.map((s, i) => {
    if (s.kind === 'query') return { ref: s.queryId, title: s.queryTitle, type: 'Query', status: s.severity };
    if (s.kind === 'workflow') return { ref: s.workflowId, title: s.workflowName, type: 'Workflow', status: s.severity };
    if (s.kind === 'observation') return { ref: s.obsId, title: s.title, type: 'Observation', status: '—' };
    if (s.kind === 'summary') return { ref: `R${String(i + 1).padStart(2, '0')}`, title: s.title || 'Executive Summary', type: 'Summary', status: '—' };
    return { ref: `R${String(i + 1).padStart(2, '0')}`, title: s.title, type: 'Note', status: '—' };
  });
  const cols = ['Ref', 'Title', 'Type', 'Severity / Status'];
  return (
    <div className="flex flex-col items-center">
      <div className="bg-white shadow-[0_2px_12px_rgba(0,0,0,0.10)] overflow-hidden rounded-[4px]" style={{ width: 720 }}>
        {/* Sheet tab bar */}
        <div className="flex items-center gap-2 px-4 h-10 bg-[#107C41] text-white">
          <LayoutGrid size={14} />
          <span className="text-[0.8125rem] font-semibold truncate">{reportName}.xlsx</span>
        </div>
        <table className="w-full border-collapse text-[0.75rem]">
          <thead>
            <tr className="bg-[#E9F2EC] text-[#0B5A30]">
              <th className="w-10 px-2 py-2 text-left font-bold border border-[#CFE3D7]">#</th>
              {cols.map(c => (
                <th key={c} className="px-3 py-2 text-left font-bold border border-[#CFE3D7] whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-[#F6FBF8]">
                <td className="px-2 py-2 text-ink-400 font-mono tabular-nums border border-[#E3EDE7]">{i + 1}</td>
                <td className="px-3 py-2 font-mono text-ink-600 border border-[#E3EDE7] whitespace-nowrap">{r.ref}</td>
                <td className="px-3 py-2 text-ink-800 border border-[#E3EDE7]">{r.title}</td>
                <td className="px-3 py-2 text-ink-500 border border-[#E3EDE7] whitespace-nowrap">{r.type}</td>
                <td className="px-3 py-2 text-ink-500 border border-[#E3EDE7] whitespace-nowrap">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[0.75rem] text-ink-400">Workbook with one row per section. Underlying result tables export as additional sheets.</p>
    </div>
  );
}

// ───────────────────────── Shared section renderer ─────────────────────────

function SectionContent({ section, typeface, compact = false }: {
  section: DownloadPreviewSection;
  typeface: 'serif' | 'sans';
  compact?: boolean;
}) {
  const titleClass = typeface === 'serif'
    ? 'text-[1.125rem] leading-[1.25] font-semibold text-ink-900 tracking-tight'
    : 'text-[1.25rem] leading-[1.2] font-semibold text-ink-900 tracking-tight';
  const bodyClass = typeface === 'serif'
    ? 'text-[0.75rem] leading-[1.65] text-ink-800'
    : 'text-[0.8125rem] leading-[1.55] text-ink-800';
  const labelClass = 'text-[0.625rem] font-bold uppercase tracking-[0.16em] text-ink-400';

  if (section.kind === 'summary') {
    const stats = section.stats ?? [];
    return (
      <div>
        <h2 className={titleClass + ' mb-4 flex items-center gap-2'}>
          <Sparkles size={14} className="text-brand-600" />
          {section.title || 'Executive Summary'}
        </h2>
        {/* ATR-style KPI tile grid — mirrors the on-screen exec summary */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {stats.map(st => (
              <div
                key={st.label}
                className="rounded-[10px] border border-canvas-border bg-white p-3"
                style={{ borderLeft: `3px solid ${st.accent ?? '#6A12CD'}` }}
              >
                <div className="text-[1.125rem] font-bold tabular-nums leading-none mb-1" style={{ color: st.accent ?? '#6A12CD' }}>{st.value}</div>
                <div className="text-[0.5625rem] font-semibold uppercase tracking-wide text-ink-600 leading-tight">{st.label}</div>
              </div>
            ))}
          </div>
        )}
        <p className={bodyClass}>{section.content}</p>
      </div>
    );
  }

  if (section.kind === 'query') {
    const kpis = section.kpis ?? [];
    const charts = section.charts ?? [];
    const tables = section.tables ?? [];
    return (
      <div>
        <div className={labelClass + ' mb-2'}>{section.queryId}</div>
        <h2 className={titleClass + ' mb-3'}>{section.queryTitle}</h2>
        <div className="flex items-center gap-2 mb-4 text-[0.625rem]">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${severityBadgeClass(section.severity)}`}>
            <AlertTriangle size={12} /> {section.severity}
          </span>
          <span className="text-ink-400">·</span>
          <span className="text-ink-500">{section.risk}</span>
        </div>

        {/* KPI strip — mirrors the in-report inline metrics */}
        {kpis.length > 0 && (
          <div className="flex items-baseline flex-wrap gap-x-5 gap-y-1.5 tabular-nums mb-4">
            {kpis.map(k => (
              <span key={k.label} className="flex items-baseline gap-1.5">
                <span className="text-[0.9375rem] font-semibold text-ink-900 leading-none">{k.value}</span>
                <span className="text-[0.625rem] text-ink-400 font-medium">{k.label}</span>
              </span>
            ))}
          </div>
        )}

        <p className={bodyClass + ' mb-4'}>{section.summary || section.answer}</p>

        {/* Charts — render each available chart with the canonical renderer */}
        {!compact && charts.map(g => (
          <div key={g.id} className="bg-canvas-elevated border border-canvas-border rounded-[12px] p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-ink-500">
              <BarChart3 size={12} /> {g.title}
            </div>
            <div className="h-[160px]">
              <ConfigurableChart
                type={g.type}
                xAxis={g.xAxis}
                yAxis={g.yAxis}
                color={g.color ?? '#6a12cd'}
                showTarget={false}
                showLegend
              />
            </div>
          </div>
        ))}

        {/* Results tables — each attached table, dashboard styling via cellRender */}
        {!compact && tables.filter(t => t.rows.length > 0).map(t => (
          <div key={t.id} className="bg-canvas-elevated border border-canvas-border rounded-[12px] p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-ink-500">
              <LayoutGrid size={12} /> {t.title}
            </div>
            <div className="overflow-hidden rounded-[12px] border border-canvas-border">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-2/50">
                    {t.columns.map(c => (
                      <th key={c} className="px-2 py-1.5 text-left text-[0.5625rem] font-bold text-ink-500 uppercase tracking-wider border-b border-canvas-border whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.slice(0, 8).map((row, ri) => (
                    <tr key={ri} className="border-b border-canvas-border/50 last:border-b-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1.5 text-[0.625rem] whitespace-nowrap">
                          {cellRender(cell, t.columns[ci] || '', ci === 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {!compact && section.findings.length > 0 && (
          <FindingsBlock title="Findings" items={section.findings} bodyClass={bodyClass} labelClass={labelClass} />
        )}
        {!compact && section.observations.length > 0 && (
          <FindingsBlock title="Observations" items={section.observations} bodyClass={bodyClass} labelClass={labelClass} />
        )}
        {compact && (section.findings.length > 0 || section.observations.length > 0) && (
          <div className="text-[0.6875rem] text-ink-400 italic">
            {section.findings.length} {section.findings.length === 1 ? 'finding' : 'findings'} · {section.observations.length} {section.observations.length === 1 ? 'observation' : 'observations'}
          </div>
        )}
      </div>
    );
  }

  if (section.kind === 'workflow') {
    return (
      <div>
        <div className={labelClass + ' mb-2 flex items-center gap-1.5'}>
          <ShieldAlert size={12} className="text-brand-600" /> {section.workflowId}
        </div>
        <h2 className={titleClass + ' mb-3'}>{section.workflowName}</h2>
        <div className="flex items-center gap-2 mb-4 text-[0.625rem]">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${severityBadgeClass(section.severity)}`}>
            <AlertTriangle size={12} /> {section.severity}
          </span>
        </div>
        <p className={bodyClass + ' mb-4'}>{section.summary}</p>
        {!compact && section.findings.length > 0 && (
          <FindingsBlock title="Findings" items={section.findings} bodyClass={bodyClass} labelClass={labelClass} />
        )}
        {!compact && section.observations.length > 0 && (
          <FindingsBlock title="Observations" items={section.observations} bodyClass={bodyClass} labelClass={labelClass} />
        )}
      </div>
    );
  }

  if (section.kind === 'note') {
    return (
      <div>
        <div className={labelClass + ' mb-2 flex items-center gap-1.5'}>
          <FileText size={12} className="text-brand-600" /> Note
        </div>
        <h2 className={titleClass + ' mb-3'}>{section.title}</h2>
        <p className={bodyClass}>{section.content}</p>
      </div>
    );
  }

  if (section.kind === 'observation') {
    return (
      <div>
        <div className={labelClass + ' mb-2 flex items-center gap-1.5'}>
          <CheckCircle2 size={12} className="text-brand-600" /> {section.obsId}
        </div>
        <h2 className={titleClass + ' mb-3'}>{section.title}</h2>
        <p className={bodyClass}>{section.description}</p>
      </div>
    );
  }

  return null;
}

function FindingsBlock({ title, items, bodyClass, labelClass }: {
  title: string;
  items: string[];
  bodyClass: string;
  labelClass: string;
}) {
  return (
    <div className="mb-3">
      <div className={labelClass + ' mb-1.5'}>{title}</div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className={bodyClass + ' flex gap-2'}>
            <span className="text-brand-600 mt-1 shrink-0">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
