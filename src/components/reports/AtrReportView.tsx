import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Share2, Download, List, Pencil, Check, X, History, ShieldAlert } from 'lucide-react';
import AtrDocument from './AtrDocument';
import type { AtrReportData, AtrMeta, AtrObservation } from './atrTypes';
import type { AtrSectionKey } from './atrSections';
import { computeExecSummary, exportAtrExcel } from './atrTemplate';
import ReportDownloadModal, { type DownloadPreviewSection } from './ReportDownloadModal';
import ReportDiscardDialog from './ReportDiscardDialog';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../shared/Toast';
import AtrReviewDrawer from './AtrReviewDrawer';
import { loadVersions, appendVersion, currentVersion, nowStamp } from './atrReview';
import { ApplyTemplateChip, ReportVisibilityChip } from './ReportBarControls';
import { DEFAULT_REPORT_AUDIENCE, type Audience } from '../shared/audience';
import { REPORT_TEMPLATES } from '../../data/mockData';
import { reportGradient, type EditableTemplate } from './reportShared';

// Summarize an edit into a version label by diffing the saved report against the
// working draft — so the version trail reads from what actually changed rather
// than a hand-typed note. The user can still rename any version afterwards.
function describeEdits(prev: AtrReportData, next: AtrReportData): string {
  const areas: string[] = [];
  if (JSON.stringify(prev.meta) !== JSON.stringify(next.meta)) areas.push('report details');
  if (JSON.stringify(prev.observations) !== JSON.stringify(next.observations)) areas.push('observations');
  if (JSON.stringify(prev.insights) !== JSON.stringify(next.insights)) areas.push('insights');
  if (areas.length === 0) return 'Minor revision';
  const list = areas.length === 1 ? areas[0] : `${areas.slice(0, -1).join(', ')} & ${areas[areas.length - 1]}`;
  return `Edited ${list}`;
}

// Editable meta fields → friendly labels for the change log.
const META_LABELS: Partial<Record<keyof AtrMeta, string>> = {
  reportId: 'Report ID', auditTitle: 'Audit title', auditPeriod: 'Audit period',
  preparedBy: 'Prepared by', reviewedBy: 'Reviewed by', generatedOn: 'Generated on',
  auditEntity: 'Audit entity', totalExceptions: 'Total exceptions',
  brandColor: 'Brand colour', logoDataUrl: 'Logo',
};
const clip = (s: unknown, n = 36) => {
  const str = String(s ?? '').replace(/\s+/g, ' ').trim();
  return str.length > n ? `${str.slice(0, n)}…` : str;
};
const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

// Field-level diff within a single observation.
function diffObservation(prev: AtrObservation, next: AtrObservation): string[] {
  const out: string[] = [];
  if (prev.title !== next.title) out.push(`renamed to “${clip(next.title, 28)}”`);
  if ((prev.status ?? '') !== (next.status ?? '')) out.push(`status ${prev.status ?? '—'} → ${next.status ?? '—'}`);
  if ((prev.risk ?? '') !== (next.risk ?? '')) out.push(`risk ${prev.risk ?? '—'} → ${next.risk ?? '—'}`);
  if ((prev.classification ?? '') !== (next.classification ?? '')) out.push(`classification → ${next.classification ?? '—'}`);
  if ((prev.exceptions ?? 0) !== (next.exceptions ?? 0)) out.push(`exceptions ${prev.exceptions ?? 0} → ${next.exceptions ?? 0}`);
  if ((prev.description ?? '') !== (next.description ?? '')) out.push('edited description');
  if (changed(prev.process, next.process) || changed(prev.querySummary, next.querySummary) || changed(prev.riskSummary, next.riskSummary)) out.push('edited details');
  const pa = prev.actionPlans ?? [], na = next.actionPlans ?? [];
  if (na.length > pa.length) out.push(`added ${na.length - pa.length} action plan${na.length - pa.length === 1 ? '' : 's'}`);
  else if (na.length < pa.length) out.push(`removed ${pa.length - na.length} action plan${pa.length - na.length === 1 ? '' : 's'}`);
  else if (changed(pa, na)) out.push('edited action plans');
  return out;
}

// Full diff of two ATR snapshots into a human-readable change log. Observations
// and insights are matched by position, with tail entries read as add/remove.
function diffAtr(prev: AtrReportData, next: AtrReportData): string[] {
  const changes: string[] = [];
  (Object.keys(META_LABELS) as (keyof AtrMeta)[]).forEach(k => {
    if (!changed(prev.meta?.[k], next.meta?.[k])) return;
    if (k === 'logoDataUrl') changes.push(next.meta.logoDataUrl ? 'Updated logo' : 'Removed logo');
    else if (k === 'brandColor') changes.push('Changed brand colour');
    else changes.push(`${META_LABELS[k]}: ${clip(prev.meta?.[k]) || '—'} → ${clip(next.meta?.[k]) || '—'}`);
  });
  const po = prev.observations ?? [], no = next.observations ?? [];
  const commonO = Math.min(po.length, no.length);
  for (let i = 0; i < commonO; i++) {
    const sub = diffObservation(po[i], no[i]);
    if (sub.length) changes.push(`OBS-${String(i + 1).padStart(2, '0')} “${clip(no[i].title, 24)}”: ${sub.join(', ')}`);
  }
  for (let i = commonO; i < no.length; i++) changes.push(`Added observation “${clip(no[i].title, 28)}”`);
  for (let i = commonO; i < po.length; i++) changes.push(`Removed observation “${clip(po[i].title, 28)}”`);
  const pi = prev.insights ?? [], ni = next.insights ?? [];
  const commonI = Math.min(pi.length, ni.length);
  for (let i = 0; i < commonI; i++) {
    if (changed(pi[i], ni[i])) changes.push(`Edited insight “${clip(ni[i].title, 28)}”`);
  }
  for (let i = commonI; i < ni.length; i++) changes.push(`Added insight “${clip(ni[i].title, 28)}”`);
  for (let i = commonI; i < pi.length; i++) changes.push(`Removed insight “${clip(pi[i].title, 28)}”`);
  return changes;
}
// ATR KPI tone → export accent hex (mirrors the on-screen exec-summary tiles).
const ATR_TONE_HEX = { brand: '#6A12CD', ink: '#334155', high: '#C2410C', compliant: '#15803D', mitigated: '#B45309' };

interface AtrReport {
  id: string;
  name: string;
  generatedBy?: string;
  generatedAt?: string;
  tag?: string;
  /** Reports have no draft state — an ATR is issued, or frozen from edits. */
  status?: 'final' | 'frozen';
  atrData: AtrReportData;
  /** Format last applied from the command bar — restored when it reopens. */
  appliedTemplateId?: string;
  shareAudience?: Audience;
}

/** Saved-ATR report page. Renders the generated Action Taken Report inside the
 *  shared reader workspace: plain page-level actions (no header bar), a persistent
 *  scroll-spy outline rail, and a constrained document column. */
export default function AtrReportView({ report, onBack, onShare, onSave, onManageExceptions, templates = REPORT_TEMPLATES, onApplyTemplate, onChangeAudience }: {
  report: AtrReport;
  onBack: () => void;
  onShare?: () => void;
  /** Formats listed in the command bar's Apply Template control. */
  templates?: (typeof REPORT_TEMPLATES[number] | EditableTemplate)[];
  /** Persist the applied format on the ATR so it survives a reopen. */
  onApplyTemplate?: (reportId: string, templateId: string) => void;
  /** Persist who can open this ATR. */
  onChangeAudience?: (reportId: string, audience: Audience) => void;
  /** Persist inline edits to the saved ATR. Absent → the report is read-only. */
  onSave?: (data: AtrReportData) => void;
  /** Opens the case-management (Manage Exceptions) view. Absent → button hidden. */
  onManageExceptions?: () => void;
}) {
  // Inline editing — a working draft over the saved report. `dirty` drives the
  // discard guard so leaving (or cancelling) only prompts when edits are unsaved.
  const editable = !!onSave;
  const [editing, setEditing] = useState(false);
  // The format and the audience are saved properties of the ATR, the same two
  // the standard reader carries, so an ATR opens on what was last chosen.
  const [appliedTemplate, setAppliedTemplate] = useState<(typeof REPORT_TEMPLATES[number] | EditableTemplate) | null>(
    () => (report.appliedTemplateId ? templates.find(t => t.id === report.appliedTemplateId) ?? null : null),
  );
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [audience, setAudience] = useState<Audience>(report.shareAudience ?? DEFAULT_REPORT_AUDIENCE);
  const { addToast } = useToast();
  const handleApplyTemplate = (t: typeof REPORT_TEMPLATES[number] | EditableTemplate) => {
    setApplyingTemplate(true);
    window.setTimeout(() => {
      setAppliedTemplate(t);
      setApplyingTemplate(false);
      onApplyTemplate?.(report.id, t.id);
      addToast({ type: 'success', message: `Format "${t.name}" applied.` });
    }, 700);
  };
  const handleAudienceChange = (next: Audience) => {
    setAudience(next);
    onChangeAudience?.(report.id, next);
    addToast({ type: 'success', message: `Who can open this: ${next}` });
  };
  // Save runs only after the user confirms.
  const [confirmingSave, setConfirmingSave] = useState(false);
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
  const saveEdits = () => {
    // Capture a version from this edit before persisting, so every saved change
    // grows the version trail automatically (no separate "finalize" step).
    if (dirty) {
      const current = loadVersions(report.id, {
        status: report.status ?? 'final',
        by: report.generatedBy ?? draft.meta.preparedBy ?? 'You',
        at: report.generatedAt ?? draft.meta.generatedOn ?? nowStamp(),
        reviewedBy: draft.meta.reviewedBy,
        observations: draft.observations.map(o => o.title),
      });
      appendVersion(report.id, current, describeEdits(report.atrData, draft), 'draft', draft.meta.preparedBy ?? 'You', diffAtr(report.atrData, draft));
    }
    onSave?.(draft);
    setEditing(false);
  };

  const { meta, observations, insights } = draft;

  // Current version number for the banner byline — reads the same trail the
  // review drawer shows. Re-reads each render, so it updates after a save.
  const atrVersion = currentVersion(report.id, {
    status: report.status === 'final' ? 'final' : 'draft',
    by: report.generatedBy ?? meta.preparedBy ?? 'You',
    at: report.generatedAt ?? meta.generatedOn ?? '',
    reviewedBy: meta.reviewedBy,
    observations: observations.map(o => o.title),
  });

  // Sections removed during editing — persisted on meta so the rail + document
  // stay in sync and the choice survives save.
  const hiddenSections = (meta.hiddenSections ?? []) as AtrSectionKey[];
  const deleteSection = (key: AtrSectionKey) =>
    setDraft(d => ({ ...d, meta: { ...d.meta, hiddenSections: [...(d.meta.hiddenSections ?? []), key] } }));

  // The rail mirrors the visible sections in order (hidden ones drop out).
  const outlineEntries = [
    { key: 'summary' as AtrSectionKey, id: 'atr-exec', title: 'Executive Summary' },
    { key: 'process' as AtrSectionKey, id: 'atr-obs-summary', title: 'Observation Wise Summary' },
    { key: 'details' as AtrSectionKey, id: 'atr-obs-details', title: 'Observation Details' },
    ...(insights.length > 0 ? [{ key: 'insights' as AtrSectionKey, id: 'atr-insights', title: 'Key Insights & Recommendations' }] : []),
    { key: 'signoff' as AtrSectionKey, id: 'atr-signoff', title: 'Approvals & Sign-Off' },
  ].filter(e => !hiddenSections.includes(e.key));

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
          className="inline-flex items-center gap-1.5 h-9 px-3 text-[0.75rem] font-semibold text-ink-600 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:text-ink-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          <ArrowLeft size={14} /> Back to Reports
        </button>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              {dirty && <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-mitigated-600 mr-1">Unsaved changes</span>}
              <button
                onClick={requestCancel}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={() => setConfirmingSave(true)}
                disabled={!dirty}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-white bg-brand-600 rounded-md hover:bg-brand-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={14} /> Save changes
              </button>
            </>
          ) : (
            <>
              {/* The same format and visibility controls every other open
                  report carries. */}
              <ApplyTemplateChip
                templates={templates as typeof REPORT_TEMPLATES[number][]}
                activeId={appliedTemplate?.id ?? null}
                activeName={appliedTemplate?.name ?? null}
                onSelect={handleApplyTemplate}
                busy={applyingTemplate}
              />
              <ReportVisibilityChip audience={audience} onChange={handleAudienceChange} disabled={!onChangeAudience} />
              <button
                onClick={() => setReviewTab('comments')}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
              >
                <History size={14} /> Activity
              </button>
              {onManageExceptions && (
                <button
                  onClick={onManageExceptions}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                >
                  <ShieldAlert size={14} /> Case Management
                </button>
              )}
              {editable && (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                >
                  <Pencil size={14} /> Edit
                </button>
              )}
              {onShare && (
                <button
                  onClick={onShare}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                >
                  <Share2 size={14} /> Share
                </button>
              )}
              <button
                onClick={() => setShowDownloadModal(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100 hover:border-brand-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
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
          <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-3.5">
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
                      className={`w-full flex items-center gap-1.5 py-2 pl-1 pr-1 rounded-md text-left transition-colors cursor-pointer ${isActive ? 'bg-brand-50' : 'hover:bg-brand-50/30'}`}
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
            version={atrVersion}
            hiddenSections={hiddenSections}
            onDeleteSection={deleteSection}
            maxWidthClass="max-w-none"
            editable={editing}
            onMetaChange={m => setDraft(d => ({ ...d, meta: m }))}
            onObservationsChange={o => setDraft(d => ({ ...d, observations: o }))}
            onInsightsChange={i => setDraft(d => ({ ...d, insights: i }))}
            gradient={reportGradient(
              (appliedTemplate as EditableTemplate | null)?.theme,
              (appliedTemplate as EditableTemplate | null)?.brandColor,
            )}
            logo={(appliedTemplate as EditableTemplate | null)?.logoDataUrl}
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
              status: report.status ?? 'final',
              by: report.generatedBy ?? meta.preparedBy ?? 'You',
              at: report.generatedAt ?? meta.generatedOn ?? nowStamp(),
              reviewedBy: meta.reviewedBy,
              observations: observations.map(o => o.title),
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

      {/* Save guard — confirm before persisting edits (captures a new version). */}
      <ConfirmationModal
        open={confirmingSave}
        title="Save changes?"
        description="Your edits will be saved to this ATR and captured as a new version."
        confirmLabel="Save changes"
        cancelLabel="Keep editing"
        tone="primary"
        onConfirm={() => { setConfirmingSave(false); saveEdits(); }}
        onClose={() => setConfirmingSave(false)}
      />
    </motion.div>
  );
}
