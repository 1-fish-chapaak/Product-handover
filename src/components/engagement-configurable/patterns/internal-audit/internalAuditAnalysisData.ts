// ─── Internal Audit Analysis — Types & Helpers ────────────────────────────

export type AnalysisRunType = 'WORKFLOW' | 'QA_ANALYSIS' | 'DOCUMENT_REVIEW' | 'DATA_REVIEW';
export type AnalysisRunStatus = 'DRAFT' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type ExceptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ExceptionStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'CONVERTED_TO_OBSERVATION';
export type PotentialObsStatus = 'DRAFT' | 'READY_FOR_OBSERVATION' | 'DISMISSED';

export interface AnalysisException {
  id: string;
  severity: ExceptionSeverity;
  title: string;
  description: string;
  source: string;
  linkedFile: string;
  linkedScopeLabel: string;
  status: ExceptionStatus;
}

export interface AnalysisRun {
  id: string;
  runType: AnalysisRunType;
  title: string;
  linkedScopeType: string;
  linkedScopeLabel: string;
  inputFiles: string[];
  workflowName: string;
  question: string;
  status: AnalysisRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  runBy: string;
  summary: string;
  exceptions: AnalysisException[];
  createdAt: string;
}

export interface PotentialObservation {
  id: string;
  title: string;
  description: string;
  severity: ExceptionSeverity;
  sourceRunId: string;
  linkedExceptionIds: string[];
  linkedScopeLabel: string;
  status: PotentialObsStatus;
  createdAt: string;
}

export interface InternalAuditAnalysisState {
  runs: AnalysisRun[];
  potentialObservations: PotentialObservation[];
}

export const RUN_TYPE_LABELS: Record<AnalysisRunType, string> = {
  WORKFLOW: 'Workflow Run', QA_ANALYSIS: 'Q&A Analysis', DOCUMENT_REVIEW: 'Document Review', DATA_REVIEW: 'Data Review',
};
export const SEVERITY_CLS: Record<ExceptionSeverity, string> = {
  LOW: 'bg-gray-100 text-gray-600', MEDIUM: 'bg-blue-50 text-blue-700', HIGH: 'bg-amber-50 text-amber-700', CRITICAL: 'bg-red-50 text-red-700',
};
export const EX_STATUS_CLS: Record<ExceptionStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700', REVIEWED: 'bg-blue-50 text-blue-700', DISMISSED: 'bg-gray-100 text-gray-500', CONVERTED_TO_OBSERVATION: 'bg-emerald-50 text-emerald-700',
};

// ─── Mock Run Simulation ──────────────────────────────────────────────────

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export function simulateAnalysisRun(run: AnalysisRun, actor: string): AnalysisRun {
  const ts = now();
  const exceptions: AnalysisException[] = [];

  if (run.runType === 'WORKFLOW') {
    if (run.workflowName.toLowerCase().includes('duplicate')) {
      exceptions.push({ id: `ex-${Date.now()}-1`, severity: 'HIGH', title: 'Potential duplicate invoice detected', description: 'Duplicate invoice pattern identified for Vendor A invoice INV-1003. Same amount and date as INV-0987.', source: run.workflowName, linkedFile: run.inputFiles[0] || '—', linkedScopeLabel: run.linkedScopeLabel, status: 'OPEN' });
    }
    if (run.workflowName.toLowerCase().includes('vendor')) {
      exceptions.push({ id: `ex-${Date.now()}-2`, severity: 'HIGH', title: 'Bank account change lacks verification', description: 'Vendor bank account change for Vendor ID V-4521 lacks independent reviewer evidence. Only single approval found.', source: run.workflowName, linkedFile: run.inputFiles[0] || '—', linkedScopeLabel: run.linkedScopeLabel, status: 'OPEN' });
    }
    if (run.workflowName.toLowerCase().includes('match') || run.workflowName.toLowerCase().includes('po')) {
      exceptions.push({ id: `ex-${Date.now()}-3`, severity: 'MEDIUM', title: 'GRN quantity variance exceeds tolerance', description: 'GRN quantity for PO-2847 exceeds 5% tolerance. Variance of 8.3% detected without exception approval.', source: run.workflowName, linkedFile: run.inputFiles[0] || '—', linkedScopeLabel: run.linkedScopeLabel, status: 'OPEN' });
    }
    if (exceptions.length === 0) {
      exceptions.push({ id: `ex-${Date.now()}-4`, severity: 'LOW', title: 'Minor formatting issue in data', description: 'Data formatting inconsistency noted but no control impact.', source: run.workflowName, linkedFile: run.inputFiles[0] || '—', linkedScopeLabel: run.linkedScopeLabel, status: 'OPEN' });
    }
  } else if (run.runType === 'QA_ANALYSIS') {
    const q = run.question.toLowerCase();
    if (q.includes('approval') || q.includes('authorization')) {
      exceptions.push({ id: `ex-${Date.now()}-5`, severity: 'HIGH', title: 'Missing payment approval evidence', description: 'Payment approval evidence missing for 2 of 5 sampled transactions. Delegation matrix not consistently followed.', source: 'Q&A Analysis', linkedFile: run.inputFiles[0] || '—', linkedScopeLabel: run.linkedScopeLabel, status: 'OPEN' });
    } else {
      exceptions.push({ id: `ex-${Date.now()}-6`, severity: 'MEDIUM', title: 'Data analysis finding', description: `Analysis of "${run.question}" revealed potential process gap requiring further review.`, source: 'Q&A Analysis', linkedFile: run.inputFiles[0] || '—', linkedScopeLabel: run.linkedScopeLabel, status: 'OPEN' });
    }
  } else if (run.runType === 'DOCUMENT_REVIEW') {
    exceptions.push({ id: `ex-${Date.now()}-7`, severity: 'MEDIUM', title: 'SOP compliance gap', description: 'SOP requires maker-checker approval for vendor changes, but walkthrough evidence does not clearly show checker review step.', source: 'Document Review', linkedFile: run.inputFiles[0] || '—', linkedScopeLabel: run.linkedScopeLabel, status: 'OPEN' });
  } else {
    exceptions.push({ id: `ex-${Date.now()}-8`, severity: 'MEDIUM', title: 'Unusual transaction pattern', description: 'Unusual concentration of high-value transactions near period-end dates detected in invoice data.', source: 'Data Review', linkedFile: run.inputFiles[0] || '—', linkedScopeLabel: run.linkedScopeLabel, status: 'OPEN' });
  }

  const summaryText = `${run.inputFiles.length} file(s) analyzed. ${exceptions.length} exception(s) identified.`;

  return { ...run, status: 'COMPLETED', startedAt: ts, completedAt: ts, runBy: actor, summary: summaryText, exceptions };
}

export function deriveAnalysisSummary(state: InternalAuditAnalysisState) {
  const totalRuns = state.runs.length;
  const completedRuns = state.runs.filter(r => r.status === 'COMPLETED').length;
  const openExceptions = state.runs.flatMap(r => r.exceptions).filter(e => e.status === 'OPEN').length;
  const potObs = state.potentialObservations.length;
  const converted = state.potentialObservations.filter(o => o.status === 'READY_FOR_OBSERVATION').length;
  return { totalRuns, completedRuns, openExceptions, potObs, converted };
}
