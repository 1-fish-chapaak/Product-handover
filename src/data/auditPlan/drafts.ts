/**
 * Audit with AI keeps its progress — context, scope and the plan — so leaving
 * the page mid-way (or a reload) doesn't throw the work away. Home offers to
 * resume it. Cleared once the plan is created.
 */
import type { ProcessCode } from '../engagements';
import type { AuditPlan } from './types';

export interface AuditDraft {
  stage: 'context' | 'plan' | 'timeline' | 'create';
  databases: string[];
  documents: string[];
  uploadedDocs: string[];
  reports: string[];
  files: string[];
  scopeAll: boolean;
  domains: ProcessCode[];
  notes: string;
  plan: AuditPlan | null;
  savedAt: number;
}

const KEY = 'irame.auditWithAi.draft';

export function loadAuditDraft(): AuditDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.stage === 'string' ? v : null;
  } catch { return null; }
}

export function saveAuditDraft(d: Omit<AuditDraft, 'savedAt'>): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...d, savedAt: Date.now() })); } catch { /* quota */ }
}

export function clearAuditDraft(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
