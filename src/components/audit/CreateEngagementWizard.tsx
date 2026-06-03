import DatePicker from '../shared/DatePicker';
import { useMemo, useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronLeft, ChevronRight, ShieldCheck, ClipboardList, Zap,
  Check, AlertCircle, Edit3, Users, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import type { Engagement, EngType, AutomationSubtype, ProcessCode } from '../../data/engagements';
import { OWNER_NAMES, SUB_PROCESSES } from '../../data/grc-domain';

// ─── Styles ────────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-1.5 block';
const segActiveCls = 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20';
const segIdleCls = 'border-canvas-border bg-white text-ink-600 hover:bg-canvas';

// ─── Constants ─────────────────────────────────────────────────────────────
type UIProcess = ProcessCode | 'Cross';
const PROCESS_OPTIONS: UIProcess[] = ['P2P', 'O2C', 'R2R', 'S2C', 'ITGC', 'Cross'];

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
type Priority = (typeof PRIORITIES)[number];
const PRIORITY_CLS: Record<Priority, string> = {
  Critical: 'bg-risk-50 text-risk-700 border-risk-100 ring-risk-500/30',
  High:     'bg-mitigated-50 text-mitigated-700 border-mitigated-100 ring-mitigated-500/30',
  Medium:   'bg-evidence-50 text-evidence-700 border-evidence-100 ring-evidence-500/30',
  Low:      'bg-compliant-50 text-compliant-700 border-compliant-100 ring-compliant-500/30',
};

const FRAMEWORKS = ['SOX ICFR', 'IFC', 'SOC 1', 'SOC 2', 'ISO 27001', 'GDPR', 'Custom'];
const RACM_VERSIONS = ['v3.2 — May 2025 (current)', 'v3.1 — Feb 2025', 'v3.0 — Nov 2024'];
const SAMPLING_METHODS = ['Random', 'Statistical', 'Business-rule', 'Manual upload'] as const;
type SamplingMethod = (typeof SAMPLING_METHODS)[number];

const SCOPE_LEVELS = ['Full process', 'Sub-process', 'Activity', 'Specific entity'] as const;
type ScopeLevel = (typeof SCOPE_LEVELS)[number];
const IDR_TEMPLATES = ['Standard Audit IDR', 'Light-touch Walkthrough', 'Forensic Deep-dive'];
const CADENCES = ['Weekly', 'Biweekly', 'Monthly'] as const;
type Cadence = (typeof CADENCES)[number];

const AUTOMATION_SUBTYPES: AutomationSubtype[] = ['CCM', 'Reconciliation', 'MIS', 'Forensic', 'Image Analytics', 'Custom'];
const AUTO_CADENCES = ['Ad-hoc', 'Hourly', 'Daily', 'Weekly'] as const;
type AutoCadence = (typeof AUTO_CADENCES)[number];
const INPUT_SOURCES = ['Excel', 'PDF', 'SQL'] as const;
type InputSource = (typeof INPUT_SOURCES)[number];

interface WorkflowTemplate { id: string; name: string; subtype: AutomationSubtype; description: string }
const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  { id: 'wt-1', name: 'AP Duplicate Detection',  subtype: 'CCM',            description: 'Daily scan over vendor, amount, invoice no., and date.' },
  { id: 'wt-2', name: 'Vendor Bank Recon',        subtype: 'Reconciliation', description: 'Three-way match across invoice, GRN, and bank statement.' },
  { id: 'wt-3', name: 'MIS Pack — Finance',       subtype: 'MIS',            description: 'Weekly MIS rollup for P&L, AR aging, and AP aging.' },
  { id: 'wt-4', name: 'Forensic — Round Numbers', subtype: 'Forensic',       description: 'Detect suspicious round-number postings near month-end.' },
];

const TYPE_TILES: { type: EngType; icon: JSX.Element; tagline: string; tint: string; ring: string; iconWrap: string }[] = [
  { type: 'Compliance',     icon: <ShieldCheck size={22} />,    tagline: 'Framework-driven control testing',                              tint: 'bg-brand-50/70 hover:bg-brand-50 text-brand-700 border-brand-100',           ring: 'ring-brand-500 ring-offset-2 ring-offset-canvas-elevated',     iconWrap: 'bg-brand-100 text-brand-700' },
  { type: 'Internal Audit', icon: <ClipboardList size={22} />,  tagline: 'Process audit aligned to RACM + SOPs',                          tint: 'bg-evidence-50/70 hover:bg-evidence-50 text-evidence-700 border-evidence-100', ring: 'ring-evidence-500 ring-offset-2 ring-offset-canvas-elevated',  iconWrap: 'bg-evidence-100 text-evidence-700' },
  { type: 'Automation',     icon: <Zap size={22} />,             tagline: 'Continuous monitoring / reconciliation / MIS / forensic',      tint: 'bg-compliant-50/70 hover:bg-compliant-50 text-compliant-700 border-compliant-100', ring: 'ring-compliant-500 ring-offset-2 ring-offset-canvas-elevated', iconWrap: 'bg-compliant-100 text-compliant-700' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
const genCode = () => `ENG-0${10 + Math.floor(Math.random() * 90)}`;
const rand4 = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const toggle = <T,>(arr: T[], v: T): T[] => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

// ─── Component ─────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  onCreated: (eng: Engagement) => void;
}

export default function CreateEngagementWizard({ onClose, onCreated }: Props): JSX.Element {
  const { addToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1
  const [type, setType] = useState<EngType | null>(null);

  // Step 2
  const [name, setName] = useState('');
  const [code, setCode] = useState(genCode());
  const [description, setDescription] = useState('');
  const [process, setProcess] = useState<UIProcess>('P2P');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [owner, setOwner] = useState(OWNER_NAMES[0]);
  const [reviewer, setReviewer] = useState(OWNER_NAMES[1]);
  const [priority, setPriority] = useState<Priority>('Medium');

  // Step 3 — Compliance
  const [framework, setFramework] = useState(FRAMEWORKS[0]);
  const [racmVersion, setRacmVersion] = useState(RACM_VERSIONS[0]);
  const [samplingMethod, setSamplingMethod] = useState<SamplingMethod>('Random');
  const [sampleSize, setSampleSize] = useState(25);
  const [materiality, setMateriality] = useState(500000);

  // Step 3 — Internal Audit
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>('Full process');
  const [subProcessSel, setSubProcessSel] = useState<string[]>([]);
  const [linkedRacms, setLinkedRacms] = useState<string[]>([RACM_VERSIONS[0]]);
  const [linkedSops, setLinkedSops] = useState<string[]>([]);
  const [tatDays, setTatDays] = useState(30);
  const [idrTemplate, setIdrTemplate] = useState(IDR_TEMPLATES[0]);
  const [cadence, setCadence] = useState<Cadence>('Biweekly');

  // Step 3 — Automation
  const [autoSubtype, setAutoSubtype] = useState<AutomationSubtype>('CCM');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [inputSources, setInputSources] = useState<InputSource[]>(['Excel']);
  const [autoCadence, setAutoCadence] = useState<AutoCadence>('Daily');
  const [threshold, setThreshold] = useState(0.85);
  const [alertRecipients, setAlertRecipients] = useState<string[]>([OWNER_NAMES[0]]);

  // Step 4
  const [coOwners, setCoOwners] = useState<string[]>([]);
  const [auditors, setAuditors] = useState<string[]>([]);
  const [riskOwners, setRiskOwners] = useState<string[]>([]);
  const [reviewers, setReviewers] = useState<string[]>([]);
  const [viewers, setViewers] = useState<string[]>([]);

  // Review collapsibles
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ type: true, basics: true, typeSpec: true, team: true });
  const toggleSection = (k: string) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  const sopSuggestions = useMemo(() => {
    const subs = SUB_PROCESSES[process === 'Cross' ? 'P2P' : process] ?? [];
    return subs.slice(0, 3).map(s => `${s} SOP v1.2`);
  }, [process]);

  useMemo(() => {
    if (linkedSops.length === 0 && sopSuggestions.length > 0) setLinkedSops(sopSuggestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sopSuggestions.join('|')]);

  const subProcessOptions = useMemo(() => SUB_PROCESSES[process === 'Cross' ? 'P2P' : process] ?? [], [process]);

  // Validation
  const reviewerInvalid = reviewer === owner;
  const step2Valid = name.trim().length > 0 && code.trim().length > 0 && periodStart !== '' && periodEnd !== '' && periodStart <= periodEnd && !reviewerInvalid;
  let step3Valid = true;
  if (type === 'Compliance')          step3Valid = framework !== '' && racmVersion !== '' && (samplingMethod === 'Manual upload' || sampleSize > 0);
  else if (type === 'Internal Audit') step3Valid = linkedRacms.length > 0 && tatDays > 0;
  else if (type === 'Automation')     step3Valid = inputSources.length > 0 && alertRecipients.length > 0;

  const canAdvanceFrom: Record<1 | 2 | 3 | 4 | 5, boolean> = { 1: type !== null, 2: step2Valid, 3: step3Valid, 4: true, 5: true };

  const goToStep = (target: 1 | 2 | 3 | 4 | 5) => {
    if (target <= step) { setStep(target); return; }
    for (let i = step; i < target; i++) if (!canAdvanceFrom[i as 1 | 2 | 3 | 4 | 5]) return;
    setStep(target);
  };
  const nextStep = () => { if (canAdvanceFrom[step] && step < 5) setStep((step + 1) as 1 | 2 | 3 | 4 | 5); };
  const prevStep = () => { if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4 | 5); };

  const buildEngagement = (status: 'Draft' | 'Active'): Engagement => ({
    id: `eng-new-${Date.now()}`,
    code: `ENG-NEW-${rand4()}`,
    name: name.trim(),
    description: description.trim(),
    type: type ?? 'Compliance',
    subtype: type === 'Automation' ? autoSubtype : undefined,
    process: (process === 'Cross' ? 'P2P' : process) as ProcessCode,
    framework: type === 'Compliance' ? framework : 'Internal Policy',
    owner,
    status,
    periodStart: periodStart || 'TBD',
    periodEnd: periodEnd || 'TBD',
    controls: 0,
    health: 0,
    openIssues: 0,
    lastActivity: 'Not started',
    nextScheduled: 'TBD',
  });

  const submit = (status: 'Draft' | 'Active') => {
    const eng = buildEngagement(status);
    addToast({ message: status === 'Draft' ? `"${eng.name}" saved as Draft` : `"${eng.name}" created & activated`, type: 'success' });
    onCreated(eng);
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="Create Engagement"
      >
        {/* Header */}
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-brand-600 shrink-0" />
                <h2 className="font-display text-[1.125rem] font-semibold text-ink-900 tracking-tight">Create Engagement</h2>
              </div>
              <p className="text-[0.75rem] text-ink-500">Step {step} of 5</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close drawer"><X size={16} /></button>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => goToStep(n as 1 | 2 | 3 | 4 | 5)}
                className={`flex-1 h-1.5 rounded-full transition-colors ${n === step ? 'bg-brand-600' : n < step ? 'bg-brand-300' : 'bg-canvas-border'} ${n <= step ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
                aria-label={`Go to step ${n}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1.5 text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wider">
            {(['Type', 'Basics', 'Details', 'Team', 'Review'] as const).map((lbl, i) => (
              <span key={lbl} className={step === i + 1 ? 'text-brand-700' : ''}>{lbl}</span>
            ))}
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            >
              {/* ═══ STEP 1: TYPE ═══ */}
              {step === 1 && (
                <div>
                  <h3 className="text-[0.875rem] font-semibold text-ink-900 mb-1">Pick an engagement type</h3>
                  <p className="text-[0.75rem] text-ink-500 mb-4">Determines the workflow, configuration screens, and exit criteria.</p>
                  <div className="space-y-3">
                    {TYPE_TILES.map(t => {
                      const selected = type === t.type;
                      return (
                        <button
                          key={t.type}
                          onClick={() => setType(t.type)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${t.tint} ${selected ? `ring-2 ${t.ring} border-transparent` : ''}`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${t.iconWrap}`}>{t.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[0.875rem] font-semibold">{t.type}</div>
                              {selected && <Check size={16} className="shrink-0" />}
                            </div>
                            <p className="text-[0.75rem] opacity-80 mt-0.5">{t.tagline}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═══ STEP 2: BASICS ═══ */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Engagement name <span className="text-risk-700">*</span></label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. P2P — SOX Q3 Testing" className={inputCls} />
                    {name.trim().length === 0 && <Hint text="Name is required" />}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Code</label>
                      <input type="text" value={code} onChange={e => setCode(e.target.value)} className={`${inputCls} font-mono uppercase`} />
                    </div>
                    <div>
                      <label className={labelCls}>Priority</label>
                      <div className="flex gap-1.5">
                        {PRIORITIES.map(p => (
                          <button key={p} onClick={() => setPriority(p)}
                            className={`flex-1 px-2 py-2 rounded-lg border text-[0.6875rem] font-bold uppercase tracking-wide transition-all cursor-pointer ${priority === p ? `${PRIORITY_CLS[p]} ring-2` : segIdleCls}`}>
                            {p[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="One-line description of scope and intent." className={inputCls + ' resize-none'} />
                  </div>
                  <div>
                    <label className={labelCls}>Process</label>
                    <div className="grid grid-cols-6 gap-1.5">
                      {PROCESS_OPTIONS.map(p => (
                        <button key={p} onClick={() => setProcess(p)}
                          className={`px-2 py-2 rounded-lg border text-[0.6875rem] font-bold transition-all cursor-pointer ${process === p ? segActiveCls : segIdleCls}`}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Period start <span className="text-risk-700">*</span></label>
                      <DatePicker value={periodStart} onChange={e => setPeriodStart(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Period end <span className="text-risk-700">*</span></label>
                      <DatePicker value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {periodStart && periodEnd && periodStart > periodEnd && <Hint text="End must be after start" />}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Owner <span className="text-risk-700">*</span></label>
                      <select value={owner} onChange={e => setOwner(e.target.value)} className={selectCls}>
                        {OWNER_NAMES.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Reviewer <span className="text-risk-700">*</span></label>
                      <select value={reviewer} onChange={e => setReviewer(e.target.value)}
                        className={`${selectCls} ${reviewerInvalid ? 'border-risk focus:border-risk focus:ring-risk/10' : ''}`}>
                        {OWNER_NAMES.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {reviewerInvalid && <Hint text="Reviewer must differ from owner" />}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ STEP 3: TYPE-SPECIFIC ═══ */}
              {step === 3 && type === 'Compliance' && (
                <div className="space-y-4">
                  <SectionTitle title="Compliance configuration" subtitle="Framework, RACM, sampling, and materiality" />
                  <Field label="Framework">
                    <select value={framework} onChange={e => setFramework(e.target.value)} className={selectCls}>
                      {FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>
                  <Field label="RACM version">
                    <select value={racmVersion} onChange={e => setRacmVersion(e.target.value)} className={selectCls}>
                      {RACM_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Sampling method">
                    <div className="grid grid-cols-2 gap-2">
                      {SAMPLING_METHODS.map(s => (
                        <RadioCard key={s} label={s} selected={samplingMethod === s} onChange={() => setSamplingMethod(s)} />
                      ))}
                    </div>
                  </Field>
                  {samplingMethod !== 'Manual upload' && (
                    <Field label="Sample size">
                      <input type="number" min={1} value={sampleSize} onChange={e => setSampleSize(parseInt(e.target.value) || 0)} className={inputCls} />
                    </Field>
                  )}
                  <Field label="Materiality threshold">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.8125rem] text-ink-500 pointer-events-none">{'₹'}</span>
                      <input type="number" min={0} value={materiality} onChange={e => setMateriality(parseInt(e.target.value) || 0)} className={inputCls + ' pl-7'} />
                    </div>
                  </Field>
                  <div className="rounded-lg border border-border-light bg-canvas/60 p-3">
                    <div className={labelCls + ' mb-1.5'}>Sign-off chain</div>
                    <div className="flex items-center gap-2 text-[0.75rem] text-ink-700">
                      <span className="font-semibold">{owner}</span>
                      <ChevronRight size={12} className="text-ink-400" />
                      <span className="font-semibold">{reviewer}</span>
                      <ChevronRight size={12} className="text-ink-400" />
                      <span className="text-ink-500">Audit Committee</span>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && type === 'Internal Audit' && (
                <div className="space-y-4">
                  <SectionTitle title="Internal Audit configuration" subtitle="Scope, linked artefacts, and cadence" />
                  <Field label="Scope level">
                    <div className="grid grid-cols-2 gap-2">
                      {SCOPE_LEVELS.map(s => (
                        <RadioCard key={s} label={s} selected={scopeLevel === s} onChange={() => setScopeLevel(s)} />
                      ))}
                    </div>
                  </Field>
                  <Field label="Sub-processes">
                    <div className="flex flex-wrap gap-1.5">
                      {subProcessOptions.map(sp => (
                        <Chip key={sp} label={sp} selected={subProcessSel.includes(sp)} onToggle={() => setSubProcessSel(toggle(subProcessSel, sp))} />
                      ))}
                      {subProcessOptions.length === 0 && <span className="text-[0.6875rem] text-ink-400">No sub-processes for selected process</span>}
                    </div>
                  </Field>
                  <Field label="Linked RACMs">
                    <div className="space-y-1.5">
                      {RACM_VERSIONS.map(v => (
                        <label key={v} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-canvas-border bg-white text-[0.75rem] text-ink-700 cursor-pointer hover:bg-canvas">
                          <input type="checkbox" checked={linkedRacms.includes(v)} onChange={() => setLinkedRacms(toggle(linkedRacms, v))} className="accent-brand-500" />
                          {v}
                        </label>
                      ))}
                    </div>
                    {linkedRacms.length === 0 && <Hint text="Select at least one RACM" />}
                  </Field>
                  <Field label="Linked SOPs (auto-suggested)">
                    <div className="flex flex-wrap gap-1.5">
                      {sopSuggestions.map(s => (
                        <Chip key={s} label={s} selected={linkedSops.includes(s)} onToggle={() => setLinkedSops(toggle(linkedSops, s))} />
                      ))}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="TAT (days)">
                      <input type="number" min={1} value={tatDays} onChange={e => setTatDays(parseInt(e.target.value) || 0)} className={inputCls} />
                    </Field>
                    <Field label="IDR template">
                      <select value={idrTemplate} onChange={e => setIdrTemplate(e.target.value)} className={selectCls}>
                        {IDR_TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Reporting cadence">
                    <div className="grid grid-cols-3 gap-2">
                      {CADENCES.map(c => (
                        <RadioCard key={c} label={c} selected={cadence === c} onChange={() => setCadence(c)} centered />
                      ))}
                    </div>
                  </Field>
                </div>
              )}

              {step === 3 && type === 'Automation' && (
                <div className="space-y-4">
                  <SectionTitle title="Automation configuration" subtitle="Subtype, templates, sources, cadence" />
                  <Field label="Subtype">
                    <select value={autoSubtype} onChange={e => setAutoSubtype(e.target.value as AutomationSubtype)} className={selectCls}>
                      {AUTOMATION_SUBTYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Workflow templates">
                    <div className="space-y-2">
                      {WORKFLOW_TEMPLATES.map(tpl => {
                        const added = selectedTemplates.includes(tpl.id);
                        return (
                          <div key={tpl.id} className="flex items-start gap-3 p-3 rounded-lg border border-canvas-border bg-white">
                            <div className="w-8 h-8 rounded-lg bg-compliant-50 text-compliant-700 flex items-center justify-center shrink-0"><Zap size={14} /></div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[0.8125rem] font-semibold text-ink-900">{tpl.name}</div>
                              <p className="text-[0.6875rem] text-ink-500 mt-0.5">{tpl.description}</p>
                            </div>
                            <button
                              onClick={() => setSelectedTemplates(toggle(selectedTemplates, tpl.id))}
                              className={`shrink-0 px-3 py-1.5 rounded-lg text-[0.6875rem] font-semibold transition-colors cursor-pointer ${added ? 'bg-compliant-50 text-compliant-700 border border-compliant-100' : 'bg-brand-600 hover:bg-brand-500 text-white'}`}>
                              {added ? 'Added' : 'Add'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Input sources">
                    <div className="flex gap-2">
                      {INPUT_SOURCES.map(src => (
                        <Chip key={src} label={src} selected={inputSources.includes(src)} onToggle={() => setInputSources(toggle(inputSources, src))} />
                      ))}
                    </div>
                    {inputSources.length === 0 && <Hint text="Select at least one input source" />}
                  </Field>
                  <Field label="Cadence">
                    <div className="grid grid-cols-4 gap-2">
                      {AUTO_CADENCES.map(c => (
                        <RadioCard key={c} label={c} selected={autoCadence === c} onChange={() => setAutoCadence(c)} centered />
                      ))}
                    </div>
                  </Field>
                  <Field label="Detection threshold">
                    <div className="flex items-center gap-3">
                      <input type="range" min={0.5} max={1} step={0.01} value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))} className="flex-1 accent-brand-500" />
                      <span className="w-12 text-right text-[0.875rem] font-bold text-ink-900 tabular-nums">{(threshold * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-[0.6875rem] text-ink-500 mt-1.5">Minimum confidence required to raise an exception. Higher = fewer false positives.</p>
                  </Field>
                  <Field label="Alert recipients">
                    <div className="flex flex-wrap gap-1.5">
                      {OWNER_NAMES.map(n => (
                        <Chip key={n} label={n} selected={alertRecipients.includes(n)} onToggle={() => setAlertRecipients(toggle(alertRecipients, n))} />
                      ))}
                    </div>
                    {alertRecipients.length === 0 && <Hint text="Select at least one recipient" />}
                  </Field>
                </div>
              )}

              {/* ═══ STEP 4: TEAM ═══ */}
              {step === 4 && (
                <div className="space-y-4">
                  <SectionTitle title="Team & permissions" subtitle="Co-owners, auditors, risk owners, reviewers, viewers" />
                  <Field label="Owner (primary)">
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-canvas-border bg-canvas/60">
                      <div className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ink-800">
                        <Users size={14} className="text-brand-600" />
                        {owner}
                      </div>
                      <button onClick={() => setStep(2)} className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer">
                        <Edit3 size={11} /> Edit
                      </button>
                    </div>
                  </Field>
                  <ChipPicker label="Co-owners" options={OWNER_NAMES.filter(n => n !== owner)} selected={coOwners} onChange={setCoOwners} />
                  <ChipPicker label="Auditors" options={OWNER_NAMES} selected={auditors} onChange={setAuditors} />
                  <ChipPicker label="Risk owners" helper="Multiple risk owners get notifications; primary is the first." options={OWNER_NAMES} selected={riskOwners} onChange={setRiskOwners} />
                  <ChipPicker label="Reviewers" options={OWNER_NAMES.filter(n => n !== owner)} selected={reviewers} onChange={setReviewers} />
                  <ChipPicker label="Read-only viewers" options={OWNER_NAMES} selected={viewers} onChange={setViewers} />
                </div>
              )}

              {/* ═══ STEP 5: REVIEW ═══ */}
              {step === 5 && (
                <div className="space-y-3">
                  <SectionTitle title="Review & create" subtitle="Confirm details before submitting" />
                  <ReviewSection title="Type" open={openSections.type} onToggle={() => toggleSection('type')}>
                    <ReviewRow k="Type" v={type ?? '—'} />
                  </ReviewSection>
                  <ReviewSection title="Basics" open={openSections.basics} onToggle={() => toggleSection('basics')}>
                    <ReviewRow k="Name" v={name || '—'} />
                    <ReviewRow k="Code" v={<span className="font-mono">{code}</span>} />
                    <ReviewRow k="Process" v={process} />
                    <ReviewRow k="Period" v={`${periodStart || '—'} → ${periodEnd || '—'}`} />
                    <ReviewRow k="Owner" v={owner} />
                    <ReviewRow k="Reviewer" v={reviewer} />
                    <ReviewRow k="Priority" v={priority} />
                    {description && <ReviewRow k="Description" v={description} />}
                  </ReviewSection>
                  <ReviewSection title={`${type ?? 'Type'} configuration`} open={openSections.typeSpec} onToggle={() => toggleSection('typeSpec')}>
                    {type === 'Compliance' && (
                      <>
                        <ReviewRow k="Framework" v={framework} />
                        <ReviewRow k="RACM version" v={racmVersion} />
                        <ReviewRow k="Sampling" v={samplingMethod} />
                        {samplingMethod !== 'Manual upload' && <ReviewRow k="Sample size" v={String(sampleSize)} />}
                        <ReviewRow k="Materiality" v={`₹ ${materiality.toLocaleString('en-IN')}`} />
                      </>
                    )}
                    {type === 'Internal Audit' && (
                      <>
                        <ReviewRow k="Scope" v={scopeLevel} />
                        <ReviewRow k="Sub-processes" v={subProcessSel.length ? subProcessSel.join(', ') : '—'} />
                        <ReviewRow k="Linked RACMs" v={linkedRacms.join(', ') || '—'} />
                        <ReviewRow k="Linked SOPs" v={linkedSops.join(', ') || '—'} />
                        <ReviewRow k="TAT" v={`${tatDays} days`} />
                        <ReviewRow k="IDR template" v={idrTemplate} />
                        <ReviewRow k="Cadence" v={cadence} />
                      </>
                    )}
                    {type === 'Automation' && (
                      <>
                        <ReviewRow k="Subtype" v={autoSubtype} />
                        <ReviewRow k="Templates" v={selectedTemplates.length ? `${selectedTemplates.length} selected` : 'None'} />
                        <ReviewRow k="Sources" v={inputSources.join(', ') || '—'} />
                        <ReviewRow k="Cadence" v={autoCadence} />
                        <ReviewRow k="Threshold" v={`${(threshold * 100).toFixed(0)}%`} />
                        <ReviewRow k="Alert recipients" v={alertRecipients.length ? `${alertRecipients.length} people` : '—'} />
                      </>
                    )}
                  </ReviewSection>
                  <ReviewSection title="Team" open={openSections.team} onToggle={() => toggleSection('team')}>
                    <ReviewRow k="Co-owners" v={coOwners.join(', ') || '—'} />
                    <ReviewRow k="Auditors" v={auditors.join(', ') || '—'} />
                    <ReviewRow k="Risk owners" v={riskOwners.join(', ') || '—'} />
                    <ReviewRow k="Reviewers" v={reviewers.join(', ') || '—'} />
                    <ReviewRow k="Viewers" v={viewers.join(', ') || '—'} />
                  </ReviewSection>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-between gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={prevStep} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">
                <ChevronLeft size={14} /> Back
              </button>
            )}
            {step < 5 && (
              <button onClick={nextStep} disabled={!canAdvanceFrom[step]}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                Next <ChevronRight size={14} />
              </button>
            )}
            {step === 5 && (
              <>
                <button onClick={() => submit('Draft')} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-semibold text-ink-700 hover:bg-canvas transition-colors cursor-pointer">Create as Draft</button>
                <button onClick={() => submit('Active')} className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">Create &amp; Activate</button>
              </>
            )}
          </div>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function Hint({ text }: { text: string }) {
  return <div className="mt-1 flex items-center gap-1 text-[0.75rem] text-risk-700"><AlertCircle size={11} /> {text}</div>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-1">
      <h3 className="text-[0.875rem] font-semibold text-ink-900">{title}</h3>
      {subtitle && <p className="text-[0.75rem] text-ink-500">{subtitle}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelCls}>{label}</label>{children}</div>;
}

function RadioCard({ label, selected, onChange, centered }: { label: string; selected: boolean; onChange: () => void; centered?: boolean }) {
  return (
    <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[0.75rem] font-medium cursor-pointer transition-all ${selected ? segActiveCls : segIdleCls} ${centered ? 'justify-center' : ''}`}>
      <input type="radio" checked={selected} onChange={onChange} className="accent-brand-500" />
      {label}
    </label>
  );
}

function Chip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`px-2.5 py-1.5 rounded-full text-[0.75rem] font-medium border transition-all cursor-pointer ${selected ? segActiveCls : segIdleCls}`}>
      {label}
    </button>
  );
}

function ChipPicker({ label, helper, options, selected, onChange }: { label: string; helper?: string; options: string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {helper && <p className="text-[0.6875rem] text-ink-500 -mt-1 mb-1.5">{helper}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => <Chip key={o} label={o} selected={selected.includes(o)} onToggle={() => onChange(toggle(selected, o))} />)}
      </div>
    </div>
  );
}

function ReviewSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-canvas-border bg-white overflow-hidden">
      <button onClick={onToggle} className="w-full px-3 py-2.5 flex items-center justify-between text-left cursor-pointer hover:bg-canvas/60">
        <span className="text-[0.75rem] font-semibold text-ink-800">{title}</span>
        {open ? <ChevronUp size={14} className="text-ink-500" /> : <ChevronDown size={14} className="text-ink-500" />}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-canvas-border/60">{children}</div>}
    </div>
  );
}

function ReviewRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[0.75rem]">
      <span className="text-ink-500 shrink-0">{k}</span>
      <span className="text-ink-800 text-right min-w-0 break-words">{v}</span>
    </div>
  );
}
