// ─── Compliance Control Testing — Control Scope Tab ───────────────────────
// Shows the engagement's control universe based on control scope source.
// Scope changes (library adds, imports, manual controls) persist in the
// lifted complianceState.

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Star, ChevronDown, ChevronRight, CheckCircle2, AlertCircle,
  MinusCircle, Workflow, Upload, Plus, FileText, Info, X, Loader2, Library,
} from 'lucide-react';
import type { ConfigurableEngagement, ComplianceConfig } from '../../configurableEngagementTypes';
import { ControlScopeSource, ComplianceFramework } from '../../configurableEngagementTypes';
import {
  deriveScopeSummary, deriveComplianceControlReadiness, LIBRARY_CONTROLS, createImportedControls,
  type ScopeControl, type ControlReadiness,
} from './complianceControlScopeData';
import { useAuditLog } from '../../../../context/AdminDataContext';

const NATURE_CLS = { Preventive: 'bg-emerald-50 text-emerald-700', Detective: 'bg-blue-50 text-blue-700', Corrective: 'bg-amber-50 text-amber-700' };
const AUTO_CLS = { Manual: 'bg-gray-100 text-gray-600', Automated: 'bg-purple-50 text-purple-700', Hybrid: 'bg-indigo-50 text-indigo-700' };
const READINESS_CLS: Record<string, string> = {
  Ready: 'bg-emerald-50 text-emerald-700',
  'Attributes Missing': 'bg-red-50 text-red-600',
  'Workflow Missing': 'bg-red-50 text-red-600',
  'Workflow Mapping Missing': 'bg-amber-50 text-amber-700',
  'Needs Review': 'bg-blue-50 text-blue-600',
};

interface Props {
  engagement: ConfigurableEngagement;
  scopeControls: ScopeControl[];
  onUpdateScopeControls: (controls: ScopeControl[]) => void;
}

type ActiveModal = 'library' | 'import' | 'manual' | null;

export default function ComplianceControlScopeTab({ engagement, scopeControls, onUpdateScopeControls }: Props) {
  const logEvent = useAuditLog();
  const cfg = engagement.config as ComplianceConfig;
  const controls = scopeControls;
  const summary = deriveScopeSummary(controls);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const racmFrameworks: ComplianceFramework[] = [ComplianceFramework.SOX_ICFR, ComplianceFramework.IFC, ComplianceFramework.ICOFR];
  const racmWarning = racmFrameworks.includes(cfg.framework) && cfg.controlScopeSource !== ControlScopeSource.RACM_VERSION;

  const appendControls = (added: ScopeControl[], message: string) => {
    const existingIds = new Set(controls.map(c => c.id));
    const fresh = added.filter(c => !existingIds.has(c.id));
    if (fresh.length > 0) onUpdateScopeControls([...controls, ...fresh]);
    setToast(message);
    setActiveModal(null);
  };

  return (
    <div className="space-y-4 relative">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[0.9375rem] font-bold text-text mb-0.5">Control Scope</h3>
          <p className="text-[0.75rem] text-text-muted">Define the controls that will be tested in this compliance engagement.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[0.6875rem] font-bold">{cfg.framework.replace(/_/g, ' ')}</span>
          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[0.6875rem] font-bold">
            {cfg.controlScopeSource.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        </div>
      </div>

      {/* RACM warning */}
      {racmWarning && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[0.75rem] text-amber-700">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>RACM linkage is required for {cfg.framework.replace(/_/g, ' ')}. Current scope source may not meet compliance requirements.</span>
        </div>
      )}

      {/* Stats — 5 tiles */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Controls', value: summary.total },
          { label: 'Key Controls', value: summary.keyCount },
          { label: 'Ready', value: summary.ready, cls: 'text-emerald-600' },
          { label: 'Needs Setup', value: summary.needsSetup, cls: summary.needsSetup > 0 ? 'text-amber-600' : '' },
          { label: 'Attributes', value: summary.totalAttrs },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-3 text-center">
            <div className={`text-[1.0625rem] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[0.6875rem] text-text-muted font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Scope source context + actions */}
      <ScopeSourceCard source={cfg.controlScopeSource} racmVersionId={cfg.racmVersionId} />
      <div className="flex items-center gap-2">
        <button onClick={() => setActiveModal('library')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors">
          <Library size={13} />Add Controls from Library
        </button>
        <button onClick={() => setActiveModal('import')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[0.75rem] font-semibold cursor-pointer transition-colors">
          <Upload size={13} />Import Control Sheet
        </button>
        <button onClick={() => setActiveModal('manual')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-light text-text-muted hover:bg-surface-2/30 text-[0.75rem] font-semibold cursor-pointer transition-colors">
          <Plus size={13} />Create Manual Control
        </button>
      </div>

      {/* Controls table */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <table className="w-full text-[0.75rem]">
          <thead>
            <tr className="border-b border-border-light bg-surface-2/30 text-[0.6875rem] font-semibold text-text-muted uppercase">
              <th className="px-3 py-2 text-left w-5"></th>
              <th className="px-3 py-2 text-left">Control</th>
              <th className="px-3 py-2 text-left">Classification</th>
              <th className="px-3 py-2 text-center">Attributes</th>
              <th className="px-3 py-2 text-center">Workflows</th>
              <th className="px-3 py-2 text-center">Readiness</th>
            </tr>
          </thead>
          <tbody>
            {controls.map(ctrl => {
              const readiness = deriveComplianceControlReadiness(ctrl);
              const isExpanded = expandedId === ctrl.id;
              return (
                <React.Fragment key={ctrl.id}>
                  <tr
                    className={`border-b border-border-light/50 cursor-pointer hover:bg-surface-2/20 transition-colors ${isExpanded ? 'bg-surface-2/20' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : ctrl.id)}
                  >
                    <td className="px-3 py-2.5 text-gray-400">
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-text-muted text-[0.6875rem]">{ctrl.id}</span>
                        <span className="font-medium text-text">{ctrl.name}</span>
                        {ctrl.importance === 'Key' && <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />}
                        {ctrl.sourceStatus === 'Imported' && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[0.6875rem] font-bold">Imported</span>
                        )}
                        {ctrl.sourceStatus === 'Manual' && (
                          <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[0.6875rem] font-bold">Manual</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[0.6875rem] font-bold ${NATURE_CLS[ctrl.nature]}`}>{ctrl.nature}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[0.6875rem] font-bold ${AUTO_CLS[ctrl.automation]}`}>{ctrl.automation}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-text font-medium tabular-nums">{ctrl.attributes.length}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-text font-medium tabular-nums">{ctrl.workflows.length}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold whitespace-nowrap ${READINESS_CLS[readiness.status]}`}>
                        {readiness.label}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <ControlDetail ctrl={ctrl} readiness={readiness} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {activeModal === 'library' && (
        <LibraryPickerModal
          existingIds={new Set(controls.map(c => c.id))}
          onAdd={(picked) => { appendControls(picked, `${picked.length} control${picked.length !== 1 ? 's' : ''} added from library`); logEvent({ action: 'Update', description: `Added ${picked.length} control${picked.length !== 1 ? 's' : ''} to scope from library in "${engagement.name}"`, module: 'Engagements', entity: 'Control' }); }}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'import' && (
        <ImportSheetModal
          onImported={(parsed) => appendControls(parsed, `${parsed.length} controls imported from sheet`)}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'manual' && (
        <ManualControlModal
          nextIndex={controls.filter(c => c.sourceStatus === 'Manual').length + 1}
          onCreate={(ctrl) => appendControls([ctrl], `Manual control "${ctrl.name}" created`)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[0.75rem] font-medium shadow-lg">
          <CheckCircle2 size={14} className="text-emerald-400" />{toast}
        </div>
      )}
    </div>
  );
}

// ─── Scope Source Card ─────────────────────────────────────────────────────

function ScopeSourceCard({ source, racmVersionId }: { source: ControlScopeSource; racmVersionId?: string }) {
  const cards: Record<ControlScopeSource, { icon: React.ElementType; title: string; desc: string }> = {
    [ControlScopeSource.RACM_VERSION]: {
      icon: FileText,
      title: racmVersionId ? `RACM: ${racmVersionId}` : 'RACM Version',
      desc: 'Controls are loaded from the selected RACM version and snapshotted for this engagement. You can extend the scope from the library, an import, or a manual control below.',
    },
    [ControlScopeSource.SELECTED_CONTROLS]: {
      icon: Shield,
      title: 'Selected Controls',
      desc: 'Selected controls are snapshotted into this engagement. Extend the scope using the actions below.',
    },
    [ControlScopeSource.IMPORTED_CONTROLS]: {
      icon: Upload,
      title: 'Imported Controls',
      desc: 'Imported controls are added to the Control Library and tagged with this engagement/import source.',
    },
    [ControlScopeSource.MANUAL_CONTROLS]: {
      icon: Plus,
      title: 'Manual Controls',
      desc: 'Manual controls created here are added to the Control Library after review.',
    },
  };

  const card = cards[source];
  const Icon = card.icon;

  return (
    <div className="rounded-lg border border-border-light bg-surface-2/10 px-4 py-3 flex items-start gap-3">
      <div className="p-1.5 rounded-lg bg-primary/10 shrink-0 mt-0.5">
        <Icon size={14} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[0.8125rem] font-semibold text-text mb-0.5">{card.title}</div>
        <div className="text-[0.75rem] text-gray-500">{card.desc}</div>
      </div>
    </div>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────

function ModalShell({ title, subtitle, onClose, children, wide }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl border border-border-light w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[85vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-border-light flex items-start justify-between rounded-t-2xl">
          <div>
            <h4 className="text-[0.875rem] font-bold text-text">{title}</h4>
            {subtitle && <p className="text-[0.75rem] text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Library Picker Modal ─────────────────────────────────────────────────

function LibraryPickerModal({ existingIds, onAdd, onClose }: {
  existingIds: Set<string>; onAdd: (controls: ScopeControl[]) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const available = LIBRARY_CONTROLS;

  const toggle = (id: string) => {
    if (existingIds.has(id)) return;
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  return (
    <ModalShell title="Add Controls from Library" subtitle="Select controls from the central Control Library to snapshot into this engagement." onClose={onClose} wide>
      <div className="space-y-2">
        {available.map(c => {
          const already = existingIds.has(c.id);
          const isChecked = selected.has(c.id);
          return (
            <label key={c.id}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${already ? 'border-border-light/50 opacity-50 cursor-not-allowed' : isChecked ? 'border-primary/40 bg-primary/5 cursor-pointer' : 'border-border-light hover:border-primary/20 cursor-pointer'}`}>
              <input type="checkbox" disabled={already} checked={isChecked} onChange={() => toggle(c.id)}
                className="mt-0.5 w-3.5 h-3.5 rounded border-border accent-[#6a12cd] cursor-pointer" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[0.6875rem] text-text-muted">{c.id}</span>
                  <span className="text-[0.8125rem] font-semibold text-text">{c.name}</span>
                  {c.importance === 'Key' && <Star size={10} className="fill-amber-400 text-amber-400" />}
                  <span className={`px-1.5 py-0.5 rounded text-[0.6875rem] font-bold ${NATURE_CLS[c.nature]}`}>{c.nature}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[0.6875rem] font-bold ${AUTO_CLS[c.automation]}`}>{c.automation}</span>
                  {already && <span className="text-[0.6875rem] text-gray-400 font-medium">Already in scope</span>}
                </div>
                <p className="text-[0.75rem] text-gray-500 mt-1">{c.description}</p>
                <p className="text-[0.6875rem] text-text-muted mt-1">{c.attributes.length} attribute{c.attributes.length !== 1 ? 's' : ''} · {c.process} · Owner: {c.owner}</p>
              </div>
            </label>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border-light text-[0.75rem] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
        <button
          onClick={() => onAdd(available.filter(c => selected.has(c.id)))}
          disabled={selected.size === 0}
          className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Add {selected.size > 0 ? `${selected.size} Control${selected.size !== 1 ? 's' : ''}` : 'Controls'} to Scope
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Import Sheet Modal (mock file-drop, 1.5s parse) ──────────────────────

function ImportSheetModal({ onImported, onClose }: {
  onImported: (controls: ScopeControl[]) => void; onClose: () => void;
}) {
  const logEvent = useAuditLog();
  const [phase, setPhase] = useState<'idle' | 'parsing'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const startParse = () => {
    setPhase('parsing');
    timer.current = setTimeout(() => onImported(createImportedControls()), 1500);
    logEvent({ action: 'Upload', description: 'Parsed control scope source "controls_p2p_supplement.xlsx"', module: 'Engagements', entity: 'Control' });
  };

  return (
    <ModalShell title="Import Control Sheet" subtitle="Drop a control sheet (.xlsx) — parsed controls are appended to the scope with an Imported tag." onClose={onClose}>
      {phase === 'idle' ? (
        <button
          onClick={startParse}
          className="w-full rounded-xl border-2 border-dashed border-border-light hover:border-primary/40 hover:bg-primary/5 transition-colors p-8 text-center cursor-pointer">
          <Upload size={26} className="text-primary mx-auto mb-2" />
          <div className="text-[0.8125rem] font-semibold text-text">Drop control sheet here or click to browse</div>
          <div className="text-[0.75rem] text-text-muted mt-1">Supports .xlsx control sheets · demo drops controls_p2p_supplement.xlsx</div>
        </button>
      ) : (
        <div className="rounded-xl border border-border-light p-8 text-center">
          <Loader2 size={26} className="text-primary mx-auto mb-2 animate-spin" />
          <div className="text-[0.8125rem] font-semibold text-text">Parsing controls_p2p_supplement.xlsx…</div>
          <div className="text-[0.75rem] text-text-muted mt-1">Extracting control names, attributes, and owners.</div>
        </div>
      )}
      <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-200/50 text-[0.75rem] text-blue-600">
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>Imported controls will carry an "Imported" chip and land in Needs Review until confirmed.</span>
      </div>
    </ModalShell>
  );
}

// ─── Manual Control Modal ─────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[0.75rem] font-semibold text-text-muted block mb-1';

function ManualControlModal({ nextIndex, onCreate, onClose }: {
  nextIndex: number; onCreate: (ctrl: ScopeControl) => void; onClose: () => void;
}) {
  const logEvent = useAuditLog();
  const [name, setName] = useState('');
  const [risk, setRisk] = useState('');
  const [attrs, setAttrs] = useState<string[]>(['']);

  const validAttrs = attrs.map(a => a.trim()).filter(Boolean);
  const canCreate = name.trim().length > 0 && validAttrs.length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    const id = `C-MAN-${String(nextIndex).padStart(2, '0')}`;
    onCreate({
      id,
      name: name.trim(),
      description: risk.trim() ? `Manual control addressing: ${risk.trim()}` : 'Manually created control — description pending review.',
      importance: 'Non-Key', nature: 'Preventive', automation: 'Manual',
      process: 'P2P', owner: 'Unassigned', sourceStatus: 'Manual',
      attributes: validAttrs.map((a, i) => ({
        id: `${id}-a${i + 1}`, code: String.fromCharCode(65 + i), name: a, assertion: 'Existence', required: true,
      })),
      workflows: [],
    });
    logEvent({ action: 'Create', description: `Created control "${name.trim()}" in compliance scope`, module: 'Engagements', entity: 'Control' });
  };

  return (
    <ModalShell title="Create Manual Control" subtitle="Manual controls are appended to scope and flow into the Control Library after review." onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Control Name <span className="text-red-400">*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Petty Cash Reconciliation" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Risk Addressed</label>
          <textarea value={risk} onChange={e => setRisk(e.target.value)} rows={2}
            placeholder="What risk does this control mitigate?" className={inputCls + ' resize-none'} />
        </div>
        <div>
          <label className={labelCls}>Attributes (1–3) <span className="text-red-400">*</span></label>
          <div className="space-y-2">
            {attrs.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-[0.75rem] font-bold text-primary text-center shrink-0">{String.fromCharCode(65 + i)}</span>
                <input value={a} onChange={e => setAttrs(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                  placeholder={`Attribute ${i + 1} — e.g. Reconciliation reviewed monthly`} className={inputCls} />
                {attrs.length > 1 && (
                  <button onClick={() => setAttrs(prev => prev.filter((_, j) => j !== i))}
                    className="p-1 rounded text-gray-400 hover:text-red-500 cursor-pointer shrink-0"><X size={13} /></button>
                )}
              </div>
            ))}
          </div>
          {attrs.length < 3 && (
            <button onClick={() => setAttrs(prev => [...prev, ''])}
              className="mt-2 flex items-center gap-1 text-[0.75rem] font-semibold text-primary hover:underline cursor-pointer">
              <Plus size={11} />Add attribute
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border-light text-[0.75rem] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
        <button onClick={handleCreate} disabled={!canCreate}
          className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Create Control
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Control Expanded Detail ──────────────────────────────────────────────

function ControlDetail({ ctrl, readiness }: { ctrl: ScopeControl; readiness: ControlReadiness }) {
  return (
    <div className="bg-surface-2/15 border-b border-border-light px-6 py-4 space-y-4">
      {/* Description */}
      <div>
        <h6 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-1">Description</h6>
        <p className="text-[0.75rem] text-text leading-relaxed">{ctrl.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Attributes */}
        <div>
          <h6 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-1.5">
            Attributes ({ctrl.attributes.length})
          </h6>
          {ctrl.attributes.length === 0 ? (
            <div className="text-[0.75rem] text-red-500 italic">No attributes configured.</div>
          ) : (
            <div className="space-y-1">
              {ctrl.attributes.map(a => {
                const hasWf = !!a.workflowId;
                return (
                  <div key={a.id} className="flex items-center gap-2 text-[0.75rem]">
                    {hasWf ? (
                      <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                    ) : (
                      <MinusCircle size={11} className="text-amber-400 shrink-0" />
                    )}
                    <span className="font-bold text-primary w-4">{a.code}</span>
                    <span className="text-text">{a.name}</span>
                    <span className="text-text-muted ml-auto text-[0.6875rem]">{a.assertion}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workflows */}
        <div>
          <h6 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-1.5">
            Linked Workflows ({ctrl.workflows.length})
          </h6>
          {ctrl.workflows.length === 0 ? (
            <div className="text-[0.75rem] text-red-500 italic">No workflows linked.</div>
          ) : (
            <div className="space-y-1.5">
              {ctrl.workflows.map(wf => (
                <div key={wf.id} className="flex items-start gap-2 text-[0.75rem]">
                  <Workflow size={11} className="text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-text font-medium">{wf.name}</span>
                      <span className="text-[0.6875rem] font-mono text-text-muted">{wf.version}</span>
                      <span className={`px-1 py-0.5 rounded text-[0.6875rem] font-bold ${AUTO_CLS[wf.type]}`}>{wf.type}</span>
                    </div>
                    <div className="text-[0.6875rem] text-text-muted">
                      Covers: {wf.coveredAttributeIds.map(aid => ctrl.attributes.find(a => a.id === aid)?.code || '?').join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Readiness checklist */}
      <div>
        <h6 className="text-[0.6875rem] font-bold text-text-muted uppercase tracking-wider mb-1.5">Readiness</h6>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem]">
          {[
            { label: 'Control defined', ok: true },
            { label: 'Attributes configured', ok: ctrl.attributes.length > 0 },
            { label: 'Workflows linked', ok: ctrl.workflows.length > 0 },
            { label: 'All attributes mapped', ok: ctrl.attributes.every(a => !!a.workflowId) },
            { label: 'Ready for testing', ok: readiness.status === 'Ready' },
          ].map(c => (
            <span key={c.label} className="flex items-center gap-1">
              {c.ok ? <CheckCircle2 size={11} className="text-emerald-500" /> : <AlertCircle size={11} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </span>
          ))}
        </div>
        {readiness.missingItems.length > 0 && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[0.6875rem] text-amber-600">
            <Info size={11} className="shrink-0 mt-0.5" />
            <span>{readiness.missingItems.join('. ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
