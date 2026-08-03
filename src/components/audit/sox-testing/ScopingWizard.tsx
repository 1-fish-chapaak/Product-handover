import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { motion } from 'motion/react';
import {
  Building2, Landmark, Upload, FileText, Check, Circle, Plus, Trash2, X,
  ArrowRight, ArrowLeft, Loader2, Info, Sparkles,
  ShieldCheck, ClipboardList, Zap, AlertCircle,
} from 'lucide-react';
import { SourceChips } from './ProgrammeView';
import { FormSelect } from '../../shared/FilterSelect';
import { OWNER_NAMES } from '../../../data/grc-domain';
import { registerEngagement, type EngType, type ProcessCode } from '../../../data/engagements';
import { useAuditLog } from '../../../context/AdminDataContext';
import {
  BASIS_OPTIONS, BEYOND_TB, QUAL_REASONS, SEED_ENTITIES,
  SEED_GROUP_NAME, SEED_QUAL_PICKS, SEED_TB_FILES, captionsForEntities,
  currentFyEnd, cycleYears, deriveRacms, entityShort, fmtCr, genCode,
  type GroupEntity, type MaterialityBasis, type ProcessName, type QualPick,
  type SoxProgramme, type TbCaption,
} from './soxTestingData';

/** Scoping step — PARKED (user ask). SOX creation is now identity + entities +
 *  a RACM attached to each entity; the trial balance and general ledger are
 *  asked for on Basics instead — the group TB / GL beside the group name, the
 *  RACM per entity in the table. Everything the step
 *  rendered is still below, behind this flag: set it back to true and 'Scoping'
 *  returns to STEPS at index 2, the `step === 2` block renders again, its gate
 *  re-enters `canContinue`, and the Skip-for-now footer button comes back with
 *  it. Entity RACMs register as `racm` attachments precisely so the step would
 *  return already satisfied instead of asking for the same file twice. */
const SCOPING_STEP = false;

const STEPS: readonly string[] = SCOPING_STEP
  ? ['Type', 'Basics', 'Scoping', 'Review']
  : ['Type', 'Basics', 'Review'];
/** Review is always last — the index shifts when Scoping is parked. */
const REVIEW_STEP = STEPS.length - 1;

/** Single entity standing in for the company itself (the "no separate
 *  entities" checkbox). Kept off `ent-new-` so it never reads as hand-added. */
const SOLO_ENTITY_ID = 'ent-self';

/* ── Step 1 = the classic wizard's "Type & basics" screen, as-is ─────────── */
const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
/** Compact FormSelect for a table row — the sheet's dropdown look at row scale,
 *  so the entity type matches Owner instead of falling back to a raw <select>. */
const rowSelectCls = 'w-full text-[12px] text-text-secondary bg-white border border-border rounded-md px-2 py-1 outline-none hover:border-primary/40 transition-colors';
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

/** The Qualitative overlay step is parked (user ask). To restore: flip this,
 *  add 'Qualitative' back after 'Materiality' in STEPS, give the step its
 *  canContinue entry back (inScope.length > 0) and re-key the step checks
 *  (qual block → step === 3, review → step === 4). The seeded qualitative
 *  picks still scope in silently, so the derivation numbers stay unchanged. */
const QUAL_STEP = false;

/** Trial-balance upload on the Scoping step — was briefly parked, then the
 *  user reverted. Set false to park it again (button, chips, gate and hint
 *  all follow this flag). */
const TB_UPLOAD = true;

/** The Materiality step is parked (user ask). To restore: flip this, add
 *  'Materiality' back after 'Scoping' in STEPS, re-key its block to
 *  step === 3 and the review block to step === 4, and move the
 *  benchmark/pct + empty-scope gate back to its own canContinue entry.
 *  The seeded basis defaults (PBT, 75/5) still set the thresholds, so the
 *  derivation and the created programme's materiality are unchanged — the
 *  review step keeps showing the resulting ladder. */
const MATERIALITY_STEP = false;

/** Year type (Financial / Calendar) picker — PARKED from the creation flow.
 *  Every programme is created on the financial-year basis (Apr–Mar); the
 *  yearBasis state below stays, pinned to 'fy', so the period fields on the
 *  created programme are unchanged. Flip this back to true to let the user
 *  choose, and the Audit period options re-label to CY on selection. */
const YEAR_TYPE_PICKER = false;

/** Audit period select — PARKED from the Basics step (user ask). The cycle
 *  stays pinned to the fyEnd default (FY 2026-27); fy/asOf still compute and
 *  store on the programme, and Review keeps showing the cycle. Flip to bring
 *  the field (and its annual-cycle explainer) back. */
const AUDIT_PERIOD_FIELD = false;

const yeSegActive = 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20';
const yeSegIdle = 'border-border bg-white text-text-secondary hover:bg-surface-2';
/** Required documents for scoping (user ask): listed in a "Required files"
 *  card under the group name, fed by ONE bulk upload button (native picker,
 *  multi-select). Files classify to a requirement by filename keywords, then
 *  fall back to whichever requirement still has nothing. The TB row rides the
 *  TB_UPLOAD park flag like the old dedicated button did. */
type ReqDocId = 'racm' | 'tb' | 'gl';
type AttachedDoc = { id: string; name: string; req: ReqDocId };
const REQUIRED_DOCS: { id: ReqDocId; name: string; formats: string }[] = [
  { id: 'racm', name: 'RACM / SOP', formats: 'XLSX' },
  ...(TB_UPLOAD ? [{ id: 'tb' as ReqDocId, name: 'Trial balance (TB)', formats: 'XLSX' }] : []),
  { id: 'gl', name: 'General ledger (GL)', formats: 'CSV' },
];
const REQ_TAG: Record<ReqDocId, string> = { racm: 'RACM / SOP', tb: 'Trial balance', gl: 'General ledger' };

/** Group-level documents (user ask): the trial balance and general ledger are
 *  consolidated — one file each, for the group as a whole — so they're asked
 *  for on Basics next to the group name. The RACM is NOT here: it differs per
 *  entity and is attached row by row in the entity table below. */
const GROUP_DOCS = REQUIRED_DOCS.filter(d => d.id !== 'racm');

const PROCESS_NAMES: ProcessName[] = [
  'Order to Cash', 'Procure to Pay', 'Inventory', 'Fixed Assets',
  'Payroll (Hire to Retire)', 'Treasury', 'Tax',
];

interface Props {
  onCancel: () => void;
  onCreated: (p: SoxProgramme) => void;
  /** Entered from the Engagements page, where SOX / ICFR was already picked —
   *  the Type step is dropped and Back on Basics returns to that page, so the
   *  type isn't asked for twice. */
  typePreselected?: boolean;
  /** With `typePreselected`, Back on the first reachable step (Basics) goes to
   *  the immediate last step the user saw — the classic wizard's Type step —
   *  instead of just closing. X / Escape still close outright. */
  onBackToType?: () => void;
}

export default function ScopingWizard({ onCancel, onCreated, typePreselected, onBackToType }: Props) {
  const logEvent = useAuditLog();
  // the first step the user can actually reach — Type is skipped on handoff
  const firstStep = typePreselected ? 1 : 0;
  const [step, setStep] = useState(firstStep);

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
  /** End-year of the audit period — 2027 ⇒ FY 2026-27 (financial) / CY 2027
   *  (calendar). Derived from today rather than fixed: the audit-period field
   *  is parked (AUDIT_PERIOD_FIELD), so this default is the ONLY thing naming
   *  the cycle, and a hard-coded year would keep creating stale programmes
   *  once the financial year turned over. */
  const [fyEnd, setFyEnd] = useState(currentFyEnd);
  const [owner, setOwner] = useState(OWNER_NAMES[0]);

  const YEAR_OPTIONS = cycleYears(yearBasis).map(y => (yearBasis === 'fy'
    ? { value: y, label: `FY ${y - 1}-${String(y).slice(-2)}` }
    : { value: y, label: `CY ${y}` }));
  const fyLabel = YEAR_OPTIONS.find(o => o.value === fyEnd)?.label ?? `FY ${fyEnd}`;
  const fy = `FY${String(fyEnd).slice(-2)}`;
  const asOf = yearBasis === 'fy' ? `31 Mar ${fyEnd}` : `31 Dec ${fyEnd}`;

  // Step 2 — group & entities. The table starts empty: entities are mapped
  // from the uploaded RACM / trial balances, with manual add as the fallback.
  const [groupName, setGroupName] = useState(SEED_GROUP_NAME);
  const [entities, setEntities] = useState<GroupEntity[]>([]);
  const [racmUpload, setRacmUpload] = useState<'idle' | 'parsing' | 'done'>('idle');
  const [tbUpload, setTbUpload] = useState<'idle' | 'parsing' | 'done'>('idle');

  /** A RACM attached to one entity, keyed by entity id. Optional — an entity
   *  can be listed before its matrix exists. */
  const [entityRacm, setEntityRacm] = useState<Record<string, { attId: string; name: string; state: 'parsing' | 'done' }>>({});

  /** "No separate entities" — the company itself is the single entity in scope.
   *  The list the user had before ticking is held so unticking restores it
   *  rather than silently binning their typing. */
  const [soloEntity, setSoloEntity] = useState(false);
  const preSoloEntities = useRef<GroupEntity[]>([]);

  // Required-files card: the attached list is the source of truth for the
  // step gate; RACM / TB attachments also trigger the simulated parses that
  // fill the entity table (GL just satisfies its requirement — nothing
  // downstream reads it in the prototype).
  const [attached, setAttached] = useState<AttachedDoc[]>([]);
  const reqSatisfied = REQUIRED_DOCS.filter(d => attached.some(a => a.req === d.id)).length;
  const allReqsSatisfied = reqSatisfied === REQUIRED_DOCS.length;

  // Scoping can be skipped (user ask): the programme is created without RACMs
  // and the workspace Overview flags that until one is added on the RACM tab.
  // The GL / TBs are no longer asked for here — they arrive on the audit that
  // tests them, captured by the New audit wizard (the audit's Configuration tab
  // is parked; see SOX_TABS in SoxIcfrApp).
  const [scopingSkipped, setScopingSkipped] = useState(false);
  const skipScoping = () => { setScopingSkipped(true); setStep(3); };

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

  const canContinue = [
    // Type — this journey only continues for SOX / ICFR.
    type === 'SOX / ICFR',
    // Basics — identity, the group it runs for, and who is in scope. With
    // Scoping parked this is the only step that collects entities, so it gates
    // on them: at least one named row, or the company itself via the checkbox.
    // RACMs stay optional — an entity can be listed before its matrix exists.
    name.trim().length > 0 && code.trim().length > 0 && groupName.trim().length > 0
      && entities.length > 0 && entities.every(e => e.name.trim()),
    // Scoping (parked) — every required document needs at least one attached
    // file (RACM / TB attachments trigger the parses that fill the table). With
    // the Materiality and Qualitative steps parked, the empty-scope gate
    // rides here too — an empty scope derives zero RACMs.
    ...(SCOPING_STEP
      ? [entities.length > 0 && entities.every(e => e.name.trim()) && allReqsSatisfied && inScope.length > 0]
      : []),
    true,
  ][step];

  const goNext = () => {
    if (!canContinue) return;
    if (SCOPING_STEP && step === 2) setScopingSkipped(false); // completed properly after all
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

  const extractedReady = racmUpload === 'done' || tbUpload === 'done';
  /** RACMs attached to rows that are still in the list — entities dropped or
   *  swapped out by the checkbox must not keep counting. */
  const racmCount = entities.filter(e => entityRacm[e.id]).length;

  const classifyDoc = (fileName: string, existing: { req: ReqDocId }[]): ReqDocId => {
    const n = fileName.toLowerCase();
    if (/racm|sop/.test(n)) return 'racm';
    if (TB_UPLOAD && /(^|[^a-z])tb([^a-z]|$)|trial/.test(n)) return 'tb';
    if (/(^|[^a-z])gl([^a-z]|$)|ledger/.test(n)) return 'gl';
    // No keyword — fill whichever requirement still has nothing.
    return REQUIRED_DOCS.find(d => !existing.some(a => a.req === d.id))?.id ?? 'gl';
  };

  const onFilesSelected = (list: FileList | null) => {
    if (!list?.length) return;
    const batch: AttachedDoc[] = [];
    for (const f of Array.from(list)) {
      batch.push({ id: `att-${Date.now()}-${batch.length}`, name: f.name, req: classifyDoc(f.name, [...attached, ...batch]) });
    }
    setAttached(prev => [...prev, ...batch]);
    if (batch.some(b => b.req === 'racm') && racmUpload !== 'done') simulateRacmUpload();
    if (TB_UPLOAD && batch.some(b => b.req === 'tb') && tbUpload !== 'done') simulateTbUpload();
  };

  /** Removing the last file of a requirement re-arms it (and the step gate). */
  const removeAttached = (id: string) => {
    const next = attached.filter(a => a.id !== id);
    setAttached(next);
    if (!next.some(a => a.req === 'racm')) setRacmUpload('idle');
    if (TB_UPLOAD && !next.some(a => a.req === 'tb')) { setTbUpload('idle'); setUploads({}); }
  };

  /** One consolidated group file per requirement — re-uploading replaces the
   *  previous one rather than stacking a second copy of the same document.
   *  The TB runs its simulated parse, but deliberately does NOT merge the
   *  seeded companies: the entity list is the user's, typed or via the
   *  no-entities checkbox, and shouldn't grow rows they never asked for. */
  const onGroupDocSelected = (req: ReqDocId, list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    setAttached(prev => [...prev.filter(a => a.req !== req), { id: `att-grp-${req}-${Date.now()}`, name: file.name, req }]);
    if (req === 'tb') {
      setTbUpload('parsing');
      window.setTimeout(() => setTbUpload('done'), 800);
    }
  };

  /** RACM attached to one entity. It also registers as a group `racm`
   *  attachment (user ask) so the parked Scoping step would come back already
   *  satisfied rather than asking for the same matrix a second time. The
   *  simulated parse fills that entity's process list, and deliberately does
   *  NOT merge the seeded entities — this upload speaks for one row only. */
  const onEntityRacmSelected = (entId: string, list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    const attId = `att-ent-${entId}-${Date.now()}`;
    setEntityRacm(prev => ({ ...prev, [entId]: { attId, name: file.name, state: 'parsing' } }));
    setAttached(prev => [...prev, { id: attId, name: file.name, req: 'racm' }]);
    window.setTimeout(() => {
      setEntityRacm(prev => (prev[entId]?.attId === attId
        ? { ...prev, [entId]: { ...prev[entId], state: 'done' } }
        : prev));
    }, 800);
  };

  const removeEntityRacm = (entId: string) => {
    const rec = entityRacm[entId];
    if (!rec) return;
    setEntityRacm(prev => { const next = { ...prev }; delete next[entId]; return next; });
    removeAttached(rec.attId);
  };

  /** Dropping an entity takes its RACM with it — no orphan attachment left
   *  ticking off a requirement for a row that no longer exists. */
  const removeEntity = (entId: string) => {
    removeEntityRacm(entId);
    setEntities(prev => prev.filter(e => e.id !== entId));
  };

  /** "No separate entities" — swap the table for the company itself. */
  const toggleSoloEntity = () => {
    if (!soloEntity) {
      preSoloEntities.current = entities;
      setEntities([{ id: SOLO_ENTITY_ID, name: groupName.trim(), type: 'Holding', ownership: 100 }]);
      setSoloEntity(true);
      return;
    }
    removeEntityRacm(SOLO_ENTITY_ID);
    setEntities(preSoloEntities.current);
    setSoloEntity(false);
  };

  /** The company's own row is the group name — keep it in step while it's typed. */
  useEffect(() => {
    if (!soloEntity) return;
    setEntities(prev => (prev.length === 1 && prev[0].id === SOLO_ENTITY_ID && prev[0].name !== groupName.trim()
      ? [{ ...prev[0], name: groupName.trim() }]
      : prev));
  }, [groupName, soloEntity]);
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
        if (typeof up === 'object') return { ...e, tbFile: up.file, tbLines: up.lines };
        // One consolidated group TB covers every entity under it.
        const groupTb = attached.find(a => a.req === 'tb');
        return groupTb ? { ...e, tbFile: groupTb.name } : { ...e };
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
      // The workspace banner nags for a missing RACM, so flag only when one
      // was genuinely never attached — the group TB / GL are asked for on
      // Basics now, so arriving without them is no longer the default.
      scopingSkipped: (scopingSkipped || racmCount === 0) || undefined,
    };
    onCreated(programme);
  };

  return (
    // min-h-full + flex column: on short steps the footer still sits pinned to
    // the modal's bottom edge instead of floating mid-air after the content.
    <div className="flex flex-col min-h-full">
      {/* Modal header — same eyebrow pattern as the scoping summary; no
          breadcrumb or back affordance, close is X / Escape / Cancel. */}
      {/* Pinned header — eyebrow + stepper stay put while the step content
          scrolls beneath (mirror of the sticky footer; user ask). */}
      {/* Sticky clamps the MARGIN box, not the border box. -mt-6 (which cancels
          FlowModal's p-6 so the header can cover the scrollport's top padding
          when stuck) therefore made `top-0` shove the header 24px BELOW the
          space layout reserved for it — it painted over the first 24px of every
          step, swallowing the "Engagement name" label on Basics and slicing the
          top off the Recommended-files card on Scoping.
          `-top-6` cancels the margin in the clamp, so the header pins exactly at
          its static position (flush to the scrollport top, still covering the
          padding strip). pt-11 = pt-5 + the 24px the margin used to supply, so
          the title sits where it always did. */}
      <div className="sticky -top-6 z-10 bg-canvas -mx-6 px-6 -mt-6 pt-11 pb-1">
        {/* Same title block as the classic wizard's header (user ask) — the
            journey keeps one identity across the handoff instead of the title
            disappearing the moment scoping takes over. FlowModal's floating X
            is suppressed for this sheet so there's only one close. */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-brand-600 shrink-0" />
              <h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight">Create Engagement</h2>
            </div>
            <p className="text-[0.75rem] text-ink-500">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close drawer"><X size={16} /></button>
        </div>
        {/* Type stays on the rail even when it was answered on the classic
            wizard — it reads as a completed step of one journey, not a step
            that never existed. Clicking it goes back to where it was answered. */}
        <StepRail
          steps={STEPS}
          step={step}
          onStepClick={i => {
            if (typePreselected && i === 0) { onBackToType ? onBackToType() : onCancel(); return; }
            setStep(i);
          }} />
      </div>

      <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        {step === 0 && (
          <StepShell title="Type">
            <div className="space-y-4">
              <div>
                <label className={basicsLabelCls}>Engagement type <span className="text-risk-700">*</span></label>
                <div className="space-y-2">
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
            </div>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell title="Basics">
            <div className="space-y-4">
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
                  <FormSelect value={owner} options={OWNER_NAMES} onChange={setOwner} className={selectCls} ariaLabel="Owner" menuCls="w-full" />
                </div>
              </div>
              {AUDIT_PERIOD_FIELD && (<>
              <div className="grid grid-cols-2 gap-3">
                {YEAR_TYPE_PICKER && (
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
                )}
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
              </>)}
              <div>
                <label className={basicsLabelCls}>Description <span className="normal-case font-medium text-ink-400">(optional)</span></label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="One-line description of scope and intent." className={inputCls + ' resize-none'} />
              </div>

              {/* Group & entities — moved up from Scoping (user ask): who the
                  programme runs for is asked with the rest of the identity,
                  before the documents. The table still starts empty — the RACM
                  and trial-balance uploads on the Scoping step map entities in
                  by name, so anything typed here is merged, never duplicated. */}
              <div>
                <label className={basicsLabelCls}>Group (listed / holding) <span className="text-risk-700">*</span></label>
                <input value={groupName} onChange={e => setGroupName(e.target.value)} className={inputCls} />
                {groupName.trim().length === 0 && <Hint text="Group name is required" />}
              </div>

              {/* PARKED (user ask): the group trial balance / general ledger
                  upload. Files now arrive on the audit, not the engagement —
                  the New audit wizard's Scope & files step attaches the TB and
                  GL for the period being tested, which is where they belong,
                  since a new cycle brings new ones.

                  To restore: uncomment. Every handler behind it is still wired
                  (`GROUP_DOCS`, `attached`, `onGroupDocSelected`, `removeAttached`,
                  `tbUpload`), so this is a one-block uncomment.

                  Consequence while parked: `attached` stays empty, so the
                  entity rows carry no `tbFile` into the created programme and
                  the Review step's Documents card is parked with it (below).

              <div>
                <div className={basicsLabelCls}>
                  Group documents <span className="normal-case font-medium text-ink-400">(optional)</span>
                </div>
                <div className="border border-border-light rounded-xl bg-white overflow-hidden">
                  {GROUP_DOCS.map(d => {
                    const doc = attached.find(a => a.req === d.id);
                    const parsing = d.id === 'tb' && tbUpload === 'parsing';
                    return (
                      <div key={d.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-border-light last:border-b-0">
                        <FileText size={13} className="text-text-muted shrink-0" />
                        <span className="text-[12.5px] font-semibold text-text shrink-0">{d.name}</span>
                        <span className="px-1.5 py-0.5 rounded-md border border-border text-[10px] font-bold text-text-muted shrink-0">{d.formats}</span>
                        {doc ? (
                          <span className="ml-auto flex items-center gap-1.5 min-w-0">
                            <span className="text-[11.5px] text-text truncate">{doc.name}</span>
                            {parsing
                              ? <Loader2 size={11} className="animate-spin text-text-muted shrink-0" />
                              : <Check size={12} className="text-compliant-600 shrink-0" />}
                            <button
                              onClick={() => removeAttached(doc.id)}
                              aria-label={`Remove ${d.name}`}
                              className="p-1 rounded text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ) : (
                          <label className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border-light bg-white hover:bg-surface-2 text-[11px] font-semibold text-text-secondary cursor-pointer transition-colors shrink-0">
                            <Upload size={11} /> Upload
                            <input
                              type="file"
                              className="hidden"
                              aria-label={`Upload ${d.name}`}
                              onChange={e => { onGroupDocSelected(d.id, e.target.files); e.target.value = ''; }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[0.6875rem] text-ink-500 mt-1">
                  One consolidated file each, covering the whole group — every entity's own RACM is attached in the table below.
                </p>
              </div>
              */}
              <div>
                <div className={basicsLabelCls}>
                  {soloEntity ? 'Entity in scope' : 'Entities in scope of the group audit'}
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
                  <div className="grid grid-cols-[2fr_0.9fr_1.6fr_44px] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                    <div>Entity</div><div>Type</div><div>Processes — extracted</div><div />
                  </div>
                  {entities.length === 0 && (
                    <div className="px-4 py-6 text-center text-[12px] text-text-muted border-b border-border-light">
                      No entities yet — add the companies in scope. If there are none, tick the box below.
                    </div>
                  )}
                  {entities.map((ent, i) => {
                    const racm = entityRacm[ent.id];
                    return (
                    <div key={ent.id} className="border-b border-border-light last:border-b-0">
                      {/* py, not pt: the RACM line under each row used to supply
                          the bottom padding and is parked. */}
                      <div className="grid grid-cols-[2fr_0.9fr_1.6fr_44px] gap-3 px-4 py-2.5 items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        {ent.type === 'Holding'
                          ? <Landmark size={14} className="text-brand-700 shrink-0" />
                          : <Building2 size={14} className="text-text-muted shrink-0" />}
                        {soloEntity ? (
                          // The company's own row — its name is the group name.
                          <span className="text-[13px] text-text truncate py-0.5">{ent.name || '—'}</span>
                        ) : (
                          <input
                            value={ent.name}
                            onChange={e => setEntities(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                            aria-label={`Entity ${i + 1} name`}
                            className="w-full text-[13px] text-text bg-transparent outline-none border-b border-transparent focus:border-primary/40 transition-colors py-0.5"
                          />
                        )}
                      </div>
                      {soloEntity ? (
                        <span className="text-[12px] text-text-muted">Holding</span>
                      ) : (
                        <FormSelect
                          value={ent.type}
                          options={['Holding', 'Subsidiary']}
                          onChange={v => setEntities(prev => prev.map((x, j) => j === i ? { ...x, type: v as GroupEntity['type'] } : x))}
                          className={rowSelectCls}
                          ariaLabel={`Type for ${ent.name || `entity ${i + 1}`}`}
                          menuCls="w-full min-w-[150px]"
                        />
                      )}
                      {(() => {
                        // A parsed RACM speaks for its own entity, whoever added it.
                        if (racm?.state === 'done') {
                          const procs = entityProcesses(ent.id);
                          return (
                            <div className="text-[11px] text-text-muted leading-snug min-w-0 truncate" title={procs.join(', ')}>
                              {procs.length ? procs.join(' · ') : '—'}
                            </div>
                          );
                        }
                        // Hand-added rows: nothing was extracted — the user fills it in
                        if (ent.id.startsWith('ent-new-') || ent.id === SOLO_ENTITY_ID) {
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
                        onClick={() => removeEntity(ent.id)}
                        disabled={soloEntity || entities.length === 1}
                        aria-label={`Remove ${ent.name}`}
                        className="p-1.5 rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer justify-self-end"
                      >
                        <Trash2 size={13} />
                      </button>
                      </div>
                      {/* PARKED (user ask): the per-entity RACM upload that sat
                          on its own line under each row. The engagement is now
                          created without a matrix; one is added or generated
                          from the RACM tab afterwards, and the workspace
                          Overview flags its absence until then.

                          To restore: uncomment. `entityRacm`,
                          `onEntityRacmSelected` and `removeEntityRacm` are all
                          still wired.

                          Consequence while parked: `racmCount` is always 0, so
                          every created programme carries `scopingSkipped` — which
                          is now simply true, and the Overview nag is correct.

                      <div className="pl-[38px] pr-4 pb-2.5 pt-1.5">
                        {!racm ? (
                          <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border-light bg-white hover:bg-surface-2 text-[11px] font-semibold text-text-secondary cursor-pointer transition-colors">
                            <Upload size={11} /> Upload RACM
                            <input
                              type="file"
                              className="hidden"
                              aria-label={`Upload RACM for ${ent.name || `entity ${i + 1}`}`}
                              onChange={e => { onEntityRacmSelected(ent.id, e.target.files); e.target.value = ''; }}
                            />
                          </label>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 pl-2 pr-1 h-7 rounded-md border border-border-light bg-white max-w-full min-w-0">
                            <FileText size={11} className="text-text-muted shrink-0" />
                            <span className="text-[11px] text-text truncate">{racm.name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[9.5px] font-bold uppercase tracking-wide shrink-0">RACM</span>
                            {racm.state === 'parsing' ? (
                              <Loader2 size={11} className="animate-spin text-text-muted shrink-0 mr-1" />
                            ) : (
                              <button
                                onClick={() => removeEntityRacm(ent.id)}
                                aria-label={`Remove RACM for ${ent.name || `entity ${i + 1}`}`}
                                className="p-1 rounded text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                      */}
                    </div>
                    );
                  })}
                  {!soloEntity && (
                    <button
                      onClick={() => setEntities(prev => [...prev, { id: `ent-new-${prev.length}-${Date.now()}`, name: '', type: 'Subsidiary', ownership: 100 }])}
                      className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold text-primary hover:bg-primary/5 w-full transition-colors cursor-pointer"
                    >
                      <Plus size={13} /> Add entity
                    </button>
                  )}
                </div>

                {/* No subsidiaries is a real answer, not an empty table. */}
                <button
                  role="checkbox"
                  aria-checked={soloEntity}
                  onClick={toggleSoloEntity}
                  className={`mt-2 w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    soloEntity ? 'border-primary/30 bg-primary/5' : 'border-transparent bg-surface-2/50 hover:bg-surface-2'
                  }`}
                >
                  <span className={`w-4 h-4 rounded inline-flex items-center justify-center shrink-0 mt-0.5 border ${
                    soloEntity ? 'bg-primary border-primary text-white' : 'border-border bg-white'
                  }`}>
                    {soloEntity && <Check size={10} />}
                  </span>
                  <span>
                    <span className="block text-[12px] font-semibold text-text">There are no separate entities</span>
                    <span className="block text-[11px] text-text-muted leading-relaxed mt-0.5">
                      {groupName.trim() || 'The company'} is audited as the single entity in scope — no subsidiaries to list.
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </StepShell>
        )}

        {SCOPING_STEP && step === 2 && (
          <StepShell title="Scoping">
            {/* Required-files card (user ask): the three scoping documents
                listed as requirements, ONE bulk upload button (native
                multi-select picker), attached files as tagged chips beneath.
                The group name and entity table were asked on Basics. */}
            <div className="mb-5">
              <div className="border border-border-light rounded-xl bg-white">
                <div className="flex items-center gap-2 px-4 py-3">
                  <FileText size={14} className="text-primary shrink-0" />
                  <span className="text-[13px] font-bold text-text">Recommended files</span>
                  <span className="text-[11.5px] text-text-muted">{REQUIRED_DOCS.length} recommended · {REQUIRED_DOCS.length} total</span>
                  <label className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary hover:bg-primary-hover text-white text-[11.5px] font-semibold transition-colors cursor-pointer">
                    <Upload size={12} /> {attached.length > 0 ? 'Add more' : 'Upload'}
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      aria-label="Upload recommended files"
                      onChange={e => { onFilesSelected(e.target.files); e.target.value = ''; }}
                    />
                  </label>
                </div>
                <div className="px-4 pb-3.5 flex flex-wrap gap-2">
                  {REQUIRED_DOCS.map(d => {
                    const done = attached.some(a => a.req === d.id);
                    return (
                      <div key={d.id} className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border ${done ? 'border-compliant-100 bg-compliant-50/40' : 'border-border-light bg-white'}`}>
                        <span className="text-[12.5px] font-semibold text-text">{d.name}</span>
                        <span className="px-1.5 py-0.5 rounded-md border border-border text-[10px] font-bold text-text-muted">{d.formats}</span>
                        {done && <Check size={13} className="text-compliant-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {attached.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
                      Attached
                      <span className="w-[18px] h-[18px] rounded-full bg-ink-900 text-white text-[10px] font-bold inline-flex items-center justify-center tabular-nums">{attached.length}</span>
                    </span>
                    <span className="text-[11.5px] text-text-muted tabular-nums">{reqSatisfied}/{REQUIRED_DOCS.length} recommended inputs satisfied</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {attached.map(a => (
                      <span key={a.id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 h-9 rounded-lg border border-border-light bg-white min-w-0">
                        <FileText size={12} className="text-text-muted shrink-0" />
                        <span className="text-[12px] text-text truncate">{a.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[9.5px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0">{REQ_TAG[a.req]}</span>
                        <button
                          onClick={() => removeAttached(a.id)}
                          aria-label={`Remove ${a.name}`}
                          className="ml-auto p-1 rounded text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {(racmUpload === 'parsing' || tbUpload === 'parsing') && (
                    <span className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-text-muted">
                      <Loader2 size={12} className="animate-spin" /> Parsing…
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* The entity table lives on Basics now — say what the uploads did
                to it here, so the derivation stays visible on the step that
                caused it. */}
            {extractedReady && entities.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11.5px] text-text-muted">
                <Check size={12} className="text-compliant-600 shrink-0" />
                {entities.length} {entities.length === 1 ? 'entity' : 'entities'} mapped from the uploads — review them on Basics.
              </div>
            )}
            {TB_UPLOAD && entities.length > 0 && tbUpload !== 'done' && (
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

        {MATERIALITY_STEP && (
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

        {QUAL_STEP && (
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

        {step === REVIEW_STEP && (
          <StepShell
            title="Review"
            sub={SCOPING_STEP
              ? 'Confirm the derivation before the FY27 programme is created. Nothing below was picked by hand — it all flows from materiality and the trial balances.'
              : `Confirm who is in scope, and what came in with them, before the ${fy} programme is created.`}
          >
            {(scopingSkipped || racmCount === 0) && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-high-50 border border-high-100">
                <AlertCircle size={13} className="text-high-700 shrink-0 mt-0.5" />
                <p className="text-[0.75rem] text-text-secondary leading-relaxed">
                  {/* One arm now, not two: the RACM and the TB / GL are no
                      longer asked for here, so arriving without them is the
                      normal path rather than something the user skipped. */}
                  The engagement is created without a RACM — add or generate one from the RACM tab, and the workspace
                  Overview will flag it until you do. The trial balance and general ledger are attached later, on the
                  audit that tests them.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 mb-4">
              <ReviewCard title={soloEntity ? 'Company in scope' : 'Group & entities'}>
                <div className="text-[13px] font-semibold text-text mb-1.5">{groupName}</div>
                {entities.map(e => (
                  <div key={e.id} className="flex items-center gap-1.5 text-[11.5px] text-text-secondary py-0.5 min-w-0">
                    {e.type === 'Holding' ? <Landmark size={11} className="text-brand-700 shrink-0" /> : <Building2 size={11} className="text-text-muted shrink-0" />}
                    <span className="truncate">{e.name}</span>
                    {/* Say plainly whether the matrix is in — a missing RACM is
                        the thing that stalls the engagement later. */}
                    {entityRacm[e.id]
                      ? <span className="inline-flex items-center gap-1 text-text-muted shrink-0"><FileText size={10} /> <span className="max-w-[140px] truncate">{entityRacm[e.id].name}</span></span>
                      : <span className="text-text-muted shrink-0">· no RACM yet</span>}
                  </div>
                ))}
              </ReviewCard>
              {SCOPING_STEP && (<>
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
              </>)}
              {!SCOPING_STEP && (
                <ReviewCard title="Documents">
                  {GROUP_DOCS.map(d => {
                    const doc = attached.find(a => a.req === d.id);
                    return (
                      <div key={d.id} className="flex items-center gap-1.5 text-[11.5px] py-0.5 min-w-0">
                        {doc
                          ? <Check size={11} className="text-compliant-600 shrink-0" />
                          : <Circle size={9} className="text-text-muted shrink-0" />}
                        <span className="text-text-secondary shrink-0">{d.name}</span>
                        <span className="text-text-muted truncate">{doc ? doc.name : '— not attached'}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-1.5 text-[11.5px] py-0.5">
                    {racmCount > 0
                      ? <Check size={11} className="text-compliant-600 shrink-0" />
                      : <Circle size={9} className="text-text-muted shrink-0" />}
                    <span className="text-text-secondary shrink-0">RACM</span>
                    <span className="text-text-muted">
                      {racmCount > 0
                        ? `${racmCount} of ${entities.length} ${entities.length === 1 ? 'entity' : 'entities'}`
                        : '— add one from the RACM tab later'}
                    </span>
                  </div>
                </ReviewCard>
              )}
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
          onClick={() => (step === firstStep
            ? (typePreselected && onBackToType ? onBackToType() : onCancel())
            : setStep(s => s - 1))}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-[12.5px] font-semibold text-text-secondary transition-colors cursor-pointer"
        >
          <ArrowLeft size={13} /> {step === firstStep && !(typePreselected && onBackToType) ? 'Cancel' : 'Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <span className="flex items-center gap-2">
            {SCOPING_STEP && step === 2 && (
              <button
                onClick={skipScoping}
                title="Create without scoping — the workspace Overview flags the missing RACM; the trial balance and GL arrive on the audit that tests them"
                className="px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-[12.5px] font-semibold text-text-secondary transition-colors cursor-pointer"
              >
                Skip for now
              </button>
            )}
            <button
              onClick={goNext}
              disabled={!canContinue}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ArrowRight size={13} />
            </button>
          </span>
        ) : (
          <button
            onClick={create}
            disabled={!scopingSkipped && derived.length === 0}
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
 *  explainer (the user asked the duplicate per-step titles removed; Basics
 *  carries no explainer at all). */
function StepShell({ sub, children }: { title?: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      {sub && <p className="text-[12.5px] text-text-secondary mb-5 leading-relaxed">{sub}</p>}
      {children}
    </div>
  );
}

/** Step rail — same visual language as the Engagements creation flow
 *  (CreateEngagementWizard): thin segment bars, one per step, with the
 *  uppercase labels beneath. Travelled segments tint brand and click back;
 *  upcoming steps stay quiet and unclickable. Shared by the scoping and
 *  roll-forward flows. */
export function StepRail({ steps, step, onStepClick }: {
  steps: readonly string[];
  step: number;
  onStepClick: (i: number) => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5">
        {steps.map((label, i) => (
          <button
            key={label}
            onClick={() => { if (i <= step) onStepClick(i); }}
            className={`flex-1 h-1.5 rounded-full transition-colors ${i === step ? 'bg-brand-600' : i < step ? 'bg-brand-300' : 'bg-canvas-border'} ${i <= step ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
            aria-label={`Go to step ${i + 1}`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[0.625rem] font-semibold text-ink-400 uppercase tracking-wider">
        {steps.map((label, i) => (
          <span key={label} className={i === step ? 'text-brand-700' : ''}>{label}</span>
        ))}
      </div>
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
