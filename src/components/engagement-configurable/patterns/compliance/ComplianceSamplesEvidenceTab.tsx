// ─── Compliance — Samples & Evidence Tab ──────────────────────────────────
// Prepares test items and evidence before attribute testing.

import React, { useState } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Plus, X, Database, Layers,
  ClipboardCheck, Info, ChevronRight,
} from 'lucide-react';
import type { ConfigurableEngagement, ComplianceConfig } from '../../configurableEngagementTypes';
import { TestingInputMethod } from '../../configurableEngagementTypes';
import {
  deriveSamplesEvidenceSummary, EVIDENCE_TYPES,
  createUploadSamplesBatch, createPopulationBatch, createFullPopulationBatch,
  createDocumentBasedBatch, createWalkthroughBatch,
  deriveTestItemEvidenceStatus, deriveTestItemAttributeCoverage,
  getControlAttributes,
  type SamplesEvidenceState, type EvidenceItem, type SampleBatch,
} from './complianceSamplesEvidenceData';
import { MOCK_COMPLIANCE_CONTROLS } from './complianceControlScopeData';
import type { PBCRequest } from './complianceRequestsData';

const EV_STATUS_CLS = { ATTACHED: 'bg-emerald-50 text-emerald-700', NEEDS_MAPPING: 'bg-amber-50 text-amber-700', MISSING: 'bg-gray-100 text-gray-500' };
const TI_STATUS_CLS = { Missing: 'bg-gray-100 text-gray-500', Partial: 'bg-amber-50 text-amber-700', Ready: 'bg-emerald-50 text-emerald-700' };

const METHOD_LABELS: Record<string, string> = {
  UPLOAD_SELECTED_SAMPLES: 'Upload Selected Samples',
  GENERATE_SAMPLES_FROM_POPULATION: 'Generate Samples from Population',
  TEST_FULL_POPULATION: 'Test Full Population',
  DOCUMENT_BASED_TESTING: 'Document-Based Testing',
  NO_SAMPLE_BASED_TESTING: 'No Sample-Based Testing',
};

interface Props {
  engagement: ConfigurableEngagement;
  samplesEvidence: SamplesEvidenceState;
  pbcRequests: PBCRequest[];
  onAddBatch: (batch: SampleBatch) => void;
  onAddEvidence: (evidence: EvidenceItem) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function ComplianceSamplesEvidenceTab({ engagement, samplesEvidence, pbcRequests, onAddBatch, onAddEvidence, onNavigateTab }: Props) {
  const cfg = engagement.config as ComplianceConfig;
  const method = cfg.defaultTestingInputMethod;
  const summary = deriveSamplesEvidenceSummary(samplesEvidence);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [populationUploaded, setPopulationUploaded] = useState(false);

  const hasBatches = samplesEvidence.batches.length > 0;
  const receivedPBC = pbcRequests.filter(r => r.status === 'Received' || r.status === 'Partially Received');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Samples & Evidence</h3>
          <p className="text-[12px] text-text-muted">Prepare test items and attach supporting evidence before attribute testing.</p>
        </div>
        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold shrink-0">
          {METHOD_LABELS[method] || method}
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Batches', value: summary.batchCount },
          { label: 'Test Items', value: summary.testItemCount },
          { label: 'Evidence Files', value: summary.evidenceCount },
          { label: 'Mapped', value: summary.mapped, cls: 'text-emerald-600' },
          { label: 'Needs Mapping', value: summary.needsMapping, cls: summary.needsMapping > 0 ? 'text-amber-600' : '' },
          { label: 'Ready Items', value: `${summary.readyItems}/${summary.testItemCount}`, cls: summary.ready ? 'text-emerald-600' : 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
            <div className={`text-[16px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Input Method Panel */}
      {!hasBatches && (
        <InputMethodPanel method={method} onCreateBatch={onAddBatch} populationUploaded={populationUploaded} onUploadPopulation={() => setPopulationUploaded(true)} />
      )}

      {/* Test Items Preview */}
      {hasBatches && (
        <div className="space-y-3">
          {samplesEvidence.batches.map(batch => (
            <div key={batch.id} className="rounded-lg border border-border-light overflow-hidden">
              <div className="px-4 py-2.5 bg-surface-2/20 border-b border-border-light flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-semibold text-text">{batch.name}</div>
                  <div className="text-[10px] text-gray-400">{batch.sourceName} · {batch.sampleCount} items · {batch.uploadedAt}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold">{batch.status}</span>
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border-light/50 text-[9px] font-semibold text-gray-400 uppercase">
                    <th className="px-3 py-1.5 text-left">Test Item</th>
                    <th className="px-3 py-1.5 text-left">Reference</th>
                    <th className="px-3 py-1.5 text-left">Linked Control</th>
                    <th className="px-3 py-1.5 text-center">Evidence</th>
                    <th className="px-3 py-1.5 text-center">Attr Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.testItems.map(ti => {
                    const evStatus = deriveTestItemEvidenceStatus(ti, samplesEvidence.evidence);
                    const coverage = deriveTestItemAttributeCoverage(ti, samplesEvidence.evidence);
                    return (
                      <tr key={ti.id} className="border-b border-border-light/30">
                        <td className="px-3 py-2 font-mono text-gray-500 text-[10px]">{ti.referenceId}</td>
                        <td className="px-3 py-2 text-text">{ti.description}</td>
                        <td className="px-3 py-2 text-gray-500">{ti.linkedControlId}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${TI_STATUS_CLS[evStatus]}`}>{evStatus}</span>
                        </td>
                        <td className="px-3 py-2 text-center text-[10px] text-gray-500">{coverage.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Evidence Repository */}
      <div className="rounded-lg border border-border-light p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold text-text">Evidence Repository</h4>
          <button onClick={() => setShowEvidenceForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors">
            <Plus size={11} />Attach Evidence
          </button>
        </div>

        {showEvidenceForm && (
          <AttachEvidenceForm
            onSave={(ev) => { onAddEvidence(ev); setShowEvidenceForm(false); }}
            onCancel={() => setShowEvidenceForm(false)}
            testItems={samplesEvidence.batches.flatMap(b => b.testItems)}
          />
        )}

        {samplesEvidence.evidence.length === 0 ? (
          <div className="text-[11px] text-gray-400 italic py-4 text-center">No evidence attached yet. Use "Attach Evidence" or add received PBC files below.</div>
        ) : (
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border-light/50 text-[8px] font-semibold text-gray-400 uppercase">
                <th className="px-2 py-1.5 text-left">File</th>
                <th className="px-2 py-1.5 text-left">Type</th>
                <th className="px-2 py-1.5 text-left">Control</th>
                <th className="px-2 py-1.5 text-center">Attrs</th>
                <th className="px-2 py-1.5 text-center">Source</th>
                <th className="px-2 py-1.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {samplesEvidence.evidence.map(ev => (
                <tr key={ev.id} className="border-b border-border-light/30">
                  <td className="px-2 py-1.5 text-text flex items-center gap-1"><FileText size={10} className="text-gray-400 shrink-0" />{ev.fileName}</td>
                  <td className="px-2 py-1.5 text-gray-500">{ev.evidenceType}</td>
                  <td className="px-2 py-1.5 text-gray-500">{ev.linkedControlId}</td>
                  <td className="px-2 py-1.5 text-center">{ev.linkedAttributeIds.length}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-1 py-0.5 rounded text-[7px] font-bold ${ev.source === 'USER_UPLOADED' ? 'bg-gray-100 text-gray-600' : ev.source === 'RECEIVED_FROM_PBC' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                      {ev.source === 'USER_UPLOADED' ? 'User' : ev.source === 'RECEIVED_FROM_PBC' ? 'PBC' : 'System'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EV_STATUS_CLS[ev.status]}`}>{ev.status === 'ATTACHED' ? 'Attached' : ev.status === 'NEEDS_MAPPING' ? 'Needs Mapping' : 'Missing'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PBC Received Files */}
      {receivedPBC.length > 0 && (
        <div className="rounded-lg border border-blue-200/50 bg-blue-50/20 p-4 space-y-2">
          <h4 className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5"><FileText size={12} />Received from PBC</h4>
          <div className="space-y-1">
            {receivedPBC.map(r => (
              <div key={r.id} className="flex items-center justify-between text-[10px]">
                <div>
                  <span className="text-text font-medium">{r.title}</span>
                  <span className="text-gray-400 ml-2">{r.filesReceived.length > 0 ? r.filesReceived.join(', ') : r.progressText || '—'}</span>
                </div>
                <button onClick={() => {
                  // Map PBC attributes: "All attributes" → all for that control, specific A/B/C → match by code
                  const ctrlAttrs = getControlAttributes(r.linkedControlId);
                  let mappedAttrIds: string[] = [];
                  if (r.linkedAttributes.toLowerCase().includes('all')) {
                    mappedAttrIds = ctrlAttrs.map(a => a.id);
                  } else {
                    const codes = r.linkedAttributes.split(',').map(s => s.trim().charAt(0).toUpperCase());
                    mappedAttrIds = ctrlAttrs.filter(a => codes.includes(a.code)).map(a => a.id);
                  }
                  // Map test items for this control
                  const ctrlTestItems = samplesEvidence.batches.flatMap(b => b.testItems).filter(ti => ti.linkedControlId === r.linkedControlId);
                  const testItemIds = ctrlTestItems.map(ti => ti.id);
                  const hasFullMapping = mappedAttrIds.length > 0 && testItemIds.length > 0;

                  r.filesReceived.forEach((f, i) => {
                    onAddEvidence({
                      id: `ev-pbc-${Date.now()}-${i}`,
                      fileName: f,
                      evidenceType: r.requestType === 'Sample File' ? 'System Report' : r.requestType === 'Approval Evidence' ? 'Approval Log' : 'Other',
                      linkedControlId: r.linkedControlId,
                      linkedAttributeIds: mappedAttrIds,
                      linkedTestItemIds: testItemIds,
                      uploadedBy: r.requestedFrom,
                      uploadedAt: new Date().toISOString().slice(0, 10),
                      source: 'RECEIVED_FROM_PBC',
                      status: hasFullMapping ? 'ATTACHED' : 'NEEDS_MAPPING',
                    });
                  });
                }} className="px-2 py-1 rounded text-[9px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">
                  Add to Evidence
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold text-text">Attribute Testing Readiness</h4>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${summary.ready ? 'bg-emerald-50 text-emerald-700' : summary.batchCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
            {summary.ready ? 'Ready' : summary.batchCount > 0 ? 'Partially Ready' : 'Not Ready'}
          </span>
        </div>
        <div className="space-y-1">
          {[
            { label: 'Control scope configured', ok: true },
            { label: 'At least one control ready', ok: true },
            { label: 'Sample/test items prepared', ok: hasBatches },
            { label: 'Evidence repository has mapped evidence', ok: summary.mapped > 0 },
            { label: 'All test items have evidence coverage', ok: summary.readyItems === summary.testItemCount && summary.testItemCount > 0 },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[10px]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => onNavigateTab?.('attr-testing')}
          disabled={!hasBatches}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Go to Attribute Testing <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Input Method Panel ───────────────────────────────────────────────────

function InputMethodPanel({ method, onCreateBatch, populationUploaded, onUploadPopulation }: {
  method: string; onCreateBatch: (b: SampleBatch) => void; populationUploaded: boolean; onUploadPopulation: () => void;
}) {
  const configs: Record<string, { icon: React.ElementType; title: string; desc: string; cta: string; onAction: () => void; secondary?: { cta: string; onAction: () => void; disabled?: boolean } }> = {
    [TestingInputMethod.UPLOAD_SELECTED_SAMPLES]: {
      icon: Upload, title: 'Upload Selected Samples',
      desc: 'Upload the selected sample list for this engagement. Each row becomes a test item.',
      cta: 'Upload Sample File', onAction: () => onCreateBatch(createUploadSamplesBatch()),
    },
    [TestingInputMethod.GENERATE_SAMPLES_FROM_POPULATION]: {
      icon: Database, title: 'Generate Samples from Population',
      desc: 'Upload full population and generate samples using a sampling method.',
      cta: populationUploaded ? 'Generate Samples' : 'Upload Population',
      onAction: populationUploaded ? () => onCreateBatch(createPopulationBatch()) : onUploadPopulation,
      ...(populationUploaded ? {} : { secondary: { cta: 'Generate Samples', onAction: () => {}, disabled: true } }),
    },
    [TestingInputMethod.TEST_FULL_POPULATION]: {
      icon: Layers, title: 'Test Full Population',
      desc: 'Workflow will test every record in the uploaded dataset.',
      cta: 'Upload Full Dataset', onAction: () => onCreateBatch(createFullPopulationBatch()),
    },
    [TestingInputMethod.DOCUMENT_BASED_TESTING]: {
      icon: FileText, title: 'Document-Based Testing',
      desc: 'Uploaded documents become the test items. Use this when there is no separate sample file.',
      cta: 'Upload Documents as Test Items', onAction: () => onCreateBatch(createDocumentBasedBatch()),
    },
    [TestingInputMethod.NO_SAMPLE_BASED_TESTING]: {
      icon: ClipboardCheck, title: 'No Sample-Based Testing',
      desc: 'Use this when the control is tested through one walkthrough or design review rather than samples.',
      cta: 'Create Design / Walkthrough Test', onAction: () => onCreateBatch(createWalkthroughBatch()),
    },
  };

  const cfg = configs[method];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <div className="rounded-xl border-2 border-dashed border-border-light p-6 text-center space-y-3">
      <div className="p-3 rounded-xl bg-primary/10 inline-flex"><Icon size={24} className="text-primary" /></div>
      <h4 className="text-[14px] font-semibold text-text">{cfg.title}</h4>
      <p className="text-[12px] text-text-muted max-w-md mx-auto">{cfg.desc}</p>
      <div className="flex items-center justify-center gap-2">
        <button onClick={cfg.onAction}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors">
          {cfg.cta}
        </button>
        {cfg.secondary && (
          <button onClick={cfg.secondary.onAction} disabled={cfg.secondary.disabled}
            className="px-4 py-2 rounded-lg border border-border-light text-[12px] font-medium text-text-muted cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {cfg.secondary.cta}
          </button>
        )}
      </div>
      {populationUploaded && method === TestingInputMethod.GENERATE_SAMPLES_FROM_POPULATION && (
        <div className="flex items-center justify-center gap-2 text-[10px] text-emerald-600">
          <CheckCircle2 size={11} />Population uploaded: invoice_population_fy26_q1.xlsx (10,000 records) · Method: Random · Sample size: 5
        </div>
      )}
    </div>
  );
}

// ─── Attach Evidence Form ─────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';

function AttachEvidenceForm({ onSave, onCancel, testItems }: { onSave: (ev: EvidenceItem) => void; onCancel: () => void; testItems: { id: string; referenceId: string; linkedControlId: string }[] }) {
  const [fileName, setFileName] = useState('');
  const [evidenceType, setEvidenceType] = useState('Invoice Copy');
  const [controlId, setControlId] = useState('C001');
  const [selectedAttrIds, setSelectedAttrIds] = useState<Set<string>>(new Set());
  const [selectedTestItemIds, setSelectedTestItemIds] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<'USER_UPLOADED' | 'RECEIVED_FROM_PBC'>('USER_UPLOADED');

  const controls = MOCK_COMPLIANCE_CONTROLS.filter(c => c.attributes.length > 0);
  const controlAttrs = getControlAttributes(controlId);
  const controlTestItems = testItems.filter(ti => ti.linkedControlId === controlId);

  const handleControlChange = (newId: string) => {
    setControlId(newId);
    setSelectedAttrIds(new Set());
    setSelectedTestItemIds(new Set());
  };

  const toggleAttr = (id: string) => {
    setSelectedAttrIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleTestItem = (id: string) => {
    setSelectedTestItemIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const linkedAttrs = Array.from(selectedAttrIds);
  const linkedTIs = Array.from(selectedTestItemIds);
  const isAttached = linkedAttrs.length > 0 && linkedTIs.length > 0;

  const handleSave = () => {
    if (!fileName.trim()) return;
    onSave({
      id: `ev-${Date.now()}`,
      fileName: fileName.trim(),
      evidenceType,
      linkedControlId: controlId,
      linkedAttributeIds: linkedAttrs,
      linkedTestItemIds: linkedTIs,
      uploadedBy: source === 'USER_UPLOADED' ? 'Auditor' : 'PBC',
      uploadedAt: new Date().toISOString().slice(0, 10),
      source,
      status: isAttached ? 'ATTACHED' : 'NEEDS_MAPPING',
    });
  };

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-[12px] font-bold text-text">Attach Evidence</h5>
        <button onClick={onCancel} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>File Name <span className="text-red-400">*</span></label>
          <input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="e.g. INV-1001_PO.pdf" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Evidence Type</label>
          <select value={evidenceType} onChange={e => setEvidenceType(e.target.value)} className={selectCls}>
            {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Linked Control</label>
          <select value={controlId} onChange={e => handleControlChange(e.target.value)} className={selectCls}>
            {controls.map(c => <option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Source</label>
          <select value={source} onChange={e => setSource(e.target.value as 'USER_UPLOADED' | 'RECEIVED_FROM_PBC')} className={selectCls}>
            <option value="USER_UPLOADED">User Uploaded</option>
            <option value="RECEIVED_FROM_PBC">Received from PBC</option>
          </select>
        </div>
      </div>
      {/* Attribute checkboxes */}
      <div>
        <label className={labelCls}>Linked Attributes</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {controlAttrs.length === 0 ? (
            <span className="text-[10px] text-gray-400 italic">No attributes for this control</span>
          ) : controlAttrs.map(a => (
            <label key={a.id} className="flex items-center gap-1.5 text-[10px] text-text cursor-pointer">
              <input type="checkbox" checked={selectedAttrIds.has(a.id)} onChange={() => toggleAttr(a.id)}
                className="w-3 h-3 rounded border-border accent-[#6a12cd] cursor-pointer" />
              <span className="font-bold text-primary">{a.code}</span> {a.name}
            </label>
          ))}
        </div>
      </div>
      {/* Test item checkboxes */}
      {controlTestItems.length > 0 && (
        <div>
          <label className={labelCls}>Linked Test Items</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {controlTestItems.map(ti => (
              <label key={ti.id} className="flex items-center gap-1.5 text-[10px] text-text cursor-pointer">
                <input type="checkbox" checked={selectedTestItemIds.has(ti.id)} onChange={() => toggleTestItem(ti.id)}
                  className="w-3 h-3 rounded border-border accent-[#6a12cd] cursor-pointer" />
                {ti.referenceId}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-gray-400">
          {isAttached ? 'Evidence will be marked as Attached' : 'Evidence will be marked as Needs Mapping (select attributes + test items)'}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!fileName.trim()}
            className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Attach
          </button>
        </div>
      </div>
    </div>
  );
}
