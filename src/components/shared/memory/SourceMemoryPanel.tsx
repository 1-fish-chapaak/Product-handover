// ─── Source memory panel — the living data dictionary on the source page ────
//
// "Knowledge Hub manages source memory, and only source memory" (Memory-
// across-platform PRD §6). Everything IRA knows about a table lives HERE, on
// the source it describes: column meanings, roles, grain, always-filters,
// sensitivity, upload shape — written by use (clarifications, validated runs),
// never by form-filling. Drift review surfaces first, before anyone is hit
// mid-run. Rows also list in Smart Learn (D2: one registry) via "Registry →".

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Brain, Check, ChevronRight, Landmark, Lock, Route, ShieldCheck,
  Sparkles, TriangleAlert, BookOpen, Undo2,
} from 'lucide-react';
import { useToast } from '../Toast';
import {
  KIND_META,
  type MemoryKind, type PlatformMemory,
} from '../../../data/memoryStore';
import {
  useMemorySessionVersion, allMemories, isGone, decisionFor,
  resolveDrift, captureMemory, uncaptureMemory,
} from '../../../data/memorySession';
import { navigateToMemory, navigateToSmartLearn } from './MemoryKit';

const KIND_BADGE: Record<MemoryKind, { icon: React.ElementType; tint: string }> = {
  vocabulary: { icon: BookOpen, tint: 'bg-brand-50 text-brand-700' },
  decision:   { icon: Route, tint: 'bg-canvas text-ink-600' },
  fact:       { icon: Landmark, tint: 'bg-canvas text-ink-600' },
  rule:       { icon: ShieldCheck, tint: 'bg-evidence-50 text-evidence-700' },
  preference: { icon: Brain, tint: 'bg-brand-50 text-brand-700' },
  correction: { icon: Brain, tint: 'bg-brand-50 text-brand-700' },
  routine:    { icon: Brain, tint: 'bg-brand-50 text-brand-700' },
};

/** Which seeded source-memory rows describe this source. Matching is by the
 *  owning entity label vs the source's display name (token overlap) — the
 *  demo's sources and rows share vocabulary (vendor master, AP ageing). */
function rowsForSource(sourceName: string, rows: PlatformMemory[]): PlatformMemory[] {
  const n = sourceName.toLowerCase();
  return rows.filter(m => {
    if (m.scope !== 'source') return false;
    const label = (m.entity?.label ?? '').toLowerCase();
    if (!label) return false;
    if (n.includes(label) || label.includes(n)) return true;
    if (/vendor/.test(n) && /vendor/.test(label)) return true;
    if (/(^|\W)(ap|ageing|aging|invoice|payable)/.test(n) && /(ap_|ageing)/.test(label)) return true;
    return false;
  });
}

let learnSeq = 0;

export default function SourceMemoryPanel({ sourceId, sourceName }: { sourceId: string; sourceName: string }) {
  const sessionVersion = useMemorySessionVersion();
  const { addToast } = useToast();

  const rows = useMemo(
    () => rowsForSource(sourceName, allMemories()).filter(m => !isGone(m)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceName, sessionVersion],
  );
  const drifted = rows.filter(m => m.drifted);
  const [open, setOpen] = useState(drifted.length > 0);
  const [learnedIds, setLearnedIds] = useState<string[]>([]);

  // "Learn this table from my last analysis" — the bundle capture: pull the
  // definitions a past run already resolved, propose them in one action.
  const learnFromAnalysis = () => {
    learnSeq += 1;
    const mk = (suffix: string, kind: MemoryKind, statement: string): PlatformMemory => ({
      id: `mem-cap-src-${learnSeq}-${suffix}`,
      scope: 'source', kind, status: 'proposed',
      statement,
      source: 'Extracted from your last validated run of this table',
      pendingNote: 'Pulled from work that already ran clean — waiting on approval in My Queue.',
      evidence: [{ label: 'Run · definitions resolved and validated in the last analysis', date: 'today' }],
      learnedOn: 'today', recallCount: 0, lastRecalled: '—',
      firesIn: ['runs', 'chat'],
      entity: { id: sourceId, label: sourceName },
    });
    const bundle = [
      mk('role', 'decision', `Date operations on ${sourceName} use the document date column, not the posting date.`),
      mk('grain', 'fact', `One row in ${sourceName} means one line item — counts must de-duplicate on the document number.`),
    ];
    bundle.forEach(captureMemory);
    setLearnedIds(bundle.map(b => b.id));
    setOpen(true);
    addToast({ type: 'success', message: '2 definitions extracted — proposed to source memory, review in My Queue.' });
  };

  const undoLearn = () => {
    learnedIds.forEach(uncaptureMemory);
    setLearnedIds([]);
  };

  const count = rows.length;

  return (
    <div className="shrink-0 rounded-xl border border-canvas-border bg-canvas-elevated">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
        >
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex text-ink-400">
            <ChevronRight size={14} />
          </motion.span>
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Brain size={14} />
          </span>
          <span className="text-[0.8125rem] font-semibold text-ink-900">What IRA knows about this source</span>
          <span className="rounded-full border border-canvas-border bg-canvas px-1.5 py-px text-[0.625rem] font-bold tabular-nums text-ink-500">{count}</span>
          {drifted.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-mitigated-200 bg-mitigated-50 px-2 py-0.5 text-[0.625rem] font-bold text-mitigated-700">
              <TriangleAlert size={10} /> {drifted.length} drifted — review before the next run
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={learnFromAnalysis}
          className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 text-[0.6875rem] font-semibold text-brand-700 hover:border-brand-300 transition-colors cursor-pointer"
          title="Extract every definition, role and filter your last validated run already resolved"
        >
          <Sparkles size={12} /> Learn from my last analysis
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.25, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.18 } }}
            className="overflow-hidden"
          >
            <div className="border-t border-canvas-border px-4 py-3">
              {/* Drift review first — the human-facing half of the fingerprint */}
              {drifted.length > 0 && (
                <div className="mb-3 space-y-2">
                  {drifted.map(m => (
                    <div key={m.id} className="rounded-lg border border-mitigated-200 bg-mitigated-50/60 px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <TriangleAlert size={12} className="text-mitigated-700" />
                        <span className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-mitigated-700">Schema drifted — check before trusting</span>
                      </div>
                      <p className="mt-1 text-[0.8125rem] font-medium leading-snug text-ink-900">{m.statement}</p>
                      <p className="mt-0.5 text-[0.6875rem] text-ink-500">Written against {m.fingerprint} — the July file moved this column. The mapping updates after two consecutive confirmations.</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { resolveDrift(m); addToast({ type: 'success', message: 'Mapping re-confirmed against the new layout — logged.' }); }}
                          className="inline-flex h-7 items-center rounded-md bg-ink-900 px-2.5 text-[0.6875rem] font-semibold text-white hover:bg-ink-800 transition-colors cursor-pointer"
                        >
                          Re-confirm mapping
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateToMemory(m.id)}
                          className="inline-flex h-7 items-center rounded-md px-2 text-[0.6875rem] font-semibold text-ink-500 hover:text-brand-700 transition-colors cursor-pointer"
                        >
                          View in registry
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {learnedIds.length > 0 && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-compliant/30 bg-compliant-50 px-3 py-2">
                  <Check size={13} strokeWidth={3} className="shrink-0 text-compliant-700" />
                  <span className="min-w-0 flex-1 text-[0.75rem] font-semibold text-compliant-700">
                    {learnedIds.length} definitions extracted from your last run — proposed below and in My Queue.
                  </span>
                  <button type="button" onClick={undoLearn}
                    className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer">
                    <Undo2 size={11} /> Undo
                  </button>
                </div>
              )}

              {count === 0 ? (
                <p className="py-2 text-[0.75rem] leading-relaxed text-ink-500">
                  Nothing yet. Definitions accumulate as this source is used — every clarification answered becomes a memory, or extract them in one action from a run that already worked.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {rows.filter(m => !m.drifted).map(m => {
                    const badge = KIND_BADGE[m.kind];
                    const BIcon = badge.icon;
                    return (
                      <div key={m.id} className="flex items-start gap-2.5 rounded-lg border border-canvas-border bg-canvas/40 px-3 py-2">
                        <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${badge.tint}`}>
                          <BIcon size={12} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.75rem] font-medium leading-snug text-ink-900">{m.statement}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.625rem] text-ink-400">
                            <span className="font-semibold text-ink-600">{KIND_META[m.kind].label}</span>
                            {m.status === 'proposed' && <span className="rounded-full bg-mitigated-50 px-1.5 py-px font-bold text-mitigated-700">Awaiting approval</span>}
                            <span>·</span><span>{m.source}</span>
                            <span>·</span><span className="tabular-nums">fired {m.recallCount}×</span>
                            {m.kind === 'rule' && <Lock size={9} className="text-evidence-700" />}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigateToMemory(m.id)}
                          title="Manage in Smart Learn"
                          className="shrink-0 pt-0.5 text-[0.625rem] font-semibold text-ink-400 hover:text-brand-700 transition-colors cursor-pointer"
                        >
                          Registry →
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-2.5 flex items-center justify-between border-t border-canvas-border pt-2">
                <p className="text-[0.625rem] text-ink-400">
                  Captured at the moment of confusion — every clarification answered here never gets asked again.
                </p>
                <button type="button" onClick={navigateToSmartLearn}
                  className="inline-flex items-center gap-0.5 text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer">
                  Open Smart Learn <ChevronRight size={11} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
