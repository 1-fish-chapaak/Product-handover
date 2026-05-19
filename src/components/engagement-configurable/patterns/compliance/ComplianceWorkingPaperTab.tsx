// ─── Compliance — Working Paper Tab ───────────────────────────────────────
// Read-only system-generated audit documentation. No editing/approval here.

import React, { useState } from 'react';
import {
  FileText, Download, Lock, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Info,
} from 'lucide-react';
import type { ConfigurableEngagement, ComplianceConfig } from '../../configurableEngagementTypes';
import { MOCK_COMPLIANCE_CONTROLS, type ScopeControl } from './complianceControlScopeData';
import type { ComplianceWorkspaceState } from './complianceRequestsData';
import { getControlAttributes } from './complianceSamplesEvidenceData';
import type { EvidenceItem, TestItem } from './complianceSamplesEvidenceData';
import { deriveComplianceSampleResult, deriveComplianceTestingSummary, type AttributeTestResult, type AttrTestResult } from './complianceAttributeTestingData';

const RESULT_CLS: Record<AttrTestResult, string> = { NOT_TESTED: 'bg-gray-100 text-gray-500', PASS: 'bg-emerald-50 text-emerald-700', FAIL: 'bg-red-50 text-red-700', NA: 'bg-blue-50 text-blue-600' };
const RESULT_LABEL: Record<AttrTestResult, string> = { NOT_TESTED: '—', PASS: 'P', FAIL: 'F', NA: 'N/A' };
const SAMPLE_CLS = { PASS: 'bg-emerald-50 text-emerald-700', FAIL: 'bg-red-50 text-red-700', PENDING: 'bg-gray-100 text-gray-500' };
const TI_EV_CLS = { Missing: 'bg-gray-100 text-gray-500', Partial: 'bg-amber-50 text-amber-700', Complete: 'bg-emerald-50 text-emerald-700' };

interface Props {
  engagement: ConfigurableEngagement;
  complianceState: ComplianceWorkspaceState;
  onNavigateTab?: (tabId: string) => void;
}

export default function ComplianceWorkingPaperTab({ engagement, complianceState, onNavigateTab }: Props) {
  const cfg = engagement.config as ComplianceConfig;
  const testItems = complianceState.samplesEvidence.batches.flatMap(b => b.testItems);
  const evidence = complianceState.samplesEvidence.evidence;
  const results = complianceState.attributeTesting.results;
  const requests = complianceState.requests;

  // Controls with test items
  const controlIdsWithItems = [...new Set(testItems.map(ti => ti.linkedControlId))];
  const controlsWithItems = MOCK_COMPLIANCE_CONTROLS.filter(c => controlIdsWithItems.includes(c.id));
  const [selectedControlId, setSelectedControlId] = useState(controlsWithItems[0]?.id || '');
  const selectedControl = MOCK_COMPLIANCE_CONTROLS.find(c => c.id === selectedControlId);

  const ctrlTestItems = testItems.filter(ti => ti.linkedControlId === selectedControlId);
  const ctrlResults = results.filter(r => r.controlId === selectedControlId);
  const ctrlEvidence = evidence.filter(e => e.linkedControlId === selectedControlId);
  const summary = deriveComplianceTestingSummary(ctrlResults);
  const attrLegend = (selectedControl?.attributes || []).map((a, i) => ({ ...a, code: a.code || String.fromCharCode(65 + i) }));
  const attrCodeMap = new Map(attrLegend.map(a => [a.id, a.code]));

  const [expandedEvSampleId, setExpandedEvSampleId] = useState<string | null>(null);
  const [expandedDetailSampleId, setExpandedDetailSampleId] = useState<string | null>(null);

  // Section component
  const Section = ({ num, title, children }: { num: number; title: string; children: React.ReactNode }) => (
    <div className="border-b border-border-light pb-4">
      <h5 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold inline-flex items-center justify-center">{num}</span>
        {title}
      </h5>
      {children}
    </div>
  );

  // Empty state
  if (testItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText size={24} className="text-gray-300 mb-3" />
        <h4 className="text-[14px] font-semibold text-text mb-1">Working Paper</h4>
        <p className="text-[12px] text-text-muted mb-4">Prepare samples/test items before working paper can be generated.</p>
        <button onClick={() => onNavigateTab?.('samples-evidence')}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors flex items-center gap-1">
          Go to Samples & Evidence <ChevronRight size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Working Paper</h3>
          <p className="text-[12px] text-text-muted">System-generated audit documentation for compliance control testing.</p>
        </div>
        <button onClick={() => alert('Draft working paper export will be connected later.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors shrink-0">
          <Download size={12} />Download Draft
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Controls', value: controlsWithItems.length },
          { label: 'Test Items', value: testItems.length },
          { label: 'Attributes', value: results.length > 0 ? [...new Set(results.map(r => r.attributeId))].length : 0 },
          { label: 'Evidence', value: evidence.length },
          { label: 'Checks', value: `${deriveComplianceTestingSummary(results).completedChecks}/${deriveComplianceTestingSummary(results).totalChecks}` },
        ].map(s => (
          <span key={s.label} className="px-2.5 py-1 rounded-lg bg-gray-50 border border-border-light text-[10px] text-text font-medium">
            {s.label}: <span className="font-bold tabular-nums">{s.value}</span>
          </span>
        ))}
        <span className="px-2.5 py-1 rounded-lg bg-gray-50 border border-border-light text-[10px] text-gray-500 font-medium">Review: <span className="font-bold">Not Submitted</span></span>
        <span className="px-2.5 py-1 rounded-lg bg-gray-50 border border-border-light text-[10px] text-gray-500 font-medium">Conclusion: <span className="font-bold">Locked</span></span>
      </div>

      {/* Control selector */}
      <div className="flex items-center gap-1">
        {controlsWithItems.map(c => (
          <button key={c.id} onClick={() => { setSelectedControlId(c.id); setExpandedEvSampleId(null); setExpandedDetailSampleId(null); }}
            className={`px-2.5 py-1 rounded-full text-[9px] font-semibold cursor-pointer transition-colors ${selectedControlId === c.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {c.id} — {c.name.length > 30 ? c.name.slice(0, 29) + '…' : c.name}
          </button>
        ))}
      </div>

      {!selectedControl || ctrlTestItems.length === 0 ? (
        <div className="text-center py-8 text-[12px] text-gray-400">No test items prepared for this control yet.</div>
      ) : (
        <div className="rounded-xl border border-border-light bg-white p-5 space-y-4">

          {/* 1. Header */}
          <Section num={1} title="Working Paper Header">
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div><span className="text-gray-400 block text-[10px]">Engagement</span><span className="text-text font-medium">{engagement.name}</span></div>
              <div><span className="text-gray-400 block text-[10px]">Framework</span><span className="text-text font-medium">{cfg.framework.replace(/_/g, ' ')}</span></div>
              <div><span className="text-gray-400 block text-[10px]">Audit Type</span><span className="text-text font-medium">{cfg.auditType}</span></div>
              <div><span className="text-gray-400 block text-[10px]">Audit Period</span><span className="text-text font-medium">{cfg.auditPeriodStart || '—'} to {cfg.auditPeriodEnd || '—'}</span></div>
              <div><span className="text-gray-400 block text-[10px]">Owner</span><span className="text-text font-medium">{engagement.owner}</span></div>
              <div><span className="text-gray-400 block text-[10px]">Reviewer</span><span className="text-text font-medium">{engagement.reviewer || '—'}</span></div>
            </div>
          </Section>

          {/* 2. Control Objective */}
          <Section num={2} title="Control Objective">
            <div className="text-[11px] space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-gray-400">{selectedControl.id}</span>
                <span className="font-semibold text-text">{selectedControl.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${selectedControl.nature === 'Preventive' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{selectedControl.nature}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${selectedControl.automation === 'Automated' ? 'bg-purple-50 text-purple-700' : selectedControl.automation === 'Hybrid' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{selectedControl.automation}</span>
              </div>
              <p className="text-text leading-relaxed">{selectedControl.description}</p>
            </div>
          </Section>

          {/* 3. Test Design */}
          <Section num={3} title="Test Design">
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div><span className="text-gray-400 block text-[10px]">Input Method</span><span className="text-text font-medium">{cfg.defaultTestingInputMethod.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span></div>
              <div><span className="text-gray-400 block text-[10px]">Test Items</span><span className="text-text font-medium tabular-nums">{ctrlTestItems.length}</span></div>
              <div><span className="text-gray-400 block text-[10px]">Testing Status</span><span className={`font-medium ${summary.completionPercent === 100 ? 'text-emerald-600' : summary.completedChecks > 0 ? 'text-amber-600' : 'text-gray-500'}`}>{summary.completionPercent === 100 ? 'Complete' : summary.completedChecks > 0 ? 'In Progress' : 'Not Started'} ({summary.completionPercent}%)</span></div>
            </div>
          </Section>

          {/* 4. Attribute Legend */}
          <Section num={4} title="Attribute Legend">
            <div className="rounded-lg border border-border-light overflow-hidden">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                  <th className="px-2 py-1.5 text-left w-8">Code</th>
                  <th className="px-2 py-1.5 text-left">Assertion</th>
                  <th className="px-2 py-1.5 text-left">Attribute</th>
                  <th className="px-2 py-1.5 text-left">Workflow</th>
                  <th className="px-2 py-1.5 text-left w-14">Type</th>
                  <th className="px-2 py-1.5 text-left">Evidence Req</th>
                </tr></thead>
                <tbody>
                  {attrLegend.map(a => {
                    const wf = a.workflowId ? selectedControl.workflows.find(w => w.id === a.workflowId) : null;
                    return (
                      <tr key={a.id} className="border-b border-border-light/50">
                        <td className="px-2 py-1.5 font-bold text-primary">{a.code}</td>
                        <td className="px-2 py-1.5"><span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold">{a.assertion}</span></td>
                        <td className="px-2 py-1.5 text-text">{a.name}</td>
                        <td className="px-2 py-1.5 text-gray-500">{wf?.name || '—'} {wf?.version || ''}</td>
                        <td className="px-2 py-1.5"><span className={`px-1 py-0.5 rounded text-[7px] font-bold ${wf?.type === 'Automated' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{wf?.type || 'Manual'}</span></td>
                        <td className="px-2 py-1.5 text-gray-500 text-[9px]">{wf?.type === 'Automated' || wf?.type === 'Hybrid' ? 'System + User' : 'User Evidence'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 5. Sample Data Summary */}
          <Section num={5} title="Sample Data Summary">
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div><span className="text-gray-400 block text-[10px]">Test Items</span><span className="text-text font-medium tabular-nums">{ctrlTestItems.length}</span></div>
              <div><span className="text-gray-400 block text-[10px]">Source</span><span className="text-text font-medium">{complianceState.samplesEvidence.batches[0]?.inputMethod || 'Uploaded'}</span></div>
              <div><span className="text-gray-400 block text-[10px]">Batch</span><span className="text-text font-medium">{complianceState.samplesEvidence.batches[0]?.name || '—'}</span></div>
            </div>
          </Section>

          {/* 6. Evidence Coverage Matrix */}
          <Section num={6} title="Evidence Coverage Matrix">
            <p className="text-[9px] text-gray-400 mb-2">Attribute columns show user/PBC-uploaded files. System Evidence shows workflow logs.</p>
            <div className="rounded-lg border border-border-light overflow-hidden">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                  <th className="px-2 py-1.5 text-left w-5"></th>
                  <th className="px-2 py-1.5 text-left">Sample</th>
                  {attrLegend.map(a => (
                    <th key={a.id} className="px-2 py-1.5 text-center"><span className="text-primary font-bold text-[9px]">{a.code}</span></th>
                  ))}
                  <th className="px-2 py-1.5 text-center">Sys</th>
                  <th className="px-2 py-1.5 text-center">Status</th>
                </tr></thead>
                <tbody>
                  {ctrlTestItems.map(ti => {
                    const isExp = expandedEvSampleId === ti.id;
                    const tiEvidence = ctrlEvidence.filter(e => e.linkedTestItemIds.includes(ti.id));
                    const userEv = tiEvidence.filter(e => e.source !== 'SYSTEM_GENERATED');
                    const sysEv = tiEvidence.filter(e => e.source === 'SYSTEM_GENERATED');
                    const userByAttr = new Map<string, number>();
                    userEv.forEach(e => e.linkedAttributeIds.forEach(aId => { const c = attrCodeMap.get(aId); if (c) userByAttr.set(c, (userByAttr.get(c) || 0) + 1); }));
                    const coveredCount = attrLegend.filter(a => (userByAttr.get(a.code) || 0) > 0 || sysEv.some(e => e.linkedAttributeIds.includes(a.id))).length;
                    const evStatus = tiEvidence.length === 0 ? 'Missing' : coveredCount === attrLegend.length ? 'Complete' : 'Partial';
                    return (
                      <React.Fragment key={ti.id}>
                        <tr className={`border-b border-border-light/50 cursor-pointer hover:bg-surface-2/20 ${isExp ? 'bg-surface-2/20' : ''}`}
                          onClick={() => setExpandedEvSampleId(isExp ? null : ti.id)}>
                          <td className="px-2 py-1.5 text-gray-400">{isExp ? <ChevronDown size={9} /> : <ChevronRight size={9} />}</td>
                          <td className="px-2 py-1.5 font-mono text-gray-500">{ti.referenceId}</td>
                          {attrLegend.map(a => (
                            <td key={a.id} className="px-2 py-1.5 text-center text-[8px]">
                              <span className={`font-medium ${(userByAttr.get(a.code) || 0) > 0 ? 'text-text' : 'text-gray-300'}`}>{userByAttr.get(a.code) || 0}</span>
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center text-[8px]"><span className={`font-medium ${sysEv.length > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{sysEv.length}</span></td>
                          <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${TI_EV_CLS[evStatus]}`}>{evStatus}</span></td>
                        </tr>
                        {isExp && tiEvidence.length > 0 && (
                          <tr><td colSpan={attrLegend.length + 4} className="p-0">
                            <div className="bg-surface-2/15 px-4 py-2 border-b border-border-light space-y-1.5">
                              {userEv.length > 0 && (<div>
                                <div className="text-[7px] font-semibold text-gray-400 uppercase mb-0.5">User / PBC Evidence</div>
                                {userEv.map(e => (
                                  <div key={e.id} className="flex items-center gap-2 text-[9px]">
                                    <span className="font-bold text-primary">{e.linkedAttributeIds.map(id => attrCodeMap.get(id) || '?').join(',')}</span>
                                    <span className="text-gray-500">{e.evidenceType}</span>
                                    <span className="text-text">{e.fileName}</span>
                                    <span className={`px-1 py-0.5 rounded text-[7px] font-bold ${e.source === 'RECEIVED_FROM_PBC' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>{e.source === 'RECEIVED_FROM_PBC' ? 'PBC' : 'User'}</span>
                                  </div>
                                ))}
                              </div>)}
                              {sysEv.length > 0 && (<div>
                                <div className="text-[7px] font-semibold text-blue-500 uppercase mb-0.5">System Evidence</div>
                                {sysEv.map(e => (
                                  <div key={e.id} className="flex items-center gap-2 text-[9px]">
                                    <span className="font-bold text-primary">{e.linkedAttributeIds.map(id => attrCodeMap.get(id) || '?').join(',')}</span>
                                    <span className="text-blue-500">{e.evidenceType}</span>
                                    <span className="text-blue-600">{e.fileName}</span>
                                  </div>
                                ))}
                              </div>)}
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 7. Attribute Testing Matrix */}
          <Section num={7} title="Attribute Testing Matrix">
            <div className="rounded-lg border border-border-light overflow-hidden">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                  <th className="px-2 py-1.5 text-left">Sample</th>
                  <th className="px-2 py-1.5 text-left">Reference</th>
                  {attrLegend.map(a => (
                    <th key={a.id} className="px-2 py-1.5 text-center"><span className="text-primary font-bold text-[9px]">{a.code}</span></th>
                  ))}
                  <th className="px-2 py-1.5 text-center">Result</th>
                </tr></thead>
                <tbody>
                  {ctrlTestItems.map(ti => {
                    const sr = deriveComplianceSampleResult(ti.id, results);
                    return (
                      <tr key={ti.id} className="border-b border-border-light/50">
                        <td className="px-2 py-1.5 font-mono text-gray-500">{ti.referenceId}</td>
                        <td className="px-2 py-1.5 text-text text-[9px] truncate max-w-[120px]">{ti.description}</td>
                        {attrLegend.map(a => {
                          const ar = ctrlResults.find(r => r.testItemId === ti.id && r.attributeId === a.id);
                          const r = ar?.result || 'NOT_TESTED';
                          return <td key={a.id} className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${RESULT_CLS[r]}`}>{RESULT_LABEL[r]}</span></td>;
                        })}
                        <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${SAMPLE_CLS[sr]}`}>{sr === 'PASS' ? 'Pass' : sr === 'FAIL' ? 'Fail' : 'Pending'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-1.5 text-[9px] text-gray-400">P = Attribute satisfied · F = Attribute not satisfied · — = Not tested · N/A = Not applicable</div>
          </Section>

          {/* 8. Sample-Level Testing Details */}
          <Section num={8} title="Sample-Level Testing Details">
            <div className="space-y-1">
              {ctrlTestItems.map(ti => {
                const isExp = expandedDetailSampleId === ti.id;
                const sr = deriveComplianceSampleResult(ti.id, results);
                const tiEvCount = ctrlEvidence.filter(e => e.linkedTestItemIds.includes(ti.id)).length;
                const attrSummaryText = attrLegend.map(a => {
                  const ar = ctrlResults.find(r => r.testItemId === ti.id && r.attributeId === a.id);
                  return `${a.code}:${RESULT_LABEL[ar?.result || 'NOT_TESTED']}`;
                }).join(' ');
                return (
                  <div key={ti.id} className="rounded-lg border border-border-light overflow-hidden">
                    <button onClick={() => setExpandedDetailSampleId(isExp ? null : ti.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-2/20 cursor-pointer transition-colors">
                      {isExp ? <ChevronDown size={9} className="text-gray-400 shrink-0" /> : <ChevronRight size={9} className="text-gray-400 shrink-0" />}
                      <span className="text-[10px] font-mono text-gray-500 shrink-0 w-[70px]">{ti.referenceId}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 ${SAMPLE_CLS[sr]}`}>{sr === 'PASS' ? 'Pass' : sr === 'FAIL' ? 'Fail' : 'Pending'}</span>
                      <span className="text-[8px] text-gray-400 shrink-0">{tiEvCount} ev</span>
                      <span className="flex items-center gap-1 ml-auto shrink-0">
                        {attrLegend.map(a => {
                          const ar = ctrlResults.find(r => r.testItemId === ti.id && r.attributeId === a.id);
                          const r = ar?.result || 'NOT_TESTED';
                          return <span key={a.id} className={`px-1 py-0.5 rounded text-[7px] font-bold ${RESULT_CLS[r]}`}>{a.code}:{RESULT_LABEL[r]}</span>;
                        })}
                      </span>
                    </button>
                    {isExp && (
                      <div className="border-t border-border-light bg-surface-2/15 px-3 py-2">
                        <table className="w-full text-[10px]">
                          <thead><tr className="text-[8px] font-semibold text-gray-400 uppercase">
                            <th className="text-left py-1 pr-2">Code</th>
                            <th className="text-left py-1 pr-2">Attribute</th>
                            <th className="text-left py-1 pr-2">Assertion</th>
                            <th className="text-center py-1 pr-2">Result</th>
                            <th className="text-center py-1 pr-2">User Ev</th>
                            <th className="text-center py-1 pr-2">Sys Ev</th>
                            <th className="text-left py-1">Notes</th>
                          </tr></thead>
                          <tbody>
                            {attrLegend.map(a => {
                              const ar = ctrlResults.find(r => r.testItemId === ti.id && r.attributeId === a.id);
                              const r = ar?.result || 'NOT_TESTED';
                              const tiEv = ctrlEvidence.filter(e => e.linkedTestItemIds.includes(ti.id) && e.linkedAttributeIds.includes(a.id));
                              const userEvCt = tiEv.filter(e => e.source !== 'SYSTEM_GENERATED').length;
                              const sysEvCt = tiEv.filter(e => e.source === 'SYSTEM_GENERATED').length;
                              return (
                                <tr key={a.id} className="border-t border-border-light/30">
                                  <td className="py-1 pr-2 font-bold text-primary">{a.code}</td>
                                  <td className="py-1 pr-2 text-text">{a.name}</td>
                                  <td className="py-1 pr-2"><span className="px-1 py-0.5 rounded bg-primary/10 text-primary text-[7px] font-bold">{a.assertion}</span></td>
                                  <td className="py-1 pr-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${RESULT_CLS[r]}`}>{RESULT_LABEL[r]}</span></td>
                                  <td className="py-1 pr-2 text-center text-gray-500">{userEvCt > 0 ? `${userEvCt}` : '—'}</td>
                                  <td className="py-1 pr-2 text-center text-blue-500">{sysEvCt > 0 ? `${sysEvCt}` : '—'}</td>
                                  <td className="py-1 text-gray-500 truncate max-w-[150px]">{ar?.notes || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* 9. PBC / Request Trace */}
          <Section num={9} title="PBC / Request Trace">
            {(() => {
              const ctrlRequests = requests.filter(r => r.linkedControlId === selectedControlId);
              if (ctrlRequests.length === 0) return <div className="text-[11px] text-gray-400 italic">No PBC requests linked to this control.</div>;
              return (
                <div className="rounded-lg border border-border-light overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                      <th className="px-2 py-1.5 text-left">Request</th>
                      <th className="px-2 py-1.5 text-left">Title</th>
                      <th className="px-2 py-1.5 text-left">Type</th>
                      <th className="px-2 py-1.5 text-left">From</th>
                      <th className="px-2 py-1.5 text-center">Status</th>
                      <th className="px-2 py-1.5 text-center">Files</th>
                      <th className="px-2 py-1.5 text-center">Due</th>
                    </tr></thead>
                    <tbody>
                      {ctrlRequests.map(r => (
                        <tr key={r.id} className="border-b border-border-light/50">
                          <td className="px-2 py-1.5 font-mono text-gray-500">{r.id}</td>
                          <td className="px-2 py-1.5 text-text">{r.title}</td>
                          <td className="px-2 py-1.5"><span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold">{r.requestType}</span></td>
                          <td className="px-2 py-1.5 text-gray-500">{r.requestedFrom}</td>
                          <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${r.status === 'Received' ? 'bg-emerald-50 text-emerald-700' : r.status === 'Overdue' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{r.status}</span></td>
                          <td className="px-2 py-1.5 text-center text-gray-500">{r.filesReceived.length || '—'}</td>
                          <td className="px-2 py-1.5 text-center font-mono text-gray-500">{r.dueDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </Section>

          {/* 10. Review & Approval */}
          <Section num={10} title="Review & Approval">
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 text-[11px] text-gray-500">
              <Info size={13} className="shrink-0 mt-0.5" />
              <span>This working paper has not been submitted for review yet. Review workflow will be implemented in the Review tab.</span>
            </div>
          </Section>

          {/* 11. Final Conclusion */}
          <div>
            <h5 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold inline-flex items-center justify-center">11</span>
              Final Conclusion
            </h5>
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 text-[11px] text-gray-500">
              <Lock size={13} className="shrink-0 mt-0.5" />
              <span>Control conclusion will be generated only after reviewer approval. Conclusion is currently locked.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
