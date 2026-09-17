// ─── Report-details field catalogue ───
// The cover-details form (ReportDetailsForm) and the opened report's header
// (EditableReportHeader) are driven from this catalogue plus the admin-managed
// config in adminStore: which fields are mandatory, and any custom fields the
// organisation has added. Built-in fields map onto ReportMeta keys; custom
// fields live in `ReportMeta.custom[key]`.

export type ReportFieldType = 'text' | 'select' | 'date' | 'number';

/** A built-in cover field. `lovKey` names its list of values when it's a dropdown. */
export interface BuiltinReportField {
  key: 'reportName' | 'auditTitle' | 'auditEntity' | 'auditFunction' | 'section' | 'reviewType' | 'auditLocation'
    | 'region' | 'location' | 'reportNumber' | 'auditPeriod' | 'preparedBy';
  label: string;
  type: 'text' | 'select' | 'daterange';
  lovKey?: string;
  placeholder?: string;
  /** Mandatory out of the box (admins can change it unless `lockedRequired`). */
  defaultRequired: boolean;
  /** Always mandatory — the platform needs it (e.g. the title names the report). */
  lockedRequired?: boolean;
  /** Short reason shown in the admin UI. */
  note?: string;
}

/** A field an admin added. Dropdown values live in the LOV store under `key`. */
export interface CustomReportField {
  key: string;
  label: string;
  type: ReportFieldType;
  required: boolean;
  placeholder?: string;
}

export const BUILTIN_REPORT_FIELDS: BuiltinReportField[] = [
  { key: 'reportName',    label: 'Report Name',     type: 'text',      placeholder: 'Auto-filled from the uploaded file',   defaultRequired: true, lockedRequired: true, note: 'Names the extracted report and its ATR' },
  { key: 'auditTitle',    label: 'Audit Title',     type: 'text',      placeholder: 'e.g. Procurement & Dispatch Process', defaultRequired: true },
  { key: 'auditEntity',   label: 'Audit Entity',    type: 'text',      placeholder: 'e.g. ABC Manufacturing Ltd',          defaultRequired: true },
  { key: 'auditFunction', label: 'Function',        type: 'select',    lovKey: 'function',      defaultRequired: true },
  { key: 'section',       label: 'Section',         type: 'select',    lovKey: 'section',       defaultRequired: false, note: 'Scopes Report Number uniqueness' },
  { key: 'reviewType',    label: 'Review type',     type: 'select',    lovKey: 'reviewType',    defaultRequired: false },
  { key: 'auditLocation', label: 'Audit location',  type: 'select',    lovKey: 'auditLocation', defaultRequired: false },
  { key: 'region',        label: 'Region',          type: 'select',    lovKey: 'region',        defaultRequired: false },
  { key: 'location',      label: 'Location (City)', type: 'select',    lovKey: 'location',      defaultRequired: false },
  { key: 'reportNumber',  label: 'Report Number',   type: 'text',      placeholder: 'e.g. IA/2025-26/003',                 defaultRequired: false },
  { key: 'auditPeriod',   label: 'Audit Period',    type: 'daterange', defaultRequired: true, note: 'Derives the Financial Year' },
  { key: 'preparedBy',    label: 'Prepared By',     type: 'text',      placeholder: 'e.g. Internal Audit Team',            defaultRequired: false },
];

/** Fields the platform fills itself — listed in the admin UI for completeness,
 *  never editable and never toggled. */
export const AUTO_REPORT_FIELDS: { key: string; label: string; note: string }[] = [
  { key: 'financialYear', label: 'Financial Year', note: 'Derived from the Audit Period' },
  { key: 'auditSpoc',     label: 'Audit SPOC',     note: 'The signed-in user creating the report' },
  { key: 'generatedOn',   label: 'Generated On',   note: 'Set when the report is created' },
];

export const REPORT_FIELD_TYPE_LABEL: Record<ReportFieldType, string> = {
  text: 'Text', select: 'Dropdown', date: 'Date', number: 'Number',
};

/** Admin config: per-field mandatory overrides, hidden fields, and the custom
 *  fields. A hidden field is left off the report-details form and the opened
 *  report's header entirely (and is never required). */
export interface ReportFieldsConfig {
  required: Record<string, boolean>;
  hidden: Record<string, boolean>;
  custom: CustomReportField[];
}

export const DEFAULT_REPORT_FIELDS_CONFIG: ReportFieldsConfig = { required: {}, hidden: {}, custom: [] };

/** Whether a built-in field is mandatory under the given config. Hidden fields
 *  are never mandatory. */
export function builtinRequired(field: BuiltinReportField, config: ReportFieldsConfig): boolean {
  if (field.lockedRequired) return true;
  if (config.hidden?.[field.key]) return false;
  return config.required[field.key] ?? field.defaultRequired;
}

/** A file name without its extension — the default Report Name for an upload. */
export function stripExt(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, '').trim() || filename;
}

/** Turn a label into a stable custom-field key (unique against `taken`). */
export function customFieldKey(label: string, taken: string[]): string {
  const base = 'cf-' + (label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'field');
  let key = base; let i = 2;
  while (taken.includes(key)) key = `${base}-${i++}`;
  return key;
}
