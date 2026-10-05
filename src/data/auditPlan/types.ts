/**
 * Audit plan — the one shape both AI planning surfaces produce:
 *
 *   • Ask IRA (GRC agent) — a complex prompt split into several checks.
 *   • Audit with AI — a full plan built from connected data, documents and
 *     last reports.
 *
 * engagement → controls → exactly one check per control. A check either
 * reuses a workflow already in the library or is a new one Ira will build.
 * Coverage, impact and the timeline are derived, never typed by hand, so the
 * two surfaces can't drift on what "coverage" means.
 */
import type { EngType, ProcessCode } from '../engagements';
import type { ControlType, Frequency } from '../racm';

export type Rating = 'High' | 'Medium' | 'Low';

/** How a control is evidenced once the engagement runs. */
export type CheckKind =
  /** An existing Workflow Library workflow is linked as-is. */
  | 'reuse'
  /** A new workflow Ira builds (draft until built). */
  | 'new'
  /** Judgement-based — a manual test procedure, no workflow possible. */
  | 'manual';

export interface PlanCheck {
  id: string;
  kind: CheckKind;
  name: string;
  description: string;
  cadence: string;
  /** Set for kind 'reuse' — the Workflow Library id being linked. */
  existingWorkflowId?: string;
  existingWorkflowName?: string;
  /** Impact of adding this check. Only meaningful for 'new'. */
  impact: Rating;
  /** Plain reasons behind the impact rating, shown under the badge. */
  impactReasons: string[];
  /** Data the check reads — used to carry uploads between sequential builds. */
  dataNeeds: string[];
  /** Prompt handed to the in-chat builder when the check is built. */
  buildPrompt: string;
  /** Which sample workflow the builder scaffolds from. */
  sampleId: string;
}

export interface PlanControl {
  id: string;
  /** Catalog key — stable across plans, used for coverage maths. */
  key: string;
  /** A chat plan can mix processes (a P2P engagement with one R2R check). */
  process: ProcessCode;
  controlId: string;
  title: string;
  description: string;
  subProcess: string;
  riskTitle: string;
  riskRating: Rating;
  isKey: boolean;
  frequency: Frequency;
  controlType: ControlType;
  /** Present when a selected last report raised a finding on this control. */
  priorFinding?: string;
  /** Selected sources that ground this control (DBs / docs / reports). */
  groundedIn: string[];
  check: PlanCheck;
  selected: boolean;
}

export interface PlanPhase {
  key: 'planning' | 'data' | 'build' | 'fieldwork' | 'review' | 'reporting';
  label: string;
  /** ISO yyyy-mm-dd. */
  start: string;
  end: string;
  weeks: number;
}

export interface PlanCoverage {
  /** Key controls in the process universe (the catalog for that process). */
  universe: number;
  /** Controls with an automated check before the plan (existing workflows). */
  before: number;
  /** …after the plan's selected checks are in place. */
  after: number;
  beforePct: number;
  afterPct: number;
  /** afterPct − beforePct. */
  liftPts: number;
}

export interface PlanEngagement {
  id: string;
  code: string;
  name: string;
  description: string;
  type: EngType;
  process: ProcessCode;
  framework: string;
  owner: string;
  /** 0–100. */
  confidence: number;
  rationale: string;
  sources: string[];
  controls: PlanControl[];
  phases: PlanPhase[];
  selected: boolean;
  /** Where the checks land: a fresh engagement or an existing one. */
  target: { kind: 'new' } | { kind: 'existing'; engagementId: string; engagementName: string };
  /** Best-matching open engagement, offered as the alternative target. */
  existingMatch?: { engagementId: string; engagementName: string };
}

export interface AuditPlanContext {
  databases: string[];
  documents: string[];
  reports: string[];
  files: string[];
  notes: string;
}

export interface AuditPlan {
  id: string;
  origin: 'chat' | 'audit-with-ai';
  createdAt: string;
  /** Chat origin — the prompt that was split. */
  prompt?: string;
  context?: AuditPlanContext;
  engagements: PlanEngagement[];
}
