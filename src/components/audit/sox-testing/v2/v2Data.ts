import { registerEngagement } from '../../../../data/engagements';

/**
 * SOX Testing · V2 (call-aligned) — data layer.
 *
 * Prototype of the partner-validated redesign (Jul 20 call), living beside the
 * existing flow without touching it:
 *  - materiality first, flagged at PERFORMANCE materiality (not overall)
 *  - four named bases incl. % of net assets
 *  - entity scope is DERIVED from each entity's TB, with a coverage rule
 *  - ITGC / ELC / FSCP / consolidation become real RACM shells (ITGC scoped
 *    by IT system)
 *  - people captured per process (process owner + control owner) — the
 *    foundation of the evidence-chasing workflow
 *  - the cycle honours the 31 Mar / 31 Dec choice, has a remediation phase,
 *    and supports a mid-year re-scope
 */

export type V2Basis = 'pbt' | 'revenue' | 'netAssets' | 'expenses' | 'custom';

export interface V2BasisOption {
  id: V2Basis;
  label: string;
  hint: string;
  defaultPct: number;
  benchmarkLabel: string;
  /** ₹ Cr */
  defaultBenchmark: number;
}

export const V2_BASIS_OPTIONS: V2BasisOption[] = [
  {
    id: 'pbt',
    label: '% of profit before tax',
    hint: 'Profit-making company — the classic base, typically ~5%',
    defaultPct: 5,
    benchmarkLabel: 'Profit before tax (consolidated)',
    defaultBenchmark: 240,
  },
  {
    id: 'revenue',
    label: '% of revenue',
    hint: 'Break-even or thin margins on high turnover — 1–2% of revenue',
    defaultPct: 1.5,
    benchmarkLabel: 'Total revenue (consolidated)',
    defaultBenchmark: 5240,
  },
  {
    id: 'netAssets',
    label: '% of net assets',
    hint: 'Pre-revenue / under construction — 0.5–1% of net assets',
    defaultPct: 0.75,
    benchmarkLabel: 'Net assets (consolidated)',
    defaultBenchmark: 1850,
  },
  {
    id: 'expenses',
    label: '% of total expenses',
    hint: 'Government / not-for-profit / expense-driven entity',
    defaultPct: 1,
    benchmarkLabel: 'Total expenses (consolidated)',
    defaultBenchmark: 4820,
  },
  {
    id: 'custom',
    label: 'Custom amount',
    hint: 'Set overall materiality directly',
    defaultPct: 100,
    benchmarkLabel: 'Overall materiality',
    defaultBenchmark: 12,
  },
];

export type V2ProcessName =
  | 'Order to Cash'
  | 'Procure to Pay'
  | 'Inventory'
  | 'Fixed Assets'
  | 'Payroll (Hire to Retire)'
  | 'Treasury'
  | 'Tax';

export const V2_PROCESS_NAMES: V2ProcessName[] = [
  'Order to Cash', 'Procure to Pay', 'Inventory', 'Fixed Assets',
  'Payroll (Hire to Retire)', 'Treasury', 'Tax',
];

export interface V2Entity {
  id: string;
  name: string;
  type: 'Holding' | 'Subsidiary';
  /** Share of the consolidated benchmark — what the coverage meter adds up. */
  sharePct: number;
  tbFile?: string;
  tbLines?: number;
}

export interface V2Caption {
  id: string;
  entityId: string;
  caption: string;
  /** ₹ Cr */
  balance: number;
  process: V2ProcessName;
}

export const V2_QUAL_REASONS = [
  'High transaction velocity',
  'Complex accounting',
  'Fraud risk',
  'Regulatory focus',
  'Management estimate / judgement',
] as const;

export interface V2QualPick {
  captionId: string;
  reason: (typeof V2_QUAL_REASONS)[number];
  note: string;
}

/** Why an entity ended up in (or out of) scope. */
export type EntityScopeStatus = 'derived' | 'coverage' | 'qualitative' | 'revision' | 'out';

export interface EntityScopeDecision {
  entityId: string;
  status: EntityScopeStatus;
  reason: string;
}

/* ── Workstreams (beyond the TB) — each becomes a real RACM shell ───────── */

export interface V2Workstream {
  id: 'itgc' | 'elc' | 'fscp' | 'consol';
  name: string;
  short: string;
  why: string;
}

export const V2_WORKSTREAMS: V2Workstream[] = [
  { id: 'itgc', name: 'IT general controls (ITGC)', short: 'ITGC', why: 'Scoped by IT system, not from the TB — access, change and operations controls. Gets its own fairly standard RACM.' },
  { id: 'elc', name: 'Entity-level controls (ELC)', short: 'ELC', why: 'Delegation of authority, whistleblower, policies — board-level controls that cut across every process.' },
  { id: 'fscp', name: 'Financial statement close (FSCP)', short: 'FSCP', why: 'Journal entries, estimates and the close calendar sit outside any TB caption.' },
  { id: 'consol', name: 'Consolidation', short: 'Consolidation', why: 'The opinion is on the consolidated financials — eliminations and minority interests live at group level.' },
];

export const ITGC_SYSTEMS = [
  { id: 'erp', name: 'SAP S/4HANA', role: 'ERP — the general ledger' },
  { id: 'epm', name: 'Oracle EPM', role: 'Consolidation & close' },
  { id: 'pay', name: 'Darwinbox', role: 'Payroll' },
  { id: 'trs', name: 'Kyriba', role: 'Treasury management' },
  { id: 'prc', name: 'SAP Ariba', role: 'Procurement' },
] as const;

/* ── People — the layer that powers evidence chasing ────────────────────── */

export interface V2PeopleRow {
  /** Process name or workstream short name. */
  area: string;
  processOwner: string;
  poEmail: string;
  controlOwner: string;
  coEmail: string;
}

export const PEOPLE_SUGGESTIONS: Record<string, Omit<V2PeopleRow, 'area'>> = {
  'Order to Cash': { processOwner: 'Divya Menon', poEmail: 'divya.menon@altura.example', controlOwner: 'Arif Khan', coEmail: 'arif.khan@altura.example' },
  'Procure to Pay': { processOwner: 'Rohit Bansal', poEmail: 'rohit.bansal@altura.example', controlOwner: 'Arif Khan', coEmail: 'arif.khan@altura.example' },
  'Fixed Assets': { processOwner: 'Sanjay Kulkarni', poEmail: 'sanjay.k@altura.example', controlOwner: 'Meera Iyer', coEmail: 'meera.iyer@altura.example' },
  Treasury: { processOwner: 'Nikhil Rao', poEmail: 'nikhil.rao@altura.example', controlOwner: 'Meera Iyer', coEmail: 'meera.iyer@altura.example' },
  Inventory: { processOwner: 'Pooja Nair', poEmail: 'pooja.nair@altura.example', controlOwner: 'Arif Khan', coEmail: 'arif.khan@altura.example' },
  'Payroll (Hire to Retire)': { processOwner: 'Imran Qureshi', poEmail: 'imran.q@altura.example', controlOwner: 'Meera Iyer', coEmail: 'meera.iyer@altura.example' },
  Tax: { processOwner: 'Shreya Patel', poEmail: 'shreya.patel@altura.example', controlOwner: 'Meera Iyer', coEmail: 'meera.iyer@altura.example' },
  ITGC: { processOwner: 'Tanvi Shah', poEmail: 'tanvi.shah@altura.example', controlOwner: 'Vikram Singh', coEmail: 'vikram.singh@altura.example' },
  ELC: { processOwner: 'Kavita Krishnan', poEmail: 'kavita.k@altura.example', controlOwner: 'Audit Committee', coEmail: 'auditcommittee@altura.example' },
  FSCP: { processOwner: 'Arif Khan', poEmail: 'arif.khan@altura.example', controlOwner: 'Meera Iyer', coEmail: 'meera.iyer@altura.example' },
  Consolidation: { processOwner: 'Leena Thomas', poEmail: 'leena.thomas@altura.example', controlOwner: 'Arif Khan', coEmail: 'arif.khan@altura.example' },
};

/* ── Controls & the auditor filter ──────────────────────────────────────── */

export type ControlClass = 'Financial' | 'Operational' | 'Compliance';

export interface V2Control {
  id: string;
  name: string;
  area: string;
  clazz: ControlClass;
  key: boolean;
  frequency: 'Automated' | 'Annual' | 'Quarterly' | 'Monthly' | 'Daily';
  tod: 'Pass' | 'Fail' | 'Pending';
  toe: 'Pass' | 'Fail' | 'Pending' | '—';
  /** Set after remediation — the auditor samples only the effective window. */
  effectiveDate?: string;
  note?: string;
}

/** The call's sampling ladder — automated 1, annual 1, quarterly 2,
 *  monthly 5, daily 25 (spread across entities when the RACM is shared). */
export const SAMPLE_SIZES: Record<V2Control['frequency'], number> = {
  Automated: 1, Annual: 1, Quarterly: 2, Monthly: 5, Daily: 25,
};

/* ── Evidence chasing ───────────────────────────────────────────────────── */

export const CHASE_STAGES = [
  'Not started',
  'Population requested',
  'Population received',
  'Sample selected',
  'Documents requested',
  'Ready to test',
  'Tested',
] as const;

export type ChaseStage = (typeof CHASE_STAGES)[number];

export interface ChaseRow {
  id: string;
  controlId: string;
  stage: ChaseStage;
  popFile?: string;
  popRows?: number;
  docsIn: number;
  reminders: number;
  /** Split note when one RACM spans entities — "5 per entity × 5 entities". */
  split?: string;
}

/* ── Cycle phases — windows follow the year-end convention ──────────────── */

export const V2_PHASES = [
  'Scoping',
  'Design testing',
  'Effectiveness & evidence',
  'Remediation',
  'External audit',
  'Year-end controls',
  'Roll forward',
] as const;

export type V2Phase = (typeof V2_PHASES)[number];

/** The partner's calendar, anchored on the opinion date instead of being
 *  hard-coded: Dec reporters scope in April, Mar reporters in July. */
export function phaseWindows(conv: 'mar' | 'dec'): { phase: V2Phase; window: string }[] {
  return conv === 'dec'
    ? [
        { phase: 'Scoping', window: 'Apr – May' },
        { phase: 'Design testing', window: 'Jun – Sep' },
        { phase: 'Effectiveness & evidence', window: 'Aug – Oct' },
        { phase: 'Remediation', window: 'by Nov' },
        { phase: 'External audit', window: 'Dec' },
        { phase: 'Year-end controls', window: 'Jan – Feb' },
        { phase: 'Roll forward', window: 'Mar' },
      ]
    : [
        { phase: 'Scoping', window: 'Jul – Aug' },
        { phase: 'Design testing', window: 'Sep – Dec' },
        { phase: 'Effectiveness & evidence', window: 'Nov – Jan' },
        { phase: 'Remediation', window: 'by Feb' },
        { phase: 'External audit', window: 'Mar' },
        { phase: 'Year-end controls', window: 'Apr – May' },
        { phase: 'Roll forward', window: 'Jun' },
      ];
}

/* ── The programme ──────────────────────────────────────────────────────── */

export interface V2MaterialityRevision {
  label: string;
  fromOverall: number;
  toOverall: number;
  addedCaptions: number;
  addedEntities: string[];
}

export interface V2Racm {
  /** Process name or workstream short name. */
  area: string;
  kind: 'process' | 'workstream';
  sources: { caption: string; entity: string; via: 'quant' | 'qual' | 'coverage' | 'revision' }[];
  entities: string[];
  /** ITGC only — the systems it was scoped over. */
  systems?: string[];
  controls: number;
}

export interface V2Materiality {
  basis: V2Basis;
  benchmarkLabel: string;
  benchmark: number;
  pct: number;
  overall: number;
  pmPct: number;
  cttPct: number;
}

export interface V2Programme {
  id: string;
  name: string;
  code: string;
  owner: string;
  /** Runtime engagement id — "Open workspace" routes into the classic SOX bench. */
  engagementId?: string;
  fy: string;
  asOf: string;
  conv: 'mar' | 'dec';
  phase: V2Phase;
  groupName: string;
  entities: V2Entity[];
  captions: V2Caption[];
  entityScope: EntityScopeDecision[];
  coverageTargetPct: number;
  coveragePct: number;
  materiality: V2Materiality;
  revisions: V2MaterialityRevision[];
  qualPicks: V2QualPick[];
  racms: V2Racm[];
  people: V2PeopleRow[];
  controls: V2Control[];
  chase: ChaseRow[];
}

/* ── Seed group — Altura Infra Holdings ─────────────────────────────────── */
/* A flat investment group with many similar-size SPVs: the archetype the
 * partner cited for entity derivation + the coverage rule (Mubadala / IHC). */

export const V2_SEED_GROUP = 'Altura Infra Holdings Ltd (Listed)';

export const V2_SEED_ENTITIES: V2Entity[] = [
  { id: 'a-hold', name: 'Altura Infra Holdings Ltd', type: 'Holding', sharePct: 5 },
  { id: 'a-solar', name: 'Altura Solar One Pvt Ltd', type: 'Subsidiary', sharePct: 24 },
  { id: 'a-wind', name: 'Altura Wind Two Pvt Ltd', type: 'Subsidiary', sharePct: 17 },
  { id: 'a-road', name: 'Altura Roadways Pvt Ltd', type: 'Subsidiary', sharePct: 14 },
  { id: 'a-tran', name: 'Altura Transmission Pvt Ltd', type: 'Subsidiary', sharePct: 12 },
  { id: 'a-water', name: 'Altura Water Utilities Pvt Ltd', type: 'Subsidiary', sharePct: 11 },
  { id: 'a-park', name: 'Altura Logistics Parks Pvt Ltd', type: 'Subsidiary', sharePct: 10 },
  { id: 'a-meter', name: 'Altura Smart Metering Pvt Ltd', type: 'Subsidiary', sharePct: 7 },
];

export const V2_SEED_TB_FILES: Record<string, { file: string; lines: number }> = {
  'a-hold': { file: 'altura-holdings-tb.xlsx', lines: 186 },
  'a-solar': { file: 'altura-solar-one-tb.xlsx', lines: 94 },
  'a-wind': { file: 'altura-wind-two-tb.xlsx', lines: 88 },
  'a-road': { file: 'altura-roadways-tb.xlsx', lines: 82 },
  'a-tran': { file: 'altura-transmission-tb.xlsx', lines: 76 },
  'a-water': { file: 'altura-water-tb.xlsx', lines: 71 },
  'a-park': { file: 'altura-logistics-parks-tb.xlsx', lines: 64 },
  'a-meter': { file: 'altura-smart-metering-tb.xlsx', lines: 58 },
};

export const V2_SEED_CAPTIONS: V2Caption[] = [
  // Holdings — corporate books
  { id: 'v-h-01', entityId: 'a-hold', caption: 'Investments in SPVs', balance: 412, process: 'Treasury' },
  { id: 'v-h-02', entityId: 'a-hold', caption: 'Borrowings — group facilities', balance: 186, process: 'Treasury' },
  { id: 'v-h-03', entityId: 'a-hold', caption: 'EPC contractor payables', balance: 24, process: 'Procure to Pay' },
  { id: 'v-h-04', entityId: 'a-hold', caption: 'Management fee income', balance: 12.4, process: 'Order to Cash' },
  { id: 'v-h-05', entityId: 'a-hold', caption: 'Consultancy & advisory spend', balance: 6.8, process: 'Procure to Pay' },
  { id: 'v-h-06', entityId: 'a-hold', caption: 'Corporate payroll', balance: 5.2, process: 'Payroll (Hire to Retire)' },
  { id: 'v-h-07', entityId: 'a-hold', caption: 'Interest-rate swaps (MTM)', balance: 2.1, process: 'Treasury' },
  // Solar One
  { id: 'v-s-01', entityId: 'a-solar', caption: 'Project assets — solar plant', balance: 46, process: 'Fixed Assets' },
  { id: 'v-s-02', entityId: 'a-solar', caption: 'Project debt', balance: 28, process: 'Treasury' },
  { id: 'v-s-03', entityId: 'a-solar', caption: 'EPC retention payable', balance: 11, process: 'Procure to Pay' },
  { id: 'v-s-04', entityId: 'a-solar', caption: 'Energy sale receivables', balance: 8.4, process: 'Order to Cash' },
  { id: 'v-s-05', entityId: 'a-solar', caption: 'O&M costs', balance: 3.9, process: 'Procure to Pay' },
  // Wind Two
  { id: 'v-w-01', entityId: 'a-wind', caption: 'Project assets — wind farm', balance: 31, process: 'Fixed Assets' },
  { id: 'v-w-02', entityId: 'a-wind', caption: 'Project debt', balance: 19, process: 'Treasury' },
  { id: 'v-w-03', entityId: 'a-wind', caption: 'Energy sale receivables', balance: 6.1, process: 'Order to Cash' },
  { id: 'v-w-04', entityId: 'a-wind', caption: 'O&M costs', balance: 3.2, process: 'Procure to Pay' },
  // Roadways — every caption just below PM: the near-miss entity
  { id: 'v-r-01', entityId: 'a-road', caption: 'Concession asset — toll road', balance: 8.8, process: 'Fixed Assets' },
  { id: 'v-r-02', entityId: 'a-road', caption: 'Toll receivables', balance: 4.6, process: 'Order to Cash' },
  { id: 'v-r-03', entityId: 'a-road', caption: 'O&M costs', balance: 2.8, process: 'Procure to Pay' },
  // Transmission
  { id: 'v-t-01', entityId: 'a-tran', caption: 'Transmission assets', balance: 7.9, process: 'Fixed Assets' },
  { id: 'v-t-02', entityId: 'a-tran', caption: 'Wheeling receivables', balance: 3.4, process: 'Order to Cash' },
  // Water Utilities
  { id: 'v-u-01', entityId: 'a-water', caption: 'Treatment plant assets', balance: 6.6, process: 'Fixed Assets' },
  { id: 'v-u-02', entityId: 'a-water', caption: 'User charge receivables', balance: 2.9, process: 'Order to Cash' },
  // Logistics Parks
  { id: 'v-p-01', entityId: 'a-park', caption: 'Warehouse assets', balance: 5.8, process: 'Fixed Assets' },
  { id: 'v-p-02', entityId: 'a-park', caption: 'Lease receivables', balance: 2.2, process: 'Order to Cash' },
  // Smart Metering — tiny balances, huge daily cash flow: the qualitative case
  { id: 'v-m-01', entityId: 'a-meter', caption: 'Metering assets', balance: 4.9, process: 'Fixed Assets' },
  { id: 'v-m-02', entityId: 'a-meter', caption: 'Cash collections in transit', balance: 1.4, process: 'Treasury' },
];

export const V2_SEED_QUAL_PICKS: V2QualPick[] = [
  {
    captionId: 'v-m-02',
    reason: 'High transaction velocity',
    note: 'Balance is ₹ 1.4 Cr, but ~₹ 130 Cr of daily consumer cash collections flow through the year — scoping this in pulls Smart Metering into scope.',
  },
  {
    captionId: 'v-h-07',
    reason: 'Complex accounting',
    note: 'Small MTM balance — swap/hedge accounting complexity warrants scoping in.',
  },
];

export function v2EntityShort(id: string, entities: V2Entity[]): string {
  const name = entities.find(e => e.id === id)?.name ?? id;
  const words = name
    .replace(/^Altura\s+/i, '')
    .split(' ')
    .filter(w => !/^(pvt|ltd|inc|llc)\.?$/i.test(w));
  return words.slice(0, 2).join(' ') || name;
}

export const v2GenCode = () => `SOX-${100 + Math.floor(Math.random() * 900)}`;

/** Generic captions for entities added beyond the seed — small balances, so a
 *  new entity lands OUT of scope until coverage or judgement pulls it in. */
export function v2CaptionsForEntities(entities: V2Entity[]): V2Caption[] {
  const seedIds = new Set(V2_SEED_ENTITIES.map(e => e.id));
  return entities.flatMap(e => seedIds.has(e.id)
    ? V2_SEED_CAPTIONS.filter(c => c.entityId === e.id)
    : [
        { id: `v-${e.id}-01`, entityId: e.id, caption: 'Project assets', balance: 5.4, process: 'Fixed Assets' as V2ProcessName },
        { id: `v-${e.id}-02`, entityId: e.id, caption: 'Receivables', balance: 2.6, process: 'Order to Cash' as V2ProcessName },
        { id: `v-${e.id}-03`, entityId: e.id, caption: 'O&M costs', balance: 1.8, process: 'Procure to Pay' as V2ProcessName },
      ]);
}

/* ── Derivation helpers — shared by the wizard, re-scope and the seed ───── */

export interface V2ScopeResult {
  decisions: EntityScopeDecision[];
  /** Captions in scope, tagged with how they got there. */
  inScope: { caption: V2Caption; via: 'quant' | 'qual' | 'coverage' | 'revision' }[];
  coveragePct: number;
}

/**
 * The core V2 derivation:
 *  1. an entity is IN when any of its captions ≥ performance materiality
 *  2. if the in-scope share misses the coverage target, the largest OUT
 *     entities are pulled in until it clears (their top caption joins)
 *  3. a qualitative pick pulls its caption — and its entity — into scope
 */
export function deriveEntityScope(
  entities: V2Entity[],
  captions: V2Caption[],
  pm: number,
  coverageTargetPct: number,
  qualIds: Set<string>,
  coverageOverrides?: Record<string, boolean>,
): V2ScopeResult {
  const byEntity = new Map(entities.map(e => [e.id, captions.filter(c => c.entityId === e.id)]));
  const decisions: EntityScopeDecision[] = [];
  const inScope: V2ScopeResult['inScope'] = [];

  const derivedIds = new Set<string>();
  for (const e of entities) {
    const rows = byEntity.get(e.id) ?? [];
    const above = rows.filter(c => c.balance >= pm);
    if (above.length > 0) {
      derivedIds.add(e.id);
      decisions.push({ entityId: e.id, status: 'derived', reason: `${above.length} caption${above.length === 1 ? '' : 's'} ≥ performance materiality` });
      for (const c of above) inScope.push({ caption: c, via: 'quant' });
    }
  }

  // Coverage: pull the largest OUT entities until the target clears.
  let coverage = entities.filter(e => derivedIds.has(e.id)).reduce((s, e) => s + e.sharePct, 0);
  const coverageIds = new Set<string>();
  const outsBySize = entities
    .filter(e => !derivedIds.has(e.id))
    .sort((a, b) => b.sharePct - a.sharePct);
  for (const e of outsBySize) {
    const overridden = coverageOverrides?.[e.id];
    const want = overridden ?? coverage < coverageTargetPct;
    if (!want) continue;
    coverageIds.add(e.id);
    coverage += e.sharePct;
    decisions.push({ entityId: e.id, status: 'coverage', reason: `Pulled in for coverage — group share ${e.sharePct}%` });
    const rows = (byEntity.get(e.id) ?? []).slice().sort((a, b) => b.balance - a.balance);
    if (rows[0]) inScope.push({ caption: rows[0], via: 'coverage' });
  }

  // Qualitative picks pull their caption — and, if needed, their entity.
  for (const c of captions) {
    if (!qualIds.has(c.id)) continue;
    inScope.push({ caption: c, via: 'qual' });
    if (!derivedIds.has(c.entityId) && !coverageIds.has(c.entityId)) {
      const already = decisions.find(d => d.entityId === c.entityId && d.status === 'qualitative');
      if (!already) {
        const e = entities.find(x => x.id === c.entityId);
        coverage += e?.sharePct ?? 0;
        decisions.push({ entityId: c.entityId, status: 'qualitative', reason: `Scoped in by judgement — ${c.caption.toLowerCase()}` });
      }
    }
  }

  const inIds = new Set(decisions.map(d => d.entityId));
  for (const e of entities) {
    if (inIds.has(e.id)) continue;
    const rows = (byEntity.get(e.id) ?? []).slice().sort((a, b) => b.balance - a.balance);
    const top = rows[0];
    decisions.push({
      entityId: e.id,
      status: 'out',
      reason: top ? `No caption ≥ PM — largest is ${top.caption.toLowerCase()} at ₹ ${top.balance} Cr` : 'No trial balance captions',
    });
  }

  return { decisions, inScope, coveragePct: Math.round(coverage) };
}

/** Group the in-scope captions by process — each group is one RACM. */
export function deriveV2Racms(
  inScope: V2ScopeResult['inScope'],
  entities: V2Entity[],
): V2Racm[] {
  const byProcess = new Map<string, V2Racm>();
  for (const { caption, via } of inScope) {
    let r = byProcess.get(caption.process);
    if (!r) {
      r = { area: caption.process, kind: 'process', sources: [], entities: [], controls: 0 };
      byProcess.set(caption.process, r);
    }
    const ent = v2EntityShort(caption.entityId, entities);
    r.sources.push({ caption: caption.caption, entity: ent, via });
    if (!r.entities.includes(ent)) r.entities.push(ent);
  }
  return [...byProcess.values()].sort((a, b) => b.sources.length - a.sources.length);
}

export function workstreamRacms(
  picked: V2Workstream['id'][],
  systems: string[],
  groupShort: string,
): V2Racm[] {
  return V2_WORKSTREAMS.filter(w => picked.includes(w.id)).map(w => ({
    area: w.short,
    kind: 'workstream' as const,
    sources: [],
    entities: [groupShort],
    systems: w.id === 'itgc' ? systems : undefined,
    controls: 0,
  }));
}

/* ── Seeded FY26 programme — mid-cycle, so chasing is live ──────────────── */

function buildV2Seed(): V2Programme {
  const materiality: V2Materiality = {
    basis: 'pbt',
    benchmarkLabel: 'Profit before tax (consolidated)',
    benchmark: 240,
    pct: 5,
    overall: 12,
    pmPct: 75,
    cttPct: 5,
  };
  const pm = materiality.overall * materiality.pmPct / 100; // ₹ 9 Cr
  const qualIds = new Set(V2_SEED_QUAL_PICKS.map(q => q.captionId));
  const scope = deriveEntityScope(V2_SEED_ENTITIES, V2_SEED_CAPTIONS, pm, 60, qualIds);
  const racms = deriveV2Racms(scope.inScope, V2_SEED_ENTITIES);
  const ws = workstreamRacms(
    ['itgc', 'elc', 'fscp', 'consol'],
    ['SAP S/4HANA', 'Oracle EPM', 'Kyriba'],
    'Group',
  );

  const controls: V2Control[] = [
    { id: 'vc-01', name: 'CFO approves hedge deals before execution', area: 'Treasury', clazz: 'Financial', key: true, frequency: 'Quarterly', tod: 'Pass', toe: 'Pass' },
    { id: 'vc-02', name: 'Monthly bank reconciliation reviewed by CFO', area: 'Treasury', clazz: 'Financial', key: true, frequency: 'Monthly', tod: 'Pass', toe: 'Fail', effectiveDate: '1 Sep 2026', note: 'Remediated after TOE failure — the auditor samples Sep – Dec only.' },
    { id: 'vc-03', name: 'Capitalisation memo approved before assets go live', area: 'Fixed Assets', clazz: 'Financial', key: true, frequency: 'Monthly', tod: 'Pending', toe: 'Pending' },
    { id: 'vc-04', name: 'Physical verification of project assets', area: 'Fixed Assets', clazz: 'Financial', key: false, frequency: 'Annual', tod: 'Pass', toe: 'Pending' },
    { id: 'vc-05', name: 'Three-way match on EPC milestone billing', area: 'Order to Cash', clazz: 'Financial', key: true, frequency: 'Daily', tod: 'Pass', toe: 'Pending' },
    { id: 'vc-06', name: 'Daily cash collections banked next business day', area: 'Order to Cash', clazz: 'Financial', key: true, frequency: 'Daily', tod: 'Pass', toe: 'Pending' },
    { id: 'vc-07', name: 'PO approval per delegation of authority', area: 'Procure to Pay', clazz: 'Financial', key: true, frequency: 'Daily', tod: 'Pass', toe: 'Pass' },
    { id: 'vc-08', name: 'Minimum three vendor quotations (RFQ)', area: 'Procure to Pay', clazz: 'Operational', key: false, frequency: 'Daily', tod: 'Pass', toe: '—', note: 'Operational, kept in ICFR as an anti-fraud control.' },
    { id: 'vc-09', name: 'Quarterly user-access review on SAP', area: 'ITGC', clazz: 'Financial', key: true, frequency: 'Quarterly', tod: 'Pass', toe: 'Pending' },
    { id: 'vc-10', name: 'Whistleblower channel reviewed by Audit Committee', area: 'ELC', clazz: 'Compliance', key: true, frequency: 'Quarterly', tod: 'Pass', toe: '—' },
  ];

  const chase: ChaseRow[] = [
    { id: 'vch-01', controlId: 'vc-05', stage: 'Ready to test', popFile: 'epc-billing-register-fy26.xlsx', popRows: 3184, docsIn: 25, reminders: 2, split: '5 per entity × 5 entities' },
    { id: 'vch-02', controlId: 'vc-07', stage: 'Population received', popFile: 'po-register-fy26.xlsx', popRows: 8412, docsIn: 0, reminders: 0, split: '5 per entity × 5 entities' },
    { id: 'vch-03', controlId: 'vc-01', stage: 'Sample selected', popFile: 'hedge-deals-fy26.xlsx', popRows: 9, docsIn: 0, reminders: 0 },
    { id: 'vch-04', controlId: 'vc-09', stage: 'Tested', popFile: 'sap-user-list-q2.xlsx', popRows: 412, docsIn: 2, reminders: 1 },
    { id: 'vch-05', controlId: 'vc-02', stage: 'Not started', docsIn: 0, reminders: 0 },
    { id: 'vch-06', controlId: 'vc-03', stage: 'Not started', docsIn: 0, reminders: 0 },
  ];

  const areas = [...racms.map(r => r.area), ...ws.map(r => r.area)];
  const people: V2PeopleRow[] = areas.map(a => ({ area: a, ...(PEOPLE_SUGGESTIONS[a] ?? { processOwner: 'Unassigned', poEmail: '', controlOwner: 'Unassigned', coEmail: '' }) }));

  for (const r of [...racms, ...ws]) {
    r.controls = controls.filter(c => c.area === r.area).length || (r.kind === 'process' ? 2 : 3);
  }

  // A real runtime engagement backs the programme — "Open workspace" lands in
  // the classic SOX bench, seeded 'carried' (design concluded, TOE retest) to
  // match the mid-TOE phase.
  registerEngagement({
    id: 'sox-v2-fy26',
    code: 'SOX-104',
    name: 'FY26 ICFR — Altura Infra Group',
    description: 'SOX 404 / ICFR programme — V2 scoping: 5/8 entities derived in scope (67% coverage), 8 RACMs incl. group workstreams.',
    type: 'SOX / ICFR',
    soxConfig: {
      overallMateriality: 120_000_000,
      performanceMateriality: 90_000_000,
      clearlyTrivial: 6_000_000,
      sdBandPct: 20,
      aggregate: true,
      keyOnly: true,
    },
    soxProcesses: [...racms.map(r => r.area), ...ws.map(r => r.area)],
    soxSeedMode: 'carried',
    process: 'P2P',
    framework: 'COSO 2013 / SOX 404',
    owner: 'A. Mehta',
    status: 'Active',
    periodStart: 'Jan 2026',
    periodEnd: 'Dec 2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    entity: V2_SEED_GROUP,
    controls: controls.length,
    health: 64,
    openIssues: 1,
    lastActivity: '1d ago',
    nextScheduled: 'Remediation — by Nov 2026',
  });

  return {
    id: 'sox-v2-fy26',
    engagementId: 'sox-v2-fy26',
    name: 'FY26 ICFR — Altura Infra Group',
    code: 'SOX-104',
    owner: 'A. Mehta',
    fy: 'FY26',
    asOf: '31 Dec 2026',
    conv: 'dec',
    phase: 'Effectiveness & evidence',
    groupName: V2_SEED_GROUP,
    entities: V2_SEED_ENTITIES.map(e => ({ ...e, ...V2_SEED_TB_FILES[e.id] })),
    captions: V2_SEED_CAPTIONS,
    entityScope: scope.decisions,
    coverageTargetPct: 60,
    coveragePct: scope.coveragePct,
    materiality,
    revisions: [],
    qualPicks: V2_SEED_QUAL_PICKS,
    racms: [...racms, ...ws],
    people,
    controls,
    chase,
  };
}

/** Module-level store — survives tab switches, same pattern as PROGRAMMES. */
export const V2_PROGRAMMES: V2Programme[] = [buildV2Seed()];

export function registerV2Programme(p: V2Programme) {
  const i = V2_PROGRAMMES.findIndex(x => x.id === p.id);
  if (i >= 0) V2_PROGRAMMES[i] = p;
  else V2_PROGRAMMES.unshift(p);
}
