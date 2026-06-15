import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Building2, Target, Layers, UserCheck, FileText, ShieldCheck } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useIcfr } from './store';
import { racmTemplate, TEMPLATE_ACCOUNTS } from './mockData';
import { formatINR } from './helpers';
import { cn } from '../../lib/cn';
import type { IcfrEngagement } from './types';

const STEPS = ['Engagement', 'Materiality', 'Scope', 'RACM', 'Owners', 'Review'] as const;
type Step = number;
const FRAMEWORKS = ['SOX 404 / ICFR', 'IFC (India)', 'JSOX', 'Internal'];
const PROCESSES = ['P2P', 'O2C', 'R2R'];
const PEOPLE = ['Rohit Sharma', 'Anita Rao', 'Sneha Joshi', 'Karan Mehta', 'Priya Nair'];

export default function SetupWizard() {
  const { createEngagement, back } = useIcfr();
  const { addToast } = useToast();
  const [step, setStep] = useState<Step>(0);

  const [name, setName] = useState('O2C — ICFR / SOX');
  const [code, setCode] = useState('ENG-NEW');
  const [entity, setEntity] = useState('Air India Express Ltd');
  const [framework, setFramework] = useState(FRAMEWORKS[0]!);
  const [periodStart, setPeriodStart] = useState('Apr 2025');
  const [periodEnd, setPeriodEnd] = useState('Mar 2026');
  const [period, setPeriod] = useState<'Interim' | 'Year-end'>('Interim');
  const [materiality, setMateriality] = useState(5_000_000);
  const [pm, setPm] = useState(3_750_000);
  const [process, setProcess] = useState('P2P');
  const [scope, setScope] = useState<Record<string, boolean>>(() => Object.fromEntries(TEMPLATE_ACCOUNTS.map(a => [a.id, a.inScope])));
  const [owners, setOwners] = useState<Record<string, string>>({});

  const controls = useMemo(() => racmTemplate(process), [process]);
  useEffect(() => { setOwners(Object.fromEntries(controls.map(c => [c.id, c.owner]))); }, [controls]);

  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1));
  const prev = () => (step === 0 ? back() : setStep(s => s - 1));

  const create = () => {
    const eng: IcfrEngagement = {
      id: 'icfr-new', code, name, entity, framework, periodStart, periodEnd, period,
      materiality, performanceMateriality: pm, preparer: 'You · Auditor', reviewer: 'Reviewer',
      accounts: TEMPLATE_ACCOUNTS.map(a => ({ ...a, inScope: scope[a.id] ?? a.inScope })),
      controls: controls.map(c => ({ ...c, owner: owners[c.id] ?? c.owner })),
      deficiencies: [], tasks: [],
    };
    createEngagement(eng);
    addToast({ type: 'success', title: 'Engagement created', message: `${eng.name} · ${eng.controls.length} controls scoped` });
  };

  const canNext = step === 3 ? controls.length > 0 : true;

  return (
    <div className="max-w-[820px] mx-auto space-y-5">
      <button onClick={back} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"><ArrowLeft size={14} /> Command center</button>
      <div>
        <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>New ICFR engagement</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Scope it once — materiality, accounts, RACM, owners — then test.</p>
      </div>

      {/* stepper */}
      <div className="flex items-center">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold', i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-200' : 'bg-paper-100 text-ink-400')}>{i < step ? <Check size={13} /> : i + 1}</span>
              <span className={cn('text-[11px] font-semibold whitespace-nowrap', i === step ? 'text-ink-800' : 'text-ink-400')}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <span className={cn('h-px flex-1 mx-2', i < step ? 'bg-brand-300' : 'bg-paper-200')} />}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5 min-h-[320px]">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
            {step === 0 && (
              <Section icon={<Building2 size={15} className="text-brand-600" />} title="Engagement">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></Field>
                  <Field label="Code"><input value={code} onChange={e => setCode(e.target.value)} className={inputCls} /></Field>
                  <Field label="Entity"><input value={entity} onChange={e => setEntity(e.target.value)} className={inputCls} /></Field>
                  <Field label="Framework"><select value={framework} onChange={e => setFramework(e.target.value)} className={inputCls}>{FRAMEWORKS.map(f => <option key={f}>{f}</option>)}</select></Field>
                  <Field label="Period start"><input value={periodStart} onChange={e => setPeriodStart(e.target.value)} className={inputCls} /></Field>
                  <Field label="Period end"><input value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className={inputCls} /></Field>
                  <Field label="Phase"><select value={period} onChange={e => setPeriod(e.target.value as 'Interim' | 'Year-end')} className={inputCls}><option>Interim</option><option>Year-end</option></select></Field>
                </div>
              </Section>
            )}
            {step === 1 && (
              <Section icon={<Target size={15} className="text-brand-600" />} title="Materiality" hint="Drives which accounts and controls fall in scope.">
                <div className="grid grid-cols-2 gap-3 max-w-[440px]">
                  <Field label="Overall materiality (₹)"><input type="number" value={materiality} onChange={e => setMateriality(Number(e.target.value) || 0)} className={inputCls} /></Field>
                  <Field label="Performance materiality (₹)"><input type="number" value={pm} onChange={e => setPm(Number(e.target.value) || 0)} className={inputCls} /></Field>
                </div>
                <p className="text-[12px] text-ink-500 mt-3">Overall {formatINR(materiality)} · performance {formatINR(pm)}</p>
              </Section>
            )}
            {step === 2 && (
              <Section icon={<Layers size={15} className="text-brand-600" />} title="Significant accounts" hint="Toggle which accounts are in scope.">
                <div className="space-y-2">
                  {TEMPLATE_ACCOUNTS.map(a => (
                    <label key={a.id} className="flex items-center gap-3 rounded-lg border border-canvas-border px-3 py-2.5 cursor-pointer hover:bg-paper-50">
                      <input type="checkbox" checked={scope[a.id] ?? a.inScope} onChange={e => setScope(p => ({ ...p, [a.id]: e.target.checked }))} className="accent-brand-600 w-4 h-4" />
                      <span className="text-[13px] font-medium text-ink-800 flex-1">{a.name}</span>
                      <span className="text-[12px] tabular-nums text-ink-500">{formatINR(a.balance)}</span>
                      <span className="text-[11px] text-ink-400">{a.assertions.join(' · ')}</span>
                    </label>
                  ))}
                </div>
              </Section>
            )}
            {step === 3 && (
              <Section icon={<FileText size={15} className="text-brand-600" />} title="RACM" hint="Pick a process — its key controls import as a template.">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[12px] text-ink-500">Process</span>
                  {PROCESSES.map(p => <button key={p} onClick={() => setProcess(p)} className={cn('h-8 px-3 rounded-md border text-[12.5px] font-semibold cursor-pointer', process === p ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-canvas-border text-ink-600 hover:bg-paper-50')}>{p}</button>)}
                  <span className="text-[12px] text-ink-400 ml-2">{controls.length} key controls</span>
                </div>
                {controls.length === 0 ? <p className="text-[12.5px] text-ink-400">No template for {process} yet — pick P2P.</p> : (
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                    {controls.map(c => <div key={c.id} className="rounded-lg border border-canvas-border px-3 py-2 text-[12.5px]"><span className="font-mono text-[11px] text-brand-700 mr-2">{c.id}</span>{c.description} <span className="text-ink-400">· {c.nature}</span></div>)}
                  </div>
                )}
              </Section>
            )}
            {step === 4 && (
              <Section icon={<UserCheck size={15} className="text-brand-600" />} title="Assign control owners" hint="Each owner gets the PBC requests in their portal.">
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {controls.map(c => (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg border border-canvas-border px-3 py-2">
                      <span className="font-mono text-[11px] text-brand-700 w-[78px] shrink-0">{c.id}</span>
                      <span className="text-[12.5px] text-ink-700 flex-1 min-w-0 truncate">{c.description}</span>
                      <select value={owners[c.id] ?? c.owner} onChange={e => setOwners(p => ({ ...p, [c.id]: e.target.value }))} className="h-8 px-2 rounded-md border border-canvas-border text-[12px] bg-white cursor-pointer shrink-0">
                        {[...new Set([c.owner, ...PEOPLE])].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {step === 5 && (
              <Section icon={<ShieldCheck size={15} className="text-brand-600" />} title="Review & create">
                <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
                  <Rev k="Engagement" v={`${name} (${code})`} />
                  <Rev k="Entity" v={entity} />
                  <Rev k="Framework" v={framework} />
                  <Rev k="Period" v={`${periodStart} – ${periodEnd} · ${period}`} />
                  <Rev k="Materiality" v={`${formatINR(materiality)} · PM ${formatINR(pm)}`} />
                  <Rev k="Accounts in scope" v={String(TEMPLATE_ACCOUNTS.filter(a => scope[a.id] ?? a.inScope).length)} />
                  <Rev k="Controls" v={`${controls.length} (${process})`} />
                  <Rev k="Owners" v={String(new Set(Object.values(owners)).size)} />
                </dl>
              </Section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={prev} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-semibold text-ink-600 hover:bg-paper-50 cursor-pointer transition-colors"><ArrowLeft size={15} /> {step === 0 ? 'Cancel' : 'Back'}</button>
        {step < STEPS.length - 1 ? (
          <button onClick={next} disabled={!canNext} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-600 text-white text-[13px] font-semibold hover:bg-brand-500 cursor-pointer disabled:bg-brand-100 disabled:text-brand-300 disabled:cursor-not-allowed transition-colors">Continue <ArrowRight size={15} /></button>
        ) : (
          <button onClick={create} className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg bg-brand-600 text-white text-[13px] font-semibold hover:bg-brand-500 cursor-pointer transition-colors"><Check size={15} /> Create engagement</button>
        )}
      </div>
    </div>
  );
}

const inputCls = 'w-full h-9 px-3 rounded-lg border border-canvas-border text-[13px] text-ink-800 bg-white focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50';

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink-900">{icon}{title}</h3>
      {hint && <p className="text-[12.5px] text-ink-500 mt-0.5 mb-4">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] font-semibold text-ink-500 mb-1">{label}</div>{children}</div>;
}
function Rev({ k, v }: { k: string; v: string }) {
  return <div className="rounded-lg border border-canvas-border px-3 py-2"><div className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold">{k}</div><div className="text-ink-800 font-medium mt-0.5">{v}</div></div>;
}
