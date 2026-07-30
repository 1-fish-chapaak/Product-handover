// ─── External Report Upload → ATR Generation: data model ───
// The wizard extends the existing ATR model (atrTypes.ts) with the extraction-
// layer fields the upload flow needs. `toAtrReportData()` (see toAtrReportData.ts)
// strips these back down to a clean AtrReportData so the existing AtrDocument
// renderer can draw Screen 7 unchanged.

import type { AtrObservation, AtrReportData } from '../atrTypes';
import type { EscalationMatrixConfig } from './escalationMatrix';

/** The seven wizard stages, in order. Drives the stepper + screen router. */
export type WizardStage =
  | 'method'      // Screen 1  — method selection
  | 'template'    // Screen 2A — IRAME template download + upload-filled
  | 'upload'      // Screen 2B — generic report upload
  | 'processing'  // Screen 3  — mocked extraction
  | 'summary'     // Screen 4  — extraction summary & selection
  | 'annexures'   // Screen 5  — annexure linking & confirmation
  | 'decision'    // Screen 6  — generate-only vs manage-exceptions
  | 'preview';    // Screen 7  — ATR preview (reuses AtrDocument)

export type UploadMethod = 'template' | 'report';

export type CompletenessStatus = 'Complete' | 'Partial' | 'Incomplete';

export type MissingFieldState = 'missing' | 'filled-by-user' | 'skipped';

/** The 10 ATR fields that extraction can flag as missing. Mirrors the keys in
 *  atrTemplate.ts REQUIRED_FIELDS so the resolver and the template stay aligned. */
export type ExtractedFieldKey =
  | 'title' | 'description' | 'riskSummary' | 'recommendation'
  | 'actionTaken' | 'evidence' | 'verification'
  | 'classification' | 'risk' | 'dueDate';

export interface MissingField {
  key: ExtractedFieldKey;
  label: string;
  state: MissingFieldState;
  /** Set when the user fills the field manually (state === 'filled-by-user'). */
  value?: string;
}

export interface UploadedFile {
  id: string;
  filename: string;
  /** Lowercased extension (pdf, docx, xlsx, …). */
  ext: string;
  size: number;        // bytes
  uploadedAt: string;  // ISO
  status: 'uploaded' | 'failed';
}

/** One flexible exception row inside an annexure (mirrors the brief's
 *  exception_row: { data: {...flexible JSON} }). */
export interface ExceptionRow {
  id: string;
  annexureId: string;
  data: Record<string, string>;
}

export type AnnexureStatus = 'Confirmed' | 'Needs Review' | 'Unlinked';

export interface ExtractedAnnexure {
  id: string;
  filename: string;
  /** AI-suggested observation link; null = orphan (link manually or remove). */
  observationId: string | null;
  status: AnnexureStatus;
  columns: string[];
  rows: ExceptionRow[];
}

/** A superset of the renderer's AtrObservation carrying the wizard-only fields. */
export interface ExtractedObservation extends AtrObservation {
  id: string;
  number: number;
  completeness: CompletenessStatus;
  selected: boolean;
  confidence: number;            // 0..1, per-observation extraction confidence
  missingFields: MissingField[];
  /** Observation-level due date / timeline (action plans carry their own too). */
  dueDate?: string;
}

export interface ReportMeta {
  reportId: string;
  auditTitle: string;
  auditPeriod: string;
  preparedBy: string;
  generatedOn: string;
  auditEntity: string;
}

export interface ExtractionSession {
  id: string;
  method: UploadMethod | null;
  file: UploadedFile | null;
  annexureFiles: UploadedFile[];
  confidence: number;            // overall extraction confidence 0..1
  startedAt: string | null;
  completedAt: string | null;
  observations: ExtractedObservation[];
  annexures: ExtractedAnnexure[];
  meta: ReportMeta;
  /** Set when the user chooses "Skip Annexures & Proceed" — disables the
   *  Manage-Exceptions path on the decision screen. */
  annexuresSkipped?: boolean;
  /** Escalation matrix configured on the Upload step — governs the reminder /
   *  escalation mailer cadence for every open exception in this report. Defaults
   *  to the standard preset when the user leaves it untouched. */
  escalationMatrix?: EscalationMatrixConfig;
  /** The editable ATR working copy on Screen 7 (persisted so inline edits survive
   *  refresh). Derived from the session on first render if absent. */
  atrDraft?: AtrReportData;
}

export type AtrVersionStatus = 'draft' | 'final';

export interface AtrVersion {
  id: string;
  versionNumber: string;         // "v1.0", "v1.1", "v2.0"
  status: AtrVersionStatus;
  data: AtrReportData;           // snapshot fed to AtrDocument
  generatedAt: string;
  generatedBy: string;
  label?: string;
}

/** The full wizard state — persisted to localStorage for refresh-resume. */
export interface AtrUploadState {
  stage: WizardStage;
  method: UploadMethod | null;
  session: ExtractionSession | null;
  versions: AtrVersion[];
  lastSavedAt: string | null;
}
