import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ChevronRight, ShieldCheck, ArrowRight, Workflow, User, ListChecks, CheckCircle2,
  Upload, MessageSquare, RefreshCw, Shield, Sparkles, UserRound,
} from 'lucide-react';
import { KpiCountUp } from '../shared/KpiTile';
import type { Engagement, EngStatus, EngType, ProcessCode } from '../../data/engagements';
import { ENGAGEMENT_EXCEPTIONS, type Severity } from '../../data/engagement-exceptions';
import { ENGAGEMENT_ACTIVITY, formatDay, type ActivityType } from '../../data/engagement-activity';
import { getReflectionsFor, useInsightCacheVersion } from '../shared/insightCache';

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
  /** Open the portfolio AI insights drawer (results of the header's Generate).
   *  Needs-attention rows chip up when a portfolio insight spans them. */
  onOpenPortfolioInsights?: () => void;
}

// ─── Token maps ─────────────────────────────────────────────────────────────
/** Type as a dot + text (Control Library's process-chip language), not a chip. */
const TYPE_DOT: Record<EngType, string> = {
  'SOX / ICFR': 'bg-brand-700',
  Compliance: 'bg-brand-400',
  'Internal Audit': 'bg-evidence-500',
  Automation: 'bg-compliant-500',
};
const TYPE_TEXT: Record<EngType, string> = {
  'SOX / ICFR': 'text-brand-700',
  Compliance: 'text-brand-600',
  'Internal Audit': 'text-evidence-700',
  Automation: 'text-compliant-700',
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

/** Bare tinted glyphs, as Control Library's status icons — no filled tiles. */
const EVENT_ICON_CLS: Record<ActivityType, string> = {
  workflow_run: 'text-evidence-700',
  exception_fired: 'text-risk-700',
  exception_assigned: 'text-mitigated-700',
  exception_classified: 'text-brand-700',
  exception_closed: 'text-compliant-700',
  evidence_uploaded: 'text-brand-700',
  control_tested: 'text-compliant-700',
  comment_added: 'text-ink-400',
  status_changed: 'text-mitigated-700',
  signoff: 'text-compliant-700',
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
  return { dot: 'bg-brand-400', text: 'text-ink-600' };
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

export default function EngagementsOverview({ engagements, onOpenEngagement, onGoToList, onOpenPortfolioInsights }: Props) {
  const attentionRef = useRef<HTMLDivElement>(null);
  const scrollToAttention = () => attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Re-render when a portfolio Generate lands, so the row chips light up live.
  useInsightCacheVersion();

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

    // Only the listed engagements' findings and activity — a new client's
    // portfolio doesn't inherit Platform's.
    const ids = new Set(engagements.map(e => e.id));
    const openExceptions = ENGAGEMENT_EXCEPTIONS.filter(ex => ex.status !== 'Resolved' && ids.has(ex.engagementId));
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
      .filter(ev => ids.has(ev.engagementId))
      .sort((a, b) => (a.dayOffset - b.dayOffset) || (b.hour - a.hour))
      .slice(0, 7);

    return {
      total: engagements.length, activeCount, avgHealth, atRisk,
      openFindings: openExceptions.length, sevCounts,
      byType, byStatus, attention, upcoming, recent,
    };
  }, [engagements]);

  const healthTone = healthTier(stats.avgHealth);

  return (
    <div className="space-y-10 pb-8">
      {/* ── Headline numbers — one hairline strip, not four cards ── */}
      <section aria-label="Portfolio at a glance" className="relative z-20 grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-canvas-border bg-canvas-elevated">
        <Stat
          label="Engagements"
          value={String(stats.total)}
          delay={0}
          onClick={() => onGoToList()}
          note={<>Across every type · <span className="text-brand-700">view library</span></>}
          breakdown={stats.byType.map(({ type, count }) => ({ key: type, dot: TYPE_DOT[type], count, text: type, onClick: () => onGoToList({ type }) }))}
        />
        <Stat
          label="Active"
          value={String(stats.activeCount)}
          delay={80}
          onClick={() => onGoToList({ status: 'Active' })}
          note="Currently in flight"
          breakdown={stats.byStatus.map(({ status, count }) => ({ key: status, dot: STATUS_DOT[status], count, text: status.toLowerCase(), onClick: () => onGoToList({ status }) }))}
        />
        <Stat
          label="Portfolio health"
          value={`${stats.avgHealth}%`}
          delay={160}
          onClick={scrollToAttention}
          note={stats.atRisk > 0
            ? <span className="text-risk-700"><span className="font-semibold">{stats.atRisk}</span> at risk · review</span>
            : 'All healthy'}
          meter={<Meter pct={stats.avgHealth} bar={healthTone.bar} />}
        />
        <Stat
          label="Open findings"
          value={String(stats.openFindings)}
          delay={240}
          onClick={scrollToAttention}
          note={<>
            <span className="font-semibold text-risk-700">{stats.sevCounts.Critical}</span> critical ·{' '}
            <span className="font-semibold text-mitigated-700">{stats.sevCounts.High}</span> high
          </>}
        />
      </section>

      {/* ── Needs attention + Upcoming ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-10">
        <div ref={attentionRef} className="scroll-mt-4 min-w-0">
          <section aria-label="Needs attention">
            <SectionHeader
              title="Needs attention"
              meta={stats.attention.length > 0 ? `${stats.attention.length} engagement${stats.attention.length === 1 ? '' : 's'}` : undefined}
              action={<SectionLink label="View all" onClick={() => onGoToList()} />}
            />
            {stats.attention.length === 0 ? (
              <Empty title="Nothing flagged" text="Every engagement is healthy." />
            ) : (
              <ul className="rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border overflow-hidden">
                {stats.attention.map(eng => {
                  const tier = healthTier(eng.health);
                  const sev = worstOpenSeverity(eng.id);
                  const spannedBy = getReflectionsFor('engagement', eng.id).length;
                  return (
                    <li key={eng.id}>
                      <Row onClick={() => onOpenEngagement(eng.id)}>
                        <span className="w-3 shrink-0 flex justify-center">
                          {sev && <span className={`size-2 rounded-full ${SEV_DOT[sev]}`} title={`${sev} exception open`} aria-hidden="true" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Meta>
                            <span className="font-mono text-ink-500 tabular-nums">{eng.code}</span>
                            <span aria-hidden>·</span>
                            <span className={TYPE_TEXT[eng.type]}>{eng.type}</span>
                          </Meta>
                          <div className="mt-0.5 flex items-center gap-2 min-w-0">
                            <span className="text-[0.875rem] font-semibold text-ink-900 truncate group-hover:text-brand-700 transition-colors">{eng.name}</span>
                            {/* role="button" span — this row is itself a <button>,
                                so a nested native button would be invalid. */}
                            {spannedBy > 0 && onOpenPortfolioInsights && (
                              <span
                                role="button" tabIndex={0}
                                title={`Part of ${spannedBy} portfolio insight${spannedBy === 1 ? '' : 's'} — click to view`}
                                onClick={(e) => { e.stopPropagation(); onOpenPortfolioInsights(); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpenPortfolioInsights(); } }}
                                className="inline-flex items-center gap-1 rounded-full px-2 h-5 text-[0.625rem] font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 cursor-pointer shrink-0"
                              >
                                <Sparkles size={9} aria-hidden="true" /> Portfolio insight{spannedBy === 1 ? '' : `s · ${spannedBy}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          {eng.openIssues > 0 && (
                            <span className="inline-flex items-center gap-1 text-[0.75rem] text-risk-700 tabular-nums" title={`${eng.openIssues} open issue${eng.openIssues === 1 ? '' : 's'}`}>
                              <AlertTriangle size={12} aria-hidden />{eng.openIssues}
                            </span>
                          )}
                          <span className={`w-10 text-right font-mono text-[0.8125rem] font-semibold tabular-nums ${tier.text}`}>{eng.health}%</span>
                          <ChevronRight size={14} className="text-ink-300 group-hover:text-brand-700 transition-colors" aria-hidden />
                        </div>
                      </Row>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section aria-label="Upcoming milestones" className="min-w-0">
          <SectionHeader
            title="Upcoming milestones"
            meta={stats.upcoming.length > 0 ? 'Next one per engagement' : undefined}
          />
          {stats.upcoming.length === 0 ? (
            <Empty title="No scheduled milestones" text="Dated milestones show here as they're planned." />
          ) : (
            <ul className="rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border overflow-hidden">
              {stats.upcoming.map(({ eng, next }) => {
                const tone = urgencyTone(next.hours);
                return (
                  <li key={eng.id}>
                    <Row onClick={() => onOpenEngagement(eng.id)}>
                      <div className="min-w-0 flex-1">
                        <Meta>
                          <span className="font-mono text-ink-500 tabular-nums">{eng.code}</span>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1"><UserRound size={10} aria-hidden />{eng.owner}</span>
                        </Meta>
                        <span className="mt-0.5 block text-[0.875rem] font-semibold text-ink-900 truncate group-hover:text-brand-700 transition-colors">{eng.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`inline-flex items-center gap-1.5 text-[0.75rem] ${tone.text}`}>
                          <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                          {next.label}
                        </span>
                        {next.date && (
                          <span className="w-12 text-right font-mono text-[0.75rem] text-ink-500 tabular-nums">{fmtMilestoneDate(next.date)}</span>
                        )}
                        <ChevronRight size={14} className="text-ink-300 group-hover:text-brand-700 transition-colors" aria-hidden />
                      </div>
                    </Row>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ── Recent activity ── */}
      <section aria-label="Recent activity">
        <SectionHeader title="Recent activity" meta="Latest events across every engagement" />
        {stats.recent.length === 0 ? (
          <Empty title="No recent activity" text="Runs, findings and sign-offs show here as they happen." />
        ) : (
          <ul className="rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border overflow-hidden">
            {stats.recent.map(ev => {
              const Icon = EVENT_ICON[ev.type];
              const engName = nameById.get(ev.engagementId) ?? 'Engagement';
              return (
                <li key={ev.id}>
                  <Row onClick={() => onOpenEngagement(ev.engagementId)} dense>
                    <Icon size={16} className={`shrink-0 ${EVENT_ICON_CLS[ev.type]}`} aria-hidden />
                    <div className="min-w-0 flex-1 flex items-baseline gap-3">
                      <span className="text-[0.8125rem] text-ink-800 truncate">{ev.title}</span>
                      <span className="hidden md:inline text-[0.75rem] text-ink-400 truncate shrink min-w-0">{ev.actor} · {engName}</span>
                    </div>
                    <span className="font-mono text-[0.6875rem] text-ink-400 tabular-nums shrink-0">{formatDay(ev.dayOffset)}</span>
                  </Row>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─── Building blocks (Control Library's vocabulary) ────────────────────────

/** Group header: title, quiet meta, hairline rule, optional action. */
function SectionHeader({ title, meta, action }: { title: string; meta?: string; action?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-3 mb-3">
      <h3 className="text-[0.875rem] font-semibold text-ink-900 shrink-0">{title}</h3>
      {meta && <span className="text-[0.75rem] text-ink-400 tabular-nums truncate">{meta}</span>}
      <span className="flex-1 h-px bg-canvas-border min-w-6" aria-hidden />
      {action}
    </header>
  );
}

function SectionLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline cursor-pointer shrink-0">
      {label}<ArrowRight size={12} aria-hidden />
    </button>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">{children}</div>;
}

function Meta({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-ink-400">{children}</div>;
}

/** Thin coverage meter — the Control Library "Live coverage" bar. */
function Meter({ pct, bar, className = '' }: { pct: number; bar: string; className?: string }) {
  return (
    <span className={`block h-1.5 rounded-full bg-paper-100 overflow-hidden ${className}`} aria-hidden>
      <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

/** Headline number. With `popover`, hover or focus opens its breakdown below. */
/** One line of a KPI's breakdown, shown in place of its note on hover. */
interface BreakdownPart { key: string; dot: string; count: number; text: string; onClick: () => void }

function Stat({ label, value, note, meter, delay, onClick, breakdown }: {
  label: string;
  value: string;
  note: React.ReactNode;
  meter?: React.ReactNode;
  delay: number;
  onClick: () => void;
  /** Hover / focus swaps the note for this breakdown, in the tile itself
   *  (user ask, 8 Oct — it was a dropdown). Each part filters the library. */
  breakdown?: BreakdownPart[];
}) {
  const [hot, setHot] = useState(false);
  const showParts = !!breakdown && hot;
  return (
    <div
      className="group relative border-canvas-border [&:not(:first-child)]:border-l max-lg:[&:nth-child(3)]:border-l-0 max-lg:[&:nth-child(n+3)]:border-t lg:first:rounded-l-xl lg:last:rounded-r-xl hover:bg-paper-50 focus-within:bg-paper-50 transition-colors"
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onFocus={() => setHot(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHot(false); }}
    >
      {/* The whole tile is the KPI's own link; the breakdown parts sit above it. */}
      <button onClick={onClick} aria-label={`${label}: ${value}`}
        className="absolute inset-0 rounded-[inherit] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
      <div className="relative pointer-events-none px-5 py-4">
        <Eyebrow>{label}</Eyebrow>
        <div className="flex items-end gap-3">
          <span className="text-[1.75rem] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">
            <KpiCountUp value={value} delay={delay} />
          </span>
          {meter && <span className="flex-1 max-w-[7rem] mb-1.5">{meter}</span>}
        </div>
        {/* Two lines kept for every tile, so the swap never moves the strip. */}
        <div className="mt-2 min-h-[2.25rem] text-[0.75rem] leading-[1.125rem] text-ink-500 tabular-nums" aria-live="polite">
          {showParts ? (
            <span className="flex flex-wrap gap-x-2.5">
              {breakdown!.filter(p => p.count > 0).map(p => (
                <button key={p.key} type="button" onClick={p.onClick}
                  className="pointer-events-auto inline-flex items-center gap-1 h-[1.125rem] rounded hover:text-brand-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <span className={`size-1.5 rounded-full shrink-0 ${p.dot}`} aria-hidden />
                  <b className="font-semibold text-ink-800">{p.count}</b> {p.text}
                </button>
              ))}
            </span>
          ) : note}
        </div>
      </div>
    </div>
  );
}

function Row({ children, onClick, dense = false }: { children: React.ReactNode; onClick: () => void; dense?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-3 px-4 ${dense ? 'py-2.5' : 'py-3'} hover:bg-paper-50 transition-colors cursor-pointer text-left`}
    >
      {children}
    </button>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-canvas-border px-6 py-10 text-center">
      <p className="text-[0.875rem] font-medium text-ink-800">{title}</p>
      <p className="mt-1 text-[0.8125rem] text-ink-500">{text}</p>
    </div>
  );
}
