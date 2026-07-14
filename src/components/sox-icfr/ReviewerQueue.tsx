import { ArrowRight, CheckCircle2, ClipboardCheck, PenLine, ShieldCheck } from 'lucide-react';
import { useIcfr } from './store';
import { assessSeverity, controlConclusion, isAwaitingReview } from './helpers';
import { SeverityPill, Stamp } from './parts';

// The reviewer's desk — everything waiting on the reviewer hat, and nothing else:
// concluded papers to countersign, retest-passed exceptions to close, and the
// engagement countersign. Rendered only in the Reviewer role, mirroring RiskOwnerPortal.
export default function ReviewerQueue() {
  const { eng, me, setView, openControl } = useIcfr();
  const papers = eng.controls.filter(isAwaitingReview);
  const awaiting = eng.deficiencies.filter(d => d.status === 'Awaiting reviewer');
  const so = eng.signoff;
  const readyToCountersign = !!so.preparer && !so.reviewer;
  const count = papers.length + awaiting.length + (readyToCountersign ? 1 : 0);

  return (
    <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-compliant-700" /> Reviewer queue</h2>
        <span className="text-[11px] font-semibold text-ink-400">{count} waiting on you</span>
      </div>

      {count === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-canvas-border bg-paper-50/40 px-3.5 py-3 text-[12.5px] text-ink-500">
          <CheckCircle2 size={15} className="text-compliant-700 shrink-0" /> Nothing waiting on you — concluded papers land here for countersign, exceptions when a retest passes, and the engagement countersign once the preparer signs.
        </div>
      ) : (
        <div className="space-y-2">
          {papers.map(c => (
            <button key={c.id} onClick={() => openControl(c.id)}
              className="w-full flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-elevated p-3 text-left hover:border-brand-300 transition-colors cursor-pointer">
              <div className="w-9 h-9 rounded-lg bg-evidence-50 text-evidence-700 flex items-center justify-center shrink-0"><ClipboardCheck size={16} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11.5px] font-semibold text-ink-600">{c.wpRef}</span>
                  <Stamp result={controlConclusion(c) === 'Ineffective' ? 'Ineffective' : 'Effective'} animate={false} />
                </div>
                <div className="text-[13px] text-ink-800 truncate mt-0.5">{c.description}</div>
                <div className="text-[11.5px] text-ink-400 mt-0.5">Signed by {c.wpSignoff?.preparer?.by ?? '—'} · {c.wpSignoff?.preparer?.at ?? ''} — countersign or return</div>
              </div>
              <ArrowRight size={15} className="text-ink-300 shrink-0" />
            </button>
          ))}
          {awaiting.map(d => {
            const mine = !!d.retest && d.retest.by === me;
            return (
              <button key={d.id} onClick={() => setView('deficiencies')}
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
    </section>
  );
}
