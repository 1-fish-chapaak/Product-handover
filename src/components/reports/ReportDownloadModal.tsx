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
import type { QueryGraph, QueryTable } from '../../data/queryGraphs';

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
      table?: QueryTable | null;
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
  sections: DownloadPreviewSection[];
  onClose: () => void;
}

type Format = 'pdf' | 'docx' | 'pptx' | 'html';

const FORMATS: { id: Format; label: string; ext: string }[] = [
  { id: 'pdf', label: 'PDF', ext: 'pdf' },
  { id: 'docx', label: 'DOCX', ext: 'doc' },
  { id: 'pptx', label: 'PPTX', ext: 'ppt' },
  { id: 'html', label: 'HTML', ext: 'html' },
];

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
  sections,
  onClose,
}: Props) {
  const { addToast } = useToast();
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
      const ctx = { reportName, reportTag, reportId, templateName, generatedBy, generatedAt, sections };
      if (format === 'docx') {
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
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div
          className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
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
          className="relative w-full max-w-[840px] h-[88vh] flex flex-col bg-white rounded-[16px] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-[8px] bg-primary/10 text-primary shrink-0">
                <Download size={16} />
              </div>
              <h2 className="text-[15px] font-bold text-text">Download Report</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[8px] text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
              aria-label="Close preview"
            >
              <X size={16} />
            </button>
          </div>

          {/* Format Tabs */}
          <div className="shrink-0 px-6 border-b border-border-light bg-surface-1/40">
            <div role="tablist" aria-label="Download format" className="flex items-center gap-1">
              {FORMATS.map(f => {
                const isActive = format === f.id;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setFormat(f.id)}
                    className={`relative inline-flex items-center h-11 px-4 text-[13px] font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded-[8px] ${
                      isActive ? 'text-primary' : 'text-text-muted hover:text-text'
                    }`}
                  >
                    <span>{f.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="download-tab-indicator"
                        className="absolute left-2 right-2 -bottom-px h-[2px] bg-primary rounded-t"
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
          <div className="flex-1 overflow-y-auto overflow-x-auto bg-[#F1EEE8] py-8">
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
                    sections={bodySections}
                  />
                )}
                {format === 'pptx' && (
                  <PptPreview
                    reportName={reportName}
                    reportTag={reportTag}
                    generatedBy={generatedBy}
                    generatedAt={generatedAt}
                    sections={bodySections}
                  />
                )}
                {(format === 'docx' || format === 'html') && (
                  <DocxPreview
                    reportName={reportName}
                    reportTag={reportTag}
                    generatedBy={generatedBy}
                    generatedAt={generatedAt}
                    sections={bodySections}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer — primary Download action */}
          <div className="shrink-0 px-6 py-4 border-t border-border-light bg-white flex items-center justify-end">
            <Gated permission="rp_edit" mode="disable" title="You don't have permission to export reports">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              aria-busy={isDownloading || undefined}
              className="flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-80 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
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
  reportName, reportTag, generatedBy, generatedAt, sections,
}: {
  reportName: string;
  reportTag?: string;
  generatedBy: string;
  generatedAt: string;
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
          <h1 className="font-display text-[30px] leading-[1.15] font-semibold text-ink-900 tracking-tight mb-4">
            {reportName}
          </h1>
          <div className="mx-auto h-px bg-ink-900/20 w-16 mb-5" />
          <p className="text-[12px] text-text-secondary leading-relaxed max-w-[68%] mx-auto mb-10">
            Findings, observations, and remediation for the period.
          </p>
          <div className="grid grid-cols-2 gap-4 text-[11px] max-w-[60%] mx-auto">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-text-muted mb-0.5">Author</div>
              <div className="font-semibold text-text">{generatedBy}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-text-muted mb-0.5">Date</div>
              <div className="font-semibold text-text">{generatedAt}</div>
            </div>
          </div>
        </div>
      </PdfPage>

      {/* Contents page */}
      <PdfPage pageNo={2} totalPages={totalPages} reportName={reportName} reportTag={reportTag}>
        <PdfContents sections={sections} />
      </PdfPage>

      {/* Content pages — one PdfPage per block */}
      {blocks.map((block, i) => (
        <PdfPage key={block.map(b => b.id).join('-')} pageNo={i + 3} totalPages={totalPages} reportName={reportName} reportTag={reportTag}>
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

function PdfContents({ sections }: { sections: DownloadPreviewSection[] }) {
  return (
    <div>
      <h2 className="font-display text-[22px] leading-[1.2] font-semibold text-ink-900 tracking-tight mb-1">
        Table of Contents
      </h2>
      <div className="h-px bg-ink-900/20 w-12 mb-6" />
      <ol className="space-y-2">
        {sections.map((s, i) => {
          const pageNo = i + 3;
          const label = contentsLabel(s);
          return (
            <li key={s.id} className="flex items-baseline gap-3 text-[12px]">
              <span className="font-mono tabular-nums text-text-muted w-7 shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-display text-ink-900 truncate">{label}</span>
              <span className="flex-1 border-b border-dotted border-ink-900/20 translate-y-[-3px]" />
              <span className="font-mono tabular-nums text-text-muted">{pageNo}</span>
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

// Small upper-right tag badge — accepts any "SOX Compliance"-style label.
function ReportTagBadge({ tag }: { tag: string }) {
  const parts = tag.split(/\s+/);
  const first = parts[0];
  const rest = parts.slice(1).join(' ');
  return (
    <div className="inline-flex items-center gap-1.5 text-ink-700">
      <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden>
        <path d="M1 5.5 L4 8 L9 1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="leading-none">
        <div className="font-bold text-[11px] tracking-[0.04em]">{first}</div>
        {rest && (
          <div className="text-[6px] tracking-[0.18em] font-semibold opacity-70 mt-[1px]">
            {rest.toUpperCase()}
          </div>
        )}
      </div>
    </div>
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

function PdfPage({ pageNo, totalPages, variant = 'interior', reportName, reportTag, children }: {
  pageNo: number;
  totalPages: number;
  variant?: 'cover' | 'interior';
  reportName: string;
  reportTag?: string;
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
          <span className="text-[11px] font-semibold text-brand-700">{reportName}</span>
          <div className="flex-1 h-px bg-ink-900/25" />
          <span className="text-[10px] font-mono tabular-nums text-text-muted">{pageNo} / {totalPages}</span>
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
  reportName, reportTag, generatedBy, generatedAt, sections,
}: {
  reportName: string;
  reportTag?: string;
  generatedBy: string;
  generatedAt: string;
  sections: DownloadPreviewSection[];
}) {
  const total = sections.length + 2;
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Title slide */}
      <PptSlide slideNo={1} total={total} reportName={reportName}>
        <div className="h-full flex flex-col justify-center">
          <h1 className="font-display text-[34px] leading-[1.1] font-semibold text-ink-900 tracking-tight mb-3">
            {reportName}
          </h1>
          <div className="h-[3px] bg-primary w-12 mb-4" />
          <div className="flex items-center gap-3 text-[12px] text-text-secondary">
            <span className="font-semibold text-text">{generatedBy}</span>
            <span className="text-text-muted/60">·</span>
            <span>{generatedAt}</span>
          </div>
        </div>
      </PptSlide>

      {/* Contents slide */}
      <PptSlide slideNo={2} total={total} reportName={reportName}>
        <PdfContents sections={sections} />
      </PptSlide>

      {/* Content slides — one section per slide, widgets included.
          Query slides use a 2-column split (chart left, meta/KPIs/findings right). */}
      {sections.map((s, i) => (
        <PptSlide key={s.id} slideNo={i + 3} total={total} reportName={reportName}>
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

function PptSlide({ slideNo, total, reportName, children }: {
  slideNo: number;
  total: number;
  reportName: string;
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
          <span className="text-[11px] font-semibold text-brand-700">{reportName}</span>
          <div className="flex-1 h-px bg-ink-900/25" />
          <span className="text-[10px] font-mono tabular-nums text-text-muted">{slideNo} / {total}</span>
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
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted mb-1">{section.queryId}</div>
        <h2 className="font-display text-[18px] leading-[1.2] font-semibold text-ink-900 tracking-tight mb-2">{section.queryTitle}</h2>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${severityBadgeClass(section.severity)}`}>
            <AlertTriangle size={12} /> {section.severity}
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-text-secondary">{section.risk}</span>
        </div>
      </div>

      {/* 2-column body */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Left: chart */}
        <div className="bg-canvas-elevated border border-border-light rounded-[12px] p-3 flex flex-col min-h-0">
          {firstChart ? (
            <>
              <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-text-secondary shrink-0">
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
            <div className="flex-1 flex items-center justify-center text-[11px] text-text-muted">No chart attached</div>
          )}
        </div>

        {/* Right: KPIs + summary + findings */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          {kpis.length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 tabular-nums">
              {kpis.map(k => (
                <div key={k.label} className="flex items-baseline gap-1.5">
                  <span className="text-[15px] font-semibold text-ink-900 leading-none">{k.value}</span>
                  <span className="text-[10px] text-text-muted font-medium leading-tight">{k.label}</span>
                </div>
              ))}
            </div>
          )}
          {summaryText && (
            <p className="text-[11px] leading-[1.5] text-ink-800 line-clamp-3">{summaryText}</p>
          )}
          {section.findings.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-text-muted mb-1">Findings</div>
              <ul className="space-y-0.5">
                {section.findings.slice(0, 3).map((f, i) => (
                  <li key={i} className="text-[10px] leading-[1.4] text-ink-800 flex gap-1.5">
                    <span className="text-primary mt-[3px] shrink-0">•</span>
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
  reportName, reportTag, generatedBy, generatedAt, sections,
}: {
  reportName: string;
  reportTag?: string;
  generatedBy: string;
  generatedAt: string;
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
          <h1 className="font-display text-[26px] leading-[1.2] font-semibold text-ink-900 tracking-tight mb-2">
            {reportName}
          </h1>
          <p className="text-[12px] text-text-muted italic mb-1">
            Prepared by {generatedBy}
          </p>
          <p className="text-[12px] text-text-muted italic">{generatedAt}</p>
        </div>
      </PdfPage>

      {/* Contents page */}
      <PdfPage pageNo={2} totalPages={totalPages} reportName={reportName} reportTag={reportTag}>
        <PdfContents sections={sections} />
      </PdfPage>

      {/* Content pages */}
      {blocks.map((block, i) => (
        <PdfPage key={block.map(b => b.id).join('-')} pageNo={i + 3} totalPages={totalPages} reportName={reportName} reportTag={reportTag}>
          <PageBlockBody block={block} typeface="serif" />
        </PdfPage>
      ))}
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
    ? 'font-display text-[18px] leading-[1.25] font-semibold text-ink-900 tracking-tight'
    : 'font-display text-[20px] leading-[1.2] font-semibold text-ink-900 tracking-tight';
  const bodyClass = typeface === 'serif'
    ? 'font-display text-[12px] leading-[1.65] text-ink-800'
    : 'text-[13px] leading-[1.55] text-ink-800';
  const labelClass = 'text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted';

  if (section.kind === 'summary') {
    const stats = section.stats ?? [];
    return (
      <div>
        <h2 className={titleClass + ' mb-4 flex items-center gap-2'}>
          <Sparkles size={14} className="text-primary" />
          {section.title || 'Executive Summary'}
        </h2>
        {/* ATR-style KPI tile grid — mirrors the on-screen exec summary */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {stats.map(st => (
              <div
                key={st.label}
                className="rounded-[10px] border border-border-light bg-white p-3"
                style={{ borderLeft: `3px solid ${st.accent ?? '#6A12CD'}` }}
              >
                <div className="text-[18px] font-bold tabular-nums leading-none mb-1" style={{ color: st.accent ?? '#6A12CD' }}>{st.value}</div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-ink-600 leading-tight">{st.label}</div>
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
    const table = section.table ?? null;
    return (
      <div>
        <div className={labelClass + ' mb-2'}>{section.queryId}</div>
        <h2 className={titleClass + ' mb-3'}>{section.queryTitle}</h2>
        <div className="flex items-center gap-2 mb-4 text-[10px]">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${severityBadgeClass(section.severity)}`}>
            <AlertTriangle size={12} /> {section.severity}
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-text-secondary">{section.risk}</span>
        </div>

        {/* KPI strip — mirrors the in-report inline metrics */}
        {kpis.length > 0 && (
          <div className="flex items-baseline flex-wrap gap-x-5 gap-y-1.5 tabular-nums mb-4">
            {kpis.map(k => (
              <span key={k.label} className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-semibold text-ink-900 leading-none">{k.value}</span>
                <span className="text-[10px] text-text-muted font-medium">{k.label}</span>
              </span>
            ))}
          </div>
        )}

        <p className={bodyClass + ' mb-4'}>{section.summary || section.answer}</p>

        {/* Charts — render each available chart with the canonical renderer */}
        {!compact && charts.map(g => (
          <div key={g.id} className="bg-canvas-elevated border border-border-light rounded-[12px] p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">
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

        {/* Results table */}
        {!compact && table && table.rows.length > 0 && (
          <div className="bg-canvas-elevated border border-border-light rounded-[12px] p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">
              <LayoutGrid size={12} /> Results Table
            </div>
            <div className="overflow-hidden rounded-[12px] border border-border-light">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-paper-50">
                    {table.columns.map(c => (
                      <th key={c} className="px-2 py-1.5 text-left text-[9px] font-bold text-text-muted uppercase tracking-wider border-b border-border-light whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.slice(0, 8).map((row, ri) => (
                    <tr key={ri} className="border-b border-border-light last:border-b-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1.5 text-[10px] text-text-secondary whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!compact && section.findings.length > 0 && (
          <FindingsBlock title="Findings" items={section.findings} bodyClass={bodyClass} labelClass={labelClass} />
        )}
        {!compact && section.observations.length > 0 && (
          <FindingsBlock title="Observations" items={section.observations} bodyClass={bodyClass} labelClass={labelClass} />
        )}
        {compact && (section.findings.length > 0 || section.observations.length > 0) && (
          <div className="text-[11px] text-text-muted italic">
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
          <ShieldAlert size={12} className="text-primary" /> {section.workflowId}
        </div>
        <h2 className={titleClass + ' mb-3'}>{section.workflowName}</h2>
        <div className="flex items-center gap-2 mb-4 text-[10px]">
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
          <FileText size={12} className="text-primary" /> Note
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
          <CheckCircle2 size={12} className="text-primary" /> {section.obsId}
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
            <span className="text-primary mt-1 shrink-0">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
