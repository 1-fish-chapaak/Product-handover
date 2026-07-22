// ─── Workflow Executor — follow-up memory insights ────────────────────────
//
// Two memory-derived cards rendered in the executor's follow-up region, once a
// run completes. They extend the single "AI insight · this run" card outward in
// two directions the run itself can't see:
//
//   1. Compare with previous output — how THIS run moved vs the previous run of
//      the same workflow: the verdict (better/worse/same), how the KPIs moved
//      (with an inline before/after bar), what's new, what got fixed, what's
//      still open, and one next action.
//   2. Cross-workflow correlation — the same entity surfacing in OTHER
//      workflows: who it's about, where else it's shown up, how strong the
//      pattern is, the money involved, whether it's already on a watchlist.
//      Rendered through the shared LayeredInsightCard so it reads identically
//      to the engagement / risk / control AI-insight surfaces; the sampled
//      exception rows survive as the evidence drill-down.
//
// Presentational + light derivation only. Data comes from the shared Insight
// Memory Engine layer (RUN_OUTPUT_COMPARE / STAGE3_* / ENTITY_MEMORY), so the
// numbers always tie back to the run. Every recommendation / "what to do next"
// can seed the follow-up composer via `onAction`, threading insights into chat.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GitCompareArrows, TrendingUp, TrendingDown, Minus,
  Plus, Check, Sparkles, ArrowRight, Brain, Layers,
  ChevronDown, ScrollText,
} from 'lucide-react';
import {
  RUN_OUTPUT_COMPARE, STAGE3_CURRENT, ENTITY_MEMORY, ENTERPRISE_CONTEXT,
  PROCESS_INSIGHTS, correlatedRecords,
  type OutputCompare, type Stage3Record, type Stage3EvidenceRow,
} from '../../data/insightMemory';
import type { LayeredInsight, VerdictTone } from '../../data/layeredInsights';
import LayeredInsightCard from '../shared/LayeredInsightCard';

// ─── shared helpers ───────────────────────────────────────────────────────

const parseNum = (s: string): number => Number(s.replace(/[^0-9.-]/g, '')) || 0;
const usd0 = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// A KPI is "lower is better" unless it's a pure volume metric (rows processed),
// which is neither good nor bad on its own.
function kpiPolarity(label: string): 'lowerBetter' | 'neutral' {
  return /rows?\s*processed|records?/i.test(label) ? 'neutral' : 'lowerBetter';
}

// One recommended "what to do next" line — a full-width, single-tap action that
// seeds the follow-up composer. Reads as the natural next move off the card.
function NextAction({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group mt-3 flex w-full items-center gap-2.5 rounded-xl border border-brand-200/70 bg-brand-50/40 px-3.5 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 cursor-pointer"
    >
      <span className="size-6 shrink-0 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
        <ArrowRight size={13} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-700">What to do next</span>
        <span className="block text-[12.5px] font-semibold text-ink-800 leading-snug">{label}</span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-brand-400 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

// ─── 1. Compare with previous output ──────────────────────────────────────

const VERDICT = {
  worse: { label: 'Worse', cls: 'bg-risk-50 text-risk border-risk/25', dot: 'bg-risk', Icon: TrendingUp },
  better: { label: 'Better', cls: 'bg-compliant-50 text-compliant-700 border-compliant/25', dot: 'bg-compliant', Icon: TrendingDown },
  same: { label: 'About the same', cls: 'bg-canvas text-ink-500 border-canvas-border', dot: 'bg-ink-300', Icon: Minus },
} as const;

type Verdict = keyof typeof VERDICT;

// One KPI as a stat tile — current value is the hero, a colored delta chip
// carries the % move, and a delta-magnitude bar (scaled to the biggest mover
// across all KPIs, `maxAbsPct`) makes the three tiles genuinely comparable:
// the largest change reads longest, not every bar pinned at 100%.
function KpiTile({ kpi, maxAbsPct }: { kpi: OutputCompare['kpiDeltas'][number]; maxAbsPct: number }) {
  const prev = parseNum(kpi.previous);
  const cur = parseNum(kpi.current);
  const pct = prev ? Math.round(((cur - prev) / prev) * 100) : 0;

  const polarity = kpiPolarity(kpi.label);
  const isBad = polarity === 'lowerBetter' && kpi.direction === 'up';
  const isGood = polarity === 'lowerBetter' && kpi.direction === 'down';
  const chipCls = isBad ? 'text-risk bg-risk-50' : isGood ? 'text-compliant-700 bg-compliant-50' : 'text-ink-500 bg-canvas';
  const barCls = isBad ? 'bg-risk-400' : isGood ? 'bg-compliant-500' : 'bg-brand-300';
  const Arrow = kpi.direction === 'up' ? TrendingUp : kpi.direction === 'down' ? TrendingDown : Minus;
  const barW = maxAbsPct ? Math.max(6, (Math.abs(pct) / maxAbsPct) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-canvas-border bg-canvas-elevated p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400 leading-tight">{kpi.label}</span>
        {kpi.direction !== 'flat' && (
          <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold shrink-0 ${chipCls}`}>
            <Arrow size={10} />{pct > 0 ? '+' : ''}{pct}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[22px] font-bold font-mono text-ink-900 leading-none tracking-tight">{kpi.current}</span>
      </div>
      <div className="text-[11px] font-mono text-ink-400">from {kpi.previous}</div>
      <div className="mt-0.5 h-1.5 rounded-full bg-canvas overflow-hidden" title={`${Math.abs(pct)}% change`}>
        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${barW}%` }} />
      </div>
    </div>
  );
}

// One small "what changed" column — new / fixed / still-open.
function DiffColumn({
  Icon, label, count, tone, children,
}: {
  Icon: typeof Plus; label: string; count: number;
  tone: 'new' | 'fixed' | 'open'; children?: React.ReactNode;
}) {
  const tint =
    tone === 'new' ? 'border-mitigated-200 bg-mitigated-50/40'
    : tone === 'fixed' ? 'border-compliant/25 bg-compliant-50/25'
    : 'border-canvas-border bg-canvas/50';
  const head =
    tone === 'new' ? 'text-mitigated-700'
    : tone === 'fixed' ? 'text-compliant-700'
    : 'text-ink-500';
  return (
    <div className={`rounded-xl border p-2.5 ${tint}`}>
      <div className={`flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider ${head}`}>
        <Icon size={12} /> {label}
        <span className="ml-auto text-[13px] font-bold tabular-nums leading-none">{count}</span>
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function OutputComparePanel({
  compare = RUN_OUTPUT_COMPARE,
  entityLabel,
  onAction,
}: {
  compare?: OutputCompare;
  entityLabel?: string;
  onAction?: (query: string) => void;
}) {
  const entity = entityLabel
    ?? (STAGE3_CURRENT.insight.evidence[0]?.['Vendor Name']?.split(' ')[0]) // "MCKESSON"
    ?? 'this run';

  // Verdict: weigh how the "lower is better" KPIs moved.
  const badMoves = compare.kpiDeltas.filter(k => kpiPolarity(k.label) === 'lowerBetter' && k.direction === 'up').length;
  const goodMoves = compare.kpiDeltas.filter(k => kpiPolarity(k.label) === 'lowerBetter' && k.direction === 'down').length;
  const verdict: Verdict = badMoves > goodMoves ? 'worse' : goodMoves > badMoves ? 'better' : 'same';
  const v = VERDICT[verdict];

  // Headline % from the exceptions KPI (the metric the verdict hangs on).
  const excKpi = compare.kpiDeltas.find(k => /exception|error|flag/i.test(k.label)) ?? compare.kpiDeltas[0];
  const excPct = excKpi ? Math.round(((parseNum(excKpi.current) - parseNum(excKpi.previous)) / (parseNum(excKpi.previous) || 1)) * 100) : 0;
  const dirWord = excPct > 0 ? 'up' : excPct < 0 ? 'down' : 'flat';

  const newCount = compare.newFindings.length;
  const takeaway =
    newCount > 0
      ? `A new ${entity} cluster appeared, and exceptions are ${dirWord} ${Math.abs(excPct)}% since your last run.`
      : `No new clusters this run — exceptions are ${dirWord} ${Math.abs(excPct)}% since your last run.`;

  const nextAction = newCount > 0
    ? `Triage the ${newCount} new finding${newCount === 1 ? '' : 's'} first — ${compare.newFindings[0].detail.split('—')[0].trim()}`
    : 'Confirm the carried-over items are still expected';

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden"
    >
      <div className="p-4">
        {/* Header — label + verdict */}
        <div className="flex items-center gap-2">
          <span className="size-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
            <GitCompareArrows size={13} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">Compared to last run</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[10px] font-bold border border-brand-100">
            <Sparkles size={10} /> AI Insight
          </span>
          <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${v.cls}`}>
            <v.Icon size={11} /> {v.label}
          </span>
        </div>

        {/* Takeaway */}
        <h4 className="text-[15px] font-bold text-ink-900 leading-snug mt-2.5">{takeaway}</h4>
        <p className="text-[11.5px] text-ink-400 mt-1">
          vs <span className="font-medium text-ink-600">{compare.previousRunLabel}</span> · {compare.previousRunDate}
        </p>

        {/* How the KPIs moved — stat tiles with a shared-axis delta bar */}
        <div className="mt-3 rounded-xl border border-canvas-border bg-canvas/40 p-3">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">How the KPIs moved</span>
            <span className="text-[10px] text-ink-300">bar = size of change</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(() => {
              const maxAbsPct = Math.max(
                1,
                ...compare.kpiDeltas.map((k) => {
                  const p = parseNum(k.previous);
                  const c = parseNum(k.current);
                  return p ? Math.abs(Math.round(((c - p) / p) * 100)) : 0;
                }),
              );
              return compare.kpiDeltas.map((k) => <KpiTile key={k.label} kpi={k} maxAbsPct={maxAbsPct} />);
            })()}
          </div>
        </div>

        {/* What's new / fixed / still open */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <DiffColumn Icon={Plus} label="New" count={newCount} tone="new">
            {newCount > 0 ? (
              <ul className="space-y-1">
                {compare.newFindings.map((f) => (
                  <li key={f.ref} className="text-[11.5px] text-ink-700 leading-snug">
                    <span className="font-mono text-[10px] text-mitigated-700">{f.ref}</span>
                    <span className="block text-ink-600">{f.detail}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[11.5px] text-ink-400">Nothing new.</p>}
          </DiffColumn>

          <DiffColumn Icon={Check} label="Fixed" count={compare.resolvedFindings.length} tone="fixed">
            {compare.resolvedFindings.length > 0 ? (
              <ul className="space-y-1">
                {compare.resolvedFindings.map((f) => (
                  <li key={f.ref} className="text-[11.5px] text-ink-600 leading-snug">
                    <span className="font-mono text-[10px] text-compliant-700">{f.ref}</span>
                    <span className="block line-through decoration-ink-300">{f.detail}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[11.5px] text-ink-400">None cleared.</p>}
          </DiffColumn>

          <DiffColumn Icon={Layers} label="Still open" count={compare.carriedOver} tone="open">
            <p className="text-[11.5px] text-ink-500 leading-snug">
              known item{compare.carriedOver === 1 ? '' : 's'} carried over from before, still unresolved.
            </p>
          </DiffColumn>
        </div>

        <NextAction label={nextAction} onClick={onAction ? () => onAction(nextAction) : undefined} />
      </div>
    </motion.section>
  );
}

// ─── 2. Cross-workflow correlation ────────────────────────────────────────

const STAGE3_SEV: Record<Stage3Record['insight']['severity'], LayeredInsight['severity']> = {
  high: 'high', medium: 'med', low: 'low',
};
const STAGE3_TONE: Record<Stage3Record['insight']['severity'], VerdictTone> = {
  high: 'negative', medium: 'caution', low: 'positive',
};

// A one-line "why it flagged" from a record's own evidence — dominant remark +
// where it hit. No bespoke summary field needed.
function detailFor(rec: Stage3Record): string {
  const rows = rec.insight.evidence;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r['Exception Remark'], (counts.get(r['Exception Remark']) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'flagged';
  const contracts = [...new Set(rows.map((r) => r['Contract Ref Id']))];
  const where = contracts.length === 1 ? ` · ${contracts[0]}` : contracts.length > 1 ? ` · ${contracts.length} contracts` : '';
  return `${top}${where}`;
}

const sumPaid = (rec: Stage3Record) =>
  rec.insight.evidence.reduce((s, r: Stage3EvidenceRow) => s + (r['Chargeback Paid'] ?? 0), 0);

const fmtMoney = (n: number | null): string => (n == null ? '—' : `$${n.toFixed(2)}`);

// Collapsible sampled-rows table — the exception rows behind the correlation
// (Product · Contract · Exception · Paid · WAC · Contract $ · Revised · Diff),
// with a leading Source column so the same entity's rows read across the
// different checks that flagged it. Nests inside the LayeredInsightCard's
// evidence drill-down, one level deeper than the per-run evidence rows.
function CorrelationEvidenceTable({
  rows,
  checks,
}: {
  rows: { row: Stage3EvidenceRow; workflow: string }[];
  checks: number;
}) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-canvas-border bg-canvas/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-canvas transition-colors"
      >
        <ScrollText size={13} className="text-ink-400" />
        <span className="text-[11px] font-semibold text-ink-800">Sampled rows</span>
        <span className="text-[10px] text-ink-400">{rows.length} rows across {checks} checks</span>
        <ChevronDown size={13} className={`ml-auto text-ink-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-canvas-border/60">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-[10.5px] border-collapse">
                  <thead>
                    <tr className="text-ink-400">
                      <th className="text-left font-semibold uppercase tracking-wider py-1 pr-2">Source</th>
                      <th className="text-left font-semibold uppercase tracking-wider py-1 pr-2">Product</th>
                      <th className="text-left font-semibold uppercase tracking-wider py-1 pr-2">Contract</th>
                      <th className="text-left font-semibold uppercase tracking-wider py-1 pr-2">Exception</th>
                      <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">Paid</th>
                      <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">WAC</th>
                      <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">Contract $</th>
                      <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">Revised</th>
                      <th className="text-right font-semibold uppercase tracking-wider py-1">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ row: r, workflow }, i) => {
                      const diff = r['Chargeback Difference'];
                      return (
                        <tr key={i} className="border-t border-canvas-border/60 align-top">
                          <td className="py-1.5 pr-2">
                            <span className="inline-flex items-center rounded-md bg-brand-50 text-brand-700 px-1.5 py-0.5 text-[9.5px] font-semibold whitespace-nowrap">
                              {workflow}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2 text-ink-800 font-medium max-w-[180px]">
                            {r['Product Name']}
                            <span className="block font-mono text-ink-400 text-[9.5px]">{r['Product Ref Id']}</span>
                          </td>
                          <td className="py-1.5 pr-2 font-mono text-ink-500 whitespace-nowrap">{r['Contract Ref Id']}</td>
                          <td className="py-1.5 pr-2 text-ink-600">{r['Exception Remark']}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmtMoney(r['Chargeback Paid'])}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmtMoney(r['WAC Price Per Master'])}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmtMoney(r['Contract Price Per Master'])}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmtMoney(r['Revised Chargeback Amount'])}</td>
                          <td className={`py-1.5 text-right tabular-nums font-semibold ${diff != null && diff < 0 ? 'text-risk' : 'text-ink-500'}`}>
                            {diff != null ? diff.toFixed(2) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-[10px] text-ink-400 mt-1.5">Sampled exception rows · dollar amounts</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CrossWorkflowCorrelationPanel({
  current = STAGE3_CURRENT,
  correlated = correlatedRecords(STAGE3_CURRENT),
  onAction,
}: {
  current?: Stage3Record;
  correlated?: Stage3Record[];
  onAction?: (query: string) => void;
}) {
  const displayName = current.insight.evidence[0]?.['Vendor Name'] ?? current.insight.entity_key.toUpperCase();
  const shortName = displayName.split(' ')[0];
  const watch = ENTITY_MEMORY[displayName];
  const watchEntry = ENTERPRISE_CONTEXT.find((e) => e.fact.toUpperCase().includes(shortName.toUpperCase()));

  // What flagged it in THIS run — prefer the authored lead-insight KPI, else a
  // derived remark line.
  const lead = PROCESS_INSIGHTS.find((i) => i.scope === current.workflow);
  const currentRunFlag = lead?.evidence.kpiValues?.[0]?.value
    ? `${lead.evidence.kpiValues[0].value} exceptions in this run`
    : detailFor(current);

  const allRecords = [current, ...correlated];
  const checks = new Set(allRecords.map((r) => r.workflow)).size;
  const totalPaid = allRecords.reduce((s, r) => s + sumPaid(r), 0);
  // Sampled exception rows across every check that flagged the entity — the
  // evidence behind the correlation, tagged with the workflow they came from.
  const evidenceRows = allRecords.flatMap((rec) =>
    rec.insight.evidence.map((row) => ({ row, workflow: rec.workflow })),
  );
  const entityType = current.insight.entity_type;

  const insight: LayeredInsight = {
    id: `xwf-${current.insight.entity_key.replace(/\s+/g, '-')}`,
    layer: 'control',
    subjectId: current.insight.entity_key,
    subjectLabel: displayName,
    takeaway: watch?.onWatch
      ? `${shortName} shows up in ${checks} different checks — and it's already on a watchlist.`
      : `${shortName} shows up in ${checks} different checks, not just this one.`,
    verdict:
      checks >= 3 ? { label: 'Strong pattern', tone: 'negative' }
      : checks === 2 ? { label: 'Moderate pattern', tone: 'caution' }
      : { label: 'Emerging pattern', tone: 'caution' },
    severity: STAGE3_SEV[current.insight.severity],
    likelyCause: watch?.onWatch
      ? {
          label: `${displayName} is already on a standing watch${watchEntry ? ` — since ${watchEntry.approvedOn}` : ''}.`,
          detail: `${watch.watchNote ? `${watch.watchNote} ` : ''}The same ${entityType} failing ${checks} unrelated checks points at one upstream driver, not ${checks} coincidences.`,
        }
      : {
          label: 'One upstream driver, not check-specific noise.',
          detail: `The same ${entityType} failing ${checks} unrelated checks points at a shared upstream cause. Confirm against the ${entityType} master before concluding.`,
        },
    reasoning: `The ${checks} checks flag one ${entityType}, not ${checks} separate problems. This run's ${shortName} exceptions overlap the ${correlated.length} earlier run${correlated.length === 1 ? '' : 's'}, so memory counts the pattern once — it is not new noise.`,
    atStake: `${usd0(totalPaid)} flagged across sampled rows in ${checks} checks — sampled rows only, the full population is larger. This run: ${currentRunFlag}.`,
    factors: { frequency: 0.72, sourceDiversity: 0.9, recency: 0.96, businessImpact: 0.7 },
    confidenceOverride: current.insight.confidence,
    evidence: [
      {
        ref: current.runDate,
        label: `${current.workflow} — this run · ${currentRunFlag}`,
        detail: `${Math.round(current.insight.confidence * 100)}%`,
        tone: STAGE3_TONE[current.insight.severity],
      },
      ...correlated.map((rec) => ({
        ref: rec.runDate,
        label: `${rec.workflow} — ${detailFor(rec)}`,
        detail: `${Math.round(rec.insight.confidence * 100)}%`,
        tone: STAGE3_TONE[rec.insight.severity],
      })),
    ],
    evidenceNote: `${evidenceRows.length} sampled rows across ${checks} checks · entity correlation, not yet a confirmed shared root cause.`,
    runsAnalysed: allRecords.length,
    detectedOn: current.runDate,
    detectedBy: 'traceable',
    rollupOf: { label: 'checks', count: checks },
    checkMore: [
      { kind: 'trace', label: `Open a cross-workflow review of ${shortName}` },
      { kind: 'compare', label: 'Compare how each check scored it' },
      { kind: 'ask', label: watch?.onWatch ? 'Ask what changed since it went on watch' : 'Ask whether these share a root cause' },
    ],
    recommendedActions: [],
    recommendations: [
      {
        id: 'xwf-rec-review', category: 'monitoring', priority: 'do-now',
        title: `Open a cross-workflow review of ${displayName}.`,
        rationale: `${checks} checks flagging one ${entityType} is a concentration — review them together before grading each finding alone.`,
      },
      {
        id: 'xwf-rec-aggregate', category: 'deficiency', priority: 'this-period',
        title: `Aggregate the ${checks} findings by assertion before grading severity.`,
        rationale: 'Findings that share an entity can aggregate to a higher severity than any single check suggests.',
        guardrail: 'Severity stays a human call.',
      },
      {
        id: 'xwf-rec-cause', category: 'root-cause', priority: 'this-period',
        title: `Confirm whether all ${checks} checks trace to the same ${entityType} master data.`,
        rationale: 'If one feed drives them all, one fix clears them together — and grading them separately overstates the population.',
      },
      ...(watch?.onWatch && correlated.length > 0
        ? [{
            id: 'xwf-rec-watch', category: 'monitoring' as const, priority: 'advisory' as const,
            title: `Extend the standing watch to cover the other ${correlated.length} check${correlated.length === 1 ? '' : 's'} that flagged it.`,
            rationale: 'The watch predates this run; the correlation shows the exposure is wider than the check it was raised on.',
          }]
        : []),
    ],
  };

  return (
    <LayeredInsightCard
      insight={insight}
      headerLabel="across workflows"
      evidenceLabel="Evidence · runs across checks"
      evidenceExtra={<CorrelationEvidenceTable rows={evidenceRows} checks={checks} />}
      onCheckMore={onAction ? (opt) => onAction(opt.detail ? `${opt.label} — ${opt.detail}` : opt.label) : undefined}
      onRec={onAction}
    />
  );
}

// ─── Composed band ────────────────────────────────────────────────────────
// The two cards together, under one "memory looked beyond this run" heading —
// dropped into the executor's follow-up region above the composer.

export default function WorkflowFollowUpInsights({
  onAction,
}: {
  onAction?: (query: string) => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className="mt-5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <span className="size-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
          <Brain size={13} />
        </span>
        <h3 className="text-[13px] font-bold text-ink-800">Ira looked beyond this run</h3>
      </div>

      <div className="flex flex-col gap-3">
        <OutputComparePanel onAction={onAction} />
        <CrossWorkflowCorrelationPanel onAction={onAction} />
      </div>
    </motion.section>
  );
}
