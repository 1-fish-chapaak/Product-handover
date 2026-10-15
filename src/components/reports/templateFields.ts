// What a report template can carry — one catalogue, read by both surfaces that
// draw a template: the editor's live preview and the read-only Template sheet.
//
// Kept apart from either of them on purpose. The two drew the same report from
// two lists once, and the list the editor ticked was not the list the sheet
// printed.
//
// Several fields here have no key in the extraction catalogue (the action
// plan's own title and status, a revised due date, who is responsible) and the
// report prints them in an order that catalogue does not hold, so the lists are
// written out rather than derived. Where a key does overlap, the label comes
// from the catalogue, so a template and an extraction still mean the same thing.

import { BUILTIN_REPORT_FIELDS, AUTO_REPORT_FIELDS } from './atr-upload/reportFields';
import { OBSERVATION_FIELDS } from './atr-upload/observationFields';

/** The standard fields on offer, split by where they print. Both lists are the
 *  platform's own catalogues, so the editor cannot drift from what a report
 *  actually carries. */
/** Labels the report uses where they read wider than the extraction
 *  catalogue's. Overridden here rather than in the catalogue, which the upload
 *  flow shares. */
export const HEADER_LABELS: Record<string, string> = { auditFunction: 'Function / Department' };

export const HEADER_FIELD_CHOICES = [
  ...BUILTIN_REPORT_FIELDS.map(f => ({ key: f.key as string, label: HEADER_LABELS[f.key] ?? f.label, note: f.note })),
  ...AUTO_REPORT_FIELDS.map(f => ({ key: f.key, label: f.label, note: f.note })),
];
/** What an observation carries, in the order the Action Taken Report prints it.
 *  Built explicitly rather than from OBSERVATION_FIELDS: the report carries
 *  several fields the extraction catalogue has no key for (the action plan's own
 *  title and status, a revised due date, who is responsible), and it prints them
 *  in a reading order the catalogue does not hold. Keys that do overlap keep the
 *  catalogue's, so a template and an extraction still mean the same thing. */
export const OBS_LABEL = (key: string, fallback: string) =>
  OBSERVATION_FIELDS.find(f => (f.key as string) === key)?.label ?? fallback;

export const BODY_FIELD_CHOICES: { key: string; label: string; note?: string }[] = [
  { key: 'title', label: OBS_LABEL('title', 'Observation Title') },
  { key: 'description', label: OBS_LABEL('description', 'Observation Description') },
  { key: 'observationStatus', label: 'Observation Status' },
  { key: 'rootCause', label: OBS_LABEL('rootCause', 'Root Cause') },
  { key: 'solutionType', label: OBS_LABEL('solutionType', 'Solution Type') },
  { key: 'riskImplications', label: OBS_LABEL('riskImplications', 'Risk Implications') },
  { key: 'riskImplicationsDetails', label: OBS_LABEL('riskImplicationsDetails', 'Risk Implication Details') },
  { key: 'risk', label: 'Risk Significance / Risk Rating' },
  { key: 'classification', label: 'Classification / Nature of Issue' },
  { key: 'responsibility', label: 'Responsibility (Name / Designation)' },
  { key: 'actionPlanTitle', label: 'Action Plan Title' },
  { key: 'actionTakenStatus', label: 'Action Taken Status' },
  { key: 'recommendation', label: OBS_LABEL('recommendation', 'Recommendation / Action Plan') },
  { key: 'actionTaken', label: 'Action Taken' },
  { key: 'dueDate', label: OBS_LABEL('dueDate', 'Due Date / Timeline') },
  { key: 'revisedDueDate', label: 'Revised Due Date / Timeline' },
  { key: 'verification', label: OBS_LABEL('verification', 'Management Comments / Auditor Verification') },
];

/** Executive Summary — the rollup tiles, with the figure each one shows. */
export const KPI_CHOICES: { key: string; label: string; note?: string; value: string; tone: string }[] = [
  { key: 'observations', label: 'Observations', value: '6', tone: 'text-brand-700' },
  { key: 'obsOpen', label: 'Observations open', value: '3', tone: 'text-high-700' },
  { key: 'obsPartial', label: 'Observations partially closed', value: '2', tone: 'text-mitigated-700' },
  { key: 'obsClosed', label: 'Observations closed', value: '1', tone: 'text-compliant-700' },
  { key: 'actionPlans', label: 'Action plans', value: '13', tone: 'text-brand-700' },
  { key: 'plansOverdue', label: 'Action plans overdue', value: '1', tone: 'text-risk-700' },
];

/** Observation Wise Summary — the columns beside the observation's own name,
 *  which is the row and so is always there. */
export const SUMMARY_COLUMN_CHOICES: { key: string; label: string; note?: string }[] = [
  { key: 'plans', label: 'Plans', note: 'Total action plans on the observation' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
];

/** The sample row behind the summary table, by column. */
export const SAMPLE_ROWS: { title: string; process: string; cells: Record<string, string>; sev: [string, string]; status: [string, string] }[] = [
  { title: 'Vendor Master Management', process: 'Procurement (P2P)', cells: { plans: '4', open: '2', closed: '2', overdue: '0' }, sev: ['High', 'bg-high-50 text-high-700'], status: ['Partially Closed', 'bg-mitigated-50 text-mitigated-700'] },
  { title: 'Three-Way Match Bypass in Procurement', process: 'Procurement (P2P)', cells: { plans: '3', open: '2', closed: '1', overdue: '0' }, sev: ['Medium', 'bg-mitigated-50 text-mitigated-700'], status: ['Partially Closed', 'bg-mitigated-50 text-mitigated-700'] },
  { title: 'Freight Rate Approval Gap', process: 'Dispatch & Logistics', cells: { plans: '2', open: '1', closed: '0', overdue: '1' }, sev: ['Critical', 'bg-risk-50 text-risk-700'], status: ['Open', 'bg-high-50 text-high-700'] },
];
export const CELL_TONE: Record<string, string> = { plans: 'text-ink-800', open: 'text-high-700', closed: 'text-compliant-700', overdue: 'text-risk-700' };

/** What a template carries before anyone touches step 1 — exactly the fields an
 *  Action Taken Report prints today. A ticked box means "in the report", so the
 *  defaults have to match what the preview actually shows, not every field on
 *  offer. The rest are there to be added. */
export const DEFAULT_HEADER_FIELDS = ['reportName', 'auditTitle', 'auditEntity', 'auditPeriod', 'financialYear', 'auditSpoc'];
export const DEFAULT_BODY_FIELDS = [
  'title', 'description', 'observationStatus', 'risk', 'classification', 'responsibility',
  'actionPlanTitle', 'actionTakenStatus', 'recommendation', 'actionTaken', 'dueDate',
  'revisedDueDate', 'verification',
];
export const DEFAULT_KPI_FIELDS = KPI_CHOICES.map(k => k.key);
export const DEFAULT_SUMMARY_COLUMNS = SUMMARY_COLUMN_CHOICES.map(c => c.key);

/** Stand-in values so the preview reads as a report rather than a form. They are
 *  never saved — the template stores which fields it carries, not their values. */
export const SAMPLE_HEADER: Record<string, string> = {
  reportName: 'FY 2026-27 Procure-to-Pay Internal Audit',
  auditTitle: 'Procure-to-Pay & Vendor Master Controls',
  auditEntity: 'Northstar Manufacturing Ltd',
  auditFunction: 'Procurement & Accounts Payable',
  section: 'Internal Audit',
  reviewType: 'Depth review',
  auditLocation: 'Corporate & Plant',
  region: 'West',
  location: 'Mumbai',
  reportNumber: 'IA/2026-27/014',
  auditPeriod: '01 Apr 2026 – 30 Sep 2026',
  preparedBy: 'Internal Audit — P2P Team',
  financialYear: 'FY 2026-27',
  auditSpoc: 'Nilesh Anand',
  generatedOn: '06 Oct 2026',
};
export const SAMPLE_BODY: Record<string, string> = {
  title: 'Duplicate invoice payments to vendors',
  description: 'Three-way match between purchase order, goods receipt and invoice was not enforced for PO-based invoices. Seven invoices were posted twice across the review period.',
  rootCause: 'Operating Design',
  solutionType: 'Systemic',
  riskImplications: 'Financial',
  riskImplicationsDetails: 'Overpayment to vendors and understated payables at period close; recovery depends on vendor cooperation.',
  observationStatus: 'Partially Closed',
  risk: 'High',
  classification: 'System Deficiency',
  responsibility: 'Karan Mehta — Manager, Accounts Payable',
  actionPlanTitle: 'Enforce three-way match in ERP before payment release',
  actionTakenStatus: 'Partially Implemented',
  actionTaken: 'Three-way match switched on in SAP MM for all PO-based invoices; tolerance set to 0% on quantity. Vendor recovery notices issued for four of the seven invoices.',
  revisedDueDate: '31 Jan 2027',
  recommendation: 'Enable the mandatory three-way match block in SAP MM for all PO-based invoices, with tolerance set to 0% on quantity.',
  dueDate: '30 Nov 2026',
  verification: 'Configuration export attached and the seven flagged invoices re-run — all now block at posting.',
};


/** Is this template the Action Taken Report, or a copy of one? Only the ATR has
 *  a fixed shape the platform knows how to draw — every other template is a set
 *  of sections its author wrote, and must keep being drawn that way.
 *
 *  A copy duplicated today records `baseId`, so a rename cannot change what it
 *  is. Copies made before that field existed carry only the name and
 *  description over, which is what the fallback reads. */
export const isAtrTemplate = (t: { id?: string; baseId?: string; name?: string; desc?: string }): boolean =>
  t.baseId === 'rt-007'
  || (!t.baseId && (
    t.id === 'rt-007'
    || /\bATR\b/i.test(t.name ?? '')
    || /action taken report/i.test(t.desc ?? '')
  ));

/** The shape every surface needs to answer "what does this template carry?" —
 *  satisfied by `EditableTemplate` and by the standard entries in
 *  REPORT_TEMPLATES alike, so none of them has to import the other. */
export interface TemplateFieldSource {
  id?: string;
  baseId?: string;
  name?: string;
  desc?: string;
  headerFields?: string[];
  kpiFields?: string[];
  summaryColumns?: string[];
  bodyFields?: string[];
}

/** What a template says it prints, or `null` for "it has no opinion".
 *
 *  `null` is not the same as an empty list. A format built by ticking boxes in
 *  the editor carries an explicit list, and a report made from it prints that
 *  list and nothing else — that is the whole point of the step. A format that
 *  predates the step, or the untouched standard ATR, carries no list at all,
 *  and those reports must keep printing whatever they happen to hold. So every
 *  consumer treats `null` as "do not filter" rather than defaulting it. */
const selection = (list: string[] | undefined): string[] | null =>
  Array.isArray(list) ? list : null;

export const templateHeaderFields = (t?: TemplateFieldSource | null): string[] | null => selection(t?.headerFields);
export const templateBodyFields = (t?: TemplateFieldSource | null): string[] | null => selection(t?.bodyFields);
export const templateKpiFields = (t?: TemplateFieldSource | null): string[] | null => selection(t?.kpiFields);
export const templateSummaryColumns = (t?: TemplateFieldSource | null): string[] | null => selection(t?.summaryColumns);

/** Does this template print `key`? True when the template has no opinion. */
export const templateCarries = (list: string[] | null, key: string): boolean => list === null || list.includes(key);
