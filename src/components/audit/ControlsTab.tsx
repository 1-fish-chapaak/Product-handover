/**
 * Controls tab — one row per unique control for this engagement's process.
 * KPI strip + filter row + expandable control rows with per-attribute
 * Workflows / Evidence / Sample cards. All side-effects are local + toasts.
 */

import { useMemo, useState, useRef, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, ChevronRight, Sparkles, Search, Upload, X, Plus,
  FileText, Image as ImageIcon, FileSpreadsheet, Check, AlertCircle,
  Link2, Workflow as WorkflowIcon, ClipboardList,
  CheckCircle2, Circle,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import type { Engagement } from '../../data/engagements';
import { RACM_LIBRARY, racmRowsForProcess, type RACMRow, type ControlAttribute } from '../../data/racm';
import { OWNER_NAMES, PEOPLE } from '../../data/grc-domain';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props { engagement: Engagement }

type ControlStatus = 'Effective' | 'In Test' | 'Failed' | 'Pending';
type StatusFilter = 'All' | ControlStatus;
type FrequencyFilter = 'All' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual' | 'Event-driven';
type WorkflowStatus = 'Active' | 'Draft' | 'Paused';
type EvidenceKind = 'PDF' | 'IMG' | 'XLSX';
type SampleMethod = 'Random' | 'Statistical' | 'Business-rule' | 'Manual upload';
type SampleResult = 'Pass' | 'Fail' | 'Pending';
type WorkingPaperStatus = 'Draft' | 'Reviewed' | 'Signed-off';

interface LinkedWorkflow { id: string; name: string; status: WorkflowStatus }
interface EvidenceFile { id: string; name: string; kind: EvidenceKind; size: string; uploader: string }
interface Sample { id: string; ref: string; result: SampleResult; remark: string }
interface AiSuggestion { id: string; name: string; confidence: number }
interface ManualWorkflowOption { id: string; name: string; status: WorkflowStatus }

// ─── Static lookups ───────────────────────────────────────────────────────────

const STATUS_PILLS: StatusFilter[] = ['All', 'Effective', 'In Test', 'Failed', 'Pending'];
const FREQ_OPTIONS: FrequencyFilter[] = ['All', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Event-driven'];
const SAMPLE_METHODS: SampleMethod[] = ['Random', 'Statistical', 'Business-rule', 'Manual upload'];
const SAMPLE_RESULTS: SampleResult[] = ['Pass', 'Fail', 'Pending'];

const CONTROL_STATUS_CLS: Record<ControlStatus, string> = {
  Effective: 'bg-compliant-50 text-compliant-700 border-compliant-50',
  'In Test': 'bg-evidence-50 text-evidence-700 border-evidence-100',
  Failed:    'bg-risk-50 text-risk-700 border-risk-50',
  Pending:   'bg-draft-50 text-draft-700 border-canvas-border',
};
const CONTROL_STATUS_DOT: Record<ControlStatus, string> = {
  Effective: 'bg-compliant', 'In Test': 'bg-evidence-600', Failed: 'bg-risk', Pending: 'bg-draft',
};
const WORKFLOW_STATUS_DOT: Record<WorkflowStatus, string> = {
  Active: 'bg-compliant', Draft: 'bg-draft', Paused: 'bg-mitigated-500',
};
const WORKING_PAPER_CLS: Record<WorkingPaperStatus, string> = {
  Draft:        'bg-draft-50 text-draft-700 border-canvas-border',
  Reviewed:     'bg-evidence-50 text-evidence-700 border-evidence-100',
  'Signed-off': 'bg-compliant-50 text-compliant-700 border-compliant-50',
};
const SAMPLE_RESULT_CLS: Record<SampleResult, { active: string; idle: string }> = {
  Pass:    { active: 'bg-compliant-50 text-compliant-700 border-compliant-50 ring-2 ring-compliant/15', idle: 'border-canvas-border text-ink-500 hover:bg-compliant-50/40 hover:text-compliant-700' },
  Fail:    { active: 'bg-risk-50 text-risk-700 border-risk-50 ring-2 ring-risk/15',                     idle: 'border-canvas-border text-ink-500 hover:bg-risk-50/40 hover:text-risk-700' },
  Pending: { active: 'bg-draft-50 text-draft-700 border-canvas-border ring-2 ring-draft/15',            idle: 'border-canvas-border text-ink-500 hover:bg-draft-50/40' },
};
const EVIDENCE_ICON: Record<EvidenceKind, { Icon: typeof FileText; cls: string }> = {
  PDF:  { Icon: FileText,        cls: 'text-risk-700 bg-risk-50' },
  IMG:  { Icon: ImageIcon,       cls: 'text-evidence-700 bg-evidence-50' },
  XLSX: { Icon: FileSpreadsheet, cls: 'text-compliant-700 bg-compliant-50' },
};

// ─── Deterministic hash + mock helpers ────────────────────────────────────────

/** Deterministic string→int hash so demo data is stable per id. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function statusForControl(controlId: string, engagementHealth: number): ControlStatus {
  // Use health as a soft prior — healthier engagements skew toward Effective.
  const h = hash(controlId);
  const r = h % 100;
  if (engagementHealth === 0) {
    // Not started — almost everything is Pending or In Test.
    return r < 70 ? 'Pending' : 'In Test';
  }
  const effectiveCut = Math.min(82, engagementHealth);
  const inTestCut = effectiveCut + 10;
  const failedCut = inTestCut + 5;
  if (r < effectiveCut) return 'Effective';
  if (r < inTestCut) return 'In Test';
  if (r < failedCut) return 'Failed';
  return 'Pending';
}

function workingPaperFor(attributeId: string): WorkingPaperStatus {
  const r = hash(attributeId) % 100;
  if (r < 40) return 'Draft';
  if (r < 75) return 'Reviewed';
  return 'Signed-off';
}

function lastTestedFor(controlId: string): string {
  const days = (hash(controlId) % 13) + 1;
  if (days === 1) return 'Last tested 1d ago';
  return `Last tested ${days}d ago`;
}

const AI_SUGGESTIONS: AiSuggestion[] = [
  { id: 'ai-wf-1', name: 'Three-Way Match (PO · GRN · Invoice)', confidence: 92 },
  { id: 'ai-wf-2', name: 'Duplicate Invoice Detector',           confidence: 78 },
  { id: 'ai-wf-3', name: 'PO Approval Threshold Scan',           confidence: 64 },
];
const MANUAL_WORKFLOW_LIBRARY: ManualWorkflowOption[] = [
  { id: 'wf-l-1', name: 'Vendor Master Change Monitor',       status: 'Active' },
  { id: 'wf-l-2', name: 'Sanctions List Screening',           status: 'Active' },
  { id: 'wf-l-3', name: 'GRN Quantity Tolerance Check',       status: 'Active' },
  { id: 'wf-l-4', name: 'Bank Account Change Verification',   status: 'Paused' },
  { id: 'wf-l-5', name: 'SoD Conflict Scan — P2P Roles',      status: 'Active' },
  { id: 'wf-l-6', name: 'Payment Run Dual Sign-off Audit',    status: 'Active' },
  { id: 'wf-l-7', name: 'Vendor Bank Account Mismatch Alert', status: 'Draft' },
  { id: 'wf-l-8', name: 'Tolerance Break Approver Validation',status: 'Active' },
];

function ownerForControl(controlId: string): string {
  return OWNER_NAMES[hash(controlId) % OWNER_NAMES.length] ?? OWNER_NAMES[0];
}

function confidenceTone(c: number): { bar: string; text: string } {
  if (c >= 85) return { bar: 'bg-compliant', text: 'text-compliant-700' };
  if (c >= 65) return { bar: 'bg-mitigated-500', text: 'text-mitigated-700' };
  return { bar: 'bg-ink-400', text: 'text-ink-500' };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindForFile(name: string): EvidenceKind {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'PDF';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) return 'XLSX';
  return 'IMG';
}

// ─── Distinct control list (one row per unique controlId) ────────────────────

interface DistinctControl {
  controlId: string;
  description: string;
  isKey: boolean;
  subProcess: string;
  frequency: RACMRow['frequency'];
  attributes: ControlAttribute[];
}

function distinctControlsForEngagement(eng: Engagement): DistinctControl[] {
  const rows = racmRowsForProcess(eng.process);
  // Fall back to the entire library if this process has no rows yet (S2C, R2R…).
  const usable = rows.length > 0 ? rows : RACM_LIBRARY;
  const byId = new Map<string, DistinctControl>();
  usable.forEach(r => {
    if (byId.has(r.controlId)) return;
    byId.set(r.controlId, {
      controlId: r.controlId,
      description: r.controlDescription,
      isKey: r.isKey,
      subProcess: r.subProcess,
      frequency: r.frequency,
      attributes: r.attributes,
    });
  });
  return Array.from(byId.values());
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ControlsTab({ engagement }: Props): JSX.Element {
  const { addToast } = useToast();

  const controls = useMemo(() => distinctControlsForEngagement(engagement), [engagement]);

  // ── Filter state
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('All');
  const [keyOnly, setKeyOnly] = useState<boolean>(false);
  const [subProcessFilter, setSubProcessFilter] = useState<string>('All');
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('All');
  const [search, setSearch] = useState<string>('');

  // ── Expansion state
  const [expandedControlIds, setExpandedControlIds] = useState<Set<string>>(() => new Set());

  // ── Per-attribute data stores
  const [linkedWorkflows, setLinkedWorkflows] = useState<Record<string, LinkedWorkflow[]>>({});
  const [evidence, setEvidence] = useState<Record<string, EvidenceFile[]>>({});
  const [samples, setSamples] = useState<Record<string, Sample[]>>({});
  const [sampleMethods, setSampleMethods] = useState<Record<string, SampleMethod>>({});

  // ── Popover state
  const [aiPopover, setAiPopover] = useState<{ attributeId: string | null }>({ attributeId: null });
  const [linkPopover, setLinkPopover] = useState<{ attributeId: string | null }>({ attributeId: null });
  const [linkSearch, setLinkSearch] = useState<string>('');

  // ── Per-control statuses (memoised; deterministic per engagement)
  const controlStatuses = useMemo(() => {
    const m = new Map<string, ControlStatus>();
    controls.forEach(c => m.set(c.controlId, statusForControl(c.controlId, engagement.health)));
    return m;
  }, [controls, engagement.health]);

  // ── Distinct sub-processes for chip set
  const subProcesses = useMemo(() => {
    const set = new Set<string>();
    controls.forEach(c => set.add(c.subProcess));
    return Array.from(set);
  }, [controls]);

  // ── Filtered controls
  const filteredControls = useMemo(() => {
    const q = search.trim().toLowerCase();
    return controls.filter(c => {
      if (keyOnly && !c.isKey) return false;
      if (subProcessFilter !== 'All' && c.subProcess !== subProcessFilter) return false;
      if (frequencyFilter !== 'All' && c.frequency !== frequencyFilter) return false;
      if (selectedStatus !== 'All' && controlStatuses.get(c.controlId) !== selectedStatus) return false;
      if (q.length > 0) {
        const inControl =
          c.controlId.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q);
        const inAttribute = c.attributes.some(
          a => a.id.toLowerCase().includes(q) || a.description.toLowerCase().includes(q),
        );
        if (!inControl && !inAttribute) return false;
      }
      return true;
    });
  }, [controls, controlStatuses, keyOnly, subProcessFilter, frequencyFilter, selectedStatus, search]);

  // ── KPI derivations
  const kpis = useMemo(() => {
    const total = controls.length;
    const healthFactor = engagement.health / 100;
    const tested = total === 0 ? 0 : Math.min(total, Math.round(total * (healthFactor + 0.05)));
    const effective = Math.min(tested, Math.round(total * healthFactor));
    const failed = Math.min(total, engagement.openIssues ?? 0);
    const pending = Math.max(0, total - tested);

    // Coverage is "% of controls that have at least one attribute with local entries".
    const attrIdsByControl = new Map<string, string[]>();
    controls.forEach(c => attrIdsByControl.set(c.controlId, c.attributes.map(a => a.id)));
    const controlsWithEvidence = controls.filter(c => {
      const ids = attrIdsByControl.get(c.controlId) ?? [];
      return ids.some(id => (evidence[id]?.length ?? 0) > 0);
    }).length;
    const controlsWithSamples = controls.filter(c => {
      const ids = attrIdsByControl.get(c.controlId) ?? [];
      return ids.some(id => (samples[id]?.length ?? 0) > 0);
    }).length;
    const evidenceCoverage = total === 0 ? 0 : Math.round((controlsWithEvidence / total) * 100);
    const sampleCoverage = total === 0 ? 0 : Math.round((controlsWithSamples / total) * 100);
    return { total, tested, effective, failed, pending, evidenceCoverage, sampleCoverage };
  }, [controls, engagement.health, engagement.openIssues, evidence, samples]);

  // ── Mutators
  const toggleExpand = (controlId: string) => setExpandedControlIds(prev => {
    const next = new Set(prev);
    if (next.has(controlId)) next.delete(controlId); else next.add(controlId);
    return next;
  });

  const acceptSuggestion = (attributeId: string, suggestion: AiSuggestion) => {
    setLinkedWorkflows(prev => {
      const list = prev[attributeId] ?? [];
      if (list.some(w => w.id === suggestion.id)) return prev;
      return { ...prev, [attributeId]: [...list, { id: suggestion.id, name: suggestion.name, status: 'Active' }] };
    });
    addToast({ type: 'success', message: `Linked "${suggestion.name}"` });
  };

  const declineSuggestion = (suggestion: AiSuggestion) =>
    addToast({ type: 'info', message: `Declined "${suggestion.name}"` });

  const linkManualWorkflow = (attributeId: string, opt: ManualWorkflowOption) => {
    setLinkedWorkflows(prev => {
      const list = prev[attributeId] ?? [];
      if (list.some(w => w.id === opt.id)) return prev;
      return { ...prev, [attributeId]: [...list, { id: opt.id, name: opt.name, status: opt.status }] };
    });
    addToast({ type: 'success', message: `Linked "${opt.name}"` });
  };

  const unlinkWorkflow = (attributeId: string, workflowId: string) => {
    setLinkedWorkflows(prev => ({ ...prev, [attributeId]: (prev[attributeId] ?? []).filter(w => w.id !== workflowId) }));
    addToast({ type: 'info', message: 'Workflow unlinked' });
  };

  const addEvidenceFile = (attributeId: string, file: File) => {
    const uploader = PEOPLE[hash(attributeId) % PEOPLE.length]?.name ?? OWNER_NAMES[0];
    const entry: EvidenceFile = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name, kind: kindForFile(file.name), size: formatBytes(file.size), uploader,
    };
    setEvidence(prev => ({ ...prev, [attributeId]: [...(prev[attributeId] ?? []), entry] }));
    addToast({ type: 'success', message: `Uploaded "${file.name}"` });
  };

  const removeEvidence = (attributeId: string, fileId: string) => {
    setEvidence(prev => ({ ...prev, [attributeId]: (prev[attributeId] ?? []).filter(e => e.id !== fileId) }));
    addToast({ type: 'info', message: 'Evidence removed' });
  };

  const generateSamples = (attributeId: string, method: SampleMethod) => {
    const seedIndex = (samples[attributeId]?.length ?? 0) + 1;
    const batch: Sample[] = Array.from({ length: 25 }).map((_, i) => ({
      id: `s-${attributeId}-${seedIndex}-${i}`,
      ref: `${attributeId.split('-').slice(-1)[0] ?? 'S'}-${String(seedIndex * 25 - 24 + i).padStart(3, '0')}`,
      result: 'Pending', remark: '',
    }));
    setSamples(prev => ({ ...prev, [attributeId]: [...(prev[attributeId] ?? []), ...batch] }));
    addToast({ type: 'success', message: `Generated 25 ${method.toLowerCase()} samples` });
  };

  const setSampleResult = (attributeId: string, sampleId: string, result: SampleResult) =>
    setSamples(prev => ({ ...prev, [attributeId]: (prev[attributeId] ?? []).map(s => (s.id === sampleId ? { ...s, result } : s)) }));

  const setSampleRemark = (attributeId: string, sampleId: string, remark: string) =>
    setSamples(prev => ({ ...prev, [attributeId]: (prev[attributeId] ?? []).map(s => (s.id === sampleId ? { ...s, remark } : s)) }));

  const removeSample = (attributeId: string, sampleId: string) =>
    setSamples(prev => ({ ...prev, [attributeId]: (prev[attributeId] ?? []).filter(s => s.id !== sampleId) }));

  const addManualSampleFile = (attributeId: string, file: File) => {
    const entry: Sample = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ref: file.name.replace(/\.[^.]+$/, '').slice(0, 24),
      result: 'Pending', remark: '',
    };
    setSamples(prev => ({ ...prev, [attributeId]: [...(prev[attributeId] ?? []), entry] }));
    addToast({ type: 'success', message: `Uploaded sample file "${file.name}"` });
  };

  const getSampleMethod = (attributeId: string): SampleMethod => sampleMethods[attributeId] ?? 'Random';
  const setSampleMethod = (attributeId: string, method: SampleMethod) =>
    setSampleMethods(prev => ({ ...prev, [attributeId]: method }));

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (controls.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
          <Shield size={20} className="text-brand-600" />
        </div>
        <p className="text-[14px] font-semibold text-ink-800 mb-1">No controls in scope yet</p>
        <p className="text-[12px] text-ink-500 max-w-[420px] mx-auto">
          Upload a RACM or add controls to start testing. Once controls are mapped, they’ll appear here grouped by sub-process.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── KPI strip (5 tiles) — evidence/sample KPIs moved to the Evidence tab ─── */}
      <div className="grid grid-cols-5 gap-3">
        <KpiTile label="Total Controls" value={kpis.total}     tone="text-ink-800" />
        <KpiTile label="Tested"         value={kpis.tested}    tone="text-ink-800" />
        <KpiTile label="Effective"      value={kpis.effective} tone="text-compliant-700" />
        <KpiTile label="Failed"         value={kpis.failed}    tone="text-risk-700" />
        <KpiTile label="Pending"        value={kpis.pending}   tone="text-mitigated-700" />
      </div>

      {/* ─── Filter row ─── */}
      <div className="glass-card rounded-xl p-3.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          {/* Status pills */}
          <div className="flex items-center gap-1">
            {STATUS_PILLS.map(s => {
              const active = selectedStatus === s;
              return (
                <button
                  key={s} onClick={() => setSelectedStatus(s)}
                  className={`px-2.5 h-7 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${active ? 'bg-brand-50 text-brand-700 border border-brand-100' : 'border border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}
                >{s}</button>
              );
            })}
          </div>

          {/* Key toggle */}
          <button
            onClick={() => setKeyOnly(v => !v)}
            aria-pressed={keyOnly}
            className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${keyOnly ? 'bg-brand-50 text-brand-700 border border-brand-100' : 'border border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}
          >
            <KeyDot active={keyOnly} />Key only
          </button>

          {/* Sub-process chips */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mr-1">Sub-process</span>
            {['All', ...subProcesses].map(sp => {
              const active = subProcessFilter === sp;
              return (
                <button
                  key={sp} onClick={() => setSubProcessFilter(sp)}
                  className={`px-2.5 h-7 rounded-full text-[11.5px] font-medium transition-colors cursor-pointer ${active ? 'bg-ink-800 text-white border border-ink-800' : 'border border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}
                >{sp}</button>
              );
            })}
          </div>

          {/* Frequency dropdown */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500">Frequency</span>
            <select
              value={frequencyFilter} onChange={e => setFrequencyFilter(e.target.value as FrequencyFilter)}
              className="px-2.5 h-7 border border-canvas-border rounded-md text-[12px] text-ink-700 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 cursor-pointer"
            >
              {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Search */}
          <div className="relative w-[300px] max-w-full">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search control ID, name, or attribute…"
              className="w-full pl-7 pr-2.5 h-7 border border-canvas-border rounded-md text-[12px] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 placeholder:text-ink-400"
            />
          </div>
        </div>
      </div>

      {/* ─── Controls list ─── */}
      <div className="space-y-2.5">
        {filteredControls.length === 0 && (
          <div className="glass-card rounded-xl p-10 text-center">
            <p className="text-[13px] font-semibold text-ink-800 mb-1">No controls match these filters</p>
            <p className="text-[12px] text-ink-500">Try clearing a filter or broadening your search.</p>
          </div>
        )}

        {filteredControls.map(c => {
          const status = controlStatuses.get(c.controlId) ?? 'Pending';
          const expanded = expandedControlIds.has(c.controlId);
          return (
            <div
              key={c.controlId}
              className="glass-card rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(c.controlId)} aria-expanded={expanded}
                className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-canvas/50 transition-colors cursor-pointer text-left"
              >
                <ChevronRight size={15} className={`text-ink-400 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
                <span className="font-mono text-[12px] font-semibold text-brand-700 shrink-0">{c.controlId}</span>
                <span className="text-[13px] font-medium text-ink-800 truncate flex-1 min-w-0">{c.description}</span>
                {c.isKey && <span className="px-1.5 h-5 rounded text-[10px] font-bold uppercase tracking-wide bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center shrink-0">Key</span>}
                <span className={`px-2 h-6 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1.5 shrink-0 ${CONTROL_STATUS_CLS[status]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${CONTROL_STATUS_DOT[status]}`} />{status}
                </span>
                <span className="text-[11px] text-ink-500 shrink-0 tabular-nums">{c.attributes.length} attr</span>
                <span className="text-[11px] text-ink-400 shrink-0 hidden md:inline">{lastTestedFor(c.controlId)}</span>
              </button>

              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                    className="overflow-hidden border-t border-canvas-border bg-canvas/40"
                  >
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between text-[11px] text-ink-500">
                        <span><span className="font-semibold text-ink-600">{c.subProcess}</span> · {c.frequency} · Owner {ownerForControl(c.controlId)}</span>
                        <span className="font-mono">{c.attributes.length} attribute{c.attributes.length === 1 ? '' : 's'}</span>
                      </div>
                      {c.attributes.map(attr => (
                        <AttributeBlock
                          key={attr.id}
                          attribute={attr}
                          linkedWorkflows={linkedWorkflows[attr.id] ?? []}
                          evidence={evidence[attr.id] ?? []}
                          samples={samples[attr.id] ?? []}
                          method={getSampleMethod(attr.id)}
                          onSetMethod={(m) => setSampleMethod(attr.id, m)}
                          aiOpen={aiPopover.attributeId === attr.id}
                          linkOpen={linkPopover.attributeId === attr.id}
                          linkSearch={linkSearch}
                          onOpenAi={() => { setLinkPopover({ attributeId: null }); setAiPopover({ attributeId: aiPopover.attributeId === attr.id ? null : attr.id }); }}
                          onCloseAi={() => setAiPopover({ attributeId: null })}
                          onOpenLink={() => { setAiPopover({ attributeId: null }); setLinkPopover({ attributeId: linkPopover.attributeId === attr.id ? null : attr.id }); setLinkSearch(''); }}
                          onCloseLink={() => { setLinkPopover({ attributeId: null }); setLinkSearch(''); }}
                          onLinkSearchChange={setLinkSearch}
                          onAccept={(s) => acceptSuggestion(attr.id, s)}
                          onDecline={declineSuggestion}
                          onLinkManual={(opt) => linkManualWorkflow(attr.id, opt)}
                          onUnlink={(wfId) => unlinkWorkflow(attr.id, wfId)}
                          onAddEvidence={(f) => addEvidenceFile(attr.id, f)}
                          onRemoveEvidence={(fid) => removeEvidence(attr.id, fid)}
                          onGenerate={(method) => generateSamples(attr.id, method)}
                          onAddManualSample={(f) => addManualSampleFile(attr.id, f)}
                          onSetResult={(sid, r) => setSampleResult(attr.id, sid, r)}
                          onSetRemark={(sid, r) => setSampleRemark(attr.id, sid, r)}
                          onRemoveSample={(sid) => removeSample(attr.id, sid)}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── KPI tile ────────────────────────────────────────────────────────────────

function KpiTile({ label, value, tone }: { label: string; value: number | string; tone: string }): JSX.Element {
  return (
    <div className="glass-card rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-1 truncate">{label}</div>
      <div className={`text-[22px] font-bold tabular-nums leading-none ${tone}`}>{value}</div>
    </div>
  );
}

function KeyDot({ active }: { active: boolean }): JSX.Element {
  return (
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-brand-600' : 'bg-ink-300'}`} />
  );
}

// ─── AttributeBlock: header strip + 3-col cards + footer ────────────────────

interface AttributeBlockProps {
  attribute: ControlAttribute;
  linkedWorkflows: LinkedWorkflow[]; evidence: EvidenceFile[]; samples: Sample[];
  method: SampleMethod; onSetMethod: (m: SampleMethod) => void;
  aiOpen: boolean; linkOpen: boolean; linkSearch: string;
  onOpenAi: () => void; onCloseAi: () => void;
  onOpenLink: () => void; onCloseLink: () => void;
  onLinkSearchChange: (v: string) => void;
  onAccept: (s: AiSuggestion) => void; onDecline: (s: AiSuggestion) => void;
  onLinkManual: (opt: ManualWorkflowOption) => void;
  onUnlink: (workflowId: string) => void;
  onAddEvidence: (f: File) => void; onRemoveEvidence: (fileId: string) => void;
  onGenerate: (method: SampleMethod) => void;
  onAddManualSample: (f: File) => void;
  onSetResult: (sampleId: string, r: SampleResult) => void;
  onSetRemark: (sampleId: string, remark: string) => void;
  onRemoveSample: (sampleId: string) => void;
}

function AttributeBlock(p: AttributeBlockProps): JSX.Element {
  const wp = workingPaperFor(p.attribute.id);
  return (
    <div className="rounded-xl border border-canvas-border bg-white overflow-hidden">
      {/* Header strip */}
      <div className="px-4 py-3 border-b border-canvas-border bg-canvas/60">
        <div className="flex items-start gap-3">
          <span className="font-mono text-[11.5px] font-semibold text-brand-700 shrink-0 mt-0.5">{p.attribute.id}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink-800 leading-snug">{p.attribute.description}</p>
            <p className="text-[11.5px] italic text-ink-500 mt-0.5 leading-snug">{p.attribute.testProcedure}</p>
          </div>
        </div>
      </div>

      {/* Single column — Workflows mapping; Evidence + sampling live in the Evidence tab. */}
      <div className="p-4">
        <WorkflowsCard
          linked={p.linkedWorkflows}
          aiOpen={p.aiOpen} linkOpen={p.linkOpen} linkSearch={p.linkSearch}
          onOpenAi={p.onOpenAi} onCloseAi={p.onCloseAi}
          onOpenLink={p.onOpenLink} onCloseLink={p.onCloseLink}
          onLinkSearchChange={p.onLinkSearchChange}
          onAccept={p.onAccept} onDecline={p.onDecline}
          onLinkManual={p.onLinkManual} onUnlink={p.onUnlink}
        />
      </div>

      {/* Footer — working paper status */}
      <div className="px-4 py-2.5 border-t border-canvas-border bg-canvas/40 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-ink-500">
          <ClipboardList size={12} className="text-ink-400" />
          <span className="uppercase tracking-wider font-semibold">Working paper</span>
        </div>
        <span className={`px-2 h-5 rounded-full text-[10.5px] font-semibold border inline-flex items-center ${WORKING_PAPER_CLS[wp]}`}>
          {wp}
        </span>
      </div>
    </div>
  );
}

// ─── Workflows card (AI Map + manual link popovers) ─────────────────────────

interface WorkflowsCardProps {
  linked: LinkedWorkflow[];
  aiOpen: boolean; linkOpen: boolean; linkSearch: string;
  onOpenAi: () => void; onCloseAi: () => void;
  onOpenLink: () => void; onCloseLink: () => void;
  onLinkSearchChange: (v: string) => void;
  onAccept: (s: AiSuggestion) => void; onDecline: (s: AiSuggestion) => void;
  onLinkManual: (opt: ManualWorkflowOption) => void;
  onUnlink: (workflowId: string) => void;
}

function WorkflowsCard(p: WorkflowsCardProps): JSX.Element {
  const filteredManual = useMemo(() => {
    const q = p.linkSearch.trim().toLowerCase();
    if (q.length === 0) return MANUAL_WORKFLOW_LIBRARY;
    return MANUAL_WORKFLOW_LIBRARY.filter(w => w.name.toLowerCase().includes(q));
  }, [p.linkSearch]);

  const isLinked = (id: string) => p.linked.some(l => l.id === id);

  return (
    <div className="rounded-lg border border-canvas-border bg-canvas/40 p-3 flex flex-col gap-2.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <WorkflowIcon size={12} className="text-ink-500 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600 truncate">Linked workflows</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={p.onOpenAi}
            className={`inline-flex items-center gap-1 px-1.5 h-5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
              p.aiOpen
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100'
            }`}
            aria-expanded={p.aiOpen}
          >
            <Sparkles size={10} />
            AI Map
          </button>
          <button
            onClick={p.onOpenLink}
            className={`inline-flex items-center gap-1 px-1.5 h-5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
              p.linkOpen
                ? 'bg-ink-800 text-white border-ink-800'
                : 'bg-white text-ink-600 border-canvas-border hover:bg-canvas'
            }`}
            aria-expanded={p.linkOpen}
          >
            <Plus size={10} />
            Link manually
          </button>
          <button
            onClick={() => alert('Create Workflow — will open Workflow Builder.')}
            className="inline-flex items-center gap-1 px-1.5 h-5 rounded text-[10px] font-medium border transition-colors cursor-pointer bg-white text-ink-600 border-canvas-border hover:bg-canvas"
          >
            <Plus size={10} />
            Create workflow
          </button>
        </div>
      </div>

      {/* AI Map popover (inline) */}
      <AnimatePresence initial={false}>
        {p.aiOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="rounded-lg border border-brand-100 bg-white overflow-hidden shadow-sm"
          >
            <div className="px-3 py-2 border-b border-brand-50 bg-brand-50/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-white border border-brand-100 text-[10px] font-bold text-brand-700">
                  <Sparkles size={9} />
                  Ira AI
                </span>
                <span className="text-[10.5px] uppercase tracking-wider font-semibold text-brand-700">Suggested workflows</span>
              </div>
              <button onClick={p.onCloseAi} className="text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close suggestions">
                <X size={12} />
              </button>
            </div>
            <ul className="divide-y divide-canvas-border">
              {AI_SUGGESTIONS.map(s => {
                const tone = confidenceTone(s.confidence);
                const already = isLinked(s.id);
                return (
                  <li key={s.id} className="px-3 py-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-ink-800 leading-tight">{s.name}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1 flex-1 bg-surface-3 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${s.confidence}%` }} />
                        </div>
                        <span className={`text-[10.5px] font-semibold tabular-nums ${tone.text}`}>{s.confidence}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => p.onAccept(s)}
                        disabled={already}
                        className={`inline-flex items-center gap-0.5 px-1.5 h-5 rounded text-[10px] font-semibold border transition-colors ${already ? 'bg-compliant-50 text-compliant-700 border-compliant-50 cursor-default' : 'bg-brand-600 text-white border-brand-600 hover:bg-brand-500 cursor-pointer'}`}
                      >
                        <Check size={9} />{already ? 'Linked' : 'Accept'}
                      </button>
                      {!already && (
                        <button
                          onClick={() => p.onDecline(s)}
                          className="inline-flex items-center px-1.5 h-5 rounded text-[10px] font-medium border border-canvas-border bg-white text-ink-500 hover:bg-canvas cursor-pointer"
                        >Decline</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual link popover */}
      <AnimatePresence initial={false}>
        {p.linkOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="rounded-lg border border-canvas-border bg-white overflow-hidden shadow-sm"
          >
            <div className="px-3 py-2 border-b border-canvas-border bg-canvas/50 flex items-center justify-between gap-2">
              <div className="relative flex-1 min-w-0">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={p.linkSearch}
                  onChange={(e) => p.onLinkSearchChange(e.target.value)}
                  placeholder="Search workflows…"
                  className="w-full pl-6 pr-2 h-6 border border-canvas-border rounded-md text-[11px] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 placeholder:text-ink-400"
                />
              </div>
              <button onClick={p.onCloseLink} className="text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close link picker">
                <X size={12} />
              </button>
            </div>
            <ul className="divide-y divide-canvas-border max-h-[180px] overflow-y-auto">
              {filteredManual.length === 0 && (
                <li className="px-3 py-3 text-[11px] text-ink-500 italic">No workflows match “{p.linkSearch}”</li>
              )}
              {filteredManual.map(opt => {
                const already = isLinked(opt.id);
                return (
                  <li key={opt.id} className="px-3 py-1.5 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${WORKFLOW_STATUS_DOT[opt.status]}`} />
                    <span className="text-[11.5px] text-ink-800 truncate flex-1">{opt.name}</span>
                    <span className="text-[9.5px] uppercase tracking-wider text-ink-400 shrink-0">{opt.status}</span>
                    <button
                      onClick={() => p.onLinkManual(opt)}
                      disabled={already}
                      className={`inline-flex items-center gap-0.5 px-1.5 h-5 rounded text-[10px] font-semibold border transition-colors ${already ? 'bg-compliant-50 text-compliant-700 border-compliant-50 cursor-default' : 'bg-white text-brand-700 border-brand-100 hover:bg-brand-50 cursor-pointer'}`}
                    >
                      {already ? <Check size={9} /> : <Plus size={9} />}{already ? 'Added' : 'Add'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Linked chips */}
      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
        {p.linked.length === 0 && !p.aiOpen && !p.linkOpen && (
          <span className="text-[11.5px] italic text-ink-400">
            No workflows linked yet — try <span className="text-brand-700 font-medium not-italic">✨ AI Map</span>
          </span>
        )}
        {p.linked.map(w => (
          <span
            key={w.id}
            className="inline-flex items-center gap-1.5 pl-2 pr-1 h-6 rounded-md border border-canvas-border bg-white text-[11px] text-ink-800"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${WORKFLOW_STATUS_DOT[w.status]}`} />
            <span className="truncate max-w-[170px]">{w.name}</span>
            <button
              onClick={() => p.onUnlink(w.id)}
              className="w-4 h-4 inline-flex items-center justify-center rounded text-ink-400 hover:text-risk-700 hover:bg-risk-50/60 cursor-pointer"
              aria-label={`Unlink ${w.name}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Evidence card ──────────────────────────────────────────────────────────

interface EvidenceCardProps {
  files: EvidenceFile[]; onAdd: (f: File) => void; onRemove: (fileId: string) => void;
}

function EvidenceCard({ files, onAdd, onRemove }: EvidenceCardProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);

  return (
    <div className="rounded-lg border border-canvas-border bg-canvas/40 p-3 flex flex-col gap-2.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <FileText size={12} className="text-ink-500" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">Evidence files</span>
        {files.length > 0 && (
          <span className="ml-auto text-[10.5px] tabular-nums text-ink-500">{files.length}</span>
        )}
      </div>

      <label
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onAdd(f); }}
        className={`block cursor-pointer rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${dragOver ? 'border-brand-400 bg-brand-50/50' : 'border-canvas-border bg-white hover:border-brand-300 hover:bg-brand-50/30'}`}
      >
        <input
          ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv" className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(f); if (inputRef.current) inputRef.current.value = ''; }}
        />
        <Upload size={14} className="mx-auto text-ink-400 mb-1" />
        <p className="text-[11.5px] font-medium text-ink-700 leading-tight">Drop PDF or image, or click to browse</p>
        <p className="text-[10.5px] text-ink-400 mt-0.5">PDF, PNG, JPG, XLSX, CSV</p>
      </label>

      <ul className="space-y-1.5">
        {files.length === 0 && (
          <li className="text-[11.5px] italic text-ink-400 py-1">No evidence attached yet.</li>
        )}
        {files.map(f => {
          const { Icon, cls } = EVIDENCE_ICON[f.kind];
          return (
            <li
              key={f.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-canvas-border bg-white"
            >
              <span className={`w-6 h-6 rounded inline-flex items-center justify-center shrink-0 ${cls}`}>
                <Icon size={11} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-medium text-ink-800 truncate leading-tight">{f.name}</p>
                <p className="text-[10px] text-ink-500 mt-0.5">
                  <span className="font-semibold uppercase tracking-wider">{f.kind}</span>
                  <span className="mx-1 text-ink-300">·</span>
                  <span className="tabular-nums">{f.size}</span>
                  <span className="mx-1 text-ink-300">·</span>
                  {f.uploader}
                </p>
              </div>
              <button
                onClick={() => onRemove(f.id)}
                className="w-5 h-5 inline-flex items-center justify-center rounded text-ink-400 hover:text-risk-700 hover:bg-risk-50/60 cursor-pointer shrink-0"
                aria-label={`Remove ${f.name}`}
              >
                <X size={11} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Sample card ────────────────────────────────────────────────────────────

interface SampleCardProps {
  method: SampleMethod; onSetMethod: (m: SampleMethod) => void;
  samples: Sample[];
  onGenerate: (m: SampleMethod) => void;
  onAddManualSample: (f: File) => void;
  onSetResult: (sampleId: string, r: SampleResult) => void;
  onSetRemark: (sampleId: string, remark: string) => void;
  onRemove: (sampleId: string) => void;
}

function SampleCard(p: SampleCardProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  const passCount    = p.samples.filter(s => s.result === 'Pass').length;
  const failCount    = p.samples.filter(s => s.result === 'Fail').length;
  const pendingCount = p.samples.filter(s => s.result === 'Pending').length;

  return (
    <div className="rounded-lg border border-canvas-border bg-canvas/40 p-3 flex flex-col gap-2.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <Link2 size={12} className="text-ink-500" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">Sample</span>
        {p.samples.length > 0 && (
          <span className="ml-auto text-[10.5px] tabular-nums text-ink-500">
            <span className="text-compliant-700 font-semibold">{passCount}P</span>
            <span className="mx-0.5 text-ink-300">·</span>
            <span className="text-risk-700 font-semibold">{failCount}F</span>
            <span className="mx-0.5 text-ink-300">·</span>
            <span className="text-draft-700 font-semibold">{pendingCount}—</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1">
        {SAMPLE_METHODS.map(m => {
          const active = p.method === m;
          return (
            <button
              key={m}
              onClick={() => p.onSetMethod(m)}
              className={`px-2 h-6 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${active ? 'bg-brand-50 text-brand-700 border-brand-100' : 'bg-white text-ink-600 border-canvas-border hover:bg-canvas'}`}
            >{m}</button>
          );
        })}
      </div>

      {p.method === 'Manual upload' ? (
        <label className="block cursor-pointer rounded-lg border border-dashed border-canvas-border bg-white px-3 py-3 text-center hover:border-brand-300 hover:bg-brand-50/30 transition-colors">
          <input
            ref={inputRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onAddManualSample(f); if (inputRef.current) inputRef.current.value = ''; }}
          />
          <Upload size={13} className="mx-auto text-ink-400 mb-1" />
          <p className="text-[11px] font-medium text-ink-700 leading-tight">Drop sample file or click to upload</p>
          <p className="text-[10px] text-ink-400 mt-0.5">XLSX, CSV, PDF</p>
        </label>
      ) : (
        <button
          onClick={() => p.onGenerate(p.method)}
          className="inline-flex items-center justify-center gap-1 px-2.5 h-7 rounded-md text-[11.5px] font-semibold border border-brand-100 bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer"
        >
          <Sparkles size={11} />
          Generate 25 samples
        </button>
      )}

      <ul className="space-y-1.5 max-h-[280px] overflow-y-auto pr-0.5">
        {p.samples.length === 0 && (
          <li className="text-[11.5px] italic text-ink-400 py-1">No samples yet — generate or upload above.</li>
        )}
        {p.samples.map(s => (
          <li key={s.id} className="rounded-md border border-canvas-border bg-white px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10.5px] font-semibold text-ink-700 shrink-0">{s.ref}</span>
              <div className="flex items-center gap-0.5 ml-auto">
                {SAMPLE_RESULTS.map(r => {
                  const cls = SAMPLE_RESULT_CLS[r];
                  const active = s.result === r;
                  const Icon = r === 'Pass' ? CheckCircle2 : r === 'Fail' ? AlertCircle : Circle;
                  return (
                    <button
                      key={r} onClick={() => p.onSetResult(s.id, r)} title={r}
                      className={`w-5 h-5 inline-flex items-center justify-center rounded border text-[10px] font-semibold cursor-pointer transition-colors ${active ? cls.active : cls.idle}`}
                      aria-pressed={active} aria-label={`${s.ref} ${r}`}
                    ><Icon size={10} /></button>
                  );
                })}
                <button
                  onClick={() => p.onRemove(s.id)} aria-label={`Remove sample ${s.ref}`}
                  className="w-5 h-5 inline-flex items-center justify-center rounded text-ink-400 hover:text-risk-700 hover:bg-risk-50/60 cursor-pointer"
                ><X size={10} /></button>
              </div>
            </div>
            <input
              type="text" value={s.remark} placeholder="Remark…"
              onChange={(e) => p.onSetRemark(s.id, e.target.value)}
              className="mt-1 w-full px-1.5 h-5 border border-transparent rounded text-[10.5px] text-ink-700 bg-canvas/60 outline-none focus:border-brand-300 focus:bg-white focus:ring-1 focus:ring-brand-500/15 placeholder:text-ink-400 transition-colors"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
