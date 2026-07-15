// One-Click Audit — the "audit with AI" wizard. Opens over Knowledge Hub or
// Ask Ira, walks Setup → Ira thinking → Engagements → Controls → Workflows →
// Go live, and lands the selected engagements in the Engagement Library
// (createdEngagementsStore) wearing an AI Recommended badge.
//
// Light-theme surface matching the rest of the platform, with the WebGL
// FloatingLines shader behind every step. The shader natively renders glowing
// lines on black; a CSS invert + hue-rotate flips that into ink-purple ribbons
// that multiply onto the light panel — louder on the emotional beats (setup,
// thinking, go-live), quiet under dense registers.
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, X, Database, FileText, Globe, Upload, Check, CheckCircle2,
  ArrowRight, ArrowLeft, Loader2, ShieldCheck, Workflow, ClipboardCheck,
  Pencil, Zap, CalendarRange, Radar,
} from 'lucide-react';
import FloatingLinesGL from '../shared/FloatingLinesGL';
import { TextShimmer } from '../shared/TextShimmer';
import Toggle from '../shared/Toggle';
import { useToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { SEED } from '../data-sources/sources';
import {
  buildRecommendedPlan, monthLabel,
  type RecommendedEngagement, type RecommendedRisk,
} from './oneClickAuditData';
import { addCreatedEngagements } from '../../data/createdEngagementsStore';
import type { Engagement } from '../../data/engagements';

type Step = 'setup' | 'thinking' | 'engagements' | 'controls' | 'workflows' | 'review' | 'live';

interface UploadedDoc {
  id: string;
  name: string;
  size: string;
  status: 'parsing' | 'ready';
}

const GRADIENT_STOPS = ['#6A12CD', '#A366F0', '#E947F5', '#4B6FE8'];

/* ───────────────────────── shared atoms ───────────────────────── */

/** Gradient "AI Recommended" chip — the badge every drafted item wears.
 *  Same treatment as the Engagement Library's badge so they read as one. */
function AiBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 h-[18px] rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white text-[9px] font-bold uppercase tracking-[0.08em] shrink-0">
      <Sparkles size={9} />
      {compact ? 'AI' : 'AI Recommended'}
    </span>
  );
}

/** Round select toggle used on cards / register rows. */
function SelectDot({ selected, onToggle, label }: { selected: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`size-[22px] rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
        selected
          ? 'bg-gradient-to-br from-brand-500 to-fuchsia-500 border-transparent shadow-[0_2px_10px_-2px_rgba(106,18,205,0.5)]'
          : 'border-ink-300 hover:border-brand-400 bg-white'
      }`}
    >
      {selected && <Check size={13} className="text-white" strokeWidth={3} />}
    </button>
  );
}

/** Click-to-edit text — hover shows a pencil, click swaps to an input/textarea. */
function InlineText({
  value, onCommit, multiline = false, className = '', inputClassName = '', label,
}: {
  value: string;
  onCommit: (next: string) => void;
  multiline?: boolean;
  className?: string;
  inputClassName?: string;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };

  if (editing) {
    const shared = `w-full bg-white border border-brand-300 rounded-md px-2 py-1 text-inherit outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 ${inputClassName}`;
    return multiline ? (
      <textarea
        autoFocus
        value={draft}
        aria-label={label}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        rows={2}
        className={`${shared} resize-none leading-relaxed`}
        onClick={e => e.stopPropagation()}
      />
    ) : (
      <input
        autoFocus
        value={draft}
        aria-label={label}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        className={shared}
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title="Click to edit"
      aria-label={`Edit ${label}`}
      onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { setDraft(value); setEditing(true); } }}
      className={`group/edit cursor-text rounded-sm hover:bg-brand-50 transition-colors ${className}`}
    >
      {value}
      <Pencil size={10} className="inline-block ml-1.5 -mt-0.5 opacity-0 group-hover/edit:opacity-50 transition-opacity" />
    </span>
  );
}

const SEVERITY_DOT: Record<RecommendedRisk['severity'], string> = {
  High: 'bg-rose-500',
  Medium: 'bg-amber-500',
  Low: 'bg-emerald-500',
};

const SEVERITY_CHIP: Record<RecommendedRisk['severity'], string> = {
  High: 'bg-rose-50 text-rose-700',
  Medium: 'bg-amber-50 text-amber-700',
  Low: 'bg-emerald-50 text-emerald-700',
};

/* ───────────────────────── main modal ───────────────────────── */

export default function OneClickAuditModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('setup');
  const [uploads, setUploads] = useState<UploadedDoc[]>([]);
  const [webSearch, setWebSearch] = useState(true);
  const [plan, setPlan] = useState<RecommendedEngagement[]>([]);
  const [activeEngId, setActiveEngId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Esc routes through handleClose (defined below, after the state it needs);
  // the ref indirection keeps the trap wired to the latest closure.
  const closeRef = useRef<() => void>(onClose);
  useFocusTrap(containerRef, true, () => closeRef.current());

  const dbSources = useMemo(() => SEED.filter(s => s.type === 'database'), []);
  // Totals the loader counts up to — read once from the same seed the plan uses.
  const planTotals = useMemo(() => {
    const p = buildRecommendedPlan();
    return {
      engagements: p.length,
      risks: p.reduce((n, e) => n + e.risks.length, 0),
      controls: p.reduce((n, e) => n + e.controls.length, 0),
      workflows: p.reduce((n, e) => n + e.workflows.length, 0),
    };
  }, []);

  const selectedEngs = plan.filter(e => e.selected);

  /* ── plan mutation helpers ── */
  const patchEng = (id: string, patch: Partial<RecommendedEngagement>) =>
    setPlan(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)));

  const patchItem = (
    engId: string, key: 'risks' | 'controls' | 'workflows', itemId: string, patch: Record<string, unknown>,
  ) =>
    setPlan(prev => prev.map(e => {
      if (e.id !== engId) return e;
      const items = (e[key] as { id: string }[]).map(item => (item.id === itemId ? { ...item, ...patch } : item));
      return { ...e, [key]: items };
    }));

  /* ── uploads (mock parse) ── */
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const docs: UploadedDoc[] = Array.from(files).map((f, i) => ({
      id: `up-${Date.now()}-${i}`,
      name: f.name,
      size: f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`,
      status: 'parsing',
    }));
    setUploads(prev => [...prev, ...docs]);
    docs.forEach((d, i) => {
      setTimeout(() => {
        setUploads(prev => prev.map(u => (u.id === d.id ? { ...u, status: 'ready' } : u)));
      }, 1100 + i * 500);
    });
  };

  /* ── thinking choreography ── */
  const thinkingPhases = useMemo(() => {
    const phases: { icon: typeof Database; label: string; detail: string }[] = [
      { icon: Database, label: `Profiling ${dbSources.length} connected databases`, detail: '5.9M rows · schemas, postings & masters' },
    ];
    if (uploads.length > 0) phases.push({ icon: FileText, label: `Parsing ${uploads.length} SOP / DOA document${uploads.length > 1 ? 's' : ''}`, detail: 'extracting approval thresholds & process owners' });
    if (webSearch) phases.push({ icon: Globe, label: 'Scanning regulatory guidance', detail: 'SOX 404 · IFC · ISO 27001 · IFRS 15' });
    phases.push(
      { icon: Radar, label: 'Mapping risk themes to your processes', detail: 'P2P · R2R · O2C · ITGC' },
      { icon: ClipboardCheck, label: 'Drafting engagements, controls & workflows', detail: 'sizing timelines against your fiscal calendar' },
    );
    return phases;
  }, [dbSources.length, uploads.length, webSearch]);

  const PHASE_MS = 1500;
  const thinkTotal = thinkingPhases.length * PHASE_MS + 900;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (step !== 'thinking') return;
    setElapsed(0);
    const started = performance.now();
    const t = setInterval(() => setElapsed(performance.now() - started), 80);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (step !== 'thinking' || elapsed < thinkTotal) return;
    const p = buildRecommendedPlan();
    setPlan(p);
    setActiveEngId(p.find(e => e.selected)?.id ?? p[0].id);
    setStep('engagements');
  }, [step, elapsed, thinkTotal]);

  const progress = Math.min(elapsed / thinkTotal, 1);
  const phaseIdx = Math.min(Math.floor(elapsed / PHASE_MS), thinkingPhases.length - 1);
  const eased = 1 - Math.pow(1 - progress, 2);
  const SCAN_LINES = useMemo(() => [
    'SAP ERP: AP Module — BSEG · 1.2M rows scanned',
    'Vendor Master Data — LFA1 · matching bank accounts',
    'GL Transaction History — journals FY24–FY26',
    'Workday HRIS — joiner / mover / leaver events',
    'DOA matrix — approval limits by grade',
    'Cross-referencing duplicate-candidate clusters',
    'Benchmarking control frequency against peers',
  ], []);
  const scanLine = SCAN_LINES[Math.floor(elapsed / 750) % SCAN_LINES.length];

  /* ── keep the active register tab valid as selection changes ── */
  useEffect(() => {
    if ((step !== 'controls' && step !== 'workflows') || selectedEngs.length === 0) return;
    if (!selectedEngs.some(e => e.id === activeEngId)) setActiveEngId(selectedEngs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, plan]);

  /* ── go live ── */
  const [liveIdx, setLiveIdx] = useState(0);
  const createdRef = useRef(false);

  const toEngagement = (r: RecommendedEngagement, i: number): Engagement => {
    const [sy, sm] = r.startMonth.split('-').map(Number);
    const [ey, em] = r.endMonth.split('-').map(Number);
    const endDay = new Date(ey, em, 0).getDate();
    const mid = new Date((new Date(sy, sm - 1, 15).getTime() + new Date(ey, em - 1, 15).getTime()) / 2);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return {
      id: `oca-${Date.now()}-${i}`,
      code: r.code,
      name: r.name,
      description: r.description,
      type: r.type,
      subtype: r.subtype,
      process: r.process,
      framework: r.framework,
      owner: r.owner,
      status: 'Planned',
      periodStart: monthLabel(r.startMonth),
      periodEnd: monthLabel(r.endMonth),
      controls: r.controls.filter(c => c.selected).length,
      health: 0,
      openIssues: 0,
      lastActivity: 'Just created by Ira',
      nextScheduled: `Kickoff ${monthLabel(r.startMonth)}`,
      startDate: `${r.startMonth}-01`,
      endDate: `${r.endMonth}-${String(endDay).padStart(2, '0')}`,
      milestones: [
        { label: 'Kickoff', date: `${r.startMonth}-15` },
        { label: 'Fieldwork complete', date: iso(mid) },
        { label: 'Sign-off', date: `${r.endMonth}-${String(Math.min(endDay, 25)).padStart(2, '0')}` },
      ],
      aiRecommended: true,
    };
  };

  useEffect(() => {
    if (step !== 'live') return;
    if (!createdRef.current) {
      createdRef.current = true;
      addCreatedEngagements(selectedEngs.map(toEngagement));
    }
    setLiveIdx(0);
    const t = setInterval(() => {
      setLiveIdx(prev => {
        if (prev >= selectedEngs.length) { clearInterval(t); return prev; }
        return prev + 1;
      });
    }, 650);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const liveDone = step === 'live' && liveIdx >= selectedEngs.length;
  const { addToast } = useToast();

  const goToEngagements = () => {
    window.dispatchEvent(new CustomEvent('app:navigate-view', { detail: { view: 'engagements' } }));
    onClose();
  };

  /** Close after go-live (Done / X / Esc / backdrop) — leave a success toast
   *  with a redirect action so "they're live" survives the modal closing. */
  const handleClose = () => {
    if (step === 'live' && liveDone) {
      addToast({
        message: `${selectedEngs.length} AI-recommended engagement${selectedEngs.length !== 1 ? 's are' : ' is'} live in your Engagement Library`,
        type: 'success',
        action: {
          label: 'View in Engagements',
          onClick: () => window.dispatchEvent(new CustomEvent('app:navigate-view', { detail: { view: 'engagements' } })),
        },
      });
    }
    onClose();
  };
  closeRef.current = handleClose;

  /* ── step rail ── */
  const RAIL: { id: Step; label: string }[] = [
    { id: 'engagements', label: 'Engagements' },
    { id: 'controls', label: 'Controls' },
    { id: 'workflows', label: 'Workflows' },
    { id: 'review', label: 'Go live' },
  ];
  const railIdx = RAIL.findIndex(r => r.id === step);

  // Ribbon strength per step — ambient texture only; content readability wins.
  const LINES_OPACITY: Record<Step, number> = {
    setup: 0.18, thinking: 0.1, engagements: 0.07, controls: 0.07, workflows: 0.07, review: 0.07, live: 0.15,
  };

  // Memoize the shader element — same trap ChatView documents for the 2D
  // FloatingLines: inline array props (enabledWaves/lineCount/lineDistance)
  // are new references every render, and they're deps of the component's
  // setup effect. The thinking step re-renders every 80ms (elapsed ticker),
  // which would tear down and rebuild the whole WebGL renderer each tick —
  // visible as flicker. One stable element means the effect runs once.
  const linesBg = useMemo(() => (
    <FloatingLinesGL
      linesGradient={GRADIENT_STOPS}
      enabledWaves={['top', 'middle', 'bottom']}
      lineCount={[4, 7, 5]}
      lineDistance={[7, 5, 4]}
      bendRadius={4}
      bendStrength={-0.6}
      interactive
      parallax
      mixBlendMode="multiply"
      className="[filter:invert(1)_hue-rotate(180deg)]"
    />
  ), []);

  /* selected counts for footer copy */
  const countSelected = (key: 'risks' | 'controls' | 'workflows') =>
    selectedEngs.reduce((n, e) => n + e[key].filter(i => i.selected).length, 0);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[70] bg-ink-900/40 backdrop-blur-[3px]"
        onClick={step === 'live' && !liveDone ? undefined : handleClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.985 }}
        transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 pointer-events-none"
      >
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-label="One-Click Audit"
          // Opaque tinted gradient — translucent tints let the page ghost
          // through the panel, so the stops are solid hex (brand-50 / fuchsia-50).
          className="pointer-events-auto relative w-full max-w-[1280px] h-[min(52rem,94vh)] rounded-3xl overflow-hidden border border-canvas-border shadow-[0_40px_120px_-24px_rgba(23,3,48,0.45)] bg-gradient-to-br from-white via-[#F7F0FF] to-[#FDF4FF] flex flex-col"
        >
          {/* WebGL shader backdrop — the shader draws glowing lines on black;
              invert + hue-rotate flips it to ink-purple ribbons that multiply
              onto this light surface. */}
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: LINES_OPACITY[step] }}
            transition={{ duration: 0.6 }}
          >
            {linesBg}
          </motion.div>

          {/* ── header ── */}
          <header className="relative z-10 shrink-0 flex items-center justify-between gap-4 px-7 pt-5 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center shadow-[0_4px_16px_-4px_rgba(106,18,205,0.5)]">
                <Sparkles size={17} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[1.0625rem] font-semibold text-ink-900 tracking-tight">One-Click Audit</h2>
                  <span className="px-1.5 h-[18px] inline-flex items-center rounded-full bg-brand-50 text-brand-700 text-[9px] font-bold uppercase tracking-[0.1em]">Beta</span>
                </div>
                <p className="text-[0.75rem] text-ink-500 truncate">Ira drafts your audit universe from your connected data — you stay in control.</p>
              </div>
            </div>

            {/* step rail — shows once the plan exists */}
            {railIdx >= 0 && (
              <nav aria-label="Wizard progress" className="hidden md:flex items-center gap-1.5">
                {RAIL.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-1.5">
                    {i > 0 && <div className={`w-6 h-px ${i <= railIdx ? 'bg-brand-400' : 'bg-canvas-border'}`} />}
                    <div className={`flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[0.6875rem] font-semibold transition-colors ${
                      i === railIdx ? 'bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white shadow-[0_2px_10px_-2px_rgba(106,18,205,0.4)]'
                      : i < railIdx ? 'bg-brand-100 text-brand-700'
                      : 'text-ink-400'
                    }`}>
                      {i < railIdx ? <Check size={11} /> : <span className="tabular-nums">{i + 1}</span>}
                      {r.label}
                    </div>
                  </div>
                ))}
              </nav>
            )}

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="size-8 rounded-lg text-ink-400 hover:text-ink-800 hover:bg-ink-500/10 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
            >
              <X size={17} />
            </button>
          </header>

          {/* ── body ── */}
          <div className="relative z-10 flex-1 min-h-0 flex flex-col">
            <AnimatePresence mode="wait">

              {/* ════════ STEP: SETUP ════════ */}
              {step === 'setup' && (
                <motion.div
                  key="setup"
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                  className="flex-1 min-h-0 overflow-y-auto px-7 pb-7 pt-2"
                >
                  <div className="h-full grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-8 items-center max-w-[62rem] mx-auto">
                    {/* left — pitch + grounded data */}
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-[0.625rem] font-bold uppercase tracking-[0.14em] mb-5">
                        <Zap size={10} /> Recommended for your data
                      </span>
                      <h3 className="font-display text-[2.375rem] leading-[1.12] text-ink-900 mb-3">
                        Your entire audit,<br />
                        <TextShimmer as="span" className="font-display font-semibold" duration={3} spread={2}>drafted in one click.</TextShimmer>
                      </h3>
                      <p className="text-[0.9375rem] text-ink-500 leading-relaxed max-w-md mb-7">
                        Ira reads your connected databases, your SOPs and DOAs, and current regulatory
                        guidance — then proposes engagements, a control register, and live monitoring
                        workflows. Nothing goes live without your review.
                      </p>

                      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-ink-400 mb-2.5">Grounded in your connected data</p>
                      <div className="space-y-1.5 max-w-md">
                        {dbSources.map((s, i) => (
                          <motion.div
                            key={s.id}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 + i * 0.06 }}
                            className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white border border-canvas-border shadow-[0_1px_2px_rgba(15,8,30,0.03)]"
                          >
                            <Database size={14} className="text-brand-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.8125rem] font-semibold text-ink-800 truncate">{s.name}</p>
                              <p className="text-[0.6875rem] text-ink-400 truncate">{s.subtype}</p>
                            </div>
                            <span className="flex items-center gap-1.5 text-[0.625rem] font-semibold text-emerald-600 shrink-0">
                              <span className="relative flex size-1.5">
                                <span className="animate-ping absolute inline-flex size-full rounded-full bg-emerald-500 opacity-50" />
                                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                              </span>
                              Connected
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* right — inputs card */}
                    <motion.div
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12, duration: 0.35, ease: [0.2, 0, 0, 1] }}
                      className="rounded-2xl bg-white border border-canvas-border shadow-[0_12px_40px_-16px_rgba(23,3,48,0.18)] p-5"
                    >
                      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-ink-400 mb-3">Step 1 — give Ira context</p>

                      {/* upload zone */}
                      <input
                        ref={fileRef}
                        type="file"
                        multiple
                        accept=".pdf,.docx,.doc,.xlsx,.xls,.csv"
                        className="hidden"
                        aria-label="Upload SOP or DOA documents"
                        onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
                      />
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="w-full rounded-xl border-2 border-dashed border-ink-300/70 hover:border-brand-400 hover:bg-brand-50/60 transition-colors px-4 py-5 flex flex-col items-center gap-1.5 cursor-pointer group"
                      >
                        <div className="size-9 rounded-lg bg-brand-50 group-hover:bg-brand-100 flex items-center justify-center transition-colors">
                          <Upload size={15} className="text-brand-600" />
                        </div>
                        <p className="text-[0.8125rem] font-semibold text-ink-800">Upload SOPs & DOAs</p>
                        <p className="text-[0.6875rem] text-ink-400">PDF, Word, or Excel — approval matrices, process notes, policies</p>
                      </button>

                      {/* uploaded chips */}
                      <AnimatePresence>
                        {uploads.length > 0 && (
                          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-1.5">
                            {uploads.map(u => (
                              <motion.li
                                key={u.id}
                                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-brand-50/60 border border-brand-100"
                              >
                                <FileText size={13} className="text-brand-600 shrink-0" />
                                <span className="text-[0.75rem] font-medium text-ink-700 truncate flex-1">{u.name}</span>
                                <span className="text-[0.625rem] text-ink-400 shrink-0">{u.size}</span>
                                {u.status === 'parsing' ? (
                                  <span className="flex items-center gap-1 text-[0.625rem] font-semibold text-brand-600 shrink-0">
                                    <Loader2 size={11} className="animate-spin" /> Parsing
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[0.625rem] font-semibold text-emerald-600 shrink-0">
                                    <Check size={11} /> Parsed
                                  </span>
                                )}
                                <button
                                  type="button"
                                  aria-label={`Remove ${u.name}`}
                                  onClick={() => setUploads(prev => prev.filter(x => x.id !== u.id))}
                                  className="text-ink-300 hover:text-ink-700 cursor-pointer shrink-0"
                                >
                                  <X size={12} />
                                </button>
                              </motion.li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>

                      {/* web search toggle */}
                      <div className="mt-4 flex items-center gap-3 px-3.5 py-3 rounded-xl bg-canvas border border-canvas-border">
                        <div className="size-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                          <Globe size={14} className="text-brand-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.8125rem] font-semibold text-ink-800">Web search</p>
                          <p className="text-[0.6875rem] text-ink-400 leading-snug">Pull current SOX 404, IFC & ISO 27001 guidance into the plan</p>
                        </div>
                        <Toggle checked={webSearch} onChange={setWebSearch} ariaLabel="Toggle web search" />
                      </div>

                      {/* CTA */}
                      <button
                        type="button"
                        onClick={() => setStep('thinking')}
                        className="mt-5 w-full h-12 rounded-xl bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 text-white text-[0.9375rem] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_8px_24px_-8px_rgba(106,18,205,0.55)] hover:shadow-[0_10px_30px_-8px_rgba(106,18,205,0.65)]"
                      >
                        <Sparkles size={16} />
                        Generate my audit plan
                        <ArrowRight size={15} />
                      </button>
                      <p className="mt-2.5 text-center text-[0.6875rem] text-ink-400">
                        Takes about 15 seconds · nothing goes live without your sign-off
                      </p>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* ════════ STEP: THINKING ════════ */}
              {step === 'thinking' && (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-7 pb-6"
                >
                  {/* pulsing core */}
                  <div className="relative mb-7" aria-hidden="true">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="absolute inset-0 rounded-full border border-brand-300"
                        animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
                        transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
                      />
                    ))}
                    <motion.div
                      className="size-16 rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center shadow-[0_8px_36px_-8px_rgba(106,18,205,0.6)]"
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Sparkles size={26} className="text-white" />
                    </motion.div>
                  </div>

                  <h3 className="font-display text-[1.75rem] mb-1.5 text-ink-900">
                    <TextShimmer as="span" className="font-display" duration={2.4} spread={1.5}>
                      Ira is designing your audit universe
                    </TextShimmer>
                  </h3>
                  <p className="text-[0.8125rem] text-ink-400 mb-7 h-4">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={scanLine}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                        className="inline-block font-mono text-[0.6875rem] tracking-tight"
                      >
                        {scanLine}
                      </motion.span>
                    </AnimatePresence>
                  </p>

                  {/* phases */}
                  <div className="w-full max-w-md space-y-2 mb-7">
                    {thinkingPhases.map((p, i) => {
                      const Icon = p.icon;
                      const state = i < phaseIdx ? 'done' : i === phaseIdx ? 'active' : 'pending';
                      return (
                        <motion.div
                          key={p.label}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: state === 'pending' ? 0.45 : 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors ${
                            state === 'active' ? 'bg-brand-50 border-brand-200' : 'bg-white border-canvas-border'
                          }`}
                        >
                          <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                            state === 'done' ? 'bg-emerald-50' : state === 'active' ? 'bg-white' : 'bg-canvas'
                          }`}>
                            {state === 'done'
                              ? <Check size={14} className="text-emerald-600" />
                              : <Icon size={14} className={state === 'active' ? 'text-brand-600' : 'text-ink-400'} />}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className={`text-[0.8125rem] font-semibold ${state === 'done' ? 'text-ink-400' : 'text-ink-800'}`}>{p.label}</p>
                            {state === 'active' && <p className="text-[0.6875rem] text-brand-600">{p.detail}</p>}
                          </div>
                          {state === 'active' && <Loader2 size={14} className="text-brand-500 animate-spin shrink-0" />}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* live counters */}
                  <div className="flex items-center gap-2.5 mb-6">
                    {([
                      { label: 'engagements', n: planTotals.engagements, icon: ClipboardCheck },
                      { label: 'risks', n: planTotals.risks, icon: ShieldCheck },
                      { label: 'controls', n: planTotals.controls, icon: CheckCircle2 },
                      { label: 'workflows', n: planTotals.workflows, icon: Workflow },
                    ] as const).map(c => (
                      <div key={c.label} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-canvas-border shadow-[0_1px_2px_rgba(15,8,30,0.03)]">
                        <c.icon size={13} className="text-brand-600" />
                        <span className="text-[1.0625rem] font-bold text-ink-900 tabular-nums">{Math.round(c.n * eased)}</span>
                        <span className="text-[0.6875rem] text-ink-400">{c.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* progress */}
                  <div className="w-full max-w-md h-1 rounded-full bg-ink-500/12 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 via-fuchsia-500 to-brand-500 transition-[width] duration-150"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </motion.div>
              )}

              {/* ════════ STEP: ENGAGEMENTS ════════ */}
              {step === 'engagements' && (
                <motion.div
                  key="engagements"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <div className="shrink-0 px-7 pb-3">
                    <h3 className="font-display text-[1.5rem] text-ink-900 leading-tight">
                      Ira recommends {plan.length} engagements
                    </h3>
                    <p className="text-[0.8125rem] text-ink-500">
                      Grounded in {dbSources.length} databases{uploads.length > 0 ? `, ${uploads.length} document${uploads.length > 1 ? 's' : ''}` : ''}{webSearch ? ' and current regulatory guidance' : ''}.
                      Select, edit names & descriptions inline, and set timelines.
                    </p>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto px-7 pb-4 space-y-3">
                    {plan.map((eng, i) => (
                      <motion.div
                        key={eng.id}
                        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07, duration: 0.3, ease: [0.2, 0, 0, 1] }}
                        onClick={() => patchEng(eng.id, { selected: !eng.selected })}
                        className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                          eng.selected
                            ? 'bg-white border-brand-400 shadow-[0_8px_28px_-12px_rgba(106,18,205,0.3)]'
                            : 'bg-white/70 border-canvas-border hover:border-brand-200'
                        }`}
                      >
                        <div className="flex gap-3.5">
                          <div className="pt-0.5">
                            <SelectDot selected={eng.selected} onToggle={() => patchEng(eng.id, { selected: !eng.selected })} label={`Include ${eng.name}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <AiBadge />
                              <span className="px-2 h-[18px] inline-flex items-center rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-semibold">{eng.type}{eng.subtype ? ` · ${eng.subtype}` : ''}</span>
                              <span className="px-2 h-[18px] inline-flex items-center rounded-full bg-ink-500/12 text-ink-600 text-[0.625rem] font-semibold">{eng.process}</span>
                              <span className="px-2 h-[18px] inline-flex items-center rounded-full bg-ink-500/10 text-ink-500 text-[0.625rem] font-medium">{eng.framework}</span>
                              <span className="ml-auto flex items-center gap-1.5 shrink-0" title="Ira's confidence in this recommendation">
                                <span className="w-16 h-1 rounded-full bg-ink-500/12 overflow-hidden">
                                  <span className="block h-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500" style={{ width: `${eng.confidence}%` }} />
                                </span>
                                <span className="text-[0.6875rem] font-bold text-brand-700 tabular-nums">{eng.confidence}%</span>
                              </span>
                            </div>

                            <h4 className="text-[1rem] font-semibold text-ink-900 leading-snug">
                              <InlineText value={eng.name} onCommit={v => patchEng(eng.id, { name: v })} label={`${eng.name} name`} inputClassName="text-[1rem] font-semibold" />
                            </h4>
                            <p className="text-[0.8125rem] text-ink-500 leading-relaxed mt-0.5">
                              <InlineText multiline value={eng.description} onCommit={v => patchEng(eng.id, { description: v })} label={`${eng.name} description`} inputClassName="text-[0.8125rem]" />
                            </p>

                            {/* rationale + sources */}
                            <div className="mt-2.5 px-3 py-2 rounded-lg bg-brand-50 border border-brand-100">
                              <p className="text-[0.75rem] text-brand-900/80 leading-relaxed">
                                <Sparkles size={11} className="inline-block mr-1 -mt-0.5 text-brand-500" />
                                {eng.rationale}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {eng.sources.map(s => (
                                  <span key={s} className="px-1.5 h-[17px] inline-flex items-center gap-1 rounded bg-white border border-brand-100 text-ink-500 text-[0.625rem] font-medium">
                                    {s.includes('(web)') ? <Globe size={8} /> : s.includes('SOP') || s.includes('DOA') ? <FileText size={8} /> : <Database size={8} />}
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* timeline + composition */}
                            <div className="flex items-center gap-4 mt-2.5 flex-wrap" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                <CalendarRange size={13} className="text-ink-400" />
                                <input
                                  type="month"
                                  value={eng.startMonth}
                                  aria-label={`${eng.name} start month`}
                                  onChange={e => patchEng(eng.id, { startMonth: e.target.value || eng.startMonth })}
                                  className="h-7 px-2 rounded-md bg-white border border-canvas-border text-[0.75rem] text-ink-700 outline-none focus:border-brand-400 cursor-pointer"
                                />
                                <span className="text-ink-400 text-[0.75rem]">→</span>
                                <input
                                  type="month"
                                  value={eng.endMonth}
                                  aria-label={`${eng.name} end month`}
                                  onChange={e => patchEng(eng.id, { endMonth: e.target.value || eng.endMonth })}
                                  className="h-7 px-2 rounded-md bg-white border border-canvas-border text-[0.75rem] text-ink-700 outline-none focus:border-brand-400 cursor-pointer"
                                />
                              </div>
                              <div className="flex items-center gap-3 text-[0.6875rem] text-ink-500 ml-auto">
                                <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-ink-400" />{eng.risks.length} risks</span>
                                <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-ink-400" />{eng.controls.length} controls</span>
                                <span className="flex items-center gap-1"><Workflow size={11} className="text-ink-400" />{eng.workflows.length} workflows</span>
                                <span className="text-ink-300">·</span>
                                <span>{eng.owner}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ════════ STEP: CONTROLS ════════ */}
              {step === 'controls' && (
                <motion.div
                  key="controls"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <div className="shrink-0 px-7 pb-3">
                    <h3 className="font-display text-[1.5rem] text-ink-900 leading-tight">Control register</h3>
                    <p className="text-[0.8125rem] text-ink-500">Every risk and control Ira drafted, per engagement. Toggle what stays, edit anything inline.</p>
                  </div>

                  <EngTabs engs={selectedEngs} activeId={activeEngId} onPick={setActiveEngId} metric={e => `${e.controls.filter(c => c.selected).length}/${e.controls.length}`} />

                  {selectedEngs.filter(e => e.id === activeEngId).map(eng => (
                    <div key={eng.id} className="flex-1 min-h-0 overflow-y-auto px-7 pb-4">
                      {/* risks */}
                      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-ink-400 mb-2 mt-1">Risks</p>
                      <div className="space-y-1.5 mb-5">
                        {eng.risks.map(risk => (
                          <div
                            key={risk.id}
                            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
                              risk.selected ? 'bg-white border-canvas-border shadow-[0_1px_2px_rgba(15,8,30,0.03)]' : 'bg-white/50 border-canvas-border/60 opacity-55'
                            }`}
                          >
                            <SelectDot selected={risk.selected} onToggle={() => patchItem(eng.id, 'risks', risk.id, { selected: !risk.selected })} label={`Include risk ${risk.title}`} />
                            <span className={`size-2 rounded-full shrink-0 ${SEVERITY_DOT[risk.severity]}`} title={`${risk.severity} severity`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[0.8125rem] font-semibold text-ink-800">
                                <InlineText value={risk.title} onCommit={v => patchItem(eng.id, 'risks', risk.id, { title: v })} label={`risk ${risk.title}`} inputClassName="text-[0.8125rem] font-semibold" />
                              </p>
                              <p className="text-[0.75rem] text-ink-500 leading-snug">
                                <InlineText multiline value={risk.description} onCommit={v => patchItem(eng.id, 'risks', risk.id, { description: v })} label={`risk ${risk.title} description`} inputClassName="text-[0.75rem]" />
                              </p>
                            </div>
                            <span className={`px-2 h-[18px] inline-flex items-center rounded-full text-[0.625rem] font-bold shrink-0 ${SEVERITY_CHIP[risk.severity]}`}>{risk.severity}</span>
                            <AiBadge compact />
                          </div>
                        ))}
                      </div>

                      {/* controls */}
                      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-ink-400 mb-2">Controls</p>
                      <div className="space-y-1.5">
                        {eng.controls.map(ctl => {
                          const risk = eng.risks.find(r => r.id === ctl.riskId);
                          return (
                            <div
                              key={ctl.id}
                              className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border transition-all ${
                                ctl.selected ? 'bg-white border-canvas-border shadow-[0_1px_2px_rgba(15,8,30,0.03)]' : 'bg-white/50 border-canvas-border/60 opacity-55'
                              }`}
                            >
                              <div className="pt-0.5">
                                <SelectDot selected={ctl.selected} onToggle={() => patchItem(eng.id, 'controls', ctl.id, { selected: !ctl.selected })} label={`Include control ${ctl.title}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-[0.6875rem] text-brand-600 tracking-tight">{ctl.controlId}</span>
                                  <p className="text-[0.8125rem] font-semibold text-ink-800">
                                    <InlineText value={ctl.title} onCommit={v => patchItem(eng.id, 'controls', ctl.id, { title: v })} label={`control ${ctl.title}`} inputClassName="text-[0.8125rem] font-semibold" />
                                  </p>
                                  <AiBadge compact />
                                </div>
                                <p className="text-[0.75rem] text-ink-500 leading-relaxed mt-0.5">
                                  <InlineText multiline value={ctl.description} onCommit={v => patchItem(eng.id, 'controls', ctl.id, { description: v })} label={`control ${ctl.title} description`} inputClassName="text-[0.75rem]" />
                                </p>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  {ctl.isKey && <span className="px-1.5 h-[17px] inline-flex items-center rounded bg-fuchsia-50 text-fuchsia-700 text-[0.625rem] font-bold">KEY</span>}
                                  <span className="px-1.5 h-[17px] inline-flex items-center rounded bg-ink-500/12 text-ink-500 text-[0.625rem] font-medium">{ctl.controlType}</span>
                                  <span className="px-1.5 h-[17px] inline-flex items-center rounded bg-ink-500/12 text-ink-500 text-[0.625rem] font-medium">{ctl.automation}</span>
                                  <span className="px-1.5 h-[17px] inline-flex items-center rounded bg-ink-500/12 text-ink-500 text-[0.625rem] font-medium">{ctl.frequency}</span>
                                  {risk && (
                                    <span className="px-1.5 h-[17px] inline-flex items-center gap-1 rounded bg-ink-500/10 text-ink-400 text-[0.625rem]">
                                      <span className={`size-1.5 rounded-full ${SEVERITY_DOT[risk.severity]}`} />
                                      mitigates: {risk.title}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* ════════ STEP: WORKFLOWS ════════ */}
              {step === 'workflows' && (
                <motion.div
                  key="workflows"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <div className="shrink-0 px-7 pb-3">
                    <h3 className="font-display text-[1.5rem] text-ink-900 leading-tight">Monitoring workflows</h3>
                    <p className="text-[0.8125rem] text-ink-500">Always-on workflows Ira matched to each engagement's controls. These start running once live.</p>
                  </div>

                  <EngTabs engs={selectedEngs} activeId={activeEngId} onPick={setActiveEngId} metric={e => `${e.workflows.filter(w => w.selected).length}/${e.workflows.length}`} />

                  {selectedEngs.filter(e => e.id === activeEngId).map(eng => (
                    <div key={eng.id} className="flex-1 min-h-0 overflow-y-auto px-7 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-1">
                        {eng.workflows.map((wf, i) => (
                          <motion.div
                            key={wf.id}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`rounded-xl border p-3.5 transition-all ${
                              wf.selected ? 'bg-white border-canvas-border shadow-[0_1px_2px_rgba(15,8,30,0.03)]' : 'bg-white/50 border-canvas-border/60 opacity-55'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="size-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                                <Workflow size={15} className="text-brand-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[0.8125rem] font-semibold text-ink-800 flex-1 min-w-0">
                                    <InlineText value={wf.name} onCommit={v => patchItem(eng.id, 'workflows', wf.id, { name: v })} label={`workflow ${wf.name}`} inputClassName="text-[0.8125rem] font-semibold" />
                                  </p>
                                  <SelectDot selected={wf.selected} onToggle={() => patchItem(eng.id, 'workflows', wf.id, { selected: !wf.selected })} label={`Include workflow ${wf.name}`} />
                                </div>
                                <p className="text-[0.75rem] text-ink-500 leading-relaxed mt-0.5">
                                  <InlineText multiline value={wf.description} onCommit={v => patchItem(eng.id, 'workflows', wf.id, { description: v })} label={`workflow ${wf.name} description`} inputClassName="text-[0.75rem]" />
                                </p>
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                  <AiBadge compact />
                                  <span className="px-1.5 h-[17px] inline-flex items-center gap-1 rounded bg-ink-500/12 text-ink-500 text-[0.625rem] font-medium">
                                    <Zap size={8} /> {wf.cadence}
                                  </span>
                                  <span className="px-1.5 h-[17px] inline-flex items-center rounded bg-ink-500/10 text-ink-400 text-[0.625rem] font-mono">
                                    evidences {wf.controlId}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* ════════ STEP: REVIEW ════════ */}
              {step === 'review' && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <div className="shrink-0 px-7 pb-3 text-center">
                    <h3 className="font-display text-[1.625rem] text-ink-900 leading-tight">Ready to go live</h3>
                    <p className="text-[0.8125rem] text-ink-500">
                      {selectedEngs.length} engagements · {countSelected('risks')} risks · {countSelected('controls')} controls · {countSelected('workflows')} workflows —
                      each lands in your Engagement Library with an AI&nbsp;Recommended badge.
                    </p>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto px-7 pb-4">
                    <div className="max-w-2xl mx-auto space-y-2.5 mt-2">
                      {selectedEngs.map((eng, i) => (
                        <motion.div
                          key={eng.id}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white border border-canvas-border shadow-[0_2px_10px_-4px_rgba(23,3,48,0.08)]"
                        >
                          <div className="size-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                            <ClipboardCheck size={17} className="text-brand-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[0.875rem] font-semibold text-ink-900 truncate">{eng.name}</p>
                              <AiBadge compact />
                            </div>
                            <p className="text-[0.6875rem] text-ink-500">
                              {eng.type} · {monthLabel(eng.startMonth)} – {monthLabel(eng.endMonth)} · {eng.owner}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-[0.6875rem] text-ink-500 shrink-0 tabular-nums">
                            <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-ink-400" />{eng.risks.filter(r => r.selected).length}</span>
                            <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-ink-400" />{eng.controls.filter(c => c.selected).length}</span>
                            <span className="flex items-center gap-1"><Workflow size={11} className="text-ink-400" />{eng.workflows.filter(w => w.selected).length}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ════════ STEP: LIVE ════════ */}
              {step === 'live' && (
                <motion.div
                  key="live"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-7 pb-8"
                >
                  {!liveDone ? (
                    <>
                      <motion.div
                        className="size-14 rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center shadow-[0_8px_32px_-8px_rgba(106,18,205,0.55)] mb-6"
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Zap size={22} className="text-white" />
                      </motion.div>
                      <h3 className="font-display text-[1.5rem] mb-6 text-ink-900">
                        <TextShimmer as="span" className="font-display" duration={2} spread={1.5}>
                          Taking your engagements live
                        </TextShimmer>
                      </h3>
                      <div className="w-full max-w-sm space-y-2">
                        {selectedEngs.map((eng, i) => (
                          <div key={eng.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
                            i < liveIdx ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-canvas-border opacity-55'
                          }`}>
                            {i < liveIdx
                              ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                              : i === liveIdx
                                ? <Loader2 size={15} className="text-brand-500 animate-spin shrink-0" />
                                : <span className="size-[15px] rounded-full border border-ink-300 shrink-0" />}
                            <span className="text-[0.8125rem] font-medium text-ink-700 truncate flex-1">{eng.name}</span>
                            <span className="font-mono text-[0.625rem] text-ink-400 shrink-0">{eng.code}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
                      className="flex flex-col items-center text-center"
                    >
                      <div className="relative mb-6">
                        {[0, 1].map(i => (
                          <motion.span
                            key={i}
                            className="absolute inset-0 rounded-full border border-emerald-300"
                            animate={{ scale: [1, 2.1], opacity: [0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
                          />
                        ))}
                        <div className="size-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center shadow-[0_8px_36px_-8px_rgba(52,211,153,0.55)]">
                          <Check size={30} className="text-white" strokeWidth={3} />
                        </div>
                      </div>
                      <h3 className="font-display text-[1.875rem] text-ink-900 mb-2">Your engagements are live</h3>
                      <p className="text-[0.875rem] text-ink-500 max-w-md leading-relaxed mb-5">
                        {countSelected('controls')} controls and {countSelected('workflows')} monitoring workflows are now
                        in your Engagement Library — each tagged <span className="text-brand-700 font-semibold">AI Recommended</span>.
                      </p>

                      {/* the engagements that just went live */}
                      <div className="w-full max-w-md space-y-2 mb-7 text-left">
                        {selectedEngs.map((eng, i) => (
                          <motion.div
                            key={eng.id}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 + i * 0.08 }}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-emerald-200 shadow-[0_1px_2px_rgba(15,8,30,0.03)]"
                          >
                            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                            <span className="text-[0.8125rem] font-semibold text-ink-800 truncate flex-1">{eng.name}</span>
                            <span className="font-mono text-[0.625rem] text-ink-400 shrink-0">{eng.code}</span>
                            <span className="inline-flex items-center gap-1 px-2 h-[18px] rounded-full bg-emerald-50 text-emerald-700 text-[0.625rem] font-bold shrink-0">
                              <span className="relative flex size-1.5">
                                <span className="animate-ping absolute inline-flex size-full rounded-full bg-emerald-500 opacity-50" />
                                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                              </span>
                              Live
                            </span>
                          </motion.div>
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={goToEngagements}
                          className="h-11 px-6 rounded-xl bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 text-white text-[0.875rem] font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-[0_8px_24px_-8px_rgba(106,18,205,0.55)]"
                        >
                          Go to Engagements <ArrowRight size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={handleClose}
                          className="h-11 px-5 rounded-xl border border-canvas-border bg-white text-ink-600 hover:text-ink-900 hover:bg-canvas text-[0.875rem] font-semibold cursor-pointer transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── footer nav (plan steps only) ── */}
          {railIdx >= 0 && (
            <footer className="relative z-10 shrink-0 px-7 py-4 border-t border-canvas-border bg-white/80 backdrop-blur-md flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (step === 'controls') setStep('engagements');
                  else if (step === 'workflows') setStep('controls');
                  else if (step === 'review') setStep('workflows');
                }}
                disabled={step === 'engagements'}
                className="h-10 px-4 rounded-xl border border-canvas-border bg-white text-ink-600 hover:text-ink-900 hover:bg-canvas text-[0.8125rem] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-default"
              >
                <ArrowLeft size={14} /> Back
              </button>

              <p className="text-[0.75rem] text-ink-400 hidden sm:block">
                {step === 'engagements' && `${selectedEngs.length} of ${plan.length} engagements selected`}
                {step === 'controls' && `${countSelected('controls')} controls · ${countSelected('risks')} risks across ${selectedEngs.length} engagements`}
                {step === 'workflows' && `${countSelected('workflows')} workflows will start monitoring once live`}
                {step === 'review' && 'One click away — you can still edit everything later'}
              </p>

              {step !== 'review' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 'engagements') { setActiveEngId(selectedEngs[0]?.id ?? null); setStep('controls'); }
                    else if (step === 'controls') setStep('workflows');
                    else if (step === 'workflows') setStep('review');
                  }}
                  disabled={selectedEngs.length === 0}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 text-white text-[0.8125rem] font-semibold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-default shadow-[0_6px_20px_-8px_rgba(106,18,205,0.5)]"
                >
                  {step === 'engagements' ? 'Review controls' : step === 'controls' ? 'Review workflows' : 'Review & go live'}
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep('live')}
                  disabled={selectedEngs.length === 0}
                  className="h-11 px-6 rounded-xl bg-gradient-to-r from-brand-600 to-fuchsia-600 hover:from-brand-500 hover:to-fuchsia-500 text-white text-[0.875rem] font-bold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 shadow-[0_8px_24px_-8px_rgba(106,18,205,0.55)]"
                >
                  <Zap size={15} />
                  Make {selectedEngs.length} engagement{selectedEngs.length !== 1 ? 's' : ''} live
                </button>
              )}
            </footer>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ── engagement tab strip shared by the Controls / Workflows registers ── */
function EngTabs({
  engs, activeId, onPick, metric,
}: {
  engs: RecommendedEngagement[];
  activeId: string | null;
  onPick: (id: string) => void;
  metric: (e: RecommendedEngagement) => string;
}) {
  return (
    <div className="shrink-0 px-7 pb-3 flex items-center gap-1.5 overflow-x-auto">
      {engs.map(e => {
        const active = e.id === activeId;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onPick(e.id)}
            className={`flex items-center gap-2 px-3.5 h-8 rounded-full text-[0.75rem] font-semibold whitespace-nowrap cursor-pointer transition-all shrink-0 ${
              active
                ? 'bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white shadow-[0_4px_14px_-6px_rgba(106,18,205,0.5)]'
                : 'bg-white border border-canvas-border text-ink-500 hover:text-ink-800 hover:bg-brand-50'
            }`}
          >
            {e.name.length > 34 ? `${e.name.slice(0, 32)}…` : e.name}
            <span className={`px-1.5 h-[16px] inline-flex items-center rounded-full text-[0.5625rem] font-bold tabular-nums ${active ? 'bg-white/25 text-white' : 'bg-ink-500/12 text-ink-500'}`}>
              {metric(e)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
