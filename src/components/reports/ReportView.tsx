// Single-report detail reader — the report-viewing surface and all of its
// child components (query cards, observation cards, workflow result cards,
// drawers, the add-query modal). Extracted wholesale from ReportsView so the
// landing (ReportsView) and the reader (this file) are separate concerns.

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import {
  FileText, Shield, AlertTriangle, CheckCircle2, BarChart3,
  TrendingUp, Download, Share2, ArrowLeft, ChevronDown,
  ChevronLeft, ChevronRight,
  Layout, X, Edit3, Loader2, Trash2,
  List, LayoutGrid, GripVertical, Plus,
  MoreVertical, Eye, EyeOff, SquareArrowOutUpRight,
  MessageSquare, Paperclip, Send, History,
  Layers, Check, RefreshCw, Lock, Sparkles,
} from 'lucide-react';
import EmptyState from '../shared/EmptyState';
import { ManageExceptionsLaunchButton } from './ManageExceptionsLaunchButton';
import ConfirmDialog from './ConfirmDialog';
import GenerateATRModal from '../exceptions/GenerateATRModal';
import type { AtrReportData } from './atrTypes';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { REPORT_TEMPLATES } from '../../data/mockData';
import { REPORT_QUERIES_ATR } from '../../data/reportQueries';
import { QUERY_GRAPHS, QUERY_TABLES, QUERY_KPIS, QUERY_TABLE_SETS } from '../../data/queryGraphs';
import { cellRender } from './queryTableCell';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';
import { reportDisplayName } from './reportName';
import { ApplyTemplateDropdown } from './TemplateEditor';
import {
  SECTION_ICONS, reportGradient, reportAccent, mergeTemplateOptions,
  computeQueryKpis, reportKind, collectBlockLibrary,
  type WorkflowResult,
  type QueryShape, type QueryComment, type GeneratedReport,
  type SignatorySlot, type Signoff,
} from './reportShared';
import QueryWidgetModal from './QueryWidgetModal';
import { useToast } from '../shared/Toast';
import { useCan, useCurrentUser } from '../../context/CurrentUserContext';
import { useAuditLog } from '../../context/AdminDataContext';
import { KpiCountUp } from '../shared/KpiTile';
import { ReportBrandBanner, ReportNumberedHeading, ReportKpiTiles, ReportSignoffBlock, ReportClosingBlock } from './ReportDocumentChrome';
import { statTone } from './reportTones';
import { renderAssistantText } from '../shared/AssistantMarkdown';
import { composeExecSummary, composeSectionContent, workflowToQueryDef } from './templateQueryPool';
import { buildReportFacts } from './byot/templateBinding';
import TemplateBlockBody, { type CardFinding } from './TemplateBlockBody';
import AtrReviewDrawer from './AtrReviewDrawer';
import { loadBaselineVersions, appendVersion, saveVersions, nowStamp, type AtrVersion } from './atrReview';
import type { TemplateSection } from './reportShared';
import ReportDownloadModal, { type DownloadPreviewSection } from './ReportDownloadModal';
import AddObservationModal, {
  computeNextObservationId,
  isImageMime,
  formatFileSize,
  attachmentVisual,
  type EditingObservationInput,
  type ObservationAttachment,
} from './AddObservationModal';

// Audit Period shown in the banner byline. Uses the report's stored period when
// present (wizard-generated), else the current fiscal quarter — so every report
// type carries a period (matches the GenerateReportWizard "FY26 Q2" format).
const reportAuditPeriod = (period?: string): string => {
  if (period && period.trim()) return period.trim();
  const now = new Date();
  return `FY${String(now.getFullYear()).slice(-2)} Q${Math.floor(now.getMonth() / 3) + 1}`;
};

/**
 * Gates the "Manage Exceptions" CTA behind an explicit "Generate Cases" toggle.
 * idle → switch off; user flips it on → brief generating state; once ready the
 * toggle is replaced inline by the existing ManageExceptionsLaunchButton.
 */
// Tone a query-card inline KPI value by what its label means, so the strip
// carries a glanceable read (open work = attention, closed = resolved) instead
// of a flat row of identical-weight numbers.
function kpiInlineTone(label: string): string {
  const l = label.toLowerCase();
  if (/overdue|fail|breach|critical|violation/.test(l)) return 'text-risk-700';
  if (/open|pending|unmatched|flagged/.test(l)) return 'text-high-700';
  if (/closed|resolved|remediat|cleared|matched/.test(l)) return 'text-compliant-700';
  if (/health|score|rate|coverage|%/.test(l)) return 'text-brand-700';
  return 'text-ink-900';
}

type CasesPhase = 'idle' | 'generating' | 'ready';

function GenerateCasesGate({ queryId, phase, onPhaseChange }: { queryId: string; phase: CasesPhase; onPhaseChange: (p: CasesPhase) => void }) {
  const handleToggle = () => {
    if (phase !== 'idle') return;
    onPhaseChange('generating');
    window.setTimeout(() => onPhaseChange('ready'), 1400);
  };

  if (phase === 'ready') {
    return <ManageExceptionsLaunchButton queryId={queryId} />;
  }

  const isOn = phase === 'generating';
  return (
    <button
      type="button"
      aria-label={isOn ? 'Generating cases' : 'Generate cases'}
      aria-busy={isOn}
      onClick={handleToggle}
      disabled={isOn}
      className={`group inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 text-[0.75rem] font-semibold rounded-md border transition-colors cursor-pointer ${
        isOn
          ? 'text-brand-700 bg-brand-50 border-brand-200 cursor-default'
          : 'text-ink-600 bg-canvas-elevated border-canvas-border hover:text-brand-700 hover:border-brand-300 hover:bg-brand-50/40'
      }`}
    >
      {isOn ? (
        <>
          <Loader2 size={14} className="shrink-0 animate-spin text-brand-600" />
          <span>Generating cases…</span>
        </>
      ) : (
        <>
          <Sparkles size={14} className="shrink-0 text-brand-600 transition-transform duration-200 group-hover:scale-110" />
          <span>Generate Cases</span>
        </>
      )}
    </button>
  );
}


function QueryCard({ query, index, onOpenQuery, onDelete, comments = [], onAddComment, title }: { query: QueryShape; index: number; onOpenQuery?: (query: { id: string; title: string }) => void; onDelete?: () => void; comments?: QueryComment[]; onAddComment?: (queryId: string, queryTitle: string, text: string, attachments?: string[]) => void; title?: string }) {
  const { addToast } = useToast();
  const { can } = useCan();
  const safeQuery = query ?? { id: '', risk: '', severity: '', title: '', addedBy: '', kpis: [], summary: '', findings: [], observations: [], answer: '', chartData: [] } as QueryShape;
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Pending removal of an attached widget (graph/table) — confirmed via dialog.
  const [pendingWidgetRemove, setPendingWidgetRemove] = useState<{ kind: 'chart' | 'table'; id: string; title: string } | null>(null);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const availableGraphs = QUERY_GRAPHS[safeQuery.id] ?? [];
  // Multi-table set when defined (Q01 = the four Excel tables); otherwise wrap
  // the single QUERY_TABLES entry so other queries still surface one table.
  const single = QUERY_TABLES[safeQuery.id];
  const queryTables = QUERY_TABLE_SETS[safeQuery.id]
    ?? (single ? [{ id: 'results', title: 'Results Table', columns: single.columns, rows: single.rows }] : []);
  const queryKpis = QUERY_KPIS[safeQuery.id] ?? computeQueryKpis(safeQuery);
  // Card stays lean by default (KPIs inline; graphs/tables opt-in). The modal
  // always reflects what's actually on the card — already-added items show
  // checked; the rest unchecked. "Select all" in the modal adds everything at once.
  const [selectedKpis, setSelectedKpis] = useState<Set<string>>(() => new Set(queryKpis.map(k => k.label)));
  const [selectedCharts, setSelectedCharts] = useState<Set<string>>(new Set());
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const baseDelay = index * 0.08;

  const severityStyle = safeQuery.severity === 'High'
    ? { pill: 'bg-risk-50 text-risk-700', dot: 'bg-risk-500' }
    : safeQuery.severity === 'Medium'
      ? { pill: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated-500' }
      : { pill: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant-500' };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (!query || !query.id) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: baseDelay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative bg-white border border-canvas-border overflow-hidden"
    >

      <div className="px-9 py-7">
        {/* Meta band — type-only line: Q01 · risk · severity · status on the left;
            Manage Exceptions (text-link), Comments, 3-dots on the right. */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.15, duration: 0.35 }}
          className="mb-4"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap text-[0.625rem] font-semibold uppercase tracking-wider">
              <span className="font-mono text-[0.75rem] text-brand-600 tabular-nums shrink-0 normal-case tracking-normal">{query.id}</span>
              <span aria-hidden className="text-ink-300 select-none">·</span>
              <span className="text-ink-400 shrink-0">{query.risk}</span>
              <span aria-hidden className="text-ink-300 select-none">·</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${severityStyle.dot}`} />
                <span className={query.severity === 'High' ? 'text-risk-700' : query.severity === 'Medium' ? 'text-mitigated-700' : 'text-compliant-700'}>{query.severity}</span>
              </span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <ManageExceptionsLaunchButton queryId={query.id} compact />
              {can('rp_comment') && (() => {
                const myComments = comments.filter(c => c.queryId === query.id).length;
                return (
                  <div className="relative group/cm">
                    <button
                      onClick={() => setCommentsOpen(true)}
                      aria-label="Comments on this query"
                      className="relative inline-flex items-center justify-center w-8 h-8 text-ink-400 rounded-md cursor-pointer hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    >
                      <MessageSquare size={16} className="shrink-0" />
                      {myComments > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 text-[0.5625rem] font-semibold bg-brand-600 text-white rounded-full tabular-nums border border-white">
                          {myComments}
                        </span>
                      )}
                    </button>
                    <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 z-30 whitespace-nowrap rounded-md bg-ink-900 text-white text-[0.625rem] font-semibold px-2 py-1 opacity-0 translate-y-0.5 transition-all duration-150 shadow-md group-hover/cm:opacity-100 group-hover/cm:translate-y-0">
                      Comments
                    </span>
                  </div>
                );
              })()}
              <div className="relative group/aw">
                <button
                  onClick={() => setWidgetModalOpen(true)}
                  aria-label="Add widgets"
                  className="w-8 h-8 flex items-center justify-center rounded-md text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                >
                  <LayoutGrid size={16} className="shrink-0" />
                </button>
                <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 z-30 whitespace-nowrap rounded-md bg-ink-900 text-white text-[0.625rem] font-semibold px-2 py-1 opacity-0 translate-y-0.5 transition-all duration-150 shadow-md group-hover/aw:opacity-100 group-hover/aw:translate-y-0">
                  Add Widgets
                </span>
              </div>
              <div className="relative group/dots -ml-1" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label="More options"
                  className="w-8 h-8 flex items-center justify-center rounded-md text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                >
                  <MoreVertical size={16} />
                </button>
                {!menuOpen && (
                  <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 z-30 whitespace-nowrap rounded-md bg-ink-900 text-white text-[0.625rem] font-semibold px-2 py-1 opacity-0 translate-y-0.5 transition-all duration-150 shadow-md group-hover/dots:opacity-100 group-hover/dots:translate-y-0">
                    More options
                  </span>
                )}
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, scale: 0.96, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -6 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 32, mass: 0.6 }}
                      className="absolute right-0 top-10 z-10 w-[164px] origin-top-right bg-white border border-canvas-border rounded-lg shadow-[0_12px_32px_-8px_rgba(15,8,30,0.18)] p-1.5"
                    >
                      {[
                        { icon: SquareArrowOutUpRight, label: 'Open Query', tile: 'text-brand-600 bg-brand-50', onClick: () => { setMenuOpen(false); onOpenQuery?.({ id: query.id, title: query.title }); } },
                        { icon: Download, label: 'Download', tile: 'text-evidence-700 bg-evidence-50', onClick: () => setMenuOpen(false) },
                      ].map((item, i) => (
                        <motion.button
                          key={item.label}
                          role="menuitem"
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 + i * 0.04, duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                          onClick={item.onClick}
                          className="group/mi flex items-center gap-2.5 w-full text-left px-2 h-9 rounded-md text-[0.8125rem] font-medium text-ink-700 hover:bg-brand-50 hover:text-ink-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-brand-50"
                        >
                          <span className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-sm ${item.tile}`}>
                            <item.icon size={14} strokeWidth={2.25} />
                          </span>
                          {item.label}
                        </motion.button>
                      ))}
                      {can('rp_delete') && (
                        <>
                          <div className="my-1.5 -mx-1.5 border-t border-canvas-border" />
                          <motion.button
                            role="menuitem"
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 + 3 * 0.04, duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                            onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                            className="group/mi flex items-center gap-2.5 w-full text-left px-2 h-9 rounded-md text-[0.8125rem] font-medium text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-risk-50"
                          >
                            <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-sm text-risk-700 bg-risk-50">
                              <Trash2 size={14} strokeWidth={2.25} />
                            </span>
                            Delete Query
                          </motion.button>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

        </motion.div>

        {/* Title — the question, in Inter to match the rest of the report page. */}
        <motion.h3
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.2, duration: 0.35 }}
          className="text-[1.25rem] font-semibold text-ink-800 leading-[1.3] tracking-[-0.005em] mb-4"
        >
          {query.title}
        </motion.h3>

        {/* Inline metrics — a compact stat strip directly below the query title so
            the numbers read as the answer to the question. Value stacks over an
            uppercase label; the value is tone-coloured by meaning (open = needs
            attention, closed = resolved). Driven by the "Add Widgets" modal. */}
        {(() => {
          const kpis = queryKpis.filter(k => selectedKpis.has(k.label));
          if (kpis.length === 0) return null;
          return (
            <div className="flex flex-wrap items-stretch gap-x-6 gap-y-4 tabular-nums mb-7">
              {kpis.map((k, ki) => (
                <motion.div
                  key={k.label}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: baseDelay + 0.3 + ki * 0.05, duration: 0.3 }}
                  className="flex-1 min-w-[120px] flex flex-col gap-1.5"
                >
                  <span className={`text-[1.5rem] font-bold leading-none tracking-[-0.02em] ${kpiInlineTone(k.label)}`}>
                    <KpiCountUp value={k.value} delay={120 + ki * 80} />
                  </span>
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500 leading-none">{k.label}</span>
                </motion.div>
              ))}
            </div>
          );
        })()}

        {/* Attached charts — selected via the "Add Widgets" modal */}
        {availableGraphs.filter(g => selectedCharts.has(g.id)).map(g => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="bg-canvas-elevated border border-canvas-border rounded-lg p-4 mb-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider">
                <BarChart3 size={12} />
                {g.title}
              </div>
              <button
                onClick={() => setPendingWidgetRemove({ kind: 'chart', id: g.id, title: g.title })}
                title="Remove graph"
                aria-label="Remove graph"
                className="w-6 h-6 flex items-center justify-center rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="h-[340px]">
              <ConfigurableChart
                type={g.type}
                xAxis={g.xAxis}
                yAxis={g.yAxis}
                color={g.color ?? '#6a12cd'}
                showTarget={false}
                showLegend
              />
            </div>
          </motion.div>
        ))}

        {/* Attached tables — selected via the "Add Widgets" modal. Rendered with
            the dashboard table styling (surface-2 headers, brand-700 first column,
            severity pills) via the shared cellRender. */}
        {queryTables.filter(t => selectedTables.has(t.id)).map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="bg-canvas-elevated border border-canvas-border rounded-lg p-4 mb-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider">
                <LayoutGrid size={12} />
                {t.title}
              </div>
              <button
                onClick={() => setPendingWidgetRemove({ kind: 'table', id: t.id, title: t.title })}
                title="Remove table"
                aria-label="Remove table"
                className="w-6 h-6 flex items-center justify-center rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-canvas-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-canvas-border bg-surface-2/50">
                    {t.columns.map(c => (
                      <th
                        key={c}
                        className="px-4 py-3 text-left text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row, ri) => (
                    <motion.tr
                      key={ri}
                      initial={{ opacity: 0, y: 4 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-20px' }}
                      transition={{ duration: 0.28, delay: Math.min(ri, 12) * 0.03, ease: [0.22, 1, 0.36, 1] }}
                      className="border-b border-canvas-border/50 last:border-0 hover:bg-brand-50/30 transition-colors"
                    >
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-4 py-3 text-[0.75rem] whitespace-nowrap">
                          {cellRender(cell, t.columns[ci] || '', ci === 0)}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ))}

        {/* Answer — report's document markdown variant. This is a report
            DOCUMENT (not a chat conversation), so the 66ch chat rule doesn't
            bind: 66ch left a narrow ragged strip with a big right gutter under
            the full-width title, which read as "too many lines". Capped at 80ch
            — fills the column, aligns with the title, and keeps line length in
            the comfortable document range. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: baseDelay + 0.6, duration: 0.4 }}
          className="max-w-[80ch]"
        >
          {renderAssistantText(query.answer, 'document')}
        </motion.div>
      </div>

      {commentsOpen && createPortal(
        <CommentDrawer
          query={query}
          comments={comments}
          onAddComment={onAddComment}
          onClose={() => setCommentsOpen(false)}
        />,
        document.body,
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Remove Query Card?"
        description="Remove this query card from the report?"
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete?.();
        }}
      />

      <ConfirmDialog
        open={pendingWidgetRemove !== null}
        onClose={() => setPendingWidgetRemove(null)}
        title={pendingWidgetRemove?.kind === 'table' ? 'Remove table?' : 'Remove graph?'}
        description={pendingWidgetRemove ? `Remove “${pendingWidgetRemove.title}” from this query card?` : ''}
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (pendingWidgetRemove?.kind === 'chart') {
            setSelectedCharts(prev => { const n = new Set(prev); n.delete(pendingWidgetRemove.id); return n; });
          } else if (pendingWidgetRemove?.kind === 'table') {
            setSelectedTables(prev => { const n = new Set(prev); n.delete(pendingWidgetRemove.id); return n; });
          }
          setPendingWidgetRemove(null);
        }}
      />

      {widgetModalOpen && createPortal(
        <QueryWidgetModal
          queryId={query.id}
          queryTitle={query.title}
          kpis={queryKpis}
          charts={availableGraphs}
          tables={queryTables}
          initialKpis={selectedKpis}
          initialCharts={selectedCharts}
          initialTables={selectedTables}
          onConfirm={(sel) => {
            setSelectedKpis(sel.kpis);
            setSelectedCharts(sel.charts);
            setSelectedTables(sel.tables);
            setWidgetModalOpen(false);
            addToast({ type: 'success', message: 'Query card updated.' });
          }}
          onClose={() => setWidgetModalOpen(false)}
        />,
        document.body,
      )}
    </motion.div>
  );
}


// Comment attachments store only a filename (the composer keeps the name, not
// the bytes), so there's no real file to serve. Open a clean placeholder
// document in a new tab keyed to the file name.
function openAttachment(name: string) {
  const safe = (name || 'Attachment').replace(/[<>&"]/g, '');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${safe}</title><style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:Inter,system-ui,sans-serif;background:#faf9fc;color:#1e1b2e}.doc{font-size:15px;font-weight:600}.hint{font-size:13px;color:#8b8698}.tag{font:600 11px/1 ui-monospace,monospace;color:#6d28d9;background:#f3effc;padding:4px 10px;border-radius:999px}</style></head><body><span class="tag">ATTACHMENT</span><div class="doc">${safe}</div><div class="hint">Preview isn't available in this prototype.</div></body></html>`;
  window.open('data:text/html;charset=utf-8,' + encodeURIComponent(html), '_blank', 'noopener,noreferrer');
}

// Downloads the attachment under its own name. The prototype has no stored
// bytes, so we save a small placeholder file keyed to the name.
function downloadAttachment(name: string) {
  const safe = name || 'attachment';
  const blob = new Blob([`${safe}\n\nPlaceholder file — this prototype stores the attachment name, not its contents.`], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safe;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Query side-sheet — Comments ───
function CommentDrawer({
  query,
  comments,
  onAddComment,
  onClose,
}: {
  query: QueryShape;
  comments: QueryComment[];
  onAddComment?: (queryId: string, queryTitle: string, text: string, attachments?: string[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  useFocusTrap(containerRef, true, onClose);

  // Show only comments belonging to the query the user clicked from.
  const queryComments = comments.filter(c => c.queryId === query.id);
  const totalComments = queryComments.length;

  // Coarse date buckets from the relative timestamp string, mirroring the
  // Report Activity Log so both comment surfaces read the same.
  const bucketOf = (ts: string): 'Today' | 'Yesterday' | 'Earlier' => {
    const t = ts.toLowerCase();
    if (/just now|second|minute|hour|today/.test(t)) return 'Today';
    if (/^1\s*day|yesterday/.test(t)) return 'Yesterday';
    return 'Earlier';
  };
  const sortedComments = [...queryComments].reverse();
  const dateGroups = (['Today', 'Yesterday', 'Earlier'] as const)
    .map(label => ({ label, items: sortedComments.filter(c => bucketOf(c.timestamp) === label) }))
    .filter(g => g.items.length > 0);

  const handlePost = () => {
    const body = text.trim();
    if (!body || isPosting) return;
    setIsPosting(true);
    // Optimistic — clear inputs immediately so the new entry appears posted.
    onAddComment?.(query.id, query.title, body, attachments.length ? attachments : undefined);
    setText('');
    setAttachments([]);
    // Release the busy state on the next frame; the parent state update has
    // already flushed by then.
    window.setTimeout(() => setIsPosting(false), 120);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px] z-50"
        onClick={onClose}
      />
      <motion.aside
        ref={(el) => { containerRef.current = el as HTMLElement | null; }}
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-white shadow-xl border-l border-canvas-border flex flex-col z-[60]"
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
      >
        {/* Header — icon tile + title + count, matching the Report Activity Log */}
        <header className="group shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-md bg-brand-600/10 text-brand-600 flex items-center justify-center shrink-0">
              <MessageSquare size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[1rem] font-semibold text-ink-800 leading-tight">Comments</h2>
                {totalComments > 0 && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 520, damping: 24 }}
                    className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-semibold tabular-nums"
                  >
                    {totalComments}
                  </motion.span>
                )}
              </div>
              <p title={`On ${query.id} — ${query.title}`} className="text-[0.75rem] text-ink-400 mt-0.5 leading-snug line-clamp-1 group-hover:line-clamp-none transition-all">
                On <span className="font-mono font-semibold text-brand-600">{query.id}</span> — {query.title}
              </p>
            </div>
          </div>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="w-8 h-8 rounded-full text-ink-400 hover:text-ink-800 hover:bg-brand-50 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </motion.button>
        </header>

        <>
            {/* Composer — bordered card with inner toolbar, matching the activity log */}
            <section className="shrink-0 px-6 py-4 border-b border-canvas-border bg-canvas">
              <div className="bg-white border border-canvas-border rounded-lg focus-within:border-brand-600/40 focus-within:ring-2 focus-within:ring-brand-600/15 transition-all overflow-hidden">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handlePost(); } }}
                  placeholder={`Leave a comment on ${query.id}…`}
                  rows={3}
                  className="w-full resize-none bg-transparent border-0 px-3 pt-3 pb-1.5 text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-0"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const names = Array.from(e.target.files ?? []).map(f => f.name);
                    if (names.length) setAttachments(prev => [...prev, ...names.filter(n => !prev.includes(n))]);
                    e.target.value = '';
                  }}
                />
                <AnimatePresence>
                  {attachments.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                        {attachments.map((name) => (
                          <span key={name} className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1.5 bg-brand-50 text-brand-700 text-[0.6875rem] font-medium rounded-full">
                            <Paperclip size={12} />
                            <span className="truncate max-w-[180px]">{name}</span>
                            <button onClick={() => setAttachments(prev => prev.filter(n => n !== name))} className="ml-0.5 text-brand-700/60 hover:text-brand-700 cursor-pointer" aria-label={`Remove ${name}`}>
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex items-center justify-between px-2 py-2 border-t border-canvas-border/60">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                    aria-label="Attach file"
                    title="Attach file"
                  >
                    <Paperclip size={15} />
                  </motion.button>
                  <motion.button
                    onClick={handlePost}
                    disabled={!text.trim() || isPosting}
                    whileTap={text.trim() && !isPosting ? { scale: 0.96 } : undefined}
                    title="Post comment (⌘↵)"
                    className={`inline-flex items-center gap-1.5 h-8 px-4 text-[0.75rem] font-semibold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 ${
                      text.trim() && !isPosting
                        ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer'
                        : 'bg-brand-600/40 text-white/80 cursor-not-allowed'
                    }`}
                  >
                    {isPosting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    {isPosting ? 'Posting…' : 'Post'}
                  </motion.button>
                </div>
              </div>
            </section>

            {/* Feed — date-bucketed spine timeline, matching the Report Activity Log */}
            <div className="flex-1 overflow-y-auto px-6 py-5 bg-white" aria-live="polite">
              {totalComments === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No comments yet"
                  body="Notes, questions, and decisions on this query will appear here."
                  size="compact"
                />
              ) : (
                <div className="relative">
                  <span aria-hidden className="absolute left-[15px] top-1 bottom-1 w-px bg-canvas-border" />
                  <div className="space-y-6">
                    {dateGroups.map(group => (
                      <section key={group.label}>
                        <div className="flex items-center gap-2.5 mb-3 pl-[46px]">
                          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">{group.label}</h3>
                          <div className="flex-1 h-px bg-canvas-border/70" />
                          <span className="text-[0.625rem] tabular-nums text-ink-300">
                            {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                          </span>
                        </div>
                        <ol className="space-y-5">
                          {group.items.map(c => {
                            const isLong = c.text.length > 1000;
                            const isExpanded = expandedComments.has(c.id);
                            const displayText = isLong && !isExpanded ? c.text.slice(0, 1000) + '…' : c.text;
                            const files = c.attachments ?? (c.attachment ? [c.attachment] : []);
                            return (
                              <li key={c.id} className="relative flex gap-3.5">
                                <div className="relative z-[1] shrink-0 w-8 h-8 rounded-full bg-brand-600/10 text-brand-700 ring-[3px] ring-white flex items-center justify-center text-[0.625rem] font-semibold tracking-tight">
                                  {c.initials}
                                </div>
                                <div className="flex-1 min-w-0 pb-0.5">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-[0.8125rem] font-semibold text-ink-800 truncate">{c.author}</span>
                                    <span className="ml-auto text-[0.6875rem] text-ink-400 tabular-nums whitespace-nowrap">{c.timestamp}</span>
                                  </div>
                                  <p className="mt-1.5 text-[0.8125rem] text-ink-700 leading-relaxed whitespace-pre-wrap break-words">{displayText}</p>
                                  {isLong && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedComments(prev => {
                                        const next = new Set(prev);
                                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                                        return next;
                                      })}
                                      className="mt-1 text-[0.6875rem] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded"
                                    >
                                      {isExpanded ? 'Show less' : 'Show more'}
                                    </button>
                                  )}
                                  {files.length > 0 && (
                                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                                      {files.map((file) => (
                                        <span key={file} className="inline-flex items-center max-w-full h-7 bg-canvas border border-canvas-border rounded-[7px] overflow-hidden text-[0.6875rem] font-medium text-ink-700">
                                          <button
                                            onClick={() => openAttachment(file)}
                                            title={`Open ${file} in a new tab`}
                                            className="inline-flex items-center gap-1.5 min-w-0 h-full pl-2.5 pr-2 hover:text-brand-700 hover:bg-white transition-colors cursor-pointer"
                                          >
                                            <Paperclip size={12} className="text-ink-400 shrink-0" />
                                            <span className="truncate">{file}</span>
                                          </button>
                                          <button
                                            onClick={() => downloadAttachment(file)}
                                            title={`Download ${file}`}
                                            aria-label={`Download ${file}`}
                                            className="inline-flex items-center justify-center h-full w-7 border-l border-canvas-border text-ink-400 hover:text-brand-700 hover:bg-white transition-colors cursor-pointer shrink-0"
                                          >
                                            <Download size={12} />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
      </motion.aside>
    </>
  );
}

// ─── Draggable query section (main content area reorder) ───
type SectionProps = {
  // `key` is never passed through props (React strips it); callers set it
  // directly on each element. Kept optional so the shared props object type-checks.
  key?: string;
  value: unknown;
  id: string;
  layout: true;
  initial: { opacity: number; y: number };
  animate: { opacity: number; y: number };
  exit: { opacity: number; y: number; scale: number };
  transition: { duration: number; ease: [number, number, number, number] };
  className: string;
  dragListener: false;
};


// ─── Report-level Activity Log Drawer ───
// Shows every comment / action across every query card on the report,
// chronologically, with a comment box at the top for new entries.
function ReportActivityLogDrawer({
  reportName,
  comments,
  onAddComment,
  onClose,
}: {
  reportName: string;
  comments: QueryComment[];
  onAddComment?: (queryId: string, queryTitle: string, text: string, attachments?: string[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  useFocusTrap(containerRef, true, onClose);

  // Newest first.
  const sorted = [...comments].reverse();

  // Coarse date buckets derived from the relative timestamp string — entries
  // only carry a relative label ("5 hours ago"), so bucket by keyword.
  const bucketOf = (ts: string): 'Today' | 'Yesterday' | 'Earlier' => {
    const t = ts.toLowerCase();
    if (/just now|second|minute|hour|today/.test(t)) return 'Today';
    if (/^1\s*day|yesterday/.test(t)) return 'Yesterday';
    return 'Earlier';
  };
  const grouped = (['Today', 'Yesterday', 'Earlier'] as const)
    .map(label => ({ label, items: sorted.filter(c => bucketOf(c.timestamp) === label) }))
    .filter(g => g.items.length > 0);

  const handlePost = () => {
    const body = text.trim();
    if (!body || isPosting) return;
    setIsPosting(true);
    // Report-level entries are tagged as global so they show across all surfaces.
    onAddComment?.('REPORT', `${reportName} — Report-level note`, body, attachments.length ? attachments : undefined);
    setText('');
    setAttachments([]);
    window.setTimeout(() => setIsPosting(false), 120);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px] z-50"
        onClick={onClose}
      />
      <motion.aside
        ref={(el) => { containerRef.current = el as HTMLElement | null; }}
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="font-sans fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-white shadow-xl border-l border-canvas-border flex flex-col z-[60]"
        role="dialog"
        aria-modal="true"
        aria-label="Report activity log"
      >
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-brand-600/10 text-brand-600 flex items-center justify-center shrink-0">
              <History size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[1rem] font-semibold text-ink-800 leading-tight">Report Activity Log</h2>
                {sorted.length > 0 && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 520, damping: 24 }}
                    className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-semibold tabular-nums"
                  >
                    {sorted.length}
                  </motion.span>
                )}
              </div>
              <p className="text-[0.75rem] text-ink-400 mt-0.5 leading-snug">
                All actions and comments across every query card on this report.
              </p>
            </div>
          </div>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="w-8 h-8 rounded-full text-ink-400 hover:text-ink-800 hover:bg-brand-50 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </motion.button>
        </header>

        {/* Comment composer — textarea + inline toolbar (attach · post) */}
        <section className="shrink-0 px-6 py-4 border-b border-canvas-border bg-canvas">
          <div className="bg-white border border-canvas-border rounded-lg focus-within:border-brand-600/40 focus-within:ring-2 focus-within:ring-brand-600/15 transition-all overflow-hidden">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handlePost(); }
              }}
              placeholder="Add a comment to the report activity log…"
              rows={3}
              className="w-full resize-none bg-transparent border-0 px-3 pt-3 pb-1.5 text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-0"
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const names = Array.from(e.target.files ?? []).map(f => f.name);
                if (names.length) setAttachments(prev => [...prev, ...names.filter(n => !prev.includes(n))]);
                e.target.value = '';
              }}
            />
            <AnimatePresence>
              {attachments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                    {attachments.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1.5 bg-brand-50 text-brand-700 text-[0.6875rem] font-medium rounded-full">
                        <Paperclip size={12} />
                        <span className="truncate max-w-[180px]">{name}</span>
                        <button onClick={() => setAttachments(prev => prev.filter(n => n !== name))} className="ml-0.5 text-brand-700/60 hover:text-brand-700 cursor-pointer" aria-label={`Remove ${name}`}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex items-center justify-between px-2 py-2 border-t border-canvas-border/60">
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                aria-label="Attach file"
                title="Attach file"
              >
                <Paperclip size={15} />
              </motion.button>
              <motion.button
                onClick={handlePost}
                disabled={!text.trim() || isPosting}
                whileTap={text.trim() && !isPosting ? { scale: 0.96 } : undefined}
                title="Post comment (⌘↵)"
                className={`inline-flex items-center gap-1.5 h-8 px-4 text-[0.75rem] font-semibold rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 ${
                  text.trim() && !isPosting
                    ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer'
                    : 'bg-brand-600/40 text-white/80 cursor-not-allowed'
                }`}
              >
                {isPosting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {isPosting ? 'Posting…' : 'Post'}
              </motion.button>
            </div>
          </div>
        </section>

        {/* Activity feed — vertical timeline grouped by date */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-white" aria-live="polite">
          {sorted.length === 0 ? (
            <EmptyState
              icon={History}
              title="No activity yet"
              body="Edits, comments, and downloads will be tracked here."
              size="compact"
            />
          ) : (
            <div className="relative">
              {/* one continuous spine threading every node — draws in on open */}
              <motion.span
                aria-hidden
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
                className="absolute left-[15px] top-1 bottom-1 w-px origin-top bg-canvas-border"
              />
              <div className="space-y-6">
                {grouped.map((group, gi) => {
                  const offset = grouped.slice(0, gi).reduce((n, g) => n + g.items.length, 0);
                  return (
                  <section key={group.label}>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.04 * offset }}
                      className="flex items-center gap-2.5 mb-3 pl-[46px]"
                    >
                      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">{group.label}</h3>
                      <div className="flex-1 h-px bg-canvas-border/70" />
                      <span className="text-[0.625rem] tabular-nums text-ink-300">
                        {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                      </span>
                    </motion.div>
                    <ol className="space-y-5">
                      {group.items.map((c, ii) => {
                        const idx = offset + ii;
                        const files = c.attachments ?? (c.attachment ? [c.attachment] : []);
                        return (
                        <motion.li
                          key={c.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28, delay: 0.04 * idx + 0.08, ease: [0.2, 0, 0, 1] }}
                          className="relative flex gap-3.5"
                        >
                          <motion.div
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.04 * idx + 0.12, type: 'spring', stiffness: 480, damping: 28 }}
                            className="relative z-[1] shrink-0 w-8 h-8 rounded-full bg-brand-600/10 text-brand-700 ring-[3px] ring-white flex items-center justify-center text-[0.625rem] font-semibold tracking-tight"
                          >
                            {c.initials}
                          </motion.div>
                          <div className="flex-1 min-w-0 pb-0.5">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[0.8125rem] font-semibold text-ink-800 truncate">{c.author}</span>
                              <span className="ml-auto text-[0.6875rem] text-ink-400 tabular-nums whitespace-nowrap">{c.timestamp}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-ink-400 min-w-0">
                              <span className="inline-flex items-center h-[18px] px-1.5 font-mono font-semibold text-[0.625rem] bg-brand-50 text-brand-700 rounded-sm shrink-0">
                                {c.queryId}
                              </span>
                              <span className="truncate">{c.queryTitle}</span>
                            </div>
                            <p className="mt-2 text-[0.8125rem] text-ink-700 leading-relaxed">{c.text}</p>
                            {files.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {files.map((file) => (
                                  <span key={file} className="inline-flex items-center max-w-full h-7 bg-canvas border border-canvas-border rounded-[7px] overflow-hidden text-[0.6875rem] font-medium text-ink-700">
                                    <button
                                      onClick={() => openAttachment(file)}
                                      title={`Open ${file} in a new tab`}
                                      className="inline-flex items-center gap-1.5 min-w-0 h-full pl-2.5 pr-2 hover:text-brand-700 hover:bg-white transition-colors cursor-pointer"
                                    >
                                      <Paperclip size={12} className="text-ink-400 shrink-0" />
                                      <span className="truncate">{file}</span>
                                    </button>
                                    <button
                                      onClick={() => downloadAttachment(file)}
                                      title={`Download ${file}`}
                                      aria-label={`Download ${file}`}
                                      className="inline-flex items-center justify-center h-full w-7 border-l border-canvas-border text-ink-400 hover:text-brand-700 hover:bg-white transition-colors cursor-pointer shrink-0"
                                    >
                                      <Download size={12} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.li>
                        );
                      })}
                    </ol>
                  </section>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}

// Single row in the Contents table-of-contents block.
// Owns its own dragControls so each row is drag-handle-driven (not drag-on-row).
function ContentsRow({
  section,
  index,
  isEditing,
  draftValue,
  onDraftChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onScroll,
  onDelete,
  active = false,
}: {
  section: { id: string; title: string; kind: string };
  index: number;
  isEditing: boolean;
  draftValue: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onScroll: () => void;
  onDelete: () => void;
  active?: boolean;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={section}
      dragControls={controls}
      className={`group/crow relative flex items-center gap-1.5 py-2 pl-1 pr-1 rounded-md transition-colors list-none cursor-default ${active ? 'bg-brand-50' : 'hover:bg-brand-50/30'}`}
      dragListener={false}
    >
      <button
        onPointerDown={(e) => { controls.start(e); }}
        aria-label="Drag to reorder"
        className="shrink-0 p-0.5 text-ink-400/40 hover:text-ink-400 cursor-grab active:cursor-grabbing opacity-0 group-hover/crow:opacity-100 transition-opacity touch-none"
      >
        <GripVertical size={13} />
      </button>
      <span className="shrink-0 w-5 text-[0.6875rem] font-semibold font-mono tabular-nums text-right" style={{ color: 'var(--rep-accent, #550fa5)', opacity: active ? 1 : 0.65 }}>{String(index).padStart(2, '0')}</span>
      {isEditing ? (
        <input
          value={draftValue}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onSaveEdit(); }
            else if (e.key === 'Escape') { e.preventDefault(); onCancelEdit(); }
          }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-white border border-brand-600/40 rounded-md px-2 py-1 text-[0.8125rem] text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-600/15"
        />
      ) : (
        <button
          onClick={onScroll}
          aria-current={active ? 'true' : undefined}
          className={`flex-1 min-w-0 text-left text-[0.8125rem] truncate transition-colors cursor-pointer ${active ? 'font-semibold text-brand-700' : 'font-medium text-ink-600 group-hover/crow:text-brand-700'}`}
        >
          {section.title}
        </button>
      )}
      {!isEditing && (
        <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover/crow:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            aria-label="Rename section"
            className="p-1.5 rounded-md text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete section"
            className="p-1.5 rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </Reorder.Item>
  );
}

function ObservationActionsMenu({
  hasAttachment,
  attachmentHidden,
  onEdit,
  onToggleAttachment,
  onDelete,
}: {
  hasAttachment: boolean;
  attachmentHidden: boolean;
  onEdit: () => void;
  onToggleAttachment: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // Portal-positioned menu — escapes ancestor `overflow-hidden` + stacking contexts,
  // and flips up when the trigger is too close to the viewport bottom.
  const handleToggle = () => {
    const next = !open;
    if (next && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = hasAttachment ? 160 : 120;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < estimatedHeight + 16;
      const style: React.CSSProperties = {
        position: 'fixed',
        right: window.innerWidth - rect.right,
        zIndex: 1000,
      };
      if (flipUp) {
        style.bottom = window.innerHeight - rect.top + 6;
      } else {
        style.top = rect.bottom + 6;
      }
      setMenuStyle(style);
    }
    setOpen(next);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        title="More options"
        aria-label="More options"
        className="w-8 h-8 flex items-center justify-center rounded-md text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
      >
        <MoreVertical size={16} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="w-[210px] bg-white border border-canvas-border rounded-md shadow-xl py-1"
        >
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-[0.75rem] text-ink-500 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"
          >
            <Edit3 size={14} />
            Edit observation
          </button>
          {hasAttachment && (
            <button
              onClick={() => { setOpen(false); onToggleAttachment(); }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-[0.75rem] text-ink-500 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"
            >
              {attachmentHidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {attachmentHidden ? 'Show attachment' : 'Hide attachment'}
            </button>
          )}
          <div className="my-1 border-t border-canvas-border/60" />
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-[0.75rem] text-risk-700 hover:bg-risk-50 cursor-pointer"
          >
            <Trash2 size={14} />
            Delete observation
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

// Visual twin of QueryCard — same motion timing and type scale. Renders an
// observation as a flush continuous-sheet block when `attached` (the default,
// sitting beside QueryCards) or as a standalone bordered card otherwise.
function ObservationCard({
  obs,
  index,
  onEdit,
  onToggleAttachment,
  onDelete,
  attached = true,
}: {
  obs: { id: string; obsId: string; title: string; description: string; attachments?: ObservationAttachment[]; attachmentHidden?: boolean };
  index: number;
  onEdit: () => void;
  onToggleAttachment: () => void;
  onDelete: () => void;
  attached?: boolean;
}) {
  const attachments = obs.attachments ?? [];
  const visibleAttachments = obs.attachmentHidden ? [] : attachments;
  const imageAttachments = visibleAttachments.filter(a => isImageMime(a.mimeType));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const baseDelay = index * 0.08;

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex(i => (i === null ? i : (i + 1) % imageAttachments.length));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex(i => (i === null ? i : (i - 1 + imageAttachments.length) % imageAttachments.length));
      }
    };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIndex, imageAttachments.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: baseDelay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`relative bg-white overflow-hidden ${attached ? 'border-x border-canvas-border' : 'border border-canvas-border rounded-lg'}`}
    >
      <div className="px-6 py-5">
        {/* Meta row — mirrors QueryCard */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.15, duration: 0.35 }}
          className="flex items-center justify-between mb-4 gap-4"
        >
          <div className="flex items-center gap-2.5 text-[0.6875rem] min-w-0">
            <span className="font-bold text-brand-600 uppercase tracking-wider shrink-0">{obs.obsId}</span>
            <span className="w-px h-3 bg-border-light shrink-0" />
            <span className="font-medium text-ink-400 uppercase tracking-wider shrink-0">Observation</span>
          </div>
          <ObservationActionsMenu
            hasAttachment={attachments.length > 0}
            attachmentHidden={!!obs.attachmentHidden}
            onEdit={onEdit}
            onToggleAttachment={onToggleAttachment}
            onDelete={onDelete}
          />
        </motion.div>

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.2, duration: 0.35 }}
          className="text-[0.9375rem] font-semibold text-ink-800 leading-[1.5] mb-5"
        >
          {obs.title}
        </motion.h3>

        {/* Description */}
        {obs.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: baseDelay + 0.4, duration: 0.4 }}
            className="text-[0.8125rem] text-ink-500 leading-relaxed mb-4 whitespace-pre-wrap"
          >
            {obs.description}
          </motion.p>
        )}

        {/* Attachments — images as thumbnails (open lightbox with prev/next
            across image siblings), non-images as chip rows that open the
            data URL in a new tab so the browser previews / downloads. */}
        {visibleAttachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: baseDelay + 0.5, duration: 0.35 }}
            className="flex flex-wrap gap-2.5"
          >
            {visibleAttachments.map((att) => {
              if (isImageMime(att.mimeType)) {
                const imageIdx = imageAttachments.findIndex(a => a.id === att.id);
                return (
                  <motion.button
                    key={att.id}
                    type="button"
                    onClick={() => setLightboxIndex(imageIdx)}
                    whileHover={{ scale: 1.02 }}
                    title={`${att.name} — click to view full size`}
                    aria-label={`Open ${att.name} in full screen`}
                    className="block w-[88px] h-[88px] rounded-lg border border-canvas-border overflow-hidden bg-canvas cursor-zoom-in hover:border-brand-600/40 transition-colors"
                  >
                    <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                  </motion.button>
                );
              }
              const { Icon, tone } = attachmentVisual(att.mimeType);
              const inlineMime = att.mimeType === 'application/pdf';
              return (
                <a
                  key={att.id}
                  href={att.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={inlineMime ? undefined : att.name}
                  title={`${att.name} — ${formatFileSize(att.size)}`}
                  className="inline-flex items-center gap-2 max-w-[260px] h-[36px] px-2.5 bg-canvas border border-canvas-border rounded-md hover:border-brand-600/40 hover:bg-white transition-colors group"
                >
                  <Icon size={14} className={`shrink-0 ${tone}`} />
                  <span className="text-[0.75rem] text-ink-800 font-medium truncate group-hover:text-brand-600">{att.name}</span>
                  <span className="text-[0.625rem] text-ink-400 tabular-nums shrink-0">{formatFileSize(att.size)}</span>
                </a>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Fullscreen lightbox — only fires for image attachments. */}
      {lightboxIndex !== null && imageAttachments[lightboxIndex] && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-[70] bg-ink-900/85 flex items-center justify-center p-8 cursor-zoom-out"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            aria-label="Close preview"
            className="absolute top-5 right-5 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer backdrop-blur-sm"
          >
            <X size={20} />
          </button>
          {imageAttachments.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(i => (i === null ? i : (i - 1 + imageAttachments.length) % imageAttachments.length));
                }}
                aria-label="Previous image"
                className="absolute left-5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer backdrop-blur-sm"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(i => (i === null ? i : (i + 1) % imageAttachments.length));
                }}
                aria-label="Next image"
                className="absolute right-5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer backdrop-blur-sm"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <motion.img
            key={imageAttachments[lightboxIndex].id}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            src={imageAttachments[lightboxIndex].dataUrl}
            alt={imageAttachments[lightboxIndex].name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-xl cursor-default"
          />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[0.75rem] text-white/80 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm">
            <span>{obs.obsId}</span>
            <span className="text-white/40">·</span>
            <span>{imageAttachments[lightboxIndex].name}</span>
            {imageAttachments.length > 1 && (
              <>
                <span className="text-white/40">·</span>
                <span className="tabular-nums">{lightboxIndex + 1} / {imageAttachments.length}</span>
              </>
            )}
          </div>
        </motion.div>,
        document.body,
      )}
    </motion.div>
  );
}

// Section prose, controlled by the section's Edit toggle. Not editing → plain
// body copy. Editing → a textarea (⌘/Ctrl+Enter saves, Esc cancels) with
// Save/Cancel. The visible Edit affordance lives in the section header, so every
// template-generated section is edited the same way.
function EditableProse({
  value,
  editing,
  onSave,
  onCancel,
  textClassName,
}: {
  value: string;
  editing: boolean;
  onSave: (next: string) => void;
  onCancel: () => void;
  textClassName: string;
}) {
  const [draft, setDraft] = useState(value);
  // Esc discards the in-flight change; suppress the unmount blur that would
  // otherwise re-save it.
  const cancelledRef = useRef(false);

  // Seed the draft from the live value each time editing opens (so a Regenerate
  // that rewrote the summary underneath us is what the user starts from).
  useEffect(() => {
    if (editing) { setDraft(value); cancelledRef.current = false; }
  }, [editing, value]);

  if (!editing) return <p className={textClassName}>{value}</p>;

  const commit = () => {
    if (cancelledRef.current) return;
    const trimmed = draft.trim();
    onSave(trimmed.length ? trimmed : value);
  };

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        autoFocus
        rows={Math.max(3, Math.ceil(draft.length / 88))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); cancelledRef.current = true; onCancel(); }
        }}
        className="w-full max-w-[80ch] resize-y rounded-md border border-brand-600/40 bg-white px-3 py-2.5 text-[1.0625rem] text-ink-800 leading-[1.8] focus:outline-none focus:ring-2 focus:ring-brand-600/15"
      />
      <p className="mt-1.5 text-[0.6875rem] text-ink-400">Edits save as you go. Press Done when finished, or Esc to discard this change.</p>
    </div>
  );
}

// The visible per-section Edit / Done toggle shown in every section header.
function SectionEditToggle({ editing, onToggle }: { editing: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={editing}
      className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 text-[0.75rem] font-semibold rounded-md border transition-colors cursor-pointer ${
        editing
          ? 'text-white bg-brand-600 border-brand-600 hover:bg-brand-700'
          : 'text-brand-600 bg-brand-50 border-brand-600/20 hover:bg-brand-50/70 hover:border-brand-600/35'
      }`}
    >
      {editing ? <><Check size={14} /> Done</> : <><Edit3 size={13} /> Edit</>}
    </button>
  );
}

// Bulk-audit counterpart of QueryCard. Same chrome (continuous-sheet block,
// motion stagger, meta row with primary id, generate-cases gate) but the body
// is workflow-shaped: severity, optional risk owner, findings, observations,
// and an output data table from the run.
function WorkflowResultCard({
  workflow,
  index,
  casesPhase,
  onCasesPhaseChange,
  onUpdateRiskOwner,
  onDelete,
}: {
  workflow: WorkflowResult;
  index: number;
  casesPhase: CasesPhase;
  onCasesPhaseChange: (phase: CasesPhase) => void;
  onUpdateRiskOwner?: (owner: string) => void;
  onDelete?: () => void;
}) {
  const { addToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState(workflow.riskOwner ?? '');
  const menuRef = useRef<HTMLDivElement>(null);
  const baseDelay = index * 0.08;

  const severityStyle = workflow.severity === 'High'
    ? { pill: 'bg-risk-50 text-risk-700', dot: 'bg-risk-500' }
    : workflow.severity === 'Medium'
      ? { pill: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated-500' }
      : { pill: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant-500' };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const commitOwner = () => {
    const trimmed = ownerDraft.trim();
    onUpdateRiskOwner?.(trimmed);
    setEditingOwner(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: baseDelay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative border-x border-canvas-border bg-white overflow-hidden"
    >
      <div className="px-9 py-7">
        {/* Meta row */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.15, duration: 0.35 }}
          className="flex items-center justify-between mb-4 gap-4"
        >
          <div className="flex items-center gap-2.5 text-[0.6875rem] min-w-0">
            <span className="font-bold text-brand-600 uppercase tracking-wider shrink-0">Workflow · {workflow.workflowId}</span>
            {workflow.businessProcess && (
              <>
                <span className="w-px h-3 bg-border-light shrink-0" />
                <span className="font-medium text-ink-400 uppercase tracking-wider shrink-0">{workflow.businessProcess}</span>
              </>
            )}
            <span className="w-px h-3 bg-border-light shrink-0" />
            <span className="flex items-center gap-1.5 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${severityStyle.dot}`} />
              <span className={`font-semibold uppercase tracking-wider ${workflow.severity === 'High' ? 'text-risk-700' : workflow.severity === 'Medium' ? 'text-mitigated-700' : 'text-compliant-700'}`}>{workflow.severity}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <GenerateCasesGate queryId={workflow.id} phase={casesPhase} onPhaseChange={onCasesPhaseChange} />
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                title="More options"
                aria-label="More options"
                className="w-8 h-8 flex items-center justify-center rounded-md text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-10 w-[200px] bg-white border border-canvas-border rounded-md shadow-xl py-1">
                  {onDelete && (
                    <button
                      onClick={() => { setMenuOpen(false); onDelete(); }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[0.75rem] text-risk-700 hover:bg-risk-50 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Title row: workflow name + inline risk owner */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.2, duration: 0.35 }}
          className="mb-5"
        >
          <h3 className="text-[0.9375rem] font-semibold text-ink-800 leading-[1.5] mb-2">
            {workflow.name}
          </h3>

          {/* Risk owner — inline editable. Filled state renders as initials chip + name; empty state stays understated. */}
          <div className="flex items-center gap-2 text-[0.75rem]">
            <span className="text-ink-400">Risk owner</span>
            {editingOwner ? (
              <input
                autoFocus
                value={ownerDraft}
                onChange={(e) => setOwnerDraft(e.target.value)}
                onBlur={commitOwner}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitOwner();
                  if (e.key === 'Escape') { setOwnerDraft(workflow.riskOwner ?? ''); setEditingOwner(false); }
                }}
                placeholder="e.g., Priya Mehta"
                className="flex-1 max-w-[280px] px-2 py-1 text-[0.75rem] text-ink-800 border border-brand-600/40 rounded-md focus:outline-none focus:border-brand-600"
              />
            ) : workflow.riskOwner ? (
              <button
                onClick={() => { setOwnerDraft(workflow.riskOwner ?? ''); setEditingOwner(true); }}
                className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-brand-50 transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600/15 text-brand-600 text-[0.625rem] font-bold tabular-nums">
                  {workflow.riskOwner.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <span className="text-ink-800 font-medium">{workflow.riskOwner}</span>
              </button>
            ) : (
              <button
                onClick={() => { setOwnerDraft(''); setEditingOwner(true); }}
                className="text-ink-400 hover:text-brand-600 transition-colors cursor-pointer"
              >
                Unassigned · <span className="underline">assign</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Findings + Observations */}
        <div className="space-y-6 pt-1">
          {[
            { title: 'Findings', items: workflow.findings, emptyCopy: 'No findings recorded for this workflow yet.' },
            { title: 'Observations', items: workflow.observations, emptyCopy: 'No observations recorded for this workflow yet.' },
          ].map(section => (
            <div key={section.title}>
              <h4 className="flex items-center gap-2 text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-3">
                <span>{section.title}</span>
                {section.items.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-canvas text-ink-400 text-[0.625rem] font-semibold tabular-nums">
                    {section.items.length}
                  </span>
                )}
              </h4>
              {section.items.length === 0 ? (
                <p className="text-[0.75rem] text-ink-400 italic">{section.emptyCopy}</p>
              ) : (
                <ul className="space-y-2.5">
                  {section.items.map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: baseDelay + 0.4 + i * 0.05, duration: 0.3 }}
                      className="flex gap-2.5 text-[0.8125rem] text-ink-800 leading-relaxed"
                    >
                      <div className="w-1 h-1 rounded-full mt-2 shrink-0 bg-brand-600/60" />
                      {item}
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {/* Output table */}
          {workflow.outputTable && workflow.outputTable.rows.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-3">
                <span>Output</span>
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-canvas text-ink-400 text-[0.625rem] font-semibold tabular-nums">
                  {workflow.outputTable.rows.length}
                </span>
              </h4>
              <div className="border border-canvas-border rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-[0.75rem]">
                  <thead>
                    <tr className="bg-canvas/70">
                      {workflow.outputTable.columns.map((col, ci) => (
                        <th
                          key={col}
                          className={`px-3 py-2 text-[0.625rem] font-semibold text-ink-500 uppercase tracking-wider border-b border-canvas-border ${ci === workflow.outputTable!.columns.length - 1 ? 'text-right' : 'text-left'}`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workflow.outputTable.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-canvas-border/60 last:border-b-0 hover:bg-brand-50/30 transition-colors"
                      >
                        {row.map((cell, ci) => {
                          const cellStr = String(cell);
                          const isSeverity = cellStr === 'High' || cellStr === 'Medium' || cellStr === 'Low';
                          const isLast = ci === row.length - 1;
                          const isId = ci === 0;
                          return (
                            <td
                              key={ci}
                              className={`px-3 py-2 text-ink-800 ${isLast ? 'text-right' : ''} ${isId ? 'font-mono text-[0.75rem] text-ink-500 tabular-nums' : ''}`}
                            >
                              {isSeverity ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-[0.625rem] font-semibold ${
                                    cellStr === 'High'
                                      ? 'bg-risk-50 text-risk-700'
                                      : cellStr === 'Medium'
                                        ? 'bg-mitigated-50 text-mitigated-700'
                                        : 'bg-compliant-50 text-compliant-700'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      cellStr === 'High'
                                        ? 'bg-risk-500'
                                        : cellStr === 'Medium'
                                          ? 'bg-mitigated-500'
                                          : 'bg-compliant-500'
                                    }`}
                                  />
                                  {cellStr}
                                </span>
                              ) : (
                                cell
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-3 py-2 bg-canvas/40 border-t border-canvas-border/60 text-[0.6875rem] text-ink-400">
                  <span>{workflow.outputTable.rows.length} {workflow.outputTable.rows.length === 1 ? 'record' : 'records'}</span>
                  <button
                    onClick={() => addToast({ type: 'success', message: `Exporting ${workflow.workflowId} output as CSV…` })}
                    className="inline-flex items-center gap-1 text-brand-600 hover:underline cursor-pointer"
                  >
                    <Download size={12} />
                    Download CSV
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Shimmer placeholder shown while a query card streams in on report open.
// Mirrors QueryCard proportions (meta band · title · KPI row · body lines) so
// the resolve into real content reads as the same block filling in. Uses the
// app's standard `animate-pulse` + `bg-canvas-border` skeleton language.
function QueryCardSkeleton() {
  return (
    <div className="relative bg-white border border-canvas-border overflow-hidden" aria-hidden="true">
      <div className="px-9 py-7">
        {/* meta band */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="skeleton-cool h-4 w-10 rounded" />
          <div className="h-3.5 w-px bg-canvas-border" />
          <div className="skeleton-cool h-4 w-28 rounded" />
          <div className="skeleton-cool h-4 w-16 rounded" />
          <div className="skeleton-cool ml-auto h-6 w-6 rounded-full" />
        </div>
        {/* title */}
        <div className="skeleton-cool h-6 w-2/3 rounded mb-7" />
        {/* KPI bar — matches the live unified divided stat-bar */}
        <div className="overflow-hidden rounded-lg border border-canvas-border mb-7">
          <div className="-mt-px -ml-px grid grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, k) => (
              <div key={k} className="border-l border-t border-canvas-border px-5 py-6">
                <div className="skeleton-cool h-2.5 w-20 rounded" style={{ '--sk-delay': `${k * 70}ms` } as React.CSSProperties} />
                <div className="skeleton-cool h-8 w-16 rounded mt-4" style={{ '--sk-delay': `${k * 70 + 40}ms` } as React.CSSProperties} />
              </div>
            ))}
          </div>
        </div>
        {/* body lines */}
        <div className="space-y-2.5 max-w-[80ch]">
          <div className="skeleton-cool h-3.5 w-full rounded" />
          <div className="skeleton-cool h-3.5 w-[94%] rounded" />
          <div className="skeleton-cool h-3.5 w-[80%] rounded" />
        </div>
      </div>
    </div>
  );
}

function DraggableQuerySection({
  section,
  index,
  sectionProps,
  ready = true,
  onOpenQuery,
  onDelete,
  comments,
  onAddComment,
}: {
  section: { id: string; kind: 'query'; title: string; query: QueryShape };
  index: number;
  sectionProps: SectionProps;
  ready?: boolean;
  onOpenQuery?: (query: { id: string; title: string }) => void;
  onDelete: () => void;
  comments: QueryComment[];
  onAddComment: (queryId: string, queryTitle: string, text: string, attachments?: string[]) => void;
}) {
  return (
    <Reorder.Item {...sectionProps} className={`${sectionProps.className} relative`}>
      {ready ? (
        // index 0 → no section-index delay: the skeleton reveal already
        // staggers cards, so each resolves promptly (its own meta→title→KPI
        // cascade still plays) with no empty-card gap.
        <QueryCard
          query={section.query}
          index={0}
          title={section.title}
          onOpenQuery={onOpenQuery}
          onDelete={onDelete}
          comments={comments}
          onAddComment={onAddComment}
        />
      ) : (
        <QueryCardSkeleton />
      )}
    </Reorder.Item>
  );
}

// ─── Attached Query Card — compact pending card for queries the user just attached ───

// ─── Report View (with multiple queries) ───
export default function ReportView({ report, onBack, onShare, onOpenQuery, initialTemplate, customTemplates = [], onUpdateDescription, onUpdateSignoffs, onSaveAsTemplate, onSaveAtrVersion }: {
  report: GeneratedReport;
  onBack: () => void;
  onShare?: () => void;
  onManageExceptions?: () => void;
  onOpenQuery?: (query: { id: string; title: string }) => void;
  initialTemplate?: typeof REPORT_TEMPLATES[0] | null;
  customTemplates?: typeof REPORT_TEMPLATES[number][];
  onUpdateDescription?: (reportId: string, description: string) => void;
  /** Persist manual sign / sign-off state on the report. */
  onUpdateSignoffs?: (reportId: string, signoffs: Record<string, Signoff>) => void;
  onSaveAsTemplate?: (t: typeof REPORT_TEMPLATES[number]) => void;
  /** Save the Live ATR as a brand-new card in the ATR tab. */
  onSaveAtrVersion?: (label: string, data: AtrReportData) => void;
}) {
  const { addToast } = useToast();
  const { currentUser } = useCurrentUser();
  const logEvent = useAuditLog();
  // Manual sign-on / sign-off on the report's approval slots. Signing records
  // the slot's assigned name (or the current user) + today's date; signing off
  // clears it. Persisted via onUpdateSignoffs (no-op if the report is read-only).
  const canSignoff = !!onUpdateSignoffs && !report.isReadOnly;
  const handleSign = (slot: SignatorySlot) => {
    const signer = slot.name?.trim() || currentUser?.name || 'You';
    const signedAt = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    onUpdateSignoffs?.(report.id, { ...(report.signoffs ?? {}), [slot.id]: { signedBy: signer, signedAt } });
    addToast({ type: 'success', message: `Signed as ${signer}.` });
    recordActivity(`Signed “${slot.role}”`, [`${slot.role} signed by ${signer}`]);
  };
  const handleSignOff = (slot: SignatorySlot) => {
    const next = { ...(report.signoffs ?? {}) };
    delete next[slot.id];
    onUpdateSignoffs?.(report.id, next);
    addToast({ type: 'info', message: 'Sign-off removed.' });
    recordActivity(`Removed sign-off “${slot.role}”`);
  };
  const { can } = useCan();
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
  // One-time skeleton "stream-in" on open: query sections resolve from a
  // shimmer placeholder top-to-bottom. `revealStep` ticks up one section at a
  // time; section i is resolved once revealStep > i. Once it passes the section
  // count it stops, so any later additions render instantly (no skeleton).
  const [revealStep, setRevealStep] = useState(0);
  useEffect(() => {
    if (revealStep > sections.length) return;
    const t = window.setTimeout(() => setRevealStep(s => s + 1), revealStep === 0 ? 180 : 240);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealStep]);
  const sectionReady = (i: number) => revealStep > i;
  const [appliedTemplate, setAppliedTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(initialTemplate ?? null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  // QueryCard "Generate Cases" phase, lifted up so it survives template
  // switches that re-mount QueryCards. Keyed by query.id.
  const [casesPhases, setCasesPhases] = useState<Record<string, CasesPhase>>({});
  const setCasesPhase = (queryId: string, phase: CasesPhase) =>
    setCasesPhases(prev => ({ ...prev, [queryId]: phase }));
  // Local launch pulse — the whole report surface nudges right + dims when
  // the Manage Exceptions CTA fires, mirroring the new-tab launch.
  const [launching, setLaunching] = useState(false);
  useEffect(() => {
    const handler = () => {
      setLaunching(true);
      window.setTimeout(() => setLaunching(false), 420);
    };
    window.addEventListener('app:launch-pulse', handler);
    return () => window.removeEventListener('app:launch-pulse', handler);
  }, []);

  const applyTemplateNow = (template: typeof REPORT_TEMPLATES[0]) => {
    setApplyingTemplate(true);
    setTimeout(() => {
      setAppliedTemplate(template);
      setApplyingTemplate(false);
      addToast({ type: 'success', message: `Template "${template.name}" applied.` });
      recordActivity(`Applied template “${template.name}”`, [`Report reformatted to the “${template.name}” template`]);
    }, 800);
  };

  const handleApplyTemplate = (template: typeof REPORT_TEMPLATES[0]) => {
    setShowApplyTemplate(false);
    // Switching away from a template that's already applied replaces the
    // current layout and its sections, so confirm first. The first-time
    // apply (nothing applied yet, or re-picking the same one) is harmless.
    if (appliedTemplate && appliedTemplate.id !== template.id) {
      setPendingTemplate(template);
      return;
    }
    applyTemplateNow(template);
  };

  // Resolve the template this report was generated from — used to show the
  // Apply Template control as active. A report whose template has since been
  // deleted resolves to null, so the control simply shows no active template
  // rather than naming one nobody can open.
  const reportTemplate =
    REPORT_TEMPLATES.find(t => t.id === report.templateId) ??
    customTemplates.find(t => t.id === report.templateId) ??
    null;

  const displayDescription = report.description ?? reportTemplate?.desc ?? '';
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(displayDescription);

  const startEditDesc = () => {
    setDescDraft(displayDescription);
    setIsEditingDesc(true);
  };
  const cancelEditDesc = () => {
    setDescDraft(displayDescription);
    setIsEditingDesc(false);
  };
  const saveEditDesc = () => {
    const next = descDraft.trim();
    if (next !== displayDescription && onUpdateDescription) {
      onUpdateDescription(report.id, next);
      recordActivity('Edited report description');
    }
    setIsEditingDesc(false);
  };

  const EditableDescription = ({ onDark = false }: { onDark?: boolean } = {}) => {
    if (isEditingDesc) {
      return (
        <div className="mb-3">
          <textarea
            value={descDraft}
            onChange={e => setDescDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.preventDefault(); cancelEditDesc(); }
              else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveEditDesc(); }
            }}
            rows={2}
            placeholder="Add a description for this report…"
            autoFocus
            className="w-full bg-canvas border border-canvas-border rounded-md px-3 py-2 text-ink-800 text-[0.8125rem] leading-snug placeholder:text-ink-400 focus:outline-none focus:border-brand-400 focus:bg-white transition-colors resize-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={saveEditDesc}
              className="inline-flex items-center gap-1 h-7 px-3 bg-brand-600 text-white text-[0.6875rem] font-semibold rounded-md hover:bg-brand-700 transition-colors cursor-pointer"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={cancelEditDesc}
              className="h-7 px-2.5 text-ink-500 text-[0.6875rem] font-medium hover:text-ink-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <span className="text-ink-400 text-[0.625rem] ml-auto hidden sm:inline">⌘↵ Save · Esc Cancel</span>
          </div>
        </div>
      );
    }
    return (
      <div className="group/desc flex items-start gap-2 mb-3">
        <p
          title={displayDescription || undefined}
          className={`min-w-0 flex-1 text-[0.8125rem] leading-snug line-clamp-2 ${onDark ? 'text-white/75' : 'text-ink-500'}`}
        >
          {displayDescription || <span className={`italic ${onDark ? 'text-white/45' : 'text-ink-400'}`}>No description</span>}
        </p>
        <button
          onClick={startEditDesc}
          aria-label="Edit description"
          title="Edit description"
          className={`shrink-0 inline-flex items-center justify-center w-6 h-6 -mt-0.5 rounded-sm border opacity-0 group-hover/desc:opacity-100 focus-visible:opacity-100 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${onDark ? 'text-white/80 bg-white/10 border-white/25 hover:bg-white/20 hover:text-white focus-visible:ring-white/50' : 'text-ink-500 bg-canvas border-canvas-border hover:border-brand-300 hover:text-brand-700 focus-visible:ring-brand-600/30'}`}
        >
          <Edit3 size={13} />
        </button>
      </div>
    );
  };

  const DEFAULT_QUERIES = [
    {
      id: 'Q01', risk: 'Financial Risk', severity: 'High',
      ...REPORT_QUERIES_ATR.Q01,
      addedBy: report.generatedBy,
      kpis: [
        { label: 'Flagged By AI', value: '140', color: 'text-brand-600' },
        { label: 'Manually Flagged', value: '1', color: 'text-high-700' },
        { label: 'Resolved', value: '3', color: 'text-compliant-700' },
        { label: 'Pending', value: '136', color: 'text-risk-700' },
      ],
      chartData: [40, 55, 80, 65, 90, 75, 95, 70, 85, 100],
    },
    {
      id: 'Q02', risk: 'Compliance Risk', severity: 'High',
      ...REPORT_QUERIES_ATR.Q02,
      addedBy: 'AI Copilot',
      kpis: [
        { label: 'Changes Found', value: '47', color: 'text-brand-600' },
        { label: 'Unauthorized', value: '12', color: 'text-risk-700' },
        { label: 'Verified', value: '35', color: 'text-compliant-700' },
        { label: 'Pending', value: '8', color: 'text-high-700' },
      ],
      chartData: [20, 35, 25, 50, 40, 30, 45, 60, 55, 47],
    },
  ];

  // Template-specific report structures — each template reshapes the report content
  const TEMPLATE_QUERIES: Record<string, typeof DEFAULT_QUERIES> = {
    'rt-002': [ // Risk Assessment Summary
      {
        id: 'RA01', risk: 'Aggregate Risk', severity: 'High',
        ...REPORT_QUERIES_ATR.RA01,
        addedBy: report.generatedBy,
        kpis: [
          { label: 'Total Risks', value: '12', color: 'text-brand-600' },
          { label: 'High', value: '7', color: 'text-risk-700' },
          { label: 'Mitigated', value: '5', color: 'text-compliant-700' },
        ],
        chartData: [12, 10, 11, 9, 12, 10, 8, 12, 11, 12],
      },
      {
        id: 'RA02', risk: 'Mitigation Gap', severity: 'High',
        ...REPORT_QUERIES_ATR.RA02,
        addedBy: 'AI Copilot',
        kpis: [
          { label: 'Strategies Reviewed', value: '18', color: 'text-brand-600' },
          { label: 'Effective', value: '10', color: 'text-compliant-700' },
          { label: 'Partial', value: '5', color: 'text-mitigated-700' },
          { label: 'Ineffective', value: '3', color: 'text-risk-700' },
        ],
        chartData: [18, 16, 17, 15, 18, 14, 16, 18, 17, 18],
      },
    ],
    'rt-003': [ // Control Effectiveness Report
      {
        id: 'CE01', risk: 'Control Gap', severity: 'High',
        ...REPORT_QUERIES_ATR.CE01,
        addedBy: report.generatedBy,
        kpis: [
          { label: 'Controls Tested', value: '54', color: 'text-brand-600' },
          { label: 'Effective', value: '48', color: 'text-compliant-700' },
          { label: 'Deficient', value: '4', color: 'text-risk-700' },
          { label: 'Pending Test', value: '33', color: 'text-mitigated-700' },
        ],
        chartData: [48, 46, 47, 48, 45, 48, 47, 48, 46, 48],
      },
    ],
    'rt-004': [ // Workflow Analytics Report
      {
        id: 'WA01', risk: 'Operational Risk', severity: 'High',
        ...REPORT_QUERIES_ATR.WA01,
        addedBy: 'AI Copilot',
        kpis: [
          { label: 'Total Runs', value: '115', color: 'text-brand-600' },
          { label: 'Accuracy', value: '94.2%', color: 'text-compliant-700' },
          { label: 'Exceptions', value: '23', color: 'text-high-700' },
          { label: 'Avg Runtime', value: '1.8d', color: 'text-evidence-700' },
        ],
        chartData: [85, 88, 90, 87, 92, 94, 91, 93, 95, 94],
      },
      {
        id: 'WA02', risk: 'Processing Risk', severity: 'High',
        ...REPORT_QUERIES_ATR.WA02,
        addedBy: report.generatedBy,
        kpis: [
          { label: 'Exceptions', value: '23', color: 'text-brand-600' },
          { label: 'Auto-Resolved', value: '8', color: 'text-compliant-700' },
          { label: 'Manual Review', value: '12', color: 'text-mitigated-700' },
          { label: 'Escalated', value: '3', color: 'text-risk-700' },
        ],
        chartData: [5, 3, 6, 4, 2, 3, 5, 7, 4, 3],
      },
    ],
    'rt-006': [ // Executive Dashboard Export
      {
        id: 'EX01', risk: 'Strategic Risk', severity: 'High',
        ...REPORT_QUERIES_ATR.EX01,
        addedBy: report.generatedBy,
        kpis: [
          { label: 'Compliance', value: '94.2%', color: 'text-brand-600' },
          { label: 'Material Weakness', value: '2', color: 'text-risk-700' },
          { label: 'Cost Saved', value: '24L', color: 'text-compliant-700' },
          { label: 'Exposure', value: '18L', color: 'text-high-700' },
        ],
        chartData: [91, 91.5, 92, 92.3, 93, 93.2, 93.5, 93.8, 94, 94.2],
      },
    ],
  };

  const TEMPLATE_STATS: Record<string, { label: string; value: string; icon: React.ElementType; color: string }[]> = {
    'rt-002': [
      { label: 'Total Risks', value: '12', icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
      { label: 'Uncontrolled', value: '2', icon: Shield, color: 'text-risk-700 bg-risk-50' },
      { label: 'Mitigated', value: '5', icon: CheckCircle2, color: 'text-compliant-700 bg-compliant-50' },
      { label: 'Exposure', value: '18L', icon: TrendingUp, color: 'text-evidence-700 bg-evidence-50' },
    ],
    'rt-003': [
      { label: 'Controls Tested', value: '54', icon: Shield, color: 'text-evidence-700 bg-evidence-50' },
      { label: 'Effective', value: '48', icon: CheckCircle2, color: 'text-compliant-700 bg-compliant-50' },
      { label: 'Deficient', value: '4', icon: AlertTriangle, color: 'text-risk-700 bg-risk-50' },
      { label: 'Effectiveness Rate', value: '89%', icon: TrendingUp, color: 'text-brand-700 bg-brand-50' },
    ],
    'rt-004': [
      { label: 'Workflow Runs', value: '115', icon: TrendingUp, color: 'text-evidence-700 bg-evidence-50' },
      { label: 'Accuracy', value: '94.2%', icon: CheckCircle2, color: 'text-compliant-700 bg-compliant-50' },
      { label: 'Exceptions', value: '23', icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
      { label: 'Cost Saved', value: '24L', icon: Shield, color: 'text-brand-700 bg-brand-50' },
    ],
    'rt-006': [
      { label: 'Compliance Score', value: '94.2%', icon: Shield, color: 'text-brand-700 bg-brand-50' },
      { label: 'Material Weakness', value: '2', icon: AlertTriangle, color: 'text-risk-700 bg-risk-50' },
      { label: 'Cost Saved', value: '24L', icon: TrendingUp, color: 'text-compliant-700 bg-compliant-50' },
      { label: 'Risk Exposure', value: '18L', icon: FileText, color: 'text-high-700 bg-high-50' },
    ],
  };

  const activeQueries = appliedTemplate && TEMPLATE_QUERIES[appliedTemplate.id]
    ? TEMPLATE_QUERIES[appliedTemplate.id]
    : DEFAULT_QUERIES;

  const activeStats = (() => {
    if (appliedTemplate && TEMPLATE_STATS[appliedTemplate.id]) return TEMPLATE_STATS[appliedTemplate.id];
    if (report.tag === 'Bulk Audit' && (report.workflowResults?.length ?? 0) > 0) {
      const wr = report.workflowResults!;
      const totalRecords = wr.reduce((sum, w) => sum + (w.outputTable?.rows.length ?? 0), 0);
      const highCount = wr.filter(w => w.severity === 'High').length;
      const mediumCount = wr.filter(w => w.severity === 'Medium').length;
      return [
        { label: 'Workflows Run', value: String(wr.length), icon: Layers, color: 'text-brand-700 bg-brand-50' },
        { label: 'Records Flagged', value: String(totalRecords), icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
        { label: 'High Severity', value: String(highCount), icon: Shield, color: 'text-risk-700 bg-risk-50' },
        { label: 'Medium Severity', value: String(mediumCount), icon: TrendingUp, color: 'text-mitigated-700 bg-mitigated-50' },
      ];
    }
    return [
      { label: 'Total Exceptions', value: '187', icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
      { label: 'Closed', value: '38', icon: CheckCircle2, color: 'text-compliant-700 bg-compliant-50' },
      { label: 'High Risk', value: '12', icon: Shield, color: 'text-risk-700 bg-risk-50' },
      { label: 'Report Health', value: '78%', icon: TrendingUp, color: 'text-evidence-700 bg-evidence-50' },
    ];
  })();

  // Sections — reorderable / add / remove
  type SectionItem =
    | { id: string; kind: 'cover'; title: string }
    | { id: string; kind: 'summary'; title: string; content: string }
    | { id: string; kind: 'stats'; title: string }
    | { id: string; kind: 'query'; title: string; query: typeof DEFAULT_QUERIES[0] }
    | { id: string; kind: 'workflow'; title: string; workflow: WorkflowResult }
    | { id: string; kind: 'note'; title: string; content: string }
    | { id: string; kind: 'tblock'; title: string; tsec: TemplateSection; cards?: CardFinding[]; composed?: string }
    | { id: string; kind: 'observation'; title: string; obsId: string; description: string; attachments?: ObservationAttachment[]; attachmentHidden?: boolean };

  type ObservationItem = {
    id: string;
    kind: 'observation';
    title: string;
    obsId: string;
    description: string;
    attachments?: ObservationAttachment[];
    attachmentHidden?: boolean;
  };

  const isBulkAudit = report.tag === 'Bulk Audit';
  const reportWorkflows: WorkflowResult[] = report.workflowResults ?? [];
  // One block printed in two places is stored once. Placements resolve back to
  // that stored shape here, so both positions always print the same thing.
  const templateBlockLibrary = useMemo(
    () => collectBlockLibrary(report.templateSections ?? []),
    [report.templateSections],
  );
  // What a bound block reads: this report's findings, its numbers, its details.
  const reportFacts = useMemo(
    () => buildReportFacts(
      [...activeQueries, ...reportWorkflows.map(workflowToQueryDef)],
      report,
      activeStats,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeQueries, reportWorkflows, report, activeStats],
  );

  const buildInitialSections = (queries: typeof DEFAULT_QUERIES): SectionItem[] => {
    const head: SectionItem[] = [
      { id: 'sec-cover', kind: 'cover', title: 'Cover' },
      {
        id: 'sec-summary',
        kind: 'summary',
        title: 'Executive Summary',
        content: report.execSummary ?? (isBulkAudit
          ? `Bulk audit ran ${reportWorkflows.length} ${reportWorkflows.length === 1 ? 'workflow' : 'workflows'} across the supplied datasets. Flagged records have been grouped by severity for review; high-severity items should be triaged first.`
          : 'FY26 Q1 SOX compliance audit covered 87 controls across 4 business processes (P2P, O2C, R2R, S2C). 54 controls tested to date with 89% effectiveness rate. 2 material weaknesses identified requiring remediation before March 31 deadline. Overall compliance score: 94.2% — improved from 91.8% prior quarter.'),
      },
    ];
    if (isBulkAudit) {
      return [
        ...head,
        ...reportWorkflows.map(w => ({
          id: `sec-workflow-${w.id}`,
          kind: 'workflow' as const,
          title: `Workflow · ${w.workflowId}`,
          workflow: w,
        })),
      ];
    }
    const queryBlocks: SectionItem[] = queries.map(q => ({
      id: `sec-query-${q.id}`,
      kind: 'query' as const,
      title: `Query · ${q.id}`,
      query: q,
    }));

    // Bulk Audit sources contribute workflow result blocks — rendered with the
    // same WorkflowResultCard the Bulk Audit report uses — after the queries.
    const workflowBlocks: SectionItem[] = reportWorkflows.map(w => ({
      id: `sec-workflow-${w.id}`,
      kind: 'workflow' as const,
      title: `Workflow · ${w.workflowId}`,
      workflow: w,
    }));
    const bodyBlocks = [...queryBlocks, ...workflowBlocks];

    // Composed prose (template note sections) counts both queries and the
    // query-shaped projection of the workflow runs, so a workflow-driven
    // generation reads correctly even with zero queries.
    const evidence = [...queries, ...reportWorkflows.map(workflowToQueryDef)];

    // Wizard-generated reports bake the template's advertised sections into
    // the block stream as editable note blocks, so the generated report
    // delivers the structure the template card promises. The "anchor" section
    // (queries / testing results) heads the body; sections before it render
    // above the body, the rest below.
    const tmpl = (report.generatedQueries?.length || reportWorkflows.length) ? (report.templateSections ?? []) : [];
    if (tmpl.length > 0) {
      // The findings pool, flattened — stamped into repeating cards and linked
      // action-plan tables in the template's own shape and rating words.
      const generatedFacts = buildReportFacts(evidence, report, activeStats);
      const cardFindings: CardFinding[] = generatedFacts.findings;
      const cardsBlockOf = (s: TemplateSection) => s.blocks?.find(b => b.kind === 'cards');
      const cardsSec = tmpl.find(s => s.kind === 'cards' || cardsBlockOf(s));
      const cardsIdPattern = cardsSec ? (cardsSec.kind === 'cards' ? cardsSec.idPattern : cardsBlockOf(cardsSec)?.idPattern) : undefined;
      // A template with its own repeating finding cards carries the findings
      // there — the generic per-query body would duplicate them.
      const hasCards = !!cardsSec;
      const anchorIdx = tmpl.findIndex(s => s === cardsSec || /quer(y|ies)|testing results|findings/i.test(s.name));
      const pre: SectionItem[] = [];
      const post: SectionItem[] = [];
      tmpl.forEach((s, i) => {
        if (/executive summary/i.test(s.name)) return; // covered by the summary block
        // Route by what the section IS. Typed sections (BYOT blocks, legacy
        // kinds, fixed text, or any non-query fill) render through the block
        // renderer — manual stays honestly empty, human waits for a person,
        // fixed prints verbatim. Only query-filled prose is ever composed;
        // the AI never invents content for the other cases.
        const hasBlocks = (s.blocks?.length ?? 0) > 0;
        const typed = hasBlocks || (s.kind && s.kind !== 'text') || s.fixed || (s.fill && s.fill !== 'query');
        const wantsComposed = hasBlocks
          ? (s.blocks ?? []).some(b => (b.kind === 'narrative' || b.kind === 'callout') && b.fill === 'query')
          : !s.fill || s.fill === 'query';
        const needsCards = s.kind === 'cards' || (s.kind === 'table' && !!s.linkedTo) ||
          (s.blocks ?? []).some(b => b.kind === 'cards' || !!b.linkedTo);
        // A linked table borrows the cards' ID shape so its refs match.
        const patched: TemplateSection = hasBlocks
          ? { ...s, blocks: s.blocks!.map(b => (b.linkedTo && !b.idPattern ? { ...b, idPattern: cardsIdPattern } : b)) }
          : s.kind === 'table' && s.linkedTo && !s.idPattern ? { ...s, idPattern: cardsIdPattern } : s;
        const block: SectionItem = typed
          ? {
              id: `sec-tmpl-${i}`,
              kind: 'tblock',
              title: s.name,
              tsec: patched,
              cards: needsCards ? cardFindings : undefined,
              composed: wantsComposed ? composeSectionContent(s.name, evidence) : undefined,
            }
          : {
              id: `sec-tmpl-${i}`,
              kind: 'note',
              title: s.name,
              content: composeSectionContent(s.name, evidence),
            };
        if (i === anchorIdx || (anchorIdx !== -1 && i < anchorIdx)) pre.push(block);
        else post.push(block);
      });
      return hasCards ? [...head, ...pre, ...post] : [...head, ...pre, ...bodyBlocks, ...post];
    }

    return [...head, ...bodyBlocks];
  };

  // Wizard-generated reports carry their own query blocks; demo reports keep
  // the seeded defaults. A wizard report built from workflows only (no queries)
  // has an empty query set — don't fall back to the demo queries for it.
  const seededQueries: typeof DEFAULT_QUERIES = report.generatedQueries?.length
    ? report.generatedQueries
    : reportWorkflows.length
      ? []
      : DEFAULT_QUERIES;
  const [sections, setSections] = useState<SectionItem[]>(() => buildInitialSections(seededQueries));
  // Structure signature → drives the "report changed" gate. The baseline is
  // (re)captured whenever the report is freshly built/templated; once the user
  // reorders, adds, or removes sections the signature diverges and the
  // "Save current as template" affordance appears.
  const structureSig = (secs: SectionItem[]) => secs.filter(s => s.kind !== 'cover').map(s => `${s.kind}:${s.title ?? ''}`).join('|');
  const sectionsBaselineRef = useRef<string | null>(null);
  const structureChanged = sectionsBaselineRef.current !== null && structureSig(sections) !== sectionsBaselineRef.current;
  const appliedTemplateId = appliedTemplate?.id ?? null;

  // Summary lifecycle — "Generate Summary" (header) and "Regenerate" (section)
  // are the same control at two stages, so only one shows at a time: Generate
  // first, then Regenerate once a summary exists.
  const [summaryGenerated, setSummaryGenerated] = useState(false);
  // Regenerate summary mock — overrides the summary section's content with an
  // alternative blurb after a short simulated delay so the action feels real.
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
  const [summaryOverride, setSummaryOverride] = useState<string | null>(null);
  // Initial-generation loading flag: the summary prose is gated behind it so
  // "Generate Summary" produces a visible empty → loading → content transition.
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // ── "No data connected" is not a dead end (door 1): the user types or
  // pastes into the section's shape, and the text stays with this report.
  // Persisted per report so a reopen keeps the filled sections filled.
  const MANUAL_FILLS_KEY = 'irame.reports.manualFills.v1';
  const [manualFills, setManualFills] = useState<Record<string, string>>(() => {
    try {
      const all = JSON.parse(localStorage.getItem(MANUAL_FILLS_KEY) ?? '{}');
      return all[report.id] ?? {};
    } catch { return {}; }
  });
  // Sections already logged as hand-filled — the door-1 usage signal is one
  // entry per section, not one per keystroke. That log IS the ranked evidence
  // for which data integration to build next.
  const manualLoggedRef = useRef<Set<string>>(new Set());
  const setManualFill = (sectionId: string, text: string) =>
    setManualFills(prev => ({ ...prev, [sectionId]: text }));
  const commitManualFill = (sectionId: string, title: string) => {
    try {
      const all = JSON.parse(localStorage.getItem(MANUAL_FILLS_KEY) ?? '{}');
      all[report.id] = { ...(all[report.id] ?? {}), [sectionId]: manualFills[sectionId] ?? '' };
      localStorage.setItem(MANUAL_FILLS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
    if ((manualFills[sectionId] ?? '').trim() && !manualLoggedRef.current.has(sectionId)) {
      manualLoggedRef.current.add(sectionId);
      logEvent({
        action: 'Update',
        description: `Filled "${title}" manually in "${report.name}" — no connected data for this section yet`,
        module: 'Reports',
        entity: 'Manual section',
      });
    }
  };
  // ── Applied-template body is the user's to rewrite: the composed section
  // prose is a starting draft, not fixed copy. Edits are keyed per section and
  // persisted per report so a reopen keeps the rewritten copy.
  const SECTION_EDITS_KEY = 'irame.reports.sectionEdits.v1';
  const [sectionEdits, setSectionEdits] = useState<Record<string, string>>(() => {
    try {
      const all = JSON.parse(localStorage.getItem(SECTION_EDITS_KEY) ?? '{}');
      return all[report.id] ?? {};
    } catch { return {}; }
  });
  // Prose autosaves on blur, so persist quietly and log the edit once per
  // section rather than toasting on every keystroke-blur.
  const sectionLoggedRef = useRef<Set<string>>(new Set());
  const saveSectionEdit = (key: string, text: string, title: string) => {
    markSectionDirty(title);
    setSectionEdits(prev => (prev[key] === text ? prev : { ...prev, [key]: text }));
    try {
      const all = JSON.parse(localStorage.getItem(SECTION_EDITS_KEY) ?? '{}');
      all[report.id] = { ...(all[report.id] ?? {}), [key]: text };
      localStorage.setItem(SECTION_EDITS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
    if (!sectionLoggedRef.current.has(key)) {
      sectionLoggedRef.current.add(key);
      logEvent({
        action: 'Update',
        description: `Edited "${title}" content in "${report.name}"`,
        module: 'Reports',
        entity: 'Report section',
      });
    }
  };

  // Empty template tables are the user's to fill: rows typed straight into the
  // section's own columns, keyed per block and persisted per report like the
  // prose edits above. A logged usage signal fires once per table.
  const TABLE_EDITS_KEY = 'irame.reports.tableEdits.v1';
  const [tableEdits, setTableEdits] = useState<Record<string, string[][]>>(() => {
    try {
      const all = JSON.parse(localStorage.getItem(TABLE_EDITS_KEY) ?? '{}');
      return all[report.id] ?? {};
    } catch { return {}; }
  });
  const tableLoggedRef = useRef<Set<string>>(new Set());
  const saveTableEdit = (key: string, rows: string[][], title: string) => {
    markSectionDirty(title);
    setTableEdits(prev => ({ ...prev, [key]: rows }));
    try {
      const all = JSON.parse(localStorage.getItem(TABLE_EDITS_KEY) ?? '{}');
      all[report.id] = { ...(all[report.id] ?? {}), [key]: rows };
      localStorage.setItem(TABLE_EDITS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
    if (rows.length && !tableLoggedRef.current.has(key)) {
      tableLoggedRef.current.add(key);
      logEvent({
        action: 'Update',
        description: `Filled the "${title}" table manually in "${report.name}"`,
        module: 'Reports',
        entity: 'Report table',
      });
    }
  };
  // A table-fill controller scoped to one section, shared by both render paths.
  const makeTableFill = (sectionKey: string, title: string) => ({
    rowsFor: (blockIndex: number) => tableEdits[`${sectionKey}:tbl:${blockIndex}`],
    onSave: (blockIndex: number, _cols: string[], rows: string[][]) =>
      saveTableEdit(`${sectionKey}:tbl:${blockIndex}`, rows, title),
    readOnly: isReadOnly,
  });

  // Which sections are in edit mode. The visible Edit toggle in each section
  // header adds/removes its key, and every block kind reads this one flag, so
  // one control edits prose, tables, and finding cards alike.
  const [editingSections, setEditingSections] = useState<Set<string>>(new Set());
  const toggleSectionEditing = (key: string) => setEditingSections(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const stopEditingSection = (key: string) => setEditingSections(prev => {
    if (!prev.has(key)) return prev;
    const next = new Set(prev);
    next.delete(key);
    return next;
  });

  // Finding-card overrides — the user rewrites a card's title, severity word, or
  // any of its fields. Keyed per card + field, persisted per report like the
  // prose and table edits.
  const CARD_EDITS_KEY = 'irame.reports.cardEdits.v1';
  const [cardEdits, setCardEdits] = useState<Record<string, string>>(() => {
    try {
      const all = JSON.parse(localStorage.getItem(CARD_EDITS_KEY) ?? '{}');
      return all[report.id] ?? {};
    } catch { return {}; }
  });
  const cardLoggedRef = useRef<Set<string>>(new Set());
  const saveCardEdit = (key: string, value: string, title: string) => {
    markSectionDirty(title);
    setCardEdits(prev => ({ ...prev, [key]: value }));
    try {
      const all = JSON.parse(localStorage.getItem(CARD_EDITS_KEY) ?? '{}');
      all[report.id] = { ...(all[report.id] ?? {}), [key]: value };
      localStorage.setItem(CARD_EDITS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
    if (!cardLoggedRef.current.has(title)) {
      cardLoggedRef.current.add(title);
      logEvent({
        action: 'Update',
        description: `Edited findings in "${title}" of "${report.name}"`,
        module: 'Reports',
        entity: 'Report finding',
      });
    }
  };
  const makeCardFill = (sectionKey: string, title: string) => ({
    get: (blockIndex: number, cardIndex: number, field: string) =>
      cardEdits[`${sectionKey}:c${blockIndex}:${cardIndex}:${field}`],
    onSave: (blockIndex: number, cardIndex: number, field: string, value: string) =>
      saveCardEdit(`${sectionKey}:c${blockIndex}:${cardIndex}:${field}`, value, title),
  });
  // A prose-fill controller for narrative blocks INSIDE a typed section (BYOT).
  // Reuses the sectionEdits store, keyed per block so a section with several
  // narrative blocks edits each independently.
  const makeProseFill = (sectionKey: string, title: string) => ({
    get: (blockIndex: number) => sectionEdits[`${sectionKey}:prose:${blockIndex}`],
    onSave: (blockIndex: number, text: string) =>
      saveSectionEdit(`${sectionKey}:prose:${blockIndex}`, text, title),
  });

  // ── Version history — the same comments + versions trail the ATR carries.
  // The report starts at a single real baseline (v1 = generated); every real
  // change the user makes then appends a version, so the Activity log is a true
  // record, not a fabricated trail.
  const [versions, setVersions] = useState<AtrVersion[]>(() => loadBaselineVersions(report.id, {
    by: report.generatedBy ?? 'You',
    at: report.generatedAt ?? nowStamp(),
  }));
  const versionAuthor = () => currentUser?.name ?? report.generatedBy ?? 'You';
  // Append one version for a real change. `changes` is the optional bullet log.
  const recordActivity = (label: string, changes?: string[]) => {
    setVersions(prev => appendVersion(report.id, prev, label, 'draft', versionAuthor(), changes));
  };
  // Coalesced variant for rapid-fire changes (drag reorder): if the newest
  // version already carries this label, refresh it in place instead of stacking
  // a dozen "Reordered sections" entries.
  const recordActivityCoalesced = (label: string, changes?: string[]) => {
    setVersions(prev => {
      const last = prev[prev.length - 1];
      if (last && last.label === label) {
        const updated = [...prev.slice(0, -1), { ...last, at: nowStamp(), by: versionAuthor(), changes }];
        saveVersions(report.id, updated);
        return updated;
      }
      return appendVersion(report.id, prev, label, 'draft', versionAuthor(), changes);
    });
  };
  // Sections edited in the current edit session — a version is captured once,
  // when the section's Edit toggle is switched back off (Done).
  const editDirtyRef = useRef<Set<string>>(new Set());
  const markSectionDirty = (title: string) => editDirtyRef.current.add(title);
  const captureSectionVersion = (title: string) => {
    if (!editDirtyRef.current.has(title)) return;
    editDirtyRef.current.delete(title);
    recordActivity(`Edited “${title}”`, [`Edited “${title}” content`]);
  };
  // The section Edit toggle: entering edit mode opens the section; leaving it
  // (Done) captures a version if anything in that section changed.
  const handleSectionEditToggle = (key: string, title: string) => {
    const wasEditing = editingSections.has(key);
    toggleSectionEditing(key);
    if (wasEditing) captureSectionVersion(title);
  };

  // Door 2: setup that never changes gets remembered on the template itself —
  // every future report from this template pre-fills it. Only custom templates
  // can learn (standard ones are shared and read-only).
  const canRemember = customTemplates.some(t => t.id === report.templateId);
  const rememberManualFill = (title: string, content: string) => {
    window.dispatchEvent(new CustomEvent('irame:template-remember-content', {
      detail: { templateId: report.templateId, sectionName: title, content },
    }));
    logEvent({
      action: 'Update',
      description: `Saved "${title}" as a template default from "${report.name}"`,
      module: 'Reports',
      entity: 'Report Template',
    });
    addToast({ type: 'success', message: `Remembered. Future reports pre-fill “${title}” with this.` });
  };
  const ALT_SUMMARY = "Updated review identifies three additional control gaps in the vendor master review workflow, with proposed remediation owners. Findings reflect data through this morning's reconciliation cycle.";
  const generateSummary = () => {
    if (isGeneratingSummary || summaryGenerated) return;
    setIsGeneratingSummary(true);
    addToast({ type: 'success', message: 'Generating report summary…' });
    setTimeout(() => {
      setIsGeneratingSummary(false);
      setSummaryGenerated(true);
      addToast({ type: 'success', message: 'Executive summary ready.' });
    }, 1400);
  };

  useEffect(() => {
    const queries = appliedTemplateId && TEMPLATE_QUERIES[appliedTemplateId]
      ? TEMPLATE_QUERIES[appliedTemplateId]
      : seededQueries;
    const fresh = buildInitialSections(queries);
    setSections(fresh);
    sectionsBaselineRef.current = structureSig(fresh);
    setSummaryOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedTemplateId, isBulkAudit, reportWorkflows.length]);

  // Update one workflow's risk owner across both state and the parent report.
  const updateWorkflowRiskOwner = (workflowId: string, owner: string) => {
    setSections(prev => prev.map(s =>
      s.kind === 'workflow' && s.workflow.id === workflowId
        ? { ...s, workflow: { ...s.workflow, riskOwner: owner || undefined } }
        : s
    ));
  };

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  // Capture the report's current block stream as a reusable custom template.
  // Cover is implicit on every report, so it isn't stored as a section.
  const handleSaveAsTemplate = () => {
    const sectionDefs = sections
      .filter(s => s.kind !== 'cover')
      .map(s => ({
        name: s.title,
        icon: s.kind === 'query' ? 'check-circle'
          : s.kind === 'stats' || s.kind === 'workflow' ? 'bar-chart'
          : s.kind === 'observation' ? 'alert-triangle'
          : 'file-text',
      }));
    onSaveAsTemplate?.({
      id: `ct-report-${Date.now()}`,
      name: `${report.name} Template`,
      desc: `Captured from "${report.name}" — ${sectionDefs.length} ${sectionDefs.length === 1 ? 'section' : 'sections'}.`,
      category: 'Custom',
      icon: 'file-text',
      sections: sectionDefs,
    } as typeof REPORT_TEMPLATES[number]);
  };

  // ─── Add-Observation modal state ───
  const [showAddObservation, setShowAddObservation] = useState(false);
  const [editingObservation, setEditingObservation] = useState<EditingObservationInput | null>(null);
  // Separate stream of observations added to applied-template view (where the body is template-driven)
  const [appliedObservations, setAppliedObservations] = useState<ObservationItem[]>([]);

  // Auto-generate next sequential OBS ID across both streams + existing sections
  const nextObservationId = () => {
    const inSections = sections
      .filter((s): s is Extract<SectionItem, { kind: 'observation' }> => s.kind === 'observation')
      .map(s => s.obsId);
    const inApplied = appliedObservations.map(o => o.obsId);
    return computeNextObservationId([...inSections, ...inApplied]);
  };

  const openAddObservation = () => {
    setEditingObservation(null);
    setShowAddObservation(true);
  };
  const openEditObservation = (obs: { id: string; obsId: string; title: string; description: string; attachments?: ObservationAttachment[] }) => {
    setEditingObservation({
      id: obs.id,
      obsId: obs.obsId,
      name: obs.title,
      description: obs.description,
      attachments: obs.attachments,
    });
    setShowAddObservation(true);
  };
  const closeAddObservation = () => {
    setShowAddObservation(false);
    setEditingObservation(null);
  };

  const toggleObservationAttachment = (id: string) => {
    let obsLabel = 'observation';
    let nowHidden = false;
    setSections(prev => prev.map(s => {
      if (s.id === id && s.kind === 'observation') { obsLabel = s.obsId ?? s.title; nowHidden = !s.attachmentHidden; return { ...s, attachmentHidden: !s.attachmentHidden }; }
      return s;
    }));
    setAppliedObservations(prev => prev.map(o => {
      if (o.id === id) { obsLabel = o.obsId ?? o.title; nowHidden = !o.attachmentHidden; return { ...o, attachmentHidden: !o.attachmentHidden }; }
      return o;
    }));
    recordActivity(`${nowHidden ? 'Hid' : 'Showed'} attachment on ${obsLabel}`);
  };

  const handleObservationSave = ({ name, description, attachments }: { name: string; description: string; attachments?: ObservationAttachment[] }) => {
    if (editingObservation) {
      setSections(prev => prev.map(s =>
        s.id === editingObservation.id && s.kind === 'observation'
          ? { ...s, title: name, description, attachments }
          : s
      ));
      setAppliedObservations(prev => prev.map(o =>
        o.id === editingObservation.id
          ? { ...o, title: name, description, attachments }
          : o
      ));
      addToast({ type: 'success', message: `${editingObservation.obsId} updated.` });
      recordActivity(`Edited ${editingObservation.obsId}`, [`Updated observation “${name}”`]);
    } else {
      const obsId = nextObservationId();
      const newItem: ObservationItem = {
        id: `sec-obs-${Date.now()}`,
        kind: 'observation',
        title: name,
        obsId,
        description,
        attachments,
      };
      if (appliedTemplate) {
        setAppliedObservations(prev => [...prev, newItem]);
      } else {
        setSections(prev => [...prev, newItem]);
      }
      addToast({ type: 'success', message: `${obsId} added.` });
      recordActivity(`Added ${obsId}`, [`Added observation “${name}”`]);
    }
    closeAddObservation();
  };

  // ─── Contents (table of contents) state + handlers ───
  const [contentsEditingId, setContentsEditingId] = useState<string | null>(null);
  const [contentsDraft, setContentsDraft] = useState('');
  const [sectionPendingDelete, setSectionPendingDelete] = useState<SectionItem | null>(null);

  const renameSection = (id: string, newTitle: string) => {
    setSections(prev => prev.map(s => s.id === id ? ({ ...s, title: newTitle } as SectionItem) : s));
  };
  const scrollToSection = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const handleStartContentsRename = (s: SectionItem) => {
    setContentsDraft(s.title);
    setContentsEditingId(s.id);
  };
  const handleSaveContentsRename = () => {
    if (!contentsEditingId) return;
    const trimmed = contentsDraft.trim();
    if (trimmed) {
      const before = sections.find(s => s.id === contentsEditingId)?.title;
      if (before !== trimmed) {
        renameSection(contentsEditingId, trimmed);
        recordActivity(`Renamed section to “${trimmed}”`, before ? [`“${before}” → “${trimmed}”`] : undefined);
      }
    }
    setContentsEditingId(null);
  };
  const handleCancelContentsRename = () => {
    setContentsEditingId(null);
  };
  const confirmDeleteSection = () => {
    if (sectionPendingDelete) {
      const id = sectionPendingDelete.id;
      const title = sectionPendingDelete.title;
      setSections(prev => prev.filter(s => s.id !== id));
      setAppliedObservations(prev => prev.filter(o => o.id !== id));
      addToast({ type: 'success', message: `"${title}" removed.` });
      recordActivity(`Removed “${title}”`);
    }
    setSectionPendingDelete(null);
  };

  // The live, reorderable outline that powers the sticky rail on the normal
  // report path. Renumbers and reorders the document, renames in place, deletes,
  // and seeds new observations — the same affordances the inline TOC carried,
  // now persistent alongside the reading column.
  const ContentsBlock = () => {
    const coverSection = sections.find(s => s.kind === 'cover');
    const nonCoverSections = sections.filter(s => s.kind !== 'cover');
    if (nonCoverSections.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <List size={13} className="text-ink-400" />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-ink-400">On this page</span>
          <span className="ml-auto text-[0.6875rem] font-semibold tabular-nums text-ink-400">{nonCoverSections.length}</span>
        </div>
        <Reorder.Group
          axis="y"
          values={nonCoverSections}
          onReorder={(newOrder) => {
            setSections(coverSection ? [coverSection, ...newOrder] : newOrder);
            recordActivityCoalesced('Reordered sections');
          }}
          as="ol"
          className="list-none p-0 m-0 space-y-0.5"
        >
          {nonCoverSections.map((section, i) => (
            <ContentsRow
              key={section.id}
              section={section}
              index={i + 1}
              active={activeSectionId === section.id}
              isEditing={contentsEditingId === section.id}
              draftValue={contentsDraft}
              onDraftChange={setContentsDraft}
              onStartEdit={() => handleStartContentsRename(section)}
              onSaveEdit={handleSaveContentsRename}
              onCancelEdit={handleCancelContentsRename}
              onScroll={() => scrollToSection(section.id)}
              onDelete={() => setSectionPendingDelete(section)}
            />
          ))}
        </Reorder.Group>
        {!isReadOnly && (
          <button
            onClick={openAddObservation}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 text-[0.75rem] font-semibold text-brand-600 bg-brand-50 border border-brand-600/15 rounded-md hover:bg-brand-50/70 hover:border-brand-600/30 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Add Observation
          </button>
        )}
      </div>
    );
  };

  // Shared rail chrome — header eyebrow + count.
  const RailHeader = ({ count }: { count: number }) => (
    <div className="flex items-center gap-2 mb-3 px-1">
      <List size={13} className="text-ink-400" />
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-ink-400">On this page</span>
      <span className="ml-auto text-[0.6875rem] font-semibold tabular-nums text-ink-400">{count}</span>
    </div>
  );
  const RailAddObservation = () => !isReadOnly ? (
    <button
      onClick={openAddObservation}
      className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 text-[0.75rem] font-semibold text-brand-600 bg-brand-50 border border-brand-600/15 rounded-md hover:bg-brand-50/70 hover:border-brand-600/30 transition-colors cursor-pointer"
    >
      <Plus size={14} />
      Add Observation
    </button>
  ) : null;

  // The rail wrapper — a sticky card hosting the live, reorderable outline
  // (normal path), or the applied-template / empty outlines. The applied-template
  // case keeps observation reorder + rename + delete that the old inline TOC had.
  const OutlineRail = () => {
    const railCls = 'rounded-lg border border-canvas-border bg-canvas-elevated p-3.5';
    if (!appliedTemplate) {
      if (sections.filter(s => s.kind !== 'cover').length === 0) return null;
      return <div className={railCls}><ContentsBlock /></div>;
    }
    if (appliedTemplate) {
      const tmplSections = appliedTemplate.sections ?? [];
      if (tmplSections.length === 0 && appliedObservations.length === 0) return null;
      return (
        <div className={railCls}>
          <RailHeader count={tmplSections.length + appliedObservations.length} />
          <Reorder.Group axis="y" values={appliedObservations} onReorder={(o) => { setAppliedObservations(o); recordActivityCoalesced('Reordered observations'); }} as="ol" className="list-none p-0 m-0 space-y-0.5">
            {tmplSections.map((s, i) => (
              <li key={`${s.name}-${i}`} className="flex items-center gap-1.5 py-2 pl-1 pr-1 rounded-md hover:bg-brand-50/30 transition-colors">
                <span className="shrink-0 w-5 text-[0.6875rem] text-brand-500 font-semibold font-mono tabular-nums text-right">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex-1 min-w-0 text-[0.8125rem] font-medium text-ink-600 truncate">{s.name}</span>
              </li>
            ))}
            {appliedObservations.map((o, i) => (
              <ContentsRow
                key={o.id}
                section={o}
                index={tmplSections.length + i + 1}
                active={activeSectionId === o.id}
                isEditing={contentsEditingId === o.id}
                draftValue={contentsDraft}
                onDraftChange={setContentsDraft}
                onStartEdit={() => handleStartContentsRename(o as unknown as SectionItem)}
                onSaveEdit={() => {
                  if (!contentsEditingId) return;
                  const trimmed = contentsDraft.trim();
                  if (trimmed) setAppliedObservations(prev => prev.map(x => x.id === contentsEditingId ? { ...x, title: trimmed } : x));
                  setContentsEditingId(null);
                }}
                onCancelEdit={handleCancelContentsRename}
                onScroll={() => scrollToSection(o.id)}
                onDelete={() => setAppliedObservations(prev => prev.filter(x => x.id !== o.id))}
              />
            ))}
          </Reorder.Group>
          <RailAddObservation />
        </div>
      );
    }
    // Empty path — static list of the template's defined sections.
    if (outlineEntries.length === 0) return null;
    return (
      <div className={railCls}>
        <RailHeader count={outlineEntries.length} />
        <ol className="list-none p-0 m-0 space-y-0.5">
          {outlineEntries.map((e, i) => (
            <li key={e.id} className="flex items-center gap-1.5 py-2 pl-1 pr-1 rounded-md">
              <span className="shrink-0 w-5 text-[0.6875rem] text-brand-500 font-semibold font-mono tabular-nums text-right">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 min-w-0 text-[0.8125rem] font-medium text-ink-600 truncate">{e.title}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  };

  // Report-level activity log drawer (comments + version history).
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState<'comments' | 'versions'>('comments');

  // Sync activity drawer state to the URL so a link can deep-link back to it.
  // No react-router in this app — use history.replaceState directly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (activityLogOpen) {
      url.searchParams.set('drawer', 'activity');
    } else if (url.searchParams.get('drawer') === 'activity') {
      url.searchParams.delete('drawer');
    }
    window.history.replaceState({}, '', url.toString());
  }, [activityLogOpen]);

  // ATR generation is offered on IA + Bulk reports (and ATRs themselves), never
  // on SOX — SOX is a separate report type that does not convert into an ATR.
  const canGenerateAtr = reportKind(report) !== 'sox';
  // Report-level "Generate ATR" — same editable ATR preview as the Action Hub.
  const [atrModalOpen, setAtrModalOpen] = useState(false);

  // ─── Shared comments state (common activity log across all query cards) ───
  const [comments, setComments] = useState<QueryComment[]>([
    { id: 'c-1', queryId: 'Q01', queryTitle: 'Detects duplicate invoice entries by vendor, date, and amount', author: 'Priya Mehta',  initials: 'PM', timestamp: '2 days ago', text: 'Grouped cases by vendor and exported for AP review. Priority — largest 12 duplicates are all the same vendor.' },
    { id: 'c-2', queryId: 'Q01', queryTitle: 'Detects duplicate invoice entries by vendor, date, and amount', author: 'Karan Mehta',  initials: 'KM', timestamp: '1 day ago',  text: 'Flagged EX-2024-003 as a bulk case for remediation — MFA enforcement applied.', attachment: 'mfa_remediation_plan.pdf' },
    { id: 'c-3', queryId: 'Q02', queryTitle: 'Identifies unauthorized vendor master changes without proper approval workflow in the last 90 days', author: 'Ravi Kumar', initials: 'RK', timestamp: '5 hours ago', text: 'Control owner confirmed — vendor master workflow is being tightened; expect residual risk to drop next quarter.' },
  ]);
  const addComment = (queryId: string, queryTitle: string, text: string, attachments?: string[]) => {
    setComments(prev => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        queryId,
        queryTitle,
        author: report.generatedBy ?? 'You',
        initials: (report.generatedBy ?? 'You').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        timestamp: 'just now',
        text,
        attachments: attachments && attachments.length ? attachments : undefined,
      },
    ]);
  };

  const isReadOnly = report.isReadOnly === true || report.tag === 'Shared';

  // ATR-style section numbering — position in the stream, cover excluded.
  // Reordering renumbers, like a real document.
  const sectionNumber = (id: string) =>
    sections.filter(s => s.kind !== 'cover').findIndex(s => s.id === id) + 1;

  // ─── Reader workspace: scroll-spy outline + scroll-revealed command-bar title ───
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Scroll-spy — highlight the outline entry whose section currently leads the
  // viewport. Re-binds whenever the rendered section set changes.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, appliedTemplate]);

  // The outline entries the rail shows, per render path. Cover is excluded — the
  // command bar's Back + title already anchor the top.
  const outlineEntries: { id: string; title: string; scrollable: boolean }[] = appliedTemplate
      ? [
          ...(appliedTemplate.sections ?? []).map((s, i) => ({ id: `as-${i}`, title: s.name, scrollable: false })),
          ...appliedObservations.map(o => ({ id: o.id, title: o.title, scrollable: true })),
        ]
      : sections.filter(s => s.kind !== 'cover').map(s => ({ id: s.id, title: s.title, scrollable: true }));

  // Back affordance + the report's primary actions live in a light sticky top
  // command bar above the letterhead banner (not inside the purple box).
  const backLink = (
    <button
      onClick={onBack}
      className="inline-flex items-center gap-1.5 h-9 px-3 text-[0.75rem] font-semibold text-ink-600 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:text-ink-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
    >
      <ArrowLeft size={14} /> Back to Reports
    </button>
  );
  const coverActions = (
    <>
      {!isReadOnly && (
        <div className="relative">
          <button
            onClick={() => setShowApplyTemplate(p => !p)}
            className="flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          >
            <Layout size={14} />
            <span className="truncate max-w-[160px] hidden md:inline">{appliedTemplate?.name ?? reportTemplate?.name ?? 'Apply Template'}</span>
            <motion.span
              animate={{ rotate: showApplyTemplate ? 180 : 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex"
            >
              <ChevronDown size={14} />
            </motion.span>
          </button>
          <AnimatePresence>
            {showApplyTemplate && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowApplyTemplate(false)} />
                <ApplyTemplateDropdown
                  templates={mergeTemplateOptions(REPORT_TEMPLATES, customTemplates, [reportTemplate])}
                  activeId={appliedTemplate?.id ?? reportTemplate?.id ?? null}
                  onSelect={handleApplyTemplate}
                  onClose={() => setShowApplyTemplate(false)}
                  onSaveAsTemplate={onSaveAsTemplate && structureChanged ? handleSaveAsTemplate : undefined}
                />
              </>
            )}
          </AnimatePresence>
        </div>
      )}
      <button
        onClick={() => setActivityLogOpen(true)}
        title="View this report's activity log"
        aria-label="View report activity log"
        className="flex items-center justify-center w-9 h-9 text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
      >
        <History size={16} />
      </button>
      {onShare && can('rp_share') && (
        <button onClick={onShare} className="flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30">
          <Share2 size={14} /> <span className="hidden sm:inline">Share</span>
        </button>
      )}
      <button
        onClick={() => setShowDownloadModal(true)}
        className="flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100 hover:border-brand-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
      >
        <Download size={14} /> Download
      </button>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={launching ? { opacity: 0.88, x: 16 } : { opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="report-printable h-full overflow-y-auto bg-canvas"
      ref={scrollRef}
    >
        {/* Applying Template Overlay */}
        <AnimatePresence>
          {applyingTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 flex items-center justify-center bg-white/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-3 px-6 py-4 glass-card-strong rounded-lg shadow-lg"
              >
                <Loader2 size={20} className="text-brand-600 animate-spin" />
                <span className="text-[0.875rem] font-semibold text-ink-800">Applying template...</span>
              </motion.div>
            </motion.div>
          )}
          {pendingTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px]"
              onClick={() => setPendingTemplate(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="switch-template-title"
                className="relative bg-white rounded-xl border border-canvas-border shadow-xl w-[320px] p-6"
                onClick={e => e.stopPropagation()}
              >
                <h3 id="switch-template-title" className="text-[0.9375rem] font-semibold text-ink-800 mb-2">Switch template?</h3>
                <p className="text-[0.8125rem] text-ink-500 leading-relaxed mb-5">
                  Switching to “{pendingTemplate.name}” replaces the current layout and its sections. Some content may not carry over.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setPendingTemplate(null)}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-md text-[0.8125rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-canvas transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { const t = pendingTemplate; setPendingTemplate(null); applyTemplateNow(t); }}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-md text-[0.8125rem] font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                  >
                    Switch
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Report actions — pinned to the top of the scroll area so they stay
          reachable while the document scrolls under them. No header-bar chrome:
          page-coloured + borderless, so content slides cleanly beneath it. */}
      <div className="sticky top-0 z-30 bg-canvas px-6 lg:px-12 xl:px-[124px] h-16 flex items-center justify-between gap-4 print:hidden">
        {backLink}
        <div className="flex items-center gap-2">{coverActions}</div>
      </div>

      {/* Reader workspace — a persistent outline rail plus a constrained,
          centered document column. The rail tracks scroll position and jumps
          between sections; the document keeps a comfortable reading measure
          instead of spanning the full page. */}
      <div
        className="px-6 lg:px-12 xl:px-[124px] pt-3 pb-8 flex items-start gap-8 xl:gap-10"
        // A custom brand colour (or named theme) colours the body accents (section
        // numbers, ticks, outline rail) to match the cover.
        style={{ '--rep-accent': reportAccent(report.theme, report.brandColor) } as React.CSSProperties}
      >
        <aside className="hidden xl:block w-[252px] shrink-0 sticky top-[72px] self-start max-h-[calc(100vh-96px)] overflow-y-auto pr-1 -mr-1 print:hidden">
          <OutlineRail />
        </aside>
        <div className="min-w-0 flex-1">
        {appliedTemplate ? (
          <>
            {/* Report Cover — light letterhead with theme accent,
                metadata grid attached below. */}
            <div className="rounded-lg overflow-hidden mb-5 border border-canvas-border bg-white">
              <ReportBrandBanner
                title={reportDisplayName(report.name)}
                logo={report.logoDataUrl}
                gradient={reportGradient(report.theme, report.brandColor)}
                actions={
                  <>
                    {canGenerateAtr && (
                    <button
                      onClick={() => setAtrModalOpen(true)}
                      title="Open the live Action Taken Report"
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-white bg-brand-700 border border-white/25 rounded-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-brand-600 hover:border-white/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      <FileText size={14} />
                      Live ATR
                    </button>
                    )}
                  </>
                }
              >
                <EditableDescription onDark />
                <div className="flex items-center gap-1.5 text-[0.8125rem] flex-wrap">
                  <span className="font-semibold text-white">{report.generatedBy}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{report.generatedAt}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{activeQueries.length} {activeQueries.length === 1 ? 'query' : 'queries'}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{reportAuditPeriod(report.reportPeriod)}</span>
                  {/* When a template is applied, show only the applied-template chip. */}
                  <span className="inline-flex items-center h-6 px-2.5 ml-1 text-[0.6875rem] font-medium text-white bg-white/15 border border-white/25 rounded-full whitespace-nowrap">
                    {appliedTemplate.name}
                  </span>
                </div>
              </ReportBrandBanner>
            </div>


            {/* Summary Stats Bar — ATR-style KPI tiles. A custom template with
                its own summary section carries the tiles there instead, so the
                reader never meets the same four numbers twice. */}
            {!(appliedTemplate.sections ?? []).some(s =>
              /\b(executive summary|overall (opinion|conclusion)|audit opinion|assurance opinion)\b/i.test(s.name)) && (
              <div className="mb-5">
                <ReportKpiTiles stats={activeStats} animate />
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div key={appliedTemplate.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {/* Template body — same engine as wizard-generated reports:
                    section cards with composed starter prose, real QueryCards
                    slotted at the anchor section. Replaces the retired
                    hardcoded TemplateLayout fakes. */}
                {(() => {
                  const tmplSections = appliedTemplate.sections ?? [];
                  const anchorIdx = tmplSections.findIndex(s => /quer(y|ies)|testing results|findings/i.test(s.name));
                  // A section the template says "fills from audit data" has to
                  // SHOW that data, not a sentence about it. The report's own
                  // queries become the findings pool, and each typed section
                  // renders through the same block engine the generated report
                  // uses, so a severity-split section stamps only its own.
                  // Generation reads the mould: every block's binding is looked
                  // up against this report's own data before anything is drawn.
                  const appliedFacts = buildReportFacts(activeQueries, report, activeStats);
                  const appliedCards: CardFinding[] = appliedFacts.findings;
                  // The applied template may be a BYOT one, which carries typed
                  // blocks and its own rating words; the base seed type does not.
                  const tmplTyped = tmplSections as TemplateSection[];
                  const appliedLibrary = collectBlockLibrary(tmplTyped);
                  const appliedScale = (appliedTemplate as { findingScale?: string[] }).findingScale;
                  const queryBlocks = (
                    <div className="space-y-4">
                      {activeQueries.map((q, qi) => (
                        <QueryCard key={q.id} query={q} index={qi} onOpenQuery={onOpenQuery} />
                      ))}
                    </div>
                  );
                  if (tmplSections.length === 0) return queryBlocks;
                  return (
                    <div className="space-y-4">
                      {tmplTyped.map((s, i) => {
                        const Icon = SECTION_ICONS[s.icon] || FileText;
                        const isExec = /executive summary/i.test(s.name);
                        const content = isExec
                          ? composeExecSummary(appliedTemplate.name, activeQueries)
                          : composeSectionContent(s.name, activeQueries);
                        // The composed prose is a starting draft — a per-section
                        // edit (keyed by the applied template + position) wins over
                        // it and is remembered on the report.
                        const sectionKey = `${appliedTemplate.id}:${i}`;
                        const editedContent = sectionEdits[sectionKey];
                        const sectionEditing = editingSections.has(sectionKey);
                        // The summary is the report's opening statement, so it
                        // gets the same treatment under a custom template as it
                        // does under ours: the numbers first, the rollup below
                        // them, and a way to write it again. Only the heading
                        // changes, because the heading is theirs.
                        const isSummarySection = isExec
                          || (s.blocks ?? []).some(b => b.binding === 'summary')
                          || /\b(executive summary|overall (opinion|conclusion)|audit opinion|assurance opinion)\b/i.test(s.name);
                        if (isSummarySection) {
                          return (
                            <div key={`${s.name}-${i}`} className="space-y-4">
                              <motion.div
                                initial={{ opacity: 0, y: 14 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-60px' }}
                                transition={{ duration: 0.4, delay: Math.min(i, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
                                className="bg-white rounded-lg border border-canvas-border px-6 py-5"
                              >
                                <ReportNumberedHeading
                                  n={i + 1}
                                  title={s.name}
                                  subtitle={isBulkAudit ? 'Overall workflow result rollup' : 'Overall observation and action plan rollup'}
                                  right={
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          if (isRegeneratingSummary) return;
                                          setIsRegeneratingSummary(true);
                                          setTimeout(() => {
                                            setSummaryOverride(ALT_SUMMARY);
                                            setIsRegeneratingSummary(false);
                                            addToast({ type: 'success', message: 'Executive summary regenerated.' });
                                            recordActivity('Regenerated executive summary');
                                          }, 1200);
                                        }}
                                        disabled={isRegeneratingSummary}
                                        aria-busy={isRegeneratingSummary || undefined}
                                        title="Regenerate this summary with the latest queries"
                                        className="group/regen inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-brand-600 bg-brand-50 border border-brand-600/20 rounded-md hover:bg-brand-50/70 hover:border-brand-600/35 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                      >
                                        {isRegeneratingSummary
                                          ? <Loader2 size={14} className="animate-spin" />
                                          : <RefreshCw size={14} className="transition-transform duration-300 group-hover/regen:rotate-180" />}
                                        {isRegeneratingSummary ? 'Regenerating…' : 'Regenerate'}
                                      </button>
                                      {!isReadOnly && <SectionEditToggle editing={sectionEditing} onToggle={() => handleSectionEditToggle(sectionKey, s.name)} />}
                                    </div>
                                  }
                                />
                                <div className="pb-6 border-b border-canvas-border mb-6">
                                  <ReportKpiTiles stats={activeStats} animate />
                                </div>
                                {isRegeneratingSummary ? (
                                  <div className="max-w-[80ch] space-y-2.5" aria-live="polite">
                                    <div className="h-3.5 w-full rounded bg-canvas-border/70 animate-pulse" />
                                    <div className="h-3.5 w-[92%] rounded bg-canvas-border/70 animate-pulse" />
                                    <div className="h-3.5 w-[78%] rounded bg-canvas-border/70 animate-pulse" />
                                  </div>
                                ) : (
                                  <EditableProse
                                    value={summaryOverride ?? editedContent ?? content}
                                    editing={sectionEditing}
                                    onSave={(next) => { setSummaryOverride(next); saveSectionEdit(sectionKey, next, s.name); }}
                                    onCancel={() => stopEditingSection(sectionKey)}
                                    textClassName="max-w-[80ch] text-[1.0625rem] text-ink-700 leading-[1.8]"
                                  />
                                )}
                              </motion.div>
                              {(i === anchorIdx || (anchorIdx === -1 && i === tmplTyped.length - 1)) && queryBlocks}
                            </div>
                          );
                        }

                        return (
                          <div key={`${s.name}-${i}`} className="space-y-4">
                            <motion.div
                              initial={{ opacity: 0, y: 14 }}
                              whileInView={{ opacity: 1, y: 0 }}
                              viewport={{ once: true, margin: '-60px' }}
                              transition={{ duration: 0.4, delay: Math.min(i, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
                              className="bg-white rounded-lg border border-canvas-border p-5"
                            >
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <h3 className="text-[0.8125rem] font-bold text-ink-800 flex items-center gap-2 min-w-0">
                                  <Icon size={14} className="text-brand-600 shrink-0" /> <span className="truncate">{s.name}</span>
                                </h3>
                                {!isReadOnly && <SectionEditToggle editing={sectionEditing} onToggle={() => handleSectionEditToggle(sectionKey, s.name)} />}
                              </div>
                              {(s.blocks?.length ?? 0) > 0 || (s.kind && s.kind !== 'text') || s.fixed ? (
                                <TemplateBlockBody
                                  tsec={s}
                                  cards={appliedCards}
                                  findingScale={appliedScale}
                                  composed={content}
                                  blockLibrary={appliedLibrary}
                                  facts={appliedFacts}
                                  editing={sectionEditing}
                                  tableFill={makeTableFill(sectionKey, s.name)}
                                  cardFill={makeCardFill(sectionKey, s.name)}
                                  proseFill={makeProseFill(sectionKey, s.name)}
                                />
                              ) : (
                                <EditableProse
                                  value={editedContent ?? content}
                                  editing={sectionEditing}
                                  onSave={(next) => saveSectionEdit(sectionKey, next, s.name)}
                                  onCancel={() => stopEditingSection(sectionKey)}
                                  textClassName="text-[0.875rem] text-ink-700 leading-relaxed"
                                />
                              )}
                            </motion.div>
                            {(i === anchorIdx || (anchorIdx === -1 && i === tmplSections.length - 1)) && queryBlocks}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </motion.div>
            </AnimatePresence>

            {/* Observations added on top of the template — match Query Card UI */}
            {appliedObservations.length > 0 && (
              <div className="mt-5 space-y-3">
                {appliedObservations.map((o, i) => (
                  <div key={o.id} id={`section-${o.id}`}>
                    <ObservationCard
                      obs={o}
                      index={i}
                      attached={false}
                      onEdit={() => openEditObservation(o)}
                      onToggleAttachment={() => toggleObservationAttachment(o.id)}
                      onDelete={() => setSectionPendingDelete(o as unknown as SectionItem)}
                    />
                  </div>
                ))}
              </div>
            )}

          </>
        ) : (
          <div className="w-full">
            {/* Sections rendered as a continuous report (drag-to-reorder enabled for query cards) */}
            <main className="min-w-0">
              <Reorder.Group axis="y" values={sections} onReorder={(o) => { setSections(o); recordActivityCoalesced('Reordered sections'); }} as="div" className="list-none p-0 m-0 [&>*:last-child>*]:rounded-b-lg [&>*:last-child>*]:border-b [&>*:last-child>*]:border-canvas-border">
                {sections.map((section, i) => {
                  // `key` is intentionally NOT in here — React requires keys to
                  // be passed directly on each element, never via a spread prop.
                  const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];
                  const sectionProps = {
                    value: section,
                    id: `section-${section.id}`,
                    layout: true as const,
                    initial: { opacity: 0, y: 10 },
                    animate: { opacity: 1, y: 0 },
                    exit: { opacity: 0, y: -4, scale: 0.98 },
                    // Skeleton cards appear together on open and resolve to content
                    // top-to-bottom (the streaming). Keep reorder (layout) snappy by
                    // giving it its own delay-free transition.
                    transition: {
                      layout: { duration: 0.25, ease },
                      duration: 0.4,
                      delay: Math.min(i, 8) * 0.04,
                      ease,
                    },
                    className: 'scroll-mt-20 list-none',
                    dragListener: false as const,
                  };

  if (section.kind === 'cover') {
                    // A cards-driven (BYOT) report carries its findings inside the
                    // repeating-card block, not query sections — count what the
                    // reader actually shows, never "0 queries".
                    const cardTotal = sections.reduce((n, s) => n + (s.kind === 'tblock' && (s.tsec.kind === 'cards' || s.tsec.blocks?.some(b => b.kind === 'cards')) ? (s.cards?.length ?? 0) : 0), 0);
                    const scopeLabel = isBulkAudit
                      ? (() => { const n = sections.filter(s => s.kind === 'workflow').length; return `${n} ${n === 1 ? 'workflow' : 'workflows'}`; })()
                      : cardTotal > 0
                        ? `${cardTotal} ${cardTotal === 1 ? 'finding' : 'findings'}`
                        : (() => { const n = sections.filter(s => s.kind === 'query').length; return `${n} ${n === 1 ? 'query' : 'queries'}`; })();
                    return [
                      <Reorder.Item {...sectionProps} key={`${section.id}-item`}>
                        <ReportBrandBanner
                          title={reportDisplayName(report.name)}
                          logo={report.logoDataUrl}
                                    className="rounded-t-lg"
                          gradient={reportGradient(report.theme, report.brandColor)}
                          eyebrow={report.id && (
                            <span className="font-mono text-[0.6875rem] tracking-[0.04em] text-white/65">{report.id.toUpperCase()}</span>
                          )}
                          actions={
                            <>
                              {canGenerateAtr && (
                              <button
                                onClick={() => setAtrModalOpen(true)}
                                title="Generate Action Taken Report"
                                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-white bg-brand-700 border border-white/25 rounded-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-brand-600 hover:border-white/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                              >
                                <FileText size={14} />
                                Generate ATR
                              </button>
                              )}
                            </>
                          }
                          footer={(() => {
                            // Inline byline: who/when/scope plus the Audit Period. The
                            // meta strip below carries the Report ID + Report Type.
                            const latestVersion = versions[versions.length - 1]?.version;
                            const parts = [report.generatedBy, report.generatedAt, latestVersion ? `v${latestVersion}` : null, scopeLabel, reportAuditPeriod(report.reportPeriod)].filter(Boolean);
                            if (parts.length === 0) return null;
                            return (
                              <div className="flex items-center gap-2.5 text-[0.8125rem] flex-wrap">
                                {parts.map((p, i) => (
                                  <span key={i} className="inline-flex items-center gap-2.5">
                                    {i > 0 && <span className="text-white/30" aria-hidden="true">|</span>}
                                    <span className={i === 0 ? 'font-semibold text-white' : 'text-white/70'}>{p}</span>
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        >
                          <EditableDescription onDark />
                        </ReportBrandBanner>
                      </Reorder.Item>,
                    ];
                  }

                  if (section.kind === 'summary') {
                    const hasQueries = sections.some(s => s.kind === 'query');
                    return (
                      <Reorder.Item key={section.id} {...sectionProps}>
                        <div className="border-x border-canvas-border bg-white px-9 pt-6 pb-6">
                          <ReportNumberedHeading
                            n={sectionNumber(section.id)}
                            title={section.title}
                            subtitle={isBulkAudit ? 'Overall workflow result rollup' : 'Overall observation and action plan rollup'}
                            right={summaryGenerated ? (hasQueries && (
                              <button
                                onClick={() => {
                                  if (isRegeneratingSummary) return;
                                  setIsRegeneratingSummary(true);
                                  setTimeout(() => {
                                    setSummaryOverride(ALT_SUMMARY);
                                    setIsRegeneratingSummary(false);
                                    addToast({ type: 'success', message: 'Executive summary regenerated.' });
                                    recordActivity('Regenerated executive summary');
                                  }, 1200);
                                }}
                                disabled={isRegeneratingSummary}
                                aria-busy={isRegeneratingSummary || undefined}
                                title="Regenerate this summary with the latest queries"
                                className="group/regen inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-brand-600 bg-brand-50 border border-brand-600/20 rounded-md hover:bg-brand-50/70 hover:border-brand-600/35 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {isRegeneratingSummary ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <RefreshCw size={14} className="transition-transform duration-300 group-hover/regen:rotate-180" />
                                )}
                                {isRegeneratingSummary ? 'Regenerating…' : 'Regenerate'}
                              </button>
                            )) : (
                              <button
                                onClick={generateSummary}
                                disabled={isGeneratingSummary}
                                aria-busy={isGeneratingSummary || undefined}
                                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100 hover:border-brand-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {isGeneratingSummary ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                {isGeneratingSummary ? 'Generating…' : 'Generate Summary'}
                              </button>
                            )}
                          />
                          <div className={(summaryGenerated || isGeneratingSummary) ? 'pb-6 border-b border-canvas-border mb-6' : ''}>
                            <ReportKpiTiles stats={activeStats} animate />
                          </div>
                          {summaryGenerated ? (
                            <p className="max-w-[80ch] text-[1.0625rem] text-ink-700 leading-[1.8]">{summaryOverride ?? section.content}</p>
                          ) : isGeneratingSummary ? (
                            <div className="max-w-[80ch] space-y-2.5" aria-live="polite">
                              <div className="h-3.5 w-full rounded bg-canvas-border/70 animate-pulse" />
                              <div className="h-3.5 w-[92%] rounded bg-canvas-border/70 animate-pulse" />
                              <div className="h-3.5 w-[78%] rounded bg-canvas-border/70 animate-pulse" />
                            </div>
                          ) : null}
                        </div>
                      </Reorder.Item>
                    );
                  }

                  if (section.kind === 'stats') {
                    return (
                      <Reorder.Item key={section.id} {...sectionProps}>
                        <div className="border-x border-canvas-border bg-white px-9 py-6">
                          <ReportKpiTiles stats={activeStats} animate />
                        </div>
                      </Reorder.Item>
                    );
                  }

                  if (section.kind === 'query') {
                    return (
                      <DraggableQuerySection
                        key={section.id}
                        section={section}
                        index={i}
                        sectionProps={sectionProps}
                        ready={sectionReady(i)}
                        onOpenQuery={onOpenQuery}
                        onDelete={() => {
                          // Snapshot the card and its position so Undo restores both.
                          const snapshot = sections.find(s => s.id === section.id);
                          const snapshotIndex = sections.findIndex(s => s.id === section.id);
                          setSections(prev => prev.filter(s => s.id !== section.id));
                          addToast({
                            type: 'success',
                            message: 'Query card removed.',
                            action: snapshot ? {
                              label: 'Undo',
                              onClick: () => {
                                setSections(prev => {
                                  if (prev.some(s => s.id === snapshot.id)) return prev;
                                  const next = [...prev];
                                  next.splice(Math.max(0, snapshotIndex), 0, snapshot);
                                  return next;
                                });
                              },
                            } : undefined,
                          });
                        }}
                        comments={comments}
                        onAddComment={addComment}
                      />
                    );
                  }

                  if (section.kind === 'workflow') {
                    return (
                      <Reorder.Item key={section.id} {...sectionProps}>
                        <WorkflowResultCard
                          workflow={section.workflow}
                          index={i}
                          casesPhase={casesPhases[section.workflow.id] ?? 'idle'}
                          onCasesPhaseChange={(p) => setCasesPhase(section.workflow.id, p)}
                          onUpdateRiskOwner={(owner) => updateWorkflowRiskOwner(section.workflow.id, owner)}
                          onDelete={() => removeSection(section.id)}
                        />
                      </Reorder.Item>
                    );
                  }

                  if (section.kind === 'note') {
                    return (
                      <Reorder.Item key={section.id} {...sectionProps}>
                        <div className="border-x border-canvas-border bg-white px-9 pt-6 pb-6">
                          <ReportNumberedHeading n={sectionNumber(section.id)} title={section.title} />
                          <p className="max-w-[80ch] text-[0.9375rem] text-ink-700 leading-[1.8]">{section.content}</p>
                        </div>
                      </Reorder.Item>
                    );
                  }

                  // Typed template blocks (BYOT) — repeating finding cards, real
                  // tables, KPI/chart placeholders, fixed text, human slots.
                  if (section.kind === 'tblock') {
                    const t = section.tsec;
                    // Door 1: a "no data connected" section takes typed input in
                    // place; door 2 pre-fills from the template's remembered
                    // default. Never a dead end.
                    const isManualSection = t.blocks?.length
                      ? t.blocks.some(b => b.fill === 'manual')
                      : t.fill === 'manual' || (t.kind === 'table' && !t.linkedTo);
                    const manualText = manualFills[section.id] ?? t.savedContent ?? '';
                    const secEditing = editingSections.has(section.id);
                    return (
                      <Reorder.Item key={section.id} {...sectionProps}>
                        <div className="border-x border-canvas-border bg-white px-9 pt-6 pb-6">
                          <ReportNumberedHeading
                            n={sectionNumber(section.id)}
                            title={section.title}
                            right={!isReadOnly ? <SectionEditToggle editing={secEditing} onToggle={() => handleSectionEditToggle(section.id, section.title)} /> : undefined}
                          />
                          <TemplateBlockBody
                            tsec={t}
                            blockLibrary={templateBlockLibrary}
                            facts={reportFacts}
                            cards={section.cards}
                            findingScale={report.findingScale}
                            composed={section.composed}
                            editing={secEditing}
                            tableFill={makeTableFill(section.id, section.title)}
                            cardFill={makeCardFill(section.id, section.title)}
                            proseFill={makeProseFill(section.id, section.title)}
                            manual={isManualSection ? {
                              text: manualText,
                              onChange: text => setManualFill(section.id, text),
                              onCommit: () => commitManualFill(section.id, section.title),
                              onRemember: canRemember ? () => rememberManualFill(section.title, manualText) : undefined,
                            } : undefined}
                          />
                        </div>
                      </Reorder.Item>
                    );
                  }

                  if (section.kind === 'observation') {
                    return (
                      <Reorder.Item key={section.id} {...sectionProps}>
                        <ObservationCard
                          obs={section}
                          index={i}
                          onEdit={() => openEditObservation(section)}
                          onToggleAttachment={() => toggleObservationAttachment(section.id)}
                          onDelete={() => setSectionPendingDelete(section)}
                        />
                      </Reorder.Item>
                    );
                  }

                  return null;
                })}
              </Reorder.Group>
              {report.footerText && (
                <div className="border-x border-b border-canvas-border bg-canvas/60 rounded-b-lg px-9 py-3 flex items-center justify-center">
                  <span className="text-[0.6875rem] text-ink-400 tracking-wide">{report.footerText}</span>
                </div>
              )}
            </main>
          </div>
        )}

        {/* Approvals & Sign-Off — from the template's signature block, rendered
            for both report layouts. Each slot is manually signable / revocable
            here in the reader (persisted); static otherwise. */}
        {report.signoffEnabled && (report.signatories?.length ?? 0) > 0 && (
          <div className="mt-6 bg-white rounded-lg border border-canvas-border p-6">
            <ReportSignoffBlock
              signatories={report.signatories!}
              signoffs={report.signoffs}
              onSign={canSignoff ? handleSign : undefined}
              onSignOff={canSignoff ? handleSignOff : undefined}
            />
          </div>
        )}

        {/* The closing page — their own last page, printed exactly as written.
            Nothing in it is generated, which is why it is a setting and not a
            section. */}
        {report.closingEnabled && (report.closingText?.length ?? 0) > 0 && (
          <div className="mt-6 bg-white rounded-lg border border-canvas-border">
            <ReportClosingBlock lines={report.closingText!} />
          </div>
        )}
        </div>
      </div>

      {/* Report-level activity log drawer — comments + version history, the same
          trail the ATR carries, so every saved section edit grows a version. */}
      <AnimatePresence>
        {activityLogOpen && (
          <AtrReviewDrawer
            reportId={report.id}
            reportName={report.name}
            tab={reviewTab}
            onTab={setReviewTab}
            onClose={() => setActivityLogOpen(false)}
            initialVersions={versions}
            me={currentUser?.name ?? 'You'}
          />
        )}
      </AnimatePresence>

      {/* Download Preview Modal — PDF / PPT / DOCX tabs, preview before export */}
      <AnimatePresence>
        {showDownloadModal && (
          <ReportDownloadModal
            reportName={report.name}
            reportTag={report.tag}
            reportId={report.id?.toUpperCase()}
            templateName={reportTemplate?.name}
            generatedBy={report.generatedBy}
            generatedAt={report.generatedAt}
            pageNumbers={report.pageNumbers}
            brandColor={report.brandColor}
            signatories={report.signoffEnabled ? report.signatories : undefined}
            closingText={report.closingEnabled ? report.closingText : undefined}
            logoDataUrl={report.logoDataUrl}
            signoffs={report.signoffs}
            // The export checklist — sections still awaiting content (manual
            // fill or a person's input) are named before download, so nothing
            // incomplete leaves quietly. Export anyway stays allowed. A section
            // the user already typed into (or the template remembered) is no
            // longer incomplete.
            incomplete={sections
              .filter(s => {
                if (s.kind !== 'tblock') return false;
                const filled = (manualFills[s.id] ?? s.tsec.savedContent ?? '').trim().length > 0;
                const manualOpen = !filled && (
                  (s.tsec.blocks ?? []).some(b => b.fill === 'manual')
                  || (!s.tsec.blocks?.length && s.tsec.fill === 'manual'));
                const humanOpen =
                  (s.tsec.blocks ?? []).some(b => (b.fill === 'human' && b.kind !== 'signoff') || (b.humanFields?.length ?? 0) > 0)
                  || (!s.tsec.blocks?.length && (s.tsec.kind === 'human' || s.tsec.fill === 'human' || (s.tsec.humanFields?.length ?? 0) > 0));
                return manualOpen || humanOpen;
              })
              .map(s => s.title)}
            sections={sections.map((s): DownloadPreviewSection => {
              if (s.kind === 'query') {
                const q = s.query;
                const kpis = (QUERY_KPIS[q.id] ?? computeQueryKpis(q)).map(k => ({ label: k.label, value: k.value }));
                const charts = QUERY_GRAPHS[q.id] ?? [];
                const t = QUERY_TABLES[q.id];
                const tables = QUERY_TABLE_SETS[q.id]
                  ?? (t ? [{ id: 'results', title: 'Results Table', columns: t.columns, rows: t.rows }] : []);
                return {
                  id: s.id,
                  kind: 'query',
                  title: s.title,
                  queryId: q.id,
                  queryTitle: q.title,
                  severity: q.severity,
                  risk: q.risk,
                  summary: q.summary,
                  answer: q.answer,
                  findings: q.findings,
                  observations: q.observations,
                  kpis,
                  charts,
                  tables,
                };
              }
              if (s.kind === 'workflow') {
                const w = s.workflow;
                return {
                  id: s.id,
                  kind: 'workflow',
                  title: s.title,
                  workflowId: w.workflowId,
                  workflowName: w.name,
                  severity: w.severity,
                  summary: w.findings[0] ?? '',
                  findings: w.findings,
                  observations: w.observations,
                };
              }
              if (s.kind === 'observation') {
                return {
                  id: s.id,
                  kind: 'observation',
                  title: s.title,
                  obsId: s.obsId,
                  description: s.description,
                };
              }
              if (s.kind === 'note') {
                return { id: s.id, kind: 'note', title: s.title, content: s.content };
              }
              // Typed template blocks export as plain-language notes: the block
              // shape is a screen affordance; the export states what fills it —
              // by each block's own fill case, never invented.
              if (s.kind === 'tblock') {
                const t = s.tsec;
                // Hand-typed content (door 1) or the template's remembered
                // default (door 2) IS this section's export content.
                const typed = (manualFills[s.id] ?? t.savedContent ?? '').trim();
                const describeBlock = (b: NonNullable<TemplateSection['blocks']>[number]): string => {
                  if (b.kind === 'cards') return `${s.cards?.length ?? 0} finding${(s.cards?.length ?? 0) === 1 ? '' : 's'} render as repeating cards${b.idPattern ? ` (${b.idPattern})` : ''}${b.cardFields?.length ? ` with fields: ${b.cardFields.join(', ')}` : ''}.`;
                  if (b.kind === 'table') return `${b.columns?.length ? `Table — columns: ${b.columns.join(', ')}` : 'Table'}${b.linkedTo ? `. Auto-built from ${b.linkedTo}` : b.fill === 'manual' ? '. No data connected — filled in manually' : ''}.`;
                  if (b.kind === 'signoff') return 'Signature slots — signed by real people.';
                  if (b.kind === 'stat') return `Stat strip${b.slotLabels?.length ? ` (${b.slotLabels.join(', ')})` : ''}${b.fill === 'manual' ? ' — no data connected' : ''}.`;
                  if (b.kind === 'slot') return `Details${b.slotLabels?.length ? `: ${b.slotLabels.join(', ')}` : ''}.`;
                  if (b.kind === 'chart') return `${b.label ?? 'Chart'}${b.fill === 'manual' ? ' — no data connected' : ' — filled from query data'}.`;
                  if (b.fill === 'fixed') return (b.fixedBody ?? []).join(' ');
                  if (b.fill === 'human') return 'Awaiting response. Filled in by a person before the report is issued.';
                  if (b.fill === 'manual') return typed || 'No data connected — filled in manually.';
                  return s.composed ?? 'Filled from query data at generation.';
                };
                const content = t.blocks?.length
                  ? t.blocks.map(describeBlock).filter(Boolean).join(' ')
                  : t.kind === 'cards'
                    ? `${s.cards?.length ?? 0} finding${(s.cards?.length ?? 0) === 1 ? '' : 's'} render as repeating cards${t.idPattern ? ` (${t.idPattern})` : ''}${t.cardFields?.length ? ` with fields: ${t.cardFields.join(', ')}` : ''}.`
                    : t.kind === 'table'
                      ? `${t.columns?.length ? `Table — columns: ${t.columns.join(', ')}` : 'Table'}${t.linkedTo ? `. Auto-built from ${t.linkedTo}` : ''}.`
                      : t.kind === 'human'
                        ? 'Awaiting response. Filled in by a person before the report is issued.'
                        : t.fixed
                          ? (t.fixedBody ?? []).join(' ')
                          : (t.metric ?? s.composed ?? 'Filled from query data at generation.');
                return { id: s.id, kind: 'note', title: s.title, content };
              }
              // Exec summary + stats sections carry the KPI tiles so exports can
              // render the same ATR-style tile grid as the on-screen document.
              const statTiles = activeStats.map(st => ({ label: st.label, value: st.value, accent: statTone(st.color).hex }));
              if (s.kind === 'summary') {
                return { id: s.id, kind: 'summary', title: s.title, content: summaryOverride ?? s.content, stats: statTiles };
              }
              if (s.kind === 'stats') {
                return { id: s.id, kind: 'stats', title: s.title, stats: statTiles };
              }
              return { id: s.id, kind: s.kind, title: s.title };
            })}
            onClose={() => setShowDownloadModal(false)}
          />
        )}
      </AnimatePresence>


      {/* Generate ATR — editable Action Taken Report preview (same as Action Hub) */}
      {atrModalOpen && <GenerateATRModal onClose={() => setAtrModalOpen(false)} onSaveVersion={onSaveAtrVersion} />}

      {/* Confirm dialog — section delete from Contents */}
      <ConfirmDialog
        open={!!sectionPendingDelete}
        onClose={() => setSectionPendingDelete(null)}
        onConfirm={confirmDeleteSection}
        title="Remove section?"
        description={sectionPendingDelete && (
          <>This will remove <span className="font-semibold text-ink-800">{sectionPendingDelete.title}</span> from the report. This action cannot be undone.</>
        )}
        confirmLabel="Remove"
        destructive
      />

      {/* Add Observation modal — shared component */}
      <AddObservationModal
        open={showAddObservation}
        editing={editingObservation}
        nextObsId={nextObservationId()}
        onClose={closeAddObservation}
        onSave={handleObservationSave}
      />

    </motion.div>
  );
}
