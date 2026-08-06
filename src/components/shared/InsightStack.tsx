// ─── Insight Stack — the many-insights experience ──────────────────────────
//
// One AI insight card is a full page of reasoning; fifteen of them, all equal,
// is the anti-pattern the PRD forbids ("the rollup lists 12 findings, the lead
// runs out of time, the sign-off-changing finding is never seen"). The stack
// spends its attention budget deliberately, in three tiers:
//
//   HERO    — the top-ranked insight, expanded. The one thing the lead can't miss.
//   TAIL    — the next few, calm collapsed rows the eye can scan.
//   LEDGER  — everything below the fold, behind an HONEST count row that always
//             states how many High-severity items it hides (usually "0 High" —
//             which is assurance, not noise). Expands to the same calm rows.
//
// Recency never outranks materiality: freshness sorts WITHIN a severity band,
// not above it.
//
// PREVIEW mode (`previewCount` + `onSeeAll`): a surface like the engagement
// Overview shows only the hero and a single honest "See all N insights" CTA —
// every other interaction (chips included) routes to the full AI Insights tab
// instead of filtering a list the user can't see.
//
// Presentational only — the caller supplies the built insights (from
// buildLayeredInsight); the stack owns open/filter state and nothing else.

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, Brain, Sparkles, ChevronDown, Check } from 'lucide-react';
import {
  insightDisposition, riskTypeOf, insightKpis, DISPOSITION_META, RISK_TYPE_LABEL,
  type LayeredInsight, type CheckMoreOption, type InsightLayer, type VerdictTone,
  type InsightFreshness, type EntityRef, type InsightDisposition, type InsightRiskType,
} from '../../data/layeredInsights';
import LayeredInsightCard, { InsightTile, InsightMicroTile, type InsightEntityNav } from './LayeredInsightCard';

/** Row-level navigation a host surface offers the stack: which entities have a
 *  real row it can take the reader to, and how. The stack layers its own
 *  fallback on top — an entity without a row but WITH a card in this stack
 *  jumps to that card instead, so no reference is ever a dead end. */
export interface StackRowNav {
  canOpen: (ref: EntityRef) => boolean;
  open: (ref: EntityRef) => void;
}

// The attention budget: 1 expanded hero + this many scannable rows before the
// ledger fold. Everything past it still renders — one click away, never hidden.
const TAIL_COUNT = 3;

// Severity → sort rank + summary-chip styling.
const SEV: Record<LayeredInsight['severity'], { rank: number; label: string; pill: string; dot: string }> = {
  high: { rank: 0, label: 'High', pill: 'bg-risk-50 text-risk border-risk/25', dot: 'bg-risk' },
  med:  { rank: 1, label: 'Medium', pill: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200', dot: 'bg-mitigated-500' },
  low:  { rank: 2, label: 'Low', pill: 'bg-compliant-50 text-compliant-700 border-compliant-200', dot: 'bg-compliant' },
};
const TONE_RANK: Record<VerdictTone, number> = { negative: 0, caution: 1, positive: 2 };
// A rollup reads top-down: the portfolio escalation, then the engagement, then
// the SOPs and risks under it, then the controls under those.
const LAYER_RANK: Record<InsightLayer, number> = { portfolio: 0, engagement: 1, sop: 2, risk: 3, control: 4 };
const LAYER_GROUP_LABEL: Record<InsightLayer, string> = {
  portfolio: 'Anchored at portfolio', engagement: 'Anchored at engagement', sop: 'Anchored at SOP', risk: 'Anchored at risk', control: 'Anchored at control',
};
// Freshness is a tiebreaker INSIDE a severity+layer band — a new Low must never
// displace a known High. Escalated outranks new: worse beats first-seen.
const FRESH_RANK: Record<InsightFreshness, number> = { escalated: 0, new: 1, recurring: 2, resolved: 3 };
const freshRank = (i: LayeredInsight) => (i.freshness ? FRESH_RANK[i.freshness] : 2.5);

function confOf(i: LayeredInsight): number {
  if (i.confidenceOverride != null) return i.confidenceOverride;
  const f = i.factors;
  return f.frequency * f.sourceDiversity * f.recency * f.businessImpact;
}

export default function InsightStack({
  insights, scopeLabel = '', onCheckMore, initialOpen = 1,
  previewCount, onSeeAll, foldLedger = true, groupByAnchor = false, rowNav, grid = false,
}: {
  insights: LayeredInsight[];
  /** Trailing phrase for the header, e.g. "across this engagement". */
  scopeLabel?: string;
  onCheckMore?: (opt: CheckMoreOption) => void;
  /** How many top rows to open on first render (default 1 — the hero). */
  initialOpen?: number;
  /** Preview mode: render only the top N cards + a "See all" CTA (needs `onSeeAll`). */
  previewCount?: number;
  /** Navigate to the surface that shows the full stack (the AI Insights tab). */
  onSeeAll?: () => void;
  /** Fold everything past hero+tail into the ledger (default). The dedicated
   *  AI Insights tab turns this off — you asked for all of them, you get all. */
  foldLedger?: boolean;
  /** Read the stack as a directory of anchors: grouped engagement → SOP →
   *  risk → control with group labels (the AI Insights tab's B+C reading),
   *  severity-ranked within each group. Disables the ledger fold. */
  groupByAnchor?: boolean;
  /** Host-surface row navigation — makes every card name its exact
   *  risk/control and redirect there (entity chips + go-to-row affordances). */
  rowNav?: StackRowNav;
  /** The tile-grid drawer (review decision Aug 6, mechanic D): disposition
   *  sections (Needs action / Watch) of 2-up InsightTiles that expand in
   *  place to the full card, a triage band, severity + risk-type filters when
   *  the stack outgrows five, and passes folded to micro-tiles. Supersedes
   *  `groupByAnchor` on drawer surfaces; other hosts keep the list. */
  grid?: boolean;
}) {
  // Most-severe first; within a severity, escalation altitude, then what
  // changed, then finding tone, then confidence. Stable across renders.
  // Anchor-grouped surfaces flip the first two keys: level, then severity.
  const sorted = useMemo(
    () => [...insights].sort(
      (a, b) =>
        (groupByAnchor
          ? LAYER_RANK[a.layer] - LAYER_RANK[b.layer] || SEV[a.severity].rank - SEV[b.severity].rank
          : SEV[a.severity].rank - SEV[b.severity].rank || LAYER_RANK[a.layer] - LAYER_RANK[b.layer]) ||
        freshRank(a) - freshRank(b) ||
        TONE_RANK[a.verdict.tone] - TONE_RANK[b.verdict.tone] ||
        confOf(b) - confOf(a),
    ),
    [insights, groupByAnchor],
  );

  const [openIds, setOpenIds] = useState<Set<string>>(
    // Grid mode rests fully collapsed — the tiles are the reading surface.
    () => new Set(grid ? [] : sorted.slice(0, Math.max(0, initialOpen)).map(i => i.id)),
  );
  const [ledgerOpen, setLedgerOpen] = useState(false);
  // Grid filters — severity + risk type (rendered only past five insights).
  const [sevF, setSevF] = useState<'all' | LayeredInsight['severity']>('all');
  const [typeF, setTypeF] = useState<'all' | InsightRiskType>('all');

  const toggle = (id: string) =>
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  // Preview only when there is actually more than the preview shows.
  const preview = !!onSeeAll && previewCount != null && previewCount < sorted.length;

  // ── Entity navigation — rows first, sibling cards second, never a dead end.
  // An entity with a real row redirects out to it; one without (a workflow-
  // tested control, a cross-cutting risk) jumps to its own full card here.
  const [flashId, setFlashId] = useState<string | null>(null);
  const entityNav = useMemo<InsightEntityNav | undefined>(() => {
    if (!rowNav) return undefined;
    const cardFor = (ref: EntityRef) => sorted.find(i => i.layer === ref.kind && i.subjectId === ref.id);
    return {
      resolve: ref => (rowNav.canOpen(ref) ? 'row' : cardFor(ref) ? 'insight' : null),
      open: ref => {
        if (rowNav.canOpen(ref)) { rowNav.open(ref); return; }
        const card = cardFor(ref);
        if (!card) return;
        setOpenIds(prev => new Set(prev).add(card.id));
        setLedgerOpen(o => o || (grid ? insightDisposition(card) === 'holding' : sorted.indexOf(card) >= 1 + TAIL_COUNT));
        setFlashId(card.id);
        window.setTimeout(() => {
          document.getElementById(`insight-card-${card.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
        window.setTimeout(() => setFlashId(f => (f === card.id ? null : f)), 2400);
      },
    };
  }, [rowNav, sorted, grid]);
  const flashCls = (id: string) =>
    flashId === id ? 'rounded-2xl ring-2 ring-brand-400/60 transition-shadow duration-500' : '';

  const counts = {
    high: sorted.filter(i => i.severity === 'high').length,
    med: sorted.filter(i => i.severity === 'med').length,
    low: sorted.filter(i => i.severity === 'low').length,
  };

  // Split into the visible tier and the ledger.
  const foldAt = 1 + TAIL_COUNT;
  // A ledger of one is sillier than one extra row — fold only when it earns it.
  // Anchor-grouped surfaces never fold: a directory hides nothing.
  const folds = !preview && !groupByAnchor && foldLedger && sorted.length > foldAt + 1;
  const visible = preview ? sorted.slice(0, previewCount) : folds ? sorted.slice(0, foldAt) : sorted;
  const ledger = folds ? sorted.slice(foldAt) : [];
  const ledgerHigh = ledger.filter(i => i.severity === 'high').length;
  const ledgerMed = ledger.filter(i => i.severity === 'med').length;
  const ledgerLow = ledger.filter(i => i.severity === 'low').length;

  if (sorted.length === 0) return null;

  // ── Grid mode — mechanic D (review decision Aug 6) ────────────────────────
  if (grid) {
    const bySev = sevF === 'all' ? sorted : sorted.filter(i => i.severity === sevF);
    const filtered = typeF === 'all' ? bySev : bySev.filter(i => riskTypeOf(i) === typeF);
    const groups: Record<InsightDisposition, LayeredInsight[]> = { action: [], watch: [], holding: [] };
    for (const i of filtered) groups[insightDisposition(i)].push(i);
    const totals: Record<InsightDisposition, number> = { action: 0, watch: 0, holding: 0 };
    for (const i of sorted) totals[insightDisposition(i)]++;

    // The triage band's stake caption — quoted from the top action insight's
    // own materiality tile, never computed here (no fabricated totals). Only a
    // figure reads as a caption; a word-state ("Unweighed") stays on its tile.
    const topAction = sorted.find(i => insightDisposition(i) === 'action');
    const stakeK = topAction && insightKpis(topAction).find(k => /material/i.test(k.label) && /[%$\d]/.test(k.value));
    const showFilters = sorted.length > 5;
    const typeCounts = new Map<InsightRiskType, number>();
    for (const i of sorted) {
      const t = riskTypeOf(i);
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }
    const sevCount = (s: LayeredInsight['severity']) => sorted.filter(i => i.severity === s).length;
    // Filtering to Low IS asking for the fold's content — open it.
    const foldOpen = ledgerOpen || sevF === 'low';
    const holdingClosed = groups.holding.filter(i => !openIds.has(i.id));
    const holdingOpen = groups.holding.filter(i => openIds.has(i.id));

    const chipCls = (active: boolean) =>
      `rounded-full border px-2.5 py-0.5 text-[0.65625rem] font-semibold tabular-nums transition-colors cursor-pointer ${
        active ? 'border-ink-900 bg-ink-900 text-white' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-brand-300'
      }`;

    const renderCell = (insight: LayeredInsight) => {
      const isOpen = openIds.has(insight.id);
      return (
        <li key={insight.id} className={isOpen ? 'sm:col-span-2' : ''}>
          <div id={`insight-card-${insight.id}`} className={flashCls(insight.id)}>
            {isOpen ? (
              <LayeredInsightCard
                insight={insight}
                onCheckMore={onCheckMore}
                collapsible open
                onToggleOpen={() => toggle(insight.id)}
                entityNav={entityNav}
                summary={insight.layer === 'engagement' || insight.layer === 'portfolio'}
              />
            ) : (
              <InsightTile insight={insight} onOpen={() => toggle(insight.id)} />
            )}
          </div>
        </li>
      );
    };

    return (
      <section aria-label="AI insights">
        {/* Header — same grammar as the list stack. */}
        <div className="flex items-start gap-3 flex-wrap">
          <span className="size-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
            <Brain size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[0.875rem] font-bold text-ink-900 leading-tight">AI insights {scopeLabel}</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[0.5625rem] font-bold border border-brand-100">
                <Sparkles size={9} aria-hidden="true" /> Insight Memory Engine
              </span>
            </div>
          </div>
        </div>

        {/* Triage band — "how much of this needs me?" before anything is read. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {totals.action > 0 && <span className="rounded-full bg-risk-50 px-3 py-1 text-[0.75rem] font-semibold text-risk tabular-nums">{totals.action} need action</span>}
          {totals.watch > 0 && <span className="rounded-full bg-mitigated-50 px-3 py-1 text-[0.75rem] font-semibold text-mitigated-700 tabular-nums">{totals.watch} to watch</span>}
          {totals.holding > 0 && <span className="rounded-full bg-compliant-50 px-3 py-1 text-[0.75rem] font-semibold text-compliant-700 tabular-nums">{totals.holding} holding</span>}
          {stakeK && (
            <span className="ml-auto text-[0.65625rem] text-ink-400" title={stakeK.sub}>
              {stakeK.value} of materiality at stake (est.)
            </span>
          )}
        </div>

        {/* Filters — only once the stack outgrows five insights (Deepak 2). */}
        {showFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-1" role="group" aria-label="Filter insights">
            <button type="button" onClick={() => setSevF('all')} aria-pressed={sevF === 'all'} className={chipCls(sevF === 'all')}>All {sorted.length}</button>
            {(['high', 'med', 'low'] as const).map(s => sevCount(s) > 0 && (
              <button key={s} type="button" onClick={() => setSevF(f => f === s ? 'all' : s)} aria-pressed={sevF === s} className={chipCls(sevF === s)}>
                {SEV[s].label} {sevCount(s)}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-canvas-border" aria-hidden="true" />
            {[...typeCounts.entries()].map(([t, n]) => (
              <button key={t} type="button" onClick={() => setTypeF(f => f === t ? 'all' : t)} aria-pressed={typeF === t} className={chipCls(typeF === t)}>
                {RISK_TYPE_LABEL[t]} {n}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <p className="mt-4 text-[0.75rem] text-ink-500">Nothing matches these filters — clear one to see the rest of the stack.</p>
        )}

        {/* Needs action · Watch — the sections ARE the scan order; inside one,
            the severity sort ranks left→right. Tiles expand in place. */}
        {(['action', 'watch'] as const).map(d => groups[d].length > 0 && (
          <div key={d} className="mt-4">
            <div className="flex items-center gap-2 px-0.5 mb-1.5">
              <span className="text-[0.625rem] font-bold uppercase tracking-wider text-ink-400">{DISPOSITION_META[d].label}</span>
              <span className="text-[0.625rem] font-bold text-brand-700 tabular-nums">· {groups[d].length}</span>
              <span className="flex-1 h-px bg-canvas-border" aria-hidden="true" />
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">{groups[d].map(renderCell)}</ul>
          </div>
        ))}

        {/* The fold — a pass earns a micro-tile, not a card. Still one click
            away: auditors need the negative assurance, not nine tiles of it. */}
        {groups.holding.length > 0 && (
          <div className="mt-4">
            <button
              type="button" onClick={() => setLedgerOpen(o => !o)} aria-expanded={foldOpen}
              className="group flex w-full items-center gap-2 rounded-xl border border-dashed border-compliant-200 bg-compliant-50/40 px-3.5 py-2.5 text-left hover:border-compliant-300 transition-colors cursor-pointer"
            >
              <Check size={13} className="shrink-0 text-compliant" aria-hidden="true" />
              <span className="text-[0.75rem] font-semibold text-compliant-700 tabular-nums">Holding steady · {groups.holding.length}</span>
              <span className="hidden sm:inline text-[0.65625rem] text-ink-400">— {DISPOSITION_META.holding.foldLabel}</span>
              <ChevronDown size={14} className={`ml-auto shrink-0 text-compliant-700/70 transition-transform ${foldOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
              {foldOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden"
                >
                  {holdingClosed.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {holdingClosed.map(i => <InsightMicroTile key={i.id} insight={i} onOpen={() => toggle(i.id)} />)}
                    </div>
                  )}
                  {holdingOpen.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-2">
                      {holdingOpen.map(i => (
                        <li key={i.id}>
                          <div id={`insight-card-${i.id}`} className={flashCls(i.id)}>
                            <LayeredInsightCard
                              insight={i} onCheckMore={onCheckMore} collapsible open
                              onToggleOpen={() => toggle(i.id)} entityNav={entityNav}
                              summary={i.layer === 'engagement' || i.layer === 'portfolio'}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-label="AI insights">
      {/* Rollup header — title · engine badge */}
      <div className="flex items-start gap-3 flex-wrap">
        <span className="size-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <Brain size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[0.875rem] font-bold text-ink-900 leading-tight">AI insights {scopeLabel}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[0.5625rem] font-bold border border-brand-100">
              <Sparkles size={9} aria-hidden="true" /> Insight Memory Engine
            </span>
          </div>
        </div>
      </div>

      {/* Hero + tail — the attention budget, spent. Anchor-grouped surfaces
          read as a directory: a group label opens each anchor level. */}
      <motion.ul
        initial={false}
        className="mt-3 flex flex-col gap-1.5"
      >
        {visible.map((insight, i) => {
          const newGroup = groupByAnchor && (i === 0 || visible[i - 1]!.layer !== insight.layer);
          const groupCount = groupByAnchor ? sorted.filter(s => s.layer === insight.layer).length : 0;
          return (
            <li key={insight.id}>
              {newGroup && (
                <div className={`flex items-center gap-2 px-0.5 ${i === 0 ? 'mb-1.5' : 'mt-3 mb-1.5'}`}>
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-ink-400">
                    {LAYER_GROUP_LABEL[insight.layer]}
                  </span>
                  <span className="text-[0.625rem] font-bold text-brand-700 tabular-nums">· {groupCount}</span>
                  <span className="flex-1 h-px bg-canvas-border" aria-hidden="true" />
                </div>
              )}
              <div id={`insight-card-${insight.id}`} className={flashCls(insight.id)}>
                <LayeredInsightCard
                  insight={insight}
                  onCheckMore={onCheckMore}
                  collapsible
                  open={openIds.has(insight.id)}
                  onToggleOpen={() => toggle(insight.id)}
                  entityNav={entityNav}
                />
              </div>
            </li>
          );
        })}
      </motion.ul>

      {/* Preview CTA — the one row that replaces tail + ledger on the Overview.
          Carries the honest severity mix of what it leads to, never a bare count. */}
      {preview && (
        <button
          type="button" onClick={onSeeAll}
          className="mt-1.5 group flex w-full items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-50/40 px-3.5 py-2.5 text-left hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer"
        >
          <Sparkles size={14} className="shrink-0 text-brand-600" aria-hidden="true" />
          <span className="text-[0.78125rem] font-semibold text-brand-700">See all {sorted.length} insights</span>
          <span className="text-[0.6875rem] text-ink-400 tabular-nums">
            {counts.high} High · {counts.med} Medium · {counts.low} Low
          </span>
          <ArrowUpRight size={14} className="ml-auto shrink-0 text-brand-400 group-hover:text-brand-600 transition-colors" aria-hidden="true" />
        </button>
      )}

      {/* The ledger — everything below the fold behind an honest count. Always
          states its High count, because "10 more · 0 High" is assurance while
          a bare "10 more" is a place findings go to die. */}
      {ledger.length > 0 && (
        <div className="mt-1.5">
          <button
            type="button" onClick={() => setLedgerOpen(o => !o)} aria-expanded={ledgerOpen}
            className="group flex w-full items-center gap-2.5 rounded-xl border border-dashed border-canvas-border bg-canvas px-3.5 py-2.5 text-left hover:border-brand-300 transition-colors cursor-pointer"
          >
            <ChevronDown size={15} className={`shrink-0 text-ink-300 group-hover:text-ink-500 transition-transform ${ledgerOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
            <span className="text-[0.78125rem] font-semibold text-ink-600 group-hover:text-brand-700 transition-colors">
              {ledger.length} more insight{ledger.length === 1 ? '' : 's'}
            </span>
            <span className="text-[0.6875rem] text-ink-400 tabular-nums">
              {ledgerHigh} High · {ledgerMed} Medium · {ledgerLow} Low
            </span>
            {ledgerHigh === 0 && (
              <span className="hidden sm:inline text-[0.625rem] text-compliant-700 font-semibold ml-auto shrink-0">Nothing severe below the fold.</span>
            )}
          </button>
          <AnimatePresence initial={false}>
            {ledgerOpen && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden flex flex-col gap-1.5 mt-1.5"
              >
                {ledger.map((insight) => (
                  <li key={insight.id}>
                    <div id={`insight-card-${insight.id}`} className={flashCls(insight.id)}>
                      <LayeredInsightCard
                        insight={insight}
                        onCheckMore={onCheckMore}
                        collapsible
                        open={openIds.has(insight.id)}
                        onToggleOpen={() => toggle(insight.id)}
                        entityNav={entityNav}
                      />
                    </div>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
