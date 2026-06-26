import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronDown, FileCode,
  Database, BarChart3, Copy, Download,
  Wand2, HelpCircle,
  Check, Search, ListChecks, MessageSquare, Share2,
  History as HistoryIcon, Clock, PanelRightClose,
} from 'lucide-react';
import type { ArtifactTab } from '../../hooks/useAppState';
import Gated from '../shared/Gated';
import { useToast } from '../shared/Toast';
import { SEED as DATA_SOURCE_SEED, TYPE_META, formatDate, type DataSource } from '../data-sources/sources';
import { type ComposerContext, editPlanContext, editCodeContext } from '../chat/composerContext';
import { QueryExecutionPlanCard, AssumptionsCard, type PlanCardStep } from '../shared/PlanCards';

interface ArtifactPanelProps {
  activeTab: ArtifactTab;
  setActiveTab: (t: ArtifactTab) => void;
  onClose: () => void;
  onManageExceptions?: () => void;
  onAddToReport?: () => void;
  onShareResults?: () => void;
  /** Navigate to the Knowledge Hub (data sources) — invoked from the Open
   *  action on a Source card. Hooked from App to setView('data-sources'). */
  onOpenInKnowledgeHub?: (sourceName: string) => void;
  /** Pre-fill the chat composer with a draft prompt and close the panel.
   *  Used by the "Edit assumptions" action on the Plan tab so users adjust
   *  the run via natural language instead of an inline editor. */
  onComposeInChat?: (draft: string) => void;
  /** Hands a canvas CTA off to the chat composer as a focused "context mode"
   *  (Plan ▸ Edit, Code ▸ Edit) — matches the workflow-builder canvas. Keeps
   *  the panel open so the artifact stays visible beside the composer. */
  onCanvasAction?: (ctx: ComposerContext) => void;
  /** Optional override for the Plan tab body. When provided, it replaces the
   *  default (chat) PlanTab — used by the Workflow Executor to show that
   *  workflow's own plan while reusing the rest of this QnA workspace. */
  planSlot?: React.ReactNode;
  /** Executor-only: when true, appends a "History" tab showing this
   *  workflow's past runs. Chat Q&A reuses this panel without it, so the
   *  tab (and the run-history view) never appear there. */
  showHistory?: boolean;
}

// Counts must match CHAT_PLAN_STEPS.length and QUERY_SOURCES.length defined below.
const TABS: { id: ArtifactTab; label: string; icon: React.ElementType; count?: number }[] = [
  { id: 'plan', label: 'Plan', icon: ListChecks, count: 5 },
  { id: 'code', label: 'Code', icon: FileCode },
  { id: 'sources', label: 'Sources', icon: Database, count: 5 },
];

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children, actions }: { title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode; actions?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="group relative rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.18)]">
      <div className="flex items-center px-4 py-3 hover:bg-paper-50/60 transition-colors">
        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          aria-expanded={open}
          className="flex-1 flex items-center gap-2 text-[0.875rem] font-semibold tracking-tight text-ink-900 cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Icon size={14} className="text-primary shrink-0" />
          <span className="flex-1 text-left">{title}</span>
        </button>
        {actions && <div className="flex items-center gap-1 ml-2">{actions}</div>}
        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          aria-label={open ? 'Collapse section' : 'Expand section'}
          aria-expanded={open}
          className="ml-1 p-1 text-ink-400 hover:text-ink-700 hover:bg-brand-50 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <ChevronDown size={14} className={`transition-transform duration-150 ${open ? '' : '-rotate-90'}`} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-canvas-border">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PlanAssumption {
  key: string;
  value: string;
}

const PLAN_ASSUMPTIONS: PlanAssumption[] = [
  { key: 'Date range',       value: 'Full FY26 (Apr 2025 – Mar 2026)' },
  { key: 'Amount tolerance', value: '± 5% on invoice amounts' },
  { key: 'Vendor scope',     value: 'All vendors in SAP AP Module' },
  { key: 'Matching logic',   value: 'Fuzzy match on invoice number + vendor + amount' },
  { key: 'Excluded',         value: 'Voided and reversed invoices' },
  { key: 'Currency',         value: 'INR (converted at booking rate)' },
];

// Chat/QnA execution-plan steps, in the shared PlanCard shape so they render
// through the same QueryExecutionPlanCard the workflow builder uses (numbered
// steps + type badge + expandable source chips).
const CHAT_PLAN_STEPS: PlanCardStep[] = [
  {
    id: 'parse', name: 'Parse user query', type: 'extract',
    description: 'Identified intent: risk analysis query for the P2P process.',
  },
  {
    id: 'sources', name: 'Identify data sources', type: 'extract',
    description: 'Selected SAP ERP AP Module and Vendor Master Data.',
    sources: [
      { id: 'sap-ap', name: 'SAP ERP AP Module', type: 'sql',
        columns: ['Vendor', 'Invoice No', 'Amount', 'PO Ref', 'GL Account', 'Posting Date', 'Currency'] },
      { id: 'vendor-master', name: 'Vendor Master Data', type: 'sql',
        columns: ['Vendor ID', 'Vendor', 'Bank Account', 'Status', 'Risk Flag'] },
    ],
  },
  {
    id: 'plan', name: 'Generate query plan', type: 'analyze',
    description: 'Built SQL joins across 3 tables with a risk-severity filter.',
  },
  {
    id: 'execute', name: 'Execute query', type: 'validate',
    description: 'Processed 1.2M records, filtered to 9 matching risks.',
  },
  {
    id: 'format', name: 'Format results', type: 'summarize',
    description: 'Generated the table view with severity indicators and control mapping.',
  },
];

// Flat shimmer placeholder shown while the plan "regenerates" — matches the
// QueryExecutionPlanCard chrome (rounded-xl border, header + step rows) so the
// swap reads as the same card thinking, not a different surface.
function PlanRegenerateSkeleton() {
  return (
    <div
      className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden"
      role="status"
      aria-label="Regenerating plan"
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <ListChecks size={14} className="text-brand-400 shrink-0" />
        <span className="text-[13px] font-medium text-ink-500">Regenerating plan…</span>
      </div>
      <ul className="flex flex-col border-t border-canvas-border">
        {[0, 1, 2].map(i => (
          <li key={i} className={`px-4 py-3 ${i > 0 ? 'border-t border-canvas-border/70' : ''}`}>
            <div className="flex items-start gap-3">
              <span className="size-2.5 rounded-full bg-paper-100 shrink-0 mt-[7px] animate-pulse" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-paper-100 animate-pulse" />
                <div className="h-2.5 w-3/4 rounded bg-paper-50 animate-pulse" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanTab({
  steps = CHAT_PLAN_STEPS,
  assumptions = PLAN_ASSUMPTIONS,
  onComposeInChat,
  onCanvasAction,
}: {
  steps?: PlanCardStep[];
  assumptions?: PlanAssumption[];
  onComposeInChat?: (draft: string) => void;
  onCanvasAction?: (ctx: ComposerContext) => void;
} = {}) {
  const { addToast } = useToast();
  // Regenerate-plan affordance: briefly swap the plan for a flat shimmer
  // skeleton, then re-show it. Self-contained — no ChatView involvement.
  const [regenerating, setRegenerating] = useState(false);

  // Compose the chat draft from the current assumption set so the user
  // sees what they're editing and where to type their change. Falls back to
  // a toast if the host didn't wire the chat composer.
  const handleEditAssumptions = () => {
    if (!onComposeInChat) {
      addToast({ type: 'info', message: 'Edit via chat is not available in this view.' });
      return;
    }
    const lines = assumptions.map(a => `• ${a.key}: ${a.value}`).join('\n');
    onComposeInChat(`Update assumptions for this query — currently:\n${lines}\n\nWhat should change? `);
  };

  const handleRegenerate = () => {
    setRegenerating(true);
    setTimeout(() => setRegenerating(false), 1200);
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Query Execution Plan — shared with the workflow-builder canvas. */}
      {regenerating ? (
        <PlanRegenerateSkeleton />
      ) : (
        <QueryExecutionPlanCard
          steps={steps}
          onEdit={onCanvasAction ? () => onCanvasAction(editPlanContext(steps.length)) : undefined}
          onRegenerate={handleRegenerate}
          onStepEdit={(step) => onComposeInChat?.(`Refine this step — "${step.name}": ${step.description}\n\nWhat should change? `)}
        />
      )}
      {/* Assumptions — shared with the workflow-builder canvas. */}
      <AssumptionsCard
        assumptions={assumptions}
        context="query"
        onEdit={onComposeInChat ? handleEditAssumptions : undefined}
      />
    </div>
  );
}

function CodeTab({ onCanvasAction }: { onCanvasAction?: (ctx: ComposerContext) => void } = {}) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  const sql = `SELECT
  r.id AS risk_id,
  r.name AS risk_name,
  r.severity,
  COUNT(c.id) AS control_count,
  SUM(CASE WHEN c.is_key THEN 1 ELSE 0 END) AS key_controls
FROM risks r
LEFT JOIN controls c ON c.risk_id = r.id
WHERE r.bp_id = 'p2p'
  AND r.severity IN ('critical', 'high')
GROUP BY r.id, r.name, r.severity
ORDER BY
  CASE r.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
  END;`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      addToast({ type: 'error', message: 'Could not copy SQL to clipboard' });
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'query.sql';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ type: 'success', message: 'SQL downloaded as query.sql' });
    } catch {
      addToast({ type: 'error', message: 'Download failed' });
    }
  };

  return (
    <div className="space-y-3 pt-4">
      <CollapsibleSection
        title="Generated SQL Query"
        icon={FileCode}
        actions={onCanvasAction ? (
          <button
            type="button"
            onClick={() => onCanvasAction(editCodeContext('query.sql', 'SQL'))}
            title="Edit query in chat"
            className="text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 hover:bg-brand-50 px-2 py-1 rounded-md cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            Edit
          </button>
        ) : undefined}
      >
        <div className="mt-3 relative">
          <pre className="bg-ink-900 text-paper-50 rounded-lg p-4 text-[0.75rem] font-mono overflow-x-auto leading-relaxed">
            <code>{sql}</code>
          </pre>
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={handleDownload}
              aria-label="Download SQL"
              title="Download as query.sql"
              className="p-1.5 bg-ink-700 hover:bg-ink-600 text-paper-50 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <Download size={12} />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Copied!' : 'Copy SQL'}
              title={copied ? 'Copied!' : 'Copy to clipboard'}
              className={`p-1.5 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                copied ? 'bg-brand-600 text-white' : 'bg-ink-700 hover:bg-ink-600 text-paper-50'
              }`}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Execution Stats" icon={BarChart3} defaultOpen={true}>
        <div className="grid grid-cols-3 gap-2 pt-3">
          {[
            { label: 'Records scanned', value: '1.2M' },
            { label: 'Query time',      value: '0.3s' },
            { label: 'Results',         value: '9' },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-lg border border-canvas-border bg-canvas px-3 py-2.5"
            >
              <div className="text-[1.25rem] font-semibold text-ink-900 leading-none tabular-nums">
                {stat.value}
              </div>
              <div className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-500 mt-1.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// IDs of Knowledge Hub sources that this query touched. In production this
// list comes from the query payload (which sources the planner read from);
// for the mock we hard-code the two sources the audit-result demo uses.
// IDs of Knowledge Hub sources that this query touched. In production this
// list comes from the query payload (which sources the planner read from).
// For the mock we surface one example of every supported source kind —
// databases, file formats (XLSX / CSV / PDF), API, cloud, session — so the
// workspace panel demonstrates the full surface area of the Knowledge Hub
// without listing 30 rows.
// Per-query source binding: which Knowledge Hub source was read AND which
// of its columns the query used. In production this list comes from the
// query payload; for the mock we hard-code the audit-result demo set.
interface QuerySource {
  id: string;
  columnsUsed: string[];
}

const QUERY_SOURCES: QuerySource[] = [
  { id: 'db-05', columnsUsed: ['query_id', 'rows_scanned', 'duration_ms'] },
  { id: 'f-01',  columnsUsed: ['Date', 'Region', 'Amount'] },
  { id: 'f-03',  columnsUsed: ['Vendor', 'Invoice ID', 'Amount'] },
  { id: 'f-05',  columnsUsed: ['Loan ID', 'Borrower', 'Principal'] },
  { id: 'f-17',  columnsUsed: [
    'Payment Date', 'Settlement number', 'Submitting Merchant ID', 'Terminal ID',
    'Batch Number', 'Transaction Timestamp', 'Transaction Amount', 'Settlement Amount',
    'MCC', 'Merchant Name (DBA)',
  ] },
];

function SourcesTab({
  onOpenInKnowledgeHub,
  onComposeInChat,
}: {
  onOpenInKnowledgeHub?: (name: string) => void;
  onComposeInChat?: (draft: string) => void;
} = {}) {
  const rows = QUERY_SOURCES
    .map(q => {
      const src = DATA_SOURCE_SEED.find(s => s.id === q.id);
      return src ? { src, columnsUsed: q.columnsUsed } : null;
    })
    .filter((r): r is { src: DataSource; columnsUsed: string[] } => r !== null);

  return (
    <div
      className="grid gap-3 pt-4"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))' }}
    >
      {rows.map(({ src, columnsUsed }, i) => (
        <SourceCard
          key={src.id}
          source={src}
          columnsUsed={columnsUsed}
          index={i}
          onOpenInKnowledgeHub={onOpenInKnowledgeHub}
          onComposeInChat={onComposeInChat}
        />
      ))}
    </div>
  );
}

// Workspace source card — mirrors the Knowledge Hub card chrome but adds a
// "Using N columns" footer that lists the columns this query actually read.
// The Change action sends the user back to the chat composer with a prompt
// to swap columns; the assistant validates against the source's available
// columns and re-runs the query.
function SourceCard({
  source, columnsUsed, index, onOpenInKnowledgeHub, onComposeInChat,
}: {
  source: DataSource;
  columnsUsed: string[];
  index: number;
  onOpenInKnowledgeHub?: (name: string) => void;
  onComposeInChat?: (draft: string) => void;
}) {
  const { addToast } = useToast();
  const { icon: Icon, tone } = TYPE_META[source.type];
  const available = source.columns ?? [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleOpen = () => {
    if (onOpenInKnowledgeHub) onOpenInKnowledgeHub(source.name);
    else addToast({ type: 'info', message: `Opening ${source.name}…` });
  };

  // Picker path — staged selection → diff prompt routed through chat for
  // the assistant to validate and re-run. Keeps the "AI owns the plan"
  // contract while letting the user pick columns directly.
  const handleApplyColumns = (nextColumns: string[]) => {
    setPickerOpen(false);
    if (!onComposeInChat) {
      addToast({ type: 'info', message: 'Change via chat is not available in this view.' });
      return;
    }
    const added = nextColumns.filter(c => !columnsUsed.includes(c));
    const removed = columnsUsed.filter(c => !nextColumns.includes(c));
    if (added.length === 0 && removed.length === 0) return;
    onComposeInChat(
      `Update the columns read from ${source.name}.\n` +
      (added.length ? `Add: ${added.join(', ')}\n` : '') +
      (removed.length ? `Remove: ${removed.join(', ')}\n` : '') +
      `\nResulting set (${nextColumns.length}): ${nextColumns.join(', ')}\n\n` +
      `Re-run with this column set?`
    );
  };

  // Chat path — drops the user directly in the composer with a free-form
  // prompt listing what's used + what's available; the assistant decides
  // what to change.
  const handleDescribeInChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onComposeInChat) {
      addToast({ type: 'info', message: 'Change via chat is not available in this view.' });
      return;
    }
    onComposeInChat(
      `Change columns used from ${source.name} — currently:\n` +
      `Used: ${columnsUsed.join(', ') || '(none)'}\n` +
      `Available: ${available.join(', ') || '(unknown)'}\n\n` +
      `Which columns should change? `
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 + index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="group w-full rounded-lg bg-canvas-elevated border border-canvas-border hover:border-brand-200 transition-colors"
    >
      {/* Primary row — opens the source in Knowledge Hub */}
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center gap-3 px-4 h-16 rounded-t-lg hover:bg-brand-50/30 transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
        aria-label={`Open ${source.name} in Knowledge Hub`}
      >
        <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.8125rem] font-semibold text-ink-900 truncate">{source.name}</div>
          <div className="text-[0.75rem] text-ink-500 mt-0.5 tabular-nums truncate">
            {source.subtype} · <span className="text-ink-400">{formatDate(source.createdAt)}</span>
          </div>
        </div>
      </button>

      {/* Columns footer — informational summary + Change button which opens
          the column picker popover anchored to it. */}
      {available.length > 0 && (
        <div className="relative border-t border-canvas-border/70 px-4 py-2 flex items-center gap-2 min-w-0">
          <span className="text-[0.75rem] text-ink-500 shrink-0">
            Using <span className="font-mono tabular-nums text-ink-700">{columnsUsed.length}</span> of{' '}
            <span className="font-mono tabular-nums text-ink-700">{available.length}</span>:
          </span>
          <span className="text-[0.75rem] font-mono text-ink-700 truncate flex-1" title={columnsUsed.join(', ')}>
            {columnsUsed.join(', ') || '(none)'}
          </span>
          <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
            <button
              ref={pickBtnRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); setPickerOpen(o => !o); }}
              aria-expanded={pickerOpen}
              aria-label={`Pick columns from ${source.name}`}
              title="Pick columns"
              className="inline-flex items-center gap-1 h-7 px-2.5 text-[0.75rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border hover:text-brand-700 hover:bg-brand-50 hover:border-brand-200 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <ListChecks size={11} strokeWidth={2.25} />
              Pick
            </button>
            <button
              type="button"
              onClick={handleDescribeInChat}
              aria-label={`Describe column change for ${source.name} in chat`}
              title="Describe in chat"
              className="inline-flex items-center gap-1 h-7 px-2.5 text-[0.75rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border hover:text-brand-700 hover:bg-brand-50 hover:border-brand-200 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <MessageSquare size={11} strokeWidth={2.25} />
              Chat
            </button>
          </div>

          <AnimatePresence>
            {pickerOpen && (
              <ColumnPicker
                anchorRef={pickBtnRef}
                sourceName={source.name}
                available={available}
                initialSelection={columnsUsed}
                onApply={handleApplyColumns}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// Column picker popover — anchored to the Change button on a SourceCard.
// Shows every available column with a checkbox; checked columns are the
// ones the query is currently using. Search filters in place. Apply hands
// the new selection up to the parent (which routes through the chat for
// the assistant to validate and re-run). Click-outside / Escape dismiss.
function ColumnPicker({
  anchorRef, sourceName, available, initialSelection, onApply, onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  sourceName: string;
  available: string[];
  initialSelection: string[];
  onApply: (next: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelection));
  // Position the popover via portal-mounted fixed coords so it escapes
  // the workspace panel's overflow-hidden ancestor. Aligned to the right
  // edge of the anchor button (where the user clicked); flipped to stay
  // inside the viewport horizontally and vertically.
  const PICKER_W = 340;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 12;
      let left = r.right - PICKER_W;
      if (left < margin) left = margin;
      if (left + PICKER_W + margin > window.innerWidth) left = window.innerWidth - PICKER_W - margin;
      // Default: drop down below the button. If there isn't ~360px of room,
      // flip above.
      const estHeight = 380;
      let top = r.bottom + 8;
      if (top + estHeight > window.innerHeight && r.top > estHeight + 16) {
        top = r.top - estHeight - 8;
      }
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(
    () => available.filter(c => c.toLowerCase().includes(query.toLowerCase())),
    [available, query]
  );
  const dirty = useMemo(() => {
    if (selected.size !== initialSelection.length) return true;
    return initialSelection.some(c => !selected.has(c));
  }, [selected, initialSelection]);

  // Diff summary for the footer — shows the user what they're about to send.
  const { addCount, removeCount } = useMemo(() => {
    const initial = new Set(initialSelection);
    let add = 0; let remove = 0;
    selected.forEach(c => { if (!initial.has(c)) add++; });
    initial.forEach(c => { if (!selected.has(c)) remove++; });
    return { addCount: add, removeCount: remove };
  }, [selected, initialSelection]);

  const toggle = (col: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(filtered.length ? filtered : available));
  const clearAll = () => {
    if (query) setSelected(prev => { const n = new Set(prev); filtered.forEach(c => n.delete(c)); return n; });
    else setSelected(new Set());
  };

  if (!pos) return null;

  // Group the filtered set into Selected (top) and Available (below) so the
  // user sees their picks first; sort each section alphabetically for
  // scannability. Stable order between renders keeps row layout from
  // jumping while the user toggles.
  const initial = new Set(initialSelection);
  const grouped = {
    selected: filtered.filter(c => selected.has(c)).sort((a, b) => a.localeCompare(b)),
    rest:     filtered.filter(c => !selected.has(c)).sort((a, b) => a.localeCompare(b)),
  };

  return createPortal(
    <>
      <motion.div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: 'linear' }}
      />
      <motion.div
        role="dialog"
        aria-label={`Columns used from ${sourceName}`}
        initial={{ opacity: 0, y: -8, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.96 }}
        transition={{
          opacity: { duration: 0.14, ease: [0.16, 1, 0.3, 1] },
          y:       { type: 'spring', stiffness: 600, damping: 30, mass: 0.5 },
          scale:   { type: 'spring', stiffness: 600, damping: 30, mass: 0.5 },
        }}
        style={{ top: pos.top, left: pos.left, width: PICKER_W, transformOrigin: 'top right' }}
        className="fixed z-[61] rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_24px_48px_-20px_rgba(15,8,30,0.28),0_4px_12px_-6px_rgba(15,8,30,0.08)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — tight: selected count + dirty badge + close.
            Source name is implicit (user just clicked Pick on that card). */}
        <div className="flex items-center gap-2 px-3.5 h-10 border-b border-canvas-border">
          <span className="text-[0.6875rem] uppercase tracking-[0.08em] font-semibold text-ink-500">Columns</span>
          <span className="inline-flex items-center h-[20px] px-1.5 rounded-full bg-paper-50 border border-canvas-border text-[0.6875rem] tabular-nums shrink-0">
            <span className="text-ink-800 font-semibold">{selected.size}</span>
            <span className="text-ink-400">/{available.length}</span>
          </span>
          <AnimatePresence>
            {dirty && (
              <motion.span
                key="dirty-pill"
                initial={{ opacity: 0, scale: 0.7, x: -4 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.7, x: -4 }}
                transition={{ type: 'spring', stiffness: 560, damping: 26 }}
                className="inline-flex items-center gap-1 px-1.5 h-[20px] rounded-full bg-brand-50 text-brand-700 text-[0.75rem] font-medium shrink-0"
              >
                <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
                {addCount + removeCount} change{addCount + removeCount === 1 ? '' : 's'}
              </motion.span>
            )}
          </AnimatePresence>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close picker"
            className="size-7 -mr-1 inline-flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-paper-100 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Search — primary input. With 100+ columns this is the main nav,
            so it gets a roomy field and stays anchored at the top. */}
        <div className="px-3 py-2 border-b border-canvas-border">
          <div className="relative group/search">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 group-focus-within/search:text-brand-500 transition-colors pointer-events-none"
            />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${available.length} columns…`}
              className="no-focus-ring w-full pl-8 pr-8 h-9 text-[0.75rem] text-ink-800 placeholder:text-ink-400 bg-canvas-elevated border border-canvas-border hover:border-ink-300 rounded-md outline-none focus:border-brand-400 transition-colors"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-5 text-ink-400 hover:text-ink-700 hover:bg-paper-100 rounded transition-colors cursor-pointer"
              >
                <X size={11} />
              </button>
            ) : (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[0.625rem] font-mono text-ink-300 pointer-events-none">{available.length}</span>
            )}
          </div>
        </div>

        {/* List — grouped: Selected on top, Available below. Section headings
            stick on scroll so the user always knows which group they're in,
            even at 100+ columns. */}
        <div className="max-h-[320px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-[0.75rem] text-ink-500 text-center">
              <Search size={16} className="mx-auto mb-2 text-ink-300" />
              No columns match "<span className="font-medium text-ink-700">{query}</span>"
            </div>
          ) : (
            <>
              {grouped.selected.length > 0 && (
                <SectionHeading
                  label="Selected"
                  count={grouped.selected.length}
                  totalCount={selected.size}
                  showTotal={!!query}
                  action={query ? null : { label: 'Clear', onClick: clearAll }}
                />
              )}
              {grouped.selected.map(col => (
                <ColumnRow
                  key={col}
                  col={col}
                  isChecked={true}
                  isChanged={!initial.has(col)}
                  onToggle={() => toggle(col)}
                />
              ))}
              {grouped.rest.length > 0 && (
                <SectionHeading
                  label="Available"
                  count={grouped.rest.length}
                  totalCount={available.length - selected.size}
                  showTotal={!!query}
                  action={{ label: 'Select all', onClick: selectAll }}
                />
              )}
              {grouped.rest.map(col => (
                <ColumnRow
                  key={col}
                  col={col}
                  isChecked={false}
                  isChanged={initial.has(col)}
                  onToggle={() => toggle(col)}
                />
              ))}
              {query && filtered.length < available.length && (
                <div className="px-4 py-2 text-[0.6875rem] text-ink-400 text-center border-t border-canvas-border/70">
                  Showing {filtered.length} of {available.length} · clear search to see all
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-canvas-border px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.6875rem] tabular-nums flex items-center gap-1.5 min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                {dirty ? (
                  <motion.span
                    key="dirty"
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.14 }}
                    className="inline-flex items-center gap-1.5"
                  >
                    {addCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-compliant-700 font-semibold">+{addCount}</span>
                    )}
                    {removeCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-risk-700 font-semibold">−{removeCount}</span>
                    )}
                    <span className="text-ink-400">to apply</span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="clean"
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.14 }}
                    className="text-ink-400"
                  >
                    No changes
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="h-7 px-2.5 text-[0.75rem] font-medium text-ink-600 hover:bg-paper-100 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Cancel
              </button>
              <motion.button
                type="button"
                onClick={() => onApply(Array.from(selected))}
                disabled={!dirty || selected.size === 0}
                whileTap={dirty && selected.size > 0 ? { scale: 0.96 } : undefined}
                transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                className="h-7 px-3 text-[0.75rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:bg-ink-100 disabled:text-ink-400 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Apply
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </>,
    document.body
  );
}

// Section heading inside the column picker — sticky on scroll so the user
// always sees which group they're in. Includes a count and an optional
// action (e.g. "Select all" / "Clear") that scopes to this section.
function SectionHeading({
  label, count, totalCount, showTotal, action,
}: {
  label: string;
  count: number;
  totalCount?: number;
  showTotal?: boolean;
  action?: { label: string; onClick: () => void } | null;
}) {
  return (
    <motion.div
      layout="position"
      transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.55 }}
      className="sticky top-0 z-10 bg-canvas-elevated/95 backdrop-blur-sm border-b border-canvas-border/70 px-4 py-1.5 flex items-center gap-1.5"
    >
      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-ink-500">{label}</span>
      <span className="font-mono text-[0.625rem] tabular-nums text-ink-400">
        {showTotal && totalCount !== undefined ? `${count}/${totalCount}` : count}
      </span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="ml-auto h-5 px-1.5 text-[0.75rem] font-medium text-ink-500 hover:text-brand-700 hover:bg-brand-50 rounded transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

// Individual checkbox row — animates between Selected and Available sections
// via framer-motion's `layout` so toggling never causes a teleport.
function ColumnRow({
  col, isChecked, isChanged, onToggle,
}: { col: string; isChecked: boolean; isChanged: boolean; onToggle: () => void }) {
  return (
    <motion.button
      layout="position"
      transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.55 }}
      type="button"
      role="menuitemcheckbox"
      aria-checked={isChecked}
      onClick={onToggle}
      className={`group/row w-full flex items-center gap-2.5 px-4 py-1.5 text-left transition-colors cursor-pointer focus:outline-none focus-visible:bg-brand-50/40 ${
        isChecked ? 'hover:bg-brand-50/60' : 'hover:bg-paper-50/70'
      }`}
    >
      <span className={`inline-flex items-center justify-center size-[18px] rounded-[5px] shrink-0 transition-[background-color,border-color,box-shadow] duration-150 ${
        isChecked
          ? 'bg-brand-600 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]'
          : 'bg-canvas-elevated border border-ink-300 group-hover/row:border-ink-500'
      }`}>
        <motion.span
          initial={false}
          animate={{ scale: isChecked ? 1 : 0, opacity: isChecked ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 540, damping: 26 }}
          className="inline-flex"
        >
          <Check size={12} strokeWidth={3} className="text-white" />
        </motion.span>
      </span>
      <span className={`text-[0.75rem] truncate transition-colors flex-1 ${isChecked ? 'text-ink-900 font-medium' : 'text-ink-700'}`}>
        {col}
      </span>
      {isChanged && (
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 24 }}
          className={`size-1.5 rounded-full shrink-0 ${isChecked ? 'bg-compliant' : 'bg-risk'}`}
          aria-label={isChecked ? 'Will be added' : 'Will be removed'}
          title={isChecked ? 'Will be added on Apply' : 'Will be removed on Apply'}
        />
      )}
    </motion.button>
  );
}

// Claude-style highlight-to-improve toolbar. Lives at the panel root and
// watches text selections inside the panel content area. When the user
// selects ≥3 chars, a small floating toolbar appears above the selection
// with two actions: Improve (regenerate just this selection) and Explain
// (clarify what this means). Wired to toasts in this build — actual model
// regeneration is a future scope.
function HighlightToolbar({ scopeRef }: { scopeRef: React.RefObject<HTMLDivElement | null> }) {
  const { addToast } = useToast();
  const [popover, setPopover] = useState<{ x: number; y: number; text: string } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setPopover(null); return; }
      const text = sel.toString().trim();
      if (text.length < 3) { setPopover(null); return; }
      const range = sel.getRangeAt(0);
      // Only react when selection is inside our scope (the artifact panel
      // content area). Selections elsewhere (chat, sidebar) are ignored.
      if (!scope.contains(range.commonAncestorContainer)) { setPopover(null); return; }
      const rect = range.getBoundingClientRect();
      const scopeRect = scope.getBoundingClientRect();
      setPopover({
        x: rect.left - scopeRect.left + rect.width / 2,
        y: rect.top - scopeRect.top,
        text,
      });
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [scopeRef]);

  // Dismiss on outside click / Escape.
  useEffect(() => {
    if (!popover) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopover(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopover(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [popover]);

  if (!popover) return null;
  const preview = popover.text.length > 60 ? popover.text.slice(0, 57) + '…' : popover.text;
  return (
    <div
      ref={popoverRef}
      role="toolbar"
      aria-label="Selection actions"
      style={{ left: popover.x, top: popover.y }}
      className="absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+8px)] flex items-center gap-0.5 px-1 py-1 rounded-lg bg-ink-900 text-canvas-elevated shadow-lg shadow-ink-900/20"
    >
      <button
        type="button"
        onClick={() => { addToast({ type: 'info', message: `Improving: "${preview}"` }); setPopover(null); window.getSelection()?.removeAllRanges(); }}
        className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-[0.75rem] font-medium hover:bg-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <Wand2 size={13} />
        <span>Improve</span>
      </button>
      <button
        type="button"
        onClick={() => { addToast({ type: 'info', message: `Explaining: "${preview}"` }); setPopover(null); window.getSelection()?.removeAllRanges(); }}
        className="inline-flex items-center gap-1 px-2 h-7 rounded-md text-[0.75rem] font-medium hover:bg-ink-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <HelpCircle size={13} />
        <span>Explain</span>
      </button>
    </div>
  );
}

// Executor-only run history. The Workflow Executor passes showHistory to
// surface this; chat Q&A reuses ArtifactPanel without it, so the tab and
// this view never appear there. Mock data — production reads the run log.
interface WorkflowRun {
  id: string;
  startedAt: string;
  status: 'success' | 'failed';
  records: number | null;
  flagged: number | null;
  durationMs: number | null;
  trigger: string;
  failReason?: string;
}

const RUN_HISTORY: WorkflowRun[] = [
  { id: '#1248', startedAt: 'Jun 14, 2026 · 09:00', status: 'success', records: 1204388, flagged: 9,  durationMs: 312, trigger: 'Scheduled · daily 09:00' },
  { id: '#1247', startedAt: 'Jun 13, 2026 · 09:00', status: 'success', records: 1198742, flagged: 7,  durationMs: 298, trigger: 'Scheduled · daily 09:00' },
  { id: '#1246', startedAt: 'Jun 12, 2026 · 09:00', status: 'failed',  records: null,    flagged: null, durationMs: null, trigger: 'Scheduled · daily 09:00', failReason: 'Source timeout' },
  { id: '#1245', startedAt: 'Jun 11, 2026 · 14:33', status: 'success', records: 1191005, flagged: 12, durationMs: 305, trigger: 'Manual · A. Jain' },
  { id: '#1244', startedAt: 'Jun 11, 2026 · 09:00', status: 'success', records: 1187560, flagged: 8,  durationMs: 289, trigger: 'Scheduled · daily 09:00' },
  { id: '#1243', startedAt: 'Jun 10, 2026 · 09:00', status: 'success', records: 1180233, flagged: 6,  durationMs: 294, trigger: 'Scheduled · daily 09:00' },
];

function RunHistoryTab() {
  const total = RUN_HISTORY.length;
  const succeeded = RUN_HISTORY.filter(r => r.status === 'success').length;
  const failed = total - succeeded;
  const fmt = (n: number) => n.toLocaleString('en-IN');
  return (
    <div className="space-y-3 pt-4">
      {/* Summary line */}
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[0.75rem] text-ink-500">
        <HistoryIcon size={13} className="text-ink-400" />
        <span><span className="font-semibold text-ink-700 tabular-nums">{total}</span> runs</span>
        <span className="text-ink-300" aria-hidden>·</span>
        <span className="text-compliant-700 font-medium tabular-nums">{succeeded} succeeded</span>
        {failed > 0 && (
          <>
            <span className="text-ink-300" aria-hidden>·</span>
            <span className="text-risk-700 font-medium tabular-nums">{failed} failed</span>
          </>
        )}
        <span className="text-ink-300" aria-hidden>·</span>
        <span>last 7 days</span>
      </div>

      {/* Run list */}
      <ul className="space-y-2" role="list">
        {RUN_HISTORY.map((run, i) => {
          const ok = run.status === 'success';
          return (
            <motion.li
              key={run.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 + i * 0.03, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="group rounded-xl border border-canvas-border bg-canvas-elevated px-3.5 py-3 flex items-center gap-3 transition-[border-color,box-shadow] duration-200 hover:border-brand-200 hover:shadow-[0_8px_22px_-14px_rgba(15,8,30,0.18)]"
            >
              {/* Status */}
              <span
                className={`inline-flex items-center justify-center size-7 rounded-lg shrink-0 ${ok ? 'bg-compliant-50 text-compliant-700' : 'bg-risk-50 text-risk-700'}`}
                aria-hidden
              >
                {ok ? <Check size={14} strokeWidth={2.75} /> : <X size={14} strokeWidth={2.75} />}
              </span>

              {/* Run id + timestamp */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">Run {run.id}</span>
                  <span className={`inline-flex items-center h-[18px] px-1.5 rounded-full text-[0.6875rem] font-semibold ${ok ? 'bg-compliant-50 text-compliant-700' : 'bg-risk-50 text-risk-700'}`}>
                    {ok ? 'Success' : 'Failed'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[0.75rem] text-ink-500 min-w-0">
                  <Clock size={11} className="text-ink-400 shrink-0" />
                  <span className="tabular-nums shrink-0">{run.startedAt}</span>
                  <span className="text-ink-300 shrink-0" aria-hidden>·</span>
                  <span className="truncate">{run.trigger}</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="text-right shrink-0">
                {ok ? (
                  <>
                    <div className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(run.records!)}</div>
                    <div className="text-[0.6875rem] text-ink-500 tabular-nums">
                      {run.flagged} flagged · {(run.durationMs! / 1000).toFixed(1)}s
                    </div>
                  </>
                ) : (
                  <div className="text-[0.75rem] text-risk-700 font-medium">{run.failReason}</div>
                )}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ArtifactPanel({ activeTab, setActiveTab, onClose, onOpenInKnowledgeHub, onComposeInChat, onCanvasAction, onShareResults, planSlot, showHistory }: ArtifactPanelProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  // Executor appends a History tab; chat Q&A (no showHistory) keeps the base set.
  const tabs: { id: ArtifactTab; label: string; icon: React.ElementType; count?: number }[] =
    showHistory
      ? [...TABS, { id: 'history', label: 'History', icon: HistoryIcon, count: RUN_HISTORY.length }]
      : TABS;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="h-full w-full bg-canvas-elevated flex flex-col overflow-hidden"
    >
      {/* Tab strip — modern Linear/Vercel-style tabs with animated underline.
          Container-query aware: at narrow widths the count chips hide first,
          then labels collapse to icon-only. As a last resort the tablist
          scrolls horizontally so nothing is ever clipped off-screen. */}
      <div className="@container h-12 shrink-0 px-2 sm:px-4 border-b border-canvas-border flex items-end justify-between gap-2 bg-canvas-elevated">
        <div
          role="tablist"
          aria-label="Workspace"
          className="relative flex items-end gap-0.5 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                role="tab"
                onClick={() => setActiveTab(tab.id)}
                aria-selected={isActive}
                aria-controls={`artifact-panel-${tab.id}`}
                whileHover={!isActive ? { y: -1 } : undefined}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                title={tab.label}
                className={`group relative flex items-center gap-1.5 h-9 px-2.5 @[480px]:px-3 rounded-t-lg text-[0.8125rem] shrink-0 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  isActive
                    ? 'text-brand-700 font-semibold'
                    : 'text-ink-500 font-medium hover:text-brand-700 hover:bg-brand-50'
                }`}
              >
                <motion.span
                  animate={{ scale: isActive ? 1.06 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className="inline-flex"
                >
                  <tab.icon
                    size={14}
                    strokeWidth={isActive ? 2.25 : 2}
                    className={isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-brand-600 transition-colors'}
                  />
                </motion.span>
                <span className={`leading-none tracking-tight ${isActive ? 'inline' : 'hidden @[360px]:inline'}`}>
                  {tab.label}
                </span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`hidden @[440px]:inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[0.75rem] font-mono tabular-nums leading-none transition-colors ${
                      isActive
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-paper-100 text-ink-500 group-hover:bg-brand-100 group-hover:text-brand-700'
                    }`}
                    aria-label={`${tab.count} items`}
                  >
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <motion.span
                    layoutId="workspace-tab-underline"
                    aria-hidden="true"
                    className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-brand-500 via-brand-600 to-brand-500"
                    transition={{ type: 'spring', stiffness: 480, damping: 36, mass: 0.55 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
        {/* Panel-level actions — Share, then a close control that collapses
            the workspace (mirrors the chat header's workspace toggle). */}
        <div className="flex items-center gap-1 shrink-0">
          {onShareResults && (
            <Gated permission="wf_output" mode="disable" title="You don't have permission to share results">
              <button
                onClick={onShareResults}
                aria-label="Share results"
                title="Share results"
                className="size-8 mb-1 inline-flex items-center justify-center text-ink-400 hover:text-brand-700 rounded-md hover:bg-brand-50 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Share2 size={14} />
              </button>
            </Gated>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse workspace"
            title="Collapse workspace"
            className="size-8 mb-1 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-brand-700 hover:bg-brand-50 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <PanelRightClose size={16} />
          </button>
        </div>
      </div>

      {/* Content — wrapped in a relative ref'd container so the
          HighlightToolbar can position itself against selections inside. */}
      <div ref={contentRef} className="relative flex-1 overflow-y-auto px-5 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'plan' && (planSlot ?? <PlanTab onComposeInChat={onComposeInChat} onCanvasAction={onCanvasAction} />)}
            {activeTab === 'code' && <CodeTab onCanvasAction={onCanvasAction} />}
            {activeTab === 'sources' && <SourcesTab onOpenInKnowledgeHub={onOpenInKnowledgeHub} onComposeInChat={onComposeInChat} />}
            {activeTab === 'history' && <RunHistoryTab />}
          </motion.div>
        </AnimatePresence>
        <HighlightToolbar scopeRef={contentRef} />
      </div>
    </motion.div>
  );
}
