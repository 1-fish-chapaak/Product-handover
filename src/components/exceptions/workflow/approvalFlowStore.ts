import { useEffect, useState } from 'react';
import { SEED_TEMPLATES } from './workflowData';
import type { WorkflowTemplate, Persona } from './workflowTypes';

// Shared, app-level store for approval-flow templates. Lifted out of any single
// screen so BOTH the Administration → Approval Flow tab (where flows are created
// and managed) and the Exceptions "Assign Approval Flow" modal (where they're used)
// read and write the same list — create a flow in one place, it shows in the other.
// In-memory only, so a hard refresh resets to the seed (matches the rest of the demo).
let templates: WorkflowTemplate[] = SEED_TEMPLATES.map(t => ({ ...t }));
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export const approvalFlows = {
  all: (): WorkflowTemplate[] => templates,
  upsert(t: WorkflowTemplate) {
    const exists = templates.some(x => x.id === t.id);
    // Editing bumps the version so in-flight assignments keep their snapshot.
    const next = exists ? { ...t, version: (templates.find(x => x.id === t.id)?.version ?? 0) + 1 } : t;
    templates = exists ? templates.map(x => (x.id === t.id ? next : x)) : [...templates, next];
    notify();
  },
  remove(id: string) {
    templates = templates.filter(t => t.id !== id);
    notify();
  },
  setDefault(id: string, persona: Persona) {
    templates = templates.map(t => (t.persona === persona ? { ...t, isDefault: t.id === id } : t));
    notify();
  },
};

/** Subscribe a component to the shared approval-flow list. */
export function useApprovalFlows(): WorkflowTemplate[] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return templates;
}
