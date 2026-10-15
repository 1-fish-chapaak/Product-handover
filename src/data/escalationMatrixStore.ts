import { useEffect, useState } from 'react';
import {
  cloneDefaultMatrixSet, defaultMatrixForSeverity, summarizeMatrixSet,
  type EscalationMatrixSet,
} from '../components/reports/atr-upload/escalationMatrix';

// Shared, app-level store for approval & escalation policies. Lifted out of the
// Reports admin tab so BOTH Administration → Approval & Escalation Matrix (where
// they are created) and the report's close-out panel (where they take effect)
// read the same list.
//
// One policy answers both halves of the same question for a department: who
// signs this work off, and who gets chased when it slips. They travel together
// because they are decided together — Procurement approves and chases a late fix
// differently from IT — so configuring one means filling in one screen, not two.
//
// The chain follows the policy tied to the observation, so one choice governs
// both approvals and chasing. The two sides are configured apart because they
// are not the same conversation — the risk owner's team signs the work off
// internally, then audit reviews it — and run together, owner side first.
//
// Levels are not objects you build; they are the order you picked people in.
// First name is L1, second L2, and so on. The approval type then says whether
// the chain is walked one at a time, needs everyone, or clears on the first yes.
//
// In-memory only, so a hard refresh resets to the seed. That matches
// approvalFlowStore.ts, which solves the same problem for exception workflows.

/** How one side's approvers reach a verdict. */
export type ApprovalMode = 'sequential' | 'all' | 'any';

export const APPROVAL_MODES: { value: ApprovalMode; label: string; hint: string }[] = [
  { value: 'sequential', label: 'Sequential', hint: 'L1 decides, then L2, then L3 — each waits for the one before.' },
  { value: 'all', label: 'Everyone must approve', hint: 'Every name has to approve before the work moves on. Order does not matter.' },
  { value: 'any', label: 'Any one approves', hint: 'The first yes from anyone on the list clears this side.' },
];

/** One side of the flow: who signs off, in the order they were picked. */
export interface ApprovalSide {
  /** Approvers by name, in level order — first is L1. Matches the roster the
   *  close-out panel assigns an observation from. */
  approvers: string[];
  mode: ApprovalMode;
}

export interface EscalationMatrixDef {
  id: string;
  name: string;
  /** Which department's convention this encodes. */
  department?: string;
  description?: string;
  /** The risk owner's own chain — signed off inside their team before the work
   *  reaches audit. No approvers = the side is skipped. */
  ownerApproval: ApprovalSide;
  /** The audit side's chain, which runs after the owner's. Both empty = a single
   *  auditor sign-off, which is how close-out behaved before policies existed. */
  auditorApproval: ApprovalSide;
  /** The chasing cadence — one shared, or one per severity. */
  set: EscalationMatrixSet;
  /** Seeded policies are offered as a starting point and can be edited. */
  seeded?: boolean;
  updatedAt: string;
}

const now = () => new Date().toISOString();
const sideOf = (approvers: string[], mode: ApprovalMode = 'sequential'): ApprovalSide => ({ approvers, mode });

/** A set that chases on every severity, so a seeded matrix does something out
 *  of the box — the shipped default is deliberately switched off. */
function liveSet(mode: EscalationMatrixSet['mode'] = 'per-severity'): EscalationMatrixSet {
  const set = cloneDefaultMatrixSet();
  set.mode = mode;
  // The cadence runs to its last rung and stops. Recurring chasing is no longer
  // configurable, so nothing should fire one behind the editor's back.
  const noRepeat = (c: EscalationMatrixSet['all']) => ({ ...c, enabled: true, recurring: { ...c.recurring, enabled: false } });
  set.all = noRepeat(set.all);
  (Object.keys(set.bySeverity) as (keyof typeof set.bySeverity)[]).forEach(sev => {
    set.bySeverity[sev] = noRepeat(defaultMatrixForSeverity(sev, true));
  });
  return set;
}

const SEED: EscalationMatrixDef[] = [
  {
    id: 'esc-default',
    name: 'Standard',
    department: 'All departments',
    description: 'The house policy. Used when an observation names none of its own.',
    ownerApproval: sideOf([]),
    auditorApproval: sideOf(['Tushar Goel']),
    set: liveSet('same'),
    seeded: true,
    updatedAt: now(),
  },
  {
    id: 'esc-procurement',
    name: 'Procurement (P2P)',
    department: 'Procurement',
    description: 'Vendor-master and three-way-match fixes.',
    ownerApproval: sideOf(['Sneha Desai']),
    auditorApproval: sideOf(['Tushar Goel', 'Deepak Bansal']),
    set: liveSet(),
    seeded: true,
    updatedAt: now(),
  },
  {
    id: 'esc-it',
    name: 'IT General Controls',
    department: 'Information Technology',
    description: 'Access and change-management fixes.',
    ownerApproval: sideOf([]),
    auditorApproval: sideOf(['Neha Joshi', 'Rohan Patel'], 'any'),
    set: liveSet(),
    seeded: true,
    updatedAt: now(),
  },
  {
    id: 'esc-finance',
    name: 'Finance & Reporting',
    department: 'Finance',
    description: 'Close and reconciliation fixes.',
    ownerApproval: sideOf(['Karan Mehta']),
    auditorApproval: sideOf(['Rohan Patel', 'Vijay Reddy'], 'all'),
    set: liveSet(),
    seeded: true,
    updatedAt: now(),
  },
];

let matrices: EscalationMatrixDef[] = SEED.map(m => ({ ...m }));
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

const newId = () => `esc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const escalationMatrices = {
  all: (): EscalationMatrixDef[] => matrices,
  byId: (id?: string | null): EscalationMatrixDef | undefined =>
    (id ? matrices.find(m => m.id === id) : undefined),

  create(name: string, department?: string): EscalationMatrixDef {
    const def: EscalationMatrixDef = {
      id: newId(),
      name: name.trim() || 'Untitled policy',
      department: department?.trim() || undefined,
      ownerApproval: sideOf([]),
      auditorApproval: sideOf([]),
      set: liveSet(),
      updatedAt: now(),
    };
    matrices = [...matrices, def];
    notify();
    return def;
  },

  /** Partial update — the editor saves the whole `set`, rename touches `name`. */
  update(id: string, patch: Partial<Omit<EscalationMatrixDef, 'id'>>) {
    matrices = matrices.map(m => (m.id === id ? { ...m, ...patch, updatedAt: now() } : m));
    notify();
  },

  /** Copy a department's cadence as the starting point for a neighbouring one. */
  duplicate(id: string): EscalationMatrixDef | undefined {
    const src = matrices.find(m => m.id === id);
    if (!src) return undefined;
    const copy: EscalationMatrixDef = {
      ...structuredClone(src),
      id: newId(),
      name: `${src.name} (copy)`,
      seeded: false,
      updatedAt: now(),
    };
    matrices = [...matrices, copy];
    notify();
    return copy;
  },

  remove(id: string) {
    matrices = matrices.filter(m => m.id !== id);
    notify();
  },
};

/** Subscribe a component to the shared matrix list. */
export function useEscalationMatrices(): EscalationMatrixDef[] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return matrices;
}

/** One line describing a policy for a list row or a picker option. */
export const describeMatrix = (m: EscalationMatrixDef): string => summarizeMatrixSet(m.set);

/** The policy governing an observation: the one the auditor tied to it, else the
 *  house policy ("Standard"), so there is always an answer. */
export function policyFor(matrixId?: string | null): EscalationMatrixDef | undefined {
  return byIdOrNothing(matrixId) ?? matrices.find(m => m.id === 'esc-default') ?? matrices[0];
}
const byIdOrNothing = (id?: string | null) => (id ? matrices.find(m => m.id === id) : undefined);

/** One stop in the combined chain — one decision somebody has to make. */
export interface ChainStep {
  /** Who decides here. More than one name only when the side clears on any yes. */
  approvers: string[];
  /** "L1", "L2" … within its own side. */
  name: string;
  side: 'owner' | 'auditor';
  sideLabel: string;
  mode: ApprovalMode;
}

/** One side expanded into the decisions it actually needs. 'any' is a single
 *  stop whichever of them answers; the other two are one stop per person. */
function sideSteps(side: ApprovalSide | undefined, which: 'owner' | 'auditor'): ChainStep[] {
  const people = side?.approvers ?? [];
  if (people.length === 0) return [];
  const sideLabel = which === 'owner' ? 'Risk Owner' : 'Auditor';
  const mode = side?.mode ?? 'sequential';
  if (mode === 'any') return [{ approvers: people, name: 'Any one', side: which, sideLabel, mode }];
  return people.map((p, i) => ({ approvers: [p], name: `L${i + 1}`, side: which, sideLabel, mode }));
}

/** Both sides end to end: the risk owner's team signs off first, then audit. */
export function approvalChain(m?: EscalationMatrixDef): ChainStep[] {
  if (!m) return [];
  return [...sideSteps(m.ownerApproval, 'owner'), ...sideSteps(m.auditorApproval, 'auditor')];
}

/** The chain on one line: "Sneha Desai → Tushar Goel → Deepak Bansal". */
export const chainLine = (m?: EscalationMatrixDef): string =>
  approvalChain(m).map(l => l.approvers.join(' or ') || '—').join(' → ');
