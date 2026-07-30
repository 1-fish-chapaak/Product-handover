// ─── Platform Memory Store — shared data layer ─────────────────────────────
//
// The "one store every surface reads and writes" from the Memory Management
// PRD (§4 Platform level). The PRD's principle is scope-follows-surface for
// GOVERNANCE — approvals live in My Queue, tenant guardrails in Admin, user
// forgets off the avatar menu. This module is the store those surfaces share,
// and Knowledge Hub → Smart Learn renders it as the browsable registry every
// provenance chip's "Manage this memory →" deep-links into.
//
// Scope model (PRD §4): personal (user) · team · engagement · tenant.
// Lifecycle: proposed (pending in My Queue) → approved/active → review-due →
// renewed or retired. Personal memories skip the gate — they are inferred,
// evidence-backed, and forgettable per-item.
//
// Determinism: this codebase avoids Date.now()/Math.random() in module and
// render paths. All ids, dates and counts are literals.

export type MemoryScope = 'personal' | 'team' | 'engagement' | 'tenant';

export type MemoryKind =
  | 'preference'   // how the user likes output shaped
  | 'vocabulary'   // what words mean here
  | 'convention'   // how the team agreed to work
  | 'fact'         // governed institutional fact (Enterprise Context)
  | 'correction'   // an explicit user correction IRA must not repeat
  | 'guardrail';   // tenant-wide compliance rule, admin-set

/** `pending` = a proposal or renewal waiting in My Queue. Everything else
 *  in the seed is live. Review-due is orthogonal (see `renewDue`). */
export type MemoryLifecycle = 'active' | 'pending';

export interface ScopeMeta {
  scope: MemoryScope;
  label: string;
  /** lucide-react icon name — the surface imports the matching icon. */
  icon: string;
  /** Short trailing note shown next to the section title. */
  note: string;
  /** Where governance actions for this scope live (PRD: scope follows surface). */
  managedIn: string;
}

// Ordered the way the registry renders: closest to the user first.
export const SCOPE_ORDER: MemoryScope[] = ['personal', 'team', 'engagement', 'tenant'];

export const SCOPE_META: Record<MemoryScope, ScopeMeta> = {
  personal: {
    scope: 'personal', label: 'Personal', icon: 'UserRound',
    note: 'What IRA knows about you — only you can see these.',
    managedIn: 'Right here — forget any item, or everything, any time.',
  },
  team: {
    scope: 'team', label: 'Team', icon: 'Users',
    note: 'Shared ways of working — changes go through My Queue approval.',
    managedIn: 'Approvals and renewals arrive in My Queue as badged work.',
  },
  engagement: {
    scope: 'engagement', label: 'Engagement', icon: 'Briefcase',
    note: 'Pharma Chargeback FY26 — applies inside this engagement only.',
    managedIn: 'Promoted and renewed from the engagement’s insight surfaces.',
  },
  tenant: {
    scope: 'tenant', label: 'Organization', icon: 'Building2',
    note: 'Compliance guardrails — set by admins, read-only here.',
    managedIn: 'Managed in Admin; every change lands in the audit log’s Memory category.',
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
  vocabulary: { kind: 'vocabulary', label: 'Vocabulary', icon: 'BookOpen' },
  convention: { kind: 'convention', label: 'Convention', icon: 'Users' },
  fact:       { kind: 'fact',       label: 'Fact',       icon: 'Landmark' },
  correction: { kind: 'correction', label: 'Correction', icon: 'PenLine' },
  guardrail:  { kind: 'guardrail',  label: 'Guardrail',  icon: 'ShieldCheck' },
};

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
  /** For pending items — what My Queue is being asked to decide. */
  pendingNote?: string;
  /** Platform readers that consume this memory (PRD: one store, many surfaces). */
  readBy: string[];
}

const READ_ALL = ['Chat answers', 'Workflow runs', 'Report drafts'];

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
    readBy: READ_ALL,
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
    readBy: ['Chat answers', 'Report drafts'],
  },
  {
    id: 'mem-usr-003', scope: 'personal', kind: 'correction', status: 'active',
    statement: 'The fiscal year starts 1 April — never assume a calendar-year reporting period.',
    source: 'Corrected in chat',
    evidence: [
      { label: 'Chat · corrected the FY assumption while drafting the Q1 memo', date: '12 Jun 2026' },
    ],
    learnedOn: '12 Jun 2026', confidence: 0.98,
    recallCount: 11, lastRecalled: '3 days ago',
    readBy: READ_ALL,
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
    readBy: ['Chat answers'],
  },
  {
    id: 'mem-usr-005', scope: 'personal', kind: 'preference', status: 'active',
    statement: 'Starts the week from the Monday chargeback digest — weekend run results should be queued by then.',
    source: 'Inferred from review activity',
    evidence: [
      { label: 'Activity · opened the digest first thing on 5 consecutive Mondays', date: '15 Jun 2026' },
    ],
    learnedOn: '15 Jun 2026', confidence: 0.74,
    recallCount: 5, lastRecalled: 'Mon, 13 Jul',
    readBy: ['Workflow runs'],
  },

  // ── Team — governed, promoted through the Human Approval Gate ───────────
  // The first three are the promoted Enterprise Context entries — same store,
  // rendered here as the owning rows (PRD: an approval in one place must
  // change what every other surface applies).
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
    readBy: READ_ALL,
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
    readBy: READ_ALL,
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
    readBy: ['Workflow runs', 'Report drafts'],
  },
  {
    id: 'mem-team-004', scope: 'team', kind: 'convention', status: 'pending',
    statement: 'Treat shipping costs as cost of goods sold, not operating expense.',
    source: 'Proposed by IRA from recurring analyst edits',
    pendingNote: '3 of 5 analysts already classify shipping in COGS — proposed as the team convention.',
    evidence: [
      { label: 'Edits · A. Shah reclassified shipping to COGS in 4 workpapers', date: '22 Jun 2026' },
      { label: 'Edits · two more analysts made the same reclassification', date: '30 Jun 2026' },
    ],
    learnedOn: '30 Jun 2026',
    recallCount: 0, lastRecalled: '—',
    readBy: READ_ALL,
  },
  {
    id: 'mem-team-005', scope: 'team', kind: 'vocabulary', status: 'pending',
    statement: 'Vendor names normalise to the contracting entity — “McKesson Corp.” and “McKesson Pharma” both mean MCKESSON CORPORATION.',
    source: 'Proposed from the entity resolver’s merge history',
    pendingNote: 'Waiting on team approval in My Queue.',
    evidence: [
      { label: 'Runs · entity resolver merged 3 vendor aliases across Jun–Jul runs', date: '07 Jul 2026' },
    ],
    learnedOn: '07 Jul 2026',
    recallCount: 0, lastRecalled: '—',
    readBy: ['Workflow runs', 'Chat answers'],
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
    readBy: ['Workflow runs', 'Report drafts'],
  },
  {
    id: 'mem-eng-002', scope: 'engagement', kind: 'convention', status: 'active',
    statement: 'Chargeback testing samples the full 70-row MCKESSON exception queue before any random selection.',
    source: 'Promoted from the MCKESSON concentration insight · Jul 2026 run',
    evidence: [
      { label: 'Insight · MCKESSON accounted for 70 of 90 pricing exceptions', date: '07 Jul 2026' },
    ],
    learnedOn: '08 Jul 2026', approvedBy: 'R. Mehta', approvedOn: '08 Jul 2026',
    recallCount: 3, lastRecalled: 'yesterday',
    readBy: ['Workflow runs'],
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
    readBy: ['Workflow runs'],
  },

  // ── Tenant — admin-set compliance guardrails, read-only here ─────────────
  {
    id: 'mem-org-001', scope: 'tenant', kind: 'guardrail', status: 'active',
    statement: 'Patient and prescriber PII never leaves the tenant — excluded from exports, reports and prompts.',
    source: 'Tenant guardrail · set by Admin',
    evidence: [
      { label: 'Admin · guardrail created under the data-handling policy', date: '01 Mar 2026' },
    ],
    learnedOn: '01 Mar 2026', approvedBy: 'N. Rao (Admin)', approvedOn: '01 Mar 2026',
    recallCount: 122, lastRecalled: '1 hour ago',
    readBy: READ_ALL,
  },
  {
    id: 'mem-org-002', scope: 'tenant', kind: 'guardrail', status: 'active',
    statement: 'AI-drafted conclusions on control sign-offs require a named human reviewer before distribution.',
    source: 'Tenant guardrail · set by Admin',
    evidence: [
      { label: 'Admin · guardrail created under the AI-use policy', date: '01 Mar 2026' },
    ],
    learnedOn: '01 Mar 2026', approvedBy: 'N. Rao (Admin)', approvedOn: '01 Mar 2026',
    recallCount: 37, lastRecalled: 'today',
    readBy: ['Report drafts', 'Workflow runs'],
  },
  {
    id: 'mem-org-003', scope: 'tenant', kind: 'guardrail', status: 'active',
    statement: 'Chargeback settlement workpapers are retained for 7 years under the records policy.',
    source: 'Tenant guardrail · set by Admin',
    evidence: [
      { label: 'Admin · retention rule imported from the records schedule', date: '01 Mar 2026' },
    ],
    learnedOn: '01 Mar 2026', approvedBy: 'N. Rao (Admin)', approvedOn: '01 Mar 2026',
    recallCount: 9, lastRecalled: '4 days ago',
    readBy: ['Report drafts'],
  },
];

/** Recalls across all memories in the trailing 7 days — literal, like every
 *  other figure in this store (see determinism note above). */
export const RECALLS_THIS_WEEK = 61;

/** Renewal target offered by the one-click "Renew" action (today + 90 days
 *  from the demo's fixed 16 Jul 2026 "now"). */
export const RENEWAL_TARGET = '14 Oct 2026';
