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
  Database, GitCompareArrows, TrendingUp, TrendingDown, Minus,
  ChevronDown, Eye, Sparkles, Plus,
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
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-3 text-left cursor-pointer min-w-0"
        >
          <span className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-ink-800 leading-tight">{title}</span>
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
            <div className="px-4 pb-4 pt-0.5 border-t border-canvas-border/70">{children}</div>
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

function SourceDriftBanner() {
  const [resolved, setResolved] = useState<null | 'reconfirmed' | 'kept'>(null);
  return (
    <div className="rounded-2xl border border-mitigated-200 bg-mitigated-50/40 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className="size-8 rounded-lg bg-mitigated-50 text-mitigated-700 flex items-center justify-center shrink-0">
          <ShieldAlert size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-ink-800">Memory caught a source change — verify before trusting this run</span>
            <span className="inline-flex items-center rounded-full bg-mitigated-50 text-mitigated-700 px-2 py-0.5 text-[10.5px] font-bold border border-mitigated-200">
              Memory conflict
            </span>
          </div>
          <p className="text-[12px] text-ink-600 mt-1.5 leading-relaxed">
            The <span className="font-mono font-medium text-ink-800">Amount</span> column on the Acme source moved position and
            the company field was renamed. The run still completed green — but it read the new layout against the
            <span className="font-medium text-ink-800"> old saved mapping</span>, so some checks ran on the wrong field.
          </p>
          <div className="mt-2.5 rounded-lg border border-mitigated-200 bg-canvas-elevated px-3 py-2 text-[11.5px]">
            <div className="flex items-center gap-2 text-ink-500">
              <span className="font-semibold text-ink-700 w-[120px] shrink-0">Promoted memory</span>
              <span className="font-mono">Acme · Amount = column F</span>
            </div>
            <div className="flex items-center gap-2 text-ink-500 mt-1">
              <span className="font-semibold text-ink-700 w-[120px] shrink-0">This upload</span>
              <span className="font-mono">Acme · Amount = column H <span className="text-mitigated-700 font-sans font-semibold">(moved)</span></span>
            </div>
          </div>

          {resolved === null ? (
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => setResolved('reconfirmed')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw size={12} /> Re-confirm mapping
              </button>
              <button
                type="button"
                onClick={() => setResolved('kept')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-canvas-border text-ink-600 text-[12px] font-semibold hover:bg-canvas transition-colors cursor-pointer"
              >
                Keep old mapping
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-3 text-[12px] font-semibold text-compliant-700">
              <Check size={13} strokeWidth={3} />
              {resolved === 'reconfirmed'
                ? 'Mapping re-confirmed — memory updated for future runs.'
                : 'Kept the old mapping — flagged for review on next run.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 3. Cross-workflow correlation ────────────────────────────────────────

function EntityMemoryRow({ mem }: { mem: EntityMemory }) {
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas/40 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12.5px] font-bold text-ink-800">{mem.entity}</span>
        <span className="text-[11px] font-mono text-ink-400">{mem.vendorId}</span>
        {mem.onWatch && (
          <span className="inline-flex items-center gap-1 rounded-full bg-risk-50 text-risk px-2 py-0.5 text-[10px] font-bold border border-risk/25">
            <Eye size={10} /> On watch
          </span>
        )}
      </div>
      {mem.watchNote && <p className="text-[11px] text-ink-500 mt-1">{mem.watchNote}</p>}
      <div className="flex flex-col gap-1.5 mt-2">
        {mem.alsoFlaggedIn.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-[11.5px]">
            <ArrowRight size={11} className="text-brand-400 shrink-0" />
            <span className="inline-flex items-center rounded-md bg-brand-50 text-brand-700 px-1.5 py-0.5 text-[10.5px] font-semibold shrink-0">
              {f.workflow}
            </span>
            <span className="text-ink-600 truncate">{f.detail}</span>
            <span className="text-ink-400 ml-auto shrink-0 tabular-nums">{f.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 4. Output compare ────────────────────────────────────────────────────

function DeltaIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up') return <TrendingUp size={12} className="text-mitigated-700" />;
  if (direction === 'down') return <TrendingDown size={12} className="text-compliant-700" />;
  return <Minus size={12} className="text-ink-400" />;
}

function OutputComparePanel({ cmp }: { cmp: OutputCompare }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {cmp.kpiDeltas.map((k) => (
          <div key={k.label} className="rounded-lg border border-canvas-border bg-canvas/40 px-3 py-2">
            <div className="text-[10.5px] text-ink-400 uppercase tracking-wider mb-1">{k.label}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[16px] font-bold font-mono text-ink-800 leading-none">{k.current}</span>
              <DeltaIcon direction={k.direction} />
            </div>
            <div className="text-[10.5px] text-ink-400 mt-1 font-mono">was {k.previous}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-mitigated-200 bg-mitigated-50/30 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-mitigated-700 mb-1.5">
            <Plus size={12} /> New this run ({cmp.newFindings.length})
          </div>
          {cmp.newFindings.map((f) => (
            <div key={f.ref} className="text-[11.5px] text-ink-600 leading-snug mb-1 last:mb-0">
              <span className="font-mono font-medium text-ink-800">{f.ref}</span> · {f.detail}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-compliant/30 bg-compliant-50/20 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-compliant-700 mb-1.5">
            <Check size={12} strokeWidth={3} /> Resolved since last run ({cmp.resolvedFindings.length})
          </div>
          {cmp.resolvedFindings.map((f) => (
            <div key={f.ref} className="text-[11.5px] text-ink-500 leading-snug mb-1 last:mb-0">
              <span className="font-mono font-medium text-ink-700 line-through">{f.ref}</span> · {f.detail}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-ink-400">
        {cmp.carriedOver} findings carried over unchanged · compared against{' '}
        <span className="font-medium text-ink-600">{cmp.previousRunLabel}</span> ({cmp.previousRunDate})
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
      className="mt-5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <span className="size-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
          <Brain size={13} />
        </span>
        <h3 className="text-[13px] font-bold text-ink-800">What memory knows about this run</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[10px] font-bold border border-brand-100">
          <Sparkles size={10} /> Insight Memory Engine
        </span>
      </div>

      {showSourceDrift && <SourceDriftBanner />}

      <MemorySection
        icon={<Network size={14} />}
        title="Cross-workflow correlation"
        subtitle="Entities here that memory has seen flagged elsewhere"
        right={
          <span className="inline-flex items-center rounded-full bg-canvas text-ink-500 px-2 py-0.5 text-[10.5px] font-bold tabular-nums">
            {entities.length}
          </span>
        }
      >
        <div className="flex flex-col gap-2 pt-2">
          {entities.map((m) => <EntityMemoryRow key={m.vendorId} mem={m} />)}
        </div>
      </MemorySection>

      <MemorySection
        icon={<GitCompareArrows size={14} />}
        title="Compare with previous output"
        subtitle={`vs ${compare.previousRunLabel}`}
        accent="compliant"
      >
        <div className="pt-2">
          <OutputComparePanel cmp={compare} />
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
