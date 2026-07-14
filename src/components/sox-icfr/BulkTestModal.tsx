import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, CheckCircle2, ChevronRight, Database, FileSpreadsheet, FlaskConical,
  Loader2, Paperclip, Star, UploadCloud, X, XCircle,
} from 'lucide-react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import { requiredDatasetsFor, type RequiredDataset } from './mockData';
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
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
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
  const estMinutes = Math.max(1, Math.round(totalChecks * 2.5 / 60));

  const groups = useMemo(() => {
    const map = new Map<string, Control[]>();
    for (const c of selected) { if (!map.has(c.process)) map.set(c.process, []); map.get(c.process)!.push(c); }
    return Array.from(map, ([key, rows]) => ({ key, rows }));
  }, [selected]);

  const toggleControl = (id: string) => setExcluded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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
    const stepMs = Math.max(160, Math.min(900, 6500 / n));
    active.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setDoneCount(i + 1), stepMs * (i + 1)));
    });
    timers.current.push(window.setTimeout(() => {
      bulkTestControls(active.map(c => c.id));
      setFinished(true);
      const ineffective = active.filter(c => predictOutcome(c) === 'Ineffective').length;
      addToast({
        type: ineffective ? 'error' : 'success',
        message: `Bulk test complete — ${n - ineffective} effective, ${ineffective} ineffective across ${n} controls.`,
      });
    }, stepMs * n + 500));
  };

  const canClose = !running || finished;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && canClose) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canClose, onClose]);

  const stepChip = (n: Step, label: string) => (
    <span className={cn('inline-flex items-center gap-1.5 text-[11.5px] font-semibold', step === n ? 'text-brand-700' : step > n ? 'text-compliant-700' : 'text-ink-400')}>
      <span className={cn('w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[10px] font-bold', step === n ? 'bg-brand-600 text-white' : step > n ? 'bg-compliant-600 text-white' : 'bg-paper-100 text-ink-500')}>
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
              {groups.map(g => (
                <div key={g.key} className="mb-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-1.5">{g.key} · {g.rows.filter(c => !excluded.has(c.id)).length}/{g.rows.length}</div>
                  <div className="space-y-1.5">
                    {g.rows.map(c => (
                      <label key={c.id} className={cn('flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors', excluded.has(c.id) ? 'border-canvas-border opacity-50' : 'border-canvas-border hover:border-brand-200 bg-canvas-elevated')}>
                        <input type="checkbox" checked={!excluded.has(c.id)} onChange={() => toggleControl(c.id)} className="mt-0.5 cursor-pointer accent-brand-600" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="wp-ref">{c.wpRef}</span>
                            {c.isKey && <Star size={11} className="text-mitigated-500 fill-mitigated-100 shrink-0" />}
                            <span className="text-[12.5px] font-semibold text-ink-900 truncate">{c.description}</span>
                          </span>
                          <span className="block text-[11px] text-ink-400 mt-0.5">{checksOf(c)} checks · {evidenceSummary(c)} · {c.owner}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {step === 2 && (
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-[12px] text-ink-500">
                  {totalRequirements} file requirement{totalRequirements === 1 ? '' : 's'} across {active.length} controls compile down to <span className="font-semibold text-ink-800">{compiled.length} unique dataset{compiled.length === 1 ? '' : 's'}</span> — attach each once and every control that needs it is covered.
                </p>
                <button onClick={pullAll} disabled={pullingAll || allProvided} className="h-8 px-3 shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-[12px] font-semibold hover:bg-brand-100 disabled:opacity-40 transition-colors cursor-pointer">
                  {pullingAll ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />} Pull all from SAP ECC
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
              <div className="grid grid-cols-4 gap-2.5 mb-4">
                {[
                  { v: String(active.length), k: 'Controls' },
                  { v: String(compiled.length), k: 'Unique datasets' },
                  { v: String(totalChecks), k: 'Checks to run' },
                  { v: `~${estMinutes} min`, k: 'Est. runtime' },
                ].map(s => (
                  <div key={s.k} className="rounded-xl border border-canvas-border bg-paper-50/50 px-3 py-2.5 text-center">
                    <div className="text-[17px] font-bold tabular-nums text-ink-900 leading-none">{s.v}</div>
                    <div className="text-[10.5px] text-ink-400 font-medium mt-1">{s.k}</div>
                  </div>
                ))}
              </div>
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
          {step === 2 && !allProvided && <span className="text-[11.5px] text-ink-400">{compiled.filter(e => provided.has(e.dataset.name)).length}/{compiled.length} datasets attached</span>}
          {step === 3 && running && !finished && <span className="text-[11.5px] text-ink-500 inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Testing control {Math.min(doneCount + 1, active.length)} of {active.length}…</span>}
          <div className="flex-1" />
          {!finished && <button onClick={onClose} disabled={!canClose} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 disabled:opacity-40 transition-colors cursor-pointer">Cancel</button>}
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
          {finished && (
            <button onClick={onClose} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-compliant-600 text-white text-[12.5px] font-semibold hover:bg-compliant-700 transition-colors cursor-pointer">
              <Check size={14} /> Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
