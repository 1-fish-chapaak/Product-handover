// ─── Shared insight action surfaces ────────────────────────────────────────
//
// The two reusable blocks that sit at the bottom of an AI-insight card:
//
//   1. EvidenceDisclosure — the collapsible "Evidence · N" toggle (collapsed by
//      default), inline "check more" chips, and the calm Source/Item/Detail
//      table, with an optional deeper drill-down (`evidenceExtra`).
//   2. RecommendedActions — the two-per-row grid of recommendation tiles under a
//      "Recommended actions · N · Open one to work it in chat" header.
//
// Extracted from LayeredInsightCard so every surface (the layered control/risk/
// engagement cards AND the workflow output-compare card) renders them
// identically from one source, not divergent copies.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, ChevronDown, ScrollText, MessageSquare, ArrowUpRight,
  Crosshair, Split, GitCompareArrows, MessageCircleQuestion,
} from 'lucide-react';
import type { CheckMoreOption } from '../../data/layeredInsights';
import { openInChat as openChatTab } from './insightChat';

export const REC_CAP = 6;

const CHECK_ICON: Record<CheckMoreOption['kind'], typeof Crosshair> = {
  compare: GitCompareArrows, split: Split, trace: Crosshair, ask: MessageCircleQuestion,
};

// ─── Recommended-action tile (grid cell) ────────────────────────────────────
// Pared to the essential: the imperative, and nothing else. The whole tile
// opens the step in Ask IRA — where the full rationale and methodology live.
export function RecTile({ title, onOpen }: { title: string; onOpen: () => void }) {
  return (
    <button
      type="button" onClick={onOpen}
      title="Open this recommendation in Ask IRA (new tab)"
      className="group flex w-full items-start gap-2 text-left rounded-lg border border-canvas-border bg-canvas-elevated py-2.5 pl-3 pr-2.5 hover:border-brand-300 hover:bg-brand-50/40 transition-colors cursor-pointer"
    >
      <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-ink-900 leading-snug line-clamp-2 group-hover:text-brand-700 transition-colors">{title}</span>
      <MessageSquare size={12} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-300 group-hover:text-brand-600 transition-colors" />
    </button>
  );
}

export interface RecItem { id: string; title: string }

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
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-100/70 px-2 py-0.5 text-[9px] font-semibold text-brand-700 normal-case tracking-normal">
          <MessageSquare size={10} aria-hidden="true" /> Open one to work it in chat
        </span>
      </div>
      <ul className="grid sm:grid-cols-2 gap-1.5 items-start">
        {recs.slice(0, cap).map((r) => (
          <li key={r.id} className="min-w-0">
            <RecTile title={r.title} onOpen={() => onOpen(r.title)} />
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

// A collapsed-by-default evidence toggle + inline check-more chips on one line,
// opening a calm Source/Item/Detail table (no severity paint — the tone story is
// already told above the fold), with an optional deeper drill-down beneath it.
export function EvidenceDisclosure({
  evidence, label, checkMore = [], onCheckMore, evidenceExtra,
  subjectLabel, defaultOpen = false, className = 'mt-3',
}: {
  evidence: EvidenceRow[];
  label: string;
  checkMore?: CheckMoreOption[];
  onCheckMore?: (opt: CheckMoreOption) => void;
  evidenceExtra?: React.ReactNode;
  subjectLabel?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [show, setShow] = useState(defaultOpen);
  if (evidence.length === 0 && checkMore.length === 0) return null;
  const runCheck = (opt: CheckMoreOption) =>
    onCheckMore ? onCheckMore(opt) : openChatTab(opt.detail ? `${opt.label} — ${opt.detail}` : opt.label, subjectLabel);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {evidence.length > 0 && (
          <button
            type="button" onClick={() => setShow(v => !v)} aria-expanded={show}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer"
          >
            <motion.span animate={{ rotate: show ? 0 : -90 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex">
              <ChevronDown size={14} aria-hidden="true" />
            </motion.span>
            <ScrollText size={12} aria-hidden="true" /> {label} · {evidence.length}
          </button>
        )}
        {evidence.length > 0 && checkMore.length > 0 && (
          <span className="h-3.5 w-px bg-canvas-border mx-1 hidden sm:block" aria-hidden="true" />
        )}
        {checkMore.map((opt, i) => {
          const Icon = CHECK_ICON[opt.kind];
          return (
            <button
              key={i} type="button" onClick={() => runCheck(opt)}
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
