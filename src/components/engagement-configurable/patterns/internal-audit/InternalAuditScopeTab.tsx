// ─── Internal Audit — Scope Tab ───────────────────────────────────────────
// Define what the audit assignment covers. Scope-first, not control-first.
// Redesigned for readability: guided sections, breathing room, 2-column layout.

import React, { useState } from 'react';
import {
  CheckCircle2, AlertCircle, ChevronRight, FileText, ClipboardCheck, Plus, X,
  Shield, Upload,
} from 'lucide-react';
import type { ConfigurableEngagement, InternalAuditConfig } from '../../configurableEngagementTypes';
import {
  BUSINESS_PROCESSES, SOPS, RACMS, CHECKLISTS, SCOPE_LEVEL_LABELS,
  deriveIAScopeReadiness,
  type InternalAuditScopeState,
} from './internalAuditScopeData';

const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[0.75rem] font-semibold text-text-muted block mb-1.5';
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

  const toggleMulti = (field: 'subProcessIds' | 'activityIds' | 'sopIds' | 'racmVersionIds' | 'checklistIds', id: string) => {
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

  const showSubProcesses = (predefinedSubProcesses.length > 0 || customSubProcsForBP.length > 0) && (scope.scopeLevel === 'SUB_PROCESS' || scope.scopeLevel === 'ACTIVITY' || scope.scopeLevel === 'PROCESS');
  const showEmptySubProcesses = scope.businessProcessId && predefinedSubProcesses.length === 0 && customSubProcsForBP.length === 0 && (scope.scopeLevel === 'SUB_PROCESS' || scope.scopeLevel === 'ACTIVITY' || scope.scopeLevel === 'PROCESS');

  return (
    <div className="space-y-6">
      {/* ═══ Page Header ═══ */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[1.0625rem] font-bold text-text tracking-tight">Scope</h3>
          <p className="text-[0.75rem] text-text-muted mt-1 leading-relaxed max-w-[600px]">
            Define what this internal audit will cover and attach the source documents that drive RACM, controls, and workflows.
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-[0.625rem] font-bold shrink-0 ${READINESS_CLS[status]}`}>{status}</span>
      </div>

      {/* ═══ A. Scope Context — compact summary bar ═══ */}
      <div className="rounded-xl border border-border-light bg-surface-2/30 p-4">
        <h4 className="text-[0.625rem] font-bold text-text-muted uppercase tracking-wider mb-3">Scope Context</h4>
        <div className="grid grid-cols-4 gap-4 text-[0.75rem]">
          <div>
            <span className="text-[0.625rem] text-gray-400 block mb-0.5">Assignment</span>
            <span className="text-text font-semibold">{engagement.name}</span>
          </div>
          <div>
            <span className="text-[0.625rem] text-gray-400 block mb-0.5">Scope Level</span>
            <span className="text-text font-semibold">{SCOPE_LEVEL_LABELS[scope.scopeLevel]?.label || scope.scopeLevel}</span>
          </div>
          <div>
            <span className="text-[0.625rem] text-gray-400 block mb-0.5">Entity</span>
            <span className="text-text font-semibold">{engagement.entityOrLocation || '—'}</span>
          </div>
          <div>
            <span className="text-[0.625rem] text-gray-400 block mb-0.5">Process Owner</span>
            <span className="text-text font-semibold">{cfg.processOwner || '—'}</span>
          </div>
        </div>
      </div>

      {/* ═══ 2-Column Layout ═══ */}
      <div className="grid grid-cols-12 gap-6">

        {/* ─── Left Column (8/12 ≈ 67%) ─── */}
        <div className="col-span-8 space-y-6">

          {/* ═══ B. Define Scope ═══ */}
          <div className="rounded-xl border border-border-light bg-white p-6 space-y-6">
            <div>
              <h4 className="text-[0.8125rem] font-bold text-text">Define Scope</h4>
              <p className="text-[0.75rem] text-text-muted mt-0.5">Choose the audit coverage level and primary business process.</p>
            </div>

            {/* Scope Level */}
            <div className="space-y-3">
              <label className="text-[0.75rem] font-semibold text-text block">Scope Level</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SCOPE_LEVEL_LABELS).map(([key, { label }]) => (
                  <button key={key} onClick={() => update('scopeLevel', key)}
                    className={`px-4 py-2 rounded-lg text-[0.6875rem] font-semibold cursor-pointer transition-all border ${scope.scopeLevel === key ? 'border-primary bg-primary/8 text-primary shadow-sm shadow-primary/10' : 'border-border-light text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[0.6875rem] text-gray-400 leading-relaxed">{SCOPE_LEVEL_LABELS[scope.scopeLevel]?.desc || ''}</p>
            </div>

            <div className="border-t border-border-light/60" />

            {/* Business Process */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={labelCls + ' mb-0'}>Business Process <span className="text-red-400">*</span></label>
                <button onClick={() => alert('Create Business Process — will be connected to Process Hub.')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.625rem] font-semibold text-primary bg-primary/8 hover:bg-primary/15 cursor-pointer transition-colors border border-primary/15">
                  <Plus size={10} />Create Business Process
                </button>
              </div>
              <select value={scope.businessProcessId} onChange={e => onUpdateScope({ ...scope, businessProcessId: e.target.value, subProcessIds: [], activityIds: [] })} className={selectCls}>
                <option value="">Select business process...</option>
                {BUSINESS_PROCESSES.map(bp => <option key={bp.id} value={bp.id}>{bp.code} — {bp.name}</option>)}
              </select>
            </div>

            {/* Sub-processes */}
            {showSubProcesses && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelCls + ' mb-0'}>Sub-processes {scope.scopeLevel !== 'PROCESS' && <span className="text-red-400">*</span>}</label>
                  {scope.businessProcessId && (
                    <button onClick={() => { setShowAddSubProc(true); setSubProcValidation(''); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[0.625rem] font-semibold text-primary hover:bg-primary/8 cursor-pointer transition-colors">
                      <Plus size={10} />Add Sub-process
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {allSubProcesses.map(sp => (
                    <button key={sp.id} onClick={() => toggleMulti('subProcessIds', sp.id)}
                      className={`px-3 py-1.5 rounded-lg text-[0.6875rem] font-medium cursor-pointer transition-all flex items-center gap-1.5 border ${scope.subProcessIds.includes(sp.id) ? 'bg-primary/8 text-primary border-primary/25 shadow-sm shadow-primary/5' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100 hover:border-gray-200'}`}>
                      {sp.name}
                      {sp.isCustom && <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-purple-50 text-purple-600">Custom</span>}
                      {sp.isCustom && scope.subProcessIds.includes(sp.id) && (
                        <span onClick={e => { e.stopPropagation(); removeCustomSubProcess(sp.id); }} className="ml-0.5 text-gray-400 hover:text-red-500 cursor-pointer"><X size={9} /></span>
                      )}
                    </button>
                  ))}
                </div>
                {showAddSubProc && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={newSubProcName} onChange={e => { setNewSubProcName(e.target.value); setSubProcValidation(''); }} placeholder="Sub-process name..." className="flex-1 px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40" onKeyDown={e => { if (e.key === 'Enter') addCustomSubProcess(); }} />
                    <button onClick={addCustomSubProcess} disabled={!newSubProcName.trim()} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
                    <button onClick={() => { setShowAddSubProc(false); setNewSubProcName(''); setSubProcValidation(''); }} className="px-3 py-2 rounded-lg text-[0.6875rem] text-gray-500 hover:text-text hover:bg-gray-100 cursor-pointer transition-colors">Cancel</button>
                  </div>
                )}
                {subProcValidation && <p className="text-[0.625rem] text-red-500 mt-1">{subProcValidation}</p>}
              </div>
            )}

            {/* Empty sub-processes state */}
            {showEmptySubProcesses && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelCls + ' mb-0'}>Sub-processes {scope.scopeLevel !== 'PROCESS' && <span className="text-red-400">*</span>}</label>
                  <button onClick={() => { setShowAddSubProc(true); setSubProcValidation(''); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[0.625rem] font-semibold text-primary hover:bg-primary/8 cursor-pointer transition-colors">
                    <Plus size={10} />Add Sub-process
                  </button>
                </div>
                <p className="text-[0.6875rem] text-gray-400 italic">No predefined sub-processes for this business process. Add a custom one.</p>
                {showAddSubProc && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={newSubProcName} onChange={e => { setNewSubProcName(e.target.value); setSubProcValidation(''); }} placeholder="Sub-process name..." className="flex-1 px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40" onKeyDown={e => { if (e.key === 'Enter') addCustomSubProcess(); }} />
                    <button onClick={addCustomSubProcess} disabled={!newSubProcName.trim()} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
                    <button onClick={() => { setShowAddSubProc(false); setNewSubProcName(''); setSubProcValidation(''); }} className="px-3 py-2 rounded-lg text-[0.6875rem] text-gray-500 hover:text-text hover:bg-gray-100 cursor-pointer transition-colors">Cancel</button>
                  </div>
                )}
                {subProcValidation && <p className="text-[0.625rem] text-red-500 mt-1">{subProcValidation}</p>}
              </div>
            )}

            {/* Activities */}
            {availableActivities.length > 0 && scope.scopeLevel === 'ACTIVITY' && (
              <div className="space-y-2">
                <label className={labelCls}>Activities <span className="text-red-400">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {availableActivities.map(a => (
                    <button key={a.id} onClick={() => toggleMulti('activityIds', a.id)}
                      className={`px-3 py-1.5 rounded-lg text-[0.6875rem] font-medium cursor-pointer transition-all border ${scope.activityIds.includes(a.id) ? 'bg-primary/8 text-primary border-primary/25 shadow-sm shadow-primary/5' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100 hover:border-gray-200'}`}>
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Specific Elements */}
            {scope.scopeLevel === 'SPECIFIC_ELEMENT' && (
              <div className="space-y-2">
                <label className={labelCls}>Specific Elements</label>
                <textarea value={scope.specificElements} onChange={e => update('specificElements', e.target.value)} rows={2}
                  placeholder="e.g. Selected vendors, specific locations, transaction types..." className={inputCls + ' resize-none'} />
              </div>
            )}
          </div>

          {/* ═══ C. Attach Scope Sources ═══ */}
          <div className="rounded-xl border border-border-light bg-white p-6 space-y-5">
            <div>
              <h4 className="text-[0.8125rem] font-bold text-text">Attach Scope Sources</h4>
              <p className="text-[0.75rem] text-text-muted mt-0.5">Attach SOPs, checklists, or RACMs to define what will be reviewed.</p>
            </div>

            {/* SOPs */}
            <div className="rounded-lg border border-border-light/70 bg-gray-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-blue-50"><FileText size={12} className="text-blue-600" /></div>
                  <div>
                    <span className="text-[0.75rem] font-semibold text-text block">SOPs</span>
                    <span className="text-[0.625rem] text-gray-400">Recommended</span>
                  </div>
                </div>
                <button onClick={() => alert('Upload SOP will be connected later.')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.625rem] font-semibold text-primary bg-white hover:bg-primary/5 cursor-pointer transition-colors border border-border-light">
                  <Upload size={10} />Upload SOP
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {SOPS.map(s => (
                  <button key={s.id} onClick={() => toggleMulti('sopIds', s.id)}
                    className={`group px-3.5 py-2 rounded-lg text-[0.6875rem] font-medium cursor-pointer transition-all flex items-center gap-2 border ${scope.sopIds.includes(s.id) ? 'bg-primary/8 text-primary border-primary/25 shadow-sm' : 'bg-white text-gray-600 border-border-light hover:border-gray-300 hover:shadow-sm'}`}>
                    <FileText size={11} className={scope.sopIds.includes(s.id) ? 'text-primary' : 'text-gray-400'} />
                    <span>{s.name}</span>
                    <span className={`text-[0.5625rem] ${scope.sopIds.includes(s.id) ? 'text-primary/60' : 'text-gray-400'}`}>{s.version}</span>
                    {scope.sopIds.includes(s.id) && <CheckCircle2 size={11} className="text-primary ml-0.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Checklists */}
            <div className="rounded-lg border border-border-light/70 bg-gray-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-emerald-50"><ClipboardCheck size={12} className="text-emerald-600" /></div>
                  <div>
                    <span className="text-[0.75rem] font-semibold text-text block">Checklists</span>
                    <span className="text-[0.625rem] text-gray-400">Optional</span>
                  </div>
                </div>
                <button onClick={() => alert('Upload Checklist will be connected later.')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.625rem] font-semibold text-primary bg-white hover:bg-primary/5 cursor-pointer transition-colors border border-border-light">
                  <Upload size={10} />Upload Checklist
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {CHECKLISTS.map(c => (
                  <button key={c.id} onClick={() => toggleMulti('checklistIds', c.id)}
                    className={`group px-3.5 py-2 rounded-lg text-[0.6875rem] font-medium cursor-pointer transition-all flex items-center gap-2 border ${scope.checklistIds.includes(c.id) ? 'bg-primary/8 text-primary border-primary/25 shadow-sm' : 'bg-white text-gray-600 border-border-light hover:border-gray-300 hover:shadow-sm'}`}>
                    <ClipboardCheck size={11} className={scope.checklistIds.includes(c.id) ? 'text-primary' : 'text-gray-400'} />
                    <span>{c.name}</span>
                    <span className={`text-[0.5625rem] ${scope.checklistIds.includes(c.id) ? 'text-primary/60' : 'text-gray-400'}`}>· {c.items} items</span>
                    {scope.checklistIds.includes(c.id) && <CheckCircle2 size={11} className="text-primary ml-0.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* RACM */}
            <div className="rounded-lg border border-border-light/70 bg-gray-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-purple-50"><Shield size={12} className="text-purple-600" /></div>
                  <div>
                    <span className="text-[0.75rem] font-semibold text-text block">RACM</span>
                    <span className="text-[0.625rem] text-gray-400">Optional</span>
                  </div>
                </div>
                <button onClick={() => alert('Upload RACM will be connected later.')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.625rem] font-semibold text-primary bg-white hover:bg-primary/5 cursor-pointer transition-colors border border-border-light">
                  <Upload size={10} />Upload RACM
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {RACMS.map(r => (
                  <button key={r.id} onClick={() => toggleMulti('racmVersionIds', r.id)}
                    className={`group px-3.5 py-2 rounded-lg text-[0.6875rem] font-medium cursor-pointer transition-all flex items-center gap-2 border ${scope.racmVersionIds.includes(r.id) ? 'bg-primary/8 text-primary border-primary/25 shadow-sm' : 'bg-white text-gray-600 border-border-light hover:border-gray-300 hover:shadow-sm'}`}>
                    <Shield size={11} className={scope.racmVersionIds.includes(r.id) ? 'text-primary' : 'text-gray-400'} />
                    <span>{r.name}</span>
                    <span className={`text-[0.5625rem] ${scope.racmVersionIds.includes(r.id) ? 'text-primary/60' : 'text-gray-400'}`}>{r.version}</span>
                    {scope.racmVersionIds.includes(r.id) && <CheckCircle2 size={11} className="text-primary ml-0.5" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ Scope Narrative ═══ */}
          <div className="rounded-xl border border-border-light bg-white p-6 space-y-5">
            <div>
              <h4 className="text-[0.8125rem] font-bold text-text">Scope Narrative</h4>
              <p className="text-[0.75rem] text-text-muted mt-0.5">Describe the audit objective, in-scope, and out-of-scope areas.</p>
            </div>
            <div>
              <label className={labelCls}>Audit Objective <span className="text-red-400">*</span></label>
              <textarea value={scope.scopeObjective} onChange={e => update('scopeObjective', e.target.value)} rows={3}
                placeholder="Describe the objective and focus areas for this audit assignment..."
                className={inputCls + ' resize-none'} />
            </div>
            <div className="grid grid-cols-2 gap-4">
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

        {/* ─── Right Column (4/12 ≈ 33%) ─── */}
        <div className="col-span-4 space-y-6">

          {/* ═══ Scope Summary ═══ */}
          <div className="rounded-xl border border-border-light bg-white p-5 space-y-4 sticky top-4">
            <h4 className="text-[0.75rem] font-bold text-text">Scope Summary</h4>
            <p className="text-[0.75rem] text-text leading-relaxed">
              {selectedBP ? (
                <><span className="font-semibold">{selectedBP.code} — {selectedBP.name}</span>
                  {engagement.entityOrLocation ? ` at ${engagement.entityOrLocation}` : ''}
                  {scope.subProcessIds.length > 0 ? ` covering ${selectedSubProcesses.map(sp => sp.name).join(', ')}` : ''}
                  {cfg.auditPeriodStart && cfg.auditPeriodEnd ? ` for ${cfg.auditPeriodStart} to ${cfg.auditPeriodEnd}` : ''}
                  .
                </>
              ) : <span className="text-gray-400 italic">Select a business process to see scope summary.</span>}
            </p>

            <div className="space-y-2.5 text-[0.6875rem]">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-[72px] shrink-0 text-[0.625rem]">Level</span>
                <span className="text-text font-medium">{SCOPE_LEVEL_LABELS[scope.scopeLevel]?.label || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-[72px] shrink-0 text-[0.625rem]">Process</span>
                <span className="text-text font-medium">{selectedBP?.name || '—'}</span>
              </div>
              {scope.subProcessIds.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-[72px] shrink-0 text-[0.625rem] pt-0.5">Sub-proc</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSubProcesses.map(sp => (
                      <span key={sp.id} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[0.625rem] font-semibold">
                        {sp.name}{sp.isCustom ? ' · Custom' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {scope.sopIds.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-[72px] shrink-0 text-[0.625rem] pt-0.5">SOPs</span>
                  <div className="flex flex-wrap gap-1.5">
                    {scope.sopIds.map(id => { const s = SOPS.find(x => x.id === id); return s ? <span key={id} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[0.625rem] font-semibold">{s.name}</span> : null; })}
                  </div>
                </div>
              )}
              {scope.checklistIds.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-[72px] shrink-0 text-[0.625rem] pt-0.5">Checklists</span>
                  <div className="flex flex-wrap gap-1.5">
                    {scope.checklistIds.map(id => { const c = CHECKLISTS.find(x => x.id === id); return c ? <span key={id} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[0.625rem] font-semibold">{c.name}</span> : null; })}
                  </div>
                </div>
              )}
              {scope.racmVersionIds.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-[72px] shrink-0 text-[0.625rem] pt-0.5">RACM</span>
                  <div className="flex flex-wrap gap-1.5">
                    {scope.racmVersionIds.map(id => { const r = RACMS.find(x => x.id === id); return r ? <span key={id} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[0.625rem] font-semibold">{r.name}</span> : null; })}
                  </div>
                </div>
              )}
              {scope.inScopeItems && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-[72px] shrink-0 text-[0.625rem] pt-0.5">In Scope</span>
                  <span className="text-text text-[0.6875rem]">{scope.inScopeItems}</span>
                </div>
              )}
              {scope.outOfScopeItems && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 w-[72px] shrink-0 text-[0.625rem] pt-0.5">Out Scope</span>
                  <span className="text-text text-[0.6875rem]">{scope.outOfScopeItems}</span>
                </div>
              )}
            </div>
          </div>

          {/* ═══ D. Scope Readiness ═══ */}
          <div className="rounded-xl border border-border-light bg-white p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-[0.75rem] font-bold text-text">Scope Readiness</h4>
                <span className={`px-2.5 py-1 rounded-full text-[0.5625rem] font-bold ${READINESS_CLS[status]}`}>{status}</span>
              </div>
              <p className="text-[0.75rem] text-text-muted leading-relaxed">Complete the required scope details before sending the audit announcement.</p>
            </div>

            <div className="space-y-2.5">
              {checks.map(c => (
                <div key={c.label} className="flex items-center gap-2.5 text-[0.6875rem]">
                  {c.ok
                    ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    : <AlertCircle size={13} className={`shrink-0 ${c.required ? 'text-amber-400' : 'text-gray-300'}`} />
                  }
                  <span className={`flex-1 ${c.ok ? 'text-gray-500' : c.required ? 'text-text font-medium' : 'text-gray-400'}`}>{c.label}</span>
                  {!c.required && <span className="text-[0.5625rem] text-gray-300 shrink-0">Optional</span>}
                </div>
              ))}
            </div>

            {/* ═══ E. Continue Action ═══ */}
            <div className="pt-2 border-t border-border-light/60">
              <button onClick={() => onNavigateTab?.('announcement')} disabled={status === 'Draft Scope'}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-primary/20">
                Continue to Announcement <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
