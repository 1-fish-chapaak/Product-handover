// Single-report detail reader — the report-viewing surface and all of its
// child components (query cards, observation cards, workflow result cards,
// drawers, the add-query modal). Extracted wholesale from ReportsView so the
// landing (ReportsView) and the reader (this file) are separate concerns.

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import {
  FileText, Shield, AlertTriangle, CheckCircle2, BarChart3,
  TrendingUp, Download, Share2, ArrowLeft, ChevronDown,
  ChevronLeft, ChevronRight,
  Layout, X, Edit3, BookOpen, Upload, Lightbulb, Loader2, Trash2,
  List, LayoutGrid, GripVertical, Plus,
  MoreVertical, Eye, EyeOff, Database, PackageOpen, ExternalLink,
  MessageSquare, Paperclip, Send, Clock as ClockIcon, History,
  Layers, Check, RefreshCw, Lock, Sparkles,
} from 'lucide-react';
import EmptyState from '../shared/EmptyState';
import { ManageExceptionsLaunchButton } from './ManageExceptionsLaunchButton';
import UploadReportModal from './UploadReportModal';
import ConfirmDialog from './ConfirmDialog';
import GenerateATRModal from '../exceptions/GenerateATRModal';
import type { AtrReportData } from './atrTypes';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { REPORT_TEMPLATES } from '../../data/mockData';
import { REPORT_QUERIES_ATR, type ReportQueryAtr } from '../../data/reportQueries';
import { QUERY_GRAPHS, QUERY_TABLES } from '../../data/queryGraphs';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';
import { reportDisplayName } from './reportName';
import { ApplyTemplateDropdown } from './TemplateEditor';
import {
  SECTION_ICONS, TEMPLATE_THEME_GRADIENT, mergeTemplateOptions,
  computeQueryKpis, reportKind,
  type AttachedQuery, type WorkflowResult,
  CUSTOM_TEMPLATES,
  type QueryShape, type QueryComment, type GeneratedReport,
} from './reportShared';
import AddQueryModal from './AddQueryModal';
import QueryWidgetModal from './QueryWidgetModal';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import { KpiCountUp } from '../shared/KpiTile';
import { ReportBrandBanner, ReportMetaPanel, ReportNumberedHeading, ReportKpiTiles } from './ReportDocumentChrome';
import { statTone } from './reportTones';
import { renderAssistantText } from '../shared/AssistantMarkdown';
import { composeExecSummary, composeSectionContent, defForKey, workflowToQueryDef, type GeneratedQueryDef } from './templateQueryPool';
import ReportDownloadModal, { type DownloadPreviewSection } from './ReportDownloadModal';
import AddObservationModal, {
  computeNextObservationId,
  isImageMime,
  formatFileSize,
  attachmentVisual,
  type EditingObservationInput,
  type ObservationAttachment,
} from './AddObservationModal';

/**
 * Gates the "Manage Exceptions" CTA behind an explicit "Generate Cases" toggle.
 * idle → switch off; user flips it on → brief generating state; once ready the
 * toggle is replaced inline by the existing ManageExceptionsLaunchButton.
 */
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
      role="switch"
      aria-checked={isOn}
      aria-label={isOn ? 'Generating cases' : 'Generate cases'}
      onClick={handleToggle}
      disabled={isOn}
      className="inline-flex items-center gap-2 h-8 pl-2.5 pr-3 text-[12px] font-semibold text-ink-500 bg-white border border-canvas-border rounded-[8px] cursor-pointer hover:border-brand-600/40 hover:text-brand-600 transition-colors"
    >
      <span
        className={`relative inline-flex w-8 h-[18px] rounded-full transition-colors duration-200 ${
          isOn ? 'bg-brand-600' : 'bg-border'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={`absolute top-0.5 w-[14px] h-[14px] rounded-full bg-white shadow-sm ${
            isOn ? 'right-0.5' : 'left-0.5'
          }`}
        />
      </span>
      {isOn ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          Generating cases…
        </span>
      ) : (
        'Generate Cases'
      )}
    </button>
  );
}


function QueryCard({ query, index, onOpenQuery, onDelete, comments = [], onAddComment, title }: { query: QueryShape; index: number; onOpenQuery?: (query: { id: string; title: string }) => void; onDelete?: () => void; comments?: QueryComment[]; onAddComment?: (queryId: string, queryTitle: string, text: string, attachment?: string) => void; title?: string }) {
  const { addToast } = useToast();
  const { can } = useCan();
  const safeQuery = query ?? { id: '', risk: '', severity: '', title: '', addedBy: '', kpis: [], summary: '', findings: [], observations: [], answer: '', chartData: [] } as QueryShape;
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const availableGraphs = QUERY_GRAPHS[safeQuery.id] ?? [];
  const queryTable = QUERY_TABLES[safeQuery.id];
  const queryKpis = computeQueryKpis(safeQuery);
  const [selectedKpis, setSelectedKpis] = useState<Set<string>>(() => new Set(queryKpis.map(k => k.label)));
  const [selectedCharts, setSelectedCharts] = useState<Set<string>>(new Set());
  const [tableAttached, setTableAttached] = useState(false);
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

      <div className="px-7 py-6">
        {/* Meta band — type-only line: Q01 · risk · severity · status on the left;
            Manage Exceptions (text-link), Comments, 3-dots on the right. */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.15, duration: 0.35 }}
          className="mb-4"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap text-[10px] font-semibold uppercase tracking-wider">
              <span className="font-mono text-[12px] text-brand-600 tabular-nums shrink-0 normal-case tracking-normal">{query.id}</span>
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
                  <button
                    onClick={() => setCommentsOpen(true)}
                    title="Comments on this query"
                    aria-label="Comments on this query"
                    className="relative inline-flex items-center justify-center w-7 h-7 -mx-1 text-ink-400 rounded-[8px] cursor-pointer hover:text-brand-600 hover:bg-brand-50/50 transition-colors"
                  >
                    <MessageSquare size={16} className="shrink-0" />
                    {myComments > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 text-[9px] font-semibold bg-brand-600 text-white rounded-full tabular-nums border border-white">
                        {myComments}
                      </span>
                    )}
                  </button>
                );
              })()}
              <div className="relative -ml-1" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  title="More options"
                  aria-label="More options"
                  className="w-7 h-7 flex items-center justify-center rounded-[8px] text-ink-400 hover:text-brand-600 hover:bg-brand-50/50 transition-colors cursor-pointer"
                >
                  <MoreVertical size={16} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-10 z-10 w-[200px] bg-white border border-canvas-border rounded-[8px] shadow-xl py-1">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenQuery?.({ id: query.id, title: query.title });
                      }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-ink-500 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"
                    >
                      <ExternalLink size={14} />
                      Open Query
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); setWidgetModalOpen(true); }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-ink-500 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"
                    >
                      <LayoutGrid size={14} />
                      Add Widgets
                    </button>
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-ink-500 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"
                    >
                      <Download size={14} />
                      Download
                    </button>
                    {can('rp_delete') && <>
                    <div className="my-1 border-t border-canvas-border" />
                    <button
                      onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-risk-700 hover:bg-risk-50 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      Delete Query
                    </button>
                    </>}
                  </div>
                )}
              </div>
            </div>
          </div>

        </motion.div>

        {/* Title — the question, in Inter to match the rest of the report page. */}
        <motion.h3
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.2, duration: 0.35 }}
          className="text-[20px] font-semibold text-ink-800 leading-[1.3] tracking-[-0.005em] mb-4"
        >
          {query.title}
        </motion.h3>

        {/* Inline metrics — sit directly below the query title so the numbers
            read as the answer to the question above. Driven by the "Add
            Widgets" modal selection. */}
        {(() => {
          const kpis = queryKpis.filter(k => selectedKpis.has(k.label));
          if (kpis.length === 0) return null;
          return (
            <div className="flex items-baseline flex-wrap gap-x-6 gap-y-1.5 tabular-nums mb-5">
              {kpis.map((k, ki) => (
                <motion.span
                  key={k.label}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: baseDelay + 0.3 + ki * 0.05, duration: 0.3 }}
                  className="flex items-baseline gap-2"
                >
                  <span className="text-[16px] font-semibold text-ink-800 leading-none">
                    <KpiCountUp value={k.value} delay={120 + ki * 80} />
                  </span>
                  <span className="text-[12px] text-ink-400 font-medium">{k.label}</span>
                </motion.span>
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
            className="bg-canvas-elevated border border-canvas-border rounded-[12px] p-4 mb-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                <BarChart3 size={12} />
                {g.title}
              </div>
              <button
                onClick={() => setSelectedCharts(prev => { const n = new Set(prev); n.delete(g.id); return n; })}
                title="Remove graph"
                aria-label="Remove graph"
                className="w-6 h-6 flex items-center justify-center rounded-[8px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="h-[200px]">
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

        {/* Attached results table — selected via the "Add Widgets" modal */}
        {tableAttached && queryTable && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="bg-canvas-elevated border border-canvas-border rounded-[12px] p-4 mb-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                <LayoutGrid size={12} />
                Results Table
              </div>
              <button
                onClick={() => setTableAttached(false)}
                title="Remove table"
                aria-label="Remove table"
                className="w-6 h-6 flex items-center justify-center rounded-[8px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="overflow-x-auto rounded-[12px] border border-canvas-border">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-canvas">
                    {queryTable.columns.map(c => (
                      <th
                        key={c}
                        className="px-3 py-2 text-left text-[10px] font-bold text-ink-400 uppercase tracking-wider border-b border-canvas-border whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryTable.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-canvas-border last:border-b-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-[12px] text-ink-500 whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Answer — rendered in the chat's rich markdown format (shared renderer) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: baseDelay + 0.6, duration: 0.4 }}
        >
          {renderAssistantText(query.answer)}
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

      {widgetModalOpen && createPortal(
        <QueryWidgetModal
          queryId={query.id}
          queryTitle={query.title}
          kpis={queryKpis}
          charts={availableGraphs}
          table={queryTable}
          initialKpis={selectedKpis}
          initialCharts={selectedCharts}
          initialTable={tableAttached}
          onConfirm={(sel) => {
            setSelectedKpis(sel.kpis);
            setSelectedCharts(sel.charts);
            setTableAttached(sel.table);
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


// ─── Query side-sheet — Comments ───
function CommentDrawer({
  query,
  comments,
  onAddComment,
  onClose,
}: {
  query: QueryShape;
  comments: QueryComment[];
  onAddComment?: (queryId: string, queryTitle: string, text: string, attachment?: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  useFocusTrap(containerRef, true, onClose);

  // Show only comments belonging to the query the user clicked from.
  const queryComments = comments.filter(c => c.queryId === query.id);
  const grouped = queryComments.reduce<Record<string, { queryId: string; queryTitle: string; items: QueryComment[] }>>((acc, c) => {
    if (!acc[c.queryId]) acc[c.queryId] = { queryId: c.queryId, queryTitle: c.queryTitle, items: [] };
    acc[c.queryId].items.push(c);
    return acc;
  }, {});
  const queryGroups = Object.values(grouped);
  const totalComments = queryComments.length;

  const handlePost = () => {
    const body = text.trim();
    if (!body || isPosting) return;
    setIsPosting(true);
    // Optimistic — clear inputs immediately so the new entry appears posted.
    onAddComment?.(query.id, query.title, body, attachment ?? undefined);
    setText('');
    setAttachment(null);
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
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50"
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
        {/* Header strip + close */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-canvas-border bg-white">
          <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600">
            <MessageSquare size={14} className="shrink-0" />
            Comments
            <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 text-[10px] font-semibold rounded-full tabular-nums bg-brand-600/10 text-brand-600">
              {totalComments}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-400 hover:text-ink-800 hover:bg-brand-50 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Header (title + sub-text) */}
        <header className="shrink-0 px-6 py-5 border-b border-canvas-border">
          <h2 className="text-[16px] font-semibold text-ink-800 leading-tight">
            Comments
          </h2>
          <p className="text-[12px] text-ink-400 mt-0.5 leading-snug">
            Commenting on{' '}
            <span className="font-mono font-semibold text-brand-600">{query.id}</span> — {query.title}
          </p>
        </header>

        <>
            {/* Comment input */}
            <section className="shrink-0 px-6 py-4 border-b border-canvas-border">
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Leave a comment on ${query.id}…`}
                  rows={3}
                  className="w-full resize-none p-3 pr-[72px] bg-white border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setAttachment(f.name);
                  }}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-7 h-7 flex items-center justify-center text-ink-400 hover:text-brand-600 cursor-pointer"
                    aria-label="Attach file"
                    title="Attach file"
                  >
                    <Paperclip size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handlePost}
                    disabled={!text.trim() || isPosting}
                    className={`w-7 h-7 flex items-center justify-center rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 ${
                      text.trim() && !isPosting
                        ? 'bg-[#6a12cd] text-white hover:bg-brand-500 cursor-pointer'
                        : 'text-ink-400/50 cursor-not-allowed'
                    }`}
                    aria-label="Post comment"
                    title="Post comment"
                  >
                    {isPosting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </div>
              {attachment && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 h-6 px-2 bg-brand-600/10 text-brand-600 text-[11px] font-medium rounded-full">
                    <Paperclip size={12} />
                    {attachment}
                  </span>
                  <button onClick={() => setAttachment(null)} className="text-[11px] text-ink-400 hover:text-risk-700 cursor-pointer">remove</button>
                </div>
              )}
            </section>

            {/* Shared activity log */}
            <div className="flex-1 overflow-y-auto px-6 py-4" aria-live="polite">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Activity log</h3>
                <span className="text-[11px] text-ink-400 tabular-nums">
                  {totalComments} {totalComments === 1 ? 'comment' : 'comments'} across {queryGroups.length} {queryGroups.length === 1 ? 'query' : 'queries'}
                </span>
              </div>
              {queryGroups.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No comments yet"
                  body="Notes, questions, and decisions on this query will appear here."
                  size="compact"
                />
              ) : (
                <div className="space-y-4">
                  {queryGroups.map(group => (
                    <section key={group.queryId} className="border border-canvas-border rounded-[12px] overflow-hidden">
                      <header className={`px-3 py-2 bg-canvas border-b border-canvas-border flex items-center justify-between ${group.queryId === query.id ? 'bg-brand-600/5' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11px] font-bold text-brand-600 shrink-0">{group.queryId}</span>
                          <span className="text-[11px] text-ink-400 truncate">{group.queryTitle}</span>
                        </div>
                        <span className="text-[10px] text-ink-400 tabular-nums shrink-0">
                          {group.items.length} {group.items.length === 1 ? 'comment' : 'comments'}
                        </span>
                      </header>
                      <ol className="divide-y divide-border-light">
                        {group.items.slice().reverse().map(c => {
                          const isLong = c.text.length > 1000;
                          const isExpanded = expandedComments.has(c.id);
                          const displayText = isLong && !isExpanded ? c.text.slice(0, 1000) + '…' : c.text;
                          return (
                            <li key={c.id} className="px-3 py-3">
                              <div className="flex items-start gap-2.5">
                                <span className="shrink-0 w-7 h-7 rounded-full bg-brand-600/10 text-brand-600 flex items-center justify-center text-[10px] font-bold tracking-wider">
                                  {c.initials}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className="text-[12px] font-semibold text-ink-800">{c.author}</span>
                                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-400 tabular-nums whitespace-nowrap">
                                      <ClockIcon size={12} />
                                      {c.timestamp}
                                    </span>
                                  </div>
                                  <p className="text-[12px] text-ink-800 leading-relaxed whitespace-pre-wrap break-words">{displayText}</p>
                                  {isLong && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedComments(prev => {
                                        const next = new Set(prev);
                                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                                        return next;
                                      })}
                                      className="mt-1 text-[11px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded"
                                    >
                                      {isExpanded ? 'Show less' : 'Show more'}
                                    </button>
                                  )}
                                  {c.attachment && (
                                    <span className="mt-1.5 inline-flex items-center gap-1.5 h-6 px-2 bg-brand-600/10 text-brand-600 text-[11px] font-medium rounded-full">
                                      <Paperclip size={12} />
                                      {c.attachment}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  ))}
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
  key: string;
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
  onAddComment?: (queryId: string, queryTitle: string, text: string, attachment?: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  useFocusTrap(containerRef, true, onClose);

  // Newest first.
  const sorted = [...comments].reverse();

  const handlePost = () => {
    const body = text.trim();
    if (!body || isPosting) return;
    setIsPosting(true);
    // Report-level entries are tagged as global so they show across all surfaces.
    onAddComment?.('REPORT', `${reportName} — Report-level note`, body, attachment ?? undefined);
    setText('');
    setAttachment(null);
    window.setTimeout(() => setIsPosting(false), 120);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50"
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
        aria-label="Report activity log"
      >
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-brand-600/10 text-brand-600 flex items-center justify-center shrink-0">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-ink-800 leading-tight">Report Activity Log</h2>
              <p className="text-[12px] text-ink-400 mt-0.5 leading-snug">
                All actions and comments across every query card on this report.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-400 hover:text-ink-800 hover:bg-brand-50 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* Comment input with attachment */}
        <section className="shrink-0 px-6 py-4 border-b border-canvas-border bg-canvas">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment to the report activity log…"
              rows={3}
              className="w-full resize-none p-3 pr-10 bg-white border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
            />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setAttachment(f.name);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center text-ink-400 hover:text-brand-600 cursor-pointer"
              aria-label="Attach file"
              title="Attach file"
            >
              <Paperclip size={14} />
            </button>
          </div>
          {attachment && (
            <div className="mt-2 inline-flex items-center gap-1.5 h-6 px-2 bg-brand-600/5 text-brand-600 text-[11px] font-medium rounded-full">
              <Paperclip size={12} />
              {attachment}
              <button onClick={() => setAttachment(null)} className="hover:text-brand-600/70 cursor-pointer" aria-label="Remove attachment">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="mt-2 flex justify-end">
            <button
              onClick={handlePost}
              disabled={!text.trim() || isPosting}
              className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 ${
                text.trim() && !isPosting
                  ? 'bg-brand-600 text-white hover:bg-brand-600/90 cursor-pointer'
                  : 'bg-brand-600/40 text-white/80 cursor-not-allowed'
              }`}
            >
              {isPosting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {isPosting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </section>

        {/* Activity feed */}
        <div className="flex-1 overflow-y-auto px-6 py-4" aria-live="polite">
          {sorted.length === 0 ? (
            <EmptyState
              icon={History}
              title="No activity yet"
              body="Edits, comments, and downloads will be tracked here."
              size="compact"
            />
          ) : (
            <ol className="space-y-4">
              {sorted.map(c => (
                <li key={c.id} className="flex gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-brand-600/10 text-brand-600 flex items-center justify-center text-[11px] font-semibold">
                    {c.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3 mb-0.5">
                      <span className="text-[12px] font-semibold text-ink-800">{c.author}</span>
                      <span className="text-[11px] text-ink-400 tabular-nums whitespace-nowrap">{c.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-ink-400 mb-1.5">
                      <span className="inline-flex items-center h-4 px-1.5 font-mono font-medium bg-brand-600/5 text-brand-600 rounded">
                        {c.queryId}
                      </span>{' '}
                      <span className="ml-1 line-clamp-1">{c.queryTitle}</span>
                    </div>
                    <p className="text-[12px] text-ink-800 leading-relaxed">{c.text}</p>
                    {c.attachment && (
                      <button className="mt-1.5 inline-flex items-center gap-1.5 h-6 px-2 bg-brand-600/5 text-brand-600 text-[11px] font-medium rounded-full hover:bg-brand-600/10 cursor-pointer">
                        <Paperclip size={12} />
                        {c.attachment}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
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
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={section}
      dragControls={controls}
      dragListener={false}
      className="group/crow relative flex items-center gap-2 py-2.5 pl-1 pr-1 rounded-[8px] hover:bg-brand-50/30 transition-colors list-none cursor-default"
    >
      <button
        onPointerDown={(e) => { controls.start(e); }}
        aria-label="Drag to reorder"
        className="shrink-0 p-1 text-ink-400/40 hover:text-ink-400 cursor-grab active:cursor-grabbing opacity-20 group-hover/crow:opacity-100 transition-opacity touch-none"
      >
        <GripVertical size={14} />
      </button>
      <span className="shrink-0 w-6 text-[10px] text-ink-400/70 font-mono tabular-nums text-right">{String(index).padStart(2, '0')}</span>
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
          className="flex-1 min-w-0 bg-white border border-brand-600/40 rounded-[8px] px-2 py-1 text-[12px] text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-600/15"
        />
      ) : (
        <button
          onClick={onScroll}
          className="flex-1 min-w-0 text-left text-[12px] text-ink-500 truncate transition-colors cursor-pointer"
        >
          {section.title}
        </button>
      )}
      {!isEditing && (
        <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover/crow:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            aria-label="Rename section"
            className="p-1.5 rounded-[8px] text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete section"
            className="p-1.5 rounded-[8px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
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
        className="w-8 h-8 flex items-center justify-center rounded-[8px] text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
      >
        <MoreVertical size={16} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="w-[210px] bg-white border border-canvas-border rounded-[8px] shadow-xl py-1"
        >
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-ink-500 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"
          >
            <Edit3 size={14} />
            Edit observation
          </button>
          {hasAttachment && (
            <button
              onClick={() => { setOpen(false); onToggleAttachment(); }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-ink-500 hover:bg-brand-50 hover:text-brand-600 cursor-pointer"
            >
              {attachmentHidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {attachmentHidden ? 'Show attachment' : 'Hide attachment'}
            </button>
          )}
          <div className="my-1 border-t border-canvas-border/60" />
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-risk-700 hover:bg-risk-50 cursor-pointer"
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
      className={`relative bg-white overflow-hidden ${attached ? 'border-x border-b border-canvas-border' : 'border border-canvas-border rounded-[12px]'}`}
    >
      <div className="px-6 py-5">
        {/* Meta row — mirrors QueryCard */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.15, duration: 0.35 }}
          className="flex items-center justify-between mb-4 gap-4"
        >
          <div className="flex items-center gap-2.5 text-[11px] min-w-0">
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
          className="text-[15px] font-semibold text-ink-800 leading-[1.5] mb-5"
        >
          {obs.title}
        </motion.h3>

        {/* Description */}
        {obs.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: baseDelay + 0.4, duration: 0.4 }}
            className="text-[13px] text-ink-500 leading-relaxed mb-4 whitespace-pre-wrap"
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
                    className="block w-[88px] h-[88px] rounded-[12px] border border-canvas-border overflow-hidden bg-canvas cursor-zoom-in hover:border-brand-600/40 transition-colors"
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
                  className="inline-flex items-center gap-2 max-w-[260px] h-[36px] px-2.5 bg-canvas border border-canvas-border rounded-[8px] hover:border-brand-600/40 hover:bg-white transition-colors group"
                >
                  <Icon size={14} className={`shrink-0 ${tone}`} />
                  <span className="text-[12px] text-ink-800 font-medium truncate group-hover:text-brand-600">{att.name}</span>
                  <span className="text-[10px] text-ink-400 tabular-nums shrink-0">{formatFileSize(att.size)}</span>
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
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-[12px] shadow-2xl cursor-default"
          />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[12px] text-white/80 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm">
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
      className="relative border-x border-b border-canvas-border bg-white overflow-hidden"
    >
      <div className="px-6 py-5">
        {/* Meta row */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.15, duration: 0.35 }}
          className="flex items-center justify-between mb-4 gap-4"
        >
          <div className="flex items-center gap-2.5 text-[11px] min-w-0">
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
                className="w-8 h-8 flex items-center justify-center rounded-[8px] text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-10 w-[200px] bg-white border border-canvas-border rounded-[8px] shadow-xl py-1">
                  {onDelete && (
                    <button
                      onClick={() => { setMenuOpen(false); onDelete(); }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-risk-700 hover:bg-risk-50 cursor-pointer"
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
          <h3 className="text-[15px] font-semibold text-ink-800 leading-[1.5] mb-2">
            {workflow.name}
          </h3>

          {/* Risk owner — inline editable. Filled state renders as initials chip + name; empty state stays understated. */}
          <div className="flex items-center gap-2 text-[12px]">
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
                className="flex-1 max-w-[280px] px-2 py-1 text-[12px] text-ink-800 border border-brand-600/40 rounded-[8px] focus:outline-none focus:border-brand-600"
              />
            ) : workflow.riskOwner ? (
              <button
                onClick={() => { setOwnerDraft(workflow.riskOwner ?? ''); setEditingOwner(true); }}
                className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[8px] hover:bg-brand-50 transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600/15 text-brand-600 text-[10px] font-bold tabular-nums">
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
              <h4 className="flex items-center gap-2 text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-3">
                <span>{section.title}</span>
                {section.items.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-canvas text-ink-400 text-[10px] font-semibold tabular-nums">
                    {section.items.length}
                  </span>
                )}
              </h4>
              {section.items.length === 0 ? (
                <p className="text-[12px] text-ink-400 italic">{section.emptyCopy}</p>
              ) : (
                <ul className="space-y-2.5">
                  {section.items.map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: baseDelay + 0.4 + i * 0.05, duration: 0.3 }}
                      className="flex gap-2.5 text-[13px] text-ink-800 leading-relaxed"
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
              <h4 className="flex items-center gap-2 text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-3">
                <span>Output</span>
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-canvas text-ink-400 text-[10px] font-semibold tabular-nums">
                  {workflow.outputTable.rows.length}
                </span>
              </h4>
              <div className="border border-canvas-border rounded-[12px] overflow-hidden">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-canvas/70">
                      {workflow.outputTable.columns.map((col, ci) => (
                        <th
                          key={col}
                          className={`px-3 py-2 text-[10px] font-semibold text-ink-500 uppercase tracking-wider border-b border-canvas-border ${ci === workflow.outputTable!.columns.length - 1 ? 'text-right' : 'text-left'}`}
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
                        className="hover:bg-brand-50/30 transition-colors"
                      >
                        {row.map((cell, ci) => {
                          const cellStr = String(cell);
                          const isSeverity = cellStr === 'High' || cellStr === 'Medium' || cellStr === 'Low';
                          const isLast = ci === row.length - 1;
                          const isId = ci === 0;
                          return (
                            <td
                              key={ci}
                              className={`px-3 py-2 text-ink-800 border-b border-canvas-border/60 last:border-b-0 ${isLast ? 'text-right' : ''} ${isId ? 'font-mono text-[12px] text-ink-500 tabular-nums' : ''}`}
                            >
                              {isSeverity ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[8px] text-[10px] font-semibold ${
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
                <div className="flex items-center justify-between px-3 py-2 bg-canvas/40 border-t border-canvas-border/60 text-[11px] text-ink-400">
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

function DraggableQuerySection({
  section,
  index,
  sectionProps,
  onOpenQuery,
  onDelete,
  comments,
  onAddComment,
}: {
  section: { id: string; kind: 'query'; title: string; query: QueryShape };
  index: number;
  sectionProps: SectionProps;
  onOpenQuery?: (query: { id: string; title: string }) => void;
  onDelete: () => void;
  comments: QueryComment[];
  onAddComment: (queryId: string, queryTitle: string, text: string, attachment?: string) => void;
}) {
  return (
    <Reorder.Item {...sectionProps} className={`${sectionProps.className} relative`}>
      <QueryCard
        query={section.query}
        index={index}
        title={section.title}
        onOpenQuery={onOpenQuery}
        onDelete={onDelete}
        comments={comments}
        onAddComment={onAddComment}
      />
    </Reorder.Item>
  );
}

// ─── Attached Query Card — compact pending card for queries the user just attached ───

function AttachedQueryCard({ query, index, onRemove }: {
  query: AttachedQuery;
  index: number;
  onRemove: (id: string) => void;
}) {
  const KindIcon = query.kind === 'query' ? MessageSquare : query.kind === 'upload' ? Upload : Database;
  const kindLabel = query.kind === 'query' ? 'Saved Query' : query.kind === 'upload' ? 'Uploaded File' : 'Data Source';
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Resolve the modal label to a REPORT_QUERIES_ATR entry. Only saved queries
  // map to canned data; uploads and ad-hoc data sources have no preview.
  const resolved: ReportQueryAtr | null =
    query.kind === 'query' && QUERY_LABEL_TO_KEY[query.label]
      ? REPORT_QUERIES_ATR[QUERY_LABEL_TO_KEY[query.label]]
      : null;

  type Phase = 'syncing' | 'ready' | 'noPreview';
  const [phase, setPhase] = useState<Phase>('syncing');

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase(resolved ? 'ready' : 'noPreview');
    }, 1500);
    return () => clearTimeout(timer);
  }, [resolved]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white border border-canvas-border rounded-[12px] px-6 py-5"
    >
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-[8px] bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
          <KindIcon size={16} className="text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-brand-600/80">{kindLabel}</span>
            <span className="text-[10px] text-ink-400">·</span>
            <span className="text-[10px] text-ink-400">Attached {query.attachedAt} by {query.attachedBy}</span>
          </div>
          <h3 className="text-[14px] font-bold text-ink-800 tracking-tight leading-snug">{query.label}</h3>
        </div>
        <button
          onClick={() => setShowRemoveConfirm(true)}
          aria-label="Remove attached query"
          className="p-1.5 rounded-[8px] text-ink-400 hover:text-high-700 hover:bg-high-50 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
        >
          <X size={14} />
        </button>
      </div>
      <ConfirmDialog
        open={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={() => { setShowRemoveConfirm(false); onRemove(query.id); }}
        title="Remove attached query?"
        description={<>This will detach <span className="font-semibold text-ink-800">{query.label}</span> from the report. You can re-attach it later.</>}
        confirmLabel="Remove"
        destructive
      />

      <AnimatePresence mode="wait">
        {phase === 'syncing' && (
          <motion.div
            key="syncing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 border border-dashed border-brand-200 rounded-[12px] bg-brand-50/40 px-5 py-4 flex items-center gap-3"
          >
            <Loader2 size={14} className="text-brand-600 animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-brand-600 mb-0.5">Data syncing</p>
              <p className="text-[11px] text-ink-400">Running query against your data — preview will appear in a moment.</p>
            </div>
          </motion.div>
        )}

        {phase === 'ready' && resolved && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 space-y-4"
          >
            {/* Summary */}
            <div>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-ink-400 mb-1.5">Summary</div>
              <p className="text-[12px] leading-relaxed text-ink-800">{resolved.summary}</p>
            </div>

            {/* Findings */}
            {resolved.findings.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lightbulb size={12} className="text-evidence-700" />
                  <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-ink-400">Findings</span>
                  <span className="text-[10px] text-ink-400">·</span>
                  <span className="text-[10px] text-ink-400">{resolved.findings.length}</span>
                </div>
                <ul className="space-y-1.5">
                  {resolved.findings.map((f, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-ink-800 leading-relaxed">
                      <span className="text-evidence-700 shrink-0 mt-1">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Observations */}
            {resolved.observations.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Eye size={12} className="text-brand-600" />
                  <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-ink-400">Observations</span>
                  <span className="text-[10px] text-ink-400">·</span>
                  <span className="text-[10px] text-ink-400">{resolved.observations.length}</span>
                </div>
                <ul className="space-y-1.5">
                  {resolved.observations.map((o, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-ink-800 leading-relaxed">
                      <span className="text-brand-600 shrink-0 mt-1">•</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {phase === 'noPreview' && (
          <motion.div
            key="noPreview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 border border-dashed border-canvas-border rounded-[12px] bg-canvas/40 px-5 py-4 flex items-center gap-3"
          >
            <PackageOpen size={14} className="text-ink-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-ink-800 mb-0.5">Preview not available</p>
              <p className="text-[11px] text-ink-400">
                {query.kind === 'upload'
                  ? 'Uploaded files render once the parser finishes — wire your data pipeline to enable preview.'
                  : query.kind === 'source'
                    ? 'Connected data sources render once a query is run against them.'
                    : 'This query has no canned preview yet — connect it to your data to see results.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ─── Add Query Modal — picker for attaching a query/source to a report ───

// Maps modal labels to REPORT_QUERIES_ATR keys so the AttachedQueryCard can
// resolve to real summary/findings/observations after the simulated sync.
const QUERY_LABEL_TO_KEY: Record<string, keyof typeof REPORT_QUERIES_ATR> = {
  'Detect duplicate invoice entries across vendors': 'Q01',
  'Duplicate invoice detection summary': 'Q01',
  'Show unauthorized vendor master changes — last 90 days': 'Q02',
  'Unauthorized vendor master changes — quarterly review': 'Q02',
  'Risk identification across P2P, O2C, R2R, S2C processes': 'RA01',
  'Risk register — 12 critical risks across processes': 'RA01',
  'Mitigation strategy effectiveness — partially mitigated high risks': 'RA02',
  'Control testing results — effectiveness across 87 controls': 'CE01',
  'Control testing — effective vs requires remediation': 'CE01',
  'Workflow execution performance — runs and accuracy': 'WA01',
  'Exception trend analysis — flagged vs resolved': 'WA02',
  'Board-level GRC posture summary': 'EX01',
  'GRC posture for board reporting': 'EX01',
};


// ─── Report View (with multiple queries) ───
export default function ReportView({ report, onBack, onShare, onOpenQuery, initialTemplate, customTemplates = [], onAddQuery, onRemoveQuery, onUpdateDescription, onSaveAsTemplate, onSaveAtrVersion }: {
  report: GeneratedReport;
  onAddQuery: (reportId: string, query: AttachedQuery) => void;
  onRemoveQuery: (reportId: string, queryId: string) => void;
  onBack: () => void;
  onShare?: () => void;
  onManageExceptions?: () => void;
  onOpenQuery?: (query: { id: string; title: string }) => void;
  initialTemplate?: typeof REPORT_TEMPLATES[0] | null;
  customTemplates?: typeof REPORT_TEMPLATES[number][];
  onUpdateDescription?: (reportId: string, description: string) => void;
  onSaveAsTemplate?: (t: typeof REPORT_TEMPLATES[number]) => void;
  /** Save the Live ATR as a brand-new card in the ATR tab. */
  onSaveAtrVersion?: (label: string, data: AtrReportData) => void;
}) {
  const { addToast } = useToast();
  const { can } = useCan();
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
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
  // Apply Template control as active. Falls back to the seed constant so a
  // report made from a custom template still names it even after that template
  // is removed from the user's active list.
  const reportTemplate =
    REPORT_TEMPLATES.find(t => t.id === report.templateId) ??
    customTemplates.find(t => t.id === report.templateId) ??
    CUSTOM_TEMPLATES.find(t => t.id === report.templateId) ??
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
            className="w-full bg-canvas border border-canvas-border rounded-[8px] px-3 py-2 text-ink-800 text-[13px] leading-snug placeholder:text-ink-400 focus:outline-none focus:border-brand-400 focus:bg-white transition-colors resize-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={saveEditDesc}
              className="inline-flex items-center gap-1 h-7 px-3 bg-brand-600 text-white text-[11px] font-semibold rounded-[8px] hover:bg-brand-700 transition-colors cursor-pointer"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={cancelEditDesc}
              className="h-7 px-2.5 text-ink-500 text-[11px] font-medium hover:text-ink-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <span className="text-ink-400 text-[10px] ml-auto hidden sm:inline">⌘↵ Save · Esc Cancel</span>
          </div>
        </div>
      );
    }
    return (
      <div className="group/desc flex items-start gap-1.5 mb-3 -ml-0.5">
        <p className={`text-[13px] leading-snug pl-0.5 ${onDark ? 'text-white/75' : 'text-ink-500'}`}>
          {displayDescription || <span className={`italic ${onDark ? 'text-white/45' : 'text-ink-400'}`}>No description</span>}
        </p>
        <button
          onClick={startEditDesc}
          aria-label="Edit description"
          className={`shrink-0 p-1 -mt-0.5 rounded-[8px] opacity-0 group-hover/desc:opacity-100 focus-visible:opacity-100 transition-all duration-150 cursor-pointer ${onDark ? 'text-white/60 hover:text-white hover:bg-white/15' : 'text-ink-400 hover:text-brand-700 hover:bg-brand-50'}`}
        >
          <Edit3 size={12} />
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
      const anchorIdx = tmpl.findIndex(s => /quer(y|ies)|testing results|findings/i.test(s.name));
      const pre: SectionItem[] = [];
      const post: SectionItem[] = [];
      tmpl.forEach((s, i) => {
        if (/executive summary/i.test(s.name)) return; // covered by the summary block
        const block: SectionItem = {
          id: `sec-tmpl-${i}`,
          kind: 'note',
          title: s.name,
          content: composeSectionContent(s.name, evidence),
        };
        if (i === anchorIdx || (anchorIdx !== -1 && i < anchorIdx)) pre.push(block);
        else post.push(block);
      });
      return [...head, ...pre, ...bodyBlocks, ...post];
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
  const appliedTemplateId = appliedTemplate?.id ?? null;

  // Regenerate summary mock — overrides the summary section's content with an
  // alternative blurb after a short simulated delay so the action feels real.
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
  const [summaryOverride, setSummaryOverride] = useState<string | null>(null);
  const ALT_SUMMARY = "Updated review identifies three additional control gaps in the vendor master review workflow, with proposed remediation owners. Findings reflect data through this morning's reconciliation cycle.";

  useEffect(() => {
    const queries = appliedTemplateId && TEMPLATE_QUERIES[appliedTemplateId]
      ? TEMPLATE_QUERIES[appliedTemplateId]
      : seededQueries;
    setSections(buildInitialSections(queries));
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
    setSections(prev => prev.map(s =>
      s.id === id && s.kind === 'observation'
        ? { ...s, attachmentHidden: !s.attachmentHidden }
        : s
    ));
    setAppliedObservations(prev => prev.map(o =>
      o.id === id ? { ...o, attachmentHidden: !o.attachmentHidden } : o
    ));
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
    if (trimmed) renameSection(contentsEditingId, trimmed);
    setContentsEditingId(null);
  };
  const handleCancelContentsRename = () => {
    setContentsEditingId(null);
  };
  const confirmDeleteSection = () => {
    if (sectionPendingDelete) {
      const id = sectionPendingDelete.id;
      setSections(prev => prev.filter(s => s.id !== id));
      setAppliedObservations(prev => prev.filter(o => o.id !== id));
      addToast({ type: 'success', message: `"${sectionPendingDelete.title}" removed.` });
    }
    setSectionPendingDelete(null);
  };

  const ContentsBlock = () => {
    const coverSection = sections.find(s => s.kind === 'cover');
    const nonCoverSections = sections.filter(s => s.kind !== 'cover');
    if (nonCoverSections.length === 0) return null;
    return (
      <div className="border-x border-b border-canvas-border bg-white p-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <List size={16} className="text-brand-600" />
            <h3 className="text-[15px] leading-[20px] font-bold text-ink-800">Contents</h3>
          </div>
          <button
            onClick={openAddObservation}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-brand-600 bg-brand-50 border border-brand-600/15 rounded-[8px] hover:bg-brand-50/70 hover:border-brand-600/30 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Add Observation
          </button>
        </div>
        <Reorder.Group
          axis="y"
          values={nonCoverSections}
          onReorder={(newOrder) => {
            setSections(coverSection ? [coverSection, ...newOrder] : newOrder);
          }}
          as="ol"
          className="list-none p-0 m-0 space-y-0.5"
        >
          {nonCoverSections.map((section, i) => (
            <ContentsRow
              key={section.id}
              section={section}
              index={i + 1}
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
      </div>
    );
  };

  // Report-level activity log drawer (consolidates activity across all query cards).
  const [activityLogOpen, setActivityLogOpen] = useState(false);

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

  // Add Query modal — shown from the empty-state report layout.
  const [addQueryOpen, setAddQueryOpen] = useState(false);
  // Upload Report → Generate ATR flow — only offered on the ATR template (rt-007).
  const [uploadReportOpen, setUploadReportOpen] = useState(false);
  const isAtrReport = report.templateId === 'rt-007';
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
  const addComment = (queryId: string, queryTitle: string, text: string, attachment?: string) => {
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
        attachment,
      },
    ]);
  };

  const isReadOnly = report.isReadOnly === true || report.tag === 'Shared';
  const sharedByName = report.sharedByName ?? (report as { sharedBy?: string }).sharedBy;

  // ATR-style section numbering — position in the stream, cover excluded.
  // Reordering renumbers, like a real document.
  const sectionNumber = (id: string) =>
    sections.filter(s => s.kind !== 'cover').findIndex(s => s.id === id) + 1;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={launching ? { opacity: 0.88, x: 16 } : { opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="report-printable h-full overflow-y-auto bg-canvas"
    >
      <div className="px-[124px] py-8 flex-col md:flex-row">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-brand-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded">
              <ArrowLeft size={14} /> Back to Reports
            </button>
            {isReadOnly && (
              <span className="bg-canvas border border-canvas-border px-3 h-8 inline-flex items-center gap-2 rounded-full text-[11px] text-ink-500">
                <Lock size={12} aria-hidden="true" />
                <span>
                  View-only{sharedByName ? <> · shared by {sharedByName}</> : ''}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 relative">
            {!isReadOnly && (
              <div className="relative">
                <button
                  onClick={() => setShowApplyTemplate(p => !p)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-canvas-border text-[12px] font-medium text-ink-500 hover:bg-white hover:border-brand-600/30 transition-colors cursor-pointer bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded-[8px]"
                >
                  <Layout size={14} />
                  <span className="truncate max-w-[220px]">{appliedTemplate?.name ?? reportTemplate?.name ?? 'Apply Template'}</span>
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
                      />
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
            {onShare && can('rp_share') && (
              <button onClick={onShare} className="flex items-center gap-1.5 px-3 py-2 border border-canvas-border text-[12px] font-medium text-ink-500 hover:bg-white hover:border-brand-600/30 transition-colors cursor-pointer bg-white rounded-[8px]">
                <Share2 size={14} /> Share
              </button>
            )}
            <button
              onClick={() => setShowDownloadModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-canvas-border text-[12px] font-medium text-ink-500 hover:bg-white hover:border-brand-600/30 transition-colors cursor-pointer bg-white rounded-[8px]"
            >
              <Download size={14} /> Download
            </button>
            {!isReadOnly && !report.isEmpty && onSaveAsTemplate && (
              <button
                onClick={handleSaveAsTemplate}
                title="Save this report's structure as a custom template"
                className="flex items-center gap-1.5 px-3 py-2 border border-canvas-border text-[12px] font-medium text-ink-500 hover:bg-white hover:border-brand-600/30 transition-colors cursor-pointer bg-white rounded-[8px]"
              >
                <BookOpen size={14} /> Save as template
              </button>
            )}
          </div>
        </div>

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
                className="flex items-center gap-3 px-6 py-4 glass-card-strong rounded-[12px] shadow-lg"
              >
                <Loader2 size={20} className="text-brand-600 animate-spin" />
                <span className="text-[14px] font-semibold text-ink-800">Applying template...</span>
              </motion.div>
            </motion.div>
          )}
          {pendingTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-[2px]"
              onClick={() => setPendingTemplate(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="switch-template-title"
                className="relative bg-white rounded-[16px] border border-canvas-border shadow-2xl w-[320px] p-6"
                onClick={e => e.stopPropagation()}
              >
                <h3 id="switch-template-title" className="text-[15px] font-semibold text-ink-800 mb-2">Switch template?</h3>
                <p className="text-[13px] text-ink-500 leading-relaxed mb-5">
                  Switching to “{pendingTemplate.name}” replaces the current layout and its sections. Some content may not carry over.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setPendingTemplate(null)}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] text-[13px] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-canvas transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { const t = pendingTemplate; setPendingTemplate(null); applyTemplateNow(t); }}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-5 rounded-[8px] text-[13px] font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                  >
                    Switch
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {report.isEmpty ? (
          <>
            {/* Empty-state Cover — light letterhead, simpler body */}
            <div className="rounded-[12px] overflow-hidden mb-5 border border-canvas-border bg-white">
              <ReportBrandBanner
                title={reportDisplayName(report.name)}
                gradient={report.theme ? TEMPLATE_THEME_GRADIENT[report.theme] : undefined}
                actions={!isReadOnly && (
                  <>
                    {isAtrReport && (
                      <button
                        onClick={() => setUploadReportOpen(true)}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-white bg-white/10 border border-white/25 rounded-[8px] hover:bg-white/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                      >
                        <Upload size={14} />
                        Upload Report
                      </button>
                    )}
                    <button
                      onClick={() => setAddQueryOpen(true)}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-brand-700 bg-white rounded-[8px] hover:bg-white/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                    >
                      <Plus size={14} />
                      Add Query
                    </button>
                  </>
                )}
              >
                {reportTemplate?.desc && <p className="text-[13px] text-white/75 mb-3">{reportTemplate.desc}</p>}
                <div className="flex items-center gap-1.5 text-[13px] flex-wrap">
                  <span className="font-semibold text-white">{report.generatedBy}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{report.generatedAt}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{reportTemplate?.sections.length ?? 0} {reportTemplate?.sections.length === 1 ? 'section' : 'sections'}</span>
                  {report.tag === 'Bulk Audit' && (
                    <span className="inline-flex items-center gap-1 px-2 h-5 ml-1 text-[10px] font-semibold whitespace-nowrap rounded-full bg-white/15 text-white border border-white/25">
                      Bulk Audit
                    </span>
                  )}
                </div>
              </ReportBrandBanner>
              <div className="px-9 py-6">
                {/* Prepared By / Generated On live in the banner byline. */}
                <ReportMetaPanel
                  items={[
                    { label: 'Report ID', value: report.id?.toUpperCase() },
                    { label: 'Template', value: reportTemplate?.name },
                    { label: 'Report Type', value: report.tag ?? 'Internal Audit' },
                    { label: 'Audit Period', value: report.reportPeriod },
                  ]}
                />
              </div>
            </div>

            {/* Section blocks — render template sections with empty placeholders.
                When a section is the "queries" section (e.g., Audit Queries) and
                queries have been attached, the cards slot inside that section. */}
            {(() => {
              const sections = reportTemplate?.sections ?? [];
              const attached = report.attachedQueries ?? [];
              const queriesSectionIndex = sections.findIndex(s => /quer(y|ies)/i.test(s.name));
              const hasQueriesSection = queriesSectionIndex !== -1;

              // Resolve attached saved queries to their rich content (same
              // label→key lookup AttachedQueryCard uses) so the surrounding
              // sections can compose real content instead of placeholders.
              // Recomputes on every attach/remove since attachedQueries flows
              // through props.
              const seenKeys = new Set<string>();
              const attachedDefs = attached
                .filter(q => q.kind === 'query')
                .map(q => QUERY_LABEL_TO_KEY[q.label])
                .filter((k): k is keyof typeof REPORT_QUERIES_ATR => Boolean(k) && !seenKeys.has(k) && Boolean(seenKeys.add(k)))
                .map(k => defForKey(k))
                .filter((d): d is GeneratedQueryDef => d !== null);
              const execText = attachedDefs.length > 0
                ? composeExecSummary(reportTemplate?.name ?? report.name, attachedDefs)
                : null;
              const recBullets = attachedDefs.flatMap(d => d.observations).slice(0, 6);

              return (
                <div className="space-y-4">
                  {sections.map((section, i) => {
                    const Icon = SECTION_ICONS[section.icon] || FileText;
                    const isQueriesSection = i === queriesSectionIndex;
                    const renderQueriesHere = isQueriesSection && attached.length > 0;

                    if (renderQueriesHere) {
                      return (
                        <motion.div
                          key={`${section.name}-${i}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="space-y-3"
                        >
                          <div className="flex items-center gap-2.5 px-1">
                            <Icon size={16} className="text-brand-600" />
                            <h3 className="text-[14px] font-bold text-ink-800 tracking-tight">{section.name}</h3>
                            <span className="text-[10px] text-ink-400">·</span>
                            <span className="text-[10px] text-ink-400">{attached.length}</span>
                          </div>
                          <AnimatePresence>
                            {attached.map((q, qi) => (
                              <AttachedQueryCard
                                key={q.id}
                                query={q}
                                index={qi}
                                onRemove={(id) => onRemoveQuery(report.id, id)}
                              />
                            ))}
                          </AnimatePresence>
                        </motion.div>
                      );
                    }

                    return (
                      <motion.section
                        key={`${section.name}-${i}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="bg-white border border-canvas-border rounded-[12px] px-6 py-5"
                      >
                        <div className="flex items-center gap-2.5 mb-3">
                          <Icon size={16} className="text-brand-600" />
                          <h3 className="text-[14px] font-bold text-ink-800 tracking-tight">{section.name}</h3>
                        </div>
                        {/* Composed from attached queries where the section maps to
                            query content; dashed placeholder otherwise. */}
                        {/executive summary/i.test(section.name) && execText ? (
                          <p className="text-[14px] text-ink-700 leading-relaxed">{execText}</p>
                        ) : /recommendation|insight/i.test(section.name) && recBullets.length > 0 ? (
                          <ul className="space-y-2">
                            {recBullets.map((b, bi) => (
                              <li key={bi} className="flex gap-2.5 text-[14px] text-ink-700 leading-relaxed">
                                <span className="text-brand-600 mt-px shrink-0">•</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        ) : /appendix/i.test(section.name) && attached.length > 0 ? (
                          <ul className="space-y-1.5">
                            {attached.map(q => (
                              <li key={q.id} className="flex items-baseline gap-2 text-[12.5px] text-ink-500">
                                <span className="font-medium text-ink-800">{q.label}</span>
                                <span className="text-[11px] text-ink-400">Attached {q.attachedAt} by {q.attachedBy}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="border border-dashed border-canvas-border rounded-[12px] bg-canvas/40 px-6 py-7 text-center">
                            <p className="text-[12px] text-ink-400/80">
                              {attached.length > 0
                                ? `${section.name} will be generated from your attached queries.`
                                : `Section content generated from ${report.name} data`}
                            </p>
                          </div>
                        )}
                      </motion.section>
                    );
                  })}

                  {/* Fallback — template has no queries section, so render attached queries above remaining sections */}
                  {!hasQueriesSection && attached.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5 px-1">
                        <MessageSquare size={16} className="text-brand-600" />
                        <h3 className="text-[14px] font-bold text-ink-800 tracking-tight">Attached Queries</h3>
                        <span className="text-[10px] text-ink-400">·</span>
                        <span className="text-[10px] text-ink-400">{attached.length}</span>
                      </div>
                      <AnimatePresence>
                        {attached.map((q, qi) => (
                          <AttachedQueryCard
                            key={q.id}
                            query={q}
                            index={qi}
                            onRemove={(id) => onRemoveQuery(report.id, id)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {(!reportTemplate || sections.length === 0) && (
                    <div className="bg-white border border-canvas-border rounded-[12px] px-6 py-12 text-center">
                      <p className="text-[13px] text-ink-400">This template has no sections defined.</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        ) : appliedTemplate ? (
          <>
            {/* Report Cover — light letterhead with theme accent,
                metadata grid attached below. */}
            <div className="rounded-[12px] overflow-hidden mb-5 border border-canvas-border bg-white">
              <ReportBrandBanner
                title={reportDisplayName(report.name)}
                gradient={report.theme ? TEMPLATE_THEME_GRADIENT[report.theme] : undefined}
                actions={
                  <>
                    {canGenerateAtr && (
                    <button
                      onClick={() => setAtrModalOpen(true)}
                      title="Open the live Action Taken Report"
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-white bg-white/10 border border-white/25 rounded-[8px] hover:bg-white/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      <FileText size={14} />
                      Live ATR
                    </button>
                    )}
                    <button
                      onClick={() => setActivityLogOpen(true)}
                      title="View this report's activity log"
                      aria-label="View report activity log"
                      className="w-9 h-9 rounded-[8px] flex items-center justify-center text-white/85 bg-white/10 border border-white/25 hover:bg-white/20 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      <History size={16} />
                    </button>
                    <button
                      onClick={() => addToast({ type: 'success', message: 'Generating report summary…' })}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12.5px] font-semibold text-brand-700 bg-white rounded-[8px] hover:bg-white/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <Sparkles size={13} />
                      Generate Summary
                    </button>
                  </>
                }
              >
                <EditableDescription onDark />
                <div className="flex items-center gap-1.5 text-[13px] flex-wrap">
                  <span className="font-semibold text-white">{report.generatedBy}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{report.generatedAt}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{activeQueries.length} {activeQueries.length === 1 ? 'query' : 'queries'}</span>
                  {/* When a template is applied, show only the applied-template chip. */}
                  <span className="inline-flex items-center h-6 px-2.5 ml-1 text-[11px] font-medium text-white bg-white/15 border border-white/25 rounded-full whitespace-nowrap">
                    {appliedTemplate.name}
                  </span>
                </div>
              </ReportBrandBanner>
              <div className="px-9 py-6">
                {/* Template chip, Scope, Prepared By and Generated On live in the banner byline. */}
                <ReportMetaPanel
                  items={[
                    { label: 'Report ID', value: report.id?.toUpperCase() },
                    { label: 'Report Type', value: report.tag ?? 'Internal Audit' },
                    { label: 'Audit Period', value: report.reportPeriod },
                  ]}
                />
              </div>
            </div>

            {/* Contents — read-only list of template-defined sections */}
            {appliedTemplate.sections && appliedTemplate.sections.length > 0 && (
              <div className="border border-canvas-border rounded-[12px] bg-white p-6 mb-5">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <List size={16} className="text-brand-600" />
                    <h3 className="text-[15px] leading-[20px] font-bold text-ink-800">Contents</h3>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={openAddObservation}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-brand-600 bg-brand-50 border border-brand-600/15 rounded-[8px] hover:bg-brand-50/70 hover:border-brand-600/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                    >
                      <Plus size={14} />
                      Add Observation
                    </button>
                  )}
                </div>
                <Reorder.Group
                  axis="y"
                  values={appliedObservations}
                  onReorder={setAppliedObservations}
                  as="ol"
                  className="list-none p-0 m-0 space-y-0.5"
                >
                  {appliedTemplate.sections.map((s, i) => (
                    <li key={`${s.name}-${i}`} className="flex items-center gap-2 py-2.5 pl-1 pr-1 rounded-[8px] hover:bg-brand-50/30 transition-colors">
                      <span className="shrink-0 w-6 text-[10px] text-ink-400/70 font-mono tabular-nums text-right">{String(i + 1).padStart(2, '0')}</span>
                      <span className="flex-1 min-w-0 text-[12px] text-ink-500 truncate">{s.name}</span>
                    </li>
                  ))}
                  {appliedObservations.map((o, i) => {
                    const idx = (appliedTemplate.sections?.length ?? 0) + i + 1;
                    return (
                      <ContentsRow
                        key={o.id}
                        section={o}
                        index={idx}
                        isEditing={contentsEditingId === o.id}
                        draftValue={contentsDraft}
                        onDraftChange={setContentsDraft}
                        onStartEdit={() => handleStartContentsRename(o as unknown as SectionItem)}
                        onSaveEdit={() => {
                          if (!contentsEditingId) return;
                          const trimmed = contentsDraft.trim();
                          if (trimmed) {
                            setAppliedObservations(prev => prev.map(x => x.id === contentsEditingId ? { ...x, title: trimmed } : x));
                          }
                          setContentsEditingId(null);
                        }}
                        onCancelEdit={handleCancelContentsRename}
                        onScroll={() => scrollToSection(o.id)}
                        onDelete={() => setAppliedObservations(prev => prev.filter(x => x.id !== o.id))}
                      />
                    );
                  })}
                </Reorder.Group>
              </div>
            )}

            {/* Summary Stats Bar — ATR-style KPI tiles */}
            <div className="mb-5">
              <ReportKpiTiles stats={activeStats} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={appliedTemplate.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {/* Template body — same engine as wizard-generated reports:
                    section cards with composed starter prose, real QueryCards
                    slotted at the anchor section. Replaces the retired
                    hardcoded TemplateLayout fakes. */}
                {(() => {
                  const tmplSections = appliedTemplate.sections ?? [];
                  const anchorIdx = tmplSections.findIndex(s => /quer(y|ies)|testing results|findings/i.test(s.name));
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
                      {tmplSections.map((s, i) => {
                        const Icon = SECTION_ICONS[s.icon] || FileText;
                        const isExec = /executive summary/i.test(s.name);
                        const content = isExec
                          ? composeExecSummary(appliedTemplate.name, activeQueries)
                          : composeSectionContent(s.name, activeQueries);
                        return (
                          <div key={`${s.name}-${i}`} className="space-y-4">
                            <div className="bg-white rounded-[12px] border border-canvas-border p-5">
                              <h3 className="text-[13px] font-bold text-ink-800 mb-2 flex items-center gap-2">
                                <Icon size={14} className="text-brand-600" /> {s.name}
                              </h3>
                              <p className="text-[14px] text-ink-700 leading-relaxed">{content}</p>
                            </div>
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
              <Reorder.Group axis="y" values={sections} onReorder={setSections} as="div" className="list-none p-0 m-0 [&>*:last-child>*]:rounded-b-[12px]">
                {sections.map((section, i) => {
                  // `key` is intentionally NOT in here — React requires keys to
                  // be passed directly on each element, never via a spread prop.
                  const sectionProps = {
                    value: section,
                    id: `section-${section.id}`,
                    layout: true as const,
                    initial: { opacity: 0, y: 8 },
                    animate: { opacity: 1, y: 0 },
                    exit: { opacity: 0, y: -4, scale: 0.98 },
                    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
                    className: 'scroll-mt-4 list-none',
                    dragListener: false as const,
                  };

                  if (section.kind === 'cover') {
                    const scopeLabel = isBulkAudit
                      ? (() => { const n = sections.filter(s => s.kind === 'workflow').length; return `${n} ${n === 1 ? 'workflow' : 'workflows'}`; })()
                      : (() => { const n = sections.filter(s => s.kind === 'query').length; return `${n} ${n === 1 ? 'query' : 'queries'}`; })();
                    return [
                      <Reorder.Item {...sectionProps} key={`${section.id}-item`}>
                        <ReportBrandBanner
                          title={reportDisplayName(report.name)}
                          className="rounded-t-[12px]"
                          gradient={report.theme ? TEMPLATE_THEME_GRADIENT[report.theme] : undefined}
                          actions={
                            <>
                              {canGenerateAtr && (
                              <button
                                onClick={() => setAtrModalOpen(true)}
                                title="Generate Action Taken Report"
                                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-white bg-white/10 border border-white/25 rounded-[8px] hover:bg-white/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                              >
                                <FileText size={14} />
                                Generate ATR
                              </button>
                              )}
                              <button
                                onClick={() => setActivityLogOpen(true)}
                                title="View this report's activity log"
                                aria-label="View report activity log"
                                className="w-9 h-9 rounded-[8px] flex items-center justify-center text-white/85 bg-white/10 border border-white/25 hover:bg-white/20 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                              >
                                <History size={16} />
                              </button>
                              <button
                                onClick={() => addToast({ type: 'success', message: 'Generating report summary…' })}
                                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12.5px] font-semibold text-brand-700 bg-white rounded-[8px] hover:bg-white/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                              >
                                <Sparkles size={13} />
                                Generate Summary
                              </button>
                            </>
                          }
                        >
                          <EditableDescription onDark />
                          <div className="flex items-center gap-1.5 text-[13px] flex-wrap">
                            <span className="font-semibold text-white">{report.generatedBy}</span>
                            <span className="text-white/30 mx-0.5">|</span>
                            <span className="text-white/70">{report.generatedAt}</span>
                            <span className="text-white/30 mx-0.5">|</span>
                            <span className="text-white/70">{scopeLabel}</span>
                            {report.tag === 'Bulk Audit' && (
                              <span className="inline-flex items-center gap-1 px-2 h-5 ml-1 text-[10px] font-semibold whitespace-nowrap rounded-full bg-white/15 text-white border border-white/25">
                                Bulk Audit
                              </span>
                            )}
                          </div>
                        </ReportBrandBanner>
                      </Reorder.Item>,
                      <div key={`${section.id}-meta`} className="border-x border-b border-canvas-border bg-white px-9 py-6">
                        {/* Scope, Prepared By and Generated On live in the banner byline. */}
                        <ReportMetaPanel
                          items={[
                            { label: 'Report ID', value: report.id?.toUpperCase() },
                            { label: 'Report Type', value: report.tag ?? 'Internal Audit' },
                            { label: 'Template', value: reportTemplate?.name },
                            { label: 'Audit Period', value: report.reportPeriod },
                          ]}
                        />
                      </div>,
                      <ContentsBlock key={`${section.id}-contents`} />,
                    ];
                  }

                  if (section.kind === 'summary') {
                    const hasQueries = sections.some(s => s.kind === 'query');
                    return (
                      <Reorder.Item key={section.id} {...sectionProps}>
                        <div className="border-x border-b border-canvas-border bg-white px-9 pt-7 pb-6">
                          <ReportNumberedHeading
                            n={sectionNumber(section.id)}
                            title={section.title}
                            subtitle={isBulkAudit ? 'Overall workflow result rollup' : 'Overall observation and action plan rollup'}
                            right={hasQueries && (
                              <button
                                onClick={() => {
                                  if (isRegeneratingSummary) return;
                                  setIsRegeneratingSummary(true);
                                  setTimeout(() => {
                                    setSummaryOverride(ALT_SUMMARY);
                                    setIsRegeneratingSummary(false);
                                    addToast({ type: 'success', message: 'Executive summary regenerated.' });
                                  }, 1200);
                                }}
                                disabled={isRegeneratingSummary}
                                aria-busy={isRegeneratingSummary || undefined}
                                title="Regenerate this summary with the latest queries"
                                className="group/regen inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-brand-600 bg-brand-50 border border-brand-600/20 rounded-[8px] hover:bg-brand-50/70 hover:border-brand-600/35 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {isRegeneratingSummary ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <RefreshCw size={12} className="transition-transform duration-300 group-hover/regen:rotate-180" />
                                )}
                                {isRegeneratingSummary ? 'Regenerating…' : 'Regenerate'}
                              </button>
                            )}
                          />
                          <div className="pb-5 border-b border-canvas-border mb-5">
                            <ReportKpiTiles stats={activeStats} animate />
                          </div>
                          <p className="text-[14px] text-ink-700 leading-relaxed">{summaryOverride ?? section.content}</p>
                        </div>
                      </Reorder.Item>
                    );
                  }

                  if (section.kind === 'stats') {
                    return (
                      <Reorder.Item key={section.id} {...sectionProps}>
                        <div className="border-x border-b border-canvas-border bg-white px-9 py-6">
                          <ReportKpiTiles stats={activeStats} />
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
                        <div className="border-x border-b border-canvas-border bg-white px-9 pt-7 pb-6">
                          <ReportNumberedHeading n={sectionNumber(section.id)} title={section.title} />
                          <p className="text-[13px] text-ink-800 leading-relaxed">{section.content}</p>
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
                <div className="border-x border-b border-canvas-border bg-canvas/60 rounded-b-[12px] px-9 py-3 flex items-center justify-center">
                  <span className="text-[11px] text-ink-400 tracking-wide">{report.footerText}</span>
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      {/* Report-level activity log drawer */}
      <AnimatePresence>
        {activityLogOpen && (
          <ReportActivityLogDrawer
            reportName={report.name}
            comments={comments}
            onAddComment={addComment}
            onClose={() => setActivityLogOpen(false)}
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
            sections={sections.map((s): DownloadPreviewSection => {
              if (s.kind === 'query') {
                const q = s.query;
                const kpis = computeQueryKpis(q).map(k => ({ label: k.label, value: k.value }));
                const charts = QUERY_GRAPHS[q.id] ?? [];
                const table = QUERY_TABLES[q.id] ?? null;
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
                  table,
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

      {/* Add Query modal — opened from empty-state cover */}
      <AddQueryModal
        open={addQueryOpen}
        onClose={() => setAddQueryOpen(false)}
        onAttach={(selection) => {
          const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          onAddQuery(report.id, {
            id: `aq-${Date.now()}`,
            kind: selection.kind,
            label: selection.label,
            attachedAt: today,
            attachedBy: report.generatedBy,
          });
          const verb = selection.kind === 'upload' ? 'Uploaded' : 'Attached';
          addToast({ type: 'success', message: `${verb} "${selection.label}" — data syncing…` });
        }}
      />

      {/* Upload Report → Generate ATR modal — opened from the ATR report cover */}
      {uploadReportOpen && <UploadReportModal onClose={() => setUploadReportOpen(false)} />}

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
