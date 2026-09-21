// ─── Mocked AI extraction (no real document parsing) ───
// Builds a realistic ExtractionSession from the existing SAMPLE_OBSERVATIONS /
// SAMPLE_INSIGHTS seed (atrTemplate.ts), then layers on the extraction-flow
// states the brief asks to demo: completeness badges, three observations with
// missing fields, an unlinked annexure, and an orphan annexure.
//
// The 5 seeded observations mirror the IRAME.AI brand sample exactly; a 6th,
// deliberately incomplete observation is appended to exercise the
// "Incomplete" badge + missing-field resolution flow.

import { SAMPLE_OBSERVATIONS, SAMPLE_INSIGHTS } from '../atrTemplate';
import type {
  ExtractedObservation, ExtractedAnnexure, ExceptionRow, ExtractionSession,
  MissingField, ReportMeta, UploadedFile, CompletenessStatus,
} from './types';
import { OBSERVATION_FIELDS, getFieldValue } from './observationFields';
import { type EscalationMatrixSet, cloneDefaultMatrixSet } from './escalationMatrix';

// Status stages shown on Screen 3's in-modal waiting screen. Paced across the
// full mock duration (~15s) so each stage is visible for a couple of seconds
// and the wait never feels stalled.
export const PROCESSING_MESSAGES = [
  'Reading your report…',
  'Detecting document structure…',
  'Identifying observations…',
  'Extracting risks & recommendations…',
  'Extracting action plans…',
  'Linking evidence…',
  'Mapping annexures…',
  'Finalizing the extraction…',
];
export const PROCESSING_DURATION_MS = 6000;

// Report metadata — matches the IRAME.AI brand sample in the brief.
const SEED_META: ReportMeta = {
  reportId: 'ATR-2025-Q3-001',
  reportName: 'Q3 FY24-25 — Procurement, Inventory & Dispatch ATR',
  financialYear: 'FY 2024-25',
  region: 'North',
  location: 'Delhi',
  auditFunction: 'SCM',
  auditSpoc: 'Karan Mehta',
  auditTitle: 'Procurement, Inventory & Dispatch Process A',
  auditPeriod: 'Q3 FY 2024-25',
  preparedBy: 'Internal Audit Team (HT Consulting Ltd)',
  generatedOn: '14 May 2026',
  auditEntity: 'ABC Manufacturing Cements Ltd',
};

const FIELD_LABEL: Record<MissingField['key'], string> = {
  title: 'Observation Title',
  description: 'Observation Description',
  rootCause: 'Root Cause',
  solutionType: 'Solution Type',
  riskSummary: 'Risk Summary',
  riskImplications: 'Risk Implications',
  riskImplicationsDetails: 'Risk Implication Details',
  recommendation: 'Recommendation / Action Plan',
  actionTaken: 'Action Taken',
  evidence: 'Evidence',
  verification: 'Management Comments / Auditor Verification',
  classification: 'Classification',
  risk: 'Risk Significance',
  dueDate: 'Due Date / Timeline',
};

const missing = (key: MissingField['key']): MissingField => ({ key, label: FIELD_LABEL[key], state: 'missing' });

function completenessFrom(fields: MissingField[], hasTitle: boolean): CompletenessStatus {
  if (!hasTitle || fields.some(f => f.key === 'title')) return 'Incomplete';
  return fields.length === 0 ? 'Complete' : 'Partial';
}

// Any extractable field that came back empty is treated as "not extracted" and
// flagged Missing, so the card offers the Fill in / Skip resolver for it.
function computeMissing(o: ExtractedObservation): MissingField[] {
  return OBSERVATION_FIELDS.filter(f => !getFieldValue(o, f.key).trim()).map(f => missing(f.key));
}

// Per-observation overrides keyed by index into SAMPLE_OBSERVATIONS — confidence,
// plus which values to strip so they read as "not extracted" (Missing).
const OBS_OVERRIDES: Array<{ confidence: number; stripRiskSummary?: boolean }> = [
  { confidence: 0.97 },                                 // 1 Vendor Master — Complete
  { confidence: 0.94 },                                 // 2 Three-Way Match — Complete
  { confidence: 0.81, stripRiskSummary: true },         // 3 Freight Rate — Risk Summary not extracted
  { confidence: 0.88 },                                 // 4 Stock Variance — Risk Implication Details not extracted (below)
  { confidence: 0.96 },                                 // 5 Scrap Sale — Complete
];

// Seeded audit-analysis values for the new observation fields, so they read as
// "extracted" (the user can still change them via the dropdowns).
const ROOT_CAUSES = ['Operating Design', 'Technology', 'People Effectiveness', 'Organization Design', 'Operating Design'];
const SOLUTION_TYPES = ['Systemic', 'Systemic', 'Incident', 'Systemic', 'Incident'];
const RISK_IMPLICATIONS = ['Financial', 'Operational', 'Financial', 'Operational', 'Potential of Fraud'];
const RISK_IMPL_DETAILS = [
  'Vendors were activated without complete statutory documents, exposing the company to non-compliant spend and blocked input-tax credit.',
  'Tolerance overrides bypassed the three-way match, allowing over-billing to pass unchecked.',
  'Freight rates applied outside the approved matrix inflated logistics cost against budget.',
  '', // 4 Stock Variance — not extracted, so the card offers an "add details" text box
  'Scrap sold below the approved floor rate suggests possible collusion / value leakage.',
];

function buildObservations(): ExtractedObservation[] {
  const obs: ExtractedObservation[] = SAMPLE_OBSERVATIONS.map((o, i) => {
    const ov = OBS_OVERRIDES[i];
    const base: ExtractedObservation = {
      ...o,
      // Strip a value here and there so it reads as "not extracted" (Missing).
      riskSummary: ov.stripRiskSummary ? undefined : o.riskSummary,
      rootCause: ROOT_CAUSES[i % ROOT_CAUSES.length],
      solutionType: SOLUTION_TYPES[i % SOLUTION_TYPES.length],
      riskImplications: RISK_IMPLICATIONS[i % RISK_IMPLICATIONS.length],
      riskImplicationsDetails: RISK_IMPL_DETAILS[i % RISK_IMPL_DETAILS.length],
      id: `obs-${i + 1}`,
      number: i + 1,
      confidence: ov.confidence,
      missingFields: [],
      completeness: 'Complete',
      selected: true,
      dueDate: o.actionPlans[0]?.dueDate,
    };
    const missingFields = computeMissing(base);
    return { ...base, missingFields, completeness: completenessFrom(missingFields, !!base.title?.trim()) };
  });

  // 6th observation — deliberately incomplete (Title + Risk Summary not
  // extracted) to exercise the "Incomplete" badge and the Fill / Skip flow.
  const obs6: ExtractedObservation = {
    id: 'obs-6',
    number: 6,
    title: '',
    process: 'Procurement (P2P)',
    risk: 'Medium',
    status: 'Open',
    classification: 'Procedural Non-Compliance',
    rootCause: 'Operating Design',
    solutionType: 'Systemic',
    riskImplications: 'Potential of Fraud',
    riskImplicationsDetails: 'Back-dated PO creation can conceal unauthorised or after-the-fact purchases.',
    description: 'Purchase orders were raised in three instances after the goods receipt date, suggesting back-dated PO creation. Extraction could not confidently recover the observation title.',
    querySummary: 'Review of PO creation timestamps against goods-receipt postings.',
    exceptions: 3,
    confidence: 0.52,
    missingFields: [],
    completeness: 'Complete',
    selected: true,
    actionPlans: [
      {
        title: 'Block back-dated PO creation',
        text: 'Configure SAP to block PO creation with a document date earlier than the goods-receipt date, with Finance Manager override only.',
        dueDate: '30 Jun 2026',
        status: 'Pending',
        evidence: 'Draft functional spec circulated.',
        verification: 'Open — implementation not yet started.',
      },
    ],
  };
  const obs6Missing = computeMissing(obs6);
  obs.push({ ...obs6, missingFields: obs6Missing, completeness: completenessFrom(obs6Missing, false) });

  return obs;
}

function rows(annexureId: string, data: Record<string, string>[]): ExceptionRow[] {
  return data.map((d, i) => ({ id: `${annexureId}-r${i + 1}`, annexureId, data: d }));
}

function buildAnnexures(): ExtractedAnnexure[] {
  return [
    {
      id: 'ax-vendor',
      filename: 'vendor_master_exceptions.xlsx',
      observationId: 'obs-1',
      status: 'Confirmed',
      columns: ['Vendor Code', 'Vendor Name', 'Activated On', 'Missing Docs', 'Aggregate ₹'],
      rows: rows('ax-vendor', [
        { 'Vendor Code': 'V-10241', 'Vendor Name': 'Sri Balaji Traders', 'Activated On': '04 Jul 2024', 'Missing Docs': 'PAN, GST', 'Aggregate ₹': '18,40,000' },
        { 'Vendor Code': 'V-10255', 'Vendor Name': 'Konark Logistics', 'Activated On': '11 Jul 2024', 'Missing Docs': 'MSME, Bank letter', 'Aggregate ₹': '6,20,000' },
        { 'Vendor Code': 'V-10262', 'Vendor Name': 'Apex Minerals', 'Activated On': '19 Jul 2024', 'Missing Docs': 'GST', 'Aggregate ₹': '21,75,000' },
      ]),
    },
    {
      id: 'ax-3way',
      filename: 'three_way_match_exceptions.xlsx',
      observationId: 'obs-2',
      status: 'Confirmed',
      columns: ['Invoice', 'PO', 'GRN', 'Tolerance %', 'Override By'],
      rows: rows('ax-3way', [
        { 'Invoice': 'INV-88213', 'PO': 'PO-44120', 'GRN': 'GRN-77011', 'Tolerance %': '4.2', 'Override By': 'r.menon' },
        { 'Invoice': 'INV-88240', 'PO': 'PO-44155', 'GRN': 'GRN-77039', 'Tolerance %': '6.8', 'Override By': 's.iyer' },
      ]),
    },
    {
      // Linked but flagged Needs Review to demo Screen 5's mixed states.
      id: 'ax-freight',
      filename: 'freight_rate_exceptions.xlsx',
      observationId: 'obs-3',
      status: 'Needs Review',
      columns: ['Dispatch Lot', 'Transporter', 'Rate Approved On', 'Impact ₹'],
      rows: rows('ax-freight', [
        { 'Dispatch Lot': 'DL-0917', 'Transporter': 'Veer Roadways', 'Rate Approved On': 'Post-dispatch', 'Impact ₹': '2,90,000' },
        { 'Dispatch Lot': 'DL-0928', 'Transporter': 'Shakti Carriers', 'Rate Approved On': 'Post-dispatch', 'Impact ₹': '1,80,000' },
      ]),
    },
    {
      id: 'ax-scrap',
      filename: 'scrap_sale_exceptions.xlsx',
      observationId: 'obs-5',
      status: 'Confirmed',
      columns: ['Instance', 'Approved Rate ₹', 'Gate-pass Qty', 'Invoice Qty', 'Under-recovery ₹'],
      rows: rows('ax-scrap', [
        { 'Instance': 'SCR-03', 'Approved Rate ₹': '24.50', 'Gate-pass Qty': '12,400', 'Invoice Qty': '11,900', 'Under-recovery ₹': '42,000' },
        { 'Instance': 'SCR-06', 'Approved Rate ₹': '24.50', 'Gate-pass Qty': '9,800', 'Invoice Qty': '9,500', 'Under-recovery ₹': '31,500' },
        { 'Instance': 'SCR-08', 'Approved Rate ₹': '24.50', 'Gate-pass Qty': '7,200', 'Invoice Qty': '7,050', 'Under-recovery ₹': '46,500' },
      ]),
    },
    {
      // obs-4 Stock Variance — physical-vs-book count exceptions.
      id: 'ax-stock',
      filename: 'stock_variance_exceptions.xlsx',
      observationId: 'obs-4',
      status: 'Confirmed',
      columns: ['SKU', 'Location', 'Book Qty', 'Physical Qty', 'Variance', 'Value ₹'],
      rows: rows('ax-stock', [
        { 'SKU': 'RM-CLK-220', 'Location': 'Plant-2 Store A', 'Book Qty': '4,800', 'Physical Qty': '4,610', 'Variance': '-190', 'Value ₹': '1,14,000' },
        { 'SKU': 'RM-GYP-118', 'Location': 'Plant-2 Store B', 'Book Qty': '2,200', 'Physical Qty': '2,275', 'Variance': '+75', 'Value ₹': '37,500' },
        { 'SKU': 'PKG-BAG-50', 'Location': 'Dispatch Yard', 'Book Qty': '18,000', 'Physical Qty': '17,640', 'Variance': '-360', 'Value ₹': '54,000' },
      ]),
    },
    {
      // obs-6 Back-dated PO creation — three flagged purchase orders.
      id: 'ax-poback',
      filename: 'backdated_po_exceptions.xlsx',
      observationId: 'obs-6',
      status: 'Confirmed',
      columns: ['PO Number', 'PO Date', 'GRN Date', 'Vendor', 'Amount ₹'],
      rows: rows('ax-poback', [
        { 'PO Number': 'PO-44918', 'PO Date': '12 Aug 2024', 'GRN Date': '07 Aug 2024', 'Vendor': 'Sri Balaji Traders', 'Amount ₹': '3,40,000' },
        { 'PO Number': 'PO-44972', 'PO Date': '19 Aug 2024', 'GRN Date': '14 Aug 2024', 'Vendor': 'Konark Logistics', 'Amount ₹': '1,95,000' },
        { 'PO Number': 'PO-45003', 'PO Date': '02 Sep 2024', 'GRN Date': '28 Aug 2024', 'Vendor': 'Apex Minerals', 'Amount ₹': '2,60,000' },
      ]),
    },
    {
      // Orphan annexure — AI could not link it. Demonstrates the orphan edge case.
      id: 'ax-orphan',
      filename: 'misc_gate_register.xlsx',
      observationId: null,
      status: 'Unlinked',
      columns: ['Entry', 'Gate', 'Vehicle', 'Remark'],
      rows: rows('ax-orphan', [
        { 'Entry': 'GR-5521', 'Gate': 'Plant-2 North', 'Vehicle': 'TN-38-AB-1199', 'Remark': 'Manual register entry' },
      ]),
    },
  ];
}

/** Insights for Screen 7 — reuse the existing auditor commentary seed. */
export const SEED_INSIGHTS = SAMPLE_INSIGHTS;

/** Build a fresh extraction session for a just-uploaded file. The user-entered
 *  report details (audit title, entity, period, prepared-by, generated-on) come
 *  in as `metaOverrides` and replace the seed values; Report ID stays seeded. */
export function seedSession(file: UploadedFile | null, method: ExtractionSession['method'], annexureFiles: UploadedFile[] = [], metaOverrides?: Partial<ReportMeta>, escalationMatrix?: EscalationMatrixSet): ExtractionSession {
  return {
    id: `xs-${Date.now()}`,
    method,
    file,
    annexureFiles,
    confidence: 0.92,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    observations: buildObservations(),
    annexures: buildAnnexures(),
    meta: { ...SEED_META, ...metaOverrides },
    escalationMatrix: escalationMatrix ?? cloneDefaultMatrixSet(),
  };
}

/** The zero-observations edge case (Screen 4 empty state). */
export function seedEmptySession(file: UploadedFile | null, method: ExtractionSession['method'], metaOverrides?: Partial<ReportMeta>, escalationMatrix?: EscalationMatrixSet): ExtractionSession {
  return {
    id: `xs-${Date.now()}`,
    method,
    file,
    annexureFiles: [],
    confidence: 0,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    observations: [],
    annexures: [],
    meta: { ...SEED_META, ...metaOverrides },
    escalationMatrix: escalationMatrix ?? cloneDefaultMatrixSet(),
  };
}
