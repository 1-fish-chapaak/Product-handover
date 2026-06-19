// ─── Standard ATR (Action Taken Report) data model ───
// Mirrors the comprehensive format in ATR_Comprehensive_Sample.pdf. Every field
// below the required core is optional so the renderer can omit anything missing.

export type AtrRisk = 'High' | 'Medium' | 'Low';
export type AtrClassification =
  | 'Design Deficiency'
  | 'System Deficiency'
  | 'Procedural Non-Compliance';
export type AtrObservationStatus = 'Closed' | 'In Progress' | 'Open' | 'Overdue';
export type AtrActionStatus =
  | 'Implemented'
  | 'Partially Implemented'
  | 'Pending'
  | 'Overdue'
  | 'Not Due';

export interface AtrActionPlan {
  /** Short title for the management action plan. */
  title?: string;
  /** Recommendation / management action plan text. */
  text: string;
  dueDate?: string;                 // ISO or free text (e.g. "30 Jun 2026")
  status?: AtrActionStatus;
  /** What the risk owner actually did to remediate (shown before Evidence). */
  actionTaken?: string;
  /** Evidence / comments backing the action. */
  evidence?: string;
  /** Management comments or checker / auditor verification. */
  verification?: string;
}

export interface AtrObservation {
  title: string;
  /** Audited process / area — drives the Process-Wise Summary when present. */
  process?: string;
  /** Observation / issue description. */
  description?: string;
  /** Optional one-line query summary. */
  querySummary?: string;
  riskSummary?: string;
  classification?: AtrClassification;
  risk?: AtrRisk;
  status?: AtrObservationStatus;
  /** Number of underlying flagged exceptions that roll up into this observation. */
  exceptions?: number;
  actionPlans: AtrActionPlan[];
}

export interface AtrInsight {
  title: string;
  body: string;
}

export interface AtrMeta {
  reportId: string;
  auditTitle?: string;
  auditPeriod?: string;
  preparedBy?: string;
  /** Reviewer name — surfaces in the Approvals & Sign-Off "Reviewed by" block. */
  reviewedBy?: string;
  generatedOn?: string;
  auditEntity?: string;
  /** Optional override for the Total Exceptions KPI (else summed from observations). */
  totalExceptions?: number;
  /** Customize: brand accent (hex) applied to the cover banner. */
  brandColor?: string;
  /** Customize: company logo (data URL) shown on the cover/header. */
  logoDataUrl?: string;
}

/** Everything needed to re-render a generated ATR as a saved report. Stored on
 *  a GeneratedReport (`atrData`) when the user clicks "Add to Report". */
export interface AtrReportData {
  meta: AtrMeta;
  observations: AtrObservation[];
  insights: AtrInsight[];
}
