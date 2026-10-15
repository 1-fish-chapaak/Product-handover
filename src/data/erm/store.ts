/**
 * The risk register's store — every rated risk with its edits: assessments,
 * linked controls, indicator thresholds, action plans. Saved per workspace
 * (a new client starts with none); seeds added later still appear.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { useStdState } from '../auditPlan';
import { isFreshWorkspace, onWorkspaceChange, workspaceSuffix } from '../auditPlan/workspace';
import { seedErmRisks } from './seed';
import { controlIndex } from './controls';
import { rateRisk, type RiskRating, type ScoreContext } from './score';
import type { ActionItem, ErmRisk, Kri } from './model';

const BASE_KEY = 'irame.erm.v1';
const key = () => BASE_KEY + workspaceSuffix();

function load(): ErmRisk[] {
  const seeds = isFreshWorkspace() ? [] : seedErmRisks();
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return seeds;
    const saved = JSON.parse(raw) as ErmRisk[];
    if (!Array.isArray(saved)) return seeds;
    const have = new Set(saved.map(r => r.id));
    return [...saved, ...seeds.filter(s => !have.has(s.id))];
  } catch { return seeds; }
}

let risks: ErmRisk[] = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
function commit(next: ErmRisk[]) {
  risks = next;
  try { localStorage.setItem(key(), JSON.stringify(next)); } catch { /* memory only */ }
  emit();
}
onWorkspaceChange(() => { risks = load(); emit(); });
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => { if (e.key === key()) { risks = load(); emit(); } });
}
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export const getErmRisks = () => risks;
export function useErmRisks(): ErmRisk[] {
  return useSyncExternalStore(subscribe, () => risks, () => risks);
}

const patch = (id: string, fn: (r: ErmRisk) => ErmRisk) => commit(risks.map(r => (r.id === id ? fn(r) : r)));
const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function updateRisk(id: string, changes: Partial<ErmRisk>) { patch(id, r => ({ ...r, ...changes })); }

export function nextErmId(): string {
  const max = risks.reduce((m, r) => Math.max(m, parseInt(r.id.replace(/^RSK-/, ''), 10) || 0), 0);
  return `RSK-${String(max + 1).padStart(3, '0')}`;
}

export function addRisk(r: Omit<ErmRisk, 'id' | 'kris' | 'events' | 'actions' | 'assessments' | 'createdAt' | 'lastReviewed' | 'status'> & { status?: ErmRisk['status'] }): ErmRisk {
  const created: ErmRisk = {
    ...r, id: nextErmId(), status: r.status ?? 'Active', kris: [], events: [], actions: [],
    assessments: [{ at: today(), by: r.owner, likelihood: r.likelihood, impact: r.impact, note: 'Risk identified' }],
    createdAt: today(), lastReviewed: today(),
  };
  commit([created, ...risks]);
  return created;
}

export function linkControl(id: string, controlId: string) {
  patch(id, r => (r.controlIds.includes(controlId) ? r : { ...r, controlIds: [...r.controlIds, controlId] }));
}
export function unlinkControl(id: string, controlId: string) {
  patch(id, r => ({ ...r, controlIds: r.controlIds.filter(c => c !== controlId) }));
}

export function updateKri(id: string, kriId: string, changes: Partial<Kri>) {
  patch(id, r => ({ ...r, kris: r.kris.map(k => (k.id === kriId ? { ...k, ...changes } : k)) }));
}
export function addKri(id: string, k: Omit<Kri, 'id'>) {
  patch(id, r => ({ ...r, kris: [...r.kris, { ...k, id: `${r.id}-K${r.kris.length + 1}-${Date.now().toString(36).slice(-3)}` }] }));
}

export function addAction(id: string, a: Omit<ActionItem, 'id' | 'done'>) {
  patch(id, r => ({ ...r, actions: [...r.actions, { ...a, id: `${r.id}-A${Date.now().toString(36)}`, done: false }] }));
}
export function toggleAction(id: string, actionId: string) {
  patch(id, r => ({ ...r, actions: r.actions.map(a => (a.id === actionId ? { ...a, done: !a.done } : a)) }));
}

export function recordAssessment(id: string, a: { likelihood: number; impact: number; note: string; by: string }) {
  patch(id, r => ({
    ...r, likelihood: a.likelihood, impact: a.impact, lastReviewed: today(),
    assessments: [{ at: today(), ...a }, ...r.assessments],
  }));
}

/** Risks a control mitigates — the Control Library's side of the link. */
export function risksForControl(controlId: string, list: ErmRisk[] = risks): ErmRisk[] {
  return list.filter(r => r.controlIds.includes(controlId) && r.status !== 'Archived');
}

/** Every risk rated, re-rated whenever a risk or a standard control changes. */
export function useRiskRatings(): { ratings: RiskRating[]; ctx: ScoreContext } {
  const list = useErmRisks();
  const std = useStdState();
  return useMemo(() => {
    const ctx: ScoreContext = { index: controlIndex(std), std };
    return { ratings: list.filter(r => r.status !== 'Archived').map(r => rateRisk(r, ctx)), ctx };
  }, [list, std]);
}
