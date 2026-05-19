// ─── Compliance Control Testing — Control Scope Tab ───────────────────────
// Shows the engagement's control universe based on control scope source.
// Setup/governance only — no testing actions.

import React, { useState } from 'react';
import {
  Shield, Star, ChevronDown, ChevronRight, CheckCircle2, AlertCircle,
  MinusCircle, Workflow, Upload, Plus, FileText, Info,
} from 'lucide-react';
import type { ConfigurableEngagement, ComplianceConfig } from '../../configurableEngagementTypes';
import { EngagementPatternType, ControlScopeSource, ComplianceFramework } from '../../configurableEngagementTypes';
import {
  MOCK_COMPLIANCE_CONTROLS, deriveScopeSummary, deriveComplianceControlReadiness,
  type ScopeControl, type ControlReadiness,
} from './complianceControlScopeData';

const IMPORTANCE_CLS = { Key: 'bg-amber-50 text-amber-700', 'Non-Key': 'bg-gray-100 text-gray-500' };
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
}

export default function ComplianceControlScopeTab({ engagement }: Props) {
  const cfg = engagement.config as ComplianceConfig;
  const controls = MOCK_COMPLIANCE_CONTROLS;
  const summary = deriveScopeSummary(controls);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const racmFrameworks: ComplianceFramework[] = [ComplianceFramework.SOX_ICFR, ComplianceFramework.IFC, ComplianceFramework.ICOFR];
  const racmWarning = racmFrameworks.includes(cfg.framework) && cfg.controlScopeSource !== ControlScopeSource.RACM_VERSION;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Control Scope</h3>
          <p className="text-[12px] text-text-muted">Define the controls that will be tested in this compliance engagement.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold">{cfg.framework.replace(/_/g, ' ')}</span>
          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[9px] font-bold">
            {cfg.controlScopeSource.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        </div>
      </div>

      {/* RACM warning */}
      {racmWarning && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>RACM linkage is required for {cfg.framework.replace(/_/g, ' ')}. Current scope source may not meet compliance requirements.</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Total Controls', value: summary.total },
          { label: 'Key Controls', value: summary.keyCount },
          { label: 'Ready', value: summary.ready, cls: 'text-emerald-600' },
          { label: 'Needs Setup', value: summary.needsSetup, cls: summary.needsSetup > 0 ? 'text-amber-600' : '' },
          { label: 'Attributes', value: summary.totalAttrs },
          { label: 'Workflows', value: summary.totalWorkflows },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
            <div className={`text-[16px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Scope source context */}
      <ScopeSourceCard source={cfg.controlScopeSource} racmVersionId={cfg.racmVersionId} />

      {/* Controls table */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border-light bg-surface-2/30 text-[9px] font-semibold text-gray-400 uppercase">
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
                      {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-gray-400 text-[10px]">{ctrl.id}</span>
                        <span className="font-medium text-text">{ctrl.name}</span>
                        {ctrl.importance === 'Key' && <Star size={9} className="fill-amber-400 text-amber-400 shrink-0" />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${NATURE_CLS[ctrl.nature]}`}>{ctrl.nature}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${AUTO_CLS[ctrl.automation]}`}>{ctrl.automation}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-text font-medium">{ctrl.attributes.length}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-text font-medium">{ctrl.workflows.length}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${READINESS_CLS[readiness.status]}`}>
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
    </div>
  );
}

// ─── Scope Source Card ─────────────────────────────────────────────────────

function ScopeSourceCard({ source, racmVersionId }: { source: ControlScopeSource; racmVersionId?: string }) {
  const cards: Record<ControlScopeSource, { icon: React.ElementType; title: string; desc: string; cta?: string }> = {
    [ControlScopeSource.RACM_VERSION]: {
      icon: FileText,
      title: racmVersionId ? `RACM: ${racmVersionId}` : 'RACM Version',
      desc: 'Controls are loaded from the selected RACM version and will be snapshotted for this engagement.',
    },
    [ControlScopeSource.SELECTED_CONTROLS]: {
      icon: Shield,
      title: 'Selected Controls',
      desc: 'Selected controls will be snapshotted into this engagement.',
      cta: 'Add Controls from Library',
    },
    [ControlScopeSource.IMPORTED_CONTROLS]: {
      icon: Upload,
      title: 'Imported Controls',
      desc: 'Imported controls will be added to Control Library and tagged with this engagement/import source.',
      cta: 'Import Control Sheet',
    },
    [ControlScopeSource.MANUAL_CONTROLS]: {
      icon: Plus,
      title: 'Manual Controls',
      desc: 'Manual controls created here will be added to Control Library after review.',
      cta: 'Create Manual Control',
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
        <div className="text-[12px] font-semibold text-text mb-0.5">{card.title}</div>
        <div className="text-[10px] text-gray-500">{card.desc}</div>
      </div>
      {card.cta && (
        <button className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors shrink-0">
          {card.cta}
        </button>
      )}
    </div>
  );
}

// ─── Control Expanded Detail ──────────────────────────────────────────────

function ControlDetail({ ctrl, readiness }: { ctrl: ScopeControl; readiness: ControlReadiness }) {
  return (
    <div className="bg-surface-2/15 border-b border-border-light px-6 py-4 space-y-4">
      {/* Description */}
      <div>
        <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Description</h6>
        <p className="text-[11px] text-text leading-relaxed">{ctrl.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Attributes */}
        <div>
          <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Attributes ({ctrl.attributes.length})
          </h6>
          {ctrl.attributes.length === 0 ? (
            <div className="text-[10px] text-red-500 italic">No attributes configured.</div>
          ) : (
            <div className="space-y-1">
              {ctrl.attributes.map(a => {
                const hasWf = !!a.workflowId;
                return (
                  <div key={a.id} className="flex items-center gap-2 text-[10px]">
                    {hasWf ? (
                      <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                    ) : (
                      <MinusCircle size={10} className="text-amber-400 shrink-0" />
                    )}
                    <span className="font-bold text-primary w-4">{a.code}</span>
                    <span className="text-text">{a.name}</span>
                    <span className="text-gray-400 ml-auto text-[9px]">{a.assertion}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workflows */}
        <div>
          <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Linked Workflows ({ctrl.workflows.length})
          </h6>
          {ctrl.workflows.length === 0 ? (
            <div className="text-[10px] text-red-500 italic">No workflows linked.</div>
          ) : (
            <div className="space-y-1.5">
              {ctrl.workflows.map(wf => (
                <div key={wf.id} className="flex items-start gap-2 text-[10px]">
                  <Workflow size={10} className="text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-text font-medium">{wf.name}</span>
                      <span className="text-[8px] font-mono text-gray-400">{wf.version}</span>
                      <span className={`px-1 py-0.5 rounded text-[7px] font-bold ${AUTO_CLS[wf.type]}`}>{wf.type}</span>
                    </div>
                    <div className="text-[9px] text-gray-400">
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
        <h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Readiness</h6>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
          {[
            { label: 'Control defined', ok: true },
            { label: 'Attributes configured', ok: ctrl.attributes.length > 0 },
            { label: 'Workflows linked', ok: ctrl.workflows.length > 0 },
            { label: 'All attributes mapped', ok: ctrl.attributes.every(a => !!a.workflowId) },
            { label: 'Ready for testing', ok: readiness.status === 'Ready' },
          ].map(c => (
            <span key={c.label} className="flex items-center gap-1">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </span>
          ))}
        </div>
        {readiness.missingItems.length > 0 && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[9px] text-amber-600">
            <Info size={10} className="shrink-0 mt-0.5" />
            <span>{readiness.missingItems.join('. ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
