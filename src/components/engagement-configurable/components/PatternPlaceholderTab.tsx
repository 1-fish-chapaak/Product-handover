import React from 'react';
import { Construction } from 'lucide-react';
import type { EngagementPatternType } from '../configurableEngagementTypes';

// Tab-specific descriptions by pattern + tab id
const TAB_DESCRIPTIONS: Record<string, Record<string, string>> = {
  compliance_control_testing: {
    'control-scope': 'Manage RACM-linked, selected, imported, or manually defined controls. Verify each control has required attributes before testing begins.',
    'requests': 'Create and track PBC (Provided by Client) and evidence requests. Assign to stakeholders with due dates and track responses.',
    'samples-evidence': 'Upload sample data, generate samples from population, or configure document-based testing. Attach evidence to samples and attributes.',
    'attr-testing': 'Execute attribute-level testing across samples. Record pass/fail results, attach evidence per attribute, and run automated checks.',
    'working-paper': 'System-generated audit working paper with attribute legend, evidence matrix, testing results, and sample-level detail.',
    'review': 'Submit completed testing for reviewer approval. Reviewer can approve or send back with comments.',
    'conclusion': 'View derived conclusion after reviewer approval. Effective, Partially Effective, or Ineffective based on test results.',
    'summary': 'Engagement summary with overall status, control results, key metrics, and exportable report.',
  },
  internal_audit_assignment: {
    'scope': 'Define the audit scope — process, sub-process, activity, or custom. Link SOPs, RACM, and checklists as scope sources.',
    'announcement': 'Prepare and send the audit announcement letter to stakeholders. Track acknowledgements.',
    'requests-idr': 'Create Information/Document Requests (IDR). Track what was requested, from whom, due dates, and received files.',
    'analysis': 'Run workflow analysis, Q&A sessions, document reviews, and exception discovery. Core audit fieldwork happens here.',
    'observations': 'Document audit observations and findings. Each observation includes description, risk rating, root cause, and recommendation.',
    'discussion': 'Share observations with management for response. Track management comments, agreed actions, and implementation dates.',
    'working-paper': 'System-generated working paper covering scope, procedures, analysis, evidence, observations, and reviewer comments.',
    'final-report': 'Generate the final audit report from working paper and observation data. Required before assignment closure.',
    'action-plan': 'Track agreed action items from observations. Assign owners, due dates, and monitor completion status.',
  },
  workflow_automation_project: {
    'input-data': 'Upload or connect input data — Excel/CSV, PDF documents, SQL queries, images, or hybrid sources.',
    'automation-setup': 'Select an existing workflow, create a new one, use Q&A/ad-hoc analysis, or upload data first and decide later.',
    'runs': 'Execute automation runs. View run history, status, duration, records processed, and exceptions found.',
    'output-review': 'Review automation output. Inspect results, validate exceptions, and approve or flag items for case creation.',
    'cases': 'View cases created from workflow exceptions. Links to existing Case Management for tracking and resolution.',
    'reports': 'Generate output reports — downloadable files, dashboards, email summaries, or case management reports.',
    'schedule': 'Configure recurring run schedule — daily, weekly, monthly, quarterly, or custom frequency.',
    'review': 'Optional reviewer approval step. Enabled only when review is required for this project.',
  },
};

interface Props {
  tabId: string;
  tabLabel: string;
  patternType: EngagementPatternType;
}

export default function PatternPlaceholderTab({ tabId, tabLabel, patternType }: Props) {
  const description = TAB_DESCRIPTIONS[patternType]?.[tabId] || `This section will manage ${tabLabel.toLowerCase()} for this workspace.`;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
      <div className="p-3 rounded-xl bg-surface-2/40 mb-4">
        <Construction size={24} className="text-gray-300" />
      </div>
      <h4 className="text-[14px] font-semibold text-text mb-2">{tabLabel}</h4>
      <p className="text-[12px] text-text-muted leading-relaxed mb-4">{description}</p>
      <span className="px-3 py-1 rounded-full bg-gray-100 text-[10px] text-gray-400 font-medium">
        Coming in a future build step
      </span>
    </div>
  );
}
