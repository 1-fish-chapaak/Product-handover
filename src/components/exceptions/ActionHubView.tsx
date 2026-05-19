import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Tag,
  ClipboardList,
  Clock,
  CheckCircle2,
  CircleDashed,
  ArrowRight,
  ChevronDown,
  BarChart3,
  Activity,
  Paperclip,
} from 'lucide-react';
import {
  ACTION_HUB_SUMMARY,
  ACTION_HUB_TIMELINE,
  GRC_EXCEPTIONS,
  GRC_CASE_DETAILS,
  type ActionHubEvent,
  type ActionHubActorRole,
  type GrcException,
} from '../../data/mockData';
import ExceptionStatusTracker from './ExceptionStatusTracker';
import ExceptionListDrawer from './ExceptionListDrawer';

type DrillPreset = {
  key: string;
  title: string;
  subtitle: string;
  ids: string[];
};

// Implementation status derivation — must mirror ExceptionsTable / ReviewDrawers logic.
function normaliseActionReview(v: string): 'Pending' | 'Approved' | 'Rejected' {
  if (v === 'Approved' || v === 'Rejected' || v === 'Pending') return v;
  if (v === 'Implemented') return 'Approved';
  return 'Pending';
}
type ImplementationStatus = 'Implemented' | 'Partially Implemented' | 'Discrepancy';
function deriveImplementation(ex: GrcException): ImplementationStatus | null {
  const actionStatus = GRC_CASE_DETAILS[ex.id]?.actionStatus ?? 'Pending';
  const norm = normaliseActionReview(ex.actionReview);
  if (norm === 'Rejected') return 'Discrepancy';
  if (norm === 'Approved') {
    if (actionStatus === 'Discrepancy') return 'Discrepancy';
    if (actionStatus === 'Pending') return 'Implemented';
    return actionStatus as ImplementationStatus;
  }
  return null;
}

const PRESETS: Record<string, { title: string; subtitle: string; ids: string[] | 'all' | ((ex: GrcException) => boolean) }> = {
  total:             { title: 'Total Exceptions',    subtitle: 'All flagged exceptions',                          ids: 'all' },
  classified:        { title: 'Classified',          subtitle: 'Exceptions with a Risk Owner classification',     ids: ['EXC001','EXC003','EXC004','EXC005','EXC006','EXC008','EXC010','EXC011','EXC012','EXC014'] },
  actionPlans:       { title: 'Action Plans',        subtitle: 'Exceptions with an action plan documented',       ids: ['EXC001','EXC003','EXC004','EXC006','EXC010','EXC012'] },
  underReview:       { title: 'In-Progress',         subtitle: 'Cases currently in progress',                     ids: (ex) => ex.status === 'Under Review' },
  open:              { title: 'Open',                subtitle: 'Exceptions still open and awaiting resolution',   ids: (ex) => ex.status === 'Open' },
  resolved:          { title: 'Closed',              subtitle: 'Closed exceptions',                               ids: ['EXC003','EXC006','EXC010'] },
  overdue:           { title: 'Overdue',             subtitle: 'Past action due date, not yet resolved',          ids: (ex) => ex.flags?.includes('Overdue') ?? false },
  // Risk Owner tiles
  roClassifications:   { title: 'Classifications',       subtitle: 'Exceptions classified by Risk Owner',            ids: ['EXC001','EXC003','EXC004','EXC005','EXC006','EXC008','EXC010','EXC011','EXC012','EXC014'] },
  roActionPlansFiled:  { title: 'Action Plans Filed',    subtitle: 'Action plans submitted by Risk Owner',           ids: ['EXC001','EXC003','EXC004','EXC006','EXC010','EXC012'] },
  roBulkActions:       { title: 'Bulk Actions',          subtitle: 'Exceptions grouped under a bulk action',         ids: (ex) => Boolean(ex.bulkId) },
  roIndividualActions: { title: 'Individual Actions',    subtitle: 'Non-bulk actions submitted by Risk Owner',       ids: ['EXC001','EXC006','EXC010','EXC012'] },
  // Auditor tiles
  auReviewsPerformed:  { title: 'Reviews Performed',     subtitle: 'Exceptions reviewed by Auditor',                 ids: ['EXC001','EXC003','EXC006','EXC010','EXC012'] },
  auApproved:          { title: 'Approved / Accepted',   subtitle: 'Action plans approved by Auditor',               ids: ['EXC003','EXC010'] },
  auRejected:          { title: 'Rejected',              subtitle: 'Action plans rejected by Auditor',               ids: ['EXC012'] },
  auCasesClosed:       { title: 'Cases Closed',          subtitle: 'Cases finalized by Auditor',                     ids: ['EXC003','EXC006','EXC010'] },
  // Implementation outcomes
  implImplemented:     { title: 'Implemented',           subtitle: 'Action approved and fully implemented',          ids: (ex) => deriveImplementation(ex) === 'Implemented' },
  implPartial:         { title: 'Partially Implemented', subtitle: 'Action approved but only partially in place',    ids: (ex) => deriveImplementation(ex) === 'Partially Implemented' },
  implDiscrepancy:     { title: 'Discrepancy',           subtitle: 'Action rejected — case reopened at Risk Owner',  ids: (ex) => deriveImplementation(ex) === 'Discrepancy' },
};

function resolvePreset(key: string): DrillPreset | null {
  const p = PRESETS[key];
  if (!p) return null;
  let ids: string[];
  if (p.ids === 'all') ids = GRC_EXCEPTIONS.map(e => e.id);
  else if (Array.isArray(p.ids)) ids = p.ids;
  else ids = GRC_EXCEPTIONS.filter(p.ids).map(e => e.id);
  return { key, title: p.title, subtitle: p.subtitle, ids };
}

type BreakdownTone = 'high' | 'risk' | 'brand' | 'compliant' | 'draft';

const BREAKDOWN_BAR: Record<BreakdownTone, string> = {
  high:      'bg-high',
  risk:      'bg-[#F07A74]',
  brand:     'bg-brand-400',
  compliant: 'bg-[#22C55E]',
  draft:     'bg-ink-300',
};

const BREAKDOWN_HEX: Record<BreakdownTone, string> = {
  high:      '#C2410C',
  risk:      '#F07A74',
  brand:     '#A366F0',
  compliant: '#22C55E',
  draft:     '#C2B9CB',
};

const BREAKDOWN_LABEL: Record<BreakdownTone, string> = {
  high:      'text-high-700',
  risk:      'text-risk',
  brand:     'text-brand-700',
  compliant: 'text-compliant-700',
  draft:     'text-ink-700',
};


const ROLE_AVATAR: Record<ActionHubActorRole, { initials: string; bg: string; fg: string }> = {
  'Risk Owner': { initials: 'RO', bg: 'bg-brand-100',    fg: 'text-brand-700' },
  'Auditor':    { initials: 'AU', bg: 'bg-[#EDE4FA]',   fg: 'text-brand-700' },
  'Ira (AI)':   { initials: 'AI', bg: 'bg-compliant-50', fg: 'text-compliant-700' },
  'System':     { initials: 'SY', bg: 'bg-[#EEEEF1]',   fg: 'text-ink-600' },
};

const ROLE_DOT: Record<ActionHubActorRole, string> = {
  'Risk Owner': 'bg-brand-600',
  'Auditor':    'bg-brand-400',
  'Ira (AI)':   'bg-compliant',
  'System':     'bg-ink-300',
};

function CollapsibleSection({
  icon: Icon,
  title,
  subtitle,
  badge,
  defaultOpen = true,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-canvas-elevated border border-canvas-border rounded-[12px] overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 cursor-pointer text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] bg-[#F4F2F7] text-ink-600 flex items-center justify-center">
            <Icon size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-semibold text-ink-900">{title}</h3>
              {badge}
            </div>
            {subtitle && <p className="text-[12px] text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <ChevronDown size={16} className={`text-ink-500 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-canvas-border pt-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function CircularProgress({ pct, size = 64, stroke = 5, label }: { pct: number; size?: number; stroke?: number; label?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-canvas-border)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-brand-600)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-brand-700 tabular-nums">
        {label ?? `${pct}%`}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  navigable,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'default' | 'brand' | 'evidence' | 'mitigated' | 'compliant' | 'risk';
  icon: React.ElementType;
  navigable?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    default:   { bg: 'bg-canvas-elevated', border: 'border-canvas-border', iconBg: 'bg-[#F4F2F7]',    iconColor: 'text-ink-500',       valueColor: 'text-ink-900' },
    brand:     { bg: 'bg-brand-50/70',     border: 'border-brand-100',     iconBg: 'bg-brand-100',    iconColor: 'text-brand-700',     valueColor: 'text-brand-700' },
    evidence:  { bg: 'bg-evidence-50/60',  border: 'border-evidence-50',   iconBg: 'bg-evidence-50',  iconColor: 'text-evidence-700',  valueColor: 'text-evidence-700' },
    mitigated: { bg: 'bg-mitigated-50/60', border: 'border-mitigated-50',  iconBg: 'bg-mitigated-50', iconColor: 'text-mitigated-700', valueColor: 'text-mitigated-700' },
    compliant: { bg: 'bg-compliant-50/60', border: 'border-compliant-50',  iconBg: 'bg-compliant-50', iconColor: 'text-compliant-700', valueColor: 'text-compliant-700' },
    risk:      { bg: 'bg-risk-50/60',      border: 'border-risk-50',       iconBg: 'bg-risk-50',      iconColor: 'text-risk-700',      valueColor: 'text-risk-700' },
  }[tone];

  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`${tones.bg} border ${tones.border} rounded-[12px] p-4 flex flex-col justify-between min-h-[110px] text-left transition-colors ${
        interactive ? 'cursor-pointer hover:border-brand-300' : 'cursor-default'
      }`}
    >
      <div className="flex items-start justify-between w-full">
        <div className="text-[12px] text-ink-500">{label}</div>
        <div className={`w-7 h-7 ${tones.iconBg} ${tones.iconColor} rounded-full flex items-center justify-center shrink-0`}>
          <Icon size={14} strokeWidth={1.75} />
        </div>
      </div>
      <div className="flex items-end justify-between w-full">
        <div className={`text-[28px] leading-none font-semibold tabular-nums ${tones.valueColor}`}>{value}</div>
        {navigable && <ArrowRight size={14} className="text-ink-400" />}
      </div>
    </button>
  );
}


function MetricCell({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone?: 'brand' | 'evidence' | 'mitigated' | 'compliant' | 'risk';
  onClick?: () => void;
}) {
  const valueColor = {
    brand:     'text-brand-700',
    evidence:  'text-evidence-700',
    mitigated: 'text-mitigated-700',
    compliant: 'text-compliant-700',
    risk:      'text-risk-700',
  };
  const color = tone ? valueColor[tone] : 'text-ink-900';
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left cursor-pointer flex flex-col gap-1.5 py-1 transition-opacity hover:opacity-70"
    >
      <span className={`font-display text-[36px] leading-none tabular-nums tracking-[-0.01em] ${color}`}>
        {value}
      </span>
      <span className="text-[11.5px] text-ink-500 group-hover:text-ink-700 transition-colors">
        {label}
      </span>
    </button>
  );
}

function ClassificationDonut({ rows }: { rows: { label: string; count: number; tone: BreakdownTone }[] }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const size = 200;
  const stroke = 28;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetDeg = -90; // start at 12 o'clock

  return (
    <div className="flex items-center gap-8">
      {/* Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#EEEEF1"
            strokeWidth={stroke}
          />
          {/* Segments */}
          {total > 0 && rows.map((row) => {
            const pct = row.count / total;
            const dashLength = pct * circumference;
            const gap = circumference - dashLength;
            const seg = (
              <circle
                key={row.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={BREAKDOWN_HEX[row.tone]}
                strokeWidth={stroke}
                strokeLinecap="butt"
                strokeDasharray={`${dashLength} ${gap}`}
                strokeDashoffset={-(offsetDeg + 90) / 360 * circumference}
                transform={`rotate(0 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dasharray 400ms cubic-bezier(0.2, 0, 0, 1)' }}
              />
            );
            offsetDeg += pct * 360;
            return seg;
          })}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[28px] leading-none font-semibold text-ink-900 tabular-nums">{total}</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-500 mt-1">classified</div>
        </div>
      </div>

      {/* Legend */}
      <ul className="flex-1 space-y-2.5">
        {rows.map(row => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
          return (
            <li key={row.label} className="group flex items-center gap-3">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: BREAKDOWN_HEX[row.tone] }}
                aria-hidden="true"
              />
              <span className={`flex-1 text-[12.5px] font-medium truncate ${BREAKDOWN_LABEL[row.tone]}`}>
                {row.label}
              </span>
              <span className="text-[12.5px] font-semibold text-ink-900 tabular-nums w-6 text-right">{row.count}</span>
              <span className="text-[11.5px] text-ink-500 tabular-nums w-10 text-right">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TimelineEntry({ event }: { event: ActionHubEvent }) {
  const avatar = ROLE_AVATAR[event.role];
  const dot = ROLE_DOT[event.role];
  return (
    <li className="relative flex gap-3 py-3">
      <div className={`shrink-0 w-8 h-8 rounded-full ${avatar.bg} ${avatar.fg} flex items-center justify-center text-[10px] font-semibold tracking-wider`}>
        {avatar.initials}
      </div>
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[13px] text-ink-900 font-medium leading-snug">{event.message}</span>
          {event.exceptionId && event.exceptionId !== '—' && (
            <span className="inline-flex items-center h-5 px-2 text-[10.5px] font-medium bg-brand-50 text-brand-700 rounded-full font-mono">
              {event.exceptionId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-ink-500">
          <span>{event.actor} <span className="text-ink-400">[{event.role}]</span></span>
          <span className="text-ink-300">·</span>
          <span className="tabular-nums">{event.time}</span>
          <span className="text-ink-300">·</span>
          <em className="not-italic">{event.relative}</em>
        </div>
        {event.comment && (
          <p className="mt-1.5 text-[12px] italic text-ink-500 leading-relaxed">{event.comment}</p>
        )}
        {event.attachment && (
          <button className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-ink-600 hover:text-brand-700 cursor-pointer">
            <Paperclip size={11} />
            {event.attachment.name}
          </button>
        )}
      </div>
      <span className={`absolute top-4 right-0 w-2 h-2 rounded-full ${dot}`} aria-hidden="true" />
    </li>
  );
}

export default function ActionHubView() {
  const s = ACTION_HUB_SUMMARY;
  const timeline = ACTION_HUB_TIMELINE;

  const [openPresetKey, setOpenPresetKey] = useState<string | null>(null);
  const openPreset = openPresetKey ? resolvePreset(openPresetKey) : null;
  const presetExceptions = useMemo(
    () => (openPreset ? openPreset.ids.map(id => GRC_EXCEPTIONS.find(e => e.id === id)).filter(Boolean) as GrcException[] : []),
    [openPreset],
  );
  const openDrawer = useCallback((key: string) => setOpenPresetKey(key), []);

  const openCount = useMemo(() => GRC_EXCEPTIONS.filter(ex => ex.status === 'Open').length, []);

  // Implementation outcome counts derived from live mock data.
  const implCounts = useMemo(() => {
    const acc = { Implemented: 0, 'Partially Implemented': 0, Discrepancy: 0 } as Record<ImplementationStatus, number>;
    GRC_EXCEPTIONS.forEach(ex => {
      const v = deriveImplementation(ex);
      if (v) acc[v] += 1;
    });
    return acc;
  }, []);

  // Group timeline events by date preserving order.
  const grouped = useMemo(() => {
    const groups: { date: string; events: ActionHubEvent[] }[] = [];
    timeline.forEach(ev => {
      const last = groups[groups.length - 1];
      if (last && last.date === ev.date) last.events.push(ev);
      else groups.push({ date: ev.date, events: [ev] });
    });
    return groups;
  }, [timeline]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex-1 overflow-auto"
    >
      <div className="px-8 py-6 max-w-[1600px] mx-auto">

        {/* ATR Readiness — single horizontal hero, gates as flat rows */}
        <section className="mb-6 bg-canvas-elevated border border-canvas-border rounded-[12px] p-6">
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <h2 className="text-[15px] text-ink-900 font-semibold">ATR readiness</h2>
            <span className="text-[12px] text-ink-500 tabular-nums">
              <span className="font-semibold text-ink-900">{s.atrReadiness.overallPct}%</span>
              <span className="text-ink-400"> · {s.atrReadiness.completedSteps} of {s.atrReadiness.totalSteps} gates closed</span>
            </span>
          </div>
          <p className="text-[12.5px] text-ink-500 mb-5 leading-relaxed max-w-[64ch]">
            Three gates must close before the audit-to-record can be issued.
          </p>
          <div className="h-[3px] rounded-full bg-canvas-border overflow-hidden mb-6">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${s.atrReadiness.overallPct}%` }} />
          </div>
          <ol className="space-y-3.5">
            {s.atrReadiness.steps.map((step, idx) => {
              const pct = (step.current / step.total) * 100;
              const done = step.current >= step.total;
              return (
                <li key={step.id} className="grid grid-cols-[28px_1fr_auto] items-center gap-4">
                  <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-400 font-medium tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-[13px] text-ink-800 leading-snug">{step.label}</span>
                      <span className="shrink-0 text-[12px] tabular-nums">
                        <span className={`font-semibold ${done ? 'text-compliant-700' : 'text-ink-900'}`}>{step.current}</span>
                        <span className="text-ink-400"> / {step.total}</span>
                      </span>
                    </div>
                    <div className="h-[2px] rounded-full bg-canvas-border overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${done ? 'bg-compliant' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="sr-only">{step.current} of {step.total}</span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Overdue strip — restrained urgency, single message, no double-amplification */}
        {s.overdue.length > 0 && (
          <button
            onClick={() => openDrawer('overdue')}
            className="group w-full flex items-stretch gap-0 mb-6 text-left cursor-pointer rounded-[12px] bg-canvas-elevated border border-canvas-border hover:border-risk/30 transition-colors overflow-hidden"
          >
            <div className="w-[3px] bg-risk shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0 flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-risk-50 text-risk flex items-center justify-center shrink-0">
                <AlertTriangle size={16} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 mb-1.5">
                  <span className="text-[13.5px] text-ink-900 font-semibold">
                    {s.overdue.length} overdue {s.overdue.length === 1 ? 'case needs' : 'cases need'} attention
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {s.overdue.map(c => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 h-6 px-2.5 text-[11px] font-medium bg-canvas-base border border-canvas-border text-ink-700 rounded-full"
                    >
                      <span className="font-mono text-ink-800">{c.id}</span>
                      <span className="text-ink-300">·</span>
                      <span className="text-risk-700 tabular-nums">{c.overdueLabel}</span>
                    </span>
                  ))}
                </div>
              </div>
              <ArrowRight size={16} className="text-ink-500 shrink-0 group-hover:text-ink-800 group-hover:translate-x-0.5 transition-all" />
            </div>
          </button>
        )}

        {/* Metric spine — single row, three groups; neutral numbers with risk-only accent */}
        <section className="mb-6 bg-canvas-elevated border border-canvas-border rounded-[12px] p-6">
          <div className="grid grid-cols-[3fr_4fr_3fr]">
            {/* Snapshot */}
            <div className="pr-6">
              <div className="mb-4">
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500 font-medium">Snapshot</span>
              </div>
              <div className="grid grid-cols-3 gap-x-3">
                <MetricCell label="Total" value={s.counts.total} onClick={() => openDrawer('total')} />
                <MetricCell label="Classified" value={s.counts.classified} onClick={() => openDrawer('classified')} />
                <MetricCell label="Action plans" value={s.counts.actionPlans} onClick={() => openDrawer('actionPlans')} />
              </div>
            </div>

            {/* Lifecycle — flanked by separators */}
            <div className="px-6 border-l border-r border-canvas-border">
              <div className="mb-4">
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500 font-medium">Lifecycle</span>
              </div>
              <div className="grid grid-cols-4 gap-x-3">
                <MetricCell label="Open" value={openCount} onClick={() => openDrawer('open')} />
                <MetricCell label="In progress" value={s.counts.underReview} onClick={() => openDrawer('underReview')} />
                <MetricCell label="Closed" value={s.counts.resolved} onClick={() => openDrawer('resolved')} />
                <MetricCell label="Overdue" value={s.counts.overdue} tone="risk" onClick={() => openDrawer('overdue')} />
              </div>
            </div>

            {/* Outcomes */}
            <div className="pl-6">
              <div className="mb-4">
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500 font-medium">Outcomes</span>
              </div>
              <div className="grid grid-cols-3 gap-x-3">
                <MetricCell label="Implemented" value={implCounts['Implemented']} onClick={() => openDrawer('implImplemented')} />
                <MetricCell label="Partial" value={implCounts['Partially Implemented']} onClick={() => openDrawer('implPartial')} />
                <MetricCell label="Discrepancy" value={implCounts['Discrepancy']} tone="risk" onClick={() => openDrawer('implDiscrepancy')} />
              </div>
            </div>
          </div>
        </section>

        {/* Classification Breakdown */}
        <CollapsibleSection
          icon={BarChart3}
          title="Classification Breakdown"
          subtitle={`${s.classificationBreakdown.classified} classified · ${s.classificationBreakdown.unclassified} unclassified · ${s.classificationBreakdown.bulk} bulk · ${s.classificationBreakdown.individual} individual`}
        >
          <ClassificationDonut rows={s.classificationBreakdown.rows} />
        </CollapsibleSection>

        {/* Exception Status Tracker */}
        <ExceptionStatusTracker />

      </div>

      <AnimatePresence>
        {openPreset && (
          <ExceptionListDrawer
            key={openPreset.key}
            title={openPreset.title}
            subtitle={openPreset.subtitle}
            exceptions={presetExceptions}
            onClose={() => setOpenPresetKey(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
