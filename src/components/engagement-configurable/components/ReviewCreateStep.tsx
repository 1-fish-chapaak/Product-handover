import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { EngagementPatternType, EngagementConfig, ValidationResult } from '../configurableEngagementTypes';
import { PATTERN_DISPLAY_LABELS } from '../configurableEngagementTypes';
import { getEngagementPatternDefinition } from '../engagementPatterns';
import type { CommonDetails } from './CommonDetailsStep';

interface Props {
  patternType: EngagementPatternType;
  details: CommonDetails;
  config: EngagementConfig;
  validation: ValidationResult;
  isCreated: boolean;
  onCreate: () => void;
}

export default function ReviewCreateStep({ patternType, details, config, validation, isCreated, onCreate }: Props) {
  const pattern = getEngagementPatternDefinition(patternType);
  const label = PATTERN_DISPLAY_LABELS[patternType];
  const errors = validation.errors.filter(e => e.severity === 'error');
  const warnings = validation.errors.filter(e => e.severity === 'warning');

  const SummaryRow = ({ label: l, value }: { label: string; value: string }) => (
    <div className="flex items-baseline gap-2 text-[11px]">
      <span className="text-gray-400 w-32 shrink-0">{l}</span>
      <span className="text-text font-medium">{value || '—'}</span>
    </div>
  );

  // Build config summary entries based on pattern
  const configEntries: { label: string; value: string }[] = [];
  if (config.patternType === 'compliance_control_testing') {
    configEntries.push(
      { label: 'Framework', value: config.framework.replace('_', ' ') },
      { label: 'Audit Type', value: config.auditType },
      { label: 'Control Scope', value: config.controlScopeSource.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) },
      { label: 'Testing Method', value: config.defaultTestingInputMethod.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) },
      { label: 'Control Override', value: config.allowControlLevelOverride ? 'Allowed' : 'Not allowed' },
    );
    if (config.racmVersionId) configEntries.push({ label: 'RACM Version', value: config.racmVersionId });
  }
  if (config.patternType === 'internal_audit_assignment') {
    configEntries.push(
      { label: 'Scope Level', value: config.scopeLevel.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) },
      { label: 'Process Owner', value: config.processOwner },
      { label: 'IDR', value: config.idrEnabled ? 'Enabled' : 'Disabled' },
      { label: 'Announcement', value: config.announcementRequired ? 'Required' : 'Not required' },
      { label: 'Final Report', value: config.finalReportRequired ? 'Required' : 'Not required' },
      { label: 'Action Tracking', value: config.actionTrackingEnabled ? 'Enabled' : 'Disabled' },
    );
  }
  if (config.patternType === 'workflow_automation_project') {
    configEntries.push(
      { label: 'Outputs', value: config.outputTypes.map(o => o.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())).join(', ') },
      { label: 'Run Type', value: config.runType.replace(/_/g, ' ') },
    );
    if (config.frequency) configEntries.push({ label: 'Frequency', value: config.frequency });
    configEntries.push(
      { label: 'Review', value: config.reviewRequired ? 'Required' : 'Not required' },
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-bold text-text mb-1">Review & Create</h3>
        <p className="text-[12px] text-text-muted">Review your {label.toLowerCase()} configuration before creating.</p>
      </div>

      {/* Validation */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50/30 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700"><AlertTriangle size={12} />Errors ({errors.length})</div>
          {errors.map((e, i) => (
            <div key={i} className="text-[10px] text-red-600 pl-5">- {e.message}</div>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700"><AlertTriangle size={12} />Warnings ({warnings.length})</div>
          {warnings.map((w, i) => (
            <div key={i} className="text-[10px] text-amber-600 pl-5">- {w.message}</div>
          ))}
        </div>
      )}

      {/* Work Type */}
      <div className="rounded-lg border border-border-light p-3 space-y-1.5">
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Work Type</h5>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-text">{pattern.label}</span>
          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold">{label}</span>
        </div>
      </div>

      {/* Common Details */}
      <div className="rounded-lg border border-border-light p-3 space-y-1">
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label} Details</h5>
        <SummaryRow label="Name" value={details.name} />
        <SummaryRow label="Objective" value={details.description} />
        <SummaryRow label="Owner" value={details.owner} />
        <SummaryRow label="Reviewer" value={details.reviewer} />
        <SummaryRow label="Business Process" value={details.businessProcess} />
        <SummaryRow label="Entity / Location" value={details.entityOrLocation} />
        <SummaryRow label="Planned Period" value={details.plannedStartDate && details.plannedEndDate ? `${details.plannedStartDate} to ${details.plannedEndDate}` : ''} />
        <SummaryRow label="Data Period" value={details.dataPeriodStart && details.dataPeriodEnd ? `${details.dataPeriodStart} to ${details.dataPeriodEnd}` : ''} />
      </div>

      {/* Pattern Config */}
      <div className="rounded-lg border border-border-light p-3 space-y-1">
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pattern Setup</h5>
        {configEntries.map((e, i) => (
          <SummaryRow key={i} label={e.label} value={e.value} />
        ))}
      </div>

      {/* Workspace Preview */}
      <div className="rounded-lg border border-border-light p-3">
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Workspace Tabs</h5>
        <div className="flex flex-wrap gap-1.5">
          {pattern.workspaceTabs.map(tab => (
            <span key={tab.id} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-semibold">{tab.label}</span>
          ))}
        </div>
      </div>

      {/* Required Outputs */}
      <div className="rounded-lg border border-border-light p-3">
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Required Outputs</h5>
        <div className="space-y-1">
          {pattern.requiredOutputs.map(o => (
            <div key={o} className="flex items-center gap-1.5 text-[10px] text-text">
              <CheckCircle2 size={10} className="text-gray-300" />
              {o}
            </div>
          ))}
        </div>
      </div>

      {/* Create */}
      {isCreated ? (
        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/30 p-4 text-center">
          <CheckCircle2 size={20} className="text-emerald-600 mx-auto mb-2" />
          <p className="text-[13px] font-semibold text-emerald-800">Draft created locally</p>
          <p className="text-[11px] text-emerald-600 mt-1">Routing and persistence will be wired in a later step.</p>
        </div>
      ) : (
        <button onClick={onCreate} disabled={!validation.isValid}
          className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Create {label}
        </button>
      )}
    </div>
  );
}
