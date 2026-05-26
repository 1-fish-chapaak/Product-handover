// Mock files contained inside file-type data sources. Keyed by DataSource.id.
// Only file-type sources (`f-*`) have entries; database/api/cloud/session sources
// surface their detail differently (out of scope for the file-list iteration).

export type FileFormat = 'PDF' | 'CSV' | 'XLSX';
export type FileStatus = 'processed' | 'processing' | 'failed';

export interface DatasetFile {
  id: string;
  name: string;
  format: FileFormat;
  /** Bytes — formatted at render time. */
  sizeBytes: number;
  uploadedAt: string; // ISO date
  /** Pages for PDF; rows for CSV/XLSX. */
  pages?: number;
  rows?: number;
  status: FileStatus;
}

const KB = 1024;
const MB = KB * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

// Per-source file lists. Names mirror the parent dataset where it makes sense.
export const DATASET_FILES: Record<string, DatasetFile[]> = {
  // Demo Agreements — 3 PDFs (matches the inspiration screenshot)
  'f-09': [
    { id: 'fa-09-1', name: 'Agreement 1.1.pdf',          format: 'PDF', sizeBytes: 752 * KB,  uploadedAt: '2026-04-16', pages: 14, status: 'processed' },
    { id: 'fa-09-2', name: 'Agreement 2 — TTR 1.pdf',    format: 'PDF', sizeBytes: 656 * KB,  uploadedAt: '2026-04-16', pages: 22, status: 'processed' },
    { id: 'fa-09-3', name: 'Agreement 3 — THSL1 1.pdf',  format: 'PDF', sizeBytes: 479 * KB,  uploadedAt: '2026-04-16', pages: 9,  status: 'processed' },
  ],
  'f-01': [
    { id: 'fa-01-1', name: 'AI_Fare_Audit_Q1_2026.xlsx', format: 'XLSX', sizeBytes: 8.4 * MB, uploadedAt: '2026-04-23', rows: 48230, status: 'processed' },
    { id: 'fa-01-2', name: 'AI_Fare_Audit_Q4_2025.xlsx', format: 'XLSX', sizeBytes: 4.0 * MB, uploadedAt: '2026-04-23', rows: 22104, status: 'processed' },
  ],
  'f-02': [
    { id: 'fa-02-1', name: 'PWC_Status_Report_Apr.pdf',  format: 'PDF',  sizeBytes: 1.2 * MB, uploadedAt: '2026-04-23', pages: 32, status: 'processed' },
    { id: 'fa-02-2', name: 'PWC_Findings_Annex.pdf',     format: 'PDF',  sizeBytes: 0.9 * MB, uploadedAt: '2026-04-23', pages: 18, status: 'processing' },
  ],
  'f-03': [
    { id: 'fa-03-1', name: 'emaar_extraction_master.csv', format: 'CSV', sizeBytes: 4.8 * MB, uploadedAt: '2026-04-20', rows: 119240, status: 'processed' },
  ],
  'f-04': [
    { id: 'fa-04-1', name: 'emaar_payments_q1.xlsx',     format: 'XLSX', sizeBytes: 3.2 * MB, uploadedAt: '2026-04-20', rows: 84120, status: 'processed' },
    { id: 'fa-04-2', name: 'emaar_payments_q4.xlsx',     format: 'XLSX', sizeBytes: 3.0 * MB, uploadedAt: '2026-04-20', rows: 76503, status: 'processed' },
  ],
  'f-05': [
    { id: 'fa-05-1', name: 'Loan_Details_FY26.pdf',      format: 'PDF',  sizeBytes: 5.4 * MB, uploadedAt: '2026-04-20', pages: 88, status: 'processed' },
    { id: 'fa-05-2', name: 'Loan_Details_Annex_A.pdf',   format: 'PDF',  sizeBytes: 2.1 * MB, uploadedAt: '2026-04-20', pages: 24, status: 'processed' },
    { id: 'fa-05-3', name: 'Loan_Schedule_2026.xlsx',    format: 'XLSX', sizeBytes: 1.2 * MB, uploadedAt: '2026-04-20', rows: 1280, status: 'failed' },
  ],
  'f-06': [
    { id: 'fa-06-1', name: 'remittance_bank_demo.csv',   format: 'CSV',  sizeBytes: 1.4 * MB, uploadedAt: '2026-04-20', rows: 38420, status: 'processed' },
  ],
  'f-07': [
    { id: 'fa-07-1', name: 'media_demo_revenue.xlsx',    format: 'XLSX', sizeBytes: 5.6 * MB, uploadedAt: '2026-04-17', rows: 42130, status: 'processed' },
    { id: 'fa-07-2', name: 'media_demo_costs.xlsx',      format: 'XLSX', sizeBytes: 3.5 * MB, uploadedAt: '2026-04-17', rows: 28490, status: 'processed' },
  ],
  'f-08': [
    { id: 'fa-08-1', name: 'demo_invoices_1604.csv',     format: 'CSV',  sizeBytes: 3.3 * MB, uploadedAt: '2026-04-16', rows: 91204, status: 'processed' },
  ],
  'f-10': [
    { id: 'fa-10-1', name: 'MB5B_inventory.xlsx',        format: 'XLSX', sizeBytes: 3.8 * MB, uploadedAt: '2026-04-16', rows: 31280, status: 'processed' },
    { id: 'fa-10-2', name: 'MB5B_aging.xlsx',            format: 'XLSX', sizeBytes: 1.9 * MB, uploadedAt: '2026-04-16', rows: 14920, status: 'processed' },
  ],
  'f-11': [
    { id: 'fa-11-1', name: 'AI_HR_KPI_employees.csv',    format: 'CSV',  sizeBytes: 2.9 * MB, uploadedAt: '2026-04-15', rows: 18230, status: 'processed' },
  ],
  'f-12': [
    { id: 'fa-12-1', name: 'NSE_agreement_sample.pdf',   format: 'PDF',  sizeBytes: 4.4 * MB, uploadedAt: '2026-04-14', pages: 56, status: 'processed' },
  ],
  'f-13': [
    { id: 'fa-13-1', name: 'NSE_AP_Q1.xlsx',             format: 'XLSX', sizeBytes: 4.2 * MB, uploadedAt: '2026-04-14', rows: 38120, status: 'processed' },
    { id: 'fa-13-2', name: 'NSE_AP_Q4.xlsx',             format: 'XLSX', sizeBytes: 3.4 * MB, uploadedAt: '2026-04-14', rows: 31490, status: 'processed' },
  ],
  'f-14': [
    { id: 'fa-14-1', name: 'NSE_position_limits.csv',    format: 'CSV',  sizeBytes: 1.8 * MB, uploadedAt: '2026-04-12', rows: 24190, status: 'processed' },
  ],
  'f-15': [
    { id: 'fa-15-1', name: 'NSE_penalties_shortfall.xlsx', format: 'XLSX', sizeBytes: 3.5 * MB, uploadedAt: '2026-04-12', rows: 9810, status: 'processed' },
  ],
  'f-16': [
    { id: 'fa-16-1', name: 'AI_HR_bills_vs_reimburse.xlsx', format: 'XLSX', sizeBytes: 6.0 * MB, uploadedAt: '2026-04-10', rows: 28430, status: 'processed' },
  ],
};

// Per-format Editorial GRC tone token. Used by the file-row icon tile.
export const FORMAT_TONES: Record<FileFormat, { bg: string; text: string }> = {
  PDF:  { bg: 'bg-risk-50',      text: 'text-risk' },
  CSV:  { bg: 'bg-compliant-50', text: 'text-compliant' },
  XLSX: { bg: 'bg-brand-50',     text: 'text-brand-700' },
};

// ─── Integration configs (database / api / cloud sources) ────────────────────
// Masked by default — sensitive fields (password, secret, token) render as ••••••
// with a copy-to-clipboard fallback to the support contact.

export interface ConfigField {
  label: string;
  value: string;
  /** When true, render as masked (••••••) until reveal-on-click. Sensitive fields. */
  sensitive?: boolean;
}

export interface IntegrationConfig {
  /** Provider name shown in the header (e.g., "Oracle", "PostgreSQL", "Google Drive"). */
  provider: string;
  /** Last-tested connection state. Surface as a status pill in the config card. */
  health: 'healthy' | 'degraded' | 'failed' | 'untested';
  fields: ConfigField[];
}

// ─── DB schemas (mock) ───────────────────────────────────────────────────────
// What the backend would expose via Knowledge Hub once a DB connection is wired
// up: the whitelisted tables and their columns. Drives the live-SQL dashboard
// flow — Add Widget renders this as a Database → Table → Column tree, and
// drag-to-canvas lets the user build charts without writing SQL by hand.

export type DbColumnKind = 'dimension' | 'measure';
export type DbColumnDataType = 'string' | 'number' | 'date' | 'boolean';

export interface DbColumn {
  /** Raw column name as it lives in the database. */
  name: string;
  /** Human-friendly label rendered in the tree and used for chart axes. */
  label: string;
  kind: DbColumnKind;
  dataType: DbColumnDataType;
}

export interface DbTable {
  schema: string;
  name: string;
  rowCount: number;
  columns: DbColumn[];
}

export const DB_SCHEMAS: Record<string, DbTable[]> = {
  // Oracle SAP-ERP — AP module
  'db-01': [
    {
      schema: 'AP_MODULE', name: 'INVOICE_HEADER', rowCount: 1_204_530,
      columns: [
        { name: 'INVOICE_DATE',     label: 'Date',                kind: 'dimension', dataType: 'date'   },
        { name: 'PERIOD_MONTH',     label: 'Month',               kind: 'dimension', dataType: 'string' },
        { name: 'REGION_CODE',      label: 'Region',              kind: 'dimension', dataType: 'string' },
        { name: 'VENDOR_NAME',      label: 'Vendor Name',         kind: 'dimension', dataType: 'string' },
        { name: 'STATUS',           label: 'Status',              kind: 'dimension', dataType: 'string' },
        { name: 'CATEGORY',         label: 'Category',            kind: 'dimension', dataType: 'string' },
        { name: 'INVOICE_AMOUNT',   label: 'Invoice Amount (₹)',  kind: 'measure',   dataType: 'number' },
        { name: 'AMOUNT_AT_RISK',   label: 'Amount at Risk (₹)',  kind: 'measure',   dataType: 'number' },
      ],
    },
    {
      schema: 'AP_MODULE', name: 'DUPLICATE_AUDIT', rowCount: 184_220,
      columns: [
        { name: 'AUDIT_DATE',       label: 'Date',                kind: 'dimension', dataType: 'date'   },
        { name: 'INVOICE_ID',       label: 'Invoice ID',          kind: 'dimension', dataType: 'string' },
        { name: 'DUPLICATE_COUNT',  label: 'Duplicate Count',     kind: 'measure',   dataType: 'number' },
        { name: 'DUPLICATE_SCORE',  label: 'Duplicate Score (%)', kind: 'measure',   dataType: 'number' },
        { name: 'INVOICES_SCANNED', label: 'Invoices Scanned',    kind: 'measure',   dataType: 'number' },
      ],
    },
  ],
  // PostgreSQL — vendor master
  'db-02': [
    {
      schema: 'public', name: 'vendors', rowCount: 24_180,
      columns: [
        { name: 'vendor_id',     label: 'Vendor ID',     kind: 'dimension', dataType: 'string' },
        { name: 'vendor_name',   label: 'Vendor Name',   kind: 'dimension', dataType: 'string' },
        { name: 'region',        label: 'Region',        kind: 'dimension', dataType: 'string' },
        { name: 'category',      label: 'Category',      kind: 'dimension', dataType: 'string' },
        { name: 'status',        label: 'Status',        kind: 'dimension', dataType: 'string' },
        { name: 'risk_score',    label: 'Risk Score',    kind: 'measure',   dataType: 'number' },
        { name: 'credit_limit',  label: 'Credit Limit',  kind: 'measure',   dataType: 'number' },
      ],
    },
    {
      schema: 'public', name: 'invoices', rowCount: 1_842_310,
      columns: [
        { name: 'invoice_id',     label: 'Invoice ID',          kind: 'dimension', dataType: 'string' },
        { name: 'invoice_date',   label: 'Date',                kind: 'dimension', dataType: 'date'   },
        { name: 'period_month',   label: 'Month',               kind: 'dimension', dataType: 'string' },
        { name: 'vendor_id',      label: 'Vendor ID',           kind: 'dimension', dataType: 'string' },
        { name: 'department',     label: 'Department',          kind: 'dimension', dataType: 'string' },
        { name: 'status',         label: 'Status',              kind: 'dimension', dataType: 'string' },
        { name: 'invoice_amount', label: 'Invoice Amount (₹)',  kind: 'measure',   dataType: 'number' },
        { name: 'duplicate_flag', label: 'Duplicate Count',     kind: 'measure',   dataType: 'number' },
      ],
    },
    {
      schema: 'public', name: 'payment_terms', rowCount: 312,
      columns: [
        { name: 'term_code',     label: 'Term Code',     kind: 'dimension', dataType: 'string' },
        { name: 'term_label',    label: 'Term',          kind: 'dimension', dataType: 'string' },
        { name: 'days_net',      label: 'Days (Net)',    kind: 'measure',   dataType: 'number' },
        { name: 'discount_pct',  label: 'Discount (%)',  kind: 'measure',   dataType: 'number' },
      ],
    },
  ],
  // Snowflake — GL history
  'db-03': [
    {
      schema: 'GL_HISTORY', name: 'JOURNAL_ENTRIES', rowCount: 8_410_220,
      columns: [
        { name: 'POSTING_DATE',  label: 'Date',                kind: 'dimension', dataType: 'date'   },
        { name: 'PERIOD',        label: 'Month',               kind: 'dimension', dataType: 'string' },
        { name: 'ACCOUNT',       label: 'Account',             kind: 'dimension', dataType: 'string' },
        { name: 'COST_CENTER',   label: 'Cost Center',         kind: 'dimension', dataType: 'string' },
        { name: 'DEPARTMENT',    label: 'Department',          kind: 'dimension', dataType: 'string' },
        { name: 'AMOUNT',        label: 'Amount (₹)',          kind: 'measure',   dataType: 'number' },
        { name: 'AMOUNT_AT_RISK',label: 'Amount at Risk (₹)',  kind: 'measure',   dataType: 'number' },
      ],
    },
    {
      schema: 'GL_HISTORY', name: 'CONTROL_TESTS', rowCount: 12_840,
      columns: [
        { name: 'TEST_DATE',     label: 'Date',              kind: 'dimension', dataType: 'date'   },
        { name: 'CONTROL_ID',    label: 'Control ID',        kind: 'dimension', dataType: 'string' },
        { name: 'CONTROL_NAME',  label: 'Control Name',      kind: 'dimension', dataType: 'string' },
        { name: 'OUTCOME',       label: 'Status',            kind: 'dimension', dataType: 'string' },
        { name: 'PASS_COUNT',    label: 'Pass Count',        kind: 'measure',   dataType: 'number' },
        { name: 'FAIL_COUNT',    label: 'Fail Count',        kind: 'measure',   dataType: 'number' },
      ],
    },
  ],
  // Workday HRIS
  'db-04': [
    {
      schema: 'public', name: 'employees', rowCount: 18_230,
      columns: [
        { name: 'employee_id',   label: 'Employee ID',   kind: 'dimension', dataType: 'string' },
        { name: 'department',    label: 'Department',    kind: 'dimension', dataType: 'string' },
        { name: 'region',        label: 'Region',        kind: 'dimension', dataType: 'string' },
        { name: 'hire_date',     label: 'Hire Date',     kind: 'dimension', dataType: 'date'   },
        { name: 'status',        label: 'Status',        kind: 'dimension', dataType: 'string' },
        { name: 'headcount',     label: 'Headcount',     kind: 'measure',   dataType: 'number' },
        { name: 'salary_cost',   label: 'Salary Cost',   kind: 'measure',   dataType: 'number' },
      ],
    },
    {
      schema: 'public', name: 'expense_claims', rowCount: 142_310,
      columns: [
        { name: 'claim_date',    label: 'Date',                kind: 'dimension', dataType: 'date'   },
        { name: 'period_month',  label: 'Month',               kind: 'dimension', dataType: 'string' },
        { name: 'department',    label: 'Department',          kind: 'dimension', dataType: 'string' },
        { name: 'category',      label: 'Category',            kind: 'dimension', dataType: 'string' },
        { name: 'status',        label: 'Status',              kind: 'dimension', dataType: 'string' },
        { name: 'claim_amount',  label: 'Amount (₹)',          kind: 'measure',   dataType: 'number' },
        { name: 'duplicate_cnt', label: 'Duplicate Count',     kind: 'measure',   dataType: 'number' },
      ],
    },
  ],
};

// Masked by default — sensitive fields (password, secret, token) render as ••••••
// with a copy-to-clipboard fallback to the support contact.

export const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {
  'db-01': {
    provider: 'Oracle Database',
    health: 'healthy',
    fields: [
      { label: 'Host',      value: 'sap-erp-prod.internal.irame.ai' },
      { label: 'Port',      value: '1521' },
      { label: 'Service',   value: 'SAPERP' },
      { label: 'Schema',    value: 'AP_MODULE' },
      { label: 'Username',  value: 'irame_reader' },
      { label: 'Password',  value: 'a4tWNcK9z2QmYpv7rL', sensitive: true },
      { label: 'SSL Mode',  value: 'require' },
    ],
  },
  'db-02': {
    provider: 'PostgreSQL',
    health: 'healthy',
    fields: [
      { label: 'Host',      value: 'vendor-master.internal.irame.ai' },
      { label: 'Port',      value: '5432' },
      { label: 'Database',  value: 'vendor_master' },
      { label: 'Schema',    value: 'public' },
      { label: 'Username',  value: 'irame_reader' },
      { label: 'Password',  value: 'kPx2vNm8qZ4tYbR', sensitive: true },
      { label: 'SSL Mode',  value: 'verify-full' },
    ],
  },
  'db-03': {
    provider: 'Snowflake',
    health: 'degraded',
    fields: [
      { label: 'Account',     value: 'IRAME-XYZ12345.us-east-1' },
      { label: 'Warehouse',   value: 'AUDIT_WH' },
      { label: 'Database',    value: 'GL_HISTORY' },
      { label: 'Role',        value: 'AUDITOR_RO' },
      { label: 'Username',    value: 'svc_irame_audit' },
      { label: 'Private Key', value: 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcw…', sensitive: true },
    ],
  },
  'db-04': {
    provider: 'PostgreSQL',
    health: 'healthy',
    fields: [
      { label: 'Host',      value: 'workday-hris.internal.irame.ai' },
      { label: 'Port',      value: '5432' },
      { label: 'Database',  value: 'workday_hris' },
      { label: 'Username',  value: 'irame_reader' },
      { label: 'Password',  value: 'jLm5xQp2vRz8nTk', sensitive: true },
      { label: 'SSL Mode',  value: 'require' },
    ],
  },
  'api-01': {
    provider: 'Workday REST API',
    health: 'healthy',
    fields: [
      { label: 'Base URL',     value: 'https://wd5-impl.workday.com/ccx/api/v1/irame' },
      { label: 'Auth Type',    value: 'OAuth 2.0 (Client Credentials)' },
      { label: 'Client ID',    value: 'irame-audit-prod' },
      { label: 'Client Secret', value: 'wQp9_XnT4zKrL2vBmYj8Hs', sensitive: true },
      { label: 'Token URL',    value: 'https://wd5-impl.workday.com/ccx/oauth2/irame/token' },
      { label: 'Scopes',       value: 'audit.read events.read' },
    ],
  },
  'api-02': {
    provider: 'NetSuite REST',
    health: 'healthy',
    fields: [
      { label: 'Account ID',  value: 'TSTDRV2147483' },
      { label: 'Base URL',    value: 'https://TSTDRV2147483.suitetalk.api.netsuite.com' },
      { label: 'Auth Type',   value: 'API Key (TBA)' },
      { label: 'Consumer Key', value: 'a8K3pQv2nR9zMmYpL4tWNcK9z2QmYpv7rL', sensitive: true },
      { label: 'Token Secret', value: 'xL7wQp9_XnT4zKrL2vBmYj8HsRtVbN', sensitive: true },
    ],
  },
  'api-03': {
    provider: 'JIRA Cloud REST',
    health: 'untested',
    fields: [
      { label: 'Site URL',  value: 'https://irame.atlassian.net' },
      { label: 'Auth Type', value: 'API Token (Basic)' },
      { label: 'Email',     value: 'svc-audit@irame.ai' },
      { label: 'API Token', value: 'ATATT3xFfGF0z2kPxQp9_XnT4zKrL2vBmYj8Hs', sensitive: true },
      { label: 'Project',   value: 'AUDIT' },
    ],
  },
  'cl-01': {
    provider: 'AWS S3',
    health: 'healthy',
    fields: [
      { label: 'Bucket',         value: 'auditify-evidence-bucket' },
      { label: 'Region',         value: 'us-east-1' },
      { label: 'Auth Type',      value: 'IAM Role (cross-account)' },
      { label: 'Role ARN',       value: 'arn:aws:iam::141813993525:role/IrameAuditReader' },
      { label: 'External ID',    value: 'irame-prod-2026-04', sensitive: true },
      { label: 'KMS Key Alias',  value: 'alias/auditify-evidence-kms' },
    ],
  },
  'cl-02': {
    provider: 'Google Drive',
    health: 'healthy',
    fields: [
      { label: 'Workspace',         value: 'irame.ai' },
      { label: 'Auth Type',         value: 'Service Account' },
      { label: 'Service Account',   value: 'irame-drive-reader@gen-lang-client-0250661731.iam.gserviceaccount.com' },
      { label: 'Key (JSON)',        value: '{"type":"service_account","project_id":"gen-lang-client-0250661731",…}', sensitive: true },
      { label: 'Folder ID',         value: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345' },
      { label: 'Scopes',            value: 'drive.readonly drive.metadata.readonly' },
    ],
  },
  'cl-03': {
    provider: 'Microsoft 365 SharePoint',
    health: 'healthy',
    fields: [
      { label: 'Tenant ID',     value: 'aBcDeFgH-1234-5678-9012-irameTenantId' },
      { label: 'Site URL',      value: 'https://irame.sharepoint.com/sites/AuditLibrary' },
      { label: 'Auth Type',     value: 'Azure AD App (Client Credentials)' },
      { label: 'Client ID',     value: 'a8K3pQv2-nR9z-MmYp-L4tW-NcK9z2QmYpv7' },
      { label: 'Client Secret', value: 'xL7wQp9_XnT4zKrL2vBmYj8HsRtVbN_3jK', sensitive: true },
      { label: 'Scopes',        value: 'Sites.Read.All Files.Read.All' },
    ],
  },
};
