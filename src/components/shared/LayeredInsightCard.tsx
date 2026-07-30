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
// the heavy body; expanded, it shows everything on a plain elevated surface.
// Brand is reserved for small accents (header label, icons, chips), never the
// container, so the card reads calm at any size.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, DollarSign, Layers, ChevronDown, ArrowRight, ShieldCheck,
  Crosshair, MessageSquare, ArrowUpRight, Mail,
} from 'lucide-react';
import {
  LAYER_META,
  type LayeredInsight, type VerdictTone, type CheckMoreOption,
  type RecPriority,
} from '../../data/layeredInsights';
import { FRESHNESS_META } from './insightFreshness';
import { openInChat as openChatTab } from './insightChat';
import { RecommendedActions, EvidenceDisclosure } from './InsightActions';
import RunTrajectoryBand from './RunTrajectoryBand';
import InsightEmailModal from './InsightEmailModal';

const PRIORITY_RANK: Record<RecPriority, number> = { 'do-now': 0, 'this-period': 1, advisory: 2 };

// ─── Tone → Editorial-GRC palette ─────────────────────────────────────────

const TONE: Record<VerdictTone, { pill: string; dot: string; wrap: string; text: string; soft: string; accent: string }> = {
  negative: { pill: 'bg-risk-50 text-risk border-risk/25',           dot: 'bg-risk',           wrap: 'bg-risk-50 text-risk',                 text: 'text-risk',           soft: 'border-risk/20 bg-risk-50/40',           accent: '#B42318' },
  caution:  { pill: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200', dot: 'bg-mitigated-500', wrap: 'bg-mitigated-50 text-mitigated-700', text: 'text-mitigated-700', soft: 'border-mitigated-200 bg-mitigated-50/40', accent: '#B45309' },
  positive: { pill: 'bg-compliant-50 text-compliant-700 border-compliant-200', dot: 'bg-compliant',     wrap: 'bg-compliant-50 text-compliant-700', text: 'text-compliant-700', soft: 'border-compliant-200 bg-compliant-50/40', accent: '#15803D' },
};

const SEV_TONE: Record<LayeredInsight['severity'], VerdictTone> = { high: 'negative', med: 'caution', low: 'positive' };
const SEV_LABEL: Record<LayeredInsight['severity'], string> = { high: 'High', med: 'Medium', low: 'Low' };

// ─── Lifecycle tag — what changed since the auditor last looked ─────────────

function FreshnessTag({ insight }: { insight: LayeredInsight }) {
  if (!insight.freshness) return null;
  const m = FRESHNESS_META[insight.freshness];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold shrink-0 ${m.pill}`}
      title={insight.freshnessNote}
    >
      {insight.freshness === 'escalated' && <ArrowUpRight size={9} aria-hidden="true" />}
      {m.label}
    </span>
  );
}

// Relative time for the header — ambient meta only (the audit trail keeps
// absolute timestamps). Insights without a stamp were generated this render.
function timeAgo(ts?: number): string {
  if (!ts) return 'just now';
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} hr ago` : `${Math.floor(h / 24)} d ago`;
}

// ─── Evidence label per altitude ───────────────────────────────────────────

const EVIDENCE_LABEL: Record<LayeredInsight['layer'], string> = {
  control: 'Evidence · runs and rows',
  risk: 'Evidence · controls under this risk',
  sop: 'Evidence · risks and controls under this SOP',
  engagement: 'Evidence · risks and controls',
};

const LAYER_WORD: Record<LayeredInsight['layer'], string> = {
  control: 'Control', risk: 'Risk', sop: 'SOP', engagement: 'Engagement',
};

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

// ─── Stat band — the card leads with figures, not paragraphs ────────────────
// One tile per headline number: big tabular value, small label, optional mini
// meter. The prose boxes below stay short because the numbers live here.


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
  const sevTone = TONE[SEV_TONE[insight.severity]];
  // Header scope, sentence-cased: "This control" / "Across workflows" / …
  const scope = headerLabel ?? meta.label;
  const scopeText = scope.charAt(0).toUpperCase() + scope.slice(1);
  // Share-by-email — every full card carries it; collapsed rows stay calm.
  const [emailOpen, setEmailOpen] = useState(false);
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

  // ── Collapsed — a sleek single-row summary, so a stack of ten reads like a
  //    scannable list and doesn't push the engagement detail off-screen. Brand
  //    chrome and the full anatomy are reserved for the expanded card. ──
  if (collapsible && !open) {
    const layerWord = LAYER_WORD[insight.layer];
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
          <FreshnessTag insight={insight} />
          {(insight.spans?.length ?? 0) > 0 && (
            <span
              className="hidden lg:inline-flex shrink-0 items-center rounded-full bg-evidence-50 text-evidence-700 px-2 py-0.5 text-[9.5px] font-bold"
              title={insight.spans!.map(s => s.label).join(' · ')}
            >
              Spans {insight.spans!.length} {insight.spans![0].kind}{insight.spans!.length === 1 ? '' : 's'}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-800 group-hover:text-brand-700 transition-colors">
            {insight.takeaway}
          </span>
          {/* Right side carries ONE tag: severity. Verdict, rec counts and
              confidence live inside the expanded card, not on the row. */}
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold shrink-0 ${sevTone.wrap}`} title={insight.severityLabel ?? `Severity: ${SEV_LABEL[insight.severity]}`}>
            {SEV_LABEL[insight.severity]}
          </span>
        </button>
      </motion.section>
    );
  }

  // Expanded sits on a plain elevated surface — brand lives in the small
  // accents (header label, icons, chips), never painted across the container.
  const container = bodyShown
    ? 'border-canvas-border bg-canvas-elevated'
    : 'border-canvas-border bg-canvas-elevated hover:border-brand-200';

  return (
    <motion.section
      initial={collapsible ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className={`rounded-2xl border overflow-hidden transition-colors ${container}`}
    >
      <div className="p-4">
        {/* Header — [IRA INSIGHT] pill · scope · time ago ··· severity · confidence · caret */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100/70 text-brand-700 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider shrink-0">
            <Sparkles size={9} aria-hidden="true" /> IRA Insight
          </span>
          <span className="text-[12.5px] font-bold text-ink-600">{scopeText}</span>
          <span className="text-[11.5px] text-ink-400">· {timeAgo(insight.generatedAt)}</span>
          <div className="ml-auto flex items-center gap-2.5">
            {/* Severity, spelled out plain — label overrides like "Readiness: At
                risk" stay on the hover title so the header reads one word. */}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sevTone.wrap}`} title={insight.severityLabel}>
              {SEV_LABEL[insight.severity]}
            </span>
            {/* Confidence is deliberately not shown — severity leads; a signed
                pass keeps its assurance chip. */}
            {insight.verdict.tone === 'positive' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-compliant-50 px-2 py-0.5 text-[10px] font-semibold text-compliant-700"><ShieldCheck size={10} /> Signed pass</span>
            )}
            <button
              type="button" onClick={() => setEmailOpen(true)}
              aria-label="Email this insight" title="Email this insight"
              className="shrink-0 p-1 rounded-md text-ink-400 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
            >
              <Mail size={14} aria-hidden="true" />
            </button>
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

        <AnimatePresence initial={false}>
          {bodyShown && (
            <motion.div
              initial={collapsible ? { height: 0, opacity: 0 } : false}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              {/* Across runs — the anchor metric's trajectory over stored run
                  history. Only single-output insights carry one; its absence
                  is itself the honest "no cross-run claim" state. */}
              {insight.trajectory && <RunTrajectoryBand trajectory={insight.trajectory} className="mt-3.5" />}

              {/* What we found · Root cause · What's at stake — three open
                  columns, no boxes; the gutters do the separating. */}
              <div className="grid gap-x-8 gap-y-4 mt-3.5 lg:grid-cols-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">
                    <Layers size={12} className="text-brand-600" aria-hidden="true" /> What we found
                  </div>
                  <ul className="space-y-1.5">
                    {(insight.observations ?? [insight.reasoning]).map((o, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-ink-700 leading-snug">
                        <span className="mt-[5px] size-1.5 rounded-full bg-brand-300 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">
                    <Crosshair size={12} className="text-ink-500" aria-hidden="true" /> Root cause
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-[5px] size-1.5 rounded-full bg-brand-300 shrink-0" aria-hidden="true" />
                    <p className="text-[12px] leading-snug min-w-0">
                      <span className="font-semibold text-ink-900">{insight.likelyCause.label}</span>{' '}
                      <span className="text-ink-600">{insight.likelyCause.detail}</span>
                    </p>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">
                    <DollarSign size={12} className="text-ink-500" aria-hidden="true" /> What&rsquo;s at stake
                  </div>
                  <ul className="space-y-1.5">
                    {(insight.stakes ?? [insight.atStake]).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-ink-700 leading-snug">
                        <span className="mt-[5px] size-1.5 rounded-full bg-brand-300 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Spans — the entities below this anchor the finding draws from.
                  This card is their single record; each spanned row shows a
                  one-line reflection pointing back here, never a copy. */}
              {(insight.spans?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mr-0.5">Spans</span>
                  {insight.spans!.map(s => (
                    <span
                      key={`${s.kind}:${s.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-evidence-100 bg-evidence-50 px-2 py-0.5 text-[10.5px] font-semibold text-evidence-700"
                      title={s.note ?? s.label}
                    >
                      <span className="font-mono text-[9.5px]">{s.id}</span>
                      <span className="max-w-[180px] truncate">{s.label}</span>
                    </span>
                  ))}
                  <span className="text-[10px] text-ink-400">· counted once — anchored on this card</span>
                </div>
              )}

              {/* Evidence disclosure — collapsed-by-default toggle + check-more
                  chips + calm Source/Item/Detail table (shared surface). */}
              <EvidenceDisclosure
                evidence={insight.evidence}
                label={evidenceLabel ?? EVIDENCE_LABEL[insight.layer]}
                note={insight.evidenceNote}
                checkMore={insight.checkMore}
                onCheckMore={onCheckMore}
                evidenceExtra={evidenceExtra}
                subjectLabel={insight.subjectLabel}
              />

              {/* Recommended actions — the fix, foregrounded (shared surface).
                  Falls back to the plain "what to do next" list when the subject
                  has no typed recommendations. */}
              {recs.length > 0 ? (
                <RecommendedActions recs={recs} onOpen={openRec} />
              ) : (
                <div className="mt-2.5 rounded-xl bg-canvas border border-canvas-border p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2">
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
      <InsightEmailModal insight={insight} scopeLabel={scope} open={emailOpen} onClose={() => setEmailOpen(false)} />
    </motion.section>
  );
}
