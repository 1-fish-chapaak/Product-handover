import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  AlertTriangle, BadgeCheck, CheckCircle2, ChevronRight, Circle, Hourglass, Inbox, PenLine, Plus, Scale, ArrowRight, ShieldAlert, ShieldCheck, Upload, MessageSquare, FileWarning, X,
} from 'lucide-react';
import { useIcfr } from './store';
import { useAuditControls } from './useAuditControls';
import NewAuditWizard from './NewAuditWizard';
import { defWord } from './flow';
import { useToast } from '../shared/Toast';
import {
  assessSeverity, conclusionOf, controlCode, engagementCompleteness, engagementProgress, failedItgcs, formatINR, isClearlyTrivial, isItgcDependent, testsDueNow, trackResult,
} from './helpers';
import { cn } from '../../lib/cn';
import { ItgcCascadeBanner, RagStrip, type RagMeterDef } from './parts';
import { PROGRAMMES } from '../audit/sox-testing/soxTestingData';
import { isOwnerOf } from './auditScope';
import RiskOwnerPortal from './RiskOwnerPortal';
import ReviewerQueue from './ReviewerQueue';
import type { Control, IcfrEngagement, Severity, TaskType } from './types';

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
  const { eng, role, meOwner, openAuditId, setView, setTab, openControl, openRegister, signOffAudit } = useIcfr();
  const { addToast } = useToast();
  // Terminal sign-off is one-way — an ATTEST confirm gates it, never a bare click.
  const [confirmSign, setConfirmSign] = useState<null | 'preparer' | 'reviewer'>(null);
  // The New audit sheet — this tab and the SOX audit tab both open it.
  const [creating, setCreating] = useState(false);
  // Every count on this page is scoped to the OPEN AUDIT (user ask): as the
  // audit's Dashboard it must report what the audit covers, not the engagement.
  // With no audit open — the engagement's own Overview tab — useAuditControls
  // returns every control, so the same page serves both levels.
  const inAudit = !!openAuditId;
  // Inside an audit, Deficiency management is one of the audit's TABS, so going
  // there has to move the tab bar with it — swapping only the content left the
  // page reading "Dashboard" while showing something else. At engagement level
  // there is no such tab and it stays a drill-in off the Overview.
  const openDeficiencies = () => (inAudit ? setTab('deficiencies') : setView('deficiencies'));
  const scoped = useAuditControls(eng.controls);
  // Engagement-wide on purpose, not audit-scoped: an ITGC that failed in another
  // cycle's scope still invalidates the reliance this one leans on.
  const failedItgc = useMemo(() => failedItgcs(eng), [eng]);
  const scopedIds = useMemo(() => new Set(scoped.map(c => c.id)), [scoped]);
  const scopedDefs = useMemo(() => eng.deficiencies.filter(d => scopedIds.has(d.controlId)), [eng.deficiencies, scopedIds]);
  const stats = engagementProgress(eng, scoped);
  const M = eng.materiality;
  const isOwner = role === 'risk-owner';
  // Scoping-skipped gap (wizard "Skip for now"): flag what's missing until it
  // is added.
  const W = defWord(eng.id);
  const prog = PROGRAMMES.find(p => p.engagementId === eng.id);
  const racmMissing = scoped.length === 0;
  // The GL / trial-balance half of this nag is gone on every SOX engagement now
  // that Configuration is off the engagement tabs — on the reworked flow it
  // became Audit logs, on the classic shell it was parked with the four-tab set.
  // Nagging about a file with nowhere to add it is worse than staying quiet, so
  // the RACM is the only gap this flags; the files arrive with scoping.
  const scopingGap = !!prog?.scopingSkipped && racmMissing;
  // The owner's overview is their court only — engagement-wide dashboards,
  // materiality and the sign-off chain are audit-side surfaces.
  // Owning is either capacity, control or process — the same question the
  // register asks, so the counts here agree with the lists they open.
  const myControls = isOwner ? scoped.filter(c => isOwnerOf(c, meOwner)) : [];
  const myDefs = isOwner ? scopedDefs.filter(d => { const c = scoped.find(x => x.id === d.controlId); return !!c && isOwnerOf(c, meOwner); }) : [];

  // sign-off readiness — every control concluded AND its paper countersigned;
  // the reviewer's per-paper gate feeds the engagement-level one.
  const concludedCount = stats.effective + stats.ineffective;
  // Nothing to sign when no audit is open — the owner reaches this page at
  // engagement level, and sign-off belongs to an audit.
  const signoffReady = inAudit && stats.total > 0 && stats.reviewed === stats.total;
  // Sign-off belongs to the AUDIT, not the engagement: this page is the audit's
  // Dashboard, and the opinion covers the period the audit tested. Outside an
  // audit there is nothing to sign, which is why the engagement's own Overview is
  // a different page entirely (EngagementOverview.tsx).
  const so = eng.audits.find(a => a.id === openAuditId)?.signoff ?? {};
  const isConcluded = !!(so.preparer && so.reviewer);

  const sev = useMemo(() => {
    const c: Record<Severity, number> = { 'Material Weakness': 0, 'Significant Deficiency': 0, Deficiency: 0 };
    let open = 0; let mwOpen = 0;
    scopedDefs.forEach(d => {
      // assessed severity — a validly-capped MW counts as an SD everywhere
      const s = assessSeverity(d, eng).final;
      c[s] += 1;
      if (d.status !== 'Closed') { open += 1; if (s === 'Material Weakness') mwOpen += 1; }
    });
    return { c, open, mwOpen, trivial: scopedDefs.filter(d => isClearlyTrivial(d.magnitude, eng.rules)).length };
  }, [eng, M, scopedDefs]);

  // An open MW never blocks signing — it flips what the signature concludes.
  // Once signed, the stamped conclusion wins over the live derivation.
  const signsEffective = so.icfrConclusion ? so.icfrConclusion !== 'Not effective' : sev.mwOpen === 0;
  // An interim's signature concludes the ROUND, never the year — its window
  // stops short of the year end, so no ICFR verdict is stamped or claimed
  // (user ask). The opinion arrives with the roll-forward or year-end.
  const isInterim = eng.audits.find(a => a.id === openAuditId)?.round === 'interim';
  const signPreparer = () => {
    signOffAudit('preparer');
    addToast({ type: signsEffective ? 'success' : 'warning', title: 'Signed off', message: signsEffective || isInterim ? `Prepared by ${eng.preparer} — over to the reviewer.` : `Prepared by ${eng.preparer} as ICFR not effective — over to the reviewer.` });
  };
  const signReviewer = () => {
    signOffAudit('reviewer');
    addToast({
      type: signsEffective || isInterim ? 'success' : 'warning',
      title: 'Countersigned',
      message: isInterim
        ? 'Interim concluded — roll-forward can now extend it. The year\'s ICFR opinion comes at year end.'
        : signsEffective ? 'This audit is concluded — ICFR effective.' : 'This audit is concluded — ICFR not effective (material weakness open).',
    });
  };

  const openTasks = eng.tasks.filter(t => t.status === 'open');
  const handoffs: Record<TaskType, number> = {
    pbc: openTasks.filter(t => t.type === 'pbc').length,
    query: openTasks.filter(t => t.type === 'query').length,
    remediation: openTasks.filter(t => t.type === 'remediation').length,
  };

  const processes = useMemo(() => {
    const map = new Map<string, Control[]>();
    scoped.forEach(c => { if (!map.has(c.process)) map.set(c.process, []); map.get(c.process)!.push(c); });
    return Array.from(map, ([name, rows]) => {
      const concl = rows.map(c => conclusionOf(eng, c));
      return {
        name, total: rows.length,
        designDone: rows.filter(c => trackResult(c.design) !== 'Not tested').length,
        operatingDone: rows.filter(c => trackResult(c.operating) !== 'Not tested').length,
        effective: concl.filter(x => x === 'Effective').length,
        ineffective: concl.filter(x => x === 'Ineffective').length,
        inProgress: concl.filter(x => x === 'In progress').length,
      };
    }).sort((a, b) => b.total - a.total);
  }, [scoped]);

  // engagement-wide RAG trio — the control-level trio (completeness, evidence
  // validated, TOD coverage) lives on each control's own page
  const ragMeters = useMemo<RagMeterDef[]>(() => engagementRagMeters(eng, scoped), [eng, scoped]);

  // each tile lands on the register view computing the SAME predicate as its count
  const tiles = [
    { k: 'TOD concluded', v: `${stats.designDone}/${stats.total}`, t: 'text-brand-700', view: 'design-done' },
    { k: 'TOE concluded', v: `${stats.operatingDone}/${stats.total}`, t: 'text-evidence-700', view: 'operating-done' },
    { k: 'Effective', v: stats.effective, t: 'text-compliant-700', view: 'effective' },
    { k: 'Ineffective', v: stats.ineffective, t: 'text-risk-700', view: 'exceptions' },
    { k: 'Awaiting review', v: stats.awaitingReview, t: 'text-evidence-700', view: 'review' },
    { k: 'Waiting on owner', v: stats.waitingOnOwner, t: 'text-mitigated-700', view: 'owner' },
  ];

  return (
    <div className="space-y-5">
      {/* New audit — appended above the read-out rather than woven into it, so the
          Overview keeps the shape it had. The same sheet the SOX audit tab opens;
          both replace the parked Audit logs tab's button (user ask). Auditor and
          reviewer only — starting a cycle is not the owner's call. Hidden once
          inside an audit (this same component doubles as its Dashboard): a new
          audit is created from the engagement's SOX audit tab, one level up —
          not from inside a cycle that is already open. */}
      {!isOwner && !inAudit && (
        <div className="flex items-center justify-end gap-2.5">
          {/* No matrix, no audit. An audit covers a set of controls however it is
              scoped, so on an engagement with none the wizard has no path that
              ends in something testable — and a RACM here IS a process's set of
              controls, so an empty library is an empty matrix. The reason rides
              beside the dead button; the fix lives on the RACM tab. */}
          {racmMissing && <span className="text-[11.5px] text-ink-400">Add a RACM first — an audit with no controls has nothing to test.</span>}
          <button
            onClick={() => setCreating(true)}
            disabled={racmMissing}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Plus size={15} /> New audit
          </button>
        </div>
      )}
      <AnimatePresence>
        {creating && <NewAuditWizard onClose={() => setCreating(false)} />}
      </AnimatePresence>

      {/* Risk owner's actionable inbox leads — first-line owners act before they browse status. */}
      {isOwner && <RiskOwnerPortal />}

      {/* Owner mode stops here-ish: their controls and their exceptions, nothing engagement-wide. */}
      {isOwner && (() => {
        const eff = myControls.filter(c => conclusionOf(eng, c) === 'Effective').length;
        const ineff = myControls.filter(c => conclusionOf(eng, c) === 'Ineffective').length;
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
            <button onClick={() => openDeficiencies()} className="text-left rounded-2xl border border-canvas-border bg-canvas-elevated p-4 hover:border-brand-300 transition-colors cursor-pointer">
              <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><AlertTriangle size={15} className="text-risk-600" /> {W.mine}</h2>
              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2.5 text-[12.5px] text-ink-600">
                <span><b className="text-[17px] font-bold tabular-nums text-ink-900">{openDefs.length}</b> open</span>
                {inRem > 0 && <span><b className="font-bold text-high-700">{inRem}</b> on you to remediate</span>}
                {inRetest > 0 && <span><b className="font-bold text-evidence-700">{inRetest}</b> with the auditor</span>}
              </div>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700">Manage {W.mine.toLowerCase()} <ArrowRight size={13} /></span>
            </button>
          </div>
        );
      })()}

      {/* scoping was skipped in the wizard and no RACM has arrived since — say
          what's missing and where it lands */}
      {!isOwner && scopingGap && (
        <div className="rounded-2xl border border-high-200 bg-high-50 p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-high-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-bold text-ink-900">The RACM is missing</h2>
            <p className="text-[12.5px] text-ink-600 mt-1 leading-relaxed">
              Add or generate the RACM from the{' '}
              <button onClick={() => setTab('racm')} className="font-semibold text-brand-700 hover:underline cursor-pointer">RACM tab</button>.
            </p>
          </div>
        </div>
      )}

      {/* PARKED (user ask, 12 Aug) — the ITGC cascade banner is off the Dashboard
          too. This was the last of its three homes (the two Control Library
          screens went first), so the banner no longer renders anywhere.

          Only this block is commented out. ItgcCascadeBanner itself, the
          `failedItgc` derivation here, `isItgcDependent`, and the register's
          'itgc' view all stay wired and compiling, so restoring is uncommenting
          this and the two blocks in ControlRegister / ControlLibrary.

          Known consequence while it is off: nothing announces the cascade. A
          failed ITGC still does the work — the shortcut is withdrawn, samples
          resize, and the control page's own notice still says so on each
          affected control — but the count of what it hit is no longer stated
          anywhere, and the one-click route to those controls is gone. The 'itgc'
          view remains in the register's saved-view list whenever an ITGC has
          actually failed.

          Original note — Above the health meters, because it is the one thing on
          this page that happened TO the audit rather than in it: an ITGC
          concluded ineffective takes the one-instance shortcut off every
          automated and IT-dependent control at once. Whoever concluded it was on
          a different page and had no way to see the size of what they had just
          done.

      {!isOwner && failedItgc.length > 0 && (
        <ItgcCascadeBanner
          failed={failedItgc.map(f => ({ id: f.id, code: controlCode(f), description: f.description }))}
          affected={scoped.filter(isItgcDependent).length}
          onOpenControl={openControl}
          onShowAffected={() => openRegister({ view: 'itgc' })}
        />
      )}
      */}

      {/* progress rail */}
      {!isOwner && <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(s => (
          <button key={s.k} onClick={() => openRegister({ view: s.view })} title={`Open the Control Library — ${s.k}`} className="text-left rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 hover:border-brand-300 transition-colors cursor-pointer">
            <div className={cn('text-[20px] font-bold tabular-nums', s.t)}>{s.v}</div>
            <div className="text-[11.5px] text-ink-500 font-medium mt-0.5">{s.k}</div>
          </button>
        ))}
      </div>}

      {/* Audit health — RAG roll-ups across the controls this AUDIT covers, and
          only shown inside one (user ask). It was called Engagement health and
          sat on the engagement's Overview, where it described a register nobody
          tests as a whole; a cycle is what these meters are actually about. */}
      {!isOwner && inAudit && (
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
          <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-3"><ShieldCheck size={15} className="text-brand-600" /> Audit health</h2>
          <RagStrip meters={ragMeters} />
        </div>
      )}

      {/* exceptions · handoffs · materiality — engagement-wide, audit-side only */}
      {!isOwner && <div className="grid md:grid-cols-3 gap-4">
        {/* exceptions */}
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><AlertTriangle size={15} className="text-risk-600" /> {W.Many}</h2>
            <span className="text-[11px] font-semibold text-ink-400">{sev.open} open · {scopedDefs.length} total</span>
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
          <button onClick={() => openDeficiencies()} className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors">Manage {W.many} <ArrowRight size={13} /></button>
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
          {/* Configuration's materiality section, not a page of its own (user
              ask). The scroll waits a beat for the tab to mount. */}
          <button
            onClick={() => {
              setTab('config');
              setTimeout(() => document.getElementById('materiality-ground-rules')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140);
            }}
            className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors"
          >
            Materiality &amp; scope <ArrowRight size={13} />
          </button>
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
          { key: 'mw', show: sev.mwOpen > 0, onClick: () => openDeficiencies(), icon: <AlertTriangle size={13} className="text-risk-600" />,
            label: <><b className="font-semibold text-risk-700">{sev.mwOpen}</b> material weakness{sev.mwOpen === 1 ? '' : 'es'} open — {past ? 'ICFR ineffective, open past year-end' : 'ICFR ineffective if still open at year-end'}</> },
          { key: 'other', show: openOther > 0, onClick: () => openDeficiencies(), icon: <Circle size={11} className="text-high-600" />,
            label: <><b className="font-semibold text-ink-900">{openOther}</b> {openOther === 1 ? W.one : W.many} still working through remediation → retest → close</> },
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
                <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><PenLine size={15} className="text-brand-600" /> Audit sign-off</h2>
                <p className="text-[12px] text-ink-500 mt-1">
                  {isConcluded
                    ? 'Signed and countersigned — this audit is concluded.'
                    : signoffReady
                      ? 'Every control is concluded and countersigned — the audit is ready for sign-off.'
                      : 'Unlocks once everything above is closed. The preparer signs first; the reviewer countersigns to conclude.'}
                </p>
                {(signoffReady || !!so.preparer) && (
                  <div className={cn('inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold',
                    signsEffective ? 'text-compliant-700 bg-compliant-50/50 border-compliant-200' : 'text-risk-700 bg-risk-50/50 border-risk-200')}>
                    {signsEffective ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                    {/* Interim wording never claims the year's opinion — the
                        signature concludes the round; the ICFR verdict is
                        stamped by the roll-forward or year-end (user ask). The
                        colour still reflects open MWs: they carry forward. */}
                    {isInterim
                      ? (isConcluded
                        ? 'Interim concluded — carried to the year-end opinion'
                        : `Sign-off concludes the interim round${sev.mwOpen ? ` — ${sev.mwOpen} material weakness${sev.mwOpen === 1 ? '' : 'es'} carr${sev.mwOpen === 1 ? 'ies' : 'y'} forward` : ''} — the year's ICFR opinion comes at year end`)
                      : isConcluded
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
                  <span className="ml-auto tabular-nums">TOD {p.designDone}/{p.total} · TOE {p.operatingDone}/{p.total}</span>
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
                      ? 'This records your preparer signature and hands the audit to the reviewer. You can’t un-sign.'
                      : <>This concludes ICFR <b className="font-semibold text-risk-700">not effective</b> — {sev.mwOpen} material weakness{sev.mwOpen === 1 ? '' : 'es'} open at period end. You can’t un-sign.</>)
                  : <>This countersigns and concludes this audit as ICFR {signsEffective ? 'effective' : 'not effective'}. This can’t be undone.</>}
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

/**
 * The engagement-wide RAG trio, read in order as one sentence: is the matrix
 * ready to test against → are the controls working → how far through are we.
 *
 * Exported because the Dashboard (engagement level) and the Overview tab (inside
 * an audit) both read it. One computation, so the two can never disagree about
 * the same engagement.
 *
 * Sample testing reads the register's TOE coverage — the same sample × attribute
 * counting rule the dossier applies to one control as Evidence validated. Kept
 * at both levels deliberately (user ask): the register answer says how much
 * testing ground is covered overall, the control answer says where the shortfall
 * actually is.
 */
export function engagementRagMeters(eng: IcfrEngagement, controls: Control[]): RagMeterDef[] {
    const total = controls.length;
    const approved = controls.filter(c => c.racmReview?.status === 'Approved').length;
    const remarks = controls.filter(c => c.racmReview?.status === 'Remark').length;
    const concl = controls.map(c => conclusionOf(eng, c));
    const effective = concl.filter(x => x === 'Effective').length;
    const ineffective = concl.filter(x => x === 'Ineffective').length;
    const done = engagementCompleteness(eng, controls);
    // sample testing counts every sample × attribute verdict across the register;
    // controls without a drawn sample count at attribute level
    let checksDone = 0; let checksTotal = 0;
    controls.forEach(c => {
      const steps = c.operating.steps;
      const samples = c.operating.sampling?.samples ?? [];
      checksTotal += samples.length ? samples.length * steps.length : steps.length;
      checksDone += samples.length
        ? steps.reduce((n, s) => n + samples.filter(smp => { const r = s.sampleResults?.[smp.id]; return r && r !== 'Not tested'; }).length, 0)
        : steps.filter(s => s.result !== 'Not tested').length;
    });
    return [
      {
        // One RACM row IS one control, so the denominator is the scope itself. A
        // remark is a blocker with a named condition, never a half-approval —
        // it rides beside the score and is not netted off it.
        label: 'RACM completeness', pct: total ? Math.round((approved / total) * 100) : 0, empty: total === 0,
        detail: `${approved}/${total} rows approved${remarks ? ` · ${remarks} remark${remarks === 1 ? '' : 's'} open` : ''}`,
        formula: 'rows approved ÷ in-scope controls × 100',
      },
      {
        // Effective needs BOTH tracks effective; either one ineffective sinks the
        // control. A short-form automated control concludes on design alone. Not
        // an average — one ineffective control turns this red at any percentage.
        label: 'Control effectiveness', pct: total ? Math.round((effective / total) * 100) : 0, empty: total === 0,
        detail: `${effective}/${total} controls effective${ineffective ? ` · ${ineffective} ineffective` : ''}`, forceRed: ineffective > 0,
        formula: 'controls concluded effective ÷ in-scope controls × 100',
      },
      {
        // A check is one sample × attribute CELL, not an attribute: 25 items
        // against 3 attributes is 75 checks on that control alone. Controls with
        // no sample yet count at attribute level, so the register total never
        // waits on the first draw, and each control weighs by its own check
        // count. Where the shortfall SITS is the control page's answer.
        label: 'Sample testing', pct: checksTotal ? Math.round((checksDone / checksTotal) * 100) : 0, empty: checksTotal === 0,
        detail: `${checksDone}/${checksTotal} checks done`,
        formula: 'operating checks run ÷ operating checks total, summed across the register × 100',
      },
      {
        // Each control is worth 1.0 — RACM 0.10 · TOD 0.25 · TOE 0.30 ·
        // countersign 0.25 · exceptions closed 0.10 — and credits on CONCLUSION,
        // whichever way it went. Completeness is not effectiveness: a 100%
        // engagement can still conclude ICFR not effective. See
        // engagementCompleteness in helpers.ts for the rest.
        label: 'Engagement completeness', pct: done.pct, empty: total === 0,
        // The blocker count travels with the percentage on purpose: a number
        // alone cannot tell steady progress from an engagement that is stuck.
        detail: `${done.fullyDone}/${done.total} controls finished${done.blocked ? ` · ${done.blocked} blocked` : ''}${done.keyNotStarted ? ` · ${done.keyNotStarted} key not started` : ''}`,
        formula: 'Σ milestone credits ÷ in-scope controls × 100',
      },
    ];
}
