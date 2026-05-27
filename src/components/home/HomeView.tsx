import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import * as RGL from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// react-grid-layout's API surface differs between v1 (WidthProvider HOC) and
// v2 (hook-based). Resolving at component-render time so a missing or
// renamed export can't crash the whole HomeView module.
function resolveGrid(): React.ComponentType<Record<string, unknown>> | null {
  const ns = RGL as unknown as Record<string, unknown>;
  const Responsive = ns.Responsive as React.ComponentType<Record<string, unknown>> | undefined;
  const WidthProvider = ns.WidthProvider as (<P>(C: React.ComponentType<P>) => React.ComponentType<P>) | undefined;
  if (!Responsive || !WidthProvider) return null;
  return WidthProvider(Responsive) as React.ComponentType<Record<string, unknown>>;
}
import {
  Check, X, GripVertical, Sparkles,
  Workflow as WorkflowIcon, ShieldAlert, ClipboardCheck,
  ArrowRight, Plus, AlertTriangle, Activity,
  TrendingUp, Shield, Bell, Share2, MessageSquare, Calendar,
  LayoutGrid, FileText, BarChart3,
  Briefcase, Database, AlertOctagon,
  Layers, Wand2, Search, TableProperties,
  ChevronDown, Settings, Star, Pin,
} from 'lucide-react';
import type { View } from '../../hooks/useAppState';
import { RISKS, CONTROLS, ENGAGEMENTS, ENGAGEMENT_CONTROLS, DEFICIENCIES, WORKFLOWS, GRC_EXCEPTIONS, DATA_SOURCES, BUSINESS_PROCESSES, GENERATED_REPORTS } from '../../data/mockData';
import { QUERY_SESSIONS } from '../../data/queryHistory';
import { SeverityBadge } from '../shared/StatusBadge';
import type { PlatformNotification, NotificationCategory } from '../../data/notifications';
import { dayBucket, type DayBucket } from '../../utils/timeAgo';
import NotificationRow from '../notifications/NotificationRow';

interface Props {
  setView: (v: View) => void;
  notifications: PlatformNotification[];
  onSelectNotification: (n: PlatformNotification) => void;
  onOpenNotificationDrawer: () => void;
  setChatInitialQuery: (q: string | null) => void;
  setSelectedWorkflow: (id: string | null) => void;
  openAuditExecution: (engagementId: string) => void;
  setSelectedBP: (id: string | null) => void;
  onLaunchWorkflowBuilder?: (prompt: string) => void;
}

// ─── Onboarding checklist ────────────────────────────────────────────────────

interface OnboardingStep {
  id: string;
  label: string;
  cta: string;
  go: View;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'team',       label: 'Invite your team',         cta: 'Invite',  go: 'admin-users' },
  { id: 'data',       label: 'Connect a data source',    cta: 'Connect', go: 'knowledge-hub' },
  { id: 'workflow',   label: 'Run your first workflow',  cta: 'Run',     go: 'workflow-library' },
  { id: 'engagement', label: 'Create a test engagement', cta: 'Create',  go: 'audit-execution' },
  { id: 'report',     label: 'Export your first report', cta: 'Export',  go: 'reports' },
];

const ONBOARDING_KEY = 'home.onboarding.v1';

function QuickActionPanel({ setView, onDismiss }: { setView: Props['setView']; onDismiss: () => void }) {
  const [done, setDone] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(Array.from(done)));
  }, [done]);

  const total = ONBOARDING_STEPS.length;
  const completed = done.size;
  const pct = Math.round((completed / total) * 100);
  const allDone = completed === total;
  // Collapse the panel as soon as the user makes any progress. The full
  // 5-row card is only valuable on first visit; once even one step is done,
  // a single-line strip with the next action is enough.
  const inProgress = !allDone && completed >= 1;

  // Auto-dismiss permanently once every step is checked. Done as an effect so
  // localStorage and the parent flag stay in sync without a render-loop.
  useEffect(() => {
    if (allDone) onDismiss();
  }, [allDone, onDismiss]);

  const toggle = (id: string) => {
    setDone(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (allDone) return null;

  // In-progress: collapse to a single-line strip so the full 5-step panel
  // doesn't keep dominating above-the-fold once setup is underway. Shows the
  // next step's CTA inline; user can always re-expand by clicking "Show steps".
  if (inProgress) {
    const remaining = ONBOARDING_STEPS.find(s => !done.has(s.id));
    const remainingCount = total - completed;
    return (
      <section className="rounded-2xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_8_30_/_0.04)] px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
            <Sparkles size={13} className="text-brand-700" />
          </div>
          <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
            <span className="text-meta text-ink-800 font-medium tabular-nums">
              Setup {pct}% complete
            </span>
            <span className="text-meta text-ink-500">
              {remainingCount} step{remainingCount === 1 ? '' : 's'} left{remaining ? `. Next: ${remaining.label.toLowerCase()}` : ''}.
            </span>
          </div>
          {/* Tabular progress bar mirrors the full-panel one for continuity. */}
          <div className="hidden sm:block w-24 h-1 rounded-full bg-canvas-border overflow-hidden shrink-0 ml-2">
            <div className="h-full bg-brand-600 transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {remaining && (
            <button
              onClick={() => setView(remaining.go)}
              className="inline-flex items-center gap-1 text-meta font-semibold text-brand-700 hover:text-brand-600 transition-colors cursor-pointer"
            >
              {remaining.cta}
              <ArrowRight size={13} />
            </button>
          )}
          <button
            onClick={onDismiss}
            className="text-ink-400 hover:text-ink-700 transition-colors p-1 rounded-md cursor-pointer"
            aria-label="Dismiss onboarding"
          >
            <X size={14} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_8_30_/_0.04)] p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-brand-700" />
          </div>
          <div>
            <div className="font-display text-[20px] font-[420] text-ink-900 leading-tight">
              Set up your workspace <span className="font-mono font-normal text-xs text-ink-500 ml-1">· {completed}/{total} done</span>
            </div>
            <p className="text-meta text-ink-500 mt-0.5">Get your workspace set up in a few quick steps.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-xs font-mono text-ink-500 tabular-nums">{pct}%</div>
          {/* Track contrast bumps when empty so a 0% bar still reads as a track,
              not a flat line. Once progress starts, switches back to the lighter
              canvas-border so the brand fill is the dominant signal. */}
          <div className={`w-32 h-1.5 rounded-full overflow-hidden ${pct === 0 ? 'bg-ink-300/40' : 'bg-canvas-border'}`}>
            <div
              className="h-full bg-brand-600 transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            onClick={onDismiss}
            className="text-ink-400 hover:text-ink-700 transition-colors p-1 rounded-md cursor-pointer"
            aria-label="Dismiss onboarding"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* First incomplete row gets a subtle brand tint + accented checkbox so the
          user knows where to start at first visit. Falls back to default once
          that step is checked. */}
      <ul className="divide-y divide-canvas-border">
        {ONBOARDING_STEPS.map((step, idx) => {
          const isDone = done.has(step.id);
          const firstIncompleteIdx = ONBOARDING_STEPS.findIndex(s => !done.has(s.id));
          const isNext = !isDone && idx === firstIncompleteIdx;
          return (
            <li
              key={step.id}
              className={`flex items-center gap-3 py-3 -mx-2 px-2 rounded-md transition-colors ${
                isNext ? 'bg-brand-50/60' : ''
              }`}
            >
              <button
                onClick={() => toggle(step.id)}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  isDone
                    ? 'bg-compliant border-compliant text-white'
                    : isNext
                      ? 'border-brand-400 hover:border-brand-500'
                      : 'border-canvas-border hover:border-brand-300'
                }`}
                aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
              >
                {isDone && <Check size={12} strokeWidth={3} />}
              </button>
              <span className={`flex-1 text-sm ${isDone ? 'text-ink-400 line-through' : isNext ? 'text-ink-900 font-medium' : 'text-ink-800'}`}>
                {step.label}
              </span>
              <button
                onClick={() => setView(step.go)}
                className="flex items-center gap-1 text-meta font-semibold text-brand-700 hover:text-brand-600 transition-colors cursor-pointer"
              >
                {step.cta}
                <ArrowRight size={13} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Work Queue ──────────────────────────────────────────────────────────────

type QueueType = 'workflow' | 'approval' | 'task';

interface QueueItem {
  id: string;
  type: QueueType;
  item: string;
  context: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  due: string;            // human-readable
  dueDate: Date;
  action: { label: string; go: View };
}

function buildWorkQueue(): QueueItem[] {
  const today = new Date('2026-04-23');
  const days = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Workflows that haven't been run recently — flag a few as "pending to run".
  const pendingWfs = WORKFLOWS.slice(0, 3).map((wf, i): QueueItem => ({
    id: `q-wf-${wf.id}`,
    type: 'workflow',
    item: wf.name,
    context: `${wf.type} · ${wf.runs} prior runs`,
    risk: i === 0 ? 'critical' : i === 1 ? 'high' : 'medium',
    due: fmt(days(i === 0 ? -1 : i + 1)),
    dueDate: days(i === 0 ? -1 : i + 1),
    action: { label: 'Run', go: 'workflow-library' },
  }));

  // Deficiency approvals.
  const approvals = DEFICIENCIES.filter(d => d.status !== 'resolved').map((d): QueueItem => ({
    id: `q-app-${d.id}`,
    type: 'approval',
    item: d.finding.length > 60 ? d.finding.slice(0, 57) + '…' : d.finding,
    context: `Deficiency · ${d.assignee}`,
    risk: d.severity === 'MW' ? 'critical' : d.severity === 'SD' ? 'high' : 'medium',
    due: d.due,
    dueDate: new Date(d.due),
    action: { label: 'Open', go: 'findings' },
  }));

  // Engagement control tasks (those not started).
  const tasks = ENGAGEMENT_CONTROLS
    .filter(c => c.oe === 'not-started' || c.de === 'not-started')
    .slice(0, 3)
    .map((c, i): QueueItem => ({
      id: `q-tk-${c.id}`,
      type: 'task',
      item: `Test ${c.control}`,
      context: `${c.racm} · ${c.assignee}`,
      risk: c.isKey ? 'high' : 'medium',
      due: fmt(days(i + 5)),
      dueDate: days(i + 5),
      action: { label: 'Open', go: 'execution-testing' },
    }));

  return [...pendingWfs, ...approvals, ...tasks].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

const TYPE_META: Record<QueueType, { label: string; icon: React.ElementType }> = {
  workflow: { label: 'Workflow',  icon: WorkflowIcon },
  approval: { label: 'Approval',  icon: ShieldAlert },
  task:     { label: 'Task',      icon: ClipboardCheck },
};

function WorkQueueSection({ setView, rangeDays }: { setView: Props['setView']; rangeDays: number | null }) {
  const all = useMemo(buildWorkQueue, []);
  const today = new Date('2026-04-23');

  const items = useMemo(() => {
    if (rangeDays == null) return all;
    const ms = rangeDays * 24 * 60 * 60 * 1000;
    return all.filter(it => Math.abs(it.dueDate.getTime() - today.getTime()) <= ms);
  }, [all, rangeDays, today]);
  // Split into overdue vs upcoming so auditors see urgency at a glance.
  const overdueCount = useMemo(
    () => items.filter(it => it.dueDate.getTime() < today.getTime()).length,
    [items, today],
  );

  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardCheck size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">
            <span className="tabular-nums"><CountUp value={items.length} /></span> items waiting on you
          </h3>
          {overdueCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-risk-50 text-risk-700 border border-risk-200">
              <AlertTriangle size={9} strokeWidth={2.5} />
              <span className="tabular-nums">{overdueCount}</span> overdue
            </span>
          )}
        </div>
        <button
          onClick={() => setView('workflow-library')}
          className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0"
        >
          View all →
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-meta tabular-nums">
          <thead>
            <tr className="border-b border-canvas-border bg-paper-50/40">
              <th className="text-left font-semibold text-ink-500 px-4 h-10 w-[110px]">Type</th>
              <th className="text-left font-semibold text-ink-500 px-2 h-10">Item</th>
              <th className="text-left font-semibold text-ink-500 px-2 h-10 w-[110px]">Risk</th>
              <th className="text-left font-semibold text-ink-500 px-2 h-10 w-[128px]">Due</th>
              <th className="text-right font-semibold text-ink-500 px-4 h-10 w-[90px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const Icon = TYPE_META[it.type].icon;
              const overdue = it.dueDate < today;
              return (
                <tr
                  key={it.id}
                  className={`h-12 ${idx > 0 ? 'border-t border-canvas-border' : ''} hover:bg-brand-50/40 transition-colors`}
                >
                  <td className="px-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-700 font-medium">
                      <Icon size={13} className="text-ink-500" />
                      {TYPE_META[it.type].label}
                    </span>
                  </td>
                  <td className="px-2">
                    <div className="text-ink-900">{it.item}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{it.context}</div>
                  </td>
                  <td className="px-2">
                    <SeverityBadge severity={it.risk} />
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${overdue ? 'text-risk-700 font-medium' : 'text-ink-700'}`}>
                      <Calendar size={12} className="shrink-0" />
                      {it.due}
                    </span>
                  </td>
                  <td className="px-4 text-right">
                    <button
                      onClick={() => setView(it.action.go)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-600 transition-colors cursor-pointer"
                    >
                      {it.action.label}
                      <ArrowRight size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={5} className="text-center text-ink-500 py-8">Nothing waiting on you. Nice.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Health Dashboard ────────────────────────────────────────────────────────

// Severity-coded stacked pill bar. Segments grow from width 0 with stagger,
// so the bar reads as a "filling" rather than appearing all at once.
function StackedPill({
  segments, className = 'h-2',
}: {
  segments: Array<{ value: number; tone: string; label: string }>;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <div className={`${className} rounded-full bg-canvas-border/40`} />;
  }
  return (
    <div className={`flex ${className} rounded-full overflow-hidden bg-canvas-border/40`} role="img">
      {segments.map((s, i) => (
        <motion.div
          key={i}
          className={s.tone}
          initial={{ width: 0 }}
          animate={{ width: `${(s.value / total) * 100}%` }}
          transition={{ delay: 0.5 + i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          aria-label={`${s.label}: ${s.value}`}
        />
      ))}
    </div>
  );
}

// "System is alive" dot — solid center with a pulsing halo on a 2s loop.
function PulseDot({ tone = 'bg-compliant' }: { tone?: string }) {
  return (
    <span className="relative inline-flex items-center justify-center w-2 h-2 shrink-0">
      <motion.span
        className={`absolute inset-0 rounded-full ${tone}`}
        animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
      />
      <span className={`relative w-1.5 h-1.5 rounded-full ${tone}`} />
    </span>
  );
}

// Per-tile status pill — small chip that lives in the top-right corner of
// every Health snapshot tile. Lets the user scan tile health without reading
// any numbers. Tone tokens match the platform's semantic palette.
//
// Visual restraint: only the `action` state keeps the loud filled chip. The
// other states (on-track / watch / info) render as text-only labels — they
// communicate state without competing with the Material Weakness banner or
// the actual KPI numbers. Most tiles sit at "watch", so a loud "WATCH" pill
// on every tile was just chrome noise.
type StatusKind = 'on-track' | 'watch' | 'action' | 'info';
const STATUS_PILL_TONE: Record<StatusKind, { label: string; loud: boolean; bg: string; text: string; border: string }> = {
  'on-track': { label: 'On track', loud: false, bg: '', text: 'text-compliant-700', border: '' },
  'watch':    { label: 'Watch',    loud: false, bg: '', text: 'text-mitigated-700', border: '' },
  'action':   { label: 'Action',   loud: true,  bg: 'bg-risk-50', text: 'text-risk-700', border: 'border-risk-200' },
  'info':     { label: 'Info',     loud: false, bg: '', text: 'text-ink-500',       border: '' },
};
function StatusPill({ kind, label }: { kind: StatusKind; label?: string }) {
  const t = STATUS_PILL_TONE[kind];
  // Default state (watch / on-track / info) renders nothing — the absence of a
  // pill IS the signal. Only `action` is shown, so when a tile flags ACTION it
  // actually means "this needs you" rather than "every tile shouts at once".
  if (!t.loud) return null;
  return (
    <span className={`inline-flex items-center text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${t.bg} ${t.text} ${t.border}`}>
      {label ?? t.label}
    </span>
  );
}

// ─── Health Dashboard sub-tile picker ─────────────────────────────────────
// Each of the 10 internal tiles can be toggled on/off; selection persists
// per user. State is independent from the page-level widget catalogue.

type HealthTileKey =
  | 'completion' | 'risk' | 'controls'
  | 'compliance' | 'coverage' | 'calendar' | 'wf-performance' | 'top-workflows';

// Note: the former 'workflow-kpi' tile (runs-this-period sparkline) was merged
// into 'wf-performance' so the dashboard isn't carrying two green workflow
// tiles. wf-performance now shows success rate as the headline + total runs +
// active count as inline supporting metrics, plus the type breakdown bar.
const HEALTH_TILES: { id: HealthTileKey; label: string; description: string }[] = [
  { id: 'completion',     label: 'FY26 Completion',      description: 'Hero KPI with trend chart' },
  { id: 'risk',           label: 'Risk overview',         description: 'Severity stacked pill' },
  { id: 'controls',       label: 'Controls',              description: 'Effective / pending / overdue' },
  { id: 'compliance',     label: 'Compliance Score',      description: 'Donut ring + 8-point trend sparkline' },
  { id: 'coverage',       label: 'Framework Coverage',    description: 'SOX / ITGC / IFC bars' },
  { id: 'calendar',       label: 'Next audit',            description: 'Days until next audit' },
  { id: 'wf-performance', label: 'Workflow performance',  description: 'Success rate + total runs + type breakdown' },
  { id: 'top-workflows',  label: 'Top workflows',         description: 'Named workflows with last-10 run health strip' },
];

const HEALTH_TILES_KEY = 'home.health-tiles.v1';

function isHealthTileKey(k: unknown): k is HealthTileKey {
  return typeof k === 'string' && HEALTH_TILES.some(t => t.id === k);
}

function loadHealthTiles(): Set<HealthTileKey> {
  if (typeof window === 'undefined') return new Set(HEALTH_TILES.map(t => t.id));
  try {
    const raw = window.localStorage.getItem(HEALTH_TILES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const valid = arr.filter(isHealthTileKey);
        if (valid.length > 0) return new Set(valid);
      }
    }
  } catch { /* fall through */ }
  return new Set(HEALTH_TILES.map(t => t.id));
}

function HealthTilesPicker({
  visible, onToggle,
}: {
  visible: Set<HealthTileKey>;
  onToggle: (k: HealthTileKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const recompute = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setCoords({ top: r.bottom + 6, right: window.innerWidth - r.right });
    };
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-xs font-medium text-ink-500 hover:text-brand-700 hover:bg-canvas-border/40 transition-colors cursor-pointer"
      >
        <Settings size={11} />
        <span>Customize tiles</span>
      </button>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit   ={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              role="menu"
              style={{ position: 'fixed', top: coords.top, right: coords.right, zIndex: 'var(--z-popover)' }}
              className="w-80 max-h-[80vh] overflow-y-auto rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_16px_48px_rgb(15_8_30_/_0.16),_0_4px_12px_rgb(15_8_30_/_0.06)]"
            >
              <div className="px-4 py-2 border-b border-canvas-border/60 bg-canvas flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-ink-500">
                  Health snapshot tiles
                </span>
                <span className="text-xs font-mono tabular-nums text-ink-500">
                  {visible.size}/{HEALTH_TILES.length}
                </span>
              </div>
              <div className="py-1">
                {HEALTH_TILES.map(tile => {
                  const isVisible = visible.has(tile.id);
                  return (
                    <button
                      key={tile.id}
                      role="menuitemcheckbox"
                      aria-checked={isVisible}
                      onClick={() => onToggle(tile.id)}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-brand-50/40 transition-colors cursor-pointer text-left"
                    >
                      <div className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border-2 shrink-0 transition-colors ${isVisible ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-canvas-elevated'}`}>
                        {isVisible && <Check size={10} strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[12.5px] font-medium ${isVisible ? 'text-ink-900' : 'text-ink-700'}`}>{tile.label}</div>
                        <div className="text-xs text-ink-500 mt-0.5 leading-snug">{tile.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

function HealthDashboardSection({
  setView, rangeDays, dateRangeId, onRemove, setSelectedWorkflow, isPinned, togglePin,
}: {
  setView: Props['setView'];
  rangeDays: number | null;
  dateRangeId: DateRange;
  onRemove?: () => void;
  setSelectedWorkflow: Props['setSelectedWorkflow'];
  isPinned: (kind: PinKind, id: string) => boolean;
  togglePin: (kind: PinKind, id: string) => void;
}) {
  const [visibleTiles, setVisibleTiles] = useState<Set<HealthTileKey>>(loadHealthTiles);
  // Guard so the auto-remove effect only fires after a user-driven unselect,
  // never on first mount (defends against an empty Set ever leaking through
  // loadHealthTiles or hot-reload state).
  const hasUserToggledRef = useRef(false);
  useEffect(() => {
    try { localStorage.setItem(HEALTH_TILES_KEY, JSON.stringify([...visibleTiles])); } catch { /* ignore */ }
    if (hasUserToggledRef.current && visibleTiles.size === 0 && onRemove) onRemove();
  }, [visibleTiles, onRemove]);
  const toggleTile = (k: HealthTileKey) => {
    hasUserToggledRef.current = true;
    setVisibleTiles(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  const showTile = (k: HealthTileKey) => visibleTiles.has(k);
  const scale = scaleForRange(rangeDays);
  const scaled = (n: number) => Math.round(n * scale);

  const active = ENGAGEMENTS.filter(e => e.status === 'active');
  const planned    = active.reduce((s, e) => s + e.controls, 0);
  const executed   = scaled(active.reduce((s, e) => s + e.tested, 0));
  const completionPct = planned > 0 ? Math.round((executed / planned) * 100) : 0;

  const riskTotal   = scaled(RISKS.length);
  const riskFailed  = scaled(RISKS.filter(r => r.status === 'open' && (r.severity === 'critical' || r.severity === 'high')).length);
  const riskHealthy = scaled(RISKS.filter(r => r.status === 'mitigated').length);

  const ctlTotal   = scaled(CONTROLS.length);
  const ctlPending = scaled(CONTROLS.filter(c => c.status === 'not-tested').length);
  const ctlOverdue = scaled(CONTROLS.filter(c => c.status === 'ineffective').length);

  // Derived data from mock sources
  const defOpen = scaled(DEFICIENCIES.filter(d => d.status === 'open').length);
  const defInProgress = scaled(DEFICIENCIES.filter(d => d.status === 'in-progress').length);
  const defTotal = defOpen + defInProgress;
  const defMW = scaled(DEFICIENCIES.filter(d => d.severity === 'MW').length);
  const totalWorkflowRuns = scaled(WORKFLOWS.reduce((s, w) => s + w.runs, 0));
  const wfExceptionsDetected = Math.round(WORKFLOWS.reduce((s, w) => s + w.runs * 0.05, 0) * scale);

  // Row 3 additions — surface compliance posture, framework coverage, and
  // upcoming audit timing inside the Health snapshot.
  const complianceScore = scaled(92);
  const FRAMEWORKS = [
    // Framework bars are categorical (3 frameworks), but they all communicate
    // the same kind of fact (% coverage). Using one tone everywhere lets the
    // numbers do the comparison instead of forcing the eye to decode hue.
    { name: 'SOX',  pct: scaled(78), color: 'var(--color-brand-500)' },
    { name: 'ITGC', pct: scaled(65), color: 'var(--color-brand-400)' },
    { name: 'IFC',  pct: scaled(52), color: 'var(--color-brand-300)' },
  ];
  const nextAuditDays = 12;

  // Row 4 — workflow-level depth: success rate, type breakdown, top performers.
  const wfSuccessRate = scaled(96);
  const wfTypeBreakdown: Array<{ type: string; runs: number; color: string }> = (() => {
    const acc: Record<string, number> = {};
    for (const w of WORKFLOWS) acc[w.type] = (acc[w.type] || 0) + w.runs;
    // Single-hue brand scale — workflow types are categorical, not semantic,
    // so encoding them with green/red/amber added meaning that wasn't there.
    // The legend names tell the user which is which; the bar shows proportion.
    const colorMap: Record<string, string> = {
      Reconciliation: 'var(--color-brand-600)',
      Detection:      'var(--color-brand-400)',
      Compliance:     'var(--color-brand-300)',
      Monitoring:     'var(--color-brand-200)',
    };
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .map(([type, runs]) => ({ type, runs: scaled(runs), color: colorMap[type] ?? 'var(--color-ink-300)' }));
  })();
  const topWorkflows = [...WORKFLOWS].sort((a, b) => b.runs - a.runs).slice(0, 3);
  const activeWorkflows = scaled(WORKFLOWS.length);

  // Per-tile status — drives the StatusPill in each tile's top-right corner.
  // Conservative thresholds: ACTION only for unmistakable red signals.
  const criticalRiskCount = scaled(RISKS.filter(r => r.status === 'open' && r.severity === 'critical').length);
  const complianceStatus: StatusKind = complianceScore >= 85 ? 'on-track' : complianceScore >= 70 ? 'watch' : 'action';
  const riskStatus: StatusKind        = criticalRiskCount === 0 ? 'on-track' : criticalRiskCount <= 3 ? 'watch' : 'action';
  const defStatus: StatusKind         = defMW > 0 ? 'action' : defTotal > 0 ? 'watch' : 'on-track';
  const ctlStatus: StatusKind         = ctlOverdue === 0 ? 'on-track' : ctlOverdue <= 3 ? 'watch' : 'action';
  const auditStatus: StatusKind       = nextAuditDays > 14 ? 'on-track' : nextAuditDays > 7 ? 'watch' : 'action';
  const wfPerfStatus: StatusKind      = wfSuccessRate >= 90 ? 'on-track' : wfSuccessRate >= 75 ? 'watch' : 'action';
  // Effective controls = total - pending - overdue. Used by the redesigned
  // Controls tile as the "8 / 87 effective" denominator.
  const ctlEffective = Math.max(0, ctlTotal - ctlPending - ctlOverdue);

  // Sparkline data derived from real engagement progression
  const COMPLETION_TREND = active.map((_, i) => {
    const slice = active.slice(0, i + 1);
    const p = slice.reduce((s, e) => s + e.controls, 0);
    const e2 = slice.reduce((s, e) => s + e.tested, 0);
    return p > 0 ? Math.round((e2 / p) * 100) : 0;
  });
  // Pad to at least 8 points for a nice chart
  while (COMPLETION_TREND.length < 8) COMPLETION_TREND.unshift(Math.max(0, COMPLETION_TREND[0] - Math.floor(Math.random() * 5 + 2)));
  const compMax = Math.max(...COMPLETION_TREND);
  const compMin = Math.min(...COMPLETION_TREND);

  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-2 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">{
            dateRangeId === 'all'    ? 'FY26' :
            dateRangeId === 'qtd'    ? 'Quarterly' :
            dateRangeId === 'ytd'    ? 'Year-to-date' :
            dateRangeId === 'custom' ? 'Custom range' :
            `Last ${rangeDays} days`
          } health snapshot</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <HealthTilesPicker visible={visibleTiles} onToggle={toggleTile} />
          <span className="text-xs text-ink-400 tabular-nums">Updated today</span>
        </div>
      </div>
      <motion.div
        variants={HEALTH_GRID_VARIANTS}
        initial="hidden"
        animate="show"
        className={`flex-1 overflow-hidden p-3 grid grid-flow-row-dense gap-3 ${visibleTiles.size === 1 ? 'grid-cols-1 [&>*]:!col-span-1 [&>*]:!row-span-1' : 'grid-cols-12'}`}
        style={{ gridAutoRows: '220px' }}
      >
        {/* ── FY26 Completion — primary hero tile.
            Layout: FY26 brand pill + caption → giant gradient % + delta chip →
            stat trio (executed / remaining / engagements) → 8-quarter area
            chart on absolute 0–100 scale, with a dashed target line at 75%
            and quarter labels on the x-axis. The chart now reads as data,
            not decoration. */}
        {showTile('completion') && (() => {
          const remaining = Math.max(0, planned - executed);
          // Force the last trend point to equal completionPct so the chart's
          // current bar matches the hero number (the upstream trend is computed
          // from unscaled values).
          const displayTrend = [...COMPLETION_TREND.slice(0, -1), completionPct];
          const priorPct = displayTrend[displayTrend.length - 2] ?? 0;
          const delta = completionPct - priorPct;
          const trendUp = delta >= 0;
          // Rescale chart to the data range with 12% headroom top + bottom so
          // the line uses the full canvas instead of being squashed.
          const dataMin = Math.min(...displayTrend);
          const dataMax = Math.max(...displayTrend);
          const range = (dataMax - dataMin) || 1;
          const padTop = 12;
          const padBottom = 18;
          const chartH = 130;
          const yFor = (v: number) =>
            chartH - padBottom - ((v - dataMin) / range) * (chartH - padTop - padBottom);
          const xFor = (i: number) => (i / (COMPLETION_TREND.length - 1)) * 240;
          // Smooth curve — cubic bezier between each pair of points using
          // tangent points 1/3 of the way to neighbors (Catmull-Rom-ish).
          // Reads as a flowing trend instead of a jagged polyline.
          const points = COMPLETION_TREND.map((v, j) => ({ x: xFor(j), y: yFor(v) }));
          const smooth = (i: number) => {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            const t = 0.22;
            const c1x = p1.x + (p2.x - p0.x) * t;
            const c1y = p1.y + (p2.y - p0.y) * t;
            const c2x = p2.x - (p3.x - p1.x) * t;
            const c2y = p2.y - (p3.y - p1.y) * t;
            return `C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
          };
          const linePath = `M${points[0].x},${points[0].y} ${points.slice(0, -1).map((_, i) => smooth(i)).join(' ')}`;
          const areaPath = `${linePath} L${points[points.length - 1].x},${chartH} L${points[0].x},${chartH} Z`;
          return (
            <motion.button
              type="button"
              onClick={() => setView('audit-planning')}
              aria-label="Open audit planning"
              variants={HEALTH_TILE_VARIANTS}
              className="text-left col-span-4 row-span-2 order-1 rounded-2xl p-6 flex flex-col gap-5 border border-canvas-border bg-white relative overflow-hidden cursor-pointer transition-[box-shadow,border-color] duration-300 ease-out hover:border-brand-300 hover:shadow-[0_0_0_1px_rgb(15_8_30_/_0.06),_0_12px_28px_rgb(15_8_30_/_0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {/* Aurora — pulled WAY back. The previous 14% alpha was washing
                  everything in pink and killing chart contrast. 5% is just
                  enough to mark this tile as the hero without crushing
                  readability of the line and target text underneath. */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at top right, rgba(136,56,222,0.05), transparent 55%)',
                }}
              />

              {/* Header — FY26 brand pill + caption (both readable at glance) */}
              <div className="relative flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-white bg-brand-700 px-2 py-1 rounded-md">FY26</span>
                <span className="text-xs font-bold text-ink-700 uppercase tracking-wider">Completion</span>
              </div>

              {/* Hero pie — centered, dominant, fills the tile vertically.
                  Stats live underneath as a single tight row, not crammed in
                  a side column. */}
              <div className="relative flex items-center justify-center flex-1">
                {(() => {
                  const size = 260;
                  const cx = size / 2, cy = size / 2, r = size / 2 - 8;
                  const pct = Math.max(0, Math.min(100, completionPct));
                  const angle = (pct / 100) * 2 * Math.PI;
                  const endX = cx + r * Math.sin(angle);
                  const endY = cy - r * Math.cos(angle);
                  const largeArc = pct > 50 ? 1 : 0;
                  const slicePath = pct >= 99.99
                    ? `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx - 0.001},${cy - r} Z`
                    : `M ${cx},${cy} L ${cx},${cy - r} A ${r},${r} 0 ${largeArc},1 ${endX},${endY} Z`;
                  const exAngle = angle / 2;
                  const exLx = cx + (r * 0.6) * Math.sin(exAngle);
                  const exLy = cy - (r * 0.6) * Math.cos(exAngle);
                  const remAngle = angle + (2 * Math.PI - angle) / 2;
                  const remLx = cx + (r * 0.6) * Math.sin(remAngle);
                  const remLy = cy - (r * 0.6) * Math.cos(remAngle);
                  return (
                    // aspect-square forces a strict 1:1 box so flex parents
                    // cannot squeeze the pie into an oval.
                    <div className="relative aspect-square" style={{ width: size, height: size }}>
                      <svg viewBox={`0 0 ${size} ${size}`} className="block w-full h-full" preserveAspectRatio="xMidYMid meet">
                        <defs>
                          <linearGradient id="homeCompPie" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%"   stopColor="var(--color-brand-500)" />
                            <stop offset="100%" stopColor="var(--color-brand-800)" />
                          </linearGradient>
                        </defs>
                        {/* Remaining slice — full circle behind everything. No drop
                            shadow filter (it was distorting the apparent shape). */}
                        <circle cx={cx} cy={cy} r={r} fill="var(--color-brand-100)" />
                        {/* Executed wedge */}
                        <motion.path
                          d={slicePath}
                          fill="url(#homeCompPie)"
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          style={{ transformOrigin: `${cx}px ${cy}px` }}
                          transition={{ delay: 0.4, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        />
                        {/* Crisp ring + slice dividers */}
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="white" strokeWidth="3" />
                        <line x1={cx} y1={cy} x2={cx} y2={cy - r} stroke="white" strokeWidth="3" />
                        {pct > 0 && pct < 100 && (
                          <line x1={cx} y1={cy} x2={endX} y2={endY} stroke="white" strokeWidth="3" />
                        )}
                        {/* Slice labels — big and centered */}
                        {pct >= 12 && (
                          <motion.text
                            x={exLx} y={exLy}
                            textAnchor="middle" dominantBaseline="central"
                            fontSize="42" fontFamily="Inter, sans-serif" fontWeight="700"
                            fill="white"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.2, duration: 0.4 }}
                          >
                            {completionPct}%
                          </motion.text>
                        )}
                        {pct < 88 && pct > 0 && (
                          <motion.text
                            x={remLx} y={remLy}
                            textAnchor="middle" dominantBaseline="central"
                            fontSize="30" fontFamily="Inter, sans-serif" fontWeight="700"
                            fill="var(--color-brand-700)"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.3, duration: 0.4 }}
                          >
                            {100 - completionPct}%
                          </motion.text>
                        )}
                      </svg>
                    </div>
                  );
                })()}
              </div>

              {/* Stat row below the pie — three columns, tight, with swatches
                  matching the pie palette. Plus the delta chip on the right. */}
              <div className="relative flex items-center justify-between gap-4 pt-4 border-t border-canvas-border/70">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-sm bg-brand-700 shrink-0" aria-hidden />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Executed</div>
                    <div className="text-base font-semibold tabular-nums text-ink-900 leading-tight"><CountUp value={executed} /> of <CountUp value={planned} /></div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-sm bg-brand-100 border border-brand-200 shrink-0" aria-hidden />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Remaining</div>
                    <div className="text-base font-semibold tabular-nums text-ink-900 leading-tight"><CountUp value={remaining} /></div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Target</div>
                  <div className="text-base font-semibold tabular-nums text-ink-900 leading-tight">75%</div>
                </div>
                <motion.span
                  initial={{ y: 4, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.0, duration: 0.4 }}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trendUp ? 'text-compliant-700 bg-compliant-50' : 'text-mitigated-700 bg-mitigated-50'}`}
                >
                  <TrendingUp size={11} strokeWidth={2.5} className={trendUp ? '' : 'rotate-180'} />
                  {trendUp ? '+' : ''}{delta} pts
                </motion.span>
              </div>
            </motion.button>
          );
        })()}

        {/* ── Risk Overview — top middle ── */}
        {showTile('risk') && <motion.button
          type="button"
          onClick={() => setView('audit-risk-register')}
          aria-label="Open risk register"
          variants={HEALTH_TILE_VARIANTS}
          className="relative text-left col-span-4 order-6 rounded-2xl p-5 flex flex-col justify-between border bg-canvas-elevated border-canvas-border/60 cursor-pointer transition-[box-shadow,border-color] duration-300 ease-out hover:shadow-[0_0_0_1px_rgb(15_8_30_/_0.06),_0_12px_28px_rgb(15_8_30_/_0.08)] hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <div className="absolute top-3 right-3 z-10"><StatusPill kind={riskStatus} /></div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-ink-400 shrink-0" strokeWidth={1.75} />
              <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Risk overview</span>
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-[40px] font-semibold leading-none tabular-nums text-ink-900"><CountUp value={riskTotal} /></div>
              <span className="text-meta text-ink-500">open risks</span>
            </div>
          </div>
          {/* Labeled severity histogram — each row carries label, count, and a
              proportional bar. The chart IS the breakdown; no separate stacked
              pill needed. Saturations stepped so Critical reads as the loudest. */}
          <div className="mt-4 space-y-1.5">
            {(() => {
              const rows = [
                { label: 'Critical',  count: scaled(RISKS.filter(r => r.severity === 'critical').length), tone: 'bg-risk/85'      },
                { label: 'High',      count: scaled(RISKS.filter(r => r.severity === 'high').length),     tone: 'bg-risk/55'      },
                { label: 'Medium',    count: scaled(RISKS.filter(r => r.severity === 'medium').length),   tone: 'bg-mitigated/70' },
                { label: 'Low',       count: scaled(RISKS.filter(r => r.severity === 'low').length),      tone: 'bg-mitigated/35' },
                { label: 'Mitigated', count: riskHealthy,                                                  tone: 'bg-compliant/70' },
              ];
              const max = Math.max(1, ...rows.map(r => r.count));
              return rows.map((r, i) => (
                <div key={r.label} className="flex items-center gap-3 text-xs">
                  <span className="w-20 text-ink-500 shrink-0">{r.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-canvas-border/40 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${r.tone}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(r.count / max) * 100}%` }}
                      transition={{ delay: 0.4 + i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="w-6 text-right tabular-nums font-semibold text-ink-900 shrink-0">{r.count}</span>
                </div>
              ));
            })()}
          </div>
        </motion.button>}

        {/* ── Controls — top right. Redesigned: effective / total denominator
            + breakdown bar instead of a lonely big number. ── */}
        {showTile('controls') && <motion.button
          type="button"
          onClick={() => setView('governance-controls')}
          aria-label="Open controls library"
          variants={HEALTH_TILE_VARIANTS}
          className="relative text-left col-span-3 order-7 rounded-2xl p-5 flex flex-col justify-between border bg-canvas-elevated border-canvas-border/60 cursor-pointer transition-[box-shadow,border-color] duration-300 ease-out hover:shadow-[0_0_0_1px_rgb(15_8_30_/_0.06),_0_12px_28px_rgb(15_8_30_/_0.08)] hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <div className="absolute top-3 right-3 z-10"><StatusPill kind={ctlStatus} /></div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-ink-400 shrink-0" strokeWidth={1.75} />
              <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Controls</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[40px] font-semibold leading-none tabular-nums text-ink-900"><CountUp value={ctlEffective} /></span>
              <span className="text-base font-medium text-ink-400 tabular-nums">/ <CountUp value={ctlTotal} /></span>
            </div>
            <div className="text-meta text-ink-500 mt-1">effective in library</div>
          </div>
          {/* Status breakdown — three labeled rows: effective / pending / overdue.
              Each shows count + proportional bar. Saturations: compliant for the
              good state, brand-300 for in-flight, mitigated for the slipping one. */}
          <div className="mt-4 space-y-1.5">
            {(() => {
              const rows = [
                { label: 'Effective', count: ctlEffective, tone: 'bg-compliant/70' },
                { label: 'Pending',   count: ctlPending,   tone: 'bg-brand-300'    },
                { label: 'Overdue',   count: ctlOverdue,   tone: 'bg-mitigated/70' },
              ];
              const max = Math.max(1, ...rows.map(r => r.count));
              return rows.map((r, i) => (
                <div key={r.label} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-ink-500 shrink-0">{r.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-canvas-border/40 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${r.tone}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(r.count / max) * 100}%` }}
                      transition={{ delay: 0.4 + i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="w-5 text-right tabular-nums font-semibold text-ink-900 shrink-0">{r.count}</span>
                </div>
              ));
            })()}
          </div>
        </motion.button>}

        {/* ── Row 3 — Compliance Score
            Layout: header → side-by-side (donut + delta context) → 8-quarter
            bar chart → weakest-framework callout. The donut visualizes the
            current %, the bar chart shows trajectory, the callout tells the
            user where to actually focus. */}
        {showTile('compliance') && (() => {
          const trend = [78, 81, 80, 84, 86, 88, 90, complianceScore];
          const priorQuarter = trend[trend.length - 2];
          const delta = complianceScore - priorQuarter;
          const trendUp = delta >= 0;
          const trendMax = Math.max(...trend);
          const weakest = [...FRAMEWORKS].sort((a, b) => a.pct - b.pct)[0];
          return (
            <motion.button
              type="button"
              onClick={() => setView('dashboards')}
              aria-label="Open compliance posture"
              variants={HEALTH_TILE_VARIANTS}
              className="text-left col-span-5 order-2 rounded-2xl p-5 flex flex-col gap-3 border bg-canvas-elevated border-canvas-border/60 relative overflow-hidden cursor-pointer transition-[box-shadow,border-color] duration-300 ease-out hover:shadow-[0_0_0_1px_rgb(15_8_30_/_0.06),_0_12px_28px_rgb(15_8_30_/_0.08)] hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <div className="absolute top-3 right-3 z-10"><StatusPill kind={complianceStatus} /></div>

              {/* Header */}
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-ink-400 shrink-0" strokeWidth={1.75} />
                <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Compliance Score</span>
              </div>

              {/* Donut + delta context */}
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 shrink-0">
                  <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                    <defs>
                      <linearGradient id="complianceRing" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--color-brand-500)" />
                        <stop offset="100%" stopColor="var(--color-brand-800)" />
                      </linearGradient>
                    </defs>
                    <circle cx="40" cy="40" r="32" fill="none" stroke="var(--color-brand-100)" strokeWidth="7" />
                    <motion.circle
                      cx="40" cy="40" r="32"
                      fill="none"
                      stroke="url(#complianceRing)"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 32}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - complianceScore / 100) }}
                      transition={{ delay: 0.5, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[16px] font-semibold leading-none tabular-nums text-ink-900">
                      <CountUp value={complianceScore} />%
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className={`inline-flex items-center gap-1 text-xs font-semibold ${trendUp ? 'text-compliant-700' : 'text-mitigated-700'}`}>
                    <TrendingUp size={11} strokeWidth={2.5} className={trendUp ? '' : 'rotate-180'} />
                    {trendUp ? '+' : ''}{delta} pts vs prior quarter
                  </div>
                  <div className="text-meta text-ink-500">across SOX · ITGC · IFC <span className="text-ink-300">·</span> target <span className="font-semibold text-ink-900 tabular-nums">85%</span></div>
                </div>
              </div>

              {/* 8-quarter bar chart — bars rescaled with a min-floor so the
                  ~80→90→72 trajectory actually reads (not all bars look equal).
                  Current quarter is brand-600, prior quarters are brand-200. */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-ink-400 mb-1">
                  <span>8-quarter trend</span>
                  <span className="tabular-nums text-ink-500">{trend[0]} → {complianceScore}%</span>
                </div>
                {(() => {
                  const trendMin = Math.min(...trend);
                  const trendRange = (trendMax - trendMin) || 1;
                  return (
                    <div className="h-9 flex items-end justify-between gap-[3px]">
                      {trend.map((v, j) => {
                        const isCurrent = j === trend.length - 1;
                        // 25% floor + 75% range so the lowest bar is still visible
                        // and the differences read clearly.
                        const heightPct = 25 + ((v - trendMin) / trendRange) * 75;
                        return (
                          <motion.div
                            key={j}
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPct}%` }}
                            transition={{ delay: 0.5 + j * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className={`flex-1 rounded-t-sm ${isCurrent ? 'bg-brand-600' : 'bg-brand-200'}`}
                            style={{ minHeight: 3 }}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Weakest-framework callout — single actionable insight, only when
                  it clears the tile constraint. Subtle inline so it doesn't push
                  the bars out of the visible row. */}
              {weakest && weakest.pct < 60 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-ink-500">Weakest:</span>
                  <span className="font-semibold text-mitigated-700">{weakest.name}</span>
                  <span className="font-semibold tabular-nums text-mitigated-700">{weakest.pct}%</span>
                </div>
              )}
            </motion.button>
          );
        })()}

        {/* ── Row 3 — Coverage by framework (animated bars) ── */}
        {showTile('coverage') && <motion.button
          type="button"
          onClick={() => setView('governance-controls')}
          aria-label="Open framework coverage"
          variants={HEALTH_TILE_VARIANTS}
          className="relative text-left col-span-5 order-4 rounded-2xl p-5 flex flex-col gap-4 border bg-canvas-elevated border-canvas-border/60 cursor-pointer transition-[box-shadow,border-color] duration-300 ease-out hover:border-brand-300 hover:shadow-[0_0_0_1px_rgb(15_8_30_/_0.06),_0_12px_28px_rgb(15_8_30_/_0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-ink-400 shrink-0" strokeWidth={1.75} />
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Framework coverage</span>
          </div>

          {/* Three mini-cards, one per framework. Each is a self-contained
              read: name, ring-gauge with %, status word. The ring tone IS the
              signal — green for on-track, amber for watch, red for action —
              so the user can scan three rings and instantly know which
              framework needs work. */}
          <div className="grid grid-cols-3 gap-2.5 flex-1">
            {FRAMEWORKS.map((f, i) => {
              const status: 'ontrack' | 'watch' | 'action' =
                f.pct >= 70 ? 'ontrack' : f.pct >= 50 ? 'watch' : 'action';
              const ringStroke =
                status === 'action'  ? 'var(--color-risk)' :
                status === 'watch'   ? 'var(--color-mitigated)' :
                                       'var(--color-compliant)';
              const ringTrack =
                status === 'action'  ? 'var(--color-risk-50)' :
                status === 'watch'   ? 'var(--color-mitigated-50)' :
                                       'var(--color-compliant-50)';
              const statusTone =
                status === 'action'  ? 'text-risk-700' :
                status === 'watch'   ? 'text-mitigated-700' :
                                       'text-compliant-700';
              const statusLabel =
                status === 'action'  ? 'Action' :
                status === 'watch'   ? 'Watch'  :
                                       'On track';
              return (
                <div
                  key={f.name}
                  className="flex flex-col items-center justify-between text-center rounded-xl border border-canvas-border/50 bg-canvas/40 px-2 py-3 transition-colors hover:border-canvas-border hover:bg-canvas"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500">{f.name}</span>

                  <div className="relative w-14 h-14 my-2">
                    <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                      <circle cx="40" cy="40" r="32" fill="none" stroke={ringTrack} strokeWidth="7" />
                      <motion.circle
                        cx="40" cy="40" r="32"
                        fill="none"
                        stroke={ringStroke}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 32}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - f.pct / 100) }}
                        transition={{ delay: 0.4 + i * 0.1, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[14px] font-semibold tabular-nums text-ink-900 leading-none">
                        <CountUp value={f.pct} />%
                      </span>
                    </div>
                  </div>

                  <span className={`text-[9.5px] font-bold uppercase tracking-wider ${statusTone}`}>
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.button>}

        {/* ── Row 3 — Upcoming audit timing
            Premium layout: hero calendar tear (w/ day-of-week) on the left,
            big countdown number on the right. Below: cycle name + lead on a
            single line. Footer: 14 dots representing the prep window — days
            elapsed are filled, audit-day is the brand-600 anchor on the right.
            The dot row replaces the generic progress bar with something the
            eye can actually count. */}
        {showTile('calendar') && (() => {
          const elapsed = Math.max(0, Math.min(14, 14 - nextAuditDays));
          const dotTone = nextAuditDays <= 7 ? 'bg-risk/85' : nextAuditDays <= 14 ? 'bg-mitigated/75' : 'bg-brand-500';
          return (
            <motion.button
              type="button"
              onClick={() => setView('audit-planning')}
              aria-label="Open audit calendar"
              variants={HEALTH_TILE_VARIANTS}
              className="relative text-left col-span-3 order-3 rounded-2xl p-5 flex flex-col gap-4 border bg-canvas-elevated border-canvas-border/60 cursor-pointer transition-[box-shadow,border-color] duration-300 ease-out hover:shadow-[0_0_0_1px_rgb(15_8_30_/_0.06),_0_12px_28px_rgb(15_8_30_/_0.08)] hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <div className="absolute top-3 right-3 z-10"><StatusPill kind={auditStatus} /></div>

              {/* Header */}
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-ink-400 shrink-0" strokeWidth={1.75} />
                <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Next audit</span>
              </div>

              {/* Hero row — calendar tear (left) + countdown (right) */}
              <div className="flex items-stretch gap-4">
                {/* Calendar tear: month band, big day, weekday footer.
                    Two-zone styling reads like a desk-calendar page. */}
                <div className="shrink-0 w-16 rounded-lg border border-canvas-border bg-canvas-elevated overflow-hidden text-center shadow-[0_1px_2px_rgb(15_8_30_/_0.04)]">
                  <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-evidence-700 bg-evidence-50 py-0.5">Apr</div>
                  <div className="text-[26px] font-semibold leading-none tabular-nums text-ink-900 mt-1.5">23</div>
                  <div className="text-[9.5px] font-medium uppercase tracking-wider text-ink-400 mt-1 mb-1.5">Thu</div>
                </div>
                {/* Countdown — number + days label stacked, supporting text below */}
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[36px] font-semibold leading-none tabular-nums text-ink-900">
                      <CountUp value={nextAuditDays} />
                    </span>
                    <span className="text-meta text-ink-500">days</span>
                  </div>
                  <div className="text-meta font-medium text-ink-900 mt-1.5 truncate">FY26 Q2 SOX</div>
                  <div className="text-xs text-ink-500 truncate">Karan Mehta</div>
                </div>
              </div>

              {/* 14-day countdown dots — the visual hero of the lower half.
                  Elapsed days = filled (mitigated tone, low alpha), today's
                  position = brand-600 (hollow ring), upcoming = canvas-border
                  outline, audit-day (last dot) = brand-600 solid as the anchor. */}
              <div className="mt-auto">
                <div className="flex items-center justify-between gap-1">
                  {Array.from({ length: 14 }, (_, i) => {
                    const isElapsed = i < elapsed;
                    const isToday   = i === elapsed;
                    const isAudit   = i === 13;
                    let cls: string;
                    if (isAudit)        cls = 'bg-brand-600 ring-2 ring-brand-100';
                    else if (isElapsed) cls = dotTone;
                    else if (isToday)   cls = 'bg-canvas-elevated border-2 border-brand-500';
                    else                cls = 'bg-canvas-border/60';
                    return (
                      <motion.span
                        key={i}
                        aria-hidden
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.4 + i * 0.025, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className={`block rounded-full shrink-0 ${isAudit ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'} ${cls}`}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-ink-400 mt-2">
                  <span>Day {elapsed} of 14</span>
                  <span className="text-brand-700 font-semibold">audit day →</span>
                </div>
              </div>
            </motion.button>
          );
        })()}

        {/* ── Row 4 — Workflow Performance: success rate + type breakdown ── */}
        {showTile('wf-performance') && (() => {
          const wfTypeMax = Math.max(1, ...wfTypeBreakdown.map(t => t.runs));
          return (
            <motion.button
              type="button"
              onClick={() => setView('workflow-library')}
              aria-label="Open workflow performance"
              variants={HEALTH_TILE_VARIANTS}
              className="relative text-left col-span-4 order-9 rounded-2xl p-5 flex flex-col gap-4 border bg-canvas-elevated border-canvas-border/60 cursor-pointer transition-[box-shadow,border-color] duration-300 ease-out hover:shadow-[0_0_0_1px_rgb(15_8_30_/_0.06),_0_12px_28px_rgb(15_8_30_/_0.08)] hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {/* Header */}
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-ink-400 shrink-0" strokeWidth={1.75} />
                <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Workflow performance</span>
              </div>

              {/* Side-by-side: hero stack on left, runs-by-type chart on
                  right. Avoids vertical overflow when there are 4+ types and
                  uses the tile width efficiently. */}
              <div className="grid grid-cols-[auto_1fr] gap-5 items-stretch flex-1">
                {/* Hero column */}
                <div className="min-w-[120px] flex flex-col justify-center">
                  <div className="flex items-baseline gap-1.5">
                    <div className="text-[44px] font-semibold leading-none tabular-nums text-ink-900">
                      <CountUp value={wfSuccessRate} />%
                    </div>
                  </div>
                  <div className="text-meta text-ink-500 mt-1">success rate</div>
                  <div className="text-xs text-ink-500 mt-3 tabular-nums space-y-0.5">
                    <div><span className="font-semibold text-ink-900"><CountUp value={totalWorkflowRuns} /></span> runs</div>
                    <div><span className="font-semibold text-ink-900"><CountUp value={activeWorkflows} /></span> active</div>
                    {wfExceptionsDetected > 0 && (
                      <div><span className="font-semibold text-risk-700"><CountUp value={wfExceptionsDetected} /></span> exceptions</div>
                    )}
                  </div>
                </div>

                {/* Runs-by-type chart column */}
                <div className="border-l border-canvas-border/70 pl-5 flex flex-col">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2">Runs by type</div>
                  <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                    {wfTypeBreakdown.map((t, i) => (
                      <div key={t.type} className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-ink-700 truncate shrink-0">{t.type}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-canvas-border/40 overflow-hidden min-w-0">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: t.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(t.runs / wfTypeMax) * 100}%` }}
                            transition={{ delay: 0.4 + i * 0.07, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </div>
                        <span className="ml-auto w-6 text-right tabular-nums font-semibold text-ink-900 shrink-0">{t.runs}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })()}

        {/* ── Row 4 — Top Workflows mini-list ── */}
        {showTile('top-workflows') && <motion.div
          variants={HEALTH_TILE_VARIANTS}
          className="text-left col-span-4 order-10 rounded-2xl p-5 flex flex-col border border-canvas-border/60 bg-canvas-elevated relative overflow-hidden transition-[box-shadow,border-color] duration-150 ease-out hover:shadow-[0_0_0_1px_rgb(15_8_30_/_0.06),_0_12px_28px_rgb(15_8_30_/_0.08)] hover:border-brand-300"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <WorkflowIcon size={14} className="text-ink-400 shrink-0" strokeWidth={1.75} />
              <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Top workflows</span>
            </div>
            <button
              type="button"
              onClick={() => setView('workflow-library')}
              className="text-xs font-medium text-brand-700 hover:text-brand-800 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 rounded"
            >
              View library →
            </button>
          </div>
          <div className="flex-1 grid grid-cols-1 gap-1">
            {topWorkflows.map((w, idx) => {
              const exc = Math.round(w.runs * 0.05);
              const failures = Math.min(10, Math.ceil((exc / Math.max(1, w.runs)) * 10));
              return (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + idx * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="group w-full flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-brand-50/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedWorkflow(w.id)}
                    aria-label={`Open ${w.name}`}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 rounded"
                  >
                    <span className="flex-1 min-w-0 text-sm font-medium text-ink-900 truncate">{w.name}</span>
                    {/* Last-10 runs health strip — left=oldest, right=most recent.
                        Failure dots cluster at the start; passes dominate the right.
                        Compliant green / risk red are the legitimate semantic pair. */}
                    <span className="hidden md:inline-flex items-center gap-[2px] shrink-0" aria-label={`Last 10 runs · ${10 - failures} pass · ${failures} fail`}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <span
                          key={i}
                          className={`w-[5px] h-[5px] rounded-full ${i < failures ? 'bg-risk/70' : 'bg-compliant/70'}`}
                          style={{ opacity: 0.5 + (i / 9) * 0.5 }}
                        />
                      ))}
                    </span>
                    <span className="text-xs tabular-nums text-ink-500 shrink-0">
                      <span className="font-semibold text-ink-900">{w.runs}</span> runs
                      {failures > 0 && (
                        <> <span className="text-ink-300">·</span> <span className="font-semibold text-risk-700">{failures} fail</span></>
                      )}
                    </span>
                  </button>
                  <PinButton active={isPinned('workflow', w.id)} onToggle={() => togglePin('workflow', w.id)} label={w.name} />
                </motion.div>
              );
            })}
          </div>
        </motion.div>}
      </motion.div>
    </div>
  );
}

// ─── Platform Activity ──────────────────────────────────────────────────────
// Surfaces the same notification feed the drawer uses, inline on the homepage.
// State (read flags, action state) is owned by App via useAppState — no
// duplication. View all opens the drawer for triage.

type ActivityFilter = 'all' | 'action' | NotificationCategory;

const ACTIVITY_FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'action',     label: 'Action' },
  { id: 'exception',  label: 'Exceptions' },
  { id: 'workflow',   label: 'Workflows' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'report',     label: 'Reports' },
];

const HOMEPAGE_FEED_LIMIT = 6;
const BUCKET_ORDER: DayBucket[] = ['Today', 'Yesterday', 'Earlier'];

function PlatformActivitySection({
  notifications, onSelect, onOpenDrawer, rangeDays,
}: {
  notifications: PlatformNotification[];
  onSelect: (n: PlatformNotification) => void;
  onOpenDrawer: () => void;
  rangeDays: number | null;
}) {
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const filtered = useMemo(() => {
    let list = notifications;
    if (rangeDays != null) {
      const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
      list = list.filter(n => new Date(n.createdAt).getTime() >= cutoff);
    }
    if (filter === 'action') {
      list = list.filter(n => n.requiresAction && !n.actionState);
    } else if (filter !== 'all') {
      list = list.filter(n => n.category === filter);
    }
    return [...list]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, HOMEPAGE_FEED_LIMIT);
  }, [notifications, filter, rangeDays]);

  const grouped = useMemo(() => {
    const buckets: Record<DayBucket, PlatformNotification[]> = {
      Today: [], Yesterday: [], Earlier: [],
    };
    for (const n of filtered) buckets[dayBucket(n.createdAt)].push(n);
    return BUCKET_ORDER
      .map(label => ({ label, items: buckets[label] }))
      .filter(g => g.items.length > 0);
  }, [filtered]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const actionCount = notifications.filter(n => n.requiresAction && !n.actionState).length;

  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bell size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">Platform activity</h3>
          {unreadCount > 0 && (
            <span className="inline-flex items-center text-xs font-semibold tabular-nums text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded-full shrink-0">
              {unreadCount}
            </span>
          )}
          {actionCount > 0 && (
            <span className="inline-flex items-center text-xs font-semibold tabular-nums text-risk-700 bg-risk-50 px-1.5 py-0.5 rounded-full shrink-0">
              {actionCount} action
            </span>
          )}
        </div>
        <button
          onClick={onOpenDrawer}
          className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0"
        >
          View all →
        </button>
      </div>

      <div className="flex items-center gap-1.5 px-5 py-2 border-b border-canvas-border/60 overflow-x-auto shrink-0">
        {ACTIVITY_FILTERS.map(f => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`relative shrink-0 inline-flex items-center h-6 px-2.5 rounded-full text-[11.5px] font-medium border transition-colors cursor-pointer ${
                active
                  ? 'border-transparent text-brand-700'
                  : 'bg-canvas-elevated text-ink-600 border-canvas-border hover:border-brand-200 hover:text-brand-700'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="activity-filter-pill"
                  className="absolute inset-0 rounded-full bg-brand-50 border border-brand-200"
                  transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                />
              )}
              <span className="relative">{f.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Bell size={22} className="text-ink-400 mb-2" />
            <p className="text-meta text-ink-700 font-medium">You&rsquo;re caught up.</p>
            <p className="text-xs text-ink-500 mt-0.5">New events from across the platform will land here.</p>
          </div>
        ) : (
          grouped.map(group => (
            <section key={group.label}>
              <div className="bg-paper-50/40 px-6 py-1.5 border-b border-canvas-border flex items-center justify-between">
                <span className="text-xs font-semibold tracking-tight text-ink-500 uppercase">{group.label}</span>
                <span className="text-xs text-ink-400 tabular-nums">
                  {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
                </span>
              </div>
              {group.items.map(n => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onClick={onSelect}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Recent Shared ──────────────────────────────────────────────────────────
// Dashboards / reports that teammates have shared with the user. Mock data
// curated from the same names that appear in the notification seed feed so
// the experience feels coherent.

interface SharedItem {
  id: string;
  kind: 'dashboard' | 'report';
  name: string;
  description: string;
  sharedBy: string;
  timeAgo: string;
  target: View;
}

const RECENT_SHARED: SharedItem[] = [
  {
    id: 'shared-1',
    kind: 'dashboard',
    name: 'Vendor Risk Assessment',
    description: 'Evaluation of vendor risk profiles across active engagements.',
    sharedBy: 'Sneha Desai',
    timeAgo: '1d ago',
    target: 'dashboards',
  },
  {
    id: 'rpt-sox-q1',
    kind: 'report',
    name: 'Q1 SOX Compliance Summary',
    description: 'SOX testing roll-up: control coverage, exceptions, MW count.',
    sharedBy: 'Michael Chen',
    timeAgo: '45m ago',
    target: 'reports',
  },
  {
    id: 'rpt-vendor-q',
    kind: 'report',
    name: 'Vendor Risk Quarterly',
    description: 'Quarterly vendor risk review with remediation status.',
    sharedBy: 'Karan Mehta',
    timeAgo: '6h ago',
    target: 'reports',
  },
  {
    id: 'dash-controls-fy26',
    kind: 'dashboard',
    name: 'FY26 Controls Heatmap',
    description: 'Live coverage heatmap across SOX, ITGC, and IFC frameworks.',
    sharedBy: 'Tushar Goel',
    timeAgo: '2h ago',
    target: 'dashboards',
  },
];

function parseTimeAgoToDays(s: string): number {
  // Matches "45m ago", "6h ago", "1d ago", "2 days ago", "about 7 hours ago", "15 days ago".
  const m = s.toLowerCase().match(/(\d+)\s*(minute|min|m|hour|h|day|d)/);
  if (!m) return 999;
  const v = parseInt(m[1], 10);
  const u = m[2];
  if (u.startsWith('m')) return v / (60 * 24);
  if (u.startsWith('h')) return v / 24;
  return v;
}

function isWithinDays(dateStr: string | null | undefined, rangeDays: number | null): boolean {
  if (rangeDays == null) return true;
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false;
  const diff = HOME_TODAY.getTime() - t;
  return diff >= 0 && diff <= rangeDays * 24 * 60 * 60 * 1000;
}

function RecentSharedSection({ setView, rangeDays }: { setView: Props['setView']; rangeDays: number | null }) {
  // 4 cards in a 2×2 grid — fills the tile cleanly without empty space.
  // Each card stays wide enough for the badge + timestamp to render in full.
  const items = useMemo(() => {
    const base = rangeDays == null ? RECENT_SHARED : RECENT_SHARED.filter(it => parseTimeAgoToDays(it.timeAgo) <= rangeDays);
    return base.slice(0, 4);
  }, [rangeDays]);

  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Share2 size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">Shared with you</h3>
        </div>
        <button
          onClick={() => setView('dashboards')}
          className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0"
        >
          View all →
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 grid grid-cols-2 gap-3 auto-rows-min">
        {items.length === 0 ? (
          <div className="col-span-2 rounded-2xl border border-dashed border-canvas-border bg-canvas-elevated/50 p-6 text-center">
            <p className="text-meta text-ink-700 font-medium">Nothing shared in this window.</p>
            <p className="text-xs text-ink-500 mt-0.5">Try widening the date range.</p>
          </div>
        ) : items.map(item => {
          const Icon = item.kind === 'dashboard' ? LayoutGrid : FileText;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.target)}
              className="text-left rounded-lg border border-canvas-border/70 bg-canvas p-3 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer flex flex-col gap-2 min-h-[120px]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 shrink min-w-0">
                  <Icon size={10} className="shrink-0" />
                  <span className="truncate">{item.kind}</span>
                </div>
                <span className="text-xs text-ink-400 tabular-nums whitespace-nowrap shrink-0">{item.timeAgo}</span>
              </div>
              <div>
                <div className="font-display text-[15px] leading-snug text-ink-900 line-clamp-1">{item.name}</div>
                <div className="text-xs text-ink-500 line-clamp-2 mt-1">{item.description}</div>
              </div>
              <div className="text-[11.5px] text-ink-400 mt-auto">Shared by {item.sharedBy}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Recent Ask IRA queries ─────────────────────────────────────────────────
// Sourced from queryHistory.QUERY_SESSIONS (TODAY + YESTERDAY groups). Click
// a row to seed it into the chat view as the next prompt.

interface RecentQuery {
  query: string;
  group: string;
}

function groupMaxAgeDays(label: string): number {
  const u = label.toUpperCase();
  if (u.includes('TODAY')) return 1;
  if (u.includes('YESTERDAY')) return 2;
  if (u.includes('LAST 7') || u.includes('THIS WEEK')) return 7;
  if (u.includes('LAST 30') || u.includes('THIS MONTH')) return 30;
  if (u.includes('LAST 90')) return 90;
  return 999;
}

function buildRecentQueries(rangeDays: number | null): RecentQuery[] {
  const flat: RecentQuery[] = [];
  for (const g of QUERY_SESSIONS) {
    if (rangeDays != null && groupMaxAgeDays(g.group) > rangeDays) continue;
    for (const q of g.items) flat.push({ query: q, group: g.group });
    if (flat.length >= 5) break;
  }
  return flat.slice(0, 5);
}

function RecentAskIraSection({
  setView, setChatInitialQuery, rangeDays,
}: {
  setView: Props['setView'];
  setChatInitialQuery: Props['setChatInitialQuery'];
  rangeDays: number | null;
}) {
  const items = useMemo(() => buildRecentQueries(rangeDays), [rangeDays]);
  const open = (q: string) => {
    setChatInitialQuery(q);
    setView('chat');
  };
  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">Pick up where you left off</h3>
        </div>
        <button
          onClick={() => setView('recents')}
          className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0"
        >
          View all →
        </button>
      </div>
      <div className="flex-1 overflow-auto divide-y divide-canvas-border/60">
        {items.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-meta text-ink-700 font-medium">No queries in this window.</p>
            <p className="text-xs text-ink-500 mt-0.5">Try widening the date range.</p>
          </div>
        )}
        {items.map((it, i) => (
          <button
            key={`${it.group}-${i}`}
            onClick={() => open(it.query)}
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40 cursor-pointer text-left transition-colors group"
          >
            <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0 group-hover:bg-brand-100">
              <MessageSquare size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-meta text-ink-900 truncate">{it.query}</div>
              <div className="text-xs text-ink-400 mt-0.5 tracking-wide">{it.group}</div>
            </div>
            <ArrowRight size={13} className="text-ink-400 group-hover:text-brand-700 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Active engagements ─────────────────────────────────────────────────────

function ActiveEngagementsSection({ setView, rangeDays, openAuditExecution }: { setView: Props['setView']; rangeDays: number | null; openAuditExecution: Props['openAuditExecution'] }) {
  const items = useMemo(() => ENGAGEMENTS.filter(e => e.status === 'active'), []);
  const scale = scaleForRange(rangeDays);
  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Briefcase size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate"><span className="tabular-nums"><CountUp value={items.length} /></span> active engagements</h3>
        </div>
        <button onClick={() => setView('audit-execution')} className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0">View all →</button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-meta tabular-nums">
          <thead>
            <tr className="border-b border-canvas-border bg-paper-50/40">
              <th className="text-left font-semibold text-ink-500 px-4 h-10">Engagement</th>
              <th className="text-left font-semibold text-ink-500 px-2 h-10 w-[200px]">Progress</th>
              <th className="text-left font-semibold text-ink-500 px-2 h-10 w-[110px]">Deficiencies</th>
              <th className="text-left font-semibold text-ink-500 px-2 h-10 w-[120px]">Owner</th>
              <th className="text-right font-semibold text-ink-500 px-4 h-10 w-[100px]">Ends</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e, idx) => {
              const testedScaled = Math.round(e.tested * scale);
              const defScaled = Math.round(e.deficiencies * scale);
              const pct = e.controls > 0 ? Math.round((testedScaled / e.controls) * 100) : 0;
              return (
                <tr key={e.id} className={`h-12 ${idx > 0 ? 'border-t border-canvas-border' : ''} hover:bg-brand-50/40 transition-colors cursor-pointer`} onClick={() => openAuditExecution(e.id)}>
                  <td className="px-4">
                    <div className="text-ink-900">{e.name}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{e.type} · {e.bps.length} processes</div>
                  </td>
                  <td className="px-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-canvas-border overflow-hidden">
                        <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-ink-700 tabular-nums shrink-0">{testedScaled}/{e.controls}</span>
                    </div>
                  </td>
                  <td className="px-2 text-ink-700"><span className="tabular-nums">{defScaled}</span></td>
                  <td className="px-2 text-ink-700">{e.owner}</td>
                  <td className="px-4 text-right text-ink-500">{e.end}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={5} className="text-center text-ink-500 py-8">No active engagements.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Open exceptions ────────────────────────────────────────────────────────

const SEV_TONE: Record<string, string> = {
  High:   'bg-risk-50 text-risk-700 border-risk-200',
  Medium: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200',
  Low:    'bg-brand-50 text-brand-700 border-brand-200',
};

function OpenExceptionsSection({ setView, rangeDays }: { setView: Props['setView']; rangeDays: number | null }) {
  const items = useMemo(() => {
    const open = GRC_EXCEPTIONS.filter(e => e.status !== 'Closed');
    const filtered = rangeDays == null ? open : open.filter(e => parseTimeAgoToDays(e.lastUpdated) <= rangeDays);
    return filtered.slice(0, 6);
  }, [rangeDays]);
  const totalOpen = useMemo(() => GRC_EXCEPTIONS.filter(e => e.status !== 'Closed').length, []);
  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <AlertOctagon size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate"><span className="tabular-nums"><CountUp value={totalOpen} /></span> open exceptions</h3>
        </div>
        <button onClick={() => setView('manage-exceptions')} className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0">View all →</button>
      </div>
      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <AlertOctagon size={22} className="text-ink-400 mb-2" />
            <p className="text-meta text-ink-700 font-medium">No open exceptions in this window.</p>
            <p className="text-xs text-ink-500 mt-0.5">Try widening the date range.</p>
          </div>
        ) : (
          <table className="w-full text-meta">
            <thead>
              <tr className="border-b border-canvas-border bg-paper-50/40">
                <th className="text-left font-semibold text-ink-500 px-4 h-10 w-[100px]">Severity</th>
                <th className="text-left font-semibold text-ink-500 px-2 h-10">Title</th>
                <th className="text-left font-semibold text-ink-500 px-2 h-10 w-[140px]">Assigned</th>
                <th className="text-right font-semibold text-ink-500 px-4 h-10 w-[120px]">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e, idx) => (
                <tr key={e.id} className={`h-12 ${idx > 0 ? 'border-t border-canvas-border' : ''} hover:bg-brand-50/40 transition-colors cursor-pointer`} onClick={() => setView('manage-exceptions')}>
                  <td className="px-4">
                    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md border ${SEV_TONE[e.severity] ?? 'bg-canvas-border/40 text-ink-700 border-canvas-border'}`}>{e.severity}</span>
                  </td>
                  <td className="px-2">
                    <div className="text-ink-900 line-clamp-1">{e.title}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{e.riskCategory} · {e.status}</div>
                  </td>
                  <td className="px-2 text-ink-700">{e.assignedTo?.name ?? <span className="text-ink-500 italic">Unassigned</span>}</td>
                  <td className="px-4 text-right text-ink-500">{e.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Top workflows ──────────────────────────────────────────────────────────

// Workflow Activity — recent run timeline. Distinct from Health snapshot's
// workflow tiles (KPIs / type breakdown / top workflows). This widget answers
// "what just ran, how long did it take, what did it produce?" with per-run
// status, duration, exception output, and inline error preview.

type WorkflowRunStatus = 'success' | 'error' | 'in-progress';
interface WorkflowRun {
  id: string;
  workflowId: string;
  name: string;
  type: string;
  ranAt: string;
  ranAtDays: number;
  duration: string;
  status: WorkflowRunStatus;
  exceptions: number;
  errorMessage?: string; // shown inline for failed runs
}

const WORKFLOW_RUNS: WorkflowRun[] = [
  { id: 'r1', workflowId: 'wf-001', name: 'Duplicate Invoice Detector',     type: 'Detection',      ranAt: '2h ago',   ranAtDays: 0.08, duration: '3m 22s',  status: 'success',     exceptions: 3 },
  { id: 'r2', workflowId: 'wf-005', name: 'Journal Entry Anomaly Detector', type: 'Detection',      ranAt: '4h ago',   ranAtDays: 0.17, duration: '8m 45s',  status: 'success',     exceptions: 1 },
  { id: 'r3', workflowId: 'wf-007', name: 'Three-Way PO Match',             type: 'Reconciliation', ranAt: '6h ago',   ranAtDays: 0.25, duration: '12m 03s', status: 'error',       exceptions: 0, errorMessage: 'Match validation failed at step 4: missing GRN reference' },
  { id: 'r4', workflowId: 'wf-008', name: 'SOD Violation Detector',         type: 'Compliance',     ranAt: '1d ago',   ranAtDays: 1,    duration: '2m 15s',  status: 'success',     exceptions: 2 },
  { id: 'r5', workflowId: 'wf-002', name: 'Vendor Master Change Monitor',   type: 'Monitoring',     ranAt: '1d ago',   ranAtDays: 1,    duration: '1m 48s',  status: 'success',     exceptions: 0 },
  { id: 'r6', workflowId: 'wf-003', name: 'High-Value Payment Flagging',    type: 'Detection',      ranAt: '2d ago',   ranAtDays: 2,    duration: '5m 33s',  status: 'in-progress', exceptions: 0 },
  { id: 'r7', workflowId: 'wf-004', name: 'Revenue Recognition Checker',    type: 'Compliance',     ranAt: '3d ago',   ranAtDays: 3,    duration: '4m 12s',  status: 'success',     exceptions: 0 },
  { id: 'r8', workflowId: 'wf-006', name: 'Contract Expiry Alert',          type: 'Monitoring',     ranAt: '5d ago',   ranAtDays: 5,    duration: '1m 02s',  status: 'success',     exceptions: 0 },
];

type RunFilter = 'all' | 'failed' | 'today' | '7d';
const RUN_FILTERS: { id: RunFilter; label: string }[] = [
  { id: 'all',    label: 'All'    },
  { id: 'today',  label: 'Today'  },
  { id: '7d',     label: '7 days' },
  { id: 'failed', label: 'Failed' },
];

const STATUS_TONE: Record<WorkflowRunStatus, { dot: string; edge: string; label: string; tone: string; bgTint: string }> = {
  success:       { dot: 'bg-compliant',  edge: 'var(--color-compliant)',  label: 'Success',     tone: 'text-compliant-700', bgTint: 'var(--color-compliant-50)' },
  error:         { dot: 'bg-risk',       edge: 'var(--color-risk)',       label: 'Failed',      tone: 'text-risk-700',      bgTint: 'var(--color-risk-50)'      },
  'in-progress': { dot: 'bg-mitigated',  edge: 'var(--color-mitigated)',  label: 'In progress', tone: 'text-mitigated-700', bgTint: 'var(--color-mitigated-50)' },
};

const TYPE_TONE: Record<string, { bg: string; text: string }> = {
  Detection:      { bg: 'bg-brand-50',     text: 'text-brand-700'     },
  Monitoring:     { bg: 'bg-evidence-50',  text: 'text-evidence-700'  },
  Compliance:     { bg: 'bg-compliant-50', text: 'text-compliant-700' },
  Reconciliation: { bg: 'bg-mitigated-50', text: 'text-mitigated-700' },
};

function bucketRun(days: number): 'Today' | 'Yesterday' | 'Earlier' {
  if (days < 1) return 'Today';
  if (days < 2) return 'Yesterday';
  return 'Earlier';
}

function TopWorkflowsSection({ setView, rangeDays, setSelectedWorkflow }: { setView: Props['setView']; rangeDays: number | null; setSelectedWorkflow: Props['setSelectedWorkflow'] }) {
  const [filter, setFilter] = useState<RunFilter>('all');

  const filteredRuns = useMemo(() => {
    let runs: WorkflowRun[] = WORKFLOW_RUNS;
    if (rangeDays != null) runs = runs.filter(r => r.ranAtDays <= rangeDays);
    if (filter === 'failed') runs = runs.filter(r => r.status === 'error');
    else if (filter === 'today') runs = runs.filter(r => r.ranAtDays < 1);
    else if (filter === '7d')    runs = runs.filter(r => r.ranAtDays <= 7);
    return runs;
  }, [filter, rangeDays]);

  // Group by Today / Yesterday / Earlier — same pattern as Platform Activity feed
  const grouped = useMemo(() => {
    const buckets: Record<'Today' | 'Yesterday' | 'Earlier', WorkflowRun[]> = {
      Today: [], Yesterday: [], Earlier: [],
    };
    for (const r of filteredRuns) buckets[bucketRun(r.ranAtDays)].push(r);
    return (['Today', 'Yesterday', 'Earlier'] as const)
      .map(label => ({ label, items: buckets[label] }))
      .filter(g => g.items.length > 0);
  }, [filteredRuns]);

  // Header KPIs computed from the unfiltered set so user always sees baseline
  const totalRuns = WORKFLOW_RUNS.length;
  const failedCount = WORKFLOW_RUNS.filter(r => r.status === 'error').length;
  const liveCount = WORKFLOW_RUNS.filter(r => r.status === 'in-progress').length;

  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Activity size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">Workflow activity</h3>
          <span className="hidden sm:inline-flex items-center text-xs font-mono tabular-nums text-ink-500 ml-1">
            <span className="text-ink-700 font-bold mr-0.5">{totalRuns}</span> runs
            {failedCount > 0 && (
              <>
                <span className="mx-1 text-ink-300">·</span>
                <span className="text-risk-700 font-bold mr-0.5">{failedCount}</span> failed
              </>
            )}
            {liveCount > 0 && (
              <>
                <span className="mx-1 text-ink-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <PulseDot tone="bg-compliant" />
                  <span className="text-compliant-700 font-bold">{liveCount}</span> live
                </span>
              </>
            )}
          </span>
        </div>
        <button onClick={() => setView('workflow-library')} className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0">View library →</button>
      </div>

      {/* Filter chips with sliding pill */}
      <div className="flex items-center gap-1.5 px-5 py-2 border-b border-canvas-border/60 overflow-x-auto shrink-0">
        {RUN_FILTERS.map(f => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`relative shrink-0 inline-flex items-center h-6 px-2.5 rounded-full text-[11.5px] font-medium border transition-colors cursor-pointer ${
                active ? 'border-transparent text-brand-700' : 'bg-canvas-elevated text-ink-600 border-canvas-border hover:border-brand-200 hover:text-brand-700'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="workflow-runs-filter-pill"
                  className="absolute inset-0 rounded-full bg-brand-50 border border-brand-200"
                  transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                />
              )}
              <span className="relative">{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Run timeline grouped by date */}
      <div className="flex-1 overflow-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Activity size={22} className="text-ink-400 mb-2" />
            <p className="text-meta text-ink-700 font-medium">No runs match this filter.</p>
            <p className="text-xs text-ink-500 mt-0.5">Try widening the date range or removing filters.</p>
          </div>
        ) : grouped.map(group => (
          <section key={group.label}>
            <div className="bg-paper-50/40 px-5 py-1.5 border-b border-canvas-border/60 flex items-center justify-between sticky top-0 backdrop-blur-sm z-10">
              <span className="text-xs font-mono uppercase tracking-wider text-ink-500 font-semibold">{group.label}</span>
              <span className="text-xs font-mono tabular-nums text-ink-400">
                {group.items.length} {group.items.length === 1 ? 'run' : 'runs'}
              </span>
            </div>
            {group.items.map((run, idx) => {
              const statusMeta = STATUS_TONE[run.status];
              const typeMeta = TYPE_TONE[run.type] ?? { bg: 'bg-canvas-border/40', text: 'text-ink-700' };
              const isLive = run.status === 'in-progress';
              const isError = run.status === 'error';
              return (
                <motion.button
                  key={run.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * idx, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setSelectedWorkflow(run.workflowId)}
                  className="w-full relative flex items-start gap-3 px-5 py-3 border-b border-canvas-border/40 last:border-b-0 hover:bg-brand-50/40 transition-colors cursor-pointer text-left group"
                >
                  {/* Colored left edge — status indicator stripe */}
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full"
                    style={{ backgroundColor: statusMeta.edge }}
                  />

                  {/* Status icon */}
                  <span className="shrink-0 mt-0.5">
                    {isLive ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mitigated-50">
                        <PulseDot tone="bg-mitigated" />
                      </span>
                    ) : isError ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-risk-50">
                        <X size={11} className="text-risk-700" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-compliant-50">
                        <Check size={11} className="text-compliant-700" strokeWidth={3} />
                      </span>
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-meta font-medium text-ink-900 truncate">{run.name}</span>
                      <span className={`shrink-0 inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${typeMeta.bg} ${typeMeta.text}`}>{run.type}</span>
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5 tabular-nums flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-ink-700">{run.duration}</span>
                      <span className="text-ink-300">·</span>
                      <span className={`font-medium ${statusMeta.tone}`}>{statusMeta.label}</span>
                      {run.exceptions > 0 && (
                        <>
                          <span className="text-ink-300">·</span>
                          <span className="inline-flex items-center gap-0.5 text-risk-700 font-medium">
                            <AlertTriangle size={9} />
                            {run.exceptions} {run.exceptions === 1 ? 'exception' : 'exceptions'}
                          </span>
                        </>
                      )}
                    </div>
                    {/* Inline error preview for failed runs */}
                    {run.errorMessage && (
                      <div className="mt-1.5 text-xs text-risk-700/90 bg-risk-50/60 border border-risk-200/40 rounded px-2 py-1 font-mono italic">
                        “{run.errorMessage}”
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-0.5 self-start mt-0.5">
                    <span className="text-xs text-ink-400 tabular-nums">{run.ranAt}</span>
                    <ArrowRight size={11} className="text-ink-300 group-hover:text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

// ─── Connected data sources ─────────────────────────────────────────────────

const SOURCE_TYPE_TONE: Record<string, string> = {
  sql: 'bg-brand-50 text-brand-700',
  pdf: 'bg-risk-50 text-risk-700',
  csv: 'bg-compliant-50 text-compliant-700',
};

function ConnectedSourcesSection({ setView, rangeDays }: { setView: Props['setView']; rangeDays: number | null }) {
  const connected = DATA_SOURCES.filter(d => d.status === 'connected').length;
  const scale = scaleForRange(rangeDays);
  const syncsInRange = Math.max(1, Math.round(connected * scale));
  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Database size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate"><span className="tabular-nums"><CountUp value={connected} /></span> of <CountUp value={DATA_SOURCES.length} /> connected</h3>
          <span className="hidden sm:inline-flex items-center text-xs font-mono tabular-nums text-ink-500 ml-1">
            <span className="mx-1 text-ink-300">·</span>
            <span className="text-ink-700 font-bold mr-0.5">{syncsInRange}</span>
            synced{rangeDays === null ? ' YTD' : ` · ${rangeDays}d`}
          </span>
        </div>
        <button onClick={() => setView('data-sources')} className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0">Manage →</button>
      </div>
      <div className="flex-1 overflow-auto p-4 grid grid-cols-2 gap-3 auto-rows-min">
        {DATA_SOURCES.map(s => {
          const ok = s.status === 'connected';
          return (
            <button key={s.id} onClick={() => setView('data-sources')} className="text-left rounded-lg border border-canvas-border/70 bg-canvas p-3 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-canvas-border/40 text-ink-700 flex items-center justify-center shrink-0">
                <Database size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-meta font-medium text-ink-900 truncate">{s.name}</span>
                  <span className={`shrink-0 inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${SOURCE_TYPE_TONE[s.type] ?? 'bg-canvas-border/40 text-ink-700'}`}>{s.type}</span>
                </div>
                <div className="text-[11.5px] text-ink-500 mt-0.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${ok ? 'bg-compliant' : 'bg-risk'}`} />
                  {ok ? `Synced ${s.lastSync}` : 'Disconnected'} · <span className="tabular-nums">{s.records}</span> records
                </div>
              </div>
              <ArrowRight size={13} className="text-ink-400 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Business process coverage ──────────────────────────────────────────────

function BusinessProcessesSection({ setView, rangeDays, setSelectedBP }: { setView: Props['setView']; rangeDays: number | null; setSelectedBP: Props['setSelectedBP'] }) {
  const scale = scaleForRange(rangeDays);
  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Layers size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">Business processes</h3>
        </div>
        <button onClick={() => setView('business-processes')} className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0">View all →</button>
      </div>
      <div className="flex-1 overflow-auto p-4 grid grid-cols-2 gap-3 auto-rows-min">
        {BUSINESS_PROCESSES.map(bp => (
          <button
            key={bp.id}
            onClick={() => setSelectedBP(bp.id)}
            className="text-left rounded-lg border border-canvas-border/70 bg-canvas p-3 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer"
            aria-label={`Open ${bp.name}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${bp.color}1A`, color: bp.color }}
              >
                {bp.abbr}
              </span>
              <span className="text-xs tabular-nums font-semibold" style={{ color: bp.color }}>{bp.coverage}%</span>
            </div>
            <div className="text-[12.5px] font-medium text-ink-900 truncate">{bp.name}</div>
            <div className="mt-1.5 h-1 rounded-full bg-canvas-border/40 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${bp.coverage}%` }}
                transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{ backgroundColor: bp.color }}
              />
            </div>
            <div className="text-xs text-ink-500 mt-1.5 tabular-nums">
              {Math.round(bp.risks * scale)} risks · {Math.round(bp.controls * scale)} controls
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Recent reports ─────────────────────────────────────────────────────────

const REPORT_STATUS_TONE: Record<string, string> = {
  final: 'bg-compliant-50 text-compliant-700',
  draft: 'bg-mitigated-50 text-mitigated-700',
};

function RecentReportsSection({
  setView, rangeDays, isPinned, togglePin,
}: {
  setView: Props['setView'];
  rangeDays: number | null;
  isPinned: (kind: PinKind, id: string) => boolean;
  togglePin: (kind: PinKind, id: string) => void;
}) {
  const items = useMemo(() => {
    if (rangeDays == null) return GENERATED_REPORTS;
    return GENERATED_REPORTS.filter(r => isWithinDays(r.generatedAt, rangeDays));
  }, [rangeDays]);
  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">
            <span className="tabular-nums"><CountUp value={items.length} /></span> recent reports
          </h3>
        </div>
        <button onClick={() => setView('reports')} className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0">View all →</button>
      </div>
      <div className="flex-1 overflow-auto divide-y divide-canvas-border/60">
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-meta text-ink-700 font-medium">No reports generated in this window.</p>
            <p className="text-xs text-ink-500 mt-0.5">Try widening the date range.</p>
          </div>
        ) : items.map(r => (
          <div
            key={r.id}
            className="group w-full flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40 transition-colors"
          >
            <button
              type="button"
              onClick={() => setView('reports')}
              className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0 group-hover:bg-brand-100">
                <FileText size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-meta text-ink-900 truncate">{r.name}</span>
                  <span className={`shrink-0 inline-flex items-center text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${REPORT_STATUS_TONE[r.status] ?? 'bg-canvas-border/40 text-ink-700'}`}>{r.status}</span>
                </div>
                <div className="text-xs text-ink-500 mt-0.5 tabular-nums">
                  {r.generatedBy} · {r.generatedAt} · {r.pages}p
                </div>
              </div>
            </button>
            <PinButton active={isPinned('report', r.id)} onToggle={() => togglePin('report', r.id)} label={r.name} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Concierge quick-launch ──────────────────────────────────────────────
// Distinct from Recent Ask IRA — Concierge is the specialized-tool surface
// (forensics, table extraction, workflow building).

type ConciergeTool =
  | { view: View; label: string; description: string; icon: React.ElementType; tone: string }
  | { launchWorkflow: true; label: string; description: string; icon: React.ElementType; tone: string };

const CONCIERGE_TOOLS: ConciergeTool[] = [
  { view: 'ai-concierge-forensics',        label: 'Document Forensics', description: 'Investigate exceptions and trace anomalies',  icon: Search,           tone: 'bg-risk-50 text-risk-700' },
  { view: 'ai-concierge-table-extractor',  label: 'Table Extractor',    description: 'Pull structured data from PDFs and scans',    icon: TableProperties,  tone: 'bg-brand-50 text-brand-700' },
  { launchWorkflow: true,                  label: 'Workflow Builder',   description: 'Compose new automations from a description',  icon: Wand2,            tone: 'bg-compliant-50 text-compliant-700' },
];

function ConciergeSection({ setView, rangeDays, onLaunchWorkflowBuilder }: { setView: Props['setView']; rangeDays: number | null; onLaunchWorkflowBuilder?: Props['onLaunchWorkflowBuilder'] }) {
  const scale = scaleForRange(rangeDays);
  // Mock baseline: ~84 tool invocations YTD across the 3 tools.
  const usedInRange = Math.max(0, Math.round(84 * scale));
  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">AI Concierge</h3>
          <span className="hidden sm:inline-flex items-center text-xs font-mono tabular-nums text-ink-500 ml-1">
            <span className="mx-1 text-ink-300">·</span>
            <span className="text-ink-700 font-bold mr-0.5">{usedInRange}</span>
            runs{rangeDays === null ? ' YTD' : ` · ${rangeDays}d`}
          </span>
        </div>
        <button onClick={() => setView('ai-concierge')} className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0">Open →</button>
      </div>
      <div className="flex-1 overflow-auto divide-y divide-canvas-border/60">
        {CONCIERGE_TOOLS.map(tool => {
          const Icon = tool.icon;
          const key = 'view' in tool ? tool.view : 'workflow-launcher';
          const handleClick = () => {
            if ('launchWorkflow' in tool) onLaunchWorkflowBuilder?.('');
            else setView(tool.view);
          };
          return (
            <button
              key={key}
              onClick={handleClick}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40 cursor-pointer text-left transition-colors group"
            >
              <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${tool.tone}`}>
                <Icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-meta font-medium text-ink-900 truncate">{tool.label}</div>
                <div className="text-[11.5px] text-ink-500 mt-0.5 line-clamp-1">{tool.description}</div>
              </div>
              <ArrowRight size={13} className="text-ink-400 group-hover:text-brand-700 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pinned items shared store ──────────────────────────────────────────────
// User-driven favorites that span multiple entity types (workflows, reports,
// engagements). Stored as a single flat object keyed by category so adding a
// new pinnable type is one new array, not one new key per surface.

type PinKind = 'workflow' | 'report' | 'engagement';
interface PinnedItems { workflow: string[]; report: string[]; engagement: string[] }
const PINNED_KEY = 'home.pinned.v1';
const EMPTY_PINS: PinnedItems = { workflow: [], report: [], engagement: [] };

function loadPinned(): PinnedItems {
  if (typeof window === 'undefined') return EMPTY_PINS;
  try {
    const raw = window.localStorage.getItem(PINNED_KEY);
    if (!raw) return EMPTY_PINS;
    const parsed = JSON.parse(raw);
    return {
      workflow:   Array.isArray(parsed?.workflow)   ? parsed.workflow.filter((s: unknown) => typeof s === 'string')   : [],
      report:     Array.isArray(parsed?.report)     ? parsed.report.filter((s: unknown) => typeof s === 'string')     : [],
      engagement: Array.isArray(parsed?.engagement) ? parsed.engagement.filter((s: unknown) => typeof s === 'string') : [],
    };
  } catch { return EMPTY_PINS; }
}

function usePinned(): {
  pinned: PinnedItems;
  isPinned: (kind: PinKind, id: string) => boolean;
  toggle: (kind: PinKind, id: string) => void;
} {
  const [pinned, setPinned] = useState<PinnedItems>(loadPinned);
  useEffect(() => {
    try { localStorage.setItem(PINNED_KEY, JSON.stringify(pinned)); } catch { /* ignore */ }
  }, [pinned]);
  const isPinned = (kind: PinKind, id: string) => pinned[kind].includes(id);
  const toggle = (kind: PinKind, id: string) => setPinned(prev => {
    const list = prev[kind];
    return { ...prev, [kind]: list.includes(id) ? list.filter(x => x !== id) : [id, ...list] };
  });
  return { pinned, isPinned, toggle };
}

function PinButton({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) {
  // Always visible at rest so the affordance matches the Pinned widget's
  // empty-state coaching ("click the star on any workflow or report to pin
  // it here"). Resting state uses a faded ink stroke so it doesn't compete
  // with row content; hover bumps to full opacity + amber tint; active is
  // a fully filled gold star.
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={active ? `Unpin ${label}` : `Pin ${label}`}
      aria-pressed={active}
      className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors cursor-pointer ${
        active
          ? 'text-mitigated-700 hover:bg-mitigated-50'
          : 'text-ink-300 hover:text-mitigated-700 hover:bg-mitigated-50 group-hover:text-ink-400'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mitigated-400`}
    >
      <Star size={13} fill={active ? 'currentColor' : 'none'} strokeWidth={2} />
    </button>
  );
}

// ─── Audit calendar widget ──────────────────────────────────────────────────
// Multi-event surface: rolls up engagement end dates and deficiency due dates
// into a single chronological timeline grouped by proximity (Next 7d / 30d /
// Later). Auditors live by deadlines — this is the "what's coming up" pane.

interface CalendarEvent {
  id: string;
  // Underlying entity id (engagement id or deficiency id) used to drill into
  // the specific row when the event is clicked. Engagement events use this
  // with `openAuditExecution`; deficiency events route to the findings list.
  entityId: string;
  date: Date;
  title: string;
  kind: 'engagement' | 'deficiency';
  context: string;
}

function buildCalendarEvents(): CalendarEvent[] {
  const today = new Date('2026-04-23');
  const events: CalendarEvent[] = [];
  for (const e of ENGAGEMENTS.filter(e => e.status === 'active')) {
    const d = new Date(e.end);
    if (d.getTime() >= today.getTime()) {
      events.push({ id: `e-${e.id}`, entityId: e.id, date: d, title: e.name, kind: 'engagement', context: `${e.type} · ${e.owner}` });
    }
  }
  for (const d of DEFICIENCIES.filter(d => d.status !== 'resolved')) {
    const dt = new Date(d.due);
    if (!isNaN(dt.getTime())) {
      events.push({ id: `d-${d.id}`, entityId: d.id, date: dt, title: d.finding.length > 56 ? d.finding.slice(0, 53) + '…' : d.finding, kind: 'deficiency', context: `${d.severity} · ${d.assignee}` });
    }
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function AuditCalendarSection({ setView, rangeDays, openAuditExecution }: { setView: Props['setView']; rangeDays: number | null; openAuditExecution: Props['openAuditExecution'] }) {
  const today = new Date('2026-04-23');
  const events = useMemo(() => {
    const all = buildCalendarEvents();
    if (rangeDays == null) return all;
    const cutoff = today.getTime() + rangeDays * 24 * 60 * 60 * 1000;
    return all.filter(e => e.date.getTime() <= cutoff);
  }, [rangeDays, today]);

  const grouped = useMemo(() => {
    const buckets: Record<'This week' | 'Next 30 days' | 'Later', CalendarEvent[]> = {
      'This week': [], 'Next 30 days': [], 'Later': [],
    };
    for (const e of events) {
      const days = Math.ceil((e.date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      if (days <= 7) buckets['This week'].push(e);
      else if (days <= 30) buckets['Next 30 days'].push(e);
      else buckets['Later'].push(e);
    }
    return (['This week', 'Next 30 days', 'Later'] as const)
      .map(label => ({ label, items: buckets[label] }))
      .filter(g => g.items.length > 0);
  }, [events, today]);

  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={14} className="text-ink-500 shrink-0" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">
            <span className="tabular-nums"><CountUp value={events.length} /></span> upcoming
          </h3>
        </div>
        <button onClick={() => setView('audit-planning')} className="text-xs font-medium text-ink-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0">View calendar →</button>
      </div>
      <div className="flex-1 overflow-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Calendar size={22} className="text-ink-400 mb-2" />
            <p className="text-meta text-ink-700 font-medium">Nothing scheduled in this window.</p>
            <p className="text-xs text-ink-500 mt-0.5">Try widening the date range.</p>
          </div>
        ) : grouped.map(group => (
          <section key={group.label}>
            <div className="bg-paper-50/40 px-5 py-1.5 border-b border-canvas-border/60 flex items-center justify-between sticky top-0 backdrop-blur-sm z-10">
              <span className="text-xs font-mono uppercase tracking-wider text-ink-500 font-semibold">{group.label}</span>
              <span className="text-xs font-mono tabular-nums text-ink-400">
                {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
              </span>
            </div>
            {group.items.map(ev => {
              const days = Math.ceil((ev.date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
              const isUrgent = days <= 7;
              const tone = ev.kind === 'engagement' ? 'bg-evidence-50 text-evidence-700' : 'bg-risk-50 text-risk-700';
              return (
                <button
                  key={ev.id}
                  onClick={() => {
                    if (ev.kind === 'engagement') openAuditExecution(ev.entityId);
                    else setView('findings');
                  }}
                  className="w-full flex items-start gap-3 px-5 py-3 border-b border-canvas-border/40 last:border-b-0 hover:bg-brand-50/40 transition-colors cursor-pointer text-left group"
                >
                  <div className="shrink-0 w-12 flex flex-col items-center pt-0.5">
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${isUrgent ? 'text-risk-700 font-bold' : 'text-ink-500'}`}>
                      {ev.date.toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className={`text-[18px] font-semibold leading-none tabular-nums ${isUrgent ? 'text-risk-700' : 'text-ink-900'}`}>
                      {ev.date.getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-meta font-medium text-ink-900 truncate">{ev.title}</span>
                      <span className={`shrink-0 inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${tone}`}>{ev.kind}</span>
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5 tabular-nums">
                      {ev.context} · <span className={isUrgent ? 'text-risk-700 font-semibold' : ''}>{days <= 0 ? 'today' : `in ${days} ${days === 1 ? 'day' : 'days'}`}</span>
                    </div>
                  </div>
                  <ArrowRight size={13} className="text-ink-300 group-hover:text-brand-700 shrink-0 self-center" />
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

// ─── Pinned widget ──────────────────────────────────────────────────────────
// User's manually starred items across workflows, reports, and engagements.
// Reads from the shared usePinned() store; rows let users unpin inline.

function PinnedSection({
  setView, setSelectedWorkflow, openAuditExecution, pinned, isPinned, toggle,
}: {
  setView: Props['setView'];
  setSelectedWorkflow: Props['setSelectedWorkflow'];
  openAuditExecution: Props['openAuditExecution'];
  pinned: PinnedItems;
  isPinned: (kind: PinKind, id: string) => boolean;
  toggle: (kind: PinKind, id: string) => void;
}) {
  const workflows = useMemo(() => WORKFLOWS.filter(w => pinned.workflow.includes(w.id)), [pinned.workflow]);
  const reports   = useMemo(() => GENERATED_REPORTS.filter(r => pinned.report.includes(r.id)),     [pinned.report]);
  const engagements = useMemo(() => ENGAGEMENTS.filter(e => pinned.engagement.includes(e.id)),     [pinned.engagement]);
  const total = workflows.length + reports.length + engagements.length;

  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated shadow-[0_1px_2px_rgb(15_15_20_/_0.04),_0_4px_12px_rgb(15_15_20_/_0.03)] overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-canvas-border/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Star size={14} className="text-mitigated-700 shrink-0" fill="currentColor" />
          <h3 className="text-[13.5px] font-semibold text-ink-900 truncate">
            Pinned <span className="text-ink-500 font-normal tabular-nums">· {total}</span>
          </h3>
        </div>
      </div>
      <div className="flex-1 overflow-auto divide-y divide-canvas-border/60">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Pin size={22} className="text-ink-400 mb-2" />
            <p className="text-meta text-ink-700 font-medium">Nothing pinned yet.</p>
            <p className="text-xs text-ink-500 mt-0.5">Click the star on any workflow or report to pin it here.</p>
          </div>
        ) : (
          <>
            {workflows.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWorkflow(w.id)}
                className="group w-full flex items-center gap-3 px-5 py-2.5 hover:bg-brand-50/40 transition-colors cursor-pointer text-left"
              >
                <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                  <WorkflowIcon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-meta font-medium text-ink-900 truncate">{w.name}</div>
                  <div className="text-xs text-ink-500 mt-0.5 truncate">Workflow · {w.type} · {w.runs} runs</div>
                </div>
                <PinButton active={isPinned('workflow', w.id)} onToggle={() => toggle('workflow', w.id)} label={w.name} />
              </button>
            ))}
            {reports.map(r => (
              <button
                key={r.id}
                onClick={() => setView('reports')}
                className="group w-full flex items-center gap-3 px-5 py-2.5 hover:bg-brand-50/40 transition-colors cursor-pointer text-left"
              >
                <div className="w-7 h-7 rounded-md bg-evidence-50 text-evidence-700 flex items-center justify-center shrink-0">
                  <FileText size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-meta font-medium text-ink-900 truncate">{r.name}</div>
                  <div className="text-xs text-ink-500 mt-0.5 truncate">Report · {r.status}</div>
                </div>
                <PinButton active={isPinned('report', r.id)} onToggle={() => toggle('report', r.id)} label={r.name} />
              </button>
            ))}
            {engagements.map(e => (
              <button
                key={e.id}
                onClick={() => openAuditExecution(e.id)}
                className="group w-full flex items-center gap-3 px-5 py-2.5 hover:bg-brand-50/40 transition-colors cursor-pointer text-left"
              >
                <div className="w-7 h-7 rounded-md bg-compliant-50 text-compliant-700 flex items-center justify-center shrink-0">
                  <Briefcase size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-meta font-medium text-ink-900 truncate">{e.name}</div>
                  <div className="text-xs text-ink-500 mt-0.5 truncate">Engagement · {e.type} · {e.owner}</div>
                </div>
                <PinButton active={isPinned('engagement', e.id)} onToggle={() => toggle('engagement', e.id)} label={e.name} />
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Personas ───────────────────────────────────────────────────────────────
// Three V1 personas covering 100% of platform-active audit roles. Each
// persona has a default visible-widget preset, a one-line description,
// and persona-scoped localStorage so customizations don't bleed between
// roles when the same user switches personas.

type Persona = 'auditor' | 'manager' | 'cfo';

const PERSONAS: { id: Persona; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'auditor', label: 'Internal Auditor', description: 'Daily fieldwork: your queue, engagements, and exceptions',     icon: ClipboardCheck },
  { id: 'manager', label: 'Audit Manager',    description: 'Team orchestration: engagement portfolio and review queue',    icon: Briefcase      },
  { id: 'cfo',     label: 'CFO',              description: 'Executive overview: financial controls, KPIs, board reports',  icon: BarChart3      },
];

const PERSONA_KEY = 'home.persona.v1';

// ─── Widget catalogue + persistence ─────────────────────────────────────────

type WidgetKey = 'activity' | 'queue' | 'health' | 'shared' | 'recents' | 'engagements' | 'exceptions' | 'workflows' | 'sources' | 'processes' | 'reports-list' | 'concierge' | 'calendar' | 'pinned';

// Per-persona default widget set. Order in the array is the preferred order
// for that persona (CompactLayout positions follow COMPACT_INITIAL_POS, but
// visibility comes from here).
// 12 widgets per persona, interleaved 8w+4w so the packer pairs them into
// clean rows (no orphan widgets). Order is priority — earlier = more prominent
// (top of page). Each row pair = one 8w "primary" + one 4w "secondary".
const PERSONA_WIDGETS: Record<Persona, WidgetKey[]> = {
  // Auditor — fieldwork. Calendar + pinned high in the order so deadlines and
  // bookmarked items are visible without scrolling.
  auditor: ['queue', 'activity', 'calendar', 'pinned', 'exceptions', 'concierge', 'workflows', 'recents', 'engagements', 'sources', 'processes', 'shared', 'health', 'reports-list'],
  // Manager — orchestration. Calendar surfaces team-wide deadlines.
  manager: ['engagements', 'calendar', 'activity', 'pinned', 'queue', 'recents', 'workflows', 'concierge', 'exceptions', 'sources', 'processes', 'shared', 'health', 'reports-list'],
  // CFO/Executive — strategic. Health hero, then calendar for upcoming
  // executive-visible audits.
  cfo:     ['health', 'calendar', 'processes', 'activity', 'pinned', 'engagements', 'recents', 'workflows', 'shared', 'exceptions', 'sources', 'queue', 'concierge', 'reports-list'],
};

function loadPersona(): Persona {
  if (typeof window === 'undefined') return 'auditor';
  const saved = window.localStorage.getItem(PERSONA_KEY);
  if (saved === 'auditor' || saved === 'manager' || saved === 'cfo') return saved;
  return 'auditor';
}

interface WidgetState {
  key: WidgetKey;
  visible: boolean;
}

const DEFAULT_WIDGETS: WidgetState[] = [
  { key: 'activity',     visible: true },
  { key: 'queue',        visible: true },
  { key: 'health',       visible: true },
  { key: 'engagements',  visible: true },
  { key: 'exceptions',   visible: true },
  { key: 'workflows',    visible: true },
  { key: 'sources',      visible: true },
  { key: 'shared',       visible: true },
  { key: 'recents',      visible: true },
  { key: 'processes',    visible: true },
  { key: 'reports-list', visible: true },
  { key: 'concierge',    visible: true },
  { key: 'calendar',     visible: true },
  { key: 'pinned',       visible: true },
];

const WIDGET_META: Record<WidgetKey, { label: string; description: string; icon: React.ElementType; cols: number }> = {
  activity:      { label: 'Platform activity',      description: 'Live feed of events across the platform',  icon: Bell,           cols: 4  },
  queue:         { label: 'Work queue',             description: 'Items pending your action',                icon: ClipboardCheck, cols: 8  },
  health:        { label: 'Health dashboard',       description: 'FY26 KPI overview',                        icon: BarChart3,      cols: 12 },
  shared:        { label: 'Recently shared',        description: 'Dashboards & reports shared with you',     icon: Share2,         cols: 12 },
  recents:       { label: 'Recent Ask IRA queries', description: 'Pick up where you left off',               icon: MessageSquare,  cols: 12 },
  engagements:   { label: 'Active engagements',     description: 'Audits in progress with control coverage', icon: Briefcase,      cols: 12 },
  exceptions:    { label: 'Open exceptions',        description: 'Unresolved findings flagged for review',   icon: AlertOctagon,   cols: 7  },
  workflows:     { label: 'Workflow activity',      description: 'Recent run timeline: duration, status, exception output per execution', icon: Activity, cols: 8 },
  sources:       { label: 'Connected data sources', description: 'Health of the systems IRA reads from',     icon: Database,       cols: 12 },
  processes:     { label: 'Business processes',     description: 'P2P / O2C / R2R / S2C coverage at a glance', icon: Layers,       cols: 8  },
  'reports-list':{ label: 'Recent reports',         description: 'Reports you and your team generated',      icon: FileText,       cols: 6  },
  concierge:     { label: 'AI Concierge',           description: 'Quick-launch forensics, extractor, builder', icon: Sparkles,     cols: 6  },
  calendar:      { label: 'Audit calendar',         description: 'Upcoming engagements, deadlines, deficiencies due', icon: Calendar, cols: 6  },
  pinned:        { label: 'Pinned',                 description: 'Workflows, reports, and engagements you starred', icon: Sparkles, cols: 6 },
};

const widgetsKeyFor = (p: Persona) => `home.widgets.v4.${p}`;

function isWidgetKey(k: unknown): k is WidgetKey {
  return typeof k === 'string' && DEFAULT_WIDGETS.some(d => d.key === k);
}

// Returns the persona's default widget visibility — visible iff the widget
// key is in PERSONA_WIDGETS[persona], else hidden.
function defaultWidgetsForPersona(p: Persona): WidgetState[] {
  const visibleSet = new Set(PERSONA_WIDGETS[p]);
  return DEFAULT_WIDGETS.map(w => ({ ...w, visible: visibleSet.has(w.key) }));
}

function loadWidgetsForPersona(p: Persona): WidgetState[] {
  if (typeof window === 'undefined') return defaultWidgetsForPersona(p);
  try {
    const raw = window.localStorage.getItem(widgetsKeyFor(p));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed
          .filter(w => w && isWidgetKey(w.key) && typeof w.visible === 'boolean')
          .map((w): WidgetState => ({ key: w.key, visible: w.visible }));
        if (valid.length > 0) {
          // Newly added widgets in DEFAULT_WIDGETS get the persona's default visibility.
          const known = new Set(valid.map(w => w.key));
          const visibleSet = new Set(PERSONA_WIDGETS[p]);
          const added = DEFAULT_WIDGETS.filter(d => !known.has(d.key)).map(d => ({
            ...d,
            visible: visibleSet.has(d.key),
          }));
          return [...valid, ...added];
        }
      }
    }
  } catch { /* fall through */ }
  return defaultWidgetsForPersona(p);
}

// ─── Add Widget modal — macOS-style gallery ──────────────────────────────────
// Centered modal with a 2-col grid of preview tiles. Each tile shows a
// scaled-down rendering of what the widget actually looks like, plus the
// label, description, and an Add/Remove affordance. Click anywhere on the
// tile to toggle. Cool neutral platform tokens only (per modal design rule).

function AddWidgetModal({
  widgets, onToggle, onClose, originRect,
}: {
  widgets: WidgetState[];
  onToggle: (key: WidgetKey) => void;
  onClose: () => void;
  originRect: DOMRect | null;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Escape closes; Tab cycles focus inside the dialog (focus trap).
  // On mount: remember the element that was focused before opening and focus
  // the Close button. On unmount: restore focus to the previously focused
  // element (the Add widget pill) so keyboard users land where they started.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusables = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const visibleCount = widgets.filter(w => w.visible).length;

  // Compute the offset from viewport center to the Add Widget button center
  // so the modal can animate out of (and back into) the button on open/close.
  const { dx, dy } = useMemo(() => {
    if (typeof window === 'undefined' || !originRect) return { dx: 0, dy: 0 };
    return {
      dx: originRect.left + originRect.width / 2 - window.innerWidth / 2,
      dy: originRect.top + originRect.height / 2 - window.innerHeight / 2,
    };
  }, [originRect]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
        animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
        exit={{ opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 bg-ink-900/30 z-40"
        style={{ WebkitBackdropFilter: 'blur(20px)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{
          opacity: 0,
          scale: 0.08,         // ~size of the button
          x: dx,               // exact button center
          y: dy,
          filter: 'blur(12px)',
        }}
        animate={{
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          filter: 'blur(0px)',
        }}
        exit={{
          opacity: 0,
          scale: 0.08,         // shrink back to button size
          x: dx,               // and back to button position
          y: dy,
          filter: 'blur(12px)',
          transition: { duration: 0.32, ease: [0.4, 0, 1, 1] },
        }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-1/2 top-[calc(50%-32px)] -translate-x-1/2 -translate-y-1/2 w-[min(960px,calc(100vw-32px))] max-h-[78vh] rounded-2xl z-50 flex flex-col overflow-hidden border border-white/40 ring-1 ring-inset ring-white/30"
        style={{
          background: 'rgba(255, 255, 255, 0.78)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          boxShadow: '0 32px 80px rgb(15 8 30 / 0.28), 0 8px 24px rgb(15 8 30 / 0.10), inset 0 1px 0 rgb(255 255 255 / 0.7)',
          transformOrigin: 'center center',
          willChange: 'transform, opacity, filter',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Edit widgets"
        ref={modalRef}
      >
        <header className="shrink-0 px-6 py-5 border-b border-white/40 bg-white/20">
          <h2 className="font-display text-[20px] font-[420] text-ink-900 leading-tight">Edit widgets</h2>
          <p className="text-meta text-ink-500 mt-0.5">
            Add or remove widgets from your homepage. Drag the handle on a widget to reorder it.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.03, delayChildren: 0.08 } } }}
          >
            {widgets.map(w => (
              <motion.div
                key={w.key}
                variants={{
                  hidden: { opacity: 0, y: 10, scale: 0.98 },
                  show:   { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
                } satisfies Variants}
              >
                <WidgetTile state={w} onToggle={() => onToggle(w.key)} />
              </motion.div>
            ))}
          </motion.div>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-white/40 flex items-center justify-between gap-4 bg-white/30">
          <span className="text-xs text-ink-500 tabular-nums font-medium">
            {visibleCount} of {widgets.length} enabled
          </span>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-full text-meta font-semibold cursor-pointer bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_8px_24px_rgb(136_56_222_/_0.32),_0_0_0_1px_rgb(136_56_222_/_0.18)] hover:shadow-[0_12px_32px_rgb(136_56_222_/_0.40),_0_0_0_1px_rgb(136_56_222_/_0.25)] transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <X size={14} strokeWidth={2.5} />
            Close
          </button>
        </footer>
      </motion.div>
    </>
  );
}

function WidgetTile({ state, onToggle }: { state: WidgetState; onToggle: () => void }) {
  const meta = WIDGET_META[state.key];
  const Icon = meta.icon;

  return (
    <motion.button
      onClick={onToggle}
      aria-pressed={state.visible}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'tween', duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative w-full text-left rounded-2xl overflow-hidden cursor-pointer transition-[box-shadow,outline] duration-200 bg-canvas-elevated outline outline-[1.5px] outline-offset-[-1.5px] ${
        state.visible
          ? 'outline-brand-400/80 shadow-[0_2px_8px_rgb(15_8_30_/_0.05)]'
          : 'outline-canvas-border/50 shadow-[0_1px_2px_rgb(15_8_30_/_0.04)] hover:outline-brand-200 hover:shadow-[0_12px_28px_rgb(15_8_30_/_0.06)]'
      }`}
    >
      {/* Preview frame — inset rounded-xl panel with the mini widget */}
      <div className="p-3 pb-0">
        <div className="relative h-[124px] rounded-xl overflow-hidden ring-1 ring-inset ring-canvas-border/50 bg-paper-50/40 group-hover:ring-canvas-border transition-colors duration-200">
          <WidgetPreview kind={state.key} />
        </div>
      </div>

      {/* Info row — title left, status pill right */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-paper-50 text-ink-600 transition-colors">
            <Icon size={13} strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <h3 className="text-meta font-semibold text-ink-900 leading-tight tracking-[-0.01em] truncate">{meta.label}</h3>
            <p className="text-xs text-ink-500 leading-snug line-clamp-1 mt-0.5">{meta.description}</p>
          </div>
        </div>

        <motion.div
          initial={false}
          animate={{ scale: state.visible ? 1 : 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          aria-hidden
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            state.visible
              ? 'bg-brand-600 shadow-[0_2px_6px_rgb(136_56_222_/_0.30)]'
              : 'bg-paper-50 ring-1 ring-inset ring-canvas-border/70 group-hover:bg-brand-50 group-hover:ring-brand-200'
          }`}
        >
          {state.visible
            ? <Check size={13} className="text-white" strokeWidth={3} />
            : <Plus size={13} className="text-ink-700 group-hover:text-brand-700" strokeWidth={2.5} />
          }
        </motion.div>
      </div>
    </motion.button>
  );
}

// Scaled-down preview of each widget. Uses the same color tokens as the
// actual widget so the gallery feels like a real "this is what you'll get".
function WidgetPreview({ kind }: { kind: WidgetKey }) {
  if (kind === 'activity') {
    const rows = [
      { stripe: 'bg-evidence',  title: 'Workflow run completed' },
      { stripe: 'bg-risk',      title: 'Exception assigned to you' },
      { stripe: 'bg-brand-500', title: 'Report shared with you' },
    ];
    return (
      <div className="absolute inset-0">
        <div className="h-full overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 border-b border-canvas-border bg-paper-50/40">
            <div className="text-[8px] font-semibold uppercase tracking-wider text-ink-500">Today</div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="relative px-3 py-2 border-b border-canvas-border last:border-0 bg-brand-50/30 flex-1">
              <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full ${r.stripe}`} />
              <div className="text-[9px] font-medium text-ink-900 truncate">{r.title}</div>
              <div className="h-1 w-3/4 rounded-full bg-ink-200/60 mt-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'queue') {
    const rows = [
      { type: 'Workflow', risk: 'bg-risk',       riskLabel: 'CRIT' },
      { type: 'Approval', risk: 'bg-mitigated',  riskLabel: 'HIGH' },
      { type: 'Task',     risk: 'bg-brand-300',  riskLabel: 'MED'  },
    ];
    return (
      <div className="absolute inset-0">
        <div className="h-full overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 border-b border-canvas-border bg-paper-50/40 grid grid-cols-[35%_45%_20%] gap-2">
            <div className="text-[7.5px] font-semibold text-ink-500 uppercase tracking-wider">Type</div>
            <div className="text-[7.5px] font-semibold text-ink-500 uppercase tracking-wider">Item</div>
            <div className="text-[7.5px] font-semibold text-ink-500 uppercase tracking-wider">Risk</div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="px-3 py-2 border-b border-canvas-border last:border-0 grid grid-cols-[35%_45%_20%] gap-2 items-center flex-1">
              <div className="text-[8px] text-ink-700">{r.type}</div>
              <div className="h-1 rounded-full bg-ink-200/60" />
              <span className={`inline-flex items-center justify-center text-[7px] font-bold text-white px-1 py-0.5 rounded ${r.risk}`}>{r.riskLabel}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'health') {
    return (
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-1.5">
        <div className="col-span-1 row-span-2 rounded-md bg-canvas-elevated border border-canvas-border p-2 flex flex-col justify-between">
          <div>
            <div className="text-[7px] font-semibold text-brand-600 uppercase tracking-wider">FY26</div>
            <div className="text-[16px] font-bold text-ink-900 leading-none mt-0.5 tabular-nums">76%</div>
          </div>
          <svg viewBox="0 0 60 20" preserveAspectRatio="none" className="w-full h-4">
            <polyline points="0,16 12,13 24,9 36,7 48,5 60,3" fill="none" stroke="var(--color-brand-500)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="rounded-md bg-mitigated-50 border border-mitigated-50 p-1.5 flex flex-col justify-between">
          <div className="text-[7px] font-semibold text-mitigated-700">Risk</div>
          <div className="text-xs font-bold text-ink-900 tabular-nums">28</div>
        </div>
        <div className="rounded-md bg-brand-50 border border-brand-100 p-1.5 flex flex-col justify-between">
          <div className="text-[7px] font-semibold text-brand-700">Controls</div>
          <div className="text-xs font-bold text-brand-700 tabular-nums">87</div>
        </div>
        <div className="rounded-md bg-risk-50 border border-risk-50 p-1.5 flex flex-col justify-between">
          <div className="text-[7px] font-semibold text-risk-700">Defs</div>
          <div className="text-xs font-bold text-ink-900 tabular-nums">12</div>
        </div>
        <div className="rounded-md bg-compliant-50 border border-compliant-50 p-1.5 flex flex-col justify-between">
          <div className="text-[7px] font-semibold text-compliant-700">Runs</div>
          <div className="text-xs font-bold text-compliant-700 tabular-nums">142</div>
        </div>
      </div>
    );
  }

  if (kind === 'shared') {
    const cards = [
      { kind: 'DASH', icon: LayoutGrid, name: 'Vendor Risk' },
      { kind: 'RPT',  icon: FileText,   name: 'Q1 SOX' },
      { kind: 'RPT',  icon: FileText,   name: 'Vendor Q' },
    ];
    return (
      <div className="absolute inset-0 grid grid-cols-3 gap-1.5">
        {cards.map((c, i) => {
          const CIcon = c.icon;
          return (
            <div key={i} className="rounded-md bg-canvas-elevated border border-canvas-border p-2 flex flex-col gap-1.5">
              <div className="inline-flex items-center gap-0.5 text-[7px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 self-start px-1 py-0.5 rounded">
                <CIcon size={6} />
                {c.kind}
              </div>
              <div className="text-[8px] font-semibold text-ink-900 leading-tight truncate">{c.name}</div>
              <div className="h-0.5 rounded-full bg-ink-200/60 w-full" />
              <div className="h-0.5 rounded-full bg-ink-200/60 w-2/3" />
              <div className="text-[6.5px] text-ink-400 mt-auto">Shared by</div>
            </div>
          );
        })}
      </div>
    );
  }

  if (kind === 'recents') {
    const queries = [
      'Detect duplicate invoice entries',
      'Unauthorized vendor master changes',
      'Risk identification across processes',
    ];
    return (
      <div className="absolute inset-0">
        <div className="h-full overflow-hidden flex flex-col divide-y divide-canvas-border/60">
          {queries.map((q, i) => (
            <div key={i} className="px-3 py-2 flex items-center gap-2 flex-1 hover:bg-brand-50/30 transition-colors">
              <div className="w-3.5 h-3.5 rounded bg-brand-50 flex items-center justify-center shrink-0">
                <MessageSquare size={7} className="text-brand-700" />
              </div>
              <div className="text-[8.5px] text-ink-900 truncate flex-1">{q}</div>
              <ArrowRight size={8} className="text-ink-400 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'engagements') {
    const rows = [
      { name: 'FY26 SOX Audit',     pct: 58, type: 'SOX' },
      { name: 'FY26 IFC Assessment', pct: 14, type: 'IFC' },
    ];
    return (
      <div className="absolute inset-0">
        <div className="h-full overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 border-b border-canvas-border bg-paper-50/40 grid grid-cols-[55%_30%_15%] gap-2">
            <div className="text-[7.5px] font-semibold text-ink-500 uppercase tracking-wider">Engagement</div>
            <div className="text-[7.5px] font-semibold text-ink-500 uppercase tracking-wider">Progress</div>
            <div className="text-[7.5px] font-semibold text-ink-500 uppercase tracking-wider">%</div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="px-3 py-2 border-b border-canvas-border last:border-0 grid grid-cols-[55%_30%_15%] gap-2 items-center flex-1">
              <div>
                <div className="text-[8.5px] font-medium text-ink-900 truncate">{r.name}</div>
                <div className="text-[7px] text-ink-500 mt-0.5">{r.type}</div>
              </div>
              <div className="h-1 rounded-full bg-canvas-border overflow-hidden">
                <div className="h-full bg-brand-500" style={{ width: `${r.pct}%` }} />
              </div>
              <div className="text-[8px] font-semibold text-ink-700 tabular-nums">{r.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'exceptions') {
    const rows = [
      { sev: 'High',   tone: 'bg-risk-50 text-risk-700',           title: 'Unauthorized admin VPN access' },
      { sev: 'High',   tone: 'bg-risk-50 text-risk-700',           title: 'Unencrypted PII in S3 buckets' },
      { sev: 'Medium', tone: 'bg-mitigated-50 text-mitigated-700', title: 'Firewall outbound rule too open' },
    ];
    return (
      <div className="absolute inset-0">
        <div className="h-full overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 border-b border-canvas-border bg-paper-50/40 grid grid-cols-[28%_72%] gap-2">
            <div className="text-[7.5px] font-semibold text-ink-500 uppercase tracking-wider">Sev</div>
            <div className="text-[7.5px] font-semibold text-ink-500 uppercase tracking-wider">Title</div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="px-3 py-2 border-b border-canvas-border last:border-0 grid grid-cols-[28%_72%] gap-2 items-center flex-1">
              <span className={`inline-flex items-center text-[7px] font-bold px-1 py-0.5 rounded self-start ${r.tone}`}>{r.sev}</span>
              <div className="text-[8px] text-ink-900 truncate">{r.title}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'workflows') {
    const rows = [
      { name: 'Three-Way PO Match',         runs: 45, w: '95%' },
      { name: 'Journal Entry Anomaly',      runs: 22, w: '49%' },
      { name: 'SOD Violation Detector',     runs: 15, w: '34%' },
    ];
    return (
      <div className="absolute inset-0">
        <div className="h-full overflow-hidden flex flex-col divide-y divide-canvas-border/60">
          {rows.map((r, i) => (
            <div key={i} className="px-3 py-2 flex items-center gap-2 flex-1">
              <div className="w-3.5 h-3.5 rounded bg-compliant-50 flex items-center justify-center shrink-0">
                <WorkflowIcon size={7} className="text-compliant-700" />
              </div>
              <div className="text-[8px] text-ink-900 truncate flex-1">{r.name}</div>
              <div className="w-10 h-1 rounded-full bg-canvas-border overflow-hidden shrink-0">
                <div className="h-full bg-compliant" style={{ width: r.w }} />
              </div>
              <div className="text-[7.5px] font-semibold text-ink-700 tabular-nums shrink-0 w-4 text-right">{r.runs}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'sources') {
    const cards = [
      { name: 'SAP ERP: AP',   type: 'sql', tone: 'bg-brand-50 text-brand-700',         ok: true  },
      { name: 'Invoice 2026',   type: 'pdf', tone: 'bg-risk-50 text-risk-700',           ok: true  },
      { name: 'Vendor Master',  type: 'csv', tone: 'bg-compliant-50 text-compliant-700', ok: true  },
      { name: 'Contracts',       type: 'pdf', tone: 'bg-risk-50 text-risk-700',           ok: false },
    ];
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-1.5">
        {cards.map((c, i) => (
          <div key={i} className="rounded-md bg-canvas-elevated border border-canvas-border p-2 flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-canvas-border/40 flex items-center justify-center shrink-0">
              <Database size={7} className="text-ink-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <div className="text-[7.5px] font-medium text-ink-900 truncate">{c.name}</div>
                <span className={`text-[6px] font-bold uppercase px-1 rounded ${c.tone}`}>{c.type}</span>
              </div>
              <div className="text-[6px] text-ink-500 mt-0.5 flex items-center">
                <span className={`inline-block w-1 h-1 rounded-full mr-1 ${c.ok ? 'bg-compliant' : 'bg-risk'}`} />
                {c.ok ? 'Synced' : 'Off'}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'processes') {
    const tiles = [
      { abbr: 'P2P', color: 'var(--color-brand-600)',     pct: 72 },
      { abbr: 'O2C', color: 'var(--color-evidence-600)',  pct: 58 },
      { abbr: 'S2C', color: 'var(--color-compliant)',     pct: 40 },
      { abbr: 'R2R', color: 'var(--color-mitigated)',     pct: 85 },
    ];
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-1.5">
        {tiles.map(t => (
          <div key={t.abbr} className="rounded-md bg-canvas-elevated border border-canvas-border p-2 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[7.5px] font-bold uppercase px-1 rounded" style={{ backgroundColor: `${t.color}1A`, color: t.color }}>{t.abbr}</span>
              <span className="text-[7.5px] tabular-nums font-semibold" style={{ color: t.color }}>{t.pct}%</span>
            </div>
            <div className="h-0.5 rounded-full bg-canvas-border/40 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${t.pct}%`, backgroundColor: t.color }} />
            </div>
            <div className="text-[6px] text-ink-500 mt-auto">risks · controls</div>
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'reports-list') {
    const rows = [
      { name: 'Q1 SOX Compliance', status: 'final' },
      { name: 'P2P Risk Assessment', status: 'draft' },
      { name: 'Workflow Performance', status: 'final' },
    ];
    return (
      <div className="absolute inset-0">
        <div className="h-full overflow-hidden flex flex-col divide-y divide-canvas-border/60">
          {rows.map((r, i) => (
            <div key={i} className="px-3 py-2 flex items-center gap-2 flex-1">
              <div className="w-3.5 h-3.5 rounded bg-brand-50 flex items-center justify-center shrink-0">
                <FileText size={7} className="text-brand-700" />
              </div>
              <div className="text-[8px] text-ink-900 truncate flex-1">{r.name}</div>
              <span className={`text-[6.5px] font-bold uppercase px-1 rounded ${r.status === 'final' ? 'bg-compliant-50 text-compliant-700' : 'bg-mitigated-50 text-mitigated-700'}`}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'concierge') {
    const tools = [
      { label: 'Document Forensics', tone: 'bg-risk-50 text-risk-700',           icon: Search },
      { label: 'Table Extractor',    tone: 'bg-brand-50 text-brand-700',         icon: TableProperties },
      { label: 'Workflow Builder',   tone: 'bg-compliant-50 text-compliant-700', icon: Wand2 },
    ];
    return (
      <div className="absolute inset-0">
        <div className="h-full overflow-hidden flex flex-col divide-y divide-canvas-border/60">
          {tools.map((t, i) => {
            const TIcon = t.icon;
            return (
              <div key={i} className="px-3 py-2 flex items-center gap-2 flex-1">
                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${t.tone}`}>
                  <TIcon size={8} />
                </div>
                <div className="text-[8px] font-medium text-ink-900 truncate flex-1">{t.label}</div>
                <ArrowRight size={7} className="text-ink-400" />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (kind === 'calendar') {
    const events = [
      { day: 23, mo: 'Apr', label: 'FY26 SOX Audit', tone: 'bg-evidence-50 text-evidence-700' },
      { day: 30, mo: 'Apr', label: 'IFC Q2 review',  tone: 'bg-risk-50 text-risk-700' },
      { day:  5, mo: 'May', label: 'Vendor sign-off', tone: 'bg-evidence-50 text-evidence-700' },
    ];
    return (
      <div className="absolute inset-0">
        <div className="h-full overflow-hidden flex flex-col divide-y divide-canvas-border/60">
          {events.map((e, i) => (
            <div key={i} className="px-3 py-2 flex items-center gap-2 flex-1">
              <div className="w-7 flex flex-col items-center shrink-0">
                <div className="text-[6.5px] font-mono uppercase tracking-wider text-ink-500">{e.mo}</div>
                <div className="text-xs font-bold tabular-nums text-ink-900 leading-none">{e.day}</div>
              </div>
              <div className="text-[8px] text-ink-900 truncate flex-1">{e.label}</div>
              <span className={`text-[6.5px] font-bold uppercase px-1 rounded ${e.tone}`}>{i === 1 ? 'def' : 'eng'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'pinned') {
    const items = [
      { name: 'Three-Way PO Match',  type: 'WF', tone: 'bg-brand-50 text-brand-700' },
      { name: 'Q1 SOX Compliance',   type: 'RPT', tone: 'bg-evidence-50 text-evidence-700' },
      { name: 'FY26 SOX Audit',      type: 'ENG', tone: 'bg-compliant-50 text-compliant-700' },
    ];
    return (
      <div className="absolute inset-0">
        <div className="h-full overflow-hidden flex flex-col divide-y divide-canvas-border/60">
          {items.map((it, i) => (
            <div key={i} className="px-3 py-2 flex items-center gap-2 flex-1">
              <Star size={9} className="text-mitigated-700 shrink-0" fill="currentColor" />
              <div className="text-[8.5px] text-ink-900 truncate flex-1">{it.name}</div>
              <span className={`text-[6.5px] font-bold uppercase px-1 rounded ${it.tone}`}>{it.type}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Global date range filter ───────────────────────────────────────────────
// Scopes date-bearing widgets (Platform activity by createdAt, Work queue
// by dueDate). Health / shared / recents are aggregate or catalog views and
// don't participate.

type DateRange = '7d' | '30d' | 'qtd' | '90d' | 'ytd' | 'custom' | 'all';

// "Quarterly" maps to ~90 days but is the audit-native framing — Internal
// Auditors think in fiscal quarters (Q1–Q4), not rolling day counts. Distinct
// option from "90 days" so it reads as a quarter close-out view.
// "Custom…" days is null at the registry level; the actual span is computed
// at runtime from a separate {from, to} state.
const DATE_RANGE_OPTIONS: { id: DateRange; label: string; days: number | null }[] = [
  { id: '7d',     label: '7 days',       days: 7   },
  { id: '30d',    label: '30 days',      days: 30  },
  { id: 'qtd',    label: 'Quarterly',    days: 90  },
  { id: '90d',    label: '90 days',      days: 90  },
  { id: 'ytd',    label: 'Year to date', days: null },
  { id: 'custom', label: 'Custom…',      days: null },
  { id: 'all',    label: 'All time',     days: null },
];

const DATE_RANGE_KEY = 'home.date-range.v1';
const DATE_RANGE_CUSTOM_KEY = 'home.date-range-custom.v1';

interface CustomRange { from: string; to: string }

function loadCustomRange(): CustomRange | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DATE_RANGE_CUSTOM_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.from === 'string' && typeof p?.to === 'string') return { from: p.from, to: p.to };
    return null;
  } catch { return null; }
}

const HOME_TODAY = new Date('2026-04-23');

// Aggregates without per-item dates (Health KPIs, list slicing) scale by this
// factor so the dashboard visibly responds to range changes. Tuned for demo
// readability rather than literal accuracy.
function scaleForRange(rangeDays: number | null): number {
  if (rangeDays == null) return 1;
  if (rangeDays >= 90) return 0.78;
  if (rangeDays >= 30) return 0.42;
  return 0.15;
}

const ONBOARDING_DISMISSED_KEY = 'home.onboarding-dismissed.v1';

const HERO_PROMPTS: string[] = [
  'What risks need attention this week?',
  'Build a vendor payment workflow',
  "Summarize this quarter's exceptions",
  'Show overdue control tests',
];

// ─── Hero animation helpers ─────────────────────────────────────────────────

const HERO_CHILD_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 6 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
};

// Health snapshot — soft staircase. Tiles cascade in left-to-right (DOM order
// matches visual order via the `order-N` class on each tile), keeping the
// premium feel: no springs, no overshoot, just smooth fade+lift.
const HEALTH_GRID_VARIANTS: Variants = {
  hidden: { opacity: 1 },
  show:   { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const HEALTH_TILE_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

// Pulses `true` for `ms` whenever any item in `deps` changes. Used to flash
// skeleton loaders on persona / date-range switches so the transition feels
// reactive instead of snapping.
function useTransitionPulse(deps: ReadonlyArray<unknown>, ms = 280): boolean {
  const [pulsing, setPulsing] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return pulsing;
}

// Generic skeleton placeholder that matches the visual rhythm of a widget
// (header strip + a few rows). Rendered while `useTransitionPulse` is true.
function WidgetSkeleton() {
  return (
    <div className="rounded-xl border border-canvas-border/70 bg-canvas-elevated overflow-hidden h-full flex flex-col animate-pulse">
      <div className="h-10 border-b border-canvas-border/60 px-5 py-3 flex items-center gap-2">
        <div className="w-3.5 h-3.5 rounded bg-canvas-border/60" />
        <div className="h-3 w-32 rounded bg-canvas-border/60" />
      </div>
      <div className="flex-1 p-4 space-y-2.5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-canvas-border/40" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 rounded bg-canvas-border/40" style={{ width: `${60 + (i % 3) * 12}%` }} />
              <div className="h-2 rounded bg-canvas-border/30 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function useCountUp(target: number, duration = 1600) {
  const [n, setN] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    prev.current = target;
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}

function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

// Subtitle + try-chips wait for the heading's letter cascade to land before
// they begin staggering in. Larger delayChildren than HERO_CONTAINER_VARIANTS.
const HERO_TAIL_CONTAINER_VARIANTS: Variants = {
  hidden: { opacity: 1 },
  show:   { opacity: 1, transition: { staggerChildren: 0.14, delayChildren: 1.0 } },
};

// ─── Persona dropdown ───────────────────────────────────────────────────────
// In production this would be set by RBAC and not rendered as a switcher.
// We keep it accessible (and labeled "set by your administrator") so demo
// stakeholders can preview each role without re-logging.

function DateRangeDropdown({
  value, onChange, customRange, setCustomRange,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  customRange: CustomRange | null;
  setCustomRange: (r: CustomRange | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [from, setFrom] = useState(customRange?.from ?? '');
  const [to, setTo] = useState(customRange?.to ?? '');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  const currentLabel = useMemo(() => {
    if (value === 'custom' && customRange) {
      const f = new Date(customRange.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const t = new Date(customRange.to).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${f} – ${t}`;
    }
    return DATE_RANGE_OPTIONS.find(o => o.id === value)?.label ?? '30 days';
  }, [value, customRange]);

  useEffect(() => {
    if (!open) return;
    const recompute = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setCoords({ top: r.bottom + 6, right: window.innerWidth - r.right });
    };
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
      setCustomMode(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setCustomMode(false); }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pickFixed = (id: DateRange) => {
    if (id === 'custom') {
      setCustomMode(true);
      // Seed inputs with the fixture's "today" so users see a reasonable default.
      if (!from) setFrom('2026-04-01');
      if (!to)   setTo('2026-04-23');
      return;
    }
    onChange(id);
    setOpen(false);
    setCustomMode(false);
  };

  const applyCustom = () => {
    if (!from || !to || new Date(from).getTime() > new Date(to).getTime()) return;
    setCustomRange({ from, to });
    onChange('custom');
    setOpen(false);
    setCustomMode(false);
  };

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Period: ${currentLabel}`}
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-canvas-border bg-canvas-elevated hover:border-brand-200 hover:text-brand-700 text-xs font-medium text-ink-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <Calendar size={12} className="text-ink-500" />
        <span className="text-ink-500">Period:</span>
        <span className="tabular-nums text-ink-900">{currentLabel}</span>
        <ChevronDown size={11} className={`text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit   ={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              role="menu"
              style={{ position: 'fixed', top: coords.top, right: coords.right, zIndex: 'var(--z-popover)' }}
              className="w-64 rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_16px_48px_rgb(15_8_30_/_0.16),_0_4px_12px_rgb(15_8_30_/_0.06)] overflow-hidden"
            >
              <div className="px-4 py-2 border-b border-canvas-border/60 bg-paper-50/40">
                <span className="text-xs font-mono uppercase tracking-wider text-ink-500">Period</span>
              </div>
              <div className="py-1">
                {DATE_RANGE_OPTIONS.map(opt => {
                  const active = value === opt.id;
                  const isCustom = opt.id === 'custom';
                  return (
                    <button
                      key={opt.id}
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => pickFixed(opt.id)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-2 hover:bg-brand-50/40 transition-colors cursor-pointer text-left ${active ? 'bg-brand-50/60' : ''}`}
                    >
                      <span className={`text-meta ${active ? 'font-semibold text-brand-800' : 'text-ink-900'}`}>{opt.label}</span>
                      {active && !isCustom && <Check size={13} className="text-brand-700 shrink-0" />}
                      {isCustom && <ChevronDown size={11} className={`text-ink-400 shrink-0 -rotate-90`} />}
                    </button>
                  );
                })}
              </div>
              {customMode && (
                <div className="border-t border-canvas-border/60 bg-paper-50/40 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-ink-500 w-10">From</label>
                    <input
                      type="date"
                      value={from}
                      max={to || undefined}
                      onChange={e => setFrom(e.target.value)}
                      className="flex-1 h-7 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-xs text-ink-900 focus:outline-none focus:border-brand-400"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-ink-500 w-10">To</label>
                    <input
                      type="date"
                      value={to}
                      min={from || undefined}
                      onChange={e => setTo(e.target.value)}
                      className="flex-1 h-7 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-xs text-ink-900 focus:outline-none focus:border-brand-400"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => { setCustomMode(false); setOpen(false); }}
                      className="h-7 px-3 rounded-md text-xs font-medium text-ink-600 hover:bg-canvas-border/40 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applyCustom}
                      disabled={!from || !to || new Date(from).getTime() > new Date(to).getTime()}
                      className="h-7 px-3 rounded-md text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function PersonaDropdown({
  persona, onChange,
}: {
  persona: Persona;
  onChange: (p: Persona) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const current = PERSONAS.find(p => p.id === persona);

  // Compute menu position from trigger's viewport rect; recompute on open,
  // resize, and scroll so the menu tracks the trigger.
  useEffect(() => {
    if (!open) return;
    const recompute = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setCoords({
        top: r.bottom + 6,
        right: window.innerWidth - r.right,
      });
    };
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open]);

  // Click outside or Escape closes the menu.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!current) return null;
  const CurrentIcon = current.icon;

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-canvas-border bg-canvas-elevated hover:border-brand-200 hover:text-brand-700 text-xs font-medium text-ink-700 transition-colors cursor-pointer"
      >
        <CurrentIcon size={12} className="text-ink-500" />
        <span className="tabular-nums">{current.label}</span>
        <ChevronDown size={11} className={`text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Portal so the menu escapes any overflow:hidden ancestor and overlays
          the widgets cleanly — z-index fights aren't possible from here. */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit   ={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              role="menu"
              style={{ position: 'fixed', top: coords.top, right: coords.right, zIndex: 'var(--z-popover)' }}
              className="w-72 rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_16px_48px_rgb(15_8_30_/_0.16),_0_4px_12px_rgb(15_8_30_/_0.06)] overflow-hidden"
            >
              <div className="px-4 py-2 border-b border-canvas-border/60 bg-paper-50/40 flex items-center gap-2">
                <Shield size={11} className="text-ink-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-ink-500">
                  Set by administrator · demo only
                </span>
              </div>
              {PERSONAS.map(p => {
                const active = persona === p.id;
                const PIcon = p.icon;
                return (
                  <button
                    key={p.id}
                    role="menuitem"
                    onClick={() => { onChange(p.id); setOpen(false); }}
                    className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-brand-50/40 transition-colors cursor-pointer text-left ${active ? 'bg-brand-50/60' : ''}`}
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${active ? 'bg-brand-600 text-white' : 'bg-canvas-border/40 text-ink-700'}`}>
                      <PIcon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-meta font-semibold ${active ? 'text-brand-800' : 'text-ink-900'}`}>{p.label}</div>
                      <div className="text-[11.5px] text-ink-500 mt-0.5 leading-snug">{p.description}</div>
                    </div>
                    {active && <Check size={14} className="text-brand-700 shrink-0 mt-1" />}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

// ─── Layouts ────────────────────────────────────────────────────────────────
// Drag + resize layout via react-grid-layout. Widgets snap to a 12-col grid
// with rows of fixed height; users drag tile bodies to reposition and the SE
// corner to resize. Persists per-widget x/y/w/h to localStorage.

interface LayoutProps {
  visibleWidgets: WidgetState[];
  sectionFor: (k: WidgetKey) => React.ReactNode;
}

const compactLayoutKeyFor = (p: Persona) => `home.compact-layout.v23.${p}`;

// Default sizes (12-col grid, rowHeight = 48px on 8pt scale).
// Widths constrained to {4, 8, 12} so rows always pack to 12 (8+4, 4+4+4, 12).
// Heights are content-tuned. minW/minH derived from "what's the smallest size
// where this widget still renders all its essential content?"
// maxH caps fixed-content widgets so resize can't create dead space.
// User-selectable size preset per widget. Picked in Add Widget modal,
// persisted per persona. Each widget defines its own dimensions for each
// preset so "Small" means something appropriate (a 5-col table can't really
// be "Small at w=1"). Default is 'medium'.
type WidgetSize = 'small' | 'medium' | 'large' | 'xxl';

interface SizeSpec { w: number; h: number; }

// Medium = the canonical paired layout: 8w widgets and 4w widgets at h=9
// so they pair edge-to-edge in 8+4 rows with NO height mismatch. Health
// (KPI bento) and Reports (footer band) are full-width 12.
const WIDGET_SIZES: Record<WidgetKey, Record<WidgetSize, SizeSpec>> = {
  queue:          { small: { w: 4, h:  6 }, medium: { w:  8, h:  9 }, large: { w: 12, h: 11 }, xxl: { w: 12, h: 14 } },
  workflows:      { small: { w: 4, h:  7 }, medium: { w:  8, h:  9 }, large: { w: 12, h: 11 }, xxl: { w: 12, h: 14 } },
  engagements:    { small: { w: 4, h:  6 }, medium: { w:  8, h:  9 }, large: { w: 12, h:  9 }, xxl: { w: 12, h: 12 } },
  exceptions:     { small: { w: 4, h:  6 }, medium: { w:  8, h:  9 }, large: { w: 12, h: 11 }, xxl: { w: 12, h: 14 } },
  processes:      { small: { w: 4, h:  6 }, medium: { w:  8, h:  9 }, large: { w: 12, h:  9 }, xxl: { w: 12, h: 11 } },
  activity:       { small: { w: 4, h:  7 }, medium: { w:  4, h:  9 }, large: { w:  6, h: 14 }, xxl: { w:  8, h: 18 } },
  concierge:      { small: { w: 3, h:  5 }, medium: { w:  4, h:  9 }, large: { w:  6, h: 11 }, xxl: { w:  8, h: 11 } },
  recents:        { small: { w: 4, h:  6 }, medium: { w:  4, h:  9 }, large: { w:  6, h: 11 }, xxl: { w:  8, h: 14 } },
  sources:        { small: { w: 4, h:  6 }, medium: { w:  4, h:  9 }, large: { w:  6, h: 11 }, xxl: { w:  8, h: 12 } },
  shared:         { small: { w: 4, h:  7 }, medium: { w:  4, h:  9 }, large: { w:  6, h: 11 }, xxl: { w:  8, h: 14 } },
  health:         { small: { w: 8, h: 10 }, medium: { w: 12, h: 12 }, large: { w: 12, h: 13 }, xxl: { w: 12, h: 13 } },
  'reports-list': { small: { w: 3, h:  4 }, medium: { w: 12, h:  6 }, large: { w: 12, h:  8 }, xxl: { w: 12, h: 10 } },
  calendar:       { small: { w: 4, h:  6 }, medium: { w:  6, h:  9 }, large: { w:  8, h: 11 }, xxl: { w: 12, h: 14 } },
  pinned:         { small: { w: 4, h:  6 }, medium: { w:  6, h:  9 }, large: { w:  8, h: 11 }, xxl: { w: 12, h: 12 } },
};

const widgetSizesKeyFor = (p: Persona) => `home.widget-sizes.v2.${p}`;

function defaultWidgetSizes(): Record<WidgetKey, WidgetSize> {
  const out: Partial<Record<WidgetKey, WidgetSize>> = {};
  for (const k of Object.keys(WIDGET_SIZES) as WidgetKey[]) out[k] = 'medium';
  return out as Record<WidgetKey, WidgetSize>;
}

function loadWidgetSizes(p: Persona): Record<WidgetKey, WidgetSize> {
  if (typeof window === 'undefined') return defaultWidgetSizes();
  try {
    const raw = window.localStorage.getItem(widgetSizesKeyFor(p));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...defaultWidgetSizes(), ...parsed };
      }
    }
  } catch { /* fall through */ }
  return defaultWidgetSizes();
}

const COMPACT_DEFAULTS: Record<WidgetKey, { w: number; h: number; minW: number; minH: number; maxH?: number }> = {
  // Tables — 4-5 column data, need ~415px+ width and header + table-head + 1 row min
  queue:          { w: 8,  h:  9, minW: 5, minH: 4, maxH: 16 },
  engagements:    { w: 8,  h:  8, minW: 4, minH: 4, maxH: 14 },
  exceptions:     { w: 8,  h: 10, minW: 5, minH: 4, maxH: 18 },
  // KPI bento — 5-card internal bento requires the full 8-col width to render readably
  health:         { w: 12, h: 13, minW: 8, minH: 10, maxH: 13 },
  // 2×2 card grid — needs 2 cards across (minW=4) and 1 row min
  processes:      { w: 8,  h:  8, minW: 4, minH: 5, maxH: 14 },
  // 2×2 grid of 4 shared cards — 2 cards-wide min × 2 rows min
  shared:         { w: 4,  h: 11, minW: 4, minH: 6, maxH: 14 },
  // 2-col card grid — can compress to single column
  sources:        { w: 4,  h:  8, minW: 3, minH: 5, maxH: 12 },
  // Activity feed — chips row + at least 1 event group
  activity:       { w: 4,  h: 13, minW: 3, minH: 5, maxH: 24 },
  // Lists — header + 1+ row is usable
  workflows:      { w: 8,  h: 11, minW: 6, minH: 7, maxH: 18 },
  recents:        { w: 4,  h:  9, minW: 3, minH: 4, maxH: 16 },
  concierge:      { w: 4,  h:  7, minW: 3, minH: 4, maxH: 10 },
  'reports-list': { w: 4,  h:  6, minW: 3, minH: 4, maxH: 12 },
  calendar:       { w: 6,  h:  9, minW: 4, minH: 5, maxH: 14 },
  pinned:         { w: 6,  h:  9, minW: 4, minH: 4, maxH: 14 },
};

// Re-applies size constraints from defaults and clamps w/h to the configured
// range. minW/minH stop tiles from collapsing too narrow; maxH stops them
// from growing into dead-space monsters.
function enforceMins(items: Layout[]): Layout[] {
  return items.map(l => {
    const def = COMPACT_DEFAULTS[l.i as WidgetKey];
    if (!def) return l;
    const cappedH = def.maxH != null ? Math.min(l.h, def.maxH) : l.h;
    return {
      ...l,
      w: Math.max(l.w, def.minW),
      h: Math.max(cappedH, def.minH),
      minW: def.minW,
      minH: def.minH,
      ...(def.maxH != null ? { maxH: def.maxH } : {}),
    };
  });
}

function loadCompactLayout(persona: Persona): Layout[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(compactLayoutKeyFor(persona));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return enforceMins(parsed as Layout[]);
  } catch { return null; }
}

// Build a Layout entry for a single widget, enriched with min/max from defaults.
function buildLayoutItem(k: WidgetKey, x: number, y: number, w?: number, h?: number): Layout {
  const def = COMPACT_DEFAULTS[k];
  return {
    i: k,
    x,
    y,
    w: w ?? def.w,
    h: h ?? def.h,
    minW: def.minW,
    minH: def.minH,
    ...(def.maxH != null ? { maxH: def.maxH } : {}),
  };
}

// Dense shelf-packer. Places each widget at the lowest, leftmost free slot
// using the user's selected size (S/M/L/XXL). Visited in PERSONA_WIDGETS
// order so the persona's priorities get prime real estate. Guaranteed
// gap-free (no asymmetric whitespace) for any subset of widgets.
function packLayout(
  persona: Persona,
  visibleWidgets: WidgetState[],
  widgetSizes: Record<WidgetKey, WidgetSize>,
): Layout[] {
  const COLS = 12;
  const visibleSet = new Set(visibleWidgets.map(w => w.key));

  // Order: persona's priority list first (filtered to visible),
  // then any visible extras not in the priority list.
  const ordered: WidgetKey[] = [];
  for (const k of PERSONA_WIDGETS[persona]) {
    if (visibleSet.has(k)) ordered.push(k);
  }
  for (const w of visibleWidgets) {
    if (!ordered.includes(w.key)) ordered.push(w.key);
  }

  const result: Layout[] = [];
  for (const k of ordered) {
    const size = widgetSizes[k] ?? 'medium';
    const spec = WIDGET_SIZES[k]?.[size];
    const def = COMPACT_DEFAULTS[k];
    const w = spec?.w ?? def.w;
    const h = spec?.h ?? def.h;

    // Lowest+leftmost free slot.
    let bestY = Infinity;
    let bestX = 0;
    for (let x = 0; x + w <= COLS; x++) {
      let y = 0;
      for (const item of result) {
        if (item.x < x + w && x < item.x + item.w) {
          y = Math.max(y, item.y + item.h);
        }
      }
      if (y < bestY || (y === bestY && x < bestX)) {
        bestY = y;
        bestX = x;
      }
    }
    result.push(buildLayoutItem(k, bestX, bestY, w, h));
  }
  return result;
}

// Always use the priority-ordered packer — it places widgets gap-free in
// PERSONA_WIDGETS order using the user's selected sizes, regardless of
// which subset is visible. Replaces the older PERSONA_LAYOUTS / FULL_LAYOUT
// branches which were size-specific and didn't react to size changes.
function defaultCompactLayout(
  persona: Persona,
  visibleWidgets: WidgetState[],
  widgetSizes: Record<WidgetKey, WidgetSize>,
): Layout[] {
  return packLayout(persona, visibleWidgets, widgetSizes);
}

function CompactLayout({
  visibleWidgets, sectionFor, editMode, onExitEdit, persona, widgetSizes,
}: LayoutProps & { editMode: boolean; onExitEdit: () => void; persona: Persona; widgetSizes: Record<WidgetKey, WidgetSize> }) {
  const CompactGrid = useMemo(() => resolveGrid(), []);

  const [layout, setLayout] = useState<Layout[]>(() => {
    const saved = loadCompactLayout(persona);
    if (saved) return saved;
    return defaultCompactLayout(persona, visibleWidgets, widgetSizes);
  });

  // Persona switch: rebuild from priority-packed defaults.
  useEffect(() => {
    const saved = loadCompactLayout(persona);
    setLayout(saved ?? defaultCompactLayout(persona, visibleWidgets, widgetSizes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona]);

  // Visible widget set changes (toggle in Add Widget) — re-pack from defaults.
  useEffect(() => {
    setLayout(defaultCompactLayout(persona, visibleWidgets, widgetSizes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleWidgets, persona]);

  // When per-widget size selections change, override w/h on each tile.
  // Position (x, y) is preserved; rgl re-flows on collision.
  useEffect(() => {
    setLayout(prev => prev.map(item => {
      const size = widgetSizes[item.i as WidgetKey];
      if (!size) return item;
      const spec = WIDGET_SIZES[item.i as WidgetKey]?.[size];
      if (!spec) return item;
      return { ...item, w: spec.w, h: spec.h };
    }));
  }, [widgetSizes]);

  const persist = (next: Layout[]) => {
    const enforced = enforceMins(next);
    setLayout(enforced);
    try { localStorage.setItem(compactLayoutKeyFor(persona), JSON.stringify(enforced)); } catch { /* ignore */ }
  };

  const reset = () => {
    const fresh = defaultCompactLayout(persona, visibleWidgets, widgetSizes);
    persist(fresh);
  };

  if (!CompactGrid) {
    return (
      <div className="rounded-2xl border border-dashed border-canvas-border bg-canvas-elevated/50 p-10 text-center">
        <p className="text-sm text-ink-700 font-medium">Compact layout unavailable</p>
        <p className="text-[12.5px] text-ink-500 mt-1">
          react-grid-layout couldn&rsquo;t initialize (likely a v1/v2 API mismatch).
        </p>
      </div>
    );
  }

  return (
    <div className={editMode ? 'home-edit-mode' : ''}>
      {editMode && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/40 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[12.5px] text-brand-800">
            <GripVertical size={14} className="text-brand-600" />
            <span>Drag any tile to reposition. Drag the bottom-right corner to resize.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              className="text-xs font-medium text-ink-600 hover:text-brand-700 cursor-pointer px-2 h-7"
            >
              Reset layout
            </button>
            <button
              onClick={onExitEdit}
              className="inline-flex items-center h-7 px-3 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
      <CompactGrid
        className="layout"
        layouts={{ lg: layout, md: layout, sm: layout, xs: layout, xxs: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 8, xs: 4, xxs: 2 }}
        rowHeight={48}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={editMode}
        isResizable={editMode}
        onLayoutChange={persist}
        compactType="vertical"
        preventCollision={true}
      >
        {visibleWidgets.map(w => (
          <div key={w.key} className="h-full overflow-hidden">
            {sectionFor(w.key)}
          </div>
        ))}
      </CompactGrid>
    </div>
  );
}

export default function HomeView({
  setView, notifications, onSelectNotification, onOpenNotificationDrawer, setChatInitialQuery, setSelectedWorkflow, openAuditExecution, setSelectedBP, onLaunchWorkflowBuilder,
}: Props) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1');

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const saved = (typeof window !== 'undefined' && window.localStorage.getItem(DATE_RANGE_KEY)) as DateRange | null;
    if (saved && DATE_RANGE_OPTIONS.some(o => o.id === saved)) return saved;
    // Auditors land on Quarterly by default — they review in fiscal quarter
    // cycles, not rolling 30-day windows. Other personas keep the 30d default.
    return loadPersona() === 'auditor' ? 'qtd' : '30d';
  });

  useEffect(() => {
    try { localStorage.setItem(DATE_RANGE_KEY, dateRange); } catch { /* ignore */ }
  }, [dateRange]);

  const [customRange, setCustomRange] = useState<CustomRange | null>(loadCustomRange);
  useEffect(() => {
    try {
      if (customRange) localStorage.setItem(DATE_RANGE_CUSTOM_KEY, JSON.stringify(customRange));
      else localStorage.removeItem(DATE_RANGE_CUSTOM_KEY);
    } catch { /* ignore */ }
  }, [customRange]);

  // rangeDays drives every widget's data scaling. For 'ytd' it's days since
  // Jan 1; for 'custom' it's the span of the user-set range; for 'all' it's
  // null (no filter). For fixed-day options it's the option's `days` value.
  const rangeDays = useMemo(() => {
    if (dateRange === 'ytd') {
      const yearStart = new Date(HOME_TODAY.getFullYear(), 0, 1);
      return Math.max(1, Math.round((HOME_TODAY.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)));
    }
    if (dateRange === 'custom') {
      if (!customRange) return 30;
      const days = Math.round((new Date(customRange.to).getTime() - new Date(customRange.from).getTime()) / (24 * 60 * 60 * 1000));
      return Math.max(1, days);
    }
    return DATE_RANGE_OPTIONS.find(o => o.id === dateRange)?.days ?? null;
  }, [dateRange, customRange]);

  const [persona, setPersona] = useState<Persona>(loadPersona);
  useEffect(() => {
    try { localStorage.setItem(PERSONA_KEY, persona); } catch { /* ignore */ }
  }, [persona]);

  const [widgets, setWidgets] = useState<WidgetState[]>(() => loadWidgetsForPersona(loadPersona()));
  useEffect(() => {
    setWidgets(loadWidgetsForPersona(persona));
  }, [persona]);
  useEffect(() => {
    try { localStorage.setItem(widgetsKeyFor(persona), JSON.stringify(widgets)); } catch { /* ignore */ }
  }, [widgets, persona]);

  // Per-widget size preset (S/M/L/XXL), persona-scoped. Re-loaded on persona
  // switch so each persona keeps its own size preferences.
  const [widgetSizes, setWidgetSizes] = useState<Record<WidgetKey, WidgetSize>>(() => loadWidgetSizes(loadPersona()));
  useEffect(() => {
    setWidgetSizes(loadWidgetSizes(persona));
  }, [persona]);
  useEffect(() => {
    try { localStorage.setItem(widgetSizesKeyFor(persona), JSON.stringify(widgetSizes)); } catch { /* ignore */ }
  }, [widgetSizes, persona]);

  const [editMode, setEditMode] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorOrigin, setEditorOrigin] = useState<DOMRect | null>(null);
  const addWidgetBtnRef = useRef<HTMLButtonElement>(null);

  // Hero summary stats — same numbers the widgets below show, surfaced
  // inline in the subtitle so the "at a glance" line isn't decorative.
  const completionPct = useMemo(() => {
    const active = ENGAGEMENTS.filter(e => e.status === 'active');
    const planned = active.reduce((s, e) => s + e.controls, 0);
    const executed = active.reduce((s, e) => s + e.tested, 0);
    if (planned === 0) return 0;
    const scaled = Math.round(executed * scaleForRange(rangeDays));
    return Math.round((scaled / planned) * 100);
  }, [rangeDays]);
  const queueCount = useMemo(() => {
    const all = buildWorkQueue();
    if (rangeDays == null) return all.length;
    const ms = rangeDays * 24 * 60 * 60 * 1000;
    return all.filter(it => Math.abs(it.dueDate.getTime() - HOME_TODAY.getTime()) <= ms).length;
  }, [rangeDays]);
  const unreadCount = useMemo(() => {
    if (rangeDays == null) return notifications.filter(n => !n.read).length;
    const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    return notifications.filter(n => !n.read && new Date(n.createdAt).getTime() >= cutoff).length;
  }, [notifications, rangeDays]);
  // Control Breaks count — all unresolved deficiencies, surfaced as an
  // inline alert pill in the hero subhead. Replaces the prior "Material
  // Weakness" chip so the signal generalises across deficiency severities,
  // not just MW.
  const breakCount = useMemo(() => {
    const unresolved = DEFICIENCIES.filter(d => d.status !== 'resolved');
    return Math.round(unresolved.length * scaleForRange(rangeDays));
  }, [rangeDays]);

  // Always reads the button's *current* rect — so the open animation expands
  // from where the button is now, and the close animation flies back to the
  // same button (which may have shifted if the user scrolled in the meantime).
  const captureOrigin = () => {
    if (addWidgetBtnRef.current) {
      setEditorOrigin(addWidgetBtnRef.current.getBoundingClientRect());
    }
  };
  const openEditor = () => { captureOrigin(); setEditorOpen(true); };
  const closeEditor = () => { captureOrigin(); setEditorOpen(false); };
  const toggleEditor = () => editorOpen ? closeEditor() : openEditor();

  // Shared pinned-items store — read by Pinned widget and the inline pin
  // buttons in TopWorkflows / RecentReports rows.
  const pinnedStore = usePinned();

  // Brief skeleton flash on persona / date-range switches so the transition
  // feels intentional instead of snapping. ~280ms is just long enough to
  // perceive without making the UI feel sluggish.
  const isTransitioning = useTransitionPulse([persona, rangeDays], 280);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
  };

  const toggleWidget = (key: WidgetKey) => {
    setWidgets(prev => prev.map(w => w.key === key ? { ...w, visible: !w.visible } : w));
  };

  const sectionFor = (key: WidgetKey) => {
    switch (key) {
      case 'activity': return (
        <PlatformActivitySection
          notifications={notifications}
          onSelect={onSelectNotification}
          onOpenDrawer={onOpenNotificationDrawer}
          rangeDays={rangeDays}
        />
      );
      case 'queue':   return <WorkQueueSection setView={setView} rangeDays={rangeDays} />;
      case 'health':  return <HealthDashboardSection setView={setView} rangeDays={rangeDays} dateRangeId={dateRange} onRemove={() => toggleWidget('health')} setSelectedWorkflow={setSelectedWorkflow} isPinned={pinnedStore.isPinned} togglePin={pinnedStore.toggle} />;
      case 'shared':  return <RecentSharedSection setView={setView} rangeDays={rangeDays} />;
      case 'recents': return (
        <RecentAskIraSection setView={setView} setChatInitialQuery={setChatInitialQuery} rangeDays={rangeDays} />
      );
      case 'engagements':   return <ActiveEngagementsSection setView={setView} rangeDays={rangeDays} openAuditExecution={openAuditExecution} />;
      case 'exceptions':    return <OpenExceptionsSection setView={setView} rangeDays={rangeDays} />;
      case 'workflows':     return <TopWorkflowsSection setView={setView} rangeDays={rangeDays} setSelectedWorkflow={setSelectedWorkflow} />;
      case 'sources':       return <ConnectedSourcesSection setView={setView} rangeDays={rangeDays} />;
      case 'processes':     return <BusinessProcessesSection setView={setView} rangeDays={rangeDays} setSelectedBP={setSelectedBP} />;
      case 'reports-list':  return <RecentReportsSection setView={setView} rangeDays={rangeDays} isPinned={pinnedStore.isPinned} togglePin={pinnedStore.toggle} />;
      case 'concierge':     return <ConciergeSection setView={setView} rangeDays={rangeDays} onLaunchWorkflowBuilder={onLaunchWorkflowBuilder} />;
      case 'calendar':      return <AuditCalendarSection setView={setView} rangeDays={rangeDays} openAuditExecution={openAuditExecution} />;
      case 'pinned':        return <PinnedSection setView={setView} setSelectedWorkflow={setSelectedWorkflow} openAuditExecution={openAuditExecution} pinned={pinnedStore.pinned} isPinned={pinnedStore.isPinned} toggle={pinnedStore.toggle} />;
    }
  };

  const visibleWidgets = widgets.filter(w => w.visible);

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      {/* Page header */}
      <div className="border-b border-canvas-border bg-canvas-elevated relative overflow-hidden">
        {/* Ambient brand glow — top-right radial. The single premium move that
            separates "designed" from "wireframe" without adding visual noise. */}
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: -120, right: -160, width: 720, height: 720,
            background: 'radial-gradient(circle, rgba(136,56,222,0.22) 0%, rgba(136,56,222,0.10) 30%, transparent 65%)',
            filter: 'blur(40px)',
          }}
        />
        {/* Cooler analog at bottom-left for depth. Layering creates the
            "ambient mesh" feeling without heavy gradients. */}
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            bottom: -180, left: -140, width: 520, height: 520,
            background: 'radial-gradient(circle, rgba(136,56,222,0.14) 0%, rgba(136,56,222,0.05) 35%, transparent 65%)',
            filter: 'blur(48px)',
          }}
        />
        <div className="p-8">
          <div className="flex items-end justify-between gap-6">
            <div className="min-w-0 flex-1">
              {(() => {
                // Greeting follows India Standard Time (Asia/Kolkata).
                // hourCycle: 'h23' avoids the en-US `hour12: false` bug where
                // midnight returns "24" instead of "00".
                const h = Number(new Intl.DateTimeFormat('en-US', {
                  timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23',
                }).format(new Date()));
                const greeting =
                  h >= 5  && h < 12 ? 'Good morning,'   :
                  h >= 12 && h < 17 ? 'Good afternoon,' :
                  h >= 17 && h < 21 ? 'Good evening,'   :
                                      'Good night,'; // 21:00 – 04:59 IST
                const greetingWords = greeting.split(' ');
                const nameWords = ['Kapil', 'Arora'];
                // Word-level cascade: each word lifts + un-blurs in sequence.
                // Stagger and easing match the rest of the section's motion
                // language (subtle premium, no overshoot).
                // Character-by-character cascade. Each letter fades in and
                // lifts a few px in sequence. Word boundaries preserved by
                // wrapping characters of the same word in an inline-block so
                // they wrap as a unit on narrow screens. Per-character delay
                // is computed from a running index for a clean global stagger.
                const gradientStyle: React.CSSProperties = {
                  backgroundImage: 'linear-gradient(110deg, var(--color-brand-600), var(--color-brand-500))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                };
                type Seg = { word: string; styled: 'gradient' | 'name' };
                const segments: Seg[] = [
                  ...greetingWords.map(w => ({ word: w, styled: 'gradient' as const })),
                  ...nameWords.map(w => ({ word: w, styled: 'name' as const })),
                ];
                const STEP = 0.035;       // 35ms between letters
                const HEAD = 0.18;        // initial delay before first letter
                const DURATION = 0.55;    // per-letter motion duration
                let charIndex = 0;
                return (
                  <h1
                    className="text-[40px] leading-[1.1] mb-2 flex flex-wrap"
                    style={{ columnGap: '0.28em' }}
                  >
                    {segments.map((seg, si) => (
                      <span
                        key={si}
                        className={`inline-block ${seg.styled === 'gradient' ? 'font-extrabold' : 'font-[420] text-ink-900'}`}
                      >
                        {Array.from(seg.word).map(char => {
                          const ci = charIndex++;
                          // Gradient must live on each character — background-clip:text
                          // doesn't propagate through inline-block children. For
                          // short greetings (≤12 chars) the gradient direction looks
                          // continuous across the word visually.
                          const charStyle: React.CSSProperties = {
                            willChange: 'transform, opacity',
                            ...(seg.styled === 'gradient' ? gradientStyle : {}),
                          };
                          return (
                            <motion.span
                              key={ci}
                              className="inline-block"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: DURATION, delay: HEAD + ci * STEP, ease: [0.16, 1, 0.3, 1] }}
                              style={charStyle}
                            >
                              {char}
                            </motion.span>
                          );
                        })}
                      </span>
                    ))}
                  </h1>
                );
              })()}
              <motion.div
                variants={HERO_TAIL_CONTAINER_VARIANTS}
                initial="hidden"
                animate="show"
              >
              <motion.div variants={HERO_CHILD_VARIANTS} className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1 flex flex-col gap-2.5">
                  <p className="text-sm text-ink-500 leading-relaxed">
                    Here&rsquo;s your <span className="font-semibold text-ink-800">{
                      dateRange === 'all'    ? 'FY26' :
                      dateRange === 'qtd'    ? 'quarterly' :
                      dateRange === 'ytd'    ? 'year-to-date' :
                      dateRange === 'custom' ? 'custom range' :
                      `last ${rangeDays} days`
                    }</span> audit landscape at a glance.
                  </p>
                  {/* Stat strip — tabular-num pill chips replace the inline `·` wall.
                      Order mirrors the operational priority: progress → queue → inbox → role. */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-baseline gap-1.5 px-2 py-0.5 rounded-full border border-canvas-border bg-canvas-elevated text-xs">
                      <span className="font-semibold tabular-nums text-ink-800"><CountUp value={completionPct} />%</span>
                      <span className="text-ink-500">executed</span>
                    </span>
                    <span className="inline-flex items-baseline gap-1.5 px-2 py-0.5 rounded-full border border-canvas-border bg-canvas-elevated text-xs">
                      <span className="font-semibold tabular-nums text-ink-800"><CountUp value={queueCount} /></span>
                      <span className="text-ink-500">in queue</span>
                    </span>
                    <span className="inline-flex items-baseline gap-1.5 px-2 py-0.5 rounded-full border border-canvas-border bg-canvas-elevated text-xs">
                      <span className="font-semibold tabular-nums text-ink-800"><CountUp value={unreadCount} /></span>
                      <span className="text-ink-500">unread</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-canvas-border bg-canvas-elevated text-xs">
                      <span className="font-semibold text-ink-800">{PERSONAS.find(p => p.id === persona)?.label ?? 'Internal Auditor'}</span>
                    </span>
                    {breakCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          // Deep-link into Control Library at a specific
                          // control detail page. ControlLibraryView consumes
                          // this flag on mount.
                          sessionStorage.setItem('control-library.open-control-id', 'C-001');
                          setView('governance-controls');
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-risk-50 text-risk-700 border border-risk-200 hover:bg-risk-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-risk-400"
                      >
                        <AlertOctagon size={11} strokeWidth={2.5} />
                        <span className="tabular-nums">{breakCount}</span>
                        Control Break{breakCount === 1 ? '' : 's'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <DateRangeDropdown
                    value={dateRange}
                    onChange={setDateRange}
                    customRange={customRange}
                    setCustomRange={setCustomRange}
                  />
                  <PersonaDropdown persona={persona} onChange={setPersona} />
                </div>
              </motion.div>
              <motion.div variants={HERO_CHILD_VARIANTS} className="flex items-center gap-2 mt-4 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-500 shrink-0">
                  <Sparkles size={13} className="text-brand-400" />
                  Try
                </span>
                {HERO_PROMPTS.map((prompt, i) => (
                  <motion.button
                    key={prompt}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 + i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -1 }}
                    onClick={() => { setChatInitialQuery(prompt); setView('chat'); }}
                    className="inline-flex items-center h-7 px-3 rounded-full border border-canvas-border bg-canvas-elevated text-xs text-ink-700 hover:border-brand-200 hover:text-brand-700 hover:bg-brand-50/60 transition-colors cursor-pointer"
                  >
                    &ldquo;{prompt}&rdquo;
                  </motion.button>
                ))}
              </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-8 flex flex-col gap-6 min-h-[calc(100vh-220px)]">
        {!dismissed && <QuickActionPanel setView={setView} onDismiss={dismiss} />}
        {/* Slim toolbar row above widgets — onboarding restore + Customize layout entry point.
            Persona switcher lives in the hero (next to the date pill) per production-ready UX:
            role is set by the user's profile, not browsed in-page. */}
        {(dismissed || (!editMode && visibleWidgets.length > 0)) && (
          <div className="flex items-center justify-between gap-3">
            {dismissed ? (
              <button
                onClick={() => { setDismissed(false); localStorage.removeItem(ONBOARDING_DISMISSED_KEY); }}
                className="inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-brand-700 transition-colors cursor-pointer"
              >
                <Plus size={12} />
                Restore onboarding
              </button>
            ) : <span />}
            {!editMode && visibleWidgets.length > 0 && (
              <button
                onClick={() => setEditMode(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-canvas-border bg-canvas-elevated hover:border-brand-200 hover:text-brand-700 text-[12.5px] font-medium text-ink-700 transition-colors cursor-pointer"
              >
                <GripVertical size={13} />
                Customize layout
              </button>
            )}
          </div>
        )}

        {visibleWidgets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-canvas-border bg-canvas-elevated/50 p-10 text-center">
            <p className="text-sm text-ink-700 font-medium">No widgets enabled</p>
            <p className="text-[12.5px] text-ink-500 mt-1">Use the &ldquo;Add widget&rdquo; button below to bring widgets back.</p>
          </div>
        ) : isTransitioning ? (
          <div className="grid grid-cols-12 gap-5">
            {visibleWidgets.slice(0, 6).map(w => (
              <div key={w.key} className="col-span-12 md:col-span-6 lg:col-span-4 h-[280px]">
                <WidgetSkeleton />
              </div>
            ))}
          </div>
        ) : (
          <CompactLayout
            visibleWidgets={visibleWidgets}
            sectionFor={sectionFor}
            editMode={editMode}
            onExitEdit={() => setEditMode(false)}
            persona={persona}
            widgetSizes={widgetSizes}
          />
        )}

        <div className="mt-auto flex justify-center pt-2 pb-4">
          <motion.button
            ref={addWidgetBtnRef}
            onClick={toggleEditor}
            aria-expanded={editorOpen}
            aria-hidden={editorOpen}
            tabIndex={editorOpen ? -1 : 0}
            whileHover={{ y: editorOpen ? 0 : -1 }}
            whileTap={{ scale: editorOpen ? 1 : 0.97 }}
            animate={{ opacity: editorOpen ? 0 : 1 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-30 inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-full text-[13.5px] font-semibold transition-[background-color,border-color,color,box-shadow] duration-200 bg-canvas-elevated border border-dashed border-brand-200 text-brand-600 hover:bg-brand-50 hover:border-brand-300 shadow-[0_2px_8px_rgb(15_8_30_/_0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
              editorOpen ? 'pointer-events-none' : 'cursor-pointer'
            }`}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Add widget</span>
            <span className="text-[11.5px] font-medium tabular-nums text-ink-400">
              {widgets.filter(w => w.visible).length}/{widgets.length}
            </span>
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {editorOpen && (
          <AddWidgetModal
            widgets={widgets}
            onToggle={toggleWidget}
            onClose={closeEditor}
            originRect={editorOrigin}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
