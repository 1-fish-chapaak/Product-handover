import DatePicker from '../shared/DatePicker';
import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronLeft, ChevronRight, ShieldCheck, ClipboardList, Zap,
  Check, AlertCircle, Edit3, Users, Sparkles, ChevronDown, ChevronUp,
  Plus, Trash2, FileText, Loader2, CalendarClock,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import type {
  Engagement, EngType, AutomationSubtype, ProcessCode, EngagementMilestone,
} from '../../data/engagements';
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
  { type: 'SOX / ICFR',     icon: <ShieldCheck size={22} />,    tagline: 'SOX 404 / ICFR — scoping, materiality rules, design + operating effectiveness, deficiency evaluation', tint: 'bg-brand-50/70 hover:bg-brand-50 text-brand-700 border-brand-200',          ring: 'ring-brand-600 ring-offset-2 ring-offset-canvas-elevated',     iconWrap: 'bg-brand-600 text-white' },
  { type: 'Compliance',     icon: <ShieldCheck size={22} />,    tagline: 'Framework-driven control testing',                              tint: 'bg-brand-50/70 hover:bg-brand-50 text-brand-700 border-brand-100',           ring: 'ring-brand-500 ring-offset-2 ring-offset-canvas-elevated',     iconWrap: 'bg-brand-100 text-brand-700' },
  { type: 'Internal Audit', icon: <ClipboardList size={22} />,  tagline: 'Process audit aligned to RACM + SOPs',                          tint: 'bg-evidence-50/70 hover:bg-evidence-50 text-evidence-700 border-evidence-100', ring: 'ring-evidence-500 ring-offset-2 ring-offset-canvas-elevated',  iconWrap: 'bg-evidence-100 text-evidence-700' },
  { type: 'Automation',     icon: <Zap size={22} />,             tagline: 'Continuous monitoring / reconciliation / MIS / forensic',      tint: 'bg-compliant-50/70 hover:bg-compliant-50 text-compliant-700 border-compliant-100', ring: 'ring-compliant-500 ring-offset-2 ring-offset-canvas-elevated', iconWrap: 'bg-compliant-100 text-compliant-700' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
const genCode = () => `ENG-0${10 + Math.floor(Math.random() * 90)}`;
const toggle = <T,>(arr: T[], v: T): T[] => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-07-15" → "Jul 2026" (the human-readable period string the list shows). */
function isoToMonthYear(iso: string): string {
  if (!iso) return 'TBD';
  const [y, m] = iso.split('-');
  return `${MONTHS_SHORT[Number(m) - 1] ?? '?'} ${y}`;
}
/** "2026-07-15" → "Jul 15" (short date for nextScheduled copy). */
function isoToShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${MONTHS_SHORT[Number(m) - 1] ?? '?'} ${Number(d)}`;
}
/** ISO date halfway between two ISO dates. */
function midIso(a: string, b: string): string {
  const t = (new Date(a + 'T00:00:00Z').getTime() + new Date(b + 'T00:00:00Z').getTime()) / 2;
  return new Date(t).toISOString().slice(0, 10);
}
const todayIso = () => new Date().toISOString().slice(0, 10);

// ─── Component ─────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  /** Fires with the fully-built engagement — new (create mode) or updated (edit mode). */
  onCreated: (eng: Engagement) => void;
  /** When set, the wizard opens prefilled in edit mode and preserves id / status / metrics. */
  initial?: Engagement;
}

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ['Type & basics', 'Scope', 'Team & timeline', 'Review'] as const;

export default function CreateEngagementWizard({ onClose, onCreated, initial }: Props): JSX.Element {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const isEdit = Boolean(initial);
  const [step, setStep] = useState<Step>(1);

  // ── Step 1 — Type & basics ──
  const [type, setType] = useState<EngType | null>(initial?.type ?? null);
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? genCode());
  const [entity, setEntity] = useState(initial?.entity ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [process, setProcess] = useState<UIProcess>(initial?.process ?? 'P2P');
  const [periodStart, setPeriodStart] = useState(initial?.startDate ?? '');
  const [periodEnd, setPeriodEnd] = useState(initial?.endDate ?? '');
  const [owner, setOwner] = useState(initial?.owner ?? OWNER_NAMES[0]);
  // Seed engagements can have owners outside the people directory — keep them selectable in edit mode.
  const ownerOptions = useMemo(
    () => (initial?.owner && !OWNER_NAMES.includes(initial.owner) ? [initial.owner, ...OWNER_NAMES] : OWNER_NAMES),
    [initial?.owner],
  );

  // ── Step 2 — Compliance scope ──
  const [framework, setFramework] = useState(initial?.type === 'Compliance' && FRAMEWORKS.includes(initial.framework) ? initial.framework : FRAMEWORKS[0]);
  const [racmVersion, setRacmVersion] = useState(initial?.complianceConfig?.racmVersion ?? RACM_VERSIONS[0]);
  const [samplingMethod, setSamplingMethod] = useState<SamplingMethod>((initial?.complianceConfig?.samplingMethod as SamplingMethod) ?? 'Random');
  const [sampleSize, setSampleSize] = useState(initial?.complianceConfig?.sampleSize ?? 25);
  const [materiality, setMateriality] = useState(initial?.complianceConfig?.materiality ?? 500000);

  // ── Step 2 — SOX / ICFR scope (materiality ground rules; full rule set is managed in-engagement) ──
  const [overallMateriality, setOverallMateriality] = useState(initial?.soxConfig?.overallMateriality ?? 5_000_000);
  const [pmPct, setPmPct] = useState(initial?.soxConfig ? Math.round(initial.soxConfig.performanceMateriality / initial.soxConfig.overallMateriality * 100) : 75);
  const [cttPct, setCttPct] = useState(initial?.soxConfig ? Math.round(initial.soxConfig.clearlyTrivial / initial.soxConfig.overallMateriality * 100) : 5);
  const [keyOnly, setKeyOnly] = useState(initial?.soxConfig?.keyOnly ?? true);

  // ── Step 2 — Internal Audit scope ──
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>((initial?.auditConfig?.scopeLevel as ScopeLevel) ?? 'Full process');
  const [subProcessSel, setSubProcessSel] = useState<string[]>(initial?.auditConfig?.subProcesses ?? []);
  const [linkedRacms, setLinkedRacms] = useState<string[]>(initial?.auditConfig?.linkedRacms ?? [RACM_VERSIONS[0]]);
  const [linkedSops, setLinkedSops] = useState<string[]>(initial?.auditConfig?.linkedSops ?? []);
  const [tatDays, setTatDays] = useState(initial?.auditConfig?.tatDays ?? 30);
  const [idrTemplate, setIdrTemplate] = useState(initial?.auditConfig?.idrTemplate ?? IDR_TEMPLATES[0]);
  const [cadence, setCadence] = useState<Cadence>((initial?.auditConfig?.cadence as Cadence) ?? 'Biweekly');

  // ── Step 2 — Automation scope ──
  const [autoSubtype, setAutoSubtype] = useState<AutomationSubtype>(initial?.subtype ?? 'CCM');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>(initial?.automationConfig?.templates ?? []);
  const [inputSources, setInputSources] = useState<InputSource[]>((initial?.automationConfig?.inputSources as InputSource[]) ?? ['Excel']);
  const [autoCadence, setAutoCadence] = useState<AutoCadence>((initial?.automationConfig?.cadence as AutoCadence) ?? 'Daily');
  const [threshold, setThreshold] = useState(initial?.automationConfig?.threshold ?? 0.85);
  const [alertRecipients, setAlertRecipients] = useState<string[]>(initial?.automationConfig?.alertRecipients ?? [OWNER_NAMES[0]]);

  // ── Step 2 — AI draft affordance ──
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiBanner, setAiBanner] = useState(false);
  const [aiFileName, setAiFileName] = useState('');
  const draftTimer = useRef<number | null>(null);
  useEffect(() => () => { if (draftTimer.current !== null) window.clearTimeout(draftTimer.current); }, []);

  // ── Step 3 — Team & timeline ──
  const [reviewer, setReviewer] = useState(initial?.team?.reviewer ?? '');
  const [auditors, setAuditors] = useState<string[]>(initial?.team?.auditors ?? []);
  const [riskOwners, setRiskOwners] = useState<string[]>(initial?.team?.riskOwners ?? []);
  const [milestones, setMilestones] = useState<EngagementMilestone[]>(initial?.milestones?.slice(0, 4) ?? []);
  const [milestonesTouched, setMilestonesTouched] = useState(Boolean(initial?.milestones?.length));

  // Prefill milestone rows from the period until the user edits them.
  useEffect(() => {
    if (milestonesTouched || !periodStart || !periodEnd || periodStart > periodEnd) return;
    setMilestones([
      { label: 'Kickoff', date: periodStart },
      { label: 'Fieldwork complete', date: midIso(periodStart, periodEnd) },
      { label: 'Sign-off', date: periodEnd },
    ]);
  }, [periodStart, periodEnd, milestonesTouched]);

  const updateMilestone = (i: number, patch: Partial<EngagementMilestone>) => {
    setMilestonesTouched(true);
    setMilestones(ms => ms.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  };
  const addMilestone = () => {
    setMilestonesTouched(true);
    setMilestones(ms => ms.length >= 4 ? ms : [...ms, { label: '', date: periodEnd || '' }]);
  };
  const removeMilestone = (i: number) => {
    setMilestonesTouched(true);
    setMilestones(ms => ms.length <= 2 ? ms : ms.filter((_, idx) => idx !== i));
  };

  // Review collapsibles
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ basics: true, scope: true, team: true });
  const toggleSection = (k: string) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  const sopSuggestions = useMemo(() => {
    const subs = SUB_PROCESSES[process === 'Cross' ? 'P2P' : process] ?? [];
    return subs.slice(0, 3).map(s => `${s} SOP v1.2`);
  }, [process]);

  useEffect(() => {
    if (linkedSops.length === 0 && sopSuggestions.length > 0) setLinkedSops(sopSuggestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sopSuggestions.join('|')]);

  const subProcessOptions = useMemo(() => SUB_PROCESSES[process === 'Cross' ? 'P2P' : process] ?? [], [process]);

  // ── AI draft: after a simulated 1.5s run, fill the current type's scope fields ──
  const runAiDraft = (fileName?: string) => {
    if (aiDrafting) return;
    if (fileName) setAiFileName(fileName);
    setAiDrafting(true);
    setAiBanner(false);
    draftTimer.current = window.setTimeout(() => {
      if (type === 'Compliance') {
        setFramework('SOX ICFR');
        setRacmVersion(RACM_VERSIONS[0]);
        setSamplingMethod('Statistical');
        setSampleSize(40);
        setMateriality(2_500_000);
      } else if (type === 'SOX / ICFR') {
        setOverallMateriality(7_500_000);
        setPmPct(70);
        setCttPct(4);
        setKeyOnly(true);
      } else if (type === 'Internal Audit') {
        setScopeLevel('Sub-process');
        setSubProcessSel(subProcessOptions.slice(0, 3));
        setLinkedRacms([RACM_VERSIONS[0]]);
        setLinkedSops(sopSuggestions);
        setTatDays(45);
        setIdrTemplate(IDR_TEMPLATES[0]);
        setCadence('Biweekly');
      } else if (type === 'Automation') {
        setAutoSubtype('CCM');
        setSelectedTemplates(WORKFLOW_TEMPLATES.filter(t => t.subtype === 'CCM').map(t => t.id));
        setInputSources(['Excel', 'SQL']);
        setAutoCadence('Daily');
        setThreshold(0.9);
        setAlertRecipients([owner]);
      }
      setAiDrafting(false);
      setAiBanner(true);
    }, 1500);
  };

  // ── Validation — every step gates for real, no silent skips ──
  const step1Valid = type !== null
    && name.trim().length > 0
    && code.trim().length > 0
    && periodStart !== '' && periodEnd !== '' && periodStart <= periodEnd;

  let step2Valid = false;
  if (type === 'Compliance')          step2Valid = framework !== '' && racmVersion !== '' && materiality > 0 && (samplingMethod === 'Manual upload' || sampleSize > 0);
  else if (type === 'SOX / ICFR')     step2Valid = overallMateriality > 0 && pmPct > 0 && pmPct <= 100 && cttPct >= 0 && cttPct < 100;
  else if (type === 'Internal Audit') step2Valid = linkedRacms.length > 0 && tatDays > 0 && (scopeLevel !== 'Sub-process' || subProcessSel.length > 0);
  else if (type === 'Automation')     step2Valid = inputSources.length > 0 && alertRecipients.length > 0;

  const reviewerInvalid = reviewer !== '' && reviewer === owner;
  const milestonesValid = milestones.length >= 2 && milestones.every(m => m.label.trim() !== '' && m.date !== '');
  const step3Valid = reviewer !== '' && !reviewerInvalid && milestonesValid;

  const canAdvanceFrom: Record<Step, boolean> = { 1: step1Valid, 2: step2Valid, 3: step3Valid, 4: true };

  const goToStep = (target: Step) => {
    if (target <= step) { setStep(target); return; }
    for (let i = step; i < target; i++) if (!canAdvanceFrom[i as Step]) return;
    setStep(target);
  };
  const nextStep = () => { if (canAdvanceFrom[step] && step < 4) setStep((step + 1) as Step); };
  const prevStep = () => { if (step > 1) setStep((step - 1) as Step); };

  // ── Build the complete engagement — everything captured above is carried ──
  const buildEngagement = (status: Engagement['status']): Engagement => {
    const cleanMilestones = milestones
      .filter(m => m.label.trim() && m.date)
      .map(m => ({ label: m.label.trim(), date: m.date }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const next = cleanMilestones.find(m => m.date >= todayIso()) ?? cleanMilestones[cleanMilestones.length - 1];
    return {
      id: initial?.id ?? `eng-new-${Date.now()}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim(),
      type: type ?? 'Compliance',
      subtype: type === 'Automation' ? autoSubtype : undefined,
      process: (process === 'Cross' ? 'P2P' : process) as ProcessCode,
      framework: type === 'SOX / ICFR' ? 'COSO 2013 / SOX 404' : type === 'Compliance' ? framework : 'Internal Policy',
      soxConfig: type === 'SOX / ICFR' ? {
        overallMateriality,
        performanceMateriality: Math.round(overallMateriality * pmPct / 100),
        clearlyTrivial: Math.round(overallMateriality * cttPct / 100),
        sdBandPct: 20, aggregate: true, keyOnly,
      } : undefined,
      complianceConfig: type === 'Compliance' ? {
        racmVersion, samplingMethod,
        sampleSize: samplingMethod === 'Manual upload' ? undefined : sampleSize,
        materiality,
      } : undefined,
      auditConfig: type === 'Internal Audit' ? {
        scopeLevel, subProcesses: subProcessSel, linkedRacms, linkedSops, tatDays, idrTemplate, cadence,
      } : undefined,
      automationConfig: type === 'Automation' ? {
        templates: selectedTemplates, inputSources: [...inputSources], cadence: autoCadence, threshold, alertRecipients,
      } : undefined,
      owner,
      status,
      periodStart: isoToMonthYear(periodStart),
      periodEnd: isoToMonthYear(periodEnd),
      startDate: periodStart,
      endDate: periodEnd,
      entity: entity.trim() || undefined,
      team: { reviewer, auditors, riskOwners },
      milestones: cleanMilestones,
      controls: initial?.controls ?? 0,
      health: initial?.health ?? 0,
      openIssues: initial?.openIssues ?? 0,
      lastActivity: initial?.lastActivity ?? (status === 'Draft' ? 'Draft' : 'Just created'),
      nextScheduled: next ? `${next.label} ${isoToShort(next.date)}` : 'TBD',
    };
  };

  const submit = (status: Engagement['status']) => {
    const eng = buildEngagement(status);
    if (!isEdit) {
      logEvent({ action: 'Create', description: `Created engagement "${eng.name}"`, module: 'Engagements', entity: 'Engagement' });
    }
    addToast({
      message: isEdit
        ? `"${eng.name}" updated`
        : status === 'Draft' ? `"${eng.name}" saved as Draft` : `"${eng.name}" created & activated`,
      type: 'success',
    });
    onCreated(eng);
  };

  const fmtR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

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
        role="dialog" aria-label={isEdit ? 'Edit Engagement' : 'Create Engagement'}
      >
        {/* Header */}
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-brand-600 shrink-0" />
                <h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight">{isEdit ? 'Edit Engagement' : 'Create Engagement'}</h2>
              </div>
              <p className="text-[0.75rem] text-ink-500">Step {step} of 4 — {STEP_LABELS[step - 1]}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close drawer"><X size={16} /></button>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => goToStep(n as Step)}
                className={`flex-1 h-1.5 rounded-full transition-colors ${n === step ? 'bg-brand-600' : n < step ? 'bg-brand-300' : 'bg-canvas-border'} ${n <= step ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
                aria-label={`Go to step ${n}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1.5 text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wider">
            {STEP_LABELS.map((lbl, i) => (
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
              {/* ═══ STEP 1: TYPE & BASICS ═══ */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Engagement type <span className="text-risk-700">*</span></label>
                    <div className="space-y-2">
                      {TYPE_TILES.map(t => {
                        const selected = type === t.type;
                        return (
                          <button
                            key={t.type}
                            onClick={() => { setType(t.type); if (t.type !== type) setAiBanner(false); }}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${t.tint} ${selected ? `ring-2 ${t.ring} border-transparent` : ''}`}
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.iconWrap}`}>{t.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[0.8125rem] font-semibold">{t.type}</div>
                                {selected && <Check size={15} className="shrink-0" />}
                              </div>
                              <p className="text-[0.75rem] opacity-80 mt-0.5 line-clamp-1">{t.tagline}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Engagement name <span className="text-risk-700">*</span></label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. P2P — SOX Q3 Testing" className={inputCls} />
                    {name.trim().length === 0 && <Hint text="Name is required" />}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Code <span className="text-risk-700">*</span></label>
                      <input type="text" value={code} onChange={e => setCode(e.target.value)} className={`${inputCls} font-mono uppercase`} />
                      <p className="text-[0.6875rem] text-ink-500 mt-1">Auto-generated — edit if your team uses its own scheme.</p>
                      {code.trim().length === 0 && <Hint text="Code is required" />}
                    </div>
                    <div>
                      <label className={labelCls}>Entity</label>
                      <input type="text" value={entity} onChange={e => setEntity(e.target.value)} placeholder="e.g. Airline Group Ltd" className={inputCls} />
                    </div>
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
                  <div>
                    <label className={labelCls}>Owner <span className="text-risk-700">*</span></label>
                    <select value={owner} onChange={e => setOwner(e.target.value)} className={selectCls}>
                      {ownerOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Description <span className="normal-case font-medium text-ink-400">(optional)</span></label>
                    <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="One-line description of scope and intent." className={inputCls + ' resize-none'} />
                  </div>
                </div>
              )}

              {/* ═══ STEP 2: SCOPE ═══ */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* AI draft affordance */}
                  <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0"><Sparkles size={14} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.8125rem] font-semibold text-ink-900">Let AI draft this step</div>
                        <p className="text-[0.75rem] text-ink-500 mt-0.5">Drop the engagement letter or prior-year scope — AI proposes the configuration below.</p>
                        {aiFileName && (
                          <div className="mt-1.5 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-700">
                            <FileText size={11} /> {aiFileName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-canvas-border bg-white text-[0.6875rem] font-semibold text-ink-700 hover:bg-canvas transition-colors cursor-pointer">
                        <FileText size={11} /> Upload document
                        <input
                          type="file"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) runAiDraft(f.name);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        onClick={() => runAiDraft()}
                        disabled={aiDrafting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.6875rem] font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                      >
                        {aiDrafting ? <><Loader2 size={11} className="animate-spin" /> Drafting…</> : <><Sparkles size={11} /> Draft with AI</>}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {aiBanner && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-compliant-100 bg-compliant-50 text-compliant-700"
                      >
                        <Sparkles size={13} className="shrink-0" />
                        <span className="text-[0.75rem] font-semibold flex-1">Drafted by AI — review before continuing.</span>
                        <button onClick={() => setAiBanner(false)} className="p-0.5 rounded hover:bg-compliant-100 cursor-pointer" aria-label="Dismiss AI draft banner"><X size={13} /></button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {type === 'Compliance' && (
                    <>
                      <SectionTitle title="Compliance scope" subtitle="Framework, RACM, sampling, and materiality" />
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
                          {sampleSize <= 0 && <Hint text="Sample size must be at least 1" />}
                        </Field>
                      )}
                      <Field label="Materiality threshold">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.8125rem] text-ink-500 pointer-events-none">{'₹'}</span>
                          <input type="number" min={0} value={materiality} onChange={e => setMateriality(parseInt(e.target.value) || 0)} className={inputCls + ' pl-7'} />
                        </div>
                        {materiality <= 0 && <Hint text="Materiality must be greater than zero" />}
                      </Field>
                    </>
                  )}

                  {type === 'SOX / ICFR' && (() => {
                    const pm = overallMateriality * pmPct / 100;
                    const ctt = overallMateriality * cttPct / 100;
                    const sd = overallMateriality * 0.20;
                    return (
                      <>
                        <SectionTitle title="SOX / ICFR — scoping & materiality" subtitle="Ground rules that drive how exceptions are evaluated" />
                        <Field label="Framework">
                          <div className="px-3 py-2.5 border border-border-light bg-canvas/60 rounded-lg text-[0.8125rem] text-ink-700 font-medium">COSO 2013 / SOX 404(b)</div>
                        </Field>
                        <Field label="Control scope">
                          <button type="button" onClick={() => setKeyOnly(k => !k)} className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-lg text-[0.8125rem] transition-all cursor-pointer ${keyOnly ? segActiveCls : segIdleCls}`}>
                            <span className="font-medium">Key controls only</span>
                            <span className={`w-9 h-5 rounded-full relative transition-colors ${keyOnly ? 'bg-brand-600' : 'bg-ink-200'}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${keyOnly ? 'left-[1.125rem]' : 'left-0.5'}`} /></span>
                          </button>
                        </Field>
                        <Field label="Overall materiality">
                          <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.8125rem] text-ink-500 pointer-events-none">{'₹'}</span><input type="number" min={0} value={overallMateriality} onChange={e => setOverallMateriality(parseInt(e.target.value) || 0)} className={inputCls + ' pl-7'} /></div>
                          {overallMateriality <= 0 && <Hint text="Overall materiality must be greater than zero" />}
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Performance materiality (% of overall)">
                            <input type="number" min={1} max={100} value={pmPct} onChange={e => setPmPct(parseInt(e.target.value) || 0)} className={inputCls} />
                            <div className="text-[0.7rem] text-ink-500 mt-1">= {fmtR(pm)}</div>
                          </Field>
                          <Field label="Clearly-trivial threshold (% of overall)">
                            <input type="number" min={0} max={99} value={cttPct} onChange={e => setCttPct(parseInt(e.target.value) || 0)} className={inputCls} />
                            <div className="text-[0.7rem] text-ink-500 mt-1">= {fmtR(ctt)}</div>
                          </Field>
                        </div>
                        <div className="rounded-lg border border-border-light bg-canvas/60 p-3 space-y-1.5">
                          <div className={labelCls + ' mb-0.5'}>Exception severity — computed automatically</div>
                          {[
                            [`≤ ${fmtR(ctt)}`, 'Clearly trivial — logged, not aggregated', 'text-ink-500'],
                            [`> ${fmtR(ctt)} and < ${fmtR(sd)}`, 'Deficiency', 'text-mitigated-700'],
                            [`≥ ${fmtR(sd)} (20% of materiality)`, 'Significant deficiency', 'text-high-700'],
                            [`≥ ${fmtR(overallMateriality)} or an MW indicator`, 'Material weakness', 'text-risk-700'],
                          ].map(([band, label, cls]) => (
                            <div key={band} className="flex items-center justify-between text-[0.75rem]"><span className="text-ink-600 tabular-nums">{band}</span><span className={`font-semibold ${cls}`}>{label}</span></div>
                          ))}
                          <div className="text-[0.7rem] text-ink-500 pt-1 border-t border-border-light mt-1">Full rule set — bands, aggregation, compensating controls, auto-routing — is managed in the engagement's Materiality workspace.</div>
                        </div>
                      </>
                    );
                  })()}

                  {type === 'Internal Audit' && (
                    <>
                      <SectionTitle title="Internal Audit scope" subtitle="Scope level, linked artefacts, and cadence" />
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
                        {scopeLevel === 'Sub-process' && subProcessSel.length === 0 && <Hint text="Pick at least one sub-process for a sub-process scope" />}
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
                          {tatDays <= 0 && <Hint text="TAT must be at least 1 day" />}
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
                    </>
                  )}

                  {type === 'Automation' && (
                    <>
                      <SectionTitle title="Automation scope" subtitle="Subtype, templates, sources, cadence" />
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
                    </>
                  )}
                </div>
              )}

              {/* ═══ STEP 3: TEAM & TIMELINE ═══ */}
              {step === 3 && (
                <div className="space-y-4">
                  <SectionTitle title="Team & timeline" subtitle="Who runs the engagement, and its key dates" />
                  <Field label="Owner (from step 1)">
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-canvas-border bg-canvas/60">
                      <div className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ink-800">
                        <Users size={14} className="text-brand-600" />
                        {owner}
                      </div>
                      <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer">
                        <Edit3 size={11} /> Edit
                      </button>
                    </div>
                  </Field>
                  <div>
                    <label className={labelCls}>Reviewer <span className="text-risk-700">*</span></label>
                    <select value={reviewer} onChange={e => setReviewer(e.target.value)}
                      className={`${selectCls} ${reviewerInvalid ? 'border-risk focus:border-risk focus:ring-risk/10' : ''}`}>
                      <option value="" disabled>Select reviewer…</option>
                      {OWNER_NAMES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    {reviewer === '' && <Hint text="Reviewer is required" />}
                    {reviewerInvalid && <Hint text="Reviewer must differ from owner" />}
                  </div>
                  <ChipPicker label="Auditors" options={OWNER_NAMES.filter(n => n !== owner)} selected={auditors} onChange={setAuditors} />
                  <ChipPicker label="Risk owners" helper="Multiple risk owners get notifications; primary is the first." options={OWNER_NAMES} selected={riskOwners} onChange={setRiskOwners} />

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={labelCls + ' mb-0'}>Milestones <span className="text-risk-700">*</span></label>
                      {milestones.length < 4 && (
                        <button onClick={addMilestone} className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer">
                          <Plus size={11} /> Add milestone
                        </button>
                      )}
                    </div>
                    <p className="text-[0.6875rem] text-ink-500 mb-2">Prefilled from the period — 2 to 4 dated checkpoints that feed the portfolio timeline.</p>
                    <div className="space-y-2">
                      {milestones.map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-canvas border border-canvas-border text-ink-500 flex items-center justify-center shrink-0"><CalendarClock size={13} /></span>
                          <input
                            type="text"
                            value={m.label}
                            onChange={e => updateMilestone(i, { label: e.target.value })}
                            placeholder={`Milestone ${i + 1}`}
                            className={inputCls + ' flex-1'}
                          />
                          <div className="w-[150px] shrink-0">
                            <DatePicker value={m.date} onChange={e => updateMilestone(i, { date: e.target.value })} className={inputCls} aria-label={`Milestone ${i + 1} date`} />
                          </div>
                          <button
                            onClick={() => removeMilestone(i)}
                            disabled={milestones.length <= 2}
                            className="p-1.5 rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                            aria-label={`Remove milestone ${i + 1}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {!milestonesValid && <Hint text="Each milestone needs a label and a date (minimum 2)" />}
                  </div>
                </div>
              )}

              {/* ═══ STEP 4: REVIEW & CREATE ═══ */}
              {step === 4 && (
                <div className="space-y-3">
                  <SectionTitle title={isEdit ? 'Review & save' : 'Review & create'} subtitle="Everything below is carried onto the engagement" />
                  <ReviewSection title="Type & basics" open={openSections.basics} onToggle={() => toggleSection('basics')}>
                    <ReviewRow k="Type" v={type ?? '—'} />
                    <ReviewRow k="Name" v={name || '—'} />
                    <ReviewRow k="Code" v={<span className="font-mono">{code.toUpperCase()}</span>} />
                    <ReviewRow k="Entity" v={entity.trim() || '—'} />
                    <ReviewRow k="Process" v={process} />
                    <ReviewRow k="Period" v={`${periodStart || '—'} → ${periodEnd || '—'}`} />
                    <ReviewRow k="Owner" v={owner} />
                    {description && <ReviewRow k="Description" v={description} />}
                  </ReviewSection>
                  <ReviewSection title={`${type ?? 'Type'} scope`} open={openSections.scope} onToggle={() => toggleSection('scope')}>
                    {type === 'Compliance' && (
                      <>
                        <ReviewRow k="Framework" v={framework} />
                        <ReviewRow k="RACM version" v={racmVersion} />
                        <ReviewRow k="Sampling" v={samplingMethod} />
                        {samplingMethod !== 'Manual upload' && <ReviewRow k="Sample size" v={String(sampleSize)} />}
                        <ReviewRow k="Materiality" v={fmtR(materiality)} />
                      </>
                    )}
                    {type === 'SOX / ICFR' && (
                      <>
                        <ReviewRow k="Framework" v="COSO 2013 / SOX 404(b)" />
                        <ReviewRow k="Control scope" v={keyOnly ? 'Key controls only' : 'All controls'} />
                        <ReviewRow k="Overall materiality" v={fmtR(overallMateriality)} />
                        <ReviewRow k="Performance materiality" v={`${pmPct}% = ${fmtR(overallMateriality * pmPct / 100)}`} />
                        <ReviewRow k="Clearly trivial" v={`${cttPct}% = ${fmtR(overallMateriality * cttPct / 100)}`} />
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
                        <ReviewRow k="Templates" v={selectedTemplates.length ? WORKFLOW_TEMPLATES.filter(t => selectedTemplates.includes(t.id)).map(t => t.name).join(', ') : 'None'} />
                        <ReviewRow k="Sources" v={inputSources.join(', ') || '—'} />
                        <ReviewRow k="Cadence" v={autoCadence} />
                        <ReviewRow k="Threshold" v={`${(threshold * 100).toFixed(0)}%`} />
                        <ReviewRow k="Alert recipients" v={alertRecipients.join(', ') || '—'} />
                      </>
                    )}
                  </ReviewSection>
                  <ReviewSection title="Team & timeline" open={openSections.team} onToggle={() => toggleSection('team')}>
                    <ReviewRow k="Owner" v={owner} />
                    <ReviewRow k="Reviewer" v={reviewer || '—'} />
                    <ReviewRow k="Auditors" v={auditors.join(', ') || '—'} />
                    <ReviewRow k="Risk owners" v={riskOwners.join(', ') || '—'} />
                    {milestones.map((m, i) => (
                      <ReviewRow key={i} k={m.label || `Milestone ${i + 1}`} v={m.date ? isoToShort(m.date) + ', ' + m.date.slice(0, 4) : '—'} />
                    ))}
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
            {step < 4 && (
              <button onClick={nextStep} disabled={!canAdvanceFrom[step]}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                Next <ChevronRight size={14} />
              </button>
            )}
            {step === 4 && (isEdit ? (
              <button onClick={() => submit(initial?.status ?? 'Draft')} className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">Save changes</button>
            ) : (
              <>
                <button onClick={() => submit('Draft')} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-semibold text-ink-700 hover:bg-canvas transition-colors cursor-pointer">Create as Draft</button>
                <button onClick={() => submit('Active')} className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">Create &amp; Activate</button>
              </>
            ))}
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
