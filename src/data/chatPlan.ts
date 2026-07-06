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

/** CHAT_PLAN_STEPS with the user's severity rule woven into the "Prepare the
 *  results" step — so the plan itself records the threshold the findings were
 *  rated by, always visible (unlike the output node's collapsible Rate-by note,
 *  which only shows the rule in its Amount view). Falls back to the plain steps
 *  when no rule is in play. */
export function buildChatPlanSteps(threshold?: number): PlanCardStep[] {
  if (threshold == null) return CHAT_PLAN_STEPS;
  return CHAT_PLAN_STEPS.map((s) =>
    s.id === 'format'
      ? {
          ...s,
          description: 'Turned the 9 findings into a clear risk table — rated High or Medium by your rule, then tagged the control each one relates to.',
          operation: `Your rule: ${inrFull(threshold)} or more = High`,
        }
      : s,
  );
}

// ─── The 9 risky payments + the user's severity rule ──────────────────────
//
// Severity is user-defined: the mid-run clarification asks for a materiality
// amount ("findings of ₹X or more are High"). The output list rates each
// finding by THAT rule and nothing else — there is no "re-rate by another
// basis" switch, because the user has already answered which basis to use
// (user decision, 2026-07-06). Each risk carries its amount + control.

interface ChatPlanRiskFact {
  id: string;
  /** What broke, in plain words — includes the vendor and the amount. */
  title: string;
  /** Money involved, in INR — compared against the user's threshold. */
  amount: number;
  /** The control this finding relates to. */
  control: string;
}

const RISK_FACTS: ChatPlanRiskFact[] = [
  { id: 'r1', amount: 54_000,   control: 'Duplicate payment check',    title: 'Acme Corp billed the same amount twice, 3 days apart (₹54,000 each)' },
  { id: 'r2', amount: 145_000,  control: 'Approval rules check',       title: 'A ₹1,45,000 Acme Corp invoice was approved by the same person who raised it' },
  { id: 'r3', amount: 218_400,  control: 'Invoice-vs-PO match check',  title: 'Global Supplies was paid ₹2,18,400 with no matching purchase order' },
  { id: 'r4', amount: 84_000,   control: 'Duplicate payment check',    title: 'Bluepeak Logistics sent two month-end invoices for exactly ₹84,000 each' },
  { id: 'r5', amount: 360_000,  control: 'Vendor detail change check', title: 'TechParts Ltd changed its bank account 2 days before a ₹3,60,000 payment' },
  { id: 'r6', amount: 190_000,  control: 'Approval rules check',       title: 'A FastShip Logistics payment was split into two parts of ₹95,000, just under the approval limit' },
  { id: 'r7', amount: 12_600,   control: 'Invoice-vs-PO match check',  title: 'A Global Supplies invoice came in ₹12,600 higher than its purchase order' },
  { id: 'r8', amount: 49_800,   control: 'Duplicate payment check',    title: 'TechParts Ltd used near-identical invoice numbers twice in the same week (₹49,800)' },
  { id: 'r9', amount: 58_700,   control: 'Vendor detail change check', title: 'FastShip Logistics was paid ₹58,700 while marked inactive in the vendor list' },
];

// Indian number format: ₹1,00,000 (full) — for the rule note.
const inrFull = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** The user's materiality rule in one line — shared by the flow diagram's
 *  output note and the results-table caption so both state it identically. */
export const severityRuleNote = (threshold: number) =>
  `Your rule: ${inrFull(threshold)} or more = High, below that = Medium.`;

/** True when a finding's amount clears the user's High-risk threshold — rates
 *  each results-table row (and the plan output list) by the chosen rule. */
export const isHighByAmount = (amount: number, threshold: number) => amount >= threshold;

// ── The materiality threshold (mid-run severity question) ──

/** The severity choices — materiality amounts. */
export const SEVERITY_THRESHOLD_OPTIONS: { amount: number; option: string }[] =
  [50_000, 100_000, 200_000].map((amount) => ({ amount, option: `${inrFull(amount)} or more` }));

export const DEFAULT_SEVERITY_THRESHOLD = 100_000;

/** Map the answer to a rupee threshold: exact option match first, then any
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

/** The findings rated High/Medium by the user's amount rule, High first — the
 *  plan output list. One basis only (the user's answer); no re-rate switch. */
export function buildChatPlanRiskItems(threshold: number): PlanOutputItem[] {
  return RISK_FACTS
    .map((r): PlanOutputItem => ({
      id: r.id, title: r.title, control: r.control,
      level: isHighByAmount(r.amount, threshold) ? 'High' : 'Medium',
    }))
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'High' ? -1 : 1));
}
