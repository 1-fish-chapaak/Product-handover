import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ChevronDown, AlertTriangle, Lock, Pencil,
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
  'Draft':       'bg-gray-100 text-gray-600 border-gray-200/50',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200/50',
  'Active':      'bg-emerald-50 text-emerald-700 border-emerald-200/50',
  'Locked':      'bg-purple-50 text-purple-700 border-purple-200/50',
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
  'Mapping Incomplete':     'bg-amber-50 text-amber-700',
  'Workflow Missing':       'bg-amber-50 text-amber-600',
  'Configuration Pending':  'bg-blue-50 text-blue-600',
  'Ready':                  'bg-emerald-50 text-emerald-700',
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
}

export default function RacmListTable({ processFilter, initialMappingRacm, onMappingOpened, extraRacms, onEditDraft, onOpenInEditor }: Props) {
  const [racmList] = useState<RacmEntry[]>(RACM_SEED_DATA);
  const allRacms = (() => {
    if (!extraRacms || extraRacms.length === 0) return racmList;
    const extraIds = new Set(extraRacms.map(r => r.id));
    return [...racmList.filter(r => !extraIds.has(r.id)), ...extraRacms];
  })();
  const [showMappingWorkspace, setShowMappingWorkspace] = useState(false);
  const [mappingRacm, setMappingRacm] = useState<RacmEntry | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (initialMappingRacm && !showMappingWorkspace) {
      const found = allRacms.find(r => r.id === initialMappingRacm.id);
      if (found) setMappingRacm(found);
      else setMappingRacm({ id: initialMappingRacm.id, name: initialMappingRacm.name, version: 'v1.0', process: initialMappingRacm.process, framework: 'SOX ICFR', risks: 0, controls: 0, mappedRisks: 0, unmappedRisks: 0, keyControls: 0, workflowCoverage: 0, attributesCoverage: 0, isValidated: false, linkedToEngagement: false });
      setShowMappingWorkspace(true);
      onMappingOpened?.();
    }
  }, [initialMappingRacm]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = processFilter ? allRacms.filter(r => r.process === processFilter) : allRacms;

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
  const colCount = 9; // RACM + Status + Readiness + Process + Framework + Risks + Controls + KeyControls + Actions

  return (
    <div className="space-y-3">
      {actionNeededCount > 0 && (
        <div className="rounded-lg border border-amber-200/50 bg-amber-50/30 px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span className="text-[0.75rem] text-amber-800 flex-1">
            <span className="font-semibold">{actionNeededCount} RACM{actionNeededCount !== 1 ? 's' : ''}</span> {actionNeededCount !== 1 ? 'require' : 'requires'} attention — complete setup before execution.
          </span>
        </div>
      )}

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.75rem]">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                {['', 'RACM', 'Status', 'Readiness', 'Process', 'Framework', 'Risks', 'Controls', ''].map((h, idx) => (
                  <th key={h || `col-${idx}`} className={`px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap ${idx === 0 ? 'w-6' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={colCount} className="px-4 py-10 text-center text-[0.75rem] text-text-muted">No RACMs found</td></tr>
              ) : filtered.map((racm, i) => {
                const status = getRacmTableStatus(racm);
                const readiness = getRacmTableReadiness(racm);
                const isDraftRacm = racm.isFrozen === false;
                const isExpanded = expandedId === racm.id;

                const toggleExpand = () => setExpandedId(isExpanded ? null : racm.id);

                return (
                  <React.Fragment key={racm.id}>
                    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      onClick={toggleExpand}
                      className={`border-b border-border/50 transition-colors cursor-pointer ${isExpanded ? 'bg-primary/5' : 'hover:bg-gray-50/60'}`}>
                      {/* Expand chevron */}
                      <td className="px-3 py-3 w-6">
                        {isExpanded ? <ChevronDown size={12} className="text-primary" /> : <ChevronRight size={12} className="text-gray-400" />}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {racm.linkedToEngagement && <Lock size={10} className="text-gray-400 shrink-0" />}
                          <span className="text-[0.75rem] font-medium text-text">{racm.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 h-5 rounded-full text-[0.5625rem] font-semibold inline-flex items-center border ${STATUS_BADGE[status]}`}>{status}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 h-5 rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${READINESS_BADGE[readiness]}`}>{readiness}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center px-2 h-5 rounded-full text-[0.625rem] font-semibold bg-gray-100 text-gray-600 border border-gray-200/60">{racm.process}</span>
                      </td>
                      <td className="px-3 py-3"><span className="text-[0.6875rem] text-gray-500">{racm.framework}</span></td>
                      <td className="px-3 py-3"><span className="text-[0.75rem] text-text tabular-nums">{racm.risks}</span></td>
                      <td className="px-3 py-3"><span className="text-[0.75rem] text-text tabular-nums">{racm.controls}</span></td>
                      <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 justify-end">
                          {onOpenInEditor && (
                            <button onClick={() => onOpenInEditor(racm)}
                              title="Open this RACM in the full-page editor"
                              className="px-2 py-1 rounded-lg text-[0.625rem] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 bg-primary text-white hover:bg-primary/90">
                              <Pencil size={9} />Open in editor
                            </button>
                          )}
                          {isDraftRacm && onEditDraft && (
                            <button onClick={() => onEditDraft(racm)}
                              className="px-2 py-1 rounded-lg text-[0.625rem] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20">
                              <Pencil size={9} />Edit draft
                            </button>
                          )}
                          <button onClick={toggleExpand}
                            className="px-2 py-1 rounded-lg text-[0.625rem] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 bg-gray-100 text-gray-600 hover:bg-gray-200/70">
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
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface-2/30">
          <span className="text-[0.6875rem] text-text-muted">{filtered.length} RACM{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
