import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ChevronDown, AlertTriangle, Lock, Pencil, HelpCircle, Grid3x3,
  Archive, Unlock,
} from 'lucide-react';
import RacmMappingWorkspace from './RacmMappingWorkspace';

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
  const selectAllRef = useRef<HTMLInputElement | null>(null);

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
  const filtered = baseFiltered.filter(r => !archivedIds.includes(r.id));

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

  const actionNeededCount = filtered.filter(r => getRacmTableReadiness(r) !== 'Ready').length;
  const colCount = 10; // select + col-0 + RACM + Status + Readiness + Process + Framework + Risks + Controls + Actions

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-brand-50 border-y border-brand-200 rounded-[8px] mb-3">
          <span className="text-[13px] font-medium text-brand-700">{selectedIds.length} selected</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleBulkArchive}
            className="px-3 py-1.5 rounded-[6px] bg-paper-0 border border-ink-200 text-[12px] text-ink-800 hover:bg-paper-50 inline-flex items-center gap-1.5"
          >
            <Archive className="w-3.5 h-3.5" />Archive
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="px-3 py-1.5 rounded-[6px] text-[12px] text-ink-600 hover:bg-paper-100"
          >
            Cancel
          </button>
        </div>
      )}

      {(actionNeededCount > 0 || headerAction) && (
        <div className="flex items-center gap-3">
          {actionNeededCount > 0 ? (
            <div className="flex-1 rounded-[8px] border border-high-700/15 bg-high-50 px-4 py-2.5 flex items-center gap-3">
              <AlertTriangle size={14} className="text-high-700 shrink-0" />
              <span className="text-[12px] text-high-700">
                <span className="font-semibold">{actionNeededCount} RACM{actionNeededCount !== 1 ? 's' : ''}</span> {actionNeededCount !== 1 ? 'require' : 'requires'} attention — complete setup before execution.
              </span>
            </div>
          ) : <div className="flex-1" />}
          {headerAction}
        </div>
      )}

      {!isLoading && filtered.length === 0 && onCreate ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-[12px] bg-paper-100 flex items-center justify-center mb-4">
            <Grid3x3 className="w-6 h-6 text-ink-500" />
          </div>
          <h3 className="text-[15px] font-display text-ink-800 mb-1">No RACMs yet</h3>
          <p className="text-[13px] text-ink-600 mb-5 max-w-[320px]">Build a Risk &amp; Controls Matrix from the SOP or from scratch.</p>
          <button type="button" onClick={onCreate} className="px-4 py-2 rounded-[8px] bg-brand-600 text-paper-0 text-[13px] font-medium hover:bg-brand-700">New RACM</button>
        </div>
      ) : (
      <div className="border-t border-border-light overflow-x-auto">
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
                  { key: 'status', label: 'Status', tooltip: 'Current lifecycle state. Draft = in progress, Active = live, Locked = frozen for audit.' },
                  { key: 'readiness', label: 'Readiness', tooltip: 'Whether the RACM is ready to enter active monitoring. Includes mapping, workflow, and config checks.' },
                  { key: 'process', label: 'Process' },
                  { key: 'framework', label: 'Framework' },
                  { key: 'risks', label: 'Risks' },
                  { key: 'controls', label: 'Controls' },
                  { key: 'col-actions', label: '' },
                ] as Array<{ key: string; label: string; tooltip?: string }>).map((h, idx) => (
                  <th key={h.key} className={`px-4 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap ${idx === 0 ? 'w-6' : ''}`}>
                    {h.tooltip ? (
                      <span className="inline-flex items-center gap-1 group/tip relative">
                        {h.label}
                        <HelpCircle className="w-3 h-3 text-ink-400" aria-label={`What is ${h.label}?`} />
                        <span className="absolute top-full left-0 mt-1 w-[220px] p-2.5 rounded-[8px] bg-ink-800 text-paper-0 text-[12px] font-normal leading-snug normal-case tracking-normal opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50">
                          {h.tooltip}
                        </span>
                      </span>
                    ) : h.label}
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
                <tr><td colSpan={colCount} className="px-4 py-10 text-center text-[12px] text-text-muted">No RACMs found</td></tr>
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
                      onClick={toggleExpand}
                      className={`border-t border-border-light transition-colors cursor-pointer ${isSelected ? 'bg-brand-50/60' : isExpanded ? 'bg-primary/5' : 'hover:bg-surface-2/40'}`}>
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
                        <span className={`px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center border ${STATUS_BADGE[status]}`}>{status}</span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={`px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center ${READINESS_BADGE[readiness]}`}>{readiness}</span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-paper-50 border border-canvas-border text-ink-700">{racm.process}</span>
                      </td>
                      <td className="px-4 py-4 align-top"><span className="text-[12px] text-ink-500">{racm.framework}</span></td>
                      <td className="px-4 py-4 align-top"><span className="text-[12px] text-text tabular-nums">{racm.risks}</span></td>
                      <td className="px-4 py-4 align-top"><span className="text-[12px] text-text tabular-nums">{racm.controls}</span></td>
                      <td className="px-4 py-4 align-top text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 justify-end">
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
