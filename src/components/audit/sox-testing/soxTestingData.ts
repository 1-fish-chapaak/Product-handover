import { ENGAGEMENTS, registerEngagement } from '../../../data/engagements';

/**
 * SOX Testing tab — data layer for the scoping-first flow prototype.
 *
 * This models the partner-validated journey: materiality is set first, each
 * entity's trial balance is scoped quantitatively, a qualitative overlay
 * catches small-balance/high-risk captions, and the in-scope processes are
 * DERIVED from that exercise — each one becoming a RACM. Nothing here touches
 * the existing engagement or SOX workspace data.
 */

export type EntityType = 'Holding' | 'Subsidiary';

export interface GroupEntity {
  id: string;
  name: string;
  type: EntityType;
  /** Group ownership, % */
  ownership: number;
  /** Simulated trial-balance upload — set once the file is "parsed". */
  tbFile?: string;
  tbLines?: number;
  /** Materiality rule assigned on the Configuration tab — undefined = group default. */
  ruleId?: string;
}

/** 'netAssets' is produced only by the V2 wizard (call decision #3) — the
 *  classic wizard's option list is unchanged. */
export type MaterialityBasis = 'pbt' | 'revenue' | 'netAssets' | 'assets' | 'expenses' | 'custom';

export interface BasisOption {
  id: MaterialityBasis;
  label: string;
  hint: string;
  defaultPct: number;
  benchmarkLabel: string;
  /** ₹ Cr */
  defaultBenchmark: number;
}

export const BASIS_OPTIONS: BasisOption[] = [
  {
    id: 'pbt',
    label: '% of profit before tax',
    hint: 'Profit-making company — the classic base, typically ~5%',
    defaultPct: 5,
    benchmarkLabel: 'Profit before tax (consolidated)',
    defaultBenchmark: 420,
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
    // Asset-intensive groups — the band the app's own BENCHMARK_META already
    // quotes for total assets (0.5–2%), taken at its midpoint.
    id: 'assets',
    label: '% of total asset balance',
    hint: 'Asset-intensive group (infrastructure, fleet) — 0.5–2% of total assets',
    defaultPct: 1,
    benchmarkLabel: 'Total assets (consolidated)',
    defaultBenchmark: 8400,
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
    defaultBenchmark: 21,
  },
];

export type ProcessName =
  | 'Order to Cash'
  | 'Procure to Pay'
  | 'Inventory'
  | 'Fixed Assets'
  | 'Payroll (Hire to Retire)'
  | 'Treasury'
  | 'Tax';

export interface TbCaption {
  id: string;
  entityId: string;
  caption: string;
  /** Closing balance / annual total, ₹ Cr */
  balance: number;
  /** Suggested process mapping — editable in the wizard. */
  process: ProcessName;
}

export const QUAL_REASONS = [
  'High transaction velocity',
  'Complex accounting',
  'Fraud risk',
  'Regulatory focus',
  'Management estimate / judgement',
] as const;

export interface QualPick {
  captionId: string;
  reason: (typeof QUAL_REASONS)[number];
  note: string;
}

export interface BeyondTbItem {
  id: string;
  name: string;
  short: string;
  why: string;
}

export const BEYOND_TB: BeyondTbItem[] = [
  {
    id: 'fscp',
    name: 'Financial statement close (FSCP)',
    short: 'FSCP',
    why: 'Journal entries, estimates and the close calendar sit outside any TB caption.',
  },
  {
    id: 'consol',
    name: 'Consolidation',
    short: 'Consolidation',
    why: 'The opinion is on the consolidated financials — eliminations and minority interests are scoped at group level.',
  },
  {
    id: 'elc',
    name: 'Entity-level controls (ELC)',
    short: 'ELC',
    why: 'Tone at the top, delegation of authority, whistleblower — these cut across every process.',
  },
  {
    id: 'itgc',
    name: 'IT general controls (ITGC)',
    short: 'ITGC',
    why: 'Access, change and operations controls underpin every automated control relied on.',
  },
];

/* ------------------------------------------------------------------ */
/* Seed group + trial balances (₹ Cr)                                  */
/* ------------------------------------------------------------------ */

export const SEED_GROUP_NAME = 'Airline Group Ltd (Listed)';

export const SEED_ENTITIES: GroupEntity[] = [
  { id: 'ent-hold', name: 'Airline Group Ltd', type: 'Holding', ownership: 100 },
  { id: 'ent-retail', name: 'AirConnect Regional Pvt Ltd', type: 'Subsidiary', ownership: 100 },
  { id: 'ent-logi', name: 'SkyCargo Logistics Pvt Ltd', type: 'Subsidiary', ownership: 74 },
];

/** Simulated parse result per entity — filename + line count. */
export const SEED_TB_FILES: Record<string, { file: string; lines: number }> = {
  'ent-hold': { file: 'airline-group-tb-fy27.xlsx', lines: 214 },
  'ent-retail': { file: 'airconnect-tb-fy27.xlsx', lines: 168 },
  'ent-logi': { file: 'skycargo-tb-fy27.xlsx', lines: 141 },
};

export const SEED_CAPTIONS: TbCaption[] = [
  // Airline Group Ltd (Holding)
  { id: 'tb-h-01', entityId: 'ent-hold', caption: 'Passenger & cargo revenue', balance: 3120, process: 'Order to Cash' },
  { id: 'tb-h-02', entityId: 'ent-hold', caption: 'Aircraft fuel expense', balance: 1890, process: 'Procure to Pay' },
  { id: 'tb-h-03', entityId: 'ent-hold', caption: 'Property, plant & equipment', balance: 1140, process: 'Fixed Assets' },
  { id: 'tb-h-04', entityId: 'ent-hold', caption: 'Borrowings', balance: 890, process: 'Treasury' },
  { id: 'tb-h-05', entityId: 'ent-hold', caption: 'Investments in subsidiaries', balance: 640, process: 'Treasury' },
  { id: 'tb-h-06', entityId: 'ent-hold', caption: 'Trade receivables', balance: 486, process: 'Order to Cash' },
  { id: 'tb-h-07', entityId: 'ent-hold', caption: 'Employee benefit expense', balance: 412, process: 'Payroll (Hire to Retire)' },
  { id: 'tb-h-08', entityId: 'ent-hold', caption: 'Trade payables', balance: 342, process: 'Procure to Pay' },
  { id: 'tb-h-09', entityId: 'ent-hold', caption: 'Inventories', balance: 268, process: 'Inventory' },
  { id: 'tb-h-10', entityId: 'ent-hold', caption: 'Other operating expenses', balance: 234, process: 'Procure to Pay' },
  { id: 'tb-h-11', entityId: 'ent-hold', caption: 'Income tax (current + deferred)', balance: 118, process: 'Tax' },
  { id: 'tb-h-12', entityId: 'ent-hold', caption: 'Cash & bank balances', balance: 96, process: 'Treasury' },
  { id: 'tb-h-13', entityId: 'ent-hold', caption: 'Provisions', balance: 19, process: 'Procure to Pay' },
  { id: 'tb-h-14', entityId: 'ent-hold', caption: 'Derivatives — fuel hedges', balance: 14, process: 'Treasury' },
  // AirConnect Regional Pvt Ltd
  { id: 'tb-r-01', entityId: 'ent-retail', caption: 'Passenger revenue — regional', balance: 1480, process: 'Order to Cash' },
  { id: 'tb-r-02', entityId: 'ent-retail', caption: 'Inventories — in-flight & stores', balance: 348, process: 'Inventory' },
  { id: 'tb-r-03', entityId: 'ent-retail', caption: 'Trade payables', balance: 198, process: 'Procure to Pay' },
  { id: 'tb-r-04', entityId: 'ent-retail', caption: 'Employee benefit expense', balance: 164, process: 'Payroll (Hire to Retire)' },
  { id: 'tb-r-05', entityId: 'ent-retail', caption: 'Lease liabilities — aircraft', balance: 142, process: 'Treasury' },
  { id: 'tb-r-06', entityId: 'ent-retail', caption: 'Trade receivables', balance: 112, process: 'Order to Cash' },
  { id: 'tb-r-07', entityId: 'ent-retail', caption: 'Property, plant & equipment', balance: 86, process: 'Fixed Assets' },
  { id: 'tb-r-08', entityId: 'ent-retail', caption: 'Marketing & promotion expense', balance: 58, process: 'Procure to Pay' },
  { id: 'tb-r-09', entityId: 'ent-retail', caption: 'Other current assets', balance: 12, process: 'Procure to Pay' },
  { id: 'tb-r-10', entityId: 'ent-retail', caption: 'Cash & bank balances', balance: 8, process: 'Treasury' },
  // SkyCargo Logistics Pvt Ltd
  { id: 'tb-l-01', entityId: 'ent-logi', caption: 'Freight & logistics revenue', balance: 640, process: 'Order to Cash' },
  { id: 'tb-l-02', entityId: 'ent-logi', caption: 'Fuel & operating costs', balance: 402, process: 'Procure to Pay' },
  { id: 'tb-l-03', entityId: 'ent-logi', caption: 'Ground fleet & equipment', balance: 310, process: 'Fixed Assets' },
  { id: 'tb-l-04', entityId: 'ent-logi', caption: 'Borrowings', balance: 176, process: 'Treasury' },
  { id: 'tb-l-05', entityId: 'ent-logi', caption: 'Trade receivables', balance: 154, process: 'Order to Cash' },
  { id: 'tb-l-06', entityId: 'ent-logi', caption: 'Employee benefit expense', balance: 118, process: 'Payroll (Hire to Retire)' },
  { id: 'tb-l-07', entityId: 'ent-logi', caption: 'Trade payables', balance: 88, process: 'Procure to Pay' },
  { id: 'tb-l-08', entityId: 'ent-logi', caption: 'Insurance claims receivable', balance: 16, process: 'Order to Cash' },
  { id: 'tb-l-09', entityId: 'ent-logi', caption: 'Cash & bank balances', balance: 11, process: 'Treasury' },
  { id: 'tb-l-10', entityId: 'ent-logi', caption: 'Provisions & accruals', balance: 9, process: 'Procure to Pay' },
];

/** The two classic qualitative scope-ins the partner cited, pre-selected. */
export const SEED_QUAL_PICKS: QualPick[] = [
  {
    captionId: 'tb-r-10',
    reason: 'High transaction velocity',
    note: 'Balance is ₹ 8 Cr, but ~₹ 1,400 Cr of daily fare collections flow through the year.',
  },
  {
    captionId: 'tb-h-14',
    reason: 'Complex accounting',
    note: 'Small MTM balance — fuel-hedge accounting complexity warrants scoping in.',
  },
];

/* ------------------------------------------------------------------ */
/* Programme (the wizard's output)                                     */
/* ------------------------------------------------------------------ */

export type CyclePhase =
  | 'Scoping'
  | 'Design testing'
  | 'Interim testing'
  | 'Roll-forward'
  | 'Year-end testing'
  | 'Reporting';

export const CYCLE_PHASES: { phase: CyclePhase; window: string }[] = [
  { phase: 'Scoping', window: 'Apr – Jun' },
  { phase: 'Design testing', window: 'Jun – Sep' },
  { phase: 'Interim testing', window: 'Sep – Dec' },
  { phase: 'Roll-forward', window: 'Jan – Mar' },
  { phase: 'Year-end testing', window: 'as of 31 Mar' },
  { phase: 'Reporting', window: 'Apr – May' },
];

export interface DerivedRacm {
  process: ProcessName;
  /** In-scope captions feeding this RACM (labels incl. entity short-name). */
  sources: { caption: string; entity: string; qualitative?: boolean }[];
  /** Distinct entities covered. */
  entities: string[];
  /** Seeded programmes carry live testing numbers; new ones are shells. */
  controls?: number;
  effective?: number;
  /** Rolled forward from the prior cycle — design carried, operating retest. */
  carried?: boolean;
  /** Set only by the V2 wizard (call decisions #7/#8) — classic never reads
   *  these. Group-level workstream RACM (FSCP / Consolidation / ELC / ITGC
   *  per system) and the people evidence chasing runs on. */
  workstream?: boolean;
  processOwner?: string;
  controlOwner?: string;
}

export interface MaterialitySet {
  basis: MaterialityBasis;
  benchmarkLabel: string;
  /** ₹ Cr */
  benchmark: number;
  pct: number;
  /** ₹ Cr */
  overall: number;
  pmPct: number;
  cttPct: number;
}

/** A named materiality rule — the group default plus any added on the
 *  Configuration tab. An entity assigned a rule is flagged against ITS
 *  computed overall (component materiality); unassigned entities use the
 *  group default. */
export interface MaterialityRule {
  id: string;
  name: string;
  basis: MaterialityBasis;
  /** ₹ Cr */
  benchmark: number;
  pct: number;
}

/** ₹ Cr threshold a rule computes. */
export const ruleOverall = (r: MaterialityRule): number =>
  r.basis === 'custom' ? r.benchmark : Math.round(r.benchmark * r.pct * 100) / 10000;

/** End-year of the financial year in progress — 2027 means FY 2026-27.
 *
 *  The Indian financial year runs Apr–Mar, so from April onward the group is
 *  reporting on a year that ends in the NEXT calendar year. Creation flows call
 *  this instead of hard-coding a year: the audit-period field is parked on the
 *  scoping wizard, so a frozen default would have silently kept creating
 *  FY 2026-27 programmes forever. */
export const currentFyEnd = (now: Date = new Date()): number =>
  (now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear());

/** The three cycles a creation flow offers: the current one, with one either
 *  side. Calendar years sit one behind, matching the fy ⇄ cy toggle. */
export const cycleYears = (basis: 'fy' | 'cy', now: Date = new Date()): number[] => {
  const mid = basis === 'fy' ? currentFyEnd(now) : currentFyEnd(now) - 1;
  return [mid - 1, mid, mid + 1];
};

export interface SoxProgramme {
  id: string;
  /** Display name — typed on the classic "Type & basics" first step. */
  name: string;
  code?: string;
  owner?: string;
  /** Runtime engagement id — card click opens the classic SOX workspace on it. */
  engagementId?: string;
  /** Set when this cycle was rolled forward from the prior one. */
  rolledFromFy?: string;
  fy: string;
  asOf: string;
  phase: CyclePhase;
  groupName: string;
  entities: GroupEntity[];
  materiality: MaterialitySet;
  /** Extra named materiality rules (Configuration tab) — the group default
   *  lives in `materiality`. */
  matRules?: MaterialityRule[];
  totalCaptions: number;
  quantCount: number;
  qualCount: number;
  racms: DerivedRacm[];
  beyondTb: string[];
  /** Set when the wizard's Scoping step was skipped — the workspace Overview
   *  flags the missing RACM and GL / trial balances until they're added
   *  (RACM tab / Configuration tab). */
  scopingSkipped?: boolean;
  /** Hidden from the SOX Testing listing — used by back-filled records whose
   *  story is already a card there (ENG-001 ≡ the seeded FY26 programme). The
   *  record still powers the workspace Configuration tab. */
  unlisted?: boolean;
}

const ENTITY_SHORT: Record<string, string> = {
  'ent-hold': 'Group',
  'ent-retail': 'AirConnect',
  'ent-logi': 'SkyCargo',
};

export function entityShort(id: string, entities: GroupEntity[]): string {
  if (ENTITY_SHORT[id]) return ENTITY_SHORT[id];
  const name = entities.find(e => e.id === id)?.name ?? id;
  const words = name.split(' ').filter(w => !/^(pvt|ltd|inc|llc)\.?$/i.test(w));
  return words[words.length - 1] ?? name;
}

export const genCode = () => `ENG-0${10 + Math.floor(Math.random() * 90)}`;

/** Generic captions for entities added beyond the seeded three — keeps every
 *  flow walkable without real TB data. */
export function captionsForEntities(entities: GroupEntity[]): TbCaption[] {
  const seedIds = new Set(SEED_ENTITIES.map(e => e.id));
  return entities.flatMap(e => seedIds.has(e.id)
    ? SEED_CAPTIONS.filter(c => c.entityId === e.id)
    : [
        { id: `tb-${e.id}-01`, entityId: e.id, caption: 'Revenue from operations', balance: 120, process: 'Order to Cash' as ProcessName },
        { id: `tb-${e.id}-02`, entityId: e.id, caption: 'Operating expenses', balance: 64, process: 'Procure to Pay' as ProcessName },
        { id: `tb-${e.id}-03`, entityId: e.id, caption: 'Trade receivables', balance: 38, process: 'Order to Cash' as ProcessName },
        { id: `tb-${e.id}-04`, entityId: e.id, caption: 'Trade payables', balance: 27, process: 'Procure to Pay' as ProcessName },
      ]);
}

/** Deterministic year-over-year movement for the roll-forward demo. Two
 *  deliberate boundary-crossers: Provisions swell past materiality (newly in
 *  scope) and Marketing spend falls below it (descope candidate). */
export function rollBalance(c: TbCaption): number {
  const OVERRIDES: Record<string, number> = { 'tb-h-13': 26, 'tb-r-08': 19 };
  if (OVERRIDES[c.id] != null) return OVERRIDES[c.id];
  const pct = /revenue/i.test(c.caption) ? 1.06 : 1.05;
  return Math.round(c.balance * pct * 10) / 10;
}

/** ₹ Cr formatter — tabular, Indian grouping, one decimal only when needed. */
export function fmtCr(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  const str = rounded.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : rounded * 10 === Math.round(rounded * 10) ? 1 : 2,
    maximumFractionDigits: 2,
  });
  return `₹ ${str} Cr`;
}

/**
 * The core derivation: in-scope captions (quantitative ∪ qualitative) grouped
 * by their mapped process — each group becomes one RACM.
 */
export function deriveRacms(
  inScope: TbCaption[],
  qualIds: Set<string>,
  entities: GroupEntity[],
): DerivedRacm[] {
  const byProcess = new Map<ProcessName, DerivedRacm>();
  for (const c of inScope) {
    let r = byProcess.get(c.process);
    if (!r) {
      r = { process: c.process, sources: [], entities: [] };
      byProcess.set(c.process, r);
    }
    const ent = entityShort(c.entityId, entities);
    r.sources.push({ caption: c.caption, entity: ent, qualitative: qualIds.has(c.id) });
    if (!r.entities.includes(ent)) r.entities.push(ent);
  }
  // Stable, biggest-first ordering so the landing reads well.
  return [...byProcess.values()].sort((a, b) => b.sources.length - a.sources.length);
}

/* ------------------------------------------------------------------ */
/* Seeded FY26 programme — the completed example the tab lands on      */
/* ------------------------------------------------------------------ */

function buildSeedProgramme(): SoxProgramme {
  const overall = 21;
  const qualIds = new Set(SEED_QUAL_PICKS.map(q => q.captionId));
  const inScope = SEED_CAPTIONS.filter(c => c.balance >= overall || qualIds.has(c.id));
  const racms = deriveRacms(inScope, qualIds, SEED_ENTITIES);
  // Live testing numbers for the completed example — counts match exactly what
  // the workspace's RACM tab seeds per process (Payroll and Tax templates
  // carry fewer controls than the rest).
  const CONTROLS: Record<string, [number, number]> = {
    'Order to Cash': [5, 4],
    'Procure to Pay': [5, 4],
    Treasury: [5, 4],
    'Payroll (Hire to Retire)': [4, 3],
    Inventory: [5, 4],
    'Fixed Assets': [5, 4],
    Tax: [3, 2],
  };
  for (const r of racms) {
    const [c, e] = CONTROLS[r.process] ?? [6, 5];
    r.controls = c;
    r.effective = e;
  }
  // The seed programme opens its OWN workspace (not eng-1) so the RACM tab
  // seeds exactly the scoping-derived processes — summary and workspace agree.
  registerEngagement({
    id: 'sox-prog-fy26',
    code: 'ENG-001',
    name: 'FY26 ICFR — Airline P2P & O2C',
    description: 'SOX 404 / ICFR programme — FY26 cycle scoped from 3 trial balances; 7 in-scope processes, one RACM each.',
    type: 'SOX / ICFR',
    soxConfig: {
      overallMateriality: 210_000_000,
      performanceMateriality: 157_500_000,
      clearlyTrivial: 10_500_000,
      sdBandPct: 20,
      aggregate: true,
      keyOnly: true,
    },
    soxProcesses: racms.map(r => r.process),
    soxSeedMode: 'live',
    process: 'P2P',
    framework: 'COSO 2013 / SOX 404',
    owner: 'A. Mehta',
    status: 'Active',
    periodStart: 'Apr 2025',
    periodEnd: 'Mar 2026',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    entity: SEED_GROUP_NAME,
    controls: 32,
    health: 78,
    openIssues: 0,
    lastActivity: '2d ago',
    nextScheduled: 'Year-end testing — as of 31 Mar 2026',
  });
  return {
    id: 'sox-prog-fy26',
    name: 'FY26 ICFR — Airline P2P & O2C',
    code: 'ENG-001',
    owner: 'A. Mehta',
    engagementId: 'sox-prog-fy26',
    fy: 'FY26',
    asOf: '31 Mar 2026',
    phase: 'Year-end testing',
    groupName: SEED_GROUP_NAME,
    entities: SEED_ENTITIES.map(e => ({ ...e, ...SEED_TB_FILES[e.id] ? { tbFile: SEED_TB_FILES[e.id].file.replace('fy27', 'fy26'), tbLines: SEED_TB_FILES[e.id].lines } : {} })),
    materiality: {
      basis: 'pbt',
      benchmarkLabel: 'Profit before tax (consolidated)',
      benchmark: 420,
      pct: 5,
      overall,
      pmPct: 75,
      cttPct: 5,
    },
    totalCaptions: SEED_CAPTIONS.length,
    quantCount: inScope.length - qualIds.size,
    qualCount: qualIds.size,
    racms,
    beyondTb: BEYOND_TB.map(b => b.id),
  };
}

/**
 * Session store — module-level so the list survives tab switches (the same
 * pattern as RUNTIME_ENGAGEMENTS). Seeds the completed FY26 example.
 */
export const PROGRAMMES: SoxProgramme[] = [buildSeedProgramme()];

/** Back-fill (user ask): SOX / ICFR engagements born before the scoping flow
 *  (classic seeds like ENG-002 / ENG-010) get a programme record synthesized
 *  from what they already carry — that record lights up the workspace
 *  Configuration tab and lists the cycle on SOX Testing. Their own numbers
 *  are kept: materiality from soxConfig when present, else the workspace
 *  default rules (₹50 L / 75% / 5%); one RACM shell for the anchor process.
 *  ENG-001 gets a record too (its workspace needs the Configuration tab) but
 *  stays UNLISTED on SOX Testing — the seeded FY26 programme already carries
 *  that story there under the same name and code. */
const BF_CR = 10_000_000;
const BF_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BF_PROC: Record<string, string> = {
  P2P: 'Procure to Pay', O2C: 'Order to Cash', R2R: 'Record to Report',
  S2C: 'Source to Contract', ITGC: 'IT General Controls',
};
for (const eng of ENGAGEMENTS) {
  if (eng.type !== 'SOX / ICFR') continue;
  if (PROGRAMMES.some(p => p.engagementId === eng.id)) continue;
  const codeCollides = PROGRAMMES.some(p => p.code && p.code === eng.code);
  const overallCr = (eng.soxConfig?.overallMateriality ?? 5_000_000) / BF_CR;
  const end = eng.endDate ? new Date(eng.endDate + 'T00:00:00') : null;
  const fyYear = end?.getFullYear() ?? 2026;
  PROGRAMMES.push({
    id: `sox-bf-${eng.id}`,
    engagementId: eng.id,
    name: eng.name,
    code: eng.code,
    owner: eng.owner,
    fy: `FY${String(fyYear).slice(-2)}`,
    asOf: end ? `${end.getDate()} ${BF_MONTHS[end.getMonth()]} ${fyYear}` : '31 Mar 2026',
    phase: eng.status === 'Planned' || eng.status === 'Draft' ? 'Scoping'
      : eng.status === 'Closed' ? 'Reporting' : 'Design testing',
    groupName: eng.entity ?? SEED_GROUP_NAME,
    entities: [],
    materiality: {
      basis: 'custom',
      benchmarkLabel: 'Overall materiality',
      benchmark: overallCr,
      pct: 100,
      overall: overallCr,
      pmPct: eng.soxConfig ? Math.round(eng.soxConfig.performanceMateriality / eng.soxConfig.overallMateriality * 100) : 75,
      cttPct: eng.soxConfig ? Math.round(eng.soxConfig.clearlyTrivial / eng.soxConfig.overallMateriality * 100) : 5,
    },
    totalCaptions: 0,
    quantCount: 0,
    qualCount: 0,
    // 'Record to Report' isn't in the scoping catalogue's ProcessName union —
    // the workspace already seeds non-catalogue names as generic shells, so
    // the label is carried through as-is.
    racms: [{ process: (BF_PROC[eng.process] ?? eng.process) as ProcessName, sources: [], entities: [] }],
    beyondTb: [],
    unlisted: codeCollides || undefined,
  });
}

export function registerProgramme(p: SoxProgramme) {
  const i = PROGRAMMES.findIndex(x => x.id === p.id);
  if (i >= 0) PROGRAMMES[i] = p;
  else PROGRAMMES.unshift(p);
}
