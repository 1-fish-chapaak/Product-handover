import { Fragment, useMemo, useState, type JSX } from 'react';
import { motion } from 'motion/react';
import {
  Building2, Landmark, Upload, FileSpreadsheet, Check, Plus, Trash2,
  ArrowRight, ArrowLeft, Loader2, Sparkles, Info,
  ShieldCheck, ClipboardList, Zap, AlertCircle,
} from 'lucide-react';
import { SourceChips } from '../ProgrammeView';
import { OWNER_NAMES } from '../../../../data/grc-domain';
import { registerEngagement, type EngType, type ProcessCode } from '../../../../data/engagements';
import { useAuditLog } from '../../../../context/AdminDataContext';
import {
  BASIS_OPTIONS, BEYOND_TB, QUAL_REASONS, captionsForEntities,
  deriveRacms, entityShort, fmtCr, genCode,
  type GroupEntity, type MaterialityBasis, type ProcessName, type QualPick,
  type SoxProgramme, type TbCaption,
} from '../soxTestingData';
import {
  V2C_CAPTIONS, V2C_ENTITIES, V2C_GROUP, V2C_GROUP_SHARE,
  V2C_ITGC_SYSTEMS, V2C_PEOPLE, V2C_QUAL_PICKS, V2C_TB_FILES,
  type V2cPerson,
} from './v2ClassicStore';
import type { DerivedRacm } from '../soxTestingData';

/**
 * V2 fork of the classic ScopingWizard — the sandbox where call-aligned
 * decisions land one at a time. Applied so far:
 *   #1 Materiality before entities — thresholds are set first, the entity
 *      list comes after (call: materiality decides what gets scoped).
 *   #2 Performance materiality is the scoping threshold — captions are
 *      flagged at PM (50–75% of overall), not at overall materiality.
 *   #3 Fourth named basis — % of net assets (pre-revenue / construction).
 *   #4 Entity scope is DERIVED, never hand-picked — an entity is in when its
 *      own TB clears performance materiality somewhere.
 *   #5 Coverage rule — in-scope entities must cover ~60% of the group; the
 *      largest remaining entities are pulled in until the bar is met.
 *   #6 A qualitative pick pulls its whole entity into scope, not just the
 *      caption.
 *   #7 Workstreams are real RACMs — FSCP / Consolidation / ELC become RACM
 *      shells, and ITGC is scoped PER SYSTEM (one RACM per picked system).
 *      Later COMMENTED OUT by user instruction — see the WS_CARD flag.
 *   #8 People step — every RACM gets a process owner and a control owner
 *      (different people, with emails); evidence chasing runs on them.
 *   (#9 — dropping the engagement-type tiles — was DECIDED AGAINST: the tool
 *   hosts multiple engagement types, so the type step stays.)
 * The wizard seeds the Altura 8-entity group (the V2 tab's own story) — the
 * classic Airline trio is all-huge, so derivation would never visibly bite.
 * Classic ScopingWizard stays untouched.
 */
const STEPS = ['Type & basics', 'Materiality', 'Entities', 'Trial balance', 'Qualitative', 'Mapping', 'People', 'Review'] as const;

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

const yeSegActive = 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20';
const yeSegIdle = 'border-border bg-white text-text-secondary hover:bg-surface-2';

const PROCESS_NAMES: ProcessName[] = [
  'Order to Cash', 'Procure to Pay', 'Inventory', 'Fixed Assets',
  'Payroll (Hire to Retire)', 'Treasury', 'Tax',
];

/** #3 — the classic four options plus % of net assets, V2 only. */
const V2_BASIS_OPTIONS: typeof BASIS_OPTIONS = [
  ...BASIS_OPTIONS.slice(0, 2),
  {
    id: 'netAssets',
    label: '% of net assets',
    hint: 'Pre-revenue / under construction — 0.5–1% of net assets',
    defaultPct: 0.75,
    benchmarkLabel: 'Net assets (consolidated)',
    defaultBenchmark: 1850,
  },
  ...BASIS_OPTIONS.slice(2),
];

/** #5 — the coverage rule: in-scope entities must cover this share of the
 *  group before scoping is done (the IHC / Mubadala archetype from the call). */
const COVERAGE_TARGET = 60;

/** #7 — COMMENTED OUT by user instruction (Jul 24): the "Beyond the TB —
 *  workstream RACMs" card (FSCP/Consolidation/ELC toggles + per-system ITGC
 *  picker) is hidden and the wizard derives process RACMs only. The beyondTb
 *  ids still store on the programme (classic parity — the scoping summary
 *  keeps its workstreams strip). Flip to true to resurrect the whole card. */
const WS_CARD = false as boolean;

/** Share of the consolidated group per entity — what the coverage meter sums.
 *  Entities added in the wizard default to 2% until their numbers land. */
const shareOf = (id: string) => V2C_GROUP_SHARE[id] ?? 2;

/** Captions for the Altura seed entities + the classic generic fallback for
 *  entities the user adds in the wizard. */
function v2CaptionsForEntities(entities: GroupEntity[]): TbCaption[] {
  const seeded = new Set(V2C_ENTITIES.map(e => e.id));
  return entities.flatMap(e => seeded.has(e.id)
    ? V2C_CAPTIONS.filter(c => c.entityId === e.id)
    : captionsForEntities([e]));
}

/** #4/#5/#6 — how an entity ended up in (or out of) scope. */
type EntityScopeStatus = 'derived' | 'qualitative' | 'coverage' | 'out';

const SCOPE_PILL: Record<EntityScopeStatus, { label: string; cls: string }> = {
  derived:     { label: 'In scope — TB',       cls: 'bg-brand-50 text-brand-700' },
  qualitative: { label: 'In scope — qual',     cls: 'bg-evidence-50 text-evidence-700' },
  coverage:    { label: 'In scope — coverage', cls: 'bg-mitigated-50 text-mitigated-700' },
  out:         { label: 'Out of scope',        cls: 'bg-surface-2 text-text-muted' },
};

interface Props {
  onCancel: () => void;
  onCreated: (p: SoxProgramme) => void;
}

export default function V2ScopingWizard({ onCancel, onCreated }: Props) {
  const logEvent = useAuditLog();
  const [step, setStep] = useState(0);

  // Step 1 — type & basics. Only identity lives here: entity/company and
  // processes are NOT asked — the scoping steps collect and derive them.
  const [type, setType] = useState<EngType | null>('SOX / ICFR');
  const [name, setName] = useState('');
  const [code, setCode] = useState(genCode());
  const [description, setDescription] = useState('');
  // SOX is an annual recurring cycle, not a dated project — so no start/end
  // dates. The cycle is named by its fiscal year and anchored on the year-end
  // date the auditor opines "as of" (31 Mar for Apr–Mar reporters, 31 Dec for
  // calendar-year reporters).
  const [yearEndConv, setYearEndConv] = useState<'mar' | 'dec'>('mar');
  /** End-year of the audit period — 2027 ⇒ FY 2026-27 (Mar) / FY 2027 (Dec). */
  const [fyEnd, setFyEnd] = useState(2027);
  const [owner, setOwner] = useState(OWNER_NAMES[0]);

  const FY_OPTIONS = yearEndConv === 'mar'
    ? [2026, 2027, 2028].map(y => ({ value: y, label: `FY ${y - 1}-${String(y).slice(-2)}` }))
    : [2025, 2026, 2027].map(y => ({ value: y, label: `FY ${y}` }));
  const fyLabel = FY_OPTIONS.find(o => o.value === fyEnd)?.label ?? `FY ${fyEnd}`;
  const fy = `FY${String(fyEnd).slice(-2)}`;
  const asOf = yearEndConv === 'mar' ? `31 Mar ${fyEnd}` : `31 Dec ${fyEnd}`;

  // Step 2 — group & entities (Altura — the V2 tab's seed group)
  const [groupName, setGroupName] = useState(V2C_GROUP);
  const [entities, setEntities] = useState<GroupEntity[]>(() => V2C_ENTITIES.map(e => ({ ...e })));

  // Step 2 — materiality
  const [basis, setBasis] = useState<MaterialityBasis>('pbt');
  const basisOpt = V2_BASIS_OPTIONS.find(b => b.id === basis)!;
  const [benchmark, setBenchmark] = useState(basisOpt.defaultBenchmark);
  const [pct, setPct] = useState(basisOpt.defaultPct);
  const [pmPct, setPmPct] = useState(75);
  const [cttPct, setCttPct] = useState(5);
  const overallCr = basis === 'custom' ? benchmark : Math.round(benchmark * pct * 100) / 10000;
  // #2 — performance materiality is the working threshold the scoping uses.
  const pmCr = Math.round(overallCr * pmPct) / 100;

  // Step 3 — trial balance uploads (simulated parse)
  const [uploads, setUploads] = useState<Record<string, 'parsing' | { file: string; lines: number }>>({});

  // Step 4 — qualitative overlay
  const [qual, setQual] = useState<Record<string, QualPick & { on: boolean }>>(() => {
    const init: Record<string, QualPick & { on: boolean }> = {};
    for (const p of V2C_QUAL_PICKS) init[p.captionId] = { ...p, on: true };
    return init;
  });

  // Step 5 — process mapping + beyond-TB scope
  const [mapping, setMapping] = useState<Record<string, ProcessName>>({});
  const [beyond, setBeyond] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BEYOND_TB.map(b => [b.id, true])));
  // #7 — ITGC is scoped per system; each picked system becomes its own RACM.
  // ERP + treasury system pre-picked (the GL always, Kyriba because Treasury
  // is in scope on the defaults).
  const [itgcSystems, setItgcSystems] = useState<Record<string, boolean>>({ erp: true, trs: true });

  // #8 — people per RACM. Suggestions prefill lazily; edits land here.
  const [people, setPeople] = useState<Record<string, V2cPerson>>({});
  const suggestionFor = (racmName: string): V2cPerson => {
    const key = racmName.startsWith('ITGC') ? 'ITGC'
      : racmName.includes('FSCP') ? 'FSCP'
      : racmName.includes('ELC') ? 'ELC'
      : racmName;
    return V2C_PEOPLE[key] ?? { processOwner: '', poEmail: '', controlOwner: '', coEmail: '' };
  };
  const personFor = (racmName: string): V2cPerson => people[racmName] ?? suggestionFor(racmName);
  const setPerson = (racmName: string, patch: Partial<V2cPerson>) =>
    setPeople(prev => ({ ...prev, [racmName]: { ...(prev[racmName] ?? suggestionFor(racmName)), ...patch } }));

  /** All captions for the current entity set. */
  const captions = useMemo<TbCaption[]>(() => v2CaptionsForEntities(entities), [entities]);

  const captionProcess = (c: TbCaption): ProcessName => mapping[c.id] ?? c.process;
  const quantScope = captions.filter(c => c.balance >= pmCr);
  const belowThreshold = captions.filter(c => c.balance < pmCr);
  const qualScope = belowThreshold.filter(c => qual[c.id]?.on);

  // #4/#5/#6 — entity scope is derived, never hand-picked:
  //   1. an entity is IN when its own TB clears performance materiality (#4);
  //   2. a qualitative pick pulls its whole entity in (#6);
  //   3. if in-scope entities still cover < the target share of the group,
  //      the largest remaining ones are pulled in for coverage (#5).
  const entityScope = useMemo(() => {
    const qualOn = new Set(captions.filter(c => c.balance < pmCr && qual[c.id]?.on).map(c => c.id));
    const status = new Map<string, { status: EntityScopeStatus; reason: string }>();
    for (const e of entities) {
      const top = captions
        .filter(c => c.entityId === e.id && c.balance >= pmCr)
        .sort((a, b) => b.balance - a.balance)[0];
      if (top) status.set(e.id, { status: 'derived', reason: `${top.caption} — ${fmtCr(top.balance)} clears performance materiality` });
    }
    for (const c of captions) {
      if (!status.has(c.entityId) && qualOn.has(c.id)) {
        status.set(c.entityId, { status: 'qualitative', reason: `Pulled in by the qualitative pick on ${c.caption}` });
      }
    }
    let coverage = entities.filter(e => status.has(e.id)).reduce((s, e) => s + shareOf(e.id), 0);
    const remaining = entities.filter(e => !status.has(e.id)).sort((a, b) => shareOf(b.id) - shareOf(a.id));
    for (const e of remaining) {
      if (coverage >= COVERAGE_TARGET) break;
      status.set(e.id, { status: 'coverage', reason: 'Pulled in for coverage — the largest remaining share tops coverage up to the target' });
      coverage += shareOf(e.id);
    }
    return { status, coveragePct: Math.round(coverage) };
  }, [entities, captions, pmCr, qual]);

  const scopeOf = (entityId: string): EntityScopeStatus =>
    entityScope.status.get(entityId)?.status ?? 'out';
  const inScopeEntityCount = entities.filter(e => entityScope.status.has(e.id)).length;

  /** #5 — a coverage-pulled entity contributes its largest caption to scope. */
  const coverageCaptions = useMemo(() =>
    entities
      .filter(e => entityScope.status.get(e.id)?.status === 'coverage')
      .map(e => captions.filter(c => c.entityId === e.id).sort((a, b) => b.balance - a.balance)[0])
      .filter((c): c is TbCaption => Boolean(c)),
  [entities, captions, entityScope]);
  const coverageIds = new Set(coverageCaptions.map(c => c.id));

  const inScope = useMemo(
    () => [...quantScope, ...qualScope, ...coverageCaptions].map(c => ({ ...c, process: captionProcess(c) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [captions, pmCr, qual, mapping, coverageCaptions],
  );
  const qualIds = new Set(qualScope.map(c => c.id));
  const derived = useMemo(() => deriveRacms(inScope, qualIds, entities),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inScope]);

  // #7 — toggled workstreams become real RACM shells; ITGC one per system.
  // Dormant while WS_CARD is off: no card, no workstream RACMs.
  const wsRacms = useMemo<DerivedRacm[]>(() => {
    const rows: DerivedRacm[] = [];
    if (!WS_CARD) return rows;
    for (const b of BEYOND_TB) {
      if (!beyond[b.id]) continue;
      if (b.id === 'itgc') {
        for (const s of V2C_ITGC_SYSTEMS) {
          if (itgcSystems[s.id]) {
            rows.push({ process: `ITGC — ${s.name}` as ProcessName, sources: [], entities: ['Group'], workstream: true });
          }
        }
      } else {
        rows.push({ process: b.name as ProcessName, sources: [], entities: ['Group'], workstream: true });
      }
    }
    return rows;
  }, [beyond, itgcSystems]);
  /** Everything the programme will carry — process RACMs + workstream RACMs. */
  const allRacms = useMemo(() => [...derived, ...wsRacms], [derived, wsRacms]);

  const allUploaded = entities.every(e => typeof uploads[e.id] === 'object');

  const canContinue = [
    type === 'SOX / ICFR' && name.trim().length > 0 && code.trim().length > 0,
    benchmark > 0 && (basis === 'custom' || pct > 0),
    groupName.trim().length > 0 && entities.length > 0 && entities.every(e => e.name.trim()),
    allUploaded,
    true,
    // An empty scope derives zero RACMs — there is no programme to create.
    inScope.length > 0,
    // #8 — every RACM needs both owners before the review.
    allRacms.every(r => {
      const p = personFor(r.process);
      return p.processOwner.trim().length > 0 && p.controlOwner.trim().length > 0;
    }),
    true,
  ][step];

  const goNext = () => {
    if (!canContinue) return;
    setStep(s => s + 1);
  };

  const simulateUpload = (entityId: string) => {
    setUploads(prev => ({ ...prev, [entityId]: 'parsing' }));
    const seeded = V2C_TB_FILES[entityId];
    const ent = entities.find(e => e.id === entityId);
    const slug = (ent?.name ?? 'entity').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
    const result = seeded ?? { file: `${slug}-tb-fy27.xlsx`, lines: 96 };
    window.setTimeout(() => {
      setUploads(prev => ({ ...prev, [entityId]: result }));
    }, 700);
  };

  // Bulk upload — one action, files auto-map to entities by name. The
  // metering TB deliberately arrives under an abbreviation ("asm-…") no
  // entity name matches, to walk the manual-mapping error path.
  const [bulkParsing, setBulkParsing] = useState(false);
  const [unmatched, setUnmatched] = useState<{ file: string; lines: number }[]>([]);
  const UNMATCHED_DEMO = { entityId: 'a-meter', file: 'asm-tb-fy27.xlsx', lines: 58 };
  const simulateBulkUpload = () => {
    setBulkParsing(true);
    window.setTimeout(() => {
      setUploads(prev => {
        const next = { ...prev };
        for (const e of entities) {
          if (e.id === UNMATCHED_DEMO.entityId) continue;
          if (typeof next[e.id] === 'object') continue;
          const slug = e.name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
          next[e.id] = V2C_TB_FILES[e.id] ?? { file: `${slug}-tb-fy27.xlsx`, lines: 96 };
        }
        return next;
      });
      const meter = entities.find(e => e.id === UNMATCHED_DEMO.entityId);
      setUnmatched(meter && typeof uploads[meter.id] !== 'object'
        ? [{ file: UNMATCHED_DEMO.file, lines: UNMATCHED_DEMO.lines }]
        : []);
      setBulkParsing(false);
    }, 1200);
  };
  /** Inline mapping — the unmatched file is assigned straight from the row
   *  of the entity it belongs to, not from a separate section. */
  const assignFileTo = (u: { file: string; lines: number }, entityId: string) => {
    setUploads(prev => ({ ...prev, [entityId]: { file: u.file, lines: u.lines } }));
    setUnmatched(prev => prev.filter(x => x.file !== u.file));
  };

  const create = () => {
    const id = `sox-prog-${Date.now()}`;
    // #8 — owners ride on every RACM the programme carries.
    const racmsOut = allRacms.map(r => {
      const p = personFor(r.process);
      return { ...r, processOwner: p.processOwner, controlOwner: p.controlOwner };
    });
    // Register a real runtime engagement so the programme card opens the
    // classic SOX workspace (tabs, control testing) exactly like any other
    // SOX engagement — seeded with this scoping's materiality.
    const CR = 10_000_000;
    registerEngagement({
      id,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || `SOX 404 / ICFR programme — scoped from ${entities.length} trial balances; ${derived.length} in-scope processes + ${wsRacms.length} group workstreams, each a RACM.`,
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
      // tab mirrors the scoping summary exactly. #7 — workstreams included
      // (non-catalogue names get the workspace's generic 5-control shell).
      soxProcesses: allRacms.map(r => r.process),
      soxSeedMode: 'fresh',
      // No process was asked for — the anchor is the biggest scoping-derived
      // process (falls back to P2P).
      process: ({ 'Procure to Pay': 'P2P', 'Order to Cash': 'O2C' } as Partial<Record<ProcessName, ProcessCode>>)[derived[0]?.process] ?? 'P2P',
      framework: 'COSO 2013 / SOX 404',
      owner,
      status: 'Active',
      periodStart: yearEndConv === 'mar' ? `Apr ${fyEnd - 1}` : `Jan ${fyEnd}`,
      periodEnd: yearEndConv === 'mar' ? `Mar ${fyEnd}` : `Dec ${fyEnd}`,
      startDate: yearEndConv === 'mar' ? `${fyEnd - 1}-04-01` : `${fyEnd}-01-01`,
      endDate: yearEndConv === 'mar' ? `${fyEnd}-03-31` : `${fyEnd}-12-31`,
      entity: groupName.trim(),
      controls: 0,
      health: 0,
      openIssues: 0,
      lastActivity: 'Just created',
      nextScheduled: `Scoping — opinion as of ${asOf}`,
    });
    logEvent({
      action: 'Create',
      description: `Created SOX ICFR engagement "${name.trim()}" via scoping — ${derived.length} in-scope processes + ${wsRacms.length} workstreams → ${allRacms.length} RACMs, materiality ${fmtCr(overallCr)}`,
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
      racms: racmsOut,
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
                  <label className={basicsLabelCls}>Fiscal year / audit period <span className="text-risk-700">*</span></label>
                  <select value={fyEnd} onChange={e => setFyEnd(Number(e.target.value))} className={selectCls}>
                    {FY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={basicsLabelCls}>Opinion “as of” — year-end <span className="text-risk-700">*</span></label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => { if (yearEndConv !== 'mar') { setYearEndConv('mar'); setFyEnd(y => y + 1); } }}
                      className={`px-2 py-2.5 rounded-lg border text-[0.75rem] font-bold tabular-nums transition-all cursor-pointer ${yearEndConv === 'mar' ? yeSegActive : yeSegIdle}`}
                    >
                      31 Mar {yearEndConv === 'mar' ? fyEnd : fyEnd + 1}
                    </button>
                    <button
                      onClick={() => { if (yearEndConv !== 'dec') { setYearEndConv('dec'); setFyEnd(y => y - 1); } }}
                      className={`px-2 py-2.5 rounded-lg border text-[0.75rem] font-bold tabular-nums transition-all cursor-pointer ${yearEndConv === 'dec' ? yeSegActive : yeSegIdle}`}
                    >
                      31 Dec {yearEndConv === 'dec' ? fyEnd : fyEnd - 1}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[0.75rem] text-ink-500 -mt-1">
                An annual cycle, not a dated project — testing runs through {fyLabel}; the auditor opines on control effectiveness as of {asOf}. Scoping window open since {yearEndConv === 'mar' ? `Apr ${fyEnd - 1}` : `Jan ${fyEnd}`}.
              </p>
              <div>
                <label className={basicsLabelCls}>Description <span className="normal-case font-medium text-ink-400">(optional)</span></label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="One-line description of scope and intent." className={inputCls + ' resize-none'} />
              </div>
            </div>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            title="Group structure"
            sub="The audit opinion is on the consolidated financials — but scoping runs on each entity's own trial balance. List the group and every entity in it."
          >
            <div className="max-w-xl mb-5">
              <FieldLabel>Group (listed / holding)</FieldLabel>
              <input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                className="w-full px-3.5 py-2 text-[13px] border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
            <FieldLabel>Entities in the group</FieldLabel>
            {/* #4 — the list is inventory, not scoping */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-50/50 border border-brand-100 mb-3">
              <Info size={13} className="text-brand-700 shrink-0 mt-0.5" />
              <p className="text-[0.75rem] text-text-secondary leading-relaxed">
                Scope is derived, never hand-picked — you only list the entities here. An entity lands in
                scope when its trial balance clears performance materiality, when a qualitative pick pulls
                it in, or when the {COVERAGE_TARGET}% coverage rule tops it up.
              </p>
            </div>
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
              <div className="grid grid-cols-[2.4fr_1fr_0.9fr_44px] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                <div>Entity</div><div>Type</div><div>Share of group</div><div />
              </div>
              {entities.map((ent, i) => (
                <div key={ent.id} className="grid grid-cols-[2.4fr_1fr_0.9fr_44px] gap-3 px-4 py-2.5 items-center border-b border-border-light last:border-b-0">
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
                  <div className="text-[12px] tabular-nums text-text-muted">{shareOf(ent.id)}%</div>
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
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            title="Materiality — set before any entity is judged"
            sub="Pick the basis that fits the group, and the thresholds cascade from it. These numbers decide which trial-balance captions get flagged once the entities upload their TBs."
          >
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {V2_BASIS_OPTIONS.map(b => {
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
                <LadderRow label="Overall materiality" value={fmtCr(overallCr)}
                  note={basis === 'custom' ? 'Set directly' : `${pct}% × ${fmtCr(benchmark)}`} />
                <LadderRow label="Performance materiality" value={fmtCr(pmCr)} strong note={`${pmPct}% of overall — the scoping threshold`} />
                <LadderRow label="Clearly trivial" value={fmtCr(overallCr * cttPct / 100)} note={`${cttPct}% of overall — below this, differences are passed`} last />
                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border-light">
                  <Info size={13} className="text-text-muted shrink-0 mt-0.5" />
                  <p className="text-[11.5px] text-text-muted leading-relaxed">
                    Materiality is locked before testing starts. Captions at or above performance
                    materiality ({fmtCr(pmCr)}) are flagged automatically once the trial balances are in.
                  </p>
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            title="Trial balance — quantitative scoping"
            sub={`Upload each entity's trial balance — or all of them at once. Captions at or above performance materiality (${fmtCr(pmCr)}) are flagged automatically, and the entity verdicts derive from them: TB clears the bar, a qualitative pick pulls it in, or the coverage rule tops it up.`}
            action={bulkParsing ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] text-text-muted">
                <Loader2 size={13} className="animate-spin" /> Parsing {entities.length} files…
              </div>
            ) : (
              <button
                onClick={simulateBulkUpload}
                disabled={allUploaded}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[12.5px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload size={13} /> Bulk upload TBs
              </button>
            )}
          >
            <div className="border border-border-light rounded-xl bg-white overflow-hidden mb-5">
              {entities.map(ent => {
                const up = uploads[ent.id];
                return (
                  <div key={ent.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border-light last:border-b-0">
                    {ent.type === 'Holding'
                      ? <Landmark size={14} className="text-brand-700 shrink-0" />
                      : <Building2 size={14} className="text-text-muted shrink-0" />}
                    <div className="flex-1 min-w-0 flex items-baseline gap-2">
                      <span className="text-[12.5px] font-semibold text-text truncate">{ent.name || 'Unnamed entity'}</span>
                      <span className="text-[10.5px] text-text-muted shrink-0">{ent.type} · {ent.ownership}%</span>
                    </div>
                    <div className="shrink-0">
                      {up === undefined && (
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {/* bulk leftovers map right here, on the row they belong to */}
                          {unmatched.map(u => (
                            <button
                              key={u.file}
                              onClick={() => assignFileTo(u, ent.id)}
                              title={`This file couldn't be matched to any entity by name — map it to ${ent.name || 'this entity'}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-mitigated-200 bg-mitigated-50/60 hover:bg-mitigated-50 text-[11.5px] font-semibold text-mitigated-700 transition-colors cursor-pointer"
                            >
                              <AlertCircle size={12} /> Map {u.file}
                            </button>
                          ))}
                          <button
                            onClick={() => simulateUpload(ent.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[11.5px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
                          >
                            <Upload size={12} /> Upload trial balance
                          </button>
                        </div>
                      )}
                      {up === 'parsing' && (
                        <div className="flex items-center gap-1.5 text-[11.5px] text-text-muted">
                          <Loader2 size={12} className="animate-spin" /> Parsing captions…
                        </div>
                      )}
                      {typeof up === 'object' && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileSpreadsheet size={13} className="text-compliant-700 shrink-0" />
                          <span className="text-[11px] font-mono text-text-secondary truncate">{up.file}</span>
                          <span className="text-[10.5px] text-text-muted tabular-nums shrink-0">· {up.lines} lines</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {allUploaded && (
              <>
                {/* #4/#5/#6 — the entity verdicts, derived live from the TBs */}
                <div className="border border-border-light rounded-xl bg-white p-4 mb-5">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-brand-700" />
                      <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Entity scope — derived, not picked</span>
                    </div>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[11.5px] text-text-secondary whitespace-nowrap">
                        <span className="font-bold tabular-nums text-text">{entityScope.coveragePct}%</span> of the group covered · target {COVERAGE_TARGET}%
                      </span>
                      <div className="relative w-36 h-1.5 rounded-full bg-surface-2 overflow-hidden shrink-0">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${entityScope.coveragePct >= COVERAGE_TARGET ? 'bg-brand-500' : 'bg-mitigated-500'}`}
                          style={{ width: `${Math.min(entityScope.coveragePct, 100)}%` }}
                        />
                        <div className="absolute inset-y-0 w-px bg-text-muted/60" style={{ left: `${COVERAGE_TARGET}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {entities.map(ent => {
                      const verdict = entityScope.status.get(ent.id);
                      const pill = SCOPE_PILL[verdict?.status ?? 'out'];
                      return (
                        <div key={ent.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface-2/40">
                          {ent.type === 'Holding'
                            ? <Landmark size={13} className="text-brand-700 shrink-0 mt-0.5" />
                            : <Building2 size={13} className="text-text-muted shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] font-semibold text-text truncate">{ent.name}</span>
                              <span className={`inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold shrink-0 ${pill.cls}`}>{pill.label}</span>
                            </div>
                            <div className="text-[10.5px] text-text-muted mt-0.5 leading-relaxed">
                              {shareOf(ent.id)}% of group · {verdict?.reason ?? `No caption clears ${fmtCr(pmCr)}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12px] font-semibold text-text">
                    {quantScope.length} of {captions.length} captions flagged
                  </span>
                  <span className="text-[11.5px] text-text-muted">across {entities.length} entities · threshold {fmtCr(pmCr)}</span>
                </div>
                <div className="border border-border-light rounded-xl bg-white overflow-hidden">
                  {entities.map(ent => {
                    const rows = captions.filter(c => c.entityId === ent.id);
                    return (
                      <div key={ent.id}>
                        <div className="px-4 py-2 bg-surface-2/60 border-b border-border-light text-[11px] font-semibold text-text-secondary flex items-center gap-2">
                          {ent.type === 'Holding' ? <Landmark size={12} /> : <Building2 size={12} />}
                          {ent.name}
                          <span className="text-text-muted font-normal">· {rows.filter(r => r.balance >= pmCr || coverageIds.has(r.id)).length}/{rows.length} in scope</span>
                        </div>
                        {rows.map(row => {
                          const inQ = row.balance >= pmCr;
                          const viaCoverage = coverageIds.has(row.id);
                          return (
                            <div key={row.id} className="grid grid-cols-[1.9fr_0.9fr_1fr] gap-3 px-4 py-2 items-center border-b border-border-light last:border-b-0">
                              <div className={`text-[12.5px] ${inQ || viaCoverage ? 'text-text' : 'text-text-muted'}`}>{row.caption}</div>
                              <div className={`text-[12px] font-mono tabular-nums text-right ${inQ || viaCoverage ? 'text-text' : 'text-text-muted'}`}>{fmtCr(row.balance)}</div>
                              <div className="justify-self-end">
                                {inQ ? (
                                  <span title="Above performance materiality" className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-700">
                                    <Check size={10} /> In scope
                                  </span>
                                ) : viaCoverage ? (
                                  <span title="Its entity was pulled in by the coverage rule" className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold bg-mitigated-50 text-mitigated-700">
                                    <Check size={10} /> Coverage
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-medium bg-surface-2 text-text-muted">
                                    Below threshold
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            title="Qualitative overlay"
            sub="Some captions sit below materiality but still belong in scope — small balances with huge flows, or complex accounting. Scope them in with a reason."
          >
            {belowThreshold.length === 0 && (
              <div className="border border-dashed border-border rounded-xl bg-white/60 px-6 py-10 text-center">
                <Info size={18} className="mx-auto text-text-muted mb-2" />
                <div className="text-[13px] font-semibold text-text">Nothing sits below {fmtCr(pmCr)}</div>
                <p className="text-[12px] text-text-secondary mt-1 max-w-md mx-auto leading-relaxed">
                  Every caption is already flagged quantitatively at this materiality, so there is nothing left to scope in by judgement. Continue to the mapping step.
                </p>
              </div>
            )}
            {belowThreshold.length > 0 && (
            <div className="border border-border-light rounded-xl bg-white overflow-hidden">
              <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_1.7fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                <div>Caption (below {fmtCr(pmCr)})</div><div>Entity</div><div className="text-right">Balance</div><div>Scope in</div>
              </div>
              {belowThreshold.map(row => {
                const q = qual[row.id];
                const on = q?.on ?? false;
                return (
                  <div key={row.id} className={`border-b border-border-light last:border-b-0 ${on ? 'bg-brand-50/30' : ''}`}>
                    <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_1.7fr] gap-3 px-4 py-2.5 items-center">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[12.5px] text-text truncate">{row.caption}</span>
                        {!on && coverageIds.has(row.id) && (
                          <span className="inline-flex items-center px-1.5 h-4 rounded text-[9px] font-bold uppercase tracking-wide bg-mitigated-50 text-mitigated-700 shrink-0" title="Already in scope — its entity was pulled in by the coverage rule">
                            In via coverage
                          </span>
                        )}
                      </div>
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
                    {on && (q?.note || scopeOf(row.entityId) === 'qualitative') && (
                      <div className="px-4 pb-2.5 -mt-1 flex items-start gap-2 flex-wrap">
                        {/* #6 — the pick doesn't just scope a caption, it pulls the whole entity */}
                        {scopeOf(row.entityId) === 'qualitative' && (
                          <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold bg-evidence-50 text-evidence-700 shrink-0">
                            <ArrowRight size={10} /> Pulls {entityShort(row.entityId, entities)} into scope
                          </span>
                        )}
                        {q?.note && <p className="text-[11.5px] text-text-muted leading-relaxed pl-0.5">{q.note}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
            <p className="text-[11.5px] text-text-muted mt-3">
              {qualScope.length} caption{qualScope.length === 1 ? '' : 's'} scoped in qualitatively — they join the {quantScope.length} quantitative flags.
              {' '}Entity coverage {entityScope.coveragePct}% of the group · target {COVERAGE_TARGET}%.
            </p>
          </StepShell>
        )}

        {step === 5 && (
          <StepShell
            title="Map accounts to processes"
            sub="Every in-scope caption maps to the business process that produces it — and each in-scope process becomes one RACM. Adjust any suggestion that's off."
          >
            {inScope.length === 0 && (
              <div className="border border-dashed border-border rounded-xl bg-white/60 px-6 py-10 text-center mb-4">
                <AlertCircle size={18} className="mx-auto text-risk-700 mb-2" />
                <div className="text-[13px] font-semibold text-text">Nothing is in scope at {fmtCr(pmCr)}</div>
                <p className="text-[12px] text-text-secondary mt-1 max-w-md mx-auto leading-relaxed">
                  No caption clears materiality and nothing is scoped in qualitatively — zero processes would derive, so there is no programme to create. Lower the threshold on the materiality step, or scope captions in on the qualitative step.
                </p>
              </div>
            )}
            {inScope.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              <div className="border border-border-light rounded-xl bg-white overflow-hidden self-start">
                <div className="grid grid-cols-[1.8fr_0.9fr_1.3fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                  <div>In-scope caption</div><div>Entity</div><div>Process</div>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {inScope.map(row => (
                    <div key={row.id} className="grid grid-cols-[1.8fr_0.9fr_1.3fr] gap-3 px-4 py-2 items-center border-b border-border-light last:border-b-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[12.5px] text-text truncate">{row.caption}</span>
                        {qualIds.has(row.id) && (
                          <span className="inline-flex items-center px-1.5 h-4 rounded text-[9px] font-bold uppercase tracking-wide bg-evidence-50 text-evidence-700 shrink-0" title="Scoped in qualitatively">
                            Qual
                          </span>
                        )}
                        {coverageIds.has(row.id) && (
                          <span className="inline-flex items-center px-1.5 h-4 rounded text-[9px] font-bold uppercase tracking-wide bg-mitigated-50 text-mitigated-700 shrink-0" title="Its entity was pulled in by the coverage rule">
                            Coverage
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-text-muted">{entityShort(row.entityId, entities)}</div>
                      <select
                        value={row.process}
                        onChange={e => setMapping(prev => ({ ...prev, [row.id]: e.target.value as ProcessName }))}
                        className="text-[11.5px] text-text-secondary bg-white border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40 cursor-pointer"
                      >
                        {PROCESS_NAMES.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {/* Derived processes preview */}
                <div className="border border-border-light rounded-xl bg-white p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Sparkles size={13} className="text-brand-700" />
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Derived in-scope processes</span>
                  </div>
                  <div className="space-y-2">
                    {derived.map(r => (
                      <div key={r.process} className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-text">{r.process}</span>
                        <span className="text-[11px] text-text-muted tabular-nums">{r.sources.length} caption{r.sources.length === 1 ? '' : 's'} · {r.entities.length} entit{r.entities.length === 1 ? 'y' : 'ies'}</span>
                      </div>
                    ))}
                    {/* #7 — workstreams sit in the same RACM list, tagged */}
                    {wsRacms.length > 0 && (
                      <div className="pt-2 border-t border-border-light space-y-2">
                        {wsRacms.map(r => (
                          <div key={r.process} className="flex items-center justify-between gap-2">
                            <span className="text-[12.5px] font-semibold text-text-secondary">{r.process}</span>
                            <span className="text-[11px] text-text-muted">Group-level workstream</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-3 pt-3 border-t border-border-light leading-relaxed">
                    Each of these — processes and workstreams alike — becomes one RACM when the programme is created.
                  </p>
                </div>

                {/* #7 — Beyond the TB card, commented out by user instruction
                    (Jul 24) — see WS_CARD at the top of the file */}
                {WS_CARD && (
                <div className="border border-border-light rounded-xl bg-white p-4">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Beyond the trial balance — workstream RACMs</div>
                  <p className="text-[11px] text-text-muted mb-3 leading-relaxed">They never appear as TB captions, but each one you keep becomes a real RACM — testable like any process register.</p>
                  <div className="space-y-1.5">
                    {BEYOND_TB.map(b => {
                      const on = beyond[b.id];
                      return (
                        <div key={b.id}>
                          <button
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
                          {/* ITGC is never one blob — one RACM per system relied on */}
                          {b.id === 'itgc' && on && (
                            <div className="ml-7 mt-1.5 mb-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">One RACM per system</div>
                              <div className="space-y-1">
                                {V2C_ITGC_SYSTEMS.map(s => {
                                  const picked = !!itgcSystems[s.id];
                                  return (
                                    <button
                                      key={s.id}
                                      onClick={() => setItgcSystems(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors cursor-pointer ${
                                        picked ? 'border-primary/30 bg-primary/5' : 'border-transparent hover:bg-surface-2'
                                      }`}
                                    >
                                      <span className={`w-3.5 h-3.5 rounded inline-flex items-center justify-center shrink-0 border ${
                                        picked ? 'bg-primary border-primary text-white' : 'border-border bg-white'
                                      }`}>
                                        {picked && <Check size={9} />}
                                      </span>
                                      <span className="text-[11.5px] font-semibold text-text">{s.name}</span>
                                      <span className="text-[10.5px] text-text-muted">· {s.role}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              {!V2C_ITGC_SYSTEMS.some(s => itgcSystems[s.id]) && (
                                <p className="text-[10.5px] text-risk-700 mt-1.5">No system picked — ITGC derives no RACM.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}
              </div>
            </div>
            )}
          </StepShell>
        )}

        {step === 6 && (
          <StepShell
            title="People — who owns the process, who owns the controls"
            sub="Most of the fieldwork is chasing evidence — and you can only chase named people. Every RACM gets a process owner (runs the area, gets chased) and a control owner (accountable that the controls operate). Suggestions are prefilled — adjust any."
          >
            <div className="border border-border-light rounded-xl bg-white overflow-hidden">
              <div className="grid grid-cols-[1.1fr_1.4fr_1.4fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                <div>RACM</div><div>Process owner</div><div>Control owner</div>
              </div>
              {allRacms.map(r => {
                const p = personFor(r.process);
                return (
                  <div key={r.process} className="grid grid-cols-[1.1fr_1.4fr_1.4fr] gap-3 px-4 py-2.5 items-start border-b border-border-light last:border-b-0">
                    <div className="pt-1 min-w-0">
                      <div className="text-[12.5px] font-semibold text-text truncate">{r.process}</div>
                      {r.workstream && (
                        <span className="inline-flex items-center px-1.5 h-4 rounded text-[9px] font-bold uppercase tracking-wide bg-surface-2 text-text-muted mt-1">
                          Workstream
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <input
                        value={p.processOwner}
                        onChange={e => setPerson(r.process, { processOwner: e.target.value })}
                        placeholder="Name"
                        aria-label={`Process owner for ${r.process}`}
                        className="w-full px-2.5 py-1.5 text-[12px] border border-border rounded-md bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      />
                      <input
                        value={p.poEmail}
                        onChange={e => setPerson(r.process, { poEmail: e.target.value })}
                        placeholder="email"
                        aria-label={`Process owner email for ${r.process}`}
                        className="w-full px-2.5 py-1 text-[11px] font-mono border border-border-light rounded-md bg-surface-2/40 text-text-secondary outline-none focus:border-primary/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <input
                        value={p.controlOwner}
                        onChange={e => setPerson(r.process, { controlOwner: e.target.value })}
                        placeholder="Name"
                        aria-label={`Control owner for ${r.process}`}
                        className="w-full px-2.5 py-1.5 text-[12px] border border-border rounded-md bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      />
                      <input
                        value={p.coEmail}
                        onChange={e => setPerson(r.process, { coEmail: e.target.value })}
                        placeholder="email"
                        aria-label={`Control owner email for ${r.process}`}
                        className="w-full px-2.5 py-1 text-[11px] font-mono border border-border-light rounded-md bg-surface-2/40 text-text-secondary outline-none focus:border-primary/40"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-50/50 border border-brand-100 mt-3">
              <Info size={13} className="text-brand-700 shrink-0 mt-0.5" />
              <p className="text-[0.75rem] text-text-secondary leading-relaxed">
                Process owner and control owner are deliberately different hats — the person who runs the area
                shouldn't be the only one vouching for its controls. Evidence requests and reminders go to these
                names once testing starts.
              </p>
            </div>
          </StepShell>
        )}

        {step === 7 && (
          <StepShell
            title="Review — scoping decides the programme"
            sub="Confirm the derivation before the FY27 programme is created. Nothing below was picked by hand — it all flows from materiality and the trial balances."
          >
            <div className="grid grid-cols-1 gap-3 mb-4">
              <ReviewCard title="Entity scope — derived">
                <div className="text-[13px] font-semibold text-text mb-1.5">{groupName}</div>
                {entities.map(e => {
                  const pill = SCOPE_PILL[scopeOf(e.id)];
                  return (
                    <div key={e.id} className="flex items-center gap-1.5 text-[11.5px] text-text-secondary py-0.5">
                      {e.type === 'Holding' ? <Landmark size={11} className="text-brand-700" /> : <Building2 size={11} className="text-text-muted" />}
                      <span className="flex-1 min-w-0 truncate">{e.name} <span className="text-text-muted">· {shareOf(e.id)}% of group</span></span>
                      <span className={`inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold shrink-0 ${pill.cls}`}>{pill.label}</span>
                    </div>
                  );
                })}
                <p className="text-[11px] text-text-muted mt-2 pt-2 border-t border-border-light">
                  {inScopeEntityCount} of {entities.length} entities in scope — {entityScope.coveragePct}% of the group covered · target {COVERAGE_TARGET}%.
                </p>
              </ReviewCard>
              <ReviewCard title="Materiality">
                <LadderRow label="Overall" value={fmtCr(overallCr)} note={basis === 'custom' ? 'Set directly' : `${pct}% of ${basisOpt.benchmarkLabel.toLowerCase()}`} />
                <LadderRow label="Performance" value={fmtCr(pmCr)} strong note={`${pmPct}% of overall — the scoping threshold`} />
                <LadderRow label="Clearly trivial" value={fmtCr(overallCr * cttPct / 100)} note={`${cttPct}% of overall`} last />
              </ReviewCard>
              <ReviewCard title="Scope funnel">
                <FunnelRow label="Entities derived in scope" value={inScopeEntityCount} />
                <FunnelRow label="TB captions parsed" value={captions.length} />
                <FunnelRow label="Flagged above performance materiality" value={quantScope.length} />
                <FunnelRow label="Scoped in qualitatively" value={qualScope.length} />
                <FunnelRow label="Pulled in for coverage" value={coverageCaptions.length} />
                <FunnelRow label="Processes derived" value={derived.length} last={wsRacms.length === 0} />
                {wsRacms.length > 0 && <FunnelRow label="Workstream RACMs" value={wsRacms.length} last />}
              </ReviewCard>
            </div>

            <div className="border border-border-light rounded-xl bg-white p-4">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">
                RACMs to be generated — one per in-scope process{wsRacms.length > 0 ? ' and workstream' : ''}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {derived.map(r => {
                  const p = personFor(r.process);
                  return (
                    <div key={r.process} className="rounded-lg p-3 bg-surface-2/50">
                      <div className="text-[12.5px] font-semibold text-text">{r.process}</div>
                      <div className="text-[10.5px] text-text-muted mt-0.5 mb-2 tabular-nums">
                        {r.sources.length} source caption{r.sources.length === 1 ? '' : 's'} · {r.entities.join(', ')}
                      </div>
                      <SourceChips sources={r.sources} max={3} />
                      {/* #8 — the people the chase will run on */}
                      <div className="text-[10.5px] text-text-secondary mt-2 pt-2 border-t border-border-light">
                        PO {ownerShort(p.processOwner)} · CO {ownerShort(p.controlOwner)}
                      </div>
                    </div>
                  );
                })}
                {/* #7 — workstreams are real RACMs now, same grammar */}
                {wsRacms.map(r => {
                  const p = personFor(r.process);
                  return (
                    <div key={r.process} className="rounded-lg p-3 bg-surface-2/60">
                      <div className="flex items-center gap-1.5">
                        <div className="text-[12.5px] font-semibold text-text">{r.process}</div>
                        <span className="inline-flex items-center px-1.5 h-4 rounded text-[9px] font-bold uppercase tracking-wide bg-surface-2 text-text-muted shrink-0">
                          Workstream
                        </span>
                      </div>
                      <div className="text-[10.5px] text-text-muted mt-0.5">Group-level — scoped without a TB caption</div>
                      <div className="text-[10.5px] text-text-secondary mt-2 pt-2 border-t border-border-light">
                        PO {ownerShort(p.processOwner)} · CO {ownerShort(p.controlOwner)}
                      </div>
                    </div>
                  );
                })}
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

function StepShell({ title, sub, action, children }: { title: string; sub: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold text-text">{title}</h2>
          <p className="text-[12.5px] text-text-secondary mt-1 mb-5 max-w-2xl leading-relaxed">{sub}</p>
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
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

/** People are named without a designation. Kept as the one place card footers
 *  fall back to a dash when a process has nobody against it yet. */
function ownerShort(s: string): string {
  return s.trim() || '—';
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
