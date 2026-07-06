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
