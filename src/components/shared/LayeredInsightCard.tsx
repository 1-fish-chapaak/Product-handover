// ─── Layered Insight Card — Control · Risk · Engagement ────────────────────
//
// One card that renders the PRD anatomy at any of the three higher altitudes,
// adapting density by layer: "deep" for a control (full reasoning, confirmed
// root cause, evidence rows, the complete fix) and "light" for a risk or an
// engagement (verdict-led, leans on the layer below for detail). Reads the
// token-agnostic layeredInsights data layer and maps tone/severity to the
// Editorial-GRC palette so it sits native beside the surrounding UI.
//
// Presentational only. The caller supplies the insight (from buildLayeredInsight)
// and the approval handlers.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, DollarSign, Layers, ChevronDown, ArrowRight, ShieldCheck,
  Info, Crosshair, Split, GitCompareArrows, MessageCircleQuestion,
  ScrollText, TriangleAlert, X, MessageSquare, ArrowUpRight,
  ShieldAlert, SlidersHorizontal, FileCheck2, Scale, ListChecks,
  Gauge, CalendarClock, Zap, Users, Activity, type LucideIcon,
} from 'lucide-react';
import {
  displayConfidencePct, CONFIDENCE_FACTOR_META, MEMORY_CANDIDATE_THRESHOLD,
} from '../../data/insightMemory';
import {
  LAYER_META, REC_CATEGORY_META, REC_PRIORITY_META,
  type LayeredInsight, type VerdictTone, type CheckMoreOption,
  type RecCategory, type RecPriority,
} from '../../data/layeredInsights';
import { openInChat as openChatTab } from './insightChat';

// Category → icon (REC_CATEGORY_META carries the name; the card owns the component).
const REC_ICON: Record<RecCategory, LucideIcon> = {
  coverage: ShieldAlert, sampling: SlidersHorizontal, evidence: FileCheck2,
  'root-cause': Crosshair, deficiency: Scale, scoping: ListChecks, rating: Gauge,
  timeliness: CalendarClock, automation: Zap, segregation: Users, monitoring: Activity,
};
const PRIORITY_RANK: Record<RecPriority, number> = { 'do-now': 0, 'this-period': 1, advisory: 2 };
const REC_CAP = 4;

// ─── Tone → Editorial-GRC palette ─────────────────────────────────────────

const TONE: Record<VerdictTone, { pill: string; dot: string; wrap: string; text: string; soft: string }> = {
  negative: { pill: 'bg-risk-50 text-risk border-risk/25',           dot: 'bg-risk',           wrap: 'bg-risk-50 text-risk',                 text: 'text-risk',           soft: 'border-risk/20 bg-risk-50/40' },
  caution:  { pill: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200', dot: 'bg-mitigated-500', wrap: 'bg-mitigated-50 text-mitigated-700', text: 'text-mitigated-700', soft: 'border-mitigated-200 bg-mitigated-50/40' },
  positive: { pill: 'bg-compliant-50 text-compliant-700 border-compliant-200', dot: 'bg-compliant',     wrap: 'bg-compliant-50 text-compliant-700', text: 'text-compliant-700', soft: 'border-compliant-200 bg-compliant-50/40' },
};

const SEV_TONE: Record<LayeredInsight['severity'], VerdictTone> = { high: 'negative', med: 'caution', low: 'positive' };
const SEV_LABEL: Record<LayeredInsight['severity'], string> = { high: 'High', med: 'Medium', low: 'Low' };

const CHECK_ICON: Record<CheckMoreOption['kind'], typeof Crosshair> = {
  compare: GitCompareArrows, split: Split, trace: Crosshair, ask: MessageCircleQuestion,
};

function confDot(pct: number): string {
  if (pct >= 70) return 'rgb(21 128 61)';       // compliant
  if (pct >= MEMORY_CANDIDATE_THRESHOLD * 100) return 'rgb(180 83 9)'; // mitigated
  return 'rgb(154 143 174)';                     // ink-400
}

// ─── Confidence pill (three axes, popover breakdown) ───────────────────────

function ConfidencePill({ insight }: { insight: LayeredInsight }) {
  const [open, setOpen] = useState(false);
  const pct = displayConfidencePct(insight);
  const engineScored = insight.confidenceOverride != null;
  const candidate = pct >= MEMORY_CANDIDATE_THRESHOLD * 100;
  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-canvas-border bg-canvas-elevated px-2 py-0.5 text-[11px] font-semibold text-ink-800 hover:border-brand-300 transition-colors cursor-pointer"
        title="How this confidence was scored"
      >
        <span className="size-1.5 rounded-full" style={{ background: confDot(pct) }} />
        {pct}% confidence
        <Info size={11} className="text-ink-400" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-30 mt-2 w-[300px] rounded-xl border border-canvas-border bg-canvas-elevated shadow-xl p-3.5"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[12px] font-bold text-ink-800">Confidence — three axes</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-ink-400 hover:text-ink-700 cursor-pointer"><X size={13} /></button>
            </div>
            {engineScored ? (
              <p className="text-[11.5px] text-ink-600 leading-relaxed">
                Engine-scored composite of evidence strength, materiality and novelty. The three axes gate independently — a thin-evidence finding is capped on “real”, never floated by dollars. See the evidence note on the card.
              </p>
            ) : (
              <div className="space-y-2.5">
                {CONFIDENCE_FACTOR_META.map(m => {
                  const v = Math.round(insight.factors[m.key] * 100);
                  return (
                    <div key={m.key}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-ink-800">{m.label}</span>
                        <span className="font-bold tabular-nums text-ink-800">{v}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-canvas mt-1 overflow-hidden">
                        <div className={`h-full rounded-full ${v >= 70 ? 'bg-compliant' : v >= 45 ? 'bg-mitigated-500' : 'bg-ink-300'}`} style={{ width: `${v}%` }} />
                      </div>
                      <p className="text-[10px] text-ink-400 mt-0.5">{m.hint}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 pt-2.5 border-t border-canvas-border flex items-center justify-between">
              <span className="text-[10px] text-ink-400 font-mono">real · materiality · novelty</span>
              <span className={`text-[11px] font-bold ${candidate ? 'text-compliant-700' : 'text-ink-400'}`}>{pct}% {candidate ? '· candidate' : '· below gate'}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Evidence label per altitude ───────────────────────────────────────────

const EVIDENCE_LABEL: Record<LayeredInsight['layer'], string> = {
  control: 'Evidence · runs and rows',
  risk: 'Evidence · controls under this risk',
  engagement: 'Evidence · risks and controls',
};

// ─── The card ──────────────────────────────────────────────────────────────

export default function LayeredInsightCard({
  insight, onCheckMore,
}: {
  insight: LayeredInsight;
  /** Optional override for a "check more" chip; defaults to opening it in chat. */
  onCheckMore?: (opt: CheckMoreOption) => void;
}) {
  const meta = LAYER_META[insight.layer];
  const deep = meta.density === 'deep';
  // Open evidence by default only on a material control finding — a clean/on-track
  // card has a single evidence row and reads tidier collapsed.
  const [showEvidence, setShowEvidence] = useState(deep && insight.verdict.tone !== 'positive');
  const vTone = TONE[insight.verdict.tone];
  const sevTone = TONE[SEV_TONE[insight.severity]];
  // Typed recommendations, most-urgent first.
  const recs = [...(insight.recommendations ?? [])].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  // Open an action / follow-up in Ask IRA (new tab), carrying the subject as context.
  const openInChat = (ask: string) => openChatTab(ask, insight.subjectLabel);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className="rounded-2xl border border-brand-200/70 bg-gradient-to-b from-brand-50/45 to-canvas-elevated overflow-hidden"
    >
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="size-6 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
            <Sparkles size={13} aria-hidden="true" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">AI insight · {meta.label}</span>
          <span className="font-mono text-[10px] text-ink-400 hidden sm:inline">Insight Memory Engine</span>
          <div className="ml-auto flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${vTone.pill}`}>
              <span className={`size-1.5 rounded-full ${vTone.dot}`} /> {insight.verdict.label}
            </span>
            {/* A signed pass has no "finding confidence" to report — the confidence
                axes describe the strength of a finding, so hide them on positive verdicts. */}
            {insight.verdict.tone === 'positive'
              ? <span className="inline-flex items-center gap-1 rounded-full border border-compliant-200 bg-compliant-50 px-2 py-0.5 text-[10px] font-semibold text-compliant-700"><ShieldCheck size={10} /> Signed pass</span>
              : <ConfidencePill insight={insight} />}
          </div>
        </div>

        {/* Takeaway */}
        <h4 className="text-[15.5px] font-bold text-ink-900 leading-snug mt-3">{insight.takeaway}</h4>

        {/* Severity + rollup meta */}
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${sevTone.pill} border`}>
            {insight.severityLabel ?? `Severity: ${SEV_LABEL[insight.severity]}`}
          </span>
          {insight.rollupOf && insight.rollupOf.count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-canvas text-ink-500 px-2 py-0.5 text-[10px] font-semibold">
              <Layers size={10} aria-hidden="true" /> Rolls up {insight.rollupOf.count} {insight.rollupOf.count === 1 ? insight.rollupOf.label.replace(/s$/, '') : insight.rollupOf.label}
            </span>
          )}
          {insight.evidenceNote && (
            <span className="text-[10.5px] text-ink-400 tabular-nums">{insight.evidenceNote}</span>
          )}
        </div>

        {/* Engagement readiness progress */}
        {insight.progress && (
          <div className="mt-3 rounded-xl border border-canvas-border bg-canvas-elevated p-3">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-semibold text-ink-700">Readiness</span>
              <span className="tabular-nums text-ink-800 font-bold">{insight.progress.done} of {insight.progress.total} controls concluded</span>
            </div>
            <div className="h-2 rounded-full bg-canvas overflow-hidden">
              <div className={`h-full rounded-full ${vTone.dot}`} style={{ width: `${Math.round((insight.progress.done / insight.progress.total) * 100)}%` }} />
            </div>
            <p className="text-[11px] text-mitigated-700 mt-1.5 flex items-center gap-1"><TriangleAlert size={11} /> {insight.progress.note}</p>
          </div>
        )}

        {/* Reasoning takes the wide box — it's text-heavy — while the short facts
            (at stake + the confirm-first root cause) stack in the second column. */}
        <div className="grid lg:grid-cols-2 gap-3 mt-3">
          {/* Reasoning · counted once — the prominent, text-heavy box */}
          <div className={`rounded-xl border ${vTone.soft} p-3.5`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                <Layers size={12} className="text-brand-600" aria-hidden="true" /> Reasoning · counted once
              </span>
            </div>
            <p className="text-[12px] text-ink-700 leading-relaxed">{insight.reasoning}</p>
          </div>

          {/* At stake + root cause, stacked in the second column */}
          <div className="grid gap-3 content-start">
            <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">
                <DollarSign size={12} className="text-risk" aria-hidden="true" /> Money / resource at stake
              </div>
              <p className="text-[12px] text-ink-700 leading-snug">{insight.atStake}</p>
            </div>
            <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  <Crosshair size={12} className="text-ink-500" aria-hidden="true" /> Root cause
                </span>
                {insight.likelyCause.confirmFirst && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-canvas-elevated border border-mitigated-200 px-2 py-0.5 text-[9px] font-bold text-mitigated-700">
                    <Info size={9} /> Confirm first
                  </span>
                )}
              </div>
              <p className="text-[12px] font-semibold text-ink-900 leading-snug">{insight.likelyCause.label}</p>
              <p className="text-[12px] text-ink-600 leading-relaxed mt-0.5">{insight.likelyCause.detail}</p>
            </div>
          </div>
        </div>

        {/* Toolbar — evidence toggle + check-more on one line, so neither claims a row of its own */}
        {(insight.evidence.length > 0 || insight.checkMore.length > 0) && (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {insight.evidence.length > 0 && (
                <button
                  type="button" onClick={() => setShowEvidence(v => !v)} aria-expanded={showEvidence}
                  className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer"
                >
                  <motion.span animate={{ rotate: showEvidence ? 0 : -90 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex">
                    <ChevronDown size={14} aria-hidden="true" />
                  </motion.span>
                  <ScrollText size={12} aria-hidden="true" /> {EVIDENCE_LABEL[insight.layer]} · {insight.evidence.length}
                </button>
              )}
              {insight.evidence.length > 0 && insight.checkMore.length > 0 && (
                <span className="h-3.5 w-px bg-canvas-border mx-1 hidden sm:block" aria-hidden="true" />
              )}
              {insight.checkMore.map((opt, i) => {
                const Icon = CHECK_ICON[opt.kind];
                return (
                  <button
                    key={i} type="button"
                    onClick={() => (onCheckMore ? onCheckMore(opt) : openInChat(opt.detail ? `${opt.label} — ${opt.detail}` : opt.label))}
                    title="Ask this in Ask IRA (new tab)"
                    className="group inline-flex items-center gap-1.5 rounded-full border border-canvas-border bg-canvas-elevated px-2.5 py-1 text-[11px] font-medium text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer transition-colors"
                  >
                    <Icon size={12} className="text-ink-400 group-hover:text-brand-600" aria-hidden="true" />
                    {opt.label}
                    {opt.detail && <span className="text-ink-400">· {opt.detail}</span>}
                    <ArrowUpRight size={11} className="text-ink-300 group-hover:text-brand-600" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <AnimatePresence initial={false}>
              {insight.evidence.length > 0 && showEvidence && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden"
                >
                  <div className="mt-2 rounded-lg border border-canvas-border divide-y divide-canvas-border overflow-hidden">
                    {insight.evidence.map((e, i) => {
                      const t = e.tone ? TONE[e.tone] : null;
                      return (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 text-[11.5px] bg-canvas-elevated">
                          {t && <span className={`size-1.5 rounded-full shrink-0 ${t.dot}`} />}
                          <span className="font-mono text-[10.5px] text-ink-500 shrink-0 w-[152px] truncate hidden sm:block">{e.ref}</span>
                          <span className="font-medium text-ink-800 min-w-0 truncate flex-1">{e.label}</span>
                          <span className={`ml-auto shrink-0 tabular-nums ${t ? t.text : 'text-ink-500'}`}>{e.detail}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Recommended actions — the fix, foregrounded. Each step is clickable and
            opens in Ask IRA (new tab) with the step pre-filled in the composer. */}
        {recs.length > 0 ? (
          <div className="mt-3 rounded-xl bg-brand-50/60 border border-brand-100 p-3.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-2">
              <Sparkles size={12} className="text-brand-600" aria-hidden="true" />
              Recommended actions
              <span className="text-brand-600/70">· {recs.length}</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-100/70 px-2 py-0.5 text-[9px] font-semibold text-brand-700 normal-case tracking-normal">
                <MessageSquare size={10} aria-hidden="true" /> Click one to work it in chat
              </span>
            </div>
            <ul className="space-y-1 -mx-1">
              {recs.slice(0, REC_CAP).map((r) => {
                const CatIcon = REC_ICON[r.category];
                const pTone = TONE[REC_PRIORITY_META[r.priority].tone];
                return (
                  <li key={r.id}>
                    <button
                      type="button" onClick={() => openInChat(r.title)}
                      title="Open this recommendation in Ask IRA (new tab)"
                      className="group w-full text-left rounded-lg px-2 py-2 hover:bg-brand-100/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-canvas-elevated border border-canvas-border px-2 py-0.5 text-[9px] font-bold text-ink-600">
                          <CatIcon size={9} aria-hidden="true" /> {REC_CATEGORY_META[r.category].label}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${pTone.pill}`}>
                          <span className={`size-1 rounded-full ${pTone.dot}`} /> {REC_PRIORITY_META[r.priority].label}
                        </span>
                        <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600/70 group-hover:text-brand-700 transition-colors">
                          <MessageSquare size={11} aria-hidden="true" />
                          <span className="hidden sm:inline">Open in chat</span>
                          <ArrowUpRight size={10} aria-hidden="true" />
                        </span>
                      </div>
                      <p className="text-[12px] font-semibold text-ink-900 leading-snug">{r.title}</p>
                      <p className="text-[11px] text-ink-500 leading-relaxed mt-0.5">{r.rationale}</p>
                      {(r.basis || r.guardrail) && (
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {r.basis && <span className="font-mono text-[9.5px] text-ink-400">{r.basis}</span>}
                          {r.guardrail && <span className="inline-flex items-center gap-1 text-[9.5px] text-mitigated-700"><ShieldCheck size={9} aria-hidden="true" /> {r.guardrail}</span>}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {recs.length > REC_CAP && (
              <p className="text-[10px] text-ink-400 mt-1.5 px-1">+{recs.length - REC_CAP} more — ask IRA to walk the full set.</p>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-brand-50/60 border border-brand-100 p-3.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-2">
              <ArrowRight size={12} className="text-brand-600" aria-hidden="true" /> What to do next
            </div>
            <ul className="space-y-0.5 -mx-1">
              {insight.recommendedActions.map((a, i) => (
                <li key={i}>
                  <button type="button" onClick={() => openInChat(a)} title="Open this step in Ask IRA (new tab)"
                    className="group w-full flex items-start gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-brand-100/70 transition-colors cursor-pointer">
                    <span className="flex-1 text-[12px] text-ink-800 leading-relaxed group-hover:text-ink-900">{a}</span>
                    <span className="shrink-0 mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600/70 group-hover:text-brand-700">
                      <MessageSquare size={12} aria-hidden="true" /> <span className="hidden sm:inline">Open in chat</span> <ArrowUpRight size={11} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.section>
  );
}
