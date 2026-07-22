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
}

export type MaterialityBasis = 'pbt' | 'revenue' | 'expenses' | 'custom';

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
  totalCaptions: number;
  quantCount: number;
  qualCount: number;
  racms: DerivedRacm[];
  beyondTb: string[];
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
  // Live testing numbers for the completed example — totals match the classic
  // eng-1 workspace this programme opens into (100 controls, 75% effective).
  const CONTROLS: Record<string, [number, number]> = {
    'Order to Cash': [20, 16],
    'Procure to Pay': [26, 20],
    Treasury: [16, 13],
    'Payroll (Hire to Retire)': [10, 8],
    Inventory: [12, 8],
    'Fixed Assets': [9, 6],
    Tax: [7, 4],
  };
  for (const r of racms) {
    const [c, e] = CONTROLS[r.process] ?? [6, 5];
    r.controls = c;
    r.effective = e;
  }
  return {
    id: 'sox-prog-fy26',
    // Identity mirrors the classic eng-1 engagement — clicking this card opens
    // that workspace, so the two must read as one thing.
    name: 'FY26 ICFR — Airline P2P & O2C',
    code: 'ENG-001',
    owner: 'A. Mehta',
    engagementId: 'eng-1',
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

export function registerProgramme(p: SoxProgramme) {
  const i = PROGRAMMES.findIndex(x => x.id === p.id);
  if (i >= 0) PROGRAMMES[i] = p;
  else PROGRAMMES.unshift(p);
}
