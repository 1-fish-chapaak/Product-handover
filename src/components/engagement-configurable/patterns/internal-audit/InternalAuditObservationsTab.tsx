// ─── Internal Audit — Observations Tab ────────────────────────────────────
// Convert potential observations to formal findings. Mandatory section.

import DatePicker from '../../../shared/DatePicker';
import React, { useState } from 'react';
import {
  Plus, CheckCircle2, AlertCircle, AlertTriangle, ChevronRight, X, Info, XCircle, RotateCcw, Send,
} from 'lucide-react';
import type { ConfigurableEngagement, InternalAuditConfig } from '../../configurableEngagementTypes';
import type { InternalAuditAnalysisState, PotentialObservation } from './internalAuditAnalysisData';
import {
  validateObservationForDiscussion, deriveObservationsSummary,
  CATEGORY_LABELS, CATEGORIES_LIST, SEVERITIES_LIST, SEVERITY_CLS, STATUS_CLS,
  type InternalAuditObservationsState, type InternalAuditObservation,
  type ObservationCategory, type ObservationSeverity, type ObservationStatus,
} from './internalAuditObservationsData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[0.6875rem] font-semibold text-text-muted block mb-1';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

const KNOWN_CONTROLS = [
  'Three-Way PO/GRN/Invoice Matching',
  'Vendor Master Change Approval',
  'Duplicate Invoice Detection',
  'High-Value Payment Review',
  'PO Dual Sign-Off Authorization',
  'SOD Violation Detection',
  'Invoice Posting Authorization',
  'Duplicate Invoice Prevention',
  'AP Aging Threshold Alert',
  'Credit Memo Approval',
  'Revenue Recognition Compliance Check',
  'Sales Order Approval',
  'Journal Entry Anomaly Review',
  'Period-End Close Reconciliation',
];

interface Props {
  engagement: ConfigurableEngagement;
  analysisState: InternalAuditAnalysisState;
  observationsState: InternalAuditObservationsState;
  onUpdateObservations: (state: InternalAuditObservationsState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function InternalAuditObservationsTab({ engagement, analysisState, observationsState, onUpdateObservations, onNavigateTab }: Props) {
  const cfg = engagement.config as InternalAuditConfig;
  const summary = deriveObservationsSummary(observationsState);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [groupByControl, setGroupByControl] = useState(false);
  const [controlFilter, setControlFilter] = useState('');

  // Potential observations not yet converted or dismissed
  const unconvertedPotObs = analysisState.potentialObservations.filter(
    po => po.status === 'READY_FOR_OBSERVATION' && !observationsState.dismissedPotentialObsIds.includes(po.id)
      && !observationsState.observations.some(o => o.linkedExceptionIds.some(eid => po.linkedExceptionIds.includes(eid)))
  );

  const activeObs = observationsState.observations.filter(o => o.status !== 'DROPPED');
  // If observations were promoted after "no obs" was confirmed, override the confirmed state
  const effectiveNoObsConfirmed = observationsState.noObservationsConfirmed && activeObs.length === 0;
  const canConfirmNoObs = activeObs.length === 0 && !effectiveNoObsConfirmed;
  const canProceedToDiscussion = observationsState.observations.some(o => o.status === 'READY_FOR_DISCUSSION') || (effectiveNoObsConfirmed && activeObs.length === 0);

  const convertPotObs = (po: PotentialObservation) => {
    const obs: InternalAuditObservation = {
      id: `obs-${Date.now()}`, title: po.title, description: po.description,
      sourceType: 'ANALYSIS_EXCEPTION', sourceRunId: po.sourceRunId,
      linkedExceptionIds: po.linkedExceptionIds, linkedScopeLabel: po.linkedScopeLabel,
      severity: po.severity, riskRating: po.severity,
      observationCategory: 'CONTROL_GAP', rootCause: '', impact: '', recommendation: '',
      processOwner: cfg.processOwner || '', targetRemediationDate: '',
      status: 'DRAFT', createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10),
      history: [{ id: `oh-${Date.now()}`, action: 'CREATED', actor: engagement.owner, timestamp: now(), comments: 'Converted from analysis exception.' }],
    };
    onUpdateObservations({
      ...observationsState,
      observations: [...observationsState.observations, obs],
      noObservationsConfirmed: false,
    });
  };

  const dismissPotObs = (poId: string) => {
    onUpdateObservations({ ...observationsState, dismissedPotentialObsIds: [...observationsState.dismissedPotentialObsIds, poId] });
  };

  const addManualObs = (obs: InternalAuditObservation) => {
    onUpdateObservations({ ...observationsState, observations: [...observationsState.observations, obs], noObservationsConfirmed: false });
    setShowCreateForm(false);
  };

  const updateObs = (updated: InternalAuditObservation) => {
    onUpdateObservations({ ...observationsState, observations: observationsState.observations.map(o => o.id === updated.id ? updated : o) });
    setEditingId(null);
  };

  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const markReady = (id: string) => {
    const obs = observationsState.observations.find(o => o.id === id);
    if (!obs) return;
    const missing = validateObservationForDiscussion(obs);
    if (missing.length > 0) {
      setValidationMessage(`Cannot mark ready — missing: ${missing.join(', ')}. Click Edit to complete required fields.`);
      setTimeout(() => setValidationMessage(null), 5000);
      return;
    }
    setValidationMessage(null);
    updateObs({ ...obs, status: 'READY_FOR_DISCUSSION', updatedAt: new Date().toISOString().slice(0, 10), history: [...obs.history, { id: `oh-${Date.now()}`, action: 'MARKED_READY', actor: engagement.owner, timestamp: now(), comments: '' }] });
  };

  const dropObs = (id: string) => {
    const obs = observationsState.observations.find(o => o.id === id);
    if (!obs) return;
    updateObs({ ...obs, status: 'DROPPED', updatedAt: new Date().toISOString().slice(0, 10), history: [...obs.history, { id: `oh-${Date.now()}`, action: 'DROPPED', actor: engagement.owner, timestamp: now(), comments: '' }] });
  };

  const reopenObs = (id: string) => {
    const obs = observationsState.observations.find(o => o.id === id);
    if (!obs) return;
    updateObs({ ...obs, status: 'DRAFT', updatedAt: new Date().toISOString().slice(0, 10), history: [...obs.history, { id: `oh-${Date.now()}`, action: 'REOPENED', actor: engagement.owner, timestamp: now(), comments: '' }] });
  };

  const confirmNoObs = () => {
    onUpdateObservations({ ...observationsState, noObservationsConfirmed: true, noObservationsConfirmedBy: engagement.owner, noObservationsConfirmedAt: now() });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Observations</h3>
          <p className="text-[0.75rem] text-text-muted">Formalize audit findings from analysis exceptions or confirm no observations were noted.</p>
        </div>
        <button onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors shrink-0">
          <Plus size={12} />Create Observation
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Observations', value: summary.total },
          { label: 'Draft', value: summary.draft },
          { label: 'Ready', value: summary.readyForDiscussion, cls: summary.readyForDiscussion > 0 ? 'text-blue-600' : '' },
          { label: 'Critical/High', value: summary.criticalHigh, cls: summary.criticalHigh > 0 ? 'text-red-600' : '' },
          { label: 'From Analysis', value: summary.fromAnalysis },
          { label: 'No Obs.', value: summary.noObsConfirmed ? 'Yes' : '—', cls: summary.noObsConfirmed ? 'text-emerald-600' : '' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
            <div className={`text-[1rem] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[0.5625rem] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Potential observations from analysis */}
      {/* Validation message */}
      {validationMessage && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[0.6875rem] text-red-700">
          <AlertCircle size={13} className="shrink-0 mt-0.5" /><span>{validationMessage}</span>
        </div>
      )}

      {unconvertedPotObs.length > 0 && (
        <div className="rounded-lg border border-amber-200/50 bg-amber-50/20 p-4 space-y-2">
          <h4 className="text-[0.6875rem] font-bold text-amber-700 flex items-center gap-1.5"><AlertTriangle size={12} />Potential Observations from Analysis ({unconvertedPotObs.length})</h4>
          <div className="space-y-1.5">
            {unconvertedPotObs.map(po => (
              <div key={po.id} className="flex items-center justify-between rounded-lg border border-border-light bg-white px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${SEVERITY_CLS[po.severity]}`}>{po.severity}</span>
                    <span className="text-[0.6875rem] font-medium text-text">{po.title}</span>
                  </div>
                  <div className="text-[0.5625rem] text-gray-400 mt-0.5">{po.linkedScopeLabel} · {po.description.slice(0, 60)}...</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button onClick={() => convertPotObs(po)} className="px-2 py-1 rounded text-[0.5625rem] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">Convert</button>
                  <button onClick={() => dismissPotObs(po.id)} className="px-2 py-1 rounded text-[0.5625rem] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && <CreateObservationForm engagement={engagement} cfg={cfg} onSave={addManualObs} onCancel={() => setShowCreateForm(false)} />}

      {/* Observations table with control grouping/filter */}
      {observationsState.observations.length > 0 && (() => {
        // Derive workflow name for each observation from analysis runs
        const getWorkflowName = (obs: InternalAuditObservation) => {
          if (obs.sourceRunId) {
            const run = analysisState.runs.find(r => r.id === obs.sourceRunId);
            if (run?.workflowName) return run.workflowName;
          }
          return '';
        };
        const getControlName = (obs: InternalAuditObservation) => obs.linkedControlName || obs.linkedScopeLabel || 'General';

        // Derive unique control names for filter
        const controlNames = Array.from(new Set(observationsState.observations.map(o => getControlName(o)))).sort();

        // Filter by control
        const filteredObs = controlFilter
          ? observationsState.observations.filter(o => getControlName(o) === controlFilter)
          : observationsState.observations;

        // Group by control
        const controlGroups = new Map<string, InternalAuditObservation[]>();
        for (const obs of filteredObs) {
          const key = getControlName(obs);
          if (!controlGroups.has(key)) controlGroups.set(key, []);
          controlGroups.get(key)!.push(obs);
        }

        const renderObsRow = (obs: InternalAuditObservation) => {
          const wfName = getWorkflowName(obs);
          const ctrlName = getControlName(obs);
          return (
            <tr key={obs.id} className="border-b border-border-light/50">
              <td className="px-3 py-2">
                <div className="font-medium text-text">{obs.title}</div>
                <div className="text-[0.5625rem] text-gray-400 mt-0.5">
                  {CATEGORY_LABELS[obs.observationCategory]}
                  {!groupByControl && <> · <span className="text-primary/70 font-medium">{ctrlName}</span></>}
                  {wfName && <> · Workflow: {wfName}</>}
                </div>
              </td>
              <td className="px-3 py-2 text-center text-[0.5625rem] text-gray-500">{obs.sourceType === 'ANALYSIS_EXCEPTION' ? 'Analysis' : 'Manual'}</td>
              <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${SEVERITY_CLS[obs.severity]}`}>{obs.severity}</span></td>
              <td className="px-3 py-2 text-gray-500">{obs.processOwner || '—'}</td>
              <td className="px-3 py-2 text-center text-[0.625rem] font-mono text-gray-500">{obs.targetRemediationDate || '—'}</td>
              <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[0.5rem] font-bold ${STATUS_CLS[obs.status]}`}>{obs.status === 'READY_FOR_DISCUSSION' ? 'Ready' : obs.status.replace(/_/g, ' ')}</span></td>
              <td className="px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => setEditingId(obs.id)} className="px-2 py-1 rounded text-[0.5rem] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">Edit</button>
                  {obs.status === 'DRAFT' && <button onClick={() => markReady(obs.id)} className="px-2 py-1 rounded text-[0.5rem] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">Ready</button>}
                  {obs.status !== 'DROPPED' && <button onClick={() => dropObs(obs.id)} className="px-2 py-1 rounded text-[0.5rem] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">Drop</button>}
                  {obs.status === 'DROPPED' && <button onClick={() => reopenObs(obs.id)} className="px-2 py-1 rounded text-[0.5rem] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 cursor-pointer transition-colors">Reopen</button>}
                </div>
              </td>
            </tr>
          );
        };

        const tableHeader = (
          <thead><tr className="border-b border-border-light bg-surface-2/30 text-[0.5625rem] font-semibold text-gray-400 uppercase">
            <th className="px-3 py-1.5 text-left">Observation</th>
            <th className="px-3 py-1.5 text-center">Source</th>
            <th className="px-3 py-1.5 text-center">Severity</th>
            <th className="px-3 py-1.5 text-left">Owner</th>
            <th className="px-3 py-1.5 text-center">Target</th>
            <th className="px-3 py-1.5 text-center">Status</th>
            <th className="px-3 py-1.5 text-center">Action</th>
          </tr></thead>
        );

        return (
          <div className="space-y-3">
            {/* View toggle + control filter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-[0.6875rem] font-bold text-text">Formal Observations ({filteredObs.length})</h4>
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => { setGroupByControl(false); setControlFilter(''); }}
                    className={`px-2.5 py-1 rounded-full text-[0.625rem] font-semibold cursor-pointer transition-colors ${!groupByControl ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    All
                  </button>
                  <button onClick={() => setGroupByControl(true)}
                    className={`px-2.5 py-1 rounded-full text-[0.625rem] font-semibold cursor-pointer transition-colors ${groupByControl ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    Group by Control
                  </button>
                </div>
              </div>
              {/* Control filter chips */}
              {controlNames.length > 1 && !groupByControl && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[0.5625rem] text-gray-400 font-medium mr-1">Control:</span>
                  <button onClick={() => setControlFilter('')}
                    className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-semibold cursor-pointer transition-colors ${!controlFilter ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>All</button>
                  {controlNames.map(cn => (
                    <button key={cn} onClick={() => setControlFilter(controlFilter === cn ? '' : cn)}
                      className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-semibold cursor-pointer transition-colors truncate max-w-[140px] ${controlFilter === cn ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {cn.length > 20 ? cn.slice(0, 19) + '…' : cn}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Grouped view */}
            {groupByControl ? (
              <div className="space-y-3">
                {Array.from(controlGroups.entries()).map(([ctrlName, obs]) => {
                  const highCount = obs.filter(o => o.severity === 'HIGH' || o.severity === 'CRITICAL').length;
                  const readyCount = obs.filter(o => o.status === 'READY_FOR_DISCUSSION').length;
                  return (
                    <div key={ctrlName} className="rounded-xl border border-border-light bg-white overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-border-light bg-surface-2/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.75rem] font-semibold text-text">{ctrlName}</span>
                            <span className="text-[0.625rem] text-gray-400">{obs.length} observation{obs.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[0.5625rem]">
                            {highCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">{highCount} High/Critical</span>}
                            {readyCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">{readyCount} Ready</span>}
                          </div>
                        </div>
                      </div>
                      <table className="w-full text-[0.6875rem]">
                        {tableHeader}
                        <tbody>{obs.map(renderObsRow)}</tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Flat view */
              <div className="rounded-lg border border-border-light overflow-hidden">
                <table className="w-full text-[0.6875rem]">
                  {tableHeader}
                  <tbody>{filteredObs.map(renderObsRow)}</tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Edit panel */}
      {editingId && (() => {
        const obs = observationsState.observations.find(o => o.id === editingId);
        return obs ? <EditObservationPanel key={editingId} obs={obs} onSave={updateObs} onClose={() => setEditingId(null)} onMarkReady={() => markReady(obs.id)} /> : null;
      })()}

      {/* No observations confirmation */}
      {canConfirmNoObs && (
        <div className="rounded-lg border border-border-light p-4 text-center space-y-2">
          <h4 className="text-[0.75rem] font-semibold text-text">No Observations</h4>
          <p className="text-[0.6875rem] text-gray-500">If no audit findings were identified, confirm below.</p>
          <button onClick={confirmNoObs}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1.5">
            <CheckCircle2 size={13} />Confirm No Observations Noted
          </button>
        </div>
      )}
      {effectiveNoObsConfirmed && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[0.6875rem] text-emerald-700">
          <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
          <span>No observations noted — confirmed by {observationsState.noObservationsConfirmedBy} on {observationsState.noObservationsConfirmedAt}.</span>
        </div>
      )}
      {activeObs.length > 0 && !effectiveNoObsConfirmed && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-border-light text-[0.625rem] text-gray-500">
          <Info size={11} className="shrink-0 mt-0.5" />
          <span>Cannot confirm "No observations" while active observations exist.</span>
        </div>
      )}

      {/* Discussion readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[0.6875rem] font-bold text-text">Discussion Readiness</h4>
          <span className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-bold ${canProceedToDiscussion ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{canProceedToDiscussion ? 'Ready' : 'Not Ready'}</span>
        </div>
        <div className="space-y-1">
          {[
            { label: 'Potential observations reviewed', ok: unconvertedPotObs.length === 0 },
            { label: 'Observations created or no-obs confirmed', ok: observationsState.observations.length > 0 || effectiveNoObsConfirmed },
            { label: 'Observations marked ready for discussion', ok: observationsState.observations.some(o => o.status === 'READY_FOR_DISCUSSION') || effectiveNoObsConfirmed },
            { label: 'Process owners assigned', ok: activeObs.length === 0 || activeObs.every(o => o.processOwner.trim().length > 0) },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[0.625rem]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => onNavigateTab?.('discussion')} disabled={!canProceedToDiscussion}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Continue to Discussion <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Create Observation Form ──────────────────────────────────────────────

function CreateObservationForm({ engagement, cfg, onSave, onCancel }: {
  engagement: ConfigurableEngagement; cfg: InternalAuditConfig;
  onSave: (obs: InternalAuditObservation) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ObservationCategory | ''>('');
  const [severity, setSeverity] = useState<ObservationSeverity | ''>('');
  const [rootCause, setRootCause] = useState('');
  const [impact, setImpact] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [scopeLabel, setScopeLabel] = useState('');
  const [linkedControl, setLinkedControl] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: `obs-${Date.now()}`, title: title.trim(), description: description.trim(),
      sourceType: 'MANUAL', sourceRunId: '', linkedExceptionIds: [],
      linkedScopeLabel: scopeLabel.trim() || 'General',
      severity: severity || 'MEDIUM', riskRating: severity || 'MEDIUM', observationCategory: category || 'CONTROL_GAP',
      rootCause: rootCause.trim(), impact: impact.trim(), recommendation: recommendation.trim(),
      processOwner: cfg.processOwner || '', targetRemediationDate: targetDate,
      linkedControlName: linkedControl.trim() || undefined,
      status: 'DRAFT', createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10),
      history: [{ id: `oh-${Date.now()}`, action: 'CREATED', actor: engagement.owner, timestamp: now(), comments: 'Manual observation.' }],
    });
  };

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between"><h4 className="text-[0.8125rem] font-bold text-text">Create Observation</h4><button onClick={onCancel} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={labelCls}>Title <span className="text-red-400">*</span></label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Approval matrix not consistently followed" className={inputCls} /></div>
        <div className="col-span-2"><label className={labelCls}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Describe the finding..." className={inputCls + ' resize-none'} /></div>
        <div><label className={labelCls}>Category</label><select value={category} onChange={e => setCategory(e.target.value as ObservationCategory)} className={selectCls}><option value="">Select category...</option>{CATEGORIES_LIST.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></div>
        <div><label className={labelCls}>Severity</label><select value={severity} onChange={e => setSeverity(e.target.value as ObservationSeverity)} className={selectCls}><option value="">Select severity...</option>{SEVERITIES_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className={labelCls}>Root Cause</label><input value={rootCause} onChange={e => setRootCause(e.target.value)} placeholder="Why did this occur?" className={inputCls} /></div>
        <div><label className={labelCls}>Impact</label><input value={impact} onChange={e => setImpact(e.target.value)} placeholder="What is the risk/impact?" className={inputCls} /></div>
        <div><label className={labelCls}>Recommendation</label><input value={recommendation} onChange={e => setRecommendation(e.target.value)} placeholder="What should be done?" className={inputCls} /></div>
        <div><label className={labelCls}>Linked Scope</label><input value={scopeLabel} onChange={e => setScopeLabel(e.target.value)} placeholder="e.g. Payment Approval" className={inputCls} /></div>
        <div><label className={labelCls}>Link Control</label><select value={linkedControl} onChange={e => setLinkedControl(e.target.value)} className={selectCls}><option value="">Select control...</option>{KNOWN_CONTROLS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div><label className={labelCls}>Target Remediation</label><DatePicker value={targetDate} onChange={e => setTargetDate(e.target.value)} className={inputCls} /></div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border-light text-[0.6875rem] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={!title.trim()} className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Create</button>
      </div>
    </div>
  );
}

// ─── Edit Observation Panel ───────────────────────────────────────────────

function EditObservationPanel({ obs, onSave, onClose, onMarkReady }: {
  obs: InternalAuditObservation; onSave: (obs: InternalAuditObservation) => void; onClose: () => void; onMarkReady: () => void;
}) {
  const [draft, setDraft] = useState({ ...obs });
  const missing = validateObservationForDiscussion(draft);
  const update = <K extends keyof InternalAuditObservation>(f: K, v: InternalAuditObservation[K]) => setDraft(prev => ({ ...prev, [f]: v }));

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-white p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-[0.8125rem] font-bold text-text">Edit Observation</h4>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={labelCls}>Title</label><input value={draft.title} onChange={e => update('title', e.target.value)} className={inputCls} /></div>
        <div className="col-span-2"><label className={labelCls}>Description</label><textarea value={draft.description} onChange={e => update('description', e.target.value)} rows={2} className={inputCls + ' resize-none'} /></div>
        <div><label className={labelCls}>Category</label><select value={draft.observationCategory} onChange={e => update('observationCategory', e.target.value as ObservationCategory)} className={selectCls}>{CATEGORIES_LIST.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></div>
        <div><label className={labelCls}>Severity</label><select value={draft.severity} onChange={e => { update('severity', e.target.value as ObservationSeverity); update('riskRating', e.target.value as ObservationSeverity); }} className={selectCls}>{SEVERITIES_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className={labelCls}>Root Cause</label><input value={draft.rootCause} onChange={e => update('rootCause', e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Impact</label><input value={draft.impact} onChange={e => update('impact', e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Recommendation</label><input value={draft.recommendation} onChange={e => update('recommendation', e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Process Owner</label><input value={draft.processOwner} onChange={e => update('processOwner', e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Target Remediation</label><DatePicker value={draft.targetRemediationDate} onChange={e => update('targetRemediationDate', e.target.value)} className={inputCls} /></div>
      </div>
      {missing.length > 0 && draft.status === 'DRAFT' && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[0.625rem] text-amber-700">
          <AlertCircle size={11} className="shrink-0 mt-0.5" /><span>Missing for discussion: {missing.join(', ')}</span>
        </div>
      )}
      {obs.history.length > 0 && (
        <div><h6 className="text-[0.5625rem] font-bold text-gray-400 uppercase tracking-wider mb-1">History</h6>
          <div className="space-y-1">{obs.history.map(h => (
            <div key={h.id} className="text-[0.5625rem] text-gray-500"><span className="font-semibold text-text">{h.action}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>
          ))}</div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString().slice(0, 10), history: [...draft.history, { id: `oh-${Date.now()}`, action: 'UPDATED', actor: 'Auditor', timestamp: now(), comments: '' }] })}
          className="px-3 py-1.5 rounded-lg border border-border-light text-[0.6875rem] font-semibold text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Save Draft</button>
        {draft.status === 'DRAFT' && missing.length === 0 && (
          <button onClick={() => { onSave({ ...draft, status: 'READY_FOR_DISCUSSION', updatedAt: new Date().toISOString().slice(0, 10), history: [...draft.history, { id: `oh-${Date.now()}`, action: 'MARKED_READY', actor: 'Auditor', timestamp: now(), comments: 'Sent to process owner for discussion.' }] }); onClose(); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors"><Send size={11} />Send to Process Owner</button>
        )}
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border-light text-[0.6875rem] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
      </div>
    </div>
  );
}
