/**
 * Ask IRA split-plan state — the shapes ChatView keeps in message richData.
 */
import type { AuditPlan } from '../../data/auditPlan';

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
