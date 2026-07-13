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
  ChevronDown, Eye, Sparkles, Plus, Info,
} from 'lucide-react';
import {
  ENTITY_MEMORY, RUN_GOLDEN_RECORD, STAGE3_CURRENT, correlatedRecords, diffRuns,
  PROCESS_INSIGHTS, PATTERN_META, SEVERITY_LABEL, displayConfidencePct,
  type GoldenRecordStatus, type MemoryInsight,
  type Stage3Record, type Stage3EvidenceRow, type Stage3RunDiff,
} from '../../data/insightMemory';

// ─── 0. Headline insight — the full finding for this run ──────────────────
// Reasoning + evidence table + recommended actions, so the analyst sees the
// complete STAGE_3-style insight in the executor (not just the supporting
// memory surfaces below it).

const fmtMoney = (n: number | null): string => (n == null ? '—' : `$${n.toFixed(2)}`);

function RunHeadlineInsight({ insight }: { insight: MemoryInsight }) {
  const pct = displayConfidencePct(insight);
  const rows = insight.evidence.rows ?? [];
  const actions = insight.recommendedActions ?? (insight.recommendedAction ? [insight.recommendedAction] : []);
  const limited = insight.evidence.runsAnalysed <= 2 || insight.factors.sourceDiversity < 0.55;

  return (
    <div className="rounded-2xl border border-risk/25 bg-canvas-elevated overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-risk-50 text-risk px-2 py-0.5 text-[10px] font-bold border border-risk/25">
            <span className="size-1.5 rounded-full bg-risk" /> {SEVERITY_LABEL[insight.severity]}
          </span>
          <span className="inline-flex items-center rounded-full bg-canvas text-ink-500 px-2 py-0.5 text-[10px] font-semibold">{PATTERN_META[insight.type].label}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-canvas-border bg-canvas-elevated px-2 py-0.5 text-[10px] font-semibold text-ink-800">
            <span className="size-1.5 rounded-full" style={{ background: pct >= 70 ? 'rgb(16 185 129)' : 'rgb(217 119 6)' }} /> {pct}% confidence
          </span>
          {limited && (
            <span className="inline-flex items-center rounded-full bg-mitigated-50 text-mitigated-700 px-2 py-0.5 text-[10px] font-semibold">
              Limited evidence · {insight.evidence.runsAnalysed} run{insight.evidence.runsAnalysed === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <h4 className="text-[15px] font-bold text-ink-900 leading-snug">{insight.title}</h4>

        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Reasoning</div>
          <p className="text-[12.5px] text-ink-600 leading-relaxed">{insight.description}</p>
        </div>
        {limited && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-mitigated-200 bg-mitigated-50/50 px-3 py-2">
            <Info size={13} className="text-mitigated-700 shrink-0 mt-0.5" />
            <span className="text-[11px] text-mitigated-700 leading-relaxed">
              Only {insight.evidence.runsAnalysed} run examined — a severe within-run concentration, not a proven multi-period recurrence.
            </span>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Evidence · {rows.length} sampled rows</div>
          <div className="overflow-x-auto rounded-lg border border-canvas-border">
            <table className="w-full min-w-[620px] text-[10.5px] border-collapse">
              <thead>
                <tr className="bg-canvas text-ink-400">
                  <th className="text-left font-semibold uppercase tracking-wider py-1.5 px-2">Product</th>
                  <th className="text-left font-semibold uppercase tracking-wider py-1.5 px-2">Contract</th>
                  <th className="text-left font-semibold uppercase tracking-wider py-1.5 px-2">Exception</th>
                  <th className="text-right font-semibold uppercase tracking-wider py-1.5 px-2">Paid</th>
                  <th className="text-right font-semibold uppercase tracking-wider py-1.5 px-2">WAC</th>
                  <th className="text-right font-semibold uppercase tracking-wider py-1.5 px-2">Contract $</th>
                  <th className="text-right font-semibold uppercase tracking-wider py-1.5 px-2">Revised</th>
                  <th className="text-right font-semibold uppercase tracking-wider py-1.5 px-2">Diff</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.productRef} className="border-t border-canvas-border align-top">
                    <td className="py-1.5 px-2 text-ink-800 font-medium max-w-[180px]">
                      {r.product}
                      <span className="block font-mono text-ink-400 text-[9.5px]">{r.productRef}</span>
                    </td>
                    <td className="py-1.5 px-2 font-mono text-ink-500 whitespace-nowrap">{r.contractRef}</td>
                    <td className="py-1.5 px-2 text-ink-600">{r.remark}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-ink-700">{fmtMoney(r.paid)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-ink-700">{fmtMoney(r.wac)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-ink-700">{fmtMoney(r.contractPrice)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-ink-700">{fmtMoney(r.revised)}</td>
                    <td className={`py-1.5 px-2 text-right tabular-nums font-semibold ${r.difference != null && r.difference < 0 ? 'text-risk' : 'text-ink-500'}`}>
                      {r.difference != null ? r.difference.toFixed(2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-2">
            <ArrowRight size={12} className="text-brand-600" /> Recommended actions · {actions.length}
          </div>
          <ul className="space-y-2">
            {actions.map((a, idx) => (
              <li key={idx} className="flex items-start gap-2 text-[12px] text-ink-800 leading-relaxed">
                <span className="mt-0.5 size-4 shrink-0 rounded border border-brand-200 bg-canvas-elevated text-[9px] font-bold text-brand-700 flex items-center justify-center tabular-nums">{idx + 1}</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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
            <span className="text-[13px] font-bold text-ink-800">Memory caught a price-master change — verify before settling this run</span>
            <span className="inline-flex items-center rounded-full bg-mitigated-50 text-mitigated-700 px-2 py-0.5 text-[10.5px] font-bold border border-mitigated-200">
              Memory conflict
            </span>
          </div>
          <p className="text-[12px] text-ink-600 mt-1.5 leading-relaxed">
            The <span className="font-mono font-medium text-ink-800">WAC</span> on contract HPG12 moved in the master, and several
            MCKESSON rows were priced against the old value. The run still completed — but some chargebacks were calculated on
            <span className="font-medium text-ink-800"> stale pricing</span>, so the WAC-mismatch flags need confirming before settlement.
          </p>
          <div className="mt-2.5 rounded-lg border border-mitigated-200 bg-canvas-elevated px-3 py-2 text-[11.5px]">
            <div className="flex items-center gap-2 text-ink-500">
              <span className="font-semibold text-ink-700 w-[120px] shrink-0">Promoted memory</span>
              <span className="font-mono">HPG12 · WAC = master price file (v3)</span>
            </div>
            <div className="flex items-center gap-2 text-ink-500 mt-1">
              <span className="font-semibold text-ink-700 w-[120px] shrink-0">This upload</span>
              <span className="font-mono">HPG12 · WAC differs on 2 products <span className="text-mitigated-700 font-sans font-semibold">(mismatch)</span></span>
            </div>
          </div>

          {resolved === null ? (
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => setResolved('reconfirmed')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw size={12} /> Re-confirm pricing
              </button>
              <button
                type="button"
                onClick={() => setResolved('kept')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-canvas-border text-ink-600 text-[12px] font-semibold hover:bg-canvas transition-colors cursor-pointer"
              >
                Keep old pricing
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-3 text-[12px] font-semibold text-compliant-700">
              <Check size={13} strokeWidth={3} />
              {resolved === 'reconfirmed'
                ? 'Pricing re-confirmed — memory updated for future runs.'
                : 'Kept the old pricing — flagged for review on next run.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 3. Cross-workflow correlation (Stage-3 entity_key) ───────────────────
// The current run's entity_key surfacing in OTHER workflows' Stage-3 records —
// same backend payload shape, correlated on entity_key.

const SEVERITY_DOT: Record<Stage3Record['insight']['severity'], string> = {
  high: 'rgb(220 38 38)',
  medium: 'rgb(217 119 6)',
  low: 'rgb(107 114 128)',
};

// A one-line detail derived from a record's own evidence — dominant exception
// remark + the contract(s) it hit. No bespoke summary field required.
function correlationDetail(rec: Stage3Record): string {
  const rows = rec.insight.evidence;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r['Exception Remark'], (counts.get(r['Exception Remark']) ?? 0) + 1);
  const topRemark = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'flagged';
  const contracts = [...new Set(rows.map((r) => r['Contract Ref Id']))];
  const where = contracts.length === 1 ? ` on ${contracts[0]}` : contracts.length > 1 ? ` across ${contracts.length} contracts` : '';
  return `${topRemark}${where}`;
}

function EntityCorrelation({ current, correlated }: { current: Stage3Record; correlated: Stage3Record[] }) {
  const displayName = current.insight.evidence[0]?.['Vendor Name'] ?? current.insight.entity_key.toUpperCase();
  const watch = ENTITY_MEMORY[displayName];
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas/40 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12.5px] font-bold text-ink-800">{displayName}</span>
        <span className="inline-flex items-center rounded-md bg-canvas text-ink-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          {current.insight.entity_type}
        </span>
        {watch?.onWatch && (
          <span className="inline-flex items-center gap-1 rounded-full bg-risk-50 text-risk px-2 py-0.5 text-[10px] font-bold border border-risk/25">
            <Eye size={10} /> On watch
          </span>
        )}
      </div>
      {watch?.watchNote && <p className="text-[11px] text-ink-500 mt-1">{watch.watchNote}</p>}
      {correlated.length === 0 ? (
        <p className="text-[11.5px] text-ink-400 mt-2">No other workflow has flagged this entity yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5 mt-2">
          {correlated.map((rec, i) => (
            <div key={i} className="flex items-center gap-2 text-[11.5px]">
              <ArrowRight size={11} className="text-brand-400 shrink-0" />
              <span className="inline-flex items-center rounded-md bg-brand-50 text-brand-700 px-1.5 py-0.5 text-[10.5px] font-semibold shrink-0">
                {rec.workflow}
              </span>
              <span className="text-ink-600 truncate">{correlationDetail(rec)}</span>
              <span className="inline-flex items-center gap-1 text-ink-400 ml-auto shrink-0 tabular-nums">
                <span className="size-1.5 rounded-full" style={{ background: SEVERITY_DOT[rec.insight.severity] }} />
                {Math.round(rec.insight.confidence * 100)}% · {rec.runDate}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 4. Output compare ────────────────────────────────────────────────────

function DeltaIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up') return <TrendingUp size={12} className="text-mitigated-700" />;
  if (direction === 'down') return <TrendingDown size={12} className="text-compliant-700" />;
  return <Minus size={12} className="text-ink-400" />;
}

function EvidenceRefLine({ r, resolved = false }: { r: Stage3EvidenceRow; resolved?: boolean }) {
  return (
    <div className="text-[11.5px] leading-snug mb-1 last:mb-0">
      <span className={`font-mono font-medium ${resolved ? 'text-ink-700 line-through' : 'text-ink-800'}`}>{r['Product Ref Id']}</span>
      <span className="text-ink-400"> · {r['Contract Ref Id']}</span>
      <span className={resolved ? 'text-ink-500' : 'text-ink-600'}> · {r['Exception Remark']}</span>
    </div>
  );
}

function Stage3ComparePanel({ diff }: { diff: Stage3RunDiff }) {
  const cur = diff.current.insight;
  const prev = diff.previous.insight;
  const curPct = Math.round(cur.confidence * 100);
  const prevPct = Math.round(prev.confidence * 100);
  const confDir: 'up' | 'down' | 'flat' = curPct === prevPct ? 'flat' : curPct > prevPct ? 'up' : 'down';
  const rowsDir: 'up' | 'down' | 'flat' = diff.exceptionDelta === 0 ? 'flat' : diff.exceptionDelta > 0 ? 'up' : 'down';
  const rowKey = (r: Stage3EvidenceRow) => `${r['Product Ref Id']}-${r['Contract Ref Id']}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-canvas-border bg-canvas/40 px-3 py-2">
          <div className="text-[10.5px] text-ink-400 uppercase tracking-wider mb-1">Confidence</div>
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-bold font-mono text-ink-800 leading-none">{curPct}%</span>
            <DeltaIcon direction={confDir} />
          </div>
          <div className="text-[10.5px] text-ink-400 mt-1 font-mono">was {prevPct}%</div>
        </div>
        <div className="rounded-lg border border-canvas-border bg-canvas/40 px-3 py-2">
          <div className="text-[10.5px] text-ink-400 uppercase tracking-wider mb-1">Evidence rows</div>
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-bold font-mono text-ink-800 leading-none">{cur.evidence.length}</span>
            <DeltaIcon direction={rowsDir} />
          </div>
          <div className="text-[10.5px] text-ink-400 mt-1 font-mono">was {prev.evidence.length}</div>
        </div>
        <div className="rounded-lg border border-canvas-border bg-canvas/40 px-3 py-2">
          <div className="text-[10.5px] text-ink-400 uppercase tracking-wider mb-1">Carried over</div>
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-bold font-mono text-ink-800 leading-none">{diff.carriedRows.length}</span>
            <Minus size={12} className="text-ink-400" />
          </div>
          <div className="text-[10.5px] text-ink-400 mt-1 font-mono">unchanged</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-mitigated-200 bg-mitigated-50/30 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-mitigated-700 mb-1.5">
            <Plus size={12} /> New this run ({diff.newRows.length})
          </div>
          {diff.newRows.length
            ? diff.newRows.map((r) => <EvidenceRefLine key={rowKey(r)} r={r} />)
            : <div className="text-[11px] text-ink-400">None</div>}
        </div>
        <div className="rounded-lg border border-compliant/30 bg-compliant-50/20 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-compliant-700 mb-1.5">
            <Check size={12} strokeWidth={3} /> Resolved since last run ({diff.resolvedRows.length})
          </div>
          {diff.resolvedRows.length
            ? diff.resolvedRows.map((r) => <EvidenceRefLine key={rowKey(r)} r={r} resolved />)
            : <div className="text-[11px] text-ink-400">None</div>}
        </div>
      </div>
      <p className="text-[11px] text-ink-400">
        {diff.carriedRows.length} exception{diff.carriedRows.length === 1 ? '' : 's'} carried over unchanged · compared against{' '}
        <span className="font-medium text-ink-600">{diff.previous.runLabel}</span> ({diff.previous.runDate})
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
  current = STAGE3_CURRENT,
  correlated = correlatedRecords(STAGE3_CURRENT),
  diff = diffRuns(STAGE3_CURRENT),
  showSourceDrift = true,
}: {
  current?: Stage3Record;
  correlated?: Stage3Record[];
  diff?: Stage3RunDiff;
  showSourceDrift?: boolean;
}) {
  const headlineInsight = PROCESS_INSIGHTS.find(i => i.severity === 'high') ?? PROCESS_INSIGHTS[0];
  const entityName = current.insight.evidence[0]?.['Vendor Name'] ?? current.insight.entity_key.toUpperCase();
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

      {/* The full finding for this run — reasoning, evidence table, recommended actions */}
      {headlineInsight && <RunHeadlineInsight insight={headlineInsight} />}

      {/* Headline before the collapsible detail — the analyst reads the summary first */}
      <p className="text-[11.5px] text-ink-500 leading-snug -mt-0.5">
        <span className="font-semibold text-ink-700">{entityName}</span> also flagged in
        <span className="font-semibold text-ink-700 tabular-nums"> {correlated.length}</span> other workflow{correlated.length === 1 ? '' : 's'} ·
        <span className="font-semibold text-mitigated-700 tabular-nums"> {diff.newRows.length} new</span> and
        <span className="font-semibold text-compliant-700 tabular-nums"> {diff.resolvedRows.length} resolved</span> vs the previous run.
      </p>

      {showSourceDrift && <SourceDriftBanner />}

      <MemorySection
        icon={<Network size={14} />}
        title="Cross-workflow correlation"
        subtitle="Where this entity's Stage-3 signal has surfaced in other workflows"
        right={
          <span className="inline-flex items-center rounded-full bg-canvas text-ink-500 px-2 py-0.5 text-[10.5px] font-bold tabular-nums">
            {correlated.length}
          </span>
        }
      >
        <div className="pt-2">
          <EntityCorrelation current={current} correlated={correlated} />
        </div>
      </MemorySection>

      <MemorySection
        icon={<GitCompareArrows size={14} />}
        title="Compare with previous output"
        subtitle={`vs ${diff.previous.runLabel}`}
        accent="compliant"
      >
        <div className="pt-2">
          <Stage3ComparePanel diff={diff} />
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
