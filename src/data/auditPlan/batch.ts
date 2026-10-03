/**
 * Batch builds — several workflows built in one go, reviewed afterwards.
 *
 * Used everywhere more than one workflow gets built: adapting the standard
 * library, Audit with AI's "Build checks with Ira", a split chat prompt, a
 * draft from the Workflow Library. The data is resolved up front (chosen
 * files, or auto-matched connected sources), so Ira builds every workflow
 * without stopping; a workflow whose data it can't find is parked as
 * "Needs your input" instead of blocking the rest.
 *
 * Each workflow gets its own review session (opened in a new browser tab).
 * State lives in localStorage and syncs across tabs: approving in a session
 * tab updates the batch card in the main chat.
 */
import { useSyncExternalStore } from 'react';
import type { ProcessCode } from '../engagements';
import { CHECK_CATALOG, type CatalogEntry } from './catalog';
import { filesForEntry, filesForNeeds, hash01, type FileSourceChoice } from './stdFiles';
import { markStdAdapted, markStdLive } from './standardLibrary';
import { recordApproval } from './ledger';
import { COMPLEXITY_HOURS, valueOfKey } from './score';
import { markCheckBuilt, type PlanWorkflowRow } from './store';

export type BatchItemStatus = 'queued' | 'building' | 'ready' | 'needs-input' | 'approved';

export interface BatchFile {
  code: string;
  name: string;
  /** Where Ira reads it from — a connected source or an uploaded file; null = not found. */
  source: string | null;
}

export interface BatchItem {
  id: string;
  sessionId: string;
  name: string;
  description: string;
  controlId: string;
  process: ProcessCode;
  cadence: string;
  stdKey?: string;
  checkId?: string;
  files: BatchFile[];
  status: BatchItemStatus;
  rowsScanned?: number;
  exceptions?: number;
  assumptions: string[];
  question?: { text: string; options: string[] };
  answer?: string;
  /** When it became ready to review — on-time reviews are within 48 h. */
  readyAt?: number;
  approvedBy?: string;
  updatedAt: number;
}

export interface BuildBatch {
  id: string;
  title: string;
  origin: 'adapt' | 'audit-plan' | 'split' | 'draft';
  engagementId?: string;
  engagementName?: string;
  /** Who started the batch — owns the workflows it builds (and their hours). */
  owner?: string;
  items: BatchItem[];
  createdAt: number;
}

const KEY = 'irame.buildBatches';

function read(): Record<string, BuildBatch> {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

let batches: Record<string, BuildBatch> = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(batches)); } catch { /* quota */ }
  emit();
}
// Another tab (a review session, or the main chat) wrote — re-read. Module
// level, so nothing is missed while no component happens to be subscribed.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => { if (e.key === KEY) { batches = read(); emit(); } });
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const getBatch = (id: string): BuildBatch | undefined => batches[id];

/** Every batch, newest first — the Builds & reviews inbox and Home read this. */
export function useAllBatches(): BuildBatch[] {
  const snap = useSyncExternalStore(subscribe, () => batches, () => batches);
  return Object.values(snap).sort((a, b) => b.createdAt - a.createdAt);
}

/** Items that need the user: a question to answer, or a build to review. */
export function pendingItems(list: BuildBatch[]) {
  const needsInput = list.flatMap(b => b.items.filter(i => i.status === 'needs-input' && !i.answer?.startsWith('Leave')).map(i => ({ batch: b, item: i })));
  const toReview = list.flatMap(b => b.items.filter(i => i.status === 'ready').map(i => ({ batch: b, item: i })));
  const building = list.flatMap(b => b.items.filter(i => i.status === 'building' || i.status === 'queued').map(i => ({ batch: b, item: i })));
  return { needsInput, toReview, building };
}

export function useBatch(id: string | undefined): BuildBatch | undefined {
  const snap = useSyncExternalStore(subscribe, () => batches, () => batches);
  return id ? snap[id] : undefined;
}

export function findSession(sessionId: string, from = batches): { batch: BuildBatch; item: BatchItem } | undefined {
  for (const batch of Object.values(from)) {
    const item = batch.items.find(i => i.sessionId === sessionId);
    if (item) return { batch, item };
  }
  return undefined;
}

export function useSession(sessionId: string | undefined) {
  const snap = useSyncExternalStore(subscribe, () => batches, () => batches);
  return sessionId ? findSession(sessionId, snap) : undefined;
}

function updateItem(batchId: string, itemId: string, patch: Partial<BatchItem>) {
  const b = batches[batchId];
  if (!b) return;
  batches = {
    ...batches,
    [batchId]: { ...b, items: b.items.map(i => (i.id === itemId ? { ...i, ...patch, updatedAt: Date.now() } : i)) },
  };
  persist();
}

// ── Building items ───────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

function assumptionsFor(files: BatchFile[], cadence: string): string[] {
  return [
    ...files.filter(f => f.source).map(f => `Read ${f.code} (${f.name}) from ${f.source}`),
    'Population: last 12 months, every row (standard default)',
    'Amount tolerance ±2% before a difference counts as an exception (standard default)',
    `Runs ${cadence.toLowerCase()} once approved`,
  ];
}

function makeItem(base: Omit<BatchItem, 'id' | 'sessionId' | 'status' | 'assumptions' | 'updatedAt'>): BatchItem {
  return {
    ...base,
    id: `bi-${uid()}`,
    sessionId: `ses-${uid()}`,
    status: 'queued',
    assumptions: assumptionsFor(base.files, base.cadence),
    updatedAt: Date.now(),
  };
}

/** Items for standard controls, using the files chosen in the adapt modal. */
export function itemsFromEntries(entries: CatalogEntry[], choices: Record<string, FileSourceChoice | null>): BatchItem[] {
  return entries.map(e => makeItem({
    name: e.existingWorkflowName ?? e.checkName,
    description: e.checkDescription,
    controlId: e.controlId,
    process: e.process,
    cadence: e.cadence,
    stdKey: e.key,
    files: filesForEntry(e).map(f => {
      const c = choices[f.id];
      return { code: f.code, name: f.name, source: c && c.kind !== 'skip' ? c.name : null };
    }),
  }));
}

/** Items for plan checks (Audit with AI, a split prompt, a Library draft).
 *  No files were chosen, so each input auto-matches a connected source. */
export function itemsFromPlanRows(rows: PlanWorkflowRow[]): BatchItem[] {
  return rows.map(r => {
    const entry = CHECK_CATALOG.find(e => e.key === r.stdKey);
    return makeItem({
      name: r.name,
      description: r.description,
      controlId: r.controlId,
      process: entry?.process ?? 'P2P',
      cadence: entry?.cadence ?? 'Monthly',
      stdKey: r.stdKey,
      checkId: r.checkId,
      files: filesForNeeds(r.dataNeeds).map(f => ({ code: f.code, name: f.name, source: f.matches ?? null })),
    });
  });
}

export function createBatch(input: Omit<BuildBatch, 'id' | 'createdAt'>): string {
  const id = `batch-${uid()}`;
  batches = { ...batches, [id]: { ...input, id, createdAt: Date.now() } };
  persist();
  return id;
}

// ── Runner ───────────────────────────────────────────────────────────────
// Runs in the tab that owns the batch (the main chat). Builds one item at a
// time; a page reload resumes from whatever is still queued or building.

const running = new Set<string>();

function rowsFor(item: BatchItem): number {
  return 4_000 + Math.round(hash01(item.name) * 180_000);
}

function finishItem(batchId: string, item: BatchItem) {
  const missing = item.files.filter(f => !f.source);
  if (missing.length > 0 && !item.answer) {
    const f = missing[0];
    updateItem(batchId, item.id, {
      status: 'needs-input',
      question: {
        text: `I couldn't find ${f.code} (${f.name}) in your connected sources. Where should I read it from?`,
        options: [`Upload ${f.code} now`, 'Build without it — skip that test step', 'Leave this workflow as a draft'],
      },
    });
    return;
  }
  updateItem(batchId, item.id, {
    status: 'ready',
    question: undefined,
    readyAt: Date.now(),
    rowsScanned: rowsFor(item),
    exceptions: 2 + Math.round(hash01(item.controlId + item.name) * 38),
  });
  if (item.stdKey) markStdAdapted([item.stdKey]);
  if (item.checkId) markCheckBuilt(item.checkId, item.name);
}

export function ensureBatchRunning(batchId: string): void {
  if (running.has(batchId)) return;
  running.add(batchId);
  const step = () => {
    const b = batches[batchId];
    if (!b) { running.delete(batchId); return; }
    const next = b.items.find(i => i.status === 'building') ?? b.items.find(i => i.status === 'queued');
    if (!next) { running.delete(batchId); return; }
    if (next.status === 'queued') updateItem(batchId, next.id, { status: 'building' });
    window.setTimeout(() => {
      const fresh = batches[batchId]?.items.find(i => i.id === next.id);
      if (fresh) finishItem(batchId, fresh);
      step();
    }, 1100 + Math.round(hash01(next.id) * 900));
  };
  step();
}

/** Answer a "needs your input" question (from the session tab or the card). */
export function answerSession(sessionId: string, answer: string): void {
  const hit = findSession(sessionId);
  if (!hit) return;
  const { batch, item } = hit;
  if (answer.startsWith('Leave')) {
    updateItem(batch.id, item.id, { answer, question: undefined, status: 'needs-input' });
    return;
  }
  const files = answer.startsWith('Build without')
    ? item.files.filter(f => f.source)
    : item.files.map(f => (f.source ? f : { ...f, source: `${f.code.toLowerCase()}_upload.xlsx (uploaded)` }));
  updateItem(batch.id, item.id, { answer, files, question: undefined, status: 'building', assumptions: assumptionsFor(files, item.cadence) });
  window.setTimeout(() => {
    const fresh = batches[batch.id]?.items.find(i => i.id === item.id);
    if (fresh) finishItem(batch.id, fresh);
  }, 1400);
}

/** Approve a built workflow: it goes live, and its owner starts earning its
 *  hours. The approver earns a review (on time if within 48 h), not hours. */
export function approveSession(sessionId: string, approver: string): void {
  const hit = findSession(sessionId);
  if (!hit || hit.item.status !== 'ready') return;
  const { batch, item } = hit;
  updateItem(batch.id, item.id, { status: 'approved', approvedBy: approver });
  if (item.stdKey) markStdLive([item.stdKey]);
  const v = valueOfKey(item.stdKey);
  recordApproval({
    name: item.name,
    controlId: item.controlId,
    process: item.process,
    complexity: v?.complexity ?? 'mid',
    hoursPerMonth: v?.hoursPerMonth ?? COMPLEXITY_HOURS.mid,
    basis: v?.basis ?? 'est.',
    owner: batch.owner ?? approver,
    approvedBy: approver,
  }, item.readyAt ?? Date.now());
}

/** One upload for a file several workflows in a batch are missing. */
export function answerMissingFile(batchId: string, code: string, fileNames: string[]): void {
  const b = batches[batchId];
  if (!b) return;
  const label = fileNames.length > 1 ? `${fileNames.length} files · ${fileNames[0]} (uploaded)` : `${fileNames[0] ?? `${code.toLowerCase()}_upload.xlsx`} (uploaded)`;
  batches = {
    ...batches,
    [batchId]: {
      ...b,
      items: b.items.map(i => {
        if (i.status !== 'needs-input' || !i.files.some(f => f.code === code && !f.source)) return i;
        const files = i.files.map(f => (f.code === code && !f.source ? { ...f, source: label } : f));
        return { ...i, files, status: 'queued' as const, question: undefined, answer: undefined, assumptions: assumptionsFor(files, i.cadence), updatedAt: Date.now() };
      }),
    },
  };
  persist();
  ensureBatchRunning(batchId);
}

/** Next item in the batch still waiting on the reviewer, after `sessionId`. */
export function nextPendingSession(sessionId: string): string | undefined {
  const hit = findSession(sessionId);
  if (!hit) return undefined;
  const pending = hit.batch.items.filter(i => i.sessionId !== sessionId && (i.status === 'ready' || (i.status === 'needs-input' && !i.answer?.startsWith('Leave'))));
  return pending[0]?.sessionId;
}

/** Hours/month an item returns once live (est. or timed). */
export const itemHours = (i: BatchItem) => valueOfKey(i.stdKey)?.hoursPerMonth ?? COMPLEXITY_HOURS.mid;

/** URL that opens a workflow's review session in a new tab. */
export const sessionHref = (sessionId: string) => `${window.location.pathname}?view=chat&session=${sessionId}`;

/** A change asked for in a review session — Ira re-runs with it. */
export function reviseSession(sessionId: string, change: string): number | undefined {
  const hit = findSession(sessionId);
  if (!hit || hit.item.exceptions == null) return undefined;
  const exceptions = Math.max(0, hit.item.exceptions - 1 - Math.round(hash01(change) * 4));
  updateItem(hit.batch.id, hit.item.id, {
    exceptions,
    assumptions: [...hit.item.assumptions, `Your change: ${change}`],
    status: hit.item.status === 'approved' ? 'ready' : hit.item.status,
  });
  return exceptions;
}
