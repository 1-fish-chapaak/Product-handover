import { useMemo, useState } from 'react';
import {
  AlertTriangle, BadgeCheck, CheckCircle2, ChevronRight, Circle, Hourglass, Inbox, PenLine, Scale, ArrowRight, ShieldAlert, ShieldCheck, Upload, MessageSquare, FileWarning, X,
} from 'lucide-react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import {
  assessSeverity, controlConclusion, engagementProgress, formatINR, isClearlyTrivial, testsDueNow, trackResult,
} from './helpers';
import { cn } from '../../lib/cn';
import { RagStrip, type RagMeterDef } from './parts';
import { PROGRAMMES } from '../audit/sox-testing/soxTestingData';
import RiskOwnerPortal from './RiskOwnerPortal';
import ReviewerQueue from './ReviewerQueue';
import type { Control, Severity, TaskType } from './types';

const fmt = (n: number) => formatINR(n);

// process spine colours — on-theme purple/blue families, mirrors the Control Library shelves
const BINDINGS = ['#6A12CD', '#0369A1', '#550FA5', '#075985', '#8838DE', '#0284C7', '#3B0B72', '#1E3A5F'];
function spineColor(p: string): string { let h = 0; for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return BINDINGS[h % BINDINGS.length]!; }

// Period-end labels arrive in a few shapes across data sources — ISO '2025-12-31',
// '31 Mar 2026', or 'Mar 2026'. Parse + format them in-file (dependency-free) so the
// countdown reads a real date and the header shows a human '31 Dec 2025'.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthIndex = (name: string): number => MONTHS.findIndex(m => m.toLowerCase() === name.trim().slice(0, 3).toLowerCase());
function parsePeriodEnd(raw: string): Date | null {
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(s);
  if (dmy) { const m = monthIndex(dmy[2] ?? ''); if (m >= 0) return new Date(Number(dmy[3]), m, Number(dmy[1])); }
  const my = /^([A-Za-z]{3,})\s+(\d{4})$/.exec(s);   // month + year → last day of that month
  if (my) { const m = monthIndex(my[1] ?? ''); if (m >= 0) return new Date(Number(my[2]), m + 1, 0); }
  return null;
}
/** '31 Dec 2025' — falls back to the raw label if it can't be parsed. */
function fmtPeriodEnd(raw: string): string {
  const d = parsePeriodEnd(raw);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]!} ${d.getFullYear()}` : raw;
}

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
  const { eng, role, meOwner, setView, setTab, openRegister, signOffEngagement } = useIcfr();
  const { addToast } = useToast();
  // Terminal sign-off is one-way — an ATTEST confirm gates it, never a bare click.
  const [confirmSign, setConfirmSign] = useState<null | 'preparer' | 'reviewer'>(null);
  const stats = engagementProgress(eng);
  const M = eng.materiality;
  const isOwner = role === 'risk-owner';
  // Scoping-skipped gap (wizard "Skip for now"): flag the missing RACM and
  // GL / trial balances until they're added — RACM from the RACM tab, files
  // from the Configuration tab.
  const prog = PROGRAMMES.find(p => p.engagementId === eng.id);
  const racmMissing = eng.controls.length === 0;
  const tbMissing = !prog?.entities.some(e => e.tbFile);
  const scopingGap = !!prog?.scopingSkipped && (racmMissing || tbMissing);
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

  // engagement-wide RAG trio — the control-level trio (completeness, evidence
  // validated, TOD coverage) lives on each control's own page
  const ragMeters = useMemo<RagMeterDef[]>(() => {
    const total = eng.controls.length;
    const approved = eng.controls.filter(c => c.racmReview?.status === 'Approved').length;
    const remarks = eng.controls.filter(c => c.racmReview?.status === 'Remark').length;
    const concl = eng.controls.map(controlConclusion);
    const effective = concl.filter(x => x === 'Effective').length;
    const ineffective = concl.filter(x => x === 'Ineffective').length;
    // sample testing counts every sample × attribute verdict across the register;
    // controls without a drawn sample count at attribute level
    let checksDone = 0; let checksTotal = 0;
    eng.controls.forEach(c => {
      const steps = c.operating.steps;
      const samples = c.operating.sampling?.samples ?? [];
      checksTotal += samples.length ? samples.length * steps.length : steps.length;
      checksDone += samples.length
        ? steps.reduce((n, s) => n + samples.filter(smp => { const r = s.sampleResults?.[smp.id]; return r && r !== 'Not tested'; }).length, 0)
        : steps.filter(s => s.result !== 'Not tested').length;
    });
    return [
      {
        label: 'RACM', pct: total ? Math.round((approved / total) * 100) : 0, detail: `${approved}/${total} rows approved${remarks ? ` · ${remarks} remark${remarks === 1 ? '' : 's'} open` : ''}`,
        explainer: 'Pre-testing review across the register — every row needs approval before testing leans on it, and open remarks pull this down.',
      },
      {
        label: 'Control effectiveness', pct: total ? Math.round((effective / total) * 100) : 0, detail: `${effective}/${total} controls effective${ineffective ? ` · ${ineffective} ineffective` : ''}`, forceRed: ineffective > 0,
        explainer: 'Controls concluded effective across the engagement — a single ineffective conclusion turns this red until it is remediated and retested.',
      },
      {
        label: 'Sample testing', pct: checksTotal ? Math.round((checksDone / checksTotal) * 100) : 0, detail: `${checksDone}/${checksTotal} checks done`,
        explainer: 'Sample-by-attribute checks completed across the operating tests — how much of the drawn testing ground is actually covered.',
      },
    ];
  }, [eng.controls]);

  // each tile lands on the register view computing the SAME predicate as its count
  const tiles = [
    { k: 'Design concluded', v: `${stats.designDone}/${stats.total}`, t: 'text-brand-700', view: 'design-done' },
    { k: 'Operating concluded', v: `${stats.operatingDone}/${stats.total}`, t: 'text-evidence-700', view: 'operating-done' },
    { k: 'Effective', v: stats.effective, t: 'text-compliant-700', view: 'effective' },
    { k: 'Ineffective', v: stats.ineffective, t: 'text-risk-700', view: 'exceptions' },
    { k: 'Awaiting review', v: stats.awaitingReview, t: 'text-evidence-700', view: 'review' },
    { k: 'Waiting on owner', v: stats.waitingOnOwner, t: 'text-mitigated-700', view: 'owner' },
  ];

  return (
    <div className="space-y-5">
      {/* Risk owner's actionable inbox leads — first-line owners act before they browse status. */}
      {isOwner && <RiskOwnerPortal />}

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

      {/* scoping was skipped in the wizard — say exactly what's missing and where it lands */}
      {!isOwner && scopingGap && (
        <div className="rounded-2xl border border-high-200 bg-high-50 p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-high-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-bold text-ink-900">
              {racmMissing && tbMissing ? 'The RACM and the GL / trial balances are' : racmMissing ? 'The RACM is' : 'The GL / trial balances are'} missing
            </h2>
            <p className="text-[12.5px] text-ink-600 mt-1 leading-relaxed">
              {racmMissing && (<>
                Add or generate the RACM from the{' '}
                <button onClick={() => setTab('racm')} className="font-semibold text-brand-700 hover:underline cursor-pointer">RACM tab</button>.{' '}
              </>)}
              {tbMissing && (<>
                Upload the GL and trial balances from the{' '}
                <button onClick={() => setTab('config')} className="font-semibold text-brand-700 hover:underline cursor-pointer">Configuration tab</button>.
              </>)}
            </p>
          </div>
        </div>
      )}

      {/* progress rail */}
      {!isOwner && <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(s => (
          <button key={s.k} onClick={() => openRegister({ view: s.view })} title={`Open the Control Library — ${s.k}`} className="text-left rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 hover:border-brand-300 transition-colors cursor-pointer">
            <div className={cn('text-[20px] font-bold tabular-nums', s.t)}>{s.v}</div>
            <div className="text-[11.5px] text-ink-500 font-medium mt-0.5">{s.k}</div>
          </button>
        ))}
      </div>}

      {/* engagement health — RAG roll-ups across the register */}
      {!isOwner && (
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
          <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-3"><ShieldCheck size={15} className="text-brand-600" /> Engagement health</h2>
          <RagStrip meters={ragMeters} />
        </div>
      )}

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
          <button onClick={() => setView('handoffs')} className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors text-left">
            Manage handoffs <ArrowRight size={13} />
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

      {/* Reviewer's desk — after the engagement-wide summaries; only the reviewer
          hat sees it, and it collapses to save the scroll. */}
      {role === 'reviewer' && <ReviewerQueue />}

      {/* year-end countdown + engagement sign-off — ONE box: the work that must
          close, then the closure moment as its final step. Audit-side only. */}
      {!isOwner && (() => {
        const end = parsePeriodEnd(eng.periodEnd);
        const endLabel = fmtPeriodEnd(eng.periodEnd);
        const days = end ? Math.ceil((end.getTime() - Date.now()) / 86_400_000) : null;
        const past = days !== null && days < 0;
        const openOther = sev.open - sev.mwOpen;
        const unconcluded = stats.total - concludedCount;
        const papersAwaiting = stats.total - stats.reviewed - unconcluded;
        // the 8-vs-9 truth: most await the reviewer's countersign, the rest the
        // preparer's own signature — the row says the split instead of hiding it
        const papersWithReviewer = stats.awaitingReview;
        const papersWithPreparer = papersAwaiting - stats.awaitingReview;
        const allClear = sev.mwOpen === 0 && openOther === 0 && unconcluded === 0 && stats.reviewed === stats.total;
        // One row per outstanding item — each keeps the same filtered destination it linked to before.
        // The exceptions count lives HERE and only here — the sign-off block below never restates it.
        const rows = [
          { key: 'mw', show: sev.mwOpen > 0, onClick: () => setView('deficiencies'), icon: <AlertTriangle size={13} className="text-risk-600" />,
            label: <><b className="font-semibold text-risk-700">{sev.mwOpen}</b> material weakness{sev.mwOpen === 1 ? '' : 'es'} open — {past ? 'ICFR ineffective, open past year-end' : 'ICFR ineffective if still open at year-end'}</> },
          { key: 'other', show: openOther > 0, onClick: () => setView('deficiencies'), icon: <Circle size={11} className="text-high-600" />,
            label: <><b className="font-semibold text-ink-900">{openOther}</b> exception{openOther === 1 ? '' : 's'} still working through remediation → retest → close</> },
          { key: 'unconcluded', show: unconcluded > 0, onClick: () => openRegister({ view: 'open' }), icon: <Circle size={11} className="text-ink-400" />,
            label: <><b className="font-semibold text-ink-900">{unconcluded}</b> control{unconcluded === 1 ? '' : 's'} not concluded</> },
          { key: 'papers-rev', show: papersWithReviewer > 0, onClick: () => openRegister({ view: 'review' }), icon: <Circle size={11} className="text-evidence-600" />,
            label: <><b className="font-semibold text-ink-900">{papersWithReviewer}</b> paper{papersWithReviewer === 1 ? '' : 's'} awaiting countersign — with the reviewer</> },
          { key: 'papers-prep', show: papersWithPreparer > 0, onClick: () => openRegister({ view: 'papers' }), icon: <Circle size={11} className="text-evidence-600" />,
            label: <><b className="font-semibold text-ink-900">{papersWithPreparer}</b> paper{papersWithPreparer === 1 ? '' : 's'} awaiting the preparer's signature</> },
        ].filter(r => r.show);
        const rowCls = 'w-full flex items-center gap-2.5 py-1.5 px-2 -mx-1 rounded-lg text-left hover:bg-paper-100 transition-colors cursor-pointer group';
        return (
          <section id="eng-signoff" className={cn('rounded-2xl border p-4', !isConcluded && (past || sev.mwOpen > 0) ? 'border-high-200 bg-high-50/30' : 'border-canvas-border bg-canvas-elevated')}>
            {!isConcluded && <>
              <div className="flex items-center gap-2 flex-wrap">
                <Hourglass size={15} className={past || sev.mwOpen ? 'text-high-700' : 'text-brand-600'} />
                <h2 className="text-[13px] font-bold text-ink-800">
                  {days === null ? `Year-end — ${endLabel}`
                    : past ? `Period ended ${endLabel} — the opinion clock is running`
                    : `${days} day${days === 1 ? '' : 's'} to year-end (${endLabel})`}
                </h2>
                <span className="text-[11.5px] text-ink-500">— what must close before the opinion date</span>
              </div>
              <div className="mt-3 space-y-0.5">
                {rows.map(r => (
                  <button key={r.key} onClick={r.onClick} className={rowCls}>
                    <span className="w-4 flex justify-center shrink-0">{r.icon}</span>
                    <span className="text-[12.5px] text-ink-700">{r.label}</span>
                    <ChevronRight size={14} className="ml-auto shrink-0 text-ink-300 group-hover:text-ink-500 transition-colors" />
                  </button>
                ))}
                {allClear && (
                  <div className="flex items-center gap-2.5 py-1.5 px-2 -mx-1">
                    <span className="w-4 flex justify-center shrink-0"><CheckCircle2 size={14} className="text-compliant-600" /></span>
                    <span className="text-[12.5px] font-semibold text-compliant-700">Nothing outstanding — ready to conclude</span>
                  </div>
                )}
              </div>
            </>}

            {/* the closure moment — the checklist's final step, not a separate card */}
            <div className={cn('flex items-start justify-between gap-4 flex-wrap', !isConcluded && 'mt-3 pt-3.5 border-t border-canvas-border/70')}>
              <div className="min-w-0 flex-1">
                <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><PenLine size={15} className="text-brand-600" /> Engagement sign-off</h2>
                <p className="text-[12px] text-ink-500 mt-1">
                  {isConcluded
                    ? 'Signed and countersigned — this engagement is concluded.'
                    : signoffReady
                      ? 'Every control is concluded and countersigned — the engagement is ready for sign-off.'
                      : 'Unlocks once everything above is closed. The preparer signs first; the reviewer countersigns to conclude.'}
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
                </div>
              </div>
              <div className="flex flex-col gap-1.5 items-end shrink-0">
                {/* each signature belongs to one hat: auditor prepares, reviewer countersigns */}
                {so.preparer ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-compliant-700"><CheckCircle2 size={14} /> Prepared — {so.preparer.by} <span className="text-ink-400 font-medium">· {so.preparer.at}</span></span>
                ) : role === 'auditor' ? (
                  <button onClick={() => setConfirmSign('preparer')} disabled={!signoffReady} title={signoffReady ? `Sign off as ${eng.preparer}` : 'Every control must be concluded first'}
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
                    <button onClick={() => setConfirmSign('reviewer')} title={`Countersign as ${eng.reviewer}`}
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
          </section>
        );
      })()}

      {/* by process — the engagement-wide rollup, audit-side only */}
      {!isOwner && <section>
        <h2 className="text-[12px] font-semibold text-ink-500 uppercase tracking-wide mb-2.5 inline-flex items-center gap-1.5"><ShieldCheck size={13} /> By process</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {processes.map(p => {
            const notStarted = p.total - p.effective - p.ineffective - p.inProgress;
            const seg = (n: number, color: string) => n > 0 ? <span style={{ width: `${(n / p.total) * 100}%`, background: color }} className="h-full" /> : null;
            return (
              <button key={p.name} onClick={() => openRegister({ process: p.name })} className="text-left rounded-2xl border border-canvas-border bg-canvas-elevated p-4 hover:border-brand-300 hover:shadow-[0_4px_16px_-8px_rgba(15,8,30,0.25)] transition-all cursor-pointer">
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
                  {p.inProgress > 0 && <span><b className="text-brand-700">{p.inProgress}</b> in progress</span>}
                  {notStarted > 0 && <span><b className="text-ink-600">{notStarted}</b> not tested</span>}
                  <span className="ml-auto tabular-nums">Design {p.designDone}/{p.total} · Operating {p.operatingDone}/{p.total}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>}

      {/* attest confirm — terminal sign-off is one-way, so it never fires on a bare click */}
      {confirmSign && (
        <div className="modal-backdrop" onClick={() => setConfirmSign(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-ink-900">{confirmSign === 'preparer' ? 'Sign off as preparer?' : 'Countersign as reviewer?'}</h2>
                <button onClick={() => setConfirmSign(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[12.5px] text-ink-600 leading-relaxed">
                {confirmSign === 'preparer'
                  ? (signsEffective
                      ? 'This records your preparer signature and hands the engagement to the reviewer. You can’t un-sign.'
                      : <>This concludes ICFR <b className="font-semibold text-risk-700">not effective</b> — {sev.mwOpen} material weakness{sev.mwOpen === 1 ? '' : 'es'} open at period end. You can’t un-sign.</>)
                  : <>This countersigns and concludes the engagement as ICFR {signsEffective ? 'effective' : 'not effective'}. This can’t be undone.</>}
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setConfirmSign(null)} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                <button onClick={() => { if (confirmSign === 'preparer') signPreparer(); else signReviewer(); setConfirmSign(null); }} className="h-9 px-3.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">{confirmSign === 'preparer' ? 'Confirm — sign off' : 'Confirm — countersign'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
