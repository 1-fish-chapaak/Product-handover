/**
 * The seeded audit history — the platform's record of who did what.
 *
 * This is the single store Platform Usage reads from (see platform-usage.ts):
 * actions, active users, module mix, AI usage, runs, shares and downloads are
 * all counted off these events. It is also what Admin › Audit Log lists.
 *
 * ## Why it's generated rather than hand-written
 *
 * The page needs 180 days of history — 90 visible plus an equal prior window so
 * every number has something to compare against. Hand-writing ~2,000 events is
 * neither maintainable nor uniform, so the history is *composed*: each member
 * has a persona (how much they work, which modules they live in, when they
 * stopped), and the generator plays those personas out across the calendar.
 *
 * It is fully deterministic — a fixed-seed PRNG, no Date.now(), no Math.random()
 * — so every reload, test run and screenshot sees the identical history.
 *
 * ## The rules it holds to
 *
 * · Every actor is a real member of SEED_USERS. An event by someone who isn't
 *   on the People list can never be attributed, and its usage silently vanishes
 *   from the page. The one exception is 'Unknown', which only ever appears on
 *   *failed* logins — that's the point of the record.
 * · A member's history stops when their access did. Suspended, locked and
 *   inactive members go quiet on the date their account did, so the seat
 *   lifecycle on the page matches the activity behind it.
 * · Nobody works at 3am. Events follow a business-hours curve on weekdays and
 *   thin out to almost nothing at weekends, so the rhythm heatmap reads true.
 * · Roles constrain actions. A Viewer exports and reads; they never create.
 *
 * ## Anchoring
 *
 * The platform's mock records live in early 2026 (engagements dated Apr 2026,
 * workflow runs Mar 2026). This history ends on the same horizon — ANCHOR,
 * Tue 21 Apr 2026 — so Platform Usage tells the same story as every other
 * screen. Platform Usage measures its windows back from the newest record it
 * can find, and labels itself "Data as of <that date>".
 */

import type { AuditLog } from '../context/AdminDataContext';
import { MY_DASHBOARDS, SHARED_DASHBOARDS } from './dashboards';
import { ENGAGEMENTS as ENGAGEMENT_RECORDS } from './engagements';
import {
  BUSINESS_PROCESSES, CONTROLS as CONTROL_RECORDS, RISKS as RISK_RECORDS,
  WORKFLOWS as WORKFLOW_RECORDS, DATA_SOURCES, GENERATED_REPORTS,
} from './mockData';
import { SEED as KH_ITEMS } from '../components/data-sources/sources';
import { CONCIERGE_TOOLS } from './conciergeTools';
import { WORKSPACES, DEFAULT_WORKSPACE } from './workspaces';

type SeedLog = Omit<AuditLog, 'id'>;

/** The last day of seeded activity — Tue 21 Apr 2026. */
export const AUDIT_ANCHOR = '2026-04-21';
/** Days of history generated. Twice the 90-day range the page can show, so the
 *  longest window always has a full prior window behind it. */
const HISTORY_DAYS = 180;

const DAY_MS = 86400000;
const ANCHOR_MS = Date.UTC(2026, 3, 21);

/* ──────────────────────────────────────────────────────────────────────────
 * Deterministic randomness
 * ────────────────────────────────────────────────────────────────────────── */

/** mulberry32 — small, fast, well-distributed. Fixed seed ⇒ fixed history. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x5ea7c0de);

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));

/** Pick from `xs` by weight — `weight(x)` need not be normalised. */
function pickWeighted<T>(xs: readonly T[], weight: (x: T) => number): T {
  const total = xs.reduce((s, x) => s + weight(x), 0);
  let r = rand() * total;
  for (const x of xs) {
    r -= weight(x);
    if (r <= 0) return x;
  }
  return xs[xs.length - 1];
}

/* ──────────────────────────────────────────────────────────────────────────
 * The vocabulary — read straight off the platform's registries
 *
 * Every name an event mentions is a thing that actually exists. This is not
 * decoration: Platform Usage joins events back to records *by name* (the
 * Dashboards section ranks the catalog by how often each dashboard is named in
 * a Dashboard event). Invent a name here and it silently matches nothing, so
 * a real dashboard reads as dead. Always pull from the registry.
 * ────────────────────────────────────────────────────────────────────────── */

const PROCESSES = BUSINESS_PROCESSES.map(p => p.name);
const CONTROLS = CONTROL_RECORDS.map(c => c.name);
const RISKS = RISK_RECORDS.map(r => r.name);
const WORKFLOWS = WORKFLOW_RECORDS.map(w => w.name);
// Only the dashboards the Dashboards page actually lists (its My + Shared tabs).
// The catalog also holds two onboarding samples that appear on no screen, and an
// event naming one of those would attribute activity to a dashboard the user
// cannot open.
const DASHBOARDS = [...MY_DASHBOARDS, ...SHARED_DASHBOARDS].map(d => d.name);
const ENGAGEMENTS = ENGAGEMENT_RECORDS.map(e => e.name);
const SOURCES = DATA_SOURCES.map(s => s.name);
const DOCS = KH_ITEMS.map(s => s.name);
/** Report names land inside sentences, so skip the deliberately-absurd long one
 *  the Reports view uses to test truncation. */
const REPORTS = GENERATED_REPORTS.map(r => r.name).filter(n => n.length <= 60);

/** Written as they'd be said, so "shared with …" reads like a sentence rather
 *  than "shared with the Management". */
const TEAMS = ['the SOX Audit team', 'the IFC Team', 'Management', 'the Engineering team'] as const;

/** The process code that prefixes a working-paper id — P2P, O2C, S2C, R2R. */
const PROCESS_CODES = BUSINESS_PROCESSES.map(p => p.abbr);

/**
 * How much attention each dashboard gets, and when it stopped getting any.
 *
 * Attention is never uniform in real life — a couple of dashboards carry the
 * team and one was built once and never opened again. Picking evenly would mean
 * every dashboard is always "touched", and the Dashboards section's whole job is
 * to surface the ones that aren't. So one shared dashboard has gone quiet since
 * the spring. That's the finding the page is meant to hand an admin.
 *
 * `quietFor` is a day count back from the anchor during which the dashboard gets
 * no events at all — so it reads as untouched in any window shorter than that.
 */
const DASHBOARD_ATTENTION: Record<string, { weight: number; quietFor?: number }> = {
  'Procurement (P2P)': { weight: 10 },
  'GRC Overview': { weight: 9 },
  'Order to Cash (O2C)': { weight: 7 },
  'SOX Compliance Tracker': { weight: 6 },
  'Vendor Risk Assessment': { weight: 4 },
  'Source to Contract (S2C)': { weight: 3 },
  // Shared with the team, but nobody has touched it in about seven weeks.
  'AP Duplicate Detection': { weight: 3, quietFor: 45 },
};

/**
 * The day currently being generated, as an offset back from the anchor. Module
 * scope purely so a template's `text()` can honour `quietFor` without every
 * template having to take a parameter it doesn't care about. Set once per day by
 * buildHistory(), read only by pickDashboard().
 */
let currentDayOffset = 0;

/** A dashboard that was still in use on the day being generated. */
function pickDashboard(): string {
  const live = DASHBOARDS.filter(name => {
    const quiet = DASHBOARD_ATTENTION[name]?.quietFor;
    return quiet === undefined || currentDayOffset >= quiet;
  });
  // Every dashboard quiet on this day (shouldn't happen) — fall back to the catalog.
  const pool = live.length > 0 ? live : DASHBOARDS;
  return pickWeighted(pool, name => DASHBOARD_ATTENTION[name]?.weight ?? 1);
}

const QUESTIONS = [
  'which controls are still untested this quarter',
  'show me the high-severity risks in P2P',
  'what changed in the vendor master last month',
  'summarise the open exceptions by owner',
  'how many manual journal entries breached the threshold',
  'which controls failed their last test',
  'what is our SOX readiness by process',
  'list duplicate invoices over ₹5L',
  'who owns the untested key controls',
  'explain the exceptions raised by the three-way match',
] as const;

/**
 * How much each AI Concierge tool actually gets run, and on what.
 *
 * The catalog is the source of truth for *which* tools exist (conciergeTools.ts);
 * this is the source of truth for how hard each one is worked. Attention is never
 * uniform: the RACM Generator is the reason most people open the Concierge at all,
 * and the Medical Report Reader ships for an insurance vertical this workspace
 * doesn't audit — nobody has ever run it. Omitted from this map ⇒ zero runs, and
 * the page reports that as an unused tool rather than inventing a number.
 *
 * Weights sum to 3 — the weight the single generic Concierge template used to
 * carry in the `ai` bucket — so splitting one template into seven changes which
 * tool an event names, not how many AI events there are.
 *
 * The old template logged every run under one 'Concierge Tool' entity with the
 * tool's name buried in prose, and named tools ('evidence summariser', 'risk
 * drafter') the platform doesn't even ship. Platform Usage therefore could not
 * say which tool anyone used. The entity is now the tool's real title, so runs
 * join back to the catalog by name — the same rule the dashboards follow.
 */
const TOOL_ATTENTION: Record<string, number> = {
  'RACM Generator': 1.0,
  'Document Forensics': 0.7,
  'Table Extractor': 0.5,
  'Insights & Anomaly Report': 0.4,
  'Image Analytics': 0.25,
  'Speech Auditor': 0.15,
  // 'Medical Report Reader' — shipped, never run in this workspace.
};

/** What each tool is plausibly pointed at, so a run reads like a real one. */
const TOOL_TARGET: Record<string, () => string> = {
  'RACM Generator': () => `the ${pick(PROCESSES)} SOP`,
  'Document Forensics': () => `a vendor invoice pack for ${pick(PROCESSES)}`,
  'Table Extractor': () => `a bank statement for ${pick(PROCESSES)}`,
  'Insights & Anomaly Report': () => `the ${pick(PROCESSES)} ledger extract`,
  'Image Analytics': () => `site photos filed against ${pick(PROCESSES)}`,
  'Speech Auditor': () => `a recorded ${pick(PROCESSES)} walkthrough call`,
  'Medical Report Reader': () => 'a claim file',
};

const DOC_FORMATS = ['PDF', 'DOCX', 'PPTX'] as const;

const workingPaper = () => `${pick(PROCESS_CODES)}-WP-${String(between(1, 42)).padStart(3, '0')}`;

/* ──────────────────────────────────────────────────────────────────────────
 * Event templates, grouped by the area of the platform they happen in
 * ────────────────────────────────────────────────────────────────────────── */

type Bucket = 'ai' | 'reports' | 'engagements' | 'workflows' | 'dashboards' | 'knowledge' | 'risk' | 'admin' | 'planning' | 'exceptions';

interface Template {
  action: AuditLog['action'];
  module: string;
  entity: string;
  /** Relative likelihood within its bucket. */
  weight: number;
  text: () => string;
}

/* Descriptions are load-bearing — the page parses them back out:
 *   Export → /(?:Exported|Downloaded|Generated) (.+?) (?:as |\()(FORMAT)/
 *   Create → the "Recently created" list strips a leading "Created "
 *   Run/Share → rendered as "<Name> <description, first letter lowercased>"
 * Keep those shapes when adding templates. */
const TEMPLATES: Record<Bucket, Template[]> = {
  ai: [
    { action: 'Create', module: 'Ask IRA', entity: 'Query', weight: 6, text: () => `Asked Ask IRA: ${pick(QUESTIONS)}` },
    // One template per tool the Concierge actually ships, so the run says which
    // tool it was. A tool with no attention weight gets no template at all —
    // that absence is what makes "never run" true rather than merely unproven.
    ...CONCIERGE_TOOLS
      .filter(t => (TOOL_ATTENTION[t.title] ?? 0) > 0)
      .map((t): Template => ({
        action: 'Run',
        module: 'AI Concierge',
        entity: t.title,
        weight: TOOL_ATTENTION[t.title],
        text: () => `Ran ${t.title} on ${TOOL_TARGET[t.title]?.() ?? pick(PROCESSES)}`,
      })),
    // A Create that isn't a Query: counted as activity, not as a question asked.
    { action: 'Create', module: 'Ask IRA', entity: 'Insight', weight: 1, text: () => `Saved an Ask IRA answer into "${pick(REPORTS)}"` },
  ],
  reports: [
    { action: 'Create', module: 'Report', entity: 'Report', weight: 2, text: () => `Created ${pick(REPORTS)}` },
    { action: 'Export', module: 'Report', entity: 'Report', weight: 3, text: () => `Exported ${pick(REPORTS)} as ${pick(DOC_FORMATS)}` },
    { action: 'Share', module: 'Report', entity: 'Report', weight: 2, text: () => `Shared ${pick(REPORTS)} with the audit committee` },
    { action: 'Update', module: 'Report', entity: 'Report', weight: 2, text: () => `Rewrote the executive summary in ${pick(REPORTS)}` },
    { action: 'Export', module: 'Report', entity: 'ATR', weight: 1, text: () => `Exported ATR — ${pick(ENGAGEMENTS)} as PDF` },
  ],
  engagements: [
    { action: 'Create', module: 'Engagements', entity: 'Engagement', weight: 1, text: () => `Created engagement "${pick(ENGAGEMENTS)}"` },
    { action: 'Update', module: 'Engagement Execution', entity: 'Working Paper', weight: 4, text: () => `Edited working paper "${workingPaper()}" and marked it for review` },
    { action: 'Run', module: 'Engagement Execution', entity: 'Control Test', weight: 3, text: () => `Ran the test for "${pick(CONTROLS)}"` },
    { action: 'Upload', module: 'Engagement Execution', entity: 'Evidence', weight: 3, text: () => `Uploaded evidence for "${pick(CONTROLS)}"` },
    { action: 'Update', module: 'SOX ICFR', entity: 'Control', weight: 2, text: () => `Signed off "${pick(CONTROLS)}" as operating effectively` },
    { action: 'Export', module: 'Engagements', entity: 'Engagement', weight: 1, text: () => `Exported ${pick(ENGAGEMENTS)} status pack as XLSX` },
  ],
  workflows: [
    { action: 'Create', module: 'Workflow Library', entity: 'Workflow', weight: 1, text: () => `Created workflow "${pick(WORKFLOWS)}"` },
    { action: 'Run', module: 'Workflow Library', entity: 'Workflow', weight: 6, text: () => `Ran the ${pick(WORKFLOWS)} workflow on ${pick(PROCESSES)}` },
    { action: 'Update', module: 'Workflow Library', entity: 'Workflow', weight: 2, text: () => `Tuned the match threshold on "${pick(WORKFLOWS)}"` },
    { action: 'Share', module: 'Workflow Library', entity: 'Workflow', weight: 1, text: () => `Shared the ${pick(WORKFLOWS)} workflow with ${pick(TEAMS)}` },
    { action: 'Export', module: 'Workflow Library', entity: 'Workflow Run', weight: 1, text: () => `Exported ${pick(WORKFLOWS)} results as CSV` },
    { action: 'Delete', module: 'Workflow Library', entity: 'Workflow', weight: 1, text: () => `Deleted the superseded "${pick(WORKFLOWS)}" draft` },
  ],
  dashboards: [
    { action: 'Create', module: 'Dashboard', entity: 'Dashboard', weight: 1, text: () => `Created dashboard "${pickDashboard()}"` },
    { action: 'Update', module: 'Dashboard', entity: 'Dashboard', weight: 3, text: () => `Rearranged the ${pickDashboard()} dashboard` },
    { action: 'Share', module: 'Dashboard', entity: 'Dashboard', weight: 2, text: () => `Shared the ${pickDashboard()} dashboard with ${pick(TEAMS)}` },
    { action: 'Export', module: 'Dashboard', entity: 'Dashboard', weight: 1, text: () => `Exported ${pickDashboard()} dashboard as PPTX` },
  ],
  knowledge: [
    { action: 'Upload', module: 'Knowledge Hub', entity: 'Document', weight: 5, text: () => `Uploaded "${pick(DOCS)}" to the Knowledge Hub` },
    { action: 'Create', module: 'Data Sources', entity: 'Data Source', weight: 1, text: () => `Connected new data source "${pick(SOURCES)}"` },
    { action: 'Update', module: 'Knowledge Hub', entity: 'Folder', weight: 2, text: () => `Reorganised the ${pick(PROCESSES)} evidence folder` },
    { action: 'Delete', module: 'Knowledge Hub', entity: 'Document', weight: 1, text: () => `Removed a superseded copy of "${pick(DOCS)}"` },
    { action: 'Export', module: 'Knowledge Hub', entity: 'Document', weight: 1, text: () => `Downloaded "${pick(DOCS)}" as PDF` },
  ],
  risk: [
    { action: 'Create', module: 'Risk Register', entity: 'Risk', weight: 2, text: () => `Created risk "${pick(RISKS)}"` },
    { action: 'Update', module: 'Control Library', entity: 'Control', weight: 5, text: () => `Updated control "${pick(CONTROLS)}" effectiveness to ${between(62, 99)}%` },
    { action: 'Update', module: 'RACM', entity: 'RACM Mapping', weight: 3, text: () => `Updated the RACM mapping for "${pick(PROCESSES)}" — linked ${between(2, 6)} controls` },
    { action: 'Create', module: 'RACM', entity: 'RACM', weight: 1, text: () => `Created the RACM for "${pick(PROCESSES)}"` },
    { action: 'Export', module: 'RACM', entity: 'RACM Matrix', weight: 2, text: () => `Exported RACM matrix — ${pick(PROCESSES)} as XLSX` },
    { action: 'Share', module: 'RACM', entity: 'RACM', weight: 1, text: () => `Shared the ${pick(PROCESSES)} RACM with the risk owners` },
    { action: 'Update', module: 'Process Hub', entity: 'Business Process', weight: 2, text: () => `Updated business process "${pick(PROCESSES)}" status to Active` },
    { action: 'Run', module: 'Control Library', entity: 'Control Test', weight: 2, text: () => `Ran a design-effectiveness check on "${pick(CONTROLS)}"` },
    { action: 'Create', module: 'Control Library', entity: 'Control', weight: 2, text: () => `Created control "${pick(CONTROLS)}" in the ${pick(PROCESSES)} library` },
  ],
  // Planning — the timeline in Audit Planning. The platform has one and the team
  // works it, but no seeded event ever landed in it, so Platform Usage reported
  // the whole module as dead for six months.
  planning: [
    { action: 'Create', module: 'Audit Planning', entity: 'Engagement Plan', weight: 3, text: () => `Scheduled "${pick(ENGAGEMENTS)}" for the ${pick(['Q1', 'Q2', 'Q3', 'Q4'])} plan` },
    { action: 'Update', module: 'Audit Planning', entity: 'Engagement Plan', weight: 4, text: () => `Moved "${pick(ENGAGEMENTS)}" out by ${between(1, 3)} week${between(0, 1) === 1 ? 's' : ''} — resourcing` },
    { action: 'Update', module: 'Audit Planning', entity: 'Engagement Plan', weight: 3, text: () => `Assigned "${pick(ENGAGEMENTS)}" to a new lead auditor` },
    { action: 'Export', module: 'Audit Planning', entity: 'Plan', weight: 1, text: () => `Exported the annual audit plan as XLSX` },
  ],

  // Exception triage — My Queue. This is where an auditor's day actually goes,
  // and it had exactly one template hiding inside the `risk` bucket.
  exceptions: [
    { action: 'Update', module: 'Exceptions', entity: 'Exception', weight: 5, text: () => `Triaged the exception raised by "${pick(WORKFLOWS)}"` },
    { action: 'Update', module: 'Exceptions', entity: 'Exception', weight: 4, text: () => `Classified an exception on "${pick(CONTROLS)}" as ${pick(['a control deficiency', 'a process gap', 'a false positive'])}` },
    { action: 'Update', module: 'Exceptions', entity: 'Exception', weight: 3, text: () => `Closed exception on "${pick(CONTROLS)}" with a remediation note` },
    { action: 'Create', module: 'Exceptions', entity: 'Action Plan', weight: 2, text: () => `Raised an action plan for the "${pick(WORKFLOWS)}" exception` },
    { action: 'Export', module: 'Exceptions', entity: 'Exception', weight: 1, text: () => `Exported the open exception queue as CSV` },
  ],

  admin: [
    { action: 'Create', module: 'Admin', entity: 'Role', weight: 1, text: () => `Created role "${pick(['Reviewer (read-only)', 'Control Owner', 'External Auditor', 'Process Lead'])}" with ${between(4, 14)} permissions` },
    { action: 'Update', module: 'Admin', entity: 'User', weight: 2, text: () => `Changed "${pick(['Chulbul Pandey', 'Rahul Verma', 'CS', 'Kuldeep Pandey'])}" to ${pick(['Auditor', 'Viewer', 'Enabler', 'Reviewer'])}` },
    { action: 'Export', module: 'Admin', entity: 'Audit Log', weight: 1, text: () => `Exported Audit log as CSV (${between(80, 320)} events)` },
    { action: 'Create', module: 'Admin', entity: 'Invitation', weight: 1, text: () => `Invited "${pick(['priya.singh@irame.ai', 'ajay.aj@btech2014.iitgn.ac.in'])}" as ${pick(['Risk Owner', 'Enabler'])}` },
    { action: 'Update', module: 'Admin', entity: 'Settings', weight: 1, text: () => `Updated the session timeout policy to ${pick(['30', '60', '120'])} minutes` },
  ],
};

/* ──────────────────────────────────────────────────────────────────────────
 * Personas — one per member of SEED_USERS
 * ────────────────────────────────────────────────────────────────────────── */

interface Persona {
  /** Must match AdminUser.name exactly, or the activity can't be attributed. */
  name: string;
  /** Events on a typical weekday, before growth and noise. */
  weight: number;
  /** How their work splits across the platform. */
  mix: Partial<Record<Bucket, number>>;
  /**
   * How their time splits across workspaces (Workspace.id → weight). Most people
   * live in one workspace and dip into the other; a few never leave theirs.
   * Omitted ⇒ they only ever work in the internal Platform workspace.
   */
  workspaces?: Record<string, number>;
  /** Viewers read and export; they never create or delete. */
  readOnly?: boolean;
  /** Last day they had access (YYYY-MM-DD). Omitted ⇒ still active. */
  activeUntil?: string;
  /** Roughly when their day starts — shifts their events earlier or later. */
  earlyBird?: boolean;
}

const PERSONAS: Persona[] = [
  // ── Heavy: the audit team living in the platform every day ──
  {
    name: 'Abhinav Sharma', weight: 2.6, earlyBird: true,
    workspaces: { platform: 75, 'auditify-mvp': 25 },
    mix: { risk: 26, engagements: 22, ai: 14, exceptions: 10, admin: 10, planning: 8, reports: 10, knowledge: 6 },
  },
  {
    name: 'Aditya Thakur', weight: 2.5,
    workspaces: { platform: 40, 'auditify-mvp': 60 },
    mix: { engagements: 28, risk: 20, exceptions: 16, workflows: 16, ai: 14, reports: 8 },
  },
  {
    name: 'Nilesh Anand', weight: 2.4,
    workspaces: { platform: 80, 'auditify-mvp': 20 },
    mix: { reports: 26, ai: 18, dashboards: 14, admin: 12, planning: 12, risk: 10, engagements: 10 },
  },
  {
    name: 'Ayushi Narang', weight: 2.2,
    workspaces: { platform: 45, 'auditify-mvp': 55 },
    mix: { risk: 26, reports: 20, ai: 16, exceptions: 14, engagements: 14, knowledge: 12 },
  },

  {
    name: 'Tushar Goel', weight: 2.0,
    workspaces: { platform: 50, 'auditify-mvp': 50 },
    mix: { risk: 28, engagements: 22, exceptions: 18, workflows: 16, ai: 12, reports: 6 },
  },

  // ── Regular: steady, narrower ──
  {
    name: 'Karan Mehta', weight: 1.8,
    workspaces: { platform: 35, 'auditify-mvp': 65 },
    mix: { engagements: 26, reports: 20, risk: 16, planning: 14, exceptions: 12, ai: 12, dashboards: 10 },
  },
  {
    name: 'Ajay Mudhai', weight: 1.2,
    mix: { knowledge: 30, dashboards: 24, admin: 20, reports: 16, ai: 10 },
  },
  {
    name: 'Vijay Reddy', weight: 1.1,
    workspaces: { platform: 70, 'auditify-mvp': 30 },
    mix: { reports: 30, engagements: 26, risk: 20, exceptions: 14, ai: 10 },
  },
  {
    // Still an Active account, but nobody has touched it since mid-March — the
    // near-duplicate of 'Ajay Mudhai'. This is the dormant paid seat the page
    // is meant to surface, and it's a real one rather than a decorative zero.
    name: 'ajay mudhai', weight: 1.0, activeUntil: '2026-03-12',
    mix: { knowledge: 34, workflows: 30, risk: 20, ai: 16 },
  },
  {
    name: 'CS', weight: 0.9,
    mix: { workflows: 40, dashboards: 26, knowledge: 20, ai: 14 },
  },

  // ── Light: Viewers, who only ever pull things out ──
  {
    name: 'Sana Kapoor', weight: 0.4, readOnly: true,
    mix: { reports: 55, dashboards: 30, knowledge: 15 },
  },
  {
    name: 'AI', weight: 0.35, readOnly: true,
    mix: { reports: 50, dashboards: 30, knowledge: 20 },
  },

  // ── Lapsed: history stops the day their access did ──
  {
    // Suspended 28 Mar.
    name: 'Chulbul Pandey', weight: 0.8, activeUntil: '2026-03-28',
    mix: { risk: 40, reports: 30, knowledge: 30 },
  },
  {
    // Went inactive 14 Feb.
    name: 'Kuldeep Pandey', weight: 0.7, activeUntil: '2026-02-14',
    mix: { reports: 40, engagements: 35, risk: 25 },
  },
  {
    // Locked out 5 Mar.
    name: 'Rahul Verma', weight: 0.45, readOnly: true, activeUntil: '2026-03-05',
    mix: { reports: 60, dashboards: 40 },
  },

  // Ajay 14110008 and Priya Singh are invited but have never signed in — they
  // produce nothing, which is exactly what makes them show up as unused seats.
];

/** Admin-module events only make sense for the people who administer. */
const ADMINS = new Set(['Abhinav Sharma', 'Nilesh Anand', 'Ajay Mudhai']);

const WORKSPACE_IDS = WORKSPACES.map(w => w.id);

/**
 * Which workspace a person spent a given day in. Chosen once per person per day,
 * not per event: people don't hop workspaces between clicks — they open one in
 * the morning and work there.
 */
function workspaceForDay(p: Persona): string {
  const mix = p.workspaces;
  if (!mix) return DEFAULT_WORKSPACE.id;
  return pickWeighted(WORKSPACE_IDS, id => mix[id] ?? 0);
}

/* ──────────────────────────────────────────────────────────────────────────
 * The calendar — how busy each day is
 * ────────────────────────────────────────────────────────────────────────── */

/** Weekday shape: nothing much happens at the weekend. */
const DOW_FACTOR = [0.10, 1.02, 1.08, 1.06, 1.0, 0.86, 0.13]; // Sun → Sat

/** When people actually work — peaks mid-morning and mid-afternoon. */
const HOUR_WEIGHT = [
  0.1, 0.1, 0.1, 0.1, 0.2, 0.4, 1, 2.5, // 00–07
  6, 9, 11, 10, 6, 5, 9, 10,            // 08–15
  8, 5, 3, 2, 1.2, 0.8, 0.4, 0.2,       // 16–23
];

/**
 * Days that broke the pattern. These are what the page's spike detector is for
 * — each one is a real audit event with a story, not noise.
 */
const SPIKES: Record<number, { factor: number; bucket: Bucket }> = {
  // Offsets back from ANCHOR (21 Apr 2026).
  9: { factor: 2.7, bucket: 'engagements' },  // 12 Apr — SOX certification deadline
  37: { factor: 2.4, bucket: 'risk' },        // 15 Mar — quarter-end close
  71: { factor: 2.2, bucket: 'reports' },     // 9 Feb  — year-end reporting push
};

/** Adoption grows over the six months: ~0.72x at the start, ~1.27x by the end. */
const growthAt = (offset: number) => 0.72 + (1 - offset / (HISTORY_DAYS - 1)) * 0.55;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A member is only in the history while they still had access. */
function activeOn(p: Persona, dayMs: number): boolean {
  if (!p.activeUntil) return true;
  return dayMs <= Date.UTC(
    +p.activeUntil.slice(0, 4),
    +p.activeUntil.slice(5, 7) - 1,
    +p.activeUntil.slice(8, 10),
  );
}

/** Templates this persona is allowed to produce in a bucket. */
function templatesFor(p: Persona, bucket: Bucket): Template[] {
  const all = TEMPLATES[bucket];
  if (!p.readOnly) return all;
  return all.filter(t => t.action === 'Export');
}

/** Pick the bucket this event happens in, honouring the day's spike (if any). */
function bucketFor(p: Persona, spike?: { bucket: Bucket }): Bucket {
  const buckets = (Object.keys(p.mix) as Bucket[]).filter(b => b !== 'admin' || ADMINS.has(p.name));
  // On a spike day most of the extra work is in one place — but only for the
  // people who actually work there.
  if (spike && buckets.includes(spike.bucket) && rand() < 0.6) return spike.bucket;
  return pickWeighted(buckets, b => p.mix[b] ?? 0);
}

function stamp(dayMs: number, hour: number): string {
  const d = iso(dayMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d} ${p(hour)}:${p(between(0, 59))}:${p(between(0, 59))}`;
}

function hourFor(p: Persona): number {
  const weights = p.earlyBird
    ? HOUR_WEIGHT.map((w, h) => (h >= 7 && h <= 11 ? w * 1.6 : w))
    : HOUR_WEIGHT;
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return pickWeighted(hours, h => weights[h]);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Build it
 * ────────────────────────────────────────────────────────────────────────── */

function buildHistory(): SeedLog[] {
  const logs: SeedLog[] = [];

  for (let offset = HISTORY_DAYS - 1; offset >= 0; offset--) {
    const dayMs = ANCHOR_MS - offset * DAY_MS;
    const dow = new Date(dayMs).getUTCDay();
    const dowFactor = DOW_FACTOR[dow];
    const growth = growthAt(offset);
    const spike = SPIKES[offset];
    currentDayOffset = offset;

    const roster = PERSONAS.filter(p => activeOn(p, dayMs));

    for (const p of roster) {
      // How many things this person did today. Noise keeps the chart from
      // looking like a sine wave; a spike day multiplies everyone's output.
      const workspaceId = workspaceForDay(p);
      const noise = 0.55 + rand() * 0.9;
      const expected = p.weight * dowFactor * growth * noise * (spike?.factor ?? 1);
      // Fractional remainder becomes a probability, so a 0.4-event day is a
      // 40% chance of one event rather than always zero.
      let count = Math.floor(expected);
      if (rand() < expected - count) count += 1;
      if (count === 0) continue;

      // Signing in: SSO sessions last, so this is roughly once a working week,
      // not once a day. Always their first event of the day.
      if (dow !== 0 && dow !== 6 && rand() < 0.1) {
        logs.push({
          timestamp: stamp(dayMs, p.earlyBird ? between(7, 9) : between(8, 10)),
          user: p.name,
          action: 'Login',
          description: 'Signed in via SSO',
          module: 'Admin',
          entity: 'Session',
          status: 'Success',
          workspaceId,
        });
      }

      for (let i = 0; i < count; i++) {
        const bucket = bucketFor(p, spike);
        const candidates = templatesFor(p, bucket);
        if (candidates.length === 0) continue;
        const t = pickWeighted(candidates, c => c.weight);
        logs.push({
          timestamp: stamp(dayMs, hourFor(p)),
          user: p.name,
          action: t.action,
          description: t.text(),
          module: t.module,
          entity: t.entity,
          status: 'Success',
          workspaceId,
        });
      }
    }

    // Failed sign-ins — rare, and the only place 'Unknown' is a legitimate
    // actor. Platform Usage deliberately excludes them from active-user counts.
    if (rand() < 0.045) {
      logs.push({
        timestamp: stamp(dayMs, between(0, 23)),
        user: 'Unknown',
        action: 'Login',
        description: `Failed sign-in attempt with email ${pick(['admin@irame.ai', 'contractor@external.com', 'ex.employee@irame.ai'])}`,
        module: 'Admin',
        entity: 'Session',
        status: 'Failed',
        // Nobody authenticated, so no workspace was ever opened. Stamped with the
        // default purely because the field is required.
        workspaceId: DEFAULT_WORKSPACE.id,
      });
    }
  }

  // Newest first — the Audit Log tab lists them in this order.
  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** The seeded history. Built once at module load; deterministic. */
export const SEED_LOGS: SeedLog[] = buildHistory();

/* ──────────────────────────────────────────────────────────────────────────
 * Last sign-in, derived — so seats and activity can't drift apart
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The real last-active date per member, taken from the history above and
 * expressed the way the People list shows it ('Today, 09:14' for the anchor
 * day, 'Yesterday', otherwise 'Apr 14'). Members who never appear get 'Never'.
 *
 * Deriving this rather than hand-writing it is the point: the seat lifecycle on
 * Platform Usage ("no sign-in for 30+ days") is then telling you something the
 * activity behind it actually supports.
 */
export function lastActiveByName(): Record<string, string> {
  const newest = new Map<string, string>();
  for (const l of SEED_LOGS) {
    if (l.user === 'Unknown') continue;
    const prev = newest.get(l.user);
    if (!prev || l.timestamp > prev) newest.set(l.user, l.timestamp);
  }

  const out: Record<string, string> = {};
  for (const [name, ts] of newest) {
    const dayMs = Date.UTC(+ts.slice(0, 4), +ts.slice(5, 7) - 1, +ts.slice(8, 10));
    const offset = Math.round((ANCHOR_MS - dayMs) / DAY_MS);
    out[name] = offset === 0
      ? `Today, ${ts.slice(11, 16)}`
      : offset === 1
        ? 'Yesterday'
        : new Date(dayMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  return out;
}
