// ─── Automation Project — Reports Tab ─────────────────────────────────────
// Platform-style report matching existing Report module UX/theme.

import React, { useState, useMemo } from 'react';
import {
  Download, CheckCircle2, AlertCircle, ChevronRight, Lock, Share2,
  FileText, AlertTriangle, Workflow, BarChart3, Shield, Layout,
  Sparkles, TrendingUp, Eye, ListChecks, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationProjectWorkspaceState } from './automationInputData';
import type { AutomationRunOutput, AutomationRunException, AutomationRun } from './automationRunsData';
import { EX_SEVERITY_CLS, EX_CAT_LABELS } from './automationRunsData';
import { useShare, rectFromEvent } from '../../../../context/ShareContext';
import Gated from '../../../shared/Gated';
import {
  generateDraftReport, deriveReportReadiness, REPORT_STATUS_CLS,
  type AutomationReportsState, type AutomationReport, type ReportStatus,
} from './automationReportsData';
import { DEFICIENCY_LABELS, type DeficiencyType } from './automationCasesData';
import FloatingLines from '../../../shared/FloatingLines';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  automationState: AutomationProjectWorkspaceState;
  reportsState: AutomationReportsState;
  onUpdateReports: (state: AutomationReportsState) => void;
  onNavigateTab?: (tabId: string) => void;
}

// Group outputs/exceptions by workflow with rich findings & observations
interface WorkflowReportSection {
  workflowName: string;
  description: string;
  outputs: AutomationRunOutput[];
  exceptions: AutomationRunException[];
  findings: string[];
  observations: string[];
  totalRecords: number;
  caseCount: number;
  severityBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  status: 'CLEAN' | 'IN_REVIEW' | 'EXCEPTIONS_FOUND' | 'CASES_ASSIGNED';
  tags: string[];
}

// Derive a human description for workflow based on name patterns
function deriveWorkflowDescription(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('reconcil') || n.includes('vendor')) return 'Matches vendor ledger entries against payment records to detect unreconciled items, duplicate payments, and amount mismatches.';
  if (n.includes('expense') || n.includes('validation')) return 'Validates expense claims against policy limits, detects duplicate reimbursements, and flags policy violations.';
  if (n.includes('fop')) return 'Reconciles FOP data across multiple source systems and flags discrepancies for review.';
  if (n.includes('image') || n.includes('document')) return 'Analyzes uploaded documents and images for verification, flagging missing or anomalous records.';
  if (n.includes('mis') || n.includes('report')) return 'Aggregates structured data into management information reports with exception highlights.';
  if (n.includes('duplicate')) return 'Detects duplicate entries across vendors, dates, and amounts to identify potential fraud or processing errors.';
  return 'Automated workflow processing records and generating exception-based findings.';
}

// Derive tags for a workflow
function deriveWorkflowTags(name: string, exceptions: AutomationRunException[]): string[] {
  const n = name.toLowerCase();
  const tags: string[] = [];
  if (n.includes('reconcil') || n.includes('vendor') || n.includes('payment')) tags.push('FINANCIAL');
  if (n.includes('expense') || n.includes('policy')) tags.push('COMPLIANCE');
  if (n.includes('image') || n.includes('document')) tags.push('DOCUMENTATION');
  if (n.includes('fop') || n.includes('mis')) tags.push('DATA');
  if (n.includes('duplicate')) tags.push('FRAUD');
  const hasHigh = exceptions.some(e => e.severity === 'HIGH' || e.severity === 'CRITICAL');
  if (hasHigh) tags.push('HIGH');
  else if (exceptions.length > 0) tags.push('MEDIUM');
  return tags;
}

function buildWorkflowSections(state: AutomationProjectWorkspaceState): WorkflowReportSection[] {
  const completedRuns = state.runs.runs.filter(r => r.status === 'COMPLETED');
  const map = new Map<string, WorkflowReportSection>();

  // Track per-workflow records from runs
  const wfRecords = new Map<string, number>();
  for (const run of completedRuns) {
    const wfNames = run.workflowNames?.length ? run.workflowNames : (run.workflowName ? [run.workflowName] : []);
    const perWfRecords = wfNames.length > 0 ? Math.floor(run.processedRecords / wfNames.length) : run.processedRecords;
    for (const wf of wfNames) {
      wfRecords.set(wf, (wfRecords.get(wf) || 0) + perWfRecords);
    }
    for (const out of run.outputs) {
      const name = out.sourceWorkflowName || 'Unassigned';
      if (!map.has(name)) map.set(name, { workflowName: name, description: '', outputs: [], exceptions: [], findings: [], observations: [], totalRecords: 0, caseCount: 0, severityBreakdown: {}, categoryBreakdown: {}, status: 'CLEAN', tags: [] });
      map.get(name)!.outputs.push(out);
    }
    for (const ex of run.exceptions) {
      const name = ex.sourceWorkflowName || 'Unassigned';
      if (!map.has(name)) map.set(name, { workflowName: name, description: '', outputs: [], exceptions: [], findings: [], observations: [], totalRecords: 0, caseCount: 0, severityBreakdown: {}, categoryBreakdown: {}, status: 'CLEAN', tags: [] });
      map.get(name)!.exceptions.push(ex);
    }
  }

  // Enrich each section with findings, observations, and metadata
  for (const [name, section] of map) {
    section.description = deriveWorkflowDescription(name);
    section.totalRecords = wfRecords.get(name) || section.outputs.reduce((s, o) => s + (o.recordCount || 0), 0);
    section.tags = deriveWorkflowTags(name, section.exceptions);

    // Severity breakdown
    for (const ex of section.exceptions) {
      section.severityBreakdown[ex.severity] = (section.severityBreakdown[ex.severity] || 0) + 1;
      section.categoryBreakdown[EX_CAT_LABELS[ex.category]] = (section.categoryBreakdown[EX_CAT_LABELS[ex.category]] || 0) + 1;
    }

    // Count cases
    section.caseCount = state.cases.cases.filter(c => section.exceptions.some(e => e.id === c.sourceExceptionId)).length;

    // Derive status
    if (section.caseCount > 0) section.status = 'CASES_ASSIGNED';
    else if (section.exceptions.length > 0) section.status = 'EXCEPTIONS_FOUND';
    else section.status = 'CLEAN';
    // Override to IN_REVIEW if some exceptions are still OPEN
    if (section.exceptions.some(e => e.status === 'OPEN')) section.status = 'IN_REVIEW';

    // ── Findings (high-level summary statements) ──
    const high = section.exceptions.filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL');
    const medium = section.exceptions.filter(e => e.severity === 'MEDIUM');
    const caseCands = section.exceptions.filter(e => e.status === 'CASE_CANDIDATE');

    if (high.length > 0) section.findings.push(`${high.length} high/critical exception${high.length !== 1 ? 's' : ''} identified requiring immediate review`);
    if (medium.length > 0) section.findings.push(`${medium.length} medium-severity finding${medium.length !== 1 ? 's' : ''} detected`);

    const categories = new Set(section.exceptions.map(e => EX_CAT_LABELS[e.category]));
    if (categories.size > 0) section.findings.push(`Exception categories: ${Array.from(categories).join(', ')}`);

    if (caseCands.length > 0) section.findings.push(`${caseCands.length} exception${caseCands.length !== 1 ? 's' : ''} marked as case candidate${caseCands.length !== 1 ? 's' : ''} for follow-up`);

    if (section.exceptions.length === 0) section.findings.push('No exceptions identified — clean execution');

    // ── Observations (detailed, data-driven insights per workflow) ──
    const n = name.toLowerCase();
    const recLabel = section.totalRecords.toLocaleString();

    // Processing observation
    section.observations.push(`The workflow processed ${recLabel} records across ${section.outputs.length} output${section.outputs.length !== 1 ? 's' : ''}.`);

    // Category-specific observations
    if (n.includes('reconcil') || n.includes('vendor') || n.includes('match')) {
      const mismatches = section.exceptions.filter(e => e.category === 'RECONCILIATION_MISMATCH');
      const dupes = section.exceptions.filter(e => e.category === 'DUPLICATE');
      if (mismatches.length > 0) {
        section.observations.push(`${mismatches.length} reconciliation mismatch${mismatches.length !== 1 ? 'es' : ''} detected — vendor payment amounts do not match ledger records. Source records: ${mismatches.map(e => e.sourceRecord).filter(Boolean).join(', ') || 'multiple entries'}.`);
        section.observations.push(`Mismatches span ${mismatches.map(e => e.sourceFile).filter(Boolean).join(', ') || 'uploaded data files'} — both small and potentially high-value discrepancies identified.`);
      }
      if (dupes.length > 0) {
        section.observations.push(`${dupes.length} duplicate pattern${dupes.length !== 1 ? 's' : ''} detected across vendors — entries with identical amounts within close date ranges flagged for review.`);
      }
      if (mismatches.length === 0 && dupes.length === 0 && section.exceptions.length === 0) {
        section.observations.push('All vendor records reconciled successfully with no mismatches or duplicates — clean execution confirmed.');
      }
    } else if (n.includes('expense') || n.includes('validation')) {
      const dupes = section.exceptions.filter(e => e.category === 'DUPLICATE');
      const policyViolations = section.exceptions.filter(e => e.category === 'POLICY_VIOLATION');
      if (dupes.length > 0) {
        section.observations.push(`${dupes.length} duplicate reimbursement claim${dupes.length !== 1 ? 's' : ''} identified — same expense submitted multiple times. Records: ${dupes.map(e => e.sourceRecord).filter(Boolean).join(', ') || 'flagged entries'}.`);
      }
      if (policyViolations.length > 0) {
        section.observations.push(`${policyViolations.length} policy violation${policyViolations.length !== 1 ? 's' : ''} found — expenses exceed approved limits or lack proper authorization.`);
      }
      if (section.exceptions.length === 0) {
        section.observations.push('All expense claims validated against policy — no duplicates or violations detected.');
      }
    } else if (n.includes('image') || n.includes('document')) {
      const missing = section.exceptions.filter(e => e.category === 'MISSING_DOCUMENT');
      if (missing.length > 0) {
        section.observations.push(`${missing.length} missing document${missing.length !== 1 ? 's' : ''} flagged — required supporting documentation could not be verified.`);
      }
      if (section.exceptions.length === 0) {
        section.observations.push('All documents and images verified — no missing or anomalous records found.');
      }
    } else if (n.includes('duplicate')) {
      section.observations.push(`Widespread duplicates detected across vendors — with particularly high exposure in both frequency and value.`);
    } else if (section.exceptions.length > 0) {
      section.observations.push(`${section.exceptions.length} exception${section.exceptions.length !== 1 ? 's' : ''} flagged across ${Object.keys(section.categoryBreakdown).length} categor${Object.keys(section.categoryBreakdown).length !== 1 ? 'ies' : 'y'}.`);
    }

    // Exception detail observations
    for (const ex of section.exceptions) {
      section.observations.push(`${ex.title}: ${ex.description}`);
    }

    // Case follow-up observation
    if (section.caseCount > 0) {
      section.observations.push(`${section.caseCount} case${section.caseCount !== 1 ? 's' : ''} have been assigned for owner response and remediation tracking.`);
    }
  }

  return Array.from(map.values());
}

// Collapsible exception detail rows for a workflow section
function WorkflowExceptionDetails({ exceptions, automationState: _as, openExc, reviewedExc, dismissedExc, caseCandExc }: {
  exceptions: AutomationRunException[];
  automationState: AutomationProjectWorkspaceState;
  openExc: number; reviewedExc: number; dismissedExc: number; caseCandExc: number;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-2 cursor-pointer hover:text-text transition-colors">
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Exception Details ({exceptions.length})
      </button>
      {expanded && (
        <>
          <div className="flex items-center gap-3 text-[0.6875rem] mb-2">
            {openExc > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">{openExc} Open</span>}
            {reviewedExc > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{reviewedExc} Reviewed</span>}
            {dismissedExc > 0 && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{dismissedExc} Dismissed</span>}
            {caseCandExc > 0 && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{caseCandExc} Case Candidate{caseCandExc !== 1 ? 's' : ''}</span>}
          </div>
          <div className="space-y-1">
            {exceptions.map(ex => (
              <div key={ex.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2/20 text-[0.6875rem]">
                <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span>
                <span className="font-medium text-text flex-1">{ex.title}</span>
                <span className="text-text-muted">{EX_CAT_LABELS[ex.category]}</span>
                {ex.deficiencyType && <span className="text-text-muted">{DEFICIENCY_LABELS[ex.deficiencyType as DeficiencyType] || ex.deficiencyType}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AutomationReportsTab({ engagement, automationState, reportsState, onUpdateReports, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const hasReportOutput = cfg.outputTypes.includes('REPORT');
  const completedRuns = automationState.runs.runs.filter(r => r.status === 'COMPLETED');
  const { ready, checks } = deriveReportReadiness(automationState, cfg);
  const [selectedReportId, setSelectedReportId] = useState(reportsState.reports[0]?.id || '');
  const { openShare } = useShare();
  const selectedReport = reportsState.reports.find(r => r.id === selectedReportId);
  const workflowSections = useMemo(() => buildWorkflowSections(automationState), [automationState]);

  // Derived stats
  const allOutputs = completedRuns.flatMap(r => r.outputs);
  const allExceptions = completedRuns.flatMap(r => r.exceptions);
  const highCritical = allExceptions.filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL').length;
  const caseCandidates = allExceptions.filter(e => e.status === 'CASE_CANDIDATE').length;
  const totalRecords = completedRuns.reduce((s, r) => s + r.processedRecords, 0);
  const approvedCount = automationState.outputReview.approvedOutputIds.length;
  const excludedCount = automationState.outputReview.rejectedOutputIds.length;
  const pendingCount = allOutputs.length - approvedCount - excludedCount;
  const caseCount = automationState.cases.cases.length;
  const closedCases = automationState.cases.cases.filter(c => c.status === 'CLOSED').length;

  // Locked
  if (completedRuns.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Reports</h3><p className="text-[0.75rem] text-text-muted">Generate automation output reports.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Lock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[0.875rem] font-semibold text-text">Reports Locked</h4>
          <p className="text-[0.75rem] text-text-muted">Complete at least one automation run before generating a report.</p>
          <button onClick={() => onNavigateTab?.('workflows')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Go to Workflows <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

  const noApproved = automationState.outputReview.approvedOutputIds.length === 0;

  const handleGenerate = () => {
    const draft = generateDraftReport(engagement, automationState);
    const report: AutomationReport = { id: `rpt-${Date.now()}`, ...draft } as AutomationReport;
    onUpdateReports({ ...reportsState, reports: [...reportsState.reports, report] });
    setSelectedReportId(report.id);
  };

  const updateReport = (id: string, updates: Partial<AutomationReport>) => {
    onUpdateReports({ ...reportsState, reports: reportsState.reports.map(r => r.id === id ? { ...r, ...updates } : r) });
  };

  const markReady = (id: string) => {
    updateReport(id, { status: 'READY', history: [...(selectedReport?.history || []), { id: `rrh-${Date.now()}`, action: 'MARKED_READY', actor: engagement.owner, timestamp: now(), comments: '' }] });
  };

  const finalize = (id: string) => {
    updateReport(id, { status: 'FINAL', finalizedAt: now(), finalizedBy: engagement.owner, history: [...(selectedReport?.history || []), { id: `rrh-${Date.now()}`, action: 'FINALIZED', actor: engagement.owner, timestamp: now(), comments: 'Report finalized.' }] });
  };

  const isFinal = selectedReport?.status === 'FINAL';

  // No report generated yet
  if (reportsState.reports.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Reports</h3>
            <p className="text-[0.75rem] text-text-muted">Generate automation output reports from runs, outputs, exceptions, and cases.</p>
          </div>
        </div>

        {noApproved && hasReportOutput && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[0.625rem] text-amber-700">
            <AlertCircle size={11} className="shrink-0 mt-0.5" /><span>No approved outputs yet. Review and approve outputs before finalizing the report.</span>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-6 gap-2">
          {[
            { label: 'Runs', value: completedRuns.length },
            { label: 'Workflows', value: workflowSections.length },
            { label: 'Outputs', value: allOutputs.length },
            { label: 'Exceptions', value: allExceptions.length },
            { label: 'Cases', value: caseCount },
            { label: 'Approved', value: approvedCount, cls: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
              <div className={`text-[0.9375rem] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
              <div className="text-[0.5rem] text-gray-400 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <h4 className="text-[0.8125rem] font-semibold text-text">Generate Draft Report</h4>
          <p className="text-[0.6875rem] text-text-muted">Create a comprehensive report from completed runs, approved outputs, exceptions, and cases — grouped by workflow.</p>
          <button onClick={handleGenerate} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary-medium text-white text-[0.75rem] font-semibold hover:from-primary-hover hover:to-primary cursor-pointer transition-all">Generate Draft Report</button>
        </div>

      </div>
    );
  }

  // ── Report view (platform-style) ──
  return (
    <div className="space-y-5">
      {/* Report selector + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {reportsState.reports.map(r => (
            <button key={r.id} onClick={() => setSelectedReportId(r.id)}
              className={`px-2.5 py-1 rounded-full text-[0.625rem] font-semibold cursor-pointer transition-colors ${selectedReportId === r.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {r.title.length > 30 ? r.title.slice(0, 29) + '...' : r.title} <span className={`ml-1 px-1 py-0.5 rounded text-[0.4375rem] font-bold ${REPORT_STATUS_CLS[r.status]}`}>{r.status}</span>
            </button>
          ))}
          <button onClick={handleGenerate} className="px-2.5 py-1 rounded-full text-[0.625rem] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">+ New Report</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => alert('Apply Template — placeholder')} className="flex items-center gap-1.5 px-3 py-2 border border-border text-[0.75rem] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white rounded-lg">
            <Layout size={13} /> Apply Template
          </button>
          <Gated permission="rp_share" mode="disable" title="You don't have permission to share reports">
          <button onClick={(e) => { e.stopPropagation(); openShare({ type: 'report', id: selectedReportId, anchor: rectFromEvent(e) }); }} className="flex items-center gap-1.5 px-3 py-2 border border-border text-[0.75rem] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white rounded-lg">
            <Share2 size={13} /> Share
          </button>
          </Gated>
          <button onClick={() => alert('Download — placeholder')} className="flex items-center gap-1.5 px-3 py-2 border border-border text-[0.75rem] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white rounded-lg">
            <Download size={13} /> Download
          </button>
        </div>
      </div>

      {selectedReport && (
        <>
          {/* ── Purple report header/banner — matches platform style ── */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#3b0b72] to-[#6a12cd]" style={{ boxShadow: '0 4px 24px rgba(106,18,205,0.35)' }}>
            <div className="absolute inset-0 z-0" style={{ maskImage: 'linear-gradient(to right, transparent 35%, white 70%)', WebkitMaskImage: 'linear-gradient(to right, transparent 35%, white 70%)' }}>
              <FloatingLines
                enabledWaves={['top', 'middle']}
                lineCount={6}
                lineDistance={6}
                bendRadius={4}
                bendStrength={-0.3}
                interactive={true}
                parallax={false}
                color="#e879f9"
                opacity={0.3}
              />
            </div>
            <div className="relative z-10 px-8 py-7">
              <p className="text-white/50 text-[0.6875rem] font-semibold uppercase tracking-wider mb-1">Automation Project Report</p>
              <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{selectedReport.title}</h1>
              <p className="text-white/60 text-[0.8125rem] mb-3">{engagement.description || 'Comprehensive automation project report with workflow-wise results.'}</p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[0.8125rem]">
                  <span className="font-semibold text-white">{engagement.owner}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{selectedReport.generatedAt}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{workflowSections.length} workflow{workflowSections.length !== 1 ? 's' : ''}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{completedRuns.length} run{completedRuns.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-[10px] text-[0.6875rem] font-bold ${isFinal ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`}>
                    {selectedReport.status}
                  </span>
                  {!isFinal && (
                    <button
                      onClick={handleGenerate}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-primary bg-white rounded-[10px] hover:bg-white/90 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                    >
                      <Sparkles size={13} />
                      Regenerate
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Report metadata ── */}
          <div className="bg-white rounded-xl border border-border-light p-5">
            <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-[0.75rem]">
              <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Project Name</span><span className="text-text font-semibold">{engagement.name}</span></div>
              <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Business Process</span><span className="text-text font-semibold">{engagement.businessProcess || 'P2P'}</span></div>
              <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Entity</span><span className="text-text font-semibold">{engagement.entityOrLocation || '—'}</span></div>
              <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Data Period</span><span className="text-text font-semibold">{engagement.dataPeriodStart || '—'} to {engagement.dataPeriodEnd || '—'}</span></div>
              <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Run Type</span><span className="text-text font-semibold">{cfg.runType.replace(/_/g, ' ')}{cfg.frequency ? ` (${cfg.frequency})` : ''}</span></div>
              <div><span className="text-text-muted block text-[0.625rem] font-medium mb-0.5">Report Generated</span><span className="text-text font-semibold">{selectedReport.generatedAt}</span></div>
            </div>
          </div>

          {/* ── Executive Summary ── */}
          <div className="bg-white rounded-xl border border-border-light p-5">
            <h3 className="text-[0.8125rem] font-bold text-text mb-3 flex items-center gap-2"><FileText size={14} className="text-primary" /> Executive Summary</h3>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { icon: BarChart3, label: 'Records Processed', value: totalRecords.toLocaleString(), color: 'text-primary bg-primary/10' },
                { icon: AlertTriangle, label: 'Exceptions', value: allExceptions.length, color: 'text-high-700 bg-high-50' },
                { icon: Shield, label: 'Cases Assigned', value: caseCount, color: 'text-brand-700 bg-brand-50' },
                { icon: TrendingUp, label: 'Completion', value: caseCount > 0 ? `${Math.round(closedCases / caseCount * 100)}%` : allExceptions.length === 0 ? '100%' : '—', color: 'text-compliant-700 bg-compliant-50' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-border-light p-4 flex items-center gap-3 hover:shadow-md hover:shadow-primary/5 transition-all">
                  <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon size={16} /></div>
                  <div>
                    <div className="text-xl font-bold text-text">{stat.value}</div>
                    <div className="text-[0.625rem] text-text-muted tracking-wide">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[0.75rem] text-text-secondary leading-relaxed">{selectedReport.executiveSummary}</p>
            {/* Output approval breakdown */}
            <div className="mt-3 flex items-center gap-3 text-[0.6875rem]">
              <span className="text-text-muted">Outputs:</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{approvedCount} approved for report</span>
              {excludedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">{excludedCount} excluded</span>}
              {pendingCount > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">{pendingCount} pending review</span>}
            </div>
            {approvedCount === 0 && (
              <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[0.6875rem] text-amber-700">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span>No outputs have been approved for this report yet. Approve outputs in Output Review to include them.</span>
              </div>
            )}
          </div>

          {/* ── Per-Workflow Findings & Observations ── */}
          {workflowSections.map((section, sectionIdx) => {
            const approvedOuts = section.outputs.filter(o => automationState.outputReview.approvedOutputIds.includes(o.id));
            const openExc = section.exceptions.filter(e => e.status === 'OPEN').length;
            const reviewedExc = section.exceptions.filter(e => e.status === 'REVIEWED').length;
            const dismissedExc = section.exceptions.filter(e => e.status === 'DISMISSED').length;
            const caseCandExc = section.exceptions.filter(e => e.status === 'CASE_CANDIDATE').length;

            const TAG_CLS: Record<string, string> = {
              FINANCIAL: 'bg-blue-50 text-blue-700 border-blue-200',
              COMPLIANCE: 'bg-purple-50 text-purple-700 border-purple-200',
              DOCUMENTATION: 'bg-gray-100 text-gray-600 border-gray-200',
              DATA: 'bg-cyan-50 text-cyan-700 border-cyan-200',
              FRAUD: 'bg-red-50 text-red-700 border-red-200',
              HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
              MEDIUM: 'bg-yellow-50 text-yellow-700 border-yellow-200',
            };

            const STATUS_CLS: Record<string, { bg: string; text: string; label: string }> = {
              CLEAN: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Clean' },
              IN_REVIEW: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'In Review' },
              EXCEPTIONS_FOUND: { bg: 'bg-red-50', text: 'text-red-700', label: 'Exceptions Found' },
              CASES_ASSIGNED: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Cases Assigned' },
            };
            const statusStyle = STATUS_CLS[section.status] || STATUS_CLS.CLEAN;

            return (
              <div key={section.workflowName} className="bg-white rounded-xl border border-border-light overflow-hidden">
                {/* ── Workflow header with tags + status (like Image 1 query header) ── */}
                <div className="px-5 py-4 border-b border-border-light">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5"><Workflow size={16} /></div>
                    <div className="flex-1 min-w-0">
                      {/* Tags row */}
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[0.5625rem] font-bold text-primary/50 uppercase tracking-wider">WORKFLOW {sectionIdx + 1}</span>
                        <span className="text-gray-200 mx-0.5">·</span>
                        {section.tags.map(tag => (
                          <span key={tag} className={`px-1.5 py-0.5 rounded border text-[0.5rem] font-bold uppercase tracking-wide ${TAG_CLS[tag] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>{tag}</span>
                        ))}
                      </div>
                      <h4 className="text-[0.9375rem] font-bold text-text leading-tight">{section.workflowName}</h4>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[0.625rem] font-bold">{approvedOuts.length}/{section.outputs.length} approved</span>
                      <span className={`px-2.5 py-1 rounded-full text-[0.625rem] font-bold ${statusStyle.bg} ${statusStyle.text}`}>{statusStyle.label}</span>
                    </div>
                  </div>
                  {/* Workflow description */}
                  <p className="text-[0.75rem] text-text-secondary leading-relaxed mt-2 ml-[44px]">{section.description}</p>
                </div>

                <div className="p-5 space-y-5">
                  {/* ── Exception Metrics (mini stat cards like Image 1) ── */}
                  {section.exceptions.length > 0 ? (
                    <div>
                      <h5 className="text-[0.6875rem] font-bold text-text flex items-center gap-1.5 mb-2.5">
                        <AlertTriangle size={12} className="text-amber-500" /> Exception Metrics
                      </h5>
                      <div className="grid grid-cols-5 gap-2">
                        <div className="rounded-lg border border-border-light p-2.5 text-center">
                          <div className="text-[1rem] font-bold tabular-nums text-text">{section.exceptions.length}</div>
                          <div className="text-[0.5rem] text-gray-400 font-medium">Total</div>
                        </div>
                        <div className="rounded-lg border border-border-light p-2.5 text-center">
                          <div className="text-[1rem] font-bold tabular-nums text-red-600">{section.severityBreakdown['CRITICAL'] || 0}</div>
                          <div className="text-[0.5rem] text-gray-400 font-medium">Critical</div>
                        </div>
                        <div className="rounded-lg border border-border-light p-2.5 text-center">
                          <div className="text-[1rem] font-bold tabular-nums text-amber-600">{section.severityBreakdown['HIGH'] || 0}</div>
                          <div className="text-[0.5rem] text-gray-400 font-medium">High</div>
                        </div>
                        <div className="rounded-lg border border-border-light p-2.5 text-center">
                          <div className="text-[1rem] font-bold tabular-nums text-blue-600">{section.severityBreakdown['MEDIUM'] || 0}</div>
                          <div className="text-[0.5rem] text-gray-400 font-medium">Medium</div>
                        </div>
                        <div className="rounded-lg border border-border-light p-2.5 text-center">
                          <div className="text-[1rem] font-bold tabular-nums text-gray-500">{section.severityBreakdown['LOW'] || 0}</div>
                          <div className="text-[0.5rem] text-gray-400 font-medium">Low</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 text-[0.6875rem] text-emerald-700">
                      <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                      <span className="font-medium">Exception metrics not generated yet — clean execution with no exceptions identified.</span>
                    </div>
                  )}

                  {/* ── Findings (summary statements) ── */}
                  <div>
                    <h5 className="text-[0.6875rem] font-bold text-text flex items-center gap-1.5 mb-2">
                      <ListChecks size={12} className="text-primary" /> Findings
                    </h5>
                    <div className="space-y-1.5">
                      {section.findings.map((finding, fi) => (
                        <div key={fi} className="flex items-start gap-2 text-[0.75rem] text-text-secondary leading-relaxed">
                          <span className="text-primary mt-0.5 shrink-0 font-bold">{'>'}</span>
                          <span>{finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Observations (detailed data-driven insights — like Image 1) ── */}
                  <div>
                    <h5 className="text-[0.6875rem] font-bold text-text flex items-center gap-1.5 mb-2">
                      <Eye size={12} className="text-primary" /> Observations
                    </h5>
                    <div className="rounded-lg bg-surface-2/30 border border-border-light/60 p-4 space-y-2">
                      {section.observations.map((obs, oi) => (
                        <div key={oi} className="flex items-start gap-2.5 text-[0.75rem] text-text-secondary leading-relaxed">
                          <span className="text-primary mt-1 shrink-0">&#8226;</span>
                          <span>{obs}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Category breakdown (if exceptions exist) ── */}
                  {Object.keys(section.categoryBreakdown).length > 0 && (
                    <div>
                      <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-2">Exception Categories</h5>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(section.categoryBreakdown).map(([cat, count]) => (
                          <span key={cat} className="px-2.5 py-1 rounded-lg bg-surface-2 border border-border-light text-[0.6875rem] text-text font-medium">
                            {cat}: <span className="font-bold">{count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Exception detail rows (collapsible) ── */}
                  {section.exceptions.length > 0 && (
                    <WorkflowExceptionDetails
                      exceptions={section.exceptions}
                      automationState={automationState}
                      openExc={openExc} reviewedExc={reviewedExc} dismissedExc={dismissedExc} caseCandExc={caseCandExc}
                    />
                  )}

                  {/* ── Output list ── */}
                  <div>
                    <h5 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-2">Outputs</h5>
                    {section.outputs.length === 0 ? (
                      <p className="text-[0.75rem] text-text-muted italic">No outputs generated.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {section.outputs.map(o => {
                          const isApproved = automationState.outputReview.approvedOutputIds.includes(o.id);
                          const isExcluded = automationState.outputReview.rejectedOutputIds.includes(o.id);
                          const isPending = !isApproved && !isExcluded;
                          return (
                            <div key={o.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border border-border-light/50 ${isExcluded ? 'bg-gray-50 opacity-60' : isPending ? 'bg-amber-50/20' : 'bg-surface-2/30'}`}>
                              <FileText size={13} className={isApproved ? 'text-primary shrink-0' : 'text-gray-400 shrink-0'} />
                              <span className={`text-[0.75rem] font-medium flex-1 ${isExcluded ? 'text-gray-400 line-through' : 'text-text'}`}>{o.name}</span>
                              <span className="text-[0.625rem] text-text-muted">{o.outputType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                              {o.recordCount && <span className="text-[0.625rem] text-text-muted tabular-nums">{o.recordCount} records</span>}
                              {isApproved && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[0.5625rem] font-bold">Included in Report</span>}
                              {isExcluded && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[0.5625rem] font-bold">Excluded</span>}
                              {isPending && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[0.5625rem] font-bold">Pending Review</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Case/classification for this workflow */}
                  {section.caseCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50/50 border border-purple-100 text-[0.6875rem]">
                      <Shield size={12} className="text-purple-600" />
                      <span className="text-purple-700 font-medium">{section.caseCount} case{section.caseCount !== 1 ? 's' : ''} assigned from this workflow's exceptions</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Cases / Exception Classification Summary ── */}
          {caseCount > 0 && (
            <div className="bg-white rounded-xl border border-border-light p-5">
              <h3 className="text-[0.8125rem] font-bold text-text mb-3 flex items-center gap-2"><Shield size={14} className="text-primary" /> Cases & Classification Summary</h3>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: 'Total Cases', value: caseCount },
                  { label: 'Sent to Owner', value: automationState.cases.cases.filter(c => c.status === 'OPEN').length },
                  { label: 'Submitted', value: automationState.cases.cases.filter(c => c.status === 'RESOLVED').length },
                  { label: 'Closed', value: closedCases, cls: 'text-emerald-600' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
                    <div className={`text-[1rem] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
                    <div className="text-[0.5625rem] text-gray-400 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Deficiency breakdown */}
              {(() => {
                const defBreakdown = automationState.cases.cases.reduce<Record<string, number>>((acc, c) => {
                  const t = c.deficiencyType || 'Unclassified';
                  acc[t] = (acc[t] || 0) + 1;
                  return acc;
                }, {});
                const entries = Object.entries(defBreakdown);
                if (entries.length === 0) return null;
                return (
                  <div className="space-y-1">
                    <h5 className="text-[0.625rem] font-bold text-text-muted uppercase tracking-wider">Deficiency Classification</h5>
                    <div className="flex flex-wrap gap-2">
                      {entries.map(([type, count]) => (
                        <span key={type} className="px-2.5 py-1 rounded-lg bg-surface-2 border border-border-light text-[0.6875rem] text-text font-medium">
                          {DEFICIENCY_LABELS[type as DeficiencyType] || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}: <span className="font-bold">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Key Metrics ── */}
          <div className="bg-white rounded-xl border border-border-light p-5">
            <h3 className="text-[0.8125rem] font-bold text-text mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-primary" /> Key Metrics</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[0.75rem]">
              {[
                { label: 'Records Processed', value: totalRecords.toLocaleString() },
                { label: 'Outputs Generated', value: allOutputs.length },
                { label: 'Outputs Approved for Report', value: approvedCount },
                { label: 'Outputs Excluded', value: excludedCount },
                { label: 'Outputs Pending Review', value: pendingCount },
                { label: 'Exceptions Identified', value: allExceptions.length },
                { label: 'High/Critical Exceptions', value: highCritical },
                { label: 'Case Candidates', value: caseCandidates },
                { label: 'Cases Assigned', value: caseCount },
                { label: 'Cases Closed', value: closedCases },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-border-light/40">
                  <span className="text-text-muted">{m.label}</span>
                  <span className="text-text font-semibold tabular-nums">{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recommendations ── */}
          {selectedReport.recommendations && (
            <div className="bg-white rounded-xl border border-border-light p-5">
              <h3 className="text-[0.8125rem] font-bold text-text mb-2 flex items-center gap-2"><TrendingUp size={14} className="text-primary" /> Recommendations</h3>
              <ul className="space-y-1">
                {selectedReport.recommendations.split('\n').filter(Boolean).map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-[0.75rem] text-text-secondary leading-relaxed">
                    <span className="text-primary mt-1 shrink-0">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex items-center gap-3">
            {(selectedReport.status === 'DRAFT' || selectedReport.status === 'READY') && (
              <button onClick={() => finalize(selectedReport.id)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
                <CheckCircle2 size={13} />Finalize Report
              </button>
            )}
            {isFinal && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[0.6875rem] text-emerald-700 flex-1">
                <CheckCircle2 size={13} className="shrink-0 mt-0.5" /><span>Report finalized on {selectedReport.finalizedAt} by {selectedReport.finalizedBy}.</span>
              </div>
            )}
          </div>

          {/* ── History ── */}
          {selectedReport.history.length > 0 && (
            <div className="rounded-lg border border-border-light p-4">
              <h4 className="text-[0.6875rem] font-bold text-text mb-1">Report History</h4>
              <div className="space-y-1">{selectedReport.history.map(h => (
                <div key={h.id} className="text-[0.5625rem] text-gray-500"><span className="font-semibold text-text">{h.action}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>
              ))}</div>
            </div>
          )}

          {/* ── Report Notes ── */}
          <div className="rounded-lg border border-border-light p-4 space-y-2">
            <h4 className="text-[0.6875rem] font-bold text-text">Report Notes</h4>
            <textarea value={reportsState.reportNotes} onChange={e => onUpdateReports({ ...reportsState, reportNotes: e.target.value })} rows={2} placeholder="Report assumptions, notes..." className="w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none" />
          </div>

        </>
      )}
    </div>
  );
}
