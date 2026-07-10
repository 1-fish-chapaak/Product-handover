/**
 * CaseManagementWorkspace — full-page triage surface for an engagement's exceptions.
 *
 * Opens when "Manage Exceptions" is clicked from the engagement's
 * Exception Management tab. Workflow-grouped list, rich filter pane,
 * saved views, bulk actions, and a per-row detail drawer.
 *
 * All bulk mutations are demo-only (local state + toast).
 */
import DatePicker from '../shared/DatePicker';
import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, AlertTriangle, RefreshCw, Workflow as WorkflowIcon, ChevronRight, Star, Plus, X, Check,
  Users, CalendarClock, Tag, AlarmClock, CheckCircle2, UserCog, MessageSquare, Download,
  FileSpreadsheet, ChevronDown, Clock, ListFilter, ArrowDownUp,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import Gated from '../shared/Gated';
import { ENGAGEMENTS, type Engagement } from '../../data/engagements';
import {
  exceptionsForEngagement, groupByWorkflow,
  type EngagementException, type Severity, type Classification, type ExceptionStatus,
} from '../../data/engagement-exceptions';
import { OWNER_NAMES, slaStatus, RATIONALES } from '../../data/grc-domain';
import EngagementExceptionDrawer from './EngagementExceptionDrawer';

// ─── Visual tokens ───────────────────────────────────────────────────────────

const SEV_BADGE: Record<Severity, string> = {
  Critical: 'bg-risk-50 text-risk-700 border-risk-100',
  High: 'bg-high-50 text-high-700 border-high-100',
  Medium: 'bg-mitigated-50 text-mitigated-700 border-mitigated-100',
  Low: 'bg-compliant-50 text-compliant-700 border-compliant-100',
};
const SEV_DOT: Record<Severity, string> = {
  Critical: 'bg-risk', High: 'bg-high', Medium: 'bg-mitigated', Low: 'bg-compliant',
};
const STATUS_PILL: Record<ExceptionStatus, string> = {
  Open: 'bg-risk-50 text-risk-700',
  Triaging: 'bg-mitigated-50 text-mitigated-700',
  Resolved: 'bg-compliant-50 text-compliant-700',
};
const SLA_PILL: Record<'risk' | 'mitigated' | 'compliant', string> = {
  risk: 'bg-risk-50 text-risk-700',
  mitigated: 'bg-mitigated-50 text-mitigated-700',
  compliant: 'bg-compliant-50 text-compliant-700',
};
const CLASSIFICATION_PILL: Record<Classification, string> = {
  'Control Deficiency': 'bg-risk-50 text-risk-700',
  'Process Gap': 'bg-mitigated-50 text-mitigated-700',
  'False Positive': 'bg-evidence-50 text-evidence-700',
  Other: 'bg-[#F4F2F7] text-ink-700',
};

const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES: ExceptionStatus[] = ['Open', 'Triaging', 'Resolved'];
const CLASSIFICATIONS: Classification[] = ['Control Deficiency', 'Process Gap', 'False Positive', 'Other'];
const DUE_WINDOWS = ['All', 'Overdue', 'Today', 'This week', 'Next week'] as const;
const PERIODS = ['All time', 'Last 24h', 'Last 7 days', 'Last 30 days'] as const;
type DueWindow = (typeof DUE_WINDOWS)[number];
type Period = (typeof PERIODS)[number];

// ─── Filter shape & saved views ──────────────────────────────────────────────

interface Filters {
  workflow: string;
  severity: Severity | 'All';
  status: ExceptionStatus | 'All';
  assignee: string;
  due: DueWindow;
  period: Period;
  classification: Classification | 'Unset' | 'All';
}
const EMPTY_FILTERS: Filters = {
  workflow: 'All', severity: 'All', status: 'All', assignee: 'All',
  due: 'All', period: 'All time', classification: 'All',
};
interface SavedView { id: string; name: string; filters: Filters; preset?: boolean; }
const SEED_VIEWS: SavedView[] = [
  { id: 'sv-my', name: 'My open', preset: true,
    filters: { ...EMPTY_FILTERS, assignee: 'Priya Singh', status: 'Open' } },
  { id: 'sv-crit', name: 'Critical this week', preset: true,
    filters: { ...EMPTY_FILTERS, severity: 'Critical', period: 'Last 7 days' } },
  { id: 'sv-class', name: 'Awaiting classification', preset: true,
    filters: { ...EMPTY_FILTERS, classification: 'Unset', status: 'Open' } },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse "4h ago" / "1d ago" / "15m ago" → hours-ago. */
function parseHoursAgo(s: string): number {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(m|h|d)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]); const u = m[2].toLowerCase();
  return u === 'm' ? n / 60 : u === 'h' ? n : n * 24;
}
function severityRank(s: Severity): number { return { Critical: 0, High: 1, Medium: 2, Low: 3 }[s]; }
function parseRemainingHours(label: string): number { const m = label.match(/(\d+)/); return m ? parseFloat(m[1]) : 0; }

function passesFilters(ex: EngagementException, f: Filters): boolean {
  if (f.workflow !== 'All' && ex.workflowId !== f.workflow) return false;
  if (f.severity !== 'All' && ex.severity !== f.severity) return false;
  if (f.status !== 'All' && ex.status !== f.status) return false;
  if (f.assignee !== 'All' && ex.assignee !== f.assignee) return false;
  if (f.classification !== 'All') {
    if (f.classification === 'Unset') { if (ex.classification) return false; }
    else if (ex.classification !== f.classification) return false;
  }
  const hours = parseHoursAgo(ex.opened);
  if (f.period === 'Last 24h' && hours > 24) return false;
  if (f.period === 'Last 7 days' && hours > 168) return false;
  if (f.period === 'Last 30 days' && hours > 720) return false;
  if (f.due !== 'All') {
    const sla = slaStatus(hours, ex.severity);
    const remaining = parseRemainingHours(sla.label);
    if (f.due === 'Overdue' && sla.tone !== 'risk') return false;
    if (f.due === 'Today' && (sla.tone === 'risk' || remaining > 24)) return false;
    if (f.due === 'This week' && (sla.tone === 'risk' || remaining > 168)) return false;
    if (f.due === 'Next week' && (remaining <= 168 || remaining > 336)) return false;
  }
  return true;
}

function filtersEqual(a: Filters, b: Filters): boolean {
  return (Object.keys(a) as (keyof Filters)[]).every((k) => a[k] === b[k]);
}
function activeFilterChips(f: Filters): { key: keyof Filters; label: string }[] {
  const out: { key: keyof Filters; label: string }[] = [];
  if (f.workflow !== 'All') out.push({ key: 'workflow', label: 'Workflow' });
  if (f.severity !== 'All') out.push({ key: 'severity', label: `Severity: ${f.severity}` });
  if (f.status !== 'All') out.push({ key: 'status', label: `Status: ${f.status}` });
  if (f.assignee !== 'All') out.push({ key: 'assignee', label: `Assignee: ${f.assignee}` });
  if (f.due !== 'All') out.push({ key: 'due', label: `Due: ${f.due}` });
  if (f.period !== 'All time') out.push({ key: 'period', label: `Period: ${f.period}` });
  if (f.classification !== 'All') out.push({ key: 'classification', label: `Class: ${f.classification}` });
  return out;
}

const INPUT_CLS =
  'w-full px-3 py-2 border border-canvas-border rounded-lg text-[0.75rem] text-ink-900 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 transition-all placeholder:text-ink-400';

// ─── Reusable small controls ─────────────────────────────────────────────────

function SelectChip<T extends string>({
  label, value, options, onChange, icon: Icon, getLabel,
}: {
  label: string; value: T; options: readonly T[] | T[]; onChange: (v: T) => void;
  icon?: React.ElementType; getLabel?: (v: T) => string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated hover:border-brand-300 transition-colors cursor-pointer">
      {Icon && <Icon size={11} className="text-ink-500" />}
      <span className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-wide">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value as T)}
          className="appearance-none bg-transparent text-[0.75rem] font-medium text-ink-800 pr-4 outline-none cursor-pointer">
          {options.map((o) => <option key={o} value={o}>{getLabel ? getLabel(o) : o}</option>)}
        </select>
        <ChevronDown size={11} className="absolute right-0 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
      </div>
    </label>
  );
}

function Popover({
  open, onClose, anchorRef, children, width = 300,
}: {
  open: boolean; onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode; width?: number;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, anchorRef]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div ref={popRef}
          initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.12 }}
          style={{ width }}
          className="absolute top-full right-0 mt-2 z-40 rounded-xl border border-canvas-border bg-canvas-elevated shadow-xl p-3.5">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TriStateCheckbox({
  checked, indeterminate, onChange, ariaLabel,
}: { checked: boolean; indeterminate: boolean; onChange: () => void; ariaLabel: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      aria-label={ariaLabel} onClick={(e) => e.stopPropagation()}
      className="w-4 h-4 rounded border-canvas-border text-brand-600 focus:ring-brand-500/30 cursor-pointer accent-brand-600" />
  );
}

function CountPill({ label, value, tone }: { label: string; value: number; tone: 'risk' | 'mitigated' | 'compliant' }) {
  const cls = tone === 'risk' ? 'bg-risk-50 text-risk-700'
    : tone === 'mitigated' ? 'bg-mitigated-50 text-mitigated-700'
    : 'bg-compliant-50 text-compliant-700';
  return (
    <div className={`inline-flex items-center gap-2 px-3 h-9 rounded-lg ${cls}`}>
      <span className="text-[1.25rem] font-bold tabular-nums leading-none">{value}</span>
      <span className="text-[0.75rem] font-semibold uppercase tracking-wider">{label}</span>
    </div>
  );
}

function AssigneeChip({ name, primary }: { name: string; primary?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('');
  return (
    <span title={`${name}${primary ? ' (Primary)' : ''}`}
      className={`relative inline-flex items-center justify-center w-6 h-6 rounded-full text-[0.625rem] font-semibold tracking-wider ring-2 ring-canvas-elevated ${
        primary ? 'bg-brand-600 text-white z-20' : 'bg-brand-100 text-brand-700 z-10'
      }`}>{initials}</span>
  );
}

function EmptyState({ title, sub, actionLabel, onAction }: { title: string; sub: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="glass-card rounded-2xl p-14 text-center">
      <AlertTriangle size={28} className="text-ink-400 mx-auto mb-3" />
      <p className="text-[0.875rem] font-semibold text-ink-900 mb-1">{title}</p>
      <p className="text-[0.75rem] text-ink-500">{sub}</p>
      <button onClick={onAction}
        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors">
        {actionLabel}
      </button>
    </div>
  );
}

function BulkBtn({
  refEl, icon: Icon, label, active, onClick,
}: {
  refEl: React.RefObject<HTMLButtonElement | null>;
  icon: React.ElementType; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button ref={refEl} onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[0.75rem] font-semibold transition-colors cursor-pointer ${
        active ? 'bg-brand-600 text-white' : 'border border-canvas-border bg-canvas-elevated text-ink-700 hover:bg-canvas'
      }`}>
      <Icon size={13} /> {label}
    </button>
  );
}

// ─── Bulk popover bodies ────────────────────────────────────────────────────

function BulkAssign({ onApply, count }: { onApply: (names: string[], primary: string) => void; count: number }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (n: string) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  return (
    <div className="space-y-2.5">
      <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-500">Assign owners · first selected is Primary</div>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-canvas-border bg-white p-1">
        {OWNER_NAMES.map((n) => {
          const sel = picked.includes(n); const primary = picked[0] === n;
          return (
            <button key={n} onClick={() => toggle(n)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[0.75rem] cursor-pointer ${sel ? 'bg-brand-50' : 'hover:bg-canvas'}`}>
              <span className={`w-4 h-4 rounded border ${sel ? 'bg-brand-600 border-brand-600' : 'border-canvas-border'} flex items-center justify-center`}>
                {sel && <Check size={10} className="text-white" />}
              </span>
              <span className="text-ink-900 flex-1">{n}</span>
              {primary && <span className="px-1.5 h-4 rounded text-[0.75rem] font-bold uppercase bg-brand-600 text-white inline-flex items-center">Primary</span>}
            </button>
          );
        })}
      </div>
      <Gated permission="exc_assign" mode="disable" title="You don't have permission to assign exceptions">
      <button disabled={picked.length === 0} onClick={() => onApply(picked, picked[0])}
        className="w-full px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold cursor-pointer">
        Apply to {count} exception{count === 1 ? '' : 's'}
      </button>
      </Gated>
    </div>
  );
}

function BulkDue({ onApply, count }: { onApply: (label: string) => void; count: number }) {
  const [custom, setCustom] = useState('');
  return (
    <div className="space-y-2.5">
      <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-500">Set due date for {count} exception{count === 1 ? '' : 's'}</div>
      <div className="grid grid-cols-3 gap-2">
        {[['+3d', '+3 days'], ['+7d', '+7 days'], ['+14d', '+14 days']].map(([k, label]) => (
          <button key={k} onClick={() => onApply(label)}
            className="px-2 py-1.5 rounded-lg border border-canvas-border bg-white hover:border-brand-300 text-[0.75rem] font-medium text-ink-700 cursor-pointer">{k}</button>
        ))}
      </div>
      <div>
        <label className="text-[0.6875rem] font-semibold text-ink-600 block mb-1">Custom date</label>
        <DatePicker value={custom} onChange={(e) => setCustom(e.target.value)} className={INPUT_CLS} />
      </div>
      <Gated permission="exc_triage" mode="disable" title="You don't have permission to update exceptions">
      <button disabled={!custom} onClick={() => onApply(custom)}
        className="w-full px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold cursor-pointer">
        Apply custom date
      </button>
      </Gated>
    </div>
  );
}

function BulkClassify({ onApply, count }: { onApply: (cls: Classification, rationale?: string) => void; count: number }) {
  const [cls, setCls] = useState<Classification | null>(null);
  const [body, setBody] = useState('');
  const [tmplOpen, setTmplOpen] = useState(false);
  const templates = cls ? RATIONALES.filter((r) => r.classification === cls) : RATIONALES;
  return (
    <div className="space-y-2.5">
      <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-500">Classify {count} exception{count === 1 ? '' : 's'}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {CLASSIFICATIONS.map((c) => {
          const active = cls === c;
          return (
            <button key={c} onClick={() => setCls(c)} role="radio" aria-checked={active}
              className={`px-2.5 py-2 rounded-lg border text-left text-[0.75rem] font-semibold cursor-pointer transition-all ${
                active ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                  : 'border-canvas-border bg-white text-ink-800 hover:border-brand-300'
              }`}>{c}</button>
          );
        })}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[0.6875rem] font-semibold text-ink-600">Rationale (optional)</label>
          <div className="relative">
            <button onClick={() => setTmplOpen((o) => !o)}
              className="text-[0.75rem] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer inline-flex items-center gap-1">
              <Tag size={10} /> Use template
            </button>
            <AnimatePresence>
              {tmplOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.1 }}
                  className="absolute top-full right-0 mt-1 z-50 w-56 rounded-lg border border-canvas-border bg-canvas-elevated shadow-lg p-1">
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => { setBody(t.body); setCls(t.classification); setTmplOpen(false); }}
                      className="w-full text-left px-2 py-1.5 rounded-md text-[0.75rem] text-ink-700 hover:bg-canvas cursor-pointer">
                      {t.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Explain the reasoning…"
          className={INPUT_CLS + ' resize-none'} />
      </div>
      <Gated permission="exc_classify" mode="disable" title="You don't have permission to classify exceptions">
      <button disabled={!cls} onClick={() => cls && onApply(cls, body)}
        className="w-full px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold cursor-pointer">
        Apply classification
      </button>
      </Gated>
    </div>
  );
}

function BulkSnooze({ onApply, count }: { onApply: (label: string) => void; count: number }) {
  const [date, setDate] = useState('');
  return (
    <div className="space-y-2.5">
      <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-500">Snooze {count} exception{count === 1 ? '' : 's'}</div>
      <div className="grid grid-cols-3 gap-2">
        {['1d', '3d', '1w'].map((p) => (
          <button key={p} onClick={() => onApply(p)}
            className="px-2 py-1.5 rounded-lg border border-canvas-border bg-white hover:border-brand-300 text-[0.75rem] font-medium text-ink-700 cursor-pointer">{p}</button>
        ))}
      </div>
      <div>
        <label className="text-[0.6875rem] font-semibold text-ink-600 block mb-1">Until date</label>
        <DatePicker value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLS} />
      </div>
      <Gated permission="exc_resolve" mode="disable" title="You don't have permission to snooze exceptions">
      <button disabled={!date} onClick={() => onApply(`until ${date}`)}
        className="w-full px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold cursor-pointer">
        Snooze until date
      </button>
      </Gated>
    </div>
  );
}

function BulkClose({ onApply, count }: { onApply: (cls: Classification | null, note: string) => void; count: number }) {
  const [cls, setCls] = useState<Classification | null>(null);
  const [note, setNote] = useState('');
  return (
    <div className="space-y-2.5">
      <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-500">Close {count} exception{count === 1 ? '' : 's'}</div>
      <div className="text-[0.6875rem] text-ink-500">A classification is required before closing.</div>
      <div className="grid grid-cols-2 gap-1.5">
        {CLASSIFICATIONS.map((c) => {
          const active = cls === c;
          return (
            <button key={c} onClick={() => setCls(c)} role="radio" aria-checked={active}
              className={`px-2.5 py-2 rounded-lg border text-left text-[0.75rem] font-semibold cursor-pointer transition-all ${
                active ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                  : 'border-canvas-border bg-white text-ink-800 hover:border-brand-300'
              }`}>{c}</button>
          );
        })}
      </div>
      <div>
        <label className="text-[0.6875rem] font-semibold text-ink-600 block mb-1">Resolution note</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done to resolve this?"
          className={INPUT_CLS + ' resize-none'} />
      </div>
      <Gated permission="exc_resolve" mode="disable" title="You don't have permission to close exceptions">
      <button disabled={!cls} onClick={() => onApply(cls, note)}
        className="w-full px-3 py-2 rounded-lg bg-compliant text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-[0.75rem] font-semibold cursor-pointer">
        Close cases
      </button>
      </Gated>
    </div>
  );
}

function BulkReassign({ onApply, count }: { onApply: (name: string) => void; count: number }) {
  const [pick, setPick] = useState<string>('');
  return (
    <div className="space-y-2.5">
      <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-500">Reassign {count} exception{count === 1 ? '' : 's'} to</div>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-canvas-border bg-white p-1">
        {OWNER_NAMES.map((n) => (
          <button key={n} onClick={() => setPick(n)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[0.75rem] cursor-pointer ${
              pick === n ? 'bg-brand-50 text-brand-700' : 'hover:bg-canvas text-ink-900'
            }`}>
            <span className={`w-3.5 h-3.5 rounded-full border ${pick === n ? 'bg-brand-600 border-brand-600' : 'border-canvas-border'}`} />
            {n}
          </button>
        ))}
      </div>
      <Gated permission="exc_assign" mode="disable" title="You don't have permission to reassign exceptions">
      <button disabled={!pick} onClick={() => onApply(pick)}
        className="w-full px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold cursor-pointer">
        Reassign
      </button>
      </Gated>
    </div>
  );
}

function BulkComment({ onApply, count }: { onApply: (body: string) => void; count: number }) {
  const [body, setBody] = useState('');
  return (
    <div className="space-y-2.5">
      <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-500">Comment on {count} exception{count === 1 ? '' : 's'}</div>
      <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Comment will be tagged [bulk]…"
        className={INPUT_CLS + ' resize-none'} />
      <Gated permission="exc_triage" mode="disable" title="You don't have permission to comment on exceptions">
      <button disabled={!body.trim()} onClick={() => onApply(body)}
        className="w-full px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold cursor-pointer">
        Post comment
      </button>
      </Gated>
    </div>
  );
}

// ─── Exception row ───────────────────────────────────────────────────────────

function ExceptionRow({
  ex, selected, onToggle, onOpen, extraAssignees,
}: {
  ex: EngagementException; selected: boolean; onToggle: () => void; onOpen: () => void; extraAssignees: string[];
}) {
  const hours = parseHoursAgo(ex.opened);
  const sla = slaStatus(hours, ex.severity);
  const list = extraAssignees.length > 0 ? extraAssignees : [ex.assignee];
  const head = list.slice(0, 2);
  const overflow = Math.max(0, list.length - 2);
  return (
    <li onClick={onOpen}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
        selected ? 'bg-brand-50/60' : 'hover:bg-canvas/60'
      }`}>
      <TriStateCheckbox checked={selected} indeterminate={false} onChange={onToggle} ariaLabel={`Select ${ex.ref}`} />
      <span className={`inline-flex items-center px-1.5 h-5 rounded text-[0.625rem] font-bold uppercase tracking-wide border shrink-0 ${SEV_BADGE[ex.severity]}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1 ${SEV_DOT[ex.severity]}`} aria-hidden="true" />
        {ex.severity}
      </span>
      <span className="font-mono text-[0.75rem] text-ink-500 tabular-nums shrink-0 w-20">{ex.ref}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[0.8125rem] text-ink-900 truncate font-medium">
          {ex.title}
          {ex.amount && (
            <span className="ml-2 inline-flex items-center px-1.5 h-4 rounded text-[0.75rem] font-semibold bg-[#F4F2F7] text-ink-700 font-mono align-middle">
              {ex.amount}
            </span>
          )}
        </div>
        <div className="text-[0.6875rem] text-ink-500 mt-0.5 flex items-center gap-2 flex-wrap">
          <Clock size={10} className="text-ink-400" /> Opened {ex.opened}
        </div>
      </div>
      <div className="hidden md:flex items-center -space-x-1.5 shrink-0">
        {head.map((name, i) => <AssigneeChip key={`${name}-${i}`} name={name} primary={i === 0} />)}
        {overflow > 0 && (
          <span className="relative z-10 inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-canvas-border text-ink-700 text-[0.75rem] font-semibold tabular-nums ring-2 ring-canvas-elevated">
            +{overflow}
          </span>
        )}
      </div>
      <span className={`shrink-0 inline-flex items-center gap-1 px-2 h-5 rounded-full text-[0.75rem] font-semibold tabular-nums ${SLA_PILL[sla.tone]}`}
        title={`SLA · ${Math.round(sla.pct)}% elapsed`}>
        <CalendarClock size={10} /> {sla.label}
      </span>
      <span className={`shrink-0 inline-flex items-center px-2 h-5 rounded-full text-[0.75rem] font-semibold ${STATUS_PILL[ex.status]}`}>
        {ex.status}
      </span>
      {ex.classification && (
        <span className={`shrink-0 hidden lg:inline-flex items-center px-2 h-5 rounded-full text-[0.75rem] font-medium ${CLASSIFICATION_PILL[ex.classification]}`}
          title={`Classification · ${ex.classification}`}>
          {ex.classification}
        </span>
      )}
      <ChevronRight size={14} className="text-ink-400 shrink-0" />
    </li>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface Props {
  engagementId: string;
  onBack: () => void;
  /** When true, strips the full-page wrapper, back button, and header — for embedding inside a tab. */
  embedded?: boolean;
  /** Pre-applied filters — e.g. when drilled in from an Overview chart via deep-link. */
  initialFilters?: { severity?: string; workflow?: string; status?: string };
}

export default function CaseManagementWorkspace({ engagementId, onBack, embedded, initialFilters }: Props): JSX.Element {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const eng: Engagement | undefined = useMemo(() => ENGAGEMENTS.find((e) => e.id === engagementId), [engagementId]);
  const allExceptions = useMemo(() => exceptionsForEngagement(engagementId), [engagementId]);

  const [filters, setFilters] = useState<Filters>(() => ({
    ...EMPTY_FILTERS,
    ...(initialFilters?.severity ? { severity: initialFilters.severity as Filters['severity'] } : {}),
    ...(initialFilters?.workflow ? { workflow: initialFilters.workflow } : {}),
    ...(initialFilters?.status ? { status: initialFilters.status as Filters['status'] } : {}),
  }));
  const [savedViews, setSavedViews] = useState<SavedView[]>(SEED_VIEWS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedException, setSelectedException] = useState<EngagementException | null>(null);
  const [extraAssignees, setExtraAssignees] = useState<Record<string, string[]>>({});
  const [localClassifications, setLocalClassifications] = useState<Record<string, Classification | undefined>>({});
  const [localStatuses, setLocalStatuses] = useState<Record<string, ExceptionStatus>>({});
  const [groupSort, setGroupSort] = useState<Record<string, { key: 'severity' | 'opened' | 'title'; sortOpen: boolean }>>({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [openBulk, setOpenBulk] = useState<null | 'assign' | 'due' | 'classify' | 'snooze' | 'close' | 'reassign' | 'comment'>(null);

  const assignRef = useRef<HTMLButtonElement | null>(null);
  const dueRef = useRef<HTMLButtonElement | null>(null);
  const classifyRef = useRef<HTMLButtonElement | null>(null);
  const snoozeRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const reassignRef = useRef<HTMLButtonElement | null>(null);
  const commentRef = useRef<HTMLButtonElement | null>(null);

  const workflowOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allExceptions.forEach((ex) => seen.set(ex.workflowId, ex.workflowName));
    return [['All', 'All workflows'] as const, ...Array.from(seen.entries())];
  }, [allExceptions]);

  const resolved = useMemo(() => allExceptions.map((ex) => ({
    ...ex,
    classification: localClassifications[ex.id] ?? ex.classification,
    status: localStatuses[ex.id] ?? ex.status,
  })), [allExceptions, localClassifications, localStatuses]);

  const filtered = useMemo(() => resolved.filter((ex) => passesFilters(ex, filters)), [resolved, filters]);
  const groups = useMemo(() => groupByWorkflow(filtered), [filtered]);

  const totals = useMemo(() => {
    const t = { open: 0, triaging: 0, resolved: 0 };
    resolved.forEach((e) => {
      if (e.status === 'Open') t.open++;
      else if (e.status === 'Triaging') t.triaging++;
      else t.resolved++;
    });
    return t;
  }, [resolved]);
  const activeChips = activeFilterChips(filters);

  // Selection
  const toggleOne = (id: string) =>
    setSelectedIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const visibleIds = useMemo(() => filtered.map((e) => e.id), [filtered]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const toggleAllVisible = () => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    return next;
  });
  const groupAllSelected = (ids: string[]) => ids.length > 0 && ids.every((id) => selectedIds.has(id));
  const groupSomeSelected = (ids: string[]) => ids.some((id) => selectedIds.has(id));
  const toggleGroupSelection = (ids: string[]) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (groupAllSelected(ids)) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    return next;
  });
  const toggleGroupCollapse = (id: string) =>
    setCollapsedGroups((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSelection = () => setSelectedIds(new Set());

  // Bulk handlers
  const N = selectedIds.size;
  const applyAssign = (names: string[], primary: string) => {
    const u: Record<string, string[]> = { ...extraAssignees };
    selectedIds.forEach((id) => { u[id] = [primary, ...names.filter((n) => n !== primary)]; });
    setExtraAssignees(u);
    addToast({ message: `Assigned ${names.length} owner${names.length === 1 ? '' : 's'} to ${N} exception${N === 1 ? '' : 's'} · Primary: ${primary}`, type: 'success' });
    logEvent({ action: 'Update', description: `Assigned ${names.length} owner${names.length === 1 ? '' : 's'} to ${N} exception${N === 1 ? '' : 's'} (primary: ${primary})`, module: 'Exceptions', entity: 'Exception' });
    setOpenBulk(null); clearSelection();
  };
  const applyDue = (label: string) => {
    addToast({ message: `Due date set to ${label} for ${N} exception${N === 1 ? '' : 's'}`, type: 'success' });
    logEvent({ action: 'Update', description: `Set due date to ${label} for ${N} exception${N === 1 ? '' : 's'}`, module: 'Exceptions', entity: 'Exception' });
    setOpenBulk(null); clearSelection();
  };
  const applyClassify = (cls: Classification, rationale?: string) => {
    const u: Record<string, Classification | undefined> = { ...localClassifications };
    selectedIds.forEach((id) => { u[id] = cls; });
    setLocalClassifications(u);
    addToast({ message: `Classified ${N} exception${N === 1 ? '' : 's'} as ${cls}${rationale ? ` · ${rationale.slice(0, 40)}${rationale.length > 40 ? '…' : ''}` : ''}`, type: 'success' });
    logEvent({ action: 'Update', description: `Classified ${N} exception${N === 1 ? '' : 's'} as ${cls}`, module: 'Exceptions', entity: 'Exception' });
    setOpenBulk(null); clearSelection();
  };
  const applySnooze = (label: string) => {
    addToast({ message: `Snoozed ${N} exception${N === 1 ? '' : 's'} · ${label}`, type: 'info' });
    logEvent({ action: 'Update', description: `Snoozed ${N} exception${N === 1 ? '' : 's'} (${label})`, module: 'Exceptions', entity: 'Exception' });
    setOpenBulk(null); clearSelection();
  };
  const applyClose = (cls: Classification | null, note: string) => {
    if (!cls) { addToast({ message: 'Choose a classification before closing', type: 'warning' }); return; }
    const cu: Record<string, Classification | undefined> = { ...localClassifications };
    const su: Record<string, ExceptionStatus> = { ...localStatuses };
    selectedIds.forEach((id) => { cu[id] = cls; su[id] = 'Resolved'; });
    setLocalClassifications(cu); setLocalStatuses(su);
    addToast({ message: `Closed ${N} exception${N === 1 ? '' : 's'}${note ? ` · "${note.slice(0, 30)}${note.length > 30 ? '…' : ''}"` : ''}`, type: 'success' });
    logEvent({ action: 'Update', description: `Closed ${N} exception${N === 1 ? '' : 's'} as ${cls}`, module: 'Exceptions', entity: 'Exception' });
    setOpenBulk(null); clearSelection();
  };
  const applyReassign = (name: string) => {
    addToast({ message: `Reassigned ${N} exception${N === 1 ? '' : 's'} to ${name}`, type: 'success' });
    logEvent({ action: 'Update', description: `Reassigned ${N} exception${N === 1 ? '' : 's'} to ${name}`, module: 'Exceptions', entity: 'Exception' });
    setOpenBulk(null); clearSelection();
  };
  const applyComment = (body: string) => {
    if (!body.trim()) return;
    addToast({ message: `[bulk] ${body.slice(0, 60)}${body.length > 60 ? '…' : ''}`, type: 'info' });
    setOpenBulk(null); clearSelection();
  };
  const applyExport = () => {
    addToast({ message: `Exporting ${N} exception${N === 1 ? '' : 's'} as CSV…`, type: 'info' });
    logEvent({ action: 'Export', description: `Exported ${N} exception${N === 1 ? '' : 's'} as CSV`, module: 'Exceptions', entity: 'Exception' });
    clearSelection();
  };

  // Saved views
  const applyView = (v: SavedView) => { setFilters(v.filters); addToast({ message: `Applied view "${v.name}"`, type: 'info' }); };
  const saveCurrent = () => {
    const name = saveName.trim(); if (!name) return;
    setSavedViews((prev) => [...prev, { id: `sv-${Date.now()}`, name, filters }]);
    setShowSaveDialog(false); setSaveName('');
    addToast({ message: `Saved view "${name}"`, type: 'success' });
    logEvent({ action: 'Create', description: `Saved exception view "${name}"`, module: 'Exceptions', entity: 'View' });
  };

  if (!eng) {
    return (
      <div className={embedded ? '' : 'min-h-screen bg-canvas'}>
        <div className={embedded ? '' : 'max-w-[1400px] mx-auto px-6 py-8'}>
          {!embedded && (
            <button onClick={onBack}
              className="flex items-center gap-1.5 text-[0.75rem] text-ink-500 hover:text-brand-700 font-medium mb-4 cursor-pointer transition-colors">
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <div className="glass-card rounded-xl p-12 text-center">
            <AlertTriangle size={28} className="text-ink-400 mx-auto mb-3" />
            <p className="text-[0.875rem] font-semibold text-ink-900 mb-1">Engagement not found</p>
            <p className="text-[0.75rem] text-ink-500">It may have been deleted or moved.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'min-h-screen bg-canvas'}>
      <div className={embedded ? '' : 'max-w-[1400px] mx-auto px-6 py-6'}>
        {!embedded && (
          <>
            {/* Back link */}
            <button onClick={onBack}
              className="flex items-center gap-1.5 text-[0.75rem] text-ink-500 hover:text-brand-700 font-medium mb-4 cursor-pointer transition-colors">
              <ArrowLeft size={14} /> Back to {eng.code} {eng.name}
            </button>

            {/* Header */}
            <header className="glass-card rounded-2xl p-5 mb-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-[1.375rem] font-semibold text-ink-900 tracking-tight">Case Management Workspace</h1>
                <p className="text-[0.75rem] text-ink-500 mt-0.5">Triage, classify, and resolve every exception flagged for this engagement.</p>
              </div>
              <div className="flex items-center gap-3">
                <CountPill label="Open" value={totals.open} tone="risk" />
                <CountPill label="Triaging" value={totals.triaging} tone="mitigated" />
                <CountPill label="Resolved" value={totals.resolved} tone="compliant" />
                <button onClick={() => addToast({ message: 'Refreshed exception list', type: 'info' })}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-canvas-border bg-canvas-elevated text-ink-700 hover:bg-canvas text-[0.75rem] font-semibold cursor-pointer transition-colors">
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>
            </header>
          </>
        )}

        {/* Embedded header — compact summary bar */}
        {embedded && (
          <header className="rounded-xl border border-border-light bg-white p-4 mb-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <CountPill label="Open" value={totals.open} tone="risk" />
              <CountPill label="Triaging" value={totals.triaging} tone="mitigated" />
              <CountPill label="Resolved" value={totals.resolved} tone="compliant" />
            </div>
            <button onClick={() => addToast({ message: 'Refreshed exception list', type: 'info' })}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-canvas-border bg-canvas-elevated text-ink-700 hover:bg-canvas text-[0.75rem] font-semibold cursor-pointer transition-colors">
              <RefreshCw size={13} /> Refresh
            </button>
          </header>
        )}

        {/* Filter pane */}
        <section aria-label="Filters" className="glass-card rounded-2xl px-4 py-3.5 mb-3 flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 mr-1 text-ink-500">
            <ListFilter size={12} />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide">Filters</span>
          </div>
          <SelectChip label="Workflow" value={filters.workflow}
            options={workflowOptions.map(([id]) => id) as string[]}
            getLabel={(id) => workflowOptions.find(([wid]) => wid === id)?.[1] ?? id}
            onChange={(v) => setFilters((f) => ({ ...f, workflow: v }))} icon={WorkflowIcon} />
          <SelectChip label="Severity" value={filters.severity}
            options={['All', ...SEVERITIES] as ('All' | Severity)[]}
            onChange={(v) => setFilters((f) => ({ ...f, severity: v }))} icon={AlertTriangle} />
          <SelectChip label="Status" value={filters.status}
            options={['All', ...STATUSES] as ('All' | ExceptionStatus)[]}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))} icon={CheckCircle2} />
          <SelectChip label="Assignee" value={filters.assignee}
            options={['All', ...OWNER_NAMES]}
            onChange={(v) => setFilters((f) => ({ ...f, assignee: v }))} icon={Users} />
          <SelectChip label="Due" value={filters.due} options={DUE_WINDOWS}
            onChange={(v) => setFilters((f) => ({ ...f, due: v }))} icon={CalendarClock} />
          <SelectChip label="Period" value={filters.period} options={PERIODS}
            onChange={(v) => setFilters((f) => ({ ...f, period: v }))} icon={Clock} />
          <SelectChip label="Class" value={filters.classification}
            options={['All', 'Unset', ...CLASSIFICATIONS] as ('All' | 'Unset' | Classification)[]}
            onChange={(v) => setFilters((f) => ({ ...f, classification: v }))} icon={Tag} />
          {activeChips.length > 0 && (
            <button onClick={() => setFilters(EMPTY_FILTERS)}
              className="ml-auto text-[0.75rem] text-ink-500 hover:text-brand-700 font-medium cursor-pointer">Clear all</button>
          )}
        </section>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="mb-3 flex items-center gap-1.5 flex-wrap">
            {activeChips.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1.5 px-2 h-6 rounded-full bg-brand-50 text-brand-700 text-[0.75rem] font-medium">
                {c.label}
                <button onClick={() => setFilters((f) => ({ ...f, [c.key]: EMPTY_FILTERS[c.key] }))}
                  className="rounded-full hover:bg-brand-100 cursor-pointer" aria-label={`Clear ${c.label}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Saved views */}
        <section aria-label="Saved views" className="mb-4 flex items-center gap-2 flex-wrap">
          {savedViews.map((v) => {
            const isActive = filtersEqual(v.filters, filters);
            return (
              <button key={v.id} onClick={() => applyView(v)}
                className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[0.75rem] font-semibold transition-colors cursor-pointer ${
                  isActive ? 'bg-brand-600 text-white' : 'bg-canvas-elevated border border-canvas-border text-ink-700 hover:border-brand-300'
                }`}>
                <Star size={11} className={isActive ? 'fill-white' : 'fill-mitigated'} />
                {v.name}
              </button>
            );
          })}
          <div className="ml-auto relative">
            <button onClick={() => setShowSaveDialog((s) => !s)}
              className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[0.75rem] font-semibold text-ink-700 hover:text-brand-700 cursor-pointer">
              <Plus size={11} /> Save current view
            </button>
            <AnimatePresence>
              {showSaveDialog && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                  className="absolute top-full right-0 mt-2 z-40 w-72 rounded-xl border border-canvas-border bg-canvas-elevated shadow-xl p-3.5">
                  <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-500 mb-2">Save current filters as</div>
                  <input autoFocus type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)}
                    placeholder="e.g. Critical · Awaiting class" className={INPUT_CLS}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveCurrent(); }} />
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <button onClick={() => { setShowSaveDialog(false); setSaveName(''); }}
                      className="px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold text-ink-500 hover:text-ink-800 cursor-pointer">Cancel</button>
                    <button onClick={saveCurrent} disabled={!saveName.trim()}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[0.75rem] font-semibold cursor-pointer">Save</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Master select bar */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 mb-2 rounded-xl bg-canvas-elevated border border-canvas-border">
            <TriStateCheckbox checked={allVisibleSelected} indeterminate={!allVisibleSelected && someVisibleSelected}
              onChange={toggleAllVisible} ariaLabel="Select all visible exceptions" />
            <span className="text-[0.75rem] text-ink-700 font-medium">
              {selectedIds.size > 0
                ? <>{selectedIds.size} selected of {filtered.length}</>
                : <>Showing <span className="tabular-nums">{filtered.length}</span> of {allExceptions.length}</>}
            </span>
            {selectedIds.size > 0 && (
              <button onClick={clearSelection}
                className="ml-auto text-[0.75rem] text-ink-500 hover:text-brand-700 font-medium cursor-pointer">Clear selection</button>
            )}
          </div>
        )}

        {/* Bulk toolbar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.16 }}
              className="sticky top-0 z-30 mb-3 overflow-visible">
              <div className="glass-card rounded-2xl px-4 py-2.5 flex items-center gap-2 flex-wrap shadow-lg">
                <span className="text-[0.75rem] font-semibold text-ink-900 mr-2">{selectedIds.size} selected</span>
                <div className="h-5 w-px bg-canvas-border mr-1" />
                <BulkBtn refEl={assignRef} icon={Users} label="Assign" active={openBulk === 'assign'} onClick={() => setOpenBulk(openBulk === 'assign' ? null : 'assign')} />
                <BulkBtn refEl={dueRef} icon={CalendarClock} label="Due date" active={openBulk === 'due'} onClick={() => setOpenBulk(openBulk === 'due' ? null : 'due')} />
                <BulkBtn refEl={classifyRef} icon={Tag} label="Classify" active={openBulk === 'classify'} onClick={() => setOpenBulk(openBulk === 'classify' ? null : 'classify')} />
                <BulkBtn refEl={snoozeRef} icon={AlarmClock} label="Snooze" active={openBulk === 'snooze'} onClick={() => setOpenBulk(openBulk === 'snooze' ? null : 'snooze')} />
                <BulkBtn refEl={closeRef} icon={CheckCircle2} label="Close" active={openBulk === 'close'} onClick={() => setOpenBulk(openBulk === 'close' ? null : 'close')} />
                <BulkBtn refEl={reassignRef} icon={UserCog} label="Reassign" active={openBulk === 'reassign'} onClick={() => setOpenBulk(openBulk === 'reassign' ? null : 'reassign')} />
                <BulkBtn refEl={commentRef} icon={MessageSquare} label="Comment" active={openBulk === 'comment'} onClick={() => setOpenBulk(openBulk === 'comment' ? null : 'comment')} />
                <button onClick={applyExport}
                  className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-canvas-border bg-canvas-elevated text-ink-700 hover:bg-canvas text-[0.75rem] font-semibold cursor-pointer transition-colors">
                  <Download size={13} /> Export
                </button>
                <div className="relative">
                  <Popover open={openBulk === 'assign'} onClose={() => setOpenBulk(null)} anchorRef={assignRef} width={300}>
                    <BulkAssign onApply={applyAssign} count={selectedIds.size} />
                  </Popover>
                  <Popover open={openBulk === 'due'} onClose={() => setOpenBulk(null)} anchorRef={dueRef} width={280}>
                    <BulkDue onApply={applyDue} count={selectedIds.size} />
                  </Popover>
                  <Popover open={openBulk === 'classify'} onClose={() => setOpenBulk(null)} anchorRef={classifyRef} width={340}>
                    <BulkClassify onApply={applyClassify} count={selectedIds.size} />
                  </Popover>
                  <Popover open={openBulk === 'snooze'} onClose={() => setOpenBulk(null)} anchorRef={snoozeRef} width={280}>
                    <BulkSnooze onApply={applySnooze} count={selectedIds.size} />
                  </Popover>
                  <Popover open={openBulk === 'close'} onClose={() => setOpenBulk(null)} anchorRef={closeRef} width={340}>
                    <BulkClose onApply={applyClose} count={selectedIds.size} />
                  </Popover>
                  <Popover open={openBulk === 'reassign'} onClose={() => setOpenBulk(null)} anchorRef={reassignRef} width={260}>
                    <BulkReassign onApply={applyReassign} count={selectedIds.size} />
                  </Popover>
                  <Popover open={openBulk === 'comment'} onClose={() => setOpenBulk(null)} anchorRef={commentRef} width={320}>
                    <BulkComment onApply={applyComment} count={selectedIds.size} />
                  </Popover>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        {allExceptions.length === 0 ? (
          <EmptyState title="No exceptions in this engagement yet"
            sub="Exceptions flagged by linked workflows will appear here."
            actionLabel="Back to engagement" onAction={onBack} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No exceptions match your filters"
            sub="Try clearing one or more filters to see more results."
            actionLabel="Clear filters" onAction={() => setFilters(EMPTY_FILTERS)} />
        ) : (
          <div className="space-y-3">
            {groups.map((g) => {
              const sortPref = groupSort[g.workflowId] ?? { key: 'severity' as const, sortOpen: false };
              const sortedRows = [...g.exceptions].sort((a, b) => {
                if (sortPref.key === 'severity') return severityRank(a.severity) - severityRank(b.severity);
                if (sortPref.key === 'opened') return parseHoursAgo(a.opened) - parseHoursAgo(b.opened);
                return a.title.localeCompare(b.title);
              });
              const groupIds = sortedRows.map((r) => r.id);
              const isCollapsed = collapsedGroups.has(g.workflowId);
              const lastFired = g.exceptions
                .map((e) => ({ e, h: parseHoursAgo(e.opened) }))
                .sort((a, b) => a.h - b.h)[0]?.e.opened ?? '—';
              return (
                <div key={g.workflowId} className="glass-card rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-canvas-border/60 bg-canvas-elevated">
                    <TriStateCheckbox checked={groupAllSelected(groupIds)} indeterminate={!groupAllSelected(groupIds) && groupSomeSelected(groupIds)}
                      onChange={() => toggleGroupSelection(groupIds)} ariaLabel={`Select all in ${g.workflowName}`} />
                    <button onClick={() => toggleGroupCollapse(g.workflowId)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer">
                      <div className="p-2 rounded-lg bg-brand-50 shrink-0"><WorkflowIcon size={14} className="text-brand-600" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[0.75rem] font-semibold text-ink-900">{g.workflowName}</span>
                          <span className="text-[0.6875rem] text-ink-500">
                            {g.exceptions.length} total · <span className="tabular-nums">{g.exceptions.filter((e) => e.status !== 'Resolved').length} open</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {SEVERITIES.map((sev) => g.severityCounts[sev] > 0 && (
                            <span key={sev} className={`inline-flex items-center px-1.5 h-4 rounded text-[0.625rem] font-bold uppercase tracking-wide border ${SEV_BADGE[sev]}`}>
                              {g.severityCounts[sev]} {sev}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-[0.6875rem] text-ink-500 shrink-0 hidden md:flex items-center gap-1">
                        <Clock size={10} /> Last fired {lastFired}
                      </div>
                    </button>
                    <div className="relative">
                      <button onClick={() => setGroupSort((prev) => ({ ...prev, [g.workflowId]: { ...sortPref, sortOpen: !sortPref.sortOpen } }))}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-500 hover:bg-canvas hover:text-ink-800 cursor-pointer"
                        title="Sort group" aria-label="Sort group">
                        <ArrowDownUp size={13} />
                      </button>
                      <AnimatePresence>
                        {sortPref.sortOpen && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                            className="absolute top-full right-0 mt-1 z-30 w-40 rounded-lg border border-canvas-border bg-canvas-elevated shadow-lg p-1">
                            {(['severity', 'opened', 'title'] as const).map((k) => (
                              <button key={k} onClick={() => setGroupSort((prev) => ({ ...prev, [g.workflowId]: { key: k, sortOpen: false } }))}
                                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[0.75rem] font-medium cursor-pointer ${
                                  sortPref.key === k ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-canvas'
                                }`}>
                                Sort by {k === 'severity' ? 'Severity' : k === 'opened' ? 'Opened' : 'Title'}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button onClick={() => addToast({ message: `Open workflow run for ${g.workflowName} — coming soon`, type: 'info' })}
                      className="text-[0.75rem] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer hidden md:inline">
                      View workflow →
                    </button>
                    <button onClick={() => toggleGroupCollapse(g.workflowId)}
                      className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-500 hover:bg-canvas hover:text-ink-800 cursor-pointer"
                      aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}>
                      <ChevronRight size={14} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                    </button>
                  </div>
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.16 }}
                        className="overflow-hidden">
                        <ul className="divide-y divide-canvas-border/60">
                          {sortedRows.map((ex) => (
                            <ExceptionRow key={ex.id} ex={ex} selected={selectedIds.has(ex.id)}
                              onToggle={() => toggleOne(ex.id)} onOpen={() => setSelectedException(ex)}
                              extraAssignees={extraAssignees[ex.id] ?? []} />
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Per-exception drawer */}
      <AnimatePresence>
        {selectedException && (
          <EngagementExceptionDrawer exception={selectedException} onClose={() => setSelectedException(null)}
            onOpenWorkflowRun={(wfId) => addToast({ message: `Open workflow run for ${wfId} — coming soon`, type: 'info' })} />
        )}
      </AnimatePresence>

      {/* Audit pack export FAB */}
      {!embedded && (
        <button onClick={() => addToast({ message: 'Generating audit pack…', type: 'info' })}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 px-4 h-11 rounded-full bg-ink-900 hover:bg-ink-800 text-white text-[0.75rem] font-semibold shadow-xl cursor-pointer transition-colors"
          aria-label="Generate audit pack">
          <FileSpreadsheet size={14} /> Audit pack export
        </button>
      )}
    </div>
  );
}
