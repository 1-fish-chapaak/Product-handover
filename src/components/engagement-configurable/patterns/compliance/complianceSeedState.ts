// ─── Compliance Workspace — Flagship Demo Seed ────────────────────────────
// Deterministic, partially-done state so a demo engagement opens mid-flight:
// PBC requests in every status, a prepared sample batch with mapped evidence,
// C001 fully tested (incl. 2 attribute fails on INV-1003, one AI-suggested),
// C001 submitted for review (maker: Tushar Goel), and C002 left ready for the
// "Run AI on all mapped" demo. Nothing here uses Date.now() — repeat opens
// produce the identical state.

import type { ComplianceWorkspaceState } from './complianceRequestsData';
import { MOCK_PBC_REQUESTS } from './complianceRequestsData';
import { MOCK_COMPLIANCE_CONTROLS } from './complianceControlScopeData';
import type { SampleBatch, EvidenceItem } from './complianceSamplesEvidenceData';
import { initializeAttributeResults, type AttributeTestResult } from './complianceAttributeTestingData';
import type { ComplianceReviewState } from './complianceReviewData';

const SEED_DATE = '2026-06-24';
const SEED_TS = '2026-06-24 14:32';

const SEED_BATCH: SampleBatch = {
  id: 'batch-seed-001', name: 'Uploaded Invoice Samples',
  inputMethod: 'Upload Selected Samples', sourceName: 'invoice_samples_fy26_q1.xlsx',
  uploadedAt: SEED_DATE, status: 'Uploaded', sampleCount: 5,
  linkedControlIds: ['C001', 'C002'],
  testItems: [
    { id: 'ti-001', referenceId: 'INV-1001', description: 'Vendor A — Invoice', linkedControlId: 'C001', sourceRow: 1, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 4 },
    { id: 'ti-002', referenceId: 'INV-1002', description: 'Vendor B — Invoice', linkedControlId: 'C001', sourceRow: 2, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 4 },
    { id: 'ti-003', referenceId: 'INV-1003', description: 'Vendor A — Invoice', linkedControlId: 'C001', sourceRow: 3, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 4 },
    { id: 'ti-004', referenceId: 'INV-1004', description: 'Vendor C — Invoice', linkedControlId: 'C002', sourceRow: 4, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 3 },
    { id: 'ti-005', referenceId: 'INV-1005', description: 'Vendor D — Invoice', linkedControlId: 'C002', sourceRow: 5, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 3 },
  ],
};

const SEED_EVIDENCE: EvidenceItem[] = [
  {
    id: 'ev-seed-001', fileName: 'GRN-2201.pdf', evidenceType: 'GRN Copy',
    linkedControlId: 'C001', linkedAttributeIds: ['a1', 'a2'], linkedTestItemIds: ['ti-001', 'ti-002', 'ti-003'],
    uploadedBy: 'P2P Process Owner', uploadedAt: SEED_DATE, source: 'RECEIVED_FROM_PBC', status: 'ATTACHED',
  },
  {
    id: 'ev-seed-002', fileName: 'PO_batch_1.zip', evidenceType: 'PO Copy',
    linkedControlId: 'C001', linkedAttributeIds: ['a1', 'a3'], linkedTestItemIds: ['ti-001', 'ti-002', 'ti-003'],
    uploadedBy: 'Tushar Goel', uploadedAt: SEED_DATE, source: 'USER_UPLOADED', status: 'ATTACHED',
  },
  {
    id: 'ev-seed-003', fileName: 'payment_approval_log.xlsx', evidenceType: 'Approval Log',
    linkedControlId: 'C001', linkedAttributeIds: ['a4'], linkedTestItemIds: ['ti-001', 'ti-002', 'ti-003'],
    uploadedBy: 'Tushar Goel', uploadedAt: SEED_DATE, source: 'USER_UPLOADED', status: 'ATTACHED',
  },
  {
    id: 'ev-seed-004', fileName: 'duplicate_scan_report.xlsx', evidenceType: 'Exception Report',
    linkedControlId: 'C002', linkedAttributeIds: ['a5', 'a6', 'a7'], linkedTestItemIds: ['ti-004', 'ti-005'],
    uploadedBy: 'AP Lead', uploadedAt: SEED_DATE, source: 'RECEIVED_FROM_PBC', status: 'ATTACHED',
  },
];

/** Pre-tested results: C001 fully tested (INV-1003 fails B & C), C002 untested for the AI demo. */
function seedResults(): AttributeTestResult[] {
  const base = initializeAttributeResults(SEED_BATCH.testItems, []);
  const patch: Record<string, Partial<AttributeTestResult>> = {};
  const passNote = (wf: string) => `Auto-tested by ${wf}. Check passed.`;

  for (const ti of ['ti-001', 'ti-002']) {
    patch[`${ti}::a1`] = { result: 'PASS', source: 'AUTOMATED', testedBy: 'System', testedAt: SEED_TS, notes: passNote('PO Validation Workflow') };
    patch[`${ti}::a2`] = { result: 'PASS', source: 'AUTOMATED', testedBy: 'System', testedAt: SEED_TS, notes: passNote('GRN Matching Workflow') };
    patch[`${ti}::a3`] = { result: 'PASS', source: 'AUTOMATED', testedBy: 'System', testedAt: SEED_TS, notes: passNote('Invoice Match Workflow') };
    patch[`${ti}::a4`] = { result: 'PASS', source: 'MANUAL', testedBy: 'Tushar Goel', testedAt: SEED_TS, notes: 'Dual authorization verified in approval log.' };
  }
  patch['ti-003::a1'] = { result: 'PASS', source: 'AUTOMATED', testedBy: 'System', testedAt: SEED_TS, notes: passNote('PO Validation Workflow') };
  patch['ti-003::a2'] = {
    result: 'FAIL', source: 'AI_SUGGESTED', testedBy: 'AI Verdict', testedAt: SEED_TS,
    notes: 'GRN could not be traced for INV-1003 — receipt not evidenced.',
    aiJustification: `Evidence 'GRN-2201.pdf' does not support "GRN exists for invoice" for INV-1003 — the required approval / matching record could not be traced, so the attribute is concluded Fail.`,
    aiConfirmedBy: 'Tushar Goel', aiConfirmedAt: SEED_TS,
  };
  patch['ti-003::a3'] = {
    result: 'FAIL', source: 'MANUAL', testedBy: 'Tushar Goel', testedAt: SEED_TS,
    notes: 'Invoice amount exceeds PO amount by ₹42,300 — no amendment on record.',
  };
  patch['ti-003::a4'] = { result: 'PASS', source: 'MANUAL', testedBy: 'Tushar Goel', testedAt: SEED_TS, notes: 'Approval present and within DOA limit.' };

  return base.map(r => {
    const p = patch[`${r.testItemId}::${r.attributeId}`];
    return p ? { ...r, ...p } : r;
  });
}

const SEED_REVIEW: ComplianceReviewState = {
  reviews: [
    {
      controlId: 'C001',
      status: 'PENDING_REVIEW',
      submittedBy: 'Tushar Goel',
      submittedAt: SEED_TS,
      reviewedBy: '',
      reviewedAt: null,
      reviewerComments: '',
      rejectionReason: '',
      history: [
        { id: 'rh-seed-001', action: 'SUBMITTED', actor: 'Tushar Goel', timestamp: SEED_TS, comments: '' },
      ],
    },
  ],
};

/** Flagship deterministic seed — a demo engagement opens with partially-done data. */
export function seedComplianceWorkspaceState(): ComplianceWorkspaceState {
  return {
    scopeControls: MOCK_COMPLIANCE_CONTROLS,
    requests: MOCK_PBC_REQUESTS,
    samplesEvidence: { batches: [SEED_BATCH], evidence: SEED_EVIDENCE },
    attributeTesting: { results: seedResults(), testingStarted: true },
    review: SEED_REVIEW,
    conclusion: { conclusions: [] },
  };
}
