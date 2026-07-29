import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, CalendarRange, Check, ChevronDown, FileSpreadsheet, Grid3x3,
  Landmark, Paperclip, Scale, Sparkles, Star, Trash2, X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { FlowModal } from '../audit/sox-testing/SoxTestingTab';
import { StepRail } from '../audit/sox-testing/ScopingWizard';
import { FormSelect } from '../shared/FilterSelect';
import {
  BASIS_OPTIONS, currentFyEnd, cycleYears, ruleOverall,
  type GroupEntity, type MaterialityBasis,
} from '../audit/sox-testing/soxTestingData';
import { entitiesFor } from './auditScope';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import type { AuditScopeKind, Control } from './types';
import { cn } from '../../lib/cn';

/**
 * New audit — the wizard behind the Audit logs tab's primary button.
 *
 * Period → Scope & files → Materiality → Review. Scope and files were separate
 * steps first and were merged on user ask: TB / GL is an attachment to what the
 * audit covers, not a stage of its own. The files half stays optional ("uploads
 * tb and gl if needed") — Continue gates on the scope half alone.
 *
 * Scope is a hard either/or by design: you pick entities OR RACMs, and
 * switching sides clears the other selection rather than quietly keeping both.
 *
 * Entities come from the engagement's programme record when it has one. The
 * Audit logs tab is on EVERY SOX engagement now, including ones the scoping
 * wizard never created a programme for, so those fall back to the demo group
 * (SEED_ENTITIES) — a prototype stand-in, not a real derivation.
 *
 * RACMs are the engagement's processes: a RACM here IS a process's set of
 * controls, the same equivalence Racm.tsx and createRacm() work from.
 */

const STEPS = ['Period', 'Scope & files', 'Materiality', 'Review'] as const;
const REVIEW = STEPS.length - 1;

const inputCls = 'w-full px-3 py-2 text-[13px] border border-canvas-border rounded-lg bg-white text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';
/** Same derivation the scoping wizard uses — a FormSelect trigger wearing the
 *  input's clothes. Native <select> is avoided on purpose: its open menu is the
 *  OS one, which ignores the product theme entirely. */
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'block text-[11px] font-semibold text-ink-500 mb-1.5';

const fyLabel = (y: number) => `FY ${y - 1}-${String(y).slice(-2)}`;
const cyLabel = (y: number) => `CY ${y}`;
const spanOf = (basis: 'fy' | 'cy', y: number) =>
  basis === 'fy' ? `Apr ${y - 1} – Mar ${y}` : `Jan – Dec ${y}`;

function StepShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[0.9375rem] font-semibold text-ink-900 tracking-tight">{title}</h3>
      <p className="text-[0.75rem] text-ink-500 mt-0.5 mb-4 leading-relaxed">{sub}</p>
      {children}
    </div>
  );
}

/** Review rows — label left, value right, matching the wizard's review cards. */
function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-canvas-border last:border-b-0">
      <span className="text-[11.5px] text-ink-500 shrink-0">{label}</span>
      <span className="text-[12.5px] font-semibold text-ink-900 text-right min-w-0">{value}</span>
    </div>
  );
}

export default function NewAuditWizard({ onClose }: { onClose: () => void }) {
  const { eng, createAudit } = useIcfr();
  const { addToast } = useToast();
  const [step, setStep] = useState(0);

  // ── Period ───────────────────────────────────────────────────────────────
  const [yearBasis, setYearBasis] = useState<'fy' | 'cy'>('fy');
  // Defaults to the financial year in progress, same as engagement creation —
  // the audit is almost always for the current cycle, and the picker below
  // stays available for the exceptions.
  const [year, setYear] = useState(currentFyEnd);
  const periodLabel = yearBasis === 'fy' ? fyLabel(year) : cyLabel(year);
  const periodSpan = spanOf(yearBasis, year);

  // ── Scope ────────────────────────────────────────────────────────────────
  const [scopeKind, setScopeKind] = useState<AuditScopeKind>('entity');
  const [picked, setPicked] = useState<string[]>([]);

  // entitiesFor looks in BOTH programme stores — the classic one and the V2
  // tab's, which is where the Altura group lives. Reading PROGRAMMES alone
  // silently offered the demo group's entities instead of the engagement's.
  const entities: GroupEntity[] = useMemo(() => entitiesFor(eng.id), [eng.id]);

  // A RACM is a process's set of controls — same grouping Racm.tsx uses. The
  // rows come along because the RACM side of this step picks control by control.
  const racms = useMemo(() => {
    const map = new Map<string, Control[]>();
    eng.controls.forEach(c => { if (!map.has(c.process)) map.set(c.process, []); map.get(c.process)!.push(c); });
    return Array.from(map, ([name, rows]) => ({ name, rows, count: rows.length }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [eng.controls]);

  /** Which RACM is expanded. One at a time — the sheet is 560px, and two open
   *  lists turn the step into a scroll hunt. */
  const [openRacm, setOpenRacm] = useState<string | null>(null);
  /** Key controls only. SOX scopes to key controls far more often than not, so
   *  this is the switch that does the picking rather than a filter on the eye. */
  const [keyOnly, setKeyOnly] = useState(false);
  /** Controls chosen inside the RACMs, by id. A RACM ticked whole puts all of
   *  its ids in; unticking one row leaves the RACM partly selected. */
  const [pickedControls, setPickedControls] = useState<string[]>([]);

  /** What `keyOnly` lets you choose from within one RACM. */
  const rowsOf = useCallback(
    (name: string) => {
      const rows = racms.find(r => r.name === name)?.rows ?? [];
      return keyOnly ? rows.filter(c => c.isKey) : rows;
    },
    [racms, keyOnly],
  );

  // Turning "key controls only" on must not leave non-key controls selected
  // underneath it — the switch decides the scope, so it prunes what it excludes.
  useEffect(() => {
    if (!keyOnly) return;
    const keyIds = new Set(eng.controls.filter(c => c.isKey).map(c => c.id));
    setPickedControls(prev => prev.filter(id => keyIds.has(id)));
  }, [keyOnly, eng.controls]);

  // Entities are picked by id — the workspace filter maps ids to processes.
  // RACMs are picked by process name, which IS their identity.
  const options = scopeKind === 'entity'
    ? entities.map(e => ({ id: e.id, primary: e.name, secondary: e.type }))
    : racms.map(r => ({ id: r.name, primary: r.name, secondary: `${r.count} control${r.count === 1 ? '' : 's'}` }));

  // Switching sides clears the other side's picks — the two are never merged.
  const switchKind = (kind: AuditScopeKind) => {
    if (kind === scopeKind) return;
    setScopeKind(kind);
    setPicked([]);
    setPickedControls([]);
    setOpenRacm(null);
  };
  /** Ticking a RACM takes its controls with it — whole RACM in, whole RACM out.
   *  Individual rows are then unticked inside, which leaves the RACM partly
   *  selected but still in scope. */
  const togglePick = (id: string) => {
    const on = picked.includes(id);
    setPicked(prev => (on ? prev.filter(x => x !== id) : [...prev, id]));
    if (scopeKind !== 'racm') return;
    const ids = rowsOf(id).map(c => c.id);
    setPickedControls(prev => (on
      ? prev.filter(x => !ids.includes(x))
      : Array.from(new Set([...prev, ...ids]))));
  };
  /** One control row. Unticking the last row of a RACM drops the RACM too —
   *  a RACM in scope with nothing selected under it covers nothing. */
  const toggleControl = (racm: string, controlId: string) => {
    setPickedControls(prev => {
      const next = prev.includes(controlId) ? prev.filter(x => x !== controlId) : [...prev, controlId];
      const ids = rowsOf(racm).map(c => c.id);
      const anyLeft = ids.some(id => next.includes(id));
      setPicked(p => (anyLeft ? (p.includes(racm) ? p : [...p, racm]) : p.filter(x => x !== racm)));
      return next;
    });
  };
  /** Display-ready labels for what's picked — ids are storage, not copy. */
  const pickedNames = picked.map(id => options.find(o => o.id === id)?.primary ?? id);

  // ── Files (optional) ─────────────────────────────────────────────────────
  const [files, setFiles] = useState<{ name: string; kind: 'tb' | 'gl' }[]>([]);
  const addFile = (kind: 'tb' | 'gl') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) setFiles(prev => [...prev, { name: f.name, kind }]);
    };
    input.click();
  };

  // ── Materiality ──────────────────────────────────────────────────────────
  const [basis, setBasis] = useState<MaterialityBasis>('pbt');
  const basisOpt = BASIS_OPTIONS.find(b => b.id === basis)!;
  const [benchmark, setBenchmark] = useState(basisOpt.defaultBenchmark);
  const [pct, setPct] = useState(basisOpt.defaultPct);
  const changeBasis = (id: MaterialityBasis) => {
    const opt = BASIS_OPTIONS.find(b => b.id === id)!;
    setBasis(id);
    setBenchmark(opt.defaultBenchmark);
    setPct(opt.defaultPct);
  };
  const overall = ruleOverall({ id: 'draft', name: 'Audit rule', basis, benchmark, pct });

  // ── Gates ────────────────────────────────────────────────────────────────
  // Files is skippable on purpose — everything else must be answered.
  // Scope & files gates on the scope half only — the TB / GL half is optional,
  // so an empty file list must never block Continue.
  const canContinue = step === 0 ? true
    // Scoping by RACM means picking controls: a RACM ticked with nothing
    // under it covers nothing, so Continue waits for at least one row.
    : step === 1 ? (scopeKind === 'entity' ? picked.length > 0 : pickedControls.length > 0)
    : step === 2 ? benchmark > 0 && (basis === 'custom' || pct > 0)
    : true;

  const create = () => {
    createAudit({
      period: periodLabel,
      yearBasis,
      periodSpan,
      scopeKind,
      scopeNames: pickedNames,
      scopeIds: scopeKind === 'entity' ? picked : [],
      // Only the RACM side picks control by control; scoping by entity lets the
      // entities' processes decide, so it leaves this empty on purpose.
      controlIds: scopeKind === 'racm' ? pickedControls : [],
      files,
      materiality: { basisLabel: basisOpt.label, benchmark, pct },
      overall,
    });
    addToast({
      type: 'success',
      title: 'Audit created',
      message: scopeKind === 'entity'
        ? `${periodLabel} — ${picked.length} entit${picked.length === 1 ? 'y' : 'ies'} in scope.`
        : `${periodLabel} — ${pickedControls.length} control${pickedControls.length === 1 ? '' : 's'} across ${picked.length} RACM${picked.length === 1 ? '' : 's'}.`,
    });
    onClose();
  };

  return (
    <FlowModal label="New audit" widthCls="w-full max-w-[560px]" variant="sheet" hideClose onClose={onClose}>
      {/* FlowModal's sheet is one scroll container (flex-1 overflow-y-auto p-6
          pb-0), so a plain footer just flows after the content and floats
          mid-sheet on short steps. min-h-full + flex-col makes this fill the
          scrollport and the flex-1 body push the footer down; the footer's own
          sticky bottom-0 then keeps it pinned once a step does scroll. */}
      <div className="min-h-full flex flex-col">
      {/* Header pins to the scrollport like the scoping sheet's — see the
          sticky -top-6 note in ScopingWizard for why the offset is negative. */}
      <div className="sticky -top-6 z-10 bg-canvas -mx-6 px-6 -mt-6 pt-11 pb-1">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-brand-600 shrink-0" />
              <h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight">New audit</h2>
            </div>
            <p className="text-[0.75rem] text-ink-500">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close drawer"><X size={16} /></button>
        </div>
        <StepRail steps={STEPS} step={step} onStepClick={setStep} />
      </div>

      <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="flex-1">
        {step === 0 && (
          <StepShell title="Audit period" sub="An annual cycle, named by the year the group reports on — not a dated project.">
            <label className={labelCls}>Year type</label>
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {([['fy', 'Financial year', 'Apr – Mar'], ['cy', 'Calendar year', 'Jan – Dec']] as const).map(([id, title, sub]) => (
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
            <label className={labelCls}>Audit period</label>
            <FormSelect
              value={String(year)}
              options={cycleYears(yearBasis).map(y => ({ value: String(y), label: yearBasis === 'fy' ? fyLabel(y) : cyLabel(y) }))}
              onChange={v => setYear(Number(v))}
              className={selectCls}
              ariaLabel="Audit period"
              menuCls="w-full"
            />
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-brand-50/60 border border-brand-100">
              <CalendarRange size={13} className="text-brand-600 shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-ink-600 leading-relaxed">
                Testing runs <span className="font-semibold text-ink-900">{periodSpan}</span>.
              </p>
            </div>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell title="What this audit covers" sub="Scope by entity or by RACM — one or the other, then pick as many as the audit covers.">
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {([['entity', 'By entity', Building2], ['racm', 'By RACM', Grid3x3]] as const).map(([id, title, Icon]) => (
                <button
                  key={id}
                  onClick={() => switchKind(id)}
                  className={cn(
                    'px-2 py-2 rounded-lg border text-[12px] font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5',
                    scopeKind === id
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                      : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40',
                  )}
                >
                  <Icon size={13} /> {title}
                </button>
              ))}
            </div>

            {/* Key controls only — the switch that does the picking, not a
                filter on the eye: SOX scopes to key controls far more often
                than not, and turning it on prunes anything non-key already
                selected rather than hiding it and quietly keeping it. */}
            {scopeKind === 'racm' && (
              <button
                role="switch"
                aria-checked={keyOnly}
                onClick={() => setKeyOnly(v => !v)}
                className="w-full mb-2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-canvas-border bg-white hover:border-brand-300 transition-colors cursor-pointer text-left"
              >
                <span className={cn('w-8 h-[18px] rounded-full relative shrink-0 transition-colors', keyOnly ? 'bg-brand-600' : 'bg-ink-200')}>
                  <span className={cn('absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all', keyOnly ? 'left-[16px]' : 'left-[2px]')} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-ink-900">Key controls only</span>
                  <span className="block text-[11px] text-ink-500">
                    {keyOnly ? 'Only key controls can be selected.' : 'Every control is available to select.'}
                  </span>
                </span>
                <Star size={14} className={cn('ml-auto shrink-0', keyOnly ? 'text-mitigated-600 fill-mitigated-200' : 'text-ink-300')} />
              </button>
            )}

            <div className="border border-canvas-border rounded-xl overflow-hidden">
              {options.length === 0 ? (
                <p className="text-[11.5px] text-ink-400 px-4 py-6 text-center">
                  {scopeKind === 'entity'
                    ? 'No entities on this engagement yet.'
                    : 'No RACMs yet — create one from the RACM tab first.'}
                </p>
              ) : options.map(o => {
                const on = picked.includes(o.id);
                if (scopeKind === 'entity') {
                  return (
                    <button
                      key={o.id}
                      onClick={() => togglePick(o.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-canvas-border last:border-b-0 hover:bg-brand-50/40 transition-colors cursor-pointer text-left"
                    >
                      <span className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        on ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-white',
                      )}>
                        {on && <Check size={11} strokeWidth={3} />}
                      </span>
                      {o.secondary === 'Holding'
                        ? <Landmark size={14} className="text-brand-600 shrink-0" />
                        : <Building2 size={14} className="text-ink-400 shrink-0" />}
                      <span className="text-[13px] text-ink-900 flex-1 min-w-0 truncate">{o.primary}</span>
                      <span className="text-[11px] text-ink-400 shrink-0">{o.secondary}</span>
                    </button>
                  );
                }

                // ── RACM row: tick the whole matrix, or open it and pick rows ──
                const rows = rowsOf(o.id);
                const chosen = rows.filter(c => pickedControls.includes(c.id)).length;
                const expanded = openRacm === o.id;
                return (
                  <div key={o.id} className="border-b border-canvas-border last:border-b-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50/40 transition-colors">
                      <button
                        onClick={() => togglePick(o.id)}
                        aria-label={`Select every control in ${o.primary}`}
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer',
                          on ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-white',
                        )}
                      >
                        {on && <Check size={11} strokeWidth={3} />}
                      </button>
                      <Grid3x3 size={14} className="text-ink-400 shrink-0" />
                      <button
                        onClick={() => setOpenRacm(expanded ? null : o.id)}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                      >
                        <span className="text-[13px] text-ink-900 truncate">{o.primary}</span>
                        <span className="text-[11px] text-ink-400 shrink-0 ml-auto tabular-nums">
                          {chosen > 0 ? `${chosen}/${rows.length} selected` : `${rows.length} control${rows.length === 1 ? '' : 's'}`}
                        </span>
                        <ChevronDown size={14} className={cn('text-ink-400 shrink-0 transition-transform', expanded && 'rotate-180')} />
                      </button>
                    </div>

                    {expanded && (
                      <div className="bg-canvas/60 border-t border-canvas-border">
                        {rows.length === 0 ? (
                          <p className="text-[11.5px] text-ink-400 px-4 py-4 text-center">
                            No key controls in this RACM — turn the switch off to see the rest.
                          </p>
                        ) : rows.map(c => {
                          const ticked = pickedControls.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() => toggleControl(o.id, c.id)}
                              className="w-full flex items-start gap-3 pl-9 pr-4 py-2 hover:bg-brand-50/40 transition-colors cursor-pointer text-left"
                            >
                              <span className={cn(
                                'w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                                ticked ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-white',
                              )}>
                                {ticked && <Check size={11} strokeWidth={3} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  {c.isKey && <Star size={11} className="text-mitigated-600 fill-mitigated-200 shrink-0" />}
                                  <span className="text-[12px] text-ink-800 truncate">{c.description}</span>
                                </span>
                                <span className="block text-[10.5px] text-ink-400 font-mono mt-0.5">{c.id} · {c.subProcess}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] text-ink-400 mt-2">
              {scopeKind === 'entity'
                ? `${picked.length} entit${picked.length === 1 ? 'y' : 'ies'} selected`
                : `${picked.length} RACM${picked.length === 1 ? '' : 's'} · ${pickedControls.length} control${pickedControls.length === 1 ? '' : 's'} selected`}
            </p>

            {/* Files — the optional half of this step. Divided off rather than
                given its own step: it's an attachment to the scope above, and
                Continue never waits on it. */}
            <div className="mt-6 pt-5 border-t border-canvas-border">
              <div className="flex items-baseline gap-2 mb-0.5">
                <h4 className="text-[13px] font-semibold text-ink-900">Trial balance &amp; general ledger</h4>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Optional</span>
              </div>
              <p className="text-[0.75rem] text-ink-500 mb-4 leading-relaxed">
                Attach them if this audit needs them — you can add them later instead.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-4">
              {([['tb', 'Trial balance'], ['gl', 'General ledger']] as const).map(([kind, title]) => (
                <button
                  key={kind}
                  onClick={() => addFile(kind)}
                  className="px-3 py-3 rounded-lg border border-dashed border-canvas-border bg-white hover:border-brand-400 hover:bg-brand-50/40 transition-all cursor-pointer text-center"
                >
                  <FileSpreadsheet size={16} className="text-brand-600 mx-auto mb-1" />
                  <span className="block text-[12px] font-semibold text-ink-800">{title}</span>
                  <span className="block text-[10.5px] text-ink-400">XLSX · CSV</span>
                </button>
              ))}
            </div>

              {files.length > 0 && (
                <div className="border border-canvas-border rounded-xl overflow-hidden">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-canvas-border last:border-b-0">
                      <Paperclip size={13} className="text-ink-400 shrink-0" />
                      <span className="text-[12.5px] text-ink-900 flex-1 min-w-0 truncate">{f.name}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 rounded px-1.5 py-0.5 shrink-0">
                        {f.kind}
                      </span>
                      <button
                        onClick={() => setFiles(prev => prev.filter((_, x) => x !== i))}
                        className="text-ink-400 hover:text-risk-700 transition-colors cursor-pointer shrink-0"
                        aria-label={`Remove ${f.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="Materiality rule" sub="Set before testing starts — the threshold this audit measures exceptions against.">
            <label className={labelCls}>Basis</label>
            <FormSelect
              value={basis}
              options={BASIS_OPTIONS.map(b => ({ value: b.id, label: b.label }))}
              onChange={v => changeBasis(v as MaterialityBasis)}
              className={`${selectCls} mb-1.5`}
              ariaLabel="Materiality basis"
              menuCls="w-full"
            />
            <p className="text-[11px] text-ink-400 mb-4">{basisOpt.hint}</p>

            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className={labelCls}>{basis === 'custom' ? 'Amount (₹ Cr)' : 'Benchmark (₹ Cr)'}</label>
                <input type="number" min={0} value={benchmark} onChange={e => setBenchmark(Number(e.target.value))} className={`${inputCls} tabular-nums`} />
              </div>
              {basis !== 'custom' && (
                <div className="w-24">
                  <label className={labelCls}>%</label>
                  <input type="number" min={0.1} max={100} step={0.1} value={pct} onChange={e => setPct(Number(e.target.value))} className={`${inputCls} tabular-nums`} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-brand-50/60 border border-brand-100">
              <Scale size={14} className="text-brand-600 shrink-0" />
              <p className="text-[11.5px] text-ink-600 leading-relaxed">
                Overall materiality <span className="font-semibold text-ink-900 tabular-nums">₹{overall} Cr</span>
                {basis !== 'custom' && <> — {pct}% of ₹{benchmark} Cr</>}.
              </p>
            </div>
          </StepShell>
        )}

        {step === REVIEW && (
          <StepShell title="Review" sub="Check it over — creating the audit adds it to this engagement's Audit logs.">
            <div className="rounded-xl border border-canvas-border bg-white p-4">
              <ReviewRow label="Period" value={<>{periodLabel} <span className="font-normal text-ink-400">· {periodSpan}</span></>} />
              <ReviewRow
                label={scopeKind === 'entity' ? 'Entities' : 'RACMs'}
                value={pickedNames.join(', ')}
              />
              {scopeKind === 'racm' && (
                <ReviewRow
                  label="Controls"
                  value={<>{pickedControls.length} selected{keyOnly && <span className="font-normal text-ink-400"> · key controls only</span>}</>}
                />
              )}
              <ReviewRow
                label="TB / GL"
                value={files.length === 0 ? <span className="font-normal text-ink-400">Not attached</span> : files.map(f => f.name).join(', ')}
              />
              <ReviewRow label="Materiality" value={<>₹{overall} Cr <span className="font-normal text-ink-400">· {basisOpt.label}</span></>} />
            </div>
          </StepShell>
        )}
      </motion.div>

      {/* footer — Back / Continue. No Skip: files stopped being their own step,
          so there is nothing to skip past — Continue simply never waits on them.
          Pinned to the bottom of the sheet: -mx-6 px-6 bleeds it to the sheet
          edges, pb-6 restores the padding FlowModal drops with its pb-0. */}
      <div className="sticky bottom-0 z-10 bg-canvas -mx-6 px-6 mt-6 pt-4 pb-6 border-t border-canvas-border flex items-center justify-between gap-2">
        <button
          onClick={() => (step === 0 ? onClose() : setStep(s => s - 1))}
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer"
        >
          <ArrowLeft size={13} /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <div className="flex items-center gap-2">
          {step < REVIEW ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canContinue}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Continue <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={create}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"
            >
              <Check size={14} /> Create audit
            </button>
          )}
        </div>
      </div>
      </div>
    </FlowModal>
  );
}
