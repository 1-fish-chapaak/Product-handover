import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import FloatingLines from '../shared/FloatingLines';
import ListToolbar, { ToolbarViewToggle } from '../shared/ListToolbar';
import ColumnFilter from '../shared/ColumnFilter';
import ReportCard from '../shared/ReportCard';
import { BTN_CTA_PRIMARY } from '../admin/adminTokens';
import InfiniteCardGrid from '../shared/InfiniteCardGrid';
import {
  FileText, Shield, AlertTriangle, Download, Share2, ArrowRight, ArrowLeft,
  X, Edit3, BookOpen, Trash2, Plus, Search, Layers, Check,
  WifiOff, FileCheck2, FolderArchive, CloudUpload,
} from 'lucide-react';
import EmptyState from '../shared/EmptyState';
import { SkeletonRow } from '../shared/Skeleton';
import UploadReportModal from './UploadReportModal';
import ConfirmDialog from './ConfirmDialog';
import AtrReportView from './AtrReportView';
import AtrUploadTab from './atr-upload/AtrUploadTab';
import { consumeAtrResume, clearAtrDraft } from './atrDraft';
import type { AtrMeta, AtrObservation, AtrInsight, AtrReportData } from './atrTypes';
import { REPORT_TEMPLATES, GENERATED_REPORTS, SHARED_REPORTS, GENERATED_REPORTS_KEY } from '../../data/mockData';
import { ATR_LIBRARY, EVIDENCE_LIBRARY, type AtrLibraryReport } from '../../data/atrLibrary';
import { exportAtrWord } from './atrTemplate';
import { type Tone } from '../shared/StatusBadge';
import { ReportPill } from './ReportPill';
import { reportDisplayName } from './reportName';
import { TemplateEditor } from './TemplateEditor';
import {
  ICON_MAP, CATEGORY_COLORS, BLANK_TEMPLATE, mergeTemplateOptions,
  templateKind, reportKind, startReportDownload,
  type EditableTemplate, type GeneratedReport,
} from './reportShared';
import SmartTable from '../shared/SmartTable';
import { useToast } from '../shared/Toast';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import { useCan } from '../../context/CurrentUserContext';
import { BulkAuditVariantView } from './BulkAuditVariants';
import GenerateReportWizard, { type WizardCreatePayload } from './GenerateReportWizard';
import { defForKey, DEMO_REPORT_QUERY_KEYS, type GeneratedQueryDef, type PickableQuery } from './templateQueryPool';
import ReportView from './ReportView';
// CUSTOM_TEMPLATES now lives in the shared keystone; re-exported so existing
// importers (App.tsx) keep working.
export { CUSTOM_TEMPLATES } from './reportShared';



// Observation attachment type + helpers live in AddObservationModal.











interface ReportsViewProps {
  onOpenBuilder?: () => void;
  onShare?: (id: string) => void;
  /** Opens Manage Exceptions. Pass a report id to make its Back return there. */
  onManageExceptions?: (returnReportId?: string) => void;
  onOpenQuery?: (query: { id: string; title: string }) => void;
  customTemplates?: typeof REPORT_TEMPLATES[number][];
  onAddCustomTemplate?: (template: typeof REPORT_TEMPLATES[number]) => void;
  onRemoveCustomTemplate?: (id: string) => void;
  onUpdateCustomTemplate?: (template: typeof REPORT_TEMPLATES[number]) => void;
  /** When set, ReportsView opens that report in the full detail view. Cleared by the parent after consumption. */
  focusReportId?: string | null;
  onFocusReportConsumed?: () => void;
  /** SOX reports are produced from a SOX/ICFR engagement, not generated here —
   *  this routes the user to that area when they pick the SOX template. */
  onOpenSox?: () => void;
}


// ─── Query Card Component ───


// Branded placeholder shown for a beat while a clicked report "opens". Mirrors
// the reader layout (top bar · outline rail · gradient banner · KPI row ·
// section cards) so the real reader resolves into the same shape rather than
// hard-cutting in. Uses the app's standard `animate-pulse` skeleton language.
function ReportOpenSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="h-full overflow-hidden bg-canvas"
      aria-busy="true"
      aria-label="Opening report"
    >
      {/* Top bar — real Back button so the user is never trapped */}
      <div className="sticky top-0 z-30 bg-canvas px-6 lg:px-12 xl:px-[124px] h-16 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 h-9 px-3 text-[0.75rem] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to reports
        </button>
        <div className="flex items-center gap-2">
          <div className="skeleton-cool h-9 w-9 rounded-[8px]" />
          <div className="skeleton-cool h-9 w-24 rounded-[8px]" />
        </div>
      </div>

      <div className="px-6 lg:px-12 xl:px-[124px] pt-3 pb-8 flex items-start gap-8 xl:gap-10">
        {/* Outline rail */}
        <aside className="hidden xl:block w-[252px] shrink-0">
          <div className="rounded-[14px] border border-canvas-border bg-canvas-elevated p-3.5 space-y-2">
            <div className="skeleton-cool h-3 w-24 rounded mb-3" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-cool h-7 rounded-[8px]" style={{ '--sk-delay': `${i * 90}ms` } as React.CSSProperties} />
            ))}
          </div>
        </aside>

        {/* Document column */}
        <div className="min-w-0 flex-1">
          {/* Gradient banner — keeps the report's identity while it loads */}
          <div
            className="relative overflow-hidden rounded-[12px] mb-5 px-9 pt-9 pb-8"
            style={{ backgroundImage: 'linear-gradient(125deg, #3b0b72 0%, #6a12cd 62%, #6a12cd 100%)' }}
          >
            <div className="skeleton-on-brand h-3 w-28 rounded mb-4" />
            <div className="skeleton-on-brand h-8 w-2/3 max-w-[440px] rounded mb-3" />
            <div className="skeleton-on-brand h-3.5 w-1/2 max-w-[360px] rounded mb-7" />
            <div className="skeleton-on-brand h-3.5 w-44 rounded" />
          </div>

          {/* KPI bar — matches the live unified divided stat-bar */}
          <div className="overflow-hidden rounded-[14px] border border-canvas-border bg-canvas-elevated mb-5">
            <div className="-mt-px -ml-px grid grid-cols-2 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border-l border-t border-canvas-border px-5 py-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="skeleton-cool h-2.5 w-20 rounded mt-0.5" style={{ '--sk-delay': `${i * 70}ms` } as React.CSSProperties} />
                    <div className="skeleton-cool h-4 w-4 rounded" style={{ '--sk-delay': `${i * 70}ms` } as React.CSSProperties} />
                  </div>
                  <div className="skeleton-cool h-9 w-16 rounded mt-4" style={{ '--sk-delay': `${i * 70 + 40}ms` } as React.CSSProperties} />
                </div>
              ))}
            </div>
          </div>

          {/* Section cards */}
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-[12px] border border-canvas-border bg-white px-9 py-7">
                <div className="flex items-center gap-2.5 mb-6">
                  <div className="skeleton-cool h-4 w-10 rounded" />
                  <div className="skeleton-cool h-4 w-28 rounded" />
                </div>
                <div className="skeleton-cool h-6 w-2/3 rounded mb-7" />
                <div className="space-y-2.5 max-w-[80ch]">
                  <div className="skeleton-cool h-3.5 w-full rounded" />
                  <div className="skeleton-cool h-3.5 w-[94%] rounded" />
                  <div className="skeleton-cool h-3.5 w-[80%] rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Reports View ───
export default function ReportsView({
  onShare,
  onManageExceptions,
  onOpenQuery,
  customTemplates: customTemplatesProp,
  onAddCustomTemplate,
  onRemoveCustomTemplate,
  onUpdateCustomTemplate,
  focusReportId,
  onFocusReportConsumed,
  onOpenSox,
}: ReportsViewProps = {}) {
  const { addToast, updateToast } = useToast();
  const { openShare } = useShare();
  const { can } = useCan();
  const [activeTab, setActiveTab] = useState<'templates' | 'my-reports' | 'shared-reports'>(() => {
    if (typeof window === 'undefined') return 'my-reports';
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'shared-reports' || t === 'templates' || t === 'my-reports') return t;
    // Legacy deep-links to the old top-level ATR / Evidence tabs land in My Reports.
    if (t === 'atr-reports' || t === 'evidence') return 'my-reports';
    return 'my-reports';
  });
  // Segmented sub-tabs inside My Reports: the 3 report types + the evidence repository.
  const [reportType, setReportType] = useState<'all' | 'atr' | 'sox' | 'ia' | 'evidence'>(() => {
    if (typeof window === 'undefined') return 'all';
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'evidence') return 'evidence';
    if (t === 'atr-reports') return 'atr';
    return 'all';
  });
  // View mode (list/grid) persists across refresh so a chosen card view sticks.
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    return localStorage.getItem('irame.reports.viewMode') === 'grid' ? 'grid' : 'list';
  });
  useEffect(() => {
    try { localStorage.setItem('irame.reports.viewMode', viewMode); } catch { /* ignore */ }
  }, [viewMode]);
  const [allSearch, setAllSearch] = useState('');
  // Type filter for the All feed — a framework (SOX / IA / ATR / Evidence) or the
  // cross-cutting Bulk Audit engagement style.
  const [allTypeFilter, setAllTypeFilter] = useState<string[]>([]);
  const [atrUploadOpen, setAtrUploadOpen] = useState(false);
  // True while the wizard's close-confirm is up — hides this host backdrop so the
  // confirm's own full-screen scrim is the only dim (no double-dim / vignette).
  const [atrConfirmOpen, setAtrConfirmOpen] = useState(false);
  // Returning from "Manage exceptions first": the Manage-Exceptions view sets the
  // resume flag via its "Return to ATR & generate" button. On landing back here we
  // reopen the upload wizard, which resumes its persisted ATR-Preview stage, and
  // clear the parked draft so the banner doesn't linger on a later visit.
  useEffect(() => {
    if (!consumeAtrResume()) return;
    const hasSession = (() => {
      try {
        const raw = localStorage.getItem('irame.atr-upload.v1');
        return raw ? !!JSON.parse(raw)?.session : false;
      } catch { return false; }
    })();
    if (hasSession) { setAtrUploadOpen(true); clearAtrDraft(); }
  }, []);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [gridSearch, setGridSearch] = useState('');
  const [sharedGridSearch, setSharedGridSearch] = useState('');
  // Type filter for Shared Reports — same Type taxonomy as the All feed.
  const [sharedTypeFilter, setSharedTypeFilter] = useState<string[]>([]);
  const [viewingReport, setViewingReport] = useState<GeneratedReport | null>(null);
  // Brief skeleton "open" state when a report is clicked from the list/grid, so
  // the reader doesn't hard-cut in. Shows a branded report skeleton for ~600ms,
  // then mounts the real reader (which streams its own content in).
  const [openingReport, setOpeningReport] = useState(false);
  const openReportTimer = useRef<number | null>(null);
  const openReport = useCallback((report: GeneratedReport) => {
    if (openReportTimer.current) window.clearTimeout(openReportTimer.current);
    setViewingReport(report);
    setOpeningReport(true);
    openReportTimer.current = window.setTimeout(() => setOpeningReport(false), 600);
  }, []);
  useEffect(() => () => { if (openReportTimer.current) window.clearTimeout(openReportTimer.current); }, []);
  // ATR template "Generate" opens the Generate-ATR-from-Observations wizard.
  const [atrWizardOpen, setAtrWizardOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<{ id: string; name: string } | null>(null);
  // Multi-select for the My Reports list — checkbox-on-tile + floating bulk bar,
  // mirroring the Knowledge Hub data-source selection pattern.
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const isSelectingReports = selectedReportIds.size > 0;
  const toggleReportSelect = (id: string) => setSelectedReportIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearReportSelection = () => setSelectedReportIds(new Set());
  // Drop any selection when the user leaves the current report list.
  useEffect(() => { setSelectedReportIds(new Set()); }, [reportType, activeTab, viewMode]);
  const [editingTemplate, setEditingTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(null);
  const CUSTOM_TEMPLATES_KEY = 'irame.reports.customTemplates.v1';
  // Fallback store, used only when no customTemplates prop is supplied. In the
  // app, App.tsx owns the canonical list, so this branch stays empty to avoid
  // two sources of truth.
  const [customTemplatesLocal, setCustomTemplatesLocal] = useState<EditableTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as EditableTemplate[];
      }
    } catch { /* unreadable blob — start empty */ }
    return [];
  });
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(customTemplatesLocal));
    } catch { /* quota/private mode — customs stay session-only */ }
  }, [customTemplatesLocal]);
  const customTemplates = customTemplatesProp ?? customTemplatesLocal;
  const addCustomTemplate = (t: EditableTemplate) => {
    if (onAddCustomTemplate) onAddCustomTemplate(t);
    else setCustomTemplatesLocal(prev => [t, ...prev]);
  };
  const removeCustomTemplate = (id: string) => {
    if (onRemoveCustomTemplate) onRemoveCustomTemplate(id);
    else setCustomTemplatesLocal(prev => prev.filter(t => t.id !== id));
  };
  const updateCustomTemplate = (t: EditableTemplate) => {
    if (onUpdateCustomTemplate) onUpdateCustomTemplate(t as typeof REPORT_TEMPLATES[number]);
    else setCustomTemplatesLocal(prev => prev.map(x => x.id === t.id ? t : x));
  };
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  // Templates tab: Standard and Custom galleries render together on one page.
  // Grid/list is the section-wide `viewMode` (shared with My Reports / Shared),
  // so the view preference and its `list` default stay consistent across tabs.
  const [templateSearch, setTemplateSearch] = useState('');

  // Save with collision-proof naming — upload + save-as-template flows suffix
  // "(2)", "(3)"… instead of erroring like the editor's copy flow does.
  const addCustomTemplateUnique = (t: EditableTemplate) => {
    const names = [...REPORT_TEMPLATES.map(x => x.name), ...customTemplates.map(x => x.name)];
    let name = t.name;
    let i = 2;
    while (names.some(n => n.toLowerCase() === name.toLowerCase())) name = `${t.name} (${i++})`;
    addCustomTemplate({ ...t, name });
    addToast({ type: 'success', message: `Template "${name}" saved to Custom templates.` });
  };
  const [hydrationFailed, setHydrationFailed] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>(() => {
    try {
      const raw = localStorage.getItem(GENERATED_REPORTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return (parsed as GeneratedReport[]).filter(r => !(r as { isEmpty?: boolean }).isEmpty);
      }
    } catch {
      // Defer to an effect so the toast call can happen after mount.
      setTimeout(() => setHydrationFailed(true), 0);
    }
    return [...GENERATED_REPORTS];
  });
  // Brief hydration flag — `true` for the first render only so list views can
  // show skeletons while the persisted blob is read. Flips after first paint.
  const [isHydrating, setIsHydrating] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setIsHydrating(false), 120);
    return () => window.clearTimeout(id);
  }, []);
  // Surface the rare read failure once.
  useEffect(() => {
    if (hydrationFailed) {
      addToast({
        type: 'error',
        message: "Couldn't load your saved reports — starting from defaults.",
      });
    }
  }, [hydrationFailed, addToast]);
  // Persist on change. If the write fails (quota, private mode), tell the
  // user once per session rather than swallowing it silently.
  const persistFailedOnceRef = useRef(false);
  useEffect(() => {
    try {
      localStorage.setItem(GENERATED_REPORTS_KEY, JSON.stringify(generatedReports));
    } catch {
      if (persistFailedOnceRef.current) return;
      persistFailedOnceRef.current = true;
      addToast({
        type: 'error',
        message: "Couldn't save your work locally — your browser storage may be full.",
      });
    }
  }, [generatedReports, addToast]);

  // Report-type counts for the My Reports filter band (only reports I generated).
  const typeCounts = useMemo(() => {
    let sox = 0, ia = 0;
    generatedReports.forEach(r => {
      if (r.generatedBy !== 'You') return;
      const k = reportKind(r);
      if (k === 'sox') sox++;
      else if (k === 'ia') ia++;
    });
    return { sox, ia };
  }, [generatedReports]);

  // ── ATR library: the curated mock ATRs plus any the user generated (have atrData). ──
  const allAtrs = useMemo<AtrLibraryReport[]>(() => {
    const generated = generatedReports
      .filter(r => r.atrData)
      .map((r): AtrLibraryReport => ({
        id: r.id,
        templateId: r.templateId ?? 'rt-007',
        name: r.name,
        tag: 'Internal Audit',
        generatedBy: r.generatedBy,
        generatedAt: r.generatedAt,
        status: r.status === 'final' ? 'final' : 'draft',
        pages: r.pages ?? 1,
        queries: r.queries ?? 0,
        area: r.atrData!.meta.auditTitle ?? 'Custom ATR',
        riskOwner: r.riskOwner,
        sourceReport: r.sourceReport ?? r.name,
        atrData: r.atrData!,
      }));
    // A generated card with a curated-library id is an edited override of it —
    // keep the edited one, drop the original so the list shows no duplicates.
    const generatedIds = new Set(generated.map(g => g.id));
    return [...generated, ...ATR_LIBRARY.filter(l => !generatedIds.has(l.id))];
  }, [generatedReports]);
  // Per-type counts for the My Reports sub-tab badges (ATR uses allAtrs).
  const openAtr = useCallback((atr: AtrLibraryReport) => {
    setViewingReport(atr as unknown as GeneratedReport);
  }, []);
  const openAtrById = useCallback((id: string) => {
    const atr = allAtrs.find(a => a.id === id);
    if (atr) setViewingReport(atr as unknown as GeneratedReport);
    else addToast({ type: 'info', message: 'Source report is not in your library.' });
  }, [allAtrs, addToast]);

  // ── Unified "All" feed ──────────────────────────────────────────────────
  // The All chip merges every artefact across the four types into one list:
  // IA + SOX generated reports, ATRs (allAtrs), and Evidence files. Each row
  // is normalised to a common shape carrying its own open/download/share
  // closures so a single SmartTable can route a click to the right action.
  type UnifiedKind = 'ia' | 'sox' | 'atr' | 'evidence';
  type UnifiedRow = {
    id: string;
    kind: UnifiedKind;
    name: string;
    /** Bulk Audit engagement style — the meaningful "type" axis within a framework. */
    bulk: boolean;
    description: string;
    pills: string[];
    status: 'draft' | 'final';
    date: string;
    sortDate: number;
    open: () => void;
    download?: () => void;
    shareId?: string;
    del?: () => void;
  };
  // Card content derived once so the All feed and the per-type tabs render the
  // same description + chips for any given item.
  const reportDesc = (r: GeneratedReport) =>
    r.description || r.execSummary || `Generated by ${r.generatedBy} on ${r.generatedAt}.`;
  const reportPills = (r: GeneratedReport) =>
    // Pure meta only. Bulk Audit is shown as its own Type pill, not a meta chip.
    [`${r.queries ?? 0} ${Number(r.queries) === 1 ? 'query' : 'queries'}`,
      r.pages ? `${r.pages} pages` : null].filter(Boolean) as string[];
  const atrDesc = (a: AtrLibraryReport) => `${a.atrData.meta.auditEntity} — ${a.atrData.meta.auditPeriod}`;
  const atrPills = (a: AtrLibraryReport) => {
    const plans = a.atrData.observations.reduce((n, o) => n + o.actionPlans.length, 0);
    return [a.status === 'final' ? 'Final' : 'Draft', `${a.atrData.observations.length} observations`, `${plans} action plans`];
  };
  const allReportsUnified = useMemo<UnifiedRow[]>(() => {
    const ts = (d?: string) => { const t = d ? Date.parse(d) : NaN; return Number.isNaN(t) ? 0 : t; };
    const rows: UnifiedRow[] = [];
    // IA + SOX live reports (ATR-kind reports are surfaced via allAtrs below).
    generatedReports.forEach(r => {
      if (r.generatedBy !== 'You') return;
      const k = reportKind(r);
      if (k !== 'sox' && k !== 'ia') return;
      rows.push({
        id: r.id, kind: k, name: r.name, bulk: r.tag === 'Bulk Audit',
        description: reportDesc(r), pills: reportPills(r),
        status: r.status === 'final' ? 'final' : 'draft',
        date: r.generatedAt, sortDate: ts(r.generatedAt),
        open: () => openReport(r),
        download: () => startReportDownload(addToast, updateToast, r.name),
        shareId: r.id,
        del: () => setReportToDelete({ id: r.id, name: r.name }),
      });
    });
    // ATRs.
    allAtrs.forEach(a => {
      rows.push({
        id: a.id, kind: 'atr', name: a.name, bulk: false,
        description: atrDesc(a), pills: atrPills(a),
        status: a.status === 'final' ? 'final' : 'draft',
        date: a.generatedAt, sortDate: ts(a.generatedAt),
        open: () => openAtr(a),
        download: () => { exportAtrWord(a.atrData.meta, a.atrData.observations); addToast({ type: 'success', message: `Downloading “${a.name}”.` }); },
        shareId: a.id,
      });
    });
    // Evidence files — folded into the unified feed so they're listed and
    // filterable by the "Evidence" Type option. Clicking a row opens the file
    // itself (it's a document, not a report) — not the source ATR, which read as
    // confusing in the all-reports list.
    EVIDENCE_LIBRARY.forEach(ev => {
      const openFile = () => addToast({ type: 'success', message: `Opening “${ev.name}”…` });
      rows.push({
        id: ev.id, kind: 'evidence', name: ev.name, bulk: false,
        description: `${ev.area} · linked to ${ev.atrName}`,
        pills: [ev.type, ev.size],
        status: 'final',
        date: ev.uploadedAt, sortDate: ts(ev.uploadedAt),
        open: openFile,
        download: () => addToast({ type: 'success', message: `Downloading “${ev.name}”.` }),
        shareId: ev.id,
      });
    });
    return rows.sort((a, b) => b.sortDate - a.sortDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedReports, allAtrs, addToast, updateToast, openAtr, openAtrById]);
  const KIND_FULL_LABEL: Record<UnifiedKind, string> = {
    ia: 'Internal Audit',
    sox: 'SOX Compliance',
    atr: 'Action Taken Report',
    evidence: 'Evidence',
  };
  // Design-system tones (StatusBadge §7.10.4) for the framework Type chips.
  // SOX = Evidence Blue and Internal = brand mirror the canonical FrameworkBadge.
  const KIND_TONE: Record<UnifiedKind, Tone> = {
    ia: 'info',
    sox: 'evidence',
    atr: 'mitigated',
    evidence: 'draft',
  };
  const allReportsFiltered = useMemo(() => {
    const q = allSearch.trim().toLowerCase();
    let rows = allReportsUnified;
    if (allTypeFilter.length) rows = rows.filter(r =>
      allTypeFilter.includes(KIND_FULL_LABEL[r.kind]) || (r.bulk && allTypeFilter.includes('Bulk Audit')));
    // Search matches the report title *and* its type — the placeholder says
    // "Search all reports", so "SOX", "ATR", "internal audit", "bulk" should
    // surface reports of that type even when the word isn't in the title.
    return q ? rows.filter(r =>
      r.name.toLowerCase().includes(q)
      || (KIND_FULL_LABEL[r.kind] ?? '').toLowerCase().includes(q)
      || r.kind.toLowerCase().includes(q)
      || (r.bulk && 'bulk audit'.includes(q))
    ) : rows;
  }, [allReportsUnified, allSearch, allTypeFilter, KIND_FULL_LABEL]);
  // Type-filter options: each framework present in the feed, then the
  // cross-cutting Bulk Audit option, with Evidence pinned last (it's a linked
  // artifact, not a report framework, so it reads as its own trailing group).
  const allTypeOptions = useMemo(() => {
    const kinds = Array.from(new Set(allReportsUnified.map(r => KIND_FULL_LABEL[r.kind])))
      .filter(k => k !== 'Evidence');
    const opts = [...kinds];
    if (allReportsUnified.some(r => r.bulk)) opts.push('Bulk Audit');
    if (allReportsUnified.some(r => r.kind === 'evidence')) opts.push('Evidence');
    return opts;
  }, [allReportsUnified, KIND_FULL_LABEL]);
  const sharedTypeOptions = useMemo(
    () => Array.from(new Set(SHARED_REPORTS.map(r => KIND_FULL_LABEL[(r.kind as UnifiedKind) ?? 'ia']))),
    [KIND_FULL_LABEL],
  );
  const filteredShared = useMemo(() => {
    const q = sharedGridSearch.trim().toLowerCase();
    let rows = SHARED_REPORTS;
    if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.sharedBy.toLowerCase().includes(q) || r.sharedWith.toLowerCase().includes(q));
    if (sharedTypeFilter.length) rows = rows.filter(r => sharedTypeFilter.includes(KIND_FULL_LABEL[(r.kind as UnifiedKind) ?? 'ia']));
    return rows;
  }, [sharedGridSearch, sharedTypeFilter, KIND_FULL_LABEL]);
  // Shared reports are thin records (no baked query content). The tab promises
  // "Open, review, or download", so opening one materialises a representative,
  // type-appropriate set of queries into the read-only reader instead of an
  // empty page. (Bulk-style routing is avoided — shared records carry no runs.)
  const openSharedReport = (r: typeof SHARED_REPORTS[number]) => {
    const kind = (r.kind as UnifiedKind) ?? 'ia';
    const keys = kind === 'sox' ? ['CE01', 'WA01', 'RA01', 'EX01'] : ['Q01', 'Q02', 'RA02', 'CE01'];
    const generatedQueries = keys
      .map(k => defForKey(k))
      .filter((d): d is GeneratedQueryDef => d !== null)
      .slice(0, Math.max(1, Number(r.queries) || 3));
    setViewingReport({
      ...r,
      generatedBy: r.sharedBy,
      generatedAt: r.sharedAt,
      generatedQueries,
    } as unknown as GeneratedReport);
  };
  // Type chip styling per kind — leans on existing semantic tokens.
  const UNIFIED_KIND_META: Record<UnifiedKind, { label: string; icon: React.ElementType; classes: string; iconClass: string }> = {
    ia:       { label: 'Internal Audit', icon: BookOpen,     classes: 'bg-brand-50 text-brand-700',         iconClass: 'text-brand-600' },
    atr:      { label: 'ATR',      icon: FileCheck2,   classes: 'bg-info-50 text-info-700',           iconClass: 'text-info-700' },
    sox:      { label: 'SOX',      icon: Shield,       classes: 'bg-mitigated-50 text-mitigated-700', iconClass: 'text-mitigated-700' },
    evidence: { label: 'Evidence', icon: FolderArchive, classes: 'bg-brand-50/70 text-brand-600',          iconClass: 'text-brand-600' },
  };
  // Full type names for the unified "All" list's Type column (no abbreviations).
  // Report names are unique. `reportNameTaken` checks (case-insensitive) and
  // `uniqueReportName` suffixes a base name ((2), (3)…) until it's free — used
  // by every auto-named creation path; the New-report modal validates instead.
  const reportNameTaken = useCallback(
    (name: string) => generatedReports.some(r => r.name.trim().toLowerCase() === name.trim().toLowerCase()),
    [generatedReports],
  );
  const uniqueReportName = useCallback((base: string) => {
    if (!reportNameTaken(base)) return base;
    let i = 2;
    while (reportNameTaken(`${base} (${i})`)) i++;
    return `${base} (${i})`;
  }, [reportNameTaken]);

  // Save Version (from the Live ATR modal) → snapshot as a brand-new ATR-tab card.
  const saveAtrVersion = useCallback((label: string, data: AtrReportData) => {
    const now = new Date();
    const stamp = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    const base = data.meta.auditTitle ?? 'Action Taken Report';
    const newReport = {
      id: `gr-atr-${now.getTime()}`,
      templateId: 'rt-007',
      kind: 'atr' as const,
      name: uniqueReportName(`${base} — ${label}`),
      tag: 'Internal Audit' as const,
      generatedBy: 'Karan Mehta',
      generatedAt: stamp,
      status: 'final' as const,
      pages: Math.max(1, data.observations.length * 2),
      queries: data.observations.length,
      atrData: data,
      riskOwner: 'Tushar Goel',
      sourceReport: base,
    } as unknown as GeneratedReport;
    setGeneratedReports(prev => [newReport, ...prev]);
    setViewingReport(null);
    setActiveTab('my-reports');
    addToast({ type: 'success', message: `Saved “${label}” to My Reports.` });
  }, [addToast, uniqueReportName]);

  // Save Version from the Generate-by-upload wizard → upsert a card in My
  // Reports keyed by the wizard session id (re-saving updates the same card).
  const saveUploadedAtr = useCallback((sessionId: string, label: string | undefined, data: AtrReportData): string => {
    const now = new Date();
    const stamp = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    const base = data.meta.auditTitle ?? 'Action Taken Report';
    const id = `gr-atr-upload-${sessionId}`;
    // Build the card synchronously (re-using the existing name on re-save) so we
    // have it in hand to open — don't rely on the setState updater running now.
    // The version counter lives on the saved card, so re-saving increments it
    // (v1 → v2 → …) even though the wizard unmounts on each save.
    const existing = generatedReports.find(r => r.id === id);
    const nextVersion = (existing?.atrVersion ?? 0) + 1;
    const versionNumber = `v${nextVersion}`;
    const card = {
      id,
      templateId: 'rt-007',
      kind: 'atr' as const,
      name: existing?.name ?? uniqueReportName(label ? `${base} — ${label}` : base),
      tag: 'Internal Audit' as const,
      generatedBy: 'You',
      generatedAt: stamp,
      status: 'draft' as const,
      pages: Math.max(1, data.observations.length * 2),
      queries: data.observations.length,
      atrData: data,
      atrVersion: nextVersion,
      riskOwner: 'Tushar Goel',
      sourceReport: base,
    } as unknown as GeneratedReport;
    setGeneratedReports(prev =>
      prev.some(r => r.id === id) ? prev.map(r => (r.id === id ? card : r)) : [card, ...prev],
    );
    // Saving just opens the saved ATR — close the wizard and land full-page on
    // the report (viewingReport → AtrReportView).
    setAtrUploadOpen(false);
    clearAtrDraft();
    openReport(card);
    return versionNumber;
  }, [generatedReports, uniqueReportName, openReport]);

  // Inline edits saved from the library ATR view. Updating a generated card
  // patches it in place; editing a curated library ATR persists an override card
  // (same id) into the generated store so the change survives a reload.
  const saveAtrEdits = useCallback((id: string, data: AtrReportData) => {
    setGeneratedReports(prev => {
      if (prev.some(r => r.id === id)) return prev.map(r => (r.id === id ? { ...r, atrData: data } : r));
      const lib = ATR_LIBRARY.find(a => a.id === id);
      if (!lib) return prev;
      return [{ ...lib, kind: 'atr', atrData: data } as unknown as GeneratedReport, ...prev];
    });
    // Reflect the save in the open view so the editor's `dirty` flag clears.
    setViewingReport(v => (v && v.id === id ? ({ ...v, atrData: data } as GeneratedReport) : v));
    addToast({ type: 'success', message: 'Changes saved.' });
  }, [addToast]);

  // Offline banner — listens to online/offline events.
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Hot-receive new reports generated by a Bulk Run (BulkRunProgress dispatches
  // this when its run completes). Prepend so it appears at the top of My Reports.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<GeneratedReport>).detail;
      if (!detail || !detail.id) return;
      setGeneratedReports(prev => (prev.some(r => r.id === detail.id) ? prev : [detail, ...prev]));
    };
    window.addEventListener('irame:bulk-report-created', handler);
    return () => window.removeEventListener('irame:bulk-report-created', handler);
  }, []);

  // Toast "Open report" click flows through App.tsx, which sets focusReportId.
  // When it changes, jump into the full-page view of that report.
  const [missingFocusReport, setMissingFocusReport] = useState(false);
  useEffect(() => {
    if (!focusReportId) return;
    const report = generatedReports.find(r => r.id === focusReportId);
    // Fall back to the ATR library so a curated ATR (e.g. returning from Manage
    // Exceptions) re-opens too — those ids aren't in generatedReports.
    const atr = report ? null : allAtrs.find(a => a.id === focusReportId);
    if (report || atr) {
      setActiveTab('my-reports');
      setViewingReport((report ?? atr) as unknown as GeneratedReport);
      setMissingFocusReport(false);
      onFocusReportConsumed?.();
    } else if (generatedReports.length > 0) {
      // Hydration has occurred but the requested id is absent.
      setMissingFocusReport(true);
      onFocusReportConsumed?.();
    }
  }, [focusReportId, generatedReports, allAtrs, onFocusReportConsumed]);

  const updateReportDescription = (reportId: string, description: string) => {
    setGeneratedReports(prev => prev.map(r =>
      r.id === reportId ? { ...r, description } : r
    ));
    setViewingReport(prev =>
      prev && prev.id === reportId ? { ...prev, description } : prev
    );
  };

  // Generate-from-template wizard — non-ATR templates pick queries here.
  const [wizardTemplate, setWizardTemplate] = useState<EditableTemplate | null>(null);
  // The wizard's entire pickable pool, derived from the user's live reports
  // (newest first). Reports carry their own query content via generatedQueries
  // / workflowResults; seeded demo reports without baked content are backfilled
  // from DEMO_REPORT_QUERY_KEYS. ATR reports have no pickable queries.
  const wizardSources = useMemo<PickableQuery[]>(() => {
    return generatedReports.flatMap<PickableQuery>(r => {
      if (r.atrData) return [];
      const rows: PickableQuery[] = [];
      const queryDef = (q: GeneratedQueryDef) => rows.push({
        uid: `${r.id}:q:${q.id}`,
        // Dedupe key = the query's own identity (not report-scoped), so the SAME
        // underlying query appearing in two reports is recognised as one unit.
        // That's what powers the picker's "Selected in <report> — click to swap"
        // affordance: pick the query once, then move the selection between the
        // reports it lives in. Genuinely different queries have different ids, so
        // they stay independently selectable.
        key: q.id,
        label: q.title,
        source: 'report',
        sourceLabel: r.name,
        risk: q.risk,
        severity: (q.severity as 'High' | 'Medium' | 'Low'),
        kind: 'query',
        def: q,
      });
      if (r.generatedQueries?.length) {
        r.generatedQueries.forEach(queryDef);
      } else {
        // Seeded demo report — backfill from its curated rich-content keys.
        (DEMO_REPORT_QUERY_KEYS[r.id] ?? []).forEach(key => {
          const def = defForKey(key);
          if (def) queryDef(def);
        });
      }
      // Failed/skipped runs produce no result block, so they aren't offerable.
      (r.workflowResults ?? []).filter(w => w.runStatus !== 'failed').forEach(w => {
        const n = w.outputTable?.rows.length ?? 0;
        rows.push({
          uid: `${r.id}:wf:${w.workflowId}`,
          key: `wf:${w.workflowId}`,
          label: w.name,
          source: 'report',
          sourceLabel: r.name,
          risk: w.businessProcess ?? 'Workflow',
          severity: w.severity,
          kind: 'workflow',
          workflow: w,
          wfMeta: `${w.workflowId} · ${w.businessProcess ?? '—'} · ${n} flagged ${n === 1 ? 'record' : 'records'}`,
        });
      });
      return rows;
    });
  }, [generatedReports]);
  const createReportFromWizard = (rt: EditableTemplate, payload: WizardCreatePayload) => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const blockCount = payload.queries.length + payload.workflows.length;
    const newReport: GeneratedReport = {
      id: `gr-gen-${Date.now()}`,
      templateId: rt.id,
      kind: templateKind(rt),
      name: uniqueReportName(payload.reportName?.trim() || `${payload.reportPeriod} ${rt.name}`),
      tag: 'Internal Audit',
      generatedBy: 'You',
      generatedAt: today,
      status: 'draft',
      pages: blockCount + 2,
      queries: payload.queries.length,
      generatedQueries: payload.queries,
      workflowResults: payload.workflows.length ? payload.workflows : undefined,
      execSummary: payload.execSummary,
      reportPeriod: payload.reportPeriod,
      templateSections: rt.sections,
      // Carry the template's Customize branding onto the report chrome.
      brand: rt.brand,
      theme: rt.theme,
      headerText: rt.headerText,
      footerText: rt.footerText,
    };
    setGeneratedReports(prev => [newReport, ...prev]);
    setWizardTemplate(null);
    setViewingReport(newReport);
    const parts = [
      payload.queries.length ? `${payload.queries.length} ${payload.queries.length === 1 ? 'query' : 'queries'}` : '',
      payload.workflows.length ? `${payload.workflows.length} ${payload.workflows.length === 1 ? 'workflow' : 'workflows'}` : '',
    ].filter(Boolean);
    addToast({
      type: 'success',
      message: `Report generated from ${parts.join(' and ')}.`,
    });
  };
  const filteredReports = (() => {
    const q = gridSearch.trim().toLowerCase();
    // Only the SOX / IA sub-tabs render this list; scope to my own reports of the active type.
    const byType = generatedReports.filter(r => r.generatedBy === 'You' && reportKind(r) === reportType);
    const byTag = tagFilter.length === 0
      ? byType
      : byType.filter(r => tagFilter.includes(r.tag));
    return q ? byTag.filter(r =>
      r.name.toLowerCase().includes(q) || (r.tag ?? '').toLowerCase().includes(q)
    ) : byTag;
  })();

  const TAG_FILTER_OPTIONS = ['Internal Audit', 'Bulk Audit'];

  const ActionTooltip = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <span className="relative group/tt inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 px-2 py-1 bg-ink-900 text-white text-[0.625rem] font-medium rounded-[8px] whitespace-nowrap opacity-0 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </span>
  );


  // Canonical "Report" name cell shared by every list-view table (All · SOX · IA
  // · Shared) so the lists never drift: brand tile + type icon, 14.5px name with
  // a quiet secondary subline. Hover affordances only when the row is openable.
  const ReportNameCell = ({ icon: Icon, iconClass, name, subline, onClick, selectable, selected, isSelecting, onToggleSelect }: { icon: React.ElementType; iconClass?: string; name: string; subline?: React.ReactNode; onClick?: () => void; selectable?: boolean; selected?: boolean; isSelecting?: boolean; onToggleSelect?: () => void }) => {
    const display = reportDisplayName(name);
    const truncated = display.length > 100 ? display.slice(0, 100) + '…' : display;
    const clickable = Boolean(onClick) || Boolean(selectable);
    // While selecting, a plain row click toggles selection instead of opening.
    const handleClick = () => { if (selectable && isSelecting) onToggleSelect?.(); else onClick?.(); };
    return (
      <div className={`flex items-center gap-3 min-w-0 ${clickable ? 'cursor-pointer' : ''}`} onClick={handleClick}>
        <span className="relative shrink-0 w-9 h-9 flex items-center justify-center">
          {/* Type tile — a soft tone-tinted square so each row carries the same
              type anchor the grid card uses (list↔grid parity). Fades out on
              hover/select so the checkbox sits cleanly on the row bg. */}
          <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center rounded-[9px] transition-opacity duration-150 ${iconClass ?? 'text-ink-400'} ${selectable ? (selected || isSelecting ? 'opacity-0' : 'opacity-100 group-hover:opacity-0') : 'opacity-100'}`}>
            <Icon size={16} strokeWidth={1.75} />
          </span>
          {selectable && (
            <span
              role="checkbox"
              aria-checked={selected}
              aria-label={selected ? `Deselect ${display}` : `Select ${display}`}
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onToggleSelect?.(); } }}
              className={`relative w-4 h-4 rounded-[5px] border flex items-center justify-center transition-opacity duration-150 cursor-pointer ${
                selected
                  ? 'bg-brand-600 border-brand-600 text-white opacity-100'
                  : isSelecting
                    ? 'bg-paper-0 border-ink-300 opacity-100 hover:border-brand-500'
                    : 'bg-paper-0 border-ink-300 opacity-0 group-hover:opacity-100 hover:border-brand-500'
              }`}
            >
              {selected && <Check size={11} strokeWidth={3} />}
            </span>
          )}
        </span>
        <div className="min-w-0">
          <div className="text-[0.875rem] font-semibold tracking-[-0.006em] text-ink-900 truncate" title={display.length > 100 ? display : undefined}>{truncated}</div>
          {subline && <div className="mt-0.5 text-[0.75rem] text-ink-400 truncate">{subline}</div>}
        </div>
      </div>
    );
  };

  // Full, un-abbreviated type label for a list row's Type column.
  // Canonical bordered tone pill (StatusBadge §7.10.4) for every Type/category chip.
  const TYPE_PILL = (label: string, tone: Tone) => <ReportPill tone={tone}>{label}</ReportPill>;
  // Bulk Audit — mitigated bordered chip, distinct from the kind chips
  // (IA=brand/purple, ATR=blue, SOX=amber) so it stands out as the
  // cross-cutting engagement type. Routed through the canonical ReportPill
  // (§7.10.4) rather than a hand-rolled span.
  const BULK_PILL = <ReportPill tone="mitigated">Bulk Audit</ReportPill>;
  // One column-width scheme for every report table (All · SOX/IA · Shared · ATR)
  // so columns line up tab to tab. The Report (name) column has no fixed width,
  // so under SmartTable `fixedLayout` it absorbs the slack — the detail columns
  // and actions stay packed together on the right with no empty gap.
  const COL_W = { type: '180px', status: '128px', queries: '112px', sharedBy: '200px', generated: '150px', actions: '120px' };
  // Muted placeholder for the Type column when a row has no special type.


  if (viewingReport) {
    // Brief branded skeleton while the report "opens", before the real reader
    // mounts. Gives the click immediate feedback instead of a hard cut.
    if (openingReport) {
      return <ReportOpenSkeleton onBack={() => { setOpeningReport(false); setViewingReport(null); }} />;
    }
    // Generated Action Taken Reports render in their dedicated view (the same
    // content shown in the preview, with Manage Exceptions + Generate ATR).
    if (viewingReport.atrData) {
      return (
        <AtrReportView
          report={{ ...viewingReport, atrData: viewingReport.atrData, status: viewingReport.status === 'final' ? 'final' : 'draft' }}
          onBack={() => setViewingReport(null)}
          onShare={onShare ? () => onShare(viewingReport.id) : undefined}
          onSave={data => saveAtrEdits(viewingReport.id, data)}
          onManageExceptions={onManageExceptions ? () => onManageExceptions(viewingReport.id) : undefined}
        />
      );
    }
    // All Bulk Audit reports now render as Editorial (chosen treatment) unless
    // an explicit aestheticVariant overrides it. Internal Audit reports keep
    // the default ReportView.
    if (viewingReport.aestheticVariant || viewingReport.tag === 'Bulk Audit') {
      return (
        <BulkAuditVariantView
          report={{ ...viewingReport, aestheticVariant: viewingReport.aestheticVariant ?? 'editorial' }}
          templates={mergeTemplateOptions(REPORT_TEMPLATES, customTemplates)}
          onBack={() => setViewingReport(null)}
          onShare={onShare ? () => onShare(viewingReport.id) : undefined}
        />
      );
    }
    return (
      <ReportView
        report={viewingReport}
        onBack={() => setViewingReport(null)}
        onShare={onShare ? () => onShare(viewingReport.id) : undefined}
        onManageExceptions={onManageExceptions}
        onOpenQuery={onOpenQuery}
        customTemplates={customTemplates}
        onUpdateDescription={updateReportDescription}
        onSaveAsTemplate={addCustomTemplateUnique}
        onSaveAtrVersion={saveAtrVersion}
      />
    );
  }

  // Ids the active view exposes for multi-select (mirrors each list's
  // ReportNameCell `selectable` rule). Drives the bulk bar's Select all toggle.
  const selectableVisibleIds =
    activeTab === 'shared-reports' ? filteredShared.map(r => String(r.id))
    : activeTab === 'my-reports' ? allReportsFiltered.filter(r => r.del).map(r => String(r.id))
    : [];
  const allVisibleSelected = selectableVisibleIds.length > 0 && selectableVisibleIds.every(id => selectedReportIds.has(id));
  const toggleSelectAll = () => setSelectedReportIds(prev =>
    allVisibleSelected
      ? new Set([...prev].filter(id => !selectableVisibleIds.includes(id)))
      : new Set([...prev, ...selectableVisibleIds]),
  );

  return (
    <div className="reports-focus-noring h-full flex flex-col overflow-hidden bg-white bg-mesh-gradient relative">
      {isOffline && (
        <div
          role="status"
          aria-live="assertive"
          className="bg-mitigated-50 text-mitigated-800 border-y border-mitigated-200 px-4 h-8 flex items-center gap-2 text-[0.75rem] shrink-0"
        >
          <WifiOff size={14} aria-hidden="true" />
          <span>You're offline — recent changes will sync once you reconnect.</span>
        </div>
      )}
      {/* Fixed header strip — the title + main tabs stay pinned; only the
          content region below scrolls, matching the Admin / Knowledge Hub
          recipe (h-full flex-col shell, header shrink-0, content flex-1). */}
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 shrink-0">
        {/* Header + Tabs share a single full-bleed strip — bg-canvas-elevated
            extends past the page's responsive horizontal/top insets via
            matching negative margins so the strip reads as the page's header
            section, separate from the content below. FloatingLines paints
            ambient texture behind the type (Knowledge Hub's recipe). */}
        <div className="bg-canvas-elevated -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-8 pt-8 border-b border-canvas-border relative overflow-hidden">
          {/* Ambient FloatingLines — top + bottom waves only (no middle wave
              where the H1 sits), low opacity so it reads as texture. */}
          <FloatingLines
            enabledWaves={['top', 'bottom']}
            lineCount={3}
            lineDistance={10}
            bendRadius={5}
            bendStrength={-0.3}
            interactive
            parallax
            color="#6a12cd"
            opacity={0.05}
          />
          {/* Header — Inter H1 + tab-aware subhead (no mono eyebrow). */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 min-w-0"
          >
            <h1 className="text-[2.125rem] font-semibold tracking-tight text-ink-900 leading-[1.15]">Reports</h1>
            <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">
              {activeTab === 'shared-reports'
                ? <>Reports your team shared with you. Open, review, or download any of them.</>
                : activeTab === 'templates'
                ? <>Query-driven templates <span className="font-medium text-brand-700">IRA</span> uses to turn engagement data into a finished report.</>
                : <>Every report <span className="font-medium text-brand-700">IRA</span> has generated, grouped by type across ATR, SOX, IA, and evidence.</>}
            </p>
          </motion.div>

          {/* Tabs — Knowledge Hub recipe: pb-3 + font-semibold + motion.div
              underline with layoutId so the active brand bar springs between
              tabs. The strip's border-b serves as the underline track. */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap gap-6 -mb-px">
          {([
            { id: 'my-reports', label: 'My Reports', icon: BookOpen, count: generatedReports.length },
            { id: 'shared-reports', label: 'Shared Reports', icon: Share2, count: SHARED_REPORTS.length },
            { id: 'templates', label: 'Templates', icon: FileText, count: REPORT_TEMPLATES.length + customTemplates.length },
          ] as const).map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); if (tab.id === 'my-reports') setReportType('all'); }}
                className={`pb-3 text-[0.8125rem] font-semibold relative transition-colors cursor-pointer whitespace-nowrap ${
                  isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <TabIcon size={14} />
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="reports-main-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-600 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
          </motion.div>
        </div>
      </div>

      {/* Scrolling content region — the header strip above is fixed; everything
          here scrolls on its own, so pagination sits at the bottom of the list
          (not the page) exactly like the Admin / Knowledge Hub tables. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pb-8 flex-1 min-h-0 overflow-y-auto relative">
        {/* Top inset lives on this inner wrapper, not the scroll container, so a
            pinned column header's sticky `top-0` reaches the true top of the
            scroll region and rows can't leak through padding above it. */}
        <div className="pt-6">
        {missingFocusReport && (
          <div className="pb-6">
            <EmptyState
              icon={AlertTriangle}
              title="Report not found"
              body="It may have been deleted or moved. Return to the reports list."
              action={
                <button
                  onClick={() => setMissingFocusReport(false)}
                  className="inline-flex items-center gap-1.5 h-9 px-4 text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                >
                  <ArrowLeft size={14} /> Back to reports
                </button>
              }
            />
          </div>
        )}

        {/* All — unified feed merging IA + SOX + ATR + Evidence into one list.
            A Type column tags each row; clicking routes to its own open action. */}
        {activeTab === 'my-reports' && reportType === 'all' && (
          <>
          <ListToolbar
            search={allSearch}
            onSearch={setAllSearch}
            searchPlaceholder="Search all reports…"
            trailing={
              <>
                <ColumnFilter
                  variant="button"
                  icon
                  selectIndicator="checkbox"
                  label="Type"
                  options={allTypeOptions}
                  value={allTypeFilter}
                  onChange={setAllTypeFilter}
                  align="end"
                />
                <ToolbarViewToggle mode={viewMode} onChange={setViewMode} />
                <button
                  onClick={() => setAtrUploadOpen(true)}
                  className="inline-flex items-center gap-2 h-10 px-4 text-[13px] font-semibold text-white bg-primary hover:bg-primary-hover rounded-[10px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 whitespace-nowrap"
                >
                  <CloudUpload size={15} /> Generate ATR by Upload
                </button>
              </>
            }
          />
          {viewMode === 'grid' ? (
            allReportsFiltered.length === 0 ? (
              <EmptyState
                icon={Layers}
                title={allSearch || allTypeFilter.length > 0 ? 'No reports match your filters.' : 'No reports yet'}
                body={allSearch || allTypeFilter.length > 0 ? 'Try a different search or type.' : 'Reports, ATRs, and evidence you generate will all appear here.'}
                size="compact"
              />
            ) : (
              <InfiniteCardGrid
                items={allReportsFiltered}
                resetKey={`all-${allTypeFilter}-${allSearch}`}
                renderItem={(row, i) => {
                  const m = UNIFIED_KIND_META[row.kind];
                  return (
                    <ReportCard
                      key={row.id}
                      index={i}
                      icon={m.icon}
                      iconClass={m.classes}
                      eyebrow={m.label}
                      title={reportDisplayName(row.name)}
                      description={row.description}
                      pills={row.bulk ? ['Bulk Audit', ...row.pills] : row.pills}
                      footerRight={<span className="text-[0.6875rem] tabular-nums text-ink-400">{row.date}</span>}
                      onClick={() => row.open()}
                      selectable={Boolean(row.del)}
                      selected={selectedReportIds.has(row.id)}
                      isSelecting={isSelectingReports}
                      onToggleSelect={() => toggleReportSelect(row.id)}
                      actions={<>
                        {row.download && <ActionTooltip label="Download"><button onClick={(e) => { e.stopPropagation(); row.download!(); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button></ActionTooltip>}
                        {row.shareId && can('rp_share') && <ActionTooltip label="Share"><button onClick={(e) => { e.stopPropagation(); openShare({ type: 'report', id: row.shareId!, anchor: rectFromEvent(e) }); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button></ActionTooltip>}
                        {row.del && <ActionTooltip label="Delete"><button onClick={(e) => { e.stopPropagation(); row.del!(); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-risk-200 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer" aria-label="Delete"><Trash2 size={14} /></button></ActionTooltip>}
                      </>}
                    />
                  );
                }}
              />
            )
          ) : (
          <div className="flex-1 rounded-[12px] border border-canvas-border bg-canvas-elevated overflow-clip">
          <SmartTable
            className=""
            variant="modern"
            dense
            searchable={false}
            showSortHint
            data={allReportsFiltered as unknown as Record<string, unknown>[]}
            keyField="id"
            paginated
            pageSize={20}
            stickyHeader
            stickyHeaderTop="top-0"
            fixedLayout
            hideResultCount
            emptyContent={
              <EmptyState
                icon={Layers}
                title={allSearch || allTypeFilter.length > 0 ? 'No reports match your filters.' : 'No reports yet'}
                body={allSearch || allTypeFilter.length > 0 ? 'Try a different search or type.' : 'Reports, ATRs, and evidence you generate will all appear here.'}
                size="compact"
              />
            }
            columns={[
              { key: 'name', label: 'Report', render: (item) => {
                const row = item as unknown as UnifiedRow;
                return (
                  <ReportNameCell
                    icon={UNIFIED_KIND_META[item.kind as UnifiedKind].icon}
                    iconClass={UNIFIED_KIND_META[item.kind as UnifiedKind].classes}
                    name={String(item.name)}
                    subline={(item.pills as string[] | undefined)?.join(' · ')}
                    onClick={() => row.open()}
                    selectable={Boolean(row.del)}
                    selected={selectedReportIds.has(String(item.id))}
                    isSelecting={isSelectingReports}
                    onToggleSelect={() => toggleReportSelect(String(item.id))}
                  />
                );
              }},
              { key: 'kind', label: 'Type', width: COL_W.type, render: (item) => {
                const k = item.kind as UnifiedKind;
                return (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(item as unknown as UnifiedRow).bulk
                      ? BULK_PILL
                      : TYPE_PILL(KIND_FULL_LABEL[k], KIND_TONE[k])}
                  </div>
                );
              }},
              { key: 'date', label: 'Generated', width: COL_W.generated, render: (item) => (
                <span className="text-[0.75rem] tabular-nums text-ink-500 whitespace-nowrap">{String(item.date)}</span>
              )},              { key: 'actions', label: '', width: COL_W.actions, sortable: false, align: 'right', render: (item) => {
                const row = item as unknown as UnifiedRow;
                return (
                  <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    {row.download && <ActionTooltip label="Download"><button onClick={(e) => { e.stopPropagation(); row.download!(); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button></ActionTooltip>}
                    {row.shareId && can('rp_share') && <ActionTooltip label="Share"><button onClick={(e) => { e.stopPropagation(); openShare({ type: 'report', id: row.shareId!, anchor: rectFromEvent(e) }); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button></ActionTooltip>}
                    {row.del && <ActionTooltip label="Delete"><button onClick={(e) => { e.stopPropagation(); row.del!(); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-risk-200 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer" aria-label="Delete"><Trash2 size={14} /></button></ActionTooltip>}
                  </div>
                );
              }},
            ]}
          />
          </div>
          )}
          </>
        )}

        {/* Shared Reports — same modern table variant so tab switching
            doesn't change the visual grammar. */}
        {activeTab === 'shared-reports' && (
          <ListToolbar
            search={sharedGridSearch}
            onSearch={setSharedGridSearch}
            searchPlaceholder="Search shared reports…"
            trailing={
              <>
                <ColumnFilter
                  variant="button"
                  icon
                  selectIndicator="checkbox"
                  label="Type"
                  options={sharedTypeOptions}
                  value={sharedTypeFilter}
                  onChange={setSharedTypeFilter}
                  align="end"
                />
                <ToolbarViewToggle mode={viewMode} onChange={setViewMode} />
              </>
            }
          />
        )}
        {activeTab === 'shared-reports' && viewMode === 'list' && (
          <div className="flex-1 rounded-[12px] border border-canvas-border bg-canvas-elevated overflow-clip">
          <SmartTable
            className=""
            variant="modern"
            dense
            searchable={false}
            showSortHint
            data={filteredShared as unknown as Record<string, unknown>[]}
            keyField="id"
            paginated
            pageSize={20}
            fixedLayout
            hideResultCount
            emptyContent={SHARED_REPORTS.length === 0 ? (
              <EmptyState
                icon={Share2}
                title="No shared reports"
                body="Reports shared with you by your team will appear here."
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <div className="w-10 h-10 rounded-[8px] bg-paper-50 flex items-center justify-center mb-1">
                  <Search size={20} className="text-ink-400" />
                </div>
                <div className="text-[0.8125rem] font-medium text-ink-700">No shared reports match your filters.</div>
                {(sharedGridSearch || sharedTypeFilter.length > 0) && (
                  <button type="button" onClick={() => { setSharedGridSearch(''); setSharedTypeFilter([]); }} className="text-[0.75rem] text-brand-700 font-medium hover:underline cursor-pointer mt-1">Clear filters</button>
                )}
              </div>
            )}
            columns={[
              { key: 'name', label: 'Report', render: (item) => (
                <ReportNameCell
                  icon={UNIFIED_KIND_META[(item.kind as UnifiedKind) ?? 'ia'].icon}
                  iconClass={UNIFIED_KIND_META[(item.kind as UnifiedKind) ?? 'ia'].classes}
                  name={String(item.name)}
                  subline={`${String(item.queries)} ${Number(item.queries) === 1 ? 'query' : 'queries'}`}
                  onClick={() => openSharedReport(item as unknown as typeof SHARED_REPORTS[number])}
                />
              )},
              { key: 'kind', label: 'Type', width: COL_W.type, render: (item) => {
                const k = (item.kind as UnifiedKind) ?? 'ia';
                return TYPE_PILL(KIND_FULL_LABEL[k], KIND_TONE[k]);
              }},
              { key: 'sharedBy', label: 'Shared by', width: COL_W.sharedBy, render: (item) => (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-brand-600/10 text-brand-600 text-[0.5625rem] font-semibold flex items-center justify-center shrink-0">
                    {String(item.sharedBy).split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <span className="text-ink-500 text-[0.75rem] truncate">{String(item.sharedBy)}</span>
                </div>
              )},
              { key: 'sharedAt', label: 'Shared', width: COL_W.generated, render: (item) => (
                <span className="text-[0.75rem] tabular-nums text-ink-500 whitespace-nowrap">{String(item.sharedAt)}</span>
              )},              { key: 'actions', label: '', width: COL_W.actions, sortable: false, align: 'right', render: (item) => (
                <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  <ActionTooltip label="Download"><button onClick={(e) => { e.stopPropagation(); startReportDownload(addToast, updateToast, String(item.name)); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button></ActionTooltip>
                  {can('rp_share') && <ActionTooltip label="Share"><button onClick={(e) => { e.stopPropagation(); openShare({ type: 'report', id: String(item.id), anchor: rectFromEvent(e) }); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button></ActionTooltip>}
                </div>
              )},
            ]}
          />
          </div>
        )}

        {activeTab === 'shared-reports' && viewMode === 'grid' && (() => {
          const filteredSharedReports = filteredShared;
          return (
          <div className="w-full flex-1">
            {filteredSharedReports.length === 0 ? (
              SHARED_REPORTS.length === 0 ? (
                <div className="px-6 py-12">
                  <EmptyState
                    icon={Share2}
                    title="No shared reports"
                    body="Reports shared with you by your team will appear here."
                  />
                </div>
              ) : (
                <div className="px-6 py-20 flex flex-col items-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-[8px] bg-paper-50 flex items-center justify-center mb-1">
                    <Search size={20} className="text-ink-400" />
                  </div>
                  <div className="text-[0.8125rem] font-medium text-ink-700 max-w-[320px]">
                    No shared reports match your filters.
                  </div>
                  {(sharedGridSearch || sharedTypeFilter.length > 0) && (
                    <button
                      type="button"
                      onClick={() => { setSharedGridSearch(''); setSharedTypeFilter([]); }}
                      className="text-[0.75rem] text-brand-700 font-medium hover:underline cursor-pointer mt-1"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )
            ) : (
            <InfiniteCardGrid
              items={filteredSharedReports}
              resetKey={`shared-${sharedGridSearch}`}
              renderItem={(r, i) => {
                const k = ((r as { kind?: string }).kind as UnifiedKind) ?? 'ia';
                const m = UNIFIED_KIND_META[k];
                return (
                <ReportCard
                  key={r.id}
                  index={i}
                  icon={m.icon}
                  iconClass={m.classes}
                  eyebrow={KIND_FULL_LABEL[k]}
                  title={r.name}
                  description={`Shared by ${r.sharedBy} with ${r.sharedWith}.`}
                  pills={[`${r.queries} ${Number(r.queries) === 1 ? 'query' : 'queries'}`, r.sharedWith]}
                  footerRight={<span className="text-[0.6875rem] tabular-nums text-ink-400">{r.sharedAt}</span>}
                  onClick={() => openSharedReport(r as unknown as typeof SHARED_REPORTS[number])}
                  actions={<>
                    <ActionTooltip label="Download"><button onClick={(e) => { e.stopPropagation(); startReportDownload(addToast, updateToast, r.name); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Download"><Download size={14} /></button></ActionTooltip>
                    {can('rp_share') && <ActionTooltip label="Share"><button onClick={(e) => { e.stopPropagation(); openShare({ type: 'report', id: r.id, anchor: rectFromEvent(e) }); }} className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer" aria-label="Share"><Share2 size={14} /></button></ActionTooltip>}
                  </>}
                />
                );
              }}
            />
            )}
          </div>
          );
        })()}

        {activeTab === 'templates' && (() => {
          // Custom templates open straight into the editor (edit in place).
          const editCustomTemplate = (rt: typeof REPORT_TEMPLATES[number]) => {
            setEditingTemplate(rt);
          };
          // SOX reports are produced from a SOX/ICFR engagement (control testing
          // → working paper → report), never generated standalone from a
          // template. Picking the SOX template routes the user to that area.
          const openSoxFromEngagement = () => {
            addToast({ type: 'info', message: 'Open a SOX / ICFR engagement to generate its report.' });
            onOpenSox?.();
          };
          const renderCard = (rt: typeof REPORT_TEMPLATES[0], i: number, isCustom?: boolean) => {
            const Icon = ICON_MAP[rt.icon] || FileText;
            const color = CATEGORY_COLORS[rt.category] || 'text-ink-500 bg-paper-50';
            const eyebrowTone = color.split(' ')[0];
            const tintBg = color.split(' ')[1] ?? 'bg-paper-50';
            const sectionNames = rt.sections?.map(s => s.name) ?? [];
            return (
              <motion.div
                key={rt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
                className="bg-canvas-elevated border border-canvas-border rounded-[12px] p-5 transition-colors duration-200 group cursor-pointer flex flex-col min-h-[164px] hover:border-brand-200"
                onClick={() => {
                  // Whole card = the primary action. Each report type generates
                  // its own way: ATR via upload/observations, SOX from a SOX/ICFR
                  // engagement, IA/Bulk by assembling from existing report queries.
                  const kind = templateKind(rt);
                  if (kind === 'atr') { setAtrWizardOpen(true); return; }
                  if (kind === 'sox') { openSoxFromEngagement(); return; }
                  setWizardTemplate(rt);
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3.5">
                  <div className={`inline-flex items-center justify-center w-9 h-9 rounded-[10px] ${tintBg}`}>
                    <Icon size={16} className={eyebrowTone} strokeWidth={1.75} />
                  </div>
                  <div className="relative flex items-center h-7">
                    <span className={`text-[0.625rem] font-semibold uppercase tracking-[0.14em] transition-opacity duration-200 group-hover:opacity-0 ${eyebrowTone}`}>
                      {rt.category}
                    </span>
                    <span
                      aria-hidden
                      className="absolute right-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-600/[0.07] text-brand-600 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 ease-out"
                    >
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
                <h3 className="text-[0.9375rem] leading-[1.3] font-semibold tracking-tight text-ink-900 group-hover:text-brand-600 transition-colors mb-1.5">{rt.name}</h3>
                <p className="text-[0.75rem] text-ink-500 leading-[1.55] line-clamp-2">{rt.desc}</p>
                {isCustom && ((rt as EditableTemplate).tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {(rt as EditableTemplate).tags!.slice(0, 3).map(tag => (
                      <span key={tag} className="inline-flex items-center h-5 px-1.5 rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-medium">{tag}</span>
                    ))}
                    {(rt as EditableTemplate).tags!.length > 3 && <span className="text-[0.625rem] text-ink-400">+{(rt as EditableTemplate).tags!.length - 3}</span>}
                  </div>
                )}
                <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {sectionNames.length > 0 ? (
                      <>
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full border border-canvas-border bg-paper-50/70 text-[0.6875rem] font-medium text-ink-600 tabular-nums whitespace-nowrap shrink-0">
                          {sectionNames.length} {sectionNames.length === 1 ? 'section' : 'sections'}
                        </span>
                        <span className="text-[0.6875rem] text-ink-400 leading-none truncate">{sectionNames.slice(0, 2).join(' · ')}</span>
                      </>
                    ) : (
                      <span className="inline-flex items-center h-6 px-2.5 rounded-full border border-canvas-border bg-paper-50/70 text-[0.6875rem] font-medium text-ink-400 whitespace-nowrap shrink-0">
                        No sections
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isCustom && (
                      <ActionTooltip label="Edit">
                        <button
                          onClick={(e) => { e.stopPropagation(); editCustomTemplate(rt); }}
                          aria-label={`Edit template ${rt.name}`}
                          className="w-7 h-7 flex items-center justify-center rounded-full text-ink-400 hover:text-brand-600 hover:bg-brand-600/[0.07] transition-colors duration-200 cursor-pointer"
                        >
                          <Edit3 size={13} />
                        </button>
                      </ActionTooltip>
                    )}
                    {isCustom && (
                      <ActionTooltip label="Delete template">
                        <button
                          onClick={(e) => { e.stopPropagation(); setTemplateToDelete({ id: rt.id, name: rt.name }); }}
                          aria-label={`Delete template ${rt.name}`}
                          className="w-7 h-7 flex items-center justify-center rounded-full text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors duration-200 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </ActionTooltip>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          };

          // Dense list row — same data as the card, one line per template.
          const renderRow = (rt: typeof REPORT_TEMPLATES[0], i: number, isCustom?: boolean) => {
            const Icon = ICON_MAP[rt.icon] || FileText;
            const color = CATEGORY_COLORS[rt.category] || 'text-ink-500 bg-paper-50';
            const eyebrowTone = color.split(' ')[0];
            const tintBg = color.split(' ')[1] ?? 'bg-paper-50';
            const sectionCount = rt.sections?.length ?? 0;
            return (
              <motion.div
                key={rt.id}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 14) * 0.018, duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
                className="group relative flex items-center gap-3 pl-3 pr-2.5 py-2.5 cursor-pointer hover:bg-canvas transition-colors"
                onClick={() => {
                  const kind = templateKind(rt);
                  if (kind === 'atr') { setAtrWizardOpen(true); return; }
                  if (kind === 'sox') { openSoxFromEngagement(); return; }
                  setWizardTemplate(rt);
                }}
              >
                <div className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-[8px] ${tintBg}`}>
                  <Icon size={15} className={eyebrowTone} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.8125rem] font-semibold text-ink-900 truncate group-hover:text-brand-700 transition-colors">{rt.name}</span>
                  </div>
                  <p className="text-[0.75rem] text-ink-400 truncate leading-snug">{rt.desc}</p>
                </div>
                {/* Meta + actions — always visible (no hover fade). */}
                <div className="shrink-0 flex items-center gap-3">
                  <span className={`hidden md:inline w-[5.5rem] text-right text-[0.625rem] font-semibold uppercase tracking-[0.12em] ${eyebrowTone}`}>{rt.category}</span>
                  <span className="hidden sm:inline-flex items-center h-6 px-2.5 rounded-full border border-canvas-border bg-paper-50/70 text-[0.6875rem] font-medium text-ink-600 tabular-nums whitespace-nowrap">
                    {sectionCount} {sectionCount === 1 ? 'section' : 'sections'}
                  </span>
                  <div className="flex items-center gap-0.5 pl-1">
                    {isCustom && (
                      <ActionTooltip label="Edit">
                        <button
                          onClick={(e) => { e.stopPropagation(); editCustomTemplate(rt); }}
                          aria-label={`Edit template ${rt.name}`}
                          className="w-7 h-7 flex items-center justify-center rounded-[7px] text-ink-400 hover:text-brand-600 hover:bg-brand-600/[0.07] transition-colors cursor-pointer"
                        >
                          <Edit3 size={14} />
                        </button>
                      </ActionTooltip>
                    )}
                    {isCustom && (
                      <ActionTooltip label="Delete template">
                        <button
                          onClick={(e) => { e.stopPropagation(); setTemplateToDelete({ id: rt.id, name: rt.name }); }}
                          aria-label={`Delete template ${rt.name}`}
                          className="w-7 h-7 flex items-center justify-center rounded-[7px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </ActionTooltip>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          };

          // Galleries switch between a 3-up card grid and a flat row list.
          const renderGallery = (rows: typeof REPORT_TEMPLATES[number][], isCustom: boolean) =>
            viewMode === 'grid' ? (
              <div className="grid grid-cols-3 gap-4">
                {rows.map((rt, i) => renderCard(rt, i, isCustom))}
              </div>
            ) : (
              <div className="rounded-[10px] border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border [&>*:first-child]:rounded-t-[10px] [&>*:last-child]:rounded-b-[10px]">
                {rows.map((rt, i) => renderRow(rt, i, isCustom))}
              </div>
            );

          const q = templateSearch.trim().toLowerCase();
          const filteredCustom = q
            ? customTemplates.filter(t => t.name.toLowerCase().includes(q) || (t.desc ?? '').toLowerCase().includes(q) || ((t as EditableTemplate).tags ?? []).some(tag => tag.toLowerCase().includes(q)))
            : customTemplates;
          const filteredStandard = q
            ? REPORT_TEMPLATES.filter(t => t.name.toLowerCase().includes(q) || (t.desc ?? '').toLowerCase().includes(q))
            : REPORT_TEMPLATES;

          // Single creation entry — "New template" opens the editor directly. The
          // editor already hosts "Import from a report" and one-tap recommended
          // Internal Audit sections, so no separate start-chooser step is needed.
          const templateToolbarActions = (
            <button type="button" className={BTN_CTA_PRIMARY} onClick={() => setEditingTemplate(BLANK_TEMPLATE as typeof REPORT_TEMPLATES[number])}>
              <Plus size={14} /> New template
            </button>
          );

          const noSearchMatch = (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="w-10 h-10 rounded-[8px] bg-paper-50 flex items-center justify-center mb-1">
                <Search size={20} className="text-ink-400" />
              </div>
              <div className="text-[0.8125rem] font-medium text-ink-700">No templates match &ldquo;{templateSearch}&rdquo;.</div>
              <button type="button" onClick={() => setTemplateSearch('')} className="text-[0.75rem] text-brand-700 font-medium hover:underline cursor-pointer mt-1">Clear search</button>
            </div>
          );

          // Small section label above each gallery.
          const sectionLabel = (label: string, count: number) => (
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[0.8125rem] font-semibold text-ink-900">{label}</h3>
              <span className="inline-flex items-center justify-center h-[1.125rem] min-w-[1.125rem] px-1.5 rounded-full bg-paper-100 text-[0.6875rem] font-semibold text-ink-500 tabular-nums">
                {count}
              </span>
            </div>
          );

          return (
            <div>
              {/* One page — search + actions pin to the top of the scroll area
                  so they stay put while the card galleries scroll underneath.
                  pb-7 is both the gap to the first gallery and the scroll
                  cushion, matching the space-y-7 between galleries below. */}
              <div className="sticky top-0 z-20 -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-6 pt-6 pb-5 bg-canvas">
                <ListToolbar
                  search={templateSearch}
                  onSearch={setTemplateSearch}
                  searchPlaceholder="Search templates…"
                  trailing={
                    <>
                      <ToolbarViewToggle mode={viewMode} onChange={setViewMode} />
                      {templateToolbarActions}
                    </>
                  }
                />
              </div>

              <div className="space-y-5">
              {/* Standard gallery. */}
              <section>
                {sectionLabel('Standard', filteredStandard.length)}
                {filteredStandard.length === 0 ? noSearchMatch : renderGallery(filteredStandard, false)}
              </section>

              {/* Custom gallery. */}
              <section>
                {sectionLabel('Custom', filteredCustom.length)}
                {customTemplates.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No custom templates"
                    body="Create a template — start from scratch or import an existing report — to reuse it across reports."
                    size="compact"
                  />
                ) : filteredCustom.length === 0 ? (
                  noSearchMatch
                ) : (
                  renderGallery(filteredCustom, true)
                )}
              </section>
              </div>
            </div>
          );
        })()}
        </div>
      </div>


      {/* Generate ATR by Upload — the upload-to-ATR wizard, hosted in a modal. */}
      <AnimatePresence>
        {atrUploadOpen && (
          <>
            {/* Backdrop is inert — the wizard owns its own close so an outside
                click can't discard in-progress work without confirmation. */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: atrConfirmOpen ? 0 : 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px] z-50" />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1040px] max-w-[95vw] h-[680px] max-h-[92vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col overflow-hidden"
              role="dialog" aria-modal="true" aria-label="Generate ATR by Upload"
            >
              <AtrUploadTab onClose={() => { setAtrUploadOpen(false); setAtrConfirmOpen(false); clearAtrDraft(); }} onManageExceptions={onManageExceptions} onSaveAtr={saveUploadedAtr} onConfirmOpenChange={setAtrConfirmOpen} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Generate-from-template wizard */}
      <AnimatePresence>
        {wizardTemplate && (
          <GenerateReportWizard
            template={wizardTemplate}
            sources={wizardSources}
            onClose={() => setWizardTemplate(null)}
            onCreate={(payload) => createReportFromWizard(wizardTemplate, payload)}
          />
        )}
      </AnimatePresence>

      {/* Template Editor Modal */}
      <AnimatePresence>
        {editingTemplate && (
          <TemplateEditor
            // Key by identity so switching templates (or opening the blank "new"
            // template) remounts the editor fresh instead of reusing the previous
            // template's seeded state.
            key={editingTemplate.id}
            template={editingTemplate}
            // New templates open with an empty name field so the author must name
            // it — a shared "Untitled Template" default collided for everyone.
            initialName={editingTemplate.id === 'ct-blank' ? '' : undefined}
            // Save dismisses everything (terminal); Cancel just closes the
            // editor so the still-mounted wizard reappears with its selections.
            onClose={() => { setEditingTemplate(null); setWizardTemplate(null); }}
            onCancel={() => { setEditingTemplate(null); }}
            onSaveNew={(created) => addCustomTemplate(created)}
            onSaveEdit={(updated) => updateCustomTemplate(updated)}
            existingTemplateNames={[...REPORT_TEMPLATES.map(t => t.name), ...customTemplates.map(t => t.name)]}
            existingStructures={customTemplates
              .filter(t => t.id !== editingTemplate!.id)
              .map(t => ({ name: t.name, sectionNames: (t.sections ?? []).map(s => s.name) }))}
          />
        )}
      </AnimatePresence>



      {/* Generate ATR from Observations — opened by the ATR template "Generate".
          The review step's "Add to Report" saves the ATR into My Reports. */}
      {atrWizardOpen && (
        <UploadReportModal
          onClose={() => setAtrWizardOpen(false)}
          onAddToReport={(meta: AtrMeta, observations: AtrObservation[], insights: AtrInsight[]) => {
            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const name = uniqueReportName(meta.auditTitle ? meta.auditTitle : 'Action Taken Report');
            const newReport: GeneratedReport = {
              id: `gr-atr-${Date.now()}`,
              templateId: 'rt-007',
              kind: 'atr',
              name,
              tag: 'Internal Audit',
              generatedBy: 'You',
              generatedAt: today,
              status: 'draft',
              pages: Math.max(1, observations.length),
              queries: observations.length,
              atrData: { meta, observations, insights },
            };
            setGeneratedReports(prev => [newReport, ...prev]);
            setViewingReport(newReport);
            setAtrWizardOpen(false);
            addToast({ type: 'success', message: 'Action Taken Report added to My Reports.' });
          }}
        />
      )}

      <ConfirmDialog
        open={!!templateToDelete}
        onClose={() => setTemplateToDelete(null)}
        title="Delete template?"
        description={templateToDelete && (
          <>This removes <span className="font-semibold text-ink-800">{templateToDelete.name}</span> from Custom templates. Reports already generated from it are not affected.</>
        )}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!templateToDelete) return;
          removeCustomTemplate(templateToDelete.id);
          addToast({ type: 'success', message: `Template "${templateToDelete.name}" deleted.` });
          setTemplateToDelete(null);
        }}
      />
      <ConfirmDialog
        open={!!reportToDelete}
        onClose={() => setReportToDelete(null)}
        title="Delete report?"
        description={reportToDelete && (
          <>This will remove <span className="font-semibold text-ink-800">{reportToDelete.name}</span> from My Reports. You can undo this from the toast for a few seconds.</>
        )}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!reportToDelete) return;
          const name = reportToDelete.name;
          const id = reportToDelete.id;
          // Snapshot the report and its position so Undo restores both.
          const snapshot = generatedReports.find(r => r.id === id);
          const snapshotIndex = generatedReports.findIndex(r => r.id === id);
          setGeneratedReports(prev => prev.filter(r => r.id !== id));
          setReportToDelete(null);
          addToast({
            type: 'success',
            message: `${name} deleted.`,
            action: snapshot ? {
              label: 'Undo',
              onClick: () => {
                setGeneratedReports(prev => {
                  if (prev.some(r => r.id === id)) return prev;
                  const next = [...prev];
                  next.splice(Math.max(0, snapshotIndex), 0, snapshot);
                  return next;
                });
              },
            } : undefined,
          });
        }}
      />

      {/* Floating bulk-action bar for multi-selected reports — mirrors the
          Knowledge Hub data-source bulk bar (dark pill, N selected · Remove · ✕). */}
      <AnimatePresence>
        {isSelectingReports && (
          <motion.div
            key="reports-bulk-bar"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            role="toolbar"
            aria-label="Bulk actions for selected reports"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 pl-4 pr-2 py-2 rounded-lg bg-brand-900 text-white shadow-[0_8px_28px_rgb(15_8_30_/_0.28)] ring-1 ring-white/10"
          >
            <span className="text-[0.8125rem] font-semibold tabular-nums text-white">{selectedReportIds.size} selected</span>
            {selectableVisibleIds.length > 0 && (
              <>
                <div className="w-px h-5 bg-white/10 mx-1" aria-hidden />
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[0.8125rem] font-medium cursor-pointer transition-colors text-white/80 hover:text-white hover:bg-white/10"
                >
                  {allVisibleSelected ? 'Deselect all' : `Select all (${selectableVisibleIds.length})`}
                </button>
              </>
            )}
            <div className="w-px h-5 bg-white/10 mx-1" aria-hidden />
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[0.8125rem] font-medium cursor-pointer transition-colors text-risk-300 hover:text-white hover:bg-risk-700"
            >
              <Trash2 size={14} /> Remove
            </button>
            <div className="w-px h-5 bg-white/10 mx-1" aria-hidden />
            <button
              type="button"
              onClick={clearReportSelection}
              aria-label="Cancel selection"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selectedReportIds.size} ${selectedReportIds.size === 1 ? 'report' : 'reports'}?`}
        description={<>This will remove <span className="font-semibold text-ink-800">{selectedReportIds.size} {selectedReportIds.size === 1 ? 'report' : 'reports'}</span> from My Reports. You can undo this from the toast for a few seconds.</>}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          const ids = new Set(selectedReportIds);
          // Snapshot removed reports with their positions so Undo restores all.
          const snapshots = generatedReports
            .map((r, i) => ({ r, i }))
            .filter(({ r }) => ids.has(r.id));
          setGeneratedReports(prev => prev.filter(r => !ids.has(r.id)));
          setBulkDeleteOpen(false);
          clearReportSelection();
          addToast({
            type: 'success',
            message: `${ids.size} ${ids.size === 1 ? 'report' : 'reports'} deleted.`,
            action: snapshots.length ? {
              label: 'Undo',
              onClick: () => setGeneratedReports(prev => {
                const next = [...prev];
                snapshots.forEach(({ r, i }) => {
                  if (!next.some(x => x.id === r.id)) next.splice(Math.min(i, next.length), 0, r);
                });
                return next;
              }),
            } : undefined,
          });
        }}
      />
    </div>
  );
}
