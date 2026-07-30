import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, CalendarRange, Check, FileSpreadsheet, Grid3x3, Landmark, RefreshCw, Table2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { FlowModal } from '../audit/sox-testing/SoxTestingTab';
import { StepRail } from '../audit/sox-testing/ScopingWizard';
import { FormSelect } from '../shared/FilterSelect';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import { entitiesFor, processesFor, programmeFor } from './auditScope';
import { roundWindow } from './auditPortfolio';
import { cycleYears } from '../audit/sox-testing/soxTestingData';
import { AUDIT_ROUNDS, type AuditRecord, type AuditRound } from './types';
import { cn } from '../../lib/cn';

/**
 * Roll forward — carry an audit into the next cycle.
 *
 * A confirmation, not a creation: everything is prefilled from the audit being
 * rolled, and the job is to check it still holds. Three steps, one per thing to
 * confirm, so each screen stays short instead of stacking into one long scroll.
 *
 * What it commits is an ordinary new audit, so `createAudit` does what it always
 * does: the covered controls go back to Not tested and their deficiencies clear.
 * A new cycle re-tests; it does not inherit last cycle's conclusions.
 */

const STEPS = ['Audit period', 'Company & entities', 'Documents'] as const;
const LAST = STEPS.length - 1;

/** The four calendar quarters offered when Year type is "Quarter" — one year's
 *  worth, not a year picker of its own (this prototype's scope). */
const QUARTERS = [
  { id: 1, span: 'Jan – Mar', from: '01-01', to: '03-31' },
  { id: 2, span: 'Apr – Jun', from: '04-01', to: '06-30' },
  { id: 3, span: 'Jul – Sep', from: '07-01', to: '09-30' },
  { id: 4, span: 'Oct – Dec', from: '10-01', to: '12-31' },
] as const;

const labelCls = 'block text-[11px] font-semibold text-ink-500 mb-1.5';
const inputCls = 'w-full px-3 py-2 text-[13px] border border-canvas-border rounded-lg bg-white text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';

const fyLabel = (y: number) => `FY ${y - 1}-${String(y).slice(-2)}`;
const cyLabel = (y: number) => `CY ${y}`;
const spanOf = (b: 'fy' | 'cy', y: number) => (b === 'fy' ? `Apr ${y - 1} – Mar ${y}` : `Jan – Dec ${y}`);
const yearOf = (a: AuditRecord): number => {
  const m = /(\d{4})/.exec(a.period);
  const first = m ? Number(m[1]) : new Date().getFullYear();
  return a.yearBasis === 'fy' ? first + 1 : first;
};

function StepShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[0.9375rem] font-semibold text-ink-900 tracking-tight">{title}</h3>
      <p className="text-[0.75rem] text-ink-500 mt-0.5 mb-4 leading-relaxed">{sub}</p>
      {children}
    </div>
  );
}

export default function RollForwardSheet({ prior, onClose }: { prior: AuditRecord; onClose: () => void }) {
  const { eng, createAudit } = useIcfr();
  const { addToast } = useToast();
  const [step, setStep] = useState(0);

  const prog = useMemo(() => programmeFor(eng.id), [eng.id]);
  const entities = useMemo(() => entitiesFor(eng.id), [eng.id]);
  const racms = useMemo(() => processesFor(eng.id), [eng.id]);

  // Rolling forward moves to the NEXT ROUND, and only past year-end to the next
  // year. Interim → roll-forward → year-end is the sequence testing actually
  // follows, so defaulting to "same round, next year" would skip two thirds of a
  // cycle. Round is editable below — the default is just the common case.
  const nextRound: AuditRound = prior.round === 'interim' ? 'rollforward'
    : prior.round === 'rollforward' ? 'yearend'
    : 'interim';
  const [round, setRound] = useState<AuditRound>(nextRound);
  const [year, setYear] = useState(() => (prior.round === 'yearend' ? yearOf(prior) + 1 : yearOf(prior)));
  // Only a fy/cy audit ever reaches this sheet — the register hides "Roll
  // forward" on quarter/custom audits, which are one-off checks with no next
  // round. The type is wider than that guarantee, so fall back rather than assert.
  const priorBasis: 'fy' | 'cy' = prior.yearBasis === 'cy' ? 'cy' : 'fy';
  // The next cycle usually matches the one being rolled — but it doesn't have
  // to, so this is editable below like every other field on this step.
  const [yearBasis, setYearBasis] = useState<'fy' | 'cy' | 'quarter' | 'custom'>(priorBasis);

  // Quarter — one of the current year's four calendar quarters.
  const quarterYear = new Date().getFullYear();
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(1);
  const q = QUARTERS.find(x => x.id === quarter)!;

  // Custom — an explicit from/to, for testing that doesn't fit a named cycle.
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const customValid = !!customFrom && !!customTo && customFrom <= customTo;
  const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const periodLabel = yearBasis === 'fy' ? fyLabel(year)
    : yearBasis === 'cy' ? cyLabel(year)
    : yearBasis === 'quarter' ? `Q${quarter} ${quarterYear}`
    : customValid ? `${fmtDate(customFrom)} – ${fmtDate(customTo)}` : 'Custom period';
  const periodSpan = yearBasis === 'fy' || yearBasis === 'cy' ? spanOf(yearBasis, year)
    : yearBasis === 'quarter' ? `${q.span} ${quarterYear}`
    : 'Custom range';
  // Only computed for fy/cy — the round question those two ask decides it.
  const cycleWindow = (yearBasis === 'fy' || yearBasis === 'cy') ? roundWindow(yearBasis, year, round) : null;
  const windowFrom = cycleWindow ? cycleWindow.from : yearBasis === 'quarter' ? `${quarterYear}-${q.from}` : customFrom;
  const windowTo = cycleWindow ? cycleWindow.to : yearBasis === 'quarter' ? `${quarterYear}-${q.to}` : customTo;

  const [group, setGroup] = useState(prog?.groupName ?? eng.entity);
  const [picked, setPicked] = useState<string[]>(
    prior.scopeKind === 'entity' ? prior.scopeIds : prior.scopeNames,
  );

  // Documents carry forward unless unticked — the TB and GL are last cycle's
  // and usually get replaced, so they are confirmed rather than assumed.
  const [carryRacm, setCarryRacm] = useState(true);
  const [carryFiles, setCarryFiles] = useState<Record<string, boolean>>(
    Object.fromEntries(prior.files.map((f, i) => [`${f.name}-${i}`, true])),
  );

  const options = prior.scopeKind === 'entity'
    ? entities.map(e => ({ id: e.id, primary: e.name, secondary: e.type }))
    : racms.map(p => ({ id: p, primary: p, secondary: '' }));

  const toggle = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const files = prior.files.filter((f, i) => carryFiles[`${f.name}-${i}`]);
  const tb = files.filter(f => f.kind === 'tb');
  const gl = files.filter(f => f.kind === 'gl');
  const ready = picked.length > 0;
  const canContinue = step === 0 ? (yearBasis === 'custom' ? customValid : true)
    : step === 1 ? ready : true;

  const commit = () => {
    const names = picked.map(id => options.find(o => o.id === id)?.primary ?? id);
    const hasRounds = yearBasis === 'fy' || yearBasis === 'cy';
    createAudit({
      period: periodLabel,
      yearBasis,
      fiscalYear: yearBasis === 'quarter' ? quarterYear : yearBasis === 'custom' ? Number(customTo.slice(0, 4)) : year,
      periodSpan,
      round: hasRounds ? round : 'yearend',
      windowFrom,
      windowTo,
      // The chain is recorded now — roll-forward used to leave no trace of where
      // a cycle came from, so the continuity section had nothing to read.
      rolledFromId: prior.id,
      scopeKind: prior.scopeKind,
      scopeNames: names,
      scopeIds: prior.scopeKind === 'entity' ? picked : [],
      // The prior audit's control-level picks carry too — rolling forward repeats
      // last cycle's scope, and dropping them would silently widen it.
      controlIds: prior.controlIds ?? [],
      files,
      materiality: prior.materiality,
      overall: prior.overall,
    });
    addToast({
      type: 'success',
      title: 'Rolled forward',
      message: hasRounds
        ? `${periodLabel} ${AUDIT_ROUNDS.find(r => r.id === round)!.label.toLowerCase()} created from ${prior.period} — last cycle's results archived, controls reset to Not tested.`
        : `${periodLabel} created from ${prior.period} — last cycle's results archived, controls reset to Not tested.`,
    });
    onClose();
  };

  const Row = ({ on, onToggle, icon, primary, secondary }: {
    on: boolean; onToggle: () => void; icon: React.ReactNode; primary: string; secondary?: string;
  }) => (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 border-b border-canvas-border last:border-b-0 hover:bg-brand-50/40 transition-colors cursor-pointer text-left"
    >
      <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
        on ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-white')}>
        {on && <Check size={11} strokeWidth={3} />}
      </span>
      {icon}
      <span className="text-[13px] text-ink-900 flex-1 min-w-0 truncate">{primary}</span>
      {secondary && <span className="text-[11px] text-ink-400 shrink-0">{secondary}</span>}
    </button>
  );

  return (
    <FlowModal label="Roll forward" widthCls="w-full max-w-[560px]" variant="sheet" hideClose onClose={onClose}>
      <div className="min-h-full flex flex-col">
        <div className="sticky -top-6 z-10 bg-canvas -mx-6 px-6 -mt-6 pt-11 pb-1">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw size={16} className="text-brand-600 shrink-0" />
                <h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight">Roll forward</h2>
              </div>
              <p className="text-[0.75rem] text-ink-500">Carrying {prior.period} into the next cycle</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close drawer"><X size={16} /></button>
          </div>
          <StepRail steps={STEPS} step={step} onStepClick={setStep} />
        </div>

        <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="flex-1">
          {step === 0 && (
            <StepShell title="Audit period" sub="The cycle this audit rolls into. Or a single quarter, or a custom range, if this next check doesn't need a full cycle.">
              <label className={labelCls}>Year type</label>
              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {([
                  ['fy', 'Financial year', 'Apr – Mar'],
                  ['cy', 'Calendar year', 'Jan – Dec'],
                  ['quarter', 'Quarter', '3 months'],
                  ['custom', 'Custom range', 'Pick dates'],
                ] as const).map(([id, title, sub]) => (
                  <button
                    key={id}
                    onClick={() => setYearBasis(id)}
                    className={cn(
                      'px-2 py-2 rounded-lg border text-[12px] font-bold transition-all cursor-pointer',
                      yearBasis === id
                        ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                        : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40',
                    )}
                  >
                    {title}
                    <span className="block text-[10px] font-semibold opacity-70">{sub}</span>
                  </button>
                ))}
              </div>

              {(yearBasis === 'fy' || yearBasis === 'cy') && (
                <>
                  <label className={labelCls}>Cycle</label>
                  <FormSelect
                    value={String(year)}
                    options={cycleYears(yearBasis).concat(yearOf(prior) + 1)
                      .filter((y, i, a) => a.indexOf(y) === i)
                      .sort((a, b) => a - b)
                      .map(y => ({ value: String(y), label: yearBasis === 'fy' ? fyLabel(y) : cyLabel(y) }))}
                    onChange={v => setYear(Number(v))}
                    className={selectCls}
                    ariaLabel="Audit period"
                    menuCls="w-full"
                  />
                  <label className={`${labelCls} mt-3`}>Round</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {AUDIT_ROUNDS.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setRound(r.id)}
                        className={cn(
                          'px-2 py-2 rounded-lg border text-[12px] font-bold transition-all cursor-pointer',
                          round === r.id
                            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                            : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40',
                        )}
                      >
                        {r.label}
                        <span className="block text-[10px] font-semibold opacity-70">{roundWindow(yearBasis, year, r.id).label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-start gap-2 p-3 rounded-lg bg-brand-50/60 border border-brand-100">
                    <CalendarRange size={13} className="text-brand-600 shrink-0 mt-0.5" />
                    <p className="text-[11.5px] text-ink-600 leading-relaxed">
                      The cycle is <span className="font-semibold text-ink-900">{periodSpan}</span>; this round covers{' '}
                      <span className="font-semibold text-ink-900">{cycleWindow!.label}</span>. {prior.period} keeps its results.
                    </p>
                  </div>
                </>
              )}

              {yearBasis === 'quarter' && (
                <>
                  <label className={labelCls}>Quarter</label>
                  <FormSelect
                    value={String(quarter)}
                    options={QUARTERS.map(x => ({ value: String(x.id), label: `Quarter ${x.id}` }))}
                    onChange={v => setQuarter(Number(v) as 1 | 2 | 3 | 4)}
                    className={selectCls}
                    ariaLabel="Quarter"
                    menuCls="w-full"
                  />
                  <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-brand-50/60 border border-brand-100">
                    <CalendarRange size={13} className="text-brand-600 shrink-0 mt-0.5" />
                    <p className="text-[11.5px] text-ink-600 leading-relaxed">
                      Testing covers <span className="font-semibold text-ink-900">{periodSpan}</span> — one pass, no separate rounds. {prior.period} keeps its results.
                    </p>
                  </div>
                </>
              )}

              {yearBasis === 'custom' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>From</label>
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={inputCls} aria-label="From date" />
                    </div>
                    <div>
                      <label className={labelCls}>To</label>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={inputCls} aria-label="To date" />
                    </div>
                  </div>
                  {customFrom && customTo && !customValid ? (
                    <p className="text-[11.5px] text-risk-700 mt-2">The From date must be on or before the To date.</p>
                  ) : (
                    <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-brand-50/60 border border-brand-100">
                      <CalendarRange size={13} className="text-brand-600 shrink-0 mt-0.5" />
                      <p className="text-[11.5px] text-ink-600 leading-relaxed">
                        {customValid
                          ? <>Testing covers <span className="font-semibold text-ink-900">{fmtDate(customFrom)} – {fmtDate(customTo)}</span> — one pass, no separate rounds. {prior.period} keeps its results.</>
                          : 'Pick a From and To date to set the window this audit covers.'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </StepShell>
          )}

          {step === 1 && (
            <StepShell title="Company & entities" sub="Confirm the group and what the new cycle covers.">
              <label className={labelCls}>Group (listed / holding)</label>
              <input value={group} onChange={e => setGroup(e.target.value)} className={`${inputCls} mb-3`} aria-label="Group name" />
              <div className="border border-canvas-border rounded-xl overflow-hidden">
                {options.length === 0 ? (
                  <p className="text-[11.5px] text-ink-400 px-4 py-5 text-center">Nothing to carry forward.</p>
                ) : options.map(o => (
                  <Row
                    key={o.id}
                    on={picked.includes(o.id)}
                    onToggle={() => toggle(o.id)}
                    icon={prior.scopeKind === 'entity'
                      ? (o.secondary === 'Holding'
                        ? <Landmark size={14} className="text-brand-600 shrink-0" />
                        : <Building2 size={14} className="text-ink-400 shrink-0" />)
                      : <Grid3x3 size={14} className="text-ink-400 shrink-0" />}
                    primary={o.primary}
                    secondary={o.secondary}
                  />
                ))}
              </div>
              {!ready && <p className="text-[11.5px] text-risk-700 mt-2">Pick at least one to roll forward.</p>}
            </StepShell>
          )}

          {step === LAST && (
            <StepShell title="Documents" sub="What carries into the new cycle. Untick anything the new period will replace.">
              <div className="border border-canvas-border rounded-xl overflow-hidden">
                <Row
                  on={carryRacm}
                  onToggle={() => setCarryRacm(v => !v)}
                  icon={<Table2 size={14} className="text-ink-400 shrink-0" />}
                  primary="RACM"
                  secondary={`${racms.length} matrix${racms.length === 1 ? '' : 'es'}`}
                />
                {prior.files.length === 0 ? (
                  <div className="px-3.5 py-2.5 text-[11.5px] text-ink-400 border-t border-canvas-border">
                    No trial balance or general ledger on {prior.period} — attach them from the new audit's Configuration.
                  </div>
                ) : prior.files.map((f, i) => {
                  const key = `${f.name}-${i}`;
                  return (
                    <Row
                      key={key}
                      on={!!carryFiles[key]}
                      onToggle={() => setCarryFiles(p => ({ ...p, [key]: !p[key] }))}
                      icon={<FileSpreadsheet size={14} className="text-ink-400 shrink-0" />}
                      primary={f.name}
                      secondary={f.kind.toUpperCase()}
                    />
                  );
                })}
              </div>
              <p className="text-[11.5px] text-ink-400 mt-2">
                {tb.length} trial balance{tb.length === 1 ? '' : 's'} · {gl.length} general ledger{gl.length === 1 ? '' : 's'} carrying forward.
              </p>

              <div className="rounded-lg border border-evidence-200 bg-evidence-50 p-3 mt-4">
                <p className="text-[11.5px] text-evidence-800 leading-relaxed">
                  Creating this cycle resets the covered controls to <span className="font-semibold">Not tested</span> and
                  clears their deficiencies. {prior.period} keeps nothing — a new cycle is tested from scratch.
                </p>
              </div>
            </StepShell>
          )}
        </motion.div>

        <div className="sticky bottom-0 z-10 bg-canvas -mx-6 px-6 mt-6 pt-4 pb-6 border-t border-canvas-border flex items-center justify-between gap-2">
          <button
            onClick={() => (step === 0 ? onClose() : setStep(s => s - 1))}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} /> {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < LAST ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canContinue}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Continue <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={commit}
              disabled={!ready}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} /> Roll forward
            </button>
          )}
        </div>
      </div>
    </FlowModal>
  );
}
