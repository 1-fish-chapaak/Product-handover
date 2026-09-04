// ─── Platform Memory Store — shared data layer ─────────────────────────────
//
// The "one store every surface reads and writes" from the Memory PRDs. The
// governance principle is scope-follows-surface — approvals live in My Queue,
// org rules in Admin, personal forgets off the avatar menu, source memory on
// the data source itself — while Knowledge Hub → Smart Learn renders the ONE
// browsable registry every "Manage this memory →" deep-links into.
//
// Taxonomy ("Memory across platform" PRD, adopted 9 Aug 2026 — decision D1):
//   kinds  · preference | fact | correction | decision | routine | vocabulary | rule
//   scopes · personal | team | engagement | organization | source
// Lifecycle: proposed (waiting in My Queue) → active → retired | expired |
// superseded. Personal memories skip the gate — inferred, evidence-backed,
// forgettable per-item with undo.
//
// Session-level changes (approve, forget, renew, capture) layer over this seed
// via src/data/memorySession.ts so every surface reflects the same decisions.
//
// Determinism: this codebase avoids Date.now()/Math.random() in module and
// render paths. All ids, dates and counts are literals.

export type MemoryScope = 'personal' | 'team' | 'engagement' | 'organization' | 'source';

export type MemoryKind =
  | 'preference'   // how you like output shaped
  | 'fact'         // governed truth (materiality, calendars, definitions)
  | 'correction'   // a mistake IRA must not repeat
  | 'decision'     // a resolved question — mappings, joins, fixes, table picks
  | 'routine'      // a job that repeats on a rhythm
  | 'vocabulary'   // what words mean here
  | 'rule';        // enforced, no override — admin/source guardrails

/** `proposed` = waiting in My Queue. Retired/expired/superseded rows keep
 *  their audit trail and can re-surface — nothing is hard-deleted. */
export type MemoryLifecycle = 'proposed' | 'active' | 'retired' | 'expired' | 'superseded';

/** Where a memory fires — the `readBy` claim of v1, made real. Rendered as
 *  quiet mono chips on registry rows and filterable in the Filter menu. */
export type MemorySurface = 'chat' | 'runs' | 'engagements' | 'reports' | 'dashboards' | 'sources';

export const SURFACE_META: Record<MemorySurface, { label: string }> = {
  chat:        { label: 'Chat' },
  runs:        { label: 'Runs' },
  engagements: { label: 'Engagements' },
  reports:     { label: 'Reports' },
  dashboards:  { label: 'Dashboards' },
  sources:     { label: 'Sources' },
};

export const SURFACE_ORDER: MemorySurface[] = ['chat', 'runs', 'engagements', 'reports', 'dashboards', 'sources'];

export interface ScopeMeta {
  scope: MemoryScope;
  label: string;
  /** lucide-react icon name — the surface imports the matching icon. */
  icon: string;
  /** Short trailing note shown next to the section title. */
  note: string;
  /** Where governance actions for this scope live (scope follows surface). */
  managedIn: string;
}

// Ordered the way the registry renders: closest to the user first.
export const SCOPE_ORDER: MemoryScope[] = ['personal', 'team', 'engagement', 'organization', 'source'];

export const SCOPE_META: Record<MemoryScope, ScopeMeta> = {
  personal: {
    scope: 'personal', label: 'Personal', icon: 'UserRound',
    note: 'What IRA knows about you — only you can see these.',
    managedIn: 'Yours alone — forget any item here or from “What IRA knows about me” on your avatar menu.',
  },
  team: {
    scope: 'team', label: 'Team', icon: 'Users',
    note: 'Shared ways of working — changes go through My Queue approval.',
    managedIn: 'Approvals and renewals arrive in My Queue as badged work.',
  },
  engagement: {
    scope: 'engagement', label: 'Engagement', icon: 'Briefcase',
    note: 'Ground rules per engagement — sampling, files, carve-outs, vocabulary.',
    managedIn: 'Worked in the engagement’s Memory tab; approvals in My Queue.',
  },
  organization: {
    scope: 'organization', label: 'Organization', icon: 'Building2',
    note: 'Org-wide facts and enforced rules — set by admins.',
    managedIn: 'Managed in Admin; every change lands in the audit log’s Memory category.',
  },
  source: {
    scope: 'source', label: 'Source', icon: 'Database',
    note: 'What the data means — columns, joins, grain, filters, sensitivity.',
    managedIn: 'Worked on the source’s page in Knowledge Hub → Data Sources.',
  },
};

export interface KindMeta {
  kind: MemoryKind;
  label: string;
  /** lucide-react icon name. */
  icon: string;
}

export const KIND_META: Record<MemoryKind, KindMeta> = {
  preference: { kind: 'preference', label: 'Preference', icon: 'SlidersHorizontal' },
  fact:       { kind: 'fact',       label: 'Fact',       icon: 'Landmark' },
  correction: { kind: 'correction', label: 'Correction', icon: 'PenLine' },
  decision:   { kind: 'decision',   label: 'Decision',   icon: 'Route' },
  routine:    { kind: 'routine',    label: 'Routine',    icon: 'Repeat' },
  vocabulary: { kind: 'vocabulary', label: 'Vocabulary', icon: 'BookOpen' },
  rule:       { kind: 'rule',       label: 'Rule',       icon: 'ShieldCheck' },
};

export const KIND_ORDER: MemoryKind[] = ['preference', 'fact', 'correction', 'decision', 'routine', 'vocabulary', 'rule'];

export interface MemoryEvidence {
  /** e.g. "Chat · asked for the Jun summary 'as bullets, with cents'". */
  label: string;
  date: string;
}

export interface MemoryVersion {
  version: number;
  date: string;
  note: string;
}

export interface PlatformMemory {
  id: string;
  scope: MemoryScope;
  kind: MemoryKind;
  status: MemoryLifecycle;
  /** The memory itself — one governed sentence. */
  statement: string;
  /** One-line provenance for the row ("Inferred from 4 chat sessions"). */
  source: string;
  /** The receipts — every session/run/edit this was learned from. */
  evidence: MemoryEvidence[];
  learnedOn: string;
  approvedBy?: string;
  approvedOn?: string;
  /** 0–1 — present on inferred (personal) memories; explicit ones omit it. */
  confidence?: number;
  recallCount: number;
  lastRecalled: string;
  /** Analyst-set review/expiry date ("30 Sep 2026"). */
  reviewBy?: string;
  /** True when the review date is close enough to need a renewal decision. */
  renewDue?: boolean;
  versions?: MemoryVersion[];
  /** For proposed items — what My Queue is being asked to decide. */
  pendingNote?: string;
  /** Surfaces this memory fires on (rendered + filterable in the registry). */
  firesIn: MemorySurface[];
  /** Owning entity for engagement/source scopes — drives registry sub-groups
   *  ("Pharma Chargeback FY26 · 8", "vendor_master_v2 · 6"). */
  entity?: { id: string; label: string };
  /** Source rows: the schema fingerprint the memory was written against. */
  fingerprint?: string;
  /** Fingerprint no longer matches — surfaces in Drift review before a run
   *  gets hit by it. */
  drifted?: boolean;
}

export const MEMORY_STORE: PlatformMemory[] = [
  // ── Personal — inferred, evidence-backed, per-item forget ────────────────
  {
    id: 'mem-usr-001', scope: 'personal', kind: 'preference', status: 'active',
    statement: 'Prefers exception summaries as short bullet lists, with dollar amounts shown to two decimals.',
    source: 'Inferred from 4 chat sessions',
    evidence: [
      { label: 'Chat · asked for the run summary “as bullets, with cents”', date: '14 May 2026' },
      { label: 'Chat · reformatted the Jun run recap into bullets', date: '03 Jun 2026' },
      { label: 'Report review · trimmed the executive summary to bullets', date: '21 Jun 2026' },
      { label: 'Chat · re-confirmed the format for the Jul run', date: '08 Jul 2026' },
    ],
    learnedOn: '14 May 2026', confidence: 0.92,
    recallCount: 23, lastRecalled: '2 hours ago',
    firesIn: ['chat', 'reports'],
  },
  {
    id: 'mem-usr-002', scope: 'personal', kind: 'vocabulary', status: 'active',
    statement: '“CB variances” means pricing-variation exceptions in the chargeback workflows.',
    source: 'Inferred from 3 chat sessions',
    evidence: [
      { label: 'Chat · “show me this month’s CB variances”', date: '02 Jun 2026' },
      { label: 'Chat · “how many CB variances trace to MCKESSON?”', date: '07 Jul 2026' },
      { label: 'Chat · used interchangeably with “pricing exceptions”', date: '09 Jul 2026' },
    ],
    learnedOn: '02 Jun 2026', confidence: 0.88,
    recallCount: 17, lastRecalled: 'yesterday',
    firesIn: ['chat', 'reports'],
  },
  {
    id: 'mem-usr-004', scope: 'personal', kind: 'vocabulary', status: 'active',
    statement: '“The big three” refers to MCKESSON, Cardinal Health and AmerisourceBergen.',
    source: 'Inferred from 2 chat sessions',
    evidence: [
      { label: 'Chat · “concentration across the big three this quarter?”', date: '18 Jun 2026' },
      { label: 'Chat · “big three exposure vs everyone else”', date: '01 Jul 2026' },
    ],
    learnedOn: '18 Jun 2026', confidence: 0.81,
    recallCount: 6, lastRecalled: '5 days ago',
    firesIn: ['chat'],
  },
  {
    id: 'mem-usr-005', scope: 'personal', kind: 'routine', status: 'active',
    statement: 'Starts the week from the Monday chargeback digest — weekend run results should be queued by then.',
    source: 'Inferred from review activity',
    evidence: [
      { label: 'Activity · opened the digest first thing on 5 consecutive Mondays', date: '15 Jun 2026' },
    ],
    learnedOn: '15 Jun 2026', confidence: 0.74,
    recallCount: 5, lastRecalled: 'Mon, 13 Jul',
    firesIn: ['dashboards', 'runs'],
  },
  {
    id: 'mem-usr-006', scope: 'personal', kind: 'preference', status: 'active',
    statement: 'Exception trends render as bar charts, never pies — switched on 3 consecutive dashboard visits.',
    source: 'Learned from 3 consistent switches',
    evidence: [
      { label: 'Dashboard · switched Exceptions by Vendor pie → bar', date: '22 Jun 2026' },
      { label: 'Dashboard · switched the same chart again', date: '29 Jun 2026' },
      { label: 'Dashboard · third consecutive switch — default flipped', date: '06 Jul 2026' },
    ],
    learnedOn: '06 Jul 2026', confidence: 0.86,
    recallCount: 4, lastRecalled: 'Mon, 13 Jul',
    firesIn: ['dashboards'],
  },
  {
    id: 'mem-usr-007', scope: 'personal', kind: 'preference', status: 'active',
    statement: 'Dashboards open on the last 90 days with test entities and intercompany excluded.',
    source: 'Applied at the start of every visit since June',
    evidence: [
      { label: 'Dashboard · same filter set applied on 6 consecutive visits', date: '30 Jun 2026' },
    ],
    learnedOn: '30 Jun 2026', confidence: 0.83,
    recallCount: 9, lastRecalled: 'Mon, 13 Jul',
    firesIn: ['dashboards'],
  },
  {
    id: 'mem-usr-008', scope: 'personal', kind: 'preference', status: 'active',
    statement: 'Left off at 12 of 40 samples reviewed on P2P-07 — resume there on the next visit.',
    source: 'Saved position · Pharma Chargeback FY26',
    evidence: [
      { label: 'Engagement · sample review paused mid-control on Friday', date: '10 Jul 2026' },
    ],
    learnedOn: '10 Jul 2026', confidence: 0.97,
    recallCount: 1, lastRecalled: 'Fri, 10 Jul',
    firesIn: ['engagements'],
    entity: { id: 'eng-pharma-fy26', label: 'Pharma Chargeback FY26' },
  },

  // ── Team — governed, promoted through the Human Approval Gate ───────────
  // The first three are the promoted Enterprise Context entries — same store;
  // insightMemory.ts derives its ENTERPRISE_CONTEXT view from these rows, so
  // an approval in one place changes what every other surface applies.
  {
    id: 'mem-team-001', scope: 'team', kind: 'fact', status: 'active',
    statement: 'A chargeback equals (WAC − contract price) × units; never settle one on a null contract price.',
    source: 'Promoted from a Q1 chargeback reconciliation clarification',
    evidence: [
      { label: 'Chat · analyst clarified the settlement formula during Q1 recon', date: '30 Apr 2026' },
      { label: 'Run · null-price rows misplaced in the May validation run', date: '18 May 2026' },
    ],
    learnedOn: '30 Apr 2026', approvedBy: 'R. Mehta', approvedOn: '02 Jun 2026',
    recallCount: 41, lastRecalled: '2 hours ago',
    versions: [
      { version: 2, date: '02 Jun 2026', note: 'Added “never settle on a null contract price” after the May run surfaced 12 null-price settlements.' },
      { version: 1, date: '30 Apr 2026', note: 'Initial formula — (WAC − contract price) × units.' },
    ],
    firesIn: ['chat', 'runs', 'reports'],
  },
  {
    id: 'mem-team-002', scope: 'team', kind: 'fact', status: 'active',
    statement: 'MCKESSON CORPORATION is on a standing pricing-control watch pending master-data remediation.',
    source: 'Promoted from a prior vendor pricing review',
    evidence: [
      { label: 'Insight · MCKESSON drove 78% of Jul run pricing exceptions', date: '07 Jul 2026' },
      { label: 'Run · Vendor Master Audit flagged stale WAC ageing', date: '29 May 2026' },
    ],
    learnedOn: '28 Jun 2026', approvedBy: 'S. Iyer', approvedOn: '28 Jun 2026',
    recallCount: 28, lastRecalled: 'today',
    reviewBy: '30 Sep 2026',
    firesIn: ['chat', 'runs', 'reports'],
  },
  {
    id: 'mem-team-003', scope: 'team', kind: 'fact', status: 'active',
    statement: 'Contract HPG12 requires WAC re-validation against the current master before chargeback processing.',
    source: 'Promoted after repeated WAC-mismatch flags',
    evidence: [
      { label: 'Run · repeated “Due to WAC Mismatch” flags across vendors on HPG12', date: '02 Jun 2026' },
      { label: 'Insight · HPG12 price-file freshness lag confirmed in the Jul run', date: '07 Jul 2026' },
    ],
    learnedOn: '20 Jun 2026', approvedBy: 'R. Mehta', approvedOn: '20 Jun 2026',
    recallCount: 14, lastRecalled: 'yesterday',
    reviewBy: '01 Aug 2026', renewDue: true,
    firesIn: ['runs', 'reports'],
  },
  {
    id: 'mem-team-004', scope: 'team', kind: 'fact', status: 'proposed',
    statement: 'Treat shipping costs as cost of goods sold, not operating expense.',
    source: 'Proposed by IRA from recurring analyst edits',
    pendingNote: '3 of 5 analysts already classify shipping in COGS — proposed as the team standard.',
    evidence: [
      { label: 'Edits · A. Shah reclassified shipping to COGS in 4 workpapers', date: '22 Jun 2026' },
      { label: 'Edits · two more analysts made the same reclassification', date: '30 Jun 2026' },
    ],
    learnedOn: '30 Jun 2026',
    recallCount: 0, lastRecalled: '—',
    firesIn: ['chat', 'runs', 'reports'],
  },
  {
    id: 'mem-team-005', scope: 'team', kind: 'vocabulary', status: 'proposed',
    statement: 'Vendor names normalise to the contracting entity — “McKesson Corp.” and “McKesson Pharma” both mean MCKESSON CORPORATION.',
    source: 'Proposed from the entity resolver’s merge history',
    pendingNote: 'Waiting on team approval in My Queue.',
    evidence: [
      { label: 'Runs · entity resolver merged 3 vendor aliases across Jun–Jul runs', date: '07 Jul 2026' },
    ],
    learnedOn: '07 Jul 2026',
    recallCount: 0, lastRecalled: '—',
    firesIn: ['runs', 'chat'],
  },
  {
    id: 'mem-team-006', scope: 'team', kind: 'fact', status: 'active',
    statement: 'Before any workpaper submission: check duplicate invoice numbers, sample-size floor, and prior-period tie-out — R. Mehta asks every time.',
    source: 'Learned from repeated review comments',
    evidence: [
      { label: 'Review · duplicate-invoice check requested on 5 of last 6 submissions', date: '24 Jun 2026' },
      { label: 'Review · sample-size floor bounced two workpapers', date: '01 Jul 2026' },
    ],
    learnedOn: '01 Jul 2026', approvedBy: 'R. Mehta', approvedOn: '03 Jul 2026',
    recallCount: 7, lastRecalled: '3 days ago',
    firesIn: ['engagements'],
  },
  {
    id: 'mem-team-007', scope: 'team', kind: 'vocabulary', status: 'active',
    statement: 'Reports always say “net revenue”, never bare “revenue” — the reviewer corrects it every time.',
    source: 'Learned after the 3rd identical review edit',
    evidence: [
      { label: 'Report review · “revenue” → “net revenue” in the May memo', date: '28 May 2026' },
      { label: 'Report review · same correction in the Jun memo, twice', date: '25 Jun 2026' },
    ],
    learnedOn: '25 Jun 2026', approvedBy: 'S. Iyer', approvedOn: '26 Jun 2026',
    recallCount: 11, lastRecalled: 'yesterday',
    firesIn: ['reports'],
  },

  // ── Engagement — Pharma Chargeback FY26 ──────────────────────────────────
  {
    id: 'mem-eng-001', scope: 'engagement', kind: 'fact', status: 'active',
    statement: 'Engagement materiality is $250,000; individual exceptions below $500 aggregate into a single finding.',
    source: 'Set during engagement planning',
    evidence: [
      { label: 'Planning · materiality memo approved at kickoff', date: '10 Jun 2026' },
    ],
    learnedOn: '10 Jun 2026', approvedBy: 'S. Iyer', approvedOn: '10 Jun 2026',
    recallCount: 19, lastRecalled: 'today',
    firesIn: ['runs', 'reports', 'engagements'],
    entity: { id: 'eng-pharma-fy26', label: 'Pharma Chargeback FY26' },
  },
  {
    id: 'mem-eng-002', scope: 'engagement', kind: 'preference', status: 'active',
    statement: 'Chargeback testing samples the full 70-row MCKESSON exception queue before any random selection.',
    source: 'Promoted from the MCKESSON concentration insight · Jul 2026 run',
    evidence: [
      { label: 'Insight · MCKESSON accounted for 70 of 90 pricing exceptions', date: '07 Jul 2026' },
    ],
    learnedOn: '08 Jul 2026', approvedBy: 'R. Mehta', approvedOn: '08 Jul 2026',
    recallCount: 3, lastRecalled: 'yesterday',
    firesIn: ['runs', 'engagements'],
    entity: { id: 'eng-pharma-fy26', label: 'Pharma Chargeback FY26' },
  },
  {
    id: 'mem-eng-003', scope: 'engagement', kind: 'fact', status: 'active',
    statement: 'Interim evidence is accepted for price-master testing until the MCKESSON remediation completes.',
    source: 'Agreed with the engagement lead',
    evidence: [
      { label: 'Fieldwork note · interim evidence window agreed for remediation', date: '20 Jun 2026' },
    ],
    learnedOn: '20 Jun 2026', approvedBy: 'S. Iyer', approvedOn: '20 Jun 2026',
    recallCount: 8, lastRecalled: '2 days ago',
    reviewBy: '31 Jul 2026', renewDue: true,
    firesIn: ['runs', 'engagements'],
    entity: { id: 'eng-pharma-fy26', label: 'Pharma Chargeback FY26' },
  },
  {
    id: 'mem-eng-004', scope: 'engagement', kind: 'fact', status: 'active',
    statement: 'Samples never go below 25 items; anything above ₹5 lakh is tested in full, stratified below that.',
    source: 'Set by the engagement lead at kickoff',
    evidence: [
      { label: 'Planning · sampling standard recorded in the test strategy', date: '10 Jun 2026' },
      { label: 'Run · applied to the Jul chargeback sample draw', date: '07 Jul 2026' },
    ],
    learnedOn: '10 Jun 2026', approvedBy: 'S. Iyer', approvedOn: '10 Jun 2026',
    recallCount: 12, lastRecalled: 'today',
    firesIn: ['runs', 'engagements'],
    entity: { id: 'eng-pharma-fy26', label: 'Pharma Chargeback FY26' },
  },
  {
    id: 'mem-eng-005', scope: 'engagement', kind: 'fact', status: 'active',
    statement: 'The approved vendor master is vendor_master_v2 — two older copies in the same folder must not be used.',
    source: 'Approved at fieldwork start',
    evidence: [
      { label: 'Fieldwork · v2 confirmed as the remediated master', date: '18 Jun 2026' },
      { label: 'Run · a pick of vendor_master_OLD was flagged and corrected', date: '02 Jul 2026' },
    ],
    learnedOn: '18 Jun 2026', approvedBy: 'R. Mehta', approvedOn: '18 Jun 2026',
    recallCount: 9, lastRecalled: '2 days ago',
    firesIn: ['runs', 'engagements', 'sources'],
    entity: { id: 'eng-pharma-fy26', label: 'Pharma Chargeback FY26' },
  },
  {
    id: 'mem-eng-006', scope: 'engagement', kind: 'correction', status: 'active',
    statement: 'Vendor ABC’s date mismatches are a known false positive — a timezone bug in the client’s ERP, not an exception.',
    source: 'Cleared by the engagement lead after investigation',
    evidence: [
      { label: 'Run · same date mismatch on every run since May', date: '05 Jun 2026' },
      { label: 'Client IT · confirmed UTC offset bug in the ERP export', date: '12 Jun 2026' },
    ],
    learnedOn: '12 Jun 2026', approvedBy: 'S. Iyer', approvedOn: '12 Jun 2026',
    recallCount: 6, lastRecalled: 'yesterday',
    firesIn: ['runs', 'engagements'],
    entity: { id: 'eng-pharma-fy26', label: 'Pharma Chargeback FY26' },
  },
  {
    id: 'mem-eng-007', scope: 'engagement', kind: 'fact', status: 'active',
    statement: 'Subsidiary XYZ is out of scope for FY26 — excluded from every data pull, shown as a removable chip.',
    source: 'Scope carve-out from the engagement letter',
    evidence: [
      { label: 'Planning · FY26 scope excludes Subsidiary XYZ', date: '10 Jun 2026' },
    ],
    learnedOn: '10 Jun 2026', approvedBy: 'S. Iyer', approvedOn: '10 Jun 2026',
    recallCount: 15, lastRecalled: 'today',
    firesIn: ['runs', 'dashboards', 'reports'],
    entity: { id: 'eng-pharma-fy26', label: 'Pharma Chargeback FY26' },
  },
  {
    id: 'mem-eng-008', scope: 'engagement', kind: 'vocabulary', status: 'active',
    statement: 'This client says “requisition” for a purchase order — translate it silently in questions and answers.',
    source: 'Learned from client document language',
    evidence: [
      { label: 'Chat · “pull the open requisitions above 5 lakh” mapped to POs', date: '20 Jun 2026' },
    ],
    learnedOn: '20 Jun 2026', approvedBy: 'R. Mehta', approvedOn: '21 Jun 2026',
    recallCount: 8, lastRecalled: 'today',
    firesIn: ['chat', 'runs'],
    entity: { id: 'eng-pharma-fy26', label: 'Pharma Chargeback FY26' },
  },

  // ── Organization — org-wide facts and enforced rules ─────────────────────
  {
    id: 'mem-org-001', scope: 'organization', kind: 'rule', status: 'active',
    statement: 'Patient and prescriber PII never leaves the tenant — excluded from exports, reports and prompts.',
    source: 'Org rule · set by Admin',
    evidence: [
      { label: 'Admin · rule created under the data-handling policy', date: '01 Mar 2026' },
    ],
    learnedOn: '01 Mar 2026', approvedBy: 'N. Rao (Admin)', approvedOn: '01 Mar 2026',
    recallCount: 122, lastRecalled: '1 hour ago',
    firesIn: ['chat', 'runs', 'reports'],
  },
  {
    id: 'mem-org-002', scope: 'organization', kind: 'rule', status: 'active',
    statement: 'AI-drafted conclusions on control sign-offs require a named human reviewer before distribution.',
    source: 'Org rule · set by Admin',
    evidence: [
      { label: 'Admin · rule created under the AI-use policy', date: '01 Mar 2026' },
    ],
    learnedOn: '01 Mar 2026', approvedBy: 'N. Rao (Admin)', approvedOn: '01 Mar 2026',
    recallCount: 37, lastRecalled: 'today',
    firesIn: ['reports', 'runs'],
  },
  {
    id: 'mem-org-003', scope: 'organization', kind: 'rule', status: 'active',
    statement: 'Client-facing reports never name employees — employee IDs replace names before export or send.',
    source: 'Org rule · set by Admin',
    evidence: [
      { label: 'Admin · content rule added after the March distribution review', date: '02 Mar 2026' },
    ],
    learnedOn: '02 Mar 2026', approvedBy: 'N. Rao (Admin)', approvedOn: '02 Mar 2026',
    recallCount: 21, lastRecalled: 'yesterday',
    firesIn: ['reports'],
  },
  {
    id: 'mem-org-004', scope: 'organization', kind: 'fact', status: 'active',
    statement: 'The fiscal year starts 1 April — “Q3” means October to December on every surface.',
    source: 'Promoted from a chat correction, org-wide',
    evidence: [
      { label: 'Chat · corrected the FY assumption while drafting the Q1 memo', date: '12 Jun 2026' },
      { label: 'Approval · promoted to an org fact so every surface agrees', date: '15 Jun 2026' },
    ],
    learnedOn: '12 Jun 2026', approvedBy: 'N. Rao (Admin)', approvedOn: '15 Jun 2026',
    recallCount: 33, lastRecalled: 'today',
    firesIn: ['chat', 'runs', 'reports', 'dashboards'],
  },
  {
    id: 'mem-org-005', scope: 'organization', kind: 'fact', status: 'active',
    statement: '“On-time payment %” counts from invoice date, not PO date — one definition on every surface.',
    source: 'Definition agreed at the metrics review',
    evidence: [
      { label: 'Dashboard · two boards disagreed until the definition was fixed', date: '20 May 2026' },
    ],
    learnedOn: '20 May 2026', approvedBy: 'N. Rao (Admin)', approvedOn: '22 May 2026',
    recallCount: 26, lastRecalled: 'today',
    firesIn: ['dashboards', 'reports', 'chat'],
  },

  // ── Source — what the data means, learned from validated work ────────────
  {
    id: 'mem-src-001', scope: 'source', kind: 'vocabulary', status: 'active',
    statement: '‘amt_pd’ is the net amount paid, in INR, excluding tax.',
    source: 'Captured from a chat clarification',
    evidence: [
      { label: 'Chat · “which column is the payment amount?” answered once', date: '12 May 2026' },
    ],
    learnedOn: '12 May 2026', approvedBy: 'R. Mehta', approvedOn: '14 May 2026',
    recallCount: 9, lastRecalled: 'today',
    firesIn: ['runs', 'chat'],
    entity: { id: 'src-ap-open-items', label: 'fin.ap_open_items' },
    fingerprint: 'fp-ap-open-2026-05',
  },
  {
    id: 'mem-src-002', scope: 'source', kind: 'decision', status: 'active',
    statement: 'Ageing calculations use ‘invoice_date’ — not ‘posting_date’ or ‘due_date’.',
    source: 'Resolved in the first AP ageing run',
    evidence: [
      { label: 'Run · column-role clarification answered during the May run', date: '04 May 2026' },
      { label: 'Run · reused without asking in Jun and Jul', date: '04 Jul 2026' },
    ],
    learnedOn: '04 May 2026', approvedBy: 'R. Mehta', approvedOn: '05 May 2026',
    recallCount: 12, lastRecalled: '4 days ago',
    firesIn: ['runs'],
    entity: { id: 'src-ap-open-items', label: 'fin.ap_open_items' },
    fingerprint: 'fp-ap-open-2026-05',
  },
  {
    id: 'mem-src-003', scope: 'source', kind: 'fact', status: 'active',
    statement: 'One row means one invoice line, not one invoice — counts and sums must de-duplicate on invoice_no.',
    source: 'Grain confirmed against the ERP schema',
    evidence: [
      { label: 'Run · duplicate-looking totals traced to line-level grain', date: '06 May 2026' },
    ],
    learnedOn: '06 May 2026', approvedBy: 'R. Mehta', approvedOn: '06 May 2026',
    recallCount: 14, lastRecalled: 'yesterday',
    firesIn: ['runs', 'chat', 'dashboards'],
    entity: { id: 'src-ap-open-items', label: 'fin.ap_open_items' },
    fingerprint: 'fp-ap-open-2026-05',
  },
  {
    id: 'mem-src-004', scope: 'source', kind: 'rule', status: 'active',
    statement: 'Every query filters ‘is_deleted = 0’ and excludes test vendors — applied automatically and reported.',
    source: 'Always-filter set with the client’s data owner',
    evidence: [
      { label: 'Fieldwork · soft-deleted rows confirmed as out of population', date: '08 May 2026' },
    ],
    learnedOn: '08 May 2026', approvedBy: 'N. Rao (Admin)', approvedOn: '09 May 2026',
    recallCount: 31, lastRecalled: 'today',
    firesIn: ['runs', 'dashboards'],
    entity: { id: 'src-ap-open-items', label: 'fin.ap_open_items' },
    fingerprint: 'fp-ap-open-2026-05',
  },
  {
    id: 'mem-src-005', scope: 'source', kind: 'rule', status: 'active',
    statement: '‘pan_number’ is PII — masked to the last 4 digits, never exported. No override.',
    source: 'Sensitivity rule · set by Admin',
    evidence: [
      { label: 'Admin · column tagged under the data-handling policy', date: '10 May 2026' },
    ],
    learnedOn: '10 May 2026', approvedBy: 'N. Rao (Admin)', approvedOn: '10 May 2026',
    recallCount: 18, lastRecalled: 'today',
    firesIn: ['runs', 'reports', 'chat'],
    entity: { id: 'src-vendor-master', label: 'vendor_master_v2' },
    fingerprint: 'fp-vendor-master-v2',
  },
  {
    id: 'mem-src-006', scope: 'source', kind: 'decision', status: 'active',
    statement: 'The monthly AP ageing upload reads header on row 3, data from row 4, Sheet2 only, totals row ignored.',
    source: 'Learned from the first upload of this shape',
    evidence: [
      { label: 'Upload · shape resolved in the May upload wizard', date: '04 May 2026' },
      { label: 'Upload · Jun and Jul files read with zero questions', date: '04 Jul 2026' },
    ],
    learnedOn: '04 May 2026', approvedBy: 'R. Mehta', approvedOn: '04 May 2026',
    recallCount: 3, lastRecalled: 'Fri, 4 Jul',
    firesIn: ['sources', 'runs'],
    entity: { id: 'src-ap-ageing-upload', label: 'AP ageing monthly upload' },
    fingerprint: 'fp-ap-ageing-shape-v1',
  },
  {
    id: 'mem-src-007', scope: 'source', kind: 'decision', status: 'active',
    statement: 'The vendor master’s Amount column maps to column F — written against the pre-July layout.',
    source: 'Mapped in the first vendor-master run',
    evidence: [
      { label: 'Run · mapping resolved and confirmed in the May run', date: '20 May 2026' },
      { label: 'Drift · July file moved Amount to column H — fingerprint broke', date: '04 Jul 2026' },
    ],
    learnedOn: '20 May 2026', approvedBy: 'R. Mehta', approvedOn: '20 May 2026',
    recallCount: 7, lastRecalled: 'Fri, 4 Jul',
    firesIn: ['runs', 'sources'],
    entity: { id: 'src-vendor-master', label: 'vendor_master_v2' },
    fingerprint: 'fp-vendor-master-v1',
    drifted: true,
  },
  {
    id: 'mem-src-008', scope: 'source', kind: 'fact', status: 'active',
    statement: '‘vendor_address’ is ~30% empty — unusable for completeness testing; warn before any run that relies on it.',
    source: 'Data-quality profile from the May run',
    evidence: [
      { label: 'Run · completeness check aborted on empty address rows', date: '22 May 2026' },
    ],
    learnedOn: '22 May 2026', approvedBy: 'R. Mehta', approvedOn: '23 May 2026',
    recallCount: 4, lastRecalled: '6 days ago',
    firesIn: ['runs', 'chat'],
    entity: { id: 'src-vendor-master', label: 'vendor_master_v2' },
    fingerprint: 'fp-vendor-master-v2',
  },

  // ── Routines — recognized recurring jobs ─────────────────────────────────
  {
    id: 'mem-rtn-001', scope: 'team', kind: 'routine', status: 'active',
    statement: 'The monthly AP ageing pack — 3 files, 6 steps — runs on the 4th of each month; unchanged sources replay from memory.',
    source: 'Shape recognized on its 2nd run',
    evidence: [
      { label: 'Run · identical shape in May and Jun (sources fingerprint-matched)', date: '04 Jun 2026' },
      { label: 'Run · July replay served 80% of steps from the golden record', date: '04 Jul 2026' },
    ],
    learnedOn: '04 Jun 2026', approvedBy: 'R. Mehta', approvedOn: '05 Jun 2026',
    recallCount: 2, lastRecalled: 'Fri, 4 Jul',
    firesIn: ['runs'],
  },
  {
    id: 'mem-rtn-002', scope: 'personal', kind: 'routine', status: 'active',
    statement: 'The monthly chargeback memo repeats around the 10th — offer to run it with last month’s structure.',
    source: 'Recognized on the 3rd structural repeat',
    evidence: [
      { label: 'Reports · May, Jun and Jul memos shared one structure', date: '10 Jul 2026' },
    ],
    learnedOn: '10 Jul 2026', confidence: 0.85,
    recallCount: 1, lastRecalled: 'Thu, 10 Jul',
    firesIn: ['reports'],
  },
];

/** Recalls across all memories in the trailing 7 days — literal, like every
 *  other figure in this store (see determinism note above). */
export const RECALLS_THIS_WEEK = 61;

/** Clarifications memory answered before they were asked, trailing 30 days. */
export const QUESTIONS_SPARED = 19;

/** Renewal target offered by the one-click "Renew" action (today + 90 days
 *  from the demo's fixed "now"). */
export const RENEWAL_TARGET = '14 Oct 2026';

// ─── Pure selectors over the seed (session layering lives in memorySession) ─

export function memoriesForScope(scope: MemoryScope): PlatformMemory[] {
  return MEMORY_STORE.filter(m => m.scope === scope);
}

/** Entities that group rows inside a scope section (engagement, source). */
export function entitiesForScope(scope: MemoryScope, rows: PlatformMemory[]): { id: string; label: string }[] {
  const seen = new Map<string, string>();
  rows.forEach(m => {
    if (m.scope === scope && m.entity && !seen.has(m.entity.id)) seen.set(m.entity.id, m.entity.label);
  });
  return [...seen.entries()].map(([id, label]) => ({ id, label }));
}
