/**
 * The evidence. Everything the model is allowed to put a rupee against.
 *
 * There are exactly two kinds of evidence and nothing below them.
 *
 * · A control the client documented. An audit workflow exists to perform a
 *   control test, and that test is already written down in their risk and
 *   control matrix or in the procedure behind it, usually with the hours it
 *   takes by hand. Their document, their estimate, their sign off.
 * · A stopwatch. Somebody sat with an auditor doing the work by hand and wrote
 *   down how long it took, and how many auditors they watched.
 *
 * Work with neither is counted and left unvalued. That is the whole point: a
 * smaller number that survives being questioned is worth more than a larger
 * one that does not.
 *
 * Two rules protect the top tier. A parsed register row does not count until a
 * person has checked what the parse read, because a model misreading a merged
 * cell must never become the headline. And effort built up from written steps
 * needs a *timed* minutes per step: documented steps times a measured step is
 * evidence, documented steps times a guess is not.
 */

import { ANCHOR, DAY_MS, actorByEmail, type Actor } from '../usage/seed';
import type { Band } from './settings';

const by = (email: string): Actor => actorByEmail(email) as Actor;

/* ──────────────────────────────────────────────────────────────────────────
 * Timings
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A stopwatch on real people.
 *
 * Effective dated, so a re timing does not move a figure somebody has already
 * read. The sample size travels with it everywhere, because a timing on four
 * people and a timing on twelve are not the same claim.
 */
export interface Timing {
  minutes: number;
  sampleSize: number;
  timedBy: Actor;
  timedAt: number;
  effectiveFrom: number;
  notes: string;
}

const timing = (
  minutes: number, sampleSize: number, email: string, daysAgo: number, notes: string,
): Timing => ({
  minutes,
  sampleSize,
  timedBy: by(email),
  timedAt: ANCHOR - daysAgo * DAY_MS,
  effectiveFrom: ANCHOR - daysAgo * DAY_MS,
  notes,
});

/**
 * How long one written step of a procedure takes.
 *
 * The one timing that turns a documented step count into a documented effort.
 * Without it, a control whose effort is built up from its steps has no usable
 * figure at all, and the workflows behind it stay unvalued.
 */
export const STEP_TIMING: Timing = timing(
  11, 6, 'priya.singh@irame.ai', 63,
  'Six auditors timed on real access review steps, so a step count can be turned into hours.',
);

/* ──────────────────────────────────────────────────────────────────────────
 * The control register
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Where a documented effort figure came from, best first.
 *
 * · `stated`  the matrix carries a test effort column and this is that column.
 * · `plan`    the matrix does not, so this is the hours the annual audit plan
 *             allocated to the control.
 * · `derived` neither exists, so the written steps are counted and priced at
 *             the timed step above.
 */
export type EffortBasis = 'stated' | 'plan' | 'derived';

export const EFFORT_BASIS_LABEL: Record<EffortBasis, string> = {
  stated: 'Stated in your matrix',
  plan: 'Allocated in the audit plan',
  derived: 'Written steps at a timed step',
};

export interface ControlRegisterEntry {
  controlId: string;
  description: string;
  testProcedure: string;
  /** Null where the effort is built from steps instead. */
  documentedEffortHours: number | null;
  effortBasis: EffortBasis;
  /** Set only where the basis is `derived`. */
  sopSteps: number | null;
  sourceDocument: string;
  sourcePage: number;
  /** Null until somebody has checked the parse. Null means it does not count. */
  reviewedBy: Actor | null;
  reviewedAt: number | null;
  effectiveFrom: number;
}

export const CONTROL_REGISTER: ControlRegisterEntry[] = [
  {
    controlId: 'FIN-07',
    description: 'Journal entries posted outside the close calendar are reviewed and approved.',
    testProcedure: 'Extract all manual journals for the period, identify those posted outside the close window, agree each to an approval.',
    documentedEffortHours: 4,
    effortBasis: 'stated',
    sopSteps: null,
    sourceDocument: 'RACM_FY26_finance.xlsx',
    sourcePage: 3,
    reviewedBy: by('abhinav@irame.ai'),
    reviewedAt: ANCHOR - 96 * DAY_MS,
    effectiveFrom: ANCHOR - 400 * DAY_MS,
  },
  {
    controlId: 'P2P-03',
    description: 'Payments above the delegated limit carry a second approval.',
    testProcedure: 'Select all payments above the limit, agree each to the second approver on the payment file.',
    documentedEffortHours: 2.5,
    effortBasis: 'stated',
    sopSteps: null,
    sourceDocument: 'RACM_FY26_p2p.xlsx',
    sourcePage: 7,
    reviewedBy: by('aditya.thakur@irame.ai'),
    reviewedAt: ANCHOR - 92 * DAY_MS,
    effectiveFrom: ANCHOR - 400 * DAY_MS,
  },
  {
    controlId: 'P2P-07',
    description: 'Payments to a vendor added in the same period are reviewed before release.',
    testProcedure: 'Match the payment run against vendor master creation dates and review the exceptions.',
    documentedEffortHours: 1,
    effortBasis: 'stated',
    sopSteps: null,
    sourceDocument: 'RACM_FY26_p2p.xlsx',
    sourcePage: 9,
    reviewedBy: by('aditya.thakur@irame.ai'),
    reviewedAt: ANCHOR - 92 * DAY_MS,
    effectiveFrom: ANCHOR - 400 * DAY_MS,
  },
  {
    controlId: 'P2P-01',
    description: 'Purchase order, goods receipt and invoice agree before an invoice is paid.',
    testProcedure: 'Take the invoice population, match each to its order and receipt, list every break and the reason for it.',
    documentedEffortHours: 3.5,
    effortBasis: 'stated',
    sopSteps: null,
    sourceDocument: 'RACM_FY26_p2p.xlsx',
    sourcePage: 2,
    reviewedBy: by('ayushi.narang@irame.ai'),
    reviewedAt: ANCHOR - 92 * DAY_MS,
    effectiveFrom: ANCHOR - 400 * DAY_MS,
  },
  {
    controlId: 'P2P-05',
    description: 'Goods receipts are raised against an open order.',
    testProcedure: 'Agree each receipt to an open order and list the receipts with none.',
    documentedEffortHours: 1.75,
    effortBasis: 'stated',
    sopSteps: null,
    sourceDocument: 'RACM_FY26_ifc.xlsx',
    sourcePage: 4,
    reviewedBy: by('meera.nair@irame.ai'),
    reviewedAt: ANCHOR - 78 * DAY_MS,
    effectiveFrom: ANCHOR - 400 * DAY_MS,
  },
  {
    controlId: 'HR-02',
    description: 'Payroll is reviewed for duplicate bank details and duplicate identifiers.',
    testProcedure: 'Run the payroll register for duplicates on account number, identifier and name, and clear each hit.',
    documentedEffortHours: 3,
    effortBasis: 'plan',
    sopSteps: null,
    sourceDocument: 'Audit_plan_FY26.xlsx',
    sourcePage: 11,
    reviewedBy: by('meera.nair@irame.ai'),
    reviewedAt: ANCHOR - 74 * DAY_MS,
    effectiveFrom: ANCHOR - 400 * DAY_MS,
  },
  {
    // No hours anywhere in the matrix for this one, so the effort is the
    // written steps priced at the timed step above. Fourteen steps at eleven
    // timed minutes each.
    controlId: 'ITGC-04',
    description: 'No person holds both the ability to raise and the ability to approve the same transaction.',
    testProcedure: 'Fourteen written steps: pull the role matrix, expand each role to its rights, cross the conflicting pairs, clear each hit with the application owner.',
    documentedEffortHours: null,
    effortBasis: 'derived',
    sopSteps: 14,
    sourceDocument: 'SOP_access_reviews_v4.pdf',
    sourcePage: 6,
    reviewedBy: by('priya.singh@irame.ai'),
    reviewedAt: ANCHOR - 60 * DAY_MS,
    effectiveFrom: ANCHOR - 400 * DAY_MS,
  },
  {
    // Parsed out of a register and nobody has checked it, so nothing uses it.
    // Six hours against a run that takes two minutes would be the largest
    // single figure on the page, which is exactly why it waits.
    controlId: 'CTR-02',
    description: 'Contracts approaching expiry are escalated to the business owner.',
    testProcedure: 'List live contracts expiring inside ninety days and agree each to an escalation.',
    documentedEffortHours: 6,
    effortBasis: 'stated',
    sopSteps: null,
    sourceDocument: 'RACM_FY26_contracts.xlsx',
    sourcePage: 5,
    reviewedBy: null,
    reviewedAt: null,
    effectiveFrom: ANCHOR - 18 * DAY_MS,
  },
];

export const CONTROL_BY_ID = new Map(CONTROL_REGISTER.map(c => [c.controlId, c]));

/** A register row only counts once somebody has checked what the parse read. */
export const isReviewed = (c: ControlRegisterEntry): boolean => c.reviewedBy !== null;

/**
 * The hours a control documents, or null where it documents none we can use.
 *
 * A control whose effort is built from steps has no usable figure until the
 * step itself has been timed, so this returns null rather than reaching for a
 * number nobody measured.
 */
export function documentedHours(c: ControlRegisterEntry): number | null {
  if (c.effortBasis === 'derived') {
    if (c.sopSteps === null) return null;
    return (c.sopSteps * STEP_TIMING.minutes) / 60;
  }
  return c.documentedEffortHours;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Which workflow tests which control
 * ────────────────────────────────────────────────────────────────────────── */

export interface WorkflowControlLink {
  workflowId: string;
  controlId: string;
}

export const WORKFLOW_CONTROL_MAP: WorkflowControlLink[] = [
  { workflowId: 'wf-je-anomaly', controlId: 'FIN-07' },
  { workflowId: 'wf-payment-flag', controlId: 'P2P-03' },
  { workflowId: 'wf-payment-flag', controlId: 'P2P-07' },
  { workflowId: 'wf-three-way', controlId: 'P2P-01' },
  // The same control, tested by a second workflow. Allowed, and flagged,
  // because it usually means the control was split in two and the effort
  // should have been split with it.
  { workflowId: 'wf-po-approval', controlId: 'P2P-01' },
  { workflowId: 'wf-grn-match', controlId: 'P2P-05' },
  { workflowId: 'wf-payroll-dup', controlId: 'HR-02' },
  { workflowId: 'wf-sod', controlId: 'ITGC-04' },
  { workflowId: 'wf-contract', controlId: 'CTR-02' },
];

export const controlsFor = (workflowId: string): ControlRegisterEntry[] =>
  WORKFLOW_CONTROL_MAP
    .filter(m => m.workflowId === workflowId)
    .map(m => CONTROL_BY_ID.get(m.controlId))
    .filter((c): c is ControlRegisterEntry => c !== undefined);

/** Workflows sharing one control, which is worth a second look. */
export function sharedControls(
  extra: WorkflowControlLink[] = [],
): { controlId: string; workflowIds: string[] }[] {
  const seen = new Map<string, string[]>();
  [...WORKFLOW_CONTROL_MAP, ...extra].forEach(m => {
    seen.set(m.controlId, [...(seen.get(m.controlId) ?? []), m.workflowId]);
  });
  return [...seen.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([controlId, workflowIds]) => ({ controlId, workflowIds }));
}

/**
 * The band declared on a workflow definition.
 *
 * Used where no documented control decides it. It sizes the job; it never
 * supplies an effort figure of its own.
 */
export const DECLARED_BAND: Record<string, Band> = {
  'wf-je-anomaly': 'high',
  'wf-payment-flag': 'high',
  'wf-three-way': 'high',
  'wf-po-approval': 'high',
  'wf-grn-match': 'medium',
  'wf-payroll-dup': 'high',
  'wf-sod': 'high',
  'wf-vendor-watch': 'high',
  'wf-dormant': 'medium',
  'wf-credit': 'medium',
  'wf-contract': 'low',
};

/* ──────────────────────────────────────────────────────────────────────────
 * Timed benchmarks
 * ────────────────────────────────────────────────────────────────────────── */

/** A workflow timed by hand, where no control documents it. */
export const WORKFLOW_TIMINGS: Record<string, Timing> = {
  'wf-vendor-watch': timing(
    95, 12, 'vijay.reddy@irame.ai', 70,
    'Twelve auditors pulling the vendor master change log and clearing each change by hand.',
  ),
  // Timed well over a year ago. Still used, and said to be old wherever it
  // lands, because dropping it would leave the work unvalued rather than
  // better valued.
  'wf-dormant': timing(
    48, 7, 'tushar.goel@irame.ai', 400,
    'Timed before the account list moved to the warehouse, so the manual route has changed since.',
  ),
  // Four timings. Recorded, shown, and not used: four people is one slow
  // afternoon away from being wrong, so the workflow stays unvalued.
  'wf-credit': timing(
    65, 4, 'meera.nair@irame.ai', 40,
    'Four timings so far. Needs a fifth before it counts for anything.',
  ),
  // Sits against a documented control and disagrees with it by a wide margin.
  // The document still wins and the gap goes on screen.
  'wf-three-way': timing(
    110, 9, 'ayushi.narang@irame.ai', 52,
    'Nine timings on a sample of forty invoices, scaled to a full run.',
  ),
};

/**
 * What a batch avoids, timed once per workflow.
 *
 * By hand the setup is paid once per instance: opening the file again, keying
 * the parameters again, re orienting, filing the output. In a batch it is paid
 * once. A workflow with no setup timing earns nothing extra for batching, and
 * the page says so rather than showing a nought.
 */
export const SETUP_TIMINGS: Record<string, Timing> = {
  'wf-je-anomaly': timing(
    14, 8, 'abhinav@irame.ai', 58,
    'Opening the ledger extract, keying the period and the entity, filing the output.',
  ),
  'wf-payment-flag': timing(
    11, 6, 'aditya.thakur@irame.ai', 58,
    'Re opening the payment file and re entering the limit for each entity.',
  ),
  'wf-three-way': timing(
    17, 7, 'ayushi.narang@irame.ai', 52,
    'Three files to open and reconcile the headers of before any matching starts.',
  ),
  'wf-vendor-watch': timing(
    9, 5, 'vijay.reddy@irame.ai', 70,
    'Pulling the change log for one vendor group and setting the date window.',
  ),
};

/** Chat, timed once per band. Three sittings, and the whole surface is in scope. */
export const CHAT_TIMINGS: Partial<Record<Band, Timing>> = {
  high: timing(
    74, 6, 'ayushi.narang@irame.ai', 36,
    'Six auditors answering the same multi source question by digging through the files.',
  ),
  medium: timing(
    26, 8, 'tushar.goel@irame.ai', 36,
    'Eight auditors answering a single source question with a lookup by hand.',
  ),
  // Low has not been timed. Low band chat is counted and not valued.
};

/** Files taken in, timed once per band. */
export const INGESTION_TIMINGS: Partial<Record<Band, Timing>> = {
  medium: timing(
    31, 5, 'meera.nair@irame.ai', 44,
    'Five auditors reading a scanned statement and keying its table into a sheet.',
  ),
  low: timing(
    9, 6, 'meera.nair@irame.ai', 44,
    'Six auditors keying a short one page document by hand.',
  ),
  // High has not been timed. Long documents are counted and not valued.
};

/**
 * Government lookups, timed per lookup type.
 *
 * A lookup is a discrete unit of work with a published price on both sides, so
 * once timed this is the most checkable section on the page. Five of the
 * fourteen have been timed. The other nine are counted and not valued: the six
 * minutes a call that an earlier draft used was invented, and it is gone.
 */
export const GOVT_TIMINGS: Record<string, Timing> = {
  pan_basic: timing(
    5, 6, 'meera.nair@irame.ai', 44,
    'Six auditors on the income tax portal, from opening it to copying the name back out.',
  ),
  gst_basic: timing(
    7, 6, 'meera.nair@irame.ai', 44,
    'Six auditors on the GST portal, including the picture puzzle it asks for.',
  ),
  gst_advanced: timing(
    13, 5, 'vijay.reddy@irame.ai', 44,
    'Five auditors pulling the full return history for one number.',
  ),
  passport: timing(
    12, 5, 'vijay.reddy@irame.ai', 44,
    'Five auditors on the passport portal, which is the slowest of the set.',
  ),
  cin_advanced: timing(
    16, 5, 'abhinav@irame.ai', 44,
    'Five auditors pulling the full company record and its directors.',
  ),
};
