/**
 * Ask IRA split-plan state — the shapes ChatView keeps in message richData
 * and the build queue, plus the draft scaffold for a queued check.
 */
import { SAMPLE_WORKFLOWS } from '../concierge-workflow-builder/sampleWorkflows';
import type { WorkflowDraft } from '../concierge-workflow-builder/types';
import type { AuditPlan } from '../../data/auditPlan';

export interface QueueItem {
  checkId: string;
  controlId: string;
  name: string;
  description: string;
  prompt: string;
  sampleId: string;
  dataNeeds: string[];
  status: 'pending' | 'building' | 'built' | 'skipped';
}

export interface BuildQueue {
  engagementId: string;
  engagementName: string;
  items: QueueItem[];
  index: number;
}

export interface SplitPlanData {
  plan: AuditPlan;
  status: 'open' | 'committed' | 'declined';
  committed?: { engagementId: string; engagementName: string; created: boolean; reused: number; newChecks: number; manual: number };
}

export interface NudgeData {
  prompt: string;
  checks: string[];
  status: 'open' | 'switched' | 'kept';
}

/** Scaffold a builder draft for one check from the sample it maps to. */
export function draftForCheck(item: QueueItem): WorkflowDraft {
  const base = SAMPLE_WORKFLOWS.find(s => s.id === item.sampleId) ?? SAMPLE_WORKFLOWS[0];
  return {
    ...base,
    id: `draft-${item.checkId}-${Date.now()}`,
    name: item.name,
    description: item.description,
    category: 'GRC check',
    tags: [...base.tags.slice(0, 2), item.controlId],
    logicPrompt: item.prompt,
    output: { ...base.output, title: `${item.name} — exceptions`, description: `Exceptions for control ${item.controlId}, with a summary.` },
  };
}


export interface SplitSummaryData {
  engagementId: string;
  engagementName: string;
  built: string[];
  drafts: string[];
}
