// ─── Internal Audit — RACM Tab ────────────────────────────────────────────
// Reuses the same RacmMappingWorkspace used in Business Process RACM,
// rendered inline with IA context. Provides the same expand/risk/control/
// workflow/attribute experience scoped to the IA assignment.

import React, { useState } from 'react';
import { ChevronRight, FileText, Info } from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import { RACMS, SOPS, type InternalAuditScopeState } from './internalAuditScopeData';
import RacmMappingWorkspace from '../../../audit/RacmMappingWorkspace';

interface Props {
  engagement: ConfigurableEngagement;
  scope: InternalAuditScopeState;
  onNavigateTab?: (tabId: string) => void;
}

export default function InternalAuditRacmTab({ engagement, scope, onNavigateTab }: Props) {
  const selectedRacms = RACMS.filter(r => scope.racmVersionIds.includes(r.id));
  const selectedSops = SOPS.filter(s => scope.sopIds.includes(s.id));
  const hasDirectRacm = selectedRacms.length > 0;
  const hasSopOnly = !hasDirectRacm && selectedSops.length > 0;

  // For SOP-only, use a default RACM derived from the SOP process
  const [sopRacmExpanded, setSopRacmExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Context banner */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 text-[0.6875rem] text-blue-600">
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>
          Review the RACM risk-control mapping for this audit assignment. Expand risks to see mapped controls and link workflows before proceeding to Analysis.
          {hasSopOnly && ' RACM is derived from the selected SOP(s).'}
        </span>
      </div>

      {/* Direct RACM selected — render full RacmMappingWorkspace inline */}
      {hasDirectRacm && selectedRacms.map(racm => {
        const process = racm.id === 'racm-p2p' ? 'P2P' : racm.id === 'racm-ap' ? 'P2P' : 'O2C';
        return (
          <div key={racm.id} className="rounded-xl border border-border-light overflow-hidden">
            <RacmMappingWorkspace
              onBack={() => {}} // no-op for inline
              racmId={racm.id}
              racmName={racm.name}
              racmProcess={process}
              inline={true}
              hideAttributes={true}
            />
          </div>
        );
      })}

      {/* SOP-only — show SOP context + embedded RACM workspace with default data */}
      {hasSopOnly && (
        <>
          <div className="rounded-lg border border-border-light bg-white p-5 space-y-3">
            <div className="flex items-start gap-3">
              <FileText size={18} className="text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[0.8125rem] font-bold text-text mb-0.5">SOP-Derived RACM</h4>
                <p className="text-[0.75rem] text-text-muted leading-relaxed">
                  {selectedSops.length} SOP(s) selected in scope. The RACM below is derived from the primary SOP for risk-control review.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedSops.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2/30 border border-border-light/50 text-[0.6875rem]">
                  <FileText size={10} className="text-primary shrink-0" />
                  <span className="font-medium text-text">{s.name}</span>
                  <span className="text-ink-400">{s.version}</span>
                  <span className="text-ink-400">· {s.process}</span>
                </span>
              ))}
            </div>
            {!sopRacmExpanded && (
              <button onClick={() => setSopRacmExpanded(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-[0.6875rem] font-semibold text-primary hover:bg-primary/15 cursor-pointer transition-colors">
                <ChevronRight size={11} />Open RACM Mapping
              </button>
            )}
          </div>
          {sopRacmExpanded && (
            <div className="rounded-xl border border-border-light overflow-hidden">
              <RacmMappingWorkspace
                onBack={() => {}}
                racmName="SOP-Derived RACM"
                racmProcess={selectedSops[0]?.process || 'P2P'}
                inline={true}
              hideAttributes={true}
              />
            </div>
          )}
        </>
      )}

      {/* Continue to Controls */}
      <div className="flex items-center gap-2">
        <button onClick={() => onNavigateTab?.('ia-controls')}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold cursor-pointer transition-colors">
          Continue to Controls <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
