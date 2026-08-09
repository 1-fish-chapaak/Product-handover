// ─── AI recommendations popover — the per-row surface ──────────────────────
//
// Replaces the tab-level RecommendationsPanel: instead of one panel at the top
// of a tab, each row carries an "AI recommends" badge that opens THIS popover
// with exactly that subject's recommendations. Same card language as the old
// panel (priority pill · category · title · rationale · basis · guardrail, each
// opening in Ask IRA), just scoped to one control / workflow / RACM row.
//
// Deterministic — the recs are computed by the caller (actionableRecs & friends,
// no LLM). The popover renders in a portal so the row's `overflow-hidden` never
// clips it, and anchors to the badge (flipping up when there's no room below).

import { useState, useRef, useLayoutEffect, useEffect, useCallback, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, MessageSquare, ArrowUpRight, X,
  ShieldAlert, SlidersHorizontal, FileCheck2, Crosshair, Scale, ListChecks,
  Gauge, CalendarClock, Zap, Users, Activity, type LucideIcon,
} from 'lucide-react';
import {
  REC_CATEGORY_META, REC_PRIORITY_META,
  type AuditRecommendation, type RecCategory, type VerdictTone,
} from '../../data/layeredInsights';
import { runActionInChat } from './insightChat';

const REC_ICON: Record<RecCategory, LucideIcon> = {
  coverage: ShieldAlert, sampling: SlidersHorizontal, evidence: FileCheck2,
  'root-cause': Crosshair, deficiency: Scale, scoping: ListChecks, rating: Gauge,
  timeliness: CalendarClock, automation: Zap, segregation: Users, monitoring: Activity,
};

const TONE_PILL: Record<VerdictTone, string> = {
  negative: 'bg-risk-50 text-risk border-risk/25',
  caution: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200',
  positive: 'bg-compliant-50 text-compliant-700 border-compliant-200',
};
const TONE_DOT: Record<VerdictTone, string> = {
  negative: 'bg-risk', caution: 'bg-mitigated-500', positive: 'bg-compliant',
};
const PRIORITY_RANK = { 'do-now': 0, 'this-period': 1, advisory: 2 } as const;

const PANEL_W = 384;

export default function AIRecommendsPopover({
  recs, subjectLabel, subjectSub, className = '',
}: {
  /** The subject's actionable recommendations (already computed, no LLM). */
  recs: AuditRecommendation[];
  /** Row identity used in the header and the Ask IRA hand-off, e.g. "P2P-C-01". */
  subjectLabel: string;
  /** Secondary label, e.g. the control description. */
  subjectSub?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  const sorted = [...recs].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const doNow = sorted.filter(r => r.priority === 'do-now').length;
  const thisPeriod = sorted.filter(r => r.priority === 'this-period').length;
  const topPriority: 'do-now' | 'this-period' = doNow > 0 ? 'do-now' : 'this-period';

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estH = Math.min(440, 132 + recs.length * 92);
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < estH + 16 && rect.top > estH + 16;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - PANEL_W - 12);
    setStyle({
      position: 'fixed',
      left,
      width: PANEL_W,
      ...(flipUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
      zIndex: 80,
    });
  }, [recs.length]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, place]);

  if (recs.length === 0) return null;

  const toggle = (e: { stopPropagation: () => void }) => { e.stopPropagation(); setOpen(o => !o); };
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); }
  };
  const close = (e?: { stopPropagation: () => void }) => { e?.stopPropagation(); setOpen(false); };

  const tone = topPriority === 'do-now'
    ? 'bg-risk-50 text-risk border-risk/20 hover:bg-risk-100'
    : 'bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100';

  return (
    <span ref={triggerRef} className={`relative inline-flex ${className}`}>
      {/* Trigger — a span (not a button) so it can nest inside row buttons safely */}
      <span
        role="button" tabIndex={0}
        aria-haspopup="dialog" aria-expanded={open}
        onClick={toggle} onKeyDown={onKey}
        title={`AI has ${recs.length} recommendation${recs.length === 1 ? '' : 's'} for this item — click to view`}
        className={`inline-flex items-center gap-1 rounded-full px-2 h-5 text-[0.625rem] font-bold border cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${tone} ${open ? 'ring-2 ring-brand-500/30' : ''}`}
      >
        <Sparkles size={9} aria-hidden="true" /> AI recommends{topPriority === 'do-now' ? ' · Do now' : ''}
      </span>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-[75]" onClick={close} />
              <motion.div
                style={style}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
                onClick={(e) => e.stopPropagation()}
                role="dialog" aria-label={`AI recommendations for ${subjectLabel}`}
                className="rounded-2xl border border-brand-200/70 bg-canvas-elevated shadow-xl overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center gap-2 p-3 border-b border-canvas-border bg-gradient-to-b from-brand-50/50 to-canvas-elevated">
                  <span className="size-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0"><Sparkles size={13} aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-[13px] font-bold text-ink-900 leading-tight">AI recommendations</h3>
                      <span className="text-[10px] text-ink-400 tabular-nums">· {recs.length}</span>
                    </div>
                    <p className="text-[11px] text-ink-500 truncate">{subjectLabel}{subjectSub ? ` — ${subjectSub}` : ''}</p>
                  </div>
                  <button type="button" onClick={close} aria-label="Close" className="ml-auto shrink-0 text-ink-400 hover:text-ink-700 cursor-pointer"><X size={15} /></button>
                </div>

                {/* Priority summary */}
                <div className="flex items-center gap-1.5 px-3 pt-2.5 flex-wrap">
                  {doNow > 0 && <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${TONE_PILL.negative}`}><span className={`size-1 rounded-full ${TONE_DOT.negative}`} /> {doNow} do now</span>}
                  {thisPeriod > 0 && <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${TONE_PILL.caution}`}><span className={`size-1 rounded-full ${TONE_DOT.caution}`} /> {thisPeriod} this period</span>}
                  <span className="ml-auto text-[9.5px] text-ink-400 inline-flex items-center gap-1"><MessageSquare size={9} aria-hidden="true" /> click one to run it in chat</span>
                </div>

                {/* Recommendations */}
                <ul className="p-2 max-h-[360px] overflow-y-auto divide-y divide-canvas-border/70">
                  {sorted.map((r, i) => {
                    const CatIcon = REC_ICON[r.category];
                    const pm = REC_PRIORITY_META[r.priority];
                    return (
                      <li key={r.id ?? `${r.category}-${i}`}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); runActionInChat({ rec: r, subjectLabel, subjectSub }); setOpen(false); }}
                          title="Runs this recommendation in Ask IRA (new tab)"
                          className="group w-full text-left px-2 py-2.5 rounded-lg hover:bg-brand-50/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${TONE_PILL[pm.tone]}`}>
                              <span className={`size-1 rounded-full ${TONE_DOT[pm.tone]}`} /> {pm.label}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-canvas-elevated border border-canvas-border px-2 py-0.5 text-[9px] font-bold text-ink-600">
                              <CatIcon size={9} aria-hidden="true" /> {REC_CATEGORY_META[r.category].label}
                            </span>
                            <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600/70 group-hover:text-brand-700 transition-colors">
                              <MessageSquare size={10} aria-hidden="true" /><span className="hidden sm:inline">Run in chat</span><ArrowUpRight size={9} aria-hidden="true" />
                            </span>
                          </div>
                          <p className="text-[12px] font-semibold text-ink-900 leading-snug">{r.title}</p>
                          <p className="text-[11px] text-ink-500 leading-relaxed mt-0.5">{r.rationale}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            {r.basis && <span className="font-mono text-[9.5px] text-ink-400">{r.basis}</span>}
                            {r.guardrail && <span className="text-[9.5px] text-mitigated-700">· {r.guardrail}</span>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}
