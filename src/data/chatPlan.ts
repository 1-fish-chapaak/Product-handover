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
import type { LayeredInsight } from './layeredInsights';

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
  /** The vendor the finding is against. */
  vendor: string;
  /** Money involved, in INR — compared against the user's threshold. */
  amount: number;
  /** The control this finding relates to. */
  control: string;
  /** Full plain-English finding — the DAG output list line. */
  title: string;
  /** Short issue label — the results-table row (what broke, in ~4 words). */
  issue: string;
  /** Where the finding sits in the review workflow — the table Status cell. */
  status: 'Open' | 'In review' | 'Resolved';
}

// Single source of truth for BOTH the DAG output list and the results table, so
// the two can never disagree (count, amounts, vendors, levels all match).
const RISK_FACTS: ChatPlanRiskFact[] = [
  { id: 'r1', vendor: 'Acme Corp',          amount: 54_000,  control: 'Duplicate payment check',    status: 'Open',      issue: 'Billed twice, 3 days apart',       title: 'Acme Corp billed the same amount twice, 3 days apart (₹54,000 each)' },
  { id: 'r2', vendor: 'Acme Corp',          amount: 145_000, control: 'Approval rules check',       status: 'In review', issue: 'Approved by the raiser',           title: 'A ₹1,45,000 Acme Corp invoice was approved by the same person who raised it' },
  { id: 'r3', vendor: 'Global Supplies',    amount: 218_400, control: 'Invoice-vs-PO match check',  status: 'Open',      issue: 'No matching purchase order',       title: 'Global Supplies was paid ₹2,18,400 with no matching purchase order' },
  { id: 'r4', vendor: 'Bluepeak Logistics', amount: 84_000,  control: 'Duplicate payment check',    status: 'Open',      issue: 'Two identical month-end invoices', title: 'Bluepeak Logistics sent two month-end invoices for exactly ₹84,000 each' },
  { id: 'r5', vendor: 'TechParts Ltd',      amount: 360_000, control: 'Vendor detail change check', status: 'In review', issue: 'Bank account changed pre-payment',  title: 'TechParts Ltd changed its bank account 2 days before a ₹3,60,000 payment' },
  { id: 'r6', vendor: 'FastShip Logistics', amount: 190_000, control: 'Approval rules check',       status: 'Open',      issue: 'Split under the approval limit',   title: 'A FastShip Logistics payment was split into two parts of ₹95,000, just under the approval limit' },
  { id: 'r7', vendor: 'Global Supplies',    amount: 12_600,  control: 'Invoice-vs-PO match check',  status: 'Open',      issue: 'Invoice over PO by ₹12,600',       title: 'A Global Supplies invoice came in ₹12,600 higher than its purchase order' },
  { id: 'r8', vendor: 'TechParts Ltd',      amount: 49_800,  control: 'Duplicate payment check',    status: 'Resolved',  issue: 'Near-identical invoice numbers',   title: 'TechParts Ltd used near-identical invoice numbers twice in the same week (₹49,800)' },
  { id: 'r9', vendor: 'FastShip Logistics', amount: 58_700,  control: 'Vendor detail change check', status: 'Open',      issue: 'Paid while marked inactive',       title: 'FastShip Logistics was paid ₹58,700 while marked inactive in the vendor list' },
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

// ── The same 9 findings as a results table ──
// Both the DAG output list (above) and the chat results table read from
// RISK_FACTS, so they always show the same findings, amounts, and count. The
// Risk (High/Medium) column is added by the table at render time (it depends on
// the user's threshold), so it is NOT baked into these static rows.

/** Results-table columns for the 9 risky payments. Amount is index 1 — the
 *  table's dynamic Risk column is computed from it. */
export const CHAT_RISK_TABLE_COLUMNS = ['Vendor', 'Amount', 'Issue', 'Control', 'Status'];

/** The 9 findings as table rows, in the CHAT_RISK_TABLE_COLUMNS order. */
export function buildChatPlanRiskRows(): string[][] {
  return RISK_FACTS.map((r) => [r.vendor, inrFull(r.amount), r.issue, r.control, r.status]);
}

/** Roll-ups over the same 9 findings, so the KPIs / prose can't drift from the
 *  table: count, total exposure, largest single, distinct vendors & controls. */
export const CHAT_RISK_SUMMARY = {
  count: RISK_FACTS.length,
  totalExposure: RISK_FACTS.reduce((sum, r) => sum + r.amount, 0),
  largest: Math.max(...RISK_FACTS.map((r) => r.amount)),
  vendors: new Set(RISK_FACTS.map((r) => r.vendor)).size,
  controls: new Set(RISK_FACTS.map((r) => r.control)).size,
};

// ─── The output insight — "what these exceptions mean" ─────────────────────
//
// The chat answer's own AI insight, built from the SAME nine findings the
// results table renders, so no figure on the card can drift from the row above
// it. Deliberately NARROWER than the workflow-executor run insight, because a
// chat answer honestly knows less:
//
//   • no `trajectory` — a one-off query has no stored run history, so there is
//     nothing to trend. Its absence is stated in the evidence note rather than
//     left silent, so "no trend shown" can't be read as "flat".
//   • no cross-workflow correlation band — that card correlates an entity
//     across OTHER workflows' runs; an ad-hoc answer is not a workflow yet.
//
// One insight, one output. The advisory recommendation is the honest route out
// of both limits: save the query as a workflow, and the second run earns a trend.

/** Controls that govern who may APPROVE a payment and who RECEIVES it — as
 *  opposed to whether the invoice itself is arithmetically right. The insight's
 *  central correlation rests on this grouping, so it is named once, here. */
const PAYMENT_PATH_CONTROLS = ['Approval rules check', 'Vendor detail change check'];

/** Reader-facing phrase for each control, for prose that shouldn't read like a
 *  control library ("vendor-detail changes", not "Vendor detail change check"). */
const CONTROL_PHRASE: Record<string, string> = {
  'Duplicate payment check': 'duplicate payments',
  'Approval rules check': 'approval rules',
  'Invoice-vs-PO match check': 'invoice-vs-PO matching',
  'Vendor detail change check': 'vendor-detail changes',
};

const STATUS_PHRASE: Record<ChatPlanRiskFact['status'], string> = {
  Open: 'open', 'In review': 'in review', Resolved: 'resolved',
};

const sumAmounts = (rows: ChatPlanRiskFact[]) => rows.reduce((sum, r) => sum + r.amount, 0);

/** Sentence-case a line that opens on a control phrase ("duplicate payments…"). */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The single insight for this chat output, rated against the user's own
 *  materiality rule so the card and the table's Risk column agree. */
export function buildChatOutputInsight(threshold: number): LayeredInsight {
  const total = sumAmounts(RISK_FACTS);

  // The correlation: findings about the payment PATH (who approves, who is
  // paid) versus findings about the invoice itself.
  const pathRows = RISK_FACTS.filter((r) => PAYMENT_PATH_CONTROLS.includes(r.control));
  const pathTotal = sumAmounts(pathRows);
  const pathPct = Math.round((pathTotal / total) * 100);

  const openRows = RISK_FACTS.filter((r) => r.status === 'Open');
  const openTotal = sumAmounts(openRows);
  const largest = [...RISK_FACTS].sort((a, b) => b.amount - a.amount)[0];
  const highCount = RISK_FACTS.filter((r) => isHighByAmount(r.amount, threshold)).length;

  // Per-control roll-up — biggest exposure first, so the prose quotes the same
  // ordering the evidence table does.
  const byControl = [...new Set(RISK_FACTS.map((r) => r.control))]
    .map((control) => {
      const rows = RISK_FACTS.filter((r) => r.control === control);
      return { control, count: rows.length, total: sumAmounts(rows) };
    })
    .sort((a, b) => b.total - a.total);
  const pathBreakdown = byControl
    .filter((c) => PAYMENT_PATH_CONTROLS.includes(c.control))
    .map((c) => `${CONTROL_PHRASE[c.control]} ${inrFull(c.total)} across ${c.count}`)
    .join(', ');
  const mostFrequent = [...byControl].sort((a, b) => b.count - a.count || a.total - b.total)[0];
  const smallest = byControl[byControl.length - 1];

  // Named rows the narrative leans on — looked up, never hardcoded, so a change
  // to RISK_FACTS rewrites the copy instead of contradicting it.
  const bankChange = RISK_FACTS.find((r) => r.issue.includes('Bank account changed'));
  const selfApproved = RISK_FACTS.find((r) => r.issue.includes('Approved by the raiser'));
  const split = RISK_FACTS.find((r) => r.issue.includes('Split under'));
  const inactive = RISK_FACTS.find((r) => r.issue.includes('inactive'));
  const poRows = RISK_FACTS.filter((r) => r.control === 'Invoice-vs-PO match check');

  return {
    id: 'chat-output-risky-payments',
    layer: 'control',
    subjectId: 'chat-output-risky-payments',
    subjectLabel: 'Risky payments — this answer',
    takeaway: `${inrFull(pathTotal)} — ${pathPct}% of the flagged exposure — sits in ${pathRows.length} findings about who approved a payment or who received it, not about the invoice.`,
    verdict: { label: 'Exceptions found', tone: 'negative' },
    severity: 'high',
    likelyCause: {
      label: 'Changes to the payment path aren’t re-checked before release.',
      detail: `Each of the ${pathRows.length} clears a control that reads the invoice, not the change behind it — a bank account edited days before a ${inrFull(bankChange?.amount ?? 0)} payment, ${inrFull(inactive?.amount ?? 0)} paid to a vendor marked inactive, ${inrFull(selfApproved?.amount ?? 0)} approved by the person who raised it, and ${inrFull(split?.amount ?? 0)} split into halves under the limit. Confirm the mechanism on the ${bankChange?.vendor} row before anything here is written up as fraud.`,
    },
    reasoning: `Nine rows, nine separate payments — no two findings describe the same invoice, so ${inrFull(total)} is a sum of nine amounts, not a double count.`,
    observations: [
      `${RISK_FACTS.length} exceptions across ${CHAT_RISK_SUMMARY.vendors} vendors and ${byControl.length} controls, ${inrFull(total)} in total — ${highCount} clear your ${inrFull(threshold)} High rule.`,
      `The money concentrates where the payment path is set: ${pathBreakdown} — ${pathPct}% of the total from ${pathRows.length} of ${RISK_FACTS.length} findings.`,
      sentence(
        mostFrequent.control === smallest.control
          ? `${CONTROL_PHRASE[mostFrequent.control]} break most often — ${mostFrequent.count} findings — but carry the least money: ${inrFull(mostFrequent.total)}.`
          : `${CONTROL_PHRASE[mostFrequent.control]} break most often — ${mostFrequent.count} findings, ${inrFull(mostFrequent.total)}.`,
      ),
      `${openRows.length} findings are still open, worth ${inrFull(openTotal)}; the largest single item (${inrFull(largest.amount)}, ${largest.vendor}) is ${largest.status === 'Open' ? 'among them' : `already ${STATUS_PHRASE[largest.status]}`}.`,
    ],
    atStake: `${inrFull(openTotal)} of the ${inrFull(total)} is still open and unactioned, and the ${inrFull(largest.amount)} ${largest.vendor} payment is the one that can’t be unwound cheaply.`,
    stakes: [
      `${inrFull(openTotal)} sits in the ${openRows.length} findings nobody has actioned yet.`,
      `${inrFull(bankChange?.amount ?? 0)} went to a bank account changed days earlier — if that change wasn’t genuine, the money comes back by dispute, not by credit note.`,
      `The approval limit was cleared two different ways — self-approval and splitting — so the next bypass won’t look like either of these.`,
    ],
    kpis: [
      { value: `${pathPct}%`, label: 'On the payment path', sub: `${inrFull(pathTotal)} across ${pathRows.length} of ${RISK_FACTS.length} findings — approver or payee, not the invoice`, tone: 'bad' },
      { value: String(openRows.length), unit: `/ ${RISK_FACTS.length}`, label: 'Still open', sub: `${inrFull(openTotal)} unactioned — a hold now is reversible, a release is not`, tone: 'bad' },
      { value: inrFull(largest.amount), label: largest.vendor, sub: 'the single payment that can’t be unwound cheaply' },
    ],
    // One run, two datasets, today: frequency stays low on purpose — a single
    // output can price exposure, it cannot establish recurrence.
    factors: { frequency: 0.35, sourceDiversity: 0.6, recency: 1, businessImpact: 0.9 },
    confidenceOverride: 0.76,
    evidence: [...RISK_FACTS]
      .sort((a, b) => b.amount - a.amount)
      .map((r) => ({
        ref: r.control,
        label: r.vendor,
        detail: `${inrFull(r.amount)} · ${r.issue} · ${r.status}`,
        tone: isHighByAmount(r.amount, threshold) ? ('negative' as const) : ('caution' as const),
      })),
    evidenceNote: `${RISK_FACTS.length} flagged rows from 1.2M payments checked · one run — this output only. There is no prior run to compare against, so nothing here is a trend.`,
    runsAnalysed: 1,
    detectedOn: '15 Jul 2026',
    detectedBy: 'traceable',
    rollupOf: { label: 'flagged payments', count: RISK_FACTS.length },
    // The inline check-more chips were retired from the card; follow-ups live in
    // the chat's own "Ask a follow-up" track directly below the answer.
    checkMore: [],
    recommendedActions: [],
    recommendations: [
      {
        id: 'chat-rec-hold', category: 'monitoring', priority: 'do-now',
        title: `Hold the ${inrFull(openTotal)} across the ${openRows.length} open findings before the next payment run.`,
        rationale: 'A hold is reversible; a released payment becomes a recovery exercise — and one of these followed a bank-account change, which recovers slowest of all.',
      },
      {
        id: 'chat-rec-bank', category: 'root-cause', priority: 'do-now',
        title: `Confirm the ${bankChange?.vendor} bank-account change against an independently held contact before releasing ${inrFull(bankChange?.amount ?? 0)}.`,
        rationale: 'A vendor-detail change immediately before payment is the standard payment-diversion shape — confirm the mechanism before it is treated as fraud.',
        guardrail: 'The fraud call stays the auditor’s.',
      },
      {
        id: 'chat-rec-approval', category: 'segregation', priority: 'this-period',
        title: 'Re-test the approval limit against both self-approval and split invoices.',
        rationale: `Two findings (${inrFull((selfApproved?.amount ?? 0) + (split?.amount ?? 0))}) cleared the same limit in two different ways, which means the limit is being applied to the invoice rather than to the requester.`,
      },
      {
        id: 'chat-rec-evidence', category: 'evidence', priority: 'this-period',
        title: `Pull the PO and receipt for the ${poRows.length} invoice-vs-PO breaks (${inrFull(sumAmounts(poRows))}).`,
        rationale: 'A missing PO and an over-billed line can both be legitimate — a split delivery, an agreed variation. The paper decides before either is written up.',
      },
      {
        id: 'chat-rec-workflow', category: 'automation', priority: 'advisory',
        title: 'Save this query as a workflow so the next run has something to compare against.',
        rationale: 'This ran once over 90 days. One run can price exposure but cannot show direction — a second run is what turns these nine rows into a trend.',
      },
    ],
  };
}
