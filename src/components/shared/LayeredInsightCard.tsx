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
  Sparkles, ChevronDown, ArrowRight, ShieldCheck,
  Crosshair, MessageSquare, ArrowUpRight, Mail, ArrowDown, Locate,
} from 'lucide-react';
import {
  LAYER_META, insightKpis,
  type AuditRecommendation, type LayeredInsight, type VerdictTone, type CheckMoreOption,
  type RecPriority, type EntityRef, type InsightKpi, type LikelyCause,
} from '../../data/layeredInsights';
import { FRESHNESS_META } from './insightFreshness';
import { runActionInChat } from './insightChat';
import { RecommendedActions, EvidenceDisclosure } from './InsightActions';
import RunTrajectoryBand from './RunTrajectoryBand';
import InsightEmailModal from './InsightEmailModal';
import InsightFeedback from './InsightFeedback';

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
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.59375rem] font-bold shrink-0 ${m.pill}`}
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
  portfolio: 'Evidence · engagements in the pattern',
};

const LAYER_WORD: Record<LayeredInsight['layer'], string> = {
  control: 'Control', risk: 'Risk', sop: 'SOP', engagement: 'Engagement', portfolio: 'Portfolio',
};

// ─── Entity navigation — "which risk/control, and take me there" ────────────
// Rollup surfaces (the engagement insights drawer) pass `entityNav` so every
// card names the exact row it resolves to and can redirect the reader there.
// Row-level surfaces never pass it — a card sitting ON its own row would be
// giving directions to where the reader already stands.

/** How an entity opens: its own row elsewhere in the app ('row'), its full
 *  card inside the surrounding stack ('insight'), or not at all (null). */
export type EntityNavMode = 'row' | 'insight';

export interface InsightEntityNav {
  resolve: (ref: EntityRef) => EntityNavMode | null;
  open: (ref: EntityRef) => void;
}

/** One entity reference chip: KIND · mono id · label. Navigable chips carry a
 *  direction glyph — outward (↗) to the entity's row, downward (↓) to its full
 *  card later in this report — so the reader knows where a click lands. */
function EntityChip({ entity, mode, onOpen, title }: {
  entity: EntityRef;
  mode: EntityNavMode | null;
  onOpen?: () => void;
  title?: string;
}) {
  const body = (
    <>
      <span className="shrink-0 text-[0.53125rem] font-bold uppercase tracking-wider text-ink-400">{entity.kind}</span>
      <span className="shrink-0 font-mono text-[0.625rem] font-semibold text-brand-700">{entity.id}</span>
      <span className="min-w-0 max-w-[220px] truncate text-[0.6875rem] font-semibold text-ink-700">{entity.label}</span>
    </>
  );
  if (!mode) {
    return (
      <span
        className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas px-2 py-1"
        title={title ?? entity.note ?? entity.label}
      >
        {body}
      </span>
    );
  }
  return (
    <button
      type="button" onClick={onOpen}
      title={title ?? (mode === 'row'
        ? `Open ${entity.kind} ${entity.id} — review and act on its row (new tab)`
        : `Read this ${entity.kind}’s full insight further down this report`)}
      className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated px-2 py-1 hover:border-brand-300 hover:bg-brand-50/60 transition-colors cursor-pointer"
    >
      {body}
      {mode === 'row'
        ? <ArrowUpRight size={11} className="shrink-0 text-brand-600" aria-hidden="true" />
        : <ArrowDown size={11} className="shrink-0 text-brand-600" aria-hidden="true" />}
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
        <p className={`text-[0.75rem] text-ink-800 leading-snug ${open ? '' : 'line-clamp-2'}`}>{text}</p>
        {long && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className="mt-1 inline-flex items-center gap-0.5 text-[0.625rem] font-semibold text-brand-600/80 hover:text-brand-700 cursor-pointer">
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

// ─── Stat band (A′) — the card leads with figures, not paragraphs ───────────
// One tile per headline number: big tabular value, uppercase label, and a
// sub-line that states the number's CONSEQUENCE. The tiles ARE the stakes
// (review decision Aug 6: the separate "what's at stake" list restated them),
// so no prose list follows — the cause block below is the only paragraph.

function KpiBand({ kpis }: { kpis: InsightKpi[] }) {
  if (kpis.length === 0) return null;
  const cols =
    kpis.length >= 4 ? 'grid-cols-2 lg:grid-cols-4'
    : kpis.length === 3 ? 'max-sm:grid-cols-1 grid-cols-3'
    : kpis.length === 2 ? 'grid-cols-2'
    : 'grid-cols-1';
  return (
    <div className={`mt-3.5 grid gap-2 ${cols}`}>
      {kpis.map((k, i) => (
        <div key={i} className="min-w-0 rounded-xl border border-canvas-border bg-canvas px-3 py-2.5">
          <div className={`text-[1.375rem] leading-tight font-semibold tabular-nums tracking-tight ${k.tone === 'bad' ? 'text-risk' : 'text-ink-900'}`}>
            {k.value}
            {k.unit && <span className="text-[0.8125rem] font-semibold text-ink-500"> {k.unit}</span>}
          </div>
          <div className="mt-0.5 text-[0.59375rem] font-bold uppercase tracking-wider text-ink-400">{k.label}</div>
          <div className="mt-0.5 text-[0.65625rem] leading-snug text-ink-500">{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

// Root cause, promoted to the lead position (Kapil: "upfront, not in the
// detailed view"). Promotion doesn't make it a fact — the confirm-first
// wording stays in the label, and the forward risk lives in the detail.
function CauseLead({ cause }: { cause: LikelyCause }) {
  return (
    <div className="mt-3.5 rounded-r-xl border-l-2 border-brand-500 bg-brand-50/40 px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-brand-700">
        <Crosshair size={11} aria-hidden="true" /> Likely root cause — confirm before relying on it
      </div>
      <p className="mt-1 text-[0.75rem] leading-snug">
        <span className="font-semibold text-ink-900">{cause.label}</span>{' '}
        <span className="text-ink-600">{cause.detail}</span>
      </p>
    </div>
  );
}

// ─── Stat line — the teaser's second row, shared with row strips ────────────
// Hero figure · context chips · cause phrase. The B row form's payload,
// exported so row-anchored strips (Controls tab, RACM) lead with the same
// numbers as the collapsed stack rows — one anatomy on every list surface.

export function InsightStatLine({ insight, className = '' }: { insight: LayeredInsight; className?: string }) {
  const kpis = insightKpis(insight);
  const hero = kpis[0];
  const chips = kpis.slice(1, 3).filter(k => /[^\s—]/.test(k.value));
  return (
    <span className={`flex w-full min-w-0 items-baseline gap-2.5 ${className}`}>
      {hero && (
        <span className={`shrink-0 text-[1.0625rem] font-semibold tabular-nums tracking-tight leading-none ${hero.tone === 'bad' ? 'text-risk' : 'text-ink-900'}`}>
          {hero.value}
          <span className="text-[0.71875rem] font-semibold text-ink-500">
            {hero.unit ? ` ${hero.unit}` : ''} {hero.label.toLowerCase()}
          </span>
        </span>
      )}
      {chips.map((k, idx) => (
        <span
          key={idx}
          title={k.sub}
          className={`hidden sm:inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums ${k.tone === 'bad' ? 'border-risk-100 bg-risk-50 text-risk' : 'border-canvas-border bg-canvas text-ink-600'}`}
        >
          {k.value}{k.unit ? ` ${k.unit}` : ''} {k.label.toLowerCase()}
        </span>
      ))}
      <span className="min-w-0 flex-1 truncate text-[0.71875rem] text-ink-500">
        <span className="font-semibold text-ink-700">Cause:</span> {insight.likelyCause.label}
      </span>
    </span>
  );
}

// ─── The card ──────────────────────────────────────────────────────────────

export default function LayeredInsightCard({
  insight, onCheckMore, collapsible = false, open = true, onToggleOpen,
  headerLabel, evidenceLabel, evidenceExtra, onRec, entityNav, summary = false,
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
  /** Rollup-surface navigation: name the exact risk/control this card resolves
   *  to and redirect there. Only the engagement drawer passes this — row-level
   *  surfaces render exactly as before. */
  entityNav?: InsightEntityNav;
  /** Short rollup density (engagement / portfolio altitude): stat band + cause
   *  + routing chips + top actions — no evidence table, no trajectory. Depth
   *  lives where the fix lives; a rollup card summarises and routes. */
  summary?: boolean;
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

  // A recommended action RUNS: the whole rec — its rationale, guardrail, target
  // and this card's evidence — travels to a chat tab that sends it on arrival.
  // Callers already inside a chat override this (`onRec`) so the step lands in
  // the thread they're reading rather than opening a tab beside it.
  const openRec = (rec: AuditRecommendation) => (onRec ? onRec(rec.title) : runActionInChat({ rec, insight }));
  // The plain "what to do next" list carries strings, not typed recs — wrap each
  // one so it still runs with this card's context behind it.
  const openPlainAction = (title: string, i: number) =>
    openRec({ id: `${insight.id}-next-${i}`, title, rationale: '', category: 'monitoring', priority: 'this-period' });

  // ── Entity navigation (rollup surfaces only) ──
  // The anchor is this card's own subject; its only meaningful destination is a
  // real row elsewhere ('insight' would just point the card at itself). The
  // engagement anchor is the surface the reader is already on — no chip.
  // Portfolio cards never render an anchor chip either (the reader is already
  // on the portfolio surface), so narrowing that layer out of EntityKind is safe.
  const anchorRef: EntityRef = { kind: insight.layer === 'portfolio' ? 'engagement' : insight.layer, id: insight.subjectId, label: insight.subjectLabel };
  const showAnchorRef = !!entityNav && insight.layer !== 'engagement' && insight.layer !== 'portfolio';
  const anchorNavigable = showAnchorRef && entityNav!.resolve(anchorRef) === 'row';
  const openAnchor = () => entityNav?.open(anchorRef);
  // Where to check — navigation refs when the caller set them, else the spans
  // (for a risk card the spanned controls ARE the rows to check).
  const checkEntities: EntityRef[] = entityNav ? (insight.checkAt ?? insight.spans ?? []) : [];

  // ── Collapsed — the B teaser (review decision Aug 6): a two-line stat card,
  //    not a sentence. Line 1 is identity (which thing, what changed, how
  //    severe); line 2 leads with the hero figure, its context chips and the
  //    cause phrase — so a stack of ten scans like a stat sheet and the root
  //    cause is visible before anything expands. ──
  if (collapsible && !open) {
    const layerWord = LAYER_WORD[insight.layer];
    return (
      <motion.section
        initial={false}
        className="flex items-stretch rounded-xl border border-canvas-border bg-canvas-elevated hover:border-brand-200 transition-colors"
      >
        <button
          type="button" onClick={onToggleOpen} aria-expanded={false}
          aria-label={`Expand insight: ${insight.takeaway}`}
          title={insight.takeaway}
          className="group flex flex-1 min-w-0 flex-col gap-1 px-3.5 py-2.5 text-left cursor-pointer"
        >
          {/* Identity line. */}
          <span className="flex w-full min-w-0 items-center gap-2">
            <ChevronDown size={14} className="shrink-0 -rotate-90 text-ink-300 group-hover:text-ink-500 transition-colors" aria-hidden="true" />
            <span className={`size-2 rounded-full shrink-0 ${sevTone.dot}`} title={`Severity: ${SEV_LABEL[insight.severity]}`} />
            <span className="shrink-0 text-[0.5625rem] font-bold uppercase tracking-wider text-ink-400">{layerWord}</span>
            {insight.layer !== 'engagement' && insight.layer !== 'portfolio' && (
              <span className="hidden sm:inline shrink-0 font-mono text-[0.625rem] font-semibold text-brand-700" title={insight.subjectLabel}>
                {insight.subjectId}
              </span>
            )}
            <FreshnessTag insight={insight} />
            {(insight.spans?.length ?? 0) > 0 && (
              <span
                className="hidden lg:inline-flex shrink-0 items-center rounded-full bg-evidence-50 text-evidence-700 px-2 py-0.5 text-[0.59375rem] font-bold"
                title={insight.spans!.map(s => s.label).join(' · ')}
              >
                Spans {insight.spans!.length} {insight.spans![0].kind}{insight.spans!.length === 1 ? '' : 's'}
              </span>
            )}
            <span className="flex-1" aria-hidden="true" />
            {/* Right side carries ONE tag: severity. Verdict, rec counts and
                confidence live inside the expanded card, not on the row. */}
            <span className={`rounded-full px-2 py-0.5 text-[0.65625rem] font-semibold shrink-0 ${sevTone.wrap}`} title={insight.severityLabel ?? `Severity: ${SEV_LABEL[insight.severity]}`}>
              {SEV_LABEL[insight.severity]}
            </span>
          </span>
          {/* Stat line — hero figure · context chips · the cause phrase. */}
          <InsightStatLine insight={insight} className="pl-[22px]" />
        </button>
        {/* Straight to the row — the redirect without opening the card first. */}
        {anchorNavigable && (
          <button
            type="button" onClick={openAnchor}
            aria-label={`Open ${layerWord.toLowerCase()} ${insight.subjectId} in a new tab`}
            title={`Open ${layerWord.toLowerCase()} ${insight.subjectId} — review and act on its row (new tab)`}
            className="shrink-0 self-stretch px-2.5 rounded-r-xl border-l border-canvas-border text-ink-300 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
          >
            <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        )}
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
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100/70 text-brand-700 px-2 py-0.5 text-[0.59375rem] font-bold uppercase tracking-wider shrink-0">
            <Sparkles size={9} aria-hidden="true" /> IRA Insight
          </span>
          {/* On rollup surfaces the scope word becomes the exact entity — the
              reader should never have to ask "which control is 'this control'?" */}
          {showAnchorRef ? (
            <EntityChip
              entity={anchorRef}
              mode={anchorNavigable ? 'row' : null}
              onOpen={openAnchor}
              title={anchorNavigable
                ? `Open ${insight.layer} ${insight.subjectId} — review and act on its row (new tab)`
                : `${insight.subjectLabel} — no row of its own in this engagement`}
            />
          ) : (
            <span className="text-[0.78125rem] font-bold text-ink-600">{scopeText}</span>
          )}
          <span className="text-[0.71875rem] text-ink-400">· {timeAgo(insight.generatedAt)}</span>
          <div className="ml-auto flex items-center gap-2.5">
            {/* Severity, spelled out plain — label overrides like "Readiness: At
                risk" stay on the hover title so the header reads one word. */}
            <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${sevTone.wrap}`} title={insight.severityLabel}>
              {SEV_LABEL[insight.severity]}
            </span>
            {/* Confidence is deliberately not shown — severity leads; a signed
                pass keeps its assurance chip. */}
            {insight.verdict.tone === 'positive' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-compliant-50 px-2 py-0.5 text-[0.625rem] font-semibold text-compliant-700"><ShieldCheck size={10} /> Signed pass</span>
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
            <h4 className={`text-[0.9375rem] font-bold text-ink-900 leading-snug group-hover:text-brand-700 transition-colors ${open ? '' : 'line-clamp-2'}`}>{insight.takeaway}</h4>
          </button>
        ) : (
          <h4 className="text-[0.9375rem] font-bold text-ink-900 leading-snug mt-2.5">{insight.takeaway}</h4>
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
              {/* A′ — the stat band leads. Each tile's sub-line is its own
                  consequence, so the old "what we found / what's at stake"
                  columns are said once, here (review decision Aug 6). */}
              <KpiBand kpis={insightKpis(insight)} />

              {/* Across runs — the anchor metric's trajectory over stored run
                  history. Only single-output insights carry one; its absence
                  is itself the honest "no cross-run claim" state. Short rollup
                  cards skip it — depth lives where the fix lives. */}
              {!summary && insight.trajectory && <RunTrajectoryBand trajectory={insight.trajectory} className="mt-3.5" />}

              {/* Root cause, promoted to the lead — the one paragraph left. */}
              <CauseLead cause={insight.likelyCause} />

              {/* Where to check — rollup surfaces turn the span/checkAt refs
                  into the answer to "which risk/control do I open, exactly?".
                  Each chip redirects to its row (↗) or, when the entity has no
                  row of its own, to its full card further down the report (↓). */}
              {entityNav && checkEntities.length > 0 ? (
                <div className="mt-3.5 rounded-xl border border-brand-100 bg-brand-50/30 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-brand-700">
                    <Locate size={12} aria-hidden="true" /> Where to check · {checkEntities.length}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {checkEntities.map(e => (
                      <EntityChip
                        key={`${e.kind}:${e.id}`}
                        entity={e}
                        mode={entityNav.resolve(e)}
                        onOpen={() => entityNav.open(e)}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[0.625rem] text-ink-400">
                    One finding, counted once — open a row to make the change there.
                  </p>
                </div>
              ) : (insight.spans?.length ?? 0) > 0 && (
                // Spans — the entities below this anchor the finding draws from.
                // This card is their single record; each spanned row shows a
                // one-line reflection pointing back here, never a copy.
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mr-0.5">Spans</span>
                  {insight.spans!.map(s => (
                    <span
                      key={`${s.kind}:${s.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-evidence-100 bg-evidence-50 px-2 py-0.5 text-[0.65625rem] font-semibold text-evidence-700"
                      title={s.note ?? s.label}
                    >
                      <span className="font-mono text-[0.59375rem]">{s.id}</span>
                      <span className="max-w-[180px] truncate">{s.label}</span>
                    </span>
                  ))}
                  <span className="text-[0.625rem] text-ink-400">· counted once — anchored on this card</span>
                </div>
              )}

              {/* Evidence disclosure — collapsed-by-default toggle + check-more
                  chips + calm Source/Item/Detail table (shared surface). Short
                  rollup cards skip it: they summarise and route. */}
              {!summary && (
                <EvidenceDisclosure
                  evidence={insight.evidence}
                  label={evidenceLabel ?? EVIDENCE_LABEL[insight.layer]}
                  note={insight.evidenceNote}
                  checkMore={insight.checkMore}
                  onCheckMore={onCheckMore}
                  evidenceExtra={evidenceExtra}
                  subjectLabel={insight.subjectLabel}
                />
              )}

              {/* Recommended actions — the fix, foregrounded (shared surface).
                  Falls back to the plain "what to do next" list when the subject
                  has no typed recommendations. Short cards carry the top two. */}
              {recs.length > 0 ? (
                <RecommendedActions
                  recs={summary ? recs.slice(0, 2) : recs}
                  className={summary ? 'mt-3' : 'mt-2.5'}
                  onOpen={(r) => openRec(recs.find(x => x.id === r.id) ?? recs[0])}
                />
              ) : (
                <div className="mt-2.5 rounded-xl bg-canvas border border-canvas-border p-3">
                  <div className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-ink-500 mb-2">
                    <ArrowRight size={12} className="text-brand-600" aria-hidden="true" /> What to do next
                  </div>
                  <ul className="grid sm:grid-cols-2 gap-1.5 items-start">
                    {(summary ? insight.recommendedActions.slice(0, 2) : insight.recommendedActions).map((a, i) => (
                      <li key={i} className="min-w-0">
                        <ActionRow text={a} onOpen={() => openPlainAction(a, i)} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* The redirect, restated where the reader lands after the fix:
                  having read what to do, go do it on the row itself. */}
              {anchorNavigable && (
                <button
                  type="button" onClick={openAnchor}
                  title={`Opens in a new tab — this report stays where it is.`}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50/50 h-9 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer"
                >
                  Open {LAYER_WORD[insight.layer].toLowerCase()}
                  <span className="font-mono text-[0.71875rem]">{insight.subjectId}</span>
                  to act
                  <ArrowUpRight size={13} aria-hidden="true" />
                </button>
              )}

              {/* Signal back — the card's last line. Rating sits below the fix
                  because that's the first point the reader can judge the
                  finding; the header stays status + dispatch. */}
              <InsightFeedback insightId={insight.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <InsightEmailModal insight={insight} scopeLabel={scope} open={emailOpen} onClose={() => setEmailOpen(false)} />
    </motion.section>
  );
}

// ─── Tile — the grid drawer's resting state (C) ─────────────────────────────
// One insight as a compact stat tile: identity, hero figure, cause clamp.
// Same data as the teaser row, arranged for a 2-up grid; clicking expands it
// in place (the host swaps the tile for the full card spanning the grid).

export function InsightTile({ insight, onOpen }: { insight: LayeredInsight; onOpen: () => void }) {
  const sevTone = TONE[SEV_TONE[insight.severity]];
  const kpis = insightKpis(insight);
  const hero = kpis[0];
  // A placeholder value ("—") is honest on its own tile but reads as noise
  // appended to the hero line — skip it here.
  const share = kpis[1] && /[^\s—]/.test(kpis[1].value) ? kpis[1] : undefined;
  return (
    <button
      type="button" onClick={onOpen}
      aria-label={`Expand insight: ${insight.takeaway}`}
      title={insight.takeaway}
      className="group flex h-full w-full flex-col rounded-xl border border-canvas-border bg-canvas-elevated px-3.5 py-3 text-left hover:border-brand-300 transition-colors cursor-pointer"
    >
      <span className="flex w-full items-center gap-2 min-w-0">
        <span className={`size-2 rounded-full shrink-0 ${sevTone.dot}`} aria-hidden="true" />
        <span className="shrink-0 text-[0.5625rem] font-bold uppercase tracking-wider text-ink-400">{LAYER_WORD[insight.layer]}</span>
        {insight.layer !== 'engagement' && insight.layer !== 'portfolio' && (
          <span className="min-w-0 truncate font-mono text-[0.625rem] font-semibold text-brand-700" title={insight.subjectLabel}>{insight.subjectId}</span>
        )}
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[0.625rem] font-semibold shrink-0 ${sevTone.wrap}`} title={insight.severityLabel}>
          {SEV_LABEL[insight.severity]}
        </span>
      </span>
      {hero && (
        <>
          <span className={`mt-2.5 text-[1.5rem] leading-none font-semibold tabular-nums tracking-tight ${hero.tone === 'bad' ? 'text-risk' : 'text-ink-900'}`}>
            {hero.value}
            {hero.unit && <span className="text-[0.8125rem] font-semibold text-ink-500"> {hero.unit}</span>}
          </span>
          <span className="mt-1 w-full truncate text-[0.65625rem] text-ink-500">
            {hero.label}{share ? ` · ${share.value}${share.unit ? ` ${share.unit}` : ''} ${share.label.toLowerCase()}` : ''}
          </span>
        </>
      )}
      <span className="mt-2 line-clamp-2 text-[0.71875rem] leading-snug text-ink-700">
        <span className="font-semibold text-ink-900">Cause:</span> {insight.likelyCause.label}
      </span>
      <span className="mt-auto flex w-full items-center gap-1.5 pt-2">
        <FreshnessTag insight={insight} />
        <span className="ml-auto inline-flex items-center gap-0.5 text-[0.65625rem] font-semibold text-brand-700 group-hover:text-brand-600 transition-colors">
          Expand <ChevronDown size={11} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

// A pass earns one line, not a card — the "holding steady" fold's micro-tile.
// The dot keeps the verdict honest: green for a signed pass, amber for a
// not-yet-run test that merely has nothing to say.
export function InsightMicroTile({ insight, onOpen }: { insight: LayeredInsight; onOpen: () => void }) {
  const hero = insightKpis(insight)[0];
  return (
    <button
      type="button" onClick={onOpen}
      aria-label={`Expand insight: ${insight.takeaway}`}
      title={insight.takeaway}
      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-1.5 text-left hover:border-brand-300 transition-colors cursor-pointer"
    >
      <span className={`size-1.5 rounded-full shrink-0 ${TONE[insight.verdict.tone].dot}`} aria-hidden="true" />
      <span className="shrink-0 font-mono text-[0.625rem] font-semibold text-brand-700">{insight.subjectId}</span>
      {hero && (
        <>
          <span className="shrink-0 text-[0.75rem] font-semibold tabular-nums text-ink-900">{hero.value}</span>
          <span className="min-w-0 truncate text-[0.625rem] text-ink-500">{hero.label.toLowerCase()}</span>
        </>
      )}
    </button>
  );
}
