// ─── Workflow Executor — Memory surfaces ──────────────────────────────────
//
// Rendered in the executor's "complete" output view, beneath the results
// table. Three memory experiences from the Insight Memory Engine, in the
// executor's own token system (ink / brand / canvas / compliant / mitigated /
// risk):
//
//   1. Golden-record cost bypass — this re-run replayed from a frozen golden
//      record, so it cost a fraction of a fresh plan (the PRD's "80% bypass").
//   2. Source-drift re-ask — memory noticed an input column moved and asks the
//      user to re-confirm BEFORE trusting the green result (the Acme example).
//   3. Cross-workflow correlation — entities in this run that memory has also
//      seen flagged in other runs / other workflows.
//   4. Output compare — this run diffed against the previous run of the same
//      workflow: what's new, what resolved, how the KPIs moved.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain, Zap, ShieldAlert, Network, ArrowRight, Check, RefreshCw,
  GitCompareArrows, TrendingUp, TrendingDown, Minus,
  ChevronDown, Eye, Plus,
} from 'lucide-react';
import {
  ENTITY_MEMORY, RUN_OUTPUT_COMPARE, RUN_GOLDEN_RECORD,
  type EntityMemory, type OutputCompare, type GoldenRecordStatus,
} from '../../data/insightMemory';

// ─── Section shell ────────────────────────────────────────────────────────

function MemorySection({
  icon, title, subtitle, defaultOpen = true, accent = 'brand', right, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  accent?: 'brand' | 'mitigated' | 'compliant';
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const iconBg =
    accent === 'mitigated' ? 'bg-mitigated-50 text-mitigated-700'
    : accent === 'compliant' ? 'bg-compliant-50 text-compliant-700'
    : 'bg-brand-50 text-brand-600';
  return (
    <section className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden">
      <div className="flex items-center gap-3 px-[20px] py-3">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex flex-1 items-start gap-3 text-left cursor-pointer min-w-0"
        >
          <span className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-ink-900 leading-tight">{title}</span>
            {subtitle && <span className="block text-[11.5px] text-ink-500 leading-tight mt-px">{subtitle}</span>}
          </span>
        </button>
        {right}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Collapse' : 'Expand'}
          className="size-6 inline-flex items-center justify-center text-ink-400 hover:text-ink-700 transition-colors cursor-pointer shrink-0"
        >
          <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex">
            <ChevronDown size={15} />
          </motion.span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-[20px] pb-4 pt-0.5 border-t border-canvas-border/70">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── 1. Golden-record cost bypass ─────────────────────────────────────────
// Lives in the right-canvas Plan tab (it describes how the plan executed —
// reuse + cost — not a finding about the data), rendered via GoldenRecordPlanCard.

export function GoldenRecordBadge({ gr }: { gr: GoldenRecordStatus }) {
  return (
    <div className="rounded-xl border border-compliant/30 bg-compliant-50/30 p-3.5">
      <div className="flex items-start gap-3">
        <span className="size-8 rounded-lg bg-compliant-50 text-compliant-700 flex items-center justify-center shrink-0">
          <Zap size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-ink-800">
              {gr.reusePct}% of this run replayed from memory
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-compliant-50 text-compliant-700 px-2 py-0.5 text-[10.5px] font-bold border border-compliant/25">
              <Check size={10} strokeWidth={3} /> Golden record hit
            </span>
          </div>
          <p className="text-[11.5px] text-ink-500 mt-1 leading-relaxed">
            Inputs matched <span className="font-medium text-ink-700">{gr.matchedRecord}</span>, so most steps replayed
            deterministically. Only <span className="font-medium text-ink-700">{gr.recomputedSteps.join(', ')}</span> ran live.
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <span className="inline-flex items-baseline gap-1.5 rounded-lg bg-canvas-elevated border border-canvas-border px-2.5 py-1.5">
              <span className="text-[15px] font-bold font-mono text-compliant-700">{gr.cachedCost}</span>
              <span className="text-[11px] text-ink-400 line-through font-mono">{gr.freshCost}</span>
            </span>
            <span className="text-[11px] text-ink-500">this run {gr.savedVs}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 2. Source-drift re-ask (memory-conflict) ─────────────────────────────
// The Acme example: the run is green but checking the wrong column. Memory
// caught the schema change and blocks blind trust until the user re-confirms.

export function SourceDriftBanner() {
  const [resolved, setResolved] = useState<null | 'reconfirmed' | 'kept'>(null);
  // The banner starts expanded (it's a pre-run gate). One chevron top-right is
  // the only expand/collapse control — no separate "Review" button. Making a
  // decision auto-collapses it to a one-line summary so it stops competing with
  // the mapping table; the chevron reopens the evidence to change that call.
  const [open, setOpen] = useState(true);

  const decide = (choice: 'reconfirmed' | 'kept') => {
    setResolved(choice);
    setOpen(false);
  };

  const isGreen = resolved === 'reconfirmed';
  const frame = isGreen ? 'border-compliant/30 bg-compliant-50/40' : 'border-mitigated-200 bg-mitigated-50/40';
  const iconChip = isGreen
    ? 'bg-compliant-50 text-compliant-700 ring-compliant/25'
    : 'bg-mitigated-50 text-mitigated-700 ring-mitigated-200';

  // One-line summary text keyed off the decision (or the un-decided warning).
  const summary =
    resolved === 'reconfirmed'
      ? { title: 'Mapping re-confirmed', tail: ' — memory updated for future runs.', tailClass: 'text-ink-500' }
      : resolved === 'kept'
      ? { title: 'Kept the old mapping', tail: ' — flagged for review on next run.', tailClass: 'text-ink-500' }
      : { title: 'Source layout changed', tail: ' — verify before you run', tailClass: 'text-mitigated-700 font-semibold' };

  const chevron = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      aria-label={open ? 'Collapse' : 'Expand'}
      className="size-6 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 hover:bg-canvas transition-colors cursor-pointer shrink-0 -mr-1"
    >
      <motion.span
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
        className="inline-flex"
      >
        <ChevronDown size={15} />
      </motion.span>
    </button>
  );

  return (
    <div className="mb-5">
      <AnimatePresence initial={false} mode="wait">
        {!open ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${frame}`}>
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${iconChip}`}>
                {isGreen ? <Check size={14} strokeWidth={3} /> : <ShieldAlert size={14} />}
              </span>
              <p className="min-w-0 flex-1 text-[12px] leading-snug">
                <span className="font-bold text-ink-800">{summary.title}</span>
                <span className={summary.tailClass}>{summary.tail}</span>
              </p>
              {chevron}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex gap-3 rounded-xl border border-mitigated-200 bg-mitigated-50/40 p-4">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-mitigated-50 text-mitigated-700 ring-1 ring-inset ring-mitigated-200">
                <ShieldAlert size={15} />
              </span>
              <div className="min-w-0 flex-1">
                {/* Pre-run gate on the confirm screen: heading + prose warn that
                    the saved mapping is stale BEFORE the run, so the copy stays
                    conditional (nothing has executed yet) and the field/change it
                    names matches the evidence table below — the Amount column
                    moving, not a rename. Chevron top-right mirrors the collapsed
                    strip's control. */}
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-[13px] font-bold text-ink-900 leading-snug">
                    Source layout changed{' '}
                    <span className="text-mitigated-700">— verify before you run</span>
                  </h4>
                  {chevron}
                </div>

                <p className="text-[12px] text-ink-600 mt-1.5 leading-relaxed">
                  The Amount column on the Acme source moved position, so this upload no longer lines up with the
                  saved mapping. Left as-is, some checks would run against the wrong field.
                </p>

                {/* The disputed field named once, then where memory expected it vs
                    where this upload put it. The F → H shift is the single thing
                    the auditor must register. */}
                <div className="mt-3 rounded-lg border border-canvas-border bg-canvas-elevated overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-canvas-border/60 bg-canvas/50">
                    <span className="font-mono text-[11px] text-ink-700">Acme · Amount</span>
                  </div>
                  <div className="grid grid-cols-[132px_1fr] items-center gap-2 px-3 py-2">
                    <span className="text-[11px] font-semibold text-ink-500">Promoted memory</span>
                    <span className="font-mono text-[11.5px] text-ink-600">column&nbsp;F</span>
                  </div>
                  <div className="grid grid-cols-[132px_1fr] items-center gap-2 px-3 py-2 border-t border-canvas-border/40 bg-mitigated-50/50">
                    <span className="text-[11px] font-semibold text-ink-700">This upload</span>
                    <span className="font-mono text-[11.5px] text-ink-700 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-mitigated-700">column&nbsp;H</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-mitigated-50 text-mitigated-700 px-1.5 py-0.5 text-[9.5px] font-sans font-bold uppercase tracking-wide border border-mitigated-200">
                        <ArrowRight size={9} strokeWidth={2.5} /> moved
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3.5">
                  <button
                    type="button"
                    onClick={() => decide('reconfirmed')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw size={12} /> Re-confirm mapping
                  </button>
                  <button
                    type="button"
                    onClick={() => decide('kept')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-ink-600 text-[12px] font-semibold hover:bg-canvas hover:border-ink-300 transition-colors cursor-pointer"
                  >
                    Keep old mapping
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// A compact, top-of-output strip that surfaces the memory conflict BEFORE the
// green results, so an auditor can't approve a drifted run without seeing the
// warning. Collapsed it's a one-line summary (conflict + secondary counts);
// expanding reveals the full source-drift card with its re-confirm actions.
// The richer context (cross-workflow correlation, output compare) still lives
// in WorkflowMemoryPanel beneath the results — this strip owns only the gate.
export function MemoryConflictStrip({
  entities = Object.values(ENTITY_MEMORY),
  compare = RUN_OUTPUT_COMPARE,
  hasConflict = true,
}: {
  entities?: EntityMemory[];
  compare?: OutputCompare;
  hasConflict?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!hasConflict) return null; // the strip exists only to gate a conflict

  const correlated = entities.length;
  const newFindings = compare.newFindings.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-5 rounded-xl border border-mitigated-200 bg-canvas-elevated overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left bg-mitigated-50/40 hover:bg-mitigated-50/70 transition-colors cursor-pointer"
      >
        <span className="size-6 rounded-lg bg-mitigated-50 text-mitigated-700 flex items-center justify-center shrink-0">
          <Brain size={13} />
        </span>
        <span className="text-[12.5px] font-bold text-ink-800 shrink-0">Memory</span>
        <span className="flex items-center gap-2 flex-wrap min-w-0 text-[11.5px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-mitigated-50 text-mitigated-700 px-2 py-0.5 font-bold border border-mitigated-200">
            <ShieldAlert size={11} /> 1 conflict
          </span>
          <span className="text-ink-300">·</span>
          <span className="text-ink-600">
            <span className="font-semibold text-ink-700 tabular-nums">{correlated}</span> seen elsewhere
          </span>
          {newFindings > 0 && (
            <>
              <span className="text-ink-300">·</span>
              <span className="text-ink-600">
                <span className="font-semibold text-ink-700 tabular-nums">{newFindings}</span> new
              </span>
            </>
          )}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-mitigated-700 shrink-0">
          {open ? 'Hide' : 'Verify before approving'}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className="inline-flex"
          >
            <ChevronDown size={14} />
          </motion.span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pt-3.5 pb-4 border-t border-mitigated-200/60 bg-mitigated-50/25">
              <SourceDriftBanner />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── 3. Cross-workflow correlation ────────────────────────────────────────

function EntityMemoryRow({ mem }: { mem: EntityMemory }) {
  const flags = mem.alsoFlaggedIn;
  return (
    <div className="py-3.5 first:pt-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13px] font-bold text-ink-900">{mem.entity}</span>
        <span className="text-[11px] font-mono text-ink-400">{mem.vendorId}</span>
        {mem.onWatch && (
          <span className="inline-flex items-center gap-1 rounded-full bg-risk-50 text-risk px-2 py-0.5 text-[10px] font-bold border border-risk/25">
            <Eye size={10} /> On watch
          </span>
        )}
        <span className="ml-auto inline-flex items-center rounded-full bg-canvas border border-canvas-border text-ink-500 px-2 py-0.5 text-[10.5px] font-bold tabular-nums shrink-0">
          {flags.length}
        </span>
      </div>
      {mem.watchNote && <p className="text-[11px] text-ink-500 mt-1">{mem.watchNote}</p>}
      {/* Prior flags as a connected timeline: a hairline rail through small
          nodes reads as one vendor's history across workflows — a ledger, not a
          loose list of arrowed lines. */}
      <div className="relative mt-2.5 ml-1">
        {flags.length > 1 && (
          <span aria-hidden="true" className="absolute left-[3px] top-2.5 bottom-2.5 w-px bg-brand-200" />
        )}
        <div className="flex flex-col gap-1">
          {flags.map((f, i) => (
            <div key={i} className="relative flex items-center gap-3 text-[11.5px] py-0.5">
              <span
                aria-hidden="true"
                className="relative z-10 size-[7px] rounded-full bg-brand-400 ring-2 ring-canvas-elevated shrink-0"
              />
              <span className="inline-flex items-center rounded-md bg-brand-50 text-brand-700 px-1.5 py-0.5 text-[10.5px] font-semibold shrink-0">
                {f.workflow}
              </span>
              <span className="text-ink-600 truncate">{f.detail}</span>
              <span className="text-ink-400 ml-auto shrink-0 tabular-nums">{f.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 4. Output compare ────────────────────────────────────────────────────

// The delta chip is a tinted pill: its wash tracks whether the move is
// favourable (compliant = good, mitigated = bad, neutral bordered = no
// judgement — more records processed isn't a warning), its glyph tracks raw
// direction, and it carries the magnitude — so the reader takes in size,
// direction, and sentiment in one badge.
function deltaPill(sentiment: 'good' | 'bad' | 'neutral') {
  return sentiment === 'good' ? 'bg-compliant-50 text-compliant-700'
    : sentiment === 'bad' ? 'bg-mitigated-50 text-mitigated-700'
    : 'bg-canvas text-ink-500 border border-canvas-border';
}
function DeltaGlyph({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up') return <TrendingUp size={11} />;
  if (direction === 'down') return <TrendingDown size={11} />;
  return <Minus size={11} />;
}

function OutputComparePanel({ cmp }: { cmp: OutputCompare }) {
  return (
    <div className="flex flex-col gap-4">
      {/* KPI deltas as a borderless stat row split by hairlines — not tiles. */}
      <div className="grid grid-cols-3 divide-x divide-canvas-border/60">
        {cmp.kpiDeltas.map((k) => (
          <div key={k.label} className="px-5 first:pl-0 last:pr-0">
            <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="flex items-center gap-2">
              <span className="text-[21px] font-bold font-mono text-ink-900 leading-none">{k.current}</span>
              <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none ${deltaPill(k.sentiment)}`}>
                <DeltaGlyph direction={k.direction} />{k.delta}
              </span>
            </div>
            <div className="text-[11px] text-ink-400 mt-2 font-mono">was {k.previous}</div>
          </div>
        ))}
      </div>

      {/* New vs resolved — colour lives in the labels, not in boxes. */}
      <div className="grid grid-cols-2 divide-x divide-canvas-border/60">
        <div className="pr-5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-mitigated-700 mb-2">
            <Plus size={12} /> New this run ({cmp.newFindings.length})
          </div>
          {cmp.newFindings.map((f) => (
            <div key={f.ref} className="text-[11.5px] text-ink-600 leading-snug mb-1 last:mb-0">
              <span className="font-mono font-medium text-ink-800">{f.ref}</span> · {f.detail}
            </div>
          ))}
        </div>
        <div className="pl-5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-compliant-700 mb-2">
            <Check size={12} strokeWidth={3} /> Resolved since last run ({cmp.resolvedFindings.length})
          </div>
          {cmp.resolvedFindings.map((f) => (
            <div key={f.ref} className="text-[11.5px] text-ink-500 leading-snug mb-1 last:mb-0">
              <span className="font-mono font-medium text-ink-700 line-through">{f.ref}</span> · {f.detail}
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-ink-400 pt-1 border-t border-canvas-border/50">
        {cmp.carriedOver} findings carried over unchanged · previous run {cmp.previousRunDate}
      </p>
    </div>
  );
}

// ─── Composed panel ───────────────────────────────────────────────────────

// Plan-tab wrapper for the golden-record card — rendered in the executor's
// right-canvas Plan tab beneath the Query Execution Plan, since it explains
// how that plan executed (replayed from memory) and what it cost.
export function GoldenRecordPlanCard({ gr = RUN_GOLDEN_RECORD }: { gr?: GoldenRecordStatus }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <GoldenRecordBadge gr={gr} />
    </motion.div>
  );
}

export default function WorkflowMemoryPanel({
  entities = Object.values(ENTITY_MEMORY),
  compare = RUN_OUTPUT_COMPARE,
  showSourceDrift = true,
}: {
  entities?: EntityMemory[];
  compare?: OutputCompare;
  showSourceDrift?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.3 }}
      className="mt-5"
    >
      {/* One memory section. The two lenses — cross-workflow correlation and
          the compare-with-previous-run — live inside it as sub-blocks split by
          a rule, rather than as two separate cards. */}
      <MemorySection
        icon={<Brain size={14} />}
        title="What memory knows about this run"
        right={
          <span className="inline-flex items-center rounded-full bg-brand-50 text-brand-700 px-2.5 py-0.5 text-[10px] font-bold border border-brand-100 shrink-0">
            Insight Memory Engine
          </span>
        }
      >
        {showSourceDrift && (
          <div className="pt-3 pb-4 mb-4 border-b border-canvas-border/70">
            <SourceDriftBanner />
          </div>
        )}

        {/* Lens 1 — cross-workflow correlation */}
        <div className="pt-3">
          <div className="flex items-start gap-2.5">
            <span className="size-6 rounded-md bg-canvas border border-canvas-border text-ink-400 flex items-center justify-center shrink-0">
              <Network size={13} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-ink-900 leading-tight">Cross-workflow correlation</div>
              <div className="text-[11px] text-ink-500 leading-tight mt-0.5">Entities memory has seen flagged elsewhere</div>
            </div>
            <span className="inline-flex items-center rounded-full bg-canvas text-ink-500 px-2 py-0.5 text-[10.5px] font-bold tabular-nums shrink-0">
              {entities.length}
            </span>
          </div>
          <div className="mt-1.5 flex flex-col divide-y divide-canvas-border/60">
            {entities.map((m) => <EntityMemoryRow key={m.vendorId} mem={m} />)}
          </div>
        </div>

        <div className="my-4 border-t border-canvas-border/70" />

        {/* Lens 2 — compare with the previous run */}
        <div>
          <div className="flex items-start gap-2.5">
            <span className="size-6 rounded-md bg-canvas border border-canvas-border text-ink-400 flex items-center justify-center shrink-0">
              <GitCompareArrows size={13} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-ink-900 leading-tight">Compare with previous output</div>
              <div className="text-[11px] text-ink-500 leading-tight mt-0.5">vs {compare.previousRunLabel}</div>
            </div>
          </div>
          <div className="mt-2.5">
            <OutputComparePanel cmp={compare} />
          </div>
        </div>
      </MemorySection>
    </motion.section>
  );
}

// A compact, single-line memory marker for a results-table row whose entity
// memory recognises. Rendered inline next to the vendor cell in the executor.
export function RowMemoryMarker({ vendor }: { vendor: string }) {
  const mem = ENTITY_MEMORY[vendor];
  if (!mem) return null;
  const count = mem.alsoFlaggedIn.length;
  return (
    <span
      title={`Memory: also flagged in ${mem.alsoFlaggedIn.map(f => f.workflow).join(', ')}`}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${mem.onWatch ? 'bg-risk-50 text-risk' : 'bg-brand-50 text-brand-700'}`}
    >
      {mem.onWatch ? <Eye size={9} /> : <Brain size={9} />}
      {mem.onWatch ? 'On watch' : `Seen in ${count}`}
    </span>
  );
}
