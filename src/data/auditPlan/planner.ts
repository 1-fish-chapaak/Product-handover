/**
 * Audit planner (mock). Deterministic stand-in for the model: it decomposes a
 * prompt against the check catalog, or builds a per-domain plan from the
 * context the user attached. Everything downstream — impact, coverage,
 * timeline — is derived here so both surfaces agree.
 */
import { libraryEngagements, type ProcessCode } from '../engagements';
import { ATR_LIBRARY } from '../atrLibrary';
import { CHECK_CATALOG, PROCESS_LONG, catalogFor, type CatalogEntry } from './catalog';
import { isStdBuilt, isStdLive, stdWorkflowName } from './standardLibrary';
import { fmtHours, valueOf } from './score';
import type {
  AuditPlan, AuditPlanContext, PlanCheck, PlanControl, PlanCoverage, PlanEngagement, PlanPhase, Rating,
} from './types';

// ── Prompt decomposition ────────────────────────────────────────────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** First position a keyword occurs in the prompt as a whole word/phrase
 *  (plural-tolerant), or -1. */
function keywordAt(prompt: string, kw: string): number {
  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRe(kw)}(?:s|es)?(?=$|[^a-z0-9])`, 'i');
  const m = re.exec(prompt);
  return m ? m.index : -1;
}

export interface Decomposition {
  /** Catalog entries the prompt asks for, in the order the prompt mentions them. */
  entries: CatalogEntry[];
  processes: ProcessCode[];
  /** Two or more distinct checks — worth splitting. */
  isComplex: boolean;
}

export function decomposePrompt(prompt: string): Decomposition {
  const hits: { entry: CatalogEntry; at: number }[] = [];
  for (const entry of CHECK_CATALOG) {
    const positions = entry.keywords.map(k => keywordAt(prompt, k)).filter(i => i >= 0);
    if (positions.length > 0) hits.push({ entry, at: Math.min(...positions) });
  }
  hits.sort((a, b) => a.at - b.at);
  const entries = hits.map(h => h.entry);
  const processes = Array.from(new Set(entries.map(e => e.process)));
  return { entries, processes, isComplex: entries.length >= 2 };
}

// ── Context grounding ──────────────────────────────────────────────────────

/** Which connected source satisfies a data need. */
const DATA_SOURCE_FOR: Record<string, string> = {
  'AP invoice register': 'SAP ERP: AP Module',
  'Purchase orders': 'SAP ERP: AP Module',
  'Goods receipts': 'SAP ERP: AP Module',
  'Payment register': 'SAP ERP: AP Module',
  'Vendor master': 'Vendor Master Data',
  'Vendor change log': 'Vendor Master Data',
  'Employee master': 'Workday HRIS',
  'HR leavers list': 'Workday HRIS',
  'GL journal lines': 'GL Transaction History',
  'GL trial balance': 'GL Transaction History',
  'Sub-ledger': 'GL Transaction History',
  'User list': 'GL Transaction History',
};

const REPORT_AREA_PROCESS: Record<string, ProcessCode> = {
  'Procure-to-Pay': 'P2P',
  'Order-to-Cash': 'O2C',
  'IT General Controls': 'ITGC',
  'Record-to-Report': 'R2R',
};

function reportAreas(reportIds: string[]): Set<string> {
  return new Set(ATR_LIBRARY.filter(r => reportIds.includes(r.id)).map(r => r.area));
}

const RATING_SCORE: Record<Rating, number> = { High: 3, Medium: 2, Low: 1 };
const scoreToRating = (s: number): Rating => (s >= 3 ? 'High' : s === 2 ? 'Medium' : 'Low');

interface GroundOpts {
  databases?: string[];
  reportIds?: string[];
  /** When false, data gaps aren't judged (chat has no source list). */
  judgeData?: boolean;
}

function buildCheck(entry: CatalogEntry, universe: number, priorFinding: string | undefined, dataGaps: string[]): PlanCheck {
  // A standard workflow already adapted to this client's data is reused too.
  const kind: PlanCheck['kind'] = !entry.automatable ? 'manual' : entry.existingWorkflowId || isStdBuilt(entry.key) ? 'reuse' : 'new';
  const lift = Math.round(100 / Math.max(1, universe));
  let impact: Rating;
  const reasons: string[] = [];
  if (kind === 'new') {
    let score = RATING_SCORE[entry.riskRating];
    reasons.push(`${entry.riskRating}-rated risk with no automated test today`);
    if (priorFinding) { score += 1; reasons.push(`Repeat finding: ${priorFinding}`); }
    if (dataGaps.length > 0) { score -= 1; reasons.push(`Needs ${dataGaps.join(', ')} — not connected yet`); }
    reasons.push(`+${lift} pts ${PROCESS_LONG[entry.process]} coverage · returns ~${fmtHours(valueOf(entry).hoursPerMonth)} a month once live (est.)`);
    impact = scoreToRating(Math.max(1, Math.min(3, score)));
  } else if (kind === 'reuse') {
    impact = entry.riskRating;
    reasons.push('Already automated in the Workflow Library — linked, nothing to build');
  } else {
    impact = entry.riskRating;
    reasons.push('Judgement control — tested by walkthrough, not a workflow');
  }
  return {
    id: `chk-${entry.key}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    name: kind === 'reuse' ? stdWorkflowName(entry) : entry.checkName,
    description: entry.checkDescription,
    cadence: entry.cadence,
    existingWorkflowId: kind === 'reuse' ? entry.existingWorkflowId : undefined,
    existingWorkflowName: kind === 'reuse' ? stdWorkflowName(entry) : undefined,
    impact,
    impactReasons: reasons,
    dataNeeds: entry.dataNeeds,
    buildPrompt: `${entry.checkName}: ${entry.checkDescription}`,
    sampleId: entry.sampleId,
  };
}

function buildControl(entry: CatalogEntry, opts: GroundOpts): PlanControl {
  const areas = reportAreas(opts.reportIds ?? []);
  const priorFinding = entry.priorFindingArea && areas.has(entry.priorFindingArea) ? entry.priorFinding : undefined;
  const dbs = opts.databases ?? [];
  const groundedIn = Array.from(new Set(entry.dataNeeds.map(d => DATA_SOURCE_FOR[d]).filter((s): s is string => !!s && dbs.includes(s))));
  const dataGaps = opts.judgeData && entry.automatable
    ? entry.dataNeeds.filter(d => { const s = DATA_SOURCE_FOR[d]; return s ? !dbs.includes(s) : false; })
    : [];
  const universe = catalogFor(entry.process).length;
  return {
    id: `ctl-${entry.key}-${Math.random().toString(36).slice(2, 7)}`,
    key: entry.key,
    process: entry.process,
    controlId: entry.controlId,
    title: entry.controlTitle,
    description: entry.controlDescription,
    subProcess: entry.subProcess,
    riskTitle: entry.riskTitle,
    riskRating: entry.riskRating,
    isKey: entry.riskRating !== 'Low',
    frequency: entry.frequency,
    controlType: entry.controlType,
    priorFinding,
    groundedIn,
    check: buildCheck(entry, universe, priorFinding, dataGaps),
    selected: true,
  };
}

// ── Coverage ───────────────────────────────────────────────────────────────

/** Automated-test coverage of the key controls in scope, before vs after the
 *  selected checks land. The universe is the catalog for every process the
 *  engagement touches. Before = controls already tested by a library
 *  workflow; after adds every selected new check. Manual controls never
 *  count — that gap is the honest ceiling. */
export function coverageFor(process: ProcessCode, controls: PlanControl[]): PlanCoverage {
  const processes = new Set<ProcessCode>([process, ...controls.map(c => c.process)]);
  const universe = CHECK_CATALOG.filter(e => processes.has(e.process));
  const before = universe.filter(e => e.automatable && (e.existingWorkflowId || isStdLive(e.key))).length;
  const added = new Set(controls.filter(c => c.selected && c.check.kind === 'new').map(c => c.key));
  const after = before + universe.filter(e => added.has(e.key)).length;
  const pct = (n: number) => Math.round((n / Math.max(1, universe.length)) * 100);
  return {
    universe: universe.length,
    before,
    after,
    beforePct: pct(before),
    afterPct: pct(after),
    liftPts: pct(after) - pct(before),
  };
}

/** Portfolio coverage across several engagements (sum of their universes). */
export function portfolioCoverage(engs: PlanEngagement[]): PlanCoverage {
  const covs = engs.filter(e => e.selected).map(e => coverageFor(e.process, e.controls));
  const universe = covs.reduce((s, c) => s + c.universe, 0);
  const before = covs.reduce((s, c) => s + c.before, 0);
  const after = covs.reduce((s, c) => s + c.after, 0);
  const pct = (n: number) => Math.round((n / Math.max(1, universe)) * 100);
  return { universe, before, after, beforePct: pct(before), afterPct: pct(after), liftPts: pct(after) - pct(before) };
}

// ── Timeline ───────────────────────────────────────────────────────────────

const iso = (d: Date) => d.toISOString().slice(0, 10);
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

/** Monday on or after today. */
export function nextMonday(from = new Date()): string {
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + ((8 - dow) % 7 || 7));
  return iso(d);
}

/** Phase plan from the selected controls. Phases run back-to-back in weeks. */
export function buildPhases(start: string, controls: PlanControl[]): PlanPhase[] {
  const sel = controls.filter(c => c.selected);
  const newCount = sel.filter(c => c.check.kind === 'new').length;
  const gaps = sel.some(c => c.check.impactReasons.some(r => r.includes('not connected')));
  const plan: { key: PlanPhase['key']; label: string; weeks: number }[] = [
    { key: 'planning', label: 'Planning & kickoff', weeks: 1 },
    { key: 'data', label: 'Data readiness', weeks: gaps ? 2 : 1 },
    ...(newCount > 0 ? [{ key: 'build' as const, label: `Build ${newCount} new check${newCount === 1 ? '' : 's'}`, weeks: Math.max(1, Math.ceil(newCount / 2)) }] : []),
    { key: 'fieldwork', label: 'Fieldwork & testing', weeks: Math.max(2, Math.ceil(sel.length / 3)) },
    { key: 'review', label: 'Review & sign-off', weeks: 1 },
    { key: 'reporting', label: 'Reporting', weeks: 1 },
  ];
  let cursor = start;
  return plan.map(p => {
    const phase: PlanPhase = { ...p, start: cursor, end: addDays(cursor, p.weeks * 7 - 3) };
    cursor = addDays(cursor, p.weeks * 7);
    return phase;
  });
}

/** Re-derive the phases after selection or start-date edits. */
export function withPhases(eng: PlanEngagement, start?: string): PlanEngagement {
  return { ...eng, phases: buildPhases(start ?? eng.phases[0]?.start ?? nextMonday(), eng.controls) };
}

// ── Engagement matching ───────────────────────────────────────────────────

export function suggestExistingEngagement(process: ProcessCode): PlanEngagement['existingMatch'] {
  const rank: Record<string, number> = { Active: 0, 'In Progress': 1, Planned: 2, Draft: 3, Review: 4 };
  const candidates = libraryEngagements()
    .filter(e => e.process === process && e.status !== 'Closed' && e.type !== 'SOX / ICFR')
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  const hit = candidates[0];
  return hit ? { engagementId: hit.id, engagementName: hit.name } : undefined;
}

function engagementCode(): string {
  return `ENG-AI-${String(Date.now()).slice(-4)}`;
}

function fiscalLabel(): string {
  // Indian FY: Apr–Mar. Oct 2026 sits in FY27.
  const now = new Date();
  const fy = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  return `FY${String(fy).slice(-2)}`;
}

function newEngagement(process: ProcessCode, controls: PlanControl[], extra: Partial<PlanEngagement>, start: string): PlanEngagement {
  const existingMatch = suggestExistingEngagement(process);
  const eng: PlanEngagement = {
    id: `plan-eng-${process}-${Math.random().toString(36).slice(2, 7)}`,
    code: engagementCode(),
    name: `${PROCESS_LONG[process].endsWith('Controls') ? PROCESS_LONG[process] : `${PROCESS_LONG[process]} Controls`} Review — ${fiscalLabel()}`,
    description: '',
    // Internal Audit for every domain: its workspace renders the plan's own
    // controls (baseControlsFor), which the Compliance workspace doesn't.
    type: 'Internal Audit',
    process,
    framework: process === 'ITGC' ? 'ISO 27001 / ITGC' : 'Internal Policy',
    owner: 'You',
    confidence: 85,
    rationale: '',
    sources: [],
    controls,
    phases: [],
    selected: true,
    target: { kind: 'new' },
    existingMatch,
    ...extra,
  };
  return withPhases(eng, start);
}

// ── Plan builders ──────────────────────────────────────────────────────────

/** Chat (GRC agent): one engagement around the checks the prompt asked for,
 *  under the prompt's dominant process. */
export function planFromPrompt(prompt: string, opts: { owner: string; engagementContextName?: string | null }): AuditPlan | null {
  const dec = decomposePrompt(prompt);
  if (!dec.isComplex) return null;
  const counts = new Map<ProcessCode, number>();
  dec.entries.forEach(e => counts.set(e.process, (counts.get(e.process) ?? 0) + 1));
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const controls = dec.entries.map(e => buildControl(e, {}));
  const newCount = controls.filter(c => c.check.kind === 'new').length;
  const reuseCount = controls.filter(c => c.check.kind === 'reuse').length;
  const processNames = dec.processes.map(p => PROCESS_LONG[p]).join(' + ');
  const eng = newEngagement(dominant, controls, {
    owner: opts.owner,
    description: `Continuous testing of ${controls.length} ${processNames} controls, set up from an Ask IRA prompt.`,
    rationale: `Your prompt covers ${controls.length} separate tests. Each maps to its own control, so each gets its own check — ${reuseCount} already exist${reuseCount === 1 ? 's' : ''} in the library, ${newCount} ${newCount === 1 ? 'is' : 'are'} new.`,
    sources: ['Your prompt', 'Control Library', 'Workflow Library'],
    confidence: 88,
  }, nextMonday());

  // Building for a named engagement — land the checks there by default.
  if (opts.engagementContextName) {
    const hit = libraryEngagements().find(e => e.name === opts.engagementContextName);
    if (hit) {
      eng.existingMatch = { engagementId: hit.id, engagementName: hit.name };
      eng.target = { kind: 'existing', engagementId: hit.id, engagementName: hit.name };
    }
  }
  return {
    id: `plan-${Date.now()}`,
    origin: 'chat',
    createdAt: new Date().toISOString(),
    prompt,
    engagements: [eng],
  };
}

/** Audit with AI: one engagement per domain, grounded in the attached context. */
export function planFromContext(ctx: AuditPlanContext, domains: ProcessCode[], opts: { owner: string }): AuditPlan {
  const start = nextMonday();
  const engagements = domains.map((process, i) => {
    const controls = catalogFor(process).map(e => buildControl(e, { databases: ctx.databases, reportIds: ctx.reports, judgeData: true }));
    const existing = controls.filter(c => c.check.kind === 'reuse').length;
    const newOnes = controls.filter(c => c.check.kind === 'new').length;
    const repeats = controls.filter(c => c.priorFinding).length;
    const grounded = Array.from(new Set(controls.flatMap(c => c.groundedIn)));
    const lastReport = ATR_LIBRARY.find(r => ctx.reports.includes(r.id) && REPORT_AREA_PROCESS[r.area] === process);
    const sources = [
      ...grounded,
      ...ctx.documents.slice(0, 2),
      ...(lastReport ? [lastReport.name] : []),
    ];
    const confidence = Math.min(97, 72 + grounded.length * 6 + (repeats > 0 ? 6 : 0) + (ctx.documents.length > 0 ? 4 : 0));
    const rationaleParts = [
      `${controls.length} key ${process} controls; ${existing} already tested by library workflows, ${newOnes} can be automated now.`,
      repeats > 0 ? `${repeats} repeat finding${repeats === 1 ? '' : 's'} from ${lastReport?.name ?? 'the last report'}.` : '',
      grounded.length === 0 ? `No ${process} data source is connected yet — Ira planned from the catalog and your documents.` : '',
    ].filter(Boolean);
    // Stagger engagements two weeks apart so fieldwork doesn't pile up.
    const engStart = addDays(start, i * 14);
    return newEngagement(process, controls, {
      owner: opts.owner,
      description: `${PROCESS_LONG[process]} controls review — ${controls.length} controls, each with a test or check.`,
      rationale: rationaleParts.join(' '),
      sources: sources.length > 0 ? sources : ['Control Library', 'Workflow Library'],
      confidence,
    }, engStart);
  });
  return {
    id: `plan-${Date.now()}`,
    origin: 'audit-with-ai',
    createdAt: new Date().toISOString(),
    context: ctx,
    engagements,
  };
}
