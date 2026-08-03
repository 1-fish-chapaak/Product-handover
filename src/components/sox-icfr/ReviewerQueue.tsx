import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, ChevronDown, ClipboardCheck, PenLine, RotateCcw, Scale, ShieldCheck, StickyNote } from 'lucide-react';
import { useIcfr } from './store';
import { assessSeverity, controlConclusion, gradeException, isAwaitingReview, pendingReviewNoteCount } from './helpers';
import { SeverityPill, Stamp } from './parts';
import { cn } from '../../lib/cn';
import type { Deficiency } from './types';

// The reviewer's desk — everything waiting on the reviewer hat, and nothing else:
// ratings to confirm before any fix can start, concluded papers to countersign,
// resolved notes to verify, retest-passed exceptions to close, fixes that have
// missed twice, and the engagement countersign. Reviewer role only.
export default function ReviewerQueue() {
  const { eng, me, setView, openControl, openDeficiency } = useIcfr();
  const papers = eng.controls.filter(isAwaitingReview);
  const notesToVerify = eng.reviewNotes.filter(n => n.status === 'Resolved');
  const awaiting = eng.deficiencies.filter(d => d.status === 'Awaiting reviewer');
  // A Significant Deficiency or worse is parked until the reviewer agrees the
  // grade — the owner cannot start planning, so this blocks other people's work
  // in a way nothing else in this queue does. It leads the list for that reason.
  const ratings = eng.deficiencies.filter(d => d.status === 'Rating review');
  // A fix that has been retested and missed twice is not a remediation problem
  // any more: the plan is not addressing the root cause. Changing the plan, the
  // person or the rating is the reviewer's call. Closed ones already carry a
  // signature, and ones sitting in the close group above are not listed twice.
  const failedRetests = (d: Deficiency) => (d.retests ?? []).filter(r => r.result === 'Fail').length;
  const repeatFails = eng.deficiencies.filter(d =>
    d.status !== 'Closed' && d.status !== 'Awaiting reviewer' && failedRetests(d) >= 2);
  const so = eng.signoff;
  const readyToCountersign = !!so.preparer && !so.reviewer;
  const count = ratings.length + papers.length + notesToVerify.length + awaiting.length + repeatFails.length + (readyToCountersign ? 1 : 0);
  // Collapsible to save the scroll — the header keeps the count visible, so
  // nothing waiting on the reviewer is ever hidden without a number saying so.
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
      <button onClick={() => setExpanded(e => !e)} aria-expanded={expanded}
        className="w-full flex items-center justify-between cursor-pointer group text-left">
        <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-compliant-700" /> Reviewer queue</h2>
        <span className="inline-flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink-400">{count} waiting on you</span>
          <ChevronDown size={15} className={cn('text-ink-400 group-hover:text-ink-600 transition-transform duration-200', !expanded && '-rotate-90')} />
        </span>
      </button>

      <AnimatePresence initial={false}>
      {expanded && (
      <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }} className="overflow-hidden">
      <div className="pt-3">
      {count === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-canvas-border bg-paper-50/40 px-3.5 py-3 text-[12.5px] text-ink-500">
          <CheckCircle2 size={15} className="text-compliant-700 shrink-0" /> Nothing waiting on you — a significant rating lands here before any fix starts, concluded papers for countersign, resolved notes for verification, exceptions when a retest passes or when a fix has missed twice, and the engagement countersign once the preparer signs.
        </div>
      ) : (
        <div className="space-y-2">
          {/* ② the blocking gate — first in the queue because it is the only
              thing here that holds someone else up. Says whose work is stopped. */}
          {ratings.map(d => {
            const { grade } = gradeException(d, eng);
            const c = eng.controls.find(x => x.id === d.controlId);
            return (
              <button key={d.id} onClick={() => openDeficiency(d.id)}
                className="w-full flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-elevated p-3 text-left hover:border-brand-300 transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-high-50 text-high-700 flex items-center justify-center shrink-0"><Scale size={16} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* rem, not the px this file grew up on (DESIGN.md §3) — the
                        values are the same sizes to the pixel, they just scale. */}
                    <span className="font-mono text-[0.71875rem] font-semibold text-ink-600">{d.id}</span>
                    <span className="font-mono text-[0.71875rem] text-brand-700">{c?.wpRef ?? d.controlId}</span>
                    <span className="text-[0.65625rem] font-bold uppercase tracking-wide text-high-700">Confirm the rating</span>
                  </div>
                  <div className="text-[0.8125rem] text-ink-800 truncate mt-0.5">{d.description}</div>
                  <div className="text-[0.71875rem] text-ink-400 mt-0.5">
                    Rated {grade} — <span className="text-high-700 font-semibold">{d.remediation.owner} cannot start planning until you confirm it</span>, or send it back with a reason.
                  </div>
                </div>
                <ArrowRight size={15} className="text-ink-300 shrink-0" />
              </button>
            );
          })}
          {papers.map(c => {
            const noteN = pendingReviewNoteCount(eng, c.id);
            return (
              <button key={c.id} onClick={() => openControl(c.id)}
                className="w-full flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-elevated p-3 text-left hover:border-brand-300 transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-evidence-50 text-evidence-700 flex items-center justify-center shrink-0"><ClipboardCheck size={16} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11.5px] font-semibold text-ink-600">{c.wpRef}</div>
                  <div className="text-[13px] text-ink-800 truncate mt-0.5">{c.description}</div>
                  <div className="text-[11.5px] text-ink-400 mt-0.5">
                    Signed by {c.wpSignoff?.preparer?.by ?? '—'} · {c.wpSignoff?.preparer?.at ?? ''} — countersign or return
                    {noteN > 0 && <span className="text-high-700 font-semibold"> · {noteN} review note{noteN === 1 ? '' : 's'} to clear</span>}
                  </div>
                </div>
                <Stamp result={controlConclusion(c) === 'Ineffective' ? 'Ineffective' : 'Effective'} animate={false} />
                {/* gap-3 (12px) + ml-2 (8px) = 20px between stamp and arrow */}
                <ArrowRight size={15} className="text-ink-300 shrink-0 ml-2" />
              </button>
            );
          })}
          {notesToVerify.map(n => {
            const c = eng.controls.find(x => x.id === n.controlId);
            return (
              <button key={n.id} onClick={() => openControl(n.controlId)}
                className="w-full flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-elevated p-3 text-left hover:border-brand-300 transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-high-50 text-high-700 flex items-center justify-center shrink-0"><StickyNote size={16} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11.5px] font-semibold text-ink-600">{c?.wpRef ?? n.controlId}</span>
                    <span className="text-[10.5px] font-bold uppercase tracking-wide text-evidence-700">Verify resolution</span>
                  </div>
                  <div className="text-[13px] text-ink-800 truncate mt-0.5">{n.text}</div>
                  <div className="text-[11.5px] text-ink-400 mt-0.5">Resolved by {n.resolution?.by ?? '—'} · {n.resolution?.at ?? ''} — verify &amp; close, or reopen</div>
                </div>
                <ArrowRight size={15} className="text-ink-300 shrink-0" />
              </button>
            );
          })}
          {awaiting.map(d => {
            const mine = !!d.retest && d.retest.by === me;
            return (
              <button key={d.id} onClick={() => openDeficiency(d.id)}
                className="w-full flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-elevated p-3 text-left hover:border-brand-300 transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-compliant-50 text-compliant-700 flex items-center justify-center shrink-0"><ShieldCheck size={16} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11.5px] font-semibold text-ink-600">{d.id}</span>
                    <span className="font-mono text-[11.5px] text-brand-700">{d.controlId}</span>
                    <SeverityPill s={assessSeverity(d, eng).final} />
                  </div>
                  <div className="text-[13px] text-ink-800 truncate mt-0.5">{d.description}</div>
                  <div className="text-[11.5px] text-ink-400 mt-0.5">
                    Retest {d.retest?.result ?? '—'} · {d.retest?.by ?? '—'}{mine && <span className="text-high-700 font-semibold"> — a different person must close this one</span>}
                  </div>
                </div>
                <ArrowRight size={15} className="text-ink-300 shrink-0" />
              </button>
            );
          })}
          {/* the loop that isn't closing — two retests, two misses, same root
              cause. Shown with the last tester's reason, because that is the
              sentence that says whether the plan or the rating is wrong. */}
          {repeatFails.map(d => {
            const c = eng.controls.find(x => x.id === d.controlId);
            const n = failedRetests(d);
            const last = d.retests?.[d.retests.length - 1];
            return (
              <button key={`loop-${d.id}`} onClick={() => openDeficiency(d.id)}
                className="w-full flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-elevated p-3 text-left hover:border-brand-300 transition-colors cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-risk-50 text-risk-700 flex items-center justify-center shrink-0"><RotateCcw size={16} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[0.71875rem] font-semibold text-ink-600">{d.id}</span>
                    <span className="font-mono text-[0.71875rem] text-brand-700">{c?.wpRef ?? d.controlId}</span>
                    <span className="text-[0.65625rem] font-bold uppercase tracking-wide text-risk-700">{n} retests failed</span>
                    <SeverityPill s={assessSeverity(d, eng).final} />
                  </div>
                  {/* the root cause, not the description — what the plan keeps missing */}
                  <div className="text-[0.8125rem] text-ink-800 truncate mt-0.5">{d.rootCause}</div>
                  <div className="text-[0.71875rem] text-ink-400 mt-0.5">
                    {last?.rationale ? `Last miss · ${last.rationale}` : `Last retest ${last?.at ?? '—'} · ${last?.by ?? '—'}`} — the fix is not reaching the root cause. Change the plan, the owner or the rating.
                  </div>
                </div>
                <ArrowRight size={15} className="text-ink-300 shrink-0" />
              </button>
            );
          })}
          {readyToCountersign && (
            <button onClick={() => document.getElementById('eng-signoff')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="w-full flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-elevated p-3 text-left hover:border-brand-300 transition-colors cursor-pointer">
              <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><PenLine size={16} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-ink-800">Engagement countersign</div>
                <div className="text-[11.5px] text-ink-400 mt-0.5">Prepared by {so.preparer!.by} · {so.preparer!.at} — your signature concludes the engagement.</div>
              </div>
              <ArrowRight size={15} className="text-ink-300 shrink-0" />
            </button>
          )}
        </div>
      )}
      </div>
      </motion.div>
      )}
      </AnimatePresence>
    </section>
  );
}
