// ─── AI Recommendations panel — visible, no generation required ────────────
//
// Recommendations are deterministic (no LLM), so unlike the full narrative
// insight they surface DIRECTLY — a prioritised worklist at the top of a tab
// (Controls / RACM / Workflows). Identical recommendations across items collapse
// into ONE themed row (three key controls needing scheduling is one theme, not
// three lines) — the way a real management-letter point reads. Each row is
// grounded in methodology and opens in Ask IRA on click. The manual "Generate"
// trigger is reserved for the deeper narrative insight; recommendations never
// cost a call.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, ChevronDown, MessageSquare, ArrowUpRight,
  ShieldAlert, SlidersHorizontal, FileCheck2, Crosshair, Scale, ListChecks,
  Gauge, CalendarClock, Zap, Users, Activity, type LucideIcon,
} from 'lucide-react';
import {
  REC_CATEGORY_META, REC_PRIORITY_META,
  type AuditRecommendation, type RecCategory, type VerdictTone,
} from '../../data/layeredInsights';
import { openInChat } from './insightChat';

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

/** A recommendation tagged with the item it belongs to. */
export interface PanelRec extends AuditRecommendation {
  subjectLabel: string;   // "P2P-C-01" / "Duplicate Invoice Detector" / risk id
  subjectSub?: string;    // secondary label, e.g. the control description
}

interface RecGroup {
  rec: PanelRec;
  subjects: { label: string; sub?: string }[];
}

const DEFAULT_VISIBLE = 6;

export default function RecommendationsPanel({
  recs, scopeLabel, className = '',
}: {
  recs: PanelRec[];
  /** e.g. "these controls", "this RACM library". */
  scopeLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Collapse identical recommendations (same priority + category + title) across
  // subjects into one themed row; keep the first occurrence's copy.
  const sorted = [...recs].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const groups: RecGroup[] = [];
  const index = new Map<string, number>();
  for (const r of sorted) {
    const key = `${r.priority}|${r.category}|${r.title}`;
    const at = index.get(key);
    if (at != null) groups[at].subjects.push({ label: r.subjectLabel, sub: r.subjectSub });
    else { index.set(key, groups.length); groups.push({ rec: r, subjects: [{ label: r.subjectLabel, sub: r.subjectSub }] }); }
  }
  const counts = {
    'do-now': groups.filter(g => g.rec.priority === 'do-now').length,
    'this-period': groups.filter(g => g.rec.priority === 'this-period').length,
    advisory: groups.filter(g => g.rec.priority === 'advisory').length,
  };
  const distinctSubjects = new Set(recs.map(r => r.subjectLabel)).size;
  const visible = showAll ? groups : groups.slice(0, DEFAULT_VISIBLE);

  if (groups.length === 0) {
    return (
      <div className={`rounded-2xl border border-canvas-border bg-canvas-elevated p-4 flex items-center gap-2.5 ${className}`}>
        <span className="size-8 rounded-xl bg-compliant-50 text-compliant-700 flex items-center justify-center shrink-0"><Sparkles size={15} /></span>
        <div>
          <p className="text-[13px] font-semibold text-ink-800">No actionable recommendations for {scopeLabel} right now.</p>
          <p className="text-[11px] text-ink-500">The engine looked and found nothing time-sensitive — a signed pass, not silence.</p>
        </div>
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border border-brand-200/60 bg-gradient-to-b from-brand-50/40 to-canvas-elevated overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 p-4">
        <span className="size-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0"><Sparkles size={15} aria-hidden="true" /></span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-bold text-ink-900 leading-tight">AI recommendations</h3>
            <span className="text-[11px] text-ink-400 tabular-nums">· {groups.length} across {distinctSubjects} of {scopeLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {counts['do-now'] > 0 && <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${TONE_PILL.negative}`}><span className={`size-1 rounded-full ${TONE_DOT.negative}`} /> {counts['do-now']} do now</span>}
            {counts['this-period'] > 0 && <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${TONE_PILL.caution}`}><span className={`size-1 rounded-full ${TONE_DOT.caution}`} /> {counts['this-period']} this period</span>}
            {counts.advisory > 0 && <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${TONE_PILL.positive}`}><span className={`size-1 rounded-full ${TONE_DOT.positive}`} /> {counts.advisory} advisory</span>}
            <span className="text-[10px] text-ink-400 inline-flex items-center gap-1"><MessageSquare size={10} /> click any to work it in chat · no generation</span>
          </div>
        </div>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? 'Collapse' : 'Expand'}
          className="ml-auto shrink-0 text-ink-400 hover:text-ink-700 cursor-pointer">
          <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex"><ChevronDown size={18} /></motion.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden"
          >
            <ul className="px-2 pb-2 divide-y divide-canvas-border/70">
              {visible.map((g, gi) => {
                const r = g.rec;
                const CatIcon = REC_ICON[r.category];
                const pm = REC_PRIORITY_META[r.priority];
                const many = g.subjects.length > 1;
                const chatSubject = g.subjects.map(s => s.label).join(', ');
                return (
                  <li key={`${r.priority}-${r.category}-${gi}`}>
                    <button
                      type="button" onClick={() => openInChat(r.title, chatSubject)}
                      title="Open this recommendation in Ask IRA (new tab)"
                      className="group w-full text-left px-2.5 py-2.5 rounded-lg hover:bg-brand-50/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${TONE_PILL[pm.tone]}`}>
                          <span className={`size-1 rounded-full ${TONE_DOT[pm.tone]}`} /> {pm.label}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-canvas-elevated border border-canvas-border px-2 py-0.5 text-[9px] font-bold text-ink-600">
                          <CatIcon size={9} aria-hidden="true" /> {REC_CATEGORY_META[r.category].label}
                        </span>
                        {many
                          ? <span className="text-[10px] font-semibold text-brand-700 tabular-nums">{g.subjects.length} items</span>
                          : (<><span className="font-mono text-[10px] text-brand-700 font-semibold">{g.subjects[0].label}</span>{g.subjects[0].sub && <span className="text-[10px] text-ink-400 truncate max-w-[280px] hidden md:inline">{g.subjects[0].sub}</span>}</>)}
                        <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600/70 group-hover:text-brand-700 transition-colors">
                          <MessageSquare size={11} aria-hidden="true" /><span className="hidden sm:inline">Open in chat</span><ArrowUpRight size={10} aria-hidden="true" />
                        </span>
                      </div>
                      <p className="text-[12px] font-semibold text-ink-900 leading-snug">{r.title}</p>
                      <p className="text-[11px] text-ink-500 leading-relaxed mt-0.5">{r.rationale}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        {r.basis && <span className="font-mono text-[9.5px] text-ink-400">{r.basis}</span>}
                        {r.guardrail && <span className="text-[9.5px] text-mitigated-700">· {r.guardrail}</span>}
                      </div>
                      {many && (
                        <div className="flex items-center gap-1 flex-wrap mt-1.5">
                          {g.subjects.slice(0, 8).map((s, i) => (
                            <span key={i} className="font-mono text-[9.5px] text-brand-700 bg-brand-50 border border-brand-100 rounded px-1.5 py-0.5">{s.label}</span>
                          ))}
                          {g.subjects.length > 8 && <span className="text-[9.5px] text-ink-400">+{g.subjects.length - 8} more</span>}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {groups.length > DEFAULT_VISIBLE && (
              <div className="px-4 pb-3">
                <button type="button" onClick={() => setShowAll(s => !s)}
                  className="text-[11px] font-semibold text-brand-700 hover:text-brand-600 cursor-pointer">
                  {showAll ? 'Show fewer' : `Show all ${groups.length} themes`}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
