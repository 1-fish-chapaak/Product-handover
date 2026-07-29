import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, CheckCircle2, ChevronLeft, ChevronRight, Database, FileSpreadsheet, FlaskConical,
  Loader2, Paperclip, Square, Star, UploadCloud, X, XCircle,
} from 'lucide-react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import { requiredDatasetsFor, type RequiredDataset } from './mockData';
import { isControlLocked } from './helpers';
import { cn } from '../../lib/cn';
import type { Control } from './types';

/**
 * Bulk test of controls — the same knitted experience as the workflow library's
 * bulk execution: scope the controls, compile the required files for each one,
 * dedupe to the unique datasets, attach them once, then execute with live
 * per-control progress. Results land in the engagement via bulkTestControls.
 */

type Step = 1 | 2 | 3;

/** What the run will conclude for a control — mirrors the store's bulk-test logic. */
function predictOutcome(c: Control): 'Effective' | 'Ineffective' {
  const dFail = c.design.points.some(p => (p.override ? p.override.result : p.result) === 'Fail');
  const oFail = c.operating.steps.some(s => s.result === 'Fail' || s.override?.result === 'Fail');
  return dFail || oFail ? 'Ineffective' : 'Effective';
}

function checksOf(c: Control): number { return c.design.points.length + c.operating.steps.length; }

function evidenceSummary(c: Control): string {
  const wf = c.operating.steps.filter(s => s.evidenceMode === 'workflow' || (!s.evidenceMode && s.workflowName)).length;
  const ai = c.operating.steps.filter(s => s.evidenceMode === 'ai' || s.aiValidation).length;
  const att = c.operating.steps.filter(s => s.evidenceMode === 'attest' || s.attestEnabled || s.attestation).length;
  const parts: string[] = [];
  if (wf) parts.push(`${wf} workflow${wf === 1 ? '' : 's'}`);
  if (ai) parts.push(`${ai} AI`);
  if (att) parts.push(`${att} attest`);
  return parts.join(' · ') || 'design only';
}

const FORMAT_TONE: Record<RequiredDataset['format'], string> = {
  CSV: 'bg-evidence-50 border-evidence-100 text-evidence-700',
  XLSX: 'bg-compliant-50 border-compliant-100 text-compliant-700',
  PDF: 'bg-paper-50 border-canvas-border text-ink-600',
};

export default function BulkTestModal({ controlIds, onClose }: { controlIds: string[]; onClose: () => void }) {
  const { eng, bulkTestControls } = useIcfr();
  const { addToast } = useToast();

  const [step, setStep] = useState<Step>(1);
  // Concluded controls are frozen — the store's bulk run skips them, so the
  // scope starts with them out and keeps the shown count honest.
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set(
    controlIds.filter(id => { const c = eng.controls.find(x => x.id === id); return c && isControlLocked(c); }),
  ));
  const [compiling, setCompiling] = useState(false);
  const [provided, setProvided] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState<Set<string>>(new Set());
  const [pullingAll, setPullingAll] = useState(false);
  // execution
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); }, []);

  const selected = useMemo(
    () => controlIds.map(id => eng.controls.find(c => c.id === id)).filter((c): c is Control => !!c),
    [controlIds, eng.controls],
  );
  const active = selected.filter(c => !excluded.has(c.id));

  // compile: every control's requirement, deduped to the unique dataset list
  const compiled = useMemo(() => {
    const byName = new Map<string, { dataset: RequiredDataset; usedBy: Control[] }>();
    for (const c of active) {
      for (const ds of requiredDatasetsFor(c)) {
        const hit = byName.get(ds.name);
        if (hit) hit.usedBy.push(c);
        else byName.set(ds.name, { dataset: ds, usedBy: [c] });
      }
    }
    return Array.from(byName.values()).sort((a, b) => b.usedBy.length - a.usedBy.length);
  }, [active]);
  const attestOnly = active.filter(c => requiredDatasetsFor(c).length === 0);
  const totalRequirements = active.reduce((n, c) => n + requiredDatasetsFor(c).length, 0);
  const allProvided = compiled.every(e => provided.has(e.dataset.name));
  const totalChecks = active.reduce((n, c) => n + checksOf(c), 0);
  // Runtime here is a simulated preview, not a real ETA. Derive the shown figure
  // from the exact timing execute() uses below, so the estimate matches what the
  // user actually waits through instead of a fabricated minutes number.
  const runStepMs = Math.max(160, Math.min(900, 6500 / Math.max(1, active.length)));
  const estRuntimeSec = Math.max(1, Math.round((runStepMs * active.length + 500) / 1000));

  // Same order as the library: groups in library order, rows sorted by W/P reference.
  const groups = useMemo(() => {
    const map = new Map<string, Control[]>();
    for (const c of selected) { if (!map.has(c.process)) map.set(c.process, []); map.get(c.process)!.push(c); }
    return Array.from(map, ([key, rows]) => ({ key, rows: rows.sort((a, b) => a.wpRef.localeCompare(b.wpRef)) }));
  }, [selected]);

  const toggleControl = (id: string) => {
    const c = eng.controls.find(x => x.id === id);
    if (c && isControlLocked(c)) return;
    setExcluded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  // Group toggle — all in → drop the whole group; otherwise bring the whole
  // group in. Locked rows never move.
  const toggleGroup = (rows: Control[]) => setExcluded(prev => {
    const n = new Set(prev);
    const open = rows.filter(c => !isControlLocked(c));
    const allIn = open.every(c => !n.has(c.id));
    open.forEach(c => { if (allIn) n.add(c.id); else n.delete(c.id); });
    return n;
  });

  const compile = () => {
    setCompiling(true);
    timers.current.push(window.setTimeout(() => { setCompiling(false); setStep(2); }, 1600));
  };

  const attach = (name: string) => {
    setAttaching(prev => new Set(prev).add(name));
    timers.current.push(window.setTimeout(() => {
      setAttaching(prev => { const n = new Set(prev); n.delete(name); return n; });
      setProvided(prev => new Set(prev).add(name));
    }, 700));
  };

  const pullAll = () => {
    setPullingAll(true);
    timers.current.push(window.setTimeout(() => {
      setPullingAll(false);
      setProvided(new Set(compiled.map(e => e.dataset.name)));
    }, 1400));
  };

  const execute = () => {
    setRunning(true);
    const n = active.length;
    active.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setDoneCount(i + 1), runStepMs * (i + 1)));
    });
    timers.current.push(window.setTimeout(() => {
      bulkTestControls(active.map(c => c.id));
      setFinished(true);
      const ineffective = active.filter(c => predictOutcome(c) === 'Ineffective').length;
      addToast({
        type: ineffective ? 'error' : 'success',
        message: `Bulk test complete — ${n - ineffective} effective, ${ineffective} ineffective across ${n} controls.`,
      });
    }, runStepMs * n + 500));
  };

  // Halt a run in progress: cancel every pending per-control timer BEFORE the
  // store commit (which only fires in the final timeout) can run, then fall back
  // to the pre-run state with scope + attached datasets intact. Nothing is written,
  // so the user is never trapped mid-run and loses no setup.
  const stop = () => {
    timers.current.forEach(t => window.clearTimeout(t));
    timers.current = [];
    setRunning(false);
    setDoneCount(0);
    addToast({ type: 'info', message: 'Bulk test stopped — no controls were changed.' });
  };

  const canClose = !running || finished;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && canClose) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canClose, onClose]);

  // Pure status indicators, deliberately flat and light so they don't read as a
  // clickable stepper — no navigation is wired to them. Movement between steps is
  // the footer's primary button (forward) and Back (backward).
  const stepChip = (n: Step, label: string) => (
    <span className={cn('inline-flex items-center gap-1.5 text-[11.5px] select-none', step === n ? 'text-brand-700 font-semibold' : step > n ? 'text-ink-500 font-medium' : 'text-ink-400 font-medium')}>
      <span className={cn('w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[10px] font-semibold', step === n ? 'bg-brand-100 text-brand-700' : step > n ? 'bg-compliant-100 text-compliant-700' : 'bg-paper-100 text-ink-400')}>
        {step > n ? <Check size={10} strokeWidth={3} /> : n}
      </span>
      {label}
    </span>
  );

  return (
    <div className="modal-backdrop" onClick={() => { if (canClose) onClose(); }}>
      <div className="modal flex flex-col" style={{ maxWidth: 880, maxHeight: 'calc(100vh - 96px)' }} onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="px-6 pt-5 pb-4 border-b border-canvas-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-ink-900" style={{ fontFamily: "'Source Serif 4', serif" }}>Bulk test of controls</h2>
            <button onClick={onClose} disabled={!canClose} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 disabled:opacity-30 cursor-pointer" aria-label="Close"><X size={15} /></button>
          </div>
          <p className="text-[12px] text-ink-500 mt-0.5">{eng.name} · {selected.length} control{selected.length === 1 ? '' : 's'} selected</p>
          <div className="flex items-center gap-3 mt-3">
            {stepChip(1, 'Scope')}
            <ChevronRight size={13} className="text-ink-300" />
            {stepChip(2, 'Required data')}
            <ChevronRight size={13} className="text-ink-300" />
            {stepChip(3, 'Execute')}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {step === 1 && (compiling ? (
            <div className="py-16 text-center">
              <Loader2 size={22} className="mx-auto animate-spin text-brand-600" />
              <div className="mt-3 text-[13px] font-semibold text-ink-800">Compiling required files…</div>
              <div className="mt-1 text-[12px] text-ink-500">Reading test attributes across {active.length} controls and de-duplicating the datasets they need.</div>
            </div>
          ) : (
            <div>
              <p className="text-[12px] text-ink-500 mb-3">Each control's design considerations and operating attributes will be tested against its evidence. Untick anything you want to leave out of this run.</p>
              {active.length === 0 && (
                <div className="mb-3 rounded-xl border border-dashed border-canvas-border p-3.5 text-[12px] text-ink-500">
                  Every control in this selection is already concluded — its paper is frozen, so there is nothing left to test. Reopen a conclusion from the control's page to retest it.
                </div>
              )}
              {groups.map(g => {
                const open = g.rows.filter(c => !isControlLocked(c));
                return (
                <div key={g.key} className="mb-4">
                  <label className={cn('flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-1.5 w-fit', open.length > 0 && 'cursor-pointer')}>
                    <input type="checkbox" checked={open.length > 0 && open.every(c => !excluded.has(c.id))} disabled={open.length === 0} onChange={() => toggleGroup(g.rows)}
                      className="cursor-pointer accent-brand-600 disabled:cursor-not-allowed" aria-label={`Select all in ${g.key}`} />
                    {g.key} · {g.rows.filter(c => !excluded.has(c.id)).length}/{g.rows.length}
                  </label>
                  <div className="space-y-1.5">
                    {g.rows.map(c => {
                      const locked = isControlLocked(c);
                      return (
                      <label key={c.id} className={cn('flex items-start gap-3 rounded-xl border border-canvas-border p-3 transition-colors', locked ? 'opacity-50 cursor-not-allowed' : excluded.has(c.id) ? 'opacity-50 cursor-pointer' : 'hover:border-brand-200 bg-canvas-elevated cursor-pointer')}>
                        <input type="checkbox" checked={!excluded.has(c.id)} disabled={locked} onChange={() => toggleControl(c.id)} className="mt-0.5 cursor-pointer accent-brand-600 disabled:cursor-not-allowed" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="wp-ref">{c.wpRef}</span>
                            {c.isKey && <Star size={11} className="text-mitigated-500 fill-mitigated-100 shrink-0" />}
                            <span className="text-[12.5px] font-semibold text-ink-900 truncate">{c.description}</span>
                            {locked && <span className="px-1.5 h-[17px] inline-flex items-center rounded border border-canvas-border bg-paper-50 text-[9.5px] font-bold uppercase tracking-wide text-ink-500 shrink-0">Concluded — locked</span>}
                          </span>
                          <span className="block text-[11px] text-ink-400 mt-0.5">{checksOf(c)} checks · {evidenceSummary(c)} · {c.owner}</span>
                        </span>
                      </label>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          ))}

          {step === 2 && (
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-[12px] text-ink-500">
                  {totalRequirements} file requirement{totalRequirements === 1 ? '' : 's'} across {active.length} controls compile down to <span className="font-semibold text-ink-800">{compiled.length} unique dataset{compiled.length === 1 ? '' : 's'}</span> — attach each once and every control that needs it is covered.
                </p>
                <button onClick={pullAll} disabled={pullingAll || allProvided} className="h-8 px-3 shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-[12px] font-semibold hover:bg-brand-100 disabled:opacity-40 transition-colors cursor-pointer">
                  {pullingAll ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />} Pull all from source systems
                </button>
              </div>
              <div className="space-y-2">
                {compiled.map(({ dataset, usedBy }) => {
                  const isOn = provided.has(dataset.name);
                  const isBusy = attaching.has(dataset.name) || pullingAll;
                  return (
                    <div key={dataset.name} className={cn('rounded-xl border p-3.5 flex items-start gap-3 transition-colors', isOn ? 'border-compliant-200 bg-compliant-50/40' : 'border-canvas-border bg-canvas-elevated')}>
                      <span className={cn('w-9 h-9 rounded-lg inline-flex items-center justify-center shrink-0', isOn ? 'bg-compliant-100 text-compliant-700' : 'bg-paper-50 text-ink-500')}><FileSpreadsheet size={17} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-ink-900">{dataset.name}</span>
                          <span className={cn('px-1.5 h-[17px] inline-flex items-center rounded border text-[9.5px] font-bold', FORMAT_TONE[dataset.format])}>{dataset.format}</span>
                        </div>
                        <div className="text-[11.5px] text-ink-500 mt-0.5">{dataset.description}</div>
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className="text-[10.5px] font-semibold text-ink-400">Used by {usedBy.length} control{usedBy.length === 1 ? '' : 's'}:</span>
                          {usedBy.slice(0, 6).map(c => <span key={c.id} className="wp-ref" style={{ fontSize: 9.5 }}>{c.wpRef}</span>)}
                          {usedBy.length > 6 && <span className="text-[10.5px] text-ink-400 font-semibold">+{usedBy.length - 6}</span>}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isOn ? (
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-compliant-700"><CheckCircle2 size={14} /> Attached</span>
                        ) : (
                          <button onClick={() => attach(dataset.name)} disabled={isBusy} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[12px] font-semibold text-ink-600 hover:text-brand-700 hover:border-brand-300 disabled:opacity-50 transition-colors cursor-pointer">
                            {attaching.has(dataset.name) ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Attach
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {attestOnly.length > 0 && (
                <div className="mt-3 rounded-xl border border-dashed border-canvas-border p-3 flex items-start gap-2.5">
                  <Paperclip size={14} className="text-ink-400 mt-0.5 shrink-0" />
                  <p className="text-[11.5px] text-ink-500">
                    <span className="font-semibold text-ink-700">{attestOnly.length} control{attestOnly.length === 1 ? '' : 's'}</span> {attestOnly.length === 1 ? 'needs' : 'need'} no files — tested from recorded attestations and evidence already on the control ({attestOnly.slice(0, 5).map(c => c.wpRef).join(', ')}{attestOnly.length > 5 ? '…' : ''}).
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              {/* stat cards */}
              <div className="grid grid-cols-4 gap-2.5 mb-2">
                {[
                  { v: String(active.length), k: 'Controls' },
                  { v: String(compiled.length), k: 'Unique datasets' },
                  { v: String(totalChecks), k: 'Checks to run' },
                  { v: `~${estRuntimeSec}s`, k: 'Est. runtime' },
                ].map(s => (
                  <div key={s.k} className="rounded-xl border border-canvas-border bg-paper-50/50 px-3 py-2.5 text-center">
                    <div className="text-[17px] font-bold tabular-nums text-ink-900 leading-none">{s.v}</div>
                    <div className="text-[10.5px] text-ink-400 font-medium mt-1">{s.k}</div>
                  </div>
                ))}
              </div>
              <p className="text-[10.5px] text-ink-400 mb-4">Runtime is simulated for this preview.</p>
              <div className="space-y-1.5">
                {active.map((c, i) => {
                  const state = !running ? 'queued' : i < doneCount ? 'done' : i === doneCount ? 'running' : 'queued';
                  const outcome = predictOutcome(c);
                  return (
                    <div key={c.id} className={cn('rounded-xl border p-3 flex items-center gap-3 transition-colors', state === 'done' ? (outcome === 'Effective' ? 'border-compliant-200 bg-compliant-50/30' : 'border-risk-200 bg-risk-50/30') : 'border-canvas-border bg-canvas-elevated')}>
                      <span className="wp-ref shrink-0">{c.wpRef}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-semibold text-ink-900 truncate">{c.description}</span>
                        <span className="block text-[10.5px] text-ink-400 mt-0.5">
                          {state === 'done'
                            ? `${checksOf(c)} checks run · design & operating concluded`
                            : `${checksOf(c)} checks · ${requiredDatasetsFor(c).map(d => d.name).join(', ') || 'attestation-based'}`}
                        </span>
                      </span>
                      <span className="shrink-0">
                        {state === 'done' ? (
                          outcome === 'Effective'
                            ? <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-compliant-700"><CheckCircle2 size={14} /> Effective</span>
                            : <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-risk-700"><XCircle size={14} /> Ineffective</span>
                        ) : state === 'running' ? (
                          <Loader2 size={15} className="animate-spin text-brand-600" />
                        ) : (
                          <span className="text-[11px] text-ink-400 font-medium">{running ? 'Queued' : 'Ready'}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-canvas-border flex items-center gap-2 shrink-0">
          {/* Back — steps 2 and 3 (pre-run) only. Returns to the previous step;
              scope + attached datasets are component state and are never reset,
              so nothing is discarded on the way back. */}
          {!running && !finished && step > 1 && (
            <button onClick={() => setStep((step - 1) as Step)} className="h-9 px-2.5 -ml-1 inline-flex items-center gap-1 rounded-lg text-[12.5px] font-semibold text-ink-500 hover:text-ink-900 hover:bg-paper-100 transition-colors cursor-pointer">
              <ChevronLeft size={14} /> Back
            </button>
          )}
          {step === 2 && !allProvided && <span className="text-[11.5px] text-ink-400">{compiled.filter(e => provided.has(e.dataset.name)).length}/{compiled.length} datasets attached</span>}
          {step === 3 && running && !finished && <span className="text-[11.5px] text-ink-500 inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Testing control {Math.min(doneCount + 1, active.length)} of {active.length}…</span>}
          <div className="flex-1" />
          {/* Stop — the explicit, labelled way out of an in-progress run (the header
              X stays disabled mid-run to avoid an accidental dismissal that loses the
              whole setup). Halts the remaining controls and returns to a safe state. */}
          {running && !finished && (
            <button onClick={stop} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-risk-200 text-[12.5px] font-semibold text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer">
              <Square size={11} className="fill-current" /> Stop
            </button>
          )}
          {!finished && !running && <button onClick={onClose} disabled={!canClose} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 disabled:opacity-40 transition-colors cursor-pointer">Cancel</button>}
          {step === 1 && (
            <button onClick={compile} disabled={active.length === 0 || compiling} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer">
              Compile required files <ChevronRight size={14} />
            </button>
          )}
          {step === 2 && (
            <button onClick={() => setStep(3)} disabled={!allProvided} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer">
              Review &amp; execute <ChevronRight size={14} />
            </button>
          )}
          {step === 3 && !running && (
            <button onClick={execute} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
              <FlaskConical size={14} /> Test {active.length} control{active.length === 1 ? '' : 's'}
            </button>
          )}
          {/* Done is the only way out of a finished run — its companion "View run"
              button went with the parked Test runs tab (see SOX_TABS in
              SoxIcfrApp). Closing lands back on the Control Library or the RACM
              matrix the run was launched from, both of which already show the
              new results, so there's nowhere else to send the user. Done takes
              the primary style now that it stands alone. */}
          {finished && (
            <button onClick={onClose} className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
