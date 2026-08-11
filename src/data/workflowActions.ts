// ─── Universal insight → workflow actions — the data layer ──────────────────
//
// Every insight card carries three always-on actions beside its AI-generated
// recommendations: drill the insight down in chat, change the source
// workflow's run frequency, and edit the workflow itself. The AI recs are
// audit judgments and vary per finding; these three are PLATFORM VERBS on the
// insight and never vary — so they live in their own row, backed by this
// module, not mixed into the recommendation grid.
//
// Three concerns, all data-only (no JSX):
//   1. Resolution   — which workflow an insight traces to (insights are built
//                     FROM workflow output, so nearly all resolve).
//   2. Frequency    — a localStorage-backed cadence store (shared across tabs,
//                     so the drawer and the editor read the same value), plus
//                     the deterministic suggestion an escalating finding earns.
//   3. Handoffs     — the drill-down chat run, and the insight → workflow-editor
//                     context stash (same localStorage pattern as actionRun.ts:
//                     the payload won't fit in a URL and a new tab boots fresh).

import { useSyncExternalStore } from 'react';
import { WORKFLOWS } from './mockData';
import { CONTROL_LIBRARY } from './controlLibrary';
import { buildActionRun, stashActionRun, actionRunHref, type ActionRun } from './actionRun';
import type { LayeredInsight } from './layeredInsights';

// ─── 1 · Which workflow does this insight trace to? ─────────────────────────

export interface WorkflowRef {
  id: string;
  name: string;
}

/** The flagship MCKESSON story + risk/engagement rollups all trace to the
 *  chargeback pricing workflow (wf-011); the spanned sibling controls map to
 *  the real monitors that exist for them. Subject-id keyed so resolution stays
 *  deterministic — no model call, same ethos as buildWorkflowInsight. */
const SUBJECT_WORKFLOW: Record<string, string> = {
  'C-CHARGEBACK-PRICING': 'wf-011',
  'R-PRICING': 'wf-011',
  'E-PRICING': 'wf-011',
  'C-VENDOR-MASTER': 'wf-002',
  'C-CONTRACT-COMPLIANCE': 'wf-006',
};

const wfById = (id: string): WorkflowRef | null => {
  const wf = WORKFLOWS.find(w => w.id === id);
  return wf ? { id: wf.id, name: wf.name } : null;
};

/** Resolve the ONE workflow an insight's actions bind to. Order: the subject
 *  IS a workflow → the subject control's linked workflow → the flagship
 *  dictionary → an evidence row naming a known workflow. Null only for
 *  insights that genuinely have no runnable source — the UI then says so
 *  honestly instead of hiding the actions. */
export function resolveWorkflowForInsight(
  insight: Pick<LayeredInsight, 'subjectId' | 'subjectLabel' | 'evidence'>,
): WorkflowRef | null {
  const direct = wfById(insight.subjectId);
  if (direct) return direct;

  const ctrl = CONTROL_LIBRARY.find(c => c.controlId === insight.subjectId);
  if (ctrl?.linkedWorkflowIds?.[0]) {
    const linked = wfById(ctrl.linkedWorkflowIds[0]);
    if (linked) return linked;
  }

  const mapped = SUBJECT_WORKFLOW[insight.subjectId];
  if (mapped) {
    const wf = wfById(mapped);
    if (wf) return wf;
  }

  // Evidence rows quote run labels like "Chargeback Pricing Validation — Jul
  // 2026" — match any known workflow name inside them.
  for (const e of insight.evidence ?? []) {
    const hay = `${e.ref} ${e.label}`;
    const hit = WORKFLOWS.find(w => hay.includes(w.name));
    if (hit) return { id: hit.id, name: hit.name };
  }
  // Last resort: the subject label itself names the workflow (workflow-output
  // cards title themselves after the workflow they compare).
  const byLabel = WORKFLOWS.find(w => insight.subjectLabel.includes(w.name) || w.name.includes(insight.subjectLabel));
  return byLabel ? { id: byLabel.id, name: byLabel.name } : null;
}

// ─── 2 · Run frequency — store, meta, suggestion, preview ───────────────────

export type RunFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export const FREQUENCY_META: Record<RunFrequency, { label: string; short: string; windowDays: number; windowWord: string }> = {
  daily:    { label: 'Daily',         short: 'Daily',     windowDays: 1,  windowWord: 'a day' },
  weekly:   { label: 'Weekly',        short: 'Weekly',    windowDays: 7,  windowWord: 'a week' },
  biweekly: { label: 'Every 2 weeks', short: 'Bi-weekly', windowDays: 14, windowWord: 'two weeks' },
  monthly:  { label: 'Monthly',       short: 'Monthly',   windowDays: 30, windowWord: 'a month' },
};

export const FREQUENCY_ORDER: RunFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly'];

/** Resting cadence per workflow. The chargeback workflow runs monthly — its
 *  evidence rows are the Jun and Jul 2026 runs — which is exactly why an
 *  escalating feed break argues for a faster look. */
const DEFAULT_FREQUENCY: Record<string, RunFrequency> = {
  'wf-011': 'monthly',
  'wf-002': 'daily',
  'wf-005': 'daily',
  'wf-006': 'weekly',
  'wf-009': 'daily',
};

const FREQ_STORE_KEY = 'irame.workflowFrequencies';

function loadFrequencies(): Record<string, RunFrequency> {
  try {
    const raw = localStorage.getItem(FREQ_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

let freqCache: Record<string, RunFrequency> = loadFrequencies();
const freqListeners = new Set<() => void>();

function persistFrequencies() {
  try {
    localStorage.setItem(FREQ_STORE_KEY, JSON.stringify(freqCache));
  } catch {
    /* storage unavailable — keep the in-memory copy */
  }
}

function subscribeFrequencies(fn: () => void): () => void {
  freqListeners.add(fn);
  return () => freqListeners.delete(fn);
}

export function getWorkflowFrequency(workflowId: string): RunFrequency {
  return freqCache[workflowId] ?? DEFAULT_FREQUENCY[workflowId] ?? 'weekly';
}

export function setWorkflowFrequency(workflowId: string, freq: RunFrequency): void {
  freqCache = { ...freqCache, [workflowId]: freq };
  persistFrequencies();
  freqListeners.forEach(fn => fn());
}

/** Reactive read for components — re-renders when any surface changes it. */
export function useWorkflowFrequency(workflowId: string): RunFrequency {
  return useSyncExternalStore(
    subscribeFrequencies,
    () => getWorkflowFrequency(workflowId),
    () => getWorkflowFrequency(workflowId),
  );
}

export interface FrequencySuggestion {
  freq: RunFrequency;
  reason: string;
}

/** The deterministic cadence read of an insight — derived from severity,
 *  freshness and verdict, never a model call. An escalating high-severity
 *  finding argues one step faster (shorter exposure window); a low-severity
 *  signed pass on a fast cadence argues one step slower (same assurance,
 *  lower cost). Anything in between: no suggestion — silence is honest. */
export function suggestFrequency(
  insight: Pick<LayeredInsight, 'severity' | 'freshness' | 'freshnessNote' | 'verdict'>,
  current: RunFrequency,
): FrequencySuggestion | null {
  const idx = FREQUENCY_ORDER.indexOf(current);
  const worsening = insight.severity === 'high' &&
    (insight.freshness === 'escalated' || insight.freshness === 'recurring' || insight.verdict.tone === 'negative');

  if (worsening && idx > 0) {
    // An ESCALATED finding — actively growing between runs — argues the strong
    // move (two steps, e.g. monthly → weekly); recurring-but-flat argues one.
    const step = insight.freshness === 'escalated' ? 2 : 1;
    const faster = FREQUENCY_ORDER[Math.max(0, idx - step)];
    const why = insight.freshness === 'escalated'
      ? `This finding escalated between ${FREQUENCY_META[current].label.toLowerCase()} runs${insight.freshnessNote ? ` (${insight.freshnessNote})` : ''}`
      : insight.freshness === 'recurring'
        ? `This finding has recurred across ${FREQUENCY_META[current].label.toLowerCase()} runs without clearing`
        : `Severity is high on the current ${FREQUENCY_META[current].label.toLowerCase()} cadence`;
    return {
      freq: faster,
      reason: `${why} — ${FREQUENCY_META[faster].label.toLowerCase()} runs catch a re-break within ${FREQUENCY_META[faster].windowWord} instead of ${FREQUENCY_META[current].windowWord}.`,
    };
  }

  if (insight.severity === 'low' && insight.verdict.tone === 'positive' && idx < FREQUENCY_ORDER.length - 1 && idx <= 1) {
    const slower = FREQUENCY_ORDER[idx + 1];
    return {
      freq: slower,
      reason: `This control is holding steady — ${FREQUENCY_META[slower].label.toLowerCase()} runs keep the assurance current at lower cost.`,
    };
  }

  return null;
}

// Quarter close for the prototype's era (engagement runs against Q3 FY26).
const QUARTER_CLOSE = new Date('2026-09-30T00:00:00');
const QUARTER_CLOSE_LABEL = 'Sep 30';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtDay(d: Date): string {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export interface CadencePreview {
  /** "Tomorrow, Aug 11 · 06:00" — when the next run lands on this cadence. */
  nextRun: string;
  /** Runs left before quarter close on this cadence. */
  runsBeforeClose: number;
  quarterCloseLabel: string;
}

/** What a cadence buys, concretely — shown before the user commits. */
export function previewCadence(freq: RunFrequency, now: Date = new Date()): CadencePreview {
  const daysLeft = Math.max(0, Math.floor((QUARTER_CLOSE.getTime() - now.getTime()) / DAY_MS));
  let next: Date;
  if (freq === 'daily') {
    next = new Date(now.getTime() + DAY_MS);
  } else if (freq === 'monthly') {
    next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else {
    // Weekly cadences land on Monday 06:00 — next Monday (or the one after for
    // bi-weekly).
    const toMonday = ((8 - now.getDay()) % 7) || 7;
    next = new Date(now.getTime() + (toMonday + (freq === 'biweekly' ? 7 : 0)) * DAY_MS);
  }
  const nextLabel = freq === 'daily' ? `Tomorrow, ${MONTHS[next.getMonth()]} ${next.getDate()}` : fmtDay(next);
  return {
    nextRun: `${nextLabel} · 06:00`,
    runsBeforeClose: Math.max(1, Math.floor(daysLeft / FREQUENCY_META[freq].windowDays)),
    quarterCloseLabel: QUARTER_CLOSE_LABEL,
  };
}

// ─── 3a · Drill the insight down in chat ────────────────────────────────────
// Not a recommendation run — an interrogation. The full card (finding, cause,
// stakes, every evidence row) travels to a fresh Ask IRA tab which sends it on
// arrival, so the thread opens already holding what the reader was looking at.

export function buildDrillDownRun(insight: LayeredInsight): ActionRun {
  return buildActionRun({
    rec: {
      id: `${insight.id}-drilldown`,
      category: 'root-cause',
      priority: 'do-now',
      title: 'Walk me through this insight step by step.',
      rationale: 'Show what each evidence row contributes, how solid the likely cause is, what would confirm or refute it, and which check to run first.',
      guardrail: 'Conclusions stay mine — lay out the reasoning, not a verdict.',
    },
    insight,
  });
}

export function drillDownInChat(insight: LayeredInsight): void {
  const run = buildDrillDownRun(insight);
  if (!stashActionRun(run)) {
    // Storage unavailable — fall back to a pre-filled composer.
    const prompt = `Walk me through the insight “${insight.takeaway}” — evidence, likely cause, and what to check first.`;
    window.open(`?view=chat&prompt=${encodeURIComponent(prompt)}`, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    window.open(actionRunHref(run), '_blank', 'noopener,noreferrer');
  } catch {
    /* popup blocked */
  }
}

// ─── 3b · Insight → workflow-editor handoff ─────────────────────────────────
// "Edit workflow" leaves the reading surface, so it opens a NEW TAB (the house
// pattern: the drawer stays put) landing directly in the edit-in-chat journey
// with the insight's context carried along — banner, seeded chat recap and the
// suggested change, so nothing needs restating in the editor.

export interface WorkflowEditContext {
  id: string;
  createdAt: number;
  workflowId: string;
  workflowName: string;
  insightId: string;
  subjectLabel: string;
  takeaway: string;
  cause?: string;
  suggestedChange: string;
}

/** The one change this insight argues for inside the workflow — prefer the
 *  card's own preventive/structural action; fall back to guarding the likely
 *  cause at intake. Deterministic, quoted straight from the insight. */
export function suggestedWorkflowChange(insight: LayeredInsight): string {
  const pool = [
    ...(insight.recommendations ?? []).filter(r => r.intent === 'edit' || r.intent === 'create').map(r => r.title),
    ...(insight.recommendations ?? []).map(r => r.title),
    ...insight.recommendedActions,
  ];
  const structural = pool.find(t => /\b(add|block|preventive|edit|validate|guard|check)\b/i.test(t));
  if (structural) return structural;
  return `Add a validation step so “${insight.likelyCause.label.replace(/\.$/, '')}” is caught at intake instead of at review.`;
}

export const WORKFLOW_EDIT_PARAM = 'wfedit';
const EDIT_STORE_KEY = 'irame.workflowEditContexts';
const EDIT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function readEditStore(): Record<string, WorkflowEditContext> {
  try {
    const raw = localStorage.getItem(EDIT_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function stashWorkflowEdit(ctx: WorkflowEditContext): boolean {
  try {
    const store = readEditStore();
    const fresh: Record<string, WorkflowEditContext> = { [ctx.id]: ctx };
    for (const [id, c] of Object.entries(store)) {
      if (ctx.createdAt - c.createdAt < EDIT_MAX_AGE_MS) fresh[id] = c;
    }
    localStorage.setItem(EDIT_STORE_KEY, JSON.stringify(fresh));
    return true;
  } catch {
    return false;
  }
}

export function buildWorkflowEditContext(insight: LayeredInsight, wf: WorkflowRef): WorkflowEditContext {
  return {
    id: `wfedit-${insight.id}-${Date.now().toString(36)}`,
    createdAt: Date.now(),
    workflowId: wf.id,
    workflowName: wf.name,
    insightId: insight.id,
    subjectLabel: insight.subjectLabel,
    takeaway: insight.takeaway,
    cause: `${insight.likelyCause.label} ${insight.likelyCause.detail}`,
    suggestedChange: suggestedWorkflowChange(insight),
  };
}

export function openWorkflowEditor(insight: LayeredInsight, wf: WorkflowRef): void {
  const ctx = buildWorkflowEditContext(insight, wf);
  const params = new URLSearchParams({ view: 'workflow-edit-in-chat', workflowId: wf.id });
  if (stashWorkflowEdit(ctx)) params.set(WORKFLOW_EDIT_PARAM, ctx.id);
  try {
    window.open(`${window.location.origin}${window.location.pathname}?${params.toString()}`, '_blank', 'noopener,noreferrer');
  } catch {
    /* popup blocked */
  }
}

// Resolved once per tab — `?wfedit=<id>` is a boot-time fact, same contract as
// getActiveActionRun.
let resolvedEdit: WorkflowEditContext | null | undefined;

export function getActiveWorkflowEdit(): WorkflowEditContext | null {
  if (resolvedEdit !== undefined) return resolvedEdit;
  resolvedEdit = null;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const id = params.get(WORKFLOW_EDIT_PARAM);
    if (id && params.get('view') === 'workflow-edit-in-chat') {
      resolvedEdit = readEditStore()[id] ?? null;
    }
  }
  return resolvedEdit;
}
