// ─── Attribute Testing Step V2 ───────────────────────────────────────────
// Control-level Population + Sampling + Validation Workflows on top, then
// per-attribute mini-steppers for sample-based attrs and one-shot cards for
// generic attrs. Renders one of three layouts (A/B/C) selected from a
// top-right segmented switcher, so the user can pick the IA they like best.
//
// Data model assumptions:
//   • One control = one population = one sample set (shared across all
//     SAMPLE_BASED attributes).
//   • GENERIC attributes live outside the sample loop — single upload + P/F.
//   • Validation workflows are control-level. Empty list shows a CTA into
//     the workflow-builder chat.

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Upload, Database, Shuffle, Workflow as WorkflowIcon, Sparkles,
  ChevronRight, ChevronDown, Check, AlertTriangle, Play, RotateCcw,
  Lock, CheckCircle2, Loader2, Paperclip, FileText, Settings2, Plus,
  Layers as LayersIcon, X, Wand2,
} from 'lucide-react';
import type {
  ExecutionControl, Attribute, AttributeRound, TestItem,
  SamplingConfig, ValidationWorkflow, GenericAttributeResult,
} from './types';
import {
  AttrResult, AttrScope, AttrSource, ControlExecStatus,
  SampleResult, SamplingMethod,
} from './types';

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  ctrl: ExecutionControl;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
  onNavigate: (stepId: string) => void;
  /** Hand off to the AI Concierge workflow builder with a seed prompt. */
  onLaunchWorkflowBuilder?: (seedPrompt: string) => void;
}

type LayoutVariant = 'A' | 'B' | 'C';
const LAYOUT_STORAGE_KEY = 'iram.attrTesting.layoutVariant.v1';

// ─── Root ────────────────────────────────────────────────────────────────

export default function AttributeTestingStepV2({ ctrl, onUpdateControl, onNavigate, onLaunchWorkflowBuilder }: Props) {
  const [layout, setLayout] = useState<LayoutVariant>(() => {
    if (typeof window === 'undefined') return 'A';
    return (localStorage.getItem(LAYOUT_STORAGE_KEY) as LayoutVariant) || 'A';
  });
  useEffect(() => {
    try { localStorage.setItem(LAYOUT_STORAGE_KEY, layout); } catch {/* ignore */}
  }, [layout]);

  // Empty state: no attributes
  if (ctrl.attributes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle size={20} className="text-amber-500 mb-3" />
        <h4 className="text-[0.875rem] font-semibold text-text mb-1">No attributes defined</h4>
        <p className="text-[0.75rem] text-text-muted">Add attributes on the Overview step before testing.</p>
      </div>
    );
  }

  const shared = { ctrl, onUpdateControl, onLaunchWorkflowBuilder, onNavigate };

  return (
    <div className="space-y-4">
      {/* Top bar — title + version switcher */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.6875rem] text-text-muted">
            Configure sampling + evidence validation at the control level, then walk each attribute.
          </p>
        </div>
        <LayoutSwitcher value={layout} onChange={setLayout} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={layout} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {layout === 'A' && <LayoutA {...shared} />}
          {layout === 'B' && <LayoutB {...shared} />}
          {layout === 'C' && <LayoutC {...shared} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Version switcher ─────────────────────────────────────────────────────

function LayoutSwitcher({ value, onChange }: { value: LayoutVariant; onChange: (v: LayoutVariant) => void }) {
  const opts: { id: LayoutVariant; label: string; sub: string }[] = [
    { id: 'A', label: 'A', sub: 'Sticky steps + cards' },
    { id: 'B', label: 'B', sub: 'Two-pane' },
    { id: 'C', label: 'C', sub: 'Single timeline' },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.625rem] text-text-muted font-semibold uppercase tracking-wider">Layout</span>
      <div className="inline-flex bg-surface-2/60 rounded-lg p-0.5 border border-border-light">
        {opts.map(o => (
          <button key={o.id} onClick={() => onChange(o.id)}
            title={o.sub}
            className={`px-2.5 h-7 rounded text-[0.6875rem] font-bold cursor-pointer transition-colors ${
              value === o.id ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
      <span className="text-[0.75rem] text-text-muted">{opts.find(o => o.id === value)?.sub}</span>
    </div>
  );
}

// ─── Shared building blocks ──────────────────────────────────────────────

interface SharedProps {
  ctrl: ExecutionControl;
  onUpdateControl: (updater: (ctrl: ExecutionControl) => ExecutionControl) => void;
  onLaunchWorkflowBuilder?: (seedPrompt: string) => void;
  onNavigate: (stepId: string) => void;
}

function sampleBasedAttrs(ctrl: ExecutionControl): Attribute[] {
  return ctrl.attributes.filter(a => a.scope === AttrScope.SAMPLE_BASED);
}
function genericAttrs(ctrl: ExecutionControl): Attribute[] {
  return ctrl.attributes.filter(a => a.scope === AttrScope.GENERIC);
}

// ── Population card ─────────────────────────────────────────────────────
function PopulationCard({ ctrl, onUpdateControl }: { ctrl: ExecutionControl; onUpdateControl: SharedProps['onUpdateControl'] }) {
  const pop = ctrl.execution.population;
  return (
    <div className="rounded-xl border border-border-light bg-white">
      <div className="px-5 py-3 flex items-center gap-3 border-b border-border-light">
        <StepBadge done={!!pop} number={1} />
        <div className="flex-1 min-w-0">
          <h5 className="text-[0.8125rem] font-bold text-text">Define population</h5>
          <p className="text-[0.75rem] text-text-muted">Upload the dataset this control will be tested against.</p>
        </div>
      </div>
      <div className="px-5 py-4">
        {pop ? (
          <div className="rounded-lg border border-emerald-200/40 bg-emerald-50/20 px-4 py-3 flex items-center gap-3">
            <Database size={14} className="text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[0.75rem] text-text font-medium truncate">{pop.source}</div>
              <div className="text-[0.625rem] text-text-muted">{pop.rowCount.toLocaleString()} rows · test unit: {pop.testUnit}</div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-emerald-100 text-emerald-700">Locked</span>
            <button onClick={() => onUpdateControl(p => ({ ...p, execution: { ...p.execution, population: null, sampling: null, testItems: [] } }))}
              className="text-[0.625rem] text-text-muted hover:text-primary cursor-pointer">Replace</button>
          </div>
        ) : (
          <button onClick={() => {
            // Demo: populate from a synthetic 12-row dataset
            const rows = Array.from({ length: 12 }, (_, i) => ({ rowIndex: i + 1, department: `Dept ${i + 1}`, fyBudget: 1_000_000 + i * 250_000 }));
            onUpdateControl(prev => ({
              ...prev,
              execution: {
                ...prev.execution,
                population: { id: `pop-${Date.now()}`, source: 'population_upload.xlsx', rows, rowCount: rows.length, locked: true, lockedAt: new Date().toISOString(), checksum: 'sha256:demo', testUnit: 'Row' },
              },
            }));
          }}
            className="w-full rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 py-6 px-4 cursor-pointer transition-colors flex flex-col items-center gap-2">
            <Upload size={16} className="text-primary" />
            <span className="text-[0.75rem] font-semibold text-primary">Upload population (.xlsx / .csv)</span>
            <span className="text-[0.625rem] text-text-muted">Click to add — drag-drop wired in production.</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sampling card ───────────────────────────────────────────────────────
function SamplingCard({ ctrl, onUpdateControl, onLaunchWorkflowBuilder }: { ctrl: ExecutionControl; onUpdateControl: SharedProps['onUpdateControl']; onLaunchWorkflowBuilder?: SharedProps['onLaunchWorkflowBuilder'] }) {
  const sampling = ctrl.execution.sampling;
  const pop = ctrl.execution.population;
  const [method, setMethod] = useState<SamplingMethod>(sampling?.method || SamplingMethod.RANDOM);
  const [size, setSize] = useState<number>(sampling?.sampleSize || 25);
  const [filterDesc, setFilterDesc] = useState<string>(sampling?.filterDescription || '');

  const done = !!sampling?.generatedAt;
  const popReady = !!pop;
  const locked = !popReady;

  const generateSamples = () => {
    if (!pop) return;
    const cap = Math.min(size, pop.rowCount);
    const indices = Array.from({ length: cap }, (_, i) => Math.floor((i / cap) * pop.rowCount));
    const items: TestItem[] = indices.map((idx, i) => {
      const row = pop.rows[idx] as Record<string, unknown>;
      const attrResults = ctrl.attributes
        .filter(a => a.scope === AttrScope.SAMPLE_BASED)
        .map(a => ({ attributeId: a.id, result: AttrResult.NOT_TESTED, source: AttrSource.MANUAL, evidenceIds: [] as string[], notes: '', testedAt: null, testedBy: null }));
      const refPrefix = pop.testUnit?.slice(0, 3).toUpperCase() || 'SMP';
      return {
        id: `ti-${ctrl.id}-${Date.now()}-${i}`,
        referenceId: `${refPrefix}-${(i + 1).toString().padStart(3, '0')}`,
        description: (row && (row.department || row.referenceId || row.id)) ? String(row.department || row.referenceId || row.id) : `Sample ${i + 1}`,
        sourceRow: idx,
        evidence: [],
        attributeResults: attrResults,
        sampleResult: SampleResult.PENDING,
      };
    });
    const config: SamplingConfig = {
      method, sampleSize: cap, filterDescription: filterDesc || undefined,
      generatedAt: new Date().toISOString(), sampleItemIds: items.map(i => i.id),
    };
    onUpdateControl(prev => ({
      ...prev,
      execution: { ...prev.execution, sampling: config, testItems: items, status: ControlExecStatus.TEST_ITEMS_READY },
    }));
  };

  return (
    <div className={`rounded-xl border ${locked ? 'border-border-light bg-surface-2/20' : 'border-border-light bg-white'}`}>
      <div className="px-5 py-3 flex items-center gap-3 border-b border-border-light">
        <StepBadge done={done} number={2} disabled={locked} />
        <div className="flex-1 min-w-0">
          <h5 className="text-[0.8125rem] font-bold text-text">Configure sampling</h5>
          <p className="text-[0.75rem] text-text-muted">One sample set is shared by every sample-based attribute on this control.</p>
        </div>
        {done && (
          <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
            <CheckCircle2 size={9} />{sampling!.sampleItemIds.length} samples
          </span>
        )}
      </div>
      <div className="px-5 py-4 space-y-3">
        {locked ? (
          <p className="text-[0.6875rem] text-text-muted flex items-center gap-1.5"><Lock size={11} />Upload population first.</p>
        ) : (
          <>
            {/* Method picker */}
            <div>
              <label className="text-[0.5625rem] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Method</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { m: SamplingMethod.RANDOM,        label: 'Random',        icon: Shuffle,      desc: 'Uniform draw' },
                  { m: SamplingMethod.STATISTICAL,   label: 'Statistical',   icon: Sparkles,     desc: 'Stratified / confidence-based' },
                  { m: SamplingMethod.COLUMN_FILTER, label: 'Column filter', icon: Settings2,    desc: 'Where <col> = ...' },
                  { m: SamplingMethod.WORKFLOW,      label: 'Workflow',      icon: WorkflowIcon, desc: 'Custom logic' },
                ].map(o => (
                  <button key={o.m} onClick={() => setMethod(o.m)}
                    className={`px-2 py-2 rounded-lg border text-left cursor-pointer transition-colors ${
                      method === o.m ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border-light hover:border-primary/30'
                    }`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <o.icon size={11} className={method === o.m ? 'text-primary' : 'text-text-muted'} />
                      <span className={`text-[0.6875rem] font-bold ${method === o.m ? 'text-primary' : 'text-text'}`}>{o.label}</span>
                    </div>
                    <p className="text-[0.5625rem] text-text-muted leading-tight">{o.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {/* Method-specific config */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[0.5625rem] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Sample size</label>
                <input type="number" min={1} max={pop?.rowCount || 1000} value={size} onChange={e => setSize(Number(e.target.value))}
                  disabled={method === SamplingMethod.WORKFLOW}
                  className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[0.6875rem] text-text bg-white outline-none focus:border-primary/40 transition-all disabled:bg-surface-2 disabled:text-text-muted" />
                <p className="text-[0.5625rem] text-text-muted mt-1">Capped at population size ({pop?.rowCount.toLocaleString() || 0}).</p>
              </div>
              {method === SamplingMethod.COLUMN_FILTER && (
                <div>
                  <label className="text-[0.5625rem] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Filter</label>
                  <input value={filterDesc} onChange={e => setFilterDesc(e.target.value)}
                    placeholder="e.g. amount > 100000 AND status = 'OPEN'"
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[0.6875rem] text-text bg-white outline-none focus:border-primary/40 transition-all" />
                </div>
              )}
              {method === SamplingMethod.WORKFLOW && (
                <div className="flex items-end">
                  <button onClick={() => onLaunchWorkflowBuilder?.(`Build a sampling workflow for control "${ctrl.name}" against its population (${pop?.rowCount} rows, test unit: ${pop?.testUnit}). The workflow should output a deterministic sample list.`)}
                    className="w-full px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-[0.6875rem] font-semibold cursor-pointer hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5">
                    <Wand2 size={11} />Build sampling workflow
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={generateSamples}
                disabled={method === SamplingMethod.WORKFLOW}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-[0.6875rem] font-semibold cursor-pointer hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                <Shuffle size={11} />{done ? 'Regenerate samples' : 'Generate samples'}
              </button>
              {done && (
                <span className="text-[0.625rem] text-text-muted">Generated {new Date(sampling!.generatedAt!).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Validation workflows card ───────────────────────────────────────────
function ValidationWorkflowsCard({ ctrl, onUpdateControl, onLaunchWorkflowBuilder }: { ctrl: ExecutionControl; onUpdateControl: SharedProps['onUpdateControl']; onLaunchWorkflowBuilder?: SharedProps['onLaunchWorkflowBuilder'] }) {
  const wfs = ctrl.execution.validationWorkflows || [];
  const empty = wfs.length === 0;
  const onCreate = () => onLaunchWorkflowBuilder?.(
    `Build a workflow that validates uploaded evidence for control "${ctrl.name}" (${ctrl.attributes.length} attributes). For each evidence file, the workflow should extract data, run rule checks against the control's assertions (${ctrl.assertions.map(a => a.name).join(', ')}), and emit a Pass/Fail with reasons.`
  );

  return (
    <div className="rounded-xl border border-border-light bg-white">
      <div className="px-5 py-3 flex items-center gap-3 border-b border-border-light">
        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center"><WorkflowIcon size={11} /></div>
        <div className="flex-1 min-w-0">
          <h5 className="text-[0.8125rem] font-bold text-text">Evidence validation workflows</h5>
          <p className="text-[0.75rem] text-text-muted">Workflows that auto-validate uploaded evidence (e.g. OCR + signature check + amount tolerance).</p>
        </div>
        {!empty && (
          <button onClick={onCreate} className="text-[0.625rem] text-primary hover:underline cursor-pointer flex items-center gap-0.5"><Plus size={9} />Add workflow</button>
        )}
      </div>
      <div className="px-5 py-4">
        {empty ? (
          <div className="rounded-xl border-2 border-dashed border-blue-200/60 bg-blue-50/20 px-4 py-5 flex items-center gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><WorkflowIcon size={16} className="text-blue-600" /></div>
            <div className="flex-1 min-w-0">
              <h6 className="text-[0.75rem] font-bold text-blue-800">No workflows configured</h6>
              <p className="text-[0.75rem] text-blue-700 mt-0.5">Auto-validation reduces manual P/F. Build a workflow with IRA — describe the check in plain English and the agent scaffolds it.</p>
            </div>
            <button onClick={onCreate}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
              <Sparkles size={11} />Build with IRA
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {wfs.map(wf => (
              <div key={wf.id} className="rounded-lg border border-border-light px-3 py-2 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><WorkflowIcon size={12} className="text-blue-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.75rem] font-semibold text-text truncate">{wf.name}</div>
                  <div className="text-[0.625rem] text-text-muted truncate">{wf.description}</div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${wf.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : wf.status === 'ERROR' ? 'bg-red-50 text-red-700' : 'bg-canvas text-ink-500'}`}>{wf.status}</span>
                <button onClick={() => onUpdateControl(prev => ({ ...prev, execution: { ...prev.execution, validationWorkflows: (prev.execution.validationWorkflows || []).filter(w => w.id !== wf.id) } }))}
                  className="text-[0.625rem] text-text-muted hover:text-red-600 cursor-pointer"><X size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Attribute card (sample-based) ───────────────────────────────────────
function SampleBasedAttrCard({ ctrl, attr, expanded, onToggle, onUpdateControl }: {
  ctrl: ExecutionControl;
  attr: Attribute;
  expanded: boolean;
  onToggle: () => void;
  onUpdateControl: SharedProps['onUpdateControl'];
}) {
  const items = ctrl.execution.testItems;
  const samplingDone = !!ctrl.execution.sampling?.generatedAt;
  const summary = summariseSampleAttr(attr, items);
  const rounds = ctrl.execution.attributeRounds?.[attr.id] || [];

  return (
    <div className={`rounded-xl border ${expanded ? 'border-primary/30 bg-white' : 'border-border-light bg-white'} overflow-hidden`}>
      <button onClick={onToggle}
        disabled={!samplingDone}
        className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors cursor-pointer ${expanded ? 'bg-primary/5' : 'hover:bg-surface-2/40'} disabled:cursor-not-allowed disabled:opacity-60`}>
        <div className="flex items-center gap-3 min-w-0">
          {samplingDone ? <ChevronDown size={12} className={`text-ink-400 transition-transform ${expanded ? '' : '-rotate-90'}`} /> : <Lock size={11} className="text-ink-400" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[0.625rem] font-mono text-ink-400">{attr.id}</span>
              <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-primary/10 text-primary">SAMPLE-BASED</span>
              <span className={`px-1.5 py-0.5 rounded text-[0.5rem] font-bold ${attr.type === 'AUTOMATED' ? 'bg-evidence-50 text-evidence-700' : 'bg-canvas text-ink-600'}`}>{attr.type === 'AUTOMATED' ? 'AUTO' : 'MANUAL'}</span>
              {attr.required && <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-red-50 text-red-600">REQ</span>}
            </div>
            <div className="text-[0.75rem] font-semibold text-text truncate">{attr.name}</div>
            <div className="text-[0.625rem] text-text-muted truncate">{attr.assertionName}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {summary.fail > 0 && <span className="text-[0.625rem] font-bold text-red-600 tabular-nums">{summary.fail} fail</span>}
          {summary.pass > 0 && <span className="text-[0.625rem] font-bold text-emerald-600 tabular-nums">{summary.pass} pass</span>}
          {summary.pending > 0 && <span className="text-[0.625rem] text-text-muted tabular-nums">{summary.pending} pending</span>}
        </div>
      </button>

      {expanded && samplingDone && (
        <div className="border-t border-border-light px-4 py-4 space-y-4">
          <AttributeDescriptionBlock attr={attr} />
          <SampleEvidenceTable ctrl={ctrl} attr={attr} rounds={rounds} onUpdateControl={onUpdateControl} />
        </div>
      )}
    </div>
  );
}

// ── Attribute card (generic) ────────────────────────────────────────────
function GenericAttrCard({ ctrl, attr, expanded, onToggle, onUpdateControl }: {
  ctrl: ExecutionControl;
  attr: Attribute;
  expanded: boolean;
  onToggle: () => void;
  onUpdateControl: SharedProps['onUpdateControl'];
}) {
  const result: GenericAttributeResult | undefined = ctrl.execution.genericResults?.[attr.id];
  const evCount = result?.evidenceIds.length || 0;
  const r = result?.result || AttrResult.NOT_TESTED;

  const setResult = (next: AttrResult) => {
    const now = new Date().toISOString();
    onUpdateControl(prev => {
      const prior = prev.execution.genericResults?.[attr.id];
      const merged: GenericAttributeResult = {
        result: next,
        evidenceIds: prior?.evidenceIds || [],
        notes: prior?.notes || '',
        testedAt: now,
        testedBy: 'Current User',
      };
      return { ...prev, execution: { ...prev.execution, genericResults: { ...(prev.execution.genericResults || {}), [attr.id]: merged } } };
    });
  };
  const addEvidence = () => {
    const evId = `ev-gen-${attr.id}-${Date.now()}`;
    onUpdateControl(prev => {
      const prior = prev.execution.genericResults?.[attr.id];
      const merged: GenericAttributeResult = {
        result: prior?.result || AttrResult.NOT_TESTED,
        evidenceIds: [...(prior?.evidenceIds || []), evId],
        notes: prior?.notes || '',
        testedAt: prior?.testedAt || null,
        testedBy: prior?.testedBy || null,
      };
      return { ...prev, execution: { ...prev.execution, genericResults: { ...(prev.execution.genericResults || {}), [attr.id]: merged } } };
    });
  };
  const clearEvidence = () => onUpdateControl(prev => ({
    ...prev,
    execution: { ...prev.execution, genericResults: { ...(prev.execution.genericResults || {}), [attr.id]: { result: AttrResult.NOT_TESTED, evidenceIds: [], notes: '', testedAt: null, testedBy: null } } },
  }));

  return (
    <div className={`rounded-xl border ${expanded ? 'border-amber-300/60 bg-white' : 'border-border-light bg-white'} overflow-hidden`}>
      <button onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors cursor-pointer ${expanded ? 'bg-amber-50/30' : 'hover:bg-surface-2/40'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown size={12} className={`text-ink-400 transition-transform ${expanded ? '' : '-rotate-90'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[0.625rem] font-mono text-ink-400">{attr.id}</span>
              <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-amber-100 text-amber-700">GENERIC</span>
              {attr.required && <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-red-50 text-red-600">REQ</span>}
            </div>
            <div className="text-[0.75rem] font-semibold text-text truncate">{attr.name}</div>
            <div className="text-[0.625rem] text-text-muted truncate">{attr.assertionName} · control-level (no sample loop)</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {r === AttrResult.PASS && <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-bold bg-emerald-100 text-emerald-700">Pass</span>}
          {r === AttrResult.FAIL && <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-bold bg-red-100 text-red-700">Fail</span>}
          {r === AttrResult.NOT_TESTED && <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-bold bg-canvas text-ink-500">Pending</span>}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border-light px-4 py-4 space-y-4">
          <AttributeDescriptionBlock attr={attr} />
          <div className="rounded-lg border border-border-light">
            <div className="px-3 py-2 border-b border-border-light bg-surface-2/30 flex items-center justify-between">
              <span className="text-[0.625rem] font-bold text-text-muted uppercase tracking-wider">Evidence</span>
              <span className="text-[0.5625rem] text-text-muted tabular-nums">{evCount} file{evCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="px-3 py-3">
              {evCount === 0 ? (
                <button onClick={addEvidence}
                  className="w-full rounded-lg border-2 border-dashed border-amber-300/60 bg-amber-50/20 hover:bg-amber-50/40 py-4 px-4 cursor-pointer transition-colors flex flex-col items-center gap-1">
                  <Upload size={13} className="text-amber-600" />
                  <span className="text-[0.6875rem] font-semibold text-amber-700">Upload evidence</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Paperclip size={11} className="text-emerald-600" />
                  <span className="text-[0.6875rem] text-text">{evCount} file{evCount !== 1 ? 's' : ''} attached</span>
                  <button onClick={clearEvidence} className="ml-auto text-[0.625rem] text-text-muted hover:text-red-600 cursor-pointer">Replace</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[0.625rem] text-text-muted">Result:</span>
            <button onClick={() => setResult(AttrResult.PASS)} disabled={evCount === 0}
              className={`px-2 py-1 rounded text-[0.625rem] font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${r === AttrResult.PASS ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'bg-canvas text-ink-500 hover:bg-emerald-50'}`}>Pass</button>
            <button onClick={() => setResult(AttrResult.FAIL)} disabled={evCount === 0}
              className={`px-2 py-1 rounded text-[0.625rem] font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${r === AttrResult.FAIL ? 'bg-red-100 text-red-700 ring-1 ring-red-300' : 'bg-canvas text-ink-500 hover:bg-red-50'}`}>Fail</button>
            {r === AttrResult.FAIL && (
              <button onClick={clearEvidence} className="ml-auto px-2 py-1 rounded border border-amber-300 text-amber-700 text-[0.625rem] font-semibold cursor-pointer hover:bg-amber-50 flex items-center gap-1">
                <RotateCcw size={9} />Replace evidence and retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Attribute description + required evidence ───────────────────────────
function AttributeDescriptionBlock({ attr }: { attr: Attribute }) {
  return (
    <div className="rounded-lg bg-surface-2/30 border border-border-light px-3 py-3">
      <p className="text-[0.6875rem] text-text-secondary leading-relaxed">{attr.description}</p>
      {attr.requiredEvidenceTypes.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <span className="text-[0.5625rem] text-text-muted font-bold uppercase tracking-wider">Required evidence</span>
          {attr.requiredEvidenceTypes.map((t, i) => (
            <div key={t} className="flex items-start gap-2">
              <Paperclip size={9} className="text-text-muted mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-[0.6875rem] font-semibold text-text">{t}</span>
                {attr.evidenceDescriptions?.[i] && <p className="text-[0.625rem] text-text-muted leading-snug">{attr.evidenceDescriptions[i]}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Per-sample table for a sample-based attribute ───────────────────────
function SampleEvidenceTable({ ctrl, attr, rounds, onUpdateControl }: {
  ctrl: ExecutionControl;
  attr: Attribute;
  rounds: AttributeRound[];
  onUpdateControl: SharedProps['onUpdateControl'];
}) {
  // initial round if not present
  useEffect(() => {
    if (rounds.length > 0) return;
    onUpdateControl(prev => initRound(prev, attr.id, prev.execution.testItems.map(i => i.id)));
  }, [attr.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = rounds[rounds.length - 1];
  const scopeIds = new Set(active?.sampleIds || ctrl.execution.testItems.map(i => i.id));
  const items = ctrl.execution.testItems.filter(i => scopeIds.has(i.id));

  const upload = (sampleId: string) => {
    const evId = `ev-${attr.id}-${sampleId}-${Date.now()}`;
    onUpdateControl(prev => {
      const updated = prev.execution.testItems.map(ti => {
        if (ti.id !== sampleId) return ti;
        const evidence = [...ti.evidence, { id: evId, fileName: `${ti.referenceId}_${attr.id}.pdf`, evidenceType: attr.requiredEvidenceTypes[0] || 'Evidence', mappedAttributeIds: [attr.id], uploadedAt: new Date().toISOString(), uploadedBy: 'User' }];
        const attributeResults = ti.attributeResults.map(ar => ar.attributeId === attr.id ? { ...ar, evidenceIds: [...ar.evidenceIds, evId] } : ar);
        return { ...ti, evidence, attributeResults };
      });
      return { ...prev, execution: { ...prev.execution, testItems: updated } };
    });
  };
  const setResult = (sampleId: string, result: AttrResult) => {
    onUpdateControl(prev => {
      const updated = prev.execution.testItems.map(ti => {
        if (ti.id !== sampleId) return ti;
        const attributeResults = ti.attributeResults.map(ar => ar.attributeId === attr.id ? { ...ar, result, testedAt: new Date().toISOString(), testedBy: 'Current User' } : ar);
        return { ...ti, attributeResults };
      });
      return { ...prev, execution: { ...prev.execution, testItems: updated } };
    });
  };

  const failedIds = items.filter(i => i.attributeResults.find(r => r.attributeId === attr.id)?.result === AttrResult.FAIL).map(i => i.id);
  const allTested = items.every(i => {
    const ar = i.attributeResults.find(r => r.attributeId === attr.id);
    return ar && ar.result !== AttrResult.NOT_TESTED;
  });
  const startRoundN = () => {
    if (failedIds.length === 0 || !active) return;
    onUpdateControl(prev => {
      const next: AttributeRound = {
        roundNumber: active.roundNumber + 1, sampleIds: failedIds, startedAt: new Date().toISOString(), completedAt: null,
        populationOverrideRef: null, passCount: 0, failCount: 0, pendingCount: failedIds.length,
      };
      const items2 = prev.execution.testItems.map(ti => {
        if (!failedIds.includes(ti.id)) return ti;
        return { ...ti, evidence: ti.evidence.filter(e => !e.mappedAttributeIds.includes(attr.id)), attributeResults: ti.attributeResults.map(ar => ar.attributeId === attr.id ? { ...ar, result: AttrResult.NOT_TESTED, evidenceIds: [], testedAt: null, testedBy: null } : ar) };
      });
      return { ...prev, execution: { ...prev.execution, testItems: items2, attributeRounds: { ...prev.execution.attributeRounds, [attr.id]: [...(prev.execution.attributeRounds?.[attr.id] || []), next] } } };
    });
  };

  return (
    <div className="space-y-3">
      {rounds.length > 1 && (
        <div className="text-[0.625rem] text-text-muted">
          Round <strong className="text-text">{active.roundNumber}</strong> · scope is {active.sampleIds.length} failed sample{active.sampleIds.length !== 1 ? 's' : ''} from prior round.
        </div>
      )}

      <div className="rounded-lg border border-border-light overflow-hidden">
        <table className="w-full text-[0.625rem]">
          <thead>
            <tr className="bg-surface-2/40 border-b border-border-light">
              <th className="px-3 py-1.5 text-left text-[0.5625rem] font-bold text-text-muted uppercase tracking-wider">#</th>
              <th className="px-3 py-1.5 text-left text-[0.5625rem] font-bold text-text-muted uppercase tracking-wider">Sample</th>
              <th className="px-3 py-1.5 text-left text-[0.5625rem] font-bold text-text-muted uppercase tracking-wider">Description</th>
              <th className="px-3 py-1.5 text-left text-[0.5625rem] font-bold text-text-muted uppercase tracking-wider">Evidence</th>
              <th className="px-3 py-1.5 text-left text-[0.5625rem] font-bold text-text-muted uppercase tracking-wider">Result</th>
            </tr>
          </thead>
          <tbody>
            {items.map((ti, idx) => {
              const ar = ti.attributeResults.find(r => r.attributeId === attr.id);
              const ev = ar?.evidenceIds.length || 0;
              const r = ar?.result || AttrResult.NOT_TESTED;
              return (
                <tr key={ti.id} className="border-b border-border-light/70 last:border-b-0">
                  <td className="px-3 py-1.5 text-text-muted tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-1.5 font-mono text-text">{ti.referenceId}</td>
                  <td className="px-3 py-1.5 text-text truncate max-w-[280px]">{ti.description}</td>
                  <td className="px-3 py-1.5">
                    {ev > 0 ? (
                      <span className="text-emerald-600 inline-flex items-center gap-0.5"><Paperclip size={8} />{ev}</span>
                    ) : (
                      <button onClick={() => upload(ti.id)} className="text-primary hover:underline cursor-pointer inline-flex items-center gap-0.5"><Upload size={8} />Upload</button>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setResult(ti.id, AttrResult.PASS)} disabled={ev === 0}
                        className={`px-1.5 py-0.5 rounded text-[0.5625rem] font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${r === AttrResult.PASS ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'bg-canvas text-ink-500 hover:bg-emerald-50'}`}>Pass</button>
                      <button onClick={() => setResult(ti.id, AttrResult.FAIL)} disabled={ev === 0}
                        className={`px-1.5 py-0.5 rounded text-[0.5625rem] font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${r === AttrResult.FAIL ? 'bg-red-100 text-red-700 ring-1 ring-red-300' : 'bg-canvas text-ink-500 hover:bg-red-50'}`}>Fail</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {allTested && failedIds.length > 0 && (
        <button onClick={startRoundN}
          className="w-full rounded-lg border-2 border-dashed border-amber-300/60 bg-amber-50/20 hover:bg-amber-50/40 py-2.5 px-3 cursor-pointer transition-colors flex items-center justify-center gap-2">
          <RotateCcw size={11} className="text-amber-600" />
          <span className="text-[0.6875rem] font-semibold text-amber-700">Start Round {(active?.roundNumber || 1) + 1} for {failedIds.length} failed sample{failedIds.length !== 1 ? 's' : ''}</span>
        </button>
      )}
    </div>
  );
}

function initRound(prev: ExecutionControl, attrId: string, sampleIds: string[]): ExecutionControl {
  const existing = prev.execution.attributeRounds?.[attrId] || [];
  if (existing.length > 0) return prev;
  const round: AttributeRound = {
    roundNumber: 1, sampleIds, startedAt: new Date().toISOString(), completedAt: null,
    populationOverrideRef: null, passCount: 0, failCount: 0, pendingCount: sampleIds.length,
  };
  return { ...prev, execution: { ...prev.execution, attributeRounds: { ...prev.execution.attributeRounds, [attrId]: [round] } } };
}

function summariseSampleAttr(attr: Attribute, items: TestItem[]): { pass: number; fail: number; pending: number } {
  let pass = 0, fail = 0, pending = 0;
  for (const ti of items) {
    const ar = ti.attributeResults.find(r => r.attributeId === attr.id);
    if (!ar) { pending++; continue; }
    if (ar.result === AttrResult.PASS) pass++;
    else if (ar.result === AttrResult.FAIL) fail++;
    else pending++;
  }
  return { pass, fail, pending };
}

// ── Step badge ──────────────────────────────────────────────────────────
function StepBadge({ number, done, disabled }: { number: number; done?: boolean; disabled?: boolean }) {
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-bold ${
      disabled ? 'bg-canvas text-ink-400' :
      done ? 'bg-emerald-500 text-white' :
      'bg-primary text-white'
    }`}>
      {done ? <Check size={11} /> : number}
    </div>
  );
}

// ─── Layout A: Sticky control steps + attribute card list ─────────────────

function LayoutA({ ctrl, onUpdateControl, onLaunchWorkflowBuilder, onNavigate }: SharedProps) {
  const [expandedAttrId, setExpandedAttrId] = useState<string | null>(null);
  const sampling = ctrl.execution.sampling;

  return (
    <div className="space-y-5">
      {/* Control-level header */}
      <div className="space-y-3">
        <PopulationCard ctrl={ctrl} onUpdateControl={onUpdateControl} />
        <SamplingCard ctrl={ctrl} onUpdateControl={onUpdateControl} onLaunchWorkflowBuilder={onLaunchWorkflowBuilder} />
        <ValidationWorkflowsCard ctrl={ctrl} onUpdateControl={onUpdateControl} onLaunchWorkflowBuilder={onLaunchWorkflowBuilder} />
      </div>

      {/* Attribute list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-[0.75rem] font-bold text-text uppercase tracking-wider">Attributes ({ctrl.attributes.length})</h5>
          <span className="text-[0.625rem] text-text-muted">{sampling?.generatedAt ? `Sample set: ${sampling.sampleItemIds.length} items` : 'Locked until sampling complete'}</span>
        </div>
        <div className="space-y-2">
          {ctrl.attributes.map(attr => attr.scope === AttrScope.GENERIC
            ? <GenericAttrCard key={attr.id} ctrl={ctrl} attr={attr} expanded={expandedAttrId === attr.id} onToggle={() => setExpandedAttrId(expandedAttrId === attr.id ? null : attr.id)} onUpdateControl={onUpdateControl} />
            : <SampleBasedAttrCard key={attr.id} ctrl={ctrl} attr={attr} expanded={expandedAttrId === attr.id} onToggle={() => setExpandedAttrId(expandedAttrId === attr.id ? null : attr.id)} onUpdateControl={onUpdateControl} />
          )}
        </div>
      </div>

      {/* Working paper CTA */}
      <NextCta ctrl={ctrl} onNavigate={onNavigate} />
    </div>
  );
}

// ─── Layout B: Two-pane (left rail + right detail) ────────────────────────

function LayoutB({ ctrl, onUpdateControl, onLaunchWorkflowBuilder, onNavigate }: SharedProps) {
  type Selection = { kind: 'pop' } | { kind: 'sampling' } | { kind: 'workflows' } | { kind: 'attr'; attrId: string };
  const [sel, setSel] = useState<Selection>({ kind: 'pop' });
  const pop = ctrl.execution.population;
  const sampling = ctrl.execution.sampling;

  return (
    <div className="grid grid-cols-[260px_1fr] gap-4">
      {/* Left rail */}
      <div className="rounded-xl border border-border-light bg-white overflow-hidden h-fit sticky top-0">
        <div className="px-3 py-2 border-b border-border-light bg-surface-2/40">
          <h5 className="text-[0.625rem] font-bold text-text uppercase tracking-wider">Control</h5>
        </div>
        <div className="px-1.5 py-1.5 space-y-0.5">
          <RailItem active={sel.kind === 'pop'} onClick={() => setSel({ kind: 'pop' })}
            icon={Database} title="Population" sub={pop ? `${pop.rowCount} rows` : 'Not uploaded'} done={!!pop} />
          <RailItem active={sel.kind === 'sampling'} onClick={() => setSel({ kind: 'sampling' })}
            icon={Shuffle} title="Sampling" sub={sampling?.generatedAt ? `${sampling.sampleItemIds.length} samples` : 'Not configured'} done={!!sampling?.generatedAt} disabled={!pop} />
          <RailItem active={sel.kind === 'workflows'} onClick={() => setSel({ kind: 'workflows' })}
            icon={WorkflowIcon} title="Validation workflows" sub={(ctrl.execution.validationWorkflows?.length || 0) > 0 ? `${ctrl.execution.validationWorkflows!.length} configured` : 'None configured'} />
        </div>
        <div className="px-3 py-2 border-y border-border-light bg-surface-2/40">
          <h5 className="text-[0.625rem] font-bold text-text uppercase tracking-wider">Attributes ({ctrl.attributes.length})</h5>
        </div>
        <div className="px-1.5 py-1.5 space-y-0.5 max-h-[420px] overflow-y-auto">
          {ctrl.attributes.map(attr => {
            const summary = attr.scope === AttrScope.SAMPLE_BASED ? summariseSampleAttr(attr, ctrl.execution.testItems) : null;
            const gen = ctrl.execution.genericResults?.[attr.id];
            const active = sel.kind === 'attr' && sel.attrId === attr.id;
            return (
              <button key={attr.id} onClick={() => setSel({ kind: 'attr', attrId: attr.id })}
                disabled={attr.scope === AttrScope.SAMPLE_BASED && !sampling?.generatedAt}
                className={`w-full text-left px-2 py-1.5 rounded transition-colors cursor-pointer ${active ? 'bg-primary/10 text-primary' : 'hover:bg-surface-2'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`text-[0.4375rem] font-bold px-1 py-0.5 rounded ${attr.scope === AttrScope.GENERIC ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>{attr.scope === AttrScope.GENERIC ? 'GEN' : 'SMP'}</span>
                  <span className="text-[0.6875rem] font-semibold truncate">{attr.name}</span>
                </div>
                <div className="text-[0.5625rem] text-text-muted">
                  {summary ? (summary.fail > 0 ? `${summary.fail} fail` : summary.pass > 0 ? `${summary.pass} pass` : `${summary.pending} pending`) :
                    (gen?.result === AttrResult.PASS ? 'Pass' : gen?.result === AttrResult.FAIL ? 'Fail' : 'Pending')}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right detail */}
      <div className="min-w-0">
        {sel.kind === 'pop' && <PopulationCard ctrl={ctrl} onUpdateControl={onUpdateControl} />}
        {sel.kind === 'sampling' && <SamplingCard ctrl={ctrl} onUpdateControl={onUpdateControl} onLaunchWorkflowBuilder={onLaunchWorkflowBuilder} />}
        {sel.kind === 'workflows' && <ValidationWorkflowsCard ctrl={ctrl} onUpdateControl={onUpdateControl} onLaunchWorkflowBuilder={onLaunchWorkflowBuilder} />}
        {sel.kind === 'attr' && (() => {
          const attr = ctrl.attributes.find(a => a.id === sel.attrId)!;
          if (attr.scope === AttrScope.GENERIC) return <GenericAttrCard ctrl={ctrl} attr={attr} expanded={true} onToggle={() => {}} onUpdateControl={onUpdateControl} />;
          return <SampleBasedAttrCard ctrl={ctrl} attr={attr} expanded={true} onToggle={() => {}} onUpdateControl={onUpdateControl} />;
        })()}
        <div className="mt-4"><NextCta ctrl={ctrl} onNavigate={onNavigate} /></div>
      </div>
    </div>
  );
}

function RailItem({ active, onClick, icon: Icon, title, sub, done, disabled }: {
  active: boolean; onClick: () => void; icon: React.ElementType; title: string; sub: string; done?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-full text-left px-2 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-2 ${active ? 'bg-primary/10 text-primary' : 'hover:bg-surface-2'} disabled:opacity-40 disabled:cursor-not-allowed`}>
      <Icon size={12} className={active ? 'text-primary' : 'text-text-muted'} />
      <div className="flex-1 min-w-0">
        <div className={`text-[0.6875rem] font-semibold truncate ${active ? 'text-primary' : 'text-text'}`}>{title}</div>
        <div className="text-[0.5625rem] text-text-muted truncate">{sub}</div>
      </div>
      {done && <Check size={10} className="text-emerald-600" />}
    </button>
  );
}

// ─── Layout C: Single tall vertical timeline ──────────────────────────────

function LayoutC({ ctrl, onUpdateControl, onLaunchWorkflowBuilder, onNavigate }: SharedProps) {
  const [expandedAttrId, setExpandedAttrId] = useState<string | null>(null);
  const samplingDone = !!ctrl.execution.sampling?.generatedAt;

  return (
    <div>
      <ol className="space-y-3">
        <TimelineNode num={1} title="Define population" done={!!ctrl.execution.population}>
          <PopulationCard ctrl={ctrl} onUpdateControl={onUpdateControl} />
        </TimelineNode>
        <TimelineNode num={2} title="Configure sampling" done={samplingDone}>
          <SamplingCard ctrl={ctrl} onUpdateControl={onUpdateControl} onLaunchWorkflowBuilder={onLaunchWorkflowBuilder} />
        </TimelineNode>
        <TimelineNode num={3} title="Evidence validation workflows" done={(ctrl.execution.validationWorkflows?.length || 0) > 0} optional>
          <ValidationWorkflowsCard ctrl={ctrl} onUpdateControl={onUpdateControl} onLaunchWorkflowBuilder={onLaunchWorkflowBuilder} />
        </TimelineNode>
        {ctrl.attributes.map((attr, i) => (
          <TimelineNode key={attr.id} num={4 + i} title={`Test attribute · ${attr.name}`} done={attrDone(ctrl, attr)} locked={attr.scope === AttrScope.SAMPLE_BASED && !samplingDone}>
            {attr.scope === AttrScope.GENERIC
              ? <GenericAttrCard ctrl={ctrl} attr={attr} expanded={expandedAttrId === attr.id} onToggle={() => setExpandedAttrId(expandedAttrId === attr.id ? null : attr.id)} onUpdateControl={onUpdateControl} />
              : <SampleBasedAttrCard ctrl={ctrl} attr={attr} expanded={expandedAttrId === attr.id} onToggle={() => setExpandedAttrId(expandedAttrId === attr.id ? null : attr.id)} onUpdateControl={onUpdateControl} />}
          </TimelineNode>
        ))}
      </ol>
      <div className="mt-4"><NextCta ctrl={ctrl} onNavigate={onNavigate} /></div>
    </div>
  );
}

function TimelineNode({ num, title, done, locked, optional, children }: { num: number; title: string; done?: boolean; locked?: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[0.6875rem] font-bold ${
          locked ? 'bg-canvas text-ink-400' :
          done ? 'bg-emerald-500 text-white' :
          'bg-primary text-white'
        }`}>{done ? <Check size={12} /> : num}</div>
        <div className={`w-px flex-1 mt-1 ${done ? 'bg-emerald-200' : 'bg-border'}`} />
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <h5 className="text-[0.75rem] font-bold text-text">{title}</h5>
          {optional && <span className="text-[0.5625rem] text-text-muted font-medium">(optional)</span>}
          {locked && <span className="text-[0.5625rem] text-text-muted flex items-center gap-1"><Lock size={9} />Locked</span>}
        </div>
        {children}
      </div>
    </li>
  );
}

function attrDone(ctrl: ExecutionControl, attr: Attribute): boolean {
  if (attr.scope === AttrScope.GENERIC) {
    const r = ctrl.execution.genericResults?.[attr.id]?.result;
    return r === AttrResult.PASS || r === AttrResult.FAIL;
  }
  if (ctrl.execution.testItems.length === 0) return false;
  return ctrl.execution.testItems.every(ti => {
    const ar = ti.attributeResults.find(x => x.attributeId === attr.id);
    return ar && ar.result !== AttrResult.NOT_TESTED;
  });
}

// ─── Next CTA ─────────────────────────────────────────────────────────────

function NextCta({ ctrl, onNavigate }: { ctrl: ExecutionControl; onNavigate: SharedProps['onNavigate'] }) {
  const allDone = ctrl.attributes.every(a => attrDone(ctrl, a));
  return (
    <button onClick={() => onNavigate('working-paper')} disabled={!allDone}
      className="ml-auto px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:hover:bg-ink-300">
      Working paper<ChevronRight size={11} />
    </button>
  );
}
