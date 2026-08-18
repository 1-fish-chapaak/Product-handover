import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Tag,
  ClipboardList,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  BarChart3,
  CircleDashed,
  CheckCircle2,
  Loader2,
  XOctagon,
  FolderOpen,
  GitBranch,
  Inbox,
} from 'lucide-react';
import { useWorkflow } from './workflow/WorkflowContext';
import { canAct } from './workflow/workflowEngine';
import {
  GRC_CASE_DETAILS,
  type GrcException,
  type GrcExceptionClassification,
} from '../../data/mockData';
import {
  deriveStatus,
  requiresActionPlan,
  combineActionReview,
  type CombinedActionReview,
  type ExceptionActionKind,
} from './statusModel';
import ExceptionStatusTracker from './ExceptionStatusTracker';
import ExceptionListDrawer from './ExceptionListDrawer';
import ExceptionDetailDrawer from './ExceptionDetailDrawer';

// ── Live derivations from the exceptions table (single source of truth) ──
// A management action plan is identified by its Actionable ID — cases classified
// together in one bulk action share a single plan. So the plan-stage counts are
// measured per distinct Actionable ID (the plan), not per exception. Actionable
// cases that somehow lack an ID fall back to their own id so they still count once.
const planKey = (ex: GrcException) => ex.actionableId ?? ex.id;
const actionStatusOf = (ex: GrcException) => GRC_CASE_DETAILS[ex.id]?.actionStatus ?? 'Pending';
const completionOf = (ex: GrcException) => GRC_CASE_DETAILS[ex.id]?.completion;
const combinedOf = (ex: GrcException): CombinedActionReview => combineActionReview(ex.actionReview, actionStatusOf(ex), ex.classification);
const statusOf = (ex: GrcException) => ex.status ?? deriveStatus(ex.classification, ex.actionReview, actionStatusOf(ex));

const isClassified = (ex: GrcException) => ex.classification !== 'Unclassified';
// Only Design/System Deficiency & Procedural Non-Compliance need a management action
// plan → the ATR pipeline (plan → action → review) runs over these alone. Business
// as Usual / False Positive are closed at classification and need no action plan.
const isActionable = (ex: GrcException) => isClassified(ex) && requiresActionPlan(ex.classification);
const hasActionPlan = isActionable; // an actionable, classified exception carries a management action plan
// "Action Taken" = the Risk Owner has actually SUBMITTED the completed action for
// the Auditor's review. The signal is the workflow reaching the completion stage —
// a real completion record, the case sitting in 'completion-review', or a completion
// the Auditor has already approved (Implemented / Partially Implemented). A stray
// actionStatus on a case still at 'plan-review' (RO hasn't submitted anything) must
// NOT qualify — that earlier check let plan-stage cases leak into this KPI.
const isActionTaken = (ex: GrcException) =>
  isActionable(ex) && (
    !!completionOf(ex) ||
    ex.actionPhase === 'completion-review' ||
    combinedOf(ex) === 'Approved (Implemented)' ||
    combinedOf(ex) === 'Approved (Partially Implemented)'
  );
// Auditor finished reviewing the action: a terminal decision and not sitting in an active phase.
const isReviewComplete = (ex: GrcException) => isActionable(ex) && ex.actionReview !== 'Pending' && !ex.actionPhase;
// "ATR-ready" = the exception has reached a terminal, Auditor-approved outcome that
// needs nothing further before the final ATR. Two shapes qualify:
//   • non-actionable dispositions (BAU / False Positive) approved at classification → 'Approved'
//   • actionable cases whose plan → action → review is fully signed off → 'Approved (Implemented)'
// Everything else holds the ATR back: Unclassified, anything still Pending, any
// Rejected / Discrepancy, and Approved (Partially Implemented) (not fully in place yet).
const isAtrReady = (ex: GrcException) =>
  isClassified(ex) && (
    combinedOf(ex) === 'Approved' ||
    combinedOf(ex) === 'Approved (Implemented)'
  );
const isOverdue = (ex: GrcException) => {
  if (ex.flags?.includes('Overdue')) return true;
  if (!ex.dueDate || statusOf(ex) === 'Closed') return false;
  const d = new Date(ex.dueDate + 'T23:59:59');
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
};

// Drill-down preset filters — evaluated against the LIVE exceptions.
const PRESETS: Record<string, { title: string; subtitle: string; filter: (ex: GrcException) => boolean }> = {
  total:          { title: 'All Exceptions',           subtitle: 'Every flagged exception in this case set',        filter: () => true },
  classified:     { title: 'Exceptions Classified',    subtitle: 'A Risk Owner has assigned a classification',      filter: isClassified },
  unclassified:   { title: 'Unclassified',             subtitle: 'Awaiting a Risk Owner classification',            filter: (ex) => !isClassified(ex) },
  actionPlan:     { title: 'Management Action Plan',   subtitle: 'Actionable cases (deficiencies & non-compliance) with a management action plan', filter: hasActionPlan },
  actionTaken:    { title: 'Action Taken',             subtitle: 'Actionable cases where the Risk Owner completed the action & added evidence', filter: isActionTaken },
  reviewComplete: { title: 'Auditor Review Complete',  subtitle: 'Actionable cases whose completed action the Auditor has reviewed', filter: isReviewComplete },
  open:           { title: 'Open',                     subtitle: 'No action yet, or reopened after a rejection',    filter: (ex) => statusOf(ex) === 'Open' },
  inProgress:     { title: 'In-Progress',              subtitle: 'Classified and moving through the review flow',   filter: (ex) => statusOf(ex) === 'Under Review' },
  closed:         { title: 'Closed',                   subtitle: 'Reviewed and resolved',                           filter: (ex) => statusOf(ex) === 'Closed' },
  pendingReview:  { title: 'Pending Auditor Review',   subtitle: 'Awaiting the Auditor — plan or completion review', filter: (ex) => isClassified(ex) && combinedOf(ex) === 'Pending' },
  implemented:    { title: 'Implemented',              subtitle: 'Approved and fully implemented',                  filter: (ex) => combinedOf(ex) === 'Approved (Implemented)' },
  partial:        { title: 'Partially Implemented',    subtitle: 'Approved but only partially in place',            filter: (ex) => combinedOf(ex) === 'Approved (Partially Implemented)' },
  discrepancy:    { title: 'Discrepancy',              subtitle: 'Rejected — reopened at the Risk Owner',           filter: (ex) => combinedOf(ex) === 'Rejected (Discrepancy)' },
  overdue:        { title: 'Overdue',                  subtitle: 'Past the action due date and not yet closed',     filter: isOverdue },
};

// Drill-downs that are about management action plans → segregate by Actionable ID
// (the plan), then deep dive into a case.
const ACTIONABLE_DRILLDOWNS = new Set(['actionPlan', 'actionTaken', 'reviewComplete', 'pendingReview', 'implemented', 'partial', 'discrepancy']);

// ── Shared UI atoms ──
export function CircularProgress({ pct, size = 64, stroke = 5, label }: { pct: number; size?: number; stroke?: number; label?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-canvas-border)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-brand-600)" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} style={{ transition: 'stroke-dasharray 500ms cubic-bezier(0.2,0,0,1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[0.8125rem] font-semibold text-brand-700 tabular-nums">{label ?? `${pct}%`}</div>
    </div>
  );
}

type Tone = 'brand' | 'evidence' | 'mitigated' | 'compliant' | 'risk' | 'ink';
const TONE: Record<Tone, { iconBg: string; icon: string; value: string; bar: string; ring: string }> = {
  brand:     { iconBg: 'bg-brand-100',     icon: 'text-brand-700',     value: 'text-brand-700',     bar: 'bg-brand-500',     ring: 'group-hover:border-brand-300' },
  evidence:  { iconBg: 'bg-evidence-50',   icon: 'text-evidence-700',  value: 'text-evidence-700',  bar: 'bg-evidence-500',  ring: 'group-hover:border-evidence-300' },
  mitigated: { iconBg: 'bg-mitigated-50',  icon: 'text-mitigated-700', value: 'text-mitigated-700', bar: 'bg-mitigated',     ring: 'group-hover:border-mitigated/40' },
  compliant: { iconBg: 'bg-compliant-50',  icon: 'text-compliant-700', value: 'text-compliant-700', bar: 'bg-compliant',     ring: 'group-hover:border-compliant/40' },
  risk:      { iconBg: 'bg-risk-50',       icon: 'text-risk-700',      value: 'text-risk-700',      bar: 'bg-risk',          ring: 'group-hover:border-risk/40' },
  ink:       { iconBg: 'bg-[#F4F2F7]',     icon: 'text-ink-600',       value: 'text-ink-900',       bar: 'bg-ink-400',       ring: 'group-hover:border-brand-300' },
};

// Journey stage tile (compact funnel step). `denom` is the meaningful baseline for
// this stage — the funnel narrows: total → classified → actionable → actionable.
function StageCard({ icon: Icon, label, sublabel, count, denom, tone, onClick }: {
  icon: React.ElementType; label: string; sublabel: string; count: number; denom: number; tone: Tone; onClick: () => void;
}) {
  const t = TONE[tone];
  const pct = denom > 0 ? Math.round((count / denom) * 100) : 0;
  return (
    <button onClick={onClick} title={`${label} — ${count} of ${denom} (${sublabel})`} className={`group text-left bg-canvas-elevated border border-canvas-border rounded-lg px-3.5 py-3 flex flex-col gap-2 cursor-pointer transition-colors ${t.ring}`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-md ${t.iconBg} ${t.icon} flex items-center justify-center shrink-0`}><Icon size={15} strokeWidth={1.9} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <span className={`text-[1.375rem] leading-none font-semibold tabular-nums ${t.value}`}>{count}</span>
            <span className="text-[0.6875rem] text-ink-400 tabular-nums">/ {denom}</span>
          </div>
        </div>
        <ArrowRight size={13} className="text-ink-300 group-hover:text-ink-600 group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
      <div className="text-[0.75rem] font-medium text-ink-700 leading-snug">{label}</div>
      <div className="text-[0.625rem] text-ink-400 leading-snug -mt-1">{sublabel}</div>
      <div className="h-[4px] rounded-full bg-canvas-border overflow-hidden">
        <div className={`h-full rounded-full ${t.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

// Compact KPI tile
function KpiTile({ icon: Icon, label, value, tone, onClick }: { icon: React.ElementType; label: string; value: number; tone: Tone; onClick: () => void }) {
  const t = TONE[tone];
  return (
    <button onClick={onClick} className={`group bg-canvas-elevated border border-canvas-border rounded-lg p-4 flex items-center gap-3.5 text-left cursor-pointer transition-colors ${t.ring}`}>
      <div className={`w-10 h-10 rounded-full ${t.iconBg} ${t.icon} flex items-center justify-center shrink-0`}><Icon size={17} strokeWidth={1.9} /></div>
      <div className="min-w-0 flex-1">
        <div className={`text-[1.5rem] leading-none font-semibold tabular-nums ${t.value}`}>{value}</div>
        <div className="text-[0.75rem] text-ink-500 mt-1 truncate">{label}</div>
      </div>
      <ArrowRight size={14} className="text-ink-300 group-hover:text-ink-600 shrink-0 transition-colors" />
    </button>
  );
}

function CollapsibleSection({ icon: Icon, title, subtitle, children }: { icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="bg-canvas-elevated border border-canvas-border rounded-lg overflow-hidden mb-5">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-5 py-4 cursor-pointer text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[#F4F2F7] text-ink-600 flex items-center justify-center"><Icon size={16} /></div>
          <div>
            <h3 className="text-[0.875rem] font-semibold text-ink-900">{title}</h3>
            {subtitle && <p className="text-[0.75rem] text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <ChevronDown size={16} className={`text-ink-500 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }} className="overflow-hidden">
            <div className="px-5 pb-5 border-t border-canvas-border pt-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const CLASS_HEX: Record<string, string> = {
  'Design Deficiency':         '#C2410C',
  'System Deficiency':         '#DC2626',
  'Procedural Non-Compliance': '#A366F0',
  'Others':                    '#B45309',
  'Business as Usual':         '#22C55E',
  'False Positive':            '#C2B9CB',
};
function ClassificationDonut({ rows, onSelect }: { rows: { label: string; count: number }[]; onSelect?: (label: string) => void }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const size = 180, stroke = 26, radius = (size - stroke) / 2, circ = 2 * Math.PI * radius;
  let offsetDeg = -90;
  return (
    <div className="flex items-center gap-8">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEEEF1" strokeWidth={stroke} />
          {total > 0 && rows.filter(r => r.count > 0).map((row) => {
            const pct = row.count / total;
            const dashLength = pct * circ;
            const seg = (
              <circle
                key={row.label}
                cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={CLASS_HEX[row.label] ?? '#C2B9CB'} strokeWidth={stroke}
                strokeDasharray={`${dashLength} ${circ - dashLength}`} strokeDashoffset={-(offsetDeg + 90) / 360 * circ}
                onClick={onSelect ? () => onSelect(row.label) : undefined}
                className={onSelect ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                style={{ transition: 'stroke-dasharray 400ms cubic-bezier(0.2,0,0,1)' }}
              >
                <title>{row.label} — {row.count}</title>
              </circle>
            );
            offsetDeg += pct * 360;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[1.625rem] leading-none font-semibold text-ink-900 tabular-nums">{total}</div>
          <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-500 mt-1">classified</div>
        </div>
      </div>
      <ul className="flex-1 space-y-1">
        {rows.map(row => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
          const clickable = !!onSelect && row.count > 0;
          return (
            <li key={row.label}>
              <button
                type="button"
                onClick={clickable ? () => onSelect!(row.label) : undefined}
                disabled={!clickable}
                className="group w-full flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-md text-left transition-colors enabled:cursor-pointer enabled:hover:bg-brand-50/40 disabled:opacity-60"
              >
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: CLASS_HEX[row.label] ?? '#C2B9CB' }} />
                <span className="flex-1 text-[0.75rem] font-medium text-ink-700 truncate">{row.label}</span>
                <span className="text-[0.75rem] font-semibold text-ink-900 tabular-nums w-6 text-right">{row.count}</span>
                <span className="text-[0.75rem] text-ink-500 tabular-nums w-10 text-right">{pct}%</span>
                <ChevronRight size={13} className={`text-brand-500 shrink-0 transition-opacity ${clickable ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'}`} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ActionHubView({ exceptions = [], role, onAction }: {
  exceptions?: GrcException[];
  /** Active persona — drives the deep-dive drawer's next actions (RBAC-aware). */
  role?: 'risk-owner' | 'auditor';
  /** Open the same action the Exceptions tab would (persists + logs activity). */
  onAction?: (kind: ExceptionActionKind, ex: GrcException) => void;
}) {
  // One surface at a time (auditor feedback, row 20): opening any drawer —
  // preset list, approval-route list, or the case deep-dive — closes the
  // others, so two sheets never sit stacked over the same exception.
  const [openPresetKey, setOpenPresetKey] = useState<string | null>(null);
  const [detailEx, setDetailExRaw] = useState<GrcException | null>(null);
  const openDrawer = useCallback((key: string) => {
    setWfDrawer(null);
    setDetailExRaw(null);
    setOpenPresetKey(key);
  }, []);
  const setDetailEx = useCallback((ex: GrcException | null) => {
    if (ex) { setOpenPresetKey(null); setWfDrawer(null); }
    setDetailExRaw(ex);
  }, []);

  // ── Approval-route journey — assignments delegated through an approval chain.
  // Drives the "Approval routes" KPI band; tiles open a filtered case list.
  const { assignments, currentUserId } = useWorkflow();
  const [wfDrawer, setWfDrawer] = useState<{ title: string; subtitle: string; exceptions: GrcException[] } | null>(null);
  const openWfDrawer = useCallback((d: { title: string; subtitle: string; exceptions: GrcException[] }) => {
    setOpenPresetKey(null);
    setDetailExRaw(null);
    setWfDrawer(d);
  }, []);
  const wf = useMemo(() => {
    const active = assignments.filter(a => a.status !== 'pulled-back');
    const byEx = (pred: (a: typeof active[number]) => boolean) => exceptions.filter(e => active.some(a => a.exceptionId === e.id && pred(a)));
    return {
      inRoute: byEx(() => true),
      awaitingApproval: byEx(a => a.status === 'in-approval'),
      myWork: byEx(a => (a.status === 'drafting' || a.status === 'rejected') && a.assigneeId === currentUserId),
      myApprovals: byEx(a => a.status === 'in-approval' && canAct(a, currentUserId).ok),
      approved: byEx(a => a.status === 'approved'),
    };
  }, [assignments, exceptions, currentUserId]);

  const m = useMemo(() => {
    const total = exceptions.length;
    const count = (f: (ex: GrcException) => boolean) => exceptions.filter(f).length;
    const classRows: { label: string; count: number }[] = (
      ['Design Deficiency', 'System Deficiency', 'Procedural Non-Compliance', 'Others', 'Business as Usual', 'False Positive'] as GrcExceptionClassification[]
    ).map(label => ({ label, count: count(ex => ex.classification === label) }));
    return {
      total,
      classified: count(isClassified),
      unclassified: count(ex => !isClassified(ex)),
      actionable: count(isActionable),
      actionPlan: count(hasActionPlan),
      actionTaken: count(isActionTaken),
      reviewComplete: count(isReviewComplete),
      // ATR gate — every exception (actionable or not) that has reached a terminal
      // Auditor-approved outcome. The final ATR is good to go only when this equals total.
      atrReady: count(isAtrReady),
      // Plan-level counts (distinct Actionable IDs) — the unit the ATR pipeline
      // is really measured in, since linked cases share one management action plan.
      planTotal: new Set(exceptions.filter(isActionable).map(planKey)).size,
      planActionTaken: new Set(exceptions.filter(isActionTaken).map(planKey)).size,
      planReviewComplete: new Set(exceptions.filter(isReviewComplete).map(planKey)).size,
      open: count(ex => statusOf(ex) === 'Open'),
      inProgress: count(ex => statusOf(ex) === 'Under Review'),
      closed: count(ex => statusOf(ex) === 'Closed'),
      pendingReview: count(ex => isClassified(ex) && combinedOf(ex) === 'Pending'),
      implemented: count(ex => combinedOf(ex) === 'Approved (Implemented)'),
      partial: count(ex => combinedOf(ex) === 'Approved (Partially Implemented)'),
      discrepancy: count(ex => combinedOf(ex) === 'Rejected (Discrepancy)'),
      overdue: count(isOverdue),
      classRows,
    };
  }, [exceptions]);

  // A preset key, or a classification label (from the breakdown) → on-the-fly filter.
  const openPreset = openPresetKey
    ? (PRESETS[openPresetKey] ?? { title: openPresetKey, subtitle: `Exceptions classified as ${openPresetKey}`, filter: (ex: GrcException) => ex.classification === openPresetKey })
    : null;
  const presetExceptions = useMemo(
    () => (openPreset ? exceptions.filter(openPreset.filter) : []),
    [openPreset, exceptions],
  );

  // ATR readiness is gated on EVERY exception reaching a terminal, Auditor-approved
  // outcome — all classified, and each one either Approved (non-actionable) or
  // Approved (Implemented) (actionable). Partially Implemented, anything still Pending,
  // any Rejected / Discrepancy, or Unclassified holds the ATR back. Good to go only
  // when every exception clears.
  const readinessPct = m.total > 0
    ? Math.round((m.atrReady / m.total) * 100)
    : 0;
  const atrGoodToGo = m.total > 0 && m.atrReady === m.total;

  // Funnel narrows: of all exceptions → classified → management action plans →
  // action taken → reviewed. The plan stages count distinct Actionable IDs (plans),
  // not exceptions, since linked cases share one plan.
  const stages = [
    { key: 'classified',     icon: Tag,           label: 'Exceptions Classified',   sublabel: 'of all exceptions',          count: m.classified,        denom: m.total,      tone: 'brand' as Tone },
    { key: 'actionPlan',     icon: ClipboardList, label: 'Management Action Plan',   sublabel: 'action plans created',       count: m.planTotal,         denom: m.planTotal,  tone: 'evidence' as Tone },
    { key: 'actionTaken',    icon: Wrench,        label: 'Action Taken',            sublabel: 'of action plans',            count: m.planActionTaken,   denom: m.planTotal,  tone: 'mitigated' as Tone },
    { key: 'reviewComplete', icon: ShieldCheck,   label: 'Auditor Review Complete', sublabel: 'of action plans',            count: m.planReviewComplete, denom: m.planTotal, tone: 'compliant' as Tone },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex-1 overflow-auto">
      <div className="px-8 py-6 max-w-[1600px] mx-auto">

        {/* ── ATR Readiness — the journey toward issuing the Audit-to-Record ── */}
        <section className="mb-5 rounded-lg border border-canvas-border bg-gradient-to-br from-brand-50/50 via-canvas-elevated to-canvas-elevated px-5 py-4">
          <div className="flex items-center gap-3.5 mb-4">
            <CircularProgress pct={readinessPct} size={52} stroke={5} label={m.total > 0 ? <span className="text-[0.8125rem] font-bold tabular-nums">{m.atrReady}/{m.total}</span> : <span className="text-[0.75rem] font-semibold text-ink-400">—</span>} />
            <div className="min-w-0">
              <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-none">ATR Readiness</h2>
              <p className="text-[0.75rem] text-ink-500 mt-1 leading-snug">
                {m.total === 0
                  ? <>No open exceptions yet — as cases arrive, classify and close each one to build a clean, audit-ready file.</>
                  : atrGoodToGo
                    ? <>Every case closed and Auditor-approved — the file is airtight and your ATR tells the full story. Issue it with confidence.</>
                    : <>{m.atrReady} of {m.total} case{m.total === 1 ? '' : 's'} closed · {m.total - m.atrReady} to go. You can issue the ATR anytime from the live statuses — but every case you drive to a final Auditor sign-off makes the report tighter and the story stronger.</>}
              </p>
            </div>
          </div>

          {/* Journey funnel — Classify → Management Action Plan → Action Taken → Auditor Review */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch gap-2.5">
            {stages.map((st, i) => (
              <div key={st.key} className="contents">
                <StageCard icon={st.icon} label={st.label} sublabel={st.sublabel} count={st.count} denom={st.denom} tone={st.tone} onClick={() => openDrawer(st.key)} />
                {i < stages.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center text-ink-300"><ChevronRight size={16} /></div>
                )}
              </div>
            ))}
          </div>

          {/* Self-explanatory note on the pipeline + the BAU/False Positive carve-out */}
          <p className="text-[0.6875rem] text-ink-500 mt-3 leading-snug">
            A Management Action Plan, the Action Taken, and the Auditor's review are required to issue an ATR — and apply only to <span className="font-medium text-ink-700">Design / System Deficiency</span> and <span className="font-medium text-ink-700">Procedural Non-Compliance</span>. <span className="font-medium text-ink-700">Business as Usual</span> and <span className="font-medium text-ink-700">False Positive</span> are closed at classification and need no action plan.
          </p>
        </section>

        {/* ── Overdue strip ── */}
        {m.overdue > 0 && (
          <button onClick={() => openDrawer('overdue')} className="group w-full flex items-stretch mb-5 text-left cursor-pointer rounded-lg bg-canvas-elevated border border-canvas-border hover:border-risk/30 transition-colors overflow-hidden">
            <div className="w-[3px] bg-risk shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0 flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-risk-50 text-risk flex items-center justify-center shrink-0"><AlertTriangle size={16} strokeWidth={1.75} /></div>
              <div className="flex-1 min-w-0">
                <span className="text-[0.8125rem] text-ink-900 font-semibold">{m.overdue} overdue {m.overdue === 1 ? 'case needs' : 'cases need'} attention</span>
                <p className="text-[0.75rem] text-ink-500 mt-0.5">Past the action due date and not yet closed — review and follow up.</p>
              </div>
              <ArrowRight size={16} className="text-ink-500 shrink-0 group-hover:translate-x-0.5 transition-all" />
            </div>
          </button>
        )}

        {/* ── Lifecycle status — Open / In-Progress / Closed ── */}
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[0.75rem] uppercase tracking-[0.14em] text-ink-500 font-medium">Lifecycle status</span>
          <span className="text-[0.6875rem] text-ink-400">· tap a tile to see the cases</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <KpiTile icon={FolderOpen}    label="Open"        value={m.open}        tone="ink"       onClick={() => openDrawer('open')} />
          <KpiTile icon={Loader2}       label="In-Progress" value={m.inProgress}  tone="mitigated" onClick={() => openDrawer('inProgress')} />
          <KpiTile icon={CheckCircle2}  label="Closed"      value={m.closed}      tone="compliant" onClick={() => openDrawer('closed')} />
          <KpiTile icon={CircleDashed}  label="Unclassified" value={m.unclassified} tone="ink"      onClick={() => openDrawer('unclassified')} />
        </div>

        {/* ── Auditor review outcomes ── */}
        <div className="mb-2">
          <span className="text-[0.75rem] uppercase tracking-[0.14em] text-ink-500 font-medium">Auditor review outcomes</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <KpiTile icon={CircleDashed}  label="Pending review"        value={m.pendingReview} tone="mitigated" onClick={() => openDrawer('pendingReview')} />
          <KpiTile icon={CheckCircle2}  label="Implemented"           value={m.implemented}   tone="compliant" onClick={() => openDrawer('implemented')} />
          <KpiTile icon={Loader2}       label="Partially Implemented" value={m.partial}       tone="brand"     onClick={() => openDrawer('partial')} />
          <KpiTile icon={XOctagon}      label="Discrepancy"           value={m.discrepancy}   tone="risk"      onClick={() => openDrawer('discrepancy')} />
        </div>

        {/* ── Approval routes — delegated work moving through an approval chain ── */}
        {wf.inRoute.length > 0 && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[0.75rem] uppercase tracking-[0.14em] text-ink-500 font-medium">Approval routes</span>
              <span className="text-[0.6875rem] text-ink-400">· where delegated work sits · tap a tile to see the cases</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <KpiTile icon={GitBranch}   label="In approval route"     value={wf.inRoute.length}          tone="brand"     onClick={() => openWfDrawer({ title: 'In approval route', subtitle: 'Delegated through an approval chain', exceptions: wf.inRoute })} />
              <KpiTile icon={Inbox}       label="Awaiting approval"     value={wf.awaitingApproval.length} tone="mitigated" onClick={() => openWfDrawer({ title: 'Awaiting approval', subtitle: 'Submitted and moving through approvers', exceptions: wf.awaitingApproval })} />
              <KpiTile icon={Wrench}      label="My work pending"       value={wf.myWork.length}           tone="evidence"  onClick={() => openWfDrawer({ title: 'My work pending', subtitle: 'Assigned to you — draft and submit', exceptions: wf.myWork })} />
              <KpiTile icon={ShieldCheck} label="Awaiting my approval"  value={wf.myApprovals.length}      tone="risk"      onClick={() => openWfDrawer({ title: 'Awaiting my approval', subtitle: 'Pending your decision', exceptions: wf.myApprovals })} />
            </div>
          </>
        )}

        {/* ── Classification breakdown ── */}
        {m.classified > 0 && (
          <CollapsibleSection icon={BarChart3} title="Classification Breakdown" subtitle={`${m.classified} classified · ${m.unclassified} unclassified · tap a type to see the cases`}>
            <ClassificationDonut rows={m.classRows} onSelect={openDrawer} />
          </CollapsibleSection>
        )}

        {/* ── Per-case status & journey detail ── */}
        <ExceptionStatusTracker exceptions={exceptions} role={role} onAction={onAction} />
      </div>

      {/* Approval-route case list (from the Approval routes KPI band) */}
      <AnimatePresence>
        {wfDrawer && (
          <ExceptionListDrawer
            key="wf-drawer"
            title={wfDrawer.title}
            subtitle={wfDrawer.subtitle}
            exceptions={wfDrawer.exceptions}
            onClose={() => setWfDrawer(null)}
            onSelectException={setDetailEx}
            role={role}
            onAction={(kind, ex) => { setWfDrawer(null); onAction?.(kind, ex); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openPreset && (
          <ExceptionListDrawer
            key={openPresetKey ?? 'preset'}
            title={openPreset.title}
            subtitle={openPreset.subtitle}
            exceptions={presetExceptions}
            onClose={() => setOpenPresetKey(null)}
            onSelectException={setDetailEx}
            groupByActionable={openPresetKey ? ACTIONABLE_DRILLDOWNS.has(openPresetKey) : false}
            role={role}
            onAction={(kind, ex) => { setOpenPresetKey(null); onAction?.(kind, ex); }}
          />
        )}
      </AnimatePresence>

      {/* Deep-dive — full action-plan / case detail stacked over the list */}
      <AnimatePresence>
        {detailEx && (
          <ExceptionDetailDrawer
            key={detailEx.id}
            exception={detailEx}
            role={role}
            linkedExceptions={detailEx.actionableId ? exceptions.filter(e => e.actionableId === detailEx.actionableId) : [detailEx]}
            onSelectLinked={setDetailEx}
            onAction={(kind, ex) => { setDetailEx(null); onAction?.(kind, ex); }}
            onClose={() => setDetailEx(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
