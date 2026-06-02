import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ChevronDown, AlertTriangle, Lock, Pencil, HelpCircle, Grid3x3,
  Archive, Unlock, ArrowLeft, ArrowRight, Shield, Workflow as WorkflowIcon, FileText,
} from 'lucide-react';
import RacmMappingWorkspace from './RacmMappingWorkspace';
import ColumnFilter from '../shared/ColumnFilter';
import { getRacmRelationships } from '../../data/processHubJoins';

// ─── Detail Page (Step 4) ──────────────────────────────────────────────────
function RacmDetailPage({ racm, onBack, onOpenMapping }: { racm: RacmEntry; onBack: () => void; onOpenMapping: () => void }) {
  const rels = getRacmRelationships(racm.id);
  const rawStatus = getRacmTableStatus(racm);
  const readiness = getRacmTableReadiness(racm);

  const fields = [
    { label: 'Version', value: racm.version, mono: true },
    { label: 'Process', value: racm.process },
    { label: 'Framework', value: racm.framework },
    { label: 'Risks', value: String(racm.risks), mono: true },
    { label: 'Controls', value: String(racm.controls), mono: true },
    { label: 'Key Controls', value: String(racm.keyControls), mono: true },
    { label: 'Workflow Coverage', value: `${racm.workflowCoverage}%`, mono: true },
    { label: 'Attributes Coverage', value: `${racm.attributesCoverage}%`, mono: true },
  ];

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="font-mono text-[12px] text-ink-500 hover:text-primary tracking-tight transition-colors cursor-pointer inline-flex items-center gap-1.5"
      >
        <ArrowLeft size={12} />Back to RACMs
      </button>

      <div className="bg-white border border-canvas-border rounded-[12px] p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${STATUS_BADGE[rawStatus]}`}>{rawStatus}</span>
              <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${READINESS_BADGE[readiness]}`}>{readiness}</span>
              <span className="font-mono text-[11px] text-ink-500">{racm.id}</span>
            </div>
            <h1 className="font-display text-[26px] font-[420] tracking-tight text-ink-900 leading-[1.2]">{racm.name}</h1>
          </div>
          <button
            type="button"
            onClick={onOpenMapping}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer"
          >
            Open mapping<ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-x-6 gap-y-4 pt-4 border-t border-canvas-border/70">
          {fields.map(f => (
            <div key={f.label}>
              <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-0.5">{f.label}</span>
              <span className={`text-[13px] block ${f.mono ? 'font-mono text-ink-700 tabular-nums' : 'text-text'}`}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <FileText size={13} className="text-ink-500" />
              Source SOP
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{rels.sop ? 1 : 0}</span>
          </div>
          {!rels.sop ? (
            <p className="text-[12px] text-ink-400 italic">Built without an SOP (manual import).</p>
          ) : (
            <div className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[12.5px] text-ink-800 font-medium leading-snug truncate flex-1">{rels.sop.name}</span>
                <span className="text-[10px] font-mono text-ink-400 tabular-nums shrink-0">{rels.sop.version}</span>
              </div>
              <span className="text-[11px] text-ink-500 leading-snug">Uploaded by {rels.sop.by} · {rels.sop.at}</span>
            </div>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-ink-500" />
              Risks in this RACM
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{rels.risks.length}</span>
          </div>
          {rels.risks.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No risks captured.</p>
          ) : (
            <ul className="space-y-2">
              {rels.risks.map(r => (
                <li key={r.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[10px] text-ink-400 tabular-nums shrink-0 mt-0.5">{r.id}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[12.5px] text-ink-800 font-medium leading-snug">{r.name}</span>
                      <span className="text-[11px] text-ink-500 leading-snug block">Severity: {r.severity} · Status: {r.status}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <Shield size={13} className="text-ink-500" />
              Controls in this RACM
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{rels.controls.length}</span>
          </div>
          {rels.controls.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No controls mapped.</p>
          ) : (
            <ul className="space-y-2">
              {rels.controls.map(c => (
                <li key={c.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-[10px] text-ink-400 tabular-nums shrink-0 mt-0.5">{c.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] text-ink-800 font-medium leading-snug">{c.name}</span>
                        {c.isKey && <span className="px-1.5 h-4 rounded-[4px] text-[9px] font-bold inline-flex items-center bg-mitigated-50 text-mitigated-700 shrink-0">Key</span>}
                      </div>
                      <span className="text-[11px] text-ink-500 leading-snug">{c.desc}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-canvas-border rounded-[12px] p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] font-bold text-ink-900 inline-flex items-center gap-1.5">
              <WorkflowIcon size={13} className="text-ink-500" />
              Workflows linked via controls
            </h2>
            <span className="text-[12px] font-mono text-ink-400 tabular-nums">{rels.workflows.length}</span>
          </div>
          {rels.workflows.length === 0 ? (
            <p className="text-[12px] text-ink-400 italic">No workflows linked yet.</p>
          ) : (
            <ul className="space-y-2">
              {rels.workflows.map(w => (
                <li key={w.id} className="rounded-[8px] border border-canvas-border bg-paper-50/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12.5px] text-ink-800 font-medium leading-snug truncate flex-1">{w.name}</span>
                    <span className="text-[10px] font-mono text-ink-400 tabular-nums shrink-0">{w.runs} runs</span>
                  </div>
                  <span className="text-[11px] text-ink-500 leading-snug">{w.desc}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RacmEntry {
  id: string; name: string; version: string; process: string; framework: string;
  risks: number; controls: number; mappedRisks: number; unmappedRisks: number;
  keyControls: number; workflowCoverage: number; attributesCoverage: number;
  isValidated: boolean; linkedToEngagement: boolean;
  /** false = still in draft review (editable Excel grid); true | undefined = frozen / active */
  isFrozen?: boolean;
  /** Original uploaded file name — used when re-opening the review editor */
  sourceFileName?: string;
}

// ─── RACM Status (lifecycle only) ───────────────────────────────────────────

type RacmTableStatus = 'Draft' | 'In Progress' | 'Active' | 'Locked';

function getRacmTableStatus(racm: RacmEntry): RacmTableStatus {
  if (racm.isFrozen === false) return 'Draft';
  if (racm.linkedToEngagement) return 'Locked';
  if (racm.risks > 0 && racm.unmappedRisks === 0 && racm.mappedRisks >= racm.risks) return 'Active';
  if (racm.risks > 0) return 'In Progress';
  return 'Draft';
}

const STATUS_BADGE: Record<RacmTableStatus, string> = {
  'Draft':       'bg-paper-100 text-ink-600 border-paper-200/50',
  'In Progress': 'bg-evidence-50 text-evidence-700 border-evidence-200/50',
  'Active':      'bg-compliant-50 text-compliant-700 border-compliant-700/20',
  'Locked':      'bg-mitigated-50 text-mitigated-700 border-mitigated-700/20',
};

// ─── RACM Readiness (computed, never stored) ────────────────────────────────

type RacmTableReadiness = 'Mapping Incomplete' | 'Workflow Missing' | 'Configuration Pending' | 'Ready';

function getRacmTableReadiness(racm: RacmEntry): RacmTableReadiness {
  if (racm.risks === 0 || racm.unmappedRisks > 0 || racm.mappedRisks < racm.risks) return 'Mapping Incomplete';
  if (racm.workflowCoverage < 100) return 'Workflow Missing';
  if (racm.attributesCoverage < 100) return 'Configuration Pending';
  return 'Ready';
}

const READINESS_BADGE: Record<RacmTableReadiness, string> = {
  'Mapping Incomplete':     'bg-high-50 text-high-700',
  'Workflow Missing':       'bg-mitigated-50 text-mitigated-700',
  'Configuration Pending':  'bg-evidence-50 text-evidence-700',
  'Ready':                  'bg-compliant-50 text-compliant-700',
};

// ─── Seed Data ──────────────────────────────────────────────────────────────

export const RACM_SEED_DATA: RacmEntry[] = [
  { id: 'racm-001', name: 'FY26 P2P — Vendor Payment', version: 'v2.1', process: 'P2P', framework: 'SOX ICFR', risks: 9, controls: 24, mappedRisks: 9, unmappedRisks: 0, keyControls: 6, workflowCoverage: 92, attributesCoverage: 88, isValidated: true, linkedToEngagement: true },
  { id: 'racm-002', name: 'FY26 O2C — Revenue & AR', version: 'v2.1', process: 'O2C', framework: 'SOX ICFR', risks: 7, controls: 18, mappedRisks: 6, unmappedRisks: 1, keyControls: 4, workflowCoverage: 78, attributesCoverage: 65, isValidated: false, linkedToEngagement: false },
  { id: 'racm-003', name: 'FY26 R2R — Financial Close', version: 'v2.1', process: 'R2R', framework: 'SOX ICFR', risks: 11, controls: 31, mappedRisks: 10, unmappedRisks: 1, keyControls: 8, workflowCoverage: 85, attributesCoverage: 80, isValidated: true, linkedToEngagement: true },
  { id: 'racm-004', name: 'FY26 S2C — Contract Review', version: 'v1.8', process: 'S2C', framework: 'Internal Policy', risks: 5, controls: 14, mappedRisks: 3, unmappedRisks: 2, keyControls: 2, workflowCoverage: 60, attributesCoverage: 45, isValidated: false, linkedToEngagement: false },
  { id: 'racm-005', name: 'FY26 ITGC — Access & Change', version: 'v2.1', process: 'ITGC', framework: 'ISO 27001', risks: 6, controls: 15, mappedRisks: 6, unmappedRisks: 0, keyControls: 5, workflowCoverage: 100, attributesCoverage: 100, isValidated: true, linkedToEngagement: true },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  processFilter?: string;
  initialMappingRacm?: { id: string; name: string; process: string } | null;
  onMappingOpened?: () => void;
  extraRacms?: RacmEntry[];
  /** Called when user clicks Edit Draft on a draft RACM — opens the Excel editing page */
  onEditDraft?: (racm: RacmEntry) => void;
  /** Called when user clicks "Open in editor" on any RACM — opens the full-page editor route */
  onOpenInEditor?: (racm: RacmEntry) => void;
  /** Optional CTA (e.g. New RACM button) rendered in the same row as the attention banner */
  headerAction?: React.ReactNode;
  /** Called when the user clicks the "New RACM" CTA on the empty state. If omitted, the empty state falls back to the inline "No RACMs found" row. */
  onCreate?: () => void;
}

export default function RacmListTable({ processFilter, initialMappingRacm, onMappingOpened, extraRacms, onEditDraft, onOpenInEditor, headerAction, onCreate }: Props) {
  const [racmList] = useState<RacmEntry[]>(RACM_SEED_DATA);
  const allRacms = (() => {
    if (!extraRacms || extraRacms.length === 0) return racmList;
    const extraIds = new Set(extraRacms.map(r => r.id));
    return [...racmList.filter(r => !extraIds.has(r.id)), ...extraRacms];
  })();
  const [showMappingWorkspace, setShowMappingWorkspace] = useState(false);
  const [mappingRacm, setMappingRacm] = useState<RacmEntry | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [unfrozenIds, setUnfrozenIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [readinessFilter, setReadinessFilter] = useState<string[]>([]);
  const [processColFilter, setProcessColFilter] = useState<string[]>([]);
  const [frameworkFilter, setFrameworkFilter] = useState<string[]>([]);
  const [detailRacmId, setDetailRacmId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('racm');
  });
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  // URL sync — ?racm=RACM-001
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get('racm');
    if (detailRacmId && current !== detailRacmId) {
      params.set('racm', detailRacmId);
      window.history.pushState({ ...window.history.state, racm: detailRacmId }, '', `?${params.toString()}`);
    } else if (!detailRacmId && current) {
      params.delete('racm');
      const qs = params.toString();
      window.history.pushState({ ...window.history.state, racm: null }, '', qs ? `?${qs}` : window.location.pathname);
    }
  }, [detailRacmId]);

  useEffect(() => {
    const onPop = () => {
      const param = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('racm') : null;
      setDetailRacmId(param);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (initialMappingRacm && !showMappingWorkspace) {
      const found = allRacms.find(r => r.id === initialMappingRacm.id);
      if (found) setMappingRacm(found);
      else setMappingRacm({ id: initialMappingRacm.id, name: initialMappingRacm.name, version: 'v1.0', process: initialMappingRacm.process, framework: 'SOX ICFR', risks: 0, controls: 0, mappedRisks: 0, unmappedRisks: 0, keyControls: 0, workflowCoverage: 0, attributesCoverage: 0, isValidated: false, linkedToEngagement: false });
      setShowMappingWorkspace(true);
      onMappingOpened?.();
    }
  }, [initialMappingRacm]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseFiltered = processFilter ? allRacms.filter(r => r.process === processFilter) : allRacms;
  const preColFiltered = baseFiltered.filter(r => !archivedIds.includes(r.id));
  const filtered = preColFiltered
    .filter(r => {
      if (statusFilter.length === 0) return true;
      const s = getRacmTableStatus(r);
      const resolved = s === 'Locked' && unfrozenIds.includes(r.id) ? 'Active' : s;
      return statusFilter.includes(resolved);
    })
    .filter(r => readinessFilter.length === 0 || readinessFilter.includes(getRacmTableReadiness(r)))
    .filter(r => processColFilter.length === 0 || processColFilter.includes(r.process))
    .filter(r => frameworkFilter.length === 0 || frameworkFilter.includes(r.framework));

  const statusOptions = Array.from(new Set(baseFiltered.map(r => {
    const s = getRacmTableStatus(r);
    return s === 'Locked' && unfrozenIds.includes(r.id) ? 'Active' : s;
  }))).sort();
  const readinessOptions = Array.from(new Set(baseFiltered.map(getRacmTableReadiness))).sort();
  const processOptions = Array.from(new Set(baseFiltered.map(r => r.process))).sort();
  const frameworkOptions = Array.from(new Set(baseFiltered.map(r => r.framework))).sort();

  // Keep selected list scoped to currently visible rows
  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => filtered.some(r => r.id === id)));
  }, [archivedIds, processFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const allVisibleIds = filtered.map(r => r.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.includes(id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(allVisibleIds);
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const handleBulkArchive = () => {
    setArchivedIds(prev => [...prev, ...selectedIds]);
    setSelectedIds([]);
  };
  const handleReopen = (racmId: string) => {
    setUnfrozenIds(prev => prev.includes(racmId) ? prev : [...prev, racmId]);
  };

  // Full workspace redirect (for "Open Full RACM")
  if (showMappingWorkspace && mappingRacm) {
    return (
      <RacmMappingWorkspace
        racmId={mappingRacm.id} racmName={mappingRacm.name} racmProcess={mappingRacm.process}
        isEmpty={mappingRacm.risks === 0}
        onBack={() => { setShowMappingWorkspace(false); setMappingRacm(null); }}
      />
    );
  }

  // Detail page takeover when ?racm= is in URL
  const detailRacmFromUrl = detailRacmId ? allRacms.find(r => r.id === detailRacmId) : null;
  if (detailRacmFromUrl) {
    return (
      <RacmDetailPage
        racm={detailRacmFromUrl}
        onBack={() => setDetailRacmId(null)}
        onOpenMapping={() => {
          setMappingRacm(detailRacmFromUrl);
          setShowMappingWorkspace(true);
          setDetailRacmId(null);
        }}
      />
    );
  }

  const actionNeededCount = filtered.filter(r => getRacmTableReadiness(r) !== 'Ready').length;
  const colCount = 10; // select + col-0 + RACM + Status + Readiness + Process + Framework + Risks + Controls + Actions

  // Archive a single row (replaces the previous bulk-archive sticky bar).
  const handleArchiveOne = (id: string) => {
    setArchivedIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setSelectedIds(prev => prev.filter(s => s !== id));
  };
  const handleCancelOne = (id: string) => {
    setSelectedIds(prev => prev.filter(s => s !== id));
  };

  return (
    <div className="space-y-3">
      {/* Toolbar — primary CTA only. */}
      {headerAction && (
        <div className="flex items-center justify-end gap-3 mb-3">
          {headerAction}
        </div>
      )}

      {!isLoading && preColFiltered.length === 0 && onCreate ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-[12px] bg-paper-100 flex items-center justify-center mb-4">
            <Grid3x3 className="w-6 h-6 text-ink-500" />
          </div>
          <h3 className="text-[15px] font-display text-ink-800 mb-1">No RACMs yet</h3>
          <p className="text-[13px] text-ink-600 mb-5 max-w-[320px]">Build a Risk &amp; Controls Matrix from the SOP or from scratch.</p>
          <button type="button" onClick={onCreate} className="px-4 py-2 rounded-[8px] bg-brand-600 text-paper-0 text-[13px] font-medium hover:bg-brand-700">New RACM</button>
        </div>
      ) : (
      <div className="border-t border-border-light overflow-x-auto min-h-[calc(100vh-280px)]">
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-white border-b border-border-light">
              <tr>
                <th className="px-4 py-3 text-left w-8">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={isLoading || filtered.length === 0}
                    aria-label={allSelected ? 'Deselect all RACMs' : 'Select all RACMs'}
                    className="w-3.5 h-3.5 rounded-[4px] border border-ink-300 accent-brand-600 cursor-pointer"
                  />
                </th>
                {([
                  { key: 'col-0', label: '' },
                  { key: 'racm', label: 'RACM' },
                  { key: 'status', label: 'Status', tooltip: 'Current lifecycle state. Draft = in progress, Active = live, Locked = frozen for audit.', filter: 'status' as const },
                  { key: 'readiness', label: 'Readiness', tooltip: 'Whether the RACM is ready to enter active monitoring. Includes mapping, workflow, and config checks.', filter: 'readiness' as const },
                  { key: 'process', label: 'Process', filter: 'process' as const },
                  { key: 'framework', label: 'Framework', filter: 'framework' as const },
                  { key: 'risks', label: 'Risks' },
                  { key: 'controls', label: 'Controls' },
                  { key: 'col-actions', label: '' },
                ] as Array<{ key: string; label: string; tooltip?: string; filter?: 'status' | 'readiness' | 'process' | 'framework' }>).map((h, idx) => (
                  <th key={h.key} className={`px-4 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap ${idx === 0 ? 'w-6' : ''}`}>
                    <span className="inline-flex items-center gap-1">
                      {h.tooltip ? (
                        <span className="inline-flex items-center gap-1 group/tip relative">
                          {h.label}
                          <HelpCircle className="w-3 h-3 text-ink-400" aria-label={`What is ${h.label}?`} />
                          <span className="absolute top-full left-0 mt-1 w-[220px] p-2.5 rounded-[8px] bg-ink-800 text-paper-0 text-[12px] font-normal leading-snug normal-case tracking-normal opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50">
                            {h.tooltip}
                          </span>
                        </span>
                      ) : h.label}
                      {h.filter === 'status' && (
                        <ColumnFilter label="Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
                      )}
                      {h.filter === 'readiness' && (
                        <ColumnFilter label="Readiness" options={readinessOptions} value={readinessFilter} onChange={setReadinessFilter} />
                      )}
                      {h.filter === 'process' && (
                        <ColumnFilter label="Process" options={processOptions} value={processColFilter} onChange={setProcessColFilter} />
                      )}
                      {h.filter === 'framework' && (
                        <ColumnFilter label="Framework" options={frameworkOptions} value={frameworkFilter} onChange={setFrameworkFilter} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={`skel-${i}`} className="border-t border-border-light">
                    {[...Array(colCount)].map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div
                          className="h-3 bg-paper-100 rounded-[4px] animate-pulse"
                          style={{ width: `${60 + ((i + j) * 7) % 30}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10 text-center text-[12px] text-text-muted">
                    No RACMs match your filters.
                    {(statusFilter.length || readinessFilter.length || processColFilter.length || frameworkFilter.length) > 0 && (
                      <button
                        type="button"
                        onClick={() => { setStatusFilter([]); setReadinessFilter([]); setProcessColFilter([]); setFrameworkFilter([]); }}
                        className="ml-2 text-brand-700 hover:text-brand-600 cursor-pointer font-medium"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : filtered.map((racm, i) => {
                const rawStatus = getRacmTableStatus(racm);
                const status: RacmTableStatus = rawStatus === 'Locked' && unfrozenIds.includes(racm.id) ? 'Active' : rawStatus;
                const readiness = getRacmTableReadiness(racm);
                const isDraftRacm = racm.isFrozen === false;
                const isLocked = status === 'Locked';
                const isExpanded = expandedId === racm.id;
                const isSelected = selectedIds.includes(racm.id);

                const toggleExpand = () => setExpandedId(isExpanded ? null : racm.id);

                return (
                  <React.Fragment key={racm.id}>
                    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      onClick={() => setDetailRacmId(racm.id)}
                      className={`border-t border-border-light transition-colors cursor-pointer ${isSelected ? 'bg-brand-50/60' : 'hover:bg-surface-2/40'}`}>
                      {/* Row checkbox */}
                      <td className="px-4 py-4 align-top w-8" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(racm.id)}
                          onClick={e => e.stopPropagation()}
                          aria-label={`Select ${racm.name}`}
                          className="w-3.5 h-3.5 rounded-[4px] border border-ink-300 accent-brand-600 cursor-pointer"
                        />
                      </td>
                      {/* Expand chevron */}
                      <td className="px-4 py-4 align-top w-6">
                        {isExpanded ? <ChevronDown size={12} className="text-primary" /> : <ChevronRight size={12} className="text-ink-400" />}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-1.5">
                          {racm.linkedToEngagement && <Lock size={10} className="text-ink-400 shrink-0" />}
                          <span className="text-[13px] font-medium text-text leading-snug">{racm.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center border ${STATUS_BADGE[status]}`}>{status}</span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${READINESS_BADGE[readiness]}`}>{readiness}</span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-paper-50 border border-canvas-border text-ink-700">{racm.process}</span>
                      </td>
                      <td className="px-4 py-4 align-top"><span className="text-[12px] text-ink-500">{racm.framework}</span></td>
                      <td className="px-4 py-4 align-top"><span className="text-[12px] text-text tabular-nums">{racm.risks}</span></td>
                      <td className="px-4 py-4 align-top"><span className="text-[12px] text-text tabular-nums">{racm.controls}</span></td>
                      <td className="px-4 py-4 align-top text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 justify-end">
                          {isSelected ? (
                            <>
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); handleArchiveOne(racm.id); }}
                                className="px-2 py-1 rounded-[6px] text-[10px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 bg-paper-0 border border-ink-200 text-ink-800 hover:bg-paper-50">
                                <Archive size={10} />Archive
                              </button>
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); handleCancelOne(racm.id); }}
                                className="px-2 py-1 rounded-[6px] text-[10px] font-medium text-ink-600 hover:bg-paper-100 cursor-pointer transition-colors">
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              {onOpenInEditor && (
                                <button type="button" onClick={() => onOpenInEditor(racm)}
                                  title="Open this RACM in the full-page editor"
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 bg-primary text-white hover:bg-primary/90">
                                  <Pencil size={9} />Open in editor
                                </button>
                              )}
                              {isDraftRacm && onEditDraft && (
                                <button type="button" onClick={() => onEditDraft(racm)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20">
                                  <Pencil size={9} />Edit draft
                                </button>
                              )}
                              {isLocked && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleReopen(racm.id); }}
                                  className="px-2 py-1 rounded-[6px] text-[10px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1 bg-paper-0 border border-mitigated-300 text-mitigated-700 hover:bg-mitigated-50"
                                  aria-label={`Re-open ${racm.name}`}
                                >
                                  <Unlock size={10} />Re-open
                                </button>
                              )}
                              <button type="button" onClick={toggleExpand}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 bg-paper-100 text-ink-600 hover:bg-paper-200">
                                {isExpanded ? 'Close' : 'View'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>

                    {/* ── Expanded: Inline RACM Mapping Workspace ── */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={colCount} className="p-0">
                          <div className="border-t border-primary/10 bg-surface-2/10">
                            <RacmMappingWorkspace
                              racmId={racm.id}
                              racmName={racm.name}
                              racmProcess={racm.process}
                              isEmpty={racm.risks === 0}
                              onBack={() => setExpandedId(null)}
                              inline
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
      </div>
      )}
    </div>
  );
}
