import { useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle, Clock, ChevronRight, ShieldCheck, Activity as ActivityIcon,
  ClipboardCheck, ArrowUpRight, Workflow, User, ListChecks, CheckCircle2,
  Upload, MessageSquare, RefreshCw, Shield,
} from 'lucide-react';
import { KpiTile } from '../shared/KpiTile';
import type { Engagement, EngStatus, EngType, ProcessCode } from '../../data/engagements';
import { ENGAGEMENT_EXCEPTIONS, type Severity } from '../../data/engagement-exceptions';
import { ENGAGEMENT_ACTIVITY, formatDay, type ActivityType } from '../../data/engagement-activity';

/** Filter payload the overview hands back to the page to deep-link into the list. */
export interface ListFilter {
  type?: EngType;
  status?: EngStatus;
  process?: ProcessCode;
}

interface Props {
  engagements: Engagement[];
  onOpenEngagement: (engagementId: string) => void;
  onGoToList: (filter?: ListFilter) => void;
}

// ─── Shared token maps (kept in sync with EngagementsView) ──────────────────
const TYPE_CLS: Record<EngType, string> = {
  Compliance: 'bg-brand-50 text-brand-700 border-brand-100',
  'Internal Audit': 'bg-evidence-50 text-evidence-700 border-evidence-100',
  Automation: 'bg-compliant-50 text-compliant-700 border-compliant-100',
  'SOX / ICFR': 'bg-brand-100 text-brand-800 border-brand-200',
};

const STATUS_DOT: Record<EngStatus, string> = {
  Active: 'bg-compliant',
  'In Progress': 'bg-evidence-600',
  Review: 'bg-mitigated',
  Planned: 'bg-brand-500',
  Draft: 'bg-ink-400',
  Closed: 'bg-ink-400',
};

function healthTier(pct: number): { bar: string; text: string } {
  if (pct >= 85) return { bar: 'bg-compliant', text: 'text-compliant-700' };
  if (pct >= 65) return { bar: 'bg-mitigated', text: 'text-mitigated-700' };
  return { bar: 'bg-risk', text: 'text-risk-700' };
}

const SEV_RANK: Record<Severity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const SEV_DOT: Record<Severity, string> = {
  Critical: 'bg-risk',
  High: 'bg-mitigated',
  Medium: 'bg-evidence-500',
  Low: 'bg-ink-400',
};

const TYPE_ORDER: EngType[] = ['SOX / ICFR', 'Compliance', 'Internal Audit', 'Automation'];
const STATUS_ORDER: EngStatus[] = ['Active', 'In Progress', 'Planned', 'Review', 'Draft'];
const PROCESS_ORDER: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'ITGC'];

const EVENT_ICON: Record<ActivityType, React.ElementType> = {
  workflow_run: Workflow,
  exception_fired: AlertTriangle,
  exception_assigned: User,
  exception_classified: ListChecks,
  exception_closed: CheckCircle2,
  evidence_uploaded: Upload,
  control_tested: ShieldCheck,
  comment_added: MessageSquare,
  status_changed: RefreshCw,
  signoff: Shield,
};

const EVENT_ICON_CLS: Record<ActivityType, string> = {
  workflow_run: 'bg-evidence-50 text-evidence-700',
  exception_fired: 'bg-risk-50 text-risk-700',
  exception_assigned: 'bg-mitigated-50 text-mitigated-700',
  exception_classified: 'bg-brand-50 text-brand-700',
  exception_closed: 'bg-compliant-50 text-compliant-700',
  evidence_uploaded: 'bg-brand-50 text-brand-700',
  control_tested: 'bg-compliant-50 text-compliant-700',
  comment_added: 'bg-surface-2 text-text-secondary',
  status_changed: 'bg-mitigated-50 text-mitigated-700',
  signoff: 'bg-compliant-50 text-compliant-700',
};

/** An engagement counts as "started" once it has health / has left Planned-Draft. */
function isStarted(e: Engagement): boolean {
  return !(e.health === 0 && (e.status === 'Planned' || e.status === 'Draft'));
}

/** Worst-severity open exception for an engagement, or null if none open. */
function worstOpenSeverity(engagementId: string): Severity | null {
  let worst: Severity | null = null;
  for (const ex of ENGAGEMENT_EXCEPTIONS) {
    if (ex.engagementId !== engagementId || ex.status === 'Resolved') continue;
    if (!worst || SEV_RANK[ex.severity] > SEV_RANK[worst]) worst = ex.severity;
  }
  return worst;
}

/**
 * Parse a free-text `nextScheduled` string into an approximate "hours from now"
 * for ranking. Returns null when there is no concrete deadline (e.g. "Pending
 * review", "Continue Testing") so those drop out of the Upcoming list.
 */
function deadlineHours(s: string): number | null {
  const lower = s.toLowerCase();
  const rel = lower.match(/(\d+)\s*(m|h|d|w)\b/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    switch (rel[2]) {
      case 'm': return n / 60;
      case 'h': return n;
      case 'd': return n * 24;
      case 'w': return n * 24 * 7;
    }
  }
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const dated = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/);
  if (dated) {
    const monthIdx = months.indexOf(dated[1]);
    const day = parseInt(dated[2], 10);
    // Ordering value in "hours" — large enough to sort after near-term relative items.
    return (monthIdx * 30 + day) * 24;
  }
  return null;
}

function urgencyTone(hours: number): { dot: string; text: string } {
  if (hours < 24) return { dot: 'bg-risk', text: 'text-risk-700' };
  if (hours < 24 * 7) return { dot: 'bg-mitigated', text: 'text-mitigated-700' };
  return { dot: 'bg-brand-400', text: 'text-text-secondary' };
}

/** Demo clock — aligned with engagement-activity's fixed "today" so relative
 *  seed copy ("in 12d") and dated milestones rank coherently. */
const DEMO_NOW = new Date('2026-05-15T00:00:00Z');

/** One entry for the Upcoming milestones feed. */
interface UpcomingEntry {
  label: string;
  /** Concrete milestone date, or null for legacy free-text deadlines. */
  date: Date | null;
  /** Hours from the demo clock — the sort key + urgency tone input. */
  hours: number;
}

/**
 * Next milestone for an engagement, from the real data model. Prefers the
 * earliest `milestones` entry on/after the demo clock; falls back to the old
 * free-text `nextScheduled` parse only when an engagement has no milestones.
 */
function nextMilestone(e: Engagement): UpcomingEntry | null {
  if (e.milestones && e.milestones.length > 0) {
    const upcoming = e.milestones
      .filter(m => m.date && m.label)
      .map(m => ({ label: m.label, date: new Date(m.date + 'T00:00:00Z') }))
      .filter(m => !Number.isNaN(m.date.getTime()) && m.date.getTime() >= DEMO_NOW.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (upcoming.length === 0) return null; // everything dated is behind us
    const first = upcoming[0];
    return { label: first.label, date: first.date, hours: (first.date.getTime() - DEMO_NOW.getTime()) / 3_600_000 };
  }
  const hours = deadlineHours(e.nextScheduled);
  return hours === null ? null : { label: e.nextScheduled, date: null, hours };
}

const fmtMilestoneDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function EngagementsOverview({ engagements, onOpenEngagement, onGoToList }: Props) {
  const attentionRef = useRef<HTMLDivElement>(null);
  const scrollToAttention = () => attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const nameById = useMemo(
    () => new Map(engagements.map(e => [e.id, e.name])),
    [engagements],
  );

  const stats = useMemo(() => {
    const started = engagements.filter(isStarted);
    const activeCount = engagements.filter(e => e.status === 'Active').length;
    const avgHealth = started.length
      ? Math.round(started.reduce((sum, e) => sum + e.health, 0) / started.length)
      : 0;
    const atRisk = started.filter(e => e.health < 65).length;

    const openExceptions = ENGAGEMENT_EXCEPTIONS.filter(ex => ex.status !== 'Resolved');
    const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<Severity, number>;
    for (const ex of openExceptions) sevCounts[ex.severity] += 1;

    const byType = TYPE_ORDER.map(type => {
      const list = engagements.filter(e => e.type === type);
      const startedList = list.filter(isStarted);
      const health = startedList.length
        ? Math.round(startedList.reduce((s, e) => s + e.health, 0) / startedList.length)
        : 0;
      return { type, count: list.length, health, hasStarted: startedList.length > 0 };
    });
    const byStatus = STATUS_ORDER.map(status => ({
      status,
      count: engagements.filter(e => e.status === status).length,
    }));
    const byProcess = PROCESS_ORDER.map(process => ({
      process,
      count: engagements.filter(e => e.process === process).length,
    }));

    const attention = started
      .filter(e => e.openIssues > 0 || e.health < 70)
      .sort((a, b) => (b.openIssues - a.openIssues) || (a.health - b.health))
      .slice(0, 5);

    const upcoming = engagements
      .map(e => ({ eng: e, next: nextMilestone(e) }))
      .filter((x): x is { eng: Engagement; next: UpcomingEntry } => x.next !== null)
      .sort((a, b) => a.next.hours - b.next.hours)
      .slice(0, 5);

    const recent = Object.values(ENGAGEMENT_ACTIVITY)
      .flat()
      .sort((a, b) => (a.dayOffset - b.dayOffset) || (b.hour - a.hour))
      .slice(0, 7);

    return {
      total: engagements.length, activeCount, avgHealth, atRisk,
      openFindings: openExceptions.length, sevCounts,
      byType, byStatus, byProcess, attention, upcoming, recent,
    };
  }, [engagements]);

  return (
    <div className="space-y-5">
      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="Total Engagements"
          value={String(stats.total)}
          index={0}
          onClick={() => onGoToList()}
          footer={<span className="text-[0.6875rem] text-text-muted">Across all types · view library</span>}
        />
        <KpiTile
          label="Active"
          value={String(stats.activeCount)}
          index={1}
          onClick={() => onGoToList({ status: 'Active' })}
          footer={<span className="text-[0.6875rem] text-text-muted">Currently in-flight</span>}
        />
        <KpiTile
          label="Portfolio Health"
          value={`${stats.avgHealth}%`}
          index={2}
          onClick={scrollToAttention}
          footer={
            <span className={`text-[0.6875rem] font-semibold ${stats.atRisk > 0 ? 'text-risk-700' : 'text-text-muted'}`}>
              {stats.atRisk > 0 ? `${stats.atRisk} at risk · review` : 'All healthy'}
            </span>
          }
        />
        <KpiTile
          label="Open Findings"
          value={String(stats.openFindings)}
          index={3}
          onClick={scrollToAttention}
          footer={
            <span className="text-[0.6875rem] text-text-muted">
              <span className="font-semibold text-risk-700">{stats.sevCounts.Critical}</span> critical ·{' '}
              <span className="font-semibold text-mitigated-700">{stats.sevCounts.High}</span> high
            </span>
          }
        />
      </div>

      {/* ── Portfolio breakdown ── */}
      <SectionCard
        title="Portfolio breakdown"
        subtitle="Click any row to open the library filtered to it"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-1 px-1">
          {/* By type */}
          <BreakdownColumn label="By type">
            {stats.byType.map(({ type, count, health, hasStarted }) => {
              const tier = healthTier(health);
              return (
                <BreakdownRow key={type} onClick={() => onGoToList({ type })} count={count}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.6875rem] font-semibold border ${TYPE_CLS[type]}`}>
                    {type}
                  </span>
                  {hasStarted && (
                    <span className={`ml-auto mr-2 text-[0.6875rem] font-bold tabular-nums ${tier.text}`}>{health}%</span>
                  )}
                </BreakdownRow>
              );
            })}
          </BreakdownColumn>

          {/* By status */}
          <BreakdownColumn label="By status">
            {stats.byStatus.map(({ status, count }) => (
              <BreakdownRow key={status} onClick={() => onGoToList({ status })} count={count} dim={count === 0}>
                <span className="flex items-center gap-2 text-[0.75rem] font-medium text-text">
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                  {status}
                </span>
              </BreakdownRow>
            ))}
          </BreakdownColumn>

          {/* By process */}
          <BreakdownColumn label="By process">
            {stats.byProcess.map(({ process, count }) => (
              <BreakdownRow key={process} onClick={() => onGoToList({ process })} count={count} dim={count === 0}>
                <span className="inline-flex items-center px-2 h-5 rounded-md text-[0.6875rem] font-semibold bg-surface-2 text-text-secondary border border-border-light">
                  {process}
                </span>
              </BreakdownRow>
            ))}
          </BreakdownColumn>
        </div>
      </SectionCard>

      {/* ── Needs attention + Upcoming ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div ref={attentionRef} className="scroll-mt-4">
          <SectionCard
            title="Needs attention"
            icon={<AlertTriangle size={14} className="text-risk-700" />}
            action={<SectionLink label="View all" onClick={() => onGoToList()} />}
          >
            {stats.attention.length === 0 ? (
              <EmptyRow text="Nothing flagged — every engagement is healthy." />
            ) : (
              <div className="space-y-1">
                {stats.attention.map((eng, i) => {
                  const tier = healthTier(eng.health);
                  const sev = worstOpenSeverity(eng.id);
                  return (
                    <Row key={eng.id} index={i} onClick={() => onOpenEngagement(eng.id)}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {sev && <span className={`w-2 h-2 rounded-full shrink-0 ${SEV_DOT[sev]}`} title={`${sev} exception open`} aria-hidden="true" />}
                          <span className="text-[0.8125rem] font-semibold text-text truncate">{eng.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[0.6875rem] text-text-muted">
                          <span className={`inline-flex items-center px-1.5 h-4 rounded text-[0.59375rem] font-semibold border ${TYPE_CLS[eng.type]}`}>
                            {eng.type}
                          </span>
                          <span className="font-mono">{eng.code}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {eng.openIssues > 0 && (
                          <span className="flex items-center gap-1 text-[0.6875rem] font-semibold text-risk-700">
                            <AlertTriangle size={11} />{eng.openIssues}
                          </span>
                        )}
                        <span className={`text-[0.8125rem] font-bold tabular-nums ${tier.text}`}>{eng.health}%</span>
                        <ChevronRight size={14} className="text-text-muted group-hover:text-primary transition-colors" />
                      </div>
                    </Row>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Upcoming milestones"
          icon={<Clock size={14} className="text-mitigated-700" />}
        >
          {stats.upcoming.length === 0 ? (
            <EmptyRow text="No scheduled milestones." />
          ) : (
            <div className="space-y-1">
              {stats.upcoming.map(({ eng, next }, i) => {
                const tone = urgencyTone(next.hours);
                return (
                  <Row key={eng.id} index={i} onClick={() => onOpenEngagement(eng.id)}>
                    <div className="min-w-0 flex-1">
                      <span className="text-[0.8125rem] font-semibold text-text truncate block">{eng.name}</span>
                      <span className="text-[0.6875rem] text-text-muted font-mono">{eng.code} · {eng.owner}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold ${tone.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                        {next.label}
                      </span>
                      {next.date && (
                        <span className="inline-flex items-center px-2 h-5 rounded-md text-[0.6875rem] font-semibold tabular-nums bg-surface-2 text-text-secondary border border-border-light">
                          {fmtMilestoneDate(next.date)}
                        </span>
                      )}
                      <ChevronRight size={14} className="text-text-muted group-hover:text-primary transition-colors" />
                    </div>
                  </Row>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Recent activity ── */}
      <SectionCard
        title="Recent activity"
        icon={<ActivityIcon size={14} className="text-evidence-700" />}
        subtitle="Latest events across every engagement"
      >
        {stats.recent.length === 0 ? (
          <EmptyRow text="No recent activity." />
        ) : (
          <div className="space-y-0.5">
            {stats.recent.map((ev, i) => {
              const Icon = EVENT_ICON[ev.type];
              const iconCls = EVENT_ICON_CLS[ev.type];
              const engName = nameById.get(ev.engagementId) ?? 'Engagement';
              return (
                <Row key={ev.id} index={i} onClick={() => onOpenEngagement(ev.engagementId)}>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}>
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[0.78125rem] text-text truncate block leading-snug">{ev.title}</span>
                    <span className="text-[0.6875rem] text-text-muted">
                      {ev.actor} · {engName}
                    </span>
                  </div>
                  <span className="text-[0.6875rem] text-text-muted tabular-nums shrink-0">{formatDay(ev.dayOffset)}</span>
                </Row>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Building blocks ────────────────────────────────────────────────────────

function SectionCard({
  title, subtitle, icon, action, children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border border-border-light bg-white p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3 className="text-[0.8125rem] font-semibold text-text">{title}</h3>
          {subtitle && <span className="text-[0.6875rem] text-text-muted truncate hidden sm:inline">— {subtitle}</span>}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function SectionLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-text-muted hover:text-primary px-2 py-1 rounded-md hover:bg-primary/5 transition-colors cursor-pointer shrink-0"
    >
      {label}<ArrowUpRight size={12} />
    </button>
  );
}

function BreakdownColumn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[0.625rem] font-bold text-text-muted uppercase tracking-wider mb-1.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function BreakdownRow({
  children, count, onClick, dim = false,
}: {
  children: React.ReactNode;
  count: number;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-primary/5 transition-colors cursor-pointer text-left ${dim ? 'opacity-50' : ''}`}
    >
      {children}
      <span className="ml-auto text-[0.75rem] font-bold tabular-nums text-text">{count}</span>
      <ChevronRight size={13} className="text-text-muted/60 group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}

function Row({
  children, index, onClick,
}: {
  children: React.ReactNode;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="group w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-primary/5 transition-colors cursor-pointer text-left"
    >
      {children}
    </motion.button>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-6 justify-center text-[0.75rem] text-text-muted">
      <ClipboardCheck size={15} className="text-text-muted/70" />
      {text}
    </div>
  );
}
