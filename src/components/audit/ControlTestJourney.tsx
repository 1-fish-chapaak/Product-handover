/**
 * Control test journey — a guided happy-path drawer for one control:
 *   Population upload → Sampling → AI validation (no failures) → Working paper.
 * Launched from the Controls tab. Self-contained mock flow + .xlsx export.
 */
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Upload, FileSpreadsheet, Shuffle, Bot, Sparkles, CheckCircle2, Download,
  ChevronRight, ChevronLeft, Loader2, ListChecks, FileCheck2, Database,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import type { Engagement } from '../../data/engagements';
import { attrCode, racmRowsForProcess } from '../../data/racm';
import { useEngagementWorkspace } from './engagementWorkspace';
import { buildWpControls, downloadControlWorkingPaper, type WpControl } from './workingPaper';

type Step = 'population' | 'sampling' | 'validation' | 'paper';
const STEPS: { id: Step; label: string; Icon: typeof Upload }[] = [
  { id: 'population', label: 'Population', Icon: Database },
  { id: 'sampling', label: 'Sampling', Icon: Shuffle },
  { id: 'validation', label: 'AI validation', Icon: Bot },
  { id: 'paper', label: 'Working paper', Icon: FileCheck2 },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const POP_COLUMNS = ['Invoice', 'Vendor', 'Amount (₹)', 'Date'];
const POP_PREVIEW: (string | number)[][] = [
  ['INV-44021', 'Tata Steel', '3,40,000', '12 Apr 25'],
  ['INV-44022', 'Reliance', '1,90,500', '14 Apr 25'],
  ['INV-44027', 'L&T', '8,10,000', '15 Apr 25'],
  ['INV-44031', 'Wipro', '2,75,000', '18 Apr 25'],
];

export default function ControlTestJourney({ engagement, controlId, onClose }: { engagement: Engagement; controlId: string; onClose: () => void }) {
  const { addToast, updateToast } = useToast();
  const ws = useEngagementWorkspace();
  const control = ws.controls.find(c => c.controlId === controlId);

  const [step, setStep] = useState<Step>('population');
  const [population, setPopulation] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [method, setMethod] = useState<'Random' | 'Statistical'>('Random');
  const [sampleSize, setSampleSize] = useState(25);
  const [samples, setSamples] = useState<{ ref: string }[]>([]);
  const [sampling, setSampling] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(0);
  const [validationDone, setValidationDone] = useState(false);

  const wpControl: WpControl | null = useMemo(() => {
    if (!control) return null;
    const riskByControl = new Map(racmRowsForProcess(engagement.process).map(r => [r.controlId, r.riskDescription]));
    return buildWpControls([control], {
      health: engagement.health,
      owner: engagement.owner,
      testedOn: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      linkedWorkflows: (id) => ws.workflowIdsForAttribute(id).map(wid => ({ id: wid, name: ws.workflows.find(w => w.id === wid)?.name ?? wid })),
      riskForControl: (id) => riskByControl.get(id),
      result: () => 'Pass', // happy path — no failures
    })[0] ?? null;
  }, [control, engagement, ws]);

  if (!control) return null;
  const attrs = control.attributes;
  const stepIndex = STEPS.findIndex(s => s.id === step);

  const uploadPopulation = () => {
    setUploading(true);
    const id = addToast({ type: 'loading', message: 'Parsing population file…' });
    window.setTimeout(() => {
      const n = 1180 + (hash(control.controlId) % 520); // ~1,180–1,700 records
      setPopulation(n);
      setUploading(false);
      updateToast(id, { type: 'success', title: 'Population loaded', message: `${n.toLocaleString('en-IN')} records` });
    }, 1000);
  };

  const generateSamples = () => {
    setSampling(true);
    window.setTimeout(() => {
      const seg = control.controlId.split('-').pop() ?? 'S';
      const rows = Array.from({ length: sampleSize }, (_, i) => ({ ref: `${seg}-${String((hash(control.controlId) % 90) + i + 1).padStart(3, '0')}` }));
      setSamples(rows);
      setSampling(false);
      // re-running sampling invalidates a prior validation
      setValidationDone(false);
      setValidated(0);
    }, 850);
  };

  const runValidation = () => {
    setValidating(true);
    setValidated(0);
    const id = addToast({ type: 'loading', message: `AI validating ${samples.length} samples…` });
    let n = 0;
    const stepBy = Math.max(1, Math.round(samples.length / 12));
    const timer = window.setInterval(() => {
      n = Math.min(samples.length, n + stepBy);
      setValidated(n);
      if (n >= samples.length) {
        window.clearInterval(timer);
        setValidating(false);
        setValidationDone(true);
        updateToast(id, { type: 'success', title: 'Validation complete', message: `${samples.length}/${samples.length} passed · 0 exceptions` });
      }
    }, 110);
  };

  const downloadPaper = () => {
    if (!wpControl) return;
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    downloadControlWorkingPaper(
      engagement,
      wpControl,
      { preparedBy: engagement.owner, reviewedBy: 'Pending reviewer sign-off', preparedOn: today },
      { population: population ?? 0, method, samples: samples.map(s => ({ ref: s.ref, result: 'Pass' as const })) },
    );
    addToast({ type: 'success', title: 'Working paper exported', message: `Working_Paper_${control.controlId}.xlsx` });
  };

  const canContinue =
    step === 'population' ? population != null :
    step === 'sampling' ? samples.length > 0 :
    step === 'validation' ? validationDone :
    true;

  const goNext = () => { const i = STEPS.findIndex(s => s.id === step); if (i < STEPS.length - 1) setStep(STEPS[i + 1]!.id); };
  const goBack = () => { const i = STEPS.findIndex(s => s.id === step); if (i > 0) setStep(STEPS[i - 1]!.id); };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-[80]" onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] z-[85] bg-canvas-elevated border-l border-canvas-border shadow-2xl flex flex-col"
        role="dialog" aria-label={`Test control ${control.controlId}`}
      >
        {/* header */}
        <header className="shrink-0 px-5 py-4 border-b border-canvas-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono text-[0.75rem] font-semibold text-brand-700">{control.controlId}</span>
              {control.isKey && <span className="text-[0.5625rem] font-bold uppercase tracking-wide text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">Key</span>}
            </div>
            <h2 className="text-[1rem] font-semibold text-ink-900 leading-snug" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>{control.description}</h2>
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-lg text-ink-500 hover:text-ink-800 hover:bg-paper-50 flex items-center justify-center cursor-pointer transition-colors" aria-label="Close"><X size={16} /></button>
        </header>

        {/* step rail */}
        <div className="shrink-0 px-5 py-3 border-b border-canvas-border bg-paper-50/50">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[0.625rem] font-bold transition-colors ${done ? 'bg-brand-600 text-white' : active ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-200' : 'bg-paper-100 text-ink-400'}`}>
                      {done ? <CheckCircle2 size={13} /> : <s.Icon size={12} />}
                    </span>
                    <span className={`text-[0.6875rem] font-semibold whitespace-nowrap ${active ? 'text-ink-800' : done ? 'text-ink-600' : 'text-ink-400'}`}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <span className={`h-px flex-1 mx-2 ${i < stepIndex ? 'bg-brand-300' : 'bg-paper-200'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
              {step === 'population' && (
                <Section title="Upload population" hint="The complete set of transactions for the control over the engagement period.">
                  {population == null ? (
                    <button onClick={uploadPopulation} disabled={uploading} className="w-full rounded-xl border-2 border-dashed border-canvas-border hover:border-brand-300 bg-paper-50/40 py-10 flex flex-col items-center gap-2 cursor-pointer transition-colors disabled:opacity-70">
                      {uploading ? <Loader2 size={22} className="text-brand-600 animate-spin" /> : <Upload size={22} className="text-brand-600" />}
                      <span className="text-[0.8125rem] font-semibold text-ink-700">{uploading ? 'Parsing…' : 'Upload population file'}</span>
                      <span className="text-[0.6875rem] text-ink-400">.xlsx / .csv · drag & drop or click</span>
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 rounded-lg bg-compliant-50 border border-compliant-700/20 px-3 py-2 text-[0.8125rem] text-compliant-700 font-medium">
                        <FileSpreadsheet size={15} /> p2p-invoices-{engagement.periodStart.replace(/\s/g, '')}.xlsx · <span className="tabular-nums">{population.toLocaleString('en-IN')}</span> records
                      </div>
                      <MiniTable columns={POP_COLUMNS} rows={POP_PREVIEW} footnote={`Preview · 4 of ${population.toLocaleString('en-IN')} rows`} />
                    </div>
                  )}
                </Section>
              )}

              {step === 'sampling' && (
                <Section title="Select sample" hint={`Drawn from the population of ${(population ?? 0).toLocaleString('en-IN')} records.`}>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-[0.6875rem] uppercase tracking-wider font-semibold text-ink-500">Method</span>
                    {(['Random', 'Statistical'] as const).map(m => (
                      <button key={m} onClick={() => setMethod(m)} className={`h-7 px-3 rounded-md text-[0.75rem] font-semibold border transition-colors cursor-pointer ${method === m ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-canvas-border text-ink-600 hover:bg-paper-50'}`}>{m}</button>
                    ))}
                    <span className="text-[0.6875rem] uppercase tracking-wider font-semibold text-ink-500 ml-2">Size</span>
                    {[25, 40, 60].map(n => (
                      <button key={n} onClick={() => setSampleSize(n)} className={`h-7 w-9 rounded-md text-[0.75rem] font-semibold border transition-colors cursor-pointer tabular-nums ${sampleSize === n ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-canvas-border text-ink-600 hover:bg-paper-50'}`}>{n}</button>
                    ))}
                  </div>
                  <button onClick={generateSamples} disabled={sampling} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-500 cursor-pointer transition-colors disabled:opacity-70">
                    {sampling ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />} Generate {sampleSize} samples
                  </button>
                  {samples.length > 0 && (
                    <div className="mt-3">
                      <MiniTable columns={['#', 'Sample Ref', 'Status']} rows={samples.map((s, i) => [i + 1, s.ref, 'Selected'])} footnote={`${samples.length} ${method.toLowerCase()} samples selected`} scroll />
                    </div>
                  )}
                </Section>
              )}

              {step === 'validation' && (
                <Section title="AI validation" hint={`IRA validates each of the ${samples.length} samples against ${attrs.length} attribute${attrs.length === 1 ? '' : 's'}.`}>
                  {!validationDone && !validating && (
                    <button onClick={runValidation} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-500 cursor-pointer transition-colors">
                      <Sparkles size={14} /> Run AI validation
                    </button>
                  )}
                  {validating && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[0.8125rem] text-ink-700 font-medium"><Bot size={15} className="text-brand-600 animate-pulse" /> Validating {validated} / {samples.length}…</div>
                      <div className="h-2 rounded-full bg-paper-100 overflow-hidden"><div className="h-full bg-brand-500 transition-all duration-150" style={{ width: `${(validated / Math.max(1, samples.length)) * 100}%` }} /></div>
                    </div>
                  )}
                  {validationDone && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 rounded-lg bg-compliant-50 border border-compliant-700/20 px-3.5 py-3">
                        <CheckCircle2 size={18} className="text-compliant-700 shrink-0" />
                        <div>
                          <div className="text-[0.875rem] font-bold text-compliant-700">All {samples.length} samples passed · 0 exceptions</div>
                          <div className="text-[0.6875rem] text-ink-500 inline-flex items-center gap-1"><Sparkles size={11} className="text-brand-500" /> IRA confidence 96% · no deviations detected</div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-canvas-border divide-y divide-canvas-border">
                        {attrs.map(a => (
                          <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[0.75rem]">
                            <span className="inline-flex items-center gap-2 min-w-0"><span className="font-mono text-[0.6875rem] text-ink-500">{attrCode(a.id)}</span><span className="text-ink-700 truncate">{a.description}</span></span>
                            <span className="inline-flex items-center gap-1 text-compliant-700 font-semibold shrink-0"><CheckCircle2 size={12} /> {samples.length}/{samples.length}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {step === 'paper' && (
                <Section title="Conclusion & working paper" hint="Testing complete — record the conclusion and export the working paper.">
                  <div className="rounded-xl border border-compliant-700/30 bg-compliant-50/40 p-4 space-y-2 mb-4">
                    <div className="inline-flex items-center gap-2 text-[0.9375rem] font-bold text-compliant-700"><ShieldOk /> Control concluded Effective</div>
                    <ul className="text-[0.75rem] text-ink-600 space-y-1">
                      <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-compliant-700" /> Population of {(population ?? 0).toLocaleString('en-IN')} · {samples.length} {method.toLowerCase()} samples</li>
                      <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-compliant-700" /> {samples.length}/{samples.length} samples passed across {attrs.length} attribute{attrs.length === 1 ? '' : 's'}</li>
                      <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-compliant-700" /> 0 exceptions · no deficiencies</li>
                    </ul>
                  </div>
                  <p className="text-[0.6875rem] text-ink-500 mb-2 inline-flex items-center gap-1.5"><ListChecks size={13} /> Workbook: Control cover · Attribute Testing · Sampling</p>
                  <button onClick={downloadPaper} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-500 cursor-pointer transition-colors">
                    <Download size={14} /> Download working paper (Excel)
                  </button>
                </Section>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* footer */}
        <footer className="shrink-0 px-5 py-3.5 border-t border-canvas-border flex items-center justify-between gap-3">
          <button onClick={goBack} disabled={stepIndex === 0} className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[0.8125rem] font-semibold text-ink-600 hover:bg-paper-50 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft size={15} /> Back</button>
          {step === 'paper' ? (
            <button onClick={onClose} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-ink-800 text-white text-[0.8125rem] font-semibold hover:bg-ink-900 cursor-pointer transition-colors">Done</button>
          ) : (
            <button onClick={goNext} disabled={!canContinue} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.8125rem] font-semibold hover:bg-brand-500 cursor-pointer transition-colors disabled:bg-brand-100 disabled:text-brand-300 disabled:cursor-not-allowed">Continue <ChevronRight size={15} /></button>
          )}
        </footer>
      </motion.div>
    </>
  );
}

function ShieldOk() {
  return <FileCheck2 size={17} className="text-compliant-700" />;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[0.9375rem] font-semibold text-ink-900">{title}</h3>
      {hint && <p className="text-[0.75rem] text-ink-500 mt-0.5 mb-3.5">{hint}</p>}
      {children}
    </div>
  );
}

function MiniTable({ columns, rows, footnote, scroll }: { columns: string[]; rows: (string | number)[][]; footnote?: string; scroll?: boolean }) {
  return (
    <div>
      <div className={`rounded-lg border border-canvas-border overflow-x-auto ${scroll ? 'max-h-[260px] overflow-y-auto' : ''}`}>
        <table className="w-full text-[0.75rem]">
          <thead className="sticky top-0">
            <tr className="bg-paper-50 border-b border-canvas-border">
              {columns.map(c => <th key={c} className="text-left font-semibold text-ink-500 px-3 py-1.5 uppercase tracking-wide text-[0.625rem] whitespace-nowrap">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-b border-canvas-border/60 last:border-0">
                {r.map((cell, ci) => <td key={ci} className={`px-3 py-1.5 whitespace-nowrap tabular-nums ${ci === (columns[0] === '#' ? 1 : 0) ? 'font-mono font-semibold text-ink-800' : 'text-ink-600'}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && <p className="text-[0.625rem] text-ink-400 mt-1.5">{footnote}</p>}
    </div>
  );
}
