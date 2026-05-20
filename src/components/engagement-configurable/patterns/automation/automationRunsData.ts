// ─── Automation Runs — Types & Helpers ─────────────────────────────────────

export type AutoRunType = 'WORKFLOW' | 'DRAFT_WORKFLOW' | 'QA_ADHOC';
export type AutoRunStatus = 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type OutputType = 'REPORT_DATA' | 'EXCEPTION_LIST' | 'RECONCILIATION_OUTPUT' | 'DASHBOARD_METRICS' | 'DOWNLOADABLE_FILE';
export type ExceptionCategory = 'RECONCILIATION_MISMATCH' | 'DUPLICATE' | 'MISSING_DOCUMENT' | 'POLICY_VIOLATION' | 'DATA_QUALITY' | 'OTHER';
export type ExceptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ExceptionStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'CASE_CANDIDATE';
export type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

export interface AutomationRunOutput { id: string; outputType: OutputType; name: string; description: string; recordCount: number | null; exceptionsCount: number; summaryText: string; status: 'GENERATED' | 'NEEDS_REVIEW' | 'FAILED'; sourceWorkflowId?: string; sourceWorkflowName?: string }
export interface AutomationRunException {
  id: string; severity: ExceptionSeverity; title: string; description: string; sourceRecord: string; sourceFile: string;
  category: ExceptionCategory; status: ExceptionStatus; sourceWorkflowId?: string; sourceWorkflowName?: string;
  deficiencyType?: string; assignedOwner?: string; reviewer?: string; dueDate?: string;
  triageNotes?: string; caseCandidateMarkedAt?: string; caseCandidateMarkedBy?: string;
}
export interface AutomationRunLog { id: string; timestamp: string; level: LogLevel; message: string }

export interface AutomationRun {
  id: string; runName: string; runType: AutoRunType; sourceSetupMode: string; workflowName: string;
  workflowIds?: string[]; workflowNames?: string[]; bulkRun?: boolean;
  inputSourceIds: string[]; status: AutoRunStatus; startedAt: string | null; completedAt: string | null;
  runBy: string; summary: string; processedRecords: number; exceptionCount: number; outputCount: number;
  outputs: AutomationRunOutput[]; exceptions: AutomationRunException[]; logs: AutomationRunLog[];
}

export interface AutomationRunsState { runs: AutomationRun[] }

export const RUN_STATUS_CLS: Record<AutoRunStatus, string> = {
  READY: 'bg-blue-50 text-blue-700', RUNNING: 'bg-purple-50 text-purple-700', COMPLETED: 'bg-emerald-50 text-emerald-700', FAILED: 'bg-red-50 text-red-700', CANCELLED: 'bg-gray-100 text-gray-500',
};
export const EX_SEVERITY_CLS: Record<ExceptionSeverity, string> = { LOW: 'bg-gray-100 text-gray-600', MEDIUM: 'bg-blue-50 text-blue-700', HIGH: 'bg-amber-50 text-amber-700', CRITICAL: 'bg-red-50 text-red-700' };
export const EX_STATUS_CLS: Record<ExceptionStatus, string> = { OPEN: 'bg-amber-50 text-amber-700', REVIEWED: 'bg-blue-50 text-blue-700', DISMISSED: 'bg-gray-100 text-gray-500', CASE_CANDIDATE: 'bg-purple-50 text-purple-700' };
export const EX_CAT_LABELS: Record<ExceptionCategory, string> = { RECONCILIATION_MISMATCH: 'Reconciliation Mismatch', DUPLICATE: 'Duplicate', MISSING_DOCUMENT: 'Missing Document', POLICY_VIOLATION: 'Policy Violation', DATA_QUALITY: 'Data Quality', OTHER: 'Other' };

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

// ─── Run Simulation ───────────────────────────────────────────────────────

import type { AutomationSetupState } from './automationSetupData';
import type { AutomationInputDataState } from './automationInputData';

function simulateWorkflow(wfName: string, wfId: string | undefined, records: number, ts: string, idx: number): { outputs: AutomationRunOutput[]; exceptions: AutomationRunException[]; log: string } {
  const n = wfName.toLowerCase();
  const exceptions: AutomationRunException[] = [];

  if (n.includes('reconcil') || n.includes('vendor') || n.includes('match')) {
    exceptions.push(
      { id: `ex-${Date.now()}-${idx}-1`, severity: 'HIGH', title: 'Vendor payment mismatch', description: 'Payment for Vendor A invoice INV-1003 does not match ledger amount.', sourceRecord: 'INV-1003', sourceFile: 'vendor_ledger_april.xlsx', category: 'RECONCILIATION_MISMATCH', status: 'OPEN', sourceWorkflowId: wfId, sourceWorkflowName: wfName },
      { id: `ex-${Date.now()}-${idx}-2`, severity: 'MEDIUM', title: 'Duplicate invoice pattern detected', description: 'Vendor A has two invoices for identical amount 45,000 within 4 days.', sourceRecord: 'INV-1001, INV-1003', sourceFile: 'vendor_ledger_april.xlsx', category: 'DUPLICATE', status: 'OPEN', sourceWorkflowId: wfId, sourceWorkflowName: wfName },
    );
  } else if (n.includes('duplicate') || n.includes('expense')) {
    exceptions.push({ id: `ex-${Date.now()}-${idx}-3`, severity: 'MEDIUM', title: 'Duplicate reimbursement claim', description: 'Expense claim EXP-442 appears twice.', sourceRecord: 'EXP-442', sourceFile: '', category: 'DUPLICATE', status: 'OPEN', sourceWorkflowId: wfId, sourceWorkflowName: wfName });
  } else if (n.includes('image') || n.includes('document')) {
    exceptions.push({ id: `ex-${Date.now()}-${idx}-5`, severity: 'HIGH', title: 'Missing supporting document', description: 'Missing images for verification.', sourceRecord: '', sourceFile: '', category: 'MISSING_DOCUMENT', status: 'OPEN', sourceWorkflowId: wfId, sourceWorkflowName: wfName });
  }

  // One merged workflow output per workflow run
  const summaryText = exceptions.length > 0
    ? `${records} records processed. ${exceptions.length} exception(s) identified.`
    : `${records} records processed. No exceptions found — clean execution.`;
  const outputs: AutomationRunOutput[] = [
    { id: `out-${Date.now()}-${idx}-1`, outputType: 'REPORT_DATA', name: `${wfName} Result`, description: summaryText, recordCount: records, exceptionsCount: exceptions.length, summaryText, status: 'GENERATED', sourceWorkflowId: wfId, sourceWorkflowName: wfName },
  ];

  return { outputs, exceptions, log: `Executed ${wfName}.` };
}

export function simulateRun(run: AutomationRun, setup: AutomationSetupState, inputData: AutomationInputDataState, actor: string): AutomationRun {
  const ts = now();
  const records = inputData.dataSources.filter(d => run.inputSourceIds.includes(d.id)).reduce((s, d) => s + (d.recordCount || d.pageCount || d.imageCount || 0), 0);
  const qaQ = (setup.qaSetup?.questions || []).join(' ').toLowerCase();

  const outputs: AutomationRunOutput[] = [];
  const exceptions: AutomationRunException[] = [];
  const logs: AutomationRunLog[] = [
    { id: `log-${Date.now()}-1`, timestamp: ts, level: 'INFO', message: 'Input validation completed.' },
  ];

  // Bulk workflow run
  const wfNames = run.workflowNames?.length ? run.workflowNames : (run.workflowName ? [run.workflowName] : []);
  const wfIds = run.workflowIds?.length ? run.workflowIds : [];
  if (wfNames.length > 0) {
    wfNames.forEach((wf, i) => {
      const result = simulateWorkflow(wf, wfIds[i], records, ts, i);
      outputs.push(...result.outputs);
      exceptions.push(...result.exceptions);
      logs.push({ id: `log-${Date.now()}-wf-${i}`, timestamp: ts, level: 'INFO', message: result.log });
    });
  } else if (qaQ) {
    // Q&A path — one merged output
    const isRecon = qaQ.includes('unmatched') || qaQ.includes('reconcil') || qaQ.includes('payment');
    const isDupe = qaQ.includes('duplicate');
    if (isRecon) {
      exceptions.push({ id: `ex-${Date.now()}-q1`, severity: 'HIGH', title: 'Vendor payment mismatch', description: 'Payment mismatch detected via Q&A.', sourceRecord: 'INV-1003', sourceFile: '', category: 'RECONCILIATION_MISMATCH', status: 'OPEN' });
    } else if (isDupe) {
      exceptions.push({ id: `ex-${Date.now()}-q2`, severity: 'MEDIUM', title: 'Duplicate detected via Q&A', description: 'Duplicate pattern found.', sourceRecord: '', sourceFile: '', category: 'DUPLICATE', status: 'OPEN' });
    }
    const qaSummary = exceptions.length > 0 ? `${records} records analyzed. ${exceptions.length} exception(s) identified.` : `${records} records analyzed. No exceptions found.`;
    outputs.push({ id: `out-${Date.now()}-q1`, outputType: 'REPORT_DATA', name: 'Q&A Analysis Result', description: qaSummary, recordCount: records, exceptionsCount: exceptions.length, summaryText: qaSummary, status: 'GENERATED' });
    logs.push({ id: `log-${Date.now()}-qa`, timestamp: ts, level: 'INFO', message: 'Q&A analysis executed.' });
  } else {
    outputs.push({ id: `out-${Date.now()}-g`, outputType: 'REPORT_DATA', name: 'Analysis Result', description: 'Completed.', recordCount: records || null, exceptionsCount: 0, summaryText: 'Analysis completed. No exceptions found.', status: 'GENERATED' });
  }

  logs.push(
    { id: `log-${Date.now()}-s1`, timestamp: ts, level: 'INFO', message: `${outputs.length} output(s) generated.` },
    { id: `log-${Date.now()}-s2`, timestamp: ts, level: exceptions.length > 0 ? 'WARNING' : 'INFO', message: `${exceptions.length} exception(s) identified.` },
  );

  const wfLabel = wfNames.length > 1 ? `Bulk run · ${wfNames.length} workflows` : wfNames[0] || 'Q&A Analysis';
  const summary = `${wfLabel}. ${records} record(s) processed. ${outputs.length} output(s) generated. ${exceptions.length} exception(s) found.`;

  return { ...run, status: 'COMPLETED', startedAt: ts, completedAt: ts, runBy: actor, summary, processedRecords: records, exceptionCount: exceptions.length, outputCount: outputs.length, outputs, exceptions, logs };
}

export function deriveRunsSummary(state: AutomationRunsState) {
  return {
    total: state.runs.length,
    completed: state.runs.filter(r => r.status === 'COMPLETED').length,
    failed: state.runs.filter(r => r.status === 'FAILED').length,
    openExceptions: state.runs.flatMap(r => r.exceptions).filter(e => e.status === 'OPEN').length,
    outputs: state.runs.reduce((s, r) => s + r.outputs.length, 0),
    lastStatus: state.runs.length > 0 ? state.runs[state.runs.length - 1].status : 'READY' as AutoRunStatus,
  };
}
