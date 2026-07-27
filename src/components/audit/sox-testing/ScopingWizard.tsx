import { Fragment, useMemo, useState, type JSX } from 'react';
import { motion } from 'motion/react';
import {
  Building2, Landmark, Upload, FileSpreadsheet, Check, Plus, Trash2, X,
  ArrowRight, ArrowLeft, Loader2, Info,
  ShieldCheck, ClipboardList, Zap, AlertCircle,
} from 'lucide-react';
import { SourceChips } from './ProgrammeView';
import { OWNER_NAMES } from '../../../data/grc-domain';
import { registerEngagement, type EngType, type ProcessCode } from '../../../data/engagements';
import { useAuditLog } from '../../../context/AdminDataContext';
import {
  BASIS_OPTIONS, BEYOND_TB, QUAL_REASONS, SEED_ENTITIES,
  SEED_GROUP_NAME, SEED_QUAL_PICKS, SEED_TB_FILES, captionsForEntities,
  deriveRacms, entityShort, fmtCr, genCode,
  type GroupEntity, type MaterialityBasis, type ProcessName, type QualPick,
  type SoxProgramme, type TbCaption,
} from './soxTestingData';

const STEPS = ['Type & basics', 'Scoping', 'Materiality', 'Qualitative', 'Review'] as const;

/* ── Step 1 = the classic wizard's "Type & basics" screen, as-is ─────────── */
const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const basicsLabelCls = 'text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-1.5 block';

const TYPE_TILES: { type: EngType; icon: JSX.Element; tagline: string; tint: string; ring: string; iconWrap: string }[] = [
  { type: 'SOX / ICFR',     icon: <ShieldCheck size={22} />,    tagline: 'SOX 404 / ICFR — scoping, materiality rules, design + operating effectiveness, deficiency evaluation', tint: 'bg-brand-50/70 hover:bg-brand-50 text-brand-700 border-brand-200',          ring: 'ring-brand-600 ring-offset-2 ring-offset-canvas-elevated',     iconWrap: 'bg-brand-600 text-white' },
  { type: 'Compliance',     icon: <ShieldCheck size={22} />,    tagline: 'Framework-driven control testing',                              tint: 'bg-brand-50/70 hover:bg-brand-50 text-brand-700 border-brand-100',           ring: 'ring-brand-500 ring-offset-2 ring-offset-canvas-elevated',     iconWrap: 'bg-brand-100 text-brand-700' },
  { type: 'Internal Audit', icon: <ClipboardList size={22} />,  tagline: 'Process audit aligned to RACM + SOPs',                          tint: 'bg-evidence-50/70 hover:bg-evidence-50 text-evidence-700 border-evidence-100', ring: 'ring-evidence-500 ring-offset-2 ring-offset-canvas-elevated',  iconWrap: 'bg-evidence-100 text-evidence-700' },
  { type: 'Automation',     icon: <Zap size={22} />,             tagline: 'Continuous monitoring / reconciliation / MIS / forensic',      tint: 'bg-compliant-50/70 hover:bg-compliant-50 text-compliant-700 border-compliant-100', ring: 'ring-compliant-500 ring-offset-2 ring-offset-canvas-elevated', iconWrap: 'bg-compliant-100 text-compliant-700' },
];

/** The "Beyond the trial balance" workstream card is parked (user ask) — flip
 *  to true to bring it back. The beyond ids still store on the programme with
 *  their seeded defaults (all on), so the summary's workstreams strip keeps
 *  working. */
const BEYOND_TB_CARD = false;

const yeSegActive = 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20';
const yeSegIdle = 'border-border bg-white text-text-secondary hover:bg-surface-2';
const uploadBtnCls = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[11.5px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer';

const PROCESS_NAMES: ProcessName[] = [
  'Order to Cash', 'Procure to Pay', 'Inventory', 'Fixed Assets',
  'Payroll (Hire to Retire)', 'Treasury', 'Tax',
];

interface Props {
  onCancel: () => void;
  onCreated: (p: SoxProgramme) => void;
}

export default function ScopingWizard({ onCancel, onCreated }: Props) {
  const logEvent = useAuditLog();
  const [step, setStep] = useState(0);

  // Step 1 — type & basics. Only identity lives here: entity/company and
  // processes are NOT asked — the scoping steps collect and derive them.
  const [type, setType] = useState<EngType | null>('SOX / ICFR');
  const [name, setName] = useState('');
  const [code, setCode] = useState(genCode());
  const [description, setDescription] = useState('');
  // SOX is an annual recurring cycle, not a dated project — so no start/end
  // dates. The cycle is named by the year the group reports on: a financial
  // year (Apr–Mar) or a calendar year (Jan–Dec).
  const [yearBasis, setYearBasis] = useState<'fy' | 'cy'>('fy');
  /** End-year of the audit period — 2027 ⇒ FY 2026-27 (financial) / CY 2027 (calendar). */
  const [fyEnd, setFyEnd] = useState(2027);
  const [owner, setOwner] = useState(OWNER_NAMES[0]);

  const YEAR_OPTIONS = yearBasis === 'fy'
    ? [2026, 2027, 2028].map(y => ({ value: y, label: `FY ${y - 1}-${String(y).slice(-2)}` }))
    : [2025, 2026, 2027].map(y => ({ value: y, label: `CY ${y}` }));
  const fyLabel = YEAR_OPTIONS.find(o => o.value === fyEnd)?.label ?? `FY ${fyEnd}`;
  const fy = `FY${String(fyEnd).slice(-2)}`;
  const asOf = yearBasis === 'fy' ? `31 Mar ${fyEnd}` : `31 Dec ${fyEnd}`;

  // Step 2 — group & entities. The table starts empty: entities are mapped
  // from the uploaded RACM / trial balances, with manual add as the fallback.
  const [groupName, setGroupName] = useState(SEED_GROUP_NAME);
  const [entities, setEntities] = useState<GroupEntity[]>([]);
  const [racmUpload, setRacmUpload] = useState<'idle' | 'parsing' | 'done'>('idle');
  const [tbUpload, setTbUpload] = useState<'idle' | 'parsing' | 'done'>('idle');

  // Step 2 — materiality
  const [basis, setBasis] = useState<MaterialityBasis>('pbt');
  const basisOpt = BASIS_OPTIONS.find(b => b.id === basis)!;
  const [benchmark, setBenchmark] = useState(basisOpt.defaultBenchmark);
  const [pct, setPct] = useState(basisOpt.defaultPct);
  const [pmPct, setPmPct] = useState(75);
  const [cttPct, setCttPct] = useState(5);
  const overallCr = basis === 'custom' ? benchmark : Math.round(benchmark * pct * 100) / 10000;

  // Per-entity TB parse results — filled wholesale when the bulk trial-balance
  // upload lands on the group step (simulated parse).
  const [uploads, setUploads] = useState<Record<string, 'parsing' | { file: string; lines: number }>>({});

  // Step 4 — qualitative overlay
  const [qual, setQual] = useState<Record<string, QualPick & { on: boolean }>>(() => {
    const init: Record<string, QualPick & { on: boolean }> = {};
    for (const p of SEED_QUAL_PICKS) init[p.captionId] = { ...p, on: true };
    return init;
  });

  // Step 5 — process mapping + beyond-TB scope
  const [mapping, setMapping] = useState<Record<string, ProcessName>>({});
  const [beyond, setBeyond] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BEYOND_TB.map(b => [b.id, true])));

  /** All captions for the current entity set. */
  const captions = useMemo<TbCaption[]>(() => captionsForEntities(entities), [entities]);

  const captionProcess = (c: TbCaption): ProcessName => mapping[c.id] ?? c.process;
  /** Distinct processes extracted for one entity — shown on its Scoping row. */
  const entityProcesses = (entId: string): ProcessName[] =>
    [...new Set(captions.filter(c => c.entityId === entId).map(c => captionProcess(c)))];
  const quantScope = captions.filter(c => c.balance >= overallCr);
  const belowThreshold = captions.filter(c => c.balance < overallCr);
  const qualScope = belowThreshold.filter(c => qual[c.id]?.on);
  const inScope = useMemo(
    () => [...quantScope, ...qualScope].map(c => ({ ...c, process: captionProcess(c) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [captions, overallCr, qual, mapping],
  );
  const qualIds = new Set(qualScope.map(c => c.id));
  const derived = useMemo(() => deriveRacms(inScope, qualIds, entities),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inScope]);

  /** Distinct processes the seeded RACM "extracts" — shown after its parse. */
  const racmProcesses = useMemo(
    () => [...new Set(captionsForEntities(SEED_ENTITIES).map(c => c.process))], []);

  const canContinue = [
    type === 'SOX / ICFR' && name.trim().length > 0 && code.trim().length > 0,
    // Scoping runs on the trial-balance numbers, so the bulk TB upload gates
    // this step — the RACM upload and manual rows are optional on top.
    groupName.trim().length > 0 && entities.length > 0 && entities.every(e => e.name.trim()) && tbUpload === 'done',
    benchmark > 0 && (basis === 'custom' || pct > 0),
    // An empty scope derives zero RACMs — there is no programme to create.
    inScope.length > 0,
    true,
  ][step];

  const goNext = () => {
    if (!canContinue) return;
    setStep(s => s + 1);
  };

  /** Entities read off an uploaded file — merged by name so a row the user
   *  already typed never duplicates. */
  const mergeExtractedEntities = () => {
    setEntities(prev => {
      const have = new Set(prev.map(e => e.name.trim().toLowerCase()));
      return [...prev, ...SEED_ENTITIES.filter(e => !have.has(e.name.toLowerCase())).map(e => ({ ...e }))];
    });
  };

  const simulateRacmUpload = () => {
    setRacmUpload('parsing');
    window.setTimeout(() => { setRacmUpload('done'); mergeExtractedEntities(); }, 800);
  };

  /** Removing the last TB file re-arms the upload button (and the step gate). */
  const removeTbFile = (entityId: string) => {
    const next = { ...uploads };
    delete next[entityId];
    setUploads(next);
    if (Object.keys(next).length === 0) setTbUpload('idle');
  };

  /** "Upload more" — one button once anything is uploaded; parses whatever is
   *  still missing (a removed RACM, missing TBs, TBs for hand-added rows). */
  const simulateUploadMore = () => {
    setUploadingMore(true);
    window.setTimeout(() => {
      setUploadingMore(false);
      if (racmUpload !== 'done') setRacmUpload('done');
      if (tbUpload !== 'done') setTbUpload('done');
      mergeExtractedEntities();
      setUploads(prev => {
        const next = { ...prev };
        const known = [...entities, ...SEED_ENTITIES.filter(s => !entities.some(e => e.name.trim().toLowerCase() === s.name.toLowerCase()))];
        for (const e of known) {
          if (typeof next[e.id] !== 'object') {
            const slug = e.name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') || 'entity';
            next[e.id] = SEED_TB_FILES[e.id] ?? { file: `${slug}-tb-fy27.xlsx`, lines: 96 };
          }
        }
        return next;
      });
    }, 800);
  };

  const extractedReady = racmUpload === 'done' || tbUpload === 'done';
  const [uploadingMore, setUploadingMore] = useState(false);
  /** Hand-added entities have nothing extracted — the user types their
   *  processes; matching names remap the entity's generic captions. */
  const [manualProcs, setManualProcs] = useState<Record<string, string>>({});
  const applyManualProcs = (entId: string, text: string) => {
    setManualProcs(prev => ({ ...prev, [entId]: text }));
    const tokens = text.split(/[,·;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const chosen = PROCESS_NAMES.filter(p => tokens.some(t => p.toLowerCase().includes(t)));
    if (!chosen.length) return;
    const capIds = [1, 2, 3, 4].map(n => `tb-${entId}-0${n}`);
    setMapping(prev => {
      const next = { ...prev };
      capIds.forEach((cid, i) => { next[cid] = chosen[i % chosen.length]; });
      return next;
    });
  };

  const simulateTbUpload = () => {
    setTbUpload('parsing');
    window.setTimeout(() => {
      setTbUpload('done');
      mergeExtractedEntities();
      setUploads(Object.fromEntries(Object.entries(SEED_TB_FILES).map(([id, f]) => [id, { ...f }])));
    }, 800);
  };

  const create = () => {
    const id = `sox-prog-${Date.now()}`;
    // Register a real runtime engagement so the programme card opens the
    // classic SOX workspace (tabs, control testing) exactly like any other
    // SOX engagement — seeded with this scoping's materiality.
    const CR = 10_000_000;
    registerEngagement({
      id,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || `SOX 404 / ICFR programme — scoped from ${entities.length} trial balances; ${derived.length} in-scope processes, each a RACM.`,
      type: 'SOX / ICFR',
      soxConfig: {
        overallMateriality: Math.round(overallCr * CR),
        performanceMateriality: Math.round(overallCr * pmPct / 100 * CR),
        clearlyTrivial: Math.round(overallCr * cttPct / 100 * CR),
        sdBandPct: 20,
        aggregate: true,
        keyOnly: true,
      },
      // The workspace seeds one RACM per scoping-derived process, so the RACM
      // tab mirrors the scoping summary exactly.
      soxProcesses: derived.map(r => r.process),
      soxSeedMode: 'fresh',
      // No process was asked for — the anchor is the biggest scoping-derived
      // process (falls back to P2P).
      process: ({ 'Procure to Pay': 'P2P', 'Order to Cash': 'O2C' } as Partial<Record<ProcessName, ProcessCode>>)[derived[0]?.process] ?? 'P2P',
      framework: 'COSO 2013 / SOX 404',
      owner,
      status: 'Active',
      periodStart: yearBasis === 'fy' ? `Apr ${fyEnd - 1}` : `Jan ${fyEnd}`,
      periodEnd: yearBasis === 'fy' ? `Mar ${fyEnd}` : `Dec ${fyEnd}`,
      startDate: yearBasis === 'fy' ? `${fyEnd - 1}-04-01` : `${fyEnd}-01-01`,
      endDate: yearBasis === 'fy' ? `${fyEnd}-03-31` : `${fyEnd}-12-31`,
      entity: groupName.trim(),
      controls: 0,
      health: 0,
      openIssues: 0,
      lastActivity: 'Just created',
      nextScheduled: `Scoping — opinion as of ${asOf}`,
    });
    logEvent({
      action: 'Create',
      description: `Created SOX ICFR engagement "${name.trim()}" via scoping — ${derived.length} in-scope processes → ${derived.length} RACMs, materiality ${fmtCr(overallCr)}`,
      module: 'SOX ICFR',
      entity: 'Engagement',
    });
    const programme: SoxProgramme = {
      id,
      engagementId: id,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      owner,
      fy,
      asOf,
      phase: 'Scoping',
      groupName: groupName.trim(),
      entities: entities.map(e => {
        const up = uploads[e.id];
        return typeof up === 'object' ? { ...e, tbFile: up.file, tbLines: up.lines } : { ...e };
      }),
      materiality: {
        basis,
        benchmarkLabel: basisOpt.benchmarkLabel,
        benchmark,
        pct: basis === 'custom' ? 100 : pct,
        overall: overallCr,
        pmPct,
        cttPct,
      },
      totalCaptions: captions.length,
      quantCount: quantScope.length,
      qualCount: qualScope.length,
      racms: derived,
      beyondTb: BEYOND_TB.filter(b => beyond[b.id]).map(b => b.id),
    };
    onCreated(programme);
  };

  return (
    // min-h-full + flex column: on short steps the footer still sits pinned to
    // the modal's bottom edge instead of floating mid-air after the content.
    <div className="flex flex-col min-h-full">
      {/* Modal header — same eyebrow pattern as the scoping summary; no
          breadcrumb or back affordance, close is X / Escape / Cancel. */}
      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4">New engagement</div>

      <StepRail steps={STEPS} step={step} onStepClick={setStep} />

      <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        {step === 0 && (
          <StepShell
            title="Type & basics"
            sub="Pick the engagement type and identity — the classic first step. For SOX / ICFR, the scoping steps that follow derive everything else."
          >
            <div className="space-y-4">
              <div>
                <label className={basicsLabelCls}>Engagement type <span className="text-risk-700">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_TILES.map(t => {
                    const selected = type === t.type;
                    return (
                      <button
                        key={t.type}
                        onClick={() => setType(t.type)}
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
                {type !== 'SOX / ICFR' && (
                  <div className="mt-2 flex items-start gap-2 p-3 rounded-lg bg-surface-2/60 border border-border-light">
                    <Info size={13} className="text-text-muted shrink-0 mt-0.5" />
                    <p className="text-[0.75rem] text-text-muted leading-relaxed">
                      Compliance, Internal Audit and Automation engagements are created from the classic New Engagement flow. This scoping journey continues for SOX / ICFR.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className={basicsLabelCls}>Engagement name <span className="text-risk-700">*</span></label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. P2P — SOX Q3 Testing" className={inputCls} />
                {name.trim().length === 0 && <Hint text="Name is required" />}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={basicsLabelCls}>Code <span className="text-risk-700">*</span></label>
                  <input type="text" value={code} onChange={e => setCode(e.target.value)} className={`${inputCls} font-mono uppercase`} />
                  <p className="text-[0.6875rem] text-ink-500 mt-1">Auto-generated — edit if your team uses its own scheme.</p>
                  {code.trim().length === 0 && <Hint text="Code is required" />}
                </div>
                <div>
                  <label className={basicsLabelCls}>Owner <span className="text-risk-700">*</span></label>
                  <select value={owner} onChange={e => setOwner(e.target.value)} className={selectCls}>
                    {OWNER_NAMES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-50/50 border border-brand-100">
                <Info size={13} className="text-brand-700 shrink-0 mt-0.5" />
                <p className="text-[0.75rem] text-text-secondary leading-relaxed">
                  No entity or process fields here — the group and its entities are listed in the next step, and the in-scope processes are derived from the trial-balance scoping.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={basicsLabelCls}>Year type <span className="text-risk-700">*</span></label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => { if (yearBasis !== 'fy') { setYearBasis('fy'); setFyEnd(y => y + 1); } }}
                      className={`px-2 py-1.5 rounded-lg border text-[0.75rem] font-bold transition-all cursor-pointer ${yearBasis === 'fy' ? yeSegActive : yeSegIdle}`}
                    >
                      Financial year
                      <span className="block text-[0.625rem] font-semibold opacity-70">Apr – Mar</span>
                    </button>
                    <button
                      onClick={() => { if (yearBasis !== 'cy') { setYearBasis('cy'); setFyEnd(y => y - 1); } }}
                      className={`px-2 py-1.5 rounded-lg border text-[0.75rem] font-bold transition-all cursor-pointer ${yearBasis === 'cy' ? yeSegActive : yeSegIdle}`}
                    >
                      Calendar year
                      <span className="block text-[0.625rem] font-semibold opacity-70">Jan – Dec</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className={basicsLabelCls}>Audit period <span className="text-risk-700">*</span></label>
                  <select value={fyEnd} onChange={e => setFyEnd(Number(e.target.value))} className={selectCls}>
                    {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[0.75rem] text-ink-500 -mt-1">
                An annual cycle, not a dated project — testing runs {yearBasis === 'fy' ? `Apr ${fyEnd - 1} – Mar ${fyEnd}` : `Jan – Dec ${fyEnd}`} and the programme carries the {fyLabel} name through testing and roll-forward.
              </p>
              <div>
                <label className={basicsLabelCls}>Description <span className="normal-case font-medium text-ink-400">(optional)</span></label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="One-line description of scope and intent." className={inputCls + ' resize-none'} />
              </div>
            </div>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            title="Scoping"
            sub="Upload the RACM and trial balances — entities land below with the processes extracted for each, and every caption's process mapping can be adjusted before materiality decides what's in scope."
          >
            {/* Uploads live with the group (user ask): the docs render as ONE
                line of chips under the name, and after the first upload the two
                buttons collapse into "Upload more" for anything left out. */}
            <div className="mb-5">
              <div className="max-w-xl">
                <FieldLabel>Group (listed / holding)</FieldLabel>
                <input
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full px-3.5 py-2 text-[13px] border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                {racmUpload === 'done' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mr-0.5">RACM</span>
                )}
                {racmUpload === 'done' && (
                  <span className="inline-flex items-center gap-1.5 pl-2 pr-1 h-7 rounded-md border border-border-light bg-white min-w-0">
                    <FileSpreadsheet size={12} className="text-compliant-700 shrink-0" />
                    <span className="text-[11px] font-mono text-text-secondary truncate">airline-group-racm.xlsx</span>
                    <span className="text-[10.5px] text-text-muted tabular-nums shrink-0">· {SEED_ENTITIES.length} entities · {racmProcesses.length} processes extracted</span>
                    <button
                      onClick={() => setRacmUpload('idle')}
                      aria-label="Remove airline-group-racm.xlsx"
                      className="p-0.5 rounded text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </span>
                )}
                {Object.values(uploads).some(u => typeof u === 'object') && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider text-text-muted mr-0.5 ${racmUpload === 'done' ? 'ml-2.5' : ''}`}>Trial balances</span>
                )}
                {Object.entries(uploads).map(([entId, up]) => typeof up === 'object' && (
                  <span key={entId} className="inline-flex items-center gap-1.5 pl-2 pr-1 h-7 rounded-md border border-border-light bg-white min-w-0">
                    <FileSpreadsheet size={12} className="text-compliant-700 shrink-0" />
                    <span className="text-[11px] font-mono text-text-secondary truncate">{up.file}</span>
                    <span className="text-[10.5px] text-text-muted tabular-nums shrink-0">· {up.lines} lines</span>
                    <button
                      onClick={() => removeTbFile(entId)}
                      aria-label={`Remove ${up.file}`}
                      className="p-0.5 rounded text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {(racmUpload === 'parsing' || tbUpload === 'parsing' || uploadingMore) && (
                  <span className="inline-flex items-center gap-1.5 h-7 px-1 text-[11.5px] text-text-muted">
                    <Loader2 size={12} className="animate-spin" /> Parsing…
                  </span>
                )}
                {/* Each doc keeps its own button until it's in; only when BOTH
                    are uploaded do they collapse into "Upload more". */}
                {racmUpload === 'idle' && (
                  <button onClick={simulateRacmUpload} title="Risk & control matrix — entity and process information extracts from it" className={uploadBtnCls}>
                    <Upload size={12} /> Upload RACM
                  </button>
                )}
                {tbUpload === 'idle' && (
                  <button onClick={simulateTbUpload} title="Bulk upload — one file per entity or one workbook; entities extract from it" className={uploadBtnCls}>
                    <Upload size={12} /> Upload trial balances
                  </button>
                )}
                {racmUpload === 'done' && tbUpload === 'done' && !uploadingMore && (
                  <button
                    onClick={simulateUploadMore}
                    title="Upload anything left out — extra or replacement files"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary hover:bg-primary-hover text-white text-[11.5px] font-semibold transition-colors cursor-pointer ml-1"
                  >
                    <Upload size={12} /> Upload more
                  </button>
                )}
              </div>
            </div>
            <FieldLabel>
              Entities in scope of the group audit
              {(racmUpload === 'done' || tbUpload === 'done') && entities.length > 0 && ' — mapped from the uploads'}
            </FieldLabel>
            {/* Ownership % column — parked for now (grid was
                [2.4fr_1fr_0.8fr_44px] with an Ownership header cell and this
                per-row input; the data still seeds and shows downstream):
                <div className="flex items-center gap-1">
                  <input
                    type="number" min={1} max={100}
                    value={ent.ownership}
                    onChange={e => setEntities(prev => prev.map((x, j) => j === i ? { ...x, ownership: Number(e.target.value) } : x))}
                    className="w-14 text-[12px] tabular-nums text-text bg-white border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40"
                  />
                  <span className="text-[11px] text-text-muted">%</span>
                </div>
            */}
            <div className="border border-border-light rounded-xl bg-white overflow-hidden">
              <div className="grid grid-cols-[2fr_0.9fr_1.6fr_44px] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                <div>Entity</div><div>Type</div><div>Processes — extracted</div><div />
              </div>
              {entities.length === 0 && (
                <div className="px-4 py-6 text-center text-[12px] text-text-muted border-b border-border-light">
                  No entities yet — upload the RACM or trial balances above and they're mapped from the data, or add one by hand.
                </div>
              )}
              {entities.map((ent, i) => (
                <div key={ent.id} className="grid grid-cols-[2fr_0.9fr_1.6fr_44px] gap-3 px-4 py-2.5 items-center border-b border-border-light last:border-b-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {ent.type === 'Holding'
                      ? <Landmark size={14} className="text-brand-700 shrink-0" />
                      : <Building2 size={14} className="text-text-muted shrink-0" />}
                    <input
                      value={ent.name}
                      onChange={e => setEntities(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      className="w-full text-[13px] text-text bg-transparent outline-none border-b border-transparent focus:border-primary/40 transition-colors py-0.5"
                    />
                  </div>
                  <select
                    value={ent.type}
                    onChange={e => setEntities(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value as GroupEntity['type'] } : x))}
                    className="text-[12px] text-text-secondary bg-white border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40 cursor-pointer"
                  >
                    <option>Holding</option>
                    <option>Subsidiary</option>
                  </select>
                  {(() => {
                    // Hand-added rows: nothing was extracted — the user fills it in
                    if (ent.id.startsWith('ent-new-')) {
                      return (
                        <input
                          value={manualProcs[ent.id] ?? ''}
                          onChange={e => applyManualProcs(ent.id, e.target.value)}
                          aria-label={`Processes for ${ent.name || 'new entity'}`}
                          placeholder="Type the processes — e.g. Order to Cash, Treasury"
                          className="w-full text-[11px] text-text-secondary bg-transparent outline-none border-b border-transparent focus:border-primary/40 transition-colors py-0.5"
                        />
                      );
                    }
                    const procs = extractedReady ? entityProcesses(ent.id) : [];
                    return (
                      <div className="text-[11px] text-text-muted leading-snug min-w-0 truncate" title={procs.join(', ')}>
                        {procs.length ? procs.join(' · ') : '—'}
                      </div>
                    );
                  })()}
                  <button
                    onClick={() => setEntities(prev => prev.filter((_, j) => j !== i))}
                    disabled={entities.length === 1}
                    aria-label={`Remove ${ent.name}`}
                    className="p-1.5 rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer justify-self-end"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setEntities(prev => [...prev, { id: `ent-new-${prev.length}-${Date.now()}`, name: '', type: 'Subsidiary', ownership: 100 }])}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold text-primary hover:bg-primary/5 w-full transition-colors cursor-pointer"
              >
                <Plus size={13} /> Add entity
              </button>
            </div>
            {entities.length > 0 && tbUpload !== 'done' && (
              <Hint text="Upload the trial balances to continue — scoping runs on their numbers." />
            )}

            {/* Mapping lives here now (absorbed from the old Mapping step) —
                ALL extracted captions, since materiality hasn't run yet. */}
            {extractedReady && entities.length > 0 && (
              <>
                <div className="mt-5">
                  <FieldLabel>Map accounts to processes — every extracted caption</FieldLabel>
                  <div className="border border-border-light rounded-xl bg-white overflow-hidden">
                    <div className="grid grid-cols-[1.8fr_0.9fr_1.3fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                      <div>Extracted caption</div><div>Entity</div><div>Process</div>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto">
                      {captions.map(row => (
                        <div key={row.id} className="grid grid-cols-[1.8fr_0.9fr_1.3fr] gap-3 px-4 py-2 items-center border-b border-border-light last:border-b-0">
                          <div className="text-[12.5px] text-text truncate">{row.caption}</div>
                          <div className="text-[11.5px] text-text-muted">{entityShort(row.entityId, entities)}</div>
                          <select
                            value={captionProcess(row)}
                            onChange={e => setMapping(prev => ({ ...prev, [row.id]: e.target.value as ProcessName }))}
                            className="text-[11.5px] text-text-secondary bg-white border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40 cursor-pointer"
                          >
                            {PROCESS_NAMES.map(p => <option key={p}>{p}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Helper line parked (user ask):
                  <p className="text-[11px] text-text-muted mt-2">The processes come from the uploaded RACM — adjust any caption that landed on the wrong one.</p>
                  */}
                </div>

                {BEYOND_TB_CARD && (
                <div className="mt-4 border border-border-light rounded-xl bg-white p-4">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Beyond the trial balance</div>
                  <p className="text-[11px] text-text-muted mb-3 leading-relaxed">Always considered for scope — they never appear as TB captions.</p>
                  <div className="space-y-1.5">
                    {BEYOND_TB.map(b => {
                      const on = beyond[b.id];
                      return (
                        <button
                          key={b.id}
                          onClick={() => setBeyond(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                          className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                            on ? 'border-primary/30 bg-primary/5' : 'border-transparent bg-surface-2/50 hover:bg-surface-2'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded inline-flex items-center justify-center shrink-0 mt-0.5 border ${
                            on ? 'bg-primary border-primary text-white' : 'border-border bg-white'
                          }`}>
                            {on && <Check size={10} />}
                          </span>
                          <span>
                            <span className="block text-[12px] font-semibold text-text">{b.name}</span>
                            <span className="block text-[11px] text-text-muted leading-relaxed mt-0.5">{b.why}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}
              </>
            )}
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            title="Materiality — set before any testing"
            sub="Pick the basis that fits the group, and the thresholds cascade from it. These numbers decide which trial-balance captions get flagged in the next step."
          >
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {BASIS_OPTIONS.map(b => {
                const active = basis === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => { setBasis(b.id); setBenchmark(b.defaultBenchmark); setPct(b.defaultPct); }}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      active ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border-light bg-white hover:border-primary/30'
                    }`}
                  >
                    <div className={`text-[12.5px] font-semibold ${active ? 'text-primary' : 'text-text'}`}>{b.label}</div>
                    <div className="text-[11px] text-text-muted mt-1 leading-relaxed">{b.hint}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="border border-border-light rounded-xl bg-white p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>{basisOpt.benchmarkLabel} (₹ Cr)</FieldLabel>
                    <input
                      type="number" min={0}
                      value={benchmark}
                      onChange={e => setBenchmark(Number(e.target.value))}
                      className="w-full px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  {basis !== 'custom' && (
                    <div>
                      <FieldLabel>Basis %</FieldLabel>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={0.1} max={100} step={0.1}
                          value={pct}
                          onChange={e => setPct(Number(e.target.value))}
                          className="w-20 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                        />
                        <span className="text-[12px] text-text-muted truncate">% of {basisOpt.benchmarkLabel.toLowerCase()}</span>
                      </div>
                    </div>
                  )}
                </div>
                {basis !== 'custom' && (
                  <div>
                    <FieldLabel>Overall materiality (₹ Cr)</FieldLabel>
                    <div className="flex items-center gap-2">
                      <div className="w-40 px-3 py-2 text-[13px] font-semibold tabular-nums border border-border-light rounded-lg bg-surface-2/60 text-text">
                        {fmtCr(overallCr)}
                      </div>
                      <span className="text-[12px] text-text-muted">= {pct}% × {fmtCr(benchmark)} — switch to Custom amount to set it directly</span>
                    </div>
                  </div>
                )}
                <div>
                  <FieldLabel>Performance materiality (% of overall)</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={50} max={75} step={5}
                      value={pmPct}
                      onChange={e => setPmPct(Number(e.target.value))}
                      className="w-20 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    />
                    <span className="text-[12px] text-text-muted">% of overall — auditors typically set 50–75%</span>
                  </div>
                </div>
                <div>
                  <FieldLabel>Clearly-trivial threshold (% of overall)</FieldLabel>
                  <input
                    type="number" min={1} max={10}
                    value={cttPct}
                    onChange={e => setCttPct(Number(e.target.value))}
                    className="w-20 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              {/* Computed ladder */}
              <div className="border border-border-light rounded-xl bg-white p-4">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">Computed thresholds</div>
                <LadderRow label="Overall materiality" value={fmtCr(overallCr)} strong
                  note={basis === 'custom' ? 'Set directly' : `${pct}% × ${fmtCr(benchmark)}`} />
                <LadderRow label="Performance materiality" value={fmtCr(overallCr * pmPct / 100)} note={`${pmPct}% of overall — the working threshold for testing`} />
                <LadderRow label="Clearly trivial" value={fmtCr(overallCr * cttPct / 100)} note={`${cttPct}% of overall — below this, differences are passed`} last />
                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border-light">
                  <Info size={13} className="text-text-muted shrink-0 mt-0.5" />
                  <p className="text-[11.5px] text-text-muted leading-relaxed">
                    Materiality is locked before testing starts. Captions at or above {fmtCr(overallCr)} are flagged automatically in the next step.
                  </p>
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            title="Qualitative overlay"
            sub="Some captions sit below materiality but still belong in scope — small balances with huge flows, or complex accounting. Scope them in with a reason."
          >
            {belowThreshold.length === 0 && (
              <div className="border border-dashed border-border rounded-xl bg-white/60 px-6 py-10 text-center">
                <Info size={18} className="mx-auto text-text-muted mb-2" />
                <div className="text-[13px] font-semibold text-text">Nothing sits below {fmtCr(overallCr)}</div>
                <p className="text-[12px] text-text-secondary mt-1 max-w-md mx-auto leading-relaxed">
                  Every caption is already flagged quantitatively at this materiality, so there is nothing left to scope in by judgement. Continue to the mapping step.
                </p>
              </div>
            )}
            {belowThreshold.length > 0 && (
            <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-semibold text-text">
                {quantScope.length} of {captions.length} captions cleared materiality automatically
              </span>
              <span className="text-[11.5px] text-text-muted">across {entities.length} entities · threshold {fmtCr(overallCr)}</span>
            </div>
            <div className="border border-border-light rounded-xl bg-white overflow-hidden">
              <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_1.7fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                <div>Caption (below {fmtCr(overallCr)})</div><div>Entity</div><div className="text-right">Balance</div><div>Scope in</div>
              </div>
              {belowThreshold.map(row => {
                const q = qual[row.id];
                const on = q?.on ?? false;
                return (
                  <div key={row.id} className={`border-b border-border-light last:border-b-0 ${on ? 'bg-brand-50/30' : ''}`}>
                    <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_1.7fr] gap-3 px-4 py-2.5 items-center">
                      <div className="text-[12.5px] text-text">{row.caption}</div>
                      <div className="text-[11.5px] text-text-muted">{entityShort(row.entityId, entities)}</div>
                      <div className="text-[12px] font-mono tabular-nums text-right text-text-secondary">{fmtCr(row.balance)}</div>
                      <div className="flex items-center gap-2">
                        <button
                          role="switch"
                          aria-checked={on}
                          aria-label={`Scope in ${row.caption}`}
                          onClick={() => setQual(prev => ({
                            ...prev,
                            [row.id]: on
                              ? { ...prev[row.id], on: false }
                              : { captionId: row.id, reason: prev[row.id]?.reason ?? QUAL_REASONS[0], note: prev[row.id]?.note ?? '', on: true },
                          }))}
                          className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer shrink-0 ${on ? 'bg-primary' : 'bg-surface-3'}`}
                        >
                          <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all ${on ? 'left-[18px]' : 'left-[2px]'}`} />
                        </button>
                        {on && (
                          <select
                            value={q?.reason}
                            onChange={e => setQual(prev => ({ ...prev, [row.id]: { ...prev[row.id], reason: e.target.value as QualPick['reason'] } }))}
                            className="text-[11.5px] text-text-secondary bg-white border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40 cursor-pointer min-w-0"
                          >
                            {QUAL_REASONS.map(r => <option key={r}>{r}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                    {on && q?.note && (
                      <div className="px-4 pb-2.5 -mt-1">
                        <p className="text-[11.5px] text-text-muted leading-relaxed pl-0.5">{q.note}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
            )}
            {/* Empty-scope guard — lived on the Mapping step until it was
                absorbed into Scoping; this is now the last gate before Review. */}
            {inScope.length === 0 && (
              <div className="border border-dashed border-border rounded-xl bg-white/60 px-6 py-8 text-center mt-4">
                <AlertCircle size={18} className="mx-auto text-risk-700 mb-2" />
                <div className="text-[13px] font-semibold text-text">Nothing is in scope at {fmtCr(overallCr)}</div>
                <p className="text-[12px] text-text-secondary mt-1 max-w-md mx-auto leading-relaxed">
                  No caption clears materiality and nothing is scoped in qualitatively — zero processes would derive, so there is no programme to create. Lower the threshold on the materiality step, or scope captions in above.
                </p>
              </div>
            )}
            <p className="text-[11.5px] text-text-muted mt-3">
              {qualScope.length} caption{qualScope.length === 1 ? '' : 's'} scoped in qualitatively — they join the {quantScope.length} quantitative flags.
            </p>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            title="Review — scoping decides the programme"
            sub="Confirm the derivation before the FY27 programme is created. Nothing below was picked by hand — it all flows from materiality and the trial balances."
          >
            <div className="grid grid-cols-1 gap-3 mb-4">
              <ReviewCard title="Group & entities">
                <div className="text-[13px] font-semibold text-text mb-1.5">{groupName}</div>
                {entities.map(e => (
                  <div key={e.id} className="flex items-center gap-1.5 text-[11.5px] text-text-secondary py-0.5">
                    {e.type === 'Holding' ? <Landmark size={11} className="text-brand-700" /> : <Building2 size={11} className="text-text-muted" />}
                    {e.name} <span className="text-text-muted">· {e.ownership}%</span>
                  </div>
                ))}
              </ReviewCard>
              <ReviewCard title="Materiality">
                <LadderRow label="Overall" value={fmtCr(overallCr)} strong note={basis === 'custom' ? 'Set directly' : `${pct}% of ${basisOpt.benchmarkLabel.toLowerCase()}`} />
                <LadderRow label="Performance" value={fmtCr(overallCr * pmPct / 100)} note={`${pmPct}% of overall`} />
                <LadderRow label="Clearly trivial" value={fmtCr(overallCr * cttPct / 100)} note={`${cttPct}% of overall`} last />
              </ReviewCard>
              <ReviewCard title="Scope funnel">
                <FunnelRow label="TB captions parsed" value={captions.length} />
                <FunnelRow label="Flagged above materiality" value={quantScope.length} />
                <FunnelRow label="Scoped in qualitatively" value={qualScope.length} />
                <FunnelRow label="Processes derived" value={derived.length} />
                <FunnelRow label="Group-level workstreams" value={BEYOND_TB.filter(b => beyond[b.id]).length} last />
              </ReviewCard>
            </div>

            <div className="border border-border-light rounded-xl bg-white p-4">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">
                RACMs to be generated — one per in-scope process
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {derived.map(r => (
                  <div key={r.process} className="rounded-lg p-3 bg-surface-2/50">
                    <div className="text-[12.5px] font-semibold text-text">{r.process}</div>
                    <div className="text-[10.5px] text-text-muted mt-0.5 mb-2 tabular-nums">
                      {r.sources.length} source caption{r.sources.length === 1 ? '' : 's'} · {r.entities.join(', ')}
                    </div>
                    <SourceChips sources={r.sources} max={3} />
                  </div>
                ))}
                {BEYOND_TB.filter(b => beyond[b.id]).map(b => (
                  <div key={b.id} className="rounded-lg p-3 bg-surface-2/60">
                    <div className="text-[12.5px] font-semibold text-text-secondary">{b.name}</div>
                    <div className="text-[10.5px] text-text-muted mt-0.5">Group-level workstream — scoped without a TB caption</div>
                  </div>
                ))}
              </div>
            </div>
          </StepShell>
        )}
      </motion.div>

      {/* Footer — pinned to the modal's bottom edge (mt-auto on short steps,
          sticky over the scroll on tall ones) so Back/Continue never float */}
      <div className="mt-auto pt-6" />
      <div className="flex items-center justify-between py-4 border-t border-border-light sticky bottom-0 bg-canvas -mx-6 px-6">
        <button
          onClick={() => (step === 0 ? onCancel() : setStep(s => s - 1))}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-[12.5px] font-semibold text-text-secondary transition-colors cursor-pointer"
        >
          <ArrowLeft size={13} /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={goNext}
            disabled={!canContinue}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue <ArrowRight size={13} />
          </button>
        ) : (
          <button
            onClick={create}
            disabled={derived.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={13} /> Create {fy} programme
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** The step rail is the only header — steps open straight with their one-line
 *  explainer (the user asked the duplicate per-step titles removed). */
function StepShell({ sub, children }: { title?: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12.5px] text-text-secondary mb-5 leading-relaxed">{sub}</p>
      {children}
    </div>
  );
}

/** Step rail — fills the modal width; circles in a row with the label beneath
 *  each, connectors aligned to circle centre. Travelled path tints brand;
 *  upcoming steps stay quiet. Shared by the scoping and roll-forward flows. */
export function StepRail({ steps, step, onStepClick }: {
  steps: readonly string[];
  step: number;
  onStepClick: (i: number) => void;
}) {
  return (
    <div className="flex items-start w-full mb-6 pr-8">
      {steps.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <Fragment key={label}>
            {i > 0 && <div className={`flex-1 h-px mt-3 mx-2 min-w-3 transition-colors ${i <= step ? 'bg-brand-300' : 'bg-border-light'}`} />}
            <button
              onClick={() => { if (done) onStepClick(i); }}
              disabled={!done}
              className={`flex flex-col items-center gap-1.5 shrink-0 ${done ? 'cursor-pointer group' : ''}`}
            >
              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[10.5px] font-bold tabular-nums transition-colors ${
                active ? 'bg-primary text-white shadow-sm shadow-brand-900/10'
                : done ? 'bg-brand-100 text-brand-700 group-hover:bg-brand-200'
                : 'border border-border bg-white text-text-muted'
              }`}>
                {done ? <Check size={11} /> : i + 1}
              </span>
              <span className={`text-[11px] font-semibold whitespace-nowrap transition-colors ${
                active ? 'text-primary' : done ? 'text-brand-700' : 'text-text-muted'
              }`}>
                {label}
              </span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return <div className="mt-1 flex items-center gap-1 text-[0.75rem] text-risk-700"><AlertCircle size={11} /> {text}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{children}</div>;
}

function LadderRow({ label, value, note, strong, last }: {
  label: string; value: string; note?: string; strong?: boolean; last?: boolean;
}) {
  return (
    <div className={`py-2 ${last ? '' : 'border-b border-border-light'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[12px] ${strong ? 'font-semibold text-text' : 'text-text-secondary'}`}>{label}</span>
        <span className={`font-mono tabular-nums ${strong ? 'text-[15px] font-bold text-text' : 'text-[13px] text-text'}`}>{value}</span>
      </div>
      {note && <div className="text-[10.5px] text-text-muted mt-0.5">{note}</div>}
    </div>
  );
}

function FunnelRow({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${last ? '' : 'border-b border-border-light'}`}>
      <span className="text-[12px] text-text-secondary">{label}</span>
      <span className="text-[13px] font-bold tabular-nums text-text">{value}</span>
    </div>
  );
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border-light rounded-xl bg-white p-4">
      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2.5">{title}</div>
      {children}
    </div>
  );
}
