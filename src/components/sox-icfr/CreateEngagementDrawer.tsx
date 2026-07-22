import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Building2, Check, ChevronRight, Database, FileSpreadsheet, Loader2, Lock,
  Rocket, ShieldCheck, Sparkles, Table2, UploadCloud, X,
} from 'lucide-react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import MaterialityWorksheet from './MaterialityWorksheet';
import { clearlyTrivialOf, formatINR, overallMateriality, performanceMaterialityOf, BENCHMARK_META } from './helpers';
import { racmTemplate, TEMPLATE_ACCOUNTS } from './mockData';
import { cn } from '../../lib/cn';
import type { Control, IcfrEngagement, MaterialityBasis } from './types';

/**
 * Create engagement — a right-side drawer that ends in "go live".
 * 1 · Source & entity — upload a RACM workbook and/or a one-month GL; the tool
 *     detects the entity (company code) and, from the GL, the benchmark amounts.
 * 2 · Materiality — the benchmark worksheet, prefilled from the GL (annualized).
 * 3 · Review & go live — materiality locks permanently at this moment.
 */

type Detection = {
  entity: string;
  companyCode: string;
  glPeriod: string;
  glRows: number;
  processes: string[];
  controls: number;
  from: ('racm' | 'gl')[];
};

// What the "parser" finds in the demo files — deterministic.
const DETECTED: Omit<Detection, 'from'> = {
  entity: 'Airline Group Ltd',
  companyCode: 'AG01',
  glPeriod: 'Apr 2026',
  glRows: 12480,
  processes: ['Procure to Pay', 'Order to Cash', 'Record to Report'],
  controls: 15,
};

// One-month GL figures → P&L annualized ×12, balance sheet as at month-end.
const GL_AMOUNTS = { assets: 1_020_000_000, revenue: 68_400_000 * 12, pbt: 6_150_000 * 12, cash: 96_000_000, equity: 410_000_000 };

const DEFAULT_BASIS = (source: string): MaterialityBasis => {
  const total = TEMPLATE_ACCOUNTS.filter(a => a.inScope).reduce((n, a) => n + a.balance, 0);
  return {
    benchmark: 'assets', amounts: GL_AMOUNTS, pct: 0.5, pmPct: 75, ctPct: 5, source,
    allocation: TEMPLATE_ACCOUNTS.filter(a => a.inScope).map(a => ({
      group: a.name, balance: a.balance, sharePct: Math.round((a.balance / total) * 100), allocated: 0,
    })),
  };
};

export default function CreateEngagementDrawer({ onClose }: { onClose: () => void }) {
  const { createEngagement } = useIcfr();
  const { addToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reading, setReading] = useState<'racm' | 'gl' | null>(null);
  const [uploads, setUploads] = useState<{ racm?: string; gl?: string }>({});
  const [detected, setDetected] = useState<Detection | null>(null);
  const [entity, setEntity] = useState('');
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<MaterialityBasis>(() => DEFAULT_BASIS('No GL uploaded — enter amounts on the worksheet'));
  const [goingLive, setGoingLive] = useState(false);
  const racmRef = useRef<HTMLInputElement>(null);
  const glRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !goingLive) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, goingLive]);

  const detect = (kind: 'racm' | 'gl', fileName: string) => {
    setUploads(prev => ({ ...prev, [kind]: fileName }));
    setReading(kind);
    window.setTimeout(() => {
      setReading(null);
      setDetected(prev => {
        const from = Array.from(new Set([...(prev?.from ?? []), kind]));
        return { ...DETECTED, from };
      });
      setEntity(e => e || DETECTED.entity);
      setName(n => n || `FY27 ICFR — ${DETECTED.entity}`);
      if (kind === 'gl') setBasis(b => ({ ...b, amounts: GL_AMOUNTS, source: `GL ${DETECTED.glPeriod} (${DETECTED.companyCode}) · P&L annualized ×12, balance sheet as at ${DETECTED.glPeriod}` }));
    }, 1700);
  };

  const onPick = (kind: 'racm' | 'gl') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) detect(kind, f.name);
  };

  const controls = useMemo<Control[]>(
    () => (detected?.processes ?? []).flatMap(p => racmTemplate(p).map(c => ({ ...c, id: `${p.slice(0, 1)}-${c.id}` }))),
    [detected],
  );

  const goLive = () => {
    if (!detected) return;
    setGoingLive(true);
    window.setTimeout(() => {
      const M = overallMateriality(basis);
      const eng: IcfrEngagement = {
        id: `eng-${Date.now().toString(36)}`, code: 'ICFR-27', name: name.trim() || `FY27 ICFR — ${entity}`,
        entity: entity.trim() || DETECTED.entity, framework: 'COSO 2013 / SOX 404',
        periodStart: '01 Apr 2026', periodEnd: '31 Mar 2027', period: 'Interim',
        materiality: M, performanceMateriality: performanceMaterialityOf(basis),
        preparer: 'You · Auditor', reviewer: 'J. Fernandes · Audit Manager',
        live: true, wentLiveAt: 'just now',
        entityDetected: { name: entity.trim() || DETECTED.entity, companyCode: detected.companyCode, source: detected.from.includes('gl') ? `GL upload · ${detected.glPeriod}` : 'RACM workbook upload' },
        materialityBasis: { ...basis, lockedAt: 'just now' },
        rules: { clearlyTrivial: clearlyTrivialOf(basis), sdBandPct: 20, aggregate: true, autoRoute: true, mwIndicators: [] },
        accounts: TEMPLATE_ACCOUNTS,
        controls, deficiencies: [], tasks: [], discussions: [], executions: [],
      };
      createEngagement(eng);
      addToast({ type: 'success', title: 'Engagement is live', message: `${eng.name} — materiality ${formatINR(M)} locked at go-live.` });
      onClose();
    }, 1800);
  };

  const stepChip = (n: 1 | 2 | 3, label: string) => (
    <span className={cn('inline-flex items-center gap-1.5 text-[11.5px] font-semibold', step === n ? 'text-brand-700' : step > n ? 'text-compliant-700' : 'text-ink-400')}>
      <span className={cn('w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[10px] font-bold', step === n ? 'bg-brand-600 text-white' : step > n ? 'bg-compliant-600 text-white' : 'bg-paper-100 text-ink-500')}>
        {step > n ? <Check size={10} strokeWidth={3} /> : n}
      </span>
      {label}
    </span>
  );

  const uploadTile = (kind: 'racm' | 'gl', title: string, hint: string, Icon: typeof Table2, ref: React.RefObject<HTMLInputElement | null>) => (
    <button onClick={() => ref.current?.click()} disabled={!!reading}
      className={cn('flex-1 rounded-xl border-2 border-dashed p-4 text-left transition-colors cursor-pointer disabled:opacity-60',
        uploads[kind] ? 'border-compliant-300 bg-compliant-50/30' : 'border-canvas-border hover:border-brand-300 hover:bg-brand-50/20')}>
      <span className="flex items-start gap-3">
        <span className={cn('w-9 h-9 rounded-lg inline-flex items-center justify-center shrink-0', uploads[kind] ? 'bg-compliant-100 text-compliant-700' : 'bg-paper-50 text-ink-500')}>
          {reading === kind ? <Loader2 size={17} className="animate-spin" /> : uploads[kind] ? <Check size={17} /> : <Icon size={17} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-ink-900">{title}</span>
          <span className="block text-[11.5px] text-ink-500 mt-0.5">{reading === kind ? 'Reading document…' : uploads[kind] ?? hint}</span>
        </span>
      </span>
    </button>
  );

  return createPortal(
    <div className="sox-book-ui fixed inset-0 z-50">
      <motion.div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { if (!goingLive) onClose(); }} />
      <motion.aside
        initial={{ x: 620 }} animate={{ x: 0 }} exit={{ x: 620 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="absolute right-0 top-0 bottom-0 w-[620px] max-w-full bg-canvas-elevated border-l border-canvas-border shadow-[-24px_0_60px_-30px_rgba(15,8,30,0.5)] flex flex-col">
        {/* header */}
        <div className="px-6 pt-5 pb-4 border-b border-canvas-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-ink-900" style={{ fontFamily: "'Source Serif 4', serif" }}>New SOX / ICFR engagement</h2>
            <button onClick={onClose} disabled={goingLive} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 disabled:opacity-30 cursor-pointer" aria-label="Close"><X size={15} /></button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            {stepChip(1, 'Source & entity')}
            <ChevronRight size={13} className="text-ink-300" />
            {stepChip(2, 'Materiality')}
            <ChevronRight size={13} className="text-ink-300" />
            {stepChip(3, 'Go live')}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-[12.5px] text-ink-500">Upload what you have — the tool reads it and detects the entity. The RACM workbook seeds the matrix; the one-month GL detects the entity <i>and</i> prefills the materiality benchmarks.</p>
              <input ref={racmRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onPick('racm')} aria-label="Upload RACM workbook" />
              <input ref={glRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onPick('gl')} aria-label="Upload one-month GL" />
              <div className="flex gap-3">
                {uploadTile('racm', 'RACM workbook', 'Risks, controls & test attributes (.xlsx / .csv)', Table2, racmRef)}
                {uploadTile('gl', 'One-month GL', 'Trial-balance level GL extract for any month', Database, glRef)}
              </div>

              {detected && !reading && (
                <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700"><Sparkles size={12} /> Detected from {detected.from.map(f => f === 'gl' ? 'the GL' : 'the RACM').join(' + ')}</div>
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-lg bg-brand-600 text-white inline-flex items-center justify-center shrink-0"><Building2 size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <input value={entity} onChange={e => setEntity(e.target.value)} aria-label="Entity name"
                        className="w-full h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[13.5px] font-semibold text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                      <div className="text-[11px] text-ink-500 mt-1">Company code <b className="font-mono">{detected.companyCode}</b>{detected.from.includes('gl') && <> · GL {detected.glPeriod} · {detected.glRows.toLocaleString()} lines</>} · edit if the detection is wrong</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[{ v: String(detected.processes.length), k: 'Processes' }, { v: String(controls.length), k: 'Controls seeded' }, { v: detected.from.includes('gl') ? '5' : '0', k: 'Benchmarks prefilled' }].map(s => (
                      <div key={s.k} className="rounded-lg bg-canvas-elevated border border-canvas-border py-2"><div className="text-[16px] font-bold tabular-nums text-ink-900">{s.v}</div><div className="text-[10px] text-ink-400 font-medium mt-0.5">{s.k}</div></div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {detected.processes.map(p => <span key={p} className="text-[10.5px] font-bold uppercase tracking-wide px-1.5 h-[18px] inline-flex items-center rounded bg-brand-100 text-brand-800">{p}</span>)}
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-ink-500 mb-1">Engagement name</div>
                    <input value={name} onChange={e => setName(e.target.value)} aria-label="Engagement name"
                      className="w-full h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-[12.5px] text-ink-500">Pick the benchmark and percentage — amounts are {uploads.gl ? <>prefilled from <b className="text-ink-700">{uploads.gl}</b> (annualized)</> : 'defaults; upload a GL in step 1 to prefill'}. Performance materiality and the clearly-trivial threshold derive from the overall figure.</p>
              <MaterialityWorksheet basis={basis} locked={false} onChange={setBasis} />
            </div>
          )}

          {step === 3 && detected && (
            <div className="space-y-4">
              <div className="rounded-xl border border-canvas-border overflow-hidden">
                {[
                  ['Engagement', name],
                  ['Entity', `${entity} · ${detected.companyCode}`],
                  ['Framework', 'COSO 2013 / SOX 404 · FY27'],
                  ['Scope', `${detected.processes.join(', ')} · ${controls.length} controls`],
                  ['Benchmark', `${BENCHMARK_META[basis.benchmark].label} · ${basis.pct}%`],
                  ['Overall materiality', formatINR(overallMateriality(basis))],
                  ['Performance materiality', `${formatINR(performanceMaterialityOf(basis))} · ${basis.pmPct}%`],
                  ['Clearly trivial', `${formatINR(clearlyTrivialOf(basis))} · ${basis.ctPct}%`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-canvas-border/60 last:border-0">
                    <span className="text-[12px] text-ink-500">{k}</span>
                    <span className="text-[12.5px] font-semibold text-ink-900 text-right">{v}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-high-200 bg-high-50/40 p-3.5 flex items-start gap-2.5">
                <Lock size={15} className="text-high-700 mt-0.5 shrink-0" />
                <p className="text-[12px] text-ink-700 leading-relaxed"><b>Materiality locks at go-live.</b> Overall, performance and clearly-trivial thresholds cannot be changed for the life of the engagement — every exception will be sized against these numbers. Re-check the worksheet before going live.</p>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-canvas-border flex items-center gap-2 shrink-0">
          {step > 1 && !goingLive && <button onClick={() => setStep(s => (s - 1) as 1 | 2)} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Back</button>}
          <div className="flex-1" />
          {step === 1 && (
            <button onClick={() => setStep(2)} disabled={!detected || !!reading}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer">
              Materiality <ChevronRight size={14} />
            </button>
          )}
          {step === 2 && (
            <button onClick={() => setStep(3)} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
              Review &amp; go live <ChevronRight size={14} />
            </button>
          )}
          {step === 3 && (
            <button onClick={goLive} disabled={goingLive}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-compliant-600 text-white text-[12.5px] font-semibold hover:bg-compliant-700 disabled:opacity-70 transition-colors cursor-pointer">
              {goingLive ? <><Loader2 size={14} className="animate-spin" /> Going live…</> : <><Rocket size={14} /> Go live — lock materiality</>}
            </button>
          )}
        </div>
        {goingLive && (
          <div className="absolute inset-0 bg-canvas-elevated/85 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3">
            <ShieldCheck size={26} className="text-compliant-600" />
            <div className="text-[14px] font-semibold text-ink-900">Locking materiality &amp; provisioning the engagement…</div>
            <div className="text-[12px] text-ink-500 inline-flex items-center gap-1.5"><FileSpreadsheet size={13} /> {controls.length} RACM rows · <UploadCloud size={13} /> {Object.values(uploads).filter(Boolean).length} source document{Object.values(uploads).filter(Boolean).length === 1 ? '' : 's'}</div>
          </div>
        )}
      </motion.aside>
    </div>,
    document.body,
  );
}
