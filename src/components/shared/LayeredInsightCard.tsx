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
//
// Collapsible mode: when the card lives inside a stack of many insights
// (InsightStack), the caller drives an `open` flag. Collapsed, the card keeps a
// calm, scannable summary (identity · verdict · confidence · takeaway) and hides
// the heavy body; expanded, it lights up in brand and shows everything. Brand is
// reserved for the active row so a 10-insight stack reads calm, not shouty.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, DollarSign, Layers, ChevronDown, ArrowRight, ShieldCheck,
  Info, Crosshair, Split, GitCompareArrows, MessageCircleQuestion,
  ScrollText, TriangleAlert, X, MessageSquare, ArrowUpRight,
} from 'lucide-react';
import {
  displayConfidencePct, CONFIDENCE_FACTOR_META, MEMORY_CANDIDATE_THRESHOLD,
} from '../../data/insightMemory';
import {
  LAYER_META, REC_PRIORITY_META,
  type LayeredInsight, type VerdictTone, type CheckMoreOption,
  type RecPriority,
} from '../../data/layeredInsights';
import { openInChat as openChatTab } from './insightChat';

const PRIORITY_RANK: Record<RecPriority, number> = { 'do-now': 0, 'this-period': 1, advisory: 2 };
const REC_CAP = 6;

// ─── Tone → Editorial-GRC palette ─────────────────────────────────────────

const TONE: Record<VerdictTone, { pill: string; dot: string; wrap: string; text: string; soft: string; accent: string }> = {
  negative: { pill: 'bg-risk-50 text-risk border-risk/25',           dot: 'bg-risk',           wrap: 'bg-risk-50 text-risk',                 text: 'text-risk',           soft: 'border-risk/20 bg-risk-50/40',           accent: '#B42318' },
  caution:  { pill: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200', dot: 'bg-mitigated-500', wrap: 'bg-mitigated-50 text-mitigated-700', text: 'text-mitigated-700', soft: 'border-mitigated-200 bg-mitigated-50/40', accent: '#B45309' },
  positive: { pill: 'bg-compliant-50 text-compliant-700 border-compliant-200', dot: 'bg-compliant',     wrap: 'bg-compliant-50 text-compliant-700', text: 'text-compliant-700', soft: 'border-compliant-200 bg-compliant-50/40', accent: '#15803D' },
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

// ─── Recommended-action tile (grid cell) ───────────────────────────────────
// Pared to the essential: the imperative, and nothing else. Priority survives as
// the subtle left colour rail (recs are also priority-sorted), so five real
// recommendations read as a clean two-column list. The whole tile opens the step
// in Ask IRA — where the full rationale and methodology live.

function RecTile({ r, onOpen }: { r: NonNullable<LayeredInsight['recommendations']>[number]; onOpen: () => void }) {
  const pTone = TONE[REC_PRIORITY_META[r.priority].tone];
  return (
    <button
      type="button" onClick={onOpen}
      title="Open this recommendation in Ask IRA (new tab)"
      style={{ borderLeftColor: pTone.accent }}
      className="group flex w-full items-start gap-2 text-left rounded-lg border border-canvas-border border-l-2 bg-canvas-elevated py-2.5 pl-3 pr-2.5 hover:border-brand-300 hover:bg-brand-50/40 transition-colors cursor-pointer"
    >
      <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-ink-900 leading-snug line-clamp-2 group-hover:text-brand-700 transition-colors">{r.title}</span>
      <MessageSquare size={12} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-300 group-hover:text-brand-600 transition-colors" />
    </button>
  );
}

// A plain-string "what to do next" step. Same compaction as RecTile: clamped to
// two lines, expandable inline for the full paragraph, chat button to act.
function ActionRow({ text, onOpen }: { text: string; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 90;
  return (
    <div className="flex items-start gap-1 rounded-lg border border-canvas-border bg-canvas-elevated py-2 pl-2.5 pr-1 hover:border-brand-300 transition-colors">
      <div className="min-w-0 flex-1">
        <p className={`text-[12px] text-ink-800 leading-snug ${open ? '' : 'line-clamp-2'}`}>{text}</p>
        {long && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-brand-600/80 hover:text-brand-700 cursor-pointer">
            {open ? 'Show less' : 'Read full'}
            <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>
      <button type="button" onClick={onOpen} title="Work this in Ask IRA (new tab)"
        className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-300 hover:bg-brand-50 hover:text-brand-600 cursor-pointer">
        <MessageSquare size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── The card ──────────────────────────────────────────────────────────────

export default function LayeredInsightCard({
  insight, onCheckMore, collapsible = false, open = true, onToggleOpen,
  headerLabel, evidenceLabel, evidenceExtra, onRec,
}: {
  insight: LayeredInsight;
  /** Optional override for a "check more" chip; defaults to opening it in chat. */
  onCheckMore?: (opt: CheckMoreOption) => void;
  /** Render as a collapsible accordion row (drives the calm/collapsed summary). */
  collapsible?: boolean;
  /** Controlled open state — only meaningful when `collapsible`. */
  open?: boolean;
  /** Toggle handler for the header / takeaway — only meaningful when `collapsible`. */
  onToggleOpen?: () => void;
  /** Override the header context, e.g. "this run" / "across workflows" (default: the layer label). */
  headerLabel?: string;
  /** Override the evidence toggle label when the per-layer wording doesn't fit the surface. */
  evidenceLabel?: string;
  /** Extra drill-down rendered under the evidence rows when expanded (e.g. a sampled-rows table). */
  evidenceExtra?: React.ReactNode;
  /** Optional override for opening a recommended action; defaults to Ask IRA in a new tab. */
  onRec?: (title: string) => void;
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

  // The body (reasoning, evidence, the fix) shows unless we're a collapsed
  // accordion row. Brand chrome is reserved for the active (expanded) card so a
  // long stack of collapsed rows stays calm.
  const bodyShown = !collapsible || open;

  // Open an action / follow-up in Ask IRA (new tab), carrying the subject as context.
  const openInChat = (ask: string) => openChatTab(ask, insight.subjectLabel);
  // Recommended actions honour the caller's handler (e.g. seed a follow-up composer).
  const openRec = (title: string) => (onRec ? onRec(title) : openInChat(title));

  const doNowCount = recs.filter(r => r.priority === 'do-now').length;

  // ── Collapsed — a sleek single-row summary, so a stack of ten reads like a
  //    scannable list and doesn't push the engagement detail off-screen. Brand
  //    chrome and the full anatomy are reserved for the expanded card. ──
  if (collapsible && !open) {
    const pct = displayConfidencePct(insight);
    const layerWord = insight.layer === 'control' ? 'Control' : insight.layer === 'risk' ? 'Risk' : 'Engagement';
    return (
      <motion.section
        initial={false}
        className="rounded-xl border border-canvas-border bg-canvas-elevated hover:border-brand-200 transition-colors"
      >
        <button
          type="button" onClick={onToggleOpen} aria-expanded={false}
          aria-label={`Expand insight: ${insight.takeaway}`}
          className="group flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left cursor-pointer"
        >
          <ChevronDown size={15} className="shrink-0 -rotate-90 text-ink-300 group-hover:text-ink-500 transition-colors" aria-hidden="true" />
          <span className={`size-2 rounded-full shrink-0 ${sevTone.dot}`} title={`Severity: ${SEV_LABEL[insight.severity]}`} />
          <span className="hidden sm:inline shrink-0 text-[9px] font-bold uppercase tracking-wider text-ink-400">{layerWord}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-800 group-hover:text-brand-700 transition-colors">
            {insight.takeaway}
          </span>
          {doNowCount > 0 && (
            <span className="hidden md:inline-flex items-center rounded-full bg-risk-50 text-risk px-2 py-0.5 text-[9.5px] font-bold border border-risk/20 shrink-0">
              {doNowCount} do now
            </span>
          )}
          {recs.length > 0 && (
            <span className="hidden xl:inline shrink-0 text-[10px] font-semibold text-brand-600/70 tabular-nums">{recs.length} rec{recs.length === 1 ? '' : 's'}</span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold shrink-0 ${vTone.pill}`}>
            <span className={`size-1.5 rounded-full ${vTone.dot}`} /> {insight.verdict.label}
          </span>
          {insight.verdict.tone === 'positive' ? (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-compliant-200 bg-compliant-50 px-2 py-0.5 text-[9.5px] font-semibold text-compliant-700 shrink-0"><ShieldCheck size={9} aria-hidden="true" /> Signed pass</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-canvas-border bg-canvas px-2 py-0.5 text-[10px] font-semibold text-ink-700 shrink-0 tabular-nums">
              <span className="size-1.5 rounded-full" style={{ background: confDot(pct) }} /> {pct}%
            </span>
          )}
        </button>
      </motion.section>
    );
  }

  const container = bodyShown
    ? 'border-brand-200/70 bg-gradient-to-b from-brand-50/45 to-canvas-elevated'
    : 'border-canvas-border bg-canvas-elevated hover:border-brand-200';

  return (
    <motion.section
      initial={collapsible ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className={`rounded-2xl border overflow-hidden transition-colors ${container}`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`size-6 rounded-lg flex items-center justify-center shrink-0 ${bodyShown ? 'bg-brand-100 text-brand-700' : 'bg-canvas text-ink-400'}`}>
            <Sparkles size={13} aria-hidden="true" />
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${bodyShown ? 'text-brand-700' : 'text-ink-500'}`}>AI insight · {headerLabel ?? meta.label}</span>
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
            {collapsible && (
              <button
                type="button" onClick={onToggleOpen} aria-expanded={open}
                aria-label={open ? 'Collapse insight' : 'Expand insight'}
                className="shrink-0 text-ink-400 hover:text-ink-700 cursor-pointer"
              >
                <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex">
                  <ChevronDown size={18} aria-hidden="true" />
                </motion.span>
              </button>
            )}
          </div>
        </div>

        {/* Takeaway — the whole line toggles the row when collapsible. */}
        {collapsible ? (
          <button
            type="button" onClick={onToggleOpen} aria-expanded={open}
            className="mt-2.5 block w-full text-left cursor-pointer group"
          >
            <h4 className={`text-[15px] font-bold text-ink-900 leading-snug group-hover:text-brand-700 transition-colors ${open ? '' : 'line-clamp-2'}`}>{insight.takeaway}</h4>
          </button>
        ) : (
          <h4 className="text-[15px] font-bold text-ink-900 leading-snug mt-2.5">{insight.takeaway}</h4>
        )}

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

        <AnimatePresence initial={false}>
          {bodyShown && (
            <motion.div
              initial={collapsible ? { height: 0, opacity: 0 } : false}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
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

              {/* The three facts in one tight row — reasoning · money · root cause —
                  so the block sizes to content instead of a half-empty tall box. */}
              <div className="grid gap-2 mt-2.5 lg:grid-cols-3 items-start">
                <div className={`rounded-xl border ${vTone.soft} p-3`}>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1">
                    <Layers size={12} className="text-brand-600" aria-hidden="true" /> Reasoning · counted once
                  </div>
                  <p className="text-[12px] text-ink-700 leading-snug">{insight.reasoning}</p>
                </div>
                <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">
                    <DollarSign size={12} className="text-risk" aria-hidden="true" /> Money / resource at stake
                  </div>
                  <p className="text-[12px] text-ink-700 leading-snug">{insight.atStake}</p>
                </div>
                <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-3">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                      <Crosshair size={12} className="text-ink-500" aria-hidden="true" /> Root cause
                    </span>
                    {insight.likelyCause.confirmFirst && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-canvas-elevated border border-mitigated-200 px-1.5 py-0.5 text-[9px] font-bold text-mitigated-700">
                        <Info size={9} /> Confirm first
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] font-semibold text-ink-900 leading-snug">{insight.likelyCause.label}</p>
                  <p className="text-[12px] text-ink-600 leading-snug mt-0.5">{insight.likelyCause.detail}</p>
                </div>
              </div>

              {/* Toolbar — evidence toggle + check-more on one line, so neither claims a row of its own */}
              {(insight.evidence.length > 0 || insight.checkMore.length > 0) && (
                <div className="mt-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    {insight.evidence.length > 0 && (
                      <button
                        type="button" onClick={() => setShowEvidence(v => !v)} aria-expanded={showEvidence}
                        className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer"
                      >
                        <motion.span animate={{ rotate: showEvidence ? 0 : -90 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex">
                          <ChevronDown size={14} aria-hidden="true" />
                        </motion.span>
                        <ScrollText size={12} aria-hidden="true" /> {evidenceLabel ?? EVIDENCE_LABEL[insight.layer]} · {insight.evidence.length}
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
                        {evidenceExtra}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Recommended actions — the fix, foregrounded. Tiles two-per-row so a
                  4–5 item set reads in a couple of rows, not a tall wall. Each tile
                  opens in Ask IRA (new tab) with the step pre-filled. */}
              {recs.length > 0 ? (
                <div className="mt-2.5 rounded-xl bg-brand-50/60 border border-brand-100 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-2">
                    <Sparkles size={12} className="text-brand-600" aria-hidden="true" />
                    Recommended actions
                    <span className="text-brand-600/70">· {recs.length}</span>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-100/70 px-2 py-0.5 text-[9px] font-semibold text-brand-700 normal-case tracking-normal">
                      <MessageSquare size={10} aria-hidden="true" /> Open one to work it in chat
                    </span>
                  </div>
                  <ul className="grid sm:grid-cols-2 gap-1.5 items-start">
                    {recs.slice(0, REC_CAP).map((r) => (
                      <li key={r.id} className="min-w-0">
                        <RecTile r={r} onOpen={() => openRec(r.title)} />
                      </li>
                    ))}
                  </ul>
                  {recs.length > REC_CAP && (
                    <p className="text-[10px] text-ink-400 mt-2 px-0.5">+{recs.length - REC_CAP} more — ask IRA to walk the full set.</p>
                  )}
                </div>
              ) : (
                <div className="mt-2.5 rounded-xl bg-brand-50/60 border border-brand-100 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-2">
                    <ArrowRight size={12} className="text-brand-600" aria-hidden="true" /> What to do next
                  </div>
                  <ul className="grid sm:grid-cols-2 gap-1.5 items-start">
                    {insight.recommendedActions.map((a, i) => (
                      <li key={i} className="min-w-0">
                        <ActionRow text={a} onOpen={() => openRec(a)} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
