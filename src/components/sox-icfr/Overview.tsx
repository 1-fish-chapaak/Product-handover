import { useMemo } from 'react';
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Circle, Hourglass, Inbox, PenLine, Scale, ArrowRight, ShieldAlert, ShieldCheck, Upload, MessageSquare, FileWarning,
} from 'lucide-react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import {
  assessSeverity, controlConclusion, engagementProgress, formatINR, isClearlyTrivial, periodEndDate, testsDueNow, trackResult,
} from './helpers';
import { cn } from '../../lib/cn';
import RiskOwnerPortal from './RiskOwnerPortal';
import ReviewerQueue from './ReviewerQueue';
import type { Control, Severity, TaskType } from './types';

const fmt = (n: number) => formatINR(n);

// process spine colours — on-theme purple/blue families, mirrors the Control Library shelves
const BINDINGS = ['#6A12CD', '#0369A1', '#550FA5', '#075985', '#8838DE', '#0284C7', '#3B0B72', '#1E3A5F'];
function spineColor(p: string): string { let h = 0; for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return BINDINGS[h % BINDINGS.length]!; }

const SEV_META: { key: Severity; label: string; dot: string; text: string }[] = [
  { key: 'Material Weakness', label: 'Material weakness', dot: 'bg-risk-500', text: 'text-risk-700' },
  { key: 'Significant Deficiency', label: 'Significant deficiency', dot: 'bg-high-500', text: 'text-high-700' },
  { key: 'Deficiency', label: 'Deficiency', dot: 'bg-mitigated-500', text: 'text-mitigated-700' },
];

const HANDOFF_META: Record<TaskType, { label: string; Icon: typeof Upload; tone: string }> = {
  pbc: { label: 'Document requests', Icon: Upload, tone: 'text-evidence-700' },
  query: { label: 'Open questions', Icon: MessageSquare, tone: 'text-brand-700' },
  remediation: { label: 'Remediations', Icon: FileWarning, tone: 'text-high-700' },
};

export default function Overview() {
  const { eng, role, meOwner, setView, setTab, signOffEngagement } = useIcfr();
  const { addToast } = useToast();
  const stats = engagementProgress(eng);
  const M = eng.materiality;
  const isOwner = role === 'risk-owner';
  // The owner's overview is their court only — engagement-wide dashboards,
  // materiality and the sign-off chain are audit-side surfaces.
  const myControls = isOwner ? eng.controls.filter(c => c.owner === meOwner) : [];
  const myDefs = isOwner ? eng.deficiencies.filter(d => eng.controls.find(c => c.id === d.controlId)?.owner === meOwner) : [];

  // sign-off readiness — every control concluded AND its paper countersigned;
  // the reviewer's per-paper gate feeds the engagement-level one.
  const concludedCount = stats.effective + stats.ineffective;
  const signoffReady = stats.total > 0 && stats.reviewed === stats.total;
  const so = eng.signoff;
  const isConcluded = !!(so.preparer && so.reviewer);

  const sev = useMemo(() => {
    const c: Record<Severity, number> = { 'Material Weakness': 0, 'Significant Deficiency': 0, Deficiency: 0 };
    let open = 0; let mwOpen = 0;
    eng.deficiencies.forEach(d => {
      // assessed severity — a validly-capped MW counts as an SD everywhere
      const s = assessSeverity(d, eng).final;
      c[s] += 1;
      if (d.status !== 'Closed') { open += 1; if (s === 'Material Weakness') mwOpen += 1; }
    });
    return { c, open, mwOpen, trivial: eng.deficiencies.filter(d => isClearlyTrivial(d.magnitude, eng.rules)).length };
  }, [eng, M]);

  // An open MW never blocks signing — it flips what the signature concludes.
  // Once signed, the stamped conclusion wins over the live derivation.
  const signsEffective = so.icfrConclusion ? so.icfrConclusion !== 'Not effective' : sev.mwOpen === 0;
  const signPreparer = () => {
    signOffEngagement('preparer');
    addToast({ type: signsEffective ? 'success' : 'warning', title: 'Signed off', message: signsEffective ? `Prepared by ${eng.preparer} — over to the reviewer.` : `Prepared by ${eng.preparer} as ICFR not effective — over to the reviewer.` });
  };
  const signReviewer = () => {
    signOffEngagement('reviewer');
    addToast({ type: signsEffective ? 'success' : 'warning', title: 'Countersigned', message: signsEffective ? 'The engagement is concluded — ICFR effective.' : 'The engagement is concluded — ICFR not effective (material weakness open).' });
  };

  const openTasks = eng.tasks.filter(t => t.status === 'open');
  const handoffs: Record<TaskType, number> = {
    pbc: openTasks.filter(t => t.type === 'pbc').length,
    query: openTasks.filter(t => t.type === 'query').length,
    remediation: openTasks.filter(t => t.type === 'remediation').length,
  };

  const processes = useMemo(() => {
    const map = new Map<string, Control[]>();
    eng.controls.forEach(c => { if (!map.has(c.process)) map.set(c.process, []); map.get(c.process)!.push(c); });
    return Array.from(map, ([name, rows]) => {
      const concl = rows.map(controlConclusion);
      return {
        name, total: rows.length,
        designDone: rows.filter(c => trackResult(c.design) !== 'Not tested').length,
        operatingDone: rows.filter(c => trackResult(c.operating) !== 'Not tested').length,
        effective: concl.filter(x => x === 'Effective').length,
        ineffective: concl.filter(x => x === 'Ineffective').length,
        inProgress: concl.filter(x => x === 'In progress').length,
      };
    }).sort((a, b) => b.total - a.total);
  }, [eng.controls]);

  const tiles = [
    { k: 'Design concluded', v: `${stats.designDone}/${stats.total}`, t: 'text-brand-700' },
    { k: 'Operating concluded', v: `${stats.operatingDone}/${stats.total}`, t: 'text-evidence-700' },
    { k: 'Effective', v: stats.effective, t: 'text-compliant-700' },
    { k: 'Ineffective', v: stats.ineffective, t: 'text-risk-700' },
    { k: 'Awaiting review', v: stats.awaitingReview, t: 'text-evidence-700' },
    { k: 'Waiting on owner', v: stats.waitingOnOwner, t: 'text-mitigated-700' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', serif" }}>Overview</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">
          {isOwner ? <>{myControls.length} controls in your name ({meOwner}) · {eng.period} period</> : <>{eng.controls.length} controls · {eng.framework} · {eng.period} period</>}
        </p>
      </div>

      {/* Risk owner's actionable inbox leads — first-line owners act before they browse status. */}
      {isOwner && (
        <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5">
          <RiskOwnerPortal />
        </section>
      )}

      {/* Reviewer's desk — only the reviewer hat sees it; the other two get nothing extra. */}
      {role === 'reviewer' && <ReviewerQueue />}

      {/* Owner mode stops here-ish: their controls and their exceptions, nothing engagement-wide. */}
      {isOwner && (() => {
        const eff = myControls.filter(c => controlConclusion(c) === 'Effective').length;
        const ineff = myControls.filter(c => controlConclusion(c) === 'Ineffective').length;
        const due = testsDueNow(myControls).length;
        const openDefs = myDefs.filter(d => d.status !== 'Closed');
        const inRem = openDefs.filter(d => d.status === 'Identified' || d.status === 'Remediation').length;
        const inRetest = openDefs.filter(d => d.status === 'Retest').length;
        return (
          <div className="grid sm:grid-cols-2 gap-4">
            <button onClick={() => setTab('controls')} className="text-left rounded-2xl border border-canvas-border bg-canvas-elevated p-4 hover:border-brand-300 transition-colors cursor-pointer">
              <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-brand-600" /> My controls</h2>
              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2.5 text-[12.5px] text-ink-600">
                <span><b className="text-[17px] font-bold tabular-nums text-ink-900">{myControls.length}</b> total</span>
                <span><b className="font-bold text-compliant-700">{eff}</b> effective</span>
                {ineff > 0 && <span><b className="font-bold text-risk-700">{ineff}</b> ineffective</span>}
                {due > 0 && <span><b className="font-bold text-mitigated-700">{due}</b> due now</span>}
              </div>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700">Open my controls <ArrowRight size={13} /></span>
            </button>
            <button onClick={() => setView('deficiencies')} className="text-left rounded-2xl border border-canvas-border bg-canvas-elevated p-4 hover:border-brand-300 transition-colors cursor-pointer">
              <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><AlertTriangle size={15} className="text-risk-600" /> My exceptions</h2>
              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2.5 text-[12.5px] text-ink-600">
                <span><b className="text-[17px] font-bold tabular-nums text-ink-900">{openDefs.length}</b> open</span>
                {inRem > 0 && <span><b className="font-bold text-high-700">{inRem}</b> on you to remediate</span>}
                {inRetest > 0 && <span><b className="font-bold text-evidence-700">{inRetest}</b> with the auditor</span>}
              </div>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700">Manage my exceptions <ArrowRight size={13} /></span>
            </button>
          </div>
        );
      })()}

      {/* progress rail */}
      {!isOwner && <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(s => (
          <div key={s.k} className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3">
            <div className={cn('text-[20px] font-bold tabular-nums', s.t)}>{s.v}</div>
            <div className="text-[11.5px] text-ink-500 font-medium mt-0.5">{s.k}</div>
          </div>
        ))}
      </div>}

      {/* exceptions · handoffs · materiality — engagement-wide, audit-side only */}
      {!isOwner && <div className="grid md:grid-cols-3 gap-4">
        {/* exceptions */}
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><AlertTriangle size={15} className="text-risk-600" /> Exceptions</h2>
            <span className="text-[11px] font-semibold text-ink-400">{sev.open} open · {eng.deficiencies.length} total</span>
          </div>
          <div className="space-y-2 flex-1">
            {SEV_META.map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', s.dot)} />
                <span className="text-[12.5px] text-ink-600">{s.label}</span>
                <span className={cn('ml-auto text-[15px] font-bold tabular-nums', s.text)}>{sev.c[s.key]}</span>
              </div>
            ))}
            {sev.trivial > 0 && <div className="text-[11px] text-ink-400 pt-1">{sev.trivial} clearly trivial (logged, not evaluated)</div>}
          </div>
          <button onClick={() => setView('deficiencies')} className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors">Manage exceptions <ArrowRight size={13} /></button>
        </div>

        {/* handoffs */}
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><Inbox size={15} className="text-evidence-600" /> Handoffs</h2>
            <span className="text-[11px] font-semibold text-ink-400">{openTasks.length} open</span>
          </div>
          <div className="space-y-2 flex-1">
            {(Object.keys(HANDOFF_META) as TaskType[]).map(t => {
              const m = HANDOFF_META[t];
              return (
                <div key={t} className="flex items-center gap-2">
                  <m.Icon size={13} className={m.tone} />
                  <span className="text-[12.5px] text-ink-600">{m.label}</span>
                  <span className="ml-auto text-[15px] font-bold tabular-nums text-ink-800">{handoffs[t]}</span>
                </div>
              );
            })}
          </div>
          <button onClick={() => setTab('controls')} className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors text-left">
            {stats.waitingOnOwner} control{stats.waitingOnOwner === 1 ? '' : 's'} waiting on the risk owner <ArrowRight size={13} />
          </button>
        </div>

        {/* materiality */}
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><Scale size={15} className="text-brand-600" /> Materiality</h2>
          </div>
          <div className="space-y-2 flex-1">
            {[
              { k: 'Overall', v: M },
              { k: 'Performance', v: eng.performanceMateriality },
              { k: 'Clearly trivial', v: eng.rules.clearlyTrivial },
            ].map(r => (
              <div key={r.k} className="flex items-center gap-2">
                <span className="text-[12.5px] text-ink-600">{r.k}</span>
                <span className="ml-auto text-[13.5px] font-bold tabular-nums text-ink-800">{fmt(r.v)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setView('scope')} className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors">Materiality &amp; scope <ArrowRight size={13} /></button>
        </div>
      </div>}

      {/* year-end countdown — what must close before the opinion date */}
      {!isOwner && !isConcluded && (() => {
        const end = periodEndDate(eng.periodEnd);
        const days = end ? Math.ceil((end.getTime() - Date.now()) / 86_400_000) : null;
        const past = days !== null && days < 0;
        const openOther = sev.open - sev.mwOpen;
        const unconcluded = stats.total - concludedCount;
        return (
          <section className={cn('rounded-2xl border p-4', past || sev.mwOpen ? 'border-high-200 bg-high-50/30' : 'border-canvas-border bg-canvas-elevated')}>
            <div className="flex items-center gap-2 flex-wrap">
              <Hourglass size={15} className={past || sev.mwOpen ? 'text-high-700' : 'text-brand-600'} />
              <h2 className="text-[13px] font-bold text-ink-800">
                {days === null ? `Year-end — ${eng.periodEnd}`
                  : past ? `Period ended ${eng.periodEnd} — the opinion clock is running`
                  : `${days} day${days === 1 ? '' : 's'} to year-end (${eng.periodEnd})`}
              </h2>
              <span className="text-[11.5px] text-ink-500">— what must close before the opinion date</span>
            </div>
            <div className="mt-2.5 flex items-center gap-x-5 gap-y-1.5 flex-wrap text-[12.5px]">
              {sev.mwOpen > 0 && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-risk-700">
                  <AlertTriangle size={13} /> {sev.mwOpen} material weakness{sev.mwOpen === 1 ? '' : 'es'} open — {past ? 'open past year-end ⇒' : 'open at year-end ⇒'} ICFR publicly ineffective
                </span>
              )}
              {openOther > 0 && <span className="inline-flex items-center gap-1.5 text-ink-700"><Circle size={11} className="text-high-600" /> {openOther} exception{openOther === 1 ? '' : 's'} still in the lifecycle (remediate → retest → reviewer close)</span>}
              {unconcluded > 0 && <span className="inline-flex items-center gap-1.5 text-ink-700"><Circle size={11} className="text-ink-400" /> {unconcluded} control{unconcluded === 1 ? '' : 's'} not concluded</span>}
              {stats.total - stats.reviewed - unconcluded > 0 && <span className="inline-flex items-center gap-1.5 text-ink-700"><Circle size={11} className="text-evidence-600" /> {stats.total - stats.reviewed - unconcluded} paper{stats.total - stats.reviewed - unconcluded === 1 ? '' : 's'} awaiting sign-off / countersign</span>}
              <span className="inline-flex items-center gap-1.5 text-ink-500"><PenLine size={12} /> then: {so.preparer ? 'reviewer countersign' : 'preparer sign-off + reviewer countersign'}</span>
              {sev.mwOpen === 0 && openOther === 0 && unconcluded === 0 && stats.reviewed === stats.total && <span className="inline-flex items-center gap-1.5 font-semibold text-compliant-700"><CheckCircle2 size={13} /> Nothing outstanding — ready to conclude</span>}
            </div>
          </section>
        );
      })()}

      {/* engagement sign-off — the closure moment; audit-side (preparer + reviewer) only */}
      {!isOwner && <section id="eng-signoff" className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><PenLine size={15} className="text-brand-600" /> Engagement sign-off</h2>
            <p className="text-[12px] text-ink-500 mt-1">
              {isConcluded
                ? 'Signed and countersigned — this engagement is concluded.'
                : signoffReady
                  ? 'Every control is concluded and countersigned — the engagement is ready for sign-off.'
                  : 'Unlocks when every control is concluded and its working paper countersigned by the reviewer. The preparer signs first; the reviewer countersigns to conclude the engagement.'}
            </p>
            {(signoffReady || !!so.preparer) && (
              <div className={cn('inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold',
                signsEffective ? 'text-compliant-700 bg-compliant-50/50 border-compliant-200' : 'text-risk-700 bg-risk-50/50 border-risk-200')}>
                {signsEffective ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                {isConcluded
                  ? (signsEffective ? 'Concluded — ICFR effective' : 'Concluded — ICFR not effective (material weakness open at period end)')
                  : signsEffective
                    ? 'ICFR effective — ready to sign'
                    : `Signing concludes ICFR not effective — ${sev.mwOpen} material weakness${sev.mwOpen === 1 ? '' : 'es'} open`}
              </div>
            )}
            <div className="flex items-center gap-4 mt-2.5 flex-wrap text-[12px]">
              <span className={cn('inline-flex items-center gap-1.5 font-semibold', signoffReady ? 'text-compliant-700' : 'text-ink-500')}>
                {signoffReady ? <CheckCircle2 size={13} /> : <Circle size={13} />} {concludedCount}/{stats.total} concluded · {stats.reviewed}/{stats.total} countersigned
              </span>
              <span className="inline-flex items-center gap-1.5 text-ink-500">
                <AlertTriangle size={12} className={sev.open ? 'text-high-600' : 'text-ink-300'} /> {sev.open} exception{sev.open === 1 ? '' : 's'} open
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-end shrink-0">
            {/* each signature belongs to one hat: auditor prepares, reviewer countersigns */}
            {so.preparer ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-compliant-700"><CheckCircle2 size={14} /> Prepared — {so.preparer.by} <span className="text-ink-400 font-medium">· {so.preparer.at}</span></span>
            ) : role === 'auditor' ? (
              <button onClick={signPreparer} disabled={!signoffReady} title={signoffReady ? `Sign off as ${eng.preparer}` : 'Every control must be concluded first'}
                className="h-9 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                <PenLine size={14} /> Sign off as preparer
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-400"><Circle size={13} /> Awaiting preparer — {eng.preparer}</span>
            )}
            {so.reviewer ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-compliant-700"><CheckCircle2 size={14} /> Reviewed — {so.reviewer.by} <span className="text-ink-400 font-medium">· {so.reviewer.at}</span></span>
            ) : so.preparer ? (
              role === 'reviewer' ? (
                <button onClick={signReviewer} title={`Countersign as ${eng.reviewer}`}
                  className="h-9 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-[12.5px] font-semibold hover:bg-brand-100 transition-colors cursor-pointer">
                  <PenLine size={14} /> Countersign as reviewer
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-400"><Circle size={13} /> Awaiting reviewer — {eng.reviewer}</span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-400"><Circle size={13} /> Then: reviewer countersign — {eng.reviewer}</span>
            )}
            {isConcluded && (
              <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide', signsEffective ? 'text-compliant-700' : 'text-ink-500')}><BadgeCheck size={13} /> Concluded</span>
            )}
          </div>
        </div>
      </section>}

      {/* by process — the engagement-wide rollup, audit-side only */}
      {!isOwner && <section>
        <h2 className="text-[12px] font-semibold text-ink-500 uppercase tracking-wide mb-2.5 inline-flex items-center gap-1.5"><ShieldCheck size={13} /> By process</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {processes.map(p => {
            const notStarted = p.total - p.effective - p.ineffective - p.inProgress;
            const seg = (n: number, color: string) => n > 0 ? <span style={{ width: `${(n / p.total) * 100}%`, background: color }} className="h-full" /> : null;
            return (
              <button key={p.name} onClick={() => setTab('controls')} className="text-left rounded-2xl border border-canvas-border bg-canvas-elevated p-4 hover:border-brand-300 hover:shadow-[0_4px_16px_-8px_rgba(15,8,30,0.25)] transition-all cursor-pointer">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: spineColor(p.name) }} />
                  <span className="text-[13.5px] font-semibold text-ink-900 truncate">{p.name}</span>
                  <span className="ml-auto text-[11.5px] font-semibold text-ink-400 tabular-nums">{p.total} controls</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-paper-100 mb-2.5">
                  {seg(p.effective, 'var(--color-compliant-500)')}
                  {seg(p.ineffective, 'var(--color-risk-500)')}
                  {seg(p.inProgress, 'var(--color-brand-400)')}
                  {seg(notStarted, 'var(--color-paper-300)')}
                </div>
                <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-ink-500">
                  <span><b className="text-compliant-700">{p.effective}</b> effective</span>
                  {p.ineffective > 0 && <span><b className="text-risk-700">{p.ineffective}</b> ineffective</span>}
                  <span className="ml-auto tabular-nums">D {p.designDone}/{p.total} · O {p.operatingDone}/{p.total}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>}
    </div>
  );
}
