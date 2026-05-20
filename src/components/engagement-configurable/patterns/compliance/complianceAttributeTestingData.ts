// ─── Compliance Attribute Testing — Types & Helpers ───────────────────────

import { MOCK_COMPLIANCE_CONTROLS, type ScopeAttribute } from './complianceControlScopeData';
import type { TestItem } from './complianceSamplesEvidenceData';

// ─── Types ────────────────────────────────────────────────────────────────

export type AttrTestResult = 'NOT_TESTED' | 'PASS' | 'FAIL' | 'NA';
export type AttrTestSource = 'MANUAL' | 'AUTOMATED' | 'SYSTEM_SUGGESTED';

export interface AttributeTestResult {
  id: string;
  testItemId: string;
  controlId: string;
  attributeId: string;
  result: AttrTestResult;
  source: AttrTestSource;
  notes: string;
  testedBy: string;
  testedAt: string | null;
  evidenceIds: string[];
}

export type ComplianceSampleResult = 'PENDING' | 'PASS' | 'FAIL';

export interface AttributeTestingState {
  results: AttributeTestResult[];
  testingStarted: boolean;
}

// ─── Initialization ──────────────────────────────────────────────────────

export function initializeAttributeResults(testItems: TestItem[], existingResults: AttributeTestResult[]): AttributeTestResult[] {
  const existingKeys = new Set(existingResults.map(r => `${r.testItemId}::${r.attributeId}`));
  const newResults: AttributeTestResult[] = [];

  for (const ti of testItems) {
    const attrs = MOCK_COMPLIANCE_CONTROLS.find(c => c.id === ti.linkedControlId)?.attributes || [];
    for (const attr of attrs) {
      const key = `${ti.id}::${attr.id}`;
      if (!existingKeys.has(key)) {
        newResults.push({
          id: `atr-${ti.id}-${attr.id}`,
          testItemId: ti.id,
          controlId: ti.linkedControlId,
          attributeId: attr.id,
          result: 'NOT_TESTED',
          source: 'MANUAL',
          notes: '',
          testedBy: '',
          testedAt: null,
          evidenceIds: [],
        });
      }
    }
  }

  return [...existingResults, ...newResults];
}

// ─── Sample Result Derivation ─────────────────────────────────────────────

export function deriveComplianceSampleResult(testItemId: string, results: AttributeTestResult[]): ComplianceSampleResult {
  const tiResults = results.filter(r => r.testItemId === testItemId);
  if (tiResults.length === 0) return 'PENDING';

  const ctrl = MOCK_COMPLIANCE_CONTROLS.find(c => c.id === tiResults[0].controlId);
  const requiredAttrIds = new Set((ctrl?.attributes || []).filter(a => a.required).map(a => a.id));

  const requiredResults = tiResults.filter(r => requiredAttrIds.has(r.attributeId));
  if (requiredResults.some(r => r.result === 'FAIL')) return 'FAIL';
  if (requiredResults.every(r => r.result === 'PASS' || r.result === 'NA')) return 'PASS';
  return 'PENDING';
}

// ─── Testing Summary ──────────────────────────────────────────────────────

export function deriveComplianceTestingSummary(results: AttributeTestResult[]) {
  const totalChecks = results.length;
  const completedChecks = results.filter(r => r.result !== 'NOT_TESTED').length;
  const passedChecks = results.filter(r => r.result === 'PASS').length;
  const failedChecks = results.filter(r => r.result === 'FAIL').length;
  const pendingChecks = totalChecks - completedChecks;
  const completionPercent = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;
  return { totalChecks, completedChecks, passedChecks, failedChecks, pendingChecks, completionPercent };
}

// ─── Automated Check Simulation ───────────────────────────────────────────

export function runAutomatedChecks(testItems: TestItem[], existingResults: AttributeTestResult[]): AttributeTestResult[] {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return existingResults.map(r => {
    const ctrl = MOCK_COMPLIANCE_CONTROLS.find(c => c.id === r.controlId);
    const attr = ctrl?.attributes.find(a => a.id === r.attributeId);
    if (!attr?.workflowId) return r; // manual attributes stay untouched
    const wf = ctrl?.workflows.find(w => w.id === attr.workflowId);
    if (!wf || wf.type === 'Manual') return r; // manual workflows stay untouched
    if (r.result !== 'NOT_TESTED') return r; // already tested

    const ti = testItems.find(t => t.id === r.testItemId);
    if (!ti) return r;

    // Deterministic mock logic
    let pass = true;
    const ref = ti.referenceId.toLowerCase();
    if (ref.includes('1003') || ref.includes('inv-1003') || ref.includes('txn-0003')) {
      // INV-1003 fails some checks
      if (attr.code === 'B' || attr.code === 'C') pass = false;
    }

    return {
      ...r,
      result: pass ? 'PASS' as const : 'FAIL' as const,
      source: 'AUTOMATED' as const,
      testedBy: 'System',
      testedAt: now,
      notes: pass
        ? `Auto-tested by ${wf.name}. Check passed.`
        : `Auto-tested by ${wf.name}. Check failed — exception detected.`,
    };
  });
}
