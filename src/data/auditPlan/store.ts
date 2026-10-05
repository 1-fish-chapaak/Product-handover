/**
 * Persistence for committed audit plans.
 *
 *  • Plan controls per engagement — what the engagement workspace renders as
 *    its controls when an engagement was created (or extended) by a plan.
 *  • Plan workflows — the new checks, saved as Workflow Library rows. They
 *    start as drafts and flip to built when Ira finishes building them.
 *
 * localStorage-backed + useSyncExternalStore, the same pattern as
 * createdEngagementsStore / createdControlsStore.
 */
import { useSyncExternalStore } from 'react';
import type { PlanControl } from './types';

const PLANS_KEY = 'irame.auditPlan.engagements';
const WORKFLOWS_KEY = 'irame.auditPlan.workflows';

export interface EngagementPlanRecord {
  engagementId: string;
  engagementName: string;
  /** 'created' — the engagement was born from the plan and holds only these
   *  controls. 'extended' — the controls were added to an existing engagement. */
  mode: 'created' | 'extended';
  controls: PlanControl[];
}

/** A Workflow Library row born from a plan. Superset of LibraryWorkflow. */
export interface PlanWorkflowRow {
  id: string;
  name: string;
  description: string;
  tags: string[];
  businessProcess: string;
  controlId: string;
  status: 'draft' | 'built';
  engagementId: string;
  engagementName: string;
  /** Plan check id — lets the chat builder mark the right row built. */
  checkId: string;
  buildPrompt: string;
  sampleId: string;
  dataNeeds: string[];
  createdAt: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / private mode */ }
}

let plans: Record<string, EngagementPlanRecord> = read(PLANS_KEY, {});
let workflows: PlanWorkflowRow[] = read(WORKFLOWS_KEY, []);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

// ── Engagement plans ──

export function getEngagementPlan(engagementId: string): EngagementPlanRecord | undefined {
  return plans[engagementId];
}

export function saveEngagementPlan(record: EngagementPlanRecord): void {
  const prev = plans[record.engagementId];
  // Extending twice appends — a second chat split into the same engagement
  // adds its controls rather than replacing the first batch.
  const controls = prev
    ? [...prev.controls, ...record.controls.filter(c => !prev.controls.some(p => p.key === c.key))]
    : record.controls;
  plans = { ...plans, [record.engagementId]: { ...record, mode: prev?.mode ?? record.mode, controls } };
  write(PLANS_KEY, plans);
  emit();
}

export function useEngagementPlan(engagementId: string | undefined): EngagementPlanRecord | undefined {
  const snap = useSyncExternalStore(subscribe, () => plans, () => plans);
  return engagementId ? snap[engagementId] : undefined;
}

// ── Plan workflows ──

export function getPlanWorkflows(): PlanWorkflowRow[] {
  return workflows;
}

export function addPlanWorkflows(rows: PlanWorkflowRow[]): void {
  if (rows.length === 0) return;
  workflows = [...rows, ...workflows.filter(w => !rows.some(r => r.id === w.id))];
  write(WORKFLOWS_KEY, workflows);
  emit();
}

/** Mark a plan check built — by check id, the handle the chat builder holds. */
export function markCheckBuilt(checkId: string, name?: string): void {
  let changed = false;
  workflows = workflows.map(w => {
    if (w.checkId !== checkId || w.status === 'built') return w;
    changed = true;
    return { ...w, status: 'built', name: name ?? w.name };
  });
  if (!changed) return;
  write(WORKFLOWS_KEY, workflows);
  emit();
}

export function usePlanWorkflows(): PlanWorkflowRow[] {
  return useSyncExternalStore(subscribe, () => workflows, () => workflows);
}
