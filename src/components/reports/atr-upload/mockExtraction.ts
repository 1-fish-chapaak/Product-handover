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

// Status messages cycled on Screen 3 (every 1.5s). Total mock duration 6–8s.
export const PROCESSING_MESSAGES = [
  'Reading your report…',
  'Identifying observations…',
  'Extracting action plans…',
  'Mapping annexures…',
  'Almost there…',
];
export const PROCESSING_DURATION_MS = 7000;

// Report metadata — matches the IRAME.AI brand sample in the brief.
const SEED_META: ReportMeta = {
  reportId: 'ATR-2025-Q3-001',
  auditTitle: 'Procurement, Inventory & Dispatch Process A',
  auditPeriod: 'Q3 FY 2024-25',
  preparedBy: 'Internal Audit Team (HT Consulting Ltd)',
  generatedOn: '14 May 2026',
  auditEntity: 'ABC Manufacturing Cements Ltd',
};

const FIELD_LABEL: Record<MissingField['key'], string> = {
  title: 'Observation Title',
  description: 'Observation Description',
  riskSummary: 'Risk Summary',
  recommendation: 'Recommendation / Management Action Plan',
  actionTaken: 'Action Taken',
  evidence: 'Evidence',
  verification: 'Management Comments / Auditor Verification',
  classification: 'Classification',
  risk: 'Risk Significance',
  dueDate: 'Due Date / Timeline',
};

const missing = (key: MissingField['key']): MissingField => ({ key, label: FIELD_LABEL[key], state: 'missing' });

function completenessFrom(fields: MissingField[], hasTitle: boolean): CompletenessStatus {
  if (!hasTitle || fields.some(f => f.key === 'title' || f.key === 'actionTaken')) return 'Incomplete';
  return fields.length === 0 ? 'Complete' : 'Partial';
}

// Per-observation overrides keyed by index into SAMPLE_OBSERVATIONS. This is
// where we inject the missing-field demos without mutating the shared seed.
const OBS_OVERRIDES: Array<{ confidence: number; missing: MissingField['key'][]; stripRiskSummary?: boolean }> = [
  { confidence: 0.97, missing: [] },                            // 1 Vendor Master — Complete
  { confidence: 0.94, missing: [] },                            // 2 Three-Way Match — Complete
  { confidence: 0.81, missing: ['riskSummary'], stripRiskSummary: true }, // 3 Freight Rate — Partial
  { confidence: 0.88, missing: ['evidence'] },                  // 4 Stock Variance — Partial
  { confidence: 0.96, missing: [] },                            // 5 Scrap Sale — Complete
];

function buildObservations(): ExtractedObservation[] {
  const obs: ExtractedObservation[] = SAMPLE_OBSERVATIONS.map((o, i) => {
    const ov = OBS_OVERRIDES[i];
    const missingFields = ov.missing.map(missing);
    return {
      ...o,
      // Demonstrate the missing-field flow: strip the value the resolver fills.
      riskSummary: ov.stripRiskSummary ? undefined : o.riskSummary,
      id: `obs-${i + 1}`,
      number: i + 1,
      confidence: ov.confidence,
      missingFields,
      completeness: completenessFrom(missingFields, true),
      selected: true,
      dueDate: o.actionPlans[0]?.dueDate,
    };
  });

  // 6th observation — deliberately incomplete (missing Title + Action Taken) to
  // exercise the "Incomplete" badge and the Fill / Skip resolution flow.
  const incompleteMissing = [missing('title'), missing('actionTaken')];
  obs.push({
    id: 'obs-6',
    number: 6,
    title: '',
    process: 'Procurement (P2P)',
    risk: 'Medium',
    status: 'Open',
    classification: 'Procedural Non-Compliance',
    description: 'Purchase orders were raised in three instances after the goods receipt date, suggesting back-dated PO creation. Extraction could not confidently recover the observation title or the action taken.',
    querySummary: 'Review of PO creation timestamps against goods-receipt postings.',
    exceptions: 3,
    confidence: 0.52,
    missingFields: incompleteMissing,
    completeness: completenessFrom(incompleteMissing, false),
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
  });

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
export function seedSession(file: UploadedFile | null, method: ExtractionSession['method'], annexureFiles: UploadedFile[] = [], metaOverrides?: Partial<ReportMeta>): ExtractionSession {
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
  };
}

/** The zero-observations edge case (Screen 4 empty state). */
export function seedEmptySession(file: UploadedFile | null, method: ExtractionSession['method'], metaOverrides?: Partial<ReportMeta>): ExtractionSession {
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
  };
}
