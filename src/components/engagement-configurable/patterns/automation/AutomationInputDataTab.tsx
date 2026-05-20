// ─── Automation Project — Input Data Tab ──────────────────────────────────
// Upload or connect data for workflow automation runs.

import React, { useState } from 'react';
import {
  Plus, CheckCircle2, AlertCircle, ChevronRight, ChevronDown, X, FileText, Database,
  Image as ImageIcon, Layers, Info, Eye,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import {
  deriveInputDataReadiness, deriveInputDataSummary, SOURCE_TYPE_LABELS, SOURCE_STATUS_CLS,
  createExcelSource, createPDFSource, createSQLSource, createImageSource, createHybridSources,
  type AutomationInputDataState, type AutomationDataSource, type DataSourceType,
} from './automationInputData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';
const READINESS_CLS = { 'Not Ready': 'bg-gray-100 text-gray-600', 'Needs Mapping': 'bg-amber-50 text-amber-700', Ready: 'bg-emerald-50 text-emerald-700' };

const INPUT_METHODS: { type: DataSourceType; icon: React.ElementType; title: string; desc: string; creator: () => AutomationDataSource | AutomationDataSource[] }[] = [
  { type: 'EXCEL_CSV', icon: FileText, title: 'Excel / CSV', desc: 'Upload structured files such as ledgers, claim files, or reconciliation inputs.', creator: createExcelSource },
  { type: 'PDF', icon: FileText, title: 'PDF', desc: 'Upload invoices, policies, contracts, or supporting documents.', creator: createPDFSource },
  { type: 'SQL', icon: Database, title: 'SQL', desc: 'Connect to a database table or query output.', creator: createSQLSource },
  { type: 'IMAGE', icon: ImageIcon, title: 'Image', desc: 'Upload images for image analytics or forensic review.', creator: createImageSource },
  { type: 'HYBRID', icon: Layers, title: 'Hybrid', desc: 'Combine multiple input sources in one project.', creator: createHybridSources },
];

interface Props {
  engagement: ConfigurableEngagement;
  inputData: AutomationInputDataState;
  onUpdateInputData: (state: AutomationInputDataState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationInputDataTab({ engagement, inputData, onUpdateInputData, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const readiness = deriveInputDataReadiness(inputData);
  const summary = deriveInputDataSummary(inputData);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const addSource = (creator: () => AutomationDataSource | AutomationDataSource[]) => {
    const result = creator();
    const sources = Array.isArray(result) ? result : [result];
    const newIds = sources.map(s => s.id);
    onUpdateInputData({
      ...inputData,
      dataSources: [...inputData.dataSources, ...sources],
      selectedSourceIds: [...inputData.selectedSourceIds, ...newIds],
    });
  };

  const toggleSelect = (id: string) => {
    onUpdateInputData({
      ...inputData,
      selectedSourceIds: inputData.selectedSourceIds.includes(id)
        ? inputData.selectedSourceIds.filter(x => x !== id)
        : [...inputData.selectedSourceIds, id],
    });
  };

  const removeSource = (id: string) => {
    onUpdateInputData({
      ...inputData,
      dataSources: inputData.dataSources.filter(d => d.id !== id),
      selectedSourceIds: inputData.selectedSourceIds.filter(x => x !== id),
    });
  };

  const markReady = (id: string) => {
    onUpdateInputData({
      ...inputData,
      dataSources: inputData.dataSources.map(d => d.id === id ? { ...d, status: 'READY' as const, validationIssues: [] } : d),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Input Data</h3>
          <p className="text-[12px] text-text-muted">Upload or connect the data that will be used by workflows, Q&A analysis, and automation runs.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold">{SOURCE_TYPE_LABELS[cfg.inputType] || cfg.inputType}</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${READINESS_CLS[readiness]}`}>{readiness}</span>
        </div>
      </div>

      {/* Context */}
      <div className="rounded-lg border border-border-light p-3">
        <div className="grid grid-cols-4 gap-3 text-[11px]">
          <div><span className="text-gray-400 block text-[10px]">Project</span><span className="text-text font-medium">{engagement.name}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Input Type</span><span className="text-text font-medium">{SOURCE_TYPE_LABELS[cfg.inputType]}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Setup Mode</span><span className="text-text font-medium">{cfg.automationSetupMode.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Run Type</span><span className="text-text font-medium">{cfg.runType.replace(/_/g, ' ')}{cfg.frequency ? ` (${cfg.frequency})` : ''}</span></div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Sources', value: summary.totalSources },
          { label: 'Ready', value: summary.readySources, cls: 'text-emerald-600' },
          { label: 'Needs Mapping', value: summary.needsMapping, cls: summary.needsMapping > 0 ? 'text-amber-600' : '' },
          { label: 'Records/Items', value: summary.totalRecords },
          { label: 'Issues', value: summary.validationIssues, cls: summary.validationIssues > 0 ? 'text-red-600' : '' },
          { label: 'Selected', value: summary.selectedCount },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
            <div className={`text-[16px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Input method cards */}
      {inputData.dataSources.length === 0 && !inputData.proceedWithoutData && (
        <div className="grid grid-cols-3 gap-3">
          {INPUT_METHODS.filter(m => cfg.inputType === 'HYBRID' || m.type === cfg.inputType || m.type === 'HYBRID').map(m => {
            const Icon = m.icon;
            return (
              <button key={m.type} onClick={() => addSource(m.creator)}
                className="text-left rounded-xl border-2 border-dashed border-border-light p-4 hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all">
                <div className="p-2 rounded-lg bg-primary/10 inline-flex mb-2"><Icon size={16} className="text-primary" /></div>
                <div className="text-[12px] font-semibold text-text mb-0.5">{m.title}</div>
                <div className="text-[10px] text-gray-500">{m.desc}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Add more sources */}
      {inputData.dataSources.length > 0 && (
        <div className="flex items-center gap-2">
          {INPUT_METHODS.filter(m => cfg.inputType === 'HYBRID' || m.type === cfg.inputType || m.type === 'HYBRID').map(m => (
            <button key={m.type} onClick={() => addSource(m.creator)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors">
              <Plus size={10} />Add {m.title}
            </button>
          ))}
        </div>
      )}

      {/* Data sources table */}
      {inputData.dataSources.length > 0 && (
        <div className="rounded-lg border border-border-light overflow-hidden">
          <div className="px-4 py-2 bg-surface-2/20 border-b border-border-light"><h4 className="text-[11px] font-bold text-text">Data Sources ({inputData.dataSources.length})</h4></div>
          <table className="w-full text-[11px]">
            <thead><tr className="border-b border-border-light bg-surface-2/30 text-[9px] font-semibold text-gray-400 uppercase">
              <th className="px-3 py-1.5 text-center w-8">Sel</th>
              <th className="px-3 py-1.5 text-left">Source</th>
              <th className="px-3 py-1.5 text-center">Type</th>
              <th className="px-3 py-1.5 text-center">Records</th>
              <th className="px-3 py-1.5 text-center">Status</th>
              <th className="px-3 py-1.5 text-center">Issues</th>
              <th className="px-3 py-1.5 text-center">Action</th>
            </tr></thead>
            <tbody>{inputData.dataSources.map(ds => (
              <tr key={ds.id} className="border-b border-border-light/50">
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={inputData.selectedSourceIds.includes(ds.id)} onChange={() => toggleSelect(ds.id)}
                    className="w-3.5 h-3.5 rounded border-border accent-[#6a12cd] cursor-pointer" />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-text">{ds.name}</div>
                  <div className="text-[9px] text-gray-400">{ds.fileName || ds.connectionName || '—'}{ds.tags.length > 0 ? ` · ${ds.tags.join(', ')}` : ''}</div>
                </td>
                <td className="px-3 py-2 text-center"><span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold">{SOURCE_TYPE_LABELS[ds.sourceType]}</span></td>
                <td className="px-3 py-2 text-center text-gray-500 tabular-nums">{ds.recordCount || ds.pageCount || ds.imageCount || '—'}</td>
                <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${SOURCE_STATUS_CLS[ds.status]}`}>{ds.status.replace(/_/g, ' ')}</span></td>
                <td className="px-3 py-2 text-center">{ds.validationIssues.length > 0 ? <span className="text-[10px] text-red-600 font-medium">{ds.validationIssues.length}</span> : <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setPreviewId(previewId === ds.id ? null : ds.id)} className="px-2 py-1 rounded text-[8px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors"><Eye size={9} /></button>
                    {ds.status === 'NEEDS_MAPPING' && <button onClick={() => markReady(ds.id)} className="px-2 py-1 rounded text-[8px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors">Ready</button>}
                    <button onClick={() => removeSource(ds.id)} className="px-2 py-1 rounded text-[8px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 cursor-pointer transition-colors"><X size={9} /></button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Preview panel */}
      {previewId && (() => {
        const ds = inputData.dataSources.find(d => d.id === previewId);
        return ds ? <DataSourcePreview key={previewId} ds={ds} onClose={() => setPreviewId(null)} /> : null;
      })()}

      {/* Input notes */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Input Notes</h4>
        <textarea value={inputData.inputNotes} onChange={e => onUpdateInputData({ ...inputData, inputNotes: e.target.value })}
          rows={3} placeholder="Data assumptions, known limitations, source owner notes, reconciliation period..." className={inputCls + ' resize-none'} />
      </div>

      {/* Proceed without data */}
      <label className="flex items-center gap-2 text-[11px] text-text cursor-pointer">
        <input type="checkbox" checked={inputData.proceedWithoutData} onChange={e => onUpdateInputData({ ...inputData, proceedWithoutData: e.target.checked })}
          className="w-3.5 h-3.5 rounded border-border accent-[#6a12cd] cursor-pointer" />
        Proceed without input data for now
      </label>
      {inputData.proceedWithoutData && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
          <AlertCircle size={11} className="shrink-0 mt-0.5" />
          <span>Automation runs will require input data before execution unless Q&A/ad-hoc setup is used.</span>
        </div>
      )}

      {/* Readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold text-text">Input Data Readiness</h4>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${READINESS_CLS[readiness]}`}>{readiness}</span>
        </div>
        <div className="space-y-1">
          {[
            { label: 'At least one data source added', ok: inputData.dataSources.length > 0 || inputData.proceedWithoutData },
            { label: 'At least one source selected', ok: inputData.selectedSourceIds.length > 0 || inputData.proceedWithoutData },
            { label: 'Selected sources ready/connected', ok: inputData.dataSources.filter(d => inputData.selectedSourceIds.includes(d.id)).some(d => d.status === 'READY' || d.status === 'CONNECTED') || inputData.proceedWithoutData },
            { label: 'Mapping issues resolved', ok: !inputData.dataSources.filter(d => inputData.selectedSourceIds.includes(d.id)).some(d => d.status === 'NEEDS_MAPPING') || inputData.proceedWithoutData },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[10px]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => onNavigateTab?.('automation-setup')} disabled={readiness === 'Not Ready'}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Continue to Automation Setup <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Data Source Preview ──────────────────────────────────────────────────

function DataSourcePreview({ ds, onClose }: { ds: AutomationDataSource; onClose: () => void }) {
  return (
    <div className="rounded-xl border-2 border-primary/20 bg-white p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[13px] font-bold text-text">{ds.name}</h4>
          <p className="text-[10px] text-gray-400">{SOURCE_TYPE_LABELS[ds.sourceType]} · {ds.fileName || ds.connectionName || '—'}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-[10px]">
        <div><span className="text-gray-400 block text-[9px]">Status</span><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${SOURCE_STATUS_CLS[ds.status]}`}>{ds.status.replace(/_/g, ' ')}</span></div>
        <div><span className="text-gray-400 block text-[9px]">Records/Items</span><span className="text-text font-medium">{ds.recordCount || ds.pageCount || ds.imageCount || '—'}</span></div>
        <div><span className="text-gray-400 block text-[9px]">Uploaded</span><span className="text-text">{ds.uploadedAt} by {ds.uploadedBy}</span></div>
      </div>

      {ds.description && <div><span className="text-gray-400 text-[9px]">Description: </span><span className="text-[10px] text-text">{ds.description}</span></div>}

      {ds.validationIssues.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
          <AlertCircle size={11} className="shrink-0 mt-0.5" />
          <div>{ds.validationIssues.map((v, i) => <div key={i}>{v}</div>)}</div>
        </div>
      )}

      {ds.columns.length > 0 && (
        <div>
          <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Columns ({ds.columns.length})</h6>
          <div className="flex flex-wrap gap-1">{ds.columns.map(c => <span key={c} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-semibold">{c}</span>)}</div>
        </div>
      )}

      {ds.samplePreviewRows.length > 0 && (
        <div>
          <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Sample Data ({ds.samplePreviewRows.length} rows)</h6>
          <div className="rounded-lg border border-border-light overflow-hidden">
            <table className="w-full text-[9px]">
              <thead><tr className="border-b border-border-light bg-surface-2/30">
                {ds.columns.map(c => <th key={c} className="px-2 py-1 text-left text-[7px] font-semibold text-gray-400 uppercase">{c}</th>)}
              </tr></thead>
              <tbody>{ds.samplePreviewRows.map((row, i) => (
                <tr key={i} className="border-b border-border-light/50">
                  {row.map((cell, j) => <td key={j} className="px-2 py-1 text-text">{cell}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {ds.sourceType === 'IMAGE' && <div className="text-[10px] text-gray-500">{ds.imageCount} images in batch. Thumbnails will be available in automation setup.</div>}
      {ds.sourceType === 'SQL' && <div className="text-[10px] text-gray-500">Connection: {ds.connectionName}</div>}

      {ds.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">{ds.tags.map(t => <span key={t} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[8px]">{t}</span>)}</div>
      )}
    </div>
  );
}
