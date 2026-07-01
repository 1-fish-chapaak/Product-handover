// ─── Compliance — Real .xlsx Exports ──────────────────────────────────────
// Working Paper draft + Engagement Summary report, following the established
// pattern in src/components/sox-icfr/icfrWorkingPaper.ts (aoa_to_sheet + writeFile).

import * as XLSX from 'xlsx';
import type { ConfigurableEngagement, ComplianceConfig } from '../../configurableEngagementTypes';
import type { ComplianceWorkspaceState } from './complianceRequestsData';
import { deriveComplianceControlReadiness } from './complianceControlScopeData';
import {
  deriveComplianceSampleResult, deriveComplianceTestingSummary,
  type AttrTestResult,
} from './complianceAttributeTestingData';
import { getOrCreateControlReview } from './complianceReviewData';
import { getOrCreateControlConclusion, CONCLUSION_DISPLAY } from './complianceConclusionData';
import { DEFAULT_MATERIALITY } from './complianceSeverityData';

function autofit(rows: (string | number)[][], max = 70): XLSX.ColInfo[] {
  const w: number[] = [];
  rows.forEach(r => r.forEach((c, i) => { w[i] = Math.min(max, Math.max(w[i] ?? 10, String(c ?? '').length + 2)); }));
  return w.map(wch => ({ wch }));
}

const RESULT_TEXT: Record<AttrTestResult, string> = { NOT_TESTED: 'Not tested', PASS: 'Pass', FAIL: 'Fail', NA: 'N/A' };
const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-');

/** Consolidated compliance working paper: Index · Controls · Testing Matrix · Evidence · PBC · Review & Conclusion. */
export function downloadComplianceWorkingPaper(engagement: ConfigurableEngagement, state: ComplianceWorkspaceState): void {
  const cfg = engagement.config as ComplianceConfig;
  const testItems = state.samplesEvidence.batches.flatMap(b => b.testItems);
  const results = state.attributeTesting.results;
  const summary = deriveComplianceTestingSummary(results);
  const controls = state.scopeControls;
  const wb = XLSX.utils.book_new();

  const index: (string | number)[][] = [
    ['Compliance Control Testing — Working Paper (Draft)'],
    [],
    ['Engagement', engagement.name],
    ['Framework', cfg.framework.replace(/_/g, ' ')],
    ['Audit type', cfg.auditType],
    ['Audit period', `${cfg.auditPeriodStart || '—'} to ${cfg.auditPeriodEnd || '—'}`],
    ['Owner (preparer)', engagement.owner],
    ['Reviewer', engagement.reviewer || '—'],
    [],
    ['Controls in scope', controls.length],
    ['Test items', testItems.length],
    ['Attribute checks', `${summary.completedChecks}/${summary.totalChecks} completed`],
    ['Passed / Failed', `${summary.passedChecks} / ${summary.failedChecks}`],
    ['Evidence files', state.samplesEvidence.evidence.length],
    ['PBC requests', state.requests.length],
    [],
    ['Legend', 'Pass = attribute satisfied · Fail = attribute not satisfied · N/A = not applicable'],
  ];
  const ix = XLSX.utils.aoa_to_sheet(index);
  ix['!cols'] = [{ wch: 24 }, { wch: 60 }];
  ix['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, ix, 'Index');

  const ctH = ['Control ID', 'Control', 'Description', 'Importance', 'Nature', 'Automation', 'Process', 'Owner', 'Attributes', 'Workflows', 'Readiness'];
  const ctR: (string | number)[][] = controls.map(c => [
    c.id, c.name, c.description, c.importance, c.nature, c.automation, c.process, c.owner,
    c.attributes.length, c.workflows.length, deriveComplianceControlReadiness(c).label,
  ]);
  const ct = XLSX.utils.aoa_to_sheet([ctH, ...ctR]); ct['!cols'] = autofit([ctH, ...ctR]);
  XLSX.utils.book_append_sheet(wb, ct, 'Controls');

  const tmH = ['Control', 'Sample', 'Description', 'Attribute', 'Attribute name', 'Assertion', 'Result', 'Source', 'AI justification', 'Tested by', 'Tested at', 'Notes', 'Sample result'];
  const tmR: (string | number)[][] = testItems.flatMap(ti => {
    const ctrl = controls.find(c => c.id === ti.linkedControlId);
    const sr = deriveComplianceSampleResult(ti.id, results);
    return (ctrl?.attributes || []).map(a => {
      const r = results.find(x => x.testItemId === ti.id && x.attributeId === a.id);
      return [
        ti.linkedControlId, ti.referenceId, ti.description, a.code, a.name, a.assertion,
        RESULT_TEXT[r?.result || 'NOT_TESTED'],
        r?.source === 'AI_SUGGESTED' ? (r.aiConfirmedBy ? `AI (confirmed by ${r.aiConfirmedBy})` : 'AI (unconfirmed)') : (r?.source || '—'),
        r?.aiJustification || '', r?.testedBy || '—', r?.testedAt || '—', r?.notes || '',
        sr === 'PASS' ? 'Pass' : sr === 'FAIL' ? 'Fail' : 'Pending',
      ];
    });
  });
  const tm = XLSX.utils.aoa_to_sheet([tmH, ...tmR]); tm['!cols'] = autofit([tmH, ...tmR]);
  XLSX.utils.book_append_sheet(wb, tm, 'Testing Matrix');

  const evH = ['File', 'Type', 'Control', 'Attributes', 'Test items', 'Source', 'Status', 'Uploaded by', 'Uploaded at'];
  const evR: (string | number)[][] = state.samplesEvidence.evidence.length
    ? state.samplesEvidence.evidence.map(e => [
      e.fileName, e.evidenceType, e.linkedControlId, e.linkedAttributeIds.length, e.linkedTestItemIds.length,
      e.source, e.status, e.uploadedBy, e.uploadedAt,
    ])
    : [['—', 'No evidence attached', '—', 0, 0, '—', '—', '—', '—']];
  const ev = XLSX.utils.aoa_to_sheet([evH, ...evR]); ev['!cols'] = autofit([evH, ...evR]);
  XLSX.utils.book_append_sheet(wb, ev, 'Evidence');

  const pbH = ['Request', 'Title', 'Type', 'Priority', 'Linked control', 'Requested from', 'Due date', 'Status', 'Files received', 'Provided by', 'Last reminded'];
  const pbR: (string | number)[][] = state.requests.map(r => [
    r.id, r.title, r.requestType, r.priority, `${r.linkedControlId} — ${r.linkedControlName}`, r.requestedFrom,
    r.dueDate, r.status, r.filesReceived.join('; ') || '—', r.providedBy || '—', r.lastReminded || '—',
  ]);
  const pb = XLSX.utils.aoa_to_sheet([pbH, ...pbR]); pb['!cols'] = autofit([pbH, ...pbR]);
  XLSX.utils.book_append_sheet(wb, pb, 'PBC Requests');

  const rcH = ['Control', 'Review status', 'Submitted by', 'Submitted at', 'Reviewed by', 'Reviewed at', 'Reviewer comments', 'Conclusion', 'Severity', 'Finalized by', 'Remarks'];
  const rcR: (string | number)[][] = controls.map(c => {
    const rv = getOrCreateControlReview(state.review, c.id);
    const cc = getOrCreateControlConclusion(state.conclusion, c.id);
    return [
      c.id, rv.status.replace(/_/g, ' '), rv.submittedBy || '—', rv.submittedAt || '—', rv.reviewedBy || '—', rv.reviewedAt || '—',
      rv.reviewerComments || '—',
      cc.finalConclusion ? CONCLUSION_DISPLAY[cc.finalConclusion].label : 'Pending',
      cc.severity?.value || '—', cc.finalizedBy || '—', cc.remarks || '—',
    ];
  });
  const rc = XLSX.utils.aoa_to_sheet([rcH, ...rcR]); rc['!cols'] = autofit([rcH, ...rcR]);
  XLSX.utils.book_append_sheet(wb, rc, 'Review & Conclusion');

  XLSX.writeFile(wb, `${fileSafe(engagement.name)} — Working Paper (Draft).xlsx`);
}

/** Engagement summary report: KPIs · Control Rollup · Exceptions · Deficiency Severity. */
export function downloadComplianceSummaryReport(engagement: ConfigurableEngagement, state: ComplianceWorkspaceState): void {
  const cfg = engagement.config as ComplianceConfig;
  const testItems = state.samplesEvidence.batches.flatMap(b => b.testItems);
  const results = state.attributeTesting.results;
  const summary = deriveComplianceTestingSummary(results);
  const controls = state.scopeControls;
  const wb = XLSX.utils.book_new();

  const rollup = controls.map(c => {
    const readiness = deriveComplianceControlReadiness(c);
    const ctrlResults = results.filter(r => r.controlId === c.id);
    const testing = deriveComplianceTestingSummary(ctrlResults);
    const review = getOrCreateControlReview(state.review, c.id);
    const conclusion = getOrCreateControlConclusion(state.conclusion, c.id);
    const items = testItems.filter(ti => ti.linkedControlId === c.id);
    return { c, readiness, testing, review, conclusion, items };
  });

  const effective = rollup.filter(r => r.conclusion.finalConclusion === 'EFFECTIVE').length;
  const partial = rollup.filter(r => r.conclusion.finalConclusion === 'PARTIALLY_EFFECTIVE').length;
  const ineffective = rollup.filter(r => r.conclusion.finalConclusion === 'INEFFECTIVE').length;
  const mw = rollup.filter(r => r.conclusion.severity?.value === 'Material Weakness').length;
  const sd = rollup.filter(r => r.conclusion.severity?.value === 'Significant Deficiency').length;
  const d = rollup.filter(r => r.conclusion.severity?.value === 'Deficiency').length;

  const index: (string | number)[][] = [
    ['Compliance Engagement — Summary Report'],
    [],
    ['Engagement', engagement.name],
    ['Framework', cfg.framework.replace(/_/g, ' ')],
    ['Audit period', `${cfg.auditPeriodStart || '—'} to ${cfg.auditPeriodEnd || '—'}`],
    ['Owner / Reviewer', `${engagement.owner} / ${engagement.reviewer || '—'}`],
    ['Materiality (demo baseline)', DEFAULT_MATERIALITY],
    [],
    ['Controls in scope', controls.length],
    ['Test items', testItems.length],
    ['Attribute checks completed', `${summary.completedChecks}/${summary.totalChecks} (${summary.completionPercent}%)`],
    ['Failed checks', summary.failedChecks],
    [],
    ['Effective', effective],
    ['Partially effective', partial],
    ['Ineffective', ineffective],
    [],
    ['Material weaknesses', mw],
    ['Significant deficiencies', sd],
    ['Deficiencies', d],
  ];
  const ix = XLSX.utils.aoa_to_sheet(index);
  ix['!cols'] = [{ wch: 30 }, { wch: 50 }];
  ix['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, ix, 'Summary');

  const roH = ['Control ID', 'Control', 'Readiness', 'Test items', 'Testing', 'Failed checks', 'Review', 'Conclusion', 'Severity', 'Finalized by'];
  const roR: (string | number)[][] = rollup.map(r => [
    r.c.id, r.c.name, r.readiness.label, r.items.length,
    r.testing.totalChecks === 0 ? 'Not started' : `${r.testing.completionPercent}%`,
    r.testing.failedChecks,
    r.review.status.replace(/_/g, ' '),
    r.conclusion.finalConclusion ? CONCLUSION_DISPLAY[r.conclusion.finalConclusion].label : (r.review.status === 'APPROVED' ? 'Pending' : 'Locked'),
    r.conclusion.severity?.value || '—',
    r.conclusion.finalizedBy || '—',
  ]);
  const ro = XLSX.utils.aoa_to_sheet([roH, ...roR]); ro['!cols'] = autofit([roH, ...roR]);
  XLSX.utils.book_append_sheet(wb, ro, 'Control Rollup');

  const failed = results.filter(r => r.result === 'FAIL');
  const fxH = ['Control', 'Sample', 'Attribute', 'Attribute name', 'Assertion', 'Source', 'Notes / AI justification'];
  const fxR: (string | number)[][] = failed.length
    ? failed.map(r => {
      const ctrl = controls.find(c => c.id === r.controlId);
      const attr = ctrl?.attributes.find(a => a.id === r.attributeId);
      const ti = testItems.find(t => t.id === r.testItemId);
      return [r.controlId, ti?.referenceId || '—', attr?.code || '?', attr?.name || '—', attr?.assertion || '—', r.source, r.notes || r.aiJustification || '—'];
    })
    : [['—', '—', '—', 'No failed attributes identified', '—', '—', '—']];
  const fx = XLSX.utils.aoa_to_sheet([fxH, ...fxR]); fx['!cols'] = autofit([fxH, ...fxR]);
  XLSX.utils.book_append_sheet(wb, fx, 'Exceptions');

  const svRollup = rollup.filter(r => r.conclusion.severity);
  const svH = ['Control', 'Severity', 'Likelihood', 'Magnitude', 'Materiality', 'MW indicators', 'Rationale', 'Classified by', 'Classified at'];
  const svR: (string | number)[][] = svRollup.length
    ? svRollup.map(r => {
      const s = r.conclusion.severity!;
      return [r.c.id, s.value, s.likelihood, s.magnitude, DEFAULT_MATERIALITY, s.mwIndicators.join('; ') || 'None', s.rationale, s.classifiedBy, s.classifiedAt];
    })
    : [['—', 'No deficiency severity classifications recorded', '—', 0, DEFAULT_MATERIALITY, '—', '—', '—', '—']];
  const sv = XLSX.utils.aoa_to_sheet([svH, ...svR]); sv['!cols'] = autofit([svH, ...svR]);
  XLSX.utils.book_append_sheet(wb, sv, 'Deficiency Severity');

  XLSX.writeFile(wb, `${fileSafe(engagement.name)} — Summary Report.xlsx`);
}
