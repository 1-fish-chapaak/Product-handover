// ─── Shared insight action surfaces ────────────────────────────────────────
//
// The two reusable blocks that sit at the bottom of an AI-insight card:
//
//   1. EvidenceDisclosure — the collapsible "Evidence · N" toggle (collapsed by
//      default) opening the calm Source/Item/Detail table, with an optional
//      deeper drill-down (`evidenceExtra`).
//   2. RecommendedActions — the two-per-row grid of recommendation tiles under a
//      "Recommended actions · N" header.
//
// Extracted from LayeredInsightCard so every surface (the layered control/risk/
// engagement cards AND the workflow output-compare card) renders them
// identically from one source, not divergent copies.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronDown, ScrollText, MessageSquare } from 'lucide-react';
import type { CheckMoreOption, EntityKind, EntityRef, RecIntent } from '../../data/layeredInsights';

export const REC_CAP = 6;

// Target-entity chip tone, by kind — the small "→ lands on X" marker a
// targeted action carries so the reader knows where the work goes (Rule 2).
const TARGET_TONE: Record<EntityKind, string> = {
  control:    'bg-evidence-50 text-evidence-700',
  risk:       'bg-high-50 text-high-700',
  sop:        'bg-brand-50 text-brand-700',
  engagement: 'bg-paper-100 text-ink-600',
  workflow:   'bg-evidence-50 text-evidence-700',
};

// ─── Recommended-action tile (grid cell) ────────────────────────────────────
// Pared to the essential: the imperative, plus (when the action lands on a
// different entity) its target chip. The whole tile opens the step in Ask IRA —
// where the full rationale and methodology live.
export function RecTile({ title, onOpen, target, intent }: { title: string; onOpen: () => void; target?: EntityRef; intent?: RecIntent }) {
  return (
    <button
      type="button" onClick={onOpen}
      title="Open this recommendation in Ask IRA (new tab)"
      className="group flex w-full items-start gap-2 text-left rounded-lg border border-canvas-border bg-canvas-elevated py-2.5 pl-3 pr-2.5 hover:border-brand-300 hover:bg-brand-50/40 transition-colors cursor-pointer"
    >
      <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-ink-900 leading-snug group-hover:text-brand-700 transition-colors">
        <span className="line-clamp-2">{title}</span>
        {target && (
          <span
            className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold ${TARGET_TONE[target.kind]}`}
            title={`This action lands on ${target.label} — it also appears on that row`}
          >
            {intent === 'create' ? '＋' : '→'} <span className="truncate">{target.label}</span>
          </span>
        )}
      </span>
      <MessageSquare size={12} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-300 group-hover:text-brand-600 transition-colors" />
    </button>
  );
}

export interface RecItem { id: string; title: string; target?: EntityRef; intent?: RecIntent }

// The fix, foregrounded. Tiles two-per-row so a 4–6 item set reads in a couple
// of rows, not a tall wall. Each tile opens in Ask IRA with the step pre-filled.
export function RecommendedActions({
  recs, onOpen, cap = REC_CAP, className = 'mt-2.5',
}: {
  recs: RecItem[];
  onOpen: (title: string) => void;
  cap?: number;
  className?: string;
}) {
  if (recs.length === 0) return null;
  return (
    <div className={`${className} rounded-xl bg-canvas border border-canvas-border p-3`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2">
        <Sparkles size={12} className="text-brand-600" aria-hidden="true" />
        Recommended actions
        <span className="text-ink-400">· {recs.length}</span>
      </div>
      <ul className="grid sm:grid-cols-2 gap-1.5 items-start">
        {recs.slice(0, cap).map((r) => (
          <li key={r.id} className="min-w-0">
            <RecTile title={r.title} onOpen={() => onOpen(r.title)} target={r.target} intent={r.intent} />
          </li>
        ))}
      </ul>
      {recs.length > cap && (
        <p className="text-[10px] text-ink-400 mt-2 px-0.5">+{recs.length - cap} more — ask IRA to walk the full set.</p>
      )}
    </div>
  );
}

export interface EvidenceRow { ref: string; label: string; detail: string }

// A collapsed-by-default evidence toggle opening a calm Source/Item/Detail
// table (no severity paint — the tone story is already told above the fold),
// with an optional deeper drill-down beneath it.
export function EvidenceDisclosure({
  evidence, label, note, evidenceExtra, defaultOpen = false, className = 'mt-3',
}: {
  evidence: EvidenceRow[];
  label: string;
  /** The scope caveat behind the evidence — how many runs it rests on and what
   *  it therefore may NOT claim. Rendered outside the disclosure, always
   *  visible: a caveat the reader has to expand to find isn't a caveat. */
  note?: string;
  /** Accepted for API compatibility — the inline check-more chips were removed
   *  by design, so these are no longer rendered. */
  checkMore?: CheckMoreOption[];
  onCheckMore?: (opt: CheckMoreOption) => void;
  evidenceExtra?: React.ReactNode;
  subjectLabel?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [show, setShow] = useState(defaultOpen);
  if (evidence.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <button
          type="button" onClick={() => setShow(v => !v)} aria-expanded={show}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer"
        >
          <motion.span animate={{ rotate: show ? 0 : -90 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex">
            <ChevronDown size={14} aria-hidden="true" />
          </motion.span>
          <ScrollText size={12} aria-hidden="true" /> {label} · {evidence.length}
        </button>
      </div>
      {note && <p className="mt-1 text-[0.65625rem] text-ink-400 leading-snug">{note}</p>}
      <AnimatePresence initial={false}>
        {evidence.length > 0 && show && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden"
          >
            <div className="mt-2 rounded-lg border border-canvas-border overflow-hidden bg-canvas-elevated">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="bg-canvas border-b border-canvas-border text-left">
                    <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-500 hidden sm:table-cell w-[172px]">Source</th>
                    <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-500">Item</th>
                    <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-500">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-border">
                  {evidence.map((e, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono text-[10.5px] text-ink-500 truncate hidden sm:table-cell">{e.ref}</td>
                      <td className="px-3 py-2 font-medium text-ink-800">{e.label}</td>
                      <td className="px-3 py-2 text-ink-700 tabular-nums">{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {evidenceExtra}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
