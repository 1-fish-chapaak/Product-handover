/**
 * Every assumption the value model makes, in one file, each one carrying who
 * set it and on what basis.
 *
 * There is one governing rule and everything else follows from it: **no figure
 * is ever estimated.** A rupee is reported only where the effort it replaced
 * is documented by the client or was measured with a stopwatch. Everything
 * else is reported as activity, with no value against it at all.
 *
 * So there are no multipliers in this file, and there is no setting to add
 * one. The old draft had a multiplier per activity kind, and every one of them
 * was a number we invented. The moment a finance lead asks where thirty times
 * came from, the honest answer undermines every other figure on the page.
 *
 * What is left is a rate, a working day, a currency conversion and the rules
 * that decide when evidence is good enough to use. Each carries who set it and
 * why, and the page prints all of them in a footer that cannot be collapsed.
 */

import { ANCHOR, DAY_MS } from '../usage/seed';

/* ──────────────────────────────────────────────────────────────────────────
 * The activities the model counts
 * ────────────────────────────────────────────────────────────────────────── */

export type ActivityKind =
  | 'workflow_run'
  | 'chat_question'
  | 'chat_clarification'
  | 'chat_revision'
  | 'chat_plan_approval'
  | 'chat_workflow_suggestion'
  | 'chat_workflow_name'
  | 'chat_config_intent'
  | 'ingestion'
  | 'govt_lookup';

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  workflow_run: 'Workflow run',
  chat_question: 'Question asked',
  chat_clarification: 'Clarification',
  chat_revision: 'Revision',
  chat_plan_approval: 'Plan approval',
  chat_workflow_suggestion: 'Workflow suggestion',
  chat_workflow_name: 'Workflow naming',
  chat_config_intent: 'Configuration intent',
  ingestion: 'File taken in',
  govt_lookup: 'Government lookup',
};

/** The groups the page reports under. */
export type ActivityGroup = 'workflow' | 'chat' | 'ingestion' | 'govt';

export const GROUP_LABEL: Record<ActivityGroup, string> = {
  workflow: 'Workflow runs',
  chat: 'Chat',
  ingestion: 'Files taken in',
  govt: 'Government lookups',
};

export const GROUP_OF: Record<ActivityKind, ActivityGroup> = {
  workflow_run: 'workflow',
  chat_question: 'chat',
  chat_clarification: 'chat',
  chat_revision: 'chat',
  chat_plan_approval: 'chat',
  chat_workflow_suggestion: 'chat',
  chat_workflow_name: 'chat',
  chat_config_intent: 'chat',
  ingestion: 'ingestion',
  govt_lookup: 'govt',
};

/**
 * The three chat kinds the platform raises for itself.
 *
 * Suggesting a workflow, naming one and reading a configuration have no manual
 * equivalent, because without the platform there is no workflow to name. They
 * are not counted and they are never valued.
 */
export const HELPER_KINDS: ActivityKind[] = [
  'chat_workflow_suggestion',
  'chat_workflow_name',
  'chat_config_intent',
];

/* ──────────────────────────────────────────────────────────────────────────
 * Complexity bands
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * How big a job this was.
 *
 * One figure per surface would flatten the difference between a fifteen minute
 * check and a four hour one, and the ledger shows that difference is enormous:
 * chat turns run from a single model call to fifty one.
 *
 * The band is not itself evidence. It decides which timing applies, and that
 * timing still has to have been done. Banding never conjures a number.
 */
export type Band = 'high' | 'medium' | 'low';

export const BAND_LABEL: Record<Band, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const BANDS: Band[] = ['high', 'medium', 'low'];

/** Where a workflow's band comes from, when a documented control decides it. */
export interface WorkflowBandThresholds {
  /** Documented effort at or above this many hours is high. */
  highHours: number;
  /** At or above this many hours is medium. Below it is low. */
  mediumHours: number;
}

/**
 * How a chat turn is banded, from what the turn actually did.
 *
 * Machine signals about the work, not about the answer. This is a proxy for
 * difficulty and it is treated as one: the bands are discrete so the effect is
 * capped, and the thresholds have to be checked against a hand judged sample
 * before anybody trusts them.
 */
export interface ChatBandRules {
  /** Touching this many distinct datasets or sources makes it high. */
  highDatasets: number;
  /** Touching this many makes it medium. */
  mediumDatasets: number;
  /** A turn that produced a plan is high. */
  planIsHigh: boolean;
  /** A turn that needed a government lookup is at least medium. */
  govtIsMedium: boolean;
  /** Tiebreak only, where the signals above did not decide it. */
  highLlmCalls: number;
  mediumLlmCalls: number;
  /** Whether somebody has checked the bands against a hand judged sample. */
  validatedAgainstSample: boolean;
  validationNote: string;
}

/** How a file taken in is banded. Size of the reading job, not of the file. */
export interface IngestionBandRules {
  highTokens: number;
  mediumTokens: number;
}

/* ──────────────────────────────────────────────────────────────────────────
 * The settings
 * ────────────────────────────────────────────────────────────────────────── */

export interface ValueSettings {
  hourlyRateInr: number;
  hoursPerDay: number;
  daysPerMonth: number;
  /** Required. Without it the page would be printing two currencies. */
  usdToInr: number;
  /** Which basis is tried first. */
  basisOrder: 'documented-first' | 'measured-first';
  workflowBands: WorkflowBandThresholds;
  chatBands: ChatBandRules;
  ingestionBands: IngestionBandRules;
  /** How far a timing may sit from the documented figure before it is flagged. */
  divergenceThresholdPct: number;
  /** A timing under this many samples is recorded and not used. */
  minBenchmarkSample: number;
  /** Share of run volume that must have a basis before the tab opens at all. */
  minCoveragePct: number;
  /**
   * Whether a figure supplied today values work done before it arrived.
   *
   * The ledger already holds the runs, so loading a control register makes a
   * year of history valuable at once. That is the right default and it is not
   * free of doubt: the figure was written after the work happened. On, with
   * the page saying so. Off, and only work done after the evidence arrived
   * carries a value.
   */
  reachBackOverHistory: boolean;
  /** How far back a displayed median duration is taken from. */
  referenceWindowDays: number;
  /** After this a timing is still used and said to be old. */
  benchmarkStaleMonths: number;
  digestEnabled: boolean;
  /**
   * Control register rows checked on the benchmarks screen in this session.
   *
   * A parsed row does not count until somebody has looked at it, so checking
   * one is a real action rather than a display toggle. It moves the figures on
   * every scope the moment it is done.
   */
  extraApprovals: string[];
  /** Workflow to control links made on the benchmarks screen in this session. */
  extraMappings: { workflowId: string; controlId: string }[];
}

/** The fourteen lookups the connector offers, and what one costs per call. */
export const GOVT_LOOKUPS: { key: string; label: string; priceInr: number }[] = [
  { key: 'cin_advanced',       label: 'Company number, full',  priceInr: 10 },
  { key: 'driving_licence',    label: 'Driving licence',       priceInr: 10 },
  { key: 'email_verification', label: 'Email verification',    priceInr: 10 },
  { key: 'gst_advanced',       label: 'GST, full',             priceInr: 10 },
  { key: 'gst_basic',          label: 'GST, basic',            priceInr: 10 },
  { key: 'gst_by_pan',         label: 'GST from PAN',          priceInr: 10 },
  { key: 'pan_basic',          label: 'PAN, basic',            priceInr: 10 },
  { key: 'pan_details_plus',   label: 'PAN, full',             priceInr: 10 },
  { key: 'passport',           label: 'Passport',              priceInr: 10 },
  { key: 'uan_advanced',       label: 'Provident fund number', priceInr: 10 },
  { key: 'udyam_basic',        label: 'Udyam registration',    priceInr: 10 },
  { key: 'udyam_by_pan',       label: 'Udyam from PAN',        priceInr: 15 },
  { key: 'vehicle_rc',         label: 'Vehicle registration',  priceInr: 10 },
  { key: 'voter_id',           label: 'Voter identity',        priceInr: 10 },
];

export const GOVT_PRICE = new Map(GOVT_LOOKUPS.map(l => [l.key, l.priceInr]));
export const GOVT_LABEL = new Map(GOVT_LOOKUPS.map(l => [l.key, l.label]));

export const DEFAULT_SETTINGS: ValueSettings = {
  hourlyRateInr: 500,
  hoursPerDay: 8,
  daysPerMonth: 30,
  usdToInr: 88.5,
  basisOrder: 'documented-first',
  workflowBands: { highHours: 2, mediumHours: 0.5 },
  chatBands: {
    highDatasets: 3,
    mediumDatasets: 2,
    planIsHigh: true,
    govtIsMedium: true,
    highLlmCalls: 12,
    mediumLlmCalls: 5,
    validatedAgainstSample: false,
    validationNote:
      'Nobody has yet taken a sample of banded turns and judged by hand whether the high ones '
      + 'really were the hard ones. Until somebody has, the bands are a reasonable guess at '
      + 'difficulty and the timings hanging off them inherit that.',
  },
  ingestionBands: { highTokens: 35_000, mediumTokens: 15_000 },
  divergenceThresholdPct: 40,
  minBenchmarkSample: 5,
  minCoveragePct: 50,
  reachBackOverHistory: true,
  referenceWindowDays: 90,
  benchmarkStaleMonths: 12,
  digestEnabled: true,
  extraApprovals: [],
  extraMappings: [],
};

/** One auditor month, which is what capacity is quoted in. */
export const monthHours = (s: ValueSettings): number => s.hoursPerDay * s.daysPerMonth;
export const monthCostInr = (s: ValueSettings): number => monthHours(s) * s.hourlyRateInr;

/* ──────────────────────────────────────────────────────────────────────────
 * Provenance
 * ────────────────────────────────────────────────────────────────────────── */

/** Who set a number, when, and why. This is what the footer prints. */
export interface Provenance {
  key: string;
  label: string;
  value: string;
  setBy: string;
  setAt: number;
  basis: string;
}

export const SETTING_PROVENANCE: Provenance[] = [
  {
    key: 'hourlyRateInr',
    label: 'Auditor hourly rate',
    value: '₹500 an hour',
    setBy: 'Nilesh Anand',
    setAt: ANCHOR - 120 * DAY_MS,
    basis: 'Blended internal audit charge out rate for the year, from finance.',
  },
  {
    key: 'auditorMonth',
    label: 'One auditor month',
    value: '8 hours a day, 30 days a month, so 240 hours',
    setBy: 'Nilesh Anand',
    setAt: ANCHOR - 120 * DAY_MS,
    basis: 'The basis capacity is quoted in. It is a calendar month, not a working month.',
  },
  {
    key: 'usdToInr',
    label: 'Dollar to rupee rate',
    value: '₹88.50 to the dollar',
    setBy: 'Karan Mehta',
    setAt: ANCHOR - 31 * DAY_MS,
    basis: 'Month end rate, stored per period so a later move does not rewrite history.',
  },
  {
    key: 'noEstimates',
    label: 'What may be valued',
    value: 'Only work whose manual effort is documented by you or was timed',
    setBy: 'Nilesh Anand',
    setAt: ANCHOR - 20 * DAY_MS,
    basis:
      'Everything else is counted and left unvalued. There are no multipliers, so the headline '
      + 'is a floor rather than a total and it moves when evidence moves.',
  },
  {
    key: 'basisOrder',
    label: 'Which manual figure wins',
    value: 'Your own control documentation, then a timing',
    setBy: 'Nilesh Anand',
    setAt: ANCHOR - 90 * DAY_MS,
    basis: 'A timing is more accurate. Your own signed document is harder to argue with.',
  },
  {
    key: 'bands',
    label: 'How a job is sized',
    value: 'High, medium and low, each with its own timing',
    setBy: 'Nilesh Anand',
    setAt: ANCHOR - 20 * DAY_MS,
    basis:
      'One figure per surface would treat a fifteen minute check and a four hour one as the same '
      + 'job. A band decides which timing applies and never invents one.',
  },
  {
    key: 'bulk',
    label: 'What a batch saves on top',
    value: 'The timed manual setup, once for every run after the first',
    setBy: 'Nilesh Anand',
    setAt: ANCHOR - 20 * DAY_MS,
    basis:
      'By hand the setup is paid once per instance. In a batch it is paid once. A workflow with '
      + 'no setup timing earns nothing extra for batching.',
  },
  {
    key: 'median',
    label: 'Average run time',
    value: 'The median of the last 90 days, longest one per cent left out',
    setBy: 'Nilesh Anand',
    setAt: ANCHOR - 90 * DAY_MS,
    basis: 'The mean on this workspace sits well above the median and would misstate platform speed.',
  },
  {
    key: 'divergence',
    label: 'Disagreement worth flagging',
    value: '40 per cent between a document and a timing',
    setBy: 'Nilesh Anand',
    setAt: ANCHOR - 90 * DAY_MS,
    basis: 'Either the budget is padded or the timing was not representative. Both are worth knowing.',
  },
  {
    key: 'reachBack',
    label: 'History',
    value: 'A figure supplied today values work done before it arrived',
    setBy: 'Nilesh Anand',
    setAt: ANCHOR - 14 * DAY_MS,
    basis:
      'The runs were already recorded, so loading a register makes a year of history valuable at '
      + 'once. The page says which figures reached back rather than letting it pass unremarked.',
  },
  {
    key: 'minSample',
    label: 'Timings before one counts',
    value: 'Five',
    setBy: 'Nilesh Anand',
    setAt: ANCHOR - 90 * DAY_MS,
    basis: 'Under five, the work stays unvalued rather than resting on one slow afternoon.',
  },
  {
    key: 'exceptions',
    label: 'Money on an exception',
    value: 'Never, and there is no setting for it',
    setBy: 'Nilesh Anand',
    setAt: ANCHOR - 20 * DAY_MS,
    basis: 'Pricing a missed exception would be exactly the invented number this page exists to refuse.',
  },
];
