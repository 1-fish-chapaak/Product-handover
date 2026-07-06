// Chat/QnA query-execution plan — shared mock steps.
//
// Consumed by BOTH the inline PlanFlowDiagram in the chat thread (ChatView) and
// the text Query Execution Plan in the right-workspace Plan tab (ArtifactPanel),
// so the flow diagram and the step list describe the same run. Data only — no
// JSX.
//
// Copy is written for a NON-TECHNICAL audit/finance reader: plain English, no
// SQL, no "tables/columns/joins" jargon. `description` is the plain narrative,
// `operation` a short concrete specific, `output` a DESCRIPTIVE plain-English
// summary of what this step hands to the next (drawn as a hand-off box on the
// flow's connector — so it's written as a full phrase, not a terse tag), and
// `sources` the real datasets it read.

import type { PlanCardStep, PlanCardSource } from '../components/shared/PlanCards';
import type { PlanOutputItem } from '../components/shared/PlanFlowDiagram';

export const SRC_SAP_AP: PlanCardSource = {
  id: 'sap-ap', name: 'SAP ERP AP Module', type: 'sql',
  columns: ['Vendor', 'Invoice No', 'Amount', 'PO Ref', 'GL Account', 'Posting Date', 'Currency'],
};
export const SRC_VENDOR_MASTER: PlanCardSource = {
  id: 'vendor-master', name: 'Vendor Master Data', type: 'sql',
  columns: ['Vendor ID', 'Vendor', 'Bank Account', 'Status', 'Risk Flag'],
};

export const CHAT_PLAN_STEPS: PlanCardStep[] = [
  {
    id: 'parse', name: 'Understand your question', type: 'extract',
    description: 'Read your question and worked out exactly what you are asking for.',
    operation: 'Goal: find risky payments in Purchase-to-Pay',
    output: 'A clear goal to work toward — find the risky payments across the Purchase-to-Pay process.',
  },
  {
    id: 'sources', name: 'Find the right data', type: 'extract',
    description: 'Picked the datasets that hold the answer and opened their fields.',
    sources: [SRC_SAP_AP, SRC_VENDOR_MASTER],
    operation: 'Opened 12 data fields',
    output: 'The payment records and vendor details, opened up and ready to be checked.',
  },
  {
    id: 'plan', name: 'Plan the checks', type: 'analyze',
    description: 'Worked out how to combine the two datasets and which payments to focus on.',
    sources: [SRC_SAP_AP, SRC_VENDOR_MASTER],
    operation: 'Match each invoice to its vendor, focus on medium-or-higher risk',
    output: 'A step-by-step plan — match each payment to its vendor, then focus on the medium-or-higher risk ones.',
  },
  {
    id: 'execute', name: 'Run the checks', type: 'validate',
    description: 'Went through every payment and kept only the ones that broke a control.',
    sources: [SRC_SAP_AP, SRC_VENDOR_MASTER],
    operation: 'Checked against 4 controls',
    rowsIn: 1_200_000,
    rowsOut: 9,
    output: 'The 9 payments that broke a control, filtered down from 1.2 million checked.',
  },
  {
    id: 'format', name: 'Prepare the results', type: 'summarize',
    description: 'Turned the 9 findings into a clear table you can act on.',
    operation: 'Added a risk level and the control each one relates to',
    output: 'A clear, ready-to-use risk table you can review and act on.',
  },
];

// ─── The 9 risky payments + user-defined severity ─────────────────────────
//
// Severity is NOT hardcoded, and it is defined in two logically distinct
// moments (user decision, 2026-07-06):
//   BEFORE the run (clarification Q5) the user can only state a POLICY that
//   needs no knowledge of the results — a materiality amount ("findings of
//   ₹X or more are High"). Categorical rules (confirmed-vs-suspected, which
//   control) would be circular before anything is found.
//   AFTER the run, with the findings visible, the output list offers a
//   "Rate by" switch (amount / certainty / control) to re-slice severity —
//   those categories now exist in front of the user.
// Each risk carries the underlying facts (amount, confirmed?, control) so
// every basis can rate it.

/** A way of rating the findings High/Medium — the post-run "Rate by" bases. */
export type SeverityBasisId = 'amount' | 'certainty' | 'control';

interface ChatPlanRiskFact {
  id: string;
  /** What broke, in plain words — includes the vendor and the amount. */
  title: string;
  /** Money involved, in INR. */
  amount: number;
  /** true = the control break is confirmed; false = suspicious pattern only. */
  confirmed: boolean;
  /** The control this finding relates to. */
  control: string;
}

const RISK_FACTS: ChatPlanRiskFact[] = [
  { id: 'r1', amount: 54_000,   confirmed: true,  control: 'Duplicate payment check',    title: 'Acme Corp billed the same amount twice, 3 days apart (₹54,000 each)' },
  { id: 'r2', amount: 145_000,  confirmed: true,  control: 'Approval rules check',       title: 'A ₹1,45,000 Acme Corp invoice was approved by the same person who raised it' },
  { id: 'r3', amount: 218_400,  confirmed: true,  control: 'Invoice-vs-PO match check',  title: 'Global Supplies was paid ₹2,18,400 with no matching purchase order' },
  { id: 'r4', amount: 84_000,   confirmed: true,  control: 'Duplicate payment check',    title: 'Bluepeak Logistics sent two month-end invoices for exactly ₹84,000 each' },
  { id: 'r5', amount: 360_000,  confirmed: false, control: 'Vendor detail change check', title: 'TechParts Ltd changed its bank account 2 days before a ₹3,60,000 payment' },
  { id: 'r6', amount: 190_000,  confirmed: false, control: 'Approval rules check',       title: 'A FastShip Logistics payment was split into two parts of ₹95,000, just under the approval limit' },
  { id: 'r7', amount: 12_600,   confirmed: false, control: 'Invoice-vs-PO match check',  title: 'A Global Supplies invoice came in ₹12,600 higher than its purchase order' },
  { id: 'r8', amount: 49_800,   confirmed: false, control: 'Duplicate payment check',    title: 'TechParts Ltd used near-identical invoice numbers twice in the same week (₹49,800)' },
  { id: 'r9', amount: 58_700,   confirmed: false, control: 'Vendor detail change check', title: 'FastShip Logistics was paid ₹58,700 while marked inactive in the vendor list' },
];

const HIGH_CONTROLS = ['Duplicate payment check', 'Invoice-vs-PO match check'];

// Indian-format helpers: ₹1,00,000 (full, for notes) and ₹1L / ₹50k (short,
// for the compact "Rate by" chip label).
const inrFull = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const inrShort = (n: number) =>
  n >= 100_000 ? `₹${(n / 100_000).toLocaleString('en-US')}L` : `₹${Math.round(n / 1_000)}k`;

/** The user's materiality rule in one line — shared by the flow diagram's
 *  amount view and the results-table caption so both state it identically. */
export const severityRuleNote = (threshold: number) =>
  `Your rule: ${inrFull(threshold)} or more = High, below that = Medium.`;

/** True when a finding's amount clears the user's High-risk threshold — used to
 *  rate each results-table row so the table updates with the chosen rule. */
export const isHighByAmount = (amount: number, threshold: number) => amount >= threshold;

// ── Pre-run: the materiality threshold (clarification Q5) ──

/** The Q5 choices — pure policy amounts, no result knowledge needed. */
export const SEVERITY_THRESHOLD_OPTIONS: { amount: number; option: string }[] =
  [50_000, 100_000, 200_000].map((amount) => ({ amount, option: `${inrFull(amount)} or more` }));

export const DEFAULT_SEVERITY_THRESHOLD = 100_000;

/** Map the Q5 answer to a rupee threshold: exact option match first, then any
 *  number typed free-form ("2 lakh", "₹75,000", "150000"); else the default. */
export function severityThresholdFromAnswer(answer: string): number {
  const exact = SEVERITY_THRESHOLD_OPTIONS.find(o => answer.includes(o.option));
  if (exact) return exact.amount;
  const lakh = answer.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/i);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100_000);
  const digits = answer.replace(/[^\d]/g, '');
  if (digits.length >= 4) return parseInt(digits, 10);
  return DEFAULT_SEVERITY_THRESHOLD;
}

// ── Post-run: rate / re-rate the findings ──

function rateRisks(basis: SeverityBasisId, threshold: number): PlanOutputItem[] {
  const isHigh = (r: ChatPlanRiskFact): boolean =>
    basis === 'amount'  ? r.amount >= threshold :
    basis === 'control' ? HIGH_CONTROLS.includes(r.control) :
    r.confirmed;
  return RISK_FACTS
    .map((r): PlanOutputItem => ({ id: r.id, title: r.title, control: r.control, level: isHigh(r) ? 'High' : 'Medium' }))
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'High' ? -1 : 1));
}

/** The three "Rate by" views for the output list. Amount comes first and uses
 *  the user's own pre-run threshold (its chip carries that number); certainty
 *  and control are the post-run lenses — offered only once the findings are
 *  visible. Shape matches PlanFlowDiagram's `outputRatings` prop. */
export function buildChatPlanRatings(threshold: number) {
  return [
    {
      id: 'amount',
      label: `Amount (${inrShort(threshold)}+)`,
      note: severityRuleNote(threshold),
      items: rateRisks('amount', threshold),
    },
    {
      id: 'certainty',
      label: 'How certain',
      note: 'Re-rated by certainty: confirmed control breaks = High, suspicious patterns = Medium.',
      items: rateRisks('certainty', threshold),
    },
    {
      id: 'control',
      label: 'Which control',
      note: 'Re-rated by control: duplicate & missing-PO payments = High, other checks = Medium.',
      items: rateRisks('control', threshold),
    },
  ];
}
