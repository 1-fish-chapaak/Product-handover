/**
 * Adapt standard library — the step between "files chosen" and "build".
 * Same rhythm as Audit with AI: Ira profiles the files, then shows its plan —
 * which file feeds each workflow, what's still missing, and the coverage the
 * batch adds — before anything is built. "Build N workflows" hands the batch
 * to Ask IRA, which builds them all and opens each for review in its own
 * session.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleDashed, Database, FileUp, Loader2 } from 'lucide-react';
import { Button } from '../shared/Button';
import { StepRail } from '../audit/sox-testing/ScopingWizard';
import { useAuditLog } from '../../context/AdminDataContext';
import type { ProcessCode } from '../../data/engagements';
import {
  CHECK_CATALOG, PROCESS_LONG, catalogFor, createBatch, filesForEntry, hash01, isStdLive, itemsFromEntries,
  type CatalogEntry, type FileSourceChoice, type PlanCoverage,
} from '../../data/auditPlan';
import { CoverageMeter, IraMark } from './PlanParts';

interface Props {
  keys: string[];
  choices: Record<string, FileSourceChoice | null>;
  onBack: () => void;
  onBuild: (batchId: string) => void;
}

const STEPS = ['Your data', "Ira's plan", 'Build'] as const;
const PROCESS_ORDER: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'INV', 'ITGC'];

const sourceOf = (c: FileSourceChoice | null | undefined) => (c && c.kind !== 'skip' ? c.name : null);

function coverageWith(process: ProcessCode, addedKeys: string[]): PlanCoverage {
  const universe = catalogFor(process);
  const before = universe.filter(e => e.automatable && (e.existingWorkflowId || isStdLive(e.key))).length;
  const after = before + universe.filter(e => addedKeys.includes(e.key) && !isStdLive(e.key)).length;
  const pct = (n: number) => Math.round((n / Math.max(1, universe.length)) * 100);
  return { universe: universe.length, before, after, beforePct: pct(before), afterPct: pct(after), liftPts: pct(after) - pct(before) };
}

export default function AdaptStandardView({ keys, choices, onBack, onBuild }: Props) {
  const logEvent = useAuditLog();
  const reduced = useReducedMotion();
  const entries = useMemo(
    () => keys.map(k => CHECK_CATALOG.find(e => e.key === k)).filter((e): e is CatalogEntry => !!e),
    [keys],
  );
  const [stage, setStage] = useState<'analysing' | 'plan'>('analysing');
  const [included, setIncluded] = useState<Set<string>>(() => new Set(keys));
  const [open, setOpen] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const missingFor = (e: CatalogEntry) => filesForEntry(e).filter(f => !sourceOf(choices[f.id]));
  const chosen = entries.filter(e => included.has(e.key));
  const covered = chosen.filter(e => missingFor(e).length === 0);
  const processes = PROCESS_ORDER.filter(p => entries.some(e => e.process === p));

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [stage]);

  const build = () => {
    const items = itemsFromEntries(chosen, choices);
    const batchId = createBatch({
      title: `Adapting ${items.length} standard workflow${items.length === 1 ? '' : 's'}`,
      origin: 'adapt',
      items,
    });
    logEvent({ action: 'Create', description: `Building ${items.length} adapted standard workflow(s)`, module: 'Control Library', entity: 'Workflow' });
    onBuild(batchId);
  };

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-white">
      <div className="max-w-[64rem] mx-auto px-6 md:px-10 pt-8 pb-32">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-ink-500 hover:text-brand-700 font-medium mb-5 cursor-pointer">
          <ArrowLeft size={14} /> Control Library
        </button>
        <header className="flex items-start gap-4 mb-6">
          <IraMark size={40} />
          <div>
            <div className="font-mono text-[0.6875rem] text-ink-500">Adapt standard library</div>
            <h1 className="font-serif text-[2.125rem] tracking-tight text-ink-900 leading-[1.15]">Fit the standard workflows to your data</h1>
            <p className="text-[0.875rem] text-ink-500 mt-1 max-w-[44rem]">
              Ira reads your files once and maps them into every selected workflow. Check the plan, then build them all — each one opens for review in its own session.
            </p>
          </div>
        </header>
        <StepRail steps={STEPS} step={stage === 'analysing' ? 0 : 1} onStepClick={i => { if (i === 0) onBack(); }} />

        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            {stage === 'analysing' ? (
              <Analysing entries={entries} choices={choices} onDone={() => setStage('plan')} />
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-3 mb-6">
                  <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
                    <div className="text-[0.75rem] font-medium text-ink-600 mb-2">Ira will build</div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { v: chosen.length, l: 'workflows' },
                        { v: covered.length, l: 'fully covered' },
                        { v: chosen.length - covered.length, l: 'will ask for data' },
                      ].map(k => (
                        <div key={k.l}>
                          <div className="font-mono tabular-nums text-[1.5rem] font-semibold text-ink-900 leading-none">{k.v}</div>
                          <div className="mt-1 text-[0.6875rem] text-ink-500">{k.l}</div>
                        </div>
                      ))}
                    </div>
                    {chosen.length > covered.length && (
                      <p className="mt-3 text-[0.75rem] text-ink-600">Workflows missing a file are still built; their session asks for it.</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4 space-y-3">
                    {processes.map(p => (
                      <CoverageMeter
                        key={p}
                        compact
                        label={`${p} · ${PROCESS_LONG[p]}`}
                        coverage={coverageWith(p, chosen.filter(e => e.process === p).map(e => e.key))}
                      />
                    ))}
                  </div>
                </div>

                {processes.map(p => {
                  const rows = entries.filter(e => e.process === p);
                  return (
                    <section key={p} className="mb-5">
                      <h2 className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-[0.75rem] font-semibold text-ink-900">{p}</span>
                        <span className="text-[0.875rem] font-medium text-ink-800">{PROCESS_LONG[p]}</span>
                        <span className="text-[0.75rem] text-ink-400 tabular-nums">{rows.length}</span>
                      </h2>
                      <ul className="rounded-lg border border-canvas-border divide-y divide-canvas-border">
                        {rows.map(e => {
                          const files = filesForEntry(e);
                          const missing = missingFor(e);
                          const isIn = included.has(e.key);
                          const isOpen = open === e.key;
                          return (
                            <li key={e.key} className={isIn ? '' : 'opacity-50'}>
                              <div className="flex items-center gap-3 px-3 h-12">
                                <button
                                  role="checkbox"
                                  aria-checked={isIn}
                                  aria-label={`Include ${e.checkName}`}
                                  onClick={() => setIncluded(s => { const n = new Set(s); if (n.has(e.key)) n.delete(e.key); else n.add(e.key); return n; })}
                                  className={`size-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${isIn ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300'}`}
                                >
                                  {isIn && <Check size={11} strokeWidth={3} />}
                                </button>
                                <button onClick={() => setOpen(isOpen ? null : e.key)} aria-expanded={isOpen} className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer">
                                  <ChevronRight size={14} className={`text-ink-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                                  <span className="font-mono text-[0.75rem] text-ink-500 w-[4.5rem] shrink-0">{e.controlId}</span>
                                  <span className="text-[0.8125rem] font-medium text-ink-900 truncate">{e.checkName}</span>
                                </button>
                                <span className="hidden md:flex items-center gap-1 shrink-0">
                                  {files.map(f => {
                                    const src = sourceOf(choices[f.id]);
                                    return (
                                      <span
                                        key={f.id}
                                        title={src ? `${f.code} ← ${src}` : `${f.code} not provided`}
                                        className={`inline-flex items-center h-6 px-1.5 rounded font-mono text-[0.6875rem] ${src ? 'bg-paper-100 text-ink-700' : 'bg-risk-50 text-risk-700'}`}
                                      >
                                        {f.code}
                                      </span>
                                    );
                                  })}
                                </span>
                                <span className="shrink-0 w-[9.5rem] text-right">
                                  {missing.length === 0
                                    ? <span className="inline-flex items-center gap-1 text-[0.75rem] text-compliant-700"><Check size={12} />Fully covered</span>
                                    : <span className="inline-flex items-center gap-1 text-[0.75rem] text-mitigated-700"><CircleDashed size={12} />Will ask for {missing[0].code}</span>}
                                </span>
                              </div>
                              {isOpen && (
                                <div className="px-3 pb-3 pl-[3.25rem] grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mb-1">Inputs</div>
                                    <ul className="space-y-1">
                                      {files.map(f => {
                                        const c = choices[f.id];
                                        const src = sourceOf(c);
                                        const conf = 88 + Math.round(hash01(f.id + e.key) * 11);
                                        return (
                                          <li key={f.id} className="flex items-center gap-2 text-[0.75rem]">
                                            <span className="font-mono font-semibold text-ink-800 w-16 shrink-0">{f.code}</span>
                                            {src ? (
                                              <>
                                                {c?.kind === 'upload' ? <FileUp size={11} className="text-brand-600 shrink-0" /> : <Database size={11} className="text-compliant-700 shrink-0" />}
                                                <span className="text-ink-700 truncate">{src}</span>
                                                <span className="ml-auto font-mono tabular-nums text-ink-500 shrink-0">{conf}% match</span>
                                              </>
                                            ) : (
                                              <span className="text-risk-700">Not provided — the session will ask</span>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                  <div>
                                    <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mb-1">What it tests</div>
                                    <p className="text-[0.75rem] text-ink-600 leading-relaxed">{e.checkDescription}</p>
                                    <p className="mt-1 text-[0.75rem] text-ink-500">Standard defaults: last 12 months · ±2% tolerance · runs {e.cadence.toLowerCase()}.</p>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {stage === 'plan' && (
        <div className="sticky bottom-0 z-10 border-t border-canvas-border bg-white/95 backdrop-blur-sm">
          <div className="max-w-[64rem] mx-auto px-6 md:px-10 h-16 flex items-center justify-between gap-4">
            <span className="text-[0.8125rem] text-ink-500 tabular-nums truncate">
              {chosen.length} workflow{chosen.length === 1 ? '' : 's'} · {covered.length} fully covered · each opens in its own review session
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" onClick={onBack}>Change files</Button>
              <button
                type="button"
                disabled={chosen.length === 0}
                onClick={build}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white text-[0.8125rem] font-semibold hover:opacity-95 disabled:opacity-40 cursor-pointer disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Build {chosen.length} workflow{chosen.length === 1 ? '' : 's'} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Analysing({ entries, choices, onDone }: { entries: CatalogEntry[]; choices: Record<string, FileSourceChoice | null>; onDone: () => void }) {
  const reduced = useReducedMotion();
  const files = Array.from(new Map(entries.flatMap(e => filesForEntry(e)).map(f => [f.id, f])).values());
  const provided = files.filter(f => sourceOf(choices[f.id]));
  const steps = [
    ...provided.slice(0, 4).map(f => `Profiling ${f.code} — ${sourceOf(choices[f.id])}${f.rows && choices[f.id]?.kind === 'source' ? ` (${f.rows})` : ''}`),
    ...(provided.length > 4 ? [`Profiling ${provided.length - 4} more file${provided.length - 4 === 1 ? '' : 's'}`] : []),
    `Mapping columns into ${entries.length} workflow${entries.length === 1 ? '' : 's'}`,
    files.length > provided.length ? `${files.length - provided.length} file${files.length - provided.length === 1 ? '' : 's'} not provided — those workflows will ask` : 'Every input is covered',
    'Sizing the coverage this adds',
  ];
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (done >= steps.length) {
      const t = window.setTimeout(onDone, reduced ? 50 : 350);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setDone(d => d + 1), reduced ? 100 : 550);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  return (
    <div className="max-w-[40rem] mx-auto mt-8 rounded-lg border border-canvas-border bg-canvas-elevated p-6" aria-live="polite">
      <div className="flex items-center gap-3 mb-4">
        <IraMark size={28} />
        <div>
          <div className="text-[0.9375rem] font-semibold text-ink-900">Ira is reading your data</div>
          <div className="text-[0.75rem] text-ink-500">{entries.length} workflows · {files.length} input files</div>
        </div>
      </div>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-start gap-2.5 text-[0.8125rem] ${i < done ? 'text-ink-700' : i === done ? 'text-ink-900 font-medium' : 'text-ink-300'}`}>
            <span className="mt-0.5 size-4 flex items-center justify-center shrink-0">
              {i < done ? <Check size={14} className="text-compliant-700" /> : i === done ? <Loader2 size={14} className="animate-spin text-brand-600" /> : <span className="size-1.5 rounded-full bg-ink-300" />}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
