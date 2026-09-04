// ─── A recommended action, RUN ──────────────────────────────────────────────
//
// A recommended action used to hand its TITLE to a fresh chat composer and stop
// there: the auditor still had to press send, and the only thing Ira received
// was the imperative plus a "(regarding X)" parenthetical. That made an action
// behave like a follow-up suggestion — the reader did the work of restating
// what the insight already knew.
//
// An action now RUNS. One click composes the COMPLETE prompt — the action, why
// it was raised, the finding and cause it rests on, what is at stake, the
// guardrail that keeps the judgment human, and every evidence row the insight
// carries — opens a chat tab, sends it, and the analysis plan that builds in
// the thread is derived from that same payload. So the plan names this action's
// own goal, its anchor and its evidence rather than a generic query shape, and
// the result underneath it is the action's rows, not a stock answer.
//
// Data only — no JSX, no DOM beyond the handoff store. The payload rides in
// localStorage (a new tab boots its own React app, and this much context will
// not fit in a URL), keyed by an id carried on `?action=<id>`. Reading does not
// consume the entry, so a reload re-runs the same action instead of landing on
// an empty chat.

import type { PlanAssumption, PlanCardSource, PlanCardStep } from '../components/shared/PlanCards';
import type { PlanOutputItem } from '../components/shared/PlanFlowDiagram';
import { displayConfidencePct } from './insightMemory';
import {
  LAYER_META, REC_CATEGORY_META, REC_INTENT_META, REC_PRIORITY_META,
  type AuditRecommendation, type LayeredInsight, type VerdictTone,
} from './layeredInsights';

// ─── The payload ────────────────────────────────────────────────────────────

export interface ActionRunEvidenceRow {
  ref: string;
  label: string;
  detail: string;
  tone?: VerdictTone;
}

/** Everything the run knows about the finding the action was raised against.
 *  Absent when the surface only had the recommendation in hand (the grouped
 *  recommendations panel / RACM popover carry recs across subjects, not the
 *  parent card) — the prompt then states the action and its anchor honestly
 *  rather than inventing a finding to sit under it. */
export interface ActionRunFinding {
  takeaway: string;
  verdict: string;
  severityLabel: string;
  cause?: string;
  atStake?: string;
  confidencePct?: number;
  runsAnalysed?: number;
  detectedOn?: string;
  scopeNote?: string;
  observations: string[];
}

export interface ActionRun {
  id: string;
  createdAt: number;
  /** The complete prompt — exactly what lands in the thread as the user turn. */
  prompt: string;
  /** The action in one line — the plan's goal and the answer's heading. */
  goal: string;
  /** Chip rendered above the user turn, naming the context that travelled. */
  contextChip: string;
  action: {
    id: string;
    title: string;
    rationale?: string;
    basis?: string;
    guardrail?: string;
    priorityLabel: string;
    categoryLabel: string;
    intentLabel?: string;
    /** Where the action lands, when it names one entity (Rule 2). */
    targetLabel?: string;
  };
  subject: {
    id?: string;
    label: string;
    sub?: string;
    /** "this control" / "this risk" / … — the anchor's altitude, in words. */
    scopeWord: string;
  };
  finding?: ActionRunFinding;
  evidence: ActionRunEvidenceRow[];
}

export interface ActionRunInput {
  rec: AuditRecommendation;
  /** The insight the action came from, when the surface holds the whole card. */
  insight?: LayeredInsight;
  /** Anchor fallback for surfaces that group recs across subjects. */
  subjectLabel?: string;
  subjectSub?: string;
}

const SEV_LABEL: Record<LayeredInsight['severity'], string> = { high: 'High', med: 'Medium', low: 'Low' };

/** Evidence and observations are quoted in full inside the prompt; these caps
 *  exist so a 40-row insight doesn't produce an unreadable turn. Anything
 *  dropped is COUNTED in the prompt rather than silently trimmed. */
const MAX_PROMPT_EVIDENCE = 10;
const MAX_PROMPT_OBSERVATIONS = 3;

const stripPeriod = (s: string) => s.replace(/\s*[.·]\s*$/, '');
const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ─── Composing the prompt ───────────────────────────────────────────────────
// The imperative leads (it is what the auditor clicked and what they will
// recognise in the thread), then the context that travelled with it, then the
// evidence itself, then the instruction that makes this a run rather than a
// question. Written as plain lines — the user turn renders pre-wrapped text.

function composePrompt(run: Omit<ActionRun, 'prompt' | 'id' | 'createdAt'>): string {
  const { action, subject, finding, evidence } = run;
  const lines: string[] = [action.title, ''];
  lines.push('Run this now — everything it rests on is below, so nothing needs restating.');
  lines.push('');

  lines.push('WHAT THIS RESTS ON');
  lines.push(`• Anchored at — ${subject.label}${subject.id ? ` (${subject.id})` : ''}${subject.sub ? ` · ${subject.sub}` : ''}`);
  if (finding) {
    lines.push(`• Finding — ${finding.takeaway}`);
    const status = [
      finding.verdict,
      `severity ${finding.severityLabel}`,
      finding.confidencePct != null ? `confidence ${finding.confidencePct}%` : null,
      finding.runsAnalysed != null ? plural(finding.runsAnalysed, 'run') + ' analysed' : null,
      finding.detectedOn ? `detected ${finding.detectedOn}` : null,
    ].filter(Boolean).join(' · ');
    lines.push(`• Status — ${status}`);
    if (finding.cause) lines.push(`• Likely cause, unconfirmed — ${finding.cause}`);
    if (finding.atStake) lines.push(`• At stake — ${finding.atStake}`);
    for (const o of finding.observations.slice(0, MAX_PROMPT_OBSERVATIONS)) {
      lines.push(`• Observed — ${o}`);
    }
  }
  lines.push(`• Priority — ${action.priorityLabel} · ${action.categoryLabel}`);
  if (action.targetLabel) lines.push(`• Lands on — ${action.targetLabel}`);
  if (action.rationale) lines.push(`• Why this action — ${action.rationale}`);
  if (action.basis) lines.push(`• Methodology basis — ${action.basis}`);
  if (action.guardrail) lines.push(`• Stays my call — ${action.guardrail}`);

  if (evidence.length > 0) {
    lines.push('');
    lines.push(`EVIDENCE CARRIED IN — ${plural(evidence.length, 'row')}`);
    evidence.slice(0, MAX_PROMPT_EVIDENCE).forEach((e, i) => {
      lines.push(`${i + 1}. ${e.ref} — ${e.label} · ${e.detail}`);
    });
    if (evidence.length > MAX_PROMPT_EVIDENCE) {
      lines.push(`…and ${evidence.length - MAX_PROMPT_EVIDENCE} more rows from the same set.`);
    }
  }

  if (finding?.scopeNote) {
    lines.push('');
    lines.push(`SCOPE — ${finding.scopeNote}`);
  }

  lines.push('');
  lines.push('Start from exactly this set — do not re-scope it or ask me to restate it. Show me the plan you run, then the result.');
  return lines.join('\n');
}

export function buildActionRun({ rec, insight, subjectLabel, subjectSub }: ActionRunInput): ActionRun {
  const label = insight?.subjectLabel ?? subjectLabel ?? 'this subject';
  const evidence: ActionRunEvidenceRow[] = (insight?.evidence ?? []).map(e => ({
    ref: e.ref, label: e.label, detail: e.detail, tone: e.tone,
  }));

  const finding: ActionRunFinding | undefined = insight && {
    takeaway: insight.takeaway,
    verdict: insight.verdict.label,
    severityLabel: insight.severityLabel ?? SEV_LABEL[insight.severity],
    cause: insight.likelyCause ? `${insight.likelyCause.label} ${insight.likelyCause.detail}` : undefined,
    atStake: insight.atStake,
    confidencePct: displayConfidencePct(insight),
    runsAnalysed: insight.runsAnalysed,
    detectedOn: insight.detectedOn,
    scopeNote: insight.evidenceNote,
    observations: insight.observations ?? [],
  };

  const core: Omit<ActionRun, 'prompt' | 'id' | 'createdAt'> = {
    goal: stripPeriod(rec.title),
    contextChip: `${label}${evidence.length ? ` · ${plural(evidence.length, 'evidence row')}` : ''}`,
    action: {
      id: rec.id,
      title: rec.title,
      rationale: rec.rationale,
      basis: rec.basis,
      guardrail: rec.guardrail,
      priorityLabel: REC_PRIORITY_META[rec.priority].label,
      categoryLabel: REC_CATEGORY_META[rec.category].label,
      intentLabel: rec.intent ? REC_INTENT_META[rec.intent].label : undefined,
      targetLabel: rec.target?.label,
    },
    subject: {
      id: insight?.subjectId,
      label,
      sub: subjectSub,
      scopeWord: insight ? LAYER_META[insight.layer].label : 'this subject',
    },
    finding,
    evidence,
  };

  return {
    ...core,
    id: `action-${rec.id}-${Date.now().toString(36)}`,
    createdAt: Date.now(),
    prompt: composePrompt(core),
  };
}

// ─── The analysis plan, derived ─────────────────────────────────────────────
// The plan is the visible proof that the whole prompt was ingested: step 1
// names the action's goal, step 2 the anchor and the finding it carries, step 3
// the evidence rows by name, and the output node lists those same rows. Nothing
// here is a fixture — change the insight and every line moves with it.

export interface ActionRunPlan {
  steps: PlanCardStep[];
  outputLabel: string;
  outputItems: PlanOutputItem[];
  outputNote: string;
}

const levelFor = (tone?: VerdictTone): PlanOutputItem['level'] => (tone === 'negative' ? 'High' : 'Medium');

function evidenceSource(run: ActionRun): PlanCardSource {
  const refs = [...new Set(run.evidence.map(e => e.ref))];
  return {
    id: 'insight-evidence',
    name: `${run.subject.label} — evidence`,
    type: 'insight',
    columns: refs.slice(0, 8),
  };
}

export function buildActionPlan(run: ActionRun): ActionRunPlan {
  const n = run.evidence.length;
  const src = evidenceSource(run);
  const refCount = new Set(run.evidence.map(e => e.ref)).size;
  const highCount = run.evidence.filter(e => e.tone === 'negative').length;

  const steps: PlanCardStep[] = [
    {
      id: 'intent', name: 'Understand the action', type: 'extract',
      description: 'Read the action you sent and worked out exactly what it has to achieve.',
      operation: `Goal: ${run.goal}`,
      output: `A clear goal to work toward — ${lowerFirst(run.goal)}.`,
    },
    {
      id: 'context', name: 'Carry the finding in', type: 'extract',
      description: run.finding
        ? `Took the finding, its likely cause and its scope from ${run.subject.label}, so this run starts where the insight left off instead of asking you again.`
        : `Took the anchor from ${run.subject.label} so the work stays scoped to it.`,
      operation: run.finding
        ? `${run.subject.id ?? run.subject.label} · ${run.finding.verdict} · severity ${run.finding.severityLabel}`
        : `${run.subject.id ?? run.subject.label} · ${run.action.priorityLabel}`,
      output: run.finding
        ? 'The finding, the cause behind it and the caveat on how far it can be pushed.'
        : 'The anchor this action belongs to.',
    },
    {
      id: 'evidence', name: 'Load the evidence behind it', type: 'extract',
      description: n > 0
        ? `Opened the ${plural(n, 'row')} the insight rests on, across ${plural(refCount, 'source')} — the same rows the card shows under Evidence.`
        : 'No evidence rows travelled with this action, so the run starts from the anchor alone.',
      sources: n > 0 ? [src] : undefined,
      operation: n > 0 ? `${plural(n, 'evidence row')} · ${plural(refCount, 'source')}` : 'No rows carried',
      rowsOut: n > 0 ? n : undefined,
      output: n > 0
        ? `The ${plural(n, 'row')} this action has to act on, opened and ready to check.`
        : 'An empty starting set — the run has to widen before it can act.',
    },
    {
      id: 'execute', name: 'Run the action’s checks', type: 'validate',
      description: `Worked through each row against what "${stripPeriod(run.action.title)}" requires${run.action.basis ? `, following ${run.action.basis}` : ''}.`,
      sources: n > 0 ? [src] : undefined,
      // No row funnel here: the action's starting set IS its finishing set —
      // an N → N funnel would draw a filter that never filtered.
      operation: `${run.action.categoryLabel} · ${run.action.priorityLabel}${run.action.targetLabel ? ` · lands on ${run.action.targetLabel}` : ''}`,
      output: n > 0
        ? `Every row checked against the action — ${highCount > 0 ? `${highCount} of them the ones that can't wait` : 'none of them cleared'}.`
        : 'The action, checked against what the anchor holds.',
    },
    {
      id: 'format', name: 'Prepare what to do', type: 'summarize',
      description: run.action.guardrail
        ? 'Turned it into a worklist you can act on, and kept the judgment call separate — that one stays yours.'
        : 'Turned it into a worklist you can act on, in the order the exposure sits.',
      operation: run.action.guardrail ? `Your call: ${stripPeriod(run.action.guardrail)}` : `Ordered by ${run.finding ? 'severity' : 'priority'}`,
      output: `A ready-to-action list${run.action.guardrail ? ', with the decision that stays yours named on it' : ''}.`,
    },
  ];

  return {
    steps,
    outputLabel: n > 0 ? 'Rows to action' : 'What to do',
    outputItems: run.evidence.map((e, i) => ({
      id: `${run.id}-out-${i}`,
      title: `${e.label} — ${e.detail}`,
      control: e.ref,
      level: levelFor(e.tone),
    })),
    outputNote: [
      `Carried from the insight anchored at ${run.subject.label}`,
      run.finding?.scopeNote,
    ].filter(Boolean).join(' · '),
  };
}

/** The Plan tab's assumption list — what this run took as given because the
 *  action brought it, in place of the generic query assumptions. Every line is
 *  something the auditor would otherwise have been asked. */
export function buildActionAssumptions(run: ActionRun): PlanAssumption[] {
  const rows: PlanAssumption[] = [
    { key: 'Action', value: run.action.title },
    { key: 'Anchored at', value: `${run.subject.label}${run.subject.id ? ` (${run.subject.id})` : ''}` },
    { key: 'Starting set', value: run.evidence.length > 0 ? `${plural(run.evidence.length, 'evidence row')} from the insight` : 'The anchor only — no rows travelled' },
    { key: 'Priority', value: `${run.action.priorityLabel} · ${run.action.categoryLabel}` },
  ];
  if (run.finding) {
    rows.push({ key: 'Severity', value: `${run.finding.severityLabel}${run.finding.confidencePct != null ? ` · confidence ${run.finding.confidencePct}%` : ''}` });
    if (run.finding.scopeNote) rows.push({ key: 'Scope', value: run.finding.scopeNote });
  }
  if (run.action.guardrail) rows.push({ key: 'Your call', value: run.action.guardrail });
  return rows;
}

// ─── The result, derived ────────────────────────────────────────────────────

export interface ActionRunResult {
  kpis: { label: string; value: string; color: string }[];
  charts: { id: string; label: string; data: { bucket: string; count: number; tone: string }[] }[];
  table: { title: string; columns: string[]; rows: string[][]; totalRows: number; caption: string };
  /** Level per table row, in row order — drives the table's Risk column. */
  levels: PlanOutputItem['level'][];
  plan: ActionRunPlan;
}

const BAR_TONES = ['bg-ink-800', 'bg-ink-800/80', 'bg-ink-800/65', 'bg-ink-800/50', 'bg-ink-800/40'];

export function buildActionResult(run: ActionRun): ActionRunResult {
  const n = run.evidence.length;
  const high = run.evidence.filter(e => e.tone === 'negative').length;

  const bySource = [...new Set(run.evidence.map(e => e.ref))]
    .map(ref => ({ ref, count: run.evidence.filter(e => e.ref === ref).length }))
    .sort((a, b) => b.count - a.count);

  const kpis = [
    { label: 'Rows to action', value: String(n), color: 'text-ink-900' },
    { label: 'Can’t wait', value: String(high), color: 'text-ink-900' },
    { label: 'Priority', value: run.action.priorityLabel, color: 'text-ink-900' },
    ...(run.finding ? [{ label: 'Severity', value: run.finding.severityLabel, color: 'text-ink-900' }] : []),
    ...(run.finding?.confidencePct != null ? [{ label: 'Confidence', value: `${run.finding.confidencePct}%`, color: 'text-ink-900' }] : []),
    ...(run.finding?.runsAnalysed != null ? [{ label: 'Runs analysed', value: String(run.finding.runsAnalysed), color: 'text-ink-900' }] : []),
    { label: 'Sources', value: String(bySource.length), color: 'text-ink-900' },
  ];

  return {
    kpis,
    // One chart only when there is something to compare — a single bar is a
    // number wearing a costume.
    charts: bySource.length > 1 ? [{
      id: 'evidence-source',
      label: 'Rows by source',
      data: bySource.slice(0, 5).map((s, i) => ({ bucket: s.ref, count: s.count, tone: BAR_TONES[i] ?? BAR_TONES[4] })),
    }] : [],
    table: {
      title: 'Rows to action',
      columns: ['Source', 'Item', 'What it shows'],
      rows: run.evidence.map(e => [e.ref, e.label, e.detail]),
      totalRows: n,
      caption: `Risk column · carried from the insight’s own rating${run.finding?.scopeNote ? ` · ${run.finding.scopeNote}` : ''}`,
    },
    levels: run.evidence.map(e => levelFor(e.tone)),
    plan: buildActionPlan(run),
  };
}

/** The answer prose. Says what was run, against what, and what is left to the
 *  auditor — the guardrail is quoted rather than paraphrased, because it is the
 *  one line the run must not appear to have decided for them. */
export function buildActionProse(run: ActionRun): string {
  const n = run.evidence.length;
  const high = run.evidence.filter(e => e.tone === 'negative').length;
  const lines: string[] = [`## ${stripPeriod(run.action.title)}`, ''];

  lines.push(
    n > 0
      ? `Ran this against the **${plural(n, 'row')}** the insight anchored at **${run.subject.label}** rests on. The finding, its cause and its scope came in with the action, so nothing was re-asked — ${high > 0 ? `**${high}** of the rows are the ones that can't wait` : 'none of the rows are rated as urgent'}.`
      : `Ran this against **${run.subject.label}**. No evidence rows travelled with the action, so this is the anchor's own position — widen the set before treating it as coverage.`,
  );

  if (run.finding) {
    lines.push('');
    lines.push(`> ${run.finding.takeaway}${run.finding.scopeNote ? ` — ${lowerFirst(run.finding.scopeNote)}` : ''}`);
  }

  if (n > 0) {
    lines.push('');
    lines.push('### What this run is holding');
    for (const e of run.evidence.slice(0, 5)) {
      lines.push(`- **${e.label}** — ${e.detail} _(${e.ref})_`);
    }
    if (n > 5) lines.push(`- …and ${n - 5} more in the table below.`);
  }

  lines.push('');
  lines.push('### What’s left to you');
  if (run.action.guardrail) lines.push(`- **Your call:** ${run.action.guardrail}`);
  if (run.finding?.cause) lines.push(`- Confirm the cause before it is written up — ${lowerFirst(run.finding.cause)}`);
  if (run.finding?.atStake) lines.push(`- ${run.finding.atStake}`);
  lines.push(`- The plan, the assumptions this run took as given, and the sources are in the Workspace on the right.`);

  return lines.join('\n');
}

/** Follow-ups for the action's answer. Depth drills the rows this run holds;
 *  breadth points at what the action deliberately did not touch. */
export function buildActionFollowUps(run: ActionRun): { depth: string[]; breadth: string[] } {
  const n = run.evidence.length;
  return {
    depth: [
      n > 0 ? `Rank these ${n} rows by exposure` : `What would widen this beyond ${run.subject.label}?`,
      'Who owns each of these rows?',
      `Draft the note that records "${stripPeriod(run.action.title)}"`,
    ],
    breadth: [
      `Check the rest of ${run.subject.scopeWord === 'this control' ? 'this process' : 'the engagement'} for the same pattern`,
      run.finding?.detectedOn ? `What changed since ${run.finding.detectedOn}?` : 'What changed since the previous run?',
      'Save this action as a re-runnable workflow',
    ],
  };
}

// ─── New-tab handoff ────────────────────────────────────────────────────────

export const ACTION_RUN_PARAM = 'action';
const STORE_KEY = 'ira.actionRuns';
/** Handoffs are read once, seconds after they are written; anything older is a
 *  tab that was never opened. Swept on write so the store can't grow forever. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

type ActionRunStore = Record<string, ActionRun>;

function readStore(): ActionRunStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as ActionRunStore) : {};
  } catch {
    return {};
  }
}

/** Stash the payload for the tab about to open. Returns false when storage is
 *  unavailable (private mode, quota) so the caller can fall back to the plain
 *  pre-filled composer rather than opening a chat with nothing in it. */
export function stashActionRun(run: ActionRun): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const store = readStore();
    const fresh: ActionRunStore = { [run.id]: run };
    for (const [id, r] of Object.entries(store)) {
      if (run.createdAt - r.createdAt < MAX_AGE_MS) fresh[id] = r;
    }
    window.localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
    return true;
  } catch {
    return false;
  }
}

export function actionRunHref(run: ActionRun): string {
  const params = new URLSearchParams({ view: 'chat', [ACTION_RUN_PARAM]: run.id });
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

// Resolved once per tab: `?action=<id>` is a boot-time fact, so both the chat
// thread and the workspace Plan tab can read it without either owning the other.
let resolved: ActionRun | null | undefined;

export function getActiveActionRun(): ActionRun | null {
  if (resolved !== undefined) return resolved;
  resolved = null;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const id = params.get(ACTION_RUN_PARAM);
    if (id && params.get('view') === 'chat') resolved = readStore()[id] ?? null;
  }
  return resolved;
}
