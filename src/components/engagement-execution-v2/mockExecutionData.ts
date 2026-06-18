// ─── Engagement Execution V2 — Mock Data ──────────────────────────────────
// All controls start fresh: NOT_STARTED, no population, no test items,
// no evidence, no attribute results, no review, no conclusion.

import type { EngagementExecution, ExecutionControl, ControlExecutionState, TestItem, AttributeResult } from './types';
import {
  ControlExecStatus, ImportanceClass, NatureClass, AutomationClass,
  AttributeType, AttrScope, SamplingMethod,
  ReviewStatus, WorkingPaperStatus, AttrResult, AttrSource, SampleResult, ExecutionMode,
} from './types';

// ─── Helper: create fresh execution state ─────────────────────────────────

/**
 * Pre-seed test items + population for one control so the new Attribute Testing
 * step is demonstrable without first walking the upload + sampling flow.
 * Used only by `exec-c001`.
 */
function seededExecution(attrIds: string[], opts?: { skipSampling?: boolean }): ControlExecutionState {
  const departments = ['Engineering', 'Marketing', 'Operations', 'Finance', 'Sales', 'HR', 'Legal', 'IT'];
  const rows = departments.map((dept, i) => ({
    rowIndex: i + 1,
    department: dept,
    fyBudget: 1_250_000 + i * 175_000,
    capex: 320_000 + i * 40_000,
    opex: 930_000 + i * 135_000,
    submitter: `Dept Head ${i + 1}`,
    submittedOn: `2025-0${(i % 9) + 1}-${15 + (i % 10)}`,
  }));
  const testItems: TestItem[] = rows.map((r, idx) => {
    const attrResults: AttributeResult[] = attrIds.map(aid => ({
      attributeId: aid,
      result: AttrResult.NOT_TESTED,
      source: AttrSource.MANUAL,
      evidenceIds: [],
      notes: '',
      testedAt: null,
      testedBy: null,
    }));
    return {
      id: `ti-c001-${idx + 1}`,
      referenceId: `BUD-${(idx + 1).toString().padStart(3, '0')}`,
      description: `${r.department} FY26 budget — $${(r.fyBudget / 1000).toFixed(0)}k total`,
      sourceRow: idx,
      evidence: [],
      attributeResults: attrResults,
      sampleResult: SampleResult.PENDING,
    };
  });
  const samplingDone = !opts?.skipSampling;
  return {
    status: ControlExecStatus.TEST_ITEMS_READY,
    population: {
      id: 'pop-c001-fy26',
      source: 'budget_submissions_fy26.xlsx',
      rows,
      rowCount: rows.length,
      locked: true,
      lockedAt: '2026-04-08T09:00:00Z',
      checksum: 'sha256:c001fy26seed',
      testUnit: 'Department budget submission',
    },
    executionMode: ExecutionMode.FULL_RUN,
    testItems: samplingDone ? testItems : [],
    sampling: samplingDone ? {
      method: SamplingMethod.RANDOM,
      sampleSize: testItems.length,
      generatedAt: '2026-04-08T09:15:00Z',
      sampleItemIds: testItems.map(t => t.id),
    } : null,
    /** Empty list so the user sees the "No workflows configured" empty state + CTA. */
    validationWorkflows: [],
    genericResults: {},
    review: {
      status: ReviewStatus.NOT_SUBMITTED, submittedAt: null, reviewedAt: null, reviewer: '', comments: '',
    },
    workingPaper: { status: WorkingPaperStatus.NOT_GENERATED, generatedAt: null, finalDownloadEnabled: false },
    conclusion: { value: null, reason: '', generatedAt: null },
  };
}

function freshExecution(): ControlExecutionState {
  return {
    status: ControlExecStatus.NOT_STARTED,
    population: null,
    executionMode: null,
    testItems: [],
    review: {
      status: ReviewStatus.NOT_SUBMITTED,
      submittedAt: null,
      reviewedAt: null,
      reviewer: '',
      comments: '',
    },
    workingPaper: {
      status: WorkingPaperStatus.NOT_GENERATED,
      generatedAt: null,
      finalDownloadEnabled: false,
    },
    conclusion: {
      value: null,
      reason: '',
      generatedAt: null,
    },
  };
}

// ─── Controls ─────────────────────────────────────────────────────────────

const CONTROLS: ExecutionControl[] = [
  // ── C001: Manual Control ────────────────────────────────────────────────
  {
    id: 'exec-c001',
    name: 'Budget Planning and Allocation',
    description: 'Each department head prepares a detailed procurement budget covering anticipated OPEX and CAPEX requirements, referencing historical spending data, approved project plans, and strategic priorities.',
    process: 'PLM',
    owner: 'Rajiv Sharma',
    importanceClass: ImportanceClass.KEY,
    natureClass: NatureClass.PREVENTIVE,
    automationClass: AutomationClass.MANUAL,
    assertions: [
      { id: 'asr-c001-acc', name: 'Accuracy' },
      { id: 'asr-c001-comp', name: 'Completeness' },
      { id: 'asr-c001-val', name: 'Validity' },
    ],
    attributes: [
      {
        id: 'attr-c001-01', name: 'Budget reflects historical spending data',
        description: 'For each department in the sample, confirm the FY26 budget references prior-year actuals and a trend rationale.',
        assertionId: 'asr-c001-acc', assertionName: 'Accuracy',
        type: AttributeType.MANUAL, scope: AttrScope.SAMPLE_BASED, required: true,
        requiredEvidenceTypes: ['Budget workbook', 'Prior year actuals'],
        evidenceDescriptions: [
          'Department budget workbook for FY26 with line-item detail.',
          'Prior-year actual spending report (FY25) used as baseline.',
        ],
        workflowId: 'wf-budget-review',
      },
      {
        id: 'attr-c001-02', name: 'Budget includes anticipated OPEX and CAPEX requirements',
        description: 'For each department in the sample, confirm both OPEX and CAPEX categories are present and break out by line item.',
        assertionId: 'asr-c001-comp', assertionName: 'Completeness',
        type: AttributeType.MANUAL, scope: AttrScope.SAMPLE_BASED, required: true,
        requiredEvidenceTypes: ['Budget workbook'],
        evidenceDescriptions: ['Department budget workbook showing OPEX + CAPEX tabs.'],
        workflowId: 'wf-budget-review',
      },
      {
        id: 'attr-c001-03', name: 'Budget aligns with approved project plans',
        description: 'For each department in the sample, cross-reference budget line items against approved project charters.',
        assertionId: 'asr-c001-val', assertionName: 'Validity',
        type: AttributeType.MANUAL, scope: AttrScope.SAMPLE_BASED, required: true,
        requiredEvidenceTypes: ['Project charter', 'Budget workbook'],
        evidenceDescriptions: [
          'Approved project charter for projects funded in this budget.',
          'Department budget workbook with project line items.',
        ],
        workflowId: 'wf-budget-review',
      },
      // GENERIC attribute — control-level check, no sample loop.
      {
        id: 'attr-c001-04', name: 'Master budget signed off by CFO',
        description: 'Confirm the consolidated FY26 procurement budget has been signed and dated by the CFO at the engagement level. One signed document covers the whole control.',
        assertionId: 'asr-c001-val', assertionName: 'Validity',
        type: AttributeType.MANUAL, scope: AttrScope.GENERIC, required: true,
        requiredEvidenceTypes: ['CFO-signed budget cover sheet'],
        evidenceDescriptions: ['Single signed cover sheet for the consolidated FY26 procurement budget, signed and dated by the CFO.'],
        workflowId: 'wf-budget-review',
      },
    ],
    workflowMappings: [
      {
        workflowId: 'wf-budget-review',
        workflowName: 'Annual Procurement Budget Review Workflow',
        version: 'v1.0',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c001-01', 'attr-c001-02', 'attr-c001-03', 'attr-c001-04'],
      },
    ],
    execution: seededExecution(['attr-c001-01', 'attr-c001-02', 'attr-c001-03', 'attr-c001-04']),
  },

  // ── C002: Hybrid Control ────────────────────────────────────────────────
  {
    id: 'exec-c002',
    name: 'Three-way PO/GRN/Invoice Matching',
    description: 'System-enforced three-way matching of Purchase Order, Goods Receipt Note, and Invoice before payment release, with manual approval for payments above threshold.',
    process: 'PLM',
    owner: 'Deepak Bansal',
    importanceClass: ImportanceClass.KEY,
    natureClass: NatureClass.PREVENTIVE,
    automationClass: AutomationClass.IT_DEPENDENT,
    assertions: [
      { id: 'asr-c002-exist', name: 'Existence' },
      { id: 'asr-c002-acc', name: 'Accuracy' },
      { id: 'asr-c002-comp', name: 'Completeness' },
      { id: 'asr-c002-auth', name: 'Authorization' },
    ],
    attributes: [
      {
        id: 'attr-c002-01', name: 'PO exists for invoice',
        description: 'For each sampled invoice, verify a valid, approved Purchase Order exists in the ERP.',
        assertionId: 'asr-c002-exist', assertionName: 'Existence',
        type: AttributeType.AUTOMATED, scope: AttrScope.SAMPLE_BASED, required: true,
        requiredEvidenceTypes: ['PO document'],
        workflowId: 'wf-po-validation',
      },
      {
        id: 'attr-c002-02', name: 'GRN exists for invoice',
        description: 'For each sampled invoice, confirm a GRN exists matching the line items.',
        assertionId: 'asr-c002-comp', assertionName: 'Completeness',
        type: AttributeType.AUTOMATED, scope: AttrScope.SAMPLE_BASED, required: true,
        requiredEvidenceTypes: ['GRN document'],
        workflowId: 'wf-grn-matching',
      },
      {
        id: 'attr-c002-03', name: 'Invoice amount matches PO amount',
        description: 'For each sampled invoice, confirm the invoice total matches the PO total within tolerance.',
        assertionId: 'asr-c002-acc', assertionName: 'Accuracy',
        type: AttributeType.AUTOMATED, scope: AttrScope.SAMPLE_BASED, required: true,
        requiredEvidenceTypes: ['Invoice document', 'PO document'],
        workflowId: 'wf-invoice-match',
      },
      {
        id: 'attr-c002-04', name: 'Payment approval exists',
        description: 'For each sampled invoice, confirm appropriate payment approval was obtained before release per delegation matrix.',
        assertionId: 'asr-c002-auth', assertionName: 'Authorization',
        type: AttributeType.MANUAL, scope: AttrScope.SAMPLE_BASED, required: true,
        requiredEvidenceTypes: ['Approval log'],
        workflowId: 'wf-payment-approval',
      },
    ],
    workflowMappings: [
      {
        workflowId: 'wf-po-validation',
        workflowName: 'PO Validation Workflow',
        version: 'v2.0',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c002-01'],
      },
      {
        workflowId: 'wf-grn-matching',
        workflowName: 'GRN Matching Workflow',
        version: 'v1.6',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c002-02'],
      },
      {
        workflowId: 'wf-invoice-match',
        workflowName: 'Invoice Match Workflow',
        version: 'v2.3',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c002-03'],
      },
      {
        workflowId: 'wf-payment-approval',
        workflowName: 'Payment Approval Review Workflow',
        version: 'v1.0',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c002-04'],
      },
    ],
    execution: freshExecution(),
  },

  // ── C003: Automated Control ─────────────────────────────────────────────
  {
    id: 'exec-c003',
    name: 'Duplicate Invoice Detection',
    description: 'Automated scanning of invoices against historical data to identify and flag potential duplicate submissions before payment processing.',
    process: 'PLM',
    owner: 'Rajiv Sharma',
    importanceClass: ImportanceClass.KEY,
    natureClass: NatureClass.DETECTIVE,
    automationClass: AutomationClass.AUTOMATED,
    assertions: [
      { id: 'asr-c003-acc', name: 'Accuracy' },
      { id: 'asr-c003-val', name: 'Validity' },
    ],
    attributes: [
      {
        id: 'attr-c003-01', name: 'Duplicate invoice number check',
        description: 'For each sampled invoice, system scans for exact invoice number matches across vendors and periods.',
        assertionId: 'asr-c003-acc', assertionName: 'Accuracy',
        type: AttributeType.AUTOMATED, scope: AttrScope.SAMPLE_BASED, required: true,
        requiredEvidenceTypes: ['System log'],
        workflowId: 'wf-dup-detector',
      },
      {
        id: 'attr-c003-02', name: 'Vendor + amount duplicate check',
        description: 'For each sampled invoice, system flags matching vendor ID + amount within configurable window.',
        assertionId: 'asr-c003-acc', assertionName: 'Accuracy',
        type: AttributeType.AUTOMATED, scope: AttrScope.SAMPLE_BASED, required: true,
        requiredEvidenceTypes: ['System log'],
        workflowId: 'wf-dup-detector',
      },
      {
        id: 'attr-c003-03', name: 'Duplicate override authorization',
        description: 'For each duplicate override in the period, verify it was authorized by an appropriate approver.',
        assertionId: 'asr-c003-val', assertionName: 'Validity',
        type: AttributeType.AUTOMATED, scope: AttrScope.SAMPLE_BASED, required: true,
        requiredEvidenceTypes: ['Override log', 'Approval log'],
        workflowId: 'wf-override-monitor',
      },
    ],
    workflowMappings: [
      {
        workflowId: 'wf-dup-detector',
        workflowName: 'Duplicate Invoice Detector',
        version: 'v1.4',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c003-01', 'attr-c003-02'],
      },
      {
        workflowId: 'wf-override-monitor',
        workflowName: 'Override Monitor',
        version: 'v1.2',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c003-03'],
      },
    ],
    execution: freshExecution(),
  },
];

// ─── Engagement ───────────────────────────────────────────────────────────

export const MOCK_ENGAGEMENT_V2: EngagementExecution = {
  id: 'eng-v2-001',
  name: 'FY26 Procurement Controls Testing',
  auditPeriodStart: 'Apr 1, 2025',
  auditPeriodEnd: 'Mar 31, 2026',
  framework: 'SOX ICFR',
  auditType: 'Financial Internal Control',
  primaryProcess: 'Procurement Lifecycle Management',
  owner: 'SOX Manager',
  reviewer: 'Audit Lead',
  status: 'ACTIVE',
  controls: CONTROLS,
};
