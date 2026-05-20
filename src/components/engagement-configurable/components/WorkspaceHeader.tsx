import React from 'react';
import { ArrowLeft, Settings, Shield, ClipboardCheck, Workflow } from 'lucide-react';
import type { ConfigurableEngagement } from '../configurableEngagementTypes';
import { EngagementPatternType } from '../configurableEngagementTypes';

const PATTERN_ICONS: Record<EngagementPatternType, React.ElementType> = {
  [EngagementPatternType.COMPLIANCE_CONTROL_TESTING]: Shield,
  [EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT]: ClipboardCheck,
  [EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT]: Workflow,
};

const PATTERN_LABELS: Record<EngagementPatternType, string> = {
  [EngagementPatternType.COMPLIANCE_CONTROL_TESTING]: 'Compliance Control Testing',
  [EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT]: 'Internal Audit Assignment',
  [EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT]: 'Workflow Automation Project',
};

const STATUS_CLS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PLANNED: 'bg-blue-50 text-blue-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  IN_PROGRESS: 'bg-purple-50 text-purple-700',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-500',
  ON_HOLD: 'bg-red-50 text-red-600',
};

interface Props {
  engagement: ConfigurableEngagement;
  onBack?: () => void;
  onEditSetup?: () => void;
  backLabel?: string;
}

export default function WorkspaceHeader({ engagement, onBack, onEditSetup, backLabel }: Props) {
  const Icon = PATTERN_ICONS[engagement.patternType];
  const patternLabel = PATTERN_LABELS[engagement.patternType];

  return (
    <div className="rounded-xl border border-border-light bg-white p-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Icon size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[15px] font-bold text-text truncate">{engagement.name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold shrink-0 ${STATUS_CLS[engagement.status] || STATUS_CLS.DRAFT}`}>
                {engagement.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold">{engagement.displayLabel}</span>
              <span className="text-[10px] text-gray-400">{patternLabel}</span>
              {engagement.stage && <span className="text-[10px] text-gray-400">· {engagement.stage}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500">
              <span><span className="text-gray-400">Owner:</span> {engagement.owner}</span>
              {engagement.reviewer && <span><span className="text-gray-400">Reviewer:</span> {engagement.reviewer}</span>}
              {engagement.businessProcess && <span><span className="text-gray-400">Process:</span> {engagement.businessProcess}</span>}
              {engagement.entityOrLocation && <span><span className="text-gray-400">Entity:</span> {engagement.entityOrLocation}</span>}
              {engagement.dataPeriodStart && engagement.dataPeriodEnd && (
                <span><span className="text-gray-400">Data Period:</span> {engagement.dataPeriodStart} to {engagement.dataPeriodEnd}</span>
              )}
              {engagement.plannedStartDate && engagement.plannedEndDate && (
                <span><span className="text-gray-400">Planned:</span> {engagement.plannedStartDate} to {engagement.plannedEndDate}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onEditSetup && (
            <button onClick={onEditSetup} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">
              <Settings size={12} />Edit Setup
            </button>
          )}
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">
              <ArrowLeft size={12} />{backLabel || 'Back to Wizard'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
