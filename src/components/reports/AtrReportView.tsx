import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Share2, Download, List, Pencil, Check, X, GitBranch, ShieldAlert } from 'lucide-react';
import AtrDocument from './AtrDocument';
import type { AtrReportData } from './atrTypes';
import { computeExecSummary, exportAtrExcel } from './atrTemplate';
import ReportDownloadModal, { type DownloadPreviewSection } from './ReportDownloadModal';
import ReportDiscardDialog from './ReportDiscardDialog';
import AtrReviewDrawer from './AtrReviewDrawer';
import { loadVersions, nowStamp } from './atrReview';
// ATR KPI tone → export accent hex (mirrors the on-screen exec-summary tiles).
const ATR_TONE_HEX = { brand: '#6A12CD', ink: '#334155', high: '#C2410C', compliant: '#15803D', mitigated: '#B45309' };

interface AtrReport {
  id: string;
  name: string;
  generatedBy?: string;
  generatedAt?: string;
  tag?: string;
  status?: 'draft' | 'final';
  atrData: AtrReportData;
}

/** Saved-ATR report page. Renders the generated Action Taken Report inside the
 *  shared reader workspace: plain page-level actions (no header bar), a persistent
 *  scroll-spy outline rail, and a constrained document column. */
export default function AtrReportView({ report, onBack, onShare, onSave, onManageExceptions }: {
  report: AtrReport;
  onBack: () => void;
  onShare?: () => void;
  /** Persist inline edits to the saved ATR. Absent → the report is read-only. */
  onSave?: (data: AtrReportData) => void;
  /** Opens the case-management (Manage Exceptions) view. Absent → button hidden. */
  onManageExceptions?: () => void;
}) {
  // Inline editing — a working draft over the saved report. `dirty` drives the
  // discard guard so leaving (or cancelling) only prompts when edits are unsaved.
  const editable = !!onSave;
  const [editing, setEditing] = useState(false);
  // The view remounts per report (navigating away passes through the list), so
  // the initializer is enough — no prop→state resync effect needed.
  const [draft, setDraft] = useState<AtrReportData>(report.atrData);
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(report.atrData);
  // `null` = no prompt; otherwise the action the discard would complete.
  const [pendingDiscard, setPendingDiscard] = useState<null | 'leave' | 'cancel'>(null);
  // Review drawer (comments + version history) — `null` = closed.
  const [reviewTab, setReviewTab] = useState<'comments' | 'versions' | null>(null);

  const requestBack = () => { if (dirty) setPendingDiscard('leave'); else onBack(); };
  const requestCancel = () => { if (dirty) setPendingDiscard('cancel'); else setEditing(false); };
  const confirmDiscard = () => {
    const action = pendingDiscard;
    setPendingDiscard(null);
    setDraft(report.atrData);
    setEditing(false);
    if (action === 'leave') onBack();
  };
  const saveEdits = () => { onSave?.(draft); setEditing(false); };

  const { meta, observations, insights } = draft;

  // The ATR document's sections are fixed; the rail mirrors them in order.
  const outlineEntries = [
    { id: 'atr-exec', title: 'Executive Summary' },
    { id: 'atr-obs-summary', title: 'Observation Wise Summary' },
    { id: 'atr-obs-details', title: 'Observation Details' },
    ...(insights.length > 0 ? [{ id: 'atr-insights', title: 'Key Insights & Recommendations' }] : []),
    { id: 'atr-signoff', title: 'Approvals & Sign-Off' },
  ];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('[id^="section-"]'));
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const lead = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (lead) setActiveSectionId(lead.target.id.replace(/^section-/, ''));
      },
      { root, rootMargin: '-84px 0px -62% 0px', threshold: 0 },
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [observations.length, insights.length]);

  const scrollToSection = (id: string) =>
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Map the ATR data onto the shared download-preview section model so the ATR
  // exports through the same modal (preview + PDF/DOCX/PPTX/HTML/Excel) as every
  // other report, instead of a bare window.print().
  const buildDownloadSections = (): DownloadPreviewSection[] => {
    const ex = computeExecSummary(observations);
    const totalExceptions = meta.totalExceptions ?? ex.totalExceptions;
    const openCount = ex.obsStatus.Open + ex.obsStatus.Overdue;
    const stats = [
      { label: 'Observations', value: String(ex.totalObservations), accent: ATR_TONE_HEX.brand },
      { label: 'Exceptions', value: String(totalExceptions), accent: ATR_TONE_HEX.ink },
      { label: 'Action Plans', value: String(ex.totalActionPlans), accent: ATR_TONE_HEX.brand },
      { label: 'Open', value: String(openCount), accent: ATR_TONE_HEX.high },
      { label: 'Closed', value: String(ex.obsStatus.Closed), accent: ATR_TONE_HEX.compliant },
      { label: 'In Progress', value: String(ex.obsStatus['In Progress']), accent: ATR_TONE_HEX.mitigated },
    ];
    return [
      {
        id: 'atr-exec',
        kind: 'summary',
        title: 'Executive Summary',
        content: `${ex.totalObservations} observation${ex.totalObservations === 1 ? '' : 's'} carrying ${totalExceptions} exception${totalExceptions === 1 ? '' : 's'} across ${ex.totalActionPlans} management action plan${ex.totalActionPlans === 1 ? '' : 's'}${ex.progressPct != null ? `, ${ex.progressPct}% remediated` : ''}.`,
        stats,
      },
      ...observations.map((o, i): DownloadPreviewSection => {
        const apCount = o.actionPlans.length;
        const apRoll = apCount
          ? ` ${apCount} management action plan${apCount === 1 ? '' : 's'}: ${o.actionPlans.map(p => p.title || p.text).filter(Boolean).join('; ')}.`
          : '';
        return {
          id: `atr-obs-${i}`,
          kind: 'observation',
          obsId: `OBS-${String(i + 1).padStart(2, '0')}`,
          title: o.title,
          description: `${o.description ?? ''}${apRoll}`.trim() || o.title,
        };
      }),
      ...insights.map((ins, i): DownloadPreviewSection => ({
        id: `atr-insight-${i}`, kind: 'note', title: ins.title, content: ins.body,
      })),
    ];
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="report-printable h-full overflow-y-auto bg-canvas"
      ref={scrollRef}
    >
      {/* Report actions — pinned to the top of the scroll area (page-coloured,
          borderless — no header-bar chrome) so they stay reachable on scroll. */}
      <div className="sticky top-0 z-30 bg-canvas px-6 lg:px-12 xl:px-[124px] h-16 flex items-center justify-between gap-4 print:hidden">
        <button
          onClick={requestBack}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-[0.75rem] font-semibold text-ink-600 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-canvas hover:text-ink-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          <ArrowLeft size={14} /> Back to Reports
        </button>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              {dirty && <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-mitigated-600 mr-1">Unsaved changes</span>}
              <button
                onClick={requestCancel}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={saveEdits}
                disabled={!dirty}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-white bg-brand-600 rounded-[8px] hover:bg-brand-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={14} /> Save changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setReviewTab('versions')}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
              >
                <GitBranch size={14} /> Versions
              </button>
              {onManageExceptions && (
                <button
                  onClick={onManageExceptions}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                >
                  <ShieldAlert size={14} /> Case Management
                </button>
              )}
              {editable && (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                >
                  <Pencil size={14} /> Edit
                </button>
              )}
              {onShare && (
                <button
                  onClick={onShare}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                >
                  <Share2 size={14} /> Share
                </button>
              )}
              <button
                onClick={() => setShowDownloadModal(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-[8px] hover:bg-brand-100 hover:border-brand-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
              >
                <Download size={14} /> Download
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reader workspace — outline rail + constrained document column. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pt-3 pb-8 flex items-start gap-8 xl:gap-10">
        <aside className="hidden xl:block w-[252px] shrink-0 sticky top-[72px] self-start max-h-[calc(100vh-96px)] overflow-y-auto pr-1 -mr-1 print:hidden">
          <div className="rounded-[14px] border border-canvas-border bg-canvas-elevated p-3.5">
            <div className="flex items-center gap-2 mb-3 px-1">
              <List size={13} className="text-ink-400" />
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-ink-400">On this page</span>
              <span className="ml-auto text-[0.6875rem] font-semibold tabular-nums text-ink-400">{outlineEntries.length}</span>
            </div>
            <ol className="list-none p-0 m-0 space-y-0.5">
              {outlineEntries.map((e, i) => {
                const isActive = activeSectionId === e.id;
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => scrollToSection(e.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className={`w-full flex items-center gap-1.5 py-2 pl-1 pr-1 rounded-[8px] text-left transition-colors cursor-pointer ${isActive ? 'bg-brand-50' : 'hover:bg-brand-50/30'}`}
                    >
                      <span className={`shrink-0 w-5 text-[0.6875rem] font-semibold font-mono tabular-nums text-right ${isActive ? 'text-brand-700' : 'text-brand-500'}`}>{String(i + 1).padStart(2, '0')}</span>
                      <span className={`flex-1 min-w-0 text-[0.8125rem] truncate ${isActive ? 'font-semibold text-brand-700' : 'font-medium text-ink-600'}`}>{e.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
        <div className="min-w-0 flex-1 pb-10">
          <AtrDocument
            meta={meta}
            observations={observations}
            insights={insights}
            maxWidthClass="max-w-none"
            editable={editing}
            onMetaChange={m => setDraft(d => ({ ...d, meta: m }))}
            onObservationsChange={o => setDraft(d => ({ ...d, observations: o }))}
            onInsightsChange={i => setDraft(d => ({ ...d, insights: i }))}
          />
        </div>
      </div>

      <AnimatePresence>
        {showDownloadModal && (
          <ReportDownloadModal
            reportName={report.name}
            reportTag={report.tag}
            reportId={meta.reportId?.toUpperCase()}
            generatedBy={report.generatedBy ?? meta.preparedBy ?? '—'}
            generatedAt={report.generatedAt ?? meta.generatedOn ?? ''}
            sections={buildDownloadSections()}
            onExcelExport={() => exportAtrExcel(meta, observations)}
            onClose={() => setShowDownloadModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Review drawer — comments + version history for this saved ATR. */}
      <AnimatePresence>
        {reviewTab && (
          <AtrReviewDrawer
            reportId={report.id}
            reportName={report.name}
            tab={reviewTab}
            onClose={() => setReviewTab(null)}
            onTab={t => setReviewTab(t)}
            initialVersions={loadVersions(report.id, {
              status: report.status === 'final' ? 'final' : 'draft',
              by: report.generatedBy ?? meta.preparedBy ?? 'You',
              at: report.generatedAt ?? meta.generatedOn ?? nowStamp(),
            })}
            me={meta.preparedBy ?? 'You'}
          />
        )}
      </AnimatePresence>

      {/* Discard guard — same full-screen dialog as the upload wizard's close
          guard. Only reachable when there are unsaved edits (dirty). */}
      <ReportDiscardDialog
        open={pendingDiscard !== null}
        title="Discard your changes?"
        body={pendingDiscard === 'leave'
          ? 'Your edits to this ATR haven’t been saved. Leaving now will discard them and return you to the report list.'
          : 'Your edits to this ATR haven’t been saved. Cancelling now will discard them.'}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={confirmDiscard}
        onCancel={() => setPendingDiscard(null)}
      />
    </motion.div>
  );
}
