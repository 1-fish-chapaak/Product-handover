import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, CalendarRange, Building2, Grid3x3, Inbox, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useIcfr } from './store';
import { assessSeverity, conclusionOf, engagementProgress } from './helpers';
import { engagementRagMeters } from './Overview';
import { RagStrip } from './parts';
import { processesForAudit, normaliseProcess } from './auditScope';
import { defWord } from './flow';
import type { AuditRecord, Severity, TaskType } from './types';
import { cn } from '../../lib/cn';

/**
 * Dashboard — the engagement's landing tab.
 *
 * Empty until the first audit exists (SoxIcfrApp shows the create-audit screen
 * instead); once one does, this is where the engagement reads out. The audits
 * are the way in, and beneath them the same picture the Overview tab paints —
 * how far testing has got, how healthy the register is, what is open — but
 * across the whole engagement rather than one audit.
 *
 * The numbers come from the SAME builders the Overview uses
 * (`engagementProgress`, `engagementRagMeters`), so the two surfaces can never
 * disagree about the engagement they are both describing.
 */
export default function DashboardView({ onNewAudit, onRollForward }: {
  onNewAudit: () => void;
  onRollForward: (audit: AuditRecord) => void;
}) {
  const { eng, openAudit } = useIcfr();

  // No matrix, no audit. However an audit is scoped it ends up covering a set of
  // controls, so on an engagement with none there is nothing for it to test and
  // the wizard leads nowhere. A RACM here IS a process's set of controls, so an
  // empty control library is an empty matrix. This surface is currently unwired
  // (see SoxIcfrApp), but the rule belongs with the button rather than with
  // whatever restores it.
  const noRacm = eng.controls.length === 0;

  /** How far one audit has got, counted over the controls it actually covers. */
  const progressOf = (a: AuditRecord) => {
    const procs = processesForAudit(a, eng.id);
    const inScope = procs
      ? eng.controls.filter(c => procs.includes(normaliseProcess(c.process)))
      : eng.controls;
    const effective = inScope.filter(c => conclusionOf(eng, c) === 'Effective').length;
    return { total: inScope.length, effective, open: inScope.length - effective };
  };

  const W = defWord(eng.id);
  const stats = engagementProgress(eng);
  const ragMeters = useMemo(() => engagementRagMeters(eng, eng.controls), [eng]);

  // Severity is assessed, not stored — a validly-capped material weakness counts
  // as a significant deficiency here exactly as it does on the Overview.
  const sev = useMemo(() => {
    let open = 0; let mwOpen = 0;
    eng.deficiencies.forEach(d => {
      if (d.status === 'Closed') return;
      open += 1;
      if (assessSeverity(d, eng).final === ('Material Weakness' as Severity)) mwOpen += 1;
    });
    return { open, mwOpen };
  }, [eng]);

  const openTasks = eng.tasks.filter(t => t.status === 'open');
  const handoffs: Record<TaskType, number> = {
    pbc: openTasks.filter(t => t.type === 'pbc').length,
    query: openTasks.filter(t => t.type === 'query').length,
    remediation: openTasks.filter(t => t.type === 'remediation').length,
  };

  // Read-outs, not links: the Control Library lives inside an audit, and there
  // is no non-arbitrary audit to send someone to from the engagement level.
  const tiles = [
    { k: 'TOD concluded', v: `${stats.designDone}/${stats.total}`, t: 'text-brand-700' },
    { k: 'TOE concluded', v: `${stats.operatingDone}/${stats.total}`, t: 'text-evidence-700' },
    { k: 'Effective', v: String(stats.effective), t: 'text-compliant-700' },
    { k: 'Ineffective', v: String(stats.ineffective), t: 'text-risk-700' },
    { k: 'Awaiting review', v: String(stats.awaitingReview), t: 'text-evidence-700' },
    { k: 'Waiting on owner', v: String(stats.waitingOnOwner), t: 'text-mitigated-700' },
  ];

  return (
    <div className="space-y-5">
      <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[13px] font-bold text-ink-800">Audits</h2>
        <div className="flex items-center gap-2.5">
          {noRacm && <span className="text-[11.5px] text-ink-400">Add a RACM first — an audit with no controls has nothing to test.</span>}
          <button
            onClick={onNewAudit}
            disabled={noRacm}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-white text-[12px] font-semibold text-ink-700 enabled:hover:border-brand-300 enabled:hover:text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Plus size={14} /> New audit
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {eng.audits.map(a => {
          const p = progressOf(a);
          return (
            /* A plain div, not a button: the card carries its own actions, and
               nesting buttons inside a button is invalid. */
            <div
              key={a.id}
              className="rounded-xl border border-canvas-border bg-white p-4 hover:border-brand-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13.5px] font-semibold text-ink-900">{a.period}</span>
                    <span className="text-[11px] text-ink-400 inline-flex items-center gap-1">
                      <CalendarRange size={11} /> {a.periodSpan}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-ink-500 inline-flex items-center gap-1.5 min-w-0">
                    {a.scopeKind === 'entity'
                      ? <Building2 size={12} className="text-ink-400 shrink-0" />
                      : <Grid3x3 size={12} className="text-ink-400 shrink-0" />}
                    <span className="truncate">{a.scopeNames.join(', ')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onRollForward(a)}
                    title={`Carry ${a.period} into the next cycle`}
                    className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-white text-[12px] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={13} /> Roll forward
                  </button>
                  <button
                    onClick={() => openAudit(a.id)}
                    className="h-8 px-3 inline-flex items-center gap-1 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"
                  >
                    Open <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 text-[11.5px]">
                <span className="tabular-nums text-ink-600">
                  <span className="font-semibold text-ink-900">{p.effective}/{p.total}</span> effective
                </span>
                {p.open > 0 && <span className="tabular-nums text-ink-500">{p.open} open</span>}
                <span className="tabular-nums text-ink-400">Materiality ₹{a.overall} Cr</span>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* progress rail — the same six counts the Overview leads with */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(s => (
          <div key={s.k} className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3">
            <div className={cn('text-[20px] font-bold tabular-nums', s.t)}>{s.v}</div>
            <div className="text-[11.5px] text-ink-500 font-medium mt-0.5">{s.k}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
        <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-3"><ShieldCheck size={15} className="text-brand-600" /> Engagement health</h2>
        <RagStrip meters={ragMeters} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
          <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-3"><AlertTriangle size={15} className="text-risk-600" /> {W.Many}</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-[20px] font-bold tabular-nums text-ink-900">{sev.open}</span>
            <span className="text-[12.5px] text-ink-500">open of {eng.deficiencies.length}</span>
          </div>
          {sev.mwOpen > 0 && (
            <p className="text-[11.5px] text-risk-700 font-semibold mt-1">
              {sev.mwOpen} material weakness{sev.mwOpen === 1 ? '' : 'es'} open
            </p>
          )}
          <p className="text-[11.5px] text-ink-400 mt-2 leading-relaxed">
            Remediation, retest and close happen inside the audit that raised them.
          </p>
        </div>

        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
          <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-3"><Inbox size={15} className="text-evidence-600" /> Handoffs</h2>
          <div className="space-y-1.5">
            {([['pbc', 'Document requests'], ['query', 'Queries'], ['remediation', 'Remediations']] as const).map(([k, label]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="text-[12.5px] text-ink-600">{label}</span>
                <span className="ml-auto text-[15px] font-bold tabular-nums text-ink-800">{handoffs[k]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
