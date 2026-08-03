import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle, ArrowRight, Building2, CalendarClock, CalendarRange, Check, CheckCircle2, ChevronDown, Circle,
  Grid3x3, Layers, Plus, Scale, ScrollText, ShieldAlert, SlidersHorizontal, Table2, Users,
} from 'lucide-react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import EmptyState from '../shared/EmptyState';
import { Pill } from '../shared/StatusBadge';
import { SeverityPill } from './parts';
import NewAuditWizard from './NewAuditWizard';
import RollForwardSheet from './RollForwardSheet';
import { formatINR, retestAtRisk } from './helpers';
import { entitiesFor, processesFor } from './auditScope';
import {
  auditDeficiencies, auditProgress, auditStatus, controlsInManyAudits, crossAuditAggregation,
  liveAuditId, materialityConsistency, mwWatchlist, priorYearDeficiencies, type AuditStatus,
} from './auditPortfolio';
import type { AuditRecord, AuditRound } from './types';
import { cn } from '../../lib/cn';

/**
 * The ENGAGEMENT's Overview — the audit portfolio, as a widget board.
 *
 * The split this page exists to make: the audit Dashboard (Overview.tsx) answers
 * "how is this audit going"; this answers "where does this entity's ICFR stand
 * across the whole year". Everything that belongs to one cycle — the control
 * counters, the materiality trio, the by-process bars, the sign-off — lives on the
 * Dashboard and deliberately does not appear here: with several audits running,
 * "16/20" and "₹12Cr" are unanswerable questions without naming which audit they
 * belong to.
 *
 * Only ONE audit card appears — the cycle in flight (user ask). The full register
 * is the SOX audit tab's job, and listing every audit in both places made the two
 * tabs read as duplicates. What stays here is what no single audit can answer:
 *   · deficiencies aggregated ACROSS audits — aggregation does not respect a
 *     process boundary, so two parallel audits can each raise something small
 *     against the same account and neither can see the other's
 *   · the material-weakness watchlist — one open MW anywhere puts the entity's
 *     conclusion at risk, whichever audit found it
 *   · the materiality consistency check — one opinion needs one ruler, and two
 *     audits of the same year measuring against different thresholds is a silent
 *     correctness bug nothing inside either audit would report
 *
 * Every number is read through auditPortfolio.ts, which knows whether an audit's
 * results are live (on the controls) or archived (snapshotted when the next cycle
 * started), so nothing is double-counted. One applied date range gates the lot.
 *
 * ── Visual register ────────────────────────────────────────────────────────────
 * The widget board the product already speaks (grc.az): every panel is a card
 * that carries its OWN header — brand uppercase KIND tag, Source-Serif title,
 * plain-English caption — so nothing floats on the canvas above a card. Two
 * primitives carry the numbers: the funnel bar (label · track · share in the fill
 * · fraction outside) and the banded table (paper-50 header, hairline rows,
 * tabular figures). No tinted tile grids, no icon chips above headings, no
 * severity ramp — semantic colour appears as a labelled dot or on one numeral,
 * never as a red→amber→green strip (DESIGN.md No-RAG Rule).
 */

const ROUND_LABEL: Record<AuditRound, string> = { interim: 'Interim', rollforward: 'Roll-forward', yearend: 'Year-end' };
const STATUS_TONE: Record<AuditStatus, 'compliant' | 'evidence' | 'draft'> = {
  concluded: 'compliant', active: 'evidence', planned: 'draft',
};
const STATUS_LABEL: Record<AuditStatus, string> = { concluded: 'Concluded', active: 'Active', planned: 'Planned' };

// ── Page furniture ───────────────────────────────────────────────────────────

const cardCls = 'rounded-xl border border-canvas-border bg-canvas-elevated p-4 shadow-[0_1px_2px_rgba(15,8,30,0.04)]';
const eyebrow = 'text-[0.625rem] font-semibold uppercase tracking-[0.1em]';
/** Table header band — full-bleed inside a p-4 card so it never reads as a card
 *  nested in a card. Every `-mx-4 px-4` below is the same trick. */
const bandCls = '-mx-4 px-4 py-1.5 bg-paper-50 border-y border-canvas-border';
const thCls = 'text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-500';
const inputCls = 'h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 tabular-nums focus:border-brand-300 outline-none cursor-pointer';

/**
 * One panel of the board. The header lives INSIDE the card (user ask): KIND tag
 * in the auditor's pen, title in Source Serif, and the reason it exists in plain
 * English under it — so a title never has to carry an explanation it can't hold.
 */
function Widget({ kind, title, titleMeta, caption, action, index = 0, className, onClick, openLabel, children }: {
  kind?: string; title: string; titleMeta?: React.ReactNode; caption?: string;
  action?: React.ReactNode; index?: number; className?: string;
  /** Makes the WHOLE tile the way in. Anything inside that acts on its own —
   *  Roll forward, a drill-in link — has to stop the event, or it opens this too. */
  onClick?: () => void; openLabel?: string;
  children: React.ReactNode;
}) {
  const still = useReducedMotion();
  return (
    <motion.section
      className={cn(cardCls, 'flex flex-col', onClick && 'cursor-pointer hover:border-brand-300 transition-colors', className)}
      initial={still ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.04 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? openLabel : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter') onClick(); } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {kind && <span className={cn(eyebrow, 'text-brand-600 self-baseline')}>{kind}</span>}
            <h2 className="font-display text-[1.0625rem] leading-tight text-ink-900 tabular-nums">{title}</h2>
            {titleMeta}
          </div>
          {caption && <p className="mt-0.5 text-[0.75rem] text-ink-500 leading-snug">{caption}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-3.5 flex-1">{children}</div>
    </motion.section>
  );
}

/**
 * The funnel row: fixed label, full-width track, the share riding inside the
 * fill, the fraction sitting outside it. One tone per bar — a stack of bars in
 * three semantic colours would be the heat strip the system prohibits.
 */
function Bar({ label, value, total, tone, right }: {
  label: string; value: number; total: number; tone: string; right: string;
}) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  // A zero row still shows a stub, so the track never reads as broken.
  const width = value === 0 ? 3 : Math.max(pct, 6);
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 text-[0.75rem] text-ink-600">{label}</span>
      <div className="relative flex-1 h-6 rounded-md bg-paper-50 overflow-hidden">
        <div
          className={cn('h-full rounded-md transition-[width] duration-700 ease-out', tone)}
          style={{ width: `${width}%` }}
        />
        {pct >= 18 && (
          <span className="absolute inset-y-0 left-2 flex items-center text-[0.6875rem] font-semibold text-white tabular-nums">
            {pct}%
          </span>
        )}
      </div>
      <span className="shrink-0 text-[0.75rem] font-medium text-ink-500 tabular-nums">{right}</span>
    </div>
  );
}

// ── The date range ───────────────────────────────────────────────────────────

/**
 * The whole board reads through one applied range (user ask).
 *
 * Kept as month arithmetic on ISO `YYYY-MM` strings rather than Date objects:
 * every window on an AuditRecord is already an ISO string, string compare is the
 * same as date compare at that precision, and no timezone can shift a month
 * boundary by a day.
 */
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Longest range the month grid stays legible at. Beyond this, Apply refuses. */
const MAX_SPAN_MONTHS = 36;

interface Range { from: string; to: string }

/** Does any part of the audit's window fall inside the range? */
const overlaps = (a: AuditRecord, r: Range) => a.windowFrom.slice(0, 7) <= r.to && a.windowTo.slice(0, 7) >= r.from;

/** Every month of the range, inclusive — the timeline's x-axis. */
function monthsIn(r: Range): { label: string; key: string; year: number; jan: boolean }[] {
  const [fy, fm] = r.from.split('-').map(Number);
  const [ty, tm] = r.to.split('-').map(Number);
  if (!fy || !fm || !ty || !tm) return [];
  const out: { label: string; key: string; year: number; jan: boolean }[] = [];
  let y = fy; let m = fm;
  while ((y < ty || (y === ty && m <= tm)) && out.length <= MAX_SPAN_MONTHS) {
    out.push({ label: MONTH_LABELS[m - 1]!, key: `${y}-${String(m).padStart(2, '0')}`, year: y, jan: m === 1 });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

const spanMonths = (r: Range) => {
  const [fy, fm] = r.from.split('-').map(Number);
  const [ty, tm] = r.to.split('-').map(Number);
  if (!fy || !fm || !ty || !tm) return 0;
  return (ty - fy) * 12 + (tm - fm) + 1;
};

/** `2026-01` → `Jan 2026`, for prose and headings. */
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return y && m ? `${MONTH_LABELS[m - 1]} ${y}` : key;
};

// ── The audit in flight ──────────────────────────────────────────────────────

/**
 * Body of the Current audit widget — the card shell is the Widget itself, and
 * the audit's own name, round and status ride on the Widget's title line (user
 * ask), so this is only what the header cannot carry: what it covers and how
 * far it got.
 */
function AuditBody({ audit, note }: { audit: AuditRecord; note?: React.ReactNode }) {
  const { eng } = useIcfr();
  const progress = auditProgress(audit, eng);

  // The widest tile on the board, so it lays out ACROSS rather than stacking —
  // facts left, progress right, and the tile stays a short strip.
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
      <div className="min-w-[16rem] flex-1">
        <div className="flex items-center gap-1.5 text-[0.75rem] text-ink-500 flex-wrap">
          <CalendarRange size={12} className="text-ink-400 shrink-0" />
          <span className="tabular-nums">{audit.windowFrom.slice(0, 7)} → {audit.windowTo.slice(0, 7)}</span>
          <span className="text-ink-300">·</span>
          {audit.scopeKind === 'entity'
            ? <Building2 size={12} className="text-ink-400 shrink-0" />
            : <Grid3x3 size={12} className="text-ink-400 shrink-0" />}
          <span className="truncate">{audit.scopeNames.join(', ')}</span>
        </div>
        {note}
      </div>

      {/* Testing progress — the bar is the glance, the fraction is the fact. The
          per-outcome counters that used to sit under it belong to the audit's own
          Dashboard, not to the engagement. */}
      <div className="w-full sm:w-[22rem] shrink-0">
        <Bar
          label="Concluded"
          value={progress.concluded}
          total={progress.total}
          right={`${progress.concluded}/${progress.total}`}
          tone={progress.ineffective > 0 ? 'bg-high-500' : progress.concluded > 0 ? 'bg-compliant-500' : 'bg-ink-300'}
        />
      </div>
    </div>
  );
}

// ── Coverage timeline ────────────────────────────────────────────────────────

/**
 * One timeline over the applied range, with every in-range audit placed on it.
 *
 * The two questions it answers at a glance: is the whole range covered, and
 * where is the gap. Roll-forward planning is driven by the second one — evidence
 * from an interim round does not reach the year end on its own.
 *
 * It used to be one grid per fiscal year, which meant a cycle boundary you could
 * not see across. One grid over the range shows the handover between rounds of
 * different years, which is exactly where coverage tends to break.
 */
function CoverageBody({ audits, range }: { audits: AuditRecord[]; range: Range }) {
  const { eng } = useIcfr();
  const months = monthsIn(range);
  const covered = new Set<string>();
  audits.forEach(a => {
    const from = a.windowFrom.slice(0, 7);
    const to = a.windowTo.slice(0, 7);
    months.forEach(m => { if (m.key >= from && m.key <= to) covered.add(m.key); });
  });
  const gaps = months.filter(m => !covered.has(m.key));
  const cols = { gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` };

  if (audits.length === 0) {
    return <p className="text-[0.8125rem] text-ink-400">No audit covers any part of this range.</p>;
  }

  // Fills the tile it is given: when the row is taller than the timeline needs,
  // the round rows share the surplus rather than leaving it dead at the bottom.
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <span className="text-[0.75rem] font-semibold text-ink-800 tabular-nums">
          {monthLabel(range.from)} → {monthLabel(range.to)}
        </span>
        <span className="text-[0.6875rem] text-ink-400 tabular-nums">
          {covered.size}/{months.length} months covered
        </span>
      </div>

      {/* Month axis, banded like a table header so the grid below reads as rows. */}
      <div className={cn(bandCls, 'flex items-center gap-2.5')}>
        <span className="w-[76px] shrink-0" aria-hidden />
        <div className="flex-1 grid gap-px" style={cols}>
          {months.map(m => (
            <span
              key={m.key}
              className={cn(
                'text-[0.5625rem] font-semibold uppercase tracking-[0.02em] text-center py-0.5 rounded-sm',
                covered.has(m.key) ? 'text-ink-500' : 'text-mitigated-700 bg-mitigated-50',
              )}
            >
              {m.label}
              {/* The year is stated where it turns over, so a multi-year range
                  never leaves you counting columns to work out which Jan. */}
              {m.jan && <span className="block font-normal text-ink-400 tabular-nums">{String(m.year).slice(-2)}</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="-mx-4 px-4 flex-1 flex flex-col divide-y divide-canvas-border">
        {audits.map(a => {
          const status = auditStatus(a, eng);
          const from = a.windowFrom.slice(0, 7);
          const to = a.windowTo.slice(0, 7);
          return (
            <div key={a.id} className="flex-1 min-h-[1.75rem] flex items-center gap-2.5 py-1.5">
              {/* Round only. The range is named in the header and the bar's
                  position says which cycle it belongs to — repeating the period on
                  every row cost the label its width and told you nothing. */}
              <span
                title={`${a.period} ${ROUND_LABEL[a.round].toLowerCase()} · ${monthLabel(from)} → ${monthLabel(to)}`}
                className="w-[76px] shrink-0 text-[0.75rem] font-medium text-ink-700 truncate"
              >
                {ROUND_LABEL[a.round]}
              </span>
              <div className="flex-1 grid gap-px" style={cols}>
                {months.map(m => {
                  const on = m.key >= from && m.key <= to;
                  return (
                    <span
                      key={m.key}
                      title={on ? `${a.period} ${ROUND_LABEL[a.round].toLowerCase()} · ${monthLabel(m.key)}` : undefined}
                      className={cn(
                        'h-4 rounded-[3px]',
                        !on ? 'bg-paper-50'
                          : status === 'concluded' ? 'bg-compliant-500'
                          : status === 'active' ? 'bg-brand-500'
                          : 'bg-ink-300',
                      )}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[0.75rem] leading-relaxed">
        {gaps.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-compliant-700 font-medium">
            <CheckCircle2 size={13} /> Every month of this range is covered.
          </span>
        ) : (
          <span className="inline-flex items-start gap-1.5 text-mitigated-700">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>
              <b className="font-semibold">{gaps.map(g => monthLabel(g.key)).join(', ')}</b>{' '}
              {gaps.length === 1 ? 'is' : 'are'} not covered by any round — interim evidence does not
              reach the year end on its own.
            </span>
          </span>
        )}
      </p>
    </div>
  );
}

// ── Masters ──────────────────────────────────────────────────────────────────

/** One row each, deliberately not four identical icon-chip tiles: the split it
 *  explains (masters at the engagement, execution inside an audit) is a list. */
function MasterRow({ icon: Icon, title, body, count, onClick }: {
  icon: typeof Table2; title: string; body: string; count: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group w-full text-left flex items-center gap-3 -mx-4 px-4 py-2.5 transition-colors',
        onClick ? 'hover:bg-brand-50/50 cursor-pointer' : 'cursor-default',
      )}
    >
      <Icon size={15} className="shrink-0 text-ink-400 group-hover:text-brand-600 transition-colors" />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] font-semibold text-ink-900">{title}</span>
        <span className="block text-[0.75rem] text-ink-500 leading-snug">{body}</span>
      </span>
      <span className="shrink-0 text-[0.75rem] font-medium text-ink-500 tabular-nums">{count}</span>
      {onClick && (
        <ArrowRight size={14} className="shrink-0 text-ink-300 group-hover:text-brand-600 transition-colors" />
      )}
    </button>
  );
}

// ── The page ─────────────────────────────────────────────────────────────────

export default function EngagementOverview() {
  const { eng, role, openAudit, openDeficiency, setTab, setView } = useIcfr();
  const { addToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [rolling, setRolling] = useState<AuditRecord | null>(null);
  /* The MW watchlist opens expanded — an entity-level finding is not something
     the page gets to hide on first read. Folding it away is the user's call, and
     it stays folded only for the visit. */
  const [mwOpen, setMwOpen] = useState(true);
  const still = useReducedMotion();

  const canCreate = role !== 'risk-owner';

  /**
   * The widest range the engagement has anything in — the default, and what
   * Reset goes back to. Derived rather than pinned to a fiscal year so a quarter
   * or custom audit is never silently outside the default view.
   */
  const fullRange = useMemo<Range>(() => {
    const froms = eng.audits.map(a => a.windowFrom.slice(0, 7)).sort();
    const tos = eng.audits.map(a => a.windowTo.slice(0, 7)).sort();
    return { from: froms[0] ?? '2026-01', to: tos[tos.length - 1] ?? '2026-12' };
  }, [eng.audits]);

  // `range` is what the board reads; `draft` is what the inputs hold until Apply.
  // Keeping them apart is the whole point of an Apply button — nothing re-reads
  // while the second date is still being picked.
  const [range, setRange] = useState<Range | null>(null);
  const applied = range ?? fullRange;
  const [draft, setDraft] = useState<Range>(fullRange);
  // Creating an audit can widen the engagement's envelope. If the view has not
  // been narrowed, follow it — otherwise Apply would light up for a change the
  // user never made.
  useEffect(() => { if (!range) setDraft(fullRange); }, [fullRange, range]);
  const dirty = draft.from !== applied.from || draft.to !== applied.to;
  const narrowed = applied.from !== fullRange.from || applied.to !== fullRange.to;

  const apply = () => {
    if (draft.to < draft.from) {
      addToast({ type: 'error', message: 'The end month cannot be before the start month.' });
      return;
    }
    if (spanMonths(draft) > MAX_SPAN_MONTHS) {
      addToast({ type: 'error', message: `Pick a range of ${MAX_SPAN_MONTHS} months or less.` });
      return;
    }
    setRange({ ...draft });
  };
  const reset = () => { setRange(null); setDraft(fullRange); };

  /** Every audit whose window touches the applied range — the board's data set. */
  const inRange = useMemo(
    () => eng.audits.filter(a => overlaps(a, applied))
      .slice()
      .sort((x, y) => y.windowFrom.localeCompare(x.windowFrom)),
    [eng.audits, applied],
  );

  /**
   * The cycle in flight — the one audit this page shows.
   *
   * It is the audit holding live results: the newest unarchived record, which is
   * the only one anybody can still test into. The fall-back to the newest record
   * covers the case where every audit has been archived, so the widget never
   * renders empty while audits exist.
   */
  const current = useMemo(() => {
    const liveId = liveAuditId(eng);
    return eng.audits.find(a => a.id === liveId) ?? eng.audits[0];
  }, [eng]);
  // Rounds of the SAME cycle as the current one — what the materiality ruler has
  // to agree across, and the reason the check belongs beside this card.
  const sameCycle = useMemo(
    () => (current ? eng.audits.filter(a => a.fiscalYear === current.fiscalYear) : []),
    [eng, current],
  );
  const consistency = useMemo(() => materialityConsistency(sameCycle), [sameCycle]);
  const curStatus = current ? auditStatus(current, eng) : null;
  const curInRange = !!current && overlaps(current, applied);

  // Everything below is scoped to the applied range — an audit outside it
  // contributes nothing to any read-out on the board.
  const ids = useMemo(() => new Set(inRange.map(a => a.id)), [inRange]);
  const mw = useMemo(() => mwWatchlist(eng).filter(x => ids.has(x.audit.id)), [eng, ids]);
  // Fixes whose retest lands after the books close. Not filtered by the applied
  // range: these are the live cycle's open exceptions, which is the only cycle
  // anyone can still move a date in — and the whole value of the card is saying
  // so while there is still room to move it.
  const atRisk = useMemo(() => retestAtRisk(eng), [eng]);
  const duplicates = useMemo(
    () => controlsInManyAudits(eng)
      .map(x => ({ ...x, audits: x.audits.filter(a => ids.has(a.id)) }))
      .filter(x => x.audits.length > 1),
    [eng, ids],
  );
  const currentYear = current?.fiscalYear ?? new Date().getFullYear();
  const prior = useMemo(
    () => priorYearDeficiencies(eng, currentYear).filter(x => ids.has(x.audit.id)),
    [eng, currentYear, ids],
  );
  const rangeDefs = useMemo(
    () => inRange.flatMap(a => auditDeficiencies(a, eng).map(d => ({ d, a }))),
    [inRange, eng],
  );
  const aggregated = useMemo(() => crossAuditAggregation(eng, inRange), [eng, inRange]);
  const entities = useMemo(() => entitiesFor(eng.id), [eng.id]);
  const processes = useMemo(() => processesFor(eng.id), [eng.id]);

  const sheets = (
    <AnimatePresence>
      {creating && <NewAuditWizard onClose={() => setCreating(false)} />}
      {rolling && <RollForwardSheet prior={rolling} onClose={() => setRolling(null)} />}
    </AnimatePresence>
  );

  const newAuditBtn = canCreate ? (
    <button
      onClick={() => setCreating(true)}
      className="h-9 px-3.5 shrink-0 inline-flex items-center gap-1.5 rounded-md bg-brand-600 text-white text-[0.8125rem] font-semibold shadow-sm shadow-brand-900/10 hover:bg-brand-500 active:bg-brand-800 transition-colors cursor-pointer"
    >
      <Plus size={15} /> New audit
    </button>
  ) : null;

  // Nothing to show a portfolio of yet.
  if (eng.audits.length === 0) {
    const steps = [
      { done: processes.length > 0, label: 'RACM master scoped', detail: `${processes.length} process${processes.length === 1 ? '' : 'es'}` },
      { done: eng.controls.length > 0, label: 'Control library populated', detail: `${eng.controls.length} controls` },
      { done: entities.length > 0, label: 'Entities registered', detail: `${entities.length} entities` },
    ];
    return (
      <div>
        <EmptyState
          icon={ScrollText}
          title="No audits yet"
          body="An audit sets the period it covers, the round it is, what it tests and the materiality it is measured against. Everything on this page is a read-out across audits, so it starts with the first one."
          action={newAuditBtn ?? undefined}
        />
        <div className={cn(cardCls, 'mt-5 max-w-[480px] mx-auto')}>
          <span className={cn(eyebrow, 'text-brand-600')}>Setup</span>
          <h3 className="font-display text-[1.0625rem] leading-tight text-ink-900 mt-0.5 mb-2.5">Before you start</h3>
          <ul className="-mx-4 px-4 divide-y divide-canvas-border">
            {steps.map(s => (
              <li key={s.label} className="flex items-center gap-2.5 py-2.5 text-[0.8125rem]">
                {s.done
                  ? <CheckCircle2 size={14} className="text-compliant-600 shrink-0" />
                  : <Circle size={13} className="text-ink-300 shrink-0" />}
                <span className={s.done ? 'text-ink-700' : 'text-ink-500'}>{s.label}</span>
                <span className="ml-auto text-[0.75rem] text-ink-400 tabular-nums">{s.detail}</span>
              </li>
            ))}
          </ul>
        </div>
        {sheets}
      </div>
    );
  }

  return (
    <div>
      {/* ── Toolbar: the range the whole board reads, beside the one create
           action (user ask). No card of its own — it is chrome, not a panel. */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal size={14} className="text-ink-400 shrink-0" />
          <span className="text-[0.75rem] font-medium text-ink-600">Date range</span>
          <input
            type="month"
            value={draft.from}
            max={draft.to}
            onChange={e => setDraft(d => ({ ...d, from: e.target.value }))}
            aria-label="Range start month"
            className={inputCls}
          />
          <ArrowRight size={12} className="text-ink-300 shrink-0" />
          <input
            type="month"
            value={draft.to}
            min={draft.from}
            onChange={e => setDraft(d => ({ ...d, to: e.target.value }))}
            aria-label="Range end month"
            className={inputCls}
          />
          <button
            onClick={apply}
            disabled={!dirty}
            className={cn(
              'h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[0.75rem] font-semibold transition-colors',
              dirty
                ? 'bg-brand-600 text-white shadow-sm shadow-brand-900/10 hover:bg-brand-500 cursor-pointer'
                : 'bg-paper-50 text-ink-400 cursor-default',
            )}
          >
            <Check size={13} /> Apply
          </button>
          {narrowed && (
            <button
              onClick={reset}
              className="h-8 px-2 rounded-md text-[0.75rem] font-semibold text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
          <span className="text-[0.75rem] text-ink-400 tabular-nums">
            {inRange.length} of {eng.audits.length} audit{eng.audits.length === 1 ? '' : 's'}
          </span>
        </div>
        {newAuditBtn}
      </div>

      {/* ── Attention: an open MW anywhere is an entity-level problem ─────────
           The lightest red in the ramp with a red hairline all round, and no
           left stripe (user ask) — the tint alone carries it. Deliberate on this
           one card: it reports a finding rather than a number, so it has to be
           findable before it is read. */}
      {mw.length > 0 && (
        <div className={cn(cardCls, 'mb-4 bg-risk-50 border-risk-100')}>
          {/* Two lines, not four (user ask). The tag sits BESIDE the headline —
              the register's own opener idiom — and each deficiency is one row
              with its cycle as mono meta on the right, so the card's height is
              header + one line per weakness.

              The whole header is the disclosure control (APG's heading > button),
              so the hit area is the line you already read rather than a 13px
              chevron. The headline never folds away: collapsed, the card still
              says an MW is open — only the list of which ones goes. */}
          <h2>
            <button
              type="button"
              onClick={() => setMwOpen(o => !o)}
              aria-expanded={mwOpen}
              aria-controls="mw-watchlist-rows"
              className="group w-full text-left flex items-center gap-2.5 flex-wrap cursor-pointer"
            >
              <ChevronDown
                size={16}
                aria-hidden
                className={cn(
                  'shrink-0 text-risk-400 group-hover:text-risk-700 transition-[color,transform] duration-200',
                  !mwOpen && '-rotate-90',
                )}
              />
              <span className={cn(eyebrow, 'text-risk-700 inline-flex items-center gap-1.5 shrink-0')}>
                <ShieldAlert size={13} /> Needs attention
              </span>
              <span className="font-display text-[1.0625rem] leading-snug text-ink-900">
                Material weakness open — the entity's conclusion is at risk
              </span>
              {/* Collapsed, the rows are gone and nothing else carries HOW MANY,
                  so the count stands in for them — and only then, or it would
                  say twice what the list already says. */}
              {!mwOpen && (
                <span className="shrink-0 text-[0.8125rem] font-semibold text-risk-700 tabular-nums">
                  {mw.length} weakness{mw.length === 1 ? '' : 'es'}
                </span>
              )}
            </button>
          </h2>
          {/* Dividers and hover step UP off the tint — canvas-border and a
              translucent wash both vanish against risk-50. */}
          <AnimatePresence initial={false}>
            {mwOpen && (
              <motion.div
                key="mw-rows"
                id="mw-watchlist-rows"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: still ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-2 -mx-4 px-4 divide-y divide-risk-100">
                  {mw.map(({ audit, deficiency }) => (
                    <button
                      key={deficiency.id}
                      onClick={() => openDeficiency(deficiency.id)}
                      /* Truncated to hold the row to one line — the full text is a
                         click away on the deficiency itself, and here as the tooltip. */
                      title={deficiency.description}
                      className="group w-full text-left flex items-center gap-2.5 py-2 -mx-4 px-4 text-[0.8125rem] text-ink-700 hover:bg-risk-100 transition-colors cursor-pointer"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-risk-500 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 font-medium truncate">{deficiency.description}</span>
                      <span className="shrink-0 text-[0.75rem] text-ink-500 tabular-nums">
                        {audit.period} · {ROUND_LABEL[audit.round].toLowerCase()}
                      </span>
                      <ArrowRight size={14} className="shrink-0 text-risk-300 group-hover:text-risk-700 transition-colors" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Attention: fixes that will not have a testable sample in time ────
           A sibling of the MW card, not a replacement — that one reports what is
           wrong, this one reports what will still be unproven when the year ends.
           Amber rather than red: nothing has failed, a date has. A fix agreed in
           January for an annual control cannot produce a testable sample before
           March; saying so in January leaves room to move the date, saying so in
           March does not. */}
      {atRisk.length > 0 && (
        <div className={cn(cardCls, 'mb-4 bg-high-50 border-high-100')}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={cn(eyebrow, 'text-high-700 inline-flex items-center gap-1.5 shrink-0')}>
              <CalendarClock size={13} /> Period end
            </span>
            <h2 className="font-display text-[1.0625rem] leading-snug text-ink-900">
              Fixes that cannot be retested before period end
            </h2>
          </div>
          <p className="mt-1 text-[0.8125rem] text-ink-600">
            Raised now, while the date can still move — after period end the answer is fixed.
          </p>
          {/* Same row idiom as the watchlist above, one step up off the tint. Two
              lines here rather than one: the reason IS the finding, so it cannot
              be a tooltip. */}
          <div className="mt-2 -mx-4 px-4 divide-y divide-high-100">
            {atRisk.map(({ d, readiness }) => {
              const c = eng.controls.find(x => x.id === d.controlId);
              return (
                <button
                  key={d.id}
                  onClick={() => openDeficiency(d.id)}
                  className="group w-full text-left flex items-start gap-2.5 py-2 -mx-4 px-4 text-[0.8125rem] text-ink-700 hover:bg-high-100 transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-high-500 shrink-0 mt-1.5" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[0.75rem] font-semibold text-ink-600">{d.id}</span>
                      <span className="font-mono text-[0.75rem] text-ink-500">{c?.wpRef ?? d.controlId}</span>
                      <span className="min-w-0 truncate font-medium">{c?.description ?? d.description}</span>
                    </span>
                    <span className="block text-[0.75rem] text-ink-500 mt-0.5">{readiness.reason}</span>
                  </span>
                  <span className="shrink-0 text-[0.75rem] font-semibold text-high-700 tabular-nums">{readiness.label}</span>
                  <ArrowRight size={14} className="shrink-0 mt-0.5 text-high-300 group-hover:text-high-700 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── The bento ────────────────────────────────────────────────────────
           Six columns, tiles sized to what they hold rather than to each other:
           a full-width strip, then an uneven pair, then three small ones.
           Tiles STRETCH to their row's height so no gap opens under a short
           one. The audit strip still hugs because it is alone on its row —
           stretching to a row you are the only member of is a no-op. */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {current && (
          <Widget
            index={0}
            className="md:col-span-6"
            /* No kind tag and no title furniture (user ask) — the audit names
               itself, and "Current audit" said nothing the record does not. */
            title={current.period}
            /* The whole tile is the way in — the Open button it replaces said
               nothing the card itself could not. Only when the record is
               actually on show: out of range the tile holds a message, not an
               audit, and there is nothing to open. */
            onClick={curInRange ? () => openAudit(current.id) : undefined}
            openLabel={`${current.archive ? 'View' : 'Open'} ${current.period} ${ROUND_LABEL[current.round].toLowerCase()}`}
            titleMeta={curInRange ? (
              <>
                <span className="text-[0.8125rem] font-medium text-ink-500">{ROUND_LABEL[current.round]}</span>
                <Pill tone={STATUS_TONE[curStatus!]}>{STATUS_LABEL[curStatus!]}</Pill>
                {current.rolledFromId && <span className={cn(eyebrow, 'text-ink-400')}>rolled forward</span>}
              </>
            ) : undefined}
            action={curInRange ? (
              <div className="flex items-center gap-2">
                {/* Provenance sits with the actions — it is meta about the record,
                    the same rank as the buttons that act on it. */}
                <span className="hidden xl:inline text-[0.75rem] text-ink-400 tabular-nums whitespace-nowrap">
                  {current.by.split(' · ')[0]} · {current.at}
                </span>
                {/* Quarter / custom audits are one-off checks, not a round of a
                    named annual cycle — there is no "next cycle" to roll into. */}
                {canCreate && !current.archive && (current.yearBasis === 'fy' || current.yearBasis === 'cy') && (
                  <button
                    onClick={e => { e.stopPropagation(); setRolling(current); }}
                    title={`Carry ${current.period} ${ROUND_LABEL[current.round].toLowerCase()} into the next round`}
                    className="h-8 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"
                  >
                    Roll forward
                  </button>
                )}
              </div>
            ) : undefined}
          >
            {/* The range can exclude the cycle in flight. Say so rather than
                rendering nothing — a blank panel reads as a bug. */}
            {curInRange ? (
              <AuditBody
                audit={current}
                /* One opinion needs one ruler. Two rounds of the same cycle
                   measuring against different thresholds is a silent correctness
                   bug — nothing inside either audit would report it. */
                note={sameCycle.length > 1 ? (
                  <p className={cn(
                    'mt-2 text-[0.75rem] font-medium inline-flex items-start gap-1.5',
                    consistency.consistent ? 'text-compliant-700' : 'text-mitigated-700',
                  )}>
                    <Scale size={12} className="shrink-0 mt-[3px]" />
                    <span className="tabular-nums">
                      {consistency.consistent
                        ? <>All {sameCycle.length} rounds of {current.period} share materiality ₹{consistency.values[0]} Cr</>
                        : <>Materiality differs across {current.period} rounds — ₹{consistency.values.join(' Cr, ₹')} Cr</>}
                    </span>
                  </p>
                ) : undefined}
              />
            ) : (
              <div className="flex items-center gap-2.5 text-[0.8125rem] text-ink-500">
                <CalendarRange size={14} className="text-ink-400 shrink-0" />
                <span className="tabular-nums">
                  {current.period} {ROUND_LABEL[current.round].toLowerCase()} runs{' '}
                  {monthLabel(current.windowFrom.slice(0, 7))} → {monthLabel(current.windowTo.slice(0, 7))}, outside this range.
                </span>
                <button
                  onClick={reset}
                  className="ml-auto shrink-0 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer"
                >
                  Show all
                </button>
              </div>
            )}
          </Widget>
        )}

        {/* The wide half of the uneven pair — the month grid is the one thing
            here that genuinely needs horizontal room. */}
        <Widget
          index={1}
          className="md:col-span-6 lg:col-span-4"
          /* No kind tag here (user ask) — "Timeline" restated the picture. */
          title="Period coverage"
          caption="Which months of the range a round actually tests, and where the gap is."
        >
          <CoverageBody audits={inRange} range={applied} />
        </Widget>

        <Widget
          index={2}
          className="md:col-span-6 lg:col-span-2"
          kind="Masters"
          title="Shared across every audit"
          caption="Maintained once here, consumed by each audit."
        >
          <div className="-mx-4 px-4 border-t border-canvas-border divide-y divide-canvas-border">
            <MasterRow
              icon={Table2}
              title="RACM"
              body="Risks and the controls that answer them."
              count={`${processes.length || eng.controls.length} matrices`}
              onClick={() => setTab('racm')}
            />
            <MasterRow
              icon={Layers}
              title="Control library"
              body="Every control, whichever audit is testing it."
              count={`${eng.controls.length} controls`}
              onClick={() => setTab('controls')}
            />
            <MasterRow
              icon={Building2}
              title="Entities & scope"
              body="The companies in the group, and what each contributes."
              count={`${entities.length} entities`}
              onClick={() => { setView('scope'); }}
            />
            <MasterRow
              icon={Users}
              title="People & roles"
              body={`Preparer ${eng.preparer.split(' · ')[0]}, reviewer ${eng.reviewer.split(' · ')[0]}.`}
              count="Settings"
              onClick={() => addToast({ type: 'info', message: 'People & roles is managed in platform settings.' })}
            />
          </div>
        </Widget>

        <Widget
          index={3}
          className="md:col-span-3 lg:col-span-2"
          kind="Roll-up"
          title="Deficiencies across audits"
          caption="Two rounds can each raise something small against the same account."
        >
          <div className="flex items-baseline justify-between gap-2 mb-2.5">
            <span className="text-[0.75rem] font-semibold text-ink-800 tabular-nums">
              {monthLabel(applied.from)} → {monthLabel(applied.to)}
            </span>
            <span className="text-[0.6875rem] text-ink-400 tabular-nums">
              {rangeDefs.filter(x => x.d.status !== 'Closed').length} open · {rangeDefs.length} total
              {inRange.length > 1 && ` · ${inRange.length} audits`}
            </span>
          </div>

          {rangeDefs.length === 0 ? (
            <p className="text-[0.8125rem] text-ink-400">No deficiencies raised in this range.</p>
          ) : (
            <>
              {/* A banded table, not a heat strip: one severity per row, each with
                  its own label and dot (DESIGN.md No-RAG Rule). */}
              <div className={cn(bandCls, 'grid grid-cols-[1fr_3.5rem_3.5rem] gap-2')}>
                <span className={thCls}>Severity</span>
                <span className={cn(thCls, 'text-right')}>Open</span>
                <span className={cn(thCls, 'text-right')}>Total</span>
              </div>
              <div className="-mx-4 px-4 divide-y divide-canvas-border">
                {([
                  ['Material Weakness', 'bg-risk-500'],
                  ['Significant Deficiency', 'bg-high-500'],
                  ['Deficiency', 'bg-mitigated-500'],
                ] as const).map(([sev, dot]) => {
                  const total = rangeDefs.filter(x => x.d.severity === sev).length;
                  const open = rangeDefs.filter(x => x.d.severity === sev && x.d.status !== 'Closed').length;
                  return (
                    <div key={sev} className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-2 items-center py-2">
                      <span className="flex items-center gap-2 text-[0.8125rem] text-ink-700 min-w-0">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} aria-hidden />
                        <span className="truncate">{sev}</span>
                      </span>
                      <span className="text-right text-[0.9375rem] font-semibold text-ink-900 tabular-nums">{open}</span>
                      <span className="text-right text-[0.8125rem] text-ink-400 tabular-nums">{total}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {aggregated.length > 0 && (
            <div className="mt-3 pt-3 border-t border-canvas-border space-y-1.5">
              <p className={cn(eyebrow, 'text-mitigated-700')}>Spans more than one round</p>
              {aggregated.map(g => (
                <p key={g.group} className="text-[0.75rem] text-ink-600 leading-relaxed">
                  <b className="font-semibold text-ink-900">{g.group}</b> — {g.count} deficiencies across{' '}
                  {g.audits.length} rounds, combined{' '}
                  <span className="tabular-nums font-semibold text-ink-900">{formatINR(g.combined)}</span>.
                  Individually immaterial can still be material together.
                </p>
              ))}
            </div>
          )}
        </Widget>

        <Widget
          index={4}
          className="md:col-span-3 lg:col-span-2"
          kind="Continuity"
          title="Carried forward"
          caption="An unverified prior-year deficiency is a standing question, not history."
        >
          {prior.length === 0 ? (
            <p className="text-[0.8125rem] text-ink-400">Nothing from an earlier year in this range.</p>
          ) : (
            <div className="-mx-4 px-4 border-t border-canvas-border divide-y divide-canvas-border">
              {prior.map(({ audit, deficiency, verified }) => (
                <div key={deficiency.id} className="flex items-start gap-2.5 py-2.5">
                  {verified
                    ? <CheckCircle2 size={14} className="text-compliant-600 shrink-0 mt-0.5" />
                    : <Circle size={13} className="text-mitigated-500 shrink-0 mt-[3px]" />}
                  <div className="min-w-0">
                    <p className="text-[0.8125rem] text-ink-700 leading-snug">{deficiency.description}</p>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <SeverityPill s={deficiency.severity} />
                      <span className="text-[0.75rem] text-ink-400 tabular-nums">
                        {audit.period} · {verified ? 'verified on retest' : 'not yet verified'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Widget>

        <Widget
          index={5}
          className="md:col-span-6 lg:col-span-2"
          kind="Effort"
          title="Tested in more than one audit"
          caption="Test once, rely many — a control two rounds both test is effort spent twice."
        >
          {duplicates.length === 0 ? (
            <p className="text-[0.8125rem] text-ink-400">No control is covered by more than one audit in this range.</p>
          ) : (
            <>
              <div className={cn(bandCls, 'grid grid-cols-[4.5rem_1fr_auto] gap-3')}>
                <span className={thCls}>Ref</span>
                <span className={thCls}>Process</span>
                <span className={cn(thCls, 'text-right')}>Rounds</span>
              </div>
              <div className="-mx-4 px-4 divide-y divide-canvas-border">
                {duplicates.slice(0, 6).map(({ control, audits }) => (
                  <div key={control.id} className="grid grid-cols-[4.5rem_1fr_auto] gap-3 items-center py-2 text-[0.8125rem]">
                    <span className="font-mono font-semibold text-ink-800 truncate">{control.wpRef}</span>
                    <span className="text-ink-600 truncate min-w-0">{control.process}</span>
                    <span
                      title={audits.map(a => `${a.period} ${ROUND_LABEL[a.round].toLowerCase()}`).join(' · ')}
                      className="text-right text-[0.75rem] text-ink-400 tabular-nums"
                    >
                      {audits.length} rounds
                    </span>
                  </div>
                ))}
              </div>
              {duplicates.length > 6 && (
                <p className="mt-2.5 text-[0.75rem] text-ink-400 tabular-nums">
                  and {duplicates.length - 6} more
                </p>
              )}
            </>
          )}
        </Widget>

      </div>

      {sheets}
    </div>
  );
}
