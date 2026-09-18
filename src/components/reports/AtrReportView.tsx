import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Share2, Download, List, Pencil, Check, X, History, ShieldAlert, CalendarClock, Clock3, Link2, Paperclip, FileSpreadsheet } from 'lucide-react';
import DataPickerModal, { type AttachmentSelection } from '../chat/DataPickerModal';
import AtrDocument from './AtrDocument';
import type { AtrReportData, AtrMeta, AtrObservation, AtrLinkedAnnexure } from './atrTypes';
import type { AtrSectionKey } from './atrSections';
import { computeExecSummary, exportAtrExcel } from './atrTemplate';
import ReportDownloadModal, { type DownloadPreviewSection } from './ReportDownloadModal';
import ReportDiscardDialog from './ReportDiscardDialog';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../shared/Toast';
import AtrReviewDrawer from './AtrReviewDrawer';
import { loadVersions, appendVersion, currentVersion, nowStamp } from './atrReview';
import { loadTimeline, appendEvents, editEvent, annexureLinkedEvent, annexureUnlinkedEvent, replay, splitEvents, atrTimelineKey, fmtEventTime, type AtrTimeline, type TimelineSeed } from './atrTimeline';
import AtrReportSnapshotPanel from './AtrReportSnapshotPanel';
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
export default function AtrReportView({ report, onBack, onShare, onSave, onManageExceptions, renderObservationActions, templates = REPORT_TEMPLATES, onApplyTemplate, onChangeAudience, timelineSeed }: {
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
  onSave?: (data: AtrReportData, opts?: { quiet?: boolean }) => void;
  /** Opens the case-management (Manage Exceptions) view. Absent → button hidden. */
  onManageExceptions?: () => void;
  /** Optional per-observation action slot, rendered in each observation card's
   *  header (e.g. the Manage Exceptions CTA on ATRs generated from an upload).
   *  Receives the 0-based index and the observation as currently rendered. */
  renderObservationActions?: (index: number, obs: AtrObservation) => React.ReactNode;
  /** Report Snapshot seed: who prepared / audits / owns the risk, and whether to
   *  lay down the curated demo history (library ATRs) or start truthfully from
   *  the generated snapshot (user-generated ATRs). */
  timelineSeed?: TimelineSeed;
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
  // ── Report Snapshot ──
  // The report's timeline (atrTimeline.ts) is the source of truth for what the
  // reader shows: the generated baseline plus every recorded action — edits
  // saved here, and case-management actions by the Auditor / Risk Owner, which
  // arrive from the Manage Exceptions tab via localStorage.
  const [timeline, setTimeline] = useState<AtrTimeline>(() => loadTimeline(report.id, report.atrData, {
    generatedAt: report.generatedAt ?? report.atrData.meta.generatedOn,
    preparedBy: report.generatedBy ?? report.atrData.meta.preparedBy,
    ...(timelineSeed ?? {}),
  }));
  const latest = useMemo(() => replay(timeline), [timeline]);
  // `asOf` (ISO) = the moment being viewed; null = latest. The panel toggles
  // independently so the trail can stay open while reading the latest state.
  const [asOf, setAsOf] = useState<string | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const timeTravelling = asOf !== null;
  // Other tabs (Manage Exceptions) append to the same timeline — pick it up live.
  useEffect(() => {
    const key = atrTimelineKey(report.id);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return;
      try { setTimeline(JSON.parse(e.newValue) as AtrTimeline); } catch { /* half-written — keep what we have */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [report.id]);

  // `edits` is the working copy while the user is editing (null otherwise), so
  // the draft the document shows is the latest timeline state until they type —
  // and follows the timeline again the moment they save or discard.
  const [edits, setEdits] = useState<AtrReportData | null>(null);
  const draft = edits ?? latest;
  const setDraft = (u: AtrReportData | ((d: AtrReportData) => AtrReportData)) =>
    setEdits(prev => (typeof u === 'function' ? u(prev ?? latest) : u));
  const dirty = editing && edits !== null && JSON.stringify(edits) !== JSON.stringify(latest);
  // What the document renders: the reconstruction for the chosen moment, else
  // the (possibly being-edited) latest.
  const asOfData = useMemo(() => (asOf ? replay(timeline, asOf) : null), [timeline, asOf]);
  const view = asOfData ?? draft;
  const appliedByObs = useMemo(() => {
    if (!asOf) return null;
    const { applied } = splitEvents(timeline, asOf);
    const m = new Map<number, { n: number; last: string }>();
    applied.forEach(e => { if (e.observationIndex == null) return; const cur = m.get(e.observationIndex); m.set(e.observationIndex, { n: (cur?.n ?? 0) + 1, last: e.ts }); });
    return m;
  }, [timeline, asOf]);
  const openSnapshot = useCallback(() => { setSnapshotOpen(true); if (editing) setEditing(false); }, [editing]);
  const closeSnapshot = () => { setSnapshotOpen(false); setAsOf(null); };

  // ── Annexures per observation ──
  // The link icon on each observation opens the platform's Add-data picker; every
  // chosen file / source becomes a linked annexure on that observation. Links are
  // recorded on the Report Snapshot trail (so they replay) and persisted on the
  // saved report through onSave.
  const [linkingObs, setLinkingObs] = useState<number | null>(null);
  const me = report.generatedBy ?? latest.meta.preparedBy ?? 'You';
  const linkAnnexures = (index: number, selections: AttachmentSelection[]) => {
    const obs = latest.observations[index];
    if (!obs || selections.length === 0) { setLinkingObs(null); return; }
    const now = new Date().toISOString();
    const added: AtrLinkedAnnexure[] = selections.map((sel, i) => ({
      id: `anx-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      name: sel.kind === 'connect-db' ? `${sel.name} (${sel.database})` : sel.name,
      sizeBytes: sel.kind === 'upload' ? sel.sizeBytes : undefined,
      source: sel.kind,
      linkedAt: now,
      linkedBy: me,
    }));
    const next = appendEvents(report.id, [annexureLinkedEvent(index, obs.title, added, me)]);
    if (next) {
      setTimeline(next);
      onSave?.(replay(next), { quiet: true });
    }
    addToast({ type: 'success', message: added.length === 1 ? `“${added[0].name}” linked to ${obs.title}.` : `${added.length} annexures linked to ${obs.title}.` });
    setLinkingObs(null);
  };
  const unlinkAnnexure = (index: number, anx: AtrLinkedAnnexure) => {
    const obs = latest.observations[index];
    if (!obs) return;
    const next = appendEvents(report.id, [annexureUnlinkedEvent(index, obs.title, anx, me)]);
    if (next) {
      setTimeline(next);
      onSave?.(replay(next), { quiet: true });
    }
    addToast({ type: 'success', message: `“${anx.name}” unlinked.` });
  };
  const fmtSize = (n?: number) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
  // `null` = no prompt; otherwise the action the discard would complete.
  const [pendingDiscard, setPendingDiscard] = useState<null | 'leave' | 'cancel'>(null);
  // Review drawer (comments + version history) — `null` = closed.
  const [reviewTab, setReviewTab] = useState<'comments' | 'versions' | null>(null);

  const requestBack = () => { if (dirty) setPendingDiscard('leave'); else onBack(); };
  const requestCancel = () => { if (dirty) setPendingDiscard('cancel'); else setEditing(false); };
  const confirmDiscard = () => {
    const action = pendingDiscard;
    setPendingDiscard(null);
    setEdits(null);
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
      const changes = diffAtr(latest, draft);
      appendVersion(report.id, current, describeEdits(latest, draft), 'draft', draft.meta.preparedBy ?? 'You', changes);
      // …and onto the Report Snapshot trail, as a full snapshot so it replays exactly.
      const next = appendEvents(report.id, [editEvent(draft, draft.meta.preparedBy ?? 'You', changes)]);
      if (next) setTimeline(next);
    }
    onSave?.(draft);
    setEdits(null);
    setEditing(false);
  };

  const { meta, observations, insights } = view;

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
        content: `${ex.totalObservations} observation${ex.totalObservations === 1 ? '' : 's'} carrying ${totalExceptions} exception${totalExceptions === 1 ? '' : 's'} across ${ex.totalActionPlans} action plan${ex.totalActionPlans === 1 ? '' : 's'}${ex.progressPct != null ? `, ${ex.progressPct}% remediated` : ''}.`,
        stats,
      },
      ...observations.map((o, i): DownloadPreviewSection => {
        const apCount = o.actionPlans.length;
        const apRoll = apCount
          ? ` ${apCount} action plan${apCount === 1 ? '' : 's'}: ${o.actionPlans.map(p => p.title || p.text).filter(Boolean).join('; ')}.`
          : '';
        return {
          id: `atr-obs-${i}`,
          kind: 'observation',
          obsId: `OBS-${String(i + 1).padStart(2, '0')}`,
          title: o.title,
          description: `${o.description ?? ''}${apRoll}`.trim() || o.title,
        };
      }),
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
                onClick={() => (snapshotOpen ? closeSnapshot() : openSnapshot())}
                aria-pressed={snapshotOpen}
                title="See the report, and every action taken on it, as of any moment"
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold border rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 ${snapshotOpen ? 'text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100' : 'text-ink-700 bg-canvas-elevated border-canvas-border hover:bg-canvas hover:border-ink-300/70'}`}
              >
                <Clock3 size={14} /> Report Snapshot
              </button>
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
              {editable && !timeTravelling && (
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
          {/* Time-travel banner — the document below is a reconstruction. */}
          {timeTravelling && asOf && (() => {
            const { applied, later } = splitEvents(timeline, asOf);
            return (
              <div role="status" className="mb-4 flex items-center justify-between gap-3 flex-wrap rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-2.5 print:hidden">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center shrink-0"><CalendarClock size={14} aria-hidden="true" /></span>
                  <p className="text-[0.8125rem] text-ink-800 leading-snug">
                    <span className="font-semibold">Report Snapshot</span> · showing the report as it stood on <span className="font-semibold tabular-nums">{fmtEventTime(asOf)}</span>
                    <span className="text-ink-500"> — {applied.length} action{applied.length === 1 ? '' : 's'} applied{later.length ? `, ${later.length} still to come` : ''}. Read-only.</span>
                  </p>
                </div>
                <button onClick={() => setAsOf(null)} className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.75rem] font-semibold text-brand-700 bg-canvas-elevated border border-brand-200 rounded-md hover:bg-brand-100 cursor-pointer transition-colors shrink-0">Back to latest</button>
              </div>
            );
          })()}
          <AtrDocument
            meta={meta}
            observations={observations}
            insights={insights}
            version={atrVersion}
            hiddenSections={hiddenSections}
            onDeleteSection={deleteSection}
            maxWidthClass="max-w-none"
            editable={editing && !timeTravelling}
            onMetaChange={m => setDraft(d => ({ ...d, meta: m }))}
            onObservationsChange={o => setDraft(d => ({ ...d, observations: o }))}
            onInsightsChange={i => setDraft(d => ({ ...d, insights: i }))}
            renderObservationActions={i => {
              const obs = observations[i];
              if (!obs) return null;
              const hit = appliedByObs?.get(i);
              return (
                <span className="inline-flex items-center gap-2 flex-wrap">
                  {!timeTravelling && !editing && (
                    <span className="relative group/anx inline-flex">
                      <button
                        type="button"
                        onClick={() => setLinkingObs(i)}
                        aria-label={`Link annexures to ${obs.title}`}
                        className="relative inline-flex items-center justify-center w-7 h-7 rounded-sm text-brand-700 bg-brand-50 hover:bg-brand-100 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                      >
                        <Link2 size={13} aria-hidden="true" />
                        {!!obs.linkedAnnexures?.length && (
                          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-brand-600 text-white text-[0.5625rem] font-bold tabular-nums flex items-center justify-center ring-2 ring-canvas-elevated">{obs.linkedAnnexures.length}</span>
                        )}
                      </button>
                      {/* Hover message — opens downward, right-aligned, so the
                          card's overflow-hidden header can't clip it. */}
                      <span role="tooltip" className="pointer-events-none absolute top-[calc(100%+6px)] right-0 px-2 py-1 bg-ink-900 text-white text-[0.625rem] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/anx:opacity-100 group-focus-within/anx:opacity-100 transition-opacity z-50">
                        {obs.linkedAnnexures?.length ? `Link more annexures · ${obs.linkedAnnexures.length} linked` : 'Link annexures to this observation'}
                      </span>
                    </span>
                  )}
                  {hit && (
                    <span title={`${hit.n} action${hit.n === 1 ? '' : 's'} on this observation by ${fmtEventTime(hit.last)}`} className="inline-flex items-center gap-1 h-7 px-2 rounded-sm text-[0.6875rem] font-semibold text-brand-700 bg-brand-50">
                      <Clock3 size={12} aria-hidden="true" /> {hit.n} action{hit.n === 1 ? '' : 's'} · {fmtEventTime(hit.last)}
                    </span>
                  )}
                  {!timeTravelling && renderObservationActions?.(i, obs)}
                </span>
              );
            }}
            // Linked-annexure strip at the foot of each observation — the same
            // chips as the Create Report wizard's, with unlink. Linking happens
            // from the link icon in the header, so the strip only shows once
            // something is linked.
            renderObservationFooter={i => {
              const obs = observations[i];
              const list = obs?.linkedAnnexures ?? [];
              if (!obs || list.length === 0) return null;
              return (
                <div className="flex items-center gap-2 flex-wrap px-5 py-2.5 border-t border-canvas-border bg-canvas/40 print:hidden">
                  <span className="inline-flex items-center gap-1.5 text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-400 mr-0.5">
                    <Paperclip size={12} aria-hidden="true" /> Annexures
                  </span>
                  {list.map(a => (
                    <span key={a.id} title={`${a.name}${a.sizeBytes ? ` · ${fmtSize(a.sizeBytes)}` : ''} · linked ${fmtEventTime(a.linkedAt)} by ${a.linkedBy}`} className="inline-flex items-center gap-1 h-6 pl-1.5 pr-0.5 rounded-sm bg-canvas-elevated border border-canvas-border text-[0.71875rem] text-ink-700 max-w-full">
                      <FileSpreadsheet size={11} className="text-compliant-700 shrink-0" aria-hidden="true" />
                      <span className="truncate max-w-[220px]">{a.name}</span>
                      {a.sizeBytes != null && <span className="text-ink-300 tabular-nums text-[0.625rem]">{fmtSize(a.sizeBytes)}</span>}
                      {!timeTravelling && !editing
                        ? <button type="button" onClick={() => unlinkAnnexure(i, a)} className="w-4 h-4 rounded-full hover:bg-risk-50 text-ink-400 hover:text-risk-700 flex items-center justify-center cursor-pointer shrink-0" aria-label={`Unlink ${a.name}`}><X size={10} aria-hidden="true" /></button>
                        : <span className="w-1" />}
                    </span>
                  ))}
                </div>
              );
            }}
            gradient={reportGradient(
              (appliedTemplate as EditableTemplate | null)?.theme,
              (appliedTemplate as EditableTemplate | null)?.brandColor,
            )}
            logo={(appliedTemplate as EditableTemplate | null)?.logoDataUrl}
          />
        </div>
        {snapshotOpen && (
          <AtrReportSnapshotPanel timeline={timeline} asOf={asOf} onChange={setAsOf} onClose={closeSnapshot} />
        )}
      </div>

      {/* Link annexure → the platform's Add-data picker, portalled to the body. */}
      {createPortal(
        <div className="relative z-[80]">
          <DataPickerModal
            open={linkingObs !== null}
            onClose={() => setLinkingObs(null)}
            onConfirm={sel => { if (linkingObs !== null) linkAnnexures(linkingObs, sel); }}
            title="Link annexure"
            confirmLabel="Link"
            defaultTab="upload"
            attachHint={linkingObs !== null ? <>Pick the annexure file(s) to link to <span className="font-medium text-ink-700">{latest.observations[linkingObs]?.title}</span>.</> : undefined}
          />
        </div>,
        document.body,
      )}

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
