// ─── Internal Audit — Scope Tab ───────────────────────────────────────────
// Define what the audit assignment covers. Scope-first, not control-first.

import React, { useState } from 'react';
import {
  CheckCircle2, AlertCircle, ChevronRight, FileText, Workflow, ClipboardCheck, Info, Plus, X,
} from 'lucide-react';
import type { ConfigurableEngagement, InternalAuditConfig } from '../../configurableEngagementTypes';
import {
  BUSINESS_PROCESSES, SOPS, RACMS, CHECKLISTS, WORKFLOWS, SCOPE_LEVEL_LABELS,
  deriveIAScopeReadiness,
  type InternalAuditScopeState,
} from './internalAuditScopeData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';
const chipCls = 'px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-semibold';
const READINESS_CLS = { 'Draft Scope': 'bg-gray-100 text-gray-600', 'Needs Details': 'bg-amber-50 text-amber-700', 'Scope Ready': 'bg-emerald-50 text-emerald-700' };

interface Props {
  engagement: ConfigurableEngagement;
  scope: InternalAuditScopeState;
  onUpdateScope: (scope: InternalAuditScopeState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function InternalAuditScopeTab({ engagement, scope, onUpdateScope, onNavigateTab }: Props) {
  const cfg = engagement.config as InternalAuditConfig;
  const { status, checks } = deriveIAScopeReadiness(scope, engagement, cfg);
  const selectedBP = BUSINESS_PROCESSES.find(bp => bp.id === scope.businessProcessId);
  const predefinedSubProcesses = selectedBP?.subProcesses || [];
  const customSubProcsForBP = (scope.customSubProcesses || []).filter(c => c.businessProcessId === scope.businessProcessId);
  const allSubProcesses: { id: string; name: string; isCustom: boolean; activities: { id: string; name: string }[] }[] = [
    ...predefinedSubProcesses.map(sp => ({ ...sp, isCustom: false })),
    ...customSubProcsForBP.map(c => ({ id: c.id, name: c.name, isCustom: true, activities: [] })),
  ];
  const selectedSubProcesses = allSubProcesses.filter(sp => scope.subProcessIds.includes(sp.id));
  const availableActivities = selectedSubProcesses.flatMap(sp => sp.activities);

  const [showAddSubProc, setShowAddSubProc] = useState(false);
  const [newSubProcName, setNewSubProcName] = useState('');
  const [subProcValidation, setSubProcValidation] = useState('');

  const update = <K extends keyof InternalAuditScopeState>(field: K, value: InternalAuditScopeState[K]) =>
    onUpdateScope({ ...scope, [field]: value });

  const toggleMulti = (field: 'subProcessIds' | 'activityIds' | 'sopIds' | 'racmVersionIds' | 'checklistIds' | 'selectedWorkflowIds', id: string) => {
    const current = scope[field] as string[];
    update(field, current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  };

  const addCustomSubProcess = () => {
    const name = newSubProcName.trim();
    if (!name) { setSubProcValidation('Name is required.'); return; }
    if (allSubProcesses.some(sp => sp.name.toLowerCase() === name.toLowerCase())) { setSubProcValidation('A sub-process with this name already exists.'); return; }
    const id = `custom-subproc-${Date.now()}`;
    const custom = { id, name, businessProcessId: scope.businessProcessId, createdAt: new Date().toISOString().slice(0, 10), source: 'CUSTOM' as const };
    onUpdateScope({ ...scope, customSubProcesses: [...(scope.customSubProcesses || []), custom], subProcessIds: [...scope.subProcessIds, id] });
    setNewSubProcName('');
    setShowAddSubProc(false);
    setSubProcValidation('');
  };

  const removeCustomSubProcess = (id: string) => {
    onUpdateScope({
      ...scope,
      customSubProcesses: (scope.customSubProcesses || []).filter(c => c.id !== id),
      subProcessIds: scope.subProcessIds.filter(x => x !== id),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Scope</h3>
          <p className="text-[12px] text-text-muted">Define what this internal audit assignment will cover before announcement, IDR, and analysis.</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${READINESS_CLS[status]}`}>{status}</span>
      </div>

      {/* Context */}
      <div className="rounded-lg border border-border-light p-3">
        <div className="grid grid-cols-4 gap-3 text-[11px]">
          <div><span className="text-gray-400 block text-[10px]">Assignment</span><span className="text-text font-medium">{engagement.name}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Scope Level</span><span className="text-text font-medium">{SCOPE_LEVEL_LABELS[scope.scopeLevel]?.label || scope.scopeLevel}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Entity</span><span className="text-text font-medium">{engagement.entityOrLocation || '—'}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Process Owner</span><span className="text-text font-medium">{cfg.processOwner || '—'}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Left — Form */}
        <div className="col-span-3 space-y-4">
          {/* Scope Level */}
          <div className="rounded-lg border border-border-light p-4 space-y-2">
            <h4 className="text-[11px] font-bold text-text">Scope Level</h4>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SCOPE_LEVEL_LABELS).map(([key, { label }]) => (
                <button key={key} onClick={() => update('scopeLevel', key)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-all border-2 ${scope.scopeLevel === key ? 'border-primary bg-primary/10 text-primary' : 'border-border-light text-gray-500 hover:border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500">{SCOPE_LEVEL_LABELS[scope.scopeLevel]?.desc || ''}</p>
          </div>

          {/* Primary Scope */}
          <div className="rounded-lg border border-border-light p-4 space-y-3">
            <h4 className="text-[11px] font-bold text-text">Primary Scope</h4>
            <div>
              <label className={labelCls}>Business Process <span className="text-red-400">*</span></label>
              <select value={scope.businessProcessId} onChange={e => onUpdateScope({ ...scope, businessProcessId: e.target.value, subProcessIds: [], activityIds: [] })} className={selectCls}>
                <option value="">Select business process...</option>
                {BUSINESS_PROCESSES.map(bp => <option key={bp.id} value={bp.id}>{bp.code} — {bp.name}</option>)}
              </select>
            </div>

            {(predefinedSubProcesses.length > 0 || customSubProcsForBP.length > 0) && (scope.scopeLevel === 'SUB_PROCESS' || scope.scopeLevel === 'ACTIVITY' || scope.scopeLevel === 'PROCESS') && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls + ' mb-0'}>Sub-processes {scope.scopeLevel !== 'PROCESS' && <span className="text-red-400">*</span>}</label>
                  {scope.businessProcessId && <button onClick={() => { setShowAddSubProc(true); setSubProcValidation(''); }} className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold text-primary hover:bg-primary/10 cursor-pointer transition-colors"><Plus size={9} />Add Sub-process</button>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allSubProcesses.map(sp => (
                    <button key={sp.id} onClick={() => toggleMulti('subProcessIds', sp.id)}
                      className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors flex items-center gap-1 ${scope.subProcessIds.includes(sp.id) ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'}`}>
                      {sp.name}
                      {sp.isCustom && <span className="px-1 py-0 rounded text-[7px] font-bold bg-purple-50 text-purple-600">Custom</span>}
                      {sp.isCustom && scope.subProcessIds.includes(sp.id) && (
                        <span onClick={e => { e.stopPropagation(); removeCustomSubProcess(sp.id); }} className="ml-0.5 text-gray-400 hover:text-red-500 cursor-pointer"><X size={8} /></span>
                      )}
                    </button>
                  ))}
                </div>
                {showAddSubProc && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={newSubProcName} onChange={e => { setNewSubProcName(e.target.value); setSubProcValidation(''); }} placeholder="Sub-process name..." className="flex-1 px-3 py-1.5 border border-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-primary/40" onKeyDown={e => { if (e.key === 'Enter') addCustomSubProcess(); }} />
                    <button onClick={addCustomSubProcess} disabled={!newSubProcName.trim()} className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
                    <button onClick={() => { setShowAddSubProc(false); setNewSubProcName(''); setSubProcValidation(''); }} className="px-2 py-1.5 rounded text-[10px] text-gray-500 hover:text-text cursor-pointer">Cancel</button>
                  </div>
                )}
                {subProcValidation && <p className="text-[9px] text-red-500 mt-1">{subProcValidation}</p>}
              </div>
            )}
            {scope.businessProcessId && predefinedSubProcesses.length === 0 && customSubProcsForBP.length === 0 && (scope.scopeLevel === 'SUB_PROCESS' || scope.scopeLevel === 'ACTIVITY' || scope.scopeLevel === 'PROCESS') && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls + ' mb-0'}>Sub-processes {scope.scopeLevel !== 'PROCESS' && <span className="text-red-400">*</span>}</label>
                  <button onClick={() => { setShowAddSubProc(true); setSubProcValidation(''); }} className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold text-primary hover:bg-primary/10 cursor-pointer transition-colors"><Plus size={9} />Add Sub-process</button>
                </div>
                <p className="text-[10px] text-gray-400 italic">No predefined sub-processes for this business process. Add a custom one.</p>
                {showAddSubProc && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={newSubProcName} onChange={e => { setNewSubProcName(e.target.value); setSubProcValidation(''); }} placeholder="Sub-process name..." className="flex-1 px-3 py-1.5 border border-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-primary/40" onKeyDown={e => { if (e.key === 'Enter') addCustomSubProcess(); }} />
                    <button onClick={addCustomSubProcess} disabled={!newSubProcName.trim()} className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
                    <button onClick={() => { setShowAddSubProc(false); setNewSubProcName(''); setSubProcValidation(''); }} className="px-2 py-1.5 rounded text-[10px] text-gray-500 hover:text-text cursor-pointer">Cancel</button>
                  </div>
                )}
                {subProcValidation && <p className="text-[9px] text-red-500 mt-1">{subProcValidation}</p>}
              </div>
            )}

            {availableActivities.length > 0 && (scope.scopeLevel === 'ACTIVITY') && (
              <div>
                <label className={labelCls}>Activities <span className="text-red-400">*</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {availableActivities.map(a => (
                    <button key={a.id} onClick={() => toggleMulti('activityIds', a.id)}
                      className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors ${scope.activityIds.includes(a.id) ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'}`}>
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {scope.scopeLevel === 'SPECIFIC_ELEMENT' && (
              <div>
                <label className={labelCls}>Specific Elements</label>
                <textarea value={scope.specificElements} onChange={e => update('specificElements', e.target.value)} rows={2}
                  placeholder="e.g. Selected vendors, specific locations, transaction types..." className={inputCls + ' resize-none'} />
              </div>
            )}
          </div>

          {/* Scope Sources */}
          <div className="rounded-lg border border-border-light p-4 space-y-3">
            <h4 className="text-[11px] font-bold text-text">Scope Sources</h4>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>SOPs <span className="text-[9px] text-gray-400 font-normal ml-1">Recommended</span></label>
                <button onClick={() => alert('Upload SOP will be connected later.')} className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold text-primary hover:bg-primary/10 cursor-pointer transition-colors"><Plus size={9} />Upload SOP</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SOPS.map(s => (
                  <button key={s.id} onClick={() => toggleMulti('sopIds', s.id)}
                    className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors flex items-center gap-1 ${scope.sopIds.includes(s.id) ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'}`}>
                    <FileText size={9} />{s.name} <span className="text-[8px] text-gray-400">{s.version}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>Checklists <span className="text-[9px] text-gray-400 font-normal ml-1">Optional</span></label>
                <button onClick={() => alert('Upload Checklist will be connected later.')} className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold text-primary hover:bg-primary/10 cursor-pointer transition-colors"><Plus size={9} />Upload Checklist</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CHECKLISTS.map(c => (
                  <button key={c.id} onClick={() => toggleMulti('checklistIds', c.id)}
                    className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors flex items-center gap-1 ${scope.checklistIds.includes(c.id) ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'}`}>
                    <ClipboardCheck size={9} />{c.name} <span className="text-[8px] text-gray-400">{c.items} items</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>RACM <span className="text-[9px] text-gray-400 font-normal ml-1">Optional</span></label>
                <button onClick={() => alert('Upload RACM will be connected later.')} className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold text-primary hover:bg-primary/10 cursor-pointer transition-colors"><Plus size={9} />Upload RACM</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {RACMS.map(r => (
                  <button key={r.id} onClick={() => toggleMulti('racmVersionIds', r.id)}
                    className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors ${scope.racmVersionIds.includes(r.id) ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'}`}>
                    {r.name} <span className="text-[8px] text-gray-400">{r.version}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>Workflows <span className="text-[9px] text-gray-400 font-normal ml-1">Optional — for analysis</span></label>
                <button onClick={() => alert('Add/Link Workflow will be connected later.')} className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold text-primary hover:bg-primary/10 cursor-pointer transition-colors"><Plus size={9} />Add Workflow</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WORKFLOWS.map(w => (
                  <button key={w.id} onClick={() => toggleMulti('selectedWorkflowIds', w.id)}
                    className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors flex items-center gap-1 ${scope.selectedWorkflowIds.includes(w.id) ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'}`}>
                    <Workflow size={9} />{w.name} <span className="text-[8px] text-gray-400">{w.type}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scope Narrative */}
          <div className="rounded-lg border border-border-light p-4 space-y-3">
            <h4 className="text-[11px] font-bold text-text">Scope Narrative</h4>
            <div>
              <label className={labelCls}>Audit Objective <span className="text-red-400">*</span></label>
              <textarea value={scope.scopeObjective} onChange={e => update('scopeObjective', e.target.value)} rows={3}
                placeholder="Describe the objective and focus areas for this audit assignment..."
                className={inputCls + ' resize-none'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>In Scope</label>
                <textarea value={scope.inScopeItems} onChange={e => update('inScopeItems', e.target.value)} rows={3}
                  placeholder="Key areas, processes, transactions in scope..." className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className={labelCls}>Out of Scope</label>
                <textarea value={scope.outOfScopeItems} onChange={e => update('outOfScopeItems', e.target.value)} rows={3}
                  placeholder="Areas explicitly excluded from scope..." className={inputCls + ' resize-none'} />
              </div>
            </div>
          </div>
        </div>

        {/* Right — Preview & Readiness */}
        <div className="col-span-2 space-y-4">
          {/* Scope Preview */}
          <div className="rounded-lg border border-border-light p-4 space-y-2 sticky top-4">
            <h4 className="text-[11px] font-bold text-text">Scope Summary</h4>
            <p className="text-[11px] text-text leading-relaxed">
              {selectedBP ? (
                <><span className="font-medium">{selectedBP.code} — {selectedBP.name}</span>
                  {engagement.entityOrLocation ? ` at ${engagement.entityOrLocation}` : ''}
                  {scope.subProcessIds.length > 0 ? ` covering ${selectedSubProcesses.map(sp => sp.name).join(', ')}` : ''}
                  {cfg.auditPeriodStart && cfg.auditPeriodEnd ? ` for ${cfg.auditPeriodStart} to ${cfg.auditPeriodEnd}` : ''}
                  .
                </>
              ) : 'Select a business process to see scope summary.'}
            </p>

            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center gap-2"><span className="text-gray-400 w-20">Level:</span><span className="text-text font-medium">{SCOPE_LEVEL_LABELS[scope.scopeLevel]?.label || '—'}</span></div>
              <div className="flex items-center gap-2"><span className="text-gray-400 w-20">Process:</span><span className="text-text font-medium">{selectedBP?.name || '—'}</span></div>
              {scope.subProcessIds.length > 0 && (
                <div className="flex items-start gap-2"><span className="text-gray-400 w-20 shrink-0">Sub-proc:</span><div className="flex flex-wrap gap-1">{selectedSubProcesses.map(sp => <span key={sp.id} className={chipCls}>{sp.name}{sp.isCustom ? ' · Custom' : ''}</span>)}</div></div>
              )}
              {scope.sopIds.length > 0 && (
                <div className="flex items-start gap-2"><span className="text-gray-400 w-20 shrink-0">SOPs:</span><div className="flex flex-wrap gap-1">{scope.sopIds.map(id => { const s = SOPS.find(x => x.id === id); return s ? <span key={id} className={chipCls}>{s.name}</span> : null; })}</div></div>
              )}
              {scope.checklistIds.length > 0 && (
                <div className="flex items-start gap-2"><span className="text-gray-400 w-20 shrink-0">Checklists:</span><div className="flex flex-wrap gap-1">{scope.checklistIds.map(id => { const c = CHECKLISTS.find(x => x.id === id); return c ? <span key={id} className={chipCls}>{c.name}</span> : null; })}</div></div>
              )}
              {scope.racmVersionIds.length > 0 && (
                <div className="flex items-start gap-2"><span className="text-gray-400 w-20 shrink-0">RACM:</span><div className="flex flex-wrap gap-1">{scope.racmVersionIds.map(id => { const r = RACMS.find(x => x.id === id); return r ? <span key={id} className={chipCls}>{r.name}</span> : null; })}</div></div>
              )}
              {scope.selectedWorkflowIds.length > 0 && (
                <div className="flex items-start gap-2"><span className="text-gray-400 w-20 shrink-0">Workflows:</span><div className="flex flex-wrap gap-1">{scope.selectedWorkflowIds.map(id => { const w = WORKFLOWS.find(x => x.id === id); return w ? <span key={id} className={chipCls}>{w.name}</span> : null; })}</div></div>
              )}
              {scope.inScopeItems && <div className="flex items-start gap-2"><span className="text-gray-400 w-20 shrink-0">In Scope:</span><span className="text-text">{scope.inScopeItems}</span></div>}
              {scope.outOfScopeItems && <div className="flex items-start gap-2"><span className="text-gray-400 w-20 shrink-0">Out Scope:</span><span className="text-text">{scope.outOfScopeItems}</span></div>}
            </div>
          </div>

          {/* Readiness */}
          <div className="rounded-lg border border-border-light p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-text">Scope Readiness</h4>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${READINESS_CLS[status]}`}>{status}</span>
            </div>
            <div className="space-y-1">
              {checks.map(c => (
                <div key={c.label} className="flex items-center gap-2 text-[10px]">
                  {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className={c.required ? 'text-amber-400' : 'text-gray-300'} />}
                  <span className={c.ok ? 'text-gray-500' : c.required ? 'text-text' : 'text-gray-400'}>{c.label}</span>
                  {!c.required && <span className="text-[8px] text-gray-300 ml-auto">Optional</span>}
                </div>
              ))}
            </div>
            <button onClick={() => onNavigateTab?.('announcement')} disabled={status === 'Draft Scope'}
              className="mt-2 w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Continue to Announcement <ChevronRight size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
