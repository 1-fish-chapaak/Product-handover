import { registerEngagement } from '../../../../data/engagements';
import {
  BEYOND_TB, deriveRacms,
  type GroupEntity, type QualPick, type SoxProgramme, type TbCaption,
} from '../soxTestingData';

/**
 * SOX Testing · V2 — parity baseline.
 *
 * The V2 tab is now an exact copy of the Programmes experience (same wizard,
 * same summary modal, same card→workspace behaviour) running on its OWN store,
 * so call-aligned features can be added here one decision at a time without
 * touching the classic flow. The earlier V2 surfaces (derived entity scope,
 * coverage, people, chasing, test bench…) are parked in this folder, unwired.
 *
 * Seed = the Altura infra group expressed in classic terms: flat list of
 * entities, captions flagged at OVERALL materiality, processes derived the
 * classic way.
 */

export const V2C_GROUP = 'Altura Infra Holdings Ltd (Listed)';

/**
 * The group, with the chain that actually holds it together — three levels, not
 * a flat list of eight. Ordered as the chart reads (parent, then what it holds)
 * because the entity table and the audit Scope step indent rather than sort.
 *
 * `ownership` is the DIRECT holding of the company above it, which is not always
 * what reaches the top: Smart Metering is wholly owned by Transmission, and
 * Transmission is 74% owned, so 74% of Metering is the group's. That chain is
 * the reason the scope step shows effective ownership at all — it is the one
 * number a flat list cannot give you.
 */
const ENTITIES: GroupEntity[] = [
  { id: 'a-hold', name: 'Altura Infra Holdings Ltd', type: 'Holding', ownership: 100 },
  // Renewables — wind generation is held through the solar platform.
  { id: 'a-solar', name: 'Altura Solar Pvt Ltd', type: 'Subsidiary', ownership: 100, parentId: 'a-hold' },
  { id: 'a-wind', name: 'Altura Wind Pvt Ltd', type: 'Subsidiary', ownership: 100, parentId: 'a-solar' },
  // Roads — the logistics parks sit on the road corridors.
  { id: 'a-road', name: 'Altura Roadways Pvt Ltd', type: 'Subsidiary', ownership: 100, parentId: 'a-hold' },
  { id: 'a-park', name: 'Altura Logistics Parks Pvt Ltd', type: 'Subsidiary', ownership: 100, parentId: 'a-road' },
  // Grid — 26% of Transmission sits outside the group, and metering rides on it,
  // so only 74% of the metering business reaches Altura.
  { id: 'a-tran', name: 'Altura Transmission Pvt Ltd', type: 'Subsidiary', ownership: 74, parentId: 'a-hold' },
  { id: 'a-meter', name: 'Altura Smart Metering Pvt Ltd', type: 'Subsidiary', ownership: 100, parentId: 'a-tran' },
  // Last in the list is the company whose trial balance is late — see
  // entitiesInFiles in auditScope.ts, which drops the final row on purpose.
  { id: 'a-water', name: 'Altura Water Utilities Pvt Ltd', type: 'Subsidiary', ownership: 100, parentId: 'a-hold' },
];

const TB_FILES: Record<string, { file: string; lines: number }> = {
  'a-hold': { file: 'altura-holdings-tb.xlsx', lines: 186 },
  'a-solar': { file: 'altura-solar-tb.xlsx', lines: 94 },
  'a-wind': { file: 'altura-wind-tb.xlsx', lines: 88 },
  'a-road': { file: 'altura-roadways-tb.xlsx', lines: 82 },
  'a-tran': { file: 'altura-transmission-tb.xlsx', lines: 76 },
  'a-water': { file: 'altura-water-tb.xlsx', lines: 71 },
  'a-park': { file: 'altura-logistics-parks-tb.xlsx', lines: 64 },
  'a-meter': { file: 'altura-smart-metering-tb.xlsx', lines: 58 },
};

/** Exported so the New audit wizard's scope step can total a company's
 *  trial-balance lines and weigh them against materiality — the derivation is
 *  per entity, and this is the only place the group's balances live. */
export const CAPTIONS: TbCaption[] = [
  { id: 'v-h-01', entityId: 'a-hold', caption: 'Investments in SPVs', balance: 412, process: 'Treasury' },
  { id: 'v-h-02', entityId: 'a-hold', caption: 'Borrowings — group facilities', balance: 186, process: 'Treasury' },
  { id: 'v-h-03', entityId: 'a-hold', caption: 'EPC contractor payables', balance: 24, process: 'Procure to Pay' },
  { id: 'v-h-04', entityId: 'a-hold', caption: 'Management fee income', balance: 12.4, process: 'Order to Cash' },
  { id: 'v-h-05', entityId: 'a-hold', caption: 'Consultancy & advisory spend', balance: 6.8, process: 'Procure to Pay' },
  { id: 'v-h-06', entityId: 'a-hold', caption: 'Corporate payroll', balance: 5.2, process: 'Payroll (Hire to Retire)' },
  { id: 'v-h-07', entityId: 'a-hold', caption: 'Interest-rate swaps (MTM)', balance: 2.1, process: 'Treasury' },
  { id: 'v-s-01', entityId: 'a-solar', caption: 'Project assets — solar plant', balance: 46, process: 'Fixed Assets' },
  { id: 'v-s-02', entityId: 'a-solar', caption: 'Project debt', balance: 28, process: 'Treasury' },
  { id: 'v-s-03', entityId: 'a-solar', caption: 'EPC retention payable', balance: 11, process: 'Procure to Pay' },
  { id: 'v-s-04', entityId: 'a-solar', caption: 'Energy sale receivables', balance: 8.4, process: 'Order to Cash' },
  { id: 'v-s-05', entityId: 'a-solar', caption: 'O&M costs', balance: 3.9, process: 'Procure to Pay' },
  { id: 'v-w-01', entityId: 'a-wind', caption: 'Project assets — wind farm', balance: 31, process: 'Fixed Assets' },
  { id: 'v-w-02', entityId: 'a-wind', caption: 'Project debt', balance: 19, process: 'Treasury' },
  { id: 'v-w-03', entityId: 'a-wind', caption: 'Energy sale receivables', balance: 6.1, process: 'Order to Cash' },
  { id: 'v-w-04', entityId: 'a-wind', caption: 'O&M costs', balance: 3.2, process: 'Procure to Pay' },
  { id: 'v-r-01', entityId: 'a-road', caption: 'Concession asset — toll road', balance: 8.8, process: 'Fixed Assets' },
  { id: 'v-r-02', entityId: 'a-road', caption: 'Toll receivables', balance: 4.6, process: 'Order to Cash' },
  { id: 'v-r-03', entityId: 'a-road', caption: 'O&M costs', balance: 2.8, process: 'Procure to Pay' },
  { id: 'v-t-01', entityId: 'a-tran', caption: 'Transmission assets', balance: 7.9, process: 'Fixed Assets' },
  { id: 'v-t-02', entityId: 'a-tran', caption: 'Wheeling receivables', balance: 3.4, process: 'Order to Cash' },
  { id: 'v-u-01', entityId: 'a-water', caption: 'Treatment plant assets', balance: 6.6, process: 'Fixed Assets' },
  { id: 'v-u-02', entityId: 'a-water', caption: 'User charge receivables', balance: 2.9, process: 'Order to Cash' },
  { id: 'v-p-01', entityId: 'a-park', caption: 'Warehouse assets', balance: 5.8, process: 'Fixed Assets' },
  { id: 'v-p-02', entityId: 'a-park', caption: 'Lease receivables', balance: 2.2, process: 'Order to Cash' },
  { id: 'v-m-01', entityId: 'a-meter', caption: 'Metering assets', balance: 4.9, process: 'Fixed Assets' },
  { id: 'v-m-02', entityId: 'a-meter', caption: 'Cash collections in transit', balance: 1.4, process: 'Treasury' },
];

const QUAL_PICKS: QualPick[] = [
  {
    captionId: 'v-m-02',
    reason: 'High transaction velocity',
    note: 'Balance is ₹ 1.4 Cr, but ~₹ 130 Cr of daily consumer cash collections flow through the year.',
  },
  {
    captionId: 'v-h-07',
    reason: 'Complex accounting',
    note: 'Small MTM balance — swap/hedge accounting complexity warrants scoping in.',
  },
];

/**
 * Scoped without a trial-balance caption, so no derivation can produce them —
 * they are declared. BEYOND_TB already says ITGC is in scope for this
 * programme; this is what turns that declaration into a RACM with controls in
 * it, and it is what an ICFR audit actually looks like: every automated control
 * in the four financial processes leans on access, change and operations, and
 * SOX has no way to rely on one instance of an automated control without having
 * tested the systems underneath it.
 *
 * ITGC is tested ONCE at group level, not per company — a process with no entry
 * in `racms` gets a single row at the group name (see withEntityInstances), and
 * that is the right shape here rather than eight copies of the same access
 * review.
 *
 * Anything added to this list must survive a Configuration re-derive — see
 * ConfigurationView, which keeps these names when it rebuilds the scope from
 * the trial balances.
 */
export const GROUP_WORKSTREAMS = ['IT General Controls'] as const;

function buildParitySeed(): SoxProgramme {
  const overall = 12; // ₹ Cr — 5% of ₹ 240 Cr PBT
  const pm = 9; // 75% of overall — decision #2: scoping flags at PM, not overall
  const qualIds = new Set(QUAL_PICKS.map(q => q.captionId));
  const inScope = CAPTIONS.filter(c => c.balance >= pm || qualIds.has(c.id));
  const racms = deriveRacms(inScope, qualIds, ENTITIES);
  const CONTROLS: Record<string, [number, number]> = {
    Treasury: [5, 4],
    'Fixed Assets': [5, 4],
    'Procure to Pay': [5, 4],
    'Order to Cash': [5, 4],
  };
  for (const r of racms) {
    const [c, e] = CONTROLS[r.process] ?? [5, 4];
    r.controls = c;
    r.effective = e;
  }
  registerEngagement({
    id: 'sox-v2-fy26',
    code: 'SOX-104',
    name: 'FY26 ICFR — Altura Infra Group',
    description: 'SOX 404 / ICFR programme — FY26 cycle scoped from 8 trial balances; 4 in-scope processes plus the ITGC workstream, one RACM each.',
    type: 'SOX / ICFR',
    soxConfig: {
      overallMateriality: 120_000_000,
      performanceMateriality: 90_000_000,
      clearlyTrivial: 6_000_000,
      sdBandPct: 20,
      aggregate: true,
      keyOnly: true,
    },
    soxProcesses: [...racms.map(r => r.process), ...GROUP_WORKSTREAMS],
    soxSeedMode: 'live',
    process: 'P2P',
    framework: 'COSO 2013 / SOX 404',
    owner: 'A. Mehta',
    status: 'Active',
    periodStart: 'Jan 2026',
    periodEnd: 'Dec 2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    entity: V2C_GROUP,
    // 5 RACMs × 5 controls (racmTemplate takes the first five of a spread).
    // Before entity replication — the register splits the four financial
    // processes across the companies they were scoped at; ITGC is tested once
    // for the group.
    controls: 25,
    health: 78,
    openIssues: 0,
    lastActivity: '1d ago',
    nextScheduled: 'Year-end testing — as of 31 Dec 2026',
  });
  return {
    id: 'sox-v2-fy26',
    name: 'FY26 ICFR — Altura Infra Group',
    code: 'SOX-104',
    owner: 'A. Mehta',
    engagementId: 'sox-v2-fy26',
    fy: 'FY26',
    asOf: '31 Dec 2026',
    phase: 'Interim testing',
    groupName: V2C_GROUP,
    entities: ENTITIES.map(e => ({ ...e, ...TB_FILES[e.id] })),
    materiality: {
      basis: 'pbt',
      benchmarkLabel: 'Profit before tax (consolidated)',
      benchmark: 240,
      pct: 5,
      overall,
      pmPct: 75,
      cttPct: 5,
    },
    totalCaptions: CAPTIONS.length,
    quantCount: inScope.length - qualIds.size,
    qualCount: qualIds.size,
    racms,
    beyondTb: BEYOND_TB.map(b => b.id),
  };
}

/** The Altura seed, exported for the V2 wizard fork — its default group is
 *  this one (not the classic Airline trio) so the entity-scope derivation
 *  (#4/#5/#6) actually has entities that land out. */
export {
  ENTITIES as V2C_ENTITIES,
  CAPTIONS as V2C_CAPTIONS,
  QUAL_PICKS as V2C_QUAL_PICKS,
  TB_FILES as V2C_TB_FILES,
};

/** Share of the consolidated group per entity — what the coverage rule (#5)
 *  sums. Tuned so the default walk-through shows all three pull mechanisms:
 *  quant (55%) + the Metering qual pull (59%) still miss the 60% target, so
 *  Roadways — the largest remaining share — gets pulled for coverage (71%). */
export const V2C_GROUP_SHARE: Record<string, number> = {
  'a-hold': 29,
  'a-solar': 15,
  'a-wind': 11,
  'a-road': 12,
  'a-tran': 10,
  'a-water': 10,
  'a-park': 9,
  'a-meter': 4,
};

/** #7 — ITGC is scoped per system; each picked system becomes its own RACM. */
export const V2C_ITGC_SYSTEMS = [
  { id: 'erp', name: 'SAP S/4HANA', role: 'ERP — the general ledger' },
  { id: 'epm', name: 'Oracle EPM', role: 'Consolidation & close' },
  { id: 'pay', name: 'Darwinbox', role: 'Payroll' },
  { id: 'trs', name: 'Kyriba', role: 'Treasury management' },
  { id: 'prc', name: 'SAP Ariba', role: 'Procurement' },
] as const;

export interface V2cPerson {
  processOwner: string;
  poEmail: string;
  controlOwner: string;
  coEmail: string;
}

/** #8 — suggested owners per process / workstream. Process owner runs the
 *  area and gets chased for evidence; control owner is accountable that the
 *  controls operate. Evidence chasing (#16, later) runs on these names. */
export const V2C_PEOPLE: Record<string, V2cPerson> = {
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

/** V2's own store — same shape and behaviour as the classic PROGRAMMES. */
export const V2C_PROGRAMMES: SoxProgramme[] = [buildParitySeed()];

export function registerV2CProgramme(p: SoxProgramme) {
  const i = V2C_PROGRAMMES.findIndex(x => x.id === p.id);
  if (i >= 0) V2C_PROGRAMMES[i] = p;
  else V2C_PROGRAMMES.unshift(p);
}
